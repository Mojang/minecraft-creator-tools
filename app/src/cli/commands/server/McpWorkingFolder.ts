// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as fs from "fs";
import * as path from "path";

/**
 * Environment variables that agent plugin hosts set when they start a plugin's MCP server.
 * Copilot CLI and VS Code set all three; Claude Code sets CLAUDE_PLUGIN_ROOT.
 */
const PLUGIN_ROOT_VARIABLES = ["PLUGIN_ROOT", "COPILOT_PLUGIN_ROOT", "CLAUDE_PLUGIN_ROOT"];

/**
 * Picks the working folder that `mct mcp` reports to agents.
 *
 * An explicit `-i` always wins. Otherwise the CLI default (the current directory, or the project
 * root found above it) is used, unless an agent plugin started the server inside the plugin's own
 * install folder. Agent Plugins clients (Copilot CLI, VS Code) start stdio servers with the plugin
 * root as the current directory. That folder is a plugin cache, not the user's project, so no
 * working folder is reported and the agent uses paths from its own workspace instead.
 */
export function resolveMcpWorkingFolder(
  inputFolder: string | undefined,
  inputFolderSpecified: boolean,
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd()
): string | undefined {
  if (inputFolderSpecified) {
    return inputFolder;
  }

  const currentFolder = toRealPath(cwd);

  for (const variable of PLUGIN_ROOT_VARIABLES) {
    const pluginRoot = env[variable];

    if (pluginRoot && isSameOrInside(currentFolder, toRealPath(pluginRoot))) {
      return undefined;
    }
  }

  return inputFolder;
}

function isSameOrInside(folder: string, parentFolder: string): boolean {
  const relative = path.relative(parentFolder, folder);

  return relative === "" || (relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative));
}

// Plugin hosts may pass a path through a symlink (for example /var and /private/var on macOS),
// while process.cwd() reports the physical path.
function toRealPath(folder: string): string {
  try {
    return fs.realpathSync.native(folder);
  } catch {
    return path.resolve(folder);
  }
}
