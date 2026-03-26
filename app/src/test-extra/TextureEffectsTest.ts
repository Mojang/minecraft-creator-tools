// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Texture Effects Tests
 *
 * These tests validate the texture effects system including:
 * - Lighting effects (inset, outset, pillow, ambient_occlusion)
 * - Border effects (CSS-like syntax with all/top/right/bottom/left)
 * - Overlay effects (cracks, scratches, moss, rust, sparkle, veins)
 * - Color variation effects (hue_shift, saturation_jitter, value_jitter)
 * - Tiling effects (seamless edge blending)
 *
 * NOTE: These tests are in test-extra/ because they:
 * - May take significant time to run (generates and validates images)
 * - Benefit from visual review of outputs
 *
 * To run these tests:
 *   npm run test-extra -- --grep "Texture Effects"
 */

import { expect } from "chai";
import "mocha";
import * as path from "path";
import * as fs from "fs";
import { IMcpModelDesign } from "../minecraft/IMcpModelDesign";
import ModelDesignUtilities from "../minecraft/ModelDesignUtilities";
import ImageGenerationUtilities from "../local/ImageGenerationUtilities";
import { testFolders, assertValidPng, assertPngMatchesBaseline } from "../test/PngTestUtilities";

const SCENARIO_NAME = "textureEffects";

/**
 * Test fixtures for texture effects
 */
class TextureEffectsFixtures {
  /**
   * Base cube model used as foundation for effect tests
   */
  static createBaseCube(identifier: string): IMcpModelDesign {
    return {
      identifier,
      textureSize: [32, 32],
      bones: [
        {
          name: "body",
          cubes: [
            {
              origin: [-8, 0, -8],
              size: [16, 16, 16],
              faces: {
                north: {},
                south: {},
                east: {},
                west: {},
                up: {},
                down: {},
              },
            },
          ],
        },
      ],
    };
  }

