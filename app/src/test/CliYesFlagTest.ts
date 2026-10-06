/**
 * CliYesFlagTest - Asserts that `mct create --yes` is fully non-interactive
 * and produces a complete project skeleton.
 *
 * The --yes flag is the contract for CI / scripted / Cloud-Agent usage.
 * Pro creators using `mct create --yes -o <dir> <name>` MUST get:
 *
 *   1. A process that completes (no hang waiting on stdin)
 *   2. A non-failure exit code
 *   3. behavior_packs/ AND resource_packs/ AND a top-level manifest.json
 *
 * If --yes silently regresses to interactive mode (e.g. someone removes the
 * "if (context.yes)" branch in CreateCommand.ts), the spawn here will hang
 * and Mocha's test timeout will fail the run.
 *
 * Non-interactive isn't consent: `cliYesFlagEulaConsent` asserts that --yes and
 * --json (which implies --yes) never accept the Minecraft EULA. Only
 * `eula --accept`, the environment variable, or an interactive yes does. Those
 * cases keep their saved state in a temporary MCTOOLS_DATA_DIR and never
 * inherit the EULA environment variable, so they can't accept the EULA in the
 * real user profile.
 */

import { assert } from "chai";
import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import "../app/Project";
import { collectLines, removeResultFolder, ensureResultFolder } from "./CommandLineTestHelpers";
import TestPaths from "./TestPaths";
import { EULA_ENV, cliEnv, createTestDataDir, setEnvironmentVariable } from "./TestDataDir";

const RESULT_NAME = "cliYesFlag";
const RESULT_DIR_REL = "./test/results/" + RESULT_NAME + "/";
const RESULT_DIR_ABS = path.join(TestPaths.testRoot, "results", RESULT_NAME);

describe("cliYesFlag", () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  before(function (done) {
    this.timeout(120000);

    removeResultFolder(RESULT_NAME);
    ensureResultFolder(RESULT_NAME);

    // We pass --yes plus all positional args so create has nothing to prompt for.
    // Args (positional): name, template, creator, description.
    const proc = spawn(
      "node",
      [
        "./toolbuild/jsn/cli/index.mjs",
        "create",
        "--yes",
        "-o",
        RESULT_DIR_REL,
        "testname",
        "Add-on Template",
        "TestCreator",
        "TestDescription",
      ],
      {
        // Detach stdin so a regression that prompts for input cannot block
        // forever waiting for a TTY.
        stdio: ["ignore", "pipe", "pipe"],
        // `create` needs the Minecraft EULA accepted.
        env: cliEnv({ acceptEula: true }),
      }
    );

    collectLines(proc.stdout, stdoutLines);
    collectLines(proc.stderr, stderrLines);

    // Hard upper bound: even if the test framework's default timeout fires,
    // we want a clean failure rather than a leaked node process.
    const killer = setTimeout(() => {
      try {
        proc.kill("SIGTERM");
      } catch {
        // ignore
      }
    }, 90000);

    proc.on("exit", (code) => {
      clearTimeout(killer);
      exitCode = code;
      done();
    });
  });

  it("should exit (i.e. did not hang on stdin)", () => {
    assert.notEqual(exitCode, null, "Process should have exited; --yes appears to be hanging on input");
  }).timeout(120000);

  it("should produce a non-empty output directory", () => {
    assert(fs.existsSync(RESULT_DIR_ABS), "Output directory should exist: " + RESULT_DIR_ABS);
    const entries = fs.readdirSync(RESULT_DIR_ABS);
    assert(
      entries.length > 0,
      "Output directory should not be empty after `create --yes`. stderr: " + stderrLines.join("\n")
    );
  }).timeout(120000);

  it("should contain behavior_packs/ and resource_packs/ folders somewhere in the output", () => {
    const found = { bp: false, rp: false, manifest: false };

    const walk = (dir: string, depth = 0) => {
      if (depth > 6) return;
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
          if (e.name === "behavior_packs") found.bp = true;
          if (e.name === "resource_packs") found.rp = true;
          walk(full, depth + 1);
        } else if (e.isFile() && e.name === "manifest.json") {
          found.manifest = true;
        }
      }
    };

    walk(RESULT_DIR_ABS);

    assert(found.bp, "Expected a 'behavior_packs/' folder somewhere in the created project");
    assert(found.rp, "Expected a 'resource_packs/' folder somewhere in the created project");
    assert(found.manifest, "Expected at least one manifest.json in the created project");
  }).timeout(120000);
});

interface ICliRun {
  exitCode: number | null;
  stdout: string[];
  stderr: string[];
}

