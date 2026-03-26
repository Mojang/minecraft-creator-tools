/**
 * ARCHITECTURE: WorldRenderer
 *
 * Top-level Babylon.js scene manager for the Bedrock client.
 * Creates and manages the 3D scene, camera, lighting, sky, and chunk meshes.
 *
 * RENDERING PIPELINE:
 *   LiveWorldState (dirty chunks) → ChunkMeshBuilder → Babylon.js scene
 *   EntityManager (entities) → entity meshes in scene
 *   camera/navigation controller → camera position/rotation
 *
 * The render loop runs at display refresh rate (typically 60 FPS).
 * Chunk mesh generation is rate-limited to avoid frame drops.
 *
 * ENVIRONMENT RENDERING:
 *   Sky dome, lighting, and ground plane are created via MinecraftEnvironment
 *   (shared with VolumeEditor) to ensure consistent visual appearance.
 *
 * RELATED FILES:
 *   - MinecraftEnvironment.ts — shared environment rendering (sky, lighting, ground)
 *   - ChunkMeshBuilder.ts — chunk → mesh conversion
 *   - LiveWorldState.ts — chunk data source
 *   - EntityManager.ts — entity data source
 *   - external camera/navigation controller — camera control source
 */

import * as BABYLON from "babylonjs";
import ChunkMeshBuilder from "./ChunkMeshBuilder";
import BlockMeshFactory from "./BlockMeshFactory";
import Log from "../../core/Log";
import { ModelMeshFactory } from "./ModelMeshFactory";
import BlockRenderDatabase from "./BlockRenderDatabase";
import MinecraftEnvironment from "./MinecraftEnvironment";
import LiveWorldState, { IChunkColumn } from "../../minecraft/client/LiveWorldState";
import EntityManager, { IEntityState } from "../../minecraft/client/EntityManager";
import Database from "../../minecraft/Database";
import VanillaProjectManager, { IVanillaEntityModelData } from "../../minecraft/VanillaProjectManager";

export interface IWorldRendererStats {
  fps: number;
  chunkMeshCount: number;
  entityMeshCount: number;
  totalVertices: number;
  totalFaces: number;
  drawCalls: number;
  cameraPosition?: { x: number; y: number; z: number };
}

export default class WorldRenderer {
  private _canvas: HTMLCanvasElement;
  private _engine: BABYLON.Engine;
  private _scene: BABYLON.Scene;
  private _camera: BABYLON.FreeCamera;
  private _chunkMeshBuilder: ChunkMeshBuilder;
  private _worldState: LiveWorldState;
  private _entityManager: EntityManager;

  // Chunk mesh tracking — each chunk may produce multiple meshes (one per block type)
  private _chunkMeshes: Map<string, BABYLON.Mesh[]> = new Map();
  private _totalVertices: number = 0;
  private _totalFaces: number = 0;

  // Adaptive chunk rate: process more chunks when many are dirty (burst), fewer when few trickle in
  private _baseChunkRate: number = 4;
  private _totalRebuildCycles: number = 0;
  private _totalChunksBuilt: number = 0;

  // Entity mesh tracking
  private _entityMeshes: Map<number, BABYLON.Mesh> = new Map();
  // Track entity mesh visibility state to avoid redundant getChildMeshes() calls
  private _entityMeshVisible: Map<number, boolean> = new Map();

  // Entity model rendering — uses ModelMeshFactory + VanillaProjectManager
  private _modelMeshFactory: ModelMeshFactory | undefined;
  private _entityModelCache: Map<string, IVanillaEntityModelData | null> = new Map();
  private _entityModelLoading: Set<string> = new Set();

  // Lighting
  private _sunLight: BABYLON.DirectionalLight | undefined;
  private _ambientLight: BABYLON.HemisphericLight | undefined;

  // Shared block render database
  private _renderDb: BlockRenderDatabase | undefined;

  // BlockMeshFactory for textured rendering (shared with VolumeEditor)
  private _meshFactory: BlockMeshFactory | undefined;
  private _databaseLoaded: boolean = false;

  // Sky

  // Test camera override — when set, camera position is NOT overridden by player state
  private _cameraOverride: boolean = false;
  private _skybox: BABYLON.Mesh | undefined;

  // Block highlight (wireframe outline on targeted block)
  private _blockHighlight: BABYLON.Mesh | undefined;
  private _blockHighlightMaterial: BABYLON.StandardMaterial | undefined;
  private _blockHighlightEnabled: boolean = true;

  // Entity mesh visibility control
  private _entityMeshesEnabled: boolean = true;

  // Ground plane — extends beyond loaded chunks to prevent sky showing below terrain edges
  private _groundPlane: BABYLON.Mesh | undefined;

  // Disposed flag
  private _disposed: boolean = false;

