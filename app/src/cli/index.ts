import { Command } from "commander";
import CreatorTools from "./../app/CreatorTools.js";
import CreatorToolsHost, { HostType } from "../app/CreatorToolsHost.js";
import Utilities from "./../core/Utilities.js";
import ServerManager from "../local/ServerManager.js";
import ISslConfig from "../local/ISslConfig.js";
import StorageUtilities from "../storage/StorageUtilities.js";
import { constants } from "../core/Constants.js";
import LocalEnvironment from "../local/LocalEnvironment.js";
import { IPackageReference } from "../minecraft/IWorldSettings.js";
import Log from "../core/Log.js";
import IProjectStartInfo from "./IProjectStartInfo.js";
import ClUtils, { TaskType } from "./ClUtils.js";
import MinecraftUtilities from "../minecraft/MinecraftUtilities.js";
import * as path from "path";
import { commandRegistry } from "./core/CommandRegistry.js";
import { registerAllCommands } from "./commands/index.js";
import { CommandContextFactory } from "./core/CommandContextFactory.js";
import { ErrorCodes } from "./core/ICommandContext.js";
import ImageCodecNode from "../local/ImageCodecNode.js";

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

// Set up Node.js-specific image codec functions
CreatorToolsHost.decodePng = ImageCodecNode.decodePng;
CreatorToolsHost.encodeToPng = ImageCodecNode.encodeToPng;

const MAX_LINES_PER_CSV_FILE = 500000;

// ANSI color codes for CLI styling
const CLR = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  magenta: "\x1b[35m",
  gray: "\x1b[90m",
};

/**
 * Execute a command via the CommandRegistry.
 * This routes commands to their modular implementations instead of the legacy switch statement.
 * @param options The parsed Commander.js options (global options from program.opts())
 */
async function executeViaRegistry(options: any): Promise<void> {
  // Get the captured state from the registry (set by the command's action handler)
  const capturedState = commandRegistry.getCapturedState();
  const taskType = capturedState.taskType;

  const command = commandRegistry.getByTaskType(taskType);
  if (!command) {
    // All commands should be in the registry - if not found, it's an error
    if (taskType === TaskType.noCommand) {
      // No command specified - this is handled by commander showing help
      return;
    }
    throw new Error(`Command for TaskType ${taskType} not found in registry. Make sure all commands are registered.`);
  }

  if (!creatorTools || !localEnv) {
    throw new Error("CreatorTools not initialized");
  }

  // Build the raw options object from current options and captured command options
  const rawOptions = {
    inputFolder: options.inputFolder,
    outputFolder: options.outputFolder,
    inputFile: options.inputFile,
    additionalFiles: options.additionalFiles,
    basePath: options.basePath,
    threads: options.threads,
    force: options.force,
    verbose: options.verbose,
    quiet: options.quiet,
    json: options.json,
    debug: options.debug,
    outputType: options.outputType,
    dryRun: options.dryRun,
    isolated: options.isolated,
    unsafeSkipSignatureValidation: options.unsafeSkipSignatureValidation,
    // Server options from command-specific options
    port: capturedState.args.port || capturedState.commandOptions.port || options.port,
    slot: capturedState.commandOptions.slot || options.slot,
    runOnce: options.once,
    timeout: capturedState.commandOptions.timeout,
    forceInk: capturedState.commandOptions.forceInk,
    mcpRequireAuth: capturedState.commandOptions.mcpRequireAuth,
    logFile: capturedState.commandOptions.logFile,
    // Server passcodes
    updatepc: options.updatePasscode,
    adminpc: options.adminPasscode,
    displaypc: options.displayPasscode,
    fullpc: options.fullReadOnlyPasscode,
    // Server features from captured args
    features: capturedState.args.features,
    title: capturedState.args.title,
    domain: capturedState.args.domain,
    motd: capturedState.args.motd,
    // World options
    betaApis: options.betaApis,
    editor: options.editor,
    testWorld: capturedState.commandOptions.testWorld,
    launch: capturedState.commandOptions.launch,
    // Validation options from captured args
    suite: capturedState.args.suite,
    exclusions: capturedState.args.exclusions,
    aggregateReports:
      capturedState.args.aggregateReports === "aggregate" ||
      capturedState.args.aggregateReports === "aggregatenoindex" ||
      capturedState.args.aggregateReports === "true" ||
      capturedState.args.aggregateReports === "1",
    warnOnly: options.warnOnly,
    // Documentation options from command-specific options
    referenceFolder: capturedState.commandOptions.referenceFolder,
  };

  // Build command args from captured state
  const args = {
    subCommand: capturedState.args.subCommand,
    propertyValue: capturedState.args.propertyValue,
    searchTerm: capturedState.args.searchTerm,
    annotationCategory: capturedState.args.annotationCategory,
    mode: capturedState.args.mode,
    type: capturedState.args.type,
    newName: capturedState.args.newName,
    description: capturedState.args.newDescription || capturedState.args.description,
    template: capturedState.args.template,
    creator: capturedState.args.creator,
  };

  try {
    const context = await CommandContextFactory.create(creatorTools, localEnv, taskType, rawOptions, args);
    await command.execute(context);
    if (context.exitCode !== undefined && context.exitCode !== 0) {
      errorLevel = context.exitCode;
    }
  } catch (e: any) {
    Log.error(`Error executing ${command.metadata.name}: ${e.message || e}`);
    errorLevel = ErrorCodes.INIT_ERROR;
  }
}

