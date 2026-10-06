import { assert } from "chai";
import { spawn } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { removeResultFolder, ensureResultFolder, collectLines } from "./CommandLineTestHelpers";

describe("versionCommandOutput", async () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  before(function (done) {
    this.timeout(10000);

    const process = spawn("node", ["./toolbuild/jsn/cli/index.mjs", "version"]);

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

  it("should not duplicate 'Tools' in the output", () => {
    const allOutput = stdoutLines.join("\n");
    assert(!allOutput.includes("Tools Tools"), "Should not contain 'Tools Tools'. Got: " + allOutput);
  }).timeout(10000);

  it("should display Minecraft Creator Tools", () => {
    const hasName = stdoutLines.some((line) => line.includes("Minecraft Creator Tools"));
    assert(hasName, "Should show 'Minecraft Creator Tools'. Got: " + stdoutLines.join(" | "));
  }).timeout(10000);
});

describe("exitCodeConsistency_addInvalidType", async () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  before(function (done) {
    this.timeout(15000);

    const process = spawn("node", [
      "./toolbuild/jsn/cli/index.mjs",
      "add",
      "invalidtype",
      "testerName",
      "-i",
      "./../samplecontent/simple/",
    ]);

    collectLines(process.stdout, stdoutLines);
    collectLines(process.stderr, stderrLines);

    process.on("exit", (code) => {
      exitCode = code;
      done();
    });
  });

  it("should exit with ErrorCodes.INIT_ERROR (1)", async () => {
    assert.equal(exitCode, 1, "Invalid type should exit with code 1 (INIT_ERROR), got: " + exitCode);
  }).timeout(10000);

  it("should report the invalid type", () => {
    const allOutput = stdoutLines.join("\n") + stderrLines.join("\n");
    const hasError =
      allOutput.includes("Unknown item type") || allOutput.includes("invalidtype") || allOutput.includes("error");
    assert(hasError, "Should mention invalid type. Got: " + stdoutLines.join(" | "));
  }).timeout(10000);
});

describe("exitCodeConsistency_deployInvalidPath", async () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  before(function (done) {
    this.timeout(15000);

    const process = spawn("node", [
      "./toolbuild/jsn/cli/index.mjs",
      "deploy",
      "nonexistent_path_xyz",
      "-i",
      "./../samplecontent/simple/",
    ]);

    collectLines(process.stdout, stdoutLines);
    collectLines(process.stderr, stderrLines);

    process.on("exit", (code) => {
      exitCode = code;
      done();
    });
  });

  it("should exit with a non-zero code for invalid deploy path", async () => {
    assert.notEqual(exitCode, 0, "Invalid deploy path should exit with non-zero code, got: " + exitCode);
  }).timeout(10000);

  it("should report the path does not exist", () => {
    const allOutput = stdoutLines.join("\n") + stderrLines.join("\n");
    const hasError =
      allOutput.includes("does not exist") ||
      allOutput.includes("not a recognized") ||
      allOutput.includes("error") ||
      allOutput.includes("Error");
    assert(hasError, "Should report path issue. Got: " + stdoutLines.join(" | "));
  }).timeout(10000);
});

