// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * HttpStorage.ts
 *
 * ARCHITECTURE DOCUMENTATION
 * ==========================
 *
 * HttpStorage is a client-side storage implementation that fetches content
 * via HTTP and receives real-time updates via WebSocket notifications.
 *
 * REAL-TIME SYNCHRONIZATION:
 * --------------------------
 * 1. HttpStorage connects to /ws/notifications WebSocket endpoint
 * 2. Subscribes to file/folder change events for specific slots
 * 3. When notifications arrive, converts them to standard IStorage events
 * 4. Consumers (MCWorld, etc.) subscribe to these events
 *
 * DATA FLOW:
 * ----------
 * NodeStorage (fs.watch) -> HttpServer (broadcast) -> WebSocket ->
 *   HttpStorage (this) -> notifyFileAdded/Removed/Updated -> MCWorld -> WorldView
 *
 * WEBSOCKET PROTOCOL:
 * -------------------
 * - Connect: ws://host:port/ws/notifications?token=<authToken>
 * - Subscribe: { header: {..., messageType: "subscriptionRequest", messagePurpose: "subscribe" },
 *               body: { eventNames: ["fileChanged", "fileAdded", ...], slot: 0 } }
 * - Receive: IServerNotification messages with file/folder change details
 *
 * RELATED FILES:
 * --------------
 * - IServerNotification.ts: WebSocket message format definitions
 * - IStorageWatcher.ts: INotificationReceiver interface
 * - HttpServer.ts: Server-side WebSocket broadcaster
 * - NodeStorage.ts: Server-side file watcher source
 *
 * USAGE:
 * ------
 * const storage = HttpStorage.get("http://localhost:6126/api/worldContent/0/");
 * storage.authToken = "encrypted-token";
 * await storage.connectToNotifications();
 * storage.onFileAdded.subscribe((sender, file) => console.log("File added:", file.name));
 */

import HttpFolder from "./HttpFolder";
import StorageBase from "./StorageBase";
import IStorage from "./IStorage";
import Log from "../core/Log";
import { INotificationReceiver } from "./IStorageWatcher";
import { FileUpdateType } from "./IFile";
import { EventDispatcher } from "ste-events";

/**
 * Notification message structure from server.
 * Matches IServerNotification from IServerNotification.ts
 */
interface IServerNotificationMessage {
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
    category?: string;
    path?: string;
    [key: string]: any;
  };
}

export default class HttpStorage extends StorageBase implements IStorage, INotificationReceiver {
  rootFolder: HttpFolder;

  baseUrl: string;

  /**
   * Bearer token for Authorization header.
   * When set, requests will include "Authorization: Bearer <token>" header.
   * This is used for authenticated endpoints like /api/content.
   */
  authToken?: string;

  /**
   * When true (default), the storage is read-only and write operations will throw.
   * Set to false to enable HTTP PUT/DELETE operations for editing content.
   */
  readOnly: boolean = true;

  /** WebSocket connection for receiving notifications */
  private _webSocket: WebSocket | null = null;

  /** Currently subscribed event names */
  private _subscribedEvents: Set<string> = new Set();

  /** Server slot this storage is associated with (for filtering notifications) */
  private _slot?: number;

  /** Whether we're currently connected to the notification server */
  private _isConnected: boolean = false;

  /** Reconnection timer */
  private _reconnectTimer?: any;

  /** Whether auto-reconnect is enabled */
  private _autoReconnect: boolean = true;

  /**
   * Event fired when the server sends a shutdown notification.
   * This indicates the entire MCT server is shutting down (not just a BDS instance).
   * Subscribers should show appropriate UI feedback and disable auto-reconnect.
   * Args: (reason: string, graceful: boolean)
   */
  private _onServerShutdown = new EventDispatcher<HttpStorage, { reason: string; graceful: boolean }>();

  /**
   * Subscribe to server shutdown notifications.
   * This is fired when the MCT server is about to shut down.
   */
  public get onServerShutdown() {
    return this._onServerShutdown.asEvent();
  }

  /**
   * Static cache of HttpStorage instances by base URL.
   * Used to avoid creating duplicate storage instances for the same URL.
   */
  private static _storageCache: Map<string, HttpStorage> = new Map();

  /**
   * Get or create an HttpStorage instance for the given base URL.
   * Reuses cached instances to avoid creating duplicates.
   * @param baseUrl The base URL for the storage
   * @returns A cached or new HttpStorage instance
   */
  static get(baseUrl: string): HttpStorage {
    // Normalize the URL to ensure consistent caching
    let normalizedUrl = baseUrl;
    if (!normalizedUrl.endsWith(StorageBase.slashFolderDelimiter)) {
      normalizedUrl += StorageBase.slashFolderDelimiter;
    }

    let storage = HttpStorage._storageCache.get(normalizedUrl);
    if (!storage) {
      storage = new HttpStorage(baseUrl);
      HttpStorage._storageCache.set(normalizedUrl, storage);
    }
    return storage;
  }

  /**
   * Clear the storage cache. Useful for testing or when storage should be refreshed.
   */
  static clearCache() {
    HttpStorage._storageCache.clear();
  }