/**
 * Displays a compact styled header with version and paths.
 * Format: [##] mct v0.0.1  in (-i): <path>  out (-o): <path>
 * For edit-in-place commands, only shows the input path.
 * Uses a Minecraft-block-inspired ASCII art.
 */
function displayMctHeader(inputPath: string, outputPath: string, editInPlace: boolean = false) {
  const ver = `v${constants.version}`;
  // Compact block-style icon: [##] looks like a Minecraft grass block top
  const icon = `${CLR.green}[##]${CLR.reset}`;
  const name = `${CLR.bold}mct${CLR.reset}`;
  const version = `${CLR.dim}${ver}${CLR.reset}`;

  // Canonicalize paths for display
  const inPath = path.resolve(inputPath);
  const outPath = path.resolve(outputPath);

  // Compact format with colored labels (include CLI flag hints)
  const inLabel = `${CLR.cyan}in (-i):${CLR.reset}`;
  const outLabel = `${CLR.yellow}out (-o):${CLR.reset}`;

  if (editInPlace) {
    // For edit-in-place commands, only show input path
    Log.message(`${icon} ${name} ${version}  ${inLabel} ${CLR.dim}${inPath}${CLR.reset}`);
  } else {
    Log.message(
      `${icon} ${name} ${version}  ${inLabel} ${CLR.dim}${inPath}${CLR.reset}  ${outLabel} ${CLR.green}${outPath}${CLR.reset}`
    );
  }
}

// Exit codes unified to ErrorCodes enum (imported from ICommandContext).
// Legacy constants (44, 53, 56, 57) removed — all commands now use ErrorCodes.

const program = new Command();

let creatorTools: CreatorTools | undefined;
const projectStarts: (IProjectStartInfo | undefined)[] = [];
let localEnv: LocalEnvironment | undefined;
let errorLevel: number | undefined;

// Experimental SSL configuration variables - passed via command line only, not persisted
let experimentalSslCertPath: string | undefined;
let experimentalSslKeyPath: string | undefined;
let experimentalSslPfxPath: string | undefined;
let experimentalSslPfxPassphrase: string | undefined;
let experimentalSslCaPath: string | undefined;
let experimentalSslPort: number | undefined;
let experimentalSslOnly: boolean = false;

let sm: ServerManager | undefined;

const packageReferenceSets: IPackageReference[] = [];
const templateReferenceSets: IPackageReference[] = [];

for (let i = 0; i < process.argv.length; i++) {
  const str = process.argv[i]?.toLowerCase();

  if (str === "-debug" || str === "--debug") {
    Log.debug("Using debug mode.");
    Utilities.setIsDebug(true);
  }
}

