// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * McToolsLmTools - Language Model Tools for VS Code Copilot
 *
 * This module provides Language Model Tools that can be invoked by Copilot
 * or any other chat participant. These tools wrap the MCP server functionality
 * to provide Minecraft-specific operations.
 *
 * Tools are registered with vscode.lm.registerTool() and declared in package.json.
 *
 * @see MinecraftMcpServer for the underlying implementations
 * @see https://code.visualstudio.com/api/extension-guides/language-model-tool
 */

import * as vscode from "vscode";
import Log from "../../core/Log";
import IStorage from "../../storage/IStorage";
import Project from "../../app/Project";

/**
 * Tool names - these must match the declarations in package.json
 */
export const TOOL_VALIDATE_PROJECT = "mctools-validateProject";
export const TOOL_GET_PROJECT_INFO = "mctools-getProjectInfo";
export const TOOL_LIST_ENTITIES = "mctools-listEntities";
export const TOOL_GET_ENTITY_INFO = "mctools-getEntityInfo";

/**
 * Input types for tools
 */
interface ValidateProjectInput {
  folderPath?: string;
}

interface GetProjectInfoInput {
  folderPath?: string;
}

interface ListEntitiesInput {
  folderPath?: string;
}

interface GetEntityInfoInput {
  identifier: string;
  folderPath?: string;
}

/**
 * Manager for Language Model Tools registration and lifecycle
 */
export default class McToolsLmTools {
  private storageProvider: (uri: vscode.Uri) => IStorage | undefined;
  private projectProvider: (uri: vscode.Uri) => Promise<Project | undefined>;
  private disposables: vscode.Disposable[] = [];

  constructor(
    storageProvider: (uri: vscode.Uri) => IStorage | undefined,
    projectProvider: (uri: vscode.Uri) => Promise<Project | undefined>
  ) {
    this.storageProvider = storageProvider;
    this.projectProvider = projectProvider;
  }

  /**
   * Register all Language Model Tools with VS Code
   */
  public register(context: vscode.ExtensionContext): void {
    // Check if LM tools API is available (requires VS Code 1.93+)
    if (!vscode.lm || !vscode.lm.registerTool) {
      Log.debug("Language Model Tools API not available - skipping registration");
      return;
    }

    try {
      // Register each tool
      this.registerValidateProjectTool(context);
      this.registerGetProjectInfoTool(context);
      this.registerListEntitiesTool(context);
      this.registerGetEntityInfoTool(context);

      Log.debug("Minecraft Language Model Tools registered successfully");
    } catch (error) {
      Log.debug(`Failed to register LM tools: ${error}`);
    }
  }

  /**
   * Register the validateProject tool
   */
  private registerValidateProjectTool(context: vscode.ExtensionContext): void {
    const tool = new ValidateProjectTool(this.projectProvider);
    const disposable = vscode.lm.registerTool(TOOL_VALIDATE_PROJECT, tool);
    this.disposables.push(disposable);
    context.subscriptions.push(disposable);
  }

  /**
   * Register the getProjectInfo tool
   */
  private registerGetProjectInfoTool(context: vscode.ExtensionContext): void {
    const tool = new GetProjectInfoTool(this.projectProvider);
    const disposable = vscode.lm.registerTool(TOOL_GET_PROJECT_INFO, tool);
    this.disposables.push(disposable);
    context.subscriptions.push(disposable);
  }

  /**
   * Register the listEntities tool
   */
  private registerListEntitiesTool(context: vscode.ExtensionContext): void {
    const tool = new ListEntitiesTool(this.projectProvider);
    const disposable = vscode.lm.registerTool(TOOL_LIST_ENTITIES, tool);
    this.disposables.push(disposable);
    context.subscriptions.push(disposable);
  }

  /**
   * Register the getEntityInfo tool
   */
  private registerGetEntityInfoTool(context: vscode.ExtensionContext): void {
    const tool = new GetEntityInfoTool(this.projectProvider);
    const disposable = vscode.lm.registerTool(TOOL_GET_ENTITY_INFO, tool);
    this.disposables.push(disposable);
    context.subscriptions.push(disposable);
  }

