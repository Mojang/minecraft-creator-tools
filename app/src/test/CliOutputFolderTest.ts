/**
 * CliOutputFolderTest - Checks which runs create the output folder (-o, default ./out).
 *
 * The CLI creates the output folder only when the run needs it (needsOutputFolder in cli/core/CommandEffects.ts):
 * for commands that write there, and for add, create, fix, view, and edit when, without -i or --if, they look for
 * projects there. Every other run leaves the current folder as it was. The expectations here are written out by
 * hand, not computed with needsOutputFolder(), so a wrong rule fails:
 * - In-process, it builds the command context for every registered command with -i and checks that -o exists
 *   exactly for the commands that write there, that add, create, fix, view, and edit still use -o without -i, and
 *   that with -o a file, a dry run fails only where the real run creates -o (and so fails too). This suite needs
 *   no build.
 * - With the built CLI, in an empty current folder, it runs every command that doesn't need -o (or records why
 *   it can't run here), plus `help` and an MCP initialize exchange, and checks that the folder stays empty and the
 *   header doesn't name an output folder. With -i, add, create, fix, view, and edit leave it empty too, while
 *   working on (or serving) the -i folder. validate and exportaddon must still write their files to ./out and name
 *   it in the header, and without -i, add, create, fix, and `world set` must still use ./out as they did before.
 *
 * Every CLI run gets its own temporary project, current folder, MCTOOLS_DATA_DIR, and HOME, a proxy that
 * refuses connections, and no browser, so even a regression can't touch the real profile or the network.
 * The in-process suite uses the test process's temporary MCTOOLS_DATA_DIR (applyTestDataDir).
 *
 * The CLI suites run toolbuild/jsn/cli/index.mjs, so build first: npm run jsncorebuild.
 */

import { expect } from "chai";
import "mocha";
import { spawn } from "child_process";
import * as fs from "fs";
import * as http from "http";
import * as net from "net";
import * as os from "os";
import * as path from "path";
import JSZip from "jszip";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import ClUtils, { TaskType } from "../cli/ClUtils";
import { getAllCommands, registerAllCommands } from "../cli/commands/index";
import { CommandContextFactory } from "../cli/core/CommandContextFactory";
import { getCommandEffects, needsOutputFolder } from "../cli/core/CommandEffects";
import { commandRegistry } from "../cli/core/CommandRegistry";
import { applyTestDataDir } from "./TestDataDir";
import TestPaths, { ITestEnvironment } from "./TestPaths";

applyTestDataDir();

const CLI_PATH = path.join(TestPaths.appRoot, "toolbuild", "jsn", "cli", "index.mjs");
const SAMPLE_PROJECT = TestPaths.sampleContentPath("simple");

// Nothing listens on the discard port, so requests through this proxy fail at once.
const REFUSING_PROXY = "http://127.0.0.1:9";
const RUN_TIMEOUT_MS = 60000;
const PARALLEL_RUNS = 6;

/** Stands for the sandbox's project folder in a run's arguments. */
const PROJECT = "<project>";

/** Stands for a free localhost port in a run's arguments. */
const FREE_PORT = "<port>";

