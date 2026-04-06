/**
 * ARCHITECTURE DOCUMENTATION: ServerManager - Dedicated Server Orchestration
 * ===========================================================================
 *
 * ServerManager is the central orchestrator for Minecraft Bedrock Dedicated Server
 * instances. It handles downloading, provisioning, and managing the lifecycle of
 * one or more DedicatedServer instances.
 *
 * ## Core Responsibilities
 *
 * 1. **Server Version Management**: Download and track Bedrock Dedicated Server versions
 * 2. **Server Provisioning**: Create runtime server instances from source downloads
 * 3. **Multi-Slot Support**: Manage multiple concurrent server instances on different ports
 * 4. **Pack Cache Management**: Extract and cache add-on packages for deployment
 * 5. **HTTP Server Integration**: Host web API and WebSocket notifications via HttpServer
 * 6. **Event Aggregation**: Bubble up events from individual DedicatedServer instances
 *
 * ## Server Download & Source Architecture
 *
 * The architecture separates "source" servers from "runtime" servers:
 *
 * ```
 * minecraft.net                 Source Servers                  Runtime Servers
 *      │                            │                                │
 *      │ downloadLatestSourceServer │                                │
 *      ├───────────────────────────►│ bwv1.21.50.24/                 │
 *      │                            │   ├─ bedrock_server.exe        │
 *      │                            │   ├─ behavior_packs/           │ prepareTempServerNameAndPath
 *      │                            │   ├─ resource_packs/           ├──────────────────────────►
 *      │                            │   ├─ definitions/              │ srv20260101120000/
 *      │                            │   └─ ...                       │   ├─ bedrock_server.exe (copy)
 *      │                            │                                │   ├─ behavior_packs/ (symlink)
 *      │                            │                                │   ├─ resource_packs/ (symlink)
 *      │                            │                                │   ├─ development_behavior_packs/
 *      │                            │                                │   ├─ development_resource_packs/
 *      │                            │                                │   └─ worlds/defaultWorld/
 * ```
 *
 * **Source Servers** (stored in `%LOCALAPPDATA%/mctools_server/serverSources/`):
 * - Downloaded once per version from minecraft.net
 * - Named with format: `<type>v<version>/` (e.g., `bwv1.21.50.24/` for Bedrock Windows)
 * - Type prefixes: `bw` (Bedrock Windows), `bl` (Bedrock Linux), `pw`/`pl` (Preview)
 * - Contains the original, unmodified server files
 *
 * **Runtime Servers** (stored in `%LOCALAPPDATA%/mctools_server/servers/`):
 * - Created per-session with timestamp names: `srv<YYYYMMDDHHMMSS>/`
 * - Use symbolic links (junctions on Windows) to share static content with source
 * - Have their own writable folders for worlds, config, and development packs
 *
 * ## Symbolic Link Strategy
 *
 * To minimize disk usage and allow quick server provisioning, runtime servers use
 * symbolic links to reference static content from source servers:
 *
 * | Folder/File              | Strategy     | Reason                                  |
 * |--------------------------|--------------|------------------------------------------|
 * | bedrock_server[.exe]     | File COPY    | Symlinks don't work reliably for files  |
 * | behavior_packs/          | Symlink      | Read-only vanilla content               |
 * | resource_packs/          | Symlink      | Read-only vanilla content               |
 * | definitions/             | Symlink      | Read-only vanilla definitions           |
 * | structures/              | Symlink      | Read-only vanilla structures            |
 * | world_templates/         | Symlink      | Read-only vanilla world templates       |
 * | development_behavior_packs/ | Real folder | Writable, for deployed add-ons        |
 * | development_resource_packs/ | Real folder | Writable, for deployed add-ons        |
 * | worlds/                  | Real folder  | Writable, for world data               |
 * | config/                  | Real folder  | Writable, for server config            |
 *
 * **Platform-specific symlink handling:**
 * - Windows: Uses "junction" symlinks (work without admin/developer mode)
 * - Linux/macOS: Uses "dir" symlinks (work without elevated privileges)
 * - Fallback: If symlink creation fails, directories are copied instead
 *
 * ## Smart Reprovisioning & Backup Discipline
 *
 * To optimize stop/start cycles and protect world data, the system implements:
 *
 * **Smart Reprovisioning Detection** (`needsReprovisioning()`):
 * - Tracks provisioning info per slot: source path, version, timestamp
 * - On start, compares requested source with last-provisioned source
 * - If same source and folder exists: SKIP file operations (fast restart)
 * - If different source: REPROVISION with backup first
 *
 * **Backup Before Destructive Operations** (`backupSlotWorldData()`):
 * Before replacing/reprovisioning a slot's server files:
 * 1. Locate the default world folder (e.g., `slot0/worlds/defaultWorld/`)
 * 2. Create timestamped backup: `worldBackups/slot0/backup_YYYYMMDD_HHMMSS/`
 * 3. Copy world data to backup folder
 * 4. Only then proceed with destructive file operations
 *
 * **Slot Update Helpers**:
 * - `updateDedicatedServerSymLinkFolder()`: Removes old symlink/dir, creates fresh symlink
 * - `updateDedicatedServerFile()`: Overwrites file in place (critical for firewall rules)
 *
 * This discipline ensures:
 * - No world data is ever lost during version updates
 * - Users can recover from failed updates via backups
 * - Stop/start cycles are fast (no unnecessary file operations)
 * - Source server version changes are handled gracefully
 *
 * ## Linux Compatibility
 *
 * The server management system supports both Windows and Linux:
 *
 * | Feature                  | Windows                  | Linux                       |
 * |--------------------------|--------------------------|------------------------------|
 * | Executable name          | bedrock_server.exe       | bedrock_server              |
 * | Symlink type             | junction                 | dir                         |
 * | Library path             | (not needed)             | LD_LIBRARY_PATH set         |
 * | Executable permissions   | (not needed)             | chmod +x applied            |
 * | Signature verification   | Authenticode check       | Skipped (not supported)     |
 *
 * ## Pack Cache System
 *
 * Add-on packages (.mcaddon, .mcpack) are extracted to a cache folder to avoid
 * repeated extraction. The cache uses content hashes to identify unique versions:
 *
 * ```
 * %LOCALAPPDATA%/mctools_pack_cache/
 *   └─ my_addon_<hash>/
 *       ├─ behavior_pack/
 *       └─ resource_pack/
 * ```
 *
 * During server provisioning, pack cache folders are referenced via symbolic links
 * in the runtime server's development_*_packs folders.
 *
 * ## Multi-Slot Architecture
 *
 * ServerManager supports running multiple server instances simultaneously using
 * a slot-based port allocation scheme:
 *
 * | Slot | Base Port | Use Case                                    |
 * |------|-----------|---------------------------------------------|
 * | 0    | 19132     | Default Minecraft port                      |
 * | 1    | 19164     | Second server instance                      |
 * | 2    | 19196     | Third server instance                       |
 * | ...  | +32/slot  | Additional instances (up to slot 79)        |
 *
 * Each slot has its own DedicatedServer instance, world backup folder, and
 * independent lifecycle.
 *
 * ### Slot Prefix for Context Isolation
 *
 * To prevent different commands/contexts from interfering with each other's
 * server instances, ServerManager supports a `slotPrefix` property. This prefix
 * is prepended to slot folder names:
 *
 * | Context        | Prefix   | Folder Names                           |
 * |----------------|----------|----------------------------------------|
 * | MCP command    | "mcp"    | mcp0/, mcp1/, ...                      |
 * | Serve command  | "serve"  | serve0/, serve1/, ...                  |
 * | VS Code ext    | "vscode" | vscode0/, vscode1/, ...                |
 * | Default        | ""       | slot0/, slot1/, ... (backward compat)  |
 *
 * This ensures that running `mct mcp` doesn't reuse or interfere with servers
 * from `mct serve` or the VS Code extension, and vice versa.
 *
 * ## Version Detection
 *
 * Server versions are retrieved from two sources:
 * 1. Primary: minecraft.net version service API
 * 2. Fallback: Mojang bedrock-samples GitHub repository version.json
 *
 * Both retail and preview tracks are supported, with version info including:
 * - Version string (e.g., "1.21.50.24")
 * - Version index for comparison (derived from version components)
 * - Download URL prefix for each platform
 *
 * ## Related Files
 *
 * - DedicatedServer.ts: Individual server instance management
 * - HttpServer.ts: Web API and WebSocket server for remote management
 * - LocalEnvironment.ts: Environment configuration (paths, EULA acceptance)
 * - LocalUtilities.ts: Platform-specific path utilities
 * - ServerConfigManager.ts: Manages server config JSON files
 * - ServerPropertiesManager.ts: Manages server.properties file
 * - Package.ts: Represents cached add-on packages
 *
 * ## Key Methods
 *
 * - `downloadLatestSourceServer()`: Download Bedrock server from minecraft.net
 * - `prepareSlotServerPath()`: Create/update slot-based runtime server (smart reprovisioning)
 * - `needsReprovisioning()`: Check if a slot needs file operations
 * - `backupSlotWorldData()`: Backup world data before destructive operations
 * - `ensureActiveServer()`: Get or create a DedicatedServer for a slot
 * - `deployPackCache()`: Extract add-on packages to cache folder
 * - `preparePacksAndTemplates()`: Set up pack references for a world
 * - `updateDedicatedServerSymLinkFolder()`: Update symlink for a slot folder
 * - `updateDedicatedServerFile()`: Update a file in a slot folder (overwrite in place)
 *
 * ## Event Flow
 *
 * ServerManager aggregates events from all DedicatedServer instances and forwards
 * them to listeners and the HttpServer for WebSocket broadcast:
 *
 * ```
 * DedicatedServer ──► ServerManager ──► HttpServer ──► WebSocket Clients
 *       │                  │                │
 *       │ onServerStarted  │ bubbleServerStarted
 *       │ onPlayerConnected│ bubblePlayerConnected ──► notifyPlayerJoined
 *       │ onServerOutput   │ pushStatusNotification ──► notifyStatusUpdate
 * ```
 */
import { EventDispatcher } from "ste-events";
import Player from "../minecraft/Player";
import LocalUtilities from "./LocalUtilities";
import * as fs from "fs";
import * as os from "os";
import NodeStorage from "./NodeStorage";
import LocalEnvironment from "./LocalEnvironment";
import axios, { AxiosProgressEvent } from "axios";
import ZipStorage from "../storage/ZipStorage";
import IMainInfoVersions from "../minecraft/IMainInfoVersions";
import StorageUtilities from "../storage/StorageUtilities";
import Log from "../core/Log";
import DedicatedServer, { DedicatedServerStatus } from "./DedicatedServer";
import { IStatData, IDebugSessionInfo, IProfilerCaptureEvent } from "../debugger/IMinecraftDebugProtocol";
import Utilities from "../core/Utilities";
import ContentLogWatcher from "./ContentLogWatcher";
import CreatorTools from "../app/CreatorTools";
import HttpServer from "./HttpServer";
import { DedicatedServerMode, MinecraftTrack } from "../app/ICreatorToolsData";
import { IMinecraftStartMessage } from "../app/IMinecraftStartMessage";
import { FileListings } from "./NodeFolder";
import IFolder from "../storage/IFolder";
import { IPackageReference, IWorldSettings } from "../minecraft/IWorldSettings";
import Package from "../app/Package";
import Database from "../minecraft/Database";
import ServerMessage, { ServerMessageCategory } from "./ServerMessage";
import MinecraftUtilities from "../minecraft/MinecraftUtilities";
import { IMinecraftNetVersionService } from "./MinecraftNetVersionService";
import { constants } from "../core/Constants";
import { Platform } from "../core/ILocalUtilities";
import WorldBackupManager from "./WorldBackupManager";
import { IBackupOptions, IBackupResult } from "./IWorldBackupData";
import ManagedWorld from "./ManagedWorld";
import WorldBackup from "./WorldBackup";

export const ServerVersionVariants = 5;

export enum ServerManagerFeatures {
  all = 0,
  allWebServices = 1,
  basicWebServices = 2,
  dedicatedServerOnly = 3,
}

export enum ServerType {
  bedrockWindows = 0,
  bedrockLinux = 1,
  bedrockWindowsPreview = 2,
  bedrockLinuxPreview = 3,
  java = 4,
}

export interface IServerVersion {
  serverType?: ServerType;
  version?: string;
  versionIndex?: number;
  downloadedPath?: string;
  downloadedIndex?: number;
  downloadPrefix?: string;
}

/**
 * Tracks the provisioning state of a slot folder.
 * Used to avoid unnecessary reprovisioning on stop/start cycles.
 *
 * This is persisted to disk as `slot_context.json` in each slot folder
 * (the "sentinel file") so that context survives server restarts.
 */
