// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * McHoverProvider - Provides rich hover documentation for Minecraft components
 *
 * This provider shows contextual documentation when hovering over:
 * - Entity/block/item components (using form-based metadata)
 * - Molang expressions
 * - Event names
 * - Texture/geometry references
 * - Version numbers
 *
 * ARCHITECTURE:
 * Unlike static JSON schema associations (which can't distinguish behavior vs resource
 * pack files in the same folder structure), this provider uses runtime type inference:
 *
 * 1. Get the Project for the workspace (cached)
 * 2. Find the ProjectItem for the current document to get its ProjectItemType
 * 3. Load the form definition for that item type via FormMetadataProvider
 * 4. Parse the JSON path at cursor position
 * 5. Look up the field in the form and generate hover from form metadata
 *
 * This approach leverages all the sophisticated type inference logic in Project.
 *
 * Uses the langcore module for platform-agnostic content generation.
 *
 * @see McCompletionProvider for auto-complete
 * @see McDefinitionProvider for go-to-definition
 */

import * as vscode from "vscode";
import Database from "../../minecraft/Database";
import Log from "../../core/Log";
import IStorage from "../../storage/IStorage";
import Project from "../../app/Project";
import CreatorToolsHost from "../../app/CreatorToolsHost";
import { MinecraftPathUtils } from "../../langcore/shared/MinecraftPathUtils";
import { jsonHoverContentGenerator, IHoverContent } from "../../langcore/json/JsonHoverContent";
import { molangHoverGenerator } from "../../langcore/molang/MolangHover";
import { FormMetadataProvider } from "../../langcore/shared/FormMetadataProvider";
import ProjectItem from "../../app/ProjectItem";
import { MOLANG_QUERIES, MOLANG_MATH } from "../../langcore/molang/MolangParser";
import { jsonPathResolver } from "../../langcore/json/JsonPathResolver";

/**
 * Component documentation from MCTools database
 */
interface ComponentDoc {
  name: string;
  description: string;
  properties?: { [key: string]: PropertyDoc };
  examples?: string[];
  category?: string;
  sinceVersion?: string;
  deprecated?: boolean;
}

interface PropertyDoc {
  description: string;
  type: string;
  default?: any;
  required?: boolean;
}

export default class McHoverProvider implements vscode.HoverProvider {
  // Cache for component documentation (fallback when form data not available)
  private componentDocs: Map<string, ComponentDoc> = new Map();
  private docsLoaded = false;
  private storageProvider: (uri: vscode.Uri) => IStorage | undefined;

  // Project cache for form-based hover (same pattern as McCompletionProvider)
  private projectCache: Map<string, Project> = new Map();

  constructor(storageProvider: (uri: vscode.Uri) => IStorage | undefined) {
    this.storageProvider = storageProvider;
  }

  public async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Promise<vscode.Hover | undefined> {
    if (document.languageId !== "json") {
      return undefined;
    }

    if (!this.isMinecraftFile(document)) {
      return undefined;
    }

    try {
      await this.ensureDocsLoaded();

      const wordRange = document.getWordRangeAtPosition(position, /[a-zA-Z0-9_:.]+/);
      if (!wordRange) {
        return undefined;
      }

      const word = document.getText(wordRange);
      const lineText = document.lineAt(position.line).text;

      // Try form-based hover first (uses rich metadata from form.json files)
      const formHover = await this.getFormBasedHover(document, position);
      if (formHover) {
        return new vscode.Hover(formHover, wordRange);
      }

      // Determine what kind of hover to show
      const hover = await this.getHoverContent(word, lineText, document, position);
      if (hover) {
        return new vscode.Hover(hover, wordRange);
      }

      return undefined;
    } catch (error) {
      Log.debug(`Hover error: ${error}`);
      return undefined;
    }
  }

  private isMinecraftFile(document: vscode.TextDocument): boolean {
    const relativePath = vscode.workspace.asRelativePath(document.uri);
    return MinecraftPathUtils.isMinecraftContentPath(relativePath);
  }