/** Matches ANSI color codes, which aren't part of what a command prints. */
// eslint-disable-next-line no-control-regex
const ANSI_CODES = /\x1b\[[0-9;]*m/g;

/** The label the header line gives the output folder. */
const OUTPUT_FOLDER_LABEL = "out (-o):";

/**
 * Commands that don't need -o but read it themselves, so the header still names it: ensureworld uses -o to choose
 * where a world goes when -o is inside the input folder, and then creates that folder.
 */
const READ_OUTPUT_FOLDER = ["ensureworld"];

/**
 * The commands that need -o when the run names its input with -i, written out by hand: the commands that write
 * there. add, create, fix, view, and edit look for their projects in -o only without -i, so with -i they don't.
 */
const NEED_OUTPUT_FOLDER_WITH_INPUT = [
  "validate",
  "aggregatereports",
  "search",
  "profileValidation",
  "deploy",
  "exportaddon",
  "exportworld",
  "docsupdateformsource",
  "docsupdatemccat",
  "docsgenerateformjson",
  "docsgeneratemarkdown",
  "docsgeneratetypes",
  "docsgeneratejsonschema",
  "generateschemapackage",
  "world",
  "autotest",
];

/** The commands that, without -i, use -o as their project or look for projects there. */
const USE_OUTPUT_FOLDER_AS_PROJECT = [
  { name: "add", taskType: TaskType.add },
  { name: "create", taskType: TaskType.create },
  { name: "fix", taskType: TaskType.fix },
  { name: "view", taskType: TaskType.view },
  { name: "edit", taskType: TaskType.edit },
];

/** One run's throwaway folders, all under root. */
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
  /** Files and folders in the current folder that the run added, changed, or removed. */
  cwdChanges: string[];
  /** Files and folders in the project that the run added, changed, or removed. */
  projectChanges: string[];
}

/** How to run a command that doesn't need the output folder, and the exit code it ends with. */
interface IRun {
  args: string[];
  exitCode: number;
}

// A run for every command whose entry says it doesn't need the output folder, except those in NOT_RUN. The runs
// that exit with 1 point at files that don't exist, which checks that a failed run doesn't leave ./out behind.
const RUNS_WITHOUT_OUTPUT_FOLDER: Record<string, IRun> = {
  info: { args: ["info", "-i", PROJECT], exitCode: 0 },
  setup: { args: ["setup", "-i", PROJECT], exitCode: 0 },
  set: { args: ["set"], exitCode: 1 },
  serve: { args: ["serve", "--port", FREE_PORT, "--timeout", "1"], exitCode: 0 },
  passcodes: { args: ["passcodes"], exitCode: 0 },
  setserverprops: { args: ["setserverprops"], exitCode: 0 },
  minecrafteulaandprivacystatement: { args: ["eula", "--status"], exitCode: 0 },
  rendermodel: { args: ["rendermodel", "missing.geo.json", "-i", PROJECT], exitCode: 1 },
  renderbatch: { args: ["renderbatch", "missing.json", "-i", PROJECT], exitCode: 1 },
  renderstructure: { args: ["renderstructure", "missing", "-i", PROJECT], exitCode: 1 },
  buildstructure: { args: ["buildstructure", "missing.json"], exitCode: 1 },
  ensureworld: { args: ["ensureworld", "-i", PROJECT], exitCode: 0 },
  version: { args: ["version"], exitCode: 0 },
  skills: { args: ["skills"], exitCode: 0 },
};

/** Commands that don't need the output folder but don't run in RUNS_WITHOUT_OUTPUT_FOLDER, and why. */
const NOT_RUN: Record<string, string> = {
  mcp: "speaks MCP over stdio, so it gets its own initialize exchange",
  dedicatedserve: "downloads and starts Bedrock Dedicated Server on Windows and Linux",
  rendervanilla: "renders with headless Chromium",
};

/** Commands that write files to the output folder, and some of the files they write for the sample project. */
const OUTPUT_FOLDER_RUNS: { name: string; args: string[]; files: string[] }[] = [
  {
    name: "validate",
    args: ["validate", "-i", PROJECT],
    files: ["project.report.html", "project.csv", "project.mcr.json"],
  },
  { name: "exportaddon", args: ["exportaddon", "-i", PROJECT], files: ["project.mcpack"] },
];

function createSandbox(parent: string, name: string): ISandbox {
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

  return sandbox;
}

