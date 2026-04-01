// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Difficulty, GameType, Generator, PlayerPermissionsLevel } from "./WorldLevelDat";

export enum BackupType {
  none,
  startStopOnly,
  every5Minutes,
  every2Minutes,
}

export interface IPackageReference {
  name: string;
  hash?: string;
  behaviorPackReferences: { uuid: string; version: number[]; priority?: number }[];
  resourcePackReferences: { uuid: string; version: number[]; priority?: number }[];
}

export interface IWorldSettings {
  gameType?: GameType;
  generator?: Generator;
  difficulty?: Difficulty;
  maxPlayerCount?: number;
  cheatsEnabled?: boolean;
  permissionLevel?: PlayerPermissionsLevel;
  playerPermissionLevel?: PlayerPermissionsLevel;
  randomSeed?: string;
  worldContentPath?: string;
  name?: string;
  commandsEnabled?: boolean; // same as 'cheats enabled'.
  backupType?: BackupType;
  useCustomSettings?: boolean;
  betaApisExperiment?: boolean;
  lastPlayed?: bigint;
  deferredTechnicalPreviewExperiment?: boolean;
  isEditor?: boolean;
  deployCreatorToolsInfrastructure?: boolean;
  worldTemplateReferences?: IPackageReference[];
  packageReferences?: IPackageReference[];
  onlineMode?: boolean;
  emitServerTelemetry?: boolean;
  enableDebugger?: boolean;
  enableDebuggerStreaming?: boolean;
  /**
   * When true, the world is treated as transient/ephemeral:
   * - World data is not backed up on reprovisioning
   * - Each deployment starts with a fresh world (no leveldb copied)
   * - Useful for development scenarios where you always want a clean slate
   */
  transientWorld?: boolean;
}
