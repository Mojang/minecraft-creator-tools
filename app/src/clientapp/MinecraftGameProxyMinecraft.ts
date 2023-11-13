import Carto, { CartoMinecraftErrorStatus, CartoMinecraftState } from "../app/Carto";
import IMinecraft, { IMinecraftMessage, PrepareAndStartResultType } from "../app/IMinecraft";
import AppServiceProxy, { AppServiceProxyCommands } from "../core/AppServiceProxy";
import { EventDispatcher } from "ste-events";
import Utilities from "../core/Utilities";
import Project from "../app/Project";
import MinecraftPush from "../app/MinecraftPush";
import GameStateManager from "../minecraft/GameStateManager";
import Log from "../core/Log";
import ProjectTools from "../app/ProjectTools";
import IFolder from "../storage/IFolder";
import { MinecraftGameConnectionMode } from "../app/ICartoData";
import ProjectExporter from "../app/ProjectExporter";
import { ICommandResponseBody } from "../minecraft/ICommandResponse";

export default class MinecraftGameProxyMinecraft implements IMinecraft {
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
    return this._carto.minecraftGameMode !== MinecraftGameConnectionMode.remoteMinecraft;
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

  async prepare(force?: boolean) {}

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
      await ProjectTools.deployProject(
        this._carto,
        this._project,
        this._carto.deploymentStorage,
        this._carto.deployBehaviorPacksFolder
      );
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
        this.notifyStateChanged(CartoMinecraftState.started);

        if (!this._carto.successfullyConnectedWebSocketToMinecraft) {
          this._carto.successfullyConnectedWebSocketToMinecraft = true;
          this._carto.save();
        }
        break;

      case "webSocketDisconnected":
        this.notifyStateChanged(CartoMinecraftState.disconnected);
        break;
    }
  }

  async runCommand(command: string) {
    if (!AppServiceProxy.hasAppService && Utilities.isDebug) {
      // simulate a command in debug
      Log.debugAlert("Simulating command to Minecraft:\r\n\r\n" + command + "\r\n\r\n");

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
      const result = await AppServiceProxy.sendAsync(AppServiceProxyCommands.webSocketCommand, command);

      this.logCommandResult(result);

      return result;
    }
  }

  logCommandResult(result: string) {
    if (result) {
      if (result.indexOf("{") >= 0) {
        try {
          const commandResponse: ICommandResponseBody = JSON.parse(result);

          if (commandResponse.statusMessage) {
            this._carto.notifyStatusUpdate("Minecraft Game: " + commandResponse.statusMessage);
            return;
          }
        } catch (e: any) {
          Log.fail(e);
        }
      }
    }
    this._carto.notifyStatusUpdate("Minecraft Game: " + result);
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

      AppServiceProxy.sendAsync(AppServiceProxyCommands.startWebSocketServer, "").then(async (result: string) => {
        const getMinecraftGameProjectDeployDir = await AppServiceProxy.sendAsync(
          AppServiceProxyCommands.getMinecraftGameProjectDeployDir,
          this._carto.minecraftGameMode
        );

        const getMinecraftGameWorldDeployDir = await AppServiceProxy.sendAsync(
          AppServiceProxyCommands.getMinecraftGameWorldDeployDir,
          this._carto.minecraftGameMode
        );

        if (
          getMinecraftGameWorldDeployDir &&
          getMinecraftGameWorldDeployDir.length > 0 &&
          this._carto.ensureLocalFolder
        ) {
          this.worldFolder = this._carto.ensureLocalFolder(getMinecraftGameWorldDeployDir);

          this._onWorldFolderReady.dispatch(this, this.worldFolder);
        }

        if (
          getMinecraftGameProjectDeployDir &&
          getMinecraftGameProjectDeployDir.length > 0 &&
          this._carto.ensureLocalFolder
        ) {
          this.projectFolder = this._carto.ensureLocalFolder(getMinecraftGameProjectDeployDir);

          this._onProjectFolderReady.dispatch(this, this.projectFolder);
        }

        this.notifyStateChanged(CartoMinecraftState.initialized);
      });
    }
  }
}
