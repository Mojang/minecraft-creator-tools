// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { expect, assert } from "chai";
import "mocha";
import * as fs from "fs";
import * as path from "path";
import ModelDesignUtilities, { IResolvedFaceContent } from "../minecraft/ModelDesignUtilities";
import {
  IMcpModelDesign,
  IMcpFaceContent,
  IMcpNoiseConfig,
  IMcpPixelArt,
  IMcpPixelColor,
} from "../minecraft/IMcpModelDesign";
import ImageGenerationUtilities from "../local/ImageGenerationUtilities";
import TexturedRectangleGenerator from "../minecraft/TexturedRectangleGenerator";
import { testFolders, assertValidPng, assertPngMatchesBaseline, assertJsonMatchesBaseline } from "./PngTestUtilities";
import { UvCoverageValidator } from "./UvCoverageValidator";
import { IBlockVolume } from "../minecraft/IBlockVolume";
import CreatorToolsHost from "../app/CreatorToolsHost";
import ImageCodecNode from "../local/ImageCodecNode";

// Set up Node.js-specific image codec for PNG encoding in tests
CreatorToolsHost.encodeToPng = ImageCodecNode.encodeToPng;
CreatorToolsHost.decodePng = ImageCodecNode.decodePng;

/**
 * Shared test fixtures for MCP tool tests.
 * These can be used by both direct method tests and full MCP client tests.
 */
export class McpTestFixtures {
  /**
   * Simple unit cube with inline colors on all faces
   */
  static readonly SIMPLE_COLORED_CUBE: IMcpModelDesign = {
    identifier: "test_simple_cube",
    textureSize: [64, 64],
    bones: [
      {
        name: "body",
        cubes: [
          {
            origin: [-8, 0, -8],
            size: [16, 16, 16],
            faces: {
              north: { background: { type: "solid", colors: ["#FF0000"] } },
              south: { background: { type: "solid", colors: ["#00FF00"] } },
              east: { background: { type: "solid", colors: ["#0000FF"] } },
              west: { background: { type: "solid", colors: ["#FFFF00"] } },
              up: { background: { type: "solid", colors: ["#FF00FF"] } },
              down: { background: { type: "solid", colors: ["#00FFFF"] } },
            },
          },
        ],
      },
    ],
  };

  /**
   * Cube using texture dictionary for reuse
   */
  static readonly CUBE_WITH_TEXTURE_REFS: IMcpModelDesign = {
    identifier: "test_texture_refs",
    textureSize: [64, 64],
    textures: {
      wood_side: { background: { type: "solid", colors: ["#8B4513"] } },
      wood_top: { background: { type: "solid", colors: ["#A0522D"] } },
      bark: { background: { type: "solid", colors: ["#4a3728"] } },
    },
    bones: [
      {
        name: "log",
        cubes: [
          {
            origin: [-8, 0, -8],
            size: [16, 16, 16],
            faces: {
              north: { textureId: "bark" },
              south: { textureId: "bark" },
              east: { textureId: "bark" },
              west: { textureId: "bark" },
              up: { textureId: "wood_top" },
              down: { textureId: "wood_top" },
            },
          },
        ],
      },
    ],
  };

  /**
   * Cube with identical textures on multiple faces (should deduplicate)
   */
  static readonly CUBE_WITH_DEDUPLICATION: IMcpModelDesign = {
    identifier: "test_deduplication",
    textureSize: [64, 64],
    textures: {
      all_sides: { background: { type: "solid", colors: ["#808080"] } },
    },
    bones: [
      {
        name: "cube",
        cubes: [
          {
            origin: [-8, 0, -8],
            size: [16, 16, 16],
            faces: {
              north: { textureId: "all_sides" },
              south: { textureId: "all_sides" },
              east: { textureId: "all_sides" },
              west: { textureId: "all_sides" },
              up: { textureId: "all_sides" },
              down: { textureId: "all_sides" },
            },
          },
        ],
      },
    ],
  };

  /**
   * Cube with mixed inline and referenced textures
   */
  static readonly CUBE_WITH_MIXED_TEXTURES: IMcpModelDesign = {
    identifier: "test_mixed",
    textureSize: [64, 64],
    textures: {
      wood: { background: { type: "solid", colors: ["#8B4513"] } },
    },
    bones: [
      {
        name: "body",
        cubes: [
          {
            origin: [-8, 0, -8],
            size: [16, 16, 16],
            faces: {
              north: { textureId: "wood" },
              south: { textureId: "wood" },
              east: { background: { type: "solid", colors: ["#FF0000"] } }, // Inline background
              west: { background: { type: "solid", colors: ["#FF0000"] } }, // Same inline (should also dedupe)
              up: { svg: "<svg viewBox='0 0 16 16'><rect fill='blue' width='16' height='16'/></svg>" },
              down: { textureId: "wood" },
            },
          },
        ],
      },
    ],
  };

  /**
   * Cube with invalid texture reference (for error testing)
   */
  static readonly CUBE_WITH_INVALID_REF: IMcpModelDesign = {
    identifier: "test_invalid_ref",
    textureSize: [64, 64],
    textures: {
      valid_texture: { background: { type: "solid", colors: ["#808080"] } },
    },
    bones: [
      {
        name: "body",
        cubes: [
          {
            origin: [-8, 0, -8],
            size: [16, 16, 16],
            faces: {
              north: { textureId: "nonexistent_texture" }, // Invalid reference
              south: { textureId: "valid_texture" },
            },
          },
        ],
      },
    ],
  };

  /**
   * Cube referencing texture but no textures dictionary defined
   */
  static readonly CUBE_WITH_REF_NO_DICT: IMcpModelDesign = {
    identifier: "test_no_dict",
    textureSize: [64, 64],
    // No textures dictionary!
    bones: [
      {
        name: "body",
        cubes: [
          {
            origin: [-8, 0, -8],
            size: [16, 16, 16],
            faces: {
              north: { textureId: "some_texture" }, // Can't resolve - no dict
            },
          },
        ],
      },
    ],
  };

  /**
   * Multi-bone model with texture sharing across bones
   */
  static readonly MULTI_BONE_WITH_SHARED_TEXTURES: IMcpModelDesign = {
    identifier: "test_multi_bone",
    textureSize: [128, 128],
    textures: {
      skin: { background: { type: "solid", colors: ["#FFCC99"] } },
      clothes: { background: { type: "solid", colors: ["#0000FF"] } },
      shoes: { background: { type: "solid", colors: ["#333333"] } },
    },
    bones: [
      {
        name: "head",
        pivot: [0, 24, 0],
        cubes: [
          {
            origin: [-4, 24, -4],
            size: [8, 8, 8],
            faces: {
              north: { textureId: "skin" },
              south: { textureId: "skin" },
              east: { textureId: "skin" },
              west: { textureId: "skin" },
              up: { textureId: "skin" },
              down: { textureId: "skin" },
            },
          },
        ],
      },
      {
        name: "body",
        pivot: [0, 12, 0],
        cubes: [
          {
            origin: [-4, 12, -2],
            size: [8, 12, 4],
            faces: {
              north: { textureId: "clothes" },
              south: { textureId: "clothes" },
              east: { textureId: "clothes" },
              west: { textureId: "clothes" },
              up: { textureId: "clothes" },
              down: { textureId: "clothes" },
            },
          },
        ],
      },
      {
        name: "leg_left",
        parent: "body",
        pivot: [-2, 12, 0],
        cubes: [
          {
            origin: [-4, 0, -2],
            size: [4, 12, 4],
            faces: {
              north: { textureId: "clothes" },
              south: { textureId: "clothes" },
              east: { textureId: "clothes" },
              west: { textureId: "clothes" },
              up: { textureId: "clothes" },
              down: { textureId: "shoes" },
            },
          },
        ],
      },
    ],
  };

  /**
   * Texture with SVG content
   */
  static readonly CUBE_WITH_SVG_TEXTURE: IMcpModelDesign = {
    identifier: "test_svg_texture",
    textureSize: [64, 64],
    textures: {
      checkered: {
        svg: `<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
          <rect x="0" y="0" width="8" height="8" fill="black"/>
          <rect x="8" y="0" width="8" height="8" fill="white"/>
          <rect x="0" y="8" width="8" height="8" fill="white"/>
          <rect x="8" y="8" width="8" height="8" fill="black"/>
        </svg>`,
      },
    },
    bones: [
      {
        name: "body",
        cubes: [
          {
            origin: [-8, 0, -8],
            size: [16, 16, 16],
            faces: {
              north: { textureId: "checkered" },
              south: { textureId: "checkered" },
              east: { textureId: "checkered" },
              west: { textureId: "checkered" },
              up: { textureId: "checkered" },
              down: { textureId: "checkered" },
            },
          },
        ],
      },
    ],
  };

  /**
   * Cube with noise texture (random pattern)
   */
  static readonly CUBE_WITH_NOISE_RANDOM: IMcpModelDesign = {
    identifier: "test_noise_random",
    textureSize: [64, 64],
    textures: {
      stone_noise: {
        background: {
          type: "random_noise",
          colors: ["#808080", "#6a6a6a", "#949494"],
          factor: 0.7,
          seed: 12345, // Fixed seed for reproducibility
          pixelSize: 2,
        },
      },
    },
    bones: [
      {
        name: "body",
        cubes: [
          {
            origin: [-8, 0, -8],
            size: [16, 16, 16],
            faces: {
              north: { textureId: "stone_noise" },
              south: { textureId: "stone_noise" },
              east: { textureId: "stone_noise" },
              west: { textureId: "stone_noise" },
              up: { textureId: "stone_noise" },
              down: { textureId: "stone_noise" },
            },
          },
        ],
      },
    ],
  };

  /**
   * Cube with dither pattern noise texture
   */
  static readonly CUBE_WITH_NOISE_DITHER: IMcpModelDesign = {
    identifier: "test_noise_dither",
    textureSize: [64, 64],
    bones: [
      {
        name: "body",
        cubes: [
          {
            origin: [-8, 0, -8],
            size: [16, 16, 16],
            faces: {
              north: {
                background: {
                  type: "dither_noise",
                  colors: ["#5b4121", "#8B4513"],
                  factor: 0.6,
                },
              },
              south: {
                background: {
                  type: "dither_noise",
                  colors: ["#5b4121", "#8B4513"],
                  factor: 0.6,
                },
              },
              east: {
                background: {
                  type: "dither_noise",
                  colors: ["#5b4121", "#8B4513"],
                  factor: 0.6,
                },
              },
              west: {
                background: {
                  type: "dither_noise",
                  colors: ["#5b4121", "#8B4513"],
                  factor: 0.6,
                },
              },
              up: { background: { type: "solid", colors: ["#A0522D"] } },
              down: { background: { type: "solid", colors: ["#A0522D"] } },
            },
          },
        ],
      },
    ],
  };

  /**
   * Cube with noise plus SVG overlay
   */
  static readonly CUBE_WITH_NOISE_AND_SVG_OVERLAY: IMcpModelDesign = {
    identifier: "test_noise_overlay",
    textureSize: [64, 64],
    bones: [
      {
        name: "body",
        cubes: [
          {
            origin: [-8, 0, -8],
            size: [16, 16, 16],
            faces: {
              north: {
                background: {
                  type: "random_noise",
                  colors: ["#4a4a4a", "#3a3a3a", "#5a5a5a"],
                  factor: 0.5,
                  seed: 99999,
                },
                svg: `<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
                  <rect x="7" y="4" width="2" height="8" fill="#ff6600"/>
                </svg>`,
              },
              south: { background: { type: "solid", colors: ["#4a4a4a"] } },
              east: { background: { type: "solid", colors: ["#4a4a4a"] } },
              west: { background: { type: "solid", colors: ["#4a4a4a"] } },
              up: { background: { type: "solid", colors: ["#5a5a5a"] } },
              down: { background: { type: "solid", colors: ["#3a3a3a"] } },
            },
          },
        ],
      },
    ],
  };

  /**
   * Cube with perlin noise pattern (smooth organic noise)
   */
  static readonly CUBE_WITH_NOISE_PERLIN: IMcpModelDesign = {
    identifier: "test_noise_perlin",
    textureSize: [64, 64],
    textures: {
      grass_noise: {
        background: {
          type: "perlin_noise",
          colors: ["#228B22", "#32CD32", "#006400", "#7CFC00"],
          factor: 0.8,
          seed: 54321,
          scale: 6,
        },
      },
    },
    bones: [
      {
        name: "body",
        cubes: [
          {
            origin: [-8, 0, -8],
            size: [16, 16, 16],
            faces: {
              north: { textureId: "grass_noise" },
              south: { textureId: "grass_noise" },
              east: { textureId: "grass_noise" },
              west: { textureId: "grass_noise" },
              up: { textureId: "grass_noise" },
              down: { textureId: "grass_noise" },
            },
          },
        ],
      },
    ],
  };

  /**
   * Cube with stipple noise pattern (scattered dots)
   */
  static readonly CUBE_WITH_NOISE_STIPPLE: IMcpModelDesign = {
    identifier: "test_noise_stipple",
    textureSize: [64, 64],
    textures: {
      sand_stipple: {
        background: {
          type: "stipple_noise",
          colors: ["#C2B280", "#D4C190", "#E8D8A0"],
          factor: 0.4,
          seed: 77777,
        },
      },
    },
    bones: [
      {
        name: "body",
        cubes: [
          {
            origin: [-8, 0, -8],
            size: [16, 16, 16],
            faces: {
              north: { textureId: "sand_stipple" },
              south: { textureId: "sand_stipple" },
              east: { textureId: "sand_stipple" },
              west: { textureId: "sand_stipple" },
              up: { textureId: "sand_stipple" },
              down: { textureId: "sand_stipple" },
            },
          },
        ],
      },
    ],
  };

