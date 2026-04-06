// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Deploy Functionality Tests
 *
 * These tests validate the deployment pipeline without requiring a running
 * Bedrock Dedicated Server. They test:
 * 1. Project packaging to ZipStorage
 * 2. Server-side deployment processing (folder extraction)
 * 3. Incremental deployment detection
 * 4. HTTP upload endpoint body handling
 * 5. syncFlatPackRefWorldTo — flat world generation with pack refs
 * 6. deployWorldId — per-project unique world folder keying
 */

import { expect, assert } from "chai";
import CreatorTools from "../app/CreatorTools";
import Project, { ProjectAutoDeploymentMode } from "../app/Project";

import IFolder from "../storage/IFolder";
import StorageUtilities from "../storage/StorageUtilities";
import ProjectExporter from "../app/ProjectExporter";
import ZipStorage from "../storage/ZipStorage";
import * as fs from "fs";
import MinecraftUtilities from "../minecraft/MinecraftUtilities";
import MCWorld from "../minecraft/MCWorld";
import { folderMatches } from "./TestUtilities";
import TestPaths, { ITestEnvironment } from "./TestPaths";

let creatorTools: CreatorTools | undefined = undefined;

let scenariosFolder: IFolder | undefined = undefined;
let resultsFolder: IFolder | undefined = undefined;

(async () => {
  const env: ITestEnvironment = await TestPaths.createTestEnvironment({ isLocalNode: true });
  creatorTools = env.creatorTools;
  scenariosFolder = env.scenariosFolder;
  resultsFolder = env.resultsFolder;
})();

async function _loadProjectFromScenario(scenarioName: string) {
  if (!creatorTools || !scenariosFolder || !resultsFolder) {
    assert.fail("Not properly initialized");
  }

  await scenariosFolder.load(true);

  const scenarioFolder = scenariosFolder.folders[scenarioName];
  if (!scenarioFolder) {
    assert.fail(`Scenario folder '${scenarioName}' not found in ${scenariosFolder.fullPath}`);
  }

  const project = new Project(creatorTools, scenarioName, null);

  project.autoDeploymentMode = ProjectAutoDeploymentMode.noAutoDeployment;
  project.localFolderPath = StorageUtilities.ensureEndsWithDelimiter(scenarioFolder.fullPath);

  await project.inferProjectItemsFromFiles();

  return project;
}

async function _loadProjectFromSampleContent(name: string) {
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
        throw e;
      }
    }
  }
}

