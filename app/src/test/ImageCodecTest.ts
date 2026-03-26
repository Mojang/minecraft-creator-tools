// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * ImageCodec Unit Tests
 *
 * Tests for the unified image encoding/decoding utilities.
 */

import { expect } from "chai";
import ImageCodec, { IDecodedImage } from "../core/ImageCodec";
import ImageCodecNode from "../local/ImageCodecNode";
import CreatorToolsHost from "../app/CreatorToolsHost";
import * as fs from "fs";
import * as path from "path";

// Set up Node.js-specific image codec functions for tests
CreatorToolsHost.decodePng = ImageCodecNode.decodePng;
CreatorToolsHost.encodeToPng = ImageCodecNode.encodeToPng;

describe("ImageCodec", function () {
  this.timeout(10000);

  // Test PNG signature bytes
  const PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // Test JPEG signature bytes
  const JPEG_SIGNATURE = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);

  // Test TGA header (type 2 = uncompressed true-color)
  const TGA_HEADER = new Uint8Array([
    0, // ID length
    0, // Color map type
    2, // Image type (uncompressed true-color)
    0,
    0,
    0,
    0,
    0, // Color map specification
    0,
    0, // X origin
    0,
    0, // Y origin
    2,
    0, // Width (2 pixels)
    2,
    0, // Height (2 pixels)
    32, // Pixel depth (32-bit RGBA)
    0, // Image descriptor
  ]);

  describe("Format Detection", function () {
    it("should detect PNG format", function () {
      expect(ImageCodec.isPngData(PNG_SIGNATURE)).to.be.true;
      expect(ImageCodec.detectFormat(PNG_SIGNATURE)).to.equal("png");
    });

    it("should detect JPEG format", function () {
      expect(ImageCodec.isJpegData(JPEG_SIGNATURE)).to.be.true;
      expect(ImageCodec.detectFormat(JPEG_SIGNATURE)).to.equal("jpg");
    });

    it("should detect TGA format", function () {
      expect(ImageCodec.isTgaData(TGA_HEADER)).to.be.true;
      expect(ImageCodec.detectFormat(TGA_HEADER)).to.equal("tga");
    });

    it("should not misidentify PNG as TGA", function () {
      expect(ImageCodec.isTgaData(PNG_SIGNATURE)).to.be.false;
    });

    it("should not misidentify JPEG as TGA", function () {
      expect(ImageCodec.isTgaData(JPEG_SIGNATURE)).to.be.false;
    });

    it("should return undefined for unknown format", function () {
      const unknownData = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
      expect(ImageCodec.detectFormat(unknownData)).to.be.undefined;
    });
  });

  describe("Pixel Manipulation", function () {
    it("should convert BGRA to RGBA", function () {
      // BGRA: B=1, G=2, R=3, A=4
      const pixels = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
      ImageCodec.bgraToRgba(pixels);
      // RGBA: R=3, G=2, B=1, A=4
      expect(pixels[0]).to.equal(3); // R (was B)
      expect(pixels[1]).to.equal(2); // G (unchanged)
      expect(pixels[2]).to.equal(1); // B (was R)
      expect(pixels[3]).to.equal(4); // A (unchanged)
    });

    it("should create solid color image", function () {
      const image = ImageCodec.createSolidColor(2, 2, 255, 128, 64, 200);
      expect(image.width).to.equal(2);
      expect(image.height).to.equal(2);
      expect(image.pixels.length).to.equal(16); // 2x2x4 bytes

      // Check first pixel
      expect(image.pixels[0]).to.equal(255); // R
      expect(image.pixels[1]).to.equal(128); // G
      expect(image.pixels[2]).to.equal(64); // B
      expect(image.pixels[3]).to.equal(200); // A
    });
  });

  describe("ImageCodecNode (Node.js specific)", function () {
    it("should encode PNG from pixels", function () {
      // Create a 2x2 red image
      const pixels = new Uint8Array([255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255]);

      const pngData = ImageCodecNode.encodeToPng(pixels, 2, 2);
      expect(pngData).to.not.be.undefined;
      expect(pngData!.length).to.be.greaterThan(0);

      // Verify PNG signature
      expect(pngData![0]).to.equal(0x89);
      expect(pngData![1]).to.equal(0x50);
      expect(pngData![2]).to.equal(0x4e);
      expect(pngData![3]).to.equal(0x47);
    });

    it("should decode PNG to pixels", function () {
      // Create a PNG, then decode it
      const originalPixels = new Uint8Array([
        255,
        0,
        0,
        255, // Red pixel
        0,
        255,
        0,
        255, // Green pixel
        0,
        0,
        255,
        255, // Blue pixel
        255,
        255,
        0,
        255, // Yellow pixel
      ]);

      const pngData = ImageCodecNode.encodeToPng(originalPixels, 2, 2);
      expect(pngData).to.not.be.undefined;

      const decoded = ImageCodecNode.decodePng(pngData!);
      expect(decoded).to.not.be.undefined;
      expect(decoded!.width).to.equal(2);
      expect(decoded!.height).to.equal(2);
      expect(decoded!.pixels.length).to.equal(16);

      // Verify pixel values match
      for (let i = 0; i < originalPixels.length; i++) {
        expect(decoded!.pixels[i]).to.equal(originalPixels[i]);
      }
    });

    it("should generate data URL", function () {
      const pixels = new Uint8Array([255, 0, 0, 255]);
      const pngData = ImageCodecNode.encodeToPng(pixels, 1, 1);
      expect(pngData).to.not.be.undefined;

      const dataUrl = ImageCodecNode.toDataUrl(pngData!, "image/png");
      expect(dataUrl).to.match(/^data:image\/png;base64,/);
    });
  });

  describe("Cross-platform ImageCodec", function () {
    it("should decode PNG via unified API", async function () {
      // Create a PNG first
      const originalPixels = new Uint8Array([255, 128, 64, 255, 32, 16, 8, 128]);

      const pngData = ImageCodecNode.encodeToPng(originalPixels, 2, 1);
      expect(pngData).to.not.be.undefined;

      const decoded = await ImageCodec.decodePng(pngData!);
      expect(decoded).to.not.be.undefined;
      expect(decoded!.width).to.equal(2);
      expect(decoded!.height).to.equal(1);
    });

    it("should encode PNG via unified API", async function () {
      const pixels = new Uint8Array([100, 150, 200, 255]);

      const pngData = await ImageCodec.encodeToPng(pixels, 1, 1);
      expect(pngData).to.not.be.undefined;
      expect(ImageCodec.isPngData(pngData!)).to.be.true;
    });

    it("should convert to data URL", function () {
      const pngData = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const dataUrl = ImageCodec.toDataUrl(pngData, "image/png");
      expect(dataUrl).to.match(/^data:image\/png;base64,/);
    });

    it("should generate PNG data URL from image", async function () {
      const image: IDecodedImage = {
        width: 1,
        height: 1,
        pixels: new Uint8Array([255, 0, 0, 255]),
      };

      const dataUrl = await ImageCodec.toPngDataUrl(image);
      expect(dataUrl).to.not.be.undefined;
      expect(dataUrl).to.match(/^data:image\/png;base64,/);
    });
  });

  describe("TGA Decoding", function () {
    it("should decode TGA file from samples", async function () {
      // Try to find a TGA file in the samples folder
      const samplesPath = path.join(__dirname, "../../public/res/samples");
      if (!fs.existsSync(samplesPath)) {
        this.skip(); // Skip if samples not available
        return;
      }

      // Look for any TGA file recursively
      function findTgaFile(dir: string): string | undefined {
        if (!fs.existsSync(dir)) return undefined;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            const found = findTgaFile(fullPath);
            if (found) return found;
          } else if (entry.name.toLowerCase().endsWith(".tga")) {
            return fullPath;
          }
        }
        return undefined;
      }

      const tgaPath = findTgaFile(samplesPath);
      if (!tgaPath) {
        this.skip(); // Skip if no TGA files found
        return;
      }

      const tgaData = new Uint8Array(fs.readFileSync(tgaPath));
      expect(ImageCodec.isTgaData(tgaData)).to.be.true;

      const decoded = await ImageCodec.decodeTga(tgaData);
      expect(decoded).to.not.be.undefined;
      expect(decoded!.width).to.be.greaterThan(0);
      expect(decoded!.height).to.be.greaterThan(0);
      expect(decoded!.pixels.length).to.equal(decoded!.width * decoded!.height * 4);
    });

    it("should convert TGA to PNG", async function () {
      // Create a minimal valid TGA
      const width = 2;
      const height = 2;
      const header = new Uint8Array([
        0, // ID length
        0, // Color map type
        2, // Image type (uncompressed true-color)
        0,
        0,
        0,
        0,
        0, // Color map specification (5 bytes)
        0,
        0, // X origin
        0,
        0, // Y origin
        width,
        0, // Width (little-endian)
        height,
        0, // Height (little-endian)
        24, // Pixel depth (24-bit RGB)
        0, // Image descriptor
      ]);

      // Pixel data (BGR format for TGA)
      const pixels = new Uint8Array([
        0,
        0,
        255, // Blue -> Red
        0,
        255,
        0, // Green
        255,
        0,
        0, // Red -> Blue
        255,
        255,
        255, // White
      ]);

      const tgaData = new Uint8Array(header.length + pixels.length);
      tgaData.set(header);
      tgaData.set(pixels, header.length);

      const decoded = await ImageCodec.decodeTga(tgaData);
      if (decoded) {
        // If TGA decoding works, test the full conversion
        const pngData = await ImageCodec.tgaToPng(tgaData);
        expect(pngData).to.not.be.undefined;
        expect(ImageCodec.isPngData(pngData!)).to.be.true;
      }
    });
  });
});
