import { Difficulty, GameType, Generator } from "./WorldLevelDat";

export enum BackupType {
  none,
  startStopOnly,
  every5Minutes,
}

export interface IPackReference {
  name: string;
  hash?: string;
  behaviorPackReferences: { uuid: string; version: number[] }[];
  resourcePackReferences: { uuid: string; version: number[] }[];
}

export interface IWorldSettings {
  gameType?: GameType;
  generator?: Generator;
  difficulty?: Difficulty;
  cheatsEnabled?: boolean;
  randomSeed?: string;
  name?: string;
  commandsEnabled?: boolean; // same as 'cheats enabled'.
  backupType?: BackupType;
  useCustomSettings?: boolean;
  betaApisExperiment?: boolean;
  isEditor?: boolean;
  worldTemplateReferences?: IPackReference[];
  packReferences?: IPackReference[];
}
