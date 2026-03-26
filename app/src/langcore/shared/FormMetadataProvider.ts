// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * FormMetadataProvider - Access to form definitions for field documentation
 *
 * This module provides a platform-agnostic interface for accessing Minecraft
 * form definitions. Form definitions describe the structure of JSON files and
 * provide metadata for documentation, validation, and completions.
 *
 * This abstracts the Database and form loading so that both VS Code and Monaco
 * can use the same metadata without knowing the loading details.
 */

import Database from "../../minecraft/Database";
import IFormDefinition from "../../dataform/IFormDefinition";
import IField, { FieldDataType } from "../../dataform/IField";
import { ProjectItemType } from "../../app/IProjectItemData";

/**
 * Result of looking up a field, includes the field and its containing form
 */
export interface IFieldLookupResult {
  field: IField;
  form: IFormDefinition;
}

/**
 * Mapping from ProjectItemType to form location
 */
interface IFormMapping {
  category: string;
  formName: string;
}

/**
 * Provider for accessing form metadata
 */
export class FormMetadataProvider {
  private static formMappings: Map<ProjectItemType, IFormMapping> | null = null;
  private static formCache: Map<string, IFormDefinition> = new Map();

  /**
   * Initialize form mappings (lazy initialization)
   */
  private static ensureFormMappings(): Map<ProjectItemType, IFormMapping> {
    if (this.formMappings) {
      return this.formMappings;
    }

    this.formMappings = new Map();

    // Behavior pack content
    this.formMappings.set(ProjectItemType.entityTypeBehavior, {
      category: "entity",
      formName: "entity_behavior_document",
    });
    this.formMappings.set(ProjectItemType.blockTypeBehavior, {
      category: "block",
      formName: "block_behavior_document",
    });
    this.formMappings.set(ProjectItemType.itemTypeBehavior, {
      category: "item",
      formName: "item_behavior_document",
    });
    this.formMappings.set(ProjectItemType.recipeBehavior, {
      category: "recipe",
      formName: "recipe_shaped",
    });
    this.formMappings.set(ProjectItemType.lootTableBehavior, {
      category: "loot",
      formName: "loot_table",
    });
    this.formMappings.set(ProjectItemType.spawnRuleBehavior, {
      category: "spawn_rules",
      formName: "spawn_rules_document",
    });
    this.formMappings.set(ProjectItemType.biomeBehavior, {
      category: "biome",
      formName: "biome_json_file",
    });

    // Resource pack content
    this.formMappings.set(ProjectItemType.entityTypeResource, {
      category: "entity",
      formName: "entity_resource_document",
    });
    this.formMappings.set(ProjectItemType.animationBehaviorJson, {
      category: "animation",
      formName: "animation_document",
    });
    this.formMappings.set(ProjectItemType.animationControllerBehaviorJson, {
      category: "animation_controller",
      formName: "animation_controller_document",
    });
    this.formMappings.set(ProjectItemType.renderControllerJson, {
      category: "render_controller",
      formName: "render_controller_document",
    });
    this.formMappings.set(ProjectItemType.attachableResourceJson, {
      category: "attachable",
      formName: "attachable_document",
    });
    this.formMappings.set(ProjectItemType.particleJson, {
      category: "particle",
      formName: "particle_document",
    });
    this.formMappings.set(ProjectItemType.fogResourceJson, {
      category: "fog",
      formName: "fog_document",
    });

    // Manifests
    this.formMappings.set(ProjectItemType.behaviorPackManifestJson, {
      category: "manifest",
      formName: "behavior_pack_manifest",
    });
    this.formMappings.set(ProjectItemType.resourcePackManifestJson, {
      category: "manifest",
      formName: "resource_pack_manifest",
    });

    return this.formMappings;
  }

  /**
   * Get form definition for a project item type
   */
  public static async getFormForItemType(itemType: ProjectItemType): Promise<IFormDefinition | null> {
    const mappings = this.ensureFormMappings();
    const mapping = mappings.get(itemType);

    if (!mapping) {
      return null;
    }

    return this.getForm(mapping.category, mapping.formName);
  }

