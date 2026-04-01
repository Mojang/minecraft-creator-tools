// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { DedicatedServerMode, MinecraftTrack } from "./ICreatorToolsData";
import { IWorldSettings } from "../minecraft/IWorldSettings";

export interface IMinecraftStartMessage {
  path?: string /* dedicated server path. interpretation depends on mode */;
  iagree?: boolean;
  mode: DedicatedServerMode | undefined;
  track?: MinecraftTrack;
  forceStartNewWorld?: boolean;
  additionalContentPath?: string;
  backupContainerPath?: string;
  projectKey?: string;
  worldSettings?: IWorldSettings;
  /** If true, skip digital signature verification of the server executable. Use with caution. */
  unsafeSkipSignatureValidation?: boolean;
  /**
   * If true, the world is transient - not backed up and reset on each deployment.
   * Useful for MCP sessions and development scenarios where you always want a fresh world.
   */
  transientWorld?: boolean;
}
