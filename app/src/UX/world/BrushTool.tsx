// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * ==========================================================================================
 * BRUSH TOOL FOR VOLUME EDITOR
 * ==========================================================================================
 *
 * The Brush tool allows painting blocks in various shapes (cuboid, ellipsoid, cylinder, etc.)
 * across a volume area. This file extracts the brush functionality from VolumeEditor into
 * a self-contained, pluggable tool module implementing IVolumeEditorTool.
 *
 * FEATURES:
 * - Multiple brush shapes (SingleBlock, Cuboid, Ellipsoid, Cylinder, Cone, Pyramid)
 * - Configurable size (uniform or per-axis)
 * - Block type selection
 * - Target mode (Block replacement vs Adjacent placement)
 * - Visual preview of brush area
 * - Undo/redo support
 *
 * USAGE:
 * The tool is instantiated by VolumeEditor and receives callbacks and context through
 * the IVolumeEditorTool interface. This allows the tool to:
 * - Access the block volume and scene
 * - Record undo actions
 * - Update visual meshes
 * - Trigger panel re-renders
 *
 * @see https://learn.microsoft.com/en-us/minecraft/creator/documents/bedrockeditor/editorbrushtool
 *
 * ==========================================================================================
 */

import * as BABYLON from "babylonjs";
import React from "react";
import { VolumeActionType } from "./VolumeEditorUndoManager";
import { BrushShape, CursorTarget } from "./VolumeEditorTypes";
import {
  IVolumeEditorTool,
  IVolumeEditorContext,
  IToolHoverInfo,
  IToolClickResult,
  IToolKeyResult,
  IToolState,
} from "./IVolumeEditorTool";
import BlockTypePicker from "./BlockTypePicker";

/**
 * State for the Brush tool.
 */
export interface IBrushToolState extends IToolState {
  /** Current brush shape */
  shape: BrushShape;
  /** Brush size on X axis */
  sizeX: number;
  /** Brush size on Y axis */
  sizeY: number;
  /** Brush size on Z axis */
  sizeZ: number;
  /** Whether to use uniform sizing */
  uniform: boolean;
  /** Block type to paint */
  blockType: string;
  /** Cursor target mode */
  target: CursorTarget;
}

/**
 * Default state for a new brush tool.
 */
export function getDefaultBrushState(): IBrushToolState {
  return {
    shape: BrushShape.Cuboid,
    sizeX: 3,
    sizeY: 3,
    sizeZ: 3,
    uniform: true,
    blockType: "minecraft:stone",
    target: CursorTarget.Adjacent,
  };
}

/**
 * BrushTool implements IVolumeEditorTool for the brush painting functionality.
 */
export class BrushTool implements IVolumeEditorTool {
  readonly id = "brush";
  readonly displayName = "Brush";
  readonly icon = "🖌";
  readonly shortcutKey = "B";
  readonly tooltip = "Brush Tool (B) - Paint blocks in an area";

  private _state: IBrushToolState;
  private _context: IVolumeEditorContext | undefined;
  private _previewMesh: BABYLON.Mesh | undefined;
  private _isActive: boolean = false;
  private _lastHoverInfo: IToolHoverInfo | undefined;

  constructor(initialState?: Partial<IBrushToolState>) {
    this._state = { ...getDefaultBrushState(), ...initialState };
  }

  // ==================== IVolumeEditorTool Implementation ====================

  activate(context: IVolumeEditorContext): void {
    this._context = context;
    this._isActive = true;
  }

  deactivate(): void {
    this._clearPreview();
    this._context = undefined;
    this._isActive = false;
    this._lastHoverInfo = undefined;
  }

  onHover(hoverInfo: IToolHoverInfo): void {
    this._lastHoverInfo = hoverInfo;
    this._updatePreview(hoverInfo);
  }

  onHoverEnd(): void {
    this._clearPreview();
    this._lastHoverInfo = undefined;
  }

  onClick(hoverInfo: IToolHoverInfo): IToolClickResult {
    const modified = this._paint(hoverInfo);
    return { handled: true, modified };
  }

  onKeyDown(_event: KeyboardEvent, _hoverInfo: IToolHoverInfo): IToolKeyResult {
    // Brush tool doesn't have special key handlers yet
    return { handled: false };
  }

  getState(): IBrushToolState {
    return { ...this._state };
  }

  setState(newState: Partial<IBrushToolState>): void {
    const oldState = { ...this._state };
    this._state = { ...this._state, ...newState };

    // Handle uniform size changes
    if (newState.uniform !== undefined && newState.uniform) {
      // When switching to uniform, sync all sizes to X
      this._state.sizeY = this._state.sizeX;
      this._state.sizeZ = this._state.sizeX;
    }

    if (newState.sizeX !== undefined && this._state.uniform) {
      this._state.sizeY = newState.sizeX;
      this._state.sizeZ = newState.sizeX;
    }

    // If size or shape changed, update preview
    if (
      oldState.sizeX !== this._state.sizeX ||
      oldState.sizeY !== this._state.sizeY ||
      oldState.sizeZ !== this._state.sizeZ ||
      oldState.shape !== this._state.shape ||
      oldState.target !== this._state.target
    ) {
      if (this._lastHoverInfo) {
        this._updatePreview(this._lastHoverInfo);
      }
    }

    // Request panel update to reflect state changes
    this._context?.requestPanelUpdate();
  }

