// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * SwitchModeCommand - Switch the global edit-preference mode
 *
 * Updates `creatorTools.editPreference` to one of the three
 * built-in modes:
 *   - focused → CreatorToolsEditPreference.summarized
 *   - full    → CreatorToolsEditPreference.editors
 *   - raw     → CreatorToolsEditPreference.raw
 *
 * The new preference is persisted via creatorTools.save() so the
 * choice survives a reload.
 */

import type { IToolCommandMetadata, IToolCommandResult } from "../IToolCommand";
import { ToolCommandBase } from "../IToolCommand";
import type { IToolCommandContext } from "../IToolCommandContext";
import { CreatorToolsEditPreference } from "../../ICreatorToolsData";

const MODE_CHOICES = ["focused", "full", "raw"] as const;
type ModeChoice = (typeof MODE_CHOICES)[number];

const MODE_TO_PREFERENCE: Record<ModeChoice, CreatorToolsEditPreference> = {
  focused: CreatorToolsEditPreference.summarized,
  full: CreatorToolsEditPreference.editors,
  raw: CreatorToolsEditPreference.raw,
};

const MODE_DESCRIPTIONS: Record<ModeChoice, string> = {
  focused: "Focused mode — simplified, summary-first editing surface.",
  full: "Full mode — complete file access with visual form-based editors.",
  raw: "Raw mode — direct JSON / text editing of every file in the project.",
};

export class SwitchModeCommand extends ToolCommandBase {
  readonly metadata: IToolCommandMetadata = {
    name: "mode",
    description: "Switch the editor mode (focused | full | raw)",
    aliases: ["setmode"],
    category: "General",
    arguments: [
      {
        name: "mode",
        description: "Edit-preference mode to switch to",
        type: "choice",
        required: true,
        choices: [...MODE_CHOICES],
      },
    ],
    isWriteCommand: false,
    examples: ["/mode focused", "/mode full", "/mode raw", "/setmode raw"],
  };

  async execute(
    context: IToolCommandContext,
    args: string[],
    _flags: Record<string, string | boolean | string[]>
  ): Promise<IToolCommandResult> {
    const validationError = this.validateRequiredArgs(args);
    if (validationError) return validationError;

    if (!context.creatorTools) {
      context.output.error("No CreatorTools instance available — cannot change edit preference.");
      return this.error("NO_CREATOR_TOOLS", "No CreatorTools instance available.");
    }

    const requested = (args[0] || "").toLowerCase() as ModeChoice;
    if (!MODE_CHOICES.includes(requested)) {
      const message = `Unknown mode '${args[0]}'. Choose one of: ${MODE_CHOICES.join(", ")}.`;
      context.output.error(message);
      return this.error("INVALID_MODE", message);
    }

    const preference = MODE_TO_PREFERENCE[requested];

    try {
      context.creatorTools.editPreference = preference;
      await context.creatorTools.save();

      context.output.success(`Edit mode set to '${requested}'.`);
      context.output.info(MODE_DESCRIPTIONS[requested]);

      return this.success(`Edit mode set to '${requested}'`, {
        mode: requested,
        preference,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      context.output.error(`Failed to switch mode: ${message}`);
      return this.error("MODE_SWITCH_ERROR", `Failed to switch mode: ${message}`);
    }
  }

  async getCompletions(
    _context: IToolCommandContext,
    _args: string[],
    partialArg: string,
    argIndex: number
  ): Promise<string[]> {
    if (argIndex !== 0) return [];
    const lower = partialArg.toLowerCase();
    return MODE_CHOICES.filter((m) => m.startsWith(lower));
  }
}

export const switchModeCommand = new SwitchModeCommand();
