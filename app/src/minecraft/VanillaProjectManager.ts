import Database from "./Database";
import ItemTextureCatalogDefinition from "./ItemTextureCatalogDefinition";
import SoundDefinitionCatalogDefinition from "./SoundDefinitionCatalogDefinition";
import BlocksCatalogDefinition from "./BlocksCatalogDefinition";
import TerrainTextureCatalogDefinition from "./TerrainTextureCatalogDefinition";
import EntityTypeResourceDefinition from "./EntityTypeResourceDefinition";
import ModelGeometryDefinition from "./ModelGeometryDefinition";
import { IGeometry } from "./IModelGeometry";

export interface IVanillaEntityModelData {
  entityTypeId: string;
  geometryId?: string;
  texturePath?: string;
  textureUrl?: string;
  geometry?: IGeometry;
  textureData?: Uint8Array;
  modelDefinition?: ModelGeometryDefinition;
}

export default class VanillaProjectManager {
  static blocksCatalog: BlocksCatalogDefinition | null = null;
  static itemTextureCatalog: ItemTextureCatalogDefinition | null = null;
  static terrainTextureCatalog: TerrainTextureCatalogDefinition | null = null;
  static soundDefinitionCatalog: SoundDefinitionCatalogDefinition | null = null;

  // Cache for entity resource definitions
  private static _entityResourceCache: Map<string, EntityTypeResourceDefinition> = new Map();
  private static _entityModelDataCache: Map<string, IVanillaEntityModelData> = new Map();

  /**
   * Get a list of all vanilla entity type IDs
   */
  static async getVanillaEntityTypeIds(): Promise<string[]> {
    const vanillaFolder = await Database.getPreviewVanillaFolder();
    if (!vanillaFolder) return [];

    const entityFolder = await vanillaFolder.getFolderFromRelativePath("/resource_pack/entity/");
    if (!entityFolder) return [];

    await entityFolder.load();

    const entityIds: string[] = [];
    for (const fileName in entityFolder.files) {
      if (
        fileName.endsWith(".entity.json") &&
        !fileName.includes("v1.0") &&
        !fileName.includes(".v2.") &&
        !fileName.includes(".v3.") &&
        !fileName.includes("_v1.") &&
        !fileName.includes("_v2.") &&
        !fileName.includes("_v3.")
      ) {
        const entityId = fileName.replace(".entity.json", "");
        entityIds.push(entityId);
      }
    }

    entityIds.sort();
    return entityIds;
  }

  /**
   * Get entity resource definition for a vanilla entity by type ID
   */
  static async getVanillaEntityResource(typeId: string): Promise<EntityTypeResourceDefinition | null> {
    // Remove minecraft: prefix if present
    const shortId = typeId.replace("minecraft:", "");

    // Check cache first
    if (this._entityResourceCache.has(shortId)) {
      return this._entityResourceCache.get(shortId) || null;
    }

    const file = await Database.getPreviewVanillaFile(`/resource_pack/entity/${shortId}.entity.json`);
    if (!file) return null;

    const etrd = await EntityTypeResourceDefinition.ensureOnFile(file);
    if (etrd) {
      this._entityResourceCache.set(shortId, etrd);
      return etrd;
    }

    return null;
  }

  /**
   * Get complete model data for a vanilla entity, including geometry and texture
   */
  static async getVanillaEntityModelData(typeId: string): Promise<IVanillaEntityModelData | null> {
    const shortId = typeId.replace("minecraft:", "");

    // Check cache first
    if (this._entityModelDataCache.has(shortId)) {
      const cached = this._entityModelDataCache.get(shortId) || null;
      // If cached but missing texture, try reloading
      if (cached && !cached.textureData) {
        this._entityModelDataCache.delete(shortId);
      } else {
        return cached;
      }
    }

    const entityResource = await this.getVanillaEntityResource(shortId);
    if (!entityResource) {
      console.warn(`No entity resource found for: ${shortId}`);
      return null;
    }

    const modelData: IVanillaEntityModelData = {
      entityTypeId: shortId,
    };

    // Get geometry ID
    const geometryList = entityResource.geometryList;
    if (geometryList && geometryList.length > 0) {
      modelData.geometryId = geometryList[0];

      // Load geometry file
      const geometry = await this._loadVanillaGeometry(modelData.geometryId);
      if (geometry) {
        modelData.geometry = geometry.geometry;
        modelData.modelDefinition = geometry.definition;
      } else {
        console.warn(`Failed to load geometry for ${shortId}:`, modelData.geometryId);
      }
    }

    // Get texture path - prefer "default" texture if available, otherwise use first texture
    // Use raw textures to preserve case sensitivity (canonicalized list lowercases paths)
    const textures = entityResource.textures;
    if (textures) {
      // Prefer "default" texture, otherwise use first available
      let texturePath: string | undefined;
      if (textures["default"]) {
        texturePath = textures["default"];
      } else {
        // Get first texture value
        const keys = Object.keys(textures);
        if (keys.length > 0) {
          texturePath = textures[keys[0]];
        }
      }

      if (texturePath) {
        // Remove file extension if present
        if (texturePath.endsWith(".png") || texturePath.endsWith(".tga")) {
          texturePath = texturePath.substring(0, texturePath.lastIndexOf("."));
        }

        modelData.texturePath = texturePath;

        // Set texture URL - use serve folder which has PNG versions
        // The URL is relative to the public folder and will be served at runtime
        modelData.textureUrl = `/res/latest/van/serve/resource_pack/${modelData.texturePath}.png`;

        // Also try to load texture data for entities that may have it available
        // (this is a fallback for entities whose textures are already PNG in preview)
        const textureData = await this._loadVanillaTexture(modelData.texturePath);
        if (textureData) {
          modelData.textureData = textureData;
        }
      }
    }

    // Cache the result
    this._entityModelDataCache.set(shortId, modelData);

    return modelData;
  }

