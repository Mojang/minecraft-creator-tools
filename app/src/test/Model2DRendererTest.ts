// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Model2DRendererTest
 *
 * Unit tests for Model2DRenderer and ModelGeometryUtilities.
 * These tests validate geometry-to-SVG rendering, projection calculations,
 * and UV mapping without browser dependencies.
 *
 * Last Updated: December 2025
 */

import { expect } from "chai";
import { PNG } from "pngjs";
import { IGeometry, IGeometryBone, IGeometryBoneCube } from "../minecraft/IModelGeometry";
import ModelGeometryUtilities, { ViewDirection } from "../minecraft/ModelGeometryUtilities";
import Model2DRenderer, { ITexturePixels } from "../minecraft/Model2DRenderer";
import CreatorToolsHost from "../app/CreatorToolsHost";
import ImageCodecNode from "../local/ImageCodecNode";

// Set up Node.js-specific image codec functions
CreatorToolsHost.decodePng = ImageCodecNode.decodePng;
CreatorToolsHost.encodeToPng = ImageCodecNode.encodeToPng;

// Helper to create minimal geometry for tests
function createTestGeometry(bones: IGeometryBone[], texWidth = 64, texHeight = 32): IGeometry {
  return {
    description: {
      identifier: "geometry.test",
      texture_width: texWidth,
      texture_height: texHeight,
      visible_bounds_width: 1,
      visible_bounds_height: 1,
      visible_bounds_offset: [0, 0, 0],
    },
    bones,
  };
}

// Helper to create a simple cube
function createCube(
  origin: [number, number, number],
  size: [number, number, number],
  uv: [number, number] = [0, 0]
): IGeometryBoneCube {
  return { origin, size, uv };
}