describe("aggregateReportsCommand", async () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  before(function (done) {
    this.timeout(15000);

    removeResultFolder("aggregateReportsCommand");
    ensureResultFolder("aggregateReportsCommand");

    // Run on an empty folder — should succeed with 0 reports processed
    const process = spawn("node", [
      "./toolbuild/jsn/cli/index.mjs",
      "aggregatereports",
      "noindex",
      "-i",
      "./test/results/aggregateReportsCommand/",
      "-o",
      "./test/results/aggregateReportsCommand/",
    ]);

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
});

describe("buildStructureCommandMissingArgs", async () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  before(function (done) {
    this.timeout(15000);

    // Run buildstructure without required -i or -o args
    const proc = spawn("node", ["./toolbuild/jsn/cli/index.mjs", "buildstructure"]);

    collectLines(proc.stdout, stdoutLines);
    collectLines(proc.stderr, stderrLines);

    proc.on("exit", (code) => {
      exitCode = code;
      done();
    });
  });

  it("should exit with non-zero code for missing args", async () => {
    assert.notEqual(exitCode, 0, "Missing args should fail");
  }).timeout(10000);

  it("should show usage info or error", () => {
    const allOutput = stdoutLines.join("\n") + stderrLines.join("\n");
    const hasInfo =
      allOutput.includes("Usage") ||
      allOutput.includes("inputPath") ||
      allOutput.includes("IBlockVolume") ||
      allOutput.includes("buildstructure") ||
      allOutput.includes("error") ||
      allOutput.includes("Error");
    assert(hasInfo, "Should show usage or error. Got: " + stdoutLines.join(" | "));
  }).timeout(10000);
});

describe("buildStructureCommandInvalidJson", async () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  before(function (done) {
    this.timeout(15000);

    // Pass a non-JSON file as input
    const process = spawn("node", [
      "./toolbuild/jsn/cli/index.mjs",
      "buildstructure",
      "-i",
      "./package.json",
      "-o",
      "./test/results/buildStructureInvalid/out.mcstructure",
      "--force",
    ]);

    collectLines(process.stdout, stdoutLines);
    collectLines(process.stderr, stderrLines);

    process.on("exit", (code) => {
      exitCode = code;
      done();
    });
  });

  it("should exit with non-zero code for invalid input", async () => {
    assert.notEqual(exitCode, 0, "Invalid input should fail");
  }).timeout(10000);
});

describe("searchCommandMissingTerm", async () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  before(function (done) {
    this.timeout(15000);

    // Search without a search term should fail
    const process = spawn("node", ["./toolbuild/jsn/cli/index.mjs", "search", "-i", "./../samplecontent/simple/"]);

    collectLines(process.stdout, stdoutLines);
    collectLines(process.stderr, stderrLines);

    process.on("exit", (code) => {
      exitCode = code;
      done();
    });
  });

  it("should exit with non-zero for missing search term", async () => {
    assert.notEqual(exitCode, 0, "Missing search term should fail");
  }).timeout(10000);
});

describe("profileValidationCommand", async () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  before(function (done) {
    this.timeout(30000);

    removeResultFolder("profileValidation");

    const process = spawn("node", [
      "./toolbuild/jsn/cli/index.mjs",
      "profileValidation",
      "-i",
      "./../samplecontent/simple/",
      "-o",
      "./test/results/profileValidation/",
    ]);

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

  it("should complete without crashing", async () => {
    assert.notEqual(exitCode, null, "Process should exit");
  }).timeout(10000);
});

describe("renderVanillaMissingArgs", async () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  before(function (done) {
    this.timeout(15000);

    // Run without required type arg
    const process = spawn("node", ["./toolbuild/jsn/cli/index.mjs", "rendervanilla"]);

    collectLines(process.stdout, stdoutLines);
    collectLines(process.stderr, stderrLines);

    process.on("exit", (code) => {
      exitCode = code;
      done();
    });
  });

  it("should exit with non-zero for missing args", async () => {
    assert.notEqual(exitCode, 0, "Missing args should fail");
  }).timeout(10000);

  it("should indicate what is needed", () => {
    const allOutput = stdoutLines.join("\n") + stderrLines.join("\n");
    const hasInfo =
      allOutput.includes("type") ||
      allOutput.includes("block") ||
      allOutput.includes("mob") ||
      allOutput.includes("error") ||
      allOutput.includes("Error");
    assert(hasInfo, "Should indicate requirements. Got: " + stdoutLines.slice(0, 5).join(" | "));
  }).timeout(10000);
});

