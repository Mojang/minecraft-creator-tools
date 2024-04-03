// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import NbtBinaryTag, { NbtTagType } from "./NbtBinaryTag";
import Utilities from "./../core/Utilities";
import INbtTag from "./INbtTag";
import Log from "../core/Log";
import { IErrorMessage, IErrorable } from "../core/IErrorable";

export default class NbtBinary implements IErrorable {
  root: NbtBinaryTag | null = null;
  context?: string;
  isInErrorState?: boolean;
  errorMessages?: IErrorMessage[];

  private _pushError(message: string, contextIn?: string) {
    this.isInErrorState = true;

    if (this.errorMessages === undefined) {
      this.errorMessages = [];
    }

    let contextOut = undefined;

    if (contextIn) {
      contextOut = this.context ? this.context + "-" + contextIn : contextIn;
    } else {
      contextOut = this.context;
    }

    Log.error(message + (contextOut ? " " + contextOut : ""));

    this.errorMessages.push({
      message: message,
      context: contextOut,
    });
  }

  private _getSignedByte(num: number) {
    const buffer = new ArrayBuffer(1);
    const bytes = new Uint8Array(buffer);

    bytes[0] = num;

    const view = new DataView(buffer);

    return view.getInt8(0);
  }

  private _getFloat(num1: number, num2: number, num3: number, num4: number, littleEndian: boolean) {
    const buffer = new ArrayBuffer(4);
    const bytes = new Uint8Array(buffer);

    bytes[0] = num1;
    bytes[1] = num2;
    bytes[2] = num3;
    bytes[3] = num4;

    const view = new DataView(buffer);

    return view.getFloat32(0, littleEndian);
  }

  private _getSignedLong(
    num1: number,
    num2: number,
    num3: number,
    num4: number,
    num5: number,
    num6: number,
    num7: number,
    num8: number,
    littleEndian: boolean
  ) {
    const buffer = new ArrayBuffer(8);
    const bytes = new Uint8Array(buffer);

    bytes[0] = num1;
    bytes[1] = num2;
    bytes[2] = num3;
    bytes[3] = num4;
    bytes[4] = num5;
    bytes[5] = num6;
    bytes[6] = num7;
    bytes[7] = num8;

    const view = new DataView(buffer);

    return view.getBigInt64(0, littleEndian);
  }

  private _getSignedDouble(
    num1: number,
    num2: number,
    num3: number,
    num4: number,
    num5: number,
    num6: number,
    num7: number,
    num8: number,
    littleEndian: boolean
  ) {
    const buffer = new ArrayBuffer(8);
    const bytes = new Uint8Array(buffer);

    bytes[0] = num1;
    bytes[1] = num2;
    bytes[2] = num3;
    bytes[3] = num4;
    bytes[4] = num5;
    bytes[5] = num6;
    bytes[6] = num7;
    bytes[7] = num8;

    const view = new DataView(buffer);

    return view.getFloat64(0, littleEndian);
  }

  private _getVarInt(data: Uint8Array, index: number) {
    let bytesRead = 0;
    let result = 0;
    let currentByte = 0;

    do {
      currentByte = data[index];

      const currentByteVal = currentByte & 0b01111111;

      result |= currentByteVal << (7 * bytesRead);

      bytesRead++;

      if (bytesRead > 5) {
        throw new Error("VarInt is unexpectedly large");
      }
    } while ((currentByte & 0b10000000) !== 0);

    return {
      value: result,
      bytesRead: bytesRead,
    };
  }

  private _getSignedShort(num1: number, num2: number, littleEndian: boolean) {
    const buffer = new ArrayBuffer(2);

    const bytes = new Uint8Array(buffer);

    bytes[0] = num1;
    bytes[1] = num2;

    const view = new DataView(buffer);

    return view.getInt16(0, littleEndian);
  }

  private _getUnsignedShort(num1: number, num2: number, littleEndian: boolean) {
    const buffer = new ArrayBuffer(2);

    const bytes = new Uint8Array(buffer);

    bytes[0] = num1;
    bytes[1] = num2;

    const view = new DataView(buffer);

    return view.getUint16(0, littleEndian);
  }

