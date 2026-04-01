// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * McCompletionProvider - Provides cross-file IntelliSense for Minecraft content
 *
 * ARCHITECTURE DOCUMENTATION
 * ==========================
 *
 * This provider offers completions that JSON Schema can't provide:
 * - Texture paths from actual project files
 * - Geometry names from .geo.json files
 * - Event names from the same entity file
 * - Entity/block/item/biome identifiers from project + vanilla
 * - Animation, animation controller, render controller names
 * - Particles, fog, sounds, loot tables, recipes, structures, etc.
 *
 * Uses the shared CrossReferenceCompletionSource from langcore for all
 * cross-file references. This ensures identical logic between Monaco and VS Code.
 *
 * HOW IT WORKS:
 * 1. User triggers autocomplete in a JSON string value
 * 2. analyzeContext() extracts JSON path and property name
 * 3. determineReferenceType() uses langcore to detect what kind of reference
 * 4. getCompletionsForType() delegates to shared CrossReferenceCompletionSource
 * 5. Source queries ContentIndex (project) + Database metadata (vanilla)
 * 6. Results are converted to vscode.CompletionItem via LangcoreAdapters
 *
 * RELATED FILES:
 * - langcore/json/CrossReferenceCompletionSource.ts — Shared cross-file logic
 * - langcore/shared/MinecraftReferenceTypes.ts — Reference type detection
 * - VscodeCompletionBridge.ts — Bridges langcore interfaces with VS Code
 * - info/CrossReferenceIndexGenerator.ts — Populates content index
 * - LangcoreAdapters.ts — Type conversion (langcore → VS Code)
 *
 * @see McDiagnosticProvider for validation
 * @see McHoverProvider for documentation
 *
 * Last updated: February 2026
 */

import * as vscode from "vscode";
import IStorage from "../../storage/IStorage";
import Project from "../../app/Project";
import Log from "../../core/Log";
import CreatorToolsHost from "../../app/CreatorToolsHost";
import { MinecraftPathUtils } from "../../langcore/shared/MinecraftPathUtils";
import {
  ReferenceType,
  getReferenceTypeFromPath,
  getReferenceTypeFromProperty,
} from "../../langcore/shared/MinecraftReferenceTypes";
import { ICrossReferenceCompletionSource } from "../../langcore/json/CrossReferenceCompletionSource";
import { createVscodeCompletionSource } from "./VscodeCompletionBridge";
import { toVscodeCompletionItems } from "./LangcoreAdapters";

/**
 * Context information about the current cursor position
 */
interface CompletionContext {
  jsonPath: string[];
  propertyName: string;
  isValue: boolean;
  currentValue?: string;
  parentObject?: string;
}

// Use ReferenceType from langcore (re-export for backward compatibility)
type LocalReferenceType = ReferenceType | "unknown";

export default class McCompletionProvider implements vscode.CompletionItemProvider {
  private storageProvider: (uri: vscode.Uri) => IStorage | undefined;
  private projectCache: Map<string, Project> = new Map();
  private crossRefSourceCache: Map<string, ICrossReferenceCompletionSource> = new Map();

  // JSON paths that indicate reference types (fallback patterns)
  private static readonly REFERENCE_PATTERNS: Array<{
    pattern: RegExp;
    type: ReferenceType;
  }> = [
    // Texture references
    { pattern: /textures\.[^.]+$/, type: "texture" },
    { pattern: /texture$/, type: "texture" },
    { pattern: /textures\.default$/, type: "texture" },

    // Geometry references
    { pattern: /geometry\.[^.]+$/, type: "geometry" },
    { pattern: /geometry$/, type: "geometry" },
    { pattern: /description\.geometry$/, type: "geometry" },

    // Animation references
    { pattern: /animations\.[^.]+$/, type: "animation" },
    { pattern: /animation$/, type: "animation" },
    { pattern: /animate\[\d+\]$/, type: "animation" },

    // Animation controller references
    { pattern: /animation_controllers\[\d+\]$/, type: "animation_controller" },

    // Render controller references
    { pattern: /render_controllers\[\d+\]$/, type: "render_controller" },

    // Event references
    { pattern: /event$/, type: "event" },
    { pattern: /on_.*_event\.event$/, type: "event" },
    { pattern: /.*_event$/, type: "event" },

    // Component group references
    { pattern: /component_groups\[\d+\]$/, type: "component_group" },
    { pattern: /add\.component_groups\[\d+\]$/, type: "component_group" },
    { pattern: /remove\.component_groups\[\d+\]$/, type: "component_group" },

    // Entity references
    { pattern: /entity_type$/, type: "entity_id" },
    { pattern: /spawn_entity$/, type: "entity_id" },
    { pattern: /target_entity$/, type: "entity_id" },

    // Block references
    { pattern: /block$/, type: "block_id" },
    { pattern: /block_type$/, type: "block_id" },
    { pattern: /blocks\[\d+\]$/, type: "block_id" },

    // Item references
    { pattern: /item$/, type: "item_id" },
    { pattern: /items\[\d+\]$/, type: "item_id" },

    // Loot table references
    { pattern: /table$/, type: "loot_table" },
    { pattern: /loot_table$/, type: "loot_table" },

    // Sound references
    { pattern: /sound$/, type: "sound" },
    { pattern: /sounds\.[^.]+$/, type: "sound" },

    // Particle references
    { pattern: /particle$/, type: "particle" },
    { pattern: /particle_type$/, type: "particle" },

    // Fog references
    { pattern: /fog$/, type: "fog" },
  ];

