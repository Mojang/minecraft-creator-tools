import BlockCube from "./BlockCube";
import NbtBinary from "./NbtBinary";
import NbtBinaryTag, { NbtTagType } from "./NbtBinaryTag";
import ISnbtContent from "./ISnbtContent";
import MinecraftUtilities from "./MinecraftUtilities";
import ISnbtBlock from "./ISnbtBlock";
import Block from "./Block";
import Entity from "./Entity";
import Log from "../core/Log";
import Database from "./Database";
import EntityInventoryComponent from "./components/EntityInventoryComponent";

export default class Structure {
  private _cube: BlockCube | undefined;
  private _entities: Entity[] | undefined;
  private _blockPalette: Block[] = [];
  public nbt: NbtBinary | undefined;

  public defaultBlockPersistenceVersion: number = 17879555;

  public originX: number | undefined;
  public originY: number | undefined;
  public originZ: number | undefined;

  get cube() {
    return this._cube;
  }

  set cube(newCube: BlockCube | undefined) {
    this._cube = newCube;
  }

  get entities() {
    return this._entities;
  }

  shallowCopyFrom(structure: Structure) {
    this.cube = structure.cube;
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

    const root = new NbtBinaryTag(NbtTagType.compound, "", false);

    nbt.root = root;

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

    for (let x = 0; x < this._cube.maxX; x++) {
      for (let y = 0; y < this._cube.maxY; y++) {
        for (let z = 0; z < this._cube.maxZ; z++) {
          const block = this._cube.x(x).y(y).z(z);

          const blockFingerprint = block.toString();

          let paletteId = blockPalette[blockFingerprint];

          if (block.typeName == null || block.typeName === "air") {
            paletteId = -1;
          } else if (paletteId == null) {
            paletteId = paletteBlocks.length;
            blockPalette[blockFingerprint] = paletteId;
            paletteBlocks.push(block);
          }

          primaryLayer.addTag(NbtTagType.int).value = paletteId;
          secondaryLayer.addTag(NbtTagType.int).value = block.extraLiquidDepth;
        }
      }
    }

    /*const entities = */ structure.addTag(NbtTagType.list, "entities");

    if (this._entities !== undefined) {
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

      let version = block.persistenceVersion;

      if (version <= 0) {
        version = this.defaultBlockPersistenceVersion;
      }

      blockState.addTag(NbtTagType.int, "version").value = version;
      blockState.addTag(NbtTagType.end);
    }

    // TODO: add block_position_data here to paletteDefault;
    const blockPositionData = paletteDefault.addTag(NbtTagType.compound, "block_position_data");
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
      this._cube = new BlockCube();
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
    const cube = new BlockCube();

    if (binary.root == null) {
      return;
    }

    const paletteTag = binary.root.find("block_palette");
    const indicesTag = binary.root.find("block_indices");
    const sizeTag = binary.root.find("size");

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

    let i = 0;

    for (let x = 0; x < cube.maxX; x++) {
      for (let y = 0; y < cube.maxY; y++) {
        for (let z = 0; z < cube.maxZ; z++) {
          const blockRefNum = blockRefs[i].value as number;
          const block = cube.x(x).y(y).z(z);

          if (blockRefNum === -1) {
            block.typeName = "minecraft:air";
          } else {
            block.applyFrom(this._blockPalette[blockRefNum]);
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

            if (secondaryBlock.shortTypeName === "water") {
              block.extraLiquidDepth = secondaryBlock.getPropertyNumber("liquid_depth", -1);
            }
          }

          i++;
        }
      }
    }

    const entities = binary.root.find("entities");

    this._entities = [];

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
            } else if (entityPropertyTag.value === null) {
              const prop = entity.ensureComponentProperty(entityPropertyTag.name);
              prop.load();
              prop.value = undefined;
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

    const structureOrigin = binary.root.find("structure_world_origin");

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

    this._cube = cube;
  }
}
