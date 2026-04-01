// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * ==========================================================================================
 * VOLUME EDITOR UNDO/REDO SYSTEM
 * ==========================================================================================
 *
 * This module provides undo/redo functionality for the VolumeEditor component.
 *
 * ARCHITECTURE:
 * -------------
 * The undo system works by capturing the state of affected blocks BEFORE an action
 * is applied, then storing both the "before" and "after" states. This allows for
 * efficient undo (restore "before") and redo (restore "after") operations.
 *
 * KEY CONCEPTS:
 * - VolumeEditorAction: Represents a single undoable action (pencil stroke, brush paint, etc.)
 * - BlockSnapshot: Captures the state of a single block (type and properties)
 * - VolumeSnapshot: Collection of block snapshots for a region
 *
 * USAGE PATTERN:
 * 1. Call beginAction() before modifying blocks
 * 2. Call recordBlockState() for each block that will be modified
 * 3. Perform the actual block modifications
 * 4. Call endAction() to finalize and push to undo stack
 *
 * MEMORY MANAGEMENT:
 * - Only affected blocks are stored, not the entire volume
 * - Maximum undo stack size is configurable (default: 50)
 * - Oldest actions are discarded when limit is reached
 *
 * ==========================================================================================
 */

import BlockVolume from "../../minecraft/BlockVolume";

/**
 * Represents the state of a single block at a point in time.
 */
export interface IBlockSnapshot {
  x: number;
  y: number;
  z: number;
  typeName: string;
  properties: { [key: string]: string | number | boolean | bigint } | undefined;
}

/**
 * Represents a collection of block snapshots for a region.
 */
export interface IVolumeSnapshot {
  blocks: IBlockSnapshot[];
}

/**
 * Types of actions that can be undone.
 */
export enum VolumeActionType {
  /** Single block placement/removal via pencil tool */
  Pencil = "pencil",
  /** Multiple blocks painted via brush tool */
  Brush = "brush",
  /** Fill operation on a selection */
  Fill = "fill",
  /** Delete operation on a selection */
  Delete = "delete",
  /** Generic block modification */
  BlockChange = "blockChange",
  /** Resize operation changing volume dimensions */
  Resize = "resize",
}

/**
 * Represents a single undoable action in the volume editor.
 */
export interface IVolumeEditorAction {
  /** Type of action performed */
  type: VolumeActionType;
  /** Human-readable description for UI */
  description: string;
  /** Block states before the action was applied */
  beforeSnapshot: IVolumeSnapshot;
  /** Block states after the action was applied */
  afterSnapshot: IVolumeSnapshot;
  /** Timestamp when action was performed */
  timestamp: number;
}

/**
 * Callback type for undo/redo state changes.
 */
export type UndoStateChangedCallback = (canUndo: boolean, canRedo: boolean) => void;

/**
 * Manages undo/redo operations for the VolumeEditor.
 *
 * This class maintains two stacks:
 * - undoStack: Actions that can be undone (most recent at end)
 * - redoStack: Actions that can be redone (most recent at end)
 *
 * When a new action is performed, the redo stack is cleared.
 */
export default class VolumeEditorUndoManager {
  private _undoStack: IVolumeEditorAction[] = [];
  private _redoStack: IVolumeEditorAction[] = [];
  private _maxStackSize: number;
  private _onStateChanged: UndoStateChangedCallback | undefined;

  // Temporary state while recording an action
  private _pendingAction: Partial<IVolumeEditorAction> | undefined;
  private _pendingBlocksBefore: Map<string, IBlockSnapshot> = new Map();
  private _pendingBlocksAfter: Map<string, IBlockSnapshot> = new Map();

  /**
   * Creates a new VolumeEditorUndoManager.
   * @param maxStackSize Maximum number of actions to keep in undo history (default: 50)
   */
  constructor(maxStackSize: number = 50) {
    this._maxStackSize = maxStackSize;
  }

  /**
   * Sets the callback to be invoked when undo/redo state changes.
   */
  setOnStateChanged(callback: UndoStateChangedCallback | undefined) {
    this._onStateChanged = callback;
  }

  /**
   * Returns true if there are actions that can be undone.
   */
  get canUndo(): boolean {
    return this._undoStack.length > 0;
  }