export interface ISlotProvisioningInfo {
  /** The source server path used to provision this slot */
  sourceServerPath: string;
  /** When the slot was last provisioned (ISO string when serialized) */
  provisionedAt: Date | string;
  /** The server version string (e.g., "1.21.50.24") */
  version?: string;
  /** UUIDs of deployed behavior packs */
  deployedBehaviorPackIds?: string[];
  /** UUIDs of deployed resource packs */
  deployedResourcePackIds?: string[];
  /** Whether beta APIs experiment is enabled */
  betaApisEnabled?: boolean;
  /**
   * When true, the world is transient - not backed up and reset on each deployment.
   * Useful for development scenarios where you always want a fresh world.
   */
  transientWorld?: boolean;
}

/**
 * Options for slot provisioning.
 */
export interface ISlotProvisioningOptions {
  /** Force reprovisioning even if source hasn't changed */
  forceReprovision?: boolean;
  /**
   * When true, the world is transient - not backed up and cleared on each deployment.
   * Useful for development scenarios where you always want a fresh world.
   */
  transientWorld?: boolean;
}

/** Filename for the slot sentinel/context file */
const SLOT_CONTEXT_FILENAME = "slot_context.json";

export default class ServerManager {
  #servers: { [name: string]: DedicatedServer } = {};
  #activeServersByPort: { [port: number]: DedicatedServer } = {};

  #quiescentServersByPort: { [port: number]: DedicatedServer } = {};
  #activeDirectServer: DedicatedServer | undefined;
  #contentLogWatcher: ContentLogWatcher | undefined;

  #usePreview: boolean | undefined;
  #httpServer: HttpServer | undefined;

  #creatorTools: CreatorTools;

  #utilities: LocalUtilities;
  #env: LocalEnvironment;

  dataStorage: NodeStorage;

  runOnce: boolean | undefined;

  maxServerIndex: number = 0;

  #features: ServerManagerFeatures = ServerManagerFeatures.all;
  #isPrepared: boolean = false;

  primaryServerPort = 19132;

  backupWorldFileListings: FileListings = {};

  /**
   * Central backup manager for all world backups.
   * Handles world identity, backup creation, restoration, and deduplication.
   */
  #worldBackupManager: WorldBackupManager | undefined;

  /**
   * Get the world backup manager.
   */
  get worldBackupManager(): WorldBackupManager | undefined {
    return this.#worldBackupManager;
  }

  /**
   * Tracks provisioning state per slot.
   * Key is the slot number (0-79), value is the provisioning info.
   * Used to avoid unnecessary reprovisioning when source hasn't changed.
   */
  #slotProvisioningInfo: { [slot: number]: ISlotProvisioningInfo } = {};

  /**
   * Prefix for slot folder names to avoid conflicts between different contexts.
   * Different commands/contexts use different prefixes to keep their server instances separate:
   * - MCP command uses "mcp" prefix → "mcp0", "mcp1", etc.
   * - Serve command uses "serve" prefix → "serve0", "serve1", etc.
   * - VS Code extension uses "vscode" prefix → "vscode0", "vscode1", etc.
   * - Default (empty string) uses no prefix → "slot0", "slot1", etc.
   */
  #slotPrefix: string = "";

  serverVersions: IServerVersion[] = [
    {
      downloadPrefix: "https://www.minecraft.net/bedrockdedicatedserver/bin-win/bedrock-server-",
    },
    {
      downloadPrefix: "https://www.minecraft.net/bedrockdedicatedserver/bin-linux/bedrock-server-",
    },
    {
      downloadPrefix: "https://www.minecraft.net/bedrockdedicatedserver/bin-win-preview/bedrock-server-",
    },
    {
      downloadPrefix: "https://www.minecraft.net/bedrockdedicatedserver/bin-linux-preview/bedrock-server-",
    },
    {},
  ];

  #onServerOutput = new EventDispatcher<DedicatedServer, ServerMessage>();
  #onServerError = new EventDispatcher<DedicatedServer, string>();
  #onServerStarted = new EventDispatcher<DedicatedServer, string>();
  #onServerRefreshed = new EventDispatcher<DedicatedServer, string>();
  #onServerStarting = new EventDispatcher<DedicatedServer, string>();
  #onServerStopped = new EventDispatcher<DedicatedServer, string>();
  #onServerStopping = new EventDispatcher<DedicatedServer, string>();

  #onShutdown = new EventDispatcher<ServerManager, string>();

  #onPlayerConnected = new EventDispatcher<DedicatedServer, Player>();
  #onPlayerDisconnected = new EventDispatcher<DedicatedServer, Player>();

  #onTestStarted = new EventDispatcher<DedicatedServer, string>();
  #onTestFailed = new EventDispatcher<DedicatedServer, string>();
  #onTestSucceeded = new EventDispatcher<DedicatedServer, string>();

  // Debug events from the script debugger
  #onDebugConnected = new EventDispatcher<DedicatedServer, IDebugSessionInfo>();
  #onDebugDisconnected = new EventDispatcher<DedicatedServer, string>();
  #onDebugStats = new EventDispatcher<DedicatedServer, { tick: number; stats: IStatData[] }>();
  #onDebugPaused = new EventDispatcher<DedicatedServer, string>();
  #onDebugResumed = new EventDispatcher<DedicatedServer, void>();
  #onProfilerCapture = new EventDispatcher<DedicatedServer, IProfilerCaptureEvent>();

  public get isAnyServerRunning() {
    for (const serverName in this.#servers) {
      const server = this.#servers[serverName];

      if (server.status === DedicatedServerStatus.started) {
        return true;
      }
    }

    return false;
  }

  public get creatorTools() {
    return this.#creatorTools;
  }

  public get effectiveAutoSourceServerPath() {
    if (this.#utilities.platform === Platform.linux) {
      if (this.effectiveIsUsingPreview) {
        return this.serverVersions[ServerType.bedrockLinuxPreview].downloadedPath;
      }

      return this.serverVersions[ServerType.bedrockLinux].downloadedPath;
    }

    if (this.effectiveIsUsingPreview) {
      return this.serverVersions[ServerType.bedrockWindowsPreview].downloadedPath;
    }

    return this.serverVersions[ServerType.bedrockWindows].downloadedPath;
  }

  public get activeDirectServer() {
    return this.#activeDirectServer;
  }

  public get primaryActiveServer() {
    if (this.#activeDirectServer) {
      return this.#activeDirectServer;
    }

    return this.#activeServersByPort[this.primaryServerPort];
  }

  /**
   * Get all active servers as an array.
   */
  public get activeServers(): DedicatedServer[] {
    return Object.values(this.#activeServersByPort);
  }

  public get features() {
    return this.#features;
  }

  public set features(featuresIn: ServerManagerFeatures) {
    this.#features = featuresIn;
  }

  public get onServerOutput() {
    return this.#onServerOutput.asEvent();
  }

  public get onServerError() {
    return this.#onServerError.asEvent();
  }

  public get onServerStarted() {
    return this.#onServerStarted.asEvent();
  }

  public get onServerRefreshed() {
    return this.#onServerRefreshed.asEvent();
  }

  public get onServerStarting() {
    return this.#onServerStarting.asEvent();
  }

  public get onServerStopped() {
    return this.#onServerStopped.asEvent();
  }

  public get onServerStopping() {
    return this.#onServerStopping.asEvent();
  }

  public get onTestStarted() {
    return this.#onTestStarted.asEvent();
  }

  public get onShutdown() {
    return this.#onShutdown.asEvent();
  }

  public get onTestFailed() {
    return this.#onTestFailed.asEvent();
  }

  public get onTestSucceeded() {
    return this.#onTestSucceeded.asEvent();
  }

  public get onDebugConnected() {
    return this.#onDebugConnected.asEvent();
  }

  public get onDebugDisconnected() {
    return this.#onDebugDisconnected.asEvent();
  }

  public get onDebugStats() {
    return this.#onDebugStats.asEvent();
  }

  public get onDebugPaused() {
    return this.#onDebugPaused.asEvent();
  }

  public get onDebugResumed() {
    return this.#onDebugResumed.asEvent();
  }

  public get onProfilerCapture() {
    return this.#onProfilerCapture.asEvent();
  }

  public get onPlayerConnected() {
    return this.#onPlayerConnected.asEvent();
  }

  public get onPlayerDisconnected() {
    return this.#onPlayerDisconnected.asEvent();
  }

  get usePreview() {
    return this.#usePreview;
  }

  set usePreview(newUsePreview: boolean | undefined) {
    this.#usePreview = newUsePreview;
  }

  /**
   * Get the slot prefix used for folder naming.
   * This allows different contexts (MCP, serve, VS Code) to have isolated server slots.
   */
  get slotPrefix(): string {
    return this.#slotPrefix;
  }

  /**
   * Set the slot prefix for folder naming.
   * Different contexts should use different prefixes:
   * - "mcp" for MCP command → "mcp0", "mcp1", etc.
   * - "serve" for serve command → "serve0", "serve1", etc.
   * - "vscode" for VS Code extension → "vscode0", "vscode1", etc.
   * - "" (empty) for default/backward compatibility → "slot0", "slot1", etc.
   */
  set slotPrefix(prefix: string) {
    this.#slotPrefix = prefix;
  }

  /**
   * Gets the folder name for a given slot number, including the context prefix.
   * Examples:
   * - slotPrefix="" → "slot0", "slot1", etc.
   * - slotPrefix="mcp" → "mcp0", "mcp1", etc.
   * - slotPrefix="serve" → "serve0", "serve1", etc.
   * - slotPrefix="vscode" → "vscode0", "vscode1", etc.
   */
  getSlotFolderName(slotNumber: number): string {
    if (this.#slotPrefix) {
      return `${this.#slotPrefix}${slotNumber}`;
    }
    return `slot${slotNumber}`;
  }

  constructor(env: LocalEnvironment, creatorTools: CreatorTools) {
    this.#utilities = env.utilities;
    this.#env = env;
    this.#creatorTools = creatorTools;

    this.dataStorage = new NodeStorage(this.getRootPath() + "data/", "");
    this.bubbleServerOutput = this.bubbleServerOutput.bind(this);
    this.bubblePlayerConnected = this.bubblePlayerConnected.bind(this);
    this.bubblePlayerDisconnected = this.bubblePlayerDisconnected.bind(this);
    this.bubbleServerError = this.bubbleServerError.bind(this);
    this.bubbleServerStarted = this.bubbleServerStarted.bind(this);
    this.bubbleServerStopped = this.bubbleServerStopped.bind(this);
    this.bubbleServerStarting = this.bubbleServerStarting.bind(this);
    this.bubbleServerStopping = this.bubbleServerStopping.bind(this);
    this.bubbleTestFailed = this.bubbleTestFailed.bind(this);
    this.bubbleTestStarted = this.bubbleTestStarted.bind(this);
    this.bubbleTestFailed = this.bubbleTestFailed.bind(this);
    this.bubbleServerRefreshed = this.bubbleServerRefreshed.bind(this);
    this.bubbleServerGameEvent = this.bubbleServerGameEvent.bind(this);
    this.bubbleDebugConnected = this.bubbleDebugConnected.bind(this);
    this.bubbleDebugDisconnected = this.bubbleDebugDisconnected.bind(this);
    this.bubbleDebugStats = this.bubbleDebugStats.bind(this);

    // Register process signal handlers for graceful shutdown
    // This ensures child server processes are stopped when the parent is terminated
    this.registerProcessSignalHandlers();
  }

  /**
   * Register signal handlers to gracefully shutdown all servers when the process is terminated.
   * This prevents orphaned bedrock_server processes that could hold ports.
   */
  private registerProcessSignalHandlers() {
    const gracefulShutdown = async (signal: string) => {
      Log.message(`Received ${signal} signal - initiating graceful shutdown...`);
      try {
        await this.shutdown(`Process terminated by ${signal}`);
        Log.message("Graceful shutdown complete.");
        process.exit(0);
      } catch (e: any) {
        Log.error(`Error during graceful shutdown: ${e.message}`);
        process.exit(1);
      }
    };

    // Handle common termination signals
    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));

    // On Windows, handle the CTRL+BREAK and window close events
    if (os.platform() === "win32") {
      process.on("SIGBREAK", () => gracefulShutdown("SIGBREAK"));
    }

