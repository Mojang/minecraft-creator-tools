/**
 * CommandContextFactory - Creates fully-hydrated ICommandContext from CLI options
 *
 * ARCHITECTURE DOCUMENTATION
 * ==========================
 *
 * This factory is the central point for:
 * 1. Parsing Commander.js options into typed structures
 * 2. Detecting and loading projects (moved from loadProjects() in index.ts)
 * 3. Setting up storage abstractions
 * 4. Creating worker pools
 * 5. Configuring logging
 *
 * ENTRY POINT:
 * CommandContextFactory.create() is called from index.ts after Commander.js
 * parses the command line. It returns a fully-hydrated ICommandContext that
 * commands use to access projects, storage, logging, and worker pools.
 *
 * KEY METHODS:
 * - create(): Main entry point, orchestrates all setup
 * - loadProjects(): Detects and loads projects from input path
 * - parseThreads(): Converts thread option to number
 * - parseOutputType(): Converts output type string to enum
 * - resolveSuite(): Converts suite string to ProjectInfoSuite enum
 *
 * PROJECT DETECTION LOGIC:
 * The project detection supports several modes:
 *
 * 1. Single File Mode (-f, --file):
 *    - Input is a single file (e.g., .mcaddon, .mcpack, .zip)
 *    - Creates one project from that file
 *
 * 2. Multi-Level Multi-Project:
 *    - Root folder contains subfolders
 *    - Each subfolder contains .zip/.mcaddon files + optional .data.json
 *    - Each zip becomes a separate project
 *
 * 3. Children-of-Folder Multi-Project:
 *    - Root folder contains zip files directly OR subfolders that are projects
 *    - Subfolders with manifest.json, behavior_packs/, etc. are detected
 *
 * 4. Single Project (fallback):
 *    - Treat the entire input folder as one project
 *
 * STORAGE SETUP:
 * - inputStorage: NodeStorage pointing to input folder (read-only for non-edit commands)
 * - outputStorage: NodeStorage pointing to output folder (or same as input)
 * - Additional storage for Minecraft paths, deployment, etc.
 *
 * WORKER POOL:
 * - Created via createWorkerPool() from WorkerPool.ts
 * - Supports parallel execution with configurable thread count
 * - Falls back to single-threaded mode when threads=1
 *
 * LOGGING:
 * - Created via createLogger() from Logger.ts
 * - Supports verbose, quiet, and debug modes
 * - ConsoleLogger for normal output, SilentLogger for testing
 *
 * KEY FILES:
 * - ICommandContext.ts: Interface definitions
 * - WorkerPool.ts: Parallel execution
 * - Logger.ts: Logging implementation
 * - ClUtils.ts: Legacy utilities (being migrated)
 */

import path from "path";
import fs from "fs";
import Project, { ProjectAutoDeploymentMode } from "../../app/Project";
import CreatorTools from "../../app/CreatorTools";
import LocalEnvironment from "../../local/LocalEnvironment";
import NodeStorage from "../../local/NodeStorage";
import IFolder from "../../storage/IFolder";
import StorageUtilities from "../../storage/StorageUtilities";
import MinecraftUtilities from "../../minecraft/MinecraftUtilities";
import IProjectStartInfo from "../IProjectStartInfo";
import ClUtils, { OutputType, TaskType } from "../ClUtils";
import {
  ICommandContext,
  ILogger,
  IServerOptions,
  IWorldOptions,
  IValidationOptions,
  ErrorCodes,
} from "./ICommandContext";
import { createWorkerPool } from "./WorkerPool";
import { createLogger } from "./Logger";
import Log from "../../core/Log";

/**
 * Raw options as parsed by Commander.js.
 * This interface captures all the global options.
 */
export interface IRawOptions {
  // Input/Output
  inputFolder?: string;
  outputFolder?: string;
  outputFile?: string;
  inputFile?: string;
  additionalFiles?: string;
  basePath?: string;

  // Execution
  threads?: string;
  single?: boolean;
  force?: boolean;
  debug?: boolean;

  // Output control
  verbose?: boolean;
  quiet?: boolean;
  json?: boolean;
  yes?: boolean;
  dryRun?: boolean;

  // Output
  outputType?: string;

