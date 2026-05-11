/**
 * MultiPackDiscoveryTest - Asserts that Project.inferProjectItemsFromFiles()
 * discovers items across both behavior packs and resource packs in a real
 * multi-pack add-on layout.
 *
 * This is a baseline regression: if the storage walker, manifest detection,
 * or item-type inference breaks for ANY entity-type behavior or pack
 * manifest, this test fails. It exercises the addon/build/content1 sample
 * which is shipped pre-built and contains both a BP (aop_mobsbp) and an RP
 * (aop_mobsrp) with multiple entities.
 */

import { assert } from "chai";
import "../app/Project";
import Project, { ProjectAutoDeploymentMode } from "../app/Project";
import { ProjectItemType } from "../app/IProjectItemData";
import TestPaths, { ITestEnvironment } from "./TestPaths";

let env: ITestEnvironment;

(async () => {
  env = await TestPaths.createTestEnvironment();
})();

describe("multiPackDiscovery", () => {
  let project: Project | null = null;

  before(async function () {
    this.timeout(60000);

    let attempts = 0;
    while (!env && attempts < 100) {
      await new Promise((r) => setTimeout(r, 50));
      attempts++;
    }
    assert(env, "Test environment did not initialise within 5s");

    project = new Project(env.creatorTools, "multiPackDiscovery", null);
    project.autoDeploymentMode = ProjectAutoDeploymentMode.noAutoDeployment;
    project.localFolderPath = TestPaths.sampleContentRoot + "addon/build/content1/Content/";

    await project.inferProjectItemsFromFiles();
  });

  it("should discover at least one behavior pack manifest", () => {
    assert(project, "project should exist");
    const bpManifests = project!.items.filter((i) => i.itemType === ProjectItemType.behaviorPackManifestJson);
    assert(
      bpManifests.length > 0,
      `Expected at least one behaviorPackManifestJson item. Found ${project!.items.length} items total.`
    );
  });

  it("should discover at least one resource pack manifest", () => {
    assert(project, "project should exist");
    const rpManifests = project!.items.filter((i) => i.itemType === ProjectItemType.resourcePackManifestJson);
    assert(
      rpManifests.length > 0,
      `Expected at least one resourcePackManifestJson item. Found ${project!.items.length} items total.`
    );
  });

  it("should discover at least one entity type behavior", () => {
    assert(project, "project should exist");
    const entities = project!.items.filter((i) => i.itemType === ProjectItemType.entityTypeBehavior);
    assert(
      entities.length > 0,
      `Expected at least one entityTypeBehavior item. Found ${project!.items.length} items total.`
    );
  });

  it("should have items spanning multiple item-type categories (BP + RP coverage)", () => {
    assert(project, "project should exist");
    const distinctTypes = new Set(project!.items.map((i) => i.itemType));
    assert(
      distinctTypes.size >= 3,
      `Expected at least 3 distinct ProjectItemType values across BP+RP discovery. Got ${distinctTypes.size}.`
    );
  });
});
