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
    try {
      // Register air as runtime ID 0
      this._blockNameToId.set("minecraft:air", 0);
      this._idToBlockName.set(0, "minecraft:air");

      await this._loadWorld();
    } catch (err) {
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

      this.setState({ loadingMessage: "Loading block database..." });
      await world.loadLevelDb();
    }

    if (!world) {
      throw new Error("No world data available");
    }

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
    this._initializeRenderer(canvas).catch((err) => {
      Log.debug("[WorldViewer] Renderer init error: " + err);
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

    // Initialize textured rendering
    Log.debug("[WorldViewer] Calling initializeDatabase...");
    await this._worldRenderer.initializeDatabase();

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

    // Set render center and culling — don't be too aggressive
    this._worldRenderer.setRenderCenter(camX, camZ, 128, 40, 50);
    this._worldRenderer.maxRenderY = 256;

    // Add WASD camera controls
    this._setupCameraControls(this._worldRenderer);

    // Convert MCWorld chunks → LiveWorldState IChunkColumns
    this._convertAndFeedChunks(world);

    // Force-build ALL dirty chunk meshes synchronously before starting the render loop.
    // This ensures blocks are visible on the first rendered frame.
    const rebuilt = this._worldRenderer.rebuildAllDirtyChunks();
    Log.debug("WorldViewer: Rebuilt " + rebuilt + " chunk meshes");

    // Start render loop
    this._worldRenderer.startRenderLoop();

    // Update chunk meshes each frame (for any future dirty chunks)
    this._startUpdateLoop();
  }

  /**
   * Convert MCWorld's file-based WorldChunk data into IChunkColumn format
   * and feed into LiveWorldState for ChunkMeshBuilder to process.
   */
  private _convertAndFeedChunks(world: MCWorld) {
    if (!this._worldState) return;

    const dim = 0; // Overworld
    const dimChunks = world.chunks.get(dim);
    if (!dimChunks) {
      Log.debug("WorldViewer: No overworld chunks found");
      return;
    }

    let totalChunks = 0;
    const camX = this.props.cameraX ?? world.getProperty("spawnx") ?? 0;
    const camZ = this.props.cameraZ ?? world.getProperty("spawnz") ?? 0;
    const camChunkX = camX >> 4;
    const camChunkZ = camZ >> 4;
    const LOAD_RADIUS = 6; // Load chunks within 6 chunk radius (~96 blocks)

    for (const [chunkX, zMap] of dimChunks) {
      for (const [chunkZ, worldChunk] of zMap) {
        // Only load chunks near camera
        if (Math.abs(chunkX - camChunkX) > LOAD_RADIUS || Math.abs(chunkZ - camChunkZ) > LOAD_RADIUS) {
          continue;
        }

        const col = this._convertWorldChunk(worldChunk, chunkX, chunkZ);
        if (col) {
          this._worldState.setChunkColumn(col);
          totalChunks++;
        }
      }
    }

    Log.debug(`WorldViewer: Converted ${totalChunks} chunks, ${this._nextRuntimeId - 1} unique block types`);

    // Register all block names in LiveWorldState's palette so getBlockName() works
    const paletteEntries: { rid: number; name: string }[] = [];
    for (const [name, rid] of this._blockNameToId) {
      paletteEntries.push({ rid, name });
    }
    this._worldState.handleBlockPalette(paletteEntries);

    this.setState({ chunkCount: totalChunks });
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

      // Skip subchunks below Y=40 for performance (underground)
      if (startY + SUBCHUNK_SIZE < 40) continue;

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

            const typeId = block.typeName || "minecraft:air";
            if (typeId === "minecraft:air") continue;

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

    // Enable WASD keyboard movement
    const kbd = new BABYLON.FreeCameraKeyboardMoveInput();
    kbd.keysUp = [87]; // W
    kbd.keysDown = [83]; // S
    kbd.keysLeft = [65]; // A
    kbd.keysRight = [68]; // D
    kbd.keysUpward = [69]; // E - up
    kbd.keysDownward = [81]; // Q - down
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
  private _startUpdateLoop() {
    let frameCount = 0;
    const intervalId = setInterval(() => {
      if (this._disposed) {
        clearInterval(intervalId);
        return;
      }

      if (this._worldRenderer) {
        this._worldRenderer.updateChunkMeshes();

        // Emit camera position every ~250ms (every 15 frames at 16ms interval)
        frameCount++;
        if (this.props.onCameraUpdate && frameCount % 15 === 0) {
          const cam = this._worldRenderer.camera;
          // Convert Babylon rotation.y back to Minecraft yaw degrees
          const yawDeg = (cam.rotation.y * 180) / Math.PI - 180;
          if (frameCount % 60 === 0) {
            Log.verbose(
              `[WorldViewer] camera update: x=${cam.position.x.toFixed(1)} y=${cam.position.y.toFixed(1)} z=${cam.position.z.toFixed(1)} yaw=${yawDeg.toFixed(1)}`
            );
          }
          this.props.onCameraUpdate(cam.position.x, cam.position.y, cam.position.z, yawDeg);
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
