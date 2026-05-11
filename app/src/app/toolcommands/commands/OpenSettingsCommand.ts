// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * OpenSettingsCommand - Pointer to the Settings panel
 *
 * Informational only. Tells the user where to find the Settings
 * panel (CreatorToolsSettingsPanel) so they can adjust theme,
 * mode, format-on-save, and other preferences. The slash bar
 * does not navigate the UI directly.
 */

import type { IToolCommandMetadata, IToolCommandResult } from "../IToolCommand";
import { ToolCommandBase } from "../IToolCommand";
import type { IToolCommandContext } from "../IToolCommandContext";

export class OpenSettingsCommand extends ToolCommandBase {
  readonly metadata: IToolCommandMetadata = {
    name: "settings",
    description: "Show how to open the Settings panel",
    aliases: ["prefs"],
    category: "General",
    isWriteCommand: false,
    examples: ["/settings", "/prefs"],
  };

  async execute(
    context: IToolCommandContext,
    _args: string[],
    _flags: Record<string, string | boolean | string[]>
  ): Promise<IToolCommandResult> {
    const lines = [
      "Settings live on the Home screen — click the gear / 'Settings' button on the home page to open the Settings panel.",
      "From there you can change theme, edit mode (Focused / Full / Raw), format-on-save, and other preferences.",
      "Quick alternatives: use /mode <focused|full|raw> to switch edit mode, or /format for formatting guidance.",
    ];

    for (const line of lines) {
      context.output.info(line);
    }

    return this.success("Displayed Settings guidance", {
      hint: "Home page → Settings panel",
    });
  }
}

export const openSettingsCommand = new OpenSettingsCommand();
