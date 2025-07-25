// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export default class DataUtilities {
  static getUnsignedInteger(num1: number, num2: number, num3: number, num4: number, littleEndian: boolean): number {
    // Ensure inputs are valid bytes and convert to unsigned 32-bit result
    let result: number;
    if (littleEndian) {
      result = ((num4 & 0xff) << 24) | ((num3 & 0xff) << 16) | ((num2 & 0xff) << 8) | (num1 & 0xff);
    } else {
      result = ((num1 & 0xff) << 24) | ((num2 & 0xff) << 16) | ((num3 & 0xff) << 8) | (num4 & 0xff);
    }
    // Convert to unsigned 32-bit by using unsigned right shift
    return result >>> 0;
  }

  static writeUnsignedInteger(data: Uint8Array, index: number, value: number, littleEndian: boolean) {
    const view = new DataView(data.buffer, index, 4);

    view.setUint32(0, value, littleEndian);
  }

  static getFloat(num1: number, num2: number, num3: number, num4: number, littleEndian: boolean): number {
    // Get the 32-bit integer representation first
    let intValue: number;
    if (littleEndian) {
      intValue = ((num4 & 0xff) << 24) | ((num3 & 0xff) << 16) | ((num2 & 0xff) << 8) | (num1 & 0xff);
    } else {
      intValue = ((num1 & 0xff) << 24) | ((num2 & 0xff) << 16) | ((num3 & 0xff) << 8) | (num4 & 0xff);
    }

    // Use Float32Array to convert the bit pattern to float
    const floatArray = new Float32Array(1);
    const intArray = new Uint32Array(floatArray.buffer);
    intArray[0] = intValue >>> 0; // Ensure unsigned
    return floatArray[0];
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
  ): bigint {
    // For 64-bit values, we need to use BigInt to maintain precision
    // Convert each byte to BigInt and shift appropriately
    const bytes = [num1, num2, num3, num4, num5, num6, num7, num8];

    let result = 0n;
    if (littleEndian) {
      // Little endian: least significant byte first
      for (let i = 7; i >= 0; i--) {
        result = (result << 8n) | BigInt(bytes[i] & 0xff);
      }
    } else {
      // Big endian: most significant byte first
      for (let i = 0; i < 8; i++) {
        result = (result << 8n) | BigInt(bytes[i] & 0xff);
      }
    }

    // Convert to signed 64-bit value
    // If the sign bit is set, subtract 2^64
    if (result >= 0x8000000000000000n) {
      result = result - 0x10000000000000000n;
    }

    return result;
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

  static getSignedShort(num1: number, num2: number, littleEndian: boolean): number {
    // Get unsigned 16-bit value first
    let value: number;
    if (littleEndian) {
      value = ((num2 & 0xff) << 8) | (num1 & 0xff);
    } else {
      value = ((num1 & 0xff) << 8) | (num2 & 0xff);
    }

    // Convert to signed 16-bit value
    return value & 0x8000 ? value - 0x10000 : value;
  }

  static getUnsignedShort(num1: number, num2: number, littleEndian: boolean): number {
    // Direct bitwise operations for 16-bit unsigned value
    if (littleEndian) {
      return ((num2 & 0xff) << 8) | (num1 & 0xff);
    } else {
      return ((num1 & 0xff) << 8) | (num2 & 0xff);
    }
  }

  static getSignedInteger(num1: number, num2: number, num3: number, num4: number, littleEndian: boolean): number {
    // Get unsigned 32-bit value first
    let value: number;
    if (littleEndian) {
      value = ((num4 & 0xff) << 24) | ((num3 & 0xff) << 16) | ((num2 & 0xff) << 8) | (num1 & 0xff);
    } else {
      value = ((num1 & 0xff) << 24) | ((num2 & 0xff) << 16) | ((num3 & 0xff) << 8) | (num4 & 0xff);
    }

    // Convert to signed 32-bit value using JavaScript's signed right shift
    return value | 0;
  }

  static getSignedByte(value: number): number {
    // Convert to signed 8-bit value
    return value & 0x80 ? value - 0x100 : value;
  }

  static getSignedDouble(
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
}
