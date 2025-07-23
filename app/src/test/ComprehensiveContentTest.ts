// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { expect, assert } from "chai";
import Carto from "../app/Carto";
import Project, { ProjectAutoDeploymentMode } from "../app/Project";
import CartoApp, { HostType } from "../app/CartoApp";
import NodeStorage from "../local/NodeStorage";
import Database from "../minecraft/Database";
import LocalEnvironment from "../local/LocalEnvironment";
import ProjectInfoSet from "../info/ProjectInfoSet";
import { ProjectInfoSuite } from "../info/IProjectInfoData";
import IFolder from "../storage/IFolder";
import { ProjectItemType } from "../app/IProjectItemData";
import { ensureReportJsonMatchesScenario } from "./TestUtilities";

CartoApp.hostType = HostType.testLocal;

let carto: Carto | undefined = undefined;
let localEnv: LocalEnvironment | undefined = undefined;
let scenariosFolder: IFolder | undefined = undefined;
let resultsFolder: IFolder | undefined = undefined;

localEnv = new LocalEnvironment(false);

(async () => {
  CartoApp.localFolderExists = _localFolderExists;
  CartoApp.ensureLocalFolder = _ensureLocalFolder;

  const scenariosStorage = new NodeStorage(
    NodeStorage.ensureEndsWithDelimiter(__dirname) + "/../../test/",
    "scenarios"
  );

  scenariosFolder = scenariosStorage.rootFolder;
  await scenariosFolder.ensureExists();

  const resultsStorage = new NodeStorage(NodeStorage.ensureEndsWithDelimiter(__dirname) + "/../../test/", "results");
  resultsFolder = resultsStorage.rootFolder;
  await resultsFolder.ensureExists();

  CartoApp.prefsStorage = new NodeStorage(
    localEnv.utilities.testWorkingPath + "prefs" + NodeStorage.platformFolderDelimiter,
    ""
  );

  CartoApp.projectsStorage = new NodeStorage(
    localEnv.utilities.testWorkingPath + "projects" + NodeStorage.platformFolderDelimiter,
    ""
  );

  CartoApp.packStorage = new NodeStorage(
    localEnv.utilities.testWorkingPath + "packs" + NodeStorage.platformFolderDelimiter,
    ""
  );

  CartoApp.worldStorage = new NodeStorage(
    localEnv.utilities.testWorkingPath + "worlds" + NodeStorage.platformFolderDelimiter,
    ""
  );

  CartoApp.deploymentStorage = new NodeStorage(
    localEnv.utilities.testWorkingPath + "deployment" + NodeStorage.platformFolderDelimiter,
    ""
  );
  CartoApp.workingStorage = new NodeStorage(
    localEnv.utilities.testWorkingPath + "working" + NodeStorage.platformFolderDelimiter,
    ""
  );

  const coreStorage = new NodeStorage(__dirname + "/../../public/data/content/", "");
  Database.contentFolder = coreStorage.rootFolder;

  await CartoApp.init();
  carto = CartoApp.carto;

  if (!carto) {
    return;
  }

  await carto.load();

  Database.local = localEnv.utilities;
  carto.local = localEnv.utilities;
})();

function _ensureLocalFolder(path: string) {
  const ls = new NodeStorage(path, "");
  return ls.rootFolder;
}

async function _localFolderExists(path: string) {
  const ls = new NodeStorage(path, "");
  return await ls.rootFolder.exists();
}

async function _loadProject(name: string) {
  if (!carto || !scenariosFolder || !resultsFolder) {
    assert.fail("Not properly initialized");
  }

  const project = new Project(carto, name, null);
  project.autoDeploymentMode = ProjectAutoDeploymentMode.noAutoDeployment;
  project.localFolderPath = __dirname + "/../../../samplecontent/" + name + "/";

  await project.inferProjectItemsFromFiles();
  return project;
}

