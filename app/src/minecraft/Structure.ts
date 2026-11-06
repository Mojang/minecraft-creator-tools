// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import BlockVolume from "./BlockVolume";
import NbtBinary from "./NbtBinary";
import { NbtTagType } from "./NbtBinaryTag";
import ISnbtContent from "./ISnbtContent";
import MinecraftUtilities from "./MinecraftUtilities";
import ISnbtBlock from "./ISnbtBlock";
import Block from "./Block";
import Entity from "./Entity";
import Log from "../core/Log";
import Database from "./Database";
import EntityInventoryComponent from "./components/EntityInventoryComponent";
import NbtBinaryTag from "./NbtBinaryTag";

/**
 * Block-state schema version stamped on newly authored palette entries:
 * `(major<<24)|(minor<<16)|(patch<<8)|revision`, here 1.21.30.7.
 *
 * `structure load` runs the game's forward-only block upgrader from this version,
 * so it must match the schema the block names were written for. Authored content
 * (structure programs, designStructure) uses modern flattened names such as
 * `minecraft:oak_planks` and `minecraft:blue_wool`, which don't exist in older
 * schemas. Palette entries loaded from an existing file keep their own version.
 */
export const MODERN_BLOCK_PERSISTENCE_VERSION = 18161159;

/** A simple entity to write into a structure, with a structure-relative location. */
export interface IStructureEntityPlacement {
  typeId: string;
  x: number;
  y: number;
  z: number;
}

export default class Structure {
  private _cube: BlockVolume | undefined;
  private _entities: Entity[] | undefined;
  private _blockPalette: Block[] = [];
  public nbt: NbtBinary | undefined;

  public defaultBlockPersistenceVersion: number = MODERN_BLOCK_PERSISTENCE_VERSION;

  public originX: number | undefined;
  public originY: number | undefined;
  public originZ: number | undefined;

  /**
   * Cells that are structure void (`-1` in the file) but hold `minecraft:air` in the
   * cube, in mcstructure order `(x*sizeY + y)*sizeZ + z` for `_cellDims`. Void and
   * air both load as `minecraft:air` for rendering, but only explicit air carves
   * space when placed, so we remember the difference to round-trip it. Cells whose
   * block has no type are always void, which is what new cells get after a resize.
   */
  private _voidCells: Uint8Array | undefined;

  /**
   * The dimensions `_voidCells` and `_blockPositionData` indices were computed for.
   * The cube can be resized in place, so `_syncCellDims` remaps both by coordinate
   * whenever the cube's dimensions no longer match.
   */
  private _cellDims: { x: number; y: number; z: number } | undefined;

  /** Entity compounds read from the loaded file, re-emitted verbatim on save. */
  private _loadedEntityTags: NbtBinaryTag[] = [];

  /**
   * `block_position_data` entries from the loaded file (block entities such as chest
   * contents or sign text), keyed by mcstructure index and re-emitted verbatim on save.
   */
  private _blockPositionData: Map<number, NbtBinaryTag> = new Map();

  /** Additional entities to write on save. */
  public entityPlacements: IStructureEntityPlacement[] = [];

  get cube() {
    return this._cube;
  }

  set cube(newCube: BlockVolume | undefined) {
    if (newCube !== this._cube) {
      this._voidCells = undefined;
      this._blockPositionData = new Map();
      this._cellDims = newCube ? { x: newCube.maxX, y: newCube.maxY, z: newCube.maxZ } : undefined;
    }
    this._cube = newCube;
  }

  /** Remaps the void mask and block entity indices by coordinate if the cube was resized. */
  private _syncCellDims() {
    const cube = this._cube;
    if (cube === undefined) {
      return;
    }
    const old = this._cellDims;
    if (old !== undefined && old.x === cube.maxX && old.y === cube.maxY && old.z === cube.maxZ) {
      return;
    }

    const dims = { x: cube.maxX, y: cube.maxY, z: cube.maxZ };
    this._cellDims = dims;
    if (old === undefined) {
      this._voidCells = undefined;
      this._blockPositionData = new Map();
      return;
    }

    const inNew = (x: number, y: number, z: number) => x < dims.x && y < dims.y && z < dims.z;

    if (this._voidCells !== undefined) {
      const oldCells = this._voidCells;
      const newCells = new Uint8Array(dims.x * dims.y * dims.z);
      for (let i = 0; i < oldCells.length; i++) {
        if (oldCells[i] === 1) {
          const [x, y, z] = Structure._decodeCellIndex(i, old);
          if (inNew(x, y, z)) {
            newCells[(x * dims.y + y) * dims.z + z] = 1;
          }
        }
      }
      this._voidCells = newCells;
    }

    const newData = new Map<number, NbtBinaryTag>();
    for (const [index, tag] of this._blockPositionData) {
      const [x, y, z] = Structure._decodeCellIndex(index, old);
      if (inNew(x, y, z)) {
        newData.set((x * dims.y + y) * dims.z + z, tag);
      }
    }
    this._blockPositionData = newData;
  }

