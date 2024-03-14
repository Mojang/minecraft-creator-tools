// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export default class Varint {
  fileBytes: Uint8Array;
  startIndex: number;
  byteLength: number = 0;
  value: number = 0;

  public constructor(incomingBytes: Uint8Array, startingIndex: number) {
    this.fileBytes = incomingBytes;
    this.startIndex = startingIndex;

    let i = 0;

    while (this.fileBytes[this.startIndex + i] >= 128 && this.startIndex + i < incomingBytes.length) {
      i++;
    }

    this.byteLength = i + 1;

    this.value = this.fileBytes[this.startIndex + i];

    while (i > 0) {
      this.value *= 128;
      this.value += this.fileBytes[this.startIndex + i - 1] - 128;
      i--;
    }
  }
}