  /**
   * Get form definition by category and name
   */
  public static async getForm(category: string, formName: string): Promise<IFormDefinition | null> {
    const cacheKey = `${category}/${formName}`;

    if (this.formCache.has(cacheKey)) {
      return this.formCache.get(cacheKey) || null;
    }

    try {
      // Ensure Database is loaded
      await Database.loadUx();

      const form = await Database.getForm(category, formName);
      if (form) {
        this.formCache.set(cacheKey, form);
        return form;
      }
    } catch {
      // Form not found
    }

    return null;
  }

  /**
   * Get a field at a specific JSON path within a form
   *
   * @param form - The form definition to search
   * @param path - Array of path segments (e.g., ["minecraft:entity", "components", "minecraft:health"])
   * @returns The field at the path, or null if not found
   */
  public static getFieldAtPath(form: IFormDefinition, path: string[]): IField | null {
    if (path.length === 0 || !form.fields) {
      return null;
    }

    let currentFields: IField[] | undefined = form.fields;
    let currentField: IField | null = null;

    for (let i = 0; i < path.length; i++) {
      const segment = path[i];

      if (!currentFields) {
        return null;
      }

      // Find field matching this segment
      // Handle array indices by stripping the [n] part
      const cleanSegment = segment.replace(/\[\d+\]$/, "");

      currentField = currentFields.find((f) => f.id === cleanSegment || f.id === segment) || null;

      if (!currentField) {
        // Try matching component patterns (minecraft:something)
        if (cleanSegment.startsWith("minecraft:")) {
          // Look for a component container field
          for (const f of currentFields) {
            if (f.id === "components" || f.id === "component_groups" || f.id === cleanSegment) {
              currentField = f;
              break;
            }
          }
        }
      }

      if (!currentField) {
        return null;
      }

      // Move to subFields for next iteration
      if (currentField.subFields) {
        currentFields = Object.values(currentField.subFields);
      } else {
        currentFields = undefined;
      }
    }

    return currentField;
  }

  /**
   * Get a field with its containing form (for accessing form-level samples)
   */
  public static async getFieldWithFormAtPathAsync(
    form: IFormDefinition,
    path: string[]
  ): Promise<IFieldLookupResult | null> {
    const field = this.getFieldAtPath(form, path);
    if (field) {
      return { field, form };
    }

    // Try resolving through subFormId references
    // This handles forms that reference other forms for components
    // (Implementation would follow subFormId links)

    return null;
  }

  /**
   * Get valid values for a field (for completions)
   */
  public static getValidValues(field: IField): string[] {
    const values: string[] = [];

    // Enum choices
    if (field.choices) {
      for (const choice of field.choices) {
        if (choice.id !== undefined) {
          values.push(String(choice.id));
        }
      }
    }

    // Note: lookupId references are resolved at runtime via Database lookups
    // and are not available statically here

    return values;
  }

  /**
   * Format a field type as a human-readable string
   */
  public static formatFieldType(dataType: FieldDataType | undefined): string {
    switch (dataType) {
      case FieldDataType.int:
        return "Integer";
      case FieldDataType.float:
        return "Float";
      case FieldDataType.number:
        return "Number";
      case FieldDataType.string:
        return "String";
      case FieldDataType.boolean:
        return "Boolean";
      case FieldDataType.stringEnum:
        return "String (enumerated)";
      case FieldDataType.intEnum:
        return "Integer (enumerated)";
      case FieldDataType.stringArray:
        return "Array of strings";
      case FieldDataType.objectArray:
        return "Array of objects";
      case FieldDataType.object:
        return "Object";
      case FieldDataType.point3:
        return "3D Point [x, y, z]";
      case FieldDataType.intPoint3:
        return "3D Integer Point [x, y, z]";
      case FieldDataType.intRange:
        return "Integer range [min, max]";
      case FieldDataType.floatRange:
        return "Float range [min, max]";
      case FieldDataType.minecraftFilter:
        return "Minecraft Filter";
      case FieldDataType.minecraftEventTrigger:
        return "Event Trigger";
      case FieldDataType.version:
        return "Version";
      case FieldDataType.uuid:
        return "UUID";
      default:
        return "Unknown";
    }
  }

  /**
   * Clear the form cache
   */
  public static clearCache(): void {
    this.formCache.clear();
  }
}
