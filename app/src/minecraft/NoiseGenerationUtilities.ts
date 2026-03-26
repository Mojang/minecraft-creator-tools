// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * NoiseGenerationUtilities
 *
 * Pure noise generation algorithms for procedural texture generation.
 * This module provides the core algorithms without any rendering/output concerns.
 *
 * Used by TexturedRectangleGenerator to create Minecraft-style pixel art textures.
 */

import { IMcpColorRGBA, NoisePatternType } from "./IMcpModelDesign";
import ModelDesignUtilities from "./ModelDesignUtilities";

/**
 * Parsed color with r, g, b, a components
 */
export interface ParsedColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

/**
 * Simple seeded pseudo-random number generator (Mulberry32).
 * Produces deterministic sequences for consistent noise generation.
 */
export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed;
  }

  /**
   * Generate next random number in [0, 1)
   */
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Generate random integer in [min, max] inclusive
   */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
}

/**
 * 4x4 Bayer dithering matrix (normalized to 0-1 range)
 */
const BAYER_MATRIX_4X4 = [
  [0 / 16, 8 / 16, 2 / 16, 10 / 16],
  [12 / 16, 4 / 16, 14 / 16, 6 / 16],
  [3 / 16, 11 / 16, 1 / 16, 9 / 16],
  [15 / 16, 7 / 16, 13 / 16, 5 / 16],
];

/**
 * Noise generation utilities - pure algorithms for procedural noise patterns.
 */
