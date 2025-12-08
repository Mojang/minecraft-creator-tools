// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IBlockTypeData from "./IBlockTypeData";
import IBlockTypePropertyData from "./IBlockTypePropertyData";

/**
 * Defines the geometric shape/mesh type for block rendering.
 * Used to drive data-driven block mesh creation in BlockMeshFactory.
 */
export enum BlockShape {
  custom = 0,
  unitCube = 1,
  stairs = 2,
  slab = 3,
  fence = 4,
  fenceGate = 5,
  wall = 6,
  door = 7,
  trapdoor = 8,
  button = 9,
  pressurePlate = 10,
  torch = 11,
  lantern = 12,
  chain = 13,
  ladder = 14,
  rail = 15,
  lever = 16,
  anvil = 17,
  candle = 18,
  endRod = 19,
  glassPaneOrBars = 20,
  billboard = 21, // Cross/X shape (saplings, flowers, mushrooms, etc.)
  carpet = 22,
  crop = 23, // Wheat, carrots, potatoes, etc.
  leaves = 24,
  log = 25,
  water = 26,
  redstoneWire = 27,
  sign = 28,
  hangingSign = 29,
  bed = 30,
  chest = 31,
  campfire = 32,
  bell = 33,
  hopper = 34,
  brewingStand = 35,
  enchantingTable = 36,
  cauldron = 37,
}

export default interface IBlockBaseTypeData {
  id?: number;
  n: string;
  t?: string; // friendly title/display name
  mc?: string; // map color
  m?: string; // material
  ic?: string;
  abstract?: boolean;
  isOpaque?: boolean;
  sh?: BlockShape; // shape (abbreviated)
  properties?: IBlockTypePropertyData[];
  variants?: IBlockTypeData[];
}
