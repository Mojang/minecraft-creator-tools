// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * MinecraftPathUtils - Utilities for detecting and classifying Minecraft content paths
 *
 * This module provides platform-agnostic path analysis for Minecraft content.
 * Used by both VS Code providers and Monaco editor enhancements.
 *
 * USAGE:
 * ```typescript
 * import { MinecraftPathUtils } from '../langcore';
 *
 * if (MinecraftPathUtils.isMinecraftContentPath('/project/BP/entities/pig.json')) {
 *   const packType = MinecraftPathUtils.getPackType(path); // 'behavior'
 *   const contentType = MinecraftPathUtils.getContentType(path); // 'entity'
 * }
 * ```
 */

/**
 * Type of Minecraft pack
 */
export type PackType = "behavior" | "resource" | "skin" | "world_template" | "unknown";

/**
 * Type of content within a pack
 */
export type ContentType =
  | "entity"
  | "block"
  | "item"
  | "recipe"
  | "loot_table"
  | "spawn_rule"
  | "feature"
  | "feature_rule"
  | "biome"
  | "dimension"
  | "animation"
  | "animation_controller"
  | "render_controller"
  | "attachable"
  | "particle"
  | "fog"
  | "model"
  | "texture"
  | "sound"
  | "manifest"
  | "script"
  | "function"
  | "structure"
  | "trading"
  | "dialogue"
  | "camera"
  | "unknown";

/**
 * Result of path analysis
 */
export interface IPathAnalysis {
  /** Whether this is a Minecraft content path */
  isMinecraft: boolean;
  /** Type of pack (behavior, resource, etc.) */
  packType: PackType;
  /** Type of content (entity, block, etc.) */
  contentType: ContentType;
  /** The pack root folder path, if identifiable */
  packRoot?: string;
  /** Path relative to pack root */
  relativePath?: string;
  /** Identifier extracted from filename (e.g., "pig" from "pig.json") */
  identifier?: string;
}

/**
 * Path patterns for Minecraft content detection
 */
const BEHAVIOR_PACK_PATTERNS = [/behavior_pack/i, /\bBP\b/, /behavior_packs/i, /_bp\b/i, /\bbp_/i];

const RESOURCE_PACK_PATTERNS = [/resource_pack/i, /\bRP\b/, /resource_packs/i, /_rp\b/i, /\brp_/i];

const SKIN_PACK_PATTERNS = [/skin_pack/i, /\bSP\b/, /skin_packs/i, /_sp\b/i];

const WORLD_TEMPLATE_PATTERNS = [/world_template/i, /\bWT\b/, /world_templates/i];

/**
 * Content type detection based on path segments
 */
