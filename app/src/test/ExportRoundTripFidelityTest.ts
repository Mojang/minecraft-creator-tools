/**
 * ExportRoundTripFidelityTest - Round-trip fidelity test for the MCAddon
 * export pipeline.
 *
 * Loads `samplecontent/simple`, runs ProjectExporter.generateMCAddonAsZip(),
 * unzips the result via JSZip, and compares the behavior-pack manifest.json
 * against the source manifest.
 *
 * Pro creators export their projects as .mcaddon and expect bit-for-bit
 * fidelity (or at least JSON-semantic fidelity) on round-trip. Subtle
 * regressions in zip framing, encoding, or pack-folder rewriting can cause
 * silent data loss.
 *
 * Acceptance:
 * - export returns a non-empty Uint8Array
 * - JSZip can load the result
 * - the round-tripped manifest.json parses to a JSON object equivalent to the
 *   source manifest (same field set, same scalar values)
 */

import { assert } from "chai";
import * as fs from "fs";
import JSZip from "jszip";
import "../app/Project";
import Project, { ProjectAutoDeploymentMode } from "../app/Project";
import ProjectExporter from "../app/ProjectExporter";
import TestPaths, { ITestEnvironment } from "./TestPaths";

let env: ITestEnvironment;

(async () => {
  env = await TestPaths.createTestEnvironment({ isLocalNode: true });
})();

const SOURCE_MANIFEST_PATH =
  TestPaths.sampleContentPath("simple") + "behavior_packs/StarterTestsTutorial/manifest.json";

function deepEqualJson(a: unknown, b: unknown, path: string = ""): string | null {
  if (a === b) return null;

  if (typeof a !== typeof b) {
    return `Type mismatch at ${path || "/"}: ${typeof a} vs ${typeof b}`;
  }

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) {
      return `Array mismatch at ${path || "/"}`;
    }
    if (a.length !== b.length) {
      return `Array length mismatch at ${path || "/"}: ${a.length} vs ${b.length}`;
    }
    for (let i = 0; i < a.length; i++) {
      const r = deepEqualJson(a[i], b[i], `${path}[${i}]`);
      if (r) return r;
    }
    return null;
  }

  if (a !== null && b !== null && typeof a === "object" && typeof b === "object") {
    const ak = Object.keys(a as object).sort();
    const bk = Object.keys(b as object).sort();
    if (ak.length !== bk.length) {
      return `Object key-count mismatch at ${path || "/"}: [${ak.join(",")}] vs [${bk.join(",")}]`;
    }
    for (let i = 0; i < ak.length; i++) {
      if (ak[i] !== bk[i]) {
        return `Object key-set mismatch at ${path || "/"}: [${ak.join(",")}] vs [${bk.join(",")}]`;
      }
      const r = deepEqualJson(
        (a as Record<string, unknown>)[ak[i]],
        (b as Record<string, unknown>)[ak[i]],
        `${path}.${ak[i]}`
      );
      if (r) return r;
    }
    return null;
  }

  return `Scalar mismatch at ${path || "/"}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`;
}

describe("exportRoundTripFidelity", () => {
  let zipBytes: Uint8Array | null = null;
  let exportedManifestJson: string | null = null;

  before(async function () {
    this.timeout(180000);

    let attempts = 0;
    while (!env && attempts < 100) {
      await new Promise((r) => setTimeout(r, 50));
      attempts++;
    }
    assert(env, "Test environment did not initialise within 5s");

    const project = new Project(env.creatorTools, "exportRoundTripFidelity", null);
    project.autoDeploymentMode = ProjectAutoDeploymentMode.noAutoDeployment;
    project.localFolderPath = TestPaths.sampleContentPath("simple");
    await project.inferProjectItemsFromFiles();

    const result = await ProjectExporter.generateMCAddonAsZip(env.creatorTools, project, false);
    assert(result instanceof Uint8Array, "Expected MCAddon export to return Uint8Array");
    zipBytes = result as Uint8Array;

    const jsz = await JSZip.loadAsync(zipBytes);
    let manifestEntry: JSZip.JSZipObject | null = null;
    jsz.forEach((relPath, file) => {
      if (relPath.toLowerCase().endsWith("manifest.json") && !file.dir) {
        manifestEntry = manifestEntry ?? file;
      }
    });
    assert(manifestEntry, "Could not locate any manifest.json inside the exported MCAddon zip");
    exportedManifestJson = await (manifestEntry as JSZip.JSZipObject).async("string");
  });

  it("export should produce non-empty zip bytes", () => {
    assert(zipBytes, "zipBytes should not be null");
    assert(zipBytes!.length > 100, "Exported zip should be more than 100 bytes; got " + zipBytes!.length);
  });

  it("round-tripped manifest.json should be JSON-semantically equivalent to the source", () => {
    assert(exportedManifestJson, "Exported manifest.json should be loaded");

    const sourceText = fs.readFileSync(SOURCE_MANIFEST_PATH, "utf-8");
    const sourceParsed = JSON.parse(sourceText);
    const exportedParsed = JSON.parse(exportedManifestJson!);

    const diff = deepEqualJson(sourceParsed, exportedParsed);
    assert.equal(diff, null, "JSON round-trip diff: " + diff);
  });
});
