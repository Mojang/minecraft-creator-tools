// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * AddCommand - Add content to a Minecraft project
 *
 * This ToolCommand provides content addition capabilities across all surfaces.
 *
 * Two modes of operation:
 * 1. **Gallery mode** (default): Adds from pre-built gallery templates.
 *    Example: `/add entity my_mob`
 * 2. **Wizard mode**: Uses ContentGenerator to procedurally create content from
 *    traits and properties — the same engine powering the web Content Wizard.
 *    Activated when `--traits` or any wizard flag is provided.
 *    Example: `/add entity my_orc --traits hostile,melee_attacker,humanoid --health 30`
 *
 * With no project open, add creates an Add-On Starter project to add to. Each mode first
 * validates its input and generates or finds the content, and only then creates that project,
 * so an add that fails (an out-of-range --health, an unknown type, or a gallery template whose
 * files can't be downloaded) leaves no new project behind.
 *
 * @see ContentGenerator.ts for the procedural generation engine
 * @see ContentWriter.ts for writing generated files to a project
 * @see ContentWizard.tsx for the web UI equivalent
 */

import type { IToolCommandMetadata, IToolCommandResult } from "../IToolCommand";
import { ToolCommandBase, ToolCommandScope } from "../IToolCommand";
import type { IToolCommandContext } from "../IToolCommandContext";
import {
  contentTypeProvider,
  createGalleryItemProvider,
  allTraitsProvider,
  CONTENT_TYPE_TO_GALLERY,
  ENTITY_TRAITS,
  BLOCK_TRAITS,
  ITEM_TRAITS,
} from "../AutocompleteProviders";
import ProjectItemCreateManager from "../../ProjectItemCreateManager";
import ProjectCreateManager from "../../ProjectCreateManager";
import ProjectUtilities from "../../ProjectUtilities";
import { ProjectFocus } from "../../IProjectData";
import { ProjectItemType } from "../../IProjectItemData";
import type {
  IMinecraftContentDefinition,
  EntityTraitId,
  BlockTraitId,
  ItemTraitId,
} from "../../../minecraft/IContentMetaSchema";
import type { IGeneratedContent } from "../../../minecraft/ContentGenerator";
import type IGalleryItem from "../../IGalleryItem";

// ============================================================================
// CONSTANTS
// ============================================================================

/** Content types that support wizard-mode generation (traits + properties). */
const WIZARD_CONTENT_TYPES = ["entity", "block", "item"];

/** Entity body-type trait IDs (exclusive — at most one). */
const ENTITY_BODY_TYPES = ["humanoid", "quadruped", "quadruped_small", "flying", "aquatic", "arthropod", "slime"];

/**
 * Maps content type names to their preferred ProjectItemType for template matching.
 */
const CONTENT_TYPE_TO_ITEM_TYPE: Record<string, ProjectItemType> = {
  spawn_rule: ProjectItemType.spawnRuleBehavior,
  loot_table: ProjectItemType.lootTableBehavior,
  trade_table: ProjectItemType.tradingBehaviorJson,
};

// ============================================================================
// AUTOCOMPLETE PROVIDERS FOR WIZARD FLAGS
// ============================================================================

const bodyTypeProvider = (partial: string) => {
  const lower = partial.toLowerCase();
  return ENTITY_BODY_TYPES.filter((t) => t.startsWith(lower));
};

// ============================================================================
// VALIDATION
// ============================================================================

interface IValidationError {
  flag: string;
  message: string;
}

/**
 * Validate wizard flag values and return any errors.
 */
/** Union of all possible flag value types from the command parser. */
export type WizardFlagValue = string | boolean | number | string[];

export function validateWizardFlags(contentType: string, flags: Record<string, WizardFlagValue>): IValidationError[] {
  const errors: IValidationError[] = [];
  const lowerType = contentType.toLowerCase();

  const checkRange = (name: string, min: number, max: number) => {
    const val = flags[name];
    if (val !== undefined) {
      const n = Number(val);
      if (isNaN(n) || n < min || n > max) {
        errors.push({ flag: name, message: `--${name} must be between ${min} and ${max} (got ${val})` });
      }
    }
  };

  const checkColor = (name: string) => {
    const val = flags[name] as string | undefined;
    if (val !== undefined && !/^#[0-9a-fA-F]{6}$/.test(val)) {
      errors.push({ flag: name, message: `--${name} must be a hex color like #FF0000 (got ${val})` });
    }
  };

  // Type-specific validation ranges
  if (lowerType === "entity") {
    checkRange("health", 1, 100);
    checkRange("damage", 0, 20);
    checkRange("speed", 0.1, 1.0);
  } else if (lowerType === "block") {
    checkRange("destroy-time", 0, 10);
    checkRange("light-emission", 0, 15);
  } else if (lowerType === "item") {
    checkRange("max-stack", 1, 64);
    checkRange("durability", 0, 2000);
  }

  checkColor("color");
  checkColor("secondary-color");

  // Validate traits belong to the correct content type
  const traits = flags.traits as string[] | undefined;
  if (traits && traits.length > 0) {
    let validTraits: string[];
    switch (lowerType) {
      case "entity":
        validTraits = ENTITY_TRAITS;
        break;
      case "block":
        validTraits = BLOCK_TRAITS;
        break;
      case "item":
        validTraits = ITEM_TRAITS;
        break;
      default:
        validTraits = [];
    }
    for (const trait of traits) {
      if (!validTraits.includes(trait)) {
        errors.push({ flag: "traits", message: `Trait "${trait}" is not valid for ${contentType} type` });
      }
    }

    // Check body-type exclusivity for entities
    if (lowerType === "entity") {
      const bodyTraits = traits.filter((t) => ENTITY_BODY_TYPES.includes(t));
      if (bodyTraits.length > 1) {
        errors.push({
          flag: "traits",
          message: `Only one body type trait allowed, got: ${bodyTraits.join(", ")}`,
        });
      }
    }
  }

  return errors;
}

// ============================================================================
// DEFINITION BUILDER
// ============================================================================

/** Flags specific to wizard mode that trigger the content generator path. */
const WIZARD_FLAG_NAMES = [
  "health",
  "damage",
  "speed",
  "body-type",
  "color",
  "secondary-color",
  "destroy-time",
  "light-emission",
  "max-stack",
  "durability",
  "display-name",
  "namespace",
];

/**
 * Determine whether wizard-mode generation should be used instead of gallery mode.
 * Returns true if traits or any wizard-specific flag is provided.
 */
export function shouldUseWizardMode(
  contentType: string,
  traits: string[] | undefined,
  flags: Record<string, WizardFlagValue>
): boolean {
  if (!WIZARD_CONTENT_TYPES.includes(contentType.toLowerCase())) {
    return false;
  }
  if (traits && traits.length > 0) {
    return true;
  }
  return WIZARD_FLAG_NAMES.some((name) => flags[name] !== undefined);
}

/**
 * Build an IMinecraftContentDefinition from CLI args and flags.
 * Mirrors the _buildDefinition() logic in ContentWizard.tsx.
 */
export function buildDefinitionFromFlags(
  contentType: string,
  name: string,
  traits: string[] | undefined,
  flags: Record<string, WizardFlagValue>
): IMinecraftContentDefinition {
  const namespace = (flags.namespace as string) || "custom";
  const displayName =
    (flags["display-name"] as string) || name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const definition: IMinecraftContentDefinition = {
    schemaVersion: "1.0.0",
    namespace,
  };

  const lowerType = contentType.toLowerCase();

  if (lowerType === "entity") {
    let entityTraits = [...(traits || [])] as EntityTraitId[];

    // If --body-type flag is provided, ensure it's the only body type in the traits list
    const bodyType = flags["body-type"] as string | undefined;
    if (bodyType) {
      // Remove any existing body type traits (flag takes priority)
      entityTraits = entityTraits.filter((t) => !ENTITY_BODY_TYPES.includes(t)) as EntityTraitId[];
      if (!entityTraits.includes(bodyType as EntityTraitId)) {
        entityTraits.push(bodyType as EntityTraitId);
      }
    }

    definition.entityTypes = [
      {
        id: name,
        displayName,
        traits: entityTraits.length > 0 ? entityTraits : undefined,
        health: flags.health !== undefined ? Number(flags.health) : 20,
        attackDamage: flags.damage !== undefined ? Number(flags.damage) : 3,
        movementSpeed: flags.speed !== undefined ? Number(flags.speed) : 0.25,
        appearance: {
          bodyType: bodyType || (entityTraits.find((t) => ENTITY_BODY_TYPES.includes(t)) as any) || "humanoid",
          primaryColor: (flags.color as string) || "#4A7BA5",
          secondaryColor: (flags["secondary-color"] as string) || "#2D4F6B",
        },
      },
    ];
  } else if (lowerType === "block") {
    definition.blockTypes = [
      {
        id: name,
        displayName,
        traits: traits && traits.length > 0 ? (traits as BlockTraitId[]) : undefined,
        destroyTime: flags["destroy-time"] !== undefined ? Number(flags["destroy-time"]) : 3,
        lightEmission: flags["light-emission"] !== undefined ? Number(flags["light-emission"]) : 0,
        mapColor: (flags.color as string) || undefined,
      },
    ];
  } else if (lowerType === "item") {
    const itemTraits = (traits || []).filter((t) => t !== "custom") as ItemTraitId[];

    definition.itemTypes = [
      {
        id: name,
        displayName,
        traits: itemTraits.length > 0 ? itemTraits : undefined,
        maxStackSize: flags["max-stack"] !== undefined ? Number(flags["max-stack"]) : 64,
        durability: flags.durability !== undefined ? Number(flags.durability) : undefined,
        color: (flags.color as string) || undefined,
      },
    ];
  }

  return definition;
}

// ============================================================================
// ADD COMMAND
// ============================================================================

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
      // --- Shared flags ---
      {
        name: "traits",
        shortName: "t",
        description: "Comma-separated list of traits to apply (e.g., hostile,melee_attacker)",
        type: "stringArray",
        autocompleteProvider: allTraitsProvider,
      },
      {
        name: "template",
        description: "Specific gallery template ID to use (gallery mode only)",
        type: "string",
        autocompleteProvider: createGalleryItemProvider(),
      },
      {
        name: "display-name",
        description: "Display name shown in-game (defaults to formatted version of name)",
        type: "string",
        freeText: true,
      },
      {
        name: "namespace",
        shortName: "n",
        description: "Namespace for the content (defaults to 'custom')",
        type: "string",
      },
      {
        name: "color",
        description: "Primary color as hex (e.g., #FF0000)",
        type: "string",
      },
      // --- Entity-specific flags ---
      {
        name: "health",
        description: "Entity health points (1-100, default 20)",
        type: "number",
      },
      {
        name: "damage",
        description: "Entity attack damage (0-20, default 3)",
        type: "number",
      },
      {
        name: "speed",
        description: "Entity movement speed (0.1-1.0, default 0.25)",
        type: "number",
      },
      {
        name: "body-type",
        description: "Entity body type (humanoid, quadruped, flying, aquatic, etc.)",
        type: "string",
        autocompleteProvider: bodyTypeProvider,
      },
      {
        name: "secondary-color",
        description: "Entity secondary/accent color as hex (e.g., #00FF00)",
        type: "string",
      },
      // --- Block-specific flags ---
      {
        name: "destroy-time",
        description: "Block mining time in seconds (0-10, default 3)",
        type: "number",
      },
      {
        name: "light-emission",
        description: "Block light emission level (0-15, default 0)",
        type: "number",
      },
      // --- Item-specific flags ---
      {
        name: "max-stack",
        description: "Item max stack size (1-64, default 64)",
        type: "number",
      },
      {
        name: "durability",
        description: "Item durability (0-2000)",
        type: "number",
      },
    ],
    isWriteCommand: true,
    // Every scope, including the opt-in serverApi, where HttpServer requires the Minecraft EULA and
    // refuses path-like names.
    scopes: [
      ToolCommandScope.ui,
      ToolCommandScope.mcp,
      ToolCommandScope.serveTerminal,
      ToolCommandScope.cli,
      ToolCommandScope.serverApi,
    ],
    examples: [
      "/add entity my_mob",
      "/add entity my_orc --traits hostile,melee_attacker,humanoid --health 30 --damage 5",
      "/add block my_brick --traits solid --destroy-time 3",
      "/add item my_sword --traits sword --durability 500 --max-stack 1",
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

    // Work out what to add before creating anything, so a request that fails, such as one with an
    // out-of-range --health or an unknown type, doesn't leave a new starter project behind.
    const prepared = shouldUseWizardMode(typeOrTemplate, traits, flags)
      ? await this._generateWizardContent(typeOrTemplate, name, traits, flags)
      : await this._findGalleryItem(context, typeOrTemplate, explicitTemplate);

    if ("failure" in prepared) {
      return prepared.failure;
    }

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

    // ================================================================
    // WIZARD MODE — procedural generation via ContentGenerator
    // ================================================================
    if ("content" in prepared) {
      return this._writeWizardContent(context, typeOrTemplate, name, traits, prepared.content);
    }

    // ================================================================
    // GALLERY MODE — add from pre-built templates
    // ================================================================
    return this._addFromGallery(context, typeOrTemplate, name, prepared.galleryItem);
  }

  /**
   * Wizard mode, first step: validate the flags, then build an IMinecraftContentDefinition and
   * generate its content with ContentGenerator. Writes nothing.
   */
  private async _generateWizardContent(
    contentType: string,
    name: string,
    traits: string[] | undefined,
    flags: Record<string, WizardFlagValue>
  ): Promise<{ content: IGeneratedContent } | { failure: IToolCommandResult }> {
    // Validate inputs
    const validationErrors = validateWizardFlags(contentType, flags);
    if (validationErrors.length > 0) {
      const messages = validationErrors.map((e) => e.message).join("; ");
      return { failure: this.error("VALIDATION_ERROR", messages) };
    }

    // Build the content definition
    const definition = buildDefinitionFromFlags(contentType, name, traits, flags);

    // Generate content
    const { ContentGenerator } = await import("../../../minecraft/ContentGenerator");

    const generator = new ContentGenerator(definition);
    const content = await generator.generate();

    // Check for generation errors
    if (content.summary.errors.length > 0) {
      return {
        failure: this.error("GENERATION_ERROR", `Content generation failed: ${content.summary.errors.join("; ")}`),
      };
    }

    return { content };
  }

  /**
   * Wizard mode, second step: write the generated content to the project with ContentWriter.
   */
  private async _writeWizardContent(
    context: IToolCommandContext,
    contentType: string,
    name: string,
    traits: string[] | undefined,
    content: IGeneratedContent
  ): Promise<IToolCommandResult> {
    const { ContentWriter } = await import("../../../minecraft/ContentWriter");

    // Write to project
    await ContentWriter.writeGeneratedContent(context.project!, content);

    // Re-infer project items so the new files are tracked
    await context.project!.inferProjectItemsFromFiles(true);

    await ProjectUtilities.ensureGeneratedWith(
      context.project!,
      ProjectUtilities.getGeneratedWithToolForScope(context.scope)
    );

    // Report warnings
    for (const warning of content.summary.warnings) {
      context.output.warn(warning);
    }

    // Build summary
    const parts: string[] = [];
    if (content.summary.entityCount > 0) parts.push(`${content.summary.entityCount} entity`);
    if (content.summary.blockCount > 0) parts.push(`${content.summary.blockCount} block`);
    if (content.summary.itemCount > 0) parts.push(`${content.summary.itemCount} item`);
    if (content.summary.textureCount > 0) parts.push(`${content.summary.textureCount} texture(s)`);

    const summaryText = `Generated ${parts.join(", ")} for '${name}'`;
    context.output.success(summaryText);

    return this.success(summaryText, {
      name,
      type: contentType,
      traits: traits || [],
      mode: "wizard",
      generated: {
        entities: content.summary.entityCount,
        blocks: content.summary.blockCount,
        items: content.summary.itemCount,
        textures: content.summary.textureCount,
      },
    });
  }

  /**
   * Gallery mode, first step: find the pre-built gallery template to add, and check that its files
   * can be downloaded. Writes nothing.
   */
  private async _findGalleryItem(
    context: IToolCommandContext,
    typeOrTemplate: string,
    explicitTemplate: string | undefined
  ): Promise<{ galleryItem: IGalleryItem } | { failure: IToolCommandResult }> {
    const creatorTools = context.creatorTools!;

    // Load gallery
    await creatorTools.loadGallery();

    if (!creatorTools.gallery) {
      return { failure: this.error("GALLERY_ERROR", "Could not load project gallery") };
    }

    // Try to find as direct gallery item first
    let galleryItem = await creatorTools.getGalleryProjectById(explicitTemplate || typeOrTemplate);

    // If not found, map content type to gallery type and find default template
    if (!galleryItem) {
      const galleryType = CONTENT_TYPE_TO_GALLERY[typeOrTemplate.toLowerCase()];

      if (galleryType !== undefined) {
        const items = creatorTools.getGalleryProjectByType(galleryType);

        if (items && items.length > 0) {
          const preferredItemType = CONTENT_TYPE_TO_ITEM_TYPE[typeOrTemplate.toLowerCase()];
          if (preferredItemType) {
            const match = items.find(
              (item) => item.targetType === preferredItemType || item.id === typeOrTemplate.toLowerCase()
            );
            if (match) {
              galleryItem = match;
              context.output.debug(`Using matched template '${match.id}' for type '${typeOrTemplate}'`);
            }
          }

          if (!galleryItem) {
            galleryItem = items[0];
            context.output.debug(`Using template '${galleryItem.id}' for type '${typeOrTemplate}'`);
          }
        }
      }
    }

    if (!galleryItem) {
      const gallery = creatorTools.gallery;
      const types = Object.keys(CONTENT_TYPE_TO_GALLERY).join(", ");
      const templates = gallery.items
        .slice(0, 10)
        .map((i) => i.id)
        .join(", ");
      return {
        failure: this.error(
          "TYPE_NOT_FOUND",
          `Unknown type or template '${typeOrTemplate}'. Valid types: ${types}. Example templates: ${templates}...`
        ),
      };
    }

    // Without a network, copying a downloaded template adds nothing, so fail before anything is written.
    if (!(await ProjectCreateManager.canLoadGalleryTemplateFiles(galleryItem))) {
      return {
        failure: this.error(
          "TEMPLATE_UNAVAILABLE",
          ProjectCreateManager.getGalleryTemplateUnavailableMessage(galleryItem)
        ),
      };
    }

    return { galleryItem };
  }

  /**
   * Gallery mode, second step: add the gallery template to the project.
   */
  private async _addFromGallery(
    context: IToolCommandContext,
    typeOrTemplate: string,
    name: string,
    galleryItem: IGalleryItem
  ): Promise<IToolCommandResult> {
    context.output.info(`Adding '${name}' from template '${galleryItem.title}'...`);

    try {
      await ProjectItemCreateManager.addFromGallery(context.project!, name, galleryItem);

      await ProjectUtilities.ensureGeneratedWith(
        context.project!,
        ProjectUtilities.getGeneratedWithToolForScope(context.scope)
      );

      await context.project!.save();

      context.output.success(`Added '${name}' to project`);

      return this.success(`Added ${name}`, {
        name,
        template: galleryItem.id,
        type: typeOrTemplate,
        mode: "gallery",
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
      const types = Object.keys(CONTENT_TYPE_TO_GALLERY).filter((t) => t.startsWith(lower));

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
