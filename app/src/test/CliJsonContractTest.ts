/**
 * CliJsonContractTest - Asserts the --json contract of the commands that write a single JSON
 * document: `version`, `info`, `validate`, `profileValidation`, `eula`, and single-project `deploy`.
 *
 * CI tooling and downstream scripts depend on three things:
 * - Shape: schemaVersion "1.0.0", the command name, and each command's own fields.
 * - Purity: stdout holds only that document, from the first byte, so `JSON.parse(stdout)` works.
 *   Log lines go to stderr or are dropped. That includes the worker threads that run every
 *   `validate`, one project at a time by default or in parallel with --threads, and the status
 *   lines of the profiler that `profileValidation` runs in them, which go to stderr.
 * - Completeness: all of the document arrives, even through a pipe and when the command fails.
 *   If the reader stops early, as `| head` does, the command still exits with its own code.
 *
 * The tests spawn the real built CLI (toolbuild/jsn/cli/index.mjs), read its stdout through a
 * pipe, and parse all of it. One `validate` case adds --verbose, which makes the worker log every
 * validation item, so it fails if worker logs reach stdout even where validation has nothing else
 * to log. Without --json, `profileValidation` keeps printing its status lines to stdout, and the
 * last tests here check that too. Deployment tests use copied projects and disposable destination
 * folders. A child-process preload records OS launches without starting Minecraft; the real
 * LocalTools.launchWorld and open package still run, so their output is captured too.
 */

import { assert } from "chai";
import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import "../app/Project";
import { ErrorCodes } from "../cli/core/ICommandContext";
import TestPaths from "./TestPaths";
import { applyTestDataDir, cliEnv, createTestDataDir, DATA_DIR_ENV } from "./TestDataDir";

// The spawned CLI keeps its saved state in a temporary folder, not the real profile.
applyTestDataDir();

const cliPath = path.resolve(TestPaths.appRoot, "toolbuild/jsn/cli/index.mjs");
const resultsRoot = path.resolve(TestPaths.testRoot, "results", "cliJsonContract");
const simpleProject = path.resolve(TestPaths.sampleContentPath("simple"));
const launchProject = path.join(resultsRoot, "simple");
const launchRecorder = path.resolve(TestPaths.testRoot, "scenarios", "cliJsonContract", "recordLaunch.cjs");
const worldName = "simple Test World";
const launchNotice = "Running minecraft://mode/?load=" + worldName;

/**
 * A copy of samplecontent/addon, whose altdiffs/ folder holds partial packs that fail validation.
 * The copy leaves out node_modules/ and build/, which exist only after `npm ci` and
 * `npx gulp package` run there, so the project is the same everywhere.
 */
const addonSource = path.resolve(TestPaths.sampleContentPath("addon"));
const projectWithErrors = path.join(resultsRoot, "addonWithErrors");

interface ICliRun {
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

/** Runs the built CLI in `cwd` (by default the current folder) and collects stdout and stderr exactly as written. */
function runCli(args: string[], cwd?: string, env = cliEnv(), nodeArgs: string[] = []): Promise<ICliRun> {
  return runNode([...nodeArgs, cliPath, ...args], cwd, env);
}

function runNode(args: string[], cwd?: string, env = cliEnv()): Promise<ICliRun> {
  if (cwd) {
    fs.mkdirSync(cwd, { recursive: true });
  }

  return new Promise((resolve, reject) => {
    const childEnv = { ...env, HOME: env[DATA_DIR_ENV], USERPROFILE: env[DATA_DIR_ENV], NO_COLOR: "1" };
    const proc = spawn(process.execPath, args, {
      cwd,
      env: childEnv,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      reject(new Error(`CLI timed out.\nstdout:\n${stdout}\nstderr:\n${stderr}`));
    }, 45000);

    proc.stdout.setEncoding("utf8");
    proc.stderr.setEncoding("utf8");
    proc.stdout.on("data", (chunk: string) => (stdout += chunk));
    proc.stderr.on("data", (chunk: string) => (stderr += chunk));
    proc.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    // "close" waits for both streams to end, so late output is not missed.
    proc.on("close", (exitCode) => {
      clearTimeout(timer);
      resolve({ exitCode, stdout, stderr });
    });
  });
}

function validateArgs(input: string, outputName: string, ...flags: string[]): string[] {
  return ["validate", "--json", "--isolated", ...flags, "-i", input, "-o", path.join(resultsRoot, outputName)];
}

interface IEarlyCloseRun {
  exitCode: number | null;
  /** The first chunk of stdout, which the reader got before it closed the pipe. */
  prefix: string;
  stderr: string;
  /** Whether the CLI was killed because it didn't exit within the time limit. */
  timedOut: boolean;
}

/**
 * Runs the built CLI and closes stdout as soon as the first chunk arrives, as `| head -c 100` does,
 * so the CLI's write of the rest of a document larger than a pipe buffer fails with EPIPE.
 */
function runCliClosingStdoutEarly(args: string[], timeLimitMs: number): Promise<IEarlyCloseRun> {
  return new Promise((resolve, reject) => {
    const proc = spawn("node", [cliPath, ...args]);
    let prefix = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill("SIGKILL");
    }, timeLimitMs);

    proc.stdout.setEncoding("utf8");
    proc.stdout.once("data", (chunk: string) => {
      prefix = chunk;
      proc.stdout.destroy();
    });
    proc.stderr.setEncoding("utf8");
    proc.stderr.on("data", (chunk: string) => (stderr += chunk));
    proc.on("error", reject);
    proc.on("close", (exitCode) => {
      clearTimeout(timer);
      resolve({ exitCode, prefix, stderr, timedOut });
    });
  });
}

