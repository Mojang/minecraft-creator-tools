// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * CreateCommand - Create a new Minecraft project
 *
 * This ToolCommand provides project creation capabilities across all surfaces.
 * It uses the same core libraries as the CLI CreateCommand but without
 * the interactive prompting logic.
 *
 * The command creates a project from a template, syncing content from GitHub.
 */

import type { IToolCommandMetadata, IToolCommandResult } from "../IToolCommand";
import { ToolCommandBase } from "../IToolCommand";
import type { IToolCommandContext } from "../IToolCommandContext";
import { projectTemplateProvider } from "../AutocompleteProviders";
import { GalleryItemType } from "../../IGalleryItem";
import ProjectExporter from "../../ProjectExporter";
import ProjectUtilities from "../../ProjectUtilities";
import Project, { ProjectAutoDeploymentMode } from "../../Project";
import { ProjectFocus } from "../../IProjectData";

export class CreateCommand extends ToolCommandBase {
  readonly metadata: IToolCommandMetadata = {
    name: "create",
    description: "Create a new Minecraft project from a template",
    aliases: ["c", "new"],
    category: "Project",
    arguments: [
      {
        name: "template",
        description: "Template ID (e.g., addonstarter, tsstarter, addonfull)",
        type: "choice",
        required: false,
        defaultValue: "addonstarter",
        autocompleteProvider: projectTemplateProvider,
      },
      {
        name: "name",
        description: "Project name",
        type: "string",
        required: false,
        defaultValue: "my-project",
      },
    ],
    flags: [
      {
        name: "creator",
        shortName: "c",
        description: "Creator name for the project",
        type: "string",
        defaultValue: "Creator",
      },
      {
        name: "description",
        shortName: "d",
        description: "Project description",
        type: "string",
      },
      {
        name: "output",
        shortName: "o",
        description: "Output folder path",
        type: "path",
      },
    ],
    isWriteCommand: true,
    examples: [
      "/create",
      "/create addonstarter my-addon",
      "/create tsstarter my-ts-project --creator MyName",
      '/create addonfull my-full-addon --description "A complete addon"',
    ],
  };

  async execute(
    context: IToolCommandContext,
    args: string[],
    flags: Record<string, string | boolean | string[]>
  ): Promise<IToolCommandResult> {
    const templateId = args[0] || "addonstarter";
    const projectName = args[1] || "my-project";
    const creator = (flags.creator as string) || "Creator";
    const description = (flags.description as string) || projectName;
    const outputPath = flags.output as string | undefined;

    if (!context.creatorTools) {
      return this.error("NO_CREATOR_TOOLS", "No CreatorTools instance available.");
    }

    const creatorTools = context.creatorTools;

    // Load gallery to find template
    await creatorTools.loadGallery();

    if (!creatorTools.gallery) {
      return this.error("GALLERY_ERROR", "Could not load project gallery");
    }

    // Find the template
    const galProject = await creatorTools.getGalleryProjectById(templateId);

    if (!galProject) {
      // List available templates
      const projects = creatorTools.getGalleryProjectByType(GalleryItemType.project) || [];
      const available = projects.map((p) => p.id).join(", ");
      return this.error("TEMPLATE_NOT_FOUND", `Template '${templateId}' not found. Available: ${available}`);
    }

    context.output.info(`Creating project '${projectName}' from template '${galProject.title}'...`);

    // Determine output location
    let project: Project;

    if (outputPath) {
      // Use specified output path
      project = new Project(creatorTools, projectName, null);
      project.localFolderPath = outputPath;
      project.autoDeploymentMode = ProjectAutoDeploymentMode.noAutoDeployment;
    } else if (context.project) {
      // Use current project folder if available
      project = context.project;
    } else {
      // Create in projects storage
      const newProjectName = await creatorTools.getNewProjectName(projectName);
      project = await creatorTools.createNewProject(
        newProjectName,
        undefined,
        undefined,
        undefined,
        ProjectFocus.general,
        false,
        undefined
      );
    }

    if (!project) {
      return this.error("PROJECT_ERROR", "Could not create project");
    }

    try {
      // Sync from GitHub
      project = await ProjectExporter.syncProjectFromGitHub(
        true,
        creatorTools,
        galProject.gitHubRepoName,
        galProject.gitHubOwner,
        galProject.gitHubBranch,
        galProject.gitHubFolder,
        projectName,
        project,
        galProject.fileList,
        async (message: string) => {
          context.output.debug(message);
        },
        true
      );

      // Apply customizations
      if (creator) {
        await ProjectUtilities.applyCreator(project, creator);
      }

      const suggestedShortName = ProjectUtilities.getSuggestedProjectShortName(creator, projectName);
      await ProjectUtilities.processNewProject(project, projectName, description, suggestedShortName, false);

      await project.save();

      // Set context.project so the UI navigates into the newly created project
      context.project = project;

      const projectPath = project.projectFolder?.fullPath || project.localFolderPath || "unknown location";
      context.output.success(`Project created at: ${projectPath}`);

      return this.success(`Project '${projectName}' created successfully`, {
        projectPath,
        template: galProject.id,
        name: projectName,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return this.error("CREATE_ERROR", `Failed to create project: ${message}`);
    }
  }

  /**
   * Custom completions for template argument.
   */
  async getCompletions(
    context: IToolCommandContext,
    args: string[],
    partialArg: string,
    argIndex: number
  ): Promise<string[]> {
    if (argIndex === 0) {
      // Complete template names
      return projectTemplateProvider(partialArg, context);
    }
    return [];
  }
}

export const createCommand = new CreateCommand();
