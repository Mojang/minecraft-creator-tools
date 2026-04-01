/**
 * FormDefinitionCache.ts
 *
 * ARCHITECTURE DOCUMENTATION
 * ==========================
 *
 * This utility class provides caching and lookup for Minecraft form definitions.
 * Form definitions describe the structure of Minecraft JSON files and provide:
 *
 * 1. Field metadata (types, descriptions, valid values)
 * 2. Component definitions (minecraft: prefixed properties)
 * 3. Default values and constraints
 * 4. Documentation links and samples
 *
 * KEY CONCEPTS:
 * - Form Definition: A JSON structure describing expected fields for a file type
 * - Field: A single property definition with type, description, constraints
 * - Component: A minecraft:-prefixed object type with its own fields
 *
 * FORM DEFINITION SOURCES:
 * - /app/public/data/forms/*.json - Form definition files
 * - Database.getForm() - Loads forms from the data folder
 *
 * IMPORTANT TYPE NOTE:
 * - IFormDefinition.fields is an IField[] (array)
 * - IField.subFields is a { [keyName: string]: IField } (dictionary)
 * - This mixed structure requires careful handling
 *
 * RELATED FILES:
 * - JsonPathResolver.ts - Provides paths to look up in forms
 * - IField.ts - Defines the field interface
 * - IFormDefinition.ts - Defines the form definition interface
 */

import IFormDefinition from "../../dataform/IFormDefinition";
import IField from "../../dataform/IField";
import Database from "../../minecraft/Database";
import { ProjectItemType } from "../../app/IProjectItemData";

/**
 * Represents a cached form with lookup maps
 */
interface ICachedForm {
  definition: IFormDefinition;
  fieldsByPath: Map<string, IField>;
  componentFields: Map<string, IField[]>;
  lastAccessed: number;
}

/**
 * Maps project item types to form categories and names
 */
interface IFormMapping {
  category: string;
  formName: string;
}

/**
 * Cache and lookup service for form definitions
 */
export class FormDefinitionCache {
  private cache: Map<string, ICachedForm> = new Map();
  private maxCacheSize = 50;
  private formMappings: Map<ProjectItemType, IFormMapping> = new Map();

  constructor() {
    this.initializeFormMappings();
  }

