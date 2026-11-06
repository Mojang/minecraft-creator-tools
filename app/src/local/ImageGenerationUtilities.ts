// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import Log from "../core/Log";
import ImageCodec from "../core/ImageCodec";
import ModelDesignUtilities, { IAtlasRegion } from "../minecraft/ModelDesignUtilities";
import TexturedRectangleGenerator from "../minecraft/TexturedRectangleGenerator";
import { applyTextureEffects } from "../minecraft/TextureEffects";

/**
 * Static utility class for PNG generation.
 * Provides methods for encoding RGBA pixel data to PNG, rendering SVG to PNG with resvg,
 * and generating textures from atlas regions. None of them start a browser.
 */
export default class ImageGenerationUtilities {
  /**
   * Encode RGBA pixel data to PNG format.
   * Delegates to ImageCodec for cross-platform encoding.
   *
   * @param pixels RGBA pixel data (4 bytes per pixel)
   * @param width Image width in pixels
   * @param height Image height in pixels
   * @returns PNG data as Uint8Array, or undefined on error
   */
  static encodeRgbaToPng(pixels: Uint8Array, width: number, height: number): Uint8Array | undefined {
    return ImageCodec.encodeToPngSync(pixels, width, height);
  }

  /**
   * Render an SVG string to a PNG data URL using resvg-js.
   * This enables SVG support including gradients, shapes, and complex graphics.
   *
   * @param svgContent SVG content as a string
   * @param width Output image width in pixels
   * @param height Output image height in pixels
   * @returns PNG as data URL, or undefined if rendering fails
   */
  static async renderSvgToDataUrl(svgContent: string, width: number, height: number): Promise<string | undefined> {
    try {
      // Use resvg for fast, reliable SVG to PNG conversion without browser dependency
      const { Resvg } = await import("@resvg/resvg-js");

      // Ensure SVG has proper dimensions set
      // If the SVG doesn't have width/height attributes, we need to add them
      let processedSvg = svgContent;
      if (!svgContent.includes('width="') && !svgContent.includes("width='")) {
        // Add width and height to the SVG element
        processedSvg = svgContent.replace("<svg", `<svg width="${width}" height="${height}"`);
      }

      const resvg = new Resvg(processedSvg, {
        fitTo: {
          mode: "width",
          value: width,
        },
        background: "transparent",
      });

      const pngData = resvg.render();
      const pngBuffer = pngData.asPng();

      // Convert buffer to data URL
      const base64 = pngBuffer.toString("base64");

      return `data:image/png;base64,${base64}`;
    } catch (e) {
      Log.debugAlert(`renderSvgToDataUrl failed: ${e}`);
      return undefined;
    }
  }