  // Server
  port?: string;
  httpsPort?: string;
  slot?: string;
  adminpc?: string;
  updatepc?: string;
  displaypc?: string;
  fullpc?: string;
  title?: string;
  domain?: string;
  motd?: string;
  runOnce?: boolean;
  timeout?: string;
  forceInk?: boolean;
  mcpRequireAuth?: boolean;
  logFile?: string;
  features?: string;

  // SSL (experimental)
  experimentalSslCert?: string;
  experimentalSslKey?: string;
  experimentalSslPfx?: string;
  experimentalSslPfxPassphrase?: string;
  experimentalSslCa?: string;
  experimentalSslPort?: string;
  experimentalSslOnly?: boolean;

  // World
  betaApis?: boolean;
  editor?: boolean;
  difficulty?: string;
  gameMode?: string;
  worldName?: string;
  seed?: string;
  ensureWorld?: boolean;
  testWorld?: boolean;
  launch?: boolean;

  // Validation
  suite?: string;
  exclusions?: string;
  aggregateReports?: string;
  warnOnly?: boolean;

  // Filtering
  projectStartsWith?: string;

  // Misc
  isolated?: boolean;

  // Documentation
  referenceFolder?: string;

  /** Raw command-specific options forwarded from Commander (escape hatch for per-command flags). */
  commandOptions?: Record<string, any>;
}

/**
 * Command-specific arguments parsed from Commander.js.
 */
export interface ICommandArgs {
  subCommand?: string;
  propertyValue?: string;
  searchTerm?: string;
  mode?: string;
  type?: string;
  newName?: string;
  description?: string;
}

/**
 * Factory for creating ICommandContext instances.
 */
export class CommandContextFactory {
  /** Folder names that indicate a Minecraft project root. */
  static readonly PROJECT_INDICATOR_FOLDERS = [
    "behavior_packs",
    "behavior_pack",
    "development_behavior_packs",
    "resource_packs",
    "resource_pack",
    "development_resource_packs",
  ];

  /** Maximum number of parent levels to walk when auto-discovering a project root. */
  static readonly MAX_DISCOVERY_LEVELS = 8;

  /**
   * Walk up from `startDir` to find the nearest Minecraft project root.
   *
   * A folder qualifies as a project root if it contains:
   * - A `package.json` file, OR
   * - A child folder matching one of the Minecraft pack folder conventions
   *   (behavior_packs, resource_packs, etc.)
   *
   * The search stops when:
   * - A qualifying folder is found (returned immediately)
   * - MAX_DISCOVERY_LEVELS parent directories have been checked
   * - The folder is at a "second-order root" — its parent is a filesystem
   *   root (e.g. `C:\projects` on Windows, `/home` on Unix), to avoid
   *   scanning broad top-level directories
   * - The filesystem root is reached
   *
   * If no qualifying folder is found, `startDir` is returned unchanged
   * (preserving the current cwd-fallback behavior).
   */
  static resolveProjectRoot(startDir: string, log?: ILogger): string {
    let current = path.resolve(startDir);

    for (let level = 0; level <= CommandContextFactory.MAX_DISCOVERY_LEVELS; level++) {
      // Second-order root boundary: stop if the parent of `current` is a
      // filesystem root.  This prevents considering folders like C:\projects\
      // or /home/ which are too broad to be a project root.
      const parent = path.dirname(current);

      if (level > 0 && parent === path.dirname(parent)) {
        // `parent` is a filesystem root (e.g. C:\ or /), so `current` is a
        // top-level directory — too high to be a project.
        break;
      }

      if (CommandContextFactory.isProjectRoot(current)) {
        if (level > 0) {
          log?.verbose(`Auto-discovered project root: ${current}`);
        }
        return current;
      }

      // Move to parent directory
      if (parent === current) {
        // Reached filesystem root
        break;
      }

      current = parent;
    }

    return startDir;
  }

  /**
   * Check whether a directory looks like a Minecraft project root.
   *
   * Returns true if the directory contains a `package.json` file or any
   * of the standard Minecraft pack folder names.
   */
  static isProjectRoot(dir: string): boolean {
    try {
      if (fs.existsSync(path.join(dir, "package.json"))) {
        return true;
      }

      for (const folderName of CommandContextFactory.PROJECT_INDICATOR_FOLDERS) {
        const candidate = path.join(dir, folderName);

        try {
          if (fs.statSync(candidate).isDirectory()) {
            return true;
          }
        } catch {
          // Folder doesn't exist — continue
        }
      }
    } catch (err) {
      // Permission error or similar — can't read this directory
      Log.debug(`isProjectRoot: could not inspect '${dir}': ${err}`);
    }

    return false;
  }

