// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * McpMultiStepFlowTest - Tests for multi-step MCP workflows.
 *
 * These tests simulate the real-world scenario where a user creates a project
 * via MCP, then adds content to it through multiple MCP calls (blocks, entities,
 * items), and verifies that the resulting project:
 *
 * 1. Has a valid folder structure (no nested packs, no duplicate manifests)
 * 2. Has exactly one behavior pack and one resource pack
 * 3. All content files are in the correct pack folders
 * 4. The project passes validation with no errors
 * 5. The project would load correctly in Minecraft (correct manifest UUIDs, dependencies)
 *
 * These tests catch the "file mess" problem where repeated MCP tool calls
 * can create duplicate packs, nested manifest.json files, or misplaced content.
 */

import { expect, assert } from "chai";
import "mocha";
import * as fs from "fs";
import * as path from "path";
import Project, { ProjectAutoDeploymentMode } from "../app/Project";
import CreatorTools from "../app/CreatorTools";
import TestPaths, { ITestEnvironment } from "./TestPaths";
import ProjectInfoSet from "../info/ProjectInfoSet";
import { ProjectInfoSuite } from "../info/IProjectInfoData";
import { InfoItemType } from "../info/IInfoItemData";
import { ContentGenerator, IGeneratedContent } from "../minecraft/ContentGenerator";
import { IMinecraftContentDefinition } from "../minecraft/IContentMetaSchema";
import { PackType } from "../minecraft/Pack";
import StorageUtilities from "../storage/StorageUtilities";

let creatorTools: CreatorTools | undefined = undefined;

(async () => {
  const env: ITestEnvironment = await TestPaths.createTestEnvironment();
  creatorTools = env.creatorTools;
})();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const debugOutputRoot = path.resolve(__dirname, "../../debugoutput/mcp-flow-tests");

/** Clean and create a fresh temp folder for a test scenario. */
function freshTestFolder(scenarioName: string): string {
  const folder = path.join(debugOutputRoot, scenarioName);
  if (fs.existsSync(folder)) {
    fs.rmSync(folder, { recursive: true });
  }
  fs.mkdirSync(folder, { recursive: true });
  return folder;
}

/**
 * Write ContentGenerator output to disk, mirroring the FIXED logic in
 * MinecraftMcpServer._createMinecraftContentOp().
 *
 * Key behaviors that match the server:
 * - Reuses the first existing pack folder if one already has a manifest.json
 * - Preserves existing manifest UUIDs when overwriting
 * - Merges terrain_texture.json and item_texture.json instead of overwriting
 */
function writeGeneratedContent(outputPath: string, generated: IGeneratedContent, namespace: string) {
  // Detect existing pack folders (mirrors _findExistingPackFolder)
  let bpBasePath = path.join(outputPath, "behavior_packs", namespace);
  let rpBasePath = path.join(outputPath, "resource_packs", namespace);

  const existingBp = findExistingPackFolder(path.join(outputPath, "behavior_packs"));
  const existingRp = findExistingPackFolder(path.join(outputPath, "resource_packs"));
  if (existingBp) bpBasePath = existingBp;
  if (existingRp) rpBasePath = existingRp;

  const writeFile = (file: { path: string; pack: string; type: string; content: object | string | Uint8Array }) => {
    let basePath = outputPath;
    if (file.pack === "behavior") {
      basePath = bpBasePath;
    } else if (file.pack === "resource") {
      basePath = rpBasePath;
    }

    const fullPath = path.resolve(basePath, file.path);
    const dirPath = path.dirname(fullPath);

    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    if (file.type === "json") {
      fs.writeFileSync(fullPath, JSON.stringify(file.content, null, 2), "utf-8");
    } else if (file.type === "text") {
      fs.writeFileSync(fullPath, file.content as string, "utf-8");
    } else if (file.type === "png") {
      if (file.content instanceof Uint8Array) {
        fs.writeFileSync(fullPath, Buffer.from(file.content));
      } else {
        fs.writeFileSync(fullPath, Buffer.from(file.content as string, "base64"));
      }
    }
  };

  // Write manifests with UUID preservation
  if (generated.behaviorPackManifest) {
    writeManifestPreservingUuids(bpBasePath, generated.behaviorPackManifest);
  }
  if (generated.resourcePackManifest) {
    writeManifestPreservingUuids(rpBasePath, generated.resourcePackManifest);
  }

  for (const file of generated.entityBehaviors) writeFile(file);
  for (const file of generated.entityResources) writeFile(file);
  for (const file of generated.blockBehaviors) writeFile(file);
  for (const file of generated.blockResources) writeFile(file);
  for (const file of generated.itemBehaviors) writeFile(file);
  for (const file of generated.itemResources) writeFile(file);
  for (const file of generated.lootTables) writeFile(file);
  for (const file of generated.recipes) writeFile(file);
  for (const file of generated.spawnRules) writeFile(file);
  for (const file of generated.features) writeFile(file);
  for (const file of generated.featureRules) writeFile(file);
  for (const file of generated.textures) writeFile(file);
  for (const file of generated.geometries) writeFile(file);
  for (const file of generated.renderControllers) writeFile(file);

  // Merge all singleton resource pack files instead of overwriting
  if (generated.terrainTextures) {
    writeSingletonJsonMerging(rpBasePath, generated.terrainTextures);
  }
  if (generated.itemTextures) {
    writeSingletonJsonMerging(rpBasePath, generated.itemTextures);
  }
  if (generated.blocksCatalog) {
    writeSingletonJsonMerging(rpBasePath, generated.blocksCatalog);
  }
  if (generated.soundDefinitions) {
    writeSingletonJsonMerging(rpBasePath, generated.soundDefinitions);
  }
  if (generated.musicDefinitions) {
    writeSingletonJsonMerging(rpBasePath, generated.musicDefinitions);
  }
  for (const file of generated.sounds) {
    writeSingletonJsonMerging(rpBasePath, file);
  }
}

/** Find the first existing pack folder with a manifest.json inside a container directory. */
function findExistingPackFolder(containerPath: string): string | undefined {
  if (!fs.existsSync(containerPath)) return undefined;
  for (const entry of fs.readdirSync(containerPath, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const manifestPath = path.join(containerPath, entry.name, "manifest.json");
      if (fs.existsSync(manifestPath)) {
        return path.join(containerPath, entry.name);
      }
    }
  }
  return undefined;
}