  private static _decodeCellIndex(index: number, dims: { x: number; y: number; z: number }): [number, number, number] {
    const z = index % dims.z;
    const y = Math.floor(index / dims.z) % dims.y;
    const x = Math.floor(index / (dims.z * dims.y));
    return [x, y, z];
  }

  private _cellIndex(x: number, y: number, z: number): number {
    const cube = this._cube as BlockVolume;
    return (x * cube.maxY + y) * cube.maxZ + z;
  }

  /**
   * Sets a cell to air, either as structure void (the world keeps its block when the
   * structure is placed) or as explicit air (carves space). Either way the cell's
   * block entity is dropped. Use this rather than writing `minecraft:air` directly
   * when the distinction matters, since a direct write keeps a stale void bit.
   */
  setVoidAt(x: number, y: number, z: number, isVoid: boolean) {
    const cube = this._cube;
    if (cube === undefined || x < 0 || y < 0 || z < 0 || x >= cube.maxX || y >= cube.maxY || z >= cube.maxZ) {
      return;
    }
    this._syncCellDims();
    cube.x(x).y(y).z(z).typeName = "minecraft:air";
    this.clearVoidAt(x, y, z);
    if (isVoid) {
      if (this._voidCells === undefined) {
        this._voidCells = new Uint8Array(cube.maxX * cube.maxY * cube.maxZ);
      }
      this._voidCells[this._cellIndex(x, y, z)] = 1;
    }
  }

  /**
   * Marks a cell as explicitly written: clears its void bit and block entity. Call
   * after changing a cell's block type so that a later `minecraft:air` is explicit air.
   */
  clearVoidAt(x: number, y: number, z: number) {
    const cube = this._cube;
    if (cube === undefined || x < 0 || y < 0 || z < 0 || x >= cube.maxX || y >= cube.maxY || z >= cube.maxZ) {
      return;
    }
    this._syncCellDims();
    const index = this._cellIndex(x, y, z);
    if (this._voidCells !== undefined) {
      this._voidCells[index] = 0;
    }
    this._blockPositionData.delete(index);
  }

  get entities() {
    return this._entities;
  }

  get loadedEntityCount() {
    return this._loadedEntityTags.length;
  }

  /** True if the cell was structure void in the loaded file and is still unmodified air. */
  isVoidAt(x: number, y: number, z: number): boolean {
    if (this._cube === undefined) {
      return false;
    }
    const block = this._cube.x(x).y(y).z(z);
    if (block.typeName == null || block.typeName === "air") {
      return true;
    }
    if (this._voidCells === undefined || block.typeName !== "minecraft:air") {
      return false;
    }
    this._syncCellDims();
    if (this._voidCells === undefined) {
      return false;
    }
    return this._voidCells[this._cellIndex(x, y, z)] === 1;
  }

  /** Keeps another structure's entities (loaded and placed) when this one replaces it. */
  carryOverEntitiesFrom(structure: Structure) {
    this._loadedEntityTags = structure._loadedEntityTags.slice();
    this.entityPlacements = structure.entityPlacements.slice();
  }

  /** The loaded `block_position_data` compound for a cell (its block entity), if any. */
  getBlockPositionData(x: number, y: number, z: number): NbtBinaryTag | undefined {
    if (this._cube === undefined) {
      return undefined;
    }
    this._syncCellDims();
    return this._blockPositionData.get(this._cellIndex(x, y, z));
  }