  /**
   * Create a fully-hydrated command context.
   *
   * @param creatorTools Initialized CreatorTools instance
   * @param localEnv Initialized LocalEnvironment
   * @param taskType The command being executed
   * @param options Raw options from Commander.js
   * @param args Command-specific arguments
   */
  static async create(
    creatorTools: CreatorTools,
    localEnv: LocalEnvironment,
    taskType: TaskType,
    options: IRawOptions,
    args: ICommandArgs = {}
  ): Promise<ICommandContext> {
    // Parse numeric and boolean options
    const threads = CommandContextFactory.parseThreads(options.threads);
    const force = options.force ?? false;
    const isolated = options.isolated ?? false;
    const debug = options.debug ?? false;
    const verbose = options.verbose ?? false;
    const quiet = options.quiet ?? false;
    const json = options.json ?? false;
    // Implicit --yes: when --json is set, the caller is non-interactive (CI / MCP).
    // Treat it as if --yes was also supplied so commands skip prompts and use defaults.
    const yes = options.yes ?? json;
    const dryRun = options.dryRun ?? false;

    // Parse output type - if --json flag is set, use json output type
    const outputType = json ? OutputType.json : CommandContextFactory.parseOutputType(options.outputType);

    // Create logger (quiet mode suppresses non-essential output, json mode routes non-data to stderr)
    const log = createLogger(verbose, quiet, debug, false, json);

    // Resolve input/output folders to absolute paths
    // When -i is not specified, auto-discover the nearest project root by
    // walking up from cwd (checks for package.json or *_packs folders).
    let inputFolderAutoDiscovered = false;
    let rawInputFolder: string;

    if (options.inputFolder) {
      rawInputFolder = options.inputFolder;
    } else {
      const cwd = process.cwd();
      const discovered = CommandContextFactory.resolveProjectRoot(cwd, log);
      rawInputFolder = discovered;
      inputFolderAutoDiscovered = discovered !== cwd;
    }

    const inputFolder = path.isAbsolute(rawInputFolder) ? rawInputFolder : path.resolve(process.cwd(), rawInputFolder);

    const rawOutputFolder = options.outputFolder || rawInputFolder;
    const outputFolder = path.isAbsolute(rawOutputFolder)
      ? rawOutputFolder
      : path.resolve(process.cwd(), rawOutputFolder);

    // Create storage instances
    const inputStorage = new NodeStorage(inputFolder, "");
    inputStorage.readOnly = !ClUtils.getIsEditInPlaceCommand(taskType);

    const outputStorage = new NodeStorage(outputFolder, "");

    // Get work folders
    const inputWorkFolder = await CommandContextFactory.getWorkFolder(
      inputStorage.rootFolder,
      taskType,
      options.inputFolder,
      options.outputFolder,
      false // isOutputFolder
    );

    // For commands with a separate output folder, ensure the output folder exists
    // This applies to validate, write commands, and any command with explicit -o flag
    const shouldCreateOutputFolder = outputFolder !== inputFolder && options.outputFolder !== undefined;

    const outputWorkFolder =
      outputFolder === inputFolder
        ? inputWorkFolder
        : await CommandContextFactory.getWorkFolder(
            outputStorage.rootFolder,
            taskType,
            options.inputFolder,
            options.outputFolder,
            shouldCreateOutputFolder // isOutputFolder - will create if needed
          );

    // Detect and load projects
    // For isEditInPlace commands (like 'add') where only -o is specified (no -i),
    // we should detect/create projects in the output folder, not the current directory
    const isEditInPlace = ClUtils.getIsEditInPlaceCommand(taskType);
    const onlyOutputSpecified = !options.inputFolder && options.outputFolder !== undefined;
    const projectDetectionFolder = isEditInPlace && onlyOutputSpecified ? outputWorkFolder : inputWorkFolder;

    const projectStarts = await CommandContextFactory.detectProjects(
      creatorTools,
      taskType,
      options,
      projectDetectionFolder,
      log
    );

    if (projectStarts.length === 0) {
      Log.debug("No Minecraft projects detected in " + projectDetectionFolder.fullPath);
    }

    // Hydrate projects
    const projects = CommandContextFactory.hydrateProjects(creatorTools, projectStarts);

    // Create worker pool
    // Note: For now we create a placeholder pool. Commands will use the pool
    // which internally creates workers with the TaskWorker.js script.
    const workerPool = createWorkerPool(threads);

    // Parse server options
    const server = CommandContextFactory.parseServerOptions(options);

    // Parse world options
    const world = CommandContextFactory.parseWorldOptions(options);

    // Parse validation options
    const validation = CommandContextFactory.parseValidationOptions(options);

    // Build the context
    let exitCode = 0;

    const context: ICommandContext = {
      // Core
      creatorTools,
      localEnv,
      workerPool,
      log,

      // Projects
      projects,
      projectCount: projects.length,
      isSingleProject: projects.length === 1,

      // Input/Output
      inputFolder,
      inputFolderSpecified: options.inputFolder !== undefined,
      inputFolderAutoDiscovered,
      outputFolder,
      outputFile: options.outputFile,
      inputStorage,
      outputStorage,
      inputWorkFolder,
      outputWorkFolder,

      // Global options
      threads,
      force,
      isolated,
      debug,
      verbose,
      quiet,
      json,
      yes,
      dryRun,
      outputType,
      taskType,

      // Command args
      subCommand: args.subCommand,
      propertyValue: args.propertyValue,
      searchTerm: args.searchTerm,
      mode: args.mode,
      type: args.type,
      newName: args.newName,
      description: args.description,
      projectStartsWith: options.projectStartsWith,
      referenceFolder: options.referenceFolder,
      commandOptions: options.commandOptions || {},

      // Grouped options
      server,
      world,
      validation,

      // Exit state
      exitCode,
      setExitCode(code: number): void {
        if (code > exitCode) {
          exitCode = code;
          context.exitCode = code;
        }
      },

      // Utility method
      async forEachProject(fn: (project: Project, index: number) => Promise<void>, label?: string): Promise<void> {
        for (let i = 0; i < projects.length; i++) {
          const project = projects[i];
          try {
            if (projects.length > 1) {
              log.info(`${label || "Processing"} project ${i + 1}/${projects.length}: ${project.name}`);
            }
            await fn(project, i);
          } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            log.error(`Error with project ${project.name}: ${message}`);
            context.setExitCode(ErrorCodes.INIT_ERROR);
          }
        }
      },
    };