  constructor(newUrl: string) {
    super();

    this.baseUrl = newUrl;

    if (!this.baseUrl.endsWith(StorageBase.slashFolderDelimiter)) {
      this.baseUrl += StorageBase.slashFolderDelimiter;
    }

    this.rootFolder = new HttpFolder(this, null, "");
  }

  async getAvailable() {
    this.available = true;

    return this.available;
  }

  get isConnected(): boolean {
    return this._isConnected;
  }

  /**
   * Get the underlying WebSocket connection.
   * Can be used to listen for raw notifications (e.g., debug stats).
   */
  get webSocket(): WebSocket | null {
    return this._webSocket;
  }

  /**
   * Set the slot number for filtering notifications.
   */
  set slot(value: number | undefined) {
    this._slot = value;
  }

  get slot(): number | undefined {
    return this._slot;
  }

  /**
   * Connect to the WebSocket notification endpoint.
   * The WebSocket URL is derived from the baseUrl.
   *
   * @param url Optional override URL for the WebSocket endpoint
   * @param authToken Optional auth token (uses this.authToken if not provided)
   */
  async connect(url?: string, authToken?: string): Promise<void> {
    if (this._isConnected) {
      return;
    }

    const token = authToken || this.authToken;
    if (!token) {
      Log.debug("Cannot connect to notifications: no auth token");
      return;
    }

    // Derive WebSocket URL from baseUrl if not provided
    let wsUrl = url;
    if (!wsUrl) {
      // Convert http(s)://host:port/api/... to ws(s)://host:port/ws/notifications
      // Handle both absolute URLs and relative URLs (using window.location as base)
      let urlObj: URL;
      try {
        // First try as absolute URL
        urlObj = new URL(this.baseUrl);
      } catch {
        // If that fails, treat as relative URL and use current page location as base
        // Use globalThis to safely access window in a cross-platform way
        const globalWindow = globalThis as { location?: { origin?: string } };
        if (globalWindow.location?.origin) {
          urlObj = new URL(this.baseUrl, globalWindow.location.origin);
        } else {
          Log.message("[HttpStorage] Cannot derive WebSocket URL: no window.location available");
          return;
        }
      }
      const wsProtocol = urlObj.protocol === "https:" ? "wss:" : "ws:";
      wsUrl = `${wsProtocol}//${urlObj.host}/ws/notifications`;
    }

    // Add auth token as query parameter
    wsUrl += `?token=${encodeURIComponent(token)}`;

    try {
      this._webSocket = new WebSocket(wsUrl);

      // Set up event handlers
      this._webSocket.onopen = () => {
        this._isConnected = true;
        Log.verbose(`[HttpStorage] WebSocket connected to ${wsUrl?.split("?")[0]}`);

        // Re-subscribe to any previously subscribed events
        if (this._subscribedEvents.size > 0) {
          this._sendSubscription("subscribe", Array.from(this._subscribedEvents));
        }
      };

      this._webSocket.onclose = () => {
        this._isConnected = false;
        Log.verbose("[HttpStorage] WebSocket connection closed");

        // Auto-reconnect after a delay
        if (this._autoReconnect && !this._reconnectTimer) {
          this._reconnectTimer = setTimeout(() => {
            this._reconnectTimer = undefined;
            this.connect(url, authToken).catch((err) => {
              Log.debug("[HttpStorage] WebSocket reconnection failed: " + err);
            });
          }, 5000);
        }
      };

      this._webSocket.onerror = (error) => {
        Log.message("[HttpStorage] WebSocket error: " + error);
      };

      this._webSocket.onmessage = (event) => {
        Log.debug("[HttpStorage] Received WebSocket message: " + event.data.substring(0, 200));
        this._handleNotification(event.data);
      };

      // Wait for connection to be established
      await new Promise<void>((resolve, reject) => {
        if (!this._webSocket) {
          reject(new Error("WebSocket not created"));
          return;
        }

        const onOpen = () => {
          this._webSocket?.removeEventListener("open", onOpen);
          this._webSocket?.removeEventListener("error", onError);
          resolve();
        };

        const onError = (e: Event) => {
          this._webSocket?.removeEventListener("open", onOpen);
          this._webSocket?.removeEventListener("error", onError);
          reject(new Error("WebSocket connection failed"));
        };

        if (this._webSocket.readyState === WebSocket.OPEN) {
          resolve();
        } else {
          this._webSocket.addEventListener("open", onOpen);
          this._webSocket.addEventListener("error", onError);
        }
      });
    } catch (e) {
      Log.debug("Failed to connect to notification server: " + e);
      throw e;
    }
  }

  /**
   * Disconnect from the WebSocket notification server.
   */
  disconnect(): void {
    this._autoReconnect = false;

    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = undefined;
    }

    if (this._webSocket) {
      this._webSocket.close();
      this._webSocket = null;
    }

