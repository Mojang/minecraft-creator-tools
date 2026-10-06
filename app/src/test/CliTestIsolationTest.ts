// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * CliTestIsolationTest - Checks that CLI tests keep the CLI's saved state out of the developer's
 * real Creator Tools profile, and don't accept the Minecraft EULA for every test.
 *
 * CommandLineTestHelpers gives the test process a temporary MCTOOLS_DATA_DIR (see TestDataDir.ts).
 * These tests fail if that folder stops reaching spawned CLI processes, if the EULA environment
 * variable is set for every test again, if acceptance saved by one test reaches the folder the
 * other tests share, or if a test file can start the CLI without the folder.
 *
 * Within `npm test`, one isolated file isolates the whole process, so a file that misses the folder
 * would show it only when run on its own. That last check therefore reads the source of every file
 * under src/test (see findTestFilesWithoutIsolation):
 * - A file that loads a module that starts processes (LAUNCHER_MODULES) must load TestDataDir or
 *   CommandLineTestHelpers, directly or through other files here. Imports are read from the
 *   JavaScript TypeScript emits, so type-only and unused imports, which it removes, don't count.
 * - Each launch must keep the folder. An `env` written as an object literal needs a `...process.env`
 *   or `...cliEnv()` spread, or an MCTOOLS_DATA_DIR key that isn't undefined. The MCP SDK's
 *   StdioClientTransport needs an `env` with MCTOOLS_DATA_DIR, because the SDK passes the server
 *   only a few variables, such as PATH and HOME. An `env` that's a variable or another call can't be
 *   read statically and is accepted.
 * Code that hides a module name in a variable, such as `require(name)`, isn't detected.
 */

import { assert } from "chai";
import { spawn } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as ts from "typescript";
import "../app/Project";
import { collectLines } from "./CommandLineTestHelpers";
import { DATA_DIR_ENV, EULA_ENV, cliEnv, setEnvironmentVariable } from "./TestDataDir";
import TestPaths from "./TestPaths";

interface IProcessRun {
  exitCode: number | null;
  stdout: string[];
  stderr: string[];
}

/** Runs `node` with `args`. Without `env`, it inherits this process's environment. */
async function runNode(args: string[], env?: NodeJS.ProcessEnv): Promise<IProcessRun> {
  const proc = spawn("node", args, { env, stdio: ["ignore", "pipe", "pipe"] });
  const run: IProcessRun = { exitCode: null, stdout: [], stderr: [] };

  const [exitCode] = await Promise.all([
    new Promise<number | null>((resolve) => proc.on("exit", (code) => resolve(code))),
    collectLines(proc.stdout, run.stdout),
    collectLines(proc.stderr, run.stderr),
  ]);
  run.exitCode = exitCode;

  return run;
}

/** Runs the built CLI. Without `env`, it inherits this process's environment, as most suites' spawns do. */
function runCli(args: string[], env?: NodeJS.ProcessEnv): Promise<IProcessRun> {
  return runNode(["./toolbuild/jsn/cli/index.mjs", ...args], env);
}

function outputOf(run: IProcessRun) {
  return `\nstdout: ${run.stdout.join("\n")}\nstderr: ${run.stderr.join("\n")}`;
}

function jsonDocument(run: IProcessRun) {
  const line = run.stdout.find((candidate) => candidate.trim().startsWith("{"));
  assert(line, "Expected a JSON document on stdout." + outputOf(run));

  return JSON.parse(line as string);
}

