// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { RemoteServerAccessLevel } from "./ICreatorToolsData";

export enum AuthenticationResult {
  pending = 0,
  success = 1,
  failed = 2,
  error = 3,
}

export interface CreatorToolsServerAuthenticationResult {
  token: string;
  iv: string;
  permissionLevel: RemoteServerAccessLevel;
  serverStatus: CreatorToolsServerStatus[];
}

export interface CreatorToolsServerStatus {
  id: number;
  recentMessages?: { message: string; received: number }[];
  status?: DedicatedServerStatus;
  time: number;
}

export enum DedicatedServerStatus {
  stopped = 1,
  deploying = 2,
  launching = 3,
  starting = 4,
  started = 5,
}

export default class CreatorToolsAuthentication {
  result: AuthenticationResult;
  permissionLevel: RemoteServerAccessLevel;

  constructor(result: AuthenticationResult, permissionLevel: RemoteServerAccessLevel) {
    this.result = result;
    this.permissionLevel = permissionLevel;
  }
}
