import { assert } from "chai";
import { ChildProcessWithoutNullStreams, spawn, spawnSync } from "child_process";
import { EventEmitter } from "events";
import * as fs from "fs";
import * as net from "net";
import * as path from "path";
import { PassThrough, Readable } from "stream";
import Utilities from "../core/Utilities";
import IFile from "../storage/IFile";
import axios, { AxiosResponse, AxiosError } from "axios";
import { buildSizeSpoofedZip } from "./ZipFixtures";
import SecurityUtilities from "../core/SecurityUtilities";
import { ZipImportErrorCode } from "../storage/ZipImportError";
import {
  defaultValidationReportExcludedTestIds,
  ensureReportJsonMatchesScenario,
  folderMatches,
  volatileFileExtensions,
} from "./TestUtilities";
import {
  sampleFolder,
  scenariosFolder,
  resultsFolder,
  removeResultFolder,
  collectLines,
} from "./CommandLineTestHelpers";
import { NetworkBlocker } from "./CliTranscriptHarness";
import { cliEnv, createTestDataDir, setEnvironmentVariable } from "./TestDataDir";
import TestPaths from "./TestPaths";

const SERVER_STARTUP_TIMEOUT_MS = 15000;
const SERVER_HOST = "127.0.0.1";

/** Where validation looks up the latest versions of a pack's @minecraft/* script modules. */
const NPM_REGISTRY_HOST = "registry.npmjs.org:443";

/** Where validation looks for the vanilla resource pack's file index (see Database.matchesVanillaPath). */
const VANILLA_CONTENT_HOST = "mctools.dev:443";

/** Proxy settings that could send a request past the NetworkBlocker, removed from the CLI's environment. */
const PROXY_ENV_VARS = ["HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "NO_PROXY", "NODE_USE_ENV_PROXY"];

/** Matches ANSI color codes, which the CLI's log adds to warnings. */
// eslint-disable-next-line no-control-regex
const ANSI_CODES = /\x1b\[[0-9;]*m/g;

/** A warning from the CLI's log: "[<timestamp>] [WARN    ] <message>", with the thread ID after it under --verbose. */
const LOG_WARNING_LINE = /^\[\d{4}-\d{2}-\d{2}T[\d:.]+Z\] \[WARN *\] (.*?)(?: \[threadId:\d+\])?$/;

/**
 * The environment for a CLI process whose outbound requests all go to `proxyUrl`. The CLI's lookups use
 * axios, which reads these variables. NODE_USE_ENV_PROXY stays unset, as in CliTranscriptHarness,
 * because Node 22 warns on stderr that it's experimental.
 */
function getIsolatedCliEnv(proxyUrl: string): NodeJS.ProcessEnv {
  const env = cliEnv();

  for (const name of PROXY_ENV_VARS) {
    setEnvironmentVariable(env, name, undefined);
  }

  env.HTTP_PROXY = proxyUrl;
  env.HTTPS_PROXY = proxyUrl;

  return env;
}

/** The warning the CLI prints when the NetworkBlocker refuses the npm registry lookup for a script module. */
function getRefusedRegistryWarning(moduleName: string) {
  return (
    `Could not load registry for '${moduleName}': Request failed with status code 403 ` +
    "Latest script package checks are unavailable; existing dependencies are unchanged."
  );
}

/** The message of a warning line from the CLI's log, or the whole line, marked, if it isn't a warning. */
function getWarningMessage(line: string) {
  const plainLine = line.replace(ANSI_CODES, "");
  const match = LOG_WARNING_LINE.exec(plainLine);

  return match ? match[1] : "(not a warning) " + plainLine;
}

/** Asserts that stderr holds exactly one refused registry lookup warning per module, and nothing else. */
function assertOnlyRefusedRegistryWarnings(stderrLines: string[], scriptModules: string[]) {
  assert.deepEqual(
    stderrLines.map(getWarningMessage).sort(),
    scriptModules.map(getRefusedRegistryWarning).sort(),
    "stderr: " + stderrLines.join("\n") + "|"
  );
}

async function canConnectToServer(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: SERVER_HOST, port }, () => {
      socket.end();
      resolve(true);
    });

    socket.setTimeout(250);
    socket.on("error", () => {
      socket.destroy();
      resolve(false);
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
  });
}

