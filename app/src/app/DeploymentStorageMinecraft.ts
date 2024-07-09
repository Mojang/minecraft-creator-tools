// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import Carto, { CartoMinecraftErrorStatus, CartoMinecraftState } from "./Carto";
import IMinecraft, { IMinecraftMessage, PrepareAndStartResultType } from "./IMinecraft";
import AppServiceProxy from "../core/AppServiceProxy";
import { EventDispatcher } from "ste-events";
import Utilities from "../core/Utilities";
import Project from "./Project";
import MinecraftPush from "./MinecraftPush";
import GameStateManager from "../minecraft/GameStateManager";
import Log from "../core/Log";
import ProjectTools from "./ProjectTools";
import IFolder from "../storage/IFolder";
import { MinecraftGameConnectionMode } from "./ICartoData";
import ProjectExporter from "./ProjectExporter";

export default class DeploymentStorageMinecraft implements IMinecraft {
  private _carto: Carto;
  state: CartoMinecraftState;
  private _onStateChanged = new EventDispatcher<IMinecraft, CartoMinecraftState>();
  private _onRefreshed = new EventDispatcher<IMinecraft, CartoMinecraftState>();
  private _project: Project | undefined;
  private _gameStateManager: GameStateManager;

  errorStatus?: CartoMinecraftErrorStatus;
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

  constructor(carto: Carto) {
    this._carto = carto;
    this._gameStateManager = new GameStateManager(this._carto);

    this.state = CartoMinecraftState.none;
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

  public notifyStateChanged(newVal: CartoMinecraftState) {
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

  processExternalMessage(command: string, data: string) {}

  async pushWorld() {
    if (!this._carto || this._carto.deploymentStorage === null || !this._project) {
      return;
    }

    let name = this._project.name + "_mct";

    const worldsFolder = await ProjectExporter.ensureMinecraftWorldsFolder(this._carto);

    if (!worldsFolder) {
      Log.debug("Could not find a Minecraft world.");
      return;
    }

    const worldFolder = worldsFolder.ensureFolder(name);

    await worldFolder.ensureExists();

    // Log.debugAlert("Exporting folder to '" + worldFolder.storageRelativePath + "'");
    await ProjectExporter.syncFlatPackRefWorldTo(this._carto, this._project, worldFolder, name);

    name = Utilities.getSimpleString(this._project.name) + "_mct";

    await worldFolder.saveAll();

    return name;
  }

  async deploy() {
    if (
      this._carto.deploymentStorage == null ||
      this._carto.deployBehaviorPacksFolder == null ||
      this._carto.minecraftGameMode === MinecraftGameConnectionMode.remoteMinecraft
    ) {
      throw new Error("This instance doesn't support deployment");
    }

    if (!this._project) {
      return;
    }

    const deployFolderExists = await this._carto.deployBehaviorPacksFolder.exists();

    if (deployFolderExists) {
      await ProjectTools.deployProject(this._carto, this._project, this._carto.deploymentStorage.rootFolder);
    }
  }

  canPrepare() {
    return true;
  }

  async prepareAndStart(push: MinecraftPush) {
    let worldName = undefined;

    if (push.project) {
      this._project = push.project;

      await this.deploy();
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
      this.notifyStateChanged(CartoMinecraftState.stopped);
    } else if (
      this.state === CartoMinecraftState.none ||
      this.state === CartoMinecraftState.error ||
      this.state === CartoMinecraftState.disconnected
    ) {
      this.notifyStateChanged(CartoMinecraftState.initializing);
    }
  }
}
