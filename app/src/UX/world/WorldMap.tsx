import { Component } from "react";
import MCWorld from "../../minecraft/MCWorld";
import CreatorTools from "../../app/CreatorTools";
import Log from "../../core/Log";
import L, { LatLngExpression } from "leaflet";
import "leaflet/dist/leaflet.css";
import ImageLoadManager from "./ImageLoadManger";
import "./WorldMap.css";
import GameStateManager from "../../minecraft/GameStateManager";
import IPlayerTravelledEvent from "../../minecraft/IPlayerTravelledEvent";
import BlockLocation from "../../minecraft/BlockLocation";
import WorldDisplayObject, { WorldDisplayObjectType } from "./WorldDisplayObject";
import CreatorToolsHost from "../../app/CreatorToolsHost";
import WorldChunk from "../../minecraft/WorldChunk";
import Database from "../../minecraft/Database";
import BlockTypeDefinition from "../../minecraft/BlockTypeDefinition";
import { ProjectItemType } from "../../app/IProjectItemData";
import Utilities from "../../core/Utilities";
import ActorItem from "../../minecraft/ActorItem";
import ChunkEntity from "../../minecraft/ChunkEntity";
import BlockTypeUtilities from "../../minecraft/BlockTypeUtilities";

/**
 * Interface for selected entity information.
 * Unified representation for both modern (ActorItem) and legacy (ChunkEntity) entity sources.
 */
export interface ISelectedEntityInfo {
  /** Entity type identifier (e.g., "minecraft:cow") */
  identifier: string;
  /** Short name (e.g., "Cow") */
  shortName: string;
  /** Position */
  x: number;
  y: number;
  z: number;
  /** Is baby */
  isBaby?: boolean;
  /** Is tamed */
  isTamed?: boolean;
  /** Custom name */
  customName?: string;
  /** Icon category (hostile, passive, player, item, other) */
  category: string;
  /** Emoji for the entity */
  emoji: string;
  /** Icon color */
  color: string;
  /** Source: 'actor' for modern format, 'chunk' for legacy format */
  source: "actor" | "chunk";
  /** Original actor item (if from modern storage) */
  actorItem?: ActorItem;
  /** Original chunk entity (if from legacy storage) */
  chunkEntity?: ChunkEntity;
}

// Water depth colors (deeper = darker blue)
const WATER_DEPTH_COLORS = [
  "#3f76e4", // surface
  "#3a6dd8",
  "#3564cc",
  "#305bc0",
  "#2b52b4",
  "#2649a8",
  "#21409c",
  "#1c3790",
  "#172e84",
  "#122578", // very deep
];

interface IWorldMapProps {
  world: MCWorld;
  creatorTools: CreatorTools;
  heightOffset?: number;
  activeDimension?: number;
  displayObjects?: WorldDisplayObject[];
  onSetActiveMap?: (map: WorldMap) => void;
  onSelectionChange?: (from: BlockLocation, to: BlockLocation) => void;
  onYChange?: (newY: number) => void;
  onDisplayModeChange?: (newMapDisplayMode: WorldMapDisplayMode) => void;
  /** Callback when an entity is selected on the map */
  onEntitySelect?: (entity: ISelectedEntityInfo | undefined) => void;
}

export enum WorldMapDisplayMode {
  topBlocks = 0,
  fixedY = 1,
}

interface IWorldMapState {
  hoverX: number;
  hoverZ: number;
  sliderY: number;
  isDraggingSlider: boolean;
  isLoading: boolean;
  loadingMessage: string;
  // Chunk loading progress
  chunksLoading: number;
  chunksTotal: number;
}

/* Implementation approach:

Tiles are 256x256 pixels
           0 - 1 
           1 - 2
           2 - 5
Zoom level 3 - 10 (the 4th zoom level) = Render map colors per block (pixel solid map color per block)
           4 - 20 - Each block gets 2px - Map colors per block (2px x 2px solid map color per block). 
           5 - 40 - Each block gets 4px - Map colors per block (4px x 4px solid map color per block).  4 x 4 chunks
           6 - 80 - Each block gets 8px.  2x2 chunks
Zoom level 7 - 160 (the 8th zoom level) = "chunk size" -- coords represent a chunk.  Each block gets 16px
*/

export default class WorldMap extends Component<IWorldMapProps, IWorldMapState> {
  _mapOuterDiv: HTMLDivElement | null = null;
  _mapDiv: HTMLDivElement | null = null;
  _map: L.Map | null = null;
  _spawnX: number = 0;
  _spawnZ: number = 0;
  _minX: number = 0;
  _maxX: number = 0;
  _minZ: number = 0;
  _maxZ: number = 0;
  _yLevel = 0;
  _gsm?: GameStateManager;
  _lastWorldSet: MCWorld | undefined;
  _lastDimensionSet: number | undefined;
  _isLoadingWorld = false; // Track if world data is currently loading
  _subscribedWorld: MCWorld | undefined; // Track which world we're subscribed to for cleanup
  _chunkUpdateTimeout: ReturnType<typeof setTimeout> | undefined; // Timer for throttled chunk updates
  _levelStatusElt: HTMLDivElement | undefined;
  _coordsStatusElt: HTMLDivElement | undefined;
  _curLayer: L.GridLayer | undefined;
  _isTops = true;
  _showElevationShading = true;
  _mapTiles: { [id: string]: ImageLoadManager | undefined } = {};
  _spawnLocationMarker: L.Marker | undefined;
  _playerMarker: L.Marker | undefined;
  _cameraMarker: L.Marker | undefined;
  _trackCamera = false;
  _trackCameraBtn: HTMLButtonElement | undefined;
  _hasCenteredOnPlayer = false;
  _cameraX: number | undefined;
  _cameraY: number | undefined;
  _cameraZ: number | undefined;
  _cameraYaw: number | undefined;
  _selectedBlockLocationFrom: BlockLocation | undefined;
  _selectedBlockLocationTo: BlockLocation | undefined;
  _selectionRectangle: L.Rectangle | undefined;
  _mapElements: L.Layer[] = [];
  _playerPath: L.Polyline | undefined;
  _posToCoordDivisor = 8;
  _ySliderCanvas: HTMLCanvasElement | null = null;
  _ySliderContainer: HTMLDivElement | null = null;

  // Entity markers
  _entityMarkers: L.Marker[] = [];
  _entityLayerGroup: L.LayerGroup | undefined;
  _showEntities = true;
  _entityMarkersLoaded = false;

  // Tile rendering cache - caches rendered canvas tiles by coordinate key
  // Key format: "dim_zoom_x_y_yLevel_isTops" (e.g., "0_5_10_20_64_false")
  // This dramatically improves performance when panning/zooming by avoiding re-rendering
  _tileCache: Map<string, HTMLCanvasElement> = new Map();
  _tileCacheMaxSize = 500; // Maximum number of tiles to cache
  _tileCacheVersion = 0; // Increment this to invalidate entire cache

  // Memory management for large worlds
  // Tracks chunks that were recently accessed for rendering, used to clear distant chunk data
  _recentlyAccessedChunks: Set<string> = new Set(); // Format: "dim_x_z"
  _lastMemoryCleanupTime = 0;
  _memoryCleanupIntervalMs = 5000; // How often to run memory cleanup
  _maxRecentChunks = 2000; // Max chunks to keep data for

  // Async chunk loading tracking
  // Tracks chunks that have been requested but not yet loaded
  _pendingChunkLoads: Set<string> = new Set(); // Format: "dim_x_z"
  _chunkLoadBatchTimeout: ReturnType<typeof setTimeout> | undefined;
  _chunksToLoad: Array<{ dim: number; x: number; z: number; priority: number }> = [];
  _chunksLoadedThisSession: number = 0; // Track progress for UI
  _chunksTotalThisSession: number = 0;
  _lastProgressUpdate: number = 0; // Throttle progress UI updates
  _isProcessingChunks: boolean = false; // Prevent re-entry
  _tileRefreshScheduled: boolean = false; // Batch tile refreshes
  _lastVisibleBounds: { minX: number; maxX: number; minZ: number; maxZ: number } | null = null; // Track visible area

  // Empty chunk tracking - chunks that don't exist in the world
  // This allows skipping loading attempts for chunks we know are empty
  _emptyChunks: Set<string> = new Set(); // Format: "dim_x_z"

  // Non-empty chunks - chunks we've confirmed have content
  // Used to prioritize loading chunks near known content
  _nonEmptyChunks: Set<string> = new Set(); // Format: "dim_x_z"

  // Cache for custom block definitions from the project
  // Maps block type id (e.g., "ec_vv:bushy_birch") to { mapColor, textureDataUrl }
  // textureDataUrl is a base64 data URL that can be used directly as an image source
  _customBlockCache: {
    [blockTypeId: string]: { mapColor?: string; textureDataUrl?: string } | undefined;
  } = {};
  _customBlockCacheLoaded = false;

  // Cache for loaded texture images (HTMLImageElement) ready for canvas drawing
  _customBlockImageCache: { [blockTypeId: string]: HTMLImageElement | undefined } = {};

  // Slider Y-range tracking for click/drag handling
  _sliderViewMinY: number = -64; // WorldMap.MIN_Y
  _sliderViewMaxY: number = 320; // WorldMap.MAX_Y

  // Y range for Minecraft worlds
  static MIN_Y = -64;
  static MAX_Y = 320;

  constructor(props: IWorldMapProps) {
    super(props);

    this.state = {
      hoverX: 0,
      hoverZ: 0,
      sliderY: 64,
      isDraggingSlider: false,
      isLoading: false,
      loadingMessage: "",
      chunksLoading: 0,
      chunksTotal: 0,
    };

    this._setMapOuter = this._setMapOuter.bind(this);
    this._doResize = this._doResize.bind(this);
    this._renderTile = this._renderTile.bind(this);

    this._handleMapClick = this._handleMapClick.bind(this);
    this._handleMouseMove = this._handleMouseMove.bind(this);
    this._handleKeyDown = this._handleKeyDown.bind(this);

    this.setTopsLevel = this.setTopsLevel.bind(this);
    this.mapLevelPlus = this.mapLevelPlus.bind(this);
    this.mapLevelMinus = this.mapLevelMinus.bind(this);
    this._handlePlayerTravelled = this._handlePlayerTravelled.bind(this);
    this.goToSpawn = this.goToSpawn.bind(this);
    this.goToOrigin = this.goToOrigin.bind(this);
    this._handleSliderMouseDown = this._handleSliderMouseDown.bind(this);
    this._handleSliderMouseMove = this._handleSliderMouseMove.bind(this);
    this._handleSliderMouseUp = this._handleSliderMouseUp.bind(this);
    this._setYSliderCanvas = this._setYSliderCanvas.bind(this);
    this._renderYSlider = this._renderYSlider.bind(this);
    this._handleWorldDataLoaded = this._handleWorldDataLoaded.bind(this);
    this._handleChunkUpdated = this._handleChunkUpdated.bind(this);
    this._loadCustomBlockCache = this._loadCustomBlockCache.bind(this);
    this._handleImageLoaded = this._handleImageLoaded.bind(this);
    this._toggleTrackCamera = this._toggleTrackCamera.bind(this);

    // Set up image load callback so Y slider refreshes when textures load
    ImageLoadManager.onImageLoaded = this._handleImageLoaded;
  }

  /**
   * Load custom block definitions from the project into the cache.
   * This extracts map colors and texture data from custom block behavior pack definitions.
   *
   * For textures, we traverse the block type's child items (dependencies) to find
   * texture project items, then load their binary content as base64 data URLs.
   */
  async _loadCustomBlockCache() {
    if (this._customBlockCacheLoaded) {
      return;
    }

    this._customBlockCacheLoaded = true;

    const project = this.props.world?.project;
    if (!project) {
      return;
    }

    // Get all custom block type items from the project
    const blockTypeItems = project.getItemsByType(ProjectItemType.blockTypeBehavior);

    for (const item of blockTypeItems) {
      // Load the block definition if not already loaded
      const file = item.primaryFile;
      if (!file) {
        continue;
      }

      // Ensure item content is loaded and dependencies calculated
      if (!item.isContentLoaded) {
        await item.loadContent();
      }
      await item.ensureDependencies();

      // Use ensureOnFile to properly create and load the block definition
      const blockDef = await BlockTypeDefinition.ensureOnFile(file);

      if (blockDef) {
        const blockTypeId = blockDef.id; // Full id like "ec_vv:bushy_birch"

        if (!blockTypeId) {
          continue;
        }

        const cacheEntry: { mapColor?: string; textureDataUrl?: string } = {};

        // Get map color from minecraft:map_color component
        const mapColorComponent = blockDef.getComponent("minecraft:map_color");
        if (mapColorComponent && typeof mapColorComponent === "string") {
          // Map color can be a direct string like "#RRGGBB"
          cacheEntry.mapColor = mapColorComponent;
        } else if (mapColorComponent && typeof mapColorComponent === "object") {
          // Or it might be an object with a color property
          const colorObj = mapColorComponent as { color?: string };
          if (colorObj.color) {
            cacheEntry.mapColor = colorObj.color;
          }
        }

        // Get texture by traversing child items (dependencies) to find texture ProjectItems
        // BlockTypeDefinition.getTextureItems does this traversal via terrain_texture.json
        const textureItems = await blockDef.getTextureItems(item);

        if (textureItems) {
          // Get the first texture item (usually the "*" or "up" face texture)
          const textureKeys = Object.keys(textureItems);
          if (textureKeys.length > 0) {
            const firstTextureItem = textureItems[textureKeys[0]];

            // Load the texture file content
            if (firstTextureItem && firstTextureItem.primaryFile) {
              const textureFile = firstTextureItem.primaryFile;
              await textureFile.loadContent();

              if (textureFile.content instanceof Uint8Array) {
                // Convert to base64 data URL
                const base64 = Utilities.uint8ArrayToBase64(textureFile.content);
                // Determine MIME type based on file extension
                const ext = textureFile.name?.toLowerCase() || "";
                const mimeType = "image/png";
                if (ext.endsWith(".jpg") || ext.endsWith(".jpeg")) {
                  // JPEG files - currently using PNG mime type as fallback
                  // TODO: Add proper JPEG handling
                } else if (ext.endsWith(".tga")) {
                  // TGA files are not supported by browsers - skip them for now
                  // TODO: Add TGA decoder support
                } else {
                  cacheEntry.textureDataUrl = `data:${mimeType};base64,${base64}`;
                }
              }
            }
          }
        }

        this._customBlockCache[blockTypeId] = cacheEntry;

        // Also cache by short ID (without namespace) for easier lookup
        const colonIndex = blockTypeId.indexOf(":");
        if (colonIndex >= 0) {
          const shortId = blockTypeId.substring(colonIndex + 1);
          this._customBlockCache[shortId] = cacheEntry;
        }
      }
    }
  }

