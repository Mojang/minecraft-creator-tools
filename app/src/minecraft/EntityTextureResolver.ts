// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * EntityTextureResolver
 *
 * Shared utilities for resolving entity textures from various sources:
 * - Project items (custom content)
 * - Vanilla resources (Database/VanillaProjectManager)
 * - Direct file paths
 * - URLs
 *
 * This centralizes texture resolution logic that was previously duplicated
 * across ModelViewer, MobViewer, CLI rendering, and MCP server.
 *
 * TEXTURE RESOLUTION ORDER:
 * -------------------------
 * 1. Explicit texture data (Uint8Array) if provided
 * 2. Project item lookup (for custom content)
 * 3. Entity resource definition (client_entity -> textures map)
 * 4. Vanilla resources (built-in Minecraft textures)
 * 5. Fallback path construction
 *
 * TEXTURE PATH FORMATS:
 * ---------------------
 * Minecraft uses several path formats:
 * - "textures/entity/pig/pig" (resource pack relative, no extension)
 * - "textures/entity/pig/pig.png" (with extension)
 * - Full paths for custom content
 *
 * Last Updated: December 2025
 */

import { IGeometry } from "./IModelGeometry";
import ModelGeometryDefinition from "./ModelGeometryDefinition";
import EntityTypeResourceDefinition from "./EntityTypeResourceDefinition";
import VanillaProjectManager from "./VanillaProjectManager";
import Project from "../app/Project";
import ProjectItem from "../app/ProjectItem";
import ProjectItemUtilities from "../app/ProjectItemUtilities";
import { ProjectItemType } from "../app/IProjectItemData";
import IFile from "../storage/IFile";
import Log from "../core/Log";

/**
 * Result of resolving an entity's textures and geometry
 */
export interface IResolvedEntityAssets {
  /** The geometry definition */
  geometry?: IGeometry;

  /** The model definition container */
  modelDefinition?: ModelGeometryDefinition;

  /** Geometry ID used */
  geometryId?: string;

  /** Resolved texture path (without extension) */
  texturePath?: string;

  /** Full URL to texture (for web loading) */
  textureUrl?: string;

  /** Texture image data as bytes */
  textureData?: Uint8Array;

  /** Texture dimensions from geometry description */
  textureWidth?: number;

  /** Texture dimensions from geometry description */
  textureHeight?: number;

  /** Source of the resolved assets */
  source: "project" | "vanilla" | "url" | "data" | "none";

  /** Any warnings or errors during resolution */
  warnings?: string[];
}

/**
 * Options for asset resolution
 */
export interface IEntityAssetResolveOptions {
  /** Entity type ID (e.g., "pig" or "minecraft:pig") */
  entityTypeId?: string;

  /** Specific geometry ID to use */
  geometryId?: string;

  /** Variant key for entities with multiple textures (e.g., "default", "warm") */
  variantKey?: string;

  /** Direct geometry definition */
  geometry?: IGeometry;

  /** Direct model definition */
  modelDefinition?: ModelGeometryDefinition;

  /** Direct texture data */
  textureData?: Uint8Array;

  /** Direct texture URL */
  textureUrl?: string;

  /** Project to search for custom content */
  project?: Project;

  /** Whether to skip vanilla resource lookup */
  skipVanilla?: boolean;
}

