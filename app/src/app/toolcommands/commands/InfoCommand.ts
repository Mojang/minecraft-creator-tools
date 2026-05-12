// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * InfoCommand - Display project metadata
 *
 * Prints a short summary of the active project: name, total item
 * count, the number of behavior-pack vs resource-pack items, and
 * the manifest format_version when discoverable. Read-only.
 */

import type { IToolCommandMetadata, IToolCommandResult } from "../IToolCommand";
import { ToolCommandBase } from "../IToolCommand";
import type { IToolCommandContext } from "../IToolCommandContext";
import { ProjectItemType } from "../../IProjectItemData";
import ProjectItemUtilities from "../../ProjectItemUtilities";

export class InfoCommand extends ToolCommandBase {
  readonly metadata: IToolCommandMetadata = {
    name: "info",
    description: "Display metadata about the current project (name, item counts, pack info)",
    aliases: ["i"],
    category: "Project",
    requiresProject: true,
    isWriteCommand: false,
    examples: ["/info", "/i"],
  };

  async execute(
    context: IToolCommandContext,
    _args: string[],
    _flags: Record<string, string | boolean | string[]>
  ): Promise<IToolCommandResult> {
    if (!context.project) {
      context.output.error("No active project — open a project before running /info.");
      return this.error("NO_PROJECT", "No active project");
    }

    const project = context.project;
    const items = project.items || [];

    let bpItemCount = 0;
    let rpItemCount = 0;
    let bpManifestCount = 0;
    let rpManifestCount = 0;

    for (const item of items) {
      if (ProjectItemUtilities.isBehaviorRelated(item.itemType)) {
        bpItemCount++;
      } else if (ProjectItemUtilities.isResourceRelated(item.itemType)) {
        rpItemCount++;
      }

      if (item.itemType === ProjectItemType.behaviorPackManifestJson) {
        bpManifestCount++;
      } else if (item.itemType === ProjectItemType.resourcePackManifestJson) {
        rpManifestCount++;
      }
    }

    const title = project.title || project.name;
    context.output.info(`Project: ${title}`);
    if (project.description) {
      context.output.info(`Description: ${project.description}`);
    }
    context.output.info(`Total items: ${items.length}`);
    context.output.info(
      `Behavior pack: ${bpItemCount} item(s) (${bpManifestCount} manifest${bpManifestCount === 1 ? "" : "s"})`
    );
    context.output.info(
      `Resource pack: ${rpItemCount} item(s) (${rpManifestCount} manifest${rpManifestCount === 1 ? "" : "s"})`
    );

    if (project.defaultBehaviorPackUniqueId) {
      context.output.info(`Default BP uuid: ${project.defaultBehaviorPackUniqueId}`);
    }
    if (project.defaultResourcePackUniqueId) {
      context.output.info(`Default RP uuid: ${project.defaultResourcePackUniqueId}`);
    }

    const summary = `${items.length} items (BP=${bpItemCount}, RP=${rpItemCount})`;
    context.output.success(summary);

    return this.success(summary, {
      name: project.name,
      title,
      description: project.description || "",
      itemCount: items.length,
      behaviorPackItems: bpItemCount,
      resourcePackItems: rpItemCount,
      behaviorPackManifests: bpManifestCount,
      resourcePackManifests: rpManifestCount,
      defaultBehaviorPackUniqueId: project.defaultBehaviorPackUniqueId,
      defaultResourcePackUniqueId: project.defaultResourcePackUniqueId,
    });
  }
}

export const infoCommand = new InfoCommand();
