// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * GitHubDependentTests - Tests that require access to GitHub API
 *
 * These tests are separated from the main test suite because they:
 * - Depend on GitHub API availability and rate limits
 * - May fail when running without authentication (rate limited to 60 req/hr)
 * - Are slower due to network operations
 *
 * To run these tests:
 *   npm run test-extra                                    # Run all optional tests
 *   npm run test-extra -- --grep "GitHub"                 # Run only GitHub-dependent tests
 *   npm run test-extra -- --grep "createCommandAddonStarter"  # Run specific test
 *
 * Note: These tests may fail with "API rate limit exceeded" if you run them
 * too frequently without GitHub authentication.
 */

import { assert } from "chai";
import CreatorTools from "../app/CreatorTools";
import Project, { ProjectAutoDeploymentMode } from "../app/Project";
import CreatorToolsHost, { HostType } from "../app/CreatorToolsHost";
import ImageCodecNode from "../local/ImageCodecNode";
import NodeStorage from "../local/NodeStorage";
import Database from "../minecraft/Database";
import LocalEnvironment from "../local/LocalEnvironment";
import IFolder from "../storage/IFolder";
import StorageUtilities from "../storage/StorageUtilities";
import { spawn } from "child_process";
import { chunksToLinesAsync } from "@rauschma/stringio";
import { Readable } from "stream";
import * as fs from "fs";
import * as path from "path";
import ProjectInfoSet from "../info/ProjectInfoSet";
import { ProjectInfoSuite } from "../info/IProjectInfoData";
import ProjectUtilities from "../app/ProjectUtilities";
import LocalUtilities from "../local/LocalUtilities";
import { filterExpectedStderrLines } from "../test/PngTestUtilities";

CreatorToolsHost.hostType = HostType.testLocal;
CreatorToolsHost.contentWebRoot = "https://mctools.dev/";

// Set up Node.js-specific image codec functions
CreatorToolsHost.decodePng = ImageCodecNode.decodePng;
CreatorToolsHost.encodeToPng = ImageCodecNode.encodeToPng;

let creatorTools: CreatorTools | undefined = undefined;
let localEnv: LocalEnvironment | undefined = undefined;

let resultsFolder: IFolder | undefined = undefined;

localEnv = new LocalEnvironment(false);

(async () => {
  CreatorToolsHost.localFolderExists = _localFolderExists;
  CreatorToolsHost.ensureLocalFolder = _ensureLocalFolder;

  const testRootPath = path.resolve("test") + "/";

  const resultsStorage = new NodeStorage(testRootPath, "results");

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

  const coreStorage = new NodeStorage(path.resolve("public/data/content") + "/", "");
  Database.contentFolder = coreStorage.rootFolder;

  // Set up Database.local with proper path adjustment to find schemas in public/
  (localEnv.utilities as LocalUtilities).basePathAdjust = "./public/";
  Database.local = localEnv.utilities;

  await CreatorToolsHost.init();

  creatorTools = CreatorToolsHost.getCreatorTools();

  if (!creatorTools) {
    return;
  }

  creatorTools.local = localEnv.utilities;

  await creatorTools.load();
})();

function _ensureLocalFolder(path: string) {
  const ls = new NodeStorage(path, "");

  return ls.rootFolder;
}

async function _localFolderExists(path: string) {
  const ls = new NodeStorage(path, "");

  return await ls.rootFolder.exists();
}

function removeResultFolder(scenarioName: string) {
  if (resultsFolder) {
    const path =
      StorageUtilities.ensureEndsWithDelimiter(resultsFolder.fullPath) +
      StorageUtilities.ensureEndsWithDelimiter(scenarioName);

    const exists = fs.existsSync(path);

    if (exists && !StorageUtilities.isPathRiskyForDelete(path))
      try {
        fs.rmSync(path, {
          recursive: true,
        });
      } catch (e) {
        console.warn("Could not delete folder " + path);
      }
  }
}

async function collectLines(readable: Readable, data: string[]) {
  for await (const line of chunksToLinesAsync(readable)) {
    if (line !== undefined && line.length >= 0) {
      let lineUp = line.replace(/\\n/g, "");
      lineUp = lineUp.replace(/\\r/g, "");

      if (lineUp.indexOf("ebugger") <= 0) {
        // ignore any lines about the debugger.
        data.push(lineUp);
      }
    }
  }
}