/**
 * POSTs `body` to `url` with the given headers, retrying briefly on transient
 * connection errors (ECONNREFUSED / ECONNRESET / EAI_AGAIN and the
 * AggregateErrors that wrap them). The serve command logs its "Web UI
 * available at:" line just before — or in CI, sometimes microseconds before —
 * the underlying socket transitions to listening, so a single early POST can
 * race the listen() callback and fail. This helper papers over that race
 * without masking real validation failures (non-network errors are rethrown
 * immediately).
 */
async function postWithRetry(
  url: string,
  body: Uint8Array | Buffer | string,
  headers: Record<string, string>,
  maxAttempts: number = 8,
  initialDelayMs: number = 100
): Promise<AxiosResponse> {
  let lastError: unknown;
  let delayMs = initialDelayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await axios.post(url, body, { headers, method: "POST" });
    } catch (err) {
      lastError = err;
      if (!isTransientConnectError(err) || attempt === maxAttempts) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      delayMs = Math.min(delayMs * 2, 1000);
    }
  }

  throw lastError;
}

function isTransientConnectError(err: unknown): boolean {
  if (!err || typeof err !== "object") {
    return false;
  }

  const transientCodes = new Set(["ECONNREFUSED", "ECONNRESET", "EAI_AGAIN", "ENOTFOUND", "ETIMEDOUT", "EPIPE"]);

  const e = err as { code?: unknown; errors?: unknown };
  if (typeof e.code === "string" && transientCodes.has(e.code)) {
    return true;
  }

  if (Array.isArray(e.errors)) {
    return e.errors.some((inner) => isTransientConnectError(inner));
  }

  return false;
}

