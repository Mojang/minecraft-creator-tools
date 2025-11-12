// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import Project from "./Project";
import ITool, { ToolType, ToolScope } from "./ITool";
import { ProjectItemType } from "./IProjectItemData";
import CreatorTools from "./CreatorTools";
import CommandRunner from "./CommandRunner";

export default class ProjectTools {
  static async addGlobalTools(tools: ITool[]) {
    tools.push({
      title: "Reload",
      type: ToolType.reload,
      scope: ToolScope.global,
    });

    tools.push({
      title: "Hello World",
      type: ToolType.say,
      parameter1: "Hello from Minecraft Creator Tools.",
      scope: ToolScope.global,
    });
  }

  static generateTools(creatorTools: CreatorTools, project?: Project) {
    const tools: ITool[] = [];

    ProjectTools.addGlobalTools(tools);

    for (let i = 0; i < 10; i++) {
      const ctool = creatorTools.getCustomTool(i);

      if (ctool.text && ctool.text.length > 3) {
        let title = ctool.name;

        if (!title || title.length < 1) {
          title = "Tool " + (i + 1).toString();
        }
        tools.push({
          title: title,
          type: ToolType.customTool,
          scope: ToolScope.global,
          parameter1: i.toString(),
        });
      }
    }

    if (project) {
      for (let i = 0; i < project.items.length; i++) {
        const pi = project.items[i];

        if (pi.itemType === ProjectItemType.structure && pi.projectPath !== null) {
          let structureName = pi.name;

          structureName = structureName.replace(".mcstructure", "");

          const tool: ITool = {
            title: "Push " + structureName + " to Minecraft",
            type: ToolType.pushStructure,
            scope: ToolScope.project,
            parameter1: pi.projectPath,
          };

          tools.push(tool);
        }
      }
    }

    return tools;
  }

  static async executeTool(tool: ITool, creatorTools: CreatorTools, project?: Project) {
    switch (tool.type) {
      case ToolType.customTool:
        if (tool.parameter1) {
          CommandRunner.runCustomTool(creatorTools, parseInt(tool.parameter1) + 1);
        }
        break;
      case ToolType.reload:
        ProjectTools.reload(creatorTools);
        break;
      case ToolType.say:
        if (tool.parameter1 && tool.parameter1.length > 0) {
          ProjectTools.say(creatorTools, tool.parameter1);
        }
        break;
    }
  }

  static async reload(creatorTools: CreatorTools) {
    await creatorTools.runMinecraftCommand("reload");
  }

  static async say(creatorTools: CreatorTools, message: string) {
    await creatorTools.runMinecraftCommand("say " + message);
  }
}
