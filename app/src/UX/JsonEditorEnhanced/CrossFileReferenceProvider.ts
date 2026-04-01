/**
 * CrossFileReferenceProvider.ts
 *
 * ARCHITECTURE DOCUMENTATION
 * ==========================
 *
 * This provider enables cross-file navigation and intelligence for Minecraft
 * projects. It provides:
 *
 * 1. GO TO DEFINITION:
 *    Click on a reference (entity ID, texture path, animation name) and
 *    navigate to its definition in another file.
 *
 * 2. FIND ALL REFERENCES:
 *    From a definition, find all files that reference it.
 *
 * 3. PEEK DEFINITION:
 *    Preview the definition inline without leaving the current file.
 *
 * REFERENCE TYPES:
 * - Entity identifiers (minecraft:pig, custom:my_entity)
 * - Block identifiers
 * - Item identifiers
 * - Texture paths (textures/entity/pig)
 * - Animation identifiers (animation.pig.walk)
 * - Animation controller identifiers
 * - Render controller identifiers
 * - Sound event identifiers
 * - Loot table paths
 * - Recipe identifiers
 * - Spawn rule identifiers
 * - Event identifiers (within same file)
 * - Component group identifiers (within same file)
 *
 * MONACO INTEGRATION:
 * - Implements DefinitionProvider for Ctrl+Click navigation
 * - Implements ReferenceProvider for Find All References
 * - Implements TypeDefinitionProvider for type info
 *
 * CACHING:
 * References are cached per-project and invalidated when files change.
 * The cache is built incrementally as files are opened/saved.
 */

import * as monaco from "monaco-editor";
import Project from "../../app/Project";
import ProjectItem from "../../app/ProjectItem";
import { ProjectItemType } from "../../app/IProjectItemData";
import { JsonPathResolver } from "./JsonPathResolver";
import { FormDefinitionCache } from "./FormDefinitionCache";
import Utilities from "../../core/Utilities";

/**
 * Types of references we track
 */
export enum ReferenceType {
  EntityBehavior = "entity_behavior",
  EntityResource = "entity_resource",
  BlockBehavior = "block_behavior",
  BlockResource = "block_resource",
  ItemBehavior = "item_behavior",
  ItemResource = "item_resource",
  Texture = "texture",
  Animation = "animation",
  AnimationController = "animation_controller",
  RenderController = "render_controller",
  Sound = "sound",
  LootTable = "loot_table",
  Recipe = "recipe",
  SpawnRule = "spawn_rule",
  Feature = "feature",
  Biome = "biome",
  ComponentGroup = "component_group",
  Event = "event",
}

/**
 * A reference location in the project
 */
export interface IReferenceLocation {
  /** Path to the file containing the reference */
  filePath: string;

  /** Line number (1-based) */
  line: number;

  /** Column number (1-based) */
  column: number;

  /** The reference identifier */
  identifier: string;

  /** Type of reference */
  type: ReferenceType;

  /** Whether this is a definition (vs a usage) */
  isDefinition: boolean;

  /** JSON path within the file */
  jsonPath?: string;
}

/**
 * Cached reference index for a project
 */
interface IProjectReferenceIndex {
  /** Map from identifier to list of reference locations */
  references: Map<string, IReferenceLocation[]>;

  /** Map from file path to identifiers defined in that file */
  definitions: Map<string, Set<string>>;

  /** Last update timestamp */
  lastUpdated: number;
}

/**
 * Provides cross-file reference navigation for Minecraft JSON files
 */
