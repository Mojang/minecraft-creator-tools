// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * ==========================================================================================
 * BLOCK INSPECTOR TOOL FOR VOLUME EDITOR
 * ==========================================================================================
 *
 * The Block Inspector tool allows users to click on blocks to view their properties,
 * including block type, position, and state properties. This is a read-only tool
 * that helps users understand the current state of blocks in the volume.
 *
 * FEATURES:
 * - Click to inspect any block
 * - View block type and formatted display name
 * - View block position (X, Y, Z coordinates)
 * - View all block state properties
 * - Hover info shows blocks before clicking
 * - Refresh to see updated properties
 * - Clear selection
 *
 * USAGE:
 * The tool is instantiated by VolumeEditor and receives callbacks and context through
 * the IVolumeEditorTool interface. This allows the tool to:
 * - Access the block volume to read block data
 * - Display block information in the panel
 *
 * @see https://learn.microsoft.com/en-us/minecraft/creator/documents/bedrockeditor/editorblockinspector
 *
 * ==========================================================================================
 */

import * as BABYLON from "babylonjs";
import React from "react";
import {
  IVolumeEditorTool,
  IVolumeEditorContext,
  IToolHoverInfo,
  IToolClickResult,
  IToolKeyResult,
  IToolState,
} from "./IVolumeEditorTool";

/**
 * State for the Block Inspector tool.
 */
export interface IBlockInspectorToolState extends IToolState {
  /** X coordinate of inspected block (undefined if none) */
  inspectedX: number | undefined;
  /** Y coordinate of inspected block */
  inspectedY: number | undefined;
  /** Z coordinate of inspected block */
  inspectedZ: number | undefined;
  /** Block type at inspected position */
  inspectedBlockType: string | undefined;
  /** Block state properties */
  inspectedBlockProperties: { [key: string]: string | number | boolean } | undefined;
}

/**
 * Default state for a new block inspector tool.
 */
export function getDefaultBlockInspectorState(): IBlockInspectorToolState {
  return {
    inspectedX: undefined,
    inspectedY: undefined,
    inspectedZ: undefined,
    inspectedBlockType: undefined,
    inspectedBlockProperties: undefined,
  };
}

/**
 * BlockInspectorTool implements IVolumeEditorTool for block inspection functionality.
 */
export class BlockInspectorTool implements IVolumeEditorTool {
  readonly id = "blockInspector";
  readonly displayName = "Block Inspector";
  readonly icon = "🔍";
  readonly shortcutKey = "I";
  readonly tooltip = "Block Inspector (I) - View block properties";

  private _state: IBlockInspectorToolState;
  private _context: IVolumeEditorContext | undefined;
  private _isActive: boolean = false;
  private _lastHoverInfo: IToolHoverInfo | undefined;
  private _highlightMesh: BABYLON.Mesh | undefined;

  constructor(initialState?: Partial<IBlockInspectorToolState>) {
    this._state = { ...getDefaultBlockInspectorState(), ...initialState };
  }

  // ==================== IVolumeEditorTool Implementation ====================

  activate(context: IVolumeEditorContext): void {
    this._context = context;
    this._isActive = true;
    this._createHighlightMesh();
  }

  deactivate(): void {
    this._disposeHighlightMesh();
    this._clearInspectedBlock();
    this._context = undefined;
    this._isActive = false;
    this._lastHoverInfo = undefined;
  }

  onHover(hoverInfo: IToolHoverInfo): void {
    this._lastHoverInfo = hoverInfo;
    this._updateHighlightMesh(hoverInfo);
    // Request panel update to show hover info
    this._context?.requestPanelUpdate();
  }

  onHoverEnd(): void {
    this._lastHoverInfo = undefined;
    this._hideHighlightMesh();
    this._context?.requestPanelUpdate();
  }

  onClick(hoverInfo: IToolHoverInfo): IToolClickResult {
    if (hoverInfo.x === undefined || hoverInfo.y === undefined || hoverInfo.z === undefined) {
      return { handled: false, modified: false };
    }

    // Inspect the clicked block
    this._inspectBlockAt(hoverInfo.x, hoverInfo.y, hoverInfo.z);

    return { handled: true, modified: false };
  }

  onKeyDown(_event: KeyboardEvent, _hoverInfo: IToolHoverInfo): IToolKeyResult {
    return { handled: false };
  }

  getState(): IBlockInspectorToolState {
    return { ...this._state };
  }

  setState(state: Partial<IBlockInspectorToolState>): void {
    this._state = { ...this._state, ...state };
    this._context?.requestPanelUpdate();
  }

