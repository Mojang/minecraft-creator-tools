// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * McDefinitionProvider - Go-to-Definition for Minecraft content references
 *
 * This provider enables Ctrl+Click / F12 navigation for:
 * - Texture paths → texture files
 * - Geometry references → .geo.json files
 * - Animation references → .animation.json files
 * - Event references → event definition in same file
 * - Entity identifiers → entity behavior file
 * - Loot table references → loot table file
 *
 * @see McCompletionProvider for auto-complete
 * @see McHoverProvider for documentation
 */

import * as vscode from "vscode";
import IStorage from "../../storage/IStorage";
import Project from "../../app/Project";
import Log from "../../core/Log";
import CreatorToolsHost from "../../app/CreatorToolsHost";

/**
 * Types of references we can navigate to
 */
type ReferenceType =
  | "texture"
  | "geometry"
  | "animation"
  | "animation_controller"
  | "event"
  | "component_group"
  | "entity_id"
  | "loot_table"
  | "sound"
  | "render_controller"
  | "unknown";

export default class McDefinitionProvider implements vscode.DefinitionProvider {
  private storageProvider: (uri: vscode.Uri) => IStorage | undefined;
  private projectCache: Map<string, Project> = new Map();

  constructor(storageProvider: (uri: vscode.Uri) => IStorage | undefined) {
    this.storageProvider = storageProvider;
  }

  /**
   * Escape all regex special characters in a string.
   * This is required when creating RegExp from user input to prevent regex injection.
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  public async provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Promise<vscode.Definition | vscode.LocationLink[] | undefined> {
    if (document.languageId !== "json") {
      return undefined;
    }

    if (!this.isMinecraftFile(document)) {
      return undefined;
    }

    try {
      // Get the string value at the cursor position
      const valueInfo = this.getStringValueAtPosition(document, position);
      if (!valueInfo) {
        return undefined;
      }

      // Determine what type of reference this is
      const context = this.analyzeContext(document, valueInfo.range.start);
      if (!context) {
        return undefined;
      }

      // Find the definition
      return await this.findDefinition(document, valueInfo.value, context.type);
    } catch (error) {
      Log.debug(`Definition error: ${error}`);
      return undefined;
    }
  }

  private isMinecraftFile(document: vscode.TextDocument): boolean {
    const relativePath = vscode.workspace.asRelativePath(document.uri);
    return (
      relativePath.includes("behavior_pack") ||
      relativePath.includes("resource_pack") ||
      relativePath.includes("/BP/") ||
      relativePath.includes("/RP/") ||
      relativePath.includes("\\BP\\") ||
      relativePath.includes("\\RP\\")
    );
  }

  /**
   * Get the string value at the cursor position
   */
  private getStringValueAtPosition(
    document: vscode.TextDocument,
    position: vscode.Position
  ): { value: string; range: vscode.Range } | undefined {
    const line = document.lineAt(position.line).text;
    const charPos = position.character;

    // Find the string bounds
    let startQuote = -1;
    let endQuote = -1;

    // Search backwards for opening quote
    for (let i = charPos; i >= 0; i--) {
      if (line[i] === '"') {
        // Make sure it's not escaped
        let escapeCount = 0;
        for (let j = i - 1; j >= 0 && line[j] === "\\"; j--) {
          escapeCount++;
        }
        if (escapeCount % 2 === 0) {
          startQuote = i;
          break;
        }
      }
    }

    // Search forwards for closing quote
    for (let i = charPos; i < line.length; i++) {
      if (line[i] === '"') {
        let escapeCount = 0;
        for (let j = i - 1; j >= 0 && line[j] === "\\"; j--) {
          escapeCount++;
        }
        if (escapeCount % 2 === 0) {
          endQuote = i;
          break;
        }
      }
    }

    if (startQuote === -1 || endQuote === -1 || startQuote >= endQuote) {
      return undefined;
    }

    const value = line.substring(startQuote + 1, endQuote);
    const range = new vscode.Range(position.line, startQuote + 1, position.line, endQuote);

    return { value, range };
  }

