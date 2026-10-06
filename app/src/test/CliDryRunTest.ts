/**
 * CliDryRunTest - Runs the built CLI with --dry-run for every command and checks that nothing changes.
 *
 * Driven by the effects table (cli/core/CommandEffects.ts):
 * - A command that doesn't honor --dry-run must exit with 1 and the rejection message. It must leave
 *   the project, the current folder (where -o defaults to ./out), the data folder, and HOME as they
 *   were, and not even create the data folder. These runs pass -i but not -o, the case where --dry-run
 *   used to make the project the output folder.
 * - A command that honors --dry-run must exit with 0 and print its "Dry run: would ..." line, leaving the
 *   same folders as they were. It runs once with -i, and once from inside the project without -i or -o.
 * - --dry-run must not change which projects a command works on. Without -i, fix works on the projects in
 *   -o, so fix runs from inside one project with -o naming another project, a folder of projects, or a
 *   folder that doesn't exist, with and without --dry-run, and both runs must name the same projects.
 *   Where a real run can't create -o because a file is in the way, the dry run must fail too.
 * - An explicit package that can't be opened must fail in both modes, without reading or changing a same-name
 *   saved project. Package preflight also covers commands that otherwise skip loading, and failed server startup.
 *
 * Every run gets its own temporary project, current folder, MCTOOLS_DATA_DIR, and HOME, a proxy that
 * refuses connections, and no browser, so even a regression can't touch the real profile or the network.
 * The EULA environment variable is set, so a command that saves EULA acceptance would show up as a change.
 * The in-process suites use the test process's temporary MCTOOLS_DATA_DIR (applyTestDataDir).
 *
 * The in-process suites build the command context, or find the folder the CLI's first project scan
 * looks in, the way the CLI does:
 * - --dry-run never makes the input folder the output folder: honored commands don't write there, so a
 *   run can't show it.
 * - Without -i, the first project scan looks in -o with or without --dry-run. A dry run doesn't create
 *   it, but fails where a real run can't, as when -o is a file.
 * - Under --dry-run, the context's storage and every project are read-only, because projects write
 *   through their own storage. A write that a command doesn't skip, such as fix randomizealluids run
 *   without its dry-run branch, fails with an error that names the dry run and changes nothing. That holds
 *   for creating and moving files and folders, and for projects loaded from a package, too.
 *
 * Runs toolbuild/jsn/cli/index.mjs, so build first: npm run jsncorebuild. DryRunGuardTest covers the
 * same rules without a build.
 */

import { expect } from "chai";
import "mocha";
import { spawn } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import JSZip from "jszip";
import Project from "../app/Project";
import ClUtils, { TaskType } from "../cli/ClUtils";
import { getAllCommands } from "../cli/commands/index";
import { fixCommand } from "../cli/commands/project/FixCommand";
import { CommandContextFactory, IRawOptions } from "../cli/core/CommandContextFactory";
import { DRY_RUN_READ_ONLY_REASON, formatDryRunNotSupportedError, isDryRunSupported } from "../cli/core/DryRunGuard";
import { ICommand } from "../cli/core/ICommand";
import { ICommandContext } from "../cli/core/ICommandContext";
import NodeFile from "../local/NodeFile";
import NodeStorage from "../local/NodeStorage";
import IFile from "../storage/IFile";
import IFolder from "../storage/IFolder";
import StorageUtilities from "../storage/StorageUtilities";
import ZipStorage from "../storage/ZipStorage";
import { applyTestDataDir, cliEnv } from "./TestDataDir";
import TestPaths, { ITestEnvironment } from "./TestPaths";

applyTestDataDir();

const CLI_PATH = path.join(TestPaths.appRoot, "toolbuild", "jsn", "cli", "index.mjs");
const SAMPLE_PROJECT = TestPaths.sampleContentPath("simple");

// Nothing listens on the discard port, so requests through this proxy fail at once.
const REFUSING_PROXY = "http://127.0.0.1:9";
const RUN_TIMEOUT_MS = 60000;
const PARALLEL_RUNS = 6;

/** Matches ANSI color codes, which aren't part of what a command prints. */
// eslint-disable-next-line no-control-regex
const ANSI_CODES = /\x1b\[[0-9;]*m/g;

/** One run's throwaway folders. All of them are under root, so one snapshot of root covers them. */
interface ISandbox {
  root: string;
  project: string;
  cwd: string;
  data: string;
  home: string;
}

interface IRunResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  /** Files and folders under the sandbox root that the run added, changed, or removed. */
  changes: string[];
}

/** How to run a command that honors --dry-run, and the line it prints instead of making changes. */
interface IHonoredRun {
  args: string[];
  prints: string;
  /** What it prints from inside the project without -i or -o, when that's different. */
  printsInProject?: string;
}

const HONORED_RUNS: Record<string, IHonoredRun> = {
  // randomizealluids rewrites every manifest's UUIDs, so this run fails if fix loses its dry-run branch. The other
  // fixes change files only when the sample's versions are out of date.
  fix: {
    args: ["fix", "randomizealluids"],
    prints: "Dry run: would apply fix 'randomizealluids' to project: project",
    // Without -i, fix works on the projects in -o, which defaults to ./out, with or without --dry-run.
    printsInProject: "Dry run: would apply fix 'randomizealluids' to project: out",
  },
  setup: { args: ["setup"], prints: "Dry run: would set up project at: " },
  exportaddon: { args: ["exportaddon"], prints: "Dry run: would export addon for project: project" },
  rendervanilla: { args: ["rendervanilla", "block", "stone"], prints: "Dry run: would render stone to ./output" },
};

/** Values for the command's required arguments that Commander accepts, so --dry-run is all that's left to reject. */
function getRequiredArgumentValues(command: ICommand): string[] {
  return (command.metadata.arguments ?? [])
    .filter((argument) => argument.required)
    .map((argument) => argument.choices?.[0] ?? "x");
}

