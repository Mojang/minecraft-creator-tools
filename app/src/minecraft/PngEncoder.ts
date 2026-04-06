// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import ImageCodec from "../core/ImageCodec";
import Utilities from "../core/Utilities";

/**
 * Pre-encoded placeholder PNG textures as base64.
 * These are small, simple solid-color textures that work in all environments.
 * Generated using MCP writeImageFileFromPixelArt tool.
 */
const PLACEHOLDER_TEXTURES = {
  // 64x64 gray solid for entities
  entity:
    "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAeElEQVR4AeXBAQEAMAyDMI7yOt+FkLxtR5jESZzESZzESZzESZzESZzESZzESZzESZzESZzESZzESZzESZzESZzESZzESZzESZzESZzESZzESZzESZzESZzESZzESZzESZzESZzESZzESZzESZzESZzESZzESZzESZzEfbNUAv/+T/uYAAAAAElFTkSuQmCC",

  // 16x16 gray solid for blocks
  block:
    "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAALElEQVR4AaXBAQEAMAyDMI7yOt9FkLxtRyCRRBJJJJFEEkkkkUQSSSSRRBJ9YpoCnyiF6V0AAAAASUVORK5CYII=",

  // 16x16 light gray solid for items
  item: "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAALUlEQVR4AaXBAQEAMAyDMI5/EXW6iyB5245AIokkkkgiiSSSSCKJJJJIIokk+ufpAv+MBfj8AAAAAElFTkSuQmCC",
};

export function parseHex(hex: string): { r: number; g: number; b: number } {
  const h = hex.startsWith("#") ? hex.slice(1) : hex;
  return {
    r: parseInt(h.slice(0, 2), 16) || 128,
    g: parseInt(h.slice(2, 4), 16) || 128,
    b: parseInt(h.slice(4, 6), 16) || 128,
  };
}

/**
 * Generate checkerboard RGBA pixel data for two colors.
 */
function generateCheckerboardPixels(
  width: number,
  height: number,
  primaryHex: string,
  secondaryHex: string,
  cellSize: number
): Uint8Array {
  const pixels = new Uint8Array(width * height * 4);
  const primary = parseHex(primaryHex);
  const secondary = parseHex(secondaryHex);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const isSecondary = Math.floor(x / cellSize) % 2 === Math.floor(y / cellSize) % 2;
      const color = isSecondary ? secondary : primary;

      pixels[idx] = color.r;
      pixels[idx + 1] = color.g;
      pixels[idx + 2] = color.b;
      pixels[idx + 3] = 255;
    }
  }

  return pixels;
}

/**
 * Cross-platform PNG encoder that works in both browser and NodeJS environments.
 * Provides pre-encoded placeholder textures for reliable cross-platform use.
 */
export default class PngEncoder {
  /**
   * Create a simple solid-color texture.
   *
   * @param width Texture width
   * @param height Texture height
   * @param hexColor Hex color (e.g., "#FF0000")
   * @returns PNG data as Uint8Array
   */
  static createSolidColorPng(width: number, height: number, hexColor: string): Uint8Array | undefined {
    const { r, g, b } = parseHex(hexColor);

    const decoded = ImageCodec.createSolidColor(width, height, r, g, b, 255);
    return ImageCodec.encodeToPngSync(decoded.pixels, decoded.width, decoded.height);
  }

  /**
   * Create a checkerboard pattern texture with two colors.
   *
   * @param width Texture width
   * @param height Texture height
   * @param primaryHex Primary color hex
   * @param secondaryHex Secondary color hex
   * @param cellSize Size of each checkerboard cell
   * @returns PNG data as Uint8Array
   */
  static createCheckerboardPng(
    width: number,
    height: number,
    primaryHex: string,
    secondaryHex: string,
    cellSize: number = 8
  ): Uint8Array | undefined {
    const pixels = generateCheckerboardPixels(width, height, primaryHex, secondaryHex, cellSize);

    // Try runtime encoding first
    const encoded = ImageCodec.encodeToPngSync(pixels, width, height);
    if (encoded) {
      return encoded;
    }

    // Fall back to pre-encoded placeholder for browser environments
    if (width === 64 && height === 64) {
      return PngEncoder.getPlaceholderTexture("entity");
    } else if (width === 16 && height === 16) {
      return PngEncoder.getPlaceholderTexture("block");
    }

    // Last resort: return entity placeholder scaled
    return PngEncoder.getPlaceholderTexture("entity");
  }

  /**
   * Async version of createCheckerboardPng that works in browser environments.
   * Falls back to sync encoding first, then tries browser Canvas API.
   */
  static async createCheckerboardPngAsync(
    width: number,
    height: number,
    primaryHex: string,
    secondaryHex: string,
    cellSize: number = 8
  ): Promise<Uint8Array | undefined> {
    const pixels = generateCheckerboardPixels(width, height, primaryHex, secondaryHex, cellSize);

    // Try sync encoding first (Node.js)
    const encoded = ImageCodec.encodeToPngSync(pixels, width, height);
    if (encoded) {
      return encoded;
    }

    // Try async browser encoding (Canvas API)
    const browserEncoded = await ImageCodec.encodeToPngBrowser(pixels, width, height);
    if (browserEncoded) {
      return browserEncoded;
    }

    return undefined;
  }

  /**
   * Get a pre-encoded placeholder texture.
   * These work in all environments without requiring runtime PNG encoding.
   *
   * @param type Type of placeholder: "entity" (64x64), "block" (16x16), or "item" (16x16)
   * @returns PNG data as Uint8Array
   */
  static getPlaceholderTexture(type: "entity" | "block" | "item"): Uint8Array {
    let base64: string;
    switch (type) {
      case "entity":
        base64 = PLACEHOLDER_TEXTURES.entity;
        break;
      case "block":
        base64 = PLACEHOLDER_TEXTURES.block;
        break;
      case "item":
        base64 = PLACEHOLDER_TEXTURES.item;
        break;
      default:
        base64 = PLACEHOLDER_TEXTURES.entity;
    }
    return Utilities.base64ToUint8Array(base64);
  }
}