  /**
   * Cube with gradient noise pattern (smooth color transition)
   */
  static readonly CUBE_WITH_NOISE_GRADIENT: IMcpModelDesign = {
    identifier: "test_noise_gradient",
    textureSize: [64, 64],
    textures: {
      sky_gradient: {
        background: {
          type: "gradient",
          colors: ["#87CEEB", "#4169E1", "#000080"],
          seed: 88888,
        },
      },
    },
    bones: [
      {
        name: "body",
        cubes: [
          {
            origin: [-8, 0, -8],
            size: [16, 16, 16],
            faces: {
              north: { textureId: "sky_gradient" },
              south: { textureId: "sky_gradient" },
              east: { textureId: "sky_gradient" },
              west: { textureId: "sky_gradient" },
              up: { textureId: "sky_gradient" },
              down: { textureId: "sky_gradient" },
            },
          },
        ],
      },
    ],
  };

  /**
   * Cube with red/orange lava-like noise texture
   */
  static readonly CUBE_WITH_NOISE_LAVA: IMcpModelDesign = {
    identifier: "test_noise_lava",
    textureSize: [64, 64],
    textures: {
      lava: {
        background: {
          type: "random_noise",
          colors: ["#FF4500", "#FF6600", "#CC3300", "#FF8C00", "#8B0000"],
          factor: 0.6,
          seed: 11111,
          pixelSize: 3,
        },
      },
    },
    bones: [
      {
        name: "body",
        cubes: [
          {
            origin: [-8, 0, -8],
            size: [16, 16, 16],
            faces: {
              north: { textureId: "lava" },
              south: { textureId: "lava" },
              east: { textureId: "lava" },
              west: { textureId: "lava" },
              up: { textureId: "lava" },
              down: { textureId: "lava" },
            },
          },
        ],
      },
    ],
  };

  /**
   * Complex multi-bone elephant model to test atlas sizing and texture packing
   * This model has 17 bones with different texture sizes, requiring auto-expansion of texture atlas
   */
  static readonly ELEPHANT_MODEL: IMcpModelDesign = {
    identifier: "geometry.elephant",
    textureSize: [64, 64],
    textures: {
      elephant_skin: {
        background: {
          type: "stipple_noise",
          colors: ["#8B8B8B", "#7A7A7A", "#9A9A9A", "#6E6E6E"],
          factor: 0.5,
          seed: 12345,
        },
      },
      elephant_skin_dark: {
        background: {
          type: "stipple_noise",
          colors: ["#6B6B6B", "#5A5A5A", "#7A7A7A", "#505050"],
          factor: 0.5,
          seed: 12346,
        },
      },
      elephant_skin_light: {
        background: {
          type: "stipple_noise",
          colors: ["#A0A0A0", "#909090", "#B0B0B0", "#858585"],
          factor: 0.5,
          seed: 12347,
        },
      },
      pink_ear_inner: {
        background: {
          type: "stipple_noise",
          colors: ["#D4A0A0", "#C89090", "#E0B0B0", "#C08080"],
          seed: 12348,
        },
        effects: {
          lighting: { preset: "inset", intensity: 0.35 },
          border: { all: { style: "solid", width: 1, color: "#B08080" } },
        },
      },
      tusk_texture: {
        background: {
          type: "stipple_noise",
          colors: ["#F5F5DC", "#E8E8C8", "#FFFFD8"],
          factor: 0.3,
          seed: 12349,
        },
      },
      eye_black: { background: { type: "solid", colors: ["#1A1A1A"] } },
      trunk_tip: {
        background: {
          type: "stipple_noise",
          colors: ["#D4A0A0", "#8B8B8B", "#C89090"],
          factor: 0.4,
          seed: 12350,
        },
      },
      leg_bottom: {
        background: {
          type: "dither_noise",
          colors: ["#5A5A5A", "#4A4A4A", "#6A6A6A"],
          factor: 0.5,
          seed: 12351,
        },
      },
    },
    bones: [
      {
        name: "body",
        pivot: [0, 8, 0],
        cubes: [
          {
            origin: [-5, 6, -8],
            size: [10, 10, 16],
            faces: {
              north: { textureId: "elephant_skin" },
              south: { textureId: "elephant_skin" },
              east: { textureId: "elephant_skin_dark" },
              west: { textureId: "elephant_skin_dark" },
              up: { textureId: "elephant_skin_light" },
              down: { textureId: "elephant_skin_dark" },
            },
          },
        ],
      },
      {
        name: "head",
        parent: "body",
        pivot: [0, 12, -8],
        cubes: [
          {
            origin: [-4, 10, -14],
            size: [8, 8, 6],
            faces: {
              north: { textureId: "elephant_skin" },
              south: { textureId: "elephant_skin" },
              east: { textureId: "elephant_skin_dark" },
              west: { textureId: "elephant_skin_dark" },
              up: { textureId: "elephant_skin_light" },
              down: { textureId: "elephant_skin_dark" },
            },
          },
        ],
      },
      {
        name: "trunk_top",
        parent: "head",
        pivot: [0, 12, -14],
        cubes: [
          {
            origin: [-1.5, 8, -17],
            size: [3, 4, 3],
            faces: {
              north: { textureId: "elephant_skin" },
              south: { textureId: "elephant_skin" },
              east: { textureId: "elephant_skin_dark" },
              west: { textureId: "elephant_skin_dark" },
              up: { textureId: "elephant_skin_light" },
              down: { textureId: "elephant_skin_dark" },
            },
          },
        ],
      },
      {
        name: "trunk_middle",
        parent: "trunk_top",
        pivot: [0, 8, -15],
        cubes: [
          {
            origin: [-1, 4, -16],
            size: [2, 4, 2],
            faces: {
              north: { textureId: "elephant_skin" },
              south: { textureId: "elephant_skin" },
              east: { textureId: "elephant_skin_dark" },
              west: { textureId: "elephant_skin_dark" },
              up: { textureId: "elephant_skin_light" },
              down: { textureId: "elephant_skin_dark" },
            },
          },
        ],
      },
      {
        name: "trunk_tip_bone",
        parent: "trunk_middle",
        pivot: [0, 4, -15],
        cubes: [
          {
            origin: [-1, 1, -15],
            size: [2, 3, 2],
            faces: {
              north: { textureId: "elephant_skin" },
              south: { textureId: "elephant_skin" },
              east: { textureId: "elephant_skin_dark" },
              west: { textureId: "elephant_skin_dark" },
              up: { textureId: "elephant_skin_light" },
              down: { textureId: "trunk_tip" },
            },
          },
        ],
      },
      {
        name: "left_ear",
        parent: "head",
        pivot: [-4, 14, -11],
        cubes: [
          {
            origin: [-9, 9, -13],
            size: [5, 7, 1],
            faces: {
              north: { textureId: "elephant_skin_dark" },
              south: { textureId: "pink_ear_inner" },
              east: { textureId: "elephant_skin" },
              west: { textureId: "elephant_skin" },
              up: { textureId: "elephant_skin" },
              down: { textureId: "elephant_skin" },
            },
          },
        ],
      },
      {
        name: "right_ear",
        parent: "head",
        pivot: [4, 14, -11],
        cubes: [
          {
            origin: [4, 9, -13],
            size: [5, 7, 1],
            faces: {
              north: { textureId: "elephant_skin_dark" },
              south: { textureId: "pink_ear_inner" },
              east: { textureId: "elephant_skin" },
              west: { textureId: "elephant_skin" },
              up: { textureId: "elephant_skin" },
              down: { textureId: "elephant_skin" },
            },
          },
        ],
      },
      {
        name: "left_tusk",
        parent: "head",
        pivot: [-2, 10, -14],
        cubes: [
          {
            origin: [-3, 6, -16],
            size: [1, 5, 2],
            faces: {
              north: { textureId: "tusk_texture" },
              south: { textureId: "tusk_texture" },
              east: { textureId: "tusk_texture" },
              west: { textureId: "tusk_texture" },
              up: { textureId: "tusk_texture" },
              down: { textureId: "tusk_texture" },
            },
          },
        ],
      },
      {
        name: "right_tusk",
        parent: "head",
        pivot: [2, 10, -14],
        cubes: [
          {
            origin: [2, 6, -16],
            size: [1, 5, 2],
            faces: {
              north: { textureId: "tusk_texture" },
              south: { textureId: "tusk_texture" },
              east: { textureId: "tusk_texture" },
              west: { textureId: "tusk_texture" },
              up: { textureId: "tusk_texture" },
              down: { textureId: "tusk_texture" },
            },
          },
        ],
      },
      {
        name: "left_eye",
        parent: "head",
        pivot: [-4, 14, -14],
        cubes: [
          {
            origin: [-4.5, 13, -14.5],
            size: [1, 2, 1],
            faces: {
              north: { textureId: "eye_black" },
              south: { textureId: "eye_black" },
              east: { textureId: "eye_black" },
              west: { textureId: "eye_black" },
              up: { textureId: "eye_black" },
              down: { textureId: "eye_black" },
            },
          },
        ],
      },
      {
        name: "right_eye",
        parent: "head",
        pivot: [4, 14, -14],
        cubes: [
          {
            origin: [3.5, 13, -14.5],
            size: [1, 2, 1],
            faces: {
              north: { textureId: "eye_black" },
              south: { textureId: "eye_black" },
              east: { textureId: "eye_black" },
              west: { textureId: "eye_black" },
              up: { textureId: "eye_black" },
              down: { textureId: "eye_black" },
            },
          },
        ],
      },
      {
        name: "front_left_leg",
        parent: "body",
        pivot: [-3, 6, -5],
        cubes: [
          {
            origin: [-5, 0, -7],
            size: [3, 6, 3],
            faces: {
              north: { textureId: "elephant_skin" },
              south: { textureId: "elephant_skin" },
              east: { textureId: "elephant_skin_dark" },
              west: { textureId: "elephant_skin_dark" },
              up: { textureId: "elephant_skin" },
              down: { textureId: "leg_bottom" },
            },
          },
        ],
      },
      {
        name: "front_right_leg",
        parent: "body",
        pivot: [3, 6, -5],
        cubes: [
          {
            origin: [2, 0, -7],
            size: [3, 6, 3],
            faces: {
              north: { textureId: "elephant_skin" },
              south: { textureId: "elephant_skin" },
              east: { textureId: "elephant_skin_dark" },
              west: { textureId: "elephant_skin_dark" },
              up: { textureId: "elephant_skin" },
              down: { textureId: "leg_bottom" },
            },
          },
        ],
      },
      {
        name: "back_left_leg",
        parent: "body",
        pivot: [-3, 6, 5],
        cubes: [
          {
            origin: [-5, 0, 4],
            size: [3, 6, 3],
            faces: {
              north: { textureId: "elephant_skin" },
              south: { textureId: "elephant_skin" },
              east: { textureId: "elephant_skin_dark" },
              west: { textureId: "elephant_skin_dark" },
              up: { textureId: "elephant_skin" },
              down: { textureId: "leg_bottom" },
            },
          },
        ],
      },
      {
        name: "back_right_leg",
        parent: "body",
        pivot: [3, 6, 5],
        cubes: [
          {
            origin: [2, 0, 4],
            size: [3, 6, 3],
            faces: {
              north: { textureId: "elephant_skin" },
              south: { textureId: "elephant_skin" },
              east: { textureId: "elephant_skin_dark" },
              west: { textureId: "elephant_skin_dark" },
              up: { textureId: "elephant_skin" },
              down: { textureId: "leg_bottom" },
            },
          },
        ],
      },
      {
        name: "tail",
        parent: "body",
        pivot: [0, 12, 8],
        cubes: [
          {
            origin: [-0.5, 8, 8],
            size: [1, 5, 1],
            faces: {
              north: { textureId: "elephant_skin_dark" },
              south: { textureId: "elephant_skin_dark" },
              east: { textureId: "elephant_skin_dark" },
              west: { textureId: "elephant_skin_dark" },
              up: { textureId: "elephant_skin" },
              down: { textureId: "elephant_skin_dark" },
            },
          },
        ],
      },
      {
        name: "tail_tuft",
        parent: "tail",
        pivot: [0, 8, 8.5],
        cubes: [
          {
            origin: [-1, 7, 8],
            size: [2, 1, 2],
            faces: {
              north: { textureId: "elephant_skin_dark" },
              south: { textureId: "elephant_skin_dark" },
              east: { textureId: "elephant_skin_dark" },
              west: { textureId: "elephant_skin_dark" },
              up: { textureId: "elephant_skin_dark" },
              down: { textureId: "elephant_skin_dark" },
            },
          },
        ],
      },
    ],
  };

