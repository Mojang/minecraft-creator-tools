// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * ==========================================================================================
 * PENCIL TOOL FOR VOLUME EDITOR
 * ==========================================================================================
 *
 * The Pencil tool allows precise single-block placement with various modes:
 * - Standard: Place blocks at cursor position
 * - Replace: Replace existing blocks with new block type
 * - Sample: Pick block type from existing blocks (eyedropper)
 *
 * FEATURES:
 * - Multiple placement modes (Standard, Replace, Sample)
 * - Block facing direction control
 * - Offset adjustment for precise placement
 * - Visual preview of placement position
 * - Undo/redo support
 *
 * USAGE:
 * The tool is instantiated by VolumeEditor and implements IVolumeEditorTool interface.
 *
 * @see https://learn.microsoft.com/en-us/minecraft/creator/documents/bedrockeditor/editorpenciltool
 *
 * ==========================================================================================
 */

import * as BABYLON from "babylonjs";
import React from "react";
import { VolumeActionType } from "./VolumeEditorUndoManager";
import { PencilMode, PencilBlockFacing, CursorTarget } from "./VolumeEditorTypes";
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
 * State for the Pencil tool.
 */
export interface IPencilToolState extends IToolState {
  /** Current pencil mode */
  mode: PencilMode;
  /** Block facing direction */
  facing: PencilBlockFacing;
  /** Block type to place */
  blockType: string;
  /** X offset for placement */
  offsetX: number;
  /** Y offset for placement */
  offsetY: number;
  /** Z offset for placement */
  offsetZ: number;
  /** Cursor target mode */
  cursorTarget: CursorTarget;
}

/**
 * Default state for a new pencil tool.
 */
export function getDefaultPencilState(): IPencilToolState {
  return {
    mode: PencilMode.Standard,
    facing: PencilBlockFacing.Player,
    blockType: "minecraft:stone",
    offsetX: 0,
    offsetY: 0,
    offsetZ: 0,
    cursorTarget: CursorTarget.Adjacent,
  };
}

/**
 * PencilTool implements IVolumeEditorTool for single-block placement functionality.
 */
export class PencilTool implements IVolumeEditorTool {
  readonly id = "pencil";
  readonly displayName = "Pencil";
  readonly icon = "✏️";
  readonly shortcutKey = "P";
  readonly tooltip = "Pencil Tool (P) - Place single blocks";

  private _state: IPencilToolState;
  private _context: IVolumeEditorContext | undefined;
  private _previewMesh: BABYLON.Mesh | undefined;
  private _isActive: boolean = false;
  private _lastHoverInfo: IToolHoverInfo | undefined;

  constructor(initialState?: Partial<IPencilToolState>) {
    this._state = { ...getDefaultPencilState(), ...initialState };
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
    // Pencil tool doesn't have special key handlers yet
    return { handled: false };
  }

  getState(): IPencilToolState {
    return { ...this._state };
  }

  setState(newState: Partial<IPencilToolState>): void {
    this._state = { ...this._state, ...newState };

    // Update preview if state changed
    if (this._lastHoverInfo) {
      this._updatePreview(this._lastHoverInfo);
    }

    // Request panel update to reflect state changes
    this._context?.requestPanelUpdate();
  }

  renderPanel(): React.ReactNode {
    return this._renderPencilPanel();
  }

