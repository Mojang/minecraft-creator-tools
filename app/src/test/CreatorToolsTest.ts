// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { expect, assert } from "chai";
import CreatorTools from "../app/CreatorTools";
import Project, { ProjectAutoDeploymentMode } from "../app/Project";
import CreatorToolsHost, { HostType } from "../app/CreatorToolsHost";
import Status from "../app/Status";
import NodeStorage from "../local/NodeStorage";
import Database from "../minecraft/Database";
import LocalEnvironment from "../local/LocalEnvironment";
import ProjectInfoSet from "../info/ProjectInfoSet";
import { ProjectInfoSuite } from "../info/IProjectInfoData";
import IFolder from "../storage/IFolder";
import StorageUtilities from "../storage/StorageUtilities";
import ProjectExporter from "../app/ProjectExporter";
import { IWorldSettings } from "../minecraft/IWorldSettings";
import { GameType, Generator } from "../minecraft/WorldLevelDat";
import * as fs from "fs";
import ProjectItem from "../app/ProjectItem";
import { ProjectItemType, ProjectItemStorageType } from "../app/IProjectItemData";
import ProjectUtilities from "../app/ProjectUtilities";
import ProjectItemUtilities from "../app/ProjectItemUtilities";
import { ensureReportJsonMatchesScenario, folderMatches } from "./TestUtilities";

CreatorToolsHost.hostType = HostType.testLocal;

let creatorTools: CreatorTools | undefined = undefined;
let localEnv: LocalEnvironment | undefined = undefined;

let scenariosFolder: IFolder | undefined = undefined;

let resultsFolder: IFolder | undefined = undefined;

localEnv = new LocalEnvironment(false);

(async () => {
  CreatorToolsHost.localFolderExists = _localFolderExists;
  CreatorToolsHost.ensureLocalFolder = _ensureLocalFolder;

  const scenariosStorage = new NodeStorage(
    NodeStorage.ensureEndsWithDelimiter(__dirname) + "/../../test/",
    "scenarios"
  );

  scenariosFolder = scenariosStorage.rootFolder;

  await scenariosFolder.ensureExists();

  const resultsStorage = new NodeStorage(NodeStorage.ensureEndsWithDelimiter(__dirname) + "/../../test/", "results");

  resultsFolder = resultsStorage.rootFolder;

  await resultsFolder.ensureExists();

  CreatorToolsHost.prefsStorage = new NodeStorage(
    localEnv.utilities.testWorkingPath + "prefs" + NodeStorage.platformFolderDelimiter,
    ""
  );

  CreatorToolsHost.projectsStorage = new NodeStorage(
    localEnv.utilities.testWorkingPath + "projects" + NodeStorage.platformFolderDelimiter,
    ""
  );

  CreatorToolsHost.packStorage = new NodeStorage(
    localEnv.utilities.testWorkingPath + "packs" + NodeStorage.platformFolderDelimiter,
    ""
  );

  CreatorToolsHost.worldStorage = new NodeStorage(
    localEnv.utilities.testWorkingPath + "worlds" + NodeStorage.platformFolderDelimiter,
    ""
  );

  CreatorToolsHost.workingStorage = new NodeStorage(
    localEnv.utilities.testWorkingPath + "working" + NodeStorage.platformFolderDelimiter,
    ""
  );

  const coreStorage = new NodeStorage(__dirname + "/../../public/data/content/", "");
  Database.contentFolder = coreStorage.rootFolder;

  await CreatorToolsHost.init();

  creatorTools = CreatorToolsHost.getCreatorTools();

  if (!creatorTools) {
    return;
  }

  await creatorTools.load();

  Database.local = localEnv.utilities;
  creatorTools.local = localEnv.utilities;

  creatorTools.onStatusAdded.subscribe(handleStatusAdded);
})();

function handleStatusAdded(creatorTools: CreatorTools, status: Status) {
  console.log(status.message);
}

function _ensureLocalFolder(path: string) {
  const ls = new NodeStorage(path, "");

  return ls.rootFolder;
}

