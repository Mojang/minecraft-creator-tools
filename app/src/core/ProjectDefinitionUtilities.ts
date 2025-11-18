import Database from "../minecraft/Database";

export class ProjectDefinitionUtilities {
  static getVanillaBlockTexture(blockId: string, side: string) {
    if (!Database.blocksCatalog || !Database.terrainTextureCatalog || !Database.vanillaCatalog) {
      return undefined;
    }

    let blockType = Database.ensureBlockType(blockId);

    if (!blockType) {
      return undefined;
    }

    const blockDef = Database.blocksCatalog.getBlockDefinition(blockType.id);

    if (!blockDef || !blockDef.textures) {
      return undefined;
    }

    let textureOrId = blockDef.textures;

    if (typeof textureOrId === "object") {
      textureOrId = (textureOrId as any)[side];
    }

    if (!textureOrId || typeof textureOrId !== "string") {
      return undefined;
    }

    const texture = Database.terrainTextureCatalog.getTerrainTextureDefinition(textureOrId);

    if (!texture) {
      return undefined;
    }

    if (typeof texture.textures === "string") {
      return texture.textures;
    }

    return texture.textures?.[0];
  }
}
