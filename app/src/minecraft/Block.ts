// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import BlockCubeLine from "./BlockCubeLine";
import BlockProperty from "./BlockProperty";
import IBlockData from "./IBlockData";
import IBlockSurroundings from "./IBlockSurroundings";
import Database from "./Database";
import BlockType from "./BlockType";
import { BlockRenderType } from "./BlockRenderType";
import { EventDispatcher } from "ste-events";
import Log from "../core/Log";
import IPropertyObject from "../dataform/IPropertyObject";
import ComponentizedBase from "./ComponentizedBase";

export enum BlockFacingDirection {
  Down = 0,
  up = 1,
  north = 2,
  south = 3,
  west = 4,
  east = 5,
}

export enum BlockDirection {
  South = 0,
  West = 1,
  North = 2,
  East = 3,
}

export default class Block extends ComponentizedBase implements IPropertyObject {
  public static MAX_WATER_LEVEL = 16;

  private _type: BlockType | undefined;
  private _bedrockType: BlockType | undefined;
  private _data: number = 0;

  private _covered: boolean | undefined;
  private _typeId: string | undefined;
  private _z: number | undefined;

  private _surroundings: IBlockSurroundings | undefined;

  public line: BlockCubeLine | undefined;
  public extraLiquidDepth: number = -1;
  public persistenceVersion: number = -1;

  public properties: { [id: string]: BlockProperty } = {};

  private _onTypeChanged = new EventDispatcher<Block, Block>();
  private _onPropertyChanged = new EventDispatcher<Block, BlockProperty>();

  public get onTypeChanged() {
    return this._onTypeChanged.asEvent();
  }

  public get onPropertyChanged() {
    return this._onPropertyChanged.asEvent();
  }

  public get data() {
    return this._data;
  }

  public set data(newData: number) {
    this._data = newData;
  }

  public get surroundings() {
    if (this._surroundings !== undefined) {
      return this._surroundings;
    }

    this._ensureSurroundingsIfCube();

    return this._surroundings;
  }

  public setType(blockType: BlockType) {
    this._type = blockType;
    this._bedrockType = undefined;
    this._typeId = blockType.typeId;
  }

  public get opaqueSideCount() {
    this._ensureSurroundingsIfCube();

    if (this._surroundings === undefined) {
      return 0;
    }

    let count = 0;

    const blockShortTypeName = this.shortTypeName;

    let adjacent = this._surroundings.left;
    if (
      adjacent === undefined ||
      adjacent.isEmpty ||
      (!adjacent.isOpaque && blockShortTypeName !== adjacent.shortTypeName)
    ) {
      count++;
    }

    adjacent = this._surroundings.right;
    if (
      adjacent === undefined ||
      adjacent.isEmpty ||
      (!adjacent.isOpaque && blockShortTypeName !== adjacent.shortTypeName)
    ) {
      count++;
    }

    adjacent = this._surroundings.up;
    if (
      adjacent === undefined ||
      adjacent.isEmpty ||
      (!adjacent.isOpaque && blockShortTypeName !== adjacent.shortTypeName)
    ) {
      count++;
    }

    adjacent = this._surroundings.down;
    if (
      adjacent === undefined ||
      adjacent.isEmpty ||
      (!adjacent.isOpaque && blockShortTypeName !== adjacent.shortTypeName)
    ) {
      count++;
    }

    adjacent = this._surroundings.forward;
    if (
      adjacent === undefined ||
      adjacent.isEmpty ||
      (!adjacent.isOpaque && blockShortTypeName !== adjacent.shortTypeName)
    ) {
      count++;
    }

    adjacent = this._surroundings.backward;
    if (
      adjacent === undefined ||
      adjacent.isEmpty ||
      (!adjacent.isOpaque && blockShortTypeName !== adjacent.shortTypeName)
    ) {
      count++;
    }

    return count;
  }

  public get isOpaque() {
    if (this._bedrockType === undefined) {
      this._ensureTypes();
    }

    if (this._bedrockType !== undefined) {
      const baseType = this._bedrockType.baseType;

      return baseType.isOpaque;
    }

    return false;
  }

  private _ensureTypes() {
    if (this._bedrockType !== undefined) {
      return;
    }

    if (this._typeId === undefined) {
      return;
    }

    this._type = Database.ensureBlockType(this._typeId);

    if (
      this._type.javaData !== null &&
      this._type.javaData.name !== null &&
      this._type.javaData.name !== this._typeId
    ) {
      this._bedrockType = Database.ensureBlockType(this._type.javaData.name);

      const typeProp = this.getProperty("type");

      if (typeProp !== undefined) {
        if (this._bedrockType.shortTypeName === "piston" && typeProp.asString("") === "sticky") {
          this._bedrockType = Database.ensureBlockType("sticky_piston");
        } else if (this._bedrockType.shortTypeName === "sticky_piston" && typeProp.asString("") === "normal") {
          this._bedrockType = Database.ensureBlockType("piston");
        }
      }
    } else {
      this._bedrockType = this._type;
    }
  }

