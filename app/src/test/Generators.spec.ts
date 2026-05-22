// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Unit tests for validation system
 *
 * Tests Generator validation without snapshot comparisons.
 * Uses structured assertions to verify specific validation results.
 *
 *
 * These are largely intended to bridge the gap between the older, snapshot-based tests and newer tests
 * by maintaining the some of the strictness of the older tests by checking for an exact count
 * Ultimately these tests should be removed in favor of targeted tests once there is more confidence in that system.
 *
 */

import { expect, assert } from "chai";
import CreatorTools from "../app/CreatorTools";
import Project, { ProjectAutoDeploymentMode } from "../app/Project";
import ProjectInfoSet from "../info/ProjectInfoSet";
import { ProjectInfoSuite } from "../info/IProjectInfoData";
import { InfoItemType } from "../info/IInfoItemData";
import TestPaths, { ITestEnvironment } from "./TestPaths";

let creatorTools: CreatorTools | undefined = undefined;

// Timeout for before() hooks that run full project validation
const VALIDATION_TIMEOUT = 6000; // comprehensive project with many content types
const SIMPLE_VALIDATION_TIMEOUT = 3000; // small sample content (content1/2/3, single-pack projects)

// Expected validation item counts per InfoItemType - update these when validation logic changes
const EXPECTED_COUNTS = {
  // Well-Formed Content (content1 / cooperativeAddOn)
  content1: {
    testPassItems: 7,
  },

  // Animation Manifest Errors (content2 / cooperativeAddOn)
  content2: {
    errors: 16,
    manifestErrors: 2,
  },

  // Extraneous Content (content3 / cooperativeAddOn)
  content3: {
    testCompleteFail: 3,
    testCompleteSuccess: 4,
    error: 7,
    recommendation: 1,
    featureAggregate: 11,
  },

  // Platform Versions Suite (content3 / currentPlatformVersions)
  content3Platform: {
    testCompleteFail: 2,
    testCompleteSuccess: 2,
    error: 15,
    featureAggregate: 4,
    testCompleteNoApplicableItemsFound: 1,
  },

  // Comprehensive Content (comprehensive / defaultInDevelopment)
  comprehensive: {
    testCompleteFail: 1,
    testCompleteSuccess: 39,
    error: 2,
    warning: 16,
    recommendation: 15,
    featureAggregate: 65,
    testCompleteNoApplicableItemsFound: 10,
    generatorCount: 50,
  },

  // Behavior Pack Only (behavior_pack_only / defaultInDevelopment)
  behaviorPackOnly: {
    testCompleteFail: 1,
    testCompleteSuccess: 36,
    error: 1,
    recommendation: 2,
    featureAggregate: 33,
    testCompleteNoApplicableItemsFound: 13,
  },

  // Resource Pack Only (resource_pack_only / defaultInDevelopment)
  resourcePackOnly: {
    error: 1,
  },

  // Spawn Rules (spawnRulesDependency / defaultInDevelopment)
  spawnRules: {
    testCompleteFail: 1,
    testCompleteSuccess: 37,
    error: 1,
    recommendation: 3,
    featureAggregate: 34,
    testCompleteNoApplicableItemsFound: 12,
  },
};

before(async function () {
  this.timeout(VALIDATION_TIMEOUT);
  const env: ITestEnvironment = await TestPaths.createTestEnvironment();
  creatorTools = env.creatorTools;
});

function countByType(pis: ProjectInfoSet, type: InfoItemType): number {
  return pis.items.filter((item) => item.itemType === type).length;
}

async function loadProject(name: string): Promise<Project> {
  if (!creatorTools) {
    assert.fail("Test environment not initialized");
  }

  const project = new Project(creatorTools, name, null);
  project.autoDeploymentMode = ProjectAutoDeploymentMode.noAutoDeployment;
  project.localFolderPath = TestPaths.sampleContentPath(name);

  await project.inferProjectItemsFromFiles();
  return project;
}

describe("Generators - Well-Formed Content", () => {
  let pis: ProjectInfoSet;

  before(async function () {
    this.timeout(SIMPLE_VALIDATION_TIMEOUT);
    const project = await loadProject("addon/build/content1");
    pis = new ProjectInfoSet(project, ProjectInfoSuite.cooperativeAddOn);
    await pis.generateForProject();
  });

  it("should have no errors for well-formed addon (content1)", () => {
    const errors = pis.items.filter(
      (item) => item.itemType === InfoItemType.error || item.itemType === InfoItemType.internalProcessingError
    );
    expect(errors.length).to.equal(0, `Expected no errors, found: ${errors.map((e) => e.message).join(", ")}`);
  });

  it("should generate test completion items for content1", () => {
    const testPassItems = pis.items.filter((item) => item.itemType === InfoItemType.testCompleteSuccess);
    expect(testPassItems.length).to.equal(
      EXPECTED_COUNTS.content1.testPassItems,
      `Expected ${EXPECTED_COUNTS.content1.testPassItems} test completion items for well-formed content`
    );
  });

  it("should calculate errorFailWarnCount correctly for content1", () => {
    expect(pis.errorFailWarnCount).to.equal(0, "Well-formed content should have no errors or warnings");
  });
});