describe("deploy-packaging", async () => {
  before((done) => {
    removeResultFolder("deployPackaging");
    done();
  });

  it("can create and generate a simple zip", async function () {
    this.timeout(10000);

    // Basic sanity test for ZipStorage
    const zipStorage = new ZipStorage();

    const testFolder = zipStorage.rootFolder.ensureFolder("test");
    const testFile = testFolder.ensureFile("hello.txt");
    testFile.setContent("Hello, World!");
    await testFile.saveContent();

    await zipStorage.rootFolder.saveAll();

    const zipBinary = await zipStorage.generateBlobAsync();

    expect(zipBinary).to.not.be.undefined;
    expect(Buffer.isBuffer(zipBinary)).to.be.true;
    expect(zipBinary.length).to.be.greaterThan(0, "Zip binary should not be empty");
  });

  it("packages project to ZipStorage correctly", async function () {
    this.timeout(30000);

    const project = await _loadProjectFromScenario("deployCommand");

    if (!creatorTools || !resultsFolder) {
      assert.fail("Not properly initialized");
      return;
    }

    expect(project.items.length).to.be.greaterThan(0, "Project should have items");

    // Create a ZipStorage to simulate remote deployment packaging
    const zipStorage = new ZipStorage();

    // Deploy project to the zip
    const result = await ProjectExporter.deployProject(creatorTools, project, zipStorage.rootFolder);

    expect(result).to.equal(true);

    await zipStorage.rootFolder.saveAll();

    // Check that the zip contains expected structure
    await zipStorage.rootFolder.load(true);

    // Should have development_behavior_packs folder
    const dbpFolder = zipStorage.rootFolder.folders["development_behavior_packs"];
    expect(dbpFolder).to.not.be.undefined;

    if (dbpFolder) {
      await dbpFolder.load(true);

      // Should have at least one pack folder
      const packFolderNames = Object.keys(dbpFolder.folders);
      expect(packFolderNames.length).to.be.greaterThan(0);
    }

    // Generate binary and verify it's non-empty
    const zipBinary = await zipStorage.generateBlobAsync();

    expect(zipBinary).to.not.be.undefined;
    expect(Buffer.isBuffer(zipBinary)).to.be.true;
    expect(zipBinary.length).to.be.greaterThan(0, "Zip binary should not be empty");
  });

  it("can round-trip zip binary through ZipStorage", async function () {
    this.timeout(30000);

    const project = await _loadProjectFromScenario("deployCommand");

    if (!creatorTools) {
      assert.fail("Not properly initialized");
      return;
    }

    // Create and populate zip
    const zipStorage = new ZipStorage();
    await ProjectExporter.deployProject(creatorTools, project, zipStorage.rootFolder);
    await zipStorage.rootFolder.saveAll();

    // Generate binary
    const zipBinary = await zipStorage.generateBlobAsync();

    // Create new ZipStorage and load from binary (simulates what server does)
    const receivedZip = new ZipStorage();
    await receivedZip.loadFromUint8Array(new Uint8Array(zipBinary));

    await receivedZip.rootFolder.load(true);

    // Verify structure is preserved
    const dbpFolder2 = receivedZip.rootFolder.folders["development_behavior_packs"];
    expect(dbpFolder2).to.not.be.undefined;

    if (dbpFolder2) {
      await dbpFolder2.load(true);

      const packFolderNames = Object.keys(dbpFolder2.folders);
      expect(packFolderNames.length).to.be.greaterThan(0);
    }
  });
});

describe("deploy-server-simulation", async () => {
  before((done) => {
    removeResultFolder("deployServerSim");
    done();
  });

  it("simulates full deploy workflow to folder", async function () {
    this.timeout(60000);

    const project = await _loadProjectFromScenario("deployCommand");

    if (!creatorTools || !resultsFolder) {
      assert.fail("Not properly initialized");
      return;
    }

    // Step 1: Client-side packaging (like RemoteMinecraft.prepareAndStart)
    const zipStorage = new ZipStorage();
    await ProjectExporter.deployProject(creatorTools, project, zipStorage.rootFolder);
    await zipStorage.rootFolder.saveAll();

    // Step 2: Generate binary (simulating network transfer)
    const zipBinary = await zipStorage.generateBlobAsync();

    // Step 3: Server-side receiving (like HttpServer upload endpoint)
    const receivedZip = new ZipStorage();
    await receivedZip.loadFromUint8Array(new Uint8Array(zipBinary));

    // Step 4: Server-side deployment (like DedicatedServer.deploy)
    // Deploy to a test folder instead of real server location
    const deployTargetFolder = resultsFolder.ensureFolder("deployServerSim");
    await deployTargetFolder.ensureExists();

    // Create simulated server structure
    const behaviorPacksFolder = deployTargetFolder.ensureFolder("development_behavior_packs");
    await behaviorPacksFolder.ensureExists();

    // Sync from received zip to target
    await receivedZip.rootFolder.load(true);

    if (receivedZip.rootFolder.folders["development_behavior_packs"]) {
      const sourceDbp = receivedZip.rootFolder.folders["development_behavior_packs"];
      await sourceDbp.load(true);

      const filesUpdated = await StorageUtilities.syncFolderTo(sourceDbp, behaviorPacksFolder, false, false, false);
      expect(filesUpdated).to.be.greaterThan(0);
    }

    await behaviorPacksFolder.saveAll();
    await behaviorPacksFolder.load(true);

    // Verify deployment succeeded
    const deployedPacks = Object.keys(behaviorPacksFolder.folders);
    expect(deployedPacks.length).to.be.greaterThan(0);
  });

  it("deployed content matches baseline", async function () {
    this.timeout(60000);

    // This test verifies that the deployment output matches the expected baseline
    // The baseline is stored in test/scenarios/deployServerSim/
    await folderMatches(scenariosFolder, resultsFolder, "deployServerSim");
  });
});

