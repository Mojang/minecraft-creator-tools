/**
 * CliTestRunnerNamesTest - `mct` must run the requested command whatever its arguments contain
 * and whatever NODE_ENV is set to.
 *
 * Skipping a command is silent: nothing is printed and the exit code is 0. A CI job that validates
 * a broken add-on in a folder such as ./my-jest-addon would then pass without validating anything.
 * Test-runner names turn up in real paths, and Jest and Vitest set NODE_ENV=test by default, which
 * `mct` inherits when a test starts it.
 *
 * Each case validates its own copy of a sample add-on and must give the same exit code and the same
 * report items as a copy in an ordinary folder. One sample fails validation, so a skipped run can't
 * pass by matching an exit code of 0.
 */

import { assert } from "chai";
import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import "../app/Project";
import { collectLines } from "./CommandLineTestHelpers";
import TestPaths from "./TestPaths";

const RESULT_FOLDER = path.join(TestPaths.testRoot, "results", "cliTestRunnerNames");

interface ISample {
  name: string;
  failsValidation: boolean;
}

interface IVariant {
  description: string;
  folderName: string;
  env?: NodeJS.ProcessEnv;
}

interface IValidateRun {
  exitCode: number | null;
  /** Items from the .mcr.json report, serialized and sorted. Undefined when no report was written. */
  reportItems?: string[];
  output: string;
}

const SAMPLES: ISample[] = [
  { name: "simple", failsValidation: false },
  { name: "platform_version_errors", failsValidation: true },
];

const VARIANTS: IVariant[] = [
  { description: "a folder name containing 'jest'", folderName: "my-jest-addon" },
  { description: "a folder name containing 'mocha'", folderName: "my-mocha-addon" },
  { description: "a folder name containing 'vitest'", folderName: "my-vitest-addon" },
  { description: "NODE_ENV=test", folderName: "node-env-addon", env: { NODE_ENV: "test" } },
];

async function validateCopy(sampleName: string, folderName: string, env?: NodeJS.ProcessEnv): Promise<IValidateRun> {
  const inputFolder = path.join(RESULT_FOLDER, sampleName, folderName);
  const outputFolder = inputFolder + "-report";

  // Start clean, so a report left by an earlier run can't stand in for this run's report.
  fs.rmSync(inputFolder, { recursive: true, force: true });
  fs.rmSync(outputFolder, { recursive: true, force: true });
  fs.cpSync(TestPaths.sampleContentPath(sampleName), inputFolder, { recursive: true });

  const proc = spawn(
    "node",
    ["./toolbuild/jsn/cli/index.mjs", "validate", "-i", inputFolder, "-o", outputFolder, "--isolated"],
    { env: { ...process.env, ...env } }
  );

  const outputLines: string[] = [];
  collectLines(proc.stdout, outputLines);
  collectLines(proc.stderr, outputLines);

  const exitCode = await new Promise<number | null>((resolve) => proc.on("close", (code) => resolve(code)));

  const reportFile = fs.existsSync(outputFolder)
    ? fs.readdirSync(outputFolder).find((fileName) => fileName.endsWith(".mcr.json"))
    : undefined;

  let reportItems: string[] | undefined;

  if (reportFile) {
    const report = JSON.parse(fs.readFileSync(path.join(outputFolder, reportFile), "utf8"));
    reportItems = (report.items as object[]).map((item) => JSON.stringify(item)).sort();
  }

  return { exitCode, reportItems, output: outputLines.join("\n") };
}

describe("cliTestRunnerNames", () => {
  for (const sample of SAMPLES) {
    describe("validate " + sample.name, () => {
      let ordinary: IValidateRun;

      before(async function () {
        this.timeout(60000);

        ordinary = await validateCopy(sample.name, "my-addon");
      });

      it("writes a report for a copy in an ordinary folder", () => {
        assert.isDefined(ordinary.reportItems, "Expected a .mcr.json report. Output:\n" + ordinary.output);
        assert.isNotEmpty(ordinary.reportItems);

        if (sample.failsValidation) {
          assert.notEqual(ordinary.exitCode, 0, "This sample should fail validation. Output:\n" + ordinary.output);
        }
      });

      for (const variant of VARIANTS) {
        it("gives the same exit code and report for " + variant.description, async function () {
          this.timeout(60000);

          const run = await validateCopy(sample.name, variant.folderName, variant.env);

          assert.equal(
            run.exitCode,
            ordinary.exitCode,
            "Exit code differs from the ordinary folder's. Output:\n" + run.output
          );
          assert.deepEqual(run.reportItems, ordinary.reportItems, "Report differs from the ordinary folder's");
        });
      }
    });
  }
});
