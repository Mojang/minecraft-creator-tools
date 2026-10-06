/**
 * CliPromptWithoutTerminalTest - `mct` asks questions only when stdin and stdout are both terminals.
 *
 * Without a terminal (in CI, in a pipe, or under an AI agent), a prompt used to write cursor-control
 * codes into the captured output, take piped input as its answer (`echo y | mct eula` accepted the
 * EULA), or wait forever on a pipe that stayed open. Each prompt case reaches one of the prompts in
 * `create`, `add`, or `eula`, and runs the built CLI (toolbuild/jsn/cli/index.mjs) twice: with stdin
 * closed, like `</dev/null`, and with stdin piped, an answer written, and the pipe left open. stdout
 * and stderr are pipes both times. The command must exit within a few seconds with INIT_ERROR, write
 * no escape sequences, name the input it couldn't ask for and how to supply it, and create nothing.
 *
 * The success cases check that commands given every argument, or --yes, still work without a
 * terminal, under the same two stdin modes.
 *
 * Every run gets its own MCTOOLS_DATA_DIR (createTestDataDir) and working folder, and the EULA
 * environment variable is set only for the runs that ask for it (cliEnv), so no run reads or changes
 * the real Creator Tools profile. The test-only names testerName and testerCreatorName skip the
 * EULA check in `create`, and testerName does in `add`, without accepting it.
 */

import { assert } from "chai";
import { spawn } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { ErrorCodes } from "../cli/core/ICommandContext";
import { streamHasColors } from "../cli/core/Logger";
import { getPromptBlocker, PromptUnavailableError } from "../cli/core/Prompt";
import { applyTestDataDir, cliEnv, createTestDataDir, EULA_ENV, setEnvironmentVariable } from "./TestDataDir";
import { applyTestVersionPin } from "./TestVersionPin";

// This suite spawns the CLI without CommandLineTestHelpers, so it applies the test data folder itself.
applyTestDataDir();
// Spawned CLIs inherit the pinned Minecraft version, so they don't look it up online.
applyTestVersionPin();

const cliPath = path.resolve("toolbuild/jsn/cli/index.mjs");

const ESC = "\u001b";

/** These turn color on even in a pipe, by design, so a run must not inherit them. */
const FORCE_COLOR_ENV = ["FORCE_COLOR", "CLICOLOR_FORCE"];

/** How long a run that can't prompt may take. Startup alone takes well under a second. */
const PROMPT_TIME_LIMIT_MS = 10000;

/** How long a run that creates a project or adds content may take. */
const SUCCESS_TIME_LIMIT_MS = 90000;

type StdinMode = "closed" | "piped";

const STDIN_MODES: { mode: StdinMode; description: string }[] = [
  { mode: "closed", description: "stdin closed" },
  { mode: "piped", description: "stdin piped and left open" },
];

interface ICliRun {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  /** Whether the CLI was killed because it didn't exit within the time limit. */
  timedOut: boolean;
}

/** The folders for one run: an empty working folder holding an empty `project` folder, and a data folder. */
interface IRunFolders {
  work: string;
  dataDir: string;
}

/**
 * The environment for one run: cliEnv() with the run's own data folder, minus the variables that
 * force color.
 */
function runEnvironment(dataDir: string, acceptEula: boolean): NodeJS.ProcessEnv {
  const env = cliEnv({ dataDir, acceptEula });

  for (const name of FORCE_COLOR_ENV) {
    setEnvironmentVariable(env, name, undefined);
  }

  return env;
}

/**
 * Runs the built CLI in `folders.work`, with stdout and stderr piped. With stdin "piped", it writes
 * "y" and a newline, an answer every prompt here accepts, and leaves the pipe open, so a CLI that
 * prompted would either take that answer or wait. Kills the CLI after `timeLimitMs`.
 */
