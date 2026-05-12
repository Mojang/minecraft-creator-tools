/**
 * CliJsonContractTest - Asserts the JSON contract for `mct version --json` and
 * `mct info --json`.
 *
 * These two commands publish a stable, machine-parseable schema (schemaVersion
 * "1.0.0"). CI tooling and downstream scripts depend on the shape of these
 * objects; a regression in either field set would silently break consumers.
 *
 * The tests spawn the real built CLI (toolbuild/jsn/cli/index.mjs) and parse
 * the first line of stdout that begins with "{" as JSON.
 */

import { assert } from "chai";
import { spawn } from "child_process";
import "../app/Project";
import { collectLines } from "./CommandLineTestHelpers";

function findJsonLine(lines: string[]): string | undefined {
  return lines.find((line) => line.trim().startsWith("{"));
}

describe("cliJsonContract", () => {
  describe("version --json", () => {
    let exitCode: number | null = null;
    const stdoutLines: string[] = [];
    const stderrLines: string[] = [];

    before(function (done) {
      this.timeout(10000);

      const proc = spawn("node", ["./toolbuild/jsn/cli/index.mjs", "version", "--json"]);

      collectLines(proc.stdout, stdoutLines);
      collectLines(proc.stderr, stderrLines);

      proc.on("exit", (code) => {
        exitCode = code;
        done();
      });
    });

    it("should exit cleanly", () => {
      assert.equal(exitCode, 0, "stderr: " + stderrLines.join("\n"));
    }).timeout(10000);

    it("should output a valid JSON object containing schemaVersion, command, version, and name", () => {
      const jsonLine = findJsonLine(stdoutLines);
      assert(
        jsonLine,
        "Expected a JSON-starting line in stdout. Got: " + stdoutLines.slice(0, 5).join(" | ")
      );

      const parsed = JSON.parse(jsonLine!);

      assert.equal(parsed.schemaVersion, "1.0.0", "schemaVersion should be '1.0.0'");
      assert.equal(parsed.command, "version", "command should be 'version'");
      assert(typeof parsed.version === "string" && parsed.version.length > 0, "version should be a non-empty string");
      assert(typeof parsed.name === "string" && parsed.name.length > 0, "name should be a non-empty string");
    }).timeout(10000);
  });

  describe("info --json", () => {
    let exitCode: number | null = null;
    const stdoutLines: string[] = [];
    const stderrLines: string[] = [];

    before(function (done) {
      this.timeout(20000);

      const proc = spawn("node", [
        "./toolbuild/jsn/cli/index.mjs",
        "info",
        "--json",
        "--isolated",
        "--quiet",
        "-i",
        "./../samplecontent/simple/",
      ]);

      collectLines(proc.stdout, stdoutLines);
      collectLines(proc.stderr, stderrLines);

      proc.on("exit", (code) => {
        exitCode = code;
        done();
      });
    });

    it("should exit cleanly", () => {
      assert.notEqual(exitCode, null, "Process should exit");
    }).timeout(20000);

    it("should output a valid JSON object containing schemaVersion, command, and counts", () => {
      const jsonLine = findJsonLine(stdoutLines);
      assert(
        jsonLine,
        "Expected a JSON-starting line in stdout. Got: " + stdoutLines.slice(0, 8).join(" | ")
      );

      const parsed = JSON.parse(jsonLine!);

      assert.equal(parsed.schemaVersion, "1.0.0", "schemaVersion should be '1.0.0'");
      assert.equal(parsed.command, "info", "command should be 'info'");

      assert(parsed.counts && typeof parsed.counts === "object", "counts should be an object");
      assert(typeof parsed.counts.errors === "number", "counts.errors should be a number");
      assert(typeof parsed.counts.warnings === "number", "counts.warnings should be a number");
      assert(typeof parsed.counts.recommendations === "number", "counts.recommendations should be a number");
      assert(typeof parsed.counts.total === "number", "counts.total should be a number");

      assert.equal(
        parsed.counts.total,
        parsed.counts.errors + parsed.counts.warnings + parsed.counts.recommendations,
        "counts.total should equal errors + warnings + recommendations"
      );
    }).timeout(20000);
  });
});