function isInside(child: string, parent: string) {
  const relative = path.relative(parent, child);

  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

const NOT_ACCEPTED = { schemaVersion: "1.0.0", command: "eula", accepted: false, acceptedViaEnvironment: false };

interface ITestSource {
  /** Path relative to src/test, with forward slashes. */
  name: string;
  source: string;
}

interface IUnisolatedFile {
  name: string;
  reason: string;
}

/** Modules that start other processes. */
const LAUNCHER_MODULES = [
  "child_process",
  "node:child_process",
  "execa",
  "cross-spawn",
  "@modelcontextprotocol/sdk/client/stdio",
  "@modelcontextprotocol/sdk/client/stdio.js",
];

/** Functions from those modules that start a process and take options with an `env`. */
const LAUNCH_FUNCTIONS = ["spawn", "spawnSync", "exec", "execSync", "execFile", "execFileSync", "fork", "execa"];

/** Files that point MCTOOLS_DATA_DIR at a temporary folder when they load. */
const ISOLATING_FILES = ["TestDataDir.ts", "CommandLineTestHelpers.ts"];

/**
 * Test files that start processes but never the CLI, so they don't need a temporary data folder.
 * McpSkillLibraryTest runs `node --check` on the skills' bundled scripts.
 */
const RUNS_OTHER_PROGRAMS_ONLY = ["McpSkillLibraryTest.ts", "ValidationFixtureSizeAuditTest.ts"];

/**
 * Lists the files that can start a process, such as the CLI, without a temporary data folder. See
 * the file header for the rules. `files` are all the files under src/test, so that helpers that
 * load TestDataDir can isolate the files that load them.
 */
function findTestFilesWithoutIsolation(files: ITestSource[]): IUnisolatedFile[] {
  const modules = files.map((file) => ({ ...file, imports: emittedImports(file) }));

  const isolating = new Set(ISOLATING_FILES);
  let added = true;
  while (added) {
    added = false;
    for (const module of modules) {
      if (!isolating.has(module.name) && module.imports.some((name) => isolating.has(name))) {
        isolating.add(module.name);
        added = true;
      }
    }
  }

  const unisolated: IUnisolatedFile[] = [];
  for (const module of modules) {
    if (
      !module.imports.some((name) => LAUNCHER_MODULES.includes(name)) ||
      RUNS_OTHER_PROGRAMS_ONLY.includes(module.name)
    ) {
      continue;
    }

    const launchProblem = findLaunchWithoutDataDir(module.source);
    if (!isolating.has(module.name)) {
      unisolated.push({ name: module.name, reason: "starts processes but doesn't load TestDataDir" });
    } else if (launchProblem) {
      unisolated.push({ name: module.name, reason: launchProblem });
    }
  }

  return unisolated;
}

/**
 * The modules `file` loads at run time: what the JavaScript TypeScript emits for it requires, with
 * relative paths resolved to names like those in ITestSource. TypeScript drops type-only and unused
 * imports, and comments and strings don't count.
 */
function emittedImports(file: ITestSource): string[] {
  const emitted = ts.transpileModule(file.source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;

  return ts.preProcessFile(emitted, true, true).importedFiles.map((imported) => {
    if (!imported.fileName.startsWith(".")) {
      return imported.fileName;
    }

    const resolved = path.posix.join("/src/test", path.posix.dirname(file.name), imported.fileName);
    return resolved.startsWith("/src/test/")
      ? resolved.substring("/src/test/".length).replace(/(\.[cm]?[jt]s)?$/, ".ts")
      : resolved;
  });
}

/** Describes the first launch in `source` that would drop the temporary data folder, if any. */
function findLaunchWithoutDataDir(source: string): string | undefined {
  const sourceFile = ts.createSourceFile("source.ts", source, ts.ScriptTarget.Latest);
  const launchFunctions = new Set(LAUNCH_FUNCTIONS);
  const transports = new Set(["StdioClientTransport"]);
  const dataDirNames = new Set(["DATA_DIR_ENV"]);
  let problem: string | undefined;

  // First, the local names: aliased imports such as `{ spawn as run }`, and constants for the key.
  const collectNames = (node: ts.Node) => {
    if ((ts.isImportSpecifier(node) || ts.isBindingElement(node)) && ts.isIdentifier(node.name)) {
      const importedName = node.propertyName ?? node.name;
      const imported = ts.isIdentifier(importedName) || ts.isStringLiteral(importedName) ? importedName.text : "";
      if (launchFunctions.has(imported)) {
        launchFunctions.add(node.name.text);
      } else if (transports.has(imported)) {
        transports.add(node.name.text);
      }
    } else if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isStringLiteralLike(node.initializer) &&
      node.initializer.text === DATA_DIR_ENV
    ) {
      dataDirNames.add(node.name.text);
    }
    ts.forEachChild(node, collectNames);
  };
  collectNames(sourceFile);

  const findLaunches = (node: ts.Node) => {
    if (problem) {
      return;
    }

    if (ts.isNewExpression(node) && transports.has(calledName(node.expression))) {
      const options = node.arguments?.[0];
      const env = options && ts.isObjectLiteralExpression(options) ? propertyValue(options, "env") : undefined;
      if (options && ts.isObjectLiteralExpression(options) && (!env || !keepsDataDir(env, dataDirNames))) {
        problem = `starts an MCP stdio transport without passing ${DATA_DIR_ENV}`;
      }
    } else if (ts.isCallExpression(node) && launchFunctions.has(calledName(node.expression))) {
      for (const argument of node.arguments) {
        const env = ts.isObjectLiteralExpression(argument) ? propertyValue(argument, "env") : undefined;
        if (env && !keepsDataDir(env, dataDirNames)) {
          problem = `passes ${calledName(node.expression)}() an env that drops ${DATA_DIR_ENV}`;
        }
      }
    }
    ts.forEachChild(node, findLaunches);
  };
  findLaunches(sourceFile);

  return problem;
}

/** The name a call or `new` uses: `spawn` for `spawn(...)` and `cp.spawn(...)`. */
function calledName(expression: ts.Expression): string {
  if (ts.isIdentifier(expression)) {
    return expression.text;
  }

  return ts.isPropertyAccessExpression(expression) ? expression.name.text : "";
}

function propertyValue(object: ts.ObjectLiteralExpression, name: string): ts.Expression | undefined {
  for (const property of object.properties) {
    if (ts.isPropertyAssignment(property) && ts.isIdentifier(property.name) && property.name.text === name) {
      return property.initializer;
    }
    if (ts.isShorthandPropertyAssignment(property) && property.name.text === name) {
      return property.name;
    }
  }

  return undefined;
}

/**
 * Whether an `env` keeps the temporary data folder. An object literal does when it spreads
 * `process.env` or `cliEnv()`, or sets the key to something other than undefined. `cliEnv(...)` keeps
 * it. Anything else, such as a variable, can't be read here and is accepted.
 */
function keepsDataDir(env: ts.Expression, dataDirNames: Set<string>): boolean {
  if (ts.isCallExpression(env) && calledName(env.expression) === "cliEnv") {
    return true;
  }
  if (!ts.isObjectLiteralExpression(env)) {
    return true;
  }

  let keeps = false;
  for (const property of env.properties) {
    if (ts.isSpreadAssignment(property)) {
      const spread = property.expression;
      const spreadsProcessEnv =
        ts.isPropertyAccessExpression(spread) &&
        spread.name.text === "env" &&
        ts.isIdentifier(spread.expression) &&
        spread.expression.text === "process";
      if (spreadsProcessEnv || (ts.isCallExpression(spread) && calledName(spread.expression) === "cliEnv")) {
        keeps = true;
      }
    } else if (ts.isShorthandPropertyAssignment(property) && property.name.text === DATA_DIR_ENV) {
      keeps = true;
    } else if (ts.isPropertyAssignment(property) && namesDataDir(property.name, dataDirNames)) {
      const value = property.initializer;
      if ((ts.isIdentifier(value) && value.text === "undefined") || ts.isVoidExpression(value)) {
        return false;
      }
      keeps = true;
    }
  }

  return keeps;
}

/** Whether a property name is MCTOOLS_DATA_DIR: written out, quoted, or computed from a constant. */
function namesDataDir(name: ts.PropertyName, dataDirNames: Set<string>): boolean {
  if (ts.isIdentifier(name) || ts.isStringLiteralLike(name)) {
    return name.text === DATA_DIR_ENV;
  }
  if (ts.isComputedPropertyName(name)) {
    const key = name.expression;
    return (
      (ts.isStringLiteralLike(key) && key.text === DATA_DIR_ENV) || (ts.isIdentifier(key) && dataDirNames.has(key.text))
    );
  }

  return false;
}

const CLI = '"./toolbuild/jsn/cli/index.mjs"';
const SPAWN_CLI = `spawn("node", [${CLI}, "version"]);`;
const RUNNER = `import { spawn } from "child_process";\nimport { cliEnv } from "./TestDataDir";\nexport function runCli() {\n  return spawn("node", [${CLI}], { env: cliEnv() });\n}`;

/** Sets of src/test files, and which ones findTestFilesWithoutIsolation() reports. */
const sourceCases: { name: string; files: { [name: string]: string }; reported: string[] }[] = [
  {
    name: "imports CommandLineTestHelpers",
    files: { "a.ts": `import { spawn } from "child_process";\nimport "./CommandLineTestHelpers";\n${SPAWN_CLI}` },
    reported: [],
  },
  {
    name: "uses a constant from TestDataDir",
    files: {
      "a.ts": `import { spawn } from "child_process";\nimport { EULA_ENV } from "./TestDataDir";\nconsole.log(EULA_ENV);\n${SPAWN_CLI}`,
    },
    reported: [],
  },
  {
    name: "imports TestDataDir from a subfolder",
    files: { "cli/a.ts": `import { spawn } from "child_process";\nimport "../TestDataDir";\n${SPAWN_CLI}` },
    reported: [],
  },
  {
    name: "imports a helper that loads TestDataDir, and spawns too",
    files: {
      "a.ts": `import { spawn } from "child_process";\nimport { runCli } from "./Runner";\nrunCli();\n${SPAWN_CLI}`,
      "Runner.ts": RUNNER,
    },
    reported: [],
  },
  {
    name: "spreads process.env into a spawn env",
    files: {
      "a.ts": `import { spawn } from "child_process";\nimport "./TestDataDir";\nspawn("node", [${CLI}], { env: { ...process.env, NODE_ENV: "test" } });`,
    },
    reported: [],
  },
  {
    name: "sets the key from a constant in a spawn env",
    files: {
      "a.ts": `import { spawn } from "child_process";\nimport "./TestDataDir";\nconst KEY = "MCTOOLS_DATA_DIR";\nspawn("node", [${CLI}], { env: { [KEY]: dir } });`,
    },
    reported: [],
  },
  {
    name: "passes MCTOOLS_DATA_DIR to an MCP stdio transport",
    files: {
      "a.ts": `import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";\nimport { DATA_DIR_ENV, applyTestDataDir } from "./TestDataDir";\nnew StdioClientTransport({ command: "node", args: [${CLI}, "mcp"], env: { [DATA_DIR_ENV]: applyTestDataDir() } });`,
    },
    reported: [],
  },
  {
    name: "is listed as running other programs only",
    files: {
      "ValidationFixtureSizeAuditTest.ts": `import { execFileSync } from "child_process";\nexecFileSync("git", ["status"]);`,
    },
    reported: [],
  },
  {
    name: "names MCTOOLS_DATA_DIR only in a comment and a string",
    files: {
      "a.ts": `// Strips MCTOOLS_DATA_DIR.\nimport { spawn } from "child_process";\nconst stripped = ["MCTOOLS_DATA_DIR"];\n${SPAWN_CLI}`,
    },
    reported: ["a.ts"],
  },
  {
    name: "imports TestDataDir only in a comment",
    files: { "a.ts": `// import "./TestDataDir";\nimport { spawn } from "child_process";\n${SPAWN_CLI}` },
    reported: ["a.ts"],
  },
  {
    name: "imports TestDataDir only for a type",
    files: {
      "a.ts": `import type { ICliEnvOptions } from "./TestDataDir";\nimport { spawn } from "child_process";\nconst options: ICliEnvOptions = {};\n${SPAWN_CLI}`,
    },
    reported: ["a.ts"],
  },
  {
    name: "imports a constant from TestDataDir that it never uses",
    files: {
      "a.ts": `import { EULA_ENV } from "./TestDataDir";\nimport { spawn } from "child_process";\n${SPAWN_CLI}`,
    },
    reported: ["a.ts"],
  },
  {
    name: "imports node:child_process",
    files: { "a.ts": `import { spawn } from "node:child_process";\n${SPAWN_CLI}` },
    reported: ["a.ts"],
  },
  {
    name: "imports child_process over several lines",
    files: { "a.ts": `import {\n  spawn,\n} from "child_process";\n${SPAWN_CLI}` },
    reported: ["a.ts"],
  },
  {
    name: "requires child_process",
    files: { "a.ts": `const { spawn } = require("child_process");\n${SPAWN_CLI}` },
    reported: ["a.ts"],
  },
  {
    name: "loads child_process with import()",
    files: { "a.ts": `async function run() {\n  const { spawn } = await import("child_process");\n  ${SPAWN_CLI}\n}` },
    reported: ["a.ts"],
  },
  {
    name: "uses execa",
    files: { "a.ts": `import execa from "execa";\nexeca("node", [${CLI}]);` },
    reported: ["a.ts"],
  },
  {
    name: "starts the CLI through a path from another file",
    files: {
      "a.ts": `import { spawn } from "child_process";\nimport TestPaths from "./TestPaths";\nspawn("node", [TestPaths.cliPath]);`,
    },
    reported: ["a.ts"],
  },
  {
    name: "starts the CLI from a helper in a subfolder",
    files: {
      "a.ts": `import { runCli } from "./cli/Runner";\nrunCli();`,
      "cli/Runner.ts": `import { spawn } from "child_process";\nexport function runCli() {\n  return ${SPAWN_CLI}\n}`,
    },
    reported: ["cli/Runner.ts"],
  },
  {
    name: "sets MCTOOLS_DATA_DIR for one spawn only",
    files: {
      "a.ts": `import { spawn } from "child_process";\nspawn("node", [${CLI}], { env: { ...process.env, MCTOOLS_DATA_DIR: dir } });\n${SPAWN_CLI}`,
    },
    reported: ["a.ts"],
  },
  {
    name: "passes a spawn env without process.env",
    files: {
      "a.ts": `import { spawn } from "child_process";\nimport "./TestDataDir";\nspawn(process.execPath, [${CLI}], { env: { NODE_ENV: "test" } });`,
    },
    reported: ["a.ts"],
  },
  {
    name: "passes an aliased spawn an env without process.env",
    files: {
      "a.ts": `import { spawn as run } from "child_process";\nimport "./TestDataDir";\nrun("node", [${CLI}], { env: { NODE_ENV: "test" } });`,
    },
    reported: ["a.ts"],
  },
  {
    name: "sets MCTOOLS_DATA_DIR to undefined in a spawn env",
    files: {
      "a.ts": `import { spawn } from "child_process";\nimport "./TestDataDir";\nspawn("node", [${CLI}], { env: { ...process.env, MCTOOLS_DATA_DIR: undefined } });`,
    },
    reported: ["a.ts"],
  },
  {
    name: "starts an MCP stdio transport without passing MCTOOLS_DATA_DIR",
    files: {
      "a.ts": `import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";\nimport "./TestDataDir";\nnew StdioClientTransport({ command: "node", args: [${CLI}, "mcp"] });`,
    },
    reported: ["a.ts"],
  },
  {
    name: "starts an MCP stdio transport without isolation",
    files: {
      "a.ts": `import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";\nnew StdioClientTransport({ command: "node", args: [${CLI}, "mcp"] });`,
    },
    reported: ["a.ts"],
  },
];

/** Every .ts file under src/test, named as in ITestSource. */
function readTestFiles(): ITestSource[] {
  const testFolder = path.join(TestPaths.appRoot, "src", "test");
  const files: ITestSource[] = [];
  const walk = (relative: string) => {
    for (const entry of fs.readdirSync(path.join(testFolder, relative), { withFileTypes: true })) {
      const name = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(name);
      } else if (entry.name.endsWith(".ts")) {
        files.push({ name, source: fs.readFileSync(path.join(testFolder, name), "utf8") });
      }
    }
  };
  walk("");

  return files;
}

