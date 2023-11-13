import Log from "../core/Log";
import LevelKeyValue from "./LevelKeyValue";
import BlockPalette from "./BlockPalette";
import DataUtilities from "../core/DataUtilities";
import BlockCube from "../minecraft/BlockCube";
import Block from "./Block";
import MCWorld from "./MCWorld";
import NbtBinary from "./NbtBinary";
import BlockActor from "./blockActors/BlockActor";
import GenericBlockActor from "./blockActors/GenericBlockActor";
import BlockActorFactory from "./blockActors/BlockActorFactory";
import Database from "./Database";

const CHUNK_X_SIZE = 16;
const CHUNK_Z_SIZE = 16;
const SUBCHUNK_Y_SIZE = 16;

const MAX_LEGACY_Y = 128;

export enum SubChunkFormatType {
  paletteFrom1dot2dot13 = 0,
  subChunk1dot0 = 1,
}

export default class WorldChunk {
  checksumKey: LevelKeyValue | undefined;
  subChunks: LevelKeyValue[];
  subChunkVersions: number[] | undefined = undefined;
  chunkVersion: LevelKeyValue | undefined;
  biomesAndElevation: LevelKeyValue | undefined;
  finalizedState: LevelKeyValue | undefined;
  entity: LevelKeyValue | undefined;
  blockActorKeys: LevelKeyValue[] = [];
  blockActorsRelLoc: BlockActor[][][] = [];
  blockActors: BlockActor[] = [];
  pendingTicks: LevelKeyValue | undefined;
  biomeState: LevelKeyValue | undefined;
  blockTops: number[][] | undefined = undefined;

  blockActorsEnsured = false;
  absoluteZeroY = -512;
  chunkMinY: number = 0;
  world: MCWorld;
  legacyTerrainBytes: Uint8Array | undefined = undefined;

  bitsPerBlock: number[];
  blockDataStart: number[];
  blockPalettes: BlockPalette[];
  subChunkFormatType: SubChunkFormatType[];

  actorDigests: string[];

  auxBitsPerBlock: number[];
  auxBlockDataStart: number[];
  auxBlockPalettes: BlockPalette[];
  pendingSubChunksToProcess: boolean[];

  x: number = 0;
  z: number = 0;
  maxSubChunkIndex: number = -512; // set it very low
  minSubChunkIndex: number = 512; // set it very high

  lowestProcessedSubChunkLevel = 32768;

  get absoluteMinY() {
    return this.absoluteZeroY;
  }

  get minY() {
    return this.absoluteZeroY + this.minSubChunkIndex * 16;
  }

  get maxY() {
    return this.absoluteZeroY + (this.maxSubChunkIndex + 1) * 16;
  }

  get absoluteMaxY() {
    return this.absoluteZeroY + this.subChunks.length * 16;
  }

  constructor(world: MCWorld, inX: number, inZ: number) {
    this.world = world;
    this.subChunks = new Array(64);
    this.subChunkFormatType = new Array(64);
    this.blockPalettes = new Array(64);
    this.bitsPerBlock = new Array(64);
    this.blockDataStart = new Array(64);
    this.auxBlockPalettes = new Array(64);
    this.auxBitsPerBlock = new Array(64);
    this.auxBlockDataStart = new Array(64);
    this.pendingSubChunksToProcess = new Array(64);
    this.actorDigests = [];

    for (let i = 0; i < 64; i++) {
      this.pendingSubChunksToProcess[i] = false;
    }

    this.x = inX;
    this.z = inZ;
  }

  addActorDigest(digest: string) {
    this.actorDigests.push(digest);
  }

  translateSubChunkIndex(storageSubChunk: number) {
    Log.assert(
      (storageSubChunk >= 0 && storageSubChunk <= 31) || (storageSubChunk >= 224 && storageSubChunk <= 255),
      "Unexpected subchunk index (" + storageSubChunk + ")"
    );

    if (storageSubChunk >= 224) {
      return storageSubChunk - 224;
    }

    return storageSubChunk + 32;
  }

  processSubChunk(index: number) {
    if (this.pendingSubChunksToProcess[index] === true) {
      this.parseSubChunk(index);
    }

    this.pendingSubChunksToProcess[index] = false;
  }