  /**
   * Initialize mappings from ProjectItemType to form names
   *
   * IMPORTANT: These mappings must match actual files in public/data/forms/
   * Format: category = folder name, formName = filename without .form.json
   *
   * To add a new mapping:
   * 1. Check if public/data/forms/{category}/{formName}.form.json exists
   * 2. If not, either create the form or don't add the mapping
   * 3. For document-level forms, the form should wrap the entire file structure
   *    (e.g., entity_behavior_document wraps format_version + minecraft:entity)
   */
  private initializeFormMappings(): void {
    // =====================================================================
    // BEHAVIOR PACK CONTENT
    // =====================================================================

    // Entity types (behavior)
    // File: public/data/forms/entity/entity_behavior_document.form.json
    // This is the document-level form that wraps format_version + minecraft:entity
    // The minecraft:entity object references actor_document which contains
    // components, component_groups, events, etc.
    this.formMappings.set(ProjectItemType.entityTypeBehavior, {
      category: "entity",
      formName: "entity_behavior_document",
    });

    // Block types (behavior)
    // File: public/data/forms/block/block_behavior_document.form.json
    this.formMappings.set(ProjectItemType.blockTypeBehavior, {
      category: "block",
      formName: "block_behavior_document",
    });

    // Item types (behavior)
    // File: public/data/forms/item/item_behavior_document.form.json
    this.formMappings.set(ProjectItemType.itemTypeBehavior, {
      category: "item",
      formName: "item_behavior_document",
    });

    // Recipes - Note: This uses recipe_shaped, but recipes can be shaped, shapeless, furnace, etc.
    // For a complete solution, would need to detect recipe type and use appropriate form
    // Files: public/data/forms/recipe/recipe_shaped.form.json, recipe_shapeless.form.json, etc.
    this.formMappings.set(ProjectItemType.recipeBehavior, {
      category: "recipe",
      formName: "recipe_shaped",
    });

    // Loot tables
    // File: public/data/forms/loot/loot_table.form.json
    this.formMappings.set(ProjectItemType.lootTableBehavior, {
      category: "loot",
      formName: "loot_table",
    });

    // Spawn rules
    // File: public/data/forms/spawn_rules/spawn_rules_document.form.json
    this.formMappings.set(ProjectItemType.spawnRuleBehavior, {
      category: "spawn_rules",
      formName: "spawn_rules_document",
    });

    // Feature rules
    // File: public/data/forms/feature_rules/feature_rules_document.form.json
    this.formMappings.set(ProjectItemType.featureRuleBehavior, {
      category: "feature_rules",
      formName: "feature_rules_document",
    });

    // Biomes (behavior)
    // File: public/data/forms/biome/biome_json_file.form.json
    this.formMappings.set(ProjectItemType.biomeBehavior, {
      category: "biome",
      formName: "biome_json_file",
    });

    // Dimension definitions
    // File: public/data/forms/dimension/dimension_document.form.json
    this.formMappings.set(ProjectItemType.dimensionJson, {
      category: "dimension",
      formName: "dimension_document",
    });

    // Trading
    // File: public/data/forms/trade/trade.form.json
    this.formMappings.set(ProjectItemType.tradingBehaviorJson, {
      category: "trade",
      formName: "trade",
    });

    // Camera behavior
    // File: public/data/forms/camera/minecraft_aim_assist_preset.form.json
    // Note: Camera has aim assist presets and categories, using preset as primary
    this.formMappings.set(ProjectItemType.cameraBehaviorJson, {
      category: "camera",
      formName: "minecraft_aim_assist_preset",
    });

    // =====================================================================
    // JIGSAW STRUCTURES (Structure Sets, Structures, Template Pools, Processors)
    // =====================================================================

    // Jigsaw Structure Sets
    // File: public/data/forms/jigsaw/structure_set.form.json
    this.formMappings.set(ProjectItemType.jigsawStructureSet, {
      category: "jigsaw",
      formName: "structure_set",
    });

    // Jigsaw Structures
    // File: public/data/forms/jigsaw/jigsaw_structure.form.json
    this.formMappings.set(ProjectItemType.jigsawStructure, {
      category: "jigsaw",
      formName: "jigsaw_structure",
    });

    // Jigsaw Template Pools
    // File: public/data/forms/jigsaw/template_pool.form.json
    this.formMappings.set(ProjectItemType.jigsawTemplatePool, {
      category: "jigsaw",
      formName: "template_pool",
    });

    // Jigsaw Processor Lists
    // File: public/data/forms/jigsaw/processor_list.form.json
    this.formMappings.set(ProjectItemType.jigsawProcessorList, {
      category: "jigsaw",
      formName: "processor_list",
    });

    // =====================================================================
    // RESOURCE PACK CONTENT
    // =====================================================================

    // Entity types (resource/client)
    // File: public/data/forms/visual/actor_resource_definition.v1.10.0.form.json
    this.formMappings.set(ProjectItemType.entityTypeResource, {
      category: "visual",
      formName: "actor_resource_definition.v1.10.0",
    });

    // Attachables
    // File: public/data/forms/attachable/attachable.form.json
    this.formMappings.set(ProjectItemType.attachableResourceJson, {
      category: "attachable",
      formName: "attachable",
    });

    // Model Geometry
    // File: public/data/forms/visual/geometry.v1.21.0.form.json (latest version)
    this.formMappings.set(ProjectItemType.modelGeometryJson, {
      category: "visual",
      formName: "geometry.v1.21.0",
    });

    // Render Controllers
    // File: public/data/forms/visual/render_controller.v1.8.0.form.json
    this.formMappings.set(ProjectItemType.renderControllerJson, {
      category: "visual",
      formName: "render_controller.v1.8.0",
    });

    // Animations (resource)
    // File: public/data/forms/visual/actor_animation.v1.8.0.form.json
    this.formMappings.set(ProjectItemType.animationResourceJson, {
      category: "visual",
      formName: "actor_animation.v1.8.0",
    });

    // Animation Controllers (resource)
    // File: public/data/forms/visual/actor_animation_controller.v1.10.0.form.json
    this.formMappings.set(ProjectItemType.animationControllerResourceJson, {
      category: "visual",
      formName: "actor_animation_controller.v1.10.0",
    });

    // Client Biomes (legacy biomes_client.json format)
    // File: public/data/forms/biomes_client/biomes_client.form.json
    // Note: This is for the legacy biomes_client.json file, NOT the newer client_biome format
    // which has format_version and minecraft:client_biome structure
    this.formMappings.set(ProjectItemType.biomesClientCatalogResource, {
      category: "biomes_client",
      formName: "biomes_client",
    });

    // Particles
    // File: public/data/forms/client_particles/particle_document.form.json
    this.formMappings.set(ProjectItemType.particleJson, {
      category: "client_particles",
      formName: "particle_document",
    });

    // Fog
    // File: public/data/forms/fog/fog_document.form.json
    this.formMappings.set(ProjectItemType.fogResourceJson, {
      category: "fog",
      formName: "fog_document",
    });

    // Block Culling
    // File: public/data/forms/block_culling/blockculling.form.json
    this.formMappings.set(ProjectItemType.blockCulling, {
      category: "block_culling",
      formName: "blockculling",
    });

    // Crafting Catalog
    // File: public/data/forms/crafting_catalog/crafting_catalog_document.form.json
    this.formMappings.set(ProjectItemType.craftingItemCatalog, {
      category: "crafting_catalog",
      formName: "crafting_catalog_document",
    });

    // =====================================================================
    // UI
    // =====================================================================

    // JSON UI
    // File: public/data/forms/ui/ui_screen.form.json
    this.formMappings.set(ProjectItemType.uiJson, {
      category: "ui",
      formName: "ui_screen",
    });

    // Global Variables JSON
    // File: public/data/forms/ui/ui_global_variables.form.json
    this.formMappings.set(ProjectItemType.globalVariablesJson, {
      category: "ui",
      formName: "ui_global_variables",
    });

    // =====================================================================
    // PACK MANIFESTS
    // =====================================================================

    // Behavior Pack Manifest
    // File: public/data/forms/pack/behavior_pack_header_json.form.json
    this.formMappings.set(ProjectItemType.behaviorPackManifestJson, {
      category: "pack",
      formName: "behavior_pack_header_json",
    });

    // Resource Pack Manifest
    // File: public/data/forms/pack/resource_pack_manifest.form.json
    this.formMappings.set(ProjectItemType.resourcePackManifestJson, {
      category: "pack",
      formName: "resource_pack_manifest",
    });

    // Skin Pack Manifest
    // File: public/data/forms/pack/skin_pack_manifest.form.json
    this.formMappings.set(ProjectItemType.skinPackManifestJson, {
      category: "pack",
      formName: "skin_pack_manifest",
    });

    // World Template Manifest
    // File: public/data/forms/pack/world_template_manifest.form.json
    this.formMappings.set(ProjectItemType.worldTemplateManifestJson, {
      category: "pack",
      formName: "world_template_manifest",
    });

    // =====================================================================
    // DEFERRED RENDERING / VIBRANT VISUALS
    // =====================================================================

    // Texture Sets
    // File: public/data/forms/visual/texture_set.v1.21.30.form.json
    this.formMappings.set(ProjectItemType.textureSetJson, {
      category: "visual",
      formName: "texture_set.v1.21.30",
    });

    // KNOWN GAP: Deferred rendering forms not yet created
    // These are lower priority as they're used by the preview/creators features.
    // When forms are added to public/data/forms/client_deferred_rendering/:
    // - Lighting JSON: client_deferred_rendering/lighting.form.json
    // - Color Grading JSON: client_deferred_rendering/color_grading.form.json
    // - Atmospherics JSON: client_deferred_rendering/atmospherics.form.json
    // - PBR JSON: client_deferred_rendering/pbr.form.json

    // =====================================================================
    // ANIMATIONS (Behavior Pack)
    // =====================================================================

    // Animations (behavior)
    // File: public/data/forms/animation/animation_document.form.json
    this.formMappings.set(ProjectItemType.animationBehaviorJson, {
      category: "animation",
      formName: "animation_document",
    });

    // Animation Controllers (behavior)
    // File: public/data/forms/animation/animation_controller_document.form.json
    this.formMappings.set(ProjectItemType.animationControllerBehaviorJson, {
      category: "animation",
      formName: "animation_controller_document",
    });

    // =====================================================================
    // DIALOGUE
    // =====================================================================

    // NPC Dialogue
    // File: public/data/forms/dialogue/dialogue_document.form.json
    this.formMappings.set(ProjectItemType.dialogueBehaviorJson, {
      category: "dialogue",
      formName: "dialogue_document",
    });

    // =====================================================================
    // FEATURES
    // =====================================================================

    // Features (not feature rules - those are separate)
    // File: public/data/forms/feature/feature_document.form.json
    this.formMappings.set(ProjectItemType.featureBehavior, {
      category: "feature",
      formName: "feature_document",
    });

    // =====================================================================
    // DISABLED MAPPINGS (form files don't exist or not yet implemented)
    // =====================================================================
    // - volumeBehaviorJson (no volume folder - TODO)
  }

