// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * NoiseTextureGenerator
 *
 * @deprecated Use TexturedRectangleGenerator instead.
 *
 * This file is kept for backwards compatibility only.
 * All functionality has been moved to:
 * - TexturedRectangleGenerator - SVG/pixel generation
 * - NoiseGenerationUtilities - Pure noise algorithms
 */

import TexturedRectangleGenerator, {
  NoiseGenerationUtilities,
  SeededRandom,
  ParsedColor,
} from "./TexturedRectangleGenerator";
import { IMcpNoiseConfig, IMcpTexturedRectangle } from "./IMcpModelDesign";

/**
 * @deprecated Use TexturedRectangleGenerator instead.
 * This class is kept for backwards compatibility.
 */
export default class NoiseTextureGenerator {
  /**
   * @deprecated Use TexturedRectangleGenerator.generateTexturedRectangleSvg instead.
   */
  static generateTexturedRectangleSvg(
    config: IMcpTexturedRectangle,
    width: number,
    height: number,
    contextString?: string
  ): string {
    return TexturedRectangleGenerator.generateTexturedRectangleSvg(config, width, height, contextString);
  }

  /**
   * @deprecated Use TexturedRectangleGenerator.generateNoiseSvg instead.
   */
  static generateNoiseSvg(config: IMcpNoiseConfig, width: number, height: number, contextString?: string): string {
    return TexturedRectangleGenerator.generateNoiseSvg(config, width, height, contextString);
  }

  /**
   * @deprecated Use TexturedRectangleGenerator.combineWithOverlay instead.
   */
  static combineWithOverlay(noiseSvg: string, overlaySvg: string | undefined, width: number, height: number): string {
    return TexturedRectangleGenerator.combineWithOverlay(noiseSvg, overlaySvg, width, height);
  }

  /**
   * @deprecated Use TexturedRectangleGenerator.generateNoisePixels instead.
   */
  static generateNoisePixels(
    config: IMcpNoiseConfig,
    width: number,
    height: number,
    contextString?: string
  ): Uint8Array {
    return TexturedRectangleGenerator.generateNoisePixels(config, width, height, contextString);
  }

  /**
   * @deprecated Use TexturedRectangleGenerator.generateTexturedRectanglePixels instead.
   */
  static generateTexturedRectanglePixels(
    config: IMcpTexturedRectangle,
    width: number,
    height: number,
    contextString?: string
  ): Uint8Array {
    return TexturedRectangleGenerator.generatePixels(config, width, height, contextString);
  }
}

// Re-export for any code that might import from here
export { NoiseGenerationUtilities, SeededRandom };
export type { ParsedColor };