describe("ModelGeometryUtilities", () => {
  // Test fixture: simple cube geometry
  const simpleCubeGeometry = createTestGeometry(
    [
      {
        name: "body",
        pivot: [0, 0, 0],
        cubes: [createCube([-4, 0, -4], [8, 8, 8], [0, 0])],
      },
    ],
    16,
    16
  );

  // Test fixture: multi-bone geometry with parent hierarchy
  const multiBoneGeometry = createTestGeometry(
    [
      {
        name: "root",
        pivot: [0, 0, 0],
        cubes: [],
      },
      {
        name: "body",
        parent: "root",
        pivot: [0, 8, 0],
        cubes: [createCube([-4, 0, -2], [8, 12, 4], [16, 16])],
      },
      {
        name: "head",
        parent: "body",
        pivot: [0, 12, 0],
        cubes: [createCube([-4, 12, -4], [8, 8, 8], [0, 0])],
      },
      {
        name: "arm",
        parent: "body",
        pivot: [5, 10, 0],
        rotation: [0, 0, -45],
        cubes: [createCube([4, 2, -2], [4, 10, 4], [40, 16])],
      },
    ],
    64,
    32
  );

  describe("getCubeCenter", () => {
    it("should calculate center of a cube at origin", () => {
      const cube = createCube([-4, 0, -4], [8, 8, 8]);
      const center = ModelGeometryUtilities.getCubeCenter(cube);
      // Returns [x, y, z] array
      expect(center[0]).to.equal(0);
      expect(center[1]).to.equal(4);
      expect(center[2]).to.equal(0);
    });

    it("should calculate center of an offset cube", () => {
      const cube = createCube([0, 10, 0], [4, 4, 4]);
      const center = ModelGeometryUtilities.getCubeCenter(cube);
      expect(center[0]).to.equal(2);
      expect(center[1]).to.equal(12);
      expect(center[2]).to.equal(2);
    });
  });

  describe("getCubeBoundingBox", () => {
    it("should return correct bounds for a simple cube", () => {
      const cube = createCube([-4, 0, -4], [8, 8, 8]);
      const bounds = ModelGeometryUtilities.getCubeBoundingBox(cube);
      expect(bounds.minX).to.equal(-4);
      expect(bounds.maxX).to.equal(4);
      expect(bounds.minY).to.equal(0);
      expect(bounds.maxY).to.equal(8);
      expect(bounds.minZ).to.equal(-4);
      expect(bounds.maxZ).to.equal(4);
    });
  });

  describe("getGeometryBoundingBox", () => {
    it("should calculate bounds for simple cube geometry", () => {
      const bounds = ModelGeometryUtilities.getGeometryBoundingBox(simpleCubeGeometry);
      expect(bounds.minX).to.equal(-4);
      expect(bounds.maxX).to.equal(4);
      expect(bounds.minY).to.equal(0);
      expect(bounds.maxY).to.equal(8);
    });

    it("should calculate bounds for multi-bone geometry", () => {
      const bounds = ModelGeometryUtilities.getGeometryBoundingBox(multiBoneGeometry);
      // Body: -4 to 4 X, 0 to 12 Y
      // Head: -4 to 4 X, 12 to 20 Y
      // Arm: 4 to 8 X before rotation, expands after
      expect(bounds.minY).to.equal(0);
      expect(bounds.maxY).to.be.at.least(12); // At least body height
    });
  });

  describe("buildBoneTransformMap", () => {
    it("should build transforms for simple geometry", () => {
      const transforms = ModelGeometryUtilities.buildBoneTransformMap(simpleCubeGeometry);
      expect(transforms.has("body")).to.be.true;
      const bodyTransform = transforms.get("body");
      expect(bodyTransform).to.exist;
      expect(bodyTransform!.pivot).to.deep.equal([0, 0, 0]);
    });

    it("should build transforms with parent hierarchy", () => {
      const transforms = ModelGeometryUtilities.buildBoneTransformMap(multiBoneGeometry);
      expect(transforms.has("root")).to.be.true;
      expect(transforms.has("body")).to.be.true;
      expect(transforms.has("head")).to.be.true;
      expect(transforms.has("arm")).to.be.true;
      const armTransform = transforms.get("arm");
      expect(armTransform).to.exist;
      expect(armTransform!.rotation).to.exist;
    });
  });

  describe("rotatePointAroundPivot", () => {
    it("should not change point at pivot with zero rotation", () => {
      const point = [0, 0, 0];
      const result = ModelGeometryUtilities.rotatePointAroundPivot(point, [0, 0, 0], [0, 0, 0]);
      expect(result[0]).to.be.closeTo(0, 0.001);
      expect(result[1]).to.be.closeTo(0, 0.001);
      expect(result[2]).to.be.closeTo(0, 0.001);
    });

    it("should rotate point 90 degrees around Y axis", () => {
      const point = [1, 0, 0];
      const result = ModelGeometryUtilities.rotatePointAroundPivot(point, [0, 0, 0], [0, 90, 0]);
      // After 90 degree Y rotation, (1,0,0) should become approximately (0,0,-1)
      expect(result[0]).to.be.closeTo(0, 0.001);
      expect(result[1]).to.be.closeTo(0, 0.001);
      expect(result[2]).to.be.closeTo(-1, 0.001);
    });
  });

  describe("getCubeFaceUV", () => {
    it("should return correct UV for legacy format", () => {
      const cube = createCube([-4, 0, -4], [8, 8, 8], [0, 0]);
      const uv = ModelGeometryUtilities.getCubeFaceUV(cube, "north", 64, 32);
      // North face starts at u + depth, v + depth = 8, 8
      expect(uv.u).to.equal(8);
      expect(uv.v).to.equal(8);
      expect(uv.width).to.equal(8);
      expect(uv.height).to.equal(8);
    });

    it("should return correct UV for per-face format", () => {
      const cube: IGeometryBoneCube = {
        origin: [-4, 0, -4],
        size: [8, 8, 8],
        uv: {
          north: { uv: [16, 16], uv_size: [8, 8] },
          south: { uv: [24, 16], uv_size: [8, 8] },
        },
      };
      const uv = ModelGeometryUtilities.getCubeFaceUV(cube, "north", 64, 32);
      expect(uv.u).to.equal(16);
      expect(uv.v).to.equal(16);
      expect(uv.width).to.equal(8);
      expect(uv.height).to.equal(8);
    });
  });

  describe("getVisibleFaces", () => {
    it("should return front face for front view", () => {
      const faces = ModelGeometryUtilities.getVisibleFaces("front");
      // In Minecraft, entities face north (-Z), so front view shows the north face
      expect(faces).to.include("north");
      expect(faces).to.not.include("south");
    });

    it("should return 3 faces for isometric views", () => {
      // iso-front-right should show north, east, up
      const isoFrontRight = ModelGeometryUtilities.getVisibleFaces("iso-front-right");
      expect(isoFrontRight).to.have.members(["north", "east", "up"]);

      // iso-front-left should show north, west, up
      const isoFrontLeft = ModelGeometryUtilities.getVisibleFaces("iso-front-left");
      expect(isoFrontLeft).to.have.members(["north", "west", "up"]);

      // iso-back-right should show south, east, up
      const isoBackRight = ModelGeometryUtilities.getVisibleFaces("iso-back-right");
      expect(isoBackRight).to.have.members(["south", "east", "up"]);

      // iso-back-left should show south, west, up
      const isoBackLeft = ModelGeometryUtilities.getVisibleFaces("iso-back-left");
      expect(isoBackLeft).to.have.members(["south", "west", "up"]);
    });
  });

  describe("projectPoint", () => {
    it("should project point correctly for front view", () => {
      const point = [1, 2, 3];
      const result = ModelGeometryUtilities.projectPoint(point, "front", 1.0);
      // Front view: looking from -Z towards +Z (looking at entity's face)
      // X is mirrored (entity's left is on our right), Y is inverted for screen coords
      expect(result.x).to.equal(-1); // X mirrored
      expect(result.y).to.equal(-2); // Y inverted for screen coords
      expect(result.depth).to.equal(-3); // Depth is -Z
    });

    it("should apply scale correctly", () => {
      const point = [1, 2, 3];
      const result = ModelGeometryUtilities.projectPoint(point, "front", 2.0);
      expect(result.x).to.equal(-2); // X mirrored and scaled
      expect(result.y).to.equal(-4);
    });

    it("should apply isometric rotation for iso-front-right view", () => {
      // A point at (10, 0, 0) should be rotated 45° around Y, then tilted 30° around X
      const point = [10, 0, 0];
      const result = ModelGeometryUtilities.projectPoint(point, "iso-front-right", 1.0);
      // After rotation, the point should have moved in X and Z
      // The exact values depend on the rotation angles, but X should be smaller than 10
      expect(Math.abs(result.x)).to.be.lessThan(10);
      // Y will be affected by the X-axis tilt, but sign depends on rotation direction
      // Just verify it's a number and not the original 0
      expect(typeof result.y).to.equal("number");
    });
  });

  describe("getProjectedFaces", () => {
    it("should return projected faces for simple cube", () => {
      const faces = ModelGeometryUtilities.getProjectedFaces(simpleCubeGeometry, "front", 1.0, false);
      expect(faces.length).to.be.greaterThan(0);

      // All faces should have valid dimensions
      for (const face of faces) {
        expect(face.width).to.be.greaterThan(0);
        expect(face.height).to.be.greaterThan(0);
      }
    });

    it("should sort faces by depth (painter's algorithm)", () => {
      const faces = ModelGeometryUtilities.getProjectedFaces(simpleCubeGeometry, "front", 1.0, true);
      // Faces should be sorted back-to-front (increasing depth)
      for (let i = 1; i < faces.length; i++) {
        expect(faces[i].depth).to.be.at.least(faces[i - 1].depth);
      }
    });

    it("should return 3 faces for isometric view of simple cube", () => {
      const faces = ModelGeometryUtilities.getProjectedFaces(simpleCubeGeometry, "iso-front-right", 1.0, false);
      // A cube viewed isometrically should show 3 visible faces
      expect(faces.length).to.equal(3);
      // Each face should have vertices for polygon rendering
      for (const face of faces) {
        expect(face.vertices).to.exist;
        expect(face.vertices!.length).to.equal(4);
      }
    });
  });
});

