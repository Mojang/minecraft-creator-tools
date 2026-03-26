// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * McCodeActionProvider - Provides Quick Fixes using MCTools ProjectUpdater infrastructure
 *
 * This provider reads diagnostic data attached by McDiagnosticProvider and offers
 * code actions (Quick Fixes) that use the MCTools updater system to fix issues.
 *
 * Architecture:
 * - Reads McDiagnosticData from diagnostics
 * - Maps generator IDs to registered updaters
 * - Creates code actions that invoke the appropriate updater
 * - Supports both single-file fixes and project-wide fixes
 *
 * @see McDiagnosticProvider for the diagnostic producer
 * @see IProjectUpdater for the updater interface
 * @see GeneratorRegistrations for registered managers/updaters
 */

import * as vscode from "vscode";
import { McDiagnosticData } from "./McDiagnosticProvider";
import GeneratorRegistrations from "../../info/registration/GeneratorRegistrations";
import IProjectUpdater from "../../updates/IProjectUpdater";
import Project from "../../app/Project";
import IStorage from "../../storage/IStorage";
import Log from "../../core/Log";
import CreatorToolsHost from "../../app/CreatorToolsHost";
import { ScriptModuleInfoProvider } from "../../langcore/javascript/ScriptModuleInfo";

/**
 * Mapping of generator IDs to their updater instances
 */
const UPDATER_REGISTRY: { [generatorId: string]: IProjectUpdater | undefined } = {};

// Initialize the registry from GeneratorRegistrations
for (const manager of GeneratorRegistrations.managers) {
  if ("update" in manager && "id" in manager) {
    UPDATER_REGISTRY[manager.id] = manager as IProjectUpdater;
  }
}