  renderToolbar(): React.ReactNode {
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

    // Calculate placement position with offsets
    let placeX = hoverInfo.x + this._state.offsetX;
    let placeY = hoverInfo.y + this._state.offsetY;
    let placeZ = hoverInfo.z + this._state.offsetZ;

    // Adjust for Adjacent target
    if (this._state.cursorTarget === CursorTarget.Adjacent) {
      placeX += hoverInfo.faceOffsetX;
      placeY += hoverInfo.faceOffsetY;
      placeZ += hoverInfo.faceOffsetZ;
    }

    // Clear existing preview
    this._clearPreview();

    // Create a cube for pencil (single block preview)
    this._previewMesh = BABYLON.MeshBuilder.CreateBox("pencilPreview", { size: 1.02 }, this._context.scene);

    // Position at placement location using visual coordinates
    const visualPos = this._context.dataToVisualCoords(placeX, placeY, placeZ);
    this._previewMesh.position = new BABYLON.Vector3(visualPos.x, visualPos.y, visualPos.z);

    // Create semi-transparent material - color based on mode
    const material = new BABYLON.StandardMaterial("pencilPreviewMat", this._context.scene);

    switch (this._state.mode) {
      case PencilMode.Sample:
        material.diffuseColor = new BABYLON.Color3(1.0, 0.8, 0.2); // Yellow for sample
        break;
      case PencilMode.Replace:
        material.diffuseColor = new BABYLON.Color3(1.0, 0.5, 0.3); // Orange for replace
        break;
      default:
        material.diffuseColor = new BABYLON.Color3(0.3, 1.0, 0.5); // Green for standard
    }

    material.alpha = 0.4;
    material.backFaceCulling = false;
    this._previewMesh.material = material;

    // Enable edge rendering
    this._previewMesh.enableEdgesRendering();
    this._previewMesh.edgesWidth = 3.0;
    this._previewMesh.edgesColor = new BABYLON.Color4(0.4, 1.0, 0.6, 0.9);
  }

  // ==================== Painting ====================

  private _paint(hoverInfo: IToolHoverInfo): boolean {
    if (!this._context?.blockVolume || !this._isActive) {
      return false;
    }

    const { x: hoverX, y: hoverY, z: hoverZ } = hoverInfo;
    if (hoverX === undefined || hoverY === undefined || hoverZ === undefined) {
      return false;
    }

    const blockVolume = this._context.blockVolume;

    // Handle Sample mode - pick block type
    if (this._state.mode === PencilMode.Sample) {
      const block = blockVolume.x(hoverX).y(hoverY).z(hoverZ);
      if (block && block.typeName) {
        this.setState({ blockType: block.typeName, mode: PencilMode.Standard });
      }
      return true;
    }

    // Calculate placement position with offsets
    let placeX = hoverX + this._state.offsetX;
    let placeY = hoverY + this._state.offsetY;
    let placeZ = hoverZ + this._state.offsetZ;

    // Adjust for Adjacent target
    if (this._state.cursorTarget === CursorTarget.Adjacent) {
      placeX += hoverInfo.faceOffsetX;
      placeY += hoverInfo.faceOffsetY;
      placeZ += hoverInfo.faceOffsetZ;
    }

    // Check bounds
    if (!this._context.isWithinBounds(placeX, placeY, placeZ)) {
      return false;
    }

    // Begin undo action
    const pencilDesc = `Pencil: ${this._state.blockType.replace("minecraft:", "")}`;
    this._context.undoManager.beginAction(VolumeActionType.Pencil, pencilDesc);

    // Record BEFORE state
    this._context.undoManager.recordBlockBefore(blockVolume, placeX, placeY, placeZ);

    // Set block type
    const block = blockVolume.x(placeX).y(placeY).z(placeZ);
    if (block) {
      block.typeName = this._state.blockType;
      // Note: facing/rotation could be applied here via block states
    }

    // Record AFTER state
    this._context.undoManager.recordBlockAfter(blockVolume, placeX, placeY, placeZ);

    // Finalize undo action
    this._context.undoManager.endAction();

    // Update visual mesh
    this._context.updateBlockMesh(placeX, placeY, placeZ);

    return true;
  }

  // ==================== Panel Rendering ====================

