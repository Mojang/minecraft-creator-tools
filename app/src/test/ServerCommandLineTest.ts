import { assert } from "chai";
import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import * as net from "net";
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
import { cliEnv, createTestDataDir } from "./TestDataDir";

const SERVER_STARTUP_TIMEOUT_MS = 15000;
const SERVER_HOST = "127.0.0.1";

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

/**
 * Registers the child's `exit` listener synchronously (call this immediately after
 * spawn, before any `await`) and returns a promise that resolves with the exit code.
 *
 * In `--once` mode the server starts shutting down the instant it calls `res.end()`,
 * so the child can exit *before* the test finishes awaiting the HTTP response. Node
 * does not replay a missed `exit` event, so attaching the listener late would leave
 * the `before` hook waiting until its multi-minute mocha timeout — the exact CI flake
 * this avoids. Attaching at spawn time (and short-circuiting if the process has
 * somehow already exited) closes that window while preserving the graceful-exit
 * assertion (the returned promise still only resolves once the child actually exits).
 */
function trackProcessExit(serverProcess: ChildProcessWithoutNullStreams): Promise<number | null> {
  return new Promise((resolve) => {
    if (serverProcess.exitCode !== null) {
      resolve(serverProcess.exitCode);
      return;
    }

    serverProcess.once("exit", (code) => resolve(code));
  });
}

/**
 * Creates a standard serve command validation test suite.
 * Reduces duplication across the 5 serveCommand* test suites.
 */
function createServeValidationTest(
  suiteName: string,
  samplePath: string,
  port: number,
  extraHeaders?: Record<string, string>
) {
  describe(suiteName, () => {
    let exitCode: number | null = null;
    const stdoutLines: string[] = [];
    const stderrLines: string[] = [];
    let serverProcess: ChildProcessWithoutNullStreams | null = null;

    before(async function () {
      this.timeout(40000);

      removeResultFolder(suiteName);
      const passcode = Utilities.createUuid().substring(0, 8);

      if (!sampleFolder) {
        throw new Error("Sample folder does not exist.");
      }

      const sampleFile: IFile = await sampleFolder.ensureFileFromRelativePath(samplePath);

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

      collectLines(serverProcess.stdout, stdoutLines);
      collectLines(serverProcess.stderr, stderrLines);

      // Attach the exit listener synchronously with spawn so a fast --once shutdown
      // can't fire `exit` before we're listening for it (see trackProcessExit).
      const serverExitPromise = trackProcessExit(serverProcess);

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

      exitCode = await serverExitPromise;
      serverProcess = null;
    });

    it("should have no stderr lines", async () => {
      if (serverProcess) {
        serverProcess.kill();
        serverProcess = null;
      }
      assert.equal(stderrLines.length, 0, "Error: " + stderrLines.join("\n") + "|");
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

    after(function () {
      if (serverProcess) {
        serverProcess.kill();
        serverProcess = null;
      }
    });
  });
}

createServeValidationTest(
  "serveCommandValidate",
  "/addon/build/packages/aop_moremobs_animationmanifesterrors.zip",
  16127
);

createServeValidationTest(
  "serveCommandValidateAddon",
  "/addon/build/packages/aop_moremobs_animationmanifesterrors.zip",
  16128,
  { mctsuite: "addon" }
);

createServeValidationTest("serveCommandValidateWorld", "/world/build/packages/aop_moremobs_linkerrors.zip", 16129);

createServeValidationTest("serveCommandValidateMashup", "/world/build/packages/aop_moremobs_mashup.zip", 16130);

createServeValidationTest("serveCommandValidateAdvanced", "/addon/build/packages/aop_moremobs_advanced.zip", 16131, {
  mctsuite: "all",
});

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

      collectLines(serverProcess.stdout, stdoutLines);
      collectLines(serverProcess.stderr, stderrLines);

      // Attach the exit listener synchronously with spawn so a fast --once shutdown
      // can't fire `exit` before we're listening for it (see trackProcessExit).
      const serverExitPromise = trackProcessExit(serverProcess);

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

      exitCode = await serverExitPromise;
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
