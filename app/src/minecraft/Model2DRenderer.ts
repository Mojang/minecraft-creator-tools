// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Model2DRenderer
 *
 * Renders Minecraft Bedrock geometry models to 2D SVG representations.
 * Creates icon-style views of entities by projecting 3D geometry onto a 2D plane
 * and sampling texture data for accurate coloring.
 *
 * FEATURES:
 * ---------
 * - Orthographic views: front, back, left, right, top, bottom
 * - Isometric views: iso-front-right, iso-front-left, iso-back-right, iso-back-left
 *   (shows 3 faces at once for realistic 3D-like appearance)
 * - Built-in unit cube support for standard block rendering
 * - Proper depth sorting for occlusion (painter's algorithm)
 * - Direct PNG and TGA texture loading (no browser required)
 * - Support for bone rotations and bind_pose_rotation
 * - Configurable scale and output dimensions
 * - Optional depth shading effects
 * - Pure Node.js - no Playwright/browser dependency needed
 *
 * USAGE:
 * ------
 * // Render a unit cube block (uses built-in geometry):
 * const svg = Model2DRenderer.renderUnitCubeToSvg({
 *   viewDirection: 'iso-front-left',
 *   texturePngData: pngBuffer,
 *   outputWidth: 64,
 *   outputHeight: 64
 * });
 *
 * // With raw PNG data (handles decoding automatically):
 * const svg = Model2DRenderer.renderToSvg(geometry, {
 *   viewDirection: 'front',
 *   texturePngData: pngBuffer,  // Uint8Array of PNG file contents
 *   outputWidth: 64,
 *   outputHeight: 64,
 *   depthShading: true
 * });
 *
 * // Isometric view for Minecraft inventory-style 3D appearance:
 * const svg = Model2DRenderer.renderToSvg(geometry, {
 *   viewDirection: 'iso-front-right',  // Shows north + east + up faces
 *   texturePngData: pngBuffer,
 *   outputWidth: 64,
 *   outputHeight: 64
 * });
 *
 * // With raw TGA data (async - use renderToSvgAsync):
 * const svg = await Model2DRenderer.renderToSvgAsync(geometry, {
 *   viewDirection: 'front',
 *   textureTgaData: tgaBuffer,  // Uint8Array of TGA file contents
 *   outputWidth: 64,
 *   outputHeight: 64
 * });
 *
 * // With any image type (use textureData + textureFileType):
 * const svg = await Model2DRenderer.renderToSvgAsync(geometry, {
 *   viewDirection: 'front',
 *   textureData: imageBuffer,
 *   textureFileType: 'tga',  // or 'png'
 *   outputWidth: 64
 * });
 *
 * // With pre-parsed texture pixels:
 * const svg = Model2DRenderer.renderToSvg(geometry, {
 *   viewDirection: 'front',
 *   texturePixels: { width: 64, height: 64, pixels: rgbaData },
 *   outputWidth: 64,
 *   outputHeight: 64
 * });
 *
 * // Without texture (uses fallback color):
 * const svg = Model2DRenderer.renderToSvg(geometry, {
 *   viewDirection: 'front',
 *   fallbackColor: '#808080'
 * });
 *
 * TEXTURE DATA FORMAT:
 * --------------------
 * Option 1: texturePngData - raw PNG file bytes as Uint8Array
 *   - Automatically decoded using pngjs (sync)
 *   - Fast, pure Node.js, no browser needed
 *
 * Option 2: textureTgaData - raw TGA file bytes as Uint8Array
 *   - Automatically decoded using @lunapaint/tga-codec (async)
 *   - Use renderToSvgAsync() or renderToDetailedSvgAsync()
 *
 * Option 3: textureData + textureFileType - generic image bytes
 *   - Works with 'png' or 'tga' file types
 *   - Use async methods for TGA support
 *
 * Option 4: texturePixels - pre-parsed RGBA pixel data
 *   - width: texture width in pixels
 *   - height: texture height in pixels
 *   - pixels: Uint8Array of RGBA values (4 bytes per pixel, row-major)
 *
 * LIMITATIONS:
 * ------------
 * - Rotation is handled but heavily rotated cubes may not project perfectly
 * - No animation support (renders rest pose only)
 * - Texture filtering is nearest-neighbor (pixel art style)
 *
 * Last Updated: December 2025
 */

import { IGeometry } from "./IModelGeometry";
import ModelGeometryUtilities, {
  IBoundingBox,
  IProjectedFace,
  ViewDirection,
  isIsometricView,
} from "./ModelGeometryUtilities";
import ImageCodec from "../core/ImageCodec";
import CreatorToolsHost from "../app/CreatorToolsHost";

/**
 * Pre-parsed texture pixel data.
 */
export interface ITexturePixels {
  /** Texture width in pixels */
  width: number;
  /** Texture height in pixels */
  height: number;
  /** RGBA pixel data (4 bytes per pixel, row-major order) */
  pixels: Uint8Array;
}

/**
 * Options for 2D rendering
 */
export interface IModel2DRenderOptions {
  /** View direction (default: 'front') */
  viewDirection?: ViewDirection;

  /** Raw PNG file data - will be decoded automatically using pngjs */
  texturePngData?: Uint8Array;

  /** Raw TGA file data - will be decoded automatically */
  textureTgaData?: Uint8Array;

  /**
   * Raw texture file data with explicit file type.
   * Alternative to texturePngData/textureTgaData when you have the data and type separately.
   */
  textureData?: Uint8Array;

  /** File type for textureData ('png' or 'tga') */
  textureFileType?: string;

  /** Pre-parsed texture pixel data (alternative to texturePngData) */
  texturePixels?: ITexturePixels;

  /** Texture width as defined in geometry (for UV mapping, default: from geometry or 64) */
  textureWidth?: number;

  /** Texture height as defined in geometry (for UV mapping, default: from geometry or 64) */
  textureHeight?: number;

  /** Output SVG width in pixels (default: 64) */
  outputWidth?: number;

  /** Output SVG height in pixels (default: 64) */
  outputHeight?: number;

  /** Whether to add depth shading (darker = further away) */
  depthShading?: boolean;

  /** Depth shading intensity (0-1, default: 0.3) */
  depthShadingIntensity?: number;

  /** Background color (default: transparent) */
  backgroundColor?: string;

  /** Padding in pixels around the model (default: 2) */
  padding?: number;

  /** Whether to include secondary faces (sides/top) for 3/4 view effect */
  includeSecondaryFaces?: boolean;

  /** Scale multiplier for output (default: auto-fit) */
  scale?: number;

  /** Fallback color when texture is not available */
  fallbackColor?: string;

  /**
   * Perspective projection strength (0-1, default: 0 = orthographic).
   * A value of 0 uses pure orthographic projection (no foreshortening).
   * A value of 1 uses strong perspective with visible vanishing point effect.
   * Recommended range: 0.1-0.3 for subtle perspective, 0.5+ for dramatic effect.
   */
  perspectiveStrength?: number;

  /**
   * Focal length for perspective projection (default: 100).
   * Smaller values create more dramatic perspective (wide-angle lens effect).
   * Larger values create flatter perspective (telephoto lens effect).
   * Only applies when perspectiveStrength > 0.
   */
  focalLength?: number;

  /**
   * Texture sampling resolution per face (default: 1 = single color per face).
   * Higher values divide each face into a grid for more detailed texture representation.
   * - 1: Single averaged color per face (fastest, smallest SVG)
   * - 2: 2x2 grid = 4 samples per face
   * - 4: 4x4 grid = 16 samples per face (good balance of quality/size)
   * - 8: 8x8 grid = 64 samples per face (high quality)
   * Only applies to non-isometric views. Isometric views use single color for cleaner polygons.
   */
  textureSampleResolution?: number;
}

/**
 * Static class for rendering Minecraft geometry models to 2D SVG.
 * Pure Node.js implementation - no browser/Playwright required.
 */
export default class Model2DRenderer {
  /**
   * Standard unit cube geometry (16x16x16 Minecraft units = 1 block).
   * Can be used directly with renderToSvg for unit cube blocks.
   */
  static readonly UNIT_CUBE_GEOMETRY: IGeometry = {
    description: {
      identifier: "geometry.unit_cube",
      texture_width: 16,
      texture_height: 16,
      visible_bounds_width: 1,
      visible_bounds_height: 1,
      visible_bounds_offset: [0, 0.5, 0],
    },
    bones: [
      {
        name: "body",
        pivot: [0, 0, 0],
        cubes: [
          {
            origin: [-8, 0, -8],
            size: [16, 16, 16],
            uv: [0, 0],
          },
        ],
      },
    ],
  };

  /**
   * Render a unit cube block to SVG.
   * Convenience method that uses the standard unit cube geometry.
   *
   * @param options Rendering options (same as renderToSvg, but geometry is provided)
   * @returns SVG string
   */
  static renderUnitCubeToSvg(options: IModel2DRenderOptions = {}): string {
    return this.renderToSvg(this.UNIT_CUBE_GEOMETRY, options);
  }

  /**
   * Async version of renderUnitCubeToSvg that supports TGA textures.
   *
   * @param options Rendering options
   * @returns SVG string
   */
  static async renderUnitCubeToSvgAsync(options: IModel2DRenderOptions = {}): Promise<string> {
    return this.renderToSvgAsync(this.UNIT_CUBE_GEOMETRY, options);
  }

  /**
   * Decode PNG data to RGBA pixels using pngjs.
   * This is a synchronous operation - fast and doesn't require a browser.
   * Only works in Node.js environment - returns undefined in browser.
   *
   * @param pngData Raw PNG file bytes
   * @returns Decoded texture pixels, or undefined if decoding fails
   * @deprecated Use ImageCodec.decodePng() directly instead
   */
  static decodePng(pngData: Uint8Array): ITexturePixels | undefined {
    // Delegate to CreatorToolsHost's platform-specific PNG decoder
    if (CreatorToolsHost.decodePng) {
      try {
        return CreatorToolsHost.decodePng(pngData);
      } catch (e) {
        return undefined;
      }
    }

    return undefined;
  }

  /**
   * Decode TGA data to RGBA pixels.
   * Uses ImageCodec for decoding.
   *
   * @param tgaData Raw TGA file bytes
   * @returns Decoded texture pixels, or undefined if decoding fails
   * @deprecated Use ImageCodec.decodeTga() directly instead
   */
  static async decodeTga(tgaData: Uint8Array): Promise<ITexturePixels | undefined> {
    return await ImageCodec.decodeTga(tgaData);
  }

  /**
   * Decode image data (PNG or TGA) to RGBA pixels.
   * Uses ImageCodec for decoding.
   *
   * @param data Raw image file bytes
   * @param fileType File extension ('png' or 'tga')
   * @returns Decoded texture pixels, or undefined if decoding fails
   * @deprecated Use ImageCodec.decode() directly instead
   */
  static async decodeTexture(data: Uint8Array, fileType: string): Promise<ITexturePixels | undefined> {
    return await ImageCodec.decode(data, fileType);
  }

  /**
   * Render a geometry model to SVG string.
   * Uses average color sampling per face for efficient rendering.
   *
   * @param geometry The geometry definition to render
   * @param options Rendering options
   * @returns SVG string
   */
  static renderToSvg(geometry: IGeometry, options: IModel2DRenderOptions = {}): string {
    const viewDirection = options.viewDirection || "front";
    const outputWidth = options.outputWidth || 64;
    const outputHeight = options.outputHeight || 64;
    const padding = options.padding ?? 2;
    const depthShading = options.depthShading ?? false;
    const depthShadingIntensity = options.depthShadingIntensity ?? 0.3;
    const includeSecondary = options.includeSecondaryFaces ?? false;
    const fallbackColor = options.fallbackColor || "#808080";
    const backgroundColor = options.backgroundColor;
    const textureSampleResolution = Math.max(1, Math.min(16, options.textureSampleResolution ?? 1));

    // Get texture dimensions from geometry or options
    const texWidth = options.textureWidth || geometry.description?.texture_width || geometry.texturewidth || 64;
    const texHeight = options.textureHeight || geometry.description?.texture_height || geometry.textureheight || 64;

    // Resolve texture pixels - decode PNG or TGA if provided
    // Note: TGA decoding is async, so for TGA use renderToSvgAsync or pre-decode with decodeTga()
    let texturePixels = options.texturePixels;
    if (!texturePixels && options.texturePngData) {
      texturePixels = this.decodePng(options.texturePngData);
    }

    // Calculate geometry bounding box
    const bounds = ModelGeometryUtilities.getGeometryBoundingBox(geometry);

    // Calculate scale to fit in output dimensions
    let scale = options.scale;
    if (!scale) {
      scale = this._calculateAutoScale(bounds, viewDirection, outputWidth, outputHeight, padding);
    }

    // Set up perspective projection if enabled
    // This must be done BEFORE getProjectedFaces so perspective is applied at the vertex level
    const perspectiveStrength = options.perspectiveStrength ?? 0;
    const focalLength = options.focalLength ?? 100;
    if (perspectiveStrength > 0) {
      // Calculate reference depth (center of the model) based on view direction
      let referenceDepth = 0;
      switch (viewDirection) {
        case "front":
          referenceDepth = -(bounds.minZ + bounds.maxZ) / 2; // Front view: depth = -z
          break;
        case "back":
          referenceDepth = (bounds.minZ + bounds.maxZ) / 2;
          break;
        case "left":
          referenceDepth = -(bounds.minX + bounds.maxX) / 2;
          break;
        case "right":
          referenceDepth = (bounds.minX + bounds.maxX) / 2;
          break;
        case "top":
          referenceDepth = (bounds.minY + bounds.maxY) / 2;
          break;
        case "bottom":
          referenceDepth = -(bounds.minY + bounds.maxY) / 2;
          break;
      }

      ModelGeometryUtilities.perspectiveOptions = {
        enabled: true,
        strength: perspectiveStrength,
        focalLength: focalLength,
        referenceDepth: referenceDepth,
      };
    } else {
      ModelGeometryUtilities.perspectiveOptions.enabled = false;
    }

    // Get projected faces sorted by depth (perspective is now applied at vertex level)
    const projectedFaces = ModelGeometryUtilities.getProjectedFaces(geometry, viewDirection, scale, includeSecondary);

    // Reset perspective options after projection
    ModelGeometryUtilities.perspectiveOptions.enabled = false;

    // Calculate depth range for shading
    let minDepth = Infinity;
    let maxDepth = -Infinity;
    for (const face of projectedFaces) {
      minDepth = Math.min(minDepth, face.depth);
      maxDepth = Math.max(maxDepth, face.depth);
    }
    const depthRange = maxDepth - minDepth || 1;

    // Calculate centering offset
    const projBounds = this._getProjectedBounds(projectedFaces);
    const contentWidth = projBounds.maxX - projBounds.minX;
    const contentHeight = projBounds.maxY - projBounds.minY;
    const offsetX = (outputWidth - contentWidth) / 2 - projBounds.minX;
    const offsetY = (outputHeight - contentHeight) / 2 - projBounds.minY;

    // Check if this is an isometric view (faces rendered as polygons, not rectangles)
    const isIsometric = isIsometricView(viewDirection);

    // Generate SVG elements
    const elements: string[] = [];

    // Add background if specified
    if (backgroundColor) {
      elements.push(`<rect width="${outputWidth}" height="${outputHeight}" fill="${backgroundColor}"/>`);
    }

    // Render faces back to front
    for (const face of projectedFaces) {
      const x = face.x + offsetX;
      const y = face.y + offsetY;

      // Get face color from texture or use fallback
      let fillColor = fallbackColor;
      if (texturePixels) {
        const uv = ModelGeometryUtilities.getCubeFaceUV(face.cube, face.face, texWidth, texHeight);
        fillColor = this._sampleTextureAverageColor(
          texturePixels,
          uv.u,
          uv.v,
          uv.width,
          uv.height,
          texWidth,
          texHeight
        );
        if (fillColor === "transparent") {
          fillColor = fallbackColor;
        }
      }

      // Apply depth shading
      if (depthShading) {
        // depthFactor: 0 = closest to camera, 1 = farthest from camera
        const depthFactor = (face.depth - minDepth) / depthRange;
        // shadeFactor: 1 = no darkening (closest), (1-intensity) = max darkening (farthest)
        const shadeFactor = 1 - depthFactor * depthShadingIntensity;
        fillColor = this._shadeColor(fillColor, shadeFactor);
      }

      // Add shape for this face
      if (face.width > 0.1 && face.height > 0.1) {
        if (isIsometric && face.vertices && face.vertices.length >= 4) {
          if (textureSampleResolution > 1 && texturePixels) {
            // Grid-based texture sampling for isometric views
            // Interpolate between vertices to create sub-polygons
            const uv = ModelGeometryUtilities.getCubeFaceUV(face.cube, face.face, texWidth, texHeight);
            const uvCellWidth = uv.width / textureSampleResolution;
            const uvCellHeight = uv.height / textureSampleResolution;

            // Vertices are: 0=bottom-left, 1=bottom-right, 2=top-right, 3=top-left
            const v0 = face.vertices[0];
            const v1 = face.vertices[1];
            const v2 = face.vertices[2];
            const v3 = face.vertices[3];

            for (let gy = 0; gy < textureSampleResolution; gy++) {
              for (let gx = 0; gx < textureSampleResolution; gx++) {
                // Calculate normalized coordinates for this cell
                // The bilinear parameters must be flipped in both U and V to correctly map
                // UV texture space to the face vertex positions.
                // 
                // Why: Face corners are defined with v0/v1 at minY (bottom) and v2/v3 at maxY (top).
                // In Minecraft's UV layout, the top of each face's UV region (gy=0) should map to
                // the top of the face (maxY = v2/v3), and UV left should map to the face edge
                // matching the adjacent face in the UV unwrap (typically maxX for north face).
                // Without flipping, gy=0 maps to v0 (bottom) and gx=0 maps to the wrong horizontal
                // edge, causing a 180° texture rotation on every face.
                const u0 = 1 - (gx + 1) / textureSampleResolution;
                const u1 = 1 - gx / textureSampleResolution;
                const v0n = 1 - (gy + 1) / textureSampleResolution;
                const v1n = 1 - gy / textureSampleResolution;

                // Bilinear interpolation to get cell corners
                const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
                const bilinear = (
                  p0: { x: number; y: number },
                  p1: { x: number; y: number },
                  p2: { x: number; y: number },
                  p3: { x: number; y: number },
                  u: number,
                  v: number
                ) => ({
                  x: lerp(lerp(p0.x, p1.x, u), lerp(p3.x, p2.x, u), v),
                  y: lerp(lerp(p0.y, p1.y, u), lerp(p3.y, p2.y, u), v),
                });

                const cellV0 = bilinear(v0, v1, v2, v3, u0, v0n);
                const cellV1 = bilinear(v0, v1, v2, v3, u1, v0n);
                const cellV2 = bilinear(v0, v1, v2, v3, u1, v1n);
                const cellV3 = bilinear(v0, v1, v2, v3, u0, v1n);

                const cellU = uv.u + gx * uvCellWidth;
                const cellV = uv.v + gy * uvCellHeight;

                let cellColor = this._sampleTextureAverageColor(
                  texturePixels,
                  cellU,
                  cellV,
                  uvCellWidth,
                  uvCellHeight,
                  texWidth,
                  texHeight
                );

                if (cellColor === "transparent") {
                  continue; // Skip transparent cells
                }

                // Apply depth shading to cell
                if (depthShading) {
                  const depthFactor = (face.depth - minDepth) / depthRange;
                  const shadeFactor = 1 - depthFactor * depthShadingIntensity;
                  cellColor = this._shadeColor(cellColor, shadeFactor);
                }

                const cellPoints = [cellV0, cellV1, cellV2, cellV3]
                  .map((cv) => `${(cv.x + offsetX).toFixed(2)},${(cv.y + offsetY).toFixed(2)}`)
                  .join(" ");
                elements.push(`<polygon points="${cellPoints}" fill="${cellColor}"/>`);
              }
            }
          } else {
            // Render as single polygon for isometric views (single color for clean appearance)
            const points = face.vertices
              .map((v) => `${(v.x + offsetX).toFixed(2)},${(v.y + offsetY).toFixed(2)}`)
              .join(" ");
            elements.push(`<polygon points="${points}" fill="${fillColor}"/>`);
          }
        } else if (textureSampleResolution > 1 && texturePixels) {
          // Grid-based texture sampling for higher quality orthographic rendering
          const uv = ModelGeometryUtilities.getCubeFaceUV(face.cube, face.face, texWidth, texHeight);
          const cellWidth = face.width / textureSampleResolution;
          const cellHeight = face.height / textureSampleResolution;
          const uvCellWidth = uv.width / textureSampleResolution;
          const uvCellHeight = uv.height / textureSampleResolution;

          for (let gy = 0; gy < textureSampleResolution; gy++) {
            for (let gx = 0; gx < textureSampleResolution; gx++) {
              const cellX = x + gx * cellWidth;
              const cellY = y + gy * cellHeight;
              const cellU = uv.u + gx * uvCellWidth;
              const cellV = uv.v + gy * uvCellHeight;

              let cellColor = this._sampleTextureAverageColor(
                texturePixels,
                cellU,
                cellV,
                uvCellWidth,
                uvCellHeight,
                texWidth,
                texHeight
              );

              if (cellColor === "transparent") {
                continue; // Skip transparent cells
              }

              // Apply depth shading to cell
              if (depthShading) {
                const depthFactor = (face.depth - minDepth) / depthRange;
                const shadeFactor = 1 - depthFactor * depthShadingIntensity;
                cellColor = this._shadeColor(cellColor, shadeFactor);
              }

              elements.push(
                `<rect x="${cellX.toFixed(2)}" y="${cellY.toFixed(2)}" ` +
                  `width="${(cellWidth + 0.5).toFixed(2)}" height="${(cellHeight + 0.5).toFixed(2)}" ` +
                  `fill="${cellColor}"/>`
              );
            }
          }
        } else {
          // Render as rectangle for orthographic views (single color)
          elements.push(
            `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" ` +
              `width="${face.width.toFixed(2)}" height="${face.height.toFixed(2)}" ` +
              `fill="${fillColor}"/>`
          );
        }
      }
    }

    // Wrap in SVG
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" ` +
      `viewBox="0 0 ${outputWidth} ${outputHeight}" ` +
      `width="${outputWidth}" height="${outputHeight}">` +
      elements.join("") +
      `</svg>`
    );
  }

  /**
   * Async version of renderToSvg that supports TGA textures.
   * Use this when you have a TGA texture that needs to be decoded.
   *
   * @param geometry The geometry definition to render
   * @param options Rendering options (can include textureTgaData or textureData+textureFileType)
   * @returns SVG string
   */
  static async renderToSvgAsync(geometry: IGeometry, options: IModel2DRenderOptions = {}): Promise<string> {
    // Pre-decode TGA if provided
    let resolvedOptions = { ...options };

    if (!resolvedOptions.texturePixels) {
      if (resolvedOptions.textureTgaData) {
        const decoded = await this.decodeTga(resolvedOptions.textureTgaData);
        if (decoded) {
          resolvedOptions.texturePixels = decoded;
        }
      } else if (resolvedOptions.textureData && resolvedOptions.textureFileType) {
        const decoded = await this.decodeTexture(resolvedOptions.textureData, resolvedOptions.textureFileType);
        if (decoded) {
          resolvedOptions.texturePixels = decoded;
        }
      }
    }

    return this.renderToSvg(geometry, resolvedOptions);
  }

  /**
   * Render a geometry model to SVG with per-pixel texture sampling.
   * Creates a more detailed rendering by sampling texture for each output pixel.
   *
   * @param geometry The geometry definition to render
   * @param options Rendering options
   * @returns SVG string with detailed pixel rendering
   */
  static renderToDetailedSvg(geometry: IGeometry, options: IModel2DRenderOptions = {}): string {
    const viewDirection = options.viewDirection || "front";
    const outputWidth = options.outputWidth || 64;
    const outputHeight = options.outputHeight || 64;
    const padding = options.padding ?? 2;
    const backgroundColor = options.backgroundColor;
    const fallbackColor = options.fallbackColor || "#808080";
    const includeSecondary = options.includeSecondaryFaces ?? false;
    const depthShading = options.depthShading ?? false;
    const depthShadingIntensity = options.depthShadingIntensity ?? 0.3;

    // Get texture dimensions
    const texWidth = options.textureWidth || geometry.description?.texture_width || geometry.texturewidth || 64;
    const texHeight = options.textureHeight || geometry.description?.texture_height || geometry.textureheight || 64;

    // Resolve texture pixels - decode PNG or TGA if provided
    // Note: TGA decoding is async, so for TGA use renderToSvgAsync or pre-decode with decodeTga()
    let texturePixels = options.texturePixels;
    if (!texturePixels && options.texturePngData) {
      texturePixels = this.decodePng(options.texturePngData);
    }

    // Calculate geometry bounding box and scale
    const bounds = ModelGeometryUtilities.getGeometryBoundingBox(geometry);
    const scale = options.scale || this._calculateAutoScale(bounds, viewDirection, outputWidth, outputHeight, padding);

    // Set up perspective projection if enabled
    // This must be done BEFORE getProjectedFaces so perspective is applied at the vertex level
    const perspectiveStrength = options.perspectiveStrength ?? 0;
    const focalLength = options.focalLength ?? 100;
    if (perspectiveStrength > 0) {
      // Calculate reference depth (center of the model) based on view direction
      let referenceDepth = 0;
      switch (viewDirection) {
        case "front":
          referenceDepth = -(bounds.minZ + bounds.maxZ) / 2;
          break;
        case "back":
          referenceDepth = (bounds.minZ + bounds.maxZ) / 2;
          break;
        case "left":
          referenceDepth = -(bounds.minX + bounds.maxX) / 2;
          break;
        case "right":
          referenceDepth = (bounds.minX + bounds.maxX) / 2;
          break;
        case "top":
          referenceDepth = (bounds.minY + bounds.maxY) / 2;
          break;
        case "bottom":
          referenceDepth = -(bounds.minY + bounds.maxY) / 2;
          break;
      }

      ModelGeometryUtilities.perspectiveOptions = {
        enabled: true,
        strength: perspectiveStrength,
        focalLength: focalLength,
        referenceDepth: referenceDepth,
      };
    } else {
      ModelGeometryUtilities.perspectiveOptions.enabled = false;
    }

    // Get projected faces sorted by depth (perspective is now applied at vertex level)
    const projectedFaces = ModelGeometryUtilities.getProjectedFaces(geometry, viewDirection, scale, includeSecondary);

    // Reset perspective options after projection
    ModelGeometryUtilities.perspectiveOptions.enabled = false;

    // Calculate depth range for shading
    let minDepth = Infinity;
    let maxDepth = -Infinity;
    for (const face of projectedFaces) {
      minDepth = Math.min(minDepth, face.depth);
      maxDepth = Math.max(maxDepth, face.depth);
    }
    const depthRange = maxDepth - minDepth || 1;

    // Calculate centering offset
    const projBounds = this._getProjectedBounds(projectedFaces);
    const contentWidth = projBounds.maxX - projBounds.minX;
    const contentHeight = projBounds.maxY - projBounds.minY;
    const offsetX = (outputWidth - contentWidth) / 2 - projBounds.minX;
    const offsetY = (outputHeight - contentHeight) / 2 - projBounds.minY;

    // Create pixel grid for output
    const pixels: string[][] = Array(outputHeight)
      .fill(null)
      .map(() => Array(outputWidth).fill(""));

    // Render faces back to front (painter's algorithm)
    for (const face of projectedFaces) {
      if (face.width < 0.1 || face.height < 0.1) continue;

      const x = face.x + offsetX;
      const y = face.y + offsetY;
      const uv = ModelGeometryUtilities.getCubeFaceUV(face.cube, face.face, texWidth, texHeight);

      // Iterate over output pixels covered by this face
      const startX = Math.max(0, Math.floor(x));
      const endX = Math.min(outputWidth, Math.ceil(x + face.width));
      const startY = Math.max(0, Math.floor(y));
      const endY = Math.min(outputHeight, Math.ceil(y + face.height));

      for (let py = startY; py < endY; py++) {
        for (let px = startX; px < endX; px++) {
          // Calculate UV coordinate for this pixel
          const relX = px - x;
          const relY = py - y;

          if (relX >= 0 && relX < face.width && relY >= 0 && relY < face.height) {
            // Map pixel position to texture UV
            const u = uv.u + (relX / face.width) * uv.width;
            const v = uv.v + (relY / face.height) * uv.height;

            let color = fallbackColor;
            if (texturePixels) {
              color = this._sampleTexturePixel(texturePixels, u, v, texWidth, texHeight);
            }

            // Apply depth shading based on face depth
            if (depthShading && color !== "transparent") {
              // depthFactor: 0 = closest to camera, 1 = farthest from camera
              const depthFactor = (face.depth - minDepth) / depthRange;
              // shadeFactor: 1 = no darkening (closest), (1-intensity) = max darkening (farthest)
              const shadeFactor = 1 - depthFactor * depthShadingIntensity;
              color = this._shadeColor(color, shadeFactor);
            }

            // Only overwrite if color has alpha
            if (color !== "transparent") {
              pixels[py][px] = color;
            }
          }
        }
      }
    }

    // Generate SVG from pixel grid
    const elements: string[] = [];

    // Add background if specified
    if (backgroundColor) {
      elements.push(`<rect width="${outputWidth}" height="${outputHeight}" fill="${backgroundColor}"/>`);
    }

    // Optimize SVG by grouping horizontal runs of same color
    for (let y = 0; y < outputHeight; y++) {
      let runStart = -1;
      let runColor = "";

      for (let x = 0; x <= outputWidth; x++) {
        const color = x < outputWidth ? pixels[y][x] : "";

        if (color !== runColor) {
          // End current run
          if (runStart >= 0 && runColor && runColor !== "transparent") {
            const runWidth = x - runStart;
            elements.push(`<rect x="${runStart}" y="${y}" width="${runWidth}" height="1" fill="${runColor}"/>`);
          }
          // Start new run
          runStart = x;
          runColor = color;
        }
      }
    }

    return (
      `<svg xmlns="http://www.w3.org/2000/svg" ` +
      `viewBox="0 0 ${outputWidth} ${outputHeight}" ` +
      `width="${outputWidth}" height="${outputHeight}">` +
      elements.join("") +
      `</svg>`
    );
  }

  /**
   * Async version of renderToDetailedSvg that supports TGA textures.
   * Use this when you have a TGA texture that needs to be decoded.
   *
   * @param geometry The geometry definition to render
   * @param options Rendering options (can include textureTgaData or textureData+textureFileType)
   * @returns SVG string with detailed pixel rendering
   */
  static async renderToDetailedSvgAsync(geometry: IGeometry, options: IModel2DRenderOptions = {}): Promise<string> {
    // Pre-decode TGA if provided
    let resolvedOptions = { ...options };

    if (!resolvedOptions.texturePixels) {
      if (resolvedOptions.textureTgaData) {
        const decoded = await this.decodeTga(resolvedOptions.textureTgaData);
        if (decoded) {
          resolvedOptions.texturePixels = decoded;
        }
      } else if (resolvedOptions.textureData && resolvedOptions.textureFileType) {
        const decoded = await this.decodeTexture(resolvedOptions.textureData, resolvedOptions.textureFileType);
        if (decoded) {
          resolvedOptions.texturePixels = decoded;
        }
      }
    }

    return this.renderToDetailedSvg(geometry, resolvedOptions);
  }

  /**
   * Sample a single pixel from the texture.
   */
  private static _sampleTexturePixel(
    texture: ITexturePixels,
    u: number,
    v: number,
    texWidth: number,
    texHeight: number
  ): string {
    // Map UV to texture pixels (nearest neighbor)
    const texX = Math.floor((u / texWidth) * texture.width);
    const texY = Math.floor((v / texHeight) * texture.height);

    // Clamp to texture bounds
    const x = Math.max(0, Math.min(texture.width - 1, texX));
    const y = Math.max(0, Math.min(texture.height - 1, texY));

    // Get pixel RGBA
    const idx = (y * texture.width + x) * 4;
    const r = texture.pixels[idx];
    const g = texture.pixels[idx + 1];
    const b = texture.pixels[idx + 2];
    const a = texture.pixels[idx + 3];

    if (a < 128) {
      return "transparent";
    }

    return `rgb(${r},${g},${b})`;
  }

  /**
   * Sample the average color from a texture region.
   */
  private static _sampleTextureAverageColor(
    texture: ITexturePixels,
    u: number,
    v: number,
    width: number,
    height: number,
    texWidth: number,
    texHeight: number
  ): string {
    // Calculate texture pixel bounds
    const startX = Math.floor((u / texWidth) * texture.width);
    const startY = Math.floor((v / texHeight) * texture.height);
    const endX = Math.ceil(((u + width) / texWidth) * texture.width);
    const endY = Math.ceil(((v + height) / texHeight) * texture.height);

    // Clamp to texture bounds
    const x1 = Math.max(0, Math.min(texture.width - 1, startX));
    const y1 = Math.max(0, Math.min(texture.height - 1, startY));
    const x2 = Math.max(0, Math.min(texture.width, endX));
    const y2 = Math.max(0, Math.min(texture.height, endY));

    let totalR = 0,
      totalG = 0,
      totalB = 0,
      count = 0;

    for (let py = y1; py < y2; py++) {
      for (let px = x1; px < x2; px++) {
        const idx = (py * texture.width + px) * 4;
        const a = texture.pixels[idx + 3];
        if (a > 128) {
          // Only count opaque pixels
          totalR += texture.pixels[idx];
          totalG += texture.pixels[idx + 1];
          totalB += texture.pixels[idx + 2];
          count++;
        }
      }
    }

    if (count === 0) {
      return "transparent";
    }

    const r = Math.round(totalR / count);
    const g = Math.round(totalG / count);
    const b = Math.round(totalB / count);

    return `rgb(${r},${g},${b})`;
  }

  /**
   * Apply shading to a color.
   */
  private static _shadeColor(color: string, factor: number): string {
    // Parse rgb(r,g,b) or #rrggbb
    let r: number, g: number, b: number;

    if (color.startsWith("rgb(")) {
      const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (!match) return color;
      r = parseInt(match[1]);
      g = parseInt(match[2]);
      b = parseInt(match[3]);
    } else if (color.startsWith("#")) {
      const hex = color.slice(1);
      r = parseInt(hex.slice(0, 2), 16);
      g = parseInt(hex.slice(2, 4), 16);
      b = parseInt(hex.slice(4, 6), 16);
    } else {
      return color;
    }

    r = Math.round(r * factor);
    g = Math.round(g * factor);
    b = Math.round(b * factor);

    return `rgb(${r},${g},${b})`;
  }

  /**
   * Calculate auto scale to fit geometry in output dimensions.
   */
  private static _calculateAutoScale(
    bounds: IBoundingBox,
    viewDirection: ViewDirection,
    outputWidth: number,
    outputHeight: number,
    padding: number
  ): number {
    // Get dimensions based on view direction
    let modelWidth: number, modelHeight: number;

    const xSpan = bounds.maxX - bounds.minX;
    const ySpan = bounds.maxY - bounds.minY;
    const zSpan = bounds.maxZ - bounds.minZ;

    switch (viewDirection) {
      case "front":
      case "back":
        modelWidth = xSpan;
        modelHeight = ySpan;
        break;
      case "left":
      case "right":
        modelWidth = zSpan;
        modelHeight = ySpan;
        break;
      case "top":
      case "bottom":
        modelWidth = xSpan;
        modelHeight = zSpan;
        break;
      // Isometric views: calculate approximate projected dimensions
      // After Y rotation (±45° or ±135°) and X tilt (30°):
      // - Width ≈ |X * cos(Yrot) + Z * sin(Yrot)| - rotated horizontal span
      // - Height ≈ Y * cos(30°) + depth * sin(30°) - Y compressed + depth contribution
      case "iso-front-right":
      case "iso-front-left":
      case "iso-back-right":
      case "iso-back-left": {
        // For 45° Y rotation: cos(45°) = sin(45°) ≈ 0.707
        // Projected width is approximately: X * 0.707 + Z * 0.707
        const cos45 = 0.707;
        modelWidth = xSpan * cos45 + zSpan * cos45;

        // For 30° X tilt: cos(30°) ≈ 0.866, sin(30°) = 0.5
        // Projected height ≈ Y * 0.866 + Z * 0.5 (Z contributes to visible height)
        const cos30 = 0.866;
        const sin30 = 0.5;
        modelHeight = ySpan * cos30 + zSpan * sin30;
        break;
      }
      default:
        modelWidth = xSpan;
        modelHeight = ySpan;
    }

    // Calculate scale to fit with padding
    const availWidth = outputWidth - padding * 2;
    const availHeight = outputHeight - padding * 2;

    const scaleX = modelWidth > 0 ? availWidth / modelWidth : 1;
    const scaleY = modelHeight > 0 ? availHeight / modelHeight : 1;

    return Math.min(scaleX, scaleY);
  }

  /**
   * Get the 2D bounding box of projected faces.
   */
  private static _getProjectedBounds(faces: IProjectedFace[]): {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  } {
    if (faces.length === 0) {
      return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    }

    let minX = Infinity,
      maxX = -Infinity;
    let minY = Infinity,
      maxY = -Infinity;

    for (const face of faces) {
      minX = Math.min(minX, face.x);
      maxX = Math.max(maxX, face.x + face.width);
      minY = Math.min(minY, face.y);
      maxY = Math.max(maxY, face.y + face.height);
    }

    return { minX, maxX, minY, maxY };
  }
}
