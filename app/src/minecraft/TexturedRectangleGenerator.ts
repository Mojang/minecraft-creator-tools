// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * TexturedRectangleGenerator
 *
 * Generates textured rectangles (filled areas) for Minecraft-style pixel art.
 * Produces SVG output with rect elements for blocky/pixelated aesthetics,
 * or direct RGBA pixel data for efficient texture generation.
 *
 * Uses NoiseGenerationUtilities for the core noise algorithms.
 *
 * Supports both the new IMcpTexturedRectangle format and legacy IMcpNoiseConfig for backwards compatibility.
 */

import {
  IMcpNoiseConfig,
  IMcpPixelArt,
  IMcpPixelColor,
  IMcpTexturedRectangle,
  NoisePatternType,
  TexturedRectangleType,
} from "./IMcpModelDesign";
import NoiseGenerationUtilities, { SeededRandom } from "./NoiseGenerationUtilities";
import type { ParsedColor } from "./NoiseGenerationUtilities";
import { applyTextureEffects } from "./TextureEffects";

/**
 * Textured rectangle generator for Minecraft-style procedural textures.
 */
export default class TexturedRectangleGenerator {
  /**
   * Maps new TexturedRectangleType to legacy NoisePatternType for internal processing.
   */
  private static texturedRectangleTypeToPattern(type: TexturedRectangleType): NoisePatternType | "solid" | "none" {
    switch (type) {
      case "none":
        return "none";
      case "solid":
        return "solid";
      case "random_noise":
        return "random";
      case "dither_noise":
        return "dither";
      case "perlin_noise":
        return "perlin";
      case "stipple_noise":
        return "stipple";
      case "gradient":
        return "gradient";
      default:
        return "random";
    }
  }