const CONTENT_TYPE_PATTERNS: Array<{ pattern: RegExp; type: ContentType }> = [
  // Behavior pack content
  { pattern: /\/entities?\//i, type: "entity" },
  { pattern: /\/blocks?\//i, type: "block" },
  { pattern: /\/items?\//i, type: "item" },
  { pattern: /\/recipes?\//i, type: "recipe" },
  { pattern: /\/loot_tables?\//i, type: "loot_table" },
  { pattern: /\/spawn_rules?\//i, type: "spawn_rule" },
  { pattern: /\/features?\//i, type: "feature" },
  { pattern: /\/feature_rules?\//i, type: "feature_rule" },
  { pattern: /\/biomes?\//i, type: "biome" },
  { pattern: /\/dimensions?\//i, type: "dimension" },
  { pattern: /\/trading\//i, type: "trading" },
  { pattern: /\/dialogue\//i, type: "dialogue" },
  { pattern: /\/cameras?\//i, type: "camera" },
  { pattern: /\/scripts?\//i, type: "script" },
  { pattern: /\/functions?\//i, type: "function" },
  { pattern: /\/structures?\//i, type: "structure" },

  // Resource pack content
  { pattern: /\/animations?\//i, type: "animation" },
  { pattern: /\/animation_controllers?\//i, type: "animation_controller" },
  { pattern: /\/render_controllers?\//i, type: "render_controller" },
  { pattern: /\/attachables?\//i, type: "attachable" },
  { pattern: /\/particles?\//i, type: "particle" },
  { pattern: /\/fogs?\//i, type: "fog" },
  { pattern: /\/models?\//i, type: "model" },
  { pattern: /\/textures?\//i, type: "texture" },
  { pattern: /\/sounds?\//i, type: "sound" },

  // Special files
  { pattern: /manifest\.json$/i, type: "manifest" },
];

/**
 * Utilities for analyzing Minecraft content paths
 */
export class MinecraftPathUtils {
  /**
   * Check if a path is likely Minecraft content
   *
   * @param path - File path to check (can use / or \ separators)
   * @returns true if the path appears to be Minecraft content
   */
  public static isMinecraftContentPath(path: string): boolean {
    const normalizedPath = this.normalizePath(path);
    return (
      this.matchesAnyPattern(normalizedPath, BEHAVIOR_PACK_PATTERNS) ||
      this.matchesAnyPattern(normalizedPath, RESOURCE_PACK_PATTERNS) ||
      this.matchesAnyPattern(normalizedPath, SKIN_PACK_PATTERNS) ||
      this.matchesAnyPattern(normalizedPath, WORLD_TEMPLATE_PATTERNS) ||
      // Also check for common Minecraft content patterns even without pack folder
      /\/(entities|blocks|items|recipes|loot_tables|spawn_rules)\//i.test(normalizedPath)
    );
  }

  /**
   * Check if a path is within a behavior pack
   */
  public static isBehaviorPackPath(path: string): boolean {
    return this.matchesAnyPattern(this.normalizePath(path), BEHAVIOR_PACK_PATTERNS);
  }

  /**
   * Check if a path is within a resource pack
   */
  public static isResourcePackPath(path: string): boolean {
    return this.matchesAnyPattern(this.normalizePath(path), RESOURCE_PACK_PATTERNS);
  }

  /**
   * Get the pack type from a path
   */
  public static getPackType(path: string): PackType {
    const normalizedPath = this.normalizePath(path);

    if (this.matchesAnyPattern(normalizedPath, BEHAVIOR_PACK_PATTERNS)) {
      return "behavior";
    }
    if (this.matchesAnyPattern(normalizedPath, RESOURCE_PACK_PATTERNS)) {
      return "resource";
    }
    if (this.matchesAnyPattern(normalizedPath, SKIN_PACK_PATTERNS)) {
      return "skin";
    }
    if (this.matchesAnyPattern(normalizedPath, WORLD_TEMPLATE_PATTERNS)) {
      return "world_template";
    }

    return "unknown";
  }

  /**
   * Get the content type from a path
   */
  public static getContentType(path: string): ContentType {
    const normalizedPath = this.normalizePath(path);

    for (const { pattern, type } of CONTENT_TYPE_PATTERNS) {
      if (pattern.test(normalizedPath)) {
        return type;
      }
    }

    return "unknown";
  }

  /**
   * Get comprehensive path analysis
   */
  public static analyzePath(path: string): IPathAnalysis {
    const normalizedPath = this.normalizePath(path);
    const isMinecraft = this.isMinecraftContentPath(normalizedPath);

    if (!isMinecraft) {
      return {
        isMinecraft: false,
        packType: "unknown",
        contentType: "unknown",
      };
    }

    const packType = this.getPackType(normalizedPath);
    const contentType = this.getContentType(normalizedPath);

    // Extract identifier from filename
    let identifier: string | undefined;
    const filenameMatch = normalizedPath.match(/\/([^/]+?)(?:\.[^.]+)?$/);
    if (filenameMatch) {
      identifier = filenameMatch[1];
      // Remove common suffixes
      identifier = identifier.replace(/\.(behavior|resource|client|server)$/i, "");
    }

    return {
      isMinecraft,
      packType,
      contentType,
      identifier,
    };
  }

  /**
   * Check if a JSON file should have Minecraft-aware editing features
   */
  public static shouldProvideMinecraftFeatures(path: string, languageId?: string): boolean {
    // Must be JSON (or inferred from .json extension)
    if (languageId && languageId !== "json" && languageId !== "jsonc") {
      return false;
    }

    if (!path.toLowerCase().endsWith(".json")) {
      return false;
    }

    return this.isMinecraftContentPath(path);
  }

  /**
   * Normalize path separators to forward slashes
   */
  private static normalizePath(path: string): string {
    return path.replace(/\\/g, "/");
  }

  /**
   * Check if path matches any of the given patterns
   */
  private static matchesAnyPattern(path: string, patterns: RegExp[]): boolean {
    return patterns.some((pattern) => pattern.test(path));
  }

  /**
   * Get the file extension from a path (lowercase, without dot)
   */
  public static getExtension(path: string): string {
    const match = path.match(/\.([^.]+)$/);
    return match ? match[1].toLowerCase() : "";
  }

  /**
   * Check if path is a script file (JS/TS)
   */
  public static isScriptFile(path: string): boolean {
    const ext = this.getExtension(path);
    return ext === "js" || ext === "ts";
  }

  /**
   * Check if path is a function file (.mcfunction)
   */
  public static isFunctionFile(path: string): boolean {
    return this.getExtension(path) === "mcfunction";
  }

  /**
   * Check if path is a structure file (.mcstructure)
   */
  public static isStructureFile(path: string): boolean {
    return this.getExtension(path) === "mcstructure";
  }
}
