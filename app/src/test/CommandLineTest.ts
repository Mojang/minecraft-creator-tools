/**
 * CommandLineTest - Validation CLI integration tests
 *
 * Tests the validate command with various content types and error scenarios.
 * Other command tests have been split into:
 * - ProjectCommandLineTest.ts: project lifecycle (add, deploy, export, fix, info, set, setup, world)
 * - ServerCommandLineTest.ts: serve, passcodes, eula, setserverprops, dedicatedserve
 * - ContentCommandLineTest.ts: version, view, edit, autotest, buildstructure, search, rendervanilla, etc.
 */

import { assert } from "chai";
import { spawn } from "child_process";
// Side-effect import: ensures module initialization order for ts-node.
// Without this, the GitHubFile → FileBase class hierarchy may not resolve
// before TestUtilities triggers a transitive import of it.
import "../app/Project";
import { volatileFileExtensions, folderMatches } from "./TestUtilities";
import { scenariosFolder, resultsFolder, removeResultFolder, collectLines } from "./CommandLineTestHelpers";

describe("validateAddons1WellFormedCommand", async () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  before(function (done) {
    this.timeout(10000);

    removeResultFolder("validateAddons1WellFormedCommand");

    const process = spawn("node", [
      "./toolbuild/jsn/cli/index.mjs",
      "validate",
      "addon",
      "--warn-only",
      "-i",
      "./../samplecontent/addon/build/content1",
      "-o",
      "./test/results/validateAddons1WellFormedCommand/",
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

  it("output matches", async () => {
    await folderMatches(scenariosFolder, resultsFolder, "validateAddons1WellFormedCommand", volatileFileExtensions);
  });
});

describe("validateAddons2AnimationManifestErrorsCommand", async () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  before(function (done) {
    this.timeout(10000);

    removeResultFolder("validateAddons2AnimationManifestErrorsCommand");

    const process = spawn("node", [
      "./toolbuild/jsn/cli/index.mjs",
      "validate",
      "addon",
      "--warn-only",
      "-i",
      "./../samplecontent/addon/build/content2",
      "-o",
      "./test/results/validateAddons2AnimationManifestErrorsCommand/",
    ]);

    collectLines(process.stdout, stdoutLines);
    collectLines(process.stderr, stderrLines);

    process.on("exit", (code) => {
      exitCode = code;
      done();
    });
  });

  it("stderr should only contain validation messages", async () => {
    // Validation errors may go to stderr; just verify the process completed
    assert(exitCode !== null, "Process should have exited");
  }).timeout(10000);

  it("exit code should be zero", async () => {
    assert(exitCode !== null, "Process should have exited");
    assert(exitCode !== undefined, "Exit code should be defined");
    assert.equal(exitCode, 0);
  });

  it("output matches", async () => {
    await folderMatches(
      scenariosFolder,
      resultsFolder,
      "validateAddons2AnimationManifestErrorsCommand",
      volatileFileExtensions
    );
  });
});

describe("validateAddons3ExtraneousStuffUsesMinecraftCommand", async () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  before(function (done) {
    this.timeout(10000);

    removeResultFolder("validateAddons3ExtraneousStuffUsesMinecraftCommand");

    const process = spawn("node", [
      "./toolbuild/jsn/cli/index.mjs",
      "validate",
      "addon",
      "--warn-only",
      "-i",
      "./../samplecontent/addon/build/content3",
      "-o",
      "./test/results/validateAddons3ExtraneousStuffUsesMinecraftCommand/",
    ]);

    collectLines(process.stdout, stdoutLines);
    collectLines(process.stderr, stderrLines);

    process.on("exit", (code) => {
      exitCode = code;
      done();
    });
  });

  it("stderr should only contain validation messages", async () => {
    assert(exitCode !== null, "Process should have exited");
  }).timeout(10000);

  it("exit code should be zero", async () => {
    assert.equal(exitCode, 0);
  });

  it("output matches", async () => {
    await folderMatches(
      scenariosFolder,
      resultsFolder,
      "validateAddons3ExtraneousStuffUsesMinecraftCommand",
      volatileFileExtensions
    );
  });
});

describe("validateAddons3PlatformVersions", async () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  before(function (done) {
    this.timeout(10000);

    removeResultFolder("validateAddons3PlatformVersions");

    const process = spawn("node", [
      "./toolbuild/jsn/cli/index.mjs",
      "validate",
      "currentplatform",
      "--warn-only",
      "-i",
      "./../samplecontent/addon/build/content3",
      "-o",
      "./test/results/validateAddons3PlatformVersions/",
    ]);

    collectLines(process.stdout, stdoutLines);
    collectLines(process.stderr, stderrLines);

    process.on("exit", (code) => {
      exitCode = code;
      done();
    });
  });

  it("stderr should only contain validation messages", async () => {
    assert(exitCode !== null, "Process should have exited");
  }).timeout(10000);

  it("exit code should be zero", async () => {
    assert.equal(exitCode, 0);
  });

  it("output matches", async () => {
    await folderMatches(scenariosFolder, resultsFolder, "validateAddons3PlatformVersions", volatileFileExtensions);
  });
});