  /**
   * Generate a PNG texture from atlas regions.
   * Uses resvg to render SVG content, falls back to simple color fill for color-only regions.
   *
   * @param atlasRegions Array of atlas regions with position, size, and content
   * @param textureSize Texture dimensions as [width, height]
   * @param pixelsPerUnit Pixels per Minecraft unit for pixel art scaling. Default: 2
   * @returns PNG as data URL, or undefined if generation fails
   */
  static async generateTextureFromAtlas(
    atlasRegions: IAtlasRegion[],
    textureSize: [number, number],
    pixelsPerUnit: number = 2
  ): Promise<string | undefined> {
    const [width, height] = textureSize;

    // Check if any region has SVG content (not noise) - if so, use resvg rendering
    // Noise textures are now rendered directly with pixel data for better performance
    const hasSvgContent = atlasRegions.some((region) => region.content.svg);

    if (hasSvgContent) {
      // Generate the full SVG atlas and render it with resvg
      const atlasSvg = ModelDesignUtilities.generateAtlasSvg(atlasRegions, textureSize);
      const rendered = await ImageGenerationUtilities.renderSvgToDataUrl(atlasSvg, width, height);
      if (rendered) {
        return rendered;
      }
      // Fall back to simple rendering if resvg fails
      Log.debug("SVG rendering failed, falling back to simple color rendering");
    }

    // Pixel-based rendering - handles colors and noise directly without SVG rendering
    const pixels = new Uint8Array(width * height * 4);

    // Initialize with transparent black
    for (let i = 0; i < pixels.length; i += 4) {
      pixels[i] = 0; // R
      pixels[i + 1] = 0; // G
      pixels[i + 2] = 0; // B
      pixels[i + 3] = 0; // A (transparent)
    }

    // Fill in each atlas region
    for (const region of atlasRegions) {
      // Prefer background (new unified format), then fall back to noise/color (legacy)
      if (region.content.background) {
        // Generate textured rectangle directly as pixels
        const bgPixels = TexturedRectangleGenerator.generatePixels(
          region.content.background,
          region.width,
          region.height,
          `region-${region.x}-${region.y}`
        );

        // Copy pixels to atlas at the correct position
        for (let dy = 0; dy < region.height && region.y + dy < height; dy++) {
          for (let dx = 0; dx < region.width && region.x + dx < width; dx++) {
            const srcIdx = (dy * region.width + dx) * 4;
            const dstIdx = ((region.y + dy) * width + (region.x + dx)) * 4;
            pixels[dstIdx] = bgPixels[srcIdx];
            pixels[dstIdx + 1] = bgPixels[srcIdx + 1];
            pixels[dstIdx + 2] = bgPixels[srcIdx + 2];
            pixels[dstIdx + 3] = bgPixels[srcIdx + 3];
          }
        }
      } else if (region.content.noise) {
        // Legacy: Generate noise texture directly as pixels - no SVG rendering needed
        const noisePixels = TexturedRectangleGenerator.generateNoisePixels(
          region.content.noise,
          region.width,
          region.height,
          `region-${region.x}-${region.y}`
        );

        // Copy noise pixels to atlas at the correct position
        for (let dy = 0; dy < region.height && region.y + dy < height; dy++) {
          for (let dx = 0; dx < region.width && region.x + dx < width; dx++) {
            const srcIdx = (dy * region.width + dx) * 4;
            const dstIdx = ((region.y + dy) * width + (region.x + dx)) * 4;
            pixels[dstIdx] = noisePixels[srcIdx];
            pixels[dstIdx + 1] = noisePixels[srcIdx + 1];
            pixels[dstIdx + 2] = noisePixels[srcIdx + 2];
            pixels[dstIdx + 3] = noisePixels[srcIdx + 3];
          }
        }
      } else if (region.content.color) {
        // Fill with solid color
        const parsed = ModelDesignUtilities.parseColor(region.content.color);
        const color = { r: parsed.r, g: parsed.g, b: parsed.b, a: parsed.a ?? 255 };

        for (let y = region.y; y < region.y + region.height && y < height; y++) {
          for (let x = region.x; x < region.x + region.width && x < width; x++) {
            const idx = (y * width + x) * 4;
            pixels[idx] = color.r;
            pixels[idx + 1] = color.g;
            pixels[idx + 2] = color.b;
            pixels[idx + 3] = color.a;
          }
        }
      } else if (region.content.svg) {
        // If we reach here with SVG content, resvg rendering failed
        // Use a placeholder magenta color to make it obvious
        for (let y = region.y; y < region.y + region.height && y < height; y++) {
          for (let x = region.x; x < region.x + region.width && x < width; x++) {
            const idx = (y * width + x) * 4;
            pixels[idx] = 255; // R (magenta)
            pixels[idx + 1] = 0; // G
            pixels[idx + 2] = 255; // B
            pixels[idx + 3] = 255; // A
          }
        }
      }

      // Apply pixel art on top of background (if present)
      // This is done separately so pixel art can overlay any background type
      if (region.content.pixelArt && region.content.pixelArt.length > 0) {
        // Create a temporary buffer for this region
        const regionPixels = new Uint8Array(region.width * region.height * 4);

        // Copy current region content to temp buffer
        for (let dy = 0; dy < region.height && region.y + dy < height; dy++) {
          for (let dx = 0; dx < region.width && region.x + dx < width; dx++) {
            const srcIdx = ((region.y + dy) * width + (region.x + dx)) * 4;
            const dstIdx = (dy * region.width + dx) * 4;
            regionPixels[dstIdx] = pixels[srcIdx];
            regionPixels[dstIdx + 1] = pixels[srcIdx + 1];
            regionPixels[dstIdx + 2] = pixels[srcIdx + 2];
            regionPixels[dstIdx + 3] = pixels[srcIdx + 3];
          }
        }

        // Apply pixel art layers
        TexturedRectangleGenerator.applyPixelArtLayers(
          regionPixels,
          region.width,
          region.height,
          region.content.pixelArt,
          pixelsPerUnit
        );

        // Copy back to atlas
        for (let dy = 0; dy < region.height && region.y + dy < height; dy++) {
          for (let dx = 0; dx < region.width && region.x + dx < width; dx++) {
            const srcIdx = (dy * region.width + dx) * 4;
            const dstIdx = ((region.y + dy) * width + (region.x + dx)) * 4;
            pixels[dstIdx] = regionPixels[srcIdx];
            pixels[dstIdx + 1] = regionPixels[srcIdx + 1];
            pixels[dstIdx + 2] = regionPixels[srcIdx + 2];
            pixels[dstIdx + 3] = regionPixels[srcIdx + 3];
          }
        }
      }

      // Apply post-processing effects (lighting, borders, overlays, etc.)
      // This is done after pixel art so effects can modify the complete texture
      if (region.content.effects) {
        // Create a temporary buffer for this region
        const regionPixels = new Uint8Array(region.width * region.height * 4);

        // Copy current region content to temp buffer
        for (let dy = 0; dy < region.height && region.y + dy < height; dy++) {
          for (let dx = 0; dx < region.width && region.x + dx < width; dx++) {
            const srcIdx = ((region.y + dy) * width + (region.x + dx)) * 4;
            const dstIdx = (dy * region.width + dx) * 4;
            regionPixels[dstIdx] = pixels[srcIdx];
            regionPixels[dstIdx + 1] = pixels[srcIdx + 1];
            regionPixels[dstIdx + 2] = pixels[srcIdx + 2];
            regionPixels[dstIdx + 3] = pixels[srcIdx + 3];
          }
        }

        // Apply effects to region
        applyTextureEffects(regionPixels, region.width, region.height, region.content.effects);

        // Copy back to atlas
        for (let dy = 0; dy < region.height && region.y + dy < height; dy++) {
          for (let dx = 0; dx < region.width && region.x + dx < width; dx++) {
            const srcIdx = (dy * region.width + dx) * 4;
            const dstIdx = ((region.y + dy) * width + (region.x + dx)) * 4;
            pixels[dstIdx] = regionPixels[srcIdx];
            pixels[dstIdx + 1] = regionPixels[srcIdx + 1];
            pixels[dstIdx + 2] = regionPixels[srcIdx + 2];
            pixels[dstIdx + 3] = regionPixels[srcIdx + 3];
          }
        }
      }
    }

    // Encode as PNG using a minimal PNG encoder
    const pngData = ImageGenerationUtilities.encodeRgbaToPng(pixels, width, height);
    if (pngData) {
      return `data:image/png;base64,${Buffer.from(pngData).toString("base64")}`;
    }

    return undefined;
  }
}