export default class EntityTextureResolver {
  /**
   * Resolve all assets (geometry + texture) for an entity.
   * This is the main entry point for asset resolution.
   */
  static async resolveEntityAssets(options: IEntityAssetResolveOptions): Promise<IResolvedEntityAssets> {
    const result: IResolvedEntityAssets = {
      source: "none",
      warnings: [],
    };

    // If direct data is provided, use it
    if (options.geometry) {
      result.geometry = options.geometry;
      result.source = "data";
    }

    if (options.modelDefinition) {
      result.modelDefinition = options.modelDefinition;
      if (!result.geometry && options.modelDefinition.defaultGeometry) {
        result.geometry = options.modelDefinition.defaultGeometry;
      }
      result.source = "data";
    }

    if (options.textureData) {
      result.textureData = options.textureData;
      result.source = "data";
    }

    if (options.textureUrl) {
      result.textureUrl = options.textureUrl;
      result.source = result.source === "none" ? "url" : result.source;
    }

    // If we have all we need from direct data, extract dimensions and return
    if (result.geometry && (result.textureData || result.textureUrl)) {
      this._extractTextureDimensions(result);
      return result;
    }

    // Try project lookup if entityTypeId is provided and project is available
    if (options.entityTypeId && options.project && !options.skipVanilla) {
      const projectAssets = await this._resolveFromProject(
        options.entityTypeId,
        options.project,
        options.geometryId,
        options.variantKey
      );

      if (projectAssets.geometry) {
        result.geometry = projectAssets.geometry;
        result.modelDefinition = projectAssets.modelDefinition;
        result.geometryId = projectAssets.geometryId;
        result.source = "project";
      }

      if (projectAssets.textureData) {
        result.textureData = projectAssets.textureData;
        result.texturePath = projectAssets.texturePath;
      } else if (projectAssets.textureUrl) {
        result.textureUrl = projectAssets.textureUrl;
        result.texturePath = projectAssets.texturePath;
      }
    }

    // Fall back to vanilla lookup if needed
    if (options.entityTypeId && !options.skipVanilla && (!result.geometry || !result.textureData)) {
      const vanillaAssets = await this._resolveFromVanilla(
        options.entityTypeId,
        options.geometryId,
        options.variantKey
      );

      if (!result.geometry && vanillaAssets.geometry) {
        result.geometry = vanillaAssets.geometry;
        result.modelDefinition = vanillaAssets.modelDefinition;
        result.geometryId = vanillaAssets.geometryId;
        result.source = "vanilla";
      }

      if (!result.textureData && !result.textureUrl) {
        if (vanillaAssets.textureData) {
          result.textureData = vanillaAssets.textureData;
        } else if (vanillaAssets.textureUrl) {
          result.textureUrl = vanillaAssets.textureUrl;
        }
        result.texturePath = vanillaAssets.texturePath;
      }
    }

    // Extract texture dimensions from geometry
    this._extractTextureDimensions(result);

    return result;
  }

  /**
   * Resolve texture from a project item.
   * Finds the related texture file for a model or entity definition.
   */
  static async resolveTextureForProjectItem(
    projectItem: ProjectItem,
    project?: Project
  ): Promise<{ textureData?: Uint8Array; texturePath?: string }> {
    const result: { textureData?: Uint8Array; texturePath?: string } = {};

    // Try to find a cousin texture item
    const textureItem = ProjectItemUtilities.getCousinOfType(projectItem, ProjectItemType.texture);

    if (textureItem) {
      if (!textureItem.isContentLoaded) {
        await textureItem.loadContent();
      }

      const textureFile = textureItem.primaryFile;
      if (textureFile) {
        if (!textureFile.isContentLoaded) {
          await textureFile.loadContent();
        }
        if (textureFile.content instanceof Uint8Array) {
          result.textureData = textureFile.content;
          result.texturePath = textureItem.projectPath ?? undefined;
        }
      }
    }

    return result;
  }

  /**
   * Load texture data from a URL.
   */
  static async loadTextureFromUrl(url: string): Promise<Uint8Array | null> {
    try {
      const response = await fetch(url);
      if (response.ok) {
        const buffer = await response.arrayBuffer();
        return new Uint8Array(buffer);
      }
    } catch (error) {
      Log.debug(`Failed to load texture from URL ${url}: ${error}`);
    }
    return null;
  }

  /**
   * Load texture data from a file.
   */
  static async loadTextureFromFile(file: IFile): Promise<Uint8Array | null> {
    try {
      if (!file.isContentLoaded) {
        await file.loadContent();
      }
      if (file.content instanceof Uint8Array) {
        return file.content;
      }
    } catch (error) {
      Log.debug(`Failed to load texture from file: ${error}`);
    }
    return null;
  }

  /**
   * Canonicalize a texture path by removing extensions and normalizing slashes.
   */
  static canonicalizeTexturePath(path: string): string {
    // Remove .png, .tga extensions
    let normalized = path;
    if (normalized.endsWith(".png") || normalized.endsWith(".tga")) {
      normalized = normalized.substring(0, normalized.lastIndexOf("."));
    }

    // Normalize slashes
    normalized = normalized.replace(/\\/g, "/");

    // Ensure it starts with textures/ if it's a relative path
    if (!normalized.startsWith("/") && !normalized.startsWith("textures/")) {
      normalized = "textures/" + normalized;
    }

    return normalized;
  }

  /**
   * Build a URL for a vanilla texture path.
   */
  static buildVanillaTextureUrl(texturePath: string): string {
    const canonical = this.canonicalizeTexturePath(texturePath);
    return `/res/latest/van/serve/resource_pack/${canonical}.png`;
  }

