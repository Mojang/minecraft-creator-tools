// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { CreatorToolsMinecraftErrorStatus, CreatorToolsMinecraftState } from "./CreatorTools";
import { IEvent } from "ste-events";
import Project from "./Project";
import MinecraftPush from "./MinecraftPush";
import GameStateManager from "../minecraft/GameStateManager";
import IFolder from "../storage/IFolder";
import IActionSetData from "../actions/IActionSetData";
import IStorage from "../storage/IStorage";
import { ISlotConfig } from "./CreatorToolsAuthentication";

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
  errorMessage?: string;
}

export default interface IMinecraft {
  state: CreatorToolsMinecraftState;
  activeProject: Project | undefined;

  canDeployFiles: boolean;

  errorStatus?: CreatorToolsMinecraftErrorStatus;
  errorMessage?: string;

  /**
   * Configuration metadata for the slot, received once at connection time.
   * Contains flags like debuggerEnabled and debuggerStreamingEnabled that
   * inform the UI about what features are available.
   */
  slotConfig?: ISlotConfig;

  gameStateManager: GameStateManager | undefined;

  runCommand(command: string): Promise<string | undefined>;
  runActionSet(actionSet: IActionSetData): Promise<string | undefined>;

  worldFolder: IFolder | undefined;
  projectFolder: IFolder | undefined;

  /**
   * Storage representing the world content of the active Minecraft server.
   * This includes the world folder, behavior packs, and resource packs.
   * For remote connections, this is backed by HttpStorage pointing to /api/worldContent/{slot}/.
   */
  worldContentStorage: IStorage | undefined;

  /**
   * A Project wrapper around the worldContentStorage.
   * Created lazily when first accessed. Provides structured access to the
   * world content including behavior packs, resource packs, and world data.
   */
  worldProject: Project | undefined;

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
