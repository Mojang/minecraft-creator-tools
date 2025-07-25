// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "../storage/IFile";
import * as pako from "pako";
import Log from "../core/Log";
import LevelKeyValue from "./LevelKeyValue";
import Varint from "./Varint";
import DataUtilities from "../core/DataUtilities";
import Utilities from "../core/Utilities";
import { IErrorMessage, IErrorable } from "../core/IErrorable";
import ILevelDbFileInfo from "./ILevelDbFileInfo";

export default class LevelDb implements IErrorable {
  ldbFiles: IFile[];
  logFiles: IFile[];
  manifestFiles: IFile[];
  keys: { [id: string]: LevelKeyValue | false | undefined };

  isInErrorState?: boolean;
  errorMessages?: IErrorMessage[];

  comparator?: string;
  logNumber?: number;
  previousLogNumber?: number;
  nextFileNumber?: number;
  lastSequence?: number;
  compactPointerLevels?: number[];
  compactPointerStrings?: string[];
  deletedFileLevel?: number[];
  deletedFileNumber?: number[];
  newFileLevel?: number[];
  newFileNumber?: number[];
  newFileSize?: number[];
  newFileSmallest?: string[];
  newFileLargest?: string[];

  context?: string;

  public constructor(ldbFileArr: IFile[], logFileArr: IFile[], manifestFilesArr: IFile[], context?: string) {
    this.ldbFiles = ldbFileArr;
    this.logFiles = logFileArr;
    this.manifestFiles = manifestFilesArr;
    this.context = context;
    this.keys = {};
  }

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

