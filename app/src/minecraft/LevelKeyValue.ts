// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import Utilities from "../core/Utilities";
import Varint from "./Varint";

export default class LevelKeyValue {
  fileBytes: Uint8Array | undefined;
  startIndex: number | undefined;

  unsharedKeyBytes: Uint8Array | undefined;
  keyDelta: string | undefined;
  value: Uint8Array | undefined;
  sharedKey: string | undefined;
  sharedByteLength: number | undefined;
  length: number | undefined;
  previousKey: LevelKeyValue | undefined;
  keyCached: string | undefined;
  fullBytesCached: Uint8Array | undefined;

  public get unsharedKey(): string | undefined {
    if (this.unsharedKeyBytes === undefined) {
      return undefined;
    }

    const dv = new DataView(
      this.unsharedKeyBytes.buffer,
      this.unsharedKeyBytes.byteOffset,
      this.unsharedKeyBytes.byteLength
    );

    return Utilities.getAsciiString(dv, 0, dv.byteLength);
  }

  public get key(): string {
    if (this.keyCached) {
      return this.keyCached;
    }

    const previous = this.previousKey;
    let key = "";

    if (previous !== undefined) {
      key = previous.key.substring(0, this.sharedByteLength);
    }

    const ukey = this.unsharedKey;

    if (ukey !== undefined) {
      key += ukey;
    }

    this.keyCached = key;

    return key;
  }

  public get keyBytes(): Uint8Array | undefined {
    if (!this.unsharedKeyBytes) {
      return undefined;
    }

    if (this.fullBytesCached) {
      return this.fullBytesCached;
    }

    if (this.sharedByteLength === undefined || this.sharedByteLength === 0) {
      return this.unsharedKeyBytes;
    }

    if (this.previousKey === undefined) {
      throw new Error("Unexpected shared key without a previous");
    }

    const previousBytes = this.previousKey.keyBytes;

    if (previousBytes === undefined) {
      throw new Error("Unexpected shared key without previous bytes");
    }

    const bytes = new Uint8Array(this.sharedByteLength + this.unsharedKeyBytes.length);
    const i = this.sharedByteLength;

    for (let j = 0; j < i; j++) {
      bytes[j] = previousBytes[j];
    }

    for (let j = 0; j < this.unsharedKeyBytes.length; j++) {
      bytes[j + i] = this.unsharedKeyBytes[j];
    }

    this.fullBytesCached = bytes;

    return bytes;
  }

  public get isRestart() {
    return this.sharedByteLength === 0;
  }

  /**
   * Clears the value data to free up memory. Call this after the value has been
   * processed and is no longer needed. The key information is preserved.
   */
  public clearValueData() {
    this.value = undefined;
    this.fileBytes = undefined;
  }

  /**
   * Clears all data including key bytes to maximize memory savings.
   * Only call this when the LevelKeyValue is no longer needed.
   */
  public clearAllData() {
    this.value = undefined;
    this.fileBytes = undefined;
    this.unsharedKeyBytes = undefined;
    this.fullBytesCached = undefined;
    this.previousKey = undefined;
  }

  public loadFromLdb(incomingBytes: Uint8Array, startingIndex: number, prevKey: LevelKeyValue | undefined) {
    this.fileBytes = incomingBytes;
    this.startIndex = startingIndex;

    let i = 0;

    const sharedBytes = new Varint(this.fileBytes, this.startIndex);
    this.sharedByteLength = sharedBytes.value;
    i += sharedBytes.byteLength;

    if (this.sharedByteLength > 0) {
      this.previousKey = prevKey;
    }

    const unsharedBytes = new Varint(this.fileBytes, this.startIndex + i);
    i += unsharedBytes.byteLength;

    const valueLength = new Varint(this.fileBytes, this.startIndex + i);
    i += valueLength.byteLength;

    // mystery: why is unsharedKeyBytes 8 bytes longer than what we are expecting for keys?
    this.unsharedKeyBytes = incomingBytes.subarray(startingIndex + i, startingIndex + i + unsharedBytes.value - 8);

    /*const extraBytes = incomingBytes.subarray(
      startingIndex + i + unsharedBytes.value - 8,
      startingIndex + i + unsharedBytes.value
    ); */

    i += unsharedBytes.value;

    this.value = incomingBytes.subarray(startingIndex + i, startingIndex + i + valueLength.value);
    i += valueLength.value;

    /*    this.restarts = [];

    for (let j = 0; j < restartsToRead; j++) {
      const offset = startingIndex + i + j * 4;
      this.restarts.push(
        DataUtilities.getUnsignedInteger(
          incomingBytes[offset],
          incomingBytes[offset + 1],
          incomingBytes[offset + 2],
          incomingBytes[offset + 3],
          true
        )
      );
    }
    const offset = startingIndex + i + restartsToRead * 4;

    const numRestarts = DataUtilities.getUnsignedInteger(
      incomingBytes[offset],
      incomingBytes[offset + 1],
      incomingBytes[offset + 2],
      incomingBytes[offset + 3],
      false
    );

    if (numRestarts != restartsToRead) {
      throw new Error("Unexpected restart mismatch");
    }*/

    this.length = i;
  }
}
