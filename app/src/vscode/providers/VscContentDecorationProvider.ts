// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * VscContentDecorationProvider - VS Code Inline Widgets via Decorations
 *
 * ARCHITECTURE
 * ============
 * VS Code doesn't have content widgets like Monaco web, but it has powerful
 * decoration capabilities that can achieve similar effects:
 *
 * 1. Color Swatches - Use `color` property in DecorationRenderOptions
 * 2. Texture Thumbnails - Use `gutterIconPath` for images in the gutter
 * 3. Action Buttons - Use CodeLens for clickable actions
 *
 * This provider focuses on color swatches and gutter icons, while
 * action buttons are handled by McCodeLensProvider.
 *
 * TEXTURE RESOLUTION:
 * - Uses ProjectItemRelations to find textures via parent/child/cousin relationships
 * - Pattern: Entity/Item/Block definition -> parent items -> texture children
 * - Uses ProjectItemUtilities.getCousinOfType() for cross-reference lookups
 * - Falls back to simple path-based resolution if no project context
 *
 * RELATIONSHIP TO MONACO VERSION:
 * - Monaco uses ContentWidget API for arbitrary HTML
 * - VS Code uses decoration types with limited styling options
 * - Color swatches work well; texture thumbnails use gutter icons
 */

import * as vscode from "vscode";
import * as path from "path";
import Log from "../../core/Log";
import Project from "../../app/Project";
import ProjectItem from "../../app/ProjectItem";
import { ProjectItemType } from "../../app/IProjectItemData";
import ProjectItemUtilities from "../../app/ProjectItemUtilities";
import StorageUtilities from "../../storage/StorageUtilities";

/**
 * Color decoration with position information
 */
interface IColorDecoration {
  range: vscode.Range;
  color: string;
}

/**
 * Texture decoration with position information
 */
interface ITextureDecoration {
  range: vscode.Range;
  texturePath: string;
  absolutePath?: string;
}

/**
 * Provides color swatches and texture thumbnails for VS Code
 */
export default class VscContentDecorationProvider implements vscode.Disposable {
  private readonly _disposables: vscode.Disposable[] = [];
  private _debounceTimer: NodeJS.Timeout | undefined;
  private readonly DEBOUNCE_MS = 400;

  // Color decoration types (created dynamically based on colors found)
  private _colorDecorationTypes: Map<string, vscode.TextEditorDecorationType> = new Map();

  // Texture gutter decoration type
  private _textureDecorationType: vscode.TextEditorDecorationType;

  // Project context for texture resolution via ProjectItemRelations
  private _project?: Project;
  private _projectItem?: ProjectItem;
  private _textureCache: Map<string, string | undefined> = new Map();

