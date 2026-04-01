// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import Utilities from "./../core/Utilities";
import Log from "./../core/Log";

import INbtTag from "./INbtTag";

export enum NbtTagType {
  end = 0,
  byte = 1,
  short = 2,
  int = 3,
  long = 4,
  float = 5,
  double = 6,
  byteArray = 7,
  string = 8,
  list = 9,
  compound = 10,
  intArray = 11,
  longArray = 12,
  unknown = 99,
}

export default class NbtBinaryTag {
  type: NbtTagType;
  childTagType: NbtTagType = NbtTagType.unknown;
  name: string;

  value: string | number | bigint | bigint[] | number[] | boolean | null = null;

  isListChild: boolean;

  private _children: NbtBinaryTag[] = [];

  get childrenWithEnd() {
    return this._children;
  }

  getTagChildren(): NbtBinaryTag[] {
    if (this._children.length === 0) {
      return [];
    }

    if (this.lastTagIsEnd) {
      return this._children.slice(0, -1);
    }

    return this._children;
  }

  getTagLength() {
    if (this.lastTagIsEnd) {
      return this._children.length - 1;
    }

    return this._children.length;
  }

  get lastTagIsEnd() {
    if (this._children.length === 0) {
      return false;
    }

    const lastTag = this._children[this._children.length - 1];

    if (lastTag.type === NbtTagType.end) {
      return true;
    } else if (this.childTagType === NbtTagType.end && lastTag._children.length === 0) {
      return true;
    }
    return false;
  }

  get valueAsString() {
    if (typeof this.value === "number") {
      return this.value.toString();
    } else if (typeof this.value === "string") {
      return this.value;
    }

    return "";
  }

  get valueAsJSONObject() {
    let obj = undefined;
    const str = this.valueAsString;

    if (str) {
      try {
        obj = JSON.parse(str);
      } catch (e) {
        obj = undefined;
      }
    }

    return obj;
  }

  get valueAsNumericArray() {
    const childTags = this.getTagChildren();
    const numarr = [];

    for (const childTag of childTags) {
      numarr.push(childTag.valueAsInt);
    }

    return numarr;
  }

  get valueAsStringArray() {
    const childTags = this.getTagChildren();
    const numarr = [];

    for (const childTag of childTags) {
      numarr.push(childTag.valueAsString);
    }

    return numarr;
  }

  get valueAsBoolean() {
    if (typeof this.value === "boolean") {
      return this.value;
    } else if (typeof this.value === "string") {
      if (this.value === "true" || this.value === "TRUE" || this.value === "1") {
        return true;
      }

      return false;
    } else if (typeof this.value === "number") {
      if (this.value <= 0) {
        return false;
      }

      return true;
    }

    return false;
  }

  get valueAsInt() {
    if (typeof this.value === "number") {
      return this.value;
    } else if (typeof this.value === "string") {
      return parseInt(this.value);
    } else if (typeof this.value === "boolean" && this.value === true) {
      return 1;
    }

    return 0;
  }

  get valueAsFloat() {
    if (typeof this.value === "number") {
      return this.value;
    } else if (typeof this.value === "string") {
      return parseFloat(this.value);
    }

    return 0;
  }

  get valueAsBigInt(): bigint {
    if (typeof this.value === "bigint") {
      return this.value;
    }

    const type = typeof this.value;

    if (this.value !== null && (type === "number" || type === "string" || type === "boolean" || type === "bigint")) {
      return BigInt(this.value as string | number | boolean | bigint);
    }

    return BigInt(0);
  }

  constructor(type: NbtTagType, name: string, isListChild: boolean) {
    this.type = type;
    this.name = name;
    this.isListChild = isListChild;
  }

  setListFromArray(arr: number[]) {
    let children = this.getTagChildren();

    if (children.length > arr.length) {
      while (children.length > arr.length) {
        this.removeTagByIndex(children.length - 1);
        children = this.getTagChildren();
      }
    } else {
      while (children.length < arr.length) {
        const newTag = new NbtBinaryTag(NbtTagType.int, "", this.type === NbtTagType.list);
        this.pushTag(newTag);
        children = this.getTagChildren();
      }
    }

    for (let i = 0; i < children.length; i++) {
      children[i].value = arr[i];
    }
  }