  /**
   * Get custom block rendering info from the cache.
   * Returns undefined if the block is not a custom block from the project.
   */
  _getCustomBlockInfo(blockTypeId: string): { mapColor?: string; textureDataUrl?: string } | undefined {
    // Try full ID first
    let info = this._customBlockCache[blockTypeId];
    if (info !== undefined) {
      return info;
    }

    // Try with just the short ID (after colon)
    const colonIndex = blockTypeId.indexOf(":");
    if (colonIndex >= 0) {
      const shortId = blockTypeId.substring(colonIndex + 1);
      info = this._customBlockCache[shortId];
      if (info !== undefined) {
        return info;
      }
    }

    return undefined;
  }

  /**
   * Get a loaded HTMLImageElement for a custom block's texture.
   * Returns undefined if no texture is available or not yet loaded.
   * Starts loading the image asynchronously if not already loaded.
   */
  _getCustomBlockImage(blockTypeId: string): HTMLImageElement | undefined {
    // Check if already cached (use 'in' operator to distinguish "not loaded" from "failed to load")
    if (blockTypeId in this._customBlockImageCache) {
      const cached = this._customBlockImageCache[blockTypeId];
      // Return the image if it loaded successfully, undefined if it failed
      return cached;
    }

    // Get the texture data URL
    const info = this._getCustomBlockInfo(blockTypeId);
    if (!info?.textureDataUrl) {
      // Mark as having no texture data URL so we don't retry
      this._customBlockImageCache[blockTypeId] = undefined;
      return undefined;
    }

    // Mark as "loading" with a placeholder to prevent duplicate loads
    this._customBlockImageCache[blockTypeId] = undefined;

    // Start loading the image asynchronously
    const img = new Image();
    img.onload = () => {
      this._customBlockImageCache[blockTypeId] = img;
      // Trigger a redraw when the image loads
      if (this._curLayer) {
        (this._curLayer as L.GridLayer).redraw();
      }
    };
    img.onerror = (e) => {
      // Mark as failed - the 'in' check will prevent retrying
      // Keep it as undefined which was set before loading started
      Log.debugAlert("Failed to load custom block texture for: " + blockTypeId);
    };
    img.src = info.textureDataUrl;

    // Return undefined for now - image will be available after load
    return undefined;
  }

  componentWillUnmount() {
    // Unsubscribe from world events to prevent memory leaks
    if (this._subscribedWorld) {
      this._subscribedWorld.onDataLoaded.unsubscribe(this._handleWorldDataLoaded);
      this._subscribedWorld.onChunkUpdated.unsubscribe(this._handleChunkUpdated);
      this._subscribedWorld = undefined;
    }

    // Clear any pending chunk update timeout
    if (this._chunkUpdateTimeout) {
      clearTimeout(this._chunkUpdateTimeout);
      this._chunkUpdateTimeout = undefined;
    }

    // Clear any pending chunk load batch timeout
    if (this._chunkLoadBatchTimeout) {
      clearTimeout(this._chunkLoadBatchTimeout);
      this._chunkLoadBatchTimeout = undefined;
    }

    // Clear pending chunk load state
    this._pendingChunkLoads.clear();
    this._chunksToLoad = [];
    this._emptyChunks.clear();
    this._nonEmptyChunks.clear();

    // Clear image load callback
    if (ImageLoadManager.onImageLoaded === this._handleImageLoaded) {
      ImageLoadManager.onImageLoaded = undefined;
    }
  }

  _handleImageLoaded() {
    // Re-render Y slider when textures finish loading
    this._renderYSlider();
  }

  _handleWorldDataLoaded(world: MCWorld) {
    // When world data finishes loading, recreate the layer to force fresh tile rendering
    // This is more aggressive than redraw() but ensures no stale cached tiles
    if (this._map && this._curLayer) {
      this._ensureLayer();
    }

    // For very large worlds, proactively clear chunk caches after initial load
    // to free memory before the user starts navigating
    if (world.chunkCount > 50000) {
      // Force an immediate memory cleanup cycle
      this._lastMemoryCleanupTime = 0;
      this._performMemoryCleanup();
    }
  }

  // Track chunks that need tile invalidation (batched updates)
  _pendingChunkInvalidations: Set<string> = new Set(); // Format: "dim_x_z"

  _handleChunkUpdated(world: MCWorld, chunk: WorldChunk) {
    // When a chunk is updated (superceded by newer LevelDB keys), track it for tile invalidation.
    // We batch chunk updates and throttle refresh to avoid excessive rendering when many chunks
    // are updated rapidly (e.g., during player movement in a live world).

    // Track this chunk for targeted tile invalidation
    const dim = this.props.activeDimension ?? 0;
    const chunkKey = `${dim}_${chunk.x}_${chunk.z}`;
    this._pendingChunkInvalidations.add(chunkKey);

    // Also update our tracking sets
    this._nonEmptyChunks.add(chunkKey);
    this._emptyChunks.delete(chunkKey);

    // Clear and reset the timeout to batch updates
    if (this._chunkUpdateTimeout) {
      clearTimeout(this._chunkUpdateTimeout);
    }

    // Schedule a targeted tile refresh after a short delay (300ms) to batch multiple chunk updates
    this._chunkUpdateTimeout = setTimeout(() => {
      this._chunkUpdateTimeout = undefined;
      this._processChunkInvalidations();
    }, 300);
  }

  /**
   * Process pending chunk invalidations by selectively invalidating affected tiles.
   * This is more efficient than invalidating the entire tile cache.
   */
  private _processChunkInvalidations() {
    if (this._pendingChunkInvalidations.size === 0) {
      return;
    }

    const invalidationCount = this._pendingChunkInvalidations.size;

    // If many chunks were updated, just invalidate everything (it's more efficient)
    if (invalidationCount > 50) {
      this._pendingChunkInvalidations.clear();
      if (this._map && this._curLayer) {
        this._ensureLayer();
      }
      return;
    }

    // For small numbers of chunks, selectively invalidate tiles that contain them
    const dim = this.props.activeDimension ?? 0;
    const keysToDelete: string[] = [];

    // Delete cached tiles that overlap with any of the updated chunks
    for (const cacheKey of this._tileCache.keys()) {
      // Cache key format: "${this._tileCacheVersion}_${dim}_${coords.z}_${coords.x}_${coords.y}_${this._yLevel}_${this._isTops}"
      const parts = cacheKey.split("_");
      if (parts.length < 5) continue;

      const tileDim = parseInt(parts[1], 10);
      const tileZoom = parseInt(parts[2], 10);
      const tileX = parseInt(parts[3], 10);
      const tileY = parseInt(parts[4], 10);

      if (tileDim !== dim) continue;

      // Calculate which chunk range this tile covers
      // At different zoom levels, tiles cover different numbers of chunks
      const chunkRange = this._getTileChunkRange(tileZoom, tileX, tileY);

      // Check if any pending chunk falls within this tile's range
      for (const chunkKey of this._pendingChunkInvalidations) {
        const chunkParts = chunkKey.split("_");
        const chunkDim = parseInt(chunkParts[0], 10);
        const chunkX = parseInt(chunkParts[1], 10);
        const chunkZ = parseInt(chunkParts[2], 10);

        if (chunkDim !== dim) continue;

        if (
          chunkX >= chunkRange.minX &&
          chunkX <= chunkRange.maxX &&
          chunkZ >= chunkRange.minZ &&
          chunkZ <= chunkRange.maxZ
        ) {
          keysToDelete.push(cacheKey);
          break; // Only need to delete once
        }
      }
    }

    // Delete the affected cache entries
    for (const key of keysToDelete) {
      this._tileCache.delete(key);
    }

    this._pendingChunkInvalidations.clear();

    // Trigger a layer redraw (not full rebuild)
    if (this._map && this._curLayer) {
      this._curLayer.redraw();
    }

    Log.verbose(`WorldMap: Invalidated ${keysToDelete.length} tiles for ${invalidationCount} chunks`);
  }

  /**
   * Calculate which chunk coordinates a tile covers at a given zoom level.
   * This is based on the tile coordinate system where different zoom levels
   * cover different numbers of blocks/chunks.
   */
  private _getTileChunkRange(
    zoom: number,
    tileX: number,
    tileY: number
  ): { minX: number; maxX: number; minZ: number; maxZ: number } {
    // Tile size is always 256 pixels
    // At different zoom levels, each pixel represents different numbers of blocks:
    // Zoom 3: 1 block/pixel (each tile = 256 blocks = 16 chunks)
    // Zoom 4: 2 pixels/block (each tile = 128 blocks = 8 chunks)
    // Zoom 5: 4 pixels/block (each tile = 64 blocks = 4 chunks)
    // Zoom 6: 8 pixels/block (each tile = 32 blocks = 2 chunks)
    // Zoom 7: 16 pixels/block (each tile = 16 blocks = 1 chunk)

    const tileSize = 256;
    let blocksPerTile: number;

    if (zoom <= 3) {
      blocksPerTile = tileSize; // 1 block/pixel
    } else if (zoom === 4) {
      blocksPerTile = tileSize / 2;
    } else if (zoom === 5) {
      blocksPerTile = tileSize / 4;
    } else if (zoom === 6) {
      blocksPerTile = tileSize / 8;
    } else {
      blocksPerTile = 16; // 1 chunk
    }

    // Calculate block coordinates for this tile
    const blockX = tileX * blocksPerTile;
    const blockZ = tileY * blocksPerTile; // Note: tileY maps to Z in Minecraft coordinates

    // Convert to chunk coordinates
    const minChunkX = Math.floor(blockX / 16);
    const maxChunkX = Math.floor((blockX + blocksPerTile - 1) / 16);
    const minChunkZ = Math.floor(blockZ / 16);
    const maxChunkZ = Math.floor((blockZ + blocksPerTile - 1) / 16);

    return { minX: minChunkX, maxX: maxChunkX, minZ: minChunkZ, maxZ: maxChunkZ };
  }

  /**
   * Queue a chunk for async loading. Chunks are batched and loaded together
   * to avoid excessive layer refreshes.
   *
   * @param dim Dimension ID
   * @param x Chunk X coordinate
   * @param z Chunk Z coordinate
   * @param priority Loading priority (lower = higher priority). Default is 10.
   *   - 0: High priority (sparse sample chunks, chunks near known content)
   *   - 5: Medium priority (neighbors of non-empty chunks)
   *   - 10: Normal priority (fill-in chunks)
   */
  _queueChunkLoad(dim: number, x: number, z: number, priority: number = 10) {
    const key = `${dim}_${x}_${z}`;

    // Already pending or already loaded
    if (this._pendingChunkLoads.has(key)) {
      return;
    }

    // Skip if we already know this chunk is empty (from previous load attempt or hasChunkData check)
    if (this._emptyChunks.has(key)) {
      return;
    }

    // Fast O(1) check: does this chunk even exist in the world?
    // This uses the chunk index built during world loading (skipFullProcessing mode)
    const exists = this.props.world.hasChunkData(dim, x, z);
    if (exists === false) {
      // Chunk definitely doesn't exist - skip it entirely
      this._emptyChunks.add(key);
      return;
    }

    // Check if chunk already exists as a loaded object
    const existingChunk = this.props.world.getChunkAt(dim, x, z);
    if (existingChunk) {
      this._nonEmptyChunks.add(key);
      return;
    }

    // Mark as pending and queue for loading with priority
    this._pendingChunkLoads.add(key);
    this._chunksToLoad.push({ dim, x, z, priority });
    this._chunksTotalThisSession++;

    // Update progress state (throttled)
    const now = Date.now();
    if (now - this._lastProgressUpdate > 100) {
      this._lastProgressUpdate = now;
      this.setState({
        chunksLoading: this._chunksLoadedThisSession,
        chunksTotal: this._chunksTotalThisSession,
      });
    }

    // Batch chunk loads with a small delay to collect nearby chunks
    if (!this._chunkLoadBatchTimeout && !this._isProcessingChunks) {
      this._chunkLoadBatchTimeout = setTimeout(() => {
        this._chunkLoadBatchTimeout = undefined;
        this._processChunksAsync();
      }, 100); // 100ms batching window to collect more chunks
    }
  }