    // Handle uncaught exceptions - try to clean up before crashing
    process.on("uncaughtException", async (error) => {
      Log.error(`Uncaught exception: ${error.message}`);
      Log.error(error.stack || "No stack trace available");
      try {
        await this.stopAllDedicatedServers();
      } catch (e) {
        // Ignore cleanup errors during crash
      }
      process.exit(1);
    });
  }

  public async stopWebServer(reason?: string) {
    if (this.#httpServer) {
      await this.#httpServer.stop(reason);
    }
  }

  public async shutdown(message: string) {
    await this.stopWebServer(message);

    await this.stopAllDedicatedServers();

    if (this.#onShutdown) {
      this.#onShutdown.dispatch(this, message);
    }
  }

  public ensureHttpServer(port?: number) {
    if (!this.#httpServer) {
      this.#httpServer = new HttpServer(this.#env, this);

      if (port) {
        this.#httpServer.port = port;
      }

      // Pass experimental SSL config if available (not persisted - command line only)
      if (this.#env.sslConfig) {
        this.#httpServer.sslConfig = this.#env.sslConfig;
      }

      this.#httpServer.creatorTools = this.#creatorTools;
      this.#httpServer.init();
    }

    return this.#httpServer;
  }

  public get environment() {
    return this.#env;
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

  ensureDedicatedServerForPath(name: string, serverPath: string) {
    let server = this.#servers[name];

    if (server) {
      return server;
    }

    server = new DedicatedServer(
      name,
      this,
      this.#env,
      serverPath,
      this.#env.worldContainerStorage.rootFolder.ensureFolder("world")
    );

    server.onPlayerConnected.subscribe(this.bubblePlayerConnected);
    server.onPlayerDisconnected.subscribe(this.bubblePlayerDisconnected);

    server.onServerError.subscribe(this.bubbleServerError);
    server.onServerOutput.subscribe(this.bubbleServerOutput);
    server.onServerStarted.subscribe(this.bubbleServerStarted);
    server.onServerRefreshed.subscribe(this.bubbleServerRefreshed);
    server.onServerStarting.subscribe(this.bubbleServerStarting);
    server.onServerStopped.subscribe(this.bubbleServerStopped);
    server.onServerStopping.subscribe(this.bubbleServerStopping);

    server.onTestFailed.subscribe(this.bubbleTestFailed);
    server.onTestStarted.subscribe(this.bubbleTestStarted);
    server.onTestSucceeded.subscribe(this.bubbleTestSucceeded);
    server.onServerGameEvent.subscribe(this.bubbleServerGameEvent);

    // Subscribe to debug events
    server.onDebugConnected.subscribe(this.bubbleDebugConnected);
    server.onDebugDisconnected.subscribe(this.bubbleDebugDisconnected);
    server.onDebugStats.subscribe(this.bubbleDebugStats);
    server.onDebugPaused.subscribe(this.bubbleDebugPaused);
    server.onDebugResumed.subscribe(this.bubbleDebugResumed);
    server.onProfilerCapture.subscribe(this.bubbleProfilerCapture);

    this.#servers[name] = server;

    return server;
  }

  public async stopAllDedicatedServers() {
    for (const serverName in this.#servers) {
      const server = this.#servers[serverName];

      if (
        server.status === DedicatedServerStatus.started ||
        server.status === DedicatedServerStatus.launching ||
        server.status === DedicatedServerStatus.starting
      ) {
        await server.stopServer();
      }
    }

    return false;
  }

  private bubblePlayerConnected(dedicatedServer: DedicatedServer, player: Player) {
    this.#onPlayerConnected.dispatch(dedicatedServer, player);

    // Push WebSocket notification
    if (this.#httpServer) {
      const slot = this.getSlotForServer(dedicatedServer);
      this.#httpServer.notify({
        eventName: "playerJoined",
        timestamp: Date.now(),
        slot: slot,
        playerName: player.id ?? "unknown",
        xuid: player.xuid,
      });
    }
  }

  private bubblePlayerDisconnected(dedicatedServer: DedicatedServer, player: Player) {
    this.#onPlayerDisconnected.dispatch(dedicatedServer, player);

    // Push WebSocket notification
    if (this.#httpServer) {
      const slot = this.getSlotForServer(dedicatedServer);
      this.#httpServer.notify({
        eventName: "playerLeft",
        timestamp: Date.now(),
        slot: slot,
        playerName: player.id ?? "unknown",
        xuid: player.xuid,
      });
    }
  }

  /**
   * Handle game events from the dedicated server (e.g., PlayerTravelled, BlockBroken, etc.)
   * and relay them to WebSocket clients.
   */
  private bubbleServerGameEvent(dedicatedServer: DedicatedServer, event: object) {
    if (!this.#httpServer) {
      Log.verbose("bubbleServerGameEvent: No httpServer available");
      return;
    }

    const slot = this.getSlotForServer(dedicatedServer);
    const eventWithHeader = event as {
      header?: { eventName?: string };
      body?: { player?: { position?: { x: number; y: number; z: number }; name?: string }; dimension?: number };
    };

    Log.verbose("bubbleServerGameEvent received: " + eventWithHeader.header?.eventName);

    // Check if this is a PlayerTravelled event and send a more specific notification
    if (eventWithHeader.header?.eventName === "PlayerTravelled" && eventWithHeader.body?.player) {
      const player = eventWithHeader.body.player;
      if (player.position) {
        Log.message("Sending playerMoved notification for " + player.name + " to slot " + slot);
        this.#httpServer.notifyPlayerMoved(
          slot,
          player.name ?? "unknown",
          player.position,
          undefined,
          eventWithHeader.body.dimension !== undefined ? `dimension_${eventWithHeader.body.dimension}` : undefined
        );
      }
    }

    // Also send the full game event for clients that want detailed event data
    if (eventWithHeader.header?.eventName) {
      this.#httpServer.notifyGameEvent(slot, eventWithHeader.header.eventName, event);
    }
  }

  private bubbleServerError(dedicatedServer: DedicatedServer, message: string) {
    this.#onServerError.dispatch(dedicatedServer, message);
    this.pushStatusNotification(dedicatedServer);
  }

  private bubbleServerOutput(dedicatedServer: DedicatedServer, message: ServerMessage) {
    // Don't forward internal system messages (e.g., querytarget polling output) to the web UI
    if (message.category === ServerMessageCategory.internalSystemMessage) {
      return;
    }

    this.#onServerOutput.dispatch(dedicatedServer, message);
    // Push status update for new messages
    this.pushStatusNotification(dedicatedServer);
  }

  private bubbleServerStarted(dedicatedServer: DedicatedServer, message: string) {
    this.#onServerStarted.dispatch(dedicatedServer, message);
    this.pushStatusNotification(dedicatedServer);

    // Start watching the server's storage folders for real-time file updates
    this.startWatchingServerStorage(dedicatedServer);
  }

  /**
   * Start watching the server's storage folders (world, behavior_packs, resource_packs)
   * for file changes and broadcast notifications to WebSocket clients.
   */
  private async startWatchingServerStorage(dedicatedServer: DedicatedServer) {
    if (!this.#httpServer) {
      return;
    }

    // Get the slot number for this server
    const slot = this.getSlotForServer(dedicatedServer);

    // Ensure server folders are initialized
    await dedicatedServer.ensureServerFolders();

    // Start watching world storage
    const worldStorage = dedicatedServer.defaultWorldStorage;
    if (worldStorage) {
      this.#httpServer.startWatchingStorage(worldStorage, slot, "world");
      Log.message(
        `[ServerManager] Started watching world storage for slot ${slot}: ${worldStorage.rootFolder.fullPath}`
      );
    } else {
      Log.debug(`[ServerManager] No world storage available for slot ${slot}`);
    }

    // Start watching behavior packs storage
    const behaviorPacksStorage = dedicatedServer.behaviorPacksStorage;
    if (behaviorPacksStorage) {
      this.#httpServer.startWatchingStorage(behaviorPacksStorage, slot, "behavior_packs");
      Log.message(`[ServerManager] Started watching behavior_packs storage for slot ${slot}`);
    }

    // Start watching resource packs storage
    const resourcePacksStorage = dedicatedServer.resourcePacksStorage;
    if (resourcePacksStorage) {
      this.#httpServer.startWatchingStorage(resourcePacksStorage, slot, "resource_packs");
      Log.message(`[ServerManager] Started watching resource_packs storage for slot ${slot}`);
    }

    Log.message(`[ServerManager] Completed storage watching setup for slot ${slot}`);
  }

  /**
   * Stop watching the server's storage folders when the server stops.
   */
  private stopWatchingServerStorage(dedicatedServer: DedicatedServer) {
    if (!this.#httpServer) {
      return;
    }

    const worldStorage = dedicatedServer.defaultWorldStorage;
    if (worldStorage) {
      this.#httpServer.stopWatchingStorage(worldStorage);
    }

    const behaviorPacksStorage = dedicatedServer.behaviorPacksStorage;
    if (behaviorPacksStorage) {
      this.#httpServer.stopWatchingStorage(behaviorPacksStorage);
    }

    const resourcePacksStorage = dedicatedServer.resourcePacksStorage;
    if (resourcePacksStorage) {
      this.#httpServer.stopWatchingStorage(resourcePacksStorage);
    }
  }

  private bubbleServerRefreshed(dedicatedServer: DedicatedServer, message: string) {
    this.#onServerRefreshed.dispatch(dedicatedServer, message);
    this.pushStatusNotification(dedicatedServer);
  }

  private bubbleServerStarting(dedicatedServer: DedicatedServer, message: string) {
    this.#onServerStarting.dispatch(dedicatedServer, message);
    this.pushStatusNotification(dedicatedServer);
  }

  private bubbleServerStopping(dedicatedServer: DedicatedServer, message: string) {
    this.#onServerStopping.dispatch(dedicatedServer, message);
    this.pushStatusNotification(dedicatedServer);
  }

  private bubbleServerStopped(dedicatedServer: DedicatedServer, message: string) {
    // Stop watching storage when the server stops
    this.stopWatchingServerStorage(dedicatedServer);

    this.#onServerStopped.dispatch(dedicatedServer, message);
    this.pushStatusNotification(dedicatedServer);
  }

  /**
   * Get the slot number for a given DedicatedServer.
   * Returns 0 if the server is not found in active servers.
   */
  private getSlotForServer(dedicatedServer: DedicatedServer): number {
    for (const portStr in this.#activeServersByPort) {
      const port = parseInt(portStr);
      if (this.#activeServersByPort[port] === dedicatedServer) {
        return MinecraftUtilities.getSlotFromPort(port);
      }
    }
    return 0; // Default to slot 0
  }

  /**
   * Push a status update notification via WebSocket.
   * This replaces the need for clients to poll /api/{slot}/status/
   */
  private pushStatusNotification(dedicatedServer: DedicatedServer) {
    if (!this.#httpServer) {
      return;
    }

    const slot = this.getSlotForServer(dedicatedServer);
    const recentMessages: Array<{ message: string; received: number; type?: number }> = [];

    // Get recent messages, excluding internal system messages (e.g., querytarget polling)
    let lastIndex = dedicatedServer.outputLines.length;
    while (lastIndex >= 1 && recentMessages.length < 10) {
      lastIndex--;
      const line = dedicatedServer.outputLines[lastIndex];
      if (!line.isInternal) {
        recentMessages.push({
          message: line.message,
          received: line.received,
        });
      }
    }

    this.#httpServer.notifyStatusUpdate(slot, dedicatedServer.status, recentMessages);
  }

  private bubbleTestFailed(dedicatedServer: DedicatedServer, message: string) {
    this.#onTestFailed.dispatch(dedicatedServer, message);
  }

  private bubbleTestStarted(dedicatedServer: DedicatedServer, message: string) {
    this.#onTestStarted.dispatch(dedicatedServer, message);
  }

  private bubbleTestSucceeded(dedicatedServer: DedicatedServer, message: string) {
    this.#onTestSucceeded.dispatch(dedicatedServer, message);
  }

  private bubbleDebugConnected(dedicatedServer: DedicatedServer, sessionInfo: IDebugSessionInfo) {
    this.#onDebugConnected.dispatch(dedicatedServer, sessionInfo);

    // Push WebSocket notification
    if (this.#httpServer) {
      const slot = this.getSlotForServer(dedicatedServer);
      this.#httpServer.notify({
        eventName: "debugConnected",
        timestamp: Date.now(),
        slot: slot,
        protocolVersion: sessionInfo.protocolVersion,
      });
    }
  }

  private bubbleDebugDisconnected(dedicatedServer: DedicatedServer, reason: string) {
    this.#onDebugDisconnected.dispatch(dedicatedServer, reason);

    // Push WebSocket notification
    if (this.#httpServer) {
      const slot = this.getSlotForServer(dedicatedServer);
      this.#httpServer.notify({
        eventName: "debugDisconnected",
        timestamp: Date.now(),
        slot: slot,
        reason: reason,
      });
    }
  }

  private bubbleDebugStats(dedicatedServer: DedicatedServer, statsData: { tick: number; stats: IStatData[] }) {
    Log.verbose(
      `[DebugStats] ServerManager: Received stats tick ${statsData.tick} with ${statsData.stats.length} stat items`
    );
    this.#onDebugStats.dispatch(dedicatedServer, statsData);

    // Push WebSocket notification
    if (this.#httpServer) {
      const slot = this.getSlotForServer(dedicatedServer);
      Log.verbose(`[DebugStats] Notifying WebSocket clients for slot ${slot}`);
      this.#httpServer.notify({
        eventName: "debugStats",
        timestamp: Date.now(),
        slot: slot,
        tick: statsData.tick,
        stats: statsData.stats.map((s) => ({
          name: s.name,
          values: s.values,
          parent: s.parent_name || undefined,
        })),
      });
    } else {
      Log.verbose(`[DebugStats] No HTTP server to notify`);
    }
  }

  private bubbleDebugPaused(dedicatedServer: DedicatedServer, reason: string) {
    this.#onDebugPaused.dispatch(dedicatedServer, reason);

    // Push WebSocket notification
    if (this.#httpServer) {
      const slot = this.getSlotForServer(dedicatedServer);
      this.#httpServer.notify({
        eventName: "debugPaused",
        timestamp: Date.now(),
        slot: slot,
        reason: reason,
      });
    }
  }

  private bubbleDebugResumed(dedicatedServer: DedicatedServer) {
    this.#onDebugResumed.dispatch(dedicatedServer);

    // Push WebSocket notification
    if (this.#httpServer) {
      const slot = this.getSlotForServer(dedicatedServer);
      this.#httpServer.notify({
        eventName: "debugResumed",
        timestamp: Date.now(),
        slot: slot,
      });
    }
  }

  private bubbleProfilerCapture(dedicatedServer: DedicatedServer, captureEvent: IProfilerCaptureEvent) {
    this.#onProfilerCapture.dispatch(dedicatedServer, captureEvent);

    // Push WebSocket notification with profiler data
    if (this.#httpServer) {
      const slot = this.getSlotForServer(dedicatedServer);
      this.#httpServer.notify({
        eventName: "profilerCapture",
        timestamp: Date.now(),
        slot: slot,
        captureBasePath: captureEvent.capture_base_path,
        captureData: captureEvent.capture_data, // Base64 encoded profiler data
      });
    }
  }

  get effectiveIsUsingPreview() {
    return this.#usePreview || (this.#creatorTools && this.#creatorTools.track === MinecraftTrack.preview);
  }

  async getLatestVersionInfo(force: boolean) {
    let minecraftInfoResponse: any = undefined;

    if (
      this.#utilities.platform === Platform.linux &&
      ((this.serverVersions[ServerType.bedrockLinux].version && !this.effectiveIsUsingPreview) ||
        (this.serverVersions[ServerType.bedrockLinuxPreview].version && this.effectiveIsUsingPreview)) &&
      !force
    ) {
      return true;
    }

    if (
      this.#utilities.platform === Platform.windows &&
      ((this.serverVersions[ServerType.bedrockWindows].version && !this.effectiveIsUsingPreview) ||
        (this.serverVersions[ServerType.bedrockWindowsPreview].version && this.effectiveIsUsingPreview)) &&
      !force
    ) {
      return true;
    }

    let successfullyRetrievedVersions = false;
    let serverVersionUrl = "https://net-secondary.web.minecraft-services.net/api/v1.0/download/links";
    try {
      minecraftInfoResponse = (await axios.get(serverVersionUrl)) as IMinecraftNetVersionService | undefined;

      if (
        minecraftInfoResponse &&
        minecraftInfoResponse.data &&
        minecraftInfoResponse.data.result &&
        minecraftInfoResponse.data.result.links
      ) {
        const links = minecraftInfoResponse.data.result.links;
        for (const link of links) {
          if (link.downloadType && link.downloadUrl) {
            const lastDash = link.downloadUrl.lastIndexOf("-");
            const lastDot = link.downloadUrl.lastIndexOf(".zip");

            if (lastDash > 0 && lastDot > lastDash) {
              let version = link.downloadUrl.substring(lastDash + 1, lastDot);

              // re-constitute the version number ourselves
              const verNums = version.split(".");

              if (verNums.length === 4) {
                const verStr = String(
                  String(parseInt(verNums[0])) +
                    "." +
                    String(parseInt(verNums[1])) +
                    "." +
                    String(parseInt(verNums[2])) +
                    "." +
                    String(parseInt(verNums[3]))
                );

                const versionIndex = Database.getVersionIndexFromVersionStr(version);
                let serverType = undefined;

                switch (link.downloadType) {
                  case "serverBedrockWindows":
                    serverType = ServerType.bedrockWindows;
                    break;
                  case "serverBedrockLinux":
                    serverType = ServerType.bedrockLinux;
                    break;
                  case "serverBedrockPreviewWindows":
                    serverType = ServerType.bedrockWindowsPreview;
                    break;
                  case "serverBedrockPreviewLinux":
                    serverType = ServerType.bedrockLinuxPreview;
                    break;
                  case "serverJar":
                    serverType = ServerType.java;
                    break;
                }

                if (serverType !== undefined) {
                  this.serverVersions[serverType].version = verStr;
                  this.serverVersions[serverType].versionIndex = versionIndex;
                }
              }
            }
          }
        }
        successfullyRetrievedVersions = true;
      }
    } catch (e: any) {
      console.log("Could not access Bedrock Dedicated Server details." + e.toString());
      return false;
    }

    // fallback: use version.json from githubusercontent.com
    if (!successfullyRetrievedVersions) {
      let versionUrl = "https://raw.githubusercontent.com/Mojang/bedrock-samples/main/version.json";

      if (this.effectiveIsUsingPreview) {
        versionUrl = "https://raw.githubusercontent.com/Mojang/bedrock-samples/preview/version.json";
      }

      await this.creatorTools.notifyStatusUpdate(
        "Retrieving " + (this.effectiveIsUsingPreview ? "preview" : "retail") + " version data."
      );

      try {
        minecraftInfoResponse = await axios.get(versionUrl);
      } catch (e: any) {
        console.log("Could not access Bedrock Dedicated Server details." + e);
        throw new Error(e.toString());
      }

      let latestVersionIndex = 0;

      try {
        if (minecraftInfoResponse === undefined || minecraftInfoResponse.data === undefined) {
          return false;
        }

        const responseJson: IMainInfoVersions = JSON.parse(JSON.stringify(minecraftInfoResponse.data));

        if (!responseJson) {
          return false;
        }

        for (const verId in responseJson) {
          const ver = responseJson[verId].version;

          if (ver) {
            const isPreview = Database.getVersionIsPreview(ver); // version ends with .20 or higher
            const versionIndex = Database.getVersionIndexFromVersionStr(ver);

            if (versionIndex > 0 && versionIndex > latestVersionIndex && isPreview === this.effectiveIsUsingPreview) {
              latestVersionIndex = versionIndex;

              // re-constitute the version number ourselves
              const verNums = ver.split(".");

              const verStr = String(
                String(parseInt(verNums[0])) +
                  "." +
                  String(parseInt(verNums[1])) +
                  "." +
                  String(parseInt(verNums[2])) +
                  "." +
                  String(parseInt(verNums[3]))
              );

              // Set version for both Windows and Linux server types
              // The version.json fallback only gives us the version number, which is the same
              // for both platforms - only the download URL differs
              const windowsServerType = isPreview ? ServerType.bedrockWindowsPreview : ServerType.bedrockWindows;
              const linuxServerType = isPreview ? ServerType.bedrockLinuxPreview : ServerType.bedrockLinux;

              this.serverVersions[windowsServerType].version = verStr;
              this.serverVersions[windowsServerType].versionIndex = latestVersionIndex;
              this.serverVersions[linuxServerType].version = verStr;
              this.serverVersions[linuxServerType].versionIndex = latestVersionIndex;
            }
          }
        }
      } catch (e: any) {
        Log.error("Could not access Bedrock Dedicated Server details." + e);
        return false;
      }
    }

    if (
      this.#utilities.platform === Platform.linux &&
      ((!this.effectiveIsUsingPreview && !this.serverVersions[ServerType.bedrockLinux]?.version) ||
        (this.effectiveIsUsingPreview && !this.serverVersions[ServerType.bedrockLinuxPreview]?.version))
    ) {
      Log.error("Could not determine latest Bedrock Dedicated Server version for Linux.");
      return false;
    }

    if (
      this.#utilities.platform === Platform.windows &&
      ((!this.effectiveIsUsingPreview && !this.serverVersions[ServerType.bedrockWindows]?.version) ||
        (this.effectiveIsUsingPreview && !this.serverVersions[ServerType.bedrockWindowsPreview]?.version))
    ) {
      Log.error("Could not determine latest Bedrock Dedicated Server version for Windows.");
      return false;
    }

    return true;
  }

  static getServerTypeStr(serverType: ServerType): string {
    switch (serverType) {
      case ServerType.bedrockWindows:
        return "bw";
      case ServerType.bedrockWindowsPreview:
        return "pw";
      case ServerType.bedrockLinux:
        return "bl";
      case ServerType.bedrockLinuxPreview:
        return "pl";
      case ServerType.java:
        return "jv";
      default:
        throw new Error();
    }
  }

  static getServerTypeFromString(serverVersion: string): ServerType | undefined {
    if (!serverVersion || serverVersion.length !== 2) {
      return undefined;
    }

    switch (serverVersion.toLowerCase()) {
      case "bw":
        return ServerType.bedrockWindows;
      case "pw":
        return ServerType.bedrockWindowsPreview;
      case "bl":
        return ServerType.bedrockLinux;
      case "pl":
        return ServerType.bedrockLinuxPreview;
      case "jv":
        return ServerType.java;
      default:
        return undefined;
    }
  }

  async deployPackCache() {
    if (!this.#creatorTools) {
      return;
    }

    let operId = await this.#creatorTools.notifyOperationStarted("Updating pack cache.");

    await this.#creatorTools.loadPacks();

    if (!this.#creatorTools.packs) {
      return;
    }

    const packs = this.#creatorTools.packs;

    for (let i = 0; i < packs.length; i++) {
      const pack = packs[i];

      if (pack.data && pack.reportFile && pack.file && pack.data.sourceHash) {
        if (!pack.file.isContentLoaded) {
          await pack.file.loadContent(false);
        }

        if (pack.file.content && pack.file.content instanceof Uint8Array) {
          const packCacheFolder = this.ensurePackCacheFolder();

          const packFolder =
            NodeStorage.ensureEndsWithDelimiter(packCacheFolder) +
            StorageUtilities.canonicalizePathAsFileName(pack.name) +
            "_" +
            Utilities.makeHashFileSafe(pack.data.sourceHash) +
            NodeStorage.platformFolderDelimiter;

          const packFolderStorage = new NodeStorage(packFolder, "");

          if (!fs.existsSync(packFolder)) {
            const zipStorage = new ZipStorage();

            await zipStorage.loadFromUint8Array(pack.file.content, pack.file.name);

            fs.mkdirSync(packFolder, { recursive: true });

            await this.creatorTools.notifyStatusUpdate("Extracting to " + packFolder);

            await StorageUtilities.syncFolderTo(
              zipStorage.rootFolder,
              packFolderStorage.rootFolder,
              false,
              false,
              false,
              ["bedrock_server.pdb"],
              undefined,
              async (message: string) => {
                // Log.message("Extracting: " + message + ".");
              },
              false,
              false,
              true
            );

            await packFolderStorage.rootFolder.saveAll();
          }

          pack.cacheFolder = packFolderStorage.rootFolder;
        }
      }
    }

    await this.#creatorTools.notifyOperationEnded(operId, "Pack cache update complete.");
  }

  async downloadLatestSourceServer() {
    await this.#env.load();

    if (!this.#env.iAgreeToTheMinecraftEndUserLicenseAgreementAndPrivacyStatementAtMinecraftDotNetSlashEula) {
      throw new Error(
        "Minecraft End-user License Agreement and Privacy Policy must be accepted before we can download the server."
      );
    }

    const operId = await this.creatorTools.notifyOperationStarted("Downloading Minecraft server.");

    let retrievedVersionInfo = await this.getLatestVersionInfo(false);

    if (!retrievedVersionInfo) {
      return false;
    }

    let serverType = ServerType.bedrockWindows;
    const platform = this.#utilities.platform;

    if (this.effectiveIsUsingPreview && platform === Platform.windows) {
      serverType = ServerType.bedrockWindowsPreview;
    } else if (this.effectiveIsUsingPreview && platform === Platform.linux) {
      serverType = ServerType.bedrockLinuxPreview;
    } else if (platform === Platform.linux) {
      serverType = ServerType.bedrockLinux;
    }

    let latestServerVersionAvailableLocal = this.serverVersions[serverType]?.version;
    let urlStart = this.serverVersions[serverType].downloadPrefix;

    if (!latestServerVersionAvailableLocal) {
      Log.message("Latest server version could not be determined.");
      return false;
    }

    if (!urlStart) {
      Log.message("Downloads are not available for this version.");
      return false;
    }

    const serverZipUrl = urlStart + latestServerVersionAvailableLocal + ".zip";

    await this.creatorTools.notifyStatusUpdate("Downloading new server version from '" + serverZipUrl + "'");

    let zipContentResponse: any = undefined;

    zipContentResponse = await this.tryDownloadDedicatedServer(serverZipUrl);

    // test for alternate versions of the server download.
    if (!zipContentResponse) {
      for (let i = 6; i > 1; i--) {
        let testVer = this.replaceVersion(latestServerVersionAvailableLocal, String(i) + ".01");
        // e.g., try 1.19.65.01
        if (testVer) {
          zipContentResponse = await this.tryDownloadDedicatedServer(urlStart + testVer + ".zip");
          if (zipContentResponse) {
            latestServerVersionAvailableLocal = testVer;
            break;
          }
        }
      }
    }

    if (!zipContentResponse) {
      Log.message(
        "Could not download the Bedrock Dedicated Server from '" +
          serverZipUrl +
          "'. This version may not be available for download yet. " +
          "The web server will continue without a dedicated server."
      );

      await this.creatorTools.notifyOperationEnded(
        operId,
        "Could not successfully download a file from '" + serverZipUrl + "'"
      );

      return false;
    }

    const zipData = zipContentResponse.data;

    const zipStorage = new ZipStorage();
    zipStorage.allowAllFiles = true;

    await zipStorage.loadFromUint8Array(zipData);

    const serverSourceFolder = this.ensureSourceServerFolder();

    const serverVersionFolder =
      serverSourceFolder +
      NodeStorage.platformFolderDelimiter +
      ServerManager.getServerTypeStr(serverType) +
      "v" +
      latestServerVersionAvailableLocal +
      NodeStorage.platformFolderDelimiter;

    if (!fs.existsSync(serverVersionFolder)) {
      fs.mkdirSync(serverVersionFolder, { recursive: true });
    }

    await this.creatorTools.notifyStatusUpdate("Extracting to " + serverVersionFolder);

    const serverVersionStorage = new NodeStorage(serverVersionFolder, "");

    /*
    // save a copy of the zip
    const file = serverVersionStorage.rootFolder.ensureFile("source.zip");
    file.setContent(zipData);
    */

    await StorageUtilities.syncFolderTo(
      zipStorage.rootFolder,
      serverVersionStorage.rootFolder,
      false,
      false,
      false,
      ["bedrock_server.pdb"],
      undefined,
      async (message: string) => {
        // Log.message("Extracting: " + message + ".");
      }
    );

    await serverVersionStorage.rootFolder.saveAll();

    await this.creatorTools.notifyOperationEnded(operId, "Downloaded and deployed server from '" + serverZipUrl + "'");

    return true;
  }

  replaceVersion(versionString: string, stub: string) {
    if (versionString.endsWith(stub)) {
      return undefined;
    }

    const lastPeriod = versionString.lastIndexOf(".");

    if (lastPeriod >= 0) {
      versionString = versionString.substring(0, lastPeriod) + stub;
      return versionString;
    }

    return undefined;
  }

  private static _getSafeVersion(): string {
    const ver = constants.version;
    if (ver.includes("-dev") || ver.includes("-semantically-released") || ver.startsWith("0.0.0")) {
      return "0.0.1";
    }
    return ver;
  }

  private async tryDownloadDedicatedServer(serverZipUrl: string) {
    let totalBytesDownloaded = 0;
    try {
      return await axios.get(serverZipUrl, {
        headers: {
          Accept: "application/octet-stream, application/json, text/plain, */*",
          "User-Agent": "minecraft-creator-tools-" + ServerManager._getSafeVersion(),
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        responseType: "arraybuffer",
        onDownloadProgress: function (progressEvent: AxiosProgressEvent) {
          totalBytesDownloaded += progressEvent.bytes;
          Log.message("Downloading " + serverZipUrl + " - " + totalBytesDownloaded + " bytes downloaded");
        },
      });
    } catch (e: any) {
      const status = e?.response?.status;
      const statusText = e?.response?.statusText;
      const code = e?.code;
      const message = e?.message;

      let detail = "";
      if (status) {
        detail = ` (HTTP ${status}${statusText ? " " + statusText : ""})`;
      } else if (code) {
        detail = ` (${code}${message ? ": " + message : ""})`;
      } else if (message) {
        detail = ` (${message})`;
      }

      Log.error("Could not find and download '" + serverZipUrl + "'" + detail);
    }

    return undefined;
  }

  private ensurePackCacheFolder() {
    const packCacheFolder = this.#env.utilities.packCachePath;

    if (!fs.existsSync(packCacheFolder)) {
      fs.mkdirSync(packCacheFolder, { recursive: true });
    }

    return packCacheFolder;
  }

  private ensureSourceServerFolder() {
    const serverSourceFolder = this.#env.utilities.sourceServersPath;

    if (!fs.existsSync(serverSourceFolder)) {
      fs.mkdirSync(serverSourceFolder, { recursive: true });
    }

    return serverSourceFolder;
  }

  async prepare(force?: boolean) {
    if (!force && this.#isPrepared) {
      return;
    }

    Log.message("Preparing servers...");

    if (this.#utilities.platform === Platform.macOS || this.#utilities.platform === Platform.unsupported) {
      Log.message("Dedicated servers are not supported on this platform.");
      return;
    }

    if (this.features !== ServerManagerFeatures.basicWebServices) {
      if (!fs.existsSync(this.#utilities.serversPath)) {
        fs.mkdirSync(this.#utilities.serversPath, { recursive: true });
      }

      if (!this.#contentLogWatcher) {
        this.#contentLogWatcher = new ContentLogWatcher(this.#env);
        this.#contentLogWatcher.watchServerFolder();
      }

      if (this.#env.worldContainerStorage.rootFolder) {
        this.backupWorldFileListings = await this.#env.worldContainerStorage.rootFolder.generateFileListings();
      }

      // Initialize the world backup manager
      if (this.#env.worldContainerStorage) {
        this.#worldBackupManager = new WorldBackupManager(
          this.#env.worldContainerStorage,
          this.backupWorldFileListings
        );
        await this.#worldBackupManager.load();
        // Logging is handled by WorldBackupManager.load()
      }

      await this.deployPackCache();

      const usingPreview = this.effectiveIsUsingPreview;
      let couldGetVersion = await this.getLatestVersionInfo(false);

      this._loadLatestDownloadedSource();

      const serverTypeTarget =
        this.#utilities.platform === Platform.linux ? ServerType.bedrockLinux : ServerType.bedrockWindows;
      const serverTypePreviewTarget =
        this.#utilities.platform === Platform.linux ? ServerType.bedrockLinuxPreview : ServerType.bedrockWindowsPreview;

      let versionStateStr =
        (usingPreview ? "Using preview" : "Using main") +
        " dedicated server.\n  Latest main server available on minecraft.net: " +
        (this.serverVersions[serverTypeTarget].version ? this.serverVersions[serverTypeTarget].version : "(none)");

      if (this.serverVersions[serverTypePreviewTarget].version) {
        versionStateStr +=
          "\n  Latest preview server available on minecraft.net: " +
          (this.serverVersions[serverTypePreviewTarget]
            ? this.serverVersions[serverTypePreviewTarget].version
            : "(none)");
      }

      if (this.serverVersions[serverTypeTarget].downloadedPath) {
        versionStateStr +=
          "\n  Latest downloaded main server version: " +
          (this.serverVersions[serverTypeTarget].downloadedPath
            ? this.serverVersions[serverTypeTarget].downloadedPath
            : "(none)");
      }

      if (this.serverVersions[serverTypePreviewTarget].downloadedPath) {
        versionStateStr +=
          "\n  Latest downloaded preview server version: " +
          (this.serverVersions[serverTypePreviewTarget].downloadedPath
            ? this.serverVersions[serverTypePreviewTarget].downloadedPath
            : "(none)");
      }

      Log.message(versionStateStr);

      const serverType = usingPreview ? serverTypePreviewTarget : serverTypeTarget;

      const serverVersion = this.serverVersions[serverType];

      if (this.creatorTools.dedicatedServerMode === DedicatedServerMode.auto) {
        if (couldGetVersion) {
          // if our source isn't up to date, download something new
          if (
            serverVersion.downloadedIndex === undefined ||
            (serverVersion.versionIndex && serverVersion.versionIndex > serverVersion.downloadedIndex) ||
            force
          ) {
            await this.downloadLatestSourceServer();

            this._loadLatestDownloadedSource();
          }
        }
      }

      const folders = fs.readdirSync(this.#utilities.serversPath);

      let latestServer: string | undefined;
      let latestServerDate = new Date(0, 0, 0);

      for (const folder of folders) {
        if (folder.startsWith("srv") && folder.length === 17) {
          const dateStr = folder.substring(3);

          if (Utilities.isNumeric(dateStr)) {
            const fullPath =
              NodeStorage.ensureEndsWithDelimiter(this.#utilities.serversPath) +
              folder +
              NodeStorage.platformFolderDelimiter;

            const dedicatedServer = this.ensureDedicatedServerForPath(folder, fullPath);

            if (dedicatedServer) {
              dedicatedServer.version = serverVersion;
              this.#servers[folder] = dedicatedServer;
            }

            const serverDate = Utilities.getDateFromStr(dateStr);

            if (serverDate.getTime() > latestServerDate.getTime()) {
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              latestServer = folder;
              latestServerDate = serverDate;
            }
          }
        }
      }
    }

    Log.message("Done preparing servers.");

    this.#isPrepared = true;
  }

  _loadLatestDownloadedSource() {
    const serverSourceFolder = this.ensureSourceServerFolder();

    // e.g., C:\\Users\\<user>\\AppData\\Local\\mctools_server\\serverSources\\
    const sourceFolders = fs.readdirSync(serverSourceFolder);

    for (const folder of sourceFolders) {
      if (folder.length > 3 && folder[2] === "v") {
        const serverType = ServerManager.getServerTypeFromString(folder.substring(0, 2));

        const verStr = folder.substring(3);

        if (serverType !== undefined && Utilities.isNumeric(verStr.replace(/./g, ""))) {
          const verIndex = Database.getVersionIndexFromVersionStr(verStr);
          const serverVersion = this.serverVersions[serverType];

          if (verIndex > 0 && serverVersion) {
            const fullPath =
              NodeStorage.ensureEndsWithDelimiter(this.#utilities.sourceServersPath) +
              folder +
              NodeStorage.platformFolderDelimiter;

            if (serverVersion.downloadedIndex === undefined || verIndex > serverVersion.downloadedIndex) {
              serverVersion.downloadedPath = fullPath;
              serverVersion.downloadedIndex = verIndex;
            }
          }
        }
      }
    }
  }

  ensureDirectServer(directServerPath: string) {
    if (!directServerPath) {
      throw new Error("No direct server path was specified.");
    }

    if (this.activeDirectServer === undefined) {
      const dedicatedServer = this.ensureDedicatedServerForPath("direct", directServerPath);

      if (!dedicatedServer) {
        throw new Error("Unexpectedly could not create a dedicated server.");
      }

      return dedicatedServer;
    }

    return this.activeDirectServer;
  }

  getBasePortForSlot(slotNumber?: number) {
    if (!slotNumber) {
      slotNumber = 0;
    }

    // assume if slotNumber > 79 they actually are suggesting a base port number
    if (slotNumber > 79) {
      return slotNumber;
    }

    return MinecraftUtilities.getPortForSlot(slotNumber);
  }

  getActiveServer(basePortOrSlot?: number) {
    const port = this.getBasePortForSlot(basePortOrSlot);

    return this.#activeServersByPort[port];
  }

  /**
   * Get all active slot numbers that have running DedicatedServer instances.
   * Returns an array of slot numbers (0-79).
   */
  getActiveSlots(): number[] {
    const slots: number[] = [];
    for (const portStr in this.#activeServersByPort) {
      const port = parseInt(portStr);
      if (this.#activeServersByPort[port]) {
        slots.push(MinecraftUtilities.getSlotFromPort(port));
      }
    }
    return slots.sort((a, b) => a - b);
  }

  getHashFromStartInfo(startInfo?: IMinecraftStartMessage) {
    if (!startInfo) {
      return undefined;
    }

    let hash = "";

    if (startInfo.track) {
      hash += startInfo.track?.toString();
    }

    hash += ".";

    if (startInfo.mode) {
      hash += startInfo.mode;
    }
    hash += ".";

    if (startInfo.projectKey) {
      hash += startInfo.projectKey;
    }

    hash += ".";

    if (startInfo.worldSettings) {
      hash += JSON.stringify(startInfo.worldSettings);
    }

    return hash;
  }

  async ensureActiveServer(basePortOrSlot?: number, startInfo?: IMinecraftStartMessage) {
    const port = this.getBasePortForSlot(basePortOrSlot);

    await this.#creatorTools.load();

    let configHash = undefined;

    let directServerPath = undefined;
    let sourceServerPath = undefined;

    let mode = DedicatedServerMode.auto;

    if (startInfo) {
      if (startInfo.mode === DedicatedServerMode.direct && startInfo.path) {
        directServerPath = startInfo.path;
        mode = DedicatedServerMode.direct;
      } else if (startInfo.mode === DedicatedServerMode.source && startInfo.path) {
        sourceServerPath = startInfo.path;
        mode = DedicatedServerMode.source;
      }

      if (startInfo.track === MinecraftTrack.main || startInfo.track === undefined) {
        this.#usePreview = false;
      } else {
        this.#usePreview = true;
      }

      configHash = this.getHashFromStartInfo(startInfo);
    } else {
      if (
        this.#creatorTools.dedicatedServerMode === DedicatedServerMode.source &&
        this.#creatorTools.dedicatedServerPath &&
        this.#creatorTools.dedicatedServerPath.length > 3
      ) {
        sourceServerPath = this.#creatorTools.dedicatedServerPath;
      } else if (
        this.#creatorTools.dedicatedServerMode === DedicatedServerMode.direct &&
        this.#creatorTools.dedicatedServerPath &&
        this.#creatorTools.dedicatedServerPath.length > 3
      ) {
        directServerPath = this.#creatorTools.dedicatedServerPath;
      }
    }

    /*
    if (mode === DedicatedServerMode.direct && directServerPath) {
      const dedicatedServer = this.ensureDirectServer(directServerPath);

      if (basePortOrSlot && dedicatedServer) {
        dedicatedServer.port = port;

        return dedicatedServer;
      }
    }*/

    if (this.#activeServersByPort[port]) {
      const srv = this.#activeServersByPort[port];

      if (configHash === undefined || srv.startConfigurationHash === configHash) {
        return srv;
      } else {
        this.#quiescentServersByPort[port] = srv;
        await srv.stopServer();
      }
    }

    await this.prepare();

    if (sourceServerPath === undefined) {
      sourceServerPath = this.effectiveAutoSourceServerPath;
    }

    let name = undefined;
    let path = undefined;

    // Calculate slot number from port for consistent folder naming
    const slotNumber = MinecraftUtilities.getSlotFromPort(port);

    if ((mode === DedicatedServerMode.auto || mode === DedicatedServerMode.source) && sourceServerPath !== undefined) {
      try {
        const result = await this.prepareSlotServerPath(sourceServerPath, slotNumber, {
          transientWorld: startInfo?.transientWorld,
        });
        name = result.name;
        path = result.path;
      } catch (e) {
        Log.message("Error creating slot server path: " + e);
        return undefined;
      }
    } else if (mode === DedicatedServerMode.direct && directServerPath) {
      path = directServerPath;
      name = StorageUtilities.getLeafName(directServerPath) + "_" + Utilities.getDateStr(new Date());
    }

    if (!path || !name) {
      throw new Error("Could not establish path for dedicated server to run.");
    }

    const operId = await this.creatorTools.notifyOperationStarted("Provisioning new server at '" + path + "'");

    const worldFolderName = startInfo?.worldSettings?.name ? startInfo?.worldSettings?.name : "world";

    const worldBackupFolder = this.#env.worldContainerStorage.rootFolder.ensureFolder(worldFolderName);

    const newDedicatedServer = new DedicatedServer(name, this, this.#env, path, worldBackupFolder);

    newDedicatedServer.startConfigurationHash = configHash;
    newDedicatedServer.port = port;

    newDedicatedServer.onPlayerConnected.subscribe(this.bubblePlayerConnected);
    newDedicatedServer.onPlayerDisconnected.subscribe(this.bubblePlayerDisconnected);

    newDedicatedServer.onServerError.subscribe(this.bubbleServerError);
    newDedicatedServer.onServerOutput.subscribe(this.bubbleServerOutput);
    newDedicatedServer.onServerStarted.subscribe(this.bubbleServerStarted);
    newDedicatedServer.onServerRefreshed.subscribe(this.bubbleServerRefreshed);
    newDedicatedServer.onServerStarting.subscribe(this.bubbleServerStarting);
    newDedicatedServer.onServerStopping.subscribe(this.bubbleServerStopping);
    newDedicatedServer.onServerStopped.subscribe(this.bubbleServerStopped);

    newDedicatedServer.onTestFailed.subscribe(this.bubbleTestFailed);
    newDedicatedServer.onTestStarted.subscribe(this.bubbleTestStarted);
    newDedicatedServer.onTestSucceeded.subscribe(this.bubbleTestSucceeded);
    newDedicatedServer.onServerGameEvent.subscribe(this.bubbleServerGameEvent);

    // Subscribe to debug events
    newDedicatedServer.onDebugConnected.subscribe(this.bubbleDebugConnected);
    newDedicatedServer.onDebugDisconnected.subscribe(this.bubbleDebugDisconnected);
    newDedicatedServer.onDebugStats.subscribe(this.bubbleDebugStats);
    newDedicatedServer.onDebugPaused.subscribe(this.bubbleDebugPaused);
    newDedicatedServer.onDebugResumed.subscribe(this.bubbleDebugResumed);
    newDedicatedServer.onProfilerCapture.subscribe(this.bubbleProfilerCapture);

    this.#activeServersByPort[port] = newDedicatedServer;
    this.#servers[name] = newDedicatedServer;

    await newDedicatedServer.ensureServerFolders();

    if (!startInfo || (startInfo && !startInfo.forceStartNewWorld)) {
      await newDedicatedServer.restoreLatestBackupWorld();
    }

    Log.assert(newDedicatedServer.defaultWorldFolder !== undefined, "DSMEAS");

    if (startInfo && startInfo.worldSettings && newDedicatedServer.defaultWorldFolder) {
      await this.preparePacksAndTemplates(path, newDedicatedServer.defaultWorldFolder, startInfo.worldSettings);
    }

    await newDedicatedServer.ensureContentDeployed(startInfo);
    await newDedicatedServer.ensureWorld(startInfo);

    await this.creatorTools.notifyOperationEnded(operId, "Done provisioning new server at '" + path + "'");

    return newDedicatedServer;
  }

  /**
   * Checks if a slot needs reprovisioning based on source server path changes.
   * Returns true if reprovisioning is needed, false if the slot can be reused as-is.
   */
  needsReprovisioning(slotNumber: number, sourcePath: string): boolean {
    const slotServerPath =
      NodeStorage.ensureEndsWithDelimiter(this.#utilities.serversPath) +
      this.getSlotFolderName(slotNumber) +
      NodeStorage.platformFolderDelimiter;

    // Check if the slot folder still exists
    if (!fs.existsSync(slotServerPath)) {
      Log.message(`Slot ${slotNumber} needs reprovisioning: folder no longer exists`);
      return true;
    }

    // First try in-memory state
    let provisioningInfo: ISlotProvisioningInfo | undefined = this.#slotProvisioningInfo[slotNumber];

    // If no in-memory state, try to load from sentinel file on disk
    // This handles the case where MCT was restarted but slot folder still exists
    if (!provisioningInfo) {
      const loadedInfo = this.loadSlotContext(slotNumber, slotServerPath);

      if (loadedInfo) {
        // Restore in-memory state from disk
        provisioningInfo = loadedInfo;
        this.#slotProvisioningInfo[slotNumber] = loadedInfo;
        Log.verbose(`Slot ${slotNumber}: restored provisioning context from sentinel file`);
      } else {
        // Slot folder exists but no sentinel file - needs reprovisioning
        Log.message(`Slot ${slotNumber} needs reprovisioning: no sentinel file found`);
        return true;
      }
    }

    // Normalize paths for comparison
    const normalizedSource = NodeStorage.ensureEndsWithDelimiter(sourcePath).toLowerCase();
    const normalizedProvisioned = provisioningInfo.sourceServerPath.toLowerCase();

    if (normalizedSource !== normalizedProvisioned) {
      Log.message(
        `Slot ${slotNumber} needs reprovisioning: source changed from '${provisioningInfo.sourceServerPath}' to '${sourcePath}'`
      );
      return true;
    }

    return false;
  }

  /**
   * Prepares a slot-based runtime server folder.
   *
   * Uses persistent slot-based folder names (e.g., `slot0/`, `slot1/`) instead of
   * timestamp-based names. This keeps the `bedrock_server.exe` path constant,
   * preventing Windows Firewall from prompting on every server start.
   *
   * **Smart Reprovisioning**: If the slot already exists and was provisioned from
   * the same source server path, this method returns quickly without re-doing
   * file operations. This makes stop/start cycles fast.
   *
   * **Backup Before Clean**: If the slot exists but needs reprovisioning (different
   * source version), world data is backed up before any destructive operations.
   * For transient worlds, the world folder is cleared instead of backed up.
   *
   * @param sourcePath - Path to the downloaded source server (e.g., bwv1.21.50.24/)
   * @param slotNumber - The slot number (0-79) for this server instance
   * @param options - Provisioning options (forceReprovision, transientWorld)
   * @returns Object with name and path for the runtime server
   */
  async prepareSlotServerPath(sourcePath: string, slotNumber: number = 0, options: ISlotProvisioningOptions = {}) {
    const { forceReprovision = false, transientWorld = false } = options;

    if (!sourcePath) {
      throw new Error("No source server path specified.");
    }

    if (!fs.existsSync(sourcePath)) {
      throw new Error("Source server path '" + sourcePath + "' does not appear to exist.");
    }

    sourcePath = NodeStorage.ensureEndsWithDelimiter(sourcePath);

    // Use slot-based naming for persistent folder paths, with context prefix.
    const name = this.getSlotFolderName(slotNumber);
    const slotServerPath =
      NodeStorage.ensureEndsWithDelimiter(this.#utilities.serversPath) + name + NodeStorage.platformFolderDelimiter;

    const isExistingSlot = fs.existsSync(slotServerPath);

    // Check if we can skip reprovisioning (same source, folder exists)
    if (!forceReprovision && isExistingSlot && !this.needsReprovisioning(slotNumber, sourcePath)) {
      Log.message(`Slot ${slotNumber} already provisioned from same source - reusing existing folder`);
      return {
        name: name,
        path: slotServerPath,
        wasReprovisioned: false,
      };
    }

    Log.message(
      `Preparing server from source at '${sourcePath}' to slot location '${slotServerPath}'` +
        (isExistingSlot ? " (updating existing slot)" : " (new slot)") +
        (transientWorld ? " [transient - will reset world]" : "")
    );

    // If slot exists, handle existing world data
    if (isExistingSlot) {
      if (transientWorld) {
        // For transient worlds, clear the world folder instead of backing up
        await this.clearSlotWorldData(slotNumber, slotServerPath);
      } else {
        await this.backupSlotWorldData(slotNumber, slotServerPath);
      }
    } else {
      fs.mkdirSync(slotServerPath, { recursive: true });
    }

    // Update symlinks to point to the new source version
    this.updateDedicatedServerSymLinkFolder(sourcePath, "behavior_packs", slotServerPath);
    this.updateDedicatedServerSymLinkFolder(sourcePath, "definitions", slotServerPath);
    this.updateDedicatedServerSymLinkFolder(sourcePath, "resource_packs", slotServerPath);
    this.updateDedicatedServerSymLinkFolder(sourcePath, "structures", slotServerPath);
    this.updateDedicatedServerSymLinkFolder(sourcePath, "world_templates", slotServerPath);

    // Copy/update configuration files
    this.updateDedicatedServerFile(sourcePath, "allowlist.json", slotServerPath);
    this.updateDedicatedServerFile(sourcePath, "invalid_known_packs.json", slotServerPath);
    this.updateDedicatedServerFile(sourcePath, "permissions.json", slotServerPath);
    this.updateDedicatedServerFile(sourcePath, "valid_known_packs.json", slotServerPath);

    // Copy/update the platform-specific server executable
    const serverExecutable = os.platform() === "win32" ? "bedrock_server.exe" : "bedrock_server";
    this.updateDedicatedServerFile(sourcePath, serverExecutable, slotServerPath);

    // On Linux, ensure the server executable has execute permissions
    if (os.platform() !== "win32") {
      const executablePath = slotServerPath + serverExecutable;
      if (fs.existsSync(executablePath)) {
        try {
          fs.chmodSync(executablePath, 0o755);
          Log.verbose(`Set executable permissions on ${executablePath}`);
        } catch (e: any) {
          Log.error(`Failed to set executable permissions on ${executablePath}: ${e.message}`);
        }
      }
    }

    // Track provisioning info for smart reprovisioning detection
    const provisioningInfo: ISlotProvisioningInfo = {
      sourceServerPath: sourcePath,
      provisionedAt: new Date(),
      version: this.extractVersionFromSourcePath(sourcePath),
      transientWorld: transientWorld || undefined, // Only store if true to keep sentinel file clean
    };

    this.#slotProvisioningInfo[slotNumber] = provisioningInfo;

    // Persist the sentinel file to disk so it survives server restarts
    this.saveSlotContext(slotNumber, slotServerPath, provisioningInfo);

    return {
      name: name,
      path: slotServerPath,
      wasReprovisioned: true,
    };
  }

  /**
   * Saves the slot context/sentinel file to disk.
   * This file records why/how the slot was created so we can detect context changes.
   */
  saveSlotContext(slotNumber: number, slotServerPath: string, info: ISlotProvisioningInfo) {
    try {
      const contextPath = slotServerPath + SLOT_CONTEXT_FILENAME;
      const data = {
        ...info,
        provisionedAt: info.provisionedAt instanceof Date ? info.provisionedAt.toISOString() : info.provisionedAt,
      };
      fs.writeFileSync(contextPath, JSON.stringify(data, null, 2), "utf8");
      Log.verbose(`Saved slot context to ${contextPath}`);
    } catch (e: any) {
      Log.error(`Failed to save slot context for slot ${slotNumber}: ${e.message}`);
    }
  }

  /**
   * Loads the slot context/sentinel file from disk.
   * Returns undefined if the file doesn't exist or is invalid.
   */
  loadSlotContext(slotNumber: number, slotServerPath: string): ISlotProvisioningInfo | undefined {
    try {
      const contextPath = slotServerPath + SLOT_CONTEXT_FILENAME;
      if (!fs.existsSync(contextPath)) {
        return undefined;
      }
      const data = JSON.parse(fs.readFileSync(contextPath, "utf8")) as ISlotProvisioningInfo;
      // Convert ISO string back to Date
      if (typeof data.provisionedAt === "string") {
        data.provisionedAt = new Date(data.provisionedAt);
      }
      return data;
    } catch (e: any) {
      Log.debug(`Failed to load slot context for slot ${slotNumber}: ${e.message}`);
      return undefined;
    }
  }

  /**
   * Extracts the version string from a source server path.
   * E.g., "bwv1.21.50.24/" -> "1.21.50.24"
   */
  extractVersionFromSourcePath(sourcePath: string): string | undefined {
    // Source paths look like: .../serverSources/bwv1.21.50.24/
    const match = sourcePath.match(/[bp][wl]v?([\d.]+)/i);
    return match ? match[1] : undefined;
  }

  /**
   * Backs up world data from a slot folder before destructive operations.
   * Uses the centralized WorldBackupManager for backup storage and deduplication.
   * Skips backup if the slot is marked as transient (transientWorld flag).
   */
  async backupSlotWorldData(slotNumber: number, slotServerPath: string) {
    // Check if this slot is marked as transient - if so, skip backup
    const slotContext = this.#slotProvisioningInfo[slotNumber];
    if (slotContext?.transientWorld) {
      Log.verbose(`Slot ${slotNumber}: Transient world - skipping backup`);
      return;
    }

    const worldsPath = slotServerPath + "worlds" + NodeStorage.platformFolderDelimiter;
    const defaultWorldPath = worldsPath + "defaultWorld" + NodeStorage.platformFolderDelimiter;

    if (!fs.existsSync(defaultWorldPath)) {
      Log.verbose(`Slot ${slotNumber}: No world data to backup`);
      return;
    }

    // Check if there's actually any content worth backing up
    const levelDatPath = defaultWorldPath + "level.dat";
    if (!fs.existsSync(levelDatPath)) {
      Log.verbose(`Slot ${slotNumber}: No level.dat found, skipping backup`);
      return;
    }

    // Ensure world backup manager is initialized
    if (!this.#worldBackupManager) {
      Log.verbose(`Slot ${slotNumber}: WorldBackupManager not initialized, skipping backup`);
      return;
    }

    const operId = await this.creatorTools.notifyOperationStarted(`Backing up world data from slot ${slotNumber}`);

    try {
      // Get or create the managed world for this slot
      const world = await this.#worldBackupManager.getOrCreateWorldForSlot(slotNumber);

      // Create backup using WorldBackupManager
      const result = await this.#worldBackupManager.createBackup(world.id, defaultWorldPath);

      if (result.success) {
        Log.message(`Slot ${slotNumber}: World backed up (${result.backupId})`);
        await this.creatorTools.notifyOperationEnded(operId, `World data backed up from slot ${slotNumber}`);
      } else {
        Log.error(`Slot ${slotNumber}: Backup failed - ${result.error}`);
        await this.creatorTools.notifyOperationEnded(operId, `Backup failed: ${result.error}`);
      }
    } catch (e: any) {
      Log.error(`Failed to backup world data from slot ${slotNumber}: ${e.message}`);
      await this.creatorTools.notifyOperationEnded(operId, `Failed to backup world data: ${e.message}`);
      // Don't throw - we still want to proceed with reprovisioning
    }
  }

  /**
   * Clears world data from a slot folder for transient worlds.
   * This resets the world to a fresh state, only keeping level.dat and level_name.txt
   * to preserve world name and seed settings.
   */
  async clearSlotWorldData(slotNumber: number, slotServerPath: string) {
    const worldsPath = slotServerPath + "worlds" + NodeStorage.platformFolderDelimiter;
    const defaultWorldPath = worldsPath + "defaultWorld" + NodeStorage.platformFolderDelimiter;

    if (!fs.existsSync(defaultWorldPath)) {
      Log.verbose(`Slot ${slotNumber}: No world data to clear`);
      return;
    }

    Log.message(`Slot ${slotNumber}: Clearing transient world data`);

    try {
      const entries = fs.readdirSync(defaultWorldPath, { withFileTypes: true });

      for (const entry of entries) {
        const entryPath = defaultWorldPath + entry.name;

        // Keep level.dat and level_name.txt (world config/seed)
        // But clear db/ folder (all block/entity data) and other runtime files
        if (entry.name === "level.dat" || entry.name === "level_name.txt") {
          continue;
        }

        // Retry with delay for EBUSY errors (locked LevelDB files from stale processes)
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            if (entry.isDirectory()) {
              fs.rmSync(entryPath, { recursive: true, force: true });
            } else {
              fs.unlinkSync(entryPath);
            }
            break; // success
          } catch (rmErr: any) {
            if (rmErr.code === "EBUSY" && attempt < 2) {
              Log.debug(`EBUSY on ${entry.name}, retrying in ${(attempt + 1) * 500}ms...`);
              await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 500));
            } else {
              throw rmErr;
            }
          }
        }
      }

      Log.verbose(`Slot ${slotNumber}: World data cleared - will start fresh on next launch`);
    } catch (e: any) {
      Log.error(`Failed to clear world data from slot ${slotNumber}: ${e.message}`);
      // Don't throw - we still want to proceed
    }
  }

  /**
   * @deprecated Use prepareSlotServerPath instead. This method is kept for backwards
   * compatibility but creates timestamp-based folders that cause Windows Firewall prompts.
   */
  async prepareTempServerNameAndPath(sourcePath: string) {
    Log.message("Warning: prepareTempServerNameAndPath is deprecated. Use prepareSlotServerPath instead.");
    // Default to slot 0 for backwards compatibility
    return this.prepareSlotServerPath(sourcePath, 0);
  }

  async preparePacksAndTemplates(targetPath: string, targetWorldFolder: IFolder, worldSettings: IWorldSettings) {
    if (!this.#creatorTools) {
      return;
    }

    // Ensure packageReferences array exists
    if (!worldSettings.packageReferences) {
      worldSettings.packageReferences = [];
    }

    // If deployCreatorToolsInfrastructure is enabled, add the creator-tools-ingame addon
    // This provides in-game script endpoints for status updates, player tracking, etc.
    if (worldSettings.deployCreatorToolsInfrastructure) {
      Package.ensureMinecraftCreatorToolsPackageReference(worldSettings.packageReferences);
    }

    const packCachePath = this.ensurePackCacheFolder();

    if (!packCachePath) {
      throw new Error("No pack cache path specified.");
    }

    if (!fs.existsSync(packCachePath)) {
      throw new Error("Pack cache path '" + packCachePath + "' does not appear to exist.");
    }

    if (worldSettings.worldTemplateReferences) {
      for (let i = 0; i < worldSettings.worldTemplateReferences.length; i++) {
        const templateRef = worldSettings.worldTemplateReferences[i];

        const pack = this.#creatorTools.getPackageByNameAndHash(templateRef.name, templateRef.hash);
        Log.message("Applying pack " + templateRef.name + " (" + templateRef.hash + ")");
        if (pack) {
          await this.addWorldTemplate(targetWorldFolder, pack);
          await this.addPackageFolders(targetPath, pack, templateRef);
        } else {
          Log.message(
            "Could not find pack '" + templateRef.name + "' referenced for world '" + worldSettings.name + "'"
          );
        }
      }
    }

    for (let i = 0; i < worldSettings.packageReferences.length; i++) {
      const packageRef = worldSettings.packageReferences[i];

      const packageI = this.#creatorTools.getPackageByNameAndHash(packageRef.name, packageRef.hash);

      if (packageI) {
        await this.addPackageFolders(targetPath, packageI, packageRef);
      } else {
        Log.message("Could not find pack '" + packageRef.name + "' referenced for world '" + worldSettings.name + "'");
      }
    }
  }

  async addPackageFolders(targetPath: string, pack: Package, packRef: IPackageReference) {
    if (!pack.cacheFolder) {
      return;
    }

    let slug = StorageUtilities.canonicalizePathAsFileName(pack.name);

    if (slug.length > 6) {
      slug = slug.substring(0, 6);
    }

    if (pack.data?.sourceHash) {
      slug += "_" + Utilities.makeHashFileSafe(pack.data?.sourceHash);
    }

    await this.addPackFolderReferences(targetPath, pack.cacheFolder, slug, packRef);
  }

  async addWorldTemplate(targetWorldFolder: IFolder, pack: Package) {
    if (!pack.cacheFolder) {
      return;
    }

    await this.copyWorldFiles(targetWorldFolder, pack.cacheFolder);
  }

  async addPackFolderReferences(
    targetPath: string,
    folder: IFolder,
    folderModifier: string,
    packRefSet: IPackageReference
  ) {
    if (!folder.isLoaded) {
      await folder.load();
    }

    if (MinecraftUtilities.pathLooksLikeResourcePackContainerName(folder.name)) {
      this.addChildFolderReferences(targetPath, folder, folderModifier, "development_resource_packs");
    } else if (MinecraftUtilities.pathLooksLikeBehaviorPackContainerName(folder.name)) {
      this.addChildFolderReferences(targetPath, folder, folderModifier, "development_behavior_packs");
    } else if (
      (folder.files["manifest.json"] !== undefined || folder.files["pack_manifest.json"] !== undefined) &&
      folder.files["level.dat"] === undefined
    ) {
      const manifestFile = folder.files["manifest.json"] || folder.files["pack_manifest.json"];

      if (manifestFile) {
        await manifestFile.loadContent();
        const content = manifestFile.content;

        if (content && typeof content === "string") {
          // Parse the manifest to get the header UUID - this identifies the pack itself,
          // not its dependencies. Using string search was incorrect because a BP's manifest
          // may contain an RP UUID in its dependencies section.
          try {
            const manifest = JSON.parse(content);
            const headerUuid = manifest?.header?.uuid?.toLowerCase();

            if (headerUuid) {
              // Check if this pack's UUID matches any resource pack reference
              for (const packRef of packRefSet.resourcePackReferences) {
                if (headerUuid === packRef.uuid.toLowerCase()) {
                  this.createSymLinkFolder(
                    NodeStorage.ensureEndsWithDelimiter(targetPath) +
                      "development_resource_packs" +
                      NodeStorage.platformFolderDelimiter +
                      folderModifier +
                      "_" +
                      folder.name,
                    folder.fullPath
                  );
                  break;
                }
              }

              // Check if this pack's UUID matches any behavior pack reference
              for (const packRef of packRefSet.behaviorPackReferences) {
                if (headerUuid === packRef.uuid.toLowerCase()) {
                  this.createSymLinkFolder(
                    NodeStorage.ensureEndsWithDelimiter(targetPath) +
                      "development_behavior_packs" +
                      NodeStorage.platformFolderDelimiter +
                      folderModifier +
                      "_" +
                      folder.name,
                    folder.fullPath
                  );
                  break;
                }
              }
            }
          } catch {
            // If manifest parsing fails, skip this folder
            Log.debug(`Failed to parse manifest.json in ${folder.fullPath}`);
          }
        }
      }
    } else {
      for (const folderName in folder.folders) {
        const childFolder = folder.folders[folderName];

        if (childFolder && !childFolder.errorStatus) {
          await this.addPackFolderReferences(targetPath, childFolder, folderModifier, packRefSet);
        }
      }
    }
  }

  async copyWorldFiles(targetWorldFolder: IFolder, sourceFolder: IFolder) {
    if (!sourceFolder.isLoaded) {
      await sourceFolder.load();
    }

    if (sourceFolder.files["level.dat"] !== undefined) {
      await StorageUtilities.syncFolderTo(
        sourceFolder,
        targetWorldFolder,
        false,
        false,
        false,
        ["resource_packs", "behavior_packs"],
        undefined,
        async (message: string) => {
          Log.message("Extracting: " + message + ".");
        }
      );

      await targetWorldFolder.saveAll();
    } else {
      for (const folderName in sourceFolder.folders) {
        const childFolder = sourceFolder.folders[folderName];

        if (childFolder && !childFolder.errorStatus) {
          await this.copyWorldFiles(targetWorldFolder, childFolder);
        }
      }
    }
  }

  addChildFolderReferences(targetPath: string, loadedFolder: IFolder, folderModifier: string, targetSubFolder: string) {
    for (const folderName in loadedFolder.folders) {
      const childFolder = loadedFolder.folders[folderName];

      if (childFolder && !childFolder.errorStatus) {
        this.createSymLinkFolder(
          NodeStorage.ensureEndsWithDelimiter(targetPath) +
            targetSubFolder +
            NodeStorage.platformFolderDelimiter +
            folderModifier +
            "_" +
            folderName,
          childFolder.fullPath
        );
      }
    }
  }

  cleanDedicatedServerSymLinkFolder(folder: string, tempServerPath: string) {
    const targetPath = tempServerPath + folder + NodeStorage.platformFolderDelimiter;

    if (fs.existsSync(targetPath)) {
      const stat = fs.statSync(targetPath);

      if (stat.isSymbolicLink()) {
        fs.rmdirSync(targetPath);
      }
    }
  }

  createSymLinkFolder(targetPath: string, sourcePath: string) {
    if (!fs.existsSync(targetPath)) {
      try {
        // On Windows, use 'junction' because directory symlinks require admin/developer mode.
        // On Linux/macOS, use 'dir' which works without elevated privileges.
        const symlinkType = os.platform() === "win32" ? "junction" : "dir";
        fs.symlinkSync(sourcePath, targetPath, symlinkType);
      } catch (e: any) {
        Log.error(`Failed to create symlink from '${sourcePath}' to '${targetPath}': ${e.message}`);
        Log.message("Falling back to directory copy...");
        // Fall back to copying the directory if symlink fails
        try {
          fs.cpSync(sourcePath, targetPath, { recursive: true });
        } catch (copyErr: any) {
          Log.error(`Failed to copy directory as fallback: ${copyErr.message}`);
          throw e; // Rethrow original error
        }
      }
    }
  }

  createDedicatedServerSymLinkFolder(sourcePath: string, folder: string, tempServerPath: string) {
    const targetPath = tempServerPath + folder + NodeStorage.platformFolderDelimiter;
    const sourceFullPath = sourcePath + folder + NodeStorage.platformFolderDelimiter;

    if (!fs.existsSync(targetPath)) {
      try {
        // On Windows, use 'junction' because directory symlinks require admin/developer mode.
        // On Linux/macOS, use 'dir' which works without elevated privileges.
        const symlinkType = os.platform() === "win32" ? "junction" : "dir";
        fs.symlinkSync(sourceFullPath, targetPath, symlinkType);
      } catch (e: any) {
        Log.error(`Failed to create symlink for '${folder}': ${e.message}`);
        Log.message(`Falling back to directory copy for '${folder}'...`);
        // Fall back to copying the directory if symlink fails
        try {
          fs.cpSync(sourceFullPath, targetPath, { recursive: true });
        } catch (copyErr: any) {
          Log.error(`Failed to copy directory '${folder}' as fallback: ${copyErr.message}`);
          throw e; // Rethrow original error
        }
      }
    }
  }

  cleanDedicatedServerSymLinkFile(file: string, tempServerPath: string) {
    const targetPath = tempServerPath + file;

    if (fs.existsSync(targetPath)) {
      const stat = fs.statSync(targetPath);

      if (stat.isSymbolicLink()) {
        fs.unlinkSync(targetPath);
      }
    }
  }

  createDedicatedServerFile(sourcePath: string, file: string, tempServerPath: string) {
    const targetPath = tempServerPath + file;

    if (!fs.existsSync(targetPath) && fs.existsSync(sourcePath + file)) {
      // file symbolic links don't work on non-admin, non-developer mode PCs, so just copy instead.
      //fs.symlinkSync(sourcePath + file, targetPath, "file");
      fs.copyFileSync(sourcePath + file, targetPath);
    }
  }

  /**
   * Updates a symlink folder for slot-based server provisioning.
   * If the target exists (symlink or directory), it is removed and recreated.
   * This allows updating an existing slot to point to a new source server version.
   */
  updateDedicatedServerSymLinkFolder(sourcePath: string, folder: string, slotServerPath: string) {
    // Don't include trailing delimiter for symlink operations - it causes issues
    const targetPath = slotServerPath + folder;
    const sourceFullPath = sourcePath + folder;

    // Check if source folder exists - if not, skip this symlink
    if (!fs.existsSync(sourceFullPath)) {
      Log.verbose(`Source folder '${folder}' does not exist in '${sourcePath}' - skipping symlink`);
      return;
    }

    // If target already exists, remove it first
    if (fs.existsSync(targetPath)) {
      try {
        const stat = fs.lstatSync(targetPath);
        if (stat.isSymbolicLink()) {
          // Remove symlink - use the path without trailing delimiter
          fs.unlinkSync(targetPath);
          Log.verbose(`Removed existing symlink: ${targetPath}`);
        } else if (stat.isDirectory()) {
          // Remove copied directory
          fs.rmSync(targetPath, { recursive: true, force: true });
          Log.verbose(`Removed existing directory: ${targetPath}`);
        } else {
          // It's a file - remove it
          fs.unlinkSync(targetPath);
          Log.verbose(`Removed existing file: ${targetPath}`);
        }
      } catch (e: any) {
        Log.error(`Failed to remove existing '${folder}' for update: ${e.message}`);
        // Try to continue anyway - the symlink creation will fail if target still exists
      }
    }

    // Create fresh symlink
    try {
      const symlinkType = os.platform() === "win32" ? "junction" : "dir";
      fs.symlinkSync(sourceFullPath, targetPath, symlinkType);
      Log.verbose(`Created symlink: ${targetPath} -> ${sourceFullPath}`);
    } catch (e: any) {
      Log.error(`Failed to create symlink for '${folder}': ${e.message}`);
      Log.message(`Falling back to directory copy for '${folder}'...`);
      try {
        fs.cpSync(sourceFullPath, targetPath, { recursive: true });
      } catch (copyErr: any) {
        Log.error(`Failed to copy directory '${folder}' as fallback: ${copyErr.message}`);
        throw e;
      }
    }
  }

  /**
   * Updates a file for slot-based server provisioning.
   * Overwrites the existing file in place, keeping the same path.
   * This is critical for bedrock_server.exe to avoid Windows Firewall prompts.
   */
  updateDedicatedServerFile(sourcePath: string, file: string, slotServerPath: string) {
    const targetPath = slotServerPath + file;
    const sourceFilePath = sourcePath + file;

    if (!fs.existsSync(sourceFilePath)) {
      return;
    }

    // Always copy (overwrite if exists), keeping the same target path
    // This is especially important for bedrock_server.exe - same path means
    // Windows Firewall rules persist across server version updates.
    fs.copyFileSync(sourceFilePath, targetPath);
  }

  // ================================================================================
  // WORLD BACKUP MANAGEMENT API
  // These methods provide a high-level API for world and backup operations.
  // They delegate to the WorldBackupManager for the actual implementation.
  // ================================================================================

  /**
   * List all managed worlds with their backup information.
   */
  async listManagedWorlds(): Promise<ManagedWorld[]> {
    if (!this.#worldBackupManager) {
      throw new Error("World backup manager not initialized. Call prepare() first.");
    }
    return this.#worldBackupManager.managedWorlds;
  }

  /**
   * Get a managed world by its ID.
   */
  async getManagedWorld(worldId: string): Promise<ManagedWorld | undefined> {
    if (!this.#worldBackupManager) {
      throw new Error("World backup manager not initialized. Call prepare() first.");
    }
    return this.#worldBackupManager.getWorld(worldId);
  }

  /**
   * Create a new managed world with a unique ID.
   * @param friendlyName Human-readable name for the world
   * @param description Optional description
   * @returns The newly created ManagedWorld
   */
  async createManagedWorld(friendlyName: string, description?: string): Promise<ManagedWorld> {
    if (!this.#worldBackupManager) {
      throw new Error("World backup manager not initialized. Call prepare() first.");
    }
    return this.#worldBackupManager.createWorld(friendlyName, description);
  }

  /**
   * Create a backup of a world from a source folder.
   * @param worldId The ID of the managed world to backup to
   * @param sourceFolder The folder containing the world data to backup
   * @param options Backup options
   * @returns The backup result
   */
  async createWorldBackup(worldId: string, sourceFolder: IFolder, options?: IBackupOptions): Promise<IBackupResult> {
    if (!this.#worldBackupManager) {
      throw new Error("World backup manager not initialized. Call prepare() first.");
    }
    // WorldBackupManager.createBackup expects a path string
    return this.#worldBackupManager.createBackup(worldId, sourceFolder.fullPath, options);
  }

  /**
   * Restore a backup to a target folder.
   * @param worldId The ID of the managed world
   * @param timestamp The backup timestamp to restore (or undefined for latest)
   * @param targetFolder The folder to restore to
   */
  async restoreWorldBackup(worldId: string, timestamp: number | undefined, targetFolder: IFolder): Promise<void> {
    if (!this.#worldBackupManager) {
      throw new Error("World backup manager not initialized. Call prepare() first.");
    }
    // Convert timestamp to backupId (world{timestamp}) or get latest
    let backupId: string;
    if (timestamp !== undefined) {
      backupId = `world${timestamp}`;
    } else {
      const world = this.#worldBackupManager.getWorld(worldId);
      if (!world) {
        throw new Error(`World ${worldId} not found`);
      }
      await world.loadBackups();
      const latest = world.backups[world.backups.length - 1];
      if (!latest) {
        throw new Error(`No backups found for world ${worldId}`);
      }
      backupId = latest.id;
    }
    await this.#worldBackupManager.restoreBackup(worldId, backupId, targetFolder.fullPath);
  }

  /**
   * Export a backup as a .mcworld file.
   * @param worldId The ID of the managed world
   * @param timestamp The backup timestamp to export (or undefined for latest)
   * @param outputPath The path to write the .mcworld file to
   */
  async exportBackupAsMcWorld(worldId: string, timestamp: number | undefined, outputPath: string): Promise<void> {
    if (!this.#worldBackupManager) {
      throw new Error("World backup manager not initialized. Call prepare() first.");
    }
    // Convert timestamp to backupId (world{timestamp}) or get latest
    let backupId: string;
    if (timestamp !== undefined) {
      backupId = `world${timestamp}`;
    } else {
      const world = this.#worldBackupManager.getWorld(worldId);
      if (!world) {
        throw new Error(`World ${worldId} not found`);
      }
      await world.loadBackups();
      const latest = world.backups[world.backups.length - 1];
      if (!latest) {
        throw new Error(`No backups found for world ${worldId}`);
      }
      backupId = latest.id;
    }
    await this.#worldBackupManager.exportMcWorld(worldId, backupId, outputPath);
  }

  /**
   * Get all backups for a managed world.
   * @param worldId The ID of the managed world
   */
  async getWorldBackups(worldId: string): Promise<WorldBackup[]> {
    if (!this.#worldBackupManager) {
      throw new Error("World backup manager not initialized. Call prepare() first.");
    }
    const world = this.#worldBackupManager.getWorld(worldId);
    if (!world) {
      throw new Error(`World ${worldId} not found`);
    }
    await world.loadBackups();
    return world.backups;
  }

  /**
   * Delete a specific backup.
   * @param worldId The ID of the managed world
   * @param timestamp The backup timestamp to delete
   */
  async deleteWorldBackup(worldId: string, timestamp: number): Promise<void> {
    if (!this.#worldBackupManager) {
      throw new Error("World backup manager not initialized. Call prepare() first.");
    }
    const world = this.#worldBackupManager.getWorld(worldId);
    if (!world) {
      throw new Error(`World ${worldId} not found`);
    }
    // Convert timestamp to backupId format (world{timestamp})
    const backupId = `world${timestamp}`;
    await world.deleteBackup(backupId);
  }

  /**
   * Prune old backups for a world, keeping only the most recent ones.
   * @param worldId The ID of the managed world
   * @param keepCount Number of backups to keep (default 10)
   */
  async pruneWorldBackups(worldId: string, keepCount: number = 10): Promise<number> {
    if (!this.#worldBackupManager) {
      throw new Error("World backup manager not initialized. Call prepare() first.");
    }
    const world = this.#worldBackupManager.getWorld(worldId);
    if (!world) {
      throw new Error(`World ${worldId} not found`);
    }
    return world.pruneBackups(keepCount);
  }

  /**
   * Get or create a managed world for a given slot.
   * This creates a mapping between server slots and managed worlds.
   * @param slotNumber The server slot number
   * @param createIfMissing If true, creates a new world if none exists for the slot
   */
  async getOrCreateWorldForSlot(
    slotNumber: number,
    createIfMissing: boolean = true
  ): Promise<ManagedWorld | undefined> {
    if (!this.#worldBackupManager) {
      throw new Error("World backup manager not initialized. Call prepare() first.");
    }

    const server = this.getActiveServer(slotNumber);
    if (!server) {
      if (!createIfMissing) {
        return undefined;
      }
      throw new Error(`No active server at slot ${slotNumber}`);
    }

    // For now, we'll use the slot number as the friendly name
    // and create a new world if needed
    if (createIfMissing) {
      const worldName = server.name || `Slot ${slotNumber} World`;
      const world = await this.createManagedWorld(worldName, `World for server slot ${slotNumber}`);
      return world;
    }

    return undefined;
  }

  register() {}
}
