import Carto, { CartoMinecraftErrorStatus, CartoMinecraftState } from "../app/Carto";
import IMinecraft, { IMinecraftMessage, PrepareAndStartResultType } from "../app/IMinecraft";
import AppServiceProxy, { AppServiceProxyCommands } from "../core/AppServiceProxy";
import { EventDispatcher } from "ste-events";
import IStorage from "../storage/IStorage";
import IFolder from "../storage/IFolder";
import Log from "../core/Log";
import Utilities from "../core/Utilities";
import Project from "../app/Project";
import ProjectExporter from "../app/ProjectExporter";
import MinecraftPush from "../app/MinecraftPush";
import GameStateManager from "../minecraft/GameStateManager";
import { DedicatedServerMode } from "../app/ICartoData";
import ProjectTools from "../app/ProjectTools";
import { IMinecraftStartMessage } from "../app/IMinecraftStartMessage";
import { IWorldSettings } from "../minecraft/IWorldSettings";

export default class ProcessHostedMinecraft implements IMinecraft {
  private _carto: Carto;

  private _project: Project | undefined;
  private _gameStateManager: GameStateManager;
  errorStatus?: CartoMinecraftErrorStatus;
  errorMessage?: string;

  state: CartoMinecraftState;
  dedicatedServerStorage: IStorage | null;
  private _dsDeployBehaviorPacksFolder: IFolder | null;

  worldFolder: IFolder | undefined;
  projectFolder: IFolder | undefined;

  private _onWorldStorageReady = new EventDispatcher<IMinecraft, IFolder>();
  private _onProjectStorageReady = new EventDispatcher<IMinecraft, IFolder>();
  private _onMessage = new EventDispatcher<IMinecraft, IMinecraftMessage>();
  private _onStateChanged = new EventDispatcher<IMinecraft, CartoMinecraftState>();
  private _onRefreshed = new EventDispatcher<IMinecraft, CartoMinecraftState>();

  public get onWorldFolderReady() {
    return this._onWorldStorageReady.asEvent();
  }

  public get onProjectFolderReady() {
    return this._onProjectStorageReady.asEvent();
  }

  public get onMessage() {
    return this._onMessage.asEvent();
  }

  public get gameStateManager() {
    return this._gameStateManager;
  }

  public get onRefreshed() {
    return this._onRefreshed.asEvent();
  }

  public get onStateChanged() {
    return this._onStateChanged.asEvent();
  }

  get activeProject() {
    return this._project;
  }

  set activeProject(newProject: Project | undefined) {
    this._project = newProject;
  }

  get canDeployFiles() {
    return true;
  }

  constructor(carto: Carto) {
    this._carto = carto;
    this._gameStateManager = new GameStateManager(this._carto);

    this.dedicatedServerStorage = null;
    this.state = CartoMinecraftState.none;

    this._dsDeployBehaviorPacksFolder = null;

    this.updateStatus();
  }

  async updateStatus() {
    const result = await AppServiceProxy.sendAsync(AppServiceProxyCommands.getDedicatedServerStatus, "");

    if (result) {
      let resultNum = -1;
      try {
        resultNum = parseInt(result);
      } catch (e) {}

      if (resultNum >= 0) {
        if (resultNum === 1) {
          this.notifyStateChanged(CartoMinecraftState.stopped);
        } else if (resultNum === 2) {
          this.notifyStateChanged(CartoMinecraftState.initializing);
        } else if (resultNum === 3) {
          this.notifyStateChanged(CartoMinecraftState.preparing);
        } else if (resultNum === 4) {
          this.notifyStateChanged(CartoMinecraftState.starting);
        } else if (resultNum === 5) {
          this.notifyStateChanged(CartoMinecraftState.started);
        }
      }
    }

    return this.state;
  }

  async prepare(force?: boolean) {}

  processExternalMessage(command: string, data: string) {
    switch (command) {
      case "dedicatedServerStarted":
        this.notifyStateChanged(CartoMinecraftState.started);

        if (!this._carto.successfullyStartedMinecraftServer) {
          this._carto.successfullyStartedMinecraftServer = true;
          this._carto.save();
        }

        break;

      case "dedicatedServerRefreshed":
        this.notifyRefreshed();
        break;

      case "dedicatedServerStopped":
        this.notifyStateChanged(CartoMinecraftState.stopped);
        break;

      case "dedicatedServerGameEvents":
        this.notifyGameEvents(data);
        break;

      case "dedicatedServerMessage":
        this._carto.notifyStatusUpdate("Server: " + data);
        break;

      case "dedicatedServerError":
        this._carto.notifyStatusUpdate("Server Error: " + data);
        break;
    }
  }

  async initialize() {
    await this.start();
  }

  get dedicatedServerBehaviorPacksFolder(): IFolder | null {
    return this._dsDeployBehaviorPacksFolder;
  }

  private notifyGameEvents(data: string) {
    let obj = undefined;

    try {
      obj = JSON.parse(data);
    } catch (e) {}

    if (!obj || !obj.length) {
      return;
    }

    for (let i = 0; i < obj.length; i++) {
      const event = obj[i];

      this._gameStateManager?.handleEvent(event);
    }
  }

