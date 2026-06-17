/**
 * ARCHITECTURE: WorldViewer
 *
 * React component that renders a Minecraft world in 3D using WorldRenderer.
 * Bridges file-based MCWorld data (from .mcworld files) to the real-time
 * rendering pipeline (ChunkMeshBuilder + WorldRenderer).
 *
 * DATA FLOW:
 *   .mcworld URL → fetch → MCWorld.loadFromBytes → loadLevelDb
 *   → WorldChunk palette data → adapter → IChunkColumn (runtime IDs)
 *   → ChunkMeshBuilder → Babylon.js meshes → WorldRenderer scene
 *
 * The adapter converts WorldChunk's palette-based block storage into the
 * flat runtime ID arrays that ChunkMeshBuilder expects. Block names are
 * mapped to sequential runtime IDs with a reverse lookup table.
 *
 * RELATED FILES:
 *   - WorldRenderer.ts — Babylon.js scene management
 *   - ChunkMeshBuilder.ts — chunk → mesh conversion
 *   - MCWorld.ts — .mcworld file loading and chunk access
 *   - WorldChunk.ts — palette-based block storage
 *   - LiveWorldState.ts — IChunkColumn/ISubChunk interfaces
 *   - MinecraftEnvironment.ts — shared sky/lighting/ground
 */

import { Component } from "react";
import * as BABYLON from "babylonjs";
import MCWorld from "../../minecraft/MCWorld";
import WorldChunk from "../../minecraft/WorldChunk";
import WorldRenderer from "./WorldRenderer";
import Database from "../../minecraft/Database";
import EntityManager from "../../minecraft/client/EntityManager";
import Log from "../../core/Log";
import type { IChunkColumn, ISubChunk } from "../../minecraft/client/LiveWorldState";
import LiveWorldState from "../../minecraft/client/LiveWorldState";
import AcceleratingKeyboardInput from "./AcceleratingKeyboardInput";

import "./WorldViewer.css";

interface IWorldViewerProps {
  /** URL to a .mcworld file (for standalone mode) */
  worldUrl?: string;
  /** Pre-loaded MCWorld instance (for embedded mode in WorldDisplay) */
  world?: MCWorld;
  /** Height offset for CSS layout */
  heightOffset: number;
  /** Hide all UI chrome for headless screenshots */
  hideChrome?: boolean;
  /** Initial camera position */
  cameraX?: number;
  cameraY?: number;
  cameraZ?: number;
  /**
   * Lowest world Y to render. Defaults to the world bottom (-64) so all content
   * renders. Exposed primarily so the Y-floor regression test can force a high
   * floor and confirm low content is culled / restored as expected.
   */
  minRenderY?: number;
  /** Called periodically with the camera's Minecraft X, Y, Z and yaw (degrees, 0=south, 90=west) */
  onCameraUpdate?: (x: number, y: number, z: number, yaw: number) => void;
}

interface IWorldViewerState {
  isLoading: boolean;
  loadingMessage: string;
  errorMessage?: string;
  world?: MCWorld;
  chunkCount: number;
  fps: number;
}

const SUBCHUNK_SIZE = 16;

export default class WorldViewer extends Component<IWorldViewerProps, IWorldViewerState> {
  private _canvasRef: HTMLCanvasElement | null = null;
  private _worldRenderer: WorldRenderer | null = null;
  private _worldState: LiveWorldState | null = null;
  private _loadedWorld: MCWorld | null = null;
  private _animFrameId: number = 0;
  private _disposed: boolean = false;
  private _retryCount: number = 0;
  private _lastConvertedCount: number = 0;

  // Chunk streaming state. The viewer only holds a window of chunks around the
  // camera; as the camera moves into a new chunk we feed the newly-visible
  // chunks and advance the renderer's cull center. Without this the viewer only
  // ever loaded a fixed region around the spawn/initial position, so moving away
  // (e.g. toward the lower-right) ran off the loaded area into empty space.
  private _loadedChunkKeys: Set<string> = new Set();
  private _lastStreamChunkX: number | undefined = undefined;
  private _lastStreamChunkZ: number | undefined = undefined;

