// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * CommandHover - Hover content for mcfunction commands
 */

import { IHoverContent, IHoverSection } from "../json/JsonHoverContent";
import { SELECTOR_TYPES, SELECTOR_ARGUMENTS, commandParser } from "./CommandParser";

/**
 * Generate hover content for commands
 */
export class CommandHoverGenerator {
  /**
   * Generate hover for a command
   */
  public generateCommandHover(commandName: string): IHoverContent | null {
    const info = commandParser.getCommandInfo(commandName);
    if (!info) {
      return null;
    }

    const sections: IHoverSection[] = [];

    sections.push({
      markdown: [`### /${info.name}`, "", info.description].join("\n"),
    });

    sections.push({
      markdown: `**Syntax:** \`${info.syntax}\``,
    });

    if (info.examples && info.examples.length > 0) {
      const exampleLines = ["**Examples:**"];
      for (const example of info.examples) {
        exampleLines.push(`\`\`\`\n${example}\n\`\`\``);
      }
      sections.push({ markdown: exampleLines.join("\n") });
    }

    if (info.operatorOnly) {
      sections.push({ markdown: "⚠️ *Requires operator permissions*" });
    }

    return { sections };
  }

  /**
   * Generate hover for a selector
   */
  public generateSelectorHover(selectorText: string): IHoverContent | null {
    const selector = commandParser.parseSelector(selectorText);

    const typeInfo = SELECTOR_TYPES[selector.type];
    if (!typeInfo) {
      return null;
    }

    const sections: IHoverSection[] = [];

    sections.push({
      markdown: [`### @${selector.type}`, "", typeInfo.description].join("\n"),
    });

    // Show parsed arguments
    if (selector.arguments.size > 0) {
      const argLines = ["**Arguments:**"];
      for (const [key, value] of selector.arguments) {
        const argInfo = SELECTOR_ARGUMENTS.find((a) => a.name === key);
        const desc = argInfo ? ` - ${argInfo.description}` : "";
        argLines.push(`- \`${key}=${value}\`${desc}`);
      }
      sections.push({ markdown: argLines.join("\n") });
    }

    sections.push({
      markdown: `**Example:** \`${typeInfo.example}\``,
    });

    return { sections };
  }

  /**
   * Generate hover for a selector argument
   */
  public generateSelectorArgumentHover(argumentName: string): IHoverContent | null {
    const argInfo = SELECTOR_ARGUMENTS.find((a) => a.name === argumentName);
    if (!argInfo) {
      return null;
    }

    const sections: IHoverSection[] = [];

    sections.push({
      markdown: [`### ${argInfo.name}`, "", argInfo.description, "", `**Example:** \`${argInfo.example}\``].join("\n"),
    });

    return { sections };
  }

  /**
   * Generate hover for coordinate notation
   */
  public generateCoordinateHover(coordinate: string): IHoverContent | null {
    const sections: IHoverSection[] = [];

    if (coordinate.startsWith("~")) {
      sections.push({
        markdown: [
          "### Relative Coordinate (~)",
          "",
          "Offset from the execution position.",
          "",
          "- `~` = current position",
          "- `~5` = 5 blocks positive",
          "- `~-3` = 3 blocks negative",
          "",
          "**Example:** `~ ~1 ~` = one block above current position",
        ].join("\n"),
      });
    } else if (coordinate.startsWith("^")) {
      sections.push({
        markdown: [
          "### Local Coordinate (^)",
          "",
          "Offset relative to the entity's facing direction.",
          "",
          "- `^` = current position",
          "- First `^` = left/right",
          "- Second `^` = up/down",
          "- Third `^` = forward/backward",
          "",
          "**Example:** `^ ^1 ^2` = 1 up and 2 forward from facing",
        ].join("\n"),
      });
    } else {
      return null;
    }

    return { sections };
  }

  /**
   * Generate hover for a full command line
   */
  public generateLineHover(line: string, offset: number): IHoverContent | null {
    const parsed = commandParser.parseLine(line, 0);

    if (parsed.isComment) {
      return { sections: [{ markdown: "*Comment line*" }] };
    }

    // Check if hovering over command name
    const commandEnd = line.indexOf(" ");
    const commandStart = parsed.hasSlashPrefix ? 1 : 0;

    if (offset <= (commandEnd === -1 ? line.length : commandEnd)) {
      return this.generateCommandHover(parsed.command);
    }

    // Check if hovering over an argument
    for (const arg of parsed.arguments) {
      if (offset >= arg.start && offset <= arg.end) {
        // Selector
        if (arg.selector) {
          return this.generateSelectorHover(arg.value);
        }

        // Coordinate
        if (arg.value.startsWith("~") || arg.value.startsWith("^")) {
          return this.generateCoordinateHover(arg.value);
        }

        // Entity/block/item ID
        if (arg.value.includes(":")) {
          return {
            sections: [
              {
                markdown: [`### ${arg.value}`, "", `Namespaced identifier`].join("\n"),
              },
            ],
          };
        }
      }
    }

    return null;
  }
}

// Singleton instance
export const commandHoverGenerator = new CommandHoverGenerator();
