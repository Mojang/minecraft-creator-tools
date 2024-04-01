import { Argument, Command } from "commander";
import Carto from "./../app/Carto.js";
import CartoApp, { HostType } from "./../app/CartoApp.js";

import LocalUtilities from "./../local/LocalUtilities.js";
import * as process from "process";
import NodeStorage from "../local/NodeStorage.js";
import StorageUtilities from "../storage/StorageUtilities.js";
import { constants } from "../core/Constants.js";
import ProjectInfoSet from "../info/ProjectInfoSet.js";
import { InfoItemType } from "../info/IInfoItemData.js";
import LocalEnvironment from "../local/LocalEnvironment.js";
import { ProjectItemStorageType, ProjectItemType } from "../app/IProjectItemData.js";
import MCWorld from "../minecraft/MCWorld.js";
import ProjectItem from "../app/ProjectItem.js";
import Log from "../core/Log.js";
import IProjectMetaState from "./IProjectMetaState.js";
import IProjectStartInfo from "./IProjectStartInfo.js";
import ClUtils, { OutputType, TaskType } from "./ClUtils.js";
import { spawn, Pool, Worker } from "threads";
import ContentIndex from "../core/ContentIndex.js";
import IIndexJson from "../storage/IIndexJson.js";

if (typeof btoa === "undefined") {
  // @ts-ignore
  global.btoa = function (str: any) {
    return Buffer.from(str, "binary").toString("base64");
  };
}

if (typeof atob === "undefined") {
  // @ts-ignore
  global.atob = function (b64Encoded: any) {
    return Buffer.from(b64Encoded, "base64").toString("binary");
  };
}

CartoApp.hostType = HostType.toolsNodejs;

const MAX_LINES_PER_CSV_FILE = 500000;

const program = new Command();

let carto: Carto | undefined;
const projectStarts: (IProjectStartInfo | undefined)[] = [];
let localEnv: LocalEnvironment | undefined;
let mode: string | undefined;
let suite: string | undefined;
let outputType: OutputType | undefined;
let aggregateReportsAfterValidation: boolean | undefined = false;
let threads: number = 8;

let force = false;
let executionTaskType: TaskType = TaskType.noCommand;

program
  .name("mct")
  .description("Minecraft Creator Tools v" + constants.version)
  .option(
    "-i, --input-folder [path to folder]",
    "Path to the input folder. If not specified, the current working directory is used."
  )
  .option(
    "-if, --input-file [path to file]",
    "Path to the input MCWorld, MCTemplate, MCPack, MCAddon or other zip file."
  )
  .option(
    "-o, --output-folder <path to folder>",
    "Path to the output project folder. If not specified, the current working directory + 'out' is used.",
    "out"
  )
  .option("-of, --output-file [path to file]", "Path to the export file, if applicable for the command you are using.")
  .option("-ot, --output-type [outputtype", "Type of output, if applicable for the command you are using.")
  .option("-f, --force", "Force any updates.")
  .option("--threads [thread count]", "Targeted number of threads to use.")
  .option("-lv, --log-verbose", "Whether to show verbose log messages.");

program.addHelpText("before", "\x1b[32m┌─────┐\x1b[0m");
program.addHelpText("before", "\x1b[32m│ ▄ ▄ │\x1b[0m Minecraft Creator Tools (preview) command line");
program.addHelpText("before", "\x1b[32m│ ┏▀┓ │\x1b[0m See " + constants.homeUrl + " for more info.");
program.addHelpText("before", "\x1b[32m└─────┘\x1b[0m");
program.addHelpText("before", " ");

program
  .command("validate")
  .alias("val")
  .description("Validate the current project.")
  .addArgument(new Argument("[suite]", "Specifies the type of validation suite to run."))
  .addArgument(
    new Argument("[aggregateReports]", "Whether to aggregate reports across projects at the end of the run.")
  )
  .action((suiteIn?: string, aggregateReportsIn?: string) => {
    suite = suiteIn;
    executionTaskType = TaskType.validate;

    if (aggregateReportsIn === "true" || aggregateReportsIn === "1" || aggregateReportsIn === "t") {
      aggregateReportsAfterValidation = true;
    } else {
      aggregateReportsAfterValidation = false;
    }
  });

program
  .command("aggregatereports")
  .alias("aggr")
  .description("Aggregates exported metadata about projects.")
  .action(() => {
    executionTaskType = TaskType.aggregateReports;
  });