  /**
   * Keeps another structure's block entities for cells where `keep` returns true.
   * Both structures must have the same size; set `cube` first, since replacing the
   * cube clears block entities.
   */
  carryOverBlockPositionDataFrom(structure: Structure, keep: (x: number, y: number, z: number) => boolean) {
    const cube = this._cube;
    const other = structure._cube;
    if (
      cube === undefined ||
      other === undefined ||
      cube.maxX !== other.maxX ||
      cube.maxY !== other.maxY ||
      cube.maxZ !== other.maxZ
    ) {
      return;
    }
    this._syncCellDims();
    structure._syncCellDims();
    for (const [index, tag] of structure._blockPositionData) {
      const [x, y, z] = Structure._decodeCellIndex(index, { x: cube.maxX, y: cube.maxY, z: cube.maxZ });
      if (keep(x, y, z)) {
        this._blockPositionData.set(index, tag);
      }
    }
  }

  shallowCopyFrom(structure: Structure) {
    this.cube = structure.cube;
    this._voidCells = structure._voidCells;
    this._cellDims = structure._cellDims;
    this._blockPositionData = structure._blockPositionData;
    this._loadedEntityTags = structure._loadedEntityTags;
    this.entityPlacements = structure.entityPlacements;
    this._entities = structure.entities;
    this.originX = structure.originX;
    this.originY = structure.originY;
    this.originZ = structure.originZ;
  }

  createNbt() {
    if (this._cube === undefined) {
      return;
    }

    const nbt = new NbtBinary();

    const root = nbt.ensureSingleRoot();

    root.addTag(NbtTagType.int, "format_version").value = 1;

    const sizeList = root.addTag(NbtTagType.list, "size");
    sizeList.childTagType = NbtTagType.unknown;

    sizeList.addTag(NbtTagType.int).value = this._cube.maxX;
    sizeList.addTag(NbtTagType.int).value = this._cube.maxY;
    sizeList.addTag(NbtTagType.int).value = this._cube.maxZ;

    const structure = root.addTag(NbtTagType.compound, "structure");

    const blockIndices = structure.addTag(NbtTagType.list, "block_indices");
    const primaryLayer = blockIndices.addTag(NbtTagType.list);
    const secondaryLayer = blockIndices.addTag(NbtTagType.list);

    const blockPalette: { [blockId: string]: number } = {};
    const paletteBlocks: Block[] = [];
    const waterPalette: { [depth: number]: number } = {};

    for (let x = 0; x < this._cube.maxX; x++) {
      for (let y = 0; y < this._cube.maxY; y++) {
        for (let z = 0; z < this._cube.maxZ; z++) {
          const block = this._cube.x(x).y(y).z(z);

          let paletteId: number;

          if (this.isVoidAt(x, y, z)) {
            paletteId = -1;
          } else {
            // Entries with the same name and states but different schema versions upgrade
            // differently on load, so the version is part of the palette identity.
            const blockFingerprint = this._effectivePersistenceVersion(block) + "|" + block.toString();
            paletteId = blockPalette[blockFingerprint];

            if (paletteId == null) {
              paletteId = paletteBlocks.length;
              blockPalette[blockFingerprint] = paletteId;
              paletteBlocks.push(block);
            }
          }

          primaryLayer.addTag(NbtTagType.int).value = paletteId;

          // The secondary layer is a palette index (normally water for waterlogged blocks), not a depth.
          let secondaryId = -1;
          if (block.extraLiquidDepth >= 0 && paletteId !== -1) {
            secondaryId = waterPalette[block.extraLiquidDepth];
            if (secondaryId === undefined) {
              const water = new Block("minecraft:water");
              const depthProp = water.ensureProperty("liquid_depth");
              depthProp.value = block.extraLiquidDepth;
              depthProp.nbtType = NbtTagType.int;
              secondaryId = paletteBlocks.length;
              waterPalette[block.extraLiquidDepth] = secondaryId;
              paletteBlocks.push(water);
            }
          }
          secondaryLayer.addTag(NbtTagType.int).value = secondaryId;
        }
      }
    }

    const entities = structure.addTag(NbtTagType.list, "entities");

    for (const entityTag of this._loadedEntityTags) {
      entities.pushTag(entityTag);
    }

    let uniqueIdSeed = -4294967296n;
    for (const placement of this.entityPlacements) {
      this._addEntityTag(entities, placement, uniqueIdSeed);
      uniqueIdSeed -= 1n;
    }

    const palette = structure.addTag(NbtTagType.compound, "palette");

    structure.addTag(NbtTagType.end);

    const paletteDefault = palette.addTag(NbtTagType.compound, "default");

    palette.addTag(NbtTagType.end);

    const blockStates = paletteDefault.addTag(NbtTagType.list, "block_palette");

    for (let i = 0; i < paletteBlocks.length; i++) {
      const block = paletteBlocks[i];

      if (block.typeName == null) {
        throw new Error("Unexpected palette block.");
      }

      const blockState = blockStates.addTag(NbtTagType.compound);

      blockState.addTag(NbtTagType.string, "name").value = block.typeName;

      const blockStateStates = blockState.addTag(NbtTagType.compound, "states");

      for (const propertyName in block.properties) {
        const blockProperty = block.getProperty(propertyName);

        const propType = blockProperty.nbtType;
        const value = blockProperty.value;

        if (value === undefined) {
          blockStateStates.addTag(propType, propertyName).value = null;
        } else {
          blockStateStates.addTag(propType, propertyName).value = value;
        }
      }

      blockState.addTag(NbtTagType.int, "version").value = this._effectivePersistenceVersion(block);
      blockState.addTag(NbtTagType.end);
    }

    const blockPositionData = paletteDefault.addTag(NbtTagType.compound, "block_position_data");
    this._syncCellDims();
    const cellCount = this._cube.maxX * this._cube.maxY * this._cube.maxZ;
    for (const [index, tag] of [...this._blockPositionData].sort((a, b) => a[0] - b[0])) {
      const z = index % this._cube.maxZ;
      const y = Math.floor(index / this._cube.maxZ) % this._cube.maxY;
      const x = Math.floor(index / (this._cube.maxZ * this._cube.maxY));
      if (index >= 0 && index < cellCount && !this.isVoidAt(x, y, z)) {
        tag.name = String(index);
        blockPositionData.pushTag(tag);
      }
    }
    blockPositionData.addTag(NbtTagType.end);

    paletteDefault.addTag(NbtTagType.end);

    if (this.originX !== undefined && this.originY !== undefined && this.originZ !== undefined) {
      const structureOrigin = root.addTag(NbtTagType.list, "structure_world_origin");

      structureOrigin.addTag(NbtTagType.int).value = this.originX;
      structureOrigin.addTag(NbtTagType.int).value = this.originY;
      structureOrigin.addTag(NbtTagType.int).value = this.originZ;
    }

    root.addTag(NbtTagType.end);

    return nbt;
  }

