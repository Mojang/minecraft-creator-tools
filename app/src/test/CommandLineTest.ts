import { assert } from "chai";
import CreatorTools from "../app/CreatorTools";
import Project, { ProjectAutoDeploymentMode } from "../app/Project";
import CreatorToolsHost, { HostType } from "../app/CreatorToolsHost";
import NodeStorage from "../local/NodeStorage";
import Database from "../minecraft/Database";
import LocalEnvironment from "../local/LocalEnvironment";
import IFolder from "../storage/IFolder";
import StorageUtilities from "../storage/StorageUtilities";
import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import { chunksToLinesAsync } from "@rauschma/stringio";
import { Readable } from "stream";
import * as fs from "fs";
import Utilities from "../core/Utilities";
import { volatileFileExtensions, ensureReportJsonMatchesScenario, folderMatches } from "./TestUtilities";
import axios, { AxiosResponse } from "axios";
import IFile from "../storage/IFile";
import ProjectInfoSet from "../info/ProjectInfoSet";
import { ProjectInfoSuite } from "../info/IProjectInfoData";
import ProjectUtilities from "../app/ProjectUtilities";

CreatorToolsHost.hostType = HostType.testLocal;

let creatorTools: CreatorTools | undefined = undefined;
let localEnv: LocalEnvironment | undefined = undefined;

let scenariosFolder: IFolder | undefined = undefined;
let resultsFolder: IFolder | undefined = undefined;
let sampleFolder: IFolder | undefined = undefined;

localEnv = new LocalEnvironment(false);

(async () => {
  CreatorToolsHost.localFolderExists = _localFolderExists;
  CreatorToolsHost.ensureLocalFolder = _ensureLocalFolder;

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

  CreatorToolsHost.deploymentStorage = new NodeStorage(
    localEnv.utilities.testWorkingPath + "deployment" + NodeStorage.platformFolderDelimiter,
    ""
  );
  CreatorToolsHost.workingStorage = new NodeStorage(
    localEnv.utilities.testWorkingPath + "working" + NodeStorage.platformFolderDelimiter,
    ""
  );

  const coreStorage = new NodeStorage(__dirname + "/../../public/data/content/", "");
  Database.contentFolder = coreStorage.rootFolder;

  await CreatorToolsHost.init(); // carto app init does something here that, if removed, causes these tests to fail. Also, await needs to be here.

  creatorTools = CreatorToolsHost.creatorTools;

  if (!creatorTools) {
    return;
  }

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
    await folderMatches(scenariosFolder, resultsFolder, "worldCommand", volatileFileExtensions);
  });
});

describe("serveCommandValidate", async () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];
  let process: ChildProcessWithoutNullStreams | null = null;

  before(function (done) {
    this.timeout(20000);

    removeResultFolder("serveCommandValidate");
    const passcode = Utilities.createUuid().substring(0, 8);

    if (!sampleFolder) {
      throw new Error("Sample folder does not exist.");
    }

    sampleFolder
      .ensureFileFromRelativePath("/addon/build/packages/aop_moremobs_animationmanifesterrors.zip")
      .then((sampleFile: IFile) => {
        console.log("Starting web server.");

        process = spawn("node", [
          " ./../toolbuild/jsn/cli",
          "serve",
          "basicwebservices",
          "localhost",
          "6126",
          "-lv",
          "-once",
          "-updatepc",
          passcode,
        ]);

        collectLines(process.stdout, stdoutLines);
        collectLines(process.stderr, stderrLines);

        sampleFile.loadContent().then(() => {
          const content = sampleFile.content;

          Utilities.sleep(3000).then(() => {
            console.log(
              "Making validation web request to http://localhost:6126/api/validate/ " + content?.length + " bytes"
            );

            axios
              .post("http://localhost:6126/api/validate/", content, {
                headers: { mctpc: passcode, "content-type": "application/zip" },
                method: "POST",
              })
              .then((response: AxiosResponse) => {
                ensureReportJsonMatchesScenario(scenariosFolder, resultsFolder, response.data, "serveCommandValidate");

                if (response === undefined) {
                  throw new Error("Could not connect to server.");
                }

                if (process) {
                  process.on("exit", (code) => {
                    exitCode = code;
                    process = null;
                    done();
                  });
                }
              });
          });
        });
      });
  });

  it("should have no stderr lines", async () => {
    if (process) {
      process.kill();
      process = null;
    }
    assert.equal(stderrLines.length, 0, "Error: " + stderrLines.join("\n") + "|");
  }).timeout(10000);

  it("exit code should be zero", async () => {
    if (process) {
      process.kill();
      process = null;
    }
    assert.equal(exitCode, 0);
  }).timeout(10000);

  it("output matches", async () => {
    await folderMatches(scenariosFolder, resultsFolder, "serveCommandValidate", volatileFileExtensions);
  });

  after(function () {
    if (process) {
      console.log("Ending web process in serverCommandValidate after function.");
      process.kill();
      process = null;
    }
  });
});