describe("deploy-incremental", async () => {
  before((done) => {
    removeResultFolder("deployIncremental");
    done();
  });

  it("detects differences between deployments", async function () {
    this.timeout(60000);

    const project = await _loadProjectFromScenario("deployCommand");

    if (!creatorTools) {
      assert.fail("Not properly initialized");
      return;
    }

    // First deployment
    const firstZip = new ZipStorage();
    await ProjectExporter.deployProject(creatorTools, project, firstZip.rootFolder);
    await firstZip.rootFolder.saveAll();

    // Second deployment (same content)
    const secondZip = new ZipStorage();
    await ProjectExporter.deployProject(creatorTools, project, secondZip.rootFolder);
    await secondZip.rootFolder.saveAll();

    // Compare them
    const differenceSet = await StorageUtilities.getDifferences(firstZip.rootFolder, secondZip.rootFolder, true, false);

    const hasDeletions = differenceSet.getHasDeletions();

    // With identical content, should have no differences
    expect(differenceSet.fileDifferences.length).to.equal(0);
    expect(differenceSet.folderDifferences.length).to.equal(0);
    expect(hasDeletions).to.equal(false);
  });

  it("identifies reloadable changes", async function () {
    this.timeout(30000);

    // Create a mock difference set with only script changes
    // This tests MinecraftUtilities.isReloadableSetOfChanges

    const zipA = new ZipStorage();
    const scriptsFolder = zipA.rootFolder.ensureFolder("development_behavior_packs/test/scripts");
    await scriptsFolder.ensureExists();

    const scriptFile = scriptsFolder.ensureFile("main.js");
    scriptFile.setContent("console.log('version 1');");
    await scriptFile.saveContent();
    await zipA.rootFolder.saveAll();

    const zipB = new ZipStorage();
    const scriptsFolder2 = zipB.rootFolder.ensureFolder("development_behavior_packs/test/scripts");
    await scriptsFolder2.ensureExists();

    const scriptFile2 = scriptsFolder2.ensureFile("main.js");
    scriptFile2.setContent("console.log('version 2');");
    await scriptFile2.saveContent();
    await zipB.rootFolder.saveAll();

    const differenceSet = await StorageUtilities.getDifferences(zipA.rootFolder, zipB.rootFolder, true, false);

    if (differenceSet.fileDifferences.length > 0) {
      const isReloadable = MinecraftUtilities.isReloadableSetOfChanges(differenceSet);
      // Script-only changes should be reloadable
      expect(isReloadable).to.equal(true);
    }
  });
});

describe("deploy-multi-chunk-body", async () => {
  it("handles multi-chunk zip body correctly", async function () {
    this.timeout(30000);

    // This tests the fix for the bug where body.length === 1 check failed
    // for larger payloads that arrive in multiple chunks

    const project = await _loadProjectFromScenario("deployCommand");

    if (!creatorTools) {
      assert.fail("Not properly initialized");
      return;
    }

    const zipStorage = new ZipStorage();
    await ProjectExporter.deployProject(creatorTools, project, zipStorage.rootFolder);
    await zipStorage.rootFolder.saveAll();

    const zipBinary = await zipStorage.generateBlobAsync();

    // Simulate chunked arrival by splitting the binary
    const chunkSize = 1024; // 1KB chunks
    const chunks: Uint8Array[] = [];

    for (let i = 0; i < zipBinary.length; i += chunkSize) {
      chunks.push(new Uint8Array(zipBinary.slice(i, Math.min(i + chunkSize, zipBinary.length))));
    }

    // Simulate the fixed server-side concatenation
    const concatenatedBuffer = Buffer.concat(chunks.map((c) => Buffer.from(c)));
    const contentUint = new Uint8Array(concatenatedBuffer);

    expect(contentUint.length).to.equal(zipBinary.length);

    // Verify the concatenated data can be loaded as zip
    const receivedZip = new ZipStorage();
    await receivedZip.loadFromUint8Array(contentUint);

    await receivedZip.rootFolder.load(true);
    expect(receivedZip.rootFolder.folders["development_behavior_packs"]).to.not.be.undefined;
  });
});