program
  .command("version")
  .alias("ver")
  .description("Shows version and general application information")
  .action(() => {
    executionTaskType = TaskType.version;
  });

program.parse(process.argv);

const options = program.opts();

localEnv = new LocalEnvironment(true);

if (options.force) {
  force = true;
}

if (options.threads) {
  try {
    let tc = parseInt(options.threads);

    if (tc > 0) {
      threads = tc;
      console.log("Using " + threads + " threads.");
    }
  } catch (e) {
    Log.error("Could not process the threads parameter: " + e);
  }
}

if (options.outputType) {
  switch (options.outputType.toLowerCase().trim()) {
    case "noreports":
      outputType = OutputType.noReports;
  }
}

if (options.logVerbose) {
  localEnv.displayVerbose = true;
}

(async () => {
  carto = ClUtils.getCarto(localEnv);

  if (!carto) {
    return;
  }

  await carto.load();

  carto.onStatusAdded.subscribe(ClUtils.handleStatusAdded);

  await loadProjects();

  switch (executionTaskType as TaskType) {
    case TaskType.version:
      await displayVersion();
      break;

    case TaskType.validate:
      await validate();
      break;

    case TaskType.aggregateReports:
      await aggregateReports();
      break;
  }
})();

async function loadProjects() {
  if (!carto) {
    throw new Error("Not properly configured.");
  }

  const workFolder = await ClUtils.getMainWorkFolder(executionTaskType, options.inputFolder, options.outputFolder);

  const name = StorageUtilities.getLeafName(workFolder.fullPath);
  let isMultiLevelMultiProject = true;

  let foundASubProject = false;

  // multilevel multi project is a one-level folder hierarchy of subfolders with zip and
  // metadata files in them.

  // root folder must be empty
  // foo\coolgame.zip <--- this is the project
  // foo\coolgame.data.json
  // bar\swellgame.zip <--- this is another project
  // bar\swellgame.data.json

  let storageItemCount = 0;

  if (workFolder.fileCount > 0) {
    for (const subFileName in workFolder.files) {
      const file = workFolder.files[subFileName];
      if (file && !StorageUtilities.isFileStorageItem(file)) {
        isMultiLevelMultiProject = false;
        break;
      }
    }
  }

  if (isMultiLevelMultiProject) {
    for (const subFolderName in workFolder.folders) {
      const subFolder = workFolder.folders[subFolderName];

      if (subFolder) {
        await subFolder.load(false);

        for (const subFileName in subFolder.files) {
          const subFile = subFolder.files[subFileName];

          if (subFile) {
            if (StorageUtilities.isFileStorageItem(subFile)) {
              storageItemCount++;
            }

            let typeFromName = StorageUtilities.getTypeFromName(subFileName);

            if (
              !StorageUtilities.isFileStorageItem(subFile) &&
              typeFromName !== "json" &&
              typeFromName !== "csv" &&
              typeFromName !== "" &&
              typeFromName !== "html"
            ) {
              isMultiLevelMultiProject = false;
              continue;
            }
          }
        }
      }
    }
  }

  if (storageItemCount < 2) {
    isMultiLevelMultiProject = false;
  }

  if (isMultiLevelMultiProject) {
    console.log("Working across subfolders with projects at '" + workFolder.fullPath + "'");

    for (const subFolderName in workFolder.folders) {
      const subFolder = workFolder.folders[subFolderName];

      if (subFolder && !subFolder.errorStatus) {
        await subFolder.load(false);

        for (const fileName in subFolder.files) {
          const file = subFolder.files[fileName];

          if (file && StorageUtilities.isFileStorageItem(file)) {
            const ps: IProjectStartInfo = { ctorProjectName: file.name };

            let baseName = StorageUtilities.getBaseFromName(file.name);

            if (subFolder.files[baseName + ".data.json"]) {
              ps.accessoryFiles = [baseName + ".data.json"];
            }

            let lastDash = baseName.lastIndexOf("-");

            if (lastDash > 0) {
              baseName = baseName.substring(0, lastDash);

              if (subFolder.files[baseName + ".data.json"]) {
                ps.accessoryFiles = [baseName + ".data.json"];
              }
            }

            ps.localFilePath = file.fullPath;

            projectStarts.push(ps);
          }
        }
      }
    }

    if (projectStarts.length > 0) {
      return;
    }
  } else {
    // "children of folder multi project" scans for either zip files in the root folder and/or
    // every subfolder is a separate project

    let isChildrenOfFolderMultiProject = true;

    for (const fileName in workFolder.files) {
      const file = workFolder.files[fileName];

      if (file) {
        if (!StorageUtilities.isFileStorageItem(file)) {
          isChildrenOfFolderMultiProject = false;
          continue;
        } else {
          foundASubProject = true;
        }
      }
    }

    if (isChildrenOfFolderMultiProject) {
      for (const folderName in workFolder.folders) {
        const folder = workFolder.folders[folderName];

        if (folder && !folder.errorStatus) {
          await folder.load(true);

          if (
            folder.files["manifest.json"] ||
            folder.files["pack_manifest.json"] ||
            folder.folders["content"] ||
            folder.folders["Content"] ||
            folder.folders["world_template"] ||
            folder.folders["behavior_packs"]
          ) {
            foundASubProject = true;
          }

          if (StorageUtilities.isMinecraftInternalFolder(folder)) {
            isChildrenOfFolderMultiProject = false;
            continue;
          }
        }
      }
    }

    if (!foundASubProject) {
      isChildrenOfFolderMultiProject = false;
    }

    if (isChildrenOfFolderMultiProject) {
      console.log("Working across subfolders/packages at '" + workFolder.fullPath + "'");

      for (const fileName in workFolder.files) {
        const file = workFolder.files[fileName];

        if (file && StorageUtilities.isFileStorageItem(file)) {
          const mainProject: IProjectStartInfo = { ctorProjectName: file.name };

          mainProject.localFilePath = file.fullPath;

          projectStarts.push(mainProject);
        }
      }

      for (const folderName in workFolder.folders) {
        const folder = workFolder.folders[folderName];

        if (folder && !folder.errorStatus && folder.name !== "out") {
          await folder.load(false);

          if (folder.folderCount > 0) {
            const mainProject: IProjectStartInfo = { ctorProjectName: folder.name };

            mainProject.localFolderPath = folder.fullPath;

            projectStarts.push(mainProject);
          }
        }
      }

      if (projectStarts.length > 0) {
        return;
      }
    }
  }

  // OK, just assume this folder is a big single project then.
  const mainProject: IProjectStartInfo = { ctorProjectName: name };

  mainProject.localFolderPath = workFolder.fullPath;

  projectStarts.push(mainProject);
}

