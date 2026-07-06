/**
 * CommandLineTest - Validation CLI integration tests
 *
 * Tests the validate command with various content types and error scenarios.
 */

import { assert } from "chai";
import { spawn } from "child_process";
import * as fs from "fs";
// Side-effect import: ensures module initialization order for ts-node.
// Without this, the GitHubFile → FileBase class hierarchy may not resolve
// before TestUtilities triggers a transitive import of it.
import "../app/Project";
import { removeResultFolder, collectLines } from "./CommandLineTestHelpers";

function readFilesRecursively(folderPath: string): string[] {
  const fileContents: string[] = [];

  for (const entry of fs.readdirSync(folderPath, { withFileTypes: true })) {
    const entryPath = folderPath + "/" + entry.name;
    if (entry.isDirectory()) {
      fileContents.push(...readFilesRecursively(entryPath));
    } else if (entry.isFile()) {
      fileContents.push(fs.readFileSync(entryPath, "utf8"));
    }
  }

  return fileContents;
}

describe("validate CLI end-to-end", () => {
  it("should execute validate command and generate output files", async function () {
    this.timeout(30000);

    let exitCode: number | null = null;
    const stdoutLines: string[] = [];
    const stderrLines: string[] = [];

    removeResultFolder("validateCLIEndToEnd");

    const process = spawn("node", [
      "./toolbuild/jsn/cli/index.mjs",
      "validate",
      "addon",
      "--warn-only",
      "-i",
      "./../samplecontent/addon/build/content1",
      "-o",
      "./test/results/validateCLIEndToEnd/",
    ]);

    collectLines(process.stdout, stdoutLines);
    collectLines(process.stderr, stderrLines);

    await new Promise<void>((resolve) => {
      process.on("exit", (code) => {
        exitCode = code;
        resolve();
      });
    });

    // Verify CLI executed successfully
    assert.equal(exitCode, 0, "CLI should exit with code 0");

    // Verify output files were generated (basic smoke test)
    const outputDir = "./test/results/validateCLIEndToEnd/";
    assert(fs.existsSync(outputDir), "Output directory should exist");

    // Verify at least one output file was created
    const files = fs.readdirSync(outputDir);
    assert(files.length > 0, "Should generate at least one output file");
  });
});

describe("validate CLI VANPRO coverage", () => {
  it("should report protected vanilla behavior assets as errors in default validation", async function () {
    this.timeout(30000);

    let exitCode: number | null = null;
    const stdoutLines: string[] = [];
    const stderrLines: string[] = [];

    removeResultFolder("validateVanproDefaultInput");
    removeResultFolder("validateVanproDefaultOutput");

    const inputDir = "./test/results/validateVanproDefaultInput/";
    const behaviorPackDir = inputDir + "behavior_packs/vanpro_bp/";
    const structureDir = behaviorPackDir + "structures/sulfur_spring/";
    fs.mkdirSync(structureDir, { recursive: true });
    fs.writeFileSync(
      behaviorPackDir + "manifest.json",
      JSON.stringify(
        {
          format_version: 2,
          header: {
            name: "VANPRO Test BP",
            description: "Test behavior pack for protected vanilla asset validation.",
            uuid: "11111111-1111-4111-8111-111111111111",
            version: [1, 0, 0],
            min_engine_version: [1, 20, 0],
          },
          modules: [
            {
              type: "data",
              uuid: "22222222-2222-4222-8222-222222222222",
              version: [1, 0, 0],
            },
          ],
        },
        undefined,
        2
      )
    );
    fs.writeFileSync(structureDir + "feature.mcstructure", "");

    const process = spawn("node", [
      "./toolbuild/jsn/cli/index.mjs",
      "validate",
      "--warn-only",
      "-i",
      inputDir,
      "-o",
      "./test/results/validateVanproDefaultOutput/",
    ]);

    collectLines(process.stdout, stdoutLines);
    collectLines(process.stderr, stderrLines);

    await new Promise<void>((resolve) => {
      process.on("exit", (code) => {
        exitCode = code;
        resolve();
      });
    });

    assert.equal(exitCode, 0, "CLI should exit with code 0. stderr: " + stderrLines.join("\n"));

    const outputDir = "./test/results/validateVanproDefaultOutput/";
    const reportJson = JSON.parse(fs.readFileSync(outputDir + "validatevanprodefaultinput.mcr.json", "utf8"));
    assert.equal(reportJson.info.vanillaProtectedAssetOverrides, 1);

    const reportText = readFilesRecursively(outputDir).join("\n");
    assert.include(reportText, "ERROR: [VANPRO101]", "Default validation report should include the protected asset error.");
  });
});

describe("validateLinkErrors", async () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  before(function (done) {
    this.timeout(30000);

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

  it("exit code should be zero", async () => {
    assert.equal(exitCode, 0);
  });
});

describe("validateTexturefulvv", async () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  before(function (done) {
    this.timeout(30000);

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

  it("exit code should be zero", async () => {
    assert(exitCode !== null, "Process should have exited");
    assert(exitCode !== undefined, "Exit code should be defined");
    assert.equal(exitCode, 0);
  });
});
