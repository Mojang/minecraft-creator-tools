// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * AddCommand - Add content to a Minecraft project
 *
 * This ToolCommand provides content addition capabilities across all surfaces.
 * It uses ProjectItemCreateManager to add items from gallery templates.
 *
 * Supports adding:
 * - Entity types (with optional traits)
 * - Block types (with optional traits)
 * - Item types (with optional traits)
 * - Scripts, functions, spawn rules, etc.
 */

import type { IToolCommandMetadata, IToolCommandResult } from "../IToolCommand";
import { ToolCommandBase } from "../IToolCommand";
import type { IToolCommandContext } from "../IToolCommandContext";
import {
  contentTypeProvider,
  createGalleryItemProvider,
  allTraitsProvider,
  CONTENT_TYPE_TO_GALLERY,
} from "../AutocompleteProviders";
import ProjectItemCreateManager from "../../ProjectItemCreateManager";
import { ProjectFocus } from "../../IProjectData";

export class AddCommand extends ToolCommandBase {
  readonly metadata: IToolCommandMetadata = {
    name: "add",
    description: "Add new content to the current project",
    aliases: ["a"],
    category: "Content",
    arguments: [
      {
        name: "type",
        description: "Type of content to add (entity, block, item, script, etc.) or gallery template ID",
        type: "string",
        required: true,
        autocompleteProvider: contentTypeProvider,
      },
      {
        name: "name",
        description: "Name for the new content item",
        type: "identifier",
        required: true,
      },
    ],
    flags: [
      {
        name: "traits",
        shortName: "t",
        description: "Comma-separated list of traits to apply (e.g., hostile,melee_attacker)",
        type: "stringArray",
        autocompleteProvider: allTraitsProvider,
      },
      {
        name: "template",
        description: "Specific gallery template ID to use",
        type: "string",
        autocompleteProvider: createGalleryItemProvider(),
      },
    ],
    isWriteCommand: true,
    examples: [
      "/add entity my_mob",
      "/add block my_block",
      "/add item my_sword",
      "/add script my_behavior",
      "/add allay custom_allay",
    ],
  };

  async execute(
    context: IToolCommandContext,
    args: string[],
    flags: Record<string, string | boolean | string[]>
  ): Promise<IToolCommandResult> {
    const validationError = this.validateRequiredArgs(args);
    if (validationError) {
      return validationError;
    }

    const typeOrTemplate = args[0];
    const name = args[1];
    const traits = flags.traits as string[] | undefined;
    const explicitTemplate = flags.template as string | undefined;

    if (!context.creatorTools) {
      return this.error("NO_CREATOR_TOOLS", "No CreatorTools instance available.");
    }

    const creatorTools = context.creatorTools;

    // If no project is open, auto-create an addon starter project first
    if (!context.project) {
      context.output.info("No project open. Creating a new Add-On Starter project...");

      await creatorTools.loadGallery();

      const starterTemplate = await creatorTools.getGalleryProjectById("addonstarter");
      if (!starterTemplate) {
        return this.error("TEMPLATE_NOT_FOUND", "Could not find the Add-On Starter template.");
      }

      const newProjectName = await creatorTools.getNewProjectName("my-project");
      let project = await creatorTools.createNewProject(
        newProjectName,
        undefined,
        undefined,
        undefined,
        ProjectFocus.general,
        false,
        undefined
      );

      if (!project) {
        return this.error("PROJECT_ERROR", "Could not create project.");
      }

      const ProjectExporter = (await import("../../ProjectExporter")).default;

      project = await ProjectExporter.syncProjectFromGitHub(
        true,
        creatorTools,
        starterTemplate.gitHubRepoName,
        starterTemplate.gitHubOwner,
        starterTemplate.gitHubBranch,
        starterTemplate.gitHubFolder,
        newProjectName,
        project,
        starterTemplate.fileList,
        async (message: string) => {
          context.output.debug(message);
        },
        true
      );

      await project.save();

      context.project = project;
      context.output.info(`Created project '${newProjectName}'.`);
    }

    // Load gallery
    await creatorTools.loadGallery();

    if (!creatorTools.gallery) {
      return this.error("GALLERY_ERROR", "Could not load project gallery");
    }

    // Try to find as direct gallery item first
    let galleryItem = await creatorTools.getGalleryProjectById(explicitTemplate || typeOrTemplate);

    // If not found, map content type to gallery type and find default template
    if (!galleryItem) {
      const galleryType = CONTENT_TYPE_TO_GALLERY[typeOrTemplate.toLowerCase()];

      if (galleryType !== undefined) {
        // Get all items of this type
        const items = creatorTools.getGalleryProjectByType(galleryType);

        if (items && items.length > 0) {
          // Use first item as default template
          galleryItem = items[0];
          context.output.debug(`Using template '${galleryItem.id}' for type '${typeOrTemplate}'`);
        }
      }
    }

    if (!galleryItem) {
      // List what's available
      const gallery = creatorTools.gallery;
      const types = Object.keys(CONTENT_TYPE_TO_GALLERY).join(", ");
      const templates = gallery.items
        .slice(0, 10)
        .map((i) => i.id)
        .join(", ");
      return this.error(
        "TYPE_NOT_FOUND",
        `Unknown type or template '${typeOrTemplate}'. Valid types: ${types}. Example templates: ${templates}...`
      );
    }

    context.output.info(`Adding '${name}' from template '${galleryItem.title}'...`);

    try {
      // Add from gallery
      await ProjectItemCreateManager.addFromGallery(context.project, name, galleryItem);

      // LIMITATION: Trait application is not yet implemented.
      // Applying traits (e.g., "rideable", "tameable") requires integration with
      // ContentIndexManager for trait-based content generation. The trait definitions
      // exist in AutocompleteProviders.ts but the generation pipeline is not wired up.
      // Tracked as a future enhancement.
      if (traits && traits.length > 0) {
        context.output.warn(`Traits requested (${traits.join(", ")}) but trait application is not yet implemented.`);
      }

      await context.project.save();

      context.output.success(`Added '${name}' to project`);

      return this.success(`Added ${name}`, {
        name,
        template: galleryItem.id,
        type: typeOrTemplate,
        traits: traits || [],
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return this.error("ADD_ERROR", `Failed to add content: ${message}`);
    }
  }

  /**
   * Custom completions based on argument position and type context.
   */
  async getCompletions(
    context: IToolCommandContext,
    args: string[],
    partialArg: string,
    argIndex: number
  ): Promise<string[]> {
    const lower = partialArg.toLowerCase();

    if (argIndex === 0) {
      // Complete content types and template IDs
      const types = Object.keys(CONTENT_TYPE_TO_GALLERY).filter((t) => t.startsWith(lower));

      // Also include gallery item IDs
      if (context.creatorTools) {
        await context.creatorTools.loadGallery();
        const gallery = context.creatorTools.gallery;
        const templateIds = gallery?.items.filter((i) => i.id.toLowerCase().startsWith(lower)).map((i) => i.id) || [];
        return [...types, ...templateIds];
      }

      return types;
    }

    return [];
  }
}

export const addCommand = new AddCommand();
