// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { assert } from "chai";
import CreatorTools from "../app/CreatorTools";
import Project, { ProjectAutoDeploymentMode } from "../app/Project";
import ProjectInfoSet from "../info/ProjectInfoSet";
import { ProjectInfoSuite } from "../info/IProjectInfoData";
import { InfoItemType } from "../info/IInfoItemData";
import TestPaths, { ITestEnvironment } from "./TestPaths";

let creatorTools: CreatorTools | undefined = undefined;

(async () => {
  const env: ITestEnvironment = await TestPaths.createTestEnvironment();
  creatorTools = env.creatorTools;
})();

async function _loadProject(name: string) {
  if (!creatorTools) {
    assert.fail("Not properly initialized");
  }

  const project = new Project(creatorTools, name, null);
  project.autoDeploymentMode = ProjectAutoDeploymentMode.noAutoDeployment;
  project.localFolderPath = TestPaths.sampleContentPath(name);

  await project.inferProjectItemsFromFiles();
  return project;
}

// Helper: find info items by generator ID, optionally filtering by test index and type
function findInfoItems(
  pis: ProjectInfoSet,
  generatorId: string,
  opts?: { testIndex?: number; itemType?: InfoItemType }
) {
  return pis.items.filter((item) => {
    if (item.generatorId !== generatorId) return false;
    if (opts?.testIndex !== undefined && item.generatorIndex !== opts.testIndex) return false;
    if (opts?.itemType !== undefined && item.itemType !== opts.itemType) return false;
    return true;
  });
}

// Helper: assert that at least one error-type info item exists for a generator + test index
function assertHasError(pis: ProjectInfoSet, generatorId: string, testIndex: number, description: string) {
  const errors = findInfoItems(pis, generatorId, { testIndex, itemType: InfoItemType.error });
  assert(
    errors.length > 0,
    `Expected error for ${generatorId} test ${testIndex} (${description}), but found none. ` +
      `All ${generatorId} items: ${findInfoItems(pis, generatorId)
        .map((i) => `[${i.generatorIndex}:${i.typeSummary}]`)
        .join(", ")}`
  );
}

// Helper: assert that NO error or recommendation of a given test index exist
function assertNoErrorOrRecommendation(
  pis: ProjectInfoSet,
  generatorId: string,
  testIndex: number,
  description: string
) {
  const issues = findInfoItems(pis, generatorId, { testIndex }).filter(
    (i) => i.itemType === InfoItemType.error || i.itemType === InfoItemType.recommendation
  );
  assert(
    issues.length === 0,
    `Expected no error/recommendation for ${generatorId} test ${testIndex} (${description}), ` +
      `but found ${issues.length}: ${issues.map((i) => `[${i.typeSummary}: ${i.message}]`).join(", ")}`
  );
}

describe("Current Platform Versions Suite - Outdated BP/RP content", async () => {
  it("flags manifest format_version < 2 as error (CHKMANIF)", async () => {
    const project = await _loadProject("platform_version_errors");

    const pis = new ProjectInfoSet(project, ProjectInfoSuite.currentPlatformVersions);
    await pis.generateForProject();

    // CHKMANIF test 101 = InvalidFormatVersion — should be error for format_version: 1 on non-skin packs
    assertHasError(pis, "CHKMANIF", 101, "manifest format_version < 2");
  });

  it("flags BP min_engine_version minor too low as error (MINENGINEVER)", async () => {
    const project = await _loadProject("platform_version_errors");

    const pis = new ProjectInfoSet(project, ProjectInfoSuite.currentPlatformVersions);
    await pis.generateForProject();

    // MINENGINEVER test 120 = BP min_engine_version minor lower than current
    assertHasError(pis, "MINENGINEVER", 120, "BP min_engine_version minor version too low");
  });

  it("flags RP min_engine_version minor too low as error (MINENGINEVER)", async () => {
    const project = await _loadProject("platform_version_errors");

    const pis = new ProjectInfoSet(project, ProjectInfoSuite.currentPlatformVersions);
    await pis.generateForProject();

    // MINENGINEVER test 220 = RP min_engine_version minor lower than current
    assertHasError(pis, "MINENGINEVER", 220, "RP min_engine_version minor version too low");
  });

  it("produces errors not recommendations for version issues in currentPlatformVersions suite", async () => {
    const project = await _loadProject("platform_version_errors");

    const pis = new ProjectInfoSet(project, ProjectInfoSuite.currentPlatformVersions);
    await pis.generateForProject();

    // In the currentPlatformVersions suite, performPlatformVersionValidations should be true,
    // so version-too-low items must be InfoItemType.error, NOT InfoItemType.recommendation
    const versionGeneratorIds = ["MINENGINEVER", "BASEGAMEVER", "FORMATVER"];

    for (const gId of versionGeneratorIds) {
      const recommendations = findInfoItems(pis, gId, { itemType: InfoItemType.recommendation });

      // If there are any items from this generator, none should be recommendations for
      // "lower than current" checks (those should be errors)
      for (const rec of recommendations) {
        // Recommendation for version-too-low tests would have specific test indices:
        // MINENGINEVER: 110 (BP major low), 120 (BP minor low), 210 (RP major low), 220 (RP minor low)
        // BASEGAMEVER: 110 (major low), 120 (minor low)
        // FORMATVER: uses offset+2 (major low), offset+6 (minor low)
        const lowerVersionTestIds = [110, 120, 210, 220];
        assert(
          !lowerVersionTestIds.includes(rec.generatorIndex),
          `${gId} test ${rec.generatorIndex} should be error in currentPlatformVersions suite, but was recommendation: "${rec.message}"`
        );
      }
    }
  });

  it("same outdated content only produces recommendations in default suite", async () => {
    const project = await _loadProject("platform_version_errors");

    const pis = new ProjectInfoSet(project, ProjectInfoSuite.defaultInDevelopment);
    await pis.generateForProject();

    // In the default suite, performPlatformVersionValidations is false,
    // so "lower than current" checks should be recommendations, not errors
    const minEngineVerErrors = findInfoItems(pis, "MINENGINEVER", { itemType: InfoItemType.error }).filter((i) =>
      [110, 120, 210, 220].includes(i.generatorIndex)
    );

    assert(
      minEngineVerErrors.length === 0,
      `In defaultInDevelopment suite, min_engine_version-too-low should be recommendation, not error. ` +
        `Found ${minEngineVerErrors.length} errors: ${minEngineVerErrors.map((e) => `[${e.generatorIndex}]`).join(", ")}`
    );
  });
});