describe("cliTestIsolation", () => {
  let home = "";

  before(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), "mct-test-home-"));
  });

  after(() => {
    fs.rmSync(home, { recursive: true, force: true });
  });

  it("points MCTOOLS_DATA_DIR at a temporary folder", () => {
    const dataDir = process.env[DATA_DIR_ENV];

    assert(dataDir, DATA_DIR_ENV + " should be set");
    assert(isInside(dataDir as string, os.tmpdir()), `${DATA_DIR_ENV} should be in ${os.tmpdir()}, was ${dataDir}`);
  });

  it("doesn't set the EULA environment variable for every test", () => {
    const names = Object.keys(process.env).filter((name) => name.toUpperCase() === EULA_ENV);

    assert.deepEqual(names, []);
  });

  it("runs the CLI with its data in that folder and nothing in the home folder", async () => {
    const env = { ...process.env };
    setEnvironmentVariable(env, "HOME", home);
    setEnvironmentVariable(env, "USERPROFILE", home);

    const run = await runCli(["version", "--json"], env);

    assert.equal(run.exitCode, 0, outputOf(run));
    const version = jsonDocument(run);
    for (const key of ["serversPath", "envPrefsPath", "packCachePath"]) {
      assert(
        isInside(version[key], process.env[DATA_DIR_ENV] as string),
        `${key} should be in ${process.env[DATA_DIR_ENV]}, was ${version[key]}`
      );
    }
    assert.deepEqual(fs.readdirSync(home), [], "the CLI shouldn't write to the home folder");
  }).timeout(30000);

  it("starts the CLI as a user who hasn't accepted the EULA", async () => {
    const run = await runCli(["eula", "--status", "--json"]);

    assert.equal(run.exitCode, 0, outputOf(run));
    assert.deepEqual(jsonDocument(run), NOT_ACCEPTED);
  }).timeout(30000);

  it("keeps acceptance saved by a spawn that accepts the EULA out of the shared folder", async () => {
    const accept = await runCli(["eula"], cliEnv({ acceptEula: true }));
    assert.equal(accept.exitCode, 0, outputOf(accept));

    const status = await runCli(["eula", "--status", "--json"], cliEnv());

    assert.equal(status.exitCode, 0, outputOf(status));
    assert.deepEqual(jsonDocument(status), NOT_ACCEPTED);
  }).timeout(60000);

  it("isolates a process that imports only a constant from TestDataDir", async () => {
    const env = { ...process.env };
    setEnvironmentVariable(env, DATA_DIR_ENV, undefined);
    setEnvironmentVariable(env, EULA_ENV, "true");
    const script =
      'require("ts-node").register({ transpileOnly: true, project: "tsconfig.test.json" });' +
      'const { EULA_ENV } = require("./src/test/TestDataDir");' +
      "console.log(JSON.stringify({ dataDir: process.env.MCTOOLS_DATA_DIR, eula: process.env[EULA_ENV] ?? null }));";

    const run = await runNode(["-e", script], env);

    assert.equal(run.exitCode, 0, outputOf(run));
    const { dataDir, eula } = jsonDocument(run);
    assert(isInside(dataDir, os.tmpdir()), `${DATA_DIR_ENV} should be in ${os.tmpdir()}, was ${dataDir}`);
    assert.equal(eula, null, "the inherited EULA environment variable should be removed");
    assert.isFalse(fs.existsSync(dataDir), "the folder should be deleted when the process exits");
  }).timeout(30000);

  describe("source check for test files that start processes", () => {
    for (const c of sourceCases) {
      it(`${c.reported.length > 0 ? "reports" : "accepts"} a file that ${c.name}`, () => {
        const files = Object.entries(c.files).map(([name, source]) => ({ name, source }));

        const reported = findTestFilesWithoutIsolation(files).map((file) => file.name);

        assert.deepEqual(reported, c.reported);
      });
    }

    it("finds every file under src/test isolated, so each one is isolated when it runs on its own", () => {
      assert.deepEqual(
        findTestFilesWithoutIsolation(readTestFiles()),
        [],
        "These files can start the CLI with the real profile when they run on their own. Import TestDataDir " +
          "and keep its folder in each launch's env. If a file never starts the CLI, add it to RUNS_OTHER_PROGRAMS_ONLY."
      );
    }).timeout(30000);
  });
});
