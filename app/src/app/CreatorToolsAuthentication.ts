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
  authTag?: string; // GCM authentication tag
  permissionLevel: RemoteServerAccessLevel;
  serverStatus: CreatorToolsServerStatus[];
  /** Whether the Minecraft EULA has been accepted (required for BDS features) */
  eulaAccepted?: boolean;
}

/**
 * Configuration for a server slot, returned once at connection time.
 * Contains settings that don't change frequently and shouldn't be
 * sent in every status update.
 */
export interface ISlotConfig {
  /** Whether the script debugger is enabled on the server (listening on port) */
  debuggerEnabled: boolean;
  /** Whether debug stats streaming is enabled (server connects and streams to web console) */
  debuggerStreamingEnabled: boolean;
  /** Server version string */
  serverVersion?: string;
  /** Debug session connection state: 'disconnected', 'connecting', 'connected', 'error' */
  debugConnectionState?: string;
  /** Debug protocol version if connected */
  debugProtocolVersion?: number;
  /** Last debug stat tick received */
  debugLastStatTick?: number;
  /** Debug connection error message if any */
  debugErrorMessage?: string;
}

export interface CreatorToolsServerStatus {
  id: number;
  recentMessages?: { message: string; received: number }[];
  status?: DedicatedServerStatus;
  time: number;
  /** Slot configuration - included in initial connection, may be omitted in subsequent updates */
  slotConfig?: ISlotConfig;
  /** World ID currently associated with this slot */
  worldId?: string;
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
