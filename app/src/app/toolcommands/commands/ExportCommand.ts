// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * ExportCommand - Hint for exporting the current project as a .mcaddon
 *
 * The slash-bar version is intentionally informational — actual
 * .mcaddon packaging is best driven from the Project Actions
 * "Export" dropdown (which orchestrates dialogs, file pickers,
 * and pack selection). This command tells the user where to go.
 */

import type { IToolCommandMetadata, IToolCommandResult } from "../IToolCommand";
import { ToolCommandBase } from "../IToolCommand";
import type { IToolCommandContext } from "../IToolCommandContext";

export class ExportCommand extends ToolCommandBase {
  readonly metadata: IToolCommandMetadata = {
    name: "export",
    description: "Show how to export the current project as a .mcaddon",
    aliases: ["exportaddon"],
    category: "Project",
    requiresProject: true,
    isWriteCommand: false,
    examples: ["/export", "/exportaddon"],
  };

  async execute(
    context: IToolCommandContext,
    _args: string[],
    _flags: Record<string, string | boolean | string[]>
  ): Promise<IToolCommandResult> {
    if (!context.project) {
      context.output.error("No active project — open a project before running /export.");
      return this.error("NO_PROJECT", "No active project");
    }

    const project = context.project;
    const message =
      `To export '${project.name}' as a .mcaddon, open the project's ` +
      `Actions panel and use the "Export" dropdown. The dropdown lets you ` +
      `select packs, choose an output folder, and produce .mcaddon / .mcpack files.`;

    context.output.info(message);
    context.output.info("Tip: from the CLI you can also run `npx mct exportaddon -i <project-folder>`.");

    return this.success("Displayed export instructions", {
      projectName: project.name,
      hint: "Use Project Actions → Export dropdown",
    });
  }
}

export const exportCommand = new ExportCommand();