    return message;
  }

  public async init(log?: (message: string) => Promise<void>) {
    this.keys = {};
    this.isInErrorState = false;
    this.errorMessages = undefined;

    for (let i = 0; i < this.manifestFiles.length; i++) {
      await this.manifestFiles[i].loadContent(false);

      const content = this.manifestFiles[i].content;

      if (content instanceof Uint8Array && content.length > 0) {
        this.parseManifestContent(content, this.manifestFiles[i].storageRelativePath);
        if (log) {
          await log("Loaded map manifest file '" + this.manifestFiles[i].fullPath + "'.");
        }
      }
    }

    const ldbFileInfos: ILevelDbFileInfo[] = [];

    for (let i = 0; i < this.ldbFiles.length; i++) {
      const file = this.ldbFiles[i];

      try {
        const index = parseInt(file.name);

        //        if (true) {
        if (!this.deletedFileNumber || !this.deletedFileNumber.includes(index)) {
          let level = 0;

          if (this.newFileLevel && this.newFileNumber) {
            Log.assert(this.newFileLevel.length === this.newFileNumber.length);

            if (this.newFileLevel.length === this.newFileNumber.length) {
              for (let j = 0; j < this.newFileNumber.length; j++) {
                if (this.newFileNumber[j] === index) {
                  level = this.newFileLevel[j];
                }
              }
            }
          }

          ldbFileInfos.push({
            index: index,
            file: file,
            isDeleted: false,
            level: level,
          });
        }
      } catch (e: any) {
        this._pushError("Error including LDB file: " + file.fullPath + " Error: " + e.toString());
      }
    }

    const ldbFileInfoSorted = ldbFileInfos.sort((fileA: ILevelDbFileInfo, fileB: ILevelDbFileInfo) => {
      if (fileA.level === fileB.level) {
        return fileA.index - fileB.index;
      }

      return fileB.level - fileA.level;
    });

    for (let i = 0; i < ldbFileInfoSorted.length; i++) {
      const ldbFile = ldbFileInfoSorted[i].file;

      await ldbFile.loadContent(false);

      const content = ldbFile.content;

      if (content instanceof Uint8Array && content.length > 0) {
        const kp = this.parseLdbContent(content, ldbFile.storageRelativePath);
        if (log) {
          await log("Loaded map record file '" + ldbFile.fullPath + "'. Records: " + kp);
        }
      }
    }

    const logFilesSorted = this.logFiles.sort((fileA: IFile, fileB: IFile) => {
      return fileA.name.localeCompare(fileB.name);
    });

    for (let i = 0; i < logFilesSorted.length; i++) {
      await logFilesSorted[i].loadContent(false);

      const content = logFilesSorted[i].content;

      if (content instanceof Uint8Array && content.length > 0) {
        const kp = this.parseLogContent(content, logFilesSorted[i].storageRelativePath);
        if (log) {
          await log("Loaded map latest-updates file '" + logFilesSorted[i].fullPath + "'. Records: " + kp);
        }
      }
    }
  }

  parseLdbContent(content: Uint8Array, context?: string) {
    let keysParsed = 0;

    //  Ends with magic: fixed64;
    // == 0xdb4775248b80fb57 (little-endian)
    if (
      content.length <= 8 ||
      content[content.length - 8] !== 87 ||
      content[content.length - 7] !== 251 ||
      content[content.length - 6] !== 128 ||
      content[content.length - 5] !== 139 ||
      content[content.length - 4] !== 36 ||
      content[content.length - 3] !== 117 ||
      content[content.length - 2] !== 71 ||
      content[content.length - 1] !== 219
    ) {
      this._pushError("Unexpected bytes in LDB file. File seems unreadable.", context);
      return;
    }

    // https://github.com/google/leveldb/blob/main/doc/table_format.md

    let index = content.length - 48;

    const metaIndexOffset = new Varint(content, index);
    index += metaIndexOffset.byteLength;

    const metaIndexSize = new Varint(content, index);
    index += metaIndexSize.byteLength;

    const indexOffset = new Varint(content, index);
    index += indexOffset.byteLength;

    const indexSize = new Varint(content, index);
    index += indexSize.byteLength;

    if (indexOffset.value <= 0 || indexOffset.value + indexSize.value >= content.length) {
      this._pushError("LDB content index offset not within bounds.", context);
      return false;
    }

    if (metaIndexOffset.value <= 0 || metaIndexOffset.value + metaIndexSize.value >= content.length) {
      this._pushError("LDB meta index offset not within bounds.", context);
      return false;
    }

    const indexContentCompressed = content.subarray(indexOffset.value, indexOffset.value + indexSize.value);

    let indexContent = undefined;

    // I believe this logic replicates: https://twitter.com/_tomcc/status/894294552084860928
    try {
      indexContent = pako.inflate(indexContentCompressed, { raw: true });
    } catch (e) {
      //      Log.fail("Error inflating index compressed content: " + e);
    }

    if (!indexContent) {
      try {
        indexContent = pako.inflate(indexContentCompressed);
      } catch (e) {
        // Log.verbose("Error inflating index content: " + e + ". Further content may fail to load.", this.context);
      }
    }

    if (!indexContent) {
      indexContent = indexContentCompressed;

      // this._pushError("Treating level DB content as compressed.", context);
    }

    if (indexContent) {
      const indexKeys: { [id: string]: LevelKeyValue | undefined } = {};

      if (!this.parseIndexBytes(indexContent, 0, indexContent.length, indexKeys, context)) {
        return false;
      }

      for (const lastKeyInBlock in indexKeys) {
        const indexKey = indexKeys[lastKeyInBlock];

        if (indexKey && indexKey.value) {
          const indexBytes = indexKey.value;
          let indexByteIndex = 0;

          const blockOffset = new Varint(indexBytes, indexByteIndex);
          indexByteIndex += blockOffset.byteLength;

          const blockSize = new Varint(indexBytes, indexByteIndex);
          indexByteIndex += blockSize.byteLength;

          if (blockOffset.value < 0 || blockOffset.value + blockSize.value >= content.length) {
            this._pushError("Block offset does not appear correct", context);
            return;
          }

          if (indexByteIndex !== indexBytes.length) {
            this._pushError("Index byte index is not correct", context);
            return;
          }

          const blockContentCompressed = content.subarray(blockOffset.value, blockOffset.value + blockSize.value);

          let blockContent = undefined;

          try {
            blockContent = pako.inflate(blockContentCompressed, { raw: true });
          } catch (e) {}

          if (!blockContent) {
            try {
              blockContent = pako.inflate(blockContentCompressed);
            } catch (e) {
              // Apparently, some content is just not compressed, so failing to decompress is an acceptable state.
              // Log.fail("Error inflating block content: " + e);
            }
          }

          if (!blockContent) {
            blockContent = blockContentCompressed;
          }

          keysParsed += this.parseLdbBlockBytes(blockContent, 0, blockContent.length, context);
        } else {
          this._pushError("Could not find index key.", context);
        }
      }
    }

    if (keysParsed === 0) {
      this._pushError("No keys found in LDB.", context);
    }

    return keysParsed;
  }

  parseIndexBytes(
    data: Uint8Array,
    offset: number,
    length: number,
    indexKeys: { [id: string]: LevelKeyValue | undefined },
    context?: string
  ) {
    let index = offset;

    let lastKeyValuePair = undefined;

    const restarts = DataUtilities.getUnsignedInteger(
      data[length - 4],
      data[length - 3],
      data[length - 2],
      data[length - 1],
      true
    );

    const endRestartSize = restarts * 4 + 4;

    while (index < offset + length - endRestartSize) {
      const lb = new LevelKeyValue();

      lb.loadFromLdb(data, index, lastKeyValuePair);

      const key = lb.key;
      lastKeyValuePair = lb;

      if (Utilities.isUsableAsObjectKey(key)) {
        indexKeys[key] = lb;
      }

      if (lb.length === undefined) {
        this._pushError("Unexpected parse of level key value " + key, context);
        return false;
      }

      index += lb.length;
    }

    return true;
  }

  parseLdbBlockBytes(data: Uint8Array, offset: number, length: number, context?: string) {
    let index = offset;
    let keysParsed = 0;
    let lastKeyValuePair = undefined;

    const restarts = DataUtilities.getUnsignedInteger(
      data[length - 4],
      data[length - 3],
      data[length - 2],
      data[length - 1],
      true
    );

    const endRestartSize = restarts * 4 + 4;

    if (endRestartSize > offset + length) {
      this._pushError("Unexpected size received for LDB bytes. File could be corrupt.", context);
      return 0;
    }

    while (index < offset + length - endRestartSize) {
      const lb = new LevelKeyValue();

      lb.loadFromLdb(data, index, lastKeyValuePair);

      const key = lb.key;
      lastKeyValuePair = lb;

      if (Utilities.isUsableAsObjectKey(key)) {
        this.keys[key] = lb;
      }

      if (lb.length === undefined || lb.length < 0) {
        throw new Error(this._pushError("Unexpected parse of key " + key, context));
      }

      keysParsed++;
      index += lb.length;
    }

    return keysParsed;
  }

  parseLogContent(content: Uint8Array, context?: string) {
    let index = 0;
    let pendingBytes = undefined;
    let keysParsed = 0;

    // https://github.com/google/leveldb/blob/main/doc/log_format.md

    while (index < content.length - 6) {
      /*const checksum = DataUtilities.getUnsignedInteger(
        content[index],
        content[index + 1],
        content[index + 2],
        content[index + 3],
        true
      );*/

      const length = DataUtilities.getUnsignedShort(content[index + 4], content[index + 5], true);
      const type = content[index + 6];
      index += 7; // size of record header

      if (type === 1 /* Type 1 = FULL */) {
        keysParsed += this.addValueFromLog(content, index, length, context);
      } else if (type === 2 /* Type 2 = FIRST */) {
        pendingBytes = new Uint8Array(content.buffer, index, length);
      } else if (type === 3 /* Type 3 = MIDDLE */ || type === 4 /* Type 4 = LAST*/) {
        if (pendingBytes !== undefined) {
          const appendBytes = new Uint8Array(content.buffer, index, length);

          const newBytes: Uint8Array = new Uint8Array(pendingBytes.byteLength + appendBytes.byteLength);

          newBytes.set(pendingBytes);
          newBytes.set(appendBytes, pendingBytes.byteLength);

          pendingBytes = newBytes;

          if (type === 4 /* This is the last part of a record */) {
            keysParsed += this.addValueFromLog(pendingBytes, 0, pendingBytes.length, context);
          }
        } else {
          this._pushError(
            "Unexpected middle to a set of bytes found within LevelDB content. File seems unreadable.",
            context
          );
          return;
        }
      } else {
        this._pushError("Unexpected type for log file. File seems unreadable.", context);
        return;
      }

      index += length;

      // new records don't start within 6 bytes of the end of a 32K block
      // Per docs: "A record never starts within the last six bytes of a [32K] block (since it won't fit). Any
      // leftover bytes here form the trailer, which must consist entirely of zero bytes and must be skipped by readers."
      let bytesFromEndOfBlock = 32768 - (index % 32768);

      while (bytesFromEndOfBlock <= 6 && bytesFromEndOfBlock > 0) {
        bytesFromEndOfBlock--;
        if (content[index] !== 0) {
          this._pushError("Unexpectedly found a padding trailer with data", context);
        }

        index++;
      }
    }

    if (keysParsed <= 0) {
      this._pushError("Did not find any keys in log file", context);
    }

    return keysParsed;
  }

  addValueFromLog(content: Uint8Array, index: number, length: number, context?: string) {
    const startIndex = index;
    // first 8 bytes are sequence number; next 4 are record count; skip over those for now.
    index += 12;
    let keysParsed = 0;

    while (index <= startIndex + length - 5) {
      const isLive = content[index];
      index++;

      const keyLength = new Varint(content, index);
      index += keyLength.byteLength;

      const keyBytes = new Uint8Array(keyLength.value);
      for (let i = 0; i < keyLength.value; i++) {
        keyBytes[i] = content[index + i];
      }

      index += keyLength.value;

      if (index > content.length) {
        this._pushError("Unexpected log file length issue.", context);
      }

      if (index <= content.length) {
        const key = Utilities.getAsciiStringFromUint8Array(keyBytes);

        if (key === undefined) {
          this._pushError("Unexpected empty key in a log file. File could be unreadable.", context);
        }

        keysParsed++;

        if (isLive) {
          if (index >= content.length) {
            this._pushError("Unexpectedly leftover content in a log file. File could be unreadable.", context);
          }

          const dataLength = new Varint(content, index);
          index += dataLength.byteLength;

          if (dataLength.value + index <= content.buffer.byteLength) {
            const data = new Uint8Array(content.buffer, index, dataLength.value);
            index += dataLength.value;

            const kv = new LevelKeyValue();
            kv.sharedKey = "";
            kv.keyDelta = key;
            kv.unsharedKeyBytes = keyBytes;

            kv.value = data;

            if (Utilities.isUsableAsObjectKey(key)) {
              this.keys[key] = kv;
            }
          }
        } else {
          if (Utilities.isUsableAsObjectKey(key)) {
            this.keys[key] = false;
          }
        }
      }
    }
    return keysParsed;
  }

  parseManifestContent(content: Uint8Array, context?: string) {
    let index = 0;
    let pendingBytes = undefined;

    this.comparator = undefined;
    this.logNumber = undefined;
    this.nextFileNumber = undefined;
    this.lastSequence = undefined;
    this.compactPointerLevels = undefined;
    this.compactPointerStrings = undefined;
    this.deletedFileLevel = undefined;
    this.deletedFileNumber = undefined;
    this.newFileLevel = undefined;
    this.newFileNumber = undefined;
    this.newFileSize = undefined;
    this.newFileSmallest = undefined;
    this.newFileLargest = undefined;

    // https://github.com/google/leveldb/blob/main/doc/log_format.md

    while (index < content.length - 6) {
      /*const checksum = DataUtilities.getUnsignedInteger(
        content[index],
        content[index + 1],
        content[index + 2],
        content[index + 3],
        true
      );*/

      const length = DataUtilities.getUnsignedShort(content[index + 4], content[index + 5], true);
      const type = content[index + 6];
      index += 7; // size of record header

      if (type === 1 /* Type 1 = FULL */) {
        this.addValueFromManifest(content, index, length);
      } else if (type === 2 /* Type 2 = FIRST */) {
        pendingBytes = new Uint8Array(content.buffer, index, length);
      } else if (type === 3 /* Type 3 = MIDDLE */ || type === 4 /* Type 4 = LAST*/) {
        if (pendingBytes !== undefined) {
          const appendBytes = new Uint8Array(content.buffer, index, length);

          const newBytes: Uint8Array = new Uint8Array(pendingBytes.byteLength + appendBytes.byteLength);

          newBytes.set(pendingBytes);
          newBytes.set(appendBytes, pendingBytes.byteLength);

          pendingBytes = newBytes;

          if (type === 4 /* This is the last part of a record */) {
            this.addValueFromManifest(pendingBytes, 0, pendingBytes.length);
          }
        } else {
          this._pushError(
            "Unexpected middle to a set of bytes found within a manifest file. File could be unreadable.",
            context
          );
          return;
        }
      } else {
        this._pushError("Unexpected type for manifest file.  File could be unreadable.", context);
        return;
      }

      index += length;

      // new records don't start within 6 bytes of the end of a 32K block
      // Per docs: "A record never starts within the last six bytes of a [32K] block (since it won't fit). Any
      // leftover bytes here form the trailer, which must consist entirely of zero bytes and must be skipped by readers."
      let bytesFromEndOfBlock = 32768 - (index % 32768);

      while (bytesFromEndOfBlock <= 6 && bytesFromEndOfBlock > 0) {
        bytesFromEndOfBlock--;
        if (content[index] !== 0) {
          this._pushError("Unexpectedly found a padding trailer with data in a manifest file.", context);
        }
        index++;
      }
    }
  }

  addValueFromManifest(content: Uint8Array, index: number, length: number, context?: string) {
    const startIndex = index;

    // https://github.com/google/leveldb/blob/main/db/version_edit.cc
    while (index < startIndex + length) {
      const tag = new Varint(content, index);
      index += tag.byteLength;

      switch (tag.value) {
        case 1: // comparator
          const comparatorPrefixedSliceLength = new Varint(content, index);
          index += comparatorPrefixedSliceLength.byteLength;

          // comparator prefixed slice
          const comparatorBytes = new Uint8Array(comparatorPrefixedSliceLength.value);
          for (let i = 0; i < comparatorPrefixedSliceLength.value; i++) {
            comparatorBytes[i] = content[index + i];
          }

          index += comparatorPrefixedSliceLength.value;

          if (index > content.length) {
            this._pushError("Unexpected manifest file length issue.", context);
          }

          this.comparator = Utilities.getAsciiStringFromUint8Array(comparatorBytes);

          if (this.comparator === undefined) {
            this._pushError("Unexpected comparator.", context);
          }
          break;

        case 2: // logNumber
          const logNumberVarint = new Varint(content, index);
          index += logNumberVarint.byteLength;
          this.logNumber = logNumberVarint.value;
          break;

        case 3: // nextFileNumber
          const nextFileNumberVarint = new Varint(content, index);
          index += nextFileNumberVarint.byteLength;
          this.nextFileNumber = nextFileNumberVarint.value;
          break;

        case 4: // lastSequence
          const lastSequenceVarint = new Varint(content, index);
          index += lastSequenceVarint.byteLength;
          this.lastSequence = lastSequenceVarint.value;
          break;

        case 5: // compactPointer
          if (this.compactPointerLevels === undefined) {
            this.compactPointerLevels = [];
          }
          if (this.compactPointerStrings === undefined) {
            this.compactPointerStrings = [];
          }
          const compactPointerLevel = new Varint(content, index);
          index += compactPointerLevel.byteLength;
          this.compactPointerLevels.push(compactPointerLevel.value);

          const compactPointerStrLength = new Varint(content, index);
          index += compactPointerStrLength.byteLength;

          // comparator prefixed slice
          const compactPointerStrBytes = new Uint8Array(compactPointerStrLength.value);
          for (let i = 0; i < compactPointerStrLength.value; i++) {
            compactPointerStrBytes[i] = content[index + i];
          }

          index += compactPointerStrLength.value;

          if (index > content.length) {
            this._pushError("Unexpected manifest file length issue at compact pointer.", context);
          }

          this.compactPointerStrings.push(Utilities.getAsciiStringFromUint8Array(compactPointerStrBytes));

          if (this.compactPointerStrings[this.compactPointerStrings.length - 1] === undefined) {
            this._pushError("Unexpected compact pointer string.", context);
          }
          break;

        case 6: // deletedFile
          if (this.deletedFileLevel === undefined) {
            this.deletedFileLevel = [];
          }
          if (this.deletedFileNumber === undefined) {
            this.deletedFileNumber = [];
          }
          const deletedFileLevel = new Varint(content, index);
          index += deletedFileLevel.byteLength;
          this.deletedFileLevel.push(deletedFileLevel.value);

          const deletedFileNumber = new Varint(content, index);
          index += deletedFileNumber.byteLength;
          this.deletedFileNumber.push(deletedFileNumber.value);
          break;

        case 7: // newFile
          if (this.newFileLargest === undefined) {
            this.newFileLargest = [];
          }
          if (this.newFileLevel === undefined) {
            this.newFileLevel = [];
          }
          if (this.newFileNumber === undefined) {
            this.newFileNumber = [];
          }
          if (this.newFileSmallest === undefined) {
            this.newFileSmallest = [];
          }
          if (this.newFileSize === undefined) {
            this.newFileSize = [];
          }

          const newFileLevel = new Varint(content, index);
          index += newFileLevel.byteLength;
          this.newFileLevel.push(newFileLevel.value);

          const newFileNumber = new Varint(content, index);
          index += newFileNumber.byteLength;
          this.newFileNumber.push(newFileNumber.value);

          const newFileSize = new Varint(content, index);
          index += newFileSize.byteLength;
          this.newFileSize.push(newFileSize.value);

          const newFileSmallestStrLength = new Varint(content, index);
          index += newFileSmallestStrLength.byteLength;

          const newFileSmallestStrBytes = new Uint8Array(newFileSmallestStrLength.value);
          for (let i = 0; i < newFileSmallestStrLength.value; i++) {
            newFileSmallestStrBytes[i] = content[index + i];
          }

          index += newFileSmallestStrLength.value;

          if (index > content.length) {
            this._pushError("Unexpected manifest file length issue at new file smallest.", context);
          }

          this.newFileSmallest.push(Utilities.getAsciiStringFromUint8Array(newFileSmallestStrBytes));

          if (this.newFileSmallest[this.newFileSmallest.length - 1] === undefined) {
            this._pushError("Unexpected file smallest tag string.", context);
          }

          const newFileLargestStrLength = new Varint(content, index);
          index += newFileLargestStrLength.byteLength;

          const newFileLargestStrBytes = new Uint8Array(newFileLargestStrLength.value);
          for (let i = 0; i < newFileLargestStrLength.value; i++) {
            newFileLargestStrBytes[i] = content[index + i];
          }

          index += newFileLargestStrLength.value;

          if (index > content.length) {
            this._pushError("Unexpected manifest file length issue at new file largest.", context);
          }

          this.newFileLargest.push(Utilities.getAsciiStringFromUint8Array(newFileLargestStrBytes));

          if (this.newFileLargest[this.newFileLargest.length - 1] === undefined) {
            this._pushError("Unexpected file largest tag string.", context);
          }
          break;

        case 9: // previousLogNumber
          const prevLogNumber = new Varint(content, index);
          index += prevLogNumber.byteLength;
          this.previousLogNumber = prevLogNumber.value;
          break;

        default:
          this._pushError("Unexpected manifest item: " + tag.value, context);
      }
    }
  }
}