  // Y level that distant terrain renders up to at the edge of the render radius.
  // The graduated Y-cull interpolates the effective max height from maxRenderY
  // (full height, near the camera) down to this value at maxRenderRadius. It must
  // be ABOVE the terrain surface (~Y=63) so distant ground stays visible — passing
  // the world floor here would cull every block beyond nearRenderRadius, leaving
  // distant chunks empty (they would only "fill in" when the camera moved).
  private static readonly DISTANT_GROUND_Y = 80;

  // Last camera pose emitted via onCameraUpdate, used to suppress redundant
  // updates. Without this, the update loop fires every ~250ms even when the
  // camera is stationary, and each call re-centers the tracking map (setView),
  // which re-requests tiles and produces a perpetual "refreshing" loop.
  private _lastEmittedCamX: number | undefined = undefined;
  private _lastEmittedCamY: number | undefined = undefined;
  private _lastEmittedCamZ: number | undefined = undefined;
  private _lastEmittedCamYaw: number | undefined = undefined;

  // Block name ↔ runtime ID mapping for the adapter
  private _blockNameToId: Map<string, number> = new Map();
  private _idToBlockName: Map<number, string> = new Map();
  private _nextRuntimeId: number = 1; // 0 = air

  constructor(props: IWorldViewerProps) {
    super(props);
    this.state = {
      isLoading: true,
      loadingMessage: "Initializing...",
      chunkCount: 0,
      fps: 0,
    };
  }

  async componentDidMount() {
    this._disposed = false; // Reset in case of React Strict Mode remount
    try {
      // Register air as runtime ID 0
      this._blockNameToId.set("minecraft:air", 0);
      this._idToBlockName.set(0, "minecraft:air");

      await this._loadWorld();
    } catch (err) {
      Log.debug("[WorldViewer] componentDidMount error: " + (err instanceof Error ? err.message : String(err)));
      this.setState({
        isLoading: false,
        errorMessage: "Failed to load world: " + (err instanceof Error ? err.message : String(err)),
      });
    }
  }

  componentWillUnmount() {
    this._disposed = true;
    if (this._animFrameId) {
      cancelAnimationFrame(this._animFrameId);
    }
    if (this._worldRenderer) {
      this._worldRenderer.dispose();
      this._worldRenderer = null;
    }
    this._canvasRef = null;
  }

  private async _loadWorld() {
    let world = this.props.world;

    if (!world && this.props.worldUrl) {
      this.setState({ loadingMessage: "Fetching world file..." });

      const response = await fetch(this.props.worldUrl);
      if (!response.ok) throw new Error("HTTP " + response.status);
      const bytes = new Uint8Array(await response.arrayBuffer());

      this.setState({ loadingMessage: "Parsing world data..." });
      world = new MCWorld();
      await world.loadFromBytes(bytes);
    }

    if (!world) {
      throw new Error("No world data available");
    }

    // Always ensure LevelDB chunk data is loaded. When `world` is passed in as
    // a prop from WorldDisplay (embedded mode), the parent may not have called
    // loadLevelDb yet — the 2D WorldMap loads it lazily on its own. Without
    // this call, _convertAndFeedChunks finds chunks but they contain no blocks,
    // and the 3D viewer renders only the ground plane / sky. loadLevelDb is
    // idempotent (early-returns when _isDataLoaded).
    //
    // IMPORTANT: pass the same lazy-load options the 2D WorldMap uses. In the
    // combined 3D+map view both share a single MCWorld instance and whichever
    // mounts first wins (the second call early-returns). Using the lazy options
    // here ensures we never trigger a heavyweight full-world processing pass
    // when the viewer happens to load first — chunks are created on demand via
    // getOrCreateChunk (which works against the pre-built chunk key index) and
    // memory stays bounded by the LRU cache.
    this.setState({ loadingMessage: "Loading block database..." });
    await world.loadLevelDb(false, { lazyLoad: true, skipFullProcessing: true, maxChunksInCache: 20000 });

    this.setState({ world, loadingMessage: "Loading textures..." });
    this._loadedWorld = world;

    // Load vanilla catalogs for textured rendering
    await Database.loadVanillaCatalog();
    await Database.loadVanillaResourceDefinitions();

    this.setState({ loadingMessage: "Building world view...", isLoading: false });
  }

