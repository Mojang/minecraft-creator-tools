// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Exercises project selection through the built CLI, not just the context factory.
 * Every run uses disposable input, output, saved projects, and HOME. Tree snapshots
 * compare actual file bytes, while output assertions retain the per-project JSON contract.
 */
import { expect } from "chai";
import { spawn } from "child_process";
import { Command } from "commander";
import * as fs from "fs";
import * as path from "path";
import JSZip from "jszip";
import { TaskType } from "../cli/ClUtils";
import { CommandContextFactory } from "../cli/core/CommandContextFactory";
import { parseCommandLine } from "../cli/core/CommandLineHelp";
import { INVALID_PROJECT_PREFIX_OPTION_MESSAGE, isValidProjectPrefixOption } from "../cli/core/ProjectPrefixOption";
import { diffTrees, snapshotTree } from "./CliTranscriptHarness";
import { cliEnv } from "./TestDataDir";
import TestPaths from "./TestPaths";

const CLI_PATH = path.resolve(TestPaths.appRoot, "toolbuild/jsn/cli/index.mjs");
const SAMPLE_PROJECT = TestPaths.sampleContentPath("simple");

interface ISandbox {
  root: string;
  input: string;
  output: string;
  cwd: string;
  data: string;
  home: string;
  saved: string;
}

interface ICliResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

function runCli(sandbox: ISandbox, args: string[], acceptEula = false): Promise<ICliResult> {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, [CLI_PATH, "--offline", ...args], {
      cwd: sandbox.cwd,
      env: {
        ...cliEnv({ dataDir: sandbox.data, acceptEula }),
        HOME: sandbox.home,
        USERPROFILE: sandbox.home,
        NO_COLOR: "1",
        MCT_NO_OPEN_BROWSER: "1",
        HTTP_PROXY: "http://127.0.0.1:9",
        HTTPS_PROXY: "http://127.0.0.1:9",
        NO_PROXY: "localhost,127.0.0.1",
        NODE_USE_ENV_PROXY: "1",
        NODE_NO_WARNINGS: "1",
      },
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
    proc.on("close", (exitCode) => {
      clearTimeout(timer);
      resolve({ exitCode, stdout, stderr });
    });
  });
}

function describeRun(result: ICliResult): string {
  return `exit: ${result.exitCode}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`;
}

/** Parse every output line; do not discard chatter or extra projects to make the assertion pass. */
function jsonDocuments(stdout: string): Record<string, unknown>[] {
  return stdout.trim().split(/\r?\n/).map((line) => JSON.parse(line));
}

function namedProjects(stdout: string, prefix: string): string[] {
  return stdout
    .split(/\r?\n/)
    .filter((line) => line.startsWith(prefix))
    .map((line) => line.slice(prefix.length))
    .sort();
}

async function writePackage(filePath: string): Promise<void> {
  const zip = new JSZip();
  for (const [relativePath, entry] of snapshotTree(SAMPLE_PROJECT)) {
    if (!entry.isFolder) {
      zip.file(relativePath, fs.readFileSync(path.join(SAMPLE_PROJECT, relativePath)));
    }
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, await zip.generateAsync({ type: "nodebuffer" }));
}

