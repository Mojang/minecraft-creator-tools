// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * ModelDesignUtilities
 *
 * Converts MCP model design format to Minecraft .geo.json format
 * and generates texture atlases from per-face SVG/color specifications.
 */

import {
  IMcpModelDesign,
  IMcpFaceContent,
  IMcpColorRGBA,
  IMcpTextureDefinition,
  IMcpNoiseConfig,
  IMcpTexturedRectangle,
  IMcpPixelArt,
  convertNoiseConfigToTexturedRectangle,
  colorToTexturedRectangle,
} from "./IMcpModelDesign";
import IModelGeometry, { IGeometry, IGeometryBone, IGeometryBoneCube, IGeometryUVFaces } from "./IModelGeometry";
import TexturedRectangleGenerator from "./TexturedRectangleGenerator";

/**
 * Represents a region in the texture atlas for a cube face
 */
export interface IAtlasRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  content: IMcpFaceContent;
  faceName: string;
  cubeIndex: number;
  boneIndex: number;
  /** Context string for deterministic noise seeding (e.g., "bone0:cube1:north") */
  contextString?: string;
  /** If true, this region shares atlas space with another region and should not be rendered */
  isDuplicate?: boolean;
}

/**
 * Result from converting an MCP design to geometry
 */
export interface IModelDesignConversionResult {
  /**
   * The converted Minecraft geometry JSON
   */
  geometry: IModelGeometry;

  /**
   * Atlas regions for generating the texture
   */
  atlasRegions: IAtlasRegion[];

  /**
   * Total texture size [width, height]
   */
  textureSize: [number, number];

  /**
   * Pixels per Minecraft unit used for texture generation.
   * Needed by pixel art renderer to scale properly.
   */
  pixelsPerUnit: number;

  /**
   * Any warnings during conversion
   */
  warnings: string[];

  /**
   * Map from content hash to atlas region index, for texture deduplication
   */
  textureDeduplicationMap?: Map<string, number>;
}

/**
 * Resolved face content after texture ID lookup.
 * Contains the actual svg/color/background to render (textureId is resolved away).
 */
export interface IResolvedFaceContent {
  /** @deprecated Use background with type:'solid' instead */
  color?: string | IMcpColorRGBA;
  svg?: string;
  /** @deprecated Use background instead */
  noise?: IMcpNoiseConfig;
  /** Background fill using a textured rectangle (unified color/noise format) */
  background?: IMcpTexturedRectangle;
  /** Pixel art overlays to render on top of background and svg */
  pixelArt?: IMcpPixelArt[];
  /** Post-processing effects to apply to the face texture */
  effects?: import("./TextureEffects").ITextureEffects;
  rotation?: number;
  /** The original textureId if this was resolved from a reference */
  sourceTextureId?: string;
}

/**
 * Default pixels per Minecraft unit.
 * Standard Minecraft textures use 1 pixel per unit (16x16 texture for a 16-unit cube).
 * We default to 2 pixels per unit (32x32 texture per block) for HD quality.
 */
const DEFAULT_PIXELS_PER_UNIT = 2;

/**
 * Bounding box for a model design
 */
export interface IModelBounds {
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
  /** Maximum dimension (width, height, or depth) */
  maxDimension: number;
  /** Center point of the bounding box */
  center: { x: number; y: number; z: number };
}

/**
 * Utility class for working with MCP model designs
 */
export default class ModelDesignUtilities {
  /**
   * Calculate the bounding box of a model design.
   * Iterates through all bones and cubes to find the min/max extents.
   */
  static calculateModelBounds(design: IMcpModelDesign): IModelBounds {
    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;

    for (const bone of design.bones) {
      for (const cube of bone.cubes) {
        const [ox, oy, oz] = cube.origin;
        const [sx, sy, sz] = cube.size;

        // Cube extends from origin to origin + size
        minX = Math.min(minX, ox);
        minY = Math.min(minY, oy);
        minZ = Math.min(minZ, oz);
        maxX = Math.max(maxX, ox + sx);
        maxY = Math.max(maxY, oy + sy);
        maxZ = Math.max(maxZ, oz + sz);
      }
    }

    // Handle empty models
    if (minX === Infinity) {
      minX = minY = minZ = 0;
      maxX = maxY = maxZ = 1;
    }

    const width = maxX - minX;
    const height = maxY - minY;
    const depth = maxZ - minZ;
    const maxDimension = Math.max(width, height, depth);

    return {
      minX,
      minY,
      minZ,
      maxX,
      maxY,
      maxZ,
      maxDimension,
      center: {
        x: (minX + maxX) / 2,
        y: (minY + maxY) / 2,
        z: (minZ + maxZ) / 2,
      },
    };
  }
  /**
   * Parse a color string or object to RGBA values (0-255)
   */
  static parseColor(color: string | IMcpColorRGBA | undefined): IMcpColorRGBA {
    if (!color) {
      return { r: 255, g: 255, b: 255, a: 255 };
    }

    if (typeof color === "object") {
      return {
        r: Math.max(0, Math.min(255, Math.round(color.r))),
        g: Math.max(0, Math.min(255, Math.round(color.g))),
        b: Math.max(0, Math.min(255, Math.round(color.b))),
        a: color.a !== undefined ? Math.max(0, Math.min(255, Math.round(color.a))) : 255,
      };
    }

    // Parse hex color
    if (color.startsWith("#")) {
      const hex = color.slice(1);
      if (hex.length === 3) {
        // Short form #RGB
        return {
          r: parseInt(hex[0] + hex[0], 16),
          g: parseInt(hex[1] + hex[1], 16),
          b: parseInt(hex[2] + hex[2], 16),
          a: 255,
        };
      } else if (hex.length === 6) {
        // Full form #RRGGBB
        return {
          r: parseInt(hex.slice(0, 2), 16),
          g: parseInt(hex.slice(2, 4), 16),
          b: parseInt(hex.slice(4, 6), 16),
          a: 255,
        };
      } else if (hex.length === 8) {
        // With alpha #RRGGBBAA
        return {
          r: parseInt(hex.slice(0, 2), 16),
          g: parseInt(hex.slice(2, 4), 16),
          b: parseInt(hex.slice(4, 6), 16),
          a: parseInt(hex.slice(6, 8), 16),
        };
      }
    }

    // Parse rgb/rgba format
    const rgbaMatch = color.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/i);
    if (rgbaMatch) {
      return {
        r: parseInt(rgbaMatch[1], 10),
        g: parseInt(rgbaMatch[2], 10),
        b: parseInt(rgbaMatch[3], 10),
        a: rgbaMatch[4] ? Math.round(parseFloat(rgbaMatch[4]) * 255) : 255,
      };
    }