  /**
   * Resolve assets from a project.
   */
  private static async _resolveFromProject(
    entityTypeId: string,
    project: Project,
    geometryId?: string,
    variantKey?: string
  ): Promise<Partial<IResolvedEntityAssets>> {
    const result: Partial<IResolvedEntityAssets> = {};

    // Normalize entity ID
    const shortId = entityTypeId.replace("minecraft:", "");

    // Find entity resource definition in project
    const entityItems = project.getItemsByType(ProjectItemType.entityTypeResource);

    for (const item of entityItems) {
      if (!item.isContentLoaded) {
        await item.loadContent();
      }

      if (item.primaryFile) {
        const etrd = await EntityTypeResourceDefinition.ensureOnFile(item.primaryFile);
        if (etrd && (etrd.id === entityTypeId || etrd.id === `minecraft:${shortId}` || etrd.id === shortId)) {
          // Found the entity - get geometry and texture
          const matched = etrd.getMatchedGeometryAndTexture(variantKey || "default");

          if (matched.geometryId) {
            result.geometryId = geometryId || matched.geometryId;

            // Find the geometry file in project
            const geoItem = await this._findGeometryInProject(project, result.geometryId);
            if (geoItem) {
              result.geometry = geoItem.geometry;
              result.modelDefinition = geoItem.definition;
            }
          }

          if (matched.texturePath) {
            result.texturePath = matched.texturePath;

            // Find the texture file in project
            const textureData = await this._findTextureInProject(project, matched.texturePath);
            if (textureData) {
              result.textureData = textureData;
            }
          }

          break;
        }
      }
    }

    return result;
  }

  /**
   * Find geometry in a project by geometry ID.
   */
  private static async _findGeometryInProject(
    project: Project,
    geometryId: string
  ): Promise<{ geometry: IGeometry; definition: ModelGeometryDefinition } | null> {
    const modelItems = project.getItemsByType(ProjectItemType.modelGeometryJson);

    for (const item of modelItems) {
      if (!item.isContentLoaded) {
        await item.loadContent();
      }

      if (item.primaryFile) {
        const modelDef = await ModelGeometryDefinition.ensureOnFile(item.primaryFile);
        if (modelDef) {
          const geometry = modelDef.getById(geometryId);
          if (geometry) {
            return { geometry, definition: modelDef };
          }
        }
      }
    }

    return null;
  }

  /**
   * Find texture in a project by texture path.
   */
  private static async _findTextureInProject(project: Project, texturePath: string): Promise<Uint8Array | null> {
    const canonical = this.canonicalizeTexturePath(texturePath);
    const textureItems = project.getItemsByType(ProjectItemType.texture);

    for (const item of textureItems) {
      if (item.projectPath && item.projectPath.includes(canonical)) {
        if (!item.isContentLoaded) {
          await item.loadContent();
        }

        if (item.primaryFile) {
          return this.loadTextureFromFile(item.primaryFile);
        }
      }
    }

    return null;
  }

  /**
   * Resolve assets from vanilla resources.
   */
  private static async _resolveFromVanilla(
    entityTypeId: string,
    geometryId?: string,
    variantKey?: string
  ): Promise<Partial<IResolvedEntityAssets>> {
    const modelData = await VanillaProjectManager.getVanillaEntityModelData(entityTypeId, variantKey || "default");

    if (!modelData) {
      return {};
    }

    const result: Partial<IResolvedEntityAssets> = {
      geometry: modelData.geometry,
      modelDefinition: modelData.modelDefinition,
      geometryId: geometryId || modelData.geometryId,
      texturePath: modelData.texturePath,
      textureData: modelData.textureData,
      textureUrl: modelData.textureUrl,
    };

    // If geometryId is specified and different from default, try to find it
    if (geometryId && geometryId !== modelData.geometryId && modelData.modelDefinition) {
      const specificGeometry = modelData.modelDefinition.getById(geometryId);
      if (specificGeometry) {
        result.geometry = specificGeometry;
        result.geometryId = geometryId;
      }
    }

    return result;
  }

  /**
   * Extract texture dimensions from geometry description.
   */
  private static _extractTextureDimensions(result: IResolvedEntityAssets): void {
    if (!result.geometry) return;

    const desc = result.geometry.description;
    if (desc) {
      result.textureWidth = desc.texture_width;
      result.textureHeight = desc.texture_height;
    } else {
      // Try legacy properties
      result.textureWidth = result.geometry.texturewidth;
      result.textureHeight = result.geometry.textureheight;
    }

    // Defaults
    if (!result.textureWidth) result.textureWidth = 64;
    if (!result.textureHeight) result.textureHeight = 64;
  }
}
