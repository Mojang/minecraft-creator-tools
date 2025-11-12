import { Argument, Command } from "commander";
import CreatorTools from "./../app/CreatorTools.js";
import Project, { FolderContext, ProjectAutoDeploymentMode } from "./../app/Project.js";
import CreatorToolsHost, { HostType } from "./../app/CreatorToolsHost.js";
import Utilities from "./../core/Utilities.js";
import ServerManager, { ServerManagerFeatures } from "../local/ServerManager.js";

import LocalUtilities from "./../local/LocalUtilities.js";
import LocalTools from "../local/LocalTools.js";
import * as process from "process";
import * as inquirer from "inquirer";
import NodeStorage from "../local/NodeStorage.js";
import ProjectExporter from "../app/ProjectExporter.js";
import StorageUtilities from "../storage/StorageUtilities.js";
import { constants } from "../core/Constants.js";
import IGalleryItem, { GalleryItemType } from "../app/IGalleryItem.js";
import ProjectInfoSet from "../info/ProjectInfoSet.js";
import { InfoItemType } from "../info/IInfoItemData.js";
import LocalEnvironment from "../local/LocalEnvironment.js";
import { IPackageReference, IWorldSettings } from "../minecraft/IWorldSettings.js";
import { GameType, Generator } from "../minecraft/WorldLevelDat.js";
import ProjectUtilities from "../app/ProjectUtilities.js";
import { ProjectItemStorageType, ProjectItemType } from "../app/IProjectItemData.js";
import MCWorld from "../minecraft/MCWorld.js";
import ProjectItem from "../app/ProjectItem.js";
import Log from "../core/Log.js";
import IProjectMetaState from "../info/IProjectMetaState.js";
import IProjectStartInfo from "./IProjectStartInfo.js";
import ClUtils, { OutputType, TaskType } from "./ClUtils.js";
import { Worker as NodeWorker } from "worker_threads";
import * as path from "path";
import NodeFolder from "../local/NodeFolder.js";
import ContentIndex from "../core/ContentIndex.js";
import IIndexJson from "../storage/IIndexJson.js";
import { ProjectInfoSuite } from "../info/IProjectInfoData.js";
import MinecraftUtilities from "../minecraft/MinecraftUtilities.js";
import IFolder from "../storage/IFolder.js";
import FormJsonDocumentationGenerator from "../docgen/FormJsonDocumentationGenerator.js";
import FormMarkdownDocumentationGenerator from "../docgen/FormMarkdownDocumentationGenerator.js";
import TableMarkdownDocumentationGenerator from "../docgen/TableMarkdownDocumentationGenerator.js";
import DocJsonMarkdownDocumentationGenerator from "../docgen/DocJsonMarkdownDocumentationGenerator.js";
import FormDefinitionTypeScriptGenerator from "../docgen/FormDefinitionTypeScriptGenerator.js";
import NodeFile from "../local/NodeFile.js";
import ProjectItemCreateManager from "../app/ProjectItemCreateManager.js";
import { executeTask } from "./TaskWorker.js";
import ProfilerWrapper from "./ProfilerWrapper.js";

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

CreatorToolsHost.hostType = HostType.toolsNodejs;

const MAX_LINES_PER_CSV_FILE = 500000;

// const ERROR_INSUFFICIENT_ARGUMENTS = 42;
// const ERROR_BAD_ARGUMENTS = 43;
const ERROR_INIT_ERROR = 44;
const ERROR_VALIDATION_INTERNALPROCESSINGERROR = 53;
const ERROR_VALIDATION_TESTFAIL = 56;
const ERROR_VALIDATION_ERROR = 57;

const program = new Command();

let creatorTools: CreatorTools | undefined;
const projectStarts: (IProjectStartInfo | undefined)[] = [];
let localEnv: LocalEnvironment | undefined;
let mode: string | undefined;
let type: string | undefined;
let newName: string | undefined;
let newDescription: string | undefined;
let propertyValue: string | undefined;
let subCommand: string | undefined;
let template: string | undefined;
let creator: string | undefined;
let serverHostPort: number | undefined;
let suite: string | undefined;
let exclusionList: string | undefined;
let outputType: OutputType | undefined;
let serverFeatures: ServerManagerFeatures | undefined;
let serverTitle: string | undefined;
let serverDomainName: string | undefined;
let serverMessageOfTheDay: string | undefined;

let serverCandidateAdminPasscode: string | undefined;
let serverCandidateDisplayReadOnlyPasscode: string | undefined;
let serverCandidateFullReadOnlyPasscode: string | undefined;
let serverCandidateUpdateStatePasscode: string | undefined;
let serverRunOnce: boolean | undefined;

let aggregateReportsAfterValidation: boolean | undefined = false;
let buildAggregatedIndex: boolean | undefined = true;
let threads: number = 8;
let errorLevel: number | undefined;

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
  .option(
    "-psw, --project-starts-with <starter term>",
    "Only process a project if it starts with the starter term; this can be used to subdivide processing."
  )
  .option(
    "-bp, --base-path <path to folder>",
    "Path, relative to the current working folder, where common data files and folders are found."
  )
  .option("-afs, --additional-files [path to file]", "Comma-separated list of additional files to add to projects.")
  .option("-of, --output-file [path to file]", "Path to the export file, if applicable for the command you are using.")
  .option("-ot, --output-type [output type]", "Type of output, if applicable for the command you are using.")
  .option("-updatepc, --update-passcode [update passcode]", "Sets update passcode.")
  .option(
    "-bp, --behavior-pack <behavior pack uuid>",
    "Adds a set of behavior pack UUIDs as references for any worlds that are updated."
  )
  .option(
    "-rp, --resource-pack <resource pack uuid>",
    "Adds a set of resources pack UUIDs as references for any worlds that are updated."
  )
  .option("-betaapis, --beta-apis", "Ensures that the Beta APIs experiment is set for any worlds that are updated.")
  .option("-no-betaapis, --no-beta-apis", "Removes the Beta APIs experiment if set.")
  .option("-f, --force", "Force any updates.")
  .option(
    "-single, --single",
    "When pointed at at a folder via -i, force that folder to be processed as a single project."
  )
  .option("-editor", "Ensures that the world is an Editor world.")
  .option("-once", "When running as a server, only process one request and then shutdown.", false)
  .option("-no-editor", "Removes that the world is an editor.")
  .option(
    "--threads [thread count]",
    "Targeted number of threads to use. Use 1 for sequential processing, >1 for parallel processing with worker threads."
  )
  .option("-show, --display-only", "Whether to only show messages, vs. output report files.")
  .option("-lv, --log-verbose", "Whether to show verbose log messages.")
  .option(
    "-internalOnlyRunningInTheContextOfTestCommandLines",
    "Do not use. For internal self-testing use only functionality."
  );

program.addHelpText("before", "\x1b[32m┌─────┐\x1b[0m");
program.addHelpText("before", "\x1b[32m│ ▄ ▄ │\x1b[0m Minecraft Creator Tools (preview) command line");
program.addHelpText("before", "\x1b[32m│ ┏▀┓ │\x1b[0m See " + constants.homeUrl + " for more info.");
program.addHelpText("before", "\x1b[32m└─────┘\x1b[0m");
program.addHelpText("before", " ");

program
  .command("set")
  .description("Sets a project property.")
  .addArgument(
    new Argument("[property name]", "Property name to set. Valid values include: " + getProjectPropertyList())
  )
  .addArgument(new Argument("[property value]", "Property value to set."))
  .action((nameIn, valueIn) => {
    subCommand = nameIn;
    propertyValue = valueIn;
    executionTaskType = TaskType.setProjectProperty;
  });

program
  .command("docsupdateformsource")
  .description("Updates sources for documentation.")
  .action(() => {
    executionTaskType = TaskType.docsUpdateFormSource;
  });

program
  .command("docsgenerateformjson")
  .description("Generates finalized form json for consumption.")
  .action(() => {
    executionTaskType = TaskType.docsGenerateFormJson;
  });

program
  .command("docsgeneratemarkdown")
  .description("Generates markdown documentation from form json for consumption.")
  .action(() => {
    executionTaskType = TaskType.docsGenerateMarkdown;
  });

program
  .command("docsgeneratetypes")
  .description("Generates types from form json.")
  .action(() => {
    executionTaskType = TaskType.docsGenerateTypes;
  });

program
  .command("deploy")
  .alias("dp")
  .description("Copies Minecraft files to a destination folder.")
  .addArgument(
    new Argument(
      "<mode>",
      "Determines where to copy Minecraft files to. Use 'mcuwp' for Minecraft Bedrock UWP, 'mcpreview' for Minecraft Bedrock Preview, 'server' for the server path , or use a custom path."
    )
  )
  .action((modeIn) => {
    mode = modeIn;
    executionTaskType = TaskType.deploy;
  });

program
  .command("world")
  .alias("w")
  .description("Displays/sets world settings within a folder.")
  .addArgument(
    new Argument("[mode]", "If set to 'set', will update the world with a set of properties that are specified.")
  )
  .action((modeIn) => {
    mode = modeIn;
    executionTaskType = TaskType.world;
  });

program
  .command("add")
  .alias("a")
  .description("Adds new content into this Minecraft project")
  .addArgument(new Argument("[type]", "Type of item to add"))
  .addArgument(new Argument("[name]", "Desired item namespace/name"))
  .action((typeIn, nameIn) => {
    type = typeIn;
    newName = nameIn;
    executionTaskType = TaskType.add;
  });

