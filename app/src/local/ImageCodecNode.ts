// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * ImageCodecNode - Node.js-specific image encoding/decoding utilities
 *
 * ARCHITECTURE NOTES:
 * ------------------
 * This module provides Node.js-specific image handling using:
 * - pngjs: Synchronous PNG encoding/decoding
 * - zlib: PNG compression
 * - Buffer: Binary data handling
 *
 * This is separated from ImageCodec.ts to:
 * 1. Allow webpack to tree-shake Node.js-only code from browser bundles
 * 2. Avoid problematic eval('require') patterns
 * 3. Provide a clean API for Node.js consumers
 *
 * USAGE:
 * ------
 * This module is imported by ImageCodec.ts when running in Node.js.
 * Direct usage is also possible in Node.js-only code:
 *
 * ```typescript
 * import ImageCodecNode from "./ImageCodecNode";
 * const png = ImageCodecNode.decodePng(data);
 * ```
 *
 * IMPORTANT:
 * ----------
 * This file should ONLY be imported in Node.js contexts. Importing it in
 * browser code will cause bundling errors. Use ImageCodec.ts which
 * handles environment detection automatically.
 */

import { PNG } from "pngjs";
import * as zlib from "zlib";
import Log from "../core/Log";
import { IDecodedImage } from "../core/ImageCodec";

/**
 * Node.js-specific image codec implementation.
 * Uses native Node.js modules (pngjs, zlib) for optimal performance.
 */
export default class ImageCodecNode {
  // Cached CRC32 table for PNG encoding
  private static _crc32Table: Uint32Array | undefined;

  // ============================================================================
  // PNG DECODING (Node.js)
  // ============================================================================

  /**
   * Decode PNG image data to RGBA pixels using pngjs.
   * This is synchronous and only works in Node.js.
   *
   * @param data Raw PNG file bytes
   * @returns Decoded image, or undefined if decoding fails
   */
  static decodePng(data: Uint8Array): IDecodedImage | undefined {
    try {
      const png = PNG.sync.read(Buffer.from(data));
      return {
        width: png.width,
        height: png.height,
        pixels: new Uint8Array(png.data),
      };
    } catch (e) {
      Log.debug(`PNG decode (Node) failed: ${e}`);
      return undefined;
    }
  }

  /**
   * Decode PNG image data asynchronously.
   * Wraps the synchronous decoder in a Promise for API consistency.
   *
   * @param data Raw PNG file bytes
   * @returns Promise resolving to decoded image, or undefined if decoding fails
   */
  static async decodePngAsync(data: Uint8Array): Promise<IDecodedImage | undefined> {
    return this.decodePng(data);
  }

  // ============================================================================
  // PNG ENCODING (Node.js)
  // ============================================================================

  /**
   * Encode RGBA pixel data to PNG format using pngjs.
   *
   * @param pixels RGBA pixel data (4 bytes per pixel)
   * @param width Image width
   * @param height Image height
   * @returns PNG file bytes, or undefined if encoding fails
   */
  static encodeToPng(pixels: Uint8Array, width: number, height: number): Uint8Array | undefined {
    try {
      const png = new PNG({ width, height });
      png.data = Buffer.from(pixels);
      const buffer = PNG.sync.write(png);
      return new Uint8Array(buffer);
    } catch (e) {
      Log.debug(`PNG encode (pngjs) failed: ${e}`);
      // Fall back to manual encoding
      return this.encodeToPngManual(pixels, width, height);
    }
  }