describe("Generators - Animation Manifest Errors", () => {
  let pis: ProjectInfoSet;

  before(async function () {
    this.timeout(SIMPLE_VALIDATION_TIMEOUT);
    const project = await loadProject("addon/build/content2");
    pis = new ProjectInfoSet(project, ProjectInfoSuite.cooperativeAddOn);
    await pis.generateForProject();
  });

  it("should detect manifest errors in content2", () => {
    const errors = pis.items.filter((item) => item.itemType === InfoItemType.error);
    expect(errors.length).to.equal(
      EXPECTED_COUNTS.content2.errors,
      `Expected ${EXPECTED_COUNTS.content2.errors} validation errors in content2`
    );
  });

  it("should include manifest-related errors for content2", () => {
    const manifestErrors = pis.items.filter(
      (item) =>
        item.itemType === InfoItemType.error &&
        (item.message?.toLowerCase().includes("manifest") || item.projectItem?.name?.includes("manifest"))
    );

    expect(manifestErrors.length).to.equal(
      EXPECTED_COUNTS.content2.manifestErrors,
      `Expected ${EXPECTED_COUNTS.content2.manifestErrors} manifest-related errors`
    );
  });
});

describe("Generators - Extraneous Content", () => {
  let pis: ProjectInfoSet;

  before(async function () {
    this.timeout(SIMPLE_VALIDATION_TIMEOUT);
    const project = await loadProject("addon/build/content3");
    pis = new ProjectInfoSet(project, ProjectInfoSuite.cooperativeAddOn);
    await pis.generateForProject();
  });

  it("should validate content3 (may have warnings)", () => {
    const expectedResults = EXPECTED_COUNTS.content3;
    expect(countByType(pis, InfoItemType.testCompleteFail)).to.equal(expectedResults.testCompleteFail);
    expect(countByType(pis, InfoItemType.testCompleteSuccess)).to.equal(expectedResults.testCompleteSuccess);
    expect(countByType(pis, InfoItemType.error)).to.equal(expectedResults.error);
    expect(countByType(pis, InfoItemType.recommendation)).to.equal(expectedResults.recommendation);
    expect(countByType(pis, InfoItemType.featureAggregate)).to.equal(expectedResults.featureAggregate);
  });
});

describe("Generators - Comprehensive Content", () => {
  let pis: ProjectInfoSet;

  before(async function () {
    this.timeout(VALIDATION_TIMEOUT);
    const project = await loadProject("comprehensive");
    pis = new ProjectInfoSet(project, ProjectInfoSuite.defaultInDevelopment);
    await pis.generateForProject();
  });

  it("should validate comprehensive project with all content types", () => {
    const expectedResults = EXPECTED_COUNTS.comprehensive;
    expect(countByType(pis, InfoItemType.testCompleteFail)).to.equal(expectedResults.testCompleteFail);
    expect(countByType(pis, InfoItemType.testCompleteSuccess)).to.equal(expectedResults.testCompleteSuccess);
    expect(countByType(pis, InfoItemType.error)).to.equal(expectedResults.error);
    expect(countByType(pis, InfoItemType.warning)).to.equal(expectedResults.warning);
    expect(countByType(pis, InfoItemType.recommendation)).to.equal(expectedResults.recommendation);
    expect(countByType(pis, InfoItemType.featureAggregate)).to.equal(expectedResults.featureAggregate);
    expect(countByType(pis, InfoItemType.testCompleteNoApplicableItemsFound)).to.equal(
      expectedResults.testCompleteNoApplicableItemsFound
    );
  });

  it("should track validation by generator ID", () => {
    const generatorIds = new Set(pis.items.map((item) => item.generatorId));
    expect(generatorIds.size).to.equal(
      EXPECTED_COUNTS.comprehensive.generatorCount,
      `Expected ${EXPECTED_COUNTS.comprehensive.generatorCount} unique generator IDs`
    );
  });
});

describe("Generators - Data Object Export", () => {
  let pis: ProjectInfoSet;

  before(async function () {
    this.timeout(SIMPLE_VALIDATION_TIMEOUT);
    const project = await loadProject("addon/build/content1");
    pis = new ProjectInfoSet(project, ProjectInfoSuite.cooperativeAddOn);
    await pis.generateForProject();
  });

  it("should export data object with required fields", () => {
    const dataObject = pis.getDataObject();

    expect(dataObject).to.have.property("items");
    expect(dataObject.items).to.be.an("array");
    expect(dataObject).to.have.property("info");

    if (dataObject.items) {
      for (const item of dataObject.items) {
        expect(item).to.have.property("iTp"); // itemType

        // Message may be omitted for summary/path-only items; when present, it should be a string
        if ("m" in item && !!item.m) {
          expect(item.m).to.be.a("string");
        }
      }
    }
  });
});

