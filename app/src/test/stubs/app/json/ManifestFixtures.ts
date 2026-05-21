// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export const MANIFEST_UUID_HEADER = "00000000-0000-0000-0000-000000000001";
export const MANIFEST_UUID_MODULE_1 = "00000000-0000-0000-0000-000000000002";
export const MANIFEST_UUID_MODULE_2 = "00000000-0000-0000-0000-000000000003";

/**
 * Builds a minimal valid manifest header JSON object (snake_case, as on disk).
 * Provide overrides to test specific header properties.
 */
export function createManifestHeaderJson(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: "Test Pack",
    description: "A test description",
    uuid: MANIFEST_UUID_HEADER,
    version: [1, 0, 0],
    ...overrides,
  };
}

/**
 * Builds a minimal valid manifest JSON object (snake_case, as on disk).
 * Defaults to format_version 2 with a single "resources" module.
 * Provide overrides to test specific manifest properties.
 */
export function createManifestJson(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    format_version: 2,
    header: createManifestHeaderJson(),
    modules: [{ type: "resources", uuid: MANIFEST_UUID_MODULE_1, version: [1, 0, 0] }],
    ...overrides,
  };
}