  private _effectivePersistenceVersion(block: Block) {
    return block.persistenceVersion > 0 ? block.persistenceVersion : this.defaultBlockPersistenceVersion;
  }

  /**
   * Writes a minimal Bedrock entity compound. `Pos` is world-absolute
   * (structure_world_origin + local); the game re-bases it on load.
   */
  private _addEntityTag(entities: NbtBinaryTag, placement: IStructureEntityPlacement, uniqueId: bigint) {
    const typeId = placement.typeId.indexOf(":") >= 0 ? placement.typeId : "minecraft:" + placement.typeId;
    const entity = entities.addTag(NbtTagType.compound);

    entity.addTag(NbtTagType.string, "identifier").value = typeId;

    const definitions = entity.addTag(NbtTagType.list, "definitions");
    definitions.addTag(NbtTagType.string).value = "+" + typeId;

    const center = (v: number) => (Number.isInteger(v) ? v + 0.5 : v);
    const pos = entity.addTag(NbtTagType.list, "Pos");
    pos.addTag(NbtTagType.float).value = (this.originX ?? 0) + center(placement.x);
    pos.addTag(NbtTagType.float).value = (this.originY ?? 0) + placement.y;
    pos.addTag(NbtTagType.float).value = (this.originZ ?? 0) + center(placement.z);

    const rotation = entity.addTag(NbtTagType.list, "Rotation");
    rotation.addTag(NbtTagType.float).value = 0;
    rotation.addTag(NbtTagType.float).value = 0;

    const motion = entity.addTag(NbtTagType.list, "Motion");
    motion.addTag(NbtTagType.float).value = 0;
    motion.addTag(NbtTagType.float).value = 0;
    motion.addTag(NbtTagType.float).value = 0;

    entity.addTag(NbtTagType.long, "UniqueID").value = uniqueId;
    entity.addTag(NbtTagType.list, "Tags");
    entity.addTag(NbtTagType.byte, "OnGround").value = 1;
    entity.addTag(NbtTagType.end);
  }

  loadFromSnbtText(text: string) {
    let structure = null;

    const content = MinecraftUtilities.fixupJson(text);

    try {
      // temporarily putting back in the safe code.
      structure = JSON.stringify(content); // eval('(' + content + ')');
    } catch (e) {
      throw new Error("Error processing SNBT.");
    }

    if (structure === null || structure === undefined) {
      throw new Error("Could not create SNBT.");
    }
  }