  /**
   * Elephant model variant with SVG textures (for testing SVG-based rendering like user's original)
   * This tests that hand-crafted SVG textures render properly without overflow
   */
  static readonly ELEPHANT_WITH_SVG_TEXTURES: IMcpModelDesign = {
    identifier: "geometry.elephant_svg",
    textureSize: [64, 64],
    textures: {
      elephant_skin: {
        svg: "<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16'><rect width='16' height='16' fill='#8B8B8B'/><rect x='0' y='0' width='2' height='2' fill='#7A7A7A'/><rect x='4' y='1' width='2' height='2' fill='#9A9A9A'/></svg>",
      },
      elephant_skin_dark: {
        svg: "<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16'><rect width='16' height='16' fill='#6B6B6B'/><rect x='1' y='0' width='2' height='2' fill='#5A5A5A'/></svg>",
      },
      elephant_skin_light: {
        svg: "<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16'><rect width='16' height='16' fill='#A0A0A0'/><rect x='0' y='1' width='2' height='2' fill='#909090'/></svg>",
      },
      pink_ear_inner: {
        svg: "<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16'><rect width='16' height='16' fill='#D4A0A0'/></svg>",
      },
      tusk_texture: {
        svg: "<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16'><rect width='16' height='16' fill='#F5F5DC'/></svg>",
      },
      eye_black: {
        svg: "<svg xmlns='http://www.w3.org/2000/svg' width='8' height='8'><rect width='8' height='8' fill='#1A1A1A'/></svg>",
      },
      trunk_tip_svg: {
        svg: "<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16'><rect width='16' height='16' fill='#D4A0A0'/></svg>",
      },
      leg_bottom: {
        svg: "<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16'><rect width='16' height='16' fill='#5A5A5A'/></svg>",
      },
    },
    bones: [
      {
        name: "body",
        pivot: [0, 8, 0],
        cubes: [
          {
            origin: [-5, 6, -8],
            size: [10, 10, 16],
            faces: {
              north: { textureId: "elephant_skin" },
              south: { textureId: "elephant_skin" },
              east: { textureId: "elephant_skin_dark" },
              west: { textureId: "elephant_skin_dark" },
              up: { textureId: "elephant_skin_light" },
              down: { textureId: "elephant_skin_dark" },
            },
          },
        ],
      },
      {
        name: "head",
        parent: "body",
        pivot: [0, 12, -8],
        cubes: [
          {
            origin: [-4, 10, -14],
            size: [8, 8, 6],
            faces: {
              north: { textureId: "elephant_skin" },
              south: { textureId: "elephant_skin" },
              east: { textureId: "elephant_skin_dark" },
              west: { textureId: "elephant_skin_dark" },
              up: { textureId: "elephant_skin_light" },
              down: { textureId: "elephant_skin_dark" },
            },
          },
        ],
      },
      {
        name: "left_ear",
        parent: "head",
        pivot: [-4, 14, -11],
        cubes: [
          {
            origin: [-9, 9, -13],
            size: [5, 7, 1],
            faces: {
              north: { textureId: "elephant_skin_dark" },
              south: { textureId: "pink_ear_inner" },
              east: { textureId: "elephant_skin" },
              west: { textureId: "elephant_skin" },
              up: { textureId: "elephant_skin" },
              down: { textureId: "elephant_skin" },
            },
          },
        ],
      },
      {
        name: "right_ear",
        parent: "head",
        pivot: [4, 14, -11],
        cubes: [
          {
            origin: [4, 9, -13],
            size: [5, 7, 1],
            faces: {
              north: { textureId: "elephant_skin_dark" },
              south: { textureId: "pink_ear_inner" },
              east: { textureId: "elephant_skin" },
              west: { textureId: "elephant_skin" },
              up: { textureId: "elephant_skin" },
              down: { textureId: "elephant_skin" },
            },
          },
        ],
      },
      {
        name: "front_left_leg",
        parent: "body",
        pivot: [-3, 6, -5],
        cubes: [
          {
            origin: [-5, 0, -7],
            size: [3, 6, 3],
            faces: {
              north: { textureId: "elephant_skin" },
              south: { textureId: "elephant_skin" },
              east: { textureId: "elephant_skin_dark" },
              west: { textureId: "elephant_skin_dark" },
              up: { textureId: "elephant_skin" },
              down: { textureId: "leg_bottom" },
            },
          },
        ],
      },
      {
        name: "front_right_leg",
        parent: "body",
        pivot: [3, 6, -5],
        cubes: [
          {
            origin: [2, 0, -7],
            size: [3, 6, 3],
            faces: {
              north: { textureId: "elephant_skin" },
              south: { textureId: "elephant_skin" },
              east: { textureId: "elephant_skin_dark" },
              west: { textureId: "elephant_skin_dark" },
              up: { textureId: "elephant_skin" },
              down: { textureId: "leg_bottom" },
            },
          },
        ],
      },
      {
        name: "back_left_leg",
        parent: "body",
        pivot: [-3, 6, 5],
        cubes: [
          {
            origin: [-5, 0, 4],
            size: [3, 6, 3],
            faces: {
              north: { textureId: "elephant_skin" },
              south: { textureId: "elephant_skin" },
              east: { textureId: "elephant_skin_dark" },
              west: { textureId: "elephant_skin_dark" },
              up: { textureId: "elephant_skin" },
              down: { textureId: "leg_bottom" },
            },
          },
        ],
      },
      {
        name: "back_right_leg",
        parent: "body",
        pivot: [3, 6, 5],
        cubes: [
          {
            origin: [2, 0, 4],
            size: [3, 6, 3],
            faces: {
              north: { textureId: "elephant_skin" },
              south: { textureId: "elephant_skin" },
              east: { textureId: "elephant_skin_dark" },
              west: { textureId: "elephant_skin_dark" },
              up: { textureId: "elephant_skin" },
              down: { textureId: "leg_bottom" },
            },
          },
        ],
      },
    ],
  };

  /**
   * Empty/minimal texture definition (should produce error)
   */
  static readonly TEXTURE_WITHOUT_CONTENT: IMcpModelDesign = {
    identifier: "test_empty_texture",
    textureSize: [64, 64],
    textures: {
      empty: {}, // No color or svg!
    },
    bones: [
      {
        name: "body",
        cubes: [
          {
            origin: [-8, 0, -8],
            size: [16, 16, 16],
            faces: {
              north: { textureId: "empty" },
            },
          },
        ],
      },
    ],
  };

  /**
   * Model with empty parent bone for hierarchy (valid pattern)
   */
  static readonly MODEL_WITH_EMPTY_PARENT_BONE: IMcpModelDesign = {
    identifier: "test_hierarchy",
    textureSize: [64, 64],
    bones: [
      {
        name: "root",
        pivot: [0, 0, 0],
        cubes: [], // Empty parent bone - valid for hierarchy
      },
      {
        name: "body",
        parent: "root",
        pivot: [0, 12, 0],
        cubes: [
          {
            origin: [-4, 0, -4],
            size: [8, 12, 8],
            faces: {
              north: { background: { type: "solid", colors: ["#FF0000"] } },
              south: { background: { type: "solid", colors: ["#FF0000"] } },
              east: { background: { type: "solid", colors: ["#00FF00"] } },
              west: { background: { type: "solid", colors: ["#00FF00"] } },
              up: { background: { type: "solid", colors: ["#0000FF"] } },
              down: { background: { type: "solid", colors: ["#0000FF"] } },
            },
          },
        ],
      },
    ],
  };

  /**
   * Tiny 2x2x2 cube for testing camera scaling with small models
   */
  static readonly TINY_CUBE: IMcpModelDesign = {
    identifier: "test_tiny_cube",
    textureSize: [64, 64],
    bones: [
      {
        name: "body",
        cubes: [
          {
            origin: [0, 0, 0],
            size: [2, 2, 2],
            faces: {
              north: { background: { type: "solid", colors: ["#FF0000"] } },
              south: { background: { type: "solid", colors: ["#00FF00"] } },
              east: { background: { type: "solid", colors: ["#0000FF"] } },
              west: { background: { type: "solid", colors: ["#FFFF00"] } },
              up: { background: { type: "solid", colors: ["#FF00FF"] } },
              down: { background: { type: "solid", colors: ["#00FFFF"] } },
            },
          },
        ],
      },
    ],
  };

  /**
   * Medium 8x8x8 cube for testing camera scaling
   */
  static readonly MEDIUM_CUBE: IMcpModelDesign = {
    identifier: "test_medium_cube",
    textureSize: [64, 64],
    bones: [
      {
        name: "body",
        cubes: [
          {
            origin: [-4, 0, -4],
            size: [8, 8, 8],
            faces: {
              north: { background: { type: "solid", colors: ["#FF6B6B"] } },
              south: { background: { type: "solid", colors: ["#6BCB77"] } },
              east: { background: { type: "solid", colors: ["#4D96FF"] } },
              west: { background: { type: "solid", colors: ["#FFD93D"] } },
              up: { background: { type: "solid", colors: ["#C9B1FF"] } },
              down: { background: { type: "solid", colors: ["#6FEDD6"] } },
            },
          },
        ],
      },
    ],
  };

  /**
   * Large 24x24x24 cube for testing camera scaling with big models
   */
  static readonly LARGE_CUBE: IMcpModelDesign = {
    identifier: "test_large_cube",
    textureSize: [64, 64],
    bones: [
      {
        name: "body",
        cubes: [
          {
            origin: [-12, 0, -12],
            size: [24, 24, 24],
            faces: {
              north: { background: { type: "solid", colors: ["#E74C3C"] } },
              south: { background: { type: "solid", colors: ["#2ECC71"] } },
              east: { background: { type: "solid", colors: ["#3498DB"] } },
              west: { background: { type: "solid", colors: ["#F39C12"] } },
              up: { background: { type: "solid", colors: ["#9B59B6"] } },
              down: { background: { type: "solid", colors: ["#1ABC9C"] } },
            },
          },
        ],
      },
    ],
  };

  // ==========================================
  // Structure Design Test Fixtures (IBlockVolume)
  // ==========================================

  /**
   * Simple 3x3x3 cube structure with varied blocks
   * Using blockLayersBottomToTop: Y layers from bottom to top
   * Each layer has Z rows from north to south, each character is X from west to east
   */
  static readonly SIMPLE_BLOCK_VOLUME: IBlockVolume = {
    entities: [],
    southWestBottom: { x: 0, y: 0, z: 0 },
    size: { x: 3, y: 3, z: 3 },
    blockLayersBottomToTop: [
      // Y=0 (bottom layer)
      ["sss", "sds", "sss"],
      // Y=1 (middle layer)
      ["sds", "d d", "sds"],
      // Y=2 (top layer)
      ["sss", "sds", "sss"],
    ],
    key: {
      s: { typeId: "minecraft:stone" },
      d: { typeId: "minecraft:dirt" },
      " ": { typeId: "minecraft:air" },
    },
  };

  /**
   * Simple 2x2x2 structure with colored blocks
   */
  static readonly TINY_STRUCTURE: IBlockVolume = {
    entities: [],
    southWestBottom: { x: 0, y: 0, z: 0 },
    size: { x: 2, y: 2, z: 2 },
    blockLayersBottomToTop: [
      // Y=0 (bottom layer)
      ["rr", "rr"],
      // Y=1 (top layer)
      ["bb", "bb"],
    ],
    key: {
      r: { typeId: "minecraft:red_wool" },
      b: { typeId: "minecraft:blue_wool" },
    },
  };

  /**
   * Structure with block properties (states)
   */
  static readonly STRUCTURE_WITH_PROPERTIES: IBlockVolume = {
    entities: [],
    southWestBottom: { x: 0, y: 0, z: 0 },
    size: { x: 4, y: 2, z: 1 },
    blockLayersBottomToTop: [
      // Y=0 (bottom layer) - stairs at different rotations
      ["1234"],
      // Y=1 (top layer) - same pattern
      ["1234"],
    ],
    key: {
      "1": {
        typeId: "minecraft:oak_stairs",
        properties: { weirdo_direction: 0 },
      },
      "2": {
        typeId: "minecraft:oak_stairs",
        properties: { weirdo_direction: 1 },
      },
      "3": {
        typeId: "minecraft:oak_stairs",
        properties: { weirdo_direction: 2 },
      },
      "4": {
        typeId: "minecraft:oak_stairs",
        properties: { weirdo_direction: 3 },
      },
    },
  };

  /**
   * Larger 5x5x5 structure for camera scaling test
   */
  static readonly MEDIUM_STRUCTURE: IBlockVolume = {
    entities: [],
    southWestBottom: { x: 0, y: 0, z: 0 },
    size: { x: 5, y: 5, z: 5 },
    blockLayersBottomToTop: [
      // Y=0 (bottom layer - solid floor)
      ["sssss", "sssss", "sssss", "sssss", "sssss"],
      // Y=1 (walls with hollow center)
      ["sssss", "s   s", "s   s", "s   s", "sssss"],
      // Y=2 (walls with hollow center)
      ["sssss", "s   s", "s   s", "s   s", "sssss"],
      // Y=3 (walls with hollow center)
      ["sssss", "s   s", "s   s", "s   s", "sssss"],
      // Y=4 (top layer - solid ceiling)
      ["sssss", "sssss", "sssss", "sssss", "sssss"],
    ],
    key: {
      s: { typeId: "minecraft:stone_bricks" },
      " ": { typeId: "minecraft:air" },
    },
  };

  /**
   * Structure with a simple house-like shape
   * Door is on the south side (last row in each layer)
   */
  static readonly HOUSE_STRUCTURE: IBlockVolume = {
    entities: [],
    southWestBottom: { x: 0, y: 0, z: 0 },
    size: { x: 5, y: 4, z: 5 },
    blockLayersBottomToTop: [
      // Y=0 (ground floor with door opening at south)
      ["ppppp", "p   p", "p   p", "p   p", "p d p"],
      // Y=1 (second level - door continues)
      ["ppppp", "p   p", "p   p", "p   p", "p d p"],
      // Y=2 (third level - walls only)
      ["ppppp", "p   p", "p   p", "p   p", "ppppp"],
      // Y=3 (roof)
      ["ppppp", "ppppp", "ppppp", "ppppp", "ppppp"],
    ],
    key: {
      p: { typeId: "minecraft:oak_planks" },
      d: { typeId: "minecraft:oak_door", properties: { direction: 0 } },
      " ": { typeId: "minecraft:air" },
    },
  };

  /**
   * Cube with pixel art on one face - tests pixel art rendering
   */
  static readonly CUBE_WITH_PIXEL_ART: IMcpModelDesign = {
    identifier: "test_pixel_art",
    textureSize: [128, 128],
    textures: {
      base: {
        background: { type: "solid", colors: ["#8B4513"] }, // Brown wood base
      },
    },
    bones: [
      {
        name: "body",
        cubes: [
          {
            origin: [-8, 0, -8],
            size: [16, 16, 16],
            faces: {
              north: {
                textureId: "base",
                pixelArt: [
                  {
                    x: 20,
                    y: 20,
                    lines: ["X   X", "X   X", "     ", "X   X", " XXX "],
                    palette: {
                      X: { r: 0, g: 0, b: 0 },
                    },
                  },
                ],
              },
              south: { textureId: "base" },
              east: { textureId: "base" },
              west: { textureId: "base" },
              up: { textureId: "base" },
              down: { textureId: "base" },
            },
          },
        ],
      },
    ],
  };