  /**
   * Analyze the context to determine reference type
   */
  private analyzeContext(
    document: vscode.TextDocument,
    position: vscode.Position
  ): { type: ReferenceType; propertyName: string } | undefined {
    const line = document.lineAt(position.line).text;

    // Find the property name for this value
    const propertyMatch = line.match(/"([^"]+)"\s*:\s*"/);
    const propertyName = propertyMatch ? propertyMatch[1] : "";

    // Also check if we're in an array value - look for the parent property
    let type = this.determineReferenceType(propertyName, line, document, position);

    return { type, propertyName };
  }

  /**
   * Determine reference type from context
   */
  private determineReferenceType(
    propertyName: string,
    line: string,
    document: vscode.TextDocument,
    position: vscode.Position
  ): ReferenceType {
    const propLower = propertyName.toLowerCase();

    // Check value patterns - this helps detect references by value rather than just property name
    // Extract the value from the line to check patterns
    const valueMatch = line.match(/:\s*"([^"]+)"/);
    const value = valueMatch ? valueMatch[1] : "";

    // Texture references - check both property name AND value patterns
    // Value patterns: "textures/...", paths that start with textures/
    if (
      propLower === "texture" ||
      propLower === "textures" ||
      propLower.includes("texture") ||
      line.includes('"textures"') ||
      value.startsWith("textures/") ||
      value.match(/^textures[\\\/]/)
    ) {
      return "texture";
    }

    // Geometry references - check both property name AND value patterns
    // Value patterns: "geometry.xxx", "geometry:xxx"
    if (
      propLower === "geometry" ||
      propLower.includes("geometry") ||
      line.includes('"geometry"') ||
      value.startsWith("geometry.") ||
      value.startsWith("geometry:")
    ) {
      return "geometry";
    }

    // Animation references - check both property name AND value patterns
    // Value patterns: "animation.xxx", "controller.animation.xxx"
    if (
      propLower === "animation" ||
      propLower === "animations" ||
      propLower.includes("animation") ||
      value.startsWith("animation.") ||
      value.startsWith("controller.animation")
    ) {
      // Check if it's an animation controller
      if (line.includes("controller.") || value.startsWith("controller.animation")) {
        return "animation_controller";
      }
      return "animation";
    }

    // Event references
    if (propLower === "event" || propLower.endsWith("_event") || propLower === "on_start" || propLower === "on_end") {
      return "event";
    }

    // Component group references
    if (propLower === "component_groups" || line.includes("component_groups")) {
      return "component_group";
    }

    // Entity references
    if (
      propLower === "entity_type" ||
      propLower === "spawn_entity" ||
      propLower === "identifier" ||
      propLower === "target"
    ) {
      return "entity_id";
    }

    // Loot table references - check both property name AND value patterns
    // Value patterns: "loot_tables/...", paths that start with loot_tables/
    if (propLower === "table" || propLower === "loot_table" || value.startsWith("loot_tables/")) {
      return "loot_table";
    }

    // Sound references
    if (propLower === "sound" || propLower.includes("sound")) {
      return "sound";
    }

    // Render controller - check both property name AND value patterns
    if (
      propLower === "render_controllers" ||
      line.includes("controller.render") ||
      value.startsWith("controller.render")
    ) {
      return "render_controller";
    }

    return "unknown";
  }

  /**
   * Find the definition location for a reference
   */
  private async findDefinition(
    document: vscode.TextDocument,
    value: string,
    type: ReferenceType
  ): Promise<vscode.Location | vscode.Location[] | undefined> {
    switch (type) {
      case "texture":
        return this.findTextureDefinition(document, value);

      case "geometry":
        return this.findGeometryDefinition(document, value);

      case "animation":
        return this.findAnimationDefinition(document, value);

      case "animation_controller":
        return this.findAnimationControllerDefinition(document, value);

      case "event":
        return this.findEventDefinition(document, value);

      case "component_group":
        return this.findComponentGroupDefinition(document, value);

      case "entity_id":
        return this.findEntityDefinition(document, value);

      case "loot_table":
        return this.findLootTableDefinition(document, value);

      default:
        return undefined;
    }
  }

  /**
   * Find texture file definition
   */
  private async findTextureDefinition(
    document: vscode.TextDocument,
    texturePath: string
  ): Promise<vscode.Location | undefined> {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
    if (!workspaceFolder) {
      return undefined;
    }

    // Normalize path
    let searchPath = texturePath.replace(/\\/g, "/");
    if (!searchPath.endsWith(".png") && !searchPath.endsWith(".tga")) {
      searchPath += ".png";
    }

    // Search for the file
    const files = await vscode.workspace.findFiles(`**/${searchPath}`, "**/node_modules/**");

    if (files.length > 0) {
      return new vscode.Location(files[0], new vscode.Position(0, 0));
    }

    // Try without extension variations
    const withoutExt = texturePath.replace(/\.(png|tga)$/, "");
    const altFiles = await vscode.workspace.findFiles(`**/${withoutExt}.*`, "**/node_modules/**");

    if (altFiles.length > 0) {
      return new vscode.Location(altFiles[0], new vscode.Position(0, 0));
    }

    return undefined;
  }

  /**
   * Find geometry definition in .geo.json files
   */
  private async findGeometryDefinition(
    document: vscode.TextDocument,
    geometryId: string
  ): Promise<vscode.Location | undefined> {
    // Search all .geo.json files in workspace
    const geoFiles = await vscode.workspace.findFiles("**/*.geo.json", "**/node_modules/**");

    for (const fileUri of geoFiles) {
      try {
        const doc = await vscode.workspace.openTextDocument(fileUri);
        const text = doc.getText();

        // Look for the geometry identifier
        const pattern = new RegExp(`"identifier"\\s*:\\s*"${this.escapeRegex(geometryId)}"`, "g");
        const match = pattern.exec(text);

        if (match) {
          const position = doc.positionAt(match.index);
          return new vscode.Location(fileUri, position);
        }
      } catch {
        // Skip files that can't be read
      }
    }

    return undefined;
  }

  /**
   * Find animation definition
   */
  private async findAnimationDefinition(
    document: vscode.TextDocument,
    animationId: string
  ): Promise<vscode.Location | undefined> {
    const animFiles = await vscode.workspace.findFiles("**/*.animation.json", "**/node_modules/**");

    for (const fileUri of animFiles) {
      try {
        const doc = await vscode.workspace.openTextDocument(fileUri);
        const text = doc.getText();

        // Look for the animation key
        const pattern = new RegExp(`"${this.escapeRegex(animationId)}"\\s*:`, "g");
        const match = pattern.exec(text);

        if (match) {
          const position = doc.positionAt(match.index);
          return new vscode.Location(fileUri, position);
        }
      } catch {
        // Skip
      }
    }

    return undefined;
  }

  /**
   * Find animation controller definition
   */
  private async findAnimationControllerDefinition(
    document: vscode.TextDocument,
    controllerId: string
  ): Promise<vscode.Location | undefined> {
    const controllerFiles = await vscode.workspace.findFiles("**/*.animation_controllers.json", "**/node_modules/**");

    for (const fileUri of controllerFiles) {
      try {
        const doc = await vscode.workspace.openTextDocument(fileUri);
        const text = doc.getText();

        const pattern = new RegExp(`"${this.escapeRegex(controllerId)}"\\s*:`, "g");
        const match = pattern.exec(text);

        if (match) {
          const position = doc.positionAt(match.index);
          return new vscode.Location(fileUri, position);
        }
      } catch {
        // Skip
      }
    }

    return undefined;
  }

  /**
   * Find event definition in the same file
   */
  private findEventDefinition(document: vscode.TextDocument, eventName: string): vscode.Location | undefined {
    const text = document.getText();

    // Look for event definition in the events section
    const pattern = new RegExp(`"events"[\\s\\S]*?"${this.escapeRegex(eventName)}"\\s*:`);
    const match = pattern.exec(text);

    if (match) {
      // Find the exact position of the event name
      const eventPattern = new RegExp(`"${this.escapeRegex(eventName)}"\\s*:`, "g");
      let eventMatch;
      while ((eventMatch = eventPattern.exec(text)) !== null) {
        // Check if this is within the events section (not a reference)
        const beforeText = text.substring(0, eventMatch.index);
        if (beforeText.includes('"events"') && beforeText.lastIndexOf('"events"') > beforeText.lastIndexOf('"event"')) {
          const position = document.positionAt(eventMatch.index);
          return new vscode.Location(document.uri, position);
        }
      }
    }

    return undefined;
  }

  /**
   * Find component group definition in the same file
   */
  private findComponentGroupDefinition(document: vscode.TextDocument, groupName: string): vscode.Location | undefined {
    const text = document.getText();

    // Look for component_groups section
    const pattern = new RegExp(`"component_groups"[\\s\\S]*?"${this.escapeRegex(groupName)}"\\s*:`);
    const match = pattern.exec(text);

    if (match) {
      const groupPattern = new RegExp(`"${this.escapeRegex(groupName)}"\\s*:\\s*\\{`, "g");
      let groupMatch;
      while ((groupMatch = groupPattern.exec(text)) !== null) {
        const beforeText = text.substring(0, groupMatch.index);
        if (beforeText.includes('"component_groups"')) {
          const position = document.positionAt(groupMatch.index);
          return new vscode.Location(document.uri, position);
        }
      }
    }

    return undefined;
  }

  /**
   * Find entity behavior file definition
   */
  private async findEntityDefinition(
    document: vscode.TextDocument,
    entityId: string
  ): Promise<vscode.Location | undefined> {
    // Normalize entity ID
    const normalizedId = entityId.startsWith("minecraft:") ? entityId : `minecraft:${entityId}`;

    // Search behavior pack entity files (both entity/ and entities/ folders)
    const entityFiles = await vscode.workspace.findFiles("**/{entity,entities}/*.json", "**/node_modules/**");

    for (const fileUri of entityFiles) {
      try {
        const doc = await vscode.workspace.openTextDocument(fileUri);
        const text = doc.getText();

        // Look for matching identifier
        const pattern = new RegExp(`"identifier"\\s*:\\s*"${this.escapeRegex(normalizedId)}"`);
        if (pattern.test(text)) {
          // Find the identifier line
          const match = pattern.exec(text);
          if (match) {
            const position = doc.positionAt(match.index);
            return new vscode.Location(fileUri, position);
          }
        }
      } catch {
        // Skip
      }
    }

    // Also try custom namespace
    const customId = entityId.includes(":") ? entityId : undefined;
    if (customId && customId !== normalizedId) {
      for (const fileUri of entityFiles) {
        try {
          const doc = await vscode.workspace.openTextDocument(fileUri);
          const text = doc.getText();

          const pattern = new RegExp(`"identifier"\\s*:\\s*"${this.escapeRegex(customId)}"`);
          if (pattern.test(text)) {
            const match = pattern.exec(text);
            if (match) {
              const position = doc.positionAt(match.index);
              return new vscode.Location(fileUri, position);
            }
          }
        } catch {
          // Skip
        }
      }
    }

    return undefined;
  }

  /**
   * Find loot table file definition
   */
  private async findLootTableDefinition(
    document: vscode.TextDocument,
    lootTablePath: string
  ): Promise<vscode.Location | undefined> {
    // Normalize path
    let searchPath = lootTablePath.replace(/\\/g, "/");
    if (!searchPath.endsWith(".json")) {
      searchPath += ".json";
    }

    const files = await vscode.workspace.findFiles(`**/${searchPath}`, "**/node_modules/**");

    if (files.length > 0) {
      return new vscode.Location(files[0], new vscode.Position(0, 0));
    }

    // Try partial path match
    const fileName = searchPath.split("/").pop();
    if (fileName) {
      const altFiles = await vscode.workspace.findFiles(`**/loot_tables/**/${fileName}`, "**/node_modules/**");

      if (altFiles.length > 0) {
        return new vscode.Location(altFiles[0], new vscode.Position(0, 0));
      }
    }

    return undefined;
  }

  /**
   * Get or create project for workspace
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
   * Clear the project cache
   */
  public clearCache(): void {
    this.projectCache.clear();
  }
}