  /**
   * Dispose of all registered tools
   */
  public dispose(): void {
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
  }
}

/**
 * Helper to get workspace folder URI, optionally from a path
 */
async function getWorkspaceFolderUri(folderPath?: string): Promise<vscode.Uri | undefined> {
  if (folderPath) {
    return vscode.Uri.file(folderPath);
  }

  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders && workspaceFolders.length > 0) {
    return workspaceFolders[0].uri;
  }

  return undefined;
}

/**
 * Tool: Validate a Minecraft project
 */
class ValidateProjectTool implements vscode.LanguageModelTool<ValidateProjectInput> {
  private projectProvider: (uri: vscode.Uri) => Promise<Project | undefined>;

  constructor(projectProvider: (uri: vscode.Uri) => Promise<Project | undefined>) {
    this.projectProvider = projectProvider;
  }

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<ValidateProjectInput>,
    token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    const uri = await getWorkspaceFolderUri(options.input.folderPath);
    if (!uri) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(JSON.stringify({ error: "No workspace folder found" })),
      ]);
    }

    const project = await this.projectProvider(uri);
    if (!project) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(JSON.stringify({ error: "Could not load project" })),
      ]);
    }

    // Run validation
    const infoSet = project.indevInfoSet;
    await infoSet.generateForProject();
    const data = infoSet.getDataObject(undefined, undefined, undefined);

    // Summarize results
    const summary = {
      totalItems: data.items?.length || 0,
      errors: data.items?.filter((i: any) => i.type === "error").length || 0,
      warnings: data.items?.filter((i: any) => i.type === "warning").length || 0,
      recommendations: data.items?.filter((i: any) => i.type === "recommendation").length || 0,
      topIssues: data.items?.slice(0, 20).map((i: any) => ({
        type: i.type,
        generator: i.generatorId,
        message: i.message,
        file: i.file,
      })),
    };

    return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(JSON.stringify(summary, null, 2))]);
  }

  prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<ValidateProjectInput>,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.PreparedToolInvocation> {
    return {
      invocationMessage: "Validating Minecraft project...",
    };
  }
}

/**
 * Tool: Get project information
 */
class GetProjectInfoTool implements vscode.LanguageModelTool<GetProjectInfoInput> {
  private projectProvider: (uri: vscode.Uri) => Promise<Project | undefined>;

  constructor(projectProvider: (uri: vscode.Uri) => Promise<Project | undefined>) {
    this.projectProvider = projectProvider;
  }

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<GetProjectInfoInput>,
    token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    const uri = await getWorkspaceFolderUri(options.input.folderPath);
    if (!uri) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(JSON.stringify({ error: "No workspace folder found" })),
      ]);
    }

    const project = await this.projectProvider(uri);
    if (!project) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(JSON.stringify({ error: "Could not load project" })),
      ]);
    }

    // Gather project info
    const info = {
      name: project.name,
      projectFolder: project.projectFolder?.fullPath,
      itemCount: project.items.length,
      hasScripts: project.items.some((i) => i.itemType?.toString().includes("script")),
      hasBehaviorPack: project.items.some((i) => i.itemType?.toString().includes("behavior")),
      hasResourcePack: project.items.some((i) => i.itemType?.toString().includes("resource")),
      itemTypes: [...new Set(project.items.map((i) => i.itemType?.toString()).filter(Boolean))],
    };

    return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(JSON.stringify(info, null, 2))]);
  }

  prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<GetProjectInfoInput>,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.PreparedToolInvocation> {
    return {
      invocationMessage: "Getting project information...",
    };
  }
}

/**
 * Tool: List entities in a project
 */
class ListEntitiesTool implements vscode.LanguageModelTool<ListEntitiesInput> {
  private projectProvider: (uri: vscode.Uri) => Promise<Project | undefined>;