async function displayVersion() {
  console.log("\n" + constants.name + " Tools");
  console.log("Version: " + constants.version);

  if (carto && carto.local) {
    const local = carto.local as LocalUtilities;
    console.log("\n");
    console.log("Machine user data path: " + local.userDataPath);
    console.log("Machine app data path: " + local.localAppDataPath);
    console.log("Minecraft path: " + local.minecraftPath);
    console.log("Server working path: " + local.serversPath);
    console.log("Environment prefs path: " + local.envPrefsPath);
  }

  console.log("\n");
  console.log(constants.copyright);
  console.log(constants.disclaimer);
  console.log("\n");
}

async function displayInfo() {
  for (const projectStart of projectStarts) {
    if (projectStart && carto) {
      const project = ClUtils.createProject(carto, projectStart);
      await project.inferProjectItemsFromFiles();

      console.log("Project name: " + project.name);
      console.log("Project description: " + project.description);

      const bpFolder = await project.getDefaultBehaviorPackFolder();

      if (bpFolder === null) {
        console.log("No default behavior pack.");
      } else {
        console.log("Default behavior pack folder: " + bpFolder.storageRelativePath);
      }

      const rpFolder = await project.getDefaultResourcePackFolder();

      if (rpFolder === null) {
        console.log("No default resource pack.");
      } else {
        console.log("Default resource pack folder: " + rpFolder.storageRelativePath);
      }

      for (let i = 0; i < project.items.length; i++) {
        const item = project.items[i];

        console.log("=== " + item.typeTitle + ": " + item.storagePath);

        if (item.isWorld) {
          await setAndDisplayWorld(item, false);
        }
      }

      const pis = project.infoSet;

      await pis.generateForProject();

      for (let i = 0; i < pis.items.length; i++) {
        const item = pis.items[i];

        if (item.itemType !== InfoItemType.testCompleteFail && item.itemType !== InfoItemType.testCompleteSuccess) {
          console.log(pis.itemToString(item));
        }
      }
    }
  }
}