  /**
   * Cube with inset lighting effect - creates depth appearance
   */
  static readonly CUBE_WITH_INSET_LIGHTING: IMcpModelDesign = {
    identifier: "test_inset_lighting",
    textureSize: [32, 32],
    textures: {
      stone: {
        background: {
          type: "stipple_noise",
          colors: ["#8B8B8B", "#7A7A7A", "#9A9A9A"],
          seed: 12345,
        },
        effects: {
          lighting: { preset: "inset", intensity: 0.4 },
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
              north: { textureId: "stone" },
              south: { textureId: "stone" },
              east: { textureId: "stone" },
              west: { textureId: "stone" },
              up: { textureId: "stone" },
              down: { textureId: "stone" },
            },
          },
        ],
      },
    ],
  };

  /**
   * Cube with outset lighting effect - creates raised appearance
   */
  static readonly CUBE_WITH_OUTSET_LIGHTING: IMcpModelDesign = {
    identifier: "test_outset_lighting",
    textureSize: [32, 32],
    textures: {
      stone: {
        background: {
          type: "stipple_noise",
          colors: ["#8B8B8B", "#7A7A7A", "#9A9A9A"],
          seed: 12345,
        },
        effects: {
          lighting: { preset: "outset", intensity: 0.4 },
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
              north: { textureId: "stone" },
              south: { textureId: "stone" },
              east: { textureId: "stone" },
              west: { textureId: "stone" },
              up: { textureId: "stone" },
              down: { textureId: "stone" },
            },
          },
        ],
      },
    ],
  };

  /**
   * Cube with pillow lighting effect - soft rounded edges
   */
  static readonly CUBE_WITH_PILLOW_LIGHTING: IMcpModelDesign = {
    identifier: "test_pillow_lighting",
    textureSize: [32, 32],
    textures: {
      fabric: {
        background: {
          type: "dither_noise",
          colors: ["#C04040", "#B03030", "#D05050"],
          seed: 54321,
        },
        effects: {
          lighting: { preset: "pillow", intensity: 0.5 },
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
              north: { textureId: "fabric" },
              south: { textureId: "fabric" },
              east: { textureId: "fabric" },
              west: { textureId: "fabric" },
              up: { textureId: "fabric" },
              down: { textureId: "fabric" },
            },
          },
        ],
      },
    ],
  };

  /**
   * Cube with ambient occlusion effect - darkened corners
   */
  static readonly CUBE_WITH_AMBIENT_OCCLUSION: IMcpModelDesign = {
    identifier: "test_ambient_occlusion",
    textureSize: [32, 32],
    textures: {
      wood: {
        background: {
          type: "stipple_noise",
          colors: ["#8B4513", "#A0522D", "#6B3E10"],
          seed: 11111,
        },
        effects: {
          lighting: { preset: "ambient_occlusion", intensity: 0.6 },
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
  };

  /**
   * Cube with solid border on all sides (CSS shorthand style)
   */
  static readonly CUBE_WITH_BORDER_ALL: IMcpModelDesign = {
    identifier: "test_border_all",
    textureSize: [32, 32],
    textures: {
      bordered_stone: {
        background: {
          type: "stipple_noise",
          colors: ["#808080", "#707070", "#909090"],
          seed: 22222,
        },
        effects: {
          border: {
            all: { style: "solid", width: 2, color: "#404040" },
          },
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
              north: { textureId: "bordered_stone" },
              south: { textureId: "bordered_stone" },
              east: { textureId: "bordered_stone" },
              west: { textureId: "bordered_stone" },
              up: { textureId: "bordered_stone" },
              down: { textureId: "bordered_stone" },
            },
          },
        ],
      },
    ],
  };

  /**
   * Cube with highlight border effect
   */
  static readonly CUBE_WITH_BORDER_HIGHLIGHT: IMcpModelDesign = {
    identifier: "test_border_highlight",
    textureSize: [32, 32],
    textures: {
      metal: {
        background: {
          type: "dither_noise",
          colors: ["#A0A0A0", "#909090", "#B0B0B0"],
          seed: 33333,
        },
        effects: {
          border: {
            all: { style: "highlight", width: 1, color: "#FFFFFF" },
          },
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
              north: { textureId: "metal" },
              south: { textureId: "metal" },
              east: { textureId: "metal" },
              west: { textureId: "metal" },
              up: { textureId: "metal" },
              down: { textureId: "metal" },
            },
          },
        ],
      },
    ],
  };

  /**
   * Cube with worn/weathered border effect
   */
  static readonly CUBE_WITH_BORDER_WORN: IMcpModelDesign = {
    identifier: "test_border_worn",
    textureSize: [32, 32],
    textures: {
      worn_brick: {
        background: {
          type: "stipple_noise",
          colors: ["#8B4513", "#A0522D", "#7A3A10"],
          seed: 44444,
        },
        effects: {
          border: {
            all: { style: "worn", width: 2, color: "#5A3010" },
          },
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
              north: { textureId: "worn_brick" },
              south: { textureId: "worn_brick" },
              east: { textureId: "worn_brick" },
              west: { textureId: "worn_brick" },
              up: { textureId: "worn_brick" },
              down: { textureId: "worn_brick" },
            },
          },
        ],
      },
    ],
  };

  /**
   * Cube with individual side borders (CSS individual sides)
   */
  static readonly CUBE_WITH_BORDER_INDIVIDUAL_SIDES: IMcpModelDesign = {
    identifier: "test_border_individual",
    textureSize: [32, 32],
    textures: {
      panel: {
        background: {
          type: "solid",
          colors: ["#606080"],
        },
        effects: {
          border: {
            top: { style: "highlight", width: 1, color: "#9090B0" },
            right: { style: "solid", width: 1, color: "#404060" },
            bottom: { style: "solid", width: 1, color: "#303050" },
            left: { style: "highlight", width: 1, color: "#8080A0" },
          },
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
              north: { textureId: "panel" },
              south: { textureId: "panel" },
              east: { textureId: "panel" },
              west: { textureId: "panel" },
              up: { textureId: "panel" },
              down: { textureId: "panel" },
            },
          },
        ],
      },
    ],
  };

  /**
   * Cube with cracks overlay
   */
  static readonly CUBE_WITH_CRACKS_OVERLAY: IMcpModelDesign = {
    identifier: "test_cracks_overlay",
    textureSize: [32, 32],
    textures: {
      cracked_stone: {
        background: {
          type: "stipple_noise",
          colors: ["#808080", "#707070", "#909090"],
          seed: 55555,
        },
        effects: {
          overlay: { pattern: "cracks", density: 0.4, color: "#303030", seed: 55555 },
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
              north: { textureId: "cracked_stone" },
              south: { textureId: "cracked_stone" },
              east: { textureId: "cracked_stone" },
              west: { textureId: "cracked_stone" },
              up: { textureId: "cracked_stone" },
              down: { textureId: "cracked_stone" },
            },
          },
        ],
      },
    ],
  };

  /**
   * Cube with moss overlay
   */
  static readonly CUBE_WITH_MOSS_OVERLAY: IMcpModelDesign = {
    identifier: "test_moss_overlay",
    textureSize: [32, 32],
    textures: {
      mossy_stone: {
        background: {
          type: "stipple_noise",
          colors: ["#707070", "#606060", "#808080"],
          seed: 66666,
        },
        effects: {
          overlay: { pattern: "moss", density: 0.5, color: "#2D5A2D", seed: 66666 },
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
              north: { textureId: "mossy_stone" },
              south: { textureId: "mossy_stone" },
              east: { textureId: "mossy_stone" },
              west: { textureId: "mossy_stone" },
              up: { textureId: "mossy_stone" },
              down: { textureId: "mossy_stone" },
            },
          },
        ],
      },
    ],
  };

  /**
   * Cube with rust overlay
   */
  static readonly CUBE_WITH_RUST_OVERLAY: IMcpModelDesign = {
    identifier: "test_rust_overlay",
    textureSize: [32, 32],
    textures: {
      rusty_metal: {
        background: {
          type: "dither_noise",
          colors: ["#808080", "#909090", "#707070"],
          seed: 77777,
        },
        effects: {
          overlay: { pattern: "rust", density: 0.6, color: "#8B4513", seed: 77777 },
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
              north: { textureId: "rusty_metal" },
              south: { textureId: "rusty_metal" },
              east: { textureId: "rusty_metal" },
              west: { textureId: "rusty_metal" },
              up: { textureId: "rusty_metal" },
              down: { textureId: "rusty_metal" },
            },
          },
        ],
      },
    ],
  };

  /**
   * Cube with sparkle overlay (for gems/crystals)
   */
  static readonly CUBE_WITH_SPARKLE_OVERLAY: IMcpModelDesign = {
    identifier: "test_sparkle_overlay",
    textureSize: [32, 32],
    textures: {
      gem: {
        background: {
          type: "perlin_noise",
          colors: ["#4040A0", "#5050C0", "#3030E0"],
          seed: 88888,
        },
        effects: {
          overlay: { pattern: "sparkle", density: 0.3, color: "#FFFFFF", seed: 88888 },
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
              north: { textureId: "gem" },
              south: { textureId: "gem" },
              east: { textureId: "gem" },
              west: { textureId: "gem" },
              up: { textureId: "gem" },
              down: { textureId: "gem" },
            },
          },
        ],
      },
    ],
  };

  /**
   * Cube with veins overlay (for ore blocks)
   */
  static readonly CUBE_WITH_VEINS_OVERLAY: IMcpModelDesign = {
    identifier: "test_veins_overlay",
    textureSize: [32, 32],
    textures: {
      ore: {
        background: {
          type: "stipple_noise",
          colors: ["#606060", "#505050", "#707070"],
          seed: 99999,
        },
        effects: {
          overlay: { pattern: "veins", density: 0.4, color: "#FFD700", seed: 99999 },
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
              north: { textureId: "ore" },
              south: { textureId: "ore" },
              east: { textureId: "ore" },
              west: { textureId: "ore" },
              up: { textureId: "ore" },
              down: { textureId: "ore" },
            },
          },
        ],
      },
    ],
  };

  /**
   * Cube with hue shift color variation
   */
  static readonly CUBE_WITH_HUE_SHIFT: IMcpModelDesign = {
    identifier: "test_hue_shift",
    textureSize: [32, 32],
    textures: {
      varied_grass: {
        background: {
          type: "perlin_noise",
          colors: ["#228B22", "#32CD32", "#006400"],
          seed: 11111,
        },
        effects: {
          colorVariation: { mode: "hue_shift", amount: 0.15, seed: 11111 },
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
              north: { textureId: "varied_grass" },
              south: { textureId: "varied_grass" },
              east: { textureId: "varied_grass" },
              west: { textureId: "varied_grass" },
              up: { textureId: "varied_grass" },
              down: { textureId: "varied_grass" },
            },
          },
        ],
      },
    ],
  };

  /**
   * Cube with value jitter color variation
   */
  static readonly CUBE_WITH_VALUE_JITTER: IMcpModelDesign = {
    identifier: "test_value_jitter",
    textureSize: [32, 32],
    textures: {
      varied_stone: {
        background: {
          type: "stipple_noise",
          colors: ["#808080", "#707070", "#909090"],
          seed: 22222,
        },
        effects: {
          colorVariation: { mode: "value_jitter", amount: 0.2, seed: 22222 },
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
              north: { textureId: "varied_stone" },
              south: { textureId: "varied_stone" },
              east: { textureId: "varied_stone" },
              west: { textureId: "varied_stone" },
              up: { textureId: "varied_stone" },
              down: { textureId: "varied_stone" },
            },
          },
        ],
      },
    ],
  };

  /**
   * Cube with seamless tiling effect
   */
  static readonly CUBE_WITH_SEAMLESS_TILING: IMcpModelDesign = {
    identifier: "test_seamless_tiling",
    textureSize: [32, 32],
    textures: {
      seamless: {
        background: {
          type: "random_noise",
          colors: ["#A0A0A0", "#909090", "#B0B0B0"],
          seed: 33333,
        },
        effects: {
          tiling: { seamless: true },
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
              north: { textureId: "seamless" },
              south: { textureId: "seamless" },
              east: { textureId: "seamless" },
              west: { textureId: "seamless" },
              up: { textureId: "seamless" },
              down: { textureId: "seamless" },
            },
          },
        ],
      },
    ],
  };

  /**
   * Cube with combined effects (lighting + border + overlay)
   */
  static readonly CUBE_WITH_COMBINED_EFFECTS: IMcpModelDesign = {
    identifier: "test_combined_effects",
    textureSize: [32, 32],
    textures: {
      rich_stone: {
        background: {
          type: "stipple_noise",
          colors: ["#707070", "#606060", "#808080"],
          seed: 44444,
        },
        effects: {
          lighting: { preset: "inset", intensity: 0.3 },
          border: { all: { style: "worn", width: 1, color: "#404040" } },
          overlay: { pattern: "cracks", density: 0.2, color: "#303030", seed: 44444 },
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
              north: { textureId: "rich_stone" },
              south: { textureId: "rich_stone" },
              east: { textureId: "rich_stone" },
              west: { textureId: "rich_stone" },
              up: { textureId: "rich_stone" },
              down: { textureId: "rich_stone" },
            },
          },
        ],
      },
    ],
  };

  /**
   * Elephant model with inset effects on pink ears for depth
   * Based on McpTestFixtures.ELEPHANT_MODEL but with effects on ears
   */
  static readonly ELEPHANT_WITH_EAR_EFFECTS: IMcpModelDesign = {
    identifier: "geometry.elephant_with_effects",
    textureSize: [64, 64],
    textures: {
      elephant_skin: {
        background: {
          type: "stipple_noise",
          colors: ["#8B8B8B", "#7A7A7A", "#9A9A9A", "#6E6E6E"],
          seed: 12345,
        },
      },
      elephant_skin_dark: {
        background: {
          type: "stipple_noise",
          colors: ["#6B6B6B", "#5A5A5A", "#7A7A7A", "#505050"],
          seed: 12346,
        },
      },
      elephant_skin_light: {
        background: {
          type: "stipple_noise",
          colors: ["#A0A0A0", "#909090", "#B0B0B0", "#858585"],
          seed: 12347,
        },
      },
      // Pink ear inner with inset lighting for depth!
      pink_ear_inner: {
        background: {
          type: "stipple_noise",
          colors: ["#D4A0A0", "#C89090", "#E0B0B0", "#C08080"],
          seed: 12348,
        },
        effects: {
          lighting: { preset: "inset", intensity: 0.4 },
          border: {
            all: { style: "solid", width: 1, color: "#A07070" },
          },
        },
      },
      tusk_texture: {
        background: {
          type: "stipple_noise",
          colors: ["#F5F5DC", "#E8E8C8", "#FFFFD8"],
          seed: 12349,
        },
        effects: {
          lighting: { preset: "outset", intensity: 0.3 },
        },
      },
      eye_black: { color: "#1A1A1A" },
    },
    bones: [
      // Body
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
      // Head
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
      // Left ear with pink inner and effects
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
              south: { textureId: "pink_ear_inner" }, // Pink with effects!
              east: { textureId: "elephant_skin" },
              west: { textureId: "elephant_skin" },
              up: { textureId: "elephant_skin" },
              down: { textureId: "elephant_skin" },
            },
          },
        ],
      },
      // Right ear with pink inner and effects
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
              south: { textureId: "pink_ear_inner" }, // Pink with effects!
              east: { textureId: "elephant_skin" },
              west: { textureId: "elephant_skin" },
              up: { textureId: "elephant_skin" },
              down: { textureId: "elephant_skin" },
            },
          },
        ],
      },
      // Left tusk with outset effect for shine
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
      // Right tusk with outset effect for shine
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
    ],
  };
}