  private _getSignedInteger(num1: number, num2: number, num3: number, num4: number, littleEndian: boolean) {
    const buffer = new ArrayBuffer(4);

    const bytes = new Uint8Array(buffer);

    bytes[0] = num1;
    bytes[1] = num2;
    bytes[2] = num3;
    bytes[3] = num4;

    const view = new DataView(buffer);

    const val = view.getInt32(0, littleEndian);

    return val;
  }

  private _getUnsignedInteger(num1: number, num2: number, num3: number, num4: number, littleEndian: boolean) {
    const buffer = new ArrayBuffer(4);

    const bytes = new Uint8Array(buffer);

    bytes[0] = num1;
    bytes[1] = num2;
    bytes[2] = num3;
    bytes[3] = num4;

    const view = new DataView(buffer);

    return view.getUint32(0, littleEndian);
  }

  getJsonString() {
    return JSON.stringify(this.getJson());
  }

  getJson(): INbtTag {
    if (this.root === null) {
      return {};
    }
    return this.root.getJson();
  }

  toBinary(): Uint8Array | undefined {
    if (this.root === undefined || this.root === null) {
      return undefined;
    }

    const byteSize = this.root.getByteSize();
    const ab = new ArrayBuffer(byteSize);
    const bytes = new Uint8Array(ab);

    const bytesWritten = this.root.writeBytes(bytes, 0, true);

    if (bytesWritten !== byteSize) {
      throw new Error("Unexpectedly didn't write out our full structure.");
    }

    return bytes;
  }

  ensureRoot() {
    if (this.root) {
      return;
    }

    this.root = new NbtBinaryTag(NbtTagType.compound, "", false);
  }

