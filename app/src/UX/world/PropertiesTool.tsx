// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * ==========================================================================================
 * PROPERTIES TOOL FOR VOLUME EDITOR
 * ==========================================================================================
 *
 * The Properties tool displays and allows editing of the structure's dimensions (X, Y, Z).
 * Resizing is corner-anchored (origin stays at 0,0,0) with a max of 64 per axis.
 * Shrinking triggers an inline confirmation since it discards blocks outside the new bounds.
 *
 * ==========================================================================================
 */

import React from "react";
import { VolumeEditorToolBase, IToolHoverInfo, IToolClickResult, IToolState } from "./IVolumeEditorTool";

const MAX_DIMENSION = 64;
const MIN_DIMENSION = 1;

export interface IPropertiesToolState extends IToolState {
  newX: number;
  newY: number;
  newZ: number;
  showConfirm: boolean;
}

export function getDefaultPropertiesState(): IPropertiesToolState {
  return {
    newX: 1,
    newY: 1,
    newZ: 1,
    showConfirm: false,
  };
}

export class PropertiesTool extends VolumeEditorToolBase {
  readonly id = "properties";
  readonly displayName = "Properties";
  readonly icon = "⚙";
  readonly shortcutKey = "R";
  readonly tooltip = "Properties (R) - View and resize structure dimensions";

  private _state: IPropertiesToolState = getDefaultPropertiesState();
  private _onResizeRequested: ((newX: number, newY: number, newZ: number) => void) | undefined;

  setOnResizeRequested(callback: ((newX: number, newY: number, newZ: number) => void) | undefined) {
    this._onResizeRequested = callback;
  }

  protected onActivate(): void {
    if (this._context?.blockVolume) {
      this._state.newX = this._context.blockVolume.maxX;
      this._state.newY = this._context.blockVolume.maxY;
      this._state.newZ = this._context.blockVolume.maxZ;
      this._state.showConfirm = false;
    }
  }

  onHover(_hoverInfo: IToolHoverInfo): void {}
  onHoverEnd(): void {}
  onClick(_hoverInfo: IToolHoverInfo): IToolClickResult {
    return { handled: false, modified: false };
  }

  getState(): IToolState {
    return { ...this._state };
  }

  setState(state: Partial<IToolState>): void {
    Object.assign(this._state, state);
    this._context?.requestPanelUpdate();
  }

  private _clamp(val: number): number {
    return Math.max(MIN_DIMENSION, Math.min(MAX_DIMENSION, Math.round(val) || MIN_DIMENSION));
  }

  private _isShrinking(): boolean {
    if (!this._context?.blockVolume) return false;
    const bv = this._context.blockVolume;
    return this._state.newX < bv.maxX || this._state.newY < bv.maxY || this._state.newZ < bv.maxZ;
  }

  private _hasChanged(): boolean {
    if (!this._context?.blockVolume) return false;
    const bv = this._context.blockVolume;
    return this._state.newX !== bv.maxX || this._state.newY !== bv.maxY || this._state.newZ !== bv.maxZ;
  }

  private _handleDimensionChange = (axis: "newX" | "newY" | "newZ", value: number) => {
    this._state[axis] = this._clamp(value);
    this._state.showConfirm = false;
    this._context?.requestPanelUpdate();
  };

  private _handleApply = () => {
    if (!this._hasChanged()) return;

    if (this._isShrinking() && !this._state.showConfirm) {
      this._state.showConfirm = true;
      this._context?.requestPanelUpdate();
      return;
    }

    this._doResize();
  };

  private _handleConfirm = () => {
    this._doResize();
  };

  private _handleCancel = () => {
    this._state.showConfirm = false;
    this._context?.requestPanelUpdate();
  };

  private _doResize() {
    if (!this._onResizeRequested) return;
    this._onResizeRequested(this._state.newX, this._state.newY, this._state.newZ);

    this._state.showConfirm = false;
    this._context?.requestPanelUpdate();
  }

  renderPanel(): React.ReactNode {
    const bv = this._context?.blockVolume;
    if (!bv) return null;

    const currentX = bv.maxX;
    const currentY = bv.maxY;
    const currentZ = bv.maxZ;
    const changed = this._hasChanged();
    const shrinking = this._isShrinking();

    return (
      <>
        <div className="ve-panel-header">
          <span className="ve-panel-title">Properties</span>
        </div>

        <div className="ve-panel-section">
          <div className="ve-panel-section-title">
            Dimensions ({currentX} × {currentY} × {currentZ})
          </div>

          <div className="ve-panel-field">
            <label className="ve-panel-field-label">Width (X)</label>
            <input
              type="number"
              className="ve-panel-number-input"
              style={{ width: "100%" }}
              value={this._state.newX}
              min={MIN_DIMENSION}
              max={MAX_DIMENSION}
              onChange={(e) => this._handleDimensionChange("newX", parseInt(e.target.value))}
            />
          </div>

          <div className="ve-panel-field">
            <label className="ve-panel-field-label">Height (Y)</label>
            <input
              type="number"
              className="ve-panel-number-input"
              style={{ width: "100%" }}
              value={this._state.newY}
              min={MIN_DIMENSION}
              max={MAX_DIMENSION}
              onChange={(e) => this._handleDimensionChange("newY", parseInt(e.target.value))}
            />
          </div>

          <div className="ve-panel-field">
            <label className="ve-panel-field-label">Depth (Z)</label>
            <input
              type="number"
              className="ve-panel-number-input"
              style={{ width: "100%" }}
              value={this._state.newZ}
              min={MIN_DIMENSION}
              max={MAX_DIMENSION}
              onChange={(e) => this._handleDimensionChange("newZ", parseInt(e.target.value))}
            />
          </div>
        </div>

        {changed && !this._state.showConfirm && (
          <div className="ve-panel-section">
            <div className="ve-panel-actions">
              <button className="ve-panel-btn" onClick={this._handleApply}>
                {shrinking ? "Resize…" : "Resize"}
              </button>
            </div>
          </div>
        )}

        {this._state.showConfirm && (
          <div className="ve-panel-section">
            <div className="ve-props-warning">
              Shrinking will permanently remove blocks outside the new bounds.
              {this._state.newX < currentX && (
                <div>
                  X: {currentX} → {this._state.newX} (−{currentX - this._state.newX})
                </div>
              )}
              {this._state.newY < currentY && (
                <div>
                  Y: {currentY} → {this._state.newY} (−{currentY - this._state.newY})
                </div>
              )}
              {this._state.newZ < currentZ && (
                <div>
                  Z: {currentZ} → {this._state.newZ} (−{currentZ - this._state.newZ})
                </div>
              )}
            </div>
            <div className="ve-panel-actions" style={{ gap: "8px", marginTop: "8px" }}>
              <button className="ve-panel-btn ve-panel-btn-danger" onClick={this._handleConfirm}>
                Confirm Resize
              </button>
              <button className="ve-panel-btn" onClick={this._handleCancel}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </>
    );
  }
}