/**
 * Tests for the "create" command with addonStarter template.
 * This test requires GitHub API access to download the starter template.
 *
 * NOTE: This test may fail with "API rate limit exceeded" if run too frequently.
 * GitHub unauthenticated API access is limited to 60 requests per hour.
 */
describe("GitHub Dependent Tests", function () {
  describe("createCommandAddonStarter", function () {
    let exitCode: number | null = null;
    const stdoutLines: string[] = [];
    const stderrLines: string[] = [];
    let project: Project | null = null;
    let allProjectInfoSet: ProjectInfoSet | null = null;
    let addonProjectInfoSet: ProjectInfoSet | null = null;
    let githubRateLimited = false;

    before(async function () {
      this.timeout(120000); // Longer timeout for GitHub API calls (create downloads from GitHub)

      removeResultFolder("createCommandAddonStarter");

      const process = spawn("node", [
        "./toolbuild/jsn/cli/index.mjs",
        "create",
        "testerName",
        "addonStarter",
        "testerCreatorName",
        "testerDescription",
        "-o",
        "./test/results/createCommandAddonStarter/",
        "--internalOnlyRunningInTheContextOfTestCommandLines",
      ]);

      // Collect stdout/stderr lines - these promises resolve when streams end
      const stdoutPromise = collectLines(process.stdout, stdoutLines);
      const stderrPromise = collectLines(process.stderr, stderrLines);

      // Wait for process to exit
      exitCode = await new Promise<number | null>((resolve) => {
        process.on("exit", (code) => resolve(code));
      });

      // Wait for streams to fully drain
      await Promise.all([stdoutPromise, stderrPromise]);

      // Check if we hit GitHub rate limiting
      const rateLimitIndicators = ["403", "rate limit", "API rate limit exceeded"];
      for (const line of stderrLines) {
        if (rateLimitIndicators.some((indicator) => line.toLowerCase().includes(indicator.toLowerCase()))) {
          console.log("GitHub API rate limit detected - skipping tests");
          githubRateLimited = true;
          return;
        }
      }

      assert(creatorTools, "CreatorTools is not properly initialized");

      project = new Project(creatorTools, "createCommandAddonStarter", null);

      // exclude eslint because we know the .ts comes with some warnings due to
      // the starter TS having some unused variables.
      allProjectInfoSet = new ProjectInfoSet(project, ProjectInfoSuite.defaultInDevelopment);

      addonProjectInfoSet = new ProjectInfoSet(project, ProjectInfoSuite.cooperativeAddOn);

      project.autoDeploymentMode = ProjectAutoDeploymentMode.noAutoDeployment;
      project.localFolderPath = path.resolve("test/results/createCommandAddonStarter") + "/";

      await project.inferProjectItemsFromFiles();
      assert(project);

      await ProjectUtilities.setIsAddon(project);
      assert(allProjectInfoSet);

      await allProjectInfoSet.generateForProject();
      assert(addonProjectInfoSet);

      await addonProjectInfoSet.generateForProject();
    });

    it("should have no unexpected stderr lines", async function () {
      if (githubRateLimited) {
        this.skip();
        return;
      }
      const unexpectedErrors = filterExpectedStderrLines(stderrLines);
      assert.equal(unexpectedErrors.length, 0, "Unexpected stderr: |" + unexpectedErrors.join("\n") + "|");
    }).timeout(10000);

    it("exit code should be zero", async function () {
      if (githubRateLimited) {
        this.skip();
        return;
      }
      assert.equal(exitCode, 0);
    }).timeout(10000);

    it("should have 17 project items", async function () {
      if (githubRateLimited) {
        this.skip();
        return;
      }
      assert(project);
      assert.equal(project.items.length, 17);
    }).timeout(10000);

    // TODO:
    // These tests fail because the create scripts don't create lang files
    // A separate task should be added to update the logic of the creation script

    // it("main validation should have 0 errors, failures, or warnings", async () => {
    //   assert(allProjectInfoSet);
    //   assert.equal(allProjectInfoSet.errorFailWarnCount, 0, allProjectInfoSet.errorFailWarnString);
    // }).timeout(10000);

    // it("addon validation should have 0 errors, failures, or warnings", async () => {
    //   assert(addonProjectInfoSet);
    //   assert.equal(addonProjectInfoSet.errorFailWarnCount, 0, addonProjectInfoSet.errorFailWarnString);
    // }).timeout(10000);

    // it("output matches", async () => {
    //   await folderMatches("createCommandAddonStarter", ["manifest.json"]);
    // });
  });
});
