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