  loadFromSnbt(content: ISnbtContent) {
    if (
      content.size === null ||
      content.size === undefined ||
      content.size.length !== 3 ||
      content.data === undefined
    ) {
      throw new Error("Unexpected structure to Snbt file.");
    }

    if (this._cube === undefined) {
      this._cube = new BlockVolume();
    }

    this._cube.setMaxDimensions(content.size[0], content.size[1], content.size[2]);

    for (let i = 0; i < content.data.length; i++) {
      const block: ISnbtBlock = content.data[i];

      if (block.pos === undefined || block.pos.length !== 3 || block.state === undefined) {
        throw new Error("Unexpected format for a block in an Snbt");
      }

      const targetBlock = this._cube.x(block.pos[0]).y(block.pos[1]).z(block.pos[2]);

      let blockTypeId = block.state;

      const firstCurly = blockTypeId.indexOf("{");

      if (firstCurly >= 0) {
        if (blockTypeId[blockTypeId.length - 1] !== "}") {
          throw new Error("Unexpected property found.");
        }

        const props = blockTypeId.substring(firstCurly + 1, blockTypeId.length - 1).split(",");

        for (const prop of props) {
          const propArr = prop.split(":");

          if (propArr.length === 2) {
            targetBlock.ensureProperty(propArr[0]).value = propArr[1];
          } else {
            throw new Error("Unexpected property found.");
          }
        }

        blockTypeId = blockTypeId.substring(0, firstCurly);
      }

      targetBlock.typeName = blockTypeId;
    }
  }

  async loadFromNbtBytes(bytes: Uint8Array) {
    const tag = new NbtBinary();

    tag.fromBinary(bytes, true, false);

    this.nbt = tag;

    await this.loadFromNbt(tag);
  }

  getMCStructureBytes() {
    if (this.originX === undefined) {
      this.originX = 10;
    }

    if (this.originY === undefined) {
      this.originY = 10;
    }

    if (this.originZ === undefined) {
      this.originZ = 10;
    }

    const nbt = this.createNbt();

    if (nbt !== undefined) {
      const bytes = nbt.toBinary();

      return bytes;
    }

    Log.fail("Could not create MC Structure bytes for updated.");

    return undefined;
  }

