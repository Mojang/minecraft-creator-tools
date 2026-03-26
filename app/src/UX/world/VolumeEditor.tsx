import { Component } from "react";
import { createPortal } from "react-dom";
import * as BABYLON from "babylonjs";
import * as GUI from "babylonjs-gui";
import BlockVolume from "../../minecraft/BlockVolume";
import Entity from "../../minecraft/Entity";
import Block from "../../minecraft/Block";
import BlockMeshFactory from "./BlockMeshFactory";
import MinecraftEnvironment from "./MinecraftEnvironment";
import IBlockVolumeBounds from "../../minecraft/IBlockVolumeBounds";
import Utilities from "../../core/Utilities";
import Log from "../../core/Log";
import Database from "../../minecraft/Database";
import TerrainTextureCatalogDefinition from "../../minecraft/TerrainTextureCatalogDefinition";
import BlocksCatalogDefinition from "../../minecraft/BlocksCatalogDefinition";
import { ModelMeshFactory } from "./ModelMeshFactory";
import BlockTypePicker from "./BlockTypePicker";
import VolumeEditorUndoManager, { VolumeActionType } from "./VolumeEditorUndoManager";
import { IVolumeEditorContext, IToolHoverInfo, IVolumeEditorTool } from "./IVolumeEditorTool";
import { BrushTool } from "./BrushTool";
import { PencilTool } from "./PencilTool";
import { BlockInspectorTool } from "./BlockInspectorTool";
import { HelpTool } from "./HelpTool";
import { PropertiesTool } from "./PropertiesTool";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faVectorSquare,
  faPaintBrush,
  faPencil,
  faMagnifyingGlass,
  faKeyboard,
  faRulerCombined,
} from "@fortawesome/free-solid-svg-icons";
import "./VolumeEditor.css";

/*
 * ==========================================================================================
 * VOLUME EDITOR ARCHITECTURE NOTES
 * ==========================================================================================
 *
 * ENVIRONMENT RENDERING:
 * ----------------------
 * Sky dome, lighting, ground planes, clouds, and sun are created via
 * MinecraftEnvironment.ts (shared with WorldRenderer) to ensure consistent
 * visual appearance across all 3D views. VolumeEditor calls these shared
 * methods from _createMinecraftEnvironment() / _createIsolatedEnvironment().
 *
 * COORDINATE SYSTEMS:
 * -------------------
 * This editor uses two coordinate systems that can be confusing:
 *
 * 1. DATA COORDINATES (x, y, z):
 *    - Used in BlockVolume, state (hoverX/Y/Z), and mesh metadata
 *    - Origin at (0,0,0), increasing in positive direction
 *
 * 2. VISUAL COORDINATES (Babylon.js scene):
 *    - X axis is FLIPPED: visualX = maxX - (dataX + 0.5)
 *    - Y and Z are direct: visualY = dataY + 0.5, visualZ = dataZ + 0.5
 *    - The +0.5 centers the mesh in the block cell
 *
 * BLOCK MESH METADATA SYSTEM:
 * ---------------------------
 * Block meshes store their data in mesh.metadata (IBlockMeshMetadata) to avoid
 * fragile name-based coordinate parsing. This provides:
 *
 * - blockX, blockY, blockZ: Data coordinates of the block
 * - isSolid: Whether this is a solid block (true) or air placeholder (false)
 * - blockType: The block type identifier (e.g., "minecraft:stone")
 *
 * Child meshes (like individual faces) inherit their parent's metadata.
 * The hover/click handlers first check metadata, then fall back to name parsing.
 *
 * HOVER INDICATOR SYSTEM:
 * -----------------------
 * Instead of applying edge rendering directly to block meshes (which could interfere
 * with picking), we use a dedicated _hoverIndicatorMesh - a wireframe box that moves
 * to the hovered block position. This provides:
 *
 * - Clear visual feedback without modifying block meshes
 * - isPickable=false so it doesn't interfere with mouse picking
 * - renderingGroupId=2 so it renders on top of blocks
 *
 * UNDO/REDO SYSTEM:
 * -----------------
 * The VolumeEditorUndoManager (./VolumeEditorUndoManager.ts) provides undo/redo for
 * block modifications. Key concepts:
 *
 * - Actions are recorded by capturing block state BEFORE and AFTER modification
 * - Each action stores only the blocks that changed (not the entire volume)
 * - Undo restores the "before" snapshot, redo restores the "after" snapshot
 * - Max 50 undo levels by default (configurable)
 *
 * Usage pattern in paint methods:
 *   1. _undoManager.beginAction(type, description)
 *   2. _undoManager.recordBlockBefore(volume, x, y, z) for each block
 *   3. Modify the block
 *   4. _undoManager.recordBlockAfter(volume, x, y, z) for each block
 *   5. _undoManager.endAction()
 *
 * Keyboard shortcuts: Ctrl+Z (undo), Ctrl+Y or Ctrl+Shift+Z (redo)
 *
 * MESH NAMING CONVENTIONS (LEGACY - prefer metadata):
 * ----------------------------------------------------
 * - "b" prefix: Solid block mesh (e.g., "b0.1.2;" or "b0.1.2|component")
 * - "p" prefix: Placeholder/air mesh (e.g., "p0.1.2")
 *
 * Names are still maintained for debugging, but mesh.metadata is the preferred
 * way to identify block positions. See IBlockMeshMetadata interface.
 *
 * PENCIL TOOL - FACE ADJACENT MODE:
 * ---------------------------------
 * When pencilCursorTarget === CursorTarget.Adjacent:
 *
 * The goal is: click on a block face → place new block adjacent to that face.
 *
 * CRITICAL BEHAVIOR:
 * - Hovering over SOLID block: Apply face offset to place adjacent to clicked face
 * - Hovering over AIR/placeholder: Place directly at that position (no offset)
 * - If adjacent position is out of bounds: Fall back to the hovered block position
 *
 * Face detection works by:
 * 1. _handleBlockPointerOver fires when mouse enters a mesh
 * 2. Reads block info from mesh.metadata (or falls back to name parsing)
 * 3. Picks solid block meshes at pointer position (filtering by metadata.isSolid)
 * 4. Computes which face was hit by comparing pick point to mesh center
 * 5. Stores offsets in state: hoverFaceOffsetX/Y/Z (-1, 0, or +1)
 * 6. _updatePencilPreview uses these pre-computed offsets
 *
 * The X offset is inverted (relX > 0 → -1) because visual X is flipped from data X.
 *
 * KEYBOARD SHORTCUTS:
 * -------------------
 * (Consistent with Minecraft Editor: https://learn.microsoft.com/en-us/minecraft/creator/documents/bedrockeditor/editorkeyboardinputs)
 *
 * Camera Movement:
 *   W/S         - Forward/Backward
 *   A/D         - Strafe Left/Right
 *   E/Q         - Move Up/Down
 *   G           - Fly to cursor position
 *   Mouse Wheel - Zoom
 *   Right-drag  - Rotate camera
 *
 * Selection:
 *   Arrow keys  - Move cursor in XZ plane
 *   PageUp/Down - Move cursor in Y
 *   Ctrl+D      - Deselect
 *   Space       - Apply action
 *   Left-click  - Select/paint block
 *
 * Editing:
 *   Ctrl+Z      - Undo last action
 *   Ctrl+Y      - Redo (also Ctrl+Shift+Z)
 *
 * BABYLONJS GIZMO IMPLEMENTATION NOTES:
 * -------------------------------------
 * Custom gizmos (move/resize handles) have several gotchas:
 *
 * 1. Mesh Merging: Don't use MergeMeshes for compound objects (double rendering).
 *    Instead use parent-child relationships or TransformNode.
 *
 * 2. Empty Meshes: Use TransformNode (not Mesh) for transform-only parents.
 *    Empty Mesh still renders and can be picked.
 *
 * 3. Pointer Events: ActionManager OnPickDownTrigger doesn't have reliable
 *    pointerX/Y. Use scene.pointerX and scene.pointerY instead.
 *
 * 4. Camera Conflicts: Detach camera controls during gizmo drag:
 *      this._camera.detachControl();  // on drag start
 *      this._camera.attachControl();  // on drag end
 *
 * 5. Drag Tracking: Use scene.onPointerObservable for move/up events during drag,
 *    not ActionManager (which only handles mesh-specific events).
 *
 * 6. Child Picking: Add ActionManager to EACH child mesh, not just parent.
 *    Store parent reference in mesh.metadata.
 *
 * ==========================================================================================
 */

/**
 * Editor tool types matching Minecraft Editor conventions.
 * @see https://learn.microsoft.com/en-us/minecraft/creator/documents/bedrockeditor/
 */
export enum EditorTool {
  /** Selection tool for selecting blocks and regions */
  Selection = 0,
  /** Brush tool for painting blocks */
  Brush = 1,
  /** Pencil tool for placing/removing single blocks */
  Pencil = 2,
  /** Block Inspector tool for viewing and modifying block properties */
  BlockInspector = 3,
  /** Help tool for viewing keyboard shortcuts and controls */
  Help = 4,
  /** Properties tool for viewing and resizing structure dimensions */
  Properties = 5,
}

/**
 * Pencil tool edit mode.
 * @see https://learn.microsoft.com/en-us/minecraft/creator/documents/bedrockeditor/editorpenciltool
 */
export enum PencilMode {
  /** Draw mode - places blocks */
  Draw = 0,
  /** Erase mode - removes blocks */
  Erase = 1,
}

/**
 * Pencil block facing/orientation options.
 * @see https://learn.microsoft.com/en-us/minecraft/creator/documents/bedrockeditor/editorpenciltool
 */
export enum PencilBlockFacing {
  /** Block rotation based on camera direction */
  ByCamera = 0,
  /** Default block orientation */
  Default = 1,
}

/**
 * Brush shape types matching Minecraft Editor conventions.
 * @see https://learn.microsoft.com/en-us/minecraft/creator/documents/bedrockeditor/editorbrushtool
 */
export enum BrushShape {
  /** Single block brush */
  SingleBlock = 0,
  /** Cuboid/box shaped brush */
  Cuboid = 1,
  /** Ellipsoid/sphere shaped brush */
  Ellipsoid = 2,
  /** Cylinder shaped brush */
  Cylinder = 3,
  /** Cone shaped brush */
  Cone = 4,
  /** Pyramid shaped brush */
  Pyramid = 5,
}

/**
 * Selection mode matching Minecraft Editor conventions.
 * @see https://learn.microsoft.com/en-us/minecraft/creator/documents/bedrockeditor/editorselectiontool
 */
export enum SelectionMode {
  /** Marquee creates a selection area by choosing X, Y, Z coordinates */
  Marquee = 0,
  /** Single block selection - click to select individual blocks */
  SingleBlock = 1,
}

/**
 * Cursor input mode for selection.
 * @see https://learn.microsoft.com/en-us/minecraft/creator/documents/bedrockeditor/editorselectiontool#input-modes
 */
export enum CursorInputMode {
  /** Uses mouse to select blocks based on cursor location */
  MouseAndKeys = 0,
  /** Uses keyboard only - arrow keys move cursor */
  KeyboardOnly = 1,
  /** Fixed distance from camera center */
  FixedDistance = 2,
}

/**
 * Cursor target mode - what gets selected when clicking.
 * @see https://learn.microsoft.com/en-us/minecraft/creator/documents/bedrockeditor/editorselectiontool#target
 */
export enum CursorTarget {
  /** Selects the block you highlight with the cursor */
  Block = 0,
  /** Selects the air adjacent to solid blocks */
  Adjacent = 1,
}

/**
 * Selection bounds representing the current selection volume.
 */
export interface ISelectionBounds {
  fromX: number;
  fromY: number;
  fromZ: number;
  toX: number;
  toY: number;
  toZ: number;
}

/**
 * Metadata stored on block meshes to avoid fragile name-based coordinate parsing.
 * This provides a robust way to identify block positions and properties.
 */
export interface IBlockMeshMetadata {
  /** Block data X coordinate (in structure space) */
  blockX: number;
  /** Block data Y coordinate (in structure space) */
  blockY: number;
  /** Block data Z coordinate (in structure space) */
  blockZ: number;
  /** Whether this is a solid block (true) or air placeholder (false) */
  isSolid: boolean;
  /** Block type identifier (e.g., "minecraft:stone") */
  blockType?: string;
}

interface IVolumeEditorProps {
  blockVolume?: BlockVolume;
  viewBounds?: IBlockVolumeBounds;
  entities?: Entity[];
  viewMode: VolumeEditorViewMode;
  height?: number;
  heightOffset?: number;
  xCoordOffset?: number;
  yCoordOffset?: number;
  zCoordOffset?: number;
  onSelectedBlocksChanged?: (newSelectedBlocks: Block[] | undefined) => void;
  onClicked?: () => void;
  onApplyRequested?: () => void;
  onFillRequested?: (bounds: ISelectionBounds) => void;
  onDeleteRequested?: (bounds: ISelectionBounds) => void;
  onResizeRequested?: (newX: number, newY: number, newZ: number) => void;
  skipVanillaResources?: boolean; // Skip loading vanilla terrain textures (for headless model rendering)
  showToolbar?: boolean; // Whether to show the selection toolbar (default: true in Structure mode)
  showRightPanel?: boolean; // Whether to show the right selection panel (default: true in Structure mode)
  hideChrome?: boolean; // Hide all UI overlays (for headless rendering screenshots)
  toolbarPortalTarget?: HTMLElement | null; // When set, render toolbar items into this element via portal

  // Camera position override for multi-angle rendering
  cameraX?: number;
  cameraY?: number;
  cameraZ?: number;
}

interface IVolumeEditorState {
  terrainTextureDefinition: TerrainTextureCatalogDefinition | undefined;
  blocksDefinition: BlocksCatalogDefinition | undefined;
  showHelp: boolean;
  hoverX: number | undefined;
  hoverY: number | undefined;
  hoverZ: number | undefined;
  hoverBlockType: string | undefined;
  // Whether hovering over a solid block (true) vs placeholder/air (false)
  hoverIsSolidBlock: boolean;
  // Face normal offset for Adjacent mode (captured during hover)
  hoverFaceOffsetX: number;
  hoverFaceOffsetY: number;
  hoverFaceOffsetZ: number;
  // Computed pencil target position (calculated in _updatePencilPreview, used by _paintPencil)
  pencilTargetX: number | undefined;
  pencilTargetY: number | undefined;
  pencilTargetZ: number | undefined;

  // Active tool
  activeTool: EditorTool;
  panelCollapsed: boolean;

  // Selection tool state (matching Minecraft Editor)
  selectionMode: SelectionMode;
  cursorInputMode: CursorInputMode;
  cursorTarget: CursorTarget;

  // Selection bounds (for marquee/box selection)
  selectionBounds: ISelectionBounds | undefined;

  // Marquee selection state: which coordinate are we setting?
  marqueeStep: "none" | "x" | "z" | "y";
  marqueeFirstClick: { x: number; y: number; z: number } | undefined;
  marqueeSecondClick: { x: number; y: number; z: number } | undefined;

  // Brush tool state (matching Minecraft Editor)
  brushShape: BrushShape;
  brushSizeX: number;
  brushSizeY: number;
  brushSizeZ: number;
  brushUniform: boolean;

  // Pencil tool state (matching Minecraft Editor)
  // @see https://learn.microsoft.com/en-us/minecraft/creator/documents/bedrockeditor/editorpenciltool
  pencilMode: PencilMode;
  pencilBlockFacing: PencilBlockFacing;
  pencilBlockType: string;
  pencilOffsetX: number;
  pencilOffsetY: number;
  pencilOffsetZ: number;
  pencilCursorTarget: CursorTarget;
  brushBlockType: string;
  brushTarget: CursorTarget;

  // Block Inspector tool state
  // @see https://learn.microsoft.com/en-us/minecraft/creator/documents/bedrockeditor/editorblockinspector
  inspectedBlockX: number | undefined;
  inspectedBlockY: number | undefined;
  inspectedBlockZ: number | undefined;
  inspectedBlockType: string | undefined;
  inspectedBlockProperties: { [key: string]: string | number | boolean } | undefined;

  // Undo/Redo state
  canUndo: boolean;
  canRedo: boolean;

  // Loading error state
  loadError: string | undefined;
}

export enum VolumeEditorViewMode {
  Structure = 0,
  SingleBlock = 1,
  ModelPreview = 2,
}

const REPEAT_KEYBOARD_EVENT_DELAY = 50;

export default class VolumeEditor extends Component<IVolumeEditorProps, IVolumeEditorState> {
  _canvasOuterDiv: HTMLDivElement | null = null;
  _canvas: HTMLCanvasElement | null = null;
  _lastBlockCube?: BlockVolume;
  _lastBlockCubeMaxX?: number;
  _lastBlockCubeMaxY?: number;
  _lastBlockCubeMaxZ?: number;
  _lastViewBounds?: IBlockVolumeBounds;
  _lastCameraX?: number;
  _lastCameraY?: number;
  _lastCameraZ?: number;

  private _blockMeshFactory?: BlockMeshFactory;
  private _modelMeshFactory?: ModelMeshFactory;
  private _engine: BABYLON.Engine | null = null;
  private _scene: BABYLON.Scene | null = null;
  private _camera: BABYLON.FreeCamera | null = null;
  private _meshes: { [id: string]: BABYLON.Mesh | undefined } = {};
  private _selectionPlaceholderMesh: BABYLON.Mesh | undefined;
  private _uiTexture: GUI.AdvancedDynamicTexture | undefined;
  private _blockMeshes: Map<string, BABYLON.AbstractMesh | undefined> = new Map();
  private _entityMeshes: Map<string, BABYLON.AbstractMesh | undefined> = new Map();
  private _coordinatesText: GUI.TextBlock | undefined;
  private _axisIndicator: GUI.TextBlock | undefined;
  private _hoverBlock: BABYLON.Mesh | undefined;

  // Selection box visualization mesh (for marquee selection)
  private _selectionBoxMesh: BABYLON.Mesh | undefined;
  private _selectionBoxMaterial: BABYLON.StandardMaterial | undefined;

  // Hover indicator mesh - a separate wireframe box that moves to hovered block position
  // This avoids applying edge rendering to block meshes which could interfere with picking
  private _hoverIndicatorMesh: BABYLON.Mesh | undefined;

  // Gizmo system for selection manipulation
  private _moveGizmoMesh: BABYLON.Mesh | undefined;
  private _moveGizmoArrows: BABYLON.Mesh[] = [];
  private _resizeGizmoCorners: BABYLON.Mesh[] = [];
  private _resizeGizmoArrows: BABYLON.Mesh[] = [];
  private _allGizmoMeshes: BABYLON.Mesh[] = []; // All pickable gizmo meshes for easy lookup
  private _activeGizmo: "none" | "move" | "resize" = "none";
  private _gizmoAxis: "x" | "y" | "z" | undefined;
  private _gizmoDragStart: BABYLON.Vector3 | undefined;
  private _selectionStartBounds: ISelectionBounds | undefined;
  private _pointerObserver: BABYLON.Nullable<BABYLON.Observer<BABYLON.PointerInfo>> = null;

  // Alt key tracking for marquee Y coordinate selection
  private _isHoldingAltDown = false;
  private _isHoldingCtrlDown = false;
  private _isHoldingShiftDown = false;

  private _dtLastArrow = new Date();

  selectedBlocks: Block[] | undefined;

  private _selectedBlockMeshes: BABYLON.AbstractMesh[] | undefined;

  private _id?: string;
  static count = 0;

  // Pencil target position (synchronously updated, used by _paintPencil)
  private _pencilTargetX: number | undefined;
  private _pencilTargetY: number | undefined;
  private _pencilTargetZ: number | undefined;

  // Undo/Redo manager for tracking and reverting block changes
  private _undoManager: VolumeEditorUndoManager = new VolumeEditorUndoManager();

  // Pluggable tool instances
  private _brushTool: BrushTool = new BrushTool();
  private _pencilTool: PencilTool = new PencilTool();
  private _blockInspectorTool: BlockInspectorTool = new BlockInspectorTool();
  private _helpTool: HelpTool = new HelpTool();
  private _propertiesTool: PropertiesTool = new PropertiesTool();
  private _tools: Map<EditorTool, IVolumeEditorTool> = new Map();

  // Tool context implementation for IVolumeEditorContext
  private _toolContext: IVolumeEditorContext | undefined;

  get effectiveViewBounds() {
    const vb = this.props.viewBounds;

    if (vb !== undefined) {
      return vb;
    }

    if (this.props.blockVolume !== undefined) {
      return {
        fromX: 0,
        fromY: 0,
        fromZ: 0,
        toX: this.props.blockVolume.maxX,
        toY: this.props.blockVolume.maxY,
        toZ: this.props.blockVolume.maxZ,
      };
    }

    return {
      fromX: 0,
      fromY: 0,
      fromZ: 0,
      toX: 0,
      toY: 0,
      toZ: 0,
    };
  }

  get isSelectable() {
    return this.props.viewMode === VolumeEditorViewMode.Structure;
  }

  /**
   * Creates the IVolumeEditorContext that provides services to pluggable tools.
   * This context is passed to tools when they are activated.
   */
  private _getToolContext(): IVolumeEditorContext {
    const self = this;
    return {
      get blockVolume() {
        return self.props.blockVolume;
      },
      get scene() {
        return self._scene;
      },
      get undoManager() {
        return self._undoManager;
      },
      get maxX() {
        return self.props.blockVolume?.maxX ?? 20;
      },
      get maxY() {
        return self.props.blockVolume?.maxY ?? 20;
      },
      get maxZ() {
        return self.props.blockVolume?.maxZ ?? 20;
      },
      updateBlockMesh: (x: number, y: number, z: number) => {
        if (self.props.blockVolume) {
          self._updateBlockMeshDirect(self.props.blockVolume, x, y, z);
        }
      },
      requestPanelUpdate: () => {
        self.forceUpdate();
      },
      isWithinBounds: (x: number, y: number, z: number) => {
        return self._isWithinStructureBounds(x, y, z);
      },
      dataToVisualCoords: (dataX: number, dataY: number, dataZ: number) => {
        const maxX = self.props.blockVolume?.maxX ?? 20;
        return new BABYLON.Vector3(maxX - (dataX + 0.5), dataY + 0.5, dataZ + 0.5);
      },
    };
  }

  constructor(props: IVolumeEditorProps) {
    super(props);

    this.resize = this.resize.bind(this);
    this._setCanvasOuter = this._setCanvasOuter.bind(this);
    this._handleBlockClick = this._handleBlockClick.bind(this);
    this._handleBlockPointerOver = this._handleBlockPointerOver.bind(this);
    this._handleBlockPointerOut = this._handleBlockPointerOut.bind(this);
    this._handleBlockTypeChanged = this._handleBlockTypeChanged.bind(this);
    this._handleKeyDown = this._handleKeyDown.bind(this);
    this._handleKeyUp = this._handleKeyUp.bind(this);
    this._handleCanvasClick = this._handleCanvasClick.bind(this);

    window.addEventListener("resize", this.resize);
    window.addEventListener("keydown", this._handleKeyDown);
    window.addEventListener("keyup", this._handleKeyUp);

    this._id = "A" + VolumeEditor.count;
    VolumeEditor.count++;

    this._connectToProps();
  }

