// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

// ============================================================================
// AMBIENT TYPE DECLARATIONS FOR BROWSER APIS
// ============================================================================
// These declarations allow TypeScript to understand browser APIs when compiling
// for non-DOM environments (VS Code extension, Node.js). The runtime code uses
// typeof checks to ensure these APIs are only called in browser contexts.

/* eslint-disable @typescript-eslint/no-explicit-any */
declare const createImageBitmap: ((blob: Blob) => Promise<ImageBitmap>) | undefined;
declare const document: { createElement(tagName: "canvas"): HTMLCanvasElement } | undefined;

interface ImageBitmap {
  readonly width: number;
  readonly height: number;
  close(): void;
}

interface ImageData {
  readonly data: Uint8ClampedArray;
  readonly width: number;
  readonly height: number;
}

interface CanvasRenderingContext2D {
  drawImage(image: ImageBitmap, dx: number, dy: number): void;
  getImageData(sx: number, sy: number, sw: number, sh: number): ImageData;
  createImageData(sw: number, sh: number): ImageData;
  putImageData(imageData: ImageData, dx: number, dy: number): void;
}

interface HTMLCanvasElement {
  width: number;
  height: number;
  getContext(contextId: "2d"): CanvasRenderingContext2D | null;
  toBlob(callback: (blob: Blob | null) => void, type?: string, quality?: number): void;
}

interface OffscreenCanvasRenderingContext2D {
  drawImage(image: ImageBitmap, dx: number, dy: number): void;
  getImageData(sx: number, sy: number, sw: number, sh: number): ImageData;
  createImageData(sw: number, sh: number): ImageData;
  putImageData(imageData: ImageData, dx: number, dy: number): void;
}

declare class OffscreenCanvas {
  constructor(width: number, height: number);
  width: number;
  height: number;
  getContext(contextId: "2d"): OffscreenCanvasRenderingContext2D | null;
  convertToBlob(options?: { type?: string; quality?: number }): Promise<Blob>;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * ImageCodec - Unified cross-platform image encoding/decoding utilities
 *
 * ARCHITECTURE NOTES:
 * ------------------
 * This module consolidates all image encoding/decoding logic that was previously
 * scattered across multiple files:
 *
 * - TGA decoding: Previously in TextureDefinition, Model2DRenderer, project.worker,
 *   ImageManager, ModelMeshFactory
 * - PNG decoding: Previously in Model2DRenderer, TextureDefinition, project.worker
 * - PNG encoding: Previously in ImageGenerationUtilities
 *
 * PLATFORM SUPPORT:
 * -----------------
 * This module supports three environments:
 *
 * 1. **Node.js** (CLI, server, VS Code extension host):
 *    - Uses pngjs for fast synchronous PNG encoding/decoding
 *    - Uses zlib for compression
 *    - Uses Buffer for binary data
 *    - Import: `import ImageCodec from "../core/ImageCodec"`
 *
 * 2. **Browser main thread** (web app, Electron renderer):
 *    - Uses Canvas/HTMLImageElement for PNG decoding
 *    - Uses createImageBitmap + canvas.toDataURL for encoding
 *    - Falls back to Pako for zlib if available
 *
 * 3. **Web Worker** (project.worker.ts):
 *    - Uses OffscreenCanvas + createImageBitmap
 *    - No DOM access
 *
 * ENVIRONMENT DETECTION:
 * ----------------------
 * The module auto-detects the environment using:
 * - `typeof Buffer !== "undefined"` for Node.js
 * - `typeof createImageBitmap !== "undefined"` for browser/worker
 * - `typeof OffscreenCanvas !== "undefined"` for web worker
 * - `typeof document !== "undefined"` for browser main thread
 *
 * For explicit control, use CreatorToolsHost.isNodeJs.
 *
 * USAGE:
 * ------
 * ```typescript
 * import ImageCodec, { IDecodedImage } from "../core/ImageCodec";
 *
 * // Decode any image type (auto-detects format)
 * const decoded = await ImageCodec.decodeAuto(data);
 *
 * // Decode specific format
 * const png = await ImageCodec.decodePng(data);
 * const tga = await ImageCodec.decodeTga(data);
 *
 * // Encode to PNG
 * const pngBytes = await ImageCodec.encodeToPng(pixels, width, height);
 *
 * // Convert TGA to PNG
 * const pngBytes = await ImageCodec.tgaToPng(tgaData);
 *
 * // Check format
 * if (ImageCodec.isTgaData(data)) { ... }
 *
 * // Get data URL
 * const dataUrl = ImageCodec.toDataUrl(pngBytes, "image/png");
 * ```
 *
 * NODE.JS ONLY USAGE:
 * -------------------
 * For Node.js-only code (tests, CLI), you can import ImageCodecNode directly
 * for synchronous operations:
 *
 * ```typescript
 * import ImageCodecNode from "../local/ImageCodecNode";
 * const decoded = ImageCodecNode.decodePng(data); // synchronous
 * ```
 *
 * Related files:
 * - ImageCodecNode.ts - Node.js-specific implementation (pngjs, zlib)
 * - ImageGenerationUtilities.ts - Higher-level image generation (SVG→PNG, atlas)
 * - TextureDefinition.ts - Minecraft texture file wrapper
 * - Model2DRenderer.ts - 2D model rendering
 * - ModelMeshFactory.ts - 3D mesh creation
 */

import Log from "./Log";
import Utilities from "./Utilities";
import { decodeTga as decodeTgaCodec } from "@lunapaint/tga-codec";
import CreatorToolsHost from "../app/CreatorToolsHost";

/**
 * Decoded image pixel data.
 * All decoders return this common format.
 */
export interface IDecodedImage {
  /** Image width in pixels */
  width: number;
  /** Image height in pixels */
  height: number;
  /** RGBA pixel data (4 bytes per pixel: R, G, B, A) */
  pixels: Uint8Array;
}

/**
 * Supported image formats for decoding
 */
export type ImageFormat = "png" | "tga" | "jpg" | "jpeg";

/**
 * Check if we're in a browser environment with canvas support.
 */
function isBrowserEnvironment(): boolean {
  return typeof createImageBitmap !== "undefined" || typeof document !== "undefined";
}

/**
 * Check if we're in a web worker (OffscreenCanvas available, no document).
 */
function isWebWorkerEnvironment(): boolean {
  return typeof OffscreenCanvas !== "undefined" && typeof document === "undefined";
}

/**
 * Unified image encoding/decoding utilities.
 *
 * This is the main entry point for all image operations.
 * It automatically selects the best implementation for the current environment.
 */
export default class ImageCodec {
  // Cached CRC32 table for PNG encoding (browser fallback)
  private static _crc32Table: Uint32Array | undefined;