/**
 * Runs the built CLI with its saved state in `dataDir`. The EULA environment variable is set only
 * when a case asks for it.
 */
async function runCliWithDataDir(
  args: string[],
  dataDir: string,
  eulaEnvironment?: "true" | "false"
): Promise<ICliRun> {
  const env = cliEnv({ dataDir, acceptEula: eulaEnvironment === "true" });
  setEnvironmentVariable(env, EULA_ENV, eulaEnvironment);
  env.HOME = dataDir;
  env.USERPROFILE = dataDir;

  // No stdin, so a command that tries to prompt fails instead of hanging.
  const proc = spawn(process.execPath, [path.resolve(TestPaths.appRoot, "toolbuild/jsn/cli/index.mjs"), ...args], {
    cwd: dataDir,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const run: ICliRun = { exitCode: null, stdout: [], stderr: [] };
  const killer = setTimeout(() => proc.kill("SIGKILL"), 60000);

  try {
    const [exitCode] = await Promise.all([
      new Promise<number | null>((resolve, reject) => {
        proc.on("error", reject);
        proc.on("close", resolve);
      }),
      collectLines(proc.stdout, run.stdout),
      collectLines(proc.stderr, run.stderr),
    ]);
    run.exitCode = exitCode;
  } finally {
    clearTimeout(killer);
  }

  return run;
}

/** The `eula --status --json` document. Scripts depend on its shape. */
function eulaStatus(accepted: boolean, acceptedViaEnvironment = false) {
  return { schemaVersion: "1.0.0", command: "eula", accepted, acceptedViaEnvironment };
}

function jsonDocuments(lines: string[]) {
  return lines.filter((line) => line.trim().startsWith("{")).map((line) => JSON.parse(line));
}

function outputOf(run: ICliRun) {
  return `\nstdout: ${run.stdout.join("\n")}\nstderr: ${run.stderr.join("\n")}`;
}

interface IEulaConsentCase {
  name: string;
  /** Arguments for the command under test. `dataDir` is the case's isolated data folder. */
  args: (dataDir: string) => string[];
  /** Set the EULA environment variable for the command under test. */
  eulaEnvironment?: "true" | "false";
  /** Run `eula --accept` first, to check that the command doesn't revoke an earlier acceptance. */
  acceptFirst?: boolean;
  expectExit: number;
  /** Substrings expected on stderr. */
  expectStderr?: string[];
  /** Human-readable acceptance notice, which must stay on stdout. */
  expectStdout?: string;
  /** The one JSON document expected on stdout. When omitted, stdout must have no JSON document. */
  expectJson?: object;
  /** Saved acceptance afterwards, read with `eula --status --json` without the environment variable. */
  expectAccepted: boolean;
}

const HOW_TO_ACCEPT = ["mct eula --accept", EULA_ENV + "=true"];

const eulaConsentCases: IEulaConsentCase[] = [
  {
    name: "eula --json",
    args: () => ["eula", "--json"],
    expectExit: 1,
    expectStderr: HOW_TO_ACCEPT,
    expectAccepted: false,
  },
  {
    name: "eula --yes",
    args: () => ["eula", "--yes"],
    expectExit: 1,
    expectStderr: HOW_TO_ACCEPT,
    expectAccepted: false,
  },
  ...["--json", "--yes"].map((flag) => ({
    name: `eula ${flag} with the environment variable false`,
    args: () => ["eula", flag],
    eulaEnvironment: "false" as const,
    expectExit: 1,
    expectStderr: HOW_TO_ACCEPT,
    expectAccepted: false,
  })),
  {
    name: "eula --json after an earlier acceptance",
    args: () => ["eula", "--json"],
    acceptFirst: true,
    expectExit: 1,
    expectStderr: HOW_TO_ACCEPT,
    expectAccepted: true,
  },
  {
    name: "eula --accept",
    args: () => ["eula", "--accept"],
    expectExit: 0,
    expectStdout: "EULA accepted.",
    expectAccepted: true,
  },
  {
    name: "eula --accept --json",
    args: () => ["eula", "--accept", "--json"],
    expectExit: 0,
    expectJson: eulaStatus(true),
    expectAccepted: true,
  },
  {
    name: "eula with the environment variable",
    args: () => ["eula"],
    eulaEnvironment: "true",
    expectExit: 0,
    expectStdout: "Minecraft End User License Agreement and Privacy Statement accepted via environment.",
    expectAccepted: true,
  },
  {
    name: "eula --json with the environment variable",
    args: () => ["eula", "--json"],
    eulaEnvironment: "true",
    expectExit: 0,
    expectJson: eulaStatus(true, true),
    expectAccepted: true,
  },
  {
    name: "eula --accept --json with the environment variable",
    args: () => ["eula", "--accept", "--json"],
    eulaEnvironment: "true",
    expectExit: 0,
    expectJson: eulaStatus(true, true),
    expectAccepted: true,
  },
  {
    name: "eula --accept --json with the environment variable false",
    args: () => ["eula", "--accept", "--json"],
    eulaEnvironment: "false",
    expectExit: 0,
    expectJson: eulaStatus(true),
    expectAccepted: true,
  },
  {
    name: "eula --status --json",
    args: () => ["eula", "--status", "--json"],
    expectExit: 0,
    expectJson: eulaStatus(false),
    expectAccepted: false,
  },
  {
    name: "eula --status --json with the environment variable",
    args: () => ["eula", "--status", "--json"],
    eulaEnvironment: "true",
    expectExit: 0,
    expectJson: eulaStatus(true, true),
    expectAccepted: false,
  },
  {
    name: "eula --status --json with the environment variable false",
    args: () => ["eula", "--status", "--json"],
    eulaEnvironment: "false",
    expectExit: 0,
    expectJson: eulaStatus(false),
    expectAccepted: false,
  },
  ...([undefined, "true", "false"] as const).map((eulaEnvironment) => ({
    name: `eula --status --accept --json with the environment variable ${eulaEnvironment ?? "unset"}`,
    args: () => ["eula", "--status", "--accept", "--json"],
    eulaEnvironment,
    expectExit: 0,
    expectJson: eulaStatus(eulaEnvironment === "true", eulaEnvironment === "true"),
    expectAccepted: false,
  })),
  {
    name: "create --yes",
    args: (dataDir) => [
      "create",
      "--yes",
      "-o",
      path.join(dataDir, "project"),
      "testname",
      "Add-on Template",
      "TestCreator",
      "TestDescription",
    ],
    expectExit: 1,
    expectStderr: ["EULA not accepted", ...HOW_TO_ACCEPT],
    expectAccepted: false,
  },
  {
    name: "add --yes",
    args: (dataDir) => ["add", "--yes", "allay", "buddy", "-o", path.join(dataDir, "project")],
    expectExit: 1,
    expectStderr: ["EULA not accepted", ...HOW_TO_ACCEPT],
    expectAccepted: false,
  },
];

describe("cliYesFlagEulaConsent", () => {
  for (const c of eulaConsentCases) {
    describe(c.name, () => {
      let dataDir = "";
      let run: ICliRun;
      let status: ICliRun;

      before(async function () {
        this.timeout(120000);

        dataDir = createTestDataDir("eula-consent");
        if (c.acceptFirst) {
          const accept = await runCliWithDataDir(["eula", "--accept"], dataDir);
          assert.equal(accept.exitCode, 0, "eula --accept failed." + outputOf(accept));
        }
        run = await runCliWithDataDir(c.args(dataDir), dataDir, c.eulaEnvironment);
        status = await runCliWithDataDir(["eula", "--status", "--json"], dataDir);
      });

      after(() => {
        if (dataDir) {
          fs.rmSync(dataDir, { recursive: true, force: true });
        }
      });

      it(`exits with ${c.expectExit}`, () => {
        assert.equal(run.exitCode, c.expectExit, outputOf(run));
      });

      if (c.expectStderr) {
        it("says how to accept the EULA", () => {
          for (const expected of c.expectStderr!) {
            assert.include(run.stderr.join("\n"), expected);
          }
        });
      }

      if (c.expectStdout) {
        it("keeps its acceptance notice on stdout, not stderr", () => {
          assert.include(run.stdout.join("\n"), c.expectStdout!);
          assert.notInclude(run.stderr.join("\n"), c.expectStdout!);
        });
      }

      it(c.expectJson ? "prints the expected JSON" : "prints no JSON document", () => {
        if (c.expectJson) {
          assert.deepEqual(JSON.parse(run.stdout.join("\n")), c.expectJson, outputOf(run));
        } else if (c.args(dataDir).includes("--json")) {
          assert.equal(run.stdout.join("\n"), "", outputOf(run));
        } else {
          assert.deepEqual(jsonDocuments(run.stdout), []);
        }
      });

      it(`leaves the EULA ${c.expectAccepted ? "accepted" : "not accepted"}`, () => {
        assert.equal(status.exitCode, 0, outputOf(status));
        assert.deepEqual(JSON.parse(status.stdout.join("\n")), eulaStatus(c.expectAccepted), outputOf(status));
      });
    });
  }
});