function getSandboxEnvironment(sandbox: ISandbox): Record<string, string> {
  const environment: Record<string, string> = {};

  for (const [name, value] of Object.entries(process.env)) {
    if (value !== undefined) {
      environment[name] = value;
    }
  }

  return {
    ...environment,
    HOME: sandbox.home,
    USERPROFILE: sandbox.home,
    MCTOOLS_DATA_DIR: sandbox.data,
    // create and add need the EULA accepted.
    MCTOOLS_I_ACCEPT_EULA_AT_MINECRAFTDOTNETSLASHEULA: "true",
    MCT_NO_OPEN_BROWSER: "1",
    HTTP_PROXY: REFUSING_PROXY,
    HTTPS_PROXY: REFUSING_PROXY,
    NO_PROXY: "localhost,127.0.0.1",
    NODE_USE_ENV_PROXY: "1",
    // Node 22 warns on stderr that its proxy support is experimental, which isn't output from mct.
    NODE_NO_WARNINGS: "1",
  };
}

/** Every file (with its contents) and folder under root. */
function snapshot(root: string): Map<string, string> {
  const entries = new Map<string, string>();

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

  return changes.sort();
}

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address !== null ? address.port : 0;

      server.close(() => resolve(port));
    });
  });
}

/** Runs `mct <args>` in the sandbox and reports what it printed and what it changed. */
async function runCli(sandbox: ISandbox, args: string[], cwd = sandbox.cwd): Promise<IRunResult> {
  const port = args.includes(FREE_PORT) ? String(await getFreePort()) : "";
  const resolvedArgs = args.map((arg) => (arg === PROJECT ? sandbox.project : arg === FREE_PORT ? port : arg));
  const cwdBefore = snapshot(sandbox.cwd);
  const projectBefore = snapshot(sandbox.project);

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI_PATH, ...resolvedArgs], {
      cwd,
      env: getSandboxEnvironment(sandbox),
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));

    // A server command that doesn't stop on its own could otherwise keep going.
    const timer = setTimeout(() => child.kill("SIGKILL"), RUN_TIMEOUT_MS);

    child.on("error", reject);
    child.on("close", (exitCode) => {
      clearTimeout(timer);
      resolve({
        exitCode,
        stdout: stdout.replace(ANSI_CODES, ""),
        stderr: stderr.replace(ANSI_CODES, ""),
        cwdChanges: describeChanges(cwdBefore, snapshot(sandbox.cwd)),
        projectChanges: describeChanges(projectBefore, snapshot(sandbox.project)),
      });
    });
  });
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

/** Where a content server that view or edit started listens, and the passcode it gives the browser. */
interface IContentServer {
  origin: string;
  passcode: string;
}

/** Matches the URL view and edit print for the browser: `http://localhost:<port>/…#tempPasscode=<passcode>`. */
const BROWSER_URL = /Opening browser to: (http:\/\/localhost:\d+)\/\S*#tempPasscode=(\S+)/;

/**
 * Runs a command that serves until it's stopped, such as `mct view`. Once it prints the URL it would open in a
 * browser (MCT_NO_OPEN_BROWSER keeps it from opening one), calls `whileServing`, then stops the process, killing it
 * if it doesn't exit. Reports what the run printed and changed, or why it didn't start.
 */