async function waitForServerStartup(
  stdoutLines: string[],
  stderrLines: string[],
  serverProcess: ChildProcessWithoutNullStreams,
  port: number,
  timeoutMs: number = SERVER_STARTUP_TIMEOUT_MS
): Promise<void> {
  const start = Date.now();
  const expectedHostPort = `localhost:${port}`;

  while (Date.now() - start < timeoutMs) {
    const hasStartupSignal = stdoutLines.some(
      (line) => line.includes("Web UI available at:") && line.includes(expectedHostPort)
    );

    if (hasStartupSignal) {
      if (await canConnectToServer(port)) {
        return;
      }
    }

    if (serverProcess.exitCode !== null || serverProcess.killed) {
      throw new Error(
        `Server exited before startup signal. exitCode=${serverProcess.exitCode}; stdout=${stdoutLines.slice(-10).join(" | ")}; stderr=${stderrLines.slice(-10).join(" | ")}`
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(
    `Timed out waiting for startup signal on ${expectedHostPort}. stdout=${stdoutLines.slice(-10).join(" | ")}; stderr=${stderrLines.slice(-10).join(" | ")}`
  );
}

/** The parts of a child process that trackProcessCompletion uses. */
interface IChildProcessOutput {
  readonly stdout: Readable;
  readonly stderr: Readable;
  readonly exitCode: number | null;
  once(event: "exit", listener: (code: number | null) => void): unknown;
}

/**
 * Starts collecting the child's stdout and stderr lines into the given arrays, and returns a promise
 * that resolves with its exit code once it has exited and both streams have ended. Call it right
 * after spawn, before any `await`:
 * - In `--once` mode the server starts shutting down the instant it calls `res.end()`, so the child
 *   can exit before the test finishes awaiting the HTTP response. Node doesn't replay a missed `exit`
 *   event, so a listener attached late would leave the `before` hook waiting until its mocha timeout.
 * - Node can emit `exit` before it has read everything the child wrote, so a line written just before
 *   exit can still be in the pipe. Waiting for both streams to end means the arrays are complete
 *   before tests compare them. A grandchild that kept the pipes open would make this wait too.
 */
function trackProcessCompletion(
  child: IChildProcessOutput,
  stdoutLines: string[],
  stderrLines: string[]
): Promise<number | null> {
  const exited = new Promise<number | null>((resolve) => {
    if (child.exitCode !== null) {
      resolve(child.exitCode);
      return;
    }

    child.once("exit", (code) => resolve(code));
  });

  const collected = Promise.all([collectLines(child.stdout, stdoutLines), collectLines(child.stderr, stderrLines)]);

  return Promise.all([exited, collected]).then(([exitCode]) => exitCode);
}

/**
 * Creates a standard serve command validation test suite.
 * Reduces duplication across the 5 serveCommand* test suites.
 *
 * The server sends its outbound requests through a NetworkBlocker, a local proxy that refuses them at
 * once (see CliTranscriptHarness.ts), so a run doesn't depend on which hosts the machine can reach:
 * - Validation asks mctools.dev for the vanilla resource pack's file index. When that fails, it uses
 *   the vanilla content index installed with the CLI, which gives these packs the same report.
 * - Validating a pack with @minecraft/* dependencies looks up their latest versions on the npm
 *   registry, and the CLI warns on stderr when it can't. These packs have no package.json and no beta
 *   dependencies, so their reports don't depend on that lookup.
 * Each suite expects exactly those hosts, and exactly those warnings on stderr.
 *
 * @param scriptModules The @minecraft/* modules whose versions the validation looks up.
 */
function createServeValidationTest(
  suiteName: string,
  samplePath: string,
  port: number,
  scriptModules: string[],
  extraHeaders?: Record<string, string>
) {
  describe(suiteName, () => {
    let exitCode: number | null = null;
    const stdoutLines: string[] = [];
    const stderrLines: string[] = [];
    let serverProcess: ChildProcessWithoutNullStreams | null = null;
    const blocker = new NetworkBlocker();
    let networkRequests: string[] = [];

    before(async function () {
      this.timeout(40000);

      removeResultFolder(suiteName);
      const passcode = Utilities.createUuid().substring(0, 8);

      if (!sampleFolder) {
        throw new Error("Sample folder does not exist.");
      }

      const sampleFile: IFile = await sampleFolder.ensureFileFromRelativePath(samplePath);

      await blocker.start();

      serverProcess = spawn(
        "node",
        [
          "./toolbuild/jsn/cli/index.mjs",
          "serve",
          "basicwebservices",
          "--port",
          String(port),
          "--verbose",
          "--once",
          "--updatepc",
          passcode,
        ],
        { env: getIsolatedCliEnv(blocker.url) }
      );

      // Start collecting output and listening for exit at spawn (see trackProcessCompletion).
      const serverCompletion = trackProcessCompletion(serverProcess, stdoutLines, stderrLines);

      await sampleFile.loadContent();
      const content = sampleFile.content;
      if (content === null) {
        throw new Error(`Sample file '${samplePath}' loaded with null content.`);
      }

      await waitForServerStartup(stdoutLines, stderrLines, serverProcess, port);

      const headers: Record<string, string> = {
        mctpc: passcode,
        "content-type": "application/zip",
        ...extraHeaders,
      };

      const response: AxiosResponse = await postWithRetry(
        `http://${SERVER_HOST}:${port}/api/validate/`,
        content,
        headers
      );

      await ensureReportJsonMatchesScenario(scenariosFolder, resultsFolder, response.data, suiteName, [
        ...defaultValidationReportExcludedTestIds,
        "PACKFILECOUNT",
      ]);

      // After this, the server has exited and all of its output has been collected.
      exitCode = await serverCompletion;
      serverProcess = null;
      networkRequests = blocker.takeRequests();
    });

    it("should have only the refused registry lookups on stderr", async () => {
      if (serverProcess) {
        serverProcess.kill();
        serverProcess = null;
      }
      assertOnlyRefusedRegistryWarnings(stderrLines, scriptModules);
    }).timeout(10000);

    it("should have tried to reach only the vanilla content and npm registry hosts", () => {
      const expectedHosts = [VANILLA_CONTENT_HOST, ...(scriptModules.length > 0 ? [NPM_REGISTRY_HOST] : [])];

      assert.deepEqual(networkRequests, expectedHosts.sort());
    }).timeout(10000);

    it("exit code should be zero", async () => {
      if (serverProcess) {
        serverProcess.kill();
        serverProcess = null;
      }
      assert.equal(exitCode, 0);
    }).timeout(10000);

    it("output matches", async () => {
      await folderMatches(scenariosFolder, resultsFolder, suiteName, [...volatileFileExtensions, "report.json"]);
    });

    after(async function () {
      if (serverProcess) {
        serverProcess.kill();
        serverProcess = null;
      }
      await blocker.stop();
    });
  });
}

/** The @minecraft/* modules the sample packs depend on. */
const SAMPLE_SCRIPT_MODULES = ["@minecraft/server", "@minecraft/server-ui"];

/**
 * The world sample's TypeScript, which its build embeds in the source maps it packages with the world
 * template. serveCommandValidateWorld and serveCommandValidateMashup record those maps' sizes, so the
 * files need LF line endings on every OS. samplecontent/world/.gitattributes checks them out that way.
 */
const WORLD_SCRIPTS_FOLDER = "samplecontent/world/scripts";

const CARRIAGE_RETURN = 13;

function listTypeScriptFiles(folder: string): string[] {
  return fs
    .readdirSync(folder, { recursive: true, encoding: "utf8" })
    .filter((name) => name.endsWith(".ts"))
    .map((name) => path.join(folder, name));
}

describe("serve report fixtures", () => {
  it("has the world sample's TypeScript with LF line endings", () => {
    const files = listTypeScriptFiles(path.join(TestPaths.repoRoot, WORLD_SCRIPTS_FOLDER));

    assert.isNotEmpty(files);
    assert.deepEqual(
      files.filter((file) => fs.readFileSync(file).includes(CARRIAGE_RETURN)),
      [],
      "These files have CR line endings, so the world sample's source maps won't match the serve report " +
        `scenarios. Delete them, run \`git checkout -- ${WORLD_SCRIPTS_FOLDER}\`, and rebuild the sample ` +
        "with `npx gulp package` in samplecontent/world."
    );
  });

  it("checks the world sample's TypeScript out with LF where Git converts text to CRLF", function () {
    const listed = spawnSync("git", ["ls-files", "-z", "--", WORLD_SCRIPTS_FOLDER], {
      cwd: TestPaths.repoRoot,
      encoding: "utf8",
    });

    if (listed.error || listed.status !== 0) {
      // Not a Git checkout, so no checkout converted the files; the test above still checks them.
      this.skip();
    }

    const files = listed.stdout.split("\0").filter((file) => file.endsWith(".ts"));
    assert.isNotEmpty(files);

    for (const file of files) {
      // Git for Windows sets core.autocrlf=true, so its checkouts convert text files to CRLF.
      const checkedOut = spawnSync("git", ["-c", "core.autocrlf=true", "cat-file", "--filters", ":" + file], {
        cwd: TestPaths.repoRoot,
      });

      assert.equal(checkedOut.status, 0, String(checkedOut.stderr));
      assert.isFalse(
        checkedOut.stdout.includes(CARRIAGE_RETURN),
        `Git for Windows would check ${file} out with CRLF line endings. samplecontent/world/.gitattributes ` +
          "should check it out with LF."
      );
    }
  });
});

/** A warning line as the CLI's log prints it under --verbose (see LocalLogFormatter). */
function formatLogWarning(message: string) {
  return `\x1b[33m[${new Date().toISOString()}] [WARN    ] ${message} [threadId:0]\x1b[0m`;
}

/** What validating the sample packs behind the NetworkBlocker writes to stderr. */
const REFUSED_REGISTRY_WARNING_LINES = SAMPLE_SCRIPT_MODULES.map((moduleName) =>
  formatLogWarning(getRefusedRegistryWarning(moduleName))
);

const UNEXPECTED_LINE = "An unexpected final line";

/** Node code for a child that writes the lines in TEST_STDERR_LINES to stderr and exits right after. */
const WRITE_STDERR_AND_EXIT =
  "const lines = JSON.parse(process.env.TEST_STDERR_LINES);" +
  "require('fs').writeSync(2, lines.map((line) => line + '\\n').join(''));" +
  "process.exit(0);";

/** How many short-lived children each case starts, to exercise the order of exit and pipe reads. */
const SHORT_LIVED_CHILD_RUNS = 20;

/** Runs the stderr check the serve suites make, expecting it to pass or to reject UNEXPECTED_LINE. */
function checkSampleStderr(stderrLines: string[], accepted: boolean) {
  if (accepted) {
    assertOnlyRefusedRegistryWarnings(stderrLines, SAMPLE_SCRIPT_MODULES);
  } else {
    assert.throws(() => assertOnlyRefusedRegistryWarnings(stderrLines, SAMPLE_SCRIPT_MODULES), UNEXPECTED_LINE);
  }
}

describe("serve validation output capture", () => {
  // Node can emit `exit` before it has read a child's last lines. A fake child makes that order certain.
  const outputAfterExitCases = [
    {
      name: "waits for a warning that arrives after the child exits",
      beforeExit: REFUSED_REGISTRY_WARNING_LINES.slice(0, 1),
      afterExit: REFUSED_REGISTRY_WARNING_LINES.slice(1),
      accepted: true,
    },
    {
      name: "rejects an unexpected line that arrives after the child exits",
      beforeExit: REFUSED_REGISTRY_WARNING_LINES,
      afterExit: [UNEXPECTED_LINE],
      accepted: false,
    },
  ];

  for (const testCase of outputAfterExitCases) {
    it(testCase.name, async () => {
      const child = Object.assign(new EventEmitter(), {
        stdout: new PassThrough(),
        stderr: new PassThrough(),
        exitCode: null as number | null,
      });
      const stdoutLines: string[] = [];
      const stderrLines: string[] = [];
      let exitCode: number | null | undefined;
      const completion = trackProcessCompletion(child, stdoutLines, stderrLines).then((code) => (exitCode = code));

      child.stderr.write(testCase.beforeExit.map((line) => line + "\n").join(""));
      child.exitCode = 0;
      child.emit("exit", 0, null);
      await new Promise((resolve) => setImmediate(resolve));

      assert.isUndefined(exitCode, "Resolved when the child exited, before its output ended.");

      child.stderr.end(testCase.afterExit.map((line) => line + "\n").join(""));
      child.stdout.end();
      await completion;

      assert.equal(exitCode, 0);
      assert.lengthOf(stderrLines, testCase.beforeExit.length + testCase.afterExit.length);
      checkSampleStderr(stderrLines, testCase.accepted);
    });
  }

  const shortLivedChildCases = [
    {
      name: "collects every warning short-lived children write right before they exit",
      lines: REFUSED_REGISTRY_WARNING_LINES,
      accepted: true,
    },
    {
      name: "rejects an unexpected last line from short-lived children",
      lines: [...REFUSED_REGISTRY_WARNING_LINES, UNEXPECTED_LINE],
      accepted: false,
    },
  ];

  for (const testCase of shortLivedChildCases) {
    it(testCase.name, async function () {
      this.timeout(60000);

      for (let run = 1; run <= SHORT_LIVED_CHILD_RUNS; run++) {
        const child = spawn(process.execPath, ["-e", WRITE_STDERR_AND_EXIT], {
          env: { ...process.env, TEST_STDERR_LINES: JSON.stringify(testCase.lines) },
        });
        const stdoutLines: string[] = [];
        const stderrLines: string[] = [];

        const exitCode = await trackProcessCompletion(child, stdoutLines, stderrLines);

        assert.equal(exitCode, 0, `Run ${run}: stderr: ${stderrLines.join("\n")}`);
        assert.lengthOf(stderrLines, testCase.lines.length, `Run ${run}: stderr: ${stderrLines.join("\n")}`);
        checkSampleStderr(stderrLines, testCase.accepted);
      }
    });
  }
});

createServeValidationTest(
  "serveCommandValidate",
  "/addon/build/packages/aop_moremobs_animationmanifesterrors.zip",
  16127,
  SAMPLE_SCRIPT_MODULES
);

// The add-on suite doesn't check script modules, so it doesn't look them up.
createServeValidationTest(
  "serveCommandValidateAddon",
  "/addon/build/packages/aop_moremobs_animationmanifesterrors.zip",
  16128,
  [],
  { mctsuite: "addon" }
);

createServeValidationTest(
  "serveCommandValidateWorld",
  "/world/build/packages/aop_moremobs_linkerrors.zip",
  16129,
  SAMPLE_SCRIPT_MODULES
);

createServeValidationTest(
  "serveCommandValidateMashup",
  "/world/build/packages/aop_moremobs_mashup.zip",
  16130,
  SAMPLE_SCRIPT_MODULES
);

createServeValidationTest(
  "serveCommandValidateAdvanced",
  "/addon/build/packages/aop_moremobs_advanced.zip",
  16131,
  SAMPLE_SCRIPT_MODULES,
  { mctsuite: "all" }
);

const MB = 1024 * 1024;

/**
 * Spins up a real `serve` process and POSTs a zip that must be rejected by the content-scoped
 * size handling, asserting the caller receives a *structured* JSON error (stable `code` +
 * specific `message` + the recommended HTTP status) instead of the generic
 * "Error processing passed-in validation package." string. This is the HTTP-layer contract
 * that Auger depends on for task 1640388, so we verify it end-to-end through /api/validate.
 */
function createServeZipErrorTest(
  suiteName: string,
  port: number,
  buildBody: () => Promise<Buffer>,
  expected: { status: number; code: string }
) {
  describe(suiteName, () => {
    let exitCode: number | null = null;
    const stdoutLines: string[] = [];
    const stderrLines: string[] = [];
    let serverProcess: ChildProcessWithoutNullStreams | null = null;
    let response: AxiosResponse | undefined;

    before(async function () {
      // Building the (potentially multi-GB decompressed) body plus server startup can be slow.
      this.timeout(180000);

      const passcode = Utilities.createUuid().substring(0, 8);

      serverProcess = spawn("node", [
        "./toolbuild/jsn/cli/index.mjs",
        "serve",
        "basicwebservices",
        "--port",
        String(port),
        "--verbose",
        "--once",
        "--updatepc",
        passcode,
      ]);

      // Start collecting output and listening for exit at spawn (see trackProcessCompletion).
      const serverCompletion = trackProcessCompletion(serverProcess, stdoutLines, stderrLines);

      const body = await buildBody();

      await waitForServerStartup(stdoutLines, stderrLines, serverProcess, port);

      const headers: Record<string, string> = {
        mctpc: passcode,
        "content-type": "application/zip",
      };

      // The endpoint answers with a non-2xx status for these cases, which axios surfaces as a
      // rejected promise carrying the response — capture that so the assertions can inspect it.
      try {
        response = await postWithRetry(`http://${SERVER_HOST}:${port}/api/validate/`, body, headers);
      } catch (err) {
        const errResponse = (err as AxiosError).response;

        if (!errResponse) {
          throw err;
        }

        response = errResponse as AxiosResponse;
      }

      exitCode = await serverCompletion;
      serverProcess = null;
    });

    after(function () {
      if (serverProcess) {
        serverProcess.kill();
        serverProcess = null;
      }
    });

    it("returns the recommended HTTP status code", () => {
      assert(response, "Expected a response from /api/validate.");
      assert.equal(response!.status, expected.status);
    }).timeout(10000);

    it("returns a structured, non-generic error body with a stable code", () => {
      assert(response, "Expected a response from /api/validate.");

      const data = response!.data as { code?: string; message?: string; error?: string };

      // This checks the HTTP response carries the enum value; the literal wire strings that
      // external clients depend on (e.g. "PACKAGE_SIZE_EXCEEDED") are independently locked by the
      // enum-contract test in ZipImportSizeTest.ts, so a wire rename fails there rather than
      // silently moving producer and assertion together here.
      assert.equal(data.code, expected.code, "Unexpected error code. Body: " + JSON.stringify(data));
      assert(
        typeof data.message === "string" && data.message.length > 0,
        "Expected a specific error message. Body: " + JSON.stringify(data)
      );
      // Must NOT collapse to the generic catch-all message (the whole point of the fix).
      assert.notEqual(data.message, "Error processing passed-in validation package.");
    }).timeout(10000);

    it("exit code should be zero (graceful shutdown in --once mode)", () => {
      assert.equal(exitCode, 0, "stderr: " + stderrLines.join(" | "));
    }).timeout(10000);
  });
}

// Content/ over the 500 MiB Marketplace limit -> structured CONTENT_SIZE_EXCEEDED (413).
// The zip only DECLARES the oversize Content/ entry (see buildSizeSpoofedZip); no large buffer
// is compressed, so the HTTP/413 path is covered in milliseconds.
createServeZipErrorTest(
  "serveCommandValidateContentTooLarge",
  16132,
  async () =>
    buildSizeSpoofedZip([
      { path: "Content/big.bin", declaredSize: SecurityUtilities.MAX_CONTENT_DECOMPRESSED_SIZE + 1 },
      { path: "README.md", data: new Uint8Array(16) },
    ]),
  { status: 413, code: ZipImportErrorCode.contentSizeExceeded }
);

// Total decompressed size over the 2 GiB unzip safety ceiling (driven by non-Content files, so
// Content/ itself is tiny) -> structured PACKAGE_SIZE_EXCEEDED (413). Three entries each DECLARE
// 700 MiB (2100 MiB total) without any real multi-GB compression or allocation.
createServeZipErrorTest(
  "serveCommandValidatePackageTooLarge",
  16133,
  async () =>
    buildSizeSpoofedZip([
      { path: "Content/small.json", data: new Uint8Array(32) },
      { path: "huge/blob0.bin", declaredSize: 700 * MB },
      { path: "huge/blob1.bin", declaredSize: 700 * MB },
      { path: "huge/blob2.bin", declaredSize: 700 * MB },
    ]),
  { status: 413, code: ZipImportErrorCode.packageSizeExceeded }
);

describe("serveCommandTimeout", () => {
  let serverProcess: ChildProcessWithoutNullStreams | null = null;
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  before(function (done) {
    this.timeout(30000);

    serverProcess = spawn("node", [
      "./toolbuild/jsn/cli/index.mjs",
      "serve",
      "basicwebservices",
      "--port",
      "16199",
      "--timeout",
      "2",
      "--updatepc",
      "testpc1a",
    ]);

    collectLines(serverProcess.stdout, stdoutLines);
    collectLines(serverProcess.stderr, stderrLines);

    serverProcess.on("exit", (code) => {
      exitCode = code;
    });

    // Give the server time to start up and produce output, then signal done
    setTimeout(() => {
      done();
    }, 5000);
  });

  after(function () {
    if (serverProcess && !serverProcess.killed) {
      serverProcess.kill();
    }
  });

  it("should have started the web server", () => {
    const hasWebUI = stdoutLines.some(
      (line) => line.includes("Web UI") || line.includes("localhost") || line.includes("16199")
    );
    assert(hasWebUI, "Should mention web UI URL in output. Got: " + stdoutLines.slice(0, 5).join(" | "));
  }).timeout(10000);
});

describe("serveCommandVersion", () => {
  let serverProcess: ChildProcessWithoutNullStreams | null = null;
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  before(function (done) {
    this.timeout(30000);

    serverProcess = spawn("node", [
      "./toolbuild/jsn/cli/index.mjs",
      "serve",
      "basicwebservices",
      "--port",
      "16198",
      "--timeout",
      "2",
      "--updatepc",
      "testpc2b",
    ]);

    collectLines(serverProcess.stdout, stdoutLines);
    collectLines(serverProcess.stderr, stderrLines);

    serverProcess.on("exit", (code) => {
      exitCode = code;
    });

    setTimeout(() => {
      done();
    }, 5000);
  });

  after(function () {
    if (serverProcess && !serverProcess.killed) {
      serverProcess.kill();
    }
  });

  it("should display server startup info", () => {
    const hasServerInfo = stdoutLines.some(
      (line) => line.includes("Web UI") || line.includes("MCP endpoint") || line.includes("auto-exit")
    );
    assert(hasServerInfo, "Should show server startup info. Got: " + stdoutLines.slice(0, 5).join(" | "));
  }).timeout(10000);
});

describe("serveCommandInvalidPort", () => {
  let serverProcess: ChildProcessWithoutNullStreams | null = null;
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  before(function (done) {
    this.timeout(30000);

    serverProcess = spawn("node", [
      "./toolbuild/jsn/cli/index.mjs",
      "serve",
      "basicwebservices",
      "--port",
      "99999",
      "--timeout",
      "2",
      "--updatepc",
      "testpc3c",
    ]);

    collectLines(serverProcess.stdout, stdoutLines);
    collectLines(serverProcess.stderr, stderrLines);

    serverProcess.on("exit", (code) => {
      exitCode = code;
    });

    setTimeout(() => {
      done();
    }, 5000);
  });

  after(function () {
    if (serverProcess && !serverProcess.killed) {
      serverProcess.kill();
    }
  });

  it("should fall back to default port for invalid port number", () => {
    // Port 99999 is out of range (1-65535) - server falls back to default port
    const hasInvalidPortMsg = stdoutLines.some((line) => line.includes("Invalid port") || line.includes("default"));
    assert(hasInvalidPortMsg, "Should mention invalid port fallback. Got: " + stdoutLines.slice(0, 5).join(" | "));
  }).timeout(10000);
});

describe("passcodesCommand", async () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  before(function (done) {
    this.timeout(15000);

    const process = spawn("node", ["./toolbuild/jsn/cli/index.mjs", "passcodes"]);

    collectLines(process.stdout, stdoutLines);
    collectLines(process.stderr, stderrLines);

    process.on("exit", (code) => {
      exitCode = code;
      done();
    });
  });

  it("should have no stderr lines", async () => {
    assert.equal(stderrLines.length, 0, "Error: |" + stderrLines.join("\n") + "|");
  }).timeout(10000);

  it("exit code should be zero", async () => {
    assert.equal(exitCode, 0);
  }).timeout(10000);

  it("should display passcode labels", () => {
    const allOutput = stdoutLines.join("\n").toLowerCase();
    const hasPasscodes = allOutput.includes("admin") || allOutput.includes("passcode") || allOutput.includes("display");
    assert(hasPasscodes, "Should show passcode info. Got: " + stdoutLines.slice(0, 10).join(" | "));
  }).timeout(10000);
});

describe("passcodesCommandJson", async () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  before(function (done) {
    this.timeout(15000);

    const process = spawn("node", ["./toolbuild/jsn/cli/index.mjs", "passcodes", "--json"]);

    collectLines(process.stdout, stdoutLines);
    collectLines(process.stderr, stderrLines);

    process.on("exit", (code) => {
      exitCode = code;
      done();
    });
  });

  it("should have no stderr lines", async () => {
    assert.equal(stderrLines.length, 0, "Error: |" + stderrLines.join("\n") + "|");
  }).timeout(10000);

  it("exit code should be zero", async () => {
    assert.equal(exitCode, 0);
  }).timeout(10000);

  it("should output valid JSON with passcodes", () => {
    const jsonLine = stdoutLines.find((line) => line.startsWith("{"));
    assert(jsonLine, "Should contain a JSON line. Got: " + stdoutLines.slice(0, 5).join(" | "));
    const parsed = JSON.parse(jsonLine!);
    assert(
      parsed.passcodes || parsed.admin || parsed.displayReadOnly,
      "JSON should have passcode fields. Got: " + JSON.stringify(parsed).substring(0, 100)
    );
  }).timeout(10000);
});

describe("setServerPropsCommand", async () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  before(function (done) {
    this.timeout(15000);

    const process = spawn("node", ["./toolbuild/jsn/cli/index.mjs", "setserverprops"]);

    collectLines(process.stdout, stdoutLines);
    collectLines(process.stderr, stderrLines);

    process.on("exit", (code) => {
      exitCode = code;
      done();
    });
  });

  it("should have no stderr lines", async () => {
    assert.equal(stderrLines.length, 0, "Error: |" + stderrLines.join("\n") + "|");
  }).timeout(10000);

  it("exit code should be zero", async () => {
    assert.equal(exitCode, 0);
  }).timeout(10000);

  it("should display server properties", () => {
    const allOutput = stdoutLines.join("\n").toLowerCase();
    const hasProps = allOutput.includes("port") || allOutput.includes("server") || allOutput.includes("domain");
    assert(hasProps, "Should show server properties. Got: " + stdoutLines.slice(0, 10).join(" | "));
  }).timeout(10000);
});

