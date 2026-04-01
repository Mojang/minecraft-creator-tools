// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * JsonReferenceResolver - Platform-agnostic cross-file reference resolution
 *
 * This module provides reference resolution for navigating between Minecraft files:
 * - Go to definition (entity ID → entity file)
 * - Find all references (entity file → all usages)
 */

import { ReferenceType, parseNamespacedId, getReferenceTypeFromValue } from "../shared/MinecraftReferenceTypes";
import { MinecraftPathUtils, ContentType } from "../shared/MinecraftPathUtils";

/**
 * A location in a file (platform-agnostic)
 */
export interface IFileLocation {
  /** File path */
  filePath: string;
  /** Line number (1-based) */
  line: number;
  /** Column number (1-based) */
  column: number;
  /** End line (optional) */
  endLine?: number;
  /** End column (optional) */
  endColumn?: number;
}

/**
 * A reference with its location and type
 */
export interface IReference {
  /** The identifier value */
  identifier: string;
  /** Type of reference */
  type: ReferenceType;
  /** Location of the reference */
  location: IFileLocation;
  /** Whether this is the definition (vs usage) */
  isDefinition: boolean;
}

/**
 * Index entry for quick lookups
 */
export interface IReferenceIndexEntry {
  /** All locations where this identifier is defined */
  definitions: IFileLocation[];
  /** All locations where this identifier is used */
  usages: IFileLocation[];
}

/**
 * Reference resolver for cross-file navigation
 */
export class JsonReferenceResolver {
  /** Index of references by identifier */
  private referenceIndex: Map<string, IReferenceIndexEntry> = new Map();

  /** Map of file paths to their defined identifiers */
  private fileDefinitions: Map<string, Set<string>> = new Map();

  /**
   * Clear the reference index
   */
  public clearIndex(): void {
    this.referenceIndex.clear();
    this.fileDefinitions.clear();
  }

  /**
   * Index a file's references
   *
   * @param filePath - Path to the file
   * @param content - JSON content of the file
   */
  public indexFile(filePath: string, content: string): void {
    // Remove old entries for this file
    this.removeFileFromIndex(filePath);

    const pathAnalysis = MinecraftPathUtils.analyzePath(filePath);
    if (!pathAnalysis.isMinecraft) {
      return;
    }

    try {
      const json = JSON.parse(content);

      // Find definitions in this file
      const definitions = this.findDefinitions(filePath, json, pathAnalysis.contentType);
      for (const def of definitions) {
        this.addToIndex(def);
      }

      // Find usages in this file
      const usages = this.findUsages(filePath, json);
      for (const usage of usages) {
        this.addToIndex(usage);
      }
    } catch {
      // Invalid JSON - skip
    }
  }

  /**
   * Remove a file from the index
   */
  public removeFileFromIndex(filePath: string): void {
    const definedIds = this.fileDefinitions.get(filePath);
    if (!definedIds) {
      return;
    }

    for (const id of definedIds) {
      const entry = this.referenceIndex.get(id);
      if (entry) {
        entry.definitions = entry.definitions.filter((loc) => loc.filePath !== filePath);
        entry.usages = entry.usages.filter((loc) => loc.filePath !== filePath);

        if (entry.definitions.length === 0 && entry.usages.length === 0) {
          this.referenceIndex.delete(id);
        }
      }
    }

    this.fileDefinitions.delete(filePath);
  }

  /**
   * Find definitions for an identifier
   */
  public findDefinitionsFor(identifier: string): IFileLocation[] {
    const entry = this.referenceIndex.get(identifier);
    return entry?.definitions || [];
  }

  /**
   * Find all usages of an identifier
   */
  public findUsagesFor(identifier: string, includeDefinitions: boolean = false): IFileLocation[] {
    const entry = this.referenceIndex.get(identifier);
    if (!entry) {
      return [];
    }

    if (includeDefinitions) {
      return [...entry.definitions, ...entry.usages];
    }

    return entry.usages;
  }

  /**
   * Get definition type and likely file pattern for a reference value
   */
  public getDefinitionInfo(value: string): { type: ReferenceType; filePattern: string } | null {
    const refType = getReferenceTypeFromValue(value);

    switch (refType) {
      case "texture":
        return { type: refType, filePattern: `${value}.png` };

      case "geometry":
        // geometry.pig → *.geo.json containing this geometry
        return { type: refType, filePattern: "*.geo.json" };

      case "animation":
        // animation.pig.walk → *.animation.json containing this animation
        return { type: refType, filePattern: "*.animation.json" };

      case "animation_controller":
        return { type: refType, filePattern: "*.animation_controllers.json" };

      case "render_controller":
        return { type: refType, filePattern: "*.render_controllers.json" };

      case "loot_table":
        return { type: refType, filePattern: `${value}.json` };

      case "entity_id": {
        const { name } = parseNamespacedId(value);
        return { type: refType, filePattern: `${name}.json` };
      }

      default:
        if (value.includes(":")) {
          // Probably a namespaced ID
          const { name } = parseNamespacedId(value);
          return { type: "entity_id", filePattern: `${name}.json` };
        }
        return null;
    }
  }

