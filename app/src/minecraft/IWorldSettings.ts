import { Difficulty, GameType, Generator } from "./WorldLevelDat";

export enum BackupType {
  none,
  startStopOnly,
  every5Minutes,
  every2Minutes,
}

export interface IPackReferenceSet {
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
  randomSeed?: string;
  name?: string;
  commandsEnabled?: boolean; // same as 'cheats enabled'.
  backupType?: BackupType;
  useCustomSettings?: boolean;
  betaApisExperiment?: boolean;
  lastPlayed?: bigint;
  deferredTechnicalPreviewExperiment?: boolean;
  isEditor?: boolean;
  worldTemplateReferenceSets?: IPackReferenceSet[];
  packReferenceSets?: IPackReferenceSet[];
}