describe("Comprehensive Content Types", async () => {
  it("loads comprehensive project with all content types", async () => {
    const project = await _loadProject("comprehensive");

    // Should have multiple types of content
    expect(project.items.length).to.be.greaterThan(10);

    // Check for different content types
    const itemTypes = project.items.map((item) => item.itemType);
    expect(itemTypes).to.include(ProjectItemType.behaviorPackManifestJson);
    expect(itemTypes).to.include(ProjectItemType.resourcePackManifestJson);
    expect(itemTypes).to.include(ProjectItemType.entityTypeBehavior);
    expect(itemTypes).to.include(ProjectItemType.entityTypeResource);
    expect(itemTypes).to.include(ProjectItemType.blockTypeBehavior);
    expect(itemTypes).to.include(ProjectItemType.itemTypeBehavior);
    expect(itemTypes).to.include(ProjectItemType.recipeBehavior);
    expect(itemTypes).to.include(ProjectItemType.lootTableBehavior);
    expect(itemTypes).to.include(ProjectItemType.MCFunction);
    expect(itemTypes).to.include(ProjectItemType.animationBehaviorJson);
    expect(itemTypes).to.include(ProjectItemType.animationControllerBehaviorJson);
    expect(itemTypes).to.include(ProjectItemType.spawnRuleBehavior);
    expect(itemTypes).to.include(ProjectItemType.js);
    expect(itemTypes).to.include(ProjectItemType.modelGeometryJson);
    expect(itemTypes).to.include(ProjectItemType.renderControllerJson);
    expect(itemTypes).to.include(ProjectItemType.particleJson);
    expect(itemTypes).to.include(ProjectItemType.lang);
  });

  it("validates entity content", async () => {
    const project = await _loadProject("comprehensive");

    const entityItems = project.items.filter((item) => item.itemType === ProjectItemType.entityTypeBehavior);
    expect(entityItems.length).to.be.greaterThan(0);

    const entityItem = entityItems[0];
    expect(entityItem.name).to.equal("sample_entity.json");
    expect(entityItem.projectPath).to.contain("entities");
  });

  it("validates block content", async () => {
    const project = await _loadProject("comprehensive");

    const blockItems = project.items.filter((item) => item.itemType === ProjectItemType.blockTypeBehavior);
    expect(blockItems.length).to.be.greaterThan(0);

    const blockItem = blockItems[0];
    expect(blockItem.name).to.equal("sample_block.json");
    expect(blockItem.projectPath).to.contain("blocks");
  });

  it("validates item content", async () => {
    const project = await _loadProject("comprehensive");

    const itemItems = project.items.filter((item) => item.itemType === ProjectItemType.itemTypeBehavior);
    expect(itemItems.length).to.be.greaterThan(0);

    const itemItem = itemItems[0];
    expect(itemItem.name).to.equal("sample_item.json");
    expect(itemItem.projectPath).to.contain("items");
  });

  it("validates recipe content", async () => {
    const project = await _loadProject("comprehensive");

    const recipeItems = project.items.filter((item) => item.itemType === ProjectItemType.recipeBehavior);
    expect(recipeItems.length).to.be.greaterThan(0);

    const recipeItem = recipeItems[0];
    expect(recipeItem.name).to.equal("sample_recipe.json");
    expect(recipeItem.projectPath).to.contain("recipes");
  });

  it("validates function content", async () => {
    const project = await _loadProject("comprehensive");

    const functionItems = project.items.filter((item) => item.itemType === ProjectItemType.MCFunction);
    expect(functionItems.length).to.be.greaterThan(0);

    const functionItem = functionItems[0];
    expect(functionItem.name).to.equal("complex_function.mcfunction");
    expect(functionItem.projectPath).to.contain("functions");
  });

  it("validates animation content", async () => {
    const project = await _loadProject("comprehensive");

    const animationItems = project.items.filter((item) => item.itemType === ProjectItemType.animationBehaviorJson);
    expect(animationItems.length).to.be.greaterThan(0);

    const animationItem = animationItems[0];
    expect(animationItem.name).to.equal("sample_entity_animations.json");
    expect(animationItem.projectPath).to.contain("animations");
  });

  it("validates loot table content", async () => {
    const project = await _loadProject("comprehensive");

    const lootTableItems = project.items.filter((item) => item.itemType === ProjectItemType.lootTableBehavior);
    expect(lootTableItems.length).to.be.greaterThan(0);

    const lootTableItem = lootTableItems[0];
    expect(lootTableItem.name).to.equal("sample_loot_table.json");
    expect(lootTableItem.projectPath).to.contain("loot_table.json");
  });

  it("validates spawn rules content", async () => {
    const project = await _loadProject("comprehensive");

    const spawnRuleItems = project.items.filter((item) => item.itemType === ProjectItemType.spawnRuleBehavior);
    expect(spawnRuleItems.length).to.be.greaterThan(0);

    const spawnRuleItem = spawnRuleItems[0];
    expect(spawnRuleItem.name).to.equal("sample_entity.json");
    expect(spawnRuleItem.projectPath).to.contain("sample_entity.json");
  });

  it("validates script content", async () => {
    const project = await _loadProject("comprehensive");

    const scriptItems = project.items.filter((item) => item.itemType === ProjectItemType.js);
    expect(scriptItems.length).to.be.greaterThan(0);

    const scriptItem = scriptItems[0];
    expect(scriptItem.name).to.equal("main.js");
    expect(scriptItem.projectPath).to.contain("scripts");
  });

  it("validates resource pack content", async () => {
    const project = await _loadProject("comprehensive");

    const resourcePackItems = project.items.filter(
      (item) => item.itemType === ProjectItemType.resourcePackManifestJson
    );
    expect(resourcePackItems.length).to.be.greaterThan(0);

    const resourcePackItem = resourcePackItems[0];
    expect(resourcePackItem.name).to.equal("manifest.json");
    expect(resourcePackItem.projectPath).to.contain("resource_packs");
  });

  it("validates geometry content", async () => {
    const project = await _loadProject("comprehensive");

    const geometryItems = project.items.filter((item) => item.itemType === ProjectItemType.modelGeometryJson);
    expect(geometryItems.length).to.be.greaterThan(0);

    const geometryItem = geometryItems[0];
    expect(geometryItem.name).to.equal("sample_entity.json");
    expect(geometryItem.projectPath).to.contain("models");
  });

  it("validates render controller content", async () => {
    const project = await _loadProject("comprehensive");

    const renderControllerItems = project.items.filter(
      (item) => item.itemType === ProjectItemType.renderControllerJson
    );
    expect(renderControllerItems.length).to.be.greaterThan(0);

    const renderControllerItem = renderControllerItems[0];
    expect(renderControllerItem.name).to.equal("sample_entity.json");
    expect(renderControllerItem.projectPath).to.contain("render_controllers");
  });

  it("validates particle content", async () => {
    const project = await _loadProject("comprehensive");

    const particleItems = project.items.filter((item) => item.itemType === ProjectItemType.particleJson);
    expect(particleItems.length).to.be.greaterThan(0);

    const particleItem = particleItems[0];
    expect(particleItem.name).to.equal("sample_particle.json");
    expect(particleItem.projectPath).to.contain("particles");
  });

  it("validates language content", async () => {
    const project = await _loadProject("comprehensive");

    const langItems = project.items.filter((item) => item.itemType === ProjectItemType.lang);
    expect(langItems.length).to.be.greaterThan(0);

    const langItem = langItems[0];
    expect(langItem.name).to.equal("en_US.lang");
    expect(langItem.projectPath).to.contain("texts");
  });

  it("comprehensive project validation report matches", async () => {
    const project = await _loadProject("comprehensive");

    const pis = new ProjectInfoSet(project, ProjectInfoSuite.default);
    await pis.generateForProject();

    const dataObject = pis.getDataObject();
    await ensureReportJsonMatchesScenario(scenariosFolder, resultsFolder, dataObject, "comprehensive");
  });
});

