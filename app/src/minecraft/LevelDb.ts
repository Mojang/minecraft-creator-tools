import IFile from "../storage/IFile";
import * as pako from "pako";
import Log from "../core/Log";
import LevelKeyValue from "./LevelKeyValue";
import Varint from "./Varint";
import DataUtilities from "../core/DataUtilities";
import Utilities from "../core/Utilities";

export default class LevelDb {
  ldbFiles: IFile[];
  logFiles: IFile[];
  keys: { [id: string]: LevelKeyValue | undefined };
  context?: string;

  public constructor(ldbFileArr: IFile[], logFileArr: IFile[], context?: string) {
    this.ldbFiles = ldbFileArr;
    this.logFiles = logFileArr;
    this.context = context;
    this.keys = {};
  }

  public async init(log?: (message: string) => Promise<void>) {
    this.keys = {};

    for (let i = 0; i < this.ldbFiles.length; i++) {
      await this.ldbFiles[i].loadContent(false);

      const content = this.ldbFiles[i].content;

      if (content instanceof Uint8Array && content.length > 0) {
        const kp = this.parseLdbContent(content);
        if (log) {
          await log("Loaded map record file '" + this.ldbFiles[i].fullPath + "'. Records: " + kp);
        }
      }
    }

    for (let i = 0; i < this.logFiles.length; i++) {
      await this.logFiles[i].loadContent(false);

      const content = this.logFiles[i].content;

      if (content instanceof Uint8Array && content.length > 0) {
        const kp = this.parseLogContent(content);
        if (log) {
          await log("Loaded map latest-updates file '" + this.logFiles[i].fullPath + "'. Records: " + kp);
        }
      }
    }
  }