function createSandbox(parent: string, name: string, dataFolderTemplate?: string): ISandbox {
  const root = path.join(parent, name);
  const sandbox: ISandbox = {
    root,
    project: path.join(root, "project"),
    cwd: path.join(root, "cwd"),
    data: path.join(root, "data"),
    home: path.join(root, "home"),
  };

  fs.cpSync(SAMPLE_PROJECT, sandbox.project, { recursive: true });
  fs.mkdirSync(sandbox.cwd);
  fs.mkdirSync(sandbox.home);

  if (dataFolderTemplate !== undefined) {
    fs.cpSync(dataFolderTemplate, sandbox.data, { recursive: true });
  }

  return sandbox;
}

function getSandboxEnvironment(sandbox: ISandbox): NodeJS.ProcessEnv {
  return {
    ...cliEnv({ dataDir: sandbox.data, acceptEula: true }),
    HOME: sandbox.home,
    USERPROFILE: sandbox.home,
    MCT_NO_OPEN_BROWSER: "1",
    HTTP_PROXY: REFUSING_PROXY,
    HTTPS_PROXY: REFUSING_PROXY,
    NO_PROXY: "localhost,127.0.0.1",
    NODE_USE_ENV_PROXY: "1",
    // Node 22 warns on stderr that its proxy support is experimental, which isn't output from mct.
    NODE_NO_WARNINGS: "1",
  };
}

/** Every file (with its contents) and folder under root; empty when root doesn't exist. */
function snapshot(root: string): Map<string, string> {
  const entries = new Map<string, string>();

  if (!fs.existsSync(root)) {
    return entries;
  }

  entries.set("./", "folder");

  const visit = (folder: string) => {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      const fullPath = path.join(folder, entry.name);
      const relativePath = path.relative(root, fullPath).split(path.sep).join("/");

      if (entry.isDirectory()) {
        entries.set(relativePath + "/", "folder");
        visit(fullPath);
      } else {
        entries.set(relativePath, fs.readFileSync(fullPath).toString("base64"));
      }
    }
  };

  visit(root);

  return entries;
}

function describeChanges(before: Map<string, string>, after: Map<string, string>): string[] {
  const changes: string[] = [];

  for (const [entryPath, content] of after) {
    if (!before.has(entryPath)) {
      changes.push("added " + entryPath);
    } else if (before.get(entryPath) !== content) {
      changes.push("changed " + entryPath);
    }
  }

  for (const entryPath of before.keys()) {
    if (!after.has(entryPath)) {
      changes.push("removed " + entryPath);
    }
  }

  return changes;
}

/** Writes a local, populated project as a package without downloading content. */
async function writeProjectPackage(filePath: string): Promise<void> {
  const zipStorage = new ZipStorage();

  await StorageUtilities.syncFolderTo(
    new NodeStorage(SAMPLE_PROJECT, "").rootFolder,
    zipStorage.rootFolder,
    true,
    true,
    false
  );
  await zipStorage.rootFolder.saveAll();
  fs.writeFileSync(filePath, await zipStorage.generateUint8ArrayAsync());
}

/** Runs `mct <args>` in the sandbox and reports what it printed and what it changed under the sandbox root. */
function runCli(sandbox: ISandbox, args: string[], cwd = sandbox.cwd): Promise<IRunResult> {
  const before = snapshot(sandbox.root);

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI_PATH, ...args], {
      cwd,
      env: getSandboxEnvironment(sandbox),
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));

    // A command that wrongly runs, such as serve, could otherwise keep going.
    const timer = setTimeout(() => child.kill("SIGKILL"), RUN_TIMEOUT_MS);

    child.on("error", reject);
    child.on("close", (exitCode) => {
      clearTimeout(timer);
      resolve({
        exitCode,
        stdout: stdout.replace(ANSI_CODES, ""),
        stderr: stderr.replace(ANSI_CODES, ""),
        changes: describeChanges(before, snapshot(sandbox.root)),
      });
    });
  });
}

/** The rejection's message, or undefined when the promise resolves. */
async function getRejection(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
    return undefined;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

async function runInParallel<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let next = 0;

  const worker = async () => {
    while (next < tasks.length) {
      const index = next++;
      results[index] = await tasks[index]();
    }
  };

  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));

  return results;
}

/** The project names that follow `prefix` in a run's output, sorted. */
function getNamedProjects(stdout: string, prefix: string): string[] {
  return stdout
    .split(/\r?\n/)
    .filter((line) => line.includes(prefix))
    .map((line) => line.substring(line.indexOf(prefix) + prefix.length).trim())
    .sort();
}

/** What the CLI's first project scan (cli/index.ts) says it works across, with each folder reduced to its name. */
function getScanMessages(stdout: string): string[] {
  return Array.from(stdout.matchAll(/Working across (.+?) at '(.+)'/g), (match) => {
    return `${match[1]} at ${path.basename(match[2])}`;
  });
}