function runCli(
  args: string[],
  folders: IRunFolders,
  stdin: StdinMode,
  timeLimitMs: number,
  acceptEula = false
): Promise<ICliRun> {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, [cliPath, ...args], {
      cwd: folders.work,
      env: runEnvironment(folders.dataDir, acceptEula),
      stdio: [stdin === "closed" ? "ignore" : "pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill("SIGKILL");
    }, timeLimitMs);

    if (proc.stdin) {
      // The CLI can exit before it reads anything, which makes the write fail.
      proc.stdin.on("error", () => {});
      proc.stdin.write("y\n");
    }

    if (!proc.stdout || !proc.stderr) {
      reject(new Error("The CLI's stdout and stderr should be pipes."));
      return;
    }

    proc.stdout.setEncoding("utf8");
    proc.stderr.setEncoding("utf8");
    proc.stdout.on("data", (chunk: string) => (stdout += chunk));
    proc.stderr.on("data", (chunk: string) => (stderr += chunk));
    proc.on("error", reject);
    // "close" waits for stdout and stderr to end, so late output is not missed.
    proc.on("close", (exitCode) => {
      clearTimeout(timer);
      proc.stdin?.destroy();
      resolve({ exitCode, stdout, stderr, timedOut });
    });
  });
}

function makeRunFolders(root: string): IRunFolders {
  const work = fs.mkdtempSync(path.join(root, "work-"));
  fs.mkdirSync(path.join(work, "project"));

  return { work, dataDir: createTestDataDir("prompt-without-terminal") };
}

/** Paths of the files under `folder`, relative to it. */
function filesUnder(folder: string, relativeFolder = ""): string[] {
  const files: string[] = [];

  for (const entry of fs.readdirSync(path.join(folder, relativeFolder), { withFileTypes: true })) {
    const relativePath = path.join(relativeFolder, entry.name);

    if (entry.isDirectory()) {
      files.push(...filesUnder(folder, relativePath));
    } else {
      files.push(relativePath);
    }
  }

  return files;
}

/** Whether the EULA is accepted in `dataDir`, as `eula --status --json` reports without the environment variable. */
async function eulaAccepted(dataDir: string, root: string): Promise<boolean> {
  const status = await runCli(
    ["eula", "--status", "--json"],
    { work: fs.mkdtempSync(path.join(root, "status-")), dataDir },
    "closed",
    SUCCESS_TIME_LIMIT_MS
  );
  assert.equal(status.exitCode, 0, "eula --status --json failed." + outputOf(status));

  return JSON.parse(status.stdout).accepted;
}

function outputOf(run: ICliRun) {
  return `\nstdout:\n${run.stdout}\nstderr:\n${run.stderr}`;
}

describe("getPromptBlocker", () => {
  // Node leaves isTTY undefined for pipes and files.
  const cases: { stdin?: boolean; stdout?: boolean; expected: string | undefined }[] = [
    { stdin: true, stdout: true, expected: undefined },
    { stdin: undefined, stdout: true, expected: "stdin isn't a terminal" },
    { stdin: false, stdout: true, expected: "stdin isn't a terminal" },
    { stdin: true, stdout: undefined, expected: "stdout isn't a terminal" },
    { stdin: undefined, stdout: undefined, expected: "stdin and stdout aren't terminals" },
  ];

  for (const c of cases) {
    it(`stdin isTTY ${c.stdin}, stdout isTTY ${c.stdout}: ${c.expected ?? "can prompt"}`, () => {
      assert.equal(getPromptBlocker({ isTTY: c.stdin }, { isTTY: c.stdout }), c.expected);
    });
  }
});

describe("PromptUnavailableError", () => {
  it("names what it couldn't ask, why, and what to do instead", () => {
    const error = new PromptUnavailableError(
      { asking: "for the project name", instead: "Pass it as an argument." },
      "stdin isn't a terminal"
    );

    assert.equal(
      error.message,
      "Can't ask for the project name, because stdin isn't a terminal.\nPass it as an argument."
    );
  });

  it("escapes control characters, so text it quotes can't write terminal sequences", () => {
    const error = new PromptUnavailableError(
      { asking: "which template to use", instead: `'x${ESC}[2J' isn't a template.` },
      "stdin isn't a terminal"
    );

    assert.notInclude(error.message, ESC);
    assert.include(error.message, "'x\\u001b[2J' isn't a template.");
  });
});