  /**
   * Returns true if there are actions that can be redone.
   */
  get canRedo(): boolean {
    return this._redoStack.length > 0;
  }

  /**
   * Returns the number of actions in the undo stack.
   */
  get undoCount(): number {
    return this._undoStack.length;
  }

  /**
   * Returns the number of actions in the redo stack.
   */
  get redoCount(): number {
    return this._redoStack.length;
  }

  /**
   * Gets a description of the action that would be undone.
   */
  get undoDescription(): string | undefined {
    if (this._undoStack.length === 0) return undefined;
    return this._undoStack[this._undoStack.length - 1].description;
  }

  /**
   * Gets a description of the action that would be redone.
   */
  get redoDescription(): string | undefined {
    if (this._redoStack.length === 0) return undefined;
    return this._redoStack[this._redoStack.length - 1].description;
  }

  /**
   * Begins recording a new action.
   * Call this before making any block modifications.
   *
   * @param type The type of action being performed
   * @param description Human-readable description of the action
   */
  beginAction(type: VolumeActionType, description: string): void {
    if (this._pendingAction !== undefined) {
      // If there's already a pending action, cancel it
      this.cancelAction();
    }

    this._pendingAction = {
      type,
      description,
      timestamp: Date.now(),
    };
    this._pendingBlocksBefore.clear();
    this._pendingBlocksAfter.clear();
  }

  /**
   * Records the state of a block BEFORE it is modified.
   * Call this for each block that will be changed by the current action.
   *
   * @param blockVolume The block volume containing the block
   * @param x X coordinate
   * @param y Y coordinate
   * @param z Z coordinate
   */
  recordBlockBefore(blockVolume: BlockVolume, x: number, y: number, z: number): void {
    if (this._pendingAction === undefined) {
      return;
    }

    const key = `${x},${y},${z}`;
    // Only record if we haven't already recorded this block
    if (!this._pendingBlocksBefore.has(key)) {
      const snapshot = this._captureBlockSnapshot(blockVolume, x, y, z);
      if (snapshot) {
        this._pendingBlocksBefore.set(key, snapshot);
      }
    }
  }

  /**
   * Records the state of a block AFTER it has been modified.
   * Call this for each block after it has been changed.
   *
   * @param blockVolume The block volume containing the block
   * @param x X coordinate
   * @param y Y coordinate
   * @param z Z coordinate
   */
  recordBlockAfter(blockVolume: BlockVolume, x: number, y: number, z: number): void {
    if (this._pendingAction === undefined) {
      return;
    }

    const key = `${x},${y},${z}`;
    const snapshot = this._captureBlockSnapshot(blockVolume, x, y, z);
    if (snapshot) {
      this._pendingBlocksAfter.set(key, snapshot);
    }
  }

  /**
   * Ends recording the current action and pushes it to the undo stack.
   * Call this after all block modifications are complete.
   *
   * @returns true if the action was recorded, false if it was empty/cancelled
   */
  endAction(): boolean {
    if (this._pendingAction === undefined) {
      return false;
    }

    // Check if any blocks were actually changed
    if (this._pendingBlocksBefore.size === 0) {
      this.cancelAction();
      return false;
    }

    // Build the action
    const action: IVolumeEditorAction = {
      type: this._pendingAction.type!,
      description: this._pendingAction.description!,
      timestamp: this._pendingAction.timestamp!,
      beforeSnapshot: {
        blocks: Array.from(this._pendingBlocksBefore.values()),
      },
      afterSnapshot: {
        blocks: Array.from(this._pendingBlocksAfter.values()),
      },
    };

    // Push to undo stack
    this._undoStack.push(action);

    // Clear redo stack (new action invalidates redo history)
    this._redoStack = [];

    // Enforce max stack size
    while (this._undoStack.length > this._maxStackSize) {
      this._undoStack.shift();
    }

    // Clear pending state
    this._pendingAction = undefined;
    this._pendingBlocksBefore.clear();
    this._pendingBlocksAfter.clear();

    // Notify state change
    this._notifyStateChanged();

    return true;
  }

  /**
   * Cancels the current action without recording it.
   */
  cancelAction(): void {
    this._pendingAction = undefined;
    this._pendingBlocksBefore.clear();
    this._pendingBlocksAfter.clear();
  }

