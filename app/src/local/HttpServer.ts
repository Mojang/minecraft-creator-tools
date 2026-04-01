/**
 * ARCHITECTURE DOCUMENTATION: HttpServer - Web Server and Real-Time Notification Hub
 * ===================================================================================
 *
 * HttpServer provides the HTTP/HTTPS server for Minecraft Creator Tools and serves as
 * a central hub for real-time client notifications via WebSocket connections. It exposes
 * REST APIs for server management and proxies events from DedicatedServer instances.
 *
 * ## Core Responsibilities
 *
 * 1. **HTTP Server**: Serves static files, API endpoints, and the web application
 * 2. **WebSocket Notifications**: Broadcasts real-time events to connected clients
 * 3. **Storage Watching**: Monitors NodeStorage for file changes and broadcasts updates
 * 4. **Authentication**: Manages session tokens and permission levels
 * 5. **MCP Server Integration**: Hosts Model Context Protocol server
 * 6. **Server Management API**: REST endpoints for controlling DedicatedServer instances
 *
 * ## API Architecture
 *
 * The HTTP server exposes REST endpoints for remote server management:
 *
 * ```
 * /api/auth              - Authentication with passcode
 * /api/<slot>/start      - Start a DedicatedServer on the specified slot
 * /api/<slot>/stop       - Stop the server on the specified slot
 * /api/<slot>/status     - Get server status and recent log messages
 * /api/<slot>/command    - Send a slash command to the server
 * /api/<slot>/deploy     - Deploy add-on content to the server
 * /api/content/<path>    - Access files when in view/edit mode
 * /api/validate          - Validate Minecraft content
 * /api/shutdown          - Graceful shutdown (view mode only)
 * /api/acceptEula        - Accept Minecraft EULA (admin only, enables BDS features)
 * /api/eulaStatus        - Check if EULA has been accepted
 * /api/commands          - List available ToolCommands
 * /api/commands/<cmd>    - Execute a ToolCommand (POST with args/flags JSON body)
 * ```
 *
 * ## Real-Time Sync Architecture
 *
 * HttpServer sits between server-side file changes and client-side updates:
 *
 * ```
 * NodeStorage (fs.watch)  ──→  HttpServer  ──→  WebSocket  ──→  HttpStorage (client)
 *      │                           │                                   │
 *      └── IStorageChangeEvent ────┘                                   │
 *                                  │                                   │
 *                   IServerNotification ─────────────────→  onFileUpdated event
 *                                                                      │
 *                                                               MCWorld ─→ WorldView
 * ```
 *
 * ## WebSocket Event Types
 *
 * The WebSocket connection broadcasts various event types to clients:
 *
 * | Event Name         | Description                                     |
 * |--------------------|-------------------------------------------------|
 * | statusUpdate       | Server status changed (starting, started, etc.)|
 * | playerJoined       | Player connected to the Minecraft server        |
 * | playerLeft         | Player disconnected from the server             |
 * | playerMoved        | Player position changed (from position polling) |
 * | storage/change     | File in watched storage was modified            |
 * | debugConnected     | Script debugger connection established          |
 * | debugStats         | Profiling statistics from script debugger       |
 * | gameEvent          | Generic game event from server                  |
 * | serverShutdown     | MCT server is shutting down (sent before close) |
 *
 * ## Storage Watcher Integration
 *
 * The server maintains watchers for NodeStorage instances and converts storage events
 * to WebSocket notifications:
 *
 * - **startWatchingStorage()**: Registers a storage for watching with a unique slot ID
 * - **stopWatchingStorage()**: Stops watching a specific storage
 * - **stopAllStorageWatchers()**: Cleanup when server stops
 * - **_handleStorageChange()**: Converts IStorageChangeEvent to IServerNotification
 *
 * ## Authentication & Permission Levels
 *
 * Four permission levels control access to different features:
 *
 * | Level              | Access                                          |
 * |--------------------|-------------------------------------------------|
 * | displayReadOnly    | View server status and logs                     |
 * | fullReadOnly       | Above + file browsing                           |
 * | updateState        | Above + start/stop servers, deploy content      |
 * | admin              | Full access including shutdown                  |
 *
 * Passcodes are set via command line and validated using encrypted tokens.
 *
 * ## SSL/TLS Support (Experimental)
 *
 * HttpServer supports experimental HTTPS via command-line configuration:
 * - Certificate and key files specified at startup
 * - Not persisted to disk for security
 * - Optional HTTPS-only mode
 *
 * ## Integration with ServerManager
 *
 * HttpServer receives events from ServerManager and converts them to notifications:
 *
 * ```
 * DedicatedServer ──► ServerManager ──► HttpServer ──► WebSocket Clients
 *       │                  │                │
 *       │                  │ bubbleServerStarted
 *       │                  │     │
 *       │                  │     └─► notify({ eventName: 'statusUpdate', ... })
 *       │                  │
 *       │                  │ bubblePlayerConnected
 *       │                  │     │
 *       │                  │     └─► notify({ eventName: 'playerJoined', ... })
 * ```
 *
 * ## Related Files
 *
 * - ServerManager.ts: Creates HttpServer and forwards server events
 * - IServerNotification.ts: Notification message types
 * - NodeStorage.ts: Server-side file watching with fs.watch()
 * - HttpStorage.ts: Client-side notification receiver
 * - IStorageWatcher.ts: Interface definitions for watcher system
 * - MinecraftMcpServer.ts: MCP server for AI tool integration
 *
 * ## Key Methods
 *
 * - init(): Initialize HTTP/HTTPS server and WebSocket
 * - stop(): Cleanup resources including storage watchers
 * - notify(): Broadcast notification to all connected WebSocket clients
 * - notifyStatusUpdate(): Send server status change to a specific slot
 * - sendNotificationToSlot(): Send notification to clients subscribed to a slot
 * - startWatchingStorage(): Begin monitoring a NodeStorage instance
 * - processRequest(): Main HTTP request handler and router
 */
import * as http from "http";
import * as https from "https";
import * as fs from "fs";
import WebSocket, { WebSocketServer, RawData } from "ws";
import { v4 as uuid } from "uuid";
import ServerManager, { ServerManagerFeatures } from "./ServerManager";
import { WorldBackupType } from "./IWorldBackupData";
import LocalEnvironment from "./LocalEnvironment";
import NodeStorage from "./NodeStorage";
import * as crypto from "crypto";
import { IAuthenticationToken, ServerPermissionLevel } from "./IAuthenticationToken";
import Log from "../core/Log";
import ZipStorage from "../storage/ZipStorage";
import CreatorTools from "../app/CreatorTools";
import CreatorToolsHost from "../app/CreatorToolsHost";
import { ISlotConfig } from "../app/CreatorToolsAuthentication";
import DedicatedServer, { DedicatedServerStatus, OutputLine } from "./DedicatedServer";
import SecurityUtilities from "../core/SecurityUtilities";
// import { Http2ServerRequest, Http2ServerResponse } from "http2";
import Project from "../app/Project";
import { ProjectInfoSuite } from "../info/IProjectInfoData";
import ProjectInfoSet from "../info/ProjectInfoSet";
import ProjectInfoUtilities from "../info/ProjectInfoUtilities";
import IProjectMetaState from "../info/IProjectMetaState";
import MinecraftMcpServer from "./MinecraftMcpServer";
import HttpUtilities from "./HttpUtilities";
import Utilities from "../core/Utilities";
import HttpStorage from "../storage/HttpStorage";
import IStorage from "../storage/IStorage";
import IFolder from "../storage/IFolder";
import ISslConfig from "./ISslConfig";
import LocalUtilities from "./LocalUtilities";
import { IStorageChangeEvent } from "../storage/IStorageWatcher";
import {
  initializeToolCommands,
  ToolCommandRegistry,
  IToolCommandOutput,
  ToolCommandContextFactory,
  ToolCommandScope,
} from "../app/toolcommands";
import { registerNodeOnlyCommands } from "../app/toolcommands/registerNodeCommands";
import { IServerNotification, IServerNotificationBody, ServerEventName } from "./IServerNotification";
// these definitions are duplicated for the client and should be kept in sync in CartoAuthentication.ts
export interface CartoServerAuthenticationResponse {
  token?: string;
  iv?: string;
  authTag?: string; // GCM authentication tag
  permissionLevel: ServerPermissionLevel;
  serverStatus: CartoServerStatusResponse[];
  /** Whether the Minecraft EULA has been accepted (required for BDS features) */
  eulaAccepted?: boolean;
}

export interface CartoServerStatusResponse {
  id: number;
  status?: DedicatedServerStatus;
  time: number;
  /** Recent log messages from the server */
  recentMessages?: OutputLine[];
  /** Slot configuration - included in initial auth response */
  slotConfig?: ISlotConfig;
  /** World ID currently associated with this slot */
  worldId?: string;
}

export default class HttpServer {
  host = "localhost";
  public port = 80;

  public creatorTools: CreatorTools | undefined;

  headers = {
    "Access-Control-Allow-Origin": "http://localhost:6126", // Restrict to known origins
    "Access-Control-Allow-Methods": "OPTIONS, POST, GET",
    "Access-Control-Max-Age": 86400, // 24 hours instead of 30 days
    "Access-Control-Allow-Headers": "Content-Type, Authorization, mctpc",
    "Access-Control-Allow-Credentials": "true",
  };

  private _webStorage: NodeStorage;
  private _resStorage: NodeStorage;
  private _dataStorage: NodeStorage;
  private _distStorage: NodeStorage;
  private _schemasStorage: NodeStorage;
  private _formsStorage: NodeStorage | undefined;
  private _esbuildWasmStorage: NodeStorage | undefined;

  private _serverManager: ServerManager;
  private _localEnvironment: LocalEnvironment;
  private _algorithm = "aes-256-gcm";

  private _httpsServer: https.Server | undefined;
  private _httpServer: http.Server | undefined;

  private _mcpServer: MinecraftMcpServer | undefined;
  private _pwdHash: Buffer | undefined;

  // Track whether the server is listening and ready to accept connections
  private _isListeningMetaFlag: boolean = false;
  private _readyResolvers: (() => void)[] = [];

  /**
   * Returns true if the HTTP server is actually listening and accepting connections.
   * This checks the underlying server state, not just the flag.
   */
  public get isListening(): boolean {
    if (!this._isListeningMetaFlag) {
      return false;
    }
    // Check if the underlying server is still bound
    if (this._httpServer && this._httpServer.listening) {
      return true;
    }
    if (this._httpsServer && this._httpsServer.listening) {
      return true;
    }

    return false;
  }