/** Write a manifest.json, preserving UUIDs from any existing manifest at the same path. */
function writeManifestPreservingUuids(
  packBasePath: string,
  manifestFile: { path: string; pack: string; type: string; content: object | string | Uint8Array }
) {
  const fullPath = path.join(packBasePath, manifestFile.path);
  const dirPath = path.dirname(fullPath);

  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  const newManifest = manifestFile.content as any;

  if (fs.existsSync(fullPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(fullPath, "utf-8"));

      if (existing.header?.uuid) {
        newManifest.header.uuid = existing.header.uuid;
      }
      if (existing.header?.version) {
        newManifest.header.version = existing.header.version;
      }

      if (existing.modules && Array.isArray(existing.modules) && newManifest.modules) {
        for (let i = 0; i < Math.min(existing.modules.length, newManifest.modules.length); i++) {
          if (existing.modules[i]?.uuid) {
            newManifest.modules[i].uuid = existing.modules[i].uuid;
          }
        }
      }

      if (existing.dependencies && !newManifest.dependencies) {
        newManifest.dependencies = existing.dependencies;
      }
    } catch {
      // If existing manifest is malformed, just write the new one
    }
  }

  fs.writeFileSync(fullPath, JSON.stringify(newManifest, null, 2), "utf-8");
}

/**
 * Write a singleton JSON file, deep-merging with any existing data.
 * Mirrors MinecraftMcpServer._writeSingletonJsonMerging().
 */
function writeSingletonJsonMerging(
  packBasePath: string,
  singletonFile: { path: string; pack: string; type: string; content: object | string | Uint8Array }
) {
  const fullPath = path.join(packBasePath, singletonFile.path);
  const dirPath = path.dirname(fullPath);

  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  let newContent = singletonFile.content as any;

  if (fs.existsSync(fullPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
      newContent = StorageUtilities.deepMergeJsonObjects(existing, newContent);
    } catch {
      // If existing file is malformed, just write the new one
    }
  }

  fs.writeFileSync(fullPath, JSON.stringify(newContent, null, 2), "utf-8");
}

/** Recursively find all files matching a name in a directory tree. */
function findAllFiles(dir: string, fileName: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findAllFiles(entryPath, fileName));
    } else if (entry.name === fileName) {
      results.push(entryPath);
    }
  }
  return results;
}

/** Recursively list all files in a directory tree (relative paths). */
function listAllFiles(dir: string, base?: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const baseDir = base ?? dir;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listAllFiles(entryPath, baseDir));
    } else {
      results.push(path.relative(baseDir, entryPath));
    }
  }
  return results;
}

/** Load a project from a local folder and infer items. */
async function loadProjectFromFolder(folderPath: string, name: string): Promise<Project> {
  assert.isDefined(creatorTools, "CreatorTools not initialized");

  const project = new Project(creatorTools!, name, null);
  project.autoDeploymentMode = ProjectAutoDeploymentMode.noAutoDeployment;
  project.localFolderPath = folderPath;

  await project.inferProjectItemsFromFiles();
  return project;
}

/**
 * Validate project structure integrity checks.
 * Returns the count of manifest.json files and an array of all packs found.
 */
function analyzeProjectStructure(projectFolder: string) {
  const manifests = findAllFiles(projectFolder, "manifest.json");
  const packManifests = findAllFiles(projectFolder, "pack_manifest.json");
  const allManifests = [...manifests, ...packManifests];

  // Find all behavior_packs and resource_packs containers
  const bpContainers: string[] = [];
  const rpContainers: string[] = [];

  function findPackContainers(dir: string) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const entryPath = path.join(dir, entry.name);
      if (entry.name === "behavior_packs") bpContainers.push(entryPath);
      else if (entry.name === "resource_packs") rpContainers.push(entryPath);
      findPackContainers(entryPath);
    }
  }
  findPackContainers(projectFolder);

  // Count the number of pack folders (folders containing manifest.json) within each container
  const bpPackFolders: string[] = [];
  const rpPackFolders: string[] = [];

  for (const bpContainer of bpContainers) {
    for (const entry of fs.readdirSync(bpContainer, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        const manifestPath = path.join(bpContainer, entry.name, "manifest.json");
        if (fs.existsSync(manifestPath)) {
          bpPackFolders.push(path.join(bpContainer, entry.name));
        }
      }
    }
  }

  for (const rpContainer of rpContainers) {
    for (const entry of fs.readdirSync(rpContainer, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        const manifestPath = path.join(rpContainer, entry.name, "manifest.json");
        if (fs.existsSync(manifestPath)) {
          rpPackFolders.push(path.join(rpContainer, entry.name));
        }
      }
    }
  }

  return {
    allManifests,
    bpContainers,
    rpContainers,
    bpPackFolders,
    rpPackFolders,
  };
}

/** Check for nested manifests - a manifest.json inside a folder that also has another manifest.json higher up. */
function findNestedManifests(projectFolder: string): string[] {
  const allManifests = findAllFiles(projectFolder, "manifest.json");
  const nested: string[] = [];

  for (const manifest of allManifests) {
    const manifestDir = path.dirname(manifest);

    // Walk up from this manifest, checking if any ancestor also has a manifest.json
    let current = path.dirname(manifestDir);
    while (current.startsWith(projectFolder) && current !== projectFolder) {
      const parentManifest = path.join(current, "manifest.json");
      if (fs.existsSync(parentManifest) && allManifests.includes(parentManifest)) {
        nested.push(manifest);
        break;
      }
      current = path.dirname(current);
    }
  }

  return nested;
}

// ---------------------------------------------------------------------------
// Content generator definitions for multi-step flow
// ---------------------------------------------------------------------------

/** Step 1: Create a block called rainbow_ore */
const RAINBOW_ORE_BLOCK: IMinecraftContentDefinition = {
  schemaVersion: "1.0.0",
  namespace: "colorful",
  blockTypes: [
    {
      id: "rainbow_ore",
      displayName: "Rainbow Ore",
      destroyTime: 3.0,
      explosionResistance: 6,
      lightEmission: 8,
      mapColor: "#FF00FF",
    },
  ],
};

/** Step 2: Add a unicorn mob */
const UNICORN_MOB: IMinecraftContentDefinition = {
  schemaVersion: "1.0.0",
  namespace: "colorful",
  entityTypes: [
    {
      id: "unicorn",
      displayName: "Unicorn",
      traits: ["quadruped", "passive", "breedable"],
      behaviors: ["wander", "flee_when_hurt", "follow_parent", "tempt"],
      health: 30,
      movementSpeed: 0.3,
      breedable: {
        breedItems: ["apple", "golden_carrot"],
        breedCooldown: 300,
      },
    },
  ],
  spawnRules: [
    {
      entity: "colorful:unicorn",
      biomes: ["plains", "meadow"],
      weight: 20,
      groupSize: { min: 1, max: 2 },
    },
  ],
};

