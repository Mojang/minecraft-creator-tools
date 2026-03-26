// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * McDiagnosticProvider - Bridges MCTools validators to VS Code's Problems panel
 *
 * This provider watches Minecraft JSON files and runs the MCTools validation
 * infrastructure (ProjectInfoSet, InfoGenerators) to produce diagnostics that
 * appear in VS Code's native Problems panel.
 *
 * Architecture:
 * - Listens to document changes and workspace events
 * - Creates a lightweight Project for each workspace folder
 * - Runs validation through ProjectInfoSet
 * - Converts ProjectInfoItem results to VS Code Diagnostics
 * - Attaches updater metadata to diagnostics for CodeActionProvider to use
 *
 * @see ProjectInfoSet for the validation infrastructure
 * @see McCodeActionProvider for the corresponding quick-fix provider
 */

import * as vscode from "vscode";
import Project from "../../app/Project";
import ProjectInfoSet from "../../info/ProjectInfoSet";
import ProjectInfoItem from "../../info/ProjectInfoItem";
import { InfoItemType } from "../../info/IInfoItemData";
import { ProjectInfoSuite } from "../../info/IProjectInfoData";
import IStorage from "../../storage/IStorage";
import Log from "../../core/Log";
import CreatorToolsHost from "../../app/CreatorToolsHost";
import VsFsStorage from "../../vscode/VsFsStorage";
import InfoGeneratorTopicUtilities from "../../info/InfoGeneratorTopicUtilities";

/**
 * Data attached to each diagnostic for use by CodeActionProvider
 */
export interface McDiagnosticData {
  generatorId: string;
  generatorIndex: number;
  projectItemPath?: string;
  updaterId?: string;
  updaterIndex?: number;
  fixData?: any;
}

/**
 * Debounce helper for validation
 */
function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => func(...args), wait);
  };
}

export default class McDiagnosticProvider implements vscode.Disposable {
  private diagnosticCollection: vscode.DiagnosticCollection;
  private disposables: vscode.Disposable[] = [];
  private projectCache: Map<string, Project> = new Map();
  private storageProvider: (uri: vscode.Uri) => IStorage | undefined;
  private validationInProgress: Set<string> = new Set();
  private context: vscode.ExtensionContext | undefined;

  // File patterns for Minecraft content
  private static readonly MINECRAFT_PATTERNS = [
    "**/behavior_packs/**/*.json",
    "**/resource_packs/**/*.json",
    "**/BP/**/*.json",
    "**/RP/**/*.json",
    "**/entities/*.json",
    "**/entity/*.json",
    "**/blocks/*.json",
    "**/items/*.json",
    "**/loot_tables/**/*.json",
    "**/spawn_rules/*.json",
    "**/trading/**/*.json",
    "**/recipes/*.json",
    "**/animations/*.json",
    "**/animation_controllers/*.json",
    "**/attachables/*.json",
    "**/render_controllers/*.json",
    "**/models/**/*.json",
    "**/particles/*.json",
    "**/fogs/*.json",
    "**/manifest.json",
  ];

  constructor(storageProvider: (uri: vscode.Uri) => IStorage | undefined) {
    this.storageProvider = storageProvider;
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection("mctools");
    this.disposables.push(this.diagnosticCollection);

    // Debounced validation to avoid excessive processing
    const debouncedValidate = debounce((doc: vscode.TextDocument) => this.validateDocument(doc), 500);

    // Watch for document changes
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((e) => {
        if (this.isMinecraftFile(e.document)) {
          debouncedValidate(e.document);
        }
      })
    );

    // Watch for document opens
    this.disposables.push(
      vscode.workspace.onDidOpenTextDocument((doc) => {
        if (this.isMinecraftFile(doc)) {
          this.validateDocument(doc);
        }
      })
    );

    // Watch for document saves - validate immediately
    this.disposables.push(
      vscode.workspace.onDidSaveTextDocument((doc) => {
        if (this.isMinecraftFile(doc)) {
          this.validateDocument(doc);
        }
      })
    );

    // Clear diagnostics when document closes
    this.disposables.push(
      vscode.workspace.onDidCloseTextDocument((doc) => {
        this.diagnosticCollection.delete(doc.uri);
      })
    );