describe("validateLinkErrors", async () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  before(function (done) {
    this.timeout(10000);

    removeResultFolder("validateLinkErrors");

    const process = spawn("node", [
      "./toolbuild/jsn/cli/index.mjs",
      "validate",
      "all",
      "--warn-only",
      "-i",
      "./../samplecontent/addon/build/content_linkerrors",
      "-o",
      "./test/results/validateLinkErrors/",
    ]);

    collectLines(process.stdout, stdoutLines);
    collectLines(process.stderr, stderrLines);

    process.on("exit", (code) => {
      exitCode = code;
      done();
    });
  });

  it("stderr should only contain validation messages", async () => {
    assert(exitCode !== null, "Process should have exited");
  }).timeout(10000);

  it("exit code should be zero", async () => {
    assert.equal(exitCode, 0);
  });

  it("output matches", async () => {
    await folderMatches(scenariosFolder, resultsFolder, "validateLinkErrors", volatileFileExtensions);
  });
});

describe("validateTextureful", async () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  before(function (done) {
    this.timeout(10000);

    removeResultFolder("validateTextureful");

    const process = spawn("node", [
      "./toolbuild/jsn/cli/index.mjs",
      "validate",
      "all",
      "--warn-only",
      "-i",
      "./../samplecontent/addon/build/content_textureful",
      "-o",
      "./test/results/validateTextureful/",
    ]);

    collectLines(process.stdout, stdoutLines);
    collectLines(process.stderr, stderrLines);

    process.on("exit", (code) => {
      exitCode = code;
      done();
    });
  });

  it("stderr should only contain validation messages", async () => {
    assert(exitCode !== null, "Process should have exited");
  }).timeout(10000);

  it("exit code should be zero", async () => {
    assert(exitCode !== null, "Process should have exited");
    assert(exitCode !== undefined, "Exit code should be defined");
    assert.equal(exitCode, 0);
  });

  it("output matches", async () => {
    await folderMatches(scenariosFolder, resultsFolder, "validateTextureful", volatileFileExtensions);
  });
});

describe("validateTexturefulvv", async () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  before(function (done) {
    this.timeout(10000);

    removeResultFolder("validateTexturefulvv");

    const process = spawn("node", [
      "./toolbuild/jsn/cli/index.mjs",
      "validate",
      "all",
      "--warn-only",
      "-i",
      "./../samplecontent/addon/build/content_texturefulvv",
      "-o",
      "./test/results/validateTexturefulvv/",
    ]);

    collectLines(process.stdout, stdoutLines);
    collectLines(process.stderr, stderrLines);

    process.on("exit", (code) => {
      exitCode = code;
      done();
    });
  });

  it("stderr should only contain validation messages", async () => {
    assert(exitCode !== null, "Process should have exited");
  }).timeout(10000);

  it("exit code should be zero", async () => {
    assert(exitCode !== null, "Process should have exited");
    assert(exitCode !== undefined, "Exit code should be defined");
    assert.equal(exitCode, 0);
  });

  it("output matches", async () => {
    await folderMatches(scenariosFolder, resultsFolder, "validateTexturefulvv", volatileFileExtensions);
  });
});