describe("eulaCommandDisplay", async () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  before(function (done) {
    this.timeout(15000);

    // Accept through the environment variable, which skips the interactive prompt.
    const env = cliEnv({ acceptEula: true });

    const process2 = spawn("node", ["./toolbuild/jsn/cli/index.mjs", "eula"], { env });

    collectLines(process2.stdout, stdoutLines);
    collectLines(process2.stderr, stderrLines);

    process2.on("exit", (code) => {
      exitCode = code;
      done();
    });
  });

  it("should have no stderr lines", async () => {
    assert.equal(stderrLines.length, 0, "Error: |" + stderrLines.join("\n") + "|");
  }).timeout(10000);

  it("exit code should be zero", async () => {
    assert.equal(exitCode, 0);
  }).timeout(10000);

  it("should mention EULA", () => {
    const allOutput = stdoutLines.join("\n").toLowerCase();
    const hasEula = allOutput.includes("eula") || allOutput.includes("license") || allOutput.includes("accept");
    assert(hasEula, "Should mention EULA. Got: " + stdoutLines.slice(0, 10).join(" | "));
  }).timeout(10000);
});

describe("dedicatedServeCommandMissingEula", async () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  before(function (done) {
    this.timeout(15000);

    // A new data folder and no EULA environment variable, like a new user's first run.
    const env = cliEnv({ dataDir: createTestDataDir("dedicatedserve-no-eula") });

    const process2 = spawn("node", ["./toolbuild/jsn/cli/index.mjs", "dedicatedserve"], { env });

    collectLines(process2.stdout, stdoutLines);
    collectLines(process2.stderr, stderrLines);

    // If the EULA check ever lets this through, stop the server it starts instead of leaking it.
    const killer = setTimeout(() => process2.kill(), 10000);

    process2.on("exit", (code) => {
      clearTimeout(killer);
      exitCode = code;
      done();
    });
  });

  it("should exit with an error when the server cannot start", async () => {
    assert.equal(exitCode, 1, "Failed server startup should exit with code 1");
  }).timeout(10000);

  it("should say the EULA isn't accepted and how to accept it", () => {
    const stderr = stderrLines.join("\n");

    assert.include(stderr, "EULA not accepted");
    assert.include(stderr, "mct eula --accept");
  });
});