  _updateDataFromProperties() {
    this._ensureTypes();

    if (this._bedrockType === undefined) {
      return;
    }

    const baseType = this._bedrockType.baseType;

    let data = 0;

    if (baseType.data.properties !== undefined) {
      for (let i = 0; i < baseType.data.properties.length; i++) {
        const propData = baseType.data.properties[i];

        if (propData.values !== undefined) {
          const prop = this.getProperty(propData.name);

          if (prop !== null && prop !== undefined) {
            for (let j = 0; j < propData.values.length; j++) {
              if (prop.value === propData.values[j].id) {
                const dataAdd = propData.values[j].data;
                if (dataAdd !== undefined) {
                  data += dataAdd;
                }
              }
            }
          }
        }
      }
    }

    this._data = data;
  }

  _notifyTypeChanged() {
    this._onTypeChanged.dispatch(this, this);
  }

  _notifyPropertyChanged(blockProperty: BlockProperty) {
    this._updateDataFromProperties();

    this._onPropertyChanged.dispatch(this, blockProperty);

    if (this.line !== undefined && this.line.cube !== undefined) {
      this.line.cube._notifyBlockPropertyChanged(this);
    }
  }

  public get bedrockType() {
    this._ensureTypes();

    return this._bedrockType;
  }

  public get textureName() {
    this._ensureTypes();

    if (this._bedrockType === undefined) {
      return undefined;
    }

    if (this.shortTypeName === "water") {
      return undefined;
    }

    return this._bedrockType.typeId;
  }

  public copyFrom(block: Block) {
    this.typeName = block.typeName;
  }

  public static fromLegacyId(byte: number) {
    if (byte === 0 || byte >= 256 || byte === undefined) {
      return new Block("minecraft:air");
    }

    const blockType = Database.getBlockTypeByLegacyId(byte);

    if (blockType) {
      return new Block(blockType.typeId);
    }

    // Log.fail("Could not find block identifier: " + byte);

    return new Block("minecraft:dirt");
  }

  public get effectiveWaterLevel() {
    let prop = this.getProperty("level");

    if (prop !== undefined) {
      return prop.asNumber(0) * 2;
    }

    const shortTypeName = this.shortTypeName;

    if (shortTypeName === "water") {
      return 15;
    }

    prop = this.getProperty("liquid_depth");

    if (prop !== undefined) {
      return 15 - prop.asNumber(0);
    }

    if (this.extraLiquidDepth < 0) {
      return 0;
    }

    return 15 - this.extraLiquidDepth;
  }

  public get renderType(): BlockRenderType {
    this._ensureTypes();

    if (this._bedrockType === undefined) {
      return BlockRenderType.BlockOneTexture;
    }

    if (this.shortTypeName === "water") {
      return BlockRenderType.Water;
    }

    return this._bedrockType.renderType;
  }

  public getProperty(name: string) {
    return this.properties[name];
  }

  public ensureProperty(name: string) {
    return this.addProperty(name);
  }

  public getPropertyBoolean(name: string, defaultValue: boolean) {
    const prop = this.properties[name];

    if (prop === undefined || prop === null) {
      return defaultValue;
    }

    return prop.asBoolean(defaultValue);
  }

  public getPropertyString(name: string, defaultValue: string) {
    const prop = this.properties[name];

    if (prop === undefined || prop === null) {
      return defaultValue;
    }

    return prop.asString(defaultValue);
  }

  public getPropertyNumber(name: string, defaultValue: number) {
    const prop = this.properties[name];

    if (prop === undefined || prop === null) {
      return defaultValue;
    }

    return prop.asNumber(defaultValue);
  }

  public addProperty(name: string) {
    let property = this.properties[name];

    if (property == null) {
      property = new BlockProperty(this);
      property.id = name;

      this.properties[name] = property;
    }

    return property;
  }

  public get z() {
    return this._z;
  }

  public set z(value: number | undefined) {
    this._z = value;
  }

  public get x() {
    if (this.line === undefined) {
      return undefined;
    }

    return this.line.x;
  }

  public get y() {
    if (this.line === undefined) {
      return undefined;
    }

    return this.line.y;
  }

  public get coordinatesString(): string {
    if (this.line === undefined) {
      return "";
    }

    return this.x + "." + this.y + "." + this.z;
  }

  public get typeName(): string | undefined {
    return this._typeId;
  }

  public set typeName(val: string | undefined) {
    if (this._typeId !== val) {
      this._typeId = val;
      this._bedrockType = undefined;
      this._type = undefined;

      if (this.line !== undefined && this.line.cube !== undefined) {
        this.line.cube._notifyBlockTypeChanged(this);
      }
    }
  }

  public getBlockData() {
    let typeId = this.typeName;

    if (typeId === null || typeId === undefined) {
      typeId = "";
    }

    const props: { [id: string]: any } = {};

    for (const id in this.properties) {
      const blockProp = this.properties[id];

      props[id] = blockProp.value;
    }

    const blockData: IBlockData = {
      typeId: typeId,
      state: props,
    };

    return blockData;
  }

  public toString(): string {
    return JSON.stringify(this.getBlockData(), null, 2);
  }

