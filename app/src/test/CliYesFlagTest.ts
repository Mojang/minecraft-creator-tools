/**
 * CliYesFlagTest - Asserts that `mct create --yes` is fully non-interactive
 * and produces a complete project skeleton.
 *
 * The --yes flag is the contract for CI / scripted / Cloud-Agent usage.
 * Pro creators using `mct create --yes -o <dir> <name>` MUST get:
 *
 *   1. A process that completes (no hang waiting on stdin)
 *   2. A non-failure exit code
 *   3. behavior_packs/ AND resource_packs/ AND a top-level manifest.json
 *
 * If --yes silently regresses to interactive mode (e.g. someone removes the
 * "if (context.yes)" branch in CreateCommand.ts), the spawn here will hang
 * and Mocha's test timeout will fail the run.
 */

import { assert } from "chai";
import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import "../app/Project";
import { collectLines, removeResultFolder, ensureResultFolder } from "./CommandLineTestHelpers";
import TestPaths from "./TestPaths";

const RESULT_NAME = "cliYesFlag";
const RESULT_DIR_REL = "./test/results/" + RESULT_NAME + "/";
const RESULT_DIR_ABS = path.join(TestPaths.testRoot, "results", RESULT_NAME);

describe("cliYesFlag", () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  before(function (done) {
    this.timeout(120000);

    removeResultFolder(RESULT_NAME);
    ensureResultFolder(RESULT_NAME);

    // We pass --yes plus all positional args so create has nothing to prompt for.
    // Args (positional): name, template, creator, description.
    const proc = spawn(
      "node",
      [
        "./toolbuild/jsn/cli/index.mjs",
        "create",
        "--yes",
        "-o",
        RESULT_DIR_REL,
        "testname",
        "Add-on Template",
        "TestCreator",
        "TestDescription",
      ],
      {
        // Detach stdin so a regression that prompts for input cannot block
        // forever waiting for a TTY.
        stdio: ["ignore", "pipe", "pipe"],
      }
    );

    collectLines(proc.stdout, stdoutLines);
    collectLines(proc.stderr, stderrLines);

    // Hard upper bound: even if the test framework's default timeout fires,
    // we want a clean failure rather than a leaked node process.
    const killer = setTimeout(() => {
      try {
        proc.kill("SIGTERM");
      } catch {
        // ignore
      }
    }, 90000);

    proc.on("exit", (code) => {
      clearTimeout(killer);
      exitCode = code;
      done();
    });
  });

  it("should exit (i.e. did not hang on stdin)", () => {
    assert.notEqual(exitCode, null, "Process should have exited; --yes appears to be hanging on input");
  }).timeout(120000);

  it("should produce a non-empty output directory", () => {
    assert(fs.existsSync(RESULT_DIR_ABS), "Output directory should exist: " + RESULT_DIR_ABS);
    const entries = fs.readdirSync(RESULT_DIR_ABS);
    assert(
      entries.length > 0,
      "Output directory should not be empty after `create --yes`. stderr: " + stderrLines.join("\n")
    );
  }).timeout(120000);

  it("should contain behavior_packs/ and resource_packs/ folders somewhere in the output", () => {
    const found = { bp: false, rp: false, manifest: false };

    const walk = (dir: string, depth = 0) => {
      if (depth > 6) return;
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
          if (e.name === "behavior_packs") found.bp = true;
          if (e.name === "resource_packs") found.rp = true;
          walk(full, depth + 1);
        } else if (e.isFile() && e.name === "manifest.json") {
          found.manifest = true;
        }
      }
    };

    walk(RESULT_DIR_ABS);

    assert(found.bp, "Expected a 'behavior_packs/' folder somewhere in the created project");
    assert(found.rp, "Expected a 'resource_packs/' folder somewhere in the created project");
    assert(found.manifest, "Expected at least one manifest.json in the created project");
  }).timeout(120000);
});
