// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import Database from "../minecraft/Database";
import BlockType from "../minecraft/BlockType";

export class ProjectDefinitionUtilities {
  static getVanillaBlockTextureById(blockId: string, side: string) {
    let blockType = Database.ensureBlockType(blockId);

    if (!blockType) {
      return undefined;
    }

    return ProjectDefinitionUtilities.getVanillaBlockTexture(blockType, side);
  }

  static getVanillaBlockTexture(blockType: BlockType, side: string, useCarried: boolean = true): string | undefined {
    // Vanilla catalogs are required for vanilla block lookups; for project /
    // world custom blocks we still need at least one of the custom catalogs.
    const hasVanilla = !!Database.blocksCatalog && !!Database.terrainTextureCatalog && !!Database.vanillaCatalog;
    const hasCustom =
      Object.keys(Database.customBlocksCatalog).length > 0 ||
      Object.keys(Database.customTerrainTextureCatalog).length > 0;
    if (!hasVanilla && !hasCustom) {
      return undefined;
    }

    const blockDef = blockType.catalogResource;

    if (!blockDef) {
      return undefined;
    }

    // carried_textures are for inventory/hand display — pre-tinted, often without alpha.
    // For in-world rendering (useCarried=false), use standard textures which have alpha
    // cutout holes for leaves/vines and are designed for biome tinting.
    // Leaf carried_textures (e.g., leaves_oak_carried) are solid grayscale without alpha
    // holes, causing leaves to render as opaque cubes instead of cutout foliage.
    let textureSource: any;
    if (useCarried && (blockDef as any).carried_textures) {
      textureSource = (blockDef as any).carried_textures;
    } else {
      textureSource = blockDef.textures;
    }

    if (!textureSource) {
      return undefined;
    }

    let textureOrId = textureSource;

    if (typeof textureOrId === "object") {
      textureOrId = (textureOrId as any)[side];
    }

    if (!textureOrId || typeof textureOrId !== "string") {
      return undefined;
    }

    // Prefer custom terrain_texture.json entries (project / world RP) over
    // vanilla so custom blocks that reuse a vanilla texture id can override it.
    let texture: any = Database.customTerrainTextureCatalog[textureOrId];
    if (!texture && Database.terrainTextureCatalog) {
      texture = Database.terrainTextureCatalog.getTerrainTextureDefinition(textureOrId);
    }

    if (!texture || !texture.textures) {
      return undefined;
    }

    // Handle direct string path
    if (typeof texture.textures === "string") {
      return texture.textures;
    }

    // Handle array of textures
    if (Array.isArray(texture.textures) && texture.textures.length > 0) {
      let tex = texture.textures[0];

      if (typeof tex === "string") {
        return tex;
      }

      if (tex && typeof tex === "object" && tex.path) {
        return tex.path;
      }
    }

    // Handle object with path property (e.g., {"path": "...", "overlay_color": "..."})
    if (typeof texture.textures === "object" && !Array.isArray(texture.textures)) {
      if ((texture.textures as any).path) {
        return (texture.textures as any).path;
      }
    }

    return undefined;
  }

  /**
   * Returns both the texture path and the overlay_color (if present) from terrain_texture.json.
   * Blocks like grass use overlay_color to tint the grayscale side texture with a biome color.
   */
  static getVanillaBlockTextureWithOverlay(
    blockType: BlockType,
    side: string,
    useCarried: boolean = true
  ): { path: string; overlayColor?: string } | undefined {
    const hasVanilla = !!Database.blocksCatalog && !!Database.terrainTextureCatalog && !!Database.vanillaCatalog;
    const hasCustom =
      Object.keys(Database.customBlocksCatalog).length > 0 ||
      Object.keys(Database.customTerrainTextureCatalog).length > 0;
    if (!hasVanilla && !hasCustom) {
      return undefined;
    }

    const blockDef = blockType.catalogResource;
    if (!blockDef) return undefined;

    let textureSource: any;
    if (useCarried && (blockDef as any).carried_textures) {
      textureSource = (blockDef as any).carried_textures;
    } else {
      textureSource = blockDef.textures;
    }

    if (!textureSource) return undefined;

    let textureOrId = textureSource;
    if (typeof textureOrId === "object") {
      textureOrId = (textureOrId as any)[side];
    }

    if (!textureOrId || typeof textureOrId !== "string") return undefined;

    let texture: any = Database.customTerrainTextureCatalog[textureOrId];
    if (!texture && Database.terrainTextureCatalog) {
      texture = Database.terrainTextureCatalog.getTerrainTextureDefinition(textureOrId);
    }
    if (!texture || !texture.textures) return undefined;

    if (typeof texture.textures === "string") {
      return { path: texture.textures };
    }

    if (Array.isArray(texture.textures) && texture.textures.length > 0) {
      const tex = texture.textures[0];
      if (typeof tex === "string") return { path: tex };
      if (tex && typeof tex === "object" && tex.path) {
        return { path: tex.path, overlayColor: tex.overlay_color };
      }
    }

    if (typeof texture.textures === "object" && !Array.isArray(texture.textures)) {
      const texObj = texture.textures as any;
      if (texObj.path) {
        return { path: texObj.path, overlayColor: texObj.overlay_color };
      }
    }

    return undefined;
  }
}
