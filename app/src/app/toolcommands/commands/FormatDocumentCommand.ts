// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * FormatDocumentCommand - Hint about format-on-save behavior
 *
 * Informational only. Explains that format-on-save is now off by
 * default, that switching back to a visual editor mode reformats
 * the document automatically, and how to re-enable
 * `formatBeforeSave` from the Settings panel.
 */

import type { IToolCommandMetadata, IToolCommandResult } from "../IToolCommand";
import { ToolCommandBase } from "../IToolCommand";
import type { IToolCommandContext } from "../IToolCommandContext";

export class FormatDocumentCommand extends ToolCommandBase {
  readonly metadata: IToolCommandMetadata = {
    name: "format",
    description: "Explain how document formatting works and how to enable format-on-save",
    aliases: ["fmt"],
    category: "General",
    isWriteCommand: false,
    examples: ["/format", "/fmt"],
  };

  async execute(
    context: IToolCommandContext,
    _args: string[],
    _flags: Record<string, string | boolean | string[]>
  ): Promise<IToolCommandResult> {
    const lines = [
      "Format-on-save is OFF by default — your raw JSON / TS files are saved exactly as you typed them.",
      "Switching from Raw mode back to a visual editor (Focused or Full) will reformat the document automatically.",
      "To re-enable format-on-save for ALL saves: open the Settings panel and toggle 'Format documents before saving' ON.",
    ];

    let formatBeforeSave: boolean | undefined;
    if (context.creatorTools) {
      try {
        formatBeforeSave = context.creatorTools.formatBeforeSave;
        lines.push(`Current setting: formatBeforeSave = ${formatBeforeSave ? "on" : "off"}.`);
      } catch {
        // ignore — settings access is best-effort here
      }
    }

    for (const line of lines) {
      context.output.info(line);
    }

    return this.success("Displayed formatting guidance", {
      formatBeforeSave,
      hint: "Settings panel → Format documents before saving",
    });
  }
}

export const formatDocumentCommand = new FormatDocumentCommand();