  /**
   * Encode RGBA pixel data to PNG format using manual chunk creation.
   * Used as fallback if pngjs encoding fails.
   *
   * @param pixels RGBA pixel data (4 bytes per pixel)
   * @param width Image width
   * @param height Image height
   * @returns PNG file bytes, or undefined if encoding fails
   */
  static encodeToPngManual(pixels: Uint8Array, width: number, height: number): Uint8Array | undefined {
    try {
      // PNG signature
      const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

      // IHDR chunk
      const ihdr = new Uint8Array(13);
      const ihdrView = new DataView(ihdr.buffer);
      ihdrView.setUint32(0, width, false);
      ihdrView.setUint32(4, height, false);
      ihdr[8] = 8; // bit depth
      ihdr[9] = 6; // color type (RGBA)
      ihdr[10] = 0; // compression
      ihdr[11] = 0; // filter
      ihdr[12] = 0; // interlace

      const ihdrChunk = this.createPngChunk("IHDR", ihdr);

      // IDAT chunk - raw pixel data with filter bytes
      const rawData = new Uint8Array(height * (1 + width * 4));
      for (let y = 0; y < height; y++) {
        rawData[y * (1 + width * 4)] = 0; // filter byte (none)
        for (let x = 0; x < width; x++) {
          const srcIdx = (y * width + x) * 4;
          const dstIdx = y * (1 + width * 4) + 1 + x * 4;
          rawData[dstIdx] = pixels[srcIdx]; // R
          rawData[dstIdx + 1] = pixels[srcIdx + 1]; // G
          rawData[dstIdx + 2] = pixels[srcIdx + 2]; // B
          rawData[dstIdx + 3] = pixels[srcIdx + 3]; // A
        }
      }

      const compressed = zlib.deflateSync(rawData, { level: 6 });
      const idatChunk = this.createPngChunk("IDAT", new Uint8Array(compressed));

      // IEND chunk
      const iendChunk = this.createPngChunk("IEND", new Uint8Array(0));

      // Combine all chunks
      const totalLength = signature.length + ihdrChunk.length + idatChunk.length + iendChunk.length;
      const png = new Uint8Array(totalLength);
      let offset = 0;
      png.set(signature, offset);
      offset += signature.length;
      png.set(ihdrChunk, offset);
      offset += ihdrChunk.length;
      png.set(idatChunk, offset);
      offset += idatChunk.length;
      png.set(iendChunk, offset);

      return png;
    } catch (e) {
      Log.debug(`PNG manual encoding failed: ${e}`);
      return undefined;
    }
  }

  /**
   * Encode RGBA pixel data to PNG format asynchronously.
   * Wraps the synchronous encoder in a Promise for API consistency.
   *
   * @param pixels RGBA pixel data (4 bytes per pixel)
   * @param width Image width
   * @param height Image height
   * @returns Promise resolving to PNG file bytes
   */
  static async encodeToPngAsync(pixels: Uint8Array, width: number, height: number): Promise<Uint8Array | undefined> {
    return this.encodeToPng(pixels, width, height);
  }

  // ============================================================================
  // PNG CHUNK UTILITIES
  // ============================================================================

  /**
   * Create a PNG chunk with type, data, and CRC.
   */
  private static createPngChunk(type: string, data: Uint8Array): Uint8Array {
    const length = data.length;
    const chunk = new Uint8Array(4 + 4 + length + 4);
    const view = new DataView(chunk.buffer);

    // Length
    view.setUint32(0, length, false);

    // Type
    for (let i = 0; i < 4; i++) {
      chunk[4 + i] = type.charCodeAt(i);
    }

    // Data
    chunk.set(data, 8);

    // CRC32 of type + data
    const crc = this.crc32(chunk.subarray(4, 8 + length));
    view.setUint32(8 + length, crc, false);

    return chunk;
  }

  /**
   * Calculate CRC32 checksum for PNG chunk validation.
   */
  private static crc32(data: Uint8Array): number {
    let crc = 0xffffffff;
    const table = this.getCrc32Table();

    for (let i = 0; i < data.length; i++) {
      crc = table[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
    }

    return (crc ^ 0xffffffff) >>> 0;
  }

  /**
   * Get the CRC32 lookup table (lazy initialized).
   */
  private static getCrc32Table(): Uint32Array {
    if (this._crc32Table) {
      return this._crc32Table;
    }

    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      table[i] = c;
    }

    this._crc32Table = table;
    return table;
  }

  // ============================================================================
  // DATA URL CONVERSION
  // ============================================================================

  /**
   * Convert raw image bytes to a data URL using Node.js Buffer.
   *
   * @param data Image file bytes (PNG, JPEG, etc.)
   * @param mimeType MIME type (e.g., "image/png")
   * @returns Data URL string
   */
  static toDataUrl(data: Uint8Array, mimeType: string): string {
    return `data:${mimeType};base64,${Buffer.from(data).toString("base64")}`;
  }
}
