// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * ReplaceBiomesReportTest — Pins the report contract Auger relies on to find
 * published content that uses `minecraft:replace_biomes` (request 1577195).
 *
 * Auger posts each submitted pack to `mct serve basicwebservices` and indexes
 * `info.biomeBehaviorTypeComponents` from the resulting report as a search
 * facet; the token `minecraftReplaceBiomes` in that list is what makes a pack
 * searchable as "uses replace biomes". These tests run the same default
 * validation suite in-process over shipped samples: two packs whose biome
 * replaces a vanilla biome must carry the token, a pack without biome
 * definitions must not, and the crystal_caverns report is compared against a
 * committed baseline (test/scenarios/validateReplaceBiomesReport/report.json)
 * so any change to the report shape Auger consumes surfaces here.
 */

import { assert, expect } from "chai";
import "mocha";
import CreatorTools from "../app/CreatorTools";
import Project, { ProjectAutoDeploymentMode } from "../app/Project";
import ProjectInfoSet from "../info/ProjectInfoSet";
import ProjectInfoItem from "../info/ProjectInfoItem";
import { JsonFileTagsInfoGeneratorTest } from "../info/projectGenerators/jsonFileTagsInfo/JsonFileTagsInfoData";
import IFolder from "../storage/IFolder";
import TestPaths, { ITestEnvironment } from "./TestPaths";
import { defaultValidationReportExcludedTestIds, ensureReportJsonMatchesScenario } from "./TestUtilities";

const samplesRoot = TestPaths.publicRoot + "res/samples/microsoft/samples/";

const REPLACE_BIOMES_TOKEN = "minecraftReplaceBiomes";

let creatorTools: CreatorTools | undefined;
let scenariosFolder: IFolder | undefined;
let resultsFolder: IFolder | undefined;

/** Validates a shipped sample with the suite Auger's `default`/`all` request runs. */
async function validateSample(sampleRelativePath: string): Promise<ProjectInfoSet> {
  if (!creatorTools) {
    assert.fail("Test environment not initialized");
  }

  const project = new Project(creatorTools, sampleRelativePath, null);
  project.autoDeploymentMode = ProjectAutoDeploymentMode.noAutoDeployment;
  project.localFolderPath = samplesRoot + sampleRelativePath + "/";

  await project.inferProjectItemsFromFiles();

  const pis = new ProjectInfoSet(project, ProjectInfoSet.getSuiteFromString("default"));
  await pis.generateForProject();

  return pis;
}

function biomeBehaviorItems(pis: ProjectInfoSet): ProjectInfoItem[] {
  return pis.getItems("JSONTAGS", JsonFileTagsInfoGeneratorTest.biomeBehaviorType);
}

function biomeTokens(pis: ProjectInfoSet): string[] {
  const info: any = pis.getDataObject().info;
  return info.biomeBehaviorTypeComponents;
}

describe("Replace biomes in the validation report", () => {
  before(async function () {
    this.timeout(60000);

    const env: ITestEnvironment = await TestPaths.createTestEnvironment();
    creatorTools = env.creatorTools;
    scenariosFolder = env.scenariosFolder;
    resultsFolder = env.resultsFolder;
  });

  describe("crystal_caverns, whose biome replaces minecraft:plains", () => {
    let pis: ProjectInfoSet;

    before(async function () {
      this.timeout(60000);
      pis = await validateSample("crystal_caverns");
    });

    it("names minecraftReplaceBiomes among the biome behavior components", () => {
      expect(biomeTokens(pis)).to.deep.equal([
        "minecraftClimate",
        "minecraftOverworldHeight",
        REPLACE_BIOMES_TOKEN,
        "minecraftSurfaceBuilder",
        "minecraftTags",
      ]);
    });

    it("counts the usage on the biome file itself", () => {
      const biomes = biomeBehaviorItems(pis);
      expect(biomes).to.have.length(1);
      expect(biomes[0].projectItemPath).to.match(/biomes\/crystal_caverns\.json$/);
      expect(biomes[0].featureSets?.biomeComponents?.[REPLACE_BIOMES_TOKEN]).to.equal(1);
    });

    it("matches the committed report baseline", async function () {
      this.timeout(60000);
      await ensureReportJsonMatchesScenario(
        scenariosFolder,
        resultsFolder,
        pis.getDataObject(),
        "validateReplaceBiomesReport",
        defaultValidationReportExcludedTestIds
      );
    });
  });

  it("chill_oasis_biome, whose biome replaces minecraft:desert, names the token too", async function () {
    this.timeout(60000);
    const pis = await validateSample("chill_oasis_blocks_and_features/chill_oasis_biome");

    expect(biomeTokens(pis)).to.include(REPLACE_BIOMES_TOKEN);
    expect(biomeBehaviorItems(pis).some((item) => item.featureSets?.biomeComponents?.[REPLACE_BIOMES_TOKEN] === 1)).to
      .be.true;
  });

  it("a pack with no biome definitions reports an empty list", async function () {
    this.timeout(60000);
    const pis = await validateSample("add_entity_robot/min");

    expect(biomeBehaviorItems(pis)).to.have.length(0);
    expect(biomeTokens(pis)).to.deep.equal([]);
  });
});
