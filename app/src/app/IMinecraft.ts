// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { CreatorToolsMinecraftErrorStatus, CreatorToolsMinecraftState } from "./CreatorTools";
import { IEvent } from "ste-events";
import Project from "./Project";
import MinecraftPush from "./MinecraftPush";
import GameStateManager from "../minecraft/GameStateManager";
import IFolder from "../storage/IFolder";
import IActionSetData from "../actions/IActionSetData";

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
  state: CreatorToolsMinecraftState;
  activeProject: Project | undefined;

  canDeployFiles: boolean;

  errorStatus?: CreatorToolsMinecraftErrorStatus;
  errorMessage?: string;

  gameStateManager: GameStateManager | undefined;

  runCommand(command: string): Promise<string | undefined>;
  runActionSet(actionSet: IActionSetData): Promise<string | undefined>;

  worldFolder: IFolder | undefined;
  projectFolder: IFolder | undefined;

  onRefreshed: IEvent<IMinecraft, CreatorToolsMinecraftState>;
  onStateChanged: IEvent<IMinecraft, CreatorToolsMinecraftState>;
  onWorldFolderReady: IEvent<IMinecraft, IFolder>;
  onProjectFolderReady: IEvent<IMinecraft, IFolder>;
  onMessage: IEvent<IMinecraft, IMinecraftMessage>;

  canPrepare(): boolean;

  prepare(force?: boolean): void;
  prepareAndStart(push: MinecraftPush): Promise<IPrepareAndStartResult>;

  initialize(): Promise<void>;

  stop(): Promise<void>;
  syncWithDeployment(): Promise<void>;

  updateStatus(): Promise<CreatorToolsMinecraftState>;

  processExternalMessage(command: string, data: string): void;
}
