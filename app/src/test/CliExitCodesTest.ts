/**
 * CliExitCodesTest - Table-driven assertions that several failure scenarios
 * produce non-zero exit codes (and, where applicable, a specific message
 * substring on stderr or stdout).
 *
 * Pro users in CI rely on exit codes for build-script branching. Any change
 * that silently turns a failure into a success (exit 0) would be a high-impact
 * regression.
 */

import { assert } from "chai";
import { spawn } from "child_process";
import "../app/Project";
import { collectLines } from "./CommandLineTestHelpers";

interface ICase {
  name: string;
  args: string[];
  /** Substring expected somewhere in stderr OR stdout (case-insensitive). Optional. */
  expectIn?: string;
  /** If provided, exit code must equal this. Otherwise we only assert non-zero. */
  expectExit?: number;
  /** If true, allow exit code 0 (test only verifies the command runs & message appears). */
  allowZero?: boolean;
}

const cases: ICase[] = [
  {
    name: "validate addon with missing input folder",
    args: ["validate", "addon", "-i", "./does-not-exist", "--isolated", "--quiet"],
    expectIn: "does not exist",
  },
  {
    name: "unknown top-level command",
    args: ["unknown-command-zzz"],
  },
  {
    name: "add --yes with no type argument",
    args: ["add", "--yes"],
    expectIn: "type",
  },
];

describe("cliExitCodes", () => {
  for (const c of cases) {
    describe(c.name, () => {
      let exitCode: number | null = null;
      const stdoutLines: string[] = [];
      const stderrLines: string[] = [];

      before(function (done) {
        this.timeout(20000);

        const proc = spawn("node", ["./toolbuild/jsn/cli/index.mjs", ...c.args]);

        collectLines(proc.stdout, stdoutLines);
        collectLines(proc.stderr, stderrLines);

        proc.on("exit", (code) => {
          exitCode = code;
          done();
        });
      });

      it("should exit with the expected non-zero code", () => {
        assert.notEqual(exitCode, null, "Process should exit");

        if (c.allowZero !== true) {
          if (c.expectExit !== undefined) {
            assert.equal(exitCode, c.expectExit, `Exit code should be ${c.expectExit}, was ${exitCode}`);
          } else {
            assert.notEqual(exitCode, 0, "Exit code should be non-zero. stderr: " + stderrLines.join("\n"));
          }
        }
      }).timeout(20000);

      if (c.expectIn) {
        it(`should mention "${c.expectIn}" in stderr or stdout`, () => {
          const all = (stderrLines.join("\n") + "\n" + stdoutLines.join("\n")).toLowerCase();
          assert(
            all.includes(c.expectIn!.toLowerCase()),
            `Expected output to mention "${c.expectIn}". Got stderr: ${stderrLines.join(
              " | "
            )} | stdout: ${stdoutLines.slice(0, 10).join(" | ")}`
          );
        }).timeout(20000);
      }
    });
  }
});