  private _setCanvas = (canvas: HTMLCanvasElement | null) => {
    if (!canvas || canvas === this._canvasRef) return;
    this._canvasRef = canvas;
    Log.debug("[WorldViewer] _setCanvas: canvas mounted, starting renderer init");
    this._initializeRenderer(canvas).catch((err) => {
      Log.error("[WorldViewer] Renderer init error: " + (err instanceof Error ? err.message : String(err)));
      this.setState({ errorMessage: "Renderer failed: " + (err instanceof Error ? err.message : String(err)) });
    });
  };

  private async _initializeRenderer(canvas: HTMLCanvasElement) {
    const world = this._loadedWorld;
    if (!world) {
      Log.debug("[WorldViewer] _initializeRenderer: world not loaded yet");
      return;
    }

    // Create a LiveWorldState to feed chunks to WorldRenderer
    this._worldState = new LiveWorldState();

    // Create WorldRenderer
    const entityManager = new EntityManager();
    this._worldRenderer = new WorldRenderer(canvas, this._worldState, entityManager);

    // Initialize textured rendering — pass world so any embedded resource
    // packs (custom block textures) are registered before the first chunk
    // mesh is built. Also pass the owning project (if MCWorld has one) so that
    // custom blocks defined in the active project's behavior+resource packs
    // render with their real textures instead of the gray fallback. Without
    // the project, project-level custom blocks render white/gray.
    Log.debug("[WorldViewer] Calling initializeDatabase...");
    const project = world.project;
    await this._worldRenderer.initializeDatabase({ world, project: project ?? undefined });

    // Set camera position — look down at terrain from above spawn
    const spawnX = world.getProperty("spawnx") ?? 0;
    // Bedrock uses Y >= 32768 as sentinel for "spawn on highest block" — use Y=72 instead
    let spawnY = world.getProperty("spawny") ?? 64;
    if (typeof spawnY === "number" && spawnY >= 32700) {
      spawnY = 72;
    }
    const spawnZ = world.getProperty("spawnz") ?? 0;

    const camX = this.props.cameraX ?? spawnX;
    const camY = this.props.cameraY ?? spawnY + 15;
    const camZ = this.props.cameraZ ?? spawnZ;

    Log.verbose(`[WorldViewer] Camera at ${camX}, ${camY}, ${camZ}`);

    // Look slightly forward and down from camera position
    this._worldRenderer.setCameraOverride(camX, camY, camZ, camX + 5, camY - 10, camZ + 15);

    // Position the ground plane at the world's minimum Y so it never obscures
    // actual terrain. Modern worlds (1.18+) use minY=-64, older worlds use 0.
    const worldMinY = world.chunkMinY ?? -64;
    this._worldRenderer.setGroundPlaneY(worldMinY);

    // Set render center and culling — distant terrain tapers down to
    // DISTANT_GROUND_Y (surface level), NOT the world floor, so far chunks still
    // render their ground surface instead of culling to nothing.
    // 192-block radius keeps the visible edge just inside the ~200-block fog-cull
    // distance so culled chunks are hidden by fog rather than popping at a hard edge.
    this._worldRenderer.setRenderCenter(camX, camZ, 192, 80, WorldViewer.DISTANT_GROUND_Y);
    this._worldRenderer.maxRenderY = 256;
    if (this.props.minRenderY !== undefined) {
      this._worldRenderer.minRenderY = this.props.minRenderY;
    }

    // Add WASD camera controls
    this._setupCameraControls(this._worldRenderer);

    // Convert MCWorld chunks → LiveWorldState IChunkColumns
    this._convertAndFeedChunks(world);

    // If no chunks were found yet (LevelDB may still be loading), retry after a delay.
    // The retryConvert function tracks its own count instead of relying on async setState.
    let totalFound = this._lastConvertedCount;
    const retryConvert = () => {
      if (this._disposed || !this._worldRenderer || !this._worldState) return;
      this._convertAndFeedChunks(world);
      totalFound = this._lastConvertedCount;
      if (totalFound > 0) {
        this._worldRenderer.rebuildAllDirtyChunks();
        Log.debug("[WorldViewer] Retry succeeded: " + totalFound + " chunks loaded");
      } else {
        // Keep retrying every 2s for up to 30s
        if (this._retryCount < 15) {
          this._retryCount++;
          Log.debug("[WorldViewer] Retry #" + this._retryCount + ": still 0 chunks, will retry...");
          setTimeout(retryConvert, 2000);
        } else {
          Log.error("[WorldViewer] Gave up retrying chunk conversion after 15 attempts");
        }
      }
    };
    if (totalFound === 0) {
      this._retryCount = 0;
      setTimeout(retryConvert, 2000);
    }

    // Force-build ALL dirty chunk meshes synchronously before starting the render loop.
    // This ensures blocks are visible on the first rendered frame.
    const rebuilt = this._worldRenderer.rebuildAllDirtyChunks();
    Log.debug("WorldViewer: Rebuilt " + rebuilt + " chunk meshes");
    this._publishRenderStats();

    // Start render loop
    this._worldRenderer.startRenderLoop();

    // Update chunk meshes each frame (for any future dirty chunks)
    this._startUpdateLoop();
  }