program
  .name("mct")
  .description("Minecraft Creator Tools v" + constants.version)
  .version(constants.version, "-v, --version", "Output the current version")
  .option(
    "-i, --input-folder [path to folder]",
    "Path to the input folder. If not specified, the current working directory is used."
  )
  .option(
    "--if, --input-file [path to file]",
    "Path to the input MCWorld, MCTemplate, MCPack, MCAddon or other zip file."
  )
  .option(
    "-o, --output-folder <path to folder>",
    "Path to the output project folder. If not specified, the current working directory + 'out' is used.",
    "out"
  )
  .option(
    "--psw, --project-starts-with <starter term>",
    "Only process a project if it starts with the starter term; this can be used to subdivide processing."
  )
  .option(
    "--bp, --base-path <path to folder>",
    "Path, relative to the current working folder, where common data files and folders are found."
  )
  .option("--afs, --additional-files [path to file]", "Comma-separated list of additional files to add to projects.")
  .option("--of, --output-file [path to file]", "Path to the export file, if applicable for the command you are using.")
  .option("--ot, --output-type [output type]", "Type of output, if applicable for the command you are using.")
  .option("--updatepc, --update-passcode [update passcode]", "Sets update passcode.")
  .option("--adminpc, --admin-passcode [admin passcode]", "Sets admin passcode.")
  .option("--displaypc, --display-passcode [display passcode]", "Sets display passcode.")
  .option("--fullropc, --full-readonly-passcode [full read only passcode]", "Sets full read only passcode.")
  .option("-l, --launch", "Launches the final product in Minecraft when done.", false)
  .option("--ew, --ensure-world", "Ensures that a flat GameTest world is synchronized with the project.")
  .option("--isolated", "Do not load vanilla Minecraft resources (e.g., textures, ground blocks) from the web")
  .option(
    "--bpu, --behavior-pack <behavior pack uuid>",
    "Adds a set of behavior pack UUIDs as references for any worlds that are updated."
  )
  .option(
    "--rpu, --resource-pack <resource pack uuid>",
    "Adds a set of resources pack UUIDs as references for any worlds that are updated."
  )
  .option("--betaapis, --beta-apis", "Ensures that the Beta APIs experiment is set for any worlds that are updated.")
  .option("--no-betaapis, --no-beta-apis", "Removes the Beta APIs experiment if set.")
  .option("-f, --force", "Force any updates.")
  .option("--single", "When pointed at a folder via -i, force that folder to be processed as a single project.")
  .option("--editor", "Ensures that the world is an Editor world.")
  .option("--once", "When running as a server, only process one request and then shutdown.", false)
  .option("--no-editor", "Removes the editor setting from the world.")
  .option("--threads [thread count]", "Targeted number of threads to use.")
  .option("-n, --dry-run", "Show what would be done without making changes or writing files.")
  .option("-d, --debug", "Add debug logging, options, and even more experimental commands.")
  .option(
    "--mct, --mctemplate <path to a .mctemplate or a .zip world template>",
    "When using a world, uses a .mctemplate file for that world"
  )
  .option("--preview-server", "Specifies whether to use a preview server.")
  .option(
    "--pack, --mcpack <path to .mcpack, .mcaddon, or .zip pack>",
    "When using a world, uses and adds pack references for that world"
  )
  .option("--verbose", "Show verbose log messages.")
  .option("-q, --quiet", "Suppress non-essential output. Only show errors and final results.")
  .option("--warn-only", "Report validation errors as warnings without setting a failure exit code.")
  .option("--json", "Output results in JSON format for machine parsing.")
  .option(
    "--experimental-ssl-cert <path>",
    "(Experimental) Path to SSL certificate file in PEM format. Use with --experimental-ssl-key. " +
      "This enables HTTPS. Use EITHER cert+key OR --experimental-ssl-pfx, not both."
  )
  .option(
    "--experimental-ssl-key <path>",
    "(Experimental) Path to SSL private key file in PEM format. Required when using --experimental-ssl-cert. " +
      "Keep this file secure and never share it."
  )
  .option(
    "--experimental-ssl-pfx <path>",
    "(Experimental) Path to PKCS12/PFX certificate bundle containing both cert and key. " +
      "Common on Windows. Use EITHER pfx OR --experimental-ssl-cert + --experimental-ssl-key, not both."
  )
  .option(
    "--experimental-ssl-pfx-passphrase <passphrase>",
    "(Experimental) Passphrase to decrypt the PFX file. Required only if your PFX is password-protected."
  )
  .option(
    "--experimental-ssl-ca <path>",
    "(Experimental) Path to CA certificate chain file (PEM format). Needed when using certificates from " +
      "a Certificate Authority (e.g., Let's Encrypt, DigiCert) to provide the full trust chain. " +
      "Not needed for self-signed certificates."
  )
  .option(
    "--experimental-ssl-port <port>",
    "(Experimental) Port for HTTPS server. Defaults to 443. Use a port > 1024 to avoid requiring admin privileges."
  )
  .option(
    "--experimental-ssl-only",
    "(Experimental) Only start HTTPS server, do not start HTTP. Use this for production to ensure all traffic is encrypted."
  )
  .option(
    "--unsafe-skip-signature-validation",
    "UNSAFE: Skip digital signature verification of Bedrock Dedicated Server executable. " +
      "Only use this if you trust the server binary and understand the security implications."
  )
  .option(
    "--internalOnlyRunningInTheContextOfTestCommandLines",
    "Do not use. For internal self-testing use only functionality."
  );

