/**
 * MinecraftCodeLensProvider.ts
 *
 * ARCHITECTURE DOCUMENTATION
 * ==========================
 *
 * This provider adds code lenses (inline clickable links above code) to
 * Minecraft JSON files. Code lenses provide quick access to related content
 * and documentation.
 *
 * CODE LENS TYPES:
 *
 * 1. DOCUMENTATION LINKS:
 *    - "📖 View docs" - Opens Minecraft documentation for this component
 *
 * 2. RELATED CONTENT:
 *    - "🔗 Used by 3 entities" - Shows entities using this component
 *    - "🎨 View in Resource Pack" - Jumps to corresponding RP definition
 *    - "⚙️ View in Behavior Pack" - Jumps to corresponding BP definition
 *
 * 3. QUICK ACTIONS:
 *    - "➕ Add component" - Opens component picker
 *    - "📋 Copy identifier" - Copies the entity/block/item ID
 *
 * 4. DEBUG/PREVIEW:
 *    - "👁️ Preview" - Opens visual preview for entities/blocks
 *    - "🧪 Test spawn" - Creates test spawn command
 *
 * MONACO INTEGRATION:
 * - Implements monaco.languages.CodeLensProvider
 * - Uses Command for click handling
 *
 * PLACEMENT RULES:
 * - Above format_version: show file type info
 * - Above description: show identifier and related links
 * - Above components: show component count and add action
 * - Above specific components: show docs link
 */

import * as monaco from "monaco-editor";
import Project from "../../app/Project";
import ProjectItem from "../../app/ProjectItem";
import { ProjectItemType } from "../../app/IProjectItemData";
import { JsonPathResolver } from "./JsonPathResolver";
import { FormDefinitionCache } from "./FormDefinitionCache";
import Utilities from "../../core/Utilities";

/**
 * Provides code lenses for Minecraft JSON files
 */
export class MinecraftCodeLensProvider implements monaco.languages.CodeLensProvider {
  private pathResolver: JsonPathResolver;
  private formCache: FormDefinitionCache;
  private projectItem?: ProjectItem;
  private project?: Project;

  // Event emitter for lens changes
  public onDidChange?: monaco.IEvent<this>;

  constructor(pathResolver: JsonPathResolver, formCache: FormDefinitionCache) {
    this.pathResolver = pathResolver;
    this.formCache = formCache;
  }

  /**
   * Update the file context
   */
  public updateContext(projectItem?: ProjectItem, project?: Project): void {
    this.projectItem = projectItem;
    this.project = project;
  }

  /**
   * Provide code lenses for the document
   */
  public async provideCodeLenses(
    model: monaco.editor.ITextModel,
    _token: monaco.CancellationToken
  ): Promise<monaco.languages.CodeLensList | null> {
    const content = model.getValue();
    const lenses: monaco.languages.CodeLens[] = [];

    try {
      const json = JSON.parse(Utilities.fixJsonContent(content));
      const lines = content.split("\n");

      // Add lenses based on file structure
      this.addFormatVersionLens(lenses, lines, json);
      this.addIdentifierLens(lenses, lines, json, model);
      this.addComponentsLens(lenses, lines, json);
      this.addSpecificComponentLenses(lenses, lines, json);
      this.addRelatedContentLenses(lenses, lines, json);
    } catch {
      // Invalid JSON, return empty
    }

    return {
      lenses,
      dispose: () => {},
    };
  }

  /**
   * Resolve a code lens (add command details)
   */
  public resolveCodeLens(
    model: monaco.editor.ITextModel,
    codeLens: monaco.languages.CodeLens,
    _token: monaco.CancellationToken
  ): monaco.languages.CodeLens {
    // Lenses should already be resolved in provideCodeLenses
    return codeLens;
  }

  // =========================================================================
  // Lens Generators
  // =========================================================================

  /**
   * Add lens above format_version showing file type
   */
  private addFormatVersionLens(lenses: monaco.languages.CodeLens[], lines: string[], json: unknown): void {
    const lineIndex = this.findLineContaining(lines, '"format_version"');
    if (lineIndex < 0) return;

    // Determine file type
    const fileType = this.getFileType(json);
    if (!fileType) return;

    lenses.push({
      range: new monaco.Range(lineIndex + 1, 1, lineIndex + 1, 1),
      command: {
        id: "mct.showFileInfo",
        title: `📄 ${fileType}`,
        tooltip: `This is a ${fileType} definition file`,
      },
    });
  }

