// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import CreatorTools, { CreatorToolsMinecraftErrorStatus, CreatorToolsMinecraftState } from "./CreatorTools";
import IMinecraft, { IMinecraftMessage, PrepareAndStartResultType } from "./IMinecraft";
import AppServiceProxy from "../core/AppServiceProxy";
import { EventDispatcher } from "ste-events";
import Utilities from "../core/Utilities";
import Project from "./Project";
import MinecraftPush from "./MinecraftPush";
import GameStateManager from "../minecraft/GameStateManager";
import Log from "../core/Log";
import IFolder from "../storage/IFolder";
import { MinecraftGameConnectionMode } from "./ICreatorToolsData";
import ProjectExporter from "./ProjectExporter";
import IActionSetData from "../actions/IActionSetData";

export default class DeploymentStorageMinecraft implements IMinecraft {
  private _creatorTools: CreatorTools;
  state: CreatorToolsMinecraftState;
  private _onStateChanged = new EventDispatcher<IMinecraft, CreatorToolsMinecraftState>();
  private _onRefreshed = new EventDispatcher<IMinecraft, CreatorToolsMinecraftState>();
  private _project: Project | undefined;
  private _gameStateManager: GameStateManager;

  errorStatus?: CreatorToolsMinecraftErrorStatus;
  errorMessage?: string;

  worldFolder: IFolder | undefined;
  projectFolder: IFolder | undefined;

  private _onWorldFolderReady = new EventDispatcher<IMinecraft, IFolder>();
  private _onProjectFolderReady = new EventDispatcher<IMinecraft, IFolder>();
  private _onMessage = new EventDispatcher<IMinecraft, IMinecraftMessage>();

  public get onWorldFolderReady() {
    return this._onWorldFolderReady.asEvent();
  }

  public get onProjectFolderReady() {
    return this._onProjectFolderReady.asEvent();
  }

  public get onMessage() {
    return this._onMessage.asEvent();
  }

  get canDeployFiles() {
    return true;
  }

  public get onRefreshed() {
    return this._onRefreshed.asEvent();
  }

  public get onStateChanged() {
    return this._onStateChanged.asEvent();
  }

  constructor(creatorTools: CreatorTools) {
    this._creatorTools = creatorTools;
    this._gameStateManager = new GameStateManager(this._creatorTools);

    this.state = CreatorToolsMinecraftState.none;
  }

  async updateStatus() {
    return this.state;
  }

  get activeProject() {
    return this._project;
  }

  set activeProject(newProject: Project | undefined) {
    this._project = newProject;
  }

  public get gameStateManager() {
    return this._gameStateManager;
  }

  public notifyStateChanged(newVal: CreatorToolsMinecraftState) {
    this.state = newVal;

    this._onStateChanged.dispatch(this, newVal);
  }

  async initialize() {
    await this.start();
  }

  async prepare(force?: boolean): Promise<void> {
    return;
  }

  async runCommand(command: string): Promise<string | undefined> {
    return undefined;
  }

  async runActionSet(actionSet: IActionSetData): Promise<string | undefined> {
    return undefined;
  }

  processExternalMessage(command: string, data: string) {}

  async pushWorld() {
    if (!this._creatorTools || this._creatorTools.deploymentStorage === null || !this._project) {
      return;
    }

    let name = this._project.name + "_mct";

    const worldsFolder = await ProjectExporter.ensureMinecraftWorldsFolder(this._creatorTools);

    if (!worldsFolder) {
      Log.debug("Could not find a Minecraft world.");
      return;
    }

    const worldFolder = worldsFolder.ensureFolder(name);

    await worldFolder.ensureExists();

    // Log.debugAlert("Exporting folder to '" + worldFolder.storageRelativePath + "'");
    await ProjectExporter.syncFlatPackRefWorldTo(this._creatorTools, this._project, worldFolder, name);

    name = Utilities.getSimpleString(this._project.name) + "_mct";

    await worldFolder.saveAll();

    return name;
  }

  async syncWithDeployment() {
    if (
      this._creatorTools.deploymentStorage == null ||
      this._creatorTools.deployBehaviorPacksFolder == null ||
      this._creatorTools.minecraftGameMode === MinecraftGameConnectionMode.remoteMinecraft
    ) {
      throw new Error("This instance doesn't support deployment");
    }

    if (!this._project) {
      return;
    }

    let isAvailable = this._creatorTools.deploymentStorage.available;

    if (isAvailable === undefined) {
      isAvailable = await this._creatorTools.deploymentStorage.getAvailable();
    }

    if (!isAvailable) {
      return;
    }

    const deployFolderExists = await this._creatorTools.deployBehaviorPacksFolder.exists();

    if (deployFolderExists) {
      await ProjectExporter.deployProject(
        this._creatorTools,
        this._project,
        this._creatorTools.deploymentStorage.rootFolder
      );
    }
  }

  canPrepare() {
    return true;
  }

  async prepareAndStart(push: MinecraftPush) {
    let worldName = undefined;

    if (push.project) {
      this._project = push.project;

      await this.syncWithDeployment();
    }

    if (push.worldType) {
      worldName = await this.pushWorld();
    }

    await this.start();

    return {
      type: PrepareAndStartResultType.started,
      worldName: worldName,
    };
  }

  async stop() {}

  async start() {
    if (!AppServiceProxy.hasAppService && Utilities.isDebug) {
      this.notifyStateChanged(CreatorToolsMinecraftState.stopped);
    } else if (
      this.state === CreatorToolsMinecraftState.none ||
      this.state === CreatorToolsMinecraftState.error ||
      this.state === CreatorToolsMinecraftState.disconnected
    ) {
      this.notifyStateChanged(CreatorToolsMinecraftState.initializing);
    }
  }
}
