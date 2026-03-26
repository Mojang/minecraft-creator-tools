// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * TextureEffects
 *
 * A reusable library of pixel-level texture effects for Minecraft-style textures.
 * These effects operate directly on RGBA pixel buffers for maximum performance.
 *
 * ARCHITECTURE:
 * - All effects operate on Uint8Array RGBA pixel buffers (width * height * 4 bytes)
 * - Effects are pure functions that modify the pixel buffer in-place
 * - Effects can be composed/chained for complex visual results
 * - All coordinates use standard image coordinates (0,0 = top-left)
 *
 * EFFECT CATEGORIES:
 * 1. Lighting Effects - Add depth/dimension via light simulation (inset, outset, pillow, ambient_occlusion)
 * 2. Border Effects - Add edges/outlines with CSS-like syntax (solid, dashed, worn, highlight)
 * 3. Overlay Effects - Add weathering/detail patterns (cracks, scratches, moss, rust, sparkle, veins)
 * 4. Color Variation - Modify color distribution (hue_shift, saturation_jitter, value_jitter, palette_snap)
 * 5. Tiling Effects - Make textures seamless/patterned (seamless, brick, herringbone, basketweave)
 */

import { ParsedColor, SeededRandom } from "./NoiseGenerationUtilities";
import NoiseGenerationUtilities from "./NoiseGenerationUtilities";

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Lighting effect preset types.
 * These simulate light hitting a surface to add depth.
 */
export type LightingPreset = "inset" | "outset" | "pillow" | "ambient_occlusion";

/**
 * Configuration for lighting effects.
 * Adds pseudo-3D depth to flat textures by simulating light direction.
 */
export interface ILightingEffect {
  /**
   * The lighting preset to apply:
   * - 'inset': Darken top/left, lighten bottom/right (recessed panels, buttons)
   * - 'outset': Lighten top/left, darken bottom/right (raised blocks, bricks)
   * - 'pillow': Darken all edges toward center (rounded/soft look)
   * - 'ambient_occlusion': Darken only corners/edges (realistic depth)
   */
  preset: LightingPreset;

  /**
   * Intensity of the effect (0.0 to 1.0). Default: 0.3
   * - 0.0: No effect
   * - 0.5: Medium effect
   * - 1.0: Maximum effect
   */
  intensity?: number;

  /**
   * Light source angle in degrees (0-360). Default: 315 (top-left)
   * - 0: Right
   * - 90: Bottom
   * - 180: Left
   * - 270: Top
   * - 315: Top-left (most common for pseudo-3D)
   */
  angle?: number;
}

/**
 * Border style types.
 */
export type BorderStyle = "solid" | "dashed" | "worn" | "highlight";

/**
 * Configuration for a single border side (CSS-like).
 */
export interface IBorderSide {
  /**
   * Style of the border:
   * - 'solid': Continuous line
   * - 'dashed': Alternating on/off segments
   * - 'worn': Irregular/weathered edge
   * - 'highlight': Bright line (auto-lightened from base)
   */
  style: BorderStyle;

  /**
   * Width in pixels (1-8). Default: 1
   */
  width?: number;

  /**
   * Border color (hex string). If not specified:
   * - For 'solid'/'dashed': Auto-darkens from texture
   * - For 'highlight': Auto-lightens from texture
   * - For 'worn': Uses texture color with variations
   */
  color?: string;
}

/**
 * Configuration for border effects (CSS-like syntax).
 * Supports individual side configuration or shorthand for all sides.
 */
export interface IBorderEffect {
  /**
   * Shorthand: Apply to all sides. Individual side properties override this.
   */
  all?: IBorderSide;

  /**
   * Top border configuration.
   */
  top?: IBorderSide;

  /**
   * Right border configuration.
   */
  right?: IBorderSide;

  /**
   * Bottom border configuration.
   */
  bottom?: IBorderSide;

  /**
   * Left border configuration.
   */
  left?: IBorderSide;

  /**
   * Random seed for 'worn' style. Enables deterministic weathering.
   */
  seed?: number;
}

/**
 * Overlay pattern types for weathering and detail.
 */
export type OverlayPattern = "cracks" | "scratches" | "moss" | "rust" | "sparkle" | "veins";

/**
 * Configuration for overlay effects.
 * Adds surface detail without modifying the base texture structure.
 */
