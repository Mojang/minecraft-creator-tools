import { assert } from "chai";
import Carto from "../app/Carto";
import Project, { ProjectAutoDeploymentMode } from "../app/Project";
import CartoApp, { HostType } from "../app/CartoApp";
import NodeStorage from "../local/NodeStorage";
import Database from "../minecraft/Database";
import LocalEnvironment from "../local/LocalEnvironment";
import IFolder from "../storage/IFolder";
import StorageUtilities from "../storage/StorageUtilities";
import { spawn } from "child_process";
import { chunksToLinesAsync } from "@rauschma/stringio";
import { Readable } from "stream";
import * as fs from "fs";
import Utilities from "../core/Utilities";
import ProjectInfoSet from "../info/ProjectInfoSet";
import { ProjectInfoSuite } from "../info/IProjectInfoData";
import ProjectUtilities from "../app/ProjectUtilities";

CartoApp.hostType = HostType.testLocal;

let carto: Carto | undefined = undefined;
let localEnv: LocalEnvironment | undefined = undefined;

let scenariosFolder: IFolder | undefined = undefined;
let resultsFolder: IFolder | undefined = undefined;
let sampleFolder: IFolder | undefined = undefined;

localEnv = new LocalEnvironment(false);

(async () => {
  CartoApp.localFolderExists = _localFolderExists;
  CartoApp.ensureLocalFolder = _ensureLocalFolder;

  const testRootPath = NodeStorage.ensureEndsWithDelimiter(__dirname) + "/../../test/";
  const sampleContentRootPath = NodeStorage.ensureEndsWithDelimiter(__dirname) + "/../../../";

  const scenariosStorage = new NodeStorage(testRootPath, "scenarios");

  scenariosFolder = scenariosStorage.rootFolder;

  await scenariosFolder.ensureExists();

  const resultsStorage = new NodeStorage(testRootPath, "results");

  resultsFolder = resultsStorage.rootFolder;

  await resultsFolder.ensureExists();

  const sampleContentStorage = new NodeStorage(sampleContentRootPath, "samplecontent");

  sampleFolder = sampleContentStorage.rootFolder;

  await sampleFolder.ensureExists();

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

  await CartoApp.init(); // carto app init does something here that, if removed, causes these tests to fail. Also, await needs to be here.

  carto = CartoApp.carto;

  if (!carto) {
    return;
  }

  await carto.load();

  run();
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

    // guard against being called at a "more root" file path
    if (fs.existsSync(path) && Utilities.countChar(path, NodeStorage.platformFolderDelimiter) > 5)
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

function ensureResultFolder(scenarioName: string) {
  if (resultsFolder) {
    const path =
      StorageUtilities.ensureEndsWithDelimiter(resultsFolder.fullPath) +
      StorageUtilities.ensureEndsWithDelimiter(scenarioName);
    if (!fs.existsSync(path))
      // @ts-ignore
      fs.mkdirSync(path, {
        recursive: true,
      });
  }
}

describe("worldCommand", async () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  before(function (done) {
    this.timeout(10000);

    removeResultFolder("worldCommand");
    ensureResultFolder("worldCommand");

    const process = spawn("node", [
      " ./../toolbuild/jsn/cli",
      "world",
      "set",
      "-i",
      "./test/results/worldCommand",
      "-betaapis",
      "-o",
      "./test/results/worldCommand/",
    ]);

    collectLines(process.stdout, stdoutLines);
    collectLines(process.stderr, stderrLines);

    process.on("exit", (code) => {
      exitCode = code;
      done();
    });
  });

  it("should have no stderr lines", async () => {
    assert.equal(stderrLines.length, 0, "Error: |" + stderrLines.join("\n") + "|");
  }).timeout(10000);

  it("exit code should be zero", async () => {
    assert.equal(exitCode, 0);
  }).timeout(10000);

  it("output matches", async () => {
    await folderMatches("worldCommand");
  });
});

describe("createCommandAddonStarter", async () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];
  let project: Project | null = null;
  let allProjectInfoSet: ProjectInfoSet | null = null;
  let addonProjectInfoSet: ProjectInfoSet | null = null;

  before(function (done) {
    this.timeout(10000);

    removeResultFolder("createCommandAddonStarter");

    const process = spawn("node", [
      " ./../toolbuild/jsn/cli",
      "create",
      "testerName",
      "addonStarter",
      "testerCreatorName",
      "testerDescription",
      "-o",
      "./test/results/createCommandAddonStarter/",
    ]);

    collectLines(process.stdout, stdoutLines);
    collectLines(process.stderr, stderrLines);

    process.on("exit", (code) => {
      exitCode = code;

      assert(carto, "Carto is not properly initialized");

      project = new Project(carto, "createCommandAddonStarter", null);

      // exclude eslint because we know the .ts comes with some warnings due to
      // the starter TS having some unused variables.
      allProjectInfoSet = new ProjectInfoSet(project, ProjectInfoSuite.allExceptAddOn, ["ESLINT"]);

      addonProjectInfoSet = new ProjectInfoSet(project, ProjectInfoSuite.addOn);

      project.autoDeploymentMode = ProjectAutoDeploymentMode.noAutoDeployment;
      project.localFolderPath = __dirname + "/../../test/results/createCommandAddonStarter/";

      project.inferProjectItemsFromFiles().then(() => {
        assert(project);

        ProjectUtilities.setIsAddon(project).then(() => {
          assert(allProjectInfoSet);

          allProjectInfoSet.generateForProject().then(() => {
            assert(addonProjectInfoSet);

            addonProjectInfoSet.generateForProject().then(() => {
              done();
            });
          });
        });
      });
    });
  });

  it("should have no stderr lines", async () => {
    assert.equal(stderrLines.length, 0, "Error: |" + stderrLines.join("\n") + "|");
  }).timeout(10000);

  it("exit code should be zero", async () => {
    assert.equal(exitCode, 0);
  }).timeout(10000);

  it("should have 17 project items", async () => {
    assert(project);
    assert.equal(project.items.length, 17);
  }).timeout(10000);

  it("main validation should have 0 errors, failures, or warnings", async () => {
    assert(allProjectInfoSet);
    assert.equal(allProjectInfoSet.errorFailWarnCount, 0, allProjectInfoSet.errorFailWarnString);
  }).timeout(10000);

  it("addon validation should have 0 errors, failures, or warnings", async () => {
    assert(addonProjectInfoSet);
    assert.equal(addonProjectInfoSet.errorFailWarnCount, 0, addonProjectInfoSet.errorFailWarnString);
  }).timeout(10000);

  it("output matches", async () => {
    await folderMatches("createCommandAddonStarter", ["manifest.json"]);
  });
});

