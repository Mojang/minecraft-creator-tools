// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Turns a build program's journal into a Structure, and turns an existing
 * Structure into the base volume an edit program reads.
 *
 * Air semantics:
 *   - Cells a program never writes stay structure void (`-1` in the file): when
 *     the structure is placed, the world keeps whatever was there.
 *   - Cells a program sets to `minecraft:air` (api.set(..., "air"), api.clear)
 *     become an explicit air palette entry, which carves space when placed.
 *   - In edit mode, untouched cells keep the base contents, including the
 *     void-vs-air distinction.
 *
 * Unknown vanilla names (a `minecraft:` name that isn't a current block) are
 * replaced with `minecraft:stone` and reported, so one typo doesn't fail the
 * build. Names in other namespaces are custom blocks and pass through.
 */

import { MinecraftBlockTypes } from "@minecraft/vanilla-data";
import Block from "../Block";
import BlockVolume from "../BlockVolume";
import Structure from "../Structure";
import { IStructureBaseVolume, IStructureBuilderJournal } from "./StructureProgramTypes";
import StructureVolumeCodec, { IDenseBlockVolume, STRUCTURE_AIR_TOKEN } from "./StructureVolumeCodec";

export const UNKNOWN_BLOCK_SUBSTITUTE = "minecraft:stone";

let vanillaBlockNames: Set<string> | undefined;

/** The base volume for an edit program plus the structure it came from. */
export interface IStructureProgramBase {
  readonly volume: IStructureBaseVolume;
  readonly structure: Structure;
}

export interface IRealizedStructure {
  readonly structure: Structure;
  readonly sizeX: number;
  readonly sizeY: number;
  readonly sizeZ: number;
  /** Cells holding a non-air block. */
  readonly blockCount: number;
  /** Cells explicitly set to air (these carve space when placed). */
  readonly airCount: number;
  /** Distinct `minecraft:` names that aren't vanilla blocks and were replaced with stone. */
  readonly unknownNames: string[];
}

export default class StructureProgramRealizer {
  static isKnownVanillaBlock(name: string): boolean {
    if (vanillaBlockNames === undefined) {
      vanillaBlockNames = new Set<string>(Object.values(MinecraftBlockTypes) as string[]);
    }
    return vanillaBlockNames.has(name);
  }

  /**
   * Checks a block name the way the realizer will. Returns the name to write and
   * whether it was an unknown vanilla name.
   */
  static resolveBlockName(name: string): { name: string; unknown: boolean } {
    const lower = name.trim().toLowerCase();
    const full = lower.indexOf(":") >= 0 ? lower : "minecraft:" + lower;
    if (full.startsWith("minecraft:") && !StructureProgramRealizer.isKnownVanillaBlock(full)) {
      return { name: UNKNOWN_BLOCK_SUBSTITUTE, unknown: true };
    }
    return { name: full, unknown: false };
  }

  /** Builds the edit-mode base volume (clipboard order) from an existing structure. */
  static baseFromStructure(structure: Structure): IStructureProgramBase | undefined {
    const cube = structure.cube;
    if (!cube) {
      return undefined;
    }

    const sizeX = cube.maxX;
    const sizeY = cube.maxY;
    const sizeZ = cube.maxZ;
    const indices = new Int32Array(sizeX * sizeY * sizeZ).fill(-1);
    const names: string[] = [];
    const statesJson: string[] = [];
    const internMap = new Map<string, number>();

    for (let x = 0; x < sizeX; x++) {
      for (let y = 0; y < sizeY; y++) {
        for (let z = 0; z < sizeZ; z++) {
          if (structure.isVoidAt(x, y, z)) {
            continue;
          }
          const block = cube.x(x).y(y).z(z);
          const name = block.typeName as string;
          const sj = StructureProgramRealizer._canonicalStatesJson(StructureProgramRealizer._statesOf(block));
          const key = name + "\u0000" + sj;
          let idx = internMap.get(key);
          if (idx === undefined) {
            idx = names.length;
            internMap.set(key, idx);
            names.push(name);
            statesJson.push(sj);
          }
          indices[(y * sizeZ + z) * sizeX + x] = idx;
        }
      }
    }

    return { volume: { sizeX, sizeY, sizeZ, names, statesJson, indices }, structure };
  }

  /** Dense display tokens for a structure, for StructureVolumeCodec. Void and air both show as air. */
  static denseFromStructure(structure: Structure): IDenseBlockVolume | undefined {
    const cube = structure.cube;
    if (!cube) {
      return undefined;
    }
    const sizeX = cube.maxX;
    const sizeY = cube.maxY;
    const sizeZ = cube.maxZ;
    const tokens = new Array<string>(sizeX * sizeY * sizeZ).fill(STRUCTURE_AIR_TOKEN);

    for (let x = 0; x < sizeX; x++) {
      for (let y = 0; y < sizeY; y++) {
        for (let z = 0; z < sizeZ; z++) {
          const block = cube.x(x).y(y).z(z);
          if (structure.isVoidAt(x, y, z) || block.isEmpty) {
            continue;
          }
          tokens[(y * sizeZ + z) * sizeX + x] = StructureVolumeCodec.displayToken(
            block.typeName as string,
            StructureProgramRealizer._statesOf(block)
          );
        }
      }
    }

    return { sizeX, sizeY, sizeZ, tokens };
  }

  /**
   * Realizes a journal into a new Structure. With a base, untouched cells copy
   * the base structure's blocks and the result keeps its size and origin.
   */
  static realize(journal: IStructureBuilderJournal, base?: IStructureProgramBase): IRealizedStructure {
    const sizeX = base ? base.volume.sizeX : journal.sizeX;
    const sizeY = base ? base.volume.sizeY : journal.sizeY;
    const sizeZ = base ? base.volume.sizeZ : journal.sizeZ;

    const unknownNames = new Set<string>();
    const templates: Block[] = journal.names.map((rawName, i) => {
      const resolved = StructureProgramRealizer.resolveBlockName(rawName);
      if (resolved.unknown) {
        unknownNames.add(rawName);
      }
      const block = new Block(resolved.name);
      if (!resolved.unknown && journal.statesJson[i]) {
        const states = JSON.parse(journal.statesJson[i]) as Record<string, string | number | boolean>;
        for (const key of Object.keys(states)) {
          block.ensureProperty(key).value = states[key];
        }
      }
      return block;
    });

    const cellCount = sizeX * sizeY * sizeZ;
    const cellWrites = new Int32Array(cellCount).fill(-1);
    for (let k = 0; k < journal.xs.length; k++) {
      const x = journal.xs[k];
      const y = journal.ys[k];
      const z = journal.zs[k];
      if (x < 0 || y < 0 || z < 0 || x >= sizeX || y >= sizeY || z >= sizeZ) {
        continue;
      }
      cellWrites[(y * sizeZ + z) * sizeX + x] = journal.tableIdx[k];
    }

    const cube = new BlockVolume();
    cube.setMaxDimensions(sizeX, sizeY, sizeZ);
    const baseCube = base?.structure.cube;

    let blockCount = 0;
    let airCount = 0;

    for (let x = 0; x < sizeX; x++) {
      for (let y = 0; y < sizeY; y++) {
        for (let z = 0; z < sizeZ; z++) {
          const block = cube.x(x).y(y).z(z);
          const tableIdx = cellWrites[(y * sizeZ + z) * sizeX + x];

          if (tableIdx >= 0) {
            const template = templates[tableIdx];
            block.applyFrom(template);
          } else if (base && baseCube && !base.structure.isVoidAt(x, y, z)) {
            const baseBlock = baseCube.x(x).y(y).z(z);
            block.applyFrom(baseBlock);
            block.persistenceVersion = baseBlock.persistenceVersion;
            block.extraLiquidDepth = baseBlock.extraLiquidDepth;
          } else {
            continue;
          }

          if (block.typeName === STRUCTURE_AIR_TOKEN) {
            airCount++;
          } else {
            blockCount++;
          }
        }
      }
    }

    const structure = new Structure();
    structure.cube = cube;

    if (base) {
      structure.originX = base.structure.originX;
      structure.originY = base.structure.originY;
      structure.originZ = base.structure.originZ;
      structure.carryOverEntitiesFrom(base.structure);
      // A written cell gets a new block, so its old block entity (chest items, sign text) no longer applies.
      structure.carryOverBlockPositionDataFrom(
        base.structure,
        (x, y, z) => cellWrites[(y * sizeZ + z) * sizeX + x] < 0
      );
    }

    return { structure, sizeX, sizeY, sizeZ, blockCount, airCount, unknownNames: [...unknownNames] };
  }

  private static _statesOf(block: Block): Record<string, unknown> | undefined {
    let states: Record<string, unknown> | undefined;
    for (const name in block.properties) {
      const value = block.properties[name].value;
      if (value !== undefined) {
        states = states || {};
        states[name] = typeof value === "bigint" ? Number(value) : value;
      }
    }
    return states;
  }

  private static _canonicalStatesJson(states: Record<string, unknown> | undefined): string {
    if (!states) {
      return "";
    }
    const keys = Object.keys(states).sort();
    if (keys.length === 0) {
      return "";
    }
    const ordered: Record<string, unknown> = {};
    for (const key of keys) {
      ordered[key] = states[key];
    }
    return JSON.stringify(ordered);
  }
}