  /**
   * Get form-based hover content using the form definitions
   *
   * This is the primary hover mechanism that uses rich metadata from form.json files.
   * It determines the ProjectItemType for the file, loads the appropriate form,
   * and generates hover content from the field at the current JSON path.
   */
  private async getFormBasedHover(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<vscode.MarkdownString | undefined> {
    try {
      // Get the project item for this file to determine its type
      const projectItem = await this.getProjectItemForDocument(document);
      if (!projectItem) {
        return undefined;
      }

      // Get the form for this item type
      const form = await FormMetadataProvider.getFormForItemType(projectItem.itemType);
      if (!form) {
        return undefined;
      }

      // Parse the JSON to get the path at cursor position
      const text = document.getText();
      const offset = document.offsetAt(position);
      const pathResult = jsonPathResolver.getPathAtOffset(text, offset);

      if (!pathResult || pathResult.path.length === 0) {
        return undefined;
      }

      // Look up the field at this path
      const field = FormMetadataProvider.getFieldAtPath(form, pathResult.path);
      if (!field) {
        return undefined;
      }

      // Generate hover content from the field
      const hoverContent = jsonHoverContentGenerator.generateFieldHover(field, pathResult, form);

      // Convert to VS Code MarkdownString
      return this.convertHoverContentToMarkdown(hoverContent);
    } catch (error) {
      Log.debug(`Form-based hover error: ${error}`);
      return undefined;
    }
  }

  /**
   * Convert platform-agnostic hover content to VS Code MarkdownString
   */
  private convertHoverContentToMarkdown(content: IHoverContent): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    md.isTrusted = true;

    for (const section of content.sections) {
      if (section.isCode && section.language) {
        md.appendCodeblock(section.markdown, section.language);
      } else {
        md.appendMarkdown(section.markdown + "\n\n");
      }
    }

    return md;
  }