export default class McCodeActionProvider implements vscode.CodeActionProvider {
  public static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix, vscode.CodeActionKind.SourceFixAll];

  private storageProvider: (uri: vscode.Uri) => IStorage | undefined;
  private projectCache: Map<string, Project> = new Map();

  constructor(storageProvider: (uri: vscode.Uri) => IStorage | undefined) {
    this.storageProvider = storageProvider;
  }

  public provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<(vscode.CodeAction | vscode.Command)[]> {
    const actions: vscode.CodeAction[] = [];

    for (const diagnostic of context.diagnostics) {
      if (diagnostic.source !== "MCTools") {
        continue;
      }

      const mcData = (diagnostic as any).mcToolsData as McDiagnosticData | undefined;
      if (!mcData) {
        continue;
      }

      // Get fixes for this diagnostic
      const fixes = this.getFixesForDiagnostic(document, diagnostic, mcData);
      actions.push(...fixes);
    }

    return actions;
  }

  private getFixesForDiagnostic(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic,
    data: McDiagnosticData
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];

    switch (data.generatorId) {
      case "FORMATVER":
        actions.push(...this.createFormatVersionFixes(document, diagnostic, data));
        break;

      case "SCRIPTMOD":
        actions.push(...this.createScriptModuleFixes(document, diagnostic, data));
        break;

      case "BASEGAMEVER":
        actions.push(...this.createBaseGameVersionFixes(document, diagnostic, data));
        break;

      case "MINENGVER":
        actions.push(...this.createMinEngineVersionFixes(document, diagnostic, data));
        break;

      case "ENTITYTYPE":
      case "BLOCKTYPE":
      case "ITEMTYPE":
        actions.push(...this.createTypeDefinitionFixes(document, diagnostic, data));
        break;

      default:
        // Check if there's a registered updater for this generator
        const updater = UPDATER_REGISTRY[data.generatorId];
        if (updater) {
          actions.push(this.createGenericUpdaterAction(document, diagnostic, data, updater));
        }
        break;
    }

    return actions;
  }

  /**
   * Create fixes for format_version issues
   */
  private createFormatVersionFixes(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic,
    data: McDiagnosticData
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];
    const text = document.getText();

    // Find the current format_version
    const versionMatch = text.match(/"format_version"\s*:\s*"([^"]+)"/);
    if (!versionMatch) {
      return actions;
    }

    const currentVersion = versionMatch[1];

    // Offer to update to latest stable version
    const latestVersions: { [key: string]: string } = {
      "1.16.0": "1.21.0",
      "1.16.100": "1.21.0",
      "1.17.0": "1.21.0",
      "1.18.0": "1.21.0",
      "1.19.0": "1.21.0",
      "1.20.0": "1.21.0",
    };

    const recommendedVersion = latestVersions[currentVersion] || "1.21.0";

    if (currentVersion !== recommendedVersion) {
      // Quick fix: Update this file
      const updateAction = new vscode.CodeAction(
        `Update format_version to "${recommendedVersion}"`,
        vscode.CodeActionKind.QuickFix
      );

      updateAction.edit = new vscode.WorkspaceEdit();
      updateAction.edit.replace(document.uri, diagnostic.range, `"format_version": "${recommendedVersion}"`);
      updateAction.isPreferred = true;
      updateAction.diagnostics = [diagnostic];

      actions.push(updateAction);

      // Also offer project-wide fix
      const updateAllAction = new vscode.CodeAction(
        `Update all format_versions to "${recommendedVersion}" in project`,
        vscode.CodeActionKind.QuickFix
      );
      updateAllAction.command = {
        title: "Update All Format Versions",
        command: "mctools.updateAllFormatVersions",
        arguments: [document.uri, recommendedVersion],
      };
      actions.push(updateAllAction);
    }

    return actions;
  }

  /**
   * Create fixes for script module version issues
   */
  private createScriptModuleFixes(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic,
    data: McDiagnosticData
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];

    // The diagnostic message typically includes the module name
    const moduleMatch = diagnostic.message.match(/@minecraft\/([\w-]+)/);
    if (!moduleMatch) {
      return actions;
    }

    const moduleName = moduleMatch[1];

    // Get latest version from ScriptModuleInfoProvider
    const latestVersion = ScriptModuleInfoProvider.getLatestVersion(moduleName, true);

    if (latestVersion) {
      const updateAction = new vscode.CodeAction(
        `Update @minecraft/${moduleName} to ${latestVersion}`,
        vscode.CodeActionKind.QuickFix
      );
      updateAction.command = {
        title: `Update @minecraft/${moduleName}`,
        command: "mctools.updateScriptModule",
        arguments: [document.uri, moduleName, latestVersion],
      };
      updateAction.isPreferred = true;
      updateAction.diagnostics = [diagnostic];
      actions.push(updateAction);
    }

    // Offer to update all script modules
    const updateAllAction = new vscode.CodeAction(
      "Update all @minecraft modules to latest versions",
      vscode.CodeActionKind.QuickFix
    );
    updateAllAction.command = {
      title: "Update All Script Modules",
      command: "mctools.updateAllScriptModules",
      arguments: [document.uri],
    };
    actions.push(updateAllAction);

    return actions;
  }

  /**
   * Create fixes for base game version issues
   */
  private createBaseGameVersionFixes(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic,
    data: McDiagnosticData
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];

    const updateAction = new vscode.CodeAction("Update base_game_version to latest", vscode.CodeActionKind.QuickFix);
    updateAction.command = {
      title: "Update Base Game Version",
      command: "mctools.updateBaseGameVersion",
      arguments: [document.uri],
    };
    updateAction.isPreferred = true;
    updateAction.diagnostics = [diagnostic];
    actions.push(updateAction);

    return actions;
  }

  /**
   * Create fixes for min_engine_version issues
   */
  private createMinEngineVersionFixes(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic,
    data: McDiagnosticData
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];

    const updateAction = new vscode.CodeAction("Update min_engine_version to latest", vscode.CodeActionKind.QuickFix);
    updateAction.command = {
      title: "Update Min Engine Version",
      command: "mctools.updateMinEngineVersion",
      arguments: [document.uri],
    };
    updateAction.isPreferred = true;
    updateAction.diagnostics = [diagnostic];
    actions.push(updateAction);

    return actions;
  }

  /**
   * Create fixes for entity/block/item type issues
   */
  private createTypeDefinitionFixes(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic,
    data: McDiagnosticData
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];

    // Common fix: Update format version for this type
    const updateFormatAction = new vscode.CodeAction(
      "Update format_version for this definition",
      vscode.CodeActionKind.QuickFix
    );
    updateFormatAction.command = {
      title: "Update Definition Format",
      command: "mctools.updateDefinitionFormat",
      arguments: [document.uri, data.generatorId],
    };
    updateFormatAction.diagnostics = [diagnostic];
    actions.push(updateFormatAction);

    return actions;
  }

  /**
   * Create a generic updater action for registered updaters
   */
  private createGenericUpdaterAction(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic,
    data: McDiagnosticData,
    updater: IProjectUpdater
  ): vscode.CodeAction {
    const action = new vscode.CodeAction(`Apply fix: ${updater.title}`, vscode.CodeActionKind.QuickFix);
    action.command = {
      title: updater.title,
      command: "mctools.applyUpdater",
      arguments: [document.uri, data.generatorId, data.generatorIndex],
    };
    action.diagnostics = [diagnostic];
    return action;
  }

  /**
   * Get or create a Project for workspace operations
   */
  public async getOrCreateProject(uri: vscode.Uri): Promise<Project | undefined> {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    if (!workspaceFolder) {
      return undefined;
    }

    const key = workspaceFolder.uri.toString();
    if (this.projectCache.has(key)) {
      return this.projectCache.get(key);
    }

    const storage = this.storageProvider(workspaceFolder.uri);
    if (!storage) {
      return undefined;
    }

    try {
      const creatorTools = CreatorToolsHost.getCreatorTools();
      if (!creatorTools) {
        Log.debug(`Failed to get CreatorTools instance`);
        return undefined;
      }
      const project = new Project(creatorTools, workspaceFolder.name, null);
      await project.setProjectFolder(storage.rootFolder);
      await project.inferProjectItemsFromFiles();

      this.projectCache.set(key, project);
      return project;
    } catch (error) {
      Log.debug(`Failed to create project: ${error}`);
      return undefined;
    }
  }

  /**
   * Clear the project cache
   */
  public clearCache(): void {
    this.projectCache.clear();
  }
}