  pushTag(tag: NbtBinaryTag) {
    // if this is a list we've got an end tag at the 0 slot, swap it out
    if (
      this.type === NbtTagType.list &&
      this.lastTagIsEnd &&
      this._children.length === 1 &&
      tag.type !== NbtTagType.end
    ) {
      this._children[0] = tag;

      if (
        (this.childTagType === NbtTagType.unknown || this.childTagType === NbtTagType.end) &&
        tag.childTagType !== NbtTagType.end
      ) {
        this.childTagType = tag.type;
      }
    } else if (this.type === NbtTagType.list) {
      if (
        (this.childTagType === NbtTagType.unknown || this.childTagType === NbtTagType.end) &&
        tag.childTagType !== NbtTagType.end
      ) {
        this.childTagType = tag.type;
      }

      this._children.push(tag);
    } else if (this.type === NbtTagType.compound && this.lastTagIsEnd && tag.type !== NbtTagType.end) {
      // duplicate the End tag a the end
      this._children.push(this._children[this._children.length - 1]);

      this._children[this._children.length - 2] = tag;
    } else {
      this._children.push(tag);
    }
  }

  prepareForSave(includingChildren: boolean) {
    if (this.type === NbtTagType.list) {
      if (this._children.length === 0) {
        this.childTagType = NbtTagType.end;
        this.addTag(NbtTagType.end);
      } else if (this._children.length > 1 && this.lastTagIsEnd) {
        this._children = this._children.slice(0, -1);
      }
    } else if (this.type === NbtTagType.compound && !this.lastTagIsEnd) {
      this.addTag(NbtTagType.end);
    }

    if (includingChildren) {
      for (let i = 0; i < this._children.length; i++) {
        this._children[i].prepareForSave(includingChildren);
      }
    }
  }

  getByteSize() {
    this.prepareForSave(false);
    let byteSize = 0;

    if (!this.isListChild) {
      byteSize += 1; // one byte for type of NBT Tag

      if (this.type !== NbtTagType.end) {
        byteSize += 2 + this.name.length; // two bytes + name length for name.  assumes name is ASCII (1 byte per char)
      }
    }

    switch (this.type) {
      case NbtTagType.byte:
        byteSize += 1;
        break;

      case NbtTagType.short:
        byteSize += 2;
        break;

      case NbtTagType.int:
        byteSize += 4;
        break;

      case NbtTagType.long:
        byteSize += 8;
        break;

      case NbtTagType.float:
        byteSize += 4;
        break;

      case NbtTagType.double:
        byteSize += 8;
        break;

      case NbtTagType.string:
        byteSize += 2; // length of string is 2-byte short

        if (typeof this.value === "string") {
          const bytes = Utilities.convertStringToBytes(this.value, "UTF-8");

          if (bytes === undefined) {
            throw new Error("Unexpected NBT conversion error in writing string.");
          }

          byteSize += bytes.length;
        }

        break;

      case NbtTagType.list:
        byteSize += 5; // one byte for type of items, + 4 bytes for length;
        break;

      case NbtTagType.intArray:
        byteSize += 4; // length of array

        byteSize += 4 * (this.value as number[]).length;
        break;

      case NbtTagType.longArray:
        byteSize += 4; // length of array

        byteSize += 8 * (this.value as number[]).length;
        break;

      default:
        break;
    }

    for (let i = 0; i < this._children.length; i++) {
      byteSize += this._children[i].getByteSize();
    }

    return byteSize;
  }

  public getJsonString() {
    return JSON.stringify(this.getJson(), null, 2);
  }

  public getJson() {
    this.prepareForSave(false);

    const tag = new INbtTag();

    if (this.name !== undefined && this.name !== "") {
      tag.name = this.name;
    }

    if (this.type !== NbtTagType.unknown) {
      tag.type = this.type;
    }

    if (this.value !== undefined) {
      tag.value = this.value;
    }

    if (this.childTagType !== NbtTagType.unknown) {
      tag.childTagType = this.childTagType;
    }

    if (this._children.length > 0) {
      tag.children = [];

      for (let i = 0; i < this._children.length; i++) {
        tag.children.push(this._children[i].getJson());
      }
    }

    return tag;
  }