describe("serveCommandValidateAddon", async () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];
  let process: ChildProcessWithoutNullStreams | null = null;

  before(function (done) {
    this.timeout(20000);

    removeResultFolder("serveCommandValidateAddon");
    const passcode = Utilities.createUuid().substring(0, 8);

    if (!sampleFolder) {
      throw new Error("Sample folder does not exist.");
    }

    sampleFolder
      .ensureFileFromRelativePath("/addon/build/packages/aop_moremobs_animationmanifesterrors.zip")
      .then((sampleFile: IFile) => {
        console.log("Starting web server.");

        process = spawn("node", [
          " ./../toolbuild/jsn/cli",
          "serve",
          "basicwebservices",
          "localhost",
          "6126",
          "-lv",
          "-once",
          "-updatepc",
          passcode,
        ]);

        collectLines(process.stdout, stdoutLines);
        collectLines(process.stderr, stderrLines);

        sampleFile.loadContent().then(() => {
          const content = sampleFile.content;

          Utilities.sleep(3000).then(() => {
            console.log(
              "Making validation web request to http://localhost:6126/api/validate/ " + content?.length + " bytes"
            );

            axios
              .post("http://localhost:6126/api/validate/", content, {
                headers: { mctpc: passcode, "content-type": "application/zip", mctsuite: "addon" },
                method: "POST",
              })
              .then((response: AxiosResponse) => {
                ensureReportJsonMatchesScenario(
                  scenariosFolder,
                  resultsFolder,
                  response.data,
                  "serveCommandValidateAddon"
                );

                if (response === undefined) {
                  throw new Error("Could not connect to server.");
                }

                if (process) {
                  process.on("exit", (code) => {
                    exitCode = code;
                    process = null;
                    done();
                  });
                }
              });
          });
        });
      });
  });

  it("should have no stderr lines", async () => {
    if (process) {
      process.kill();
      process = null;
    }
    assert.equal(stderrLines.length, 0, "Error: " + stderrLines.join("\n") + "|");
  }).timeout(10000);

  it("exit code should be zero", async () => {
    if (process) {
      process.kill();
      process = null;
    }
    assert.equal(exitCode, 0);
  }).timeout(10000);

  it("output matches", async () => {
    await folderMatches(scenariosFolder, resultsFolder, "serveCommandValidateAddon", volatileFileExtensions);
  });

  after(function () {
    if (process) {
      console.log("Ending web process in serverCommandValidateAddon after function.");
      process.kill();
      process = null;
    }
  });
});

