import IVector3 from "./IVector3";

const blockTypeCharBias: { [typeId: string]: string } = {
  unloaded: "?",
  air: " ",
  dirt: "d",
  stone: "s",
  grass_block: "g",
  leaves: "*",
  water: "~",
  log2: "O",
  flower_pot: "p",
  oak_log: "O",
  spruce_log: "O",
};

export interface IBlockTypeData {
  typeId: string;
  properties?: { [key: string]: string | number | boolean };
}

export interface IEntityData {
  locationWithinVolume: IVector3;
  typeId: string;
}

/**
 * Represents a volume of blocks using a 2D character grid format.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * blockLayersBottomToTop: Horizontal layers from bottom to top
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Think of it like building a house floor-by-floor:
 * - Outer array: Y layers from BOTTOM to TOP (ground floor first, roof last)
 * - Each layer: rows from NORTH to SOUTH (back row first, front row last)
 * - Each character in a row: X position from WEST to EAST (left to right)
 *
 * AXIS REFERENCE:
 *   Y (up)
 *   |    Z (north = back, south = front)
 *   |   /
 *   |  /
 *   | /
 *   +-------> X (west = left, east = right)
 *
 * Example - 3x3x3 house with door on south (front) side:
 * ```
 * blockLayersBottomToTop: [
 *   // Y=0 (ground floor)
 *   ["sss",    // north row (back wall)
 *    "s s",    // middle row (side walls, open center)
 *    "s s"],   // south row (front with door opening)
 *
 *   // Y=1 (second level)
 *   ["sss",
 *    "s s",
 *    "sss"],   // door frame at this height
 *
 *   // Y=2 (roof level)
 *   ["sss",
 *    "sss",
 *    "sss"]
 * ]
 * ```
 *
 * READING THE FORMAT:
 * - First index = which layer (0 = ground)
 * - Second index = which row (0 = north/back, last = south/front)
 * - Character position = X column (0 = west/left)
 *
 * SIZE INFERENCE:
 * - If 'size' is not provided, it is automatically inferred from the data:
 *   - size.y = number of layers in blockLayersBottomToTop
 *   - size.z = maximum number of rows across all layers
 *   - size.x = maximum string length across all rows
 * - Shorter strings are treated as having trailing air blocks
 * - Layers with fewer rows are treated as having trailing air rows
 */
export interface IBlockVolume {
  entities?: IEntityData[];
  southWestBottom: IVector3;
  /**
   * Optional dimensions. If not provided, size is inferred from blockLayersBottomToTop.
   * - size.y = number of layers
   * - size.z = max rows per layer
   * - size.x = max string length
   */
  size?: IVector3;

  /**
   * Block data as horizontal Y layers, from bottom (Y=0) to top.
   * Each layer: rows from north to south (Z direction).
   * Each character: X position from west to east.
   *
   * Think of it like stacking floors: first element = ground floor, last = roof
   */
  blockLayersBottomToTop: string[][];

  key: { [characterReference: string]: IBlockTypeData };
}
