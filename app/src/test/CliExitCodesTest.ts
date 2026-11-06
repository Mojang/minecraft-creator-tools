/**
 * CliExitCodesTest - Table-driven assertions that several failure scenarios
 * produce non-zero exit codes (and, where applicable, a specific message
 * substring on stderr or stdout).
 *
 * Pro users in CI rely on exit codes for build-script branching. Any change
 * that silently turns a failure into a success (exit 0) would be a high-impact
 * regression.
 */

import { assert } from "chai";
import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import "../app/Project";
import { collectLines } from "./CommandLineTestHelpers";
import { buildCliEnvironment, NetworkBlocker, snapshotTree } from "./CliTranscriptHarness";
import { cliEnv, createTestDataDir, DATA_DIR_ENV } from "./TestDataDir";
import TestPaths from "./TestPaths";

interface ICase {
  name: string;
  args: string[];
  /** Substring expected somewhere in stderr OR stdout (case-insensitive). Optional. */
  expectIn?: string;
  /** If provided, exit code must equal this. Otherwise we only assert non-zero. */
  expectExit?: number;
  /** If true, allow exit code 0 (test only verifies the command runs & message appears). */
  allowZero?: boolean;
  /** Accept the Minecraft EULA, for a command that checks it before the failure under test. */
  acceptEula?: boolean;
}

const cases: ICase[] = [
  {
    name: "validate addon with missing input folder",
    args: ["validate", "addon", "-i", "./does-not-exist", "--isolated", "--quiet"],
    expectIn: "does not exist",
  },
  {
    name: "unknown top-level command",
    args: ["unknown-command-zzz"],
  },
  {
    name: "add --yes with no type argument",
    args: ["add", "--yes"],
    expectIn: "type",
    acceptEula: true,
  },
];

describe("cliExitCodes", () => {
  for (const c of cases) {
    describe(c.name, () => {
      let exitCode: number | null = null;
      const stdoutLines: string[] = [];
      const stderrLines: string[] = [];

      before(function (done) {
        this.timeout(20000);

        const proc = spawn("node", ["./toolbuild/jsn/cli/index.mjs", ...c.args], {
          env: cliEnv({ acceptEula: c.acceptEula }),
        });

        collectLines(proc.stdout, stdoutLines);
        collectLines(proc.stderr, stderrLines);

        proc.on("exit", (code) => {
          exitCode = code;
          done();
        });
      });

      it("should exit with the expected non-zero code", () => {
        assert.notEqual(exitCode, null, "Process should exit");

        if (c.allowZero !== true) {
          if (c.expectExit !== undefined) {
            assert.equal(exitCode, c.expectExit, `Exit code should be ${c.expectExit}, was ${exitCode}`);
          } else {
            assert.notEqual(exitCode, 0, "Exit code should be non-zero. stderr: " + stderrLines.join("\n"));
          }
        }
      }).timeout(20000);

      if (c.expectIn) {
        it(`should mention "${c.expectIn}" in stderr or stdout`, () => {
          const all = (stderrLines.join("\n") + "\n" + stdoutLines.join("\n")).toLowerCase();
          assert(
            all.includes(c.expectIn!.toLowerCase()),
            `Expected output to mention "${c.expectIn}". Got stderr: ${stderrLines.join(
              " | "
            )} | stdout: ${stdoutLines.slice(0, 10).join(" | ")}`
          );
        }).timeout(20000);
      }
    });
  }
});

