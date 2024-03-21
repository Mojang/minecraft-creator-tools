// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export default class DataUtilities {
  static getUnsignedInteger(num1: number, num2: number, num3: number, num4: number, littleEndian: boolean) {
    const buffer = new ArrayBuffer(4);

    const bytes = new Uint8Array(buffer);

    bytes[0] = num1;
    bytes[1] = num2;
    bytes[2] = num3;
    bytes[3] = num4;

    const view = new DataView(buffer);

    return view.getUint32(0, littleEndian);
  }

  static writeUnsignedInteger(data: Uint8Array, index: number, value: number, littleEndian: boolean) {
    const view = new DataView(data.buffer, index, 4);

    view.setUint32(0, value, littleEndian);
  }

  static getSignedByte(num: number) {
    const buffer = new ArrayBuffer(1);
    const bytes = new Uint8Array(buffer);

    bytes[0] = num;

    const view = new DataView(buffer);

    return view.getInt8(0);
  }

  static getFloat(num1: number, num2: number, num3: number, num4: number, littleEndian: boolean) {
    const buffer = new ArrayBuffer(4);
    const bytes = new Uint8Array(buffer);

    bytes[0] = num1;
    bytes[1] = num2;
    bytes[2] = num3;
    bytes[3] = num4;

    const view = new DataView(buffer);

    return view.getFloat32(0, littleEndian);
  }

  static getSignedLong(
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

  static getVarInt(data: Uint8Array, index: number) {
    // most significant group first?
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

  static getSignedShort(num1: number, num2: number, littleEndian: boolean) {
    const buffer = new ArrayBuffer(2);

    const bytes = new Uint8Array(buffer);

    bytes[0] = num1;
    bytes[1] = num2;

    const view = new DataView(buffer);

    return view.getInt16(0, littleEndian);
  }

  static getUnsignedShort(num1: number, num2: number, littleEndian: boolean) {
    const buffer = new ArrayBuffer(2);

    const bytes = new Uint8Array(buffer);

    bytes[0] = num1;
    bytes[1] = num2;

    const view = new DataView(buffer);

    return view.getUint16(0, littleEndian);
  }

  static getSignedInteger(num1: number, num2: number, num3: number, num4: number, littleEndian: boolean) {
    const buffer = new ArrayBuffer(4);

    const bytes = new Uint8Array(buffer);

    bytes[0] = num1;
    bytes[1] = num2;
    bytes[2] = num3;
    bytes[3] = num4;

    const view = new DataView(buffer);

    return view.getInt32(0, littleEndian);
  }
}
