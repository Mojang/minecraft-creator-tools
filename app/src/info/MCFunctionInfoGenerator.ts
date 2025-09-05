// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import ProjectInfoItem from "./ProjectInfoItem";
import IProjectInfoGenerator from "./IProjectInfoGenerator";
import { InfoItemType } from "./IInfoItemData";
import ProjectInfoSet from "./ProjectInfoSet";
import ProjectInfoUtilities from "./ProjectInfoUtilities";
import CommandStructure from "../app/CommandStructure";
import CommandRegistry from "../app/CommandRegistry";
import { ProjectItemType } from "../app/IProjectItemData";
import Project from "../app/Project";
import ProjectItem from "../app/ProjectItem";

export enum MCFunctionInfoGeneratorTest {
  invalidCommandSyntax = 102,
  lineBeginsWithSlash = 103,
}

/***********
 * Generator for validating MCFunction Files
 *
 * Will ensure:
 *  * command syntax is correct
 *  * no slashes are present before commands
 *
 */

export default class MCFunctionInfoGenerator implements IProjectInfoGenerator {
  id = "MCFUNCTION";
  title = "MC Function Validation";

  getTopicData(topicId: number) {
    return {
      title: ProjectInfoUtilities.getTitleFromEnum(MCFunctionInfoGeneratorTest, topicId),
    };
  }

  summarize(info: any, infoSet: ProjectInfoSet) {
    info.invalidCommandSyntaxCount = infoSet.getSummedDataValue(
      this.id,
      MCFunctionInfoGeneratorTest.invalidCommandSyntax
    );

    info.linesWithSlashCount = infoSet.getSummedDataValue(this.id, MCFunctionInfoGeneratorTest.lineBeginsWithSlash);
  }

  async generate(project: Project): Promise<ProjectInfoItem[]> {
    const items: ProjectInfoItem[] = [];

    const projItems = project.getItemsCopy();

    for (const item of projItems) {
      if (item.itemType !== ProjectItemType.MCFunction) {
        continue;
      }

      if (!item.isContentLoaded) {
        await item.loadContent();
      }
      if (!item.primaryFile) {
        continue;
      }

      if (!item.primaryFile.isContentLoaded) {
        await item.primaryFile.loadContent();
      }

      const content = item.primaryFile.content;

      if (!content || typeof content !== "string") {
        continue;
      }

      const lines = content
        .trim()
        .split(/\r?\n/)
        .filter((line) => line.trim() !== "");

      const commands = lines.map(CommandStructure.parse);

      items.push(...this.getNewLineBeginsWithSlashesResult(lines, item));
      items.push(...this.getCommandSyntaxResult(commands, item));
    }

    return items;
  }

  private getNewLineBeginsWithSlashesResult(lines: string[], item: ProjectItem): ProjectInfoItem[] {
    const results = [];
    for (const line of lines) {
      if (line.startsWith("/")) {
        results.push(
          new ProjectInfoItem(
            InfoItemType.warning,
            this.id,
            MCFunctionInfoGeneratorTest.lineBeginsWithSlash,
            this.getTopicData(MCFunctionInfoGeneratorTest.lineBeginsWithSlash).title,
            item,
            `Relevant line: ${line}`
          )
        );
      }
    }

    return results;
  }

  private getCommandSyntaxResult(commands: CommandStructure[], item: ProjectItem): ProjectInfoItem[] {
    const results = [];

    for (const command of commands) {
      if (
        !CommandRegistry.isMinecraftBuiltInCommand(command.name) &&
        !CommandRegistry.isAddOnBlockedCommand(command.name)
      ) {
        results.push(
          new ProjectInfoItem(
            InfoItemType.error,
            this.id,
            MCFunctionInfoGeneratorTest.invalidCommandSyntax,
            this.getTopicData(MCFunctionInfoGeneratorTest.invalidCommandSyntax).title,
            item,
            `${command.name} ${command.commandArguments.join(" ")}`
          )
        );
      }
    }

    return results;
  }
}
