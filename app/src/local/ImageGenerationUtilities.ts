// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import Log from "../core/Log";
import ImageCodec from "../core/ImageCodec";
import ModelDesignUtilities, { IAtlasRegion } from "../minecraft/ModelDesignUtilities";
import TexturedRectangleGenerator from "../minecraft/TexturedRectangleGenerator";
import { IMcpModelDesign } from "../minecraft/IMcpModelDesign";
import { applyTextureEffects } from "../minecraft/TextureEffects";

/**
 * Texture swatch information for rendering.
 */
export interface ITextureSwatch {
  /** Label/name to display with the swatch */
  label: string;
  /** Color value (hex string) */
  color?: string;
  /** SVG content */
  svg?: string;
}

/**
 * Static utility class for PNG generation and image manipulation.
 * Provides methods for encoding RGBA pixel data to PNG, rendering SVG to PNG,
 * generating textures from atlas regions, and stitching images together.
 */
export default class ImageGenerationUtilities {
  private static _crc32Table: Uint32Array | undefined;

  // Cached browser instance for rendering - avoids launching a new browser each time
  // Note: Only the browser is cached, contexts are created fresh for each operation
  private static _cachedBrowser: any = null;

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
   * Create a PNG chunk with type, data, and CRC.
   *
   * @param type 4-character chunk type (e.g., "IHDR", "IDAT", "IEND")
   * @param data Chunk data
   * @returns Complete chunk including length, type, data, and CRC
   */
  static createPngChunk(type: string, data: Uint8Array): Uint8Array {
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
    const crc = ImageGenerationUtilities.crc32(chunk.subarray(4, 8 + length));
    view.setUint32(8 + length, crc, false);

    return chunk;
  }

