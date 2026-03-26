// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * MCP Model Design Format
 *
 * This file defines the intermediary format for AI-assisted 3D model design.
 * It uses a per-face specification that is intuitive for AI reasoning while
 * being straightforward to convert to Minecraft's .geo.json format.
 *
 * Key design principles:
 * 1. Each bone contains cubes, each cube has 6 faces
 * 2. Faces can be colored with solid colors or SVG content
 * 3. SVG content is tiled into a texture atlas automatically
 * 4. UV coordinates are computed based on atlas layout
 */

// Re-export effect types for convenient access
export type {
  ITextureEffects,
  ILightingEffect,
  LightingPreset,
  IBorderEffect,
  IBorderSide,
  BorderStyle,
  IOverlayEffect,
  OverlayPattern,
  IColorVariationEffect,
  ColorVariationMode,
  ITilingEffect,
  TilingPattern,
} from "./TextureEffects";

/**
 * A single color in RGBA format (0-255 for each channel)
 */
export interface IMcpColorRGBA {
  r: number; // 0-255
  g: number; // 0-255
  b: number; // 0-255
  a?: number; // 0-255, defaults to 255 (fully opaque)
}

/**
 * Textured rectangle fill type - defines how a rectangular area is filled with color/pattern.
 * This unified concept replaces separate "color" and "noise" properties for easier AI reasoning.
 */
export type TexturedRectangleType =
  | "solid" // Solid color fill - uses first color in colors array
  | "random_noise" // Simple random noise - each pixel randomly picks from colors
  | "dither_noise" // Ordered dithering using Bayer matrix - creates regular pattern
  | "perlin_noise" // Perlin-like noise - smoother, organic-looking variation
  | "stipple_noise" // Stipple pattern - dots/spots scattered on base color
  | "gradient"; // Gradient - smooth transition between colors

/**
 * @deprecated Use TexturedRectangleType instead. This alias is for backwards compatibility.
 */
export type NoisePatternType = "random" | "dither" | "perlin" | "stipple" | "gradient";

/**
 * Textured rectangle configuration for procedural Minecraft-style textures.
 * A unified way to specify how a rectangular area should be filled.
 *
 * Examples:
 * - Solid red: { type: "solid", colors: ["#FF0000"] }
 * - Stone texture: { type: "stipple_noise", colors: ["#8B8B8B", "#7A7A7A"], seed: 123 }
 * - Wood grain: { type: "dither_noise", colors: ["#8B4513", "#A0522D"], seed: 456 }
 */
export interface IMcpTexturedRectangle {
  /**
   * The fill algorithm to use.
   * - "solid": Solid color fill using the first color
   * - "random_noise": Random pixel-by-pixel color selection
   * - "dither_noise": Ordered dithering using Bayer matrix pattern
   * - "perlin_noise": Smooth organic Perlin-like noise
   * - "stipple_noise": Scattered dots/spots on base color (best for organic materials)
   * - "gradient": Smooth transition between colors
   */
  type: TexturedRectangleType;

  /**
   * Array of colors to use. For "solid", only the first color is used.
   * For noise types, provide 2+ colors for richer textures.
   * Colors can be hex strings ("#FF0000") or rgb strings ("rgb(255,0,0)").
   */
  colors: (string | IMcpColorRGBA)[];

  /**
   * Noise intensity/factor from 0 to 1. Default is 0.2.
   * - 0: Minimal noise variation
   * - 0.5: Balanced mix of colors
   * - 1: Maximum noise variation
   * Only applies to noise types, ignored for "solid".
   */
  factor?: number;

  /**
   * Random seed for deterministic noise generation.
   * If not provided, a seed is generated from a hash of the texture context.
   * Only applies to noise types, ignored for "solid".
   */
  seed?: number;

  /**
   * Pixel size for the noise pattern. Default is 1.
   * Higher values create blockier/chunkier noise patterns.
   * Only applies to noise types, ignored for "solid".
   */
  pixelSize?: number;

  /**
   * Scale factor for Perlin noise. Default is 4.
   * Higher values create smaller/tighter noise patterns.
   * Only applies to "perlin_noise" type.
   */
  scale?: number;

