/**
 * Handles Dedicated Server commands from the renderer process.
 *
 * This module manages the Minecraft Dedicated Server lifecycle, including
 * starting, stopping, and sending commands to the server.
 */

import { BrowserWindow, IpcMain } from "electron";
import Utilities from "../core/Utilities";
import ServerManager from "../local/ServerManager";
import LocalEnvironment from "../local/LocalEnvironment";
import CreatorTools from "../app/CreatorTools";
import DedicatedServer from "../local/DedicatedServer";
import ServerMessage, { ServerMessageCategory } from "../local/ServerMessage";
import ElectronUtils from "./ElectronUtils";
import { IDebugSessionInfo, IStatData, IProfilerCaptureEvent } from "../debugger/IMinecraftDebugProtocol";

export class DedicatedServerCommandHandler {
  private _dsm: ServerManager;
  private _pendingCommands: string[] = [];
  private _pendingRequestIds: string[] = [];

  private _activeStdIn: any = null;
  private _currentCommandId = 0;
  private _lastResult = "";
  private _activeProcess: any = null;
  private _window: BrowserWindow;
  private _ipcMain: IpcMain;
  private _utils: ElectronUtils;

  constructor(
    browserWindow: BrowserWindow,
    incomingIpcMain: IpcMain,
    env: LocalEnvironment,
    creatorTools: CreatorTools,
    utils: ElectronUtils
  ) {
    this._window = browserWindow;
    this._ipcMain = incomingIpcMain;
    this._utils = utils;

    this.startServer = this.startServer.bind(this);
    this.stopServer = this.stopServer.bind(this);
    this.handleServerOutput = this.handleServerOutput.bind(this);
    this.handleServerStopped = this.handleServerStopped.bind(this);
    this.getDedicatedServerProjectPath = this.getDedicatedServerProjectPath.bind(this);
    this.getDedicatedServerWorldPath = this.getDedicatedServerWorldPath.bind(this);
    this.getDedicatedServerStatus = this.getDedicatedServerStatus.bind(this);
    this.command = this.command.bind(this);
    this.debugPause = this.debugPause.bind(this);
    this.debugResume = this.debugResume.bind(this);
    this.debugStartProfiler = this.debugStartProfiler.bind(this);
    this.debugStopProfiler = this.debugStopProfiler.bind(this);

    this._dsm = new ServerManager(env, creatorTools as any);
    this._dsm.onServerOutput.subscribe(this.handleServerOutput);
    this._dsm.onServerStopped.subscribe(this.handleServerStopped);

    // Subscribe to debug events from the ServerManager and forward them via IPC
    this._dsm.onDebugConnected.subscribe(this._handleDebugConnected.bind(this));
    this._dsm.onDebugDisconnected.subscribe(this._handleDebugDisconnected.bind(this));
    this._dsm.onDebugStats.subscribe(this._handleDebugStats.bind(this));
    this._dsm.onDebugPaused.subscribe(this._handleDebugPaused.bind(this));
    this._dsm.onDebugResumed.subscribe(this._handleDebugResumed.bind(this));
    this._dsm.onProfilerCapture.subscribe(this._handleProfilerCapture.bind(this));

    this._ipcMain.handle("asyncstartDedicatedServer", this.startServer);
    this._ipcMain.handle("asyncstopDedicatedServer", this.stopServer);
    this._ipcMain.handle("asyncdedicatedServerCommand", this.command);
    this._ipcMain.handle("asyncgetDedicatedServerProjectDir", this.getDedicatedServerProjectPath);
    this._ipcMain.handle("asyncgetDedicatedServerStatus", this.getDedicatedServerStatus);
    this._ipcMain.handle("asyncgetDedicatedServerWorldDir", this.getDedicatedServerWorldPath);
    this._ipcMain.handle("asyncdebugPause", this.debugPause);
    this._ipcMain.handle("asyncdebugResume", this.debugResume);
    this._ipcMain.handle("asyncdebugStartProfiler", this.debugStartProfiler);
    this._ipcMain.handle("asyncdebugStopProfiler", this.debugStopProfiler);
  }

  command(_event: Electron.IpcMainInvokeEvent, data: string): void {
    const slargs = data.split("|");

    const newCommand = this._pendingCommands.length;

    if (Utilities.isUsableAsObjectKey(String(newCommand))) {
      this._pendingCommands[newCommand] = slargs[1];
      this._pendingRequestIds[newCommand] = slargs[0];
    }

    if (newCommand === this._currentCommandId) {
      this.executeNextCommand();
    }
  }