  /**
   * Cube with pixel art using hex colors and alpha transparency
   */
  static readonly CUBE_WITH_PIXEL_ART_HEX: IMcpModelDesign = {
    identifier: "test_pixel_art_hex",
    textureSize: [128, 128],
    bones: [
      {
        name: "body",
        cubes: [
          {
            origin: [-8, 0, -8],
            size: [16, 16, 16],
            faces: {
              north: {
                background: { type: "stipple_noise", colors: ["#4CAF50", "#388E3C"], seed: 999 },
                pixelArt: [
                  {
                    x: 22,
                    y: 18,
                    lines: ["R R", "   ", " R "],
                    palette: {
                      R: { hex: "#FF0000" },
                    },
                  },
                  {
                    x: 22,
                    y: 28,
                    lines: ["####", "#  #", "####"],
                    palette: {
                      "#": { r: 255, g: 255, b: 0 },
                    },
                  },
                ],
              },
              south: { background: { type: "solid", colors: ["#607D8B"] } },
              east: { background: { type: "solid", colors: ["#607D8B"] } },
              west: { background: { type: "solid", colors: ["#607D8B"] } },
              up: { background: { type: "solid", colors: ["#607D8B"] } },
              down: { background: { type: "solid", colors: ["#607D8B"] } },
            },
          },
        ],
      },
    ],
  };

  /**
   * Stone brick block with stipple noise textures (debugging multi-angle render issues)
   */
  static readonly STONE_BRICK_BLOCK: IMcpModelDesign = {
    identifier: "test_stone_brick",
    pixelsPerUnit: 2,
    bones: [
      {
        name: "block",
        pivot: [0, 0, 0],
        cubes: [
          {
            origin: [-8, 0, -8],
            size: [16, 16, 16],
            faces: {
              north: {
                background: { type: "stipple_noise", colors: ["#8B8682", "#7A7570"], seed: 101 },
                effects: { lighting: { preset: "outset", intensity: 0.15 } },
              },
              south: {
                background: { type: "stipple_noise", colors: ["#8B8682", "#7A7570"], seed: 102 },
              },
              east: {
                background: { type: "stipple_noise", colors: ["#8B8682", "#7A7570"], seed: 103 },
              },
              west: {
                background: { type: "stipple_noise", colors: ["#8B8682", "#7A7570"], seed: 104 },
              },
              up: {
                background: { type: "stipple_noise", colors: ["#9B9692", "#8A8580"], seed: 105 },
              },
              down: {
                background: { type: "stipple_noise", colors: ["#7B7672", "#6A6560"], seed: 106 },
              },
            },
          },
        ],
      },
    ],
  };

  /**
   * Glowing ore block with pixelArt overlay (debugging texture rendering)
   */
  static readonly GLOWING_ORE_BLOCK: IMcpModelDesign = {
    identifier: "test_glowing_ore",
    pixelsPerUnit: 2,
    bones: [
      {
        name: "block",
        pivot: [0, 0, 0],
        cubes: [
          {
            origin: [-8, 0, -8],
            size: [16, 16, 16],
            faces: {
              north: {
                background: { type: "stipple_noise", colors: ["#5A5A5A", "#4A4A4A"], seed: 301 },
                pixelArt: [
                  {
                    scaleMode: "cover",
                    lines: [
                      "                ",
                      "    oo          ",
                      "   oOOo         ",
                      "    oo          ",
                      "                ",
                      "          oo    ",
                      "         oOOo   ",
                      "          oo    ",
                      "  oo            ",
                      " oOOo           ",
                      "  oo            ",
                      "                ",
                      "            oo  ",
                      "           oOOo ",
                      "            oo  ",
                      "                ",
                    ],
                    palette: {
                      O: { hex: "#00FFFF" },
                      o: { hex: "#00AAAA" },
                    },
                  },
                ],
              },
              south: {
                background: { type: "stipple_noise", colors: ["#5A5A5A", "#4A4A4A"], seed: 302 },
              },
              east: {
                background: { type: "stipple_noise", colors: ["#5A5A5A", "#4A4A4A"], seed: 303 },
              },
              west: {
                background: { type: "stipple_noise", colors: ["#5A5A5A", "#4A4A4A"], seed: 304 },
              },
              up: {
                background: { type: "stipple_noise", colors: ["#6A6A6A", "#5A5A5A"], seed: 305 },
              },
              down: {
                background: { type: "stipple_noise", colors: ["#4A4A4A", "#3A3A3A"], seed: 306 },
              },
            },
          },
        ],
      },
    ],
  };

  /**
   * Mossy stone block with overlay effects array - used to debug multi-angle render failures
   * This model has an array of overlay effects which was causing rendering issues
   */
  static readonly MOSSY_STONE_BLOCK: IMcpModelDesign = {
    identifier: "test_mossy_stone",
    pixelsPerUnit: 2,
    bones: [
      {
        name: "block",
        pivot: [0, 8, 0],
        cubes: [
          {
            origin: [-8, 0, -8],
            size: [16, 16, 16],
            faces: {
              north: { textureId: "mossy" },
              south: { textureId: "mossy" },
              east: { textureId: "mossy" },
              west: { textureId: "mossy" },
              up: { textureId: "mossy" },
              down: { textureId: "mossy" },
            },
          },
        ],
      },
    ],
    textures: {
      mossy: {
        background: { type: "stipple_noise", colors: ["#8B8B8B", "#7A7A7A", "#9A9A9A"], seed: 2301 },
        effects: {
          overlay: [
            { pattern: "cracks", density: 0.15, seed: 2302 },
            { pattern: "moss", density: 0.3, seed: 2303 },
          ],
        },
      },
    },
  };

  /**
   * Crystal block with pillow lighting and sparkle overlay - debug multi-angle render failures
   */
  static readonly CRYSTAL_BLOCK: IMcpModelDesign = {
    identifier: "test_crystal_block",
    pixelsPerUnit: 2,
    bones: [
      {
        name: "block",
        pivot: [0, 8, 0],
        cubes: [
          {
            origin: [-8, 0, -8],
            size: [16, 16, 16],
            faces: {
              north: { textureId: "crystal" },
              south: { textureId: "crystal" },
              east: { textureId: "crystal" },
              west: { textureId: "crystal" },
              up: { textureId: "crystal" },
              down: { textureId: "crystal" },
            },
          },
        ],
      },
    ],
    textures: {
      crystal: {
        background: { type: "perlin_noise", colors: ["#9B59B6", "#8E44AD", "#BF55EC"], scale: 8, seed: 2401 },
        effects: {
          lighting: { preset: "pillow", intensity: 0.4 },
          overlay: { pattern: "sparkle", density: 0.2, seed: 2402 },
        },
      },
    },
  };

  /**
   * Potion bottle with multiple cubes and sparkle overlay - debug multi-angle render failures
   */
  static readonly POTION_BOTTLE_ITEM: IMcpModelDesign = {
    identifier: "test_potion_bottle",
    pixelsPerUnit: 2,
    bones: [
      {
        name: "cork",
        pivot: [0, 15, 0],
        cubes: [
          {
            origin: [-1, 14, -1],
            size: [2, 2, 2],
            faces: {
              north: { textureId: "cork" },
              south: { textureId: "cork" },
              east: { textureId: "cork" },
              west: { textureId: "cork" },
              up: { textureId: "cork" },
              down: { textureId: "cork" },
            },
          },
        ],
      },
      {
        name: "neck",
        pivot: [0, 13, 0],
        cubes: [
          {
            origin: [-1.5, 12, -1.5],
            size: [3, 3, 3],
            faces: {
              north: { textureId: "glass" },
              south: { textureId: "glass" },
              east: { textureId: "glass" },
              west: { textureId: "glass" },
              up: { textureId: "glass" },
              down: { textureId: "glass" },
            },
          },
        ],
      },
      {
        name: "body",
        pivot: [0, 6, 0],
        cubes: [
          {
            origin: [-3, 0, -3],
            size: [6, 12, 6],
            faces: {
              north: { textureId: "bottle" },
              south: { textureId: "bottle" },
              east: { textureId: "bottle" },
              west: { textureId: "bottle" },
              up: { textureId: "liquid" },
              down: { textureId: "liquid" },
            },
          },
        ],
      },
    ],
    textures: {
      cork: { background: { type: "dither_noise", colors: ["#8B7355", "#7A6248"], seed: 3003 } },
      glass: {
        background: { type: "solid", colors: ["#C0E0F0"] },
        effects: { lighting: { preset: "outset", intensity: 0.3 } },
      },
      bottle: {
        background: { type: "solid", colors: ["#A8D8EA", "#87CEEB"], seed: 3001 },
        effects: { lighting: { preset: "pillow", intensity: 0.4 } },
      },
      liquid: {
        background: { type: "perlin_noise", colors: ["#FF6B9D", "#FF4081", "#FF1493"], seed: 3002 },
        effects: { overlay: { pattern: "sparkle", density: 0.15, seed: 3004 } },
      },
    },
  };

  /**
   * Magic wand with tall thin staff - debug multi-angle render failures for tall skinny models
   */
  static readonly MAGIC_WAND_ITEM: IMcpModelDesign = {
    identifier: "test_magic_wand",
    pixelsPerUnit: 2,
    bones: [
      {
        name: "crystal",
        pivot: [0, 27, 0],
        cubes: [
          {
            origin: [-2, 24, -2],
            size: [4, 6, 4],
            faces: {
              north: { textureId: "crystal" },
              south: { textureId: "crystal" },
              east: { textureId: "crystal" },
              west: { textureId: "crystal" },
              up: { textureId: "crystal" },
              down: { textureId: "crystal" },
            },
          },
        ],
      },
      {
        name: "staff",
        pivot: [0, 12, 0],
        cubes: [
          {
            origin: [-1, 0, -1],
            size: [2, 24, 2],
            faces: {
              north: { textureId: "wood" },
              south: { textureId: "wood" },
              east: { textureId: "wood" },
              west: { textureId: "wood" },
              up: { textureId: "wood" },
              down: { textureId: "wood" },
            },
          },
        ],
      },
    ],
    textures: {
      crystal: {
        background: { type: "perlin_noise", colors: ["#00FFFF", "#00CED1", "#40E0D0"], scale: 4, seed: 3101 },
        effects: {
          lighting: { preset: "pillow", intensity: 0.5 },
          overlay: { pattern: "sparkle", density: 0.3, seed: 3102 },
        },
      },
      wood: {
        background: { type: "stipple_noise", colors: ["#4A3728", "#3D2E22", "#5C483A"], seed: 3103 },
        effects: { lighting: { preset: "outset", intensity: 0.2 } },
      },
    },
  };
}