  constructor(projectProvider: (uri: vscode.Uri) => Promise<Project | undefined>) {
    this.projectProvider = projectProvider;
  }

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<ListEntitiesInput>,
    token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    const uri = await getWorkspaceFolderUri(options.input.folderPath);
    if (!uri) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(JSON.stringify({ error: "No workspace folder found" })),
      ]);
    }

    const project = await this.projectProvider(uri);
    if (!project) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(JSON.stringify({ error: "Could not load project" })),
      ]);
    }

    // Find entity items
    const entityItems = project.items.filter(
      (i) =>
        i.itemType?.toString().includes("entityType") ||
        i.projectPath?.includes("/entities/") ||
        i.projectPath?.includes("/entity/")
    );

    const entities = entityItems.map((item) => ({
      name: item.name,
      path: item.projectPath,
      type: item.itemType?.toString(),
    }));

    return new vscode.LanguageModelToolResult([
      new vscode.LanguageModelTextPart(
        JSON.stringify(
          {
            count: entities.length,
            entities,
          },
          null,
          2
        )
      ),
    ]);
  }

  prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<ListEntitiesInput>,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.PreparedToolInvocation> {
    return {
      invocationMessage: "Listing entities...",
    };
  }
}

/**
 * Tool: Get detailed info about a specific entity
 */
class GetEntityInfoTool implements vscode.LanguageModelTool<GetEntityInfoInput> {
  private projectProvider: (uri: vscode.Uri) => Promise<Project | undefined>;

  constructor(projectProvider: (uri: vscode.Uri) => Promise<Project | undefined>) {
    this.projectProvider = projectProvider;
  }

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<GetEntityInfoInput>,
    token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    const uri = await getWorkspaceFolderUri(options.input.folderPath);
    if (!uri) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(JSON.stringify({ error: "No workspace folder found" })),
      ]);
    }

    const project = await this.projectProvider(uri);
    if (!project) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(JSON.stringify({ error: "Could not load project" })),
      ]);
    }

    // Find the entity by identifier
    const identifier = options.input.identifier;
    const entityItem = project.items.find(
      (i) =>
        i.name?.toLowerCase() === identifier.toLowerCase() ||
        i.projectPath?.toLowerCase().includes(identifier.toLowerCase())
    );

    if (!entityItem) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(JSON.stringify({ error: `Entity '${identifier}' not found` })),
      ]);
    }

    // Load the entity file content
    await entityItem.ensureStorage();
    const file = entityItem.getFile();

    if (!file) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(JSON.stringify({ error: "Could not load entity file" })),
      ]);
    }

    await file.loadContent();
    const content = file.content;

    if (typeof content === "string") {
      try {
        const json = JSON.parse(content);
        const entity = json["minecraft:entity"];

        if (entity) {
          const info = {
            identifier: entity.description?.identifier,
            isSpawnable: entity.description?.is_spawnable,
            isSummonable: entity.description?.is_summonable,
            isExperimental: entity.description?.is_experimental,
            formatVersion: json.format_version,
            componentCount: entity.components ? Object.keys(entity.components).length : 0,
            components: entity.components ? Object.keys(entity.components) : [],
            componentGroupCount: entity.component_groups ? Object.keys(entity.component_groups).length : 0,
            componentGroups: entity.component_groups ? Object.keys(entity.component_groups) : [],
            eventCount: entity.events ? Object.keys(entity.events).length : 0,
            events: entity.events ? Object.keys(entity.events) : [],
            filePath: entityItem.projectPath,
          };

          return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(JSON.stringify(info, null, 2))]);
        }
      } catch (e) {
        // Fall through to return raw info
      }
    }

    // Return basic info if we couldn't parse
    return new vscode.LanguageModelToolResult([
      new vscode.LanguageModelTextPart(
        JSON.stringify(
          {
            name: entityItem.name,
            path: entityItem.projectPath,
            type: entityItem.itemType?.toString(),
          },
          null,
          2
        )
      ),
    ]);
  }

  prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<GetEntityInfoInput>,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.PreparedToolInvocation> {
    return {
      invocationMessage: `Getting info for entity: ${options.input.identifier}...`,
    };
  }
}