  // ============================================================================
  // TGA DECODING
  // ============================================================================

  /**
   * Decode TGA image data to RGBA pixels.
   * Works in all environments (Node.js, browser, web worker).
   *
   * Uses @lunapaint/tga-codec which handles:
   * - Uncompressed true-color (type 2)
   * - Uncompressed grayscale (type 3)
   * - RLE compressed (types 9, 10, 11)
   * - Various bit depths (8, 16, 24, 32)
   *
   * @param data Raw TGA file bytes
   * @returns Decoded image with RGBA pixels, or undefined if decoding fails
   */
  static async decodeTga(data: Uint8Array): Promise<IDecodedImage | undefined> {
    try {
      // Use the statically imported decodeTga function
      // This ensures the codec is bundled and works in web workers
      const decoded = await decodeTgaCodec(data);
      return {
        width: decoded.image.width,
        height: decoded.image.height,
        pixels: new Uint8Array(decoded.image.data),
      };
    } catch (e) {
      Log.debug(`TGA decode failed: ${e}`);
      return undefined;
    }
  }

  // ============================================================================
  // PNG DECODING
  // ============================================================================

  /**
   * Decode PNG image data to RGBA pixels.
   * Automatically uses the best decoder for the current environment.
   *
   * - Node.js: Uses pngjs (synchronous, fast)
   * - Browser: Uses createImageBitmap + Canvas (async)
   * - Web Worker: Uses createImageBitmap + OffscreenCanvas (async)
   *
   * @param data Raw PNG file bytes
   * @returns Decoded image with RGBA pixels, or undefined if decoding fails
   */
  static async decodePng(data: Uint8Array): Promise<IDecodedImage | undefined> {
    // Try Node.js decoder first via platform thunk (faster, synchronous)
    if (CreatorToolsHost.decodePng) {
      try {
        const result = CreatorToolsHost.decodePng(data);
        if (result) return result;
      } catch (e) {
        Log.debug(`Node PNG decode failed, falling back to browser: ${e}`);
      }
    }

    // Fall back to browser decoder
    return this.decodePngBrowser(data);
  }