describe("ModelDesignUtilities", () => {
  describe("resolveFaceContent", () => {
    it("should return undefined for undefined face content", () => {
      const warnings: string[] = [];
      const result = ModelDesignUtilities.resolveFaceContent(undefined, undefined, warnings);
      expect(result).to.be.undefined;
    });

    it("should return inline color when no textureId", () => {
      const warnings: string[] = [];
      const faceContent: IMcpFaceContent = { color: "#FF0000" };
      const result = ModelDesignUtilities.resolveFaceContent(faceContent, undefined, warnings);

      expect(result).to.not.be.undefined;
      expect(result!.color).to.equal("#FF0000");
      expect(result!.sourceTextureId).to.be.undefined;
      expect(warnings).to.have.length(0);
    });

    it("should return inline svg when no textureId", () => {
      const warnings: string[] = [];
      const faceContent: IMcpFaceContent = { svg: "<svg>test</svg>" };
      const result = ModelDesignUtilities.resolveFaceContent(faceContent, undefined, warnings);

      expect(result).to.not.be.undefined;
      expect(result!.svg).to.equal("<svg>test</svg>");
      expect(warnings).to.have.length(0);
    });

    it("should resolve textureId to texture definition", () => {
      const warnings: string[] = [];
      const faceContent: IMcpFaceContent = { textureId: "wood" };
      const textures = { wood: { color: "#8B4513" } };
      const result = ModelDesignUtilities.resolveFaceContent(faceContent, textures, warnings);

      expect(result).to.not.be.undefined;
      expect(result!.color).to.equal("#8B4513");
      expect(result!.sourceTextureId).to.equal("wood");
      expect(warnings).to.have.length(0);
    });

    it("should preserve rotation from face when resolving textureId", () => {
      const warnings: string[] = [];
      const faceContent: IMcpFaceContent = { textureId: "wood", rotation: 90 };
      const textures = { wood: { color: "#8B4513" } };
      const result = ModelDesignUtilities.resolveFaceContent(faceContent, textures, warnings);

      expect(result).to.not.be.undefined;
      expect(result!.rotation).to.equal(90);
    });

    it("should warn when textureId not found in dictionary", () => {
      const warnings: string[] = [];
      const faceContent: IMcpFaceContent = { textureId: "nonexistent" };
      const textures = { wood: { color: "#8B4513" } };
      const result = ModelDesignUtilities.resolveFaceContent(faceContent, textures, warnings);

      // Should return undefined since texture not found and no fallback
      expect(result).to.be.undefined;
      expect(warnings).to.have.length(1);
      expect(warnings[0]).to.include("nonexistent");
    });

    it("should warn when textureId used but no textures dictionary", () => {
      const warnings: string[] = [];
      const faceContent: IMcpFaceContent = { textureId: "wood" };
      const result = ModelDesignUtilities.resolveFaceContent(faceContent, undefined, warnings);

      expect(result).to.be.undefined;
      expect(warnings).to.have.length(1);
      expect(warnings[0]).to.include("no textures dictionary");
    });

    it("should fall back to inline content when textureId lookup fails", () => {
      const warnings: string[] = [];
      const faceContent: IMcpFaceContent = { textureId: "nonexistent", color: "#FF0000" };
      const textures = { wood: { color: "#8B4513" } };
      const result = ModelDesignUtilities.resolveFaceContent(faceContent, textures, warnings);

      // Should fall back to inline color
      expect(result).to.not.be.undefined;
      expect(result!.color).to.equal("#FF0000");
      expect(result!.sourceTextureId).to.be.undefined;
      expect(warnings).to.have.length(1); // Still warns about missing texture
    });
  });

  describe("getContentHash", () => {
    it("should return consistent hash for same textureId", () => {
      const content1: IResolvedFaceContent = { color: "#FF0000", sourceTextureId: "red" };
      const content2: IResolvedFaceContent = { color: "#FF0000", sourceTextureId: "red" };

      const hash1 = ModelDesignUtilities.getContentHash(content1);
      const hash2 = ModelDesignUtilities.getContentHash(content2);

      expect(hash1).to.equal(hash2);
      expect(hash1).to.include("texref:");
    });

    it("should return different hash for different textureIds", () => {
      const content1: IResolvedFaceContent = { color: "#FF0000", sourceTextureId: "red" };
      const content2: IResolvedFaceContent = { color: "#FF0000", sourceTextureId: "also_red" };

      const hash1 = ModelDesignUtilities.getContentHash(content1);
      const hash2 = ModelDesignUtilities.getContentHash(content2);

      expect(hash1).to.not.equal(hash2);
    });

    it("should hash by content when no textureId", () => {
      const content1: IResolvedFaceContent = { color: "#FF0000" };
      const content2: IResolvedFaceContent = { color: "#FF0000" };
      const content3: IResolvedFaceContent = { color: "#00FF00" };

      const hash1 = ModelDesignUtilities.getContentHash(content1);
      const hash2 = ModelDesignUtilities.getContentHash(content2);
      const hash3 = ModelDesignUtilities.getContentHash(content3);

      expect(hash1).to.equal(hash2);
      expect(hash1).to.not.equal(hash3);
      expect(hash1).to.include("color:");
    });

    it("should hash SVG content", () => {
      const content: IResolvedFaceContent = { svg: "<svg>test</svg>" };
      const hash = ModelDesignUtilities.getContentHash(content);

      expect(hash).to.include("svg:");
      expect(hash).to.include("<svg>test</svg>");
    });
  });

  describe("validateDesign", () => {
    it("should pass validation for valid design with textures", () => {
      const errors = ModelDesignUtilities.validateDesign(McpTestFixtures.CUBE_WITH_TEXTURE_REFS);
      expect(errors).to.have.length(0);
    });

    it("should detect invalid texture reference", () => {
      const errors = ModelDesignUtilities.validateDesign(McpTestFixtures.CUBE_WITH_INVALID_REF);

      expect(errors.length).to.be.greaterThan(0);
      expect(errors.some((e) => e.includes("nonexistent_texture"))).to.be.true;
    });

    it("should detect texture reference with no dictionary", () => {
      const errors = ModelDesignUtilities.validateDesign(McpTestFixtures.CUBE_WITH_REF_NO_DICT);

      expect(errors.length).to.be.greaterThan(0);
      expect(errors.some((e) => e.includes("no textures dictionary"))).to.be.true;
    });

    it("should detect empty texture definition", () => {
      const errors = ModelDesignUtilities.validateDesign(McpTestFixtures.TEXTURE_WITHOUT_CONTENT);

      expect(errors.length).to.be.greaterThan(0);
      expect(errors.some((e) => e.includes("must have either a background, noise, svg, color, or pixelArt"))).to.be
        .true;
    });

    it("should pass validation for mixed inline and referenced textures", () => {
      const errors = ModelDesignUtilities.validateDesign(McpTestFixtures.CUBE_WITH_MIXED_TEXTURES);
      expect(errors).to.have.length(0);
    });

    it("should allow empty parent bones for hierarchy organization", () => {
      const errors = ModelDesignUtilities.validateDesign(McpTestFixtures.MODEL_WITH_EMPTY_PARENT_BONE);
      expect(errors).to.have.length(0);
    });
  });

  describe("calculateModelBounds", () => {
    it("should calculate bounds for simple cube", () => {
      const bounds = ModelDesignUtilities.calculateModelBounds(McpTestFixtures.SIMPLE_COLORED_CUBE);

      // Simple cube is at origin [-8,0,-8] with size [16,16,16]
      expect(bounds.minX).to.equal(-8);
      expect(bounds.minY).to.equal(0);
      expect(bounds.minZ).to.equal(-8);
      expect(bounds.maxX).to.equal(8);
      expect(bounds.maxY).to.equal(16);
      expect(bounds.maxZ).to.equal(8);
      expect(bounds.maxDimension).to.equal(16);
      expect(bounds.center.x).to.equal(0);
      expect(bounds.center.y).to.equal(8);
      expect(bounds.center.z).to.equal(0);
    });

    it("should calculate bounds for multi-bone model", () => {
      const bounds = ModelDesignUtilities.calculateModelBounds(McpTestFixtures.MULTI_BONE_WITH_SHARED_TEXTURES);

      // Multi-bone model has cubes at different positions
      expect(bounds.maxDimension).to.be.greaterThan(0);
      expect(bounds.center.x).to.not.be.NaN;
      expect(bounds.center.y).to.not.be.NaN;
      expect(bounds.center.z).to.not.be.NaN;
    });

    it("should handle model with empty parent bone", () => {
      const bounds = ModelDesignUtilities.calculateModelBounds(McpTestFixtures.MODEL_WITH_EMPTY_PARENT_BONE);

      // Should calculate bounds from child cubes only
      expect(bounds.maxDimension).to.be.greaterThan(0);
    });
  });

  describe("convertToGeometry", () => {
    it("should convert simple colored cube", () => {
      const result = ModelDesignUtilities.convertToGeometry(McpTestFixtures.SIMPLE_COLORED_CUBE);

      expect(result.geometry).to.not.be.undefined;
      expect(result.geometry["minecraft:geometry"]).to.have.length(1);
      expect(result.atlasRegions.length).to.equal(6); // 6 faces
      // May have texture size auto-expansion warnings, but no error warnings
      const errorWarnings = result.warnings.filter((w) => !w.includes("Auto-expanded"));
      expect(errorWarnings).to.have.length(0);
    });

    it("should resolve texture references in conversion", () => {
      const result = ModelDesignUtilities.convertToGeometry(McpTestFixtures.CUBE_WITH_TEXTURE_REFS);

      expect(result.geometry).to.not.be.undefined;
      // May have texture size auto-expansion warnings, but no error warnings
      const errorWarnings = result.warnings.filter((w) => !w.includes("Auto-expanded"));
      expect(errorWarnings).to.have.length(0);

      // Check that atlas regions have resolved content (not just textureIds)
      for (const region of result.atlasRegions) {
        // Content should have background (modern format) or color (deprecated format)
        expect(region.content.background || region.content.color).to.not.be.undefined;
        // textureId should not appear in resolved content
        expect((region.content as any).textureId).to.be.undefined;
      }
    });

    it("should deduplicate identical textures at same size", () => {
      const result = ModelDesignUtilities.convertToGeometry(McpTestFixtures.CUBE_WITH_DEDUPLICATION);

      // All 6 faces use the same texture at the same size
      // Should only need 1 unique atlas region (others reuse it)
      // The atlasRegions array still has 6 entries (one per face), but they share coordinates

      // Count unique atlas positions
      const uniquePositions = new Set<string>();
      for (const region of result.atlasRegions) {
        uniquePositions.add(`${region.x},${region.y}`);
      }

      // Should have only 1 unique position (all faces share the same atlas slot)
      expect(uniquePositions.size).to.equal(1);
      expect(result.atlasRegions).to.have.length(6); // Still 6 face entries
    });

    it("should handle mixed inline and referenced textures", () => {
      const result = ModelDesignUtilities.convertToGeometry(McpTestFixtures.CUBE_WITH_MIXED_TEXTURES);

      expect(result.geometry).to.not.be.undefined;
      // May have texture size auto-expansion warnings, but no error warnings
      const errorWarnings = result.warnings.filter((w) => !w.includes("Auto-expanded"));
      expect(errorWarnings).to.have.length(0);

      // Should have atlas regions for all defined faces
      expect(result.atlasRegions.length).to.equal(6);

      // Count unique positions - wood faces (3) + red faces (2) + svg face (1)
      // But wood faces share, red faces share
      const uniquePositions = new Set<string>();
      for (const region of result.atlasRegions) {
        uniquePositions.add(`${region.x},${region.y}`);
      }

      // wood (3 faces), red color (2 faces), svg (1 face) = 3 unique textures
      expect(uniquePositions.size).to.equal(3);
    });

    it("should handle multi-bone models with shared textures", () => {
      const result = ModelDesignUtilities.convertToGeometry(McpTestFixtures.MULTI_BONE_WITH_SHARED_TEXTURES);

      expect(result.geometry).to.not.be.undefined;
      expect(result.warnings).to.have.length(0);

      // Count faces: head (6) + body (6) + leg (6) = 18 faces
      expect(result.atlasRegions).to.have.length(18);

      // But textures are shared: skin, clothes, shoes
      // skin: 6 faces (head) - all same size
      // clothes: 6 faces (body) + 5 faces (leg top/sides) - different sizes!
      // shoes: 1 face (leg bottom)
      // Note: body and leg have different sizes, so clothes textures may not fully dedupe
    });

    it("should warn on invalid texture references during conversion", () => {
      const result = ModelDesignUtilities.convertToGeometry(McpTestFixtures.CUBE_WITH_INVALID_REF);

      // Should have warnings about the invalid reference
      expect(result.warnings.length).to.be.greaterThan(0);
      expect(result.warnings.some((w) => w.includes("nonexistent_texture"))).to.be.true;
    });

    it("should generate correct geometry identifier", () => {
      const result = ModelDesignUtilities.convertToGeometry(McpTestFixtures.SIMPLE_COLORED_CUBE);

      const geometry = result.geometry["minecraft:geometry"][0];
      expect(geometry.description.identifier).to.equal("geometry.test_simple_cube");
    });

    it("should handle SVG textures", () => {
      const result = ModelDesignUtilities.convertToGeometry(McpTestFixtures.CUBE_WITH_SVG_TEXTURE);

      expect(result.geometry).to.not.be.undefined;
      expect(result.warnings).to.have.length(0);

      // All faces use the same SVG texture
      const uniquePositions = new Set<string>();
      for (const region of result.atlasRegions) {
        uniquePositions.add(`${region.x},${region.y}`);
        // Check that SVG content is preserved
        expect(region.content.svg).to.include("<svg");
      }

      // Should deduplicate to 1 unique position
      expect(uniquePositions.size).to.equal(1);
    });
  });

  describe("texture atlas size calculation", () => {
    it("should reduce atlas size when textures are deduplicated", () => {
      // Compare a design with 6 unique faces vs 6 identical faces
      const uniqueFaces: IMcpModelDesign = {
        identifier: "unique",
        bones: [
          {
            name: "body",
            cubes: [
              {
                origin: [0, 0, 0],
                size: [16, 16, 16],
                faces: {
                  north: { color: "#FF0000" },
                  south: { color: "#00FF00" },
                  east: { color: "#0000FF" },
                  west: { color: "#FFFF00" },
                  up: { color: "#FF00FF" },
                  down: { color: "#00FFFF" },
                },
              },
            ],
          },
        ],
      };

      const identicalFaces: IMcpModelDesign = {
        identifier: "identical",
        textures: { same: { color: "#808080" } },
        bones: [
          {
            name: "body",
            cubes: [
              {
                origin: [0, 0, 0],
                size: [16, 16, 16],
                faces: {
                  north: { textureId: "same" },
                  south: { textureId: "same" },
                  east: { textureId: "same" },
                  west: { textureId: "same" },
                  up: { textureId: "same" },
                  down: { textureId: "same" },
                },
              },
            ],
          },
        ],
      };

      const uniqueResult = ModelDesignUtilities.convertToGeometry(uniqueFaces);
      const identicalResult = ModelDesignUtilities.convertToGeometry(identicalFaces);

      // Count unique atlas slots used
      const uniqueSlots = new Set(uniqueResult.atlasRegions.map((r) => `${r.x},${r.y}`));
      const identicalSlots = new Set(identicalResult.atlasRegions.map((r) => `${r.x},${r.y}`));

      expect(uniqueSlots.size).to.equal(6);
      expect(identicalSlots.size).to.equal(1);
    });

    it("should auto-expand texture atlas when requested size is too small", () => {
      // Create a model with many unique textures that won't fit in 64x64
      // Body cube is 10x10x16, which means faces are:
      // - north/south: 10x10 pixels
      // - east/west: 16x10 pixels
      // - up/down: 10x16 pixels
      // With 8 unique SVG textures, we need significant space
      const bigModelSmallTexture: IMcpModelDesign = {
        identifier: "test_auto_expand",
        textureSize: [32, 32], // Request too small!
        textures: {
          tex1: {
            svg: "<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16'><rect fill='#FF0000' width='16' height='16'/></svg>",
          },
          tex2: {
            svg: "<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16'><rect fill='#00FF00' width='16' height='16'/></svg>",
          },
          tex3: {
            svg: "<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16'><rect fill='#0000FF' width='16' height='16'/></svg>",
          },
          tex4: {
            svg: "<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16'><rect fill='#FFFF00' width='16' height='16'/></svg>",
          },
          tex5: {
            svg: "<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16'><rect fill='#FF00FF' width='16' height='16'/></svg>",
          },
          tex6: {
            svg: "<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16'><rect fill='#00FFFF' width='16' height='16'/></svg>",
          },
          tex7: {
            svg: "<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16'><rect fill='#808080' width='16' height='16'/></svg>",
          },
          tex8: {
            svg: "<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16'><rect fill='#404040' width='16' height='16'/></svg>",
          },
        },
        bones: [
          {
            name: "body",
            pivot: [0, 8, 0],
            cubes: [
              {
                origin: [-5, 6, -8],
                size: [10, 10, 16], // Large cube with unique textures per face
                faces: {
                  north: { textureId: "tex1" },
                  south: { textureId: "tex2" },
                  east: { textureId: "tex3" },
                  west: { textureId: "tex4" },
                  up: { textureId: "tex5" },
                  down: { textureId: "tex6" },
                },
              },
            ],
          },
          {
            name: "head",
            parent: "body",
            pivot: [0, 12, -8],
            cubes: [
              {
                origin: [-4, 10, -14],
                size: [8, 8, 6], // Another cube with different textures
                faces: {
                  north: { textureId: "tex7" },
                  south: { textureId: "tex8" },
                  east: { textureId: "tex1" },
                  west: { textureId: "tex2" },
                  up: { textureId: "tex3" },
                  down: { textureId: "tex4" },
                },
              },
            ],
          },
        ],
      };

      const result = ModelDesignUtilities.convertToGeometry(bigModelSmallTexture);

      // Should have auto-expanded texture size (result.textureSize is the actual size used)
      expect(result.textureSize[0]).to.be.greaterThan(32);
      expect(result.textureSize[1]).to.be.greaterThan(32);

      // Should have a warning about expansion
      const expansionWarnings = result.warnings.filter(
        (w: string) => w.includes("Auto-expanded") || w.includes("too small")
      );
      expect(expansionWarnings.length).to.be.greaterThan(0, "Should warn about texture size expansion");

      // Should NOT have overflow warnings
      const overflowWarnings = result.warnings.filter((w: string) => w.toLowerCase().includes("overflow"));
      expect(overflowWarnings.length).to.equal(0, "Should not have overflow warnings after expansion");

      // All atlas regions should have valid positions
      for (const region of result.atlasRegions) {
        expect(region.x).to.be.lessThan(result.textureSize[0]);
        expect(region.y).to.be.lessThan(result.textureSize[1]);
        expect(region.x + region.width).to.be.lessThanOrEqual(result.textureSize[0]);
        expect(region.y + region.height).to.be.lessThanOrEqual(result.textureSize[1]);
      }
    });

    it("should handle complex multi-bone model without overflow", () => {
      // Use the elephant model fixture which has 17 bones
      const result = ModelDesignUtilities.convertToGeometry(McpTestFixtures.ELEPHANT_MODEL);

      // Should not have any overflow warnings
      const overflowWarnings = result.warnings.filter((w: string) => w.toLowerCase().includes("overflow"));
      expect(overflowWarnings).to.be.an("array").that.is.empty;

      // Should have allocated regions for all faces
      // 17 bones × 6 faces = 102 potential faces, but many share textures
      expect(result.atlasRegions.length).to.be.greaterThan(50);

      // All regions should be within bounds
      const texWidth = result.textureSize[0];
      const texHeight = result.textureSize[1];
      for (const region of result.atlasRegions) {
        expect(region.x + region.width).to.be.lessThanOrEqual(
          texWidth,
          `Region at (${region.x}, ${region.y}) with size ${region.width}x${region.height} overflows width ${texWidth}`
        );
        expect(region.y + region.height).to.be.lessThanOrEqual(
          texHeight,
          `Region at (${region.x}, ${region.y}) with size ${region.width}x${region.height} overflows height ${texHeight}`
        );
      }
    });
  });

  describe("noise texture generation", () => {
    it("should generate valid SVG from noise config", () => {
      const noiseConfig: IMcpNoiseConfig = {
        pattern: "random",
        colors: ["#FF0000", "#00FF00"],
        factor: 0.5,
        seed: 12345,
        pixelSize: 2,
      };

      const svg = TexturedRectangleGenerator.generateNoiseSvg(noiseConfig, 16, 16, "test-context");

      // Verify it's valid SVG
      expect(svg).to.include("<svg");
      expect(svg).to.include("</svg>");
      expect(svg).to.include("viewBox");

      // Should contain rect elements (the noise pixels)
      expect(svg).to.include("<rect");
    });

    it("should produce deterministic output with same seed", () => {
      const noiseConfig: IMcpNoiseConfig = {
        pattern: "random",
        colors: ["#808080", "#606060"],
        factor: 0.5,
        seed: 99999,
      };

      const svg1 = TexturedRectangleGenerator.generateNoiseSvg(noiseConfig, 16, 16, "test");
      const svg2 = TexturedRectangleGenerator.generateNoiseSvg(noiseConfig, 16, 16, "test");

      expect(svg1).to.equal(svg2);
    });

    it("should produce different output with different seeds", () => {
      const noiseConfig1: IMcpNoiseConfig = {
        pattern: "random",
        colors: ["#808080", "#606060"],
        factor: 0.5,
        seed: 11111,
      };

      const noiseConfig2: IMcpNoiseConfig = {
        pattern: "random",
        colors: ["#808080", "#606060"],
        factor: 0.5,
        seed: 22222,
      };

      const svg1 = TexturedRectangleGenerator.generateNoiseSvg(noiseConfig1, 16, 16);
      const svg2 = TexturedRectangleGenerator.generateNoiseSvg(noiseConfig2, 16, 16);

      expect(svg1).to.not.equal(svg2);
    });

    it("should support all noise pattern types", () => {
      const patterns: Array<"random" | "dither" | "perlin" | "stipple" | "gradient"> = [
        "random",
        "dither",
        "perlin",
        "stipple",
        "gradient",
      ];

      for (const pattern of patterns) {
        const noiseConfig: IMcpNoiseConfig = {
          pattern,
          colors: ["#FF0000", "#0000FF"],
          factor: 0.5,
          seed: 12345,
        };

        const svg = TexturedRectangleGenerator.generateNoiseSvg(noiseConfig, 16, 16);
        expect(svg, `Pattern ${pattern} should produce valid SVG`).to.include("<svg");
        expect(svg, `Pattern ${pattern} should contain rects`).to.include("<rect");
      }
    });

    it("should resolve noise from texture dictionary", () => {
      const result = ModelDesignUtilities.convertToGeometry(McpTestFixtures.CUBE_WITH_NOISE_RANDOM);

      expect(result.warnings).to.have.lengthOf(0);
      expect(result.atlasRegions.length).to.be.greaterThan(0);

      // All regions should have background with noise type (modern format)
      for (const region of result.atlasRegions) {
        expect(region.content.background).to.exist;
        expect(region.content.background?.type).to.equal("random_noise");
      }
    });

    it("should combine noise with SVG overlay", () => {
      const svg = TexturedRectangleGenerator.combineWithOverlay(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect x="0" y="0" width="16" height="16" fill="#808080"/></svg>',
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect x="7" y="4" width="2" height="8" fill="#ff6600"/></svg>',
        16,
        16
      );

      // Should contain both the background and overlay content
      expect(svg).to.include('fill="#808080"');
      expect(svg).to.include('fill="#ff6600"');
    });

    it("should include noise in face content resolution", () => {
      const faceContent: IMcpFaceContent = {
        noise: {
          pattern: "dither",
          colors: ["#AA0000", "#FF0000"],
          factor: 0.5,
        },
      };

      const resolved = ModelDesignUtilities.resolveFaceContent(faceContent, undefined, []);

      expect(resolved).to.exist;
      expect(resolved?.noise).to.exist;
      expect(resolved?.noise?.pattern).to.equal("dither");
      expect(resolved?.noise?.colors).to.deep.equal(["#AA0000", "#FF0000"]);
    });

    it("should generate noise SVG via getFaceSvg", () => {
      const content: IMcpFaceContent = {
        noise: {
          pattern: "random",
          colors: ["#333333", "#666666"],
          factor: 0.4,
          seed: 54321,
        },
      };

      const svg = ModelDesignUtilities.getFaceSvg(content, 8, 8, "test-face");

      expect(svg).to.include("<svg");
      expect(svg).to.include("<rect");
    });
  });

  describe("pixel art rendering", () => {
    it("should pass validation for valid pixel art", () => {
      const errors = ModelDesignUtilities.validateDesign(McpTestFixtures.CUBE_WITH_PIXEL_ART);
      expect(errors).to.have.length(0);
    });

    it("should pass validation for pixel art with hex colors", () => {
      const errors = ModelDesignUtilities.validateDesign(McpTestFixtures.CUBE_WITH_PIXEL_ART_HEX);
      expect(errors).to.have.length(0);
    });

    it("should detect invalid palette color", () => {
      const badDesign: IMcpModelDesign = {
        identifier: "test",
        bones: [
          {
            name: "body",
            cubes: [
              {
                origin: [0, 0, 0],
                size: [1, 1, 1],
                faces: {
                  north: {
                    background: { type: "solid", colors: ["#888888"] },
                    pixelArt: [
                      {
                        lines: ["X"],
                        palette: {
                          X: { r: 300, g: 0, b: 0 }, // r > 255
                        },
                      },
                    ],
                  },
                  south: { color: "#808080" },
                  east: { color: "#808080" },
                  west: { color: "#808080" },
                  up: { color: "#808080" },
                  down: { color: "#808080" },
                },
              },
            ],
          },
        ],
      };

      const errors = ModelDesignUtilities.validateDesign(badDesign);
      expect(errors.some((e) => e.includes("must be 0-255"))).to.be.true;
    });

    it("should detect unused palette character", () => {
      const badDesign: IMcpModelDesign = {
        identifier: "test",
        bones: [
          {
            name: "body",
            cubes: [
              {
                origin: [0, 0, 0],
                size: [1, 1, 1],
                faces: {
                  north: {
                    background: { type: "solid", colors: ["#888888"] },
                    pixelArt: [
                      {
                        lines: ["X"], // Only uses X
                        palette: {
                          X: { r: 255, g: 0, b: 0 },
                          Y: { r: 0, g: 255, b: 0 }, // Y is never used
                        },
                      },
                    ],
                  },
                  south: { color: "#808080" },
                  east: { color: "#808080" },
                  west: { color: "#808080" },
                  up: { color: "#808080" },
                  down: { color: "#808080" },
                },
              },
            ],
          },
        ],
      };

      const errors = ModelDesignUtilities.validateDesign(badDesign);
      expect(errors.some((e) => e.includes("unused colors"))).to.be.true;
    });

    it("should detect character not in palette", () => {
      const badDesign: IMcpModelDesign = {
        identifier: "test",
        bones: [
          {
            name: "body",
            cubes: [
              {
                origin: [0, 0, 0],
                size: [1, 1, 1],
                faces: {
                  north: {
                    background: { type: "solid", colors: ["#888888"] },
                    pixelArt: [
                      {
                        lines: ["XY"], // Uses Y but Y not in palette
                        palette: {
                          X: { r: 255, g: 0, b: 0 },
                        },
                      },
                    ],
                  },
                  south: { color: "#808080" },
                  east: { color: "#808080" },
                  west: { color: "#808080" },
                  up: { color: "#808080" },
                  down: { color: "#808080" },
                },
              },
            ],
          },
        ],
      };

      const errors = ModelDesignUtilities.validateDesign(badDesign);
      expect(errors.some((e) => e.includes("not in palette"))).to.be.true;
    });

    it("should resolve pixel art from face content", () => {
      const faceContent: IMcpFaceContent = {
        background: { type: "solid", colors: ["#808080"] },
        pixelArt: [
          {
            x: 2,
            y: 2,
            lines: ["...", ".X.", "..."],
            palette: {
              X: { r: 255, g: 0, b: 0 },
              ".": { hex: "#00FF00" },
            },
          },
        ],
      };

      const resolved = ModelDesignUtilities.resolveFaceContent(faceContent, undefined, []);

      expect(resolved).to.exist;
      expect(resolved?.pixelArt).to.have.length(1);
      expect(resolved?.pixelArt?.[0].lines).to.deep.equal(["...", ".X.", "..."]);
    });

    it("should merge pixel art from texture and face", () => {
      const faceContent: IMcpFaceContent = {
        textureId: "base",
        pixelArt: [
          {
            x: 10,
            y: 10,
            lines: ["F"],
            palette: { F: { hex: "#FF00FF" } },
          },
        ],
      };

      const textures: { [key: string]: { pixelArt?: IMcpPixelArt[] } } = {
        base: {
          pixelArt: [
            {
              x: 5,
              y: 5,
              lines: ["T"],
              palette: { T: { hex: "#00FFFF" } },
            },
          ],
        },
      };

      const resolved = ModelDesignUtilities.resolveFaceContent(faceContent, textures as any, []);

      // Should have both pixel art layers: texture first, face on top
      expect(resolved).to.exist;
      expect(resolved?.pixelArt).to.have.length(2);
      expect(resolved?.pixelArt?.[0].x).to.equal(5); // Texture's pixel art first
      expect(resolved?.pixelArt?.[1].x).to.equal(10); // Face's pixel art second (on top)
    });

    it("should include pixel art in content hash for deduplication", () => {
      const face1: IMcpFaceContent = {
        background: { type: "solid", colors: ["#808080"] },
        pixelArt: [{ lines: ["X"], palette: { X: { r: 255, g: 0, b: 0 } } }],
      };

      const face2: IMcpFaceContent = {
        background: { type: "solid", colors: ["#808080"] },
        pixelArt: [{ lines: ["O"], palette: { O: { r: 0, g: 0, b: 255 } } }],
      };

      const face3: IMcpFaceContent = {
        background: { type: "solid", colors: ["#808080"] },
        // No pixel art
      };

      const hash1 = ModelDesignUtilities.getContentHash(face1);
      const hash2 = ModelDesignUtilities.getContentHash(face2);
      const hash3 = ModelDesignUtilities.getContentHash(face3);

      // All three should have different hashes
      expect(hash1).to.not.equal(hash2);
      expect(hash1).to.not.equal(hash3);
      expect(hash2).to.not.equal(hash3);
    });

    it("should parse hex colors in pixel art", () => {
      const color: IMcpPixelColor = { hex: "#FF8800" };
      const parsed = TexturedRectangleGenerator.parsePixelColor(color);

      expect(parsed.r).to.equal(255);
      expect(parsed.g).to.equal(136);
      expect(parsed.b).to.equal(0);
      expect(parsed.a).to.equal(255);
    });

    it("should parse RGBA colors in pixel art", () => {
      const color: IMcpPixelColor = { r: 100, g: 150, b: 200, a: 128 };
      const parsed = TexturedRectangleGenerator.parsePixelColor(color);

      expect(parsed.r).to.equal(100);
      expect(parsed.g).to.equal(150);
      expect(parsed.b).to.equal(200);
      expect(parsed.a).to.equal(128);
    });

    it("should apply pixel art to pixel buffer", () => {
      const width = 8;
      const height = 8;
      const pixels = new Uint8Array(width * height * 4);

      // Fill with gray background
      for (let i = 0; i < pixels.length; i += 4) {
        pixels[i] = 128; // R
        pixels[i + 1] = 128; // G
        pixels[i + 2] = 128; // B
        pixels[i + 3] = 255; // A
      }

      const pixelArt: IMcpPixelArt = {
        scaleMode: "exact", // Use exact mode for 1:1 pixel mapping
        x: 2,
        y: 2,
        lines: ["XX", "XX"],
        palette: {
          X: { r: 255, g: 0, b: 0 },
        },
      };

      TexturedRectangleGenerator.applyPixelArt(pixels, width, height, pixelArt);

      // Check that pixel at (2,2) is now red
      const idx = (2 * width + 2) * 4;
      expect(pixels[idx]).to.equal(255); // R
      expect(pixels[idx + 1]).to.equal(0); // G
      expect(pixels[idx + 2]).to.equal(0); // B
    });

    it("should handle transparent pixels (space) in pixel art", () => {
      const width = 4;
      const height = 4;
      const pixels = new Uint8Array(width * height * 4);

      // Fill with green background
      for (let i = 0; i < pixels.length; i += 4) {
        pixels[i] = 0; // R
        pixels[i + 1] = 255; // G
        pixels[i + 2] = 0; // B
        pixels[i + 3] = 255; // A
      }

      const pixelArt: IMcpPixelArt = {
        scaleMode: "exact", // Use exact mode for 1:1 pixel mapping
        x: 0,
        y: 0,
        lines: ["X X", " X ", "X X"],
        palette: {
          X: { r: 255, g: 0, b: 0 },
        },
      };

      TexturedRectangleGenerator.applyPixelArt(pixels, width, height, pixelArt);

      // Check (0,0) is red (X)
      expect(pixels[0]).to.equal(255);
      expect(pixels[1]).to.equal(0);

      // Check (1,0) is still green (space = transparent)
      const idx = 1 * 4;
      expect(pixels[idx]).to.equal(0); // R (green)
      expect(pixels[idx + 1]).to.equal(255); // G (green)
    });

    it("should convert pixel art design to geometry", () => {
      const result = ModelDesignUtilities.convertToGeometry(McpTestFixtures.CUBE_WITH_PIXEL_ART);

      expect(result.warnings).to.have.lengthOf(0);
      expect(result.atlasRegions.length).to.be.greaterThan(0);

      // Find the north face region which has pixel art
      const northRegion = result.atlasRegions.find((r) => r.content.pixelArt && r.content.pixelArt.length > 0);
      expect(northRegion).to.exist;
      expect(northRegion?.content.pixelArt?.[0].lines).to.include("X   X");
    });
  });
});