  /**
   * Post-processing effects to apply to the generated texture.
   * Effects are applied in order: colorVariation -> lighting -> overlay -> border -> tiling.
   *
   * Example - weathered stone with inset lighting:
   * ```json
   * {
   *   "type": "stipple_noise",
   *   "colors": ["#808080", "#707070"],
   *   "effects": {
   *     "lighting": { "preset": "inset", "intensity": 0.3 },
   *     "overlay": { "pattern": "cracks", "density": 0.2 }
   *   }
   * }
   * ```
   */
  effects?: import("./TextureEffects").ITextureEffects;
}

/**
 * @deprecated Use IMcpTexturedRectangle instead. This interface is for backwards compatibility.
 */
export interface IMcpNoiseConfig {
  pattern?: NoisePatternType;
  colors: (string | IMcpColorRGBA)[];
  factor?: number;
  seed?: number;
  pixelSize?: number;
  scale?: number;
}

/**
 * A single pixel color for pixel art.
 * Specify color using EITHER r/g/b values (0-255) OR hex string.
 */
export interface IMcpPixelColor {
  /** Red channel (0-255) */
  r?: number;
  /** Green channel (0-255) */
  g?: number;
  /** Blue channel (0-255) */
  b?: number;
  /** Alpha channel (0-255, default 255 = opaque) */
  a?: number;
  /** Alternative: hex color string like "#FF0000" or "#FF0000FF" */
  hex?: string;
}

/**
 * Pixel art overlay for face textures.
 *
 * Uses ASCII art patterns where each character maps to a color in the palette.
 * This format is optimized for AI readability - the pattern is visible in the text itself.
 *
 * Example - A creeper face:
 * ```json
 * {
 *   "x": 1, "y": 2,
 *   "lines": [
 *     "B BB B",
 *     "B BB B",
 *     "  BB  ",
 *     " BBBB ",
 *     " B  B "
 *   ],
 *   "palette": {
 *     "B": { "r": 0, "g": 0, "b": 0 }
 *   }
 * }
 * ```
 *
 * Rules:
 * - Space character (' ') is always transparent (not drawn)
 * - Lines can be different lengths - shorter lines are right-padded with transparent pixels
 * - Any printable ASCII character can be used as a palette key
 * - Palette colors support RGBA (0-255) or hex strings
 */
/**
 * Scale mode for pixel art rendering.
 * - "unit": Each character represents 1 Minecraft unit, scaled by pixelsPerUnit (default)
 * - "exact": Each character is exactly 1 pixel, no scaling
 * - "cover": Pixel art is scaled to completely cover the face texture
 */
export type IMcpPixelArtScaleMode = "unit" | "exact" | "cover";

export interface IMcpPixelArt {
  /**
   * How to scale the pixel art relative to the face texture.
   *
   * - "unit" (default): Each character = 1 Minecraft unit. Scaled by pixelsPerUnit.
   *   An 8×10 character grid on an 8×10 unit face fills it completely.
   *   x/y offsets are in Minecraft units.
   *
   * - "exact": Each character = exactly 1 pixel. No scaling applied.
   *   Use for precise pixel-level control.
   *   x/y offsets are in pixels.
   *
   * - "cover": Pixel art is stretched to completely cover the face texture.
   *   x/y offsets are ignored.
   */
  scaleMode?: IMcpPixelArtScaleMode;

  /**
   * X offset from the left edge of the face texture.
   * Units depend on scaleMode:
   * - "unit" (default): Minecraft units (scaled by pixelsPerUnit)
   * - "exact": Pixels
   * - "cover": Ignored
   * Default: 0
   */
  x?: number;

  /**
   * Y offset from the top edge of the face texture.
   * Units depend on scaleMode:
   * - "unit" (default): Minecraft units (scaled by pixelsPerUnit)
   * - "exact": Pixels
   * - "cover": Ignored
   * Default: 0
   */
  y?: number;

  /**
   * Array of strings representing rows of pixels from top to bottom.
   * Each character is looked up in the palette.
   * Space (' ') is always transparent.
   *
   * Example for a 5x3 pattern:
   * ["XXXXX", " XXX ", "  X  "]
   */
  lines: string[];

  /**
   * Color palette mapping characters to RGBA colors.
   * Space (' ') should not be defined - it's always transparent.
   *
   * Example:
   * {
   *   "X": { "r": 255, "g": 0, "b": 0 },
   *   "O": { "hex": "#00FF00" }
   * }
   */
  palette: { [char: string]: IMcpPixelColor };
}

/**
 * Converts legacy IMcpNoiseConfig to IMcpTexturedRectangle.
 */
