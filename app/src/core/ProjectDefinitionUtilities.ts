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

  static getVanillaBlockTexture(blockType: BlockType, side: string): string | undefined {
    if (!Database.blocksCatalog || !Database.terrainTextureCatalog || !Database.vanillaCatalog) {
      return undefined;
    }

    const blockDef = blockType.catalogResource;

    if (!blockDef) {
      return undefined;
    }

    // Prefer carried_textures over textures for visual rendering
    let textureSource = (blockDef as any).carried_textures || blockDef.textures;

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

    const texture = Database.terrainTextureCatalog.getTerrainTextureDefinition(textureOrId);

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
}
