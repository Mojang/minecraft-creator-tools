// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { assert, expect } from "chai";
import "mocha";
import CreatorTools from "../app/CreatorTools";
import Project, { ProjectAutoDeploymentMode } from "../app/Project";
import ProjectItem from "../app/ProjectItem";
import { ProjectItemType } from "../app/IProjectItemData";
import ProjectInfoSet from "../info/ProjectInfoSet";
import { ProjectInfoSuite } from "../info/IProjectInfoData";
import { InfoItemType } from "../info/IInfoItemData";
import CustomDimensionWorldDataInfoGenerator, {
  CustomDimensionWorldDataTest,
} from "../info/CustomDimensionWorldDataInfoGenerator";
import MCWorld from "../minecraft/MCWorld";
import ContentIndex from "../core/ContentIndex";
import TestPaths, { ITestEnvironment } from "./TestPaths";

let creatorTools: CreatorTools | undefined;

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

// Validates the CDWORLDDATA generator that checks LevelDB world data for
// Custom Dimensions marketplace policy compliance (Rules 101–103).
describe("CustomDimensionWorldDataInfoGenerator", () => {
  // The generator ID must be "CDWORLDDATA" — this string is used by Auger's
  // CheckMCToolsValidator to map results to CloudValResult severity levels.
  describe("Generator metadata", () => {
    it("should have correct generator ID", () => {
      const gen = new CustomDimensionWorldDataInfoGenerator();
      expect(gen.id).to.equal("CDWORLDDATA");
    });

    it("should have a title", () => {
      const gen = new CustomDimensionWorldDataInfoGenerator();
      expect(gen.title).to.be.a("string");
      expect(gen.title.length).to.be.greaterThan(0);
    });

    // getTopicData() provides human-readable title and description for each rule.
    // All three rules (101=nameIdMappingTableMissing, 102=vanillaDimensionChunkData,
    // 103=unclaimedDimensionMappings) must have topic data defined.
    it("should return topic data for all defined tests", () => {
      const gen = new CustomDimensionWorldDataInfoGenerator();

      const topic101 = gen.getTopicData(CustomDimensionWorldDataTest.nameIdMappingTableMissing);
      assert(topic101 !== undefined, "Should have topic data for test 101");
      expect(topic101!.title).to.be.a("string");

      const topic102 = gen.getTopicData(CustomDimensionWorldDataTest.vanillaDimensionChunkData);
      assert(topic102 !== undefined, "Should have topic data for test 102");
      expect(topic102!.title).to.be.a("string");

      const topic103 = gen.getTopicData(CustomDimensionWorldDataTest.unclaimedDimensionMappings);
      assert(topic103 !== undefined, "Should have topic data for test 103");
      expect(topic103!.title).to.be.a("string");
    });

    // Unknown topic IDs should return undefined, not throw.
    it("should return undefined for unknown topic IDs", () => {
      const gen = new CustomDimensionWorldDataInfoGenerator();
      expect(gen.getTopicData(999)).to.be.undefined;
    });
  });

  // These indices must stay in sync with the Auger CheckMCToolsValidator config
  // entries (CDWORLDDATA101, CDWORLDDATA102, CDWORLDDATA103).
  describe("Enum values", () => {
    it("should define nameIdMappingTableMissing as 101", () => {
      expect(CustomDimensionWorldDataTest.nameIdMappingTableMissing).to.equal(101);
    });

    it("should define vanillaDimensionChunkData as 102", () => {
      expect(CustomDimensionWorldDataTest.vanillaDimensionChunkData).to.equal(102);
    });

    it("should define unclaimedDimensionMappings as 103", () => {
      expect(CustomDimensionWorldDataTest.unclaimedDimensionMappings).to.equal(103);
    });
  });

  // The generator should only process world-type items (MCWorld, MCTemplate,
  // worldFolder). Non-world items must be skipped with an empty result array.
  describe("Item type filtering", () => {
    it("should return empty for behavior pack items", async () => {
      if (!creatorTools) {
        assert.fail("Not properly initialized");
      }

      const gen = new CustomDimensionWorldDataInfoGenerator();
      const project = new Project(creatorTools, "test", null);
      const item = new ProjectItem(project);
      item.itemType = ProjectItemType.behaviorPackManifestJson;

      const results = await gen.generate(item, new ContentIndex());
      expect(results).to.be.an("array").that.is.empty;
    });

    it("should return empty for resource pack items", async () => {
      if (!creatorTools) {
        assert.fail("Not properly initialized");
      }

      const gen = new CustomDimensionWorldDataInfoGenerator();
      const project = new Project(creatorTools, "test", null);
      const item = new ProjectItem(project);
      item.itemType = ProjectItemType.resourcePackManifestJson;

      const results = await gen.generate(item, new ContentIndex());
      expect(results).to.be.an("array").that.is.empty;
    });
  });

  // summarize() aggregates results across all items into a summary object.
  // With no items generated, summary fields should not be added (conditional summarize).
  describe("Summarize", () => {
    it("should not add summary fields when all counts are zero", () => {
      const gen = new CustomDimensionWorldDataInfoGenerator();
      const info: any = {};
      const project = new Project(creatorTools!, "test", null);
      const pis = new ProjectInfoSet(project, ProjectInfoSuite.defaultInDevelopment);

      gen.summarize(info, pis);

      expect(info.customDimensionErrors).to.be.undefined;
      expect(info.nameIdTableMissing).to.be.undefined;
      expect(info.unclaimedMappings).to.be.undefined;
    });
  });

  // The "comprehensive" sample project is a standard add-on with no LevelDB
  // world data. The CDWORLDDATA generator should produce zero errors/warnings
  // because it only fires on world-type items containing a db/ folder.
  describe("Integration with sample content", () => {
    it("should produce no custom dimension errors for a standard add-on project", async () => {
      const project = await _loadProject("comprehensive");

      const pis = new ProjectInfoSet(project, ProjectInfoSuite.defaultInDevelopment);
      await pis.generateForProject();

      const cdErrors = findInfoItems(pis, "CDWORLDDATA", { itemType: InfoItemType.error });
      const cdWarnings = findInfoItems(pis, "CDWORLDDATA", { itemType: InfoItemType.warning });

      expect(cdErrors).to.be.an("array").that.is.empty;
      expect(cdWarnings).to.be.an("array").that.is.empty;
    }).timeout(30000);
  });
});

// These properties were added to MCWorld to support the CDWORLDDATA generator.
// They are populated during LevelDB processing (processWorldData / buildMinimalWorldIndex).
// A freshly constructed MCWorld should have safe defaults.
describe("MCWorld Custom Dimension Tracking Properties", () => {
  it("should expose dimensionIdsInChunks as a ReadonlySet", () => {
    const mcworld = new MCWorld();
    const ids = mcworld.dimensionIdsInChunks;
    expect(ids).to.be.instanceOf(Set);
    expect(ids.size).to.equal(0);
  });

  // Default false — only set to true when a "DimensionNameIdTable" key is found in LevelDB.
  it("should expose hasDimensionNameIdTable as false by default", () => {
    const mcworld = new MCWorld();
    expect(mcworld.hasDimensionNameIdTable).to.equal(false);
  });

  // Default undefined — only populated after parsing the DimensionNameIdTable NBT data.
  it("should expose dimensionNameIdTable as undefined by default", () => {
    const mcworld = new MCWorld();
    expect(mcworld.dimensionNameIdTable).to.be.undefined;
  });
});
