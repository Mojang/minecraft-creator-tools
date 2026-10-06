/**
 * CreateCommand - Create a new Minecraft project
 *
 * ARCHITECTURE DOCUMENTATION
 * ==========================
 *
 * This command creates a new Minecraft add-on project from a template.
 * It can run interactively (prompting for project details) or with
 * command-line arguments for automation.
 *
 * The command:
 * 1. Checks/prompts for EULA acceptance
 * 2. Loads the project gallery (templates)
 * 3. Prompts for project details (name, description, creator, template)
 * 4. Syncs the template from GitHub
 * 5. Applies project customizations
 *
 * PROMPTS go through prompt() (cli/core/Prompt.ts), which asks only when stdin and stdout are
 * both terminals. Without a terminal, create asks nothing: it fails with INIT_ERROR and names the
 * missing detail and the arguments (or --yes) that supply it. With --yes, or with every argument
 * supplied, create never prompts.
 *
 * TEMPLATES are defined in the gallery (src/res/gallery.json)
 *
 * USAGE:
 * npx mct create [name] [template] [creator] [description] -o <output-folder>
 */

import { Command } from "commander";
import { ICommandMetadata, CommandBase } from "../../core/ICommand";
import { ICommandContext, ErrorCodes } from "../../core/ICommandContext";
import { TaskType } from "../../ClUtils";
import { IPromptRequest, prompt, PromptQuestion, reportPromptUnavailable } from "../../core/Prompt";
import IGalleryItem, { GalleryItemType } from "../../../app/IGalleryItem";
import Project, { ProjectAutoDeploymentMode } from "../../../app/Project";
import ProjectExporter from "../../../app/ProjectExporter";
import ProjectUtilities from "../../../app/ProjectUtilities";
import NodeStorage from "../../../local/NodeStorage";
import LocalUtilities from "../../../local/LocalUtilities";

/** How to create a project without prompts, shown when create can't prompt. */
const CREATE_WITHOUT_PROMPTS =
  "Pass the project details as arguments instead. With --yes, create uses defaults for any you leave out:\n" +
  "  mct create <name> <template> [creator] [description] --yes";

function createPromptRequest(asking: string, details?: string): IPromptRequest {
  return { asking, instead: (details ? details + "\n" : "") + CREATE_WITHOUT_PROMPTS };
}

/** The request for the template prompt, which lists the template ids so they can be passed instead. */
function templatePromptRequest(galleryItems: IGalleryItem[], template: string | undefined): IPromptRequest {
  const templateIds = galleryItems.filter((item) => item.type === GalleryItemType.project).map((item) => item.id);
  const unknownTemplate = template ? `'${template}' isn't a template. ` : "";

  return createPromptRequest("which template to use", `${unknownTemplate}Templates: ${templateIds.join(", ")}.`);
}

export class CreateCommand extends CommandBase {
  readonly metadata: ICommandMetadata = {
    name: "create",
    description: "Creates a new Minecraft project",
    taskType: TaskType.create,
    aliases: ["c"],
    requiresProjects: true, // Creates output project
    isWriteCommand: true,
    isEditInPlace: false,
    isLongRunning: false,
    category: "Project",
    arguments: [
      {
        name: "name",
        description: "Desired project name",
        required: false,
        contextField: "newName",
      },
      {
        name: "template",
        description: "Template name",
        required: false,
        contextField: "type",
      },
      {
        name: "creator",
        description: "Creator name",
        required: false,
        contextField: "mode",
      },
      {
        name: "description",
        description: "Project description",
        required: false,
        contextField: "description",
      },
    ],
    globalOptionGroups: ["input", "projects", "outputFolder", "prompts"],
    examples: [
      { description: "Fully interactive; asks every question", command: "mct create" },
      { description: "Non-interactive, accepting all defaults", command: "mct create -y -o ./myproj" },
      {
        description: "Fully specified, no prompts",
        command: 'mct create myproj addonStarter alice "My new addon" -o .',
      },
    ],
    learnMore: ["Pass `-y` (or `--yes`) in CI to accept all defaults."],
  };

  configure(cmd: Command): void {
    // Arguments are configured via metadata.arguments
  }

  async execute(context: ICommandContext): Promise<void> {
    this.logStart(context);

    // For create, we work with the first project (output location)
    if (context.projects.length === 0) {
      context.log.error("No output location specified. Use -o to specify where to create the project.");
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }

    const isSingleFolder = context.projects.length <= 1;

    for (const project of context.projects) {
      try {
        await this.createProject(context, project, isSingleFolder);
      } catch (err) {
        if (!reportPromptUnavailable(context, err)) {
          context.log.error("Failed to create project: " + (err instanceof Error ? err.message : String(err)));
          context.setExitCode(ErrorCodes.INIT_ERROR);
        }
        return;
      }
    }

    this.logComplete(context);
  }