export interface IOverlayEffect {
  /**
   * The overlay pattern to apply:
   * - 'cracks': Dark lines suggesting cracks/fractures
   * - 'scratches': Light linear marks
   * - 'moss': Green/organic patches
   * - 'rust': Orange/brown oxidation spots
   * - 'sparkle': Bright highlight dots
   * - 'veins': Dark branching lines (for stone/marble)
   */
  pattern: OverlayPattern;

  /**
   * Coverage density (0.0 to 1.0). Default: 0.3
   * - 0.0: Almost no overlay
   * - 0.5: Medium coverage
   * - 1.0: Heavy coverage
   */
  density?: number;

  /**
   * Override color for the overlay pattern (hex string).
   * If not specified, uses pattern-appropriate defaults.
   */
  color?: string;

  /**
   * Random seed for deterministic pattern placement.
   */
  seed?: number;
}

/**
 * Color variation mode types.
 */
export type ColorVariationMode = "hue_shift" | "saturation_jitter" | "value_jitter" | "palette_snap";

/**
 * Configuration for color variation effects.
 * Modifies the color distribution to reduce flatness.
 */
export interface IColorVariationEffect {
  /**
   * The color variation mode:
   * - 'hue_shift': Randomly shift hue within range
   * - 'saturation_jitter': Randomly vary saturation
   * - 'value_jitter': Randomly vary brightness/value
   * - 'palette_snap': Snap colors to nearest palette entry
   */
  mode: ColorVariationMode;

  /**
   * Amount of variation (0.0 to 1.0). Default: 0.1
   * - 0.0: No change
   * - 0.5: Medium variation
   * - 1.0: Maximum variation
   */
  amount?: number;

  /**
   * For 'palette_snap': Array of colors to snap to (hex strings).
   */
  palette?: string[];

  /**
   * Random seed for deterministic variation.
   */
  seed?: number;
}

/**
 * Tiling pattern types for seamless/patterned textures.
 */
export type TilingPattern = "brick" | "herringbone" | "basketweave" | "random";

/**
 * Configuration for tiling effects.
 * Helps create seamless textures or specific tiling patterns.
 */
export interface ITilingEffect {
  /**
   * Make edges seamless for repeating textures.
   */
  seamless?: boolean;

  /**
   * Tiling pattern for block arrangement:
   * - 'brick': Offset rows by half
   * - 'herringbone': Diagonal zigzag pattern
   * - 'basketweave': Alternating horizontal/vertical groups
   * - 'random': Randomized positions
   */
  pattern?: TilingPattern;

  /**
   * Offset amount for brick pattern (0.0 to 1.0). Default: 0.5
   */
  offset?: number;
}

/**
 * Combined effects configuration for a texture.
 * Multiple effects can be applied in a defined order.
 */
export interface ITextureEffects {
  /**
   * Lighting effect for pseudo-3D depth.
   */
  lighting?: ILightingEffect;

  /**
   * Border effect for edges/outlines (CSS-like syntax).
   */
  border?: IBorderEffect;

  /**
   * Overlay effects for surface detail. Applied in array order.
   */
  overlay?: IOverlayEffect | IOverlayEffect[];

  /**
   * Color variation effect.
   */
  colorVariation?: IColorVariationEffect;

