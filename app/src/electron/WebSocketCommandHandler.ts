/**
 * Handles WebSocket server commands for connecting to Minecraft game instances.
 *
 * This module manages the MinecraftWebSocketServer that allows the Electron app
 * to communicate with running Minecraft instances via WebSocket protocol.
 */

import { BrowserWindow, IpcMain } from "electron";
import MinecraftWebSocketServer from "../local/MinecraftWebSocketServer";
import LocalEnvironment from "../local/LocalEnvironment";

export class WebSocketCommandHandler {
  private _window: BrowserWindow;
  private _ipcMain: IpcMain;
  private _wss: MinecraftWebSocketServer;
  private _localUtilities: any;
  private _env: LocalEnvironment;

  constructor(browserWindow: BrowserWindow, incomingIpcMain: IpcMain, env: LocalEnvironment) {
    this._window = browserWindow;
    this._ipcMain = incomingIpcMain;

    this.startServer = this.startServer.bind(this);
    this.stopServer = this.stopServer.bind(this);
    this.webSocketCommand = this.webSocketCommand.bind(this);
    this.handleCommandCompleted = this.handleCommandCompleted.bind(this);
    this.handleEventReceived = this.handleEventReceived.bind(this);
    this.handleClientConnected = this.handleClientConnected.bind(this);
    this.handleClientDisconnected = this.handleClientDisconnected.bind(this);
    this.getMinecraftGameProjectPath = this.getMinecraftGameProjectPath.bind(this);
    this.getMinecraftGameWorldPath = this.getMinecraftGameWorldPath.bind(this);

    this._env = env;
    this._wss = new MinecraftWebSocketServer(env);
    this._localUtilities = this._env.utilities;

    this._wss.onClientConnected.subscribe(this.handleClientConnected);
    this._wss.onClientDisconnected.subscribe(this.handleClientDisconnected);
    this._wss.onCommandCompleted.subscribe(this.handleCommandCompleted);
    this._wss.onEventReceived.subscribe(this.handleEventReceived);

    this._ipcMain.handle("asyncstartWebSocketServer", this.startServer);
    this._ipcMain.handle("asyncstopWebSocketServer", this.stopServer);
    this._ipcMain.handle("asyncwebSocketCommand", this.webSocketCommand);
    this._ipcMain.handle("asyncgetMinecraftGameProjectDeployDir", this.getMinecraftGameProjectPath);
    this._ipcMain.handle("asyncgetMinecraftGameWorldDeployDir", this.getMinecraftGameWorldPath);
  }

  webSocketCommand(_event: Electron.IpcMainInvokeEvent, data: string): void {
    const slargs = data.split("|");

    const command = slargs[1];
    const requestId = slargs[0];

    this._wss.runCommand(command, requestId, "");
  }

  async startServer(_event: Electron.IpcMainInvokeEvent, data: string): Promise<void> {
    const slargs = data.split("|");
    const result = this._wss.openServer();

    this._window.webContents.send("appsvc", "asyncstartWebSocketServerComplete|" + slargs[0] + "|" + result);
  }

  async stopServer(_event: Electron.IpcMainInvokeEvent, data: string): Promise<void> {
    const slargs = data.split("|");
    const result = this._wss.closeServer();

    this._window.webContents.send("appsvc", "asyncstopWebSocketServerComplete|" + slargs[0] + "|" + result);
  }

  async getMinecraftGameProjectPath(_event: Electron.IpcMainInvokeEvent, data: string): Promise<void> {
    const slargs = data.split("|");

    if (slargs[1].length > 0) {
      let val = -1;

      try {
        val = parseInt(slargs[1]);

        if (val === 1 /* minecraftPreview */) {
          this._window.webContents.send(
            "appsvc",
            "asyncgetMinecraftGameProjectDeployDir|" + slargs[0] + "|" + this._localUtilities.minecraftPreviewPath
          );

          return;
        } else if (val === 2 /* remote web sockets */) {
          this._window.webContents.send("appsvc", "asyncgetMinecraftGameProjectDirComplete|" + slargs[0] + "|");

          return;
        }
      } catch (e) {
        // Ignore parse errors
      }
    }

    this._window.webContents.send(
      "appsvc",
      "asyncgetMinecraftGameProjectDeployDirComplete|" + slargs[0] + "|" + this._localUtilities.minecraftPath
    );
  }

  async getMinecraftGameWorldPath(_event: Electron.IpcMainInvokeEvent, data: string): Promise<void> {
    const slargs = data.split("|");
    let worldPath = "";

    if (slargs[1].length > 0) {
      let val = -1;

      try {
        val = parseInt(slargs[1]);

        worldPath = this._wss.getWebSocketWorldPath(val);
      } catch (e) {
        console.log("Error retrieving socket path: " + e);
      }
    }

    this._window.webContents.send(
      "appsvc",
      "asyncgetMinecraftGameWorldDeployDirComplete|" + slargs[0] + "|" + worldPath
    );
  }

  handleEventReceived(_server: MinecraftWebSocketServer, req: any): void {
    this._window.webContents.send("appsvc", "wsevent|" + JSON.stringify(req));
  }

  handleCommandCompleted(_server: MinecraftWebSocketServer, req: any): void {
    this._window.webContents.send(
      "appsvc",
      "asyncwebSocketCommandComplete|" + req.requestId + "|" + JSON.stringify(req.result)
    );
  }

  handleClientConnected(_server: MinecraftWebSocketServer, _message: any): void {
    this._window.webContents.send("appsvc", "webSocketConnected|");
  }

  handleClientDisconnected(_server: MinecraftWebSocketServer, _message: any): void {
    this._window.webContents.send("appsvc", "webSocketDisconnected|");
  }
}

export default WebSocketCommandHandler;
