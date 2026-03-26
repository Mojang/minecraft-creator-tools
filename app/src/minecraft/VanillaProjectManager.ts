import Database from "./Database";
import ItemTextureCatalogDefinition from "./ItemTextureCatalogDefinition";
import SoundDefinitionCatalogDefinition from "./SoundDefinitionCatalogDefinition";
import BlocksCatalogDefinition from "./BlocksCatalogDefinition";
import TerrainTextureCatalogDefinition from "./TerrainTextureCatalogDefinition";
import EntityTypeResourceDefinition from "./EntityTypeResourceDefinition";
import AttachableResourceDefinition from "./AttachableResourceDefinition";
import ModelGeometryDefinition from "./ModelGeometryDefinition";
import { IGeometry, IGeometryBone } from "./IModelGeometry";
import Log from "../core/Log";
import { applyGeometryTransforms } from "./VanillaGeometryTransforms";
import CreatorToolsHost from "../app/CreatorToolsHost";
import RenderControllerSetDefinition from "./RenderControllerSetDefinition";
import RenderControllerResolver from "./RenderControllerResolver";
import { createDefaultEntityContext } from "./IMolangContext";

export interface IVanillaEntityModelData {
  entityTypeId: string;
  geometryId?: string;
  texturePath?: string;
  textureUrl?: string;
  geometry?: IGeometry;
  textureData?: Uint8Array;
  modelDefinition?: ModelGeometryDefinition;
  /** Optional tint color for entities with colored overlays (e.g., sheep wool). RGBA 0-1 range. */
  tintColor?: { r: number; g: number; b: number; a: number };
  /** When true, render texture as fully opaque (ignore alpha channel). Used for entities
   *  whose textures have near-zero alpha body pixels designed for multi-layer overlay. */
  ignoreAlpha?: boolean;
}

export interface IVanillaAttachableModelData {
  attachableTypeId: string;
  geometryId?: string;
  texturePath?: string;
  textureUrl?: string;
  geometry?: IGeometry;
  textureData?: Uint8Array;
  modelDefinition?: ModelGeometryDefinition;
  /** Base humanoid geometry for armor attachables (Steve model) */
  baseGeometry?: IGeometry;
  baseModelDefinition?: ModelGeometryDefinition;
  baseTextureUrl?: string;
  baseTextureData?: Uint8Array;
}

export default class VanillaProjectManager {
  static blocksCatalog: BlocksCatalogDefinition | null = null;
  static itemTextureCatalog: ItemTextureCatalogDefinition | null = null;
  static terrainTextureCatalog: TerrainTextureCatalogDefinition | null = null;
  static soundDefinitionCatalog: SoundDefinitionCatalogDefinition | null = null;

  // Cache for entity resource definitions
  private static _entityResourceCache: Map<string, EntityTypeResourceDefinition> = new Map();
  private static _entityModelDataCache: Map<string, IVanillaEntityModelData> = new Map();

