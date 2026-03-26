// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import CreatorTools, { CreatorToolsMinecraftErrorStatus, CreatorToolsMinecraftState } from "./CreatorTools";
import {
  CreatorToolsServerAuthenticationResult,
  CreatorToolsServerStatus,
  DedicatedServerStatus,
  ISlotConfig,
} from "./CreatorToolsAuthentication";
import IMinecraft, { IMinecraftMessage, IPrepareAndStartResult, PrepareAndStartResultType } from "./IMinecraft";
import axios, { AxiosError, AxiosResponse } from "axios";
import { EventDispatcher } from "ste-events";
import Project from "./Project";
import MinecraftPush from "./MinecraftPush";
import ZipStorage from "../storage/ZipStorage";
import StorageUtilities from "../storage/StorageUtilities";
import Log from "../core/Log";
import GameStateManager from "../minecraft/GameStateManager";
import IFolder from "../storage/IFolder";
import IStorage from "../storage/IStorage";
import HttpStorage from "../storage/HttpStorage";
import MinecraftUtilities from "../minecraft/MinecraftUtilities";
import ProjectExporter from "./ProjectExporter";
import ProjectAutogeneration from "./ProjectAutogeneration";
import { StatusTopic } from "./Status";
import IActionSetData from "../actions/IActionSetData";

/**
 * WebSocket notification message format from the server.
 */
interface IStatusUpdateNotification {
  header: {
    version: number;
    requestId: string;
    messageType: string;
    messagePurpose: string;
  };
  body: {
    eventName: string;
    timestamp: number;
    slot?: number;
    status?: number;
    recentMessages?: Array<{
      message: string;
      received: number;
      type?: number;
    }>;
  };
}

export default class RemoteMinecraft implements IMinecraft {
  private _creatorTools: CreatorTools;
  public state: CreatorToolsMinecraftState;
  private _project: Project | undefined;
  private _lastFullPush: ZipStorage | undefined;
  private _onStateChanged = new EventDispatcher<IMinecraft, CreatorToolsMinecraftState>();
  private _gameStateManager: GameStateManager;

  private _nextPollInterval = 500;
  private _pollIntervalCount = 0;

  // WebSocket for status notifications
  private _webSocket: WebSocket | null = null;
  private _useWebSocket = true; // Try WebSocket first, fall back to polling
  private _wsReconnectTimer: ReturnType<typeof setTimeout> | undefined;

  errorStatus?: CreatorToolsMinecraftErrorStatus;
  errorMessage?: string;

  /**
   * Configuration metadata for the slot, received once at connection time.
   * Contains flags like debuggerEnabled and debuggerStreamingEnabled that
   * inform the UI about what features are available.
   */
  slotConfig?: ISlotConfig;

  worldFolder: IFolder | undefined;
  projectFolder: IFolder | undefined;
  worldContentStorage: IStorage | undefined;
  worldProject: Project | undefined;

  /**
   * Map of connected player names to their info (position, xuid, etc.)
   * Updated when playerJoined/playerLeft/playerMoved events are received via WebSocket.
   */
  private _connectedPlayers: Map<
    string,
    { name: string; xuid?: string; position?: { x: number; y: number; z: number }; dimension?: string }
  > = new Map();

  private _onPlayersChanged = new EventDispatcher<IMinecraft, string[]>();

  private messagesReceived: { [received: number]: IMinecraftMessage } = {};

  private _onWorldStorageReady = new EventDispatcher<IMinecraft, IFolder>();
  private _onProjectStorageReady = new EventDispatcher<IMinecraft, IFolder>();
  private _onMessage = new EventDispatcher<IMinecraft, IMinecraftMessage>();
  private _onWorldContentChanged = new EventDispatcher<
    IMinecraft,
    { eventName: string; category: string; path: string; slot: number }
  >();

  /**
   * Event fired when the MCT server sends a shutdown notification.
   * This indicates the entire server is shutting down (not just a BDS instance).
   * Args: { reason: string, graceful: boolean }
   */
  private _onServerShutdown = new EventDispatcher<IMinecraft, { reason: string; graceful: boolean }>();

  public get onWorldFolderReady() {
    return this._onWorldStorageReady.asEvent();
  }

  public get onProjectFolderReady() {
    return this._onProjectStorageReady.asEvent();
  }

  public get onMessage() {
    return this._onMessage.asEvent();
  }

