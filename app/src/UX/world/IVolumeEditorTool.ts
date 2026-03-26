// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * ==========================================================================================
 * VOLUME EDITOR TOOL PLUGIN SYSTEM
 * ==========================================================================================
 *
 * This module defines the interface for pluggable editing tools in the VolumeEditor.
 * Tools like Brush, Pencil, and future tools implement this interface to provide
 * consistent behavior while keeping their implementation separate from the core editor.
 *
 * ARCHITECTURE:
 * -------------
 * - IVolumeEditorTool: The interface that each tool must implement
 * - IVolumeEditorContext: Services provided by VolumeEditor to tools
 * - VolumeEditorToolBase: Optional base class with common functionality
 * - Tools are registered with the editor and activated/deactivated as needed
 *
 * RELATED FILES:
 * --------------
 * - VolumeEditor.tsx: Main editor component that hosts tools
 * - VolumeEditorTypes.ts: Shared enums (EditorTool, BrushShape, etc.)
 * - VolumeEditorUndoManager.ts: Undo/redo system for block modifications
 * - BrushTool.tsx: Brush tool implementation for area painting
 * - PencilTool.tsx: Pencil tool implementation for single-block placement
 * - BlockInspectorTool.tsx: Block Inspector tool for viewing block properties
 * - HelpTool.tsx: Help tool for displaying keyboard shortcuts
 *
 * TOOL LIFECYCLE:
 * ---------------
 * 1. Tool is instantiated (e.g., new BrushTool())
 * 2. When tool becomes active: activate(context) is called with editor context
 * 3. While active: onHover/onClick/onKeyDown events are forwarded to the tool
 * 4. Tool creates/updates preview meshes using context.scene
 * 5. Tool renders its settings panel via renderPanel()
 * 6. When tool becomes inactive: deactivate() is called (cleanup preview meshes)
 *
 * STATE MANAGEMENT:
 * -----------------
 * Each tool manages its own state internally. The tool's state can be accessed
 * via getState() and updated via setState(). The tool should call
 * context.requestPanelUpdate() when it needs the panel to re-render.
 *
 * UNDO/REDO:
 * ----------
 * Tools should use the context.undoManager to record actions. The pattern is:
 *   1. context.undoManager.beginAction(type, description)
 *   2. context.undoManager.recordBlockBefore(volume, x, y, z)
 *   3. Modify blocks via context.blockVolume.x(x).y(y).z(z).typeName = ...
 *   4. context.undoManager.recordBlockAfter(volume, x, y, z)
 *   5. context.undoManager.endAction()
 *   6. context.updateBlockMesh(x, y, z) for each modified block
 *
 * CREATING A NEW TOOL:
 * --------------------
 * 1. Create a new file (e.g., MyTool.tsx)
 * 2. Define your tool's state interface extending IToolState
 * 3. Implement IVolumeEditorTool (or extend VolumeEditorToolBase)
 * 4. Handle lifecycle: activate(), deactivate()
 * 5. Handle events: onHover(), onHoverEnd(), onClick(), onKeyDown()
 * 6. Manage preview meshes using context.scene
 * 7. Render settings panel in renderPanel()
 *
 * ==========================================================================================
 */

import * as BABYLON from "babylonjs";
import BlockVolume from "../../minecraft/BlockVolume";
import VolumeEditorUndoManager from "./VolumeEditorUndoManager";

/**
 * Hover information passed to tools when the cursor moves over blocks.
 */
export interface IToolHoverInfo {
  /** X coordinate in data space (undefined if not hovering over a block) */
  x: number | undefined;
  /** Y coordinate in data space */
  y: number | undefined;
  /** Z coordinate in data space */
  z: number | undefined;
  /** Block type at hover position (undefined for air/placeholders) */
  blockType: string | undefined;
  /** Face offset X for adjacent placement (-1, 0, or 1) */
  faceOffsetX: number;
  /** Face offset Y for adjacent placement */
  faceOffsetY: number;
  /** Face offset Z for adjacent placement */
  faceOffsetZ: number;
}

/**
 * Context provided by VolumeEditor to tools, giving them access to
 * editor services and the scene.
 */
export interface IVolumeEditorContext {
  /** The block volume being edited */
  readonly blockVolume: BlockVolume | undefined;

  /** The Babylon.js scene for creating preview meshes */
  readonly scene: BABYLON.Scene | null;

  /** The undo manager for recording undoable actions */
  readonly undoManager: VolumeEditorUndoManager;

  /** Maximum X dimension of the block volume */
  readonly maxX: number;
  /** Maximum Y dimension of the block volume */
  readonly maxY: number;
  /** Maximum Z dimension of the block volume */
  readonly maxZ: number;

  /**
   * Updates the visual mesh for a block after modification.
   * This handles both the block itself and adjacent blocks for proper face culling.
   */
  updateBlockMesh(x: number, y: number, z: number): void;

  /**
   * Requests the editor to re-render the tool panel.
   */
  requestPanelUpdate(): void;

  /**
   * Checks if a position is within the volume bounds.
   */
  isWithinBounds(x: number, y: number, z: number): boolean;