/**
 * Helper to generate a texture from a model design and save it
 */
async function generateAndSaveTexture(
  design: IMcpModelDesign,
  outputPath: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const result = ModelDesignUtilities.convertToGeometry(design);
    if (!result.atlasRegions || result.atlasRegions.length === 0) {
      return { success: false, error: "No atlas regions generated" };
    }

    const textureSize: [number, number] = design.textureSize
      ? [design.textureSize[0], design.textureSize[1]]
      : [64, 64];
    const pngDataUrl = await ImageGenerationUtilities.generateTextureFromAtlas(result.atlasRegions, textureSize);

    if (!pngDataUrl) {
      return { success: false, error: "Failed to generate texture" };
    }

    // Convert data URL to buffer and save
    const base64Data = pngDataUrl.replace(/^data:image\/png;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");
    fs.writeFileSync(outputPath, buffer);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message || String(e) };
  }
}

describe("Texture Effects Tests", function () {
  this.timeout(60000);

  before(async function () {
    await testFolders.initialize();
    testFolders.removeResultFolder(SCENARIO_NAME);
    testFolders.ensureResultFolder(SCENARIO_NAME);
  });

  describe("Lighting Effects", function () {
    it("should generate texture with inset lighting effect", async function () {
      const outputPath = path.join(testFolders.getResultsPath(SCENARIO_NAME), "effect_inset_lighting.png");
      const result = await generateAndSaveTexture(TextureEffectsFixtures.CUBE_WITH_INSET_LIGHTING, outputPath);

      expect(result.success, result.error).to.be.true;
      assertValidPng(outputPath, 100);
    });

    it("should generate texture with outset lighting effect", async function () {
      const outputPath = path.join(testFolders.getResultsPath(SCENARIO_NAME), "effect_outset_lighting.png");
      const result = await generateAndSaveTexture(TextureEffectsFixtures.CUBE_WITH_OUTSET_LIGHTING, outputPath);

      expect(result.success, result.error).to.be.true;
      assertValidPng(outputPath, 100);
    });

    it("should generate texture with pillow lighting effect", async function () {
      const outputPath = path.join(testFolders.getResultsPath(SCENARIO_NAME), "effect_pillow_lighting.png");
      const result = await generateAndSaveTexture(TextureEffectsFixtures.CUBE_WITH_PILLOW_LIGHTING, outputPath);

      expect(result.success, result.error).to.be.true;
      assertValidPng(outputPath, 100);
    });

    it("should generate texture with ambient occlusion effect", async function () {
      const outputPath = path.join(testFolders.getResultsPath(SCENARIO_NAME), "effect_ambient_occlusion.png");
      const result = await generateAndSaveTexture(TextureEffectsFixtures.CUBE_WITH_AMBIENT_OCCLUSION, outputPath);

      expect(result.success, result.error).to.be.true;
      assertValidPng(outputPath, 100);
    });
  });

  describe("Border Effects", function () {
    it("should generate texture with solid border on all sides", async function () {
      const outputPath = path.join(testFolders.getResultsPath(SCENARIO_NAME), "effect_border_all.png");
      const result = await generateAndSaveTexture(TextureEffectsFixtures.CUBE_WITH_BORDER_ALL, outputPath);

      expect(result.success, result.error).to.be.true;
      assertValidPng(outputPath, 100);
    });

    it("should generate texture with highlight border effect", async function () {
      const outputPath = path.join(testFolders.getResultsPath(SCENARIO_NAME), "effect_border_highlight.png");
      const result = await generateAndSaveTexture(TextureEffectsFixtures.CUBE_WITH_BORDER_HIGHLIGHT, outputPath);

      expect(result.success, result.error).to.be.true;
      assertValidPng(outputPath, 100);
    });

    it("should generate texture with worn border effect", async function () {
      const outputPath = path.join(testFolders.getResultsPath(SCENARIO_NAME), "effect_border_worn.png");
      const result = await generateAndSaveTexture(TextureEffectsFixtures.CUBE_WITH_BORDER_WORN, outputPath);

      expect(result.success, result.error).to.be.true;
      assertValidPng(outputPath, 100);
    });

    it("should generate texture with individual side borders (CSS-style)", async function () {
      const outputPath = path.join(testFolders.getResultsPath(SCENARIO_NAME), "effect_border_individual.png");
      const result = await generateAndSaveTexture(TextureEffectsFixtures.CUBE_WITH_BORDER_INDIVIDUAL_SIDES, outputPath);

      expect(result.success, result.error).to.be.true;
      assertValidPng(outputPath, 100);
    });
  });

  describe("Overlay Effects", function () {
    it("should generate texture with cracks overlay", async function () {
      const outputPath = path.join(testFolders.getResultsPath(SCENARIO_NAME), "effect_overlay_cracks.png");
      const result = await generateAndSaveTexture(TextureEffectsFixtures.CUBE_WITH_CRACKS_OVERLAY, outputPath);

      expect(result.success, result.error).to.be.true;
      assertValidPng(outputPath, 100);
    });

    it("should generate texture with moss overlay", async function () {
      const outputPath = path.join(testFolders.getResultsPath(SCENARIO_NAME), "effect_overlay_moss.png");
      const result = await generateAndSaveTexture(TextureEffectsFixtures.CUBE_WITH_MOSS_OVERLAY, outputPath);

      expect(result.success, result.error).to.be.true;
      assertValidPng(outputPath, 100);
    });

    it("should generate texture with rust overlay", async function () {
      const outputPath = path.join(testFolders.getResultsPath(SCENARIO_NAME), "effect_overlay_rust.png");
      const result = await generateAndSaveTexture(TextureEffectsFixtures.CUBE_WITH_RUST_OVERLAY, outputPath);

      expect(result.success, result.error).to.be.true;
      assertValidPng(outputPath, 100);
    });

    it("should generate texture with sparkle overlay", async function () {
      const outputPath = path.join(testFolders.getResultsPath(SCENARIO_NAME), "effect_overlay_sparkle.png");
      const result = await generateAndSaveTexture(TextureEffectsFixtures.CUBE_WITH_SPARKLE_OVERLAY, outputPath);

      expect(result.success, result.error).to.be.true;
      assertValidPng(outputPath, 100);
    });

    it("should generate texture with veins overlay (ore-style)", async function () {
      const outputPath = path.join(testFolders.getResultsPath(SCENARIO_NAME), "effect_overlay_veins.png");
      const result = await generateAndSaveTexture(TextureEffectsFixtures.CUBE_WITH_VEINS_OVERLAY, outputPath);

      expect(result.success, result.error).to.be.true;
      assertValidPng(outputPath, 100);
    });
  });

  describe("Color Variation Effects", function () {
    it("should generate texture with hue shift variation", async function () {
      const outputPath = path.join(testFolders.getResultsPath(SCENARIO_NAME), "effect_hue_shift.png");
      const result = await generateAndSaveTexture(TextureEffectsFixtures.CUBE_WITH_HUE_SHIFT, outputPath);

      expect(result.success, result.error).to.be.true;
      assertValidPng(outputPath, 100);
    });

    it("should generate texture with value jitter variation", async function () {
      const outputPath = path.join(testFolders.getResultsPath(SCENARIO_NAME), "effect_value_jitter.png");
      const result = await generateAndSaveTexture(TextureEffectsFixtures.CUBE_WITH_VALUE_JITTER, outputPath);

      expect(result.success, result.error).to.be.true;
      assertValidPng(outputPath, 100);
    });
  });

  describe("Tiling Effects", function () {
    it("should generate texture with seamless tiling", async function () {
      const outputPath = path.join(testFolders.getResultsPath(SCENARIO_NAME), "effect_seamless_tiling.png");
      const result = await generateAndSaveTexture(TextureEffectsFixtures.CUBE_WITH_SEAMLESS_TILING, outputPath);

      expect(result.success, result.error).to.be.true;
      assertValidPng(outputPath, 100);
    });
  });

  describe("Combined Effects", function () {
    it("should generate texture with multiple combined effects", async function () {
      const outputPath = path.join(testFolders.getResultsPath(SCENARIO_NAME), "effect_combined.png");
      const result = await generateAndSaveTexture(TextureEffectsFixtures.CUBE_WITH_COMBINED_EFFECTS, outputPath);

      expect(result.success, result.error).to.be.true;
      assertValidPng(outputPath, 100);
    });
  });

  describe("Elephant Model with Ear Effects", function () {
    it("should generate elephant texture with inset lighting on pink ears", async function () {
      const outputPath = path.join(testFolders.getResultsPath(SCENARIO_NAME), "elephant_with_ear_effects.png");
      const result = await generateAndSaveTexture(TextureEffectsFixtures.ELEPHANT_WITH_EAR_EFFECTS, outputPath);

      expect(result.success, result.error).to.be.true;
      assertValidPng(outputPath, 100);

      // Verify the texture is reasonably sized (elephant requires larger atlas)
      const stats = fs.statSync(outputPath);
      expect(stats.size).to.be.greaterThan(1000, "Elephant texture should be substantial");
    });
  });

  /**
   * Baseline comparison tests - verify textures match expected baselines.
   * Run with UPDATE_SNAPSHOTS=true to generate/update baselines.
   */
  describe("Baseline Comparisons", function () {
    const baselinePath = (name: string) => testFolders.getScenariosPath(SCENARIO_NAME) + "/" + name;
    const resultPath = (name: string) => testFolders.getResultsPath(SCENARIO_NAME) + "/" + name;

    describe("Lighting Effects Baselines", function () {
      it("inset lighting should match baseline", async function () {
        const output = resultPath("effect_inset_lighting.png");
        const baseline = baselinePath("effect_inset_lighting.png");
        await generateAndSaveTexture(TextureEffectsFixtures.CUBE_WITH_INSET_LIGHTING, output);
        assertPngMatchesBaseline(this, output, baseline);
      });

      it("outset lighting should match baseline", async function () {
        const output = resultPath("effect_outset_lighting.png");
        const baseline = baselinePath("effect_outset_lighting.png");
        await generateAndSaveTexture(TextureEffectsFixtures.CUBE_WITH_OUTSET_LIGHTING, output);
        assertPngMatchesBaseline(this, output, baseline);
      });

      it("pillow lighting should match baseline", async function () {
        const output = resultPath("effect_pillow_lighting.png");
        const baseline = baselinePath("effect_pillow_lighting.png");
        await generateAndSaveTexture(TextureEffectsFixtures.CUBE_WITH_PILLOW_LIGHTING, output);
        assertPngMatchesBaseline(this, output, baseline);
      });

      it("ambient occlusion should match baseline", async function () {
        const output = resultPath("effect_ambient_occlusion.png");
        const baseline = baselinePath("effect_ambient_occlusion.png");
        await generateAndSaveTexture(TextureEffectsFixtures.CUBE_WITH_AMBIENT_OCCLUSION, output);
        assertPngMatchesBaseline(this, output, baseline);
      });
    });

    describe("Border Effects Baselines", function () {
      it("solid border all sides should match baseline", async function () {
        const output = resultPath("effect_border_all.png");
        const baseline = baselinePath("effect_border_all.png");
        await generateAndSaveTexture(TextureEffectsFixtures.CUBE_WITH_BORDER_ALL, output);
        assertPngMatchesBaseline(this, output, baseline);
      });

      it("highlight border should match baseline", async function () {
        const output = resultPath("effect_border_highlight.png");
        const baseline = baselinePath("effect_border_highlight.png");
        await generateAndSaveTexture(TextureEffectsFixtures.CUBE_WITH_BORDER_HIGHLIGHT, output);
        assertPngMatchesBaseline(this, output, baseline);
      });

      it("worn border should match baseline", async function () {
        const output = resultPath("effect_border_worn.png");
        const baseline = baselinePath("effect_border_worn.png");
        await generateAndSaveTexture(TextureEffectsFixtures.CUBE_WITH_BORDER_WORN, output);
        assertPngMatchesBaseline(this, output, baseline);
      });

      it("individual side borders should match baseline", async function () {
        const output = resultPath("effect_border_individual.png");
        const baseline = baselinePath("effect_border_individual.png");
        await generateAndSaveTexture(TextureEffectsFixtures.CUBE_WITH_BORDER_INDIVIDUAL_SIDES, output);
        assertPngMatchesBaseline(this, output, baseline);
      });
    });

    describe("Overlay Effects Baselines", function () {
      it("cracks overlay should match baseline", async function () {
        const output = resultPath("effect_overlay_cracks.png");
        const baseline = baselinePath("effect_overlay_cracks.png");
        await generateAndSaveTexture(TextureEffectsFixtures.CUBE_WITH_CRACKS_OVERLAY, output);
        assertPngMatchesBaseline(this, output, baseline);
      });

      it("moss overlay should match baseline", async function () {
        const output = resultPath("effect_overlay_moss.png");
        const baseline = baselinePath("effect_overlay_moss.png");
        await generateAndSaveTexture(TextureEffectsFixtures.CUBE_WITH_MOSS_OVERLAY, output);
        assertPngMatchesBaseline(this, output, baseline);
      });

      it("rust overlay should match baseline", async function () {
        const output = resultPath("effect_overlay_rust.png");
        const baseline = baselinePath("effect_overlay_rust.png");
        await generateAndSaveTexture(TextureEffectsFixtures.CUBE_WITH_RUST_OVERLAY, output);
        assertPngMatchesBaseline(this, output, baseline);
      });

      it("sparkle overlay should match baseline", async function () {
        const output = resultPath("effect_overlay_sparkle.png");
        const baseline = baselinePath("effect_overlay_sparkle.png");
        await generateAndSaveTexture(TextureEffectsFixtures.CUBE_WITH_SPARKLE_OVERLAY, output);
        assertPngMatchesBaseline(this, output, baseline);
      });

      it("veins overlay should match baseline", async function () {
        const output = resultPath("effect_overlay_veins.png");
        const baseline = baselinePath("effect_overlay_veins.png");
        await generateAndSaveTexture(TextureEffectsFixtures.CUBE_WITH_VEINS_OVERLAY, output);
        assertPngMatchesBaseline(this, output, baseline);
      });
    });

    describe("Color Variation Effects Baselines", function () {
      it("hue shift should match baseline", async function () {
        const output = resultPath("effect_hue_shift.png");
        const baseline = baselinePath("effect_hue_shift.png");
        await generateAndSaveTexture(TextureEffectsFixtures.CUBE_WITH_HUE_SHIFT, output);
        assertPngMatchesBaseline(this, output, baseline);
      });

      it("value jitter should match baseline", async function () {
        const output = resultPath("effect_value_jitter.png");
        const baseline = baselinePath("effect_value_jitter.png");
        await generateAndSaveTexture(TextureEffectsFixtures.CUBE_WITH_VALUE_JITTER, output);
        assertPngMatchesBaseline(this, output, baseline);
      });
    });

    describe("Tiling Effects Baselines", function () {
      it("seamless tiling should match baseline", async function () {
        const output = resultPath("effect_seamless_tiling.png");
        const baseline = baselinePath("effect_seamless_tiling.png");
        await generateAndSaveTexture(TextureEffectsFixtures.CUBE_WITH_SEAMLESS_TILING, output);
        assertPngMatchesBaseline(this, output, baseline);
      });
    });

    describe("Combined Effects Baselines", function () {
      it("combined effects should match baseline", async function () {
        const output = resultPath("effect_combined.png");
        const baseline = baselinePath("effect_combined.png");
        await generateAndSaveTexture(TextureEffectsFixtures.CUBE_WITH_COMBINED_EFFECTS, output);
        assertPngMatchesBaseline(this, output, baseline);
      });
    });

    describe("Elephant Model Baselines", function () {
      it("elephant with ear effects should match baseline", async function () {
        const output = resultPath("elephant_with_ear_effects.png");
        const baseline = baselinePath("elephant_with_ear_effects.png");
        await generateAndSaveTexture(TextureEffectsFixtures.ELEPHANT_WITH_EAR_EFFECTS, output);
        assertPngMatchesBaseline(this, output, baseline);
      });
    });
  });
});
