// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * ==========================================================================================
 * VOXEL SHAPE DEFINITION
 * ==========================================================================================
 *
 * OVERVIEW:
 * ---------
 * VoxelShapeDefinition manages custom voxel shape files for Minecraft Bedrock Edition.
 * Voxel shapes define custom collision/selection boxes for blocks using the
 * minecraft:voxel_shape format introduced in format_version 1.21.110.
 *
 * FILE STRUCTURE:
 * ---------------
 * Voxel shape files reside in <behavior pack>/shapes/ and have this structure:
 * {
 *   "format_version": "1.21.110",
 *   "minecraft:voxel_shape": {
 *     "description": {
 *       "identifier": "custom:slab_bottom"
 *     },
 *     "shape": {
 *       "boxes": [
 *         { "min": [0.0, 0.0, 0.0], "max": [16.0, 8.0, 16.0] }
 *       ]
 *     }
 *   }
 * }
 *
 * COORDINATE SYSTEM:
 * ------------------
 * - Coordinates are in "sub-block" units where 16 = 1 block
 * - Origin (0,0,0) is the bottom-southwest corner of the block
 * - Max (16,16,16) is the top-northeast corner of the block
 * - Values can range from -30 to 30 (extending beyond the block)
 *
 * CONVERTING TO GEOMETRY:
 * -----------------------
 * To convert a voxel shape to model geometry for preview:
 * - Divide coordinates by 16 to get block units (0-1 range for standard block)
 * - Each box becomes a cube in the geometry
 * - Note: Geometry uses different coordinate origins than voxel shapes
 *
 * ==========================================================================================
 */

import IFile from "../storage/IFile";
import IVoxelShapeFile, { IVoxelShapeBox } from "./IVoxelShapeFile";
import { EventDispatcher, IEventHandler } from "ste-events";
import StorageUtilities from "../storage/StorageUtilities";

export default class VoxelShapeDefinition {
  private _file?: IFile;
  private _id?: string;
  private _isLoaded: boolean = false;
  private _loadedWithComments: boolean = false;
  private _data?: IVoxelShapeFile;

  private _onLoaded = new EventDispatcher<VoxelShapeDefinition, VoxelShapeDefinition>();

  public get data(): IVoxelShapeFile | undefined {
    return this._data;
  }

  public get isLoaded(): boolean {
    return this._isLoaded;
  }

  public get file(): IFile | undefined {
    return this._file;
  }

  public set file(newFile: IFile | undefined) {
    this._file = newFile;
  }

  public get onLoaded() {
    return this._onLoaded.asEvent();
  }

  public get id(): string | undefined {
    if (this._data && this._data["minecraft:voxel_shape"]?.description?.identifier) {
      return this._data["minecraft:voxel_shape"].description.identifier;
    }
    return this._id;
  }

  public set id(newId: string | undefined) {
    if (this._data && this._data["minecraft:voxel_shape"]?.description) {
      this._data["minecraft:voxel_shape"].description.identifier = newId || "";
    }
    this._id = newId;
  }

  public get formatVersion(): string | undefined {
    return this._data?.format_version;
  }

  public get boxes(): IVoxelShapeBox[] {
    if (this._data && this._data["minecraft:voxel_shape"]?.shape?.boxes) {
      return this._data["minecraft:voxel_shape"].shape.boxes;
    }
    return [];
  }

  public static async ensureOnFile(
    file: IFile,
    loadHandler?: IEventHandler<VoxelShapeDefinition, VoxelShapeDefinition>
  ) {
    let vsd: VoxelShapeDefinition | undefined;

    if (file.manager === undefined) {
      vsd = new VoxelShapeDefinition();

      vsd.file = file;

      file.manager = vsd;
    }

    if (file.manager !== undefined && file.manager instanceof VoxelShapeDefinition) {
      vsd = file.manager as VoxelShapeDefinition;

      if (!vsd.isLoaded && loadHandler) {
        vsd.onLoaded.subscribe(loadHandler);
      }

      await vsd.load();
    }

    return vsd;
  }

  persist() {
    if (this._file === undefined) {
      return;
    }

    const content = JSON.stringify(this._data, null, 2);

    this._file.setContent(content);
  }

  async save() {
    if (this._file === undefined) {
      return;
    }

    this.persist();

    await this._file.saveContent(false);
  }