  /**
   * Converts data coordinates to visual (Babylon.js) coordinates.
   * @param dataX X in data space
   * @param dataY Y in data space
   * @param dataZ Z in data space
   * @returns Position in visual space
   */
  dataToVisualCoords(dataX: number, dataY: number, dataZ: number): BABYLON.Vector3;
}

/**
 * Interface for tool-specific state that can be serialized/restored.
 * Each tool defines its own state shape.
 */
export interface IToolState {
  [key: string]: unknown;
}

/**
 * Result of a tool handling a click event.
 */
export interface IToolClickResult {
  /** Whether the tool handled the click (prevents default behavior) */
  handled: boolean;
  /** Whether the click modified blocks (for dirty tracking) */
  modified: boolean;
}

/**
 * Result of a tool handling a key event.
 */
export interface IToolKeyResult {
  /** Whether the tool handled the key (prevents default behavior) */
  handled: boolean;
}

/**
 * Interface that all VolumeEditor tools must implement.
 *
 * Tools are responsible for:
 * - Rendering their settings panel (React element)
 * - Creating/updating preview meshes in the scene
 * - Handling click and key events when active
 * - Recording undo actions for block modifications
 */
export interface IVolumeEditorTool {
  /** Unique identifier for this tool (e.g., "brush", "pencil") */
  readonly id: string;

  /** Display name shown in UI */
  readonly displayName: string;

  /** Icon character or emoji for the tool button */
  readonly icon: string;

  /** Keyboard shortcut key (e.g., "B" for brush) */
  readonly shortcutKey: string;

  /** Tooltip text for the tool button */
  readonly tooltip: string;

  /**
   * Called when the tool becomes the active tool.
   * Initialize any preview meshes here.
   */
  activate(context: IVolumeEditorContext): void;

  /**
   * Called when the tool is deactivated (another tool selected).
   * Clean up preview meshes and any temporary state.
   */
  deactivate(): void;

  /**
   * Called when the cursor hovers over blocks.
   * Update preview meshes based on current hover position.
   */
  onHover(hoverInfo: IToolHoverInfo): void;

  /**
   * Called when the cursor leaves all blocks.
   * Hide or clear preview meshes.
   */
  onHoverEnd(): void;

  /**
   * Called when the user clicks in the editor.
   * Perform the tool's action (e.g., place blocks).
   */
  onClick(hoverInfo: IToolHoverInfo): IToolClickResult;

  /**
   * Called when a key is pressed while the tool is active.
   * Handle tool-specific keyboard shortcuts.
   */
  onKeyDown(event: KeyboardEvent, hoverInfo: IToolHoverInfo): IToolKeyResult;

  /**
   * Gets the current tool state for serialization or inspection.
   */
  getState(): IToolState;

  /**
   * Updates the tool state. Called when settings change.
   */
  setState(state: Partial<IToolState>): void;

  /**
   * Renders the tool's settings panel as a React element.
   * @returns React element for the panel, or null if no panel
   */
  renderPanel(): React.ReactNode;

  /**
   * Renders any tool-specific toolbar controls.
   * @returns React element for toolbar, or null if no toolbar controls
   */
  renderToolbar(): React.ReactNode;
}

/**
 * Base class for tools that provides common functionality.
 * Tools can extend this or implement IVolumeEditorTool directly.
 */
export abstract class VolumeEditorToolBase implements IVolumeEditorTool {
  abstract readonly id: string;
  abstract readonly displayName: string;
  abstract readonly icon: string;
  abstract readonly shortcutKey: string;
  abstract readonly tooltip: string;

  protected _context: IVolumeEditorContext | undefined;
  protected _isActive: boolean = false;

  get context(): IVolumeEditorContext | undefined {
    return this._context;
  }

  get isActive(): boolean {
    return this._isActive;
  }

  activate(context: IVolumeEditorContext): void {
    this._context = context;
    this._isActive = true;
    this.onActivate();
  }

  deactivate(): void {
    this.onDeactivate();
    this._context = undefined;
    this._isActive = false;
  }

  /**
   * Override to perform activation logic after context is set.
   */
  protected onActivate(): void {
    // Default: no-op
  }

  /**
   * Override to perform cleanup before context is cleared.
   */
  protected onDeactivate(): void {
    // Default: no-op
  }

  abstract onHover(hoverInfo: IToolHoverInfo): void;
  abstract onHoverEnd(): void;
  abstract onClick(hoverInfo: IToolHoverInfo): IToolClickResult;

  onKeyDown(_event: KeyboardEvent, _hoverInfo: IToolHoverInfo): IToolKeyResult {
    return { handled: false };
  }

  abstract getState(): IToolState;
  abstract setState(state: Partial<IToolState>): void;
  abstract renderPanel(): React.ReactNode;

  renderToolbar(): React.ReactNode {
    return null;
  }

  /**
   * Helper to check if we have a valid context and block volume.
   */
  protected hasValidContext(): boolean {
    return this._context !== undefined && this._context.blockVolume !== undefined;
  }
}
