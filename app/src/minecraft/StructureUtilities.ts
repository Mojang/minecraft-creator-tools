// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { IBlockVolume, IBlockTypeData } from "./IBlockVolume";
import Structure from "./Structure";
import BlockVolume from "./BlockVolume";
import Block from "./Block";

/**
 * Utility functions for working with Structure (MCStructure) objects.
 */
export default class StructureUtilities {
  /**
   * Infers the size of an IBlockVolume from its data.
   * - size.y = number of layers in blockLayersBottomToTop
   * - size.z = maximum number of rows across all layers
   * - size.x = maximum string length across all rows
   *
   * @param blockVolume The IBlockVolume to measure
   * @returns The inferred size as an IVector3
   */
  static inferBlockVolumeSize(blockVolume: IBlockVolume): { x: number; y: number; z: number } {
    const layers = blockVolume.blockLayersBottomToTop;
    const sizeY = layers.length;

    let sizeZ = 0;
    let sizeX = 0;

    for (const layer of layers) {
      if (layer.length > sizeZ) {
        sizeZ = layer.length;
      }
      for (const row of layer) {
        if (row.length > sizeX) {
          sizeX = row.length;
        }
      }
    }

    return { x: sizeX, y: sizeY, z: sizeZ };
  }

  /**
   * Gets the effective size of an IBlockVolume, using the explicit size if provided,
   * or inferring it from the data if not.
   *
   * @param blockVolume The IBlockVolume to get the size of
   * @returns The effective size as an IVector3
   */
  static getEffectiveSize(blockVolume: IBlockVolume): { x: number; y: number; z: number } {
    if (blockVolume.size) {
      return blockVolume.size;
    }
    return StructureUtilities.inferBlockVolumeSize(blockVolume);
  }

  /**
   * Creates a Structure (MCStructure) from an IBlockVolume.
   *
   * IBlockVolume uses blockLayersBottomToTop format:
   * - Outer array: Y layers from bottom (Y=0) to top
   * - Each layer: rows from north (Z=0) to south (Z=max)
   * - Each character: X position from west (X=0) to east (X=max)
   *
   * Think of it like stacking floors: first layer is ground floor, last is roof.
   *
   * If size is not explicitly provided, it is inferred from the data.
   * Shorter strings and missing rows are treated as air.
   *
   * @param blockVolume The IBlockVolume containing layer-based block data
   * @returns A Structure populated with blocks from the IBlockVolume
   */
  static createStructureFromIBlockVolume(blockVolume: IBlockVolume): Structure {
    const structure = new Structure();
    const cube = new BlockVolume();

    // Use explicit size if provided, otherwise infer from data
    const effectiveSize = StructureUtilities.getEffectiveSize(blockVolume);
    const sizeX = effectiveSize.x;
    const sizeY = effectiveSize.y;
    const sizeZ = effectiveSize.z;

    cube.setMaxDimensions(sizeX, sizeY, sizeZ);

    // Set the origin based on the IBlockVolume's southWestBottom
    structure.originX = blockVolume.southWestBottom.x;
    structure.originY = blockVolume.southWestBottom.y;
    structure.originZ = blockVolume.southWestBottom.z;

    // Process each Y layer (bottom to top)
    for (let y = 0; y < sizeY && y < blockVolume.blockLayersBottomToTop.length; y++) {
      const layer = blockVolume.blockLayersBottomToTop[y];

      if (!layer) {
        continue;
      }

      // Process each Z row within the layer (north to south)
      for (let z = 0; z < layer.length && z < sizeZ; z++) {
        const row = layer[z];

        if (!row) {
          continue;
        }

        // Process each X position in the row (west to east)
        for (let x = 0; x < row.length && x < sizeX; x++) {
          const charRef = row[x];
          const blockTypeData = blockVolume.key[charRef];

          if (blockTypeData) {
            const block = cube.x(x).y(y).z(z);
            StructureUtilities.applyBlockTypeDataToBlock(block, blockTypeData);
          }
          // If no blockTypeData found for the character, the block remains as default (air)
        }
      }
    }

    structure.cube = cube;

    return structure;
  }

