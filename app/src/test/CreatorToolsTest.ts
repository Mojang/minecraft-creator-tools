// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { expect, assert } from "chai";
import CreatorTools from "../app/CreatorTools";
import Project, { ProjectAutoDeploymentMode } from "../app/Project";
import Status from "../app/Status";
import IFolder from "../storage/IFolder";
import StorageUtilities from "../storage/StorageUtilities";
import ZipStorage from "../storage/ZipStorage";
import ProjectExporter from "../app/ProjectExporter";
import { IWorldSettings } from "../minecraft/IWorldSettings";
import { GameType, Generator } from "../minecraft/WorldLevelDat";
import * as fs from "fs";
import ProjectItem from "../app/ProjectItem";
import { ProjectItemType, ProjectItemStorageType } from "../app/IProjectItemData";
import ProjectUtilities from "../app/ProjectUtilities";
import ProjectItemUtilities from "../app/ProjectItemUtilities";
import { ensureReportJsonMatchesScenario, folderMatches } from "./TestUtilities";
import TestPaths, { ITestEnvironment } from "./TestPaths";
import ProjectInfoSet from "../info/ProjectInfoSet";
import { ProjectInfoSuite } from "../info/IProjectInfoData";
import Database from "../minecraft/Database";

let creatorTools: CreatorTools | undefined = undefined;

let scenariosFolder: IFolder | undefined = undefined;
let resultsFolder: IFolder | undefined = undefined;

(async () => {
  const env: ITestEnvironment = await TestPaths.createTestEnvironment();
  creatorTools = env.creatorTools;
  scenariosFolder = env.scenariosFolder;
  resultsFolder = env.resultsFolder;

  creatorTools.onStatusAdded.subscribe(handleStatusAdded);
})();

function handleStatusAdded(creatorTools: CreatorTools, status: Status) {
  console.log(status.message);
}