  /**
   * Convert MCWorld's file-based WorldChunk data into IChunkColumn format
   * and feed into LiveWorldState for ChunkMeshBuilder to process.
   *
   * Loads the LOAD_RADIUS window of chunks around the given center (defaults to
   * the initial camera/spawn position). Chunks already streamed in are tracked
   * in `_loadedChunkKeys` and skipped, so repeated calls while the camera moves
   * only pay for the newly-visible chunks. Returns the number of NEW chunks fed.
   */
  private _convertAndFeedChunks(world: MCWorld, centerChunkX?: number, centerChunkZ?: number): number {
    if (!this._worldState) return 0;

    const dim = 0; // Overworld
    let newChunks = 0;
    // Default the center to the initial camera/spawn position when no explicit
    // chunk center is supplied (initial load + retries).
    const defaultCenterX = (this.props.cameraX ?? (world.getProperty("spawnx") as number) ?? 0) as number;
    const defaultCenterZ = (this.props.cameraZ ?? (world.getProperty("spawnz") as number) ?? 0) as number;
    const camChunkX = centerChunkX ?? defaultCenterX >> 4;
    const camChunkZ = centerChunkZ ?? defaultCenterZ >> 4;
    // Load a chunk radius that covers the ~192-block render radius (12 chunks = 192 blocks)
    // so streamed terrain is available before it enters the visible/fog region.
    const LOAD_RADIUS = 12;

    // Load chunks directly from the world near the camera position.
    // We use getOrCreateChunk() which loads from LevelDB on demand,
    // rather than world.chunks which may not be populated yet.
    for (let cx = camChunkX - LOAD_RADIUS; cx <= camChunkX + LOAD_RADIUS; cx++) {
      for (let cz = camChunkZ - LOAD_RADIUS; cz <= camChunkZ + LOAD_RADIUS; cz++) {
        const chunkKey = `${dim}_${cx}_${cz}`;
        // Skip chunks we've already converted and fed.
        if (this._loadedChunkKeys.has(chunkKey)) continue;

        // Check if this chunk exists in the world's index
        if (world.hasChunkData(dim, cx, cz) === false) continue;

        const worldChunk = world.getOrCreateChunk(dim, cx, cz);
        if (!worldChunk) continue;

        const col = this._convertWorldChunk(worldChunk, cx, cz);
        if (col) {
          this._worldState.setChunkColumn(col);
          this._loadedChunkKeys.add(chunkKey);
          newChunks++;
        }
      }
    }

    Log.verbose(
      `WorldViewer: Converted ${newChunks} new chunks near (${camChunkX},${camChunkZ}), ${this._loadedChunkKeys.size} loaded total, ${this._nextRuntimeId - 1} block types`
    );

    // Register all block names in LiveWorldState's palette so getBlockName() works
    const paletteEntries: { rid: number; name: string }[] = [];
    for (const [name, rid] of this._blockNameToId) {
      paletteEntries.push({ rid, name });
    }
    this._worldState.handleBlockPalette(paletteEntries);

    this._lastConvertedCount = this._loadedChunkKeys.size;
    this.setState({ chunkCount: this._loadedChunkKeys.size });
    return newChunks;
  }