  /**
   * Tiling effect for seamless/patterned textures.
   */
  tiling?: ITilingEffect;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get pixel index in RGBA buffer.
 */
function getPixelIndex(x: number, y: number, width: number): number {
  return (y * width + x) * 4;
}

/**
 * Get pixel color from buffer.
 */
function getPixel(pixels: Uint8Array, x: number, y: number, width: number): ParsedColor {
  const idx = getPixelIndex(x, y, width);
  return {
    r: pixels[idx],
    g: pixels[idx + 1],
    b: pixels[idx + 2],
    a: pixels[idx + 3],
  };
}

/**
 * Set pixel color in buffer.
 */
function setPixel(pixels: Uint8Array, x: number, y: number, width: number, color: ParsedColor): void {
  const idx = getPixelIndex(x, y, width);
  pixels[idx] = color.r;
  pixels[idx + 1] = color.g;
  pixels[idx + 2] = color.b;
  pixels[idx + 3] = color.a;
}

/**
 * Blend source color over destination with alpha.
 */
function blendOver(dst: ParsedColor, src: ParsedColor, opacity: number = 1): ParsedColor {
  const srcAlpha = (src.a / 255) * opacity;
  const dstAlpha = dst.a / 255;
  const outAlpha = srcAlpha + dstAlpha * (1 - srcAlpha);

  if (outAlpha === 0) {
    return { r: 0, g: 0, b: 0, a: 0 };
  }

  return {
    r: Math.round((src.r * srcAlpha + dst.r * dstAlpha * (1 - srcAlpha)) / outAlpha),
    g: Math.round((src.g * srcAlpha + dst.g * dstAlpha * (1 - srcAlpha)) / outAlpha),
    b: Math.round((src.b * srcAlpha + dst.b * dstAlpha * (1 - srcAlpha)) / outAlpha),
    a: Math.round(outAlpha * 255),
  };
}

/**
 * Lighten a color by a factor.
 */
function lightenColor(color: ParsedColor, factor: number): ParsedColor {
  return {
    r: Math.min(255, Math.round(color.r + (255 - color.r) * factor)),
    g: Math.min(255, Math.round(color.g + (255 - color.g) * factor)),
    b: Math.min(255, Math.round(color.b + (255 - color.b) * factor)),
    a: color.a,
  };
}

/**
 * Darken a color by a factor.
 */
function darkenColor(color: ParsedColor, factor: number): ParsedColor {
  return {
    r: Math.max(0, Math.round(color.r * (1 - factor))),
    g: Math.max(0, Math.round(color.g * (1 - factor))),
    b: Math.max(0, Math.round(color.b * (1 - factor))),
    a: color.a,
  };
}

/**
 * Convert RGB to HSV.
 */
function rgbToHsv(color: ParsedColor): { h: number; s: number; v: number } {
  const r = color.r / 255;
  const g = color.g / 255;
  const b = color.b / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;

  if (max !== min) {
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return { h, s, v };
}

/**
 * Convert HSV to RGB.
 */
function hsvToRgb(h: number, s: number, v: number, a: number = 255): ParsedColor {
  let r = 0,
    g = 0,
    b = 0;

  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);

  switch (i % 6) {
    case 0:
      r = v;
      g = t;
      b = p;
      break;
    case 1:
      r = q;
      g = v;
      b = p;
      break;
    case 2:
      r = p;
      g = v;
      b = t;
      break;
    case 3:
      r = p;
      g = q;
      b = v;
      break;
    case 4:
      r = t;
      g = p;
      b = v;
      break;
    case 5:
      r = v;
      g = p;
      b = q;
      break;
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
    a,
  };
}

/**
 * Calculate color distance for palette snapping.
 */
function colorDistance(c1: ParsedColor, c2: ParsedColor): number {
  const dr = c1.r - c2.r;
  const dg = c1.g - c2.g;
  const db = c1.b - c2.b;
  return dr * dr + dg * dg + db * db;
}

// ============================================================================
// LIGHTING EFFECTS
// ============================================================================

/**
 * Apply lighting effect to pixel buffer.
 * Creates pseudo-3D depth by simulating light hitting a surface.
 */
export function applyLightingEffect(pixels: Uint8Array, width: number, height: number, effect: ILightingEffect): void {
  const intensity = effect.intensity ?? 0.3;
  const angle = effect.angle ?? 315; // Default: top-left

  // Pre-calculate angle components
  const angleRad = (angle * Math.PI) / 180;
  const lightX = Math.cos(angleRad);
  const lightY = -Math.sin(angleRad); // Negative because Y increases downward

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const color = getPixel(pixels, x, y, width);
      if (color.a === 0) continue; // Skip transparent pixels

      let lightFactor = 0;

      switch (effect.preset) {
        case "inset":
          // Inset: darken near light source, lighten away from it
          {
            const nx = (x / (width - 1)) * 2 - 1; // Normalize to -1 to 1
            const ny = (y / (height - 1)) * 2 - 1;
            lightFactor = -(nx * lightX + ny * lightY) * intensity;
          }
          break;

        case "outset":
          // Outset: lighten near light source, darken away from it
          {
            const nx = (x / (width - 1)) * 2 - 1;
            const ny = (y / (height - 1)) * 2 - 1;
            lightFactor = (nx * lightX + ny * lightY) * intensity;
          }
          break;

        case "pillow":
          // Pillow: darken edges, lighten center
          {
            const dx = Math.abs((x / (width - 1)) * 2 - 1);
            const dy = Math.abs((y / (height - 1)) * 2 - 1);
            const edgeDist = Math.max(dx, dy);
            lightFactor = (1 - edgeDist * 2) * intensity;
          }
          break;

        case "ambient_occlusion":
          // Ambient occlusion: darken corners and edges
          {
            const dx = Math.min(x, width - 1 - x) / (width / 2);
            const dy = Math.min(y, height - 1 - y) / (height / 2);
            const cornerDist = Math.min(dx, dy);
            lightFactor = (cornerDist - 0.5) * intensity * 2;
          }
          break;
      }

      // Apply lighting
      let newColor: ParsedColor;
      if (lightFactor > 0) {
        newColor = lightenColor(color, lightFactor);
      } else {
        newColor = darkenColor(color, -lightFactor);
      }

      setPixel(pixels, x, y, width, newColor);
    }
  }
}

