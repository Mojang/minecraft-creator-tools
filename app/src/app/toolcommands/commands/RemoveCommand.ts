// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * RemoveCommand - Remove content from a Minecraft project
 *
 * Removes a project item by path or name.
 */

import type { IToolCommandMetadata, IToolCommandResult } from "../IToolCommand";
import { ToolCommandBase } from "../IToolCommand";
import type { IToolCommandContext } from "../IToolCommandContext";
import { projectItemProvider } from "../AutocompleteProviders";

export class RemoveCommand extends ToolCommandBase {
  readonly metadata: IToolCommandMetadata = {
    name: "remove",
    description: "Remove content from the current project",
    aliases: ["rm", "delete"],
    category: "Content",
    requiresProject: true,
    arguments: [
      {
        name: "path",
        description: "Path or name of the item to remove",
        type: "path",
        required: true,
        autocompleteProvider: projectItemProvider,
      },
    ],
    flags: [
      {
        name: "force",
        shortName: "f",
        description: "Skip confirmation",
        type: "boolean",
        isBoolean: true,
      },
    ],
    isWriteCommand: true,
    examples: ["/remove entities/my_entity.json", "/remove my_entity", "/remove --force old_script.ts"],
  };

  async execute(
    context: IToolCommandContext,
    args: string[],
    flags: Record<string, string | boolean | string[]>
  ): Promise<IToolCommandResult> {
    const validationError = this.validateRequiredArgs(args);
    if (validationError) {
      return validationError;
    }

    const pathOrName = args[0];
    const force = flags.force as boolean;

    if (!context.project) {
      return this.error("NO_PROJECT", "No active project");
    }

    // Find the item by path or name
    const items = context.project.items || [];
    let itemToRemove = items.find(
      (item) => item.projectPath === pathOrName || item.projectPath?.endsWith("/" + pathOrName)
    );

    // Also try by name
    if (!itemToRemove) {
      itemToRemove = items.find((item) => item.name.toLowerCase() === pathOrName.toLowerCase());
    }

    if (!itemToRemove) {
      return this.error("ITEM_NOT_FOUND", `Item '${pathOrName}' not found in project`);
    }

    // When --force is not specified, log that the item is being removed.
    // Future: add interactive confirmation prompt when not forced.
    if (!force) {
      context.output.info(`Removing '${itemToRemove.projectPath || itemToRemove.name}'...`);
    }

    try {
      context.project.removeItem(itemToRemove);
      await context.project.save();

      context.output.success(`Removed '${itemToRemove.name}'`);
      return this.success(`Removed ${itemToRemove.name}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return this.error("REMOVE_ERROR", `Failed to remove item: ${message}`);
    }
  }
}

export const removeCommand = new RemoveCommand();