  /**
   * Stream chunks around the camera's current position. Called periodically from
   * the update loop. When the camera crosses into a new chunk, feeds the newly
   * visible chunks and advances the renderer's cull center so they aren't culled.
   */
  private _streamChunksAroundCamera() {
    if (this._disposed || !this._worldRenderer || !this._worldState || !this._loadedWorld) return;

    const cam = this._worldRenderer.camera;
    const camChunkX = Math.floor(cam.position.x) >> 4;
    const camChunkZ = Math.floor(cam.position.z) >> 4;

    // Only do work when the camera has moved into a different chunk.
    if (camChunkX === this._lastStreamChunkX && camChunkZ === this._lastStreamChunkZ) return;

    this._lastStreamChunkX = camChunkX;
    this._lastStreamChunkZ = camChunkZ;

    // Advance the renderer's cull center to the camera so distant-from-spawn
    // chunks remain within the render radius.
    this._worldRenderer.setRenderCenter(cam.position.x, cam.position.z, 192, 80, WorldViewer.DISTANT_GROUND_Y);

    // Re-dirty any in-range chunks whose meshes were trimmed by the mesh cap
    // (e.g., after moving back toward a previously-visited area) so terrain
    // reappears. Runs only on chunk-cross, so it adds no per-frame churn.
    this._worldRenderer.ensureNearbyChunkMeshes();

    this._convertAndFeedChunks(this._loadedWorld, camChunkX, camChunkZ);

    // Build both the newly-streamed chunks and any re-dirtied ones immediately
    // so the leading edge of terrain fills in as the camera moves.
    this._worldRenderer.rebuildAllDirtyChunks();
  }