  private static async _loadVanillaGeometry(
    geometryId: string
  ): Promise<{ geometry: IGeometry; definition: ModelGeometryDefinition } | null> {
    // Parse geometry ID to find the file
    // Format is typically "geometry.mob_name" or "geometry.mob_name.variant"
    const parts = geometryId.split(".");
    if (parts.length < 2) return null;

    const baseName = parts[1]; // e.g., "pig" from "geometry.pig" or "tropicalfish_a" from "geometry.tropicalfish_a"

    // Generate possible file names to try
    // Some entities use underscores in file names but not in geometry IDs, or vice versa
    const baseNameWithUnderscore = this._addUnderscoreBeforeLastPart(baseName);
    const baseNameWithoutSuffix = baseName.replace(/_[a-z]$/, ""); // Remove _a, _b suffixes
    const baseNameWithUnderscoreNoSuffix = this._addUnderscoreBeforeLastPart(baseNameWithoutSuffix);

    const possibleBaseNames = [baseName, baseNameWithUnderscore, baseNameWithoutSuffix, baseNameWithUnderscoreNoSuffix];

    // Remove duplicates
    const uniqueBaseNames = [...new Set(possibleBaseNames)];

    const possibleFiles: string[] = [];
    for (const name of uniqueBaseNames) {
      possibleFiles.push(`${name}.geo.json`);
      possibleFiles.push(`${name}.v3.geo.json`);
      possibleFiles.push(`${name}.v2.geo.json`);
    }

    for (const fileName of possibleFiles) {
      const file = await Database.getPreviewVanillaFile(`/resource_pack/models/entity/${fileName}`);
      if (file) {
        const geoDef = await ModelGeometryDefinition.ensureOnFile(file);
        if (geoDef) {
          // First try to find the exact geometry ID
          const exactGeometry = geoDef.getById(geometryId);
          if (exactGeometry) {
            return { geometry: exactGeometry, definition: geoDef };
          }
          // Fall back to default geometry
          if (geoDef.defaultGeometry) {
            return { geometry: geoDef.defaultGeometry, definition: geoDef };
          }
        }
      }
    }

    return null;
  }

  /**
   * Adds an underscore before the last "word" in a name.
   * e.g., "tropicalfish" -> "tropical_fish", "tropicalfish_a" -> "tropical_fish_a"
   */
  private static _addUnderscoreBeforeLastPart(name: string): string {
    // Common suffixes that indicate a word boundary
    const commonWords = [
      "fish",
      "spawner",
      "golem",
      "spider",
      "skeleton",
      "zombie",
      "creeper",
      "slime",
      "cube",
      "guardian",
      "shulker",
      "villager",
      "illager",
      "pillager",
      "witch",
      "horse",
      "donkey",
      "mule",
      "llama",
      "wolf",
      "cat",
      "ocelot",
      "fox",
      "panda",
      "bee",
      "hoglin",
      "piglin",
      "strider",
      "axolotl",
      "goat",
      "frog",
      "warden",
      "sniffer",
      "camel",
      "breeze",
      "bogged",
      "armadillo",
    ];

    for (const word of commonWords) {
      const index = name.indexOf(word);
      if (index > 0 && name[index - 1] !== "_") {
        return name.substring(0, index) + "_" + name.substring(index);
      }
    }
    return name;
  }

  private static async _loadVanillaTexture(texturePath: string): Promise<Uint8Array | null> {
    // texturePath is like "textures/entity/pig/pig"
    // Use serve folder which has PNG versions of all textures (including those that are TGA in preview/release)
    const vanillaFolder = await Database.getServeVanillaFolder();
    if (!vanillaFolder) {
      console.warn("Could not get serve vanilla folder");
      return null;
    }

    const fullPath = `/resource_pack/${texturePath}.png`;

    const file = await vanillaFolder.getFileFromRelativePath(fullPath);
    if (!file) {
      console.warn(`File not found: ${fullPath}`);
      // Try to list the directory to see what's there
      const dirPath = `/resource_pack/${texturePath.substring(0, texturePath.lastIndexOf("/"))}`;
      return null;
    }

    await file.loadContent();

    if (file.content instanceof Uint8Array) {
      return file.content;
    }

    console.warn(`File content is not Uint8Array:`, typeof file.content);
    return null;
  }

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
