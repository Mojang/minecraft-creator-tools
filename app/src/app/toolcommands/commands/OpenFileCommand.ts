// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * OpenFileCommand - Locate a project item by name or path (slash command: `/find`)
 *
 * Search-only: takes a filename / path fragment, finds the matching project
 * item (by name or by `projectPath` substring), and prints its full project
 * path. Intentionally NOT named `/open` — actual "open in editor" navigation
 * depends on UI integration outside the ToolCommand layer, and a `/open`
 * that doesn't open is more surprising than helpful. Reserve `/open` for
 * when navigation is wired through `onActiveProjectItemChangeRequested`
 * (see ProjectAddButton for the existing pattern).
 */

import type { IToolCommandMetadata, IToolCommandResult } from "../IToolCommand";
import { ToolCommandBase } from "../IToolCommand";
import type { IToolCommandContext } from "../IToolCommandContext";
import { projectItemNameProvider } from "../AutocompleteProviders";

export class OpenFileCommand extends ToolCommandBase {
  readonly metadata: IToolCommandMetadata = {
    name: "find",
    description: "Find a project item by name or path and print its location",
    aliases: ["locate", "f"],
    category: "Project",
    requiresProject: true,
    arguments: [
      {
        name: "filename",
        description: "Name or path fragment of the item to locate",
        type: "string",
        required: true,
        autocompleteProvider: projectItemNameProvider,
      },
    ],
    isWriteCommand: false,
    examples: ["/find my_entity", "/locate behavior_pack/entities/sheep.json"],
  };

  async execute(
    context: IToolCommandContext,
    args: string[],
    _flags: Record<string, string | boolean | string[]>
  ): Promise<IToolCommandResult> {
    if (!context.project) {
      context.output.error("No active project — open a project before running /find.");
      return this.error("NO_PROJECT", "No active project");
    }

    const validationError = this.validateRequiredArgs(args);
    if (validationError) return validationError;

    const query = args[0];
    const lower = query.toLowerCase();
    const items = context.project.items || [];

    const matches = items.filter((item) => {
      const name = (item.name || "").toLowerCase();
      const path = (item.projectPath || "").toLowerCase();
      return name === lower || name.includes(lower) || path.includes(lower);
    });

    if (matches.length === 0) {
      const message = `No project item matches '${query}'.`;
      context.output.warn(message);
      return this.error("ITEM_NOT_FOUND", message);
    }

    const exact = matches.find((item) => (item.name || "").toLowerCase() === lower);
    const primary = exact || matches[0];

    context.output.success(`Found: ${primary.name}`);
    if (primary.projectPath) {
      context.output.info(`Path: ${primary.projectPath}`);
    }

    if (matches.length > 1) {
      context.output.info(`(${matches.length - 1} other match${matches.length - 1 === 1 ? "" : "es"})`);
      const limit = Math.min(matches.length, 6);
      for (let i = 0; i < limit; i++) {
        const m = matches[i];
        if (m === primary) continue;
        context.output.info(`  • ${m.name} — ${m.projectPath || "(no path)"}`);
      }
    }

    return this.success(`Located ${primary.name}`, {
      query,
      match: {
        name: primary.name,
        projectPath: primary.projectPath,
        itemType: primary.itemType,
      },
      totalMatches: matches.length,
    });
  }
}

export const openFileCommand = new OpenFileCommand();