  // Cache for attachable resource definitions
  private static _attachableResourceCache: Map<string, AttachableResourceDefinition> = new Map();
  private static _attachableModelDataCache: Map<string, IVanillaAttachableModelData> = new Map();

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
   * Get complete model data for a vanilla entity, including geometry and texture.
   * Uses the "default" variant by default, ensuring geometry and texture are properly matched.
   * @param typeId - Entity type ID (e.g., "cow" or "minecraft:cow")
   * @param variantKey - Optional variant key (e.g., "default", "warm", "cold"). Defaults to "default".
   */
  static async getVanillaEntityModelData(
    typeId: string,
    variantKey: string = "default"
  ): Promise<IVanillaEntityModelData | null> {
    const shortId = typeId.replace("minecraft:", "");
    const cacheKey = `${shortId}_${variantKey}`;

    // Check cache first
    if (this._entityModelDataCache.has(cacheKey)) {
      const cached = this._entityModelDataCache.get(cacheKey) || null;
      // If cached but missing texture, try reloading
      if (cached && !cached.textureData && !cached.textureUrl) {
        this._entityModelDataCache.delete(cacheKey);
      } else {
        return cached;
      }
    }

    const entityResource = await this.getVanillaEntityResource(shortId);
    if (!entityResource) {
      // Not a vanilla entity, return null - this is expected for custom entities
      return null;
    }

    const modelData: IVanillaEntityModelData = {
      entityTypeId: shortId,
    };

    // Try render controller-based resolution first
    let rcResolved: { geometryId?: string; textureLayers: { texturePath: string; tintColor?: { r: number; g: number; b: number; a: number } }[] } | null = null;
    try {
      rcResolved = await this._resolveViaRenderController(shortId, entityResource);
    } catch {
      // Render controller resolution is optional — fall back to key-based matching
    }

    // Get geometry and texture — prefer render controller resolution, fall back to key-based matching
    let geometryId: string | undefined;
    let texturePath: string | undefined;

    if (rcResolved) {
      geometryId = rcResolved.geometryId;
      if (rcResolved.textureLayers.length > 0) {
        texturePath = rcResolved.textureLayers[0].texturePath;
        // Propagate tint color from first layer if present
        if (rcResolved.textureLayers[0].tintColor) {
          modelData.tintColor = rcResolved.textureLayers[0].tintColor;
        }
      }
    }

    // Fall back to variant-key matching if render controller didn't resolve
    if (!geometryId || !texturePath) {
      const matched = entityResource.getMatchedGeometryAndTexture(variantKey);
      if (!geometryId) geometryId = matched.geometryId;
      if (!texturePath) texturePath = matched.texturePath;
    }

    // For sheep, override to use "sheared" body geometry. The default woolly geometry
    // is a transparent overlay that requires multi-layer rendering (body + wool).
    // Until multi-layer is implemented, the sheared body is more recognizable.
    // Also disable alpha so the near-transparent body pixels become visible.
    const materials = entityResource.data?.materials;
    if (materials && materials["default"] === "sheep") {
      const shearedGeo = entityResource.data?.geometry?.["sheared"];
      if (shearedGeo) {
        geometryId = shearedGeo;
      }
      // The sheep texture has body colors at near-zero alpha (designed for multi-layer
      // overlay rendering). Setting ignoreAlpha makes those barely-visible pixels opaque.
      modelData.ignoreAlpha = true;
    }

    // Load geometry
    if (geometryId) {
      modelData.geometryId = geometryId;

      const geometry = await this._loadVanillaGeometry(geometryId);
      if (geometry) {
        // Apply VanillaGeometryTransforms to correct for Minecraft's hardcoded renderer quirks
        // (e.g., cow and sheep body bone rotation corrections)
        modelData.geometry = applyGeometryTransforms(geometry.geometry, geometryId);
        modelData.modelDefinition = geometry.definition;
      } else {
        Log.debugAlert(`Failed to load geometry for ${shortId}: ${geometryId}`);
      }
    }

    // Load texture - use the matched texture path to ensure it corresponds to the geometry
    if (texturePath) {
      // Remove file extension if present
      if (texturePath.endsWith(".png") || texturePath.endsWith(".tga")) {
        texturePath = texturePath.substring(0, texturePath.lastIndexOf("."));
      }

      modelData.texturePath = texturePath;

      // Set texture URL - use serve folder which has PNG versions
      // The URL is relative to the public folder and will be served at runtime
      modelData.textureUrl = CreatorToolsHost.contentWebRoot + `res/latest/van/serve/resource_pack/${texturePath}.png`;

      // Also try to load texture data for entities that may have it available
      const textureData = await this.loadVanillaTexture(texturePath);
      if (textureData) {
        modelData.textureData = textureData;
      }
    }

    // Cache the result
    this._entityModelDataCache.set(cacheKey, modelData);

    return modelData;
  }

  /**
   * Attempt to resolve an entity's geometry and texture via its render controller.
   * Falls back to null if no render controller is found or resolution fails.
   */
  private static async _resolveViaRenderController(
    shortId: string,
    entityResource: EntityTypeResourceDefinition
  ): Promise<{ geometryId?: string; textureLayers: { texturePath: string; tintColor?: { r: number; g: number; b: number; a: number } }[] } | null> {
    try {
      const rcIds = entityResource.renderControllerIdList;
      if (!rcIds || rcIds.length === 0) return null;

      const textureMap = entityResource.data?.textures;
      const geometryMap = entityResource.data?.geometry;
      if (!textureMap || !geometryMap) return null;

      const rcId = typeof rcIds[0] === "string" ? rcIds[0] : String(rcIds[0]);

      const rcDef = await this._loadVanillaRenderController(shortId, rcId);
      if (!rcDef) return null;

      const resolver = new RenderControllerResolver();
      const context = createDefaultEntityContext();

      const result = resolver.resolve(rcDef, textureMap, geometryMap, context);

      // Apply default tint for entities whose material assumes runtime color tinting.
      // Sheep's "sheep" material tints the white wool overlay to show wool color;
      // without a tint the wool is invisible (pure white).
      // Minecraft's white sheep wool color is #E7E7E7 (0.906), but the texture
      // itself is near-white, so we use a more visible warm gray for the preview.
      const materials = entityResource.data?.materials;
      if (materials) {
        const defaultMaterial = materials["default"];
        if (defaultMaterial === "sheep") {
          // For sheep, use the "sheared" (body) geometry instead of the woolly overlay.
          // The woolly geometry renders as a white overlay that requires multi-layer
          // rendering (body underneath + wool on top) which we don't yet support.
          // The sheared geometry maps to the visible body regions of the texture.
          if (geometryMap["sheared"]) {
            result.geometryId = geometryMap["sheared"];
          }
        }
      }

      return result;
    } catch (err) {
      Log.verbose(`Render controller resolution failed for ${shortId}: ${err}`);
      return null;
    }
  }