  async loadFromNbt(binary: NbtBinary) {
    const cube = new BlockVolume();

    const root = binary.singleRoot;

    if (root === null) {
      return;
    }

    const paletteTag = root.find("block_palette");
    const indicesTag = root.find("block_indices");
    const sizeTag = root.find("size");

    if (
      paletteTag === null ||
      sizeTag === null ||
      indicesTag === null ||
      sizeTag.getTagChildren().length !== 3 ||
      indicesTag.getTagChildren().length !== 2
    ) {
      return;
    }

    const sizeTagChildren = sizeTag.getTagChildren();
    const indicesChildren = indicesTag.getTagChildren();
    const paletteTagChildren = paletteTag.getTagChildren();

    cube.setMaxDimensions(
      sizeTagChildren[0].value as number,
      sizeTagChildren[1].value as number,
      sizeTagChildren[2].value as number
    );

    this._blockPalette = [];

    for (let i = 0; i < paletteTagChildren.length; i++) {
      const state = paletteTagChildren[i];

      const name = state.getProperty("name");
      const states = state.getProperty("states");
      const version = state.getProperty("version");

      if (name != null && states != null && version != null) {
        const block = new Block(name.value as string);

        this._blockPalette.push(block);

        const statesChildren = states.getTagChildren();

        for (let j = 0; j < statesChildren.length; j++) {
          const state = statesChildren[j];

          const blockProp = block.ensureProperty(state.name);

          blockProp.nbtType = state.type;

          if (state.value === null) {
            blockProp.value = undefined;
          } else {
            blockProp.value = state.value;
          }
        }

        block.persistenceVersion = version.value as number;
        this.defaultBlockPersistenceVersion = block.persistenceVersion;
      }
    }

    const blockRefs = indicesChildren[0].getTagChildren();
    const voidCells = new Uint8Array(cube.maxX * cube.maxY * cube.maxZ);

    let i = 0;

    for (let x = 0; x < cube.maxX; x++) {
      for (let y = 0; y < cube.maxY; y++) {
        for (let z = 0; z < cube.maxZ; z++) {
          const blockRefNum = blockRefs[i].value as number;
          const block = cube.x(x).y(y).z(z);

          if (blockRefNum === -1) {
            block.typeName = "minecraft:air";
            voidCells[i] = 1;
          } else {
            const paletteBlock = this._blockPalette[blockRefNum];
            block.applyFrom(paletteBlock);
            block.persistenceVersion = paletteBlock.persistenceVersion;
          }
          block.extraLiquidDepth = -1;

          i++;
        }
      }
    }

    const waterLevels = indicesChildren[1].getTagChildren();
    i = 0;
    for (let x = 0; x < cube.maxX; x++) {
      for (let y = 0; y < cube.maxY; y++) {
        for (let z = 0; z < cube.maxZ; z++) {
          const secondaryBlockIndex = waterLevels[i].value as number;

          if (secondaryBlockIndex !== -1) {
            const block = cube.x(x).y(y).z(z);

            const secondaryBlock = this._blockPalette[secondaryBlockIndex];

            if (secondaryBlock.shortTypeId === "water") {
              block.extraLiquidDepth = secondaryBlock.getPropertyNumber("liquid_depth", -1);
            }
          }

          i++;
        }
      }
    }

    const entities = root.find("entities");

    this._entities = [];
    this._loadedEntityTags = entities !== null ? entities.getTagChildren().slice() : [];
    this.entityPlacements = [];

    if (entities !== null) {
      await Database.loadUx();

      if (Database.uxCatalog !== undefined) {
        const entitiesChildren = entities.getTagChildren();

        for (let i = 0; i < entitiesChildren.length; i++) {
          const entityTag = entitiesChildren[i];

          const entity = new Entity();

          const entityTagChildren = entityTag.getTagChildren();

          for (let j = 0; j < entityTagChildren.length; j++) {
            const entityPropertyTag = entityTagChildren[j];

            if (entityPropertyTag.name === "definitions") {
              entity.loadDefinitionsFromNbtTag(entityPropertyTag);
            } else if (entityPropertyTag.name === "identifier") {
              Log.assert(entityPropertyTag.type === NbtTagType.string, "Expected string type");

              entity.typeId = entityPropertyTag.valueAsString;
            } else if (entityPropertyTag.name === "Attributes") {
              entity.loadAttributeComponentsFromNbtTag(entityPropertyTag);
            } else if (entityPropertyTag.name === "Rotation") {
              entity.loadRotationFromNbtTag(entityPropertyTag);
            } else if (entityPropertyTag.name === "Tags") {
              entity.loadTagsFromNbtTag(entityPropertyTag);
            } else if (entityPropertyTag.name === "ChestItems") {
              const inventoryComponent = entity.ensureDataComponent(
                "inventory",
                new EntityInventoryComponent()
              ) as EntityInventoryComponent;

              inventoryComponent.loadFromNbtTag(entityPropertyTag);
            } else if (entityPropertyTag.name === "Armor") {
              const inventoryComponent = entity.ensureDataComponent(
                "armor_inventory",
                new EntityInventoryComponent()
              ) as EntityInventoryComponent;

              inventoryComponent.loadFromNbtTag(entityPropertyTag);
            } else if (entityPropertyTag.name === "Mainhand") {
              const subElement = entityPropertyTag.getTagChildren();

              if (subElement.length === 1) {
                const inventoryComponent = entity.ensureDataComponent(
                  "mainhand",
                  new EntityInventoryComponent()
                ) as EntityInventoryComponent;

                inventoryComponent.loadFromNbtTag(entityPropertyTag);
              }
            } else if (entityPropertyTag.name === "Offhand") {
              const subElement = entityPropertyTag.getTagChildren();

              if (subElement.length === 1) {
                const inventoryComponent = entity.ensureDataComponent(
                  "offhand",
                  new EntityInventoryComponent()
                ) as EntityInventoryComponent;

                inventoryComponent.loadFromNbtTag(entityPropertyTag);
              }
            } else if (entityPropertyTag.name === "Pos") {
              entity.loadLocationFromNbtTag(entityPropertyTag);
            } else if (entityPropertyTag.name === "internalComponents") {
            } else if (entityPropertyTag.value === null) {
              const prop = entity.ensureComponentProperty(entityPropertyTag.name);
              prop.load();
              prop.value = undefined;
            } else if (
              entityPropertyTag.name === "Air" ||
              entityPropertyTag.name === "Chested" ||
              entityPropertyTag.name === "Color" ||
              entityPropertyTag.name === "Color2" ||
              entityPropertyTag.name === "Dead" ||
              entityPropertyTag.name === "DeathTime" ||
              entityPropertyTag.name === "FallDistance" ||
              entityPropertyTag.name === "HurtTime" ||
              entityPropertyTag.name === "Invulnerable" ||
              entityPropertyTag.name === "IsAngry" ||
              entityPropertyTag.name === "IsAutonomous" ||
              entityPropertyTag.name === "IsBaby" ||
              entityPropertyTag.name === "IsEating" ||
              entityPropertyTag.name === "IsGliding" ||
              entityPropertyTag.name === "IsGlobal" ||
              entityPropertyTag.name === "IsIllagerCaptain" ||
              entityPropertyTag.name === "IsOrphaned" ||
              entityPropertyTag.name === "IsOutOfControl" ||
              entityPropertyTag.name === "IsPregnant" ||
              entityPropertyTag.name === "IsRoaring" ||
              entityPropertyTag.name === "IsScared" ||
              entityPropertyTag.name === "IsStunned" ||
              entityPropertyTag.name === "IsSwimming" ||
              entityPropertyTag.name === "IsTamed" ||
              entityPropertyTag.name === "IsTrusting" ||
              entityPropertyTag.name === "LeasherID" ||
              entityPropertyTag.name === "LootDropped" ||
              entityPropertyTag.name === "MarkVariant" ||
              entityPropertyTag.name === "NaturalSpawn" ||
              entityPropertyTag.name === "OnGround" ||
              entityPropertyTag.name === "OwnerNew" ||
              entityPropertyTag.name === "PortalCooldown" ||
              entityPropertyTag.name === "Saddled" ||
              entityPropertyTag.name === "Sheared" ||
              entityPropertyTag.name === "ShowBottom" ||
              entityPropertyTag.name === "Sitting" ||
              entityPropertyTag.name === "SkinID" ||
              entityPropertyTag.name === "SpawnedByNight" ||
              entityPropertyTag.name === "Strength" ||
              entityPropertyTag.name === "StrengthMax" ||
              entityPropertyTag.name === "Surface" ||
              entityPropertyTag.name === "TargetID" ||
              entityPropertyTag.name === "TradeExperience" ||
              entityPropertyTag.name === "TradeTier" ||
              entityPropertyTag.name === "UniqueID" ||
              entityPropertyTag.name === "Variant" ||
              entityPropertyTag.name === "boundX" ||
              entityPropertyTag.name === "boundY" ||
              entityPropertyTag.name === "boundZ" ||
              entityPropertyTag.name === "canPickupItems" ||
              entityPropertyTag.name === "expDropEnabled" ||
              entityPropertyTag.name === "hasBoundOrigin" ||
              entityPropertyTag.name === "hasSetCanPickupItems" ||
              entityPropertyTag.name === "isOrphaned"
            ) {
              // placeholder for unimplemented properties
              // entity.loadTagsFromNbtTag(entityPropertyTag);
            } else {
              const prop = entity.ensureComponentProperty(entityPropertyTag.name);
              prop.load();
              prop.value = entityPropertyTag.value;
            }
          }

          this._entities.push(entity);
        }
      }
    }

    const structureOrigin = root.find("structure_world_origin");

    if (structureOrigin !== null && structureOrigin.getTagChildren().length === 3) {
      const structuresOriginChildren = structureOrigin.getTagChildren();

      this.originX = structuresOriginChildren[0].valueAsInt;
      this.originY = structuresOriginChildren[1].valueAsInt;
      this.originZ = structuresOriginChildren[2].valueAsInt;
    } else {
      this.originX = undefined;
      this.originY = undefined;
      this.originZ = undefined;
    }

    this._blockPositionData = new Map();
    const blockPositionData = root.find("block_position_data");
    if (blockPositionData !== null) {
      const cellCount = cube.maxX * cube.maxY * cube.maxZ;
      for (const entry of blockPositionData.getTagChildren()) {
        const index = Number(entry.name);
        if (Number.isInteger(index) && index >= 0 && index < cellCount) {
          this._blockPositionData.set(index, entry);
        }
      }
    }

    this._cube = cube;
    this._voidCells = voidCells;
    this._cellDims = { x: cube.maxX, y: cube.maxY, z: cube.maxZ };
  }
}
