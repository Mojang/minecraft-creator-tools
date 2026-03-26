/**
 * ContentWidgetProvider.ts
 *
 * ARCHITECTURE DOCUMENTATION
 * ==========================
 *
 * This provider creates Monaco content widgets for rich inline UI elements
 * that can contain HTML, images, and interactive elements - beyond what
 * simple text decorations can offer.
 *
 * WIDGET TYPES:
 * 1. Texture Thumbnails - Show small image previews for texture paths
 * 2. Color Swatches - Display actual color boxes for hex color values
 * 3. Quick Action Buttons - Small icons for navigation/actions
 *
 * KEY CONCEPTS:
 * - Content widgets are positioned at specific line/column positions
 * - They float above the editor content and can contain arbitrary HTML
 * - Widgets are identified by unique IDs and can be added/removed dynamically
 *
 * TEXTURE RESOLUTION:
 * - Uses ProjectItemRelations to find textures via parent/child/cousin relationships
 * - Pattern: Entity/Item/Block definition -> parent items -> texture children
 * - Uses ProjectItemUtilities.getCousinOfType() for cross-reference lookups
 * - Textures are resolved to data URLs using ImageCodec.toDataUrl()
 *
 * LIMITATIONS:
 * - Widgets don't scroll perfectly with horizontal scrolling
 * - Too many widgets can impact performance
 * - Widget positioning is based on character position, not pixel position
 *
 * RELATED FILES:
 * - ComponentSummaryProvider.ts - Text-only inline decorations
 * - ValueDecoratorProvider.ts - Visual value decorations
 * - VscContentWidgetProvider.ts - VS Code equivalent implementation
 * - ProjectItemRelations.ts - Calculates parent/child relationships
 * - ProjectItemUtilities.ts - getCousinOfType() for texture lookups
 */

import * as monaco from "monaco-editor";
import Log from "../../core/Log";
import { JsonPathResolver } from "./JsonPathResolver";
import Project from "../../app/Project";
import ProjectItem from "../../app/ProjectItem";
import { ProjectItemType } from "../../app/IProjectItemData";
import ProjectItemUtilities from "../../app/ProjectItemUtilities";
import ImageCodec from "../../core/ImageCodec";
import StorageUtilities from "../../storage/StorageUtilities";
import Utilities from "../../core/Utilities";

/**
 * Widget configuration for a single content widget
 */
export interface IWidgetConfig {
  id: string;
  lineNumber: number;
  column: number;
  type: "color" | "texture" | "action";
  data: IColorWidgetData | ITextureWidgetData | IActionWidgetData;
}

export interface IColorWidgetData {
  color: string; // Hex color like "#FF0000" or "0xFF0000"
}

export interface ITextureWidgetData {
  texturePath: string; // e.g., "textures/items/diamond_sword"
  resolvedUrl?: string; // Full URL to the texture image
  projectPath?: string; // Project path to the texture item for navigation
}

export interface IActionWidgetData {
  icon: string; // Icon name or emoji
  tooltip: string;
  action: "navigate" | "docs" | "edit";
  target?: string; // Target path/URL for the action
}

/**
 * Monaco content widget implementation
 */
class McContentWidget implements monaco.editor.IContentWidget {
  private domNode: HTMLElement | null = null;
  private previewElement: HTMLElement | null = null;
  private readonly id: string;
  private readonly config: IWidgetConfig;
  private readonly onAction?: (action: string, target?: string) => void;
  private textureData?: ITextureWidgetData;

  constructor(config: IWidgetConfig, onAction?: (action: string, target?: string) => void) {
    this.id = `mct-widget-${config.id}`;
    this.config = config;
    this.onAction = onAction;
    // Store texture data for click handling
    if (config.type === "texture") {
      this.textureData = config.data as ITextureWidgetData;
    }
  }

  getId(): string {
    return this.id;
  }