  renderPanel(): React.ReactNode {
    return this._renderBrushPanel();
  }

  renderToolbar(): React.ReactNode {
    // Could add quick-access brush controls here
    return null;
  }

  // ==================== Preview Mesh ====================

  private _clearPreview(): void {
    if (this._previewMesh && this._context?.scene) {
      this._context.scene.removeMesh(this._previewMesh);
      this._previewMesh.dispose();
      this._previewMesh = undefined;
    }
  }

  private _updatePreview(hoverInfo: IToolHoverInfo): void {
    if (!this._context?.scene || !this._isActive) {
      this._clearPreview();
      return;
    }

    if (hoverInfo.x === undefined || hoverInfo.y === undefined || hoverInfo.z === undefined) {
      this._clearPreview();
      return;
    }

    // Calculate brush center position
    let centerX = hoverInfo.x;
    let centerY = hoverInfo.y;
    let centerZ = hoverInfo.z;

    // Adjust for Adjacent target
    if (this._state.target === CursorTarget.Adjacent) {
      centerX += hoverInfo.faceOffsetX;
      centerY += hoverInfo.faceOffsetY;
      centerZ += hoverInfo.faceOffsetZ;
    }

    const sizeX = this._state.sizeX;
    const sizeY = this._state.sizeY;
    const sizeZ = this._state.sizeZ;

    // Clear existing preview
    this._clearPreview();

    // Create a box showing the brush area
    this._previewMesh = BABYLON.MeshBuilder.CreateBox(
      "brushPreview",
      { width: sizeX, height: sizeY, depth: sizeZ },
      this._context.scene
    );

    // Position at center of brush area using visual coordinates
    const visualPos = this._context.dataToVisualCoords(centerX, centerY, centerZ);
    this._previewMesh.position = new BABYLON.Vector3(
      visualPos.x + sizeX / 2 - 0.5,
      visualPos.y + sizeY / 2 - 0.5,
      visualPos.z + sizeZ / 2 - 0.5
    );

    // Create semi-transparent blue material
    const material = new BABYLON.StandardMaterial("brushPreviewMat", this._context.scene);
    material.diffuseColor = new BABYLON.Color3(0.3, 0.5, 1.0);
    material.alpha = 0.3;
    material.backFaceCulling = false;
    this._previewMesh.material = material;

    // Enable edge rendering
    this._previewMesh.enableEdgesRendering();
    this._previewMesh.edgesWidth = 2.0;
    this._previewMesh.edgesColor = new BABYLON.Color4(0.4, 0.6, 1.0, 0.9);
  }

  // ==================== Painting ====================

  /**
   * Checks if a position is within the current brush shape.
   */
  private _isInBrushShape(
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

    switch (this._state.shape) {
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

      case BrushShape.Cone: {
        // Cone pointing up
        const coneRadius = 1 - ny; // Radius decreases with height
        return cx * cx * 4 + cz * cz * 4 <= coneRadius * coneRadius;
      }

      case BrushShape.Pyramid: {
        // Pyramid with square base
        const pyramidRadius = 1 - ny;
        return Math.abs(cx) * 2 <= pyramidRadius && Math.abs(cz) * 2 <= pyramidRadius;
      }

      default:
        return true;
    }
  }

  private _paint(hoverInfo: IToolHoverInfo): boolean {
    if (!this._context?.blockVolume || !this._isActive) {
      return false;
    }

    const { x: hoverX, y: hoverY, z: hoverZ } = hoverInfo;
    if (hoverX === undefined || hoverY === undefined || hoverZ === undefined) {
      return false;
    }

    const blockVolume = this._context.blockVolume;

    // Calculate brush center position
    let centerX = hoverX;
    let centerY = hoverY;
    let centerZ = hoverZ;

    // Adjust for Adjacent target
    if (this._state.target === CursorTarget.Adjacent) {
      centerX += hoverInfo.faceOffsetX;
      centerY += hoverInfo.faceOffsetY;
      centerZ += hoverInfo.faceOffsetZ;
    }

    const halfX = Math.floor(this._state.sizeX / 2);
    const halfY = Math.floor(this._state.sizeY / 2);
    const halfZ = Math.floor(this._state.sizeZ / 2);

    const fromX = centerX - halfX;
    const fromY = centerY;
    const fromZ = centerZ - halfZ;
    const toX = fromX + this._state.sizeX - 1;
    const toY = fromY + this._state.sizeY - 1;
    const toZ = fromZ + this._state.sizeZ - 1;

    // Begin undo action for brush painting
    const brushDesc = `Brush: ${this._state.blockType.replace("minecraft:", "")}`;
    this._context.undoManager.beginAction(VolumeActionType.Brush, brushDesc);

    // First pass: record block states BEFORE painting
    for (let x = fromX; x <= toX; x++) {
      for (let y = fromY; y <= toY; y++) {
        for (let z = fromZ; z <= toZ; z++) {
          if (!this._context.isWithinBounds(x, y, z)) continue;
          if (this._isInBrushShape(x, y, z, fromX, fromY, fromZ, toX, toY, toZ)) {
            this._context.undoManager.recordBlockBefore(blockVolume, x, y, z);
          }
        }
      }
    }

    // Second pass: paint blocks and record AFTER states
    const modifiedBlocks: Array<{ x: number; y: number; z: number }> = [];

    for (let x = fromX; x <= toX; x++) {
      for (let y = fromY; y <= toY; y++) {
        for (let z = fromZ; z <= toZ; z++) {
          if (!this._context.isWithinBounds(x, y, z)) continue;
          if (this._isInBrushShape(x, y, z, fromX, fromY, fromZ, toX, toY, toZ)) {
            const block = blockVolume.x(x).y(y).z(z);
            if (block) {
              block.typeName = this._state.blockType;
              modifiedBlocks.push({ x, y, z });
            }
            this._context.undoManager.recordBlockAfter(blockVolume, x, y, z);
          }
        }
      }
    }

    // Finalize undo action
    this._context.undoManager.endAction();

    // Update visual meshes for modified blocks
    for (const pos of modifiedBlocks) {
      this._context.updateBlockMesh(pos.x, pos.y, pos.z);
    }

    return modifiedBlocks.length > 0;
  }