describe("viewCommandMissingInput", async () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  before(function (done) {
    this.timeout(15000);

    // View with a nonexistent input folder
    const process = spawn("node", ["./toolbuild/jsn/cli/index.mjs", "view", "-i", "./nonexistent_folder_xyz/"]);

    collectLines(process.stdout, stdoutLines);
    collectLines(process.stderr, stderrLines);

    process.on("exit", (code) => {
      exitCode = code;
      done();
    });
  });

  it("should exit with non-zero for bad input", async () => {
    assert.notEqual(exitCode, 0, "Bad input should fail");
  }).timeout(10000);
});

describe("editCommandMissingInput", async () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  before(function (done) {
    this.timeout(15000);

    // Edit with a nonexistent input folder
    const process = spawn("node", ["./toolbuild/jsn/cli/index.mjs", "edit", "-i", "./nonexistent_folder_xyz/"]);

    collectLines(process.stdout, stdoutLines);
    collectLines(process.stderr, stderrLines);

    process.on("exit", (code) => {
      exitCode = code;
      done();
    });
  });

  it("should exit with non-zero for bad input", async () => {
    assert.notEqual(exitCode, 0, "Bad input should fail");
  }).timeout(10000);
});

describe("autotestCommandMissingProject", async () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  before(function (done) {
    this.timeout(15000);

    // Run autotest with invalid input
    const process = spawn("node", ["./toolbuild/jsn/cli/index.mjs", "autotest", "-i", "./nonexistent_folder_xyz/"]);

    collectLines(process.stdout, stdoutLines);
    collectLines(process.stderr, stderrLines);

    process.on("exit", (code) => {
      exitCode = code;
      done();
    });
  });

  it("should exit with non-zero for bad project", async () => {
    assert.notEqual(exitCode, 0, "Bad project should fail");
  }).timeout(10000);
});

/** Runs the built CLI and collects its output. */
function runCli(args: string[], cwd?: string): Promise<{ exitCode: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const stdoutLines: string[] = [];
    const stderrLines: string[] = [];
    const child = spawn("node", [path.resolve("./toolbuild/jsn/cli/index.mjs"), ...args], { cwd });

    collectLines(child.stdout, stdoutLines);
    collectLines(child.stderr, stderrLines);

    child.on("exit", (code) => {
      resolve({ exitCode: code, stdout: stdoutLines.join("\n"), stderr: stderrLines.join("\n") });
    });
  });
}