  constructor(
    canvas: HTMLCanvasElement,
    worldState: LiveWorldState,
    entityManager: EntityManager,
    renderDb?: BlockRenderDatabase
  ) {
    this._canvas = canvas;
    this._worldState = worldState;
    this._entityManager = entityManager;
    this._renderDb = renderDb;

    // Create Babylon.js engine
    this._engine = new BABYLON.Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: false,
      antialias: true,
      powerPreference: "high-performance",
      alpha: false, // Opaque canvas — clearColor fills gaps, no HTML bleed-through
    });
    // Force an initial resize to ensure the WebGL viewport matches the canvas CSS dimensions.
    // Without this, the engine may use stale dimensions from the initial canvas layout.
    this._engine.resize();
    Log.debug(
      `WorldRenderer: Engine created, render size: ${this._engine.getRenderWidth()}x${this._engine.getRenderHeight()}, webgl ${this._engine.webGLVersion}`
    );

    // Create scene — use shared MinecraftEnvironment configuration
    this._scene = new BABYLON.Scene(this._engine);
    MinecraftEnvironment.configureScene(this._scene, {
      fogStart: 48,
      fogEnd: 128,
      worldPerformanceMode: true,
    });
    // Ambient color raised from 0.50 to 0.60 to brighten all block faces.
    // This adds a base brightness to all materials (via material.ambientColor),
    // preventing shadowed faces from appearing nearly black.
    this._scene.ambientColor = new BABYLON.Color3(0.6, 0.6, 0.62);
    // Opaque zenith blue clearColor — fills any sky dome pole gaps with sky color.
    this._scene.clearColor = new BABYLON.Color4(0.29, 0.56, 0.78, 1);
    // blockMaterialDirtyMechanism must be false so emissive/material changes take effect
    this._scene.blockMaterialDirtyMechanism = false;

    // Create camera
    this._camera = new BABYLON.FreeCamera("playerCamera", new BABYLON.Vector3(0, 70, 0), this._scene);
    this._camera.minZ = 0.1;
    this._camera.maxZ = 500;
    this._camera.fov = (70 * Math.PI) / 180;
    this._camera.inertia = 0;
    this._camera.speed = 0; // We handle movement ourselves
    this._camera.attachControl(canvas, false); // Don't attach default controls
    // Remove default keyboard/mouse inputs — higher-level tools manage navigation.
    this._camera.inputs.clear();

    // Create lighting — use shared MinecraftEnvironment configuration
    const lights = MinecraftEnvironment.configureLighting(this._scene, {
      addFillLight: true,
      fillLightIntensity: 0.5,
      ambientColor: new BABYLON.Color3(0.6, 0.6, 0.62),
    });
    this._ambientLight = lights.ambient;
    this._sunLight = lights.sun;

    // Create chunk mesh builder — pass BlockRenderDatabase for consistent colors
    this._chunkMeshBuilder = new ChunkMeshBuilder(this._scene, renderDb);
    this._chunkMeshBuilder.setWorldState(worldState);

    // Auto-compute fog-cull distance: blocks beyond 65% fog are hard-culled.
    // At 65% fog, blocks are only 35% visible — barely perceptible against the sky.
    // This eliminates "terrain walls" — opaque fog-colored blocks visible against the sky.
    const fogCullDist = this._scene.fogStart + 0.65 * (this._scene.fogEnd - this._scene.fogStart);
    this._chunkMeshBuilder.fogCullDistSq = fogCullDist * fogCullDist;

    // Create sky dome — shared MinecraftEnvironment sky
    this._skybox = MinecraftEnvironment.createSkyDome(this._scene);

    // Create ground plane — extends beyond loaded chunks to prevent sky showing below terrain edges
    this._groundPlane = MinecraftEnvironment.createWorldGroundPlane(this._scene);

    // Handle window resize
    window.addEventListener("resize", this._onResize);
  }

  /**
   * Load Database catalogs and create BlockMeshFactory for textured rendering.
   * Call this after constructing WorldRenderer to enable textures (same pipeline as VolumeEditor).
   * Without this, ChunkMeshBuilder falls back to BlockRenderDatabase vertex colors.
   */
  async initializeDatabase(): Promise<void> {
    if (this._databaseLoaded) return;
    try {
      Log.debug("WorldRenderer: Loading vanilla catalog...");
      await Database.loadVanillaCatalog();
      Log.debug("WorldRenderer: Loading vanilla resource definitions...");
      await Database.loadVanillaResourceDefinitions();
      Log.debug("WorldRenderer: Creating BlockMeshFactory...");
      this._meshFactory = new BlockMeshFactory(this._scene);
      this._chunkMeshBuilder.setMeshFactory(this._meshFactory);

      // Create per-face atlas templates (grass_block with green top + dirt sides, oak_log with bark)
      // Must happen after setMeshFactory so texture paths resolve correctly
      Log.debug("WorldRenderer: Creating per-face atlas templates...");
      await this._chunkMeshBuilder.createAtlasTemplates();

      this._modelMeshFactory = new ModelMeshFactory(this._scene);
      this._databaseLoaded = true;
      Log.debug("WorldRenderer: Database initialized successfully, textured rendering enabled");
    } catch (e) {
      Log.debug("WorldRenderer: Database initialization FAILED: " + e);
    }
  }

  /**
   * Set or update the BlockRenderDatabase (e.g., after loading mccat.json).
   */
  setRenderDatabase(renderDb: BlockRenderDatabase): void {
    this._renderDb = renderDb;
    this._chunkMeshBuilder.setRenderDatabase(renderDb);
  }

  /**
   * Set maximum Y coordinate to render. Blocks above this Y are skipped entirely.
   * Useful for hiding natural terrain above a cleared area without racing SubChunk arrivals.
   */
  set maxRenderY(y: number) {
    this._chunkMeshBuilder.maxRenderY = y;
  }

  get maxRenderY(): number {
    return this._chunkMeshBuilder.maxRenderY;
  }

  /**
   * Set render center and maximum radius for radial culling.
   * Blocks beyond maxRenderRadius from (centerX, centerZ) are not rendered.
   * Set radius slightly below fogEnd so culled edges are fully fog-hidden.
   */
  setRenderCenter(centerX: number, centerZ: number, maxRadius: number, nearRadius?: number, groundY?: number): void {
    this._chunkMeshBuilder.renderCenterX = centerX;
    this._chunkMeshBuilder.renderCenterZ = centerZ;
    this._chunkMeshBuilder.maxRenderRadius = maxRadius;
    if (nearRadius !== undefined) this._chunkMeshBuilder.nearRenderRadius = nearRadius;
    if (groundY !== undefined) this._chunkMeshBuilder.groundRenderY = groundY;
  }

  get maxRenderRadius(): number {
    return this._chunkMeshBuilder.maxRenderRadius;
  }

  get engine(): BABYLON.Engine {
    return this._engine;
  }
  get scene(): BABYLON.Scene {
    return this._scene;
  }
  get camera(): BABYLON.FreeCamera {
    return this._camera;
  }

  /**
   * Update camera position and rotation from player controller state.
   * Skipped when camera override is active (for testing/debugging).
   */
  updateCamera(eyePosition: { x: number; y: number; z: number }, rotation: { pitch: number; yaw: number }): void {
    if (this._cameraOverride) return;

    this._camera.position.set(eyePosition.x, eyePosition.y, eyePosition.z);

    // Convert Minecraft rotation to Babylon.js camera rotation
    // Our convention: positive pitch = looking up, negative = looking down
    // Babylon.js FreeCamera: positive rotation.x = looking DOWN
    // So we negate pitch for the conversion.
    this._camera.rotation.x = (-rotation.pitch * Math.PI) / 180;
    this._camera.rotation.y = ((rotation.yaw + 180) * Math.PI) / 180;

    // Keep ground plane centered under camera
    this._updateGroundPlanePosition();
  }

  /**
   * Set camera position and target directly, bypassing player controller.
   * Enables camera override mode so the game loop won't reset the position.
   */
  setCameraOverride(px: number, py: number, pz: number, tx?: number, ty?: number, tz?: number): void {
    this._cameraOverride = true;
    this._camera.position.set(px, py, pz);
    if (tx !== undefined && ty !== undefined && tz !== undefined) {
      this._camera.setTarget(new BABYLON.Vector3(tx, ty, tz));
      Log.verbose(
        `WorldRenderer.setCameraOverride: pos=(${px.toFixed(1)},${py.toFixed(1)},${pz.toFixed(1)}) target=(${tx.toFixed(1)},${ty.toFixed(1)},${tz.toFixed(1)}) rotation=(${this._camera.rotation.x.toFixed(3)},${this._camera.rotation.y.toFixed(3)},${this._camera.rotation.z.toFixed(3)})`
      );
    }
    // Keep ground plane centered under camera
    this._updateGroundPlanePosition();
  }

  /**
   * Clear camera override, resuming normal player-following camera.
   */
  clearCameraOverride(): void {
    this._cameraOverride = false;
  }

  /**
   * Disable block highlight wireframe. Re-enable with setBlockHighlightEnabled(true).
   * This persists across game loop ticks unlike hideBlockHighlight().
   */
  hideBlockHighlight(): void {
    this._blockHighlightEnabled = false;
    if (this._blockHighlight) {
      this._blockHighlight.isVisible = false;
    }
  }

  /**
   * Re-enable block highlight after hiding.
   */
  setBlockHighlightEnabled(enabled: boolean): void {
    this._blockHighlightEnabled = enabled;
    if (!enabled && this._blockHighlight) {
      this._blockHighlight.isVisible = false;
    }
  }

  /**
   * Show/hide all entity meshes. Useful for clean terrain screenshots.
   */
  setEntityMeshesVisible(visible: boolean): void {
    this._entityMeshesEnabled = visible;
    for (const mesh of this._entityMeshes.values()) {
      mesh.isVisible = visible;
      // Also hide children (model cubes are children of the root mesh)
      if (mesh.getChildMeshes) {
        for (const child of mesh.getChildMeshes()) {
          child.isVisible = visible;
        }
      }
    }
  }

  /**
   * Update the block highlight wireframe to show on the targeted block.
   * Creates a slightly-inflated wireframe cube to indicate which block the player is looking at.
   */
  updateBlockHighlight(blockPos: { x: number; y: number; z: number } | null): void {
    if (!blockPos || !this._blockHighlightEnabled) {
      if (this._blockHighlight) {
        this._blockHighlight.isVisible = false;
      }
      return;
    }

    if (!this._blockHighlight) {
      this._blockHighlightMaterial = new BABYLON.StandardMaterial("blockHighlightMat", this._scene);
      this._blockHighlightMaterial.wireframe = true;
      this._blockHighlightMaterial.emissiveColor = new BABYLON.Color3(0, 0, 0);
      this._blockHighlightMaterial.diffuseColor = new BABYLON.Color3(0, 0, 0);
      this._blockHighlightMaterial.disableLighting = true;

      this._blockHighlight = BABYLON.MeshBuilder.CreateBox("blockHighlight", { size: 1.005 }, this._scene);
      this._blockHighlight.material = this._blockHighlightMaterial;
      this._blockHighlight.isPickable = false;
      this._blockHighlight.renderingGroupId = 1; // Render on top
    }

    this._blockHighlight.isVisible = true;
    this._blockHighlight.position.set(blockPos.x + 0.5, blockPos.y + 0.5, blockPos.z + 0.5);
  }

  /**
   * Process dirty chunks and generate/update meshes.
   * Called every frame but rate-limited with adaptive rate and nearest-first priority.
   *
   * ADAPTIVE RATE: When many dirty chunks arrive (e.g., SubChunk data batch), process
   * up to 24 chunks/frame for fast terrain appearance. When few dirty chunks trickle in,
   * process up to 4 chunks/frame to save CPU. The rate adapts dynamically to burst size.
   *
   * NEAREST-FIRST: Sort dirty chunks by distance to camera so terrain closest to the
   * player renders first, giving a better loading experience.
   */
  updateChunkMeshes(): void {
    // Hard cap: if too many chunk entries, aggressively unload distant ones.
    // Cap at 300 — fog distance filtering already limits builds to ~200 chunks,
    // so this is a safety valve for extreme cases, not a regular limiter.
    if (this._chunkMeshes.size > 300) {
      this.unloadDistantChunks(64);
      const dirtyChunks = this._worldState.consumeDirtyChunks();
      for (const c of dirtyChunks) {
        this._worldState.markChunkDirty(c);
      }
      return;
    }

    const dirtyChunks = this._worldState.consumeDirtyChunks();

    if (dirtyChunks.length === 0) {
      return;
    }

    this._totalRebuildCycles++;
    if (this._totalRebuildCycles <= 5 || this._totalRebuildCycles % 500 === 0) {
      Log.verbose(
        `WorldRenderer.updateChunkMeshes[${this._totalRebuildCycles}]: ${dirtyChunks.length} dirty chunks, totalBuilt=${this._totalChunksBuilt}, meshes=${this._chunkMeshes.size}`
      );
    }

    // Adaptive rate: process more chunks when many are dirty (burst mode)
    const maxPerFrame = dirtyChunks.length > 20 ? Math.min(32, dirtyChunks.length) : this._baseChunkRate;

    // Filter out chunks beyond render distance FIRST (avoids sorting distant chunks)
    // Render distance MUST match fogCullDist (not fogEnd) — blocks beyond fogCullDist
    // are hard-culled anyway, so processing chunks beyond that distance is pure waste.
    // fogCullDist ≈ fogStart + 0.65*(fogEnd-fogStart) = 48 + 0.65*80 ≈ 100 blocks.
    // Use fogCullDist + 16 blocks to include chunks that straddle the boundary.
    const fogCullDist = this._scene.fogStart + 0.65 * (this._scene.fogEnd - this._scene.fogStart);
    const RENDER_DISTANCE_SQ = (fogCullDist + 16) * (fogCullDist + 16);
    const camX = this._camera.position.x;
    const camZ = this._camera.position.z;
    const nearbyDirty: IChunkColumn[] = [];
    const farDirty: IChunkColumn[] = [];
    for (const c of dirtyChunks) {
      const dx = c.x * 16 + 8 - camX;
      const dz = c.z * 16 + 8 - camZ;
      if (dx * dx + dz * dz <= RENDER_DISTANCE_SQ) {
        nearbyDirty.push(c);
      } else {
        farDirty.push(c);
      }
    }

    // Sort only nearby chunks by distance — nearest first for better loading experience
    nearbyDirty.sort((a, b) => {
      const distA = (a.x * 16 + 8 - camX) ** 2 + (a.z * 16 + 8 - camZ) ** 2;
      const distB = (b.x * 16 + 8 - camX) ** 2 + (b.z * 16 + 8 - camZ) ** 2;
      return distA - distB;
    });

    // Re-enqueue far chunks for future processing (don't discard them)
    for (const c of farDirty) {
      this._worldState.markChunkDirty(c);
    }

    const toProcess = nearbyDirty.slice(0, maxPerFrame);

    for (const chunk of toProcess) {
      const key = `${chunk.x},${chunk.z}`;

      // Dispose old meshes tracked in the map
      const oldMeshes = this._chunkMeshes.get(key);
      if (oldMeshes) {
        for (const m of oldMeshes) {
          m.dispose();
        }
        this._chunkMeshes.delete(key);
      }

      // Safety net: also dispose any orphaned scene meshes for this chunk.
      // Collect first, then dispose — disposing during iteration of scene.meshes
      // causes Babylon.js to remove the mesh from the array, skipping elements.
      const chunkPrefix = `chunk_${chunk.x}_${chunk.z}_`;
      const orphans: BABYLON.AbstractMesh[] = [];
      for (const m of this._scene.meshes) {
        if (!m.isDisposed() && m.name.startsWith(chunkPrefix)) {
          orphans.push(m);
        }
      }
      for (const m of orphans) {
        m.dispose();
      }

      // Build new meshes
      const result = this._chunkMeshBuilder.buildChunkMesh(chunk, (id) => this._worldState.getBlockName(id));
      this._totalChunksBuilt++;

      if (result.meshes.length > 0) {
        this._chunkMeshes.set(key, result.meshes);
        for (const m of result.meshes) {
          // Don't freeze thin instance meshes — freezeWorldMatrix() prevents
          // Babylon.js from applying the thin instance matrix buffer.
          if (!m.thinInstanceCount || m.thinInstanceCount === 0) {
            m.freezeWorldMatrix();
          }
          // NOTE: Do NOT freeze the material. material.freeze() sets checkReadyOnlyOnce=true,
          // which locks the shader defines from the FIRST mesh. If that first mesh had
          // vertex colors (VERTEXCOLOR=true) but a later mesh using the same material does
          // NOT have vertex colors, the shader reads default (0,0,0) for the missing attribute,
          // zeroing the diffuse contribution and producing black output. This was the root
          // cause of the "black ceiling" bug — the shared atlas material's frozen shader
          // expected vertex colors on ALL meshes, but duplicate meshes without vertex colors
          // rendered as black.
        }
      }

      chunk.meshGenerated = true;
    }

    // Re-enqueue remaining nearby dirty chunks back into worldState
    if (nearbyDirty.length > maxPerFrame) {
      for (let i = maxPerFrame; i < nearbyDirty.length; i++) {
        this._worldState.markChunkDirty(nearbyDirty[i]);
      }
    }
  }

  /**
   * Rebuild ALL dirty chunks synchronously, ignoring per-frame limits.
   * Used by tests and automated screenshots to ensure complete rendering.
   */
  rebuildAllDirtyChunks(): number {
    let totalRebuilt = 0;
    let iterations = 0;
    const MAX_ITERATIONS = 100; // Safety limit to prevent infinite loop
    while (iterations < MAX_ITERATIONS) {
      const dirtyChunks = this._worldState.consumeDirtyChunks();
      if (dirtyChunks.length === 0) break;
      iterations++;
      for (const chunk of dirtyChunks) {
        const key = `${chunk.x},${chunk.z}`;
        const oldMeshes = this._chunkMeshes.get(key);
        if (oldMeshes) {
          for (const m of oldMeshes) m.dispose();
          this._chunkMeshes.delete(key);
        }
        // Safety net: dispose orphaned scene meshes (collect first to avoid array mutation)
        const chunkPrefix = `chunk_${chunk.x}_${chunk.z}_`;
        const orphans: BABYLON.AbstractMesh[] = [];
        for (const m of this._scene.meshes) {
          if (!m.isDisposed() && m.name.startsWith(chunkPrefix)) {
            orphans.push(m);
          }
        }
        for (const m of orphans) {
          m.dispose();
        }
        const result = this._chunkMeshBuilder.buildChunkMesh(chunk, (id) => this._worldState.getBlockName(id));
        this._totalChunksBuilt++;
        if (result.meshes.length > 0) {
          this._chunkMeshes.set(key, result.meshes);
          for (const m of result.meshes) {
            if (!m.thinInstanceCount || m.thinInstanceCount === 0) {
              m.freezeWorldMatrix();
            }
            // NOTE: Do NOT freeze material — see comment in updateChunkMeshes
          }
        }
        chunk.meshGenerated = true;
        totalRebuilt++;
      }
    }
    return totalRebuilt;
  }

  /**
   * Dispose any chunk meshes in the scene that are NOT tracked in _chunkMeshes.
   * This catches orphaned meshes from any source (timing issues, map overwrites, etc.).
   * Returns the number of orphans disposed.
   */
  disposeOrphanedChunkMeshes(): number {
    // Build a set of all tracked mesh uniqueIds for fast lookup
    const trackedIds = new Set<number>();
    for (const [, meshes] of this._chunkMeshes) {
      for (const m of meshes) {
        trackedIds.add(m.uniqueId);
      }
    }

    // Collect orphaned chunk meshes (collect first, dispose after to avoid array mutation)
    const orphans: BABYLON.AbstractMesh[] = [];
    for (const m of this._scene.meshes) {
      if (!m.isDisposed() && m.name.startsWith("chunk_") && !trackedIds.has(m.uniqueId)) {
        orphans.push(m);
      }
    }

    for (const m of orphans) {
      m.dispose();
    }

    return orphans.length;
  }

  /**
   * Collapse all MultiMaterial meshes in the scene to single material.
   * This is a safety net for any meshes that slipped through the per-chunk collapse.
   * Returns the number of meshes fixed.
   */
  collapseAllMultiMaterials(): number {
    let fixed = 0;
    for (const [, meshes] of this._chunkMeshes) {
      for (const m of meshes) {
        if (m.material && m.material.getClassName() === "MultiMaterial") {
          const subs = (m.material as BABYLON.MultiMaterial).subMaterials;
          if (subs && subs.length > 0) {
            for (let si = 0; si < subs.length; si++) {
              if (subs[si]) {
                m.material = subs[si];
                m.subMeshes = [];
                new BABYLON.SubMesh(0, 0, m.getTotalVertices(), 0, m.getTotalIndices(), m);
                fixed++;
                break;
              }
            }
          }
        }
      }
    }
    return fixed;
  }

  unloadDistantChunks(maxDistance: number = 192): void {
    const camX = this._camera.position.x;
    const camZ = this._camera.position.z;
    const maxDistSq = maxDistance * maxDistance;

    for (const [key, meshes] of this._chunkMeshes) {
      const parts = key.split(",");
      const cx = parseInt(parts[0]) * 16 + 8;
      const cz = parseInt(parts[1]) * 16 + 8;
      const distSq = (cx - camX) ** 2 + (cz - camZ) ** 2;

      if (distSq > maxDistSq) {
        for (const m of meshes) {
          m.dispose();
        }
        this._chunkMeshes.delete(key);
        // NOTE: Do NOT re-dirty unloaded chunks here. Re-dirtying creates an
        // infinite build/dispose cycle: unload → re-dirty → rebuild next frame →
        // mesh count rises → hard cap triggers unload again → pulsing terrain.
        // Instead, ensureNearbyChunkMeshes() periodically detects chunks in range
        // with no mesh and re-dirties them on demand.
      }
    }
  }

  /**
   * Scan loaded chunks that are within render distance but have no mesh, and
   * re-dirty them so they rebuild. This handles the "camera moved back toward
   * previously-unloaded chunks" case without creating a build/dispose cycle.
   *
   * Called periodically (every ~300 frames) from the update loop, NOT from
   * unloadDistantChunks, to decouple unloading from rebuilding.
   */
  ensureNearbyChunkMeshes(): void {
    const fogCullDist = this._scene.fogStart + 0.65 * (this._scene.fogEnd - this._scene.fogStart);
    const maxDistSq = (fogCullDist + 16) * (fogCullDist + 16);
    const camX = this._camera.position.x;
    const camZ = this._camera.position.z;
    let reDirtied = 0;

    for (const [key, chunk] of this._worldState.chunks) {
      if (this._chunkMeshes.has(key)) {
        continue; // already has a mesh
      }
      const cx = chunk.x * 16 + 8;
      const cz = chunk.z * 16 + 8;
      const distSq = (cx - camX) ** 2 + (cz - camZ) ** 2;
      if (distSq <= maxDistSq) {
        this._worldState.markChunkDirty(chunk);
        reDirtied++;
      }
    }

    if (reDirtied > 0) {
      Log.verbose(`WorldRenderer.ensureNearbyChunkMeshes: re-dirtied ${reDirtied} chunks within render distance`);
    }
  }

  /**
   * Update entity meshes based on EntityManager state.
   * Uses ModelMeshFactory + VanillaProjectManager for proper entity models.
   * Falls back to colored boxes when model data is not yet loaded or unavailable.
   */
  updateEntityMeshes(): void {
    const currentEntities = this._entityManager.entities;

    // Remove meshes for despawned entities
    for (const [runtimeId, mesh] of this._entityMeshes) {
      if (!currentEntities.has(runtimeId)) {
        mesh.dispose();
        this._entityMeshes.delete(runtimeId);
        this._entityMeshVisible.delete(runtimeId);
      }
    }

    // If entity meshes are disabled, hide all and skip updates
    if (!this._entityMeshesEnabled) {
      for (const mesh of this._entityMeshes.values()) {
        this._setMeshTreeVisible(mesh, false);
      }
      return;
    }

    // Create/update meshes for entities
    // Performance: cap total entity meshes to limit draw calls (each entity = 5-15 child meshes).
    // Also limit far distance to fogCullDist since entities beyond that are fog-hidden.
    let entityMeshCount = 0;
    const MAX_ENTITY_MESHES = 60; // Reduced for performance — each entity = 5-15 child meshes
    const camPos = this._camera.position;
    const NEAR_CAMERA_DIST_SQ = 1; // 1 block — hide entities closer than this
    const FAR_ENTITY_DIST_SQ = 18 * 18; // 18 blocks — aligned with fogCullDist (~17 blocks)

    for (const [runtimeId, entity] of currentEntities) {
      // Skip item entities, XP orbs, and projectiles — too numerous and small
      const shortType = entity.typeId.replace("minecraft:", "");
      if (
        shortType === "item" ||
        shortType === "xp_orb" ||
        shortType === "experience_orb" ||
        shortType === "arrow" ||
        shortType === "thrown_trident" ||
        shortType === "falling_block"
      ) {
        continue;
      }

      // Hide entities too close to camera (they'd fill the screen and obstruct view)
      // Also hide entities too far from camera for performance
      const ePos = this._entityManager.getInterpolatedPosition(runtimeId);
      if (ePos) {
        const dx = ePos.x - camPos.x,
          dy = ePos.y - camPos.y,
          dz = ePos.z - camPos.z;
        const distSq = dx * dx + dy * dy + dz * dz;
        if (distSq < NEAR_CAMERA_DIST_SQ || distSq > FAR_ENTITY_DIST_SQ) {
          const existing = this._entityMeshes.get(runtimeId);
          if (existing && this._entityMeshVisible.get(runtimeId) !== false) {
            this._setMeshTreeVisible(existing, false);
            this._entityMeshVisible.set(runtimeId, false);
          }
          continue;
        }
      }

      // Limit total entity meshes for performance
      if (!this._entityMeshes.has(runtimeId) && entityMeshCount >= MAX_ENTITY_MESHES) {
        continue;
      }

      let mesh = this._entityMeshes.get(runtimeId);

      if (!mesh) {
        mesh = this._createEntityMesh(runtimeId, entity);
        this._entityMeshes.set(runtimeId, mesh);
        this._entityMeshVisible.set(runtimeId, true);
      } else if (this._entityMeshVisible.get(runtimeId) !== true) {
        this._setMeshTreeVisible(mesh, true);
        this._entityMeshVisible.set(runtimeId, true);
      }
      entityMeshCount++;

      // Update position (interpolated)
      if (ePos) {
        mesh.position.set(ePos.x, ePos.y, ePos.z);
      }

      // Update rotation
      const rot = this._entityManager.getInterpolatedRotation(runtimeId);
      if (rot) {
        mesh.rotation.y = (rot.y * Math.PI) / 180;
      }
    }
  }

  /**
   * Set visibility on a mesh and all its descendants.
   * ModelMeshFactory creates bone hierarchies where visible cubes are child meshes.
   */
  private _setMeshTreeVisible(mesh: BABYLON.AbstractMesh, visible: boolean): void {
    mesh.isVisible = visible;
    const children = mesh.getChildMeshes(false);
    for (const child of children) {
      child.isVisible = visible;
    }
  }

  /**
   * Freeze all materials on an entity mesh tree for performance.
   * Entity materials don't change at runtime so we can freeze them once.
   */
  private _freezeEntityMeshMaterials(mesh: BABYLON.AbstractMesh): void {
    if (mesh.material) mesh.material.freeze();
    mesh.isPickable = false;
    const children = mesh.getChildMeshes(false);
    for (const child of children) {
      if (child.material) child.material.freeze();
      child.isPickable = false;
    }
  }

  /**
   * Merge entity child meshes into fewer draw calls for performance.
   * ModelMeshFactory creates one mesh per bone (15-22 meshes per entity).
   * Merging reduces this to 1-3 meshes per entity, dramatically reducing draw calls.
   * Returns the merged mesh (or original if merge isn't possible).
   */
  private _mergeEntityChildMeshes(rootMesh: BABYLON.Mesh): BABYLON.Mesh {
    const children = rootMesh.getChildMeshes(false) as BABYLON.Mesh[];
    if (children.length <= 1) return rootMesh;

    // Apply world transforms to children before merging (bake parent transforms)
    rootMesh.computeWorldMatrix(true);
    for (const child of children) {
      child.computeWorldMatrix(true);
      // Bake the world transform into the mesh vertices
      child.bakeCurrentTransformIntoVertices();
      child.parent = null; // Detach from parent hierarchy
    }

    // Group children by material for efficient merging
    const byMaterial = new Map<string, BABYLON.Mesh[]>();
    for (const child of children) {
      const matId = child.material?.uniqueId?.toString() || "none";
      if (!byMaterial.has(matId)) byMaterial.set(matId, []);
      byMaterial.get(matId)!.push(child);
    }

    const mergedMeshes: BABYLON.Mesh[] = [];
    for (const [, meshGroup] of byMaterial) {
      if (meshGroup.length === 1) {
        mergedMeshes.push(meshGroup[0]);
      } else {
        const merged = BABYLON.Mesh.MergeMeshes(meshGroup, true, true);
        if (merged) {
          mergedMeshes.push(merged);
        } else {
          // Merge failed — keep originals
          mergedMeshes.push(...meshGroup);
        }
      }
    }

    // Create a new container mesh and parent all merged meshes
    const container = new BABYLON.Mesh(rootMesh.name + "_merged", this._scene);
    for (const m of mergedMeshes) {
      m.parent = container;
      m.isPickable = false;
      if (m.material) m.material.freeze();
    }

    rootMesh.dispose();
    return container;
  }

  /**
   * Create an entity mesh — uses ModelMeshFactory if model data is available,
   * otherwise creates a placeholder box and triggers async model loading.
   */
  private _createEntityMesh(runtimeId: number, entity: IEntityState): BABYLON.Mesh {
    const typeId = entity.typeId.replace("minecraft:", "");
    const cacheKey = typeId;

    // Check if model data is already cached
    if (this._entityModelCache.has(cacheKey)) {
      const modelData = this._entityModelCache.get(cacheKey);
      if (modelData && modelData.modelDefinition && this._modelMeshFactory) {
        const modelMesh = this._modelMeshFactory.createMesh(
          `entity_${runtimeId}`,
          modelData.geometry!,
          `tex_${typeId}`,
          modelData.textureData,
          modelData.textureUrl,
          modelData.geometryId
        );
        if (modelMesh) {
          // Merge child meshes to reduce draw calls (15-22 children → 1-3 meshes)
          const merged = this._mergeEntityChildMeshes(modelMesh);
          this._freezeEntityMeshMaterials(merged);
          return merged;
        }
      }
    }

    // Start async loading if not already in progress
    if (!this._entityModelLoading.has(cacheKey) && !this._entityModelCache.has(cacheKey)) {
      this._loadEntityModel(cacheKey, runtimeId);
    }

    // Create placeholder box
    const dims = this._getEntityDimensions(entity.typeId);
    const mesh = BABYLON.MeshBuilder.CreateBox(
      `entity_${runtimeId}`,
      { width: dims.width, height: dims.height, depth: dims.depth },
      this._scene
    );
    const material = new BABYLON.StandardMaterial(`entityMat_${runtimeId}`, this._scene);
    const color = this._getEntityColor(entity);
    material.diffuseColor = color;
    material.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
    material.alpha = 0.0; // Hidden placeholder — invisible until model loads asynchronously
    mesh.material = material;
    // Offset box to sit on ground (bottom at origin)
    mesh.position.y = dims.height / 2;
    return mesh;
  }

  /**
   * Async load entity model data and replace placeholder meshes when ready.
   */
  private async _loadEntityModel(typeId: string, triggerRuntimeId: number): Promise<void> {
    this._entityModelLoading.add(typeId);
    try {
      Log.debug(`WorldRenderer: Loading entity model for '${typeId}'...`);
      const modelData = await VanillaProjectManager.getVanillaEntityModelData(typeId);
      this._entityModelCache.set(typeId, modelData);

      if (modelData && modelData.modelDefinition && modelData.geometry && this._modelMeshFactory) {
        Log.debug(
          `WorldRenderer: Model loaded for '${typeId}' geoId=${modelData.geometryId} tex=${modelData.textureUrl ? "yes" : "no"}`
        );
        // Replace all existing placeholder meshes for this entity type
        const currentEntities = this._entityManager.entities;
        for (const [runtimeId, entity] of currentEntities) {
          if (entity.typeId.replace("minecraft:", "") === typeId) {
            const oldMesh = this._entityMeshes.get(runtimeId);
            if (oldMesh) {
              // Save position/rotation before disposing
              const savedPos = oldMesh.position.clone();
              const savedRot = oldMesh.rotation.clone();
              oldMesh.dispose();

              const newMesh = this._modelMeshFactory!.createMesh(
                `entity_${runtimeId}`,
                modelData.geometry!,
                `tex_${typeId}`,
                modelData.textureData,
                modelData.textureUrl,
                modelData.geometryId
              );
              if (newMesh) {
                // Merge child meshes to reduce draw calls
                const merged = this._mergeEntityChildMeshes(newMesh);
                merged.position = savedPos;
                merged.rotation = savedRot;
                this._freezeEntityMeshMaterials(merged);
                this._entityMeshes.set(runtimeId, merged);
              } else {
                // Model creation failed — recreate placeholder
                const dims = this._getEntityDimensions(entity.typeId);
                const fallback = BABYLON.MeshBuilder.CreateBox(
                  `entity_${runtimeId}`,
                  { width: dims.width, height: dims.height, depth: dims.depth },
                  this._scene
                );
                const mat = new BABYLON.StandardMaterial(`entityMat_${runtimeId}`, this._scene);
                mat.diffuseColor = this._getEntityColor(entity);
                mat.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
                fallback.material = mat;
                fallback.position = savedPos;
                fallback.rotation = savedRot;
                this._entityMeshes.set(runtimeId, fallback);
              }
            }
          }
        }
      } else {
        Log.debug(
          `WorldRenderer: No model data for '${typeId}' — using placeholder. modelDef=${!!modelData?.modelDefinition} geo=${!!modelData?.geometry} factory=${!!this._modelMeshFactory}`
        );
      }
    } catch (e) {
      Log.debug(`WorldRenderer: Failed to load entity model for ${typeId}: ${e}`);
      this._entityModelCache.set(typeId, null);
    } finally {
      this._entityModelLoading.delete(typeId);
    }
  }

  /**
   * Get entity dimensions based on entity type ID.
   */
  private _getEntityDimensions(typeId: string): { width: number; height: number; depth: number } {
    const short = typeId.replace("minecraft:", "");
    // Player
    if (short === "player") return { width: 0.6, height: 1.8, depth: 0.6 };
    // Large mobs
    if (
      short === "horse" ||
      short === "donkey" ||
      short === "mule" ||
      short === "skeleton_horse" ||
      short === "zombie_horse"
    )
      return { width: 1.4, height: 1.6, depth: 1.4 };
    if (short === "cow" || short === "mooshroom") return { width: 0.9, height: 1.4, depth: 0.9 };
    if (short === "iron_golem") return { width: 1.4, height: 2.7, depth: 1.4 };
    if (short === "ravager") return { width: 1.95, height: 2.2, depth: 1.95 };
    if (short === "ghast") return { width: 4, height: 4, depth: 4 };
    if (short === "ender_dragon") return { width: 4, height: 4, depth: 4 };
    if (short === "wither") return { width: 3, height: 3.5, depth: 3 };
    if (short === "warden") return { width: 0.9, height: 2.9, depth: 0.9 };
    // Medium mobs
    if (
      short === "zombie" ||
      short === "skeleton" ||
      short === "creeper" ||
      short === "pillager" ||
      short === "vindicator" ||
      short === "witch" ||
      short === "enderman"
    )
      return { width: 0.6, height: 1.8, depth: 0.6 };
    if (short === "pig" || short === "sheep") return { width: 0.9, height: 0.9, depth: 0.9 };
    if (short === "wolf" || short === "fox" || short === "ocelot" || short === "cat")
      return { width: 0.6, height: 0.7, depth: 0.6 };
    if (short === "spider" || short === "cave_spider") return { width: 1.4, height: 0.9, depth: 1.4 };
    // Small mobs
    if (short === "chicken") return { width: 0.4, height: 0.7, depth: 0.4 };
    if (short === "rabbit" || short === "bat") return { width: 0.4, height: 0.5, depth: 0.4 };
    if (short === "bee") return { width: 0.7, height: 0.6, depth: 0.7 };
    if (short === "silverfish" || short === "endermite") return { width: 0.4, height: 0.3, depth: 0.4 };
    if (short === "slime" || short === "magma_cube") return { width: 1.0, height: 1.0, depth: 1.0 };
    // Items and projectiles
    if (short === "item") return { width: 0.25, height: 0.25, depth: 0.25 };
    if (short === "xp_orb" || short === "experience_orb") return { width: 0.2, height: 0.2, depth: 0.2 };
    if (short === "arrow") return { width: 0.15, height: 0.15, depth: 0.5 };
    // Default
    return { width: 0.6, height: 1.0, depth: 0.6 };
  }

  /**
   * Get entity color based on entity type and properties.
   */
  private _getEntityColor(entity: IEntityState): BABYLON.Color3 {
    if (entity.isPlayer) return new BABYLON.Color3(0.2, 0.6, 1.0); // blue for players
    const short = entity.typeId.replace("minecraft:", "");
    // Hostile mobs — red/dark red
    if (
      [
        "zombie",
        "skeleton",
        "creeper",
        "spider",
        "cave_spider",
        "enderman",
        "blaze",
        "ghast",
        "slime",
        "magma_cube",
        "wither_skeleton",
        "witch",
        "pillager",
        "vindicator",
        "ravager",
        "phantom",
        "drowned",
        "husk",
        "stray",
        "warden",
        "wither",
        "ender_dragon",
        "silverfish",
        "endermite",
        "guardian",
        "elder_guardian",
        "shulker",
        "vex",
        "evoker",
      ].includes(short)
    ) {
      return new BABYLON.Color3(0.8, 0.2, 0.2);
    }
    // Passive mobs — green
    if (
      [
        "pig",
        "cow",
        "sheep",
        "chicken",
        "horse",
        "donkey",
        "mule",
        "rabbit",
        "mooshroom",
        "cat",
        "ocelot",
        "wolf",
        "fox",
        "bee",
        "turtle",
        "dolphin",
        "squid",
        "glow_squid",
        "parrot",
        "bat",
        "frog",
        "tadpole",
        "allay",
        "sniffer",
        "camel",
        "armadillo",
      ].includes(short)
    ) {
      return new BABYLON.Color3(0.2, 0.8, 0.2);
    }
    // Neutral — yellow
    if (["iron_golem", "snow_golem", "llama", "trader_llama", "panda", "polar_bear", "goat"].includes(short)) {
      return new BABYLON.Color3(0.8, 0.8, 0.2);
    }
    // Items — white
    if (short === "item" || short === "xp_orb" || short === "experience_orb") {
      return new BABYLON.Color3(0.9, 0.9, 0.9);
    }
    // Villagers — brown
    if (short.includes("villager")) return new BABYLON.Color3(0.6, 0.45, 0.3);
    // Default — gray
    return new BABYLON.Color3(0.5, 0.5, 0.5);
  }

  /**
   * Update sky color based on time of day.
   */
  updateSky(worldTime: number): void {
    // Minecraft time: 0 = sunrise, 6000 = noon, 12000 = sunset, 18000 = midnight
    const normalizedTime = (worldTime % 24000) / 24000;
    let brightness: number;
    // Sunset/sunrise tint: warm orange/red during transitions
    let sunsetFactor = 0;

    // Minecraft day/night brightness curve — matches vanilla behavior where
    // full daylight is reached rapidly after sunrise (~1000 ticks) and stays
    // bright until near sunset. Previous curve was too gradual (reached 1.0
    // only at noon), causing early morning to appear very dark.
    if (normalizedTime < 0.04) {
      // Sunrise (0 → 960): rapid brightening from 0.5 to 1.0
      brightness = 0.5 + normalizedTime * 12.5; // 12.5 * 0.04 = 0.5
      sunsetFactor = 1.0 - normalizedTime / 0.04;
    } else if (normalizedTime < 0.46) {
      // Full daylight (960 → 11040): constant full brightness
      brightness = 1.0;
    } else if (normalizedTime < 0.5) {
      // Approaching sunset (11040 → 12000): gentle start of dimming
      brightness = 1.0 - (normalizedTime - 0.46) * 2.5; // 0.46→1.0, 0.5→0.9
      sunsetFactor = (normalizedTime - 0.46) / 0.04;
    } else if (normalizedTime < 0.54) {
      // Sunset to early night (12000 → 12960): rapid dimming with warm glow
      brightness = 0.9 - (normalizedTime - 0.5) * 12.5; // 0.5→0.9, 0.54→0.4
      sunsetFactor = 1.0 - (normalizedTime - 0.5) / 0.04;
    } else if (normalizedTime < 0.58) {
      // Dusk (12960 → 13920): dim to night level
      brightness = 0.4 - (normalizedTime - 0.54) * 6.25; // 0.54→0.4, 0.58→0.15
    } else if (normalizedTime < 0.92) {
      // Night (13920 → 22080)
      brightness = 0.15;
    } else {
      // Pre-dawn (22080 → 24000): gradual brightening to sunrise
      brightness = 0.15 + (normalizedTime - 0.92) * 4.375; // 0.92→0.15, 1.0→0.5
      if (normalizedTime > 0.96) sunsetFactor = (normalizedTime - 0.96) / 0.04;
    }

    brightness = Math.max(0.15, Math.min(1.0, brightness));
    sunsetFactor = Math.max(0, Math.min(1.0, sunsetFactor));

    // Sky color: blend between blue sky and warm sunset
    const dayR = 0.53,
      dayG = 0.81,
      dayB = 0.92;
    const sunR = 0.95,
      sunG = 0.45,
      sunB = 0.15;
    const skyR = (dayR * (1 - sunsetFactor) + sunR * sunsetFactor) * brightness;
    const skyG = (dayG * (1 - sunsetFactor) + sunG * sunsetFactor) * brightness;
    const skyB = (dayB * (1 - sunsetFactor) + sunB * sunsetFactor) * brightness;

    this._scene.clearColor = new BABYLON.Color4(skyR, skyG, skyB, 1);
    this._scene.fogColor = new BABYLON.Color3(skyR, skyG, skyB);

    // Update sky dome: dim/brighten uniformly (grayscale emissive preserves gradient hues)
    if (this._skybox && this._skybox.material) {
      const skyMat = this._skybox.material as BABYLON.StandardMaterial;
      const b = Math.max(0.05, brightness);
      skyMat.emissiveColor = new BABYLON.Color3(b, b, b);
    }

    // Scale intensities to match base configureLighting values at full brightness:
    // ambient base = 1.15, sun base = 1.05. Previous formulas capped at
    // ambient=1.0, sun=0.9 — permanently 13-14% dimmer than designed.
    if (this._ambientLight) {
      this._ambientLight.intensity = 0.15 + brightness * 1.0;
    }
    if (this._sunLight) {
      this._sunLight.intensity = brightness * 1.05;
      // Warm sun color at sunset
      if (sunsetFactor > 0) {
        this._sunLight.diffuse = new BABYLON.Color3(1.0, 1.0 - sunsetFactor * 0.4, 1.0 - sunsetFactor * 0.7);
      } else {
        this._sunLight.diffuse = BABYLON.Color3.White();
      }
    }
  }

  /**
   * Keep the ground plane centered under the camera so it always extends in all directions.
   * Ground plane at Y=62 is always visible — it's far enough below terrain (Y=63+)
   * and structure floors (Y=64+) that z-fighting is prevented by the zOffset=10.
   */
  private _updateGroundPlanePosition(): void {
    if (this._groundPlane) {
      this._groundPlane.position.x = this._camera.position.x;
      this._groundPlane.position.z = this._camera.position.z;
      // Always show ground plane — it fills gaps at chunk edges and provides
      // a green base color extending to the fog-obscured horizon.
      this._groundPlane.setEnabled(true);
    }
  }

  /**
   * Get rendering statistics.
   */
  getStats(): IWorldRendererStats {
    return {
      fps: this._engine.getFps(),
      chunkMeshCount: this._chunkMeshes.size,
      entityMeshCount: this._entityMeshes.size,
      totalVertices: this._totalVertices,
      totalFaces: this._totalFaces,
      drawCalls: this._scene.getActiveMeshes().length,
      cameraPosition: {
        x: this._camera.position.x,
        y: this._camera.position.y,
        z: this._camera.position.z,
      },
    };
  }

  /**
   * Take a screenshot and return as data URL.
   */
  takeScreenshot(width: number = 1920, height: number = 1080): Promise<string> {
    return new Promise((resolve) => {
      BABYLON.Tools.CreateScreenshot(this._engine, this._camera, { width, height }, (data) => {
        resolve(data);
      });
    });
  }

  /**
   * Start the render loop.
   */
  startRenderLoop(): void {
    this._engine.runRenderLoop(() => {
      if (this._disposed) return;
      this._scene.render();
    });
  }

  /**
   * Stop the render loop.
   */
  stopRenderLoop(): void {
    this._engine.stopRenderLoop();
  }

  /**
   * Dispose all resources.
   */
  dispose(): void {
    this._disposed = true;
    window.removeEventListener("resize", this._onResize);
    this.stopRenderLoop();

    for (const meshes of this._chunkMeshes.values()) {
      for (const m of meshes) {
        m.dispose();
      }
    }
    this._chunkMeshes.clear();

    for (const mesh of this._entityMeshes.values()) {
      mesh.dispose();
    }
    this._entityMeshes.clear();
    this._entityMeshVisible.clear();

    if (this._groundPlane) {
      this._groundPlane.dispose();
      this._groundPlane = undefined;
    }

    if (this._meshFactory) {
      // BlockMeshFactory's materials are managed by Babylon.js scene disposal
      this._meshFactory = undefined;
    }

    this._chunkMeshBuilder.dispose();
    this._scene.dispose();
    this._engine.dispose();
  }

  private _onResize = (): void => {
    this._engine.resize();
  };
}
