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

CartoApp.hostType = HostType.testLocal;

let carto: Carto | undefined = undefined;
let localEnv: LocalEnvironment | undefined = undefined;

let scenariosFolder: IFolder | undefined = undefined;

let resultsFolder: IFolder | undefined = undefined;

localEnv = new LocalEnvironment(false);

(async () => {
  CartoApp.localFolderExists = _localFolderExists;
  CartoApp.ensureLocalFolder = _ensureLocalFolder;

  const testRootPath = NodeStorage.ensureEndsWithDelimiter(__dirname) + "/../../test/";

  const scenariosStorage = new NodeStorage(testRootPath, "scenarios");

  scenariosFolder = scenariosStorage.rootFolder;

  await scenariosFolder.ensureExists();

  const resultsStorage = new NodeStorage(testRootPath, "results");

  resultsFolder = resultsStorage.rootFolder;

  await resultsFolder.ensureExists();

  CartoApp.prefsStorage = new NodeStorage(
    localEnv.utilities.testWorkingPath + "prefs" + NodeStorage.folderDelimiter,
    ""
  );

  CartoApp.projectsStorage = new NodeStorage(
    localEnv.utilities.testWorkingPath + "projects" + NodeStorage.folderDelimiter,
    ""
  );

  CartoApp.packStorage = new NodeStorage(
    localEnv.utilities.testWorkingPath + "packs" + NodeStorage.folderDelimiter,
    ""
  );

  CartoApp.worldStorage = new NodeStorage(
    localEnv.utilities.testWorkingPath + "worlds" + NodeStorage.folderDelimiter,
    ""
  );

  CartoApp.deploymentStorage = new NodeStorage(
    localEnv.utilities.testWorkingPath + "deployment" + NodeStorage.folderDelimiter,
    ""
  );
  CartoApp.workingStorage = new NodeStorage(
    localEnv.utilities.testWorkingPath + "working" + NodeStorage.folderDelimiter,
    ""
  );

  const coreStorage = new NodeStorage(__dirname + "/../../public/data/content/", "");
  Database.contentFolder = coreStorage.rootFolder;

  await CartoApp.init(); // carto app init does something here that, if removed, causes these tests to fail.

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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function _loadProject(name: string) {
  if (!carto || !scenariosFolder || !resultsFolder) {
    assert.fail("Not properly initialized");
  }

  const project = new Project(carto, name, null);

  project.autoDeploymentMode = ProjectAutoDeploymentMode.noAutoDeployment;
  project.localFolderPath = __dirname + "/../../../tests/" + name + "/";

  await project.loadFolderStructure();
  await project.inferProjectItemsFromFiles();

  return project;
}

function removeResultFolder(scenarioName: string) {
  if (resultsFolder) {
    const path =
      StorageUtilities.ensureEndsWithDelimiter(resultsFolder.fullPath) +
      StorageUtilities.ensureEndsWithDelimiter(scenarioName);
    if (fs.existsSync(path))
      // @ts-ignore
      fs.rmSync(path, {
        recursive: true,
      });
  }
}

describe("worldCommand", async () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  before((done) => {
    removeResultFolder("worldCommand");

    const process = spawn("node", [
      " ./../toolbuild/jsn/cli",
      "world",
      "set",
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

describe("deployCommand", async () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  before((done) => {
    removeResultFolder("deployCommand");

    const process = spawn("node", [
      " ./../toolbuild/jsn/cli",
      "deploy",
      "folder",
      "-i",
      "./../tests/simple/",
      "-o",
      "./test/results/deployCommand/",
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
  });

  it("exit code should be zero", async () => {
    assert.equal(exitCode, 0);
  });

  it("output matches", async () => {
    await folderMatches("deployCommand");
  });
});

async function collectLines(readable: Readable, data: string[]) {
  for await (const line of chunksToLinesAsync(readable)) {
    if (line !== undefined && line.length >= 0) {
      let lineUp = line.replace("\n", "");
      lineUp = lineUp.replace("\r", "");

      if (lineUp.indexOf("ebugger") <= 0) {
        // ignore any lines about the debugger.
        console.log(lineUp);
        data.push(lineUp);
      }
    }
  }
}

async function folderMatches(scenarioName: string, excludeList?: string[]) {
  if (!scenariosFolder || !resultsFolder) {
    assert.fail("Not properly initialized");
  }

  const scenarioOutFolder = resultsFolder.ensureFolder(scenarioName);
  await scenarioOutFolder.ensureExists();

  const scenarioFolder = scenariosFolder.ensureFolder(scenarioName);

  const isEqual = await StorageUtilities.folderContentsEqual(scenarioFolder, scenarioOutFolder, excludeList, true);

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

  const isEqual = await StorageUtilities.fileContentsEqual(scenarioFile, outFile, true);

  assert(
    isEqual,
    "report.json file '" + scenarioFile.fullPath + "' does not match for scenario '" + scenarioName + "'"
  );
}