  /**
   * Convert a single WorldChunk (palette-based) to IChunkColumn (runtime ID array).
   */
  private _convertWorldChunk(worldChunk: WorldChunk, chunkX: number, chunkZ: number): IChunkColumn | null {
    // ChunkMeshBuilder expects subchunks indexed from minY=-64.
    // Index 0 = Y=-64, index 1 = Y=-48, ..., index 8 = Y=64, etc.
    const MIN_Y = -64;
    const MAX_SUBCHUNKS = 24; // -64 to 319 = 24 subchunks
    const subchunks: (ISubChunk | undefined)[] = new Array(MAX_SUBCHUNKS).fill(undefined);

    const minSubIdx = worldChunk.minSubChunkIndex;
    const maxSubIdx = worldChunk.maxSubChunkIndex;

    for (let sci = minSubIdx; sci <= maxSubIdx; sci++) {
      const startY = worldChunk.getStartYFromSubChunkIndex(sci);

      // Map to the ChunkMeshBuilder's expected index: (startY - MIN_Y) / 16
      const targetIdx = (startY - MIN_Y) >> 4;
      if (targetIdx < 0 || targetIdx >= MAX_SUBCHUNKS) continue;

      // Convert every subchunk the world actually contains. (Previously this
      // skipped everything below Y=40, which deleted the lower floors and ground
      // of creator/custom worlds whose baseplate sits below Y=40. Vertical render
      // limiting is now handled by ChunkMeshBuilder.minRenderY, which defaults to
      // the world bottom so nothing is dropped here.)

      const blocks = new Int32Array(4096);
      let hasAnyBlocks = false;

      for (let lx = 0; lx < SUBCHUNK_SIZE; lx++) {
        for (let lz = 0; lz < SUBCHUNK_SIZE; lz++) {
          for (let ly = 0; ly < SUBCHUNK_SIZE; ly++) {
            const worldY = startY + ly;
            let block;
            try {
              block = worldChunk.getBlock(lx, worldY, lz);
            } catch {
              continue;
            }
            if (!block) continue;

            // A block object with typeName "minecraft:air" is genuinely empty space
            // (both the palette and legacy getBlock paths return air with that exact
            // name). A block whose typeName is empty/undefined is an UNRESOLVED block —
            // a real block we couldn't map to a name. Render those via a placeholder so
            // they show up as a fallback colored cube instead of silently vanishing.
            const rawType = block.typeName;
            if (rawType === "minecraft:air") continue;
            const typeId = rawType && rawType.length > 0 ? rawType : "minecraft:unknown_block";

            let runtimeId = this._blockNameToId.get(typeId);
            if (runtimeId === undefined) {
              runtimeId = this._nextRuntimeId++;
              this._blockNameToId.set(typeId, runtimeId);
              this._idToBlockName.set(runtimeId, typeId);
            }

            blocks[lx * 256 + lz * 16 + ly] = runtimeId;
            hasAnyBlocks = true;
          }
        }
      }

      if (hasAnyBlocks) {
        subchunks[targetIdx] = { blocks, dirty: true };
      }
    }

    return {
      x: chunkX,
      z: chunkZ,
      subchunks,
      dirty: true,
      meshGenerated: false,
    };
  }

  /**
   * Get block name from runtime ID (used by ChunkMeshBuilder callback).
   */
  private _getBlockName = (runtimeId: number): string => {
    return this._idToBlockName.get(runtimeId) || "minecraft:air";
  };

  /**
   * Add WASD + mouse camera controls to the WorldRenderer.
   */
  private _setupCameraControls(renderer: WorldRenderer) {
    const camera = renderer.camera;

    // Enable WASD keyboard movement with acceleration on hold
    const kbd = new AcceleratingKeyboardInput();
    kbd.keysUp = [87]; // W
    kbd.keysDown = [83]; // S
    kbd.keysLeft = [65]; // A
    kbd.keysRight = [68]; // D
    kbd.keysUpward = [69]; // E - up
    kbd.keysDownward = [81]; // Q - down
    kbd.baseSpeed = 0.3;
    kbd.maxSpeed = 3.0;
    kbd.rampDurationMs = 2000;
    camera.inputs.add(kbd);

    // Enable mouse look
    camera.inputs.addMouse();

    // Enable scroll wheel zoom
    camera.inputs.addMouseWheel();
    const wheel = camera.inputs.attached.mousewheel as BABYLON.FreeCameraMouseWheelInput;
    if (wheel) {
      wheel.wheelPrecisionY = 0.06;
      wheel.wheelPrecisionX = 0.06;
    }

    camera.angularSensibility = 2000;
    camera.speed = 0.3;
    camera.attachControl(this._canvasRef!, true);
  }

  /**
   * Frame update loop: process dirty chunks, update stats, and emit camera position.
   */
  /**
   * Publish cumulative render stats to `window.__mctWorldRenderStats` so Playwright
   * tests (notably the Y-floor regression guard) can assert that low-elevation
   * content actually rendered (minRenderedY) instead of being silently culled.
   */
  private _publishRenderStats() {
    if (!this._worldRenderer || typeof window === "undefined") {
      return;
    }
    (window as any).__mctWorldRenderStats = this._worldRenderer.getRenderStats();
  }