describe("Generators - Platform Versions Suite", () => {
  let pis: ProjectInfoSet;

  before(async function () {
    this.timeout(SIMPLE_VALIDATION_TIMEOUT);
    const project = await loadProject("addon/build/content3");
    pis = new ProjectInfoSet(project, ProjectInfoSuite.currentPlatformVersions);
    await pis.generateForProject();
  });

  it("should run currentplatform suite on content3", () => {
    const expectedResults = EXPECTED_COUNTS.content3Platform;
    expect(countByType(pis, InfoItemType.testCompleteFail)).to.equal(expectedResults.testCompleteFail);
    expect(countByType(pis, InfoItemType.testCompleteSuccess)).to.equal(expectedResults.testCompleteSuccess);
    expect(countByType(pis, InfoItemType.error)).to.equal(expectedResults.error);
    expect(countByType(pis, InfoItemType.featureAggregate)).to.equal(expectedResults.featureAggregate);
    expect(countByType(pis, InfoItemType.testCompleteNoApplicableItemsFound)).to.equal(
      expectedResults.testCompleteNoApplicableItemsFound
    );
  });
});

describe("Generators - Behavior Pack Only", () => {
  let pis: ProjectInfoSet;

  before(async function () {
    this.timeout(SIMPLE_VALIDATION_TIMEOUT);
    const project = await loadProject("behavior_pack_only");
    pis = new ProjectInfoSet(project, ProjectInfoSuite.defaultInDevelopment);
    await pis.generateForProject();
  });

  it("should validate behavior pack only content", () => {
    const expectedResults = EXPECTED_COUNTS.behaviorPackOnly;
    expect(countByType(pis, InfoItemType.testCompleteFail)).to.equal(expectedResults.testCompleteFail);
    expect(countByType(pis, InfoItemType.testCompleteSuccess)).to.equal(expectedResults.testCompleteSuccess);
    expect(countByType(pis, InfoItemType.error)).to.equal(expectedResults.error);
    expect(countByType(pis, InfoItemType.recommendation)).to.equal(expectedResults.recommendation);
    expect(countByType(pis, InfoItemType.featureAggregate)).to.equal(expectedResults.featureAggregate);
    expect(countByType(pis, InfoItemType.testCompleteNoApplicableItemsFound)).to.equal(
      expectedResults.testCompleteNoApplicableItemsFound
    );
  });
});

describe("Generators - Resource Pack Only", () => {
  let pis: ProjectInfoSet;

  before(async function () {
    this.timeout(SIMPLE_VALIDATION_TIMEOUT);
    const project = await loadProject("resource_pack_only");
    pis = new ProjectInfoSet(project, ProjectInfoSuite.defaultInDevelopment);
    await pis.generateForProject();
  });

  it("should validate resource pack only content", () => {
    // resource_pack_only has 1 known error: missing pack_icon .png file
    const errors = pis.items.filter((item) => item.itemType === InfoItemType.error);
    expect(errors.length).to.equal(
      EXPECTED_COUNTS.resourcePackOnly.error,
      `Expected ${EXPECTED_COUNTS.resourcePackOnly.error} error(s), found: ${errors.map((e) => e.message).join(", ")}`
    );
  });
});

describe("Generators - Spawn Rules", () => {
  let pis: ProjectInfoSet;

  before(async function () {
    this.timeout(SIMPLE_VALIDATION_TIMEOUT);
    const project = await loadProject("spawnRulesDependency");
    pis = new ProjectInfoSet(project, ProjectInfoSuite.defaultInDevelopment);
    await pis.generateForProject();
  });

  it("should validate spawn rules dependencies", () => {
    const expectedResults = EXPECTED_COUNTS.spawnRules;
    expect(countByType(pis, InfoItemType.testCompleteFail)).to.equal(expectedResults.testCompleteFail);
    expect(countByType(pis, InfoItemType.testCompleteSuccess)).to.equal(expectedResults.testCompleteSuccess);
    expect(countByType(pis, InfoItemType.error)).to.equal(expectedResults.error);
    expect(countByType(pis, InfoItemType.recommendation)).to.equal(expectedResults.recommendation);
    expect(countByType(pis, InfoItemType.featureAggregate)).to.equal(expectedResults.featureAggregate);
    expect(countByType(pis, InfoItemType.testCompleteNoApplicableItemsFound)).to.equal(
      expectedResults.testCompleteNoApplicableItemsFound
    );
  });
});