export function convertNoiseConfigToTexturedRectangle(noise: IMcpNoiseConfig): IMcpTexturedRectangle {
  const patternToType: { [key: string]: TexturedRectangleType } = {
    random: "random_noise",
    dither: "dither_noise",
    perlin: "perlin_noise",
    stipple: "stipple_noise",
    gradient: "gradient",
  };
  return {
    type: patternToType[noise.pattern || "random"] || "random_noise",
    colors: noise.colors,
    factor: noise.factor,
    seed: noise.seed,
    pixelSize: noise.pixelSize,
    scale: noise.scale,
  };
}

/**
 * Converts a color string to a solid IMcpTexturedRectangle.
 */
export function colorToTexturedRectangle(color: string | IMcpColorRGBA): IMcpTexturedRectangle {
  return {
    type: "solid",
    colors: [typeof color === "string" ? color : color],
  };
}

/**
 * Texture definition for reuse across multiple faces.
 * Define textures once in the model's `textures` dictionary, then reference by ID.
 */
export interface IMcpTextureDefinition {
  /**
   * @deprecated Use `background` with type: "solid" instead.
   * Solid color fill for this texture.
   * Can be a hex string like "#FF0000" or "rgb(255,0,0)" or an object.
   */
  color?: string | IMcpColorRGBA;

  /**
   * SVG content for this texture. Rendered on top of background.
   * The SVG should be a complete SVG document or fragment.
   * The SVG viewBox determines the texture resolution.
   *
   * Example:
   * "<svg viewBox='0 0 16 16'><rect fill='#ff0000' width='16' height='16'/></svg>"
   */
  svg?: string;

  /**
   * @deprecated Use `background` instead.
   * Noise texture configuration for procedural Minecraft-style textures.
   */
  noise?: IMcpNoiseConfig;

  /**
   * Background fill for this texture using a textured rectangle.
   * Supports solid colors and various noise patterns.
   *
   * Examples:
   * - Solid: { type: "solid", colors: ["#808080"] }
   * - Stone: { type: "stipple_noise", colors: ["#8B8B8B", "#7A7A7A"], seed: 123 }
   *
   * Priority: background -> svg (overlay) -> color (fallback for backwards compat)
   */
  background?: IMcpTexturedRectangle;

  /**
   * Pixel art overlays rendered on top of background and svg.
   * Each pixel art layer is rendered in array order (first = bottom, last = top).
   * Uses ASCII art patterns for AI-friendly specification.
   *
   * Example - simple eyes:
   * ```json
   * [{
   *   "x": 2, "y": 2,
   *   "lines": ["O O", "   ", " v "],
   *   "palette": { "O": { "r": 0, "g": 0, "b": 0 }, "v": { "r": 0, "g": 0, "b": 0 } }
   * }]
   * ```
   */
  pixelArt?: IMcpPixelArt[];

  /**
   * Post-processing effects to apply to this texture.
   * Effects are applied after background, svg, and pixelArt rendering.
   *
   * Example:
   * ```json
   * {
   *   "background": { "type": "stipple_noise", "colors": ["#808080", "#707070"] },
   *   "effects": {
   *     "lighting": { "preset": "outset", "intensity": 0.3 },
   *     "border": { "all": { "style": "highlight", "width": 1 } }
   *   }
   * }
   * ```
   */
  effects?: import("./TextureEffects").ITextureEffects;
}

/**
 * Face content specification - reference a texture by ID, or specify inline content.
 * Priority: textureId > background+svg > svg > background > color
 */
export interface IMcpFaceContent {
  /**
   * Reference to a texture defined in the model's `textures` dictionary.
   * If specified, the texture's background/svg will be used for this face.
   * This is the preferred approach for textures used on multiple faces.
   */
  textureId?: string;

  /**
   * @deprecated Use `background` with type: "solid" instead.
   * Solid color fill for this face.
   */
  color?: string | IMcpColorRGBA;

  /**
   * SVG content for this face. Rendered on top of background.
   * The SVG should be a complete SVG document or fragment.
   * The SVG viewBox determines the texture resolution for this face.
   *
   * Example:
   * "<svg viewBox='0 0 16 16'><rect fill='#ff0000' width='16' height='16'/></svg>"
   */
  svg?: string;

  /**
   * @deprecated Use `background` instead.
   * Noise texture configuration for procedural Minecraft-style textures.
   */
  noise?: IMcpNoiseConfig;