async function _localFolderExists(path: string) {
  const ls = new NodeStorage(path, "");

  return await ls.rootFolder.exists();
}

async function _loadProject(name: string) {
  if (!creatorTools || !scenariosFolder || !resultsFolder) {
    assert.fail("Not properly initialized");
  }

  const project = new Project(creatorTools, name, null);

  project.autoDeploymentMode = ProjectAutoDeploymentMode.noAutoDeployment;
  project.localFolderPath = __dirname + "/../../../samplecontent/" + name + "/";

  await project.inferProjectItemsFromFiles();

  return project;
}

function removeResultFolder(scenarioName: string) {
  if (resultsFolder) {
    const path =
      StorageUtilities.ensureEndsWithDelimiter(resultsFolder.fullPath) +
      StorageUtilities.ensureEndsWithDelimiter(scenarioName);

    // guard against being called at a "more root" file path
    if (fs.existsSync(path) && !StorageUtilities.isPathRiskyForDelete(path)) {
      try {
        fs.rmSync(path, {
          recursive: true,
        });
      } catch (e) {
        console.log("Error occurred during rmSync on '" + path + "'");

        throw e;
      }
    }
  }
}

describe("simple", async () => {
  it("has expected structure", async () => {
    const project = await _loadProject("simple");

    expect(project.items.length).to.equal(6);
  });

  it("report file matches", async () => {
    const project = await _loadProject("simple");

    const pis = new ProjectInfoSet(project, ProjectInfoSuite.defaultInDevelopment);

    await pis.generateForProject();

    const dataObject = pis.getDataObject();

    await ensureReportJsonMatchesScenario(scenariosFolder, resultsFolder, dataObject, "simple");
  });
});

describe("deployJs", async () => {
  before((done) => {
    removeResultFolder("deployJs");
    done();
  });

  it("has expected structure", async () => {
    const project = await _loadProject("deployJs");

    expect(project.items.length).to.equal(4);
  });

  it("deploy outputs match", async () => {
    const project = await _loadProject("deployJs");

    if (!creatorTools || !resultsFolder) {
      return;
    }

    const worldSettings: IWorldSettings = {
      generator: Generator.infinite,
      gameType: GameType.survival,
      randomSeed: "3000",
      lastPlayed: BigInt(new Date(2023, 0, 1).getTime()),
    };

    const resultsOutFolder = resultsFolder.ensureFolder("deployJs");
    await resultsOutFolder.ensureExists();

    await ProjectExporter.deployProjectAndGeneratedWorldTo(creatorTools, project, worldSettings, resultsOutFolder);

    await folderMatches(scenariosFolder, resultsFolder, "deployJs", ["level.dat", "level.dat_old"]);
  });
});

describe("Project utility methods", () => {
  it("resetProjectItems removes unknown and json items", async () => {
    const project = await _loadProject("simple");
    // Simulate unknown and json items using real ProjectItem instances with all required properties
    project.items.push(
      new ProjectItem(project, {
        itemType: ProjectItemType.unknown,
        projectPath: "/fake1",
        variants: {},
        tags: [],
        name: "fake1",
        storageType: ProjectItemStorageType.singleFile,
      })
    );
    project.items.push(
      new ProjectItem(project, {
        itemType: ProjectItemType.unknownJson,
        projectPath: "/fake2",
        variants: {},
        tags: [],
        name: "fake2",
        storageType: ProjectItemStorageType.singleFile,
      })
    );
    const before = project.items.length;
    project.resetProjectItems();
    const after = project.items.length;
    expect(after).to.be.lessThan(before);
  });

  it("ensureStoragePathIsCollapsed/NotCollapsed works as expected", async () => {
    const project = await _loadProject("simple");
    const path = "/test/path";
    project.ensureStoragePathIsCollapsed(path);
    expect(project.collapsedStoragePaths).to.include(path);
    project.ensureStoragePathIsNotCollapsed(path);
    expect(project.collapsedStoragePaths).to.not.include(path);
  });

  it("getFirstItemByType returns correct item", async () => {
    const project = await _loadProject("simple");
    const item = project.getFirstItemByType(project.items[0].itemType);
    expect(item).to.exist;
    if (item) {
      expect(item.itemType).to.equal(project.items[0].itemType);
    }
  });
});