  addKeyValue(keyValue: LevelKeyValue) {
    let keyBytes = keyValue.keyBytes;

    if (keyBytes) {
      const dimExtensionBytes = keyBytes.length > 18 || keyBytes.length === 13 || keyBytes.length === 14 ? 4 : 0;

      const val = keyBytes[8 + dimExtensionBytes];

      // disabling the "duplicate unexpected versions" since this assumption is violated in C&C R17 world

      switch (val) {
        case 43: // not sure what chunk #43 is, or if this is a parsing bug. observed to be 578 bytes. "data3d"
          break;
        case 115: // not sure what chunk #61 is, or if this is a parsing bug. observed to be one byte with a value of 0
          break;

        case 118: // 118 = legacy version
        case 44: // version
          //    Log.assert(!this.chunkVersion, "Unexpected multiple chunk versions.");
          this.chunkVersion = keyValue;
          break;

        case 45: // data2d
          //  Log.assert(!this.biomesAndElevation, "Unexpected multiple biomes and elevations.");
          this.biomesAndElevation = keyValue;
          break;

        case 46: // data2d legacy
          break;

        case 47: // subchunk prefix
          if (keyValue.level > this.lowestProcessedSubChunkLevel) {
            return;
          }

          this.lowestProcessedSubChunkLevel = keyValue.level;

          let subChunkIndex = this.translateSubChunkIndex(keyBytes[9 + dimExtensionBytes]);

          if (subChunkIndex < 0) {
            return;
          }

          if (this.subChunks[subChunkIndex] !== undefined) {
            //Log.fail("Unexpected subchunk already defined.");
          }

          if (!keyValue.value || keyValue.value.length <= 0) {
            //Log.fail("Empty subchunk defined.");
            return;
          }

          this.subChunks[subChunkIndex] = keyValue;
          this.maxSubChunkIndex = Math.max(this.maxSubChunkIndex, subChunkIndex);
          this.minSubChunkIndex = Math.min(this.minSubChunkIndex, subChunkIndex);
          this.pendingSubChunksToProcess[subChunkIndex] = true;
          break;

        case 48: // legacy terrain
          const bytes = keyValue.value;
          //          Log.assert(!this.legacyTerrainBytes);

          if (bytes && bytes.length > 0) {
            Log.assert(bytes.length === 83200, "LegacyTerrain record should be 83,200 bytes");
            this.legacyTerrainBytes = bytes;
          }
          break;

        case 49: // block entity
          this.blockActorKeys.push(keyValue);
          this.blockActorsEnsured = false;
          this.ensureBlockActors();
          break;

        case 50: // entity
          //       Log.assert(!this.entity, "Unexpected multiple entities.");
          this.entity = keyValue;
          break;

        case 51: // pending ticks
          //Log.assert(!this.pendingTicks, "Unexpected multiple pending ticks.");
          this.pendingTicks = keyValue;
          break;

        case 52: // legacy block extra data
          break;
        case 53: // biome state
          //Log.assert(!this.biomeState, "Unexpected multiple biome states.");
          this.biomeState = keyValue;
          break;

        case 54: // finalized state
          //  Log.assert(!this.finalizedState, "Unexpected multiple states.");
          this.finalizedState = keyValue;
          break;
        case 55: // conversion data. data that the converter provides, that are used at runtime for things like blending. no longer used?
          break;
        case 56: // EDU border blocks?
          break;
        case 57: // spawn areas (hard coded spawners)
          break;
        case 58: // random tick
          break;
        case 59: // check sums
          // Log.assert(!this.checksumKey, "Unexpected multiple states.");
          this.checksumKey = keyValue;
          break;

        case 60: // generation seed
          break;
        case 61: // generated pre caves and cliffs blending (unused)
          break;
        case 62: // blending biome height (unused)
          break;

        case 63: // metadata hash
          break;

        case 64: // blending data
          break;
        case 65: // actor digest version
          break;

        default:
          throw new Error("Unsupported chunk type: " + val);
      }
    }
  }

  clearKeyValue(keyBytes: string) {
    if (keyBytes) {
      const dimExtensionBytes = keyBytes.length > 18 || keyBytes.length === 13 || keyBytes.length === 14 ? 4 : 0;

      const val = keyBytes.charCodeAt(8 + dimExtensionBytes);

      // disabling the "duplicate unexpected versions" since this assumption is violated in C&C R17 world

      switch (val) {
        case 43: // not sure what chunk #43 is, or if this is a parsing bug. observed to be 578 bytes. "data3d"
          break;
        case 115: // not sure what chunk #61 is, or if this is a parsing bug. observed to be one byte with a value of 0
          break;

        case 118: // 118 = legacy version
        case 44: // version
          //    Log.assert(!this.chunkVersion, "Unexpected multiple chunk versions.");
          this.chunkVersion = undefined;
          break;

        case 45: // data2d
          //  Log.assert(!this.biomesAndElevation, "Unexpected multiple biomes and elevations.");
          this.biomesAndElevation = undefined;
          break;

        case 46: // data2d legacy
          break;

        case 47: // subchunk prefix
          break;

        case 48: // legacy terrain
          this.legacyTerrainBytes = undefined;
          break;

        case 49: // block entity
          break;

        case 50: // entity
          //       Log.assert(!this.entity, "Unexpected multiple entities.");
          this.entity = undefined;
          break;

        case 51: // pending ticks
          //Log.assert(!this.pendingTicks, "Unexpected multiple pending ticks.");
          this.pendingTicks = undefined;
          break;

        case 52: // legacy block extra data
          break;
        case 53: // biome state
          //Log.assert(!this.biomeState, "Unexpected multiple biome states.");
          this.biomeState = undefined;
          break;

        case 54: // finalized state
          //  Log.assert(!this.finalizedState, "Unexpected multiple states.");
          this.finalizedState = undefined;
          break;
        case 55: // conversion data. data that the converter provides, that are used at runtime for things like blending. no longer used?
          break;
        case 56: // EDU border blocks?
          break;
        case 57: // spawn areas (hard coded spawners)
          break;
        case 58: // random tick
          break;
        case 59: // check sums
          // Log.assert(!this.checksumKey, "Unexpected multiple states.");
          this.checksumKey = undefined;
          break;

        case 60: // generation seed
          break;
        case 61: // generated pre caves and cliffs blending (unused)
          break;
        case 62: // blending biome height (unused)
          break;

        case 63: // metadata hash
          break;

        case 64: // blending data
          break;
        case 65: // actor digest version
          break;
        case 72: // actor digest version
          break;
        default:
          throw new Error("Unsupported chunk type: " + val);
      }
    }
  }