  getDomNode(): HTMLElement {
    if (!this.domNode) {
      this.domNode = this.createDomNode();
    }
    return this.domNode;
  }

  getPosition(): monaco.editor.IContentWidgetPosition {
    return {
      position: {
        lineNumber: this.config.lineNumber,
        column: this.config.column,
      },
      preference: [
        monaco.editor.ContentWidgetPositionPreference.EXACT,
        monaco.editor.ContentWidgetPositionPreference.ABOVE,
      ],
    };
  }

  private createDomNode(): HTMLElement {
    const container = document.createElement("div");
    container.className = "mct-content-widget";

    switch (this.config.type) {
      case "color":
        this.createColorWidget(container, this.config.data as IColorWidgetData);
        break;
      case "texture":
        this.createTextureWidget(container, this.config.data as ITextureWidgetData);
        break;
      case "action":
        this.createActionWidget(container, this.config.data as IActionWidgetData);
        break;
    }

    return container;
  }

  private createColorWidget(container: HTMLElement, data: IColorWidgetData): void {
    const swatch = document.createElement("div");
    swatch.className = "mct-color-swatch";

    // Normalize color format (handle 0xRRGGBB and #RRGGBB)
    let color = data.color;
    if (color.startsWith("0x") || color.startsWith("0X")) {
      color = "#" + color.substring(2);
    }
    if (!color.startsWith("#")) {
      color = "#" + color;
    }

    swatch.style.backgroundColor = color;
    swatch.title = "Click to copy color: " + color.toUpperCase();

    // Make clickable - copy color to clipboard
    swatch.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      navigator.clipboard.writeText(color).catch((err) => {
        Log.debug("Failed to copy color to clipboard: " + err);
      });
      if (this.onAction) {
        this.onAction("copyColor", color);
      }
    };

    container.appendChild(swatch);
  }

  private createTextureWidget(container: HTMLElement, data: ITextureWidgetData): void {
    const wrapper = document.createElement("div");
    wrapper.className = "mct-texture-thumbnail";

    if (data.resolvedUrl) {
      const img = document.createElement("img");
      img.src = data.resolvedUrl;
      img.alt = data.texturePath;
      img.title = data.projectPath ? "Click to open: " + data.texturePath : data.texturePath;
      img.onerror = () => {
        // Replace with placeholder on error
        wrapper.innerHTML = "🖼️";
        wrapper.title = `${data.texturePath} (not found)`;
      };
      wrapper.appendChild(img);

      // Create hover preview element - append to body to avoid transform issues
      const preview = document.createElement("div");
      preview.className = "mct-texture-preview";
      const previewImg = document.createElement("img");
      previewImg.src = data.resolvedUrl;
      previewImg.alt = data.texturePath;
      preview.appendChild(previewImg);

      // Add path label to preview
      const label = document.createElement("div");
      label.className = "mct-texture-preview-label";
      label.textContent = data.texturePath;
      preview.appendChild(label);

      // Append preview to body to avoid CSS transform issues with fixed positioning
      document.body.appendChild(preview);

      // Store reference for cleanup
      this.previewElement = preview;

      // Show and position preview on hover
      wrapper.addEventListener("mouseenter", () => {
        const rect = wrapper.getBoundingClientRect();
        const previewHeight = 280; // 256px image + padding + label
        const previewWidth = 272; // 256px image + padding
        const spaceAbove = rect.top;
        const spaceBelow = window.innerHeight - rect.bottom;

        // Calculate horizontal position (centered on thumbnail, clamped to viewport)
        let left = rect.left + rect.width / 2 - previewWidth / 2;
        left = Math.max(8, Math.min(left, window.innerWidth - previewWidth - 8));

        // Calculate vertical position
        let top: number;
        if (spaceAbove >= previewHeight || spaceAbove > spaceBelow) {
          // Show above
          top = rect.top - previewHeight - 8;
        } else {
          // Show below
          top = rect.bottom + 8;
        }

        // Clamp to viewport
        top = Math.max(8, Math.min(top, window.innerHeight - previewHeight - 8));

        // Apply positioning and show
        preview.style.left = `${left}px`;
        preview.style.top = `${top}px`;
        preview.style.display = "block";
      });

      // Hide preview on mouse leave
      wrapper.addEventListener("mouseleave", () => {
        preview.style.display = "none";
      });
    } else {
      // Show placeholder
      wrapper.innerHTML = "🖼️";
      wrapper.title = data.texturePath;
    }

    // Make clickable to navigate to texture item
    if (data.projectPath) {
      wrapper.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (this.onAction) {
          this.onAction("openItem", data.projectPath);
        }
      };
    }

    container.appendChild(wrapper);
  }

  private createActionWidget(container: HTMLElement, data: IActionWidgetData): void {
    const button = document.createElement("button");
    button.className = "mct-action-button";
    button.innerHTML = data.icon;
    button.title = data.tooltip;
    button.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (this.onAction) {
        this.onAction(data.action, data.target);
      }
    };
    container.appendChild(button);
  }

  dispose(): void {
    // Clean up preview element from body
    if (this.previewElement && this.previewElement.parentNode) {
      this.previewElement.parentNode.removeChild(this.previewElement);
    }
    this.previewElement = null;

    if (this.domNode && this.domNode.parentNode) {
      this.domNode.parentNode.removeChild(this.domNode);
    }
    this.domNode = null;
  }
}