describe("Content Type Validation", async () => {
  it("validates entity component structure", async () => {
    const project = await _loadProject("comprehensive");

    const entityItems = project.items.filter((item) => item.itemType === ProjectItemType.entityTypeBehavior);
    expect(entityItems.length).to.be.greaterThan(0);

    // Test specific entity validation if needed
    // This can be expanded based on specific validation requirements
  });

  it("validates block component structure", async () => {
    const project = await _loadProject("comprehensive");

    const blockItems = project.items.filter((item) => item.itemType === ProjectItemType.blockTypeBehavior);
    expect(blockItems.length).to.be.greaterThan(0);

    // Test specific block validation if needed
  });

  it("validates item component structure", async () => {
    const project = await _loadProject("comprehensive");

    const itemItems = project.items.filter((item) => item.itemType === ProjectItemType.itemTypeBehavior);
    expect(itemItems.length).to.be.greaterThan(0);

    // Test specific item validation if needed
  });

  it("validates recipe format", async () => {
    const project = await _loadProject("comprehensive");

    const recipeItems = project.items.filter((item) => item.itemType === ProjectItemType.recipeBehavior);
    expect(recipeItems.length).to.be.greaterThan(0);

    // Test specific recipe validation if needed
  });

  it("validates function syntax", async () => {
    const project = await _loadProject("comprehensive");

    const functionItems = project.items.filter((item) => item.itemType === ProjectItemType.MCFunction);
    expect(functionItems.length).to.be.greaterThan(0);

    // Test specific function validation if needed
  });
});