  private _updateDedicatedServerStorage() {
    if (
      this._carto.ensureLocalFolder === undefined ||
      !AppServiceProxy.hasAppService ||
      this._carto.dedicatedServerPath === undefined
    ) {
      return;
    }

    const folder = this._carto.ensureLocalFolder(this._carto.dedicatedServerPath);

    this.dedicatedServerStorage = folder.storage;

    if (this.dedicatedServerStorage != null) {
      this._dsDeployBehaviorPacksFolder =
        this.dedicatedServerStorage.rootFolder.ensureFolder("development_behavior_packs");
    } else {
      this._dsDeployBehaviorPacksFolder = null;
    }
  }

  public notifyStateChanged(newVal: CartoMinecraftState) {
    this.state = newVal;

    this._onStateChanged.dispatch(this, newVal);
  }

  public notifyRefreshed(newVal?: CartoMinecraftState) {
    if (newVal) {
      this.state = newVal;
    }

    this._onRefreshed.dispatch(this, this.state);
  }

  async start() {
    const path = this.getDedicatedServerSyntax();

    this.notifyStateChanged(CartoMinecraftState.starting);

    await AppServiceProxy.sendAsync(AppServiceProxyCommands.startDedicatedServer, path);
  }

  async prepareDedicatedServer(project: Project) {
    await this.deploy();
    return await this.deployDedicatedServerWorld(project);
  }

  async restartDedicatedServer(project: Project) {
    await this.stop();

    await this.prepareDedicatedServer(project);

    await this.start();
  }

  canPrepare() {
    return true;
  }

  async prepareAndStart(push: MinecraftPush) {
    let worldName = undefined;

    if (this._project) {
      worldName = await this.prepareDedicatedServer(this._project);
    }

    await this.start();

    return {
      type: PrepareAndStartResultType.started,
      worldName: worldName,
    };
  }

  async deploy() {
    if (this._carto.ensureLocalFolder == null) {
      throw new Error("This instance doesn't support deployment");
    }

    if (!this._project) {
      return;
    }

    const folderPath = await AppServiceProxy.sendAsync(AppServiceProxyCommands.getDedicatedServerProjectDeployDir, "");

    const deployFolder = await this._carto.ensureLocalFolder(folderPath);

    const deployFolderExists = deployFolder;

    if (deployFolderExists) {
      await ProjectTools.deployProject(this._carto, this._project, deployFolder.storage, deployFolder);
    }
  }

  async runCommand(command: string) {
    const result = await AppServiceProxy.sendAsync(AppServiceProxyCommands.dedicatedServerCommand, command);

    return result;
  }

  async deployDedicatedServerWorld(project: Project) {
    if (this.dedicatedServerStorage === null) {
      return;
    }

    const name = project.name + "_mct";
    const worldFolder = this.dedicatedServerStorage.rootFolder.ensureFolder("worlds").ensureFolder(name);

    await worldFolder.ensureExists();

    // Log.debugAlert("Exporting folder to '" + worldFolder.storageRelativePath + "'");
    await ProjectExporter.syncFlatPackRefWorldTo(this._carto, project, worldFolder, name);

    /*
      name = project.name + "FPAA";
    worldFolder = this.dedicatedServerStorage.rootFolder.ensureFolder("worlds").ensureFolder(name);

    await worldFolder.ensureExists();

    await ProjectExporter.syncFlatPackRefWorldTo(this._carto, project, worldFolder, name);
    const spm = new ServerPropertiesManager();

    spm.serverFolder = this.dedicatedServerStorage.rootFolder;
    spm.levelName = name;
    await spm.writeFile();*/

    await worldFolder.saveAll();

    return name;
  }

  getDedicatedServerSyntax() {
    if (!this._carto.worldSettings) {
      Log.debugAlert("World settings are not defined.");
      throw new Error();
    }

    if (
      this._carto.dedicatedServerMode !== DedicatedServerMode.auto &&
      (this._carto.dedicatedServerPath === null || this._carto.dedicatedServerPath === undefined)
    ) {
      Log.debugAlert("Server folder path is not defined, and the path cannot be set.");
      throw new Error();
    }

    let path = this._carto.dedicatedServerPath;

    if (!path) {
      path = "";
    }

    let worldSettings: IWorldSettings = this._carto.worldSettings;

    if (this._project && this._project.worldSettings) {
      if (this._project.worldSettings.useCustomSettings) {
        worldSettings = this._project.worldSettings;
      }
    }

    if (!worldSettings.name) {
      worldSettings.name = "world";
    }

    const mess: IMinecraftStartMessage = {
      path: Utilities.ensureEndsWithBackSlash(path),
      iagree: this._carto.iAgreeToTheMinecraftEndUserLicenseAgreementAndPrivacyPolicyAtMinecraftDotNetSlashTerms
        ? true
        : false,
      mode: this._carto.dedicatedServerMode,
      track: this._carto.processHostedMinecraftTrack,
      backupContainerPath: "",
      worldSettings: worldSettings,
    };

    return JSON.stringify(mess);
  }

  async stop() {
    const path = this.getDedicatedServerSyntax();

    this.notifyStateChanged(CartoMinecraftState.stopping);

    await AppServiceProxy.sendAsync(AppServiceProxyCommands.stopDedicatedServer, path);
  }
}
