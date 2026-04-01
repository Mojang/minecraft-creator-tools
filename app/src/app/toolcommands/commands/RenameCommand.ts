// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * RenameCommand - Rename content in a Minecraft project
 *
 * Renames a project item, updating the identifier inside its JSON
 * and cascading the rename to related files:
 *   - Entity behavior → resource entity, spawn rules
 *   - Entity resource → (file + identifier only)
 */

import type { IToolCommandMetadata, IToolCommandResult } from "../IToolCommand";
import { ToolCommandBase } from "../IToolCommand";
import type { IToolCommandContext } from "../IToolCommandContext";
import { projectItemNameProvider } from "../AutocompleteProviders";
import { ProjectItemType } from "../../IProjectItemData";
import EntityTypeDefinition from "../../../minecraft/EntityTypeDefinition";
import EntityTypeResourceDefinition from "../../../minecraft/EntityTypeResourceDefinition";
import SpawnRulesBehaviorDefinition from "../../../minecraft/SpawnRulesBehaviorDefinition";
import type Project from "../../Project";
import type ProjectItem from "../../ProjectItem";

export class RenameCommand extends ToolCommandBase {
  readonly metadata: IToolCommandMetadata = {
    name: "rename",
    description: "Rename a content item in the project",
    aliases: ["mv", "move"],
    category: "Content",
    requiresProject: true,
    arguments: [
      {
        name: "oldName",
        description: "Current name or path of the item",
        type: "string",
        required: true,
        autocompleteProvider: projectItemNameProvider,
      },
      {
        name: "newName",
        description: "New name for the item",
        type: "string",
        required: true,
      },
    ],
    isWriteCommand: true,
    examples: ["/rename my_old_entity my_new_entity", "/rename old_block cool_block"],
  };

  async execute(
    context: IToolCommandContext,
    args: string[],
    _flags: Record<string, string | boolean | string[]>
  ): Promise<IToolCommandResult> {
    const oldName = args[0];
    const newName = args[1];

    if (!context.project) {
      return this.error("NO_PROJECT", "No active project");
    }

    // Validate required args
    const validationError = this.validateRequiredArgs(args);
    if (validationError) return validationError;

    // Find the item
    const items = context.project.items || [];
    let item = items.find((i) => i.name.toLowerCase() === oldName.toLowerCase() || i.projectPath?.includes(oldName));

    if (!item) {
      return this.error("ITEM_NOT_FOUND", `Item '${oldName}' not found in project`);
    }

    const originalName = item.name;

    try {
      const renamedFiles: string[] = [originalName];

      if (item.itemType === ProjectItemType.entityTypeBehavior) {
        await this._cascadeEntityBehaviorRename(context.project, item, newName, renamedFiles);
      } else if (item.itemType === ProjectItemType.entityTypeResource) {
        await this._cascadeEntityResourceRename(item, newName);
      }

      // Rename the primary item's file
      await item.rename(newName);

      await context.project.save();

      if (renamedFiles.length > 1) {
        context.output.success(
          `Renamed '${originalName}' to '${newName}' (also updated: ${renamedFiles.slice(1).join(", ")})`
        );
      } else {
        context.output.success(`Renamed '${originalName}' to '${newName}'`);
      }
      return this.success(`Renamed ${originalName} to ${newName}`, {
        oldName: originalName,
        newName,
        renamedFiles,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return this.error("RENAME_ERROR", `Failed to rename item: ${message}`);
    }
  }

  /**
   * Builds a new entity identifier by replacing the short name portion.
   * E.g., "myns:old_mob" + "new_mob" → "myns:new_mob"
   */
  private _buildNewEntityId(oldId: string, newShortName: string): string {
    const colonIndex = oldId.indexOf(":");
    if (colonIndex >= 0) {
      return oldId.substring(0, colonIndex + 1) + newShortName;
    }
    return newShortName;
  }

  /**
   * Cascades a rename from an entity behavior item to its resource entity
   * and spawn rules. Updates identifiers in JSON and renames related files.
   */
  private async _cascadeEntityBehaviorRename(
    project: Project,
    behaviorItem: ProjectItem,
    newName: string,
    renamedFiles: string[]
  ) {
    // Load the behavior definition with comment preservation for safe editing
    if (!behaviorItem.isContentLoaded) {
      await behaviorItem.loadContent();
    }

    const primaryFile = behaviorItem.primaryFile;
    if (!primaryFile) {
      return;
    }

    const etd = await EntityTypeDefinition.ensureOnFile(primaryFile, undefined, true);
    if (!etd || !etd.id) {
      return;
    }

    const oldEntityId = etd.id;
    const newEntityId = this._buildNewEntityId(oldEntityId, newName);

    // Update the behavior entity's identifier
    etd.id = newEntityId;
    etd.persist();

    // Find and update matching resource entities
    const resourceItems = project.getItemsByType(ProjectItemType.entityTypeResource);
    for (const resItem of resourceItems) {
      if (!resItem.isContentLoaded) {
        await resItem.loadContent();
      }

      if (resItem.primaryFile) {
        const etrd = await EntityTypeResourceDefinition.ensureOnFile(resItem.primaryFile);
        if (etrd && etrd.id === oldEntityId) {
          const oldResName = resItem.name;
          // Re-load with comment preservation for editing
          await etrd.load(true);
          etrd.id = newEntityId;
          etrd.persist();
          await resItem.rename(newName);
          renamedFiles.push(oldResName);
        }
      }
    }

    // Find and update matching spawn rules
    const spawnRuleItems = project.getItemsByType(ProjectItemType.spawnRuleBehavior);
    for (const srItem of spawnRuleItems) {
      if (!srItem.isContentLoaded) {
        await srItem.loadContent();
      }

      if (srItem.primaryFile) {
        const srb = await SpawnRulesBehaviorDefinition.ensureOnFile(srItem.primaryFile);
        if (srb && srb.id === oldEntityId) {
          const oldSrName = srItem.name;
          // Re-load with comment preservation for editing
          await srb.load(true);
          srb.id = newEntityId;
          srb.persist();
          await srItem.rename(newName);
          renamedFiles.push(oldSrName);
        }
      }
    }
  }

  /**
   * Updates the identifier inside an entity resource definition when
   * the resource item itself is being renamed directly.
   */
  private async _cascadeEntityResourceRename(resourceItem: ProjectItem, newName: string) {
    if (!resourceItem.isContentLoaded) {
      await resourceItem.loadContent();
    }

    const primaryFile = resourceItem.primaryFile;
    if (!primaryFile) {
      return;
    }

    const etrd = await EntityTypeResourceDefinition.ensureOnFile(primaryFile);
    if (!etrd || !etrd.id) {
      return;
    }

    const newEntityId = this._buildNewEntityId(etrd.id, newName);
    await etrd.load(true);
    etrd.id = newEntityId;
    etrd.persist();
  }
}

export const renameCommand = new RenameCommand();