describe("deploy-syncFlatPackRefWorld", async () => {
  before((done) => {
    removeResultFolder("syncFlatWorld");
    done();
  });

  it("generates a world folder with levelname.txt and pack refs", async function () {
    this.timeout(30000);

    const project = await _loadProjectFromSampleContent("deployJs");

    if (!creatorTools || !resultsFolder) {
      assert.fail("Not properly initialized");
      return;
    }

    const worldName = "TestFlatWorld";
    const worldFolder = resultsFolder.ensureFolder("syncFlatWorld").ensureFolder("testWorld");
    await worldFolder.ensureExists();

    await ProjectExporter.syncFlatPackRefWorldTo(creatorTools, project, worldFolder, worldName);
    await worldFolder.saveAll();
    await worldFolder.load(true);

    // levelname.txt should exist
    const levelnameFile = worldFolder.files["levelname.txt"];
    expect(levelnameFile, "levelname.txt should exist").to.not.be.undefined;

    // level.dat should exist (binary world settings)
    const levelDatFile = worldFolder.files["level.dat"];
    expect(levelDatFile, "level.dat should exist").to.not.be.undefined;

    // world_behavior_packs.json should reference the project's BP
    const wbpFile = worldFolder.files["world_behavior_packs.json"];
    expect(wbpFile, "world_behavior_packs.json should exist").to.not.be.undefined;

    if (wbpFile) {
      await wbpFile.loadContent();
      const wbpContent = JSON.parse(wbpFile.content as string);
      expect(wbpContent).to.be.an("array");
      expect(wbpContent.length).to.be.greaterThan(0, "Should have at least one behavior pack ref");

      const bpRef = wbpContent.find((p: { pack_id: string }) => p.pack_id === project.defaultBehaviorPackUniqueId);
      expect(bpRef, "Behavior pack ref should match project BP UUID").to.not.be.undefined;
    }
  });

  it("sets betaApisExperiment on the generated world", async function () {
    this.timeout(30000);

    const project = await _loadProjectFromSampleContent("deployJs");

    if (!creatorTools || !resultsFolder) {
      assert.fail("Not properly initialized");
      return;
    }

    // Generate via the underlying function so we can inspect the MCWorld object
    const mcworld = await ProjectExporter.generateFlatGameTestWorldWithPackRefs(project, "BetaApiTest");

    expect(mcworld, "MCWorld should be generated").to.not.be.undefined;

    if (mcworld) {
      expect(mcworld.betaApisExperiment).to.equal(true);
      expect(mcworld.name).to.equal("BetaApiTest");
    }
  });
});