    return context;
  }

  /**
   * Parse threads option.
   */
  private static parseThreads(threadsStr?: string): number {
    if (!threadsStr) {
      return 1;
    }
    const parsed = parseInt(threadsStr, 10);
    if (isNaN(parsed) || parsed < 1) {
      return 1;
    }
    return Math.min(parsed, 8); // Cap at 8 threads
  }

  /**
   * Parse output type option.
   */
  private static parseOutputType(outputTypeStr?: string): OutputType {
    if (outputTypeStr === "noreports") {
      return OutputType.noReports;
    }
    return OutputType.normal;
  }

  /**
   * Get work folder, creating if needed for write commands.
   */
  private static async getWorkFolder(
    folder: IFolder,
    taskType: TaskType,
    inputFolder?: string,
    outputFolder?: string,
    shouldCreateIfMissing: boolean = false
  ): Promise<IFolder> {
    // Create folder if:
    // 1. shouldCreateIfMissing flag is set (for output folders of write commands)
    // 2. OR legacy behavior: no inputFolder but outputFolder exists and it's a write command
    if (shouldCreateIfMissing || (!inputFolder && outputFolder && ClUtils.getIsWriteCommand(taskType))) {
      await folder.ensureExists();
    }

    const exists = await folder.exists();
    if (!exists) {
      throw new Error(`Folder does not exist: ${folder.fullPath}`);
    }

    await folder.load();
    return folder;
  }

  /**
   * Detect projects in the input folder/file.
   *
   * This is the core project detection logic migrated from loadProjects() in index.ts.
   */
  private static async detectProjects(
    creatorTools: CreatorTools,
    taskType: TaskType,
    options: IRawOptions,
    workFolder: IFolder,
    log: ILogger
  ): Promise<IProjectStartInfo[]> {
    const projectStarts: IProjectStartInfo[] = [];
    const psw = options.projectStartsWith?.toLowerCase();
    const additionalFiles = CommandContextFactory.parseAdditionalFiles(options.additionalFiles);

    // -------------------------------------------------------------------------
    // Single file mode
    // -------------------------------------------------------------------------
    if (options.inputFile) {
      if (options.inputFolder) {
        throw new Error("Cannot specify both an input file and an input folder.");
      }

      const inputFolderPath = StorageUtilities.getFolderPath(options.inputFile);
      const inputFileName = StorageUtilities.getLeafName(options.inputFile);

      if (!inputFileName || inputFileName.length < 2 || !inputFolderPath || inputFolderPath.length < 2) {
        throw new Error(`Could not process file with path: '${options.inputFile}'`);
      }

      if (!creatorTools.ensureLocalFolder) {
        throw new Error("CreatorTools.ensureLocalFolder is not configured");
      }

      const containingFolder = creatorTools.ensureLocalFolder(inputFolderPath);
      containingFolder.storage.readOnly = true;

      const file = containingFolder.ensureFile(inputFileName);
      const fileExists = await file.exists();

      if (!fileExists) {
        throw new Error(`Could not find file with path: '${options.inputFile}'`);
      }

      projectStarts.push({
        ctorProjectName: inputFileName,
        localFilePath: options.inputFile,
        accessoryFiles: additionalFiles,
      });

      return projectStarts;
    }

    // -------------------------------------------------------------------------
    // Folder-based detection
    // -------------------------------------------------------------------------
    const name = StorageUtilities.getLeafName(workFolder.fullPath);

    // Check for --single flag
    if (options.single) {
      projectStarts.push({
        ctorProjectName: name,
        localFolderPath: workFolder.fullPath,
        accessoryFiles: additionalFiles,
      });
      return projectStarts;
    }

    // Try multi-level multi-project detection
    const multiLevelProjects = await CommandContextFactory.detectMultiLevelProjects(
      workFolder,
      additionalFiles,
      psw,
      log
    );

    if (multiLevelProjects.length > 0) {
      return multiLevelProjects;
    }

    // Try children-of-folder multi-project detection
    const childrenProjects = await CommandContextFactory.detectChildrenProjects(workFolder, additionalFiles, psw, log);

    if (childrenProjects.length > 0) {
      return childrenProjects;
    }

    // Fallback: treat as single project
    projectStarts.push({
      ctorProjectName: name,
      localFolderPath: workFolder.fullPath,
      accessoryFiles: additionalFiles,
    });

    return projectStarts;
  }

  /**
   * Detect multi-level multi-project layout.
   *
   * Structure:
   * root/
   *   subfolder1/
   *     project1.zip
   *     project1.data.json
   *   subfolder2/
   *     project2.mcaddon
   */
  private static async detectMultiLevelProjects(
    workFolder: IFolder,
    additionalFiles: string[],
    psw?: string,
    log?: ILogger
  ): Promise<IProjectStartInfo[]> {
    const projectStarts: IProjectStartInfo[] = [];

    // Root folder must have no non-storage files
    if (workFolder.fileCount > 0) {
      for (const subFileName in workFolder.files) {
        const file = workFolder.files[subFileName];
        if (file && !StorageUtilities.isFileStorageItem(file) && !file.fullPath.endsWith(".mci.json.zip")) {
          return []; // Not multi-level
        }
      }
    }

    let storageItemCount = 0;

    // Check subfolders for storage items
    for (const subFolderName in workFolder.folders) {
      const subFolder = workFolder.folders[subFolderName];
      if (!subFolder) continue;

      await subFolder.load();

      for (const subFileName in subFolder.files) {
        const subFile = subFolder.files[subFileName];
        if (!subFile) continue;

        if (StorageUtilities.isFileStorageItem(subFile) && !subFile.fullPath.endsWith(".mci.json.zip")) {
          storageItemCount++;
        }

        const typeFromName = StorageUtilities.getTypeFromName(subFileName);
        if (
          !StorageUtilities.isFileStorageItem(subFile) &&
          !subFile.fullPath.endsWith(".mci.json.zip") &&
          typeFromName !== "json" &&
          typeFromName !== "csv" &&
          typeFromName !== "" &&
          typeFromName !== "html"
        ) {
          return []; // Not multi-level
        }
      }
    }

    if (storageItemCount < 2) {
      return [];
    }

    log?.verbose(`Working across subfolders with projects at '${workFolder.fullPath}'`);

    // Collect projects from subfolders
    for (const subFolderName in workFolder.folders) {
      const subFolder = workFolder.folders[subFolderName];
      if (!subFolder || subFolder.errorStatus) continue;

      await subFolder.load();

      for (const fileName in subFolder.files) {
        const file = subFolder.files[fileName];
        if (!file || !StorageUtilities.isFileStorageItem(file) || file.fullPath.endsWith(".mci.json.zip")) {
          continue;
        }

        const ps: IProjectStartInfo = {
          ctorProjectName: file.name,
          accessoryFiles: [...additionalFiles],
        };

        // Look for associated .data.json files
        let baseName = StorageUtilities.getBaseFromName(file.name);
        if (subFolder.files[baseName + ".data.json"]) {
          ps.accessoryFiles?.push(baseName + ".data.json");
        }

        const lastDash = baseName.lastIndexOf("-");
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

    return projectStarts;
  }

  /**
   * Detect children-of-folder multi-project layout.
   *
   * Structure:
   * root/
   *   project1.mcaddon
   *   project2.zip
   *   project3/
   *     manifest.json
   *     ...
   */
  private static async detectChildrenProjects(
    workFolder: IFolder,
    additionalFiles: string[],
    psw?: string,
    log?: ILogger
  ): Promise<IProjectStartInfo[]> {
    const projectStarts: IProjectStartInfo[] = [];
    let isChildrenOfFolderMultiProject = true;
    let foundASubProject = false;

    // Check files in root
    for (const fileName in workFolder.files) {
      const file = workFolder.files[fileName];
      if (!file) continue;

      if (!StorageUtilities.isFileStorageItem(file)) {
        isChildrenOfFolderMultiProject = false;
        continue;
      } else {
        foundASubProject = true;
      }
    }

    // Check folders for pack-like names
    for (const folderName in workFolder.folders) {
      if (
        MinecraftUtilities.pathLooksLikePackName(folderName) ||
        MinecraftUtilities.pathLooksLikePackContainerName(folderName)
      ) {
        isChildrenOfFolderMultiProject = false;
        continue;
      }
    }

    if (!isChildrenOfFolderMultiProject) {
      return [];
    }

    // Check subfolders for project markers
    for (const folderName in workFolder.folders) {
      const folder = workFolder.folders[folderName];
      if (!folder || folder.errorStatus) continue;

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

    // Must have found a sub-project AND not have internal folder markers
    if (!foundASubProject || !isChildrenOfFolderMultiProject) {
      return [];
    }

    log?.verbose(`Working across subfolders/packages at '${workFolder.fullPath}'`);

    // Collect file-based projects
    for (const fileName in workFolder.files) {
      const file = workFolder.files[fileName];
      if (!file || !StorageUtilities.isFileStorageItem(file) || file.fullPath.endsWith(".mci.json.zip")) {
        continue;
      }

      if (!psw || file.name.toLowerCase().startsWith(psw)) {
        projectStarts.push({
          ctorProjectName: file.name,
          localFilePath: file.fullPath,
          accessoryFiles: [...additionalFiles],
        });
      }
    }

    // Collect folder-based projects
    for (const folderName in workFolder.folders) {
      const folder = workFolder.folders[folderName];
      if (!folder || folder.errorStatus || folder.name === "out") continue;

      await folder.load();

      if (folder.folderCount > 0) {
        if (!psw || folder.name.toLowerCase().startsWith(psw)) {
          projectStarts.push({
            ctorProjectName: folder.name,
            localFolderPath: folder.fullPath,
            accessoryFiles: [...additionalFiles],
          });
        }
      }
    }

    return projectStarts;
  }

  /**
   * Hydrate project start infos into full Project instances.
   */
  private static hydrateProjects(creatorTools: CreatorTools, projectStarts: IProjectStartInfo[]): Project[] {
    return projectStarts.map((ps) => {
      const project = new Project(creatorTools, ps.ctorProjectName, null);

      if (ps.localFilePath) {
        project.localFilePath = ps.localFilePath;
      }

      if (ps.localFolderPath) {
        project.localFolderPath = ps.localFolderPath;
      }

      if (ps.accessoryFiles) {
        project.accessoryFilePaths = ps.accessoryFiles;
      }

      project.autoDeploymentMode = ProjectAutoDeploymentMode.noAutoDeployment;

      return project;
    });
  }

  /**
   * Parse additional files option.
   */
  private static parseAdditionalFiles(additionalFilesStr?: string): string[] {
    if (!additionalFilesStr) {
      return [];
    }
    return additionalFilesStr.split(",").map((p) => p.trim());
  }

  /**
   * Parse a port string into a valid port number, falling back to a default.
   */
  static parsePort(portStr: string | undefined, defaultPort: number): number {
    const portNum = parseInt(portStr || String(defaultPort), 10);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      Log.debug("Invalid port number: " + portStr + ", using default " + defaultPort);
      return defaultPort;
    }
    return portNum;
  }

  /**
   * Parse server-related options.
   */
  private static parseServerOptions(options: IRawOptions): IServerOptions {
    return {
      port: CommandContextFactory.parsePort(options.port, 6126),
      httpsPort: options.httpsPort ? CommandContextFactory.parsePort(options.httpsPort, 443) : undefined,
      slot: options.slot ? Math.max(0, parseInt(options.slot, 10) || 0) : undefined,
      displayReadOnlyPasscode: options.displaypc,
      fullReadOnlyPasscode: options.fullpc,
      updateStatePasscode: options.updatepc,
      adminPasscode: options.adminpc,
      title: options.title,
      domainName: options.domain ? options.domain.trim().substring(0, 253) : undefined,
      messageOfTheDay: options.motd ? options.motd.substring(0, 256) : undefined,
      runOnce: options.runOnce ?? false,
      timeout: options.timeout ? parseInt(options.timeout, 10) : undefined,
      forceInk: options.forceInk ?? false,
      mcpRequireAuth: options.mcpRequireAuth ?? false,
      logFile: options.logFile,
      features: options.features,
      ssl:
        options.experimentalSslCert || options.experimentalSslPfx
          ? {
              certPath: options.experimentalSslCert,
              keyPath: options.experimentalSslKey,
              pfxPath: options.experimentalSslPfx,
              pfxPassphrase: options.experimentalSslPfxPassphrase,
              caPath: options.experimentalSslCa,
              port: CommandContextFactory.parsePort(options.experimentalSslPort, 443),
              httpsOnly: options.experimentalSslOnly ?? false,
            }
          : undefined,
    };
  }

  /**
   * Parse world-related options.
   */
  private static parseWorldOptions(options: IRawOptions): IWorldOptions {
    return {
      betaApis: options.betaApis ?? false,
      editor: options.editor ?? false,
      difficulty: options.difficulty,
      gameMode: options.gameMode,
      name: options.worldName,
      seed: options.seed,
      ensureWorld: options.ensureWorld ?? false,
      testWorld: options.testWorld ?? false,
      launch: options.launch ?? false,
    };
  }

  /**
   * Parse validation-specific options.
   */
  private static parseValidationOptions(options: IRawOptions): IValidationOptions {
    // Pass suite as string - TaskWorker will convert to ProjectInfoSuite
    const validSuites = ["all", "default", "addon", "currentplatform", "main"];
    const rawSuite = options.suite || "main";
    if (rawSuite && !validSuites.includes(rawSuite)) {
      Log.message(
        "Unknown validation suite '" + rawSuite + "'. Valid suites: " + validSuites.join(", ") + ". Using 'main'."
      );
    }

    // Handle shell comma-splitting: PowerShell treats "A,B" as two separate args,
    // so "PATHLENGTH,PACKSIZE" becomes exclusions="PATHLENGTH", aggregateReports="PACKSIZE".
    // Detect non-aggregate values in aggregateReports and merge them back into exclusions.
    const validAggregateValues = ["aggregatenoindex", "aggregate", "true", "false", "1", "0"];
    let exclusions = options.exclusions;
    let rawAggregate = options.aggregateReports;

    if (rawAggregate && !validAggregateValues.includes(rawAggregate)) {
      exclusions = exclusions ? exclusions + "," + rawAggregate : rawAggregate;
      rawAggregate = undefined;
    }

    const isAggregate =
      rawAggregate === "aggregate" ||
      rawAggregate === "aggregatenoindex" ||
      rawAggregate === "true" ||
      rawAggregate === "1";

    return {
      suite: validSuites.includes(rawSuite) ? rawSuite : "main",
      exclusionList: exclusions,
      outputMci: false,
      aggregateReports: isAggregate,
      warnOnly: options.warnOnly ?? false,
    };
  }
}
