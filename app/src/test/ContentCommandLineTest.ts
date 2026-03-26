import { assert } from "chai";
import { spawn } from "child_process";
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