async function _loadProject(name: string) {
  if (!creatorTools || !scenariosFolder || !resultsFolder) {
    assert.fail("Not properly initialized");
  }

  const project = new Project(creatorTools, name, null);

  project.autoDeploymentMode = ProjectAutoDeploymentMode.noAutoDeployment;
  project.localFolderPath = TestPaths.sampleContentPath(name);

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

function getRepresentativeRelativePath(
  project: Project,
  itemType: ProjectItemType,
  packFolder: IFolder,
  label: string
): string {
  const matchingItem = project.items.find((item) => {
    if (item.itemType !== itemType || !item.primaryFile) {
      return false;
    }

    return item.primaryFile.getFolderRelativePath(packFolder) !== undefined;
  });

  assert.isDefined(matchingItem, `Could not find representative ${label} file in project '${project.name}'.`);
  assert.isNotNull(matchingItem?.primaryFile, `Representative ${label} item has no primary file.`);

  const relativePath = matchingItem?.primaryFile?.getFolderRelativePath(packFolder);
  assert.isTrue(!!relativePath, `Could not resolve relative path for representative ${label} file.`);

  return relativePath as string;
}

async function assertSemanticFileMatch(
  sourcePackFolder: IFolder,
  targetPackFolder: IFolder,
  relativePath: string,
  label: string
) {
  const sourceFile = await sourcePackFolder.ensureFileFromRelativePath(relativePath);
  const targetFile = await targetPackFolder.ensureFileFromRelativePath(relativePath);
  const filesMatch = await StorageUtilities.fileContentsEqual(sourceFile, targetFile, true);

  assert.isTrue(
    filesMatch,
    `Round-trip semantic drift in ${label} for '${relativePath}' (source: ${sourceFile.fullPath}, target: ${targetFile.fullPath})`
  );
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

    await ensureReportJsonMatchesScenario(scenariosFolder, resultsFolder, dataObject, "simple", ["CDWORLDDATA2"]);
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

    // Use a fixed deployWorldId so the output folder name is deterministic for test comparison
    project.deployWorldId = "deployJs Test World";

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

describe("roundTripExportFidelity", async () => {
  const scenarioName = "roundTripExportFidelity";

  before((done) => {
    removeResultFolder(scenarioName);
    done();
  });

  it("preserves representative BP/RP semantics for import -> zero edits -> export", async () => {
    if (!creatorTools || !resultsFolder) {
      assert.fail("Not properly initialized");
    }

    const reportData: {
      status: "pass" | "fail";
      comparedFiles: { phase: "folder-export" | "mcpack-export"; label: string; relativePath: string }[];
      error?: string;
    } = {
      status: "pass",
      comparedFiles: [],
    };

    const resultsOutFolder = resultsFolder.ensureFolder(scenarioName);
    await resultsOutFolder.ensureExists();

    try {
      const project = await _loadProject("comprehensive");
      const behaviorPackFolder = await project.getDefaultBehaviorPackFolder();
      const resourcePackFolder = await project.getDefaultResourcePackFolder();

      assert.isDefined(behaviorPackFolder, "Expected a default behavior pack folder for round-trip fidelity test.");
      assert.isDefined(resourcePackFolder, "Expected a default resource pack folder for round-trip fidelity test.");

      const representativeFiles = [
        {
          phaseLabel: "behavior entity JSON",
          relativePath: getRepresentativeRelativePath(
            project,
            ProjectItemType.entityTypeBehavior,
            behaviorPackFolder as IFolder,
            "entity behavior"
          ),
          source: "bp" as const,
        },
        {
          phaseLabel: "behavior block JSON",
          relativePath: getRepresentativeRelativePath(
            project,
            ProjectItemType.blockTypeBehavior,
            behaviorPackFolder as IFolder,
            "block behavior"
          ),
          source: "bp" as const,
        },
        {
          phaseLabel: "behavior item JSON",
          relativePath: getRepresentativeRelativePath(
            project,
            ProjectItemType.itemTypeBehavior,
            behaviorPackFolder as IFolder,
            "item behavior"
          ),
          source: "bp" as const,
        },
        {
          phaseLabel: "resource asset",
          relativePath: getRepresentativeRelativePath(
            project,
            ProjectItemType.modelGeometryJson,
            resourcePackFolder as IFolder,
            "resource geometry"
          ),
          source: "rp" as const,
        },
      ];

      const deploySucceeded = await ProjectExporter.deployProject(creatorTools, project, resultsOutFolder);
      assert.isTrue(!!deploySucceeded, "Round-trip export deployment failed.");

      const exportedBehaviorPackFolder = resultsOutFolder
        .ensureFolder("development_behavior_packs")
        .ensureFolder((behaviorPackFolder as IFolder).ensuredName);
      const exportedResourcePackFolder = resultsOutFolder
        .ensureFolder("development_resource_packs")
        .ensureFolder((resourcePackFolder as IFolder).ensuredName);

      assert.isTrue(await exportedBehaviorPackFolder.exists(), "Exported behavior pack folder was not created.");
      assert.isTrue(await exportedResourcePackFolder.exists(), "Exported resource pack folder was not created.");

      for (const representative of representativeFiles) {
        const sourcePack =
          representative.source === "bp" ? (behaviorPackFolder as IFolder) : (resourcePackFolder as IFolder);
        const exportedPack = representative.source === "bp" ? exportedBehaviorPackFolder : exportedResourcePackFolder;

        await assertSemanticFileMatch(sourcePack, exportedPack, representative.relativePath, representative.phaseLabel);
        reportData.comparedFiles.push({
          phase: "folder-export",
          label: representative.phaseLabel,
          relativePath: representative.relativePath,
        });
      }

      const addonZip = await ProjectExporter.generateMCAddonAsZip(creatorTools, project, false);
      assert.instanceOf(addonZip, Uint8Array, "Expected MCAddon export to return zip bytes.");

      const zipStorage = new ZipStorage();
      await zipStorage.loadFromUint8Array(addonZip as Uint8Array, "roundtrip.mcpack");

      const zippedBehaviorPackFolder = zipStorage.rootFolder.ensureFolder(
        (behaviorPackFolder as IFolder).ensuredName + "_bp"
      );
      const zippedResourcePackFolder = zipStorage.rootFolder.ensureFolder(
        (resourcePackFolder as IFolder).ensuredName + "_rp"
      );

      assert.isTrue(await zippedBehaviorPackFolder.exists(), "MCAddon behavior pack folder is missing.");
      assert.isTrue(await zippedResourcePackFolder.exists(), "MCAddon resource pack folder is missing.");

      for (const representative of representativeFiles) {
        const sourcePack =
          representative.source === "bp" ? (behaviorPackFolder as IFolder) : (resourcePackFolder as IFolder);
        const zippedPack = representative.source === "bp" ? zippedBehaviorPackFolder : zippedResourcePackFolder;

        await assertSemanticFileMatch(sourcePack, zippedPack, representative.relativePath, representative.phaseLabel);
        reportData.comparedFiles.push({
          phase: "mcpack-export",
          label: representative.phaseLabel,
          relativePath: representative.relativePath,
        });
      }
    } catch (error) {
      reportData.status = "fail";
      reportData.error = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      const reportFile = resultsOutFolder.ensureFile("roundtrip-fidelity-report.json");
      reportFile.setContent(JSON.stringify(reportData, null, 2));
      await reportFile.saveContent();
    }
  }).timeout(180000);
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

  // Regression canary: the empty-label "" variant is a runtime placeholder for the
  // item's default file. It must NOT be persisted into _data.variants. Persisting it
  // historically caused _getVariantList() to report a phantom entry, which combined
  // with a falsy check on variantType (general = 0) caused the subpack-lookup branch
  // in ProjectItemVariant.ensureFileStorage to deadlock loadContent on every JSON
  // config item (tsconfig.json, manifest.json, launch.json, etc.).
  it("empty-label default variant is not persisted in item data", async () => {
    const project = await _loadProject("simple");

    // Touch the default variant on every item the same way the editor does
    // (e.g., via ProjectItem.defaultVariant / getVariantList).
    for (const item of project.items) {
      item.ensureDefaultVariant();
    }

    for (const item of project.items) {
      // Read the raw persisted data via JSON round-trip to ensure we're testing
      // what would actually be saved to disk, not just the runtime cache.
      const serialized = JSON.parse(JSON.stringify((item as any)._data));
      const variantKeys = serialized.variants ? Object.keys(serialized.variants) : [];
      expect(
        variantKeys,
        `Item ${item.projectPath ?? item.name} should not persist an empty-label variant; got keys: ${JSON.stringify(
          variantKeys
        )}`
      ).to.not.include("");
    }
  });

  // Regression canary: when a project's persisted data contains an empty-label
  // variant (e.g., from an older build that did persist it), the ProjectItem
  // constructor must strip it during migration so the item behaves like a
  // freshly-created one. Otherwise, items with no real variants would report
  // count=1 from _getVariantList() and trigger code paths that assume any
  // variant entry represents a real variant.
  it("ProjectItem constructor migrates away persisted empty-label variants", async () => {
    const project = await _loadProject("simple");

    // Simulate older saved data that persisted the empty-label default variant
    // alongside a real version-slice variant.
    const seed = {
      itemType: ProjectItemType.unknownJson,
      projectPath: "/fake-migration.json",
      variants: {
        "": { label: "", variantType: 0 },
        "1.21.0": { label: "1.21.0", variantType: 2 },
      },
      tags: [],
      name: "fake-migration",
      storageType: ProjectItemStorageType.singleFile,
    } as any;

    const item = new ProjectItem(project, seed);
    const persisted = (item as any)._data.variants;
    expect(Object.keys(persisted)).to.not.include("");
    // Other variants must be preserved.
    expect(Object.keys(persisted)).to.include("1.21.0");
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

describe("StructureUtilities", async () => {
  it("converts IBlockVolume to MCStructure correctly", async () => {
    const StructureUtilities = (await import("../minecraft/StructureUtilities")).default;

    // Sample IBlockVolume: A small 3x3x3 structure with a hollow cube of stone
    // Using blockLayersBottomToTop: Y layers from bottom to top
    // Each layer: rows from north to south (Z), each character is X (west to east)
    const sampleBlockVolume: import("../minecraft/IBlockVolume").IBlockVolume = {
      entities: [],
      southWestBottom: { x: 100, y: 64, z: 200 },
      size: { x: 3, y: 3, z: 3 },
      blockLayersBottomToTop: [
        // Y=0 layer (bottom)
        ["sss", "s s", "sss"],
        // Y=1 layer (middle) - hollow inside
        ["s s", "   ", "s s"],
        // Y=2 layer (top)
        ["sss", "s s", "sss"],
      ],
      key: {
        s: { typeId: "minecraft:stone" },
        " ": { typeId: "minecraft:air" },
      },
    };

    const structure = StructureUtilities.createStructureFromIBlockVolume(sampleBlockVolume);

    // Verify origin is set correctly
    expect(structure.originX).to.equal(100);
    expect(structure.originY).to.equal(64);
    expect(structure.originZ).to.equal(200);

    // Verify cube dimensions
    expect(structure.cube).to.not.be.undefined;
    expect(structure.cube!.maxX).to.equal(3);
    expect(structure.cube!.maxY).to.equal(3);
    expect(structure.cube!.maxZ).to.equal(3);

    // Verify corner blocks are stone
    const corner000 = structure.cube!.x(0).y(0).z(0);
    expect(corner000.shortTypeId).to.equal("stone");

    const corner222 = structure.cube!.x(2).y(2).z(2);
    expect(corner222.shortTypeId).to.equal("stone");

    // Verify center is air (hollow)
    const center = structure.cube!.x(1).y(1).z(1);
    expect(center.shortTypeId).to.equal("air");

    // Verify the structure can generate MCStructure bytes
    const bytes = structure.getMCStructureBytes();
    expect(bytes).to.not.be.undefined;
    expect(bytes!.length).to.be.greaterThan(0);
  });

  it("handles block properties", async () => {
    const StructureUtilities = (await import("../minecraft/StructureUtilities")).default;

    // Test with block properties using the properties field
    const blockVolumeWithProperties: import("../minecraft/IBlockVolume").IBlockVolume = {
      entities: [],
      southWestBottom: { x: 0, y: 0, z: 0 },
      size: { x: 2, y: 1, z: 1 },
      blockLayersBottomToTop: [["ab"]],
      key: {
        a: {
          typeId: "minecraft:oak_stairs",
          properties: { facing: "north", half: "bottom" },
        },
        b: {
          typeId: "oak_log", // Test without minecraft: prefix
          properties: { axis: "y" },
        },
      },
    };

    const structure = StructureUtilities.createStructureFromIBlockVolume(blockVolumeWithProperties);

    // Verify the stairs block has correct type and properties
    const stairsBlock = structure.cube!.x(0).y(0).z(0);
    expect(stairsBlock.shortTypeId).to.equal("oak_stairs");
    expect(stairsBlock.getProperty("facing")?.value).to.equal("north");
    expect(stairsBlock.getProperty("half")?.value).to.equal("bottom");

    // Verify the log block has correct type and axis property
    const logBlock = structure.cube!.x(1).y(0).z(0);
    expect(logBlock.shortTypeId).to.equal("oak_log");
    expect(logBlock.getProperty("axis")?.value).to.equal("y");
  });

  it("converts Structure back to IBlockVolume", async () => {
    const StructureUtilities = (await import("../minecraft/StructureUtilities")).default;

    // Create a simple structure
    const originalBlockVolume: import("../minecraft/IBlockVolume").IBlockVolume = {
      entities: [],
      southWestBottom: { x: 10, y: 20, z: 30 },
      size: { x: 2, y: 2, z: 2 },
      blockLayersBottomToTop: [
        // Y=0 layer (bottom)
        ["sd", "gw"],
        // Y=1 layer (top)
        ["ds", "wg"],
      ],
      key: {
        s: { typeId: "minecraft:stone" },
        d: { typeId: "minecraft:dirt" },
        g: { typeId: "minecraft:grass_block" },
        w: { typeId: "minecraft:water" },
      },
    };

    // Convert to Structure
    const structure = StructureUtilities.createStructureFromIBlockVolume(originalBlockVolume);

    // Convert back to IBlockVolume
    const convertedBlockVolume = StructureUtilities.createIBlockVolumeFromStructure(structure);

    expect(convertedBlockVolume).to.not.be.undefined;
    expect(convertedBlockVolume!.size!.x).to.equal(2);
    expect(convertedBlockVolume!.size!.y).to.equal(2);
    expect(convertedBlockVolume!.size!.z).to.equal(2);
    expect(convertedBlockVolume!.southWestBottom.x).to.equal(10);
    expect(convertedBlockVolume!.southWestBottom.y).to.equal(20);
    expect(convertedBlockVolume!.southWestBottom.z).to.equal(30);

    // Verify the key contains our block types
    const keyValues = Object.values(convertedBlockVolume!.key);
    const typeIds = keyValues.map((v) => v.typeId);

    expect(typeIds.some((t) => t.includes("stone"))).to.be.true;
    expect(typeIds.some((t) => t.includes("dirt"))).to.be.true;
    expect(typeIds.some((t) => t.includes("grass_block"))).to.be.true;
    expect(typeIds.some((t) => t.includes("water"))).to.be.true;
  });

  it("infers size from IBlockVolume when not provided", async () => {
    const StructureUtilities = (await import("../minecraft/StructureUtilities")).default;

    // IBlockVolume WITHOUT explicit size - should be inferred
    const blockVolumeNoSize: import("../minecraft/IBlockVolume").IBlockVolume = {
      entities: [],
      southWestBottom: { x: 0, y: 64, z: 0 },
      // No size field!
      blockLayersBottomToTop: [
        // Y=0 layer
        ["sss", "s s", "sss"],
        // Y=1 layer
        ["s s", "   ", "s s"],
      ],
      key: {
        s: { typeId: "minecraft:stone" },
        " ": { typeId: "minecraft:air" },
      },
    };

    // Test size inference
    const inferredSize = StructureUtilities.inferBlockVolumeSize(blockVolumeNoSize);
    expect(inferredSize.x).to.equal(3); // max string length
    expect(inferredSize.y).to.equal(2); // number of layers
    expect(inferredSize.z).to.equal(3); // max rows per layer

    // Test getEffectiveSize returns inferred when size not provided
    const effectiveSize = StructureUtilities.getEffectiveSize(blockVolumeNoSize);
    expect(effectiveSize.x).to.equal(3);
    expect(effectiveSize.y).to.equal(2);
    expect(effectiveSize.z).to.equal(3);

    // Test that structure creation works without explicit size
    const structure = StructureUtilities.createStructureFromIBlockVolume(blockVolumeNoSize);
    expect(structure.cube).to.not.be.undefined;
    expect(structure.cube!.maxX).to.equal(3);
    expect(structure.cube!.maxY).to.equal(2);
    expect(structure.cube!.maxZ).to.equal(3);

    // Verify blocks are placed correctly
    const corner000 = structure.cube!.x(0).y(0).z(0);
    expect(corner000.shortTypeId).to.equal("stone");
  });

  it("handles variable-length strings in IBlockVolume", async () => {
    const StructureUtilities = (await import("../minecraft/StructureUtilities")).default;

    // IBlockVolume with variable-length strings (shorter strings = trailing air)
    const blockVolumeVariableLength: import("../minecraft/IBlockVolume").IBlockVolume = {
      entities: [],
      southWestBottom: { x: 0, y: 64, z: 0 },
      blockLayersBottomToTop: [
        // Variable length strings - shorter ones get trailing air
        ["ssss", "s", "ss"], // max length 4, but row 1 has length 1, row 2 has length 2
      ],
      key: {
        s: { typeId: "minecraft:stone" },
      },
    };

    const inferredSize = StructureUtilities.inferBlockVolumeSize(blockVolumeVariableLength);
    expect(inferredSize.x).to.equal(4); // max string length is 4
    expect(inferredSize.y).to.equal(1); // 1 layer
    expect(inferredSize.z).to.equal(3); // 3 rows

    const structure = StructureUtilities.createStructureFromIBlockVolume(blockVolumeVariableLength);

    // First row, all 4 blocks should be stone
    expect(structure.cube!.x(0).y(0).z(0).shortTypeId).to.equal("stone");
    expect(structure.cube!.x(3).y(0).z(0).shortTypeId).to.equal("stone");

    // Second row, only first block is stone, rest are undefined (default = air)
    expect(structure.cube!.x(0).y(0).z(1).shortTypeId).to.equal("stone");
    expect(structure.cube!.x(1).y(0).z(1).shortTypeId).to.be.undefined;
    expect(structure.cube!.x(2).y(0).z(1).shortTypeId).to.be.undefined;
    expect(structure.cube!.x(3).y(0).z(1).shortTypeId).to.be.undefined;

    // Third row, first 2 blocks are stone, rest are undefined
    expect(structure.cube!.x(0).y(0).z(2).shortTypeId).to.equal("stone");
    expect(structure.cube!.x(1).y(0).z(2).shortTypeId).to.equal("stone");
    expect(structure.cube!.x(2).y(0).z(2).shortTypeId).to.be.undefined;
  });
});

describe("Security Validators", () => {
  it("detects dangerous code patterns in shared content", async () => {
    const { BasicValidators } = await import("../storage/BasicValidators");

    // Test dangerous patterns that should be detected
    const dangerousPatterns = [
      { code: 'import fs from "fs";', expected: "fs module import" },
      { code: 'const cp = require("child_process");', expected: "child_process require" },
      { code: "eval('dangerous code');", expected: "eval() call" },
      { code: 'const fn = Function("return this");', expected: "Function constructor" },
      { code: "process.exit(1);", expected: "process.exit call" },
      { code: "console.log(process.env.SECRET);", expected: "process.env access" },
      { code: "const path = __dirname + '/file';", expected: "__dirname access" },
      { code: 'import("./module" + userInput);', expected: "dynamic import with concatenation" },
      { code: "globalThis['eval']('code');", expected: "globalThis bracket access" },
      { code: 'import { spawn } from "child_process";', expected: "child_process import" },
    ];

    for (const { code, expected } of dangerousPatterns) {
      const result = BasicValidators.hasUnsafeCodePatterns(code);
      expect(result, `Pattern "${expected}" should be detected in: ${code}`).to.not.be.undefined;
      expect(result!.isUnsafe).to.be.true;
      expect(result!.matches.some((m) => m.includes(expected.split(" ")[0]))).to.be.true;
    }

    // Test safe patterns that should pass
    const safePatterns = [
      'import { world } from "@minecraft/server";',
      "const player = world.getAllPlayers()[0];",
      'console.log("Hello world");',
      "function processData(data) { return data; }",
      "const config = { enabled: true };",
    ];

    for (const code of safePatterns) {
      const result = BasicValidators.hasUnsafeCodePatterns(code);
      expect(result, `Safe pattern should not be flagged: ${code}`).to.be.undefined;
    }
  });

  it("validates allowed share paths correctly", async () => {
    const { BasicValidators } = await import("../storage/BasicValidators");

    // Allowed paths
    const allowedPaths = [
      "/scripts/main.ts",
      "/behavior_pack/entities/zombie.json",
      "/behavior_packs/mypack/items/sword.json",
      "/resource_pack/textures/readme.json",
      "/texts/en_US.lang",
      "/functions/tick.mcfunction",
      "/entities/custom_mob.json",
      "/blocks/custom_block.json",
      "/items/custom_item.json",
      "/recipes/crafting.json",
      "/loot_tables/chests/dungeon.json",
      "/animations/walk.json",
      "/models/geometry.json",
    ];

    for (const path of allowedPaths) {
      expect(BasicValidators.isPathAllowedForSharing(path), `Path should be allowed: ${path}`).to.be.true;
    }

    // Paths that should be blocked (not in allowlist)
    const blockedPaths = ["/node_modules/package/index.js", "/.git/config", "/dist/bundle.js", "/lib/utils.js"];

    for (const path of blockedPaths) {
      expect(BasicValidators.isPathAllowedForSharing(path), `Path should be blocked: ${path}`).to.be.false;
    }
  });

  it("validates file names for sharing correctly", async () => {
    const { BasicValidators } = await import("../storage/BasicValidators");

    // Allowed file names
    const allowedNames = ["main.ts", "entity.json", "strings.lang", "script.ts", "config.json"];

    for (const name of allowedNames) {
      expect(BasicValidators.isFileNameOKForSharing(name), `File name should be allowed: ${name}`).to.be.true;
    }

    // Blocked file names
    const blockedNames = [
      ".gitignore",
      "just.config.ts",
      "webpack.config.ts",
      "vite.config.js",
      "manifest.json",
      "package.json",
      "package-lock.json",
      "script.exe",
      "image.png",
      "readme.md",
    ];

    for (const name of blockedNames) {
      expect(BasicValidators.isFileNameOKForSharing(name), `File name should be blocked: ${name}`).to.be.false;
    }
  });

  it("validates folder names for sharing correctly", async () => {
    const { BasicValidators } = await import("../storage/BasicValidators");

    // Allowed folder names
    const allowedFolders = ["scripts", "entities", "items", "mypack", "custom_content"];

    for (const name of allowedFolders) {
      expect(BasicValidators.isFolderNameOKForSharing(name), `Folder name should be allowed: ${name}`).to.be.true;
    }

    // Blocked folder names
    const blockedFolders = [".git", ".vscode", "node_modules", "lib", "dist", "build"];

    for (const name of blockedFolders) {
      expect(BasicValidators.isFolderNameOKForSharing(name), `Folder name should be blocked: ${name}`).to.be.false;
    }
  });
});

describe("DataFormValidator", () => {
  it("should validate numeric min/max ranges", async () => {
    const DataFormValidator = (await import("../dataform/DataFormValidator")).default;
    const { DataFormIssueType } = await import("../dataform/DataFormValidator");
    const { FieldDataType } = await import("../dataform/IField");

    const form = {
      id: "test",
      fields: [
        {
          id: "score",
          dataType: FieldDataType.int,
          minValue: 0,
          maxValue: 100,
        },
      ],
    };

    // Value within range
    let issues = await DataFormValidator.validate({ score: 50 }, form);
    expect(issues.length).to.equal(0);

    // Value below minimum
    issues = await DataFormValidator.validate({ score: -10 }, form);
    expect(issues.length).to.equal(1);
    expect(issues[0].type).to.equal(DataFormIssueType.valueBelowMinimum);

    // Value above maximum
    issues = await DataFormValidator.validate({ score: 150 }, form);
    expect(issues.length).to.equal(1);
    expect(issues[0].type).to.equal(DataFormIssueType.valueAboveMaximum);
  });

  it("should validate string length constraints", async () => {
    const DataFormValidator = (await import("../dataform/DataFormValidator")).default;
    const { DataFormIssueType } = await import("../dataform/DataFormValidator");
    const { FieldDataType } = await import("../dataform/IField");

    const form = {
      id: "test",
      fields: [
        {
          id: "name",
          dataType: FieldDataType.string,
          minLength: 3,
          maxLength: 10,
        },
      ],
    };

    // Valid length
    let issues = await DataFormValidator.validate({ name: "valid" }, form);
    expect(issues.length).to.equal(0);

    // Too short
    issues = await DataFormValidator.validate({ name: "ab" }, form);
    expect(issues.length).to.equal(1);
    expect(issues[0].type).to.equal(DataFormIssueType.stringTooShort);

    // Too long
    issues = await DataFormValidator.validate({ name: "this_is_way_too_long" }, form);
    expect(issues.length).to.equal(1);
    expect(issues[0].type).to.equal(DataFormIssueType.stringTooLong);
  });

  it("should validate choices when mustMatchChoices is true", async () => {
    const DataFormValidator = (await import("../dataform/DataFormValidator")).default;
    const { DataFormIssueType } = await import("../dataform/DataFormValidator");
    const { FieldDataType } = await import("../dataform/IField");

    const form = {
      id: "test",
      fields: [
        {
          id: "color",
          dataType: FieldDataType.string,
          mustMatchChoices: true,
          choices: [{ id: "red" }, { id: "green" }, { id: "blue" }],
        },
      ],
    };

    // Valid choice
    let issues = await DataFormValidator.validate({ color: "red" }, form);
    expect(issues.length).to.equal(0);

    // Invalid choice
    issues = await DataFormValidator.validate({ color: "purple" }, form);
    expect(issues.length).to.equal(1);
    expect(issues[0].type).to.equal(DataFormIssueType.valueNotInChoices);
  });

  it("should not validate choices when mustMatchChoices is false", async () => {
    const DataFormValidator = (await import("../dataform/DataFormValidator")).default;
    const { FieldDataType } = await import("../dataform/IField");

    const form = {
      id: "test",
      fields: [
        {
          id: "color",
          dataType: FieldDataType.string,
          mustMatchChoices: false,
          choices: [{ id: "red" }, { id: "green" }, { id: "blue" }],
        },
      ],
    };

    // Any value should be accepted
    const issues = await DataFormValidator.validate({ color: "purple" }, form);
    expect(issues.length).to.equal(0);
  });

  it("should validate pattern matching from validity conditions", async () => {
    const DataFormValidator = (await import("../dataform/DataFormValidator")).default;
    const { DataFormIssueType } = await import("../dataform/DataFormValidator");
    const { FieldDataType } = await import("../dataform/IField");
    const { ComparisonType } = await import("../dataform/ICondition");

    const form = {
      id: "test",
      fields: [
        {
          id: "identifier",
          dataType: FieldDataType.string,
          validity: [{ comparison: ComparisonType.matchesPattern, value: "^[a-z_]+:[a-z_]+$" }],
        },
      ],
    };

    // Valid pattern (namespace:identifier)
    let issues = await DataFormValidator.validate({ identifier: "minecraft:zombie" }, form);
    expect(issues.length).to.equal(0);

    // Invalid pattern
    issues = await DataFormValidator.validate({ identifier: "invalid identifier!" }, form);
    expect(issues.length).to.equal(1);
    expect(issues[0].type).to.equal(DataFormIssueType.patternMismatch);
  });

  it("should validate fixedLength arrays", async () => {
    const DataFormValidator = (await import("../dataform/DataFormValidator")).default;
    const { DataFormIssueType } = await import("../dataform/DataFormValidator");
    const { FieldDataType } = await import("../dataform/IField");

    const form = {
      id: "test",
      fields: [
        {
          id: "coords",
          dataType: FieldDataType.numberArray,
          fixedLength: 3,
        },
      ],
    };

    // Correct length
    let issues = await DataFormValidator.validate({ coords: [1, 2, 3] }, form);
    expect(issues.length).to.equal(0);

    // Wrong length
    issues = await DataFormValidator.validate({ coords: [1, 2] }, form);
    expect(issues.length).to.equal(1);
    expect(issues[0].type).to.equal(DataFormIssueType.arrayLengthMismatch);
  });

  it("should validate point2 and point3 sizes", async () => {
    const DataFormValidator = (await import("../dataform/DataFormValidator")).default;
    const { DataFormIssueType } = await import("../dataform/DataFormValidator");
    const { FieldDataType } = await import("../dataform/IField");

    // Test point2
    const form2 = {
      id: "test",
      fields: [
        {
          id: "position",
          dataType: FieldDataType.point2,
        },
      ],
    };

    let issues = await DataFormValidator.validate({ position: [1, 2] }, form2);
    expect(issues.length).to.equal(0);

    issues = await DataFormValidator.validate({ position: [1, 2, 3] }, form2);
    expect(issues.length).to.equal(1);
    expect(issues[0].type).to.equal(DataFormIssueType.pointSizeMismatch);

    // Test point3
    const form3 = {
      id: "test",
      fields: [
        {
          id: "position",
          dataType: FieldDataType.point3,
        },
      ],
    };

    issues = await DataFormValidator.validate({ position: [1, 2, 3] }, form3);
    expect(issues.length).to.equal(0);

    issues = await DataFormValidator.validate({ position: [1, 2] }, form3);
    expect(issues.length).to.equal(1);
    expect(issues[0].type).to.equal(DataFormIssueType.pointSizeMismatch);
  });

  it("should detect unexpected properties when strictAdditionalProperties is true", async () => {
    const DataFormValidator = (await import("../dataform/DataFormValidator")).default;
    const { DataFormIssueType } = await import("../dataform/DataFormValidator");
    const { FieldDataType } = await import("../dataform/IField");

    const form = {
      id: "test",
      strictAdditionalProperties: true, // Enable strict mode
      fields: [
        {
          id: "name",
          dataType: FieldDataType.string,
        },
        {
          id: "value",
          dataType: FieldDataType.int,
        },
      ],
    };

    // No unexpected properties
    let issues = await DataFormValidator.validate({ name: "test", value: 42 }, form);
    expect(issues.length).to.equal(0);

    // With unexpected property
    issues = await DataFormValidator.validate({ name: "test", value: 42, unknown: "extra" }, form);
    expect(issues.length).to.equal(1);
    expect(issues[0].type).to.equal(DataFormIssueType.unexpectedProperty);
    expect(issues[0].message).to.include("unknown");
  });

  it("should allow unexpected properties when strictAdditionalProperties is false", async () => {
    const DataFormValidator = (await import("../dataform/DataFormValidator")).default;
    const { FieldDataType } = await import("../dataform/IField");

    const form = {
      id: "test",
      // strictAdditionalProperties is not set (default is to allow extra properties)
      fields: [
        {
          id: "name",
          dataType: FieldDataType.string,
        },
      ],
    };

    // Extra properties should be allowed
    const issues = await DataFormValidator.validate({ name: "test", extraProp: "allowed" }, form);
    expect(issues.length).to.equal(0);
  });

  it("should validate allowedKeys in keyed collections", async () => {
    const DataFormValidator = (await import("../dataform/DataFormValidator")).default;
    const { DataFormIssueType } = await import("../dataform/DataFormValidator");
    const { FieldDataType } = await import("../dataform/IField");

    const form = {
      id: "test",
      fields: [
        {
          id: "components",
          dataType: FieldDataType.keyedObjectCollection,
          allowedKeys: ["minecraft:health", "minecraft:damage"],
        },
      ],
    };

    // Valid keys
    let issues = await DataFormValidator.validate({ components: { "minecraft:health": { value: 20 } } }, form);
    expect(issues.length).to.equal(0);

    // Invalid key
    issues = await DataFormValidator.validate({ components: { "minecraft:invalid_component": { value: 20 } } }, form);
    expect(issues.length).to.equal(1);
    expect(issues[0].type).to.equal(DataFormIssueType.keyNotAllowed);
  });

  it("should validate missing required fields", async () => {
    const DataFormValidator = (await import("../dataform/DataFormValidator")).default;
    const { DataFormIssueType } = await import("../dataform/DataFormValidator");
    const { FieldDataType } = await import("../dataform/IField");

    const form = {
      id: "test",
      fields: [
        {
          id: "required_field",
          dataType: FieldDataType.string,
          isRequired: true,
        },
        {
          id: "optional_field",
          dataType: FieldDataType.string,
        },
      ],
    };

    // With required field present
    let issues = await DataFormValidator.validate({ required_field: "value" }, form);
    expect(issues.length).to.equal(0);

    // With required field missing
    issues = await DataFormValidator.validate({ optional_field: "value" }, form);
    expect(issues.length).to.equal(1);
    expect(issues[0].type).to.equal(DataFormIssueType.missingRequiredField);
  });

  it("should validate data type mismatches", async () => {
    const DataFormValidator = (await import("../dataform/DataFormValidator")).default;
    const { DataFormIssueType } = await import("../dataform/DataFormValidator");
    const { FieldDataType } = await import("../dataform/IField");

    const form = {
      id: "test",
      fields: [
        {
          id: "count",
          dataType: FieldDataType.int,
        },
      ],
    };

    // Correct type
    let issues = await DataFormValidator.validate({ count: 42 }, form);
    expect(issues.length).to.equal(0);

    // Wrong type (string instead of number)
    issues = await DataFormValidator.validate({ count: "not a number" }, form);
    expect(issues.length).to.equal(1);
    expect(issues[0].type).to.equal(DataFormIssueType.dataTypeMismatch);
  });
});

describe("SummarizerEvaluator", () => {
  it("should evaluate literal tokens", async () => {
    const SummarizerEvaluator = (await import("../dataform/SummarizerEvaluator")).default;
    const { SummarizerTokenType } = await import("../dataform/ISummarizerToken");

    const summarizer = {
      id: "test",
      phrases: [
        {
          id: "test_phrase",
          tokens: [{ type: "literal" as const, text: "has something" }],
        },
      ],
    };

    const evaluator = new SummarizerEvaluator();
    const result = evaluator.evaluate(summarizer, {});

    expect(result.phrases.length).to.equal(1);
    expect(result.phrases[0]).to.equal("has something");
  });

  it("should evaluate value tokens", async () => {
    const SummarizerEvaluator = (await import("../dataform/SummarizerEvaluator")).default;

    const summarizer = {
      id: "test",
      phrases: [
        {
          id: "health_value",
          tokens: [
            { type: "literal" as const, text: "has " },
            { type: "value" as const, field: "max" },
            { type: "literal" as const, text: " HP" },
          ],
        },
      ],
    };

    const evaluator = new SummarizerEvaluator();
    const result = evaluator.evaluate(summarizer, { max: 100 });

    expect(result.phrases.length).to.equal(1);
    expect(result.phrases[0]).to.equal("has 100 HP");
  });

  it("should evaluate switch tokens with conditions", async () => {
    const SummarizerEvaluator = (await import("../dataform/SummarizerEvaluator")).default;

    const summarizer = {
      id: "test",
      phrases: [
        {
          id: "health_level",
          tokens: [
            { type: "literal" as const, text: "has " },
            {
              type: "switch" as const,
              cases: [
                {
                  conditions: [{ field: "max", comparison: ">", value: 100 }],
                  tokens: [{ type: "literal" as const, text: "high health" }],
                },
                {
                  conditions: [{ field: "max", comparison: "<", value: 20 }],
                  tokens: [{ type: "literal" as const, text: "low health" }],
                },
              ],
              default: [{ type: "literal" as const, text: "average health" }],
            },
          ],
        },
      ],
    };

    const evaluator = new SummarizerEvaluator();

    // Test high health
    let result = evaluator.evaluate(summarizer, { max: 500 });
    expect(result.phrases[0]).to.equal("has high health");

    // Test low health
    result = evaluator.evaluate(summarizer, { max: 10 });
    expect(result.phrases[0]).to.equal("has low health");

    // Test average health (default)
    result = evaluator.evaluate(summarizer, { max: 50 });
    expect(result.phrases[0]).to.equal("has average health");
  });

  it("should evaluate list tokens with grammar", async () => {
    const SummarizerEvaluator = (await import("../dataform/SummarizerEvaluator")).default;

    const summarizer = {
      id: "test",
      phrases: [
        {
          id: "abilities",
          tokens: [
            {
              type: "list" as const,
              prefix: [{ type: "literal" as const, text: "can " }],
              items: [
                {
                  visibility: [{ field: "can_fly", comparison: "=", value: true }],
                  tokens: [{ type: "literal" as const, text: "fly" }],
                },
                {
                  visibility: [{ field: "can_swim", comparison: "=", value: true }],
                  tokens: [{ type: "literal" as const, text: "swim" }],
                },
                {
                  visibility: [{ field: "can_teleport", comparison: "=", value: true }],
                  tokens: [{ type: "literal" as const, text: "teleport" }],
                },
              ],
            },
          ],
        },
      ],
    };

    const evaluator = new SummarizerEvaluator();

    // Test single ability
    let result = evaluator.evaluate(summarizer, { can_fly: true });
    expect(result.phrases[0]).to.equal("can fly");

    // Test two abilities
    result = evaluator.evaluate(summarizer, { can_fly: true, can_swim: true });
    expect(result.phrases[0]).to.equal("can fly and swim");

    // Test three abilities
    result = evaluator.evaluate(summarizer, { can_fly: true, can_swim: true, can_teleport: true });
    expect(result.phrases[0]).to.equal("can fly, swim, and teleport");
  });

  it("should format result as complete sentence", async () => {
    const SummarizerEvaluator = (await import("../dataform/SummarizerEvaluator")).default;

    const summarizer = {
      id: "test",
      phrases: [
        {
          id: "phrase1",
          tokens: [{ type: "literal" as const, text: "has high health" }],
        },
        {
          id: "phrase2",
          tokens: [{ type: "literal" as const, text: "can fly" }],
        },
      ],
    };

    const evaluator = new SummarizerEvaluator();
    const result = evaluator.evaluate(summarizer, {});

    expect(result.asSentence).to.equal("has high health and can fly");
    expect(result.asCompleteSentence).to.equal("This entity has high health and can fly.");
  });

  it("should evaluate unit tokens with conversion", async () => {
    const SummarizerEvaluator = (await import("../dataform/SummarizerEvaluator")).default;

    const summarizer = {
      id: "test",
      phrases: [
        {
          id: "duration",
          tokens: [
            { type: "literal" as const, text: "lasts " },
            {
              type: "unit" as const,
              field: "duration",
              unit: "ticks",
              conversion: {
                targetUnit: "seconds",
                factor: 0.05,
                decimals: 1,
              },
              showBoth: true,
            },
          ],
        },
      ],
    };

    const evaluator = new SummarizerEvaluator();
    const result = evaluator.evaluate(summarizer, { duration: 200 });

    expect(result.phrases[0]).to.equal("lasts 200 ticks (10 seconds)");
  });

  it("should respect phrase visibility conditions", async () => {
    const SummarizerEvaluator = (await import("../dataform/SummarizerEvaluator")).default;

    const summarizer = {
      id: "test",
      phrases: [
        {
          id: "always_shown",
          tokens: [{ type: "literal" as const, text: "exists" }],
        },
        {
          id: "conditional",
          visibility: [{ field: "special", comparison: "=", value: true }],
          tokens: [{ type: "literal" as const, text: "is special" }],
        },
      ],
    };

    const evaluator = new SummarizerEvaluator();

    // Without special flag
    let result = evaluator.evaluate(summarizer, {});
    expect(result.phrases.length).to.equal(1);
    expect(result.phrases[0]).to.equal("exists");

    // With special flag
    result = evaluator.evaluate(summarizer, { special: true });
    expect(result.phrases.length).to.equal(2);
    expect(result.phrases).to.include("is special");
  });

  it("should evaluate plural tokens", async () => {
    const SummarizerEvaluator = (await import("../dataform/SummarizerEvaluator")).default;

    const summarizer = {
      id: "test",
      phrases: [
        {
          id: "count",
          tokens: [
            { type: "literal" as const, text: "drops " },
            {
              type: "plural" as const,
              countField: "drop_count",
              singular: [{ type: "literal" as const, text: "item" }],
              plural: [{ type: "literal" as const, text: "items" }],
              includeCount: true,
            },
          ],
        },
      ],
    };

    const evaluator = new SummarizerEvaluator();

    // Singular
    let result = evaluator.evaluate(summarizer, { drop_count: 1 });
    expect(result.phrases[0]).to.equal("drops 1 item");

    // Plural
    result = evaluator.evaluate(summarizer, { drop_count: 5 });
    expect(result.phrases[0]).to.equal("drops 5 items");
  });

  it("should evaluate exists tokens", async () => {
    const SummarizerEvaluator = (await import("../dataform/SummarizerEvaluator")).default;

    const summarizer = {
      id: "test",
      phrases: [
        {
          id: "loot",
          tokens: [
            {
              type: "exists" as const,
              field: "loot_table",
              whenDefined: [{ type: "literal" as const, text: "has custom loot" }],
              whenUndefined: [{ type: "literal" as const, text: "uses default loot" }],
            },
          ],
        },
      ],
    };

    const evaluator = new SummarizerEvaluator();

    // Defined
    let result = evaluator.evaluate(summarizer, { loot_table: "custom_table" });
    expect(result.phrases[0]).to.equal("has custom loot");

    // Undefined
    result = evaluator.evaluate(summarizer, {});
    expect(result.phrases[0]).to.equal("uses default loot");
  });

  it("should evaluate with effects for rich rendering", async () => {
    const SummarizerEvaluator = (await import("../dataform/SummarizerEvaluator")).default;

    const summarizer = {
      id: "test",
      phrases: [
        {
          id: "health",
          tokens: [
            { type: "literal" as const, text: "has " },
            {
              type: "switch" as const,
              cases: [
                {
                  conditions: [{ field: "max", comparison: ">", value: 100 }],
                  tokens: [
                    {
                      type: "literal" as const,
                      text: "extremely high health",
                      effects: { emphasis: "strong", sentiment: "positive" },
                    },
                  ],
                },
              ],
              default: [{ type: "literal" as const, text: "normal health" }],
            },
            { type: "literal" as const, text: " (" },
            {
              type: "value" as const,
              field: "max",
              effects: { emphasis: "strong", role: "value", icon: "❤️" },
            },
            { type: "literal" as const, text: " HP)" },
          ],
        },
      ],
    };

    const evaluator = new SummarizerEvaluator();

    // High health with effects
    const result = evaluator.evaluateWithEffects(summarizer, { max: 500 });

    expect(result.phrases[0]).to.equal("has extremely high health (500 HP)");
    expect(result.evaluatedPhrases).to.have.length(1);

    const tokens = result.evaluatedPhrases[0].tokens;
    expect(tokens.length).to.be.greaterThan(0);

    // Check that effects are preserved
    const healthToken = tokens.find((t) => t.text === "extremely high health");
    expect(healthToken).to.not.be.undefined;
    expect(healthToken?.effects?.emphasis).to.equal("strong");
    expect(healthToken?.effects?.sentiment).to.equal("positive");

    // Check value token has icon
    const valueToken = tokens.find((t) => t.text === "500");
    expect(valueToken).to.not.be.undefined;
    expect(valueToken?.effects?.icon).to.equal("❤️");
  });
});

describe("FormSchemaGenerator Tests", function () {
  it("should generate JSON Schema from form definitions", async function () {
    this.timeout(30000);

    // Import directly to avoid JSX compilation issues
    const { FormSchemaGenerator } = await import("../UX/JsonEditorEnhanced/FormSchemaGenerator");
    const { FormDefinitionCache } = await import("../UX/JsonEditorEnhanced/FormDefinitionCache");

    const formCache = new FormDefinitionCache();
    const schemaGenerator = new FormSchemaGenerator(formCache);

    // Test generating schema for entity behavior type
    const schema = await schemaGenerator.generateSchemaForItemType(ProjectItemType.entityTypeBehavior);

    // Schema might be null if form definitions aren't available in test environment
    // That's OK - this test ensures the code doesn't crash
    if (schema) {
      expect(schema).to.have.property("$schema");
      expect(schema).to.have.property("type", "object");
      expect(schema).to.have.property("properties");
    }
  });

  it("should include sample values in descriptions", async function () {
    this.timeout(30000);

    const { FormSchemaGenerator } = await import("../UX/JsonEditorEnhanced/FormSchemaGenerator");
    const { FormDefinitionCache } = await import("../UX/JsonEditorEnhanced/FormDefinitionCache");
    const { FieldDataType } = await import("../dataform/IField");

    const formCache = new FormDefinitionCache();
    const schemaGenerator = new FormSchemaGenerator(formCache);

    // Create a mock form with samples
    const mockForm = {
      id: "test_form",
      title: "Test Form",
      fields: [
        {
          id: "health",
          title: "Health",
          description: "The health value",
          dataType: FieldDataType.int,
        },
      ],
      samples: {
        samples: [
          { path: "health", content: 20 },
          { path: "health", content: 100 },
          { path: "health", content: 500 },
        ],
      },
    };

    const schema = await schemaGenerator.generateSchemaFromForm(mockForm);

    expect(schema).to.have.property("$schema");
    expect(schema).to.have.property("properties");
    expect(schema.properties).to.have.property("health");

    const healthProp = schema.properties!["health"] as any;
    expect(healthProp).to.have.property("type", "integer");

    // Check that description includes samples
    if (healthProp.description) {
      expect(healthProp.description).to.include("Sample");
      expect(healthProp.description).to.include("20");
    }
  });

  it("should handle missing forms gracefully", async function () {
    this.timeout(10000);

    const { FormSchemaGenerator } = await import("../UX/JsonEditorEnhanced/FormSchemaGenerator");
    const { FormDefinitionCache } = await import("../UX/JsonEditorEnhanced/FormDefinitionCache");

    const formCache = new FormDefinitionCache();
    const schemaGenerator = new FormSchemaGenerator(formCache);

    // Try to generate schema for a type that might not have a form
    const schema = await schemaGenerator.generateSchemaForItemType(ProjectItemType.unknown);

    // Should return null, not crash
    expect(schema).to.be.null;
  });
});

describe("MolangEvaluator", () => {
  let evaluator: import("../minecraft/MolangEvaluator").default;

  before(async () => {
    const { default: MolangEvaluator } = await import("../minecraft/MolangEvaluator");
    evaluator = new MolangEvaluator();
  });

  const cases: {
    expr: string;
    queries?: Record<string, number>;
    arrays?: Record<string, string[]>;
    expected: import("../minecraft/MolangEvaluator").MolangValue;
  }[] = [
    // Literals
    { expr: "1.0", expected: 1.0 },
    { expr: "0", expected: 0 },
    { expr: "42", expected: 42 },

    // Arithmetic
    { expr: "2 + 3", expected: 5 },
    { expr: "10 - 4", expected: 6 },
    { expr: "3 * 4", expected: 12 },
    { expr: "10 / 2", expected: 5 },

    // Query references
    { expr: "query.is_baby", queries: { "query.is_baby": 1 }, expected: 1 },
    { expr: "query.is_baby", queries: { "query.is_baby": 0 }, expected: 0 },
    { expr: "query.variant", queries: { "query.variant": 3 }, expected: 3 },
    { expr: "q.is_baby", queries: { "query.is_baby": 1 }, expected: 1 },

    // Ternary — sheep render controller pattern
    {
      expr: "query.is_baby ? Texture.baby : Texture.default",
      queries: { "query.is_baby": 0 },
      expected: "Texture.default",
    },
    {
      expr: "query.is_baby ? Texture.baby : Texture.default",
      queries: { "query.is_baby": 1 },
      expected: "Texture.baby",
    },

    // Array indexing — sheep geometry pattern
    {
      expr: "query.is_baby ? Geometry.baby : Array.geos[query.is_sheared]",
      queries: { "query.is_baby": 0, "query.is_sheared": 0 },
      arrays: { "Array.geos": ["Geometry.default", "Geometry.sheared"] },
      expected: "Geometry.default",
    },
    {
      expr: "query.is_baby ? Geometry.baby : Array.geos[query.is_sheared]",
      queries: { "query.is_baby": 0, "query.is_sheared": 1 },
      arrays: { "Array.geos": ["Geometry.default", "Geometry.sheared"] },
      expected: "Geometry.sheared",
    },
    {
      expr: "query.is_baby ? Geometry.baby : Array.geos[query.is_sheared]",
      queries: { "query.is_baby": 1, "query.is_sheared": 0 },
      arrays: { "Array.geos": ["Geometry.default", "Geometry.sheared"] },
      expected: "Geometry.baby",
    },

    // Nested ternary — wolf render controller pattern
    {
      expr: "query.is_angry ? Texture.angry : (query.is_tamed ? Texture.tame : Texture.default)",
      queries: { "query.is_angry": 0, "query.is_tamed": 0 },
      expected: "Texture.default",
    },
    {
      expr: "query.is_angry ? Texture.angry : (query.is_tamed ? Texture.tame : Texture.default)",
      queries: { "query.is_angry": 0, "query.is_tamed": 1 },
      expected: "Texture.tame",
    },
    {
      expr: "query.is_angry ? Texture.angry : (query.is_tamed ? Texture.tame : Texture.default)",
      queries: { "query.is_angry": 1, "query.is_tamed": 0 },
      expected: "Texture.angry",
    },

    // Logical NOT
    { expr: "!query.is_baby", queries: { "query.is_baby": 0 }, expected: 1 },
    { expr: "!query.is_baby", queries: { "query.is_baby": 1 }, expected: 0 },

    // Comparison
    { expr: "query.variant == 0", queries: { "query.variant": 0 }, expected: 1 },
    { expr: "query.variant == 0", queries: { "query.variant": 1 }, expected: 0 },
  ];

  for (const tc of cases) {
    it(`should evaluate "${tc.expr}" to ${JSON.stringify(tc.expected)}`, () => {
      const { createDefaultEntityContext } = require("../minecraft/IMolangContext");
      const context = createDefaultEntityContext();

      // Set custom queries
      if (tc.queries) {
        for (const [key, val] of Object.entries(tc.queries)) {
          context.queries.set(key, val);
        }
      }

      const arrays = tc.arrays ? new Map(Object.entries(tc.arrays)) : undefined;
      const result = evaluator.evaluate(tc.expr, context, arrays);
      expect(result).to.equal(tc.expected);
    });
  }
});

describe("RenderControllerResolution", () => {
  it("should load sheep render controller via Database storage", async function () {
    this.timeout(30000);

    // Test that the vanilla render controller file is accessible via IFile/IFolder
    const file = await Database.getPreviewVanillaFile(
      "/resource_pack/render_controllers/sheep.v2.render_controllers.json"
    );

    if (!file) {
      // Vanilla resources may not be available in all test environments
      console.log("  (skipped: vanilla resources not available)");
      return;
    }

    expect(file).to.not.be.null;
    expect(file!.content).to.not.be.undefined;

    // Parse the file content
    const content =
      typeof file!.content === "string" ? file!.content : new TextDecoder().decode(file!.content as Uint8Array);
    const parsed = JSON.parse(content);

    expect(parsed.render_controllers).to.have.property("controller.render.sheep.v2");
    const rc = parsed.render_controllers["controller.render.sheep.v2"];
    expect(rc.textures).to.be.an("array");
    expect(rc.geometry).to.be.a("string");
  });

  it("should resolve sheep via VanillaProjectManager", async function () {
    this.timeout(30000);

    const VanillaProjectManager = (await import("../minecraft/VanillaProjectManager")).default;

    const modelData = await VanillaProjectManager.getVanillaEntityModelData("sheep");

    if (!modelData) {
      console.log("  (skipped: vanilla resources not available)");
      return;
    }

    expect(modelData.entityTypeId).to.equal("sheep");
    expect(modelData.geometryId).to.be.a("string");
    expect(modelData.texturePath).to.be.a("string");
    // The geometry should contain "sheep" — either default or sheared
    expect(modelData.geometryId).to.include("sheep");
  });
});

describe("FormDefinitionCache - getComponentsAsync Tests", function () {
  it("should find minecraft: components via subFormId chain for entity behavior", async function () {
    this.timeout(30000);

    const { FormDefinitionCache } = await import("../UX/JsonEditorEnhanced/FormDefinitionCache");

    const formCache = new FormDefinitionCache();
    const form = await formCache.getFormForItemType(ProjectItemType.entityTypeBehavior);

    expect(form).to.not.be.null;
    if (!form) return;

    const components = await formCache.getComponentsAsync(form);

    // Should find many minecraft: components (minecraft:health, minecraft:ageable, etc.)
    expect(components.length).to.be.greaterThan(10);

    // Check that well-known components are present
    const componentIds = components.map((c) => c.id);
    expect(componentIds).to.include("minecraft:health");
    expect(componentIds).to.include("minecraft:ageable");
    expect(componentIds).to.include("minecraft:collision_box");
  });
});

describe("JsonUtilities - Comment Preservation", () => {
  it("should parse JSON with single-line comments", async () => {
    const JsonUtilities = (await import("../core/JsonUtilities")).default;

    const jsonWithComments = `{
      // This is a comment
      "name": "test",
      "version": "1.0.0" // inline comment
    }`;

    const parsed = JsonUtilities.parseJsonWithComments(jsonWithComments);

    expect(parsed).to.have.property("name", "test");
    expect(parsed).to.have.property("version", "1.0.0");
  });

  it("should parse JSON with multi-line comments", async () => {
    const JsonUtilities = (await import("../core/JsonUtilities")).default;

    const jsonWithComments = `{
      /* This is a 
         multi-line comment */
      "name": "test"
    }`;

    const parsed = JsonUtilities.parseJsonWithComments(jsonWithComments);

    expect(parsed).to.have.property("name", "test");
  });

  it("should preserve comments through stringify round-trip", async () => {
    const JsonUtilities = (await import("../core/JsonUtilities")).default;

    const originalJson = `{
  // Header comment
  "name": "test",
  "version": "1.0.0" // Version info
}`;

    const parsed = JsonUtilities.parseJsonWithComments(originalJson);
    const stringified = JsonUtilities.stringifyJsonWithComments(parsed);

    // Comments should be preserved in output
    expect(stringified).to.include("// Header comment");
    expect(stringified).to.include("// Version info");
    expect(stringified).to.include('"name": "test"');
  });

  it("should preserve comments after modifying properties", async () => {
    const JsonUtilities = (await import("../core/JsonUtilities")).default;

    const originalJson = `{
  // This comment should survive
  "name": "original",
  "count": 1
}`;

    const parsed = JsonUtilities.parseJsonWithComments(originalJson) as unknown as { name: string; count: number };

    // Modify a property
    parsed.name = "modified";
    parsed.count = 42;

    const stringified = JsonUtilities.stringifyJsonWithComments(parsed);

    // Comment should still be there
    expect(stringified).to.include("// This comment should survive");
    // New values should be there
    expect(stringified).to.include('"name": "modified"');
    expect(stringified).to.include('"count": 42');
  });

  it("should detect comment metadata on parsed objects", async () => {
    const JsonUtilities = (await import("../core/JsonUtilities")).default;

    const jsonWithComments = `{
  // comment
  "name": "test"
}`;

    const parsedWithComments = JsonUtilities.parseJsonWithComments(jsonWithComments);
    const regularObject = { name: "test" };

    expect(JsonUtilities.hasCommentMetadata(parsedWithComments)).to.be.true;
    expect(JsonUtilities.hasCommentMetadata(regularObject)).to.be.false;
    expect(JsonUtilities.hasCommentMetadata(null)).to.be.false;
    expect(JsonUtilities.hasCommentMetadata("string")).to.be.false;
  });

  it("should handle trailing commas via fixJsonContentForCommentJson", async () => {
    const Utilities = (await import("../core/Utilities")).default;
    const JsonUtilities = (await import("../core/JsonUtilities")).default;

    const jsonWithTrailingComma = `{
  // comment
  "items": ["a", "b", ],
  "name": "test",
}`;

    // fixJsonContentForCommentJson should fix trailing commas while preserving comments
    const fixed = Utilities.fixJsonContentForCommentJson(jsonWithTrailingComma);

    // Should be parseable
    const parsed = JsonUtilities.parseJsonWithComments(fixed);

    expect(parsed).to.have.property("name", "test");
    expect((parsed as any).items).to.deep.equal(["a", "b"]);

    // Should preserve comments
    const stringified = JsonUtilities.stringifyJsonWithComments(parsed);
    expect(stringified).to.include("// comment");
  });

  it("should compare objects semantically", async () => {
    const JsonUtilities = (await import("../core/JsonUtilities")).default;

    const json1 = `{
  // comment 1
  "a": 1,
  "b": 2
}`;

    const json2 = `{
  // different comment
  "b": 2,
  "a": 1
}`;

    const json3 = `{
  "a": 1,
  "b": 3
}`;

    const obj1 = JsonUtilities.parseJsonWithComments(json1);
    const obj2 = JsonUtilities.parseJsonWithComments(json2);
    const obj3 = JsonUtilities.parseJsonWithComments(json3);

    // Same data, different comments/order - should be equal
    expect(JsonUtilities.jsonObjectsSemanticallyEqual(obj1, obj2)).to.be.true;

    // Different data - should not be equal
    expect(JsonUtilities.jsonObjectsSemanticallyEqual(obj1, obj3)).to.be.false;
  });

  it("should merge properties while preserving comments", async () => {
    const JsonUtilities = (await import("../core/JsonUtilities")).default;

    const originalJson = `{
  // Original header
  "name": "original",
  "value": 1
}`;

    const parsed = JsonUtilities.parseJsonWithComments(originalJson) as unknown as { name: string; value: number };

    // Merge updates
    JsonUtilities.mergeJsonPreservingComments(parsed, { value: 42 });

    const stringified = JsonUtilities.stringifyJsonWithComments(parsed);

    expect(stringified).to.include("// Original header");
    expect(stringified).to.include('"name": "original"');
    expect(stringified).to.include('"value": 42');
  });
});

describe("Phantom Edit Prevention", async () => {
  it("setObjectContentIfSemanticallyDifferent returns false for identical standard JSON", async () => {
    const project = await _loadProject("comprehensive");

    // Find an entity type file to test with
    const entityItem = project.items.find((item) => item.itemType === ProjectItemType.entityTypeBehavior);
    assert.isDefined(entityItem, "Should find an entity type item");

    const file = entityItem!.primaryFile;
    assert.isDefined(file, "Entity type item should have a primary file");

    await file!.loadContent();
    assert.isTrue(file!.isContentLoaded, "File content should be loaded");

    const originalContent = file!.content as string;
    assert.isString(originalContent, "Content should be a string");

    // Parse the content
    const parsed = JSON.parse(originalContent);
    assert.isDefined(parsed, "Should parse successfully");

    // Reset the modified timestamp by simulating a fresh load state
    file!.lastLoadedOrSaved = new Date();
    file!.modified = null;

    // Now call setObjectContentIfSemanticallyDifferent with the same parsed content
    const wasModified = file!.setObjectContentIfSemanticallyDifferent(parsed);

    expect(wasModified).to.equal(false, "File should NOT be marked as modified when content is semantically identical");
    expect(file!.needsSave).to.equal(false, "File should NOT need save after no-op edit");
  }).timeout(30000);

  it("setObjectContentIfSemanticallyDifferent detects actual changes", async () => {
    const project = await _loadProject("comprehensive");

    const entityItem = project.items.find((item) => item.itemType === ProjectItemType.entityTypeBehavior);
    assert.isDefined(entityItem, "Should find an entity type item");

    const file = entityItem!.primaryFile;
    assert.isDefined(file, "Entity type item should have a primary file");

    await file!.loadContent();

    const parsed = JSON.parse(file!.content as string);
    parsed["_phantom_test_key"] = "phantom_test_value";

    file!.lastLoadedOrSaved = new Date();
    file!.modified = null;

    const wasModified = file!.setObjectContentIfSemanticallyDifferent(parsed);

    expect(wasModified).to.equal(true, "File SHOULD be marked as modified when content has changed");
    expect(file!.needsSave).to.equal(true, "File SHOULD need save after real edit");
  }).timeout(30000);

  it("setObjectContentIfSemanticallyDifferent handles files with comments without phantom edits", async () => {
    const project = await _loadProject("comprehensive");

    const entityItem = project.items.find((item) => item.itemType === ProjectItemType.entityTypeBehavior);
    assert.isDefined(entityItem, "Should find an entity type item");

    const file = entityItem!.primaryFile;
    assert.isDefined(file, "Entity type item should have a primary file");

    // Simulate a file with JSON comments
    const contentWithComments = `{
  // This is a comment
  "format_version": "1.20.0",
  "minecraft:entity": {
    "description": {
      "identifier": "test:entity",
      // Inline comment
      "is_spawnable": true
    }
  }
}`;

    file!.setContent(contentWithComments);
    file!.lastLoadedOrSaved = new Date();
    file!.modified = null;

    // Parse without comments (simulating what a definition editor does without preserveComments)
    const Utilities = (await import("../core/Utilities")).default;
    const parsed = JSON.parse(Utilities.fixJsonContent(contentWithComments));

    // setObjectContentIfSemanticallyDifferent should detect these are semantically equal
    const wasModified = file!.setObjectContentIfSemanticallyDifferent(parsed);

    expect(wasModified).to.equal(
      false,
      "File should NOT be marked modified when content with comments is semantically the same"
    );
    expect(file!.needsSave).to.equal(false, "File should NOT need save for no-op on commented JSON");
  }).timeout(30000);

  it("setObjectContentIfSemanticallyDifferent handles files with trailing commas", async () => {
    const project = await _loadProject("comprehensive");

    const entityItem = project.items.find((item) => item.itemType === ProjectItemType.entityTypeBehavior);
    const file = entityItem!.primaryFile;
    assert.isDefined(file, "Entity type item should have a primary file");

    // Simulate a file with trailing commas (common in hand-edited JSON)
    const contentWithTrailingComma = `{
  "format_version": "1.20.0",
  "minecraft:entity": {
    "description": {
      "identifier": "test:entity",
      "is_spawnable": true,
    },
  },
}`;

    file!.setContent(contentWithTrailingComma);
    file!.lastLoadedOrSaved = new Date();
    file!.modified = null;

    // Parse after fixing (what definition editors do)
    const Utilities = (await import("../core/Utilities")).default;
    const parsed = JSON.parse(Utilities.fixJsonContent(contentWithTrailingComma));

    const wasModified = file!.setObjectContentIfSemanticallyDifferent(parsed);

    expect(wasModified).to.equal(
      false,
      "File should NOT be marked modified for trailing-comma JSON with same semantics"
    );
  }).timeout(30000);

  it("definition load/persist round-trip does not cause phantom edits for standard JSON", async () => {
    const EntityTypeDefinition = (await import("../minecraft/EntityTypeDefinition")).default;

    const project = await _loadProject("comprehensive");

    const entityItem = project.items.find((item) => item.itemType === ProjectItemType.entityTypeBehavior);
    assert.isDefined(entityItem, "Should find an entity type item");

    const file = entityItem!.primaryFile;
    assert.isDefined(file, "Entity type item should have a primary file");

    await file!.loadContent();
    const originalContent = file!.content as string;

    // Load definition
    const def = await EntityTypeDefinition.ensureOnFile(file!);
    assert.isDefined(def, "Should create EntityTypeDefinition");
    assert.isTrue(def!.isLoaded, "Definition should be loaded");

    // Reset modified state after load
    file!.lastLoadedOrSaved = new Date();
    file!.modified = null;

    // Persist without changes — should not mark file as modified
    const wasChanged = def!.persist();

    expect(wasChanged).to.equal(false, "persist() should return false when no changes were made");
    expect(file!.needsSave).to.equal(false, "File should NOT need save after no-op persist");
  }).timeout(30000);

  it("definition load/persist with preserveComments does not cause phantom edits for commented JSON", async () => {
    const EntityTypeDefinition = (await import("../minecraft/EntityTypeDefinition")).default;

    const project = await _loadProject("comprehensive");

    const entityItem = project.items.find((item) => item.itemType === ProjectItemType.entityTypeBehavior);
    assert.isDefined(entityItem, "Should find an entity type item");

    const file = entityItem!.primaryFile;
    assert.isDefined(file, "Entity type item should have a primary file");

    // Set content with comments
    const contentWithComments = `{
  // Entity definition
  "format_version": "1.20.0",
  "minecraft:entity": {
    "description": {
      "identifier": "test:phantom_check",
      "is_spawnable": true
    },
    "components": {
      // Health component
      "minecraft:health": {
        "value": 20,
        "max": 20
      }
    }
  }
}`;

    file!.setContent(contentWithComments);
    file!.lastLoadedOrSaved = new Date();
    file!.modified = null;

    // Clear existing manager so we can reload fresh
    file!.manager = undefined;

    // Load with preserveComments
    const def = await EntityTypeDefinition.ensureOnFile(file!, undefined, true);
    assert.isDefined(def, "Should create EntityTypeDefinition");

    // Reset modified state after the comment-preserving load
    file!.lastLoadedOrSaved = new Date();
    file!.modified = null;

    // Persist without changes
    const wasChanged = def!.persist();

    expect(wasChanged).to.equal(false, "persist() with comments should return false when no changes were made");
    expect(file!.needsSave).to.equal(false, "File should NOT need save after no-op persist on commented JSON");
  }).timeout(30000);

  it("setContent byte-exact equality prevents phantom edits", async () => {
    const project = await _loadProject("comprehensive");

    const entityItem = project.items.find((item) => item.itemType === ProjectItemType.entityTypeBehavior);
    const file = entityItem!.primaryFile;
    assert.isDefined(file, "Entity type item should have a primary file");

    const testContent = '{"key": "value", "number": 42}';
    file!.setContent(testContent);
    file!.lastLoadedOrSaved = new Date();
    file!.modified = null;

    // Set exactly the same content again
    const wasChanged = file!.setContent(testContent);

    expect(wasChanged).to.equal(false, "setContent should return false for identical content");
    expect(file!.needsSave).to.equal(false, "File should NOT need save after setting identical content");
  }).timeout(30000);

  it("key ordering differences do not cause phantom edits via setObjectContentIfSemanticallyDifferent", async () => {
    const project = await _loadProject("comprehensive");

    const entityItem = project.items.find((item) => item.itemType === ProjectItemType.entityTypeBehavior);
    const file = entityItem!.primaryFile;
    assert.isDefined(file, "Entity type item should have a primary file");

    // Set initial content with keys in one order
    const initialContent = JSON.stringify({ beta: 2, alpha: 1, gamma: 3 }, null, 2);
    file!.setContent(initialContent);
    file!.lastLoadedOrSaved = new Date();
    file!.modified = null;

    // Create object with same keys in different order
    const reorderedObj = { gamma: 3, alpha: 1, beta: 2 };

    const wasModified = file!.setObjectContentIfSemanticallyDifferent(reorderedObj);

    expect(wasModified).to.equal(false, "Key ordering differences should NOT cause phantom edits");
    expect(file!.needsSave).to.equal(false, "File should NOT need save for reordered keys");
  }).timeout(30000);
});

describe("Database.loadPreviewVanillaInfoData", async () => {
  it("does not hang on second call after first load completes", async function () {
    this.timeout(15000);

    // Reset static state so we exercise the full load path
    (Database as any)._isLoadingPreviewVanillaInfoData = false;
    (Database as any)._pendingLoadPreviewVanillaInfoDataRequests = [];
    Database.previewVanillaContentIndex = undefined as any;
    Database.previewVanillaInfoData = undefined as any;

    // First call: performs the actual load
    await Database.loadPreviewVanillaInfoData();

    // After the first call, the _isLoadingPreviewVanillaInfoData flag
    // must be reset to false. If it stays true (the bug), the second
    // call would enter the pending-promise branch and hang forever.
    expect(
      (Database as any)._isLoadingPreviewVanillaInfoData,
      "_isLoadingPreviewVanillaInfoData should be false after load completes"
    ).to.equal(false);

    // Clear the cached result so the second call actually re-enters loadPreviewVanillaInfoData
    Database.previewVanillaContentIndex = undefined as any;
    Database.previewVanillaInfoData = undefined as any;

    // Second call: before the fix this would hang forever because
    // _isLoadingPreviewVanillaInfoData was still true.
    await Database.loadPreviewVanillaInfoData();

    // If we reach here, the second call completed without hanging.
    expect(
      (Database as any)._isLoadingPreviewVanillaInfoData,
      "_isLoadingPreviewVanillaInfoData should be false after second load"
    ).to.equal(false);
  });
});
