import CreatorToolsHost from "../app/CreatorToolsHost";
import * as vscode from "vscode";
import DedicatedServer, { DedicatedServerStatus } from "../local/DedicatedServer";
import LocalEnvironment from "../local/LocalEnvironment";
import ServerManager from "../local/ServerManager";
import ExtensionManager from "./ExtensionManager";
import IMinecraft, { IMinecraftMessage, PrepareAndStartResultType } from "../app/IMinecraft";
import CreatorTools, { CreatorToolsMinecraftErrorStatus, CreatorToolsMinecraftState } from "../app/CreatorTools";
import Project from "../app/Project";
import GameStateManager from "../minecraft/GameStateManager";
import IFolder from "../storage/IFolder";
import IStorage from "../storage/IStorage";
import { EventDispatcher } from "ste-events";
import MinecraftPush from "../app/MinecraftPush";
import { IMinecraftStartMessage } from "../app/IMinecraftStartMessage";
import Utilities from "../core/Utilities";
import { IWorldSettings } from "../minecraft/IWorldSettings";
import ServerMessage from "../local/ServerMessage";
import IActionSetData from "../actions/IActionSetData";

export default class VscDedicatedServerManager implements IMinecraft {
  _dsm: ServerManager;
  _pendingCommands: string[] = [];
  _pendingRequestIds: string[] = [];

  _activeStdIn = null;
  _currentCommandId = 0;
  _internalCommandId = 0;
  _lastResult = "";
  _creatorTools: CreatorTools;
  _activeProcess = null;
  _em: ExtensionManager;

  state: CreatorToolsMinecraftState;
  activeProject: Project | undefined;
  worldFolder: IFolder | undefined;
  projectFolder: IFolder | undefined;
  worldContentStorage: IStorage | undefined;
  worldProject: Project | undefined;

  canDeployFiles: boolean;

  errorStatus?: CreatorToolsMinecraftErrorStatus;
  errorMessage?: string;

  gameStateManager: GameStateManager | undefined;

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

  public setState(newMinecraftState: CreatorToolsMinecraftState) {
    if (newMinecraftState === this.state) {
      return;
    }

    this.state = newMinecraftState;
    this._onStateChanged.dispatch(this, this.state);
  }

  constructor(em: ExtensionManager, env: LocalEnvironment, creatorTools: CreatorTools) {
    this.state = CreatorToolsMinecraftState.none;
    this.canDeployFiles = true;

    this._creatorTools = creatorTools;

    this.startServer = this.startServer.bind(this);
    this.stopServer = this.stopServer.bind(this);
    this.handleServerOutput = this.handleServerOutput.bind(this);
    this.handleServerStarted = this.handleServerStarted.bind(this);
    this.handleServerRefreshed = this.handleServerRefreshed.bind(this);
    this.handleServerStarting = this.handleServerStarting.bind(this);
    this.handleServerStopping = this.handleServerStopping.bind(this);
    this.handleServerStopped = this.handleServerStopped.bind(this);
    this.command = this.command.bind(this);
    this._handleMessage = this._handleMessage.bind(this);

    this.getDedicatedServerProjectPath = this.getDedicatedServerProjectPath.bind(this);
    this.getDedicatedServerWorldPath = this.getDedicatedServerWorldPath.bind(this);
    this.getDedicatedServerStatus = this.getDedicatedServerStatus.bind(this);

    this._em = em;

    this._dsm = new ServerManager(env, creatorTools);
    // Use "vscode" prefix to isolate VS Code extension slots from other contexts (mcp, serve)
    this._dsm.slotPrefix = "vscode";
    this._dsm.onServerOutput.subscribe(this.handleServerOutput);
    this._dsm.onServerStarted.subscribe(this.handleServerStarted);
    this._dsm.onServerRefreshed.subscribe(this.handleServerRefreshed);
    this._dsm.onServerStarting.subscribe(this.handleServerStarting);
    this._dsm.onServerStopped.subscribe(this.handleServerStopped);
    this._dsm.onServerStopping.subscribe(this.handleServerStopping);

    CreatorToolsHost.onMessage.subscribe(this._handleMessage);
  }

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