describe("spawnRulesDependency", async () => {
  let project: Project;

  beforeEach(async () => {
    project = await _loadProject("spawnRulesDependency");
  });

  it("has expected structure", async () => {
    assert.isDefined(project);
    assert.isTrue(project.projectFolder !== null);
    assert.isTrue(project.projectFolder !== undefined);
  });

  it("spawn rules track entity type behavior dependencies", async () => {
    assert.isDefined(project);

    // Load the project items
    await project.inferProjectItemsFromFiles();

    // Find the spawn rule item
    const spawnRuleItem = project.items.find(
      (item) => item.itemType === ProjectItemType.spawnRuleBehavior && item.name === "example_entity.json"
    );

    assert.isDefined(spawnRuleItem, "Spawn rule item should exist");

    // Find the entity type behavior item
    const entityItem = project.items.find(
      (item) => item.itemType === ProjectItemType.entityTypeBehavior && item.name === "example_entity.json"
    );

    assert.isDefined(entityItem, "Entity type behavior item should exist");

    // Process relations to set up dependencies
    await project.processRelations();

    // Check that the spawn rule has the entity type behavior as a child
    assert.isDefined(spawnRuleItem?.parentItems, "Spawn rule should have parent items");
    if (spawnRuleItem && spawnRuleItem.parentItems) {
      assert.isTrue(spawnRuleItem?.parentItems.length > 0, "Spawn rule should have at least one parent item");

      const hasEntityParent = spawnRuleItem?.parentItems.some((childRel) => childRel.parentItem === entityItem);

      assert.isTrue(hasEntityParent, "Spawn rule should have entity type behavior as parent");
    }
  });
});