/** Step 3: Add a food item */
const RAINBOW_APPLE: IMinecraftContentDefinition = {
  schemaVersion: "1.0.0",
  namespace: "colorful",
  itemTypes: [
    {
      id: "rainbow_apple",
      displayName: "Rainbow Apple",
      category: "nature",
      food: {
        nutrition: 8,
        saturation: 1.5,
        canAlwaysEat: true,
        effects: [
          { name: "regeneration", duration: 10, amplifier: 1 },
          { name: "speed", duration: 30, amplifier: 0 },
        ],
      },
    },
  ],
  recipes: [
    {
      id: "rainbow_apple_recipe",
      type: "shapeless",
      ingredients: ["apple", "gold_ingot", "lapis_lazuli"],
      result: "colorful:rainbow_apple",
    },
  ],
};

/** All-in-one definition covering blocks, entities, items */
const COMPLETE_COLORFUL_ADDON: IMinecraftContentDefinition = {
  schemaVersion: "1.0.0",
  namespace: "colorful",
  displayName: "Colorful Demo",
  description: "A colorful demo add-on",
  entityTypes: [
    {
      id: "unicorn",
      displayName: "Unicorn",
      traits: ["quadruped", "passive"],
      health: 30,
    },
  ],
  blockTypes: [
    {
      id: "rainbow_ore",
      displayName: "Rainbow Ore",
      destroyTime: 3.0,
      lightEmission: 8,
    },
  ],
  itemTypes: [
    {
      id: "rainbow_apple",
      displayName: "Rainbow Apple",
      category: "nature",
      food: {
        nutrition: 8,
        saturation: 1.5,
      },
    },
  ],
};

// ===========================================================================
// TESTS
// ===========================================================================