// ============================================================================
// BORDER EFFECTS
// ============================================================================

/**
 * Apply border effect to pixel buffer.
 * Uses CSS-like syntax for specifying individual or all sides.
 */
export function applyBorderEffect(pixels: Uint8Array, width: number, height: number, effect: IBorderEffect): void {
  const rng = new SeededRandom(effect.seed ?? 12345);

  // Resolve each side's configuration
  const sides = {
    top: effect.top ?? effect.all,
    right: effect.right ?? effect.all,
    bottom: effect.bottom ?? effect.all,
    left: effect.left ?? effect.all,
  };

  // Apply each side
  if (sides.top) {
    applyBorderSide(pixels, width, height, "top", sides.top, rng);
  }
  if (sides.right) {
    applyBorderSide(pixels, width, height, "right", sides.right, rng);
  }
  if (sides.bottom) {
    applyBorderSide(pixels, width, height, "bottom", sides.bottom, rng);
  }
  if (sides.left) {
    applyBorderSide(pixels, width, height, "left", sides.left, rng);
  }
}

/**
 * Apply a single border side.
 */
function applyBorderSide(
  pixels: Uint8Array,
  width: number,
  height: number,
  side: "top" | "right" | "bottom" | "left",
  config: IBorderSide,
  rng: SeededRandom
): void {
  const borderWidth = Math.min(config.width ?? 1, 8);
  const style = config.style;

  // Parse or auto-generate border color
  let borderColor: ParsedColor;
  if (config.color) {
    borderColor = NoiseGenerationUtilities.parseColorInput(config.color);
  } else {
    // Sample center pixel and auto-adjust
    const centerColor = getPixel(pixels, Math.floor(width / 2), Math.floor(height / 2), width);
    if (style === "highlight") {
      borderColor = lightenColor(centerColor, 0.4);
    } else {
      borderColor = darkenColor(centerColor, 0.3);
    }
  }

  // Determine pixel ranges based on side
  let xStart: number, xEnd: number, yStart: number, yEnd: number;

  switch (side) {
    case "top":
      xStart = 0;
      xEnd = width;
      yStart = 0;
      yEnd = borderWidth;
      break;
    case "bottom":
      xStart = 0;
      xEnd = width;
      yStart = height - borderWidth;
      yEnd = height;
      break;
    case "left":
      xStart = 0;
      xEnd = borderWidth;
      yStart = 0;
      yEnd = height;
      break;
    case "right":
      xStart = width - borderWidth;
      xEnd = width;
      yStart = 0;
      yEnd = height;
      break;
  }

  // Apply border pixels
  for (let y = yStart; y < yEnd; y++) {
    for (let x = xStart; x < xEnd; x++) {
      let shouldDraw = true;
      let colorToUse = borderColor;

      switch (style) {
        case "solid":
          // Always draw
          break;

        case "dashed":
          // Draw every other 2-pixel segment
          const pos = side === "top" || side === "bottom" ? x : y;
          shouldDraw = Math.floor(pos / 2) % 2 === 0;
          break;

        case "worn":
          // Irregular drawing with random gaps
          shouldDraw = rng.next() > 0.2;
          if (shouldDraw) {
            // Add slight color variation
            const variation = (rng.next() - 0.5) * 0.2;
            if (variation > 0) {
              colorToUse = lightenColor(borderColor, variation);
            } else {
              colorToUse = darkenColor(borderColor, -variation);
            }
          }
          break;

        case "highlight":
          // Brighter border with slight gradient
          {
            const distFromEdge =
              side === "top"
                ? y - yStart
                : side === "bottom"
                ? yEnd - 1 - y
                : side === "left"
                ? x - xStart
                : xEnd - 1 - x;
            const gradient = 1 - distFromEdge / borderWidth;
            colorToUse = lightenColor(borderColor, gradient * 0.2);
          }
          break;
      }

      if (shouldDraw) {
        const existingColor = getPixel(pixels, x, y, width);
        const blended = blendOver(existingColor, colorToUse, 0.8);
        setPixel(pixels, x, y, width, blended);
      }
    }
  }
}