  /**
   * Get the form mapping for a project item type
   */
  public getFormMapping(itemType: ProjectItemType): IFormMapping | undefined {
    return this.formMappings.get(itemType);
  }

  /**
   * Get a form definition, loading from cache or database
   */
  public async getForm(category: string, formName: string): Promise<IFormDefinition | null> {
    const cacheKey = `${category}/${formName}`;

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached) {
      cached.lastAccessed = Date.now();
      return cached.definition;
    }

    // Load from database
    try {
      const form = await Database.ensureFormLoaded(category, formName);
      if (form) {
        this.cacheForm(cacheKey, form);
        return form;
      }
    } catch {
      // Form not found
    }

    return null;
  }

  /**
   * Get a form for a specific project item type
   */
  public async getFormForItemType(itemType: ProjectItemType): Promise<IFormDefinition | null> {
    const mapping = this.formMappings.get(itemType);
    if (!mapping) {
      return null;
    }
    return this.getForm(mapping.category, mapping.formName);
  }

  /**
   * Find a field in an array by id
   */
  private findFieldInArray(fields: IField[], id: string): IField | undefined {
    // Direct match
    let field = fields.find((f) => f.id === id);
    if (field) return field;

    // Try without minecraft: prefix
    const idWithoutPrefix = id.replace("minecraft:", "");
    field = fields.find((f) => f.id === idWithoutPrefix);
    if (field) return field;

    // Try with minecraft: prefix
    field = fields.find((f) => `minecraft:${f.id}` === id);
    return field;
  }

  /**
   * Find a field in a dictionary by key
   */
  private findFieldInDict(fieldsDict: { [key: string]: IField }, id: string): IField | undefined {
    // Direct match
    if (fieldsDict[id]) return fieldsDict[id];

    // Try without minecraft: prefix
    const idWithoutPrefix = id.replace("minecraft:", "");
    if (fieldsDict[idWithoutPrefix]) return fieldsDict[idWithoutPrefix];

    // Try with minecraft: prefix
    const idWithPrefix = `minecraft:${id}`;
    if (fieldsDict[idWithPrefix]) return fieldsDict[idWithPrefix];

    return undefined;
  }

  /**
   * Get field definition for a JSON path within a form, following subFormId references.
   * This is the async version that can load subforms as needed.
   * Note: Form.fields is an array, but IField.subFields is a dictionary
   */
  public async getFieldAtPathAsync(form: IFormDefinition, path: string[]): Promise<IField | null> {
    if (!form || !form.fields || path.length === 0) {
      return null;
    }

    // First level uses the array
    let currentField: IField | null = null;
    let isInArray = true; // Root is array, subFields is dict
    let fieldsArray: IField[] = form.fields;
    let fieldsDict: { [key: string]: IField } = {};

    for (let i = 0; i < path.length; i++) {
      const segment = path[i];

      // Skip numeric indices (array access)
      if (/^\d+$/.test(segment)) {
        continue;
      }

      // Find field matching this segment
      let field: IField | undefined;
      if (isInArray) {
        field = this.findFieldInArray(fieldsArray, segment);
      } else {
        field = this.findFieldInDict(fieldsDict, segment);
      }

      if (!field) {
        return null;
      }

      currentField = field;

      // If this field has a subFormId, load that form and continue there
      if (field.subFormId && i < path.length - 1) {
        const subForm = await this.loadSubForm(field.subFormId);
        if (subForm && subForm.fields) {
          // Continue searching in the subform
          isInArray = true;
          fieldsArray = subForm.fields;
          fieldsDict = {};
          continue;
        }
      }

      // Transition to subFields (which is always a dict)
      if (field.subFields) {
        isInArray = false;
        fieldsDict = field.subFields;
        fieldsArray = [];
      } else {
        // No more subfields - but if we're not at the end, check subFormId for final field
        if (field.subFormId && i < path.length - 1) {
          const subForm = await this.loadSubForm(field.subFormId);
          if (subForm && subForm.fields) {
            isInArray = true;
            fieldsArray = subForm.fields;
            fieldsDict = {};
            continue;
          }
        }
        break;
      }
    }

    return currentField;
  }

  /**
   * Get field definition AND its containing form for a JSON path, following subFormId references.
   * This is useful when you need access to form-level properties like samples.
   */
  public async getFieldWithFormAtPathAsync(
    form: IFormDefinition,
    path: string[]
  ): Promise<{ field: IField; form: IFormDefinition } | null> {
    if (!form || !form.fields || path.length === 0) {
      return null;
    }

    // Track the current form (may change when we follow subFormId)
    let currentForm: IFormDefinition = form;
    let currentField: IField | null = null;
    let isInArray = true;
    let fieldsArray: IField[] = form.fields;
    let fieldsDict: { [key: string]: IField } = {};

    for (let i = 0; i < path.length; i++) {
      const segment = path[i];

      // Skip numeric indices (array access)
      if (/^\d+$/.test(segment)) {
        continue;
      }

      // Find field matching this segment
      let field: IField | undefined;
      if (isInArray) {
        field = this.findFieldInArray(fieldsArray, segment);
      } else {
        field = this.findFieldInDict(fieldsDict, segment);
      }

      if (!field) {
        return null;
      }

      currentField = field;

      // If this field has a subFormId, load that form and continue there
      if (field.subFormId && i < path.length - 1) {
        const subForm = await this.loadSubForm(field.subFormId);
        if (subForm && subForm.fields) {
          // Update current form to the subform
          currentForm = subForm;
          isInArray = true;
          fieldsArray = subForm.fields;
          fieldsDict = {};
          continue;
        }
      }

      // Transition to subFields (which is always a dict)
      if (field.subFields) {
        isInArray = false;
        fieldsDict = field.subFields;
        fieldsArray = [];
      } else {
        if (field.subFormId && i < path.length - 1) {
          const subForm = await this.loadSubForm(field.subFormId);
          if (subForm && subForm.fields) {
            currentForm = subForm;
            isInArray = true;
            fieldsArray = subForm.fields;
            fieldsDict = {};
            continue;
          }
        }
        break;
      }
    }

    if (!currentField) {
      return null;
    }

    return { field: currentField, form: currentForm };
  }

  /**
   * Load a subform by its subFormId (format: "category/formName")
   */
  private async loadSubForm(subFormId: string): Promise<IFormDefinition | null> {
    const parts = subFormId.split("/");
    if (parts.length !== 2) {
      return null;
    }
    return this.getForm(parts[0], parts[1]);
  }

  /**
   * Get a form by its subFormId (format: "category/formName")
   * This is the public version of loadSubForm for use by other providers.
   */
  public async getFormBySubFormId(subFormId: string): Promise<IFormDefinition | null> {
    return this.loadSubForm(subFormId);
  }

  /**
   * Get field definition for a JSON path within a form (synchronous - does not follow subFormId)
   * @deprecated Use getFieldAtPathAsync for full subFormId resolution
   * Note: Form.fields is an array, but IField.subFields is a dictionary
   */
  public getFieldAtPath(form: IFormDefinition, path: string[]): IField | null {
    if (!form || !form.fields || path.length === 0) {
      return null;
    }

    // First level uses the array
    let currentField: IField | null = null;
    let isInArray = true; // Root is array, subFields is dict
    let fieldsArray: IField[] = form.fields;
    let fieldsDict: { [key: string]: IField } = {};

    for (let i = 0; i < path.length; i++) {
      const segment = path[i];

      // Skip numeric indices (array access)
      if (/^\d+$/.test(segment)) {
        continue;
      }

      // Find field matching this segment
      let field: IField | undefined;
      if (isInArray) {
        field = this.findFieldInArray(fieldsArray, segment);
      } else {
        field = this.findFieldInDict(fieldsDict, segment);
      }

      if (!field) {
        return null;
      }

      currentField = field;

      // Transition to subFields (which is always a dict)
      if (field.subFields) {
        isInArray = false;
        fieldsDict = field.subFields;
        fieldsArray = [];
      } else {
        // No more subfields
        break;
      }
    }

    return currentField;
  }

  /**
   * Get all component definitions from a form
   */
  public getComponents(form: IFormDefinition): IField[] {
    if (!form || !form.fields) {
      return [];
    }

    const components: IField[] = [];

    const findComponentsInArray = (fields: IField[]) => {
      for (const field of fields) {
        if (field.id?.startsWith("minecraft:")) {
          components.push(field);
        }
        if (field.subFields) {
          findComponentsInDict(field.subFields);
        }
      }
    };

    const findComponentsInDict = (fieldsDict: { [key: string]: IField }) => {
      for (const key of Object.keys(fieldsDict)) {
        const field = fieldsDict[key];
        if (key.startsWith("minecraft:")) {
          components.push(field);
        }
        if (field.subFields) {
          findComponentsInDict(field.subFields);
        }
      }
    };

    findComponentsInArray(form.fields);
    return components;
  }

  /**
   * Get all component definitions from a form, following subFormId references.
   * This is the async version that properly resolves referenced forms to find
   * minecraft: components (e.g., entity_behavior_document → actor_document → entity_component_definitions).
   */
  public async getComponentsAsync(form: IFormDefinition): Promise<IField[]> {
    if (!form || !form.fields) {
      return [];
    }

    const components: IField[] = [];
    const visited = new Set<string>();

    const findComponentsInArray = async (fields: IField[]) => {
      for (const field of fields) {
        if (field.id?.startsWith("minecraft:")) {
          components.push(field);
        }
        if (field.subFields) {
          await findComponentsInDict(field.subFields);
        } else if (field.subFormId && !visited.has(field.subFormId)) {
          visited.add(field.subFormId);
          const subForm = await this.loadSubForm(field.subFormId);
          if (subForm?.fields) {
            await findComponentsInArray(subForm.fields);
          }
        }
      }
    };

    const findComponentsInDict = async (fieldsDict: { [key: string]: IField }) => {
      for (const key of Object.keys(fieldsDict)) {
        const field = fieldsDict[key];
        if (key.startsWith("minecraft:")) {
          components.push(field);
        }
        if (field.subFields) {
          await findComponentsInDict(field.subFields);
        } else if (field.subFormId && !visited.has(field.subFormId)) {
          visited.add(field.subFormId);
          const subForm = await this.loadSubForm(field.subFormId);
          if (subForm?.fields) {
            await findComponentsInArray(subForm.fields);
          }
        }
      }
    };

    await findComponentsInArray(form.fields);
    return components;
  }

  /**
   * Get component fields by category (e.g., "components", "events")
   */
  public getComponentsByCategory(form: IFormDefinition, category: string): IField[] {
    if (!form || !form.fields) {
      return [];
    }

    // Find the category field in the root array
    const categoryField = form.fields.find((f) => f.id === category);
    if (!categoryField || !categoryField.subFields) {
      return [];
    }

    const result: IField[] = [];
    for (const key of Object.keys(categoryField.subFields)) {
      if (key.startsWith("minecraft:")) {
        result.push(categoryField.subFields[key]);
      }
    }
    return result;
  }

  /**
   * Search for fields matching a pattern
   */
  public searchFields(form: IFormDefinition, pattern: string): IField[] {
    if (!form || !form.fields) {
      return [];
    }

    const results: IField[] = [];
    const lowerPattern = pattern.toLowerCase();

    const searchArray = (fields: IField[]) => {
      for (const field of fields) {
        const id = field.id?.toLowerCase() || "";
        const title = field.title?.toLowerCase() || "";
        const description = field.description?.toLowerCase() || "";

        if (id.includes(lowerPattern) || title.includes(lowerPattern) || description.includes(lowerPattern)) {
          results.push(field);
        }

        if (field.subFields) {
          searchDict(field.subFields);
        }
      }
    };

    const searchDict = (fieldsDict: { [key: string]: IField }) => {
      for (const key of Object.keys(fieldsDict)) {
        const field = fieldsDict[key];
        const id = field.id?.toLowerCase() || key.toLowerCase();
        const title = field.title?.toLowerCase() || "";
        const description = field.description?.toLowerCase() || "";

        if (id.includes(lowerPattern) || title.includes(lowerPattern) || description.includes(lowerPattern)) {
          results.push(field);
        }

        if (field.subFields) {
          searchDict(field.subFields);
        }
      }
    };

    searchArray(form.fields);
    return results;
  }

  /**
   * Get all valid values for a field (if it's an enum or lookup)
   */
  public getValidValues(field: IField): string[] {
    if (!field) {
      return [];
    }

    const values: string[] = [];

    // Check for explicit choices (ISimpleReference has id property)
    if (field.choices) {
      for (const choice of field.choices) {
        values.push(String(choice.id));
      }
    }

    // Check for lookup reference
    if (field.lookupId) {
      // Lookups would be resolved from Database
      // This is a placeholder for now
    }

    return values;
  }

  /**
   * Cache a form definition
   */
  private cacheForm(key: string, form: IFormDefinition): void {
    // Evict old entries if cache is full
    if (this.cache.size >= this.maxCacheSize) {
      this.evictOldest();
    }

    // Build lookup maps
    const fieldsByPath = new Map<string, IField>();
    const componentFields = new Map<string, IField[]>();

    const indexArray = (fields: IField[], prefix: string = "") => {
      for (const field of fields) {
        if (!field.id) continue;
        const path = prefix ? `${prefix}.${field.id}` : field.id;
        fieldsByPath.set(path, field);

        if (field.id.startsWith("minecraft:")) {
          const category = prefix || "root";
          const existing = componentFields.get(category) || [];
          existing.push(field);
          componentFields.set(category, existing);
        }

        if (field.subFields) {
          indexDict(field.subFields, path);
        }
      }
    };

    const indexDict = (fieldsDict: { [key: string]: IField }, prefix: string) => {
      for (const fieldKey of Object.keys(fieldsDict)) {
        const field = fieldsDict[fieldKey];
        const path = `${prefix}.${fieldKey}`;
        fieldsByPath.set(path, field);

        if (fieldKey.startsWith("minecraft:")) {
          const category = prefix;
          const existing = componentFields.get(category) || [];
          existing.push(field);
          componentFields.set(category, existing);
        }

        if (field.subFields) {
          indexDict(field.subFields, path);
        }
      }
    };

    indexArray(form.fields);

    this.cache.set(key, {
      definition: form,
      fieldsByPath,
      componentFields,
      lastAccessed: Date.now(),
    });
  }

  /**
   * Evict the oldest cache entry
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    this.cache.forEach((value, key) => {
      if (value.lastAccessed < oldestTime) {
        oldestTime = value.lastAccessed;
        oldestKey = key;
      }
    });

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Clear the entire cache
   */
  public clearCache(): void {
    this.cache.clear();
  }
}

// Export singleton for shared use
export const formDefinitionCache = new FormDefinitionCache();