describe("streamHasColors", () => {
  const colorTerminal = { isTTY: true, hasColors: () => true };
  // A terminal whose TERM is "dumb", for example.
  const plainTerminal = { isTTY: true, hasColors: () => false };
  const pipe = {};

  const cases: { name: string; stream: object; env: NodeJS.ProcessEnv; expected: boolean }[] = [
    { name: "a color terminal", stream: colorTerminal, env: {}, expected: true },
    { name: "a terminal without color support", stream: plainTerminal, env: {}, expected: false },
    { name: "a pipe", stream: pipe, env: {}, expected: false },
    { name: "a color terminal with NO_COLOR", stream: colorTerminal, env: { NO_COLOR: "1" }, expected: false },
    { name: "a color terminal with FORCE_COLOR=0", stream: colorTerminal, env: { FORCE_COLOR: "0" }, expected: false },
    {
      name: "a color terminal with FORCE_COLOR=false",
      stream: colorTerminal,
      env: { FORCE_COLOR: "false" },
      expected: false,
    },
    { name: "a pipe with FORCE_COLOR", stream: pipe, env: { FORCE_COLOR: "1" }, expected: true },
    { name: "a pipe with CLICOLOR_FORCE", stream: pipe, env: { CLICOLOR_FORCE: "1" }, expected: true },
  ];

  for (const c of cases) {
    it(`${c.expected ? "colors" : "doesn't color"} ${c.name}`, () => {
      assert.equal(streamHasColors(c.stream, c.env), c.expected);
    });
  }
});

interface IPromptCase {
  name: string;
  args: string[];
  /** Set the EULA environment variable, for runs that would otherwise stop at the EULA check before any prompt. */
  acceptEula?: boolean;
  /** Text stderr must include: the input mct couldn't ask for, and how to supply it. */
  expectStderr: string[];
  /** Check that the EULA is still not accepted afterwards. */
  expectEulaNotAccepted?: boolean;
}

const CREATE_INSTEAD = "mct create <name> <template> [creator] [description] --yes";
const ADD_INSTEAD = "mct add <template-id> <name>";

/** One case per prompt site that a command line can reach. */
const promptCases: IPromptCase[] = [
  {
    name: "create",
    args: ["create"],
    acceptEula: true,
    expectStderr: ["Can't ask for the project name", CREATE_INSTEAD],
  },
  {
    name: "create without a description",
    args: ["create", "testerName", "addonStarter", "testerCreatorName"],
    expectStderr: ["Can't ask for the project description", CREATE_INSTEAD],
  },
  {
    name: "create with an unknown template name that contains an escape sequence",
    args: ["create", "testerName", `no${ESC}[2JSuchTemplate`, "testerCreatorName", "testerDescription"],
    expectStderr: [
      "Can't ask which template to use",
      "'no\\u001b[2JSuchTemplate' isn't a template.",
      "addonStarter",
      CREATE_INSTEAD,
    ],
  },
  {
    name: "add",
    args: ["add", "-i", "project"],
    acceptEula: true,
    expectStderr: ["Can't ask what type of content to add", ADD_INSTEAD, "mct add --list-types"],
  },
  {
    name: "add with a template id and no name",
    args: ["add", "allay", "-i", "project"],
    acceptEula: true,
    expectStderr: ["Can't ask for the new item's name", "mct add allay <name>", "--yes"],
  },
  {
    name: "add entity",
    args: ["add", "entity", "testerName", "-i", "project"],
    expectStderr: ["Can't ask which entity type template to use", ADD_INSTEAD],
  },
  {
    name: "add singleFiles",
    args: ["add", "singleFiles", "testerName", "-i", "project"],
    expectStderr: ["Can't ask what type of single file to add", ADD_INSTEAD],
  },
  {
    name: "eula",
    args: ["eula"],
    expectStderr: [
      "Can't ask whether you agree to the Minecraft EULA",
      "Nothing was changed",
      "mct eula --accept",
      EULA_ENV + "=true",
    ],
    expectEulaNotAccepted: true,
  },
];

interface ISuccessCase {
  name: string;
  args: string[];
  acceptEula?: boolean;
  /** A folder, relative to the working folder, where the command must create files. */
  expectFilesIn?: string;
  /** Check that the EULA is accepted afterwards. */
  expectEulaAccepted?: boolean;
}

