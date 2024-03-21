// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { IMinecraftStartMessage } from "./IMinecraftStartMessage";
import Project from "./Project";

export enum MinecraftPushWorldType {
  inferFromProject = 0,
  none = 1,
  flat = 2,
  fromProjectPath = 3,
  fromTemplate = 4,
}

export enum MinecraftPushWorldTemplate {
  basicFlat = 0,
}

export default interface MinecraftPush {
  portSlot?: number;
  worldType?: MinecraftPushWorldType;
  worldTemplate?: MinecraftPushWorldTemplate;
  seed?: number;
  gametest?: string;
  project?: Project;
  serverStart?: IMinecraftStartMessage;
}