  /**
   * Applies block type data from IBlockTypeData to a Block.
   * Handles the properties field and also legacy parsing of block states from the typeId if present.
   *
   * @param block The Block to apply the type data to
   * @param blockTypeData The IBlockTypeData containing the type ID and optional properties
   */
  static applyBlockTypeDataToBlock(block: Block, blockTypeData: IBlockTypeData): void {
    let typeId = blockTypeData.typeId;

    // First, apply properties from the properties field (preferred method)
    if (blockTypeData.properties) {
      for (const propName in blockTypeData.properties) {
        const prop = block.ensureProperty(propName);
        prop.value = blockTypeData.properties[propName];
      }
    }

    // Also support legacy parsing of block states from the typeId
    // Format: "minecraft:block_name[state1=value1,state2=value2]" or "minecraft:block_name{state1:value1,state2:value2}"
    const squareBracketIndex = typeId.indexOf("[");
    const curlyBracketIndex = typeId.indexOf("{");

    if (squareBracketIndex >= 0) {
      // Handle square bracket format: block_name[state=value]
      const endBracket = typeId.indexOf("]");
      if (endBracket > squareBracketIndex) {
        const statesStr = typeId.substring(squareBracketIndex + 1, endBracket);
        typeId = typeId.substring(0, squareBracketIndex);

        StructureUtilities.parseAndApplyBlockStates(block, statesStr, ",", "=");
      }
    } else if (curlyBracketIndex >= 0) {
      // Handle curly bracket format: block_name{state:value}
      const endBracket = typeId.indexOf("}");
      if (endBracket > curlyBracketIndex) {
        const statesStr = typeId.substring(curlyBracketIndex + 1, endBracket);
        typeId = typeId.substring(0, curlyBracketIndex);

        StructureUtilities.parseAndApplyBlockStates(block, statesStr, ",", ":");
      }
    }

    // Ensure the typeId has the minecraft: prefix if it doesn't have a namespace
    if (!typeId.includes(":")) {
      typeId = "minecraft:" + typeId;
    }

    block.typeName = typeId;
  }