/** A `profileValidation` run on the simple project in its own folder, because profiles land in <cwd>/debugoutput/. */
function profileRun(name: string, ...flags: string[]): { args: string[]; cwd: string } {
  const cwd = path.join(resultsRoot, name);
  return { args: ["profileValidation", ...flags, "-i", simpleProject, "-o", path.join(cwd, "out")], cwd };
}

/**
 * Asserts that `output` holds the profiler status line that starts with `prefix`, and that the file
 * it names exists. Each check uses the first line the profiler writes. Later lines, like the memory
 * summary, reach the main process in a separate batch, which can be lost when the worker stops.
 */
function assertProfilerStatus(output: string, prefix: string) {
  const line = output.split("\n").find((outputLine) => outputLine.startsWith(prefix));
  assert(line, `Expected a line starting with "${prefix}". Got:\n${output}`);

  const file = line!.slice(prefix.length).trim();
  assert(fs.existsSync(file), `The profile named in "${line}" should exist`);
}

function checkVersion(doc: any) {
  assert.equal(doc.command, "version", "command should be 'version'");
  assert(typeof doc.version === "string" && doc.version.length > 0, "version should be a non-empty string");
  assert(typeof doc.name === "string" && doc.name.length > 0, "name should be a non-empty string");
}

function checkProfileValidation(mode: string) {
  return (doc: any) => {
    assert.equal(doc.command, "profilevalidation", "command should be 'profilevalidation'");
    assert.equal(doc.mode, mode, `mode should be '${mode}'`);
    assert.equal(doc.success, true, "success should be true");
  };
}

function checkInfo(doc: any) {
  assert.equal(doc.command, "info", "command should be 'info'");
  assert(doc.counts && typeof doc.counts === "object", "counts should be an object");

  for (const field of ["errors", "warnings", "recommendations", "total"]) {
    assert.isNumber(doc.counts[field], `counts.${field} should be a number`);
  }

  assert.equal(
    doc.counts.total,
    doc.counts.errors + doc.counts.warnings + doc.counts.recommendations,
    "counts.total should equal errors + warnings + recommendations"
  );
}

function checkValidate(expectErrors: boolean) {
  return (doc: any) => {
    assert.equal(doc.command, "validate", "command should be 'validate'");
    assert(Array.isArray(doc.projects) && doc.projects.length > 0, "projects should list the validated project");

    for (const project of doc.projects) {
      assert.isString(project.name, "each project should have a name");
      assert.isArray(project.items, "each project should list its items");
    }

    for (const field of ["errors", "warnings", "recommendations"]) {
      assert.isNumber(doc[field], `${field} should be a number`);
    }

    if (expectErrors) {
      assert.isAbove(doc.errors, 0, "the project with errors should report errors");
    } else {
      assert.equal(doc.errors, 0, "the project should have no errors");
    }
  };
}

interface IJsonCase {
  name: string;
  args: string[];
  /** Folder to run the CLI in, if not the current folder. */
  cwd?: string;
  /** A fresh profile for cases that accept the EULA, or extra settings for the launch recorder. */
  env?: () => NodeJS.ProcessEnv;
  nodeArgs?: string[];
  /** Exit codes are part of the contract, so each case expects an exact one. */
  exitCode: number;
  check: (doc: any) => void;
  /** Checks output that --json sends to stderr instead of stdout. */
  checkStderr?: (stderr: string) => void;
  /** Whether stdout must be larger than a pipe buffer. See pipeBufferBytes. */
  exceedsPipeBuffer?: boolean;
}

