// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { DedicatedServerMode, MinecraftTrack } from "./ICartoData";
import { IWorldSettings } from "../minecraft/IWorldSettings";

export interface IMinecraftStartMessage {
  path?: string /* dedicated server path. interpretation depends on mode */;
  iagree?: boolean;
  mode: DedicatedServerMode | undefined;
  track?: MinecraftTrack;
  forceStartNewWorld?: boolean;
  backupContainerPath?: string;
  projectKey?: string;
  worldSettings?: IWorldSettings;
}