  /**
   * Event fired when world content files change on the server.
   * This allows the WorldView component to refresh its data.
   */
  public get onWorldContentChanged() {
    return this._onWorldContentChanged.asEvent();
  }

  /**
   * Event fired when the connected players list changes (join/leave).
   * Returns array of player names currently connected.
   */
  public get onPlayersChanged() {
    return this._onPlayersChanged.asEvent();
  }

  /**
   * Event fired when the MCT server is shutting down.
   * Subscribers should show appropriate UI feedback (e.g., banner message)
   * and understand the connection will be lost.
   */
  public get onServerShutdown() {
    return this._onServerShutdown.asEvent();
  }

  /**
   * Get array of currently connected player names.
   */
  public get connectedPlayerNames(): string[] {
    return Array.from(this._connectedPlayers.keys());
  }

  /**
   * Get detailed info for all connected players.
   */
  public get connectedPlayers(): Array<{
    name: string;
    xuid?: string;
    position?: { x: number; y: number; z: number };
    dimension?: string;
  }> {
    return Array.from(this._connectedPlayers.values());
  }

  get canDeployFiles() {
    return true;
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

  public get onStateChanged() {
    return this._onStateChanged.asEvent();
  }

  public get onRefreshed() {
    return this._onStateChanged.asEvent();
  }

  canPrepare() {
    return true;
  }

  constructor(creatorTools: CreatorTools) {
    this._creatorTools = creatorTools;
    this.state = CreatorToolsMinecraftState.none;
    this._gameStateManager = new GameStateManager(this._creatorTools);

    this.doHeartbeat = this.doHeartbeat.bind(this);
    this._handleWebSocketMessage = this._handleWebSocketMessage.bind(this);
  }

  async updateStatus() {
    return this.state;
  }

  setState(newState: CreatorToolsMinecraftState) {
    if (this.state === newState) {
      return;
    }

    this.state = newState;
    this._onStateChanged.dispatch(this, this.state);
  }

  processExternalMessage(command: string, data: string): void {
    switch (command.toLowerCase()) {
      case "wsevent":
        try {
          const eventObj = JSON.parse(data);
          this._gameStateManager.handleEvent(eventObj);
        } catch (e) {
          Log.verbose("Failed to parse message: " + e);
        }
        break;
    }
  }

  async prepare(force?: boolean) {}

  /**
   * Initialize the worldContentStorage with an HttpStorage pointing to the server's
   * /api/worldContent/{slot}/ endpoint. This provides access to the server's
   * behavior_packs, resource_packs, and world folders.
   *
   * Also establishes a WebSocket connection for real-time file change notifications.
   */
  private async initWorldContentStorage() {
    const baseUrl = this._creatorTools.fullRemoteServerUrl;
    const slot = this._creatorTools.remoteServerPort ?? 0;

    if (!baseUrl) {
      Log.debug("Cannot initialize worldContentStorage: no remote server URL");
      return;
    }

    // Create HttpStorage pointing to /api/worldContent/{slot}/
    // Note: baseUrl already ends with slash from fullRemoteServerUrl
    const worldContentUrl = `${baseUrl}api/worldContent/${slot}/`;
    const storage = new HttpStorage(worldContentUrl);

    // Set slot so UI components can make slot-specific API calls
    storage.slot = slot;

    // Set auth token so requests are authenticated
    if (this._creatorTools.remoteServerAuthToken) {
      storage.authToken = this._creatorTools.remoteServerAuthToken;
    }

    this.worldContentStorage = storage;

    // Connect to the WebSocket notification server for real-time file updates
    // This allows WorldView to receive updates when files change on the server
    try {
      // Derive WebSocket URL from the base URL
      const wsBaseUrl = baseUrl.replace(/^http/, "ws");
      const wsUrl = `${wsBaseUrl}ws/notifications`;

      Log.message(`[RemoteMinecraft] Connecting HttpStorage WebSocket to ${wsUrl}`);
      await storage.connect(wsUrl, this._creatorTools.remoteServerAuthToken);

      // Subscribe to file change events for this slot
      await storage.subscribe(["fileAdded", "fileChanged", "fileRemoved", "folderChanged"], slot);

      Log.message(`[RemoteMinecraft] HttpStorage WebSocket connected and subscribed for slot ${slot}`);
    } catch (e) {
      Log.debug("Failed to connect HttpStorage WebSocket (falling back to polling): " + e);
      // File updates will still work but won't be real-time
    }

    // Also initialize the worldFolder for WorldView to use
    await this.initWorldFolder();
  }

  /**
   * Initialize the worldFolder from worldContentStorage for WorldDisplay rendering.
   * The world folder is at /world/ within the worldContentStorage.
   */
  private async initWorldFolder() {
    if (!this.worldContentStorage) {
      return;
    }

    try {
      // Get the world folder from worldContentStorage
      // The server exposes /api/worldContent/{slot}/world/ which maps to the active world
      this.worldFolder = this.worldContentStorage.rootFolder.ensureFolder("world");
      await this.worldFolder.load();

      // Dispatch the event so WorldView knows the folder is ready
      this._onWorldStorageReady.dispatch(this, this.worldFolder);
    } catch (e) {
      Log.debug("Error initializing worldFolder: " + e);
    }
  }

  /**
   * Connect to the WebSocket notification endpoint for real-time status updates.
   * Falls back to polling if WebSocket connection fails.
   */
  private async connectWebSocket(): Promise<boolean> {
    const baseUrl = this._creatorTools.fullRemoteServerUrl;
    const token = this._creatorTools.remoteServerAuthToken;

    if (!baseUrl || !token) {
      Log.debug("Cannot connect WebSocket: missing URL or token");
      return false;
    }

    try {
      // Derive WebSocket URL from baseUrl
      const urlObj = new URL(baseUrl);
      const wsProtocol = urlObj.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${wsProtocol}//${urlObj.host}/ws/notifications?token=${encodeURIComponent(token)}`;

      this._webSocket = new WebSocket(wsUrl);

      return new Promise<boolean>((resolve) => {
        if (!this._webSocket) {
          resolve(false);
          return;
        }

        this._webSocket.onopen = () => {
          Log.verbose("WebSocket connected for status updates");

          // Subscribe to statusUpdate events for this slot
          const slot = this._creatorTools.remoteServerPort ?? 0;
          const subscribeMessage = {
            header: {
              version: 1,
              requestId: Date.now().toString(),
              messageType: "subscriptionRequest",
              messagePurpose: "subscribe",
            },
            body: {
              eventNames: [
                "statusUpdate",
                "playerJoined",
                "playerLeft",
                "serverStateChanged",
                "playerMoved",
                "gameEvent",
              ],
              slot: slot,
            },
          };
          this._webSocket?.send(JSON.stringify(subscribeMessage));

          resolve(true);
        };

        this._webSocket.onclose = () => {
          Log.verbose("WebSocket disconnected, falling back to polling");
          this._webSocket = null;

          // If we were using WebSocket, try to reconnect after a delay
          if (this._useWebSocket && !this._wsReconnectTimer) {
            this._wsReconnectTimer = setTimeout(() => {
              this._wsReconnectTimer = undefined;
              if (this._useWebSocket && this.state !== CreatorToolsMinecraftState.disconnected) {
                this.connectWebSocket().catch(() => {
                  // Fall back to polling if reconnection fails
                  this.startPolling();
                });
              }
            }, 5000);
          } else {
            // Fall back to polling
            this.startPolling();
          }
        };

        this._webSocket.onerror = () => {
          Log.debug("WebSocket error, will fall back to polling");
          resolve(false);
        };

        this._webSocket.onmessage = (event) => {
          this._handleWebSocketMessage(event.data);
        };

        // Timeout if connection doesn't establish quickly
        setTimeout(() => {
          if (this._webSocket?.readyState !== WebSocket.OPEN) {
            resolve(false);
          }
        }, 5000);
      });
    } catch (e) {
      Log.debug("Failed to connect WebSocket: " + e);
      return false;
    }
  }

  /**
   * Handle incoming WebSocket messages for status updates.
   */
  private _handleWebSocketMessage(data: string) {
    try {
      const notification = JSON.parse(data) as IStatusUpdateNotification;

      if (notification.body?.eventName === "statusUpdate") {
        // Process the status update
        const slot = notification.body.slot ?? 0;
        const status: CreatorToolsServerStatus = {
          id: slot,
          time: notification.body.timestamp,
          status: notification.body.status,
          recentMessages: notification.body.recentMessages?.map((msg) => ({
            message: msg.message,
            received: msg.received,
          })),
        };
        this.processServerStatus(status);
      } else if (notification.body?.eventName === "playerJoined") {
        // Track player connection
        const joinBody = notification.body as { playerName?: string; xuid?: string };
        if (joinBody.playerName) {
          this._connectedPlayers.set(joinBody.playerName, {
            name: joinBody.playerName,
            xuid: joinBody.xuid,
          });
          Log.message(`Player joined: ${joinBody.playerName}`);
          this._onPlayersChanged.dispatch(this, this.connectedPlayerNames);
        }
      } else if (notification.body?.eventName === "playerLeft") {
        // Remove player from tracking
        const leaveBody = notification.body as { playerName?: string };
        if (leaveBody.playerName) {
          this._connectedPlayers.delete(leaveBody.playerName);
          Log.message(`Player left: ${leaveBody.playerName}`);
          this._onPlayersChanged.dispatch(this, this.connectedPlayerNames);
        }
      } else if (notification.body?.eventName === "playerMoved") {
        // Handle player movement updates
        const moveBody = notification.body as {
          playerName?: string;
          position?: { x: number; y: number; z: number };
          dimension?: string;
        };
        if (moveBody.playerName && moveBody.position) {
          // Update player position in our tracking map
          const existing = this._connectedPlayers.get(moveBody.playerName);
          this._connectedPlayers.set(moveBody.playerName, {
            name: moveBody.playerName,
            xuid: existing?.xuid,
            position: moveBody.position,
            dimension: moveBody.dimension,
          });
        }
        if (moveBody.position) {
          // Convert to a PlayerTravelled-style event for GameStateManager
          const playerTravelledEvent = {
            eventId: `move_${Date.now()}`,
            header: {
              eventName: "PlayerTravelled",
              purpose: "event",
              version: 1,
            },
            body: {
              isUnderwater: false,
              metersTravelled: 0,
              newBiome: 0,
              player: {
                color: "",
                dimension: 0,
                id: 0,
                name: moveBody.playerName ?? "unknown",
                position: moveBody.position,
                type: "player",
                variant: 0,
                yRot: 0,
              },
              travelMethod: 0,
            },
          };
          this._gameStateManager.handleEvent(playerTravelledEvent);
        }
      } else if (notification.body?.eventName === "gameEvent") {
        // Handle generic game events from Minecraft
        const gameEventBody = notification.body as { data?: object };
        if (gameEventBody.data) {
          this._gameStateManager.handleEvent(gameEventBody.data);
        }
      } else if (
        notification.body?.eventName === "fileAdded" ||
        notification.body?.eventName === "fileChanged" ||
        notification.body?.eventName === "fileRemoved" ||
        notification.body?.eventName === "folderChanged"
      ) {
        // Handle storage change notifications for world content
        const changeBody = notification.body as {
          eventName: string;
          slot?: number;
          category?: string;
          path?: string;
        };
        Log.message(
          `[RemoteMinecraft] Storage change notification: ${changeBody.eventName} ${changeBody.category}${changeBody.path} (slot ${changeBody.slot})`
        );

        // Dispatch the world content changed event
        this._onWorldContentChanged.dispatch(this, {
          eventName: changeBody.eventName,
          category: changeBody.category ?? "",
          path: changeBody.path ?? "",
          slot: changeBody.slot ?? 0,
        });
      } else if (notification.body?.eventName === "serverShutdown") {
        // Handle server shutdown notification
        const shutdownBody = notification.body as { reason?: string; graceful?: boolean };
        const reason = shutdownBody.reason || "Server shutting down";
        const graceful = shutdownBody.graceful !== false; // Default to true

        // Use notifyStatusUpdate for more visible user notification
        const shutdownMessage = `Server shutdown: ${reason}`;
        Log.message(`[RemoteMinecraft] ${shutdownMessage}`);
        this._creatorTools.notifyStatusUpdate(shutdownMessage, StatusTopic.general);

        // Disable WebSocket reconnection since the server is intentionally going away
        this._useWebSocket = false;

        // Dispatch the shutdown event for UI to handle
        this._onServerShutdown.dispatch(this, { reason, graceful });
      }
    } catch (e) {
      Log.debug("Error handling WebSocket message: " + e);
    }
  }

  /**
   * Disconnect WebSocket and clean up.
   */
  private disconnectWebSocket() {
    if (this._wsReconnectTimer) {
      clearTimeout(this._wsReconnectTimer);
      this._wsReconnectTimer = undefined;
    }

    if (this._webSocket) {
      this._webSocket.close();
      this._webSocket = null;
    }
  }

  /**
   * Start polling for status updates (fallback when WebSocket is unavailable).
   */
  private startPolling() {
    if (this._nextPollInterval < 0) {
      return; // Polling disabled
    }

    // @ts-ignore
    window.setTimeout(this.doHeartbeat, this._nextPollInterval);
  }

  /**
   * Lazily create a Project wrapper for the worldContentStorage.
   * This allows treating the server's world content as a Project.
   */
  async ensureWorldProject(): Promise<Project | undefined> {
    if (this.worldProject) {
      return this.worldProject;
    }

    if (!this.worldContentStorage) {
      await this.initWorldContentStorage();
    }

    if (!this.worldContentStorage) {
      return undefined;
    }

    // Create a Project that wraps the world content storage
    this.worldProject = new Project(this._creatorTools, "World Content", null);
    this.worldProject.setProjectFolder(this.worldContentStorage.rootFolder);

    return this.worldProject;
  }

  async prepareAndStart(push: MinecraftPush): Promise<IPrepareAndStartResult> {
    if (!this._creatorTools.remoteServerAuthToken) {
      Log.debug(
        "Remote server auth token is not set. Please connect to a remote server or select a different server mode."
      );
      return {
        type: PrepareAndStartResultType.error,
        errorMessage:
          "No remote server authentication token is available. Please connect to a remote server first, or switch to a different server mode (e.g., Host Minecraft Server).",
      };
    }

    this.setState(CreatorToolsMinecraftState.preparing);

    if (!push.project) {
      return {
        type: PrepareAndStartResultType.started,
      };
    }

    await ProjectAutogeneration.updateProjectAutogeneration(push.project, false);

    const zipStorage = new ZipStorage();

    //await StorageUtilities.syncFolderTo(carto.deploymentStorage.rootFolder, zipStorage.rootFolder, true, true, false);

    await ProjectExporter.deployProject(this._creatorTools, push.project, zipStorage.rootFolder);

    await zipStorage.rootFolder.saveAll();

    // consider doing a diff from the last push.
    if (this._lastFullPush) {
      const differenceSet = await StorageUtilities.getDifferences(
        this._lastFullPush.rootFolder,
        zipStorage.rootFolder,
        true,
        false
      );

      this._lastFullPush = zipStorage;

      // we don't have to do anything here. (may need a force flag here at some point)
      if (differenceSet.fileDifferences.length === 0 && differenceSet.folderDifferences.length === 0) {
        Log.message("No changes detected in this update. No push is being made.");
        return {
          type: PrepareAndStartResultType.error,
        };
      }

      if (!differenceSet.getHasDeletions()) {
        const diffUpdate = new ZipStorage();

        await differenceSet.copyFileUpdatesAndAdds(diffUpdate);
        await diffUpdate.rootFolder.saveAll();

        const diffBinary = await diffUpdate.generateBlobAsync();

        this._creatorTools.notifyStatusUpdate("Uploading changed files to " + this._creatorTools.fullRemoteServerUrl);

        const isReloadable = MinecraftUtilities.isReloadableSetOfChanges(differenceSet);

        try {
          await axios({
            method: "patch",
            url: this.getBaseApiUrl() + "upload/", //API url
            headers: {
              Authorization: "Bearer mctauth=" + this._creatorTools.remoteServerAuthToken,
              "Content-Type": "application/zip",
              "mcttools-reloadable": isReloadable,
            },
            data: diffBinary, // Buffer
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
          });
        } catch (error) {
          const eulaResult = this._handleUploadError(error);
          if (eulaResult) {
            return eulaResult;
          }
          throw error;
        }

        this._creatorTools.notifyStatusUpdate("Upload complete");
        return {
          type: PrepareAndStartResultType.started,
        };
      }
    }

    this._creatorTools.notifyStatusUpdate("Files created in zip. Packaging");

    const zipBinary = await zipStorage.generateBlobAsync();

    this._lastFullPush = zipStorage;

    this._creatorTools.notifyStatusUpdate("Uploading to " + this._creatorTools.fullRemoteServerUrl);

    try {
      await axios({
        method: "post",
        url: this.getBaseApiUrl() + "upload/", //API url
        headers: {
          Authorization: "Bearer mctauth=" + this._creatorTools.remoteServerAuthToken,
          "Content-Type": "application/zip",
        },
        data: zipBinary, // Buffer
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });
    } catch (error) {
      const eulaResult = this._handleUploadError(error);
      if (eulaResult) {
        return eulaResult;
      }
      throw error;
    }

    this.setState(CreatorToolsMinecraftState.prepared);

    this._creatorTools.notifyStatusUpdate("Upload complete");

    return {
      type: PrepareAndStartResultType.started,
    };
  }

  /**
   * Handle upload errors, specifically the EULA_REQUIRED 451 error.
   * Returns an error result if EULA is required, otherwise returns undefined
   * to let the caller re-throw the error.
   */
  private _handleUploadError(error: unknown): IPrepareAndStartResult | undefined {
    const axiosError = error as AxiosError;
    if (axiosError.response?.status === 451) {
      // HTTP 451 "Unavailable For Legal Reasons" - EULA not accepted
      const responseData = axiosError.response.data as { eulaRequired?: boolean; message?: string };
      if (responseData?.eulaRequired) {
        // Set the flag so the UI shows the EulaAcceptancePanel
        this._creatorTools.remoteServerEulaAccepted = false;
        this._creatorTools.notifyStatusUpdate(
          "EULA acceptance required. Please accept the Minecraft EULA to deploy content."
        );
        this.setState(CreatorToolsMinecraftState.initialized);
        return {
          type: PrepareAndStartResultType.error,
          errorMessage: responseData.message || "EULA acceptance required",
        };
      }
    }
    return undefined;
  }

  async runActionSet(actionSet: IActionSetData): Promise<any> {
    return undefined;
  }

  async runCommand(command: string) {
    if (!this._creatorTools.remoteServerAuthToken) {
      Log.throwUnexpectedUndefined("RC");
      return;
    }

    this.resetInterval();

    const result = await axios({
      method: "post",
      url: this.getBaseApiUrl() + "command/", //API url
      headers: {
        Authorization: "Bearer mctauth=" + this._creatorTools.remoteServerAuthToken,
      },
      data: command,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    return result.data as string;
  }

  getBaseApiUrl(): string {
    if (!this._creatorTools.fullRemoteServerUrl) {
      Log.throwUnexpectedUndefined("GBAU");
      return "";
    }

    let port = this._creatorTools.remoteServerPort;

    if (!port) {
      port = 0;
    }

    // Note: fullRemoteServerUrl already ends with slash
    return this._creatorTools.fullRemoteServerUrl + "api/" + port + "/";
  }

  async initSession(slot: number) {}

  async syncWithDeployment() {}

  async stop() {
    const baseUrl = this._creatorTools.fullRemoteServerUrl;
    const token = this._creatorTools.remoteServerAuthToken;
    const slot = this._creatorTools.remoteServerPort ?? 0;

    if (!baseUrl || !token) {
      Log.debug("Cannot stop: not connected to remote server");
      return;
    }

    try {
      Log.message("Stopping remote server...");
      this.setState(CreatorToolsMinecraftState.stopping);

      await axios({
        method: "POST",
        url: `${baseUrl}api/${slot}/stop`,
        headers: {
          Authorization: "Bearer " + token,
        },
      });

      this.setState(CreatorToolsMinecraftState.stopped);
      Log.message("Remote server stopped");
    } catch (e: any) {
      Log.error("Failed to stop remote server: " + (e.message || e));
      this.errorMessage = "Failed to stop server";
    }
  }

  async restart() {
    const baseUrl = this._creatorTools.fullRemoteServerUrl;
    const token = this._creatorTools.remoteServerAuthToken;
    const slot = this._creatorTools.remoteServerPort ?? 0;

    if (!baseUrl || !token) {
      Log.debug("Cannot restart: not connected to remote server");
      return;
    }

    try {
      Log.message("Restarting remote server...");
      this.setState(CreatorToolsMinecraftState.stopping);

      await axios({
        method: "POST",
        url: `${baseUrl}api/${slot}/restart`,
        headers: {
          Authorization: "Bearer " + token,
        },
      });

      // Server will report its new state via WebSocket
      Log.message("Remote server restart initiated");
    } catch (e: any) {
      Log.error("Failed to restart remote server: " + (e.message || e));
      this.errorMessage = "Failed to restart server";
    }
  }

  async processServerStatus(newStatus: CreatorToolsServerStatus) {
    let wasActive = false;

    // Store slot config if provided and not already set (one-time at connection)
    if (newStatus.slotConfig && !this.slotConfig) {
      this.slotConfig = newStatus.slotConfig;
      Log.verbose(
        `Received slot config: debuggerEnabled=${newStatus.slotConfig.debuggerEnabled}, debuggerStreamingEnabled=${newStatus.slotConfig.debuggerStreamingEnabled}`
      );
    }

    if (newStatus.status) {
      switch (newStatus.status) {
        case DedicatedServerStatus.deploying:
          if (this.state !== CreatorToolsMinecraftState.preparing) {
            this.setState(CreatorToolsMinecraftState.preparing);
            wasActive = true;
          }
          break;
        case DedicatedServerStatus.launching:
          if (this.state !== CreatorToolsMinecraftState.starting) {
            this.setState(CreatorToolsMinecraftState.starting);
            wasActive = true;
          }
          break;
        case DedicatedServerStatus.starting:
          if (this.state !== CreatorToolsMinecraftState.starting) {
            this.setState(CreatorToolsMinecraftState.starting);
            wasActive = true;
          }
          break;
        case DedicatedServerStatus.started:
          if (this.state !== CreatorToolsMinecraftState.started) {
            this.setState(CreatorToolsMinecraftState.started);

            if (!this._creatorTools.successfullyConnectedToRemoteMinecraft) {
              this._creatorTools.successfullyConnectedToRemoteMinecraft = true;
              this._creatorTools.save();
            }

            // Initialize worldFolder when server has started so WorldView can render the map
            if (!this.worldFolder) {
              await this.initWorldContentStorage();
            }

            wasActive = true;
          }
          break;
        case DedicatedServerStatus.stopped:
          if (this.state !== CreatorToolsMinecraftState.stopped) {
            this.setState(CreatorToolsMinecraftState.stopped);
            wasActive = true;
          }
          break;
      }
    }

    if (newStatus.recentMessages) {
      for (const recentMessage of newStatus.recentMessages) {
        if (!this.messagesReceived[recentMessage.received]) {
          this.messagesReceived[recentMessage.received] = recentMessage;

          this._creatorTools.notifyStatusUpdate(recentMessage.message, StatusTopic.minecraft);

          this._onMessage.dispatch(this, recentMessage);
        }
      }
    }

    return wasActive;
  }

  resetInterval() {
    this._nextPollInterval = 100;
    this._pollIntervalCount = 0;
  }

  async doHeartbeat() {
    let wasActive = false;

    try {
      const result = await axios({
        method: "get",
        url: this.getBaseApiUrl() + "status/", //API url
        headers: {
          Authorization: "Bearer mctauth=" + this._creatorTools.remoteServerAuthToken,
        },
      });

      const obj = result.data as CreatorToolsServerStatus;

      if (obj) {
        wasActive = await this.processServerStatus(obj);
      }
    } catch (e: any) {
      if (e && e.response && (e as AxiosError).response?.status === 404) {
        this.errorMessage = "Did not find an active server at " + this.getBaseApiUrl();
        this.setState(CreatorToolsMinecraftState.disconnected);
        return;
      }

      this.errorMessage = "Disconnected from server.";
      this.setState(CreatorToolsMinecraftState.disconnected);
      return;
    }

    if (this._nextPollInterval >= 0) {
      if (wasActive) {
        this._nextPollInterval = 100;
        this._pollIntervalCount = 0;
      } else {
        this._pollIntervalCount++;

        // back off our polling if nothing interesting is happening
        if (this._pollIntervalCount === 50 && this._nextPollInterval < 500) {
          this._nextPollInterval = 500;
          this._pollIntervalCount = 0;
        } else if (this._pollIntervalCount === 50 && this._nextPollInterval === 500) {
          this._nextPollInterval = 5000;
          this._pollIntervalCount = 0;
        }
      }

      // @ts-ignore
      window.setTimeout(this.doHeartbeat, this._nextPollInterval);
    }
  }

  async initialize() {
    const url = this._creatorTools.fullRemoteServerUrl;
    this._nextPollInterval = -1;

    if (
      this.state === CreatorToolsMinecraftState.initialized ||
      this.state === CreatorToolsMinecraftState.preparing ||
      this.state === CreatorToolsMinecraftState.prepared ||
      this.state === CreatorToolsMinecraftState.starting ||
      this.state === CreatorToolsMinecraftState.started
    ) {
      return;
    }

    this.setState(CreatorToolsMinecraftState.initialized);

    if (!this._creatorTools || !url || !this._creatorTools.remoteServerPasscode) {
      this.errorMessage = "Not fully configured.";
      this.errorStatus = CreatorToolsMinecraftErrorStatus.configuration;
      return;
    }

    let authReq: AxiosResponse | undefined;

    try {
      authReq = await axios.post(url + "api/auth/", "passcode=" + this._creatorTools.remoteServerPasscode);

      if (authReq === undefined) {
        this.errorMessage = "Could not connect to server.";
        this.errorStatus = CreatorToolsMinecraftErrorStatus.loginFailed;
        this.setState(CreatorToolsMinecraftState.error);
        return;
      }

      if (authReq.status !== 200) {
        this.errorMessage = "Login failed.";
        this.errorStatus = CreatorToolsMinecraftErrorStatus.loginFailed;
        this.setState(CreatorToolsMinecraftState.error);
        return;
      }

      let result: CreatorToolsServerAuthenticationResult | undefined;

      if (typeof authReq.data === "string") {
        result = JSON.parse(authReq.data);
      } else if (typeof authReq.data === "object") {
        result = authReq.data;
      }

      if (result === undefined) {
        this.errorMessage = "Unexpected server error.";
        this.errorStatus = CreatorToolsMinecraftErrorStatus.serverError;
        this.setState(CreatorToolsMinecraftState.error);

        return;
      }

      this.setState(CreatorToolsMinecraftState.initialized);

      // Build the full auth token including authTag for GCM encryption validation
      this._creatorTools.remoteServerAuthToken =
        result.token + "|" + result.iv + (result.authTag ? "|" + result.authTag : "");
      this._creatorTools.remoteServerAccessLevel = result.permissionLevel;
      this._creatorTools.remoteServerEulaAccepted = result.eulaAccepted;

      // Auto-select the first active slot from the server response
      // This handles cases where the server is running on a non-default slot
      let desiredSlot = this._creatorTools.remoteServerPort;
      let foundActiveSlot = false;

      // Check if the desired slot has an active server
      if (desiredSlot !== undefined && result.serverStatus[desiredSlot]?.id >= 0) {
        foundActiveSlot = true;
      }

      // If desired slot has no active server, find the first active slot
      if (!foundActiveSlot) {
        for (const slotStr in result.serverStatus) {
          const slot = parseInt(slotStr, 10);
          const status = result.serverStatus[slot];
          if (status && status.id >= 0) {
            Log.verbose("Auto-selecting active slot " + slot + " (was " + desiredSlot + ")");
            desiredSlot = slot;
            this._creatorTools.remoteServerPort = slot;
            foundActiveSlot = true;
            break;
          }
        }
      }

      // Initialize world content storage with HttpStorage pointing to the server's worldContent endpoint
      await this.initWorldContentStorage();

      if (foundActiveSlot && desiredSlot !== undefined && result.serverStatus[desiredSlot]) {
        const status = result.serverStatus[desiredSlot];
        await this.processServerStatus(status);
      }

      await this._creatorTools.save();

      // Try WebSocket first for real-time status updates
      // Falls back to polling if WebSocket connection fails
      const wsConnected = await this.connectWebSocket();

      if (wsConnected) {
        Log.verbose("Using WebSocket for status updates");
        this._useWebSocket = true;
        this._nextPollInterval = -1; // Disable polling when using WebSocket
      } else {
        Log.verbose("WebSocket not available, using polling for status updates");
        this._useWebSocket = false;
        this._nextPollInterval = 500;
        this.startPolling();
      }
    } catch (e: any) {
      this.errorMessage = e.toString();

      if (this.errorMessage && this.errorMessage.indexOf("401") >= 0) {
        this.errorStatus = CreatorToolsMinecraftErrorStatus.loginFailed;
        this.setState(CreatorToolsMinecraftState.error);
      } else {
        this.errorStatus = CreatorToolsMinecraftErrorStatus.serverUnavailable;
        this.setState(CreatorToolsMinecraftState.error);
      }
    }
  }
}