async function setAndDisplayAllWorlds() {
  const isEnsure = mode === "set";
  let ofName: string | undefined;

  if (options.outputFolder) {
    ofName = StorageUtilities.getLeafName(options.outputFolder);

    if (ofName) {
      ofName = StorageUtilities.canonicalizeName(ofName);
    }
  }

  for (const projectStart of projectStarts) {
    if (projectStart && carto) {
      const project = ClUtils.createProject(carto, projectStart);

      let setWorld = false;

      for (const item of project.items) {
        if (item.isWorld) {
          let shouldProcess = true;

          if (item.storagePath && ofName) {
            const name = StorageUtilities.canonicalizeName(
              StorageUtilities.getBaseFromName(StorageUtilities.getLeafName(item.storagePath))
            );

            shouldProcess = ofName === name;
          }

          if (shouldProcess) {
            await setAndDisplayWorld(item, isEnsure);
            setWorld = true;
          }
        }
      }

      // create a new world
      if (isEnsure && !setWorld && options.outputFolder) {
        const wcf = await project.ensureWorldContainer();

        if (wcf && project.projectFolder) {
          // create a new folder for the world.
          let destF = project.projectFolder;
          const targetName = destF.name;

          // if only an output folder is specified, put the world there
          // if an input and an output folder is specified, put the world at a subfolder of the input folder.
          if (options.inputFolder) {
            destF = await wcf.ensureFolderFromRelativePath(StorageUtilities.ensureEndsDelimited(options.outputFolder));
          }

          if (destF) {
            let path = destF.getFolderRelativePath(project.projectFolder);

            if (path) {
              path = StorageUtilities.ensureEndsWithDelimiter(StorageUtilities.absolutize(path));

              const pi = project.ensureItemByStoragePath(
                path,
                ProjectItemStorageType.folder,
                targetName,
                ProjectItemType.worldFolder
              );

              await pi.ensureFolderStorage();

              await setAndDisplayWorld(pi, true);
            }
          }
        }
      }
    }
  }
}

async function setAndDisplayWorld(item: ProjectItem, isSettable: boolean) {
  if (item.isWorld) {
    const mcworld: MCWorld | undefined = await item.getManager();

    if (mcworld) {
      await mcworld.load(false);

      if (isSettable) {
        if (mcworld.name === "" && mcworld.storageFullPath) {
          mcworld.name = StorageUtilities.getBaseFromName(StorageUtilities.getLeafName(mcworld.storageFullPath));
        }

        console.log("Updating mcworld at '" + mcworld.storageFullPath + "'");
        const levelDat = mcworld.ensureLevelData();
        let hasSet = false;

        if (options.betaApis !== undefined && options.betaApis !== levelDat.betaApisExperiment) {
          levelDat.betaApisExperiment = options.betaApis;
          console.log("Set beta APIs to " + options.betaApis);
          hasSet = true;
        }

        if (options.editor !== undefined && options.editor !== levelDat.isCreatedInEditor) {
          levelDat.isCreatedInEditor = options.editor;
          console.log("Set is editor to " + options.editor);
          hasSet = true;
        }

        if (options.dataDrivenItems !== undefined && options.dataDrivenItems !== levelDat.dataDrivenItemsExperiment) {
          levelDat.dataDrivenItemsExperiment = options.dataDrivenItems;
          console.log("Set data driven items to " + options.dataDrivenItems);
          hasSet = true;
        }

        if (options.behaviorPack !== undefined) {
          mcworld.ensureBehaviorPacksFromString(options.behaviorPack);
        }

        if (options.resourcePack !== undefined) {
          mcworld.ensureBehaviorPacksFromString(options.resourcePack);
        }

        if (hasSet) {
          await mcworld.save();
        }
      }

      console.log("World name: " + mcworld.name);
      console.log("World path: " + item.storagePath);

      if (mcworld.betaApisExperiment !== undefined) {
        console.log("Beta APIs: " + mcworld.betaApisExperiment);
      }

      if (mcworld.levelData) {
        if (mcworld.levelData.dataDrivenItemsExperiment !== undefined) {
          console.log("Data Driven items (holiday experimental): " + mcworld.levelData.dataDrivenItemsExperiment);
        }
      }
    }
  }
}