  ensureBlockActors() {
    if (!this.blockActorsRelLoc || this.blockActorsEnsured) {
      return;
    }

    this.blockActorsRelLoc = [];
    this.blockActors = [];

    for (const keyValue of this.blockActorKeys) {
      if (keyValue.value && keyValue.value.length > 0) {
        const tag = new NbtBinary();

        tag.fromBinary(keyValue.value, true, false, 0, true);

        if (tag.root) {
          const ba = new GenericBlockActor(tag.root);

          if (
            ba.x !== undefined &&
            ba.z !== undefined &&
            ba.y !== undefined &&
            ba.x >= this.x * 16 &&
            ba.x < (this.x + 1) * 16 &&
            ba.z >= this.z * 16 &&
            ba.z < (this.z + 1) * 16
          ) {
            let actorRelX = ba.x % 16;
            let actorRelZ = ba.z % 16;

            if (actorRelX < 0) {
              actorRelX = 16 + actorRelX;
            }

            if (actorRelZ < 0) {
              actorRelZ = 16 + actorRelZ;
            }

            if (ba.id) {
              const specificBa = BlockActorFactory.create(ba.id, tag.root);

              if (specificBa) {
                specificBa.load();
                if (!this.blockActorsRelLoc[actorRelX]) {
                  this.blockActorsRelLoc[actorRelX] = [];
                }
                if (!this.blockActorsRelLoc[actorRelX][ba.y]) {
                  this.blockActorsRelLoc[actorRelX][ba.y] = [];
                }

                this.blockActorsRelLoc[actorRelX][ba.y][actorRelZ] = specificBa;
                this.blockActors.push(specificBa);
              }

              Log.assert(specificBa !== undefined, "Could not find an actor implementation for '" + ba.id + "'");
            }
          }
        }
      }
    }

    this.blockActorsEnsured = true;
  }

  getSubChunkCube(subChunkId: number) {
    const bc = new BlockCube();

    bc.maxX = CHUNK_X_SIZE;
    bc.maxY = SUBCHUNK_Y_SIZE;
    bc.maxZ = CHUNK_Z_SIZE;

    this.fillCube(bc, 0, 0, 0, 16, 16, 16, 0, subChunkId * SUBCHUNK_Y_SIZE, 0);

    return bc;
  }

  fillCubeLegacy(
    cube: BlockCube,
    cubeX: number,
    cubeY: number,
    cubeZ: number,
    maxCubeX: number,
    maxCubeY: number,
    maxCubeZ: number,
    internalOffsetX: number,
    internalOffsetY: number,
    internalOffsetZ: number
  ) {
    Log.assert(
      cubeX >= 0 &&
        cubeY >= 0 &&
        cubeZ >= 0 &&
        maxCubeX > cubeX &&
        maxCubeY > cubeY &&
        maxCubeZ > cubeZ &&
        internalOffsetX < CHUNK_X_SIZE &&
        internalOffsetZ < CHUNK_Z_SIZE &&
        this.legacyTerrainBytes !== undefined,
      "Fill cube legacy not within bounds."
    );

    if (!this.legacyTerrainBytes) {
      return;
    }

    for (let iX = cubeX; iX < maxCubeX && iX - cubeX + internalOffsetX < CHUNK_X_SIZE; iX++) {
      const inChunkX = iX - cubeX + internalOffsetX;
      const plane = cube.x(iX);

      for (let iY = cubeY; iY < maxCubeY && iY - cubeY + internalOffsetY < 128; iY++) {
        const blockLine = plane.y(iY);
        const inChunkY = iY - cubeY + internalOffsetY;

        for (let iZ = cubeZ; iZ < maxCubeZ && iZ - cubeZ + internalOffsetZ < CHUNK_Z_SIZE; iZ++) {
          const inChunkZ = iZ - cubeZ + internalOffsetZ;

          const byte = this.legacyTerrainBytes[inChunkX * 128 * 16 + inChunkZ * 128 + inChunkY];

          if (byte) {
            blockLine.z(iZ).copyFrom(Block.fromLegacyId(byte));
          }
        }
      }
    }
  }