describe("built CLI project selection", function () {
  this.timeout(60000);
  let sandbox: ISandbox;

  before(() => {
    expect(fs.existsSync(CLI_PATH), "Build the CLI first: npm run jsncorebuild").to.equal(true);
    fs.mkdirSync(path.join(TestPaths.testRoot, "results"), { recursive: true });
  });

  beforeEach(() => {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(TestPaths.testRoot, "results", "cliProjectSelection-")));
    const data = path.join(root, "profile");
    sandbox = {
      root,
      input: path.join(root, "multi"),
      output: path.join(root, "output"),
      cwd: path.join(root, "work"),
      data,
      home: path.join(root, "home"),
      saved: path.join(data, "cli", "projects"),
    };
    for (const folder of [sandbox.cwd, sandbox.output, sandbox.home]) {
      fs.mkdirSync(folder, { recursive: true });
    }
    // Stop cwd auto-discovery here rather than letting it reach the repository.
    fs.writeFileSync(path.join(sandbox.cwd, "package.json"), "{}");
    for (const name of ["alpha", "beta"]) {
      fs.cpSync(SAMPLE_PROJECT, path.join(sandbox.input, name), { recursive: true });
    }
    for (const name of ["multi", "alpha", "beta", "alpha.zip", "missing"]) {
      fs.cpSync(SAMPLE_PROJECT, path.join(sandbox.saved, name), { recursive: true });
    }
  });

  afterEach(() => {
    fs.rmSync(sandbox.root, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  });

  const selections = [
    { name: "no selector", args: ["info"], projects: ["alpha", "beta"] },
    { name: "the short prefix alias", args: ["info", "--psw", "alpha"], projects: ["alpha"] },
    { name: "the long prefix alias", args: ["info", "--project-starts-with=alpha"], projects: ["alpha"] },
    { name: "a case-insensitive prefix before the command", args: ["--psw", "ALP", "info"], projects: ["alpha"] },
    { name: "single-project mode", args: ["info", "--single"], projects: ["multi"] },
    {
      name: "single-project mode with a matching prefix",
      args: ["info", "--single", "--psw", "mu"],
      projects: ["multi"],
    },
  ];

  for (const { name, args, projects } of selections) {
    it(`info preserves per-project JSON with ${name}`, async () => {
      const before = snapshotTree(sandbox.input);
      const result = await runCli(sandbox, [...args, "-i", sandbox.input, "--json", "--quiet"]);
      const output = describeRun(result);
      expect(result.exitCode, output).to.equal(0);
      const documents = jsonDocuments(result.stdout);
      expect(documents.map((doc) => doc.name).sort(), output).to.deep.equal(projects);
      for (const doc of documents) {
        expect(doc).to.include({ command: "info", schemaVersion: "1.0.0" });
        expect(doc.items).to.be.an("array").that.is.not.empty;
        expect(doc.counts).to.have.keys("errors", "warnings", "recommendations", "total");
      }
      expect(snapshotTree(sandbox.input), output).to.deep.equal(before);
    });
  }

  it("info names only the matching project without a false no-match message", async () => {
    const result = await runCli(sandbox, ["info", "-i", sandbox.input, "--psw", "alpha"]);
    const output = describeRun(result);
    expect(result.exitCode, output).to.equal(0);
    expect(namedProjects(result.stdout, "Project name: "), output).to.deep.equal(["alpha"]);
    expect(result.stdout + result.stderr, output).not.to.match(/No projects match/i);
  });

  for (const flags of [[], ["--psw", "alpha"], ["--single"]]) {
    it(`fix previews exactly the selected projects: ${flags.join(" ") || "default"}`, async () => {
      const before = snapshotTree(sandbox.input);
      const savedBefore = snapshotTree(sandbox.saved);
      const result = await runCli(sandbox, ["fix", "randomizealluids", "-i", sandbox.input, ...flags, "--dry-run"]);
      const output = describeRun(result);
      const expected = flags.includes("--single") ? ["multi"] : flags.length ? ["alpha"] : ["alpha", "beta"];
      expect(result.exitCode, output).to.equal(0);
      expect(
        namedProjects(result.stdout, "Dry run: would apply fix 'randomizealluids' to project: "),
        output
      ).to.deep.equal(expected);
      expect(snapshotTree(sandbox.input), output).to.deep.equal(before);
      expect(snapshotTree(sandbox.saved), output).to.deep.equal(savedBefore);
      expect(snapshotTree(sandbox.output), output).to.deep.equal(new Map());
    });
  }

  const mutations = [
    { name: "fix", args: ["fix", "randomizealluids"], acceptEula: false },
    { name: "add", args: ["add", "loot_table", "selected_loot", "--yes"], acceptEula: true },
    { name: "world", args: ["world", "set", "--betaapis"], acceptEula: false },
  ];

  for (const mutation of mutations) {
    for (const filtered of [false, true]) {
      it(`${mutation.name} really changes ${filtered ? "only the matching project" : "both projects without a selector"}`, async () => {
        const before = snapshotTree(sandbox.input);
        const savedBefore = snapshotTree(sandbox.saved);
        const result = await runCli(
          sandbox,
          [
            ...mutation.args,
            "-i", sandbox.input,
            "-o", sandbox.output,
            "--json",
            ...(filtered ? ["--psw", "alpha"] : []),
          ],
          mutation.acceptEula
        );
        const output = describeRun(result);
        expect(result.exitCode, output).to.equal(0);
        const changes = diffTrees(before, snapshotTree(sandbox.input));
        expect(changes, output).not.to.be.empty;
        expect([...new Set(changes.map((change) => change.path.split("/")[0]))].sort(), output).to.deep.equal(
          filtered ? ["alpha"] : ["alpha", "beta"]
        );
        expect(snapshotTree(sandbox.saved), output).to.deep.equal(savedBefore);
        const documents = jsonDocuments(result.stdout);
        if (mutation.name === "fix") {
          expect(documents).to.have.length(1);
          expect(documents[0]).to.deep.equal({
            projectCount: filtered ? 1 : 2,
            fixes: (filtered ? ["alpha"] : ["alpha", "beta"]).map((project) => ({
              project,
              fix: "randomizealluids",
              updatedCount: 1,
            })),
          });
        } else {
          expect(documents, output).to.have.length(filtered ? 1 : 2);
          for (const doc of documents) {
            if (mutation.name === "add") {
              expect(doc).to.deep.equal({ success: true, added: "selected_loot", type: "loot_table" });
            } else {
              expect(doc).to.include({ schemaVersion: "1.0.0", command: "world" });
            }
          }
        }
        if (filtered) {
          expect(snapshotTree(path.join(sandbox.input, "beta")), output).to.deep.equal(snapshotTree(SAMPLE_PROJECT));
        }
      });
    }
  }

  const noMatches = [
    { name: "info", args: ["info", "--psw", "zzz"], input: "multi", prefix: "zzz" },
    { name: "fix", args: ["fix", "randomizealluids", "--psw", "zzz"], input: "multi", prefix: "zzz" },
    {
      name: "fix preview",
      args: ["fix", "randomizealluids", "--dry-run", "--psw", "zzz"],
      input: "multi",
      prefix: "zzz",
    },
    {
      name: "add",
      args: ["add", "loot_table", "selected_loot", "--yes", "--psw", "zzz"],
      input: "multi",
      prefix: "zzz",
    },
    { name: "world", args: ["world", "set", "--betaapis", "--psw", "zzz"], input: "multi", prefix: "zzz" },
    { name: "a prefix matching only the root folder", args: ["info", "--psw", "multi"], input: "multi", prefix: "multi" },
    { name: "a single project", args: ["info", "--psw", "zzz"], input: "multi/alpha", prefix: "zzz" },
    {
      name: "single mode with a child-name prefix",
      args: ["fix", "randomizealluids", "--single", "--psw", "alpha"],
      input: "multi",
      prefix: "alpha",
    },
  ];

  for (const { name, args, input, prefix } of noMatches) {
    it(`rejects an unmatched selector for ${name} without processing or changing any target`, async () => {
      const before = snapshotTree(sandbox.input);
      const savedBefore = snapshotTree(sandbox.saved);
      const result = await runCli(
        sandbox,
        [...args, "-i", path.join(sandbox.root, input), "-o", sandbox.output, "--json", "--quiet"],
        true
      );
      const output = describeRun(result);
      expect(diffTrees(before, snapshotTree(sandbox.input)), output).to.deep.equal([]);
      expect(snapshotTree(sandbox.saved), output).to.deep.equal(savedBefore);
      expect(snapshotTree(sandbox.output), output).to.deep.equal(new Map());
      expect(result.exitCode, output).to.equal(1);
      expect(result.stdout, output).to.equal("");
      expect(result.stderr, output).to.match(/No projects match/i);
      expect(result.stderr, output).to.include("--psw").and.include(prefix);
      expect(result.stderr, output).to.match(/prefix|choose|check|change/i);
      expect(result.stderr, output).not.to.match(/^\s+at /m);
    });
  }

  for (const flags of [
    ["--psw", ""],
    ["--project-starts-with", ""],
    ["--project-starts-with="],
    ["--psw"],
    ["--project-starts-with"],
  ]) {
    it(`rejects an empty or missing selector before startup: ${JSON.stringify(flags)}`, async () => {
      const before = snapshotTree(sandbox.root);
      const result = await runCli(sandbox, ["fix", "randomizealluids", "-i", sandbox.input, "--json", ...flags]);
      const output = describeRun(result);
      expect(result.exitCode, output).to.equal(1);
      expect(result.stdout, output).to.equal("");
      expect(result.stderr, output).to.match(/--psw|--project-starts-with/);
      expect(snapshotTree(sandbox.root), output).to.deep.equal(before);
    });
  }

  for (const dryRun of [false, true]) {
    it(`does not create a new output project or use a saved one on no match, dryRun=${dryRun}`, async () => {
      const target = path.join(sandbox.root, "missing");
      const savedBefore = snapshotTree(sandbox.saved);
      const result = await runCli(sandbox, [
        "fix", "randomizealluids", "-o", target, "--psw", "zzz", "--json",
        ...(dryRun ? ["--dry-run"] : []),
      ]);
      const output = describeRun(result);
      expect(result.exitCode, output).to.equal(1);
      expect(result.stdout, output).to.equal("");
      expect(result.stderr, output).to.match(/No projects match/i);
      expect(fs.existsSync(target), output).to.equal(false);
      expect(snapshotTree(sandbox.saved), output).to.deep.equal(savedBefore);
    });
  }

  it("does not create world's output folder when the selector matches nothing", async () => {
    const target = path.join(sandbox.root, "missing");
    const before = snapshotTree(sandbox.input);
    const result = await runCli(sandbox, [
      "world", "set", "--betaapis", "-i", sandbox.input, "-o", target, "--psw", "zzz", "--json",
    ]);
    const output = describeRun(result);
    expect(result.exitCode, output).to.equal(1);
    expect(result.stdout, output).to.equal("");
    expect(result.stderr, output).to.match(/No projects match/i);
    expect(fs.existsSync(target), output).to.equal(false);
    expect(snapshotTree(sandbox.input), output).to.deep.equal(before);
  });

  for (const multiLevel of [false, true]) {
    it(`filters ${multiLevel ? "multi-level" : "direct"} packages without falling back to the root`, async () => {
      const input = path.join(sandbox.root, "packages");
      const alpha = path.join(input, ...(multiLevel ? ["first"] : []), "alpha-release.zip");
      const beta = path.join(input, ...(multiLevel ? ["second"] : []), "beta.zip");
      await writePackage(alpha);
      await writePackage(beta);
      const before = snapshotTree(input);
      for (const prefix of ["alpha-release", "alpha-release.zip", "zzz", "packages"]) {
        const result = await runCli(sandbox, ["info", "-i", input, "--psw", prefix, "--json"]);
        const output = describeRun(result);
        if (prefix.startsWith("alpha")) {
          expect(result.exitCode, output).to.equal(0);
          expect(jsonDocuments(result.stdout).map((doc) => doc.name), output).to.deep.equal(["alpha-release.zip"]);
        } else {
          expect(result.exitCode, output).to.equal(1);
          expect(result.stdout, output).to.equal("");
          expect(result.stderr, output).to.match(/No projects match/i);
        }
      }
      expect(snapshotTree(input)).to.deep.equal(before);
    });
  }

  it("applies the prefix to explicit packages as well as ordinary single-project folders", async () => {
    const inputFile = path.join(sandbox.root, "alpha.zip");
    await writePackage(inputFile);
    const inputs = [["--if", inputFile], ["-i", path.join(sandbox.input, "alpha")]];
    for (const input of inputs) {
      for (const prefix of ["alp", "zzz"]) {
        const result = await runCli(sandbox, ["info", ...input, "--psw", prefix, "--json"]);
        const output = describeRun(result);
        if (prefix === "alp") {
          expect(result.exitCode, output).to.equal(0);
          expect(jsonDocuments(result.stdout).map((doc) => doc.name), output).to.deep.equal([
            input[0] === "--if" ? "alpha.zip" : "alpha",
          ]);
        } else {
          expect(result.exitCode, output).to.equal(1);
          expect(result.stdout, output).to.equal("");
          expect(result.stderr, output).to.match(/No projects match/i);
        }
      }
    }
  });

  it("uses folder leaf names and complete package filenames before loading display titles", async () => {
    const inputFile = path.join(sandbox.root, "alpha.zip");
    await writePackage(inputFile);
    const cases = [
      { input: ["-i", path.join(sandbox.input, "alpha") + path.sep], name: "alpha" },
      { input: ["-i", sandbox.input + path.sep, "--single"], name: "multi" },
      { input: ["--if", inputFile], name: "alpha.zip" },
      { input: ["--if", inputFile, "--single"], name: "alpha.zip" },
    ];
    for (const { input, name } of cases) {
      const result = await runCli(sandbox, ["info", ...input, "--psw", name, "--json"]);
      const output = describeRun(result);
      expect(result.exitCode, output).to.equal(0);
      expect(jsonDocuments(result.stdout).map((doc) => doc.name), output).to.deep.equal([name]);
    }
    const result = await runCli(sandbox, [
      "info", "--if", inputFile, "--psw", "Starter Hello World Tests", "--json",
    ]);
    const output = describeRun(result);
    expect(result.exitCode, output).to.equal(1);
    expect(result.stdout, output).to.equal("");
    expect(result.stderr, output).to.match(/No projects match/i);
  });

  it("does not let a matching selector or --yes bypass add's EULA requirement", async () => {
    const before = snapshotTree(sandbox.input);
    const result = await runCli(sandbox, [
      "add", "loot_table", "selected_loot", "-i", sandbox.input, "--psw", "alpha", "--yes", "--json",
    ]);
    const output = describeRun(result);
    expect(result.exitCode, output).to.equal(1);
    expect(result.stdout, output).to.equal("");
    expect(result.stderr, output).to.include("EULA not accepted");
    expect(snapshotTree(sandbox.input), output).to.deep.equal(before);
  });

  for (const flags of [[], ["--quiet"]]) {
    it(`reports no match on stderr without processing in human mode: ${flags.join(" ") || "default"}`, async () => {
      const result = await runCli(sandbox, ["info", "-i", sandbox.input, "--psw", "zzz", ...flags]);
      const output = describeRun(result);
      expect(result.exitCode, output).to.equal(1);
      expect(result.stderr, output).to.match(/No projects match.*--psw zzz/);
      expect(result.stdout, output).not.to.match(/No projects match|Project name:|Analyzing project/);
    });
  }

  for (const dryRun of [false, true]) {
    it(`still binds a matching new output project to its path, dryRun=${dryRun}`, async () => {
      const target = path.join(sandbox.root, "missing");
      const savedBefore = snapshotTree(sandbox.saved);
      const result = await runCli(sandbox, [
        "fix", "randomizealluids", "-o", target, "--psw", "miss", "--json",
        ...(dryRun ? ["--dry-run"] : []),
      ]);
      const output = describeRun(result);
      expect(result.exitCode, output).to.equal(0);
      expect(JSON.parse(result.stdout), output).to.deep.equal({
        projectCount: 1,
        fixes: dryRun ? [] : [{ project: "missing", fix: "randomizealluids", updatedCount: 1 }],
      });
      expect(fs.existsSync(target), output).to.equal(!dryRun);
      expect(snapshotTree(target), output).to.deep.equal(new Map());
      expect(snapshotTree(sandbox.saved), output).to.deep.equal(savedBefore);
    });
  }

  for (const inputState of ["empty", "missing", "unreadable"]) {
    it(`preserves explicit input-file rejection with a selector: ${inputState}`, async () => {
      const inputFile = inputState === "empty" ? "" : path.join(sandbox.root, "alpha.zip");
      if (inputState === "unreadable") {
        fs.writeFileSync(inputFile, "not a package");
      }
      const before = snapshotTree(sandbox.input);
      const savedBefore = snapshotTree(sandbox.saved);
      const result = await runCli(sandbox, [
        "fix", "randomizealluids", "--if", inputFile, "--psw", "alpha", "--json", "--dry-run",
      ]);
      const output = describeRun(result);
      expect(result.exitCode, output).to.equal(1);
      expect(result.stdout, output).to.equal("");
      expect(result.stderr, output).to.include(
        inputState === "empty"
          ? "--if/--input-file"
          : inputState === "missing"
            ? "Could not find input package"
            : "Can't open package"
      );
      expect(snapshotTree(sandbox.input), output).to.deep.equal(before);
      expect(snapshotTree(sandbox.saved), output).to.deep.equal(savedBefore);
      expect(snapshotTree(sandbox.output), output).to.deep.equal(new Map());
    });
  }

  it("rejects invalid raw prefixes before direct context callers select any folder", async () => {
    const env = await TestPaths.createTestEnvironment();
    const before = snapshotTree(sandbox.root);
    for (const projectStartsWith of ["", true, false, null, 0, [], {}]) {
      let error: unknown;
      try {
        await CommandContextFactory.create(env.creatorTools, env.localEnv, TaskType.fix, {
          inputFolder: path.join(sandbox.root, "missing-input"),
          outputFolder: path.join(sandbox.root, "missing-output"),
          projectStartsWith,
        });
      } catch (caught) {
        error = caught;
      }
      expect(error).to.be.instanceOf(Error);
      expect(error).to.have.property("message", INVALID_PROJECT_PREFIX_OPTION_MESSAGE);
    }
    expect(snapshotTree(sandbox.root)).to.deep.equal(before);
  });

  it("keeps valid prefix bytes and both Commander attribute names", () => {
    expect(isValidProjectPrefixOption(undefined)).to.equal(true);
    for (const prefix of ["alpha", "ALP", " leading space", "-dash", "\u00e9"]) {
      for (const flag of ["--psw", "--project-starts-with"]) {
        const program = new Command().option("--psw, --project-starts-with <prefix>").option("--single");
        program.command("run").action(() => {});
        parseCommandLine(program, ["node", "mct", "run", flag, prefix, "--single"]);
        expect(program.opts()).to.deep.equal({ projectStartsWith: prefix, single: true });
        expect(isValidProjectPrefixOption(prefix)).to.equal(true);
      }
    }
  });
});
