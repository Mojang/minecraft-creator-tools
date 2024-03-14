// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { CartoMinecraftErrorStatus, CartoMinecraftState } from "./Carto";
import { IEvent } from "ste-events";
import Project from "./Project";
import MinecraftPush from "./MinecraftPush";
import GameStateManager from "../minecraft/GameStateManager";
import IFolder from "../storage/IFolder";

export interface IMinecraftMessage {
  message: string;
  received: number;
}

export enum PrepareAndStartResultType {
  error = 0,
  started = 1,
}

export interface IPrepareAndStartResult {
  worldName?: string;
  type: PrepareAndStartResultType;
}

export default interface IMinecraft {
  state: CartoMinecraftState;
  activeProject: Project | undefined;

  canDeployFiles: boolean;

  errorStatus?: CartoMinecraftErrorStatus;
  errorMessage?: string;

  gameStateManager: GameStateManager | undefined;

  runCommand(command: string): Promise<string | undefined>;

  worldFolder: IFolder | undefined;
  projectFolder: IFolder | undefined;

  onRefreshed: IEvent<IMinecraft, CartoMinecraftState>;
  onStateChanged: IEvent<IMinecraft, CartoMinecraftState>;
  onWorldFolderReady: IEvent<IMinecraft, IFolder>;
  onProjectFolderReady: IEvent<IMinecraft, IFolder>;
  onMessage: IEvent<IMinecraft, IMinecraftMessage>;

  canPrepare(): boolean;

  prepare(force?: boolean): void;
  prepareAndStart(push: MinecraftPush): Promise<IPrepareAndStartResult>;

  initialize(): Promise<void>;

  stop(): Promise<void>;
  deploy(): Promise<void>;

  updateStatus(): Promise<CartoMinecraftState>;

  processExternalMessage(command: string, data: string): void;
}
