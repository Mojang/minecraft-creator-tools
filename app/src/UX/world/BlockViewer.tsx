// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * BlockViewer - A dedicated component for viewing and testing block mesh rendering.
 *
 * ARCHITECTURE OVERVIEW:
 * ======================
 *
 * This component provides 3D visualization of Minecraft blocks using Babylon.js.
 * It is primarily used for:
 * 1. Visual regression testing with Playwright (vanilla blocks)
 * 2. Interactive block browsing in the web UI
 *
 * BLOCK TYPES SUPPORTED:
 * ----------------------
 * 1. VANILLA BLOCKS: Loaded from Database.blockTypes (loaded via loadVanillaCatalog)
 *    - Uses BlockType class which has texture and shape data
 *    - Renders using BlockMeshFactory.createMesh()
 *
 * 2. CUSTOM BLOCKS (via project): Handled by BlockTypeOverviewPanel + ModelViewer
 *    - Simple blocks (unit cube): Uses vanilla rendering approach
 *    - Complex blocks (custom geometry): Uses ModelViewer with geometry file
 *
 * URL PARAMETERS:
 * ---------------
 * - ?mode=blockviewer: Activates this viewer
 * - &block=<shortId>: Specific block to show (e.g., "oak_stairs")
 * - &headless=true: Hides UI chrome for CLI/batch rendering
 *
 * RELATED FILES:
 * --------------
 * - BlockMeshFactory.ts: Creates 3D meshes for different block shapes
 * - BlockType.ts: Block type data including textures and shape info
 * - BlockTypeOverviewPanel.tsx: Uses ModelViewer for custom block preview
 * - ModelViewer.tsx: Renders custom geometry models
 */

import { Component, createRef, RefObject } from "react";
import * as BABYLON from "babylonjs";
import BlockMeshFactory from "./BlockMeshFactory";
import MinecraftEnvironment from "./MinecraftEnvironment";
import Database from "../../minecraft/Database";
import Block from "../../minecraft/Block";
import BlockType from "../../minecraft/BlockType";
import Log from "../../core/Log";
import "./BlockViewer.css";

interface IBlockViewerProps {
  heightOffset: number;
  blockName?: string;
  showAllBlocks?: boolean;
}

interface IBlockViewerState {
  isLoaded: boolean;
  currentBlockIndex: number;
  blockTypes: BlockType[];
  errorMessage?: string;
}

export default class BlockViewer extends Component<IBlockViewerProps, IBlockViewerState> {
  private _canvasRef: RefObject<HTMLCanvasElement>;
  private _engine: BABYLON.Engine | null = null;
  private _scene: BABYLON.Scene | null = null;
  private _camera: BABYLON.ArcRotateCamera | null = null;
  private _blockMeshFactory: BlockMeshFactory | null = null;
  private _currentMesh: BABYLON.Mesh | null = null;

  constructor(props: IBlockViewerProps) {
    super(props);

    this._canvasRef = createRef<HTMLCanvasElement>();

    this.state = {
      isLoaded: false,
      currentBlockIndex: 0,
      blockTypes: [],
    };

    this._handleNextBlock = this._handleNextBlock.bind(this);
    this._handlePrevBlock = this._handlePrevBlock.bind(this);
    this._handleBlockSelect = this._handleBlockSelect.bind(this);
  }

  async componentDidMount() {
    await this._initializeScene();
    await this._loadBlockTypes();
  }

  componentWillUnmount() {
    if (this._engine) {
      this._engine.dispose();
    }
  }

  private _getBlockFromUrl(): string | undefined {
    // Parse URL for block parameter: ?mode=blockviewer&block=stone
    const params = new URLSearchParams(window.location.search);
    return params.get("block") || undefined;
  }

  private _isHeadlessMode(): boolean {
    // Parse URL for headless parameter: ?mode=blockviewer&block=stone&headless=true
    const params = new URLSearchParams(window.location.search);
    return params.get("headless") === "true";
  }