  async executeNextCommand(): Promise<void> {
    if (this._currentCommandId < this._pendingCommands.length) {
      this._currentCommandId++;

      const nextCommand = this._currentCommandId - 1;

      if (nextCommand >= this._pendingCommands.length) {
        return;
      }

      const commandLine = this._pendingCommands[nextCommand];

      const srv = await this._dsm.ensureActiveServer(0);

      if (!srv) {
        return;
      }

      await srv.writeToServer(commandLine);

      this._window.webContents.send(
        "appsvc",
        "asyncdedicatedServerComplete|" + this._pendingRequestIds[nextCommand] + "|" + this._lastResult
      );

      await this.executeNextCommand();
    }
  }

  async getDedicatedServerStatus(_event: Electron.IpcMainInvokeEvent, data: string): Promise<void> {
    const slargs = data.split("|");

    const ds = this._dsm.getActiveServer(0);

    if (!ds) {
      this._window.webContents.send("appsvc", "asyncgetDedicatedServerStatusComplete|" + slargs[0] + "|-1");
    } else {
      this._window.webContents.send(
        "appsvc",
        "asyncgetDedicatedServerStatusComplete|" + slargs[0] + "|" + ds.status.toString()
      );
    }
  }

  async getDedicatedServerProjectPath(_event: Electron.IpcMainInvokeEvent, data: string): Promise<void> {
    const slargs = data.split("|");

    const ds = this._dsm.getActiveServer(0);

    let projectPath = ds ? ds.serverPath : "";
    if (projectPath && projectPath.length > 0) {
      const uniqueId = this._utils.ensureMappingForPath(projectPath);
      projectPath = "<pt_" + uniqueId + ">";
    }

    this._window.webContents.send(
      "appsvc",
      "asyncgetDedicatedServerProjectDirComplete|" + slargs[0] + "|" + projectPath
    );
  }

  async getDedicatedServerWorldPath(_event: Electron.IpcMainInvokeEvent, data: string): Promise<void> {
    const slargs = data.split("|");

    const ds = this._dsm.getActiveServer(0);

    const rawWorldPath = ds?.defaultWorldFolder?.fullPath ?? "";

    let worldPath = rawWorldPath;
    if (rawWorldPath.length > 0) {
      const uniqueId = this._utils.ensureMappingForPath(rawWorldPath);
      worldPath = "<pt_" + uniqueId + ">";
    }

    this._window.webContents.send("appsvc", "asyncgetDedicatedServerWorldDirComplete|" + slargs[0] + "|" + worldPath);
  }

  async stopServer(_event: Electron.IpcMainInvokeEvent, data: string): Promise<void> {
    const slargs = data.split("|");

    await this._dsm.stopAllDedicatedServers();

    this._window.webContents.send("appsvc", "dedicatedServerStopped|");

    this._window.webContents.send("appsvc", "asyncdedicatedServerStopComplete|" + slargs[0] + "|");
  }

  processServerState(serverState: string): any {
    let mess: any = {};

    if (serverState !== "") {
      try {
        mess = JSON.parse(serverState);
      } catch (e) {
        return {};
      }

      (
        this._dsm.environment as any
      ).iAgreeToTheMinecraftEndUserLicenseAgreementAndPrivacyStatementAtMinecraftDotNetSlashEula = mess.iagree;
    }

    return mess;
  }

  async startServer(_event: Electron.IpcMainInvokeEvent, data: string): Promise<void> {
    const slargs = data.split("|");

    const serverState = slargs[1];

    const mess = this.processServerState(serverState);

    const srv = await this._dsm.ensureActiveServer(0, mess);

    if (!srv) {
      this._window.webContents.send("appsvc", "dedicatedServerError|Could not create a server.");
      return;
    }

    await srv.startServer(false, mess);

    this._window.webContents.send("appsvc", "asyncdedicatedServerStartComplete|" + slargs[0] + "|");
  }

  handleServerOutput(_server: DedicatedServer, message: ServerMessage | null): void {
    if (!message || !message.fullMessage) {
      return;
    }

    // Don't forward internal system messages (e.g., querytarget polling output) to the renderer
    if (message.category === ServerMessageCategory.internalSystemMessage) {
      return;
    }

    if (message.fullMessage.indexOf("Server started") >= 0) {
      this._window.webContents.send("appsvc", "dedicatedServerStarted|");
    }

    this._window.webContents.send("appsvc", "dedicatedServerMessage|" + message.fullMessage);
  }

  handleServerStopped(_server: DedicatedServer, _message: string): void {
    this._window.webContents.send("appsvc", "dedicatedServerStopped|");
  }