describe("serveCommandValidateWorld", async () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];
  let process: ChildProcessWithoutNullStreams | null = null;

  before(function (done) {
    this.timeout(20000);

    removeResultFolder("serveCommandValidateWorld");
    const passcode = Utilities.createUuid().substring(0, 8);

    if (!sampleFolder) {
      throw new Error("Sample folder does not exist.");
    }

    sampleFolder
      .ensureFileFromRelativePath("/world/build/packages/aop_moremobs_linkerrors.zip")
      .then((sampleFile: IFile) => {
        console.log("Starting web server.");

        process = spawn("node", [
          " ./../toolbuild/jsn/cli",
          "serve",
          "basicwebservices",
          "localhost",
          "6126",
          "-lv",
          "-once",
          "-updatepc",
          passcode,
        ]);

        collectLines(process.stdout, stdoutLines);
        collectLines(process.stderr, stderrLines);

        sampleFile.loadContent().then(() => {
          const content = sampleFile.content;

          Utilities.sleep(3000).then(() => {
            console.log(
              "Making validation web request to http://localhost:6126/api/validate/ " + content?.length + " bytes"
            );

            axios
              .post("http://localhost:6126/api/validate/", content, {
                headers: { mctpc: passcode, "content-type": "application/zip" },
                method: "POST",
              })
              .then((response: AxiosResponse) => {
                ensureReportJsonMatchesScenario(
                  scenariosFolder,
                  resultsFolder,
                  response.data,
                  "serveCommandValidateWorld"
                );

                if (response === undefined) {
                  throw new Error("Could not connect to server.");
                }

                if (process) {
                  process.on("exit", (code) => {
                    exitCode = code;
                    process = null;
                    done();
                  });
                }
              });
          });
        });
      });
  });

  it("should have no stderr lines", async () => {
    if (process) {
      process.kill();
      process = null;
    }
    assert.equal(stderrLines.length, 0, "Error: " + stderrLines.join("\n") + "|");
  }).timeout(10000);

  it("exit code should be zero", async () => {
    if (process) {
      process.kill();
      process = null;
    }
    assert.equal(exitCode, 0);
  }).timeout(10000);

  it("output matches", async () => {
    await folderMatches(scenariosFolder, resultsFolder, "serveCommandValidateWorld", volatileFileExtensions);
  });

  after(function () {
    if (process) {
      console.log("Ending web process in serverCommandValidateWorld after function.");
      process.kill();
      process = null;
    }
  });
});

describe("serveCommandValidateMashup", async () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];
  let process: ChildProcessWithoutNullStreams | null = null;

  before(function (done) {
    this.timeout(20000);

    removeResultFolder("serveCommandValidateMashup");
    const passcode = Utilities.createUuid().substring(0, 8);

    if (!sampleFolder) {
      throw new Error("Sample folder does not exist.");
    }

    sampleFolder
      .ensureFileFromRelativePath("/world/build/packages/aop_moremobs_mashup.zip")
      .then((sampleFile: IFile) => {
        console.log("Starting web server.");

        process = spawn("node", [
          " ./../toolbuild/jsn/cli",
          "serve",
          "basicwebservices",
          "localhost",
          "6126",
          "-lv",
          "-once",
          "-updatepc",
          passcode,
        ]);

        collectLines(process.stdout, stdoutLines);
        collectLines(process.stderr, stderrLines);

        sampleFile.loadContent().then(() => {
          const content = sampleFile.content;

          Utilities.sleep(3000).then(() => {
            console.log(
              "Making validation web request to http://localhost:6126/api/validate/ " + content?.length + " bytes"
            );

            axios
              .post("http://localhost:6126/api/validate/", content, {
                headers: { mctpc: passcode, "content-type": "application/zip" },
                method: "POST",
              })
              .then((response: AxiosResponse) => {
                ensureReportJsonMatchesScenario(
                  scenariosFolder,
                  resultsFolder,
                  response.data,
                  "serveCommandValidateMashup"
                );

                if (response === undefined) {
                  throw new Error("Could not connect to server.");
                }

                if (process) {
                  process.on("exit", (code) => {
                    exitCode = code;
                    process = null;
                    done();
                  });
                }
              });
          });
        });
      });
  });

  it("should have no stderr lines", async () => {
    if (process) {
      process.kill();
      process = null;
    }
    assert.equal(stderrLines.length, 0, "Error: " + stderrLines.join("\n") + "|");
  }).timeout(10000);

  it("exit code should be zero", async () => {
    if (process) {
      process.kill();
      process = null;
    }
    assert.equal(exitCode, 0);
  }).timeout(10000);

  it("output matches", async () => {
    await folderMatches(scenariosFolder, resultsFolder, "serveCommandValidateMashup", volatileFileExtensions);
  });

  after(function () {
    if (process) {
      console.log("Ending web process in serverCommandValidateMashup after function.");
      process.kill();
      process = null;
    }
  });
});