  /**
   * Process queued chunk loads asynchronously, yielding to browser frequently.
   * Uses requestAnimationFrame to keep UI responsive.
   * Skips chunks that are no longer in the visible viewport.
   * Prioritizes chunks by priority value (lower = higher priority).
   */
  _processChunksAsync() {
    if (this._isProcessingChunks) return;
    this._isProcessingChunks = true;

    const processNextChunk = () => {
      // Update visible bounds to check which chunks are still needed
      this._updateVisibleBounds();

      // Check if we're done (both queue empty AND no pending loads)
      if (this._chunksToLoad.length === 0 && this._pendingChunkLoads.size === 0) {
        this._isProcessingChunks = false;

        Log.verbose(
          "[WorldMap] Chunk processing complete. Loaded: " +
            this._chunksLoadedThisSession +
            ", NonEmpty: " +
            this._nonEmptyChunks.size +
            ", Empty: " +
            this._emptyChunks.size
        );

        // Final tile refresh
        this._scheduleTileRefresh();

        // Clear progress after a short delay
        setTimeout(() => {
          this._chunksLoadedThisSession = 0;
          this._chunksTotalThisSession = 0;
          this.setState({ chunksLoading: 0, chunksTotal: 0 });
        }, 500);
        return;
      }

      // If queue is empty but we still have pending, something is stuck - clear it
      if (this._chunksToLoad.length === 0 && this._pendingChunkLoads.size > 0) {
        this._pendingChunkLoads.clear();
        this._isProcessingChunks = false;
        this._scheduleTileRefresh();
        setTimeout(() => {
          this._chunksLoadedThisSession = 0;
          this._chunksTotalThisSession = 0;
          this.setState({ chunksLoading: 0, chunksTotal: 0 });
        }, 500);
        return;
      }

      // Sort by priority (lower = higher priority), then by visibility
      // Only sort occasionally to avoid performance overhead
      if (this._chunksToLoad.length > 1 && this._chunksLoadedThisSession % 10 === 0) {
        this._chunksToLoad.sort((a, b) => {
          // First by visibility (visible chunks first)
          const aVisible = this._isChunkVisible(a.x, a.z) ? 0 : 1;
          const bVisible = this._isChunkVisible(b.x, b.z) ? 0 : 1;
          if (aVisible !== bVisible) return aVisible - bVisible;

          // Then by priority (lower = higher priority)
          return a.priority - b.priority;
        });
      }

      // Process multiple chunks per frame within a time budget (8ms target for 60fps)
      const frameStartTime = performance.now();
      const frameBudgetMs = 8;
      let chunksProcessedThisFrame = 0;

      while (this._chunksToLoad.length > 0 && performance.now() - frameStartTime < frameBudgetMs) {
        // Get the highest priority visible chunk, or just the highest priority chunk
        let chunkToProcess: { dim: number; x: number; z: number; priority: number } | undefined;

        // First, try to find a visible chunk with good priority
        for (let i = 0; i < Math.min(this._chunksToLoad.length, 20); i++) {
          const chunk = this._chunksToLoad[i];
          if (this._isChunkVisible(chunk.x, chunk.z)) {
            chunkToProcess = chunk;
            this._chunksToLoad.splice(i, 1);
            break;
          }
        }

        // If no visible chunks, just take the first one (highest priority)
        if (!chunkToProcess && this._chunksToLoad.length > 0) {
          chunkToProcess = this._chunksToLoad.shift();
        }

        if (!chunkToProcess) break;

        const { dim, x, z } = chunkToProcess;
        const key = `${dim}_${x}_${z}`;

        const chunk = this.props.world.getOrCreateChunk(dim, x, z);
        this._pendingChunkLoads.delete(key);
        this._chunksLoadedThisSession++;
        chunksProcessedThisFrame++;

        // Track whether chunk has content or is empty
        // A chunk has content if it has any subchunks defined
        const hasContent = chunk && chunk.subChunks && chunk.subChunks.some((sc) => sc !== undefined);

        if (hasContent) {
          // Chunk has content - mark as non-empty and queue neighbors with higher priority
          this._nonEmptyChunks.add(key);

          // Queue immediate neighbors with medium priority (5)
          // This implements "expand from non-empty" strategy
          const neighbors = [
            { dx: -1, dz: 0 },
            { dx: 1, dz: 0 },
            { dx: 0, dz: -1 },
            { dx: 0, dz: 1 },
          ];
          for (const { dx, dz } of neighbors) {
            const nx = x + dx;
            const nz = z + dz;
            const nkey = `${dim}_${nx}_${nz}`;
            // Only queue if not already processed and visible
            if (
              !this._pendingChunkLoads.has(nkey) &&
              !this._emptyChunks.has(nkey) &&
              !this._nonEmptyChunks.has(nkey) &&
              !this.props.world.getChunkAt(dim, nx, nz) &&
              this._isChunkVisible(nx, nz)
            ) {
              this._queueChunkLoad(dim, nx, nz, 5); // Medium priority for neighbors
            }
          }
        } else {
          // Chunk is empty or has no data
          this._emptyChunks.add(key);
        }
      }

      // Update progress state (throttled to avoid too many renders)
      const now = Date.now();
      if (now - this._lastProgressUpdate > 100) {
        this._lastProgressUpdate = now;

        this.setState({
          chunksLoading: this._chunksLoadedThisSession,
          chunksTotal: this._chunksTotalThisSession,
        });

        // Schedule a tile refresh (batched)
        this._scheduleTileRefresh();
      }

      // Yield to browser and continue on next frame
      requestAnimationFrame(processNextChunk);
    };

    // Start processing
    requestAnimationFrame(processNextChunk);
  }

  /**
   * Schedule a tile refresh, batched to avoid too many refreshes.
   */
  _scheduleTileRefresh() {
    if (this._tileRefreshScheduled) return;
    this._tileRefreshScheduled = true;

    requestAnimationFrame(() => {
      this._tileRefreshScheduled = false;
      this._refreshTilesGently();
    });
  }

  /**
   * Process queued chunk loads in small batches for smooth UI updates.
   * @deprecated Use _processChunksAsync instead
   */
  _processChunkLoadBatch() {
    // Redirect to async version
    this._processChunksAsync();
  }

  /**
   * Update the visible bounds based on current map view.
   * Used to skip loading chunks that are no longer visible.
   */
  _updateVisibleBounds() {
    if (!this._map) return;

    const bounds = this._map.getBounds();

    // Convert lat/lng to world coordinates
    // The CRS-to-block mapping is fixed by _posToCoordDivisor (1 CRS unit = 8 blocks).
    // This doesn't change with zoom — zoom only affects what portion of CRS space is visible.
    const scale = this._posToCoordDivisor; // blocks per CRS unit

    // Add margin (2 chunks worth) to avoid popping
    const margin = 32;

    this._lastVisibleBounds = {
      minX: Math.floor(bounds.getWest() * scale) - margin,
      maxX: Math.ceil(bounds.getEast() * scale) + margin,
      minZ: Math.floor(-bounds.getNorth() * scale) - margin,
      maxZ: Math.ceil(-bounds.getSouth() * scale) + margin,
    };
  }

  /**
   * Check if a chunk is currently within the visible viewport.
   */
  _isChunkVisible(chunkX: number, chunkZ: number): boolean {
    if (!this._lastVisibleBounds) return true; // If no bounds, assume visible

    const worldX = chunkX * 16;
    const worldZ = chunkZ * 16;

    return (
      worldX + 16 >= this._lastVisibleBounds.minX &&
      worldX <= this._lastVisibleBounds.maxX &&
      worldZ + 16 >= this._lastVisibleBounds.minZ &&
      worldZ <= this._lastVisibleBounds.maxZ
    );
  }

  /**
   * Gently refresh tiles without causing flicker.
   * Redraws tile canvases in place using their coordinates.
   */
  _refreshTilesGently() {
    if (!this._map || !this._curLayer) return;

    // Access internal Leaflet GridLayer methods
    const layer = this._curLayer as L.GridLayer & {
      _update?: () => void;
      _tiles?: Record<string, { el?: HTMLElement; coords?: { x: number; y: number; z: number } }>;
    };

    if (!layer._tiles) return;

    // Clear tile cache so we get fresh renders (not cached versions with loading patterns)
    this._tileCache.clear();

    // Re-render tiles in place by copying new rendered content
    for (const tileKey of Object.keys(layer._tiles)) {
      const tile = layer._tiles[tileKey];
      if (tile && tile.el && tile.el instanceof HTMLCanvasElement && tile.coords) {
        // Create a fresh render for this tile
        const newCanvas = this._renderTile(tile.coords);

        // Copy the new content to the existing canvas
        const ctx = tile.el.getContext("2d");
        if (ctx && newCanvas) {
          ctx.clearRect(0, 0, tile.el.width, tile.el.height);
          ctx.drawImage(newCanvas, 0, 0);
        }
      }
    }
  }

  /**
   * Check if a chunk is currently pending load.
   */
  _isChunkPending(dim: number, x: number, z: number): boolean {
    return this._pendingChunkLoads.has(`${dim}_${x}_${z}`);
  }

