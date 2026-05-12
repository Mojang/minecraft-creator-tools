// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * DeployCommand - Hint for deploying the current project
 *
 * Real deployment requires filesystem access (e.g. com.mojang
 * folder on Windows) and is only available in the Electron host
 * or via the CLI. The slash-bar version is informational — it
 * directs the user to the Project Actions "Deploy" dropdown.
 */

import type { IToolCommandMetadata, IToolCommandResult } from "../IToolCommand";
import { ToolCommandBase } from "../IToolCommand";
import type { IToolCommandContext } from "../IToolCommandContext";
import CreatorToolsHost, { HostType } from "../../CreatorToolsHost";

export class DeployCommand extends ToolCommandBase {
  readonly metadata: IToolCommandMetadata = {
    name: "deploy",
    description: "Show how to deploy the current project to a Minecraft instance",
    aliases: ["dp"],
    category: "Project",
    requiresProject: true,
    isWriteCommand: false,
    examples: ["/deploy", "/dp"],
  };

  async execute(
    context: IToolCommandContext,
    _args: string[],
    _flags: Record<string, string | boolean | string[]>
  ): Promise<IToolCommandResult> {
    if (!context.project) {
      context.output.error("No active project — open a project before running /deploy.");
      return this.error("NO_PROJECT", "No active project");
    }

    const isWebOnly =
      CreatorToolsHost.hostType === HostType.web || CreatorToolsHost.hostType === HostType.webPlusServices;

    if (isWebOnly) {
      context.output.warn(
        "Web builds cannot deploy to your Minecraft installation — deployment requires filesystem access."
      );
      context.output.info(
        "Open this project in the Electron desktop app, the VS Code extension, or run the CLI " +
          "(`npx mct deploy`) to push packs to com.mojang."
      );
    } else {
      context.output.info(
        `To deploy '${context.project.name}', open the project's Actions panel and use the ` +
          `"Deploy" dropdown to push to your local Minecraft installation, a dedicated server, ` +
          `or another configured target.`
      );
      context.output.info("Tip: from the CLI you can also run `npx mct deploy -i <project-folder>`.");
    }

    return this.success("Displayed deploy instructions", {
      projectName: context.project.name,
      hostType: CreatorToolsHost.hostType,
      hint: "Use Project Actions → Deploy dropdown",
    });
  }
}

export const deployCommand = new DeployCommand();