// ============================================================================
// OVERLAY EFFECTS
// ============================================================================

/**
 * Apply overlay effect to pixel buffer.
 * Adds surface detail without modifying base structure.
 */
export function applyOverlayEffect(pixels: Uint8Array, width: number, height: number, effect: IOverlayEffect): void {
  const density = effect.density ?? 0.3;
  const rng = new SeededRandom(effect.seed ?? 54321);

  // Get pattern-specific default color
  let overlayColor: ParsedColor;
  if (effect.color) {
    overlayColor = NoiseGenerationUtilities.parseColorInput(effect.color);
  } else {
    switch (effect.pattern) {
      case "cracks":
        overlayColor = { r: 30, g: 30, b: 30, a: 180 };
        break;
      case "scratches":
        overlayColor = { r: 200, g: 200, b: 200, a: 150 };
        break;
      case "moss":
        overlayColor = { r: 60, g: 120, b: 40, a: 180 };
        break;
      case "rust":
        overlayColor = { r: 180, g: 80, b: 30, a: 180 };
        break;
      case "sparkle":
        overlayColor = { r: 255, g: 255, b: 255, a: 255 };
        break;
      case "veins":
        overlayColor = { r: 50, g: 50, b: 60, a: 160 };
        break;
      default:
        overlayColor = { r: 128, g: 128, b: 128, a: 128 };
    }
  }

  switch (effect.pattern) {
    case "cracks":
      applyCracksOverlay(pixels, width, height, overlayColor, density, rng);
      break;
    case "scratches":
      applyScratchesOverlay(pixels, width, height, overlayColor, density, rng);
      break;
    case "moss":
      applyMossOverlay(pixels, width, height, overlayColor, density, rng);
      break;
    case "rust":
      applyRustOverlay(pixels, width, height, overlayColor, density, rng);
      break;
    case "sparkle":
      applySparkleOverlay(pixels, width, height, overlayColor, density, rng);
      break;
    case "veins":
      applyVeinsOverlay(pixels, width, height, overlayColor, density, rng);
      break;
  }
}

/**
 * Apply cracks overlay - dark lines suggesting fractures.
 */
function applyCracksOverlay(
  pixels: Uint8Array,
  width: number,
  height: number,
  color: ParsedColor,
  density: number,
  rng: SeededRandom
): void {
  const numCracks = Math.floor(density * 5) + 1;

  for (let i = 0; i < numCracks; i++) {
    // Start point
    let x = rng.nextInt(0, width - 1);
    let y = rng.nextInt(0, height - 1);

    // Crack length
    const length = rng.nextInt(3, Math.max(width, height) / 2);

    for (let j = 0; j < length; j++) {
      if (x >= 0 && x < width && y >= 0 && y < height) {
        const existingColor = getPixel(pixels, x, y, width);
        const blended = blendOver(existingColor, color, 0.7);
        setPixel(pixels, x, y, width, blended);
      }

      // Random walk with preference for downward/diagonal
      const dir = rng.next();
      if (dir < 0.4) {
        y += 1;
      } else if (dir < 0.6) {
        x += rng.next() < 0.5 ? -1 : 1;
      } else if (dir < 0.8) {
        x += 1;
        y += 1;
      } else {
        x -= 1;
        y += 1;
      }
    }
  }
}

/**
 * Apply scratches overlay - light linear marks.
 */