  constructor() {
    // Create texture gutter decoration type
    this._textureDecorationType = vscode.window.createTextEditorDecorationType({
      gutterIconSize: "contain",
    });

    // Listen for editor changes
    this._disposables.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor) {
          this.scheduleUpdate(editor);
        }
      })
    );

    // Listen for text document changes
    this._disposables.push(
      vscode.workspace.onDidChangeTextDocument((event) => {
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document === event.document) {
          this.scheduleUpdate(editor);
        }
      })
    );

    // Initial update for active editor
    if (vscode.window.activeTextEditor) {
      this.scheduleUpdate(vscode.window.activeTextEditor);
    }
  }

  /**
   * Set project context for resolving textures via ProjectItemRelations.
   * This enables texture path resolution through parent/child/cousin relationships.
   */
  public setProjectContext(project: Project, projectItem: ProjectItem): void {
    this._project = project;
    this._projectItem = projectItem;
    // Clear texture cache when context changes
    this._textureCache.clear();
    Log.verbose(`[VscContentDecorationProvider] Set project context for item: ${projectItem.projectPath}`);

    // Trigger update for active editor
    if (vscode.window.activeTextEditor) {
      this.scheduleUpdate(vscode.window.activeTextEditor);
    }
  }

  /**
   * Clear project context
   */
  public clearProjectContext(): void {
    this._project = undefined;
    this._projectItem = undefined;
    this._textureCache.clear();
  }

  /**
   * Schedule a debounced update
   */
  private scheduleUpdate(editor: vscode.TextEditor): void {
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
    }

    this._debounceTimer = setTimeout(() => {
      this.updateDecorations(editor).catch((err) => {
        Log.verbose(`VscContentDecorationProvider update failed: ${err}`);
      });
    }, this.DEBOUNCE_MS);
  }

  /**
   * Update decorations for the given editor
   */
  private async updateDecorations(editor: vscode.TextEditor): Promise<void> {
    const document = editor.document;

    // Only process JSON files
    if (document.languageId !== "json" && !document.fileName.endsWith(".json")) {
      return;
    }

    const content = document.getText();
    if (!content.trim()) {
      this.clearDecorations(editor);
      return;
    }

    // Parse JSON
    let json: unknown;
    try {
      json = JSON.parse(content);
    } catch {
      this.clearDecorations(editor);
      return;
    }

    // Find color and texture values
    const colors = this.findColors(document, content, json, []);
    const textures = await this.findTextures(document, content, json, []);

    // Apply color decorations
    this.applyColorDecorations(editor, colors);

    // Apply texture decorations (gutter icons)
    this.applyTextureDecorations(editor, textures);
  }

  /**
   * Find color values in the JSON
   */
  private findColors(document: vscode.TextDocument, content: string, obj: unknown, path: string[]): IColorDecoration[] {
    const results: IColorDecoration[] = [];

    if (typeof obj !== "object" || obj === null) {
      return results;
    }

    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        results.push(...this.findColors(document, content, obj[i], [...path, String(i)]));
      }
      return results;
    }

    const record = obj as Record<string, unknown>;

    for (const [key, value] of Object.entries(record)) {
      const keyPath = [...path, key];

      if (typeof value === "string" && this.isColorValue(key, value)) {
        const range = this.findValueRange(document, content, key, value);
        if (range) {
          results.push({ range, color: this.normalizeColor(value) });
        }
      }

      if (typeof value === "object" && value !== null) {
        results.push(...this.findColors(document, content, value, keyPath));
      }
    }

    return results;
  }

  /**
   * Find texture paths in the JSON
   */
  private async findTextures(
    document: vscode.TextDocument,
    content: string,
    obj: unknown,
    pathArr: string[]
  ): Promise<ITextureDecoration[]> {
    const results: ITextureDecoration[] = [];

    if (typeof obj !== "object" || obj === null) {
      return results;
    }

    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        const childResults = await this.findTextures(document, content, obj[i], [...pathArr, String(i)]);
        results.push(...childResults);
      }
      return results;
    }

    const record = obj as Record<string, unknown>;

    for (const [key, value] of Object.entries(record)) {
      const keyPath = [...pathArr, key];

      if (typeof value === "string" && this.isTexturePath(key, value)) {
        const range = this.findValueRange(document, content, key, value);
        if (range) {
          const absolutePath = await this.resolveTexturePath(document, value);
          results.push({ range, texturePath: value, absolutePath });
        }
      }

      if (typeof value === "object" && value !== null) {
        const childResults = await this.findTextures(document, content, value, keyPath);
        results.push(...childResults);
      }
    }

    return results;
  }

  /**
   * Check if a value looks like a color
   */
  private isColorValue(key: string, value: string): boolean {
    const colorKeywords = ["color", "tint", "rgb", "hex", "colour"];
    const keyLower = key.toLowerCase();
    const isColorKey = colorKeywords.some((kw) => keyLower.includes(kw));

    const hexPattern = /^(#|0x)?[0-9A-Fa-f]{6,8}$/;
    const isHexColor = hexPattern.test(value);

    return isColorKey || isHexColor;
  }

  /**
   * Check if a value looks like a texture path
   */
  private isTexturePath(key: string, value: string): boolean {
    const textureKeywords = ["texture", "icon", "image", "sprite", "atlas"];
    const keyLower = key.toLowerCase();
    const isTextureKey = textureKeywords.some((kw) => keyLower.includes(kw));

    const isPath = value.startsWith("textures/") || value.includes("/textures/");

    return isTextureKey || isPath;
  }

  /**
   * Normalize a color value to #RRGGBB format
   */
  private normalizeColor(value: string): string {
    let color = value;
    if (color.startsWith("0x") || color.startsWith("0X")) {
      color = "#" + color.substring(2);
    }
    if (!color.startsWith("#")) {
      color = "#" + color;
    }
    return color.toUpperCase();
  }

  /**
   * Resolve a texture path to an absolute file path using ProjectItemRelations.
   *
   * RESOLUTION STRATEGY (in priority order):
   * 1. Check cache for previously resolved textures
   * 2. Look in direct childItems of the current projectItem for texture types
   * 3. Use getCousinOfType() to find textures via parent relationships
   * 4. Search project items for matching texture paths
   * 5. Fall back to simple path-based resolution
   */
  private async resolveTexturePath(document: vscode.TextDocument, texturePath: string): Promise<string | undefined> {
    // Check cache first
    if (this._textureCache.has(texturePath)) {
      return this._textureCache.get(texturePath);
    }

    // Try ProjectItemRelations if we have project context
    if (this._project && this._projectItem) {
      const absolutePath = await this.resolveViaProjectRelations(texturePath);
      if (absolutePath) {
        this._textureCache.set(texturePath, absolutePath);
        return absolutePath;
      }
    }

    // Fall back to simple path-based resolution
    const docDir = path.dirname(document.fileName);
    const possiblePaths = [
      path.join(docDir, "..", texturePath + ".png"),
      path.join(docDir, "..", "..", texturePath + ".png"),
      path.join(docDir, "..", "..", "..", texturePath + ".png"),
      path.join(docDir, "..", texturePath + ".tga"),
      path.join(docDir, "..", "..", texturePath + ".tga"),
    ];

    // Return first possibility - caller should verify existence
    this._textureCache.set(texturePath, possiblePaths[0]);
    return possiblePaths[0];
  }

  /**
   * Resolve texture path using ProjectItemRelations (async)
   */
  private async resolveViaProjectRelations(texturePath: string): Promise<string | undefined> {
    if (!this._project || !this._projectItem) {
      return undefined;
    }

    let textureItem: ProjectItem | undefined;

    // Strategy 1: Check direct child items for textures
    if (this._projectItem.childItems && this._projectItem.childItems.length > 0) {
      for (const rel of this._projectItem.childItems) {
        if (rel.childItem.itemType === ProjectItemType.texture) {
          if (this.texturePathMatches(rel.childItem, texturePath)) {
            textureItem = rel.childItem;
            Log.verbose(`[VscContentDecorationProvider] Found texture via childItems: ${textureItem.projectPath}`);
            break;
          }
        }
      }
    }

    // Strategy 2: Check parent items' children (cousins)
    if (!textureItem && this._projectItem.parentItems && this._projectItem.parentItems.length > 0) {
      for (const parentRel of this._projectItem.parentItems) {
        if (parentRel.parentItem.childItems) {
          for (const childRel of parentRel.parentItem.childItems) {
            if (childRel.childItem.itemType === ProjectItemType.texture) {
              if (this.texturePathMatches(childRel.childItem, texturePath)) {
                textureItem = childRel.childItem;
                Log.verbose(
                  `[VscContentDecorationProvider] Found texture via parent's children: ${textureItem.projectPath}`
                );
                break;
              }
            }
          }
        }
        if (textureItem) break;
      }
    }

    // Strategy 3: Use cousin lookup utility
    if (!textureItem) {
      textureItem = ProjectItemUtilities.getCousinOfType(this._projectItem, ProjectItemType.texture);
      if (textureItem) {
        Log.verbose(`[VscContentDecorationProvider] Found texture via getCousinOfType: ${textureItem.projectPath}`);
      }
    }

    // Strategy 4: Search all project textures for path match
    if (!textureItem) {
      const textureItems = this._project.getItemsByType(ProjectItemType.texture);
      for (const item of textureItems) {
        if (this.texturePathMatches(item, texturePath)) {
          textureItem = item;
          Log.verbose(`[VscContentDecorationProvider] Found texture via project search: ${textureItem.projectPath}`);
          break;
        }
      }
    }

    // Get absolute path from the texture item
    if (textureItem && textureItem.primaryFile) {
      return textureItem.primaryFile.fullPath;
    }

    return undefined;
  }

  /**
   * Check if a ProjectItem's path matches the requested texture path
   */
  private texturePathMatches(item: ProjectItem, texturePath: string): boolean {
    if (!item.projectPath) return false;

    const itemPath = item.projectPath.toLowerCase();
    const requestedPath = texturePath.toLowerCase();

    // Direct path match
    if (itemPath.includes(requestedPath)) return true;

    // Check filename match
    const itemBaseName = StorageUtilities.getBaseFromName(item.projectPath);
    const requestedBaseName = requestedPath.split("/").pop() || "";

    if (itemBaseName.toLowerCase() === requestedBaseName) return true;

    // Check if request is a short texture name like "item.diamond"
    const shortName = requestedPath.replace(/\./g, "/");
    if (itemPath.includes(shortName)) return true;

    return false;
  }

  /**
   * Find the range of a value in the document
   */
  private findValueRange(
    document: vscode.TextDocument,
    content: string,
    key: string,
    value: string
  ): vscode.Range | null {
    // Simple search for the key-value pair pattern
    // This is a simplified approach - a real implementation would use proper JSON parsing
    const pattern = new RegExp(`"${this.escapeRegex(key)}"\\s*:\\s*"${this.escapeRegex(value)}"`, "g");
    const match = pattern.exec(content);

    if (!match) {
      return null;
    }

    const startOffset = match.index + match[0].length - value.length - 1;
    const endOffset = match.index + match[0].length - 1;

    const startPos = document.positionAt(startOffset);
    const endPos = document.positionAt(endOffset);

    return new vscode.Range(startPos, endPos);
  }

  /**
   * Escape special regex characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /**
   * Apply color decorations
   */
  private applyColorDecorations(editor: vscode.TextEditor, colors: IColorDecoration[]): void {
    // Group by color
    const colorGroups = new Map<string, vscode.Range[]>();

    for (const colorDec of colors) {
      const ranges = colorGroups.get(colorDec.color) || [];
      ranges.push(colorDec.range);
      colorGroups.set(colorDec.color, ranges);
    }

    // Clear old decorations
    for (const decType of this._colorDecorationTypes.values()) {
      editor.setDecorations(decType, []);
    }

    // Apply new decorations
    for (const [color, ranges] of colorGroups.entries()) {
      let decType = this._colorDecorationTypes.get(color);

      if (!decType) {
        // Create new decoration type for this color
        decType = vscode.window.createTextEditorDecorationType({
          after: {
            contentText: " ■",
            color: color,
            margin: "0 0 0 4px",
          },
        });
        this._colorDecorationTypes.set(color, decType);
      }

      editor.setDecorations(decType, ranges);
    }
  }

  /**
   * Apply texture decorations (gutter icons)
   */
  private applyTextureDecorations(editor: vscode.TextEditor, textures: ITextureDecoration[]): void {
    // For textures without resolved paths, we show a placeholder icon
    // Real implementation would show actual texture thumbnails

    const decorationsWithIcons: vscode.DecorationOptions[] = textures
      .filter((t) => t.absolutePath)
      .map((t) => ({
        range: t.range,
        hoverMessage: new vscode.MarkdownString(`![texture](${vscode.Uri.file(t.absolutePath!).toString()})`),
      }));

    editor.setDecorations(this._textureDecorationType, decorationsWithIcons);
  }

  /**
   * Clear all decorations
   */
  private clearDecorations(editor: vscode.TextEditor): void {
    for (const decType of this._colorDecorationTypes.values()) {
      editor.setDecorations(decType, []);
    }
    editor.setDecorations(this._textureDecorationType, []);
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
    }

    for (const decType of this._colorDecorationTypes.values()) {
      decType.dispose();
    }
    this._colorDecorationTypes.clear();

    this._textureDecorationType.dispose();

    for (const disposable of this._disposables) {
      disposable.dispose();
    }
  }
}