  /**
   * Keyboard handler following Minecraft Editor keyboard conventions.
   * See: https://learn.microsoft.com/en-us/minecraft/creator/documents/bedrockeditor/editorkeyboardinputs
   *
   * Tool Switching:
   *   S - Selection Tool
   *   B - Brush Tool (Ctrl+B in Minecraft Editor)
   *
   * Viewport (Camera) Controls:
   *   W/S - Move Forward/Back
   *   A/D - Strafe Left/Right
   *   E - Move Up
   *   Q - Move Down
   *   G - Fly to Cursor (grapple teleport to hovered block)
   *   Mouse wheel - Zoom
   *   Right-click + drag - Rotate camera
   *
   * Selection Controls:
   *   Arrow keys - Move Cursor (selection point)
   *   PageUp/PageDown - Move Cursor Up/Down
   *   Ctrl+D - Deselect
   *   Delete - Delete Selection Contents
   *   Space - Apply action to selection
   *
   * Brush Controls:
   *   Enter - Paint at cursor
   *
   * Note: Shift+Arrow, Ctrl+Arrow, Alt+Arrow for grow/shrink/move selection
   * are documented but not yet fully implemented in this viewer.
   */
  _handleKeyDown(event: KeyboardEvent) {
    const now = new Date();

    if (this.props.viewMode === VolumeEditorViewMode.SingleBlock) {
      return;
    }

    // Handle Ctrl+D for Deselect (Minecraft Editor convention)
    if (event.ctrlKey && (event.key === "d" || event.key === "D")) {
      event.preventDefault();
      this._deselectAll();
      return;
    }

    // Handle Ctrl+Z for Undo
    if (event.ctrlKey && !event.shiftKey && (event.key === "z" || event.key === "Z")) {
      event.preventDefault();
      this._handleUndo();
      return;
    }

    // Handle Ctrl+Y or Ctrl+Shift+Z for Redo
    if (
      (event.ctrlKey && (event.key === "y" || event.key === "Y")) ||
      (event.ctrlKey && event.shiftKey && (event.key === "z" || event.key === "Z"))
    ) {
      event.preventDefault();
      this._handleRedo();
      return;
    }

    // Handle G for "Fly to Cursor" - teleport camera to hovered block (Minecraft Editor convention)
    if ((event.key === "g" || event.key === "G") && !event.ctrlKey && !event.altKey) {
      // Only activate if not in a text input
      const activeElement = document.activeElement;
      if (activeElement && (activeElement.tagName === "INPUT" || activeElement.tagName === "TEXTAREA")) {
        return;
      }
      event.preventDefault();
      this._flyToCursor();
      return;
    }

    // Handle S for Selection Tool
    if ((event.key === "s" || event.key === "S") && !event.ctrlKey && !event.altKey && !event.shiftKey) {
      // Only switch tool if not in a text input
      const activeElement = document.activeElement;
      if (activeElement && (activeElement.tagName === "INPUT" || activeElement.tagName === "TEXTAREA")) {
        return;
      }
      this._handleToolChange(EditorTool.Selection);
      return;
    }

    // Handle B for Brush Tool (Ctrl+B in Minecraft Editor)
    if ((event.key === "b" || event.key === "B") && !event.altKey && !event.shiftKey) {
      // Only switch tool if not in a text input
      const activeElement = document.activeElement;
      if (activeElement && (activeElement.tagName === "INPUT" || activeElement.tagName === "TEXTAREA")) {
        return;
      }
      event.preventDefault();
      this._handleToolChange(EditorTool.Brush);
      return;
    }

    // Handle P for Pencil Tool
    // @see https://learn.microsoft.com/en-us/minecraft/creator/documents/bedrockeditor/editorpenciltool
    if ((event.key === "p" || event.key === "P") && !event.ctrlKey && !event.altKey && !event.shiftKey) {
      // Only switch tool if not in a text input
      const activeElement = document.activeElement;
      if (activeElement && (activeElement.tagName === "INPUT" || activeElement.tagName === "TEXTAREA")) {
        return;
      }
      event.preventDefault();
      this._handleToolChange(EditorTool.Pencil);
      return;
    }

    // Handle I for Block Inspector Tool
    // @see https://learn.microsoft.com/en-us/minecraft/creator/documents/bedrockeditor/editorblockinspector
    if ((event.key === "i" || event.key === "I") && !event.ctrlKey && !event.altKey && !event.shiftKey) {
      // Only switch tool if not in a text input
      const activeElement = document.activeElement;
      if (activeElement && (activeElement.tagName === "INPUT" || activeElement.tagName === "TEXTAREA")) {
        return;
      }
      event.preventDefault();
      this._handleToolChange(EditorTool.BlockInspector);
      return;
    }

    // Handle R for Properties Tool
    if ((event.key === "r" || event.key === "R") && !event.ctrlKey && !event.altKey && !event.shiftKey) {
      const activeElement = document.activeElement;
      if (activeElement && (activeElement.tagName === "INPUT" || activeElement.tagName === "TEXTAREA")) {
        return;
      }
      event.preventDefault();
      this._handleToolChange(EditorTool.Properties);
      return;
    }

    // Handle Enter for Paint (Brush tool)
    if (event.key === "Enter" && this.state?.activeTool === EditorTool.Brush) {
      event.preventDefault();
      this._paintBrush();
      return;
    }

    // Handle Space for Toggle Pencil paint, Enter for single-press paint (Pencil tool)
    // @see https://learn.microsoft.com/en-us/minecraft/creator/documents/bedrockeditor/editorpenciltool#keyboard-shortcuts
    if (this.state?.activeTool === EditorTool.Pencil) {
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        this._paintPencil();
        return;
      }
    }

    // Handle selection manipulation shortcuts (Minecraft Editor conventions)
    // These work when we have a marquee selection (selectionBounds)
    if (this.state?.selectionBounds) {
      // Shift + Arrow keys: Grow Selection
      if (event.shiftKey && !event.ctrlKey && !event.altKey) {
        switch (event.key) {
          case "ArrowLeft":
            event.preventDefault();
            this._growSelection("x-");
            return;
          case "ArrowRight":
            event.preventDefault();
            this._growSelection("x+");
            return;
          case "ArrowUp":
            event.preventDefault();
            this._growSelection("z-");
            return;
          case "ArrowDown":
            event.preventDefault();
            this._growSelection("z+");
            return;
          case "PageUp":
            event.preventDefault();
            this._growSelection("y+");
            return;
          case "PageDown":
            event.preventDefault();
            this._growSelection("y-");
            return;
        }
      }

      // Ctrl + Arrow keys: Shrink Selection
      if (event.ctrlKey && !event.shiftKey && !event.altKey) {
        switch (event.key) {
          case "ArrowLeft":
            event.preventDefault();
            this._shrinkSelection("x-");
            return;
          case "ArrowRight":
            event.preventDefault();
            this._shrinkSelection("x+");
            return;
          case "ArrowUp":
            event.preventDefault();
            this._shrinkSelection("z-");
            return;
          case "ArrowDown":
            event.preventDefault();
            this._shrinkSelection("z+");
            return;
          case "PageUp":
            event.preventDefault();
            this._shrinkSelection("y+");
            return;
          case "PageDown":
            event.preventDefault();
            this._shrinkSelection("y-");
            return;
        }
      }

      // Alt + Arrow keys: Move Selection
      if (event.altKey && !event.ctrlKey && !event.shiftKey) {
        switch (event.key) {
          case "ArrowLeft":
            event.preventDefault();
            this._moveSelection("x-");
            return;
          case "ArrowRight":
            event.preventDefault();
            this._moveSelection("x+");
            return;
          case "ArrowUp":
            event.preventDefault();
            this._moveSelection("z-");
            return;
          case "ArrowDown":
            event.preventDefault();
            this._moveSelection("z+");
            return;
          case "PageUp":
            event.preventDefault();
            this._moveSelection("y+");
            return;
          case "PageDown":
            event.preventDefault();
            this._moveSelection("y-");
            return;
        }
      }
    }

    if (now.getTime() - this._dtLastArrow.getTime() > REPEAT_KEYBOARD_EVENT_DELAY && this.isSelectable) {
      this._dtLastArrow = now;

      switch (event.key) {
        case " ":
          // Space - Apply action to selection
          if (this.selectedBlocks !== undefined && this.selectedBlocks !== null && this.selectedBlocks.length > 0) {
            if (this.props.onApplyRequested !== undefined) {
              this.props.onApplyRequested();
            }
          }
          break;

        case "PageUp":
          // Move Cursor Up (Minecraft Editor: PgUp)
          this._forceSelection();

          if (this.selectedBlocks !== undefined && this.selectedBlocks !== null && this.selectedBlocks.length > 0) {
            const nextBlock = this.selectedBlocks[0].up;

            if (nextBlock !== undefined) {
              const mesh = this._getMeshForBlock(nextBlock);

              if (mesh !== null && mesh !== undefined) {
                this._singleSelectMesh(mesh);
              }
            }
          }
          break;

        case "PageDown":
          // Move Cursor Down (Minecraft Editor: PgDn)
          this._forceSelection();

          if (this.selectedBlocks !== undefined && this.selectedBlocks !== null && this.selectedBlocks.length > 0) {
            const nextBlock = this.selectedBlocks[0].down;

            if (nextBlock !== undefined) {
              const mesh = this._getMeshForBlock(nextBlock);

              if (mesh !== null && mesh !== undefined) {
                this._singleSelectMesh(mesh);
              }
            }
          }
          break;

        case "ArrowLeft":
          // Move Cursor Left (Minecraft Editor: Left Arrow)
          this._forceSelection();

          if (this.selectedBlocks !== undefined && this.selectedBlocks !== null && this.selectedBlocks.length > 0) {
            const nextBlock = this.selectedBlocks[0].left;

            if (nextBlock !== undefined) {
              const mesh = this._getMeshForBlock(nextBlock);

              if (mesh !== null && mesh !== undefined) {
                this._singleSelectMesh(mesh);
              }
            }
          }
          break;

        case "ArrowRight":
          // Move Cursor Right (Minecraft Editor: Right Arrow)
          this._forceSelection();

          if (this.selectedBlocks !== undefined && this.selectedBlocks !== null && this.selectedBlocks.length > 0) {
            const nextBlock = this.selectedBlocks[0].right;

            if (nextBlock !== undefined) {
              const mesh = this._getMeshForBlock(nextBlock);

              if (mesh !== null && mesh !== undefined) {
                this._singleSelectMesh(mesh);
              }
            }
          }

          break;

        case "ArrowUp":
          // Move Cursor Forward (Minecraft Editor: Up Arrow)
          this._forceSelection();

          if (this.selectedBlocks !== undefined && this.selectedBlocks !== null && this.selectedBlocks.length > 0) {
            const nextBlock = this.selectedBlocks[0].forward;

            if (nextBlock !== undefined) {
              const mesh = this._getMeshForBlock(nextBlock);

              if (mesh !== null && mesh !== undefined) {
                this._singleSelectMesh(mesh);
              }
            }
          }

          break;

        case "ArrowDown":
          // Move Cursor Back (Minecraft Editor: Down Arrow)
          this._forceSelection();

          if (this.selectedBlocks !== undefined && this.selectedBlocks !== null && this.selectedBlocks.length > 0) {
            const nextBlock = this.selectedBlocks[0].backward;

            if (nextBlock !== undefined) {
              const mesh = this._getMeshForBlock(nextBlock);

              if (mesh !== null && mesh !== undefined) {
                this._singleSelectMesh(mesh);
              }
            }
          }

          break;
      }
    }