  /**
   * Calculate CRC32 checksum for PNG chunk validation.
   *
   * @param data Data to calculate CRC32 for
   * @returns CRC32 checksum as unsigned 32-bit integer
   */
  static crc32(data: Uint8Array): number {
    let crc = 0xffffffff;
    const table = ImageGenerationUtilities.getCrc32Table();

    for (let i = 0; i < data.length; i++) {
      crc = table[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
    }

    return (crc ^ 0xffffffff) >>> 0;
  }

  /**
   * Get the CRC32 lookup table, generating it on first call.
   *
   * @returns CRC32 lookup table
   */
  static getCrc32Table(): Uint32Array {
    if (ImageGenerationUtilities._crc32Table) {
      return ImageGenerationUtilities._crc32Table;
    }

    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      table[i] = c;
    }

    ImageGenerationUtilities._crc32Table = table;
    return table;
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
   * Close the cached browser instance.
   * Call this when done with rendering to clean up resources.
   */
  static async closeCachedBrowser(): Promise<void> {
    if (ImageGenerationUtilities._cachedBrowser) {
      try {
        await ImageGenerationUtilities._cachedBrowser.close();
      } catch {
        // Ignore close errors
      }
      ImageGenerationUtilities._cachedBrowser = null;
    }
  }

  /**
   * Ensure the cached browser is available.
   * Initializes the browser if not already running.
   * If the browser has disconnected, creates a new one.
   */
  static async ensureCachedBrowser(): Promise<void> {
    // Check if the cached browser is still connected
    if (ImageGenerationUtilities._cachedBrowser) {
      try {
        // Check if browser is still connected by checking isConnected()
        if (!ImageGenerationUtilities._cachedBrowser.isConnected()) {
          Log.debug("Cached browser disconnected, will create new one");
          ImageGenerationUtilities._cachedBrowser = null;
        }
      } catch {
        // If we can't check connection status, assume it's invalid
        Log.debug("Cached browser in invalid state, will create new one");
        ImageGenerationUtilities._cachedBrowser = null;
      }
    }

    if (!ImageGenerationUtilities._cachedBrowser) {
      // Set environment variable to skip font loading wait during screenshots
      // This prevents timeout issues when fonts fail to load
      process.env["PW_TEST_SCREENSHOT_NO_FONTS_READY"] = "1";

      const playwright = await import("playwright");

      // Try to find a working browser
      const browserConfigs = [
        { name: "System Chrome", options: { channel: "chrome" as const, headless: true } },
        { name: "System Edge", options: { channel: "msedge" as const, headless: true } },
        { name: "Playwright Chromium", options: { headless: true } },
      ];

      for (const config of browserConfigs) {
        try {
          ImageGenerationUtilities._cachedBrowser = await playwright.chromium.launch(config.options);
          Log.debug(`ImageGenerationUtilities: Launched browser using ${config.name}`);
          break;
        } catch {
          continue;
        }
      }
    }
  }

  /**
   * Generate a PNG texture from atlas regions.
   * Uses Playwright to render SVG content, falls back to simple color fill for color-only regions.
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

    // Check if any region has SVG content (not noise) - if so, use Playwright rendering
    // Noise textures are now rendered directly with pixel data for better performance
    const hasSvgContent = atlasRegions.some((region) => region.content.svg);

    if (hasSvgContent) {
      // Generate the full SVG atlas and render it with Playwright
      const atlasSvg = ModelDesignUtilities.generateAtlasSvg(atlasRegions, textureSize);
      const rendered = await ImageGenerationUtilities.renderSvgToDataUrl(atlasSvg, width, height);
      if (rendered) {
        return rendered;
      }
      // Fall back to simple rendering if Playwright fails
      Log.debug("SVG rendering failed, falling back to simple color rendering");
    }

    // Pixel-based rendering - handles colors and noise directly without Playwright
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
        // Legacy: Generate noise texture directly as pixels - no SVG/Playwright needed
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
        // If we reach here with SVG content, Playwright rendering failed
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

  /**
   * Stitch multiple images together with labels in a grid layout.
   * Uses Playwright to compose images and add text labels.
   *
   * @param images Array of images with labels and PNG data (may include isWide property for pyramid layout)
   * @param singleWidth Width of each individual image (half-width for pyramid layout)
   * @param singleHeight Height of each individual image
   * @param cols Number of columns in grid (default: images.length for horizontal row)
   * @param rows Number of rows in grid (default: 1 for horizontal row)
   * @param layout Optional layout mode: "pyramid" for 2-on-top, 1-spanning-bottom layout
   * @returns Stitched image as PNG data, or first image on failure
   */
  static async stitchImagesWithLabels(
    images: { label: string; imageData: Uint8Array; isWide?: boolean }[],
    singleWidth: number,
    singleHeight: number,
    cols?: number,
    rows?: number,
    layout?: "pyramid" | undefined
  ): Promise<Uint8Array | undefined> {
    try {
      // Use cached browser for performance
      await ImageGenerationUtilities.ensureCachedBrowser();

      if (!ImageGenerationUtilities._cachedBrowser) {
        Log.debug("No browser available for image stitching");
        return images[0]?.imageData; // Fall back to first image
      }

      // Use provided grid dimensions or default to horizontal row
      const gridCols = cols ?? images.length;
      const gridRows = rows ?? 1;
      const isPyramidLayout = layout === "pyramid" && images.length === 3;

      const labelHeight = 30;
      const totalWidth = singleWidth * gridCols;
      const totalHeight = (singleHeight + labelHeight) * gridRows;

      // Create fresh context for reliability (browser is cached, contexts are cheap)
      let context;
      try {
        context = await ImageGenerationUtilities._cachedBrowser.newContext({
          viewport: { width: totalWidth, height: totalHeight },
        });
        const page = await context.newPage();

        // Create HTML with canvas for stitching
        const imageDataUrls = images.map((img) => {
          const base64 = Buffer.from(img.imageData).toString("base64");
          return `data:image/png;base64,${base64}`;
        });

        // Track which images are wide (for pyramid layout)
        const isWideFlags = images.map((img) => img.isWide === true);

        const html = `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { margin: 0; padding: 0; background: transparent; }
              canvas { display: block; }
            </style>
          </head>
          <body>
            <canvas id="canvas" width="${totalWidth}" height="${totalHeight}"></canvas>
            <script>
              async function stitch() {
                const canvas = document.getElementById('canvas');
                const ctx = canvas.getContext('2d');
                
                // Fill background
                ctx.fillStyle = '#1a1a2e';
                ctx.fillRect(0, 0, ${totalWidth}, ${totalHeight});
                
                const imageUrls = ${JSON.stringify(imageDataUrls)};
                const labels = ${JSON.stringify(images.map((i) => i.label))};
                const isWideFlags = ${JSON.stringify(isWideFlags)};
                const isPyramidLayout = ${isPyramidLayout};
                const singleWidth = ${singleWidth};
                const singleHeight = ${singleHeight};
                const labelHeight = ${labelHeight};
                const gridCols = ${gridCols};
                const cellHeight = singleHeight + labelHeight;
                const totalWidth = ${totalWidth};
                
                // Load and draw each image
                for (let i = 0; i < imageUrls.length; i++) {
                  const isWide = isWideFlags[i];
                  const imgWidth = isWide ? totalWidth : singleWidth;
                  
                  // Calculate position based on layout
                  let xOffset, yOffset;
                  if (isPyramidLayout) {
                    if (i < 2) {
                      // First two images: top row, side by side
                      xOffset = i * singleWidth;
                      yOffset = 0;
                    } else {
                      // Third image: bottom row, spanning full width
                      xOffset = 0;
                      yOffset = cellHeight;
                    }
                  } else {
                    // Standard grid layout
                    const col = i % gridCols;
                    const row = Math.floor(i / gridCols);
                    xOffset = col * singleWidth;
                    yOffset = row * cellHeight;
                  }

                  const img = new Image();
                  await new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = reject;
                    img.src = imageUrls[i];
                  });
                  
                  // Draw label background at top of cell
                  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                  ctx.fillRect(xOffset, yOffset, imgWidth, labelHeight);
                  
                  // Draw label text
                  ctx.fillStyle = '#ffffff';
                  ctx.font = 'bold 16px Arial, sans-serif';
                  ctx.textAlign = 'center';
                  ctx.textBaseline = 'middle';
                  ctx.fillText(labels[i], xOffset + imgWidth / 2, yOffset + labelHeight / 2);
                  
                  // Draw image (below label)
                  ctx.drawImage(img, xOffset, yOffset + labelHeight, imgWidth, singleHeight);
                  
                  // Draw vertical separator line between columns (not for wide images)
                  if (!isWide && xOffset > 0) {
                    ctx.strokeStyle = '#444';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(xOffset, yOffset);
                    ctx.lineTo(xOffset, yOffset + cellHeight);
                    ctx.stroke();
                  }
                  
                  // Draw horizontal separator line between rows
                  if (yOffset > 0 && xOffset === 0) {
                    ctx.strokeStyle = '#444';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(0, yOffset);
                    ctx.lineTo(${totalWidth}, yOffset);
                    ctx.stroke();
                  }
                }
                
                window.stitchComplete = true;
              }
              stitch().catch(e => { window.stitchError = e.message; });
            </script>
          </body>
          </html>
        `;

        await page.setContent(html, { waitUntil: "domcontentloaded" });

        // Wait for stitching to complete
        // @ts-ignore
        await page.waitForFunction(() => (window as any).stitchComplete || (window as any).stitchError, {
          timeout: 5000,
        });

        // @ts-ignore
        const error = await page.evaluate(() => (window as any).stitchError);
        if (error) {
          Log.debug(`Image stitch error: ${error}`);
          return images[0]?.imageData;
        }

        // Get the canvas as PNG - use page.screenshot with clip
        // (locator.screenshot has stability issues)
        const canvasBuffer = await page.screenshot({
          type: "png",
          clip: { x: 0, y: 0, width: totalWidth, height: totalHeight },
          timeout: 5000,
        });

        return canvasBuffer;
      } finally {
        // Always clean up the context
        if (context) {
          try {
            await context.close();
          } catch {
            // Ignore close errors
          }
        }
      }
    } catch (e) {
      Log.debug(`Image stitching failed: ${e}`);
      return images[0]?.imageData; // Fall back to first image
    }
  }

  /**
   * Convert PNG image data to JPEG format with optional quality setting.
   * Uses browser canvas for encoding.
   *
   * @param pngData PNG image data as Uint8Array
   * @param quality JPEG quality 1-100 (default: 80)
   * @returns JPEG image data as Uint8Array, or original PNG on failure
   */
  static async convertPngToJpeg(pngData: Uint8Array, quality: number = 80): Promise<Uint8Array> {
    try {
      // Use cached browser for performance
      await ImageGenerationUtilities.ensureCachedBrowser();

      if (!ImageGenerationUtilities._cachedBrowser) {
        Log.debug("No browser available for JPEG conversion");
        return pngData; // Return original PNG
      }

      // Create a temporary page/context for conversion (small viewport is fine)
      const tempContext = await ImageGenerationUtilities._cachedBrowser.newContext();
      const page = await tempContext.newPage();

      const base64Png = Buffer.from(pngData).toString("base64");
      const dataUrl = `data:image/png;base64,${base64Png}`;

      // Use browser canvas to convert PNG to JPEG
      const html = `
        <!DOCTYPE html>
        <html>
        <head><style>body { margin: 0; }</style></head>
        <body>
          <canvas id="canvas"></canvas>
          <script>
            async function convert() {
              const img = new Image();
              await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = "${dataUrl}";
              });
              
              const canvas = document.getElementById('canvas');
              canvas.width = img.width;
              canvas.height = img.height;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(img, 0, 0);
              
              // Convert to JPEG
              const jpegDataUrl = canvas.toDataURL('image/jpeg', ${quality / 100});
              window.jpegData = jpegDataUrl;
              window.convertComplete = true;
            }
            convert().catch(e => { window.convertError = e.message; });
          </script>
        </body>
        </html>
      `;

      await page.setContent(html);

      // Wait for conversion
      // @ts-ignore
      await page.waitForFunction(() => (window as any).convertComplete || (window as any).convertError, {
        timeout: 5000,
      });

      // @ts-ignore
      const error = await page.evaluate(() => (window as any).convertError);
      if (error) {
        Log.debug(`JPEG conversion error: ${error}`);
        await tempContext.close();
        return pngData;
      }

      // @ts-ignore
      const jpegDataUrl = await page.evaluate(() => (window as any).jpegData);
      await tempContext.close();

      // Extract base64 data from data URL
      const base64Match = jpegDataUrl.match(/^data:image\/jpeg;base64,(.*)$/);
      if (base64Match) {
        return new Uint8Array(Buffer.from(base64Match[1], "base64"));
      }

      return pngData; // Return original on failure
    } catch (e) {
      Log.debug(`JPEG conversion failed: ${e}`);
      return pngData; // Return original PNG on failure
    }
  }

  /**
   * Recompress a PNG image with maximum compression level (9).
   * Decodes the PNG, then re-encodes with higher compression.
   * This can significantly reduce file size for screenshots.
   *
   * @param pngData PNG image data as Uint8Array
   * @returns Recompressed PNG data, or original on failure
   */
  static recompressPng(pngData: Uint8Array): Uint8Array {
    try {
      const zlib = require("zlib");

      // Parse the PNG to extract IHDR and pixel data
      const parsed = ImageGenerationUtilities.parsePng(pngData);
      if (!parsed) {
        return pngData; // Return original if parsing fails
      }

      const { width, height, pixels } = parsed;

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

      const ihdrChunk = ImageGenerationUtilities.createPngChunk("IHDR", ihdr);

      // Prepare raw data with filter bytes (use sub filter for potentially better compression)
      const rawData = new Uint8Array(height * (1 + width * 4));
      for (let y = 0; y < height; y++) {
        rawData[y * (1 + width * 4)] = 0; // filter byte (none - simplest)
        for (let x = 0; x < width; x++) {
          const srcIdx = (y * width + x) * 4;
          const dstIdx = y * (1 + width * 4) + 1 + x * 4;
          rawData[dstIdx] = pixels[srcIdx]; // R
          rawData[dstIdx + 1] = pixels[srcIdx + 1]; // G
          rawData[dstIdx + 2] = pixels[srcIdx + 2]; // B
          rawData[dstIdx + 3] = pixels[srcIdx + 3]; // A
        }
      }

      // Compress with maximum level (9)
      const compressed = zlib.deflateSync(rawData, { level: 9 });
      const idatChunk = ImageGenerationUtilities.createPngChunk("IDAT", new Uint8Array(compressed));

      // IEND chunk
      const iendChunk = ImageGenerationUtilities.createPngChunk("IEND", new Uint8Array(0));

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

      // Only return if smaller
      if (png.length < pngData.length) {
        return png;
      }
      return pngData;
    } catch (e) {
      Log.debug(`PNG recompression failed: ${e}`);
      return pngData; // Return original on failure
    }
  }

  /**
   * Parse a PNG file to extract width, height, and pixel data.
   * Supports only 8-bit RGBA (color type 6) non-interlaced PNGs.
   *
   * @param pngData PNG file data
   * @returns Parsed data or undefined on failure
   */
  static parsePng(pngData: Uint8Array): { width: number; height: number; pixels: Uint8Array } | undefined {
    try {
      const zlib = require("zlib");

      // Check PNG signature
      const signature = [137, 80, 78, 71, 13, 10, 26, 10];
      for (let i = 0; i < 8; i++) {
        if (pngData[i] !== signature[i]) {
          return undefined; // Not a valid PNG
        }
      }

      let offset = 8;
      let width = 0;
      let height = 0;
      let bitDepth = 0;
      let colorType = 0;
      const idatChunks: Uint8Array[] = [];

      // Parse chunks
      while (offset < pngData.length) {
        const length = new DataView(pngData.buffer, pngData.byteOffset + offset, 4).getUint32(0, false);
        const type = String.fromCharCode(
          pngData[offset + 4],
          pngData[offset + 5],
          pngData[offset + 6],
          pngData[offset + 7]
        );

        if (type === "IHDR") {
          const ihdrData = pngData.slice(offset + 8, offset + 8 + length);
          const view = new DataView(ihdrData.buffer, ihdrData.byteOffset, ihdrData.length);
          width = view.getUint32(0, false);
          height = view.getUint32(4, false);
          bitDepth = ihdrData[8];
          colorType = ihdrData[9];

          // Only support 8-bit RGBA for now
          if (bitDepth !== 8 || colorType !== 6) {
            return undefined;
          }
        } else if (type === "IDAT") {
          idatChunks.push(pngData.slice(offset + 8, offset + 8 + length));
        } else if (type === "IEND") {
          break;
        }

        offset += 12 + length; // 4 (length) + 4 (type) + length + 4 (CRC)
      }

      if (width === 0 || height === 0 || idatChunks.length === 0) {
        return undefined;
      }

      // Concatenate IDAT chunks and decompress
      const totalIdatLength = idatChunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const combinedIdat = new Uint8Array(totalIdatLength);
      let idatOffset = 0;
      for (const chunk of idatChunks) {
        combinedIdat.set(chunk, idatOffset);
        idatOffset += chunk.length;
      }

      const decompressed = zlib.inflateSync(combinedIdat);

      // Remove filter bytes and extract raw RGBA pixels
      const pixels = new Uint8Array(width * height * 4);
      const bytesPerRow = 1 + width * 4; // 1 filter byte + RGBA data

      for (let y = 0; y < height; y++) {
        const filterByte = decompressed[y * bytesPerRow];
        const rowStart = y * bytesPerRow + 1;
        const pixelRowStart = y * width * 4;

        // Apply reverse filter
        for (let x = 0; x < width * 4; x++) {
          let value = decompressed[rowStart + x];

          if (filterByte === 1) {
            // Sub filter
            const a = x >= 4 ? pixels[pixelRowStart + x - 4] : 0;
            value = (value + a) & 0xff;
          } else if (filterByte === 2) {
            // Up filter
            const b = y > 0 ? pixels[pixelRowStart - width * 4 + x] : 0;
            value = (value + b) & 0xff;
          } else if (filterByte === 3) {
            // Average filter
            const a = x >= 4 ? pixels[pixelRowStart + x - 4] : 0;
            const b = y > 0 ? pixels[pixelRowStart - width * 4 + x] : 0;
            value = (value + Math.floor((a + b) / 2)) & 0xff;
          } else if (filterByte === 4) {
            // Paeth filter
            const a = x >= 4 ? pixels[pixelRowStart + x - 4] : 0;
            const b = y > 0 ? pixels[pixelRowStart - width * 4 + x] : 0;
            const c = x >= 4 && y > 0 ? pixels[pixelRowStart - width * 4 + x - 4] : 0;
            value = (value + ImageGenerationUtilities.paethPredictor(a, b, c)) & 0xff;
          }
          // filterByte === 0 means no filter, value stays as-is

          pixels[pixelRowStart + x] = value;
        }
      }

      return { width, height, pixels };
    } catch (e) {
      Log.debug(`PNG parsing failed: ${e}`);
      return undefined;
    }
  }

  /**
   * Paeth predictor function for PNG decompression.
   */
  private static paethPredictor(a: number, b: number, c: number): number {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    if (pa <= pb && pa <= pc) return a;
    if (pb <= pc) return b;
    return c;
  }

  /**
   * Extract texture swatches from a model design.
   * Collects all named textures from the textures dictionary,
   * plus unique solid colors used on faces.
   *
   * @param design The model design to extract swatches from
   * @returns Array of texture swatches with labels and content
   */
  static extractTextureSwatches(design: IMcpModelDesign): ITextureSwatch[] {
    const swatches: ITextureSwatch[] = [];
    const seenColors = new Set<string>();

    // Extract from textures dictionary
    if (design.textures) {
      for (const [name, textureDef] of Object.entries(design.textures)) {
        const swatch: ITextureSwatch = { label: name };

        if (textureDef.svg) {
          swatch.svg = textureDef.svg;
        } else if (textureDef.background) {
          // Generate SVG from textured rectangle configuration (new format)
          const bgSvg = TexturedRectangleGenerator.generateTexturedRectangleSvg(
            textureDef.background,
            48,
            48,
            `swatch-${name}`
          );
          swatch.svg = bgSvg;
        } else if (textureDef.noise) {
          // Legacy: Generate SVG from noise configuration
          const noiseSvg = TexturedRectangleGenerator.generateNoiseSvg(textureDef.noise, 48, 48, `swatch-${name}`);
          swatch.svg = noiseSvg;
        } else if (textureDef.color) {
          swatch.color = typeof textureDef.color === "string" ? textureDef.color : undefined;
          if (typeof textureDef.color === "object") {
            const c = textureDef.color;
            swatch.color = `rgb(${c.r}, ${c.g}, ${c.b})`;
          }
        }

        if (swatch.color || swatch.svg) {
          swatches.push(swatch);
          if (swatch.color) {
            seenColors.add(swatch.color.toLowerCase());
          }
        }
      }
    }

    // Extract unique solid colors from face definitions
    if (design.bones) {
      for (const bone of design.bones) {
        if (bone.cubes) {
          for (const cube of bone.cubes) {
            if (cube.faces) {
              const faceNames = ["north", "south", "east", "west", "up", "down"] as const;
              for (const faceName of faceNames) {
                const face = cube.faces[faceName];
                if (face && face.color && !face.textureId && !face.svg) {
                  let colorStr: string;
                  if (typeof face.color === "string") {
                    colorStr = face.color;
                  } else if (typeof face.color === "object") {
                    const c = face.color;
                    colorStr = `rgb(${c.r}, ${c.g}, ${c.b})`;
                  } else {
                    continue;
                  }

                  const colorKey = colorStr.toLowerCase();
                  if (!seenColors.has(colorKey)) {
                    seenColors.add(colorKey);
                    swatches.push({ label: colorStr, color: colorStr });
                  }
                }
              }
            }
          }
        }
      }
    }

    return swatches;
  }

  /**
   * Generate a swatch strip and append it to the main image in a single browser session.
   * This is more efficient than calling generateSwatchStrip and appendSwatchStrip separately.
   *
   * @param mainImage The main image PNG data
   * @param swatches Array of texture swatches to render
   * @param mainWidth Width of the main image
   * @param mainHeight Height of the main image
   * @param swatchesPerRow Number of swatches per row (default: 6)
   * @returns Combined image with swatches below, or original image on failure
   */
  static async generateAndAppendSwatchStrip(
    mainImage: Uint8Array,
    swatches: ITextureSwatch[],
    mainWidth: number,
    mainHeight: number,
    swatchesPerRow: number = 6
  ): Promise<Uint8Array> {
    if (swatches.length === 0) {
      return mainImage;
    }

    let freshBrowser: any = null;
    try {
      // Calculate swatch strip dimensions
      const padding = 4;
      const swatchSize = Math.min(48, Math.floor((mainWidth - padding * 2) / swatchesPerRow) - padding * 2);
      const labelHeight = 16;
      const cellWidth = Math.floor(mainWidth / swatchesPerRow);
      const cellHeight = swatchSize + labelHeight + padding * 2;
      const numRows = Math.ceil(swatches.length / swatchesPerRow);
      const titleHeight = 18;
      const stripHeight = titleHeight + numRows * cellHeight + padding;
      const totalHeight = mainHeight + stripHeight;

      // Launch a single fresh browser for all operations
      const playwright = await import("playwright");
      freshBrowser = await playwright.chromium.launch({ channel: "chrome", headless: true });

      const context = await freshBrowser.newContext({
        viewport: { width: mainWidth, height: totalHeight },
      });

      try {
        const page = await context.newPage();

        const mainBase64 = Buffer.from(mainImage).toString("base64");

        // Build the swatch elements HTML
        // Note: y positions are relative to swatchArea div, not the page
        const swatchElements = swatches
          .map((swatch, i) => {
            const col = i % swatchesPerRow;
            const row = Math.floor(i / swatchesPerRow);
            const x = col * cellWidth + padding;
            const y = titleHeight + row * cellHeight;

            let fillContent = "";
            if (swatch.svg) {
              const svgMatch = swatch.svg.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);
              const innerSvg = svgMatch ? svgMatch[1] : "";
              const viewBoxMatch = swatch.svg.match(/viewBox=["']([^"']+)["']/i);
              const viewBox = viewBoxMatch ? viewBoxMatch[1] : "0 0 16 16";
              fillContent = `<svg viewBox="${viewBox}" width="${swatchSize}" height="${swatchSize}">${innerSvg}</svg>`;
            } else if (swatch.color) {
              fillContent = `<div style="width: ${swatchSize}px; height: ${swatchSize}px; background-color: ${swatch.color}; border-radius: 2px;"></div>`;
            }

            return `
              <div style="position: absolute; left: ${x}px; top: ${y}px; width: ${
              cellWidth - padding * 2
            }px; text-align: center;">
                <div style="display: flex; justify-content: center; align-items: center; border: 1px solid #555; border-radius: 3px; overflow: hidden; width: ${swatchSize}px; height: ${swatchSize}px; margin: 0 auto;">
                  ${fillContent}
                </div>
                <div style="color: #ccc; font-size: 10px; font-family: Arial, sans-serif; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                  ${swatch.label}
                </div>
              </div>
            `;
          })
          .join("");

        const windowRef = "window";
        const html = `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { margin: 0; padding: 0; background: transparent; }
              canvas { display: block; }
            </style>
          </head>
          <body>
            <div id="container" style="position: relative; width: ${mainWidth}px; height: ${totalHeight}px;">
              <canvas id="canvas" width="${mainWidth}" height="${mainHeight}"></canvas>
              <div id="swatchArea" style="position: absolute; left: 0; top: ${mainHeight}px; width: 100%; height: ${stripHeight}px; background: #1a1a2e;">
                <div style="position: absolute; left: 0; top: 0; width: 100%; height: ${titleHeight}px; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.4);">
                  <span style="color: #888; font-size: 11px; font-family: Arial, sans-serif;">Textures</span>
                </div>
                ${swatchElements}
              </div>
            </div>
            <script>
              async function render() {
                const canvas = document.getElementById('canvas');
                const ctx = canvas.getContext('2d');
                
                const mainImg = new Image();
                await new Promise((resolve, reject) => {
                  mainImg.onload = resolve;
                  mainImg.onerror = reject;
                  mainImg.src = 'data:image/png;base64,${mainBase64}';
                });
                
                ctx.drawImage(mainImg, 0, 0, ${mainWidth}, ${mainHeight});
                ${windowRef}.renderComplete = true;
              }
              render().catch(e => { ${windowRef}.renderError = e.message; });
            </script>
          </body>
          </html>
        `;

        await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 10000 });

        // Wait for rendering
        // @ts-ignore - accessing window properties set by browser script
        await page.waitForFunction(() => (window as any).renderComplete || (window as any).renderError, {
          timeout: 10000,
        });

        // @ts-ignore - accessing window properties set by browser script
        const error = await page.evaluate(() => (window as any).renderError);
        if (error) {
          Log.debug(`Swatch strip render error: ${error}`);
          return mainImage;
        }

        // Brief wait for any final rendering
        await page.waitForTimeout(50);

        // Capture the combined image
        const combinedBuffer = await page.screenshot({
          type: "png",
          clip: { x: 0, y: 0, width: mainWidth, height: totalHeight },
          timeout: 5000,
        });

        return combinedBuffer;
      } finally {
        try {
          await context.close();
        } catch {
          // Ignore
        }
      }
    } catch (e) {
      Log.debug(`Combined swatch generation failed: ${e}`);
      return mainImage;
    } finally {
      if (freshBrowser) {
        try {
          await freshBrowser.close();
        } catch {
          // Ignore
        }
      }
    }
  }

  /**
   * Generate a swatch strip image showing labeled texture samples.
   * Renders swatches in rows of up to \`swatchesPerRow\`.
   *
   * @param swatches Array of texture swatches to render
   * @param stripWidth Total width of the swatch strip
   * @param swatchesPerRow Number of swatches per row (default: 4)
   * @returns PNG data as Uint8Array, or undefined on failure
   */
  static async generateSwatchStrip(
    swatches: ITextureSwatch[],
    stripWidth: number,
    swatchesPerRow: number = 4
  ): Promise<Uint8Array | undefined> {
    if (swatches.length === 0) {
      return undefined;
    }

    let freshBrowser: any = null;
    try {
      // Calculate dimensions - compact layout with NO extra top padding
      const padding = 4;
      const swatchSize = Math.min(48, Math.floor((stripWidth - padding * 2) / swatchesPerRow) - padding * 2);
      const labelHeight = 16;
      const cellWidth = Math.floor(stripWidth / swatchesPerRow);
      const cellHeight = swatchSize + labelHeight + padding * 2;
      const numRows = Math.ceil(swatches.length / swatchesPerRow);
      const titleHeight = 18;
      // Strip height: just title + rows + bottom padding - NO extra top padding
      const stripHeight = titleHeight + numRows * cellHeight + padding;

      // Launch a fresh browser for swatch generation to avoid contention with main renderer
      const playwright = await import("playwright");
      freshBrowser = await playwright.chromium.launch({ channel: "chrome", headless: true });

      // Create fresh context for reliability
      let context;
      let page;
      try {
        context = await freshBrowser.newContext({
          viewport: { width: stripWidth, height: stripHeight },
        });
        page = await context.newPage();

        // Build the swatch elements HTML
        const swatchElements = swatches
          .map((swatch, i) => {
            const col = i % swatchesPerRow;
            const row = Math.floor(i / swatchesPerRow);
            const x = col * cellWidth + padding;
            // Place swatches directly after title - no extra top padding between title and first row
            const y = titleHeight + row * cellHeight;

            let fillContent = "";
            if (swatch.svg) {
              // Embed SVG content
              const svgMatch = swatch.svg.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);
              const innerSvg = svgMatch ? svgMatch[1] : "";
              const viewBoxMatch = swatch.svg.match(/viewBox=["']([^"']+)["']/i);
              const viewBox = viewBoxMatch ? viewBoxMatch[1] : "0 0 16 16";
              fillContent = `<svg viewBox="${viewBox}" width="${swatchSize}" height="${swatchSize}">${innerSvg}</svg>`;
            } else if (swatch.color) {
              fillContent = `<div style="width: ${swatchSize}px; height: ${swatchSize}px; background-color: ${swatch.color}; border-radius: 2px;"></div>`;
            }

            return `
              <div style="position: absolute; left: ${x}px; top: ${y}px; width: ${
              cellWidth - padding * 2
            }px; text-align: center;">
                <div style="display: flex; justify-content: center; align-items: center; border: 1px solid #555; border-radius: 3px; overflow: hidden; width: ${swatchSize}px; height: ${swatchSize}px; margin: 0 auto;">
                  ${fillContent}
                </div>
                <div style="color: #ccc; font-size: 10px; font-family: Arial, sans-serif; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                  ${swatch.label}
                </div>
              </div>
            `;
          })
          .join("");

        const html = `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { margin: 0; padding: 0; background: #1a1a2e; }
            </style>
          </head>
          <body>
            <div id="container" style="width: ${stripWidth}px; height: ${stripHeight}px; position: relative;">
              <div style="position: absolute; left: 0; top: 0; width: 100%; height: ${titleHeight}px; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.4);">
                <span style="color: #888; font-size: 11px; font-family: Arial, sans-serif;">Textures</span>
              </div>
              ${swatchElements}
            </div>
          </body>
          </html>
        `;

        await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 5000 });

        // Brief wait for rendering
        await page.waitForTimeout(100);

        // Capture the swatch strip - use fullPage instead of clip for reliability
        const swatchBuffer = await page.screenshot({
          type: "png",
          fullPage: true,
          timeout: 15000,
        });

        return swatchBuffer;
      } finally {
        // Always clean up the context
        if (context) {
          try {
            await context.close();
          } catch {
            // Ignore close errors
          }
        }
      }
    } catch (e) {
      Log.debug(`Swatch strip generation failed: ${e}`);
      return undefined;
    } finally {
      // Close the fresh browser
      if (freshBrowser) {
        try {
          await freshBrowser.close();
        } catch {
          // Ignore close errors
        }
      }
    }
  }

  /**
   * Append a swatch strip below an existing image.
   *
   * @param mainImage The main image PNG data
   * @param swatchStrip The swatch strip PNG data
   * @param mainWidth Width of the main image
   * @param mainHeight Height of the main image
   * @returns Combined image with swatches below, or original image on failure
   */
  static async appendSwatchStrip(
    mainImage: Uint8Array,
    swatchStrip: Uint8Array,
    mainWidth: number,
    mainHeight: number
  ): Promise<Uint8Array> {
    let freshBrowser: any = null;
    try {
      // Launch fresh browser to avoid contention with main renderer
      const playwright = await import("playwright");
      freshBrowser = await playwright.chromium.launch({ channel: "chrome", headless: true });

      const mainBase64 = Buffer.from(mainImage).toString("base64");
      const swatchBase64 = Buffer.from(swatchStrip).toString("base64");

      // Create context and page
      let context;
      try {
        // First, get the swatch strip dimensions using a quick page load
        context = await freshBrowser.newContext();
        const tempPage = await context.newPage();

        const windowRef = "window";
        const sizeHtml = `
          <!DOCTYPE html>
          <html><body>
            <img id="swatch" src="data:image/png;base64,${swatchBase64}">
            <script>
              ${windowRef}.swatchLoaded = false;
              document.getElementById('swatch').onload = () => {
                ${windowRef}.swatchWidth = document.getElementById('swatch').naturalWidth;
                ${windowRef}.swatchHeight = document.getElementById('swatch').naturalHeight;
                ${windowRef}.swatchLoaded = true;
              };
            </script>
          </body></html>
        `;

        await tempPage.setContent(sizeHtml, { waitUntil: "domcontentloaded" });
        // @ts-ignore - accessing window properties set by browser script
        await tempPage.waitForFunction(() => (window as any).swatchLoaded, { timeout: 5000 });
        // @ts-ignore - accessing window properties set by browser script
        const swatchHeight = await tempPage.evaluate(() => (window as any).swatchHeight);

        const totalHeight = mainHeight + swatchHeight;

        // Update viewport for combining
        await tempPage.setViewportSize({ width: mainWidth, height: totalHeight });

        const html = `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { margin: 0; padding: 0; background: transparent; }
              canvas { display: block; }
            </style>
          </head>
          <body>
            <canvas id="canvas" width="${mainWidth}" height="${totalHeight}"></canvas>
            <script>
              async function combine() {
                const canvas = document.getElementById('canvas');
                const ctx = canvas.getContext('2d');
                
                // Load main image
                const mainImg = new Image();
                await new Promise((resolve, reject) => {
                  mainImg.onload = resolve;
                  mainImg.onerror = reject;
                  mainImg.src = 'data:image/png;base64,${mainBase64}';
                });
                
                // Load swatch strip
                const swatchImg = new Image();
                await new Promise((resolve, reject) => {
                  swatchImg.onload = resolve;
                  swatchImg.onerror = reject;
                  swatchImg.src = 'data:image/png;base64,${swatchBase64}';
                });
                
                // Draw main image at top
                ctx.drawImage(mainImg, 0, 0, ${mainWidth}, ${mainHeight});
                
                // Draw swatch strip below, scaled to fit width
                ctx.drawImage(swatchImg, 0, ${mainHeight}, ${mainWidth}, swatchImg.naturalHeight);
                
                ${windowRef}.combineComplete = true;
              }
              combine().catch(e => { ${windowRef}.combineError = e.message; });
            </script>
          </body>
          </html>
        `;

        await tempPage.setContent(html, { waitUntil: "domcontentloaded" });

        // Wait for combining to complete
        // @ts-ignore - accessing window properties set by browser script
        await tempPage.waitForFunction(() => (window as any).combineComplete || (window as any).combineError, {
          timeout: 5000,
        });

        // @ts-ignore - accessing window properties set by browser script
        const error = await tempPage.evaluate(() => (window as any).combineError);
        if (error) {
          Log.debug(`Image combine error: ${error}`);
          return mainImage;
        }

        // Capture the combined image using page.screenshot with clip
        // (locator.screenshot has stability issues)
        const combinedBuffer = await tempPage.screenshot({
          type: "png",
          clip: { x: 0, y: 0, width: mainWidth, height: totalHeight },
          timeout: 5000,
        });

        return combinedBuffer;
      } finally {
        // Always clean up the context
        if (context) {
          try {
            await context.close();
          } catch {
            // Ignore close errors
          }
        }
      }
    } catch (e) {
      Log.debug(`Image appending failed: ${e}`);
      return mainImage;
    } finally {
      // Always close the fresh browser
      if (freshBrowser) {
        try {
          await freshBrowser.close();
        } catch {
          // Ignore close errors
        }
      }
    }
  }
}