async function runServingCli(
  sandbox: ISandbox,
  args: string[],
  whileServing: (server: IContentServer) => Promise<void>
): Promise<IRunResult> {
  const resolvedArgs = args.map((arg) => (arg === PROJECT ? sandbox.project : arg));
  const cwdBefore = snapshot(sandbox.cwd);
  const projectBefore = snapshot(sandbox.project);

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI_PATH, ...resolvedArgs], {
      cwd: sandbox.cwd,
      env: getSandboxEnvironment(sandbox),
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let served = false;
    let failure: unknown;

    const stop = () => {
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 5000).unref();
    };

    child.stdout.on("data", (chunk) => {
      stdout += chunk;

      const match = BROWSER_URL.exec(stdout.replace(ANSI_CODES, ""));

      if (match && !served) {
        served = true;
        whileServing({ origin: match[1], passcode: match[2] })
          .catch((error) => (failure = error))
          .finally(stop);
      }
    });
    child.stderr.on("data", (chunk) => (stderr += chunk));

    // Bounds a run that never prints its URL.
    const timer = setTimeout(() => {
      failure = failure ?? new Error(`The server didn't start in ${RUN_TIMEOUT_MS} ms.`);
      child.kill("SIGKILL");
    }, RUN_TIMEOUT_MS);

    child.on("error", reject);
    child.on("close", (exitCode) => {
      clearTimeout(timer);

      const result: IRunResult = {
        exitCode,
        stdout: stdout.replace(ANSI_CODES, ""),
        stderr: stderr.replace(ANSI_CODES, ""),
        cwdChanges: describeChanges(cwdBefore, snapshot(sandbox.cwd)),
        projectChanges: describeChanges(projectBefore, snapshot(sandbox.project)),
      };

      if (failure !== undefined || !served) {
        const reason = failure instanceof Error ? failure.message : String(failure ?? "It exited without serving.");
        reject(new Error(`${reason}\n${describeRun(result)}`));
        return;
      }

      resolve(result);
    });
  });
}

/** Lists the folder a content server serves, the way the browser asks for it (/api/content/index.json). */
function listServedFolder(server: IContentServer): Promise<{ files: string[]; folders: string[] }> {
  return new Promise((resolve, reject) => {
    const request = http.get(`${server.origin}/api/content/index.json`, { headers: { mctpc: server.passcode } });

    request.on("response", (response) => {
      let body = "";

      response.setEncoding("utf8");
      response.on("data", (chunk) => (body += chunk));
      response.on("end", () => {
        if (response.statusCode !== 200) {
          reject(new Error(`GET /api/content/index.json returned ${response.statusCode}: ${body}`));
          return;
        }

        resolve(JSON.parse(body));
      });
    });
    request.on("error", reject);
    request.setTimeout(10000, () => request.destroy(new Error("GET /api/content/index.json timed out.")));
  });
}

/** The header line (`[##] mct … in (-i): …`) the CLI prints before running a command, if it printed one. */
function getHeaderLine(stdout: string): string | undefined {
  return stdout.split(/\r?\n/).find((line) => line.includes("in (-i):"));
}

function describeRun(result: IRunResult): string {
  return `exit code: ${result.exitCode}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`;
}

