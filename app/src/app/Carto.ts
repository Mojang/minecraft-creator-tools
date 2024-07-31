// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "../storage/IFile";
import IFolder from "../storage/IFolder";
import IStorage from "../storage/IStorage";
import ICartoData, {
  CartoEditorViewMode,
  RemoteServerAccessLevel,
  MinecraftFlavor,
  DedicatedServerMode,
  MinecraftGameConnectionMode,
  MinecraftTrack,
  WindowState,
} from "./ICartoData";
import Project from "./Project";
import { EventDispatcher } from "ste-events";
import { ProjectFocus, ProjectScriptLanguage } from "./IProjectData";
import IStatus, { StatusTopic, StatusType } from "./Status";
import StorageUtilities from "../storage/StorageUtilities";
import Utilities from "../core/Utilities";
import GitHubManager from "../github/GitHubManager";
import IGallery from "./IGallery";
import axios from "axios";
import Log from "../core/Log";
import AppServiceProxy, { AppServiceProxyCommands } from "../core/AppServiceProxy";
import CommandRunner from "./CommandRunner";
import ILocalUtilities from "../local/ILocalUtilities";
import IMinecraft from "./IMinecraft";
import CartoApp, { HostType } from "./CartoApp";
import MinecraftPush from "./MinecraftPush";
import { GameType, Generator } from "../minecraft/WorldLevelDat";
import { BackupType } from "../minecraft/IWorldSettings";
import Package from "./Package";
import CommandRegistry from "./CommandRegistry";
import ZipStorage from "../storage/ZipStorage";
import { MaxItemTypes, ProjectItemType } from "./IProjectItemData";
import DeploymentStorageMinecraft from "./DeploymentStorageMinecraft";

export enum CartoMinecraftState {
  none = 0,
  initializing = 1, // for phserver, this is starting to auto-download
  // for remote server, this is authenticating
  // for web sockets, this is opening up the web socket to receive connections from a client
  initialized = 2,
  preparing = 3,
  prepared = 4,
  starting = 5, // for phserver, the server is starting
  // for remote server, this is creating a session on a socket
  // for web sockets, note you have to wait for external connections to come in.
  started = 6, // for phserver, the server is up and ready
  // for remote server, the session is ready and initial status has been established
  // for web sockets, an external client has connected in
  stopping = 7,
  stopped = 8,
  error = 9,
  newMinecraft = 10,
  disconnected = 11,
}

export enum CartoMinecraftErrorStatus {
  none = 0,
  actionInProgress = 1,
  serverUnavailable = 2,
  serverError = 3,
  loginFailed = 4,
  generalError = 5,
  configuration = 6,
}

export const SidePaneMaxWidth = 880;
export const SidePaneMinWidth = 280;

export default class Carto {
  private _isLoaded: boolean;
  private _userGitHub: GitHubManager | undefined;
  private _anonGitHub: GitHubManager | undefined;

  contentRoot = "";

  processHostedMinecraft: IMinecraft | undefined;
  deploymentStorageMinecraft: IMinecraft | undefined;
  gameMinecraft: IMinecraft | undefined;
  remoteMinecraft: IMinecraft | undefined;
  activeMinecraft: IMinecraft | undefined;

  prefsStorage: IStorage;
  projectsStorage: IStorage;
  deploymentStorage: IStorage | null;
  previewDeploymentStorage: IStorage | null;
  worldStorage: IStorage | null;
  packStorage: IStorage | null;
  workingStorage: IStorage | null;

  localFolderExists: ((path: string) => Promise<boolean>) | undefined;
  localFileExists: ((path: string) => Promise<boolean>) | undefined;
  ensureLocalFolder: ((path: string) => IFolder) | undefined;
  createMinecraft: ((flavor: MinecraftFlavor, carto: Carto) => IMinecraft | undefined) | undefined;
  canCreateMinecraft: ((flavor: MinecraftFlavor) => boolean) | undefined;

  private _deployBehaviorPacksFolder: IFolder | null;
  private _deployResourcePacksFolder: IFolder | null;

  private _pendingPackLoadRequests: ((value: unknown) => void)[] = [];
  private _arePacksLoading: boolean = false;

  local: ILocalUtilities | undefined;
  #data: ICartoData;
  projects: Project[];
  status: IStatus[];
  activeOperations: IStatus[];

  packs?: Package[];

  mcLogs: { [name: string]: string[] | undefined } = {};

  _gallery?: IGallery;
  _galleryLoaded: boolean = false;
  isDeployingToComMojang: boolean = false;

  hasAttemptedPersistentBrowserStorageSwitch: boolean = false;

  private _onDeploymentStorageChanged = new EventDispatcher<Carto, IStorage | null>();
  private _onMinecraftStateChanged = new EventDispatcher<IMinecraft, CartoMinecraftState>();
  private _onMinecraftRefreshed = new EventDispatcher<IMinecraft, CartoMinecraftState>();
  private _onPropertyChanged = new EventDispatcher<Carto, string>();
  private _onLoaded = new EventDispatcher<Carto, Carto>();
  private _onStatusAdded = new EventDispatcher<Carto, IStatus>();
  private _onStatusAddedAsync: ((carto: Carto, status: IStatus) => Promise<void>)[] = [];
  private _onGalleryLoaded = new EventDispatcher<Carto, IGallery | undefined>();

  public get isLoaded() {
    return this._isLoaded;
  }

  public get collapsedTypes() {
    if (!this.#data.collapsedTypes) {
      this.#data.collapsedTypes = [];
    }

    return this.#data.collapsedTypes;
  }

  public set collapsedTypes(newCollapsedTypes: number[]) {
    this.#data.collapsedTypes = newCollapsedTypes;
  }

  public get worldSettings() {
    return this.#data.worldSettings;
  }

  public get editorWorldSettings() {
    return this.#data.editorWorldSettings;
  }

  public get activeMinecraftState() {
    if (this.activeMinecraft === undefined) {
      return CartoMinecraftState.none;
    }

    return this.activeMinecraft.state;
  }

  public get onMinecraftStateChanged() {
    return this._onMinecraftStateChanged.asEvent();
  }

  public get onDeploymentStorageChanged() {
    return this._onDeploymentStorageChanged.asEvent();
  }

  public get formatBeforeSave() {
    if (this.#data.formatBeforeSave === undefined) {
      return true;
    }

    return this.#data.formatBeforeSave;
  }

  public set formatBeforeSave(newValue: boolean) {
    this.#data.formatBeforeSave = newValue;
  }

  public get preferredTextSize() {
    if (this.#data.preferredTextSize === undefined) {
      return 16;
    }

    return this.#data.preferredTextSize;
  }

  public set preferredTextSize(newValue: number) {
    this.#data.preferredTextSize = newValue;
  }

