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
import DedicatedServer from "./DedicatedServer";
import VirtualFolderStorage from "../storage/VirtualFolderStorage";

export default class ServerMinecraft implements IMinecraft {
  private _creatorTools: CreatorTools;

  private _dedicatedServer?: DedicatedServer;

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

  constructor(creatorTools: CreatorTools, _dedicatedServer: DedicatedServer) {
    this._creatorTools = creatorTools;
    this._dedicatedServer = _dedicatedServer;

    this._dedicatedServer.onServerStarted.subscribe(this._onServerStarted.bind(this));
    this._dedicatedServer.onServerStopped.subscribe(this._onServerStopped.bind(this));

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

  private async _onServerStarted() {
    this.notifyStateChanged(CreatorToolsMinecraftState.started);

    if (!this._creatorTools.successfullyStartedMinecraftServer) {
      this._creatorTools.successfullyStartedMinecraftServer = true;
      this._creatorTools.save();
    }

    // Initialize world content storage when server starts
    await this._initWorldContentStorage();
  }

  /**
   * Initialize the worldContentStorage with a VirtualFolderStorage that maps
   * the dedicated server's behavior_packs, resource_packs, and world folders.
   */
  private async _initWorldContentStorage() {
    if (!this._dedicatedServer) {
      return;
    }

    await this._dedicatedServer.ensureServerFolders();

    const mappings = [];

    const behaviorPacksFolder = this._dedicatedServer.behaviorPacksFolder;
    if (behaviorPacksFolder) {
      mappings.push({ virtualName: "behavior_packs", realFolder: behaviorPacksFolder });
    }

    const resourcePacksFolder = this._dedicatedServer.resourcePacksFolder;
    if (resourcePacksFolder) {
      mappings.push({ virtualName: "resource_packs", realFolder: resourcePacksFolder });
    }

    const worldFolder = this._dedicatedServer.defaultWorldFolder;
    if (worldFolder) {
      mappings.push({ virtualName: "world", realFolder: worldFolder });
    }

    if (mappings.length > 0) {
      this.worldContentStorage = new VirtualFolderStorage(mappings);
      Log.verbose("ServerMinecraft: Initialized worldContentStorage with " + mappings.length + " mappings");
    }
  }

  /**
   * Lazily create a Project wrapper for the worldContentStorage.
   */
  async ensureWorldProject(): Promise<Project | undefined> {
    if (this.worldProject) {
      return this.worldProject;
    }

    if (!this.worldContentStorage) {
      await this._initWorldContentStorage();
    }

    if (!this.worldContentStorage) {
      return undefined;
    }

    this.worldProject = new Project(this._creatorTools, "World Content", null);
    this.worldProject.setProjectFolder(this.worldContentStorage.rootFolder);

    return this.worldProject;
  }

  private _onServerStopped() {
    this.notifyStateChanged(CreatorToolsMinecraftState.stopped);
  }

  processExternalMessage(command: string, data: string) {}

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

    // For project-based debugging, default transientWorld to true for fresh worlds each run
    // (only if not explicitly set by user)
    if (this._project && worldSettings.transientWorld === undefined) {
      worldSettings = { ...worldSettings, transientWorld: true };
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
