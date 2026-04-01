import CreatorTools, { CreatorToolsMinecraftErrorStatus, CreatorToolsMinecraftState } from "../app/CreatorTools";
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
import { DedicatedServerMode } from "../app/ICreatorToolsData";
import { IMinecraftStartMessage } from "../app/IMinecraftStartMessage";
import { IWorldSettings } from "../minecraft/IWorldSettings";
import IActionSetData from "../actions/IActionSetData";
import { StatusTopic } from "../app/Status";
import {
  IDebugStatsNotificationBody,
  IDebugConnectedNotificationBody,
  IDebugDisconnectedNotificationBody,
  IDebugPausedNotificationBody,
  IDebugResumedNotificationBody,
  IDebugProfilerStateNotificationBody,
  IProfilerCaptureNotificationBody,
} from "../local/IServerNotification";

export default class ProcessHostedMinecraft implements IMinecraft {
  private _creatorTools: CreatorTools;

  private _project: Project | undefined;
  private _gameStateManager: GameStateManager;
  errorStatus?: CreatorToolsMinecraftErrorStatus;
  errorMessage?: string;

  state: CreatorToolsMinecraftState;
  dedicatedServerStorage: IStorage | null;
  private _dsDeployBehaviorPacksFolder: IFolder | null;

  worldFolder: IFolder | undefined;
  projectFolder: IFolder | undefined;
  worldContentStorage: IStorage | undefined;
  worldProject: Project | undefined;

  private _onWorldStorageReady = new EventDispatcher<IMinecraft, IFolder>();
  private _onProjectStorageReady = new EventDispatcher<IMinecraft, IFolder>();
  private _onMessage = new EventDispatcher<IMinecraft, IMinecraftMessage>();
  private _onStateChanged = new EventDispatcher<IMinecraft, CreatorToolsMinecraftState>();
  private _onRefreshed = new EventDispatcher<IMinecraft, CreatorToolsMinecraftState>();

  // Debug event dispatchers for IPC-bridged debug data
  private _onDebugConnected = new EventDispatcher<IMinecraft, IDebugConnectedNotificationBody>();
  private _onDebugDisconnected = new EventDispatcher<IMinecraft, IDebugDisconnectedNotificationBody>();
  private _onDebugStats = new EventDispatcher<IMinecraft, IDebugStatsNotificationBody>();
  private _onDebugPaused = new EventDispatcher<IMinecraft, IDebugPausedNotificationBody>();
  private _onDebugResumed = new EventDispatcher<IMinecraft, IDebugResumedNotificationBody>();
  private _onDebugProfilerState = new EventDispatcher<IMinecraft, IDebugProfilerStateNotificationBody>();
  private _onProfilerCapture = new EventDispatcher<IMinecraft, IProfilerCaptureNotificationBody>();

  public get onWorldFolderReady() {
    return this._onWorldStorageReady.asEvent();
  }

  public get onProjectFolderReady() {
    return this._onProjectStorageReady.asEvent();
  }

  public get onDebugConnected() {
    return this._onDebugConnected.asEvent();
  }

  public get onDebugDisconnected() {
    return this._onDebugDisconnected.asEvent();
  }

  public get onDebugStats() {
    return this._onDebugStats.asEvent();
  }

  public get onDebugPaused() {
    return this._onDebugPaused.asEvent();
  }

  public get onDebugResumed() {
    return this._onDebugResumed.asEvent();
  }

  public get onDebugProfilerState() {
    return this._onDebugProfilerState.asEvent();
  }

