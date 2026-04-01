// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * ==========================================================================================
 * HELP TOOL FOR VOLUME EDITOR
 * ==========================================================================================
 *
 * The Help tool displays keyboard shortcuts and controls reference for the Volume Editor.
 * This is a read-only informational tool that shows users how to navigate and use the editor.
 *
 * FEATURES:
 * - Camera movement shortcuts (WASD, Q, E, G)
 * - Selection controls (arrow keys, Shift/Alt+Click)
 * - Tool shortcuts (S, B, P, I)
 * - Mouse controls (right-drag, scroll, click)
 * - Undo/Redo shortcuts (Ctrl+Z, Ctrl+Y)
 *
 * ==========================================================================================
 */

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
 * State for the Help tool (minimal - no real state needed).
 */
export interface IHelpToolState extends IToolState {
  // No state needed for help tool
}

/**
 * Default state for a new help tool.
 */
export function getDefaultHelpState(): IHelpToolState {
  return {};
}

/**
 * HelpTool implements IVolumeEditorTool for displaying keyboard shortcuts and controls.
 */
export class HelpTool implements IVolumeEditorTool {
  readonly id = "help";
  readonly displayName = "Controls";
  readonly icon = "⌨";
  readonly shortcutKey = "?";
  readonly tooltip = "Controls (?) - View keyboard shortcuts";

  private _state: IHelpToolState;
  private _context: IVolumeEditorContext | undefined;
  private _isActive: boolean = false;

  constructor(initialState?: Partial<IHelpToolState>) {
    this._state = { ...getDefaultHelpState(), ...initialState };
  }

  // ==================== IVolumeEditorTool Implementation ====================

  activate(context: IVolumeEditorContext): void {
    this._context = context;
    this._isActive = true;
  }

  deactivate(): void {
    this._context = undefined;
    this._isActive = false;
  }

  onHover(_hoverInfo: IToolHoverInfo): void {
    // Help tool doesn't need to respond to hover
  }

  onHoverEnd(): void {
    // Help tool doesn't need to respond to hover end
  }

  onClick(_hoverInfo: IToolHoverInfo): IToolClickResult {
    // Help tool doesn't handle clicks in a special way
    return { handled: false, modified: false };
  }

  onKeyDown(_event: KeyboardEvent, _hoverInfo: IToolHoverInfo): IToolKeyResult {
    return { handled: false };
  }

  getState(): IHelpToolState {
    return { ...this._state };
  }

  setState(state: Partial<IHelpToolState>): void {
    this._state = { ...this._state, ...state };
    this._context?.requestPanelUpdate();
  }

  renderPanel(): React.ReactNode {
    return (
      <>
        <div className="ve-panel-header">
          <span className="ve-panel-title">Keyboard Shortcuts</span>
        </div>

        {/* Camera Movement */}
        <div className="ve-panel-section">
          <div className="ve-panel-section-title">Camera Movement</div>
          <div className="ve-help-row">
            <span className="ve-help-key">W A S D</span>
            <span className="ve-help-action">Move</span>
          </div>
          <div className="ve-help-row">
            <span className="ve-help-key">Q</span>
            <span className="ve-help-action">Move Down</span>
          </div>
          <div className="ve-help-row">
            <span className="ve-help-key">E</span>
            <span className="ve-help-action">Move Up</span>
          </div>
          <div className="ve-help-row">
            <span className="ve-help-key">G</span>
            <span className="ve-help-action">Fly to Cursor</span>
          </div>
        </div>

        {/* Selection */}
        <div className="ve-panel-section">
          <div className="ve-panel-section-title">Selection</div>
          <div className="ve-help-row">
            <span className="ve-help-key">← → ↑ ↓</span>
            <span className="ve-help-action">Move Cursor</span>
          </div>
          <div className="ve-help-row">
            <span className="ve-help-key">PgUp/Dn</span>
            <span className="ve-help-action">Cursor Up/Down</span>
          </div>
          <div className="ve-help-row">
            <span className="ve-help-key">Ctrl+D</span>
            <span className="ve-help-action">Deselect</span>
          </div>
          <div className="ve-help-row">
            <span className="ve-help-key">Shift+Click</span>
            <span className="ve-help-action">Set Z extent</span>
          </div>
          <div className="ve-help-row">
            <span className="ve-help-key">Alt+Click</span>
            <span className="ve-help-action">Set Y extent</span>
          </div>
        </div>

        {/* Tools */}
        <div className="ve-panel-section">
          <div className="ve-panel-section-title">Tools</div>
          <div className="ve-help-row">
            <span className="ve-help-key">S</span>
            <span className="ve-help-action">Selection Tool</span>
          </div>
          <div className="ve-help-row">
            <span className="ve-help-key">B</span>
            <span className="ve-help-action">Brush Tool</span>
          </div>
          <div className="ve-help-row">
            <span className="ve-help-key">P</span>
            <span className="ve-help-action">Pencil Tool</span>
          </div>
          <div className="ve-help-row">
            <span className="ve-help-key">I</span>
            <span className="ve-help-action">Block Inspector</span>
          </div>
          <div className="ve-help-row">
            <span className="ve-help-key">Space/Enter</span>
            <span className="ve-help-action">Paint (Brush/Pencil)</span>
          </div>
        </div>

        {/* Undo/Redo */}
        <div className="ve-panel-section">
          <div className="ve-panel-section-title">History</div>
          <div className="ve-help-row">
            <span className="ve-help-key">Ctrl+Z</span>
            <span className="ve-help-action">Undo</span>
          </div>
          <div className="ve-help-row">
            <span className="ve-help-key">Ctrl+Y</span>
            <span className="ve-help-action">Redo</span>
          </div>
          <div className="ve-help-row">
            <span className="ve-help-key">Ctrl+Shift+Z</span>
            <span className="ve-help-action">Redo (Alt)</span>
          </div>
        </div>

        {/* Mouse */}
        <div className="ve-panel-section">
          <div className="ve-panel-section-title">Mouse</div>
          <div className="ve-help-row">
            <span className="ve-help-key">Right-drag</span>
            <span className="ve-help-action">Rotate Camera</span>
          </div>
          <div className="ve-help-row">
            <span className="ve-help-key">Scroll</span>
            <span className="ve-help-action">Zoom</span>
          </div>
          <div className="ve-help-row">
            <span className="ve-help-key">Click</span>
            <span className="ve-help-action">Select/Paint Block</span>
          </div>
        </div>
      </>
    );
  }

  renderToolbar(): React.ReactNode {
    return null;
  }
}