  /**
   * Load a vanilla render controller by its ID (e.g., "controller.render.sheep.v2").
   * Tries candidate filenames based on entity short ID via Database.getPreviewVanillaFile,
   * which uses the IFile/IFolder storage abstractions and works across web, Node.js, etc.
   */
  private static async _loadVanillaRenderController(
    entityShortId: string,
    controllerId: string
  ): Promise<import("./IRenderControllerSet").IRenderController | null> {
    const candidates = [
      `/resource_pack/render_controllers/${entityShortId}.render_controllers.json`,
      `/resource_pack/render_controllers/${entityShortId}.v2.render_controllers.json`,
      `/resource_pack/render_controllers/${entityShortId}.v3.render_controllers.json`,
      `/resource_pack/render_controllers/${entityShortId}.v4.render_controllers.json`,
    ];

    for (const filePath of candidates) {
      const file = await Database.getPreviewVanillaFile(filePath);
      if (file) {
        const rcSetDef = new RenderControllerSetDefinition();
        rcSetDef.file = file;
        await rcSetDef.load();

        const rcData = rcSetDef.data;
        if (rcData?.render_controllers) {
          const rc = rcData.render_controllers[controllerId];
          if (rc) return rc;
        }
      }
    }

    return null;
  }

  /**
   * Get a list of all vanilla attachable type IDs (items with 3D models like armor, bow, shield).
   * Filters out .player.json variants and index.json.
   */
  static async getVanillaAttachableTypeIds(): Promise<string[]> {
    const vanillaFolder = await Database.getPreviewVanillaFolder();
    if (!vanillaFolder) return [];

    const attachableFolder = await vanillaFolder.getFolderFromRelativePath("/resource_pack/attachables/");
    if (!attachableFolder) return [];

    await attachableFolder.load();

    const attachableIds: string[] = [];
    for (const fileName in attachableFolder.files) {
      // Skip player variants (e.g., diamond_chestplate.player.json) and index
      if (fileName.includes(".player.") || fileName === "index.json") {
        continue;
      }

      if (fileName.endsWith(".json")) {
        // Remove extensions: "bow.json" → "bow", "crossbow.entity.json" → "crossbow"
        let id = fileName.replace(".entity.json", "").replace(".json", "");
        attachableIds.push(id);
      }
    }

    attachableIds.sort();
    return attachableIds;
  }

  /**
   * Get attachable resource definition for a vanilla attachable by type ID.
   */
  static async getVanillaAttachableResource(typeId: string): Promise<AttachableResourceDefinition | null> {
    const shortId = typeId.replace("minecraft:", "");

    if (this._attachableResourceCache.has(shortId)) {
      return this._attachableResourceCache.get(shortId) || null;
    }

    // Try multiple file name patterns
    const possibleFiles = [`${shortId}.json`, `${shortId}.entity.json`];

    for (const fileName of possibleFiles) {
      const file = await Database.getPreviewVanillaFile(`/resource_pack/attachables/${fileName}`);
      if (file) {
        const ard = await AttachableResourceDefinition.ensureOnFile(file);
        if (ard) {
          this._attachableResourceCache.set(shortId, ard);
          return ard;
        }
      }
    }

    return null;
  }