describe("deploy-worldId-uniqueness", async () => {
  it("different projects get different deployWorldIds", async function () {
    this.timeout(30000);

    const projectA = await _loadProjectFromSampleContent("deployJs");
    const projectB = await _loadProjectFromSampleContent("simple");

    const idA = projectA.deployWorldId;
    const idB = projectB.deployWorldId;

    expect(idA).to.be.a("string");
    expect(idB).to.be.a("string");
    expect(idA.length).to.be.greaterThan(0);
    expect(idB.length).to.be.greaterThan(0);
    expect(idA).to.not.equal(idB, "Different projects must have different deployWorldIds");
  });

  it("deployWorldId is a valid UUID format", async function () {
    this.timeout(10000);

    const project = await _loadProjectFromSampleContent("deployJs");
    const id = project.deployWorldId;

    // UUID v4 pattern: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(id).to.match(uuidPattern, "deployWorldId should be a valid UUID v4");
  });

  it("worlds deployed from different projects go to different folders", async function () {
    this.timeout(30000);

    const projectA = await _loadProjectFromSampleContent("deployJs");
    const projectB = await _loadProjectFromSampleContent("simple");

    if (!creatorTools || !resultsFolder) {
      assert.fail("Not properly initialized");
      return;
    }

    const worldsFolder = resultsFolder.ensureFolder("syncFlatWorld").ensureFolder("worldsUniqueness");
    await worldsFolder.ensureExists();

    // Deploy project A
    const folderA = worldsFolder.ensureFolder(projectA.deployWorldId);
    await folderA.ensureExists();
    await ProjectExporter.syncFlatPackRefWorldTo(creatorTools, projectA, folderA, projectA.name + " _mct");
    await folderA.saveAll();

    // Deploy project B
    const folderB = worldsFolder.ensureFolder(projectB.deployWorldId);
    await folderB.ensureExists();
    await ProjectExporter.syncFlatPackRefWorldTo(creatorTools, projectB, folderB, projectB.name + " _mct");
    await folderB.saveAll();

    // The folder names should be different
    expect(folderA.name).to.not.equal(folderB.name);

    // Both should have levelname.txt
    await folderA.load(true);
    await folderB.load(true);

    const nameFileA = folderA.files["levelname.txt"];
    const nameFileB = folderB.files["levelname.txt"];
    expect(nameFileA, "Project A world should have levelname.txt").to.not.be.undefined;
    expect(nameFileB, "Project B world should have levelname.txt").to.not.be.undefined;

    // Pack refs should reference different project UUIDs
    const wbpFileA = folderA.files["world_behavior_packs.json"];
    const wbpFileB = folderB.files["world_behavior_packs.json"];
    expect(wbpFileA, "Project A should have world_behavior_packs.json").to.not.be.undefined;
    expect(wbpFileB, "Project B should have world_behavior_packs.json").to.not.be.undefined;

    if (wbpFileA && wbpFileB) {
      await wbpFileA.loadContent();
      await wbpFileB.loadContent();
      const packsA = JSON.parse(wbpFileA.content as string);
      const packsB = JSON.parse(wbpFileB.content as string);
      expect(packsA[0].pack_id).to.not.equal(
        packsB[0].pack_id,
        "Pack refs should reference different behavior pack UUIDs"
      );
    }
  });
});

describe("deploy-worldId-persistence", async () => {
  it("deployWorldId is stable across multiple accesses", async function () {
    this.timeout(10000);

    const project = await _loadProjectFromSampleContent("deployJs");

    const firstAccess = project.deployWorldId;
    const secondAccess = project.deployWorldId;
    const thirdAccess = project.deployWorldId;

    expect(firstAccess).to.equal(secondAccess);
    expect(secondAccess).to.equal(thirdAccess);
  });

  it("deployWorldId can be explicitly set and persists", async function () {
    this.timeout(10000);

    const project = await _loadProjectFromSampleContent("deployJs");

    const customId = "custom-world-id-12345";
    project.deployWorldId = customId;

    expect(project.deployWorldId).to.equal(customId);
  });

  it("same project reuses world folder on repeated deploys", async function () {
    this.timeout(30000);

    const project = await _loadProjectFromSampleContent("deployJs");

    if (!creatorTools || !resultsFolder) {
      assert.fail("Not properly initialized");
      return;
    }

    const worldsFolder = resultsFolder.ensureFolder("syncFlatWorld").ensureFolder("worldsPersistence");
    await worldsFolder.ensureExists();

    const worldId = project.deployWorldId;

    // First deploy
    const worldFolder = worldsFolder.ensureFolder(worldId);
    await worldFolder.ensureExists();
    await ProjectExporter.syncFlatPackRefWorldTo(creatorTools, project, worldFolder, project.name + " _mct");
    await worldFolder.saveAll();

    // Second deploy — should use the same folder
    const worldId2 = project.deployWorldId;
    expect(worldId2).to.equal(worldId, "deployWorldId should be stable between deploys");

    const worldFolder2 = worldsFolder.ensureFolder(worldId2);
    await worldFolder2.ensureExists();
    await ProjectExporter.syncFlatPackRefWorldTo(creatorTools, project, worldFolder2, project.name + " _mct");
    await worldFolder2.saveAll();

    // Verify the folder name is the same
    expect(worldFolder.name).to.equal(worldFolder2.name);

    // Verify world still has correct structure after re-deploy
    await worldFolder2.load(true);
    const levelnameFile = worldFolder2.files["levelname.txt"];
    expect(levelnameFile, "World should have levelname.txt after re-deploy").to.not.be.undefined;

    const wbpFile = worldFolder2.files["world_behavior_packs.json"];
    expect(wbpFile, "World should have world_behavior_packs.json after re-deploy").to.not.be.undefined;
  });
});

