/**
 * CommandRegistry - Central registry for all CLI commands
 *
 * ARCHITECTURE DOCUMENTATION
 * ==========================
 *
 * This registry is the central hub for command management in the CLI:
 *
 * RESPONSIBILITIES:
 * 1. Hold all registered ICommand instances
 * 2. Provide lookup by command name, alias, or TaskType
 * 3. Configure Commander.js with all commands (including arguments and options)
 * 4. Capture command-line arguments when actions are invoked
 * 5. Support command categories for organized help output
 * 6. Prevent duplicate command registration
 *
 * COMMAND REGISTRATION FLOW:
 * 1. Each command file (e.g., ValidateCommand.ts) exports a singleton instance
 * 2. commands/index.ts imports all commands and calls registerAll()
 * 3. index.ts calls configureCommander() which wires all commands to Commander.js
 * 4. Commander.js parses args and calls the action handler
 * 5. Action handler captures args and sets executionTaskType
 * 6. index.ts retrieves captured state via getCapturedState()
 *
 * DATA STRUCTURES:
 * - commands: Map<string, ICommand> - Name/alias → command lookup
 * - commandsByTaskType: Map<TaskType, ICommand> - TaskType → command lookup
 * - capturedState: Holds the captured TaskType and arguments after parsing
 *
 * The registry enforces uniqueness:
 * - Each command name must be unique
 * - Each TaskType can only have one command
 * - Aliases cannot conflict with command names or other aliases
 *
 * RELATED FILES:
 * - ICommand.ts: Interface that all commands implement
 * - commands/index.ts: Imports and registers all command instances
 * - index.ts: Creates Commander.js program and calls configureCommander()
 * - CommandContextFactory.ts: Creates context passed to command.execute()
 *
 * CATEGORY SYSTEM:
 * Commands are organized into categories for help output:
 * - Validation: validate, search, aggregate-reports, profile-validation
 * - Project: create, add, fix, info, set, export-addon, export-world, deploy
 * - Server: serve, mcp, dedicated-serve, passcodes, eula, set-server-props
 * - Render: build-structure, render-structure, render-model, render-vanilla
 * - Docs: docs-generate-* commands for documentation generation
 * - World: world, ensure-world, deploy-test-world
 * - Content: view, edit, version, autotest, run-tests
 */

import { Command, Argument } from "commander";
import { ICommand, ICommandMetadata } from "./ICommand";
import { TaskType } from "../ClUtils";
import Utilities from "../../core/Utilities";

/**
 * Captured state from Commander action handlers.
 * This replaces the global variables previously used in index.ts.
 */
export interface ICapturedCommandState {
  /** The TaskType of the command that was invoked */
  taskType: TaskType;

  /**
   * Captured positional arguments, keyed by contextField.
   * e.g., { mode: 'mcuwp', type: 'block', newName: 'MyProject' }
   */
  args: Record<string, string | undefined>;

  /**
   * Command-specific options from the command's action handler.
   * e.g., { slot: '1', preview: './preview.png' }
   */
  commandOptions: Record<string, any>;
}

/**
 * CommandRegistry manages all CLI commands.
 */
export class CommandRegistry {
  private commands: Map<string, ICommand> = new Map();
  private commandsByTaskType: Map<TaskType, ICommand> = new Map();

  /** Captured state after Commander parses and executes an action */
  private capturedState: ICapturedCommandState = {
    taskType: TaskType.noCommand,
    args: {},
    commandOptions: {},
  };

  /**
   * Register a command with the registry.
   * @param command The command to register
   */
  register(command: ICommand): void {
    const { name, taskType, aliases } = command.metadata;

    const lowerName = name.toLowerCase();

    // Register by name
    if (this.commands.has(lowerName)) {
      throw new Error(`Command '${name}' is already registered`);
    }
    this.commands.set(lowerName, command);

    // Register by task type
    if (this.commandsByTaskType.has(taskType)) {
      throw new Error(`TaskType ${taskType} is already registered`);
    }
    this.commandsByTaskType.set(taskType, command);

    // Register aliases
    if (aliases) {
      for (const alias of aliases) {
        const lowerAlias = alias.toLowerCase();
        if (this.commands.has(lowerAlias)) {
          throw new Error(`Command alias '${alias}' conflicts with existing command`);
        }
        this.commands.set(lowerAlias, command);
      }
    }
  }

  /**
   * Register multiple commands.
   * @param commands Array of commands to register
   */
  registerAll(commands: ICommand[]): void {
    for (const command of commands) {
      this.register(command);
    }
  }

  /**
   * Get a command by name or alias.
   * @param name Command name or alias
   * @returns The command, or undefined if not found
   */
  get(name: string): ICommand | undefined {
    return this.commands.get(name.toLowerCase());
  }

  /**
   * Get a command by TaskType.
   * @param taskType The task type
   * @returns The command, or undefined if not found
   */
  getByTaskType(taskType: TaskType): ICommand | undefined {
    return this.commandsByTaskType.get(taskType);
  }

  /**
   * Check if a command is registered.
   * @param name Command name or alias
   */
  has(name: string): boolean {
    return this.commands.has(name.toLowerCase());
  }