  constructor(storageProvider: (uri: vscode.Uri) => IStorage | undefined) {
    this.storageProvider = storageProvider;
  }

  public async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    completionContext: vscode.CompletionContext
  ): Promise<vscode.CompletionItem[] | undefined> {
    // Only provide completions for JSON files in Minecraft content
    if (document.languageId !== "json") {
      return undefined;
    }

    if (!this.isMinecraftFile(document)) {
      return undefined;
    }

    try {
      const context = this.analyzeContext(document, position);
      if (!context) {
        return undefined;
      }

      const referenceType = this.determineReferenceType(context);
      if (referenceType === "unknown") {
        return undefined;
      }

      return await this.getCompletionsForType(document, context, referenceType);
    } catch (error) {
      Log.debug(`Completion error: ${error}`);
      return undefined;
    }
  }

  /**
   * Check if document is a Minecraft file using langcore
   */
  private isMinecraftFile(document: vscode.TextDocument): boolean {
    const relativePath = vscode.workspace.asRelativePath(document.uri);
    return MinecraftPathUtils.isMinecraftContentPath(relativePath);
  }

  /**
   * Analyze the JSON context at the cursor position
   */
  private analyzeContext(document: vscode.TextDocument, position: vscode.Position): CompletionContext | undefined {
    const text = document.getText();
    const offset = document.offsetAt(position);

    // Simple JSON path extraction
    // Find the current property context by scanning backwards
    const textBefore = text.substring(0, offset);
    const lines = textBefore.split("\n");
    const currentLine = lines[lines.length - 1];

    // Check if we're in a string value
    const quotesBefore = (currentLine.match(/"/g) || []).length;
    const isInString = quotesBefore % 2 === 1;

    if (!isInString) {
      return undefined; // We only complete string values
    }

    // Find the property name for this value
    const propertyMatch = currentLine.match(/"([^"]+)"\s*:\s*"[^"]*$/);
    if (!propertyMatch) {
      // Might be in an array
      const arrayMatch = currentLine.match(/\[\s*"[^"]*$/);
      if (!arrayMatch) {
        return undefined;
      }
    }

    const propertyName = propertyMatch ? propertyMatch[1] : "";

    // Build approximate JSON path
    const jsonPath = this.buildJsonPath(textBefore);

    // Extract current partial value
    const valueMatch = currentLine.match(/:\s*"([^"]*)$/);
    const currentValue = valueMatch ? valueMatch[1] : "";

    return {
      jsonPath,
      propertyName,
      isValue: true,
      currentValue,
    };
  }

  /**
   * Build an approximate JSON path from text before cursor
   */
  private buildJsonPath(textBefore: string): string[] {
    const path: string[] = [];
    const propertyPattern = /"([^"]+)"\s*:/g;

    let match;
    let depth = 0;
    let lastProperty = "";

    for (let i = 0; i < textBefore.length; i++) {
      const char = textBefore[i];
      if (char === "{" || char === "[") {
        depth++;
        if (lastProperty) {
          path.push(lastProperty);
          lastProperty = "";
        }
      } else if (char === "}" || char === "]") {
        depth--;
        if (path.length > 0) {
          path.pop();
        }
      }
    }

    // Find the last property before cursor
    let tempMatch;
    propertyPattern.lastIndex = 0;
    while ((tempMatch = propertyPattern.exec(textBefore)) !== null) {
      lastProperty = tempMatch[1];
    }

    if (lastProperty) {
      path.push(lastProperty);
    }

    return path;
  }

  /**
   * Determine what type of reference we're completing using langcore
   */
  private determineReferenceType(context: CompletionContext): LocalReferenceType {
    const pathString = context.jsonPath.join(".");

    // First try langcore reference detection (pass path as array)
    const langcoreType = getReferenceTypeFromPath(context.jsonPath);
    if (langcoreType !== "unknown") {
      return langcoreType;
    }

    // Also check property name via langcore
    const propType = getReferenceTypeFromProperty(context.propertyName);
    if (propType !== "unknown") {
      return propType;
    }

    // Fall back to local patterns
    for (const { pattern, type } of McCompletionProvider.REFERENCE_PATTERNS) {
      if (pattern.test(pathString) || pattern.test(context.propertyName)) {
        return type as LocalReferenceType;
      }
    }

    return "unknown";
  }

  /**
   * Get or create a cross-reference completion source for a project.
   * Sources are cached per workspace folder.
   */
  private getOrCreateCrossRefSource(
    project: Project,
    workspaceKey: string
  ): ICrossReferenceCompletionSource {
    let source = this.crossRefSourceCache.get(workspaceKey);
    if (!source) {
      source = createVscodeCompletionSource(project);
      this.crossRefSourceCache.set(workspaceKey, source);
    }
    return source;
  }

  /**
   * Get completions for a specific reference type.
   * Uses the shared CrossReferenceCompletionSource for all cross-file references.
   * Same-file references (event, component_group) are extracted from the document.
   */
  private async getCompletionsForType(
    document: vscode.TextDocument,
    context: CompletionContext,
    type: ReferenceType
  ): Promise<vscode.CompletionItem[]> {
    // Handle same-file references directly from the document
    if (type === "event" || type === "component_group") {
      return this.getSameFileCompletions(document, type);
    }

    // For all cross-file references, use the shared source
    const project = await this.getProject(document.uri);
    if (!project) {
      return [];
    }

    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
    const workspaceKey = workspaceFolder?.uri.toString() || document.uri.toString();
    const source = this.getOrCreateCrossRefSource(project, workspaceKey);

    try {
      const langcoreItems = await source.getCompletionsForReferenceType(type);
      return toVscodeCompletionItems(langcoreItems);
    } catch (e) {
      Log.debug(`[McCompletionProvider] Cross-reference completion error for ${type}: ${e}`);
      return [];
    }
  }

  /**
   * Get same-file completions (events, component groups) from the current document.
   * Uses the shared CrossReferenceCompletionSource.getSameFileCompletions() method.
   */
  private getSameFileCompletions(
    document: vscode.TextDocument,
    type: "event" | "component_group"
  ): vscode.CompletionItem[] {
    const text = document.getText();

    try {
      const json = JSON.parse(text);

      // Get project and source for same-file completions
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
      const workspaceKey = workspaceFolder?.uri.toString() || document.uri.toString();
      const source = this.crossRefSourceCache.get(workspaceKey);

      if (source) {
        const langcoreItems = source.getSameFileCompletions(type, json);
        return toVscodeCompletionItems(langcoreItems);
      }

      // Fallback: extract directly if no source is available yet
      const entity = json["minecraft:entity"];
      if (!entity) return [];

      const items: vscode.CompletionItem[] = [];

      if (type === "event" && entity.events) {
        for (const eventName of Object.keys(entity.events)) {
          const item = new vscode.CompletionItem(eventName, vscode.CompletionItemKind.Event);
          item.detail = "Event in this entity";
          items.push(item);
        }
      } else if (type === "component_group" && entity.component_groups) {
        for (const groupName of Object.keys(entity.component_groups)) {
          const item = new vscode.CompletionItem(groupName, vscode.CompletionItemKind.Class);
          item.detail = "Component group in this entity";
          items.push(item);
        }
      }

      return items;
    } catch {
      // Document may not be valid JSON yet
      return [];
    }
  }

  /**
   * Get or create a project for a URI
   */
  private async getProject(uri: vscode.Uri): Promise<Project | undefined> {
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
   * Clear the project cache and cross-reference source cache
   */
  public clearCache(): void {
    this.projectCache.clear();
    this.crossRefSourceCache.clear();
  }
}