  parseLdbContent(content: Uint8Array) {
    const magicA = content[content.length - 8];
    const magicB = content[content.length - 7];
    const magicC = content[content.length - 6];
    const magicD = content[content.length - 5];
    const magicE = content[content.length - 4];
    const magicF = content[content.length - 3];
    const magicG = content[content.length - 2];
    const magicH = content[content.length - 1];
    let keysParsed = 0;

    //  Ends with magic:            fixed64;     // == 0xdb4775248b80fb57 (little-endian)
    Log.assert(
      magicA === 87 &&
        magicB === 251 &&
        magicC === 128 &&
        magicE === 36 &&
        magicD === 139 &&
        magicF === 117 &&
        magicG === 71 &&
        magicH === 219,
      "Unexpected no-magic end to Level DB stream. DB file could be corrupt.",
      this.context
    );

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

    Log.assert(
      indexOffset.value > 0 && indexOffset.value + indexSize.value < content.length,
      "LDB content index offset not within bounds.",
      this.context
    );
    Log.assert(
      metaIndexOffset.value > 0 && metaIndexOffset.value + metaIndexSize.value < content.length,
      "LDB meta index offset not within bounds.",
      this.context
    );

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
        Log.fail("Error inflating index content: " + e + ". Further content may fail to load.", this.context);
      }
    }

    if (!indexContent) {
      indexContent = indexContentCompressed;
    }

    if (indexContent) {
      const indexKeys: { [id: string]: LevelKeyValue | undefined } = {};

      this.parseIndexBytes(indexContent, 0, indexContent.length, indexKeys);

      for (const lastKeyInBlock in indexKeys) {
        const indexKey = indexKeys[lastKeyInBlock];

        if (indexKey && indexKey.value) {
          const indexBytes = indexKey.value;
          let indexByteIndex = 0;

          const blockOffset = new Varint(indexBytes, indexByteIndex);
          indexByteIndex += blockOffset.byteLength;

          const blockSize = new Varint(indexBytes, indexByteIndex);
          indexByteIndex += blockSize.byteLength;

          Log.assert(blockOffset.value >= 0 && blockOffset.value + blockSize.value < content.length);
          Log.assert(indexByteIndex === indexBytes.length);

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

          keysParsed += this.parseLdbBlockBytes(blockContent, 0, blockContent.length);
        } else {
          Log.fail("Could not find index key.");
        }
      }
    }

    return keysParsed;
  }

  parseIndexBytes(
    data: Uint8Array,
    offset: number,
    length: number,
    indexKeys: { [id: string]: LevelKeyValue | undefined }
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

      indexKeys[key] = lb;

      if (lb.length === undefined) {
        throw new Error("Unexpected parse of level key value " + key);
      }

      index += lb.length;
    }
  }

  parseLdbBlockBytes(data: Uint8Array, offset: number, length: number) {
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
      Log.fail("Unexpected size received for LDB bytes: " + endRestartSize);
      return 0;
    }

    while (index < offset + length - endRestartSize) {
      const lb = new LevelKeyValue();

      lb.level = 1;
      lb.loadFromLdb(data, index, lastKeyValuePair);

      const key = lb.key;
      lastKeyValuePair = lb;

      // Log.assert(this.keys[key] === undefined, "Unexpectedly re-setting a key: " + key);
      this.keys[key] = lb;

      if (lb.length === undefined || lb.length < 0) {
        throw new Error("Unexpected parse of key " + key);
      }

      keysParsed++;
      index += lb.length;
    }

    return keysParsed;
  }

  parseLogContent(content: Uint8Array) {
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
        keysParsed += this.addValueFromLog(content, index, length);
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
            keysParsed += this.addValueFromLog(pendingBytes, 0, pendingBytes.length);
          }
        } else {
          Log.error("Unexpected middle to a set of bytes found within LevelDB content.");
          return;
        }
      }

      index += length;

      // new records don't start within 6 bytes of the end of a 32K block
      // Per docs: "A record never starts within the last six bytes of a [32K] block (since it won't fit). Any
      // leftover bytes here form the trailer, which must consist entirely of zero bytes and must be skipped by readers."
      let bytesFromEndOfBlock = 32768 - (index % 32768);

      while (bytesFromEndOfBlock <= 6 && bytesFromEndOfBlock > 0) {
        bytesFromEndOfBlock--;
        Log.assert(content[index] === 0, "Unexpectedly found a padding trailer with data");
        index++;
      }
    }

    Log.assert(keysParsed !== 0, "Did not parse any keys out of log content.");
    return keysParsed;
  }

  addValueFromLog(content: Uint8Array, index: number, length: number) {
    // first 8 bytes are sequence number; next 4 are record count; skip over those for now.
    index += 12;
    let keysParsed = 0;

    while (index <= length - 5) {
      const isLive = content[index];
      index++;

      const keyLength = new Varint(content, index);
      index += keyLength.byteLength;

      const keyBytes = new Uint8Array(keyLength.value);
      for (let i = 0; i < keyLength.value; i++) {
        keyBytes[i] = content[index + i];
      }

      index += keyLength.value;

      Log.assert(index <= content.length, "Unexpected log file length issue.");

      if (index <= content.length) {
        const key = Utilities.getAsciiStringFromUint8Array(keyBytes);

        if (key === undefined) {
          throw new Error("Unexpected null key.");
        }

        keysParsed++;

        if (isLive) {
          Log.assert(index < content.length, "Unexpectedly looking for content at the end of a log.");

          const dataLength = new Varint(content, index);
          index += dataLength.byteLength;

          if (dataLength.value + index <= content.buffer.byteLength) {
            const data = new Uint8Array(content.buffer, index, dataLength.value);
            index += dataLength.value;

            const kv = new LevelKeyValue();
            kv.level = 0;
            kv.sharedKey = "";
            kv.keyDelta = key;
            kv.unsharedKeyBytes = keyBytes;

            kv.value = data;

            this.keys[key] = kv;
          }
        } else {
          this.keys[key] = undefined;
        }
      }
    }
    return keysParsed;
  }
}