  /**
   * Add lens above description/identifier
   */
  private addIdentifierLens(
    lenses: monaco.languages.CodeLens[],
    lines: string[],
    json: unknown,
    model: monaco.editor.ITextModel
  ): void {
    const lineIndex = this.findLineContaining(lines, '"description"');
    if (lineIndex < 0) return;

    // Get the identifier
    const identifier = this.extractIdentifier(json);
    if (!identifier) return;

    // Main identifier lens
    lenses.push({
      range: new monaco.Range(lineIndex + 1, 1, lineIndex + 1, 1),
      command: {
        id: "mct.copyToClipboard",
        title: `📋 ${identifier}`,
        tooltip: "Click to copy identifier",
        arguments: [identifier],
      },
    });

    // Add related pack lens
    const relatedLens = this.getRelatedPackLens(identifier, json, lineIndex);
    if (relatedLens) {
      lenses.push(relatedLens);
    }

    // Add usage count lens
    const usageLens = this.getUsageCountLens(identifier, lineIndex);
    if (usageLens) {
      lenses.push(usageLens);
    }
  }

  /**
   * Add lens above components section
   */
  private addComponentsLens(lenses: monaco.languages.CodeLens[], lines: string[], json: unknown): void {
    const lineIndex = this.findLineContaining(lines, '"components"');
    if (lineIndex < 0) return;

    // Count components
    const componentCount = this.countComponents(json);

    lenses.push({
      range: new monaco.Range(lineIndex + 1, 1, lineIndex + 1, 1),
      command: {
        id: "mct.showComponentList",
        title: `📦 ${componentCount} component${componentCount !== 1 ? "s" : ""}`,
        tooltip: "Show component list",
      },
    });

    // Add component action
    lenses.push({
      range: new monaco.Range(lineIndex + 1, 1, lineIndex + 1, 1),
      command: {
        id: "mct.addComponent",
        title: "➕ Add component",
        tooltip: "Add a new component",
      },
    });
  }