describe("cliExitCodes rejected global options", function () {
  this.timeout(30000);

  const cliPath = path.join(TestPaths.appRoot, "toolbuild", "jsn", "cli", "index.mjs");
  const blocker = new NetworkBlocker();
  const modes = [
    { name: "human", flags: [] },
    { name: "quiet", flags: ["--quiet"] },
    { name: "JSON", flags: ["--json"] },
    { name: "quiet JSON", flags: ["--quiet", "--json"] },
  ];
  const failures = [
    {
      name: "invalid SSL port",
      command: "validate",
      flags: ["--experimental-ssl-port", "abc"],
      diagnostic: "Invalid --experimental-ssl-port value: abc. Must be a valid port number.",
    },
    {
      name: "certificate without a key",
      command: "version",
      flags: ["--experimental-ssl-cert", "cert.pem"],
      diagnostic: "--experimental-ssl-cert requires --experimental-ssl-key to be specified.",
    },
  ];

  let project: string;
  let cwd: string;
  let home: string;
  let data: string;
  let beforeProject: ReturnType<typeof snapshotTree>;

  before(async () => blocker.start());
  after(async () => blocker.stop());

  beforeEach(() => {
    const root = createTestDataDir("cli-global-options");
    project = path.join(root, "project");
    cwd = path.join(root, "cwd");
    home = path.join(root, "home");
    data = path.join(root, "data");
    fs.cpSync(TestPaths.sampleContentPath("platform_version_errors"), project, { recursive: true });
    fs.mkdirSync(cwd);
    fs.mkdirSync(home);
    beforeProject = snapshotTree(project);
  });

  afterEach(() => {
    assert.deepEqual(snapshotTree(project), beforeProject, "Input content must not change");
    assert.isEmpty(snapshotTree(home), "The disposable HOME must not change");
    assert.isEmpty(blocker.takeRequests(), "These commands must not request external resources");
  });

  function runCli(
    args: string[],
    slowStderr = false
  ): Promise<{ code: number | null; stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const proc = spawn(process.execPath, [cliPath, ...args, "-i", project, "--isolated"], {
        cwd,
        env: {
          ...buildCliEnvironment(data, blocker.url, cliEnv({ dataDir: data })),
          [DATA_DIR_ENV]: data,
          HOME: home,
          USERPROFILE: home,
          MCT_NO_OPEN_BROWSER: "1",
        },
        stdio: ["ignore", "pipe", "pipe"],
      });
      let stdout = "";
      let stderr = "";
      let timedOut = false;
      const timeout = setTimeout(() => {
        timedOut = true;
        proc.kill("SIGKILL");
      }, 20000);
      proc.stdout.setEncoding("utf8");
      proc.stderr.setEncoding("utf8");
      proc.stdout.on("data", (chunk: string) => (stdout += chunk));
      proc.stderr.on("data", (chunk: string) => (stderr += chunk));
      let resume: ReturnType<typeof setTimeout> | undefined;
      if (slowStderr) {
        proc.stderr.pause();
        proc.stderr.once("readable", () => {
          resume = setTimeout(() => proc.stderr.resume(), 500);
        });
      }
      proc.on("error", (error) => {
        clearTimeout(timeout);
        clearTimeout(resume);
        reject(error);
      });
      // Wait for both pipes, not just process exit, to assert the complete diagnostic.
      proc.on("close", (code, signal) => {
        clearTimeout(timeout);
        clearTimeout(resume);
        if (timedOut || signal) {
          reject(new Error(`CLI did not exit normally (timeout=${timedOut}, signal=${signal}).\n${stdout}\n${stderr}`));
          return;
        }
        resolve({ code, stdout, stderr });
      });
    });
  }

  function assertRejected(
    result: { code: number | null; stdout: string; stderr: string },
    diagnostic: string,
    expectHeader = false
  ) {
    assert.equal(result.code, 1, result.stderr);
    assert.include(result.stderr, diagnostic);
    assert.lengthOf(result.stderr.split(diagnostic), 2, "Print the diagnostic exactly once");
    assert.lengthOf(result.stderr.trimEnd().split("\n"), 1, "No command output or stack trace on stderr");
    if (expectHeader) {
      assert.include(result.stdout, "[##] mct");
      assert.lengthOf(result.stdout.trimEnd().split("\n"), 1, "Only the existing startup header, not command output");
    } else {
      assert.equal(result.stdout, "", "Rejected commands must not emit results or startup success");
    }
    assert.isEmpty(snapshotTree(cwd), "Do not create reports or an output folder");
    // LocalEnvironment creates empty profile directories before checking options, but must not save state.
    assert.isEmpty([...snapshotTree(data).values()].filter((entry) => !entry.isFolder));
  }

  for (const mode of modes) {
    for (const failure of failures) {
      it(`rejects ${failure.name} before ${failure.command} executes (${mode.name})`, async () => {
        const result = await runCli([failure.command, ...failure.flags, ...mode.flags]);
        assertRejected(result, failure.diagnostic, mode.flags.length === 0);
      });
    }

    it(`still validates the invalid project with valid global options (${mode.name})`, async () => {
      const result = await runCli(["validate", "--experimental-ssl-port", "8443", ...mode.flags]);
      assert.equal(result.code, 4, result.stderr);
      assert.isTrue(fs.existsSync(path.join(cwd, "out")), "Validation must run and create its report folder");
      if (mode.flags.includes("--json")) {
        const doc = JSON.parse(result.stdout);
        assert.equal(doc.schemaVersion, "1.0.0");
        assert.equal(doc.command, "validate");
        assert.isAbove(doc.errors, 0);
        assert.isNotEmpty(doc.projects);
      } else {
        assert.include(result.stdout + result.stderr, "Error");
      }
    });

    it(`still prints version with a certificate and key (${mode.name})`, async () => {
      const result = await runCli([
        "version",
        "--experimental-ssl-cert",
        "cert.pem",
        "--experimental-ssl-key",
        "key.pem",
        ...mode.flags,
      ]);
      assert.equal(result.code, 0, result.stderr);
      if (mode.flags.includes("--json")) {
        const doc = JSON.parse(result.stdout);
        assert.equal(doc.schemaVersion, "1.0.0");
        assert.equal(doc.command, "version");
        assert.isNotEmpty(doc.version);
      } else if (mode.flags.includes("--quiet")) {
        assert.include(result.stdout, "(EXPERIMENTAL) SSL/HTTPS support enabled.");
        assert.notInclude(result.stdout, "Version:");
      } else {
        assert.include(result.stdout, "Version:");
      }
      assert.equal(result.stderr, "");
      assert.isEmpty(snapshotTree(cwd), "Version must not create an output folder");
    });
  }

  for (const failure of failures) {
    it(`rejects ${failure.name} before server startup`, async () => {
      const result = await runCli(["serve", "basicwebservices", "--port", "0", ...failure.flags]);
      assertRejected(result, failure.diagnostic);
    });

    it(`rejects ${failure.name} before an edit-in-place dry run`, async () => {
      const result = await runCli(["fix", "randomizealluids", "--dry-run", "--json", ...failure.flags]);
      assertRejected(result, failure.diagnostic);
    });
  }

  it("preserves the MCP input-alias rejection and protocol stdout", async () => {
    const result = await runCli(["mcp", "--input", cwd]);
    assertRejected(
      result,
      `--input ${JSON.stringify(cwd)} and -i/--input-folder ${JSON.stringify(project)} name different folders. Use one of them.`
    );
  });

  it("flushes a diagnostic larger than a pipe buffer to a slow stderr reader", async function () {
    // Windows limits the entire command line to 32 KiB, too small for this diagnostic.
    if (process.platform === "win32") {
      this.skip();
    }
    const value = "x".repeat(96 * 1024);
    const result = await runCli(["version", "--experimental-ssl-port", value, "--json", "--quiet"], true);
    assertRejected(result, `Invalid --experimental-ssl-port value: ${value}. Must be a valid port number.`);
  });

  for (const args of [["--help"], ["version", "--help"], ["help", "validate"]]) {
    it(`keeps ${args.join(" ")} available before global startup checks`, async () => {
      const result = await runCli([...args, "--experimental-ssl-port", "abc"]);
      assert.equal(result.code, 0, result.stderr);
      assert.include(result.stdout, "USAGE");
      assert.equal(result.stderr, "");
      assert.isEmpty(snapshotTree(cwd));
      assert.isEmpty(snapshotTree(data));
    });
  }
});