/**
 * Provides content widgets for the Monaco editor
 */
export class ContentWidgetProvider {
  private pathResolver: JsonPathResolver;
  private widgets: Map<string, McContentWidget> = new Map();
  private editor?: monaco.editor.IStandaloneCodeEditor;
  private debounceTimer?: ReturnType<typeof setTimeout>;
  private readonly DEBOUNCE_MS = 400;
  private onActionCallback?: (action: string, target?: string) => void;

  // Project context for texture resolution
  private project?: Project;
  private projectItem?: ProjectItem;
  private textureCache: Map<string, string | undefined> = new Map();

  constructor(pathResolver?: JsonPathResolver) {
    this.pathResolver = pathResolver || new JsonPathResolver();
  }

  /**
   * Set project context for resolving textures via ProjectItemRelations
   * This enables texture path resolution through parent/child/cousin relationships
   */
  public setProjectContext(project: Project, projectItem: ProjectItem): void {
    this.project = project;
    this.projectItem = projectItem;
    // Clear texture cache when context changes
    this.textureCache.clear();
    Log.verbose(`[ContentWidgetProvider] Set project context for item: ${projectItem.projectPath}`);
  }

  /**
   * Clear project context
   */
  public clearProjectContext(): void {
    this.project = undefined;
    this.projectItem = undefined;
    this.textureCache.clear();
  }
  /**
   * Set callback for widget actions
   */
  public setActionCallback(callback: (action: string, target?: string) => void): void {
    this.onActionCallback = callback;
  }

  /**
   * Update widgets for the given editor
   */
  public async update(editor: monaco.editor.IStandaloneCodeEditor): Promise<void> {
    this.editor = editor;
    const model = editor.getModel();
    if (!model) {
      this.clearWidgets();
      return;
    }

    // Check if model is disposed before using it
    if (model.isDisposed()) {
      this.clearWidgets();
      return;
    }

    const content = model.getValue();
    if (!content.trim()) {
      this.clearWidgets();
      return;
    }

    // Parse JSON
    let json: unknown;
    try {
      json = JSON.parse(Utilities.fixJsonContent(content));
    } catch {
      this.clearWidgets();
      return;
    }

    Log.verbose("[ContentWidgetProvider] Finding widget positions...");

    // Find all widget positions
    const widgetConfigs = await this.findWidgetPositions(model, content, json);

    Log.verbose(`[ContentWidgetProvider] Found ${widgetConfigs.length} widgets`);

    // Update widgets
    this.applyWidgets(editor, widgetConfigs);
  }