  public get onProfilerCapture() {
    return this._onProfilerCapture.asEvent();
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

  constructor(creatorTools: CreatorTools) {
    this._creatorTools = creatorTools;
    this._gameStateManager = new GameStateManager(this._creatorTools);

    this.dedicatedServerStorage = null;
    this.state = CreatorToolsMinecraftState.none;

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
          this.notifyStateChanged(CreatorToolsMinecraftState.stopped);
        } else if (resultNum === 2) {
          this.notifyStateChanged(CreatorToolsMinecraftState.initializing);
        } else if (resultNum === 3) {
          this.notifyStateChanged(CreatorToolsMinecraftState.preparing);
        } else if (resultNum === 4) {
          this.notifyStateChanged(CreatorToolsMinecraftState.starting);
        } else if (resultNum === 5) {
          this.notifyStateChanged(CreatorToolsMinecraftState.started);
        }
      }
    }

    return this.state;
  }

  async prepare(force?: boolean) {}

  processExternalMessage(command: string, data: string) {
    switch (command) {
      case "dedicatedServerStarted":
        this.notifyStateChanged(CreatorToolsMinecraftState.started);

        if (!this._creatorTools.successfullyStartedMinecraftServer) {
          this._creatorTools.successfullyStartedMinecraftServer = true;
          this._creatorTools.save();
        }

        this._initWorldFolderOnStart();

        break;

      case "dedicatedServerRefreshed":
        this.notifyRefreshed();
        break;

      case "dedicatedServerStopped":
        this.notifyStateChanged(CreatorToolsMinecraftState.stopped);
        break;

      case "dedicatedServerGameEvents":
        this.notifyGameEvents(data);
        break;

      case "dedicatedServerMessage":
        this._creatorTools.notifyStatusUpdate("Server: " + data, StatusTopic.minecraft);
        break;

      case "dedicatedServerError":
        this._creatorTools.notifyStatusUpdate("Server Error: " + data, StatusTopic.minecraft);
        break;

      case "dedicatedServerDebugConnected":
        try {
          const connBody = JSON.parse(data) as IDebugConnectedNotificationBody;
          this._onDebugConnected.dispatch(this, connBody);
        } catch (e) {
          Log.debug("Failed to parse debugConnected IPC: " + e);
        }
        break;

      case "dedicatedServerDebugDisconnected":
        try {
          const discBody = JSON.parse(data) as IDebugDisconnectedNotificationBody;
          this._onDebugDisconnected.dispatch(this, discBody);
        } catch (e) {
          Log.debug("Failed to parse debugDisconnected IPC: " + e);
        }
        break;

      case "dedicatedServerDebugStats":
        try {
          const statsBody = JSON.parse(data) as IDebugStatsNotificationBody;
          this._onDebugStats.dispatch(this, statsBody);
        } catch (e) {
          Log.debug("Failed to parse debugStats IPC: " + e);
        }
        break;

      case "dedicatedServerDebugPaused":
        try {
          const pauseBody = JSON.parse(data) as IDebugPausedNotificationBody;
          this._onDebugPaused.dispatch(this, pauseBody);
        } catch (e) {
          Log.debug("Failed to parse debugPaused IPC: " + e);
        }
        break;

      case "dedicatedServerDebugResumed":
        try {
          const resumeBody = JSON.parse(data) as IDebugResumedNotificationBody;
          this._onDebugResumed.dispatch(this, resumeBody);
        } catch (e) {
          Log.debug("Failed to parse debugResumed IPC: " + e);
        }
        break;

      case "dedicatedServerDebugProfilerState":
        try {
          const profStateBody = JSON.parse(data) as IDebugProfilerStateNotificationBody;
          this._onDebugProfilerState.dispatch(this, profStateBody);
        } catch (e) {
          Log.debug("Failed to parse debugProfilerState IPC: " + e);
        }
        break;

      case "dedicatedServerProfilerCapture":
        try {
          const captBody = JSON.parse(data) as IProfilerCaptureNotificationBody;
          this._onProfilerCapture.dispatch(this, captBody);
        } catch (e) {
          Log.debug("Failed to parse profilerCapture IPC: " + e);
        }
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
      this._creatorTools.ensureLocalFolder === undefined ||
      !AppServiceProxy.hasAppService ||
      this._creatorTools.dedicatedServerPath === undefined
    ) {
      return;
    }

    const folder = this._creatorTools.ensureLocalFolder(this._creatorTools.dedicatedServerPath);

    this.dedicatedServerStorage = folder.storage;

    if (this.dedicatedServerStorage != null) {
      this._dsDeployBehaviorPacksFolder =
        this.dedicatedServerStorage.rootFolder.ensureFolder("development_behavior_packs");
    } else {
      this._dsDeployBehaviorPacksFolder = null;
    }
  }

  /**
   * Send a debug pause command to the main process.
   */
  async debugPause(): Promise<void> {
    await AppServiceProxy.sendAsync(AppServiceProxyCommands.debugPause, "");
  }

  /**
   * Send a debug resume command to the main process.
   */
  async debugResume(): Promise<void> {
    await AppServiceProxy.sendAsync(AppServiceProxyCommands.debugResume, "");
  }

  /**
   * Send a debug start profiler command to the main process.
   */
  async debugStartProfiler(): Promise<void> {
    await AppServiceProxy.sendAsync(AppServiceProxyCommands.debugStartProfiler, "");
  }

  /**
   * Send a debug stop profiler command to the main process.
   */
  async debugStopProfiler(): Promise<void> {
    await AppServiceProxy.sendAsync(AppServiceProxyCommands.debugStopProfiler, "");
  }

  /**
   * When the dedicated server starts, query the main process for the world folder path
   * via IPC so that the world map and debug stats panels appear in MinecraftDisplay
   * immediately, without requiring a deploy operation first.
   */
  private async _initWorldFolderOnStart() {
    if (this.worldFolder) {
      return; // Already set from a previous deploy
    }

    // Ask the main process for the world folder path - this works regardless of
    // whether dedicatedServerPath is set (auto mode vs manual mode)
    const worldPath = await AppServiceProxy.sendAsync(AppServiceProxyCommands.getDedicatedServerWorldDeployDir, "");

    if (worldPath && worldPath.length > 0 && this._creatorTools.ensureLocalFolder) {
      const worldFolder = this._creatorTools.ensureLocalFolder(worldPath);

      this.worldFolder = worldFolder;
      this._onWorldStorageReady.dispatch(this, worldFolder);
    }
  }

  public notifyStateChanged(newVal: CreatorToolsMinecraftState) {
    this.state = newVal;

    this._onStateChanged.dispatch(this, newVal);
  }

  public notifyRefreshed(newVal?: CreatorToolsMinecraftState) {
    if (newVal) {
      this.state = newVal;
    }

    this._onRefreshed.dispatch(this, this.state);
  }

  async start() {
    const path = this.getDedicatedServerSyntax();

    this.notifyStateChanged(CreatorToolsMinecraftState.starting);

    await AppServiceProxy.sendAsync(AppServiceProxyCommands.startDedicatedServer, path);
  }

  async prepareDedicatedServer(project: Project) {
    await this.syncWithDeployment();
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

  async syncWithDeployment() {
    if (this._creatorTools.ensureLocalFolder == null) {
      throw new Error("This instance doesn't support deployment");
    }

    if (!this._project) {
      return;
    }

    const folderPath = await AppServiceProxy.sendAsync(AppServiceProxyCommands.getDedicatedServerProjectDeployDir, "");

    if (folderPath && folderPath.length > 0) {
      const deployFolder = this._creatorTools.ensureLocalFolder(folderPath);

      const deployFolderExists = deployFolder;

      if (deployFolderExists) {
        await ProjectExporter.deployProject(this._creatorTools, this._project, deployFolder);
      }
    }
  }

  async runCommand(command: string) {
    const result = await AppServiceProxy.sendAsync(AppServiceProxyCommands.dedicatedServerCommand, command);

    return result;
  }

  async runActionSet(actionSet: IActionSetData): Promise<any> {
    return undefined;
  }

  async deployDedicatedServerWorld(project: Project) {
    if (this.dedicatedServerStorage === null) {
      return;
    }

    const name = project.name + "_mct";
    const worldFolder = this.dedicatedServerStorage.rootFolder.ensureFolder("worlds").ensureFolder(name);

    await worldFolder.ensureExists();

    // Log.debugAlert("Exporting folder to '" + worldFolder.storageRelativePath + "'");
    await ProjectExporter.syncFlatPackRefWorldTo(this._creatorTools, project, worldFolder, name);

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

    this.worldFolder = worldFolder;
    this._onWorldStorageReady.dispatch(this, worldFolder);

    return name;
  }

  getDedicatedServerSyntax() {
    if (!this._creatorTools.worldSettings) {
      Log.debugAlert("World settings are not defined.");
      throw new Error();
    }

    if (
      this._creatorTools.dedicatedServerMode !== DedicatedServerMode.auto &&
      (this._creatorTools.dedicatedServerPath === null || this._creatorTools.dedicatedServerPath === undefined)
    ) {
      Log.debugAlert("Server folder path is not defined, and the path cannot be set.");
      throw new Error();
    }

    let path = this._creatorTools.dedicatedServerPath;

    if (!path) {
      path = "";
    }

    let worldSettings: IWorldSettings = this._creatorTools.worldSettings;

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
      iagree: this._creatorTools
        .iAgreeToTheMinecraftEndUserLicenseAgreementAndPrivacyStatementAtMinecraftDotNetSlashEula
        ? true
        : false,
      mode: this._creatorTools.dedicatedServerMode,
      track: this._creatorTools.track,
      worldSettings: worldSettings,
    };

    return JSON.stringify(mess);
  }

  async stop() {
    const path = this.getDedicatedServerSyntax();

    this.notifyStateChanged(CreatorToolsMinecraftState.stopping);

    await AppServiceProxy.sendAsync(AppServiceProxyCommands.stopDedicatedServer, path);
  }
}