function applyScratchesOverlay(
  pixels: Uint8Array,
  width: number,
  height: number,
  color: ParsedColor,
  density: number,
  rng: SeededRandom
): void {
  const numScratches = Math.floor(density * 8) + 1;

  for (let i = 0; i < numScratches; i++) {
    // Start point
    const x1 = rng.nextInt(0, width - 1);
    const y1 = rng.nextInt(0, height - 1);

    // End point - mostly horizontal or diagonal scratches
    const angle = (rng.next() - 0.5) * Math.PI * 0.5; // -45 to +45 degrees
    const length = rng.nextInt(2, width / 3);
    const x2 = Math.round(x1 + Math.cos(angle) * length);
    const y2 = Math.round(y1 + Math.sin(angle) * length);

    // Draw line using Bresenham's algorithm
    drawLine(pixels, width, height, x1, y1, x2, y2, color, 0.5);
  }
}

/**
 * Draw a line using Bresenham's algorithm.
 */
function drawLine(
  pixels: Uint8Array,
  width: number,
  height: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: ParsedColor,
  opacity: number
): void {
  const dx = Math.abs(x2 - x1);
  const dy = Math.abs(y2 - y1);
  const sx = x1 < x2 ? 1 : -1;
  const sy = y1 < y2 ? 1 : -1;
  let err = dx - dy;

  let x = x1;
  let y = y1;

  while (true) {
    if (x >= 0 && x < width && y >= 0 && y < height) {
      const existingColor = getPixel(pixels, x, y, width);
      const blended = blendOver(existingColor, color, opacity);
      setPixel(pixels, x, y, width, blended);
    }

    if (x === x2 && y === y2) break;

    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
}

/**
 * Apply moss overlay - green organic patches.
 */
function applyMossOverlay(
  pixels: Uint8Array,
  width: number,
  height: number,
  color: ParsedColor,
  density: number,
  rng: SeededRandom
): void {
  const numPatches = Math.floor(density * 6) + 1;

  for (let i = 0; i < numPatches; i++) {
    const cx = rng.nextInt(0, width - 1);
    const cy = rng.nextInt(0, height - 1);
    const radius = rng.nextInt(1, 3);

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const x = cx + dx;
        const y = cy + dy;

        if (x >= 0 && x < width && y >= 0 && y < height) {
          // Irregular shape with random fill
          if (rng.next() < 0.6 && dx * dx + dy * dy <= radius * radius) {
            // Vary the green color slightly
            const variedColor: ParsedColor = {
              r: color.r + rng.nextInt(-10, 10),
              g: Math.min(255, color.g + rng.nextInt(-20, 20)),
              b: color.b + rng.nextInt(-10, 10),
              a: color.a,
            };
            const existingColor = getPixel(pixels, x, y, width);
            const blended = blendOver(existingColor, variedColor, 0.6);
            setPixel(pixels, x, y, width, blended);
          }
        }
      }
    }
  }
}

/**
 * Apply rust overlay - orange/brown oxidation spots.
 */
function applyRustOverlay(
  pixels: Uint8Array,
  width: number,
  height: number,
  color: ParsedColor,
  density: number,
  rng: SeededRandom
): void {
  const numSpots = Math.floor(density * 10) + 2;

  for (let i = 0; i < numSpots; i++) {
    const cx = rng.nextInt(0, width - 1);
    const cy = rng.nextInt(0, height - 1);
    const size = rng.nextInt(1, 2);

    for (let dy = -size; dy <= size; dy++) {
      for (let dx = -size; dx <= size; dx++) {
        const x = cx + dx;
        const y = cy + dy;

        if (x >= 0 && x < width && y >= 0 && y < height && rng.next() < 0.7) {
          // Vary the rust color
          const variedColor: ParsedColor = {
            r: Math.min(255, color.r + rng.nextInt(-20, 20)),
            g: Math.max(0, color.g + rng.nextInt(-20, 10)),
            b: Math.max(0, color.b + rng.nextInt(-10, 10)),
            a: color.a,
          };
          const existingColor = getPixel(pixels, x, y, width);
          const blended = blendOver(existingColor, variedColor, 0.5);
          setPixel(pixels, x, y, width, blended);
        }
      }
    }
  }
}

/**
 * Apply sparkle overlay - bright highlight dots.
 */