  public get itemSidePaneWidth() {
    if (this.#data.itemSidePaneWidth === undefined) {
      return 300;
    }

    if (this.#data.itemSidePaneWidth < SidePaneMinWidth) {
      return SidePaneMinWidth;
    }

    if (this.#data.itemSidePaneWidth > SidePaneMaxWidth) {
      return SidePaneMaxWidth;
    }

    return this.#data.itemSidePaneWidth;
  }

  public set itemSidePaneWidth(newValue: number) {
    this.#data.itemSidePaneWidth = newValue;
  }

  public get preferredSuite() {
    return this.#data.preferredSuite;
  }

  public set preferredSuite(newValue: number | undefined) {
    this.#data.preferredSuite = newValue;
  }

  public get processHostedMinecraftTrack() {
    return this.#data.processHostedMinecraftTrack;
  }

  public set processHostedMinecraftTrack(newMinecraftTrack: MinecraftTrack | undefined) {
    if (newMinecraftTrack !== this.#data.processHostedMinecraftTrack) {
      this.#data.processHostedMinecraftTrack = newMinecraftTrack;
    }
  }

  public get useEditor() {
    return this.#data.useEditor;
  }

  public set useEditor(newUseEditor: boolean | undefined) {
    if (newUseEditor !== this.#data.useEditor) {
      this.#data.useEditor = newUseEditor;
    }
  }

  public get windowX() {
    if (this.#data.windowX === undefined) {
      return 0;
    }

    return this.#data.windowX;
  }

  public set windowX(newVal: number | undefined) {
    this.#data.windowX = newVal;
  }
  public get windowY() {
    if (this.#data.windowY === undefined) {
      return 0;
    }

    return this.#data.windowY;
  }

  public set windowY(newVal: number | undefined) {
    this.#data.windowY = newVal;
  }

  public get windowWidth() {
    if (this.#data.windowWidth === undefined) {
      return 1200;
    }

    return this.#data.windowWidth;
  }

  public set windowWidth(newVal: number | undefined) {
    this.#data.windowWidth = newVal;
  }

  public get windowHeight() {
    if (this.#data.windowHeight === undefined) {
      return 900;
    }
    return this.#data.windowHeight;
  }

  public set windowHeight(newVal: number | undefined) {
    this.#data.windowHeight = newVal;
  }

  public get windowSlot() {
    if (this.#data.windowSlot === undefined) {
      return 0;
    }

    return this.#data.windowSlot;
  }

  public set windowSlot(newVal: number | undefined) {
    this.#data.windowSlot = newVal;
  }

  get creator(): string | undefined {
    return this.#data.creator;
  }

  set creator(newCreator: string | undefined) {
    if (this.#data.creator !== newCreator) {
      this.#data.creator = newCreator;

      this._onPropertyChanged.dispatch(this, "creator");
    }
  }

  public get windowState() {
    if (this.#data.windowState === undefined) {
      return WindowState.regular;
    }

    return this.#data.windowState;
  }

  public set windowState(newVal: number | undefined) {
    this.#data.windowState = newVal;
  }

  public get lastActiveMinecraftFlavor() {
    return this.#data.lastActiveMinecraftFlavor;
  }

  public set lastActiveMinecraftFlavor(lastActiveMinecraftFlavor: MinecraftFlavor | undefined) {
    if (lastActiveMinecraftFlavor !== this.#data.lastActiveMinecraftFlavor) {
      this.#data.lastActiveMinecraftFlavor = lastActiveMinecraftFlavor;
    }
  }

  public get remoteServerUrl() {
    if (this.#data.remoteServerUrl === undefined && CartoApp.baseUrl) {
      return Utilities.getBaseUrl(CartoApp.baseUrl);
    }

    return this.#data.remoteServerUrl;
  }

  public get fullRemoteServerUrl() {
    if (!this.remoteServerUrl) {
      return undefined;
    }

    let url = this.remoteServerUrl.toLowerCase();

    if (!url.startsWith("http") && url.indexOf("//") < 0) {
      if (url.indexOf("localhost") >= 0) {
        url = "http://" + url;
      } else {
        url = "https://" + url;
      }
    }

    url = Utilities.ensureEndsWithSlash(url);

    return url;
  }

  public set remoteServerUrl(newPath: string | undefined) {
    if (newPath !== this.#data.remoteServerUrl) {
      this.#data.remoteServerUrl = newPath;
    }
  }

  public get iAgreeToTheMinecraftEndUserLicenseAgreementAndPrivacyPolicyAtMinecraftDotNetSlashTerms() {
    return this.#data.iAgreeToTheMinecraftEndUserLicenseAgreementAndPrivacyPolicyAtMinecraftDotNetSlashTerms;
  }

  public set iAgreeToTheMinecraftEndUserLicenseAgreementAndPrivacyPolicyAtMinecraftDotNetSlashTerms(
    newPort: boolean | undefined
  ) {
    this.#data.iAgreeToTheMinecraftEndUserLicenseAgreementAndPrivacyPolicyAtMinecraftDotNetSlashTerms = newPort;
  }

  public get dedicatedServerSlotCount() {
    return this.#data.dedicatedServerSlotCount;
  }

  public set dedicatedServerSlotCount(newPort: number | undefined) {
    this.#data.dedicatedServerSlotCount = newPort;
  }

  public get dedicatedServerMode() {
    if (this.#data.dedicatedServerMode === undefined) {
      return DedicatedServerMode.auto;
    }

    return this.#data.dedicatedServerMode;
  }

  public set dedicatedServerMode(newMode: DedicatedServerMode | undefined) {
    this.#data.dedicatedServerMode = newMode;
  }

  public get dedicatedServerPath() {
    return this.#data.dedicatedServerPath;
  }

  public set minecraftGameMode(newMode: MinecraftGameConnectionMode | undefined) {
    this.#data.webSocketMode = newMode;
  }

  public get minecraftGameMode() {
    return this.#data.webSocketMode;
  }

  public set dedicatedServerPath(newPath: string | undefined) {
    this.#data.dedicatedServerPath = newPath;
  }

  public get remoteServerPort() {
    if (this.#data.remoteServerPort === undefined) {
      return 0;
    }

    return this.#data.remoteServerPort;
  }

  public set remoteServerPort(newPort: number | undefined) {
    this.#data.remoteServerPort = newPort;
  }

  public get remoteServerAccessLevel() {
    return this.#data.remoteServerAccessLevel;
  }

  public set remoteServerAccessLevel(newAccessLevel: RemoteServerAccessLevel | undefined) {
    this.#data.remoteServerAccessLevel = newAccessLevel;
  }

  public get remoteServerPasscode() {
    return this.#data.remoteServerPasscode;
  }