describe("Advanced Content Type Tests", async () => {
  it("validates ProjectItemUtilities functionality", async () => {
    const project = await _loadProject("comprehensive");

    // Test item type detection
    const entityItems = project.items.filter((item) => item.itemType === ProjectItemType.entityTypeBehavior);
    expect(entityItems.length).to.be.greaterThan(0);

    if (entityItems.length > 0) {
      const entityItem = entityItems[0];

      // Test category assignment
      const category = ProjectItemUtilities.getCategory(entityItem.itemType);
      expect(category).to.be.a("number");

      // Test display name
      const displayName = ProjectItemUtilities.getDescriptionForType(entityItem.itemType);
      expect(displayName).to.be.a("string");
      expect(displayName.length).to.be.greaterThan(0);

      // Test sort order
      const sortOrder = ProjectItemUtilities.getSortOrder(entityItem.itemType);
      expect(sortOrder).to.be.a("number");
      expect(sortOrder).to.be.greaterThanOrEqual(0);
    }
  });

  it("validates different file extensions are handled", async () => {
    const project = await _loadProject("comprehensive");

    // Test different file types
    const jsonItems = project.items.filter((item) => item.projectPath?.endsWith(".json"));
    const jsItems = project.items.filter((item) => item.projectPath?.endsWith(".js"));
    const langItems = project.items.filter((item) => item.projectPath?.endsWith(".lang"));
    const mcfunctionItems = project.items.filter((item) => item.projectPath?.endsWith(".mcfunction"));

    expect(jsonItems.length).to.be.greaterThan(0);
    expect(jsItems.length).to.be.greaterThan(0);
    expect(langItems.length).to.be.greaterThan(0);
    expect(mcfunctionItems.length).to.be.greaterThan(0);
  });

  it("validates project structure detection", async () => {
    const project = await _loadProject("comprehensive");

    // Test structure detection
    const hasBehaviorPack = project.items.some((item) => item.itemType === ProjectItemType.behaviorPackManifestJson);
    const hasResourcePack = project.items.some((item) => item.itemType === ProjectItemType.resourcePackManifestJson);
    const hasScripts = project.items.some((item) => item.itemType === ProjectItemType.js);
    const hasEntities = project.items.some((item) => item.itemType === ProjectItemType.entityTypeBehavior);
    const hasBlocks = project.items.some((item) => item.itemType === ProjectItemType.blockTypeBehavior);
    const hasItems = project.items.some((item) => item.itemType === ProjectItemType.itemTypeBehavior);

    expect(hasBehaviorPack).to.be.true;
    expect(hasResourcePack).to.be.true;
    expect(hasScripts).to.be.true;
    expect(hasEntities).to.be.true;
    expect(hasBlocks).to.be.true;
    expect(hasItems).to.be.true;
  });

  it("validates folder structure inference", async () => {
    const project = await _loadProject("comprehensive");

    // Test that items are properly categorized by their folder structure
    const entityItems = project.items.filter((item) => item.itemType === ProjectItemType.entityTypeBehavior);
    const blockItems = project.items.filter((item) => item.itemType === ProjectItemType.blockTypeBehavior);
    const itemItems = project.items.filter((item) => item.itemType === ProjectItemType.itemTypeBehavior);
    const recipeItems = project.items.filter((item) => item.itemType === ProjectItemType.recipeBehavior);
    const functionItems = project.items.filter((item) => item.itemType === ProjectItemType.MCFunction);

    if (entityItems.length > 0) {
      expect(entityItems[0].projectPath).to.contain("entities");
    }
    if (blockItems.length > 0) {
      expect(blockItems[0].projectPath).to.contain("blocks");
    }
    if (itemItems.length > 0) {
      expect(itemItems[0].projectPath).to.contain("items");
    }
    if (recipeItems.length > 0) {
      expect(recipeItems[0].projectPath).to.contain("recipes");
    }
    if (functionItems.length > 0) {
      expect(functionItems[0].projectPath).to.contain("functions");
    }
  });

  it("validates content type diversity", async () => {
    const project = await _loadProject("comprehensive");

    // Get unique item types
    const uniqueTypes = [...new Set(project.items.map((item) => item.itemType))];

    // Should have diverse content types
    expect(uniqueTypes.length).to.be.greaterThan(15);

    // Should include various categories
    const categories = uniqueTypes.map((type) => ProjectItemUtilities.getCategory(type));
    const uniqueCategories = [...new Set(categories)];

    expect(uniqueCategories.length).to.be.greaterThan(3);
  });

  it("validates project utilities functionality", async () => {
    const project = await _loadProject("comprehensive");

    // Test project analysis
    const hasScripts = (await project.getScriptState()).hasScript;
    const hasEntities = ProjectUtilities.hasEntities(project);
    const hasBlocks = ProjectUtilities.hasBlocks(project);
    const hasItems = ProjectUtilities.hasItems(project);

    expect(hasScripts).to.be.true;
    expect(hasEntities).to.be.true;
    expect(hasBlocks).to.be.true;
    expect(hasItems).to.be.true;
  });

  it("validates complex project structure", async () => {
    const project = await _loadProject("comprehensive");

    // Test nested folder structures
    const nestedItems = project.items.filter((item) => item.projectPath && item.projectPath.split("/").length > 3);

    expect(nestedItems.length).to.be.greaterThan(0);
  });

  it("validates different manifest types", async () => {
    const project = await _loadProject("comprehensive");

    const behaviorManifests = project.items.filter(
      (item) => item.itemType === ProjectItemType.behaviorPackManifestJson
    );
    const resourceManifests = project.items.filter(
      (item) => item.itemType === ProjectItemType.resourcePackManifestJson
    );

    expect(behaviorManifests.length).to.equal(1);
    expect(resourceManifests.length).to.equal(1);

    if (behaviorManifests.length > 0) {
      expect(behaviorManifests[0].projectPath).to.contain("behavior_packs");
    }
    if (resourceManifests.length > 0) {
      expect(resourceManifests[0].projectPath).to.contain("resource_packs");
    }
  });

  it("validates animation and animation controller content", async () => {
    const project = await _loadProject("comprehensive");

    const animations = project.items.filter((item) => item.itemType === ProjectItemType.animationBehaviorJson);
    const animationControllers = project.items.filter(
      (item) => item.itemType === ProjectItemType.animationControllerBehaviorJson
    );

    expect(animations.length).to.be.greaterThan(0);
    expect(animationControllers.length).to.be.greaterThan(0);

    if (animations.length > 0) {
      expect(animations[0].projectPath).to.contain("animations");
    }
    if (animationControllers.length > 0) {
      expect(animationControllers[0].projectPath).to.contain("animation_controllers");
    }
  });

  it("validates resource pack specific content", async () => {
    const project = await _loadProject("comprehensive");

    const geometries = project.items.filter((item) => item.itemType === ProjectItemType.modelGeometryJson);
    const renderControllers = project.items.filter((item) => item.itemType === ProjectItemType.renderControllerJson);
    const particles = project.items.filter((item) => item.itemType === ProjectItemType.particleJson);
    const clientEntities = project.items.filter((item) => item.itemType === ProjectItemType.entityTypeResource);

    expect(geometries.length).to.be.greaterThan(0);
    expect(renderControllers.length).to.be.greaterThan(0);
    expect(particles.length).to.be.greaterThan(0);
    expect(clientEntities.length).to.be.greaterThan(0);

    if (geometries.length > 0) {
      expect(geometries[0].projectPath).to.contain("models");
    }
    if (renderControllers.length > 0) {
      expect(renderControllers[0].projectPath).to.contain("render_controllers");
    }
    if (particles.length > 0) {
      expect(particles[0].projectPath).to.contain("particles");
    }
    if (clientEntities.length > 0) {
      expect(clientEntities[0].projectPath).to.contain("entity");
    }
  });

  it("validates language and localization content", async () => {
    const project = await _loadProject("comprehensive");

    const langFiles = project.items.filter((item) => item.itemType === ProjectItemType.lang);
    const languagesCatalog = project.items.filter((item) => item.itemType === ProjectItemType.languagesCatalogJson);

    expect(langFiles.length).to.be.greaterThan(0);
    expect(languagesCatalog.length).to.be.greaterThan(0);

    if (langFiles.length > 0) {
      expect(langFiles[0].projectPath).to.contain("texts");
    }
    if (languagesCatalog.length > 0) {
      expect(languagesCatalog[0].projectPath).to.contain("texts");
    }
  });
});
describe("Specialized Content Types", async () => {
  it("validates dialogue content", async () => {
    const project = await _loadProject("comprehensive");

    const dialogueItems = project.items.filter((item) => item.itemType === ProjectItemType.dialogueBehaviorJson);
    expect(dialogueItems.length).to.be.greaterThan(0);

    const dialogueItem = dialogueItems[0];
    expect(dialogueItem.name).to.equal("sample_dialogue.json");
    expect(dialogueItem.projectPath).to.contain("dialogue");
  });

  it("validates trading content", async () => {
    const project = await _loadProject("comprehensive");

    const tradingItems = project.items.filter((item) => item.itemType === ProjectItemType.tradingBehaviorJson);
    expect(tradingItems.length).to.be.greaterThan(0);

    const tradingItem = tradingItems[0];
    expect(tradingItem.name).to.equal("sample_trading.json");
    expect(tradingItem.projectPath).to.contain("trading");
  });

  it("validates attachable content", async () => {
    const project = await _loadProject("comprehensive");

    const attachableItems = project.items.filter((item) => item.itemType === ProjectItemType.attachableResourceJson);
    expect(attachableItems.length).to.be.greaterThan(0);

    const attachableItem = attachableItems[0];
    expect(attachableItem.name).to.equal("sample_attachable.json");
    expect(attachableItem.projectPath).to.contain("attachables");
  });

  it("validates resource pack animations", async () => {
    const project = await _loadProject("comprehensive");

    const resourceAnimations = project.items.filter((item) => item.itemType === ProjectItemType.animationResourceJson);
    expect(resourceAnimations.length).to.be.greaterThan(0);

    const resourceAnimation = resourceAnimations[0];
    expect(resourceAnimation.name).to.equal("sample_entity_resource.json");
    expect(resourceAnimation.projectPath).to.contain("resource_packs");
  });

  it("validates resource pack animation controllers", async () => {
    const project = await _loadProject("comprehensive");

    const resourceAnimationControllers = project.items.filter(
      (item) => item.itemType === ProjectItemType.animationControllerResourceJson
    );
    expect(resourceAnimationControllers.length).to.be.greaterThan(0);

    const resourceAnimationController = resourceAnimationControllers[0];
    expect(resourceAnimationController.name).to.equal("sample_entity_resource.json");
    expect(resourceAnimationController.projectPath).to.contain("resource_packs");
  });

  it("validates multiple recipe types", async () => {
    const project = await _loadProject("comprehensive");

    const recipeItems = project.items.filter((item) => item.itemType === ProjectItemType.recipeBehavior);
    expect(recipeItems.length).to.be.greaterThan(1);

    const recipeNames = recipeItems.map((item) => item.name);
    expect(recipeNames).to.include("sample_recipe.json");
    expect(recipeNames).to.include("shapeless_recipe.json");
  });

  it("validates multiple loot table types", async () => {
    const project = await _loadProject("comprehensive");

    const lootTableItems = project.items.filter((item) => item.itemType === ProjectItemType.lootTableBehavior);
    expect(lootTableItems.length).to.be.greaterThan(1);

    const lootTableNames = lootTableItems.map((item) => item.name);
    expect(lootTableNames).to.include("sample_loot_table.json");
    expect(lootTableNames).to.include("treasure_loot.json");
  });

  it("validates multiple function types", async () => {
    const project = await _loadProject("comprehensive");

    const functionItems = project.items.filter((item) => item.itemType === ProjectItemType.MCFunction);
    expect(functionItems.length).to.be.greaterThan(1);

    const functionNames = functionItems.map((item) => item.name);
    expect(functionNames).to.include("sample_function.mcfunction");
    expect(functionNames).to.include("complex_function.mcfunction");
  });

  it("validates multiple item types", async () => {
    const project = await _loadProject("comprehensive");

    const itemItems = project.items.filter((item) => item.itemType === ProjectItemType.itemTypeBehavior);
    expect(itemItems.length).to.be.greaterThan(1);

    const itemNames = itemItems.map((item) => item.name);
    expect(itemNames).to.include("sample_item.json");
    expect(itemNames).to.include("simple_tool.json");
  });

  it("validates behavior pack only project", async () => {
    const project = await _loadProject("behavior_pack_only");

    const behaviorManifests = project.items.filter(
      (item) => item.itemType === ProjectItemType.behaviorPackManifestJson
    );
    const resourceManifests = project.items.filter(
      (item) => item.itemType === ProjectItemType.resourcePackManifestJson
    );
    const entityItems = project.items.filter((item) => item.itemType === ProjectItemType.entityTypeBehavior);

    expect(behaviorManifests.length).to.equal(1);
    expect(resourceManifests.length).to.equal(0);
    expect(entityItems.length).to.be.greaterThan(0);
  });

  it("validates resource pack only project", async () => {
    const project = await _loadProject("resource_pack_only");

    const behaviorManifests = project.items.filter(
      (item) => item.itemType === ProjectItemType.behaviorPackManifestJson
    );
    const resourceManifests = project.items.filter(
      (item) => item.itemType === ProjectItemType.resourcePackManifestJson
    );

    expect(behaviorManifests.length).to.equal(0);
    expect(resourceManifests.length).to.equal(1);
  });

  it("validates file path patterns", async () => {
    const project = await _loadProject("comprehensive");

    // Check that items have expected path patterns
    const entityItems = project.items.filter((item) => item.itemType === ProjectItemType.entityTypeBehavior);
    const blockItems = project.items.filter((item) => item.itemType === ProjectItemType.blockTypeBehavior);
    const resourceEntityItems = project.items.filter((item) => item.itemType === ProjectItemType.entityTypeResource);

    if (entityItems.length > 0) {
      expect(entityItems[0].projectPath).to.match(/behavior_packs.*entities/);
    }

    if (blockItems.length > 0) {
      expect(blockItems[0].projectPath).to.match(/behavior_packs.*blocks/);
    }

    if (resourceEntityItems.length > 0) {
      expect(resourceEntityItems[0].projectPath).to.match(/resource_packs.*entity/);
    }
  });

  it("validates content type classification", async () => {
    const project = await _loadProject("comprehensive");

    // Test that different content types are properly classified
    const contentTypes = [
      ProjectItemType.entityTypeBehavior,
      ProjectItemType.entityTypeResource,
      ProjectItemType.blockTypeBehavior,
      ProjectItemType.itemTypeBehavior,
      ProjectItemType.recipeBehavior,
      ProjectItemType.lootTableBehavior,
      ProjectItemType.MCFunction,
      ProjectItemType.animationBehaviorJson,
      ProjectItemType.animationResourceJson,
      ProjectItemType.dialogueBehaviorJson,
      ProjectItemType.tradingBehaviorJson,
      ProjectItemType.attachableResourceJson,
      ProjectItemType.spawnRuleBehavior,
      ProjectItemType.modelGeometryJson,
      ProjectItemType.renderControllerJson,
      ProjectItemType.particleJson,
      ProjectItemType.js,
      ProjectItemType.lang,
    ];

    for (const contentType of contentTypes) {
      const items = project.items.filter((item) => item.itemType === contentType);
      if (items.length > 0) {
        const displayName = ProjectItemUtilities.getDescriptionForType(contentType);
        expect(displayName).to.be.a("string");
        expect(displayName.length).to.be.greaterThan(0);
      }
    }
  });

  it("validates project structure completeness", async () => {
    const project = await _loadProject("comprehensive");

    // Should have both behavior and resource packs
    const hasBehaviorPack = project.items.some((item) => item.itemType === ProjectItemType.behaviorPackManifestJson);
    const hasResourcePack = project.items.some((item) => item.itemType === ProjectItemType.resourcePackManifestJson);

    expect(hasBehaviorPack).to.be.true;
    expect(hasResourcePack).to.be.true;

    // Should have various content types
    const hasEntities = project.items.some((item) => item.itemType === ProjectItemType.entityTypeBehavior);
    const hasBlocks = project.items.some((item) => item.itemType === ProjectItemType.blockTypeBehavior);
    const hasItems = project.items.some((item) => item.itemType === ProjectItemType.itemTypeBehavior);
    const hasRecipes = project.items.some((item) => item.itemType === ProjectItemType.recipeBehavior);
    const hasFunctions = project.items.some((item) => item.itemType === ProjectItemType.MCFunction);
    const hasAnimations = project.items.some((item) => item.itemType === ProjectItemType.animationBehaviorJson);
    const hasLootTables = project.items.some((item) => item.itemType === ProjectItemType.lootTableBehavior);
    const hasSpawnRules = project.items.some((item) => item.itemType === ProjectItemType.spawnRuleBehavior);
    const hasScripts = project.items.some((item) => item.itemType === ProjectItemType.js);

    expect(hasEntities).to.be.true;
    expect(hasBlocks).to.be.true;
    expect(hasItems).to.be.true;
    expect(hasRecipes).to.be.true;
    expect(hasFunctions).to.be.true;
    expect(hasAnimations).to.be.true;
    expect(hasLootTables).to.be.true;
    expect(hasSpawnRules).to.be.true;
    expect(hasScripts).to.be.true;
  });

  it("validates unique identifiers", async () => {
    const project = await _loadProject("comprehensive");

    // Test that items have unique names within their types
    const entityItems = project.items.filter((item) => item.itemType === ProjectItemType.entityTypeBehavior);
    const entityNames = entityItems.map((item) => item.name);
    const uniqueEntityNames = [...new Set(entityNames)];

    expect(entityNames.length).to.equal(uniqueEntityNames.length);
  });

  it("validates content diversity metrics", async () => {
    const project = await _loadProject("comprehensive");

    // Calculate content diversity metrics
    const totalItems = project.items.length;
    const uniqueTypes = [...new Set(project.items.map((item) => item.itemType))];
    const uniqueCategories = [...new Set(project.items.map((item) => ProjectItemUtilities.getCategory(item.itemType)))];

    expect(totalItems).to.be.greaterThan(20);
    expect(uniqueTypes.length).to.be.greaterThan(18);
    expect(uniqueCategories.length).to.be.greaterThan(3);
  });
});

