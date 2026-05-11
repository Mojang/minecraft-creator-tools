// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * ToggleInspectorCommand - Hint for opening the project Inspector tab
 *
 * The Inspector is a UI surface owned by `ProjectEditor`/`App`
 * (ProjectEditorMode.inspector); there is no global toggle on
 * `Project` or `CreatorTools` that can flip it from outside the
 * React tree. This command emits a hint pointing the user at the
 * Inspector tab so they can open it manually.
 */

import type { IToolCommandMetadata, IToolCommandResult } from "../IToolCommand";
import { ToolCommandBase } from "../IToolCommand";
import type { IToolCommandContext } from "../IToolCommandContext";

export class ToggleInspectorCommand extends ToolCommandBase {
  readonly metadata: IToolCommandMetadata = {
    name: "inspector",
    description: "Show how to open the project Inspector view",
    aliases: ["ti"],
    category: "Validation",
    requiresProject: true,
    isWriteCommand: false,
    examples: ["/inspector", "/ti"],
  };

  async execute(
    context: IToolCommandContext,
    _args: string[],
    _flags: Record<string, string | boolean | string[]>
  ): Promise<IToolCommandResult> {
    if (!context.project) {
      context.output.error("No active project — open a project before running /inspector.");
      return this.error("NO_PROJECT", "No active project");
    }

    context.output.info(
      "Open the Inspector by clicking the Inspector tab in the project navigation pane " +
        "(or selecting Inspector from the Actions panel). Use /validate (alias /val) for a " +
        "quick error/warning/recommendation summary directly from this command bar."
    );

    return this.success("Displayed Inspector hint", {
      projectName: context.project.name,
      hint: "Click Inspector tab in project navigation",
    });
  }
}

export const toggleInspectorCommand = new ToggleInspectorCommand();