  /**
   * Get complete model data for a vanilla attachable, including geometry and texture.
   * @param typeId - Attachable type ID (e.g., "diamond_chestplate" or "minecraft:diamond_chestplate")
   */
  static async getVanillaAttachableModelData(typeId: string): Promise<IVanillaAttachableModelData | null> {
    const shortId = typeId.replace("minecraft:", "");

    if (this._attachableModelDataCache.has(shortId)) {
      return this._attachableModelDataCache.get(shortId) || null;
    }

    const attachableResource = await this.getVanillaAttachableResource(shortId);
    if (!attachableResource) {
      return null;
    }

    const modelData: IVanillaAttachableModelData = {
      attachableTypeId: shortId,
    };

    // Get default geometry
    const geometry = attachableResource.geometry;
    if (geometry && geometry["default"]) {
      let geometryId = geometry["default"];
      modelData.geometryId = geometryId;

      // For armor attachables, the attachable references IDs like "geometry.humanoid.armor.chestplate"
      // which live in mobs.json and use cross-file v1.8.0 inheritance (→geometry.zombie).
      // Instead, use the equivalent self-contained geometry from player_armor.json:
      // "geometry.humanoid.armor.X" → "geometry.player.armor.X"
      let armorGeoId: string | undefined;
      if (geometryId.startsWith("geometry.humanoid.armor.")) {
        armorGeoId = geometryId.replace("geometry.humanoid.armor.", "geometry.player.armor.");
      }

      let geoResult = null;
      if (armorGeoId) {
        // Try the player_armor.json version first (self-contained inheritance chain)
        geoResult = await this._loadVanillaGeometry(armorGeoId);
      }
      if (!geoResult) {
        geoResult = await this._loadVanillaGeometry(geometryId);
      }

      if (geoResult) {
        modelData.geometry = applyGeometryTransforms(geoResult.geometry, geometryId);
        modelData.modelDefinition = geoResult.definition;
      } else {
        Log.debugAlert(`Failed to load geometry for attachable ${shortId}: ${geometryId}`);
      }
    }

    // Get default texture
    const textures = attachableResource.textures;
    if (textures && textures["default"]) {
      let texturePath = textures["default"];

      if (texturePath) {
        // Remove file extension if present
        if (texturePath.endsWith(".png") || texturePath.endsWith(".tga")) {
          texturePath = texturePath.substring(0, texturePath.lastIndexOf("."));
        }

        modelData.texturePath = texturePath;
        modelData.textureUrl =
          CreatorToolsHost.contentWebRoot + `res/latest/van/serve/resource_pack/${texturePath}.png`;

        const textureData = await this.loadVanillaTexture(texturePath);
        if (textureData) {
          modelData.textureData = textureData;
        }
      }
    }

    // For armor-type attachables, load the humanoid base model (Steve) so
    // the armor can be rendered on top of a body silhouette.
    // Armor geometries reference identifiers containing "humanoid" or "armor".
    const isArmorType =
      modelData.geometryId && (modelData.geometryId.includes("humanoid") || modelData.geometryId.includes("armor"));

    if (isArmorType) {
      const baseGeoResult = await this._loadVanillaGeometry("geometry.humanoid.custom");
      if (baseGeoResult) {
        modelData.baseGeometry = baseGeoResult.geometry;
        modelData.baseModelDefinition = baseGeoResult.definition;
        modelData.baseTextureUrl =
          CreatorToolsHost.contentWebRoot + "res/latest/van/serve/resource_pack/textures/entity/steve.png";

        const steveTexture = await this.loadVanillaTexture("textures/entity/steve");
        if (steveTexture) {
          modelData.baseTextureData = steveTexture;
        }
      }
    }

    this._attachableModelDataCache.set(shortId, modelData);
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

    // First pass: look for exact geometry ID match
    for (const fileName of possibleFiles) {
      const file = await Database.getPreviewVanillaFile(`/resource_pack/models/entity/${fileName}`);
      if (file) {
        const geoDef = await ModelGeometryDefinition.ensureOnFile(file);
        if (geoDef) {
          const exactGeometry = geoDef.getById(geometryId);
          if (exactGeometry) {
            return { geometry: exactGeometry, definition: geoDef };
          }
        }
      }
    }

    // Second pass: if no exact match found, fall back to default geometry from first file with one
    for (const fileName of possibleFiles) {
      const file = await Database.getPreviewVanillaFile(`/resource_pack/models/entity/${fileName}`);
      if (file) {
        const geoDef = await ModelGeometryDefinition.ensureOnFile(file);
        if (geoDef && geoDef.defaultGeometry) {
          Log.debugAlert(
            `VanillaProjectManager: No exact match for geometry "${geometryId}", falling back to default from ${fileName}`
          );
          return { geometry: geoDef.defaultGeometry, definition: geoDef };
        }
      }
    }

    // Third pass: scan all files in /models/entity/ for an exact geometry ID match.
    // This handles attachable geometries (e.g., "geometry.humanoid.armor.chestplate"
    // which lives in "player_armor.json") where the baseName heuristic fails.
    const vanillaFolder = await Database.getPreviewVanillaFolder();
    if (vanillaFolder) {
      const modelsFolder = await vanillaFolder.getFolderFromRelativePath("/resource_pack/models/entity/");
      if (modelsFolder) {
        await modelsFolder.load();

        for (const fileName in modelsFolder.files) {
          if (!fileName.endsWith(".json")) continue;
          // Skip files we already tried in the first two passes
          if (possibleFiles.includes(fileName)) continue;

          const file = modelsFolder.files[fileName];
          if (file) {
            const geoDef = await ModelGeometryDefinition.ensureOnFile(file);
            if (geoDef) {
              const exactGeometry = geoDef.getById(geometryId);
              if (exactGeometry) {
                // Try v1.8.0 inheritance resolution first (e.g., player_armor.json)
                const resolved = this._resolveV18Inheritance(geometryId, geoDef);
                if (resolved) {
                  return { geometry: resolved, definition: geoDef };
                }
                return { geometry: exactGeometry, definition: geoDef };
              }
            }
          }
        }
      }
    }

    // Fourth pass: scan /models/ root directory (not just /models/entity/) for v1.8.0 format files.
    // The mobs.json file in /models/ contains humanoid armor geometry with inheritance syntax.
    if (vanillaFolder) {
      const modelsRootFolder = await vanillaFolder.getFolderFromRelativePath("/resource_pack/models/");
      if (modelsRootFolder) {
        await modelsRootFolder.load();

        for (const fileName in modelsRootFolder.files) {
          if (!fileName.endsWith(".json")) continue;

          const file = modelsRootFolder.files[fileName];
          if (file) {
            const geoDef = await ModelGeometryDefinition.ensureOnFile(file);
            if (geoDef) {
              const exactGeometry = geoDef.getById(geometryId);
              if (exactGeometry) {
                // Check if this is a v1.8.0 format with inheritance that needs resolution
                const resolved = this._resolveV18Inheritance(geometryId, geoDef);
                if (resolved) {
                  return { geometry: resolved, definition: geoDef };
                }
                return { geometry: exactGeometry, definition: geoDef };
              }
            }
          }
        }
      }
    }

    return null;
  }