describe("cliOutputFolder", function () {
  this.timeout(180000);

  const commands = getAllCommands();
  let tempRoot: string;

  before(() => {
    tempRoot = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "mct-output-folder-")));
  });

  after(() => {
    if (tempRoot) {
      // Retries cover Windows briefly locking files that a CLI run just wrote or scanned.
      fs.rmSync(tempRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    }
  });

  describe("the command context", () => {
    let env: ITestEnvironment;

    before(async () => {
      // CommandContextFactory finds the command for a task type in the registry that the CLI fills at startup.
      if (commandRegistry.getAll().length === 0) {
        registerAllCommands();
      }

      env = await TestPaths.createTestEnvironment();
    });

    it("lists only registered commands in its hand-written expectations", () => {
      const registered = commands.map(({ metadata }) => metadata.name);
      const listed = [...NEED_OUTPUT_FOLDER_WITH_INPUT, ...USE_OUTPUT_FOLDER_AS_PROJECT.map(({ name }) => name)];

      expect(listed.filter((name) => !registered.includes(name))).to.deep.equal([]);
    });

    for (const { metadata } of commands) {
      const needed = NEED_OUTPUT_FOLDER_WITH_INPUT.includes(metadata.name);

      it(`${needed ? "creates" : "doesn't create"} -o for ${metadata.name} with -i`, async () => {
        const sandbox = createSandbox(tempRoot, "context-" + metadata.name);
        const outputFolder = path.join(sandbox.root, "out");
        const context = await CommandContextFactory.create(env.creatorTools, env.localEnv, metadata.taskType, {
          inputFolder: sandbox.project,
          outputFolder,
          quiet: true,
        });

        expect(context.outputFolder).to.equal(outputFolder);
        expect(fs.existsSync(outputFolder), "-o exists").to.equal(needed);
      });
    }

    for (const { name, taskType } of USE_OUTPUT_FOLDER_AS_PROJECT) {
      it(`creates -o for ${name} without -i, and finds its project there`, async () => {
        const sandbox = createSandbox(tempRoot, "context-without-input-" + name);
        const outputFolder = path.join(sandbox.root, "out");
        const context = await CommandContextFactory.create(env.creatorTools, env.localEnv, taskType, {
          outputFolder,
          quiet: true,
        });

        expect(fs.existsSync(outputFolder), "-o exists").to.equal(true);
        expect(context.projects.map((project) => path.resolve(project.localFolderPath ?? ""))).to.deep.equal([
          outputFolder,
        ]);
      });

      it(`doesn't create -o for ${name} with --if, which names the project`, async () => {
        const sandbox = createSandbox(tempRoot, "context-input-file-" + name);
        const outputFolder = path.join(sandbox.root, "out");
        const inputFile = path.join(sandbox.root, "addon.mcpack");

        fs.writeFileSync(inputFile, await new JSZip().generateAsync({ type: "nodebuffer" }));

        const { creatorTools } = env;
        const localFileExists = creatorTools.localFileExists;
        creatorTools.localFileExists = ClUtils.localFileExists;

        try {
          const context = await CommandContextFactory.create(creatorTools, env.localEnv, taskType, {
            inputFile,
            outputFolder,
            quiet: true,
          });

          expect(fs.existsSync(outputFolder), "-o exists").to.equal(false);
          expect(context.projects.map((project) => project.localFilePath)).to.deep.equal([inputFile]);
        } finally {
          creatorTools.localFileExists = localFileExists;
        }
      });
    }

    it("still reads an -o that exists for a command that doesn't need it", async () => {
      const sandbox = createSandbox(tempRoot, "context-existing-output-folder");
      const outputFolder = path.join(sandbox.root, "out");

      fs.mkdirSync(outputFolder);
      fs.writeFileSync(path.join(outputFolder, "earlier.txt"), "from an earlier run");

      const context = await CommandContextFactory.create(env.creatorTools, env.localEnv, TaskType.info, {
        inputFolder: sandbox.project,
        outputFolder,
        quiet: true,
      });

      expect(Object.keys(context.outputWorkFolder.files)).to.deep.equal(["earlier.txt"]);
    });

    // A dry run creates no folders, but it fails where a real run couldn't create -o, as when -o is a file. Only
    // runs that need -o create it, so a dry run of any other run goes on as its real run does. fix with -i doesn't
    // need -o, which it uses as its project only without -i.
    const fileOutputFolderCases: { name: string; taskType: TaskType; needed: boolean }[] = [
      { name: "setup", taskType: TaskType.setup, needed: false },
      { name: "fix", taskType: TaskType.fix, needed: false },
      { name: "exportaddon", taskType: TaskType.exportAddon, needed: true },
    ];

    // On Windows, NodeFolder.exists() is true for a file (fs.existsSync drops the trailing separator), so a real run
    // of any command fails listing an -o that's a file. A folder inside a file doesn't exist on any platform, so there
    // a real run of a command that doesn't need -o goes on, and a dry run that wrongly checks -o would fail.
    const fileOutputFolders: { shape: string; getOutputFolder: (file: string) => string }[] = [
      { shape: "a file", getOutputFolder: (file) => file },
      { shape: "a folder inside a file", getOutputFolder: (file) => path.join(file, "out") },
    ];

    for (const { name, taskType, needed } of fileOutputFolderCases) {
      for (const { shape, getOutputFolder } of fileOutputFolders) {
        it(`fails a dry run of ${name} -i with -o ${shape} exactly when the real run fails`, async () => {
          const createContext = async (dryRun: boolean) => {
            const sandboxName = `context-file-output-${name}-${shape.replace(/\W+/g, "-")}-${dryRun ? "dry" : "real"}`;
            const sandbox = createSandbox(tempRoot, sandboxName);
            const file = path.join(sandbox.root, "notes.txt");

            fs.writeFileSync(file, "not a folder");

            const before = snapshot(sandbox.root);
            let error: string | undefined;

            try {
              await CommandContextFactory.create(env.creatorTools, env.localEnv, taskType, {
                inputFolder: sandbox.project,
                outputFolder: getOutputFolder(file),
                dryRun,
                quiet: true,
              });
            } catch (e) {
              error = e instanceof Error ? e.message : String(e);
            }

            return { error, changes: describeChanges(before, snapshot(sandbox.root)) };
          };

          const dryRun = await createContext(true);
          const realRun = await createContext(false);

          expect(dryRun.error !== undefined, `the dry run fails (${dryRun.error}), as the real run does`).to.equal(
            realRun.error !== undefined
          );
          expect(dryRun.changes, "the dry run's changes").to.deep.equal([]);
          expect(realRun.changes, "the real run's changes").to.deep.equal([]);

          if (needed) {
            expect(dryRun.error).to.match(/Can't create the folder '.+', because '.+notes\.txt' is a file\./);
          } else if (shape === "a folder inside a file") {
            expect(realRun.error, "the real run leaves -o alone and goes on").to.equal(undefined);
          }
        });
      }
    }
  });

  describe("with the built CLI", () => {
    before(() => {
      if (!fs.existsSync(CLI_PATH)) {
        throw new Error(`Build the CLI first (npm run jsncorebuild): ${CLI_PATH} doesn't exist.`);
      }
    });

    describe("commands that don't need the output folder", () => {
      const sandboxes = new Map<string, ISandbox>();
      const results = new Map<string, IRunResult>();

      before(async () => {
        const names = Object.keys(RUNS_WITHOUT_OUTPUT_FOLDER);

        for (const name of names) {
          sandboxes.set(name, createSandbox(tempRoot, "run-" + name));
        }

        const runs = await runInParallel(
          names.map((name) => () => runCli(sandboxes.get(name)!, RUNS_WITHOUT_OUTPUT_FOLDER[name].args)),
          PARALLEL_RUNS
        );

        names.forEach((name, index) => results.set(name, runs[index]));
      });

      it("has a run for every command that doesn't need the output folder", () => {
        const notNeeded = commands.filter(({ metadata }) => !needsOutputFolder(metadata.name));

        expect([...Object.keys(RUNS_WITHOUT_OUTPUT_FOLDER), ...Object.keys(NOT_RUN)].sort()).to.deep.equal(
          notNeeded.map(({ metadata }) => metadata.name).sort()
        );
      });

      for (const [name, run] of Object.entries(RUNS_WITHOUT_OUTPUT_FOLDER)) {
        const reads = READ_OUTPUT_FOLDER.includes(name);

        it(`${name} leaves the current folder empty${reads ? "" : " and names no output folder"}`, () => {
          const result = results.get(name)!;

          expect(result.exitCode, describeRun(result)).to.equal(run.exitCode);
          expect(result.cwdChanges, describeRun(result)).to.deep.equal([]);

          if (reads) {
            expect(getHeaderLine(result.stdout), "the header names -o, which it reads").to.include(OUTPUT_FOLDER_LABEL);
          } else {
            expect(result.stdout, "the header names no output folder").to.not.include(OUTPUT_FOLDER_LABEL);
          }
        });
      }

      it("info names the input folder but no output folder in its header", () => {
        const result = results.get("info")!;
        const header = getHeaderLine(result.stdout);

        expect(header, describeRun(result)).to.not.equal(undefined);
        expect(header).to.include(`in (-i): ${path.resolve(sandboxes.get("info")!.project)}`);
        expect(header).to.not.include(OUTPUT_FOLDER_LABEL);
      });

      it("mcp leaves the current folder empty after an initialize exchange", async () => {
        const sandbox = createSandbox(tempRoot, "run-mcp");
        const before = snapshot(sandbox.cwd);
        const client = new Client({ name: "cli-output-folder-test", version: "1.0.0" });

        await client.connect(
          new StdioClientTransport({
            command: process.execPath,
            args: [CLI_PATH, "mcp"],
            cwd: sandbox.cwd,
            env: getSandboxEnvironment(sandbox),
            stderr: "ignore",
          })
        );

        try {
          // The server finished initializing: it offers tools, and lists them when asked.
          expect(client.getServerCapabilities()?.tools, "the server offers tools").to.not.equal(undefined);
          expect((await client.listTools()).tools, "the tools it lists").to.not.be.empty;
        } finally {
          await client.close();
        }

        expect(describeChanges(before, snapshot(sandbox.cwd))).to.deep.equal([]);
      });

      it("help leaves the current folder empty", async () => {
        const result = await runCli(createSandbox(tempRoot, "run-help"), ["help"]);

        expect(result.exitCode, describeRun(result)).to.equal(0);
        expect(result.cwdChanges, describeRun(result)).to.deep.equal([]);
      });

      it("info run from inside a project without -i leaves the project as it was", async () => {
        const sandbox = createSandbox(tempRoot, "run-info-in-project");
        const result = await runCli(sandbox, ["info"], sandbox.project);

        expect(result.exitCode, describeRun(result)).to.equal(0);
        expect(result.projectChanges, "./out must not be created in the project").to.deep.equal([]);
      });

      it("ensureworld run from inside a project names the -o it creates there", async () => {
        const sandbox = createSandbox(tempRoot, "run-ensureworld-in-project");
        const result = await runCli(sandbox, ["ensureworld"], sandbox.project);

        expect(result.exitCode, describeRun(result)).to.equal(0);
        expect(result.projectChanges, "ensureworld creates the world folder itself").to.deep.equal(["added out/"]);
        expect(getHeaderLine(result.stdout), describeRun(result)).to.match(/out \(-o\): .+[\\/]out$/);
      });
    });

    describe("commands that write to the output folder", () => {
      for (const { name, args, files } of OUTPUT_FOLDER_RUNS) {
        it(`${name} still writes to ./out by default, and names it in the header`, async () => {
          expect(getCommandEffects(name)?.writesOutputFolder.frequency).to.equal("always");

          const sandbox = createSandbox(tempRoot, "writes-" + name);
          const result = await runCli(sandbox, args);

          expect(result.exitCode, describeRun(result)).to.equal(0);
          expect(result.cwdChanges).to.include.members(["added out/", ...files.map((file) => "added out/" + file)]);
          expect(result.cwdChanges.filter((change) => !change.startsWith("added out/"))).to.deep.equal([]);
          expect(getHeaderLine(result.stdout), describeRun(result)).to.match(/out \(-o\): .+[\\/]out$/);
        });
      }
    });

    // With -i, these commands work on (or serve) the -i folder and never use -o, so they leave the current folder
    // as it was. Without -i, they use ./out (see the next group).
    describe("commands that use ./out as their project only without -i, run with -i", () => {
      it("fix works on the -i project", async () => {
        const sandbox = createSandbox(tempRoot, "input-fix");
        const result = await runCli(sandbox, ["fix", "randomizealluids", "-i", PROJECT]);

        expect(result.exitCode, describeRun(result)).to.equal(0);
        expect(result.stdout).to.include("Applying fix 'randomizealluids' to project: project");
        expect(result.projectChanges).to.include("changed behavior_packs/StarterTestsTutorial/manifest.json");
        expect(result.cwdChanges, describeRun(result)).to.deep.equal([]);
      });

      it("add lists types without creating ./out", async () => {
        const sandbox = createSandbox(tempRoot, "input-add");
        const result = await runCli(sandbox, ["add", "--list-types", "-i", PROJECT]);

        expect(result.exitCode, describeRun(result)).to.equal(0);
        expect(result.projectChanges).to.deep.equal([]);
        expect(result.cwdChanges, describeRun(result)).to.deep.equal([]);
      });

      it("create creates the project in the -i folder", async () => {
        const sandbox = createSandbox(tempRoot, "input-create");
        const target = path.join(sandbox.root, "target");

        fs.mkdirSync(target);

        const args = ["create", "myproject", "addonStarter", "creator", "description", "--yes", "-i", target];
        const result = await runCli(sandbox, args);

        expect(result.exitCode, describeRun(result)).to.equal(0);
        expect(result.stdout).to.include(`Project created at: ${target}`);
        expect(result.cwdChanges, describeRun(result)).to.deep.equal([]);
      });

      for (const name of ["view", "edit"]) {
        it(`${name} serves the -i folder`, async () => {
          const sandbox = createSandbox(tempRoot, "input-" + name);
          let served: { files: string[]; folders: string[] } | undefined;

          const result = await runServingCli(sandbox, [name, "-i", PROJECT], async (server) => {
            served = await listServedFolder(server);
          });

          const projectFolders = fs
            .readdirSync(sandbox.project, { withFileTypes: true })
            .filter((entry) => entry.isDirectory())
            .map((entry) => entry.name)
            .sort();

          expect(projectFolders, "the sample project's folders").to.not.be.empty;
          expect(served?.folders, "the folders it serves").to.deep.equal(projectFolders);
          expect(result.projectChanges).to.deep.equal([]);
          expect(result.cwdChanges, describeRun(result)).to.deep.equal([]);
        });
      }
    });

    describe("commands that use ./out as their project without -i", () => {
      it("fix still works on ./out", async () => {
        expect(needsOutputFolder("fix")).to.equal(true);

        const result = await runCli(createSandbox(tempRoot, "project-fix"), ["fix", "randomizealluids"]);

        expect(result.exitCode, describeRun(result)).to.equal(0);
        expect(result.stdout).to.include("Applying fix 'randomizealluids' to project: out");
        expect(result.cwdChanges).to.deep.equal(["added out/"]);
      });

      it("add still uses ./out, even to list types", async () => {
        expect(needsOutputFolder("add")).to.equal(true);

        const result = await runCli(createSandbox(tempRoot, "project-add"), ["add", "--list-types"]);

        expect(result.exitCode, describeRun(result)).to.equal(0);
        expect(result.cwdChanges).to.deep.equal(["added out/"]);
      });

      it("create still creates the project in ./out", async () => {
        expect(needsOutputFolder("create")).to.equal(true);

        const args = ["create", "myproject", "addonStarter", "creator", "description", "--yes"];
        const result = await runCli(createSandbox(tempRoot, "project-create"), args);

        expect(result.exitCode, describeRun(result)).to.equal(0);
        expect(result.stdout).to.match(/Project created at: .*out/);
        expect(result.cwdChanges).to.include("added out/");
        expect(result.cwdChanges.filter((change) => !change.startsWith("added out/"))).to.deep.equal([]);
      });

      it("world set, run from a project folder without -i or -o, still saves the world in ./out", async () => {
        expect(needsOutputFolder("world")).to.equal(true);

        const sandbox = createSandbox(tempRoot, "project-world-set");
        const result = await runCli(sandbox, ["world", "set", "--betaapis"], sandbox.project);

        expect(result.exitCode, describeRun(result)).to.equal(0);
        expect(result.projectChanges).to.include.members(["added out/", "added out/level.dat"]);
      });
    });
  });
});