  /**
   * Generate an SVG string from a textured rectangle configuration.
   * This is the primary API for the new unified texture format.
   *
   * @param config Textured rectangle configuration
   * @param width Width of the texture in pixels
   * @param height Height of the texture in pixels
   * @param contextString Optional context string for seed generation
   * @returns SVG string with the texture pattern
   */
  static generateTexturedRectangleSvg(
    config: IMcpTexturedRectangle,
    width: number,
    height: number,
    contextString?: string
  ): string {
    // Parse colors
    const colors = (config.colors || []).map((c) => NoiseGenerationUtilities.parseColorInput(c));
    if (colors.length === 0) {
      // Default to white if no colors provided (ignored for "none")
      colors.push({ r: 255, g: 255, b: 255, a: 255 });
    }

    const pattern = this.texturedRectangleTypeToPattern(config.type);

    // Handle "none" - return an empty transparent SVG
    if (pattern === "none") {
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"></svg>`;
    }

    // Handle solid color - just return a simple rect
    if (pattern === "solid") {
      const color = colors[0];
      const colorStr =
        color.a === 255
          ? `rgb(${color.r},${color.g},${color.b})`
          : `rgba(${color.r},${color.g},${color.b},${(color.a / 255).toFixed(3)})`;
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="${colorStr}"/></svg>`;
    }

    // Determine seed
    const seed = config.seed ?? NoiseGenerationUtilities.hashString(contextString || `texture-${Date.now()}`);
    const rng = new SeededRandom(seed);

    // Get parameters
    const factor = Math.max(0, Math.min(1, config.factor ?? 0.2));
    const pixelSize = Math.max(1, config.pixelSize ?? 1);
    const scale = config.scale ?? 4;

    // Calculate grid dimensions
    const gridWidth = Math.ceil(width / pixelSize);
    const gridHeight = Math.ceil(height / pixelSize);

    // Generate the noise grid
    const colorGrid = NoiseGenerationUtilities.generateNoiseGrid(
      pattern as NoisePatternType,
      colors,
      factor,
      gridWidth,
      gridHeight,
      rng,
      scale
    );

    // Convert to SVG rects
    return this.gridToSvg(colorGrid, width, height, pixelSize);
  }

  /**
   * Generate an SVG string containing the noise texture.
   * @deprecated Use generateTexturedRectangleSvg with IMcpTexturedRectangle instead.
   *
   * @param config Noise configuration with colors, pattern, and parameters
   * @param width Width of the texture in pixels
   * @param height Height of the texture in pixels
   * @param contextString Optional context string for seed generation (e.g., "textureId:wood")
   * @returns SVG string with rect elements forming the noise pattern
   */
  static generateNoiseSvg(config: IMcpNoiseConfig, width: number, height: number, contextString?: string): string {
    // Parse colors
    const colors = config.colors.map((c) => NoiseGenerationUtilities.parseColorInput(c));
    if (colors.length === 0) {
      // Default to white if no colors provided
      colors.push({ r: 255, g: 255, b: 255, a: 255 });
    }

    // Determine seed
    const seed = config.seed ?? NoiseGenerationUtilities.hashString(contextString || `noise-${Date.now()}`);
    const rng = new SeededRandom(seed);

    // Get parameters
    const pattern = config.pattern || "random";
    // Default factor of 0.2 provides subtle noise without being too grainy
    const factor = Math.max(0, Math.min(1, config.factor ?? 0.2));
    const pixelSize = Math.max(1, config.pixelSize ?? 1);
    const scale = config.scale ?? 4;

    // Calculate grid dimensions
    const gridWidth = Math.ceil(width / pixelSize);
    const gridHeight = Math.ceil(height / pixelSize);

    // Generate the noise grid
    const colorGrid = NoiseGenerationUtilities.generateNoiseGrid(
      pattern,
      colors,
      factor,
      gridWidth,
      gridHeight,
      rng,
      scale
    );

    // Convert to SVG rects
    return this.gridToSvg(colorGrid, width, height, pixelSize);
  }

  /**
   * Convert color grid to SVG with rect elements
   */
  private static gridToSvg(grid: ParsedColor[][], width: number, height: number, pixelSize: number): string {
    const rects: string[] = [];

    // Optimize by grouping adjacent same-color pixels horizontally
    for (let y = 0; y < grid.length; y++) {
      const row = grid[y];
      let runStart = 0;
      let runColor = row[0];

      for (let x = 1; x <= row.length; x++) {
        const currentColor = x < row.length ? row[x] : null;

        // Check if run ends
        if (!currentColor || !NoiseGenerationUtilities.colorsEqual(currentColor, runColor)) {
          // Output the run
          const rectX = runStart * pixelSize;
          const rectY = y * pixelSize;
          const rectWidth = (x - runStart) * pixelSize;
          const rectHeight = pixelSize;

          // Clamp to texture bounds
          const clampedWidth = Math.min(rectWidth, width - rectX);
          const clampedHeight = Math.min(rectHeight, height - rectY);

          if (clampedWidth > 0 && clampedHeight > 0) {
            const colorStr = NoiseGenerationUtilities.colorToHex(runColor);
            rects.push(
              `<rect x="${rectX}" y="${rectY}" width="${clampedWidth}" height="${clampedHeight}" fill="${colorStr}"/>`
            );
          }

          // Start new run
          if (currentColor) {
            runStart = x;
            runColor = currentColor;
          }
        }
      }
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">${rects.join("")}</svg>`;
  }

  /**
   * Combine noise SVG with optional overlay SVG.
   * The noise forms the background, and the overlay is drawn on top.
   *
   * @param noiseSvg The noise pattern SVG
   * @param overlaySvg Optional SVG to draw on top of the noise
   * @param width Texture width
   * @param height Texture height
   * @returns Combined SVG string
   */
  static combineWithOverlay(noiseSvg: string, overlaySvg: string | undefined, width: number, height: number): string {
    if (!overlaySvg) {
      return noiseSvg;
    }

    // Extract inner content from both SVGs
    const noiseInner = this.extractSvgInner(noiseSvg);
    const overlayInner = this.extractSvgInner(overlaySvg);

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">${noiseInner}${overlayInner}</svg>`;
  }

  /**
   * Extract inner content from SVG string (removing outer svg tags)
   */
  private static extractSvgInner(svg: string): string {
    const match = svg.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
    return match ? match[1] : svg;
  }

  /**
   * Generate noise texture as RGBA pixel data (Uint8Array).
   * This bypasses SVG generation entirely for better performance.
   * @deprecated Use generateTexturedRectanglePixels with IMcpTexturedRectangle instead.
   *
   * @param config Noise configuration with colors, pattern, and parameters
   * @param width Width of the texture in pixels
   * @param height Height of the texture in pixels
   * @param contextString Optional context string for seed generation
   * @returns RGBA pixel data as Uint8Array (width * height * 4 bytes)
   */
  static generateNoisePixels(
    config: IMcpNoiseConfig,
    width: number,
    height: number,
    contextString?: string
  ): Uint8Array {
    // Parse colors
    const colors = config.colors.map((c) => NoiseGenerationUtilities.parseColorInput(c));
    if (colors.length === 0) {
      // Default to white if no colors provided
      colors.push({ r: 255, g: 255, b: 255, a: 255 });
    }

    // Determine seed
    const seed = config.seed ?? NoiseGenerationUtilities.hashString(contextString || `noise-${Date.now()}`);
    const rng = new SeededRandom(seed);

    // Get parameters
    const pattern = config.pattern || "random";
    const factor = Math.max(0, Math.min(1, config.factor ?? 0.2));
    const pixelSize = Math.max(1, config.pixelSize ?? 1);
    const scale = config.scale ?? 4;

    // Calculate grid dimensions
    const gridWidth = Math.ceil(width / pixelSize);
    const gridHeight = Math.ceil(height / pixelSize);

    // Generate the noise grid
    const colorGrid = NoiseGenerationUtilities.generateNoiseGrid(
      pattern,
      colors,
      factor,
      gridWidth,
      gridHeight,
      rng,
      scale
    );

    // Convert grid to RGBA pixel data
    return this.gridToPixels(colorGrid, width, height, pixelSize);
  }

  /**
   * Generate RGBA pixel data from a textured rectangle configuration.
   * This is the primary API for the new unified texture format.
   *
   * @param config Textured rectangle configuration
   * @param width Width of the texture in pixels
   * @param height Height of the texture in pixels
   * @param contextString Optional context string for seed generation
   * @returns RGBA pixel data as Uint8Array (width * height * 4 bytes)
   */
  static generatePixels(
    config: IMcpTexturedRectangle,
    width: number,
    height: number,
    contextString?: string
  ): Uint8Array {
    // Parse colors
    const colors = (config.colors || []).map((c) => NoiseGenerationUtilities.parseColorInput(c));
    if (colors.length === 0) {
      // Default to white if no colors provided (ignored for "none")
      colors.push({ r: 255, g: 255, b: 255, a: 255 });
    }

    const pattern = this.texturedRectangleTypeToPattern(config.type);
    let pixels: Uint8Array;

    if (pattern === "none") {
      // Fully transparent background. Uint8Array defaults to zero, so every RGBA
      // byte — including the alpha channel — is 0, producing a fully transparent image.
      pixels = new Uint8Array(width * height * 4);
    } else if (pattern === "solid") {
      // Handle solid color - fill with first color
      pixels = new Uint8Array(width * height * 4);
      const color = colors[0];
      for (let i = 0; i < width * height; i++) {
        const idx = i * 4;
        pixels[idx] = color.r;
        pixels[idx + 1] = color.g;
        pixels[idx + 2] = color.b;
        pixels[idx + 3] = color.a;
      }
    } else {
      // Determine seed
      const seed = config.seed ?? NoiseGenerationUtilities.hashString(contextString || `texture-${Date.now()}`);
      const rng = new SeededRandom(seed);

      // Get parameters
      const factor = Math.max(0, Math.min(1, config.factor ?? 0.2));
      const pixelSize = Math.max(1, config.pixelSize ?? 1);
      const scale = config.scale ?? 4;

      // Calculate grid dimensions
      const gridWidth = Math.ceil(width / pixelSize);
      const gridHeight = Math.ceil(height / pixelSize);

      // Generate the noise grid
      const colorGrid = NoiseGenerationUtilities.generateNoiseGrid(
        pattern as NoisePatternType,
        colors,
        factor,
        gridWidth,
        gridHeight,
        rng,
        scale
      );

      // Convert grid to RGBA pixel data
      pixels = this.gridToPixels(colorGrid, width, height, pixelSize);
    }

    // Apply post-processing effects if specified
    if (config.effects) {
      applyTextureEffects(pixels, width, height, config.effects);
    }

    return pixels;
  }

  /**
   * Convert color grid to RGBA pixel data
   */
  private static gridToPixels(grid: ParsedColor[][], width: number, height: number, pixelSize: number): Uint8Array {
    const gridWidth = grid[0]?.length || 0;
    const gridHeight = grid.length;
    const pixels = new Uint8Array(width * height * 4);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        // Map pixel to grid cell
        const gridX = Math.min(Math.floor(x / pixelSize), gridWidth - 1);
        const gridY = Math.min(Math.floor(y / pixelSize), gridHeight - 1);
        const color = grid[gridY][gridX];

        // Write RGBA values
        const idx = (y * width + x) * 4;
        pixels[idx] = color.r;
        pixels[idx + 1] = color.g;
        pixels[idx + 2] = color.b;
        pixels[idx + 3] = color.a;
      }
    }