    // Validate all open Minecraft documents on activation
    this.validateOpenDocuments();
  }

  /**
   * Activate the diagnostic provider with extension context.
   * Called by ExtensionManager after construction.
   */
  public activate(context: vscode.ExtensionContext): void {
    this.context = context;
  }

  /**
   * Check if a document is a Minecraft-related file
   */
  private isMinecraftFile(document: vscode.TextDocument): boolean {
    if (document.languageId !== "json") {
      return false;
    }

    const relativePath = vscode.workspace.asRelativePath(document.uri);
    return (
      relativePath.includes("behavior_pack") ||
      relativePath.includes("resource_pack") ||
      relativePath.includes("/BP/") ||
      relativePath.includes("/RP/") ||
      relativePath.includes("\\BP\\") ||
      relativePath.includes("\\RP\\") ||
      relativePath.includes("/entities/") ||
      relativePath.includes("/entity/") ||
      relativePath.includes("\\entities\\") ||
      relativePath.includes("\\entity\\") ||
      relativePath.includes("/blocks/") ||
      relativePath.includes("\\blocks\\") ||
      relativePath.includes("/items/") ||
      relativePath.includes("\\items\\") ||
      relativePath.includes("manifest.json")
    );
  }

  /**
   * Validate all currently open Minecraft documents
   */
  private async validateOpenDocuments(): Promise<void> {
    for (const doc of vscode.workspace.textDocuments) {
      if (this.isMinecraftFile(doc)) {
        await this.validateDocument(doc);
      }
    }
  }

  /**
   * Main validation entry point for a document
   */
  public async validateDocument(document: vscode.TextDocument): Promise<void> {
    const uriString = document.uri.toString();

    // Prevent concurrent validation of the same file
    if (this.validationInProgress.has(uriString)) {
      return;
    }

    this.validationInProgress.add(uriString);

    try {
      const diagnostics = await this.generateDiagnostics(document);
      this.diagnosticCollection.set(document.uri, diagnostics);
    } catch (error) {
      Log.debug(`Validation error for ${document.uri.fsPath}: ${error}`);
    } finally {
      this.validationInProgress.delete(uriString);
    }
  }

  /**
   * Generate diagnostics for a document using MCTools validation
   */
  private async generateDiagnostics(document: vscode.TextDocument): Promise<vscode.Diagnostic[]> {
    const diagnostics: vscode.Diagnostic[] = [];

    // Try to parse the JSON first - if it fails, show parse error
    try {
      JSON.parse(document.getText());
    } catch (e) {
      // JSON parse error - let the built-in JSON extension handle this
      return diagnostics;
    }

    // Get or create project for this workspace
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
    if (!workspaceFolder) {
      return diagnostics;
    }

    const project = await this.getOrCreateProject(workspaceFolder);
    if (!project) {
      return diagnostics;
    }

    // Run validation
    const infoSet = new ProjectInfoSet(project, ProjectInfoSuite.defaultInDevelopment);
    await infoSet.generateForProject();

    // Filter items for this specific file
    const relativePath = vscode.workspace.asRelativePath(document.uri, false);

    for (const item of infoSet.items) {
      // Match items to this document
      if (item.projectItem?.projectPath?.includes(relativePath) || item.projectItemPath?.includes(relativePath)) {
        const diagnostic = await this.createDiagnostic(document, item);
        if (diagnostic) {
          diagnostics.push(diagnostic);
        }
      }
    }

    return diagnostics;
  }

  /**
   * Convert a ProjectInfoItem to a VS Code Diagnostic
   */
  private async createDiagnostic(
    document: vscode.TextDocument,
    item: ProjectInfoItem
  ): Promise<vscode.Diagnostic | undefined> {
    // Map MCTools severity to VS Code severity
    let severity: vscode.DiagnosticSeverity;
    switch (item.itemType) {
      case InfoItemType.error:
      case InfoItemType.testCompleteFail:
        severity = vscode.DiagnosticSeverity.Error;
        break;
      case InfoItemType.warning:
        severity = vscode.DiagnosticSeverity.Warning;
        break;
      case InfoItemType.recommendation:
        severity = vscode.DiagnosticSeverity.Information;
        break;
      case InfoItemType.info:
        severity = vscode.DiagnosticSeverity.Hint;
        break;
      default:
        // Skip internal/aggregation items
        return undefined;
    }

    // Try to find the range in the document
    const range = await this.findRangeForItem(document, item);

    const message = item.message || `${item.generatorId}: Issue ${item.generatorIndex}`;

    const diagnostic = new vscode.Diagnostic(range, message, severity);
    diagnostic.source = "MCTools";
    diagnostic.code = `${item.generatorId}.${item.generatorIndex}`;

    // Attach data for CodeActionProvider
    const data: McDiagnosticData = {
      generatorId: item.generatorId,
      generatorIndex: item.generatorIndex,
      projectItemPath: item.projectItemPath ?? undefined,
    };

    // Check if this item has an associated updater
    if (item.dataObject && (item.dataObject as any).updaterId) {
      data.updaterId = (item.dataObject as any).updaterId;
      data.updaterIndex = (item.dataObject as any).updaterIndex;
    }

    // Store the data for CodeActionProvider to access
    (diagnostic as any).mcToolsData = data;

    return diagnostic;
  }

  /**
   * Try to find the source location for an info item.
   * 
   * Uses suggestedLineToken from form.json files when available, falling back
   * to heuristics based on generator ID.
   */
  private async findRangeForItem(document: vscode.TextDocument, item: ProjectInfoItem): Promise<vscode.Range> {
    const text = document.getText();

    // Try to find specific content from the item
    if (item.content) {
      const index = text.indexOf(item.content);
      if (index >= 0) {
        const start = document.positionAt(index);
        const end = document.positionAt(index + item.content.length);
        return new vscode.Range(start, end);
      }
    }

    // Try to get suggestedLineToken from form.json topic data
    if (item.generatorId) {
      try {
        const topicData = await InfoGeneratorTopicUtilities.getTopicData(item.generatorId, item.generatorIndex);
        if (topicData?.suggestedLineToken) {
          const token = topicData.suggestedLineToken;
          const escapedToken = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

          // If suggestedLineShouldHaveData is true and we have data, look for both token and data on same line
          if (topicData.suggestedLineShouldHaveData && item.data) {
            const dataStr = String(item.data);
            const escapedData = dataStr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            // Build pattern: token ... data on same line (no newlines between)
            const combinedPattern = new RegExp(
              `"${escapedToken}"[^\\n]*${escapedData}|${escapedData}[^\\n]*"${escapedToken}"`,
              "i"
            );
            const combinedMatch = text.match(combinedPattern);
            if (combinedMatch && combinedMatch.index !== undefined) {
              const start = document.positionAt(combinedMatch.index);
              const end = document.positionAt(combinedMatch.index + combinedMatch[0].length);
              return new vscode.Range(start, end);
            }
          }

          // Build a pattern that matches the token as a JSON property
          const tokenPattern = new RegExp(`"${escapedToken}"\\s*:\\s*[^,}\\]]+`, "i");
          const match = text.match(tokenPattern);
          if (match && match.index !== undefined) {
            const start = document.positionAt(match.index);
            const end = document.positionAt(match.index + match[0].length);
            return new vscode.Range(start, end);
          }
          // Also try simple string search if pattern doesn't match
          const simpleIndex = text.indexOf(`"${token}"`);
          if (simpleIndex >= 0) {
            const lineEndIndex = text.indexOf("\n", simpleIndex);
            const end = lineEndIndex > simpleIndex ? lineEndIndex : simpleIndex + token.length + 2;
            const start = document.positionAt(simpleIndex);
            const endPos = document.positionAt(end);
            return new vscode.Range(start, endPos);
          }
        }
      } catch {
        // Ignore errors loading topic data
      }
    }

    // Fallback: Try to find format_version for format version issues
    if (item.generatorId === "FORMATVER" || item.generatorId?.includes("FORMAT")) {
      const versionPattern = /"format_version"\s*:\s*"[^"]+"/i;
      const match = text.match(versionPattern);
      if (match && match.index !== undefined) {
        const start = document.positionAt(match.index);
        const end = document.positionAt(match.index + match[0].length);
        return new vscode.Range(start, end);
      }
    }

    // Fallback: Try to find identifier for entity/block/item issues
    if (item.generatorId === "ENTITYTYPE" || item.generatorId === "BLOCKTYPE" || item.generatorId === "ITEMTYPE") {
      const identifierPattern = /"identifier"\s*:\s*"[^"]+"/;
      const match = text.match(identifierPattern);
      if (match && match.index !== undefined) {
        const start = document.positionAt(match.index);
        const end = document.positionAt(match.index + match[0].length);
        return new vscode.Range(start, end);
      }
    }

    // Default to first line if we can't find a specific location
    return new vscode.Range(0, 0, 0, 0);
  }

  /**
   * Get or create a Project for a workspace folder.
   * Creates storage on-demand if the storageProvider doesn't have it yet.
   */
  private async getOrCreateProject(workspaceFolder: vscode.WorkspaceFolder): Promise<Project | undefined> {
    const key = workspaceFolder.uri.toString();

    if (this.projectCache.has(key)) {
      return this.projectCache.get(key);
    }

    // Try to get storage from the provider first
    let storage = this.storageProvider(workspaceFolder.uri);

    // If storage not available (extension still initializing), create it on-demand
    if (!storage) {
      if (!this.context) {
        Log.debug(`Cannot create on-demand storage: extension context not available for ${workspaceFolder.name}`);
        return undefined;
      }
      try {
        // Create storage for the workspace folder directly using VsFsStorage
        storage = new VsFsStorage(this.context, workspaceFolder.uri.fsPath, workspaceFolder.name);
        await storage.rootFolder.load();
      } catch (error) {
        Log.debug(`Failed to create on-demand storage for ${workspaceFolder.name}: ${error}`);
        return undefined;
      }
    }

    try {
      const creatorTools = CreatorToolsHost.getCreatorTools();
      if (!creatorTools) {
        Log.debug(`Failed to get CreatorTools instance for ${workspaceFolder.name}`);
        return undefined;
      }
      const project = new Project(creatorTools, workspaceFolder.name, null);
      const rootFolder = storage.rootFolder;
      await project.setProjectFolder(rootFolder);
      await project.inferProjectItemsFromFiles();

      this.projectCache.set(key, project);
      return project;
    } catch (error) {
      Log.debug(`Failed to create project for ${workspaceFolder.name}: ${error}`);
      return undefined;
    }
  }

  /**
   * Clear the project cache (e.g., when workspace changes)
   */
  public clearCache(): void {
    this.projectCache.clear();
  }

  /**
   * Validate all files in a workspace folder
   */
  public async validateWorkspace(workspaceFolder: vscode.WorkspaceFolder): Promise<void> {
    const project = await this.getOrCreateProject(workspaceFolder);
    if (!project) {
      return;
    }

    const infoSet = new ProjectInfoSet(project, ProjectInfoSuite.defaultInDevelopment);
    await infoSet.generateForProject();

    // Group diagnostics by file
    const diagnosticsByUri = new Map<string, vscode.Diagnostic[]>();

    for (const item of infoSet.items) {
      if (!item.projectItemPath) {
        continue;
      }

      const fileUri = vscode.Uri.joinPath(workspaceFolder.uri, item.projectItemPath);
      const uriString = fileUri.toString();

      if (!diagnosticsByUri.has(uriString)) {
        diagnosticsByUri.set(uriString, []);
      }

      // We need the document to create proper diagnostics
      try {
        const doc = await vscode.workspace.openTextDocument(fileUri);
        const diagnostic = await this.createDiagnostic(doc, item);
        if (diagnostic) {
          diagnosticsByUri.get(uriString)!.push(diagnostic);
        }
      } catch {
        // File might not exist or be readable
      }
    }

    // Update all diagnostics
    for (const [uriString, diags] of diagnosticsByUri) {
      this.diagnosticCollection.set(vscode.Uri.parse(uriString), diags);
    }
  }

  public dispose(): void {
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.projectCache.clear();
  }
}