  /**
   * Resolve v1.8.0 geometry inheritance chain.
   *
   * V1.8.0 format uses keys like `"geometry.X:geometry.Y"` where Y is the parent.
   * Each child provides bone overrides: `inflate` modifies cube inflation,
   * `reset: true` removes all cubes from a bone (hides it), `neverRender` controls visibility.
   *
   * Example chain for chestplate:
   *   geometry.humanoid.armor.chestplate:geometry.humanoid.armor1
   *     → geometry.humanoid.armor1:geometry.zombie
   *       → geometry.zombie (base with all cubes)
   *
   * Returns a flattened IGeometry with all inheritance resolved.
   */
  private static _resolveV18Inheritance(geometryId: string, geoDef: ModelGeometryDefinition): IGeometry | null {
    const data = geoDef.data as any;
    if (!data) return null;

    // Find the key that matches this geometry ID (may include ":parent" suffix)
    let matchingKey: string | undefined;
    let parentId: string | undefined;

    for (const key of Object.keys(data)) {
      if (key === geometryId || key.startsWith(geometryId + ":")) {
        matchingKey = key;
        const colonIndex = key.indexOf(":");
        if (colonIndex > 0) {
          parentId = key.substring(colonIndex + 1);
        }
        break;
      }
    }

    if (!matchingKey) return null;
    if (!parentId) {
      // No inheritance — return as-is
      return null;
    }

    // Resolve parentId recursively
    const parentGeometry = this._resolveV18InheritanceFrom(parentId, data);
    if (!parentGeometry || !parentGeometry.bones) return null;

    // Get the child overrides
    const childData = data[matchingKey];
    if (!childData || !childData.bones) return null;

    // Deep clone parent bones to avoid mutating the original
    const resolvedBones: IGeometryBone[] = JSON.parse(JSON.stringify(parentGeometry.bones));

    // Apply child bone overrides
    for (const childBone of childData.bones) {
      const parentBoneIndex = resolvedBones.findIndex((b: IGeometryBone) => b.name === childBone.name);

      if (parentBoneIndex >= 0) {
        const parentBone = resolvedBones[parentBoneIndex];

        if (childBone.reset) {
          // reset: true removes all cubes from this bone (makes it invisible)
          parentBone.cubes = undefined;
          parentBone.poly_mesh = undefined;
          parentBone.texture_meshes = undefined;
        } else {
          // Merge properties: inflate applies to all existing cubes
          if (childBone.inflate !== undefined && parentBone.cubes) {
            for (const cube of parentBone.cubes) {
              cube.inflate = childBone.inflate;
            }
          }
          if (childBone.neverRender !== undefined) {
            (parentBone as any).neverRender = childBone.neverRender;
          }
        }
      }
    }

    // Filter out neverRender bones and bones with no visual content
    const visibleBones = resolvedBones.filter((b: any) => {
      if (b.neverRender === true) return false;
      return true;
    });

    return {
      description: parentGeometry.description || {
        identifier: geometryId,
        texture_width: childData.texturewidth || parentGeometry.texturewidth || 64,
        texture_height: childData.textureheight || parentGeometry.textureheight || 32,
        visible_bounds_width: 2,
        visible_bounds_height: 2,
        visible_bounds_offset: [0, 1, 0],
      },
      bones: visibleBones,
      texturewidth: childData.texturewidth || parentGeometry.texturewidth,
      textureheight: childData.textureheight || parentGeometry.textureheight,
    };
  }