  private async createProject(context: ICommandContext, project: Project, isSingleFolder: boolean): Promise<void> {
    await context.localEnv.load();

    // Check EULA (skip for test automation)
    let newName = context.newName;
    let creator = context.mode; // Using mode for creator name
    let template = context.type; // Using type for template
    let newDescription = context.description;

    const isTestMode = newName === "testerName" && creator === "testerCreatorName";

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

    // Get title interactively if not provided
    let title = newName;

    if (!title) {
      if (context.yes) {
        // Non-interactive: use a sensible default. Pro users in CI usually
        // pass `name` as the first positional arg; this fallback exists only
        // to keep --yes from hanging on stdin.
        title = "MyProject";
      } else {
        const titleQuestions: PromptQuestion[] = [];
        titleQuestions.push({
          type: "input",
          name: "title",
          default: "My Project",
          message: "What's your preferred project title?",
        });
        const titleAnswer = await prompt(titleQuestions, createPromptRequest("for the project name"));

        if (titleAnswer["title"]) {
          title = titleAnswer["title"];
        }
      }
    }

    if (!title) {
      context.log.error("No title for your project was specified.");
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }

    // Get description
    let applyDescription = newDescription;

    if (applyDescription === undefined) {
      applyDescription = title;

      if (!context.yes) {
        const descriptionQuestions: PromptQuestion[] = [];
        descriptionQuestions.push({
          type: "input",
          name: "description",
          default: applyDescription,
          message: "What's your preferred project description?",
        });

        const descriptionAnswer = await prompt(
          descriptionQuestions,
          createPromptRequest("for the project description")
        );

        if (descriptionAnswer["description"]) {
          applyDescription = descriptionAnswer["description"];
        }
      }

      if (applyDescription === undefined) {
        applyDescription = title;
      }
    }

    // Get creator
    if (!creator) {
      if (context.yes) {
        creator = "Creator";
      } else {
        const creatorQuestions: PromptQuestion[] = [];
        creatorQuestions.push({
          type: "input",
          name: "creator",
          default: "Creator",
          message: "What's your creator name?",
        });
        const creatorAnswer = await prompt(creatorQuestions, createPromptRequest("for the creator name"));

        if (creatorAnswer["creator"]) {
          creator = creatorAnswer["creator"];
        }
      }
    }

    // Get short name
    const questions: PromptQuestion[] = [];
    if (!newName) {
      newName = title?.replace(/ /gi, "-").toLowerCase();

      if (!context.yes) {
        questions.push({
          type: "input",
          name: "name",
          default: newName,
          message: "What's your preferred project short name? (<20 chars, no spaces)",
        });
      }
    }

    // Handle folder creation for single project
    if (!context.inputFolder && (!context.outputFolder || context.outputFolder === "out") && isSingleFolder) {
      let folderName: string | undefined;

      if (context.yes) {
        // Non-interactive: derive from short name or title.
        folderName = newName;
      } else {
        const folderNameQuestions: PromptQuestion[] = [];

        folderNameQuestions.push({
          type: "input",
          name: "folderName",
          default: newName,
          message: "What's your preferred folder name?",
        });

        const folderNameAnswer = await prompt(folderNameQuestions, createPromptRequest("for the folder name"));
        folderName = folderNameAnswer["folderName"];
      }

      if (folderName) {
        const path =
          NodeStorage.ensureEndsWithDelimiter(process.cwd()) + NodeStorage.ensureEndsWithDelimiter(folderName);

        const outputStorage = new NodeStorage(path, "");
        const outFolder = outputStorage.rootFolder;
        await outFolder.ensureExists();

        project.localFolderPath = path;
        project.autoDeploymentMode = ProjectAutoDeploymentMode.noAutoDeployment;
      }
    }

    // Find template
    const galProjects = context.creatorTools.gallery.items;
    let galProject: IGalleryItem | undefined;

    if (template) {
      for (let i = 0; i < galProjects.length; i++) {
        const galProjectCand = galProjects[i];
        if (galProjectCand && galProjectCand.id && galProjectCand.id.toLowerCase() === template.toLowerCase()) {
          galProject = galProjectCand;
        }
      }
    }

    let suggestedShortName: string | undefined;

    if (newName && creator) {
      suggestedShortName = ProjectUtilities.getSuggestedProjectShortName(creator, newName);
    }

    // Check for existing folders
    const rootFolder = await project.ensureProjectFolder();

    if (rootFolder && suggestedShortName) {
      const bpFolder = await rootFolder.getFolderFromRelativePath("/behavior_packs/" + suggestedShortName + "/");
      const bpAlreadyExists = bpFolder ? await bpFolder.exists() : false;

      if (bpAlreadyExists) {
        context.log.error(
          `Cannot create a project, as folder '/behavior_packs/${suggestedShortName}/' already exists.`
        );
        context.setExitCode(ErrorCodes.INIT_ERROR);
        return;
      }

      const rpFolder = await rootFolder.getFolderFromRelativePath("/resource_packs/" + suggestedShortName + "/");
      const rpAlreadyExists = rpFolder ? await rpFolder.exists() : false;

      if (rpAlreadyExists) {
        context.log.error(
          `Cannot create a project, as folder '/resource_packs/${suggestedShortName}/' already exists.`
        );
        context.setExitCode(ErrorCodes.INIT_ERROR);
        return;
      }
    }

    // Prompt for template if not specified
    if (!galProject) {
      if (context.yes) {
        // Non-interactive default: pick the first available project template
        // (typically `addonStarter`). Pro CI users should pass `template` as the
        // second positional argument to be explicit.
        for (let i = 0; i < galProjects.length; i++) {
          if (galProjects[i].type === GalleryItemType.project) {
            galProject = galProjects[i];
            break;
          }
        }
        if (!galProject) {
          context.log.error(
            "No template available in the gallery and no template specified. Pass a template name as the second arg."
          );
          context.setExitCode(ErrorCodes.INIT_ERROR);
          return;
        }
      } else {
        const projectTypeChoices: { name: string; value: number }[] = [];

        for (let i = 0; i < galProjects.length; i++) {
          const galProjectCand = galProjects[i];

          if (galProjectCand.type === GalleryItemType.project)
            projectTypeChoices.push({
              name: galProjectCand.id + ": " + galProjectCand.title,
              value: i,
            });
        }

        questions.push({
          type: "list",
          name: "projectSource",
          message: "What template should we use?",
          choices: projectTypeChoices,
        });
      }
    }

    if ((!galProject || !newName) && !context.yes) {
      const answers = await prompt(
        questions,
        galProject ? createPromptRequest("for the project short name") : templatePromptRequest(galProjects, template)
      );

      if (answers) {
        if (answers["name"]) {
          newName = answers["name"];
        }

        if (!galProject) {
          galProject = galProjects[answers["projectSource"]];
        }
      }
    }

    if (!newName) {
      context.log.error("No project name specified.");
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }

    if (!galProject) {
      context.log.error("No project template selected.");
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }

    // Sync project from GitHub
    context.log.info(`Creating project '${title}' from template '${galProject.id}'...`);

    // The template's pack folders (e.g. `behavior_packs/aop_mobs/`) get renamed
    // to the user's chosen short name *after* the copy completes via
    // `ProjectUtilities.renameDefaultFolders`. Per-file "Updating file: ..."
    // messages emitted by `StorageUtilities.syncFolderTo` therefore reference
    // staging paths that won't exist on disk once the create finishes — see
    // ready-to-ship-report.md issue #5. Rewrite those paths inline so users see
    // where files will actually land.
    const packFolderRewrite = suggestedShortName
      ? (msg: string) =>
          msg.replace(
            /(behavior_packs|resource_packs|skin_packs|world_templates)([\\/])[^\\/]+([\\/])/g,
            `$1$2${suggestedShortName}$3`
          )
      : (msg: string) => msg;

    project = await ProjectExporter.syncProjectFromGitHub(
      true,
      context.creatorTools,
      galProject.gitHubRepoName,
      galProject.gitHubOwner,
      galProject.gitHubBranch,
      galProject.gitHubFolder,
      newName,
      project,
      galProject.fileList,
      async (message: string) => {
        context.log.info(packFolderRewrite(message));
      },
      true
    );

    if (creator) {
      await ProjectUtilities.applyCreator(project, creator);
    }

    await ProjectUtilities.processNewProject(project, title, applyDescription, suggestedShortName, false);

    context.log.success(`Project created at: ${project.projectFolder?.fullPath}`);
    context.log.info("\nNow run npm i in the project folder to install dependencies, if any.");
  }
}

export const createCommand = new CreateCommand();