export default class NoiseGenerationUtilities {
  /**
   * Hash function to generate seed from string (djb2 algorithm)
   */
  static hashString(str: string): number {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = (hash * 33) ^ str.charCodeAt(i);
    }
    return hash >>> 0; // Convert to unsigned 32-bit
  }

  /**
   * Generate noise grid based on pattern type
   */
  static generateNoiseGrid(
    pattern: NoisePatternType,
    colors: ParsedColor[],
    factor: number,
    width: number,
    height: number,
    rng: SeededRandom,
    scale: number
  ): ParsedColor[][] {
    switch (pattern) {
      case "dither":
        return this.generateDitherGrid(colors, factor, width, height);
      case "perlin":
        return this.generatePerlinGrid(colors, factor, width, height, rng, scale);
      case "stipple":
        return this.generateStippleGrid(colors, factor, width, height, rng);
      case "gradient":
        return this.generateGradientGrid(colors, width, height, rng);
      case "random":
      default:
        return this.generateRandomGrid(colors, factor, width, height, rng);
    }
  }

  /**
   * Simple random noise - each pixel randomly picks from colors
   */
  static generateRandomGrid(
    colors: ParsedColor[],
    factor: number,
    width: number,
    height: number,
    rng: SeededRandom
  ): ParsedColor[][] {
    const grid: ParsedColor[][] = [];
    const baseColor = colors[0];

    for (let y = 0; y < height; y++) {
      const row: ParsedColor[] = [];
      for (let x = 0; x < width; x++) {
        if (rng.next() < factor && colors.length > 1) {
          // Pick a random color from the palette
          const colorIndex = rng.nextInt(0, colors.length - 1);
          row.push(colors[colorIndex]);
        } else {
          row.push(baseColor);
        }
      }
      grid.push(row);
    }

    return grid;
  }

  /**
   * Ordered dithering using Bayer matrix
   */
  static generateDitherGrid(colors: ParsedColor[], factor: number, width: number, height: number): ParsedColor[][] {
    const grid: ParsedColor[][] = [];

    for (let y = 0; y < height; y++) {
      const row: ParsedColor[] = [];
      for (let x = 0; x < width; x++) {
        // Get threshold from Bayer matrix
        const threshold = BAYER_MATRIX_4X4[y % 4][x % 4];

        // Determine which color to use based on threshold and factor
        const colorIndex = threshold * factor * (colors.length - 1);
        const index = Math.min(Math.floor(colorIndex), colors.length - 1);
        row.push(colors[index]);
      }
      grid.push(row);
    }

    return grid;
  }

  /**
   * Perlin-like noise for organic variation
   * Uses simplified value noise with interpolation and smooth color blending
   */
  static generatePerlinGrid(
    colors: ParsedColor[],
    factor: number,
    width: number,
    height: number,
    rng: SeededRandom,
    scale: number
  ): ParsedColor[][] {
    // Generate base noise at lower resolution
    const noiseWidth = Math.ceil(width / scale) + 2;
    const noiseHeight = Math.ceil(height / scale) + 2;
    const baseNoise: number[][] = [];

    for (let y = 0; y < noiseHeight; y++) {
      const row: number[] = [];
      for (let x = 0; x < noiseWidth; x++) {
        row.push(rng.next());
      }
      baseNoise.push(row);
    }

    // Interpolate to full resolution
    const grid: ParsedColor[][] = [];

    for (let y = 0; y < height; y++) {
      const row: ParsedColor[] = [];
      for (let x = 0; x < width; x++) {
        // Get interpolated noise value
        const nx = x / scale;
        const ny = y / scale;
        const value = this.bilinearInterpolate(baseNoise, nx, ny);

        // Apply factor to control spread (factor 1.0 = full range, lower = more subtle)
        const adjustedValue = (value - 0.5) * factor + 0.5;
        const clampedValue = Math.max(0, Math.min(1, adjustedValue));

        // Blend between colors smoothly instead of hard quantization
        // Map value to position in color array and interpolate
        const colorPos = clampedValue * (colors.length - 1);
        const colorIndex = Math.floor(colorPos);
        const colorFrac = colorPos - colorIndex;

        const color1 = colors[Math.min(colorIndex, colors.length - 1)];
        const color2 = colors[Math.min(colorIndex + 1, colors.length - 1)];

        // Linearly interpolate between adjacent colors
        const blendedColor: ParsedColor = {
          r: Math.round(color1.r * (1 - colorFrac) + color2.r * colorFrac),
          g: Math.round(color1.g * (1 - colorFrac) + color2.g * colorFrac),
          b: Math.round(color1.b * (1 - colorFrac) + color2.b * colorFrac),
          a: Math.round(color1.a * (1 - colorFrac) + color2.a * colorFrac),
        };
        row.push(blendedColor);
      }
      grid.push(row);
    }

    return grid;
  }

  /**
   * Bilinear interpolation for smooth noise
   */
  static bilinearInterpolate(grid: number[][], x: number, y: number): number {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const x1 = x0 + 1;
    const y1 = y0 + 1;

    const xFrac = x - x0;
    const yFrac = y - y0;

    // Get values at corners (with bounds checking)
    const v00 = grid[Math.min(y0, grid.length - 1)]?.[Math.min(x0, grid[0].length - 1)] ?? 0;
    const v10 = grid[Math.min(y0, grid.length - 1)]?.[Math.min(x1, grid[0].length - 1)] ?? 0;
    const v01 = grid[Math.min(y1, grid.length - 1)]?.[Math.min(x0, grid[0].length - 1)] ?? 0;
    const v11 = grid[Math.min(y1, grid.length - 1)]?.[Math.min(x1, grid[0].length - 1)] ?? 0;

    // Interpolate
    const top = v00 * (1 - xFrac) + v10 * xFrac;
    const bottom = v01 * (1 - xFrac) + v11 * xFrac;
    return top * (1 - yFrac) + bottom * yFrac;
  }

  /**
   * Stipple pattern - scattered dots on base color
   */
  static generateStippleGrid(
    colors: ParsedColor[],
    factor: number,
    width: number,
    height: number,
    rng: SeededRandom
  ): ParsedColor[][] {
    const grid: ParsedColor[][] = [];
    const baseColor = colors[0];
    const dotColors = colors.slice(1);

    if (dotColors.length === 0) {
      dotColors.push(baseColor);
    }

    for (let y = 0; y < height; y++) {
      const row: ParsedColor[] = [];
      for (let x = 0; x < width; x++) {
        // Stipple probability based on factor (factor of 0.5 = ~50% dots)
        if (rng.next() < factor * 0.7) {
          const dotIndex = rng.nextInt(0, dotColors.length - 1);
          row.push(dotColors[dotIndex]);
        } else {
          row.push(baseColor);
        }
      }
      grid.push(row);
    }

    return grid;
  }

  /**
   * Gradient noise - smooth transition between colors
   * Creates horizontal or vertical gradient with slight noise
   */
  static generateGradientGrid(
    colors: ParsedColor[],
    width: number,
    height: number,
    rng: SeededRandom
  ): ParsedColor[][] {
    const grid: ParsedColor[][] = [];
    const isVertical = rng.next() > 0.5;

    for (let y = 0; y < height; y++) {
      const row: ParsedColor[] = [];
      for (let x = 0; x < width; x++) {
        // Calculate position along gradient (0 to 1)
        const t = isVertical ? y / Math.max(height - 1, 1) : x / Math.max(width - 1, 1);

        // Add slight noise
        const noiseT = t + (rng.next() - 0.5) * 0.1;
        const clampedT = Math.max(0, Math.min(1, noiseT));

        // Interpolate between colors
        const colorPos = clampedT * (colors.length - 1);
        const colorIndex = Math.floor(colorPos);
        const colorFrac = colorPos - colorIndex;

        const c1 = colors[Math.min(colorIndex, colors.length - 1)];
        const c2 = colors[Math.min(colorIndex + 1, colors.length - 1)];

        row.push(this.lerpColor(c1, c2, colorFrac));
      }
      grid.push(row);
    }

    return grid;
  }

  /**
   * Linear interpolation between two colors
   */
  static lerpColor(c1: ParsedColor, c2: ParsedColor, t: number): ParsedColor {
    return {
      r: Math.round(c1.r * (1 - t) + c2.r * t),
      g: Math.round(c1.g * (1 - t) + c2.g * t),
      b: Math.round(c1.b * (1 - t) + c2.b * t),
      a: Math.round(c1.a * (1 - t) + c2.a * t),
    };
  }

  /**
   * Check if two colors are equal
   */
  static colorsEqual(c1: ParsedColor, c2: ParsedColor): boolean {
    return c1.r === c2.r && c1.g === c2.g && c1.b === c2.b && c1.a === c2.a;
  }

  /**
   * Convert parsed color to hex string
   */
  static colorToHex(color: ParsedColor): string {
    const r = color.r.toString(16).padStart(2, "0");
    const g = color.g.toString(16).padStart(2, "0");
    const b = color.b.toString(16).padStart(2, "0");

    if (color.a < 255) {
      const a = color.a.toString(16).padStart(2, "0");
      return `#${r}${g}${b}${a}`;
    }

    return `#${r}${g}${b}`;
  }

  /**
   * Parse color input (string or RGBA object) to ParsedColor
   */
  static parseColorInput(input: string | IMcpColorRGBA): ParsedColor {
    if (typeof input === "object") {
      return {
        r: Math.max(0, Math.min(255, input.r)),
        g: Math.max(0, Math.min(255, input.g)),
        b: Math.max(0, Math.min(255, input.b)),
        a: input.a !== undefined ? Math.max(0, Math.min(255, input.a)) : 255,
      };
    }

    // Use ModelDesignUtilities.parseColor for string parsing
    const parsed = ModelDesignUtilities.parseColor(input);
    return {
      r: parsed.r,
      g: parsed.g,
      b: parsed.b,
      a: parsed.a ?? 255,
    };
  }
}