  // ==================== Panel Rendering ====================

  private _formatBlockType(type: string): string {
    // Format "minecraft:stone_bricks" to "Stone Bricks"
    const name = type.replace("minecraft:", "");
    return name
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  private _renderBrushPanel(): React.ReactNode {
    const brushShape = this._state.shape;
    const brushTarget = this._state.target;
    const hasHover = this._lastHoverInfo?.x !== undefined;

    return (
      <>
        <div className="ve-panel-header">
          <span className="ve-panel-icon">{this.icon}</span>
          <span className="ve-panel-title">{this.displayName}</span>
        </div>

        {/* Brush Settings Section */}
        <div className="ve-panel-section">
          <div className="ve-panel-section-title">Brush Settings</div>

          <div className="ve-panel-field">
            <label className="ve-panel-field-label">Shape</label>
            <select
              className="ve-panel-select"
              value={brushShape}
              onChange={(e) => this.setState({ shape: parseInt(e.target.value) as BrushShape })}
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
              value={this._state.blockType}
              onChange={(blockType) => this.setState({ blockType })}
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
                  checked={this._state.uniform}
                  onChange={(e) => this.setState({ uniform: e.target.checked })}
                />
                <span>Uniform</span>
              </label>
            </div>

            {this._state.uniform ? (
              <div className="ve-panel-field">
                <label className="ve-panel-field-label">Size (1-16)</label>
                <input
                  type="range"
                  className="ve-panel-slider"
                  min={1}
                  max={16}
                  value={this._state.sizeX}
                  onChange={(e) => this.setState({ sizeX: parseInt(e.target.value) })}
                />
                <span className="ve-panel-slider-value">{this._state.sizeX}</span>
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
                    value={this._state.sizeX}
                    onChange={(e) => this.setState({ sizeX: parseInt(e.target.value) })}
                  />
                  <span className="ve-panel-slider-value">{this._state.sizeX}</span>
                </div>
                <div className="ve-panel-field">
                  <label className="ve-panel-field-label">Height (Y)</label>
                  <input
                    type="range"
                    className="ve-panel-slider"
                    min={1}
                    max={16}
                    value={this._state.sizeY}
                    onChange={(e) => this.setState({ sizeY: parseInt(e.target.value) })}
                  />
                  <span className="ve-panel-slider-value">{this._state.sizeY}</span>
                </div>
                <div className="ve-panel-field">
                  <label className="ve-panel-field-label">Depth (Z)</label>
                  <input
                    type="range"
                    className="ve-panel-slider"
                    min={1}
                    max={16}
                    value={this._state.sizeZ}
                    onChange={(e) => this.setState({ sizeZ: parseInt(e.target.value) })}
                  />
                  <span className="ve-panel-slider-value">{this._state.sizeZ}</span>
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
              onChange={(e) => this.setState({ target: parseInt(e.target.value) as CursorTarget })}
            >
              <option value={CursorTarget.Block}>Block (Replace)</option>
              <option value={CursorTarget.Adjacent}>Adjacent (Place Above)</option>
            </select>
          </div>
        </div>

        {/* Hover Block Info */}
        {hasHover && this._lastHoverInfo?.blockType && (
          <div className="ve-panel-section">
            <div className="ve-panel-section-title">Hovered Block</div>
            <div className="ve-panel-block-info">
              <div className="ve-panel-block-name">{this._formatBlockType(this._lastHoverInfo.blockType)}</div>
              <div className="ve-panel-block-type">{this._lastHoverInfo.blockType}</div>
              <div className="ve-panel-block-coords">
                {this._lastHoverInfo.x}, {this._lastHoverInfo.y}, {this._lastHoverInfo.z}
              </div>
            </div>
          </div>
        )}
      </>
    );
  }
}
