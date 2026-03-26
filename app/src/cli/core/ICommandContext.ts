/**
 * ICommandContext - Core interface for CLI command execution context
 *
 * This interface provides a centralized, fully-hydrated context that commands
 * receive when executed. Commands should NOT parse arguments or detect projects
 * themselves - all that logic is handled by CommandContextFactory before commands run.
 *
 * Key Design Principles:
 * - Commands receive hydrated Project[] array, never raw paths
 * - All global options are parsed and typed
 * - Worker pool abstraction for parallelization
 * - Unified logging interface
 * - Storage abstractions for input/output
 *
 * @see CommandContextFactory.ts for context creation
 * @see ICommand.ts for command interface
 */

import Project from "../../app/Project";
import CreatorTools from "../../app/CreatorTools";
import LocalEnvironment from "../../local/LocalEnvironment";
import IStorage from "../../storage/IStorage";
import IFolder from "../../storage/IFolder";
import { OutputType, TaskType } from "../ClUtils";

// ============================================================================
// LOGGING INTERFACE
// ============================================================================

/**
 * ILogger provides a unified logging interface for commands.
 * Implementations can route to console, file, or structured outputs.
 */
export interface ILogger {
  /** Standard informational message */
  info(message: string): void;

  /** Warning message - something may be wrong but execution continues */
  warn(message: string): void;

  /** Error message - something went wrong */
  error(message: string): void;

  /** Debug/verbose message - only shown if verbose mode is enabled */
  verbose(message: string): void;

  /** Debug message - only shown if debug mode is enabled */
  debug(message: string): void;

  /** Success message - indicates a positive outcome */
  success(message: string): void;

  /** Progress update for long-running operations */
  progress(current: number, total: number, message?: string): void;
}

// ============================================================================
// WORKER POOL INTERFACE
// ============================================================================

/**
 * IWorkerTask represents a unit of work to be executed by a worker.
 * The task includes all data needed for execution in an isolated context.
 */
export interface IWorkerTask<TArgs = unknown, TResult = unknown> {
  /** Task type identifier */
  taskType: TaskType;

  /** Task-specific arguments */
  args: TArgs;

  /** Expected result type (for type inference) */
  _resultType?: TResult;
}

/**
 * IWorkerResult wraps the result of a worker task execution.
 */
export interface IWorkerResult<TResult = unknown> {
  /** Whether the task succeeded */
  success: boolean;

  /** The result if successful */
  result?: TResult;

  /** Error message if failed */
  error?: string;

  /** Error stack if failed */
  stack?: string;
}

/**
 * IWorkerPool provides an abstraction over parallel task execution.
 * Implementations may use Node.js worker threads, process pools, or
 * single-threaded sequential execution.
 */
export interface IWorkerPool {
  /** Maximum concurrent workers */
  readonly concurrency: number;

  /**
   * Execute a batch of tasks in parallel (up to concurrency limit).
   * @param tasks Array of tasks to execute
   * @param onProgress Optional callback for progress updates
   * @returns Array of results in same order as input tasks
   */
  executeBatch<TArgs, TResult>(
    tasks: IWorkerTask<TArgs, TResult>[],
    onProgress?: (completed: number, total: number) => void
  ): Promise<IWorkerResult<TResult>[]>;

  /**
   * Execute a single task.
   * @param task The task to execute
   * @returns The task result
   */
  execute<TArgs, TResult>(task: IWorkerTask<TArgs, TResult>): Promise<IWorkerResult<TResult>>;

  /**
   * Shutdown the worker pool, terminating all workers.
   */
  shutdown(): Promise<void>;
}

// ============================================================================
// SERVER OPTIONS
// ============================================================================

/**
 * Server-related options for serve/mcp/dedicatedserver commands.
 */
export interface IServerOptions {
  /** HTTP port for the server */
  port: number;

  /** HTTPS port if SSL is enabled */
  httpsPort?: number;

  /** Server slot identifier */
  slot?: number;

  /** Server path for dedicated server */
  serverPath?: string;

  /** Server features mode (all, allwebservices, basicwebservices, dedicatedserver) */
  features?: string;

  /** Display-only passcode */
  displayReadOnlyPasscode?: string;

  /** Full read-only passcode */
  fullReadOnlyPasscode?: string;

  /** Update state passcode */
  updateStatePasscode?: string;

  /** Admin passcode */
  adminPasscode?: string;

  /** Server title */
  title?: string;

  /** Server domain name */
  domainName?: string;

  /** Message of the day */
  messageOfTheDay?: string;

  /** Run server once and exit */
  runOnce: boolean;

  /** Auto-exit after N seconds (for testing) */
  timeout?: number;

  /** Force Ink UI even if not a TTY (for testing) */
  forceInk?: boolean;

  /** Require authentication for MCP endpoint even from localhost */
  mcpRequireAuth?: boolean;

  /** Path to write continuous log file */
  logFile?: string;

  /** SSL configuration */
  ssl?: {
    certPath?: string;
    keyPath?: string;
    pfxPath?: string;
    pfxPassphrase?: string;
    caPath?: string;
    port: number;
    httpsOnly: boolean;
  };
}

// ============================================================================
// WORLD OPTIONS
// ============================================================================

/**
 * World-related options for world/ensureworld commands.
 */
export interface IWorldOptions {
  /** Enable beta APIs in the world */
  betaApis: boolean;

  /** Use editor mode */
  editor: boolean;

  /** World difficulty */
  difficulty?: string;

  /** World game mode */
  gameMode?: string;