describe("Model2DRenderer", () => {
  // Simple 8x8 cube geometry
  const testGeometry = createTestGeometry(
    [
      {
        name: "cube",
        pivot: [0, 0, 0],
        cubes: [createCube([-4, 0, -4], [8, 8, 8], [0, 0])],
      },
    ],
    16,
    16
  );

  // Create a simple test texture (4x4 checkerboard pattern)
  const createCheckerboardTexture = (): ITexturePixels => {
    const width = 16;
    const height = 16;
    const pixels = new Uint8Array(width * height * 4);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        // Checkerboard: alternate red and blue
        const isEven = ((x >> 2) + (y >> 2)) % 2 === 0;
        pixels[idx] = isEven ? 255 : 0; // R
        pixels[idx + 1] = 0; // G
        pixels[idx + 2] = isEven ? 0 : 255; // B
        pixels[idx + 3] = 255; // A
      }
    }

    return { width, height, pixels };
  };

  describe("renderToSvg", () => {
    it("should generate valid SVG without texture", () => {
      const svg = Model2DRenderer.renderToSvg(testGeometry, {
        viewDirection: "front",
        outputWidth: 32,
        outputHeight: 32,
        fallbackColor: "#888888",
      });

      expect(svg).to.be.a("string");
      expect(svg).to.contain("<svg");
      expect(svg).to.contain("</svg>");
      expect(svg).to.contain("xmlns=");
    });

    it("should generate SVG with correct dimensions", () => {
      const svg = Model2DRenderer.renderToSvg(testGeometry, {
        viewDirection: "front",
        outputWidth: 64,
        outputHeight: 48,
      });

      expect(svg).to.contain('width="64"');
      expect(svg).to.contain('height="48"');
      expect(svg).to.contain('viewBox="0 0 64 48"');
    });

    it("should include background when specified", () => {
      const svg = Model2DRenderer.renderToSvg(testGeometry, {
        viewDirection: "front",
        backgroundColor: "#FFFFFF",
      });

      expect(svg).to.contain('fill="#FFFFFF"');
    });

    it("should generate SVG with texture data", () => {
      const texture = createCheckerboardTexture();
      const svg = Model2DRenderer.renderToSvg(testGeometry, {
        viewDirection: "front",
        texturePixels: texture,
        outputWidth: 32,
        outputHeight: 32,
      });

      expect(svg).to.contain("<rect");
      // Should have rgb color from texture
      expect(svg).to.match(/rgb\(\d+,\d+,\d+\)/);
    });

    it("should render all view directions", () => {
      const views: ViewDirection[] = ["front", "back", "left", "right", "top", "bottom"];

      for (const view of views) {
        const svg = Model2DRenderer.renderToSvg(testGeometry, {
          viewDirection: view,
          outputWidth: 32,
          outputHeight: 32,
        });
        expect(svg, `View ${view} should generate valid SVG`).to.contain("<svg");
      }
    });

    it("should apply depth shading when enabled", () => {
      const svgWithShading = Model2DRenderer.renderToSvg(testGeometry, {
        viewDirection: "front",
        depthShading: true,
        depthShadingIntensity: 0.5,
        includeSecondaryFaces: true,
        outputWidth: 32,
        outputHeight: 32,
      });

      const svgWithoutShading = Model2DRenderer.renderToSvg(testGeometry, {
        viewDirection: "front",
        depthShading: false,
        includeSecondaryFaces: true,
        outputWidth: 32,
        outputHeight: 32,
      });

      // Both should be valid SVG
      expect(svgWithShading).to.contain("<svg");
      expect(svgWithoutShading).to.contain("<svg");
    });
  });

  describe("renderToDetailedSvg", () => {
    it("should generate pixel-level SVG", () => {
      const texture = createCheckerboardTexture();
      const svg = Model2DRenderer.renderToDetailedSvg(testGeometry, {
        viewDirection: "front",
        texturePixels: texture,
        outputWidth: 16,
        outputHeight: 16,
      });

      expect(svg).to.contain("<svg");
      expect(svg).to.contain("<rect");
    });

    it("should work without texture using fallback color", () => {
      const svg = Model2DRenderer.renderToDetailedSvg(testGeometry, {
        viewDirection: "front",
        fallbackColor: "#00FF00",
        outputWidth: 16,
        outputHeight: 16,
      });

      expect(svg).to.contain("<svg");
      // Should contain the fallback color or derived rgb
      expect(svg).to.match(/(#00FF00|rgb\(0,255,0\))/);
    });
  });

  describe("edge cases", () => {
    it("should handle geometry with no cubes", () => {
      const emptyGeometry = createTestGeometry([
        {
          name: "root",
          pivot: [0, 0, 0],
          cubes: [],
        },
      ]);

      const svg = Model2DRenderer.renderToSvg(emptyGeometry, {
        viewDirection: "front",
        outputWidth: 32,
        outputHeight: 32,
      });

      expect(svg).to.contain("<svg");
      expect(svg).to.contain("</svg>");
    });

    it("should handle geometry with no bones", () => {
      const noBoneGeometry = createTestGeometry([]);

      const svg = Model2DRenderer.renderToSvg(noBoneGeometry, {
        viewDirection: "front",
      });

      expect(svg).to.contain("<svg");
    });

    it("should handle very small output dimensions", () => {
      const svg = Model2DRenderer.renderToSvg(testGeometry, {
        viewDirection: "front",
        outputWidth: 1,
        outputHeight: 1,
      });

      expect(svg).to.contain("<svg");
    });

    it("should handle zero-size texture gracefully", () => {
      const emptyTexture: ITexturePixels = {
        width: 0,
        height: 0,
        pixels: new Uint8Array(0),
      };

      // Should not throw
      const svg = Model2DRenderer.renderToSvg(testGeometry, {
        viewDirection: "front",
        texturePixels: emptyTexture,
        fallbackColor: "#FF0000",
      });

      expect(svg).to.contain("<svg");
    });
  });

  describe("isometric rendering", () => {
    it("should render isometric view with polygon elements", () => {
      const svg = Model2DRenderer.renderToSvg(testGeometry, {
        viewDirection: "iso-front-right",
        fallbackColor: "#808080",
        outputWidth: 64,
        outputHeight: 64,
      });

      // Isometric views should use polygon elements, not just rectangles
      expect(svg).to.contain("<polygon");
      expect(svg).to.contain("<svg");
    });

    it("should render different isometric angles", () => {
      const directions = ["iso-front-right", "iso-front-left", "iso-back-right", "iso-back-left"] as const;

      for (const direction of directions) {
        const svg = Model2DRenderer.renderToSvg(testGeometry, {
          viewDirection: direction,
          fallbackColor: "#808080",
          outputWidth: 64,
          outputHeight: 64,
        });

        // Each isometric view should produce valid SVG with polygons
        expect(svg).to.contain("<svg");
        expect(svg).to.contain("<polygon");
      }
    });

    it("should render more faces in isometric than orthographic", () => {
      const orthoSvg = Model2DRenderer.renderToSvg(testGeometry, {
        viewDirection: "front",
        fallbackColor: "#808080",
        outputWidth: 64,
        outputHeight: 64,
      });

      const isoSvg = Model2DRenderer.renderToSvg(testGeometry, {
        viewDirection: "iso-front-right",
        fallbackColor: "#808080",
        outputWidth: 64,
        outputHeight: 64,
      });

      // Isometric should have more elements (3 faces vs 1 face for simple cube)
      const orthoRectCount = (orthoSvg.match(/<rect/g) || []).length;
      const isoPolygonCount = (isoSvg.match(/<polygon/g) || []).length;

      // Background rect is 1, so orthographic should have 2 rects (bg + 1 face)
      // Isometric should have 3 polygons (3 faces)
      expect(isoPolygonCount).to.be.greaterThan(orthoRectCount - 1); // -1 for background rect
    });
  });

  describe("decodePng", () => {
    it("should decode a valid PNG to RGBA pixels", () => {
      // Create a minimal 2x2 PNG using pngjs
      const png = new PNG({ width: 2, height: 2 });

      // Set pixels: red, green, blue, white
      const colors = [
        [255, 0, 0, 255], // red
        [0, 255, 0, 255], // green
        [0, 0, 255, 255], // blue
        [255, 255, 255, 255], // white
      ];

      for (let i = 0; i < 4; i++) {
        const idx = i * 4;
        png.data[idx] = colors[i][0];
        png.data[idx + 1] = colors[i][1];
        png.data[idx + 2] = colors[i][2];
        png.data[idx + 3] = colors[i][3];
      }

      const pngBuffer = PNG.sync.write(png);
      const result = Model2DRenderer.decodePng(new Uint8Array(pngBuffer));

      expect(result).to.not.be.undefined;
      expect(result!.width).to.equal(2);
      expect(result!.height).to.equal(2);
      expect(result!.pixels.length).to.equal(16); // 2x2x4 bytes

      // Verify pixel colors
      expect(result!.pixels[0]).to.equal(255); // red R
      expect(result!.pixels[1]).to.equal(0); // red G
      expect(result!.pixels[2]).to.equal(0); // red B
      expect(result!.pixels[3]).to.equal(255); // red A
    });

    it("should return undefined for invalid PNG data", () => {
      const invalidData = new Uint8Array([1, 2, 3, 4, 5]);
      const result = Model2DRenderer.decodePng(invalidData);
      expect(result).to.be.undefined;
    });

    it("should return undefined for empty data", () => {
      const result = Model2DRenderer.decodePng(new Uint8Array(0));
      expect(result).to.be.undefined;
    });
  });

  describe("renderToSvg with texturePngData", () => {
    it("should render SVG using raw PNG data", () => {
      // Create a simple test PNG
      const png = new PNG({ width: 16, height: 16 });

      // Fill with a solid color (purple)
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const idx = (y * 16 + x) * 4;
          png.data[idx] = 128; // R
          png.data[idx + 1] = 0; // G
          png.data[idx + 2] = 128; // B
          png.data[idx + 3] = 255; // A
        }
      }

      const pngBuffer = PNG.sync.write(png);

      const svg = Model2DRenderer.renderToSvg(testGeometry, {
        viewDirection: "front",
        texturePngData: new Uint8Array(pngBuffer),
        outputWidth: 32,
        outputHeight: 32,
      });

      expect(svg).to.contain("<svg");
      // Should contain the purple color
      expect(svg).to.match(/rgb\(128,0,128\)/);
    });
  });

  describe("depth shading", () => {
    it("should apply depth shading when enabled", () => {
      // Create multi-depth geometry (front cube and back cube)
      const multiDepthGeometry = createTestGeometry(
        [
          {
            name: "front",
            pivot: [0, 0, 0],
            cubes: [createCube([-2, 0, -2], [4, 4, 4], [0, 0])],
          },
          {
            name: "back",
            pivot: [0, 0, 0],
            cubes: [createCube([-2, 0, 6], [4, 4, 4], [0, 0])], // Further back in Z
          },
        ],
        16,
        16
      );

      const svgWithShading = Model2DRenderer.renderToSvg(multiDepthGeometry, {
        viewDirection: "front",
        fallbackColor: "#808080",
        depthShading: true,
        depthShadingIntensity: 0.5,
        outputWidth: 32,
        outputHeight: 32,
      });

      // Should produce valid SVG
      expect(svgWithShading).to.contain("<svg");
      expect(svgWithShading).to.contain("<rect");
    });

    it("should not modify colors when depthShading is false", () => {
      const svg = Model2DRenderer.renderToSvg(testGeometry, {
        viewDirection: "front",
        fallbackColor: "#808080",
        depthShading: false,
        outputWidth: 32,
        outputHeight: 32,
      });

      // Should contain the unmodified fallback color (in original hex format)
      expect(svg).to.contain("#808080");
    });
  });

  describe("perspective projection", () => {
    // Create geometry with cubes at different depths - use larger depth separation
    const depthGeometry = createTestGeometry(
      [
        {
          name: "near",
          pivot: [0, 0, 0],
          cubes: [createCube([-4, 0, -10], [8, 8, 4], [0, 0])], // Near the camera (at z=-10)
        },
        {
          name: "far",
          pivot: [0, 0, 0],
          cubes: [createCube([-4, 0, 10], [8, 8, 4], [0, 0])], // Far from camera (at z=10)
        },
      ],
      16,
      16
    );

    it("should apply perspective when perspectiveStrength > 0", () => {
      const svgOrtho = Model2DRenderer.renderToSvg(depthGeometry, {
        viewDirection: "front",
        fallbackColor: "#808080",
        perspectiveStrength: 0, // Orthographic
        outputWidth: 64,
        outputHeight: 64,
      });

      const svgPersp = Model2DRenderer.renderToSvg(depthGeometry, {
        viewDirection: "front",
        fallbackColor: "#808080",
        perspectiveStrength: 0.5, // Moderate perspective
        outputWidth: 64,
        outputHeight: 64,
      });

      // Both should be valid SVG
      expect(svgOrtho).to.contain("<svg");
      expect(svgPersp).to.contain("<svg");

      // Perspective should produce different output (different rect dimensions)
      expect(svgPersp).to.not.equal(svgOrtho);
    });

    it("should work with different focal lengths", () => {
      const svgShortFocal = Model2DRenderer.renderToSvg(depthGeometry, {
        viewDirection: "front",
        fallbackColor: "#808080",
        perspectiveStrength: 0.8, // Stronger perspective to make focal length differences more visible
        focalLength: 30, // Wide angle
        outputWidth: 64,
        outputHeight: 64,
      });

      const svgLongFocal = Model2DRenderer.renderToSvg(depthGeometry, {
        viewDirection: "front",
        fallbackColor: "#808080",
        perspectiveStrength: 0.8,
        focalLength: 300, // Telephoto
        outputWidth: 64,
        outputHeight: 64,
      });

      // Both should be valid SVG
      expect(svgShortFocal).to.contain("<svg");
      expect(svgLongFocal).to.contain("<svg");

      // Different focal lengths should produce different output
      expect(svgShortFocal).to.not.equal(svgLongFocal);
    });

    it("should apply perspective to renderToDetailedSvg", () => {
      // Use geometry with offset cubes so perspective differences are visible
      // The far cube is smaller and offset, so perspective will make it appear differently
      const offsetGeometry = createTestGeometry(
        [
          {
            name: "near",
            pivot: [0, 0, 0],
            cubes: [createCube([-6, 0, -10], [4, 4, 4], [0, 0])], // Near, left side
          },
          {
            name: "far",
            pivot: [0, 0, 0],
            cubes: [createCube([2, 4, 10], [4, 4, 4], [0, 0])], // Far, right side, higher
          },
        ],
        16,
        16
      );

      const svgOrtho = Model2DRenderer.renderToDetailedSvg(offsetGeometry, {
        viewDirection: "front",
        fallbackColor: "#808080",
        perspectiveStrength: 0,
        outputWidth: 64,
        outputHeight: 64,
      });

      const svgPersp = Model2DRenderer.renderToDetailedSvg(offsetGeometry, {
        viewDirection: "front",
        fallbackColor: "#808080",
        perspectiveStrength: 0.8, // Strong perspective
        outputWidth: 64,
        outputHeight: 64,
      });

      expect(svgOrtho).to.contain("<svg");
      expect(svgPersp).to.contain("<svg");
      // With perspective, the output should differ (far cube shrinks and shifts toward center)
      expect(svgPersp).to.not.equal(svgOrtho);
    });
  });
});