  /**
   * Loads the definition from the file.
   * @param preserveComments If true, uses comment-preserving JSON parsing for edit/save cycles.
   *                         If false (default), uses efficient standard JSON parsing.
   *                         Can be called again with true to "upgrade" a read-only load to read/write.
   */
  async load(preserveComments: boolean = false) {
    // If already loaded with comments, we have the "best" version - nothing more to do
    if (this._isLoaded && this._loadedWithComments) {
      return;
    }

    // If already loaded without comments and caller doesn't need comments, we're done
    if (this._isLoaded && !preserveComments) {
      return;
    }

    if (this._file === undefined) {
      return;
    }

    await this._file.loadContent();

    if (this._file.content === null || this._file.content instanceof Uint8Array) {
      this._isLoaded = true;
      this._loadedWithComments = preserveComments;
      this._onLoaded.dispatch(this, this);
      return;
    }

    // Use comment-preserving parser only when needed for editing
    this._data = preserveComments
      ? StorageUtilities.getJsonObjectWithComments(this._file)
      : StorageUtilities.getJsonObject(this._file);

    this._isLoaded = true;
    this._loadedWithComments = preserveComments;

    this._onLoaded.dispatch(this, this);
  }

  /**
   * Adds a new box to the voxel shape.
   */
  addBox(min: number[], max: number[]): void {
    if (!this._data) {
      this._initializeData();
    }

    if (this._data && this._data["minecraft:voxel_shape"]?.shape?.boxes) {
      this._data["minecraft:voxel_shape"].shape.boxes.push({ min, max });
    }
  }

  /**
   * Removes a box at the specified index.
   */
  removeBox(index: number): boolean {
    if (this._data && this._data["minecraft:voxel_shape"]?.shape?.boxes) {
      const boxes = this._data["minecraft:voxel_shape"].shape.boxes;
      if (index >= 0 && index < boxes.length) {
        boxes.splice(index, 1);
        return true;
      }
    }
    return false;
  }

  /**
   * Updates a box at the specified index.
   */
  updateBox(index: number, min: number[], max: number[]): boolean {
    if (this._data && this._data["minecraft:voxel_shape"]?.shape?.boxes) {
      const boxes = this._data["minecraft:voxel_shape"].shape.boxes;
      if (index >= 0 && index < boxes.length) {
        boxes[index] = { min, max };
        return true;
      }
    }
    return false;
  }

  /**
   * Initializes an empty voxel shape data structure.
   */
  private _initializeData(): void {
    this._data = {
      format_version: "1.21.110",
      "minecraft:voxel_shape": {
        description: {
          identifier: this._id || "custom:new_shape",
        },
        shape: {
          boxes: [],
        },
      },
    };
  }

  /**
   * Gets the normalized coordinates for a box (0-1 range for standard block).
   */
  static getNormalizedBox(box: IVoxelShapeBox): { min: number[]; max: number[] } {
    const minArr = Array.isArray(box.min) ? box.min : [box.min.x, box.min.y, box.min.z];
    const maxArr = Array.isArray(box.max) ? box.max : [box.max.x, box.max.y, box.max.z];

    return {
      min: minArr.map((v) => v / 16),
      max: maxArr.map((v) => v / 16),
    };
  }

  /**
   * Color palette for box visualization.
   * Each box gets a distinct color for easy identification.
   */
  public static readonly BOX_COLORS: Array<{ r: number; g: number; b: number }> = [
    { r: 0x55, g: 0x88, b: 0xdd }, // Blue
    { r: 0xdd, g: 0x55, b: 0x55 }, // Red
    { r: 0x55, g: 0xbb, b: 0x55 }, // Green
    { r: 0xdd, g: 0xaa, b: 0x33 }, // Orange
    { r: 0xaa, g: 0x55, b: 0xcc }, // Purple
    { r: 0x33, g: 0xbb, b: 0xbb }, // Cyan
    { r: 0xdd, g: 0x77, b: 0xaa }, // Pink
    { r: 0x88, g: 0x88, b: 0x55 }, // Olive
  ];