  /** World name override */
  name?: string;

  /** World seed */
  seed?: string;

  /** Ensure world exists before other operations */
  ensureWorld: boolean;

  /** Deploy as a test world (generate world with project packs) */
  testWorld: boolean;

  /** Launch the world after deployment */
  launch: boolean;
}

// ============================================================================
// VALIDATION OPTIONS
// ============================================================================

/**
 * Options specific to validation commands.
 */
export interface IValidationOptions {
  /** Validation suite to use (string name of ProjectInfoSuite) */
  suite?: string;

  /** Comma-separated list of validators to exclude */
  exclusionList?: string;

  /** Output MCI format instead of reports */
  outputMci: boolean;

  /** Aggregate reports after validation */
  aggregateReports: boolean;

  /** When true, report validation errors as warnings and don't set a failure exit code */
  warnOnly: boolean;
}

// ============================================================================
// MAIN COMMAND CONTEXT
// ============================================================================

/**
 * ICommandContext is the main context interface passed to all commands.
 *
 * It provides:
 * - Fully hydrated projects (not just paths)
 * - Typed global options
 * - Storage abstractions
 * - Worker pool for parallelization
 * - Unified logging
 *
 * Commands should receive this context and NOT access globals or parse arguments.
 */
export interface ICommandContext {
  // -------------------------------------------------------------------------
  // Core Infrastructure
  // -------------------------------------------------------------------------

  /** Main CreatorTools instance */
  creatorTools: CreatorTools;

  /** Local environment settings */
  localEnv: LocalEnvironment;

  /** Worker pool for parallel task execution */
  workerPool: IWorkerPool;

  /** Logging interface */
  log: ILogger;

  // -------------------------------------------------------------------------
  // Projects
  // -------------------------------------------------------------------------

  /**
   * Fully hydrated projects ready for use.
   * Commands iterate over this array instead of managing project detection.
   */
  projects: Project[];

  /** Convenience: number of projects */
  projectCount: number;

  /** Convenience: true if exactly one project */
  isSingleProject: boolean;

  // -------------------------------------------------------------------------
  // Input/Output
  // -------------------------------------------------------------------------

  /** Input folder path (resolved to absolute) */
  inputFolder: string;

  /** True if the user explicitly specified -i / --input-folder on the command line */
  inputFolderSpecified: boolean;

  /** Output folder path (resolved to absolute), may equal inputFolder */
  outputFolder: string;

  /** Storage for reading input content */
  inputStorage: IStorage;

  /** Storage for writing output content */
  outputStorage: IStorage;

  /** Input work folder (loaded and ready) */
  inputWorkFolder: IFolder;

  /** Output work folder (loaded and ready) */
  outputWorkFolder: IFolder;

  // -------------------------------------------------------------------------
  // Global Options
  // -------------------------------------------------------------------------

  /** Number of worker threads to use */
  threads: number;

  /** Force overwrite of existing files */
  force: boolean;

  /** Run in isolated mode (no external network requests) */
  isolated: boolean;

  /** Enable debug output */
  debug: boolean;

  /** Enable verbose output */
  verbose: boolean;

  /** Suppress non-essential output */
  quiet: boolean;

  /** Output in JSON format for machine parsing */
  json: boolean;

  /** Dry-run mode - show what would be done without making changes */
  dryRun: boolean;

  /** Output format type */
  outputType: OutputType;

  /** The task type being executed */
  taskType: TaskType;

  // -------------------------------------------------------------------------
  // Command Arguments
  // -------------------------------------------------------------------------

  /** Sub-command or sub-action (e.g., for 'fix' command) */
  subCommand?: string;

  /** Property value for set commands */
  propertyValue?: string;

  /** Search term for search command */
  searchTerm?: string;

  /** Mode string (e.g., 'blockviewer', 'entityviewer') */
  mode?: string;

  /** Type string (e.g., entity type identifier) */
  type?: string;

  /** New name for create/rename operations */
  newName?: string;

  /** Description text for create operations */
  description?: string;

  /** Project name filter (starts with) */
  projectStartsWith?: string;

  /** Reference folder path for documentation generation (skip existing files) */
  referenceFolder?: string;

  // -------------------------------------------------------------------------
  // Grouped Options
  // -------------------------------------------------------------------------

  /** Server-related options */
  server: IServerOptions;

  /** World-related options */
  world: IWorldOptions;

  /** Validation-specific options */
  validation: IValidationOptions;

  // -------------------------------------------------------------------------
  // Exit State
  // -------------------------------------------------------------------------

  /** Exit code to return (0 = success) */
  exitCode: number;

  /** Set the exit code (updates only if higher than current) */
  setExitCode(code: number): void;

  // -------------------------------------------------------------------------
  // Utility Methods
  // -------------------------------------------------------------------------

  /**
   * Run a function for each project with progress logging.
   * @param fn Function to run for each project
   * @param label Optional label for progress messages
   */
  forEachProject(fn: (project: Project, index: number) => Promise<void>, label?: string): Promise<void>;
}

// ============================================================================
// ERROR CODES
// ============================================================================

/**
 * Standard error codes for CLI exit status.
 * Higher numbers indicate more severe errors.
 */
export const ErrorCodes = {
  SUCCESS: 0,
  INIT_ERROR: 1,
  VALIDATION_WARNING: 2,
  VALIDATION_ERROR: 3,
  VALIDATION_TESTFAIL: 4,
  VALIDATION_INTERNALPROCESSINGERROR: 5,
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