  /**
   * Find definitions in a parsed JSON structure
   */
  private findDefinitions(filePath: string, json: unknown, contentType: ContentType): IReference[] {
    const references: IReference[] = [];

    if (typeof json !== "object" || json === null) {
      return references;
    }

    const obj = json as Record<string, unknown>;

    // Entity definition (behavior or resource)
    if (contentType === "entity") {
      const identifier = this.extractIdentifier(obj, [
        "minecraft:entity.description.identifier",
        "description.identifier",
      ]);

      if (identifier) {
        references.push({
          identifier,
          type: "entity_id",
          location: { filePath, line: 1, column: 1 },
          isDefinition: true,
        });

        // Track this file's definitions
        if (!this.fileDefinitions.has(filePath)) {
          this.fileDefinitions.set(filePath, new Set());
        }
        this.fileDefinitions.get(filePath)!.add(identifier);
      }

      // Also find event definitions
      const events = this.getNestedValue(obj, ["minecraft:entity", "events"]) as Record<string, unknown> | undefined;
      if (events) {
        for (const eventName of Object.keys(events)) {
          references.push({
            identifier: eventName,
            type: "event",
            location: { filePath, line: 1, column: 1 }, // TODO: find actual line
            isDefinition: true,
          });
        }
      }

      // Find component group definitions
      const groups = this.getNestedValue(obj, ["minecraft:entity", "component_groups"]) as
        | Record<string, unknown>
        | undefined;
      if (groups) {
        for (const groupName of Object.keys(groups)) {
          references.push({
            identifier: groupName,
            type: "component_group",
            location: { filePath, line: 1, column: 1 },
            isDefinition: true,
          });
        }
      }
    }

    // Block definition
    if (contentType === "block") {
      const identifier = this.extractIdentifier(obj, [
        "minecraft:block.description.identifier",
        "description.identifier",
      ]);

      if (identifier) {
        references.push({
          identifier,
          type: "block_id",
          location: { filePath, line: 1, column: 1 },
          isDefinition: true,
        });
      }
    }

    // Item definition
    if (contentType === "item") {
      const identifier = this.extractIdentifier(obj, [
        "minecraft:item.description.identifier",
        "description.identifier",
      ]);

      if (identifier) {
        references.push({
          identifier,
          type: "item_id",
          location: { filePath, line: 1, column: 1 },
          isDefinition: true,
        });
      }
    }

    // Geometry definition
    if (contentType === "model") {
      // Geometry files can have multiple geometries
      const geoKeys = Object.keys(obj).filter((k) => k.startsWith("geometry."));
      for (const geoId of geoKeys) {
        references.push({
          identifier: geoId,
          type: "geometry",
          location: { filePath, line: 1, column: 1 },
          isDefinition: true,
        });
      }

      // Also check minecraft:geometry format
      const mcGeo = obj["minecraft:geometry"] as unknown[];
      if (Array.isArray(mcGeo)) {
        for (const geo of mcGeo) {
          if (typeof geo === "object" && geo !== null) {
            const desc = (geo as Record<string, unknown>).description as Record<string, unknown>;
            if (desc?.identifier) {
              references.push({
                identifier: String(desc.identifier),
                type: "geometry",
                location: { filePath, line: 1, column: 1 },
                isDefinition: true,
              });
            }
          }
        }
      }
    }

    // Animation definition
    if (contentType === "animation") {
      const animations = obj.animations as Record<string, unknown> | undefined;
      if (animations) {
        for (const animId of Object.keys(animations)) {
          references.push({
            identifier: animId,
            type: "animation",
            location: { filePath, line: 1, column: 1 },
            isDefinition: true,
          });
        }
      }
    }

    return references;
  }

  /**
   * Find usages (references to other definitions) in a parsed JSON structure
   */
  private findUsages(filePath: string, json: unknown): IReference[] {
    const references: IReference[] = [];

    this.walkJson(json, (path, value) => {
      if (typeof value !== "string") {
        return;
      }

      const refType = getReferenceTypeFromValue(value);
      if (refType !== "unknown") {
        references.push({
          identifier: value,
          type: refType,
          location: { filePath, line: 1, column: 1 }, // TODO: track actual position
          isDefinition: false,
        });
      }
    });

    return references;
  }

  /**
   * Add a reference to the index
   */
  private addToIndex(ref: IReference): void {
    if (!this.referenceIndex.has(ref.identifier)) {
      this.referenceIndex.set(ref.identifier, { definitions: [], usages: [] });
    }

    const entry = this.referenceIndex.get(ref.identifier)!;

    if (ref.isDefinition) {
      entry.definitions.push(ref.location);
    } else {
      entry.usages.push(ref.location);
    }
  }

  /**
   * Extract identifier from common patterns
   */
  private extractIdentifier(obj: Record<string, unknown>, paths: string[]): string | null {
    for (const path of paths) {
      const value = this.getNestedValue(obj, path.split("."));
      if (typeof value === "string") {
        return value;
      }
    }
    return null;
  }

  /**
   * Get nested value from object
   */
  private getNestedValue(obj: unknown, path: string[]): unknown {
    let current = obj;

    for (const segment of path) {
      if (current === null || current === undefined || typeof current !== "object") {
        return undefined;
      }
      current = (current as Record<string, unknown>)[segment];
    }

    return current;
  }

  /**
   * Walk a JSON structure, calling callback for each value
   */
  private walkJson(json: unknown, callback: (path: string[], value: unknown) => void, path: string[] = []): void {
    callback(path, json);

    if (json === null || typeof json !== "object") {
      return;
    }

    if (Array.isArray(json)) {
      json.forEach((item, index) => {
        this.walkJson(item, callback, [...path, `[${index}]`]);
      });
    } else {
      for (const [key, value] of Object.entries(json)) {
        this.walkJson(value, callback, [...path, key]);
      }
    }
  }
}

// Singleton instance
export const jsonReferenceResolver = new JsonReferenceResolver();
