import WebSocket, { WebSocketServer } from "ws";
import { v4 as uuid } from "uuid";
import * as http from "http";
import { EventDispatcher } from "ste-events";
import Log from "../core/Log";
import { MinecraftGameConnectionMode } from "../app/ICreatorToolsData";
import LocalEnvironment from "./LocalEnvironment";
import NodeStorage from "./NodeStorage";
import * as fs from "fs";
import Utilities from "../core/Utilities";
import SecurityUtilities from "../core/SecurityUtilities";

export default class MinecraftWebSocketServer {
  private _port = 19136;
  server: http.Server | undefined;
  private _wss: WebSocketServer | undefined;
  private _ws: WebSocket | undefined;
  private _env: LocalEnvironment;

  private _pendingCommands: string[] = [];
  private _pendingCommandIds: string[] = [];
  private _pendingRequestIds: string[] = [];
  private _pendingData: any[] = [];

  private _curEventIndex = 0;
  private _eventSeed: string;
  private _onClientConnected = new EventDispatcher<MinecraftWebSocketServer, string>();
  private _onClientDisconnected = new EventDispatcher<MinecraftWebSocketServer, string>();

  private _onCommandCompleted = new EventDispatcher<
    MinecraftWebSocketServer,
    { requestId: string; result: object; data: any }
  >();
  private _onEventReceived = new EventDispatcher<MinecraftWebSocketServer, object>();

  private _currentCommandId = 0;

  constructor(env: LocalEnvironment) {
    this._env = env;
    this._eventSeed = Utilities.createRandomId(4);

    this._handleMessage = this._handleMessage.bind(this);
    this._handleConnection = this._handleConnection.bind(this);
    this.openServer = this.openServer.bind(this);
    this.executeNextCommand = this.executeNextCommand.bind(this);
  }

  public get onCommandCompleted() {
    return this._onCommandCompleted.asEvent();
  }

  public get onEventReceived() {
    return this._onEventReceived.asEvent();
  }

  public get onClientConnected() {
    return this._onClientConnected.asEvent();
  }

  public get onClientDisconnected() {
    return this._onClientDisconnected.asEvent();
  }

  runCommand(command: string, requestId: string, data: any) {
    // Security: Sanitize command
    const sanitizedCommand = SecurityUtilities.sanitizeCommand(command);
    if (!SecurityUtilities.isCommandSafe(sanitizedCommand)) {
      Log.message("WebSocket command rejected as unsafe: " + command);
      return;
    }

    const newCommand = this._pendingCommands.length;

    this._pendingCommands[newCommand] = sanitizedCommand;
    this._pendingCommandIds[newCommand] = uuid();
    this._pendingRequestIds[newCommand] = requestId;
    this._pendingData[newCommand] = data;

    if (newCommand === this._currentCommandId) {
      this.executeNextCommand();
    }
  }

  executeNextCommand() {
    if (this._currentCommandId < this._pendingCommands.length) {
      this._currentCommandId++;

      const nextCommand = this._currentCommandId - 1;

      const commandLine = this._pendingCommands[nextCommand];
      const commandId = this._pendingCommandIds[nextCommand];

      const nextCommandStr = JSON.stringify({
        header: {
          version: 1,
          requestId: commandId,
          messageType: "commandRequest",
          messagePurpose: "commandRequest",
        },
        body: {
          //          version: 22,  NOTE: if version is not included in request msg,
          //                        MC *should* use latest command version
          commandLine: commandLine,
          origin: {
            type: "server",
          },
        },
      });

      Log.message("Command " + this._currentCommandId + " sent:" + nextCommandStr);

      if (this._ws) {
        this._ws.send(nextCommandStr);
      }
    }
  }