  /**
   * Draw a loading indicator pattern on a canvas context for a chunk area.
   */
  _drawLoadingPattern(ctx: CanvasRenderingContext2D, pixelX: number, pixelY: number, width: number, height: number) {
    // Use opaque dark background to avoid pattern accumulation
    ctx.fillStyle = "#1e1e1e";
    ctx.fillRect(pixelX, pixelY, width, height);

    // Diagonal stripes pattern
    ctx.strokeStyle = "#404040";
    ctx.lineWidth = 2;

    const stripeSpacing = 8;
    for (let i = -height; i < width + height; i += stripeSpacing) {
      ctx.beginPath();
      ctx.moveTo(pixelX + i, pixelY);
      ctx.lineTo(pixelX + i + height, pixelY + height);
      ctx.stroke();
    }

    // Small "loading" indicator in center if chunk is big enough
    if (width >= 32 && height >= 32) {
      ctx.fillStyle = "#606060";
      const dotSize = Math.min(4, width / 8);
      const centerX = pixelX + width / 2;
      const centerY = pixelY + height / 2;

      // Three dots
      ctx.beginPath();
      ctx.arc(centerX - dotSize * 2, centerY, dotSize, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(centerX, centerY, dotSize, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(centerX + dotSize * 2, centerY, dotSize, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  async _setMapOuter(elt: HTMLDivElement | null) {
    if (elt === null) {
      return;
    }

    if (elt !== this._mapOuterDiv) {
      if (this._mapDiv == null) {
        this._mapDiv = document.createElement("div") as HTMLDivElement;

        const world = this.props.world;

        let x = world.spawnX;

        if (x === undefined) {
          x = 0;
        }

        let z = world.spawnZ;

        if (z === undefined) {
          z = 0;
        }

        let minX = world.minX;

        if (minX === undefined) {
          minX = x - 10;
        }

        let maxX = world.maxX;

        if (maxX === undefined) {
          maxX = x + 10;
        }

        let minZ = world.minZ;

        if (minZ === undefined) {
          minZ = z - 10;
        }

        let maxZ = world.maxZ;

        if (maxZ === undefined) {
          maxZ = z + 10;
        }

        this._spawnX = x;
        this._spawnZ = z;
        this._minX = minX;
        this._maxX = maxX;
        this._minZ = minZ;
        this._maxZ = maxZ;

        // per leaflet:
        // In a CRS.Simple, one horizontal map unit is mapped to one horizontal pixel, and idem with vertical.
        // map is 256 pixels by 256 pixels at zoom level 0
        this._map = L.map(this._mapDiv, {
          center: [-(z / this._posToCoordDivisor), x / this._posToCoordDivisor], // in leaflet, it's y, x to match lat, long
          crs: L.CRS.Simple,
          zoom: 7,
          zoomSnap: 0.5,
          zoomDelta: 0.5,
          maxZoom: 9,
          attributionControl: false,
          keyboard: true,
          wheelPxPerZoomLevel: 120, // Smoother wheel zoom
          zoomAnimation: true,
          fadeAnimation: true,
          markerZoomAnimation: true,
        });

        this._mapElements = [];
        this._map.on("click", this._handleMapClick);
        this._map.on("mousemove", this._handleMouseMove);

        // Add keyboard event listener
        this._mapDiv.addEventListener("keydown", this._handleKeyDown);
        this._mapDiv.tabIndex = 0; // Make div focusable

        const me = this;

        // Dimension and Y-level display (top right)
        const LevelControl = L.Control.extend({
          onAdd: function (map: L.Map) {
            const div = L.DomUtil.create("div", "wm-level-control");

            const divChild = L.DomUtil.create("div");
            div.appendChild(divChild);
            me._levelStatusElt = divChild;

            return div;
          },

          onRemove: function (map: L.Map) {
            // Nothing to do here
          },
        });

        // Coordinate display (bottom left)
        const CoordsControl = L.Control.extend({
          onAdd: function (map: L.Map) {
            const div = L.DomUtil.create("div", "wm-coords-control");
            me._coordsStatusElt = div;
            div.textContent = "X: 0, Z: 0";
            return div;
          },

          onRemove: function (map: L.Map) {
            // Nothing to do here
          },
        });

        // Navigation buttons control (bottom right)
        const NavControl = L.Control.extend({
          onAdd: function (map: L.Map) {
            const div = L.DomUtil.create("div", "wm-nav-control");

            const spawnBtn = L.DomUtil.create("button", "wm-nav-btn", div);
            spawnBtn.textContent = "⌂ Spawn";
            spawnBtn.title = "Go to spawn point";
            spawnBtn.onclick = (e) => {
              e.stopPropagation();
              me.goToSpawn();
            };

            const originBtn = L.DomUtil.create("button", "wm-nav-btn", div);
            originBtn.textContent = "◎ Origin";
            originBtn.title = "Go to world origin (0, 0)";
            originBtn.onclick = (e) => {
              e.stopPropagation();
              me.goToOrigin();
            };

            const entityBtn = L.DomUtil.create("button", "wm-nav-btn wm-entity-toggle", div);
            entityBtn.textContent = "👾 Entities";
            entityBtn.title = "Toggle entity markers";
            entityBtn.onclick = (e) => {
              e.stopPropagation();
              me.toggleEntityVisibility();
              entityBtn.classList.toggle("wm-entity-toggle-off", !me._showEntities);
              entityBtn.textContent = me._showEntities ? "👾 Entities" : "👾 Entities (off)";
            };

            const trackBtn = L.DomUtil.create("button", "wm-nav-btn wm-track-camera", div);
            trackBtn.textContent = "📷 Track Camera";
            trackBtn.title = "Keep map centered on 3D camera position";
            trackBtn.onclick = (e) => {
              e.stopPropagation();
              me._toggleTrackCamera();
              trackBtn.classList.toggle("wm-track-camera-on", me._trackCamera);
              trackBtn.textContent = me._trackCamera ? "📷 Track Camera (on)" : "📷 Track Camera";
            };
            me._trackCameraBtn = trackBtn;

            return div;
          },

          onRemove: function (map: L.Map) {
            // Nothing to do here
          },
        });

        const wm = new LevelControl({ position: "topright" });
        wm.addTo(this._map);

        const coordsControl = new CoordsControl({ position: "topright" });
        coordsControl.addTo(this._map);

        const navControl = new NavControl({ position: "bottomright" });
        navControl.addTo(this._map);

        // Add scale bar
        L.control.scale({ metric: false, imperial: false, maxWidth: 100 }).addTo(this._map);

        this._applyNewWorld();
      } else if (this._mapOuterDiv != null) {
        this._mapOuterDiv.removeChild(this._mapDiv);
      }

      elt.appendChild(this._mapDiv);
      setTimeout(this._doResize, 40);
      this._mapOuterDiv = elt;

      if (this.props.onSetActiveMap) {
        this.props.onSetActiveMap(this);
      }
    }
  }

  async _applyNewWorld() {
    if (!this._map) {
      return;
    }

    // Don't do anything if we're already loading world data
    if (this._isLoadingWorld) {
      return;
    }

    const world = this.props.world;
    let worldSet = false;

    if (world !== this._lastWorldSet) {
      this._lastWorldSet = world;
      worldSet = true;

      // Unsubscribe from previous world's events
      if (this._subscribedWorld) {
        this._subscribedWorld.onDataLoaded.unsubscribe(this._handleWorldDataLoaded);
        this._subscribedWorld.onChunkUpdated.unsubscribe(this._handleChunkUpdated);
      }

      // Subscribe to this world's data loaded event to redraw when loading completes
      // Note: We subscribe to onChunkUpdated AFTER loadData() completes to avoid
      // performance issues from chunk update events firing during initial load
      this._subscribedWorld = world;
      world.onDataLoaded.subscribe(this._handleWorldDataLoaded);

      // Mark as loading to prevent concurrent calls from creating layers prematurely
      this._isLoadingWorld = true;
      this.setState({ isLoading: true, loadingMessage: "Loading world data..." });
      try {
        // Ensure the block catalog is loaded before rendering tiles
        // This prevents tiles from rendering with incorrect block types due to missing catalog data
        this.setState({ loadingMessage: "Loading block catalog..." });
        await Database.loadVanillaCatalog();

        // Load custom block definitions from the project for map color/texture support
        this.setState({ loadingMessage: "Loading custom blocks..." });
        await this._loadCustomBlockCache();

        this.setState({ loadingMessage: "Loading chunks..." });
        // Force-reload folder listings when the world is backed by remote storage
        // (e.g., HTTP via npx mct edit). The folder may have been cached before BDS
        // created the db/ directory. For local/zip worlds this is false (no-op reload).
        const forceReload = world.isListeningToStorage;
        await world.loadLevelDb(forceReload, {
          // Enable lazy loading to dramatically reduce memory usage for large worlds
          lazyLoad: true,
          // Skip full world data processing - chunks are created on-demand when accessed
          // This prevents OOM crashes for very large worlds (100k+ chunks) by avoiding
          // the upfront creation of WorldChunk objects for every chunk in Phase 2
          skipFullProcessing: true,
          // Limit chunks in memory - can be re-parsed on demand
          maxChunksInCache: 20000,
          progressCallback: (phase: string, current: number, total: number) => {
            const percent = total > 0 ? Math.round((current / total) * 100) : 0;
            this.setState({ loadingMessage: `${phase}... ${percent}%` });
          },
        });
        Log.verbose(
          "[WorldMap] LevelDB loaded. Chunks: " +
            world.chunkCount +
            ", Bounds: X(" +
            (world.minX ?? "?") +
            " to " +
            (world.maxX ?? "?") +
            "), Z(" +
            (world.minZ ?? "?") +
            " to " +
            (world.maxZ ?? "?") +
            ")"
        );

        // Now that initial loading is complete, subscribe to chunk updates
        // This handles LevelDB key supercession that may occur during user navigation
        world.onChunkUpdated.subscribe(this._handleChunkUpdated);

        // Start listening to storage events for real-time updates via WebSocket
        // This enables the map to update when files change on the server
        Log.verbose("[WorldMap] Checking storage listening: isListeningToStorage=" + world.isListeningToStorage);
        if (!world.isListeningToStorage) {
          Log.verbose("[WorldMap] Starting storage event listening for real-time updates");
          world.startListeningToStorage();
        } else {
          Log.verbose("[WorldMap] Already listening to storage events");
        }

        // Adjust memory settings based on world size
        if (world.chunkCount > 100000) {
          // Very large world (100k+ chunks): aggressive memory management
          this._tileCacheMaxSize = 200;
          this._maxRecentChunks = 1000;
          this._memoryCleanupIntervalMs = 2000;
        } else if (world.chunkCount > 50000) {
          // Large world (50k-100k chunks): moderate memory management
          this._tileCacheMaxSize = 300;
          this._maxRecentChunks = 1500;
          this._memoryCleanupIntervalMs = 3000;
        }
        // Default settings are used for smaller worlds
      } finally {
        this._isLoadingWorld = false;
        this.setState({ isLoading: false, loadingMessage: "" });
      }

      this._ensureGameStateManager();
    }

    if (worldSet || this.props.activeDimension !== this._lastDimensionSet) {
      this._lastDimensionSet = this.props.activeDimension;

      // Reset entity markers when dimension changes
      this._entityMarkersLoaded = false;
      this._clearEntityMarkers();

      this._ensureLayer();
      this._ensureDefaultMarkers();
      this._ensureDisplayMarkers();
      this._ensureEntityMarkers();
      this._updateSelection();
    }
  }

  _ensureGameStateManager() {
    if (
      !this.props.creatorTools ||
      !this.props.creatorTools.activeMinecraft ||
      !this.props.creatorTools.activeMinecraft.gameStateManager
    ) {
      return;
    }

    if (this.props.creatorTools.activeMinecraft.gameStateManager === this._gsm) {
      return;
    }

    if (this._gsm) {
      this._gsm.onPlayerTravelled.unsubscribe(this._handlePlayerTravelled);
    }

    this._gsm = this.props.creatorTools.activeMinecraft.gameStateManager;
    this._gsm.onPlayerTravelled.subscribe(this._handlePlayerTravelled);
  }

  _handleMouseMove(e: L.LeafletMouseEvent) {
    const latLng = e.latlng;
    const z = -Math.round(latLng.lat * this._posToCoordDivisor);
    const x = Math.floor(latLng.lng * this._posToCoordDivisor);

    if (this._coordsStatusElt) {
      let yDisplay = "";
      let blockDisplay = "";
      if (this._isTops) {
        const topY = this.props.world.getTopBlockY(x, z);
        // Filter out the -32768 sentinel value (means no block data exists at this position)
        if (topY !== undefined && topY > -1000) {
          const topBlock = this.props.world.getTopBlock(x, z);
          yDisplay = `, Y: ${topY}`;
          if (topBlock && topBlock.blockType) {
            blockDisplay = ` (${topBlock.blockType.friendlyName})`;
          }
        }
      } else {
        // Check if current Y is air and show floor block info
        const block = this.props.world.getBlock(new BlockLocation(x, this._yLevel, z));
        const isAir =
          !block ||
          !block.blockType ||
          block.blockType.shortId === "air" ||
          block.blockType.shortId === "void_air" ||
          block.blockType.shortId === "cave_air";

        if (isAir) {
          // Find floor block
          const topY = this.props.world.getTopBlockY(x, z);
          if (topY !== undefined && topY < this._yLevel) {
            const floorBlock = this.props.world.getTopBlock(x, z);
            yDisplay = `, Y: ${this._yLevel} (floor: ${topY})`;
            if (floorBlock && floorBlock.blockType) {
              blockDisplay = ` (${floorBlock.blockType.friendlyName})`;
            }
          } else {
            yDisplay = `, Y: ${this._yLevel}`;
            blockDisplay = ` (Air)`;
          }
        } else {
          yDisplay = `, Y: ${this._yLevel}`;
          if (block && block.blockType) {
            blockDisplay = ` (${block.blockType.friendlyName})`;
          }
        }
      }
      this._coordsStatusElt.textContent = `X: ${x}, Z: ${z}${yDisplay}${blockDisplay}`;
    }

    // Update hover position state (used for coordinate display)
    // Don't re-render Y slider on hover - it only updates when a block is selected
    if (x !== this.state.hoverX || z !== this.state.hoverZ) {
      this.setState({ hoverX: x, hoverZ: z });
    }
  }

  _setYSliderCanvas(canvas: HTMLCanvasElement | null) {
    this._ySliderCanvas = canvas;
    if (canvas) {
      this._renderYSlider();
    }
  }

  _handleSliderMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    this.setState({ isDraggingSlider: true });
    this._updateSliderFromEvent(e.nativeEvent);

    // Add global listeners for drag
    document.addEventListener("mousemove", this._handleSliderMouseMove);
    document.addEventListener("mouseup", this._handleSliderMouseUp);
  }

  _handleSliderMouseMove(e: MouseEvent) {
    if (this.state.isDraggingSlider) {
      this._updateSliderFromEvent(e);
    }
  }

  _handleSliderMouseUp(e: MouseEvent) {
    this.setState({ isDraggingSlider: false });
    document.removeEventListener("mousemove", this._handleSliderMouseMove);
    document.removeEventListener("mouseup", this._handleSliderMouseUp);
  }

  _updateSliderFromEvent(e: MouseEvent) {
    // Use the canvas element directly for accurate positioning
    if (!this._ySliderCanvas) return;

    const canvasRect = this._ySliderCanvas.getBoundingClientRect();
    const sliderHeight = canvasRect.height;
    const relativeY = Math.max(0, Math.min(sliderHeight, e.clientY - canvasRect.top));

    // Use dynamic view range if available, otherwise full range
    const viewMinY = this._sliderViewMinY;
    const viewMaxY = this._sliderViewMaxY;
    const yRange = viewMaxY - viewMinY;

    // Convert position to Y level (inverted - top is high Y, bottom is low Y)
    const newY = Math.round(viewMaxY - (relativeY / sliderHeight) * yRange);
    const clampedY = Math.max(WorldMap.MIN_Y, Math.min(WorldMap.MAX_Y, newY));

    if (clampedY !== this._yLevel) {
      this._yLevel = clampedY;
      this._isTops = false;
      this.setState({ sliderY: clampedY });
      this._ensureLayer();
      this._renderYSlider();
    }
  }

  _renderYSlider() {
    if (!this._ySliderCanvas) return;

    const canvas = this._ySliderCanvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Handle high-DPI displays for sharp text rendering
    const dpr = window.devicePixelRatio || 1;
    const displayWidth = 60;
    const displayHeight = 320;

    // Only resize if needed (avoid unnecessary reflows)
    if (canvas.width !== displayWidth * dpr || canvas.height !== displayHeight * dpr) {
      canvas.width = displayWidth * dpr;
      canvas.height = displayHeight * dpr;
      canvas.style.width = displayWidth + "px";
      canvas.style.height = displayHeight + "px";
    }

    // Scale context to match DPR
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const width = displayWidth;
    const height = displayHeight;

    // Clear canvas
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0, 0, width, height);

    // Use selected block location if available, otherwise fall back to hover location
    const sliderX = this._selectedBlockLocationFrom?.x ?? this.state.hoverX;
    const sliderZ = this._selectedBlockLocationFrom?.z ?? this.state.hoverZ;
    const dim = this.props.activeDimension || 0;

    // First pass: collect block data and find active range
    interface BlockInfo {
      y: number;
      shortId: string;
      color: string;
      icon?: string;
    }
    const blocks: BlockInfo[] = [];
    let minActiveY = WorldMap.MAX_Y;
    let maxActiveY = WorldMap.MIN_Y;

    for (let y = WorldMap.MIN_Y; y < WorldMap.MAX_Y; y++) {
      const block = this.props.world.getBlock(new BlockLocation(sliderX, y, sliderZ), dim);
      let color = "#1a1a1a";
      let shortId = "air";
      let icon: string | undefined;

      if (block && block.blockType) {
        shortId = block.blockType.shortId;
        if (shortId === "air" || shortId === "void_air" || shortId === "cave_air") {
          color = "#252525";
        } else {
          // First try standard mapColor
          color = block.blockType.mapColor || "";

          // For custom blocks, check the custom block cache or use fallback
          if (!color && block.blockType.isCustom) {
            const customInfo = this._getCustomBlockInfo(block.blockType.id);
            if (customInfo?.mapColor) {
              color = customInfo.mapColor;
            } else {
              color = BlockTypeUtilities.getCustomBlockFallbackColor(block.blockType.id);
            }
          }

          // Final fallback to gray
          if (!color) {
            color = "#808080";
          }

          icon = block.blockType.getIcon();
          // Track active range (non-air blocks)
          minActiveY = Math.min(minActiveY, y);
          maxActiveY = Math.max(maxActiveY, y);
        }
      }

      blocks.push({ y, shortId, color, icon });
    }

    // Add padding around active range
    const padding = 20;
    let viewMinY = Math.max(WorldMap.MIN_Y, minActiveY - padding);
    let viewMaxY = Math.min(WorldMap.MAX_Y, maxActiveY + padding);

    // Ensure minimum view range
    if (viewMaxY - viewMinY < 60) {
      const center = (viewMinY + viewMaxY) / 2;
      viewMinY = Math.max(WorldMap.MIN_Y, center - 30);
      viewMaxY = Math.min(WorldMap.MAX_Y, center + 30);
    }

    // Ensure current Y level is visible
    if (!this._isTops) {
      if (this._yLevel < viewMinY) viewMinY = Math.max(WorldMap.MIN_Y, this._yLevel - 10);
      if (this._yLevel > viewMaxY) viewMaxY = Math.min(WorldMap.MAX_Y, this._yLevel + 10);
    }

    const viewRange = viewMaxY - viewMinY;
    const blockHeight = height / viewRange;

    // Enable pixelated rendering for textures
    ctx.imageSmoothingEnabled = false;

    // Second pass: find contiguous regions and draw with textures
    let regionStart = viewMinY;
    let regionBlockId = "";
    let regionColor = "";
    let regionIcon: string | undefined;

    const drawRegion = (startY: number, endY: number, color: string, icon?: string) => {
      const regionHeight = endY - startY;
      const drawHeight = regionHeight * blockHeight;
      const drawY = height - (endY - viewMinY) * blockHeight;
      const drawWidth = width - 22;

      // Draw base color
      ctx.fillStyle = color;
      ctx.fillRect(0, drawY, drawWidth, drawHeight);

      // Draw texture if available and region is large enough
      if (icon && drawHeight >= 8) {
        let imageManager = this._mapTiles[icon];

        if (!imageManager) {
          imageManager = new ImageLoadManager();
          imageManager.source =
            CreatorToolsHost.getVanillaContentRoot() +
            "res/latest/van/serve/resource_pack/textures/blocks/" +
            icon +
            ".png";
          this._mapTiles[icon] = imageManager;
        }

        // Tile the texture using square tiles (keeping natural aspect ratio)
        // Use the width as the tile size to maintain square pixels
        const tileSize = drawWidth;
        const tilesNeeded = Math.ceil(drawHeight / tileSize);

        // Save context and clip to region
        ctx.save();
        ctx.imageSmoothingEnabled = false; // Re-apply after save
        ctx.beginPath();
        ctx.rect(0, drawY, drawWidth, drawHeight);
        ctx.clip();

        for (let t = 0; t < tilesNeeded; t++) {
          const tileY = drawY + t * tileSize;
          // Draw square tiles - the clipping will crop any overflow
          imageManager.use(ctx, 0, tileY, tileSize, tileSize);
        }

        ctx.restore();
        ctx.imageSmoothingEnabled = false; // Re-apply after restore
      }

      // Draw subtle border between regions
      ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
      ctx.fillRect(0, drawY, drawWidth, 1);
    };

    // Process blocks in view range
    for (let y = viewMinY; y < viewMaxY; y++) {
      const blockInfo = blocks[y - WorldMap.MIN_Y];
      if (!blockInfo) continue;

      const isAir = blockInfo.shortId === "air" || blockInfo.shortId === "void_air" || blockInfo.shortId === "cave_air";
      const currentId = isAir ? "air" : blockInfo.shortId;

      if (currentId !== regionBlockId) {
        // Draw previous region
        if (regionBlockId !== "" && y > regionStart) {
          drawRegion(regionStart, y, regionColor, regionIcon);
        }
        // Start new region
        regionStart = y;
        regionBlockId = currentId;
        regionColor = blockInfo.color;
        regionIcon = isAir ? undefined : blockInfo.icon;
      }
    }

    // Draw final region
    if (regionBlockId !== "") {
      drawRegion(regionStart, viewMaxY, regionColor, regionIcon);
    }

    // Draw Y level markers
    ctx.font = "bold 11px Arial";
    ctx.textAlign = "right";

    // Calculate appropriate marker interval based on view range
    let markerInterval: number;
    if (viewRange > 200) markerInterval = 64;
    else if (viewRange > 100) markerInterval = 32;
    else if (viewRange > 50) markerInterval = 16;
    else markerInterval = 8;

    for (
      let markerY = Math.ceil(viewMinY / markerInterval) * markerInterval;
      markerY <= viewMaxY;
      markerY += markerInterval
    ) {
      const drawY = height - (markerY - viewMinY) * blockHeight;
      ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
      ctx.fillRect(0, drawY, width - 22, 1);
      ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
      ctx.fillText(markerY.toString(), width - 2, drawY + 3);
    }

    // Draw range indicators at top and bottom
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.font = "bold 10px Arial";
    ctx.textAlign = "center";
    ctx.fillText(`▲ ${viewMaxY}`, width / 2 - 8, 12);
    ctx.fillText(`▼ ${viewMinY}`, width / 2 - 8, height - 4);

    // Draw current Y level indicator
    if (!this._isTops && this._yLevel >= viewMinY && this._yLevel <= viewMaxY) {
      const indicatorY = height - (this._yLevel - viewMinY) * blockHeight;
      ctx.fillStyle = "#ffcc00";
      ctx.fillRect(0, indicatorY - 2, width - 22, 4);
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 1;
      ctx.strokeRect(0, indicatorY - 2, width - 22, 4);

      // Draw Y value label with background
      ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
      ctx.fillRect(width - 42, indicatorY - 8, 40, 16);
      ctx.fillStyle = "#ffcc00";
      ctx.font = "bold 12px Arial";
      ctx.textAlign = "right";
      ctx.fillText(`Y:${this._yLevel}`, width - 4, indicatorY + 5);
    }

    // Draw "tops" mode indicator
    if (this._isTops) {
      const topY = this.props.world.getTopBlockY(sliderX, sliderZ);
      if (topY !== undefined && topY >= viewMinY && topY <= viewMaxY) {
        const indicatorY = height - (topY - viewMinY) * blockHeight;
        ctx.fillStyle = "#44ff44";
        ctx.fillRect(0, indicatorY - 2, width - 22, 4);
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 1;
        ctx.strokeRect(0, indicatorY - 2, width - 22, 4);

        // Draw top Y label
        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx.fillRect(width - 42, indicatorY - 8, 40, 16);
        ctx.fillStyle = "#44ff44";
        ctx.font = "bold 12px Arial";
        ctx.textAlign = "right";
        ctx.fillText(`T:${topY}`, width - 4, indicatorY + 5);
      }
    }

    // Store view range for click handling
    this._sliderViewMinY = viewMinY;
    this._sliderViewMaxY = viewMaxY;
  }

  _handleKeyDown(e: KeyboardEvent) {
    if (!this._map) return;

    const panAmount = 50;

    switch (e.key) {
      case "ArrowUp":
      case "w":
      case "W":
        this._map.panBy([0, -panAmount]);
        e.preventDefault();
        break;
      case "ArrowDown":
      case "s":
      case "S":
        this._map.panBy([0, panAmount]);
        e.preventDefault();
        break;
      case "ArrowLeft":
      case "a":
      case "A":
        this._map.panBy([-panAmount, 0]);
        e.preventDefault();
        break;
      case "ArrowRight":
      case "d":
      case "D":
        this._map.panBy([panAmount, 0]);
        e.preventDefault();
        break;
      case "+":
      case "=":
        this._map.zoomIn();
        e.preventDefault();
        break;
      case "-":
      case "_":
        this._map.zoomOut();
        e.preventDefault();
        break;
      case "Home":
        this.goToSpawn();
        e.preventDefault();
        break;
      case "0":
        this.goToOrigin();
        e.preventDefault();
        break;
    }
  }

  goToSpawn() {
    if (!this._map) return;
    this._map.setView(
      [-(this._spawnZ / this._posToCoordDivisor), this._spawnX / this._posToCoordDivisor],
      this._map.getZoom()
    );
  }

  goToOrigin() {
    if (!this._map) return;
    this._map.setView([0, 0], this._map.getZoom());
  }

  /**
   * Called by WorldDisplay to update the camera position on the map.
   * Bypasses React state/props for performance — updates Leaflet directly.
   */
  setCameraPosition(x: number, y: number, z: number, yaw: number) {
    this._cameraX = x;
    this._cameraY = y;
    this._cameraZ = z;
    this._cameraYaw = yaw;
    this._updateCameraMarker();
  }

  _toggleTrackCamera() {
    this._trackCamera = !this._trackCamera;
    Log.verbose(`[WorldMap] Track camera: ${this._trackCamera}, hasCamera: ${this._cameraX !== undefined}`);
    if (this._trackCamera) {
      this._updateCameraMarker();
    }
  }

  /**
   * Update or create the camera marker on the map based on current camera props.
   * Uses a CSS-rotated arrow as a direction indicator.
   */
  _updateCameraMarker() {
    if (!this._map) {
      Log.debug(`[WorldMap] _updateCameraMarker: no map`);
      return;
    }

    const cameraX = this._cameraX;
    const cameraZ = this._cameraZ;
    const cameraYaw = this._cameraYaw;
    if (cameraX === undefined || cameraZ === undefined) {
      Log.debug(`[WorldMap] _updateCameraMarker: no camera position`);
      return;
    }

    const lat = -cameraZ / this._posToCoordDivisor;
    const lng = cameraX / this._posToCoordDivisor;
    const latLng: L.LatLngExpression = [lat, lng];

    // Minecraft yaw: 0=south(+Z), 90=west(-X), 180=north(-Z), 270=east(+X)
    // CSS rotation: 0=up(north). So CSS angle = yaw + 180.
    const cssAngle = (cameraYaw ?? 0) + 180;

    if (!this._cameraMarker) {
      const icon = L.divIcon({
        className: "wm-camera-icon",
        html: `<div class="wm-camera-arrow" style="transform: rotate(${cssAngle}deg)">&#x25B2;</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });
      this._cameraMarker = L.marker(latLng, { icon, interactive: false, zIndexOffset: 1000 });
      this._cameraMarker.addTo(this._map);
    } else {
      this._cameraMarker.setLatLng(latLng);
      const el = this._cameraMarker.getElement();
      const arrow = el?.querySelector(".wm-camera-arrow") as HTMLElement | null;
      if (arrow) {
        arrow.style.transform = `rotate(${cssAngle}deg)`;
      }
    }

    if (this._trackCamera) {
      this._map.setView(latLng, this._map.getZoom(), { animate: false });
    }
  }

  _handleMapClick(e: L.LeafletMouseEvent) {
    const latLng = e.latlng;

    let y = this._yLevel;
    const z = -Math.round(latLng.lat * this._posToCoordDivisor);
    const x = Math.floor(latLng.lng * this._posToCoordDivisor);

    if (this._isTops) {
      const topY = this.props.world.getTopBlockY(x, z);

      if (topY) {
        y = topY;
      }
    }

    this._selectedBlockLocationFrom = new BlockLocation(x, y, z);
    this._selectedBlockLocationTo = this._selectedBlockLocationFrom;

    if (this.props.onSelectionChange) {
      this.props.onSelectionChange(this._selectedBlockLocationFrom, this._selectedBlockLocationTo);
    }

    this._updateSelection();
    this._renderYSlider(); // Update Y slider to show column at selected location
  }

  _updateSelection() {
    if (!this._map) {
      return;
    }

    if (!this._selectedBlockLocationFrom || !this._selectedBlockLocationTo) {
      if (this._selectionRectangle) {
        this._selectionRectangle.removeFrom(this._map);
      }

      return;
    }

    const bounds = new L.LatLngBounds([
      [
        -this._selectedBlockLocationFrom.z / this._posToCoordDivisor,
        this._selectedBlockLocationFrom.x / this._posToCoordDivisor,
      ],
      [
        -(this._selectedBlockLocationTo.z + 1) / this._posToCoordDivisor,
        (this._selectedBlockLocationTo.x + 1) / this._posToCoordDivisor,
      ],
    ]);

    if (!this._selectionRectangle) {
      this._selectionRectangle = L.rectangle(bounds, { color: "#ff7800", weight: 3 });
    }

    this._selectionRectangle.setBounds(bounds);

    this._selectionRectangle.addTo(this._map);
  }

  setView(from: BlockLocation, to: BlockLocation) {
    if (!this._map) {
      return;
    }

    const bounds = new L.LatLngBounds([
      [-from.z / this._posToCoordDivisor, from.x / this._posToCoordDivisor],
      [-(to.z + 1) / this._posToCoordDivisor, (to.x + 1) / this._posToCoordDivisor],
    ]);

    this._map.setView(bounds.getCenter());
  }

  _ensureDisplayMarkers() {
    if (!this._map) {
      return;
    }

    const widos = this.props.displayObjects;

    if (widos) {
      for (let i = 0; i < widos.length; i++) {
        const wido = widos[i];

        if (wido && wido.from && wido.type === WorldDisplayObjectType.point) {
          const x = wido.from.x;
          const z = wido.from.z;

          let marker = this._mapElements[wido.id];

          const pos = new L.LatLng(-z / this._posToCoordDivisor, x / this._posToCoordDivisor);

          if (marker === undefined) {
            const icon = L.icon({
              iconUrl:
                CreatorToolsHost.getVanillaContentRoot() +
                "res/latest/van/serve/resource_pack/textures/blocks/bed_feet_end.png",
              iconSize: [32, 32],
              className: "wm-spawnIcon",
              iconAnchor: [0, 0],
              popupAnchor: [-3, -76],
            });

            marker = L.marker(pos, {
              icon: icon,
            });
            this._mapElements[wido.id] = marker;

            marker.addTo(this._map);
          } else {
            (marker as L.Marker).setLatLng(pos);
          }
        } else if (wido && wido.points.length > 1 && wido.type === WorldDisplayObjectType.path) {
          let path = this._mapElements[wido.id];

          const latLngs: LatLngExpression[] = [];

          for (let i = 0; i < wido.points.length; i++) {
            const point = wido.points[i];
            const pos = new L.LatLng(-point.z / this._posToCoordDivisor, point.x / this._posToCoordDivisor);
            latLngs.push(pos);
          }

          if (path === undefined) {
            path = new L.Polyline(latLngs, { color: "red" });
            this._mapElements[wido.id] = path;
            path.addTo(this._map);
          } else {
            (path as L.Polyline).setLatLngs(latLngs);
          }
        }
      }
    }
  }

  _ensureDefaultMarkers() {
    if (!this._map) {
      return;
    }

    const world = this.props.world;

    let x = world.spawnX;

    if (x === undefined) {
      x = 0;
    }

    let z = world.spawnZ;

    if (z === undefined) {
      z = 0;
    }

    if (!this._spawnLocationMarker) {
      const icon = L.icon({
        iconUrl:
          CreatorToolsHost.getVanillaContentRoot() +
          "res/latest/van/serve/resource_pack/textures/blocks/bed_feet_end.png",
        iconSize: [32, 32],
        className: "wm-spawnIcon",
        iconAnchor: [0, 0],
        popupAnchor: [-3, -76],
      });

      this._spawnLocationMarker = L.marker([-z / this._posToCoordDivisor, x / this._posToCoordDivisor], {
        icon: icon,
      });
      this._spawnLocationMarker.addTo(this._map);
    }

    this._spawnLocationMarker.setLatLng([-z / this._posToCoordDivisor, x / this._posToCoordDivisor]);

    if (this._gsm) {
      const playerLocationHistory = this._gsm.playerLocationHistory;
      if (playerLocationHistory) {
        const latLngs: LatLngExpression[] = [];

        for (let i = 0; i < playerLocationHistory.length; i++) {
          const point = playerLocationHistory[i];
          const pos = new L.LatLng(-point.z / this._posToCoordDivisor, point.x / this._posToCoordDivisor);
          latLngs.push(pos);
        }

        if (!this._playerPath) {
          this._playerPath = new L.Polyline(latLngs, { color: "green" });
          this._playerPath.addTo(this._map);
        } else {
          this._playerPath.setLatLngs(latLngs);
        }
      }

      const playerLocation = this._gsm.playerLocation;

      if (playerLocation) {
        if (!this._playerMarker) {
          const myIcon = L.icon({
            iconUrl:
              CreatorToolsHost.getVanillaContentRoot() +
              "res/latest/van/serve/resource_pack/textures/ui/icon_steve.png",
            iconSize: [32, 32],
            className: "wm-playerIcon",
            iconAnchor: [16, 16],
            popupAnchor: [-3, -76],
          });

          this._playerMarker = L.marker(
            [-(playerLocation.z - 1) / this._posToCoordDivisor, (playerLocation.x - 1) / this._posToCoordDivisor],
            { icon: myIcon }
          );
          this._playerMarker.addTo(this._map);
        }

        this._playerMarker.setLatLng([
          -(playerLocation.z - 1) / this._posToCoordDivisor,
          (playerLocation.x - 1) / this._posToCoordDivisor,
        ]);
      }
    }
  }

  /**
   * Loads and displays entity markers on the map.
   * Entities are extracted from both modern (actorsById) and legacy (chunk entity data) sources.
   *
   * Modern format (1.18.30+): Actors stored individually with actorprefix keys
   * Legacy format (pre-1.18.30): Entity data stored per-chunk as type 50 blob
   *
   * See: https://learn.microsoft.com/en-us/minecraft/creator/documents/actorstorage
   */
  _ensureEntityMarkers() {
    if (!this._map || !this.props.world || !this._showEntities) {
      return;
    }

    // Only load entities once per world
    if (this._entityMarkersLoaded) {
      return;
    }
    this._entityMarkersLoaded = true;

    // Clear existing entity markers
    this._clearEntityMarkers();

    // Create a layer group for entities
    this._entityLayerGroup = L.layerGroup();
    this._entityLayerGroup.addTo(this._map);

    const world = this.props.world;
    const dimension = this.props.activeDimension ?? 0;

    let entityCount = 0;
    let modernActorCount = 0;
    let legacyEntityCount = 0;
    const maxEntities = 500; // Limit to prevent performance issues

    // Track entity unique IDs to avoid duplicates between modern and legacy sources
    const processedEntityIds = new Set<string>();

    // === Modern actor storage (1.18.30+) ===
    // Actors are stored individually with actorprefix keys in world.actorsById
    const actors = world.actorsById;
    if (actors && Object.keys(actors).length > 0) {
      for (const actorId in actors) {
        if (entityCount >= maxEntities) {
          break;
        }

        const actor = actors[actorId];

        // Filter by dimension if available
        if (actor.lastDimensionId !== undefined && actor.lastDimensionId !== dimension) {
          continue;
        }

        // Skip actors without position
        if (!actor.pos || actor.pos.length < 3) {
          continue;
        }

        // Track by unique ID to avoid duplicates
        if (actor.uniqueId !== undefined) {
          processedEntityIds.add(actor.uniqueId.toString());
        }

        // Create a marker for this actor
        const marker = this._createActorMarker(actor);
        if (marker) {
          marker.addTo(this._entityLayerGroup);
          this._entityMarkers.push(marker);
          entityCount++;
          modernActorCount++;
        }
      }
    }

    // === Legacy entity storage (pre-1.18.30) ===
    // Entity data stored per-chunk as type 50 (Entity) blob
    const dimChunks = world.chunks.get(dimension);
    if (dimChunks && entityCount < maxEntities) {
      for (const [, xChunks] of dimChunks) {
        if (entityCount >= maxEntities) break;

        for (const [, chunk] of xChunks) {
          if (entityCount >= maxEntities) break;

          const entities = chunk.entities;
          for (const entity of entities) {
            if (entityCount >= maxEntities) break;

            // Skip if we already processed this entity from modern storage
            if (entity.uniqueId !== undefined && processedEntityIds.has(entity.uniqueId.toString())) {
              continue;
            }

            // Create a marker for this legacy entity
            const marker = this._createChunkEntityMarker(entity);
            if (marker) {
              marker.addTo(this._entityLayerGroup);
              this._entityMarkers.push(marker);
              entityCount++;
              legacyEntityCount++;
            }
          }
        }
      }
    }
  }

  /**
   * Creates a Leaflet marker for an actor (modern storage format).
   */
  _createActorMarker(actor: import("../../minecraft/ActorItem").default): L.Marker | undefined {
    if (!this._map || !actor.pos || actor.pos.length < 3) {
      return undefined;
    }

    // Get the entity identifier
    const identifier = actor.identifier || "unknown";

    // Get icon based on entity type
    const iconInfo = this._getActorIcon(actor);

    const icon = L.divIcon({
      className: `wm-entityIcon wm-entityIcon-${iconInfo.category}`,
      html: `<div class="wm-entityIconInner" style="background-color: ${iconInfo.color};" title="${iconInfo.shortName}">
        ${iconInfo.emoji}
      </div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });

    const marker = L.marker([-actor.pos[2] / this._posToCoordDivisor, actor.pos[0] / this._posToCoordDivisor], {
      icon: icon,
    });

    // Add click handler to select the entity
    marker.on("click", (e) => {
      L.DomEvent.stopPropagation(e);

      if (this.props.onEntitySelect) {
        const entityInfo: ISelectedEntityInfo = {
          identifier: identifier,
          shortName: iconInfo.shortName,
          x: actor.pos![0],
          y: actor.pos![1],
          z: actor.pos![2],
          isBaby: actor.isBaby,
          isTamed: actor.isTamed,
          category: iconInfo.category,
          emoji: iconInfo.emoji,
          color: iconInfo.color,
          source: "actor",
          actorItem: actor,
        };
        this.props.onEntitySelect(entityInfo);
      }
    });

    return marker;
  }

  /**
   * Gets icon information for an actor based on its type.
   */
  _getActorIcon(actor: import("../../minecraft/ActorItem").default): {
    emoji: string;
    color: string;
    category: string;
    shortName: string;
  } {
    const identifier = actor.identifier || "unknown";
    const shortId = identifier.replace("minecraft:", "");

    // Get a short, human-readable name
    const shortName = shortId
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

    // Hostile mobs
    const hostileMobs = [
      "zombie",
      "skeleton",
      "creeper",
      "spider",
      "cave_spider",
      "enderman",
      "witch",
      "slime",
      "magma_cube",
      "blaze",
      "ghast",
      "wither_skeleton",
      "zombie_pigman",
      "zombified_piglin",
      "piglin",
      "piglin_brute",
      "hoglin",
      "zoglin",
      "drowned",
      "husk",
      "stray",
      "phantom",
      "pillager",
      "vindicator",
      "evoker",
      "ravager",
      "vex",
      "warden",
      "elder_guardian",
      "guardian",
      "shulker",
      "endermite",
      "silverfish",
      "breeze",
      "bogged",
    ];

    // Passive mobs
    const passiveMobs = [
      "cow",
      "pig",
      "sheep",
      "chicken",
      "horse",
      "donkey",
      "mule",
      "llama",
      "wolf",
      "cat",
      "ocelot",
      "parrot",
      "rabbit",
      "fox",
      "bee",
      "turtle",
      "dolphin",
      "squid",
      "glow_squid",
      "cod",
      "salmon",
      "tropical_fish",
      "pufferfish",
      "axolotl",
      "goat",
      "frog",
      "tadpole",
      "allay",
      "camel",
      "sniffer",
      "armadillo",
      "villager",
      "wandering_trader",
      "snow_golem",
      "iron_golem",
      "bat",
      "mooshroom",
      "panda",
      "polar_bear",
      "strider",
    ];

    if (shortId === "player") {
      return { emoji: "👤", color: "#4CAF50", category: "player", shortName };
    } else if (hostileMobs.includes(shortId)) {
      return { emoji: "👹", color: "#f44336", category: "hostile", shortName };
    } else if (passiveMobs.includes(shortId)) {
      return { emoji: "🐄", color: "#8BC34A", category: "passive", shortName };
    } else if (shortId === "item") {
      return { emoji: "📦", color: "#FF9800", category: "item", shortName };
    } else {
      return { emoji: "❓", color: "#9E9E9E", category: "other", shortName };
    }
  }

  /**
   * Creates a Leaflet marker for a legacy chunk entity (pre-1.18.30 storage format).
   */
  _createChunkEntityMarker(entity: import("../../minecraft/ChunkEntity").default): L.Marker | undefined {
    if (!this._map) {
      return undefined;
    }

    // Get icon based on entity type
    const iconInfo = this._getChunkEntityIcon(entity);

    const icon = L.divIcon({
      className: `wm-entityIcon wm-entityIcon-${entity.category}`,
      html: `<div class="wm-entityIconInner" style="background-color: ${iconInfo.color};" title="${entity.shortName}">
        ${iconInfo.emoji}
      </div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });

    const marker = L.marker([-entity.z / this._posToCoordDivisor, entity.x / this._posToCoordDivisor], {
      icon: icon,
    });

    // Add click handler to select the entity
    marker.on("click", (e) => {
      L.DomEvent.stopPropagation(e);

      if (this.props.onEntitySelect) {
        const entityInfo: ISelectedEntityInfo = {
          identifier: entity.identifier,
          shortName: entity.shortName,
          x: entity.x,
          y: entity.y,
          z: entity.z,
          isBaby: entity.isBaby,
          isTamed: entity.isTamed,
          customName: entity.customName,
          category: entity.category,
          emoji: iconInfo.emoji,
          color: iconInfo.color,
          source: "chunk",
          chunkEntity: entity,
        };
        this.props.onEntitySelect(entityInfo);
      }
    });

    return marker;
  }

  /**
   * Gets icon information for a legacy chunk entity based on its type.
   */
  _getChunkEntityIcon(entity: import("../../minecraft/ChunkEntity").default): { emoji: string; color: string } {
    const shortId = entity.identifier.replace("minecraft:", "");

    // Hostile mobs
    const hostileMobs = [
      "zombie",
      "skeleton",
      "creeper",
      "spider",
      "cave_spider",
      "enderman",
      "witch",
      "slime",
      "magma_cube",
      "blaze",
      "ghast",
      "wither_skeleton",
      "zombie_pigman",
      "zombified_piglin",
      "piglin",
      "piglin_brute",
      "hoglin",
      "zoglin",
      "drowned",
      "husk",
      "stray",
      "phantom",
      "pillager",
      "vindicator",
      "evoker",
      "ravager",
      "vex",
      "warden",
      "elder_guardian",
      "guardian",
      "shulker",
      "endermite",
      "silverfish",
      "breeze",
      "bogged",
    ];

    // Passive mobs
    const passiveMobs = [
      "cow",
      "pig",
      "sheep",
      "chicken",
      "horse",
      "donkey",
      "mule",
      "llama",
      "wolf",
      "cat",
      "ocelot",
      "parrot",
      "rabbit",
      "fox",
      "bee",
      "turtle",
      "dolphin",
      "squid",
      "glow_squid",
      "cod",
      "salmon",
      "tropical_fish",
      "pufferfish",
      "axolotl",
      "goat",
      "frog",
      "tadpole",
      "allay",
      "camel",
      "sniffer",
      "armadillo",
      "villager",
      "wandering_trader",
      "snow_golem",
      "iron_golem",
      "bat",
      "mooshroom",
      "panda",
      "polar_bear",
      "strider",
    ];

    if (shortId === "player") {
      return { emoji: "👤", color: "#4CAF50" };
    } else if (hostileMobs.includes(shortId)) {
      return { emoji: "👹", color: "#f44336" };
    } else if (passiveMobs.includes(shortId)) {
      return { emoji: "🐄", color: "#8BC34A" };
    } else if (shortId === "item") {
      return { emoji: "📦", color: "#FF9800" };
    } else {
      return { emoji: "❓", color: "#9E9E9E" };
    }
  }

  /**
   * Clears all entity markers from the map.
   */
  _clearEntityMarkers() {
    if (this._entityLayerGroup) {
      this._entityLayerGroup.clearLayers();
      if (this._map) {
        this._map.removeLayer(this._entityLayerGroup);
      }
      this._entityLayerGroup = undefined;
    }
    this._entityMarkers = [];
  }

  /**
   * Toggles entity visibility on the map.
   */
  toggleEntityVisibility() {
    this._showEntities = !this._showEntities;

    if (this._showEntities) {
      this._entityMarkersLoaded = false;
      this._ensureEntityMarkers();
    } else {
      this._clearEntityMarkers();
    }
  }

  _handlePlayerTravelled(gsm: GameStateManager, message: IPlayerTravelledEvent) {
    this._ensureDefaultMarkers();

    // Center the map on the player the first time we receive their position.
    // This handles the common case where the map initially centers on spawn (0,0)
    // but the player is actually far away from spawn.
    if (!this._hasCenteredOnPlayer && this._map && gsm.playerLocation) {
      this._hasCenteredOnPlayer = true;
      const loc = gsm.playerLocation;
      this._map.setView(
        [-(loc.z - 1) / this._posToCoordDivisor, (loc.x - 1) / this._posToCoordDivisor],
        this._map.getZoom(),
        { animate: true }
      );
    }
  }

  /**
   * Invalidates the tile cache, forcing all tiles to be re-rendered.
   * Call this when world data changes or display mode changes.
   */
  _invalidateTileCache() {
    this._tileCacheVersion++;
    // Don't clear the cache immediately - old tiles can still be used as placeholders
    // while new ones are being rendered. The version number ensures fresh renders.

    // If cache is too large, prune old entries
    if (this._tileCache.size > this._tileCacheMaxSize) {
      // Simple LRU-like pruning: clear half the cache
      const entries = Array.from(this._tileCache.keys());
      const toRemove = entries.slice(0, Math.floor(entries.length / 2));
      for (const key of toRemove) {
        this._tileCache.delete(key);
      }
    }
  }

  /**
   * Performs memory cleanup for large worlds by clearing chunk data that hasn't been accessed recently.
   * This helps prevent out-of-memory errors when viewing very large worlds (100k+ chunks).
   * Only clears parsed data (subchunks, palettes, etc.) - raw LevelKeyValue data is preserved
   * so chunks can be re-parsed if needed.
   */
  _performMemoryCleanup() {
    const now = Date.now();

    // Don't run cleanup too frequently
    if (now - this._lastMemoryCleanupTime < this._memoryCleanupIntervalMs) {
      return;
    }

    this._lastMemoryCleanupTime = now;

    const world = this.props.world;
    if (!world || world.chunkCount < 10000) {
      // Only apply aggressive cleanup for large worlds
      return;
    }

    const dim = this.props.activeDimension ?? 0;
    const dimChunks = world.chunks.get(dim);
    if (!dimChunks) {
      return;
    }

    let clearedCount = 0;

    // Iterate through all chunks and clear data for ones not recently accessed
    for (const [x, xPlane] of dimChunks) {
      for (const [z, chunk] of xPlane) {
        const chunkKey = `${dim}_${x}_${z}`;

        if (!this._recentlyAccessedChunks.has(chunkKey)) {
          // This chunk wasn't accessed recently, clear its cached data to free memory
          chunk.clearCachedData();
          clearedCount++;
        }
      }
    }

    // Clear the recently accessed set for the next cycle
    // Keep it if not too large, otherwise prune the oldest entries
    if (this._recentlyAccessedChunks.size > this._maxRecentChunks) {
      // Convert to array, keep only the most recent half
      const entries = Array.from(this._recentlyAccessedChunks);
      this._recentlyAccessedChunks.clear();
      const keepCount = Math.floor(entries.length / 2);
      for (let i = entries.length - keepCount; i < entries.length; i++) {
        this._recentlyAccessedChunks.add(entries[i]);
      }
    }

    if (clearedCount > 0) {
      // Log for debugging, can be removed later
      // console.log(`WorldMap: Cleared cached data from ${clearedCount} chunks`);
    }
  }

  /**
   * Generates a cache key for a tile based on its coordinates and current display settings.
   */
  _getTileCacheKey(coords: { x: number; y: number; z: number }): string {
    const dim = this.props.activeDimension ?? 0;
    return `${this._tileCacheVersion}_${dim}_${coords.z}_${coords.x}_${coords.y}_${this._yLevel}_${this._isTops}`;
  }

  _ensureLayer() {
    if (!this._map) {
      return;
    }

    // Invalidate tile cache when layer is rebuilt
    this._invalidateTileCache();

    if (this._levelStatusElt) {
      let where = "Overworld";

      switch (this.props.activeDimension) {
        case 1:
          where = "Nether";
          break;

        case 2:
          where = "The End";
          break;
      }

      where += " ";

      if (this._isTops) {
        where += "Tops";
      } else {
        where += this._yLevel;
      }

      this._levelStatusElt.textContent = where;
    }
    if (this._curLayer) {
      this._map.removeLayer(this._curLayer);
    }

    const MCLayer = L.GridLayer.extend({
      createTile: this._renderTile,
      options: {
        updateWhenZooming: false, // Don't update tiles during zoom animation
        updateWhenIdle: true, // Update when zoom animation ends
        keepBuffer: 2, // Keep some tiles in buffer for smoother panning
      },
    });

    this._curLayer = new MCLayer();

    (this._curLayer as L.GridLayer).addTo(this._map);
  }

  setTopsLevel(): void {
    this._isTops = !this._isTops;

    this._ensureLayer();
  }

  mapLevelPlus(): void {
    this._isTops = false;
    this._yLevel++;
    this._ensureLayer();
  }

  mapLevelMinus(): void {
    this._isTops = false;
    this._yLevel--;
    this._ensureLayer();
  }

  componentDidUpdate(prevProps: IWorldMapProps, prevState: IWorldMapState) {
    this._applyNewWorld();

    // Retry GameStateManager subscription if it wasn't available during initial load.
    // activeMinecraft and its gameStateManager may initialize after the map first renders.
    if (!this._gsm) {
      this._ensureGameStateManager();
    }
  }

  _renderTile(coords: { x: number; y: number; z: number }) {
    // Check tile cache first for instant return
    const cacheKey = this._getTileCacheKey(coords);
    const cachedTile = this._tileCache.get(cacheKey);
    if (cachedTile) {
      // Return a clone of the cached tile to avoid Leaflet reusing the same canvas
      const clonedTile = L.DomUtil.create("canvas", "leaflet-tile") as HTMLCanvasElement;
      clonedTile.width = 256;
      clonedTile.height = 256;
      const clonedCtx = clonedTile.getContext("2d");
      if (clonedCtx) {
        clonedCtx.drawImage(cachedTile, 0, 0);
      }
      return clonedTile;
    }

    let chunksInTile = 1;
    let pixelsPerBlock = 16; // At zoom 7, 16 pixels per block

    // Sub-chunk rendering for zoom > 7
    let blocksPerTile = 16; // At zoom 7, 16 blocks per tile (one chunk)
    let blockOffsetX = 0;
    let blockOffsetZ = 0;

    if (coords.z < 7) {
      chunksInTile = Math.pow(2, 7 - coords.z);
      pixelsPerBlock = 256 / (chunksInTile * 16);
    } else if (coords.z > 7) {
      // Zoom levels > 7: each tile shows a fraction of a chunk
      // zoom 8: 32 pixels per block (8x8 blocks per tile)
      // zoom 9: 64 pixels per block (4x4 blocks per tile)
      const zoomFactor = Math.pow(2, coords.z - 7);
      pixelsPerBlock = 16 * zoomFactor;
      blocksPerTile = Math.floor(16 / zoomFactor);

      // Calculate which portion of the chunk this tile represents
      // Use proper modulo that works with negative numbers
      blockOffsetX = (((coords.x % zoomFactor) + zoomFactor) % zoomFactor) * blocksPerTile;
      blockOffsetZ = (((coords.y % zoomFactor) + zoomFactor) % zoomFactor) * blocksPerTile;
    }

    // For zoom > 7, calculate chunk coordinates differently
    let tX: number, tY: number;
    if (coords.z > 7) {
      const zoomFactor = Math.pow(2, coords.z - 7);
      tX = Math.floor(coords.x / zoomFactor);
      tY = Math.floor(coords.y / zoomFactor);
    } else {
      tX = Math.floor(coords.x * chunksInTile);
      tY = Math.floor(coords.y * chunksInTile);
    }

    // Calculate actual world coordinates for this tile
    // X coordinate: chunk X * 16 + block offset within chunk
    // Z coordinate: In Leaflet's simple CRS, tile Y increases downward while lat increases upward.
    // Since lat = -z/divisor (z negated), and tile Y ~ -lat, we have tY ~ z (not negated).
    // So worldZ = tY * 16 + blockOffsetZ (no negation needed)
    const worldX = tX * 16 + blockOffsetX;
    const worldZ = tY * 16 + blockOffsetZ;
    const tileHtml = `${worldX}, ${worldZ}`;

    // create a <canvas> element for drawing
    const tile = L.DomUtil.create("canvas", "leaflet-tile") as HTMLCanvasElement;

    tile.width = 256;
    tile.height = 256;

    // get a canvas context and draw something on it using coords.x, coords.y and coords.z
    const ctx = tile.getContext("2d");

    const dim = this.props.activeDimension ? this.props.activeDimension : 0;

    if (ctx) {
      // Disable image smoothing for crisp pixelated textures (Minecraft style)
      ctx.imageSmoothingEnabled = false;

      // At very low zoom levels, skip chunks to reduce memory pressure
      // This samples representative chunks instead of iterating all of them
      let chunkIncrement = 1;
      if (chunksInTile >= 64) {
        chunkIncrement = 8; // At 64+ chunks per tile, sample every 8th chunk
      } else if (chunksInTile >= 32) {
        chunkIncrement = 4; // At 32+ chunks per tile, sample every 4th chunk
      } else if (chunksInTile >= 16) {
        chunkIncrement = 2; // At 16+ chunks per tile, sample every 2nd chunk
      }

      // Track if this tile has any incomplete/loading chunks
      // Tiles with loading indicators should NOT be cached
      let tileHasLoadingChunks = false;

      // First pass: queue missing chunks for loading using sparse sampling strategy
      // When zoomed out, we use a two-phase approach:
      // 1. First queue "sparse sample" chunks at regular intervals (high priority)
      // 2. The processing loop will expand from non-empty chunks to fill in neighbors
      for (let chunkInTileX = 0; chunkInTileX < chunksInTile; chunkInTileX += chunkIncrement) {
        for (let chunkInTileZ = 0; chunkInTileZ < chunksInTile; chunkInTileZ += chunkIncrement) {
          const chunkX = tX + chunkInTileX;
          const chunkZ = tY + chunkInTileZ;
          const chunkKey = `${dim}_${chunkX}_${chunkZ}`;

          // Skip if we already know this chunk is empty
          if (this._emptyChunks.has(chunkKey)) {
            continue;
          }

          // Check if chunk exists
          const chunk = this.props.world.getChunkAt(dim, chunkX, chunkZ);

          if (!chunk) {
            // Check if world has bounds that include this chunk
            const worldMinX = this.props.world.minX ?? -1000000;
            const worldMaxX = this.props.world.maxX ?? 1000000;
            const worldMinZ = this.props.world.minZ ?? -1000000;
            const worldMaxZ = this.props.world.maxZ ?? 1000000;

            const chunkWorldX = chunkX * 16;
            const chunkWorldZ = chunkZ * 16;

            if (
              chunkWorldX >= worldMinX - 16 &&
              chunkWorldX <= worldMaxX + 16 &&
              chunkWorldZ >= worldMinZ - 16 &&
              chunkWorldZ <= worldMaxZ + 16
            ) {
              // Determine priority based on sparse sampling position and neighbors
              // Chunks at sparse sample points get high priority (0)
              // Chunks near known non-empty chunks also get higher priority
              let priority = 10; // Default normal priority

              // Is this a sparse sample point? (first chunk in each sample grid cell)
              const isSparsePoint =
                chunkInTileX % (chunkIncrement * 2) === 0 && chunkInTileZ % (chunkIncrement * 2) === 0;
              if (isSparsePoint) {
                priority = 0; // High priority for sparse samples
              } else {
                // Check if any neighbor is known to be non-empty
                const hasNonEmptyNeighbor =
                  this._nonEmptyChunks.has(`${dim}_${chunkX - 1}_${chunkZ}`) ||
                  this._nonEmptyChunks.has(`${dim}_${chunkX + 1}_${chunkZ}`) ||
                  this._nonEmptyChunks.has(`${dim}_${chunkX}_${chunkZ - 1}`) ||
                  this._nonEmptyChunks.has(`${dim}_${chunkX}_${chunkZ + 1}`);

                if (hasNonEmptyNeighbor) {
                  priority = 5; // Medium priority for neighbors of non-empty
                }
              }

              // Queue this chunk for loading with appropriate priority
              this._queueChunkLoad(dim, chunkX, chunkZ, priority);
              tileHasLoadingChunks = true;
            }
          }
        }
      }

      // If tile has missing chunks, draw a single loading pattern for the entire tile
      // This looks cleaner than per-chunk patterns, especially when zoomed out
      if (tileHasLoadingChunks) {
        this._drawLoadingPattern(ctx, 0, 0, 256, 256);
      }

      // For sparse worlds at zoomed-out levels, the sparse sampling grid above may
      // miss isolated chunks. To fix this, iterate ALL known chunks in the world index
      // and queue/render any that fall within this tile's bounds but were skipped.
      // This is O(N) over the world's chunk count, which is fast even for large worlds.
      if (chunkIncrement > 1) {
        const knownChunks = this.props.world.knownChunkKeys;
        for (const chunkKey of knownChunks) {
          // Parse "dim_x_z" format
          const parts = chunkKey.split("_");
          if (parts.length !== 3) continue;
          const chunkDim = parseInt(parts[0], 10);
          if (chunkDim !== dim) continue;
          const chunkX = parseInt(parts[1], 10);
          const chunkZ = parseInt(parts[2], 10);

          // Check if this chunk falls within this tile's chunk bounds
          if (chunkX < tX || chunkX >= tX + chunksInTile) continue;
          if (chunkZ < tY || chunkZ >= tY + chunksInTile) continue;

          // Skip if already known empty or loaded
          const ck = `${dim}_${chunkX}_${chunkZ}`;
          if (this._emptyChunks.has(ck)) continue;
          if (this.props.world.getChunkAt(dim, chunkX, chunkZ)) continue;

          // Queue this chunk for loading
          this._queueChunkLoad(dim, chunkX, chunkZ, 2); // High priority — known to exist
          tileHasLoadingChunks = true;
        }
      }

      // Second pass: render chunks we have on top of the loading pattern.
      // Build a list of (chunkX, chunkZ, chunkInTileX, chunkInTileZ, isGridChunk) to render.
      // For the normal sampling grid we use chunkIncrement-aligned positions;
      // for known chunks from the world index we compute positions exactly.
      const chunksToRender: Array<{
        chunkX: number;
        chunkZ: number;
        inTileX: number;
        inTileZ: number;
        isGridChunk: boolean;
      }> = [];
      const renderedChunkKeys = new Set<string>();

      // Normal sampling grid
      for (let chunkInTileX = 0; chunkInTileX < chunksInTile; chunkInTileX += chunkIncrement) {
        for (let chunkInTileZ = 0; chunkInTileZ < chunksInTile; chunkInTileZ += chunkIncrement) {
          const chunkX = tX + chunkInTileX;
          const chunkZ = tY + chunkInTileZ;
          const key = `${dim}_${chunkX}_${chunkZ}`;
          if (this.props.world.getChunkAt(dim, chunkX, chunkZ)) {
            chunksToRender.push({ chunkX, chunkZ, inTileX: chunkInTileX, inTileZ: chunkInTileZ, isGridChunk: true });
            renderedChunkKeys.add(key);
          }
        }
      }

      // Add known chunks from world index that were missed by the sampling grid
      if (chunkIncrement > 1) {
        const knownChunks = this.props.world.knownChunkKeys;
        for (const chunkKey of knownChunks) {
          if (renderedChunkKeys.has(chunkKey)) continue;
          const parts = chunkKey.split("_");
          if (parts.length !== 3) continue;
          const chunkDim = parseInt(parts[0], 10);
          if (chunkDim !== dim) continue;
          const chunkX = parseInt(parts[1], 10);
          const chunkZ = parseInt(parts[2], 10);
          if (chunkX < tX || chunkX >= tX + chunksInTile) continue;
          if (chunkZ < tY || chunkZ >= tY + chunksInTile) continue;
          if (!this.props.world.getChunkAt(dim, chunkX, chunkZ)) continue;
          chunksToRender.push({ chunkX, chunkZ, inTileX: chunkX - tX, inTileZ: chunkZ - tY, isGridChunk: false });
        }
      }

      for (const { chunkX, chunkZ, inTileX, inTileZ, isGridChunk } of chunksToRender) {
        const chunk = this.props.world.getChunkAt(dim, chunkX, chunkZ);
        if (!chunk) continue;

        const chunkInTileX = inTileX;
        const chunkInTileZ = inTileZ;

        // Track this chunk as recently accessed for memory management
        const chunkKey = `${dim}_${chunkX}_${chunkZ}`;
        this._recentlyAccessedChunks.add(chunkKey);

        let increment = 1;

        // performance optimization: at very broad zoom levels, use only the increment-nth block as a placeholder for a larger sub-area
        if (chunksInTile >= 64) {
          increment = 16;
        } else if (chunksInTile >= 32) {
          increment = 8;
        } else if (chunksInTile >= 16) {
          increment = 4;
        } else if (chunksInTile >= 8) {
          increment = 2;
        }

        // For zoom > 7, only render the portion of the chunk that this tile covers
        const startBX = coords.z > 7 ? blockOffsetX : 0;
        const endBX = coords.z > 7 ? blockOffsetX + blocksPerTile : 16;
        const startBZ = coords.z > 7 ? blockOffsetZ : 0;
        const endBZ = coords.z > 7 ? blockOffsetZ + blocksPerTile : 16;

        // Precalculate values used in inner loop
        // Grid chunks represent chunkIncrement chunks visually (each sample stands in for neighbors).
        // Sparse-world chunks (from knownChunkKeys) represent only themselves, so use effectiveIncrement=1.
        const effectiveChunkIncrement = isGridChunk ? chunkIncrement : 1;
        const chunkPixelOffset = chunkInTileX * (256 / chunksInTile);
        const chunkPixelOffsetZ = chunkInTileZ * (256 / chunksInTile);
        const blockWidthBase = (16 / (chunksInTile / increment)) * effectiveChunkIncrement;
        const pixelScale = blockWidthBase / increment;
        const isHighZoom = coords.z > 7;
        const isLowZoom = coords.z < 4; // For performance optimizations at far out zoom levels
        const showTextures = blockWidthBase >= 8 || isHighZoom;
        const useColorShading = blockWidthBase <= 8 && !isHighZoom;

        for (let bX = startBX; bX < endBX; bX += increment) {
          for (let bZ = startBZ; bZ < endBZ; bZ += increment) {
            try {
              let block = undefined;
              let blockY = this._yLevel;

              if (this._isTops) {
                const topBlockY = chunk.getTopBlockY(bX, bZ);

                // Check for valid Y value (not the uninitialized -32768 sentinel)
                // and also handle Y=0 correctly (which is falsy but valid)
                if (topBlockY !== undefined && topBlockY > -1000) {
                  blockY = topBlockY;
                  block = chunk.getBlock(bX, topBlockY, bZ);
                } else {
                  block = undefined;
                }
              } else {
                block = chunk.getBlock(bX, this._yLevel, bZ);
              }

              // Track if we're showing a "floor" block (block below current Y level)
              let isFloorBlock = false;
              let floorBlockY = this._yLevel;

              // If in fixed Y mode and block is air/undefined, find the floor block below
              // Only do this expensive search when zoomed in enough to see detail
              if (
                !this._isTops &&
                chunksInTile <= 4 && // Skip floor search at zoomed-out levels
                (!block ||
                  !block.blockType ||
                  block.blockType.shortId === "air" ||
                  block.blockType.shortId === "void_air" ||
                  block.blockType.shortId === "cave_air")
              ) {
                // Look for the topmost solid block below current Y level
                // Limit search depth for performance
                const maxSearchDepth = 32;
                for (
                  let searchY = this._yLevel - 1;
                  searchY >= Math.max(-64, this._yLevel - maxSearchDepth);
                  searchY--
                ) {
                  const belowBlock = chunk.getBlock(bX, searchY, bZ);
                  if (belowBlock && belowBlock.blockType) {
                    const belowId = belowBlock.blockType.shortId;
                    if (belowId !== "air" && belowId !== "void_air" && belowId !== "cave_air") {
                      block = belowBlock;
                      blockY = searchY;
                      isFloorBlock = true;
                      floorBlockY = searchY;
                      break;
                    }
                  }
                }
              }

              if (block && block.blockType) {
                const btype = block.blockType;
                const shortId = btype.shortId;

                let color: string | undefined = undefined;
                let customBlockTexture: HTMLImageElement | undefined = undefined;

                // Check for custom blocks first - use project definitions if available
                if (btype.isCustom) {
                  const customBlockInfo = this._getCustomBlockInfo(btype.id);
                  if (customBlockInfo?.mapColor) {
                    color = customBlockInfo.mapColor;
                  }
                  // Try to get the texture image for high zoom levels
                  if (customBlockInfo?.textureDataUrl && showTextures) {
                    customBlockTexture = this._getCustomBlockImage(btype.id);
                  }
                  // Fallback color for custom blocks without defined map_color
                  // Uses keyword hints or hash-based color generation for variety
                  if (!color && !customBlockTexture) {
                    color = BlockTypeUtilities.getCustomBlockFallbackColor(btype.id);
                  }
                } else if (shortId === "air" || shortId === "void_air" || shortId === "cave_air") {
                  color = "#101010";
                } else if (shortId === "water" || shortId === "flowing_water") {
                  // Water depth visualization - performance optimized
                  // At zoomed-out levels (many chunks per tile), skip depth calculation entirely
                  if (this._isTops && chunksInTile <= 4) {
                    // Only check depth when zoomed in enough to see detail
                    // Limit depth check to 5 blocks for performance
                    let waterDepth = 0;
                    const maxDepthCheck = 5;
                    for (let dy = 1; dy <= maxDepthCheck; dy++) {
                      const belowBlock = chunk.getBlock(bX, blockY - dy, bZ);
                      if (belowBlock?.blockType) {
                        const belowId = belowBlock.blockType.shortId;
                        if (belowId === "water" || belowId === "flowing_water") {
                          waterDepth++;
                        } else {
                          break;
                        }
                      } else {
                        break;
                      }
                    }
                    color = WATER_DEPTH_COLORS[Math.min(waterDepth, WATER_DEPTH_COLORS.length - 1)];
                  } else {
                    // Use simple water color when zoomed out or in fixed-Y mode
                    color = btype.mapColor || "#3f76e4";
                  }
                } else if (shortId === "lava" || shortId === "flowing_lava") {
                  color = btype.mapColor || "#cf5a00";
                } else {
                  // Use the block type's map color from mccat.json (via BlockBaseType)
                  color = btype.mapColor;

                  // Pattern-based fallback for blocks without defined colors
                  if (!color) {
                    if (shortId.includes("stone") || shortId.includes("ore")) {
                      color = "#7d7d7d";
                    } else if (shortId.includes("dirt") || shortId.includes("mud")) {
                      color = "#866043";
                    } else if (shortId.includes("sand")) {
                      color = "#dbd3a0";
                    } else if (shortId.includes("grass") || shortId.includes("leaves")) {
                      color = "#7cbd6b";
                    } else if (shortId.includes("log") || shortId.includes("wood") || shortId.includes("plank")) {
                      color = "#6b5637";
                    } else if (shortId.includes("ice") || shortId.includes("snow")) {
                      color = "#f0fafa";
                    } else {
                      color = "#808080"; // Neutral gray default
                    }
                  }
                }

                // Calculate elevation shading factor for tops mode
                // Skip elevation shading at low zoom levels for performance
                let shadeFactor = 1.0;
                if (this._isTops && this._showElevationShading && !isLowZoom) {
                  // Get neighboring block heights for shading
                  let northY = blockY;
                  let westY = blockY;

                  // Look at north neighbor (bZ - 1)
                  if (bZ > 0) {
                    const ny = chunk.getTopBlockY(bX, bZ - 1);
                    if (ny !== undefined && ny > -1000) northY = ny;
                  } else {
                    // At chunk boundary - look at previous chunk
                    const northChunk = this.props.world.getChunkAt(dim, chunkX, chunkZ - 1);
                    if (northChunk) {
                      const ny = northChunk.getTopBlockY(bX, 15);
                      if (ny !== undefined && ny > -1000) northY = ny;
                    }
                  }

                  // Look at west neighbor (bX - 1)
                  if (bX > 0) {
                    const wy = chunk.getTopBlockY(bX - 1, bZ);
                    if (wy !== undefined && wy > -1000) westY = wy;
                  } else {
                    // At chunk boundary - look at previous chunk
                    const westChunk = this.props.world.getChunkAt(dim, chunkX - 1, chunkZ);
                    if (westChunk) {
                      const wy = westChunk.getTopBlockY(15, bZ);
                      if (wy !== undefined && wy > -1000) westY = wy;
                    }
                  }

                  // Calculate shade factor based on height difference
                  const heightDiff = (blockY - northY + (blockY - westY)) / 2;

                  if (heightDiff > 0) {
                    // Higher than neighbors = lighter (sun-facing)
                    shadeFactor = Math.min(1.3, 1.0 + heightDiff * 0.05);
                  } else if (heightDiff < 0) {
                    // Lower than neighbors = darker (shadow)
                    shadeFactor = Math.max(0.7, 1.0 + heightDiff * 0.05);
                  }

                  // Apply shading to color if we have one and using color mode
                  if (color && useColorShading) {
                    color = this._adjustColorBrightness(color, shadeFactor);
                  }
                }

                // Calculate block position in tile
                let posX: number, posZ: number;
                if (isHighZoom) {
                  // For zoom > 7: position relative to the block offset
                  posX = (bX - startBX) * pixelsPerBlock;
                  posZ = (bZ - startBZ) * pixelsPerBlock;
                } else {
                  posX = chunkPixelOffset + bX * pixelScale;
                  posZ = chunkPixelOffsetZ + bZ * pixelScale;
                }

                // For zoom > 7, blockWidth should be pixelsPerBlock
                const renderWidth = isHighZoom ? pixelsPerBlock : blockWidthBase;

                if (color) {
                  ctx.fillStyle = color;
                  ctx.fillRect(posX, posZ, renderWidth, renderWidth);

                  // Apply shading overlay to color fills when not using color-baked shading
                  // (useColorShading bakes shading into the color; otherwise we need an overlay)
                  if (!useColorShading && Math.abs(shadeFactor - 1.0) > 0.01) {
                    if (shadeFactor > 1.0) {
                      const alpha = Math.min(0.35, (shadeFactor - 1.0) * 1.0);
                      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
                      ctx.fillRect(posX, posZ, renderWidth, renderWidth);
                    } else {
                      const alpha = Math.min(0.35, (1.0 - shadeFactor) * 1.0);
                      ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
                      ctx.fillRect(posX, posZ, renderWidth, renderWidth);
                    }
                  }
                }

                // At zoomed-in levels, optionally show textures for larger blocks
                if (!color || showTextures) {
                  // For custom blocks, use the loaded texture image if available
                  if (customBlockTexture) {
                    ctx.drawImage(customBlockTexture, posX, posZ, renderWidth, renderWidth);

                    // Apply shading overlay after drawing custom texture
                    if (Math.abs(shadeFactor - 1.0) > 0.01) {
                      if (shadeFactor > 1.0) {
                        const alpha = Math.min(0.35, (shadeFactor - 1.0) * 1.0);
                        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
                        ctx.fillRect(posX, posZ, renderWidth, renderWidth);
                      } else {
                        const alpha = Math.min(0.35, (1.0 - shadeFactor) * 1.0);
                        ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
                        ctx.fillRect(posX, posZ, renderWidth, renderWidth);
                      }
                    }
                  } else if (!btype.isCustom) {
                    // For vanilla blocks, use the standard texture path
                    const iconStr = block.blockType.getIcon();

                    let imageManager = this._mapTiles[iconStr];

                    if (!imageManager) {
                      imageManager = new ImageLoadManager();
                      imageManager.source =
                        CreatorToolsHost.contentWebRoot +
                        "res/latest/van/serve/resource_pack/textures/blocks/" +
                        iconStr +
                        ".png";

                      this._mapTiles[iconStr] = imageManager;
                    }
                    imageManager.use(ctx, posX, posZ, renderWidth, renderWidth, shadeFactor);

                    // Draw shading overlay directly here after image for consistent shading at all zoom levels
                    if (Math.abs(shadeFactor - 1.0) > 0.01) {
                      if (shadeFactor > 1.0) {
                        // Lightening effect
                        const alpha = Math.min(0.35, (shadeFactor - 1.0) * 1.0);
                        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
                        ctx.fillRect(posX, posZ, renderWidth, renderWidth);
                      } else {
                        // Darkening effect - more subtle
                        const alpha = Math.min(0.35, (1.0 - shadeFactor) * 1.0);
                        ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
                        ctx.fillRect(posX, posZ, renderWidth, renderWidth);
                      }
                    }
                  }
                }

                // Apply fade overlay for floor blocks (blocks below current Y level)
                if (isFloorBlock) {
                  // Calculate depth-based fade (deeper = more faded)
                  const depth = this._yLevel - floorBlockY;
                  const depthFade = Math.min(0.85, 0.5 + depth * 0.03); // 0.5 base + 0.03 per block depth, max 0.85

                  // Dark semi-transparent overlay with depth-based opacity
                  ctx.fillStyle = `rgba(0, 0, 15, ${depthFade})`;
                  ctx.fillRect(posX, posZ, renderWidth, renderWidth);

                  // Add dithered pattern for clear "below ground" indication
                  ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
                  // Draw checkerboard dither pattern
                  const ditherSize = Math.max(2, Math.floor(renderWidth / 8));
                  for (let dx = 0; dx < renderWidth; dx += ditherSize * 2) {
                    for (let dz = 0; dz < renderWidth; dz += ditherSize * 2) {
                      // Checkerboard pattern
                      ctx.fillRect(posX + dx, posZ + dz, ditherSize, ditherSize);
                      ctx.fillRect(posX + dx + ditherSize, posZ + dz + ditherSize, ditherSize, ditherSize);
                    }
                  }
                }
              }
            } catch (blockError: unknown) {
              // Log first error per tile, then continue rendering remaining blocks.
              // This prevents a single bad block from blanking the entire tile.
              Log.debug("Error rendering block at " + bX + "," + bZ + ": " + blockError);
            }
          }
        }
      }

      // Show tile coordinates in corner with better contrast
      ctx.font = "bold 10px Arial";
      // Draw dark outline/shadow for contrast
      ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
      ctx.fillText(tileHtml, 3, 13);
      ctx.fillText(tileHtml, 1, 13);
      ctx.fillText(tileHtml, 2, 14);
      ctx.fillText(tileHtml, 2, 12);
      // Draw white text on top
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.fillText(tileHtml, 2, 13);

      // Cache the rendered tile for future use
      // Only cache complete tiles - tiles with loading indicators should NOT be cached
      // This prevents having to invalidate the entire cache when chunks load
      if (!tileHasLoadingChunks) {
        this._tileCache.set(cacheKey, tile);
      }

      // Periodically run memory cleanup for large worlds
      this._performMemoryCleanup();
    }

    // return the tile so it can be rendered on screen
    return tile;
  }

  // Helper to adjust color brightness for elevation shading
  _adjustColorBrightness(color: string, factor: number): string {
    // Handle hex colors
    if (color.startsWith("#")) {
      let r = parseInt(color.slice(1, 3), 16);
      let g = parseInt(color.slice(3, 5), 16);
      let b = parseInt(color.slice(5, 7), 16);

      r = Math.min(255, Math.max(0, Math.round(r * factor)));
      g = Math.min(255, Math.max(0, Math.round(g * factor)));
      b = Math.min(255, Math.max(0, Math.round(b * factor)));

      return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
    }

    // For named colors, just return as-is (can't easily adjust)
    return color;
  }

  _doResize() {
    if (this._map) {
      this._map.invalidateSize();
    }
  }

  render() {
    if (this.props.world === undefined) {
      return <div>Loading...</div>;
    }
    let height = "100%";

    if (this.props.heightOffset) {
      height = "calc(100vh - " + this.props.heightOffset + "px)";
    }

    return (
      <div
        style={{
          width: "100%",
          textAlign: "left",
          height: "100%",
          minHeight: height,
          maxHeight: height,
          position: "relative",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
          }}
          ref={(c: HTMLDivElement) => this._setMapOuter(c)}
        />
        {/* Loading overlay */}
        {this.state.isLoading && (
          <div className="wm-loading-overlay">
            <div className="wm-loading-content">
              <div className="wm-loading-spinner"></div>
              <div className="wm-loading-message">{this.state.loadingMessage}</div>
            </div>
          </div>
        )}
        {/* Chunk loading progress indicator */}
        {this.state.chunksTotal > 0 && (
          <div className="wm-chunk-progress">
            <div className="wm-chunk-progress-bar">
              <div
                className="wm-chunk-progress-fill"
                style={{
                  width: `${Math.round((this.state.chunksLoading / this.state.chunksTotal) * 100)}%`,
                }}
              />
            </div>
            <div className="wm-chunk-progress-text">
              Loading chunks: {this.state.chunksLoading} / {this.state.chunksTotal}
            </div>
          </div>
        )}
        {/* Y-Level Slider */}
        <div
          className="wm-y-slider-container"
          ref={(c) => (this._ySliderContainer = c)}
          onMouseDown={this._handleSliderMouseDown}
        >
          <button
            className="wm-tops-btn"
            onClick={(e) => {
              e.stopPropagation();
              this._isTops = true;
              this._ensureLayer();
              this._renderYSlider();
              this.forceUpdate();
            }}
            title="Show top blocks (surface view)"
          >
            TOPS
          </button>
          <div className="wm-y-slider-track">
            <canvas ref={this._setYSliderCanvas} width={60} height={320} className="wm-y-slider-canvas" />
          </div>
          {/* Column coordinates indicator */}
          {this._selectedBlockLocationFrom && (
            <div className="wm-y-slider-coords">
              X: {this._selectedBlockLocationFrom.x}, Z: {this._selectedBlockLocationFrom.z}
            </div>
          )}
        </div>
      </div>
    );
  }
}
