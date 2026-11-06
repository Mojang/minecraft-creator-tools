/// <reference types="node" />

import { assert } from "chai";
import * as fs from "fs";
import * as path from "path";
import "../app/Project";
import IProjectInfoData from "../info/IProjectInfoData";
import { InfoItemType } from "../info/IInfoItemData";
import ProjectInfoItem from "../info/ProjectInfoItem";
import ProjectInfoSet from "../info/ProjectInfoSet";
import CliTranscriptHarness from "./CliTranscriptHarness";
import TestPaths from "./TestPaths";
import "./TestDataDir";

function printedChecks(output: Buffer): string[] {
  return output
    .toString("utf8")
    .replace(/\x1b\[[0-9;]*m/g, "")
    .split(/\r?\n/)
    .flatMap((line) => {
      const match = /^\[[^\]]+\] \[[A-Z ]+\] ([A-Z]+: \[[A-Za-z0-9_]+\].*)$/.exec(line);
      return match ? [match[1]] : [];
    });
}

/** The saved report is independent of worker stdout/stderr forwarding. */
function expectedChecks(report: IProjectInfoData): { stdout: string[]; stderr: string[] } {
  const infoSet = new ProjectInfoSet();
  infoSet.info = report.info!;
  const expected = { stdout: [] as string[], stderr: [] as string[] };
  let lastMessage: string | undefined;
  for (const data of report.items!) {
    if (data.iTp === InfoItemType.info || data.iTp === InfoItemType.featureAggregate) {
      continue;
    }
    const item = new ProjectInfoItem(
      data.iTp,
      data.gId,
      data.gIx,
      data.m,
      undefined,
      data.d,
      data.iId,
      data.c,
      data.p ?? undefined
    );
    const message = infoSet.itemToString(item);
    if (message !== lastMessage) {
      const stream =
        data.iTp === InfoItemType.error || data.iTp === InfoItemType.testCompleteFail ? "stderr" : "stdout";
      expected[stream].push(message);
      lastMessage = message;
    }
  }
  return expected;
}

describe("CLI validation worker output", function () {
  let harness: CliTranscriptHarness;

  before(async function () {
    this.timeout(10000);
    harness = await CliTranscriptHarness.create({
      cliRoot: path.resolve(TestPaths.appRoot, "toolbuild/jsn"),
      repoRoot: TestPaths.repoRoot,
      fixtures: [{ name: "project", source: TestPaths.sampleContentPath("platform_version_errors") }],
    });
  });

  after(async () => {
    await harness?.dispose();
  });

  for (const threads of [1, 3]) {
    it(`prints every complete per-check line in 15 built-CLI runs with threads=${threads}`, async function () {
      this.timeout(120000);
      const failures: string[] = [];
      const counts: { iteration: number; stdout: number; stderr: number }[] = [];
      for (let iteration = 0; iteration < 15; iteration++) {
        const run = await harness.run({
          id: `worker-output-${threads}-${iteration}`,
          args: ["validate", "-i", "project", "--threads", String(threads), "--warn-only", "--isolated"],
          timeoutSec: 15,
        });
        assert.isFalse(run.timedOut, "Validation must finish without killing its worker");
        assert.equal(run.exitCode, 0, run.stderr.toString());
        const report: IProjectInfoData = JSON.parse(
          fs.readFileSync(path.join(harness.workFolder, "out", "project.mcr.json"), "utf8")
        );
        assert.isArray(report.items);
        assert.isObject(report.info);
        const expected = expectedChecks(report);
        assert.isAbove(expected.stdout.length, 20, "The fixture must exercise many worker writes");
        assert.isAbove(expected.stderr.length, 0, "The fixture must also exercise stderr");
        counts.push({
          iteration: iteration + 1,
          stdout: printedChecks(run.stdout).length,
          stderr: printedChecks(run.stderr).length,
        });
        for (const stream of ["stdout", "stderr"] as const) {
          const actual = printedChecks(run[stream]);
          if (JSON.stringify(actual) !== JSON.stringify(expected[stream])) {
            failures.push(
              `run ${iteration + 1} ${stream}: expected ${expected[stream].length} complete lines, got ` +
                `${actual.length}; first missing=${expected[stream].find((line) => !actual.includes(line))}`
            );
          }
        }
      }
      const results = path.resolve(TestPaths.testRoot, "results", "cliWorkerValidation");
      fs.mkdirSync(results, { recursive: true });
      fs.writeFileSync(path.join(results, `threads-${threads}.json`), JSON.stringify({ counts, failures }, null, 2));
      assert.deepEqual(failures, []);
    });
  }
});