      //      Log.verbose("New de did from browser: " + command + "|" + requestId + "|" + JSON.stringify(args));
      switch (command) {
        case "asyncstartDedicatedServer":
          this.startServer(source, requestId, args.data);
          break;

        case "asyncstopDedicatedServer":
          this.stopServer(source, requestId, args.data);
          break;

        case "asyncdedicatedServerCommand":
          this.command(source, requestId, args.data);
          break;

        case "asyncgetDedicatedServerProjectDir":
          this.getDedicatedServerProjectPath(source, requestId, args.data);
          break;

        case "asyncgetDedicatedServerStatus":
          this.getDedicatedServerStatus(source, requestId, args.data);
          break;

        case "asyncgetDedicatedServerWorldDir":
          this.getDedicatedServerWorldPath(source, requestId, args.data);
          break;
      }
    }
  }

  async runCommand(inboundCommand: string): Promise<string | undefined> {
    this._internalCommandId++;
    return await this.command(undefined, "i" + this._internalCommandId, inboundCommand);
  }

  async runActionSet(actionSet: IActionSetData): Promise<string | undefined> {
    return undefined;
  }

  canPrepare(): boolean {
    return true;
  }

  async prepare(force?: boolean) {
    if (this._dsm) {
      await this._dsm.prepare(force);
    }
  }

  getStartInfoFromProject(project: Project): IMinecraftStartMessage {
    let path = this._creatorTools.dedicatedServerPath;

    if (!path) {
      path = "";
    }

    let worldSettings: IWorldSettings | undefined = this._creatorTools.worldSettings;

    if (project.worldSettings) {
      if (project.worldSettings.useCustomSettings) {
        worldSettings = project.worldSettings;
      }
    }

    if (worldSettings && !worldSettings.name) {
      worldSettings.name = "world";
    }

    // For project-based debugging, default transientWorld to true for fresh worlds each run
    // (only if not explicitly set by user)
    if (worldSettings && worldSettings.transientWorld === undefined) {
      worldSettings = { ...worldSettings, transientWorld: true };
    }

    return {
      path: Utilities.ensureEndsWithBackSlash(path),
      iagree: this._creatorTools
        .iAgreeToTheMinecraftEndUserLicenseAgreementAndPrivacyStatementAtMinecraftDotNetSlashEula
        ? true
        : false,
      mode: this._creatorTools.dedicatedServerMode,
      track: this._creatorTools.track,
      projectKey: project.key,
      worldSettings: worldSettings,
    };
  }

  async prepareAndStart(push: MinecraftPush) {
    let startInfo = push.serverStart;

    if (!startInfo && push.project) {
      startInfo = this.getStartInfoFromProject(push.project);
    }

    const srv = await this._dsm.ensureActiveServer(0, startInfo);

    if (!srv) {
      return {
        type: PrepareAndStartResultType.error,
      };
    }

    if (push.project) {
      await push.project.ensureProjectFolder();

      if (push.project.projectFolder) {
        await push.project.projectFolder.saveAll();

        await push.project.projectFolder.load(true);

        await srv.deploy(push.project.projectFolder, false, true);

        return {
          type: PrepareAndStartResultType.started,
        };
      }
    }

    await srv.startServer(false, undefined);

    return {
      type: PrepareAndStartResultType.started,
    };
  }

  async initialize() {}

  async stop() {
    this._dsm.stopAllDedicatedServers();
  }

  async updateStatus() {
    return this.state;
  }

  async syncWithDeployment() {}

  processExternalMessage(command: string, data: string): void {}

  async command(source: vscode.Webview | undefined, requestId: string, args: string) {
    const newCommand = this._pendingCommands.length;

    this._pendingCommands[newCommand] = args;
    this._pendingRequestIds[newCommand] = requestId;

    if (newCommand === this._currentCommandId) {
      await this.executeNextCommand(source);
    }

    return undefined;
  }

  async executeNextCommand(source?: vscode.Webview) {
    if (this._currentCommandId < this._pendingCommands.length) {
      this._currentCommandId++;

      const nextCommand = this._currentCommandId - 1;

      const commandLine = this._pendingCommands[nextCommand];

      // console.log("Sending next command " + this._currentCommandId + ":" + commandLine);

      const srv = await this._dsm.ensureActiveServer(0);

      if (!srv) {
        return;
      }

      await srv.writeToServer(commandLine);

      if (source) {
        this._em.sendMessageToBrowser(
          source,
          "asyncdedicatedServerComplete|" + this._pendingRequestIds[nextCommand],
          "appsvc",
          this._lastResult
        );
      }

      /*      this._window.webContents.send(
        "appsvc",
        "asyncdedicatedServerComplete|" + this._pendingRequestIds[nextCommand] + "|" + this._lastResult
      );*/

      await this.executeNextCommand(source);
    }
  }

  async getDedicatedServerStatus(source: vscode.Webview, requestId: string, args: string) {
    const ds = this._dsm.getActiveServer(0);

    let status = DedicatedServerStatus.stopped;

    if (ds) {
      status = ds.status;
    }

    this._em.sendMessageToBrowser(
      source,
      "asyncgetDedicatedServerStatusComplete|" + requestId,
      "appsvc",
      status.toString()
    );
  }

  async getDedicatedServerProjectPath(source: vscode.Webview, requestId: string, args: string) {
    const ds = this._dsm.getActiveServer(0);

    this._em.sendMessageToBrowser(
      source,
      "asyncgetDedicatedServerProjectDirComplete|" + requestId,
      "appsvc",
      ds.serverPath
    );
  }

  async getDedicatedServerWorldPath(source: vscode.Webview, requestId: string, args: string) {
    const ds = this._dsm.getActiveServer(0);

    this._em.sendMessageToBrowser(
      source,
      "asyncgetDedicatedServerProjectDirComplete|" + requestId,
      "appsvc",
      ds.worldStoragePath
    );
  }

  async stopServer(source: vscode.Webview, requestId: string, args: string) {
    this._dsm.stopAllDedicatedServers();

    this._em.sendMessageToAllBrowsers("dedicatedServerStopped", "appsvc", "");
    this._em.sendMessageToBrowser(source, "asyncdedicatedServerStopComplete|" + requestId, "appsvc", "");

    //    this._window.webContents.send("appsvc", "dedicatedServerStopped|");
    //  this._window.webContents.send("appsvc", "asyncdedicatedServerStopComplete|" + args[0] + "|");
  }

  processServerState(serverState: string) {
    let mess: IMinecraftStartMessage | undefined;

    if (serverState !== "") {
      try {
        mess = JSON.parse(serverState);
      } catch (e) {
        return;
      }

      if (mess === undefined) {
        return;
      }

      this._dsm.environment.iAgreeToTheMinecraftEndUserLicenseAgreementAndPrivacyStatementAtMinecraftDotNetSlashEula =
        mess.iagree;
    }

    return mess;
  }

  async startServerLocal(args: string) {
    const mess = this.processServerState(args);

    const srv = await this._dsm.ensureActiveServer(0, mess);

    if (!srv) {
      return;
    }

    await srv.startServer(false, mess);
  }

  async startServer(source: vscode.Webview, requestId: string, args: string) {
    await this.startServerLocal(args);

    this._em.sendMessageToBrowser(source, "asyncdedicatedServerStartComplete|" + requestId, "appsvc", "");
  }

  handleServerOutput(server: DedicatedServer, message: ServerMessage) {
    this._em.sendMessageToAllBrowsers("dedicatedServerMessage", "appsvc", message.fullMessage);
  }

  handleServerStarted(server: DedicatedServer, message: string) {
    this.setState(CreatorToolsMinecraftState.started);

    this._em.sendMessageToAllBrowsers("dedicatedServerStarted", "appsvc", "");
  }

  handleServerRefreshed(server: DedicatedServer, message: string) {
    this.setState(CreatorToolsMinecraftState.started);

    this._onRefreshed.dispatch(this, this.state);

    this._em.sendMessageToAllBrowsers("dedicatedServerRefreshed", "appsvc", "");
  }

  handleServerStopping(server: DedicatedServer, message: string) {
    this.setState(CreatorToolsMinecraftState.stopping);

    this._em.sendMessageToAllBrowsers("dedicatedServerStopping", "appsvc", "");
  }

  handleServerStopped(server: DedicatedServer, message: string) {
    this.setState(CreatorToolsMinecraftState.stopped);

    this._em.sendMessageToAllBrowsers("dedicatedServerStopped", "appsvc", "");
  }

  handleServerStarting(server: DedicatedServer, message: string) {
    this.setState(CreatorToolsMinecraftState.starting);

    this._em.sendMessageToAllBrowsers("dedicatedServerStarting", "appsvc", "");
  }

  register() {}
}
