// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Default engine version stamped into newly created pack manifests
 * (`header.min_engine_version`, and `base_game_version` for world templates).
 *
 * Kept in a dependency-free module so manifest definitions and generators can
 * share it without import cycles. When bumping the targeted Minecraft version,
 * see docs/UpdatingMinecraftVersion.md.
 */
export const DEFAULT_MIN_ENGINE_VERSION: number[] = [1, 26, 60];

export function getDefaultMinEngineVersion(): number[] {
  return DEFAULT_MIN_ENGINE_VERSION.slice();
}