  public getWebSocketWorldPath(state: MinecraftGameConnectionMode) {
    if (state === MinecraftGameConnectionMode.remoteMinecraft) {
      return "";
    }

    let sourcePath = "";

    if (state === MinecraftGameConnectionMode.localMinecraftPreview) {
      sourcePath = this._env.utilities.minecraftPreviewUwpPath;
    } else {
      sourcePath = this._env.utilities.minecraftUwpPath;
    }

    const worldPath =
      NodeStorage.ensureEndsWithDelimiter(sourcePath) + "minecraftWorlds" + NodeStorage.platformFolderDelimiter;

    const subfolders = fs.readdirSync(worldPath);

    let maxTime = 0;
    let maxPath = "";

    if (subfolders) {
      for (let i = 0; i < subfolders.length; i++) {
        const subfolder = subfolders[i];

        const stat = fs.statSync(worldPath + subfolder);

        if (stat.isDirectory()) {
          if (stat.mtimeMs > maxTime) {
            maxTime = stat.mtimeMs;
            maxPath = worldPath + subfolder + NodeStorage.platformFolderDelimiter;
          }
        }
      }
    }

    console.log("Reading path " + worldPath + "|" + maxPath);

    return maxPath;
  }

  public closeServer() {
    if (!this.server) {
      return;
    }
  }

  public openServer(){
    if (this.server) {
      return;
    }

    console.log("Starting Minecraft websocket server on port " + this._port);

    this.server = http.createServer();
    this._wss = new WebSocketServer({ server: this.server });

    this.server.on("error", (e) => {
      Log.message("Error on server." + e);
    });

    this._wss.on("connection", this._handleConnection);
    this._wss.on("close", this._handleDisconnection);
    this._wss.on("error", (e) => {
      Log.message("Error on web socket server." + e);
    });

    try {
      this.server.listen(this._port, () => {
        Log.message("Minecraft websocket server started on port " + this._port + ".");
      });
    } catch (e) {
      Log.message("Error opening port " + this._port + ".");
    }
  }

  _handleMessage(message: string) {
    if (!message) {
      return;
    }

    try {
      if (message.indexOf("{") >= 0) {
        const struct = JSON.parse(message);

        if (struct.body !== undefined && struct.header !== undefined && struct.header.messagePurpose !== undefined) {
          const purpose = struct.header.messagePurpose;

          if (purpose === "commandResponse") {
            Log.message("Received command response: " + struct.header.requestId + "(" + message + ")");

            const commandId = struct.header.requestId.toLowerCase();

            let found = false;

            for (let i = this._pendingCommandIds.length - 1; i >= 0; i--) {
              const _reqId = this._pendingCommandIds[i];

              if (_reqId.toLowerCase() === commandId) {
                console.log("Found request id " + _reqId);

                this._onCommandCompleted.dispatch(this, {
                  requestId: this._pendingRequestIds[i],
                  result: struct.body,
                  data: this._pendingData[i],
                });

                found = true;
                break;
              }
            }

            if (!found) {
              Log.debug("Could not find a matching request for id " + commandId);
            }

            this.executeNextCommand();
          } else if (purpose === "event") {
            Log.message("Received event: " + struct.header.eventName + "(" + message + ")");

            struct.eventId = this._eventSeed + ++this._curEventIndex;

            this._onEventReceived.dispatch(this, struct);
          }
        }
      }
    } catch (e) {
      console.log("Error processing command: " + e);
    }
  }