/**
 * Baseline comparison tests for MCP model design exports.
 * These tests export .geo.json and texture PNG files to test/results
 * and compare against baselines in test/scenarios.
 *
 * Note: 3D preview rendering tests are available in the MCP client tests
 * or via CLI integration tests (e.g., rendermodel command).
 */
describe("MCP Model Design Export Baselines", function () {
  // Increase timeout for image generation
  this.timeout(60000);

  const SCENARIO_NAME = "mcpModelDesign";

  before(async function () {
    await testFolders.initialize();
    testFolders.removeResultFolder(SCENARIO_NAME);
    testFolders.ensureResultFolder(SCENARIO_NAME);
  });

  after(async function () {
    // Clean up cached browser to avoid hanging
    await ImageGenerationUtilities.closeCachedBrowser();
  });

  /**
   * Helper to export a model design to files and return the paths.
   */
  async function exportDesign(
    design: IMcpModelDesign,
    baseName: string
  ): Promise<{ geometryPath: string; texturePath: string }> {
    const resultsPath = testFolders.getResultsPath(SCENARIO_NAME);

    // Convert the design to geometry
    const conversionResult = ModelDesignUtilities.convertToGeometry(design);
    const geometryJson = JSON.stringify(conversionResult.geometry, null, 2);

    // Generate the SVG for debugging - save it before rendering
    const atlasSvg = ModelDesignUtilities.generateAtlasSvg(conversionResult.atlasRegions, conversionResult.textureSize);
    const svgPath = path.join(resultsPath, `${baseName}.debug.svg`);
    fs.writeFileSync(svgPath, atlasSvg, "utf-8");

    // Generate the texture
    const textureDataUrl = await ImageGenerationUtilities.generateTextureFromAtlas(
      conversionResult.atlasRegions,
      conversionResult.textureSize,
      conversionResult.pixelsPerUnit
    );

    // Write geometry file
    const geometryPath = path.join(resultsPath, `${baseName}.geo.json`);
    fs.writeFileSync(geometryPath, geometryJson, "utf-8");

    // Write texture file
    const texturePath = path.join(resultsPath, `${baseName}.texture.png`);
    if (textureDataUrl) {
      const base64Match = textureDataUrl.match(/^data:image\/png;base64,(.*)$/);
      if (base64Match) {
        const binaryData = Buffer.from(base64Match[1], "base64");
        fs.writeFileSync(texturePath, binaryData);
      }
    }

    return { geometryPath, texturePath };
  }

  describe("Simple Colored Cube", function () {
    let geometryPath: string;
    let texturePath: string;

    before(async function () {
      const paths = await exportDesign(McpTestFixtures.SIMPLE_COLORED_CUBE, "simple_colored_cube");
      geometryPath = paths.geometryPath;
      texturePath = paths.texturePath;
    });

    it("should generate valid geometry JSON", function () {
      assert(fs.existsSync(geometryPath), "Geometry file should exist");
      const content = fs.readFileSync(geometryPath, "utf-8");
      const json = JSON.parse(content);
      expect(json["minecraft:geometry"]).to.be.an("array");
      expect(json["minecraft:geometry"][0].description.identifier).to.equal("geometry.test_simple_cube");
    });

    it("should generate valid texture PNG", function () {
      assertValidPng(texturePath, 100);
    });

    it("should match geometry baseline", function () {
      const scenarioPath = path.join(testFolders.getScenariosPath(SCENARIO_NAME), "simple_colored_cube.geo.json");
      assertJsonMatchesBaseline(this, geometryPath, scenarioPath);
    });

    it("should match texture baseline", function () {
      const scenarioPath = path.join(testFolders.getScenariosPath(SCENARIO_NAME), "simple_colored_cube.texture.png");
      assertPngMatchesBaseline(this, texturePath, scenarioPath);
    });
  });

  describe("Cube with Texture References", function () {
    let geometryPath: string;
    let texturePath: string;

    before(async function () {
      const paths = await exportDesign(McpTestFixtures.CUBE_WITH_TEXTURE_REFS, "cube_texture_refs");
      geometryPath = paths.geometryPath;
      texturePath = paths.texturePath;
    });

    it("should generate valid geometry JSON", function () {
      assert(fs.existsSync(geometryPath), "Geometry file should exist");
      const content = fs.readFileSync(geometryPath, "utf-8");
      const json = JSON.parse(content);
      expect(json["minecraft:geometry"]).to.be.an("array");
    });

    it("should generate valid texture PNG", function () {
      assertValidPng(texturePath, 100);
    });

    it("should match geometry baseline", function () {
      const scenarioPath = path.join(testFolders.getScenariosPath(SCENARIO_NAME), "cube_texture_refs.geo.json");
      assertJsonMatchesBaseline(this, geometryPath, scenarioPath);
    });

    it("should match texture baseline", function () {
      const scenarioPath = path.join(testFolders.getScenariosPath(SCENARIO_NAME), "cube_texture_refs.texture.png");
      assertPngMatchesBaseline(this, texturePath, scenarioPath);
    });
  });

  describe("Cube with Deduplication", function () {
    let geometryPath: string;
    let texturePath: string;

    before(async function () {
      const paths = await exportDesign(McpTestFixtures.CUBE_WITH_DEDUPLICATION, "cube_deduplication");
      geometryPath = paths.geometryPath;
      texturePath = paths.texturePath;
    });

    it("should generate valid geometry JSON", function () {
      assert(fs.existsSync(geometryPath), "Geometry file should exist");
    });

    it("should generate valid texture PNG", function () {
      assertValidPng(texturePath, 100);
    });

    it("should match geometry baseline", function () {
      const scenarioPath = path.join(testFolders.getScenariosPath(SCENARIO_NAME), "cube_deduplication.geo.json");
      assertJsonMatchesBaseline(this, geometryPath, scenarioPath);
    });

    it("should match texture baseline", function () {
      const scenarioPath = path.join(testFolders.getScenariosPath(SCENARIO_NAME), "cube_deduplication.texture.png");
      assertPngMatchesBaseline(this, texturePath, scenarioPath);
    });
  });

  describe("Multi-Bone with Shared Textures", function () {
    let geometryPath: string;
    let texturePath: string;

    before(async function () {
      const paths = await exportDesign(McpTestFixtures.MULTI_BONE_WITH_SHARED_TEXTURES, "multi_bone_shared");
      geometryPath = paths.geometryPath;
      texturePath = paths.texturePath;
    });

    it("should generate valid geometry JSON with multiple bones", function () {
      assert(fs.existsSync(geometryPath), "Geometry file should exist");
      const content = fs.readFileSync(geometryPath, "utf-8");
      const json = JSON.parse(content);
      expect(json["minecraft:geometry"][0].bones).to.be.an("array");
      expect(json["minecraft:geometry"][0].bones.length).to.be.greaterThan(1);
    });

    it("should generate valid texture PNG", function () {
      assertValidPng(texturePath, 100);
    });

    it("should match geometry baseline", function () {
      const scenarioPath = path.join(testFolders.getScenariosPath(SCENARIO_NAME), "multi_bone_shared.geo.json");
      assertJsonMatchesBaseline(this, geometryPath, scenarioPath);
    });

    it("should match texture baseline", function () {
      const scenarioPath = path.join(testFolders.getScenariosPath(SCENARIO_NAME), "multi_bone_shared.texture.png");
      assertPngMatchesBaseline(this, texturePath, scenarioPath);
    });
  });

  describe("Cube with SVG Texture", function () {
    let geometryPath: string;
    let texturePath: string;

    before(async function () {
      const paths = await exportDesign(McpTestFixtures.CUBE_WITH_SVG_TEXTURE, "cube_svg_texture");
      geometryPath = paths.geometryPath;
      texturePath = paths.texturePath;
    });

    it("should generate valid geometry JSON", function () {
      assert(fs.existsSync(geometryPath), "Geometry file should exist");
    });

    it("should generate valid texture PNG", function () {
      assertValidPng(texturePath, 100);
    });

    it("should match geometry baseline", function () {
      const scenarioPath = path.join(testFolders.getScenariosPath(SCENARIO_NAME), "cube_svg_texture.geo.json");
      assertJsonMatchesBaseline(this, geometryPath, scenarioPath);
    });

    it("should match texture baseline", function () {
      const scenarioPath = path.join(testFolders.getScenariosPath(SCENARIO_NAME), "cube_svg_texture.texture.png");
      assertPngMatchesBaseline(this, texturePath, scenarioPath);
    });
  });

  describe("Cube with Noise Texture", function () {
    let geometryPath: string;
    let texturePath: string;

    before(async function () {
      const paths = await exportDesign(McpTestFixtures.CUBE_WITH_NOISE_RANDOM, "cube_noise_random");
      geometryPath = paths.geometryPath;
      texturePath = paths.texturePath;
    });

    it("should generate valid geometry JSON", function () {
      assert(fs.existsSync(geometryPath), "Geometry file should exist");
    });

    it("should generate valid texture PNG with noise", function () {
      assertValidPng(texturePath, 100);
    });

    it("should match geometry baseline", function () {
      const scenarioPath = path.join(testFolders.getScenariosPath(SCENARIO_NAME), "cube_noise_random.geo.json");
      assertJsonMatchesBaseline(this, geometryPath, scenarioPath);
    });

    it("should match texture baseline", function () {
      const scenarioPath = path.join(testFolders.getScenariosPath(SCENARIO_NAME), "cube_noise_random.texture.png");
      assertPngMatchesBaseline(this, texturePath, scenarioPath);
    });
  });

  describe("Cube with Dither Noise Texture", function () {
    let geometryPath: string;
    let texturePath: string;

    before(async function () {
      const paths = await exportDesign(McpTestFixtures.CUBE_WITH_NOISE_DITHER, "cube_noise_dither");
      geometryPath = paths.geometryPath;
      texturePath = paths.texturePath;
    });

    it("should generate valid geometry JSON", function () {
      assert(fs.existsSync(geometryPath), "Geometry file should exist");
    });

    it("should generate valid texture PNG with dither noise", function () {
      assertValidPng(texturePath, 100);
    });

    it("should match geometry baseline", function () {
      const scenarioPath = path.join(testFolders.getScenariosPath(SCENARIO_NAME), "cube_noise_dither.geo.json");
      assertJsonMatchesBaseline(this, geometryPath, scenarioPath);
    });

    it("should match texture baseline", function () {
      const scenarioPath = path.join(testFolders.getScenariosPath(SCENARIO_NAME), "cube_noise_dither.texture.png");
      assertPngMatchesBaseline(this, texturePath, scenarioPath);
    });
  });

  describe("Cube with Perlin Noise Texture", function () {
    let geometryPath: string;
    let texturePath: string;

    before(async function () {
      const paths = await exportDesign(McpTestFixtures.CUBE_WITH_NOISE_PERLIN, "cube_noise_perlin");
      geometryPath = paths.geometryPath;
      texturePath = paths.texturePath;
    });

    it("should generate valid geometry JSON", function () {
      assert(fs.existsSync(geometryPath), "Geometry file should exist");
    });

    it("should generate valid texture PNG with perlin noise", function () {
      assertValidPng(texturePath, 100);
    });

    it("should match geometry baseline", function () {
      const scenarioPath = path.join(testFolders.getScenariosPath(SCENARIO_NAME), "cube_noise_perlin.geo.json");
      assertJsonMatchesBaseline(this, geometryPath, scenarioPath);
    });

    it("should match texture baseline", function () {
      const scenarioPath = path.join(testFolders.getScenariosPath(SCENARIO_NAME), "cube_noise_perlin.texture.png");
      assertPngMatchesBaseline(this, texturePath, scenarioPath);
    });
  });

  describe("Cube with Stipple Noise Texture", function () {
    let geometryPath: string;
    let texturePath: string;

    before(async function () {
      const paths = await exportDesign(McpTestFixtures.CUBE_WITH_NOISE_STIPPLE, "cube_noise_stipple");
      geometryPath = paths.geometryPath;
      texturePath = paths.texturePath;
    });

    it("should generate valid geometry JSON", function () {
      assert(fs.existsSync(geometryPath), "Geometry file should exist");
    });

    it("should generate valid texture PNG with stipple noise", function () {
      assertValidPng(texturePath, 100);
    });

    it("should match geometry baseline", function () {
      const scenarioPath = path.join(testFolders.getScenariosPath(SCENARIO_NAME), "cube_noise_stipple.geo.json");
      assertJsonMatchesBaseline(this, geometryPath, scenarioPath);
    });

    it("should match texture baseline", function () {
      const scenarioPath = path.join(testFolders.getScenariosPath(SCENARIO_NAME), "cube_noise_stipple.texture.png");
      assertPngMatchesBaseline(this, texturePath, scenarioPath);
    });
  });

  describe("Cube with Gradient Noise Texture", function () {
    let geometryPath: string;
    let texturePath: string;

    before(async function () {
      const paths = await exportDesign(McpTestFixtures.CUBE_WITH_NOISE_GRADIENT, "cube_noise_gradient");
      geometryPath = paths.geometryPath;
      texturePath = paths.texturePath;
    });

    it("should generate valid geometry JSON", function () {
      assert(fs.existsSync(geometryPath), "Geometry file should exist");
    });

    it("should generate valid texture PNG with gradient noise", function () {
      assertValidPng(texturePath, 100);
    });

    it("should match geometry baseline", function () {
      const scenarioPath = path.join(testFolders.getScenariosPath(SCENARIO_NAME), "cube_noise_gradient.geo.json");
      assertJsonMatchesBaseline(this, geometryPath, scenarioPath);
    });

    it("should match texture baseline", function () {
      const scenarioPath = path.join(testFolders.getScenariosPath(SCENARIO_NAME), "cube_noise_gradient.texture.png");
      assertPngMatchesBaseline(this, texturePath, scenarioPath);
    });
  });

  describe("Cube with Lava Noise Texture", function () {
    let geometryPath: string;
    let texturePath: string;

    before(async function () {
      const paths = await exportDesign(McpTestFixtures.CUBE_WITH_NOISE_LAVA, "cube_noise_lava");
      geometryPath = paths.geometryPath;
      texturePath = paths.texturePath;
    });

    it("should generate valid geometry JSON", function () {
      assert(fs.existsSync(geometryPath), "Geometry file should exist");
    });

    it("should generate valid texture PNG with lava noise", function () {
      assertValidPng(texturePath, 100);
    });

    it("should match geometry baseline", function () {
      const scenarioPath = path.join(testFolders.getScenariosPath(SCENARIO_NAME), "cube_noise_lava.geo.json");
      assertJsonMatchesBaseline(this, geometryPath, scenarioPath);
    });

    it("should match texture baseline", function () {
      const scenarioPath = path.join(testFolders.getScenariosPath(SCENARIO_NAME), "cube_noise_lava.texture.png");
      assertPngMatchesBaseline(this, texturePath, scenarioPath);
    });
  });

  describe("Elephant Model - Complex Multi-Bone with Auto-Sizing", function () {
    let geometryPath: string;
    let texturePath: string;
    let conversionResult: any;

    before(async function () {
      // Test that the conversion auto-expands texture size
      conversionResult = ModelDesignUtilities.convertToGeometry(McpTestFixtures.ELEPHANT_MODEL);
      const paths = await exportDesign(McpTestFixtures.ELEPHANT_MODEL, "elephant_model");
      geometryPath = paths.geometryPath;
      texturePath = paths.texturePath;
    });

    it("should generate valid geometry JSON with all 17 bones", function () {
      assert(fs.existsSync(geometryPath), "Geometry file should exist");
      const content = fs.readFileSync(geometryPath, "utf-8");
      const json = JSON.parse(content);
      expect(json["minecraft:geometry"][0].bones).to.be.an("array");
      // Elephant has 17 bones: body, head, trunk parts, ears, tusks, eyes, legs, tail
      expect(json["minecraft:geometry"][0].bones.length).to.equal(17);
    });

    it("should generate valid texture PNG with all faces rendered", function () {
      // Elephant with many bones should have a larger texture
      // At 64x64 it may overflow, but auto-sizing should expand it
      assertValidPng(texturePath, 100);
    });

    it("should auto-expand texture atlas if needed", function () {
      // Check that there are no overflow warnings
      // If there are warnings about texture size, the auto-expansion failed
      const overflowWarnings = conversionResult.warnings.filter((w: string) => w.toLowerCase().includes("overflow"));
      expect(overflowWarnings).to.be.an("array").that.is.empty;
    });

    it("should have atlas regions for all cube faces", function () {
      // Count total faces: 17 bones, each with 1 cube and 6 faces = 102 faces
      // But many share textures via textureId references, so fewer unique regions
      const atlasRegions = conversionResult.atlasRegions;
      expect(atlasRegions).to.be.an("array");
      expect(atlasRegions.length).to.be.greaterThan(50); // At least half should be allocated
    });

    it("should match geometry baseline", function () {
      const scenarioPath = path.join(testFolders.getScenariosPath(SCENARIO_NAME), "elephant_model.geo.json");
      assertJsonMatchesBaseline(this, geometryPath, scenarioPath);
    });

    it("should match texture baseline", function () {
      const scenarioPath = path.join(testFolders.getScenariosPath(SCENARIO_NAME), "elephant_model.texture.png");
      assertPngMatchesBaseline(this, texturePath, scenarioPath);
    });
  });

  describe("Elephant Model with SVG Textures (Legacy Pattern)", function () {
    let geometryPath: string;
    let texturePath: string;
    let conversionResult: any;

    before(async function () {
      // Test that hand-crafted SVG textures work correctly (legacy pattern)
      conversionResult = ModelDesignUtilities.convertToGeometry(McpTestFixtures.ELEPHANT_WITH_SVG_TEXTURES);
      const paths = await exportDesign(McpTestFixtures.ELEPHANT_WITH_SVG_TEXTURES, "elephant_svg");
      geometryPath = paths.geometryPath;
      texturePath = paths.texturePath;
    });

    it("should generate valid geometry JSON with all 8 bones", function () {
      assert(fs.existsSync(geometryPath), "Geometry file should exist");
      const content = fs.readFileSync(geometryPath, "utf-8");
      const json = JSON.parse(content);
      expect(json["minecraft:geometry"][0].bones).to.be.an("array");
      expect(json["minecraft:geometry"][0].bones.length).to.equal(8);
    });

    it("should generate valid texture PNG with SVG content rendered", function () {
      assertValidPng(texturePath, 100);
    });

    it("should not have texture overflow issues with SVG textures", function () {
      const overflowWarnings = conversionResult.warnings.filter((w: string) => w.toLowerCase().includes("overflow"));
      expect(overflowWarnings).to.be.an("array").that.is.empty;
    });

    it("should match geometry baseline", function () {
      const scenarioPath = path.join(testFolders.getScenariosPath(SCENARIO_NAME), "elephant_svg.geo.json");
      assertJsonMatchesBaseline(this, geometryPath, scenarioPath);
    });

    it("should match texture baseline", function () {
      const scenarioPath = path.join(testFolders.getScenariosPath(SCENARIO_NAME), "elephant_svg.texture.png");
      assertPngMatchesBaseline(this, texturePath, scenarioPath);
    });

    it("should have full UV coverage (no empty texture regions)", function () {
      const coverageResult = UvCoverageValidator.validate(geometryPath, texturePath, 5);

      if (!coverageResult.isValid) {
        UvCoverageValidator.printReport(coverageResult);
      }

      expect(coverageResult.warnings).to.be.an("array").that.is.empty;
      expect(
        coverageResult.uncoveredFaces,
        `${coverageResult.uncoveredFaces.length} faces have insufficient texture coverage`
      ).to.be.an("array").that.is.empty;
      expect(coverageResult.isValid).to.be.true;
    });
  });

  describe("Cube with Pixel Art", function () {
    let geometryPath: string;
    let texturePath: string;
    let conversionResult: any;

    before(async function () {
      conversionResult = ModelDesignUtilities.convertToGeometry(McpTestFixtures.CUBE_WITH_PIXEL_ART);
      const paths = await exportDesign(McpTestFixtures.CUBE_WITH_PIXEL_ART, "cube_pixel_art");
      geometryPath = paths.geometryPath;
      texturePath = paths.texturePath;
    });

    it("should generate valid geometry JSON", function () {
      assert(fs.existsSync(geometryPath), "Geometry file should exist");
    });

    it("should generate valid texture PNG with pixel art rendered", function () {
      assertValidPng(texturePath, 100);
    });

    it("should have no warnings", function () {
      expect(conversionResult.warnings).to.be.an("array").that.is.empty;
    });

    it("should include pixel art in atlas regions", function () {
      const regionsWithPixelArt = conversionResult.atlasRegions.filter(
        (r: any) => r.content.pixelArt && r.content.pixelArt.length > 0
      );
      expect(regionsWithPixelArt.length).to.be.greaterThan(0);
    });

    it("should match geometry baseline", function () {
      const scenarioPath = path.join(testFolders.getScenariosPath(SCENARIO_NAME), "cube_pixel_art.geo.json");
      assertJsonMatchesBaseline(this, geometryPath, scenarioPath);
    });

    it("should match texture baseline", function () {
      const scenarioPath = path.join(testFolders.getScenariosPath(SCENARIO_NAME), "cube_pixel_art.texture.png");
      assertPngMatchesBaseline(this, texturePath, scenarioPath);
    });
  });

  describe("Cube with Pixel Art Hex Colors", function () {
    let geometryPath: string;
    let texturePath: string;
    let conversionResult: any;

    before(async function () {
      conversionResult = ModelDesignUtilities.convertToGeometry(McpTestFixtures.CUBE_WITH_PIXEL_ART_HEX);
      const paths = await exportDesign(McpTestFixtures.CUBE_WITH_PIXEL_ART_HEX, "cube_pixel_art_hex");
      geometryPath = paths.geometryPath;
      texturePath = paths.texturePath;
    });

    it("should generate valid geometry JSON", function () {
      assert(fs.existsSync(geometryPath), "Geometry file should exist");
    });

    it("should generate valid texture PNG with hex color pixel art", function () {
      assertValidPng(texturePath, 100);
    });

    it("should have no warnings", function () {
      expect(conversionResult.warnings).to.be.an("array").that.is.empty;
    });

    it("should support multiple pixel art layers per face", function () {
      // The north face has two pixel art layers
      const northRegion = conversionResult.atlasRegions.find(
        (r: any) => r.content.pixelArt && r.content.pixelArt.length >= 2
      );
      expect(northRegion).to.exist;
      expect(northRegion.content.pixelArt.length).to.equal(2);
    });

    it("should match geometry baseline", function () {
      const scenarioPath = path.join(testFolders.getScenariosPath(SCENARIO_NAME), "cube_pixel_art_hex.geo.json");
      assertJsonMatchesBaseline(this, geometryPath, scenarioPath);
    });

    it("should match texture baseline", function () {
      const scenarioPath = path.join(testFolders.getScenariosPath(SCENARIO_NAME), "cube_pixel_art_hex.texture.png");
      assertPngMatchesBaseline(this, texturePath, scenarioPath);
    });
  });

  describe("Stone Brick Block (Debug MCP Multi-Angle)", function () {
    let geometryPath: string;
    let texturePath: string;

    before(async function () {
      const paths = await exportDesign(McpTestFixtures.STONE_BRICK_BLOCK, "stone_brick_block");
      geometryPath = paths.geometryPath;
      texturePath = paths.texturePath;
    });

    it("should generate valid geometry JSON", function () {
      assert(fs.existsSync(geometryPath), "Geometry file should exist");
      const content = fs.readFileSync(geometryPath, "utf-8");
      const json = JSON.parse(content);
      expect(json["minecraft:geometry"]).to.be.an("array");
      expect(json["minecraft:geometry"][0].description.identifier).to.equal("geometry.test_stone_brick");
    });

    it("should generate valid texture PNG with stipple noise", function () {
      assertValidPng(texturePath, 100);
    });

    it("should match geometry baseline", function () {
      const scenarioPath = path.join(testFolders.getScenariosPath(SCENARIO_NAME), "stone_brick_block.geo.json");
      assertJsonMatchesBaseline(this, geometryPath, scenarioPath);
    });

    it("should match texture baseline", function () {
      const scenarioPath = path.join(testFolders.getScenariosPath(SCENARIO_NAME), "stone_brick_block.texture.png");
      assertPngMatchesBaseline(this, texturePath, scenarioPath);
    });
  });

  describe("Glowing Ore Block (Debug MCP PixelArt)", function () {
    let geometryPath: string;
    let texturePath: string;

    before(async function () {
      const paths = await exportDesign(McpTestFixtures.GLOWING_ORE_BLOCK, "glowing_ore_block");
      geometryPath = paths.geometryPath;
      texturePath = paths.texturePath;
    });

    it("should generate valid geometry JSON", function () {
      assert(fs.existsSync(geometryPath), "Geometry file should exist");
      const content = fs.readFileSync(geometryPath, "utf-8");
      const json = JSON.parse(content);
      expect(json["minecraft:geometry"]).to.be.an("array");
      expect(json["minecraft:geometry"][0].description.identifier).to.equal("geometry.test_glowing_ore");
    });

    it("should generate valid texture PNG with pixelart ore veins", function () {
      assertValidPng(texturePath, 100);
    });

    it("should match geometry baseline", function () {
      const scenarioPath = path.join(testFolders.getScenariosPath(SCENARIO_NAME), "glowing_ore_block.geo.json");
      assertJsonMatchesBaseline(this, geometryPath, scenarioPath);
    });

    it("should match texture baseline", function () {
      const scenarioPath = path.join(testFolders.getScenariosPath(SCENARIO_NAME), "glowing_ore_block.texture.png");
      assertPngMatchesBaseline(this, texturePath, scenarioPath);
    });
  });
});

// Export fixtures for use by MCP client tests
export { McpTestFixtures as default };