function deployRun(name: string, ...flags: string[]) {
  const cwd = path.join(resultsRoot, name);
  const output = path.join(cwd, "minecraft");
  const launchFile = path.join(cwd, "launches.jsonl");
  return {
    args: ["deploy", "folder", "--test-world", "--isolated", "-i", launchProject, "-o", output, ...flags],
    cwd,
    output,
    launchFile,
    env: () => ({ ...cliEnv({ dataDir: createTestDataDir(name) }), MCT_TEST_LAUNCH_FILE: launchFile }),
    nodeArgs: ["--require", launchRecorder],
  };
}

/** The recorder captures the real open package's platform-specific invocation. */
function checkLaunch(launchFile: string, launched: boolean) {
  if (!launched) {
    assert.isFalse(fs.existsSync(launchFile), "Nothing should have tried to launch an external process");
    return;
  }

  const launches: { command: string; args: string[] }[] = fs
    .readFileSync(launchFile, "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  assert.lengthOf(launches, 1, "The world should be launched exactly once");
  const { args } = launches[0];
  const target = args[args.length - 1];
  const uri = "minecraft://mode/?load=" + worldName;
  if (args.includes("-EncodedCommand")) {
    assert.equal(Buffer.from(target, "base64").toString("utf16le"), `Start "${uri}"`);
  } else {
    assert.equal(target, uri);
  }
}

function deployJsonCase(name: string, ...flags: string[]): IJsonCase {
  const run = deployRun(name, "--json", ...flags);
  const launched = flags.includes("--launch");
  return {
    ...run,
    name: ["deploy", "--test-world", "--json", ...flags].join(" "),
    exitCode: ErrorCodes.SUCCESS,
    check: (doc) => {
      assert.deepEqual(doc, {
        schemaVersion: "1.0.0",
        command: "deploy",
        project: "simple",
        mode: "testWorld",
        success: true,
        outputPath: run.output + path.sep,
        worldName,
      });
      const worldsFolder = path.join(run.output, "minecraftWorlds");
      const worlds = fs.readdirSync(worldsFolder);
      assert.lengthOf(worlds, 1);
      assert.isTrue(fs.existsSync(path.join(worldsFolder, worlds[0], "level.dat")));
      checkLaunch(run.launchFile, launched);
    },
    checkStderr: (stderr) => {
      if (launched && !flags.includes("--quiet")) {
        assert.include(stderr, launchNotice + "\n");
      } else {
        assert.notInclude(stderr, "Running minecraft://");
      }
    },
  };
}

/**
 * A pipe holds 64 KiB on macOS and Linux. The CLI must not exit until stdout has drained, or a
 * piped document that's larger than this gets cut off. The project with errors writes more than
 * this, and its cases check that it still does, so they keep covering that.
 */
const pipeBufferBytes = 64 * 1024;

const cases: IJsonCase[] = [
  { name: "version --json", args: ["version", "--json"], exitCode: ErrorCodes.SUCCESS, check: checkVersion },
  // --debug is read before logging is set up, so this checks that its notice stays off stdout.
  {
    name: "--debug version --json",
    args: ["--debug", "version", "--json"],
    exitCode: ErrorCodes.SUCCESS,
    check: checkVersion,
  },
  {
    name: "eula --accept --json",
    args: ["eula", "--accept", "--json"],
    env: () => cliEnv({ dataDir: createTestDataDir("json-eula-accept") }),
    exitCode: ErrorCodes.SUCCESS,
    check: (doc) =>
      assert.deepEqual(doc, {
        schemaVersion: "1.0.0",
        command: "eula",
        accepted: true,
        acceptedViaEnvironment: false,
      }),
  },
  ...[[], ["--quiet"]].map(
    (flags): IJsonCase => ({
      name: ["eula", "--json", ...flags, "with environment consent"].join(" "),
      args: ["eula", "--json", ...flags],
      env: () => cliEnv({ dataDir: createTestDataDir("json-eula-environment"), acceptEula: true }),
      exitCode: ErrorCodes.SUCCESS,
      check: (doc) =>
        assert.deepEqual(doc, {
          schemaVersion: "1.0.0",
          command: "eula",
          accepted: true,
          acceptedViaEnvironment: true,
        }),
      checkStderr: (stderr) => {
        if (flags.includes("--quiet")) {
          assert.notInclude(stderr, "accepted via environment");
        } else {
          assert.include(stderr, "accepted via environment");
        }
      },
    })
  ),
  deployJsonCase("deployLaunch", "--launch"),
  deployJsonCase("deployLaunchQuiet", "--launch", "--quiet"),
  deployJsonCase("deployWithoutLaunch"),
  {
    name: "info --json",
    args: ["info", "--json", "--isolated", "--quiet", "-i", simpleProject],
    exitCode: ErrorCodes.SUCCESS,
    check: checkInfo,
  },
  {
    name: "validate --json",
    args: validateArgs(simpleProject, "simple"),
    exitCode: ErrorCodes.SUCCESS,
    check: checkValidate(false),
  },
  {
    name: "validate --json --threads 2",
    args: validateArgs(simpleProject, "simpleThreads", "--threads", "2"),
    exitCode: ErrorCodes.SUCCESS,
    check: checkValidate(false),
  },
  {
    name: "validate --json on a project with errors",
    args: validateArgs(projectWithErrors, "errors"),
    exitCode: ErrorCodes.VALIDATION_TESTFAIL,
    check: checkValidate(true),
    exceedsPipeBuffer: true,
  },
  // --warn-only reports the same problems but exits 0.
  {
    name: "validate --json --warn-only on a project with errors",
    args: validateArgs(projectWithErrors, "errorsWarnOnly", "--warn-only"),
    exitCode: ErrorCodes.SUCCESS,
    check: checkValidate(true),
    exceedsPipeBuffer: true,
  },
  {
    name: "validate --json --verbose --threads 2 on a project with errors",
    args: validateArgs(projectWithErrors, "errorsVerboseThreads", "--verbose", "--threads", "2"),
    exitCode: ErrorCodes.VALIDATION_TESTFAIL,
    check: checkValidate(true),
    exceedsPipeBuffer: true,
  },
  // The profiler runs in the validation worker and prints where it saved each profile.
  {
    name: "profileValidation --json --profile-mode cpu",
    ...profileRun("profileCpu", "--json", "--profile-mode", "cpu"),
    exitCode: ErrorCodes.SUCCESS,
    check: checkProfileValidation("cpu"),
    checkStderr: (stderr) => assertProfilerStatus(stderr, "CPU profile saved to "),
  },
  // The default memory mode also prints a summary, from separate write sites.
  {
    name: "profileValidation --json (default memory mode)",
    ...profileRun("profileMemory", "--json"),
    exitCode: ErrorCodes.SUCCESS,
    check: checkProfileValidation("memory"),
    checkStderr: (stderr) => assertProfilerStatus(stderr, "Heap sampling profile saved to "),
  },
];

describe("cliJsonContract", () => {
  before(function () {
    this.timeout(60000);

    fs.rmSync(resultsRoot, { recursive: true, force: true });
    fs.cpSync(addonSource, projectWithErrors, {
      recursive: true,
      filter: (source) => {
        const topLevelName = path.relative(addonSource, source).split(path.sep)[0];
        return topLevelName !== "node_modules" && topLevelName !== "build";
      },
    });
    fs.cpSync(simpleProject, launchProject, { recursive: true });
  });

  for (const c of cases) {
    describe(c.name, () => {
      let run: ICliRun;

      before(async function () {
        this.timeout(60000);
        run = await runCli(c.args, c.cwd, c.env?.(), c.nodeArgs);
      });

      it(`should exit with code ${c.exitCode}`, () => {
        assert.equal(run.exitCode, c.exitCode, "stderr: " + run.stderr);
      });

      it("should write only one JSON document to stdout", () => {
        let doc: any;

        try {
          doc = JSON.parse(run.stdout);
        } catch (e) {
          assert.fail(`JSON.parse(stdout) failed (${e}). stdout starts with:\n${run.stdout.slice(0, 500)}`);
        }

        assert.equal(doc.schemaVersion, "1.0.0", "schemaVersion should be '1.0.0'");
        c.check(doc);
      });

      if (c.checkStderr) {
        it("should write its diagnostics to stderr", () => {
          c.checkStderr!(run.stderr);
        });
      }

      if (c.exceedsPipeBuffer) {
        it("should write more to stdout than a pipe buffer holds", () => {
          assert.isAbove(Buffer.byteLength(run.stdout), pipeBufferBytes);
        });
      }
    });
  }

  const humanDeployment = deployRun("deployLaunchText", "--launch");
  const defaultLaunch = deployRun("defaultLaunchText");
  const humanLaunchCases = [
    {
      name: "deploy --test-world --launch without --json",
      ...humanDeployment,
      args: [...humanDeployment.nodeArgs, cliPath, ...humanDeployment.args],
      launchError: "Error executing deploy: Test launch failure",
    },
    {
      name: "LocalTools.launchWorld with the default launch logger",
      ...defaultLaunch,
      args: [
        ...defaultLaunch.nodeArgs,
        "--require",
        require.resolve("ts-node/register"),
        path.resolve(TestPaths.appRoot, "src/test/LocalToolsLaunchFixture.ts"),
        worldName,
      ],
      launchError: "Test launch failure",
    },
  ];
  for (const deployment of humanLaunchCases) {
    for (const rejectsLaunch of [false, true]) {
      describe(deployment.name + (rejectsLaunch ? " when launch rejects" : ""), () => {
        let run: ICliRun;

        before(async function () {
          this.timeout(60000);
          fs.rmSync(deployment.launchFile, { force: true });
          run = await runNode(deployment.args, deployment.cwd, {
            ...deployment.env(),
            MCT_TEST_LAUNCH_ERROR: rejectsLaunch ? "true" : undefined,
            TS_NODE_PROJECT: path.resolve(TestPaths.appRoot, "tsconfig.test.json"),
          });
        });

        it("keeps the launch notice on stdout and preserves the launch outcome", () => {
          assert.equal(run.exitCode, rejectsLaunch ? ErrorCodes.INIT_ERROR : ErrorCodes.SUCCESS, run.stderr);
          assert.include(run.stdout, launchNotice + "\n");
          assert.notInclude(run.stderr, "Running minecraft://");
          if (rejectsLaunch) {
            assert.include(run.stderr, deployment.launchError);
          }
          checkLaunch(deployment.launchFile, true);
        });
      });
    }
  }

  // A reader can stop before the document ends, as `mct validate --json | head -c 100` does. The
  // command still finishes and exits with its own code, without reporting an error writing stdout.
  describe("reader closes stdout early", () => {
    const earlyCases = [
      {
        name: "validate --json --warn-only on a project with errors",
        args: validateArgs(projectWithErrors, "earlyCloseWarnOnly", "--warn-only"),
        exitCode: ErrorCodes.SUCCESS,
      },
      {
        name: "validate --json on a project with errors",
        args: validateArgs(projectWithErrors, "earlyCloseErrors"),
        exitCode: ErrorCodes.VALIDATION_TESTFAIL,
      },
    ];

    for (const e of earlyCases) {
      describe(e.name, () => {
        let run: IEarlyCloseRun;

        before(async function () {
          this.timeout(60000);
          run = await runCliClosingStdoutEarly(e.args, 45000);
        });

        it(`should exit promptly with code ${e.exitCode}`, () => {
          assert.isFalse(run.timedOut, "The CLI should exit after its reader closes stdout");
          assert.equal(run.exitCode, e.exitCode, "stderr: " + run.stderr);
        });

        it("should not report an error writing to stdout", () => {
          assert.notMatch(run.stderr, /EPIPE|Uncaught exception/);
        });

        it("should start stdout with the JSON document", () => {
          assert.match(run.prefix, /^\{"schemaVersion":"1\.0\.0"/);
        });
      });
    }
  });

  // Without --json, profiler status is human-readable output, so it stays on stdout.
  describe("profileValidation without --json", () => {
    const humanCases = [
      {
        name: "--profile-mode cpu",
        folder: "profileCpuText",
        flags: ["--profile-mode", "cpu"],
        status: "CPU profile saved to ",
      },
      {
        name: "default memory mode",
        folder: "profileMemoryText",
        flags: [],
        status: "Heap sampling profile saved to ",
      },
    ];

    for (const h of humanCases) {
      describe(h.name, () => {
        let run: ICliRun;

        before(async function () {
          this.timeout(60000);
          const { args, cwd } = profileRun(h.folder, ...h.flags);
          run = await runCli(args, cwd);
        });

        it(`should exit with code ${ErrorCodes.SUCCESS}`, () => {
          assert.equal(run.exitCode, ErrorCodes.SUCCESS, "stderr: " + run.stderr);
        });

        it("should write profiler status to stdout, not stderr", () => {
          assertProfilerStatus(run.stdout, h.status);
          assert.notInclude(run.stderr, h.status);
          assert.notInclude(run.stderr, "Memory profile summary");
        });
      });
    }
  });
});
