import CreatorToolsHost from "../app/CreatorToolsHost";
import * as vscode from "vscode";
import LocalEnvironment from "../local/LocalEnvironment";
import MinecraftWebSocketServer from "./../local/MinecraftWebSocketServer";
import ExtensionManager from "./ExtensionManager";
import { EventDispatcher } from "ste-events";
import IMinecraft, { IMinecraftMessage, PrepareAndStartResultType } from "../app/IMinecraft";
import { CreatorToolsMinecraftState } from "../app/CreatorTools";
import MinecraftPush from "../app/MinecraftPush";
import GameStateManager from "../minecraft/GameStateManager";
import Project from "../app/Project";
import IFolder from "../storage/IFolder";
import IStorage from "../storage/IStorage";
import IActionSetData from "../actions/IActionSetData";
import Utilities from "../core/Utilities";

export default class VscWebSocketServerManager implements IMinecraft {
  _wss: MinecraftWebSocketServer;
  _em: ExtensionManager;
  _env: LocalEnvironment;
  state: CreatorToolsMinecraftState;
  _activeProcess = null;

  _internalCommandId = 0;
  activeProject: Project | undefined;
  gameStateManager: GameStateManager | undefined;
  worldFolder: IFolder | undefined;
  projectFolder: IFolder | undefined;
  worldContentStorage: IStorage | undefined;
  worldProject: Project | undefined;

  canDeployFiles: boolean;

  private _onFolderInitRequested = new EventDispatcher<any, string>();
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

  public get onStateChanged() {
    return this._onStateChanged.asEvent();
  }

  public get onRefreshed() {
    return this._onRefreshed.asEvent();
  }

  constructor(em: ExtensionManager, env: LocalEnvironment) {
    this._em = em;
    this._env = env;

    this.state = CreatorToolsMinecraftState.none;
    this.canDeployFiles = true;

    this.startServer = this.startServer.bind(this);
    this.stopServer = this.stopServer.bind(this);
    this.webSocketCommand = this.webSocketCommand.bind(this);
    this.handleCommandCompleted = this.handleCommandCompleted.bind(this);
    this.handleEventReceived = this.handleEventReceived.bind(this);
    this.handleClientConnected = this.handleClientConnected.bind(this);
    this.handleClientDisconnected = this.handleClientDisconnected.bind(this);
    this._handleMessage = this._handleMessage.bind(this);

    this._wss = new MinecraftWebSocketServer(env);

    this._wss.onClientConnected.subscribe(this.handleClientConnected);
    this._wss.onClientDisconnected.subscribe(this.handleClientDisconnected);
    this._wss.onCommandCompleted.subscribe(this.handleCommandCompleted);
    this._wss.onEventReceived.subscribe(this.handleEventReceived);

    CreatorToolsHost.onMessage.subscribe(this._handleMessage);
  }

  public setState(newMinecraftState: CreatorToolsMinecraftState) {
    if (newMinecraftState === this.state) {
      return;
    }

    this.state = newMinecraftState;
    this._onStateChanged.dispatch(this, this.state);
  }

  async runActionSet(actionSet: IActionSetData): Promise<string | undefined> {
    return undefined;
  }

  public get onFolderInitRequested() {
    return this._onFolderInitRequested.asEvent();
  }

  async runCommand(inboundCommand: string): Promise<string | undefined> {
    this._internalCommandId++;

    this._wss.runCommand(inboundCommand, "i" + this._internalCommandId, "");

    return undefined;
  }

  canPrepare(): boolean {
    return true;
  }

  async prepareAndStart(push: MinecraftPush) {
    return {
      type: PrepareAndStartResultType.started,
    };
  }

  async initialize() {}

  async stop() {
    this._wss.closeServer();
  }

  async updateStatus() {
    return this.state;
  }

  async syncWithDeployment() {}

  async prepare(force?: boolean) {}

