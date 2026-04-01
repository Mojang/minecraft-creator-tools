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
 * The -i/--input option sets the working folder for all MCP operations.
 * When set, this folder is used as the default context for file operations
 * and is exposed to AI assistants via the MCP protocol so they know where
 * to write Minecraft content.
 */

import { Command } from "commander";
import { ICommandMetadata, CommandBase } from "../../core/ICommand";
import { ICommandContext } from "../../core/ICommandContext";
import { TaskType } from "../../ClUtils";
import MinecraftMcpServer from "../../../local/MinecraftMcpServer";

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
  };

  configure(cmd: Command): void {
    // Accept input folder as working folder for MCP operations
    cmd.option("-i, --input <folder>", "Working folder for MCP operations (default: current directory)");
  }

  async execute(context: ICommandContext): Promise<void> {
    // MCP mode logs to stderr to keep stdout clean for protocol
    context.localEnv.logToStdError = true;

    const mcpServer = new MinecraftMcpServer();

    // Pass the input folder as the working folder for MCP operations
    // This allows AI assistants to know where to write content
    await mcpServer.startStdio(context.creatorTools, context.localEnv, context.inputFolder);

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