describe("validateAddons1WellFormedCommand", async () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  before(function (done) {
    this.timeout(10000);

    removeResultFolder("validateAddons1WellFormedCommand");

    const process = spawn("node", [
      " ./../toolbuild/jsn/cli",
      "val",
      "addon",
      "-i",
      "./../samplecontent/addon/build/content1",
      "-o",
      "./test/results/validateAddons1WellFormedCommand/",
    ]);

    collectLines(process.stdout, stdoutLines);
    collectLines(process.stderr, stderrLines);

    process.on("exit", (code) => {
      exitCode = code;
      done();
    });
  });

  it("should have no stderr lines", function (done) {
    assert.equal(stderrLines.length, 0, "Error: |" + stderrLines.join("\n") + "|");
    done();
  }).timeout(10000);

  it("exit code should be zero", function (done) {
    assert.equal(exitCode, 0);
    done();
  }).timeout(10000);

  it("output matches", async function () {
    await folderMatches("validateAddons1WellFormedCommand");
  }).timeout(10000);
});

describe("validateAddons2AnimationManifestErrorsCommand", async () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  before(function (done) {
    this.timeout(10000);

    removeResultFolder("validateAddons2AnimationManifestErrorsCommand");

    const process = spawn("node", [
      " ./../toolbuild/jsn/cli",
      "val",
      "addon",
      "-i",
      "./../samplecontent/addon/build/content2",
      "-o",
      "./test/results/validateAddons2AnimationManifestErrorsCommand/",
    ]);

    collectLines(process.stdout, stdoutLines);
    collectLines(process.stderr, stderrLines);

    process.on("exit", (code) => {
      exitCode = code;
      done();
    });
  });

  it("should have no stderr lines", async (done) => {
    assert.equal(stderrLines.length, 0, "Error: |" + stderrLines.join("\n") + "|");
    done();
  }).timeout(10000);

  it("exit code should be zero", async (done) => {
    assert.equal(exitCode, 0);
    done();
  }).timeout(10000);

  it("output matches", async function () {
    await folderMatches("validateAddons2AnimationManifestErrorsCommand");
  }).timeout(10000);
});