    this._isConnected = false;
  }

  /**
   * Subscribe to specific event types.
   *
   * @param eventNames Array of event names to subscribe to
   * @param slot Optional slot number to filter events
   */
  async subscribe(eventNames: string[], slot?: number): Promise<void> {
    for (const name of eventNames) {
      this._subscribedEvents.add(name);
    }

    if (slot !== undefined) {
      this._slot = slot;
    }

    if (this._isConnected) {
      this._sendSubscription("subscribe", eventNames);
    }
  }

  /**
   * Unsubscribe from specific event types.
   */
  async unsubscribe(eventNames: string[]): Promise<void> {
    for (const name of eventNames) {
      this._subscribedEvents.delete(name);
    }

    if (this._isConnected) {
      this._sendSubscription("unsubscribe", eventNames);
    }
  }

  /**
   * Send a subscription request to the server.
   */
  private _sendSubscription(purpose: "subscribe" | "unsubscribe", eventNames: string[]): void {
    if (!this._webSocket || this._webSocket.readyState !== WebSocket.OPEN) {
      return;
    }

    const request = {
      header: {
        version: 1,
        requestId: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
        messageType: "subscriptionRequest",
        messagePurpose: purpose,
      },
      body: {
        eventNames: eventNames,
        slot: this._slot,
      },
    };

    Log.message(`[HttpStorage] Sending subscription request: ${JSON.stringify(request)}`);
    this._webSocket.send(JSON.stringify(request));
  }

  /**
   * Handle an incoming notification message.
   */
  private async _handleNotification(data: string): Promise<void> {
    try {
      const message: IServerNotificationMessage = JSON.parse(data);

      Log.debug(
        `[HttpStorage] _handleNotification: messageType=${message.header?.messageType}, eventName=${message.body?.eventName}, path=${message.body?.path}, category=${message.body?.category}`
      );

      if (message.header.messageType !== "notification") {
        Log.debug(`[HttpStorage] Skipping non-notification message: ${message.header.messageType}`);
        return;
      }

      const { eventName, path, category } = message.body;

      // Handle server shutdown notification specially
      if (eventName === "serverShutdown") {
        const reason = message.body.reason || "Server shutting down";
        const graceful = message.body.graceful !== false; // Default to true if not specified

        Log.verbose(`[HttpStorage] Server shutdown notification received: ${reason}`);

        // Disable auto-reconnect since the server is going away intentionally
        this._autoReconnect = false;

        // Dispatch the shutdown event to subscribers
        this._onServerShutdown.dispatch(this, { reason, graceful });
        return;
      }

      // Skip if not a file/folder event
      if (!path) {
        Log.debug(`[HttpStorage] Skipping notification without path: ${eventName}`);
        return;
      }

      // The server sends paths relative to the category storage (e.g., /db/000040.ldb for world storage)
      // We need to prepend the category to get the full path relative to worldContentStorage
      // e.g., /world/db/000040.ldb for the world category
      // Note: getFileFromRelativePath expects paths to start with /
      let fullPath = path;
      if (category && !path.startsWith(category + "/") && !path.startsWith("/" + category + "/")) {
        // Prepend category, handling leading slashes
        const cleanPath = path.startsWith("/") ? path.substring(1) : path;
        fullPath = `/${category}/${cleanPath}`;
      }
      // Ensure fullPath starts with /
      if (!fullPath.startsWith("/")) {
        fullPath = "/" + fullPath;
      }

      Log.message(`[HttpStorage] Processing ${eventName} for path: ${path} -> ${fullPath}`);

      // Convert the notification to storage events
      switch (eventName) {
        case "fileAdded": {
          // Ensure the file exists in our folder structure and notify
          const file = await this.rootFolder.ensureFileFromRelativePath(fullPath);
          Log.debug(`[HttpStorage] fileAdded: ensured file=${file?.fullPath}`);
          if (file) {
            this.notifyFileAdded(file);
          }
          break;
        }

        case "fileRemoved": {
          this.notifyFileRemoved(fullPath);
          Log.debug(`[HttpStorage] fileRemoved: notified for ${fullPath}`);
          break;
        }

        case "fileChanged": {
          // Reload the file content and notify
          try {
            const file = await this.rootFolder.getFileFromRelativePath(fullPath);
            if (file) {
              // Force reload content
              await file.loadContent(true);
              this.notifyFileContentsUpdated({
                file: file,
                updateType: FileUpdateType.externalChange,
                sourceId: "websocket",
              });
            } else {
              Log.debug(`[HttpStorage] fileChanged: file not found for path ${fullPath}`);
            }
          } catch (fileErr) {
            Log.error(`[HttpStorage] fileChanged: error processing ${fullPath}: ${fileErr}`);
          }
          break;
        }

        case "folderChanged": {
          // Reload the folder and notify
          const folder = await this.rootFolder.getFolderFromRelativePath(fullPath);
          Log.debug(`[HttpStorage] folderChanged: got folder=${folder?.fullPath}`);
          if (folder) {
            await folder.scanForChanges();
            this.notifyFolderAdded(folder);
          }
          break;
        }
      }

      Log.message(`[HttpStorage] Processed notification: ${eventName} ${fullPath}`);
    } catch (e) {
      Log.message(`[HttpStorage] Error handling notification: ` + e);
    }
  }
}