if (Utilities.isDebug) {
  program
    .option(
      "--ssp, --source-server-path [path to folder]",
      "Source path to use for instances Bedrock Dedicated Server. You can download this from https://www.minecraft.net/download/server/bedrock.  If not specified, this tool will manage downloads of Minecraft Dedicated Server itself."
    )
    .option(
      "--dsp, --direct-server-path [path to folder]",
      "If specified, dedicated servers are run directly from a particular folder."
    )
    .option(
      "--difficulty [difficulty]",
      "For the world, a difficulty level. Options include peaceful, easy, normal, and hard",
      "peaceful"
    )
    .option(
      "--gametype [gametype]",
      "For the world, a game type. Options include survival, creative, and adventure.",
      "survival"
    )
    .option(
      "--generator [generator]",
      "For the world, a world generator type. Options old, infinite, and flat.",
      "infinite"
    )
    .option("--seed [seed]", "For the world, a random seed to use.")
    .option("--create", "For the world, will force the creation of a new world.")
    .option("--op, --operator <player ID>", "A list of player IDs to make operator when the server starts")
    .option("--cmd, --commands <command line>", "Commands to run, if running a dedicated server.", "out")
    .option("--gt, --gametest <gametest name>", "Game Test to run on the command line.");
}

program.addHelpText("before", "\x1b[32m┌─────┐\x1b[0m");
program.addHelpText("before", "\x1b[32m│ ▄ ▄ │\x1b[0m Minecraft Creator Tools (preview) command line");
program.addHelpText("before", "\x1b[32m│ ┏▀┓ │\x1b[0m See " + constants.homeUrl + " for more info.");
program.addHelpText("before", "\x1b[32m└─────┘\x1b[0m");
program.addHelpText("before", " ");

// --all-commands: display full command list including content-production tools
program.option("--all-commands", "Show all commands including content-production tools");

// Register all commands with the registry before configuring Commander
// This must be done before parsing so all commands are available
registerAllCommands();

// Handle --all-commands before configureCommander so we can show the full list
if (process.argv.includes("--all-commands")) {
  Log.message("\nAll commands (including content-production tools):");
  Log.message(commandRegistry.generateCategoryHelp(true));
  process.exit(0);
}

// Configure Commander.js with all registered commands from the CommandRegistry
// This replaces the legacy per-command registration that was previously here
// Each command's metadata.arguments and configure() method are used to set up
// the Commander command, and action handlers capture args to the registry
commandRegistry.configureCommander(program);

// Guard against running CLI initialization when imported during tests
// This checks if we're being run via mocha or other test runners
const isTestEnvironment =
  process.env.NODE_ENV === "test" ||
  process.argv.some((arg) => arg.includes("mocha") || arg.includes("jest") || arg.includes("vitest"));