  private async _initializeScene() {
    const canvas = this._canvasRef.current;
    if (!canvas) return;

    // Opaque canvas — clearColor fills gaps, no HTML bleed-through
    this._engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true, alpha: false });

    this._scene = new BABYLON.Scene(this._engine);

    // Use shared scene configuration (clearColor, fog) — same as VolumeEditor/WorldRenderer
    MinecraftEnvironment.configureScene(this._scene);

    // Create camera
    this._camera = new BABYLON.ArcRotateCamera(
      "camera",
      Math.PI / 6, // 30° horizontal — offset from 45° to show billboard cross planes clearly
      Math.PI / 3,
      5,
      BABYLON.Vector3.Zero(),
      this._scene
    );
    this._camera.attachControl(canvas, true);
    this._camera.minZ = 0.1;
    this._camera.wheelPrecision = 50;

    // Use shared lighting pipeline — same as VolumeEditor/WorldRenderer
    MinecraftEnvironment.configureLighting(this._scene);

    // Create shared sky dome for consistent background across all 3D viewers
    MinecraftEnvironment.createSkyDome(this._scene);

    // Create block mesh factory with mock bounds
    const mockBounds = {
      fromX: -1,
      fromY: -1,
      fromZ: -1,
      toX: 1,
      toY: 1,
      toZ: 1,
    };
    this._blockMeshFactory = new BlockMeshFactory(this._scene, mockBounds);

    // Start render loop
    this._engine.runRenderLoop(() => {
      if (this._scene) {
        this._scene.render();
      }
    });

    // Handle window resize
    window.addEventListener("resize", () => {
      this._engine?.resize();
    });
  }

  private async _loadBlockTypes() {
    try {
      // Ensure the vanilla catalog is loaded
      await Database.loadVanillaCatalog();

      // Also load resource definitions (terrain_texture.json and blocks.json) for texture mapping
      await Database.loadVanillaResourceDefinitions();

      // Get all block types
      const blockTypes: BlockType[] = [];
      for (const name in Database.blockTypes) {
        const blockType = Database.blockTypes[name];
        // Skip air blocks (but not "stairs" which contains "air")
        // Skip element_ blocks (chemistry elements)
        const isAirBlock = name === "air" || name.endsWith("_air");
        if (blockType && !isAirBlock && !name.includes("element_")) {
          blockTypes.push(blockType);
        }
      }

      // Sort by name
      blockTypes.sort((a, b) => a.shortId.localeCompare(b.shortId));

      this.setState({ blockTypes, isLoaded: true }, () => {
        // Check URL parameter first, then props
        const blockFromUrl = this._getBlockFromUrl();
        const targetBlock = blockFromUrl || this.props.blockName;

        if (targetBlock) {
          const index = blockTypes.findIndex((bt) => bt.shortId === targetBlock);
          if (index >= 0) {
            this.setState({ currentBlockIndex: index }, () => {
              this._renderCurrentBlock();
            });
          } else if (blockTypes.length > 0) {
            this._renderCurrentBlock();
          }
        } else if (blockTypes.length > 0) {
          this._renderCurrentBlock();
        }
      });
    } catch (error) {
      this.setState({
        errorMessage: `Failed to load block types: ${error}`,
      });
    }
  }

  private _disposeMeshRecursively(mesh: BABYLON.Mesh) {
    // Dispose all children first
    const children = mesh.getChildMeshes();
    for (const child of children) {
      if (child instanceof BABYLON.Mesh) {
        this._disposeMeshRecursively(child);
      }
    }
    // Then dispose the mesh itself
    mesh.dispose();
  }

  private _renderCurrentBlock() {
    if (!this._blockMeshFactory || !this._scene) return;

    const { blockTypes, currentBlockIndex } = this.state;
    if (currentBlockIndex < 0 || currentBlockIndex >= blockTypes.length) return;

    // Remove existing mesh and all its children
    if (this._currentMesh) {
      this._disposeMeshRecursively(this._currentMesh);
      this._currentMesh = null;
    }

    const blockType = blockTypes[currentBlockIndex];

    // Create a mock block for rendering
    const block = this._createMockBlock(blockType);

    try {
      const mesh = this._blockMeshFactory.createMesh(`block_${blockType.shortId}`, block);

      if (mesh) {
        this._currentMesh = mesh;
        // Reset camera to focus on the block
        if (this._camera) {
          this._camera.setTarget(BABYLON.Vector3.Zero());
          this._camera.radius = 3;
        }
      }
    } catch (error) {
      Log.verbose(`Error rendering block ${blockType.shortId}: ${error}`);
      this.setState(() => ({
        errorMessage: `Error rendering ${blockType.shortId}: ${error}`,
      }));
    }
  }

  private _createMockBlock(blockType: BlockType): Block {
    // Create a block and set its type directly to reuse the existing BlockType
    const block = new Block();
    block.setType(blockType);

    // The Block class has private surroundings, but it will generate them
    // when accessed through the surroundings getter. For a standalone block,
    // all sides should be exposed (no neighbors).

    return block;
  }

  private _handleNextBlock() {
    const { blockTypes, currentBlockIndex } = this.state;
    if (currentBlockIndex < blockTypes.length - 1) {
      this.setState({ currentBlockIndex: currentBlockIndex + 1 }, () => {
        this._renderCurrentBlock();
      });
    }
  }

  private _handlePrevBlock() {
    const { currentBlockIndex } = this.state;
    if (currentBlockIndex > 0) {
      this.setState({ currentBlockIndex: currentBlockIndex - 1 }, () => {
        this._renderCurrentBlock();
      });
    }
  }

  private _handleBlockSelect(event: React.ChangeEvent<HTMLSelectElement>) {
    const index = parseInt(event.target.value, 10);
    this.setState({ currentBlockIndex: index }, () => {
      this._renderCurrentBlock();
    });
  }

  render() {
    const { heightOffset } = this.props;
    const { isLoaded, blockTypes, currentBlockIndex, errorMessage } = this.state;
    const isHeadless = this._isHeadlessMode();

    const currentBlockType = blockTypes[currentBlockIndex];
    const blockName = currentBlockType?.shortId || "Loading...";

    // Headless mode: only render canvas for CLI/batch rendering
    if (isHeadless) {
      return (
        <div className="bv-container bv-headless" style={{ height: "100vh", width: "100vw" }}>
          <canvas ref={this._canvasRef} className="bv-canvas bv-canvas-headless" data-testid="block-viewer-canvas" />
        </div>
      );
    }

    return (
      <div className="bv-container" style={{ height: `calc(100vh - ${heightOffset}px)` }}>
        <div className="bv-toolbar">
          <button className="bv-button" onClick={this._handlePrevBlock} disabled={currentBlockIndex <= 0}>
            ← Prev
          </button>

          <select
            className="bv-select"
            value={currentBlockIndex}
            onChange={this._handleBlockSelect}
            disabled={!isLoaded}
            aria-label="Select block"
          >
            {blockTypes.map((bt, index) => (
              <option key={bt.shortId} value={index}>
                {bt.shortId}
              </option>
            ))}
          </select>

          <button
            className="bv-button"
            onClick={this._handleNextBlock}
            disabled={currentBlockIndex >= blockTypes.length - 1}
          >
            Next →
          </button>

          <span className="bv-info">
            Block {currentBlockIndex + 1} of {blockTypes.length}
          </span>
        </div>

        <div className="bv-block-info">
          <h2>{blockName}</h2>
          {currentBlockType && (
            <div className="bv-block-details">
              <span>Base Type: {currentBlockType.baseType?.name || "unknown"}</span>
              {currentBlockType.mapColor && (
                <span
                  className="bv-color-swatch"
                  style={{ backgroundColor: currentBlockType.mapColor }}
                  role="img"
                  aria-label={`Map color: ${currentBlockType.mapColor}`}
                  title={`Map color: ${currentBlockType.mapColor}`}
                />
              )}
            </div>
          )}
        </div>

        {errorMessage && <div className="bv-error">{errorMessage}</div>}

        <canvas ref={this._canvasRef} className="bv-canvas" data-testid="block-viewer-canvas" />

        <div className="bv-footer">
          <p>Use mouse to rotate, scroll to zoom</p>
        </div>
      </div>
    );
  }
}