  renderPanel(): React.ReactNode {
    const hasInspectedBlock = this._state.inspectedX !== undefined;
    const hasHover = this._lastHoverInfo?.x !== undefined;
    const properties = this._state.inspectedBlockProperties;
    const hasProperties = properties && Object.keys(properties).length > 0;

    return (
      <>
        <div className="ve-panel-header">
          <span className="ve-panel-title">{this.displayName}</span>
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
                  <div className="ve-panel-block-name">{this._formatBlockType(this._state.inspectedBlockType)}</div>
                  <div className="ve-panel-block-type">{this._state.inspectedBlockType}</div>
                </div>
              </div>

              <div className="ve-panel-field">
                <label className="ve-panel-field-label">Position</label>
                <div className="ve-panel-coords">
                  <div className="ve-panel-coord">
                    <span className="ve-panel-coord-label">X</span>
                    <span className="ve-panel-coord-value">{this._state.inspectedX}</span>
                  </div>
                  <div className="ve-panel-coord">
                    <span className="ve-panel-coord-label">Y</span>
                    <span className="ve-panel-coord-value">{this._state.inspectedY}</span>
                  </div>
                  <div className="ve-panel-coord">
                    <span className="ve-panel-coord-label">Z</span>
                    <span className="ve-panel-coord-value">{this._state.inspectedZ}</span>
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
          this._lastHoverInfo?.blockType &&
          (this._lastHoverInfo.x !== this._state.inspectedX ||
            this._lastHoverInfo.y !== this._state.inspectedY ||
            this._lastHoverInfo.z !== this._state.inspectedZ) && (
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

  renderToolbar(): React.ReactNode {
    return null;
  }

  // ==================== Block Inspection Logic ====================

  /**
   * Inspects the block at the given coordinates.
   * Sets the inspected block state with position, type, and properties.
   */
  private _inspectBlockAt(x: number, y: number, z: number): void {
    if (!this._context?.blockVolume) {
      return;
    }

    const blockVolume = this._context.blockVolume;

    // Check bounds
    if (x < 0 || y < 0 || z < 0 || x >= this._context.maxX || y >= this._context.maxY || z >= this._context.maxZ) {
      return;
    }

    const block = blockVolume.x(x).y(y).z(z);
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

    this._state = {
      ...this._state,
      inspectedX: x,
      inspectedY: y,
      inspectedZ: z,
      inspectedBlockType: block.typeName,
      inspectedBlockProperties: Object.keys(properties).length > 0 ? properties : undefined,
    };

    this._context?.requestPanelUpdate();
  }

  /**
   * Clears the currently inspected block.
   */
  private _clearInspectedBlock(): void {
    this._state = {
      ...this._state,
      inspectedX: undefined,
      inspectedY: undefined,
      inspectedZ: undefined,
      inspectedBlockType: undefined,
      inspectedBlockProperties: undefined,
    };
    this._context?.requestPanelUpdate();
  }

  /**
   * Refreshes the inspected block properties from the current block state.
   */
  private _refreshInspectedBlock(): void {
    const x = this._state.inspectedX;
    const y = this._state.inspectedY;
    const z = this._state.inspectedZ;

    if (x !== undefined && y !== undefined && z !== undefined) {
      this._inspectBlockAt(x, y, z);
    }
  }

  /**
   * Formats a block type for display (removes minecraft: prefix, title case).
   */
  private _formatBlockType(blockType: string | undefined): string {
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

  // ==================== Highlight Mesh ====================

  /**
   * Creates the highlight mesh used to show the hovered block.
   */
  private _createHighlightMesh(): void {
    if (!this._context?.scene) {
      return;
    }

    // Dispose existing mesh
    this._disposeHighlightMesh();

    // Create a wireframe box for the highlight
    this._highlightMesh = BABYLON.MeshBuilder.CreateBox(
      "blockInspectorHighlight",
      { size: 1.02 }, // Slightly larger than block
      this._context.scene
    );

    // Create wireframe material
    const material = new BABYLON.StandardMaterial("blockInspectorHighlightMat", this._context.scene);
    material.wireframe = true;
    material.emissiveColor = new BABYLON.Color3(0, 1, 1); // Cyan wireframe
    material.disableLighting = true;

    this._highlightMesh.material = material;
    this._highlightMesh.isVisible = false;
    this._highlightMesh.isPickable = false;
  }

  /**
   * Updates the highlight mesh position based on hover info.
   */
  private _updateHighlightMesh(hoverInfo: IToolHoverInfo): void {
    if (!this._highlightMesh || !this._context) {
      return;
    }

    if (hoverInfo.x === undefined || hoverInfo.y === undefined || hoverInfo.z === undefined) {
      this._highlightMesh.isVisible = false;
      return;
    }

    // Convert to visual coordinates
    const visualPos = this._context.dataToVisualCoords(hoverInfo.x, hoverInfo.y, hoverInfo.z);
    this._highlightMesh.position = visualPos;
    this._highlightMesh.isVisible = true;
  }

  /**
   * Hides the highlight mesh.
   */
  private _hideHighlightMesh(): void {
    if (this._highlightMesh) {
      this._highlightMesh.isVisible = false;
    }
  }

  /**
   * Disposes the highlight mesh.
   */
  private _disposeHighlightMesh(): void {
    if (this._highlightMesh) {
      this._highlightMesh.dispose();
      this._highlightMesh = undefined;
    }
  }
}