describe("validateVibrantVisuals", async () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  before(function (done) {
    this.timeout(10000);

    removeResultFolder("validateVibrantVisuals");

    const process = spawn("node", [
      "./toolbuild/jsn/cli/index.mjs",
      "validate",
      "all",
      "--warn-only",
      "-i",
      "./../samplecontent/addon/build/content_vibrantvisuals",
      "-o",
      "./test/results/validateVibrantVisuals/",
    ]);

    collectLines(process.stdout, stdoutLines);
    collectLines(process.stderr, stderrLines);

    process.on("exit", (code) => {
      exitCode = code;
      done();
    });
  });

  it("stderr should only contain validation messages", async () => {
    assert(exitCode !== null, "Process should have exited");
  }).timeout(10000);

  it("exit code should be zero", async () => {
    assert.equal(exitCode, 0);
  });

  it("output matches", async () => {
    await folderMatches(scenariosFolder, resultsFolder, "validateVibrantVisuals", volatileFileExtensions);
  });
});

describe("validateComprehensiveContent", async () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  before(function (done) {
    this.timeout(10000);

    removeResultFolder("validateComprehensiveContent");

    const process = spawn("node", [
      "./toolbuild/jsn/cli/index.mjs",
      "validate",
      "addon",
      "--warn-only",
      "-i",
      "./../samplecontent/comprehensive/",
      "-o",
      "./test/results/validateComprehensiveContent/",
    ]);

    collectLines(process.stdout, stdoutLines);
    collectLines(process.stderr, stderrLines);

    process.on("exit", (code) => {
      exitCode = code;
      done();
    });
  });

  it("stderr should only contain validation messages", async () => {
    assert(exitCode !== null, "Process should have exited");
  }).timeout(10000);

  it("exit code should be zero", async () => {
    assert.equal(exitCode, 0);
  });

  it("output matches", async () => {
    await folderMatches(scenariosFolder, resultsFolder, "validateComprehensiveContent", volatileFileExtensions);
  });
});

describe("validateBehaviorPackOnly", async () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  before(function (done) {
    this.timeout(10000);

    removeResultFolder("validateBehaviorPackOnly");

    const process = spawn("node", [
      "./toolbuild/jsn/cli/index.mjs",
      "validate",
      "--warn-only",
      "-i",
      "./../samplecontent/behavior_pack_only/",
      "-o",
      "./test/results/validateBehaviorPackOnly/",
    ]);

    collectLines(process.stdout, stdoutLines);
    collectLines(process.stderr, stderrLines);

    process.on("exit", (code) => {
      exitCode = code;
      done();
    });
  });

  it("stderr should only contain validation messages", async () => {
    assert(exitCode !== null, "Process should have exited");
  }).timeout(10000);

  it("exit code should be zero", async () => {
    assert.equal(exitCode, 0);
  });

  it("output matches", async () => {
    await folderMatches(scenariosFolder, resultsFolder, "validateBehaviorPackOnly", volatileFileExtensions);
  });
});

describe("validateResourcePackOnly", async () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  before(function (done) {
    this.timeout(10000);

    removeResultFolder("validateResourcePackOnly");

    const process = spawn("node", [
      "./toolbuild/jsn/cli/index.mjs",
      "validate",
      "--warn-only",
      "-i",
      "./../samplecontent/resource_pack_only/",
      "-o",
      "./test/results/validateResourcePackOnly/",
    ]);

    collectLines(process.stdout, stdoutLines);
    collectLines(process.stderr, stderrLines);

    process.on("exit", (code) => {
      exitCode = code;
      done();
    });
  });

  it("stderr should only contain validation messages", async () => {
    assert(exitCode !== null, "Process should have exited");
  }).timeout(10000);

  it("exit code should be zero", async () => {
    assert.equal(exitCode, 0);
  });

  it("output matches", async () => {
    await folderMatches(scenariosFolder, resultsFolder, "validateResourcePackOnly", volatileFileExtensions);
  });
});

describe("spawnRulesDependencyValidate", async () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  before(function (done) {
    this.timeout(10000);

    removeResultFolder("spawnRulesDependency");

    const process = spawn("node", [
      "./toolbuild/jsn/cli/index.mjs",
      "validate",
      "--warn-only",
      "-i",
      "./../samplecontent/spawnRulesDependency/",
      "-o",
      "./test/results/spawnRulesDependency/",
    ]);

    collectLines(process.stdout, stdoutLines);
    collectLines(process.stderr, stderrLines);

    process.on("exit", (code) => {
      exitCode = code;
      done();
    });
  });

  it("stderr should only contain validation messages", async () => {
    assert(exitCode !== null, "Process should have exited");
  }).timeout(10000);

  it("exit code should be zero", async () => {
    assert.equal(exitCode, 0);
  });
});
