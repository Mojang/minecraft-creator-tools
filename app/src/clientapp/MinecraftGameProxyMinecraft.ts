import CreatorTools, { CreatorToolsMinecraftErrorStatus, CreatorToolsMinecraftState } from "../app/CreatorTools";
import IMinecraft, { IMinecraftMessage, PrepareAndStartResultType } from "../app/IMinecraft";
import AppServiceProxy, { AppServiceProxyCommands } from "../core/AppServiceProxy";
import { EventDispatcher } from "ste-events";
import Utilities from "../core/Utilities";
import Project from "../app/Project";
import MinecraftPush from "../app/MinecraftPush";
import GameStateManager from "../minecraft/GameStateManager";
import Log from "../core/Log";
import IFolder from "../storage/IFolder";
import IStorage from "../storage/IStorage";
import { MinecraftGameConnectionMode } from "../app/ICreatorToolsData";
import ProjectExporter from "../app/ProjectExporter";
import { ICommandResponseBody } from "../minecraft/ICommandResponse";
import IActionSetData from "../actions/IActionSetData";

export default class MinecraftGameProxyMinecraft implements IMinecraft {
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
  worldContentStorage: IStorage | undefined;
  worldProject: Project | undefined;

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
    return this._creatorTools.minecraftGameMode !== MinecraftGameConnectionMode.remoteMinecraft;
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

  async prepare(force?: boolean) {}

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
    const dt = this._creatorTools.defaultDeploymentTarget;

    if (
      dt == null ||
      dt.deployBehaviorPacksFolder == null ||
      this._creatorTools.minecraftGameMode === MinecraftGameConnectionMode.remoteMinecraft
    ) {
      throw new Error("This instance doesn't support deployment");
    }

    if (!this._project) {
      return;
    }

    let isAvailable = dt.storage.available;

    if (isAvailable === undefined) {
      isAvailable = await dt.storage.getAvailable();
    }

    if (!isAvailable) {
      return;
    }

    const deployFolderExists = await dt.deployBehaviorPacksFolder.exists();

    if (deployFolderExists) {
      await ProjectExporter.deployProject(this._creatorTools, this._project, dt.storage.rootFolder);
    }
  }

  processExternalMessage(command: string, data: string) {
    switch (command) {
      case "wsevent":
        let obj = undefined;

        try {
          obj = JSON.parse(data);
        } catch (e) {}

        if (obj) {
          this._gameStateManager.handleEvent(obj);
        }

        break;

      case "webSocketCommandComplete":
        Log.message(data);
        break;

      case "webSocketConnected":
        this.notifyStateChanged(CreatorToolsMinecraftState.started);

        if (!this._creatorTools.successfullyConnectedWebSocketToMinecraft) {
          this._creatorTools.successfullyConnectedWebSocketToMinecraft = true;
          this._creatorTools.save();
        }
        break;

      case "webSocketDisconnected":
        this.notifyStateChanged(CreatorToolsMinecraftState.disconnected);
        break;
    }
  }

  async runActionSet(actionSet: IActionSetData): Promise<any> {
    return undefined;
  }

  async runCommand(command: string) {
    if (!AppServiceProxy.hasAppService && Utilities.isDebug) {
      // simulate a command in debug
      Log.debugAlert("Simulating command to Minecraft:\n\n" + command + "\n\n");

      if (command.indexOf("fail") >= 0) {
        return JSON.stringify({
          statusCode: -2147483648,
          statusMessage: "Failed command " + command,
        });
      } else {
        return JSON.stringify({
          statusCode: 0,
          statusMessage: "Success command " + command,
          position: {
            x: -100,
            y: 100,
            z: -100,
          },
        });
      }
    } else {
      let result = await AppServiceProxy.sendAsync(AppServiceProxyCommands.webSocketCommand, command);

      if (result !== undefined) {
        this.logCommandResult(result);
      }

      return result;
    }
  }

  logCommandResult(result: string) {
    if (result) {
      if (result.indexOf("{") >= 0) {
        try {
          const commandResponse: ICommandResponseBody = JSON.parse(result);

          if (commandResponse.statusMessage) {
            this._creatorTools.notifyStatusUpdate("Minecraft Game: " + commandResponse.statusMessage);
            return;
          }
        } catch (e: any) {
          Log.fail(e);
        }
      }
    }
    this._creatorTools.notifyStatusUpdate("Minecraft Game: " + result);
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

      AppServiceProxy.sendAsync(AppServiceProxyCommands.startWebSocketServer, "").then(
        async (result: string | undefined) => {
          const getMinecraftGameProjectDeployDir = await AppServiceProxy.sendAsync(
            AppServiceProxyCommands.getMinecraftGameProjectDeployDir,
            this._creatorTools.minecraftGameMode
          );

          const getMinecraftGameWorldDeployDir = await AppServiceProxy.sendAsync(
            AppServiceProxyCommands.getMinecraftGameWorldDeployDir,
            this._creatorTools.minecraftGameMode
          );

          if (
            getMinecraftGameWorldDeployDir &&
            getMinecraftGameWorldDeployDir.length > 0 &&
            this._creatorTools.ensureLocalFolder
          ) {
            this.worldFolder = this._creatorTools.ensureLocalFolder(getMinecraftGameWorldDeployDir);

            this._onWorldFolderReady.dispatch(this, this.worldFolder);
          }

          if (
            getMinecraftGameProjectDeployDir &&
            getMinecraftGameProjectDeployDir.length > 0 &&
            this._creatorTools.ensureLocalFolder
          ) {
            this.projectFolder = this._creatorTools.ensureLocalFolder(getMinecraftGameProjectDeployDir);

            this._onProjectFolderReady.dispatch(this, this.projectFolder);
          }

          this.notifyStateChanged(CreatorToolsMinecraftState.initialized);
        }
      );
    }
  }
}