describe("serveCommandValidateAdvanced", () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];
  let process: ChildProcessWithoutNullStreams | null = null;

  before(function (done) {
    this.timeout(20000);

    removeResultFolder("serveCommandValidateAdvanced");
    const passcode = Utilities.createUuid().substring(0, 8);

    if (!sampleFolder) {
      throw new Error("Sample folder does not exist.");
    }

    sampleFolder
      .ensureFileFromRelativePath("/addon/build/packages/aop_moremobs_advanced.zip")
      .then((sampleFile: IFile) => {
        console.log("Starting web server.");

        process = spawn("node", [
          " ./../toolbuild/jsn/cli",
          "serve",
          "basicwebservices",
          "localhost",
          "6126",
          "-lv",
          "-once",
          "-updatepc",
          passcode,
        ]);

        collectLines(process.stdout, stdoutLines);
        collectLines(process.stderr, stderrLines);

        sampleFile.loadContent().then(() => {
          const content = sampleFile.content;

          Utilities.sleep(3000).then(() => {
            console.log(
              "Making validation web request to http://localhost:6126/api/validate/ " + content?.length + " bytes"
            );

            axios
              .post("http://localhost:6126/api/validate/", content, {
                headers: { mctpc: passcode, "content-type": "application/zip", mctsuite: "all" },
                method: "POST",
              })
              .then((response: AxiosResponse) => {
                ensureReportJsonMatchesScenario(
                  scenariosFolder,
                  resultsFolder,
                  response.data,
                  "serveCommandValidateAdvanced"
                );

                if (response === undefined) {
                  throw new Error("Could not connect to server.");
                }

                if (process) {
                  process.on("exit", (code) => {
                    exitCode = code;
                    process = null;
                    done();
                  });
                }
              });
          });
        });
      });
  });

  it("should have no stderr lines", () => {
    if (process) {
      process.kill();
      process = null;
    }
    assert.equal(stderrLines.length, 0, "Error: " + stderrLines.join("\n") + "|");
  }).timeout(10000);

  it("exit code should be zero", () => {
    if (process) {
      process.kill();
      process = null;
    }
    assert.equal(exitCode, 0);
  }).timeout(10000);

  it("output matches", async () => {
    await folderMatches(scenariosFolder, resultsFolder, "serveCommandValidateAdvanced", volatileFileExtensions);
  });

  after(function () {
    if (process) {
      console.log("Ending web process in serverCommandValidateAdvanced after function.");
      process.kill();
      process = null;
    }
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
      "-internalOnlyRunningInTheContextOfTestCommandLines",
      "yes",
    ]);

    collectLines(process.stdout, stdoutLines);
    collectLines(process.stderr, stderrLines);

    process.on("exit", (code) => {
      exitCode = code;

      assert(creatorTools, "CreatorTools is not properly initialized");

      project = new Project(creatorTools, "createCommandAddonStarter", null);

      // exclude eslint because we know the .ts comes with some warnings due to
      // the starter TS having some unused variables.
      allProjectInfoSet = new ProjectInfoSet(project, ProjectInfoSuite.defaultInDevelopment);

      addonProjectInfoSet = new ProjectInfoSet(project, ProjectInfoSuite.cooperativeAddOn);

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

  //TODO:
  // These tests fail because the create scripts don't create lang files
  // A seperate task should be added to update the logic of the creation script

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

describe("addLootTable", async () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];
  let project: Project | null = null;
  let allProjectInfoSet: ProjectInfoSet | null = null;

  before(function (done) {
    this.timeout(10000);

    removeResultFolder("addLootTable");

    const process = spawn("node", [
      " ./../toolbuild/jsn/cli",
      "add",
      "loot_table",
      "testerName",
      "-o",
      "./test/results/addLootTable/",
      "-internalOnlyRunningInTheContextOfTestCommandLines",
      "yes",
    ]);

    collectLines(process.stdout, stdoutLines);
    collectLines(process.stderr, stderrLines);

    process.on("exit", (code) => {
      exitCode = code;

      assert(creatorTools, "CreatorTools is not properly initialized");

      project = new Project(creatorTools, "addLootTable", null);

      // exclude eslint because we know the .ts comes with some warnings due to
      // the starter TS having some unused variables.
      allProjectInfoSet = new ProjectInfoSet(project, ProjectInfoSuite.defaultInDevelopment);

      project.autoDeploymentMode = ProjectAutoDeploymentMode.noAutoDeployment;
      project.localFolderPath = __dirname + "/../../test/results/addLootTable/";

      project.inferProjectItemsFromFiles().then(() => {
        assert(project);

        assert(allProjectInfoSet);

        allProjectInfoSet.generateForProject().then(() => {
          done();
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

  it("should have 1 project item", async () => {
    assert(project);
    assert.equal(project.items.length, 1);
  }).timeout(10000);

  it("main validation should have 2 errors (which is expected, no manifest exists)", async () => {
    assert(allProjectInfoSet);
    assert.equal(allProjectInfoSet.errorFailWarnCount, 2, allProjectInfoSet.errorFailWarnString);
  }).timeout(10000);

  it("output matches", async () => {
    await folderMatches(scenariosFolder, resultsFolder, "addLootTable", volatileFileExtensions);
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
    await folderMatches(scenariosFolder, resultsFolder, "validateAddons1WellFormedCommand", volatileFileExtensions);
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
    await folderMatches(
      scenariosFolder,
      resultsFolder,
      "validateAddons2AnimationManifestErrorsCommand",
      volatileFileExtensions
    );
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
    await folderMatches(
      scenariosFolder,
      resultsFolder,
      "validateAddons3ExtraneousStuffUsesMinecraftCommand",
      volatileFileExtensions
    );
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
    await folderMatches(scenariosFolder, resultsFolder, "validateAddons3PlatformVersions", volatileFileExtensions);
  });
});

describe("deployCommand", async () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  before(function (done) {
    this.timeout(10000);

    removeResultFolder("deployCommand");

    const process = spawn("node", [
      " ./../toolbuild/jsn/cli",
      "deploy",
      "folder",
      "-i",
      "./../samplecontent/simple/",
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
    await folderMatches(scenariosFolder, resultsFolder, "deployCommand", volatileFileExtensions);
  });
});

describe("validateLinkErrors", async () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  before(function (done) {
    this.timeout(20000);

    removeResultFolder("validateLinkErrors");

    const process = spawn("node", [
      " ./../toolbuild/jsn/cli",
      "val",
      "all",
      "-i",
      "./../samplecontent/addon/build/content_linkerrors",
      "-o",
      "./test/results/validateLinkErrors/",
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
    await folderMatches(scenariosFolder, resultsFolder, "validateLinkErrors", volatileFileExtensions);
  });
});

describe("validateTextureful", async () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  before(function (done) {
    this.timeout(20000);

    removeResultFolder("validateTextureful");

    const process = spawn("node", [
      " ./../toolbuild/jsn/cli",
      "val",
      "all",
      "-i",
      "./../samplecontent/addon/build/content_textureful",
      "-o",
      "./test/results/validateTextureful/",
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
    await folderMatches(scenariosFolder, resultsFolder, "validateTextureful", volatileFileExtensions);
  });
});

describe("validateTexturefulvv", async () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  before(function (done) {
    this.timeout(20000);

    removeResultFolder("validateTexturefulvv");

    const process = spawn("node", [
      " ./../toolbuild/jsn/cli",
      "val",
      "all",
      "-i",
      "./../samplecontent/addon/build/content_texturefulvv",
      "-o",
      "./test/results/validateTexturefulvv/",
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
    await folderMatches(scenariosFolder, resultsFolder, "validateTexturefulvv", volatileFileExtensions);
  });
});

describe("validateVibrantVisuals", async () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  before(function (done) {
    this.timeout(20000);

    removeResultFolder("validateVibrantVisuals");

    const process = spawn("node", [
      " ./../toolbuild/jsn/cli",
      "val",
      "all",
      "-i",
      "./../samplecontent/addon/build/content_vibrantvisuals",
      "-o",
      "./test/results/validateVibrantVisuals/",
    ]);

    collectLines(process.stdout, stdoutLines);
    collectLines(process.stderr, stderrLines);

    process.on("exit", (code) => {
      exitCode = code;
      done();
    });
  });

  it("should have no stderr lines", (done) => {
    assert.equal(stderrLines.length, 0, "Error: |" + stderrLines.join("\n") + "|");
    done();
  }).timeout(20000);

  it("exit code should be zero", (done) => {
    assert.equal(exitCode, 0);
    done();
  }).timeout(20000);

  it("output matches", async function () {
    await folderMatches(scenariosFolder, resultsFolder, "validateVibrantVisuals", volatileFileExtensions);
  });
});

describe("validateComprehensiveContent", async () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  before(function (done) {
    this.timeout(20000);

    removeResultFolder("validateComprehensiveContent");

    const process = spawn("node", [
      " ./../toolbuild/jsn/cli",
      "val",
      "addon",
      "-i",
      "./../samplecontent/comprehensive",
      "-o",
      "./test/results/validateComprehensiveContent/",
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
    await folderMatches(scenariosFolder, resultsFolder, "validateComprehensiveContent", volatileFileExtensions);
  });
});

describe("validateBehaviorPackOnly", async () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  before(function (done) {
    this.timeout(20000);

    removeResultFolder("validateBehaviorPackOnly");

    const process = spawn("node", [
      " ./../toolbuild/jsn/cli",
      "val",
      "addon",
      "-i",
      "./../samplecontent/behavior_pack_only",
      "-o",
      "./test/results/validateBehaviorPackOnly/",
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
    await folderMatches(scenariosFolder, resultsFolder, "validateBehaviorPackOnly", volatileFileExtensions);
  });
});

describe("validateResourcePackOnly", async () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  before(function (done) {
    this.timeout(20000);

    removeResultFolder("validateResourcePackOnly");

    const process = spawn("node", [
      " ./../toolbuild/jsn/cli",
      "val",
      "addon",
      "-i",
      "./../samplecontent/resource_pack_only",
      "-o",
      "./test/results/validateResourcePackOnly/",
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
    await folderMatches(scenariosFolder, resultsFolder, "validateResourcePackOnly", volatileFileExtensions);
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

describe("spawnRulesDependencyValidate", async () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  before(function (done) {
    this.timeout(10000);

    removeResultFolder("spawnRulesDependency");

    const process = spawn("node", [
      " ./../toolbuild/jsn/cli",
      "validate",
      "-i",
      "./../samplecontent/spawnRulesDependency/",
      "-o",
      "./test/results/spawnRulesDependency/",
    ]);

    collectLines(process.stdout, stdoutLines);
    collectLines(process.stderr, stderrLines);

    process.on("exit", (code) => {
      exitCode = code;
      done();
    });
  });

  it("should have no stderr lines", async () => {
    assert.equal(stderrLines.length, 0);
  });

  it("exit code should be zero", async () => {
    assert.equal(exitCode, 0);
  });
});
