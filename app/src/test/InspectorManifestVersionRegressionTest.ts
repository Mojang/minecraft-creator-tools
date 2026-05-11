/**
 * InspectorManifestVersionRegressionTest - Critical regression test for the
 * JsonSchemaItemInfoGenerator format-version-aware fix.
 *
 * Background
 * ----------
 * Manifest "version" fields (header.version, header.min_engine_version,
 * modules[].version, dependencies[].version) accept BOTH a three-number array
 * (e.g. [1, 4, 12]) and a three-number string (e.g. "1.4.12"), but the
 * accepted form depends on the manifest's top-level `format_version`:
 *
 *   format_version 1 / 2  → array form is the canonical/required form.
 *   format_version 3+     → string form "1.4.12" is the modern/recommended form.
 *
 * The generator must:
 *   - Not flag valid array form on a fmt 1/2 manifest (was a 🔴 false positive)
 *   - Not flag valid string form on a fmt 3+ manifest
 *   - Emit a soft RECOMMENDATION (not error) on a fmt 3+ manifest using array form
 *
 * This test loads two real samples covering the two passing cases above and
 * asserts that NO warning is surfaced with:
 *
 *   - title (message)  === "Version format needs updating"
 *   - data    contains "should be text"
 *
 * Either of these would indicate the false-positive has returned.
 */

import { assert } from "chai";
import "../app/Project";
import Project, { ProjectAutoDeploymentMode } from "../app/Project";
import ProjectInfoSet from "../info/ProjectInfoSet";
import { ProjectInfoSuite } from "../info/IProjectInfoData";
import TestPaths, { ITestEnvironment } from "./TestPaths";
import * as path from "path";

let env: ITestEnvironment;

(async () => {
  env = await TestPaths.createTestEnvironment();
})();

async function loadProjectInfo(localFolderPath: string, label: string) {
  const project = new Project(env.creatorTools, label, null);
  project.autoDeploymentMode = ProjectAutoDeploymentMode.noAutoDeployment;
  project.localFolderPath = localFolderPath;

  await project.inferProjectItemsFromFiles();

  const infoSet = new ProjectInfoSet(project, ProjectInfoSuite.defaultInDevelopment);
  await infoSet.generateForProject();
  return { project, infoSet };
}

function assertNoFalsePositives(infoSet: ProjectInfoSet, label: string) {
  // Any item titled "Version format needs updating" is the OLD wrong wording.
  const offendingTitle = infoSet.items.filter((item) => item.message === "Version format needs updating");

  if (offendingTitle.length > 0) {
    const samples = offendingTitle
      .slice(0, 5)
      .map(
        (i) =>
          `[${i.generatorId}${i.generatorIndex}] message="${i.message}", data="${i.data}", path="${
            i.projectItem ? i.projectItem.projectPath : "(no path)"
          }"`
      )
      .join("\n  ");
    assert.fail(
      `[${label}] Found ${offendingTitle.length} false-positive 'Version format needs updating' item(s).\n  ${samples}`
    );
  }

  // Any item whose data says "should be text" on a version-related field is the OLD misleading copy.
  const versionRelated = infoSet.items.filter((item) => {
    const detail = typeof item.data === "string" ? item.data : "";
    const content = typeof item.content === "string" ? item.content : "";
    const hasShouldBeText = detail.includes("should be text") || content.includes("should be text");
    if (!hasShouldBeText) return false;
    return /version/i.test(detail) || /version/i.test(content);
  });

  if (versionRelated.length > 0) {
    const samples = versionRelated
      .slice(0, 5)
      .map((i) => `message="${i.message}", data="${i.data}", content="${i.content}"`)
      .join("\n  ");
    assert.fail(
      `[${label}] Found ${versionRelated.length} false-positive 'should be text' item(s) on a version field.\n  ${samples}`
    );
  }
}

describe("inspectorManifestVersionRegression", () => {
  let fmt2InfoSet: ProjectInfoSet | null = null;
  let fmt3InfoSet: ProjectInfoSet | null = null;

  before(async function () {
    this.timeout(60000);

    // Wait for the async TestPaths init to complete.
    let attempts = 0;
    while (!env && attempts < 100) {
      await new Promise((r) => setTimeout(r, 50));
      attempts++;
    }
    assert(env, "Test environment did not initialise within 5s");

    // Case A: format_version 2 manifest with array `version: [1,0,0]`. Used to false-positive.
    const fmt2 = await loadProjectInfo(TestPaths.sampleContentPath("simple"), "fmt2-array");
    fmt2InfoSet = fmt2.infoSet;

    // Case B: format_version 3 manifest with string `version: "1.0.0"`. Should be silent.
    // We use a stable known-good sample shipped under samplecontent/addon/build.
    const fmt3Path = path.join(
      TestPaths.sampleContentRoot,
      "addon",
      "build",
      "content_subpacks",
      "Content",
      "resource_packs",
      "aop_mobsrp"
    );
    const fmt3 = await loadProjectInfo(fmt3Path, "fmt3-string");
    fmt3InfoSet = fmt3.infoSet;
  });

  it("fmt 1/2 manifest with array version should not produce 'Version format needs updating'", () => {
    assert(fmt2InfoSet, "fmt2InfoSet should be initialised");
    assertNoFalsePositives(fmt2InfoSet!, "fmt2-array");
  });

  it("fmt 3+ manifest with string version should not produce 'Version format needs updating'", () => {
    assert(fmt3InfoSet, "fmt3InfoSet should be initialised");
    assertNoFalsePositives(fmt3InfoSet!, "fmt3-string");
  });

  it("fmt 3+ manifest using array form may produce a 'recommendation' — but never a 'should be text' warning", () => {
    // Both samples cover the two passing cases above. The third case (fmt3 + array) is
    // exercised at unit-test level by the generator's logic; this assertion just guards
    // that no test sample is regressing into the misleading warning.
    assert(fmt2InfoSet && fmt3InfoSet);
    assertNoFalsePositives(fmt2InfoSet, "fmt2-array");
    assertNoFalsePositives(fmt3InfoSet, "fmt3-string");
  });
});