  public writeBytes(bytes: Uint8Array, index: number, littleEndian: boolean) {
    this.prepareForSave(false);

    const byteLength = bytes.buffer.byteLength;
    const dv = new DataView(bytes.buffer, 0, byteLength);

    if (!this.isListChild) {
      // write out type.
      dv.setInt8(index, this.type);
      index += 1;

      if (this.type !== NbtTagType.end) {
        // write out name length;
        dv.setInt16(index, this.name.length, littleEndian);
        index += 2;

        // TODO: probably an incorrect assumption that name is always "ASCII"
        for (let j = 0; j < this.name.length; j++) {
          bytes[index++] = this.name.charCodeAt(j);
        }
      }
    }

    switch (this.type) {
      case NbtTagType.byte:
        dv.setInt8(index, this.valueAsInt);
        index += 1;
        break;

      case NbtTagType.short:
        dv.setInt16(index, this.valueAsInt, littleEndian);
        index += 2;
        break;

      case NbtTagType.int:
        dv.setInt32(index, this.valueAsInt, littleEndian);
        index += 4;
        break;

      case NbtTagType.long:
        dv.setBigInt64(index, this.valueAsBigInt, littleEndian);
        index += 8;
        break;

      case NbtTagType.float:
        dv.setFloat32(index, this.valueAsFloat, littleEndian);
        index += 4;
        break;

      case NbtTagType.double:
        dv.setFloat64(index, this.valueAsFloat, littleEndian);
        index += 8;
        break;

      case NbtTagType.string:
        if (typeof this.value === "string") {
          const bytes = Utilities.convertStringToBytes(this.value, "UTF-8");

          if (bytes === undefined) {
            throw new Error("Unexpected NBT conversion error in writing string.");
          }

          dv.setInt16(index, bytes.length, littleEndian);

          index += 2;

          index = Utilities.writeString(dv, index, this.value, "UTF-8");
          if (index < 0 || index >= byteLength) {
            throw new Error("Unexpected error writing string.");
          }
        } else {
          dv.setInt16(index, 0, littleEndian);
          index += 2;
        }
        break;

      case NbtTagType.list:
        dv.setInt8(index, this.childTagType);
        index += 1;

        dv.setInt32(index, this.getTagLength(), littleEndian);
        index += 4;

        break;

      case NbtTagType.intArray:
        // array length
        dv.setInt32(index, this._children.length, littleEndian);
        index += 4;

        const nums = this.value as number[];

        for (let i = 0; i < nums.length; i++) {
          dv.setInt32(index, nums[i], littleEndian);
          index += 4;
        }

        break;

      case NbtTagType.longArray:
        // array length
        dv.setInt32(index, this._children.length, littleEndian);
        index += 4;

        const bigints = this.value as bigint[];

        for (let i = 0; i < bigints.length; i++) {
          dv.setBigInt64(index, bigints[i], littleEndian);
          index += 8;
        }

        break;
    }

    for (let i = 0; i < this._children.length; i++) {
      index = this._children[i].writeBytes(bytes, index, littleEndian);
    }

    return index;
  }

  public removeTagByIndex(index: number) {
    const newChildren = [];

    let removedItem = false;

    for (let i = 0; i < this._children.length; i++) {
      if (i !== index) {
        newChildren.push(this._children[i]);
      } else {
        removedItem = true;
      }
    }

    this._children = newChildren;

    return removedItem;
  }

  public removeTag(tagName: string) {
    const newChildren = [];

    let removedItem = false;

    for (let i = 0; i < this._children.length; i++) {
      if (this._children[i].name !== tagName) {
        newChildren.push(this._children[i]);
      } else {
        removedItem = true;
      }
    }

    this._children = newChildren;

    return removedItem;
  }

  public ensureTag(tagName: string, tagType: NbtTagType) {
    const tag = this.child(tagName);

    if (tag !== null) {
      Log.assert(tag.type === tagType, "Unexpected data type '" + tag.type + "' for an nbt tag '" + tagName + "'");

      return tag;
    }

    return this.addTag(tagType, tagName);
  }

  public addTag(tagType: NbtTagType, tagName?: string) {
    if (this.type !== NbtTagType.compound && this.type !== NbtTagType.list) {
      throw new Error("Unsupported type for adding a tag");
    }

    if (tagName === undefined) {
      tagName = "";
    }

    const newTag = new NbtBinaryTag(tagType, tagName, this.type === NbtTagType.list);

    this.pushTag(newTag);

    return newTag;
  }

  public getProperty(name: string): NbtBinaryTag | null {
    for (let i = 0; i < this._children.length; i++) {
      if (this._children[i].name === name) {
        return this._children[i];
      }
    }

    return null;
  }

  public child(name: string): NbtBinaryTag | null {
    if (this.name === name) {
      return this;
    }

    for (let i = 0; i < this._children.length; i++) {
      if (this._children[i].name === name) {
        return this._children[i];
      }
    }

    return null;
  }

  public find(name: string): NbtBinaryTag | null {
    if (this.name === name) {
      return this;
    }

    for (let i = 0; i < this._children.length; i++) {
      if (this._children[i].name === name) {
        return this._children[i];
      }
    }

    for (let i = 0; i < this._children.length; i++) {
      const tagChild = this._children[i];

      if (tagChild.type === NbtTagType.compound || tagChild.type === NbtTagType.list) {
        const result = tagChild.find(name);

        if (result != null) {
          return result;
        }
      }
    }
    return null;
  }
}