  // ============================================================================
  // Debug Event Handlers - Forward debug events from ServerManager to renderer
  // ============================================================================

  private _handleDebugConnected(_server: DedicatedServer, sessionInfo: IDebugSessionInfo): void {
    const body = {
      eventName: "debugConnected",
      protocolVersion: sessionInfo.protocolVersion,
      sessionId: sessionInfo.targetModuleUuid,
    };
    this._window.webContents.send("appsvc", "dedicatedServerDebugConnected|" + JSON.stringify(body));
  }

  private _handleDebugDisconnected(_server: DedicatedServer, reason: string): void {
    const body = {
      eventName: "debugDisconnected",
      reason: reason,
    };
    this._window.webContents.send("appsvc", "dedicatedServerDebugDisconnected|" + JSON.stringify(body));
  }

  private _handleDebugStats(
    _server: DedicatedServer,
    statsData: { tick: number; stats: IStatData[] }
  ): void {
    // Flatten IStatData to IDebugStatItem format for the renderer
    const items = statsData.stats.map((s) => ({
      name: s.name,
      values: s.values,
      parent: s.parent_name || undefined,
    }));

    const body = {
      eventName: "debugStats",
      tick: statsData.tick,
      stats: items,
    };
    this._window.webContents.send("appsvc", "dedicatedServerDebugStats|" + JSON.stringify(body));
  }

  private _handleDebugPaused(_server: DedicatedServer, reason: string): void {
    const body = {
      eventName: "debugPaused",
      reason: reason,
    };
    this._window.webContents.send("appsvc", "dedicatedServerDebugPaused|" + JSON.stringify(body));
  }

  private _handleDebugResumed(_server: DedicatedServer): void {
    const body = {
      eventName: "debugResumed",
    };
    this._window.webContents.send("appsvc", "dedicatedServerDebugResumed|" + JSON.stringify(body));
  }

  private _handleProfilerCapture(_server: DedicatedServer, captureEvent: IProfilerCaptureEvent): void {
    const body = {
      eventName: "profilerCapture",
      captureBasePath: captureEvent.capture_base_path,
      captureData: captureEvent.capture_data,
    };
    this._window.webContents.send("appsvc", "dedicatedServerProfilerCapture|" + JSON.stringify(body));
  }

  // ============================================================================
  // Debug Command Handlers - Forward debug commands from renderer to debug client
  // ============================================================================

  async debugPause(_event: Electron.IpcMainInvokeEvent, data: string): Promise<void> {
    const slargs = data.split("|");
    const ds = this._dsm.getActiveServer(0);
    if (ds?.debugClient) {
      ds.debugClient.pause();
    }
    this._window.webContents.send("appsvc", "asyncdebugPauseComplete|" + slargs[0] + "|");
  }

  async debugResume(_event: Electron.IpcMainInvokeEvent, data: string): Promise<void> {
    const slargs = data.split("|");
    const ds = this._dsm.getActiveServer(0);
    if (ds?.debugClient) {
      ds.debugClient.resume();
    }
    this._window.webContents.send("appsvc", "asyncdebugResumeComplete|" + slargs[0] + "|");
  }

  async debugStartProfiler(_event: Electron.IpcMainInvokeEvent, data: string): Promise<void> {
    const slargs = data.split("|");
    const ds = this._dsm.getActiveServer(0);
    if (ds?.debugClient) {
      try {
        ds.debugClient.startProfiler();
        // Send profiler state update
        const body = { eventName: "debugProfilerState", isRunning: true };
        this._window.webContents.send(
          "appsvc",
          "dedicatedServerDebugProfilerState|" + JSON.stringify(body)
        );
      } catch (e) {
        // Profiler not supported
      }
    }
    this._window.webContents.send("appsvc", "asyncdebugStartProfilerComplete|" + slargs[0] + "|");
  }

  async debugStopProfiler(_event: Electron.IpcMainInvokeEvent, data: string): Promise<void> {
    const slargs = data.split("|");
    const ds = this._dsm.getActiveServer(0);
    if (ds?.debugClient) {
      try {
        ds.debugClient.stopProfiler("profiler_captures");
        // Send profiler state update
        const body = { eventName: "debugProfilerState", isRunning: false };
        this._window.webContents.send(
          "appsvc",
          "dedicatedServerDebugProfilerState|" + JSON.stringify(body)
        );
      } catch (e) {
        // Profiler not supported
      }
    }
    this._window.webContents.send("appsvc", "asyncdebugStopProfilerComplete|" + slargs[0] + "|");
  }

  register(): void {
    // All handlers are registered in constructor
  }
}

export default DedicatedServerCommandHandler;