  processExternalMessage(command: string, data: string): void {}
  _handleMessage(source: any, args: any) {
    if (args.id !== "appweb") {
      return;
    }

    if (args.command === undefined) {
      return;
    }

    let command = args.command;

    let requestId = "";

    if (command.indexOf("|") >= 0) {
      const commandSplit = Utilities.splitUntil(command, "|", 1);
      command = commandSplit[0];
      requestId = commandSplit[1];

      switch (command) {
        case "asyncstartWebSocketServer":
          // Log.message("New websocket from browser: " + command + "|" + requestId + "|" + JSON.stringify(args));

          this.startServer(source, requestId, args.data);
          break;

        case "asyncstopWebSocketServer":
          // Log.message("New websocket from browser: " + command + "|" + requestId + "|" + JSON.stringify(args));

          this.stopServer(source, requestId, args.data);
          break;

        case "asyncwebSocketCommand":
          this.webSocketCommand(source, requestId, args.data);
          break;

        case "asyncgetMinecraftGameProjectDeployDir":
          this.getMinecraftGameProjectPath(source, requestId, args.data);
          break;
        case "asyncgetMinecraftGameWorldDeployDir":
          this.getMinecraftGameWorldPath(source, requestId, args.data);
          break;
      }
    }
  }

  webSocketCommand(source: vscode.Webview, requestId: string, args: string) {
    console.log("VSC server received web socket command " + args);

    this._wss.runCommand(args, requestId, source);
  }

  async startServer(source: vscode.Webview, requestId: string, args: string) {
    await this._wss.openServer();

    this._em.sendMessageToBrowser(source, "asyncstartWebSocketServerComplete|" + requestId, "appsvc", "");
  }

  async stopServer(source: vscode.Webview, requestId: string, args: string) {
    await this._wss.closeServer();

    this._em.sendMessageToBrowser(source, "asyncstopWebSocketServerComplete|" + requestId, "appsvc", "");
  }

  handleEventReceived(server: MinecraftWebSocketServer, req: object) {
    this._em.sendMessageToAllBrowsers("wsevent", "appsvc", JSON.stringify(req));
  }

  async getMinecraftGameProjectPath(source: vscode.Webview, requestId: string, args: string) {
    let path = this._env.utilities.minecraftUwpPath;

    if (args) {
      try {
        const argsInt = parseInt(args);

        if (argsInt === 1) {
          path = this._env.utilities.minecraftPreviewUwpPath;
        } else if (argsInt === 2) {
          path = "";
        }
      } catch (e) {}
    }

    this._onFolderInitRequested.dispatch(this, path);

    this._em.sendMessageToBrowser(source, "asyncgetMinecraftGameProjectDeployDirComplete|" + requestId, "appsvc", path);
  }

  async getMinecraftGameWorldPath(source: vscode.Webview, requestId: string, args: string) {
    let worldPathIndex = 0;

    if (args) {
      try {
        const argsInt = parseInt(args);

        if (argsInt >= 0 && argsInt <= 2) {
          worldPathIndex = argsInt;
        }
      } catch (e) {}
    }

    const path = this._wss.getWebSocketWorldPath(worldPathIndex);

    this._onFolderInitRequested.dispatch(this, path);

    this._em.sendMessageToBrowser(source, "asyncgetMinecraftGameWorldDeployDirComplete|" + requestId, "appsvc", path);
  }

  handleCommandCompleted(
    server: MinecraftWebSocketServer,
    req: {
      requestId: string;
      result: object;
      data: any;
    }
  ) {
    this._em.sendMessageToBrowser(
      req.data as vscode.Webview,
      "asyncwebSocketCommandComplete|" + req.requestId,
      "appsvc",
      JSON.stringify(req.result)
    );
  }

  handleClientConnected(server: MinecraftWebSocketServer, message: string) {
    this._em.sendMessageToAllBrowsers("webSocketConnected", "appsvc", "");
  }

  handleClientDisconnected(server: MinecraftWebSocketServer, message: string) {
    this._em.sendMessageToAllBrowsers("webSocketDisconnected", "appsvc", "");
  }
}