export class CrossFileReferenceProvider
  implements
    monaco.languages.DefinitionProvider,
    monaco.languages.ReferenceProvider,
    monaco.languages.TypeDefinitionProvider
{
  private pathResolver: JsonPathResolver;
  private formCache: FormDefinitionCache;
  private projectItem?: ProjectItem;
  private project?: Project;

  // Reference index cache
  private projectIndex: IProjectReferenceIndex | null = null;
  private indexBuildPromise: Promise<void> | null = null;

  constructor(pathResolver: JsonPathResolver, formCache: FormDefinitionCache) {
    this.pathResolver = pathResolver;
    this.formCache = formCache;
  }

  /**
   * Update the file context
   */
  public updateContext(projectItem?: ProjectItem, project?: Project): void {
    // If project changed, invalidate the index
    if (this.project !== project) {
      this.projectIndex = null;
      this.indexBuildPromise = null;
    }

    this.projectItem = projectItem;
    this.project = project;
  }

  // =========================================================================
  // DefinitionProvider implementation
  // =========================================================================

  public async provideDefinition(
    model: monaco.editor.ITextModel,
    position: monaco.Position,
    _token: monaco.CancellationToken
  ): Promise<monaco.languages.Definition | null> {
    const reference = await this.getReferenceAtPosition(model, position);
    if (!reference) {
      return null;
    }

    // In-file symbol jumps (component groups/events) should work even without a project index.
    if (reference.type === ReferenceType.ComponentGroup) {
      const componentGroupDefinition = this.resolveSectionDefinition(model, reference.identifier, "component_groups");
      if (componentGroupDefinition) {
        return componentGroupDefinition;
      }
    }

    if (reference.type === ReferenceType.Event) {
      const eventDefinition = this.resolveSectionDefinition(model, reference.identifier, "events");
      if (eventDefinition) {
        return eventDefinition;
      }

      // Event actions can point at component groups via add/remove lists.
      const componentGroupDefinition = this.resolveSectionDefinition(model, reference.identifier, "component_groups");
      if (componentGroupDefinition) {
        return componentGroupDefinition;
      }
    }

    // Look up the definition
    let definitions = await this.findDefinitions(reference.identifier, reference.type);

    // For entity references, fall back to the counterpart pack type when needed.
    if (definitions.length === 0) {
      if (reference.type === ReferenceType.EntityBehavior) {
        definitions = await this.findDefinitions(reference.identifier, ReferenceType.EntityResource);
      } else if (reference.type === ReferenceType.EntityResource) {
        definitions = await this.findDefinitions(reference.identifier, ReferenceType.EntityBehavior);
      }
    }

    if (definitions.length === 0) {
      return null;
    }

    // Convert to Monaco locations
    return definitions.map((def) => this.toMonacoLocation(def));
  }

  // =========================================================================
  // ReferenceProvider implementation
  // =========================================================================

  public async provideReferences(
    model: monaco.editor.ITextModel,
    position: monaco.Position,
    context: monaco.languages.ReferenceContext,
    _token: monaco.CancellationToken
  ): Promise<monaco.languages.Location[] | null> {
    const reference = await this.getReferenceAtPosition(model, position);
    if (!reference) {
      return null;
    }

    // Find all references
    const refs = await this.findAllReferences(reference.identifier, reference.type);

    // Filter based on context
    let filtered = refs;
    if (!context.includeDeclaration) {
      filtered = refs.filter((r) => !r.isDefinition);
    }

    if (filtered.length === 0) {
      return null;
    }

    // Convert to Monaco locations
    return filtered.map((ref) => this.toMonacoLocation(ref));
  }

  // =========================================================================
  // TypeDefinitionProvider implementation
  // =========================================================================

  public async provideTypeDefinition(
    model: monaco.editor.ITextModel,
    position: monaco.Position,
    _token: monaco.CancellationToken
  ): Promise<monaco.languages.Definition | null> {
    // For JSON, type definition is the same as definition
    return this.provideDefinition(model, position, _token);
  }

  // =========================================================================
  // Reference detection
  // =========================================================================

  /**
   * Get the reference at a specific position
   */
  private async getReferenceAtPosition(
    model: monaco.editor.ITextModel,
    position: monaco.Position
  ): Promise<{ identifier: string; type: ReferenceType } | null> {
    const content = model.getValue();
    const offset = model.getOffsetAt(position);

    // Get the path at this position
    const pathResult = this.pathResolver.getPathAtOffset(content, offset);
    if (!pathResult) {
      return null;
    }

    // Get the value at this path
    const value = pathResult.currentValue;
    if (typeof value !== "string") {
      return null;
    }

    // Determine the reference type based on the path
    const type = this.inferReferenceType(pathResult.path.join("."), value, content);
    if (!type) {
      return null;
    }

    return { identifier: value, type };
  }

  /**
   * Infer the type of reference based on JSON path and value
   */
  private inferReferenceType(path: string, value: string, content: string): ReferenceType | null {
    const pathLower = path.toLowerCase();

    // Entity references
    if (pathLower.includes("identifier") && this.isEntityFile(content)) {
      return this.isResourcePack(content) ? ReferenceType.EntityResource : ReferenceType.EntityBehavior;
    }

    // Block references
    if (pathLower.includes("identifier") && this.isBlockFile(content)) {
      return this.isResourcePack(content) ? ReferenceType.BlockResource : ReferenceType.BlockBehavior;
    }

    // Item references
    if (pathLower.includes("identifier") && this.isItemFile(content)) {
      return this.isResourcePack(content) ? ReferenceType.ItemResource : ReferenceType.ItemBehavior;
    }

    // Texture references
    if (pathLower.includes("texture") && !pathLower.includes("texture_size")) {
      return ReferenceType.Texture;
    }

    // Animation references
    if (value.startsWith("animation.") || pathLower.includes("animations")) {
      return ReferenceType.Animation;
    }

    // Animation controller references
    if (value.startsWith("controller.animation.") || pathLower.includes("animation_controllers")) {
      return ReferenceType.AnimationController;
    }

    // Render controller references
    if (value.startsWith("controller.render.") || pathLower.includes("render_controllers")) {
      return ReferenceType.RenderController;
    }

    // Loot table references
    if (pathLower.includes("loot_table") || pathLower.includes("table")) {
      return ReferenceType.LootTable;
    }

    // Component group references (within file)
    if (pathLower.includes("component_groups") || pathLower.includes("add") || pathLower.includes("remove")) {
      return ReferenceType.ComponentGroup;
    }

    // Event references (within file)
    if (pathLower.includes("event") || pathLower.includes("trigger")) {
      return ReferenceType.Event;
    }

    // Spawn rule references
    if (value.includes("spawn_rules") || pathLower.includes("spawn")) {
      return ReferenceType.SpawnRule;
    }

    // Sound references
    if (pathLower.includes("sound") || value.startsWith("mob.") || value.startsWith("ambient.")) {
      return ReferenceType.Sound;
    }

    return null;
  }

  /**
   * Check if content is an entity file
   */
  private isEntityFile(content: string): boolean {
    return content.includes('"minecraft:entity"') || content.includes('"minecraft:client_entity"');
  }

  /**
   * Check if content is a block file
   */
  private isBlockFile(content: string): boolean {
    return content.includes('"minecraft:block"') || content.includes('"format_version"');
  }

  /**
   * Check if content is an item file
   */
  private isItemFile(content: string): boolean {
    return content.includes('"minecraft:item"');
  }

  /**
   * Check if content is from a resource pack
   */
  private isResourcePack(content: string): boolean {
    return content.includes('"minecraft:client_entity"') || content.includes('"render_controllers"');
  }

  // =========================================================================
  // Reference lookup
  // =========================================================================

  /**
   * Find definitions for an identifier
   */
  private async findDefinitions(identifier: string, type: ReferenceType): Promise<IReferenceLocation[]> {
    // Ensure index is built
    await this.ensureIndex();

    if (!this.projectIndex) {
      return this.findDefinitionsWithoutIndex(identifier, type);
    }

    const allRefs = this.projectIndex.references.get(identifier) || [];
    return allRefs.filter((r) => r.isDefinition && r.type === type);
  }

  /**
   * Find all references to an identifier
   */
  private async findAllReferences(identifier: string, type: ReferenceType): Promise<IReferenceLocation[]> {
    // Ensure index is built
    await this.ensureIndex();

    if (!this.projectIndex) {
      return [];
    }

    const allRefs = this.projectIndex.references.get(identifier) || [];
    return allRefs.filter((r) => r.type === type);
  }

  /**
   * Find definitions without using the index (slower, used as fallback)
   */
  private async findDefinitionsWithoutIndex(identifier: string, type: ReferenceType): Promise<IReferenceLocation[]> {
    if (!this.project) {
      return [];
    }

    const results: IReferenceLocation[] = [];

    // Get relevant project items based on type
    const itemTypes = this.getItemTypesForReferenceType(type);

    for (const itemType of itemTypes) {
      const items = this.project.getItemsByType(itemType);

      for (const item of items) {
        const file = await item.getFile();
        if (!file) continue;

        await file.loadContent();
        const content = file.content;
        if (!content || typeof content !== "string") continue;

        const itemPath = item.projectPath ?? "";
        if (!itemPath) continue;

        // Check if this file defines the identifier
        if (content.includes(`"${identifier}"`)) {
          // Try to find the exact location
          const location = this.findIdentifierInContent(content, identifier, itemPath, true);
          if (location) {
            location.type = type;
            results.push(location);
          }
        }
      }
    }

    return results;
  }

  /**
   * Get project item types for a reference type
   */
  private getItemTypesForReferenceType(type: ReferenceType): ProjectItemType[] {
    switch (type) {
      case ReferenceType.EntityBehavior:
        return [ProjectItemType.entityTypeBehavior];
      case ReferenceType.EntityResource:
        return [ProjectItemType.entityTypeResource];
      case ReferenceType.BlockBehavior:
        return [ProjectItemType.blockTypeBehavior];
      case ReferenceType.ItemBehavior:
        return [ProjectItemType.itemTypeBehavior];
      case ReferenceType.Animation:
        return [ProjectItemType.animationBehaviorJson, ProjectItemType.animationResourceJson];
      case ReferenceType.AnimationController:
        return [ProjectItemType.animationControllerBehaviorJson, ProjectItemType.animationControllerResourceJson];
      case ReferenceType.RenderController:
        return [ProjectItemType.renderControllerJson];
      case ReferenceType.LootTable:
        return [ProjectItemType.lootTableBehavior];
      case ReferenceType.Recipe:
        return [ProjectItemType.recipeBehavior];
      case ReferenceType.SpawnRule:
        return [ProjectItemType.spawnRuleBehavior];
      case ReferenceType.Feature:
        return [ProjectItemType.featureBehavior];
      default:
        return [];
    }
  }

  /**
   * Find an identifier in file content and return its location
   */
  private findIdentifierInContent(
    content: string,
    identifier: string,
    filePath: string,
    isDefinition: boolean
  ): IReferenceLocation | null {
    const searchStr = `"${identifier}"`;
    const index = content.indexOf(searchStr);

    if (index < 0) {
      return null;
    }

    // Calculate line and column
    const lines = content.substring(0, index).split("\n");
    const line = lines.length;
    const column = lines[lines.length - 1].length + 1;

    return {
      filePath,
      line,
      column,
      identifier,
      type: ReferenceType.EntityBehavior, // Will be overwritten by caller
      isDefinition,
    };
  }

  // =========================================================================
  // Index management
  // =========================================================================

  /**
   * Ensure the reference index is built
   */
  private async ensureIndex(): Promise<void> {
    if (this.projectIndex) {
      return;
    }

    if (this.indexBuildPromise) {
      await this.indexBuildPromise;
      return;
    }

    this.indexBuildPromise = this.buildIndex();
    await this.indexBuildPromise;
  }

  /**
   * Build the reference index for the project
   */
  private async buildIndex(): Promise<void> {
    if (!this.project) {
      return;
    }

    const index: IProjectReferenceIndex = {
      references: new Map(),
      definitions: new Map(),
      lastUpdated: Date.now(),
    };

    // Index all relevant project items
    const allItems = this.project.items;

    for (const item of allItems) {
      await this.indexProjectItem(item, index);
    }

    this.projectIndex = index;
  }

  /**
   * Index a single project item
   */
  private async indexProjectItem(item: ProjectItem, index: IProjectReferenceIndex): Promise<void> {
    const file = await item.getFile();
    if (!file) return;

    await file.loadContent();
    const content = file.content;
    if (!content || typeof content !== "string") return;

    // Skip non-JSON files
    if (!file.name.endsWith(".json")) return;

    try {
      const json = JSON.parse(Utilities.fixJsonContent(content));
      const filePath = item.projectPath ?? "";
      if (!filePath) return;

      // Extract identifiers from this file
      const identifiers = this.extractIdentifiers(json, item.itemType);

      // Record definitions
      const fileDefinitions = new Set<string>();
      for (const id of identifiers) {
        fileDefinitions.add(id.identifier);

        // Add to references map
        if (!index.references.has(id.identifier)) {
          index.references.set(id.identifier, []);
        }
        index.references.get(id.identifier)!.push({
          filePath,
          line: 1, // Simplified - would need full position tracking
          column: 1,
          identifier: id.identifier,
          type: id.type,
          isDefinition: id.isDefinition,
        });
      }

      index.definitions.set(filePath, fileDefinitions);
    } catch {
      // Invalid JSON, skip
    }
  }

  /**
   * Extract identifiers from a JSON object
   */
  private extractIdentifiers(
    json: unknown,
    itemType: ProjectItemType
  ): { identifier: string; type: ReferenceType; isDefinition: boolean }[] {
    const results: { identifier: string; type: ReferenceType; isDefinition: boolean }[] = [];

    if (typeof json !== "object" || json === null) {
      return results;
    }

    const obj = json as Record<string, unknown>;

    // Check for entity definition
    if (obj["minecraft:entity"] || obj["minecraft:client_entity"]) {
      const entity = (obj["minecraft:entity"] || obj["minecraft:client_entity"]) as Record<string, unknown>;
      const desc = entity.description as Record<string, unknown> | undefined;

      if (desc && typeof desc.identifier === "string") {
        results.push({
          identifier: desc.identifier,
          type: obj["minecraft:entity"] ? ReferenceType.EntityBehavior : ReferenceType.EntityResource,
          isDefinition: true,
        });
      }
    }

    // Check for block definition
    if (obj["minecraft:block"]) {
      const block = obj["minecraft:block"] as Record<string, unknown>;
      const desc = block.description as Record<string, unknown> | undefined;

      if (desc && typeof desc.identifier === "string") {
        results.push({
          identifier: desc.identifier,
          type: ReferenceType.BlockBehavior,
          isDefinition: true,
        });
      }
    }

    // Check for item definition
    if (obj["minecraft:item"]) {
      const item = obj["minecraft:item"] as Record<string, unknown>;
      const desc = item.description as Record<string, unknown> | undefined;

      if (desc && typeof desc.identifier === "string") {
        results.push({
          identifier: desc.identifier,
          type: ReferenceType.ItemBehavior,
          isDefinition: true,
        });
      }
    }

    // TODO: Add more extraction for animations, controllers, etc.

    return results;
  }

  /**
   * Invalidate the index (called when files change)
   */
  public invalidateIndex(): void {
    this.projectIndex = null;
    this.indexBuildPromise = null;
  }

  // =========================================================================
  // Monaco helpers
  // =========================================================================

  /**
   * Convert an IReferenceLocation to a Monaco Location
   */
  private toMonacoLocation(ref: IReferenceLocation): monaco.languages.Location {
    return {
      uri: monaco.Uri.file(ref.filePath),
      range: new monaco.Range(ref.line, ref.column, ref.line, ref.column + ref.identifier.length + 2),
    };
  }

  /**
   * Resolve a definition inside a specific top-level JSON section in the active model.
   * Exposed for provider-level verification in integration tests.
   */
  public resolveSectionDefinition(
    model: monaco.editor.ITextModel,
    identifier: string,
    sectionName: "component_groups" | "events"
  ): monaco.languages.Location | null {
    return this.findInDocumentSectionDefinition(model, identifier, sectionName);
  }

  /**
   * Find a symbol definition inside a named section of the currently open JSON document.
   * This supports same-file F12 navigation for component group and event references.
   */
  private findInDocumentSectionDefinition(
    model: monaco.editor.ITextModel,
    identifier: string,
    sectionName: "component_groups" | "events"
  ): monaco.languages.Location | null {
    const lines = model.getLinesContent();
    const escapedId = identifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const symbolRegex = new RegExp(`"${escapedId}"\\s*:`);

    let sectionLine = -1;
    let depth = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes(`"${sectionName}"`)) {
        // The opening brace may be on this line or a subsequent line
        if (line.includes("{")) {
          sectionLine = i;
          depth = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
        } else {
          // Scan forward for the opening brace (e.g., when formatted with `{` on the next line)
          for (let j = i + 1; j < lines.length && j <= i + 3; j++) {
            if (lines[j].includes("{")) {
              sectionLine = j;
              depth = (lines[j].match(/\{/g) || []).length - (lines[j].match(/\}/g) || []).length;
              break;
            }
          }
        }
        break;
      }
    }

    if (sectionLine < 0) {
      return null;
    }

    for (let i = sectionLine + 1; i < lines.length; i++) {
      const line = lines[i];

      if (symbolRegex.test(line)) {
        const column = Math.max(1, line.indexOf(`"${identifier}"`) + 1);
        return {
          uri: model.uri,
          range: new monaco.Range(i + 1, column, i + 1, column + identifier.length + 2),
        };
      }

      depth += (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
      if (depth <= 0) {
        break;
      }
    }

    return null;
  }
}