  fillCube(
    cube: BlockCube,
    cubeX: number,
    cubeY: number,
    cubeZ: number,
    maxCubeX: number,
    maxCubeY: number,
    maxCubeZ: number,
    internalOffsetX: number,
    internalOffsetY: number,
    internalOffsetZ: number
  ) {
    if (this.legacyTerrainBytes) {
      this.fillCubeLegacy(
        cube,
        cubeX,
        cubeY,
        cubeZ,
        maxCubeX,
        maxCubeY,
        maxCubeZ,
        internalOffsetX,
        internalOffsetY,
        internalOffsetZ
      );
      return;
    }

    Log.assert(
      cubeX >= 0 &&
        cubeY >= 0 &&
        cubeZ >= 0 &&
        maxCubeX > cubeX &&
        maxCubeY > cubeY &&
        maxCubeZ > cubeZ &&
        internalOffsetX < CHUNK_X_SIZE &&
        internalOffsetZ < CHUNK_Z_SIZE,
      "Fill cube not within bounds."
    );

    const zHeight = maxCubeY - cubeY;
    const initialChunkId = this.getSubChunkIndexFromY(internalOffsetY);
    const finalChunkId = this.getSubChunkIndexFromY(internalOffsetY + zHeight);
    Log.assert(initialChunkId >= 0 && finalChunkId >= initialChunkId);

    for (let i = 0; i <= finalChunkId - initialChunkId; i++) {
      const subChunkId = initialChunkId + i;
      const subChunk = this.subChunks[subChunkId];

      if (subChunk) {
        const subChunkYExtent = this.getStartYFromSubChunkIndex(subChunkId + 1);

        let cubeYStartForThisSubChunk = 0;

        if (i >= 1) {
          cubeYStartForThisSubChunk = 16 - ((Math.abs(this.absoluteZeroY) + internalOffsetY) % 16);
        }
        if (i >= 2) {
          cubeYStartForThisSubChunk += (i - 1) * 16;
        }

        if (this.subChunkFormatType[subChunkId] === SubChunkFormatType.subChunk1dot0) {
          const blockTemplates: Block[] = [];
          const bytes = subChunk.value;
          if (bytes) {
            Log.assert(
              bytes.length === 10241 || bytes.length === 6145,
              "Expected 6145 or 10241 bytes for a legacy subchunk. (" + bytes.length + ")"
            );

            for (let i = 0; i < 4096; i++) {
              let blockTypeIndex = bytes[1 + i];
              let blockAuxIndex = bytes[4097 + i];

              let templateIndex = blockTypeIndex * 256 + blockAuxIndex;

              if (!blockTemplates[templateIndex]) {
                const blockType = Database.getBlockTypeByLegacyId(blockTypeIndex);

                if (!blockType || !blockType.typeId) {
                  throw new Error("Expected a block type for index " + blockTypeIndex);
                }

                const block = new Block("minecraft:" + blockType.typeId);

                block.data = blockAuxIndex;

                blockTemplates[templateIndex] = block;
              }

              cube
                .x(i % 16)
                .y(Math.floor(i / 256))
                .z(Math.floor(i / 16))
                .copyFrom(blockTemplates[templateIndex]);
            }
          }
        } else {
          const subChunkBitsPerBlock = this.bitsPerBlock[subChunkId];
          const bpw = Math.floor(32 / subChunkBitsPerBlock);

          const subChunkBlockDataStart = this.blockDataStart[subChunkId];

          const bytes = subChunk.value;
          const blockPalette = this.blockPalettes[subChunkId];

          if (bytes && blockPalette) {
            for (let iX = cubeX; iX < maxCubeX && iX - cubeX + internalOffsetX < CHUNK_X_SIZE; iX++) {
              const inChunkX = iX - cubeX + internalOffsetX;
              const plane = cube.x(iX);

              const blockIndexXStart = inChunkX * 256;

              for (
                let iY = cubeY + cubeYStartForThisSubChunk;
                iY < maxCubeY && iY - cubeY + internalOffsetY < subChunkYExtent;
                iY++
              ) {
                const inSubChunkY = (Math.abs(this.absoluteZeroY) + (iY - cubeY + internalOffsetY)) % 16;

                Log.assert(inSubChunkY >= 0);

                const blockLine = plane.y(iY);

                for (let iZ = cubeZ; iZ < maxCubeZ && iZ - cubeZ + internalOffsetZ < CHUNK_Z_SIZE; iZ++) {
                  const inChunkZ = iZ - cubeZ + internalOffsetZ;

                  const blockWordByteStart =
                    subChunkBlockDataStart + Math.floor((blockIndexXStart + inChunkZ * 16 + inSubChunkY) / bpw) * 4;

                  const blocksIn = (blockIndexXStart + inChunkZ * 16 + inSubChunkY) % bpw;

                  let word = DataUtilities.getUnsignedInteger(
                    bytes[blockWordByteStart],
                    bytes[blockWordByteStart + 1],
                    bytes[blockWordByteStart + 2],
                    bytes[blockWordByteStart + 3],
                    true
                  );

                  word >>>= subChunkBitsPerBlock * blocksIn;

                  let value = 0;

                  for (let i = 0; i < subChunkBitsPerBlock; i++) {
                    let inc = word % 2;
                    inc <<= i;
                    value += inc;
                    word >>>= 1;
                  }

                  if (blockPalette.blocks.length > 0) {
                    Log.assert(value < blockPalette.blocks.length, "Unexpected block index.");

                    const block = blockPalette.blocks[value];

                    if (block) {
                      blockLine.z(iZ).copyFrom(block);
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  getTopBlockY(x: number, z: number) {
    if (!this.blockTops) {
      this.determineBlockTops();
    }

    if (!this.blockTops) {
      throw new Error("Unexpected block top error.");
    }

    return this.blockTops[x][z];
  }

  getTopBlock(x: number, z: number) {
    if (!this.blockTops) {
      this.determineBlockTops();
    }

    if (!this.blockTops) {
      throw new Error("Unexpected block top error.");
    }

    return this.getBlock(x, this.blockTops[x][z], z);
  }

  _getBlockLegacy(x: number, y: number, z: number) {
    if (!this.legacyTerrainBytes || z < 0 || x < 0 || y < 0) {
      throw new Error();
    }

    const byte = this.legacyTerrainBytes[x * 128 * 16 + z * 128 + y];

    return Block.fromLegacyId(byte);
  }

  _getBlockLegacyList() {
    if (!this.legacyTerrainBytes) {
      throw new Error();
    }

    const blocks: Block[] = [];

    for (let y = 0; y < MAX_LEGACY_Y; y++) {
      for (let z = 0; z < 16; z++) {
        for (let x = 0; x < 16; x++) {
          const byte = this.legacyTerrainBytes[x * 128 * 16 + z * 128 + y];

          blocks.push(Block.fromLegacyId(byte));
        }
      }
    }

    return blocks;
  }

  doesBlockPaletteExist(y: number) {
    if (this.legacyTerrainBytes) {
      return true;
    }
    const subChunkId = this.getSubChunkIndexFromY(y);

    const blockPalettes = this.blockPalettes[subChunkId];

    if (blockPalettes) {
      return true;
    }

    return false;
  }

  // x and z should be between 0 and 15
  getBlock(x: number, y: number, z: number) {
    if (y < this.absoluteZeroY) {
      return undefined;
    }

    if (this.legacyTerrainBytes) {
      return this._getBlockLegacy(x, y, z);
    }

    const subChunkId = this.getSubChunkIndexFromY(y);

    if (this.pendingSubChunksToProcess[subChunkId] === true) {
      this.processSubChunk(subChunkId);
    }

    // legacy subchunk format 1.0 -> 1.2.13
    if (this.subChunkFormatType[subChunkId] === SubChunkFormatType.subChunk1dot0) {
      const subChunk = this.subChunks[subChunkId];

      if (subChunk === undefined) {
        return undefined;
      }

      const bytes = subChunk.value;
      if (bytes) {
        const inSubChunkY = y - this.getStartYFromSubChunkIndex(subChunkId);

        Log.assert(inSubChunkY >= 0 && inSubChunkY < 16, "Unexpected Y for a sub chunk (" + inSubChunkY + ")");
        Log.assert(
          bytes.length === 10241 || bytes.length === 6145,
          "Legacy subchunk format should be 6145 or 10241 bytes. (" + bytes.length + ")"
        );

        const blockTypeIndex = bytes[1 + (inSubChunkY + z * 16 + x * 256)];
        const blockAuxIndex = bytes[4097 + (inSubChunkY + z * 16 + x * 256)];

        const baseType = Database.getBlockTypeByLegacyId(blockTypeIndex);

        Log.assertDefined(baseType.typeId);

        const block = new Block("minecraft:" + baseType.typeId);
        block.data = blockAuxIndex;

        return block;
      }

      return undefined;
    }

    const index = this.getBlockPaletteIndex(x, y, z);

    if (index === undefined) {
      return undefined;
    }

    const blockPalettes = this.blockPalettes[subChunkId];

    if (!blockPalettes) {
      return undefined;
    }

    const blocks = blockPalettes.blocks;

    Log.assert(index < blocks.length, "Unexpected block index");

    return blocks[index];
  }

  getBlockList() {
    if (this.legacyTerrainBytes) {
      return this._getBlockLegacyList();
    }

    const blocks = [];
    for (let subChunkId = this.minSubChunkIndex; subChunkId < this.maxSubChunkIndex; subChunkId++) {
      const subChunk = this.subChunks[subChunkId];

      if (subChunk !== undefined) {
        if (this.pendingSubChunksToProcess[subChunkId] === true) {
          this.processSubChunk(subChunkId);
        }

        if (this.subChunkFormatType[subChunkId] === SubChunkFormatType.subChunk1dot0) {
          const blockTemplates: Block[] = [];
          const bytes = subChunk.value;
          if (bytes) {
            Log.assert(
              bytes.length === 10241 || bytes.length === 6145,
              "Expected 6145 or 10241 bytes for a legacy subchunk in getblock. (" + bytes.length + ")"
            );
            // 6145 bytes if the light information is omitted;
            // 10241 bytes if there is 2kb + 2kb of light information

            for (let i = 0; i < 4096; i++) {
              let blockTypeIndex = bytes[1 + i];
              let blockAuxIndex = bytes[4097 + i];

              let templateIndex = blockTypeIndex * 256 + blockAuxIndex;

              if (!blockTemplates[templateIndex]) {
                const blockType = Database.getBlockTypeByLegacyId(blockTypeIndex);

                if (!blockType || !blockType.typeId) {
                  throw new Error("Expected a block type for index " + blockTypeIndex);
                }

                const block = new Block("minecraft:" + blockType.typeId);

                block.data = blockAuxIndex;

                blockTemplates[templateIndex] = block;
              }

              blocks.push(blockTemplates[templateIndex]);
            }
          }
        } else {
          let indices = this.getBlockPaletteIndexList(subChunkId);

          if (indices) {
            const blockPalettes = this.blockPalettes[subChunkId];

            if (blockPalettes) {
              const blockTemplates = blockPalettes.blocks;

              for (let i = 0; i < indices.length; i++) {
                blocks.push(blockTemplates[indices[i]]);
              }
            }
          }
        }
      }
    }

    return blocks;
  }

  _determineBlockTopsLegacy() {
    if (!this.legacyTerrainBytes || !this.blockTops) {
      return;
    }

    for (let iX = 0; iX < 16; iX++) {
      const iXByte = iX * 128 * 16;

      for (let iZ = 0; iZ < 16; iZ++) {
        const iZByte = iZ * 128;

        for (let iY = 127; iY >= 0; iY--) {
          const byte = this.legacyTerrainBytes[iXByte + iZByte + iY];

          if (byte !== 0) {
            this.blockTops[iX][iZ] = iY;
            iY = -1;
          }
        }
      }
    }
  }

  determineBlockTops() {
    this.blockTops = [];

    for (let i = 0; i < 16; i++) {
      const arr = [];

      for (let j = 0; j < 16; j++) {
        arr.push(-32768);
      }

      this.blockTops.push(arr);
    }

    if (this.legacyTerrainBytes) {
      this._determineBlockTopsLegacy();
      return;
    }

    let matchCount = 0;

    for (let subChunkId = this.maxSubChunkIndex; subChunkId >= 0; subChunkId--) {
      if (this.pendingSubChunksToProcess[subChunkId] === true) {
        this.parseSubChunk(subChunkId);
      }

      const subChunk = this.subChunks[subChunkId];

      if (subChunk !== undefined) {
        const bytes = subChunk.value;

        if (bytes !== undefined) {
          if (this.subChunkFormatType[subChunkId] === SubChunkFormatType.subChunk1dot0) {
            matchCount = 0;

            for (let iY = 15; iY >= 0; iY--) {
              const yIndex = iY + subChunkId * 16 + this.absoluteZeroY;

              for (let iZ = 0; iZ < 16; iZ++) {
                for (let iX = 0; iX < 16; iX++) {
                  let blockTypeId = bytes[iY * 256 + iZ * 64 + iX];

                  if (
                    blockTypeId !== 0 /* air */ &&
                    blockTypeId !== 37 /* flower */ &&
                    blockTypeId !== 31 /* tallgrass*/
                  ) {
                    this.blockTops[iX][iZ] = yIndex;
                    matchCount++;
                    if (matchCount === 256) {
                      return;
                    }
                  }
                }
              }
            }
          } else {
            //y z x
            const subChunkBitsPerBlock = this.bitsPerBlock[subChunkId];
            const bpw = Math.floor(32 / subChunkBitsPerBlock);

            const disallowedIndices = [];

            const blockPals = this.blockPalettes[subChunkId];

            if (blockPals) {
              Log.assert(blockPals.blocks !== undefined);

              for (let iPal = 0; iPal < blockPals.blocks.length; iPal++) {
                const block = blockPals.blocks[iPal];

                if (
                  block.shortTypeName === "air" ||
                  block.shortTypeName === "flower" ||
                  block.shortTypeName === "tallgrass"
                ) {
                  disallowedIndices.push(iPal);
                }
              }
              for (let iY = 15; iY >= 0; iY--) {
                const yIndex = iY + (subChunkId * 16 - 512);

                for (let iZ = 0; iZ < 16; iZ++) {
                  for (let iX = 0; iX < 16; iX++) {
                    if (yIndex >= this.blockTops[iX][iZ]) {
                      const blockIndex = iX * 256 + iZ * CHUNK_Z_SIZE + iY;

                      const byteStart = this.blockDataStart[subChunkId] + Math.floor(blockIndex / bpw) * 4;
                      const blocksIn = blockIndex % bpw;

                      let word = DataUtilities.getUnsignedInteger(
                        bytes[byteStart],
                        bytes[byteStart + 1],
                        bytes[byteStart + 2],
                        bytes[byteStart + 3],
                        true
                      );

                      word >>>= subChunkBitsPerBlock * blocksIn;

                      let value = 0;

                      for (let i = 0; i < subChunkBitsPerBlock; i++) {
                        let inc = word % 2;
                        inc <<= i;
                        value += inc;
                        word >>>= 1;
                      }

                      let matchesSolidIndex = true;

                      for (let iDis = 0; iDis < disallowedIndices.length; iDis++) {
                        if (value === disallowedIndices[iDis]) {
                          matchesSolidIndex = false;
                        }
                      }
                      if (matchesSolidIndex) {
                        matchCount++;
                        this.blockTops[iX][iZ] = yIndex;
                        if (matchCount === 256) {
                          return;
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  getSubChunkIndexFromY(y: number) {
    return Math.floor((y - this.absoluteZeroY) / SUBCHUNK_Y_SIZE);
  }

  getStartYFromSubChunkIndex(subChunkIndex: number) {
    return subChunkIndex * SUBCHUNK_Y_SIZE + this.absoluteZeroY;
  }

  getBlockPaletteIndex(x: number, y: number, z: number) {
    Log.assert(x >= 0 && x <= 15 && z >= 0 && z <= 15, "Unexpected x/z");

    const subChunkId = this.getSubChunkIndexFromY(y);

    const subChunk = this.subChunks[subChunkId];

    if (subChunk === undefined) {
      return undefined;
    }

    const bytes = subChunk.value;

    if (bytes === undefined) {
      return undefined;
    }

    //y z x

    const subChunkY = Math.abs(y % 16);

    const blockIndex = x * 256 + z * CHUNK_Z_SIZE + subChunkY;

    const subChunkBitsPerBlock = this.bitsPerBlock[subChunkId];
    const bpw = Math.floor(32 / subChunkBitsPerBlock);

    const byteStart = this.blockDataStart[subChunkId] + Math.floor(blockIndex / bpw) * 4;
    const blocksIn = blockIndex % bpw;

    let word = DataUtilities.getUnsignedInteger(
      bytes[byteStart],
      bytes[byteStart + 1],
      bytes[byteStart + 2],
      bytes[byteStart + 3],
      true
    );
    //  Log.assert(x !== 15 || y !== 80 || z !== 15);

    word >>>= subChunkBitsPerBlock * blocksIn;

    let value = 0;

    for (let i = 0; i < subChunkBitsPerBlock; i++) {
      let inc = word % 2;

      inc <<= i;
      value += inc;
      word >>>= 1;
    }

    return value;
  }

  getBlockPaletteIndexList(subChunkId: number) {
    const blockIndices = [];

    const subChunk = this.subChunks[subChunkId];

    if (subChunk !== undefined) {
      const bytes = subChunk.value;

      if (bytes === undefined) {
        return undefined;
      }

      //y z x

      const subChunkY = this.absoluteZeroY + this.minSubChunkIndex * 16;

      for (let x = 0; x < 16; x++) {
        for (let z = 0; z < 16; z++) {
          const blockIndex = x * 256 + z * CHUNK_Z_SIZE + subChunkY;

          const subChunkBitsPerBlock = this.bitsPerBlock[subChunkId];
          const bpw = Math.floor(32 / subChunkBitsPerBlock);

          const byteStart = this.blockDataStart[subChunkId] + Math.floor(blockIndex / bpw) * 4;
          const blocksIn = blockIndex % bpw;

          let word = DataUtilities.getUnsignedInteger(
            bytes[byteStart],
            bytes[byteStart + 1],
            bytes[byteStart + 2],
            bytes[byteStart + 3],
            true
          );
          //  Log.assert(x !== 15 || y !== 80 || z !== 15);

          word >>>= subChunkBitsPerBlock * blocksIn;

          let value = 0;

          for (let i = 0; i < subChunkBitsPerBlock; i++) {
            let inc = word % 2;

            inc <<= i;
            value += inc;
            word >>>= 1;
          }

          blockIndices.push(value);
        }
      }
    }

    return blockIndices;
  }

  parseSubChunk(subChunkIndex: number) {
    const bytes = this.subChunks[subChunkIndex].value;

    if (bytes === undefined || bytes.length <= 0 || bytes[0] === 0) {
      return;
    }

    let bitsPerBlock = 1;

    const subChunkVersion = bytes[0]; // should be 1 or 8 or (9 = C&C pt 2?)

    // legacy subchunk format for version 1.0/1.2.13, that predates palette-ized subchunks
    if (subChunkVersion < 8 && subChunkVersion !== 1) {
      this.subChunkFormatType[subChunkIndex] = SubChunkFormatType.subChunk1dot0;
      this.chunkMinY = 0;

      this.world.chunkMinY = Math.min(this.chunkMinY, this.world.chunkMinY);
      return;
    }

    if (!(subChunkVersion === 1 || subChunkVersion === 8 || subChunkVersion === 9)) {
      Log.fail("Unexpected sub chunk version (" + subChunkVersion + ")");
      return;
    }

    let storageAreas = 1;
    let index = 1;

    if (subChunkVersion !== 1) {
      storageAreas = bytes[1]; // is either one or two, to indicate the number of block storage areas.  the second is the auxiliary "water logged" block area
      Log.assert(storageAreas === 1 || storageAreas === 2, "Storage areas > 2 not expected");
      index++;
    }

    if (subChunkVersion === 9) {
      // not sure what this second byte is for. observed to be of values 0, 1, and 252
      // maybe this is the minimum subchunk level?
      const interimVal = bytes[2];

      Log.assert(
        (interimVal >= 0 && interimVal <= 32) || (interimVal >= 224 && interimVal <= 256),
        "Unexpected chunk index"
      );

      index++;
      this.chunkMinY = -512;
    } else if (subChunkVersion === 8) {
      this.chunkMinY = 0;
    }

    if (this.chunkMinY !== undefined) {
      this.world.chunkMinY = Math.min(this.chunkMinY, this.world.chunkMinY);
    }

    for (let sI = 0; sI < storageAreas; sI++) {
      if (bytes[index] % 2 === 1) {
        // if version LSB is set, this indicates a non-save persistence which we should probably never see
        Log.unexpectedError("Unexpected non-save persistence version found.");
      }

      bitsPerBlock = bytes[index] >>> 1;
      index++;

      // have observed empty subchunks with no actual data besides NBT records, where bitsPerBlock === 0
      if (bitsPerBlock === 0) {
        let numPaletteEntries = 1;

        const bp = new BlockPalette();

        index = bp.parseFromBytes(bytes, index, numPaletteEntries);
      } else {
        const blocksPerWord = Math.floor(32 / bitsPerBlock);
        const blockBytes = Math.ceil(4096 / blocksPerWord) * 4;

        const numPaletteEntries = DataUtilities.getUnsignedInteger(
          bytes[blockBytes + index],
          bytes[blockBytes + index + 1],
          bytes[blockBytes + index + 2],
          bytes[blockBytes + index + 3],
          true
        );

        Log.assert(numPaletteEntries <= 4096, "Unexpectedly large number of palette entries");

        const bp = new BlockPalette();

        const blockDataStartIndex = index;

        index = bp.parseFromBytes(bytes, blockBytes + index + 4, numPaletteEntries);

        if (bp.blocks.length !== numPaletteEntries) {
          Log.unexpectedError("Unexpected block palette count mismatch.");
        }

        Log.assert(sI !== storageAreas - 1 || index === bytes.length, "Unexpectedly didn't consume entire subchunk.");

        if (sI === 0) {
          this.blockDataStart[subChunkIndex] = blockDataStartIndex;
          this.bitsPerBlock[subChunkIndex] = bitsPerBlock;
          this.blockPalettes[subChunkIndex] = bp;
          this.subChunkFormatType[subChunkIndex] = SubChunkFormatType.paletteFrom1dot2dot13;
        } else {
          this.auxBlockDataStart[subChunkIndex] = blockDataStartIndex;
          this.auxBitsPerBlock[subChunkIndex] = bitsPerBlock;
          this.auxBlockPalettes[subChunkIndex] = bp;
          this.subChunkFormatType[subChunkIndex] = SubChunkFormatType.paletteFrom1dot2dot13;
        }
      }
    }
  }
}