describe("jigsawDependency", async () => {
  let project: Project;

  beforeEach(async () => {
    project = await _loadProject("jigsawDependency");
  });

  it("has expected structure", async () => {
    assert.isDefined(project);
    assert.isTrue(project.projectFolder !== null);
    assert.isTrue(project.projectFolder !== undefined);
  });

  it("jigsaw structures track dependency relationships", async () => {
    assert.isDefined(project);

    // Load the project items
    await project.inferProjectItemsFromFiles();

    // Find the jigsaw structure set item
    const structureSetItem = project.items.find(
      (item) => item.itemType === ProjectItemType.jigsawStructureSet && item.name === "test_structure_set.json"
    );

    assert.isDefined(structureSetItem, "Jigsaw structure set item should exist");

    // Find the jigsaw structure item
    const structureItem = project.items.find(
      (item) => item.itemType === ProjectItemType.jigsawStructure && item.name === "test_structure.json"
    );

    assert.isDefined(structureItem, "Jigsaw structure item should exist");

    // Find the template pool item
    const templatePoolItem = project.items.find(
      (item) => item.itemType === ProjectItemType.jigsawTemplatePool && item.name === "test_pool.json"
    );

    assert.isDefined(templatePoolItem, "Jigsaw template pool item should exist");

    // Find the processor list item
    const processorListItem = project.items.find(
      (item) => item.itemType === ProjectItemType.jigsawProcessorList && item.name === "test_processors.json"
    );

    assert.isDefined(processorListItem, "Jigsaw processor list item should exist");

    // Process relations to set up dependencies
    await project.processRelations();

    // Check that the structure set has the jigsaw structure as a child
    assert.isDefined(structureSetItem?.childItems, "Structure set should have child items");
    if (structureSetItem && structureSetItem.childItems) {
      assert.isTrue(structureSetItem.childItems.length > 0, "Structure set should have at least one child item");

      const hasStructureChild = structureSetItem.childItems.some((childRel) => childRel.childItem === structureItem);
      assert.isTrue(hasStructureChild, "Structure set should have jigsaw structure as child");
    }

    // Check that the jigsaw structure has the template pool as a child
    assert.isDefined(structureItem?.childItems, "Jigsaw structure should have child items");
    if (structureItem && structureItem.childItems) {
      assert.isTrue(structureItem.childItems.length > 0, "Jigsaw structure should have at least one child item");

      const hasTemplatePoolChild = structureItem.childItems.some((childRel) => childRel.childItem === templatePoolItem);
      assert.isTrue(hasTemplatePoolChild, "Jigsaw structure should have template pool as child");
    }

    // Check that the template pool has the processor list as a child
    assert.isDefined(templatePoolItem?.childItems, "Template pool should have child items");
    if (templatePoolItem && templatePoolItem.childItems) {
      assert.isTrue(templatePoolItem.childItems.length > 0, "Template pool should have at least one child item");

      const hasProcessorChild = templatePoolItem.childItems.some(
        (childRel) => childRel.childItem === processorListItem
      );
      assert.isTrue(hasProcessorChild, "Template pool should have processor list as child");
    }
  });
});