  /**
   * Get or create a project for a URI (same pattern as McCompletionProvider)
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
        Log.debug(`Failed to get CreatorTools instance for hover`);
        return undefined;
      }

      const project = new Project(creatorTools, workspaceFolder.name, null);
      await project.setProjectFolder(storage.rootFolder);
      await project.inferProjectItemsFromFiles();

      this.projectCache.set(key, project);
      return project;
    } catch (error) {
      Log.debug(`Failed to create project for hover: ${error}`);
      return undefined;
    }
  }

  /**
   * Get the ProjectItem for a document
   */
  private async getProjectItemForDocument(document: vscode.TextDocument): Promise<ProjectItem | undefined> {
    const project = await this.getProject(document.uri);
    if (!project) {
      return undefined;
    }

    // Find the project item matching this file's path
    const relativePath = vscode.workspace.asRelativePath(document.uri);

    for (const item of project.items) {
      if (item.projectPath && relativePath.endsWith(item.projectPath.replace(/\//g, "\\"))) {
        return item;
      }
      // Also try forward slash comparison
      if (item.projectPath && relativePath.replace(/\\/g, "/").endsWith(item.projectPath)) {
        return item;
      }
    }

    return undefined;
  }

  /**
   * Clear the project cache
   */
  public clearCache(): void {
    this.projectCache.clear();
  }

  /**
   * Load component documentation from database
   */
  private async ensureDocsLoaded(): Promise<void> {
    if (this.docsLoaded) {
      return;
    }

    try {
      await Database.loadUx();

      // Build component docs from database forms and metadata
      // This is a simplified version - in practice, we'd load from our form.json files
      this.buildComponentDocs();
      this.docsLoaded = true;
    } catch (error) {
      Log.debug(`Failed to load docs: ${error}`);
    }
  }

  /**
   * Build component documentation from various sources
   */
  private buildComponentDocs(): void {
    // Entity behavior components
    this.addComponentDoc("minecraft:health", {
      name: "minecraft:health",
      description: "Defines the current and maximum health of the entity.",
      category: "Entity Attribute",
      properties: {
        value: { description: "The current and maximum health value.", type: "integer", default: 10 },
        min: { description: "The minimum health the entity can have.", type: "integer", default: 0 },
        max: { description: "The maximum health the entity can have.", type: "integer", default: 10 },
      },
      examples: [`"minecraft:health": {\n  "value": 20,\n  "max": 20\n}`],
    });

    this.addComponentDoc("minecraft:attack", {
      name: "minecraft:attack",
      description: "Defines the entity's melee attack damage.",
      category: "Entity Combat",
      properties: {
        damage: { description: "Amount of damage dealt per attack.", type: "number | [min, max]", default: 2 },
        effect_name: { description: "Status effect to apply on hit.", type: "string" },
        effect_duration: { description: "Duration of the effect in seconds.", type: "number", default: 0 },
      },
    });

    this.addComponentDoc("minecraft:movement", {
      name: "minecraft:movement",
      description: "Defines the movement speed of the entity.",
      category: "Entity Movement",
      properties: {
        value: { description: "Movement speed value.", type: "number", default: 0.25 },
      },
    });

    this.addComponentDoc("minecraft:behavior.tempt", {
      name: "minecraft:behavior.tempt",
      description: "Allows the entity to be tempted by items held by the player.",
      category: "Entity AI Goals",
      properties: {
        priority: { description: "Goal priority (lower = higher priority).", type: "integer", required: true },
        speed_multiplier: { description: "Speed multiplier when following.", type: "number", default: 1.0 },
        items: { description: "Items that can tempt this entity.", type: "string[]", required: true },
        within_radius: { description: "Distance to detect tempting players.", type: "number", default: 10.0 },
        can_tempt_while_ridden: { description: "Can be tempted while being ridden.", type: "boolean", default: false },
      },
      examples: [
        `"minecraft:behavior.tempt": {\n  "priority": 4,\n  "speed_multiplier": 1.2,\n  "items": ["carrot", "golden_carrot", "carrot_on_a_stick"]\n}`,
      ],
    });

    this.addComponentDoc("minecraft:behavior.follow_parent", {
      name: "minecraft:behavior.follow_parent",
      description: "Allows the baby entity to follow its parent.",
      category: "Entity AI Goals",
      properties: {
        priority: { description: "Goal priority (lower = higher priority).", type: "integer", required: true },
        speed_multiplier: { description: "Speed multiplier when following.", type: "number", default: 1.0 },
      },
    });

    this.addComponentDoc("minecraft:loot", {
      name: "minecraft:loot",
      description: "Specifies the loot table to use when the entity dies.",
      category: "Entity Drops",
      properties: {
        table: { description: "Path to the loot table file.", type: "string", required: true },
      },
    });

    this.addComponentDoc("minecraft:spawn_entity", {
      name: "minecraft:spawn_entity",
      description: "Allows the entity to spawn other entities.",
      category: "Entity Spawning",
      properties: {
        entities: { description: "Array of spawn configurations.", type: "object[]", required: true },
      },
    });

    // Block components
    this.addComponentDoc("minecraft:destructible_by_mining", {
      name: "minecraft:destructible_by_mining",
      description: "Describes the destructible by mining properties of the block.",
      category: "Block Properties",
      properties: {
        seconds_to_destroy: {
          description: "Time in seconds to destroy with base tools.",
          type: "number",
          default: 0.0,
        },
      },
    });

    this.addComponentDoc("minecraft:destructible_by_explosion", {
      name: "minecraft:destructible_by_explosion",
      description: "Describes the destructible by explosion properties.",
      category: "Block Properties",
      properties: {
        explosion_resistance: { description: "Resistance to explosions.", type: "number", default: 0.0 },
      },
    });

    this.addComponentDoc("minecraft:friction", {
      name: "minecraft:friction",
      description: "Describes the friction for the block.",
      category: "Block Properties",
      properties: {
        value: { description: "Friction value (0-1). Lower = more slippery.", type: "number", default: 0.4 },
      },
    });

    this.addComponentDoc("minecraft:flammable", {
      name: "minecraft:flammable",
      description: "Describes the flammable properties of the block.",
      category: "Block Properties",
      properties: {
        catch_chance_modifier: { description: "Chance modifier for catching fire.", type: "integer", default: 5 },
        destroy_chance_modifier: {
          description: "Chance modifier for being destroyed by fire.",
          type: "integer",
          default: 20,
        },
      },
    });

    this.addComponentDoc("minecraft:light_emission", {
      name: "minecraft:light_emission",
      description: "Amount of light this block emits (0-15).",
      category: "Block Properties",
    });

    this.addComponentDoc("minecraft:map_color", {
      name: "minecraft:map_color",
      description: "Sets the color of the block on maps.",
      category: "Block Properties",
    });

    // Item components
    this.addComponentDoc("minecraft:max_stack_size", {
      name: "minecraft:max_stack_size",
      description: "Maximum stack size for this item (1-64).",
      category: "Item Properties",
    });

    this.addComponentDoc("minecraft:food", {
      name: "minecraft:food",
      description: "Makes this item consumable as food.",
      category: "Item Properties",
      properties: {
        nutrition: { description: "Hunger points restored.", type: "integer", required: true },
        saturation_modifier: { description: "Saturation modifier.", type: "number", default: 0.6 },
        can_always_eat: { description: "Can be eaten when not hungry.", type: "boolean", default: false },
        effects: { description: "Status effects when consumed.", type: "object[]" },
      },
    });

    this.addComponentDoc("minecraft:durability", {
      name: "minecraft:durability",
      description: "How many uses before the item breaks.",
      category: "Item Properties",
      properties: {
        max_durability: { description: "Maximum durability.", type: "integer", required: true },
        damage_chance: { description: "Chance to take durability damage per use.", type: "object" },
      },
    });

    this.addComponentDoc("minecraft:weapon", {
      name: "minecraft:weapon",
      description: "Makes this item function as a weapon.",
      category: "Item Properties",
      properties: {
        on_hurt_entity: { description: "Event to run when hurting an entity.", type: "object" },
        on_hit_block: { description: "Event to run when hitting a block.", type: "object" },
      },
    });
  }

  private addComponentDoc(name: string, doc: ComponentDoc): void {
    this.componentDocs.set(name, doc);
    // Also add without minecraft: prefix
    if (name.startsWith("minecraft:")) {
      this.componentDocs.set(name.substring(10), doc);
    }
  }

  /**
   * Get hover content based on context
   */
  private async getHoverContent(
    word: string,
    lineText: string,
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<vscode.MarkdownString | undefined> {
    // Check if it's a component name
    const componentDoc = this.componentDocs.get(word);
    if (componentDoc) {
      return this.formatComponentDoc(componentDoc);
    }

    // Check for format_version
    if (word === "format_version" || lineText.includes('"format_version"')) {
      return this.formatVersionDoc(lineText);
    }

    // Check for Molang query
    if (word.startsWith("query.") || word.startsWith("q.")) {
      return this.formatMolangDoc(word);
    }

    // Check for Molang variable
    if (word.startsWith("variable.") || word.startsWith("v.")) {
      return this.formatMolangVariableDoc(word);
    }

    // Check for Molang math function
    if (word.startsWith("math.")) {
      return this.formatMolangMathDoc(word);
    }

    // Check for entity identifier
    if (word.startsWith("minecraft:") && !this.componentDocs.has(word)) {
      return this.formatEntityDoc(word);
    }

    return undefined;
  }

  /**
   * Format component documentation as Markdown
   */
  private formatComponentDoc(doc: ComponentDoc): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    md.isTrusted = true;

    // Header
    md.appendMarkdown(`### ${doc.name}\n\n`);
    md.appendMarkdown(`${doc.description}\n\n`);

    // Category badge
    if (doc.category) {
      md.appendMarkdown(`*Category: ${doc.category}*\n\n`);
    }

    // Properties
    if (doc.properties && Object.keys(doc.properties).length > 0) {
      md.appendMarkdown(`**Properties:**\n\n`);
      for (const [propName, propDoc] of Object.entries(doc.properties)) {
        const required = propDoc.required ? " *(required)*" : "";
        const defaultVal = propDoc.default !== undefined ? ` Default: \`${propDoc.default}\`` : "";
        md.appendMarkdown(`- \`${propName}\` (${propDoc.type})${required}: ${propDoc.description}${defaultVal}\n`);
      }
      md.appendMarkdown("\n");
    }

    // Example
    if (doc.examples && doc.examples.length > 0) {
      md.appendMarkdown(`**Example:**\n\n`);
      md.appendCodeblock(doc.examples[0], "json");
    }

    // Documentation link
    md.appendMarkdown(
      `\n[📖 View on Microsoft Learn](https://learn.microsoft.com/minecraft/creator/reference/content/entityreference/examples/componentlist)`
    );

    return md;
  }

  /**
   * Format format_version documentation
   */
  private formatVersionDoc(lineText: string): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    md.isTrusted = true;

    // Extract version from line
    const versionMatch = lineText.match(/"format_version"\s*:\s*"([^"]+)"/);
    const version = versionMatch ? versionMatch[1] : "unknown";

    md.appendMarkdown(`### format_version\n\n`);
    md.appendMarkdown(`Current: \`${version}\`\n\n`);
    md.appendMarkdown(
      `The format version specifies which version of the Minecraft data format this file uses. ` +
        `Using the latest format version enables new features and syntax.\n\n`
    );

    // Version recommendations
    md.appendMarkdown(`**Recommended versions:**\n\n`);
    md.appendMarkdown(`- Entity behavior: \`1.21.0\` or \`1.20.80\`\n`);
    md.appendMarkdown(`- Block behavior: \`1.21.0\`\n`);
    md.appendMarkdown(`- Item behavior: \`1.21.0\`\n`);
    md.appendMarkdown(`- Geometry: \`1.21.0\` or \`1.12.0\`\n\n`);

    md.appendMarkdown(
      `[📖 Learn about format versions](https://learn.microsoft.com/minecraft/creator/documents/introductiontoaddons)`
    );

    return md;
  }