if (isTestEnvironment) {
  // Don't run CLI when imported during tests - export for testing instead
  module.exports = { program, TaskType };
} else {
  program.parse(process.argv);
}

const options = isTestEnvironment ? {} : program.opts();

// Get the captured task type from the registry (set by command action handlers)
const capturedTaskType = commandRegistry.getCapturedState().taskType;

localEnv = new LocalEnvironment(true);

if (capturedTaskType === TaskType.mcp) {
  localEnv.logToStdError = true;
}

if (options.isolated) {
  CreatorToolsHost.contentWebRoot = "";
} else {
  CreatorToolsHost.contentWebRoot = "https://mctools.dev/";
}

if (options.threads) {
  try {
    const tc = parseInt(options.threads);
    if (!isNaN(tc) && tc > 0) {
      const cappedTc = Math.min(tc, 16);
      if (cappedTc === 1) {
        Log.message("Using sequential processing (threads=1).");
      } else {
        Log.message("Using " + cappedTc + " worker threads.");
      }
    }
  } catch (e) {
    Log.error("Could not process the threads parameter: " + e);
  }
}

if (options.dryRun) {
  localEnv.displayInfo = true;

  if (options.outputFolder === "out") {
    options.outputFolder = undefined;
  }
} else if (options.outputFolder === "out") {
  if (
    capturedTaskType !== TaskType.serve &&
    capturedTaskType !== TaskType.runDedicatedServer &&
    capturedTaskType !== TaskType.mcp &&
    capturedTaskType !== TaskType.renderVanilla
  ) {
    const isEditInPlace = ClUtils.getIsEditInPlaceCommand(capturedTaskType);
    displayMctHeader(options.inputFolder || process.cwd(), options.outputFolder, isEditInPlace);
  }

  localEnv.displayInfo = true;
}

if (options.verbose) {
  localEnv.displayVerbose = true;
}

// Parse experimental SSL options - these are passed via command line only, not persisted
experimentalSslCertPath = options.experimentalSslCert;
experimentalSslKeyPath = options.experimentalSslKey;
experimentalSslPfxPath = options.experimentalSslPfx;
experimentalSslPfxPassphrase = options.experimentalSslPfxPassphrase;
experimentalSslCaPath = options.experimentalSslCa;
experimentalSslOnly = options.experimentalSslOnly === true;

if (options.experimentalSslPort) {
  const parsedPort = parseInt(options.experimentalSslPort, 10);
  if (!isNaN(parsedPort) && parsedPort > 0 && parsedPort <= 65535) {
    experimentalSslPort = parsedPort;
  } else {
    Log.error(`Invalid --experimental-ssl-port value: ${options.experimentalSslPort}. Must be a valid port number.`);
    errorLevel = 1;
  }
}

// Build experimental SSL config if any SSL options are provided
if (!errorLevel && (experimentalSslCertPath || experimentalSslPfxPath)) {
  // Validate required combinations
  if (experimentalSslCertPath && !experimentalSslKeyPath) {
    Log.error("--experimental-ssl-cert requires --experimental-ssl-key to be specified.");
    errorLevel = 1;
  }
  if (!errorLevel && experimentalSslKeyPath && !experimentalSslCertPath) {
    Log.error("--experimental-ssl-key requires --experimental-ssl-cert to be specified.");
    errorLevel = 1;
  }

  if (!errorLevel) {
    const sslConfig: ISslConfig = {
      certPath: experimentalSslCertPath,
      keyPath: experimentalSslKeyPath,
      pfxPath: experimentalSslPfxPath,
      pfxPassphrase: experimentalSslPfxPassphrase,
      caPath: experimentalSslCaPath,
      port: experimentalSslPort ?? 443,
      httpsOnly: experimentalSslOnly,
    };

    localEnv.sslConfig = sslConfig;
    Log.message("(EXPERIMENTAL) SSL/HTTPS support enabled. This feature is experimental.");
  }
}