const successCases: ISuccessCase[] = [
  {
    name: "create with every argument",
    args: ["create", "testerName", "addonStarter", "testerCreatorName", "testerDescription", "-o", "created"],
    expectFilesIn: "created",
  },
  {
    name: "create with a name, a template, and --yes",
    args: ["create", "testerName", "addonStarter", "testerCreatorName", "--yes", "-o", "created"],
    expectFilesIn: "created",
  },
  {
    name: "add with a template id and a name",
    args: ["add", "allay", "testerName", "-i", "project"],
    expectFilesIn: "project",
  },
  {
    name: "add with a template id and --yes",
    args: ["add", "allay", "--yes", "-i", "project"],
    acceptEula: true,
    expectFilesIn: "project",
  },
  { name: "eula --accept --yes", args: ["eula", "--accept", "--yes"], expectEulaAccepted: true },
];

describe("cliPromptWithoutTerminal", () => {
  let root = "";

  before(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "mct-prompt-"));
  });

  after(() => {
    if (root) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  for (const c of promptCases) {
    for (const stdin of STDIN_MODES) {
      describe(`${c.name}, ${stdin.description}`, () => {
        let folders: IRunFolders;
        let run: ICliRun;

        before(async function () {
          this.timeout(PROMPT_TIME_LIMIT_MS + 30000);

          folders = makeRunFolders(root);
          run = await runCli(c.args, folders, stdin.mode, PROMPT_TIME_LIMIT_MS, c.acceptEula);
        });

        it("exits within a few seconds", () => {
          assert.isFalse(run.timedOut, `Still running after ${PROMPT_TIME_LIMIT_MS} ms.` + outputOf(run));
        });

        it(`exits with ${ErrorCodes.INIT_ERROR}`, () => {
          assert.equal(run.exitCode, ErrorCodes.INIT_ERROR, outputOf(run));
        });

        it("writes no escape sequences", () => {
          assert.notInclude(run.stdout, ESC, "stdout has an escape sequence." + outputOf(run));
          assert.notInclude(run.stderr, ESC, "stderr has an escape sequence." + outputOf(run));
        });

        it("names the missing input and how to supply it", () => {
          for (const expected of [...c.expectStderr, "aren't terminals"]) {
            assert.include(run.stderr, expected, outputOf(run));
          }
        });

        it("creates no files", () => {
          assert.deepEqual(filesUnder(folders.work), []);
        });

        if (c.expectEulaNotAccepted) {
          it("leaves the EULA not accepted", async function () {
            this.timeout(SUCCESS_TIME_LIMIT_MS);

            assert.isFalse(await eulaAccepted(folders.dataDir, root));
          });
        }
      });
    }
  }

  for (const c of successCases) {
    for (const stdin of STDIN_MODES) {
      describe(`${c.name}, ${stdin.description}`, () => {
        let folders: IRunFolders;
        let run: ICliRun;

        before(async function () {
          this.timeout(SUCCESS_TIME_LIMIT_MS + 30000);

          folders = makeRunFolders(root);
          run = await runCli(c.args, folders, stdin.mode, SUCCESS_TIME_LIMIT_MS, c.acceptEula);
        });

        it("succeeds without prompting", () => {
          assert.isFalse(run.timedOut, `Still running after ${SUCCESS_TIME_LIMIT_MS} ms.` + outputOf(run));
          assert.equal(run.exitCode, 0, outputOf(run));
          assert.notInclude(run.stderr, "Can't ask", outputOf(run));
        });

        if (c.expectFilesIn) {
          it(`creates files in ${c.expectFilesIn}`, () => {
            const folder = path.join(folders.work, c.expectFilesIn!);

            assert.isTrue(fs.existsSync(folder), `${folder} doesn't exist.` + outputOf(run));
            assert.isNotEmpty(filesUnder(folder), outputOf(run));
          });
        }

        if (c.expectEulaAccepted) {
          it("accepts the EULA", async function () {
            this.timeout(SUCCESS_TIME_LIMIT_MS);

            assert.isTrue(await eulaAccepted(folders.dataDir, root));
          });
        }
      });
    }
  }
});