  /**
   * Schedule a debounced update
   */
  public scheduleUpdate(editor: monaco.editor.IStandaloneCodeEditor): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.update(editor).catch((err) => {
        Log.debug("ContentWidgetProvider update failed: " + err);
      });
    }, this.DEBOUNCE_MS);
  }

  /**
   * Clear all widgets
   */
  public clearWidgets(): void {
    if (this.editor) {
      for (const widget of this.widgets.values()) {
        this.editor.removeContentWidget(widget);
        widget.dispose();
      }
    }
    this.widgets.clear();
  }

  /**
   * Find positions for content widgets
   */
  private async findWidgetPositions(
    model: monaco.editor.ITextModel,
    content: string,
    json: unknown
  ): Promise<IWidgetConfig[]> {
    const configs: IWidgetConfig[] = [];

    // Search for color values and texture paths
    await this.searchForWidgetTargets(model, content, json, [], configs);

    return configs;
  }

  /**
   * Recursively search for widget targets
   */
  private async searchForWidgetTargets(
    model: monaco.editor.ITextModel,
    content: string,
    obj: unknown,
    path: string[],
    configs: IWidgetConfig[]
  ): Promise<void> {
    if (typeof obj !== "object" || obj === null) {
      return;
    }

    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        await this.searchForWidgetTargets(model, content, obj[i], [...path, String(i)], configs);
      }
      return;
    }

    const record = obj as Record<string, unknown>;

    for (const [key, value] of Object.entries(record)) {
      const keyPath = [...path, key];

      // Check for color values
      if (typeof value === "string" && this.isColorValue(key, value)) {
        const position = this.findValuePosition(model, content, keyPath, value);
        if (position) {
          configs.push({
            id: keyPath.join("."),
            lineNumber: position.lineNumber,
            column: position.column,
            type: "color",
            data: { color: value },
          });
        }
      }

      // Check for texture paths
      if (typeof value === "string" && this.isTexturePath(key, value)) {
        const position = this.findValuePosition(model, content, keyPath, value);
        if (position) {
          const textureInfo = await this.resolveTextureInfo(value);
          configs.push({
            id: keyPath.join("."),
            lineNumber: position.lineNumber,
            column: position.column,
            type: "texture",
            data: {
              texturePath: value,
              resolvedUrl: textureInfo?.url,
              projectPath: textureInfo?.projectPath,
            },
          });
        }
      }

      // Recurse into nested objects
      if (typeof value === "object" && value !== null) {
        await this.searchForWidgetTargets(model, content, value, keyPath, configs);
      }
    }
  }

  /**
   * Check if a value looks like a color
   */
  private isColorValue(key: string, value: string): boolean {
    const colorKeywords = ["color", "tint", "rgb", "hex", "colour"];
    const keyLower = key.toLowerCase();

    // Check if key suggests a color
    const isColorKey = colorKeywords.some((kw) => keyLower.includes(kw));

    // Check if value looks like a hex color
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

    // Check if key suggests a texture
    const isTextureKey = textureKeywords.some((kw) => keyLower.includes(kw));

    // Check if value looks like a texture path
    const isPath = value.startsWith("textures/") || value.includes("/textures/");

    return isTextureKey || isPath;
  }

  /**
   * Resolve a texture path to a data URL using ProjectItemRelations.
   *
   * RESOLUTION STRATEGY (in priority order):
   * 1. Check cache for previously resolved textures
   * 2. Look in direct childItems of the current projectItem for texture types
   * 3. Use getCousinOfType() to find textures via parent relationships
   * 4. Search project items for matching texture paths
   *
   * Uses the pattern from EntityTypeResourceDefinition.addChildItems() where
   * textures are linked as child items via canonicalized paths.
   */
  private async resolveTextureUrl(texturePath: string): Promise<string | undefined> {
    // Check cache first
    if (this.textureCache.has(texturePath)) {
      return this.textureCache.get(texturePath);
    }

    if (!this.project || !this.projectItem) {
      Log.verbose(`[ContentWidgetProvider] No project context, cannot resolve texture: ${texturePath}`);
      return undefined;
    }

    let textureItem: ProjectItem | undefined;

    // Strategy 1: Check direct child items for textures
    if (this.projectItem.childItems && this.projectItem.childItems.length > 0) {
      for (const rel of this.projectItem.childItems) {
        if (rel.childItem.itemType === ProjectItemType.texture) {
          // Check if this texture's path matches the requested texture path
          if (this.texturePathMatches(rel.childItem, texturePath)) {
            textureItem = rel.childItem;
            Log.verbose(`[ContentWidgetProvider] Found texture via childItems: ${textureItem.projectPath}`);
            break;
          }
        }
      }
    }

    // Strategy 2: Check parent items' children (cousins)
    if (!textureItem && this.projectItem.parentItems && this.projectItem.parentItems.length > 0) {
      for (const parentRel of this.projectItem.parentItems) {
        if (parentRel.parentItem.childItems) {
          for (const childRel of parentRel.parentItem.childItems) {
            if (childRel.childItem.itemType === ProjectItemType.texture) {
              if (this.texturePathMatches(childRel.childItem, texturePath)) {
                textureItem = childRel.childItem;
                Log.verbose(`[ContentWidgetProvider] Found texture via parent's children: ${textureItem.projectPath}`);
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
      textureItem = ProjectItemUtilities.getCousinOfType(this.projectItem, ProjectItemType.texture);
      if (textureItem) {
        Log.verbose(`[ContentWidgetProvider] Found texture via getCousinOfType: ${textureItem.projectPath}`);
      }
    }

    // Strategy 4: Search all project textures for path match
    if (!textureItem) {
      const textureItems = this.project.getItemsByType(ProjectItemType.texture);
      for (const item of textureItems) {
        if (this.texturePathMatches(item, texturePath)) {
          textureItem = item;
          Log.verbose(`[ContentWidgetProvider] Found texture via project search: ${textureItem.projectPath}`);
          break;
        }
      }
    }

    // Convert texture to data URL
    if (textureItem) {
      const dataUrl = await this.loadTextureAsDataUrl(textureItem);
      this.textureCache.set(texturePath, dataUrl);
      return dataUrl;
    }

    Log.verbose(`[ContentWidgetProvider] Could not resolve texture: ${texturePath}`);
    this.textureCache.set(texturePath, undefined);
    return undefined;
  }

  /**
   * Resolve a texture path to both URL and project path for navigation.
   * Similar to resolveTextureUrl but returns projectPath for opening items.
   */
  private async resolveTextureInfo(texturePath: string): Promise<{ url?: string; projectPath?: string } | undefined> {
    if (!this.project || !this.projectItem) {
      return undefined;
    }

    let textureItem: ProjectItem | undefined;

    // Strategy 1: Check direct child items for textures
    if (this.projectItem.childItems && this.projectItem.childItems.length > 0) {
      for (const rel of this.projectItem.childItems) {
        if (rel.childItem.itemType === ProjectItemType.texture) {
          if (this.texturePathMatches(rel.childItem, texturePath)) {
            textureItem = rel.childItem;
            break;
          }
        }
      }
    }

    // Strategy 2: Check parent items' children (cousins)
    if (!textureItem && this.projectItem.parentItems && this.projectItem.parentItems.length > 0) {
      for (const parentRel of this.projectItem.parentItems) {
        if (parentRel.parentItem.childItems) {
          for (const childRel of parentRel.parentItem.childItems) {
            if (childRel.childItem.itemType === ProjectItemType.texture) {
              if (this.texturePathMatches(childRel.childItem, texturePath)) {
                textureItem = childRel.childItem;
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
      textureItem = ProjectItemUtilities.getCousinOfType(this.projectItem, ProjectItemType.texture);
    }

    // Strategy 4: Search all project textures for path match
    if (!textureItem) {
      const textureItems = this.project.getItemsByType(ProjectItemType.texture);
      for (const item of textureItems) {
        if (this.texturePathMatches(item, texturePath)) {
          textureItem = item;
          break;
        }
      }
    }

    if (textureItem) {
      // Get cached URL if available, otherwise load it
      let url = this.textureCache.get(texturePath);
      if (url === undefined && !this.textureCache.has(texturePath)) {
        url = await this.loadTextureAsDataUrl(textureItem);
        this.textureCache.set(texturePath, url);
      }
      return {
        url,
        projectPath: textureItem.projectPath || undefined,
      };
    }

    return undefined;
  }

  /**
   * Check if a ProjectItem's path matches the requested texture path
   */
  private texturePathMatches(item: ProjectItem, texturePath: string): boolean {
    if (!item.projectPath) return false;

    // Normalize paths for comparison
    const itemPath = item.projectPath.toLowerCase();
    const requestedPath = texturePath.toLowerCase();

    // Direct path match
    if (itemPath.includes(requestedPath)) return true;

    // Check filename match (e.g., "textures/items/diamond" matches "textures/items/diamond.png")
    const itemBaseName = StorageUtilities.getBaseFromName(item.projectPath);
    const requestedBaseName = requestedPath.split("/").pop() || "";

    if (itemBaseName.toLowerCase() === requestedBaseName) return true;

    // Check if request is a short texture name like "item.diamond"
    const shortName = requestedPath.replace(/\./g, "/");
    if (itemPath.includes(shortName)) return true;

    return false;
  }

  /**
   * Load texture content and convert to data URL
   */
  private async loadTextureAsDataUrl(textureItem: ProjectItem): Promise<string | undefined> {
    try {
      // Ensure file content is loaded
      if (!textureItem.isContentLoaded) {
        await textureItem.loadContent();
      }

      const textureFile = textureItem.primaryFile;
      if (!textureFile) {
        Log.verbose(`[ContentWidgetProvider] Texture has no primaryFile: ${textureItem.projectPath}`);
        return undefined;
      }

      if (!textureFile.isContentLoaded) {
        await textureFile.loadContent();
      }

      if (!(textureFile.content instanceof Uint8Array)) {
        Log.verbose(`[ContentWidgetProvider] Texture content is not Uint8Array: ${textureItem.projectPath}`);
        return undefined;
      }

      // Determine MIME type from extension
      const ext = StorageUtilities.getTypeFromName(textureFile.name).toLowerCase();
      let mimeType = "image/png";

      if (ext === "tga") {
        // TGA needs special handling - convert to PNG first
        const pngData = await ImageCodec.tgaToPng(textureFile.content);
        if (pngData) {
          return ImageCodec.toDataUrl(pngData, "image/png");
        }
        Log.verbose(`[ContentWidgetProvider] Failed to convert TGA to PNG: ${textureItem.projectPath}`);
        return undefined;
      } else if (ext === "jpg" || ext === "jpeg") {
        mimeType = "image/jpeg";
      } else if (ext === "webp") {
        mimeType = "image/webp";
      }

      return ImageCodec.toDataUrl(textureFile.content, mimeType);
    } catch (err) {
      Log.verbose(`[ContentWidgetProvider] Error loading texture: ${textureItem.projectPath} - ${err}`);
      return undefined;
    }
  }

  /**
   * Find the position of a value in the editor
   */
  private findValuePosition(
    model: monaco.editor.ITextModel,
    content: string,
    path: string[],
    value: string
  ): { lineNumber: number; column: number } | null {
    // Check if model is disposed before using it
    if (model.isDisposed()) {
      return null;
    }

    // Find the path offset
    const offsetResult = this.pathResolver.findPathOffset(content, path);
    if (!offsetResult) {
      return null;
    }

    // Get position at the end of the value (where we'll place the widget)
    const valueEnd = offsetResult.end;
    const position = model.getPositionAt(valueEnd);

    return {
      lineNumber: position.lineNumber,
      column: position.column + 1, // Position after the value
    };
  }

  /**
   * Apply widgets to the editor
   */
  private applyWidgets(editor: monaco.editor.IStandaloneCodeEditor, configs: IWidgetConfig[]): void {
    // Always clear and recreate all widgets when content changes
    // This ensures positions are accurate after edits that shift lines
    this.clearWidgets();

    // Add all widgets fresh
    for (const config of configs) {
      const widgetId = `mct-widget-${config.id}`;
      const widget = new McContentWidget(config, this.onActionCallback);
      this.widgets.set(widgetId, widget);
      editor.addContentWidget(widget);
    }
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    this.clearWidgets();
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
  }
}

/**
 * CSS styles for content widgets
 */
export const CONTENT_WIDGET_STYLES = `
  .mct-content-widget {
    display: inline-flex;
    align-items: center;
    pointer-events: auto;
    z-index: 100;
  }

  /* Color Swatch Widget */
  .mct-color-swatch {
    width: 14px;
    height: 14px;
    border: 1px solid rgba(128, 128, 128, 0.5);
    border-radius: 2px;
    margin-left: 4px;
    cursor: pointer;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  }

  .mct-color-swatch:hover {
    border-color: rgba(128, 128, 128, 0.8);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  }

  /* Texture Thumbnail Widget */
  .mct-texture-thumbnail {
    width: 20px;
    height: 20px;
    margin-left: 4px;
    border: 1px solid rgba(128, 128, 128, 0.3);
    border-radius: 2px;
    overflow: visible;
    background-color: rgba(0, 0, 0, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    position: relative;
  }

  .mct-texture-thumbnail > img:first-child {
    width: 100%;
    height: 100%;
    object-fit: contain;
    image-rendering: pixelated;
  }

  .mct-texture-thumbnail:hover {
    border-color: rgba(128, 128, 128, 0.6);
  }

  /* Hover Preview */
  .mct-texture-preview {
    display: none;
    position: fixed;
    padding: 4px;
    background-color: #1e1e1e;
    border: 1px solid rgba(128, 128, 128, 0.5);
    border-radius: 4px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    z-index: 10000;
    pointer-events: none;
  }

  .mct-texture-preview img {
    width: 256px;
    height: 256px;
    object-fit: contain;
    image-rendering: pixelated;
    display: block;
  }

  .mct-texture-preview-label {
    margin-top: 4px;
    font-size: 10px;
    color: #aaa;
    text-align: center;
    max-width: 256px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Action Button Widget */
  .mct-action-button {
    width: 18px;
    height: 18px;
    margin-left: 4px;
    padding: 0;
    border: none;
    border-radius: 3px;
    background-color: rgba(100, 140, 180, 0.15);
    color: inherit;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    opacity: 0.7;
    transition: opacity 0.15s, background-color 0.15s;
  }

  .mct-action-button:hover {
    opacity: 1;
    background-color: rgba(100, 140, 180, 0.3);
  }

  /* Dark theme adjustments */
  .monaco-editor.vs-dark .mct-color-swatch {
    border-color: rgba(180, 180, 180, 0.4);
  }

  .monaco-editor.vs-dark .mct-texture-thumbnail {
    border-color: rgba(180, 180, 180, 0.3);
    background-color: rgba(255, 255, 255, 0.05);
  }

  .monaco-editor.vs-dark .mct-action-button {
    background-color: rgba(120, 160, 200, 0.15);
  }

  /* Light theme adjustments for preview */
  .monaco-editor:not(.vs-dark) .mct-texture-preview {
    background-color: #ffffff;
    border-color: rgba(100, 100, 100, 0.3);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .monaco-editor:not(.vs-dark) .mct-texture-preview-label {
    color: #666;
  }
`;