  /**
   * Decode PNG using browser APIs (createImageBitmap + Canvas).
   * Works in browser main thread and web workers.
   *
   * @param data Raw PNG file bytes
   * @returns Decoded image, or undefined if not in browser or decoding fails
   */
  static async decodePngBrowser(data: Uint8Array): Promise<IDecodedImage | undefined> {
    if (typeof createImageBitmap === "undefined") {
      return undefined;
    }

    try {
      const blob = new Blob([data], { type: "image/png" });
      const imageBitmap = await createImageBitmap(blob);

      let canvas: OffscreenCanvas | HTMLCanvasElement;
      let ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null;

      if (isWebWorkerEnvironment()) {
        canvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
        ctx = canvas.getContext("2d") as OffscreenCanvasRenderingContext2D | null;
      } else if (typeof document !== "undefined") {
        canvas = document.createElement("canvas");
        canvas.width = imageBitmap.width;
        canvas.height = imageBitmap.height;
        ctx = canvas.getContext("2d");
      } else {
        return undefined;
      }

      if (!ctx) return undefined;

      ctx.drawImage(imageBitmap, 0, 0);
      const imageData = ctx.getImageData(0, 0, imageBitmap.width, imageBitmap.height);

      return {
        width: imageBitmap.width,
        height: imageBitmap.height,
        pixels: new Uint8Array(imageData.data),
      };
    } catch (e) {
      Log.debug(`Browser PNG decode failed: ${e}`);
      return undefined;
    }
  }

  // ============================================================================
  // JPEG DECODING
  // ============================================================================

  /**
   * Decode JPEG image data to RGBA pixels.
   * Only works in browser environments (uses createImageBitmap).
   *
   * @param data Raw JPEG file bytes
   * @returns Decoded image with RGBA pixels, or undefined if decoding fails
   */
  static async decodeJpeg(data: Uint8Array): Promise<IDecodedImage | undefined> {
    if (!isBrowserEnvironment()) {
      Log.debug("JPEG decoding requires browser environment");
      return undefined;
    }

    try {
      const blob = new Blob([data], { type: "image/jpeg" });
      if (typeof createImageBitmap === "undefined") {
        return undefined;
      }
      const imageBitmap = await createImageBitmap(blob);

      let canvas: OffscreenCanvas | HTMLCanvasElement;
      let ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null;

      if (isWebWorkerEnvironment()) {
        canvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
        ctx = canvas.getContext("2d") as OffscreenCanvasRenderingContext2D | null;
      } else if (typeof document !== "undefined") {
        canvas = document.createElement("canvas");
        canvas.width = imageBitmap.width;
        canvas.height = imageBitmap.height;
        ctx = canvas.getContext("2d");
      } else {
        return undefined;
      }

      if (!ctx) return undefined;

      ctx.drawImage(imageBitmap, 0, 0);
      const imageData = ctx.getImageData(0, 0, imageBitmap.width, imageBitmap.height);

      return {
        width: imageBitmap.width,
        height: imageBitmap.height,
        pixels: new Uint8Array(imageData.data),
      };
    } catch (e) {
      Log.debug(`JPEG decode failed: ${e}`);
      return undefined;
    }
  }

  // ============================================================================
  // UNIFIED DECODING
  // ============================================================================

  /**
   * Decode image data to RGBA pixels based on specified format.
   *
   * @param data Raw image file bytes
   * @param format File format ("png", "tga", "jpg", "jpeg")
   * @returns Decoded image, or undefined if decoding fails
   */
  static async decode(data: Uint8Array, format: ImageFormat | string): Promise<IDecodedImage | undefined> {
    const normalizedFormat = format.toLowerCase().replace(".", "") as ImageFormat;

    switch (normalizedFormat) {
      case "tga":
        return this.decodeTga(data);
      case "png":
        return this.decodePng(data);
      case "jpg":
      case "jpeg":
        return this.decodeJpeg(data);
      default:
        Log.debug(`Unsupported image format: ${format}`);
        return undefined;
    }
  }

  /**
   * Decode image data, auto-detecting format from file header.
   *
   * @param data Raw image file bytes
   * @returns Decoded image, or undefined if format unknown or decoding fails
   */
  static async decodeAuto(data: Uint8Array): Promise<IDecodedImage | undefined> {
    const format = this.detectFormat(data);
    if (!format) {
      Log.debug("Could not detect image format from file header");
      return undefined;
    }
    return this.decode(data, format);
  }