    this._isHoldingCtrlDown = event.ctrlKey;
    this._isHoldingShiftDown = event.shiftKey;
    this._isHoldingAltDown = event.altKey;
  }

  /**
   * Deselect all currently selected blocks (Ctrl+D in Minecraft Editor).
   * Clears both individual block selections and marquee selection bounds.
   */
  _deselectAll() {
    if (this._selectedBlockMeshes !== undefined) {
      for (let i = 0; i < this._selectedBlockMeshes.length; i++) {
        this._setBoundingBox(this._selectedBlockMeshes[i], false);
      }
    }

    this._selectedBlockMeshes = undefined;
    this.selectedBlocks = undefined;

    // Also clear marquee selection state
    this._clearSelectionBox();
    this.setState({
      selectionBounds: undefined,
      marqueeStep: "none",
      marqueeFirstClick: undefined,
      marqueeSecondClick: undefined,
    });

    if (this.props.onSelectedBlocksChanged !== undefined) {
      this.props.onSelectedBlocksChanged(this.selectedBlocks);
    }
  }

  /**
   * Undo the most recent volume editing action (Ctrl+Z).
   * Restores blocks to their state before the action was performed.
   */
  _handleUndo() {
    if (!this.props.blockVolume) {
      return;
    }

    const success = this._undoManager.undo(this.props.blockVolume, (x, y, z) => {
      this._updateBlockMeshDirect(this.props.blockVolume!, x, y, z);
    });

    if (!success) {
      // Could show a message that there's nothing to undo
    }
  }

  /**
   * Redo the most recently undone action (Ctrl+Y or Ctrl+Shift+Z).
   * Re-applies the action that was previously undone.
   */
  _handleRedo() {
    if (!this.props.blockVolume) {
      return;
    }

    const success = this._undoManager.redo(this.props.blockVolume, (x, y, z) => {
      this._updateBlockMeshDirect(this.props.blockVolume!, x, y, z);
    });

    if (!success) {
      // Could show a message that there's nothing to redo
    }
  }

  /**
   * Fly camera to the currently hovered cursor position (G key in Minecraft Editor).
   * This is the "grapple teleport" feature that moves the camera to where you're pointing.
   */
  _flyToCursor() {
    if (this._camera === null) {
      return;
    }

    // If we have a hovered block, fly to it
    if (this._hoverBlock !== undefined) {
      const targetPosition = this._hoverBlock.position.clone();
      // Position camera slightly above and back from the target
      targetPosition.y += 3;

      // Smoothly animate camera to the new position
      BABYLON.Animation.CreateAndStartAnimation(
        "flyToCursor",
        this._camera,
        "position",
        60, // frames per second
        30, // total frames (0.5 second animation)
        this._camera.position,
        targetPosition,
        BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
      );
    } else if (this.selectedBlocks !== undefined && this.selectedBlocks.length > 0) {
      // If no hover block but we have a selection, fly to the first selected block
      const selectedBlock = this.selectedBlocks[0];
      if (selectedBlock.x !== undefined && selectedBlock.y !== undefined && selectedBlock.z !== undefined) {
        const targetPosition = new BABYLON.Vector3(selectedBlock.x + 0.5, selectedBlock.y + 3.5, selectedBlock.z + 0.5);

        BABYLON.Animation.CreateAndStartAnimation(
          "flyToCursor",
          this._camera,
          "position",
          60,
          30,
          this._camera.position,
          targetPosition,
          BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
        );
      }
    }
  }

  /**
   * Creates or updates the selection box mesh for marquee selection visualization.
   * The box shows the current selection bounds with yellow dashed edges (matching Minecraft Editor).
   */
  _updateSelectionBox(bounds: ISelectionBounds) {
    if (this._scene === null || this.props.blockVolume === undefined) {
      return;
    }

    const maxX = this.props.blockVolume.maxX;

    // Calculate box dimensions
    const width = bounds.toX - bounds.fromX + 1;
    const height = bounds.toY - bounds.fromY + 1;
    const depth = bounds.toZ - bounds.fromZ + 1;

    // Calculate center position (accounting for the flipped X coordinate system)
    const centerX = maxX - (bounds.fromX + width / 2);
    const centerY = bounds.fromY + height / 2;
    const centerZ = bounds.fromZ + depth / 2;

    // Create or update the selection box mesh
    if (this._selectionBoxMesh) {
      this._scene.removeMesh(this._selectionBoxMesh);
      this._selectionBoxMesh.dispose();
    }

    this._selectionBoxMesh = BABYLON.MeshBuilder.CreateBox("selectionBox", { width, height, depth }, this._scene);

    // Create the material if it doesn't exist - semi-transparent with no fill color
    if (!this._selectionBoxMaterial) {
      this._selectionBoxMaterial = new BABYLON.StandardMaterial("selectionBoxMat", this._scene);
      this._selectionBoxMaterial.diffuseColor = new BABYLON.Color3(1, 0.85, 0); // Yellow tint
      this._selectionBoxMaterial.alpha = 0.08; // Very subtle fill
      this._selectionBoxMaterial.backFaceCulling = false;
    }

    this._selectionBoxMesh.material = this._selectionBoxMaterial;
    this._selectionBoxMesh.position = new BABYLON.Vector3(centerX, centerY, centerZ);
    this._selectionBoxMesh.isPickable = false;
    this._selectionBoxMesh.renderingGroupId = 2; // Render on top

    // Add yellow edges for visibility (matching Minecraft Editor style)
    this._selectionBoxMesh.enableEdgesRendering();
    this._selectionBoxMesh.edgesWidth = 4.0;
    this._selectionBoxMesh.edgesColor = new BABYLON.Color4(1, 0.85, 0, 1); // Bright yellow edges

    // Update gizmos
    this._updateGizmos(bounds);
  }

  /**
   * Clears the selection box mesh.
   */
  _clearSelectionBox() {
    if (this._selectionBoxMesh && this._scene) {
      this._scene.removeMesh(this._selectionBoxMesh);
      this._selectionBoxMesh.dispose();
      this._selectionBoxMesh = undefined;
    }
    this._clearGizmos();
  }

  /**
   * Creates gizmo arrow meshes for a given axis.
   * Returns an array of meshes (shaft and head) for the arrow.
   * Uses simple approach: create meshes, position them in world space, no parenting.
   */
  _createGizmoArrow(
    name: string,
    axis: "x" | "y" | "z",
    position: BABYLON.Vector3,
    length: number = 1.5,
    isMove: boolean = true
  ): BABYLON.Mesh[] {
    if (!this._scene) {
      throw new Error("Scene not initialized");
    }

    // Arrow colors: X=Red, Y=Green, Z=Blue (standard RGB axes)
    const colors: Record<string, BABYLON.Color3> = {
      x: new BABYLON.Color3(0.9, 0.2, 0.2), // Red
      y: new BABYLON.Color3(0.2, 0.9, 0.2), // Green
      z: new BABYLON.Color3(0.2, 0.4, 0.9), // Blue
    };

    const shaftLength = length * 0.7;
    const headLength = length * 0.3;
    const gizmoType = isMove ? "move" : "resize";

    // Create shared material
    const mat = new BABYLON.StandardMaterial(`${name}_mat`, this._scene);
    mat.diffuseColor = colors[axis];
    mat.emissiveColor = colors[axis].scale(0.3);
    mat.specularColor = new BABYLON.Color3(0.5, 0.5, 0.5);

    // Calculate world positions based on axis
    const boxEdgeOffset = 0.25;
    let shaftPos: BABYLON.Vector3;
    let headPos: BABYLON.Vector3;
    let rotation: BABYLON.Vector3;

    if (axis === "x") {
      // Arrow points in +X direction
      const startX = position.x + boxEdgeOffset;
      shaftPos = new BABYLON.Vector3(startX + shaftLength / 2, position.y, position.z);
      headPos = new BABYLON.Vector3(startX + shaftLength + headLength / 2, position.y, position.z);
      rotation = new BABYLON.Vector3(0, 0, -Math.PI / 2);
    } else if (axis === "z") {
      // Arrow points in +Z direction
      const startZ = position.z + boxEdgeOffset;
      shaftPos = new BABYLON.Vector3(position.x, position.y, startZ + shaftLength / 2);
      headPos = new BABYLON.Vector3(position.x, position.y, startZ + shaftLength + headLength / 2);
      rotation = new BABYLON.Vector3(Math.PI / 2, 0, 0);
    } else {
      // Y axis - arrow points in +Y direction (default)
      const startY = position.y + boxEdgeOffset;
      shaftPos = new BABYLON.Vector3(position.x, startY + shaftLength / 2, position.z);
      headPos = new BABYLON.Vector3(position.x, startY + shaftLength + headLength / 2, position.z);
      rotation = new BABYLON.Vector3(0, 0, 0);
    }

    // Create arrow shaft - thicker for easier clicking
    const shaft = BABYLON.MeshBuilder.CreateCylinder(
      `${name}_shaft`,
      { height: shaftLength, diameter: 0.18, tessellation: 12 },
      this._scene
    );
    shaft.position = shaftPos;
    shaft.rotation = rotation;
    shaft.material = mat;
    shaft.isPickable = true;
    shaft.renderingGroupId = 2;
    shaft.metadata = { axis, isMove, gizmoType, arrowName: name };

    // Create arrow head (cone) - larger for easier clicking
    const head = BABYLON.MeshBuilder.CreateCylinder(
      `${name}_head`,
      { height: headLength, diameterTop: 0, diameterBottom: 0.4, tessellation: 12 },
      this._scene
    );
    head.position = headPos;
    head.rotation = rotation;
    head.material = mat;
    head.isPickable = true;
    head.renderingGroupId = 2;
    head.metadata = { axis, isMove, gizmoType, arrowName: name };

    // Track all gizmo meshes for interaction
    this._allGizmoMeshes.push(shaft, head);

    return [shaft, head];
  }

  /**
   * Creates the move gizmo at the center of the selection.
   * A small white box with RGB arrows for moving the selection.
   */
  _createMoveGizmo(centerX: number, centerY: number, centerZ: number) {
    if (!this._scene) return;

    // Create center box (white handle)
    this._moveGizmoMesh = BABYLON.MeshBuilder.CreateBox("moveGizmoCenter", { size: 0.4 }, this._scene);

    const centerMat = new BABYLON.StandardMaterial("moveGizmoCenterMat", this._scene);
    centerMat.diffuseColor = new BABYLON.Color3(1, 1, 1);
    centerMat.emissiveColor = new BABYLON.Color3(0.3, 0.3, 0.3);
    this._moveGizmoMesh.material = centerMat;
    this._moveGizmoMesh.position = new BABYLON.Vector3(centerX, centerY, centerZ);
    this._moveGizmoMesh.isPickable = true;
    this._moveGizmoMesh.renderingGroupId = 2;
    this._moveGizmoMesh.metadata = { gizmoType: "moveCenter" };
    this._allGizmoMeshes.push(this._moveGizmoMesh);

    // Create RGB arrows from center
    const center = new BABYLON.Vector3(centerX, centerY, centerZ);

    const xArrowMeshes = this._createGizmoArrow("moveArrowX", "x", center, 1.2, true);
    const yArrowMeshes = this._createGizmoArrow("moveArrowY", "y", center, 1.2, true);
    const zArrowMeshes = this._createGizmoArrow("moveArrowZ", "z", center, 1.2, true);

    this._moveGizmoArrows = [...xArrowMeshes, ...yArrowMeshes, ...zArrowMeshes];
  }

  /**
   * Creates resize gizmo handles at corners - small cubes only, no arrows.
   * The corners can be dragged to resize the selection.
   */
  _createResizeGizmos(
    fromX: number,
    fromY: number,
    fromZ: number,
    toX: number,
    toY: number,
    toZ: number,
    maxBlockX: number
  ) {
    if (!this._scene) return;

    // Calculate corner positions in world space (accounting for flipped X)
    // Put resize handles at the max corner (toX, toY, toZ)
    const cornerX = maxBlockX - toX - 0.5;
    const cornerY = toY + 0.5;
    const cornerZ = toZ + 0.5;

    // Create corner handle (small colored cube)
    const corner = BABYLON.MeshBuilder.CreateBox("resizeCorner", { size: 0.25 }, this._scene);
    const cornerMat = new BABYLON.StandardMaterial("resizeCornerMat", this._scene);
    cornerMat.diffuseColor = new BABYLON.Color3(1, 0.8, 0.2); // Orange/yellow for visibility
    cornerMat.emissiveColor = new BABYLON.Color3(0.3, 0.2, 0.05);
    corner.material = cornerMat;
    corner.position = new BABYLON.Vector3(cornerX, cornerY, cornerZ);
    corner.isPickable = true;
    corner.renderingGroupId = 2;
    corner.metadata = { gizmoType: "resizeCorner", arrowName: "resizeCorner" };

    this._resizeGizmoCorners = [corner];
    this._allGizmoMeshes.push(corner);

    // No arrows for resize - just the corner cube to avoid overlapping with move gizmo
    this._resizeGizmoArrows = [];
  }

  /**
   * Sets up the scene pointer observable for gizmo interaction.
   * This handles hover highlighting and drag operations.
   */
  _setupGizmoPointerObservable() {
    if (!this._scene) return;

    // Remove existing observer if any
    if (this._pointerObserver) {
      this._scene.onPointerObservable.remove(this._pointerObserver);
    }

    let hoveredMesh: BABYLON.AbstractMesh | null = null;

    // Predicate to only pick gizmo meshes
    const gizmoPredicate = (mesh: BABYLON.AbstractMesh) => {
      return this._allGizmoMeshes.includes(mesh as BABYLON.Mesh);
    };

    this._pointerObserver = this._scene.onPointerObservable.add((pointerInfo) => {
      switch (pointerInfo.type) {
        case BABYLON.PointerEventTypes.POINTERMOVE: {
          // Handle drag if active
          if (this._activeGizmo !== "none" && this._gizmoDragStart && this._selectionStartBounds && this._gizmoAxis) {
            this._handleGizmoDragMove(pointerInfo.event as PointerEvent);
          } else {
            // Update pencil preview on pointer move (for face-adjacent detection)
            if (this.state?.activeTool === EditorTool.Pencil) {
              this._updatePencilPreview();
            }

            // Handle hover highlighting - use gizmo predicate to prioritize gizmos
            const pickResult = this._scene?.pick(this._scene.pointerX, this._scene.pointerY, gizmoPredicate);
            if (pickResult?.hit && pickResult.pickedMesh) {
              const mesh = pickResult.pickedMesh;
              if (this._allGizmoMeshes.includes(mesh as BABYLON.Mesh)) {
                // Hovering over a gizmo mesh
                if (hoveredMesh !== mesh) {
                  // Un-highlight previous
                  if (hoveredMesh) {
                    this._setGizmoHighlight(hoveredMesh, false);
                  }
                  hoveredMesh = mesh;
                  this._setGizmoHighlight(mesh, true);
                  if (this._canvas) {
                    this._canvas.style.cursor = "pointer";
                  }
                }
              } else if (hoveredMesh) {
                // Not hovering over gizmo anymore
                this._setGizmoHighlight(hoveredMesh, false);
                hoveredMesh = null;
                if (this._canvas) {
                  this._canvas.style.cursor = "default";
                }
              }
            } else if (hoveredMesh) {
              this._setGizmoHighlight(hoveredMesh, false);
              hoveredMesh = null;
              if (this._canvas) {
                this._canvas.style.cursor = "default";
              }
            }
          }
          break;
        }
        case BABYLON.PointerEventTypes.POINTERDOWN: {
          // Use gizmo predicate to prioritize gizmo picks over other meshes
          const pickResult = this._scene?.pick(this._scene.pointerX, this._scene.pointerY, gizmoPredicate);
          if (pickResult?.hit && pickResult.pickedMesh) {
            const mesh = pickResult.pickedMesh;
            // Since we used gizmoPredicate, the mesh IS a gizmo
            const metadata = mesh.metadata;
            if (metadata) {
              this._activeGizmo =
                metadata.isMove === false ? "resize" : metadata.gizmoType === "resizeCorner" ? "resize" : "move";
              this._gizmoAxis = metadata.axis;
              this._gizmoDragStart = new BABYLON.Vector3(this._scene!.pointerX, this._scene!.pointerY, 0);
              this._selectionStartBounds = this.state?.selectionBounds ? { ...this.state.selectionBounds } : undefined;

              // Detach camera to prevent it from stealing input
              if (this._camera && this._canvas) {
                this._camera.detachControl();
              }
            }
          }
          break;
        }
        case BABYLON.PointerEventTypes.POINTERUP: {
          if (this._activeGizmo !== "none") {
            // End drag
            if (this._camera && this._canvas) {
              this._camera.attachControl(this._canvas, true);
            }
            this._activeGizmo = "none";
            this._gizmoAxis = undefined;
            this._gizmoDragStart = undefined;
            this._selectionStartBounds = undefined;
          }
          break;
        }
      }
    });
  }

  /**
   * Highlights or un-highlights a gizmo mesh and its siblings (same arrow).
   */
  _setGizmoHighlight(mesh: BABYLON.AbstractMesh, highlight: boolean) {
    const arrowName = mesh.metadata?.arrowName;
    const emissiveScale = highlight ? 0.6 : 0.3;

    // Find all meshes with the same arrowName and highlight them together
    this._allGizmoMeshes.forEach((m) => {
      if (m.metadata?.arrowName === arrowName || m === mesh) {
        if (m.material && m.material instanceof BABYLON.StandardMaterial) {
          m.material.emissiveColor = m.material.diffuseColor.scale(emissiveScale);
        }
      }
    });
  }

  /**
   * Handles mouse movement during gizmo drag.
   */
  _handleGizmoDragMove(event: PointerEvent) {
    if (!this._gizmoDragStart || !this._selectionStartBounds || !this._gizmoAxis) {
      return;
    }

    const currentX = this._scene?.pointerX ?? event.clientX;
    const currentY = this._scene?.pointerY ?? event.clientY;
    const deltaX = currentX - this._gizmoDragStart.x;
    const deltaY = currentY - this._gizmoDragStart.y;

    // Convert screen delta to world units
    // Different sensitivities per axis to feel natural given the camera angle
    let blockDelta = 0;
    if (this._gizmoAxis === "x") {
      // X arrow - less sensitive (more pixels needed per block)
      const pixelsPerBlock = 40;
      blockDelta = Math.round(deltaX / pixelsPerBlock);
    } else if (this._gizmoAxis === "y") {
      // Y arrow points up, so dragging up (negative deltaY) = +Y
      const pixelsPerBlock = 35;
      blockDelta = Math.round(-deltaY / pixelsPerBlock);
    } else if (this._gizmoAxis === "z") {
      // Z arrow - flip direction to match visual
      const pixelsPerBlock = 10;
      blockDelta = Math.round(deltaX / pixelsPerBlock);
    }

    if (blockDelta === 0) {
      return;
    }

    const vb = this.effectiveViewBounds;
    const newBounds = { ...this._selectionStartBounds };

    if (this._activeGizmo === "resize") {
      if (this._gizmoAxis === "x") {
        newBounds.toX = Math.max(newBounds.fromX, Math.min(this._selectionStartBounds.toX + blockDelta, vb.toX - 1));
      } else if (this._gizmoAxis === "y") {
        newBounds.toY = Math.max(newBounds.fromY, Math.min(this._selectionStartBounds.toY + blockDelta, vb.toY - 1));
      } else if (this._gizmoAxis === "z") {
        newBounds.toZ = Math.max(newBounds.fromZ, Math.min(this._selectionStartBounds.toZ + blockDelta, vb.toZ - 1));
      }
    } else if (this._activeGizmo === "move") {
      const width = this._selectionStartBounds.toX - this._selectionStartBounds.fromX;
      const height = this._selectionStartBounds.toY - this._selectionStartBounds.fromY;
      const depth = this._selectionStartBounds.toZ - this._selectionStartBounds.fromZ;

      if (this._gizmoAxis === "x") {
        newBounds.fromX = Math.max(
          vb.fromX,
          Math.min(this._selectionStartBounds.fromX + blockDelta, vb.toX - 1 - width)
        );
        newBounds.toX = newBounds.fromX + width;
      } else if (this._gizmoAxis === "y") {
        newBounds.fromY = Math.max(
          vb.fromY,
          Math.min(this._selectionStartBounds.fromY + blockDelta, vb.toY - 1 - height)
        );
        newBounds.toY = newBounds.fromY + height;
      } else if (this._gizmoAxis === "z") {
        newBounds.fromZ = Math.max(
          vb.fromZ,
          Math.min(this._selectionStartBounds.fromZ + blockDelta, vb.toZ - 1 - depth)
        );
        newBounds.toZ = newBounds.fromZ + depth;
      }
    }

    // Update if changed
    if (
      newBounds.fromX !== this.state?.selectionBounds?.fromX ||
      newBounds.fromY !== this.state?.selectionBounds?.fromY ||
      newBounds.fromZ !== this.state?.selectionBounds?.fromZ ||
      newBounds.toX !== this.state?.selectionBounds?.toX ||
      newBounds.toY !== this.state?.selectionBounds?.toY ||
      newBounds.toZ !== this.state?.selectionBounds?.toZ
    ) {
      this.setState({ selectionBounds: newBounds });
      this._updateSelectionBox(newBounds);
    }
  }

  /**
   * Clears all gizmo meshes.
   * @param preserveDragState - If true, don't clear the drag-related state (used during drag updates)
   */
  _clearGizmos(preserveDragState: boolean = false) {
    if (this._scene) {
      // Dispose all tracked gizmo meshes
      this._allGizmoMeshes.forEach((mesh) => {
        this._scene?.removeMesh(mesh);
        mesh.dispose();
      });
      this._allGizmoMeshes = [];

      this._moveGizmoMesh = undefined;
      this._moveGizmoArrows = [];
      this._resizeGizmoCorners = [];
      this._resizeGizmoArrows = [];
    }

    // Only clear drag state if not preserving it
    if (!preserveDragState) {
      this._activeGizmo = "none";
      this._gizmoAxis = undefined;
      this._gizmoDragStart = undefined;
      this._selectionStartBounds = undefined;
    }
  }

  /**
   * Updates the gizmos to match the current selection bounds.
   */
  _updateGizmos(bounds: ISelectionBounds) {
    if (!this._scene || !this.props.blockVolume) return;

    // Check if we're currently dragging - preserve that state
    const isDragging = this._activeGizmo !== "none";

    // Clear existing gizmos (but preserve drag state if actively dragging)
    this._clearGizmos(isDragging);

    const maxX = this.props.blockVolume.maxX;

    // Calculate dimensions
    const width = bounds.toX - bounds.fromX + 1;
    const height = bounds.toY - bounds.fromY + 1;
    const depth = bounds.toZ - bounds.fromZ + 1;

    // Calculate center position (accounting for flipped X)
    const centerX = maxX - (bounds.fromX + width / 2);
    const centerY = bounds.fromY + height / 2;
    const centerZ = bounds.fromZ + depth / 2;

    // Create move gizmo at center
    this._createMoveGizmo(centerX, centerY, centerZ);

    // Create resize gizmo at corner
    this._createResizeGizmos(bounds.fromX, bounds.fromY, bounds.fromZ, bounds.toX, bounds.toY, bounds.toZ, maxX);

    // Setup pointer observable for gizmo interaction
    this._setupGizmoPointerObservable();
  }

  /**
   * Grows the selection bounds in a given direction by 1 block.
   * Shift+Arrow in Minecraft Editor.
   */
  _growSelection(direction: "x+" | "x-" | "y+" | "y-" | "z+" | "z-") {
    if (!this.state?.selectionBounds) {
      return;
    }

    const bounds = { ...this.state.selectionBounds };
    const vb = this.effectiveViewBounds;

    switch (direction) {
      case "x+":
        bounds.toX = Math.min(bounds.toX + 1, vb.toX - 1);
        break;
      case "x-":
        bounds.fromX = Math.max(bounds.fromX - 1, vb.fromX);
        break;
      case "y+":
        bounds.toY = Math.min(bounds.toY + 1, vb.toY - 1);
        break;
      case "y-":
        bounds.fromY = Math.max(bounds.fromY - 1, vb.fromY);
        break;
      case "z+":
        bounds.toZ = Math.min(bounds.toZ + 1, vb.toZ - 1);
        break;
      case "z-":
        bounds.fromZ = Math.max(bounds.fromZ - 1, vb.fromZ);
        break;
    }

    this.setState({ selectionBounds: bounds });
    this._updateSelectionBox(bounds);
  }

  /**
   * Shrinks the selection bounds in a given direction by 1 block.
   * Ctrl+Arrow in Minecraft Editor.
   */
  _shrinkSelection(direction: "x+" | "x-" | "y+" | "y-" | "z+" | "z-") {
    if (!this.state?.selectionBounds) {
      return;
    }

    const bounds = { ...this.state.selectionBounds };

    switch (direction) {
      case "x+":
        bounds.toX = Math.max(bounds.toX - 1, bounds.fromX);
        break;
      case "x-":
        bounds.fromX = Math.min(bounds.fromX + 1, bounds.toX);
        break;
      case "y+":
        bounds.toY = Math.max(bounds.toY - 1, bounds.fromY);
        break;
      case "y-":
        bounds.fromY = Math.min(bounds.fromY + 1, bounds.toY);
        break;
      case "z+":
        bounds.toZ = Math.max(bounds.toZ - 1, bounds.fromZ);
        break;
      case "z-":
        bounds.fromZ = Math.min(bounds.fromZ + 1, bounds.toZ);
        break;
    }

    this.setState({ selectionBounds: bounds });
    this._updateSelectionBox(bounds);
  }

  /**
   * Moves the selection bounds in a given direction by 1 block.
   * Alt+Arrow in Minecraft Editor.
   */
  _moveSelection(direction: "x+" | "x-" | "y+" | "y-" | "z+" | "z-") {
    if (!this.state?.selectionBounds) {
      return;
    }

    const bounds = { ...this.state.selectionBounds };
    const vb = this.effectiveViewBounds;
    const width = bounds.toX - bounds.fromX;
    const height = bounds.toY - bounds.fromY;
    const depth = bounds.toZ - bounds.fromZ;

    switch (direction) {
      case "x+":
        if (bounds.toX < vb.toX - 1) {
          bounds.fromX++;
          bounds.toX++;
        }
        break;
      case "x-":
        if (bounds.fromX > vb.fromX) {
          bounds.fromX--;
          bounds.toX--;
        }
        break;
      case "y+":
        if (bounds.toY < vb.toY - 1) {
          bounds.fromY++;
          bounds.toY++;
        }
        break;
      case "y-":
        if (bounds.fromY > vb.fromY) {
          bounds.fromY--;
          bounds.toY--;
        }
        break;
      case "z+":
        if (bounds.toZ < vb.toZ - 1) {
          bounds.fromZ++;
          bounds.toZ++;
        }
        break;
      case "z-":
        if (bounds.fromZ > vb.fromZ) {
          bounds.fromZ--;
          bounds.toZ--;
        }
        break;
    }

    this.setState({ selectionBounds: bounds });
    this._updateSelectionBox(bounds);
  }

  /**
   * Fills the current selection with blocks (Ctrl+F in Minecraft Editor).
   */
  _fillSelection() {
    if (this.state?.selectionBounds && this.props.onFillRequested) {
      this.props.onFillRequested(this.state.selectionBounds);
    }
  }

  /**
   * Deletes blocks in the current selection (Delete key in Minecraft Editor).
   */
  _deleteSelection() {
    if (this.state?.selectionBounds && this.props.onDeleteRequested) {
      this.props.onDeleteRequested(this.state.selectionBounds);
    }
  }

  _getMeshForBlock(block: Block) {
    if (block.y === undefined || block.z === undefined) {
      return undefined;
    }

    return this._blockMeshes.get(block.x + "." + block.y + "." + block.z);
  }

  _forceSelection() {
    if ((this.selectedBlocks !== undefined && this.selectedBlocks.length > 0) || this.props.blockVolume === undefined) {
      return;
    }

    if (this._hoverBlock !== undefined) {
      this._singleSelectMesh(this._hoverBlock);
      return;
    }

    const blockMesh = this._getMeshForBlock(this.props.blockVolume.x(0).y(0).z(0));

    if (blockMesh !== undefined) {
      this._singleSelectMesh(blockMesh);
    }
  }

  _handleKeyUp(event: KeyboardEvent) {
    this._isHoldingCtrlDown = event.ctrlKey;
    this._isHoldingShiftDown = event.shiftKey;
    this._isHoldingAltDown = event.altKey;
  }

  componentDidMount() {
    this.load();
  }

  async load() {
    // Default tool and selection state matching Minecraft Editor defaults
    const defaultToolState = {
      activeTool: EditorTool.Selection,
      panelCollapsed: false,
      selectionMode: SelectionMode.Marquee,
      cursorInputMode: CursorInputMode.MouseAndKeys,
      cursorTarget: CursorTarget.Block,
      selectionBounds: undefined,
      marqueeStep: "none" as const,
      marqueeFirstClick: undefined,
      marqueeSecondClick: undefined,
      // Hover state for solid vs placeholder blocks
      hoverIsSolidBlock: false,
      // Face offset for Adjacent mode (captured during hover)
      hoverFaceOffsetX: 0,
      hoverFaceOffsetY: 0,
      hoverFaceOffsetZ: 0,
      // Brush tool defaults
      brushShape: BrushShape.Cuboid,
      brushSizeX: 3,
      brushSizeY: 3,
      brushSizeZ: 3,
      brushUniform: true,
      brushBlockType: "minecraft:stone",
      brushTarget: CursorTarget.Adjacent,
      // Pencil tool defaults
      // @see https://learn.microsoft.com/en-us/minecraft/creator/documents/bedrockeditor/editorpenciltool
      pencilMode: PencilMode.Draw,
      pencilBlockFacing: PencilBlockFacing.Default,
      pencilBlockType: "minecraft:stone",
      pencilOffsetX: 0,
      pencilOffsetY: 0,
      pencilOffsetZ: 0,
      pencilCursorTarget: CursorTarget.Adjacent,
      // Block Inspector tool defaults
      // @see https://learn.microsoft.com/en-us/minecraft/creator/documents/bedrockeditor/editorblockinspector
      inspectedBlockX: undefined,
      inspectedBlockY: undefined,
      inspectedBlockZ: undefined,
      inspectedBlockType: undefined,
      inspectedBlockProperties: undefined,
    };

    // Skip vanilla resource loading if explicitly requested (e.g., headless model rendering)
    if (this.props.skipVanillaResources) {
      // Set empty/placeholder state so render() doesn't block
      this.setState({
        terrainTextureDefinition: undefined,
        blocksDefinition: undefined,
        showHelp: false,
        hoverX: undefined,
        hoverY: undefined,
        hoverZ: undefined,
        hoverBlockType: undefined,
        canUndo: false,
        canRedo: false,
        ...defaultToolState,
      });
      return;
    }

    try {
      if (!Database.terrainTextureCatalog || !Database.blocksCatalog) {
        // Add a timeout to prevent the loading overlay from persisting indefinitely
        const loadPromise = Database.loadVanillaResourceDefinitions();
        const timeoutPromise = new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error("Loading vanilla resources timed out after 30 seconds")), 30000)
        );

        await Promise.race([loadPromise, timeoutPromise]);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load vanilla resources";
      Log.debug("VolumeEditor: " + errorMessage);

      this.setState({
        loadError: errorMessage,
      });
      return;
    }

    if (!Database.terrainTextureCatalog || !Database.blocksCatalog) {
      this.setState({
        loadError: "Could not find vanilla resource definitions. Resources may not be available.",
      });
      return;
    }

    // Set up undo manager state change callback
    this._undoManager.setOnStateChanged((canUndo, canRedo) => {
      this.setState({ canUndo, canRedo });
    });

    // Initialize tools map
    this._tools.set(EditorTool.Brush, this._brushTool);
    this._tools.set(EditorTool.Pencil, this._pencilTool);
    this._tools.set(EditorTool.BlockInspector, this._blockInspectorTool);
    this._tools.set(EditorTool.Help, this._helpTool);
    this._tools.set(EditorTool.Properties, this._propertiesTool);

    this._propertiesTool.setOnResizeRequested((newX, newY, newZ) => {
      if (this.props.onResizeRequested) {
        this.props.onResizeRequested(newX, newY, newZ);
      }
    });

    this.setState({
      terrainTextureDefinition: Database.terrainTextureCatalog,
      blocksDefinition: Database.blocksCatalog,
      showHelp: false,
      hoverX: undefined,
      hoverY: undefined,
      hoverZ: undefined,
      hoverBlockType: undefined,
      loadError: undefined,
      canUndo: false,
      canRedo: false,
      ...defaultToolState,
    });
  }

  componentDidUpdate(prevProps: IVolumeEditorProps, prevState: IVolumeEditorState) {
    if (prevProps !== undefined && prevProps.blockVolume !== undefined) {
      prevProps.blockVolume.onBlockTypeChanged.unsubscribe(this._handleBlockTypeChanged);
      prevProps.blockVolume.onBlockPropertyChanged.unsubscribe(this._handleBlockTypeChanged);
    }

    this._connectToProps();
  }

  _connectToProps() {
    if (this.props.blockVolume !== undefined) {
      this.props.blockVolume.onBlockTypeChanged.subscribe(this._handleBlockTypeChanged);
      this.props.blockVolume.onBlockPropertyChanged.subscribe(this._handleBlockTypeChanged);
    }
  }

  _handleBlockTypeChanged(cube: BlockVolume, block: Block) {
    const x = block.x;
    const y = block.y;
    const z = block.z;

    if (x === undefined || y === undefined || z === undefined) {
      throw new Error("Unexpected positionless block");
    }

    this.updateBlockAt(x, y, z);
  }

  _handleCanvasClick() {
    if (this.props.onClicked !== undefined) {
      this.props.onClicked();
    }
  }

  _clearBlockAt(x: number, y: number, z: number) {
    if (this._scene == null || this._blockMeshes.get(x + "." + y + "." + z) === undefined) {
      return;
    }

    this._scene.removeMesh(this._blockMeshes.get(x + "." + y + "." + z) as BABYLON.AbstractMesh);

    this._blockMeshes.set(x + "." + y + "." + z, undefined);
  }

  _applyCanvasProps() {
    if (this._canvas == null) {
      return;
    }
    let heightAdjust = "";

    if (this.props.height !== undefined) {
      heightAdjust = "min-height: " + this.props.height + "px; max-height: " + this.props.height + "px;";
    } else if (this.props.heightOffset !== undefined && this.props.heightOffset > 0) {
      // Only use viewport-based height calculation if heightOffset > 0
      // When heightOffset is 0, use 100% to fill the container
      heightAdjust =
        "min-height: calc(100vh - " +
        this.props.heightOffset +
        "px); max-height: calc(100vh - " +
        this.props.heightOffset +
        "px);";
    }
    // When neither height nor heightOffset is set (or heightOffset is 0),
    // the canvas will use height: 100% to fill its container

    this._canvas.setAttribute(
      "style",
      "width: 100%; height: 100%; min-width: 100%; " + heightAdjust + " background-color: black"
    );
  }

  _setCanvasOuter(elt: HTMLDivElement | null) {
    if (elt === null) {
      return;
    }

    if (elt !== this._canvasOuterDiv) {
      if (this._canvas == null) {
        this._canvas = document.createElement("canvas") as HTMLCanvasElement;
        this._canvas.addEventListener("click", this._handleCanvasClick);
        this._canvas.setAttribute("data-testid", "mob-viewer-canvas");
        this._canvas.setAttribute("aria-label", "3D model preview of entity");

        this._applyCanvasProps();
      } else if (this._canvasOuterDiv != null) {
        this._canvasOuterDiv.removeChild(this._canvas);
      }

      elt.appendChild(this._canvas);

      this._canvasOuterDiv = elt;

      if (this._engine == null) {
        this.initialize();
      }
    } else {
      this._applyCanvasProps();

      // Check if camera position props changed
      const cameraChanged =
        this.props.cameraX !== this._lastCameraX ||
        this.props.cameraY !== this._lastCameraY ||
        this.props.cameraZ !== this._lastCameraZ;

      // Check if dimensions changed on the same blockVolume (e.g., after resize)
      const dimensionsChanged =
        this.props.blockVolume !== undefined &&
        (this.props.blockVolume.maxX !== this._lastBlockCubeMaxX ||
          this.props.blockVolume.maxY !== this._lastBlockCubeMaxY ||
          this.props.blockVolume.maxZ !== this._lastBlockCubeMaxZ);

      if (
        this.props.blockVolume !== this._lastBlockCube ||
        !this.boundsAreEqual(this.props.viewBounds, this._lastViewBounds) ||
        cameraChanged ||
        dimensionsChanged
      ) {
        let resetCamera = false;

        if (this.props.blockVolume !== this._lastBlockCube || cameraChanged) {
          resetCamera = true;
        }

        this._renderScene();

        if (resetCamera) {
          this.resetCamera();
        }
      }
    }
  }

  boundsAreEqual(boundsA: IBlockVolumeBounds | undefined, boundsB: IBlockVolumeBounds | undefined) {
    if (boundsA === undefined && boundsB === undefined) {
      return true;
    }

    if (boundsA === undefined) {
      return false;
    }

    if (boundsB === undefined) {
      return false;
    }

    if (
      boundsA.fromX !== boundsB.fromX ||
      boundsA.fromY !== boundsB.fromY ||
      boundsA.fromZ !== boundsB.fromZ ||
      boundsA.toX !== boundsB.toX ||
      boundsA.toY !== boundsB.toY ||
      boundsA.toZ !== boundsB.toZ
    ) {
      return false;
    }

    return true;
  }

  initialize() {
    const eo: BABYLON.EngineOptions = {
      alpha: false, // Opaque canvas — clearColor fills gaps, no HTML bleed-through
    };
    const engine = new BABYLON.Engine(this._canvas, true, eo, false);
    this._engine = engine;

    this.createScene(engine);

    this._renderScene();

    // Reset camera after entities are rendered so bounds calculation works
    this.resetCamera();

    engine.runRenderLoop(() => {
      if (this._scene != null) {
        this._scene.render();
      }
    });
  }

  _renderScene() {
    this._lastBlockCube = this.props.blockVolume;
    this._lastBlockCubeMaxX = this.props.blockVolume?.maxX;
    this._lastBlockCubeMaxY = this.props.blockVolume?.maxY;
    this._lastBlockCubeMaxZ = this.props.blockVolume?.maxZ;
    this._lastViewBounds = this.props.viewBounds;

    this._clearAll();
    this._addEnvironment();
    this._addBlocks();
    this._addEntities();
  }

  resize() {
    if (this._engine != null) {
      this._engine.resize();
    }
  }

  _initializeUX() {
    // Most UX is now handled by HTML overlays in render() for better styling.
    // Keep minimal BabylonJS GUI for backwards compatibility only.
    if (this._uiTexture !== undefined && this.props.viewMode !== VolumeEditorViewMode.SingleBlock) {
      // Create a minimal text block for compatibility (hidden, replaced by HTML overlay)
      this._coordinatesText = new GUI.TextBlock();
      this._coordinatesText.text = "";
      this._coordinatesText.color = "transparent"; // Hidden - HTML overlay is used instead
      this._coordinatesText.fontSize = 1;
      this._uiTexture.addControl(this._coordinatesText);

      // Axis orientation indicator - shows which direction camera is facing
      if (!this.props.hideChrome && this.props.viewMode === VolumeEditorViewMode.Structure) {
        const axisIndicator = new GUI.TextBlock("axisIndicator", "");
        axisIndicator.color = "rgba(255, 255, 255, 0.6)";
        axisIndicator.fontSize = 11;
        axisIndicator.fontFamily = "'Noto Sans', 'Segoe UI', sans-serif";
        axisIndicator.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        axisIndicator.textVerticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
        axisIndicator.left = "12px";
        axisIndicator.top = "-12px";
        axisIndicator.resizeToFit = true;
        this._uiTexture.addControl(axisIndicator);
        this._axisIndicator = axisIndicator;

        const self = this;
        this._scene?.registerBeforeRender(() => {
          if (self._axisIndicator && self._camera) {
            const forward = self._camera.getForwardRay().direction;
            const absX = Math.abs(forward.x);
            const absZ = Math.abs(forward.z);
            let label = "";
            if (absX > absZ) {
              label = forward.x > 0 ? "→ +X" : "← -X";
            } else {
              label = forward.z > 0 ? "↑ +Z" : "↓ -Z";
            }
            const yLabel = forward.y > 0.3 ? " ↗ Up" : forward.y < -0.3 ? " ↘ Down" : "";
            self._axisIndicator.text = "Facing: " + label + yLabel;
          }
        });
      }
    }
  }

  createScene(engine: BABYLON.Engine) {
    const scene = new BABYLON.Scene(engine);

    this._scene = scene;
    this._scene.blockMaterialDirtyMechanism = true;

    this._blockMeshFactory = new BlockMeshFactory(this._scene, this.effectiveViewBounds);
    this._modelMeshFactory = new ModelMeshFactory(this._scene, this.effectiveViewBounds);
    this._meshes = {};

    // Use shared scene configuration with theme-aware clear color
    MinecraftEnvironment.configureScene(scene, { themeAwareClearColor: true });

    if (this._camera == null) {
      this._camera = new BABYLON.FreeCamera("mainCam", new BABYLON.Vector3(1.5, 9, -9), scene);
      this._camera.inputs.clear();

      // Set narrower FOV for ModelPreview mode to get tighter framing
      if (this.props.viewMode === VolumeEditorViewMode.ModelPreview) {
        this._camera.fov = 0.35; // ~20 degrees - narrow telephoto-like for clean model framing
      }

      if (this.props.viewMode !== VolumeEditorViewMode.SingleBlock) {
        this._camera.inputs.addMouse();
        this._camera.inputs.addMouseWheel();
        this._camera.inputs.addGamepad();

        const wheel = this._camera.inputs.attached.mousewheel as BABYLON.FreeCameraMouseWheelInput;
        wheel.wheelPrecisionY = 0.06;
        wheel.wheelPrecisionX = 0.06;

        // Minecraft Editor keyboard controls:
        // WASD for horizontal movement, Q/E for vertical movement
        // Rotation is handled via mouse (right-click drag)
        const c = new BABYLON.FreeCameraKeyboardMoveInput();
        c.keysDown = [83]; // S - move backward
        c.keysUp = [87]; // W - move forward
        c.keysLeft = [65]; // A - strafe left
        c.keysRight = [68]; // D - strafe right
        c.keysUpward = [69]; // E - move up (Minecraft Editor convention)
        c.keysDownward = [81]; // Q - move down (Minecraft Editor convention)

        this._camera.inputs.add(c);

        // Camera sensitivity settings
        // Lower angularSensibility = faster mouse rotation (inverse relationship)
        // Higher speed = faster WASD movement
        this._camera.angularSensibility = 2000;
        this._camera.speed = 0.15;
      }

      this.resetCamera();

      // This attaches the camera to the canvas
      this._camera.attachControl(this._canvas, true);
    }

    // Use shared lighting pipeline (hemispheric ambient + directional sun)
    // Kept at reduced intensity since _createMinecraftEnvironment() adds its own sun light
    const lights = MinecraftEnvironment.configureLighting(scene);
    lights.ambient.intensity = 0.4;
    lights.sun.intensity = 0.3;

    if (this.props.viewMode !== VolumeEditorViewMode.SingleBlock) {
      this._uiTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");
    }

    this._initializeUX();
    // Note: Minecraft environment is created in _addEnvironment() because _renderScene calls _clearAll()
  }

  private _createMinecraftEnvironment(scene: BABYLON.Scene) {
    // When skipVanillaResources is true, create a minimal isolated environment
    // without any vanilla textures, sky, clouds, or Minecraft-style elements.
    if (this.props.skipVanillaResources) {
      this._createIsolatedEnvironment(scene);
      return;
    }

    // Create the sky dome with proper Minecraft gradient (shared with WorldRenderer)
    MinecraftEnvironment.createSkyDome(scene);

    // Add sun with directional lighting
    MinecraftEnvironment.createSunVisual(scene);

    // Add infinite ground plane (skip for Structure mode - it gets a checkerboard platform instead)
    if (this.props.viewMode !== VolumeEditorViewMode.Structure) {
      MinecraftEnvironment.createInfiniteGroundPlane(scene, {
        centerX: this.props.blockVolume ? this.props.blockVolume.maxX / 2 : 0,
        centerZ: this.props.blockVolume ? this.props.blockVolume.maxZ / 2 : 0,
      });
    }

    // Add clouds
    MinecraftEnvironment.createClouds(scene);
  }

  /**
   * Creates a minimal isolated environment for headless rendering.
   * Uses simple solid colors without loading any external textures.
   * Creates a checkerboard platform for both Structure and ModelPreview modes.
   */
  private _createIsolatedEnvironment(scene: BABYLON.Scene) {
    // Use the procedural sky dome (no vanilla textures needed - it's all gradient)
    MinecraftEnvironment.createSkyDome(scene);

    // Add basic isolated lighting (no vanilla textures needed)
    MinecraftEnvironment.createIsolatedLighting(scene);

    // Create checkerboard platform using shared utility
    if (this.props.viewMode === VolumeEditorViewMode.Structure) {
      this._createStructureGroundPlatform(scene);
    } else if (this.props.viewMode === VolumeEditorViewMode.ModelPreview) {
      this._createModelGroundPlatform(scene);
    }
  }

  /**
   * Creates a small checkerboard ground platform for model preview rendering.
   * The platform is compact (5x5 blocks) and positioned at the model's feet.
   */
  private _createModelGroundPlatform(scene: BABYLON.Scene) {
    MinecraftEnvironment.createCheckerboardPlatform(scene, {
      minX: 1,
      maxX: 5,
      minZ: 1,
      maxZ: 5,
      yPosition: -0.5,
      namePrefix: "modelGrass",
    });
  }

  /**
   * Creates a checkerboard ground platform for structure rendering.
   * The platform is positioned just below y=0 and extends around the structure bounds.
   */
  private _createStructureGroundPlatform(scene: BABYLON.Scene) {
    if (!this.props.blockVolume) {
      return;
    }

    MinecraftEnvironment.createCheckerboardPlatform(scene, {
      minX: -2,
      maxX: this.props.blockVolume.maxX + 2,
      minZ: -2,
      maxZ: this.props.blockVolume.maxZ + 2,
      yPosition: -0.5,
      namePrefix: "structureGrass",
    });
  }

  /**
   * Sky dome creation — delegates to shared MinecraftEnvironment.
   * Uses high-quality 128-segment sphere with fog-matched gradient.
   */
  private _createSkyDome(scene: BABYLON.Scene) {
    MinecraftEnvironment.createSkyDome(scene);
  }

  /**
   * Sun visual — delegates to shared MinecraftEnvironment.
   */
  private _createSun(scene: BABYLON.Scene) {
    MinecraftEnvironment.createSunVisual(scene);
  }

  /**
   * Ground plane — delegates to shared MinecraftEnvironment.
   */
  private _createGroundPlane(scene: BABYLON.Scene) {
    MinecraftEnvironment.createInfiniteGroundPlane(scene, {
      centerX: this.props.blockVolume ? this.props.blockVolume.maxX / 2 : 0,
      centerZ: this.props.blockVolume ? this.props.blockVolume.maxZ / 2 : 0,
    });
  }

  /**
   * Creates a simple ground plane with a solid color for use when vanilla resources aren't available.
   * Delegates platform and reference blocks to shared MinecraftEnvironment.
   */
  private _createSimpleGroundPlane(scene: BABYLON.Scene) {
    MinecraftEnvironment.configureScene(scene, { themeAwareClearColor: true });

    MinecraftEnvironment.createInfiniteGroundPlane(scene, {
      size: 24,
      centerX: this.props.blockVolume ? this.props.blockVolume.maxX / 2 : 0,
      centerZ: this.props.blockVolume ? this.props.blockVolume.maxZ / 2 : 0,
      addFog: false,
    });

    // Add reference blocks for scale in model preview
    if (this.props.viewMode === VolumeEditorViewMode.ModelPreview) {
      this._createReferenceBlocks(scene);
    }
  }

  /**
   * Creates reference blocks for scale context — delegates to MinecraftEnvironment.
   * Also creates a checkerboard platform underneath the model.
   */
  private _createReferenceBlocks(scene: BABYLON.Scene) {
    MinecraftEnvironment.createCheckerboardPlatform(scene, {
      minX: -2,
      maxX: 9,
      minZ: -2,
      maxZ: 9,
      yPosition: -0.5,
      namePrefix: "refPlatform",
    });

    MinecraftEnvironment.createReferenceBlocks(scene);
  }

  /**
   * Cloud creation — delegates to shared MinecraftEnvironment.
   */
  private _createClouds(scene: BABYLON.Scene) {
    MinecraftEnvironment.createClouds(scene);
  }

  public resetCamera() {
    if (this._camera === null || this.props.blockVolume === undefined) {
      return;
    }

    let maxX = this.props.blockVolume.maxX;
    let maxY = this.props.blockVolume.maxY;
    let maxZ = this.props.blockVolume.maxZ;

    const viewBounds = this.props.viewBounds;

    if (viewBounds !== undefined) {
      maxX = viewBounds.toX - viewBounds.fromX;
      maxY = viewBounds.toY - viewBounds.fromY;
      maxZ = viewBounds.toZ - viewBounds.fromZ;
    }

    // If explicit camera position is provided, use it (for multi-angle rendering)
    if (this.props.cameraX !== undefined && this.props.cameraY !== undefined && this.props.cameraZ !== undefined) {
      // Calculate target from entity meshes bounds if available, fall back to model visible_bounds
      let entityBounds = this._calculateEntityMeshBounds();
      if (!entityBounds) {
        entityBounds = this._calculateModelBoundsFromEntities();
      }

      let targetX: number;
      let targetY: number;
      let targetZ: number;

      if (entityBounds) {
        // Use center of actual entity mesh bounds or model visible_bounds
        targetX = entityBounds.centerX;
        targetY = entityBounds.centerY;
        targetZ = entityBounds.centerZ;
      } else if (this.props.viewMode === VolumeEditorViewMode.Structure) {
        // For structures, use the center of the block volume
        targetX = maxX / 2;
        targetY = maxY / 2;
        targetZ = maxZ / 2;
      } else {
        // Fall back to blockVolume center with estimated entity height
        const entityBaseY = this.props.skipVanillaResources ? 0 : 2;
        targetX = maxX / 2;
        targetY = entityBaseY + 1.5;
        targetZ = maxZ / 2;
      }

      this._camera.position = new BABYLON.Vector3(this.props.cameraX, this.props.cameraY, this.props.cameraZ);
      this._camera.setTarget(new BABYLON.Vector3(targetX, targetY, targetZ));

      // Save last camera position for change detection
      this._lastCameraX = this.props.cameraX;
      this._lastCameraY = this.props.cameraY;
      this._lastCameraZ = this.props.cameraZ;
      return;
    }

    if (this.props.viewMode === VolumeEditorViewMode.Structure) {
      // Position camera for 45-degree isometric view
      // Camera is positioned diagonally from the structure looking at its center
      const maxDim = Math.max(maxX, maxY, maxZ);
      const distance = maxDim * 1.5; // Distance from center based on largest dimension
      const centerX = maxX / 2;
      const centerY = maxY / 2;
      const centerZ = maxZ / 2;

      // 45-degree angle: camera is offset equally on X and Z, elevated on Y
      this._camera.position = new BABYLON.Vector3(
        centerX + distance * 0.7, // Offset on X
        centerY + distance * 0.6, // Elevated on Y for downward angle
        centerZ + distance * 0.7 // Offset on Z
      );

      this._camera.setTarget(new BABYLON.Vector3(centerX, centerY, centerZ));
    } else if (this.props.viewMode === VolumeEditorViewMode.ModelPreview) {
      // Dynamic camera positioning based on actual entity mesh bounds
      // Try entity mesh bounds first, then fall back to model visible_bounds
      let entityBounds = this._calculateEntityMeshBounds();

      // If no mesh bounds yet (meshes not created), try to get bounds from model definition
      if (!entityBounds) {
        entityBounds = this._calculateModelBoundsFromEntities();
      }

      let targetX: number;
      let targetY: number;
      let targetZ: number;
      let cameraDistance: number;

      if (entityBounds) {
        // Use actual entity mesh bounds or model visible_bounds for camera positioning
        targetX = entityBounds.centerX;
        targetY = entityBounds.centerY;
        targetZ = entityBounds.centerZ;

        // Calculate camera distance based on model size and FOV
        // FOV is 0.35 rad (~20°), so tan(FOV/2) ≈ 0.177
        // To see full model: distance = (modelSize/2) / tan(FOV/2)
        // With generous margin for padding: distance ≈ modelSize * 4.5
        // Since camera offset is diagonal (0.7, 0.7), actual distance = cameraDistance * sqrt(0.7² + 0.7²) ≈ cameraDistance
        const modelSize = entityBounds.maxDimension;
        cameraDistance = Math.max(modelSize * 4.5 + 3.0, 6.0); // Pulled back significantly for comfortable viewing
      } else {
        // Fall back to estimated positioning when bounds not available
        const entityBaseY = this.props.skipVanillaResources ? 0 : 2;
        targetX = maxX / 2;
        targetY = entityBaseY + 1.5; // Approximate center of typical mob
        targetZ = maxZ / 2;
        cameraDistance = 12.0; // Default distance for typical mob, pulled back significantly
      }

      // Position camera at isometric angle from the model
      // Use isometric-style positioning similar to MCP preview
      this._camera.position = new BABYLON.Vector3(
        targetX + cameraDistance * 0.7,
        Math.max(targetY + cameraDistance * 0.3, 0.5), // Slightly above center for isometric view
        targetZ + cameraDistance * 0.7
      );

      // Look at the entity's center mass
      this._camera.setTarget(new BABYLON.Vector3(targetX, targetY, targetZ));
    } else {
      this._camera.position = new BABYLON.Vector3((-maxX * 3) / 4, maxY + (maxY * 3) / 4, (-maxZ * 3) / 4);

      this._camera.setTarget(new BABYLON.Vector3((maxX * 7) / 16, (maxY * 7) / 16, (maxZ * 7) / 16));
    }
  }

  _handleBlockPointerOver(event: BABYLON.ActionEvent) {
    if (this.isSelectable) {
      const box = event.source as BABYLON.Mesh;

      // Use metadata to get block info (preferred - avoids fragile name parsing)
      const metadata = box.metadata as IBlockMeshMetadata | undefined;

      let dataX: number;
      let dataY: number;
      let dataZ: number;
      let isSolidBlock: boolean;

      if (metadata && typeof metadata.blockX === "number") {
        // Use metadata directly
        dataX = metadata.blockX;
        dataY = metadata.blockY;
        dataZ = metadata.blockZ;
        isSolidBlock = metadata.isSolid;
      } else {
        // Fallback to name parsing for backward compatibility
        const nameStartsWithB = box.name.startsWith("b");
        isSolidBlock = nameStartsWithB;

        let name = box.name.substring(1, box.name.length);

        // Handle face suffix for child plane meshes (e.g., "|f", "|b", "|l", "|r", "|u", "|d")
        const firstPipe = name.indexOf("|");
        if (firstPipe >= 0) {
          name = name.substring(0, firstPipe);
        }

        // Handle semicolon suffix from cloned meshes
        const semicolonIndex = name.indexOf(";");
        if (semicolonIndex >= 0) {
          name = name.substring(0, semicolonIndex);
        }

        const coords = name.split(".");
        if (coords.length !== 3) {
          return;
        }

        dataX = parseInt(coords[0]);
        dataY = parseInt(coords[1]);
        dataZ = parseInt(coords[2]);
      }

      // Check if the picked block is within structure bounds (using data coordinates)
      if (!this._isWithinStructureBounds(dataX, dataY, dataZ)) {
        return;
      }

      // Calculate face offset by doing a pick for solid blocks only
      let faceOffsetX = 0;
      let faceOffsetY = 0;
      let faceOffsetZ = 0;

      if (this._scene) {
        const pickResult = this._scene.pick(this._scene.pointerX, this._scene.pointerY, (mesh) => {
          // Pick meshes with solid block metadata, or fallback to "b" prefix
          const meshMeta = mesh.metadata as IBlockMeshMetadata | undefined;
          if (meshMeta && typeof meshMeta.isSolid === "boolean") {
            return meshMeta.isSolid && mesh.isPickable;
          }
          return mesh.name.startsWith("b") && mesh.isPickable;
        });
        if (pickResult?.hit && pickResult.pickedPoint && pickResult.pickedMesh) {
          const meshCenter = pickResult.pickedMesh.position;
          const pickPoint = pickResult.pickedPoint;

          const relX = pickPoint.x - meshCenter.x;
          const relY = pickPoint.y - meshCenter.y;
          const relZ = pickPoint.z - meshCenter.z;

          const absX = Math.abs(relX);
          const absY = Math.abs(relY);
          const absZ = Math.abs(relZ);

          if (absY >= absX && absY >= absZ) {
            faceOffsetY = relY > 0 ? 1 : -1;
          } else if (absX >= absY && absX >= absZ) {
            // Note: X is negated because visual X is flipped from data X
            faceOffsetX = relX > 0 ? -1 : 1;
          } else {
            faceOffsetZ = relZ > 0 ? 1 : -1;
          }
        }
      }

      // Get block type from the block volume
      let blockTypeName: string | undefined;
      let actualIsSolidBlock = isSolidBlock;
      let targetDataX = dataX;
      let targetDataY = dataY;
      let targetDataZ = dataZ;

      if (this.props.blockVolume) {
        const block = this.props.blockVolume.x(dataX).y(dataY).z(dataZ);
        blockTypeName = block.id;

        // For Block Inspector mode: if hovering over air, find an adjacent solid block
        const isAir = block.isEmpty || blockTypeName === "minecraft:air" || blockTypeName === "air";
        if (isAir && this.state?.activeTool === EditorTool.BlockInspector) {
          // Check adjacent blocks to find a solid one
          const directions = [
            { dx: -faceOffsetX, dy: -faceOffsetY, dz: -faceOffsetZ }, // Opposite of face offset
            { dx: 0, dy: -1, dz: 0 }, // Below
            { dx: 0, dy: 1, dz: 0 }, // Above
            { dx: 1, dy: 0, dz: 0 },
            { dx: -1, dy: 0, dz: 0 },
            { dx: 0, dy: 0, dz: 1 },
            { dx: 0, dy: 0, dz: -1 },
          ];

          for (const dir of directions) {
            if (dir.dx === 0 && dir.dy === 0 && dir.dz === 0) continue;

            const adjacentX = dataX + dir.dx;
            const adjacentY = dataY + dir.dy;
            const adjacentZ = dataZ + dir.dz;

            if (this._isWithinStructureBounds(adjacentX, adjacentY, adjacentZ)) {
              const adjacentBlock = this.props.blockVolume.x(adjacentX).y(adjacentY).z(adjacentZ);
              const adjacentIsAir =
                adjacentBlock.isEmpty || adjacentBlock.id === "minecraft:air" || adjacentBlock.id === "air";

              if (!adjacentIsAir) {
                targetDataX = adjacentX;
                targetDataY = adjacentY;
                targetDataZ = adjacentZ;
                blockTypeName = adjacentBlock.id;
                actualIsSolidBlock = true;
                break;
              }
            }
          }
        }
      }

      // Apply display offsets for UI
      let xCoord = targetDataX;
      let yCoord = targetDataY;
      let zCoord = targetDataZ;

      if (this.props.xCoordOffset) xCoord += this.props.xCoordOffset;
      if (this.props.yCoordOffset) yCoord += this.props.yCoordOffset;
      if (this.props.zCoordOffset) zCoord += this.props.zCoordOffset;

      this._hoverBlock = box;

      // Update hover indicator mesh position (uses visual coordinates from the target block's mesh position)
      if (this.props.blockVolume) {
        const maxX = this.props.blockVolume.maxX;
        const visualX = maxX - (targetDataX + 0.5);
        const visualY = targetDataY + 0.5;
        const visualZ = targetDataZ + 0.5;
        this._updateHoverIndicator(true, visualX, visualY, visualZ);
      }

      // Update state for HTML overlay display
      this.setState(
        {
          hoverX: xCoord,
          hoverY: yCoord,
          hoverZ: zCoord,
          hoverBlockType: blockTypeName,
          hoverIsSolidBlock: actualIsSolidBlock,
          hoverFaceOffsetX: faceOffsetX,
          hoverFaceOffsetY: faceOffsetY,
          hoverFaceOffsetZ: faceOffsetZ,
        },
        () => {
          const hoverInfo: IToolHoverInfo = {
            x: xCoord,
            y: yCoord,
            z: zCoord,
            blockType: blockTypeName,
            faceOffsetX: faceOffsetX,
            faceOffsetY: faceOffsetY,
            faceOffsetZ: faceOffsetZ,
          };

          const activeTool = this._tools.get(this.state?.activeTool);
          if (activeTool) {
            activeTool.onHover(hoverInfo);
          }

          if (this.state?.activeTool === EditorTool.Brush) {
            this._updateBrushPreview();
          }
          if (this.state?.activeTool === EditorTool.Pencil) {
            this._updatePencilPreview();
          }
        }
      );

      if (this._coordinatesText !== undefined) {
        this._coordinatesText.text = "x: " + xCoord + " y: " + yCoord + " z: " + zCoord;
      }
    }
  }

  _handleBlockPointerOut(event: BABYLON.ActionEvent) {
    const box = event.source as BABYLON.Mesh;

    // Hide hover indicator
    this._updateHoverIndicator(false);

    // Clear hover state
    this.setState({
      hoverX: undefined,
      hoverY: undefined,
      hoverZ: undefined,
      hoverBlockType: undefined,
      hoverIsSolidBlock: false,
    });

    // Notify active tool that hover ended
    const activeTool = this._tools.get(this.state?.activeTool);
    if (activeTool) {
      activeTool.onHoverEnd();
    }

    if (this._coordinatesText != null) {
      this._coordinatesText.text = "";
    }

    this._hoverBlock = undefined;
  }

  /**
   * Handles block clicks based on current tool and mode.
   * - Brush tool: Paint blocks at cursor location
   * - Selection tool:
   *   - SingleBlock mode: Click to select/deselect individual blocks
   *   - Marquee mode: Click to set X coordinate, Shift+click for Z, Alt+click for Y
   *
   * @see https://learn.microsoft.com/en-us/minecraft/creator/documents/bedrockeditor/editorselectiontool#marquee-selection
   */
  _handleBlockClick(event: BABYLON.ActionEvent) {
    if (!this.isSelectable || this.props.blockVolume === undefined) {
      return;
    }

    const blockMesh = event.source as BABYLON.AbstractMesh;
    const block = this._getBlockFromMesh(blockMesh);

    if (!block || block.x === undefined || block.y === undefined || block.z === undefined) {
      return;
    }

    // Handle brush tool painting
    if (this.state?.activeTool === EditorTool.Brush) {
      this._paintBrush();
      return;
    }

    // Handle pencil tool painting (click to place/erase single block)
    // @see https://learn.microsoft.com/en-us/minecraft/creator/documents/bedrockeditor/editorpenciltool
    if (this.state?.activeTool === EditorTool.Pencil) {
      this._paintPencil();
      return;
    }

    // Handle Block Inspector tool click (using pluggable tool)
    // @see https://learn.microsoft.com/en-us/minecraft/creator/documents/bedrockeditor/editorblockinspector
    if (this.state?.activeTool === EditorTool.BlockInspector) {
      const tool = this._tools.get(EditorTool.BlockInspector);
      if (tool && block.x !== undefined && block.y !== undefined && block.z !== undefined) {
        // For Block Inspector, we want to select the actual solid block, not air
        // The hover state should already contain the correct solid block coordinates
        // (they were calculated in _handleBlockPointerOver when picking solid blocks)
        let targetX = block.x;
        let targetY = block.y;
        let targetZ = block.z;
        let targetBlockType = block.typeName;

        // If the hover state has valid coordinates, use those instead
        // (hover handler already redirected air blocks to solid blocks)
        if (
          this.state?.hoverX !== undefined &&
          this.state?.hoverY !== undefined &&
          this.state?.hoverZ !== undefined &&
          this.state?.hoverBlockType
        ) {
          // Apply coordinate offsets in reverse to get data coordinates
          targetX = this.state.hoverX - (this.props.xCoordOffset ?? 0);
          targetY = this.state.hoverY - (this.props.yCoordOffset ?? 0);
          targetZ = this.state.hoverZ - (this.props.zCoordOffset ?? 0);
          targetBlockType = this.state.hoverBlockType;
        }

        const hoverInfo: IToolHoverInfo = {
          x: targetX,
          y: targetY,
          z: targetZ,
          blockType: targetBlockType,
          faceOffsetX: 0,
          faceOffsetY: 0,
          faceOffsetZ: 0,
        };
        tool.onClick(hoverInfo);
      }
      return;
    }

    // Get modifier key state from the source event (more reliable than keyboard tracking)
    const sourceEvent = event.sourceEvent as PointerEvent | MouseEvent | undefined;
    const isShiftDown = sourceEvent?.shiftKey ?? this._isHoldingShiftDown;
    const isAltDown = sourceEvent?.altKey ?? this._isHoldingAltDown;
    const isCtrlDown = sourceEvent?.ctrlKey ?? this._isHoldingCtrlDown;

    const selectionMode = this.state?.selectionMode ?? SelectionMode.Marquee;

    if (selectionMode === SelectionMode.SingleBlock) {
      // Single block mode: Ctrl+click to add/toggle, regular click for single select
      if (isCtrlDown) {
        this._toggleAddMesh(blockMesh);
      } else {
        this._singleSelectMesh(blockMesh);
      }
    } else if (selectionMode === SelectionMode.Marquee) {
      // Marquee selection mode - multi-step coordinate selection
      this._handleMarqueeClick(block, isShiftDown, isAltDown);
    }
  }

  /**
   * Handles clicks in Marquee selection mode.
   * Step 1: Click to set X coordinate (first corner)
   * Step 2: Shift+click to set Z coordinate (forms a rectangle on the ground)
   * Step 3: Alt+click (Option on Mac) to set Y coordinate (extends to 3D volume)
   *
   * Note: Steps 2 and 3 can be done in any order after step 1.
   */
  _handleMarqueeClick(block: Block, isShiftDown: boolean, isAltDown: boolean) {
    if (block.x === undefined || block.y === undefined || block.z === undefined) {
      return;
    }

    const marqueeStep = this.state?.marqueeStep ?? "none";

    // Alt+click to set Y extent - can be done from step "x" or "z"
    // Check this FIRST to prioritize Alt over Shift
    if (isAltDown && marqueeStep !== "none" && marqueeStep !== "y") {
      // Set Y coordinate (extend to 3D box)
      const currentBounds = this.state.selectionBounds;
      if (!currentBounds) return;

      const bounds: ISelectionBounds = {
        fromX: currentBounds.fromX,
        fromY: Math.min(currentBounds.fromY, block.y),
        fromZ: currentBounds.fromZ,
        toX: currentBounds.toX,
        toY: Math.max(currentBounds.toY, block.y),
        toZ: currentBounds.toZ,
      };

      this.setState({
        marqueeStep: "y",
        selectionBounds: bounds,
      });

      this._updateSelectionBox(bounds);
      return;
    }

    // Shift+click to set Z extent - only from step "x"
    if (isShiftDown && marqueeStep === "x") {
      // Second click with Shift - set Z coordinate (extend to rectangle)
      const first = this.state.marqueeFirstClick!;
      const bounds: ISelectionBounds = {
        fromX: Math.min(first.x, block.x),
        fromY: first.y,
        fromZ: Math.min(first.z, block.z),
        toX: Math.max(first.x, block.x),
        toY: first.y,
        toZ: Math.max(first.z, block.z),
      };

      this.setState({
        marqueeStep: "z",
        marqueeSecondClick: { x: block.x, y: block.y, z: block.z },
        selectionBounds: bounds,
      });

      this._updateSelectionBox(bounds);
      return;
    }

    // No modifier keys, or at step "none" - start a new selection
    // Also reset if selection is complete (step "y")
    if (marqueeStep === "none" || marqueeStep === "y" || (!isShiftDown && !isAltDown)) {
      // First click - set the first corner (X coordinate anchor)
      this.setState({
        marqueeStep: "x",
        marqueeFirstClick: { x: block.x, y: block.y, z: block.z },
        marqueeSecondClick: undefined,
        selectionBounds: {
          fromX: block.x,
          fromY: block.y,
          fromZ: block.z,
          toX: block.x,
          toY: block.y,
          toZ: block.z,
        },
      });

      // Show initial selection box (single block)
      this._updateSelectionBox({
        fromX: block.x,
        fromY: block.y,
        fromZ: block.z,
        toX: block.x,
        toY: block.y,
        toZ: block.z,
      });
    }
  }

  _getBlockFromMesh(blockMesh: BABYLON.AbstractMesh): Block | undefined {
    let id = blockMesh.name;
    id = id.substring(1, id.length);

    const semicolon = id.lastIndexOf(";");

    if (semicolon >= 0) {
      id = id.substring(0, semicolon);
    }

    const lastPipe = id.lastIndexOf("|");

    if (lastPipe >= 0) {
      id = id.substring(0, lastPipe);
    }

    if (id.endsWith(".")) {
      id = id.substring(0, id.length - 1);
    }

    const coords = id.split(".");

    if (this.props.blockVolume === undefined) {
      return undefined;
    }

    if (coords.length === 3) {
      return this.props.blockVolume.x(parseInt(coords[0])).y(parseInt(coords[1])).z(parseInt(coords[2]));
    }

    return undefined;
  }

  _toggleAddMesh(blockMesh: BABYLON.AbstractMesh) {
    const newSelection = this._getBlockFromMesh(blockMesh);

    if (newSelection !== undefined) {
      let selectBlocks: Block[] = [];

      if (this.selectedBlocks !== undefined) {
        selectBlocks = this.selectedBlocks;
      }

      let selectMeshes: BABYLON.AbstractMesh[] = [];

      if (this._selectedBlockMeshes !== undefined) {
        selectMeshes = this._selectedBlockMeshes;
      }

      let isSelected = false;

      for (let i = 0; i < selectMeshes.length; i++) {
        // this mesh has already been selected; toggle it out
        if (selectMeshes[i] === blockMesh) {
          isSelected = true;
          this._setBoundingBox(selectMeshes[i], false);

          const newSelectedBlockMeshes = [];
          const newSelectedBlocks = [];

          for (let j = 0; j < selectMeshes.length; j++) {
            if (j !== i) {
              newSelectedBlockMeshes.push(selectMeshes[i]);
              newSelectedBlocks.push(selectBlocks[i]);
            }
          }

          if (newSelectedBlocks.length === 0) {
            this.selectedBlocks = undefined;
            this._selectedBlockMeshes = undefined;
          } else {
            this.selectedBlocks = newSelectedBlocks;
            this._selectedBlockMeshes = newSelectedBlockMeshes;
          }
        }
      }

      // add clicked block to list of selected blocks
      if (!isSelected) {
        selectMeshes.push(blockMesh);
        selectBlocks.push(newSelection);

        this._setBoundingBox(blockMesh, true);

        this.selectedBlocks = selectBlocks;
        this._selectedBlockMeshes = selectMeshes;
      }

      if (this.props.onSelectedBlocksChanged !== undefined) {
        this.props.onSelectedBlocksChanged(this.selectedBlocks);
      }
    }
  }

  _setBoundingBox(mesh: BABYLON.AbstractMesh, value: boolean) {
    mesh.showBoundingBox = value;

    const children = mesh.getChildMeshes();

    for (let i = 0; i < children.length; i++) {
      children[i].showBoundingBox = value;
    }
  }

  updateBlockAt(x: number, y: number, z: number) {
    this.updateBlocksAt(x, y, z, x, y, z);
  }

  updateBlocksAt(xFrom: number, yFrom: number, zFrom: number, xTo: number, yTo: number, zTo: number) {
    if (this.props.blockVolume === undefined) {
      return;
    }

    const vb = this.effectiveViewBounds;

    // extend the range out by 1 all around to update any impacted blocks
    xFrom--;
    if (xFrom < vb.fromX) {
      xFrom = vb.fromX;
    }

    yFrom--;
    if (yFrom < vb.fromY) {
      yFrom = vb.fromY;
    }

    zFrom--;
    if (zFrom < vb.fromZ) {
      zFrom = vb.fromZ;
    }

    xTo++;
    if (xTo >= vb.toX) {
      xTo = vb.toX - 1;
    }

    yTo++;
    if (yTo >= vb.toY) {
      yTo = vb.toY - 1;
    }

    zTo++;
    if (zTo >= vb.toZ) {
      zTo = vb.toZ - 1;
    }

    for (let x = xFrom; x <= xTo; x++) {
      for (let y = yFrom; y <= yTo; y++) {
        for (let z = zFrom; z <= zTo; z++) {
          const block = this.props.blockVolume.x(x).y(y).z(z);

          this._updateBlockMesh(block, x, y, z);
        }
      }
    }
  }

  _singleSelectMesh(blockMesh: BABYLON.AbstractMesh) {
    if (this._selectedBlockMeshes !== undefined) {
      for (let i = 0; i < this._selectedBlockMeshes.length; i++) {
        this._setBoundingBox(this._selectedBlockMeshes[i], false);
      }
    }

    const newSelection = this._getBlockFromMesh(blockMesh);

    if (newSelection !== undefined) {
      if (
        this._selectedBlockMeshes === undefined ||
        this._selectedBlockMeshes.length !== 1 ||
        this._selectedBlockMeshes[0] !== blockMesh
      ) {
        this._selectedBlockMeshes = [blockMesh];
        this.selectedBlocks = [newSelection];

        if (this.props.onSelectedBlocksChanged !== undefined) {
          this.props.onSelectedBlocksChanged(this.selectedBlocks);
        }

        this._setBoundingBox(blockMesh, true);
      } else if (this._selectedBlockMeshes !== undefined && this._selectedBlockMeshes.length === 1) {
        this._selectedBlockMeshes = undefined;
        blockMesh.showBoundingBox = false;

        this.selectedBlocks = undefined;

        if (this.props.onSelectedBlocksChanged !== undefined) {
          this.props.onSelectedBlocksChanged(this.selectedBlocks);
        }
      }
    }
  }

  _addEnvironment() {
    if (this._scene == null || this.props.blockVolume == null) {
      return;
    }

    if (this.props.viewMode === VolumeEditorViewMode.SingleBlock) {
      return;
    }

    // Add Minecraft-style sky, sun, ground plane, and clouds
    this._createMinecraftEnvironment(this._scene);

    // For Structure mode, add a checkerboard ground platform under the structure
    // This replaces the old gray ground plane which caused z-fighting
    if (this.props.viewMode === VolumeEditorViewMode.Structure) {
      this._createStructureGroundPlatform(this._scene);
    }

    const points: BABYLON.Vector3[] = [
      new BABYLON.Vector3(-1, 0, -0.02),
      new BABYLON.Vector3(this.props.blockVolume.maxX + 1, 0, -0.02),
    ];

    BABYLON.MeshBuilder.CreateLines(
      "bottomBorderNorth",
      {
        points: points,
      },
      this._scene
    );

    const pointsB: BABYLON.Vector3[] = [
      new BABYLON.Vector3(-1, 0, this.props.blockVolume.maxZ + 0.02),
      new BABYLON.Vector3(this.props.blockVolume.maxX + 1, 0, this.props.blockVolume.maxZ + 0.02),
    ];

    BABYLON.MeshBuilder.CreateLines(
      "bottomBorderSouth",
      {
        points: pointsB,
      },
      this._scene
    );

    const pointsC: BABYLON.Vector3[] = [
      new BABYLON.Vector3(-0.02, 0, -1),
      new BABYLON.Vector3(-0.02, 0, this.props.blockVolume.maxZ + 1),
    ];

    BABYLON.MeshBuilder.CreateLines(
      "bottomBorderWest",
      {
        points: pointsC,
      },
      this._scene
    );

    const pointsD: BABYLON.Vector3[] = [
      new BABYLON.Vector3(this.props.blockVolume.maxX + 0.02, 0, -1),
      new BABYLON.Vector3(this.props.blockVolume.maxX + 0.02, 0, this.props.blockVolume.maxZ + 1),
    ];

    BABYLON.MeshBuilder.CreateLines(
      "bottomBorderEast",
      {
        points: pointsD,
      },
      this._scene
    );

    const pointsE: BABYLON.Vector3[] = [
      new BABYLON.Vector3(-1, this.props.blockVolume.maxY + 0.02, -0.02),
      new BABYLON.Vector3(this.props.blockVolume.maxX + 1, this.props.blockVolume.maxY + 0.02, -0.02),
    ];

    BABYLON.MeshBuilder.CreateLines(
      "bottomBorderE",
      {
        points: pointsE,
      },
      this._scene
    );

    const pointsF: BABYLON.Vector3[] = [
      new BABYLON.Vector3(-1, this.props.blockVolume.maxY + 0.02, this.props.blockVolume.maxZ + 0.02),
      new BABYLON.Vector3(
        this.props.blockVolume.maxX + 1,
        this.props.blockVolume.maxY + 0.02,
        this.props.blockVolume.maxZ + 0.02
      ),
    ];

    BABYLON.MeshBuilder.CreateLines(
      "bottomBorderF",
      {
        points: pointsF,
      },
      this._scene
    );

    const pointsG: BABYLON.Vector3[] = [
      new BABYLON.Vector3(-0.02, this.props.blockVolume.maxY + 0.02, -1),
      new BABYLON.Vector3(-0.02, this.props.blockVolume.maxY + 0.02, this.props.blockVolume.maxZ + 1),
    ];

    BABYLON.MeshBuilder.CreateLines(
      "bottomBorderG",
      {
        points: pointsG,
      },
      this._scene
    );

    const pointsH: BABYLON.Vector3[] = [
      new BABYLON.Vector3(this.props.blockVolume.maxX + 0.02, this.props.blockVolume.maxY + 0.02, -1),
      new BABYLON.Vector3(
        this.props.blockVolume.maxX + 0.02,
        this.props.blockVolume.maxY + 0.02,
        this.props.blockVolume.maxZ + 1
      ),
    ];

    BABYLON.MeshBuilder.CreateLines(
      "bottomBorderH",
      {
        points: pointsH,
      },
      this._scene
    );
  }

  _clearAll() {
    if (this._scene == null || this.props.blockVolume == null) {
      return;
    }

    while (this._scene.meshes.length > 0) {
      const mesh = this._scene.meshes[0];
      this._scene.removeMesh(mesh);
      mesh.dispose();
    }

    this._meshes = {};

    this._selectionPlaceholderMesh = undefined;
    this._hoverIndicatorMesh = undefined;
    this.selectedBlocks = undefined;

    this._selectedBlockMeshes = [];
    this._blockMeshes = new Map();
  }

  _ensureSelectionPlaceholderMesh() {
    if (this._scene === null || this.props.blockVolume === null) {
      return;
    }

    if (this._selectionPlaceholderMesh !== undefined) {
      return;
    }

    const faceUV = new Array(6);

    for (var i = 0; i < 6; i++) {
      faceUV[i] = new BABYLON.Vector4(0, 0, 1, 1);
    }

    const options = {
      width: 1,
      height: 1,
      depth: 1,
      faceUV: faceUV,
    };

    this._selectionPlaceholderMesh = BABYLON.MeshBuilder.CreateBox("selectionPlaceholder", options, this._scene);
    const emptyMaterial = new BABYLON.StandardMaterial("selectionPlaceholder", this._scene);
    emptyMaterial.alpha = 0.0;
    emptyMaterial.freeze();

    this._selectionPlaceholderMesh.material = emptyMaterial;

    // Set renderingGroupId on source mesh so instances inherit it
    // (setting renderingGroupId on InstancedMesh has no effect)
    this._selectionPlaceholderMesh.renderingGroupId = 1;

    this._selectionPlaceholderMesh.isVisible = false;
  }

  /**
   * Creates and returns the hover indicator mesh - a wireframe box used to highlight
   * the currently hovered block. This is separate from block meshes to avoid
   * interfering with picking and to simplify the selection model.
   */
  _ensureHoverIndicatorMesh() {
    if (this._scene === null) {
      return;
    }

    if (this._hoverIndicatorMesh !== undefined) {
      return;
    }

    // Create a wireframe box that's slightly larger than a block
    this._hoverIndicatorMesh = BABYLON.MeshBuilder.CreateBox(
      "hoverIndicator",
      { size: 1.02 }, // Slightly larger than 1 to avoid z-fighting
      this._scene
    );

    const hoverMaterial = new BABYLON.StandardMaterial("hoverIndicatorMat", this._scene);
    hoverMaterial.emissiveColor = new BABYLON.Color3(0.33, 0.65, 0.21); // Minecraft green
    hoverMaterial.disableLighting = true;
    hoverMaterial.wireframe = true;

    this._hoverIndicatorMesh.material = hoverMaterial;
    this._hoverIndicatorMesh.renderingGroupId = 2; // Render on top of blocks
    this._hoverIndicatorMesh.isPickable = false; // Don't interfere with picking
    this._hoverIndicatorMesh.isVisible = false; // Hidden until hover
  }

  /**
   * Updates the hover indicator position and visibility.
   * @param visible Whether the indicator should be visible
   * @param x Visual X position (world space)
   * @param y Visual Y position (world space)
   * @param z Visual Z position (world space)
   */
  _updateHoverIndicator(visible: boolean, x?: number, y?: number, z?: number) {
    this._ensureHoverIndicatorMesh();

    if (this._hoverIndicatorMesh) {
      this._hoverIndicatorMesh.isVisible = visible;
      if (visible && x !== undefined && y !== undefined && z !== undefined) {
        this._hoverIndicatorMesh.position.x = x;
        this._hoverIndicatorMesh.position.y = y;
        this._hoverIndicatorMesh.position.z = z;
      }
    }
  }

  /**
   * Calculate the bounding box of all entity meshes in the scene.
   * Returns the center point and dimensions, or undefined if no entity meshes exist.
   */
  _calculateEntityMeshBounds():
    | { centerX: number; centerY: number; centerZ: number; maxDimension: number }
    | undefined {
    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;
    let hasBounds = false;

    for (const mesh of this._entityMeshes.values()) {
      if (mesh) {
        // Get bounding info - computeWorldMatrix ensures world coordinates are current
        mesh.computeWorldMatrix(true);
        const boundingInfo = mesh.getBoundingInfo();
        const boundingBox = boundingInfo.boundingBox;

        minX = Math.min(minX, boundingBox.minimumWorld.x);
        minY = Math.min(minY, boundingBox.minimumWorld.y);
        minZ = Math.min(minZ, boundingBox.minimumWorld.z);
        maxX = Math.max(maxX, boundingBox.maximumWorld.x);
        maxY = Math.max(maxY, boundingBox.maximumWorld.y);
        maxZ = Math.max(maxZ, boundingBox.maximumWorld.z);
        hasBounds = true;

        // Also check child meshes
        for (const child of mesh.getChildMeshes()) {
          child.computeWorldMatrix(true);
          const childBoundingInfo = child.getBoundingInfo();
          const childBoundingBox = childBoundingInfo.boundingBox;

          minX = Math.min(minX, childBoundingBox.minimumWorld.x);
          minY = Math.min(minY, childBoundingBox.minimumWorld.y);
          minZ = Math.min(minZ, childBoundingBox.minimumWorld.z);
          maxX = Math.max(maxX, childBoundingBox.maximumWorld.x);
          maxY = Math.max(maxY, childBoundingBox.maximumWorld.y);
          maxZ = Math.max(maxZ, childBoundingBox.maximumWorld.z);
        }
      }
    }

    if (!hasBounds) {
      return undefined;
    }

    const sizeX = maxX - minX;
    const sizeY = maxY - minY;
    const sizeZ = maxZ - minZ;

    return {
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2,
      centerZ: (minZ + maxZ) / 2,
      maxDimension: Math.max(sizeX, sizeY, sizeZ),
    };
  }

  /**
   * Calculate bounds from entity custom model's visible_bounds properties.
   * This is used as a fallback when entity meshes haven't been created yet.
   * The visible_bounds in geometry definitions tell us where the model geometry is centered.
   *
   * IMPORTANT: Geometry visible_bounds are in Minecraft geometry units (16 units = 1 block).
   * Entity locations are in blocks. We must convert the offset from geometry units to blocks.
   */
  _calculateModelBoundsFromEntities():
    | { centerX: number; centerY: number; centerZ: number; maxDimension: number }
    | undefined {
    if (!this.props.entities || this.props.entities.length === 0) {
      return undefined;
    }

    for (const entity of this.props.entities) {
      if (entity.customModel) {
        const model = entity.customModel;
        // Use index 0 (default geometry) for visible_bounds
        const defIndex = 0;

        const width = model.getVisibleBoundsWidth(defIndex);
        const height = model.getVisibleBoundsHeight(defIndex);
        const offset = model.getVisibleBoundsOffset(defIndex);

        if (width !== undefined && height !== undefined) {
          // visible_bounds are in geometry units (16 units = 1 block)
          // Convert to block units for camera positioning
          const UNITS_PER_BLOCK = 16;

          // Entity position is where the model is placed in world space (in blocks)
          const entityX = entity.location?.x ?? 0;
          const entityY = entity.location?.y ?? 0;
          const entityZ = entity.location?.z ?? 0;

          // Offset is in geometry units [x, y, z] where y is typically the center height
          // Convert from geometry units to blocks
          const offsetX = offset ? offset[0] / UNITS_PER_BLOCK : 0;
          const offsetY = offset ? offset[1] / UNITS_PER_BLOCK : height / (2 * UNITS_PER_BLOCK);
          const offsetZ = offset ? offset[2] / UNITS_PER_BLOCK : 0;

          // Width and height are also in geometry units, convert to blocks
          const widthInBlocks = width / UNITS_PER_BLOCK;
          const heightInBlocks = height / UNITS_PER_BLOCK;

          return {
            centerX: entityX + offsetX,
            centerY: entityY + offsetY,
            centerZ: entityZ + offsetZ,
            maxDimension: Math.max(widthInBlocks, heightInBlocks),
          };
        }
      }
    }

    return undefined;
  }

  _addEntities() {
    if (this._scene === null || !this.props.entities) {
      return;
    }

    for (const entity of this.props.entities) {
      this._updateEntityMesh(entity);
    }
  }

  _updateEntityMesh(entity: Entity) {
    const entityId = entity.id;
    let x = entity.location.x;
    let y = entity.location.y;
    let z = entity.location.z;
    const posName = x + "." + y + "." + z;

    if (this._scene === null || this._isOutOfBounds(x, y, z)) {
      return;
    }

    let maxX = 20;

    if (this.props.blockVolume) {
      maxX = this.props.blockVolume.maxX;
    }

    const existingMesh = this._entityMeshes.get(entityId);

    if (existingMesh !== undefined) {
      const meshes = existingMesh.getChildMeshes();

      if (meshes.length > 0) {
        for (let i = 0; i < meshes.length; i++) {
          const childMesh = meshes[i];

          this._scene.removeMesh(childMesh, true);
          childMesh.dispose();
        }
      }

      this._scene.removeMesh(existingMesh, true);
      existingMesh.dispose();
      this._entityMeshes.set(posName, undefined);
    }

    // Check if we have a custom model with either texture data or texture URL
    const hasTexture = entity.customTextureData || entity.customTextureUrl;
    if (entity.customModel && hasTexture && this._modelMeshFactory !== undefined) {
      let geo = entity.customModel.defaultGeometry;

      if (geo) {
        const name = "e" + entityId;
        // Include texture data length and first few bytes in hash to differentiate entities with different textures
        let textureHash: string;
        if (entity.customTextureData && entity.customTextureData.length > 0) {
          textureHash =
            entity.customTextureData.length +
            "_" +
            (entity.customTextureData.length > 0 ? entity.customTextureData[0] : 0) +
            "_" +
            (entity.customTextureData.length > 100 ? entity.customTextureData[100] : 0) +
            "_" +
            (entity.customTextureData.length > 500 ? entity.customTextureData[500] : 0);
        } else if (entity.customTextureUrl) {
          textureHash = "url_" + entity.customTextureUrl;
        } else {
          textureHash = "empty";
        }
        const visualHash = entityId + "_" + textureHash;

        if (visualHash !== "") {
          let sourceMesh = this._meshes[visualHash];
          let box: BABYLON.AbstractMesh | null = null;

          // use the following line to disable caching, to debug caching issues
          //    if (true) {
          if (!sourceMesh) {
            sourceMesh = this._modelMeshFactory.createMesh(
              name,
              geo,
              entity.id,
              entity.customTextureData,
              entity.customTextureUrl
            );

            // Apply tint color if present (e.g., sheep wool overlay)
            if (sourceMesh && entity.customTintColor) {
              this._modelMeshFactory.applyTintColor(sourceMesh, entity.customTintColor);
            }

            // Disable alpha for entities with near-transparent body pixels (e.g., sheep)
            if (sourceMesh && entity.customIgnoreAlpha) {
              this._modelMeshFactory.applyIgnoreAlpha(sourceMesh);
            }

            this._meshes[visualHash] = sourceMesh;

            if (sourceMesh) {
              sourceMesh.position.x = 10000;
              sourceMesh.freezeNormals();
              sourceMesh.freezeWorldMatrix();
            }
            //    sourceMesh.convertToUnIndexedMesh();
          }

          if (sourceMesh) {
            box = sourceMesh.clone(name + ";");

            // Unfreeze world matrix for the cloned mesh and its children
            // so they can be properly positioned (source mesh is frozen at x=10000)
            box.unfreezeWorldMatrix();
            for (const child of box.getChildMeshes()) {
              child.unfreezeWorldMatrix();
              // Rename child meshes to include correct coordinates
              // Source children have names like "bX.Y.Z|face", clone them with correct coords
              const pipeIndex = child.name.indexOf("|");
              if (pipeIndex >= 0) {
                // Keep the face suffix (|b, |f, |l, |r, |u, |d) but update coordinates
                const faceSuffix = child.name.substring(pipeIndex);
                child.name = name + faceSuffix;
              }
            }

            box.position.x = maxX - (x + 0.5);
            box.position.y = y + 0.5;
            box.position.z = z + 0.5;

            if (!Utilities.isUsableAsObjectKey(posName)) {
              throw new Error();
            }

            this._entityMeshes.set(posName, box);

            this._addBlockEvents(box);
          }
        }
      }
    }
  }

  _addBlocks() {
    if (this._scene === null || this.props.blockVolume === null) {
      return;
    }

    const bc = this.props.blockVolume;

    this._ensureSelectionPlaceholderMesh();

    const vb = this.effectiveViewBounds;

    if (bc != null) {
      for (let x = vb.fromX; x < vb.toX; x++) {
        const xSlice = bc.x(x);

        for (let y = vb.fromY; y < vb.toY; y++) {
          const ySlice = xSlice.y(y);

          for (let z = vb.fromZ; z < vb.toZ; z++) {
            const block = ySlice.z(z);

            this._updateBlockMesh(block, x, y, z);
          }
        }
      }
    }
  }

  /**
   * Checks if a position is within the structure bounds (0 to maxX-1, etc.).
   * Used for validating hover/selection targets.
   */
  _isWithinStructureBounds(x: number, y: number, z: number): boolean {
    if (this.props.blockVolume === undefined) {
      return false;
    }

    return (
      x >= 0 &&
      x < this.props.blockVolume.maxX &&
      y >= 0 &&
      y < this.props.blockVolume.maxY &&
      z >= 0 &&
      z < this.props.blockVolume.maxZ
    );
  }

  _isOutOfBounds(x: number, y: number, z: number) {
    const vb = this.props.viewBounds;

    if (vb !== undefined) {
      if (x < vb.fromX || x >= vb.toX || y < vb.fromY || y >= vb.toY || z < vb.fromZ || z >= vb.toZ) {
        return true;
      }

      return false;
    } else if (this.props.blockVolume !== undefined) {
      if (x >= this.props.blockVolume.maxX) {
        return true;
      }

      if (y >= this.props.blockVolume.maxY) {
        return true;
      }

      if (z >= this.props.blockVolume.maxZ) {
        return true;
      }

      return false;
    }

    return true;
  }

  /**
   * Updates block mesh using a specific BlockVolume instance.
   * This avoids issues where props.blockVolume might be stale due to React re-renders.
   */
  _updateBlockMeshDirect(blockVolume: BlockVolume, x: number, y: number, z: number) {
    // First, clear surroundings cache for the target block and all neighbors
    // so that the appearance hash is calculated fresh
    const vb = this.effectiveViewBounds;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          const nx = x + dx;
          const ny = y + dy;
          const nz = z + dz;
          if (nx >= vb.fromX && nx < vb.toX && ny >= vb.fromY && ny < vb.toY && nz >= vb.fromZ && nz < vb.toZ) {
            const blockToClear = blockVolume.x(nx).y(ny).z(nz);
            blockToClear.clearSurroundings();
          }
        }
      }
    }

    const block = blockVolume.x(x).y(y).z(z);
    this._updateBlockMesh(block, x, y, z);

    // Also update surrounding blocks (they may need visual updates due to face culling)
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          if (dx === 0 && dy === 0 && dz === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          const nz = z + dz;
          if (nx >= vb.fromX && nx < vb.toX && ny >= vb.fromY && ny < vb.toY && nz >= vb.fromZ && nz < vb.toZ) {
            const neighborBlock = blockVolume.x(nx).y(ny).z(nz);
            this._updateBlockMesh(neighborBlock, nx, ny, nz);
          }
        }
      }
    }
  }

  _updateBlockMesh(block: Block, x: number, y: number, z: number) {
    const blockId = block.shortTypeId;
    const posName = x + "." + y + "." + z;

    if (this._scene === null || this._isOutOfBounds(x, y, z)) {
      return;
    }

    let maxX = 20;

    if (this.props.blockVolume) {
      maxX = this.props.blockVolume.maxX;
    }

    const existingMesh = this._blockMeshes.get(posName);

    if (existingMesh !== undefined) {
      const meshes = existingMesh.getChildMeshes();

      if (meshes.length > 0) {
        for (let i = 0; i < meshes.length; i++) {
          const childMesh = meshes[i];

          this._scene.removeMesh(childMesh, true);
          childMesh.dispose();
        }
      }

      this._scene.removeMesh(existingMesh, true);
      existingMesh.dispose();
      this._blockMeshes.set(posName, undefined);
    }

    if (!block.isCovered && this._blockMeshFactory !== undefined) {
      if (blockId !== undefined && blockId !== "air") {
        const name = "b" + posName;
        let visualHash = "";
        try {
          visualHash = this._blockMeshFactory.getAppearanceHash(block);
        } catch (e) {
          // Error getting appearance hash
        }

        if (visualHash !== "") {
          let sourceMesh = this._meshes[visualHash];
          let box: BABYLON.AbstractMesh | null = null;

          // use the following line to disable caching, to debug caching issues
          //    if (true) {
          if (sourceMesh == null) {
            sourceMesh = this._blockMeshFactory.createMesh(name, block);
            this._meshes[visualHash] = sourceMesh;

            if (sourceMesh) {
              sourceMesh.position.x = 10000;
              sourceMesh.freezeNormals();
              sourceMesh.freezeWorldMatrix();
            }
            //    sourceMesh.convertToUnIndexedMesh();
          }

          if (sourceMesh) {
            box = sourceMesh.clone(name + ";");

            // Unfreeze world matrix for the cloned mesh and its children
            // so they can be properly positioned (source mesh is frozen at x=10000)
            box.unfreezeWorldMatrix();

            // Create metadata for this block mesh (avoids fragile name parsing)
            const blockMetadata: IBlockMeshMetadata = {
              blockX: x,
              blockY: y,
              blockZ: z,
              isSolid: true,
              blockType: blockId,
            };
            box.metadata = blockMetadata;

            for (const child of box.getChildMeshes()) {
              child.unfreezeWorldMatrix();
              // Propagate metadata to child meshes so they can be identified too
              child.metadata = blockMetadata;
              // Rename child meshes to include correct coordinates
              // Source children have names like "bX.Y.Z|face", clone them with correct coords
              const pipeIndex = child.name.indexOf("|");
              if (pipeIndex >= 0) {
                // Keep the face suffix (|b, |f, |l, |r, |u, |d) but update coordinates
                const faceSuffix = child.name.substring(pipeIndex);
                child.name = name + faceSuffix;
              }
            }

            box.position.x = maxX - (x + 0.5);
            box.position.y = y + 0.5;
            box.position.z = z + 0.5;

            if (!Utilities.isUsableAsObjectKey(posName)) {
              throw new Error();
            }
            this._blockMeshes.set(posName, box);

            this._addBlockEvents(box);
          }
        }
      } else if (
        (block.isTouchingOtherBlock || y === 0) &&
        this._selectionPlaceholderMesh !== undefined &&
        this.props.showToolbar !== false
      ) {
        const name = "p" + posName;

        const box = this._selectionPlaceholderMesh.createInstance(name);

        // Create metadata for this placeholder mesh (air block adjacent to solid)
        const blockMetadata: IBlockMeshMetadata = {
          blockX: x,
          blockY: y,
          blockZ: z,
          isSolid: false,
          blockType: "minecraft:air",
        };
        box.metadata = blockMetadata;

        box.position.x = maxX - (x + 0.5);
        box.position.y = y + 0.5;
        box.position.z = z + 0.5;

        this._blockMeshes.set(posName, box);

        this._addBlockEvents(box);
      }
    } else {
    }
  }

  _addBlockEvents(box: BABYLON.AbstractMesh) {
    if (this._scene == null) {
      return;
    }

    // Set rendering group to render on top of ground plane
    // Skip for instanced meshes - they inherit from source mesh
    if (!(box instanceof BABYLON.InstancedMesh)) {
      box.renderingGroupId = 1;
    }

    const meshes = box.getChildMeshes();

    if (meshes.length > 0) {
      for (let i = 0; i < meshes.length; i++) {
        this._addBlockEvents(meshes[i]);
      }

      return;
    }

    box.actionManager = new BABYLON.ActionManager(this._scene);

    if (box.actionManager != null) {
      box.actionManager.registerAction(
        new BABYLON.ExecuteCodeAction(
          {
            trigger: BABYLON.ActionManager.OnPointerOverTrigger,
          },
          this._handleBlockPointerOver
        )
      );

      box.actionManager.registerAction(
        new BABYLON.ExecuteCodeAction(
          {
            trigger: BABYLON.ActionManager.OnPointerOutTrigger,
          },
          this._handleBlockPointerOut
        )
      );

      box.actionManager.registerAction(
        new BABYLON.ExecuteCodeAction(
          {
            trigger: BABYLON.ActionManager.OnPickTrigger,
          },
          this._handleBlockClick
        )
      );
    }
  }

  _toggleHelp = () => {
    this.setState({ showHelp: !this.state?.showHelp });
  };

  _formatBlockType(blockType: string | undefined): string {
    if (!blockType) return "";
    // Remove minecraft: prefix and format nicely
    let formatted = blockType.replace(/^minecraft:/, "");
    // Replace underscores with spaces and capitalize
    formatted = formatted
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
    return formatted;
  }

  /**
   * Handles selection mode changes from the toolbar.
   */
  _handleSelectionModeChange = (mode: SelectionMode) => {
    this._deselectAll();
    this.setState({ selectionMode: mode });
  };

  /**
   * Handles active tool changes from the vertical toolbar.
   */
  _handleToolChange = (tool: EditorTool) => {
    const prevTool = this.state?.activeTool;

    // Toggle panel collapse when clicking the already-active tool
    if (prevTool === tool) {
      this.setState({ panelCollapsed: !this.state?.panelCollapsed });
      return;
    }

    // Deactivate previous tool if it's a pluggable tool
    if (prevTool !== undefined) {
      const prevPluggableTool = this._tools.get(prevTool);
      if (prevPluggableTool) {
        prevPluggableTool.deactivate();
      }
    }

    this.setState({ activeTool: tool, panelCollapsed: false });

    // Activate new tool if it's a pluggable tool
    const newPluggableTool = this._tools.get(tool);
    if (newPluggableTool) {
      newPluggableTool.activate(this._getToolContext());
    }

    // Clear selection when switching tools
    if (tool !== EditorTool.Selection) {
      this._deselectAll();
    }
    // Clear brush preview when switching away from brush (legacy, kept for compatibility)
    if (tool !== EditorTool.Brush) {
      this._clearBrushPreview();
    }
    // Clear pencil preview when switching away from pencil (legacy, kept for compatibility)
    if (tool !== EditorTool.Pencil) {
      this._clearPencilPreview();
    }
    // Clear inspected block when switching away from Block Inspector
    if (tool !== EditorTool.BlockInspector) {
      this._clearInspectedBlock();
    }
  };

  /**
   * Handles brush shape changes.
   */
  _handleBrushShapeChange = (shape: BrushShape) => {
    this.setState({ brushShape: shape });
    this._updateBrushPreview();
  };

  /**
   * Handles brush size changes.
   */
  _handleBrushSizeChange = (axis: "x" | "y" | "z", size: number) => {
    const clampedSize = Math.max(1, Math.min(16, size));
    if (this.state.brushUniform) {
      this.setState({
        brushSizeX: clampedSize,
        brushSizeY: clampedSize,
        brushSizeZ: clampedSize,
      });
    } else {
      if (axis === "x") this.setState({ brushSizeX: clampedSize });
      else if (axis === "y") this.setState({ brushSizeY: clampedSize });
      else this.setState({ brushSizeZ: clampedSize });
    }
    this._updateBrushPreview();
  };

  /**
   * Handles brush uniform toggle.
   */
  _handleBrushUniformChange = (uniform: boolean) => {
    this.setState({ brushUniform: uniform });
    if (uniform) {
      // When enabling uniform, set all axes to the X size
      this.setState({
        brushSizeY: this.state.brushSizeX,
        brushSizeZ: this.state.brushSizeX,
      });
    }
  };

  /**
   * Handles brush block type changes.
   */
  _handleBrushBlockTypeChange = (blockType: string) => {
    this.setState({ brushBlockType: blockType });
  };

  /**
   * Handles brush target changes.
   */
  _handleBrushTargetChange = (target: CursorTarget) => {
    this.setState({ brushTarget: target });
  };

  // Brush preview mesh
  private _brushPreviewMesh: BABYLON.Mesh | undefined;

  /**
   * Clears the brush preview mesh.
   */
  _clearBrushPreview() {
    if (this._brushPreviewMesh && this._scene) {
      this._scene.removeMesh(this._brushPreviewMesh);
      this._brushPreviewMesh.dispose();
      this._brushPreviewMesh = undefined;
    }
  }

  /**
   * Updates the brush preview mesh based on current hover position and brush settings.
   */
  _updateBrushPreview() {
    if (!this._scene || this.state?.activeTool !== EditorTool.Brush) {
      this._clearBrushPreview();
      return;
    }

    const hoverX = this.state.hoverX;
    const hoverY = this.state.hoverY;
    const hoverZ = this.state.hoverZ;

    if (hoverX === undefined || hoverY === undefined || hoverZ === undefined) {
      this._clearBrushPreview();
      return;
    }

    // Calculate brush position (centered on hover point for brush target Adjacent, on the block for Block)
    let centerX = hoverX;
    let centerY = hoverY;
    let centerZ = hoverZ;

    // Adjust for Adjacent target (place above the hovered block)
    if (this.state.brushTarget === CursorTarget.Adjacent) {
      centerY += 1;
    }

    // Create or update brush preview mesh
    const sizeX = this.state.brushSizeX;
    const sizeY = this.state.brushSizeY;
    const sizeZ = this.state.brushSizeZ;

    // Clear existing preview
    this._clearBrushPreview();

    // Create a box showing the brush area
    this._brushPreviewMesh = BABYLON.MeshBuilder.CreateBox(
      "brushPreview",
      { width: sizeX, height: sizeY, depth: sizeZ },
      this._scene
    );

    // Position at center of brush area
    this._brushPreviewMesh.position = new BABYLON.Vector3(centerX + 0.5, centerY + sizeY / 2 - 0.5, centerZ + 0.5);

    // Create semi-transparent blue material
    const material = new BABYLON.StandardMaterial("brushPreviewMat", this._scene);
    material.diffuseColor = new BABYLON.Color3(0.3, 0.5, 1.0);
    material.alpha = 0.3;
    material.backFaceCulling = false;
    this._brushPreviewMesh.material = material;

    // Enable edge rendering
    this._brushPreviewMesh.enableEdgesRendering();
    this._brushPreviewMesh.edgesWidth = 2.0;
    this._brushPreviewMesh.edgesColor = new BABYLON.Color4(0.4, 0.6, 1.0, 0.9);
  }

  /**
   * Paints blocks at the current brush position.
   */
  _paintBrush() {
    if (!this.props.blockVolume || this.state?.activeTool !== EditorTool.Brush) {
      return;
    }

    const hoverX = this.state.hoverX;
    const hoverY = this.state.hoverY;
    const hoverZ = this.state.hoverZ;

    if (hoverX === undefined || hoverY === undefined || hoverZ === undefined) {
      return;
    }

    // Calculate brush bounds
    let centerX = hoverX;
    let centerY = hoverY;
    let centerZ = hoverZ;

    // Adjust for Adjacent target
    if (this.state.brushTarget === CursorTarget.Adjacent) {
      centerY += 1;
    }

    const halfX = Math.floor(this.state.brushSizeX / 2);
    const halfY = Math.floor(this.state.brushSizeY / 2);
    const halfZ = Math.floor(this.state.brushSizeZ / 2);

    const fromX = centerX - halfX;
    const fromY = centerY;
    const fromZ = centerZ - halfZ;
    const toX = fromX + this.state.brushSizeX - 1;
    const toY = fromY + this.state.brushSizeY - 1;
    const toZ = fromZ + this.state.brushSizeZ - 1;

    // Begin undo action for brush painting
    const brushDesc = `Brush: ${this.state.brushBlockType.replace("minecraft:", "")}`;
    this._undoManager.beginAction(VolumeActionType.Brush, brushDesc);

    // First pass: record block states BEFORE painting
    for (let x = fromX; x <= toX; x++) {
      for (let y = fromY; y <= toY; y++) {
        for (let z = fromZ; z <= toZ; z++) {
          // Check bounds
          if (
            x < 0 ||
            y < 0 ||
            z < 0 ||
            x >= this.props.blockVolume.maxX ||
            y >= this.props.blockVolume.maxY ||
            z >= this.props.blockVolume.maxZ
          ) {
            continue;
          }

          if (this._isInBrushShape(x, y, z, fromX, fromY, fromZ, toX, toY, toZ)) {
            this._undoManager.recordBlockBefore(this.props.blockVolume, x, y, z);
          }
        }
      }
    }

    // Second pass: paint blocks and record AFTER states
    for (let x = fromX; x <= toX; x++) {
      for (let y = fromY; y <= toY; y++) {
        for (let z = fromZ; z <= toZ; z++) {
          // Check bounds
          if (
            x < 0 ||
            y < 0 ||
            z < 0 ||
            x >= this.props.blockVolume.maxX ||
            y >= this.props.blockVolume.maxY ||
            z >= this.props.blockVolume.maxZ
          ) {
            continue;
          }

          if (this._isInBrushShape(x, y, z, fromX, fromY, fromZ, toX, toY, toZ)) {
            // Set block type using BlockVolume's x().y().z() chain
            const block = this.props.blockVolume.x(x).y(y).z(z);
            if (block) {
              block.typeName = this.state.brushBlockType;
            }
            this._undoManager.recordBlockAfter(this.props.blockVolume, x, y, z);
          }
        }
      }
    }

    // Finalize undo action
    this._undoManager.endAction();
  }

  /**
   * Checks if a position is within the current brush shape.
   */
  _isInBrushShape(
    x: number,
    y: number,
    z: number,
    fromX: number,
    fromY: number,
    fromZ: number,
    toX: number,
    toY: number,
    toZ: number
  ): boolean {
    const sizeX = toX - fromX + 1;
    const sizeY = toY - fromY + 1;
    const sizeZ = toZ - fromZ + 1;

    // Normalized coordinates (0 to 1 range)
    const nx = (x - fromX + 0.5) / sizeX;
    const ny = (y - fromY + 0.5) / sizeY;
    const nz = (z - fromZ + 0.5) / sizeZ;

    // Centered coordinates (-0.5 to 0.5 range)
    const cx = nx - 0.5;
    const cy = ny - 0.5;
    const cz = nz - 0.5;

    switch (this.state.brushShape) {
      case BrushShape.SingleBlock:
        // Only the center block
        return x === Math.floor((fromX + toX) / 2) && y === fromY && z === Math.floor((fromZ + toZ) / 2);

      case BrushShape.Cuboid:
        // All blocks in the box
        return true;

      case BrushShape.Ellipsoid:
        // Check if point is inside ellipsoid
        return cx * cx * 4 + cy * cy * 4 + cz * cz * 4 <= 1;

      case BrushShape.Cylinder:
        // Cylinder along Y axis
        return cx * cx * 4 + cz * cz * 4 <= 1;

      case BrushShape.Cone:
        // Cone pointing up
        const coneRadius = 1 - ny; // Radius decreases with height
        return cx * cx * 4 + cz * cz * 4 <= coneRadius * coneRadius;

      case BrushShape.Pyramid:
        // Pyramid with square base
        const pyramidRadius = 1 - ny;
        return Math.abs(cx) * 2 <= pyramidRadius && Math.abs(cz) * 2 <= pyramidRadius;

      default:
        return true;
    }
  }

  /**
   * Handles cursor input mode changes.
   */
  _handleInputModeChange = (mode: CursorInputMode) => {
    this.setState({ cursorInputMode: mode });
  };

  /**
   * Handles cursor target changes.
   */
  _handleTargetChange = (target: CursorTarget) => {
    this.setState({ cursorTarget: target });
  };

  // ==================== PENCIL TOOL ====================
  // @see https://learn.microsoft.com/en-us/minecraft/creator/documents/bedrockeditor/editorpenciltool

  // Pencil preview mesh for showing where block will be placed
  private _pencilPreviewMesh: BABYLON.Mesh | undefined;

  /**
   * Handles pencil mode changes (Draw/Erase).
   */
  _handlePencilModeChange = (mode: PencilMode) => {
    this.setState({ pencilMode: mode });
    this._updatePencilPreview();
  };

  /**
   * Handles pencil block facing changes (ByCamera/Default).
   */
  _handlePencilBlockFacingChange = (facing: PencilBlockFacing) => {
    this.setState({ pencilBlockFacing: facing });
  };

  /**
   * Handles pencil block type changes.
   */
  _handlePencilBlockTypeChange = (blockType: string) => {
    this.setState({ pencilBlockType: blockType });
  };

  /**
   * Handles pencil offset changes.
   */
  _handlePencilOffsetChange = (axis: "x" | "y" | "z", offset: number) => {
    const clampedOffset = Math.max(-10, Math.min(10, offset));
    if (axis === "x") this.setState({ pencilOffsetX: clampedOffset });
    else if (axis === "y") this.setState({ pencilOffsetY: clampedOffset });
    else this.setState({ pencilOffsetZ: clampedOffset });
    this._updatePencilPreview();
  };

  /**
   * Handles pencil cursor target changes.
   */
  _handlePencilCursorTargetChange = (target: CursorTarget) => {
    this.setState({ pencilCursorTarget: target });
    this._updatePencilPreview();
  };

  /**
   * Clears the pencil preview mesh.
   */
  _clearPencilPreview() {
    if (this._pencilPreviewMesh) {
      this._pencilPreviewMesh.dispose();
      this._pencilPreviewMesh = undefined;
    }
    // Clear target when clearing preview
    this._pencilTargetX = undefined;
    this._pencilTargetY = undefined;
    this._pencilTargetZ = undefined;
  }

  /**
   * Updates the pencil preview mesh to show where the block will be placed.
   *
   * PENCIL TOOL ADJACENT MODE LOGIC:
   * ================================
   * When pencilCursorTarget === CursorTarget.Adjacent:
   * - If hovering over a SOLID block (hoverBlockType is defined):
   *   Use the pre-computed face offsets (hoverFaceOffsetX/Y/Z) to place the new block
   *   adjacent to the face the user is pointing at.
   * - If hovering over an AIR/placeholder block (hoverBlockType is undefined):
   *   Place directly at the hovered position (no face offset). This allows users to
   *   click on empty spaces to fill them, rather than trying to find an adjacent face.
   *
   * The face offsets are computed in _handleBlockPointerOver() during the hover event
   * and stored in state. We use these pre-computed values rather than re-picking here
   * to ensure consistency between what the preview shows and where the block is placed.
   */
  _updatePencilPreview() {
    if (!this._scene || this.state?.activeTool !== EditorTool.Pencil) {
      return;
    }

    const hoverX = this.state?.hoverX;
    const hoverY = this.state?.hoverY;
    const hoverZ = this.state?.hoverZ;

    if (hoverX === undefined || hoverY === undefined || hoverZ === undefined) {
      this._clearPencilPreview();
      return;
    }

    // Calculate target position with offset
    let targetX = hoverX + (this.state?.pencilOffsetX ?? 0);
    let targetY = hoverY + (this.state?.pencilOffsetY ?? 0);
    let targetZ = hoverZ + (this.state?.pencilOffsetZ ?? 0);

    // Adjust for Adjacent target mode
    // Only apply face offsets if we're hovering over a solid block (not placeholder/air)
    // If hovering over air/placeholder, place directly at that position
    if (this.state?.pencilCursorTarget === CursorTarget.Adjacent && this.state?.hoverIsSolidBlock) {
      // Use the pre-computed face offsets from _handleBlockPointerOver
      // This ensures the preview and paint use the same coordinates
      const adjacentX = targetX + (this.state?.hoverFaceOffsetX ?? 0);
      const adjacentY = targetY + (this.state?.hoverFaceOffsetY ?? 0);
      const adjacentZ = targetZ + (this.state?.hoverFaceOffsetZ ?? 0);

      // Only apply face offset if the adjacent position is within bounds
      // Otherwise, fall back to targeting the hovered block itself (allows edge interaction)
      if (this._isWithinStructureBounds(adjacentX, adjacentY, adjacentZ)) {
        targetX = adjacentX;
        targetY = adjacentY;
        targetZ = adjacentZ;
      }
      // If adjacent is out of bounds, keep targetX/Y/Z as the hovered block position
    }

    // Check if target position is within structure bounds
    // Clear preview if target would be out of bounds (e.g., offset pushed it out)
    if (!this._isWithinStructureBounds(targetX, targetY, targetZ)) {
      this._clearPencilPreview();
      return;
    }

    // Create or update preview mesh
    if (!this._pencilPreviewMesh) {
      this._pencilPreviewMesh = BABYLON.MeshBuilder.CreateBox("pencilPreview", { size: 1 }, this._scene);

      const material = new BABYLON.StandardMaterial("pencilPreviewMat", this._scene);
      const isErase = this.state?.pencilMode === PencilMode.Erase;
      material.diffuseColor = isErase
        ? new BABYLON.Color3(1.0, 0.3, 0.3) // Red for erase
        : new BABYLON.Color3(0.4, 0.8, 0.4); // Green for draw
      material.alpha = 0.4;
      material.backFaceCulling = false;
      this._pencilPreviewMesh.material = material;

      // Enable edge rendering
      this._pencilPreviewMesh.enableEdgesRendering();
      this._pencilPreviewMesh.edgesWidth = 2.5;
      this._pencilPreviewMesh.edgesColor = isErase
        ? new BABYLON.Color4(1.0, 0.2, 0.2, 1.0)
        : new BABYLON.Color4(0.3, 0.7, 0.3, 1.0);

      // Ensure preview is not pickable
      this._pencilPreviewMesh.isPickable = false;
    } else {
      // Update material color based on mode
      const material = this._pencilPreviewMesh.material as BABYLON.StandardMaterial;
      const isErase = this.state?.pencilMode === PencilMode.Erase;
      if (material) {
        material.diffuseColor = isErase ? new BABYLON.Color3(1.0, 0.3, 0.3) : new BABYLON.Color3(0.4, 0.8, 0.4);
      }
      this._pencilPreviewMesh.edgesColor = isErase
        ? new BABYLON.Color4(1.0, 0.2, 0.2, 1.0)
        : new BABYLON.Color4(0.3, 0.7, 0.3, 1.0);
    }

    // Position the preview - need to flip X to match visual coordinates
    // Visual X is: maxX - (dataX + 0.5), so we need to do the same transform
    let maxX = 20;
    if (this.props.blockVolume) {
      maxX = this.props.blockVolume.maxX;
    }
    this._pencilPreviewMesh.position.x = maxX - (targetX + 0.5);
    this._pencilPreviewMesh.position.y = targetY + 0.5;
    this._pencilPreviewMesh.position.z = targetZ + 0.5;

    // Store the target position in instance variables (synchronous, not state)
    // so _paintPencil uses exactly the same coordinates
    this._pencilTargetX = targetX;
    this._pencilTargetY = targetY;
    this._pencilTargetZ = targetZ;
  }

  /**
   * Paints (places or erases) a single block at the pencil position.
   * @see https://learn.microsoft.com/en-us/minecraft/creator/documents/bedrockeditor/editorpenciltool
   */
  _paintPencil() {
    if (!this.props.blockVolume || this.state?.activeTool !== EditorTool.Pencil) {
      return;
    }

    // Use the pre-computed target position from instance variables (set by _updatePencilPreview)
    // This ensures we paint at exactly the same position the preview is showing
    // Using instance variables instead of state because setState is async
    const targetX = this._pencilTargetX;
    const targetY = this._pencilTargetY;
    const targetZ = this._pencilTargetZ;

    if (targetX === undefined || targetY === undefined || targetZ === undefined) {
      return;
    }

    // Check bounds
    if (
      targetX < 0 ||
      targetY < 0 ||
      targetZ < 0 ||
      targetX >= this.props.blockVolume.maxX ||
      targetY >= this.props.blockVolume.maxY ||
      targetZ >= this.props.blockVolume.maxZ
    ) {
      return;
    }

    // Get the block at target position
    const block = this.props.blockVolume.x(targetX).y(targetY).z(targetZ);
    if (!block) {
      return;
    }

    // Begin undo action for pencil operation
    const isErase = this.state?.pencilMode === PencilMode.Erase;
    const blockType = isErase ? "air" : (this.state?.pencilBlockType ?? "minecraft:stone").replace("minecraft:", "");
    const pencilDesc = isErase ? `Erase block` : `Pencil: ${blockType}`;
    this._undoManager.beginAction(VolumeActionType.Pencil, pencilDesc);

    // Record block state BEFORE modification
    this._undoManager.recordBlockBefore(this.props.blockVolume, targetX, targetY, targetZ);

    // Draw or Erase based on mode
    if (isErase) {
      // Erase: set block to air
      block.typeName = "minecraft:air";
    } else {
      // Draw: set block to selected type
      block.typeName = this.state?.pencilBlockType ?? "minecraft:stone";
    }

    // Record block state AFTER modification
    this._undoManager.recordBlockAfter(this.props.blockVolume, targetX, targetY, targetZ);

    // Finalize undo action
    this._undoManager.endAction();

    // Force visual update - pass the blockVolume directly to avoid props issues
    this._updateBlockMeshDirect(this.props.blockVolume, targetX, targetY, targetZ);
  }

  // ==================== END PENCIL TOOL ====================

  // ==================== BLOCK INSPECTOR TOOL ====================
  // @see https://learn.microsoft.com/en-us/minecraft/creator/documents/bedrockeditor/editorblockinspector

  /**
   * Clears the currently inspected block.
   */
  _clearInspectedBlock() {
    this.setState({
      inspectedBlockX: undefined,
      inspectedBlockY: undefined,
      inspectedBlockZ: undefined,
      inspectedBlockType: undefined,
      inspectedBlockProperties: undefined,
    });
  }

  /**
   * Inspects the block at the given coordinates.
   * Sets the inspected block state with position, type, and properties.
   */
  _inspectBlockAt(x: number, y: number, z: number) {
    if (!this.props.blockVolume) {
      return;
    }

    // Check bounds
    if (
      x < 0 ||
      y < 0 ||
      z < 0 ||
      x >= this.props.blockVolume.maxX ||
      y >= this.props.blockVolume.maxY ||
      z >= this.props.blockVolume.maxZ
    ) {
      return;
    }

    const block = this.props.blockVolume.x(x).y(y).z(z);
    if (!block) {
      return;
    }

    // Extract block properties
    const properties: { [key: string]: string | number | boolean } = {};
    for (const propName in block.properties) {
      const prop = block.properties[propName];
      if (prop && prop.value !== undefined) {
        const val = prop.value;
        // Convert bigint to number, skip arrays
        if (typeof val === "bigint") {
          properties[propName] = Number(val);
        } else if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
          properties[propName] = val;
        }
      }
    }

    this.setState({
      inspectedBlockX: x,
      inspectedBlockY: y,
      inspectedBlockZ: z,
      inspectedBlockType: block.typeName,
      inspectedBlockProperties: Object.keys(properties).length > 0 ? properties : undefined,
    });
  }

  /**
   * Refreshes the inspected block properties from the current block state.
   */
  _refreshInspectedBlock() {
    const x = this.state?.inspectedBlockX;
    const y = this.state?.inspectedBlockY;
    const z = this.state?.inspectedBlockZ;

    if (x !== undefined && y !== undefined && z !== undefined) {
      this._inspectBlockAt(x, y, z);
    }
  }

  /**
   * Handles click on a block when Block Inspector tool is active.
   */
  _handleBlockInspectorClick(x: number, y: number, z: number) {
    this._inspectBlockAt(x, y, z);
  }

  // ==================== END BLOCK INSPECTOR TOOL ====================

  /**
   * Gets the size of the current selection bounds.
   */
  _getSelectionSize(): { x: number; y: number; z: number } | undefined {
    if (!this.state?.selectionBounds) {
      return undefined;
    }
    const b = this.state.selectionBounds;
    return {
      x: b.toX - b.fromX + 1,
      y: b.toY - b.fromY + 1,
      z: b.toZ - b.fromZ + 1,
    };
  }

  /**
   * Gets the origin (minimum corner) of the current selection.
   */
  _getSelectionOrigin(): { x: number; y: number; z: number } | undefined {
    if (!this.state?.selectionBounds) {
      return undefined;
    }
    return {
      x: this.state.selectionBounds.fromX,
      y: this.state.selectionBounds.fromY,
      z: this.state.selectionBounds.fromZ,
    };
  }

  /**
   * Gets a summary of block types in the current selection.
   * Returns the top N most common block types.
   */
  _getSelectionBlockSummary(): { type: string; count: number }[] | undefined {
    if (!this.props.blockVolume || !this.state?.selectionBounds) {
      return undefined;
    }

    const bounds = this.state.selectionBounds;
    const blockCounts: Map<string, number> = new Map();

    for (let x = bounds.fromX; x <= bounds.toX && x < this.props.blockVolume.maxX; x++) {
      for (let y = bounds.fromY; y <= bounds.toY && y < this.props.blockVolume.maxY; y++) {
        for (let z = bounds.fromZ; z <= bounds.toZ && z < this.props.blockVolume.maxZ; z++) {
          if (x >= 0 && y >= 0 && z >= 0) {
            const block = this.props.blockVolume.x(x).y(y).z(z);
            if (block && block.typeName) {
              const typeName = block.typeName;
              blockCounts.set(typeName, (blockCounts.get(typeName) || 0) + 1);
            }
          }
        }
      }
    }

    // Sort by count and take top 5
    const sorted = Array.from(blockCounts.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return sorted.length > 0 ? sorted : undefined;
  }

  /**
   * Renders a summary of block types in the current selection.
   */
  _renderSelectionBlockSummary(): React.ReactNode {
    const summary = this._getSelectionBlockSummary();
    if (!summary || summary.length === 0) {
      return null;
    }

    // Filter out air blocks for display
    const nonAirBlocks = summary.filter((item) => item.type !== "minecraft:air" && item.type !== "air");

    if (nonAirBlocks.length === 0) {
      return (
        <div className="ve-panel-field">
          <label className="ve-panel-field-label">Contents</label>
          <div className="ve-panel-hint">Empty (all air)</div>
        </div>
      );
    }

    return (
      <div className="ve-panel-field">
        <label className="ve-panel-field-label">Block Types</label>
        <div className="ve-panel-properties-list">
          {nonAirBlocks.map((item) => (
            <div key={item.type} className="ve-panel-property-row">
              <span className="ve-panel-property-name">{this._formatBlockType(item.type)}</span>
              <span className="ve-panel-property-value">{item.count}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  /**
   * Renders the Selection tool panel content for the left panel.
   */
  _renderSelectionPanel() {
    const selectionMode = this.state?.selectionMode ?? SelectionMode.Marquee;
    const cursorInputMode = this.state?.cursorInputMode ?? CursorInputMode.MouseAndKeys;
    const cursorTarget = this.state?.cursorTarget ?? CursorTarget.Block;
    const hasSelection = this.selectedBlocks && this.selectedBlocks.length > 0;
    const hasMarqueeSelection = !!this.state?.selectionBounds;
    const selectionSize = this._getSelectionSize();
    const selectionOrigin = this._getSelectionOrigin();
    const hasHover = this.state?.hoverX !== undefined;

    return (
      <>
        <div className="ve-panel-header">
          <span className="ve-panel-title">Selection</span>
        </div>

        {/* Selection Mode Section */}
        <div className="ve-panel-section">
          <div className="ve-panel-section-title">Selection Mode</div>
          <div className="ve-panel-radio-group">
            <label className="ve-panel-radio">
              <input
                type="radio"
                name="selectionMode"
                checked={selectionMode === SelectionMode.Marquee}
                onChange={() => this._handleSelectionModeChange(SelectionMode.Marquee)}
              />
              <span>Marquee</span>
            </label>
            <label className="ve-panel-radio">
              <input
                type="radio"
                name="selectionMode"
                checked={selectionMode === SelectionMode.SingleBlock}
                onChange={() => this._handleSelectionModeChange(SelectionMode.SingleBlock)}
              />
              <span>Single Block</span>
            </label>
          </div>
        </div>

        {/* Quick Actions Section */}
        <div className="ve-panel-section">
          <div className="ve-panel-section-title">Quick Actions</div>
          <div className="ve-panel-actions">
            <button
              className="ve-panel-btn"
              onClick={() => this._deselectAll()}
              disabled={!hasMarqueeSelection && !hasSelection}
            >
              Deselect
            </button>
          </div>
        </div>

        {/* Cursor Settings Section */}
        <div className="ve-panel-section">
          <div className="ve-panel-section-title">Cursor Settings</div>

          <div className="ve-panel-field">
            <label className="ve-panel-field-label">Input Mode</label>
            <select
              className="ve-panel-select"
              value={cursorInputMode}
              onChange={(e) => this._handleInputModeChange(parseInt(e.target.value) as CursorInputMode)}
            >
              <option value={CursorInputMode.MouseAndKeys}>Mouse & Keys</option>
              <option value={CursorInputMode.KeyboardOnly}>Keyboard Only</option>
              <option value={CursorInputMode.FixedDistance}>Fixed Distance</option>
            </select>
          </div>

          <div className="ve-panel-field">
            <label className="ve-panel-field-label">Target</label>
            <select
              className="ve-panel-select"
              value={cursorTarget}
              onChange={(e) => this._handleTargetChange(parseInt(e.target.value) as CursorTarget)}
            >
              <option value={CursorTarget.Block}>Block</option>
              <option value={CursorTarget.Adjacent}>Adjacent</option>
            </select>
          </div>
        </div>

        {/* Transform Section (shows when selection exists) */}
        {hasMarqueeSelection && selectionOrigin && selectionSize && (
          <div className="ve-panel-section">
            <div className="ve-panel-section-title">Marquee Selection</div>

            <div className="ve-panel-field">
              <label className="ve-panel-field-label">Origin</label>
              <div className="ve-panel-coords">
                <div className="ve-panel-coord">
                  <span className="ve-panel-coord-label">X</span>
                  <span className="ve-panel-coord-value">{selectionOrigin.x}</span>
                </div>
                <div className="ve-panel-coord">
                  <span className="ve-panel-coord-label">Y</span>
                  <span className="ve-panel-coord-value">{selectionOrigin.y}</span>
                </div>
                <div className="ve-panel-coord">
                  <span className="ve-panel-coord-label">Z</span>
                  <span className="ve-panel-coord-value">{selectionOrigin.z}</span>
                </div>
              </div>
            </div>

            <div className="ve-panel-field">
              <label className="ve-panel-field-label">Size</label>
              <div className="ve-panel-coords">
                <div className="ve-panel-coord">
                  <span className="ve-panel-coord-label">X</span>
                  <span className="ve-panel-coord-value">{selectionSize.x}</span>
                </div>
                <div className="ve-panel-coord">
                  <span className="ve-panel-coord-label">Y</span>
                  <span className="ve-panel-coord-value">{selectionSize.y}</span>
                </div>
                <div className="ve-panel-coord">
                  <span className="ve-panel-coord-label">Z</span>
                  <span className="ve-panel-coord-value">{selectionSize.z}</span>
                </div>
              </div>
            </div>

            {/* Selection Statistics */}
            <div className="ve-panel-field">
              <label className="ve-panel-field-label">Volume</label>
              <div className="ve-panel-stat-value">{selectionSize.x * selectionSize.y * selectionSize.z} blocks</div>
            </div>

            {/* Block Type Summary */}
            {this._renderSelectionBlockSummary()}
          </div>
        )}

        {/* Hover Block Info */}
        {hasHover && this.state?.hoverBlockType && (
          <div className="ve-panel-section">
            <div className="ve-panel-section-title">Hovered Block</div>
            <div className="ve-panel-block-info">
              <div className="ve-panel-block-name">{this._formatBlockType(this.state.hoverBlockType)}</div>
              <div className="ve-panel-block-type">{this.state.hoverBlockType}</div>
              <div className="ve-panel-block-coords">
                {this.state.hoverX}, {this.state.hoverY}, {this.state.hoverZ}
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  /**
   * Renders the Brush tool panel content for the left panel.
   */
  _renderBrushPanel() {
    const brushShape = this.state?.brushShape ?? BrushShape.Cuboid;
    const brushTarget = this.state?.brushTarget ?? CursorTarget.Adjacent;
    const hasHover = this.state?.hoverX !== undefined;

    return (
      <>
        <div className="ve-panel-header">
          <span className="ve-panel-title">Brush</span>
        </div>

        {/* Brush Settings Section */}
        <div className="ve-panel-section">
          <div className="ve-panel-section-title">Brush Settings</div>

          <div className="ve-panel-field">
            <label className="ve-panel-field-label">Shape</label>
            <select
              className="ve-panel-select"
              value={brushShape}
              onChange={(e) => this._handleBrushShapeChange(parseInt(e.target.value) as BrushShape)}
            >
              <option value={BrushShape.SingleBlock}>Single Block</option>
              <option value={BrushShape.Cuboid}>Cuboid</option>
              <option value={BrushShape.Ellipsoid}>Ellipsoid</option>
              <option value={BrushShape.Cylinder}>Cylinder</option>
              <option value={BrushShape.Cone}>Cone</option>
              <option value={BrushShape.Pyramid}>Pyramid</option>
            </select>
          </div>

          <div className="ve-panel-field">
            <label className="ve-panel-field-label">Block Type</label>
            <BlockTypePicker
              value={this.state?.brushBlockType ?? "minecraft:stone"}
              onChange={(blockType) => this._handleBrushBlockTypeChange(blockType)}
              placeholder="Search blocks..."
            />
          </div>
        </div>

        {/* Shape Settings Section */}
        {brushShape !== BrushShape.SingleBlock && (
          <div className="ve-panel-section">
            <div className="ve-panel-section-title">Shape Settings</div>

            <div className="ve-panel-field">
              <label className="ve-panel-radio">
                <input
                  type="checkbox"
                  checked={this.state?.brushUniform ?? true}
                  onChange={(e) => this._handleBrushUniformChange(e.target.checked)}
                />
                <span>Uniform</span>
              </label>
            </div>

            {this.state?.brushUniform ? (
              <div className="ve-panel-field">
                <label className="ve-panel-field-label">Size (1-16)</label>
                <input
                  type="range"
                  className="ve-panel-slider"
                  min={1}
                  max={16}
                  value={this.state?.brushSizeX ?? 3}
                  onChange={(e) => this._handleBrushSizeChange("x", parseInt(e.target.value))}
                />
                <span className="ve-panel-slider-value">{this.state?.brushSizeX ?? 3}</span>
              </div>
            ) : (
              <>
                <div className="ve-panel-field">
                  <label className="ve-panel-field-label">Width (X)</label>
                  <input
                    type="range"
                    className="ve-panel-slider"
                    min={1}
                    max={16}
                    value={this.state?.brushSizeX ?? 3}
                    onChange={(e) => this._handleBrushSizeChange("x", parseInt(e.target.value))}
                  />
                  <span className="ve-panel-slider-value">{this.state?.brushSizeX ?? 3}</span>
                </div>
                <div className="ve-panel-field">
                  <label className="ve-panel-field-label">Height (Y)</label>
                  <input
                    type="range"
                    className="ve-panel-slider"
                    min={1}
                    max={16}
                    value={this.state?.brushSizeY ?? 3}
                    onChange={(e) => this._handleBrushSizeChange("y", parseInt(e.target.value))}
                  />
                  <span className="ve-panel-slider-value">{this.state?.brushSizeY ?? 3}</span>
                </div>
                <div className="ve-panel-field">
                  <label className="ve-panel-field-label">Depth (Z)</label>
                  <input
                    type="range"
                    className="ve-panel-slider"
                    min={1}
                    max={16}
                    value={Number(this.state?.brushSizeZ ?? 3)}
                    onChange={(e) => this._handleBrushSizeChange("z", parseInt(e.target.value))}
                  />
                  <span className="ve-panel-slider-value">{this.state?.brushSizeZ ?? 3}</span>
                </div>
              </>
            )}
          </div>
        )}

        {/* Cursor Settings Section */}
        <div className="ve-panel-section">
          <div className="ve-panel-section-title">Cursor Settings</div>

          <div className="ve-panel-field">
            <label className="ve-panel-field-label">Target</label>
            <select
              className="ve-panel-select"
              value={brushTarget}
              onChange={(e) => this._handleBrushTargetChange(parseInt(e.target.value) as CursorTarget)}
            >
              <option value={CursorTarget.Block}>Block (Replace)</option>
              <option value={CursorTarget.Adjacent}>Adjacent (Place Above)</option>
            </select>
          </div>
        </div>

        {/* Quick Actions Section */}
        <div className="ve-panel-section">
          <div className="ve-panel-section-title">Actions</div>
          <div className="ve-panel-actions">
            <button className="ve-panel-btn ve-panel-btn-primary" onClick={() => this._paintBrush()}>
              🖌 Paint
            </button>
          </div>
        </div>

        {/* Hover Block Info */}
        {hasHover && this.state?.hoverBlockType && (
          <div className="ve-panel-section">
            <div className="ve-panel-section-title">Hovered Block</div>
            <div className="ve-panel-block-info">
              <div className="ve-panel-block-name">{this._formatBlockType(this.state.hoverBlockType)}</div>
              <div className="ve-panel-block-type">{this.state.hoverBlockType}</div>
              <div className="ve-panel-block-coords">
                {this.state.hoverX}, {this.state.hoverY}, {this.state.hoverZ}
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  /**
   * Renders the Pencil tool panel content for the left panel.
   * @see https://learn.microsoft.com/en-us/minecraft/creator/documents/bedrockeditor/editorpenciltool
   */
  _renderPencilPanel() {
    const pencilMode = this.state?.pencilMode ?? PencilMode.Draw;
    const pencilBlockFacing = this.state?.pencilBlockFacing ?? PencilBlockFacing.Default;
    const pencilCursorTarget = this.state?.pencilCursorTarget ?? CursorTarget.Adjacent;
    const hasHover = this.state?.hoverX !== undefined;

    return (
      <>
        <div className="ve-panel-header">
          <span className="ve-panel-title">Pencil</span>
        </div>

        {/* Mode Section */}
        <div className="ve-panel-section">
          <div className="ve-panel-section-title">Mode</div>

          <div className="ve-panel-field">
            <div className="ve-panel-radio-group">
              <label className="ve-panel-radio">
                <input
                  type="radio"
                  name="pencilMode"
                  checked={pencilMode === PencilMode.Draw}
                  onChange={() => this._handlePencilModeChange(PencilMode.Draw)}
                />
                <span>Draw</span>
              </label>
              <label className="ve-panel-radio">
                <input
                  type="radio"
                  name="pencilMode"
                  checked={pencilMode === PencilMode.Erase}
                  onChange={() => this._handlePencilModeChange(PencilMode.Erase)}
                />
                <span>Erase</span>
              </label>
            </div>
          </div>
        </div>

        {/* Block Settings Section (only shown in Draw mode) */}
        {pencilMode === PencilMode.Draw && (
          <div className="ve-panel-section">
            <div className="ve-panel-section-title">Block Settings</div>

            <div className="ve-panel-field">
              <label className="ve-panel-field-label">Block Type</label>
              <BlockTypePicker
                value={this.state?.pencilBlockType ?? "minecraft:stone"}
                onChange={(blockType) => this._handlePencilBlockTypeChange(blockType)}
                placeholder="Search blocks..."
              />
            </div>

            <div className="ve-panel-field">
              <label className="ve-panel-field-label">Block Facing</label>
              <select
                className="ve-panel-select"
                value={pencilBlockFacing}
                onChange={(e) => this._handlePencilBlockFacingChange(parseInt(e.target.value) as PencilBlockFacing)}
              >
                <option value={PencilBlockFacing.ByCamera}>By Camera</option>
                <option value={PencilBlockFacing.Default}>Default</option>
              </select>
            </div>
          </div>
        )}

        {/* Cursor/Target Settings Section */}
        <div className="ve-panel-section">
          <div className="ve-panel-section-title">Cursor Settings</div>

          <div className="ve-panel-field">
            <label className="ve-panel-field-label">Target</label>
            <select
              className="ve-panel-select"
              value={pencilCursorTarget}
              onChange={(e) => this._handlePencilCursorTargetChange(parseInt(e.target.value) as CursorTarget)}
            >
              <option value={CursorTarget.Block}>Block</option>
              <option value={CursorTarget.Adjacent}>Face (Adjacent)</option>
            </select>
          </div>
        </div>

        {/* Offset Section */}
        <div className="ve-panel-section">
          <div className="ve-panel-section-title">Offset</div>

          <div className="ve-panel-field">
            <label className="ve-panel-field-label">X</label>
            <input
              type="range"
              className="ve-panel-slider"
              min={-10}
              max={10}
              value={this.state?.pencilOffsetX ?? 0}
              onChange={(e) => this._handlePencilOffsetChange("x", parseInt(e.target.value))}
            />
            <input
              type="number"
              className="ve-panel-number-input"
              min={-10}
              max={10}
              value={this.state?.pencilOffsetX ?? 0}
              onChange={(e) => this._handlePencilOffsetChange("x", parseInt(e.target.value) || 0)}
            />
          </div>

          <div className="ve-panel-field">
            <label className="ve-panel-field-label">Y</label>
            <input
              type="range"
              className="ve-panel-slider"
              min={-10}
              max={10}
              value={this.state?.pencilOffsetY ?? 0}
              onChange={(e) => this._handlePencilOffsetChange("y", parseInt(e.target.value))}
            />
            <input
              type="number"
              className="ve-panel-number-input"
              min={-10}
              max={10}
              value={this.state?.pencilOffsetY ?? 0}
              onChange={(e) => this._handlePencilOffsetChange("y", parseInt(e.target.value) || 0)}
            />
          </div>

          <div className="ve-panel-field">
            <label className="ve-panel-field-label">Z</label>
            <input
              type="range"
              className="ve-panel-slider"
              min={-10}
              max={10}
              value={this.state?.pencilOffsetZ ?? 0}
              onChange={(e) => this._handlePencilOffsetChange("z", parseInt(e.target.value))}
            />
            <input
              type="number"
              className="ve-panel-number-input"
              min={-10}
              max={10}
              value={this.state?.pencilOffsetZ ?? 0}
              onChange={(e) => this._handlePencilOffsetChange("z", parseInt(e.target.value) || 0)}
            />
          </div>
        </div>

        {/* Quick Actions Section */}
        <div className="ve-panel-section">
          <div className="ve-panel-section-title">Actions</div>
          <div className="ve-panel-actions">
            <button
              className={`ve-panel-btn ${
                pencilMode === PencilMode.Erase ? "ve-panel-btn-danger" : "ve-panel-btn-primary"
              }`}
              onClick={() => this._paintPencil()}
            >
              {pencilMode === PencilMode.Erase ? "🗑 Erase" : "✏ Draw"}
            </button>
          </div>
          <div className="ve-panel-hint">
            Press <kbd>Space</kbd> or <kbd>Enter</kbd> to {pencilMode === PencilMode.Erase ? "erase" : "draw"}
          </div>
        </div>

        {/* Hover Block Info */}
        {hasHover && this.state?.hoverBlockType && (
          <div className="ve-panel-section">
            <div className="ve-panel-section-title">Hovered Block</div>
            <div className="ve-panel-block-info">
              <div className="ve-panel-block-name">{this._formatBlockType(this.state.hoverBlockType)}</div>
              <div className="ve-panel-block-type">{this.state.hoverBlockType}</div>
              <div className="ve-panel-block-coords">
                {this.state.hoverX}, {this.state.hoverY}, {this.state.hoverZ}
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  /**
   * Renders the Block Inspector tool panel content for the left panel.
   * @see https://learn.microsoft.com/en-us/minecraft/creator/documents/bedrockeditor/editorblockinspector
   */
  _renderBlockInspectorPanel() {
    const hasInspectedBlock = this.state?.inspectedBlockX !== undefined;
    const hasHover = this.state?.hoverX !== undefined;
    const properties = this.state?.inspectedBlockProperties;
    const hasProperties = properties && Object.keys(properties).length > 0;

    return (
      <>
        <div className="ve-panel-header">
          <span className="ve-panel-title">Block Inspector</span>
        </div>

        {/* Help Section (when no block selected) */}
        {!hasInspectedBlock && (
          <div className="ve-panel-section">
            <div className="ve-panel-section-title">How to Use</div>
            <div className="ve-panel-hint">
              Click on a block to inspect its properties. The Block Inspector shows position, type, and state
              properties.
            </div>
          </div>
        )}

        {/* Actions Section */}
        <div className="ve-panel-section">
          <div className="ve-panel-section-title">Actions</div>
          <div className="ve-panel-actions">
            <button
              className="ve-panel-btn"
              onClick={() => this._refreshInspectedBlock()}
              disabled={!hasInspectedBlock}
              title="Refresh the inspected block properties"
            >
              🔄 Refresh
            </button>
            <button
              className="ve-panel-btn"
              onClick={() => this._clearInspectedBlock()}
              disabled={!hasInspectedBlock}
              title="Clear the current selection"
            >
              ✕ Clear
            </button>
          </div>
        </div>

        {/* Inspected Block Info */}
        {hasInspectedBlock && (
          <>
            {/* Main Info Section */}
            <div className="ve-panel-section">
              <div className="ve-panel-section-title">Main Info</div>

              <div className="ve-panel-field">
                <label className="ve-panel-field-label">Block Type</label>
                <div className="ve-panel-block-info">
                  <div className="ve-panel-block-name">{this._formatBlockType(this.state.inspectedBlockType)}</div>
                  <div className="ve-panel-block-type">{this.state.inspectedBlockType}</div>
                </div>
              </div>

              <div className="ve-panel-field">
                <label className="ve-panel-field-label">Position</label>
                <div className="ve-panel-coords">
                  <div className="ve-panel-coord">
                    <span className="ve-panel-coord-label">X</span>
                    <span className="ve-panel-coord-value">{this.state.inspectedBlockX}</span>
                  </div>
                  <div className="ve-panel-coord">
                    <span className="ve-panel-coord-label">Y</span>
                    <span className="ve-panel-coord-value">{this.state.inspectedBlockY}</span>
                  </div>
                  <div className="ve-panel-coord">
                    <span className="ve-panel-coord-label">Z</span>
                    <span className="ve-panel-coord-value">{this.state.inspectedBlockZ}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Properties Section */}
            {hasProperties && (
              <div className="ve-panel-section">
                <div className="ve-panel-section-title">Properties</div>
                <div className="ve-panel-properties-list">
                  {Object.entries(properties).map(([key, value]) => (
                    <div key={key} className="ve-panel-property-row">
                      <span className="ve-panel-property-name">{key}</span>
                      <span className="ve-panel-property-value">
                        {typeof value === "boolean" ? (value ? "true" : "false") : String(value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* No Properties Message */}
            {!hasProperties && (
              <div className="ve-panel-section">
                <div className="ve-panel-section-title">Properties</div>
                <div className="ve-panel-hint">This block has no state properties.</div>
              </div>
            )}
          </>
        )}

        {/* Hover Block Info (secondary, when different from inspected) */}
        {hasHover &&
          this.state?.hoverBlockType &&
          (this.state.hoverX !== this.state.inspectedBlockX ||
            this.state.hoverY !== this.state.inspectedBlockY ||
            this.state.hoverZ !== this.state.inspectedBlockZ) && (
            <div className="ve-panel-section">
              <div className="ve-panel-section-title">Hovered Block</div>
              <div className="ve-panel-block-info">
                <div className="ve-panel-block-name">{this._formatBlockType(this.state.hoverBlockType)}</div>
                <div className="ve-panel-block-type">{this.state.hoverBlockType}</div>
                <div className="ve-panel-block-coords">
                  {this.state.hoverX}, {this.state.hoverY}, {this.state.hoverZ}
                </div>
              </div>
            </div>
          )}
      </>
    );
  }

  render() {
    // When skipVanillaResources is true, we only need state to exist (not vanilla definitions)
    const needsVanillaResources = !this.props.skipVanillaResources;

    // Show error state with retry button if loading failed
    if (this.state && this.state.loadError) {
      return (
        <div className="ve-loading-overlay">
          <div className="ve-loading-content">
            <div className="ve-loading-message">{this.state.loadError}</div>
            <button
              className="ve-loading-retry-button"
              onClick={() => {
                this.setState({ loadError: undefined });
                this.componentDidMount();
              }}
            >
              Retry
            </button>
          </div>
        </div>
      );
    }

    if (
      this.props.blockVolume === undefined ||
      !this.state ||
      (needsVanillaResources && (!this.state.terrainTextureDefinition || !this.state.blocksDefinition))
    ) {
      return (
        <div className="ve-loading-overlay">
          <div className="ve-loading-content">
            <div className="ve-loading-spinner" />
            <div className="ve-loading-message">Loading definitions...</div>
          </div>
        </div>
      );
    }

    const isStructureMode = this.props.viewMode === VolumeEditorViewMode.Structure;
    const hideChrome = this.props.hideChrome === true;
    const hasHover = this.state.hoverX !== undefined;
    const hasSelection = this.selectedBlocks && this.selectedBlocks.length > 0;
    const hasMarqueeSelection = !!this.state.selectionBounds;
    const showToolbar = !hideChrome && this.props.showToolbar !== false && isStructureMode;
    const showRightPanel =
      !hideChrome && this.props.showRightPanel !== false && isStructureMode && !this.state.panelCollapsed;

    const selectionMode = this.state.selectionMode ?? SelectionMode.Marquee;
    const cursorInputMode = this.state.cursorInputMode ?? CursorInputMode.MouseAndKeys;
    const cursorTarget = this.state.cursorTarget ?? CursorTarget.Block;
    const activeTool = this.state.activeTool ?? EditorTool.Selection;

    const selectionSize = this._getSelectionSize();
    const selectionOrigin = this._getSelectionOrigin();

    // Marquee step indicator text
    const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
    const altKeyName = isMac ? "Option" : "Alt";

    const getMarqueeStepHint = () => {
      switch (this.state.marqueeStep) {
        case "none":
          return "Click a block to start selection";
        case "x":
          return "Hold Shift and click to set Z extent";
        case "z":
          return `Hold ${altKeyName} and click to set Y extent`;
        case "y":
          return "Selection complete";
        default:
          return "";
      }
    };

    return (
      <div className="ve-container">
        {/* Left Tool Bar - Vertical icon toolbar for tool selection */}
        {isStructureMode && !hideChrome && (
          <div className="ve-left-toolbar">
            <button
              className={`ve-tool-btn ${activeTool === EditorTool.Selection ? "ve-tool-btn-active" : ""}`}
              onClick={() => this._handleToolChange(EditorTool.Selection)}
              title="Selection Tool (S)"
            >
              <span className="ve-tool-icon">
                <FontAwesomeIcon icon={faVectorSquare} />
              </span>
              <span className="ve-tool-label">Select</span>
            </button>
            <button
              className={`ve-tool-btn ${activeTool === EditorTool.Brush ? "ve-tool-btn-active" : ""}`}
              onClick={() => this._handleToolChange(EditorTool.Brush)}
              title="Brush Tool (B)"
            >
              <span className="ve-tool-icon">
                <FontAwesomeIcon icon={faPaintBrush} />
              </span>
              <span className="ve-tool-label">Brush</span>
            </button>
            <button
              className={`ve-tool-btn ${activeTool === EditorTool.Pencil ? "ve-tool-btn-active" : ""}`}
              onClick={() => this._handleToolChange(EditorTool.Pencil)}
              title="Pencil Tool (P) - Place/Remove single blocks"
            >
              <span className="ve-tool-icon">
                <FontAwesomeIcon icon={faPencil} />
              </span>
              <span className="ve-tool-label">Pencil</span>
            </button>
            <button
              className={`ve-tool-btn ${activeTool === EditorTool.BlockInspector ? "ve-tool-btn-active" : ""}`}
              onClick={() => this._handleToolChange(EditorTool.BlockInspector)}
              title="Block Inspector (I) - View block properties"
            >
              <span className="ve-tool-icon">
                <FontAwesomeIcon icon={faMagnifyingGlass} />
              </span>
              <span className="ve-tool-label">Inspect</span>
            </button>
            <div className="ve-toolbar-separator" />
            <button
              className={`ve-tool-btn ${activeTool === EditorTool.Help ? "ve-tool-btn-active" : ""}`}
              onClick={() => this._handleToolChange(EditorTool.Help)}
              title="Controls (?) - View keyboard shortcuts"
            >
              <span className="ve-tool-icon">
                <FontAwesomeIcon icon={faKeyboard} />
              </span>
              <span className="ve-tool-label">Controls</span>
            </button>
            <button
              className={`ve-tool-btn ${activeTool === EditorTool.Properties ? "ve-tool-btn-active" : ""}`}
              onClick={() => this._handleToolChange(EditorTool.Properties)}
              title="Properties (R) - View and resize structure"
            >
              <span className="ve-tool-icon">
                <FontAwesomeIcon icon={faRulerCombined} />
              </span>
              <span className="ve-tool-label">Props</span>
            </button>
          </div>
        )}

        {/* Left Panel - Tool-specific settings */}
        {showRightPanel && isStructureMode && (
          <div className="ve-left-panel">
            {activeTool === EditorTool.Selection && this._renderSelectionPanel()}
            {activeTool === EditorTool.Brush && this._renderBrushPanel()}
            {activeTool === EditorTool.Pencil && this._renderPencilPanel()}
            {activeTool === EditorTool.BlockInspector && this._tools.get(EditorTool.BlockInspector)?.renderPanel()}
            {activeTool === EditorTool.Help && this._tools.get(EditorTool.Help)?.renderPanel()}
            {activeTool === EditorTool.Properties && this._tools.get(EditorTool.Properties)?.renderPanel()}
            {/* Future: Use pluggable tool panels for all tools with:
                {this._tools.get(activeTool)?.renderPanel()}
            */}
          </div>
        )}

        {/* Main content area */}
        <div className={`ve-main-area ${showRightPanel ? "ve-with-panels" : ""}`}>
          {/* 3D Canvas */}
          <div className="ve-canvas-wrapper" ref={(c: HTMLDivElement) => this._setCanvasOuter(c)} />

          {/* Overlays for Structure mode only (when chrome is visible) */}
          {isStructureMode && !hideChrome && (
            <>
              {/* Toolbar items - rendered either in portal or floating overlay */}
              {(() => {
                const toolbarItems = (
                  <>
                    {/* Undo/Redo - Always visible */}
                    <div className="ve-top-toolbar-group">
                      <button
                        className="ve-top-btn"
                        onClick={() => this._handleUndo()}
                        disabled={!this.state?.canUndo}
                        title={`Undo${
                          this._undoManager.undoDescription ? `: ${this._undoManager.undoDescription}` : ""
                        } (Ctrl+Z)`}
                      >
                        <span className="ve-top-btn-icon">↶</span>
                      </button>
                      <button
                        className="ve-top-btn"
                        onClick={() => this._handleRedo()}
                        disabled={!this.state?.canRedo}
                        title={`Redo${
                          this._undoManager.redoDescription ? `: ${this._undoManager.redoDescription}` : ""
                        } (Ctrl+Y)`}
                      >
                        <span className="ve-top-btn-icon">↷</span>
                      </button>
                    </div>

                    {/* Selection Tool Controls */}
                    {showToolbar && activeTool === EditorTool.Selection && (
                      <>
                        <div className="ve-top-toolbar-divider" />
                        <div className="ve-top-toolbar-group">
                          <span className="ve-top-toolbar-label">Mode:</span>
                          <button
                            className={`ve-top-toolbar-btn ${
                              selectionMode === SelectionMode.Marquee ? "ve-top-toolbar-btn-active" : ""
                            }`}
                            onClick={() => this._handleSelectionModeChange(SelectionMode.Marquee)}
                            title="Marquee Selection - Click to set corners"
                          >
                            ▢ Marquee
                          </button>
                          <button
                            className={`ve-top-toolbar-btn ${
                              selectionMode === SelectionMode.SingleBlock ? "ve-top-toolbar-btn-active" : ""
                            }`}
                            onClick={() => this._handleSelectionModeChange(SelectionMode.SingleBlock)}
                            title="Single Block Selection"
                          >
                            ◼ Block
                          </button>
                        </div>
                        <div className="ve-top-toolbar-divider" />
                        <div className="ve-top-toolbar-group">
                          <button
                            className="ve-top-toolbar-btn"
                            onClick={() => this._deselectAll()}
                            title="Deselect (Ctrl+D)"
                            disabled={!hasMarqueeSelection && !hasSelection}
                          >
                            ✕ Deselect
                          </button>
                          {this.props.onFillRequested && (
                            <button
                              className="ve-top-toolbar-btn ve-top-toolbar-btn-primary"
                              onClick={() => this._fillSelection()}
                              title="Fill Selection (Ctrl+F)"
                              disabled={!hasMarqueeSelection}
                            >
                              ▦ Fill
                            </button>
                          )}
                          {this.props.onDeleteRequested && (
                            <button
                              className="ve-top-toolbar-btn ve-top-toolbar-btn-danger"
                              onClick={() => this._deleteSelection()}
                              title="Delete Selection (Delete)"
                              disabled={!hasMarqueeSelection}
                            >
                              🗑 Delete
                            </button>
                          )}
                        </div>
                      </>
                    )}

                    {/* Brush Tool Controls */}
                    {showToolbar && activeTool === EditorTool.Brush && (
                      <>
                        <div className="ve-top-toolbar-divider" />
                        <div className="ve-top-toolbar-group">
                          <span className="ve-top-toolbar-label">Shape:</span>
                          <select
                            className="ve-top-toolbar-select"
                            value={this.state.brushShape}
                            onChange={(e) => this._handleBrushShapeChange(parseInt(e.target.value) as BrushShape)}
                          >
                            <option value={BrushShape.SingleBlock}>Single</option>
                            <option value={BrushShape.Cuboid}>Cuboid</option>
                            <option value={BrushShape.Ellipsoid}>Ellipsoid</option>
                            <option value={BrushShape.Cylinder}>Cylinder</option>
                            <option value={BrushShape.Cone}>Cone</option>
                            <option value={BrushShape.Pyramid}>Pyramid</option>
                          </select>
                        </div>
                        <div className="ve-top-toolbar-divider" />
                        <div className="ve-top-toolbar-group">
                          <span className="ve-top-toolbar-label">Size:</span>
                          <input
                            type="number"
                            className="ve-top-toolbar-input"
                            value={this.state.brushSizeX}
                            min={1}
                            max={16}
                            onChange={(e) => this._handleBrushSizeChange("x", parseInt(e.target.value) || 1)}
                            title="Brush Size"
                          />
                        </div>
                        <div className="ve-top-toolbar-divider" />
                        <div className="ve-top-toolbar-group">
                          <button
                            className="ve-top-toolbar-btn ve-top-toolbar-btn-primary"
                            onClick={() => this._paintBrush()}
                            title="Paint (Enter)"
                          >
                            🖌 Paint
                          </button>
                        </div>
                      </>
                    )}

                    {/* Help Button - Always visible at end */}
                    <div className="ve-top-toolbar-divider" />
                    <div className="ve-top-toolbar-group">
                      <button
                        className={`ve-top-btn ${this.state?.activeTool === EditorTool.Help ? "ve-top-btn-active" : ""}`}
                        onClick={() => this._handleToolChange(EditorTool.Help)}
                        title="Controls (?) - View keyboard shortcuts"
                      >
                        <span className="ve-top-btn-icon">?</span>
                      </button>
                    </div>
                  </>
                );

                if (this.props.toolbarPortalTarget) {
                  return createPortal(toolbarItems, this.props.toolbarPortalTarget);
                }

                return <div className="ve-top-toolbar">{toolbarItems}</div>;
              })()}

              {/* Coordinates Display - Bottom Left */}
              {hasHover && (
                <div className="ve-coords-container">
                  <div className="ve-coords-display">
                    x: {this.state.hoverX} y: {this.state.hoverY} z: {this.state.hoverZ}
                  </div>
                </div>
              )}

              {/* Marquee Step Hint - Bottom Center (Selection tool only) */}
              {activeTool === EditorTool.Selection &&
                selectionMode === SelectionMode.Marquee &&
                this.state.marqueeStep !== "y" && <div className="ve-marquee-hint">{getMarqueeStepHint()}</div>}

              {/* Brush Hint - Bottom Center (Brush tool only) */}
              {activeTool === EditorTool.Brush && (
                <div className="ve-marquee-hint">Click to paint with {this.state.brushBlockType}</div>
              )}

              {/* Pencil Hint - Bottom Center (Pencil tool only) */}
              {activeTool === EditorTool.Pencil && (
                <div className="ve-marquee-hint">
                  {this.state.pencilMode === PencilMode.Erase
                    ? "Click or press Space/Enter to erase block"
                    : `Click or press Space/Enter to place ${this.state.pencilBlockType}`}
                </div>
              )}

              {/* Selection Info - Bottom Center (when selection is complete) */}
              {hasMarqueeSelection && selectionSize && (
                <div className="ve-selection-info">
                  Selection: {selectionSize.x} × {selectionSize.y} × {selectionSize.z} blocks
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }
}