async function validate() {
  if (!carto || !localEnv) {
    return;
  }

  const projectList: IProjectMetaState[] = [];
  const pool = Pool(
    () =>
      spawn(new Worker("./TaskWorker"), {
        timeout: 25000,
      }),
    threads
  );

  const suiteConst = suite;
  const aggregateReportsAfterValidationConst = aggregateReportsAfterValidation;
  const localEnvConst = localEnv;

  for (let i = 0; i < projectStarts.length; i++) {
    const ps = projectStarts[i];

    pool.queue(async (doTask) => {
      const result = await doTask({
        task: TaskType.validate,
        project: ps,
        arguments: {
          suite: suiteConst,
          outputMci: aggregateReportsAfterValidationConst || outputType === OutputType.noReports ? "true" : "false",
          outputType: outputType,
        },
        outputFolder: options.outputFolder,
        inputFolder: options.inputFolder,
        displayInfo: !options.inputFolder,
        displayVerbose: localEnvConst.displayVerbose,
        force: force,
      });

      if (result !== undefined) {
        if (typeof result === "string") {
          if (ps) {
            Log.error(ps.ctorProjectName + " error: " + result);
          }
        } else {
          // clear out icons since the aggregation won't need them, and it should save memory.
          if (result.infoSetData && result.infoSetData.info && result.infoSetData.info["defaultIcon"]) {
            result.infoSetData.info["defaultIcon"] = undefined;
          }

          projectList.push(result as IProjectMetaState);
        }
      }
    });
  }

  await pool.settled();
  await pool.terminate();

  if (aggregateReportsAfterValidation) {
    Log.message("Aggregating reports across " + projectList.length + " projects.");
    await saveAggregatedReports(projectList);
  }
}

async function aggregateReports() {
  let inpFolder = await ClUtils.getMainWorkFolder(executionTaskType, options.inputFolder, options.outputFolder);

  const allFeatureSets: { [setName: string]: { [measureName: string]: number | undefined } | undefined } = {};
  const allFields: { [featureName: string]: boolean | undefined } = {};

  const projectList: IProjectMetaState[] = [];

  if (!inpFolder) {
    Log.message("No main input folder was specified.");
  }

  await inpFolder.load(false);
  let projectsLoaded = 0;
  for (const fileName in inpFolder.files) {
    let file = inpFolder.files[fileName];

    if (file && StorageUtilities.getTypeFromName(fileName) === "json") {
      await file.loadContent(true);

      let jsonO = await StorageUtilities.getJsonObject(file);

      if (jsonO.info && jsonO.items && jsonO.generatorName !== undefined && jsonO.generatorVersion !== undefined) {
        const pis = new ProjectInfoSet(undefined, undefined, undefined, jsonO.info, jsonO.items);

        let baseName = StorageUtilities.getBaseFromName(fileName);

        if (baseName.endsWith(".mcr")) {
          baseName = baseName.substring(0, baseName.length - 4);
        }

        let title = StorageUtilities.getBaseFromName(fileName);

        let firstDash = title.indexOf("-");
        let lastDash = title.lastIndexOf("-");

        if (firstDash > 0 && lastDash > firstDash + 1) {
          title = title.substring(firstDash + 1, lastDash);
        }

        if (projectsLoaded > 0 && projectsLoaded % 500 === 0) {
          console.warn("Loaded " + projectsLoaded + " reports, @ " + title);
        }

        pis.mergeFeatureSetsAndFieldsTo(allFeatureSets, allFields);

        // clear out icons since the aggregation won't need them, and it should save memory.
        if (jsonO.info && jsonO.info["defaultIcon"]) {
          jsonO.info["defaultIcon"] = undefined;
        }

        projectList.push({
          projectContainerName: baseName,
          projectPath: file.parentFolder.storageRelativePath,
          projectName: baseName,
          projectTitle: title,
          infoSetData: jsonO,
        });

        projectsLoaded++;
      }
    }
  }

  if (projectList.length > 0) {
    await saveAggregatedReports(projectList);
  } else {
    Log.message("Did not find any report JSON files.");
  }
}