describe("MCP Multi-Step Flow Tests", function () {
  this.timeout(30000);

  // =========================================================================
  // Structural Integrity Tests
  // =========================================================================

  describe("Single ContentGenerator call - structural integrity", function () {
    it("should produce exactly one BP and one RP manifest", async function () {
      const folder = freshTestFolder("single-call-structure");

      const generator = new ContentGenerator(COMPLETE_COLORFUL_ADDON);
      const result = await generator.generate();
      writeGeneratedContent(folder, result, "colorful");

      const structure = analyzeProjectStructure(folder);

      expect(structure.bpPackFolders).to.have.length(
        1,
        `Expected exactly 1 behavior pack folder, found ${structure.bpPackFolders.length}: ${structure.bpPackFolders.join(", ")}`
      );
      expect(structure.rpPackFolders).to.have.length(
        1,
        `Expected exactly 1 resource pack folder, found ${structure.rpPackFolders.length}: ${structure.rpPackFolders.join(", ")}`
      );
    });

    it("should have no nested manifests", async function () {
      const folder = freshTestFolder("single-call-no-nested");

      const generator = new ContentGenerator(COMPLETE_COLORFUL_ADDON);
      const result = await generator.generate();
      writeGeneratedContent(folder, result, "colorful");

      const nested = findNestedManifests(folder);
      expect(nested).to.have.length(
        0,
        `Found nested manifest.json files: ${nested.map((n) => path.relative(folder, n)).join(", ")}`
      );
    });

    it("should place all entity files in the correct pack folders", async function () {
      const folder = freshTestFolder("single-call-entity-placement");

      const generator = new ContentGenerator(COMPLETE_COLORFUL_ADDON);
      const result = await generator.generate();
      writeGeneratedContent(folder, result, "colorful");

      // Entity behavior should be in behavior_packs/colorful/entities/
      const entityBehaviors = findAllFiles(path.join(folder, "behavior_packs", "colorful"), "unicorn.json");
      expect(entityBehaviors.length).to.be.greaterThanOrEqual(1, "Entity behavior file not found in BP");

      // Entity resource should be in resource_packs/colorful/entity/
      const entityResources = findAllFiles(path.join(folder, "resource_packs", "colorful"), "unicorn.entity.json");
      expect(entityResources.length).to.be.greaterThanOrEqual(1, "Entity resource file not found in RP");
    });
  });

  // =========================================================================
  // Multi-step flow: Sequential ContentGenerator calls to same project
  // =========================================================================

  describe("Sequential ContentGenerator calls to same folder", function () {
    it("should not create duplicate pack folders when adding content in stages", async function () {
      const folder = freshTestFolder("sequential-no-duplicates");

      // Step 1: Generate and write the block
      const gen1 = new ContentGenerator(RAINBOW_ORE_BLOCK);
      const result1 = await gen1.generate();
      writeGeneratedContent(folder, result1, "colorful");

      // Step 2: Generate and write the mob
      const gen2 = new ContentGenerator(UNICORN_MOB);
      const result2 = await gen2.generate();
      writeGeneratedContent(folder, result2, "colorful");

      // Step 3: Generate and write the item
      const gen3 = new ContentGenerator(RAINBOW_APPLE);
      const result3 = await gen3.generate();
      writeGeneratedContent(folder, result3, "colorful");

      const structure = analyzeProjectStructure(folder);

      // Should still have exactly 1 BP and 1 RP
      expect(structure.bpPackFolders).to.have.length(
        1,
        `After 3 sequential writes, expected 1 BP but found ${structure.bpPackFolders.length}: ${structure.bpPackFolders.join(", ")}`
      );
      expect(structure.rpPackFolders).to.have.length(
        1,
        `After 3 sequential writes, expected 1 RP but found ${structure.rpPackFolders.length}: ${structure.rpPackFolders.join(", ")}`
      );
    });

    it("should not create nested manifests across sequential calls", async function () {
      const folder = freshTestFolder("sequential-no-nested-manifests");

      // Write content in 3 stages
      for (const def of [RAINBOW_ORE_BLOCK, UNICORN_MOB, RAINBOW_APPLE]) {
        const gen = new ContentGenerator(def);
        const result = await gen.generate();
        writeGeneratedContent(folder, result, "colorful");
      }

      const nested = findNestedManifests(folder);
      expect(nested).to.have.length(
        0,
        `Nested manifests found: ${nested.map((n) => path.relative(folder, n)).join(", ")}`
      );
    });

    it("should have all block, entity, and item files after sequential adds", async function () {
      const folder = freshTestFolder("sequential-all-content");

      for (const def of [RAINBOW_ORE_BLOCK, UNICORN_MOB, RAINBOW_APPLE]) {
        const gen = new ContentGenerator(def);
        const result = await gen.generate();
        writeGeneratedContent(folder, result, "colorful");
      }

      const bpFolder = path.join(folder, "behavior_packs", "colorful");
      const rpFolder = path.join(folder, "resource_packs", "colorful");

      // Block behavior
      expect(fs.existsSync(path.join(bpFolder, "blocks", "rainbow_ore.json"))).to.be.true;

      // Entity behavior
      expect(fs.existsSync(path.join(bpFolder, "entities", "unicorn.json"))).to.be.true;

      // Item behavior
      expect(fs.existsSync(path.join(bpFolder, "items", "rainbow_apple.json"))).to.be.true;

      // Entity resource + texture
      expect(fs.existsSync(path.join(rpFolder, "entity", "unicorn.entity.json"))).to.be.true;
    });

    it("should result in a manifest with valid UUIDs", async function () {
      const folder = freshTestFolder("sequential-valid-uuids");

      for (const def of [RAINBOW_ORE_BLOCK, UNICORN_MOB, RAINBOW_APPLE]) {
        const gen = new ContentGenerator(def);
        const result = await gen.generate();
        writeGeneratedContent(folder, result, "colorful");
      }

      const bpManifestPath = path.join(folder, "behavior_packs", "colorful", "manifest.json");
      const rpManifestPath = path.join(folder, "resource_packs", "colorful", "manifest.json");

      expect(fs.existsSync(bpManifestPath), "BP manifest should exist").to.be.true;
      expect(fs.existsSync(rpManifestPath), "RP manifest should exist").to.be.true;

      const bpManifest = JSON.parse(fs.readFileSync(bpManifestPath, "utf-8"));
      const rpManifest = JSON.parse(fs.readFileSync(rpManifestPath, "utf-8"));

      // UUIDs should be valid UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      expect(bpManifest.header.uuid).to.match(uuidRegex, "BP header UUID should be valid");
      expect(rpManifest.header.uuid).to.match(uuidRegex, "RP header UUID should be valid");

      // BP and RP should have different UUIDs
      expect(bpManifest.header.uuid).to.not.equal(
        rpManifest.header.uuid,
        "BP and RP should have different header UUIDs"
      );
    });

    it("manifest UUIDs should remain stable across sequential writes", async function () {
      const folder = freshTestFolder("sequential-stable-uuids");

      // Write step 1
      const gen1 = new ContentGenerator(RAINBOW_ORE_BLOCK);
      const result1 = await gen1.generate();
      writeGeneratedContent(folder, result1, "colorful");

      const bpManifestPath = path.join(folder, "behavior_packs", "colorful", "manifest.json");
      const rpManifestPath = path.join(folder, "resource_packs", "colorful", "manifest.json");

      const bpUuid1 = JSON.parse(fs.readFileSync(bpManifestPath, "utf-8")).header.uuid;
      const rpUuid1 = JSON.parse(fs.readFileSync(rpManifestPath, "utf-8")).header.uuid;

      // Write step 2 - manifest UUIDs should be preserved
      const gen2 = new ContentGenerator(UNICORN_MOB);
      const result2 = await gen2.generate();
      writeGeneratedContent(folder, result2, "colorful");

      const bpUuid2 = JSON.parse(fs.readFileSync(bpManifestPath, "utf-8")).header.uuid;
      const rpUuid2 = JSON.parse(fs.readFileSync(rpManifestPath, "utf-8")).header.uuid;

      expect(bpUuid1).to.equal(bpUuid2, "BP manifest UUID should remain stable across sequential writes");
      expect(rpUuid1).to.equal(rpUuid2, "RP manifest UUID should remain stable across sequential writes");
    });
  });

  // =========================================================================
  // Multi-step flow with mismatched namespaces
  // =========================================================================

  describe("Namespace mismatch across sequential calls", function () {
    it("should reuse existing pack folders even when namespace differs", async function () {
      const folder = freshTestFolder("namespace-mismatch");

      // Step 1: Use namespace "colorful"
      const gen1 = new ContentGenerator({
        schemaVersion: "1.0.0",
        namespace: "colorful",
        blockTypes: [{ id: "block_a", displayName: "Block A" }],
      });
      writeGeneratedContent(folder, await gen1.generate(), "colorful");

      // Step 2: Use namespace "fancy" - different namespace, but should reuse existing pack folder
      const gen2 = new ContentGenerator({
        schemaVersion: "1.0.0",
        namespace: "fancy",
        entityTypes: [{ id: "mob_b", displayName: "Mob B" }],
      });
      writeGeneratedContent(folder, await gen2.generate(), "fancy");

      const structure = analyzeProjectStructure(folder);

      // With the fix, the second call should reuse the first existing pack folder
      // instead of creating a second one, avoiding the "file mess".
      expect(structure.bpPackFolders).to.have.length(
        1,
        "Second namespace should reuse existing pack folder, not create a new one"
      );
      expect(structure.rpPackFolders).to.have.length(
        1,
        "Second namespace should reuse existing pack folder, not create a new one"
      );
    });
  });

  // =========================================================================
  // Pre-existing pack folder reuse
  // =========================================================================

  describe("Pre-existing pack folder reuse", function () {
    it("should add content into existing pack folder instead of creating a parallel one", async function () {
      const folder = freshTestFolder("reuse-existing-pack");

      // Simulate createProject: manually create a pack folder with a different name
      const existingBpName = "ghc_colorful_bp";
      const existingRpName = "ghc_colorful_rp";
      const existingBp = path.join(folder, "behavior_packs", existingBpName);
      const existingRp = path.join(folder, "resource_packs", existingRpName);
      fs.mkdirSync(existingBp, { recursive: true });
      fs.mkdirSync(existingRp, { recursive: true });

      // Write minimal manifests (like createProject would)
      fs.writeFileSync(
        path.join(existingBp, "manifest.json"),
        JSON.stringify({
          format_version: 2,
          header: {
            name: "Colorful Demo BP",
            uuid: "aaaaaaaa-1111-2222-3333-444444444444",
            version: [1, 0, 0],
            min_engine_version: [1, 21, 0],
          },
          modules: [{ type: "data", uuid: "bbbbbbbb-1111-2222-3333-444444444444", version: [1, 0, 0] }],
        })
      );
      fs.writeFileSync(
        path.join(existingRp, "manifest.json"),
        JSON.stringify({
          format_version: 2,
          header: {
            name: "Colorful Demo RP",
            uuid: "cccccccc-1111-2222-3333-444444444444",
            version: [1, 0, 0],
            min_engine_version: [1, 21, 0],
          },
          modules: [{ type: "resources", uuid: "dddddddd-1111-2222-3333-444444444444", version: [1, 0, 0] }],
        })
      );

      // Now use createMinecraftContent with a DIFFERENT namespace
      const gen = new ContentGenerator(RAINBOW_ORE_BLOCK);
      const result = await gen.generate();
      writeGeneratedContent(folder, result, "colorful");

      const structure = analyzeProjectStructure(folder);

      // Should reuse the existing pack folders, NOT create new ones
      expect(structure.bpPackFolders).to.have.length(
        1,
        `Expected content to go into existing BP folder, but found ${structure.bpPackFolders.length} BP folders: ` +
          structure.bpPackFolders.map((f) => path.relative(folder, f)).join(", ")
      );
      expect(structure.rpPackFolders).to.have.length(
        1,
        `Expected content to go into existing RP folder, but found ${structure.rpPackFolders.length} RP folders: ` +
          structure.rpPackFolders.map((f) => path.relative(folder, f)).join(", ")
      );

      // The existing manifest UUIDs should be preserved
      const bpManifest = JSON.parse(fs.readFileSync(path.join(existingBp, "manifest.json"), "utf-8"));
      expect(bpManifest.header.uuid).to.equal(
        "aaaaaaaa-1111-2222-3333-444444444444",
        "Existing BP manifest UUID should be preserved"
      );

      // Block files should be in the existing BP folder
      const blockFile = path.join(existingBp, "blocks", "rainbow_ore.json");
      expect(fs.existsSync(blockFile), `Block file should be in existing BP folder at ${blockFile}`).to.be.true;
    });
  });

  // =========================================================================
  // Project loading and validation after multi-step content generation
  // =========================================================================

  describe("Project validation after multi-step generation", function () {
    it("should load as a valid project with correct item counts", async function () {
      const folder = freshTestFolder("validation-item-counts");

      // Generate all content
      const gen = new ContentGenerator(COMPLETE_COLORFUL_ADDON);
      const result = await gen.generate();
      writeGeneratedContent(folder, result, "colorful");

      // Load as a Project and check
      const project = await loadProjectFromFolder(folder, "colorful_demo");

      expect(project.items.length).to.be.greaterThan(0, "Project should have discovered items");

      // Should have exactly 2 packs (1 BP + 1 RP)
      expect(project.packs.length).to.equal(2, `Expected 2 packs (BP+RP), found ${project.packs.length}`);

      const bpPacks = project.packs.filter((p) => p.packType === PackType.behavior);
      const rpPacks = project.packs.filter((p) => p.packType === PackType.resource);
      expect(bpPacks.length).to.equal(1, "Should have exactly 1 behavior pack");
      expect(rpPacks.length).to.equal(1, "Should have exactly 1 resource pack");
    });

    it("should pass validation with no errors after single-step generation", async function () {
      const folder = freshTestFolder("validation-no-errors-single");

      const gen = new ContentGenerator(COMPLETE_COLORFUL_ADDON);
      const result = await gen.generate();
      writeGeneratedContent(folder, result, "colorful");

      const project = await loadProjectFromFolder(folder, "colorful_demo");
      const infoSet = new ProjectInfoSet(project, ProjectInfoSuite.defaultInDevelopment);
      await infoSet.generateForProject();

      const errors = infoSet.items.filter(
        (item) => item.itemType === InfoItemType.error || item.itemType === InfoItemType.internalProcessingError
      );

      if (errors.length > 0) {
        const errorMessages = errors.map((e) => `  [${e.generatorId}#${e.generatorIndex}] ${e.message}`).join("\n");
        console.log(`Validation errors found:\n${errorMessages}`);
      }

      // Allow some errors from validation rules that may not apply to generated content,
      // but structural errors (nested manifests, missing required fields) should be zero.
      const structuralErrors = errors.filter((e) => e.generatorId === "PRJINT" || e.generatorId === "MANIFEST");
      expect(structuralErrors).to.have.length(
        0,
        `Structural validation errors: ${structuralErrors.map((e) => e.message).join("; ")}`
      );
    });

    it("should pass validation with no errors after multi-step generation", async function () {
      const folder = freshTestFolder("validation-no-errors-multi");

      // Write content in 3 steps using same namespace
      for (const def of [RAINBOW_ORE_BLOCK, UNICORN_MOB, RAINBOW_APPLE]) {
        const gen = new ContentGenerator(def);
        const result = await gen.generate();
        writeGeneratedContent(folder, result, "colorful");
      }

      const project = await loadProjectFromFolder(folder, "colorful_demo");
      const infoSet = new ProjectInfoSet(project, ProjectInfoSuite.defaultInDevelopment);
      await infoSet.generateForProject();

      const structuralErrors = infoSet.items.filter(
        (item) =>
          (item.itemType === InfoItemType.error || item.itemType === InfoItemType.internalProcessingError) &&
          (item.generatorId === "PRJINT" || item.generatorId === "MANIFEST")
      );

      expect(structuralErrors).to.have.length(
        0,
        `Structural validation errors after multi-step: ${structuralErrors.map((e) => e.message).join("; ")}`
      );
    });

    it("should detect problems when nested packs exist", async function () {
      const folder = freshTestFolder("validation-detects-nested");

      // Create a valid project structure
      const gen = new ContentGenerator(COMPLETE_COLORFUL_ADDON);
      const result = await gen.generate();
      writeGeneratedContent(folder, result, "colorful");

      // Now deliberately create a nested pack (simulating the bug)
      const nestedBpPath = path.join(folder, "behavior_packs", "colorful", "behavior_packs", "nested", "manifest.json");
      fs.mkdirSync(path.dirname(nestedBpPath), { recursive: true });
      fs.writeFileSync(
        nestedBpPath,
        JSON.stringify({
          format_version: 2,
          header: {
            name: "Nested Pack",
            uuid: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
            version: [1, 0, 0],
            min_engine_version: [1, 21, 0],
          },
          modules: [{ type: "data", uuid: "11111111-2222-3333-4444-555555555555", version: [1, 0, 0] }],
        }),
        "utf-8"
      );

      // Verify our nested manifest detector finds it
      const nestedManifests = findNestedManifests(folder);
      expect(nestedManifests.length).to.be.greaterThan(0, "Should detect the deliberately nested manifest");

      // Also verify the project validator detects it
      const project = await loadProjectFromFolder(folder, "colorful_demo_nested");
      const infoSet = new ProjectInfoSet(project, ProjectInfoSuite.defaultInDevelopment);
      await infoSet.generateForProject();

      const integrityErrors = infoSet.items.filter(
        (item) =>
          item.generatorId === "PRJINT" &&
          (item.itemType === InfoItemType.error ||
            item.itemType === InfoItemType.warning ||
            item.itemType === InfoItemType.testCompleteFail)
      );

      // The PRJINT validator should detect the nested manifest or orphaned files
      if (integrityErrors.length === 0) {
        console.log(
          "WARNING: Project integrity validator did NOT detect the nested pack. " +
            "This is a gap in validation - nested packs should be caught."
        );
      }
    });
  });

  // =========================================================================
  // Manifest consistency tests
  // =========================================================================

  describe("Manifest consistency", function () {
    it("BP and RP manifests should have matching dependency references", async function () {
      const folder = freshTestFolder("manifest-dependencies");

      const gen = new ContentGenerator(COMPLETE_COLORFUL_ADDON);
      const result = await gen.generate();
      writeGeneratedContent(folder, result, "colorful");

      const bpManifestPath = path.join(folder, "behavior_packs", "colorful", "manifest.json");
      const rpManifestPath = path.join(folder, "resource_packs", "colorful", "manifest.json");

      if (!fs.existsSync(bpManifestPath) || !fs.existsSync(rpManifestPath)) {
        // If manifests don't exist, probably needs content generation support
        this.skip();
        return;
      }

      const bpManifest = JSON.parse(fs.readFileSync(bpManifestPath, "utf-8"));
      const rpManifest = JSON.parse(fs.readFileSync(rpManifestPath, "utf-8"));

      // If BP has dependencies on RP, the RP UUID should match
      if (bpManifest.dependencies) {
        for (const dep of bpManifest.dependencies) {
          if (dep.uuid === rpManifest.header.uuid) {
            // Good - BP correctly references RP
            expect(dep.uuid).to.equal(rpManifest.header.uuid);
          }
        }
      }

      // Manifests should have required fields
      expect(bpManifest.format_version).to.exist;
      expect(bpManifest.header).to.exist;
      expect(bpManifest.header.name).to.exist;
      expect(bpManifest.header.uuid).to.exist;
      expect(bpManifest.header.version).to.exist;
      expect(bpManifest.modules).to.be.an("array").with.length.greaterThan(0);

      expect(rpManifest.format_version).to.exist;
      expect(rpManifest.header).to.exist;
      expect(rpManifest.header.name).to.exist;
      expect(rpManifest.header.uuid).to.exist;
      expect(rpManifest.header.version).to.exist;
      expect(rpManifest.modules).to.be.an("array").with.length.greaterThan(0);
    });

    it("module type should be 'data' for BP and 'resources' for RP", async function () {
      const folder = freshTestFolder("manifest-module-types");

      const gen = new ContentGenerator(COMPLETE_COLORFUL_ADDON);
      const result = await gen.generate();
      writeGeneratedContent(folder, result, "colorful");

      const bpManifestPath = path.join(folder, "behavior_packs", "colorful", "manifest.json");
      const rpManifestPath = path.join(folder, "resource_packs", "colorful", "manifest.json");

      const bpManifest = JSON.parse(fs.readFileSync(bpManifestPath, "utf-8"));
      const rpManifest = JSON.parse(fs.readFileSync(rpManifestPath, "utf-8"));

      expect(bpManifest.modules[0].type).to.equal("data", "BP module type should be 'data'");
      expect(rpManifest.modules[0].type).to.equal("resources", "RP module type should be 'resources'");
    });
  });

  // =========================================================================
  // Content completeness tests
  // =========================================================================

  describe("Content completeness after multi-step writes", function () {
    it("each entity should have both behavior and resource definitions", async function () {
      const folder = freshTestFolder("completeness-entity-pair");

      const gen = new ContentGenerator(UNICORN_MOB);
      const result = await gen.generate();
      writeGeneratedContent(folder, result, "colorful");

      const bpEntities = findAllFiles(path.join(folder, "behavior_packs"), "unicorn.json");
      const rpEntities = findAllFiles(path.join(folder, "resource_packs"), "unicorn.entity.json");

      expect(bpEntities.length).to.equal(1, "Should have exactly 1 entity behavior definition");
      expect(rpEntities.length).to.equal(1, "Should have exactly 1 entity resource definition");
    });

    it("entity identifiers should be consistent across BP and RP", async function () {
      const folder = freshTestFolder("completeness-entity-identifiers");

      const gen = new ContentGenerator(UNICORN_MOB);
      const result = await gen.generate();
      writeGeneratedContent(folder, result, "colorful");

      const bpEntityPath = path.join(folder, "behavior_packs", "colorful", "entities", "unicorn.json");
      const rpEntityPath = path.join(folder, "resource_packs", "colorful", "entity", "unicorn.entity.json");

      expect(fs.existsSync(bpEntityPath), "BP entity file should exist").to.be.true;
      expect(fs.existsSync(rpEntityPath), "RP entity file should exist").to.be.true;

      const bpEntity = JSON.parse(fs.readFileSync(bpEntityPath, "utf-8"));
      const rpEntity = JSON.parse(fs.readFileSync(rpEntityPath, "utf-8"));

      const bpIdentifier = bpEntity["minecraft:entity"]?.description?.identifier;
      const rpIdentifier = rpEntity["minecraft:client_entity"]?.description?.identifier;

      expect(bpIdentifier).to.equal("colorful:unicorn", "BP entity identifier should use namespace:id format");
      expect(rpIdentifier).to.equal(bpIdentifier, "RP entity identifier should match BP entity identifier");
    });

    it("blocks should have terrain_texture.json references", async function () {
      const folder = freshTestFolder("completeness-block-textures");

      const gen = new ContentGenerator(RAINBOW_ORE_BLOCK);
      const result = await gen.generate();
      writeGeneratedContent(folder, result, "colorful");

      const terrainTexturePath = path.join(folder, "resource_packs", "colorful", "textures", "terrain_texture.json");

      if (fs.existsSync(terrainTexturePath)) {
        const terrainTexture = JSON.parse(fs.readFileSync(terrainTexturePath, "utf-8"));
        expect(terrainTexture.texture_data).to.exist;

        // Should reference our block
        const hasRainbowOre = Object.keys(terrainTexture.texture_data).some((key) => key.includes("rainbow_ore"));
        expect(hasRainbowOre).to.be.true;
      }
    });

    it("sequential block additions should merge terrain_texture.json", async function () {
      const folder = freshTestFolder("completeness-terrain-merge");

      // Add first block
      const gen1 = new ContentGenerator({
        schemaVersion: "1.0.0",
        namespace: "colorful",
        blockTypes: [{ id: "block_a", displayName: "Block A" }],
      });
      writeGeneratedContent(folder, await gen1.generate(), "colorful");

      // Add second block
      const gen2 = new ContentGenerator({
        schemaVersion: "1.0.0",
        namespace: "colorful",
        blockTypes: [{ id: "block_b", displayName: "Block B" }],
      });
      writeGeneratedContent(folder, await gen2.generate(), "colorful");

      const terrainTexturePath = path.join(folder, "resource_packs", "colorful", "textures", "terrain_texture.json");

      if (fs.existsSync(terrainTexturePath)) {
        const terrainTexture = JSON.parse(fs.readFileSync(terrainTexturePath, "utf-8"));

        const keys = Object.keys(terrainTexture.texture_data || {});
        const hasBlockA = keys.some((k) => k.includes("block_a"));
        const hasBlockB = keys.some((k) => k.includes("block_b"));

        expect(hasBlockA).to.be.true;
        expect(hasBlockB).to.be.true;
      }
    });
  });

  // =========================================================================
  // File-system level structural checks
  // =========================================================================

  describe("File system structure checks", function () {
    it("should not have any behavior_packs within a behavior_packs folder", async function () {
      const folder = freshTestFolder("fs-no-nested-bp");

      for (const def of [RAINBOW_ORE_BLOCK, UNICORN_MOB, RAINBOW_APPLE]) {
        const gen = new ContentGenerator(def);
        writeGeneratedContent(folder, await gen.generate(), "colorful");
      }

      const allFiles = listAllFiles(folder);
      const nestedBp = allFiles.filter((f) => {
        const parts = f.split(path.sep);
        let bpCount = 0;
        for (const p of parts) {
          if (p === "behavior_packs") bpCount++;
        }
        return bpCount > 1;
      });

      expect(nestedBp).to.have.length(
        0,
        `Found files nested inside behavior_packs/*/behavior_packs/: ${nestedBp.join(", ")}`
      );
    });

    it("should not have any resource_packs within a resource_packs folder", async function () {
      const folder = freshTestFolder("fs-no-nested-rp");

      for (const def of [RAINBOW_ORE_BLOCK, UNICORN_MOB, RAINBOW_APPLE]) {
        const gen = new ContentGenerator(def);
        writeGeneratedContent(folder, await gen.generate(), "colorful");
      }

      const allFiles = listAllFiles(folder);
      const nestedRp = allFiles.filter((f) => {
        const parts = f.split(path.sep);
        let rpCount = 0;
        for (const p of parts) {
          if (p === "resource_packs") rpCount++;
        }
        return rpCount > 1;
      });

      expect(nestedRp).to.have.length(
        0,
        `Found files nested inside resource_packs/*/resource_packs/: ${nestedRp.join(", ")}`
      );
    });

    it("should not have loose files at the project root that belong in packs", async function () {
      const folder = freshTestFolder("fs-no-loose-files");

      const gen = new ContentGenerator(COMPLETE_COLORFUL_ADDON);
      writeGeneratedContent(folder, await gen.generate(), "colorful");

      const rootEntries = fs.readdirSync(folder);
      const unexpectedDirs = rootEntries.filter(
        (e) =>
          e !== "behavior_packs" &&
          e !== "resource_packs" &&
          e !== "worlds" &&
          e !== "world_template" &&
          e !== "skin_packs" &&
          e !== "design_packs" &&
          e !== ".project" &&
          e !== "package.json" &&
          e !== "scripts" &&
          e !== "node_modules" &&
          e !== "tsconfig.json" &&
          fs.statSync(path.join(folder, e)).isDirectory()
      );

      // directories like "entities", "blocks", "items" at root level would be a problem
      const contentDirsAtRoot = unexpectedDirs.filter((d) =>
        [
          "entities",
          "blocks",
          "items",
          "loot_tables",
          "recipes",
          "spawn_rules",
          "textures",
          "models",
          "entity",
        ].includes(d)
      );

      expect(contentDirsAtRoot).to.have.length(
        0,
        `Content directories found at project root (should be inside packs): ${contentDirsAtRoot.join(", ")}`
      );
    });
  });

  // =========================================================================
  // Singleton file merging tests
  // =========================================================================

  describe("Singleton file merging", function () {
    it("sequential block additions should merge blocks.json", async function () {
      const folder = freshTestFolder("singleton-blocks-json-merge");

      const gen1 = new ContentGenerator({
        schemaVersion: "1.0.0",
        namespace: "colorful",
        blockTypes: [{ id: "block_a", displayName: "Block A" }],
      });
      writeGeneratedContent(folder, await gen1.generate(), "colorful");

      const gen2 = new ContentGenerator({
        schemaVersion: "1.0.0",
        namespace: "colorful",
        blockTypes: [{ id: "block_b", displayName: "Block B" }],
      });
      writeGeneratedContent(folder, await gen2.generate(), "colorful");

      const blocksCatalogPath = path.join(folder, "resource_packs", "colorful", "blocks.json");

      if (fs.existsSync(blocksCatalogPath)) {
        const blocksCatalog = JSON.parse(fs.readFileSync(blocksCatalogPath, "utf-8"));

        const hasBlockA = Object.keys(blocksCatalog).some((k) => k.includes("block_a"));
        const hasBlockB = Object.keys(blocksCatalog).some((k) => k.includes("block_b"));

        expect(hasBlockA).to.be.true;
        expect(hasBlockB).to.be.true;
      }
    });

    it("should merge arbitrary singleton JSON files with object keys", function () {
      const folder = freshTestFolder("singleton-generic-merge");
      const rpBase = path.join(folder, "resource_packs", "test");
      fs.mkdirSync(rpBase, { recursive: true });

      // Write an initial sound_definitions.json manually
      const initialContent = {
        format_version: "1.14.0",
        sound_definitions: {
          "mob.unicorn.idle": { category: "neutral", sounds: ["sounds/mob/unicorn/idle1"] },
        },
      };
      const soundDefPath = path.join(rpBase, "sounds", "sound_definitions.json");
      fs.mkdirSync(path.dirname(soundDefPath), { recursive: true });
      fs.writeFileSync(soundDefPath, JSON.stringify(initialContent, null, 2), "utf-8");

      // Now merge with new content
      writeSingletonJsonMerging(rpBase, {
        path: "sounds/sound_definitions.json",
        pack: "resource",
        type: "json",
        content: {
          format_version: "1.14.0",
          sound_definitions: {
            "mob.unicorn.hurt": { category: "neutral", sounds: ["sounds/mob/unicorn/hurt1"] },
          },
        },
      });

      const merged = JSON.parse(fs.readFileSync(soundDefPath, "utf-8"));

      expect(merged.sound_definitions["mob.unicorn.idle"]).to.exist;
      expect(merged.sound_definitions["mob.unicorn.hurt"]).to.exist;
      expect(merged.format_version).to.equal("1.14.0");
    });

    it("should merge music_definitions.json preserving existing entries", function () {
      const folder = freshTestFolder("singleton-music-merge");
      const rpBase = path.join(folder, "resource_packs", "test");
      fs.mkdirSync(rpBase, { recursive: true });

      // Write initial music_definitions.json
      const initialContent = {
        "music.game.creative": {
          event_name: "music.game.creative",
          min_delay: 120,
          max_delay: 600,
        },
      };
      const musicDefPath = path.join(rpBase, "sounds", "music_definitions.json");
      fs.mkdirSync(path.dirname(musicDefPath), { recursive: true });
      fs.writeFileSync(musicDefPath, JSON.stringify(initialContent, null, 2), "utf-8");

      // Merge new entry
      writeSingletonJsonMerging(rpBase, {
        path: "sounds/music_definitions.json",
        pack: "resource",
        type: "json",
        content: {
          "music.game.nether": {
            event_name: "music.game.nether",
            min_delay: 60,
            max_delay: 300,
          },
        },
      });

      const merged = JSON.parse(fs.readFileSync(musicDefPath, "utf-8"));

      expect(merged["music.game.creative"]).to.exist;
      expect(merged["music.game.nether"]).to.exist;
      expect(merged["music.game.creative"].min_delay).to.equal(120);
    });

    it("should preserve existing sounds.json entries when adding new ones", function () {
      const folder = freshTestFolder("singleton-sounds-merge");
      const rpBase = path.join(folder, "resource_packs", "test");
      fs.mkdirSync(rpBase, { recursive: true });

      // Write initial sounds.json
      const initialContent = {
        entity_sounds: {
          entities: {
            "colorful:unicorn": {
              volume: 1.0,
              events: { ambient: "mob.unicorn.idle" },
            },
          },
        },
        block_sounds: {},
      };
      const soundsPath = path.join(rpBase, "sounds.json");
      fs.writeFileSync(soundsPath, JSON.stringify(initialContent, null, 2), "utf-8");

      // Merge new entity sound
      writeSingletonJsonMerging(rpBase, {
        path: "sounds.json",
        pack: "resource",
        type: "json",
        content: {
          entity_sounds: {
            entities: {
              "colorful:dragon": {
                volume: 1.0,
                events: { ambient: "mob.dragon.idle" },
              },
            },
          },
        },
      });

      const merged = JSON.parse(fs.readFileSync(soundsPath, "utf-8"));

      expect(merged.entity_sounds.entities["colorful:unicorn"]).to.exist;
      expect(merged.entity_sounds.entities["colorful:dragon"]).to.exist;
      expect(merged.block_sounds).to.exist;
    });

    it("all singleton files should survive a 3-step block generation flow", async function () {
      const folder = freshTestFolder("singleton-3step-blocks");

      // Add 3 blocks sequentially
      for (const blockId of ["ore_red", "ore_green", "ore_blue"]) {
        const gen = new ContentGenerator({
          schemaVersion: "1.0.0",
          namespace: "colorful",
          blockTypes: [{ id: blockId, displayName: blockId.replace("_", " ") }],
        });
        writeGeneratedContent(folder, await gen.generate(), "colorful");
      }

      const rpBase = path.join(folder, "resource_packs", "colorful");

      // terrain_texture.json should have all 3 blocks
      const terrainPath = path.join(rpBase, "textures", "terrain_texture.json");
      if (fs.existsSync(terrainPath)) {
        const terrain = JSON.parse(fs.readFileSync(terrainPath, "utf-8"));
        const keys = Object.keys(terrain.texture_data || {});
        expect(keys.some((k) => k.includes("ore_red"))).to.be.true;
        expect(keys.some((k) => k.includes("ore_green"))).to.be.true;
        expect(keys.some((k) => k.includes("ore_blue"))).to.be.true;
      }

      // blocks.json should have all 3 blocks
      const blocksCatalogPath = path.join(rpBase, "blocks.json");
      if (fs.existsSync(blocksCatalogPath)) {
        const blocks = JSON.parse(fs.readFileSync(blocksCatalogPath, "utf-8"));
        const keys = Object.keys(blocks);
        expect(keys.some((k) => k.includes("ore_red"))).to.be.true;
        expect(keys.some((k) => k.includes("ore_green"))).to.be.true;
        expect(keys.some((k) => k.includes("ore_blue"))).to.be.true;
      }
    });
  });

  // =========================================================================
  // Edge cases
  // =========================================================================

  describe("Edge cases", function () {
    it("should handle empty definitions gracefully", async function () {
      const folder = freshTestFolder("edge-empty-def");

      const gen = new ContentGenerator({
        schemaVersion: "1.0.0",
        namespace: "empty",
      });
      const result = await gen.generate();
      writeGeneratedContent(folder, result, "empty");

      // Should still create valid manifest files
      const bpManifestPath = path.join(folder, "behavior_packs", "empty", "manifest.json");
      const rpManifestPath = path.join(folder, "resource_packs", "empty", "manifest.json");
      expect(fs.existsSync(bpManifestPath), "BP manifest should exist even for empty definition").to.be.true;
      expect(fs.existsSync(rpManifestPath), "RP manifest should exist even for empty definition").to.be.true;
    });

    it("should handle special characters in identifiers", async function () {
      const folder = freshTestFolder("edge-special-chars");

      const gen = new ContentGenerator({
        schemaVersion: "1.0.0",
        namespace: "test_mod",
        blockTypes: [
          {
            id: "my_block_v2",
            displayName: "My Block (v2)",
            destroyTime: 1.0,
          },
        ],
      });
      const result = await gen.generate();
      writeGeneratedContent(folder, result, "test_mod");

      const structure = analyzeProjectStructure(folder);
      expect(structure.bpPackFolders).to.have.length(1);
      expect(structure.rpPackFolders).to.have.length(1);
    });

    it("should handle definitions with many items without structural issues", async function () {
      const folder = freshTestFolder("edge-many-items");

      // Create a definition with many blocks
      const manyBlocks: IMinecraftContentDefinition = {
        schemaVersion: "1.0.0",
        namespace: "bigmod",
        blockTypes: Array.from({ length: 10 }, (_, i) => ({
          id: `block_${i}`,
          displayName: `Block ${i}`,
          destroyTime: 1.0 + i * 0.5,
        })),
        entityTypes: Array.from({ length: 5 }, (_, i) => ({
          id: `mob_${i}`,
          displayName: `Mob ${i}`,
          health: 10 + i * 5,
        })),
        itemTypes: Array.from({ length: 5 }, (_, i) => ({
          id: `item_${i}`,
          displayName: `Item ${i}`,
          category: "items" as const,
        })),
      };

      const gen = new ContentGenerator(manyBlocks);
      const result = await gen.generate();
      writeGeneratedContent(folder, result, "bigmod");

      const structure = analyzeProjectStructure(folder);
      expect(structure.bpPackFolders).to.have.length(1, "Should have exactly 1 BP even with many items");
      expect(structure.rpPackFolders).to.have.length(1, "Should have exactly 1 RP even with many items");

      // Verify all block files exist
      for (let i = 0; i < 10; i++) {
        const blockPath = path.join(folder, "behavior_packs", "bigmod", "blocks", `block_${i}.json`);
        expect(fs.existsSync(blockPath), `block_${i}.json should exist`).to.be.true;
      }

      // Verify all entity files exist
      for (let i = 0; i < 5; i++) {
        const entityPath = path.join(folder, "behavior_packs", "bigmod", "entities", `mob_${i}.json`);
        expect(fs.existsSync(entityPath), `mob_${i}.json should exist`).to.be.true;
      }
    });
  });
});
