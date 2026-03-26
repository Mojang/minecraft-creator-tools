// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Shared types and enums for the VolumeEditor system.
 * These are extracted to avoid circular dependencies between the editor and tools.
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
}

/**
 * Pencil tool edit mode.
 * @see https://learn.microsoft.com/en-us/minecraft/creator/documents/bedrockeditor/editorpenciltool
 */
export enum PencilMode {
  /** Standard mode - places blocks */
  Standard = 0,
  /** Replace mode - replaces existing blocks */
  Replace = 1,
  /** Sample mode - eyedropper to pick block type */
  Sample = 2,
}

/**
 * Pencil block facing/orientation options.
 * @see https://learn.microsoft.com/en-us/minecraft/creator/documents/bedrockeditor/editorpenciltool
 */
export enum PencilBlockFacing {
  /** Block rotation based on player/camera direction */
  Player = 0,
  /** Face north */
  North = 1,
  /** Face east */
  East = 2,
  /** Face south */
  South = 3,
  /** Face west */
  West = 4,
  /** Face up */
  Up = 5,
  /** Face down */
  Down = 6,
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
 * View mode for the volume editor.
 */
export enum VolumeEditorViewMode {
  /** Full structure editing mode with all tools */
  Structure = 0,
  /** Single block preview mode */
  SingleBlock = 1,
  /** Model preview mode (read-only) */
  ModelPreview = 2,
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