async function saveAggregatedReports(projectList: IProjectMetaState[]) {
  let outputStorage: NodeStorage | undefined;
  const csvHeader = ProjectInfoSet.CommonCsvHeader;

  let samplePis: ProjectInfoSet | undefined;
  const allFeatureSets: { [setName: string]: { [measureName: string]: number | undefined } | undefined } = {};
  const allFields: { [featureName: string]: boolean | undefined } = {};

  const allIssueLines: string[] = [];
  const allSummaryLines: string[] = [];
  const mciFileList: IIndexJson = { files: [], folders: [] };
  const megaContentIndex: ContentIndex = new ContentIndex();
  const measures: { [featureSetName: string]: { name: string; items: { [featureName: string]: any } } } = {};
  const dataMeasures: { [featureSetName: string]: { name: string; items: { [featureName: string]: any } } } = {};

  if (options.outputFolder) {
    outputStorage = new NodeStorage(options.outputFolder, "");
  }

  let projectsConsidered = 0;
  for (const projectSet of projectList) {
    const pisData = projectSet.infoSetData;

    const contentIndex = new ContentIndex();

    if (pisData.index) {
      contentIndex.loadFromData(pisData.index);
    }

    const pis = new ProjectInfoSet(undefined, undefined, undefined, pisData.info, pisData.items, contentIndex);

    const projectBaseName = StorageUtilities.removeContainerExtension(projectSet.projectContainerName);

    if (pis.contentIndex) {
      megaContentIndex.mergeFrom(pis.contentIndex, projectBaseName);
    }

    if (projectSet.projectName) {
      mciFileList.files.push(projectBaseName.toLowerCase() + ".mci.json");
    }

    if (projectsConsidered > 0 && projectsConsidered % 500 === 0) {
      console.warn("Processed " + projectsConsidered + " reports, @ " + projectBaseName);
    }

    pis.mergeFeatureSetsAndFieldsTo(allFeatureSets, allFields);
    projectsConsidered++;
  }

  for (const featureSetName in allFeatureSets) {
    const featureSet = allFeatureSets[featureSetName];

    if (featureSet) {
      measures[featureSetName] = {
        name: featureSetName,
        items: {},
      };
    }
  }

  for (const projectSet of projectList) {
    const pisData = projectSet.infoSetData;
    const pis = new ProjectInfoSet(undefined, undefined, undefined, pisData.info, pisData.items);
    const projectBaseName = StorageUtilities.removeContainerExtension(projectSet.projectContainerName);

    pis.mergeFeatureSetsAndFieldsTo(allFeatureSets, allFields);

    samplePis = pis;

    if (projectSet.infoSetData.info) {
      for (const memberName in projectSet.infoSetData.info) {
        if (ProjectInfoSet.isAggregableFieldName(memberName)) {
          let data: { name: string; items: { [featureName: string]: any } } = dataMeasures[memberName];

          if (data === undefined) {
            data = { name: memberName, items: {} };
            dataMeasures[memberName] = data;
          }

          if ((projectSet.infoSetData.info as any)[memberName] !== undefined) {
            data.items[projectBaseName] = (projectSet.infoSetData.info as any)[memberName];
          }
        }
      }
    }

    if (projectSet.infoSetData.info.featureSets) {
      for (const featureSetName in allFeatureSets) {
        const featureSet = projectSet.infoSetData.info.featureSets[featureSetName];

        if (featureSet) {
          measures[featureSetName].items[projectBaseName] = featureSet;
        }
      }
    }

    if (allIssueLines.length <= MAX_LINES_PER_CSV_FILE) {
      const pisLines = pis.getItemCsvLines();

      for (let j = 0; j < pisLines.length; j++) {
        allIssueLines.push('"' + projectBaseName + '",' + pisLines[j]);
      }
    }

    if (outputStorage) {
      allSummaryLines.push(pis.getSummaryCsvLine(projectBaseName, projectSet.projectTitle, allFeatureSets));
    }
  }

  if (outputStorage && samplePis) {
    if (allIssueLines.length < MAX_LINES_PER_CSV_FILE) {
      let allCsvFile = outputStorage.rootFolder.ensureFile("all.csv");

      let allCsvContent = "Project," + csvHeader + "\r\n" + allIssueLines.join("\n");

      allCsvFile.setContent(allCsvContent);

      await allCsvFile.saveContent();
    }

    const projectsCsvFile = outputStorage.rootFolder.ensureFile("projects.csv");

    let projectsCsvContent = ProjectInfoSet.getSummaryCsvHeaderLine(samplePis.info, allFeatureSets);

    projectsCsvContent += "\r\n" + allSummaryLines.join("\n");

    projectsCsvFile.setContent(projectsCsvContent);

    await projectsCsvFile.saveContent();
  }
}
