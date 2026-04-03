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
 * TEMPLATES are defined in the gallery (src/res/gallery.json)
 *
 * USAGE:
 * npx mct create [name] [template] [creator] [description] -o <output-folder>
 */

import { Command } from "commander";
import { ICommandMetadata, CommandBase } from "../../core/ICommand";
import { ICommandContext, ErrorCodes } from "../../core/ICommandContext";
import { TaskType } from "../../ClUtils";
import inquirer, { DistinctQuestion } from "inquirer";
import IGalleryItem, { GalleryItemType } from "../../../app/IGalleryItem";
import Project, { ProjectAutoDeploymentMode } from "../../../app/Project";
import ProjectExporter from "../../../app/ProjectExporter";
import ProjectUtilities from "../../../app/ProjectUtilities";
import NodeStorage from "../../../local/NodeStorage";
import LocalUtilities from "../../../local/LocalUtilities";

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
        context.log.error("Failed to create project: " + (err instanceof Error ? err.message : String(err)));
        context.setExitCode(ErrorCodes.INIT_ERROR);
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
          "EULA not accepted. Run 'npx mct eula' first, or set MCTOOLS_I_ACCEPT_EULA_AT_MINECRAFTDOTNETSLASHEULA=true"
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
      const titleQuestions: DistinctQuestion<any>[] = [];
      titleQuestions.push({
        type: "input",
        name: "title",
        default: "My Project",
        message: "What's your preferred project title?",
      });
      const titleAnswer = await inquirer.prompt(titleQuestions);

      if (titleAnswer["title"]) {
        title = titleAnswer["title"];
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

      const descriptionQuestions: DistinctQuestion<any>[] = [];
      descriptionQuestions.push({
        type: "input",
        name: "description",
        default: applyDescription,
        message: "What's your preferred project description?",
      });

      const descriptionAnswer = await inquirer.prompt(descriptionQuestions);

      if (descriptionAnswer["description"]) {
        applyDescription = descriptionAnswer["description"];
      }

      if (applyDescription === undefined) {
        applyDescription = title;
      }
    }

    // Get creator
    if (!creator) {
      const creatorQuestions: DistinctQuestion<any>[] = [];
      creatorQuestions.push({
        type: "input",
        name: "creator",
        default: "Creator",
        message: "What's your creator name?",
      });
      const creatorAnswer = await inquirer.prompt(creatorQuestions);

      if (creatorAnswer["creator"]) {
        creator = creatorAnswer["creator"];
      }
    }

    // Get short name
    const questions: DistinctQuestion<any>[] = [];
    if (!newName) {
      newName = title?.replace(/ /gi, "-").toLowerCase();

      questions.push({
        type: "input",
        name: "name",
        default: newName,
        message: "What's your preferred project short name? (<20 chars, no spaces)",
      });
    }

    // Handle folder creation for single project
    if (!context.inputFolder && (!context.outputFolder || context.outputFolder === "out") && isSingleFolder) {
      const folderNameQuestions: DistinctQuestion<any>[] = [];

      folderNameQuestions.push({
        type: "input",
        name: "folderName",
        default: newName,
        message: "What's your preferred folder name?",
      });

      const folderNameAnswer = await inquirer.prompt(folderNameQuestions);
      const folderName = folderNameAnswer["folderName"];

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

    if (!galProject || !newName) {
      const answers = await inquirer.prompt(questions);

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
        context.log.info(message);
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
