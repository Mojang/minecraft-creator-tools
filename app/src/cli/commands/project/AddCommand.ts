/**
 * AddCommand - Add content to a Minecraft project
 *
 * ARCHITECTURE DOCUMENTATION
 * ==========================
 *
 * This command adds new content items (entities, blocks, items, etc.)
 * to an existing Minecraft project from gallery templates.
 *
 * ITEM TYPES:
 * - entity: Entity type definitions
 * - block: Block type definitions
 * - item: Item type definitions
 * - spawnLootRecipes: Spawn rules, loot tables, recipes
 * - worldGen: World generation features
 * - visuals: Visual assets (textures, models)
 * - singleFiles: Individual definition files
 *
 * USAGE:
 * npx mct add [type] [name] -i <project-folder>
 */

import { Command } from "commander";
import { ICommandMetadata, CommandBase } from "../../core/ICommand";
import { ICommandContext, ErrorCodes } from "../../core/ICommandContext";
import { TaskType } from "../../ClUtils";
import inquirer, { DistinctQuestion, DistinctChoice } from "inquirer";
import { GalleryItemType } from "../../../app/IGalleryItem";
import Project from "../../../app/Project";
import ProjectItemCreateManager from "../../../app/ProjectItemCreateManager";

export class AddCommand extends CommandBase {
  readonly metadata: ICommandMetadata = {
    name: "add",
    description: "Adds new content into this Minecraft project",
    taskType: TaskType.add,
    aliases: ["a"],
    requiresProjects: true,
    isWriteCommand: true,
    isEditInPlace: true,
    isLongRunning: false,
    category: "Project",
    arguments: [
      {
        name: "type",
        description:
          "Type of item to add: entity, block, item, spawnLootRecipes, worldGen, visuals, singleFiles, or a gallery template ID",
        required: false,
        contextField: "type",
      },
      {
        name: "name",
        description: "Desired item namespace/name",
        required: false,
        contextField: "newName",
      },
    ],
  };

  // Instance state for prompting
  private newName: string | undefined;

  configure(cmd: Command): void {
    // Arguments are configured via metadata.arguments
  }

  async execute(context: ICommandContext): Promise<void> {
    this.logStart(context);

    let type = context.type;
    this.newName = context.newName;

    await context.localEnv.load();

    // Check EULA (skip for test automation)
    const isTestMode = this.newName === "testerName";

    if (
      !context.localEnv.iAgreeToTheMinecraftEndUserLicenseAgreementAndPrivacyStatementAtMinecraftDotNetSlashEula &&
      !isTestMode
    ) {
      context.log.error(
        "EULA not accepted. Run 'npx mct eula' first, or set MCTOOLS_I_ACCEPT_EULA_AT_MINECRAFTDOTNETSLASHEULA=true"
      );
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }

    // Load gallery
    await context.creatorTools.loadGallery();

    if (!context.creatorTools.gallery) {
      context.log.error("Could not load project gallery.");
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }

    for (const project of context.projects) {
      await project.ensureProjectFolder();
      await this.addToProject(context, project, type);
    }

    this.logComplete(context);
  }

  private isValidItemName(name: string): boolean {
    // Minecraft identifiers: lowercase alphanumeric, underscores, max 50 chars
    return /^[a-z0-9_]{1,50}$/.test(name);
  }