describe("deploy-project-isolation", async () => {
  before((done) => {
    removeResultFolder("projectIsolation");
    done();
  });

  it("deploying project B to a folder clears project A's packs", async function () {
    this.timeout(30000);

    const projectA = await _loadProjectFromSampleContent("deployJs");
    const projectB = await _loadProjectFromSampleContent("simple");

    if (!creatorTools || !resultsFolder) {
      assert.fail("Not properly initialized");
      return;
    }

    const serverFolder = resultsFolder.ensureFolder("projectIsolation").ensureFolder("packCleanup");
    await serverFolder.ensureExists();

    // Deploy project A
    await ProjectExporter.deployProject(creatorTools, projectA, serverFolder);
    await serverFolder.saveAll();
    await serverFolder.load(true);

    const dbpFolder = serverFolder.folders["development_behavior_packs"];
    expect(dbpFolder, "dev BP folder should exist after first deploy").to.not.be.undefined;

    if (dbpFolder) {
      await dbpFolder.load(true);
      const packANames = Object.keys(dbpFolder.folders);
      expect(packANames.length).to.be.greaterThan(0, "Project A should have packs deployed");

      // Now clear and deploy project B (simulating DedicatedServer.deploy full POST behavior)
      await dbpFolder.deleteAllFolderContents();
      await dbpFolder.ensureExists();
    }

    const drpFolder = serverFolder.folders["development_resource_packs"];
    if (drpFolder) {
      await drpFolder.deleteAllFolderContents();
      await drpFolder.ensureExists();
    }

    await ProjectExporter.deployProject(creatorTools, projectB, serverFolder);
    await serverFolder.saveAll();

    // Reload and verify only project B's packs are present
    const dbpFolder2 = serverFolder.ensureFolder("development_behavior_packs");
    await dbpFolder2.load(true);
    const packBNames = Object.keys(dbpFolder2.folders);
    expect(packBNames.length).to.be.greaterThan(0, "Project B should have packs deployed");

    // Project A's pack folder should NOT exist
    const bpFolderA = await projectA.getDefaultBehaviorPackFolder();
    if (bpFolderA) {
      const aName = StorageUtilities.canonicalizeName(bpFolderA.ensuredName);
      expect(dbpFolder2.folders[aName], "Project A's BP folder should be gone after deploying B").to.be.undefined;
    }
  });

  it("world pack references are reset when deploying a new project", async function () {
    this.timeout(30000);

    const projectA = await _loadProjectFromSampleContent("deployJs");
    const projectB = await _loadProjectFromSampleContent("simple");

    if (!creatorTools || !resultsFolder) {
      assert.fail("Not properly initialized");
      return;
    }

    const worldFolder = resultsFolder.ensureFolder("projectIsolation").ensureFolder("worldRefs");
    await worldFolder.ensureExists();

    // Create a world with project A's pack references
    const worldA = new MCWorld();
    worldA.ensureBehaviorPack(projectA.defaultBehaviorPackUniqueId, projectA.defaultBehaviorPackVersion, projectA.name);
    worldA.name = "Test World";
    await worldA.syncFolderTo(worldFolder);
    await worldFolder.saveAll();

    // Verify project A's refs are there
    const worldCheck = new MCWorld();
    worldCheck.folder = worldFolder;
    await worldCheck.loadMetaFiles(false);
    expect(worldCheck.worldBehaviorPacks).to.not.be.undefined;
    expect(worldCheck.worldBehaviorPacks!.length).to.equal(1);
    expect(worldCheck.getBehaviorPack(projectA.defaultBehaviorPackUniqueId)).to.not.be.undefined;

    // Now simulate what DedicatedServer.deploy does on project change:
    // detect the mismatch and reset pack references
    const existingBp = worldCheck.getBehaviorPack(projectB.defaultBehaviorPackUniqueId);

    expect(existingBp, "Project B's BP should NOT be in the world yet").to.be.undefined;

    // Since world has refs but none match project B, clear them
    if (worldCheck.worldBehaviorPacks && worldCheck.worldBehaviorPacks.length > 0 && !existingBp) {
      worldCheck.worldBehaviorPacks = [];
      worldCheck.worldResourcePacks = [];
      worldCheck.worldBehaviorPackHistory = { packs: [] };
      worldCheck.worldResourcePackHistory = { packs: [] };
    }

    // Add project B's packs
    worldCheck.ensureBehaviorPack(
      projectB.defaultBehaviorPackUniqueId,
      projectB.defaultBehaviorPackVersion,
      projectB.name
    );
    await worldCheck.save();

    // Reload and verify ONLY project B's refs exist
    const worldFinal = new MCWorld();
    worldFinal.folder = worldFolder;
    await worldFinal.loadMetaFiles(false);

    expect(worldFinal.worldBehaviorPacks).to.not.be.undefined;
    expect(worldFinal.worldBehaviorPacks!.length).to.equal(1, "Should have exactly 1 BP ref");
    expect(worldFinal.getBehaviorPack(projectB.defaultBehaviorPackUniqueId), "Project B's BP should be in the world").to
      .not.be.undefined;
    expect(
      worldFinal.getBehaviorPack(projectA.defaultBehaviorPackUniqueId),
      "Project A's BP should NOT be in the world"
    ).to.be.undefined;
  });

  it("re-deploying the same project preserves world refs", async function () {
    this.timeout(30000);

    const project = await _loadProjectFromSampleContent("deployJs");

    if (!creatorTools || !resultsFolder) {
      assert.fail("Not properly initialized");
      return;
    }

    const worldFolder = resultsFolder.ensureFolder("projectIsolation").ensureFolder("sameProject");
    await worldFolder.ensureExists();

    // Create a world with the project's pack references
    const world = new MCWorld();
    world.ensureBehaviorPack(project.defaultBehaviorPackUniqueId, project.defaultBehaviorPackVersion, project.name);
    world.name = "Test World";
    await world.syncFolderTo(worldFolder);
    await worldFolder.saveAll();

    // Simulate DedicatedServer.deploy mismatch check for the SAME project
    const worldCheck = new MCWorld();
    worldCheck.folder = worldFolder;
    await worldCheck.loadMetaFiles(false);

    const existingBp = worldCheck.getBehaviorPack(project.defaultBehaviorPackUniqueId);
    expect(existingBp, "Same project's BP should match — world should NOT be wiped").to.not.be.undefined;

    // Since the BP matches, we should NOT clear the world
    const shouldClear =
      worldCheck.worldBehaviorPacks !== undefined && worldCheck.worldBehaviorPacks.length > 0 && !existingBp;
    expect(shouldClear).to.equal(false, "Same project should not trigger world reset");
  });
});