program
  .command("create")
  .alias("c")
  .description("Creates a new Minecraft project")
  .addArgument(new Argument("[name]", "Desired project name"))
  .addArgument(new Argument("[template]", "Template name"))
  .addArgument(new Argument("[creator]", "Creator name"))
  .addArgument(new Argument("[description]", "Project description"))
  .action((nameIn, templateIn, creatorIn, descriptionIn) => {
    newName = nameIn;
    template = templateIn;
    creator = creatorIn;
    newDescription = descriptionIn;
    executionTaskType = TaskType.create;
  });

program
  .command("fix")
  .description("Fixes or updates the project with a set of desired fixes")
  .addArgument(
    new Argument("[fix]", "Desired fix name. Options include: " + getSubFunctionCommaSeparatedList().join(", "))
  )
  .action((fixIn) => {
    subCommand = fixIn;
    executionTaskType = TaskType.fix;
  });

program
  .command("minecrafteulaandprivacystatement")
  .alias("eula")
  .description("See the Minecraft End User License Agreement.")
  .action(() => {
    executionTaskType = TaskType.minecraftEulaAndPrivacyStatement;
  });

program
  .command("serve")
  .alias("srv")
  .description("Hosts a web service and site that can manage a dedicated server and/or validation.")
  .addArgument(
    new Argument("[features]", "Specifies a title the Minecraft Http Server on.").choices([
      "all",
      "allwebservices",
      "basicwebservices",
      "dedicatedserver",
    ])
  )
  .addArgument(new Argument("[domain]", "Specifies which URL domain this server is hosted on."))
  .addArgument(new Argument("[host-port]", "Specifies which core port to host the Minecraft Http Server on."))
  .addArgument(new Argument("[title]", "Specifies a title the Minecraft Http Server on."))
  .addArgument(new Argument("[motd]", "Specifies a message of the day for the server."))
  .action(async (features?: string, domain?: string, hostPort?: number, title?: string, motd?: string) => {
    if (features) {
      switch (features.toLowerCase()) {
        case "all":
          serverFeatures = ServerManagerFeatures.all;
          break;
        case "allwebservices":
          serverFeatures = ServerManagerFeatures.allWebServices;
          break;
        case "basicwebservices":
          serverFeatures = ServerManagerFeatures.basicWebServices;
          break;
      }
    }

    serverHostPort = hostPort;
    serverTitle = title;
    serverDomainName = domain;
    serverMessageOfTheDay = motd;

    executionTaskType = TaskType.serve;
  });

program
  .command("setserverprops")
  .alias("setsrv")
  .description("Updates default properties for the Minecraft Http Server.")
  .addArgument(new Argument("[domain]", "Specifies which URL domain this server is hosted on."))
  .addArgument(new Argument("[host-port]", "Specifies which core port to host the Minecraft Http Server on."))
  .addArgument(new Argument("[title]", "Specifies a title the Minecraft Http Server on."))
  .addArgument(new Argument("[motd]", "Specifies a message of the day for the server."))
  .action(async (domain?: string, hostPort?: number, title?: string, motd?: string) => {
    serverHostPort = hostPort;
    serverTitle = title;
    serverDomainName = domain;
    serverMessageOfTheDay = motd;
    executionTaskType = TaskType.setServerProperties;
  });

program
  .command("info")
  .alias("i")
  .description("Displays information about the current project.")
  .action(() => {
    executionTaskType = TaskType.info;
  });

program
  .command("validate")
  .alias("val")
  .description("Validate the current project.")
  .addArgument(
    new Argument("[suite]", "Specifies the type of validation suite to run.")
      .choices(["all", "default", "addon", "currentplatform", "main"])
      .default("main", "main - runs most available validation tests.")
  )
  .addArgument(
    new Argument("[exclusions]", "Specifies a comma-separated list of tests to exclude, e.g., PATHLENGTH,PACKSIZE")
  )
  .addArgument(
    new Argument(
      "[aggregateReports]",
      "Specify 'aggregate' to aggregate reports across projects at the end of the run."
    ).choices(["aggregatenoindex", "aggregate", "true", "false", "1", "0"])
  )
  .action((suiteIn?: string, exclusionListIn?: string, aggregateReportsIn?: string) => {
    suite = suiteIn;
    exclusionList = exclusionListIn;
    executionTaskType = TaskType.validate;

    if (
      aggregateReportsIn === "aggregatenoindex" ||
      aggregateReportsIn === "aggregate" ||
      aggregateReportsIn === "true" ||
      aggregateReportsIn === "1" ||
      aggregateReportsIn === "t"
    ) {
      aggregateReportsAfterValidation = true;

      if (aggregateReportsIn === "aggregatenoindex") {
        buildAggregatedIndex = false;
      }
    } else {
      aggregateReportsAfterValidation = false;
    }
  });

program
  .command("profileValidation")
  .description("Profile validating a single project with default settings")
  .action(() => {
    executionTaskType = TaskType.profileValidation;
  });

