// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Result of resolving a render controller against an entity's resource definition
 * and a Molang context. Contains the resolved geometry, texture layers, and
 * optional tint color for rendering.
 */
export default interface IRenderResolvedState {
  /** Resolved geometry identifier (e.g., "geometry.sheep.v1.8") */
  geometryId?: string;

  /** Resolved texture layers, in order. First is base, subsequent are overlays. */
  textureLayers: IRenderTextureLayer[];

  /** Material overrides: bone name pattern → material name */
  materialOverrides?: Map<string, string>;
}

export interface IRenderTextureLayer {
  /** Resolved texture path (e.g., "textures/entity/sheep/sheep") */
  texturePath: string;

  /** Optional tint color to multiply with the texture (RGBA 0-1 range) */
  tintColor?: { r: number; g: number; b: number; a: number };
}