    return pixels;
  }

  /**
   * Parse an IMcpPixelColor to a ParsedColor (RGBA 0-255).
   */
  static parsePixelColor(color: IMcpPixelColor): ParsedColor {
    // If hex is provided, parse it
    if (color.hex) {
      return NoiseGenerationUtilities.parseColorInput(color.hex);
    }
    // Otherwise use RGBA values
    return {
      r: Math.max(0, Math.min(255, color.r || 0)),
      g: Math.max(0, Math.min(255, color.g || 0)),
      b: Math.max(0, Math.min(255, color.b || 0)),
      a: color.a !== undefined ? Math.max(0, Math.min(255, color.a)) : 255,
    };
  }

  /**
   * Apply pixel art overlay to an existing RGBA pixel buffer.
   * This is the core pixel art rendering method - operates directly on pixel data
   * for maximum performance (no SVG generation).
   *
   * @param pixels Existing RGBA pixel buffer to modify in-place
   * @param width Width of the pixel buffer (face texture width in pixels)
   * @param height Height of the pixel buffer (face texture height in pixels)
   * @param pixelArt Pixel art configuration to apply
   * @param pixelsPerUnit Pixels per Minecraft unit (for "unit" scaleMode). Default: 2
   */
  static applyPixelArt(
    pixels: Uint8Array,
    width: number,
    height: number,
    pixelArt: IMcpPixelArt,
    pixelsPerUnit: number = 2
  ): void {
    const scaleMode = pixelArt.scaleMode || "unit";
    const lines = pixelArt.lines;
    const palette = pixelArt.palette;

    // Calculate pixel art dimensions
    const artHeight = lines.length;
    let artWidth = 0;
    for (const line of lines) {
      artWidth = Math.max(artWidth, line.length);
    }

    if (artWidth === 0 || artHeight === 0) {
      return; // Empty pixel art
    }

    // Pre-parse palette colors for performance
    const parsedPalette: { [char: string]: ParsedColor } = {};
    for (const char in palette) {
      parsedPalette[char] = this.parsePixelColor(palette[char]);
    }

    // Calculate scale factor and offset based on scaleMode
    let scale: number;
    let offsetX: number;
    let offsetY: number;

    switch (scaleMode) {
      case "exact":
        // Each character = 1 pixel, x/y in pixels
        scale = 1;
        offsetX = pixelArt.x || 0;
        offsetY = pixelArt.y || 0;
        break;

      case "cover":
        // Scale to fill the entire texture, ignoring x/y
        const scaleX = width / artWidth;
        const scaleY = height / artHeight;
        scale = Math.min(scaleX, scaleY); // Use min to maintain aspect ratio and cover
        // For true cover, we'd use max, but min prevents overflow
        // Center the art if it doesn't fill completely
        offsetX = Math.floor((width - artWidth * scale) / 2);
        offsetY = Math.floor((height - artHeight * scale) / 2);
        break;

      case "unit":
      default:
        // Each character = 1 Minecraft unit = pixelsPerUnit pixels
        // x/y in Minecraft units
        scale = pixelsPerUnit;
        offsetX = (pixelArt.x || 0) * pixelsPerUnit;
        offsetY = (pixelArt.y || 0) * pixelsPerUnit;
        break;
    }

    // Process each character in the pixel art
    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx];

      for (let charIdx = 0; charIdx < line.length; charIdx++) {
        const char = line[charIdx];

        // Space is always transparent (skip drawing)
        if (char === " ") continue;

        // Look up color in palette
        const color = parsedPalette[char];
        if (!color) {
          // Character not in palette - skip silently
          continue;
        }

        // Calculate the pixel region for this character
        const startX = Math.floor(offsetX + charIdx * scale);
        const startY = Math.floor(offsetY + lineIdx * scale);
        const endX = Math.floor(offsetX + (charIdx + 1) * scale);
        const endY = Math.floor(offsetY + (lineIdx + 1) * scale);

        // Fill the scaled pixel region
        for (let pixelY = startY; pixelY < endY; pixelY++) {
          // Skip if outside texture bounds
          if (pixelY < 0 || pixelY >= height) continue;

          for (let pixelX = startX; pixelX < endX; pixelX++) {
            // Skip if outside texture bounds
            if (pixelX < 0 || pixelX >= width) continue;

            // Calculate pixel index in buffer
            const idx = (pixelY * width + pixelX) * 4;

            // Alpha blend the pixel
            if (color.a === 255) {
              // Fully opaque - direct write
              pixels[idx] = color.r;
              pixels[idx + 1] = color.g;
              pixels[idx + 2] = color.b;
              pixels[idx + 3] = 255;
            } else if (color.a > 0) {
              // Partial transparency - alpha blend
              const srcAlpha = color.a / 255;
              const dstAlpha = pixels[idx + 3] / 255;
              const outAlpha = srcAlpha + dstAlpha * (1 - srcAlpha);

              if (outAlpha > 0) {
                pixels[idx] = Math.round((color.r * srcAlpha + pixels[idx] * dstAlpha * (1 - srcAlpha)) / outAlpha);
                pixels[idx + 1] = Math.round(
                  (color.g * srcAlpha + pixels[idx + 1] * dstAlpha * (1 - srcAlpha)) / outAlpha
                );
                pixels[idx + 2] = Math.round(
                  (color.b * srcAlpha + pixels[idx + 2] * dstAlpha * (1 - srcAlpha)) / outAlpha
                );
                pixels[idx + 3] = Math.round(outAlpha * 255);
              }
            }
            // If alpha is 0, don't draw anything
          }
        }
      }
    }
  }

  /**
   * Apply multiple pixel art overlays in order.
   * Each layer is rendered on top of the previous.
   *
   * @param pixels Existing RGBA pixel buffer to modify in-place
   * @param width Width of the pixel buffer
   * @param height Height of the pixel buffer
   * @param pixelArtLayers Array of pixel art configurations to apply
   * @param pixelsPerUnit Pixels per Minecraft unit (for "unit" scaleMode). Default: 2
   */
  static applyPixelArtLayers(
    pixels: Uint8Array,
    width: number,
    height: number,
    pixelArtLayers: IMcpPixelArt[],
    pixelsPerUnit: number = 2
  ): void {
    for (const layer of pixelArtLayers) {
      this.applyPixelArt(pixels, width, height, layer, pixelsPerUnit);
    }
  }

  /**
   * Generate pixel art as standalone RGBA pixel data.
   * Creates a transparent buffer and applies the pixel art to it.
   *
   * @param pixelArt Pixel art configuration
   * @returns Object with pixels (RGBA Uint8Array), width, and height
   */
  static generatePixelArtPixels(pixelArt: IMcpPixelArt): { pixels: Uint8Array; width: number; height: number } {
    // Calculate dimensions from lines
    const height = pixelArt.lines.length;
    let width = 0;
    for (const line of pixelArt.lines) {
      width = Math.max(width, line.length);
    }

    // Handle empty pixel art
    if (width === 0 || height === 0) {
      return { pixels: new Uint8Array(0), width: 0, height: 0 };
    }

    // Create transparent buffer
    const pixels = new Uint8Array(width * height * 4);
    // Buffer is already zeroed (fully transparent)

    // Apply the pixel art
    this.applyPixelArt(pixels, width, height, pixelArt);

    return { pixels, width, height };
  }
}

// Re-export for backwards compatibility
export { NoiseGenerationUtilities, SeededRandom, ParsedColor };
