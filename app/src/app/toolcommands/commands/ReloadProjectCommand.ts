// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * ReloadProjectCommand - Re-scan the current project's files
 *
 * Re-runs `project.inferProjectItemsFromFiles(true)` so any files
 * that were added, removed, or modified outside the editor are
 * picked up. Reports the new total item count.
 *
 * NOTE: this shadows Bedrock's in-game `/reload` command for the
 * MCT slash bar. Inside a Bedrock console you can still reach
 * Bedrock's reload via the dedicated server console.
 */

import type { IToolCommandMetadata, IToolCommandResult } from "../IToolCommand";
import { ToolCommandBase } from "../IToolCommand";
import type { IToolCommandContext } from "../IToolCommandContext";

export class ReloadProjectCommand extends ToolCommandBase {
  readonly metadata: IToolCommandMetadata = {
    name: "reload",
    description: "Re-scan project files and refresh the item list",
    category: "Project",
    requiresProject: true,
    isWriteCommand: false,
    examples: ["/reload"],
  };

  async execute(
    context: IToolCommandContext,
    _args: string[],
    _flags: Record<string, string | boolean | string[]>
  ): Promise<IToolCommandResult> {
    if (!context.project) {
      context.output.error("No active project — open a project before running /reload.");
      return this.error("NO_PROJECT", "No active project");
    }

    const project = context.project;
    const before = project.items.length;

    try {
      context.output.info(`Reloading project '${project.name}'...`);
      await project.inferProjectItemsFromFiles(true);
      const after = project.items.length;
      const delta = after - before;
      const deltaStr = delta === 0 ? "no change" : delta > 0 ? `+${delta}` : `${delta}`;

      context.output.success(`Reloaded '${project.name}': ${after} item(s) (${deltaStr}).`);

      return this.success(`Reloaded ${after} items`, {
        projectName: project.name,
        itemCountBefore: before,
        itemCountAfter: after,
        delta,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      context.output.error(`Reload failed: ${message}`);
      return this.error("RELOAD_ERROR", `Failed to reload project: ${message}`);
    }
  }
}

export const reloadProjectCommand = new ReloadProjectCommand();
