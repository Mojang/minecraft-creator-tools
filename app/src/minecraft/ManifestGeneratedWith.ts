// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { IAddonMetadata } from "./IAddonManifest";

/**
 * Tool names Creator Tools records in a pack manifest's `metadata.generated_with` map, one per surface
 * that created or changed the pack. Bedrock requires each name to match `[a-zA-Z0-9_-]` and be at most
 * 32 characters, and each version to be a semver string.
 */
export type GeneratedWithTool = "mctoolsweb" | "mctoolscli" | "mctoolsmcp";

export const GeneratedWithTools = {
  web: "mctoolsweb",
  cli: "mctoolscli",
  mcp: "mctoolsmcp",
} as const satisfies Record<string, GeneratedWithTool>;

/**
 * Adds `version` under `toolName` in `metadata.generated_with`, creating the map or the version list as
 * needed. Malformed values (a non-object map, or a non-array version list) are replaced. Returns true if
 * the metadata changed.
 */
export function addGeneratedWith(metadata: IAddonMetadata, toolName: string, version: string): boolean {
  let generatedWith = metadata.generated_with;

  if (!generatedWith || typeof generatedWith !== "object" || Array.isArray(generatedWith)) {
    generatedWith = {};
    metadata.generated_with = generatedWith;
  }

  const versions = generatedWith[toolName];

  if (!Array.isArray(versions)) {
    generatedWith[toolName] = [version];
    return true;
  }

  if (versions.includes(version)) {
    return false;
  }

  versions.push(version);
  return true;
}