  fromBinary(
    data: Uint8Array,
    littleEndian: boolean,
    isVarint: boolean,
    skipBytes?: number,
    stringsAreASCII?: boolean
  ) {
    const tagStack: NbtBinaryTag[] = [];
    const listCountStack: number[] = [];
    const listTypeStack: NbtTagType[] = [];

    let i = 0;

    if (skipBytes !== undefined) {
      i = skipBytes;
    }
    if (!stringsAreASCII) {
      stringsAreASCII = false;
    }

    while (i < data.length) {
      let tagType: NbtTagType = NbtTagType.unknown;
      let name = "";

      let isListChild = false;

      if (tagStack.length === 0 || tagStack[tagStack.length - 1].type !== NbtTagType.list) {
        tagType = data[i++] as NbtTagType;

        if (tagType > 13 && tagType !== 99) {
          this._pushError("Unexpected NBT tag type: " + tagType);
        }

        if (tagType !== NbtTagType.end) {
          let nameLength = 0;

          if (isVarint) {
            const result = this._getVarInt(data, i);
            nameLength = result.value;
            i += result.bytesRead;
          } else {
            nameLength = data[i++];
            nameLength += data[i++] * 256;
          }

          for (let j = 0; j < nameLength; j++) {
            name += String.fromCharCode(data[i++]);
          }
        } else if (tagStack.length === 0) {
          break;
        }
      } // we're in list sub tag parsing mode
      else {
        tagType = listTypeStack[tagStack.length - 1];
        isListChild = true;
      }

      const activeTag = new NbtBinaryTag(tagType, name, isListChild);

      if (tagStack.length === 0) {
        this.root = activeTag;
      } // if (activeTag.type !== NbtTagType.end)
      else {
        const parentTag = tagStack[tagStack.length - 1];

        if (
          parentTag.type === NbtTagType.list &&
          (parentTag.childTagType === undefined || parentTag.childTagType === NbtTagType.unknown)
        ) {
          parentTag.childTagType = activeTag.type;
        }

        parentTag.childrenWithEnd.push(activeTag);
      }

      if (tagStack.length > 0 && tagStack[tagStack.length - 1].type === NbtTagType.list) {
        listCountStack[tagStack.length - 1]--;

        if (listCountStack[tagStack.length - 1] === 0) {
          tagStack.pop();
        }
      }

      if (activeTag.type === NbtTagType.compound) {
        tagStack.push(activeTag);
      } else if (activeTag.type === NbtTagType.end) {
        tagStack.pop();
        if (tagStack.length === 0) {
          break;
        }
      } else if (activeTag.type === NbtTagType.byte) {
        activeTag.value = this._getSignedByte(data[i++]);
      } else if (activeTag.type === NbtTagType.byteArray) {
        const arrayLength = this._getSignedInteger(data[i++], data[i++], data[i++], data[i++], littleEndian);

        const numberArray: number[] = [];

        for (let j = 0; j < arrayLength; j++) {
          numberArray.push(this._getSignedByte(data[i++]));
        }

        activeTag.value = numberArray;
      } else if (activeTag.type === NbtTagType.list) {
        activeTag.type = NbtTagType.list;
        tagStack.push(activeTag);

        listTypeStack[tagStack.length - 1] = data[i++] as NbtTagType;
        listCountStack[tagStack.length - 1] = this._getSignedInteger(
          data[i++],
          data[i++],
          data[i++],
          data[i++],
          littleEndian
        );
      } else if (activeTag.type === NbtTagType.intArray) {
        const arrayLength = this._getSignedInteger(data[i++], data[i++], data[i++], data[i++], littleEndian);

        const numberArray: number[] = [];

        for (let j = 0; j < arrayLength; j++) {
          numberArray.push(this._getSignedInteger(data[i++], data[i++], data[i++], data[i++], littleEndian));
        }

        activeTag.value = numberArray;
      } else if (activeTag.type === NbtTagType.longArray) {
        const arrayLength = this._getSignedInteger(data[i++], data[i++], data[i++], data[i++], littleEndian);

        const numberArray: bigint[] = [];

        for (let j = 0; j < arrayLength; j++) {
          numberArray.push(
            this._getSignedLong(
              data[i++],
              data[i++],
              data[i++],
              data[i++],
              data[i++],
              data[i++],
              data[i++],
              data[i++],
              littleEndian
            )
          );
        }

        activeTag.value = numberArray;
      } else if (activeTag.type === NbtTagType.short) {
        activeTag.value = this._getSignedShort(data[i++], data[i++], littleEndian);
      } else if (activeTag.type === NbtTagType.int) {
        activeTag.value = this._getSignedInteger(data[i++], data[i++], data[i++], data[i++], littleEndian);
      } else if (activeTag.type === NbtTagType.float) {
        activeTag.value = this._getFloat(data[i++], data[i++], data[i++], data[i++], littleEndian);
      } else if (activeTag.type === NbtTagType.double) {
        activeTag.value = this._getSignedDouble(
          data[i++],
          data[i++],
          data[i++],
          data[i++],
          data[i++],
          data[i++],
          data[i++],
          data[i++],
          littleEndian
        );
      } else if (activeTag.type === NbtTagType.long) {
        activeTag.value = this._getSignedLong(
          data[i++],
          data[i++],
          data[i++],
          data[i++],
          data[i++],
          data[i++],
          data[i++],
          data[i++],
          littleEndian
        );
      } else if (activeTag.type === NbtTagType.string) {
        let stringLength = 0;

        if (isVarint) {
          const result = this._getVarInt(data, i);

          stringLength = result.value;

          i += result.bytesRead;
        } else {
          stringLength = this._getUnsignedShort(data[i++], data[i++], littleEndian);
        }

        const view = new DataView(data.buffer);
        let str: string | undefined;

        if (stringsAreASCII) {
          str = Utilities.readStringASCIIBuffer(data, i, stringLength);
        } else {
          str = Utilities.getString(view, i, stringLength, "UTF8");
        }

        if (str === undefined) {
          throw new Error("Unexpectedly could not read a string.");
        }

        activeTag.value = str;
        i += stringLength;
        Log.assert(i <= data.length, "NBTFB");

        /*
                let valueString = "";

                for (let j=0; j<stringLength; j++)
                {
                    valueString += String.fromCharCode(data[i++]);
                }

                activeTag.value = valueString;*/
      } else {
        Log.unexpectedError("Unsupported NBT tag type '" + activeTag.type + "'");
      }
    }

    let bytesRead = i;
    if (skipBytes !== undefined) {
      bytesRead -= skipBytes;
    }

    return bytesRead;
  }
}