  /**
   * Background fill for this face using a textured rectangle.
   * Supports solid colors and various noise patterns.
   *
   * Examples:
   * - Solid: { type: "solid", colors: ["#808080"] }
   * - Grass: { type: "perlin_noise", colors: ["#228B22", "#32CD32"], seed: 456 }
   *
   * Priority: textureId > background+svg > svg > background > color
   */
  background?: IMcpTexturedRectangle;

  /**
   * Pixel art overlays rendered on top of background and svg.
   * Each pixel art layer is rendered in array order (first = bottom, last = top).
   * Uses ASCII art patterns for AI-friendly specification.
   *
   * Example - simple face:
   * ```json
   * [{
   *   "x": 1, "y": 1,
   *   "lines": ["O O", "   ", " U "],
   *   "palette": { "O": { "r": 0, "g": 0, "b": 0 }, "U": { "r": 0, "g": 0, "b": 0 } }
   * }]
   * ```
   */
  pixelArt?: IMcpPixelArt[];

  /**
   * Post-processing effects to apply to this face.
   * Effects are applied after background, svg, and pixelArt rendering.
   * If textureId is used, effects are applied to the resolved texture.
   *
   * Example:
   * ```json
   * {
   *   "background": { "type": "solid", "colors": ["#404040"] },
   *   "effects": {
   *     "lighting": { "preset": "pillow", "intensity": 0.4 }
   *   }
   * }
   * ```
   */
  effects?: import("./TextureEffects").ITextureEffects;

  /**
   * Optional rotation of the face content in degrees.
   * Typically 0, 90, 180, or 270 degrees.
   * Applied after the content is rendered.
   */
  rotation?: number;
}

/**
 * The six faces of a cube
 */
export interface IMcpCubeFaces {
  north?: IMcpFaceContent;
  south?: IMcpFaceContent;
  east?: IMcpFaceContent;
  west?: IMcpFaceContent;
  up?: IMcpFaceContent;
  down?: IMcpFaceContent;
}

/**
 * A cube within a bone, with position, size, and per-face content.
 *
 * ROTATION NOTE: Cubes do NOT have pivot/rotation properties in the MCP schema.
 * All rotation should be done at the BONE level. If you need a rotated cube,
 * place it in its own single-cube bone and rotate that bone. This simplifies
 * the model structure and avoids confusion about which rotation applies where.
 */
export interface IMcpDesignCube {
  /**
   * The origin (corner) of the cube in Minecraft coordinates.
   * [x, y, z] where y is up.
   */
  origin: [number, number, number];

  /**
   * The size of the cube in [width, height, depth].
   */
  size: [number, number, number];

  /**
   * Per-face content specification.
   * Faces not specified will be transparent.
   */
  faces: IMcpCubeFaces;

  /**
   * Optional inflation value (expands cube by this amount on all sides).
   */
  inflate?: number;

  /**
   * If true, mirror the UV coordinates for this cube.
   */
  mirror?: boolean;
}

/**
 * A bone in the model hierarchy, containing cubes and optional child bones.
 *
 * ROTATION: All rotation in MCP models is done at the BONE level, not cube level.
 * Use `pivot` to set the rotation point (e.g., shoulder for an arm) and `rotation`
 * to rotate the bone. Child bones and all cubes in the bone rotate together.
 */
export interface IMcpDesignBone {
  /**
   * Unique name for this bone within the model
   */
  name: string;

  /**
   * Optional parent bone name for hierarchical models.
   * Child bones rotate with their parent.
   */
  parent?: string;

  /**
   * The pivot point for rotation of this bone and its children.
   * [x, y, z] in Minecraft coordinates.
   * Example: For an arm, set pivot at the shoulder joint.
   */
  pivot?: [number, number, number];

  /**
   * Rotation of the entire bone in degrees [x, y, z].
   * The bone rotates around its pivot point.
   * All cubes in the bone and child bones rotate together.
   */
  rotation?: [number, number, number];

  /**
   * The cubes that make up this bone's geometry
   */
  cubes: IMcpDesignCube[];

  /**
   * Whether to mirror texture UVs for this bone
   */
  mirror?: boolean;
}

/**
 * The complete model design input for MCP tools
 */
export interface IMcpModelDesign {
  /**
   * Format version for the design format. Currently "1.0.0".
   */
  formatVersion?: string;