describe("cliDryRun", function () {
  this.timeout(180000);

  const commands = getAllCommands();
  let tempRoot: string;

  before(() => {
    if (!fs.existsSync(CLI_PATH)) {
      throw new Error(`Build the CLI first (npm run jsncorebuild): ${CLI_PATH} doesn't exist.`);
    }

    tempRoot = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "mct-dry-run-")));
  });

  after(() => {
    if (tempRoot) {
      // Retries cover Windows briefly locking files that a CLI run just wrote or scanned.
      fs.rmSync(tempRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    }
  });

  describe("commands that don't honor --dry-run", () => {
    const rejected = commands.filter(({ metadata }) => !isDryRunSupported(metadata.name));
    const results = new Map<string, IRunResult>();

    before(async () => {
      const runs = await runInParallel(
        rejected.map((command) => () => {
          const sandbox = createSandbox(tempRoot, "rejected-" + command.metadata.name);
          const args = [
            command.metadata.name,
            ...getRequiredArgumentValues(command),
            "-i",
            sandbox.project,
            "--dry-run",
          ];

          return runCli(sandbox, args);
        }),
        PARALLEL_RUNS
      );

      rejected.forEach((command, index) => results.set(command.metadata.name, runs[index]));
    });

    for (const { metadata } of rejected) {
      it(`${metadata.name} exits with 1 and changes nothing`, () => {
        const result = results.get(metadata.name)!;
        const output = `stdout: ${result.stdout}\nstderr: ${result.stderr}`;

        expect(result.exitCode, output).to.equal(1);
        expect(result.stderr).to.include(formatDryRunNotSupportedError(`mct ${metadata.name}`));
        expect(result.stdout).to.equal("");
        expect(result.changes, output).to.deep.equal([]);
      });
    }
  });

  describe("commands that honor --dry-run", () => {
    // Every command creates the data folder's empty subfolders on its first run, --dry-run or not
    // (the createsDataFolder startup effect). Create them first, so the checks cover saved state.
    let dataFolderTemplate: string;

    before(async () => {
      const setup = createSandbox(tempRoot, "data-folder-template");
      const result = await runCli(setup, ["version", "-o", path.join(setup.root, "out")]);

      expect(result.exitCode, result.stderr).to.equal(0);
      expect(fs.existsSync(setup.data), "data folder").to.equal(true);
      dataFolderTemplate = setup.data;
    });

    it("has a run for every command that honors --dry-run", () => {
      const honored = commands.filter(({ metadata }) => isDryRunSupported(metadata.name));

      expect(Object.keys(HONORED_RUNS).sort()).to.deep.equal(honored.map(({ metadata }) => metadata.name).sort());
    });

    for (const [name, run] of Object.entries(HONORED_RUNS)) {
      it(`${name} prints what it would do with -i and changes nothing`, async () => {
        const sandbox = createSandbox(tempRoot, "honored-" + name, dataFolderTemplate);
        const result = await runCli(sandbox, [...run.args, "-i", sandbox.project, "--dry-run"]);

        expect(result.exitCode, result.stderr).to.equal(0);
        expect(result.stdout).to.include(run.prints);
        expect(result.stderr).to.equal("");
        expect(result.changes).to.deep.equal([]);
      });

      it(`${name} prints what it would do from inside the project, without -i or -o, and changes nothing`, async () => {
        const sandbox = createSandbox(tempRoot, "honored-in-project-" + name, dataFolderTemplate);
        const result = await runCli(sandbox, [...run.args, "--dry-run"], sandbox.project);

        expect(result.exitCode, result.stderr).to.equal(0);
        expect(result.stdout).to.include(run.printsInProject ?? run.prints);
        expect(result.stderr).to.equal("");
        expect(result.changes, "./out must not be created in the project").to.deep.equal([]);
      });
    }

    it("doesn't create an -o folder that doesn't exist", async () => {
      const sandbox = createSandbox(tempRoot, "honored-new-output-folder", dataFolderTemplate);
      const args = ["exportaddon", "-i", sandbox.project, "-o", path.join(sandbox.root, "out"), "--dry-run"];
      const result = await runCli(sandbox, args);

      expect(result.exitCode, result.stderr).to.equal(0);
      expect(result.stdout).to.include(HONORED_RUNS.exportaddon.prints);
      expect(result.changes).to.deep.equal([]);
    });

    // Without -i, fix works on the projects in -o, so its dry run must find the same ones, or it previews projects
    // that a real run leaves alone. Each case runs fix from inside one project, with -o naming another location,
    // once with --dry-run and once without, in separate sandboxes.
    const outputFolderCases: {
      name: string;
      fill: (outputFolder: string) => void;
      projects: string[];
      scans: string[];
    }[] = [
      {
        name: "another project",
        fill: (outputFolder) => fs.cpSync(SAMPLE_PROJECT, outputFolder, { recursive: true }),
        projects: ["target"],
        scans: [],
      },
      {
        name: "a folder of projects",
        fill: (outputFolder) => {
          fs.cpSync(SAMPLE_PROJECT, path.join(outputFolder, "first"), { recursive: true });
          fs.cpSync(SAMPLE_PROJECT, path.join(outputFolder, "second"), { recursive: true });
        },
        projects: ["first", "second"],
        scans: ["subfolders/packages at target"],
      },
      // A real run creates the folder and works on it as an empty project.
      { name: "a folder that doesn't exist", fill: () => {}, projects: ["target"], scans: [] },
    ];

    for (const { name, fill, projects, scans } of outputFolderCases) {
      it(`fix without -i works on the same projects with and without --dry-run when -o is ${name}`, async () => {
        const runFix = (dryRun: boolean) => {
          const sandboxName = `fix-output-${dryRun ? "dry-run" : "real-run"}-${name.replace(/\W+/g, "-")}`;
          const sandbox = createSandbox(tempRoot, sandboxName, dataFolderTemplate);
          const outputFolder = path.join(sandbox.root, "target");

          fill(outputFolder);

          const args = [...HONORED_RUNS.fix.args, "-o", outputFolder, ...(dryRun ? ["--dry-run"] : [])];

          return runCli(sandbox, args, sandbox.project);
        };

        const [dryRun, realRun] = await Promise.all([runFix(true), runFix(false)]);
        const dryRunPrefix = "Dry run: would apply fix 'randomizealluids' to project: ";
        const realRunPrefix = "Applying fix 'randomizealluids' to project: ";

        expect(dryRun.exitCode, dryRun.stderr).to.equal(0);
        expect(realRun.exitCode, realRun.stderr).to.equal(0);
        expect(getNamedProjects(realRun.stdout, realRunPrefix), "the real run's projects").to.deep.equal(projects);
        expect(getNamedProjects(dryRun.stdout, dryRunPrefix), "the dry run's projects").to.deep.equal(projects);
        expect(getScanMessages(realRun.stdout), "the real run's project scan").to.deep.equal(scans);
        expect(getScanMessages(dryRun.stdout), "the dry run's project scan").to.deep.equal(scans);
        expect(dryRun.changes, "the dry run's changes").to.deep.equal([]);
        expect(realRun.changes, "the real run's changes").to.not.deep.equal([]);
        expect(
          realRun.changes.filter((change) => !/^\w+ target\//.test(change)),
          "the real run changes only -o"
        ).to.deep.equal([]);
      });
    }

    // A dry run doesn't create -o, but where a real run can't create it because a file is in the way, the dry run
    // fails too, instead of going on with an empty project.
    const fileInTheWayCases: { name: string; args: (sandbox: ISandbox, file: string) => string[] }[] = [
      { name: "fix without -i, with -o a file", args: (sandbox, file) => [...HONORED_RUNS.fix.args, "-o", file] },
      {
        name: "fix without -i, with -o in a file",
        args: (sandbox, file) => [...HONORED_RUNS.fix.args, "-o", path.join(file, "out")],
      },
      {
        name: "exportaddon with -o a file",
        args: (sandbox, file) => ["exportaddon", "-i", sandbox.project, "-o", file],
      },
    ];

    for (const { name, args } of fileInTheWayCases) {
      it(`fails like a real run for ${name}`, async () => {
        const runCommand = (dryRun: boolean) => {
          const sandboxName = `file-in-the-way-${dryRun ? "dry-run" : "real-run"}-${name.replace(/\W+/g, "-")}`;
          const sandbox = createSandbox(tempRoot, sandboxName, dataFolderTemplate);
          const file = path.join(sandbox.root, "notes.txt");

          fs.writeFileSync(file, "not a folder");

          return runCli(sandbox, [...args(sandbox, file), ...(dryRun ? ["--dry-run"] : [])], sandbox.project);
        };

        const [dryRun, realRun] = await Promise.all([runCommand(true), runCommand(false)]);

        expect(realRun.exitCode, "the real run's exit code").to.equal(1);
        expect(dryRun.exitCode, "the dry run's exit code").to.equal(1);
        expect(dryRun.stdout + dryRun.stderr).to.match(
          /Can't create the folder '.+', because '.+notes\.txt' is a file\./
        );
        expect(dryRun.changes, "the dry run's changes").to.deep.equal([]);
        expect(realRun.changes, "the real run's changes").to.deep.equal([]);
      });
    }

    for (const dryRun of [false, true]) {
      it(`rejects an unreadable input package without using a same-name saved project, dryRun=${dryRun}`, async () => {
        const sandbox = createSandbox(tempRoot, `unreadable-package-${dryRun}`, dataFolderTemplate);
        const packagePath = path.join(sandbox.root, "input.mcaddon");
        const savedProject = path.join(sandbox.data, "cli", "projects", path.basename(packagePath));

        fs.writeFileSync(packagePath, "not a zip file");
        fs.cpSync(SAMPLE_PROJECT, savedProject, { recursive: true });
        const savedBefore = snapshot(savedProject);

        const result = await runCli(sandbox, [
          ...HONORED_RUNS.fix.args,
          "--if",
          packagePath,
          "--offline",
          ...(dryRun ? ["--dry-run"] : []),
        ]);
        const output = `exit: ${result.exitCode}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`;

        expect(describeChanges(savedBefore, snapshot(savedProject)), output).to.deep.equal([]);
        expect(result.changes, output).to.deep.equal([]);
        expect(result.exitCode, output).to.equal(1);
        expect(result.stderr, output).to.include(`Can't open package '${packagePath}'`);
        expect(result.stderr, output).to.include("Check that the file exists and is a readable, complete package.");
        expect(result.stderr, output).not.to.include(DRY_RUN_READ_ONLY_REASON);
        expect(result.stdout + result.stderr, output).not.to.match(/^\s+at /m);
        expect(result.stdout, output).not.to.include("would apply fix");
      });
    }

    for (const input of [
      { name: "empty --if", args: ["--if", ""] },
      { name: "empty --input-file=", args: ["--input-file="] },
      { name: "bare --if", args: ["--if"] },
      { name: "bare --input-file", args: ["--input-file"] },
    ]) {
      for (const dryRun of [false, true]) {
        it(`rejects ${input.name} before selecting a populated output project, dryRun=${dryRun}`, async () => {
          const sandbox = createSandbox(
            tempRoot,
            `invalid-input-option-${input.name.replace(/\W+/g, "-")}-${dryRun}`
          );
          fs.cpSync(SAMPLE_PROJECT, path.join(sandbox.cwd, "out"), { recursive: true });
          const result = await runCli(sandbox, [
            ...HONORED_RUNS.fix.args,
            "--offline",
            "--json",
            ...(dryRun ? ["--dry-run"] : []),
            ...input.args,
          ]);
          const output = `exit: ${result.exitCode}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`;

          expect(result.changes, output).to.deep.equal([]);
          expect(result.exitCode, output).to.equal(1);
          expect(result.stdout, output).to.equal("");
          expect(result.stderr, output).to.include("--if");
          expect(result.stderr, output).not.to.match(/TypeError|is not a function|^\s+at /m);
        });
      }
    }

    const invalidPackages: {
      name: string;
      fileName?: string;
      prepare: (filePath: string) => Promise<void> | void;
      cause: RegExp;
    }[] = [
      { name: "missing", prepare: () => {}, cause: /Could not find input package .+Check the path supplied with --if/ },
      // The existing upload-size guard rejects zero bytes before ZIP parsing.
      { name: "empty", prepare: (filePath) => fs.writeFileSync(filePath, ""), cause: /0 bytes/ },
      {
        name: "non-package",
        fileName: "input.txt",
        prepare: (filePath) => fs.writeFileSync(filePath, "{}"),
        cause: /The file could not be read as a package/,
      },
      {
        name: "truncated",
        prepare: async (filePath) => {
          await writeProjectPackage(filePath);
          const bytes = fs.readFileSync(filePath);
          fs.writeFileSync(filePath, bytes.subarray(0, bytes.length - 12));
        },
        cause: /End of data reached|Corrupted zip/,
      },
      {
        name: "directory",
        prepare: (filePath) => {
          fs.mkdirSync(filePath);
        },
        cause: /EISDIR|illegal operation on a directory|permission denied/i,
      },
    ];

    for (const { name, fileName, prepare, cause } of invalidPackages) {
      it(`reports the same input failure for ${name} input with and without --dry-run and --json`, async () => {
        const sandbox = createSandbox(tempRoot, `invalid-package-${name}`, dataFolderTemplate);
        const packagePath = path.join(sandbox.root, fileName ?? "input.mcaddon");
        const savedProject = path.join(sandbox.data, "cli", "projects", path.basename(packagePath));

        await prepare(packagePath);
        fs.cpSync(SAMPLE_PROJECT, savedProject, { recursive: true });
        const errors: string[] = [];

        for (const dryRun of [false, true]) {
          const result = await runCli(sandbox, [
            ...HONORED_RUNS.fix.args,
            "--if",
            packagePath,
            "--offline",
            "--json",
            ...(dryRun ? ["--dry-run"] : []),
          ]);
          const output = `exit: ${result.exitCode}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`;

          expect(result.exitCode, output).to.equal(1);
          expect(result.stdout, output).to.equal("");
          expect(result.stderr, output).to.include(packagePath);
          expect(result.stderr, output).to.match(cause);
          expect(result.stderr, output).not.to.include(DRY_RUN_READ_ONLY_REASON);
          expect(result.stderr, output).not.to.match(/^\s+at /m);
          expect(result.changes, output).to.deep.equal([]);
          // LocalLogger prefixes the diagnostic with a timestamp and severity.
          errors.push(result.stderr.substring(result.stderr.indexOf(name === "missing" ? "Could not find" : "Can't open")));
        }

        expect(errors[1], "both modes must report the same input failure").to.equal(errors[0]);
      });
    }

    for (const args of [["setup"], ["exportaddon"], ["validate"], ["info"], ["view"], ["edit"]]) {
      const name = args[0];
      const modes = isDryRunSupported(name) ? [false, true] : [false];

      for (const dryRun of modes) {
        it(`${name} fails before executing on an unreadable --if package, dryRun=${dryRun}`, async () => {
          const sandbox = createSandbox(tempRoot, `package-preflight-${name}-${dryRun}`, dataFolderTemplate);
          const packagePath = path.join(sandbox.root, "input.mcaddon");

          fs.writeFileSync(packagePath, "not a zip file");
          fs.cpSync(SAMPLE_PROJECT, path.join(sandbox.data, "cli", "projects", "input.mcaddon"), { recursive: true });

          const result = await runCli(sandbox, [
            ...args,
            "--if",
            packagePath,
            "-o",
            sandbox.cwd,
            "--offline",
            ...(dryRun ? ["--dry-run"] : []),
          ]);
          const output = `exit: ${result.exitCode}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`;

          expect(result.exitCode, output).to.equal(1);
          expect(result.stderr, output).to.include(`Can't open package '${packagePath}'`);
          expect(result.stderr, output).to.include("Check that the file exists and is a readable, complete package.");
          expect(result.stdout, output).not.to.include("Dry run: would");
          expect(result.changes, output).to.deep.equal([]);
        });
      }
    }

    for (const extension of ["zip", "mcaddon", "mcpack", "mcworld", "mctemplate", "mcproject"]) {
      it(`exports the actual .${extension} package and previews it without changing the input or saved project`, async () => {
        const sandbox = createSandbox(tempRoot, `valid-package-${extension}`, dataFolderTemplate);
        const packagePath = path.join(sandbox.root, `input.${extension}`);
        const exportedPath = path.join(sandbox.cwd, "exported.mcpack");
        const savedProject = path.join(sandbox.data, "cli", "projects", path.basename(packagePath));

        await writeProjectPackage(packagePath);
        fs.cpSync(SAMPLE_PROJECT, savedProject, { recursive: true });
        const packageBefore = fs.readFileSync(packagePath);
        const sourceZip = await JSZip.loadAsync(packageBefore);
        const sourceManifest = Object.values(sourceZip.files).find((file) => file.name.endsWith("/manifest.json"));
        expect(sourceManifest, "the input pack's manifest").not.to.equal(undefined);
        const sourceData = JSON.parse(await sourceManifest!.async("string"));
        fs.writeFileSync(
          path.join(savedProject, sourceManifest!.name),
          JSON.stringify({ ...sourceData, header: { ...sourceData.header, name: "Unrelated saved project" } })
        );
        const savedBefore = snapshot(savedProject);

        for (const dryRun of [true, false]) {
          const result = await runCli(sandbox, [
            "exportaddon",
            "--if",
            packagePath,
            "-o",
            sandbox.cwd,
            "--of",
            exportedPath,
            "--offline",
            ...(dryRun ? ["--dry-run"] : []),
          ]);
          const output = `exit: ${result.exitCode}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`;

          expect(result.exitCode, output).to.equal(0);
          expect(fs.readFileSync(packagePath), "input package").to.deep.equal(packageBefore);
          expect(snapshot(savedProject), "saved project").to.deep.equal(savedBefore);
          expect(result.changes, output).to.deep.equal(dryRun ? [] : ["added cwd/exported.mcpack"]);
          expect(fs.existsSync(exportedPath), output).to.equal(!dryRun);
        }

        const exported = await JSZip.loadAsync(fs.readFileSync(exportedPath));
        const manifests = exported.file(/(^|\/)manifest\.json$/);
        expect(manifests, "the exported pack's manifest").to.have.lengthOf(1);
        expect(JSON.parse(await manifests[0].async("string")).header.name).to.equal(sourceData.header.name);
      });
    }

    it("doesn't save passcode flags", async () => {
      const sandbox = createSandbox(tempRoot, "honored-passcode", dataFolderTemplate);
      const args = [...HONORED_RUNS.fix.args, "-i", sandbox.project, "--adminpc", "dryruntest", "--dry-run"];
      const result = await runCli(sandbox, args);

      expect(result.exitCode, result.stderr).to.equal(0);
      expect(result.stdout).to.include(HONORED_RUNS.fix.prints);
      expect(result.changes, "envprefs.json must not be written").to.deep.equal([]);
    });

    it("prints the same JSON as before with --json", async () => {
      const sandbox = createSandbox(tempRoot, "honored-json", dataFolderTemplate);
      const result = await runCli(sandbox, ["exportaddon", "-i", sandbox.project, "--json", "--dry-run"]);

      expect(result.exitCode, result.stderr).to.equal(0);
      expect(JSON.parse(result.stdout)).to.deep.equal({
        schemaVersion: "1.0.0",
        command: "exportaddon",
        project: "project",
        dryRun: true,
        success: true,
      });
      expect(result.changes).to.deep.equal([]);
    });
  });

  describe("the command context under --dry-run", () => {
    let env: ITestEnvironment;

    before(async () => {
      env = await TestPaths.createTestEnvironment();
    });

    for (const [index, inputFile] of ["", true, false, null, 0, {}].entries()) {
      it(`rejects invalid raw input-file value ${JSON.stringify(inputFile)} before creating output`, async () => {
        const sandbox = createSandbox(tempRoot, `raw-input-file-${index}`);
        const outputFolder = path.join(sandbox.root, "out");
        const before = snapshot(sandbox.root);
        const rejection = await getRejection(
          CommandContextFactory.create(env.creatorTools, env.localEnv, TaskType.fix, {
            inputFile,
            inputFolder: sandbox.project,
            outputFolder,
            quiet: true,
          })
        );
        expect(rejection).to.include("--if/--input-file");
        expect(fs.existsSync(outputFolder)).to.equal(false);
        expect(describeChanges(before, snapshot(sandbox.root))).to.deep.equal([]);
      });
    }

    // With --dry-run, -o stays the output folder, but it isn't created and nothing can be written through it.
    const cases: { name: string; taskType: TaskType; dryRun: boolean; outputFolderExists: boolean }[] = [
      { name: "exportaddon with --dry-run", taskType: TaskType.exportAddon, dryRun: true, outputFolderExists: false },
      {
        name: "exportaddon with --dry-run and an -o that exists",
        taskType: TaskType.exportAddon,
        dryRun: true,
        outputFolderExists: true,
      },
      {
        name: "fix with --dry-run, which normally edits in place",
        taskType: TaskType.fix,
        dryRun: true,
        outputFolderExists: false,
      },
      {
        name: "exportaddon without --dry-run",
        taskType: TaskType.exportAddon,
        dryRun: false,
        outputFolderExists: false,
      },
    ];

    for (const { name, taskType, dryRun, outputFolderExists } of cases) {
      it(`resolves -o for ${name}`, async () => {
        const sandbox = createSandbox(tempRoot, "context-" + name.replace(/\W+/g, "-"));
        const outputFolder = path.join(sandbox.root, "out");
        const options: IRawOptions = { inputFolder: sandbox.project, outputFolder, dryRun, quiet: true };

        if (outputFolderExists) {
          fs.mkdirSync(outputFolder);
          fs.writeFileSync(path.join(outputFolder, "earlier.txt"), "from an earlier run");
        }

        const context = await CommandContextFactory.create(env.creatorTools, env.localEnv, taskType, options);

        expect(context.outputFolder).to.equal(outputFolder);
        expect(fs.existsSync(outputFolder), "-o exists").to.equal(outputFolderExists || !dryRun);
        expect(context.outputStorage.readOnly, "output storage is read-only").to.equal(dryRun);
        expect(context.projects.map((project) => path.resolve(project.localFolderPath ?? ""))).to.deep.equal([
          sandbox.project,
        ]);

        if (dryRun) {
          expect(context.inputStorage.readOnly, "input storage is read-only").to.equal(true);
        }

        if (outputFolderExists) {
          expect(Object.keys(context.outputWorkFolder.files)).to.deep.equal(["earlier.txt"]);
        }

        if (dryRun && outputFolderExists) {
          // What the docsgenerate* commands do to -o before writing.
          const rejection = await getRejection(context.outputWorkFolder.deleteAllFolderContents());

          expect(rejection, "deleting -o's contents").to.include("Can't delete the contents of");
          expect(rejection, "deleting -o's contents").to.include(DRY_RUN_READ_ONLY_REASON);
          expect(fs.existsSync(path.join(outputFolder, "earlier.txt")), "earlier.txt is still there").to.equal(true);
        }
      });
    }
  });

  // Without -i, fix looks for projects in -o, and cli/index.ts's first project scan finds that folder with
  // ClUtils.getMainWorkFolder. A real run creates it. A dry run gets the same folder without creating it, and fails
  // where a real run can't create it.
  describe("the folder the first project scan looks in, without -i", () => {
    let root: string;

    before(() => {
      root = path.join(tempRoot, "main-work-folder");
      fs.mkdirSync(path.join(root, "existing"), { recursive: true });
      fs.writeFileSync(path.join(root, "notes.txt"), "not a folder");
    });

    for (const dryRun of [true, false]) {
      const mode = dryRun ? "with --dry-run" : "without --dry-run";

      it(`is -o, ${dryRun ? "not created" : "created"} when it doesn't exist, ${mode}`, async () => {
        const existing = path.join(root, "existing");
        const missing = path.join(root, dryRun ? "missing-dry-run" : "missing");

        const existingFolder = await ClUtils.getMainWorkFolder(TaskType.fix, undefined, existing, dryRun);
        const missingFolder = await ClUtils.getMainWorkFolder(TaskType.fix, undefined, missing, dryRun);

        expect(path.resolve(existingFolder.fullPath)).to.equal(existing);
        expect(path.resolve(missingFolder.fullPath)).to.equal(missing);
        expect(fs.existsSync(missing), "-o exists").to.equal(!dryRun);
      });

      it(`fails when a file is in the way, ${mode}`, async () => {
        const file = path.join(root, "notes.txt");

        for (const outputFolder of [file, path.join(file, "out")]) {
          const rejection = await getRejection(
            ClUtils.getMainWorkFolder(TaskType.fix, undefined, outputFolder, dryRun)
          );

          expect(rejection, outputFolder).to.not.equal(undefined);

          if (dryRun) {
            expect(rejection).to.equal(`Can't create the folder '${outputFolder}', because '${file}' is a file.`);
          }
        }
      });
    }
  });

  // Projects write through their own storage, not the context's, so --dry-run makes them read-only too. These
  // checks build the context in-process, the way the CLI does, and then try to write.
  describe("projects under --dry-run", () => {
    let env: ITestEnvironment;

    before(async () => {
      env = await TestPaths.createTestEnvironment();
    });

    /** The context `mct fix randomizealluids -i <project>` gets, with or without --dry-run. */
    function createFixContext(sandbox: ISandbox, dryRun: boolean): Promise<ICommandContext> {
      const options: IRawOptions = {
        inputFolder: sandbox.project,
        outputFolder: path.join(sandbox.root, "out"),
        dryRun,
        quiet: true,
      };

      return CommandContextFactory.create(env.creatorTools, env.localEnv, TaskType.fix, options, {
        subCommand: "randomizealluids",
      });
    }

    it("makes each project read-only, so saves fail with an error that names the dry run", async () => {
      const sandbox = createSandbox(tempRoot, "project-read-only");
      const before = snapshot(sandbox.root);
      const context = await createFixContext(sandbox, true);
      const [project] = context.projects;
      const projectFolder = await project.ensureProjectFolder();

      expect(project.readOnlySafety, "readOnlySafety").to.equal(true);
      expect(projectFolder.storage.readOnly, "the project folder's storage is read-only").to.equal(true);
      expect(await getRejection(project.save()), "Project.save()").to.equal(
        `Can't save project '${project.name}': ${DRY_RUN_READ_ONLY_REASON}`
      );

      await project.inferProjectItemsFromFiles();
      const manifest = project.getItemsCopy().find((item) => item.primaryFile?.name === "manifest.json")?.primaryFile;

      expect(manifest, "the behavior pack's manifest.json").to.not.equal(undefined);
      await manifest!.loadContent();
      manifest!.setContent((manifest!.content as string) + "\n");

      expect(await getRejection(manifest!.saveContent()), "saving a project file").to.equal(
        `Can't save '${manifest!.fullPath}': ${DRY_RUN_READ_ONLY_REASON}`
      );
      expect(describeChanges(before, snapshot(sandbox.root))).to.deep.equal([]);
    });

    it("keeps each project writable without --dry-run", async () => {
      const sandbox = createSandbox(tempRoot, "project-writable");
      const context = await createFixContext(sandbox, false);
      const [project] = context.projects;
      const projectFolder = await project.ensureProjectFolder();
      const file = projectFolder.ensureFile("written.txt");

      expect(project.readOnlySafety, "readOnlySafety").to.equal(false);
      expect(projectFolder.storage.readOnly, "the project folder's storage is read-only").to.equal(false);

      file.setContent("saved");
      await file.saveContent();

      expect(fs.readFileSync(path.join(sandbox.project, "written.txt"), "utf8")).to.equal("saved");
    });

    it("stops a command that writes under --dry-run with an error that names the dry run", async () => {
      // Runs fix randomizealluids as if it had lost its dry-run branch: its real write path, on the projects
      // that --dry-run made read-only. Without read-only projects, it rewrites the manifest's UUIDs.
      const sandbox = createSandbox(tempRoot, "project-write-under-dry-run");
      const before = snapshot(sandbox.root);
      const context = await createFixContext(sandbox, true);

      const rejection = await getRejection(fixCommand.execute({ ...context, dryRun: false }));

      expect(rejection, "fix should fail rather than skip the write").to.include(DRY_RUN_READ_ONLY_REASON);
      expect(describeChanges(before, snapshot(sandbox.root))).to.deep.equal([]);
    });

    /** The behavior pack's manifest.json, once the project's items are read from its files. */
    async function getManifest(context: ICommandContext): Promise<IFile> {
      const [project] = context.projects;

      await project.inferProjectItemsFromFiles();
      const manifest = project.getItemsCopy().find((item) => item.primaryFile?.name === "manifest.json")?.primaryFile;

      expect(manifest, "the behavior pack's manifest.json").to.not.equal(undefined);

      return manifest!;
    }

    /** Changes that plain read-only storage allows, because validation creates folders in read-only projects. */
    function getChangesBeyondSaves(
      projectFolder: IFolder,
      manifest: IFile
    ): { name: string; make: () => Promise<unknown> }[] {
      return [
        { name: "creating a folder", make: () => projectFolder.ensureFolder("created").ensureExists() },
        {
          name: "moving a file",
          make: () => manifest.moveTo(manifest.storageRelativePath.replace("manifest.json", "moved.json")),
        },
        { name: "moving a folder", make: () => manifest.parentFolder.moveTo("/behavior_packs/moved") },
        {
          name: "writing a file as a stream",
          make: () => (projectFolder.ensureFile("written.csv") as NodeFile).writeContent(["a,b"]),
        },
      ];
    }

    it("refuses creating, moving, and stream-writing files and folders in a project under --dry-run", async () => {
      const sandbox = createSandbox(tempRoot, "project-strict");
      const before = snapshot(sandbox.root);
      const context = await createFixContext(sandbox, true);
      const projectFolder = await context.projects[0].ensureProjectFolder();

      for (const { name, make } of getChangesBeyondSaves(projectFolder, await getManifest(context))) {
        expect(await getRejection(make()), name).to.include(DRY_RUN_READ_ONLY_REASON);
      }

      expect(describeChanges(before, snapshot(sandbox.root))).to.deep.equal([]);
    });

    it("still creates, moves, and stream-writes files and folders without --dry-run", async () => {
      const sandbox = createSandbox(tempRoot, "project-not-strict");
      const context = await createFixContext(sandbox, false);
      const projectFolder = await context.projects[0].ensureProjectFolder();

      for (const { name, make } of getChangesBeyondSaves(projectFolder, await getManifest(context))) {
        expect(await getRejection(make()), name).to.equal(undefined);
      }

      for (const created of ["created", "written.csv", path.join("behavior_packs", "moved")]) {
        expect(fs.existsSync(path.join(sandbox.project, created)), created).to.equal(true);
      }
    });

    it("still lets read-only storage without a reason create folders, as validation does", async () => {
      const sandbox = createSandbox(tempRoot, "read-only-without-reason");
      const storage = new NodeStorage(sandbox.project, "");

      storage.readOnly = true;
      await storage.rootFolder.ensureFolder("created").ensureExists();

      expect(fs.existsSync(path.join(sandbox.project, "created"))).to.equal(true);
    });

    // A dry run creates no folders, so a project's folder may not exist when the project loads it: a missing -o,
    // which a real run creates before it works on it, or a folder that's gone since it was detected. The project
    // uses that folder, empty and not created, never a saved project with the same name in the data folder's
    // projects storage. Each test saves samplecontent/simple there under the project's name, so a project that used
    // it would infer its items.
    describe("a project whose folder doesn't exist", () => {
      /** Points the projects storage at the sandbox, with samplecontent/simple saved there as `name`, until restored. */
      function addSavedProject(sandbox: ISandbox, name: string): { savedProject: string; restore: () => void } {
        const { creatorTools } = env;
        const projectsStorage = creatorTools.projectsStorage;
        const savedProjects = path.join(sandbox.root, "projects");
        const savedProject = path.join(savedProjects, name);

        fs.cpSync(SAMPLE_PROJECT, savedProject, { recursive: true });
        creatorTools.projectsStorage = new NodeStorage(savedProjects, "");

        return { savedProject, restore: () => (creatorTools.projectsStorage = projectsStorage) };
      }

      /** The project paths of the items the project infers from its folder. */
      async function getInferredItems(project: Project): Promise<string[]> {
        await project.inferProjectItemsFromFiles();

        return project.items.map((item) => item.projectPath ?? "").sort();
      }

      for (const dryRun of [true, false]) {
        const mode = dryRun ? "with --dry-run" : "without --dry-run";

        it(`binds fix without -i to a missing -o, never a saved project with the same name, ${mode}`, async () => {
          const sandbox = createSandbox(tempRoot, "missing-output-" + (dryRun ? "dry-run" : "real-run"));
          const outputFolder = path.join(sandbox.root, "missing", "target");
          const { savedProject, restore } = addSavedProject(sandbox, "target");
          const savedProjectBefore = snapshot(savedProject);

          try {
            const options: IRawOptions = { outputFolder, dryRun, quiet: true };
            const context = await CommandContextFactory.create(env.creatorTools, env.localEnv, TaskType.fix, options, {
              subCommand: "randomizealluids",
            });
            const [project] = context.projects;
            const projectFolder = await project.ensureProjectFolder();

            expect(context.projects.map(({ name }) => name)).to.deep.equal(["target"]);
            expect(path.resolve(projectFolder.fullPath), "the project folder").to.equal(outputFolder);
            expect(await getInferredItems(project), "the inferred items").to.deep.equal([]);
            expect(fs.existsSync(outputFolder), "-o exists").to.equal(!dryRun);
            expect(snapshot(savedProject), "the saved project").to.deep.equal(savedProjectBefore);
          } finally {
            restore();
          }
        });
      }

      it("binds a project to its folder after the folder is gone, under --dry-run, and changes nothing", async () => {
        // The folder was removed after detection, or its name doesn't survive NodeStorage's path handling.
        const sandbox = createSandbox(tempRoot, "project-folder-gone");
        const context = await createFixContext(sandbox, true);
        const { restore } = addSavedProject(sandbox, "project");

        try {
          fs.rmSync(sandbox.project, { recursive: true, force: true });
          const before = snapshot(sandbox.root);

          const [project] = context.projects;
          const projectFolder = await project.ensureProjectFolder();
          const inferredItems = await getInferredItems(project);
          const rejection = await getRejection(fixCommand.execute(context));

          expect(path.resolve(projectFolder.fullPath), "the project folder").to.equal(sandbox.project);
          expect(inferredItems, "the inferred items").to.deep.equal([]);
          expect(rejection, "the dry run").to.equal(undefined);
          expect(context.exitCode, "the dry run's exit code").to.equal(0);
          expect(describeChanges(before, snapshot(sandbox.root))).to.deep.equal([]);
        } finally {
          restore();
        }
      });
    });

    it("names the dry run when a project loaded from a package refuses a write", async () => {
      // --if loads the package into in-memory zip storage, which --dry-run makes read-only like a folder. Accessory
      // files beside the package (--afs, or <name>.data.json in a folder of packages) become project items too.
      const sandbox = createSandbox(tempRoot, "project-package");
      const packagePath = path.join(sandbox.root, "simple.zip");
      const accessoryPath = path.join(sandbox.root, "simple.data.json");
      const { creatorTools } = env;
      const localFileExists = creatorTools.localFileExists;

      await writeProjectPackage(packagePath);
      fs.writeFileSync(accessoryPath, JSON.stringify({ title: "Simple" }));

      // Match the local-file access callbacks installed by the CLI (ClUtils.getCreatorTools).
      creatorTools.localFileExists = ClUtils.localFileExists;

      try {
        const before = snapshot(sandbox.root);
        const options: IRawOptions = {
          inputFile: packagePath,
          additionalFiles: "simple.data.json",
          outputFolder: path.join(sandbox.root, "out"),
          dryRun: true,
          quiet: true,
        };
        const context = await CommandContextFactory.create(creatorTools, env.localEnv, TaskType.fix, options, {
          subCommand: "randomizealluids",
        });
        const [project] = context.projects;
        const projectFolder = await project.ensureProjectFolder();

        expect(projectFolder.storage, "the project folder's storage").to.be.instanceOf(ZipStorage);

        const accessory = project.getItemsCopy().find((item) => item.primaryFile?.name === "simple.data.json");

        expect(accessory?.primaryFile, "the accessory file's project item").to.not.equal(undefined);
        accessory!.primaryFile!.setContent(JSON.stringify({ title: "Changed" }));
        expect(await getRejection(accessory!.primaryFile!.saveContent()), "saving the accessory file").to.equal(
          `Can't save '${accessory!.primaryFile!.fullPath}': ${DRY_RUN_READ_ONLY_REASON}`
        );

        const rejection = await getRejection(fixCommand.execute({ ...context, dryRun: false }));

        expect(rejection, "fix should fail rather than skip the write").to.equal(
          `Can't save '${(await getManifest(context)).fullPath}': ${DRY_RUN_READ_ONLY_REASON}`
        );
        expect(describeChanges(before, snapshot(sandbox.root))).to.deep.equal([]);
      } finally {
        creatorTools.localFileExists = localFileExists;
      }
    });
  });
});