describe("validateAddons3ExtraneousStuffUsesMinecraftCommand", async () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  before(function (done) {
    this.timeout(20000);

    removeResultFolder("validateAddons3ExtraneousStuffUsesMinecraftCommand");

    const process = spawn("node", [
      " ./../toolbuild/jsn/cli",
      "val",
      "addon",
      "-i",
      "./../samplecontent/addon/build/content3",
      "-o",
      "./test/results/validateAddons3ExtraneousStuffUsesMinecraftCommand/",
    ]);

    collectLines(process.stdout, stdoutLines);
    collectLines(process.stderr, stderrLines);

    process.on("exit", (code) => {
      exitCode = code;
      done();
    });
  });

  it("should have no stderr lines", async (done) => {
    assert.equal(stderrLines.length, 0, "Error: |" + stderrLines.join("\n") + "|");
    done();
  }).timeout(10000);

  it("exit code should be zero", async (done) => {
    assert.equal(exitCode, 0);
    done();
  }).timeout(10000);

  it("output matches", async function () {
    await folderMatches("validateAddons3ExtraneousStuffUsesMinecraftCommand");
  });
});

describe("validateAddons3PlatformVersions", async () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  before(function (done) {
    this.timeout(20000);

    removeResultFolder("validateAddons3PlatformVersions");

    const process = spawn("node", [
      " ./../toolbuild/jsn/cli",
      "val",
      "currentplatform",
      "-i",
      "./../samplecontent/addon/build/content3",
      "-o",
      "./test/results/validateAddons3PlatformVersions/",
    ]);

    collectLines(process.stdout, stdoutLines);
    collectLines(process.stderr, stderrLines);

    process.on("exit", (code) => {
      exitCode = code;
      done();
    });
  });

  it("should have no stderr lines", async (done) => {
    assert.equal(stderrLines.length, 0, "Error: |" + stderrLines.join("\n") + "|");
    done();
  }).timeout(10000);

  it("exit code should be zero", async (done) => {
    assert.equal(exitCode, 0);
    done();
  }).timeout(10000);

  it("output matches", async function () {
    await folderMatches("validateAddons3PlatformVersions");
  });
});

async function collectLines(readable: Readable, data: string[]) {
  for await (const line of chunksToLinesAsync(readable)) {
    if (line !== undefined && line.length >= 0) {
      let lineUp = line.replace(/\\n/g, "");
      lineUp = lineUp.replace(/\\r/g, "");

      if (lineUp.indexOf("ebugger") <= 0) {
        // ignore any lines about the debugger.
        // console.log(lineUp);
        data.push(lineUp);
      }
    }
  }
}

async function folderMatches(scenarioName: string, excludeFileList?: string[]) {
  if (!scenariosFolder || !resultsFolder) {
    assert.fail("Not properly initialized");
  }

  const scenarioOutFolder = resultsFolder.ensureFolder(scenarioName);
  await scenarioOutFolder.ensureExists();

  const scenarioFolder = scenariosFolder.ensureFolder(scenarioName);

  const isEqual = await StorageUtilities.folderContentsEqual(scenarioFolder, scenarioOutFolder, excludeFileList, true, [
    "generatorVersion",
    "uuid",
    "version",
  ]);

  assert(
    isEqual.result,
    "Folder '" + scenarioFolder.fullPath + "' does not match for scenario '" + scenarioName + "', " + isEqual.reason
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function ensureJsonMatchesScenario(obj: object, scenarioName: string) {
  if (!scenariosFolder || !resultsFolder) {
    assert.fail("Not properly initialized");
  }

  const dataObjectStr = JSON.stringify(obj, null, 2);

  const scenarioOutFolder = resultsFolder.ensureFolder(scenarioName);
  await scenarioOutFolder.ensureExists();

  const outFile = scenarioOutFolder.ensureFile("report.json");
  outFile.setContent(dataObjectStr);
  await outFile.saveContent();

  const scenarioFile = scenariosFolder.ensureFolder(scenarioName).ensureFile("report.json");

  const exists = await scenarioFile.exists();

  assert(exists, "report.json file for scenario '" + scenarioName + "' does not exist.");

  const isEqual = await StorageUtilities.fileContentsEqual(scenarioFile, outFile, true, [
    "generatorVersion",
    "uuid",
    "version",
  ]);

  assert(
    isEqual,
    "report.json file '" + scenarioFile.fullPath + "' does not match for scenario '" + scenarioName + "'"
  );
}