  // ============================================================================
  // PNG ENCODING
  // ============================================================================

  /**
   * Encode RGBA pixel data to PNG format.
   * Automatically uses the best encoder for the current environment.
   *
   * - Node.js: Uses pngjs (synchronous, optimized)
   * - Browser: Uses canvas.toBlob (async)
   *
   * @param pixels RGBA pixel data (4 bytes per pixel)
   * @param width Image width in pixels
   * @param height Image height in pixels
   * @returns PNG file bytes, or undefined if encoding fails
   */
  static async encodeToPng(pixels: Uint8Array, width: number, height: number): Promise<Uint8Array | undefined> {
    // Try Node.js encoder first via platform thunk
    if (CreatorToolsHost.encodeToPng) {
      try {
        const result = CreatorToolsHost.encodeToPng(pixels, width, height);
        if (result) return result;
      } catch (e) {
        Log.debug(`Node PNG encode failed, falling back to browser: ${e}`);
      }
    }

    // Fall back to browser encoder
    return this.encodeToPngBrowser(pixels, width, height);
  }

  /**
   * Synchronous PNG encoding (Node.js only).
   * Use this when you need synchronous behavior and know you're in Node.js.
   *
   * @param pixels RGBA pixel data (4 bytes per pixel)
   * @param width Image width in pixels
   * @param height Image height in pixels
   * @returns PNG file bytes, or undefined if not in Node.js or encoding fails
   */
  static encodeToPngSync(pixels: Uint8Array, width: number, height: number): Uint8Array | undefined {
    // Use platform thunk if available (Node.js environments)
    if (CreatorToolsHost.encodeToPng) {
      try {
        return CreatorToolsHost.encodeToPng(pixels, width, height);
      } catch (e) {
        Log.debug(`Sync PNG encode failed: ${e}`);
        return undefined;
      }
    }

    // Not available in browser environments
    return undefined;
  }

  /**
   * Encode RGBA pixels to PNG using browser Canvas API.
   *
   * @param pixels RGBA pixel data (4 bytes per pixel)
   * @param width Image width in pixels
   * @param height Image height in pixels
   * @returns PNG file bytes, or undefined if not in browser or encoding fails
   */
  static async encodeToPngBrowser(pixels: Uint8Array, width: number, height: number): Promise<Uint8Array | undefined> {
    try {
      let offscreenCanvas: OffscreenCanvas | undefined;
      let htmlCanvas: HTMLCanvasElement | undefined;
      let ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null;

      if (isWebWorkerEnvironment()) {
        offscreenCanvas = new OffscreenCanvas(width, height);
        ctx = offscreenCanvas.getContext("2d") as OffscreenCanvasRenderingContext2D | null;
      } else if (typeof document !== "undefined") {
        htmlCanvas = document.createElement("canvas");
        htmlCanvas.width = width;
        htmlCanvas.height = height;
        ctx = htmlCanvas.getContext("2d");
      } else {
        return undefined;
      }

      if (!ctx) return undefined;

      const imageData = ctx.createImageData(width, height);
      imageData.data.set(pixels);
      ctx.putImageData(imageData, 0, 0);

      // Get PNG data
      if (offscreenCanvas) {
        const blob = await (offscreenCanvas as any).convertToBlob({ type: "image/png" });
        const arrayBuffer = await blob.arrayBuffer();
        return new Uint8Array(arrayBuffer);
      } else if (htmlCanvas) {
        return new Promise<Uint8Array | undefined>((resolve) => {
          htmlCanvas!.toBlob(
            async (blob) => {
              if (!blob) {
                resolve(undefined);
                return;
              }
              const arrayBuffer = await blob.arrayBuffer();
              resolve(new Uint8Array(arrayBuffer));
            },
            "image/png",
            1.0
          );
        });
      }
      return undefined;
    } catch (e) {
      Log.debug(`Browser PNG encode failed: ${e}`);
      return undefined;
    }
  }

  // ============================================================================
  // FORMAT DETECTION
  // ============================================================================

  /**
   * Check if data is a PNG file (magic number: 0x89 0x50 0x4E 0x47).
   */
  static isPngData(data: Uint8Array): boolean {
    return data.length >= 4 && data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47;
  }

  /**
   * Check if data is a JPEG file (magic number: 0xFF 0xD8 0xFF).
   */
  static isJpegData(data: Uint8Array): boolean {
    return data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  }