  /**
   * Get all registered commands (unique, no aliases).
   */
  getAll(): ICommand[] {
    // Use a Set to deduplicate (aliases point to same command)
    const unique = new Set<ICommand>();
    for (const command of this.commands.values()) {
      unique.add(command);
    }
    return Array.from(unique);
  }

  /**
   * Get all commands in a category.
   * @param category Category name
   */
  getByCategory(category: string): ICommand[] {
    return this.getAll().filter((cmd) => cmd.metadata.category === category);
  }

  /**
   * Get all unique categories.
   */
  getCategories(): string[] {
    const categories = new Set<string>();
    for (const command of this.getAll()) {
      categories.add(command.metadata.category);
    }
    return Array.from(categories).sort();
  }

  /**
   * Get all command metadata (for help generation).
   */
  getAllMetadata(): ICommandMetadata[] {
    return this.getAll().map((cmd) => cmd.metadata);
  }

  /**
   * Reset captured state. Called before parsing a new command line.
   */
  resetCapturedState(): void {
    this.capturedState = {
      taskType: TaskType.noCommand,
      args: {},
      commandOptions: {},
    };
  }

  /**
   * Get the captured state after Commander has parsed and executed an action.
   */
  getCapturedState(): ICapturedCommandState {
    return this.capturedState;
  }

  /**
   * Configure a Commander.js program with all registered commands.
   *
   * This method:
   * 1. Creates a Commander command for each registered ICommand
   * 2. Adds arguments from metadata.arguments[]
   * 3. Adds aliases from metadata.aliases[]
   * 4. Calls command.configure() for custom options
   * 5. Sets up action handler to capture args and taskType
   *
   * @param program The Commander.js program instance
   */
  configureCommander(program: Command): void {
    for (const command of this.getAll()) {
      const { name, description, aliases, arguments: argDefs, taskType, debugOnly, internal } = command.metadata;

      // Skip debug-only commands unless in debug mode
      if (debugOnly && !Utilities.isDebug) {
        continue;
      }

      const cmd = program.command(name, { hidden: !!internal }).description(description);

      // Add aliases
      if (aliases && aliases.length > 0) {
        cmd.aliases(aliases);
      }

      // Add arguments from metadata
      if (argDefs && argDefs.length > 0) {
        for (const argDef of argDefs) {
          const argName = argDef.required ? `<${argDef.name}>` : `[${argDef.name}]`;
          const arg = new Argument(argName, argDef.description);

          if (argDef.choices) {
            arg.choices(argDef.choices);
          }

          if (argDef.defaultValue !== undefined) {
            arg.default(argDef.defaultValue, argDef.defaultDescription);
          }

          cmd.addArgument(arg);
        }
      }

      // Let the command configure its own additional options
      command.configure(cmd);

      // Set up action handler that captures arguments
      cmd.action((...actionArgs: any[]) => {
        // Commander passes positional args first, then options object, then Command object
        // The number of positional args matches the number of arguments defined
        const numArgs = argDefs?.length ?? 0;
        const positionalArgs = actionArgs.slice(0, numArgs);
        const cmdOptions = numArgs < actionArgs.length - 1 ? actionArgs[numArgs] : {};

        // Set the task type
        this.capturedState.taskType = taskType;
        this.capturedState.args = {};
        this.capturedState.commandOptions = cmdOptions;

        // Map positional arguments to their contextField names
        if (argDefs) {
          for (let i = 0; i < argDefs.length; i++) {
            const argDef = argDefs[i];
            const value = positionalArgs[i];

            if (argDef.contextField && value !== undefined) {
              this.capturedState.args[argDef.contextField] = value;
            }
          }
        }
      });
    }
  }

  /**
   * Generate help text organized by category.
   * @param showAll If true, includes hidden commands. Default: false.
   */
  generateCategoryHelp(showAll: boolean = false): string {
    const lines: string[] = [];
    const categories = this.getCategories();

    for (const category of categories) {
      const commands = this.getByCategory(category);

      const visibleCommands = commands.filter((cmd) => {
        if (cmd.metadata.debugOnly && !Utilities.isDebug) return false;
        if (cmd.metadata.internal && !showAll) return false;
        return true;
      });

      if (visibleCommands.length === 0) continue;

      lines.push(`\n${category}:`);

      for (const cmd of visibleCommands) {
        const { name, description, aliases } = cmd.metadata;
        const aliasText = aliases && aliases.length > 0 ? ` (${aliases.join(", ")})` : "";
        lines.push(`  ${name.padEnd(20)}${aliasText.padEnd(10)} ${description}`);
      }
    }

    if (!showAll) {
      const internalCount = this.getAll().filter((cmd) => cmd.metadata.internal).length;
      if (internalCount > 0) {
        lines.push(
          `\n  ${internalCount} content-production command(s) not shown. Use --all-commands to see the full list.`
        );
      }
    }

    return lines.join("\n");
  }
}

/**
 * Global command registry instance.
 * Commands register themselves here on import.
 */
export const commandRegistry = new CommandRegistry();