  public set remoteServerPasscode(newPath: string | undefined) {
    this.#data.remoteServerPasscode = newPath;
  }

  public get remoteServerAuthToken() {
    return this.#data.remoteServerAuthToken;
  }

  public set remoteServerAuthToken(newPath: string | undefined) {
    this.#data.remoteServerAuthToken = newPath;
  }

  public get editorViewMode() {
    if (this.#data.editorViewMode === undefined) {
      return CartoEditorViewMode.itemsOnLeft;
    }

    return this.#data.editorViewMode;
  }

  public set editorViewMode(newViewMode: CartoEditorViewMode) {
    this.#data.editorViewMode = newViewMode;
  }

  public get gallery() {
    return this._gallery;
  }

  public get galleryLoaded() {
    return this._galleryLoaded;
  }

  public get userGitHub(): GitHubManager {
    if (this._userGitHub === undefined) {
      this._userGitHub = new GitHubManager(this.prefsStorage.rootFolder.ensureFile("github.json"));
    }

    return this._userGitHub;
  }

  public get anonGitHub(): GitHubManager {
    if (this._anonGitHub === undefined) {
      this._anonGitHub = new GitHubManager();
    }

    return this._anonGitHub;
  }

  public get onLoaded() {
    return this._onLoaded.asEvent();
  }

  public get onGalleryLoaded() {
    return this._onGalleryLoaded.asEvent();
  }

  public get onPropertyChanged() {
    return this._onPropertyChanged.asEvent();
  }

  public get onStatusAdded() {
    return this._onStatusAdded.asEvent();
  }

  public get successfullyConnectedWebSocketToMinecraft() {
    if (this.#data.successfullyConnectedWebSocketToMinecraft === undefined) {
      return false;
    }

    return this.#data.successfullyConnectedWebSocketToMinecraft;
  }

  public set successfullyConnectedWebSocketToMinecraft(newValue: boolean) {
    this.#data.successfullyConnectedWebSocketToMinecraft = newValue;
  }

  public get successfullyStartedMinecraftServer() {
    if (this.#data.successfullyStartedMinecraftServer === undefined) {
      return false;
    }

    return this.#data.successfullyStartedMinecraftServer;
  }

  public set successfullyStartedMinecraftServer(newValue: boolean) {
    this.#data.successfullyStartedMinecraftServer = newValue;
  }

  public get successfullyConnectedToRemoteMinecraft() {
    if (this.#data.successfullyConnectedToRemoteMinecraft === undefined) {
      return false;
    }

    return this.#data.successfullyConnectedToRemoteMinecraft;
  }

  public set successfullyConnectedToRemoteMinecraft(newValue: boolean) {
    this.#data.successfullyConnectedToRemoteMinecraft = newValue;
  }

  public get defaultMinecraftFlavor() {
    if (this.#data.lastActiveMinecraftFlavor === undefined) {
      if (CartoApp.isAppServiceWeb) {
        return MinecraftFlavor.processHostedProxy;
      } else {
        return MinecraftFlavor.remote;
      }
    }

    return this.#data.lastActiveMinecraftFlavor;
  }

  public subscribeStatusAddedAsync(fn: (carto: Carto, status: IStatus) => Promise<void>) {
    this._onStatusAddedAsync.push(fn);
  }

  public unsubscribeStatusAddedAsync(fn: (carto: Carto, status: IStatus) => Promise<void>) {
    let newStatusAddedArr: ((carto: Carto, status: IStatus) => Promise<void>)[] = [];

    for (let i = 0; i < this._onStatusAddedAsync.length; i++) {
      if (this._onStatusAddedAsync[i] !== fn) {
        newStatusAddedArr.push(this._onStatusAddedAsync[i]);
      }
    }

    this._onStatusAddedAsync = newStatusAddedArr;
  }

  public setMinecraftFlavor(newValue: MinecraftFlavor) {
    this.ensureMinecraft(newValue);
  }

  public get autoStartMinecraft() {
    if (this.#data.autoStartMinecraft === undefined) {
      return true;
    }

    return this.#data.autoStartMinecraft;
  }

  public set autoStartMinecraft(newValue: boolean) {
    this.#data.autoStartMinecraft = newValue;
  }

  get file(): IFile {
    return this.prefsStorage.rootFolder.ensureFile("mctools.json");
  }

  get prefsProjectsFolder(): IFolder {
    return this.prefsStorage.rootFolder.ensureFolder("projects");
  }

  get deployBehaviorPacksFolder(): IFolder | null {
    return this._deployBehaviorPacksFolder;
  }

  get deployResourcePacksFolder(): IFolder | null {
    return this._deployResourcePacksFolder;
  }

  constructor(
    settingsStorage: IStorage,
    projectsStorage: IStorage,
    deploymentsStorage: IStorage | null,
    previewDeploymentsStorage: IStorage | null,
    worldStorage: IStorage | null,
    packStorage: IStorage | null,
    workingStorage: IStorage | null,
    contentRoot: string | null
  ) {
    this.prefsStorage = settingsStorage;
    this.projectsStorage = projectsStorage;
    this.deploymentStorage = deploymentsStorage;
    this.previewDeploymentStorage = previewDeploymentsStorage;
    this.packStorage = packStorage;
    this.worldStorage = worldStorage;
    this.workingStorage = workingStorage;

    this._deployBehaviorPacksFolder = null;
    this._deployResourcePacksFolder = null;

    if (contentRoot) {
      this.contentRoot = contentRoot;
    }

    this._handleMessageFromAppService = this._handleMessageFromAppService.bind(this);
    this._bubbleMinecraftStateChanged = this._bubbleMinecraftStateChanged.bind(this);
    this._bubbleMinecraftRefreshed = this._bubbleMinecraftRefreshed.bind(this);

    AppServiceProxy.onMessage.subscribe(this._handleMessageFromAppService);

    this.#data = {
      successfullyConnectedWebSocketToMinecraft: false,
      successfullyStartedMinecraftServer: false,
      successfullyConnectedToRemoteMinecraft: false,
      autoStartMinecraft: true,
      showScreenOnConnect: true,
      customTools: [],
    };

    // in the case of a Minecraft Http Server self-hosted web page, assume all we want to do is connect back to our server
    if (CartoApp.baseUrl) {
      this.setMinecraftFlavor(MinecraftFlavor.remote);
      this.successfullyConnectedWebSocketToMinecraft = true;
    }

    this._isLoaded = false;
    this.projects = [];
    this.status = [];
    this.activeOperations = [];

