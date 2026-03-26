// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import BlockType from "./BlockType";

export default class BlockPermutation {
  /**
   * The {@link mojang-minecraft.BlockType} that the permutation has.
   */
  get type(): BlockType {
    return new BlockType("air");
  }
  /**
   * @remarks
   * Creates a copy of this permutation.
   * @returns
   * A copy of the permutation.
   */
  clone(): BlockPermutation {
    return new BlockPermutation();
  }
  /**
   * @returns
   * Returns the list of all of the properties that the
   * permutation has.
   */
  getAllProperties(): any[] {
    return [];
  }
  /**
   * @remarks
   * Gets a property for the permutation.
   * @param propertyName
   * @returns
   * Returns the property if the permutation has it, else `null`.
   * @throws This function can throw errors.
   * @example place_bottom_stone_slab.js
   * ```typescript
   *        import { world, MinecraftBlockTypes, BlockProperties, BlockLocation } from "mojang-minecraft";
   *
   *        // Create the permutation
   *        const bottomStoneSlab = MinecraftBlockTypes.stoneSlab.createDefaultBlockPermutation();
   *        bottomStoneSlab.getProperty(BlockProperties.stoneSlabType).value = "stone_brick";
   *        bottomStoneSlab.getProperty(BlockProperties.topSlotBit).value = false;
   *
   *        // Fetch the block
   *        const block = world.getDimension("overworld").getBlock(new BlockLocation(1, 2, 3));
   *
   *        // Set the permutation
   *        block.setPermutation(bottomStoneSlab);
   *
   * ```
   */
  getProperty(propertyName: string): any {
    return null;
  }
  /**
   * @remarks
   * Creates a copy of the permutation.
   */
  getTags(): string[] {
    return [];
  }
  /**
   * @remarks
   * Checks to see if the permutation has a specific tag.
   * @param tag
   * @returns
   * Returns `true` if the permutation has the tag, else `false`.
   * @example check_block_tags.js
   * ```typescript
   *        import { world, BlockLocation } from "mojang-minecraft";
   *
   *        // Fetch the block
   *        const block = world.getDimension("overworld").getBlock(new BlockLocation(1, 2, 3));
   *        const blockPerm = block.getPermutation();
   *
   *        console.log(`Block is dirt: ${blockPerm.hasTag("dirt")}`);
   *        console.log(`Block is wood: ${blockPerm.hasTag("wood")}`);
   *        console.log(`Block is stone: ${blockPerm.hasTag("stone")}`);
   *
   * ```
   */
  hasTag(tag: string): boolean {
    return false;
  }
}
