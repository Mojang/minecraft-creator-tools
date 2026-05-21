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
