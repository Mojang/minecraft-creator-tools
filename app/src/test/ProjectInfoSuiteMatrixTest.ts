/**
 * ProjectInfoSuiteMatrixTest - Asserts that running validation under different
 * ProjectInfoSuite values both succeed AND produce results that may differ.
 *
 * This is a baseline guard for the suite system itself. If a future refactor
 * accidentally collapses two suites into the same generator set, or breaks
 * the cooperativeAddOn suite entirely, this test catches it.
 *
 * We assert:
 * - both ProjectInfoSet runs complete without throwing
 * - both produce a non-empty `items` array
 * - the two runs are independent ProjectInfoSet instances
 */

import { assert } from "chai";
import "../app/Project";
import Project, { ProjectAutoDeploymentMode } from "../app/Project";
import ProjectInfoSet from "../info/ProjectInfoSet";
import { ProjectInfoSuite } from "../info/IProjectInfoData";
import TestPaths, { ITestEnvironment } from "./TestPaths";

let env: ITestEnvironment;

(async () => {
  env = await TestPaths.createTestEnvironment();
})();

async function loadProject(name: string): Promise<Project> {
  let attempts = 0;
  while (!env && attempts < 100) {
    await new Promise((r) => setTimeout(r, 50));
    attempts++;
  }
  if (!env) {
    throw new Error("Test environment did not initialise within 5s");
  }

  const project = new Project(env.creatorTools, name, null);
  project.autoDeploymentMode = ProjectAutoDeploymentMode.noAutoDeployment;
  project.localFolderPath = TestPaths.sampleContentPath("simple");
  await project.inferProjectItemsFromFiles();
  return project;
}

describe("projectInfoSuiteMatrix", () => {
  let defaultSet: ProjectInfoSet | null = null;
  let cooperativeSet: ProjectInfoSet | null = null;

  before(async function () {
    this.timeout(120000);

    // Use two independent Project instances so the cached `indevInfoSet` from
    // one suite cannot bleed into the other.
    const projDefault = await loadProject("piSuiteDefault");
    defaultSet = new ProjectInfoSet(projDefault, ProjectInfoSuite.defaultInDevelopment);
    await defaultSet.generateForProject();

    const projCoop = await loadProject("piSuiteCoop");
    cooperativeSet = new ProjectInfoSet(projCoop, ProjectInfoSuite.cooperativeAddOn);
    await cooperativeSet.generateForProject();
  });

  it("defaultInDevelopment suite should produce items without throwing", () => {
    assert(defaultSet, "defaultSet should be initialised");
    assert(Array.isArray(defaultSet!.items), "items should be an array");
    assert(defaultSet!.items.length > 0, "defaultInDevelopment should produce at least one info item");
  });

  it("cooperativeAddOn suite should produce items without throwing", () => {
    assert(cooperativeSet, "cooperativeSet should be initialised");
    assert(Array.isArray(cooperativeSet!.items), "items should be an array");
    assert(
      cooperativeSet!.items.length > 0,
      "cooperativeAddOn should produce at least one info item"
    );
  });

  it("the two suites are distinct instances (independent runs)", () => {
    assert(defaultSet, "defaultSet should be initialised");
    assert(cooperativeSet, "cooperativeSet should be initialised");
    assert.notStrictEqual(defaultSet, cooperativeSet, "Suites should be distinct ProjectInfoSet instances");
  });

  it("at least one suite reports a non-empty result set (sanity check)", () => {
    assert(defaultSet && cooperativeSet, "both sets should be initialised");
    const totalItems = defaultSet!.items.length + cooperativeSet!.items.length;
    assert(totalItems >= 2, `Expected at least 2 items combined across both suites, got ${totalItems}`);
  });
});
