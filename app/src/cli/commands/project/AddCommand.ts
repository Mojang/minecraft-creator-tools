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
import inquirer, { DistinctQuestion } from "inquirer";
import { GalleryItemType } from "../../../app/IGalleryItem";
import Project from "../../../app/Project";
import ProjectItemCreateManager from "../../../app/ProjectItemCreateManager";
import LocalUtilities from "../../../local/LocalUtilities";

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
    // Pro-grade additions: --list-types prints the catalog and exits without prompting,
    // so CI scripts can discover what `mct add` accepts.
    cmd.option("--list-types", "List the available content type categories and gallery template ids, then exit.");

    cmd.addHelpText(
      "after",
      "\nExamples:\n" +
        "  $ mct add entity                              # Interactive — pick an entity template, then prompt for name\n" +
        "  $ mct add block                               # Interactive — pick a block template\n" +
        "  $ mct add item                                # Interactive — pick an item template\n" +
        "  $ mct add cow my_cow -i ./myproj              # Add a vanilla 'cow' gallery template named 'my_cow'\n" +
        "  $ mct add allay buddy -i ./myproj -y          # Same, non-interactive (CI-friendly)\n" +
        "  $ mct add basicUnitCubeBlock my_block -i .    # Add a block from a specific template id\n" +
        "  $ mct add --list-types --json                 # Discover what `mct add` accepts (machine-readable)\n" +
        "\nTip: when using `-y`, you must pass a specific gallery template id (e.g. `cow`, `allay`,\n" +
        "     `basicUnitCubeBlock`) — the `entity` / `block` / `item` shorthands require interactive\n" +
        "     template selection.\n" +
        "Tip: item names should be lowercase, alphanumeric or `_`, max 50 chars.\n"
    );
  }

  async execute(context: ICommandContext): Promise<void> {
    this.logStart(context);

    let type = context.type;
    this.newName = context.newName;

    await context.localEnv.load();

    // --list-types: emit catalog and return without touching projects.
    // Honours --json for CI machine-readable output. We accept the special
    // sentinel value `"list-types"` (or `"list"`) as the positional `type`
    // arg so callers can use either flag form (`--list-types`) or shorthand
    // (`mct add list-types --json`).
    const wantsList =
      type === "list-types" ||
      type === "list" ||
      Boolean(context.commandOptions?.listTypes);
    if (wantsList) {
      await context.creatorTools.loadGallery();
      const gallery = context.creatorTools.gallery;
      const categories = [
        { value: "entity", description: "Entity Type (entity)" },
        { value: "block", description: "Block Type (block)" },
        { value: "item", description: "Item Type (item)" },
        { value: "spawnLootRecipes", description: "Spawn rules, loot tables, recipes" },
        { value: "worldGen", description: "World generation features" },
        { value: "visuals", description: "Visual assets (textures, models)" },
        { value: "singleFiles", description: "Individual definition files" },
      ];
      const galleryTemplates = gallery
        ? gallery.items.map((g) => ({ id: g.id, title: g.title, type: g.type }))
        : [];

      if (context.json) {
        context.log.data(
          JSON.stringify({
            schemaVersion: "1.0.0",
            command: "add",
            categories,
            galleryTemplates,
          })
        );
      } else {
        context.log.info("Categories:");
        for (const c of categories) {
          context.log.info(`  ${c.value} — ${c.description}`);
        }
        context.log.info("");
        context.log.info(`Gallery templates (${galleryTemplates.length}):`);
        for (const g of galleryTemplates) {
          context.log.info(`  ${g.id} — ${g.title}`);
        }
      }
      this.logComplete(context);
      return;
    }

    // Check EULA (skip for test automation)
    const isTestMode = this.newName === "testerName";

    if (
      !context.localEnv.iAgreeToTheMinecraftEndUserLicenseAgreementAndPrivacyStatementAtMinecraftDotNetSlashEula &&
      !isTestMode
    ) {
      if (!LocalUtilities.eulaAcceptedViaEnvironment) {
        context.log.error(
          "EULA not accepted. Accept it via:\n" +
            "  Interactive:    mct eula\n" +
            "  Non-interactive: mct eula --accept   (or set MCTOOLS_I_ACCEPT_EULA_AT_MINECRAFTDOTNETSLASHEULA=true)"
        );
        context.setExitCode(ErrorCodes.INIT_ERROR);
        return;
      }

      context.localEnv.iAgreeToTheMinecraftEndUserLicenseAgreementAndPrivacyStatementAtMinecraftDotNetSlashEula = true;
      await context.localEnv.save();
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
          if (context.yes) {
            // Non-interactive: derive a default item name from the type.
            this.newName = type;
          } else {
            const newNameQuestions: DistinctQuestion<any>[] = [];
            newNameQuestions.push({
              type: "input",
              name: "name",
              message: "What's your preferred new name? (<20 chars, no spaces)",
            });
            const answers = await inquirer.prompt(newNameQuestions);
            this.newName = answers["name"];
          }
        }

        if (this.newName) {
          if (!this.isValidItemName(this.newName)) {
            context.log.warn(
              `Item name '${this.newName}' contains invalid characters. Minecraft identifiers should use lowercase letters, numbers, and underscores only.`
            );
          }
          if (context.dryRun) {
            context.log.info("Dry run: would add '" + this.newName + "' to project");
            return;
          }
          context.log.info(`Adding item '${this.newName}' from template '${galleryItem.title}'`);
          await ProjectItemCreateManager.addFromGallery(project, this.newName, galleryItem);
          await project.save();
          if (context.json) {
            context.log.data(JSON.stringify({ success: true, added: this.newName, type: type }));
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
      if (context.yes) {
        context.log.error(
          "No item type was specified and --yes is set. Provide a type as the first argument: mct add <type> <name>"
        );
        context.setExitCode(ErrorCodes.INIT_ERROR);
        return;
      }
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
      context.log.error(`Unknown item type '${type}'. Valid types: ${choices.map((c) => c.value).join(", ")}`);
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
    if (context.yes) {
      context.log.error(
        "Single-file add requires interactive selection; --yes is incompatible. Use a specific gallery template id instead: mct add <template-id> <name>"
      );
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }
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

    if (context.yes) {
      context.log.error(
        `${typeDescriptor} add requires interactive template selection; --yes is incompatible. Use a specific gallery template id instead: mct add <template-id> <name>`
      );
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }

    const questions: DistinctQuestion<any>[] = [];
    const templateTypeChoices: { name: string; value: string }[] = [];

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