describe("Current Platform Versions Suite - Good BP/RP content", async () => {
  it("does not flag manifest format_version 2 as error (CHKMANIF)", async () => {
    const project = await _loadProject("platform_version_good");

    const pis = new ProjectInfoSet(project, ProjectInfoSuite.currentPlatformVersions);
    await pis.generateForProject();

    // CHKMANIF test 101 = InvalidFormatVersion — should NOT fire for format_version: 2
    assertNoErrorOrRecommendation(pis, "CHKMANIF", 101, "manifest format_version 2 should be valid");
  });

  it("does not flag current min_engine_version as error (MINENGINEVER)", async () => {
    const project = await _loadProject("platform_version_good");

    const pis = new ProjectInfoSet(project, ProjectInfoSuite.currentPlatformVersions);
    await pis.generateForProject();

    // Neither BP (120) nor RP (220) minor-too-low should fire
    assertNoErrorOrRecommendation(pis, "MINENGINEVER", 120, "BP min_engine_version should be current");
    assertNoErrorOrRecommendation(pis, "MINENGINEVER", 220, "RP min_engine_version should be current");
  });
});

describe("Current Platform Versions Suite - Outdated World Template", async () => {
  it("flags world template manifest format_version < 2 as error (CHKMANIF)", async () => {
    const project = await _loadProject("platform_version_world_errors");

    const pis = new ProjectInfoSet(project, ProjectInfoSuite.currentPlatformVersions);
    await pis.generateForProject();

    // CHKMANIF test 101 = InvalidFormatVersion
    assertHasError(pis, "CHKMANIF", 101, "world template manifest format_version < 2");
  });

  it("flags world template base_game_version minor too low as error (BASEGAMEVER)", async () => {
    const project = await _loadProject("platform_version_world_errors");

    const pis = new ProjectInfoSet(project, ProjectInfoSuite.currentPlatformVersions);
    await pis.generateForProject();

    // BASEGAMEVER test 120 = base_game_version minor lower than current
    assertHasError(pis, "BASEGAMEVER", 120, "base_game_version minor version too low");
  });
});

describe("Current Platform Versions Suite - Suite configuration", async () => {
  it("only includes expected generators in currentPlatformVersions suite", async () => {
    const project = await _loadProject("platform_version_errors");

    const pis = new ProjectInfoSet(project, ProjectInfoSuite.currentPlatformVersions);
    await pis.generateForProject();

    const expectedGeneratorIds = new Set(["MINENGINEVER", "BASEGAMEVER", "FORMATVER", "WORLDDATA", "CHKMANIF"]);

    const actualGeneratorIds = new Set(pis.items.map((item) => item.generatorId));

    for (const gId of actualGeneratorIds) {
      assert(
        expectedGeneratorIds.has(gId),
        `Unexpected generator '${gId}' found in currentPlatformVersions suite results`
      );
    }
  });

  it("currentPlatformVersions suite includes all required generators", async () => {
    const project = await _loadProject("platform_version_errors");

    const pis = new ProjectInfoSet(project, ProjectInfoSuite.currentPlatformVersions);
    await pis.generateForProject();

    const actualGeneratorIds = new Set(pis.items.map((item) => item.generatorId));

    // MINENGINEVER must be present (we have BPs and RPs with min_engine_version)
    assert(actualGeneratorIds.has("MINENGINEVER"), "MINENGINEVER generator should be included in suite results");

    // CHKMANIF must be present (we have manifests to validate)
    assert(actualGeneratorIds.has("CHKMANIF"), "CHKMANIF generator should be included in suite results");

    // FORMATVER must be present (we have content files with format_version)
    assert(actualGeneratorIds.has("FORMATVER"), "FORMATVER generator should be included in suite results");
  });
});