    this.updateDeploymentStorage(deploymentsStorage);
  }

  public updateDeploymentStorage(deploymentStorage: IStorage | null) {
    this.deploymentStorage = deploymentStorage;

    if (this.deploymentStorage != null) {
      this._deployBehaviorPacksFolder = this.deploymentStorage.rootFolder.ensureFolder("development_behavior_packs");
      this._deployResourcePacksFolder = this.deploymentStorage.rootFolder.ensureFolder("development_resource_packs");
    } else {
      this._deployBehaviorPacksFolder = null;
      this._deployResourcePacksFolder = null;
    }

    this._onDeploymentStorageChanged.dispatch(this, deploymentStorage);
  }

  public initializeWorldSettings() {
    if (this.#data.worldSettings === undefined) {
      this.#data.worldSettings = {
        gameType: GameType.creative,
        generator: Generator.infinite,
        randomSeed: "2000",
        backupType: BackupType.every5Minutes,
        useCustomSettings: false,
        isEditor: false,
        packageReferences: [],
      };

      this.ensureDefaultWorldName();
    }
  }

  private ensureDefaultWorldName() {
    if (this.worldSettings && this.worldSettings.name === undefined) {
      this.worldSettings.name = "world " + Utilities.getDateStr(new Date());
    }
  }

  public initializeEditorWorldSettings() {
    if (this.#data.editorWorldSettings === undefined) {
      this.#data.editorWorldSettings = {
        gameType: GameType.creative,
        generator: Generator.infinite,
        backupType: BackupType.every5Minutes,
        useCustomSettings: false,
        isEditor: true,
        packageReferences: [],
      };

      this.ensureDefaultEditorWorldName();
    }
  }

  private ensureDefaultEditorWorldName() {
    if (this.editorWorldSettings && this.editorWorldSettings.name === undefined) {
      this.editorWorldSettings.name = "editor project " + Utilities.getDateStr(new Date());
    }
  }

  getCustomTool(index: number) {
    if (this.#data.customTools === undefined) {
      this.#data.customTools = [];
    }

    while (this.#data.customTools.length <= index) {
      this.#data.customTools.push({
        name: "",
        type: 0,
        text: undefined,
        lastRunResult: undefined,
      });
    }

    return this.#data.customTools[index];
  }

  get defaultFunction() {
    if (this.#data === undefined || this.#data.defaultFunction === undefined) {
      return "";
    }

    return this.#data.defaultFunction;
  }

  set defaultFunction(newFunction: string) {
    if (this.#data === undefined) {
      return;
    }

    this.#data.defaultFunction = Utilities.makeSafeForJson(newFunction);
  }

  async runCommand(command: string, project?: Project) {
    return await CommandRegistry.main.runCommand(
      {
        carto: this,
        project: project,
        minecraft: this.activeMinecraft,
        host: CartoApp.hostManager,
      },
      command
    );
  }

  async runMinecraftCommand(command: string) {
    if (this.activeMinecraft === undefined) {
      throw new Error("No minecraft active.");
    }

    const result = await this.activeMinecraft.runCommand(command);

    return result;
  }

  async loadPacks() {
    if (!this.packStorage) {
      throw new Error("Could not find pack storage");
    }

    if (this._arePacksLoading) {
      const pendingLoad = this._pendingPackLoadRequests;

      const prom = (resolve: (value: unknown) => void, reject: (reason?: any) => void) => {
        pendingLoad.push(resolve);
      };

      await new Promise(prom);
    } else {
      this._arePacksLoading = true;

      this.packs = [];

      // console.log("Loading packs from '" + this.packStorage.rootFolder.fullPath + "'");
      await this.loadPacksFromFolder(this.packStorage.rootFolder);

      this._arePacksLoading = false;

      const pendingLoad = this._pendingPackLoadRequests;
      this._pendingPackLoadRequests = [];

      for (const prom of pendingLoad) {
        prom(undefined);
      }
    }
  }

  ensureAllTypesCollapsedExcept(itemType: ProjectItemType) {
    const newCollapsedTypes: number[] = [];

    for (let i = 0; i < MaxItemTypes; i++) {
      if (i !== itemType) {
        newCollapsedTypes.push(i);
      }
    }

    this.collapsedTypes = newCollapsedTypes;
  }

  ensureTypeIsCollapsed(itemType: ProjectItemType) {
    for (const itemTypeCollapsed of this.collapsedTypes) {
      if (itemTypeCollapsed === itemType) {
        return;
      }
    }

    this.collapsedTypes.push(itemType);
  }

  ensureTypeIsNotCollapsed(itemType: ProjectItemType) {
    const newCollapsedTypes: number[] = [];

    for (const itemTypeCollapsed of this.collapsedTypes) {
      if (itemTypeCollapsed !== itemType) {
        newCollapsedTypes.push(itemTypeCollapsed);
      }
    }

    this.#data.collapsedTypes = newCollapsedTypes;
  }

  async loadPacksFromFolder(folder: IFolder) {
    await folder.load();

    for (let fileName in folder.files) {
      const file = folder.files[fileName];

      if (file && StorageUtilities.isContainerFile(file.storageRelativePath)) {
        await this.ensurePackForFile(file);
      }
    }
  }

  getPackByName(packName: string, isWorldFocused?: boolean) {
    if (!this.packs) {
      Log.unexpectedUndefined("GPN");
      return;
    }

    for (let i = 0; i < this.packs.length; i++) {
      if (this.packs[i].matches(packName, isWorldFocused)) {
        return this.packs[i];
      }
    }

    return undefined;
  }

  getPackageByNameAndHash(packName: string, hash?: string) {
    if (!this.packs) {
      Log.unexpectedUndefined("GPNH");
      return;
    }

    for (let i = 0; i < this.packs.length; i++) {
      if (this.packs[i].matches(packName, false) && (hash === undefined || hash === this.packs[i].data?.sourceHash)) {
        return this.packs[i];
      }
    }

    return this.getPackByName(packName);
  }

  async ensurePackForFile(file: IFile) {
    const pack = this._ensurePack(file.storageRelativePath);

    await pack.ensureData(this, file);

    return pack;
  }

  _ensurePack(storagePath: string) {
    if (this.packs === undefined) {
      this.packs = [];
    }

    for (let i = 0; i < this.packs.length; i++) {
      if (this.packs[i].storagePath === storagePath) {
        return this.packs[i];
      }
    }

    const pack = new Package(StorageUtilities.getLeafName(storagePath), storagePath);

    this.packs.push(pack);

    return pack;
  }

  _handleMessageFromAppService(command: string, data: string) {
    switch (command) {
      case "externalKeyPress":
        if (data.startsWith("command")) {
          const commandIndex = parseInt(data.substring(7, data.length));

          CommandRunner.runCustomTool(this, commandIndex);
        }
        break;

      case "statusMessage":
        const firstPipe = data.indexOf("|");
        const content = data.substring(firstPipe + 1, data.length);

        try {
          const contentO = JSON.parse(content) as IStatus;

          this.notifyExternalStatus(contentO);
        } catch (e) {}

        break;

      case "mctSavedInAppService":
        this.load(true);
        break;

      case "logFileUpdated":
        try {
          if (data) {
            const firstPipe = data.indexOf("|");

            if (firstPipe > 0) {
              const fileName = data.substring(0, firstPipe);
              const content = data.substring(firstPipe + 1, data.length);

              this._handleLogFileUpdated(fileName, content);
            }
          }
        } catch (e) {
          Log.fail("Error parsing inbound log: " + e);
        }
        break;

      default:
        if (this.deploymentStorageMinecraft) {
          this.deploymentStorageMinecraft.processExternalMessage(command, data);
        }
        if (this.processHostedMinecraft) {
          this.processHostedMinecraft.processExternalMessage(command, data);
        }
        if (this.gameMinecraft) {
          this.gameMinecraft.processExternalMessage(command, data);
        }
        if (this.remoteMinecraft) {
          this.remoteMinecraft.processExternalMessage(command, data);
        }

        break;
    }
  }

  _handleLogFileUpdated(fileName: string, contents: string) {
    if (contents === null || contents === undefined || fileName === null || fileName === undefined) {
      return;
    }

    let arr: string[] | undefined = this.mcLogs[fileName];

    if (arr === undefined) {
      arr = [];
      this.mcLogs[fileName] = arr;
    }

    const logItems = contents.split("\r");

    for (let i = logItems.length - 1; i >= 0; i--) {
      const logItem = logItems[i];

      if (logItem !== undefined && logItem.length > 3) {
        if (!arr.includes(logItem)) {
          arr.push(logItem);
          this.notifyStatusUpdate(logItem);
        }
      }
    }
  }

  async notifyStatusUpdate(message: string, topic?: StatusTopic) {
    const messageCanon = message.trim().toLowerCase();

    if (messageCanon.length > 1) {
      const status = {
        time: new Date(),
        message: message,
        topic: topic,
        type: StatusType.message,
      };

      this.status.push(status);
      await this.callStatusAddedListeners(status);

      this.ensureStatusArrayIsTrimmed();
    }
  }

  private ensureStatusArrayIsTrimmed() {
    if (this.status.length > 10000) {
      const newStatusArr: IStatus[] = [];

      for (let i = this.status.length - 9000; i < this.status.length; i++) {
        newStatusArr.push(this.status[i]);
      }

      this.status = newStatusArr;
    }
  }

  async callStatusAddedListeners(status: IStatus) {
    this._onStatusAdded.dispatch(this, status);

    if (this._onStatusAddedAsync.length > 0) {
      let promises: Promise<void>[] = [];

      for (let i = 0; i < this._onStatusAddedAsync.length; i++) {
        promises.push(this._onStatusAddedAsync[i](this, status));
      }

      await Promise.all(promises);
    }
  }

  notifyExternalStatus(status: IStatus) {
    this.status.push(status);

    if (status.type === StatusType.operationStarted) {
      this.activeOperations.push(status);
    } else if (
      (status.type === StatusType.operationEndedComplete || status.type === StatusType.operationEndedErrors) &&
      status.operationId !== null &&
      status.operationId !== undefined
    ) {
      this.removeOperation(status.operationId);
    }

    this.callStatusAddedListeners(status);

    return status.operationId;
  }

  async notifyOperationStarted(message: string, topic?: StatusTopic): Promise<number> {
    const status: IStatus = {
      time: new Date(),
      message: message,
      type: StatusType.operationStarted,
      topic: topic,
    };

    status.operationId = status.time.getTime();

    this.status.push(status);
    this.activeOperations.push(status);

    this.ensureStatusArrayIsTrimmed();

    await this.callStatusAddedListeners(status);

    return status.operationId;
  }

  async notifyOperationEnded(
    endedOperationId: number,
    message: string,
    topic?: StatusTopic,
    endedWithErrors?: boolean
  ) {
    const status = {
      message: message,
      operationId: endedOperationId,
      type: endedWithErrors ? StatusType.operationEndedErrors : StatusType.operationEndedComplete,
      time: new Date(),
      topic: topic,
    };

    this.status.push(status);

    this.ensureStatusArrayIsTrimmed();

    this.removeOperation(endedOperationId);

    await this.callStatusAddedListeners(status);
  }

  removeOperation(id: number) {
    // remove operation from list of active operations.
    const newActiveOperations: IStatus[] = [];

    for (let i = 0; i < this.activeOperations.length; i++) {
      const oper = this.activeOperations[i];

      if (oper.operationId !== id) {
        newActiveOperations.push(oper);
      }
    }

    this.activeOperations = newActiveOperations;
  }

  async save() {
    const configFile = this.file;

    configFile.setContent(JSON.stringify(this.#data, null, 2));

    await configFile.saveContent();

    if (AppServiceProxy.hasAppService) {
      AppServiceProxy.sendAsync(AppServiceProxyCommands.reloadMct, "");
    }
  }

  async loadGallery() {
    let result = null;

    // @ts-ignore
    if (typeof window !== "undefined") {
      const url = this.contentRoot + "data/gallery.json";

      try {
        result = await axios.get(url);

        if (result) {
          this._gallery = result.data;
        }
      } catch (e) {
        Log.fail("Could not load gallery: " + e + " from '" + url + "'");
      }
    } else if (this.local) {
      try {
        result = await this.local.readJsonFile("data/gallery.json");
      } catch (e) {
        Log.fail("Could not load local file: " + e + " from 'data/gallery.json'");
      }

      if (result !== null) {
        this._gallery = result as IGallery;
      }
    }

    this._galleryLoaded = true;

    this._onGalleryLoaded.dispatch(this, this._gallery);

    return this._gallery;
  }

  async getGalleryProjectByGitHub(
    repoName: string,
    owner: string,
    branch?: string,
    folder?: string,
    withFiles?: boolean
  ) {
    if (!this._galleryLoaded) {
      await this.loadGallery();
    }

    if (this._galleryLoaded === false || this._gallery === undefined || this._gallery.items === undefined) {
      return undefined;
    }

    repoName = repoName.toLowerCase();
    owner = owner.toLowerCase();

    for (const galProj of this._gallery.items) {
      if (
        galProj.gitHubRepoName.toLowerCase() === repoName &&
        galProj.gitHubOwner.toLowerCase() === owner &&
        branch === galProj.gitHubBranch &&
        folder === galProj.gitHubFolder &&
        (!withFiles || galProj.fileList)
      ) {
        return galProj;
      }
    }

    return undefined;
  }

  async getGalleryProjectById(galleryProjectId: string) {
    if (!this._galleryLoaded) {
      await this.loadGallery();
    }

    if (this._galleryLoaded === false || this._gallery === undefined || this._gallery.items === undefined) {
      return undefined;
    }

    galleryProjectId = galleryProjectId.toLowerCase();

    for (const galProj of this._gallery.items) {
      if (galProj.id.toLowerCase() === galleryProjectId) {
        return galProj;
      }
    }

    return undefined;
  }

  async getNewProjectName(seedName: string) {
    await this.load();

    let newProjectName = seedName;
    let counter = 0;

    while (
      this.prefsProjectsFolder.fileExists(newProjectName + ".json") ||
      this.projectsStorage.rootFolder.folderExists(newProjectName)
    ) {
      counter++;
      newProjectName = seedName + " " + counter;
    }

    return newProjectName;
  }

  async createNewProject(
    newProjectName: string,
    newProjectPath: string | undefined,
    focus: ProjectFocus,
    includeDefaultItems: boolean,
    projectLanguage?: ProjectScriptLanguage
  ) {
    await this.load();

    const targetProjectName = await this.getNewProjectName(newProjectName);

    const projectPrefs = await this.prefsProjectsFolder.createFile(targetProjectName + ".json");

    const newProject = new Project(this, targetProjectName, projectPrefs);

    if (newProjectPath) {
      newProject.mainDeployFolderPath = newProjectPath;
    }

    if (projectLanguage) {
      newProject.preferredScriptLanguage = projectLanguage;
    }

    await newProject.ensureProjectFolder();

    newProject.focus = focus;

    if (includeDefaultItems) {
      await newProject.ensureDefaultItems();
    }

    this.projects.push(newProject);

    return newProject;
  }

  async createNewProjectFromFolder(path: string) {
    await this.load();

    let newProjectName = StorageUtilities.getLeafName(path);

    let counter = 0;

    while (
      this.prefsProjectsFolder.fileExists(newProjectName + ".json") ||
      this.projectsStorage.rootFolder.folderExists(newProjectName)
    ) {
      counter++;
      newProjectName = StorageUtilities.getLeafName(path) + " " + counter;
    }

    const projectPrefs = await this.prefsProjectsFolder.createFile(newProjectName + ".json");

    const newProject = new Project(this, newProjectName, projectPrefs);
    newProject.mainDeployFolderPath = path;

    await newProject.ensureProjectFolder();

    await newProject.inferProjectItemsFromFiles();

    this.projects.push(newProject);

    return newProject;
  }

  async deleteProjectByName(projectName: string) {
    let projectToDelete: Project | undefined;

    for (let i = 0; i < this.projects.length; i++) {
      const proj = this.projects[i];

      if (proj.name === projectName) {
        if (projectToDelete !== undefined) {
          Log.fail("Encountered multiple projects with the same name.");
          return;
        }

        projectToDelete = proj;
      }
    }

    if (projectToDelete) {
      await projectToDelete.deleteThisProject();

      this.removeProject(projectToDelete);

      projectToDelete.dispose();
    }
  }

  removeProject(project: Project) {
    const newProjects: Project[] = [];

    for (let i = 0; i < this.projects.length; i++) {
      const proj = this.projects[i];

      if (proj !== project) {
        newProjects.push(proj);
      }
    }
    this.projects = newProjects;
  }

  getProjectByName(projectName: string) {
    for (let i = 0; i < this.projects.length; i++) {
      const proj = this.projects[i];

      if (proj.name === projectName) {
        return proj;
      }
    }

    return undefined;
  }

  getProjectByMainLocalFolderPath(localPath: string) {
    localPath = StorageUtilities.canonicalizePath(localPath);

    for (let i = 0; i < this.projects.length; i++) {
      const proj = this.projects[i];

      if (proj.mainDeployFolderPath && StorageUtilities.canonicalizePath(proj.mainDeployFolderPath) === localPath) {
        return proj;
      }
    }

    return undefined;
  }

  async ensureProjectFromLocalStoragePath(messageProjectPath: string) {
    if (!this.local) {
      Log.fail("Could not find local utilities.");
      return;
    }

    await this.load();

    let desiredProjectName = StorageUtilities.canonicalizePathAsFileName(messageProjectPath);

    // check to see if the expected project with the expected name exists, and use that if possible.
    const project = this.getProjectByName(desiredProjectName);
    const canonPath = StorageUtilities.canonicalizePath(messageProjectPath);

    if (project !== undefined) {
      await project.loadFromFile();

      if (project.mainDeployFolderPath !== undefined) {
        if (canonPath === StorageUtilities.canonicalizePath(project.mainDeployFolderPath)) {
          await project.inferProjectItemsFromFiles();

          return project;
        }
      }
    }

    // OK, a project doesn't exist, let's create one.
    let counter = 0;

    while (
      this.prefsProjectsFolder.fileExists(desiredProjectName + ".json") ||
      this.projectsStorage.rootFolder.folderExists(desiredProjectName)
    ) {
      counter++;
      desiredProjectName = StorageUtilities.canonicalizePathAsFileName(messageProjectPath) + " " + counter;
    }

    const projectPrefs = await this.prefsProjectsFolder.createFile(desiredProjectName + ".json");

    //    Log.debugAlert("Creating new project " + messageProjectPath + "|" + desiredProjectName);
    const newProject = new Project(this, desiredProjectName, projectPrefs);
    newProject.mainDeployFolderPath = messageProjectPath;
    newProject.originalFullPath = messageProjectPath;

    const localStorage = await this.local.createStorage(messageProjectPath);

    if (localStorage === null) {
      Log.fail("Could not create local storage.");
      return;
    }

    newProject.setProjectFolder(localStorage.rootFolder);

    await newProject.ensureProjectFolder();

    await newProject.inferProjectItemsFromFiles();

    this.projects.push(newProject);

    return newProject;
  }

  async ensureProjectForFolder(folderPath: string, newProjectName?: string, openDirect?: boolean) {
    await this.load();

    let desiredProjectName = "";

    if (newProjectName !== undefined) {
      desiredProjectName = newProjectName;
    } else {
      desiredProjectName = StorageUtilities.getLeafName(folderPath);
    }

    let canonPath = StorageUtilities.canonicalizePath(folderPath);

    let project = this.getProjectByMainLocalFolderPath(folderPath);

    // check to see if the expected project with the expected name exists, and use that if possible.
    if (!project) {
      project = this.getProjectByName(desiredProjectName);
    }

    if (project !== undefined && !openDirect) {
      await project.loadFromFile();

      if (project.mainDeployFolderPath !== undefined) {
        if (canonPath === StorageUtilities.canonicalizePath(project.mainDeployFolderPath)) {
          await project.inferProjectItemsFromFiles();

          return project;
        }
      }
    } else if (project && openDirect) {
      for (let i = 1; i < 99; i++) {
        desiredProjectName = StorageUtilities.getLeafName(folderPath) + " " + i;
        canonPath = StorageUtilities.canonicalizePath(folderPath) + " " + i;

        if (newProjectName !== undefined) {
          desiredProjectName = newProjectName;
        }

        // check to see if the expected project with the expected name exists, and use that if possible.
        let project = this.getProjectByName(desiredProjectName);

        if (!project) {
          break;
        }
      }
    }

    // now check all other projects to see if one exists.
    for (let i = 0; i < this.projects.length; i++) {
      project = this.projects[i];

      await project.loadFromFile();

      if (project.mainDeployFolderPath !== undefined) {
        if (canonPath === StorageUtilities.canonicalizePath(project.mainDeployFolderPath)) {
          await project.inferProjectItemsFromFiles();

          return project;
        }
      }
    }

    // OK, a project doesn't exist, let's create one.
    let counter = 0;

    while (
      this.prefsProjectsFolder.fileExists(desiredProjectName + ".json") ||
      this.projectsStorage.rootFolder.folderExists(desiredProjectName)
    ) {
      counter++;
      desiredProjectName = StorageUtilities.getLeafName(folderPath) + " " + counter;
    }

    const projectPrefs = await this.prefsProjectsFolder.createFile(desiredProjectName + ".json");

    const newProject = new Project(this, desiredProjectName, projectPrefs);
    newProject.mainDeployFolderPath = folderPath;
    newProject.originalFullPath = folderPath;

    await newProject.ensureProjectFolder();

    await newProject.inferProjectItemsFromFiles();

    this.projects.push(newProject);

    return newProject;
  }

  async getExportZip() {
    const zs = new ZipStorage();

    const zipRoot = zs.rootFolder;

    await this.load();

    for (let i = 0; i < this.projects.length; i++) {
      const project = this.projects[i];

      await project.loadFromFile();

      await project.ensureProjectFolder();

      if (project.projectFolder) {
        const projectTargetFolder = zipRoot.ensureFolder(project.name);

        await StorageUtilities.syncFolderTo(project.projectFolder, projectTargetFolder, true, true, false);
      }
    }

    await zipRoot.saveAll();

    return zs;
  }

  async load(force?: boolean) {
    if (this._isLoaded && !force) {
      return;
    }

    const configFile = this.file;

    await configFile.loadContent(false);

    if (configFile.content !== null && configFile.content !== undefined && typeof configFile.content === "string") {
      this.#data = JSON.parse(configFile.content as string);
    }

    const projectsFolder = this.prefsProjectsFolder;

    await projectsFolder.load();

    await this.projectsStorage.rootFolder.load();

    this.projects = [];

    for (const fileName in projectsFolder.files) {
      const projectName = StorageUtilities.getBaseFromName(fileName);

      const projectFile = projectsFolder.files[fileName];

      if (projectFile !== undefined) {
        const project = new Project(this, projectName, projectFile);

        this.projects.push(project);
      }
    }

    this.considerStartingMinecraft(); // explicitly not awaiting this since this might take a while and is not strictly necessary.

    this.initializeWorldSettings();

    this.ensureDefaultWorldName();

    this._onLoaded.dispatch(this, this);

    this._isLoaded = true;
  }

  public async considerStartingMinecraft() {
    if (CartoApp.hostType === HostType.webPlusServices || CartoApp.hostType === HostType.web) {
      if (
        this.successfullyConnectedWebSocketToMinecraft &&
        (this.autoStartMinecraft || this.lastActiveMinecraftFlavor === MinecraftFlavor.remote)
      ) {
        this.ensureRemoteMinecraft();

        if (
          this.remoteMinecraft &&
          CartoApp.hostType === HostType.web &&
          CartoApp.carto &&
          CartoApp.carto.remoteServerUrl &&
          CartoApp.carto.remoteServerUrl.length > 4
        ) {
          this.remoteMinecraft.initialize();

          if (!this.activeMinecraft && this.lastActiveMinecraftFlavor === MinecraftFlavor.remote) {
            this.activeMinecraft = this.remoteMinecraft;

            this.lastActiveMinecraftFlavor = MinecraftFlavor.remote;
          }
        }

        if (CartoApp.isAppServiceWeb) {
          this.ensureGameMinecraft();

          if (this.gameMinecraft) {
            this.gameMinecraft.initialize();
          }

          if (!this.activeMinecraft && this.lastActiveMinecraftFlavor === MinecraftFlavor.minecraftGameProxy) {
            this.activeMinecraft = this.gameMinecraft;

            this.lastActiveMinecraftFlavor = MinecraftFlavor.minecraftGameProxy;
          }
        }
      }

      if (
        this.successfullyStartedMinecraftServer &&
        this.lastActiveMinecraftFlavor === MinecraftFlavor.processHostedProxy &&
        this.autoStartMinecraft
      ) {
        await this.connectToMinecraft();
      }
    }
  }

  public async connectToMinecraft() {
    if (!this.lastActiveMinecraftFlavor) {
      return;
    }

    this.ensureMinecraft(this.lastActiveMinecraftFlavor);

    if (this.activeMinecraft) {
      const status = await this.activeMinecraft.updateStatus();

      if (
        status === CartoMinecraftState.disconnected ||
        status === CartoMinecraftState.error ||
        status === CartoMinecraftState.none ||
        status === CartoMinecraftState.stopped ||
        status === CartoMinecraftState.stopping ||
        status === CartoMinecraftState.newMinecraft
      ) {
        await this.activeMinecraft.initialize();
      }
    }
  }

  public canPrepareAndStartMinecraft() {
    if (!this.activeMinecraft) {
      return false;
    }

    if (
      this.activeMinecraftState !== CartoMinecraftState.initialized &&
      this.activeMinecraftState !== CartoMinecraftState.preparing &&
      this.activeMinecraftState !== CartoMinecraftState.prepared &&
      this.activeMinecraftState !== CartoMinecraftState.starting &&
      this.activeMinecraftState !== CartoMinecraftState.started
    ) {
      return false;
    }

    return true;
  }

  public async prepareAndStartToMinecraft(push: MinecraftPush) {
    if (!this.canPrepareAndStartMinecraft || !this.activeMinecraft) {
      return;
    }

    await this.activeMinecraft.prepareAndStart(push);
  }
  private _bubbleMinecraftRefreshed(minecraft: IMinecraft, newState: CartoMinecraftState) {
    if (minecraft !== this.activeMinecraft) {
      return;
    }

    this._onMinecraftRefreshed.dispatch(minecraft, newState);
  }

  private _bubbleMinecraftStateChanged(minecraft: IMinecraft, newState: CartoMinecraftState) {
    if (minecraft !== this.activeMinecraft) {
      return;
    }

    if (!this.successfullyConnectedWebSocketToMinecraft && newState === CartoMinecraftState.initialized) {
      this.successfullyConnectedWebSocketToMinecraft = true;
      this.save();
    }

    if (newState === CartoMinecraftState.prepared) {
      Log.message("Minecraft is ready.");
    } else if (newState === CartoMinecraftState.started) {
      // Log.message("Connected to Minecraft.");
    } else if (newState === CartoMinecraftState.stopping) {
      Log.message("Disconnecting from Minecraft.");
    }

    this._onMinecraftStateChanged.dispatch(minecraft, newState);
  }

  public ensureRemoteMinecraft() {
    return this.remoteMinecraft;
  }

  public ensureProcessHostedMinecraft() {
    return this.processHostedMinecraft;
  }

  public ensureDeploymentStorageMinecraft() {
    if (this.deploymentStorageMinecraft === undefined) {
      this.deploymentStorageMinecraft = new DeploymentStorageMinecraft(this);
    }

    return this.deploymentStorageMinecraft;
  }

  public ensureGameMinecraft() {
    return this.gameMinecraft;
  }

  public ensureMinecraft(flavor: MinecraftFlavor) {
    if (flavor === MinecraftFlavor.none) {
      return undefined;
    }

    if (this.activeMinecraft && this.lastActiveMinecraftFlavor === flavor) {
      return this.activeMinecraft;
    }

    this.ensureRemoteMinecraft();

    if (flavor === MinecraftFlavor.processHostedProxy) {
      this.ensureProcessHostedMinecraft();
    } else if (flavor === MinecraftFlavor.deploymentStorage) {
      this.ensureDeploymentStorageMinecraft();
    } else if (flavor === MinecraftFlavor.minecraftGameProxy) {
      this.ensureGameMinecraft();
    }

    if (this.activeMinecraft) {
      this.activeMinecraft.onStateChanged.unsubscribe(this._bubbleMinecraftStateChanged);
      this.activeMinecraft.onRefreshed.unsubscribe(this._bubbleMinecraftRefreshed);
    }

    if (flavor === MinecraftFlavor.remote) {
      if (!this.remoteMinecraft) {
        Log.throwUnexpectedUndefined("EMR");
        return;
      }

      this.activeMinecraft = this.remoteMinecraft;
      if (this.lastActiveMinecraftFlavor !== MinecraftFlavor.remote) {
        this.lastActiveMinecraftFlavor = MinecraftFlavor.remote;
        this.save();
      }
      this._onMinecraftStateChanged.dispatch(this.activeMinecraft, CartoMinecraftState.newMinecraft);

      if (this.activeMinecraft === undefined) {
        Log.unexpectedUndefined("EMA");
        return undefined;
      }

      this.activeMinecraft.onStateChanged.subscribe(this._bubbleMinecraftStateChanged);
      this.activeMinecraft.onRefreshed.subscribe(this._bubbleMinecraftRefreshed);
    } else if (flavor === MinecraftFlavor.minecraftGameProxy) {
      if (!this.gameMinecraft) {
        Log.throwUnexpectedUndefined("EMG");
        return undefined;
      }

      this.activeMinecraft = this.gameMinecraft;

      if (this.lastActiveMinecraftFlavor !== MinecraftFlavor.minecraftGameProxy) {
        this.lastActiveMinecraftFlavor = MinecraftFlavor.minecraftGameProxy;
        this.save();
      }

      this._onMinecraftStateChanged.dispatch(this.activeMinecraft, CartoMinecraftState.newMinecraft);

      if (this.activeMinecraft === undefined) {
        Log.unexpectedUndefined("EMB");
        return undefined;
      }

      this.activeMinecraft.onStateChanged.subscribe(this._bubbleMinecraftStateChanged);
      this.activeMinecraft.onRefreshed.subscribe(this._bubbleMinecraftRefreshed);
    } else if (flavor === MinecraftFlavor.processHostedProxy) {
      if (!this.processHostedMinecraft) {
        Log.throwUnexpectedUndefined("EMC");
        return undefined;
      }

      this.activeMinecraft = this.processHostedMinecraft;

      if (this.lastActiveMinecraftFlavor !== MinecraftFlavor.processHostedProxy) {
        this.lastActiveMinecraftFlavor = MinecraftFlavor.processHostedProxy;
        this.save();
      }

      this._onMinecraftStateChanged.dispatch(this.activeMinecraft, CartoMinecraftState.newMinecraft);

      if (this.activeMinecraft === undefined) {
        Log.unexpectedUndefined("EMD");
        return undefined;
      }

      this.activeMinecraft.onStateChanged.subscribe(this._bubbleMinecraftStateChanged);
      this.activeMinecraft.onRefreshed.subscribe(this._bubbleMinecraftRefreshed);
    } else if (flavor === MinecraftFlavor.deploymentStorage) {
      if (!this.deploymentStorageMinecraft) {
        Log.throwUnexpectedUndefined("EMCD");
        return undefined;
      }

      this.activeMinecraft = this.deploymentStorageMinecraft;

      if (this.lastActiveMinecraftFlavor !== MinecraftFlavor.deploymentStorage) {
        this.lastActiveMinecraftFlavor = MinecraftFlavor.deploymentStorage;
        this.save();
      }

      this._onMinecraftStateChanged.dispatch(this.activeMinecraft, CartoMinecraftState.newMinecraft);

      if (this.activeMinecraft === undefined) {
        Log.unexpectedUndefined("EMDD");
        return undefined;
      }

      this.activeMinecraft.onStateChanged.subscribe(this._bubbleMinecraftStateChanged);
      this.activeMinecraft.onRefreshed.subscribe(this._bubbleMinecraftRefreshed);
    } else if (
      this.createMinecraft === undefined ||
      this.canCreateMinecraft === undefined ||
      !this.canCreateMinecraft(flavor)
    ) {
      Log.debugAlert("Requested creation of an unavailable Minecraft.");
      flavor = MinecraftFlavor.none;
    } else {
      const newMinecraft = this.createMinecraft(flavor, this);

      if (!newMinecraft) {
        Log.debugAlert("Could not create a requested Minecraft.");
        flavor = MinecraftFlavor.none;
      } else {
        this.activeMinecraft = newMinecraft;
        this.lastActiveMinecraftFlavor = flavor;

        this._onMinecraftStateChanged.dispatch(this.activeMinecraft, CartoMinecraftState.newMinecraft);

        this.activeMinecraft.onStateChanged.subscribe(this._bubbleMinecraftStateChanged);
        this.activeMinecraft.onRefreshed.subscribe(this._bubbleMinecraftRefreshed);
      }
    }

    this.lastActiveMinecraftFlavor = flavor;

    this.save();
    return this.activeMinecraft;
  }
}
