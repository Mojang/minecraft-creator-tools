/**
 * CliBadPathHandlingTest - Regression test for the "Uncaught exception" crash
 * on bad input paths.
 *
 * Prior to the top-level try/catch in src/cli/index.ts, an invalid -i path
 * caused a Node.js uncaughtException stack dump that ended in
 * `process.exit(1)` with multiple frames of `    at ...`. Pro users in CI
 * need a single clean error line and a non-zero exit code, NOT a stack dump.
 *
 * This test asserts:
 * - exit code = 1
 * - stderr contains the friendly "does not exist" message
 * - NO occurrence of the substring "Uncaught exception"
 * - NO Node-style stack-trace lines (lines starting with "    at ")
 */

import { assert } from "chai";
import { spawn } from "child_process";
import "../app/Project";
import { collectLines } from "./CommandLineTestHelpers";

describe("cliBadPathHandling", () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  before(function (done) {
    this.timeout(20000);

    const proc = spawn("node", [
      "./toolbuild/jsn/cli/index.mjs",
      "validate",
      "addon",
      "-i",
      "./does-not-exist",
      "--isolated",
      "--quiet",
    ]);

    collectLines(proc.stdout, stdoutLines);
    collectLines(proc.stderr, stderrLines);

    proc.on("exit", (code) => {
      exitCode = code;
      done();
    });
  });

  it("exit code should be 1", () => {
    assert.equal(exitCode, 1, "Expected exit code 1, got " + exitCode);
  }).timeout(20000);

  it("output should mention 'does not exist'", () => {
    const all = stderrLines.join("\n") + "\n" + stdoutLines.join("\n");
    assert(
      all.toLowerCase().includes("does not exist"),
      "Expected friendly 'does not exist' message. Got stderr: " +
        stderrLines.join(" | ") +
        " | stdout: " +
        stdoutLines.join(" | ")
    );
  }).timeout(20000);

  it("output should NOT contain 'Uncaught exception'", () => {
    const all = stderrLines.join("\n") + "\n" + stdoutLines.join("\n");
    assert(
      !all.includes("Uncaught exception"),
      "Found 'Uncaught exception' in output - regression. stderr: " + stderrLines.join("\n")
    );
  }).timeout(20000);

  it("output should NOT contain any Node-style stack trace lines", () => {
    const allLines = [...stderrLines, ...stdoutLines];
    const stackLines = allLines.filter((line) => /^\s{4}at\s/.test(line));
    assert.equal(
      stackLines.length,
      0,
      "Found Node stack-trace lines (regression to pre-guard behavior):\n" + stackLines.join("\n")
    );
  }).timeout(20000);
});
