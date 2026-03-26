/**
 * ICommand - Interface for CLI commands
 *
 * All commands implement this interface. Commands are registered with the
 * CommandRegistry and executed via their execute() method.
 *
 * Commands should:
 * - NOT parse arguments (context provides typed options)
 * - NOT detect/load projects (context provides hydrated Project[])
 * - NOT access global mutable state
 * - Use context.log for output
 * - Use context.workerPool for parallel work
 * - Return void (set exit code via context.setExitCode)
 *
 * COMMAND REGISTRATION:
 * Commands define their arguments and options via metadata and configure().
 * The CommandRegistry uses this metadata to:
 * 1. Register commands with Commander.js
 * 2. Set up action handlers that capture arguments
 * 3. Map captured args to ICommandContext fields
 *
 * The configure() method is called with the Commander Command instance AFTER
 * it has been created by the registry. Use configure() to add command-specific
 * options that aren't expressible via metadata alone.
 */

import { ICommandContext } from "./ICommandContext";
import { Command } from "commander";
import { TaskType } from "../ClUtils";

/**
 * Defines a command-line argument.
 */
export interface ICommandArgument {
  /** Argument name (e.g., 'name', 'template') */
  name: string;

  /** Description for help text */
  description: string;

  /** Whether this argument is required */
  required?: boolean;

  /** Default value if not provided */
  defaultValue?: string;

  /** Default value description for help text */
  defaultDescription?: string;

  /** Valid choices (if restricted) */
  choices?: string[];

  /**
   * Maps this argument to a context field.
   * Used by CommandContextFactory to populate the context.
   * Valid values: 'mode', 'type', 'newName', 'newDescription', 'subCommand',
   *               'propertyValue', 'searchTerm', 'template', 'creator'
   */
  contextField?: string;
}

/**
 * Command metadata for registration and help text.
 */
export interface ICommandMetadata {
  /** Command name (e.g., 'validate', 'create', 'serve') */
  name: string;

  /** Short description for help text */
  description: string;

  /** Task type enum value for this command */
  taskType: TaskType;

  /** Command aliases (e.g., ['v'] for 'validate') */
  aliases?: string[];

  /**
   * Positional arguments for this command.
   * These are automatically added to Commander.js during registration.
   */
  arguments?: ICommandArgument[];

  /** Whether this command requires projects to be loaded */
  requiresProjects: boolean;

  /** Whether this command modifies content (vs read-only) */
  isWriteCommand: boolean;

  /** Whether this command edits content in place */
  isEditInPlace: boolean;

  /** Whether this command is a long-running server/daemon */
  isLongRunning: boolean;

  /** Category for grouping in help (e.g., 'Validation', 'Server', 'World') */
  category: string;

  /** Whether this command is only available in debug mode */
  debugOnly?: boolean;

  /**
   * Whether this command is an internal content-production tool.
   * Internal commands still work normally but are omitted from the
   * default `--help` listing to keep it focused for creators.
   * Run `mct --all-commands` to see the full command list.
   */
  internal?: boolean;
}

/**
 * ICommand is the interface all CLI commands must implement.
 */
export interface ICommand {
  /**
   * Command metadata for registration.
   */
  readonly metadata: ICommandMetadata;

  /**
   * Configure Commander.js options for this command.
   * Called during command registration to add command-specific options.
   *
   * @param cmd The Commander.js Command instance to configure
   */
  configure(cmd: Command): void;

  /**
   * Execute the command with the provided context.
   *
   * The context provides:
   * - Hydrated projects (context.projects)
   * - Typed options (context.*)
   * - Logger (context.log)
   * - Worker pool (context.workerPool)
   *
   * Commands should NOT:
   * - Parse arguments manually
   * - Access global mutable state
   * - Call process.exit() directly
   *
   * Instead, use context.setExitCode() and return.
   *
   * @param context The fully initialized command context
   */
  execute(context: ICommandContext): Promise<void>;
}

/**
 * Base class for commands that provides common functionality.
 * Commands can extend this or implement ICommand directly.
 */
export abstract class CommandBase implements ICommand {
  abstract readonly metadata: ICommandMetadata;

  /**
   * Default configure implementation does nothing.
   * Override to add command-specific options.
   */
  configure(_cmd: Command): void {
    // Default: no additional options
  }

  abstract execute(context: ICommandContext): Promise<void>;

  /**
   * Helper to log command start.
   */
  protected logStart(context: ICommandContext): void {
    if (context.verbose) {
      context.log.verbose(`Starting ${this.metadata.name} command...`);
    }
  }

  /**
   * Helper to log command completion.
   */
  protected logComplete(context: ICommandContext): void {
    if (context.verbose) {
      context.log.verbose(`Completed ${this.metadata.name} command.`);
    }
  }

  /**
   * Helper to iterate over projects with standard error handling.
   */
  protected async processProjects(
    context: ICommandContext,
    processor: (project: import("../../app/Project").default, index: number) => Promise<void>
  ): Promise<void> {
    if (context.projects.length === 0) {
      context.log.warn("No projects found in the specified input folder. Use -i to specify a project path.");
      return;
    }

    for (let i = 0; i < context.projects.length; i++) {
      const project = context.projects[i];
      try {
        if (context.projectCount > 1) {
          context.log.info(`Processing project ${i + 1}/${context.projectCount}: ${project.name}`);
        }
        await processor(project, i);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        context.log.error(`Error processing project ${project.name}: ${message}`);
        context.setExitCode(1);
      }
    }
  }
}