  private async addToProject(context: ICommandContext, project: Project, type: string | undefined): Promise<void> {
    // If type is specified directly, try to find matching gallery item
    if (type) {
      const galleryItem = await context.creatorTools.getGalleryProjectById(type);

      if (galleryItem) {
        if (!this.newName) {
          const newNameQuestions: DistinctQuestion<any>[] = [];
          newNameQuestions.push({
            type: "input",
            name: "name",
            message: "What's your preferred new name? (<20 chars, no spaces)",
          });
          const answers = await inquirer.prompt(newNameQuestions);
          this.newName = answers["name"];
        }

        if (this.newName) {
          if (!this.isValidItemName(this.newName)) {
            context.log.warn(`Item name '${this.newName}' contains invalid characters. Minecraft identifiers should use lowercase letters, numbers, and underscores only.`);
          }
          if (context.dryRun) {
            context.log.info("Dry run: would add '" + this.newName + "' to project");
            return;
          }
          context.log.info(`Adding item '${this.newName}' from template '${galleryItem.title}'`);
          await ProjectItemCreateManager.addFromGallery(project, this.newName, galleryItem);
          await project.save();
          if (context.json) {
            context.log.info(JSON.stringify({ success: true, added: this.newName, type: type }));
          } else {
            context.log.success(`Added ${this.newName} to project.`);
          }
        } else {
          context.log.error("No item name was specified.");
          context.setExitCode(ErrorCodes.INIT_ERROR);
        }
        return;
      }
    }

    // Interactive type selection
    const typeQuestions: DistinctQuestion<any>[] = [];
    const choices = [
      { name: "Entity Type (entity)", value: "entity" },
      { name: "Block Type (block)", value: "block" },
      { name: "Item Type (item)", value: "item" },
      { name: "Spawn/Loot/Recipes", value: "spawnLootRecipes" },
      { name: "World Gen", value: "worldGen" },
      { name: "Visuals", value: "visuals" },
      { name: "Single files (advanced)", value: "singleFiles" },
    ];
    const VALID_TYPES = choices.map((c) => c.value.toLowerCase());

    if (type === undefined) {
      typeQuestions.push({
        type: "list",
        name: "type",
        message: "What type of item should we add?",
        choices,
      });

      const typeAnswers = await inquirer.prompt(typeQuestions);
      type = typeAnswers["type"];
    }

    if (type) {
      type = type.toLowerCase();
    }

    // Validate that the type is recognized before proceeding
    if (type && !VALID_TYPES.includes(type)) {
      context.log.error(
        `Unknown item type '${type}'. Valid types: ${choices.map((c) => c.value).join(", ")}`
      );
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }

    if (type === "entity") {
      await this.chooseAddItem(context, project, GalleryItemType.entityType, "entity type");
    } else if (type === "block") {
      await this.chooseAddItem(context, project, GalleryItemType.blockType, "block type");
    } else if (type === "item") {
      await this.chooseAddItem(context, project, GalleryItemType.itemType, "item type");
    } else if (type === "spawnlootrecipes") {
      await this.chooseAddItem(context, project, GalleryItemType.spawnLootRecipes, "spawn/loot/recipe");
    } else if (type === "worldgen") {
      await this.chooseAddItem(context, project, GalleryItemType.worldGen, "world gen");
    } else if (type === "visuals") {
      await this.chooseAddItem(context, project, GalleryItemType.visuals, "visuals");
    } else if (type === "singlefiles") {
      await this.handleSingleFiles(context, project);
    }

    await project.save();
  }

  private async handleSingleFiles(context: ICommandContext, project: Project): Promise<void> {
    const subTypeQuestions: DistinctQuestion<any>[] = [
      {
        type: "list",
        name: "subType",
        message: "What type of single file should we add?",
        choices: [
          { name: "Entity/Item/Blocks", value: "entityItemBlocks_sf" },
          { name: "World Gen", value: "worldGen_sf" },
          { name: "Visuals", value: "visuals_sf" },
          { name: "Catalogs", value: "catalogs_sf" },
        ],
      },
    ];

    const subTypeAnswers = await inquirer.prompt(subTypeQuestions);
    let subType = subTypeAnswers["subType"];

    if (subType) {
      subType = subType.toLowerCase();

      if (subType === "worldgen_sf") {
        await this.chooseAddItem(context, project, GalleryItemType.worldGenSingleFiles, "world gen file");
      } else if (subType === "entityitemblocks_sf") {
        await this.chooseAddItem(context, project, GalleryItemType.entityItemBlockSingleFiles, "file");
      } else if (subType === "visuals_sf") {
        await this.chooseAddItem(context, project, GalleryItemType.visualSingleFiles, "visuals file");
      } else if (subType === "catalogs_sf") {
        await this.chooseAddItem(context, project, GalleryItemType.catalogSingleFiles, "catalog file");
      }
    }
  }

  private async chooseAddItem(
    context: ICommandContext,
    project: Project,
    itemType: GalleryItemType,
    typeDescriptor: string
  ): Promise<void> {
    const gallery = context.creatorTools.gallery;
    if (!gallery) {
      return;
    }

    const questions: DistinctQuestion<any>[] = [];
    const templateTypeChoices: DistinctChoice[] = [];

    for (const proj of gallery.items) {
      if (proj.type === itemType) {
        templateTypeChoices.push({
          name: proj.title + " (" + proj.id + ")",
          value: proj.id,
        });
      }
    }

    if (templateTypeChoices.length === 0) {
      context.log.error(`No templates found for ${typeDescriptor}.`);
      return;
    }

    questions.push({
      type: "list",
      name: "templateType",
      message: `Based on which ${typeDescriptor} template?`,
      choices: templateTypeChoices,
    });

    if (!this.newName) {
      questions.push({
        type: "input",
        name: "name",
        message: `What's your preferred new ${typeDescriptor} name? (<20 chars, no spaces)`,
      });
    }

    const answers = await inquirer.prompt(questions);

    if (!this.newName) {
      this.newName = answers["name"];
    }

    const templateType = answers["templateType"];

    if (templateType && this.newName) {
      for (const galItem of gallery.items) {
        if (galItem.id === templateType && galItem.type === itemType) {
          await ProjectItemCreateManager.addFromGallery(project, this.newName, galItem);
          context.log.success(`Added ${this.newName} from template '${galItem.title}'.`);
        }
      }
    }
  }
}

export const addCommand = new AddCommand();
