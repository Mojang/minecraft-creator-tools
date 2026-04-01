// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * =============================================================================
 * TOOL COMMAND PROVIDER - Integrates ToolCommands into Ink CLI
 * =============================================================================
 *
 * This provider bridges the unified ToolCommand system with the Ink CLI's
 * command provider architecture. It exposes all ToolCommands (create, add,
 * remove, rename, etc.) in the serve mode interactive terminal.
 *
 * ToolCommands are available with or without the leading "/" prefix.
 * =============================================================================
 */

import {
  ICommandProvider,
  ICommandDefinition,
  ICommandSuggestion,
  ICommandResponse,
  ICommandContext,
} from "./ICommandProvider";
import { ToolCommandRegistry, initializeToolCommands, ToolCommandScope } from "../../../app/toolcommands";
import { registerNodeOnlyCommands } from "../../../app/toolcommands/registerNodeCommands";
import type { IToolCommand } from "../../../app/toolcommands/IToolCommand";
import type { IToolCommandContext, IToolCommandOutput } from "../../../app/toolcommands";

export class ToolCommandProvider implements ICommandProvider {
  readonly name = "toolcommands";
  readonly displayName = "ToolCommands";
  readonly priority = 90; // Below MctCommandProvider (100), above BDS (50)

  private _initialized = false;

  async initialize(): Promise<void> {
    if (this._initialized) return;
    initializeToolCommands();
    await registerNodeOnlyCommands();
    this._initialized = true;
  }

  /**
   * Convert a ToolCommand's metadata into an ICommandDefinition.
   */
  private toCommandDefinition(meta: IToolCommand["metadata"]): ICommandDefinition {
    return {
      name: meta.name,
      description: meta.description,
      helpText: this.formatHelpText(meta),
      parameters: (meta.arguments || []).map((arg) => ({
        name: arg.name,
        description: arg.description,
        required: arg.required || false,
        type: arg.type,
        enumValues: arg.choices,
        defaultValue: arg.defaultValue,
      })),
      aliases: meta.aliases,
      category: meta.category,
      source: "toolcommands",
    };
  }

  getCommands(): ICommandDefinition[] {
    const commands: ICommandDefinition[] = [];
    const registry = ToolCommandRegistry.instance;

    for (const toolCmd of registry.getAll(ToolCommandScope.serveTerminal)) {
      commands.push(this.toCommandDefinition(toolCmd.metadata));
    }

    return commands;
  }

  private formatHelpText(meta: {
    name: string;
    description: string;
    arguments?: { name: string; required?: boolean }[];
    flags?: { name: string; description: string; shortName?: string }[];
    examples?: string[];
  }): string {
    let help = `${meta.description}\n\n`;

    // Usage line
    let usage = `Usage: /${meta.name}`;
    if (meta.arguments) {
      for (const arg of meta.arguments) {
        usage += arg.required ? ` <${arg.name}>` : ` [${arg.name}]`;
      }
    }
    help += usage + "\n";

    // Flags
    if (meta.flags && meta.flags.length > 0) {
      help += "\nFlags:\n";
      for (const flag of meta.flags) {
        const short = flag.shortName ? `-${flag.shortName}, ` : "";
        help += `  ${short}--${flag.name}: ${flag.description}\n`;
      }
    }

    // Examples
    if (meta.examples && meta.examples.length > 0) {
      help += "\nExamples:\n";
      for (const ex of meta.examples) {
        help += `  ${ex}\n`;
      }
    }

    return help;
  }

  getCommand(name: string): ICommandDefinition | undefined {
    const normalizedName = name.toLowerCase().replace(/^\//, "");
    const registry = ToolCommandRegistry.instance;
    const toolCmd = registry.get(normalizedName);

    if (!toolCmd) return undefined;

    return this.toCommandDefinition(toolCmd.metadata);
  }

  getSuggestions(input: string, cursorPosition: number): ICommandSuggestion[] {
    const suggestions: ICommandSuggestion[] = [];
    const inputLower = input.toLowerCase().trim().replace(/^\//, "");

    const registry = ToolCommandRegistry.instance;
    const commands = registry.getAll(ToolCommandScope.serveTerminal);

    if (inputLower.length === 0) {
      // Suggest all ToolCommands
      for (const cmd of commands) {
        suggestions.push({
          value: "/" + cmd.metadata.name,
          display: "/" + cmd.metadata.name,
          description: cmd.metadata.description,
          isComplete: false,
        });
      }
      return suggestions;
    }

    const parts = inputLower.split(/\s+/);
    if (parts.length === 1) {
      // Matching command name
      for (const cmd of commands) {
        if (cmd.metadata.name.startsWith(parts[0])) {
          suggestions.push({
            value: "/" + cmd.metadata.name,
            display: "/" + cmd.metadata.name,
            description: cmd.metadata.description,
            isComplete: !cmd.metadata.arguments || cmd.metadata.arguments.length === 0,
          });
        }
        // Check aliases
        if (cmd.metadata.aliases) {
          for (const alias of cmd.metadata.aliases) {
            if (alias.startsWith(parts[0]) && alias !== cmd.metadata.name) {
              suggestions.push({
                value: "/" + alias,
                display: `/${alias} (→ ${cmd.metadata.name})`,
                description: cmd.metadata.description,
                isComplete: false,
              });
            }
          }
        }
      }
    }

    return suggestions;
  }

  handlesCommand(commandName: string): boolean {
    const normalizedName = commandName.toLowerCase().replace(/^\//, "");
    return ToolCommandRegistry.instance.has(normalizedName);
  }

  async execute(input: string, context: ICommandContext): Promise<ICommandResponse | undefined> {
    // Remove leading / if present
    const normalizedInput = input.startsWith("/") ? input : "/" + input;
    const commandName = input.trim().split(/\s+/)[0]?.toLowerCase().replace(/^\//, "") || "";

    if (!this.handlesCommand(commandName)) {
      return undefined;
    }

    // Create a ToolCommandContext from the Ink ICommandContext
    const toolContext = this.createToolContext(context);

    const result = await ToolCommandRegistry.instance.execute(normalizedInput, toolContext);

    if (!result) {
      return undefined;
    }

    // Include any intermediate output messages collected during execution
    const messages = toolContext.messages;
    const intermediateOutput = messages && messages.length > 0 ? messages.join("\n") + "\n" : "";

    return {
      success: result.success,
      message: result.success
        ? intermediateOutput + (result.message || "Command completed")
        : intermediateOutput + (result.error?.message || "Command failed"),
      data: result.data,
      type: result.success ? "text" : "error",
    };
  }

  private createToolContext(inkContext: ICommandContext): IToolCommandContext {
    // Collect intermediate output messages so they can be included in the response.
    const messages: string[] = [];
    const output: IToolCommandOutput = {
      info: (msg: string) => {
        messages.push(msg);
      },
      success: (msg: string) => {
        messages.push(msg);
      },
      warn: (msg: string) => {
        messages.push("[warn] " + msg);
      },
      error: (msg: string) => {
        messages.push("[error] " + msg);
      },
      debug: () => {},
      progress: () => {},
    };

    return {
      creatorTools: inkContext.creatorTools,
      project: undefined,
      minecraft: undefined,
      output,
      scope: "serveTerminal",
      messages: messages,
    };
  }
}

export const toolCommandProvider = new ToolCommandProvider();