// Only run the CLI main function if not in a test environment
if (!isTestEnvironment && !errorLevel) {
  (async () => {
    // Note: registerAllCommands() was already called before configureCommander()
    // to ensure all commands are available for registration with Commander.js

    creatorTools = ClUtils.getCreatorTools(localEnv, options.basePath);

    if (!creatorTools) {
      Log.fail("Failed to initialize Creator Tools");
      errorLevel = 1;
      return;
    }

    sm = new ServerManager(localEnv, creatorTools);
    sm.runOnce = options.once;

    await creatorTools.load();

    creatorTools.onStatusAdded.subscribe(ClUtils.handleStatusAdded);

    await loadPacks();
    await loadProjects();

    // Set passcodes if provided via command line
    if (options.displayPasscode || options.updatePasscode || options.adminPasscode || options.fullReadOnlyPasscode) {
      await setPasscode(
        options.displayPasscode,
        options.fullReadOnlyPasscode,
        options.updatePasscode,
        options.adminPasscode
      );
    }

    // For long-running server commands, set up stdin handling for interactive control
    // But NOT when in runOnce mode (used for automated testing) since there's no interactive input
    const isLongRunningCommand =
      capturedTaskType === TaskType.runDedicatedServer ||
      capturedTaskType === TaskType.serve ||
      capturedTaskType === TaskType.view ||
      capturedTaskType === TaskType.edit;

    if (isLongRunningCommand && !options.once) {
      hookInput();
    }

    // Execute via the modular command registry
    await executeViaRegistry(options);

    // Exit unless this is a long-running server command (those handle their own lifecycle)
    if (!isLongRunningCommand) {
      await doExit();
    }
  })();
} // end if (!isTestEnvironment)

// ============================================================================
// UTILITY FUNCTIONS
// Functions below are used by the main IIFE or by modular command implementations
// Legacy command implementations have been moved to src/cli/commands/
// ============================================================================

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

  const workFolder = await ClUtils.getMainWorkFolder(capturedTaskType, options.inputFolder, options.outputFolder);

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
      Log.message("Working across subfolders with projects at '" + workFolder.fullPath + "'");

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
        Log.message("Working across subfolders/packages at '" + workFolder.fullPath + "'");

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

function hookInput() {
  process.stdin.setEncoding("utf-8");

  process.stdin.on("data", async function (data: string) {
    try {
      if (data.startsWith("exit") || data.startsWith("stop")) {
        await doExit();
      } else if (sm && sm.primaryActiveServer) {
        const command = data.trim();

        if (command.length > 4) {
          sm.primaryActiveServer.writeToServer(command);
        }
      }
    } catch (err) {
      Log.debug("Error during exit: " + err);
      process.exit(1);
    }
  });
}

// setPasscode is called from main IIFE - keep this utility
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
    localEnv.setAdminPasscodeAndRandomizeComplement(adminPasscode);
  }

  if (displayReadOnlyPasscode) {
    localEnv.setDisplayReadOnlyPasscodeAndRandomizeComplement(displayReadOnlyPasscode);
  }

  if (fullReadOnlyPasscode) {
    localEnv.setFullReadOnlyPasscodeAndRandomizeComplement(fullReadOnlyPasscode);
  }

  if (updateStatePasscode) {
    localEnv.setUpdateStatePasscodeAndRandomizeComplement(updateStatePasscode);
  }

  await localEnv.save();
}

// doExit is called from main IIFE - keep this utility
async function stop() {
  await sm?.stopAllDedicatedServers();
}

async function doExit() {
  await stop();

  if (errorLevel !== undefined) {
    process.exit(errorLevel);
  }
}

// ============================================================================
// LOADPACKS - needed by main IIFE
// ============================================================================

async function loadPacks() {
  if (!creatorTools) {
    return;
  }
  /*
  if (options.mctemplate) {
    const file = await getFileFromRelaPath(options.mctemplate);

    const pack = await carto.ensurePackForFile(file);

    templateReferenceSets.push(pack.createReference());
  }

  if (options.mcpack) {
    const file = await getFileFromPath(options.mcpack);

    const pack = await carto.ensurePackForFile(file);

    packageReferenceSets.push(pack.createReference());
  }*/
}

// ============================================================================
// END OF FILE - Legacy functions have been moved to modular command files
// ============================================================================