  /**
   * Check if data is a TGA file.
   *
   * TGA has no magic number, so we check:
   * 1. It's NOT PNG or JPEG (which have magic numbers)
   * 2. Byte 2 (image type) is a valid TGA type
   *
   * Valid TGA types:
   * - 1: Uncompressed color-mapped
   * - 2: Uncompressed true-color
   * - 3: Uncompressed grayscale
   * - 9: RLE color-mapped
   * - 10: RLE true-color
   * - 11: RLE grayscale
   */
  static isTgaData(data: Uint8Array): boolean {
    if (data.length < 18) return false;
    if (this.isPngData(data) || this.isJpegData(data)) return false;

    const imageType = data[2];
    return [1, 2, 3, 9, 10, 11].includes(imageType);
  }

  /**
   * Detect image format from file header bytes.
   *
   * @param data Raw file bytes
   * @returns Detected format, or undefined if unknown
   */
  static detectFormat(data: Uint8Array): ImageFormat | undefined {
    if (this.isPngData(data)) return "png";
    if (this.isJpegData(data)) return "jpg";
    if (this.isTgaData(data)) return "tga";
    return undefined;
  }

  // ============================================================================
  // DATA URL CONVERSION
  // ============================================================================

  /**
   * Convert raw image bytes to a data URL.
   *
   * @param data Image file bytes (PNG, JPEG, etc.)
   * @param mimeType MIME type (e.g., "image/png")
   * @returns Data URL string (data:image/png;base64,...)
   */
  static toDataUrl(data: Uint8Array, mimeType: string): string {
    const base64 = Utilities.uint8ArrayToBase64(data);
    return `data:${mimeType};base64,${base64}`;
  }

  /**
   * Convert decoded image to PNG data URL.
   *
   * @param image Decoded image with RGBA pixels
   * @returns PNG data URL, or undefined if encoding fails
   */
  static async toPngDataUrl(image: IDecodedImage): Promise<string | undefined> {
    const pngData = await this.encodeToPng(image.pixels, image.width, image.height);
    if (!pngData) return undefined;
    return this.toDataUrl(pngData, "image/png");
  }

  // ============================================================================
  // TGA TO PNG CONVERSION
  // ============================================================================

  /**
   * Convert TGA data directly to PNG data.
   *
   * @param tgaData Raw TGA file bytes
   * @returns PNG file bytes, or undefined if conversion fails
   */
  static async tgaToPng(tgaData: Uint8Array): Promise<Uint8Array | undefined> {
    const decoded = await this.decodeTga(tgaData);
    if (!decoded) return undefined;
    return this.encodeToPng(decoded.pixels, decoded.width, decoded.height);
  }

  /**
   * Convert TGA data to PNG data URL.
   *
   * @param tgaData Raw TGA file bytes
   * @returns PNG data URL (data:image/png;base64,...), or undefined if fails
   */
  static async tgaToPngDataUrl(tgaData: Uint8Array): Promise<string | undefined> {
    const pngData = await this.tgaToPng(tgaData);
    if (!pngData) return undefined;
    return this.toDataUrl(pngData, "image/png");
  }

  // ============================================================================
  // PIXEL MANIPULATION UTILITIES
  // ============================================================================

  /**
   * Convert BGRA pixel data to RGBA.
   * TGA files often store pixels in BGRA format.
   *
   * @param pixels BGRA pixel data (modified in place)
   * @returns The same array with R and B swapped
   */
  static bgraToRgba(pixels: Uint8Array): Uint8Array {
    for (let i = 0; i < pixels.length; i += 4) {
      const b = pixels[i];
      pixels[i] = pixels[i + 2]; // R = B
      pixels[i + 2] = b; // B = R
    }
    return pixels;
  }

  /**
   * Create a solid color image.
   *
   * @param width Image width
   * @param height Image height
   * @param r Red component (0-255)
   * @param g Green component (0-255)
   * @param b Blue component (0-255)
   * @param a Alpha component (0-255, default 255)
   * @returns Decoded image with solid color
   */
  static createSolidColor(
    width: number,
    height: number,
    r: number,
    g: number,
    b: number,
    a: number = 255
  ): IDecodedImage {
    const pixels = new Uint8Array(width * height * 4);
    for (let i = 0; i < pixels.length; i += 4) {
      pixels[i] = r;
      pixels[i + 1] = g;
      pixels[i + 2] = b;
      pixels[i + 3] = a;
    }
    return { width, height, pixels };
  }
}