  /**
   * Add lenses for specific components
   */
  private addSpecificComponentLenses(lenses: monaco.languages.CodeLens[], lines: string[], json: unknown): void {
    // Find all minecraft: components
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(/"(minecraft:[a-z_]+)"/);
      if (match && lines[i].includes(":")) {
        const componentId = match[1];

        // Add docs link for important components
        if (this.isDocumentedComponent(componentId)) {
          lenses.push({
            range: new monaco.Range(i + 1, 1, i + 1, 1),
            command: {
              id: "mct.openDocs",
              title: "📖 Docs",
              tooltip: `Open documentation for ${componentId}`,
              arguments: [componentId],
            },
          });
        }
      }
    }
  }

  /**
   * Add lenses for related content
   */
  private addRelatedContentLenses(lenses: monaco.languages.CodeLens[], lines: string[], json: unknown): void {
    const identifier = this.extractIdentifier(json);
    if (!identifier || !this.project) return;

    // Find line for description to add related lenses
    const lineIndex = this.findLineContaining(lines, '"description"');
    if (lineIndex < 0) return;

    // Check for loot tables using this entity
    const lootTableCount = this.countReferencingLootTables(identifier);
    if (lootTableCount > 0) {
      lenses.push({
        range: new monaco.Range(lineIndex + 1, 1, lineIndex + 1, 1),
        command: {
          id: "mct.showReferences",
          title: `🎁 ${lootTableCount} loot table${lootTableCount !== 1 ? "s" : ""}`,
          tooltip: "Show loot tables referencing this entity",
          arguments: ["loot_table", identifier],
        },
      });
    }

    // Check for spawn rules for this entity
    const spawnRuleCount = this.countSpawnRules(identifier);
    if (spawnRuleCount > 0) {
      lenses.push({
        range: new monaco.Range(lineIndex + 1, 1, lineIndex + 1, 1),
        command: {
          id: "mct.showReferences",
          title: `🌍 ${spawnRuleCount} spawn rule${spawnRuleCount !== 1 ? "s" : ""}`,
          tooltip: "Show spawn rules for this entity",
          arguments: ["spawn_rule", identifier],
        },
      });
    }
  }

  // =========================================================================
  // Helper Methods
  // =========================================================================

  /**
   * Find line index containing a string
   */
  private findLineContaining(lines: string[], search: string): number {
    return lines.findIndex((line) => line.includes(search));
  }

  /**
   * Get file type from JSON structure
   */
  private getFileType(json: unknown): string | null {
    if (typeof json !== "object" || json === null) return null;

    const obj = json as Record<string, unknown>;

    if (obj["minecraft:entity"]) return "Entity Behavior";
    if (obj["minecraft:client_entity"]) return "Entity Resource";
    if (obj["minecraft:block"]) return "Block";
    if (obj["minecraft:item"]) return "Item";
    if (obj["minecraft:recipe_shaped"]) return "Shaped Recipe";
    if (obj["minecraft:recipe_shapeless"]) return "Shapeless Recipe";
    if (obj["minecraft:spawn_rules"]) return "Spawn Rules";
    if (obj["minecraft:loot_table"] || obj.pools) return "Loot Table";
    if (obj.animations) return "Animation";
    if (obj.animation_controllers) return "Animation Controller";
    if (obj.render_controllers) return "Render Controller";

    return null;
  }

  /**
   * Extract identifier from JSON
   */
  private extractIdentifier(json: unknown): string | null {
    if (typeof json !== "object" || json === null) return null;

    const obj = json as Record<string, unknown>;

    // Entity behavior
    const entity = obj["minecraft:entity"] as Record<string, unknown> | undefined;
    if (entity?.description) {
      const desc = entity.description as Record<string, unknown>;
      if (typeof desc.identifier === "string") return desc.identifier;
    }

    // Entity resource
    const clientEntity = obj["minecraft:client_entity"] as Record<string, unknown> | undefined;
    if (clientEntity?.description) {
      const desc = clientEntity.description as Record<string, unknown>;
      if (typeof desc.identifier === "string") return desc.identifier;
    }

    // Block
    const block = obj["minecraft:block"] as Record<string, unknown> | undefined;
    if (block?.description) {
      const desc = block.description as Record<string, unknown>;
      if (typeof desc.identifier === "string") return desc.identifier;
    }

    // Item
    const item = obj["minecraft:item"] as Record<string, unknown> | undefined;
    if (item?.description) {
      const desc = item.description as Record<string, unknown>;
      if (typeof desc.identifier === "string") return desc.identifier;
    }

    return null;
  }

  /**
   * Count components in JSON
   */
  private countComponents(json: unknown): number {
    if (typeof json !== "object" || json === null) return 0;

    const obj = json as Record<string, unknown>;

    // Find the components object
    const entity = (obj["minecraft:entity"] ||
      obj["minecraft:client_entity"] ||
      obj["minecraft:block"] ||
      obj["minecraft:item"]) as Record<string, unknown> | undefined;

    if (!entity?.components) return 0;

    const components = entity.components as Record<string, unknown>;
    return Object.keys(components).filter((k) => k.startsWith("minecraft:")).length;
  }

  /**
   * Check if component has documentation
   */
  private isDocumentedComponent(componentId: string): boolean {
    // Common documented components
    const documented = [
      "minecraft:health",
      "minecraft:attack",
      "minecraft:movement",
      "minecraft:behavior.melee_attack",
      "minecraft:behavior.nearest_attackable_target",
      "minecraft:physics",
      "minecraft:collision_box",
      "minecraft:loot",
      "minecraft:type_family",
    ];

    return documented.includes(componentId);
  }

  /**
   * Get lens for related pack (BP/RP)
   */
  private getRelatedPackLens(identifier: string, json: unknown, lineIndex: number): monaco.languages.CodeLens | null {
    if (!this.project) return null;

    const obj = json as Record<string, unknown>;
    const isResource = !!obj["minecraft:client_entity"];

    // Look for counterpart
    const targetType = isResource ? ProjectItemType.entityTypeBehavior : ProjectItemType.entityTypeResource;
    const items = this.project.getItemsByType(targetType);

    for (const item of items) {
      // Check if item matches identifier (simplified check)
      if (item.name.toLowerCase().includes(identifier.split(":").pop()?.toLowerCase() || "")) {
        return {
          range: new monaco.Range(lineIndex + 1, 1, lineIndex + 1, 1),
          command: {
            id: "mct.openFile",
            title: isResource ? "⚙️ View BP" : "🎨 View RP",
            tooltip: isResource ? "Open behavior pack definition" : "Open resource pack definition",
            arguments: [item.projectPath],
          },
        };
      }
    }

    return null;
  }

  /**
   * Get lens showing usage count
   */
  private getUsageCountLens(identifier: string, lineIndex: number): monaco.languages.CodeLens | null {
    // This would require indexing the project - simplified for now
    return null;
  }

  /**
   * Count loot tables referencing an entity
   */
  private countReferencingLootTables(identifier: string): number {
    // Simplified - would need to scan loot tables
    return 0;
  }

  /**
   * Count spawn rules for an entity
   */
  private countSpawnRules(identifier: string): number {
    if (!this.project) return 0;

    const spawnRules = this.project.getItemsByType(ProjectItemType.spawnRuleBehavior);
    // Simplified - would need to check each spawn rule's identifier
    return 0;
  }
}