  public get isEmpty() {
    return this._typeId == null || this.shortTypeName === "air";
  }

  private _ensureSurroundingsIfCube() {
    if (this.line === undefined || this._z === undefined || this._surroundings !== undefined) {
      return;
    }

    const cube = this.line.cube;
    const curX = this.line.x;
    const curY = this.line.y;
    const curZ = this._z;

    let down = undefined;
    let up = undefined;
    let left = undefined;
    let right = undefined;
    let forward = undefined;
    let backward = undefined;

    const plane = cube.x(curX);

    if (curY >= 1) {
      down = plane.y(curY - 1).z(curZ);
    }

    if (curY < cube.maxY - 1) {
      up = plane.y(curY + 1).z(curZ);
    }

    if (curX >= 1) {
      left = cube
        .x(curX - 1)
        .y(curY)
        .z(curZ);
    }

    if (curX < cube.maxX - 1) {
      right = cube
        .x(curX + 1)
        .y(curY)
        .z(curZ);
    }

    const line = cube.x(curX).y(curY);

    if (curZ >= 1) {
      backward = line.z(curZ - 1);
    }

    if (curZ < cube.maxZ - 1) {
      forward = line.z(curZ + 1);
    }

    this._surroundings = {
      down: down,
      up: up,
      left: left,
      right: right,
      backward: backward,
      forward: forward,
    };
  }

  public get isCovered(): boolean {
    if (this._covered !== undefined) {
      return this._covered;
    }

    this._ensureSurroundingsIfCube();

    if (this._surroundings === undefined || this._z === undefined) {
      this._covered = false;
      return false;
    }

    const surround = this._surroundings;

    if (
      surround.down === undefined ||
      surround.down.isEmpty ||
      !surround.down.isOpaque ||
      !surround.down.isCovered ||
      surround.up === undefined ||
      surround.up.isEmpty ||
      !surround.up.isOpaque ||
      !surround.up.isCovered ||
      surround.left === undefined ||
      surround.left.isEmpty ||
      !surround.left.isOpaque ||
      !surround.left.isCovered ||
      surround.right === undefined ||
      surround.right.isEmpty ||
      !surround.right.isOpaque ||
      !surround.right.isCovered ||
      surround.forward === undefined ||
      surround.forward.isEmpty ||
      !surround.forward.isOpaque ||
      !surround.forward.isCovered ||
      surround.backward === undefined ||
      surround.backward.isEmpty ||
      !surround.backward.isOpaque ||
      !surround.backward.isCovered
    ) {
      this._covered = false;
      return false;
    }

    this._covered = true;
    return true;
  }

  public get isTouchingOtherBlock(): boolean {
    this._ensureSurroundingsIfCube();

    if (this._surroundings === undefined) {
      return false;
    }

    const surr = this._surroundings;

    if (
      (surr.down !== undefined && !surr.down.isEmpty) ||
      (surr.up !== undefined && !surr.up.isEmpty) ||
      (surr.left !== undefined && !surr.left.isEmpty) ||
      (surr.right !== undefined && !surr.right.isEmpty) ||
      (surr.forward !== undefined && !surr.forward.isEmpty) ||
      (surr.backward !== undefined && !surr.backward.isEmpty)
    ) {
      return true;
    }

    return false;
  }

  public get up(): Block | undefined {
    this._ensureSurroundingsIfCube();

    if (this._surroundings === undefined) {
      return undefined;
    }

    return this._surroundings.up;
  }

  public get down(): Block | undefined {
    this._ensureSurroundingsIfCube();

    if (this._surroundings === undefined) {
      return undefined;
    }

    return this._surroundings.down;
  }

  public get left(): Block | undefined {
    this._ensureSurroundingsIfCube();

    if (this._surroundings === undefined) {
      return undefined;
    }

    return this._surroundings.left;
  }

  public get right(): Block | undefined {
    this._ensureSurroundingsIfCube();

    if (this._surroundings === undefined) {
      return undefined;
    }

    return this._surroundings.right;
  }

  public get forward(): Block | undefined {
    this._ensureSurroundingsIfCube();

    if (this._surroundings === undefined) {
      return undefined;
    }

    return this._surroundings.forward;
  }

  public get backward(): Block | undefined {
    this._ensureSurroundingsIfCube();

    if (this._surroundings === undefined) {
      return undefined;
    }

    return this._surroundings.backward;
  }

  public get shortTypeName() {
    if (this._typeId !== undefined) {
      if (this._typeId.startsWith("minecraft:")) {
        return this._typeId.substring(10, this._typeId.length);
      }

      return this._typeId;
    }

    return undefined;
  }

  constructor(typeId?: string) {
    super();

    this._typeId = typeId;
  }

  applyFrom(template: Block) {
    Log.assert(template !== null && template !== undefined, "Undefined block template");

    this._typeId = template.typeName;

    for (const propName in template.properties) {
      const property = template.getProperty(propName);

      const prop = this.ensureProperty(propName);

      prop.nbtType = property.nbtType;
      prop.value = property.value;
    }
  }
}
