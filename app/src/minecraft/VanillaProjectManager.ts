import Database from "./Database";
import ItemTextureCatalogDefinition from "./ItemTextureCatalogDefinition";
import SoundDefinitionCatalogDefinition from "./SoundDefinitionCatalogDefinition";
import BlocksCatalogDefinition from "./BlocksCatalogDefinition";
import TerrainTextureCatalogDefinition from "./TerrainTextureCatalogDefinition";

export default class VanillaProjectManager {
  static blocksCatalog: BlocksCatalogDefinition | null = null;
  static itemTextureCatalog: ItemTextureCatalogDefinition | null = null;
  static terrainTextureCatalog: TerrainTextureCatalogDefinition | null = null;
  static soundDefinitionCatalog: SoundDefinitionCatalogDefinition | null = null;

  static getBlocksCatalogDirect() {
    return this.blocksCatalog;
  }

  static async getBlocksCatalog() {
    if (!VanillaProjectManager.blocksCatalog) {
      const file = await Database.getPreviewVanillaFile("/resource_pack/blocks.json");

      if (file) {
        const blockCat = new BlocksCatalogDefinition();
        blockCat.file = file;

        await blockCat.load();

        this.blocksCatalog = blockCat;
      }
    }

    return this.blocksCatalog;
  }

  static getTerrainTexturesCatalogDirect() {
    return this.terrainTextureCatalog;
  }

  static async getTerrainTexturesCatalog() {
    if (!VanillaProjectManager.terrainTextureCatalog) {
      const file = await Database.getPreviewVanillaFile("/resource_pack/textures/terrain_texture.json");

      if (file) {
        const terrainCat = new TerrainTextureCatalogDefinition();
        terrainCat.file = file;

        await terrainCat.load();

        VanillaProjectManager.terrainTextureCatalog = terrainCat;
      }
    }

    return VanillaProjectManager.terrainTextureCatalog;
  }

  static async getItemTexturesCatalog() {
    if (!VanillaProjectManager.itemTextureCatalog) {
      const file = await Database.getPreviewVanillaFile("/resource_pack/textures/item_texture.json");

      if (file) {
        const itemCat = new ItemTextureCatalogDefinition();
        itemCat.file = file;

        await itemCat.load();

        VanillaProjectManager.itemTextureCatalog = itemCat;
      }
    }

    return VanillaProjectManager.itemTextureCatalog;
  }

  static async getSoundDefinitionCatalog() {
    if (!VanillaProjectManager.soundDefinitionCatalog) {
      const file = await Database.getPreviewVanillaFile("/resource_pack/sounds/sound_definitions.json");

      if (file) {
        const soundDefinitionCat = new SoundDefinitionCatalogDefinition();
        soundDefinitionCat.file = file;

        await soundDefinitionCat.load();

        VanillaProjectManager.soundDefinitionCatalog = soundDefinitionCat;
      }
    }

    return VanillaProjectManager.soundDefinitionCatalog;
  }
}