  _handleConnection(ws: WebSocket) {
    // Close existing connection if present
    if (this._ws && this._ws.readyState === WebSocket.OPEN) {
      Log.message("Closing existing WebSocket connection to accept new client");
      this._ws.close(1000, "New client connected");
    }

    this._ws = ws;

    ws.send(
      JSON.stringify({
        header: {
          version: 1,
          requestId: uuid(),
          messageType: "commandRequest",
          messagePurpose: "subscribe",
        },
        body: {
          eventName: "PlayerMessage",
        },
      })
    );

    ws.send(
      JSON.stringify({
        header: {
          version: 1,
          requestId: uuid(),
          messageType: "commandRequest",
          messagePurpose: "subscribe",
        },
        body: {
          eventName: "PlayerTravelled",
        },
      })
    );

    ws.send(
      JSON.stringify({
        header: {
          version: 1,
          requestId: uuid(),
          messageType: "commandRequest",
          messagePurpose: "subscribe",
        },
        body: {
          eventName: "PlayerTeleported",
        },
      })
    );

    ws.send(
      JSON.stringify({
        header: {
          version: 1,
          requestId: uuid(),
          messageType: "commandRequest",
          messagePurpose: "subscribe",
        },
        body: {
          eventName: "WorldGenerated",
        },
      })
    );

    ws.send(
      JSON.stringify({
        header: {
          version: 1,
          requestId: uuid(),
          messageType: "commandRequest",
          messagePurpose: "subscribe",
        },
        body: {
          eventName: "WorldLoaded",
        },
      })
    );

    ws.send(
      JSON.stringify({
        header: {
          version: 1,
          requestId: uuid(),
          messageType: "commandRequest",
          messagePurpose: "subscribe",
        },
        body: {
          eventName: "PlayerJoin",
        },
      })
    );

    ws.send(
      JSON.stringify({
        header: {
          version: 1,
          requestId: uuid(),
          messageType: "commandRequest",
          messagePurpose: "subscribe",
        },
        body: {
          eventName: "PlayerLeave",
        },
      })
    );

    ws.send(
      JSON.stringify({
        header: {
          version: 1,
          requestId: uuid(),
          messageType: "commandRequest",
          messagePurpose: "subscribe",
        },
        body: {
          eventName: "SlashCommandExecuted",
        },
      })
    );

    ws.send(
      JSON.stringify({
        header: {
          version: 1,
          requestId: uuid(),
          messageType: "commandRequest",
          messagePurpose: "subscribe",
        },
        body: {
          eventName: "ItemAcquired",
        },
      })
    );

    ws.send(
      JSON.stringify({
        header: {
          version: 1,
          requestId: uuid(),
          messageType: "commandRequest",
          messagePurpose: "subscribe",
        },
        body: {
          eventName: "ItemCrafted",
        },
      })
    );

    ws.send(
      JSON.stringify({
        header: {
          version: 1,
          requestId: uuid(),
          messageType: "commandRequest",
          messagePurpose: "subscribe",
        },
        body: {
          eventName: "ItemEquipped",
        },
      })
    );

    ws.send(
      JSON.stringify({
        header: {
          version: 1,
          requestId: uuid(),
          messageType: "commandRequest",
          messagePurpose: "subscribe",
        },
        body: {
          eventName: "PlayerTransform",
        },
      })
    );

    ws.send(
      JSON.stringify({
        header: {
          version: 1,
          requestId: uuid(),
          messageType: "commandRequest",
          messagePurpose: "subscribe",
        },
        body: {
          eventName: "ItemUsed",
        },
      })
    );

    ws.send(
      JSON.stringify({
        header: {
          version: 1,
          requestId: uuid(),
          messageType: "commandRequest",
          messagePurpose: "subscribe",
        },
        body: {
          eventName: "ItemInteracted",
        },
      })
    );

    ws.send(
      JSON.stringify({
        header: {
          version: 1,
          requestId: uuid(),
          messageType: "commandRequest",
          messagePurpose: "subscribe",
        },
        body: {
          eventName: "BlockPlaced",
        },
      })
    );

    ws.send(
      JSON.stringify({
        header: {
          version: 1,
          requestId: uuid(),
          messageType: "commandRequest",
          messagePurpose: "subscribe",
        },
        body: {
          eventName: "BlockBroken",
        },
      })
    );

    ws.on("message", this._handleMessage);

    console.log("Inbound web socket connection.");

    this._onClientConnected.dispatch(this, ws.url);
  }

  _handleDisconnection(ws: WebSocket) {
    this._ws = undefined;

    this._onClientDisconnected.dispatch(this, ws.url);
  }
}