  /**
   * The identifier for this model (e.g., "geometry.custom_entity").
   * Will be prefixed with "geometry." if not already.
   */
  identifier: string;

  /**
   * Optional description of the model
   */
  description?: string;

  /**
   * Texture resolution for the generated atlas.
   * Default is [64, 64] for item-sized models.
   * Use [64, 64], [128, 128], [256, 256] for increasing detail.
   */
  textureSize?: [number, number];

  /**
   * Pixels per Minecraft unit for texture generation.
   * This controls texture resolution: pixelsPerUnit × 16 = pixels per block.
   *
   * Common values:
   * - 1: 16 pixels per block (vanilla Minecraft resolution)
   * - 2: 32 pixels per block (default, HD textures)
   * - 4: 64 pixels per block (high-resolution textures)
   *
   * Default: 2 (32 pixels per block)
   */
  pixelsPerUnit?: number;

  /**
   * Named texture definitions that can be referenced by faces using textureId.
   * This allows texture reuse across multiple faces, reducing token usage and
   * enabling automatic atlas optimization (shared textures use the same UV region).
   *
   * Example:
   * ```
   * textures: {
   *   "wood_grain": { svg: "<svg>...</svg>" },
   *   "bark": { color: "#4a3728" }
   * }
   * ```
   * Then reference in faces: `{ textureId: "wood_grain" }`
   */
  textures?: { [textureId: string]: IMcpTextureDefinition };

  /**
   * The visible bounding box of the model.
   * [width, height] in Minecraft units.
   * Used for culling and shadow calculations.
   */
  visibleBoundsSize?: [number, number, number];

  /**
   * Offset for the visible bounds from origin.
   */
  visibleBoundsOffset?: [number, number, number];

  /**
   * The bones that make up this model
   */
  bones: IMcpDesignBone[];
}

/**
 * Options for the previewModelDesign tool
 */
export interface IMcpModelPreviewOptions {
  /**
   * Width of the preview image in pixels. Default: 512
   */
  width?: number;

  /**
   * Height of the preview image in pixels. Default: 512
   */
  height?: number;

  /**
   * Camera distance from the model. Default: auto-calculated from model size
   */
  cameraDistance?: number;

  /**
   * Camera rotation angle (horizontal). Default: 0.8 radians
   */
  cameraAlpha?: number;

  /**
   * Camera rotation angle (vertical). Default: 1.0 radians
   */
  cameraBeta?: number;

  /**
   * Background color for the preview. Default: transparent
   */
  backgroundColor?: string | IMcpColorRGBA;

  /**
   * When true, renders the model from multiple angles in a side-by-side grid.
   * Each view is labeled with its angle name.
   * Default: false (single angle render)
   */
  multiAngle?: boolean;

  /**
   * Which angle presets to include in multi-angle mode.
   * Default: ["front-right", "back-left"] for 2-view layout
   * Available presets: "front-right", "front-left", "back-right", "back-left", "top-down", "side-right", "side-left"
   */
  anglePresets?: string[];
}

/**
 * Result from the previewModelDesign tool
 */
export interface IMcpModelPreviewResult {
  /**
   * Base64-encoded PNG image of the preview
   */
  previewImage?: string;

  /**
   * MIME type of the preview image (always "image/png")
   */
  mimeType?: string;

  /**
   * Generated geometry JSON (for debugging)
   */
  geometryJson?: object;

  /**
   * Any errors or warnings encountered
   */
  errors?: string[];
  warnings?: string[];
}

/**
 * Options for the exportModelDesign tool
 */
export interface IMcpModelExportOptions {
  /**
   * Path to write the .geo.json file
   */
  geometryOutputPath: string;

  /**
   * Path to write the texture.png file
   */
  textureOutputPath: string;

  /**
   * If true, overwrite existing files. Default: false
   */
  overwrite?: boolean;

  /**
   * If true, also generate a preview image alongside the exported files
   */
  generatePreview?: boolean;

  /**
   * Path for the preview image if generatePreview is true
   */
  previewOutputPath?: string;
}

/**
 * Result from the exportModelDesign tool
 */
export interface IMcpModelExportResult {
  /**
   * Whether the export was successful
   */
  success: boolean;

  /**
   * Paths of files that were written
   */
  filesWritten: string[];

  /**
   * The generated geometry JSON
   */
  geometryJson?: object;

  /**
   * Any errors or warnings encountered
   */
  errors?: string[];
  warnings?: string[];
}
