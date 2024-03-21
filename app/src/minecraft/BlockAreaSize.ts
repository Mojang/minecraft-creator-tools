// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Holds information for expressing the net size of a volume of
 * blocks.
 */
export default class BlockAreaSize {
  /**
   * X size (west to east) component of this block area.
   */
  "x": number;
  /**
   * Y size (down to up) of this block area size.
   */
  "y": number;
  /**
   * Z size (south to north) of this block area size.
   */
  "z": number;

  /**
   * @remarks
   * Tests whether this block area size is equal to another
   * BlockAreaSize object.
   * @param other
   */
  equals(other: BlockAreaSize): boolean {
    return other.x === this.x && other.y === this.y && other.z === this.z;
  }
}