  private _formatBlockType(type: string): string {
    const name = type.replace("minecraft:", "");
    return name
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  private _renderPencilPanel(): React.ReactNode {
    const pencilMode = this._state.mode;
    const cursorTarget = this._state.cursorTarget;
    const hasHover = this._lastHoverInfo?.x !== undefined;

    return (
      <>
        <div className="ve-panel-header">
          <span className="ve-panel-icon">{this.icon}</span>
          <span className="ve-panel-title">{this.displayName}</span>
        </div>

        {/* Pencil Mode Section */}
        <div className="ve-panel-section">
          <div className="ve-panel-section-title">Mode</div>

          <div className="ve-panel-field">
            <select
              className="ve-panel-select"
              value={pencilMode}
              onChange={(e) => this.setState({ mode: parseInt(e.target.value) as PencilMode })}
            >
              <option value={PencilMode.Standard}>Standard (Place)</option>
              <option value={PencilMode.Replace}>Replace Block</option>
              <option value={PencilMode.Sample}>Sample (Eyedropper)</option>
            </select>
          </div>
        </div>

        {/* Block Settings - only for Standard and Replace modes */}
        {pencilMode !== PencilMode.Sample && (
          <div className="ve-panel-section">
            <div className="ve-panel-section-title">Block Settings</div>

            <div className="ve-panel-field">
              <label className="ve-panel-field-label">Block Type</label>
              <BlockTypePicker
                value={this._state.blockType}
                onChange={(blockType) => this.setState({ blockType })}
                placeholder="Search blocks..."
              />
            </div>

            <div className="ve-panel-field">
              <label className="ve-panel-field-label">Facing</label>
              <select
                className="ve-panel-select"
                value={this._state.facing}
                onChange={(e) => this.setState({ facing: parseInt(e.target.value) as PencilBlockFacing })}
              >
                <option value={PencilBlockFacing.Player}>Toward Player</option>
                <option value={PencilBlockFacing.North}>North</option>
                <option value={PencilBlockFacing.East}>East</option>
                <option value={PencilBlockFacing.South}>South</option>
                <option value={PencilBlockFacing.West}>West</option>
                <option value={PencilBlockFacing.Up}>Up</option>
                <option value={PencilBlockFacing.Down}>Down</option>
              </select>
            </div>
          </div>
        )}

        {/* Cursor Settings */}
        <div className="ve-panel-section">
          <div className="ve-panel-section-title">Cursor Settings</div>

          <div className="ve-panel-field">
            <label className="ve-panel-field-label">Target</label>
            <select
              className="ve-panel-select"
              value={cursorTarget}
              onChange={(e) => this.setState({ cursorTarget: parseInt(e.target.value) as CursorTarget })}
            >
              <option value={CursorTarget.Block}>Block (Replace)</option>
              <option value={CursorTarget.Adjacent}>Adjacent (Place Next To)</option>
            </select>
          </div>
        </div>

        {/* Offset Settings */}
        <div className="ve-panel-section">
          <div className="ve-panel-section-title">Offset</div>

          <div className="ve-panel-field">
            <label className="ve-panel-field-label">X</label>
            <input
              type="range"
              className="ve-panel-slider"
              min={-8}
              max={8}
              value={this._state.offsetX}
              onChange={(e) => this.setState({ offsetX: parseInt(e.target.value) })}
            />
            <input
              type="number"
              className="ve-panel-number-input"
              min={-8}
              max={8}
              value={this._state.offsetX}
              onChange={(e) => this.setState({ offsetX: parseInt(e.target.value) || 0 })}
            />
          </div>

          <div className="ve-panel-field">
            <label className="ve-panel-field-label">Y</label>
            <input
              type="range"
              className="ve-panel-slider"
              min={-8}
              max={8}
              value={this._state.offsetY}
              onChange={(e) => this.setState({ offsetY: parseInt(e.target.value) })}
            />
            <input
              type="number"
              className="ve-panel-number-input"
              min={-8}
              max={8}
              value={this._state.offsetY}
              onChange={(e) => this.setState({ offsetY: parseInt(e.target.value) || 0 })}
            />
          </div>

          <div className="ve-panel-field">
            <label className="ve-panel-field-label">Z</label>
            <input
              type="range"
              className="ve-panel-slider"
              min={-8}
              max={8}
              value={this._state.offsetZ}
              onChange={(e) => this.setState({ offsetZ: parseInt(e.target.value) })}
            />
            <input
              type="number"
              className="ve-panel-number-input"
              min={-8}
              max={8}
              value={this._state.offsetZ}
              onChange={(e) => this.setState({ offsetZ: parseInt(e.target.value) || 0 })}
            />
          </div>

          {(this._state.offsetX !== 0 || this._state.offsetY !== 0 || this._state.offsetZ !== 0) && (
            <div className="ve-panel-actions">
              <button className="ve-panel-btn" onClick={() => this.setState({ offsetX: 0, offsetY: 0, offsetZ: 0 })}>
                Reset Offsets
              </button>
            </div>
          )}
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