program
  .command("aggregatereports")
  .alias("aggr")
  .description("Aggregates exported metadata about projects.")
  .addArgument(new Argument("[buildContentIndex]").choices(["index", "noindex", "true", "false", "1", "0"]))
  .action((buildContentIndexIn?: string) => {
    executionTaskType = TaskType.aggregateReports;
    if (
      buildContentIndexIn === "noindex" ||
      buildContentIndexIn === "false" ||
      buildContentIndexIn === "0" ||
      buildContentIndexIn === "f"
    ) {
      buildAggregatedIndex = false;
    } else {
      buildAggregatedIndex = true;
    }
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

let sm: ServerManager | undefined;

const packageReferenceSets: IPackageReference[] = [];
const templateReferenceSets: IPackageReference[] = [];

if (options.force) {
  force = true;
}

if (options.threads) {
  try {
    let tc = parseInt(options.threads);

    if (tc > 0) {
      threads = tc;
      if (threads === 1) {
        console.log("Using sequential processing (threads=1).");
      } else {
        console.log("Using " + threads + " worker threads.");
      }
    }
  } catch (e) {
    Log.error("Could not process the threads parameter: " + e);
  }
}

if (options.outputType && typeof options.outputType === "string") {
  switch (options.outputType.toLowerCase().trim()) {
    case "noreports":
      outputType = OutputType.noReports;
  }
}

if (options.displayOnly) {
  localEnv.displayInfo = true;

  if (options.outputFolder === "out") {
    options.outputFolder = undefined;
  }
} else if (options.outputFolder === "out") {
  if ((executionTaskType as TaskType) !== TaskType.serve) {
    Log.message(
      "Outputting results to the \x1b[32mout\x1b[0m folder. Use the `-o <foldername>` parameter to select a different path.\r\n"
    );
  }

  localEnv.displayInfo = true;
}

if (options.adminPasscode) {
  serverCandidateAdminPasscode = options.adminPasscode;
}

if (options.updatePasscode) {
  serverCandidateUpdateStatePasscode = options.updatePasscode;
}

if (options.displayPasscode) {
  serverCandidateDisplayReadOnlyPasscode = options.displayPasscode;
}

if (options.once || options.Once) {
  serverRunOnce = true;
}

if (options.fullReadOnlyPasscode) {
  serverCandidateFullReadOnlyPasscode = options.fullReadOnlyPasscode;
}

if (options.logVerbose) {
  localEnv.displayVerbose = true;
}

(async () => {
  creatorTools = ClUtils.getCreatorTools(localEnv, options.basePath);

  if (!creatorTools) {
    return;
  }

  sm = new ServerManager(localEnv, creatorTools);
  sm.runOnce = serverRunOnce;

  await creatorTools.load();

  creatorTools.onStatusAdded.subscribe(ClUtils.handleStatusAdded);

  await loadProjects();

  if (
    serverCandidateDisplayReadOnlyPasscode ||
    serverCandidateUpdateStatePasscode ||
    serverCandidateAdminPasscode ||
    serverCandidateFullReadOnlyPasscode
  ) {
    await setPasscode(
      serverCandidateDisplayReadOnlyPasscode,
      serverCandidateFullReadOnlyPasscode,
      serverCandidateUpdateStatePasscode,
      serverCandidateAdminPasscode
    );
  }

  switch (executionTaskType as TaskType) {
    case TaskType.info:
      await displayInfo();
      break;

    case TaskType.version:
      await displayVersion();
      break;

    case TaskType.validate:
      await validate();
      break;

    case TaskType.aggregateReports:
      await aggregateReports();
      break;

    case TaskType.docsUpdateFormSource:
      await docsUpdateFormSource();
      break;

    case TaskType.docsGenerateFormJson:
      await docsGenerateFormJson();
      break;

    case TaskType.docsGenerateMarkdown:
      await docsGenerateMarkdown();
      break;

    case TaskType.docsGenerateTypes:
      await docsGenerateTypes();
      break;

    case TaskType.serve:
      hookInput();
      await applyServerProps();
      await serve();
      break;

    case TaskType.profileValidation:
      await profileValidation();
      break;

    case TaskType.fix:
      await fix();
      break;

    case TaskType.setProjectProperty:
      if (subCommand && propertyValue) {
        try {
          for (const projectStart of projectStarts) {
            if (projectStart) {
              await setProjectProperty(ClUtils.createProject(creatorTools, projectStart), subCommand, propertyValue);
            }
          }
        } catch (e: any) {
          errorLevel = ERROR_INIT_ERROR;
          console.error("Error adding to a project. " + e.toString());
        }
      }
      break;

    case TaskType.add:
      try {
        for (const projectStart of projectStarts) {
          if (projectStart) {
            await add(ClUtils.createProject(creatorTools, projectStart));
          }
        }
      } catch (e: any) {
        errorLevel = ERROR_INIT_ERROR;
        console.error("Error adding to a project. " + e.toString());
      }
      break;

    case TaskType.create:
      try {
        for (const projectStart of projectStarts) {
          if (projectStart) {
            await create(ClUtils.createProject(creatorTools, projectStart), projectStarts.length <= 1);
          }
        }
      } catch (e: any) {
        errorLevel = ERROR_INIT_ERROR;
        console.error("Error creating a project. " + e.toString());
      }
      break;

    case TaskType.deploy:
      await deploy();

      if (options.ensureWorld) {
        await ensureRefWorld();
      }
      break;

    case TaskType.minecraftEulaAndPrivacyStatement:
      await minecraftEulaAndPrivacyStatement();
      break;

    case TaskType.world:
      await setAndDisplayAllWorlds();
      break;
  }

  if ((executionTaskType as TaskType) !== TaskType.serve) {
    await doExit();
  }
})();

async function fix() {
  if (!creatorTools) {
    throw new Error("Not properly configured.");
  }

  if (!subCommand) {
    throw new Error(
      "No sub-fix was specified. Use the [fix] subcommand to specify a fix. Available commands: " +
        getSubFunctionCommaSeparatedList().join(", ")
    );
  }

  const subCommandCanon = subCommand.toLowerCase().trim();

  for (const projectStart of projectStarts) {
    if (projectStart) {
      const project = ClUtils.createProject(creatorTools, projectStart);
      await project.inferProjectItemsFromFiles();

      switch (subCommandCanon) {
        case "latestbetascriptversion":
          break;
        case "usepackageversionscript":
          break;
        case "usemanifestversionscript":
          break;
        case "randomizealluids":
          await ProjectUtilities.randomizeAllUids(project);
          break;
        case "setnewestformatversions":
          break;
        case "setnewestminengineversion":
          break;
      }
    }
  }
}

function getProjectPropertyList(): string[] {
  return ["name", "title", "description", "bpscriptentrypoint", "bpuuid", "rpuuid"];
}

function getSubFunctionCommaSeparatedList(): string[] {
  return [
    "latestbetascriptversion",
    "usepackageversionscript",
    "usemanifestversionscript",
    "randomizealluids",
    "setnewestformatversions",
    "setnewestminengineversion",
  ];
}

async function loadProjects() {
  if (!creatorTools || !creatorTools.ensureLocalFolder) {
    throw new Error("Not properly configured.");
  }

  const psw = options.projectStartsWith;

  const additionalFiles: string[] = [];

  if (options.inputFile && options.inputFolder) {
    throw new Error("Cannot specify both an input file and an input folder.");
  }

  if (options.additionalFiles && typeof options.additionalFiles === "string") {
    const paths = options.additionalFiles.split(",");

    for (const path of paths) {
      additionalFiles.push(path);
    }
  }

  if (options.inputFile) {
    const inputFolderPath = StorageUtilities.getFolderPath(options.inputFile);
    const inputFileName = StorageUtilities.getLeafName(options.inputFile);

    if (!inputFileName || inputFileName.length < 2 || !inputFolderPath || inputFolderPath.length < 2) {
      throw new Error("Could not process file with path: `" + options.inputFile + "`");
    }

    const containingFolder = creatorTools.ensureLocalFolder(inputFolderPath);

    containingFolder.storage.readOnly = true;

    const file = containingFolder.ensureFile(inputFileName);

    const fileExists = await file.exists();

    if (!fileExists) {
      throw new Error("Could not find file with path: `" + options.inputFile + "`.");
    }

    const fileName = StorageUtilities.getLeafName(options.inputFile);

    const mainProject: IProjectStartInfo = {
      ctorProjectName: fileName,
      localFilePath: options.inputFile,
      accessoryFiles: additionalFiles.slice(),
    };

    projectStarts.push(mainProject);

    return;
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
      if (file && !StorageUtilities.isFileStorageItem(file) && !file.fullPath.endsWith(".mci.json.zip")) {
        isMultiLevelMultiProject = false;
        break;
      }
    }
  }

  if (!options.single) {
    if (isMultiLevelMultiProject) {
      for (const subFolderName in workFolder.folders) {
        const subFolder = workFolder.folders[subFolderName];

        if (subFolder) {
          await subFolder.load();

          for (const subFileName in subFolder.files) {
            const subFile = subFolder.files[subFileName];

            if (subFile) {
              if (StorageUtilities.isFileStorageItem(subFile) && !subFile.fullPath.endsWith(".mci.json.zip")) {
                storageItemCount++;
              }

              let typeFromName = StorageUtilities.getTypeFromName(subFileName);

              if (
                !StorageUtilities.isFileStorageItem(subFile) &&
                !subFile.fullPath.endsWith(".mci.json.zip") &&
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
          await subFolder.load();

          for (const fileName in subFolder.files) {
            const file = subFolder.files[fileName];

            if (file && StorageUtilities.isFileStorageItem(file) && !file.fullPath.endsWith(".mci.json.zip")) {
              const ps: IProjectStartInfo = { ctorProjectName: file.name, accessoryFiles: additionalFiles.slice() };

              let baseName = StorageUtilities.getBaseFromName(file.name);

              if (subFolder.files[baseName + ".data.json"]) {
                ps.accessoryFiles?.push(baseName + ".data.json");
              }

              let lastDash = baseName.lastIndexOf("-");

              if (lastDash > 0) {
                baseName = baseName.substring(0, lastDash);

                if (subFolder.files[baseName + ".data.json"]) {
                  ps.accessoryFiles?.push(baseName + ".data.json");
                }
              }

              ps.localFilePath = file.fullPath;

              if (!psw || baseName.toLowerCase().startsWith(psw)) {
                projectStarts.push(ps);
              }
            }
          }
        }
      }

      if (projectStarts.length > 0 || psw) {
        if (psw) {
          Log.message("No projects matched project starts with of `" + psw + "`");
        }
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

      for (const folderName in workFolder.folders) {
        if (
          MinecraftUtilities.pathLooksLikePackName(folderName) ||
          MinecraftUtilities.pathLooksLikePackContainerName(folderName)
        ) {
          isChildrenOfFolderMultiProject = false;
          continue;
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

          if (file && StorageUtilities.isFileStorageItem(file) && !file.fullPath.endsWith(".mci.json.zip")) {
            const mainProject: IProjectStartInfo = {
              ctorProjectName: file.name,
              accessoryFiles: additionalFiles.slice(),
            };

            mainProject.localFilePath = file.fullPath;
            if (!psw || file.name.toLowerCase().startsWith(psw)) {
              projectStarts.push(mainProject);
            }
          }
        }

        for (const folderName in workFolder.folders) {
          const folder = workFolder.folders[folderName];

          if (folder && !folder.errorStatus && folder.name !== "out") {
            await folder.load();

            if (folder.folderCount > 0) {
              const mainProject: IProjectStartInfo = {
                ctorProjectName: folder.name,
                accessoryFiles: additionalFiles.slice(),
              };

              mainProject.localFolderPath = folder.fullPath;

              if (!psw || folder.name.toLowerCase().startsWith(psw)) {
                projectStarts.push(mainProject);
              }
            }
          }
        }

        if (projectStarts.length > 0 || psw) {
          if (psw) {
            Log.message("No projects matched project starts with of `" + psw + "`");
          }
          return;
        }
      }
    }
  }

  // OK, just assume this folder is a big single project then.
  const mainProject: IProjectStartInfo = { ctorProjectName: name, accessoryFiles: additionalFiles.slice() };

  mainProject.localFolderPath = workFolder.fullPath;

  projectStarts.push(mainProject);
}

async function applyServerProps() {
  if (localEnv) {
    await localEnv.load();

    if (serverHostPort) {
      localEnv.serverHostPort = serverHostPort;
    }

    if (serverTitle) {
      localEnv.serverTitle = serverTitle;
    }

    if (serverDomainName) {
      localEnv.serverDomainName = serverDomainName;
    }

    if (serverMessageOfTheDay) {
      localEnv.serverMessageOfTheDay = serverMessageOfTheDay;
    }

    await localEnv.save();
  }
}

function hookInput() {
  process.stdin.setEncoding("utf-8");

  process.stdin.on("data", async function (data: string) {
    if (data.startsWith("exit") || data.startsWith("stop")) {
      await doExit();
    }
  });
}

async function displayVersion() {
  console.log("\n" + constants.name + " Tools");
  console.log("Version: " + constants.version);

  if (creatorTools && creatorTools.local) {
    const local = creatorTools.local as LocalUtilities;
    console.log("\n");
    console.log("Machine user data path: " + local.userDataPath);
    console.log("Machine app data path: " + local.localAppDataPath);
    console.log("Minecraft path: " + local.minecraftPath);
    console.log("Server working path: " + local.serversPath);
    console.log("Environment prefs path: " + local.envPrefsPath);
    console.log("Pack cache path: " + local.packCachePath);
  }
  console.log("\n");
  console.log(constants.copyright);
  console.log(constants.disclaimer);
  console.log("\n");
}

async function setPasscode(
  displayReadOnlyPasscode: string | undefined,
  fullReadOnlyPasscode: string | undefined,
  updateStatePasscode: string | undefined,
  adminPasscode: string | undefined
) {
  if (localEnv === undefined) {
    throw new Error();
  }

  await localEnv.load();

  if (
    localEnv.displayReadOnlyPasscode === undefined ||
    localEnv.adminPasscode === undefined ||
    localEnv.fullReadOnlyPasscode === undefined ||
    localEnv.updateStatePasscode === undefined
  ) {
    await localEnv.setDefaults();
  }

  if (adminPasscode) {
    localEnv.adminPasscode = adminPasscode;
  }

  if (displayReadOnlyPasscode) {
    localEnv.displayReadOnlyPasscode = displayReadOnlyPasscode;
  }

  if (fullReadOnlyPasscode) {
    localEnv.fullReadOnlyPasscode = fullReadOnlyPasscode;
  }

  if (updateStatePasscode) {
    localEnv.updateStatePasscode = updateStatePasscode;
  }

  await localEnv.save();
}

function getFriendlyPasscode(str: string) {
  if (str.length >= 4) {
    str = str.toUpperCase();
    return str.substring(0, 4) + "-" + str.substring(4);
  }

  return str;
}

async function minecraftEulaAndPrivacyStatement() {
  if (!localEnv) {
    throw new Error();
  }

  await localEnv.load();

  const questions: inquirer.DistinctQuestion<any>[] = [];

  console.log(
    "This feature uses Minecraft assets and/or the Minecraft Bedrock Dedicated Server. To use it, you must agree to the Minecraft End User License Agreement and Privacy Statement.\n"
  );
  console.log("    Minecraft End User License Agreement: https://minecraft.net/eula");
  console.log("    Minecraft Privacy Statement: https://go.microsoft.com/fwlink/?LinkId=521839\n");

  questions.push({
    type: "confirm",
    default: false,
    name: "minecraftEulaAndPrivacyStatement",
    message: "I agree to the Minecraft End User License Agreement and Privacy Statement",
  });

  const answers = await inquirer.prompt(questions);

  const iaccept = answers["minecraftEulaAndPrivacyStatement"];

  if (iaccept === true || iaccept === false) {
    localEnv.iAgreeToTheMinecraftEndUserLicenseAgreementAndPrivacyStatementAtMinecraftDotNetSlashEula = iaccept;

    await localEnv.save();
  }

  return iaccept;
}

async function displayInfo() {
  for (const projectStart of projectStarts) {
    if (projectStart && creatorTools) {
      const project = ClUtils.createProject(creatorTools, projectStart);
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

      const itemsCopy = project.getItemsCopy();

      for (let i = 0; i < itemsCopy.length; i++) {
        const item = itemsCopy[i];

        console.log("=== " + item.typeTitle + ": " + item.projectPath);

        if (item.isWorld) {
          await setAndDisplayWorld(item, false);
        }
      }

      const pis = project.indevInfoSet;

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
    if (projectStart && creatorTools) {
      const project = ClUtils.createProject(creatorTools, projectStart);
      await project.inferProjectItemsFromFiles();

      let setWorld = false;

      const itemsCopy = project.getItemsCopy();

      for (const item of itemsCopy) {
        if (item.isWorld) {
          let shouldProcess = true;

          if (item.projectPath && ofName) {
            const name = StorageUtilities.canonicalizeName(
              StorageUtilities.getBaseFromName(StorageUtilities.getLeafName(item.projectPath))
            );

            shouldProcess = ofName === name;
          }

          if (shouldProcess) {
            await setAndDisplayWorld(item, isEnsure);
            setWorld = true;
          } else {
            await setAndDisplayWorld(item, false);
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
          if (options.outputFolder) {
            let targetFolder = options.outputFolder;

            if (options.inputFolder && targetFolder.startsWith(options.inputFolder)) {
              targetFolder = targetFolder.substring(options.inputFolder.length);
            }

            if (targetFolder.length > 2) {
              destF = await wcf.ensureFolderFromRelativePath(StorageUtilities.ensureEndsDelimited(targetFolder));
            }
          }

          if (destF) {
            let path = destF.getFolderRelativePath(project.projectFolder);

            if (path) {
              path = StorageUtilities.ensureEndsWithDelimiter(StorageUtilities.absolutize(path));

              const pi = project.ensureItemByProjectPath(
                path,
                ProjectItemStorageType.folder,
                targetName,
                ProjectItemType.worldFolder,
                FolderContext.unknown
              );

              if (!pi.isContentLoaded) {
                await pi.loadContent();
              }

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
      console.log("World path: " + item.projectPath);

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
  if (!creatorTools || !localEnv) {
    return;
  }

  const projectList: IProjectMetaState[] = [];

  // Use sequential processing if threads=1, otherwise use native Node.js workers
  if (threads === 1) {
    await processProjectsSequentially(projectList);
  } else {
    await processProjectsWithWorkers(projectList);
  }

  if (aggregateReportsAfterValidation) {
    Log.message("Aggregating reports across " + projectList.length + " projects.");
    await saveAggregatedReports(projectList);
  }
}

async function processProjectsSequentially(projectList: IProjectMetaState[]) {
  for (let i = 0; i < projectStarts.length; i++) {
    const ps = projectStarts[i];
    if (!ps) continue;

    console.log(`Processing project ${i + 1}/${projectStarts.length}: ${ps.ctorProjectName}`);

    try {
      const result = await executeTask({
        task: TaskType.validate,
        project: ps,
        arguments: {
          suite: suite,
          exclusionList: exclusionList,
          outputMci: aggregateReportsAfterValidation || outputType === OutputType.noReports,
          outputType: outputType,
        },
        outputFolder: options.outputFolder,
        inputFolder: options.inputFolder,
        displayInfo: localEnv!.displayInfo,
        displayVerbose: localEnv!.displayVerbose,
        force: force,
      });

      if (result !== undefined) {
        await processValidationResult(result, ps, projectList);
      }

      // Force garbage collection after each project if available
      if (global.gc) {
        global.gc();
      }
    } catch (e: any) {
      console.error(
        "Processing Error for " + ps.ctorProjectName + ": " + e.toString() + (e.stack ? "\n" + e.stack : "")
      );
      setErrorLevel(ERROR_VALIDATION_INTERNALPROCESSINGERROR);
    }
  }
}

async function processProjectsWithWorkers(projectList: IProjectMetaState[]) {
  const maxConcurrency = Math.min(8, threads);
  let currentIndex = 0;

  const processProject = async (ps: IProjectStartInfo): Promise<any> => {
    return new Promise((resolve, reject) => {
      // Use the compiled TaskWorker.js path
      const workerPath = path.resolve(__dirname, "TaskWorker.js");
      const worker = new NodeWorker(workerPath, {
        resourceLimits: {
          maxOldGenerationSizeMb: 16384, // 16GB memory limit per worker
        },
      });

      const taskData = {
        task: TaskType.validate,
        project: ps,
        arguments: {
          suite: suite,
          exclusionList: exclusionList,
          outputMci: aggregateReportsAfterValidation || outputType === OutputType.noReports,
          outputType: outputType,
        },
        outputFolder: options.outputFolder,
        inputFolder: options.inputFolder,
        displayInfo: localEnv!.displayInfo,
        displayVerbose: localEnv!.displayVerbose,
        force: force,
      };

      // Define cleanup function to remove all event listeners
      const cleanup = () => {
        worker.removeAllListeners("message");
        worker.removeAllListeners("error");
        worker.removeAllListeners("exit");
      };

      const onMessage = (result: any) => {
        cleanup();
        worker.terminate();
        resolve(result);
      };

      const onError = (error: Error) => {
        console.error(`Worker error for ${ps.ctorProjectName}:`, error);
        cleanup();
        worker.terminate();
        reject(error);
      };

      const onExit = (code: number) => {
        cleanup();
        if (code !== 0) {
          reject(new Error(`Worker for ${ps.ctorProjectName} stopped with exit code ${code}`));
        }
      };

      worker.on("message", onMessage);
      worker.on("error", onError);
      worker.on("exit", onExit);

      worker.postMessage(taskData);
    });
  };

  // Process projects with limited concurrency
  const processNextBatch = async () => {
    const promises: Promise<any>[] = [];
    const batchProjects: IProjectStartInfo[] = [];

    for (let i = 0; i < maxConcurrency && currentIndex < projectStarts.length; i++) {
      const ps = projectStarts[currentIndex++];
      if (ps) {
        batchProjects.push(ps);
        promises.push(processProject(ps));
      }
    }

    const results = await Promise.allSettled(promises);

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const ps = batchProjects[i];

      if (result.status === "fulfilled" && result.value !== undefined) {
        await processValidationResult(result.value, ps, projectList);
      } else if (result.status === "rejected") {
        console.error("Worker processing error for " + ps.ctorProjectName + ": " + result.reason);
        setErrorLevel(ERROR_VALIDATION_INTERNALPROCESSINGERROR);
      }
    }
  };

  while (currentIndex < projectStarts.length) {
    await processNextBatch();
  }
}

async function processValidationResult(result: any, ps: IProjectStartInfo, projectList: IProjectMetaState[]) {
  if (typeof result === "string") {
    Log.error(ps.ctorProjectName + " error: " + result);
  } else if (Array.isArray(result)) {
    for (const metaState of result) {
      // clear out icons since the aggregation won't need them, and it should save memory.
      if (metaState.infoSetData && metaState.infoSetData.info && metaState.infoSetData.info["defaultIcon"]) {
        metaState.infoSetData.info["defaultIcon"] = undefined;
      }

      projectList.push(metaState as IProjectMetaState);

      const infoSet = (metaState as IProjectMetaState).infoSetData;

      if (infoSet) {
        const items = infoSet.items;

        if (items) {
          for (const item of items) {
            if (item.iTp === InfoItemType.internalProcessingError) {
              const errorMessage =
                "Internal Processing Error: " + ProjectInfoSet.getExtendedMessageFromData(infoSet, item);
              console.error(errorMessage);
              setErrorLevel(ERROR_VALIDATION_INTERNALPROCESSINGERROR);
            } else if (item.iTp === InfoItemType.testCompleteFail && !options.outputFolder) {
              console.error("Test Fail: " + ProjectInfoSet.getExtendedMessageFromData(infoSet, item));
              setErrorLevel(ERROR_VALIDATION_TESTFAIL);
            } else if (item.iTp === InfoItemType.error && !options.outputFolder) {
              console.error("Error: " + ProjectInfoSet.getExtendedMessageFromData(infoSet, item));
              setErrorLevel(ERROR_VALIDATION_ERROR);
            }
          }
        }
      }
    }
  }
}

async function profileValidation() {
  if (!creatorTools || !localEnv) {
    return;
  }

  await ProfilerWrapper.generateCpuTrace("validate", async () => {
    const suiteConst = suite;
    const exclusionListConst = exclusionList;
    const aggregateReportsAfterValidationConst = aggregateReportsAfterValidation;
    const localEnvConst = localEnv;

    for (let i = 0; i < projectStarts.length; i++) {
      const ps = projectStarts[i];

      if (ps) {
        try {
          await executeTask({
            task: TaskType.validate,
            project: ps,
            arguments: {
              suite: suiteConst,
              exclusionList: exclusionListConst,
              outputMci: aggregateReportsAfterValidationConst || outputType === OutputType.noReports,
              outputType: outputType,
            },
            outputFolder: options.outputFolder,
            inputFolder: options.inputFolder,
            displayInfo: localEnvConst.displayInfo,
            displayVerbose: localEnvConst.displayVerbose,
            force: force,
          });
        } catch (e: any) {
          console.error("Internal Processing Error 3: " + e.toString());
          setErrorLevel(ERROR_VALIDATION_INTERNALPROCESSINGERROR);
        }
      }
    }
  });
}

function setErrorLevel(newErrorLevel: number) {
  if (errorLevel === undefined || newErrorLevel < errorLevel) {
    errorLevel = newErrorLevel;
    (process as any).exitCode = newErrorLevel;
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

  await inpFolder.load();

  let projectsLoaded = 0;

  for (const fileName in inpFolder.files) {
    let file = inpFolder.files[fileName];

    if (file && StorageUtilities.getTypeFromName(fileName) === "json") {
      await file.loadContent(true);

      let jsonO = await StorageUtilities.getJsonObject(file);

      if (jsonO.info && jsonO.items && jsonO.generatorName !== undefined && jsonO.generatorVersion !== undefined) {
        const pis = new ProjectInfoSet(undefined, undefined, undefined, jsonO.info, jsonO.items);

        let suite: ProjectInfoSuite | undefined = undefined;

        let baseName = StorageUtilities.getBaseFromName(fileName);

        if (baseName.endsWith(".mcr")) {
          baseName = baseName.substring(0, baseName.length - 4);
        }

        if (baseName.endsWith("addon")) {
          suite = ProjectInfoSuite.cooperativeAddOn;
          baseName = baseName.substring(0, baseName.length - 5);
        }

        if (baseName.endsWith("currentplatform")) {
          suite = ProjectInfoSuite.currentPlatformVersions;
          baseName = baseName.substring(0, baseName.length - 15);
        }

        if (baseName.endsWith("sharing")) {
          suite = ProjectInfoSuite.sharing;
          baseName = baseName.substring(0, baseName.length - 7);
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
          suite: suite,
        });

        projectsLoaded++;
      }
    }
  }

  if (projectList.length > 0) {
    await saveAggregatedReports(projectList, inpFolder);
  } else {
    Log.message("Did not find any report JSON files.");
  }
}

async function saveAggregatedReports(projectList: IProjectMetaState[], inputFolder?: IFolder) {
  let outputStorage: NodeStorage | undefined;
  let measureFolder: NodeFolder | undefined;
  let indexFolder: NodeFolder | undefined;
  let mciFolder: NodeFolder | undefined;
  const csvHeader = ProjectInfoSet.CommonCsvHeader;

  let sampleProjectInfoSets: {
    [suiteName: string]: ProjectInfoSet | undefined;
  } = {};

  const featureSetsByName: {
    [suiteName: string]: { [setName: string]: { [measureName: string]: number | undefined } | undefined };
  } = {};

  const fieldsByName: { [suiteName: string]: { [featureName: string]: boolean | undefined } } = {};

  const issueLines: { [name: string]: string[] } = {};
  const summaryLines: { [name: string]: string[] } = {};
  const mciFileList: IIndexJson = { files: [], folders: [] };
  const measureFileList: IIndexJson = { files: [], folders: [] };
  const megaContentIndex: ContentIndex = new ContentIndex();
  const measures: { [featureSetName: string]: { name: string; items: { [featureName: string]: any } } } = {};
  const dataMeasures: { [featureSetName: string]: { name: string; items: { [featureName: string]: any } } } = {};

  if (options.outputFolder) {
    outputStorage = new NodeStorage(options.outputFolder, "");
    indexFolder = outputStorage.rootFolder.ensureFolder("index");
    mciFolder = outputStorage.rootFolder.ensureFolder("mci");
  }

  let projectsProcessedOne = 0;

  for (const projectSet of projectList) {
    let suiteName = "all";

    if (projectSet.suite !== undefined) {
      suiteName = ProjectInfoSet.getSuiteString(projectSet.suite);
    }

    const pisData = projectSet.infoSetData;

    const contentIndex = new ContentIndex();
    const projectBaseName = StorageUtilities.removeContainerExtension(projectSet.projectContainerName);

    if (pisData.index) {
      contentIndex.loadFromData(pisData.index);
    } else if (inputFolder) {
      await inputFolder.load();
      const childFile = await inputFolder.getFileFromRelativePath(
        "/mci/" + projectBaseName.toLowerCase() + ".mci.json"
      );

      if (childFile) {
        await childFile.loadContent();
        const indexContent = StorageUtilities.getJsonObject(childFile);

        if (indexContent) {
          pisData.index = indexContent.index;
          contentIndex.loadFromData(indexContent.index);
        }
      }
    }

    const pis = new ProjectInfoSet(undefined, undefined, undefined, pisData.info, pisData.items, contentIndex);

    if (pis.contentIndex && buildAggregatedIndex) {
      megaContentIndex.mergeFrom(pis.contentIndex, projectBaseName);
    }

    if (projectSet.projectName) {
      mciFileList.files.push(projectBaseName.toLowerCase() + ".mci.json");
    }

    if (projectsProcessedOne > 0 && projectsProcessedOne % 500 === 0) {
      let fsCount = countFeatureSets(featureSetsByName);
      let fsMeasureCount = countFeatureSetMeasures(featureSetsByName);
      let fieldCount = countFeatures(fieldsByName);

      console.warn(
        "Processed " +
          projectsProcessedOne +
          " reports in phase 1, @ " +
          projectBaseName +
          " ( Feature Sets " +
          fsCount +
          " Measures: " +
          fsMeasureCount +
          ", Fields: " +
          fieldCount +
          ")"
      );
    }

    if (!Utilities.isUsableAsObjectKey(suiteName)) {
      Log.unsupportedToken(suiteName);
      return;
    }

    if (featureSetsByName[suiteName] === undefined) {
      featureSetsByName[suiteName] = {};
    }

    const featureSets = featureSetsByName[suiteName];

    if (fieldsByName[suiteName] === undefined) {
      fieldsByName[suiteName] = {};
    }

    const fields = fieldsByName[suiteName];

    pis.mergeFeatureSetsAndFieldsTo(featureSets, fields);
    projectsProcessedOne++;
  }

  for (const setName in featureSetsByName) {
    const featureSets = featureSetsByName[setName];

    if (featureSets) {
      for (const featureSetName in featureSets) {
        const featureSet = featureSets[featureSetName];

        if (featureSet) {
          measures[featureSetName] = {
            name: featureSetName,
            items: {},
          };
        }
      }
    }
  }

  let projectsProcessedTwo = 0;

  for (const projectSet of projectList) {
    let suiteName = "all";

    if (projectSet.suite !== undefined) {
      suiteName = ProjectInfoSet.getSuiteString(projectSet.suite);
    }

    const pisData = projectSet.infoSetData;
    const projectBaseName = StorageUtilities.removeContainerExtension(projectSet.projectContainerName);
    const pis = new ProjectInfoSet(undefined, undefined, undefined, pisData.info, pisData.items);

    if (featureSetsByName[suiteName] === undefined) {
      featureSetsByName[suiteName] = {};
    }

    const featureSets = featureSetsByName[suiteName];

    if (fieldsByName[suiteName] === undefined) {
      fieldsByName[suiteName] = {};
    }

    const fields = fieldsByName[suiteName];

    pis.mergeFeatureSetsAndFieldsTo(featureSets, fields);

    if (projectsProcessedTwo > 0 && projectsProcessedTwo % 500 === 0) {
      let fsCount = countFeatureSets(featureSetsByName);
      let fsMeasureCount = countFeatureSetMeasures(featureSetsByName);
      let fieldCount = countFeatures(fieldsByName);

      console.warn(
        "Processed " +
          projectsProcessedOne +
          " reports in phase 2, @ " +
          projectBaseName +
          " ( Feature Sets " +
          fsCount +
          " Measures: " +
          fsMeasureCount +
          ", Fields: " +
          fieldCount +
          ")"
      );
    }

    sampleProjectInfoSets[suiteName] = pis;

    if (projectSet.suite === undefined || projectSet.suite === ProjectInfoSuite.defaultInDevelopment) {
      if (projectSet.infoSetData.info) {
        for (const memberName in projectSet.infoSetData.info) {
          if (ProjectInfoSet.isAggregableFieldName(memberName)) {
            let data: { name: string; items: { [featureName: string]: any } } = dataMeasures[memberName];

            if (data === undefined) {
              data = { name: memberName, items: {} };
              dataMeasures[memberName] = data;
            }

            if ((projectSet.infoSetData.info as any)[memberName] !== undefined) {
              if (!Utilities.isUsableAsObjectKey(projectBaseName)) {
                Log.unsupportedToken(projectBaseName);
                throw new Error();
              }

              data.items[projectBaseName] = (projectSet.infoSetData.info as any)[memberName];
            }
          }
        }
      }

      if (projectSet.infoSetData.info && projectSet.infoSetData.info.featureSets) {
        for (const featureSetName in featureSets) {
          const featureSet = projectSet.infoSetData.info.featureSets[featureSetName];

          if (featureSet) {
            measures[featureSetName].items[projectBaseName] = featureSet;
          }
        }
      }
    }

    if (issueLines[suiteName] === undefined) {
      issueLines[suiteName] = [];
    }

    if (issueLines[suiteName].length <= MAX_LINES_PER_CSV_FILE) {
      const pisLines = pis.getItemCsvLines();

      for (let j = 0; j < pisLines.length; j++) {
        issueLines[suiteName].push('"' + projectBaseName + '",' + pisLines[j]);
      }
    }

    if (summaryLines[suiteName] === undefined) {
      summaryLines[suiteName] = [];
    }

    if (outputStorage) {
      summaryLines[suiteName].push(pis.getSummaryCsvLine(projectBaseName, projectSet.projectTitle, featureSets));
    }

    projectsProcessedTwo++;
  }
  let fsCount = countFeatureSets(featureSetsByName);
  let fsMeasureCount = countFeatureSetMeasures(featureSetsByName);
  let fieldCount = countFeatures(fieldsByName);

  console.warn("Saving out content. Feature Set " + fsCount + " Measures:" + fsMeasureCount + " Fields:" + fieldCount);

  if (outputStorage) {
    for (const issueLinesName in issueLines) {
      if (sampleProjectInfoSets[issueLinesName]) {
        const issueLinesSet = issueLines[issueLinesName];

        if (issueLinesSet.length < MAX_LINES_PER_CSV_FILE) {
          let allCsvFile = outputStorage.rootFolder.ensureFile(issueLinesName + ".csv");

          let allCsvContent = "Project," + csvHeader + "\r\n" + issueLinesSet.join("\n");

          allCsvFile.setContent(allCsvContent);

          await allCsvFile.saveContent();
        }
      }
    }

    console.warn("Saving out index json.");
    if (mciFolder) {
      const mciFile = mciFolder.ensureFile("index.json");
      mciFile.setContent(JSON.stringify(mciFileList));
      await mciFile.saveContent();
    }

    console.warn("Saving out summary lines.");

    for (const summaryLinesName in summaryLines) {
      if (!Utilities.isUsableAsObjectKey(summaryLinesName)) {
        Log.unsupportedToken(summaryLinesName);
        throw new Error();
      }

      if (featureSetsByName[summaryLinesName] === undefined) {
        featureSetsByName[summaryLinesName] = {};
      }

      if (sampleProjectInfoSets[summaryLinesName]) {
        const featureSets = featureSetsByName[summaryLinesName];

        const summaryLinesSet = summaryLines[summaryLinesName];

        const projectsCsvFile = outputStorage.rootFolder.ensureFile(summaryLinesName + "projects.csv");

        let projectsCsvContent = ProjectInfoSet.getSummaryCsvHeaderLine(
          sampleProjectInfoSets[summaryLinesName].info,
          featureSets
        );

        const allLines: string[] = [];

        allLines.push(projectsCsvContent);

        for (const projectsCsvContentLine of summaryLinesSet) {
          allLines.push(projectsCsvContentLine);
        }

        (projectsCsvFile as NodeFile).writeContent(allLines);
      }
    }
  }
}

function countFeatures(features: { [suiteName: string]: { [featureName: string]: boolean | undefined } }) {
  let count = 0;

  for (const suiteName in features) {
    const featureSet = features[suiteName];

    if (featureSet) {
      for (const featureName in featureSet) {
        if (featureName) {
          count++;
        }
      }
    }
  }

  return count;
}

function countFeatureSets(featureSets: {
  [suiteName: string]: { [setName: string]: { [measureName: string]: number | undefined } | undefined };
}) {
  let count = 0;

  for (const suiteName in featureSets) {
    const featureSet = featureSets[suiteName];

    if (featureSet) {
      for (const setName in featureSet) {
        if (setName) {
          count++;
        }
      }
    }
  }

  return count;
}

function countFeatureSetMeasures(featureSets: {
  [suiteName: string]: { [setName: string]: { [measureName: string]: number | undefined } | undefined };
}) {
  let count = 0;

  for (const suiteName in featureSets) {
    const featureSet = featureSets[suiteName];

    if (featureSet) {
      for (const setName in featureSet) {
        const measureSet = featureSet[setName];

        if (measureSet) {
          for (const measureName in measureSet) {
            if (measureName) {
              count++;
            }
          }
        }
      }
    }
  }

  return count;
}

async function docsUpdateFormSource() {
  if (!creatorTools) {
    errorLevel = ERROR_INIT_ERROR;
    console.error("Not configured correctly to generate documents.");
    return;
  }

  let outFolder: IFolder | undefined = undefined;

  if (options.outputFolder) {
    const ns = new NodeStorage(options.outputFolder, "");
    outFolder = ns.rootFolder;
  } else {
    const outputStorage = new NodeStorage(process.cwd(), "");
    outFolder = outputStorage.rootFolder;
  }

  if (!outFolder) {
    errorLevel = ERROR_INIT_ERROR;
    console.error("Could not find an output folder for generate documents.");
    return;
  }

  await outFolder.ensureExists();

  const formJsonDocGen = new FormJsonDocumentationGenerator();

  await formJsonDocGen.updateFormSource(outFolder, true);
}

async function docsGenerateFormJson() {
  if (!creatorTools) {
    errorLevel = ERROR_INIT_ERROR;
    console.error("Not configured correctly to generate documents.");
    return;
  }

  let outFolder: IFolder | undefined = undefined;

  if (options.outputFolder) {
    const ns = new NodeStorage(options.outputFolder, "");
    outFolder = ns.rootFolder;
  } else {
    const outputStorage = new NodeStorage(process.cwd(), "");
    outFolder = outputStorage.rootFolder;
  }

  if (!outFolder) {
    errorLevel = ERROR_INIT_ERROR;
    console.error("Could not find an output folder for generate documents.");
    return;
  }

  await outFolder.ensureExists();

  const inputFolder = await ClUtils.getMainWorkFolder(executionTaskType, options.inputFolder, options.outputFolder);

  const docGen = new FormJsonDocumentationGenerator();

  await docGen.generateFormJson(inputFolder, outFolder);
}

async function docsGenerateMarkdown() {
  if (!creatorTools) {
    errorLevel = ERROR_INIT_ERROR;
    console.error("Not configured correctly to generate documents.");
    return;
  }

  let outFolder: IFolder | undefined = undefined;

  if (options.outputFolder) {
    const ns = new NodeStorage(options.outputFolder, "");
    outFolder = ns.rootFolder;
  } else {
    const outputStorage = new NodeStorage(process.cwd(), "");
    outFolder = outputStorage.rootFolder;
  }

  if (!outFolder) {
    errorLevel = ERROR_INIT_ERROR;
    console.error("Could not find an output folder for generate documents.");
    return;
  }

  await outFolder.ensureExists();

  const inputFolder = await ClUtils.getMainWorkFolder(executionTaskType, options.inputFolder, options.outputFolder);

  await outFolder.deleteAllFolderContents();

  const formDocGen = new FormMarkdownDocumentationGenerator();

  await formDocGen.generateMarkdown(inputFolder, outFolder);

  const tableDocGen = new TableMarkdownDocumentationGenerator();

  await tableDocGen.generateMarkdown(outFolder);

  const markdownFromDocDocGen = new DocJsonMarkdownDocumentationGenerator();

  await markdownFromDocDocGen.generateMarkdown(inputFolder, outFolder);
}

async function docsGenerateTypes() {
  if (!creatorTools) {
    errorLevel = ERROR_INIT_ERROR;
    console.error("Not configured correctly to generate types and schemas.");
    return;
  }

  let outFolder: IFolder | undefined = undefined;

  if (options.outputFolder) {
    const ns = new NodeStorage(options.outputFolder, "");
    outFolder = ns.rootFolder;
  } else {
    const outputStorage = new NodeStorage(process.cwd(), "");
    outFolder = outputStorage.rootFolder;
  }

  if (!outFolder) {
    errorLevel = ERROR_INIT_ERROR;
    console.error("Could not find an output folder for generate documents.");
    return;
  }

  await outFolder.ensureExists();

  const inputFolder = await ClUtils.getMainWorkFolder(executionTaskType, options.inputFolder, options.outputFolder);

  await outFolder.deleteAllFolderContents();

  const formDocGen = new FormDefinitionTypeScriptGenerator();

  await formDocGen.generateTypes(inputFolder, outFolder);
}

async function exportWorld() {
  if (!creatorTools || projectStarts.length === 0) {
    errorLevel = ERROR_INIT_ERROR;
    console.error("Not configured correctly to export a project.");
    return;
  }

  for (const projectStart of projectStarts) {
    if (projectStart) {
      const project = ClUtils.createProject(creatorTools, projectStart);

      await project.inferProjectItemsFromFiles();

      const path = getFilePath(project.name + ".mcworld");

      console.log("Exporting flat pack world to '" + path + "'");

      await LocalTools.exportWorld(creatorTools, project, path);
    }
  }
}

async function stop() {
  process.exit();
}

async function doExit() {
  if (sm) {
    sm.stopWebServer();
  }

  if (!errorLevel) {
    (process as any).exitCode = errorLevel;
  }
}

async function ensureRefWorld() {
  const ns: NodeStorage | undefined = getTargetFolderFromMode();
  if (!creatorTools || !creatorTools.local || projectStarts.length === 0) {
    errorLevel = ERROR_INIT_ERROR;
    console.error("Not configured correctly to export a project.");
    return;
  }

  for (const projectStart of projectStarts) {
    if (projectStart) {
      if (!ns) {
        return;
      }

      const project = ClUtils.createProject(creatorTools, projectStart);

      await ns.rootFolder.ensureExists();

      await LocalTools.ensureFlatPackRefWorldTo(creatorTools, project, ns.rootFolder, project.name);

      if (options.launch) {
        await LocalTools.launchWorld(creatorTools, project.name);
      }
    }
  }
}

async function setProjectProperty(project: Project, propertyName: string, propertyValue: string) {
  outputLogo("Minecraft Creator Tools (preview)");

  if (!creatorTools) {
    errorLevel = ERROR_INIT_ERROR;
    console.error("Not configured correctly to create a project (no mctools core).");
    return;
  }

  if (!propertyValue || !propertyValue.length || propertyValue.length < 3) {
    errorLevel = ERROR_INIT_ERROR;
    console.error("Please specify a valid property value");
    return;
  }

  switch (propertyName.trim().toLowerCase()) {
    case "name":
      ProjectUtilities.applyTitle(project, propertyValue);
      break;

    case "title":
      ProjectUtilities.applyTitle(project, propertyValue);
      break;

    case "description":
      ProjectUtilities.applyDescription(project, propertyValue);
      break;

    case "bpscriptentrypoint":
      ProjectUtilities.applyScriptEntryPoint(project, propertyValue);
      break;

    case "bpuuid":
      ProjectUtilities.applyBehaviorPackUniqueId(project, propertyValue);
      break;

    case "rpuuid":
      ProjectUtilities.applyResourcePackUniqueId(project, propertyValue);
      break;

    default:
      errorLevel = ERROR_INIT_ERROR;
      console.error("Please specify a valid property value");
      break;
  }

  await project.save();
}

async function create(project: Project, isSingleFolder: boolean) {
  outputLogo("Minecraft Creator Tools (preview)");

  if (!localEnv || !creatorTools) {
    errorLevel = ERROR_INIT_ERROR;
    console.error("Not configured correctly to create a project (no mctools core).");
    return;
  }

  await localEnv.load();

  if (
    !localEnv.iAgreeToTheMinecraftEndUserLicenseAgreementAndPrivacyStatementAtMinecraftDotNetSlashEula &&
    (!options.InternalOnlyRunningInTheContextOfTestCommandLines ||
      newName !== "testerName" ||
      creator !== "testerCreatorName")
  ) {
    const result = await minecraftEulaAndPrivacyStatement();

    if (!result) {
      console.log("The Minecraft End User License Agreement and Privacy Statement was not agreed to.");
      return;
    }
  }

  await creatorTools.loadGallery();

  if (!creatorTools.gallery) {
    errorLevel = ERROR_INIT_ERROR;
    console.error("Not configured correctly to create a project (no gallery).");
    return;
  }

  let title = newName;

  if (!title) {
    const titleQuestions: inquirer.DistinctQuestion<any>[] = [];
    titleQuestions.push({
      type: "input",
      name: "title",
      default: "My Project",
      message: "What's your preferred project title?",
    });
    const titleAnswer = await inquirer.prompt(titleQuestions);

    if (titleAnswer["title"]) {
      title = titleAnswer["title"];
    }
  }

  if (!title) {
    errorLevel = ERROR_INIT_ERROR;
    console.error("No title for your project was selected.");
    return;
  }

  let applyDescription = newDescription;

  if (applyDescription === undefined) {
    applyDescription = title;

    const descriptionQuestions: inquirer.DistinctQuestion<any>[] = [];
    descriptionQuestions.push({
      type: "input",
      name: "description",
      default: applyDescription,
      message: "What's your preferred project description?",
    });

    const descriptionAnswer = await inquirer.prompt(descriptionQuestions);

    if (descriptionAnswer["description"]) {
      applyDescription = descriptionAnswer["description"];
    }

    if (applyDescription === undefined) {
      applyDescription = title;
    }
  }

  if (!creator) {
    const creatorQuestions: inquirer.DistinctQuestion<any>[] = [];
    creatorQuestions.push({
      type: "input",
      name: "creator",
      default: "Creator",
      message: "What's your creator name?",
    });
    const creatorAnswer = await inquirer.prompt(creatorQuestions);

    if (creatorAnswer["creator"]) {
      creator = creatorAnswer["creator"];
    }
  }

  const questions: inquirer.DistinctQuestion<any>[] = [];
  if (!newName) {
    newName = title?.replace(/ /gi, "-").toLowerCase();

    questions.push({
      type: "input",
      name: "name",
      default: newName,
      message: "What's your preferred project short name? (<20 chars, no spaces)",
    });
  }

  if (!options.inputFolder && (!options.outputFolder || options.outputFolder === "out") && isSingleFolder) {
    const folderNameQuestions: inquirer.DistinctQuestion<any>[] = [];

    folderNameQuestions.push({
      type: "input",
      name: "folderName",
      default: newName,
      message: "What's your preferred folder name?",
    });

    const folderNameAnswer = await inquirer.prompt(folderNameQuestions);

    if (folderNameAnswer["folderName"] && project.mainDeployFolderPath) {
      const folderName = folderNameAnswer["folderName"];

      if (folderName && project.mainDeployFolderPath) {
        const path =
          NodeStorage.ensureEndsWithDelimiter(process.cwd()) + NodeStorage.ensureEndsWithDelimiter(folderName);

        const outputStorage = new NodeStorage(path, "");
        const outFolder = outputStorage.rootFolder;
        await outFolder.ensureExists();

        project.localFolderPath = path;

        project.autoDeploymentMode = ProjectAutoDeploymentMode.noAutoDeployment;
      }
    }
  }

  const galProjects = creatorTools.gallery.items;
  let galProject: IGalleryItem | undefined;

  if (template) {
    for (let i = 0; i < galProjects.length; i++) {
      const galProjectCand = galProjects[i];
      if (galProjectCand && galProjectCand.id && galProjectCand.id.toLowerCase() === template.toLowerCase()) {
        galProject = galProjectCand;
      }
    }
  }

  if (!galProject) {
    const projectTypeChoices: inquirer.DistinctChoice[] = [];

    for (let i = 0; i < galProjects.length; i++) {
      const galProjectCand = galProjects[i];

      if (galProjectCand.type === GalleryItemType.project)
        projectTypeChoices.push({
          name: galProjectCand.id + ": " + galProjectCand.title,
          value: i,
        });
    }

    questions.push({
      type: "list",
      name: "projectSource",
      message: "What template should we use?",
      choices: projectTypeChoices,
    });
  }

  if (!galProject || !newName) {
    const answers = await inquirer.prompt(questions);

    if (answers) {
      if (answers["name"]) {
        newName = answers["name"];
      }

      if (!galProject) {
        galProject = galProjects[answers["projectSource"]];
      }
    }
  }

  if (!newName) {
    errorLevel = ERROR_INIT_ERROR;
    console.error("Not configured correctly to create a project.");
    return;
  }

  if (!galProject) {
    errorLevel = ERROR_INIT_ERROR;
    console.error("No project was selected.");
    return;
  }

  project = await ProjectExporter.syncProjectFromGitHub(
    true,
    creatorTools,
    galProject.gitHubRepoName,
    galProject.gitHubOwner,
    galProject.gitHubBranch,
    galProject.gitHubFolder,
    newName,
    project,
    galProject.fileList,
    async (message: string) => {
      Log.message(message);
    },
    true
  );

  let suggestedShortName: string | undefined = undefined;

  if (newName && creator) {
    suggestedShortName = ProjectUtilities.getSuggestedProjectShortName(creator, newName);
  }

  if (creator) {
    await ProjectUtilities.applyCreator(project, creator);
  }

  await ProjectUtilities.processNewProject(project, title, applyDescription, suggestedShortName, false);

  console.log(
    "\nAll done! Now run \x1b[47m\x1b[30mnpm i\x1b[37m\x1b[40m in the \x1b[47m\x1b[30m" +
      project.projectFolder?.fullPath +
      "\x1b[37m\x1b[40m folder to install dependencies, if any, from npm."
  );
}

async function add(project: Project) {
  if (!localEnv || !creatorTools) {
    errorLevel = ERROR_INIT_ERROR;
    console.error("Not configured correctly to create a project (no mctools core).");
    return;
  }

  await localEnv.load();

  if (
    !localEnv.iAgreeToTheMinecraftEndUserLicenseAgreementAndPrivacyStatementAtMinecraftDotNetSlashEula &&
    (!options.InternalOnlyRunningInTheContextOfTestCommandLines || newName !== "testerName")
  ) {
    const result = await minecraftEulaAndPrivacyStatement();

    if (!result) {
      console.log("The Minecraft End User License Agreement and Privacy Statement was not agreed to.");
      return;
    }
  }

  let typeDesc = "Item";

  if (type) {
    switch (type) {
      case "entity":
        typeDesc = "Entity";
        break;
      case "item":
        typeDesc = "Item";
        break;
      case "block":
        typeDesc = "Block";
        break;
      default:
        typeDesc = "Definition File";
        break;
    }
  }

  await project.ensureProjectFolder();

  outputLogo("Minecraft Add " + typeDesc);

  if (!creatorTools) {
    errorLevel = ERROR_INIT_ERROR;
    console.error("Not configured correctly to add an item (no mctools core).");
    return;
  }

  await creatorTools.loadGallery();

  if (!creatorTools.gallery) {
    errorLevel = ERROR_INIT_ERROR;
    console.error("Not configured correctly to add an item (no gallery).");
    return;
  }

  const typeQuestions: inquirer.DistinctQuestion<any>[] = [];

  if (type) {
    const galleryItem = await creatorTools.getGalleryProjectById(type);

    if (galleryItem) {
      if (!newName) {
        const newNameQuestions: inquirer.DistinctQuestion<any>[] = [];
        newNameQuestions.push({
          type: "input",
          name: "name",
          message: "What's your preferred new name? (<20 chars, no spaces)",
        });
        const answers = await inquirer.prompt(newNameQuestions);

        newName = answers["name"];
      }
      if (newName) {
        console.log("Adding item " + newName + " from " + galleryItem.title + " (" + galleryItem.id + ")");
        await ProjectItemCreateManager.addFromGallery(project, newName, galleryItem);
        await project.save();
      } else {
        errorLevel = ERROR_INIT_ERROR;
        console.error("No item name was specified.");
      }
    } else {
      errorLevel = ERROR_INIT_ERROR;
      console.error("Could not find a template for " + type + ".");
    }

    return;
  }

  if (type === undefined) {
    typeQuestions.push({
      type: "list",
      name: "type",
      message: "What type of item should we add?",
      choices: [
        { name: "Entity Type (entity)", value: "entity" },
        { name: "Block Type (block)", value: "block" },
        { name: "Item Type (item)", value: "item" },
        { name: "Spawn/Loot/Recipes", value: "spawnLootRecipes" },
        { name: "World Gen", value: "worldGen" },
        { name: "Visuals", value: "visuals" },
        { name: "Single files (advanced)", value: "singleFiles" },
      ],
    });

    const typeAnswers = await inquirer.prompt(typeQuestions);

    type = typeAnswers["type"];
  }

  let subType: string | undefined = undefined;

  if (type) {
    type = type?.toLowerCase();
  }

  if (type === "entity") {
    chooseAddItem(project, GalleryItemType.entityType, "entity type");
  } else if (type === "block") {
    chooseAddItem(project, GalleryItemType.blockType, "block type");
  } else if (type === "item") {
    chooseAddItem(project, GalleryItemType.itemType, "item type");
  } else if (type === "spawnlootrecipes") {
    chooseAddItem(project, GalleryItemType.spawnLootRecipes, "spawn/loot/recipe");
  } else if (type === "worldgen") {
    chooseAddItem(project, GalleryItemType.worldGen, "world gen");
  } else if (type === "visuals") {
    chooseAddItem(project, GalleryItemType.visuals, "visuals");
  } else if (type === "singlefiles" || subType) {
    if (!subType) {
      const subTypeQuestions: inquirer.DistinctQuestion<any>[] = [
        {
          type: "list",
          name: "subType",
          message: "What type of single file should we add?",
          choices: [
            { name: "Entity/Item/Blocks", value: "entityItemBlocks_sf" },
            { name: "World Gen", value: "worldGen_sf" },
            { name: "Visuals", value: "visuals_sf" },
            { name: "Catalogs", value: "catalogs_sf" },
          ],
        },
      ];

      const subTypeAnswers = await inquirer.prompt(subTypeQuestions);

      subType = subTypeAnswers["subType"];
    }

    if (subType) {
      subType = subType?.toLowerCase();

      if (subType === "worldgen_sf") {
        await chooseAddItem(project, GalleryItemType.worldGenSingleFiles, "world gen file");
      } else if (subType === "entityitemblocks_sf") {
        await chooseAddItem(project, GalleryItemType.entityItemBlockSingleFiles, "file");
      } else if (subType === "visuals_sf") {
        await chooseAddItem(project, GalleryItemType.visualSingleFiles, "visuals file");
      } else if (subType === "catalogs_sf") {
        await chooseAddItem(project, GalleryItemType.catalogSingleFiles, "catalog file");
      }
    }
  }

  await project.save();
}

async function chooseAddItem(project: Project, itemType: GalleryItemType, typeDescriptor: string) {
  if (!creatorTools) {
    return;
  }
  const questions: inquirer.DistinctQuestion<any>[] = [];

  const gallery = await creatorTools.loadGallery();

  if (gallery) {
    const templateTypeChoices: inquirer.DistinctChoice[] = [];

    for (const proj of gallery.items) {
      if (proj.type === itemType) {
        templateTypeChoices.push({
          name: proj.title + " (" + proj.id + ")",
          value: proj.id,
        });
      }
    }

    questions.push({
      type: "list",
      name: "templateType",
      message: "Based on which " + typeDescriptor + " template?",
      choices: templateTypeChoices,
    });

    if (!newName) {
      questions.push({
        type: "input",
        name: "name",
        message: "What's your preferred new " + typeDescriptor + " name? (<20 chars, no spaces)",
      });
    }

    const answers = await inquirer.prompt(questions);

    if (!newName) {
      newName = answers["name"];
    }

    const templateType = answers["templateType"];

    if (templateType && newName) {
      for (const galItem of gallery.items) {
        if (galItem.id === templateType && galItem.type === itemType) {
          await ProjectItemCreateManager.addFromGallery(project, newName, galItem);
        }
      }
    }
  } else {
    errorLevel = ERROR_INIT_ERROR;
    console.error("Could not find a template for " + typeDescriptor + ".");
  }
}

function outputLogo(message: string) {
  console.log("\x1b[32m┌─────┐\x1b[0m");
  console.log("\x1b[32m│ ▄ ▄ │\x1b[0m " + message);
  console.log("\x1b[32m│ ┏▀┓ │\x1b[0m");
  console.log("\x1b[32m└─────┘\x1b[0m");
  console.log("");
}

async function deploy() {
  const ns: NodeStorage | undefined = getTargetFolderFromMode();

  if (!creatorTools || !creatorTools.local || projectStarts.length === 0) {
    errorLevel = ERROR_INIT_ERROR;
    console.error("Not configured correctly to deploy a project.");
    return;
  }
  for (const projectStart of projectStarts) {
    if (projectStart) {
      const project = ClUtils.createProject(creatorTools, projectStart);

      await project.inferProjectItemsFromFiles();

      if (!ns) {
        console.log("Could not determine storage for this project.");
        return;
      }

      await ns.rootFolder.ensureExists();

      await LocalTools.deploy(creatorTools, project, ns, ns.rootFolder, project.name);
    }
  }
}

function getTargetFolderFromMode() {
  let ns: NodeStorage | undefined;

  if (!creatorTools || !creatorTools.local || projectStarts.length === 0) {
    errorLevel = ERROR_INIT_ERROR;
    console.error("Not configured correctly to sync a project.");
    return;
  }

  switch (mode) {
    case "mcuwp":
    case undefined:
    case "":
      ns = new NodeStorage(creatorTools.local.minecraftPath, "");
      break;
    case "mcpreview":
      ns = new NodeStorage(creatorTools.local.minecraftPreviewPath, "");
      break;
    case "server":
      ns = new NodeStorage(options.serverPath, "");
      break;

    case "output":
    case "folder":
      ns = new NodeStorage(options.outputFolder, "");
      break;

    default:
      ns = new NodeStorage(mode, "");
      break;
  }

  return ns;
}

async function deployTestWorld() {
  const ns: NodeStorage | undefined = getTargetFolderFromMode();

  if (!creatorTools || !creatorTools.local || projectStarts.length === 0) {
    errorLevel = ERROR_INIT_ERROR;
    console.error("Not configured correctly to sync a project.");
    return;
  }
  for (const projectStart of projectStarts) {
    if (projectStart) {
      if (!ns) {
        console.log("Could not determine storage for this project.");
        return;
      }

      const project = ClUtils.createProject(creatorTools, projectStart);

      await ns.rootFolder.ensureExists();

      const worldSettings: IWorldSettings = {
        generator: Generator.infinite,
        gameType: GameType.creative,
        commandsEnabled: true,
      };

      const worldName = await ProjectExporter.deployProjectAndGeneratedWorldTo(
        creatorTools,
        project,
        worldSettings,
        ns.rootFolder
      );

      if (options.launch && worldName && typeof worldName === "string") {
        await LocalTools.launchWorld(creatorTools, worldName);
      }
    }
  }
}

async function serve() {
  if (!creatorTools || !creatorTools.local || projectStarts.length === 0 || !localEnv || !sm) {
    errorLevel = ERROR_INIT_ERROR;
    console.error("Not configured correctly to run a server.");
    return;
  }

  if (serverFeatures !== undefined) {
    sm.features = serverFeatures;
  }

  sm.onShutdown.subscribe((serverManager: ServerManager, reason: string) => {
    stop();
  });

  sm.ensureHttpServer();

  await sm.prepare();
}

function getFilePath(defaultFileName: string) {
  let path = options.outputFolder;

  if (!path) {
    path = "out";
  }

  const ns = new NodeStorage(path, "");

  ns.rootFolder.ensureExists();

  return path + "/" + defaultFileName;
}
