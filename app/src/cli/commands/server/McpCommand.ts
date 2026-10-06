/**
 * McpCommand - Run as a Model Context Protocol server
 *
 * ARCHITECTURE DOCUMENTATION
 * ==========================
 *
 * This command starts MCT as an MCP server, communicating via stdin/stdout.
 * It allows AI assistants to use MCT tools for Minecraft content creation.
 *
 * USAGE:
 * npx mct mcp
 * npx mct mcp -i /path/to/working/folder
 *
 * The -i/--input-folder option sets the working folder for all MCP operations.
 * When set, this folder is used as the default context for file operations
 * and is exposed to AI assistants via the MCP protocol so they know where
 * to write Minecraft content.
 *
 * `--input <folder>` is an older spelling kept for existing MCP client configs. It is a command
 * option, but cli/index.ts loads projects from the program's -i/--input-folder before any command
 * runs, so applyMcpInputAlias() copies it there right after parsing. See that function.
 *
 * Without -i, the working folder defaults to the current directory, except when an
 * agent plugin (plugins/minecraft/mcp.json) starts the server inside the plugin's
 * install folder. See McpWorkingFolder.ts.
 */

import * as path from "path";
import { Command } from "commander";
import { ICommandMetadata, CommandBase } from "../../core/ICommand";
import { ICommandContext } from "../../core/ICommandContext";
import { TaskType } from "../../ClUtils";
import MinecraftMcpServer from "../../../local/MinecraftMcpServer";
import { resolveMcpWorkingFolder } from "./McpWorkingFolder";

/**
 * Makes `mct mcp --input <folder>` identical to `mct mcp -i <folder>` by copying the alias into
 * the program's inputFolder. Must run right after parsing, before cli/index.ts loads projects or
 * builds the command context, which both read inputFolder. Returns an error message when both
 * spellings name different folders.
 */
export function applyMcpInputAlias(
  programOptions: { inputFolder?: unknown },
  commandOptions: { input?: unknown } | undefined
): string | undefined {
  const alias = commandOptions?.input;
  if (typeof alias !== "string") {
    return undefined;
  }

  const inputFolder = programOptions.inputFolder;
  if (typeof inputFolder === "string" && path.resolve(inputFolder) !== path.resolve(alias)) {
    // JSON.stringify quotes and escapes the paths, so control characters can't reach the terminal.
    return `--input ${JSON.stringify(alias)} and -i/--input-folder ${JSON.stringify(inputFolder)} name different folders. Use one of them.`;
  }

  programOptions.inputFolder = alias;
  return undefined;
}

export class McpCommand extends CommandBase {
  readonly metadata: ICommandMetadata = {
    name: "mcp",
    description: "Run this command line as a local MCP server.",
    taskType: TaskType.mcp,
    aliases: [],
    requiresProjects: false,
    isWriteCommand: false,
    isEditInPlace: false,
    isLongRunning: true,
    category: "Server",
    globalOptionGroups: ["input"],
    examples: [
      { description: "Run the MCP server in the current folder", command: "mct mcp" },
      { description: "Run the MCP server for a specific project", command: "mct mcp -i ./my-project" },
    ],
  };

  configure(cmd: Command): void {
    // See applyMcpInputAlias for how this reaches the program's -i/--input-folder.
    cmd.option("--input <folder>", "Same as -i/--input-folder: the working folder for MCP operations.");
  }

  async execute(context: ICommandContext): Promise<void> {
    // MCP mode logs to stderr to keep stdout clean for protocol
    context.localEnv.logToStdError = true;

    const mcpServer = new MinecraftMcpServer();

    // Pass the input folder as the working folder for MCP operations
    // This allows AI assistants to know where to write content
    const workingFolder = resolveMcpWorkingFolder(context.inputFolder, context.inputFolderSpecified);

    if (!workingFolder && context.inputFolder) {
      context.log.verbose("Started from an agent plugin's install folder, so no default working folder is set.");
    }

    await mcpServer.startStdio(context.creatorTools, context.localEnv, workingFolder);

    // Keep the process alive - MCP server runs via event handlers on stdin/stdout
    // Without this, the CLI framework would exit after execute() returns
    await new Promise<void>((resolve) => {
      process.on("SIGINT", () => {
        context.log.debug("Shutting down MCP server...");
        resolve();
      });
      process.on("SIGTERM", () => {
        context.log.debug("Shutting down MCP server...");
        resolve();
      });
    });
  }
}

export const mcpCommand = new McpCommand();