  /**
   * Recursively resolve a v1.8.0 geometry ID within a single file's data.
   */
  private static _resolveV18InheritanceFrom(geoId: string, data: any): any | null {
    // Find the key for this geometry ID
    let matchingKey: string | undefined;
    let parentId: string | undefined;

    for (const key of Object.keys(data)) {
      if (key === "format_version") continue;

      if (key === geoId || key.startsWith(geoId + ":")) {
        matchingKey = key;
        const colonIndex = key.indexOf(":");
        if (colonIndex > 0) {
          parentId = key.substring(colonIndex + 1);
        }
        break;
      }
    }

    if (!matchingKey) return null;

    const geoData = data[matchingKey];
    if (!parentId) {
      // Base geometry — no parent, return directly
      return geoData;
    }

    // Recursively resolve parent
    const parentGeo = this._resolveV18InheritanceFrom(parentId, data);
    if (!parentGeo || !parentGeo.bones) return geoData;

    // Deep clone parent bones
    const resolvedBones: IGeometryBone[] = JSON.parse(JSON.stringify(parentGeo.bones));

    // Apply child overrides
    if (geoData.bones) {
      for (const childBone of geoData.bones) {
        const parentBoneIndex = resolvedBones.findIndex((b: IGeometryBone) => b.name === childBone.name);

        if (parentBoneIndex >= 0) {
          const parentBone = resolvedBones[parentBoneIndex];

          if (childBone.reset) {
            parentBone.cubes = undefined;
            parentBone.poly_mesh = undefined;
            parentBone.texture_meshes = undefined;
          } else {
            if (childBone.inflate !== undefined && parentBone.cubes) {
              for (const cube of parentBone.cubes) {
                cube.inflate = childBone.inflate;
              }
            }
            if (childBone.neverRender !== undefined) {
              (parentBone as any).neverRender = childBone.neverRender;
            }
          }
        }
      }
    }

    return {
      ...parentGeo,
      ...geoData,
      bones: resolvedBones,
    };
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

  /**
   * Load a vanilla texture by its resource path (e.g., "textures/entity/pig/pig").
   * Returns the raw PNG bytes from the serve vanilla folder, or null if not found.
   */
  static async loadVanillaTexture(texturePath: string): Promise<Uint8Array | null> {
    // texturePath is like "textures/entity/pig/pig"
    // Use serve folder which has PNG versions of all textures (including those that are TGA in preview/release)
    const vanillaFolder = await Database.getServeVanillaFolder();
    if (!vanillaFolder) {
      Log.debugAlert("Could not get serve vanilla folder");
      return null;
    }

    const fullPath = `/resource_pack/${texturePath}.png`;

    const file = await vanillaFolder.getFileFromRelativePath(fullPath);
    if (!file) {
      Log.debugAlert(`Vanilla texture file not found: ${fullPath}`);
      // Try to list the directory to see what's there
      const dirPath = `/resource_pack/${texturePath.substring(0, texturePath.lastIndexOf("/"))}`;
      return null;
    }

    await file.loadContent();

    if (file.content instanceof Uint8Array) {
      return file.content;
    }

    Log.debugAlert(`Vanilla texture file content is not Uint8Array: ${typeof file.content}`);
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
