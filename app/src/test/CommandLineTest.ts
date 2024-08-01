import { assert } from "chai";
import Carto from "../app/Carto";
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

  await CartoApp.init(); // carto app init does something here that, if removed, causes these tests to fail. Also, await needs to be here.

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

    if (fs.existsSync(path))
      // @ts-ignore
      fs.rmSync(path, {
        recursive: true,
      });
  }
}

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

      if (lineUp.indexOf("ebugger") === -1) {
        // ignore any lines about the debugger.
        console.log(lineUp);
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

  const isEqual = await StorageUtilities.fileContentsEqual(scenarioFile, outFile, true, ["generatorVersion"]);

  assert(
    isEqual,
    "report.json file '" + scenarioFile.fullPath + "' does not match for scenario '" + scenarioName + "'"
  );
}