  private _startUpdateLoop() {
    let frameCount = 0;
    const intervalId = setInterval(() => {
      if (this._disposed) {
        clearInterval(intervalId);
        return;
      }

      if (this._worldRenderer) {
        this._worldRenderer.updateChunkMeshes();
        this._publishRenderStats();

        // Emit camera position every ~250ms (every 15 frames at 16ms interval)
        frameCount++;
        if (frameCount % 15 === 0) {
          // Stream in chunks around the camera as it moves so the view keeps
          // filling in instead of running into empty space. No-op while the
          // camera stays within the same chunk it last streamed for.
          this._streamChunksAroundCamera();

          if (this.props.onCameraUpdate) {
            const cam = this._worldRenderer.camera;
            // Convert Babylon rotation.y to Minecraft yaw degrees.
            // The scene is RIGHT-handed (see WorldRenderer handedness/mirror fix), so
            // the camera's horizontal forward = (-sin(rotation.y), -cos(rotation.y)).
            // Minecraft yaw = atan2(-Δx, Δz) = atan2(sin ry, -cos ry) = 180° - rotation.y°.
            // (In the old left-handed scene this was simply yaw = -rotation.y°.)
            const yawDeg = 180 - (cam.rotation.y * 180) / Math.PI;
            // Only emit when the camera pose actually changed beyond a small
            // threshold. Emitting every tick re-pans the tracking map on each
            // call (setView), causing an endless tile-refresh loop.
            const POS_EPSILON = 0.05; // blocks
            const YAW_EPSILON = 0.1; // degrees
            const moved =
              this._lastEmittedCamX === undefined ||
              Math.abs(cam.position.x - this._lastEmittedCamX) > POS_EPSILON ||
              Math.abs(cam.position.y - (this._lastEmittedCamY as number)) > POS_EPSILON ||
              Math.abs(cam.position.z - (this._lastEmittedCamZ as number)) > POS_EPSILON ||
              Math.abs(yawDeg - (this._lastEmittedCamYaw as number)) > YAW_EPSILON;

            if (moved) {
              this._lastEmittedCamX = cam.position.x;
              this._lastEmittedCamY = cam.position.y;
              this._lastEmittedCamZ = cam.position.z;
              this._lastEmittedCamYaw = yawDeg;

              if (frameCount % 60 === 0) {
                Log.verbose(
                  `[WorldViewer] camera update: x=${cam.position.x.toFixed(1)} y=${cam.position.y.toFixed(1)} z=${cam.position.z.toFixed(1)} yaw=${yawDeg.toFixed(1)}`
                );
              }
              this.props.onCameraUpdate(cam.position.x, cam.position.y, cam.position.z, yawDeg);
            }
          }
        }
      }
    }, 16);
  }

  render() {
    const { hideChrome, heightOffset } = this.props;
    const { isLoading, loadingMessage, errorMessage } = this.state;

    const containerStyle: React.CSSProperties = {
      width: "100%",
      height: hideChrome ? "100vh" : `calc(100vh - ${heightOffset}px)`,
      position: "relative",
      overflow: "hidden",
    };

    if (errorMessage) {
      return (
        <div className="wvr-container" style={containerStyle}>
          <div className="wvr-error">{errorMessage}</div>
        </div>
      );
    }

    if (isLoading) {
      return (
        <div className="wvr-container" style={containerStyle}>
          <div className="wvr-loading">
            <div className="wvr-spinner" />
            <span>{loadingMessage}</span>
          </div>
        </div>
      );
    }

    return (
      <div className="wvr-container" style={containerStyle}>
        <canvas
          ref={this._setCanvas}
          className="wvr-canvas"
          data-testid="world-viewer-canvas"
          style={{ width: "100%", height: "100%" }}
        />
        {!hideChrome && (
          <div className="wvr-info">
            <span>Chunks: {this.state.chunkCount}</span>
          </div>
        )}
      </div>
    );
  }
}