function applySparkleOverlay(
  pixels: Uint8Array,
  width: number,
  height: number,
  color: ParsedColor,
  density: number,
  rng: SeededRandom
): void {
  const numSparkles = Math.floor(density * width * height * 0.02) + 1;

  for (let i = 0; i < numSparkles; i++) {
    const x = rng.nextInt(0, width - 1);
    const y = rng.nextInt(0, height - 1);

    // Bright sparkle with slight color variation
    const brightness = 200 + rng.nextInt(0, 55);
    const sparkleColor: ParsedColor = {
      r: brightness,
      g: brightness,
      b: Math.min(255, brightness + rng.nextInt(-20, 20)),
      a: 255,
    };

    const existingColor = getPixel(pixels, x, y, width);
    const blended = blendOver(existingColor, sparkleColor, 0.8);
    setPixel(pixels, x, y, width, blended);
  }
}

/**
 * Apply veins overlay - dark branching lines.
 */
function applyVeinsOverlay(
  pixels: Uint8Array,
  width: number,
  height: number,
  color: ParsedColor,
  density: number,
  rng: SeededRandom
): void {
  const numVeins = Math.floor(density * 3) + 1;

  for (let i = 0; i < numVeins; i++) {
    // Start from edge
    let x = rng.next() < 0.5 ? 0 : width - 1;
    let y = rng.nextInt(0, height - 1);

    const direction = x === 0 ? 1 : -1;
    const length = rng.nextInt(width / 3, width);

    for (let j = 0; j < length; j++) {
      if (x >= 0 && x < width && y >= 0 && y < height) {
        const existingColor = getPixel(pixels, x, y, width);
        const blended = blendOver(existingColor, color, 0.6);
        setPixel(pixels, x, y, width, blended);
      }

      // Move with branching tendency
      x += direction;
      if (rng.next() < 0.3) {
        y += rng.next() < 0.5 ? -1 : 1;
      }

      // Occasional branch
      if (rng.next() < 0.1) {
        const branchY = y;
        let branchX = x;
        const branchDir = rng.next() < 0.5 ? -1 : 1;
        for (let k = 0; k < rng.nextInt(2, 5); k++) {
          const by = branchY + k * branchDir;
          if (branchX >= 0 && branchX < width && by >= 0 && by < height) {
            const existingColor = getPixel(pixels, branchX, by, width);
            const blended = blendOver(existingColor, color, 0.4);
            setPixel(pixels, branchX, by, width, blended);
          }
          branchX += direction;
        }
      }
    }
  }
}

// ============================================================================
// COLOR VARIATION EFFECTS
// ============================================================================

/**
 * Apply color variation effect to pixel buffer.
 */
export function applyColorVariationEffect(
  pixels: Uint8Array,
  width: number,
  height: number,
  effect: IColorVariationEffect
): void {
  const amount = effect.amount ?? 0.1;
  const rng = new SeededRandom(effect.seed ?? 98765);

  // Parse palette colors if provided
  let paletteColors: ParsedColor[] = [];
  if (effect.palette) {
    paletteColors = effect.palette.map((c) => NoiseGenerationUtilities.parseColorInput(c));
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const color = getPixel(pixels, x, y, width);
      if (color.a === 0) continue;

      let newColor: ParsedColor;

      switch (effect.mode) {
        case "hue_shift":
          {
            const hsv = rgbToHsv(color);
            hsv.h = (hsv.h + (rng.next() - 0.5) * amount) % 1;
            if (hsv.h < 0) hsv.h += 1;
            newColor = hsvToRgb(hsv.h, hsv.s, hsv.v, color.a);
          }
          break;

        case "saturation_jitter":
          {
            const hsv = rgbToHsv(color);
            hsv.s = Math.max(0, Math.min(1, hsv.s + (rng.next() - 0.5) * amount * 2));
            newColor = hsvToRgb(hsv.h, hsv.s, hsv.v, color.a);
          }
          break;

        case "value_jitter":
          {
            const hsv = rgbToHsv(color);
            hsv.v = Math.max(0, Math.min(1, hsv.v + (rng.next() - 0.5) * amount * 2));
            newColor = hsvToRgb(hsv.h, hsv.s, hsv.v, color.a);
          }
          break;

        case "palette_snap":
          if (paletteColors.length > 0) {
            // Find nearest palette color
            let nearest = paletteColors[0];
            let nearestDist = colorDistance(color, nearest);

            for (let i = 1; i < paletteColors.length; i++) {
              const dist = colorDistance(color, paletteColors[i]);
              if (dist < nearestDist) {
                nearest = paletteColors[i];
                nearestDist = dist;
              }
            }

            newColor = { ...nearest, a: color.a };
          } else {
            newColor = color;
          }
          break;

        default:
          newColor = color;
      }

      setPixel(pixels, x, y, width, newColor);
    }
  }
}