    // Default to white if parsing fails
    return { r: 255, g: 255, b: 255, a: 255 };
  }

  /**
   * Convert color to hex string
   */
  static colorToHex(color: IMcpColorRGBA): string {
    const r = color.r.toString(16).padStart(2, "0");
    const g = color.g.toString(16).padStart(2, "0");
    const b = color.b.toString(16).padStart(2, "0");
    return `#${r}${g}${b}`;
  }

  /**
   * Resolve face content by looking up textureId references.
   * Returns the actual svg/color content to render.
   * Priority: textureId > svg > color
   *
   * @param faceContent The face content which may contain a textureId reference
   * @param textures The texture dictionary from the model design
   * @param warnings Array to collect any warnings (e.g., missing texture references)
   * @returns Resolved content with svg/color, or undefined if face should be transparent
   */
  static resolveFaceContent(
    faceContent: IMcpFaceContent | undefined,
    textures: { [textureId: string]: IMcpTextureDefinition } | undefined,
    warnings: string[]
  ): IResolvedFaceContent | undefined {
    if (!faceContent) {
      return undefined;
    }

    // If textureId is specified, look it up
    if (faceContent.textureId) {
      if (!textures) {
        warnings.push(
          `Face references textureId "${faceContent.textureId}" but no textures dictionary is defined in the model.`
        );
        // Fall through to check for inline content
      } else {
        const texture = textures[faceContent.textureId];
        if (!texture) {
          warnings.push(
            `Face references textureId "${faceContent.textureId}" which is not defined in the textures dictionary.`
          );
          // Fall through to check for inline content
        } else {
          // Successfully resolved texture reference
          // Priority: background > noise > color (face overrides texture)
          const resolvedBackground = faceContent.background || texture.background;
          const resolvedNoise = faceContent.noise || texture.noise;
          const resolvedColor = texture.color;
          // Merge pixelArt: face pixelArt comes after texture pixelArt (renders on top)
          const resolvedPixelArt = [...(texture.pixelArt || []), ...(faceContent.pixelArt || [])];
          // Merge effects: face effects override texture effects per-property
          const resolvedEffects =
            texture.effects || faceContent.effects
              ? {
                  ...texture.effects,
                  ...faceContent.effects,
                }
              : undefined;

          // Normalize to background if possible (for consistent handling downstream)
          let normalizedBackground = resolvedBackground;
          if (!normalizedBackground && resolvedNoise) {
            normalizedBackground = convertNoiseConfigToTexturedRectangle(resolvedNoise);
          } else if (!normalizedBackground && resolvedColor) {
            normalizedBackground = colorToTexturedRectangle(resolvedColor);
          }

          return {
            color: resolvedColor,
            svg: texture.svg,
            noise: resolvedNoise,
            background: normalizedBackground,
            pixelArt: resolvedPixelArt.length > 0 ? resolvedPixelArt : undefined,
            effects: resolvedEffects,
            rotation: faceContent.rotation,
            sourceTextureId: faceContent.textureId,
          };
        }
      }
    }

    // No textureId or failed lookup - use inline content
    // Priority: background > noise > color
    if (
      faceContent.svg ||
      faceContent.color ||
      faceContent.noise ||
      faceContent.background ||
      faceContent.pixelArt ||
      faceContent.effects
    ) {
      // Normalize to background if possible
      let normalizedBackground = faceContent.background;
      if (!normalizedBackground && faceContent.noise) {
        normalizedBackground = convertNoiseConfigToTexturedRectangle(faceContent.noise);
      } else if (!normalizedBackground && faceContent.color) {
        normalizedBackground = colorToTexturedRectangle(faceContent.color);
      }

      return {
        color: faceContent.color,
        svg: faceContent.svg,
        noise: faceContent.noise,
        background: normalizedBackground,
        pixelArt: faceContent.pixelArt,
        effects: faceContent.effects,
        rotation: faceContent.rotation,
      };
    }

    // No content at all
    return undefined;
  }

  /**
   * Generate a content hash for a resolved face content.
   * Used for texture deduplication - faces with identical content can share atlas regions.
   * Note: rotation is NOT included in hash since it's applied at UV time, not texture time.
   * Note: backgrounds with undefined/random seed create unique textures per face (not deduplicated).
   */
  static getContentHash(content: IResolvedFaceContent): string {
    // If there's a sourceTextureId and no face-specific overrides, use that as a quick hash
    if (content.sourceTextureId && !content.noise && !content.background) {
      return `texref:${content.sourceTextureId}`;
    }

    // Build hash from all content components
    const parts: string[] = [];

    // Prefer background over legacy noise/color for hashing
    if (content.background) {
      // Solid fills are deterministic - they don't need seed for deduplication
      // Noise-based fills need a seed - if not provided, use random to ensure unique textures per face
      const isSolid = content.background.type === "solid";
      const bgHashParts = [`type:${content.background.type}`, `colors:${JSON.stringify(content.background.colors)}`];
      // Only include noise-related params for non-solid types
      if (!isSolid) {
        bgHashParts.push(`factor:${content.background.factor ?? 0.2}`);
        bgHashParts.push(`pixelSize:${content.background.pixelSize ?? 1}`);
        bgHashParts.push(`scale:${content.background.scale ?? 4}`);
        // For noise types: explicit seed means deterministic (can deduplicate), no seed means unique per face
        bgHashParts.push(
          content.background.seed !== undefined ? `seed:${content.background.seed}` : `seed:${Math.random()}`
        );
      }
      parts.push(`bg:{${bgHashParts.join(",")}}`);
    } else if (content.noise) {
      // Legacy noise support
      const noiseHash = [
        `pattern:${content.noise.pattern || "random"}`,
        `colors:${JSON.stringify(content.noise.colors)}`,
        `factor:${content.noise.factor ?? 0.5}`,
        `pixelSize:${content.noise.pixelSize ?? 1}`,
        `scale:${content.noise.scale ?? 4}`,
        content.noise.seed !== undefined ? `seed:${content.noise.seed}` : `seed:${Math.random()}`,
      ].join(",");
      parts.push(`noise:{${noiseHash}}`);
    }

    if (content.svg) {
      parts.push(`svg:${content.svg}`);
    }

    if (content.color && !content.background) {
      // Only include color if no background (for legacy support)
      if (typeof content.color === "string") {
        parts.push(`color:${content.color}`);
      } else {
        parts.push(`color:rgba(${content.color.r},${content.color.g},${content.color.b},${content.color.a ?? 255})`);
      }
    }

    // Pixel art is deterministic - include in hash for deduplication
    if (content.pixelArt && content.pixelArt.length > 0) {
      // Create a stable hash of the pixel art configuration
      const pixelArtHash = content.pixelArt
        .map((pa, i) => {
          const lines = pa.lines.join("|");
          const palette = Object.entries(pa.palette || {})
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}:${v.hex || `${v.r},${v.g},${v.b},${v.a ?? 255}`}`)
            .join(";");
          return `[${i}:x${pa.x || 0}y${pa.y || 0}:${lines}:${palette}]`;
        })
        .join("");
      parts.push(`pixelArt:${pixelArtHash}`);
    }

    if (content.sourceTextureId) {
      parts.push(`texref:${content.sourceTextureId}`);
    }

    return parts.length > 0 ? parts.join("|") : "empty";
  }

  /**
   * Get the effective pixels per unit for a design.
   * Returns the design's pixelsPerUnit if specified, otherwise DEFAULT_PIXELS_PER_UNIT.
   */
  static getPixelsPerUnit(design: IMcpModelDesign): number {
    return design.pixelsPerUnit ?? DEFAULT_PIXELS_PER_UNIT;
  }

  /**
   * Calculate the texture size needed for a face based on cube dimensions.
   * @param cubeSize The cube dimensions [width, height, depth] in Minecraft units
   * @param faceName The face to calculate texture size for
   * @param pixelsPerUnit Pixels per Minecraft unit (default: DEFAULT_PIXELS_PER_UNIT)
   */
  static getFaceTextureSize(
    cubeSize: [number, number, number],
    faceName: string,
    pixelsPerUnit: number = DEFAULT_PIXELS_PER_UNIT
  ): { width: number; height: number } {
    // Face dimensions based on cube size
    // Pixels = units × pixelsPerUnit
    // north/south: width x height
    // east/west: depth x height
    // up/down: width x depth
    const [width, height, depth] = cubeSize;

    switch (faceName) {
      case "north":
      case "south":
        return {
          width: Math.max(1, Math.round(width * pixelsPerUnit)),
          height: Math.max(1, Math.round(height * pixelsPerUnit)),
        };
      case "east":
      case "west":
        return {
          width: Math.max(1, Math.round(depth * pixelsPerUnit)),
          height: Math.max(1, Math.round(height * pixelsPerUnit)),
        };
      case "up":
      case "down":
        return {
          width: Math.max(1, Math.round(width * pixelsPerUnit)),
          height: Math.max(1, Math.round(depth * pixelsPerUnit)),
        };
      default:
        return { width: 1, height: 1 };
    }
  }

  /**
   * Check if a texture size is sufficient for a design by doing a dry-run pack.
   * Returns true if the texture needs to be larger.
   * Takes into account texture deduplication - identical textures at same size share atlas space.
   */
  private static _checkNeedsLargerTexture(design: IMcpModelDesign, textureSize: [number, number]): boolean {
    let currentX = 0;
    let currentY = 0;
    let rowHeight = 0;
    const dummyWarnings: string[] = [];
    const pixelsPerUnit = this.getPixelsPerUnit(design);

    // Track already-packed textures for deduplication
    const packedTextures = new Set<string>();

    for (const bone of design.bones) {
      for (const cube of bone.cubes) {
        for (const faceName of ["north", "south", "east", "west", "up", "down"] as const) {
          const faceContent = cube.faces[faceName];
          if (!faceContent) {
            continue;
          }

          // Resolve texture references
          const resolvedContent = this.resolveFaceContent(faceContent, design.textures, dummyWarnings);
          if (!resolvedContent) {
            continue;
          }

          const faceSize = this.getFaceTextureSize(cube.size, faceName, pixelsPerUnit);

          // Check for deduplication - if we've already packed this exact content at this size, skip
          const contentHash = this.getContentHash(resolvedContent);
          const dedupeKey = `${contentHash}|${faceSize.width}x${faceSize.height}`;
          if (packedTextures.has(dedupeKey)) {
            continue; // This texture will be reused, no new space needed
          }
          packedTextures.add(dedupeKey);

          // Check if we need to wrap to next row
          if (currentX + faceSize.width > textureSize[0]) {
            currentX = 0;
            currentY += rowHeight;
            rowHeight = 0;
          }

          // Check if we're out of vertical space
          if (currentY + faceSize.height > textureSize[1]) {
            return true; // Texture is too small
          }

          currentX += faceSize.width;
          rowHeight = Math.max(rowHeight, faceSize.height);
        }
      }
    }

    return false; // Texture size is sufficient
  }

  /**
   * Convert an MCP model design to Minecraft geometry JSON format
   */
  static convertToGeometry(design: IMcpModelDesign): IModelDesignConversionResult {
    const warnings: string[] = [];
    const atlasRegions: IAtlasRegion[] = [];

    // Ensure identifier has geometry. prefix
    let identifier = design.identifier;
    if (!identifier.startsWith("geometry.")) {
      identifier = `geometry.${identifier}`;
    }

    // First pass: calculate the required texture size by measuring unique faces
    // (accounting for deduplication - identical content at same size only counts once)
    let maxFaceWidth = 0;
    let maxFaceHeight = 0;
    const uniqueFaces = new Set<string>();
    const pixelsPerUnit = this.getPixelsPerUnit(design);

    for (const bone of design.bones) {
      for (const cube of bone.cubes) {
        for (const faceName of ["north", "south", "east", "west", "up", "down"] as const) {
          const faceContent = cube.faces[faceName];
          if (faceContent) {
            const resolvedContent = this.resolveFaceContent(faceContent, design.textures, warnings);
            if (!resolvedContent) {
              continue;
            }

            const faceSize = this.getFaceTextureSize(cube.size, faceName, pixelsPerUnit);

            // Check for deduplication
            const contentHash = this.getContentHash(resolvedContent);
            const dedupeKey = `${contentHash}|${faceSize.width}x${faceSize.height}`;

            if (!uniqueFaces.has(dedupeKey)) {
              uniqueFaces.add(dedupeKey);
              maxFaceWidth = Math.max(maxFaceWidth, faceSize.width);
              maxFaceHeight = Math.max(maxFaceHeight, faceSize.height);
            }
          }
        }
      }
    }

    // Calculate optimal texture size based on actual content
    // Start with the minimum power of 2 that can fit the largest single face
    const minDimension = Math.max(maxFaceWidth, maxFaceHeight);
    let optimalSize = Math.pow(2, Math.ceil(Math.log2(Math.max(16, minDimension))));

    // Verify optimal size fits all faces, expand if needed
    while (this._checkNeedsLargerTexture(design, [optimalSize, optimalSize]) && optimalSize < 4096) {
      optimalSize = optimalSize * 2;
    }

    // Use optimal size if no textureSize specified, or if specified size is larger than optimal
    // Only expand beyond optimal if the specified size is too small
    let textureSize: [number, number];
    if (design.textureSize) {
      // If specified size is too small, expand to fit
      if (this._checkNeedsLargerTexture(design, design.textureSize)) {
        textureSize = [optimalSize, optimalSize];
        warnings.push(
          `Specified texture size ${design.textureSize[0]}x${design.textureSize[1]} was too small. ` +
            `Auto-expanded to ${textureSize[0]}x${textureSize[1]}.`
        );
      } else {
        // Use optimal size (smaller is better for efficiency, but respect user minimum)
        textureSize = [
          Math.min(design.textureSize[0], optimalSize) as number,
          Math.min(design.textureSize[1], optimalSize) as number,
        ] as [number, number];
        // Re-verify the shrunk size works
        while (this._checkNeedsLargerTexture(design, textureSize) && textureSize[0] < 4096) {
          textureSize = [textureSize[0] * 2, textureSize[1] * 2];
        }
      }
    } else {
      textureSize = [optimalSize, optimalSize];
    }

    // Collect all face regions and calculate atlas layout
    let currentX = 0;
    let currentY = 0;
    let rowHeight = 0;
    const padding = 0; // No padding between faces for clean tiling

    // Map for texture deduplication: contentHash+size -> atlas region index
    // Only faces with identical content AND identical size can share a region
    const textureDeduplicationMap = new Map<string, number>();

    for (let boneIndex = 0; boneIndex < design.bones.length; boneIndex++) {
      const bone = design.bones[boneIndex];
      for (let cubeIndex = 0; cubeIndex < bone.cubes.length; cubeIndex++) {
        const cube = bone.cubes[cubeIndex];
        const faces = cube.faces;

        for (const faceName of ["north", "south", "east", "west", "up", "down"] as const) {
          const faceContent = faces[faceName];
          if (!faceContent) {
            continue; // Skip undefined faces
          }

          // Resolve texture references
          const resolvedContent = this.resolveFaceContent(faceContent, design.textures, warnings);
          if (!resolvedContent) {
            continue; // No content to render
          }

          const faceSize = this.getFaceTextureSize(cube.size, faceName, pixelsPerUnit);

          // Check for deduplication opportunity:
          // Faces with identical content AND identical size can share a texture region
          const contentHash = this.getContentHash(resolvedContent);
          const dedupeKey = `${contentHash}|${faceSize.width}x${faceSize.height}`;
          const existingRegionIndex = textureDeduplicationMap.get(dedupeKey);

          // Generate context string for deterministic noise seeding
          const contextString = `${bone.name}:cube${cubeIndex}:${faceName}`;

          if (existingRegionIndex !== undefined) {
            // Reuse existing atlas region - create a new region entry that points to same UV coordinates
            const existingRegion = atlasRegions[existingRegionIndex];
            atlasRegions.push({
              x: existingRegion.x,
              y: existingRegion.y,
              width: faceSize.width,
              height: faceSize.height,
              content: {
                // Store resolved content
                color: resolvedContent.color,
                svg: resolvedContent.svg,
                noise: resolvedContent.noise,
                background: resolvedContent.background,
                pixelArt: resolvedContent.pixelArt,
                effects: resolvedContent.effects,
                rotation: resolvedContent.rotation,
              },
              faceName,
              cubeIndex,
              boneIndex,
              contextString: existingRegion.contextString, // Reuse original context for consistent noise
              isDuplicate: true, // Mark as duplicate to skip rendering in atlas SVG
            });
            continue;
          }

          // Check if we need to wrap to next row
          if (currentX + faceSize.width > textureSize[0]) {
            currentX = 0;
            currentY += rowHeight + padding;
            rowHeight = 0;
          }

          // Check if we're out of vertical space
          if (currentY + faceSize.height > textureSize[1]) {
            warnings.push(
              `Texture atlas overflow: face ${faceName} of cube ${cubeIndex} in bone ${bone.name} ` +
                `doesn't fit in ${textureSize[0]}x${textureSize[1]} texture. Consider increasing textureSize.`
            );
            continue;
          }

          // Store the region index for potential reuse
          const regionIndex = atlasRegions.length;
          textureDeduplicationMap.set(dedupeKey, regionIndex);

          atlasRegions.push({
            x: currentX,
            y: currentY,
            width: faceSize.width,
            height: faceSize.height,
            content: {
              // Store resolved content (textureId has been looked up)
              color: resolvedContent.color,
              svg: resolvedContent.svg,
              noise: resolvedContent.noise,
              background: resolvedContent.background,
              pixelArt: resolvedContent.pixelArt,
              effects: resolvedContent.effects,
              rotation: resolvedContent.rotation,
            },
            faceName,
            cubeIndex,
            boneIndex,
            contextString,
          });

          currentX += faceSize.width + padding;
          rowHeight = Math.max(rowHeight, faceSize.height);
        }
      }
    }

    // Crop texture height to actual used content
    // Width stays power-of-2 for compatibility, but height is cropped to save space
    const actualUsedHeight = currentY + rowHeight;
    if (actualUsedHeight > 0 && actualUsedHeight < textureSize[1]) {
      textureSize = [textureSize[0], actualUsedHeight];
    }

    // Convert bones to geometry format
    const geoBones: IGeometryBone[] = design.bones.map((bone, boneIndex) => {
      const cubes: IGeometryBoneCube[] = bone.cubes.map((cube, cubeIndex) => {
        // Build per-face UV from atlas regions
        const uvFaces: IGeometryUVFaces = {};

        for (const faceName of ["north", "south", "east", "west", "up", "down"] as const) {
          const region = atlasRegions.find(
            (r) => r.boneIndex === boneIndex && r.cubeIndex === cubeIndex && r.faceName === faceName
          );

          if (region) {
            uvFaces[faceName] = {
              uv: [region.x, region.y],
              uv_size: [region.width, region.height],
            };
          }
        }

        const geoCube: IGeometryBoneCube = {
          origin: cube.origin,
          size: cube.size,
          uv: uvFaces,
        };

        // Note: Cube-level pivot/rotation is NOT supported in the MCP schema.
        // All rotation is done at the bone level for simplicity.
        if (cube.inflate !== undefined) {
          geoCube.inflate = cube.inflate;
        }
        if (cube.mirror !== undefined) {
          geoCube.mirror = cube.mirror;
        }

        return geoCube;
      });

      const geoBone: IGeometryBone = {
        name: bone.name,
        pivot: bone.pivot || [0, 0, 0],
        cubes,
      };

      if (bone.parent) {
        geoBone.parent = bone.parent;
      }
      if (bone.rotation) {
        geoBone.rotation = bone.rotation;
      }

      return geoBone;
    });

    // Build the geometry object
    const geometry: IGeometry = {
      description: {
        identifier,
        texture_width: textureSize[0],
        texture_height: textureSize[1],
        visible_bounds_width: design.visibleBoundsSize ? design.visibleBoundsSize[0] : 1,
        visible_bounds_height: design.visibleBoundsSize ? design.visibleBoundsSize[1] : 1,
        visible_bounds_offset: design.visibleBoundsOffset || [0, 0.5, 0],
      },
      bones: geoBones,
    };

    const modelGeometry: IModelGeometry = {
      format_version: "1.12.0",
      "minecraft:geometry": [geometry],
    };

    return {
      geometry: modelGeometry,
      atlasRegions,
      textureSize,
      pixelsPerUnit,
      warnings,
    };
  }

  /**
   * Generate SVG for a solid color face
   */
  static generateColorSvg(color: IMcpColorRGBA, width: number, height: number): string {
    const hex = this.colorToHex(color);
    const opacity = color.a !== undefined ? (color.a / 255).toFixed(2) : "1";

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
      <rect x="0" y="0" width="${width}" height="${height}" fill="${hex}" fill-opacity="${opacity}"/>
    </svg>`;
  }

  /**
   * Get the SVG content for a face, either from explicit SVG, noise, or generating from color.
   *
   * Priority order:
   * 1. If noise is specified, generate noise background
   * 2. If svg is specified, overlay it on top of noise (or use as primary if no noise)
   * 3. If only color is specified, generate solid color
   *
   * @param content Face content configuration
   * @param width Texture width in pixels
   * @param height Texture height in pixels
   * @param contextString Optional context for deterministic noise seeding
   */
  static getFaceSvg(content: IMcpFaceContent, width: number, height: number, contextString?: string): string {
    // Handle modern background property first (takes priority)
    if (content.background) {
      const bgSvg = TexturedRectangleGenerator.generateTexturedRectangleSvg(
        content.background,
        width,
        height,
        contextString
      );

      // If there's also an SVG overlay, combine them
      if (content.svg) {
        let overlaySvg = content.svg;
        if (!overlaySvg.includes("viewBox")) {
          overlaySvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">${overlaySvg}</svg>`;
        }
        return TexturedRectangleGenerator.combineWithOverlay(bgSvg, overlaySvg, width, height);
      }

      return bgSvg;
    }

    // Handle legacy noise texture
    if (content.noise) {
      const noiseSvg = TexturedRectangleGenerator.generateNoiseSvg(content.noise, width, height, contextString);

      // If there's also an SVG overlay, combine them
      if (content.svg) {
        let overlaySvg = content.svg;
        if (!overlaySvg.includes("viewBox")) {
          overlaySvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">${overlaySvg}</svg>`;
        }
        return TexturedRectangleGenerator.combineWithOverlay(noiseSvg, overlaySvg, width, height);
      }

      return noiseSvg;
    }

    // Handle explicit SVG
    if (content.svg) {
      // Return SVG as-is - generateAtlasSvg will handle scaling
      return content.svg;
    }

    // Generate from color (legacy fallback)
    const color = this.parseColor(content.color);
    return this.generateColorSvg(color, width, height);
  }

  /**
   * Generate a complete SVG document representing the texture atlas
   * This can be rasterized to PNG using a rendering engine
   */
  static generateAtlasSvg(atlasRegions: IAtlasRegion[], textureSize: [number, number]): string {
    const [width, height] = textureSize;

    let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
`;

    for (const region of atlasRegions) {
      // Skip duplicate regions - they share atlas space with another region
      if (region.isDuplicate) {
        continue;
      }

      // Pass context string for deterministic noise seeding
      const faceSvg = this.getFaceSvg(region.content, region.width, region.height, region.contextString);

      // Extract the original SVG's dimensions and content
      const viewBoxMatch = faceSvg.match(/viewBox\s*=\s*["']([^"']+)["']/i);
      const widthMatch = faceSvg.match(/<svg[^>]*width\s*=\s*["']?(\d+)/i);
      const heightMatch = faceSvg.match(/<svg[^>]*height\s*=\s*["']?(\d+)/i);

      let originalWidth = region.width;
      let originalHeight = region.height;

      if (viewBoxMatch) {
        const parts = viewBoxMatch[1].trim().split(/\s+/);
        if (parts.length >= 4) {
          originalWidth = parseFloat(parts[2]) || region.width;
          originalHeight = parseFloat(parts[3]) || region.height;
        }
      } else if (widthMatch && heightMatch) {
        originalWidth = parseInt(widthMatch[1], 10) || region.width;
        originalHeight = parseInt(heightMatch[1], 10) || region.height;
      }

      // Extract the inner content of the SVG (skip the outer svg tags)
      let innerContent = faceSvg;
      const svgMatch = faceSvg.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
      if (svgMatch) {
        innerContent = svgMatch[1];
      }

      // Calculate scale factors to fit content into region
      const scaleX = region.width / originalWidth;
      const scaleY = region.height / originalHeight;

      // Build transform: translate to position, then scale content to fit
      let transform = `translate(${region.x}, ${region.y})`;
      if (scaleX !== 1 || scaleY !== 1) {
        transform += ` scale(${scaleX}, ${scaleY})`;
      }

      // Apply rotation if specified - rotation happens around the center of the original content
      if (region.content.rotation) {
        const cx = originalWidth / 2;
        const cy = originalHeight / 2;
        transform += ` rotate(${region.content.rotation}, ${cx}, ${cy})`;
      }

      // Use <g> with transform to position and scale the content directly
      // This avoids nested <svg> elements which can have viewport issues
      svgContent += `  <g transform="${transform}">${innerContent}</g>
`;
    }

    svgContent += `</svg>`;
    return svgContent;
  }

  /**
   * Check if an SVG string contains non-rect elements that are not Minecraft-style
   * Returns array of warning messages about non-Minecraft-style SVG elements
   */
  private static validateSvgStyle(svg: string, context: string): string[] {
    const warnings: string[] = [];

    // Non-blocky elements that don't fit Minecraft's pixel art style
    const nonBlockyPatterns = [
      { pattern: /<circle/gi, name: "circle" },
      { pattern: /<ellipse/gi, name: "ellipse" },
      { pattern: /<path/gi, name: "path" },
      { pattern: /<polygon/gi, name: "polygon" },
      { pattern: /<polyline/gi, name: "polyline" },
      { pattern: /<line[^a-z]/gi, name: "line" },
      { pattern: /linearGradient/gi, name: "linearGradient" },
      { pattern: /radialGradient/gi, name: "radialGradient" },
      { pattern: /border-radius/gi, name: "border-radius style" },
      { pattern: /rx\s*=/gi, name: "rounded corners (rx attribute)" },
      { pattern: /ry\s*=/gi, name: "rounded corners (ry attribute)" },
    ];

    for (const { pattern, name } of nonBlockyPatterns) {
      if (pattern.test(svg)) {
        warnings.push(
          `WARNING: ${context} uses <${name}> which creates non-blocky shapes. ` +
            `For authentic Minecraft style, use only <rect> elements to create pixel-art textures.`
        );
      }
    }

    return warnings;
  }

  /**
   * Validate pixel art configuration and return any errors or warnings.
   * Returns array of error/warning messages about invalid pixel art
   */
  private static validatePixelArt(pixelArtLayers: IMcpPixelArt[], context: string): string[] {
    const errors: string[] = [];

    for (let i = 0; i < pixelArtLayers.length; i++) {
      const layer = pixelArtLayers[i];
      const layerContext = pixelArtLayers.length > 1 ? `${context} pixelArt[${i}]` : `${context} pixelArt`;

      // Validate lines
      if (!layer.lines || !Array.isArray(layer.lines)) {
        errors.push(`${layerContext} must have a 'lines' array`);
        continue;
      }

      if (layer.lines.length === 0) {
        errors.push(`${layerContext} has empty 'lines' array`);
        continue;
      }

      // Validate palette
      if (!layer.palette || typeof layer.palette !== "object") {
        errors.push(`${layerContext} must have a 'palette' object`);
        continue;
      }

      // Check for space in palette (reserved for transparent)
      if (" " in layer.palette) {
        errors.push(`${layerContext} palette should not define ' ' (space) - it is reserved for transparency`);
      }

      // Collect all characters used in lines
      const usedChars = new Set<string>();
      for (const line of layer.lines) {
        if (typeof line !== "string") {
          errors.push(`${layerContext} has non-string line: ${JSON.stringify(line)}`);
          continue;
        }
        for (const char of line) {
          if (char !== " ") {
            usedChars.add(char);
          }
        }
      }

      // Check for missing palette entries
      const missingChars: string[] = [];
      for (const char of usedChars) {
        if (!(char in layer.palette)) {
          missingChars.push(char);
        }
      }
      if (missingChars.length > 0) {
        errors.push(`${layerContext} uses characters not in palette: "${missingChars.join('", "')}"`);
      }

      // Warn about unused palette entries
      const paletteKeys = Object.keys(layer.palette).filter((k) => k !== " ");
      const unusedChars = paletteKeys.filter((k) => !usedChars.has(k));
      if (unusedChars.length > 0) {
        errors.push(`WARNING: ${layerContext} palette has unused colors: "${unusedChars.join('", "')}"`);
      }

      // Validate color values
      for (const [char, color] of Object.entries(layer.palette)) {
        if (char === " ") continue;

        if (!color || typeof color !== "object") {
          errors.push(`${layerContext} palette entry "${char}" must be a color object`);
          continue;
        }

        // Check hex or rgb values
        if (!color.hex && (color.r === undefined || color.g === undefined || color.b === undefined)) {
          errors.push(`${layerContext} palette entry "${char}" must have either 'hex' or 'r', 'g', 'b' values`);
        }

        // Validate RGB ranges
        if (color.r !== undefined && (color.r < 0 || color.r > 255)) {
          errors.push(`${layerContext} palette entry "${char}" has invalid 'r' value (must be 0-255)`);
        }
        if (color.g !== undefined && (color.g < 0 || color.g > 255)) {
          errors.push(`${layerContext} palette entry "${char}" has invalid 'g' value (must be 0-255)`);
        }
        if (color.b !== undefined && (color.b < 0 || color.b > 255)) {
          errors.push(`${layerContext} palette entry "${char}" has invalid 'b' value (must be 0-255)`);
        }
        if (color.a !== undefined && (color.a < 0 || color.a > 255)) {
          errors.push(`${layerContext} palette entry "${char}" has invalid 'a' value (must be 0-255)`);
        }
      }
    }

    return errors;
  }

  /**
   * Validate an MCP model design and return any errors or warnings.
   * Errors are blocking issues that prevent model generation.
   * Warnings (prefixed with "WARNING:") are style suggestions for better Minecraft compatibility.
   */
  static validateDesign(design: IMcpModelDesign): string[] {
    const errors: string[] = [];

    if (!design.identifier) {
      errors.push("Model design must have an identifier");
    }

    if (!design.bones || design.bones.length === 0) {
      errors.push("Model design must have at least one bone");
    }

    for (let i = 0; i < (design.bones || []).length; i++) {
      const bone = design.bones[i];
      if (!bone.name) {
        errors.push(`Bone at index ${i} must have a name`);
      }
      // Note: Empty cubes arrays are allowed - bones can serve as parent/pivot bones
      // for hierarchy organization without having geometry themselves

      for (let j = 0; j < (bone.cubes || []).length; j++) {
        const cube = bone.cubes[j];
        if (!cube.origin || cube.origin.length !== 3) {
          errors.push(`Cube ${j} in bone "${bone.name}" must have a valid origin [x, y, z]`);
        }
        if (!cube.size || cube.size.length !== 3) {
          errors.push(`Cube ${j} in bone "${bone.name}" must have a valid size [w, h, d]`);
        }
        if (!cube.faces) {
          errors.push(`Cube ${j} in bone "${bone.name}" must have a faces object`);
        }

        // Validate texture references and check SVG style
        if (cube.faces) {
          for (const faceName of ["north", "south", "east", "west", "up", "down"] as const) {
            const face = cube.faces[faceName];
            if (face?.textureId) {
              if (!design.textures) {
                errors.push(
                  `Face "${faceName}" on cube ${j} in bone "${bone.name}" references textureId "${face.textureId}" ` +
                    `but no textures dictionary is defined in the model.`
                );
              } else if (!design.textures[face.textureId]) {
                errors.push(
                  `Face "${faceName}" on cube ${j} in bone "${bone.name}" references textureId "${face.textureId}" ` +
                    `which is not defined in the textures dictionary.`
                );
              }
            }
            // Check inline SVG for non-Minecraft style elements
            if (face?.svg) {
              const svgWarnings = this.validateSvgStyle(
                face.svg,
                `Face "${faceName}" on cube ${j} in bone "${bone.name}"`
              );
              errors.push(...svgWarnings);
            }
          }
        }
      }
    }

    // Validate texture definitions and check SVG style
    if (design.textures) {
      for (const [textureId, textureDef] of Object.entries(design.textures)) {
        if (
          !textureDef.svg &&
          !textureDef.color &&
          !textureDef.noise &&
          !textureDef.background &&
          !textureDef.pixelArt
        ) {
          errors.push(`Texture "${textureId}" must have either a background, noise, svg, color, or pixelArt property.`);
        }
        // Check texture SVG for non-Minecraft style elements
        if (textureDef.svg) {
          const svgWarnings = this.validateSvgStyle(textureDef.svg, `Texture "${textureId}"`);
          errors.push(...svgWarnings);
        }
        // Validate pixel art
        if (textureDef.pixelArt) {
          const pixelArtErrors = this.validatePixelArt(textureDef.pixelArt, `Texture "${textureId}"`);
          errors.push(...pixelArtErrors);
        }
      }
    }

    // Validate inline pixelArt on faces
    for (let i = 0; i < (design.bones || []).length; i++) {
      const bone = design.bones[i];
      for (let j = 0; j < (bone.cubes || []).length; j++) {
        const cube = bone.cubes[j];
        if (cube.faces) {
          for (const faceName of ["north", "south", "east", "west", "up", "down"] as const) {
            const face = cube.faces[faceName];
            if (face?.pixelArt) {
              const pixelArtErrors = this.validatePixelArt(
                face.pixelArt,
                `Face "${faceName}" on cube ${j} in bone "${bone.name}"`
              );
              errors.push(...pixelArtErrors);
            }
          }
        }
      }
    }

    // Validate model size - warn if too small or too large for Minecraft
    if (design.bones && design.bones.length > 0) {
      const bounds = this.calculateModelBounds(design);
      const height = bounds.maxY - bounds.minY;
      const width = bounds.maxX - bounds.minX;
      const depth = bounds.maxZ - bounds.minZ;

      if (bounds.maxDimension < 0.5) {
        errors.push(
          `WARNING: Model is very small (max dimension: ${bounds.maxDimension.toFixed(2)} units). ` +
            `Most Minecraft entities are 16-48 units tall (1-3 blocks). Consider scaling up for visibility.`
        );
      } else if (bounds.maxDimension > 800) {
        errors.push(
          `WARNING: Model is very large (max dimension: ${bounds.maxDimension.toFixed(2)} units, ~${(bounds.maxDimension / 16).toFixed(1)} blocks). ` +
            `This exceeds Minecraft's typical entity rendering limits. Consider scaling down unless creating a mega-structure.`
        );
      }

      // Warn about flat models that might not render well
      if (height < 0.1 && (width > 1 || depth > 1)) {
        errors.push(
          `WARNING: Model appears very flat (height: ${height.toFixed(2)} units). ` +
            `Minecraft mobs typically have 3D volume. Consider adding height.`
        );
      }
    }

    return errors;
  }

  /**
   * Create a simple unit cube model design (for testing)
   */
  static createUnitCubeDesign(
    identifier: string,
    faceColors: {
      north?: string;
      south?: string;
      east?: string;
      west?: string;
      up?: string;
      down?: string;
    }
  ): IMcpModelDesign {
    return {
      formatVersion: "1.0.0",
      identifier,
      textureSize: [64, 64],
      bones: [
        {
          name: "body",
          pivot: [0, 0, 0],
          cubes: [
            {
              origin: [-8, 0, -8],
              size: [16, 16, 16],
              faces: {
                north: faceColors.north ? { color: faceColors.north } : undefined,
                south: faceColors.south ? { color: faceColors.south } : undefined,
                east: faceColors.east ? { color: faceColors.east } : undefined,
                west: faceColors.west ? { color: faceColors.west } : undefined,
                up: faceColors.up ? { color: faceColors.up } : undefined,
                down: faceColors.down ? { color: faceColors.down } : undefined,
              },
            },
          ],
        },
      ],
    };
  }
}