  /**
   * Undoes the most recent action.
   *
   * @param blockVolume The block volume to apply the undo to
   * @param updateCallback Optional callback to update visuals for each restored block
   * @returns true if an action was undone, false if undo stack was empty
   */
  undo(blockVolume: BlockVolume, updateCallback?: (x: number, y: number, z: number) => void): boolean {
    if (this._undoStack.length === 0) {
      return false;
    }

    const action = this._undoStack.pop()!;

    // Restore blocks to their "before" state
    for (const snapshot of action.beforeSnapshot.blocks) {
      this._restoreBlockSnapshot(blockVolume, snapshot);
      if (updateCallback) {
        updateCallback(snapshot.x, snapshot.y, snapshot.z);
      }
    }

    // Push to redo stack
    this._redoStack.push(action);

    // Notify state change
    this._notifyStateChanged();

    return true;
  }

  /**
   * Redoes the most recently undone action.
   *
   * @param blockVolume The block volume to apply the redo to
   * @param updateCallback Optional callback to update visuals for each restored block
   * @returns true if an action was redone, false if redo stack was empty
   */
  redo(blockVolume: BlockVolume, updateCallback?: (x: number, y: number, z: number) => void): boolean {
    if (this._redoStack.length === 0) {
      return false;
    }

    const action = this._redoStack.pop()!;

    // Restore blocks to their "after" state
    for (const snapshot of action.afterSnapshot.blocks) {
      this._restoreBlockSnapshot(blockVolume, snapshot);
      if (updateCallback) {
        updateCallback(snapshot.x, snapshot.y, snapshot.z);
      }
    }

    // Push back to undo stack
    this._undoStack.push(action);

    // Notify state change
    this._notifyStateChanged();

    return true;
  }

  /**
   * Clears all undo/redo history.
   */
  clear(): void {
    this._undoStack = [];
    this._redoStack = [];
    this.cancelAction();
    this._notifyStateChanged();
  }

  /**
   * Captures the current state of a block as a snapshot.
   */
  private _captureBlockSnapshot(blockVolume: BlockVolume, x: number, y: number, z: number): IBlockSnapshot | undefined {
    // Bounds check
    if (x < 0 || y < 0 || z < 0 || x >= blockVolume.maxX || y >= blockVolume.maxY || z >= blockVolume.maxZ) {
      return undefined;
    }

    const block = blockVolume.x(x).y(y).z(z);
    if (!block) {
      return undefined;
    }

    // Capture properties
    let properties: { [key: string]: string | number | boolean | bigint } | undefined;
    if (block.properties && Object.keys(block.properties).length > 0) {
      properties = {};
      for (const key in block.properties) {
        const prop = block.properties[key];
        if (prop && prop.value !== undefined) {
          // Only capture primitive values, skip arrays
          const val = prop.value;
          if (
            typeof val === "string" ||
            typeof val === "number" ||
            typeof val === "boolean" ||
            typeof val === "bigint"
          ) {
            properties[key] = val;
          }
        }
      }
    }

    return {
      x,
      y,
      z,
      typeName: block.typeName ?? "minecraft:air",
      properties,
    };
  }

  /**
   * Restores a block to a previously captured state.
   */
  private _restoreBlockSnapshot(blockVolume: BlockVolume, snapshot: IBlockSnapshot): void {
    // Bounds check
    if (
      snapshot.x < 0 ||
      snapshot.y < 0 ||
      snapshot.z < 0 ||
      snapshot.x >= blockVolume.maxX ||
      snapshot.y >= blockVolume.maxY ||
      snapshot.z >= blockVolume.maxZ
    ) {
      return;
    }

    const block = blockVolume.x(snapshot.x).y(snapshot.y).z(snapshot.z);
    if (!block) {
      return;
    }

    // Restore type
    block.typeName = snapshot.typeName;

    // Restore properties using the Block API
    if (snapshot.properties) {
      for (const key in snapshot.properties) {
        const prop = block.ensureProperty(key);
        prop.value = snapshot.properties[key];
      }
    }
  }

  /**
   * Notifies the callback of state changes.
   */
  private _notifyStateChanged(): void {
    if (this._onStateChanged) {
      this._onStateChanged(this.canUndo, this.canRedo);
    }
  }
}