  /**
   * Returns a promise that resolves when the server is ready to accept connections.
   * If the server is already listening, resolves immediately.
   * @param timeoutMs Optional timeout in milliseconds. If provided and the server
   *   doesn't become ready in time, the promise rejects with a timeout error.
   */
  public waitForReady(timeoutMs?: number): Promise<void> {
    if (this._isListeningMetaFlag) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | undefined;

      const onReady = () => {
        if (timer !== undefined) {
          clearTimeout(timer);
        }
        resolve();
      };

      this._readyResolvers.push(onReady);

      if (timeoutMs !== undefined && timeoutMs > 0) {
        timer = setTimeout(() => {
          const idx = this._readyResolvers.indexOf(onReady);
          if (idx !== -1) {
            this._readyResolvers.splice(idx, 1);
          }
          reject(new Error(`HTTP server did not become ready within ${timeoutMs}ms`));
        }, timeoutMs);
      }
    });
  }

  /**
   * Called when the server starts listening to mark it as ready and resolve any pending waiters.
   */
  private _markAsListening(): void {
    this._isListeningMetaFlag = true;
    for (const resolve of this._readyResolvers) {
      resolve();
    }
    this._readyResolvers = [];
  }

  // Experimental SSL configuration - passed via command line, not persisted
  private _sslConfig?: ISslConfig;

  public get sslConfig(): ISslConfig | undefined {
    return this._sslConfig;
  }

  public set sslConfig(config: ISslConfig | undefined) {
    this._sslConfig = config;
  }

  // Temporary content registry for serving dynamic content (e.g., project geometry for rendering)
  private _tempContent: Map<string, { content: string | Uint8Array; contentType: string }> = new Map();

  // Content storage for view mode - serves local files via /api/content
  private _contentStorage: NodeStorage | undefined;
  private _contentPath: string | undefined;

  // View mode flag - when true, the server is running in "view" context (from `mct view` command)
  // This enables the /api/shutdown endpoint for graceful shutdown
  private _isViewMode: boolean = false;

  // Edit mode flag - when true, the server allows write operations to content (from `mct edit` command)
  // This enables PUT/DELETE operations on /api/content endpoints
  private _isEditMode: boolean = false;

  // When true, requires authentication for /mcp even from localhost.
  // Set via --mcp-require-auth CLI flag. Default: false (localhost bypasses auth for MCP).
  private _mcpRequireAuth: boolean = false;

  // Promise to guard against concurrent MCP server initialization
  private _mcpServerInitPromise: Promise<void> | undefined;

  // WebSocket notification server for pushing updates to clients
  private _wsServer: WebSocketServer | undefined;
  private _wsClients: Map<
    WebSocket,
    {
      id: string;
      subscribedEvents: Set<ServerEventName>;
      slot?: number;
      permissionLevel?: ServerPermissionLevel;
    }
  > = new Map();

  // Storage watchers for file system change notifications
  // Maps storage instance to watcher ID for cleanup
  private _storageWatchers: Map<NodeStorage, string> = new Map();

  // Maps slot numbers to their associated storages for event routing
  private _slotStorages: Map<number, { storage: NodeStorage; category: string }[]> = new Map();

  // Security: Files that should never be served (security-sensitive or potentially dangerous)
  private static readonly BLOCKED_FILE_NAMES: Set<string> = new Set([
    "package.json",
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    ".env",
    ".env.local",
    ".env.development",
    ".env.production",
    ".npmrc",
    ".yarnrc",
    "tsconfig.json",
    "webpack.config.js",
    "vite.config.js",
    "rollup.config.js",
    ".gitignore",
    ".gitattributes",
    "dockerfile",
    "docker-compose.yml",
    "docker-compose.yaml",
    "makefile",
    "cmakelists.txt",
    ".htaccess",
    "web.config",
  ]);

  // Security: File extensions that are safe to serve
  private static readonly SAFE_EXTENSIONS: Set<string> = new Set([
    "json",
    "png",
    "jpg",
    "jpeg",
    "gif",
    "tga",
    "lang",
    "txt",
    "md",
    "mcfunction",
    "mcstructure",
    "mcworld",
    "mctemplate",
    "mcaddon",
    "mcpack",
    "material",
    "vertex",
    "geometry",
    "fragment",
    "nbt",
    "fsb",
    "ogg",
    "wav",
    "flac",
    "obj",
    "svg",
    // LevelDB files for world data
    "ldb",
    "log",
  ]);

  /** Whether local res/ storage includes the vanilla serve folder with PNG textures */
  private _hasLocalVanillaServe: boolean;

  constructor(localEnv: LocalEnvironment, serverManager: ServerManager) {
    this._serverManager = serverManager;
    this._webStorage = new NodeStorage(this.getRootPath() + "web/", "");
    this._resStorage = new NodeStorage(this.getResRootPath(), "");
    this._dataStorage = serverManager.dataStorage;
    this._distStorage = new NodeStorage(this.getRootPath() + "dist/", "");

    // Serve schemas and forms from @minecraft/bedrock-schemas package at runtime
    // instead of shipping copies in the build output.
    const bsRoot = LocalUtilities.bedrockSchemasRoot;
    if (bsRoot) {
      this._schemasStorage = new NodeStorage(bsRoot + "/schemas/", "");
      this._formsStorage = new NodeStorage(bsRoot + "/forms/", "");
    } else {
      this._schemasStorage = new NodeStorage(this.getRootPath() + "schemas/", "");
    }

    // Serve esbuild-wasm from its npm package at runtime instead of shipping
    // a copy in the build output (~13 MB savings). esbuild-wasm is a declared
    // dependency of the jsn package so it's always available.
    try {
      const esbuildWasmDir = require.resolve("esbuild-wasm/esbuild.wasm").replace(/[\\/]esbuild\.wasm$/, "/");
      this._esbuildWasmStorage = new NodeStorage(esbuildWasmDir, "");
    } catch {
      // esbuild-wasm not installed — fall back to dist/
    }

    // Check at init time if we have local vanilla serve textures.
    // When running from the app/ folder, public/res/ has a serve/ directory with
    // PNG-converted textures. The remote CDN (mctools.dev) may be missing some.
    const fs = require("fs");
    const resRoot = this.getResRootPath();
    this._hasLocalVanillaServe = fs.existsSync(
      resRoot + "latest/van/serve/resource_pack/textures/terrain_texture.json"
    );

    this._localEnvironment = localEnv;

    this.processRequest = this.processRequest.bind(this);
  }

  init() {
    const requestListener = this.processRequest;

    if (this._localEnvironment && this._localEnvironment.serverHostPort) {
      this.port = this._localEnvironment.serverHostPort;
    }

    if (this._localEnvironment && this._localEnvironment.serverDomainName) {
      this.host = this._localEnvironment.serverDomainName;
    }

    // Initialize HTTPS if experimental SSL config is provided
    if (this._sslConfig) {
      this.initHttps(requestListener);
    }

    // Initialize HTTP server (unless experimental SSL-only mode is enabled)
    if (!this._sslConfig?.httpsOnly) {
      this._httpServer = http.createServer(requestListener);

      // Bind to 127.0.0.1 when host is "localhost" to ensure IPv4 connectivity.
      // Node.js resolves "localhost" via the OS, which may return only ::1 (IPv6),
      // causing ECONNREFUSED for IPv4-only clients.
      const listenHost = this.host === "localhost" ? "127.0.0.1" : this.host;

      this._httpServer.listen(this.port, listenHost, () => {
        // Server started - mark as listening to unblock waiters
        this._markAsListening();
      });

      // Initialize WebSocket server for notifications
      this.initWebSocketServer(this._httpServer);
    }
  }

  /**
   * Initialize HTTPS server with experimental SSL configuration.
   * SSL config is passed via command line arguments - nothing is persisted.
   */
  private initHttps(requestListener: (req: http.IncomingMessage, res: http.ServerResponse) => void) {
    if (!this._sslConfig) {
      return;
    }

    try {
      const httpsOptions = this.buildHttpsOptions();
      const httpsPort = this._sslConfig.port ?? 443;

      this._httpsServer = https.createServer(httpsOptions, requestListener);
      const httpsListenHost = this.host === "localhost" ? "127.0.0.1" : this.host;
      this._httpsServer.listen(httpsPort, httpsListenHost, () => {
        Log.message(`(EXPERIMENTAL) Minecraft HTTPS server is running on https://${this.host}:${httpsPort}`);
        this._markAsListening();
      });
    } catch (error) {
      Log.fail(`Failed to initialize experimental HTTPS server: ${error}`);
      throw error;
    }
  }

  /**
   * Build HTTPS server options from experimental SSL configuration.
   */
  private buildHttpsOptions(): https.ServerOptions {
    if (!this._sslConfig) {
      throw new Error("SSL config is required for HTTPS");
    }

    const options: https.ServerOptions = {};

    if (this._sslConfig.pfxPath) {
      // PKCS12/PFX format
      if (!fs.existsSync(this._sslConfig.pfxPath)) {
        throw new Error(`Experimental SSL: PFX file not found: ${this._sslConfig.pfxPath}`);
      }
      options.pfx = fs.readFileSync(this._sslConfig.pfxPath);
      if (this._sslConfig.pfxPassphrase) {
        options.passphrase = this._sslConfig.pfxPassphrase;
      }
    } else if (this._sslConfig.certPath && this._sslConfig.keyPath) {
      // PEM format
      if (!fs.existsSync(this._sslConfig.certPath)) {
        throw new Error(`Experimental SSL: Certificate file not found: ${this._sslConfig.certPath}`);
      }
      if (!fs.existsSync(this._sslConfig.keyPath)) {
        throw new Error(`Experimental SSL: Key file not found: ${this._sslConfig.keyPath}`);
      }
      options.cert = fs.readFileSync(this._sslConfig.certPath);
      options.key = fs.readFileSync(this._sslConfig.keyPath);
    } else {
      throw new Error(
        "Experimental SSL configuration requires either (--experimental-ssl-cert + --experimental-ssl-key) or --experimental-ssl-pfx"
      );
    }

    // Optional CA chain
    if (this._sslConfig.caPath) {
      if (!fs.existsSync(this._sslConfig.caPath)) {
        throw new Error(`Experimental SSL: CA certificate file not found: ${this._sslConfig.caPath}`);
      }
      options.ca = fs.readFileSync(this._sslConfig.caPath);
    }

    return options;
  }

  /**
   * Initialize WebSocket server for pushing notifications to clients.
   * The WebSocket server shares the HTTP server and handles upgrade requests to /ws/notifications.
   */
  private initWebSocketServer(httpServer: http.Server) {
    this._wsServer = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 * 1024 });

    // Handle WebSocket connections
    this._wsServer.on("connection", (socket: WebSocket, req: http.IncomingMessage) => {
      this.handleWebSocketConnection(socket, req);
    });

    // Handle HTTP upgrade requests for WebSocket
    httpServer.on("upgrade", (request: http.IncomingMessage, socket: any, head: Buffer) => {
      const url = request.url || "";

      Log.verbose("WebSocket upgrade request received");

      // All WebSocket connections go through /ws/notifications.
      if (url.startsWith("/ws/notifications")) {
        // Authenticate the WebSocket connection
        const permissionLevel = this.authenticateWebSocketRequest(request);

        if (permissionLevel === undefined) {
          Log.debug("WebSocket upgrade rejected - authentication failed");
          socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
          socket.destroy();
          return;
        }

        Log.verbose("WebSocket upgrade accepted");
        this._wsServer!.handleUpgrade(request, socket, head, (ws) => {
          // Store permission level on the request for later use
          (request as any).permissionLevel = permissionLevel;
          this._wsServer!.emit("connection", ws, request);
        });
      } else {
        socket.destroy();
      }
    });
  }

  /**
   * Authenticate a WebSocket upgrade request.
   * Returns the permission level if authenticated, undefined otherwise.
   *
   * Requires a valid auth token via query string (?token=...) or mctauth cookie.
   * Localhost connections are NOT exempted — all WebSocket clients must authenticate.
   */
  private authenticateWebSocketRequest(req: http.IncomingMessage): ServerPermissionLevel | undefined {
    // Check for auth token in query string or cookie
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const tokenParam = url.searchParams.get("token");

    if (tokenParam) {
      return this.validateToken(tokenParam, req);
    }

    // Check cookies
    const cookies = this.parseCookies(req);
    const authCookie = cookies["mctauth"];
    if (authCookie) {
      return this.validateToken(authCookie, req);
    }

    return undefined;
  }

  /**
   * Handle a new WebSocket connection.
   */
  private handleWebSocketConnection(socket: WebSocket, req: http.IncomingMessage) {
    const clientId = uuid();
    const permissionLevel = (req as any).permissionLevel as ServerPermissionLevel | undefined;

    // Register the client
    this._wsClients.set(socket, {
      id: clientId,
      subscribedEvents: new Set(),
      permissionLevel: permissionLevel,
    });

    Log.verbose(`WebSocket client connected: ${clientId}`);

    // Handle messages from client (subscriptions)
    socket.on("message", (data: RawData) => {
      this.handleWebSocketMessage(socket, data);
    });

    // Handle client disconnect
    socket.on("close", () => {
      this._wsClients.delete(socket);
      Log.verbose(`WebSocket client disconnected: ${clientId}`);
    });

    socket.on("error", (err) => {
      Log.debug(`WebSocket error for client ${clientId}: ${err.message}`);
      this._wsClients.delete(socket);
    });
  }

  /**
   * Handle incoming WebSocket message (subscription requests).
   */
  private handleWebSocketMessage(socket: WebSocket, data: RawData) {
    try {
      const message = JSON.parse(data.toString());
      Log.verbose(`[HttpServer] Received WebSocket message: ${data.toString().substring(0, 200)}`);

      if (message.header?.messageType === "subscriptionRequest") {
        const client = this._wsClients.get(socket);
        if (!client) return;

        const { eventNames, slot } = message.body;

        if (message.header.messagePurpose === "subscribe") {
          // Add subscriptions
          for (const eventName of eventNames) {
            client.subscribedEvents.add(eventName);
          }
          if (slot !== undefined) {
            client.slot = slot;
          }
          Log.message(
            `[HttpServer] Client ${client.id} subscribed to events: ${eventNames.join(", ")} for slot ${slot}`
          );
        } else if (message.header.messagePurpose === "unsubscribe") {
          // Remove subscriptions
          for (const eventName of eventNames) {
            client.subscribedEvents.delete(eventName);
          }
        }

        // Send response
        const response = {
          header: {
            version: 1,
            requestId: message.header.requestId,
            messageType: "subscriptionResponse" as const,
            messagePurpose: "response" as const,
          },
          body: {
            success: true,
            subscribedEvents: Array.from(client.subscribedEvents),
          },
        };

        socket.send(JSON.stringify(response));
      }
    } catch (e) {
      Log.debug("Error handling WebSocket message: " + e);
    }
  }

  /**
   * Validate an encrypted auth token and return the permission level.
   */
  private validateToken(encryptedToken: string, req: http.IncomingMessage): ServerPermissionLevel | undefined {
    if (!encryptedToken || encryptedToken.indexOf("|") < 0) {
      return undefined;
    }

    try {
      const tokenParts = Utilities.splitUntil(encryptedToken, "|", 2);
      if (tokenParts.length < 2) {
        return undefined;
      }

      const content = tokenParts[0];
      const iv = tokenParts[1];
      const authTag = tokenParts.length >= 3 ? tokenParts[2] : undefined;

      const decryptedStr = this.decrypt(iv, content, authTag);
      const decryptedContent = SecurityUtilities.sanitizeJsonObject(JSON.parse(decryptedStr));

      if (decryptedContent.permissionLevel && decryptedContent.time) {
        // Verify fingerprint if present (for enhanced security)
        if (decryptedContent.fingerprint) {
          const userAgent = req.headers["user-agent"] as string | undefined;
          const clientIp = (req.socket?.remoteAddress || req.headers["x-forwarded-for"]) as string | undefined;
          const fingerprint = this.generateFingerprint(userAgent, clientIp);
          if (fingerprint !== decryptedContent.fingerprint) {
            Log.debug(`Token validation: fingerprint mismatch (IP: ${clientIp})`);
            return undefined;
          }
        }

        return decryptedContent.permissionLevel as ServerPermissionLevel;
      }
    } catch (e) {
      Log.debug("Token validation error: " + e);
    }

    return undefined;
  }

  /**
   * Broadcast a notification to all subscribed WebSocket clients.
   * @param notification The notification to broadcast
   */
  public broadcastNotification(notification: IServerNotification) {
    const eventName = notification.body.eventName;
    const slot = notification.body.slot;
    let sentCount = 0;
    let skippedCount = 0;

    // Log debug stats at verbose level to reduce noise (fires ~10x/sec)
    if (eventName === "debugStats") {
      const body = notification.body as any;
      Log.verbose(
        `[HttpServer] Broadcasting debugStats: slot=${slot}, tick=${body.tick}, statsCount=${body.stats?.length || 0}, wsClients=${this._wsClients.size}`
      );
    }

    for (const [socket, client] of this._wsClients) {
      // Check if client is subscribed to this event
      if (!client.subscribedEvents.has(eventName)) {
        if (eventName === "debugStats") {
          Log.verbose(
            `[HttpServer] Client ${client.id} not subscribed to debugStats (subscribed: ${Array.from(client.subscribedEvents).join(", ")})`
          );
        }
        skippedCount++;
        continue;
      }

      // If client has a slot filter, check it matches
      if (client.slot !== undefined && slot !== undefined && client.slot !== slot) {
        if (eventName === "debugStats") {
          Log.verbose(`[HttpServer] Client ${client.id} slot mismatch: client=${client.slot}, event=${slot}`);
        }
        skippedCount++;
        continue;
      }

      try {
        socket.send(JSON.stringify(notification));
        if (eventName === "debugStats") {
          Log.verbose(`[HttpServer] Sent debugStats to client ${client.id}`);
        }
        sentCount++;
      } catch (e) {
        Log.debug(`Error sending notification to client ${client.id}: ${e}`);
      }
    }

    // Only log broadcast stats at verbose level to reduce noise
    Log.verbose(
      `[HttpServer] Broadcast ${eventName} (slot ${slot}): sent to ${sentCount} clients, skipped ${skippedCount} (total ${this._wsClients.size})`
    );
  }

  /**
   * Create and broadcast a notification.
   * Helper method for common notification patterns.
   */
  public notify(body: IServerNotificationBody) {
    const notification: IServerNotification = {
      header: {
        version: 1,
        requestId: uuid(),
        messageType: "notification",
        messagePurpose: "event",
      },
      body: body,
    };

    this.broadcastNotification(notification);
  }

  /**
   * Notify clients of a file change in world content.
   */
  public notifyFileChange(
    eventName: "fileChanged" | "fileAdded" | "fileRemoved",
    slot: number,
    category: "behavior_packs" | "resource_packs" | "world",
    path: string
  ) {
    this.notify({
      eventName: eventName,
      timestamp: Date.now(),
      slot: slot,
      category: category,
      path: path,
    });
  }

  /**
   * Notify clients of a server state change.
   */
  public notifyServerState(
    slot: number,
    state: "starting" | "started" | "stopping" | "stopped" | "error",
    message?: string
  ) {
    this.notify({
      eventName: "serverStateChanged",
      timestamp: Date.now(),
      slot: slot,
      state: state,
      message: message,
    });
  }

  /**
   * Notify clients of a player movement.
   */
  public notifyPlayerMoved(
    slot: number,
    playerName: string,
    position: { x: number; y: number; z: number },
    rotation?: { yaw: number; pitch: number },
    dimension?: string
  ) {
    this.notify({
      eventName: "playerMoved",
      timestamp: Date.now(),
      slot: slot,
      playerName: playerName,
      position: position,
      rotation: rotation,
      dimension: dimension,
    });
  }

  /**
   * Forward a game event from Minecraft to WebSocket clients.
   */
  public notifyGameEvent(slot: number, minecraftEventName: string, data: object) {
    this.notify({
      eventName: "gameEvent",
      timestamp: Date.now(),
      slot: slot,
      minecraftEventName: minecraftEventName,
      data: data,
    });
  }

  /**
   * Notify clients of a full status update for a server slot.
   * This replaces the need for polling /api/{slot}/status/
   *
   * @param slot The server slot number
   * @param status The current DedicatedServerStatus value
   * @param recentMessages Recent messages from the server
   * @param title Optional server title
   */
  public notifyStatusUpdate(
    slot: number,
    status: number,
    recentMessages?: Array<{ message: string; received: number; type?: number }>,
    title?: string
  ) {
    this.notify({
      eventName: "statusUpdate",
      timestamp: Date.now(),
      slot: slot,
      status: status,
      recentMessages: recentMessages,
      title: title,
    });
  }

  /**
   * Start watching a NodeStorage for file changes and broadcast them via WebSocket.
   * This enables real-time synchronization of file changes to connected clients.
   *
   * @param storage The NodeStorage to watch
   * @param slot The server slot number this storage is associated with
   * @param category The category of content (behavior_packs, resource_packs, world)
   */
  public startWatchingStorage(
    storage: NodeStorage,
    slot: number,
    category: "behavior_packs" | "resource_packs" | "world"
  ): void {
    // Check if already watching this storage
    if (this._storageWatchers.has(storage)) {
      return;
    }

    // Start watching the storage
    const watcherId = storage.startWatching();
    this._storageWatchers.set(storage, watcherId);

    // Track the slot association
    if (!this._slotStorages.has(slot)) {
      this._slotStorages.set(slot, []);
    }
    this._slotStorages.get(slot)!.push({ storage, category });

    // Subscribe to storage change events
    storage.onStorageChange.subscribe((sender, event) => {
      this._handleStorageChange(slot, category, event);
    });

    Log.verbose(`Started watching ${category} storage for slot ${slot}`);
  }

  /**
   * Stop watching a specific storage.
   */
  public stopWatchingStorage(storage: NodeStorage): void {
    const watcherId = this._storageWatchers.get(storage);
    if (watcherId) {
      storage.stopWatching(watcherId);
      this._storageWatchers.delete(storage);

      // Remove from slot associations
      for (const [slot, storages] of this._slotStorages) {
        const index = storages.findIndex((s) => s.storage === storage);
        if (index >= 0) {
          storages.splice(index, 1);
          if (storages.length === 0) {
            this._slotStorages.delete(slot);
          }
          break;
        }
      }
    }
  }

  /**
   * Stop watching all storages.
   */
  public stopAllStorageWatchers(): void {
    for (const [storage, watcherId] of this._storageWatchers) {
      storage.stopWatching(watcherId);
    }
    this._storageWatchers.clear();
    this._slotStorages.clear();
    Log.verbose("Stopped all storage watchers");
  }

  /**
   * Handle a storage change event and broadcast it to WebSocket clients.
   */
  private _handleStorageChange(
    slot: number,
    category: "behavior_packs" | "resource_packs" | "world",
    event: IStorageChangeEvent
  ): void {
    // Map storage change type to notification event name
    let eventName: "fileChanged" | "fileAdded" | "fileRemoved" | "folderChanged";

    if (event.isFile) {
      switch (event.changeType) {
        case "added":
          eventName = "fileAdded";
          break;
        case "removed":
          eventName = "fileRemoved";
          break;
        default:
          eventName = "fileChanged";
      }
    } else {
      eventName = "folderChanged";
    }

    // Broadcast the notification
    this.notify({
      eventName: eventName,
      timestamp: event.timestamp.getTime(),
      slot: slot,
      category: category,
      path: event.path,
    });

    Log.verbose(`[HttpServer] Storage change: ${eventName} ${category}${event.path} (slot ${slot})`);
  }

  async stop(reason?: string) {
    // Stop all storage watchers
    this.stopAllStorageWatchers();

    // Clean up MCP server resources (cached browser, preview server, etc.)
    if (this._mcpServer) {
      try {
        await this._mcpServer.cleanup();
      } catch (e) {
        // Ignore cleanup errors during shutdown
      }
      this._mcpServer = undefined;
      this._mcpServerInitPromise = undefined;
    }

    // Notify all WebSocket clients that the server is shutting down BEFORE closing connections
    if (this._wsServer && this._wsClients.size > 0) {
      const shutdownNotification = {
        header: {
          version: 1,
          requestId: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
          messageType: "notification",
          messagePurpose: "event",
        },
        body: {
          eventName: "serverShutdown",
          timestamp: Date.now(),
          reason: reason || "Server shutting down",
          graceful: true,
        },
      };

      const message = JSON.stringify(shutdownNotification);
      let sentCount = 0;

      for (const [socket] of this._wsClients) {
        try {
          if (socket.readyState === socket.OPEN) {
            socket.send(message);
            sentCount++;
          }
        } catch (e) {
          // Ignore send errors during shutdown
        }
      }

      Log.message(`Sent shutdown notification to ${sentCount} WebSocket clients.`);

      // Give the message a moment to be delivered before closing connections
      if (sentCount > 0) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    // Close WebSocket server and all connections
    if (this._wsServer) {
      for (const [socket] of this._wsClients) {
        try {
          socket.close();
        } catch (e) {
          // Ignore close errors
        }
      }
      this._wsClients.clear();
      this._wsServer.close();
      Log.message("WebSocket notification server closed.");
    }

    // Reset listening state BEFORE closing servers
    this._isListeningMetaFlag = false;

    if (this._httpServer) {
      // Force close all connections immediately
      this._httpServer.closeAllConnections?.();
      this._httpServer.close(() => {
        Log.message(`Minecraft HTTP server closed.`);
      });
      // Unref the server so it doesn't keep the process alive
      this._httpServer.unref();
    }

    if (this._httpsServer) {
      this._httpsServer.closeAllConnections?.();
      this._httpsServer.close(() => {
        Log.message(`Minecraft https server closed.`);
      });
      this._httpsServer.unref();
    }
  }

  private _salt: Buffer | undefined;

  getPasswordHash() {
    if (!this._pwdHash) {
      // Generate salt once and store it
      this._salt = crypto.randomBytes(32);
      this._pwdHash = crypto.scryptSync(this._localEnvironment.tokenEncryptionKey, this._salt, 32);
    }

    return this._pwdHash;
  }

  getSalt() {
    if (!this._salt) {
      this.getPasswordHash(); // Initialize salt
    }
    return this._salt!;
  }

  /**
   * Generates a generic fingerprint hash for token binding.
   * Uses partial IP and browser family to balance security with usability.
   *
   * Note: This is intentionally "soft" binding - we only use partial IP
   * to avoid breaking sessions for mobile users while still providing
   * some protection against token theft across different networks.
   */
  generateFingerprint(userAgent?: string, ipAddress?: string): string {
    // Extract only the IP network prefix (first 2 octets for IPv4, first 3 groups for IPv6)
    // This provides some binding while tolerating NAT/mobile IP changes within same ISP
    let networkPrefix = "unknown";
    if (ipAddress) {
      // Normalize localhost addresses to a consistent value
      // This handles: 127.0.0.1, ::1, ::ffff:127.0.0.1, localhost
      if (
        ipAddress === "127.0.0.1" ||
        ipAddress === "::1" ||
        ipAddress === "::ffff:127.0.0.1" ||
        ipAddress.startsWith("::ffff:127.")
      ) {
        networkPrefix = "localhost";
      } else if (ipAddress.includes(".")) {
        // IPv4: use first 2 octets (e.g., "192.168.x.x" -> "192.168")
        const parts = ipAddress.split(".");
        if (parts.length >= 2) {
          networkPrefix = `${parts[0]}.${parts[1]}`;
        }
      } else if (ipAddress.includes(":")) {
        // IPv6: use first 3 groups
        const parts = ipAddress.split(":");
        if (parts.length >= 3) {
          networkPrefix = `${parts[0]}:${parts[1]}:${parts[2]}`;
        }
      }
    }

    // Extract browser family from user agent (not full string, for privacy)
    let browserFamily = "unknown";
    if (userAgent) {
      if (userAgent.includes("Chrome") && !userAgent.includes("Edg")) {
        browserFamily = "chrome";
      } else if (userAgent.includes("Firefox")) {
        browserFamily = "firefox";
      } else if (userAgent.includes("Safari") && !userAgent.includes("Chrome")) {
        browserFamily = "safari";
      } else if (userAgent.includes("Edg")) {
        browserFamily = "edge";
      }
    }

    // Create a hash of the combined attributes
    const combined = `${networkPrefix}|${browserFamily}`;
    return crypto.createHash("sha256").update(combined).digest("hex").substring(0, 32);
  }

  /**
   * Validates that a token fingerprint matches current request.
   * Uses timing-safe comparison to prevent timing attacks.
   */
  validateFingerprint(storedFingerprint: string, currentFingerprint: string): boolean {
    if (storedFingerprint.length !== currentFingerprint.length) {
      return false;
    }

    try {
      return crypto.timingSafeEqual(Buffer.from(storedFingerprint, "utf8"), Buffer.from(currentFingerprint, "utf8"));
    } catch {
      return false;
    }
  }

  /**
   * Gets the expected session ID for a given permission level.
   * Used to validate that tokens were issued for the current server session.
   * This prevents replay attacks with tokens from previous server restarts.
   */
  getExpectedSessionIdForPermission(permissionLevel: ServerPermissionLevel): string | undefined {
    switch (permissionLevel) {
      case ServerPermissionLevel.admin:
        return this._localEnvironment.adminSessionId;
      case ServerPermissionLevel.displayReadOnly:
        return this._localEnvironment.displayReadOnlySessionId;
      case ServerPermissionLevel.fullReadOnly:
        return this._localEnvironment.fullReadOnlySessionId;
      case ServerPermissionLevel.updateState:
        return this._localEnvironment.updateStateSessionId;
      default:
        return undefined;
    }
  }

  getAllowedCorsOrigins(): string[] {
    // Default allowed origins
    const defaultOrigins = ["http://localhost:6126", "http://127.0.0.1:6126"];

    // Add configured origins if any
    if (this._localEnvironment.allowedCorsOrigins && this._localEnvironment.allowedCorsOrigins.length > 0) {
      return [...defaultOrigins, ...this._localEnvironment.allowedCorsOrigins];
    }

    return defaultOrigins;
  }

  /**
   * Check if an origin is allowed for CORS.
   * Allows any localhost/127.0.0.1 port for development convenience.
   */
  isOriginAllowed(origin: string | undefined): boolean {
    if (!origin) {
      return false;
    }

    // Allow any localhost port (e.g., localhost:3000 for Vite dev server)
    // This matches http://localhost:<any-port> or http://127.0.0.1:<any-port>
    const localhostPattern = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
    if (localhostPattern.test(origin)) {
      return true;
    }

    const allowedOrigins = this.getAllowedCorsOrigins();
    return allowedOrigins.includes(origin);
  }

  getCorsHeaders(req: http.IncomingMessage): { [key: string]: string } {
    const origin = req.headers.origin;
    const allowedOrigin = this.isOriginAllowed(origin) ? origin : "null";

    return {
      // CORS headers
      "Access-Control-Allow-Origin": allowedOrigin!,
      "Access-Control-Allow-Methods": "OPTIONS, POST, GET, DELETE",
      "Access-Control-Max-Age": "86400",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, mctpc, mcp-session-id",
      "Access-Control-Allow-Credentials": "true",
      Vary: "Origin", // Important for caching with multiple origins

      // Security headers
      "X-Content-Type-Options": "nosniff", // Prevent MIME type sniffing
      "X-Frame-Options": "DENY", // Prevent clickjacking
      "X-XSS-Protection": "1; mode=block", // Legacy XSS protection for older browsers
      "Referrer-Policy": "strict-origin-when-cross-origin", // Control referrer information
      // CSP for CLI-served web — no telemetry endpoints allowed (telemetry is only for mctools.dev)
      "Content-Security-Policy":
        "default-src 'self'; manifest-src 'self'; worker-src 'self' blob:; script-src 'self' 'wasm-unsafe-eval' 'unsafe-inline'; connect-src 'self' https://raw.githubusercontent.com/ https://registry.npmjs.org/ https://mctools.dev wss:; font-src 'self' https://res-1.cdn.office.net https://res.cdn.office.net; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; frame-ancestors 'none';",
    };
  }

  /**
   * Register temporary content to be served at a specific path.
   * Useful for serving project-specific content for headless rendering.
   * @param urlPath The URL path to serve (e.g., "/temp/geometry.json")
   * @param content The content to serve (string for JSON/text, Uint8Array for binary)
   * @param contentType The content type (e.g., "application/json", "image/png")
   */
  registerTempContent(urlPath: string, content: string | Uint8Array, contentType: string) {
    this._tempContent.set(urlPath, { content, contentType });
  }

  /**
   * Unregister temporary content.
   * @param urlPath The URL path to remove
   */
  unregisterTempContent(urlPath: string) {
    this._tempContent.delete(urlPath);
  }

  /**
   * Clear all temporary content.
   */
  clearTempContent() {
    this._tempContent.clear();
  }

  /**
   * Set the content path for serving local files via /api/content.
   * Used by the 'view' command to serve Minecraft content for browsing.
   * @param contentPath Absolute path to the local folder to serve
   */
  setContentPath(contentPath: string) {
    this._contentPath = contentPath;
    this._contentStorage = new NodeStorage(contentPath, "");
  }

  /**
   * Get the content path if set.
   */
  getContentPath(): string | undefined {
    return this._contentPath;
  }

  /**
   * Set whether the server is running in "view" mode.
   * When true, enables the /api/shutdown endpoint for graceful shutdown.
   */
  setViewMode(isViewMode: boolean) {
    this._isViewMode = isViewMode;
  }

  /**
   * Check if the server is running in view mode.
   */
  isViewMode(): boolean {
    return this._isViewMode;
  }

  /**
   * Set whether the server is running in "edit" mode.
   * When true, enables write operations (PUT/DELETE) on /api/content endpoints.
   * Edit mode also enables view mode features like /api/shutdown.
   */
  setEditMode(isEditMode: boolean) {
    this._isEditMode = isEditMode;
    // Edit mode implies view mode features (shutdown endpoint, etc.)
    if (isEditMode) {
      this._isViewMode = true;
    }
  }

  /**
   * Check if the server is running in edit mode.
   */
  isEditMode(): boolean {
    return this._isEditMode;
  }

  /**
   * Set whether MCP requires authentication even from localhost.
   * When false (default), localhost requests to /mcp bypass authentication.
   * When true, all /mcp requests must authenticate via passcode or session token.
   */
  setMcpRequireAuth(requireAuth: boolean) {
    this._mcpRequireAuth = requireAuth;
  }

  /**
   * Handles an MCP request by lazily initializing the MCP server and delegating.
   * Sets CORS headers before handing off to the MCP transport, which manages
   * its own response headers (the SDK's StreamableHTTPServerTransport).
   */
  private async _handleMcpRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    corsHeaders: { [key: string]: string }
  ) {
    if (!this.creatorTools) {
      this.sendErrorRequest(503, "Server not ready: CreatorTools not initialized", req, res);
      return;
    }

    // Ensure MCP server is initialized (with race guard).
    // Always await the init promise — even if _mcpServer is already set — because
    // the object is assigned before startHttp() finishes. A concurrent request could
    // see _mcpServer as truthy while the transport is still being created.
    if (!this._mcpServerInitPromise) {
      this._mcpServerInitPromise = (async () => {
        this._mcpServer = new MinecraftMcpServer();
        await this._mcpServer.startHttp(this.creatorTools!, this._localEnvironment, this._serverManager);
      })();
    }
    await this._mcpServerInitPromise;

    // Set CORS headers before handing off to the MCP transport.
    // The SDK's StreamableHTTPServerTransport will add its own headers via writeHead,
    // but res.setHeader() calls are merged into the final headers.
    for (const [key, value] of Object.entries(corsHeaders)) {
      res.setHeader(key, value);
    }
    // Also expose the mcp-session-id header to cross-origin clients
    res.setHeader("Access-Control-Expose-Headers", "mcp-session-id");

    if (this._mcpServer) {
      await this._mcpServer.handleRequest(req, res);
    }
  }

  /**
   * Check if a file name is safe to serve (not in blocked list and has safe extension).
   */
  private isFileSafeToServe(fileName: string): boolean {
    const fileNameLower = fileName.toLowerCase();

    // Check blocked file names
    if (HttpServer.BLOCKED_FILE_NAMES.has(fileNameLower)) {
      return false;
    }

    // Allow LevelDB MANIFEST files (they don't have an extension but start with MANIFEST)
    if (fileNameLower.startsWith("manifest-")) {
      return true;
    }

    // Allow CURRENT file (LevelDB metadata)
    if (fileNameLower === "current") {
      return true;
    }

    // Allow LOG file (LevelDB write-ahead log, no extension)
    if (fileNameLower === "log" || fileNameLower === "log.old") {
      return true;
    }

    // Allow LOCK file (LevelDB lock file)
    if (fileNameLower === "lock") {
      return true;
    }

    // Get extension
    const lastDot = fileNameLower.lastIndexOf(".");
    const extension = lastDot >= 0 ? fileNameLower.substring(lastDot + 1) : "";

    // Check safe extensions
    return HttpServer.SAFE_EXTENSIONS.has(extension);
  }

  /**
   * Check if a folder name is safe to traverse (not hidden or blocked).
   */
  private isFolderSafeToServe(folderName: string): boolean {
    const folderNameLower = folderName.toLowerCase();

    // Block folders starting with a dot (hidden folders, .git, .vscode, etc.)
    if (folderNameLower.startsWith(".")) {
      return false;
    }

    // Block node_modules and other known unsafe folders
    if (folderNameLower === "node_modules" || folderNameLower === "__pycache__") {
      return false;
    }

    return true;
  }

  getRootPath() {
    let fullPath = __dirname;

    const lastSlash = Math.max(
      fullPath.lastIndexOf("\\", fullPath.length - 2),
      fullPath.lastIndexOf("/", fullPath.length - 2)
    );

    if (lastSlash >= 0) {
      fullPath = fullPath.substring(0, lastSlash + 1);
    }

    return fullPath;
  }

  /**
   * Get the path to the res/ folder, checking both the default location
   * and the public/ folder for development environments.
   *
   * The serve vanilla folder (with PNG-converted textures) is often only
   * available under public/res/ — not under toolbuild/jsn/res/. This method
   * checks multiple candidate paths to find the one that actually contains
   * vanilla resource data.
   */
  getResRootPath(): string {
    const defaultResPath = this.getRootPath() + "res/";
    const fs = require("fs");
    const serveCheck = "latest/van/serve/resource_pack/textures/terrain_texture.json";

    if (fs.existsSync(defaultResPath + serveCheck)) {
      return defaultResPath;
    }

    const publicResPath = this.getRootPath() + "public/res/";
    if (fs.existsSync(publicResPath + serveCheck)) {
      return publicResPath;
    }

    // Check one level up (for toolbuild/jsn/cli running from app/)
    const parentResPath = this.getRootPath().replace(/[\\/]toolbuild[\\/]jsn[\\/]?$/, "/") + "public/res/";
    if (fs.existsSync(parentResPath + serveCheck)) {
      return parentResPath;
    }

    // Check cwd-based path (for npm run scripts running from app/)
    const cwdResPath = process.cwd().replace(/[\\/]$/, "") + "/public/res/";
    if (fs.existsSync(cwdResPath + serveCheck)) {
      return cwdResPath;
    }

    return defaultResPath;
  }

  /**
   * Check if a URL path is for vanilla resources (under /res/latest/van/)
   */
  isVanillaResourcePath(urlPath: string): boolean {
    return urlPath.startsWith("/res/latest/van/");
  }

  parseCookies(req: http.IncomingMessage): { [name: string]: string } {
    const result: { [name: string]: string } = {};

    const cookieHeader = req.headers?.cookie;

    if (!cookieHeader) return result;

    const cookieVals = cookieHeader.split(`;`);

    for (let i = 0; i < cookieVals.length; i++) {
      const cookie = cookieVals[i];

      let [name, ...rest] = cookie.split(`=`);

      name = name?.trim();

      if (!name) {
        continue;
      }

      const value = rest.join(`=`).trim();

      if (!value) {
        continue;
      }

      result[name] = decodeURIComponent(value);
    }

    return result;
  }

  processRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    // Security: Use dynamic CORS headers based on origin
    const corsHeaders = this.getCorsHeaders(req);

    if (req.method === "OPTIONS") {
      res.writeHead(204, corsHeaders);
      res.end();
      return;
    }

    if (!req.url) {
      res.writeHead(404, this.headers);
      Log.message("Requested url was not specified.");
      return;
    }

    let authorizedPermissionLevel: ServerPermissionLevel = ServerPermissionLevel.none;

    let headerPasscode = undefined;
    if (req.headers["mctpc"]) {
      headerPasscode = req.headers["mctpc"] as string;
    }

    if (headerPasscode) {
      if (headerPasscode === this._localEnvironment.displayReadOnlyPasscode) {
        authorizedPermissionLevel = ServerPermissionLevel.displayReadOnly;
      } else if (headerPasscode === this._localEnvironment.fullReadOnlyPasscode) {
        authorizedPermissionLevel = ServerPermissionLevel.fullReadOnly;
      } else if (headerPasscode === this._localEnvironment.updateStatePasscode) {
        authorizedPermissionLevel = ServerPermissionLevel.updateState;
      } else if (headerPasscode === this._localEnvironment.adminPasscode) {
        authorizedPermissionLevel = ServerPermissionLevel.admin;
      } else {
        this.sendErrorRequest(401, "Invalid passcode passed in via mctpc header.", req, res);
        return;
      }
    }

    if (req.url === "/favicon.ico") {
      this.serveContent("res", "/res/images/favicon.ico", this._resStorage, res);
      return;
    }

    // Serve source map files without authentication - these are static development assets
    if (req.url.startsWith("/min-maps/")) {
      this.serveContent("min-maps", req.url, this._webStorage, res);
      return;
    }

    if ((req.url.startsWith("/api/auth") || req.url.startsWith("/auth/")) && req.method === "POST") {
      let authBody = "";
      let authBodySize = 0;
      const MAX_AUTH_BODY_SIZE = 1024; // 1KB max for auth requests

      // Security: Rate limiting
      const clientIp =
        (req.headers["x-forwarded-for"] as string)?.split(",")[0] || req.socket.remoteAddress || "unknown";
      if (!SecurityUtilities.checkAuthRateLimit(clientIp)) {
        this.sendErrorRequest(429, "Too many authentication attempts. Please try again later.", req, res);
        return;
      }

      Log.message(HttpUtilities.getShortReqDescription(req, clientIp) + `Auth request`);

      req.on("data", (chunk) => {
        authBodySize += chunk.length;
        // Security: Limit auth body size to prevent memory exhaustion
        if (authBodySize > MAX_AUTH_BODY_SIZE) {
          this.sendErrorRequest(413, "Auth request too large", req, res);
          req.destroy();
          return;
        }
        authBody += chunk;
      });

      req.on("end", () => {
        let passcode: string | undefined;

        if (authBody.startsWith("passcode=")) {
          passcode = authBody.trim().substring(9).toLowerCase().replace(/-/g, "");
        } else if (req.headers["mctpc"]) {
          passcode = req.headers["mctpc"] as string;
        }

        if (!passcode) {
          this.sendErrorRequest(
            401,
            "No passcode provided. Send passcode in body as 'passcode=<value>' or in the 'mctpc' header.",
            req,
            res
          );
          return;
        }

        let sessionId: string | undefined;

        if (passcode === this._localEnvironment.displayReadOnlyPasscode) {
          authorizedPermissionLevel = ServerPermissionLevel.displayReadOnly;
          sessionId = this._localEnvironment.displayReadOnlySessionId;
        } else if (passcode === this._localEnvironment.fullReadOnlyPasscode) {
          authorizedPermissionLevel = ServerPermissionLevel.fullReadOnly;
          sessionId = this._localEnvironment.fullReadOnlySessionId;
        } else if (passcode === this._localEnvironment.updateStatePasscode) {
          authorizedPermissionLevel = ServerPermissionLevel.updateState;
          sessionId = this._localEnvironment.updateStateSessionId;
        } else if (passcode === this._localEnvironment.adminPasscode) {
          authorizedPermissionLevel = ServerPermissionLevel.admin;
          sessionId = this._localEnvironment.adminSessionId;
        }

        if (!authorizedPermissionLevel || !sessionId) {
          this.sendErrorRequest(401, "Login request failed.", req, res);
          return;
        }

        // Security: Reset rate limit on successful auth
        SecurityUtilities.resetAuthRateLimit(clientIp);

        // Security: Add fingerprint binding
        const userAgent = req.headers["user-agent"] || "";
        const fingerprint = this.generateFingerprint(userAgent, clientIp);

        const token: IAuthenticationToken = {
          code: sessionId,
          permissionLevel: authorizedPermissionLevel,
          time: new Date().getTime(),
          fingerprint: fingerprint,
        };

        const val = this.encrypt(JSON.stringify(token));

        const response: CartoServerAuthenticationResponse = {
          iv: val.iv,
          token: val.content,
          authTag: val.authTag, // Include auth tag for GCM
          permissionLevel: authorizedPermissionLevel,
          serverStatus: [],
          eulaAccepted:
            this._localEnvironment
              .iAgreeToTheMinecraftEndUserLicenseAgreementAndPrivacyStatementAtMinecraftDotNetSlashEula === true,
        };

        // Include status for slots 0-3 (for backwards compatibility) plus all active slots
        const activeSlots = this._serverManager.getActiveSlots();
        const slotsToInclude = new Set([0, 1, 2, 3, ...activeSlots]);
        const sortedSlots = Array.from(slotsToInclude).sort((a, b) => a - b);

        for (const slot of sortedSlots) {
          response.serverStatus[slot] = this.getStatus(slot);
        }

        // Build secure cookie with appropriate flags for all auth methods
        // - HttpOnly: Prevents JavaScript access (XSS protection)
        // - SameSite=Strict: Prevents CSRF attacks
        // - Secure: Only sent over HTTPS (omitted for localhost development)
        // - Max-Age: 24 hours (matches token expiry)
        const isLocalhost = this.host === "localhost" || this.host === "127.0.0.1";
        const cookieValue = `mctauth=${val.content}|${val.iv}|${
          val.authTag
        }; HttpOnly; SameSite=Strict; Max-Age=86400; Path=/${isLocalhost ? "" : "; Secure"}`;

        if (req.url && req.url.startsWith("/api/auth")) {
          const permName = HttpUtilities.getPermissionLevelName(authorizedPermissionLevel);
          const tokenThumb = HttpUtilities.getTokenThumbprint(sessionId);
          Log.message(HttpUtilities.getShortReqDescription(req, clientIp, tokenThumb) + `Auth successful: ${permName}`);
          res.writeHead(
            200,
            Object.assign(
              {
                "Set-Cookie": cookieValue,
                "Content-Type": `application/json`,
              },
              corsHeaders
            )
          );

          res.end(JSON.stringify(response));
          return;
        } else {
          const permName = HttpUtilities.getPermissionLevelName(authorizedPermissionLevel);
          const tokenThumb = HttpUtilities.getTokenThumbprint(sessionId);
          Log.message(
            HttpUtilities.getShortReqDescription(req, clientIp, tokenThumb) + `Page auth successful: ${permName}`
          );

          res.writeHead(
            200,
            Object.assign(
              {
                "Set-Cookie": cookieValue,
                "Content-Type": "text/html",
              },
              corsHeaders
            )
          );

          res.end(JSON.stringify("<head><meta http-equiv='Refresh' content='0; URL=/'></head>"));
          return;
        }
      });

      return;
    }

    // Serve temporary content (for headless rendering of project geometry, etc.)
    // URL decode the path to handle cases like %2Ftemp%2Fgeometry.json -> /temp/geometry.json
    const decodedUrl = decodeURIComponent(req.url.split("?")[0]);
    if (decodedUrl.startsWith("/temp/")) {
      const tempContent = this._tempContent.get(decodedUrl);
      if (tempContent) {
        res.writeHead(200, {
          ...corsHeaders,
          "Content-Type": tempContent.contentType,
        });
        res.end(tempContent.content);
        return;
      }
    }

    if (this._serverManager.features === ServerManagerFeatures.all) {
      if (req.url.startsWith("/app/")) {
        this.serveContent("app", req.url, this._webStorage, res);
        return;
      }

      if (req.url.startsWith("/res/")) {
        // For vanilla resources under /res/latest/van/, prefer local storage when
        // the serve folder is available locally (has PNG-converted textures).
        // Fall back to proxying from vanillaContentRoot (e.g., mctools.dev) otherwise.
        if (this.isVanillaResourcePath(req.url)) {
          if (this._hasLocalVanillaServe) {
            // Local serve folder available — serve directly from _resStorage
            this.serveContent("res", req.url, this._resStorage, res);
            return;
          }

          const vanillaRoot = CreatorToolsHost.getVanillaContentRoot();
          if (vanillaRoot && vanillaRoot.length > 0 && vanillaRoot !== "/") {
            const servePrefix = "/res/latest/van/serve/";
            if (req.url.startsWith(servePrefix)) {
              const vanillaServeStorage = HttpStorage.get(vanillaRoot + "res/latest/van/serve/");
              this.serveContent("res/latest/van/serve", req.url, vanillaServeStorage, res);
              return;
            }

            const vanPrefix = "/res/latest/van/";

            if (req.url.startsWith(vanPrefix) && req.url.indexOf("preview/metadata") < 0) {
              const vanillaStorage = HttpStorage.get(vanillaRoot + "res/latest/van/");
              this.serveContent("res/latest/van", req.url, vanillaStorage, res);
              return;
            }
          }
        }
        this.serveContent("res", req.url, this._resStorage, res);
        return;
      }

      if (req.url.startsWith("/dist/")) {
        if (req.url.startsWith("/dist/esbuild-wasm/") && this._esbuildWasmStorage) {
          this.serveContent("dist/esbuild-wasm", req.url, this._esbuildWasmStorage, res);
          return;
        }

        this.serveContent("dist", req.url, this._distStorage, res);
        return;
      }
    }

    if (req.url.startsWith("/data/forms/") && this._formsStorage) {
      this.serveContent("data/forms", req.url, this._formsStorage, res);
      return;
    }

    if (req.url.startsWith("/data/")) {
      this.serveContent("data", req.url, this._dataStorage, res);
      return;
    }

    if (req.url.startsWith("/schemas/")) {
      this.serveContent("schemas", req.url, this._schemasStorage, res);
      return;
    }

    let encryptedToken: string | undefined;
    const auth = req.headers.authorization;

    if (auth && auth.length > 40) {
      // assume that the auth token > 40
      const authStr = auth as string;

      const firstSection = authStr.substring(0, 7).toLowerCase();

      if (firstSection === "bearer " && auth.indexOf("=") >= 0) {
        const tokenPart = authStr.substring(7);
        const tokenParts = tokenPart.split("=");

        if (tokenParts.length === 2) {
          if (tokenParts[0] === "mctauth") {
            encryptedToken = tokenParts[1];
          }
        }
      }
    }

    if (!encryptedToken) {
      const cookies = this.parseCookies(req);

      const authCookie = cookies["mctauth"];

      if (authCookie) {
        encryptedToken = authCookie;
      }
    }

    if (encryptedToken) {
      if (encryptedToken.indexOf("|") >= 0) {
        const tokenParts = Utilities.splitUntil(encryptedToken, "|", 2);

        if (tokenParts.length === 3) {
          try {
            const content = tokenParts[0];
            const iv = tokenParts[1];
            const authTag = tokenParts.length >= 3 ? tokenParts[2] : undefined;

            const decryptedStr = this.decrypt(iv, content, authTag);

            const decryptedContent = SecurityUtilities.sanitizeJsonObject(JSON.parse(decryptedStr));

            if (decryptedContent.code && decryptedContent.permissionLevel && decryptedContent.time) {
              const tokenTime = new Date(decryptedContent.time).getTime();

              const now = new Date();
              const nowMs = now.getTime();

              // Security: Token valid for 24 hours
              const startOfToken = new Date(nowMs - 24 * 60 * 60 * 1000);

              if (tokenTime > startOfToken.getTime() && tokenTime < nowMs) {
                // Security: Validate that the session ID matches the current session for this permission level
                // This prevents replay attacks with tokens from previous server sessions
                const expectedSessionId = this.getExpectedSessionIdForPermission(decryptedContent.permissionLevel);
                if (!expectedSessionId || decryptedContent.code !== expectedSessionId) {
                  Log.debug("Token session ID mismatch - token from different server session");
                } else if (decryptedContent.fingerprint) {
                  // Security: Validate fingerprint if present
                  const clientIp =
                    (req.headers["x-forwarded-for"] as string)?.split(",")[0] || req.socket.remoteAddress || "unknown";
                  const userAgent = req.headers["user-agent"] || "";
                  const currentFingerprint = this.generateFingerprint(userAgent, clientIp);

                  if (this.validateFingerprint(decryptedContent.fingerprint, currentFingerprint)) {
                    authorizedPermissionLevel = decryptedContent.permissionLevel;
                  } else {
                    Log.message("Token fingerprint mismatch - possible replay attack");
                  }
                } else {
                  // Legacy tokens without fingerprint (temporary backward compatibility)
                  authorizedPermissionLevel = decryptedContent.permissionLevel;
                }
              }
            }
          } catch (e) {}
        }
      }
    }

    // Allow access to main page with query strings (e.g., /?mode=mobviewer) without auth
    // Also allow for allWebServices when serving content (view mode)
    const urlPath = req.url.split("?")[0];
    if (
      urlPath === "/" &&
      (this._serverManager.features === ServerManagerFeatures.all ||
        (this._serverManager.features === ServerManagerFeatures.allWebServices && this._contentPath))
    ) {
      const responseHeaders: { [key: string]: string } = {
        ...corsHeaders,
        "Content-Type": "text/html; charset=utf-8",
      };

      // Support ?pc= query parameter for auto-authentication (localhost only).
      // This allows tools, tests, and automation to load the page with auth in a single URL
      // (e.g., /?mode=mobviewer&pc=testpswd) — the server validates the passcode,
      // sets the mctauth cookie, and 302-redirects to the same URL with ?pc= stripped
      // so the passcode does not persist in the browser address bar or history.
      //
      // SECURITY: Only accepted from localhost connections. Remote requests with ?pc=
      // are silently ignored (the parameter is treated as if it were not present).
      if (authorizedPermissionLevel === ServerPermissionLevel.none) {
        const pageUrl = new URL(req.url, `http://${req.headers.host}`);
        const pcParam = pageUrl.searchParams.get("pc");
        if (pcParam) {
          const remoteAddr = req.socket?.remoteAddress || "";
          const isLocalhostRequest =
            remoteAddr === "127.0.0.1" || remoteAddr === "::1" || remoteAddr === "::ffff:127.0.0.1";

          if (!isLocalhostRequest) {
            Log.debug("Ignoring ?pc= parameter from non-localhost request: " + remoteAddr);
          } else {
            const pc = pcParam.toLowerCase().replace(/-/g, "");
            let pcPermLevel: ServerPermissionLevel = ServerPermissionLevel.none;
            let pcSessionId: string | undefined;

            if (pc === this._localEnvironment.displayReadOnlyPasscode) {
              pcPermLevel = ServerPermissionLevel.displayReadOnly;
              pcSessionId = this._localEnvironment.displayReadOnlySessionId;
            } else if (pc === this._localEnvironment.fullReadOnlyPasscode) {
              pcPermLevel = ServerPermissionLevel.fullReadOnly;
              pcSessionId = this._localEnvironment.fullReadOnlySessionId;
            } else if (pc === this._localEnvironment.updateStatePasscode) {
              pcPermLevel = ServerPermissionLevel.updateState;
              pcSessionId = this._localEnvironment.updateStateSessionId;
            } else if (pc === this._localEnvironment.adminPasscode) {
              pcPermLevel = ServerPermissionLevel.admin;
              pcSessionId = this._localEnvironment.adminSessionId;
            }

            if (pcPermLevel !== ServerPermissionLevel.none && pcSessionId) {
              const userAgent = req.headers["user-agent"] || "";
              const clientIp = req.socket.remoteAddress || "unknown";
              const fingerprint = this.generateFingerprint(userAgent, clientIp);
              const token: IAuthenticationToken = {
                code: pcSessionId,
                permissionLevel: pcPermLevel,
                time: new Date().getTime(),
                fingerprint: fingerprint,
              };
              const val = this.encrypt(JSON.stringify(token));
              const cookieValue = `mctauth=${val.content}|${val.iv}|${val.authTag}; HttpOnly; SameSite=Strict; Max-Age=86400; Path=/`;

              // 302 redirect to the same URL with ?pc= stripped so the passcode
              // does not remain in the address bar, browser history, or Referer headers.
              pageUrl.searchParams.delete("pc");
              const redirectUrl = pageUrl.pathname + pageUrl.search;
              res.writeHead(302, {
                ...corsHeaders,
                "Set-Cookie": cookieValue,
                Location: redirectUrl,
              });
              res.end();
              return;
            }
          }
        }
      }

      res.writeHead(200, responseHeaders);
      res.end(this.getMainContent(req));
      return;
    }

    // MCP endpoint: exempt from auth when request originates from localhost (unless --mcp-require-auth is set).
    // Standard MCP clients (Copilot CLI, Claude, Cursor) don't support custom auth headers,
    // so we allow unauthenticated access from localhost by default for usability.
    const urlSegmentsPreAuth = req.url?.toLowerCase().split("/");
    if (urlSegmentsPreAuth && urlSegmentsPreAuth.length >= 2 && urlSegmentsPreAuth[1] === "mcp") {
      const remoteAddr = req.socket?.remoteAddress || "";
      const isLocalhostRequest =
        remoteAddr === "127.0.0.1" || remoteAddr === "::1" || remoteAddr === "::ffff:127.0.0.1";

      if (isLocalhostRequest && !this._mcpRequireAuth) {
        // Localhost MCP: bypass auth
        this._handleMcpRequest(req, res, corsHeaders).catch((e) => {
          Log.debug("Error handling MCP request: " + (e?.message || e));
          if (!res.headersSent) {
            this.sendErrorRequest(500, "Internal MCP error", req, res);
          }
        });
        return;
      }

      // Non-localhost or auth required: fall through to normal auth check below,
      // then MCP will be handled after auth succeeds.
    }

    if (authorizedPermissionLevel === ServerPermissionLevel.none) {
      this.sendErrorRequest(401, "No permissions granted; 401 returned.", req, res);
      return;
    }

    const urlSegments = req.url.toLowerCase().split("/");

    if (urlSegments.length >= 2) {
      if (urlSegments[1] === "mcp") {
        this._handleMcpRequest(req, res, corsHeaders).catch((e) => {
          Log.debug("Error handling MCP request: " + (e?.message || e));
          if (!res.headersSent) {
            this.sendErrorRequest(500, "Internal MCP error", req, res);
          }
        });
        return;
      } else if (urlSegments[1] === "api") {
        // Handle /api/content/* endpoint for serving local content in view/edit mode
        if (urlSegments[2] === "content" && this._contentStorage && this._contentPath) {
          // Write operations (PUT, DELETE, POST) require edit mode and updateState permission
          if (req.method === "PUT" || req.method === "DELETE" || req.method === "POST") {
            if (!this._isEditMode) {
              this.sendErrorRequest(403, "Write operations not allowed in view-only mode", req, res);
              return;
            }
            if (!this.hasPermissionLevel(authorizedPermissionLevel, ServerPermissionLevel.updateState, req, res)) {
              return;
            }
          } else {
            // Read operations (GET) require fullReadOnly permission
            if (!this.hasPermissionLevel(authorizedPermissionLevel, ServerPermissionLevel.fullReadOnly, req, res)) {
              return;
            }
          }

          this.handleContentRequest(req, res, corsHeaders, authorizedPermissionLevel)
            .then(() => {
              // Request handled
            })
            .catch((e) => {
              Log.error("Error handling content request: " + e.toString());
              this.sendErrorRequest(500, "Internal server error", req, res);
            });
          return;
        }

        // Handle /api/worldContent/{slot}/* endpoint for serving dedicated server world content
        // This exposes behavior_packs, resource_packs, and world folders from the active server
        if (urlSegments[2] === "worldcontent") {
          // Require fullReadOnly permission for read access
          if (!this.hasPermissionLevel(authorizedPermissionLevel, ServerPermissionLevel.fullReadOnly, req, res)) {
            return;
          }

          this.handleWorldContentRequest(req, res, corsHeaders, urlSegments)
            .then(() => {
              // Request handled
            })
            .catch((e) => {
              Log.error("Error handling worldContent request: " + e.toString());
              this.sendErrorRequest(500, "Internal server error", req, res);
            });
          return;
        }

        // ==========================================================================
        // WORLD BACKUP MANAGEMENT API
        // /api/worlds - List managed worlds
        // /api/worlds/{id} - Get specific world info
        // /api/worlds/{id}/backups - List/create backups for a world
        // /api/worlds/{id}/backups/{timestamp} - Get/delete specific backup
        // /api/worlds/{id}/backups/{timestamp}/export - Export backup as .mcworld
        // ==========================================================================
        if (urlSegments[2] === "worlds") {
          Log.debug("Worlds API request: " + req.url + " segments: " + JSON.stringify(urlSegments));
          if (!this.hasPermissionLevel(authorizedPermissionLevel, ServerPermissionLevel.fullReadOnly, req, res)) {
            return;
          }

          this.handleWorldsRequest(req, res, corsHeaders, urlSegments, authorizedPermissionLevel)
            .then(() => {
              // Request handled
            })
            .catch((e) => {
              Log.error("Error handling worlds request: " + e.toString());
              this.sendErrorRequest(500, "Internal server error: " + e.message, req, res);
            });
          return;
        }

        // ==========================================================================
        // TOOLCOMMAND API
        // /api/commands - List available commands
        // /api/commands/<commandName> - Execute a command
        // ==========================================================================
        if (urlSegments[2] === "commands") {
          if (!this.hasPermissionLevel(authorizedPermissionLevel, ServerPermissionLevel.updateState, req, res)) {
            return;
          }

          this.handleCommandsRequest(req, res, corsHeaders, urlSegments)
            .then(() => {
              // Request handled
            })
            .catch((e) => {
              Log.error("Error handling commands request: " + e.toString());
              this.sendErrorRequest(500, "Internal server error: " + e.message, req, res);
            });
          return;
        }

        // Handle /api/shutdown endpoint for graceful shutdown (only in view mode)
        if (urlSegments[2] === "shutdown" && req.method === "POST") {
          // Only allow shutdown in view mode
          if (!this._isViewMode) {
            this.sendErrorRequest(404, "Not found", req, res);
            return;
          }

          // Require at least fullReadOnly permission
          if (!this.hasPermissionLevel(authorizedPermissionLevel, ServerPermissionLevel.fullReadOnly, req, res)) {
            return;
          }

          Log.message("Shutdown requested via API. Stopping server...");

          // Send success response before shutting down
          res.writeHead(200, { ...corsHeaders, "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true, message: "Server shutting down" }));

          // Schedule shutdown after response is sent
          setTimeout(() => {
            this._serverManager.shutdown("Shutdown requested via API");
          }, 100);

          return;
        }

        // Handle /api/acceptEula endpoint for accepting the Minecraft EULA
        // This allows admins to accept the EULA via the web UI, enabling BDS features
        if (urlSegments[2] === "accepteula" && req.method === "POST") {
          // Only admins can accept the EULA
          if (!this.hasPermissionLevel(authorizedPermissionLevel, ServerPermissionLevel.admin, req, res)) {
            return;
          }

          // Read the request body to get the acceptance value
          let body = "";
          req.on("data", (chunk) => {
            body += chunk;
            if (body.length > 1024) {
              this.sendErrorRequest(413, "Request too large", req, res);
              req.destroy();
              return;
            }
          });

          req.on("end", async () => {
            try {
              const data = JSON.parse(body);
              const accepted = data.accepted === true;

              if (accepted) {
                this._localEnvironment.iAgreeToTheMinecraftEndUserLicenseAgreementAndPrivacyStatementAtMinecraftDotNetSlashEula = true;
                await this._localEnvironment.save();

                Log.message("Minecraft EULA accepted via web API by admin user.");

                res.writeHead(200, { ...corsHeaders, "Content-Type": "application/json" });
                res.end(
                  JSON.stringify({
                    success: true,
                    message: "EULA accepted. Bedrock Dedicated Server features are now available.",
                    eulaAccepted: true,
                  })
                );
              } else {
                res.writeHead(400, { ...corsHeaders, "Content-Type": "application/json" });
                res.end(JSON.stringify({ success: false, message: "EULA acceptance value must be true" }));
              }
            } catch (e) {
              this.sendErrorRequest(400, "Invalid JSON body", req, res);
            }
          });

          return;
        }

        // Handle /api/eulaStatus endpoint for checking EULA acceptance status
        if (urlSegments[2] === "eulastatus" && req.method === "GET") {
          // Any authenticated user can check EULA status
          if (!this.hasPermissionLevel(authorizedPermissionLevel, ServerPermissionLevel.displayReadOnly, req, res)) {
            return;
          }

          const eulaAccepted =
            this._localEnvironment
              .iAgreeToTheMinecraftEndUserLicenseAgreementAndPrivacyStatementAtMinecraftDotNetSlashEula === true;

          res.writeHead(200, { ...corsHeaders, "Content-Type": "application/json" });
          res.end(JSON.stringify({ eulaAccepted }));
          return;
        }

        if (
          urlSegments[2] === "validate" &&
          req.method === "POST" &&
          req.headers["content-type"] === "application/zip"
        ) {
          if (!this.hasPermissionLevel(authorizedPermissionLevel, ServerPermissionLevel.updateState, req, res)) {
            return;
          }

          const body: any[] = [];
          let totalSize = 0;
          req.on("data", (chunk) => {
            totalSize += chunk.length;
            // Security: Check size limit while receiving
            if (totalSize > SecurityUtilities.MAX_UPLOAD_SIZE) {
              this.sendErrorRequest(413, "Upload too large", req, res);
              req.destroy();
              return;
            }
            body.push(Buffer.from(chunk, "binary"));
          });
          req.on("end", async () => {
            if (body.length >= 1) {
              const bodyContent = Buffer.concat(body);

              if (!this.creatorTools) {
                this.sendErrorRequest(500, "Unexpected configuration.", req, res);
                return;
              }

              const zipStorage = new ZipStorage();

              const contentUint = new Uint8Array(bodyContent);

              Log.message(
                HttpUtilities.getShortReqDescription(req) + "Received package of " + contentUint.length + " bytes"
              );

              try {
                await zipStorage.loadFromUint8Array(contentUint);
              } catch (e) {
                this.sendErrorRequest(400, "Error processing passed-in validation package.", req, res);
                return;
              }

              if (!res.headersSent) {
                res.writeHead(200, corsHeaders);
              }

              try {
                const packProject = new Project(this.creatorTools, "Test", null);
                packProject.setProjectFolder(zipStorage.rootFolder);

                await packProject.inferProjectItemsFromFiles();

                let suiteInst: ProjectInfoSuite = ProjectInfoSuite.defaultInDevelopment;
                let excludeTests: string[] = [];

                if (req.headers["mctsuite"] && typeof req.headers["mctsuite"] == "string") {
                  suiteInst = ProjectInfoSet.getSuiteFromString(req.headers["mctsuite"]);
                }

                if (req.headers["mctexcludeTests"] && typeof req.headers["mctexcludeTests"] == "string") {
                  excludeTests = req.headers["mctexcludeTests"].split(",");
                }

                // Server-side context: enable aggressive cleanup for memory efficiency
                const pis = new ProjectInfoSet(packProject, suiteInst, excludeTests, undefined, undefined, undefined);

                await pis.generateForProject();

                let subsetReports: IProjectMetaState[] = [];

                if (req.headers["mctsuite"] === "all") {
                  subsetReports = await ProjectInfoUtilities.getDerivedStates(packProject, pis);
                }

                // Use consistent stringify for platform-agnostic JSON key ordering
                const result = Utilities.consistentStringify(
                  pis.getDataObject(undefined, undefined, undefined, false, subsetReports)
                );

                res.write(result, () => {
                  res.end();

                  if (this._serverManager.runOnce) {
                    this._serverManager.shutdown(
                      "Shutting down due to completion of one validation operation in runOnce mode."
                    );
                  }
                });
              } catch (e: any) {
                this.sendErrorRequest(500, "Error processing request. " + (e.message || e.toString()), req, res);
                return;
              }

              return;
            } else {
              this.sendErrorRequest(400, "Unexpected post type: " + body.length, req, res);
              return;
            }
          });

          return;
        }

        let portOrSlot = -1;

        try {
          portOrSlot = parseInt(urlSegments[2]);
        } catch (e) {}

        if (isNaN(portOrSlot) || portOrSlot < 0 || portOrSlot > 65536 || portOrSlot === 80 || portOrSlot === 443) {
          this.sendErrorRequest(400, "Unexpected port or slot specified", req, res);
          return;
        }

        // Handle upload operations with lazy server initialization
        // This allows edit/view modes to deploy content without pre-configuring BDS
        if (
          urlSegments[3] === "upload" &&
          (req.method === "POST" || req.method === "PATCH") &&
          req.headers["content-type"] === "application/zip"
        ) {
          if (!this.hasPermissionLevel(authorizedPermissionLevel, ServerPermissionLevel.admin, req, res)) {
            return;
          }

          // Handle upload with lazy server initialization
          this.handleUploadWithLazyInit(portOrSlot, req, res, corsHeaders);
          return;
        }

        const server = this._serverManager.getActiveServer(portOrSlot);

        if (!server || this._serverManager.features === ServerManagerFeatures.basicWebServices) {
          this.sendErrorRequest(404, "Service at slot " + portOrSlot + " not found", req, res);

          return;
        }

        // urlSegments[3] may contain query string, e.g., "status?slotconfig=true"
        const actionSegment = urlSegments[3]?.split("?")[0];

        if (actionSegment === "status" && req.method === "GET") {
          if (!this.hasPermissionLevel(authorizedPermissionLevel, ServerPermissionLevel.displayReadOnly, req, res)) {
            return;
          }

          const status = this.getStatus(portOrSlot);

          // Use verbose logging for status polling to reduce log spam
          Log.verbose(HttpUtilities.getShortReqDescription(req));

          res.writeHead(200, { ...corsHeaders, "Content-Type": "application/json" });

          res.end(JSON.stringify(status));
          return;
        } else if (actionSegment === "updateStatus" && req.method === "POST") {
          if (!this.hasPermissionLevel(authorizedPermissionLevel, ServerPermissionLevel.updateState, req, res)) {
            return;
          }

          const body: any[] = [];
          let totalSize = 0;
          const MAX_UPDATE_SIZE = 100000; // 100KB limit for status updates
          req.on("data", (chunk) => {
            totalSize += chunk.length;
            // Security: Limit update body size
            if (totalSize > MAX_UPDATE_SIZE) {
              this.sendErrorRequest(413, "Update request too large", req, res);
              req.destroy();
              return;
            }
            body.push(chunk);
          });

          req.on("end", () => {
            if (body.length === 1) {
              const val = body[0].toString();

              let updates: any | undefined;

              try {
                updates = JSON.parse(val);
              } catch (e) {}

              if (updates && updates.length) {
                const ds = this._serverManager.getActiveServer(portOrSlot);

                if (ds) {
                  // pushUpdates expects an array, so pass the entire updates array
                  ds.pushUpdates(updates);
                }
              }

              res.writeHead(200, this.headers);
              res.end();
              return;
            } else {
              res.writeHead(500, this.headers);
              res.end();
              return;
            }
          });
        } else if (actionSegment === "stop" && req.method === "POST") {
          // POST /api/{slot}/stop - Stop the server on this slot
          if (!this.hasPermissionLevel(authorizedPermissionLevel, ServerPermissionLevel.updateState, req, res)) {
            return;
          }

          Log.message(HttpUtilities.getShortReqDescription(req) + " Stopping server on slot " + portOrSlot);

          this.handleSlotStop(server, portOrSlot, req, res, corsHeaders)
            .then(() => {
              // Request handled
            })
            .catch((e) => {
              Log.error("Error handling stop request: " + e.toString());
              if (!res.headersSent) {
                this.sendErrorRequest(500, "Internal server error", req, res);
              }
            });
          return;
        } else if (actionSegment === "restart" && req.method === "POST") {
          // POST /api/{slot}/restart - Restart the server on this slot
          if (!this.hasPermissionLevel(authorizedPermissionLevel, ServerPermissionLevel.updateState, req, res)) {
            return;
          }

          Log.message(HttpUtilities.getShortReqDescription(req) + " Restarting server on slot " + portOrSlot);

          this.handleSlotRestart(server, portOrSlot, req, res, corsHeaders)
            .then(() => {
              // Request handled
            })
            .catch((e) => {
              Log.error("Error handling restart request: " + e.toString());
              if (!res.headersSent) {
                this.sendErrorRequest(500, "Internal server error", req, res);
              }
            });
          return;
        } else if (actionSegment === "command" && req.method === "POST") {
          if (!this.hasPermissionLevel(authorizedPermissionLevel, ServerPermissionLevel.updateState, req, res)) {
            return;
          }

          const body: any[] = [];
          let totalSize = 0;
          req.on("data", (chunk) => {
            totalSize += chunk.length;
            if (totalSize > 10_000) {
              // Security: 10KB limit for commands
              this.sendErrorRequest(413, "Command too large", req, res);
              req.destroy();
              return;
            }
            body.push(chunk);
          });

          req.on("end", () => {
            if (body.length === 1) {
              const val = body[0].toString();
              // Security: Sanitize and validate command
              const sanitizedCommand = SecurityUtilities.sanitizeCommand(val);
              if (!SecurityUtilities.isCommandSafe(sanitizedCommand)) {
                this.sendErrorRequest(400, "Invalid command", req, res);
                return;
              }
              server.runCommand(sanitizedCommand);
              res.writeHead(200, corsHeaders);
              res.end();
              return;
            } else {
              res.writeHead(500, corsHeaders);
              res.end();
              return;
            }
          });

          return;
        } else if (actionSegment === "debug" && req.method === "POST") {
          // POST /api/{slot}/debug/{action} - Debug controls
          if (!this.hasPermissionLevel(authorizedPermissionLevel, ServerPermissionLevel.updateState, req, res)) {
            return;
          }

          const debugAction = urlSegments[4]?.split("?")[0];
          const debugClient = server.debugClient;

          if (!debugClient) {
            this.sendErrorRequest(400, "Debug client not available", req, res);
            return;
          }

          if (debugAction === "pause") {
            Log.verbose(HttpUtilities.getShortReqDescription(req) + " Pausing debugger on slot " + portOrSlot);
            debugClient.pause();
            res.writeHead(200, corsHeaders);
            res.end(JSON.stringify({ success: true }));
            return;
          } else if (debugAction === "resume") {
            Log.verbose(HttpUtilities.getShortReqDescription(req) + " Resuming debugger on slot " + portOrSlot);
            debugClient.resume();
            res.writeHead(200, corsHeaders);
            res.end(JSON.stringify({ success: true }));
            return;
          } else if (debugAction === "profiler") {
            const profilerAction = urlSegments[5]?.split("?")[0];

            if (profilerAction === "start") {
              Log.message(HttpUtilities.getShortReqDescription(req) + " Starting profiler on slot " + portOrSlot);
              try {
                debugClient.startProfiler();
                res.writeHead(200, corsHeaders);
                res.end(JSON.stringify({ success: true }));
              } catch (e: any) {
                this.sendErrorRequest(400, e.message || "Failed to start profiler", req, res);
              }
              return;
            } else if (profilerAction === "stop") {
              Log.message(HttpUtilities.getShortReqDescription(req) + " Stopping profiler on slot " + portOrSlot);
              try {
                // Use a default captures path in the Minecraft data directory
                const capturesPath = "script_profiles";
                debugClient.stopProfiler(capturesPath);
                res.writeHead(200, corsHeaders);
                res.end(JSON.stringify({ success: true, capturesPath }));
              } catch (e: any) {
                this.sendErrorRequest(400, e.message || "Failed to stop profiler", req, res);
              }
              return;
            }
          }

          this.sendErrorRequest(400, "Unknown debug action: " + debugAction, req, res);
          return;
        }
      }
    }

    res.writeHead(500, corsHeaders);
    res.end();
  }

  getStatus(portOrSlot: number, includeConfig: boolean = true): CartoServerStatusResponse {
    const ds = this._serverManager.getActiveServer(portOrSlot);
    const recentMessages = [];

    if (ds) {
      let lastIndex = ds.outputLines.length;

      while (lastIndex >= 1 && recentMessages.length < 10) {
        lastIndex--;

        recentMessages.push(ds.outputLines[lastIndex]);
      }

      const result: CartoServerStatusResponse = {
        id: portOrSlot,
        status: ds.status,
        recentMessages: recentMessages,
        time: new Date().getTime(),
        worldId: ds.managedWorldId,
      };

      // Include slot config in initial connection responses
      if (includeConfig) {
        // Get debug session info from the debug client
        const debugClient = ds.debugClient;
        const debugSessionInfo = debugClient?.sessionInfo;

        result.slotConfig = {
          debuggerEnabled: ds.debuggerEnabled,
          debuggerStreamingEnabled: ds.debuggerStreamingEnabled,
          // DebugConnectionState is a string enum, so we can use it directly
          debugConnectionState: debugSessionInfo?.state ?? "disconnected",
          debugProtocolVersion: debugSessionInfo?.protocolVersion,
          debugLastStatTick: debugSessionInfo?.lastStatTick,
          debugErrorMessage: debugSessionInfo?.errorMessage,
        };
      }

      return result;
    } else {
      return {
        id: -1,
        time: new Date().getTime(),
      };
    }
  }

  /**
   * Handle requests to /api/content/* for serving local Minecraft content.
   * Generates synthetic index.json files for folders and serves safe file types.
   * In edit mode, also handles PUT (create/update), DELETE, and POST (mkdir) operations.
   */
  private async handleContentRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    corsHeaders: { [key: string]: string },
    permissionLevel?: ServerPermissionLevel
  ) {
    if (!this._contentStorage || !this._contentPath || !req.url) {
      this.sendErrorRequest(500, "Content storage not configured", req, res);
      return;
    }

    // Parse the relative path from the URL
    // URL format: /api/content/path/to/file or /api/content/path/to/folder/index.json
    const urlPath = decodeURIComponent(req.url.split("?")[0]);
    let relativePath = urlPath.replace(/^\/api\/content\/?/, "");

    // Security: Validate path for traversal attacks
    if (!SecurityUtilities.validatePathTraversal("/" + relativePath)) {
      this.sendErrorRequest(400, "Invalid path", req, res);
      return;
    }

    // Security: Check each path segment for hidden/blocked folders
    const pathSegments = relativePath.split("/").filter((s) => s.length > 0);
    for (const segment of pathSegments) {
      if (!this.isFolderSafeToServe(segment) && pathSegments.indexOf(segment) < pathSegments.length - 1) {
        // It's a folder segment (not the last segment which could be a file)
        this.sendErrorRequest(403, "Access to this folder is not allowed", req, res);
        return;
      }
    }

    // Handle write operations (PUT, DELETE, POST) in edit mode
    if (req.method === "PUT") {
      await this.handleContentPut(relativePath, req, res, corsHeaders);
      return;
    }

    if (req.method === "DELETE") {
      await this.handleContentDelete(relativePath, req, res, corsHeaders);
      return;
    }

    if (req.method === "POST") {
      await this.handleContentPost(relativePath, req, res, corsHeaders);
      return;
    }

    // Handle GET requests
    // Check if this is a request for index.json (folder listing)
    if (relativePath.endsWith("/index.json") || relativePath === "index.json" || relativePath === "") {
      // Handle folder listing request
      let folderPath = relativePath.replace(/\/?index\.json$/, "");
      if (folderPath === "") {
        folderPath = "/";
      } else if (!folderPath.startsWith("/")) {
        folderPath = "/" + folderPath;
      }

      await this.serveContentFolderListing(folderPath, req, res, corsHeaders);
      return;
    }

    // Handle file request
    await this.serveContentFile(relativePath, req, res, corsHeaders);
  }

  /**
   * Generate and serve a synthetic index.json for a folder.
   */
  private async serveContentFolderListing(
    relativeFolderPath: string,
    req: http.IncomingMessage,
    res: http.ServerResponse,
    corsHeaders: { [key: string]: string }
  ) {
    if (!this._contentStorage) {
      this.sendErrorRequest(500, "Content storage not configured", req, res);
      return;
    }

    try {
      // Get the folder from storage
      let folder = this._contentStorage.rootFolder;

      if (relativeFolderPath !== "/" && relativeFolderPath !== "") {
        const pathParts = relativeFolderPath.split("/").filter((p) => p.length > 0);
        for (const part of pathParts) {
          if (!this.isFolderSafeToServe(part)) {
            this.sendErrorRequest(403, "Access to this folder is not allowed", req, res);
            return;
          }
          folder = folder.ensureFolder(part);
        }
      }

      // Load the folder contents
      await folder.load();

      // Build the index.json response
      const files: string[] = [];
      const folders: string[] = [];

      // Add subfolders (filter out hidden/blocked folders)
      for (const folderName in folder.folders) {
        const subFolder = folder.folders[folderName];
        if (subFolder && this.isFolderSafeToServe(subFolder.name)) {
          folders.push(subFolder.name);
        }
      }

      // Add files (filter by safe extensions and blocked names)
      for (const fileName in folder.files) {
        const file = folder.files[fileName];
        if (file && this.isFileSafeToServe(file.name)) {
          files.push(file.name);
        }
      }

      // Sort alphabetically
      files.sort();
      folders.sort();

      const indexJson = {
        files: files,
        folders: folders,
      };

      res.writeHead(200, {
        ...corsHeaders,
        "Content-Type": "application/json",
      });
      res.end(JSON.stringify(indexJson));
    } catch (e: any) {
      Log.debug("Error serving content folder listing: " + e.message);
      this.sendErrorRequest(404, "Folder not found", req, res);
    }
  }

  /**
   * Serve a file from the content storage.
   */
  private async serveContentFile(
    relativePath: string,
    req: http.IncomingMessage,
    res: http.ServerResponse,
    corsHeaders: { [key: string]: string }
  ) {
    if (!this._contentStorage) {
      this.sendErrorRequest(500, "Content storage not configured", req, res);
      return;
    }

    // Get the file name and check if it's safe to serve
    const fileName = relativePath.split("/").pop() || "";
    if (!this.isFileSafeToServe(fileName)) {
      this.sendErrorRequest(403, "This file type is not allowed", req, res);
      return;
    }

    try {
      // Navigate to the file
      const pathParts = relativePath.split("/").filter((p) => p.length > 0);
      let folder = this._contentStorage.rootFolder;

      // Navigate to parent folder
      for (let i = 0; i < pathParts.length - 1; i++) {
        const part = pathParts[i];
        if (!this.isFolderSafeToServe(part)) {
          this.sendErrorRequest(403, "Access to this folder is not allowed", req, res);
          return;
        }
        folder = folder.ensureFolder(part);
      }

      const file = folder.ensureFile(fileName);

      // Check if file exists
      const exists = await file.exists();
      if (!exists) {
        this.sendErrorRequest(404, "File not found", req, res);
        return;
      }

      // Load file content
      await file.loadContent(false);

      if (file.content === null || file.content === undefined) {
        this.sendErrorRequest(404, "File content not found", req, res);
        return;
      }

      // Determine MIME type
      const mimeType = this.getMimeTypeForFile(file.type) || "application/octet-stream";

      res.writeHead(200, {
        ...corsHeaders,
        "Content-Type": mimeType,
      });

      if (typeof file.content === "string") {
        res.end(file.content);
      } else {
        res.end(file.content);
      }
    } catch (e: any) {
      Log.debug("Error serving content file: " + e.message);
      this.sendErrorRequest(404, "File not found", req, res);
    }
  }

  /**
   * Handle requests to /api/worldContent/{slot}/* for serving dedicated server world content.
   * This endpoint exposes a virtualized view of the server's content folders:
   * - /api/worldContent/{slot}/behavior_packs/ -> development_behavior_packs
   * - /api/worldContent/{slot}/resource_packs/ -> development_resource_packs
   * - /api/worldContent/{slot}/world/ -> worlds/defaultWorld
   *
   * The slot parameter is the port number of the dedicated server.
   */
  private async handleWorldContentRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    corsHeaders: { [key: string]: string },
    urlSegments: string[]
  ) {
    if (!req.url) {
      this.sendErrorRequest(400, "Invalid request", req, res);
      return;
    }

    // Parse slot from urlSegments[3]: /api/worldContent/{slot}/...
    if (urlSegments.length < 4) {
      this.sendErrorRequest(400, "Missing server slot in URL", req, res);
      return;
    }

    let slot = -1;
    try {
      slot = parseInt(urlSegments[3]);
    } catch (e) {
      this.sendErrorRequest(400, "Invalid server slot", req, res);
      return;
    }

    if (slot < 0 || slot > 65536) {
      this.sendErrorRequest(400, "Invalid server slot range", req, res);
      return;
    }

    // Get the dedicated server for this slot
    const server = this._serverManager.getActiveServer(slot);
    if (!server) {
      this.sendErrorRequest(404, "No active server at slot " + slot, req, res);
      return;
    }

    // Parse the content category and path
    // URL format: /api/worldContent/{slot}/{category}/{path...}
    // Categories: behavior_packs, resource_packs, world
    const category = urlSegments[4];
    const remainingPath = urlSegments.slice(5).join("/");

    // Handle root listing (list available categories)
    if (!category || category === "" || category === "index.json") {
      this.serveWorldContentRootListing(res, corsHeaders, slot);
      return;
    }

    // Map category to server folder
    let serverFolder: IFolder | undefined;
    switch (category) {
      case "behavior_packs":
        await server.ensureServerFolders();
        serverFolder = (server as any).behaviorPacksStorage?.rootFolder;
        if (!serverFolder) {
          // Create storage if not yet initialized
          const bpStorage = new NodeStorage(
            NodeStorage.ensureEndsWithDelimiter(server.serverPath) + "development_behavior_packs",
            ""
          );
          serverFolder = bpStorage.rootFolder;
        }
        break;
      case "resource_packs":
        await server.ensureServerFolders();
        serverFolder = (server as any).resourcePacksStorage?.rootFolder;
        if (!serverFolder) {
          const rpStorage = new NodeStorage(
            NodeStorage.ensureEndsWithDelimiter(server.serverPath) + "development_resource_packs",
            ""
          );
          serverFolder = rpStorage.rootFolder;
        }
        break;
      case "world":
        await server.ensureServerFolders();
        serverFolder = server.defaultWorldFolder;
        if (!serverFolder) {
          const worldStorage = new NodeStorage(server.worldStoragePath, "");
          serverFolder = worldStorage.rootFolder;
        }
        break;
      default:
        this.sendErrorRequest(404, "Unknown content category: " + category, req, res);
        return;
    }

    if (!serverFolder) {
      this.sendErrorRequest(500, "Could not access server folder", req, res);
      return;
    }

    // Handle folder listing or file serving
    const isIndexRequest =
      remainingPath === "" ||
      remainingPath === "index.json" ||
      remainingPath.endsWith("/index.json") ||
      remainingPath.endsWith("/");

    if (isIndexRequest) {
      await this.serveWorldContentFolderListing(serverFolder, remainingPath, res, corsHeaders);
    } else {
      await this.serveWorldContentFile(serverFolder, remainingPath, req, res, corsHeaders);
    }
  }

  /**
   * Serve the root listing of world content categories.
   */
  private serveWorldContentRootListing(res: http.ServerResponse, corsHeaders: { [key: string]: string }, slot: number) {
    const listing = {
      folders: ["behavior_packs", "resource_packs", "world"],
      files: [] as string[],
      slot: slot,
    };

    res.writeHead(200, {
      ...corsHeaders,
      "Content-Type": "application/json",
    });
    res.end(JSON.stringify(listing));
  }

  /**
   * Serve a folder listing for world content.
   */
  private async serveWorldContentFolderListing(
    baseFolder: IFolder,
    relativePath: string,
    res: http.ServerResponse,
    corsHeaders: { [key: string]: string }
  ) {
    try {
      // Clean up path
      let cleanPath = relativePath.replace(/\/?index\.json$/, "").replace(/\/$/, "");

      // Navigate to the target folder
      let folder = baseFolder;
      if (cleanPath && cleanPath.length > 0) {
        const pathParts = cleanPath.split("/").filter((p) => p.length > 0);
        for (const part of pathParts) {
          // Security check
          if (!this.isFolderSafeToServe(part)) {
            res.writeHead(403, corsHeaders);
            res.end(JSON.stringify({ error: "Access denied" }));
            return;
          }
          folder = folder.ensureFolder(part);
        }
      }

      await folder.load(true); // Force reload to get fresh file list from disk

      // Build listing
      const folderNames: string[] = [];
      const fileNames: string[] = [];

      for (const subFolderName in folder.folders) {
        const subFolder = folder.folders[subFolderName];
        if (subFolder && this.isFolderSafeToServe(subFolderName)) {
          folderNames.push(subFolderName);
        }
      }

      for (const fileName in folder.files) {
        const file = folder.files[fileName];
        if (file && this.isFileSafeToServe(fileName)) {
          fileNames.push(fileName);
        }
      }

      const listing = {
        folders: folderNames,
        files: fileNames,
      };

      res.writeHead(200, {
        ...corsHeaders,
        "Content-Type": "application/json",
      });
      res.end(JSON.stringify(listing));
    } catch (e: any) {
      Log.debug("Error serving world content folder listing: " + e.message);
      res.writeHead(404, corsHeaders);
      res.end(JSON.stringify({ error: "Folder not found" }));
    }
  }

  /**
   * Serve a file from world content.
   */
  private async serveWorldContentFile(
    baseFolder: IFolder,
    relativePath: string,
    req: http.IncomingMessage,
    res: http.ServerResponse,
    corsHeaders: { [key: string]: string }
  ) {
    const pathParts = relativePath.split("/").filter((p) => p.length > 0);
    if (pathParts.length === 0) {
      this.sendErrorRequest(400, "Invalid file path", req, res);
      return;
    }

    const fileName = pathParts[pathParts.length - 1];

    // Security checks
    if (!this.isFileSafeToServe(fileName)) {
      this.sendErrorRequest(403, "This file type is not allowed", req, res);
      return;
    }

    try {
      let folder = baseFolder;

      // Navigate to parent folder
      for (let i = 0; i < pathParts.length - 1; i++) {
        const part = pathParts[i];
        if (!this.isFolderSafeToServe(part)) {
          this.sendErrorRequest(403, "Access to this folder is not allowed", req, res);
          return;
        }
        folder = folder.ensureFolder(part);
      }

      const file = folder.ensureFile(fileName);

      const exists = await file.exists();
      if (!exists) {
        this.sendErrorRequest(404, "File not found", req, res);
        return;
      }

      await file.loadContent(false);

      if (file.content === null || file.content === undefined) {
        this.sendErrorRequest(404, "File content not found", req, res);
        return;
      }

      const mimeType = this.getMimeTypeForFile(file.type) || "application/octet-stream";

      res.writeHead(200, {
        ...corsHeaders,
        "Content-Type": mimeType,
      });

      if (typeof file.content === "string") {
        res.end(file.content);
      } else {
        res.end(file.content);
      }
    } catch (e: any) {
      Log.debug("Error serving world content file: " + e.message);
      this.sendErrorRequest(404, "File not found", req, res);
    }
  }

  /**
   * Handle PUT requests to /api/content/* for creating or updating files.
   * Requires edit mode and updateState permission.
   */
  private async handleContentPut(
    relativePath: string,
    req: http.IncomingMessage,
    res: http.ServerResponse,
    corsHeaders: { [key: string]: string }
  ) {
    if (!this._contentStorage) {
      this.sendErrorRequest(500, "Content storage not configured", req, res);
      return;
    }

    // Get the file name and check if it's safe to write
    const fileName = relativePath.split("/").pop() || "";
    if (!this.isFileSafeToServe(fileName)) {
      this.sendErrorRequest(403, "This file type is not allowed for writing", req, res);
      return;
    }

    try {
      // Read the request body
      const body = await this.readRequestBody(req);

      // Navigate to the file
      const pathParts = relativePath.split("/").filter((p) => p.length > 0);
      let folder = this._contentStorage.rootFolder;

      // Navigate to parent folder (create if needed)
      for (let i = 0; i < pathParts.length - 1; i++) {
        const part = pathParts[i];
        if (!this.isFolderSafeToServe(part)) {
          this.sendErrorRequest(403, "Access to this folder is not allowed", req, res);
          return;
        }
        folder = folder.ensureFolder(part);
      }

      const file = folder.ensureFile(fileName);

      // Set file content based on content type
      const contentType = req.headers["content-type"] || "";
      if (
        contentType.includes("application/json") ||
        contentType.includes("text/") ||
        fileName.endsWith(".json") ||
        fileName.endsWith(".ts") ||
        fileName.endsWith(".js") ||
        fileName.endsWith(".mcfunction") ||
        fileName.endsWith(".lang") ||
        fileName.endsWith(".txt") ||
        fileName.endsWith(".md") ||
        fileName.endsWith(".html")
      ) {
        // Text content
        file.setContent(body.toString("utf8"));
      } else {
        // Binary content
        file.setContent(body);
      }

      // Save the file
      await file.saveContent();

      res.writeHead(200, {
        ...corsHeaders,
        "Content-Type": "application/json",
      });
      res.end(JSON.stringify({ success: true, path: relativePath }));

      Log.verbose("Content file saved: " + relativePath);
    } catch (e: any) {
      Log.debug("Error writing content file: " + e.message);
      this.sendErrorRequest(500, "Failed to write file: " + e.message, req, res);
    }
  }

  /**
   * Handle DELETE requests to /api/content/* for deleting files.
   * Requires edit mode and updateState permission.
   */
  private async handleContentDelete(
    relativePath: string,
    req: http.IncomingMessage,
    res: http.ServerResponse,
    corsHeaders: { [key: string]: string }
  ) {
    if (!this._contentStorage) {
      this.sendErrorRequest(500, "Content storage not configured", req, res);
      return;
    }

    // Get the file name and check if it's safe to delete
    const fileName = relativePath.split("/").pop() || "";
    if (!this.isFileSafeToServe(fileName)) {
      this.sendErrorRequest(403, "This file type is not allowed for deletion", req, res);
      return;
    }

    try {
      // Navigate to the file
      const pathParts = relativePath.split("/").filter((p) => p.length > 0);
      let folder = this._contentStorage.rootFolder;

      // Navigate to parent folder
      for (let i = 0; i < pathParts.length - 1; i++) {
        const part = pathParts[i];
        if (!this.isFolderSafeToServe(part)) {
          this.sendErrorRequest(403, "Access to this folder is not allowed", req, res);
          return;
        }
        folder = folder.ensureFolder(part);
      }

      await folder.load();

      const file = folder.files[fileName];
      if (!file) {
        this.sendErrorRequest(404, "File not found", req, res);
        return;
      }

      // Delete the file
      await file.deleteThisFile();

      res.writeHead(200, {
        ...corsHeaders,
        "Content-Type": "application/json",
      });
      res.end(JSON.stringify({ success: true, path: relativePath, deleted: true }));

      Log.verbose("Content file deleted: " + relativePath);
    } catch (e: any) {
      Log.debug("Error deleting content file: " + e.message);
      this.sendErrorRequest(500, "Failed to delete file: " + e.message, req, res);
    }
  }

  /**
   * Handle POST requests to /api/content/* for creating directories or other actions.
   * Requires edit mode and updateState permission.
   */
  private async handleContentPost(
    relativePath: string,
    req: http.IncomingMessage,
    res: http.ServerResponse,
    corsHeaders: { [key: string]: string }
  ) {
    if (!this._contentStorage) {
      this.sendErrorRequest(500, "Content storage not configured", req, res);
      return;
    }

    // Parse action from query string
    const urlParts = req.url?.split("?") || [];
    const queryString = urlParts.length > 1 ? urlParts[1] : "";
    const params = new URLSearchParams(queryString);
    const action = params.get("action");

    if (action === "mkdir") {
      // Create a directory
      try {
        const pathParts = relativePath.split("/").filter((p) => p.length > 0);
        let folder = this._contentStorage.rootFolder;

        for (const part of pathParts) {
          if (!this.isFolderSafeToServe(part)) {
            this.sendErrorRequest(403, "This folder name is not allowed", req, res);
            return;
          }
          folder = folder.ensureFolder(part);
        }

        // Ensure the folder exists on disk
        await folder.ensureExists();

        res.writeHead(200, {
          ...corsHeaders,
          "Content-Type": "application/json",
        });
        res.end(JSON.stringify({ success: true, path: relativePath, created: true }));

        Log.verbose("Content folder created: " + relativePath);
      } catch (e: any) {
        Log.debug("Error creating content folder: " + e.message);
        this.sendErrorRequest(500, "Failed to create folder: " + e.message, req, res);
      }
    } else {
      this.sendErrorRequest(400, "Unknown or missing action parameter", req, res);
    }
  }

  /**
   * Read the full request body as a Buffer.
   */
  private readRequestBody(req: http.IncomingMessage): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let totalSize = 0;
      const MAX_BODY_SIZE = 50_000_000; // 50MB limit
      req.on("data", (chunk: Buffer) => {
        totalSize += chunk.length;
        if (totalSize > MAX_BODY_SIZE) {
          reject(new Error("Request body too large"));
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });
      req.on("end", () => {
        resolve(Buffer.concat(chunks));
      });
      req.on("error", reject);
    });
  }

  sendErrorRequest(statusCode: number, message: string, req: http.IncomingMessage, res: http.ServerResponse) {
    Log.message(HttpUtilities.getShortReqDescription(req) + "Error request: " + message);
    if (!res.headersSent) {
      const corsHeaders = this.getCorsHeaders(req);
      res.writeHead(statusCode, { ...corsHeaders, "Content-Type": "text/plain" });
    }
    res.end(message);

    if (this._serverManager.runOnce) {
      this._serverManager.shutdown("Shutting down due to completion of one validation operation in runOnce mode.");
    }
  }

  hasPermissionLevel(
    currentPermLevel: ServerPermissionLevel,
    requiredPermissionLevel: ServerPermissionLevel,
    req: http.IncomingMessage,
    res: http.ServerResponse
  ) {
    if (currentPermLevel < requiredPermissionLevel) {
      Log.message(
        HttpUtilities.getShortReqDescription(req) +
          "Current permissions (" +
          +currentPermLevel +
          ") granted, but (" +
          requiredPermissionLevel +
          ") needed; 401 returned."
      );
      const corsHeaders = this.getCorsHeaders(req);
      res.writeHead(401, corsHeaders);
      res.end("API call failed due to insufficient permissions (" + requiredPermissionLevel + ")");
      return false;
    }

    return true;
  }

  async serveContent(baseSegment: string, relativeUrl: string, storage: IStorage, res: http.ServerResponse) {
    // Strip the base segment from the URL, keeping the leading slash
    // e.g., "res/latest/van" + "/res/latest/van/release/..." → "/release/..."
    relativeUrl = relativeUrl.substring(baseSegment.length + 1);

    // Ensure the path has a leading slash for getFileFromRelativePath
    if (relativeUrl.length > 0 && relativeUrl[0] !== "/") {
      relativeUrl = "/" + relativeUrl;
    }
    // Note: Do NOT lowercase the URL - file systems may be case-sensitive (Linux)
    // and Monaco editor files use mixed case (e.g., jsonMode.js)

    // Security: Validate path to prevent directory traversal attacks
    // Note: We check for traversal patterns but allow leading slashes since
    // the internal storage system expects paths like "/images/favicon.ico"
    if (!SecurityUtilities.validatePathTraversal(relativeUrl)) {
      res.writeHead(400, this.headers);
      res.end("Invalid path");
      return;
    }

    // Sanitize the path as an extra precaution (removes null bytes, normalizes slashes)
    relativeUrl = SecurityUtilities.sanitizeStoragePath(relativeUrl);

    const file = await storage.rootFolder.getFileFromRelativePath(relativeUrl);

    if (file === undefined) {
      // Note: req not available here, using default headers
      res.writeHead(404, this.headers);
      res.end("Could not find '" + baseSegment + relativeUrl + "'");
      Log.debug("404 Not Found: /" + baseSegment + relativeUrl);
      return;
    }

    if (!file.isContentLoaded) {
      await file.loadContent();
    }

    const mimeType = this.getMimeTypeForFile(file.type);

    if (!mimeType || !file.content) {
      // Note: req not available here, using default headers
      res.writeHead(404, this.headers);
      res.end("Could not find '" + baseSegment + relativeUrl + "'");
      return;
    }

    // Note: req not available here, using default headers
    res.writeHead(200, {
      ...this.headers,
      "Content-Type": mimeType,
    });

    if (typeof file.content === "string") {
      res.end(file.content);
    } else if (file.content instanceof Buffer || file.content instanceof Uint8Array) {
      // Binary content - send as Buffer
      res.end(file.content);
    } else if (file.content) {
      res.end(file.content);
    } else {
      res.end();
    }
  }

  encrypt(text: string) {
    if (this._localEnvironment.tokenEncryptionKey === undefined) {
      throw new Error("Token encryption key is not configured");
    }

    // GCM requires 12-byte IV (96 bits) for optimal security
    const iv = crypto.randomBytes(12);

    const pwHash = this.getPasswordHash();

    const cipher = crypto.createCipheriv(this._algorithm, pwHash, iv) as crypto.CipherGCM;

    const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);

    // Get authentication tag (16 bytes for GCM)
    const authTag = cipher.getAuthTag();

    // Return IV, encrypted content, and auth tag
    return {
      iv: iv.toString("hex"),
      content: encrypted.toString("hex"),
      authTag: authTag.toString("hex"),
    };
  }

  decrypt(iv: string, content: string, authTag?: string) {
    if (this._localEnvironment.tokenEncryptionKey === undefined) {
      throw new Error("Token encryption key is not configured");
    }

    const pwHash = this.getPasswordHash();

    const decipher = crypto.createDecipheriv(this._algorithm, pwHash, Buffer.from(iv, "hex")) as crypto.DecipherGCM;

    // Set auth tag for GCM authentication
    if (authTag) {
      decipher.setAuthTag(Buffer.from(authTag, "hex"));
    }

    try {
      return Buffer.concat([decipher.update(Buffer.from(content, "hex")), decipher.final()]).toString("utf8");
    } catch (e) {
      // Authentication failed - this is expected when a cookie from a different server session
      // is sent (cookies are domain-scoped, not port-scoped, so localhost cookies persist
      // across different server sessions on different ports)
      Log.verbose(
        "Auth cookie decryption failed - likely from a different server session on localhost (cookies are domain-scoped, not port-scoped)"
      );
      throw new Error("Token authentication failed - please refresh the page to re-authenticate");
    }
  }

  getMimeTypeForFile(extension: string) {
    switch (extension) {
      case "json":
        return "application/json";
      case "png":
        return "image/png";
      case "jpg":
        return "image/jpeg";
      case "svg":
        return "image/svg+xml";
      case "mjs":
      case "js":
        return "text/javascript";
      case "ico":
        return "image/x-icon";
      case "css":
        return "text/css";
      case "woff":
        return "font/woff";
      case "woff2":
        return "font/woff2";
      case "ttf":
        return "font/ttf";
      case "zip":
        return "application/zip";

      default:
        return undefined;
    }
  }

  /**
   * Escapes a string for safe inclusion in HTML/JavaScript.
   * Prevents XSS attacks from user-controlled content.
   */
  private escapeForHtml(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#x27;")
      .replace(/\//g, "&#x2F;");
  }

  /**
   * Escapes a string for safe inclusion in a JavaScript string literal.
   */
  private escapeForJs(str: string): string {
    return str
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/'/g, "\\'")
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\r")
      .replace(/<\/script/gi, "<\\/script");
  }

  // ==========================================================================
  // UPLOAD WITH LAZY SERVER INITIALIZATION
  // ==========================================================================

  /**
   * Handle upload requests with lazy server initialization.
   * This allows edit/view modes to deploy content to BDS without requiring
   * the server to be pre-configured on startup.
   *
   * The server will be lazily initialized when the first deploy is attempted.
   */
  private handleUploadWithLazyInit(
    portOrSlot: number,
    req: http.IncomingMessage,
    res: http.ServerResponse,
    corsHeaders: { [key: string]: string }
  ) {
    const body: any[] = [];
    let totalSize = 0;

    req.on("data", (chunk) => {
      totalSize += chunk.length;
      // Security: Check size limit
      if (totalSize > SecurityUtilities.MAX_UPLOAD_SIZE) {
        this.sendErrorRequest(413, "Upload too large", req, res);
        req.destroy();
        return;
      }
      body.push(chunk);
    });

    req.on("end", async () => {
      if (body.length < 1) {
        res.writeHead(400, corsHeaders);
        res.end();
        return;
      }

      const zipStorage = new ZipStorage();

      // Concatenate all chunks into a single buffer, then convert to Uint8Array
      const concatenatedBuffer = Buffer.concat(body);
      const contentUint = new Uint8Array(concatenatedBuffer);

      Log.message(
        HttpUtilities.getShortReqDescription(req) + "Received update package of " + contentUint.length + " bytes"
      );

      try {
        await zipStorage.loadFromUint8Array(contentUint);
      } catch (e) {
        Log.debug("Failed to load zip from upload: " + e);
        res.writeHead(400, corsHeaders);
        res.end();
        return;
      }

      // Try to get existing server, or lazily initialize one
      let server: DedicatedServer | undefined = this._serverManager.getActiveServer(portOrSlot);

      if (!server) {
        // Check if EULA has been accepted first
        if (
          !this._localEnvironment
            .iAgreeToTheMinecraftEndUserLicenseAgreementAndPrivacyStatementAtMinecraftDotNetSlashEula
        ) {
          Log.message("EULA not accepted - cannot initialize server for deployment");
          res.writeHead(451, corsHeaders); // 451 = Unavailable For Legal Reasons
          res.end(
            JSON.stringify({
              error: "EULA not accepted",
              code: "EULA_REQUIRED",
              message:
                "You must accept the Minecraft End User License Agreement before deploying to a Bedrock Dedicated Server. Please accept the EULA in the Server Settings panel.",
              eulaRequired: true,
            })
          );
          return;
        }

        // Lazy initialization: ensure a server exists for this slot
        Log.message("No active server at slot " + portOrSlot + ", initializing server for deployment...");

        try {
          server = await this._serverManager.ensureActiveServer(portOrSlot);

          if (!server) {
            Log.error("Failed to initialize server for deployment at slot " + portOrSlot);
            res.writeHead(503, corsHeaders);
            res.end(
              JSON.stringify({
                error: "Server initialization failed",
                code: "INIT_FAILED",
                message:
                  "Could not initialize Bedrock Dedicated Server. Please check the server logs for more details.",
              })
            );
            return;
          }

          Log.message("Server initialized successfully at slot " + portOrSlot);
        } catch (e: any) {
          Log.error("Error initializing server for deployment: " + e.message);
          res.writeHead(503, corsHeaders);
          res.end(
            JSON.stringify({
              error: "Server initialization error",
              code: "INIT_ERROR",
              message: e.message || "Failed to initialize server",
            })
          );
          return;
        }
      }

      let isReloadable = false;
      if (req.headers["mctools-reloadable"]) {
        isReloadable = true;
      }

      // TypeScript control flow doesn't track the early returns in nested blocks above,
      // so we need an explicit guard here even though server is guaranteed to be defined
      if (!server) {
        res.writeHead(500, corsHeaders);
        res.end(JSON.stringify({ error: "Server unexpectedly undefined" }));
        return;
      }

      try {
        await server.deploy(zipStorage.rootFolder, req.method === "PATCH", isReloadable);
      } catch (e) {
        Log.debug("Failed to deploy: " + e);
        res.writeHead(500, corsHeaders);
        res.end();
        return;
      }

      res.writeHead(200, corsHeaders);
      res.end();

      if (this._serverManager.runOnce) {
        this._serverManager.shutdown("Shutting down due to completion of one deploy operation in runOnce mode.");
      }
    });
  }

  // ==========================================================================
  // SLOT STOP/RESTART HANDLERS
  // ==========================================================================

  /**
   * Handle POST /api/{slot}/stop - Stop the server on a specific slot.
   */
  private async handleSlotStop(
    server: DedicatedServer,
    slot: number,
    req: http.IncomingMessage,
    res: http.ServerResponse,
    corsHeaders: { [key: string]: string }
  ) {
    try {
      await server.stopServer();
      res.writeHead(200, corsHeaders);
      res.end(JSON.stringify({ success: true, message: "Server stopped" }));
    } catch (e: any) {
      Log.error("Failed to stop server on slot " + slot + ": " + e.message);
      res.writeHead(500, corsHeaders);
      res.end(JSON.stringify({ success: false, error: e.message }));
    }
  }

  /**
   * Handle POST /api/{slot}/restart - Restart the server on a specific slot.
   */
  private async handleSlotRestart(
    server: DedicatedServer,
    slot: number,
    req: http.IncomingMessage,
    res: http.ServerResponse,
    corsHeaders: { [key: string]: string }
  ) {
    try {
      await server.stopServer();
      await server.startServer(false, undefined);
      res.writeHead(200, corsHeaders);
      res.end(JSON.stringify({ success: true, message: "Server restarted" }));
    } catch (e: any) {
      Log.error("Failed to restart server on slot " + slot + ": " + e.message);
      res.writeHead(500, corsHeaders);
      res.end(JSON.stringify({ success: false, error: e.message }));
    }
  }

  // ==========================================================================
  // WORLD BACKUP MANAGEMENT HANDLERS
  // ==========================================================================

  /**
   * Handle requests to /api/worlds/* endpoints.
   * Provides CRUD operations for managed worlds and their backups.
   *
   * Endpoints:
   * GET  /api/worlds - List all managed worlds
   * POST /api/worlds - Create a new managed world
   * GET  /api/worlds/{id} - Get world info
   * DELETE /api/worlds/{id} - Delete a world (requires admin)
   * GET  /api/worlds/{id}/backups - List backups for a world
   * POST /api/worlds/{id}/backups - Create a new backup (with source slot)
   * GET  /api/worlds/{id}/backups/{timestamp} - Get backup info
   * DELETE /api/worlds/{id}/backups/{timestamp} - Delete a backup
   * POST /api/worlds/{id}/backups/{timestamp}/restore - Restore backup to slot
   * GET  /api/worlds/{id}/backups/{timestamp}/export - Export as .mcworld
   */
  private async handleWorldsRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    corsHeaders: { [key: string]: string },
    urlSegments: string[],
    permissionLevel: ServerPermissionLevel
  ): Promise<void> {
    const worldBackupManager = this._serverManager.worldBackupManager;

    if (!worldBackupManager) {
      Log.error("World backup manager not initialized");
      this.sendErrorRequest(503, "World backup manager not initialized. Server may still be starting.", req, res);
      return;
    }

    // Parse URL: /api/worlds/{worldId?}/backups/{timestamp?}/{action?}
    const worldId = urlSegments[3]; // may be undefined
    const segment4 = urlSegments[4]; // "backups" or undefined
    const timestamp = urlSegments[5]; // backup timestamp or undefined
    const action = urlSegments[6]; // "restore", "export", or undefined

    Log.debug(`handleWorldsRequest: worldId=${worldId}, segment4=${segment4}, method=${req.method}`);

    // GET /api/worlds - List all worlds
    if (!worldId && req.method === "GET") {
      Log.debug("Handling GET /api/worlds - listing all worlds");
      const worlds = worldBackupManager.managedWorlds;
      const summary = await Promise.all(
        worlds.map(async (w) => {
          await w.loadBackups();
          return w.getSummary();
        })
      );

      // Also include active worlds from running servers that aren't in the backup manager
      const activeWorlds: any[] = [];
      for (const server of this._serverManager.activeServers) {
        const activeWorldId = server.managedWorldId;
        // If this server's world is already in the managed worlds, skip it
        if (activeWorldId && worlds.find((w) => w.id === activeWorldId)) {
          continue;
        }

        // Add a synthetic entry for the active world
        const worldName = server.properties?.levelName || "Default World";
        activeWorlds.push({
          worldId: activeWorldId || `slot-${server.port}`,
          friendlyName: worldName,
          description: `Active world on slot ${server.port}`,
          createdAt: new Date().toISOString(),
          lastModified: new Date().toISOString(),
          backupCount: 0,
          isActiveWorld: true,
          slotPort: server.port,
        });
      }

      res.writeHead(200, { ...corsHeaders, "Content-Type": "application/json" });
      res.end(JSON.stringify({ worlds: [...summary, ...activeWorlds] }));
      return;
    }

    // POST /api/worlds - Create a new world
    if (!worldId && req.method === "POST") {
      if (!this.hasPermissionLevel(permissionLevel, ServerPermissionLevel.updateState, req, res)) {
        return;
      }

      const body = await this.readRequestBodyJson(req, res, 4096);
      if (!body) return;

      const friendlyName = body.friendlyName || body.name || "New World";
      const description = body.description;

      const world = await this._serverManager.createManagedWorld(friendlyName, description);

      res.writeHead(201, { ...corsHeaders, "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          worldId: world.worldId,
          friendlyName: world.friendlyName,
          description: world.description,
        })
      );
      return;
    }

    // Validate worldId for all other routes
    if (!worldId || worldId.length === 0) {
      this.sendErrorRequest(400, "World ID required", req, res);
      return;
    }

    const world = worldBackupManager.getWorld(worldId);

    // Check if this is a synthetic active world ID (e.g., "slot-19132")
    const isSyntheticWorldId = worldId.startsWith("slot-");

    // GET /api/worlds/{id} - Get world info
    if (!segment4 && req.method === "GET") {
      if (!world) {
        // For synthetic world IDs, return basic info instead of 404
        if (isSyntheticWorldId) {
          const slotPort = parseInt(worldId.replace("slot-", ""), 10);
          const server = this._serverManager.getActiveServer(slotPort);
          if (server) {
            res.writeHead(200, { ...corsHeaders, "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                worldId,
                friendlyName: server.properties?.levelName || "Active World",
                description: `Active world on slot ${slotPort}`,
                createdAt: new Date().toISOString(),
                lastModified: new Date().toISOString(),
                backupCount: 0,
                isActiveWorld: true,
                slotPort,
              })
            );
            return;
          }
        }
        this.sendErrorRequest(404, `World ${worldId} not found`, req, res);
        return;
      }

      await world.loadBackups();
      res.writeHead(200, { ...corsHeaders, "Content-Type": "application/json" });
      res.end(JSON.stringify(world.getSummary()));
      return;
    }

    // DELETE /api/worlds/{id} - Delete a world (admin only)
    if (!segment4 && req.method === "DELETE") {
      if (!this.hasPermissionLevel(permissionLevel, ServerPermissionLevel.admin, req, res)) {
        return;
      }

      if (!world) {
        this.sendErrorRequest(404, `World ${worldId} not found`, req, res);
        return;
      }

      // TODO: Implement world deletion in WorldBackupManager
      this.sendErrorRequest(501, "World deletion not yet implemented", req, res);
      return;
    }

    // Require world to exist for backup operations
    if (segment4 === "backups") {
      // For synthetic world IDs (active servers not yet backed up), return empty backups
      if (!world && isSyntheticWorldId) {
        if (!timestamp && req.method === "GET") {
          res.writeHead(200, { ...corsHeaders, "Content-Type": "application/json" });
          res.end(JSON.stringify({ backups: [] }));
          return;
        }
        // For other backup operations on synthetic worlds, return error
        this.sendErrorRequest(
          400,
          `Cannot perform backup operations on active world without existing backups`,
          req,
          res
        );
        return;
      }

      if (!world) {
        this.sendErrorRequest(404, `World ${worldId} not found`, req, res);
        return;
      }

      await world.loadBackups();

      // GET /api/worlds/{id}/backups - List backups
      if (!timestamp && req.method === "GET") {
        const backups = world.backups.map((b) => ({
          timestamp: b.timestamp,
          type: b.type,
          description: b.description,
          fileCount: b.fileCount,
          totalBytes: b.totalBytes,
          createdAt: new Date(b.timestamp).toISOString(),
        }));

        res.writeHead(200, { ...corsHeaders, "Content-Type": "application/json" });
        res.end(JSON.stringify({ backups }));
        return;
      }

      // POST /api/worlds/{id}/backups - Create a backup
      if (!timestamp && req.method === "POST") {
        if (!this.hasPermissionLevel(permissionLevel, ServerPermissionLevel.updateState, req, res)) {
          return;
        }

        const body = await this.readRequestBodyJson(req, res, 4096);
        if (!body) return;

        const slot = typeof body.slot === "number" ? body.slot : 0;
        const description = body.description;

        // Get the server for this slot
        const server = this._serverManager.getActiveServer(slot);
        if (!server || !server.defaultWorldFolder) {
          this.sendErrorRequest(400, `No active server at slot ${slot} with world data`, req, res);
          return;
        }

        const result = await this._serverManager.createWorldBackup(worldId, server.defaultWorldFolder, {
          notes: description,
          backupType: WorldBackupType.manual,
        });

        res.writeHead(201, { ...corsHeaders, "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
        return;
      }

      // Timestamp-specific operations
      if (timestamp) {
        const timestampNum = parseInt(timestamp, 10);
        if (isNaN(timestampNum)) {
          this.sendErrorRequest(400, "Invalid timestamp format", req, res);
          return;
        }

        const backup = world.backups.find((b) => b.timestamp === timestampNum);

        // GET /api/worlds/{id}/backups/{timestamp} - Get backup info
        if (!action && req.method === "GET") {
          if (!backup) {
            this.sendErrorRequest(404, `Backup ${timestamp} not found`, req, res);
            return;
          }

          res.writeHead(200, { ...corsHeaders, "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              timestamp: backup.timestamp,
              type: backup.type,
              description: backup.description,
              fileCount: backup.fileCount,
              totalBytes: backup.totalBytes,
              createdAt: new Date(backup.timestamp).toISOString(),
            })
          );
          return;
        }

        // DELETE /api/worlds/{id}/backups/{timestamp} - Delete backup
        if (!action && req.method === "DELETE") {
          if (!this.hasPermissionLevel(permissionLevel, ServerPermissionLevel.updateState, req, res)) {
            return;
          }

          await this._serverManager.deleteWorldBackup(worldId, timestampNum);

          res.writeHead(200, { ...corsHeaders, "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true, deleted: timestampNum }));
          return;
        }

        // POST /api/worlds/{id}/backups/{timestamp}/restore - Restore to slot
        if (action === "restore" && req.method === "POST") {
          if (!this.hasPermissionLevel(permissionLevel, ServerPermissionLevel.updateState, req, res)) {
            return;
          }

          const body = await this.readRequestBodyJson(req, res, 4096);
          if (!body) return;

          const slot = typeof body.slot === "number" ? body.slot : 0;
          const server = this._serverManager.getActiveServer(slot);

          if (!server || !server.defaultWorldFolder) {
            this.sendErrorRequest(400, `No active server at slot ${slot} with world folder`, req, res);
            return;
          }

          await this._serverManager.restoreWorldBackup(worldId, timestampNum, server.defaultWorldFolder);

          res.writeHead(200, { ...corsHeaders, "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true, restoredTo: slot }));
          return;
        }

        // GET /api/worlds/{id}/backups/{timestamp}/export - Export as .mcworld
        if (action === "export" && req.method === "GET") {
          if (!backup) {
            this.sendErrorRequest(404, `Backup ${timestamp} not found`, req, res);
            return;
          }

          // Create a temp file path for the export
          const tempDir = require("os").tmpdir();
          const exportPath = require("path").join(
            tempDir,
            `${world.friendlyName.replace(/[^a-zA-Z0-9]/g, "_")}_${timestamp}.mcworld`
          );

          await this._serverManager.exportBackupAsMcWorld(worldId, timestampNum, exportPath);

          // Read the file and send it
          const fs = require("fs");
          const content = fs.readFileSync(exportPath);

          res.writeHead(200, {
            ...corsHeaders,
            "Content-Type": "application/octet-stream",
            "Content-Disposition": `attachment; filename="${world.friendlyName.replace(
              /[^a-zA-Z0-9]/g,
              "_"
            )}_${timestamp}.mcworld"`,
            "Content-Length": content.length,
          });
          res.end(content);

          // Clean up temp file
          fs.unlinkSync(exportPath);
          return;
        }
      }
    }

    this.sendErrorRequest(404, "Unknown worlds API endpoint", req, res);
  }

  /**
   * Read request body as JSON with size limit and error handling.
   */
  private async readRequestBodyJson(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    maxSize: number
  ): Promise<any | null> {
    return new Promise((resolve) => {
      let body = "";
      let size = 0;

      req.on("data", (chunk) => {
        size += chunk.length;
        if (size > maxSize) {
          this.sendErrorRequest(413, "Request body too large", req, res);
          req.destroy();
          resolve(null);
          return;
        }
        body += chunk;
      });

      req.on("end", () => {
        try {
          const parsed = JSON.parse(body);
          resolve(parsed);
        } catch (e) {
          this.sendErrorRequest(400, "Invalid JSON body", req, res);
          resolve(null);
        }
      });

      req.on("error", (e) => {
        this.sendErrorRequest(500, "Error reading request body", req, res);
        resolve(null);
      });
    });
  }

  /**
   * Handle /api/commands/* endpoints for invoking ToolCommands via REST API.
   *
   * Endpoints:
   * GET  /api/commands - List available commands
   * POST /api/commands/{commandName} - Execute a command
   *
   * Request body for POST (JSON):
   * {
   *   "args": ["arg1", "arg2"],
   *   "flags": { "session": "mySession", "traits": ["tameable"] }
   * }
   *
   * Response (JSON):
   * {
   *   "success": true/false,
   *   "message": "...",
   *   "data": { ... },
   *   "error": { "code": "...", "message": "..." }
   * }
   */
  private async handleCommandsRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    corsHeaders: { [key: string]: string },
    urlSegments: string[]
  ): Promise<void> {
    // Initialize ToolCommands if not already done
    initializeToolCommands();
    await registerNodeOnlyCommands();

    const registry = ToolCommandRegistry.instance;
    const commandName = urlSegments[3]; // e.g., "script" from /api/commands/script

    // GET /api/commands - List available commands
    if (!commandName && req.method === "GET") {
      const commands = registry.getAll(ToolCommandScope.serverApi);
      const commandList = commands.map((cmd) => ({
        name: cmd.metadata.name,
        description: cmd.metadata.description,
        category: cmd.metadata.category,
        aliases: cmd.metadata.aliases,
        arguments: cmd.metadata.arguments?.map((a) => ({
          name: a.name,
          description: a.description,
          type: a.type,
          required: a.required,
        })),
        flags: cmd.metadata.flags?.map((f) => ({
          name: f.name,
          shortName: f.shortName,
          description: f.description,
          type: f.type,
          required: f.required,
        })),
        examples: cmd.metadata.examples,
      }));

      res.writeHead(200, { ...corsHeaders, "Content-Type": "application/json" });
      res.end(JSON.stringify({ commands: commandList }));
      return;
    }

    // POST /api/commands/{commandName} - Execute a command
    if (commandName && req.method === "POST") {
      const command = registry.get(commandName);

      if (!command) {
        this.sendErrorRequest(404, `Command '${commandName}' not found`, req, res);
        return;
      }

      // Check if command is available in serverApi scope
      const scopes = command.metadata.scopes;
      if (scopes && !scopes.includes(ToolCommandScope.serverApi)) {
        this.sendErrorRequest(403, `Command '${commandName}' is not available via API`, req, res);
        return;
      }

      // Read request body
      let body = "";
      let bodySize = 0;
      const MAX_COMMAND_BODY_SIZE = 100 * 1024; // 100KB limit

      req.on("data", (chunk) => {
        bodySize += chunk.length;
        if (bodySize > MAX_COMMAND_BODY_SIZE) {
          this.sendErrorRequest(413, "Request body too large", req, res);
          req.destroy();
          return;
        }
        body += chunk;
      });

      req.on("end", async () => {
        try {
          let args: string[] = [];
          let flags: Record<string, string | boolean | string[]> = {};
          let sessionName: string | undefined;

          if (body) {
            const data = JSON.parse(body);
            args = data.args || [];
            flags = data.flags || {};
            sessionName = data.sessionName || flags.session;
          }

          // Create output collector
          const messages: string[] = [];
          const output: IToolCommandOutput = {
            info: (msg) => messages.push(msg),
            success: (msg) => messages.push(`✓ ${msg}`),
            warn: (msg) => messages.push(`⚠ ${msg}`),
            error: (msg) => messages.push(`✗ ${msg}`),
            debug: (msg) => messages.push(`  ${msg}`),
            progress: (current, total, msg) => {
              const pct = Math.round((current / total) * 100);
              messages.push(`[${pct}%] ${msg || ""}`);
            },
          };

          // Build context
          if (!this.creatorTools) {
            this.sendErrorRequest(500, "Server not properly configured", req, res);
            return;
          }

          // Note: In serverApi context, we don't have an IMinecraft wrapper for DedicatedServer.
          // Commands that need server access should use context.session.serverManager.getActiveServer()
          const context = ToolCommandContextFactory.createSessionContext(
            this.creatorTools,
            { sessionName: sessionName || "api", serverManager: this._serverManager, slot: 0 },
            undefined, // No IMinecraft adapter available in server API context
            output,
            "serverApi"
          );

          // Execute command
          const result = await command.execute(context, args, flags);

          // Build response
          const response = {
            success: result.success,
            message: result.message,
            data: result.data,
            error: result.error,
            output: messages,
          };

          res.writeHead(result.success ? 200 : 400, { ...corsHeaders, "Content-Type": "application/json" });
          res.end(JSON.stringify(response));
        } catch (e: unknown) {
          const message = e instanceof Error ? e.message : String(e);
          Log.error(`Error executing command ${commandName}: ${message}`);
          this.sendErrorRequest(500, `Error executing command: ${message}`, req, res);
        }
      });

      return;
    }

    // Unsupported method
    this.sendErrorRequest(405, "Method not allowed", req, res);
  }

  getMainContent(req: http.IncomingMessage) {
    let title = "Minecraft Creator Tools";

    if (this._localEnvironment.serverTitle) {
      // Security: Escape title to prevent XSS
      title = this.escapeForHtml(this._localEnvironment.serverTitle);
    }

    // Security: Escape JS strings to prevent XSS
    const serverTitleJs = this._localEnvironment.serverTitle
      ? `g_serverTitle = "${this.escapeForJs(this._localEnvironment.serverTitle)}";`
      : "";
    const serverMotdJs = this._localEnvironment.serverMessageOfTheDay
      ? `g_serverMotd = "${this.escapeForJs(this._localEnvironment.serverMessageOfTheDay)}";`
      : "";

    // Set up content URL and read-only mode if serving local content (view/edit mode)
    let contentUrlJs = "";
    let readOnlyJs = "";
    let initialModeJs = 'g_initialMode = "webserver";';

    if (this._contentPath) {
      contentUrlJs = `g_contentUrl = "/api/content/";`;
      // In edit mode, allow writes; in view mode, force read-only
      if (!this._isEditMode) {
        readOnlyJs = `g_readOnly = true;`;
      }
      initialModeJs = 'g_initialMode = "project";';
    }

    return `<!doctype html>
    <html lang="en">
    <head>
      <meta charset="utf-8"/>
      <meta name="viewport" content="width=device-width,initial-scale=1"/>
      <title>${title}</title>
      <link rel="stylesheet" href="/app/web.css">
      <script language='javascript'>
      g_contentRoot= "/";
      g_vanillaContentRoot = "https://mctools.dev/";
      ${initialModeJs}
      g_baseUrl = location.href;
      ${serverTitleJs}
      ${serverMotdJs}
      ${contentUrlJs}
      ${readOnlyJs}
      </script>
    <script defer="true" src="/app/web.js"></script>
    </head>
      <body>
        <div id="root"></div>
      </body>
    </html>`;
  }
}
