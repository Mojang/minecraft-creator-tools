import { NbtTagType } from "./NbtBinaryTag";
import { BlockPropertyType } from "./IBlockTypePropertyData";
import Block from "./Block";
import IProperty from "../dataform/IProperty";

export default class BlockProperty implements IProperty {
  private _value?: string | number | number[] | bigint | bigint[] | boolean;
  private _nbtType: NbtTagType | null = null;

  public id: string | undefined;
  private _block: Block;

  constructor(block: Block) {
    this._block = block;
  }

  static getBlockPropertyTypeByName(name: string) {
    switch (this.name) {
      case "direction":
      case "age":
      case "stage":
        return BlockPropertyType.int;

      case "leaves":
      case "damage":
        return BlockPropertyType.stringEnum;
    }

    throw new Error();
  }

  public get type() {
    if (typeof this._value === "string") {
      return BlockPropertyType.string;
    } else if (typeof this._value === "number") {
      return BlockPropertyType.int;
    } else if (typeof this._value === "boolean") {
      return BlockPropertyType.boolean;
    } else {
      return BlockPropertyType.int;
    }
  }

  public get nbtType(): NbtTagType {
    if (this._nbtType === null) {
      if (typeof this._value === "string") {
        return NbtTagType.string;
      } else if (typeof this._value === "number") {
        return NbtTagType.int;
      } else if (typeof this._value === "boolean") {
        return NbtTagType.byte;
      } else {
        return NbtTagType.byte;
      }
    }

    return this._nbtType;
  }

  public set nbtType(newType: NbtTagType) {
    this._nbtType = newType;
  }

  get value(): string | number | number[] | bigint | bigint[] | boolean | undefined {
    return this._value;
  }

  asBoolean(defaultVal: boolean): boolean {
    if (this._value === null || this._value === undefined) {
      return defaultVal;
    }

    if (typeof this._value === "boolean") {
      return this._value;
    } else if (typeof this._value === "number") {
      return this._value !== 0;
    } else if (typeof this._value === "string") {
      return this._value === "true" || this._value === "1";
    }

    return defaultVal;
  }

  asString(defaultVal: string): string {
    if (this._value === null || this._value === undefined) {
      return defaultVal;
    }

    return this._value.toString();
  }

  asNumber(defaultVal: number): number {
    if (this._value === null || this._value === undefined) {
      return defaultVal;
    }

    if (typeof this._value === "number") {
      return this._value;
    } else if (typeof this._value === "string") {
      return parseInt(this._value);
    } else if (typeof this._value === "boolean") {
      if (this._value) {
        return 1;
      } else {
        return 0;
      }
    }

    return defaultVal;
  }

  set value(newValue: string | number | number[] | bigint | bigint[] | boolean | undefined) {
    if (this._value !== newValue) {
      this._value = newValue;

      this._block._notifyPropertyChanged(this);
    }
  }
}