  /**
   * Parses a block states string and applies the states to the block.
   *
   * @param block The block to apply states to
   * @param statesStr The states string (e.g., "facing=north,half=bottom")
   * @param stateSeparator The character separating multiple states (usually ",")
   * @param keyValueSeparator The character separating key from value ("=" or ":")
   */
  static parseAndApplyBlockStates(
    block: Block,
    statesStr: string,
    stateSeparator: string,
    keyValueSeparator: string
  ): void {
    const states = statesStr.split(stateSeparator);

    for (const state of states) {
      const trimmedState = state.trim();
      if (!trimmedState) {
        continue;
      }

      const separatorIndex = trimmedState.indexOf(keyValueSeparator);
      if (separatorIndex > 0) {
        const key = trimmedState.substring(0, separatorIndex).trim();
        const valueStr = trimmedState.substring(separatorIndex + 1).trim();

        const prop = block.ensureProperty(key);

        // Try to parse the value as appropriate type
        if (valueStr === "true") {
          prop.value = true;
        } else if (valueStr === "false") {
          prop.value = false;
        } else {
          const numValue = parseInt(valueStr, 10);
          if (!isNaN(numValue) && numValue.toString() === valueStr) {
            prop.value = numValue;
          } else {
            // Remove quotes if present
            prop.value = valueStr.replace(/^["']|["']$/g, "");
          }
        }
      }
    }
  }

  /**
   * Creates an IBlockVolume from a Structure.
   * This is the inverse operation of createStructureFromIBlockVolume.
   *
   * Output uses blockLayersBottomToTop format:
   * - Outer array: Y layers from bottom to top
   * - Each layer: rows from north to south
   * - Each character: X position from west to east
   *
   * @param structure The Structure to convert
   * @returns An IBlockVolume representation of the structure
   */
  static createIBlockVolumeFromStructure(structure: Structure): IBlockVolume | undefined {
    const cube = structure.cube;

    if (!cube) {
      return undefined;
    }

    const key: { [characterReference: string]: IBlockTypeData } = {};
    const blockLayersBottomToTop: string[][] = [];
    const blockTypeToChar: Map<string, string> = new Map();

    // Character set for block references (avoiding space which is used for air)
    const charSet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_+=[]{}|;':\",./<>?`~";
    let charIndex = 0;

    // Process each Y layer (bottom to top)
    for (let y = 0; y < cube.maxY; y++) {
      const layer: string[] = [];

      // Process each Z row within the layer (north to south)
      for (let z = 0; z < cube.maxZ; z++) {
        let row = "";

        // Process each X position (west to east)
        for (let x = 0; x < cube.maxX; x++) {
          const block = cube.x(x).y(y).z(z);
          const blockFingerprint = block.toString();

          // Check for air blocks
          if (block.typeName === null || block.typeName === undefined || block.shortTypeId === "air") {
            row += " ";
            continue;
          }

          // Look up or assign a character for this block type
          let charRef = blockTypeToChar.get(blockFingerprint);
          if (charRef === undefined) {
            if (charIndex >= charSet.length) {
              // If we run out of characters, start using multi-character references
              // This is a fallback that shouldn't happen often
              charRef = `{${charIndex}}`;
            } else {
              charRef = charSet[charIndex];
            }
            charIndex++;

            blockTypeToChar.set(blockFingerprint, charRef);
            key[charRef] = StructureUtilities.getBlockTypeDataFromBlock(block);
          }

          row += charRef;
        }

        layer.push(row);
      }

      blockLayersBottomToTop.push(layer);
    }

    return {
      entities: [], // TODO: Support entity conversion
      southWestBottom: {
        x: structure.originX ?? 0,
        y: structure.originY ?? 0,
        z: structure.originZ ?? 0,
      },
      size: {
        x: cube.maxX,
        y: cube.maxY,
        z: cube.maxZ,
      },
      blockLayersBottomToTop,
      key,
    };
  }

  /**
   * Creates an IBlockTypeData from a Block, with typeId and properties separated.
   *
   * @param block The block to get the type data for
   * @returns An IBlockTypeData with the block's type ID and properties
   */
  static getBlockTypeDataFromBlock(block: Block): IBlockTypeData {
    const typeId = block.typeName ?? "minecraft:air";
    const propertyNames = Object.keys(block.properties);

    if (propertyNames.length === 0) {
      return { typeId };
    }

    const properties: { [key: string]: string | number | boolean } = {};

    for (const propName of propertyNames) {
      const prop = block.getProperty(propName);
      if (prop && prop.value !== undefined) {
        const value = prop.value;
        // Convert to compatible types for IBlockTypeData.properties
        if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
          properties[propName] = value;
        } else if (typeof value === "bigint") {
          // Convert bigint to number (may lose precision for very large values)
          properties[propName] = Number(value);
        } else if (Array.isArray(value)) {
          // Convert arrays to string representation
          properties[propName] = value.join(",");
        }
      }
    }

    return { typeId, properties };
  }

  /**
   * Gets the full block type ID with states in square bracket notation.
   * @deprecated Use getBlockTypeDataFromBlock instead for the new properties-based format.
   *
   * @param block The block to get the type ID for
   * @returns The block type ID, optionally with states (e.g., "minecraft:oak_stairs[facing=north,half=bottom]")
   */
  static getBlockTypeIdWithStates(block: Block): string {
    let typeId = block.typeName ?? "minecraft:air";

    const propertyNames = Object.keys(block.properties);
    if (propertyNames.length > 0) {
      const states: string[] = [];

      for (const propName of propertyNames) {
        const prop = block.getProperty(propName);
        if (prop && prop.value !== undefined) {
          states.push(`${propName}=${prop.value}`);
        }
      }

      if (states.length > 0) {
        typeId += `[${states.join(",")}]`;
      }
    }

    return typeId;
  }
}