describe("skillsCommand", () => {
  const skillNames = ["create-block", "create-item", "create-mob", "creator-tools-cli", "debug-addon", "design-model"];
  let workingFolder: string;

  before(() => {
    workingFolder = fs.mkdtempSync(path.join(os.tmpdir(), "mct-skills-cli-"));
  });

  after(() => {
    fs.rmSync(workingFolder, { recursive: true, force: true });
  });

  it("lists every skill without writing anything to the current folder", async () => {
    const result = await runCli(["skills"], workingFolder);

    assert.equal(result.exitCode, 0, result.stderr);
    assert.equal(result.stderr, "", "skills should not write to stderr");
    for (const name of skillNames) {
      assert(result.stdout.includes(`  ${name} `), `should list ${name}. Got: ${result.stdout}`);
    }
    assert.deepEqual(fs.readdirSync(workingFolder), [], "skills should not create files such as ./out");
  }).timeout(15000);

  it("prints a skill with runnable script paths", async () => {
    const result = await runCli(["skills", "debug-addon"], workingFolder);

    assert.equal(result.exitCode, 0, result.stderr);
    assert(result.stdout.startsWith("Skill: debug-addon (SKILL.md)"), result.stdout.substring(0, 200));
    const scriptPath = /node "([^"]+validate-summary\.mjs)"/.exec(result.stdout)?.[1];
    assert(scriptPath, "debug-addon should give a quoted validate-summary command");
    assert(fs.existsSync(scriptPath!), `validate-summary.mjs not found at ${scriptPath}`);
  }).timeout(15000);

  it("reports unknown skills with the available ones", async () => {
    const result = await runCli(["skills", "nope"], workingFolder);

    assert.equal(result.exitCode, 1);
    assert(result.stderr.includes(`Available skills: ${skillNames.join(", ")}.`), result.stderr);
  }).timeout(15000);

  it("ignores -i and -o, and doesn't create the output folder", async () => {
    const result = await runCli(["skills", "-i", "missing-folder", "-o", "custom-out"], workingFolder);

    assert.equal(result.exitCode, 0, result.stderr);
    assert(result.stdout.includes("  debug-addon "), result.stdout);
    assert.deepEqual(fs.readdirSync(workingFolder), [], "skills should not create -o folders");
  }).timeout(15000);

  it("prints only the list when run inside a project", async () => {
    const projectFolder = fs.mkdtempSync(path.join(os.tmpdir(), "mct-skills-project-"));
    try {
      fs.mkdirSync(path.join(projectFolder, "behavior_packs", "demo"), { recursive: true });
      fs.writeFileSync(path.join(projectFolder, "behavior_packs", "demo", "manifest.json"), "{}");

      const result = await runCli(["skills"], projectFolder);

      assert.equal(result.exitCode, 0, result.stderr);
      assert(result.stdout.startsWith("Minecraft Creator Tools "), result.stdout.substring(0, 200));
      assert.deepEqual(fs.readdirSync(projectFolder), ["behavior_packs"], "skills should not write to the project");
    } finally {
      fs.rmSync(projectFolder, { recursive: true, force: true });
    }
  }).timeout(15000);

  it("is named in mct --help", async () => {
    const result = await runCli(["--help"], workingFolder);
    // Help wraps prose to the terminal width, so compare with line breaks collapsed.
    const help = result.stdout.replace(/\s+/g, " ");

    assert.equal(result.exitCode, 0, result.stderr);
    assert(result.stdout.includes("\nAGENT SKILLS\n"), "--help should have an AGENT SKILLS section");
    assert(help.includes(skillNames.join(", ")), "--help should name the skills");
    assert(help.includes("`mct skills <name>`"), "--help should say how to print a skill");
  }).timeout(15000);
});

// `mct mcp --input` is an older spelling of `-i`. Startup loads projects from the input folder
// before the command runs, so the alias has to take effect at parse time, not inside `mcp`.
describe("mcpCommand --input", () => {
  let startFolder: string;
  let missingFolder: string;

  before(() => {
    startFolder = fs.mkdtempSync(path.join(os.tmpdir(), "mct-mcp-start-"));
    missingFolder = path.join(os.tmpdir(), `mct-mcp-missing-${process.pid}`);
  });

  after(() => {
    fs.rmSync(startFolder, { recursive: true, force: true });
  });

  it("loads the --input folder, not the current folder, exactly like -i", async () => {
    const viaAlias = await runCli(["mcp", "--input", missingFolder], startFolder);
    const viaOption = await runCli(["mcp", "-i", missingFolder], startFolder);
    const message = (result: { stderr: string }) => result.stderr.replace(/\d{4}-\d\d-\d\dT[\d:.]+Z/g, "");

    assert.equal(viaAlias.exitCode, 1, viaAlias.stderr);
    assert.equal(viaAlias.stdout, "", "MCP must not start");
    assert(viaAlias.stderr.includes(missingFolder), "should report the --input folder as missing: " + viaAlias.stderr);
    assert(!viaAlias.stderr.includes(startFolder), "should not load the current folder: " + viaAlias.stderr);
    assert.equal(message(viaAlias), message(viaOption), "--input and -i should behave the same");
    assert.deepEqual(fs.readdirSync(startFolder), [], "should not write to the current folder");
  }).timeout(15000);

  it("rejects -i and --input naming different folders", async () => {
    const result = await runCli(["mcp", "-i", "./a", "--input", "./b"], startFolder);

    assert.equal(result.exitCode, 1);
    assert.equal(result.stdout, "");
    assert(result.stderr.includes("name different folders"), result.stderr);
  }).timeout(15000);
});