  /**
   * Format Molang query documentation using langcore
   */
  private formatMolangDoc(query: string): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    md.isTrusted = true;

    // Use langcore for Molang hover
    const hoverContent = molangHoverGenerator.generateHover(query, 0);
    if (hoverContent) {
      for (const section of hoverContent.sections) {
        md.appendMarkdown(section.markdown + "\n\n");
      }
    } else {
      // Normalize query name
      const normalizedQuery = query.startsWith("q.") ? "query." + query.substring(2) : query;
      md.appendMarkdown(`### Molang Query\n\n`);
      md.appendMarkdown(`\`${normalizedQuery}\`\n\n`);

      // Look up in MOLANG_QUERIES from langcore
      const queryInfo = MOLANG_QUERIES.find((q) => q.name === normalizedQuery);
      if (queryInfo) {
        md.appendMarkdown(`${queryInfo.description}\n\n`);
        md.appendMarkdown(`**Returns:** ${queryInfo.returns}\n\n`);
      }
    }

    md.appendMarkdown(
      `[📖 Molang Documentation](https://learn.microsoft.com/minecraft/creator/reference/content/molangreference/)`
    );

    return md;
  }

  /**
   * Format Molang variable documentation
   */
  private formatMolangVariableDoc(variable: string): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    md.isTrusted = true;

    md.appendMarkdown(`### Molang Variable\n\n`);
    md.appendMarkdown(`\`${variable}\`\n\n`);
    md.appendMarkdown(
      `Custom variable defined in this entity's animations or render controllers. ` +
        `Variables persist across animation frames and can be used to track state.\n\n`
    );

    md.appendMarkdown(`**Example:**\n\n`);
    md.appendCodeblock(`"variable.attack_time = query.anim_time;"`, "molang");

    return md;
  }

  /**
   * Format Molang math function documentation using langcore
   */
  private formatMolangMathDoc(func: string): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    md.isTrusted = true;

    // Use langcore for Molang math hover
    const hoverContent = molangHoverGenerator.generateHover(func, 0);
    if (hoverContent) {
      for (const section of hoverContent.sections) {
        md.appendMarkdown(section.markdown + "\n\n");
      }
    } else {
      md.appendMarkdown(`### Molang Math Function\n\n`);
      md.appendMarkdown(`\`${func}\`\n\n`);

      // Look up in MOLANG_MATH from langcore
      const mathInfo = MOLANG_MATH.find((m) => func.startsWith(m.name));
      if (mathInfo) {
        md.appendMarkdown(`${mathInfo.description}\n\n`);
        md.appendMarkdown(`**Syntax:** \`${mathInfo.syntax}\`\n\n`);
      }
    }

    return md;
  }

  /**
   * Format entity identifier documentation
   */
  private formatEntityDoc(entityId: string): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    md.isTrusted = true;

    const entityName = entityId.replace("minecraft:", "");

    md.appendMarkdown(`### Entity: ${entityName}\n\n`);
    md.appendMarkdown(`Vanilla Minecraft entity.\n\n`);
    md.appendMarkdown(
      `[📖 View on Microsoft Learn](https://learn.microsoft.com/minecraft/creator/reference/content/entityreference/examples/entitylist)`
    );

    return md;
  }
}