// ============================================================================
// TILING EFFECTS
// ============================================================================

/**
 * Apply tiling effect to pixel buffer.
 * Makes textures seamless or applies tiling patterns.
 */
export function applyTilingEffect(pixels: Uint8Array, width: number, height: number, effect: ITilingEffect): void {
  // Apply seamless blending if requested
  if (effect.seamless) {
    makeSeamless(pixels, width, height);
  }

  // Note: Pattern tiling would typically be applied during texture generation
  // rather than as a post-process. This could be expanded in the future.
}

/**
 * Make texture seamless by blending edges.
 */
function makeSeamless(pixels: Uint8Array, width: number, height: number): void {
  const blendWidth = Math.max(1, Math.floor(Math.min(width, height) / 4));

  // Create a copy for reading while we write
  const original = new Uint8Array(pixels);

  // Blend horizontal seam (left-right)
  for (let y = 0; y < height; y++) {
    for (let i = 0; i < blendWidth; i++) {
      const t = i / blendWidth;

      // Left edge blends with right side
      const leftIdx = getPixelIndex(i, y, width);
      const rightMirrorIdx = getPixelIndex(width - 1 - i, y, width);

      // Right edge blends with left side
      const rightIdx = getPixelIndex(width - 1 - i, y, width);
      const leftMirrorIdx = getPixelIndex(i, y, width);

      // Blend colors
      for (let c = 0; c < 4; c++) {
        pixels[leftIdx + c] = Math.round(original[leftIdx + c] * t + original[rightMirrorIdx + c] * (1 - t));
        pixels[rightIdx + c] = Math.round(original[rightIdx + c] * t + original[leftMirrorIdx + c] * (1 - t));
      }
    }
  }

  // Update original for vertical pass
  original.set(pixels);

  // Blend vertical seam (top-bottom)
  for (let x = 0; x < width; x++) {
    for (let i = 0; i < blendWidth; i++) {
      const t = i / blendWidth;

      // Top edge blends with bottom side
      const topIdx = getPixelIndex(x, i, width);
      const bottomMirrorIdx = getPixelIndex(x, height - 1 - i, width);

      // Bottom edge blends with top side
      const bottomIdx = getPixelIndex(x, height - 1 - i, width);
      const topMirrorIdx = getPixelIndex(x, i, width);

      // Blend colors
      for (let c = 0; c < 4; c++) {
        pixels[topIdx + c] = Math.round(original[topIdx + c] * t + original[bottomMirrorIdx + c] * (1 - t));
        pixels[bottomIdx + c] = Math.round(original[bottomIdx + c] * t + original[topMirrorIdx + c] * (1 - t));
      }
    }
  }
}

// ============================================================================
// MAIN EFFECT APPLICATION
// ============================================================================

/**
 * Apply all texture effects to a pixel buffer in the correct order.
 *
 * Order of application:
 * 1. Color variation (modifies base colors)
 * 2. Lighting (adds depth based on position)
 * 3. Overlays (adds surface detail)
 * 4. Borders (adds edge definition)
 * 5. Tiling (makes seamless)
 *
 * @param pixels RGBA pixel buffer to modify in-place
 * @param width Buffer width
 * @param height Buffer height
 * @param effects Effects configuration
 */
export function applyTextureEffects(pixels: Uint8Array, width: number, height: number, effects: ITextureEffects): void {
  // 1. Color variation first (affects base colors for other effects)
  if (effects.colorVariation) {
    applyColorVariationEffect(pixels, width, height, effects.colorVariation);
  }

  // 2. Lighting (position-based shading)
  if (effects.lighting) {
    applyLightingEffect(pixels, width, height, effects.lighting);
  }

  // 3. Overlays (surface detail)
  if (effects.overlay) {
    const overlays = Array.isArray(effects.overlay) ? effects.overlay : [effects.overlay];
    for (const overlay of overlays) {
      applyOverlayEffect(pixels, width, height, overlay);
    }
  }

  // 4. Borders (edge definition) - after overlays so they're on top
  if (effects.border) {
    applyBorderEffect(pixels, width, height, effects.border);
  }

  // 5. Tiling (seamless edges) - last to blend everything
  if (effects.tiling) {
    applyTilingEffect(pixels, width, height, effects.tiling);
  }
}