  /**
   * Converts the voxel shape to a model geometry definition object.
   * Each box gets a different UV region for distinct coloring.
   * Texture atlas is 128x16 with 8 colored slots.
   */
  toGeometryJson(): object {
    const bones: object[] = [];
    const cubes: object[] = [];
    const boxCount = this.boxes.length;

    for (let i = 0; i < boxCount; i++) {
      const box = this.boxes[i];
      const normalized = VoxelShapeDefinition.getNormalizedBox(box);

      // Convert to geometry coordinates:
      // - Geometry origin is at center-bottom of model
      // - Voxel shape origin is at corner (0,0,0 = bottom-southwest)
      // - We need to offset by -8 in X and Z to center
      const originX = normalized.min[0] * 16 - 8;
      const originY = normalized.min[1] * 16;
      const originZ = normalized.min[2] * 16 - 8;

      const sizeX = (normalized.max[0] - normalized.min[0]) * 16;
      const sizeY = (normalized.max[1] - normalized.min[1]) * 16;
      const sizeZ = (normalized.max[2] - normalized.min[2]) * 16;

      // Each box uses a different 16x16 region in the texture atlas
      // Atlas is 128x16 (8 slots of 16x16 each)
      // Use per-face UV mode so all faces show the same color/number
      const colorIndex = i % 8;
      const uvX = colorIndex * 16;

      // Per-face UV ensures all faces use the same texture slot
      const faceUv = { uv: [uvX, 0], uv_size: [16, 16] };

      cubes.push({
        origin: [originX, originY, originZ],
        size: [sizeX, sizeY, sizeZ],
        uv: {
          north: faceUv,
          south: faceUv,
          east: faceUv,
          west: faceUv,
          up: faceUv,
          down: faceUv,
        },
      });
    }

    bones.push({
      name: "shape",
      pivot: [0, 0, 0],
      cubes: cubes,
    });

    // Calculate visible bounds based on actual box extents
    let maxExtent = 1;
    let maxHeight = 1;
    for (const box of this.boxes) {
      const normalized = VoxelShapeDefinition.getNormalizedBox(box);
      maxExtent = Math.max(
        maxExtent,
        Math.abs(normalized.min[0]),
        Math.abs(normalized.max[0]),
        Math.abs(normalized.min[2]),
        Math.abs(normalized.max[2])
      );
      maxHeight = Math.max(maxHeight, normalized.max[1]);
    }
    // Add some padding and convert to blocks
    const boundsWidth = Math.ceil(maxExtent) * 2 + 2;
    const boundsHeight = Math.ceil(maxHeight) + 2;

    return {
      format_version: "1.16.0",
      "minecraft:geometry": [
        {
          description: {
            identifier: "geometry.voxelshape_preview",
            texture_width: 128,
            texture_height: 16,
            visible_bounds_width: boundsWidth,
            visible_bounds_height: boundsHeight,
            visible_bounds_offset: [0, boundsHeight / 2, 0],
          },
          bones: bones,
        },
      ],
    };
  }

  /**
   * Generates a texture atlas for the voxel shape preview.
   * Creates a 128x16 image with 8 colored slots (16x16 each).
   * Each slot has a number overlay (1-8) for identification.
   * Returns raw RGBA pixel data that can be encoded to PNG.
   */
  generatePreviewTexturePixels(): { pixels: Uint8Array; width: number; height: number } {
    return VoxelShapeDefinition.generatePreviewTexturePixelsStatic(this.boxes.length);
  }

  /**
   * Static version of generatePreviewTexturePixels for use without an instance.
   * Creates a 128x16 image with 8 colored slots (16x16 each).
   * Each slot has a number overlay (1-8) for identification.
   * @param boxCount Number of boxes (only used for future extensions)
   */
  static generatePreviewTexturePixelsStatic(_boxCount?: number): { pixels: Uint8Array; width: number; height: number } {
    const width = 128;
    const height = 16;
    const pixels = new Uint8Array(width * height * 4);

    // Simple 3x5 digit patterns (1-8) for number overlays
    const digitPatterns: { [key: number]: number[] } = {
      1: [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],
      2: [1, 1, 1, 0, 0, 1, 1, 1, 1, 1, 0, 0, 1, 1, 1],
      3: [1, 1, 1, 0, 0, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1],
      4: [1, 0, 1, 1, 0, 1, 1, 1, 1, 0, 0, 1, 0, 0, 1],
      5: [1, 1, 1, 1, 0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 1],
      6: [1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 0, 1, 1, 1, 1],
      7: [1, 1, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
      8: [1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1],
    };

    // Fill each 16x16 slot with a color and number
    for (let slot = 0; slot < 8; slot++) {
      const color = VoxelShapeDefinition.BOX_COLORS[slot];
      const slotX = slot * 16;

      // Fill the slot with the base color (with slight variation for texture)
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const pixelX = slotX + x;
          const idx = (y * width + pixelX) * 4;

          // Add slight checkerboard variation for texture
          const isLight = (x + y) % 2 === 0;
          const variation = isLight ? 0 : -20;

          pixels[idx] = Math.max(0, Math.min(255, color.r + variation));
          pixels[idx + 1] = Math.max(0, Math.min(255, color.g + variation));
          pixels[idx + 2] = Math.max(0, Math.min(255, color.b + variation));
          pixels[idx + 3] = 255;
        }
      }

      // Draw the number (centered in the slot)
      const digitNum = slot + 1;
      const pattern = digitPatterns[digitNum];
      if (pattern) {
        const digitWidth = 3;
        const digitHeight = 5;
        const startX = slotX + Math.floor((16 - digitWidth) / 2);
        const startY = Math.floor((16 - digitHeight) / 2);

        for (let dy = 0; dy < digitHeight; dy++) {
          for (let dx = 0; dx < digitWidth; dx++) {
            if (pattern[dy * digitWidth + dx] === 1) {
              const pixelX = startX + dx;
              const pixelY = startY + dy;
              const idx = (pixelY * width + pixelX) * 4;

              // Draw number in white with dark outline effect
              pixels[idx] = 255;
              pixels[idx + 1] = 255;
              pixels[idx + 2] = 255;
              pixels[idx + 3] = 255;
            }
          }
        }
      }
    }

    return { pixels, width, height };
  }
}
