/**
 * ARCHITECTURE DOCUMENTATION: DedicatedServer - Minecraft Server Process Manager
 * ===============================================================================
 *
 * DedicatedServer manages a single instance of Minecraft Bedrock Dedicated Server,
 * handling process lifecycle, command execution, content deployment, and world backups.
 *
 * ## Core Responsibilities
 *
 * 1. **Process Lifecycle**: Start, stop, and monitor bedrock_server.exe
 * 2. **Command Execution**: Send commands to the server via stdin
 * 3. **Output Parsing**: Parse server stdout for events (player join/leave, test results)
 * 4. **Content Deployment**: Deploy add-on packs to the running server
 * 5. **World Backup**: Backup world files during runtime using save hold/resume
 * 6. **Debug Client**: Connect to the Minecraft script debugger for profiling
 *
 * ## Server Folder Structure
 *
 * Each DedicatedServer instance operates in a runtime server folder:
 *
 * ```
 * srv20260101120000/                      (Runtime server folder)
 *   ├─ bedrock_server.exe                 (Copied from source)
 *   ├─ server.properties                  (Generated, configures ports, world name)
 *   ├─ allowlist.json                     (Symlink to source)
 *   ├─ permissions.json                   (Symlink to source)
 *   ├─ config/                            (Generated config folder)
 *   │   ├─ default.json                   (Creator Tools server config)
 *   │   └─ ...
 *   ├─ behavior_packs/                    (Junction to source vanilla packs)
 *   ├─ resource_packs/                    (Junction to source vanilla packs)
 *   ├─ definitions/                       (Junction to source definitions)
 *   ├─ development_behavior_packs/        (Writable - deployed add-ons go here)
 *   │   └─ my_addon_abc123_my_bp/         (Symlink to pack cache folder)
 *   ├─ development_resource_packs/        (Writable - deployed add-ons go here)
 *   │   └─ my_addon_abc123_my_rp/         (Symlink to pack cache folder)
 *   └─ worlds/
 *       └─ defaultWorld/                  (Writable - active world data)
 *           ├─ level.dat                  (World metadata in NBT format)
 *           ├─ levelname.txt              (World display name)
 *           ├─ world_behavior_packs.json  (Active behavior packs for world)
 *           ├─ world_resource_packs.json  (Active resource packs for world)
 *           └─ db/                        (LevelDB world data)
 *               ├─ CURRENT
 *               ├─ MANIFEST-000001
 *               ├─ *.ldb                  (Immutable SSTable files)
 *               └─ *.log                  (Write-ahead log)
 * ```
 *
 * ## Startup Sequence
 *
 * 1. **Signature Verification**: On Windows, verify bedrock_server.exe is Microsoft-signed
 * 2. **Folder Setup**: Create development_*_packs and worlds/defaultWorld if needed
 * 3. **Config Generation**: Write server.properties with port, world name, settings
 * 4. **World Restoration**: Optionally restore from latest backup
 * 5. **Process Spawn**: Launch server with stdin/stdout capture
 *    - Windows: spawn bedrock_server.exe directly
 *    - Linux: spawn bedrock_server with LD_LIBRARY_PATH set
 * 6. **Ready Detection**: Parse stdout for "Server started" message
 * 7. **Debugger Connection**: Connect to script debugger on port 19144
 * 8. **Position Polling**: Start polling for player positions
 *
 * ## Linux Compatibility
 *
 * The server supports both Windows and Linux with these platform-specific behaviors:
 *
 * - **Executable**: `bedrock_server.exe` on Windows, `bedrock_server` on Linux
 * - **Library Path**: On Linux, `LD_LIBRARY_PATH` is set to the server directory
 * - **Signature Check**: Authenticode verification is Windows-only (skipped on Linux)
 * - **Path Handling**: Uses platform-aware path delimiters throughout
 *
 * ## Restart Backoff Strategy
 *
 * If the server crashes unexpectedly, it will attempt to restart with exponential
 * backoff to avoid resource exhaustion:
 *
 * | Crash # | Delay Before Restart |
 * |---------|---------------------|
 * | 1       | 1 second            |
 * | 2       | 2 seconds           |
 * | 3       | 4 seconds           |
 * | 4+      | Stop auto-restart   |
 *
 * The crash counter resets after 60 seconds of stable operation.
 *
 * ## World Backup Strategy
 *
 * Backups are performed using the Bedrock server's safe backup protocol:
 *
 * ```
 * Normal Operation                     Backup Sequence
 *       │                                    │
 *       │  ┌───── save hold ─────────────►  │ (1) Suspend world writes
 *       │  │                                 │
 *       │  │      save query ─────────────► │ (2) Get list of modified files
 *       │  │                                 │
 *       │  │  ◄──── file list ────────────  │ (3) Server returns file paths & sizes
 *       │  │                                 │
 *       │  │      [copy files] ───────────► │ (4) Copy only modified files
 *       │  │                                 │
 *       │  │      save resume ────────────► │ (5) Resume world writes
 *       │  │                                 │
 *       │  └─────────────────────────────►  │
 * ```
 *
 * Backup folders are stored in a configurable location (default: user's Documents):
 * ```
 * Documents/mctools/worlds/
 *   └─ world/
 *       ├─ world20260101120000/          (Timestamped backup)
 *       │   ├─ files.json                (File listing with sizes)
 *       │   ├─ level.dat
 *       │   └─ db/
 *       │       └─ <only modified .ldb files>
 *       └─ world20260101130000/          (Later backup)
 * ```
 *
 * **Incremental Backup Optimization**:
 * - The backup system tracks SHA hashes of LevelDB files
 * - Only files that have changed since the last backup are copied
 * - This is especially efficient for LevelDB's immutable SSTable (.ldb) files
 * - The `backupWorldFileListings` in ServerManager tracks known files across backups
 *
 * **Backup Timeout Protection**:
 * - A 60-second timeout prevents backup from getting stuck if server doesn't respond
 * - If timeout fires, save is forcefully resumed and an error is logged
 * - Timeout is cleared when backup completes successfully or server stops
 *
 * ## Content Deployment Strategy (Feb 2026)
 *
 * Hot-reload is ENABLED for **script-only changes** on subsequent deploys.
 * The first deploy always restarts to register packs with the world.
 *
 * Decision logic (in `deploy()` method):
 *
 * 1. **First deploy** (`deployCount === 0`): Always restart — packs must be registered
 * 2. **Subsequent deploys** with server running:
 *    a. Capture before/after thumbprints of behavior + resource packs
 *    b. If resource pack files changed → restart (textures/models can't hot-reload)
 *    c. If behavior pack changes are script-only (.js/.ts/.map, no deletions) → `/reload`
 *    d. Otherwise → restart
 * 3. **Caller override**: `isReloadable=false` forces restart regardless
 *
 * The `MinecraftUtilities.isReloadableSetOfChanges()` function gates the decision:
 * it returns true only when ALL file diffs are `.js`, `.ts`, or `.map` with no deletions.
 *
 * When deploying add-on content:
 *
 * **Hot-Reload Path** (script-only changes, subsequent deploys):
 * 1. **Sync Files**: Copy new/modified files to development_*_packs folders
 * 2. **Thumbprint Diff**: Compare before/after to determine what changed
 * 3. **Run `/reload`**: Hot-reload scripts without server restart
 *
 * **Restart Path** (structural changes, first deploy, or caller override):
 * 1. **Sync Files**: Copy new/modified files to development_*_packs folders
 * 2. **Update Pack References**: Ensure world_behavior_packs.json has pack UUIDs
 * 3. **Stop Server**: Graceful shutdown with backup
 * 4. **Restart Server**: Fresh start picks up all changes
 *
 * ## Slot Sentinel File (ServerManager)
 *
 * Each slot folder contains a sentinel file (`slot_context.json`) that records:
 * - Source server version and path
 * - When the slot was provisioned
 * - Deployed pack UUIDs and versions
 * - World settings and experiments enabled
 *
 * On startup, ServerManager compares the current context against the sentinel:
 * - If context matches: Reuse existing slot (fast startup)
 * - If context differs: Backup world, rebuild slot, restore world, re-deploy
 *
 * ## Server Output Parsing
 *
 * The server's stdout is continuously parsed for significant events:
 *
 * | Log Message Pattern         | Action                                    |
 * |-----------------------------|-------------------------------------------|
 * | "Server started"            | Mark as running, enable debug, poll positions |
 * | "Player connected"          | Extract player name/xuid, emit event     |
 * | "Player disconnected"       | Extract player name/xuid, emit event     |
 * | "Data saved"                | Backup sequence state machine trigger    |
 * | "Changes to the level are resumed" | Backup complete notification      |
 * | "Loaded test: ..."          | GameTest started event                   |
 * | "passed test: ..."          | GameTest passed event                    |
 * | "failed test: ..."          | GameTest failed event                    |
 *
 * ## Script Debugger Integration
 *
 * After server start, DedicatedServer can connect to the Minecraft script debugger:
 *
 * 1. Send `script debugger listen 19144` command to server (if enableDebugger=true)
 * 2. Wait for "Debugger listening" message from Minecraft (confirms listener is ready)
 * 3. Connect MinecraftDebugClient to localhost:19144 (if enableDebuggerStreaming=true)
 * 4. Receive profiling stats (tick timing, script execution times)
 * 5. Forward debug events to ServerManager → HttpServer → WebSocket clients
 *
 * **Configuration (Jan 2026 Update)**:
 * - `enableDebugger` (default: true): Whether BDS enables script debugger on port 19144
 * - `enableDebuggerStreaming` (default: true for serve command): Whether we connect and stream debug stats
 *   The serve command enables streaming by default to provide real-time stats in the web UI.
 *
 * **Debug Client Connection Flow**:
 * - 3 seconds after "Server started" message: send `script debugger listen` command
 * - Wait for "Debugger listening" message from Minecraft stdout (or 10s timeout)
 * - Connect MinecraftDebugClient to localhost:debugPort
 * - Uses TCP keep-alive (30s) to detect dead connections
 * - Retries up to 5 times with exponential backoff on connection failure
 * - Has 10-second handshake timeout if server doesn't respond with ProtocolEvent
 * - Session info exposed via HTTP API: /api/{slot}/status includes debugConnectionState
 *
 * ## Related Files
 *
 * - ServerManager.ts: Creates and orchestrates DedicatedServer instances
 * - ServerConfigManager.ts: Manages server config/*.json files
 * - ServerPropertiesManager.ts: Manages server.properties file
 * - MCWorld.ts: World metadata parsing and modification
 * - MinecraftDebugClient.ts: Script debugger WebSocket client
 * - Thumbprint.ts: File tree hashing for change detection
 *
 * ## Key Methods
 *
 * - `startServer()`: Launch the server process with config
 * - `stopServer()`: Gracefully stop the server with "stop" command
 * - `deploy()`: Deploy add-on content to the running server
 * - `doBackup()`: Perform incremental world backup
 * - `runCommand()`: Execute a slash command on the server
 * - `ensureWorld()`: Set up world with settings and templates
 *
 * ## State Machine
 *
 * ```
 * stopped ──► deploying ──► launching ──► starting ──► started
 *    ▲                                                    │
 *    └────────────────────── stopping ◄───────────────────┘
 * ```
 */
import { onExit, chunksToLinesAsync, streamWrite } from "@rauschma/stringio";
import LocalEnvironment from "./LocalEnvironment";
import { Readable, Writable } from "stream";
import { spawn, ChildProcess } from "child_process";
import { EventDispatcher } from "ste-events";
import Player from "./../minecraft/Player";
import ServerManager, { IServerVersion } from "./ServerManager";
import ServerConfigManager from "./ServerConfigManager";
import SecurityUtilities from "../core/SecurityUtilities";
import ServerMessage, { ServerMessageCategory } from "./ServerMessage";
import ServerPropertiesManager from "../minecraft/ServerPropertiesManager";
import NodeStorage from "./NodeStorage";
import Log from "../core/Log";
import * as fs from "fs";
import * as os from "os";
import Project from "../app/Project";
import StorageUtilities from "../storage/StorageUtilities";
import LocalUtilities from "./LocalUtilities";
import MCWorld from "../minecraft/MCWorld";
import IFolder from "../storage/IFolder";
import MinecraftUtilities from "../minecraft/MinecraftUtilities";
import Thumbprint from "../storage/Thumbprint";
import { IMinecraftStartMessage as IMinecraftServerStart, IMinecraftStartMessage } from "../app/IMinecraftStartMessage";
import { DedicatedServerMode } from "../app/ICreatorToolsData";
import Utilities from "../core/Utilities";
import { clearTimeout, setInterval } from "timers";
import NodeFolder, { IFilePathAndSize } from "./NodeFolder";
import { BackupType } from "../minecraft/IWorldSettings";
import IActionSetData from "../actions/IActionSetData";
import IStorage from "../storage/IStorage";
import NodeFile from "./NodeFile";
import ZipStorage from "../storage/ZipStorage";
import MinecraftDebugClient from "../debugger/MinecraftDebugClient";
import { IStatData, IDebugSessionInfo, IProfilerCaptureEvent } from "../debugger/IMinecraftDebugProtocol";
import { WorldBackupType, IBackupResult } from "./IWorldBackupData";

export enum DedicatedServerStatus {
  stopped = 1,
  deploying = 2,
  launching = 3,
  starting = 4,
  started = 5,
}

export interface OutputLine {
  message: string;
  received: number;
  isInternal?: boolean;
}

export enum DedicatedServerBackupStatus {
  none = 0,
  suspendingSaveCommandIssued = 1,
  suspendingQueryCommandIssued = 2,
  suspendingQueryResultsPending = 3,
  saveSuspended = 4,
  copyingFiles = 5,
  resumingSave = 6,
  saveResumed = 7,
}

export const MaxTimeToWaitForServerToStart = 5000; // in ticks of 5ms each = 25 seconds

// Player position polling interval in ms (5 seconds)
const PLAYER_POSITION_POLL_INTERVAL = 5000;
// Minimum distance (in blocks) to consider a "major" move worth reporting
const PLAYER_MOVE_THRESHOLD = 2;

export default class DedicatedServer {
  #pendingCommands: string[] = [];
  #pendingRequestIds: string[] = [];
  #pendingCommandsInternal: boolean[] = []; // Track which commands are internal (don't log)
  #worldBackupContainerFolder: IFolder;
  serverPath: string;
  name: string;
  version?: IServerVersion;
  #backupInterval: NodeJS.Timeout | undefined;
  #backupTimeoutTimer: NodeJS.Timeout | undefined; // Timeout to prevent backup from getting stuck
  #playerPositionPollInterval: NodeJS.Timeout | undefined;
  #lastPlayerPositions: Map<string, { x: number; y: number; z: number; dimension: number }> = new Map();
  updates: any[] = [];
  #unexpectedStopLog: Date[] = [];
  #backupStatus: DedicatedServerBackupStatus = DedicatedServerBackupStatus.none;
  #behaviorPacksStorage: NodeStorage | undefined;
  #defaultWorldStorage: NodeStorage | undefined;
  #resourcePacksStorage: NodeStorage | undefined;
  #activeStdIn: Writable | null = null;
  #env: LocalEnvironment;
  #currentCommandId = 0;
  #dsm: ServerManager;
  #starts: number = 0;
  #lastResult: string | undefined;
  startConfigurationHash?: string = undefined;
  #port?: number;
  #activeProcess: ChildProcess | null = null;
  #status: DedicatedServerStatus = DedicatedServerStatus.stopped;

  // Debug client for connecting to the Minecraft script debugger
  #debugClient: MinecraftDebugClient | undefined;
  // enableDebugger: Whether BDS enables script debugger listening
  // The debug port is calculated dynamically based on the slot (base port + 12)
  #enableDebugger: boolean = true;
  // enableDebuggerStreaming: Whether we connect to the debug port and stream stats to web console
  // Enabled by default. Set worldSettings.enableDebuggerStreaming=false to disable.
  #enableDebuggerStreaming: boolean = true;
  // Flag to track when we're waiting for the debug listener to be ready
  // Set to true after sending 'script debugger listen', cleared when we receive 'Debugger listening' message
  #awaitingDebuggerListening: boolean = false;
  // Flag to track if the debug listener is ready but we haven't connected yet
  // Used when delaying debug client connection until a player joins
  #debugListenerReady: boolean = false;
  // Whether to delay debug client connection until a player joins
  // Note: This was used during debugging but the real fix was sending 'resume' after
  // protocol handshake (see MinecraftDebugClient._handleProtocolEvent)
  #delayDebugClientUntilPlayerJoins: boolean = false;
  // Track if at least one player has joined since server start
  // Used to know when it's safe to start debug streaming
  #hasPlayerJoined: boolean = false;

  // Whether to launch BDS in Minecraft Editor mode (passes Editor=true arg)
  #editorMode: boolean = false;

  // Associated managed world ID for the new backup system.
  // If set, backups will be stored in the WorldBackupManager structure.
  // If not set, backups use the legacy per-slot backup folder structure.
  #managedWorldId: string | undefined;

  // Last backup result for tracking what was backed up
  #lastBackupResult: IBackupResult | undefined;

  outputLines: OutputLine[] = [];

  #opList: string[] | undefined;
  #gameTest: string | undefined;

  public get opList() {
    return this.#opList;
  }

  public set opList(newOps) {
    this.#opList = newOps;
  }

  public get port() {
    return this.#port;
  }

  /**
   * Get the script debugger port for this server instance.
   * The debug port is the base port + 12, ensuring each slot has a unique debug port.
   * Slot 0: port 19132 -> debug port 19144
   * Slot 1: port 19164 -> debug port 19176
   * etc.
   */
  public get debugPort(): number {
    const basePort = this.#port ?? 19132;
    return basePort + 12; // Debug port offset is 12 from base port
  }

  public get lastResult() {
    return this.#lastResult;
  }

  public set port(newPort) {
    this.#port = newPort;
  }

  public get editorMode(): boolean {
    return this.#editorMode;
  }

  public set editorMode(value: boolean) {
    this.#editorMode = value;
  }

  public get defaultWorldFolder() {
    if (!this.#defaultWorldStorage) {
      return undefined;
    }

    return this.#defaultWorldStorage.rootFolder;
  }

  public get behaviorPacksFolder() {
    if (!this.#behaviorPacksStorage) {
      return undefined;
    }

    return this.#behaviorPacksStorage.rootFolder;
  }

  public get resourcePacksFolder() {
    if (!this.#resourcePacksStorage) {
      return undefined;
    }

    return this.#resourcePacksStorage.rootFolder;
  }

  /**
   * Get the behavior packs storage (NodeStorage) for file watching purposes.
   */
  public get behaviorPacksStorage(): NodeStorage | undefined {
    return this.#behaviorPacksStorage;
  }

  /**
   * Get the default world storage (NodeStorage) for file watching purposes.
   */
  public get defaultWorldStorage(): NodeStorage | undefined {
    return this.#defaultWorldStorage;
  }

  /**
   * Get the resource packs storage (NodeStorage) for file watching purposes.
   */
  public get resourcePacksStorage(): NodeStorage | undefined {
    return this.#resourcePacksStorage;
  }

  config: ServerConfigManager;
  properties: ServerPropertiesManager;

  deployCount: number = 0;

  #onServerOutput = new EventDispatcher<DedicatedServer, ServerMessage>();
  #onServerStarted = new EventDispatcher<DedicatedServer, string>();
  #onServerRefreshed = new EventDispatcher<DedicatedServer, string>();
  #onServerError = new EventDispatcher<DedicatedServer, string>();
  #onServerStarting = new EventDispatcher<DedicatedServer, string>();
  #onServerStopping = new EventDispatcher<DedicatedServer, string>();
  #onServerStopped = new EventDispatcher<DedicatedServer, string>();
  #onServerGameEvent = new EventDispatcher<DedicatedServer, object>();

  #onPlayerConnected = new EventDispatcher<DedicatedServer, Player>();
  #onPlayerDisconnected = new EventDispatcher<DedicatedServer, Player>();

  #onTestStarted = new EventDispatcher<DedicatedServer, string>();
  #onTestFailed = new EventDispatcher<DedicatedServer, string>();
  #onTestSucceeded = new EventDispatcher<DedicatedServer, string>();

  // Debug client events
  #onDebugConnected = new EventDispatcher<DedicatedServer, IDebugSessionInfo>();
  #onDebugDisconnected = new EventDispatcher<DedicatedServer, string>();
  #onDebugStats = new EventDispatcher<DedicatedServer, { tick: number; stats: IStatData[] }>();
  #onDebugPaused = new EventDispatcher<DedicatedServer, string>();
  #onDebugResumed = new EventDispatcher<DedicatedServer, void>();
  #onProfilerCapture = new EventDispatcher<DedicatedServer, IProfilerCaptureEvent>();

  #updateIds: { [id: string]: boolean } = {};

  constructor(
    name: string,
    dsm: ServerManager,
    env: LocalEnvironment,
    serverPath: string,
    worldBackupContainerFolder: IFolder
  ) {
    this.name = name;
    this.serverPath = serverPath;
    this.#worldBackupContainerFolder = worldBackupContainerFolder;
    this.#dsm = dsm;
    this.#env = env;

    this.config = new ServerConfigManager();
    this.config.ensureDefaultConfig();
    this.config.addCartoConfig();

    this.properties = new ServerPropertiesManager();

    this.handleClose = this.handleClose.bind(this);
    this.doRunningBackup = this.doRunningBackup.bind(this);
    this.startServer = this.startServer.bind(this);
    this.stopServer = this.stopServer.bind(this);
    this.directOutput = this.directOutput.bind(this);
    this.handleCommandRequest = this.handleCommandRequest.bind(this);
  }

  get worldStoragePath() {
    return (
      NodeStorage.ensureEndsWithDelimiter(this.serverPath) +
      "worlds" +
      NodeStorage.platformFolderDelimiter +
      "defaultWorld" +
      NodeStorage.platformFolderDelimiter
    );
  }

  public pushUpdates(additionalUpdates: any[]) {
    for (let i = 0; i < additionalUpdates.length; i++) {
      const update = additionalUpdates[i];
      const updateId = update.eventId;

      if (!updateId || !this.#updateIds[updateId]) {
        if (updateId) {
          this.#updateIds[updateId] = true;
        }

        this.#onServerGameEvent.dispatch(this, update);
        this.updates.push(update);
      }
    }
  }

  public get gameTest() {
    return this.#gameTest;
  }

  public set gameTest(newGameTest) {
    this.#gameTest = newGameTest;
  }

  public get status() {
    return this.#status;
  }

  public get onServerStarting() {
    return this.#onServerStarting.asEvent();
  }

  public get onServerStopping() {
    return this.#onServerStopping.asEvent();
  }

  public get onServerStopped() {
    return this.#onServerStopped.asEvent();
  }

  public get onServerRefreshed() {
    return this.#onServerRefreshed.asEvent();
  }

  public get onServerOutput() {
    return this.#onServerOutput.asEvent();
  }

  public get onServerGameEvent() {
    return this.#onServerGameEvent.asEvent();
  }

  public get onServerError() {
    return this.#onServerError.asEvent();
  }

  public get onServerStarted() {
    return this.#onServerStarted.asEvent();
  }

  public get onTestStarted() {
    return this.#onTestStarted.asEvent();
  }

  public get onTestFailed() {
    return this.#onTestFailed.asEvent();
  }

  public get onTestSucceeded() {
    return this.#onTestSucceeded.asEvent();
  }

  public get onPlayerConnected() {
    return this.#onPlayerConnected.asEvent();
  }

  public get onPlayerDisconnected() {
    return this.#onPlayerDisconnected.asEvent();
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

  public get debugClient() {
    return this.#debugClient;
  }

  public get debuggerEnabled() {
    return this.#enableDebugger;
  }

  public set debuggerEnabled(value: boolean) {
    this.#enableDebugger = value;
  }

  public get debuggerStreamingEnabled() {
    return this.#enableDebuggerStreaming;
  }

  public set debuggerStreamingEnabled(value: boolean) {
    this.#enableDebuggerStreaming = value;
  }

  /**
   * Get the managed world ID for this server.
   * If set, backups will use the WorldBackupManager system.
   */
  public get managedWorldId(): string | undefined {
    return this.#managedWorldId;
  }

  /**
   * Set the managed world ID for this server.
   * @param worldId The world ID from WorldBackupManager, or undefined to use legacy backups
   */
  public set managedWorldId(worldId: string | undefined) {
    this.#managedWorldId = worldId;
  }

  /**
   * Get the last backup result.
   */
  public get lastBackupResult(): IBackupResult | undefined {
    return this.#lastBackupResult;
  }

  handleCommandRequest(event: string, data: string) {
    const slargs = Utilities.splitUntil(data, "|", 1);

    this.runCommand(slargs[1], slargs[0]);
  }

  async runActionSet(actionSet: IActionSetData, requestId?: string): Promise<void> {
    if (!requestId) {
      requestId = "";
    }

    const actionData = JSON.stringify(actionSet);

    await this.runCommand("mct:runactions " + actionData, requestId);
  }

  async waitUntilStarted() {
    let waitTicks = 0;

    while (
      this.status !== DedicatedServerStatus.started &&
      this.status !== DedicatedServerStatus.stopped &&
      waitTicks < MaxTimeToWaitForServerToStart
    ) {
      await Utilities.sleep(5);
      waitTicks++;
    }

    if (waitTicks >= MaxTimeToWaitForServerToStart) {
      Log.message("Timed out waiting for server to start.");
    }
  }

  async runCommandImmediate(command: string, tokenId?: string, maxWaitMs?: number): Promise<string | undefined> {
    Log.message("Running command: " + command);
    let targetResultLine = this.outputLines.length;
    await this.writeToServer(command);

    // maxPolls / pollCount count 5 ms polling iterations, not Minecraft game ticks.
    const maxPolls = maxWaitMs ? Math.ceil(maxWaitMs / 5) : 500;
    let pollCount = 0;

    if (tokenId) {
      let foundLineIndex = -1;
      while (foundLineIndex < 0 && pollCount < maxPolls) {
        await Utilities.sleep(5);

        for (let i = targetResultLine; i < this.outputLines.length; i++) {
          if (this.outputLines[i].message.indexOf(tokenId) >= 0) {
            foundLineIndex = i;
          }
        }

        pollCount++;
      }

      if (foundLineIndex >= 0) {
        let result = this.outputLines[foundLineIndex].message;
        Log.message("Command run complete: " + command + "| Result: " + result);

        return result;
      }
    } else {
      while (targetResultLine >= this.outputLines.length && pollCount < maxPolls) {
        await Utilities.sleep(5);
        pollCount++;
      }

      if (this.outputLines.length > targetResultLine) {
        let result = this.outputLines[targetResultLine].message;
        Log.message("Command run complete: " + command + "| Result: " + result);

        return result;
      }
    }

    return undefined;
  }

  async runCommand(command: string, requestId?: string, isInternal?: boolean): Promise<void> {
    if (!requestId) {
      requestId = "";
    }

    const newCommand = this.#pendingCommands.length;

    this.#pendingCommands[newCommand] = command;
    this.#pendingRequestIds[newCommand] = requestId;
    this.#pendingCommandsInternal[newCommand] = isInternal === true;

    if (newCommand === this.#currentCommandId) {
      await this.executeNextCommand();
    }
  }

  /**
   * Run an internal command that doesn't show in logs.
   * Used for implementation details like querytarget polling.
   */
  async runInternalCommand(command: string, requestId?: string): Promise<void> {
    return this.runCommand(command, requestId, true);
  }

  async writeToServer(commandLine: string) {
    if (this.#activeStdIn === null) {
      Log.message("Could not find active stdin to run command '" + commandLine + "'.");
      return;
    }

    // Security: Sanitize command to prevent injection
    commandLine = SecurityUtilities.sanitizeCommand(commandLine);

    if (!SecurityUtilities.isCommandSafe(commandLine)) {
      Log.message("Command rejected as unsafe: " + commandLine);
      return;
    }

    await streamWrite(this.#activeStdIn, commandLine + "\n");
  }

  async ensureServerFolders() {
    if (!this.#behaviorPacksStorage) {
      this.#behaviorPacksStorage = new NodeStorage(
        NodeStorage.ensureEndsWithDelimiter(this.serverPath) + "development_behavior_packs",
        ""
      );

      await this.#behaviorPacksStorage.rootFolder.ensureExists();
    }

    if (!this.#resourcePacksStorage) {
      this.#resourcePacksStorage = new NodeStorage(
        NodeStorage.ensureEndsWithDelimiter(this.serverPath) + "development_resource_packs",
        ""
      );

      await this.#resourcePacksStorage.rootFolder.ensureExists();
    }

    if (!this.#defaultWorldStorage) {
      this.#defaultWorldStorage = new NodeStorage(this.worldStoragePath, "");

      await this.#defaultWorldStorage.rootFolder.ensureExists();
    }
  }

  async restoreLatestBackupWorld() {
    // If we have a managed world ID and the WorldBackupManager is available,
    // use the new restore system. Otherwise, fall back to legacy restore.
    if (this.#managedWorldId && this.#dsm.worldBackupManager && this.#defaultWorldStorage) {
      return await this.restoreManagedWorld();
    }

    // Legacy restore system
    const worldBackupContainerFolderExists = fs.existsSync(this.#worldBackupContainerFolder.fullPath);

    if (!worldBackupContainerFolderExists) {
      return false;
    }

    const folders = fs.readdirSync(this.#worldBackupContainerFolder.fullPath);

    let latestWorldName: string | undefined;
    let latestWorldDate = new Date(0, 0, 0);

    const operId = await this.#dsm.creatorTools.notifyOperationStarted(
      "Restoring world from '" + this.#worldBackupContainerFolder.fullPath + "'"
    );

    for (const folder of folders) {
      if (folder.startsWith("world") && folder.length === 19) {
        const dateStr = folder.substring(5);

        if (Utilities.isNumeric(dateStr)) {
          const fullPath =
            NodeStorage.ensureEndsWithDelimiter(this.#worldBackupContainerFolder.fullPath) +
            folder +
            NodeStorage.platformFolderDelimiter;

          const filesJsonPath = fullPath + "files.json";

          const filesJsonExists = fs.existsSync(filesJsonPath);

          const worldDate = Utilities.getDateFromStr(dateStr);

          if (filesJsonExists && worldDate.getTime() > latestWorldDate.getTime()) {
            latestWorldName = folder;
            latestWorldDate = worldDate;
          }
        }
      }
    }

    if (latestWorldName) {
      const lastBackupWorldFolder = this.#worldBackupContainerFolder.folders[latestWorldName];

      if (lastBackupWorldFolder && this.#defaultWorldStorage) {
        await this.#dsm.creatorTools.notifyStatusUpdate("Restoring world '" + lastBackupWorldFolder.name + "'");

        await (lastBackupWorldFolder as NodeFolder).copyContentsOut(this.#defaultWorldStorage.rootFolder);

        await this.#dsm.creatorTools.notifyOperationEnded(
          operId,
          "Completed restoring world '" + lastBackupWorldFolder.name + "'"
        );

        return true;
      }
    }

    await this.#dsm.creatorTools.notifyOperationEnded(operId, "Was not able to restore world.");
    return false;
  }

  /**
   * Restore the latest backup using the new WorldBackupManager system.
   */
  private async restoreManagedWorld(): Promise<boolean> {
    if (!this.#managedWorldId || !this.#dsm.worldBackupManager || !this.#defaultWorldStorage) {
      throw new Error("Managed restore requires managedWorldId and WorldBackupManager");
    }

    const world = this.#dsm.worldBackupManager.getWorld(this.#managedWorldId);
    if (!world) {
      Log.message(`No managed world found with ID ${this.#managedWorldId}`);
      return false;
    }

    await world.loadBackups();

    if (world.backups.length === 0) {
      Log.message(`No backups found for world ${this.#managedWorldId}`);
      return false;
    }

    // Get the latest backup
    const latestBackup = world.backups[world.backups.length - 1];

    const operId = await this.#dsm.creatorTools.notifyOperationStarted(
      `Restoring managed world '${world.friendlyName}' (${this.#managedWorldId})`
    );

    try {
      // Restore the latest backup
      await this.#dsm.worldBackupManager.restoreBackup(
        this.#managedWorldId,
        latestBackup.id,
        this.#defaultWorldStorage.rootFolder.fullPath
      );

      await this.#dsm.creatorTools.notifyOperationEnded(operId, `Completed restoring world '${world.friendlyName}'`);

      return true;
    } catch (error: any) {
      Log.error(`Failed to restore managed world: ${error.message}`);
      await this.#dsm.creatorTools.notifyOperationEnded(operId, `Failed to restore world: ${error.message}`);
      return false;
    }
  }

  async applyWorldSettings(mcworld: MCWorld, startInfo?: IMinecraftStartMessage) {
    if (startInfo?.worldSettings && startInfo.worldSettings.packageReferences) {
      for (let i = 0; i < startInfo.worldSettings.packageReferences.length; i++) {
        const packRefSet = startInfo.worldSettings.packageReferences[i];

        mcworld.ensurePackReferenceSet(packRefSet);

        if (packRefSet.resourcePackReferences.length > 0) {
          mcworld.deferredTechnicalPreviewExperiment = true;
        }

        if (packRefSet.behaviorPackReferences.length > 0) {
          mcworld.betaApisExperiment = true;
        }
      }
    }

    if (startInfo && startInfo.worldSettings) {
      // only apply world settings if the world has no world templates.
      if (
        startInfo.worldSettings.worldTemplateReferences === undefined ||
        startInfo.worldSettings.worldTemplateReferences.length <= 0
      ) {
        // console.log("Applying settings " + JSON.stringify(startInfo.worldSettings));
        mcworld.applyWorldSettings(startInfo?.worldSettings);
      }
    }

    await mcworld.save();
  }

  async getStorageFromPath(path: string): Promise<IStorage | undefined> {
    if (!fs.existsSync(path)) {
      return undefined;
    }

    const content = await NodeStorage.createFromPath(path);

    if (
      content instanceof NodeFile &&
      (path.endsWith(".mcpack") ||
        path.endsWith(".mcaddon") ||
        path.endsWith(".mcworld") ||
        path.endsWith(".zip") ||
        path.endsWith(".mcproject"))
    ) {
      const zs = await ZipStorage.loadFromFile(content);

      return zs;
    }

    return undefined;
  }

  async ensureWorld(startInfo?: IMinecraftStartMessage) {
    const worldServerStorage = new NodeStorage(this.worldStoragePath, "");

    const worldSourcePath = startInfo?.worldSettings?.worldContentPath;

    if (worldSourcePath) {
      let folder = await NodeStorage.createFromPathIncludingZip(worldSourcePath);

      if (folder) {
        await StorageUtilities.syncFolderTo(folder, worldServerStorage.rootFolder, false, false, false);
      }
    }

    const mcworld = new MCWorld();
    mcworld.folder = worldServerStorage.rootFolder;

    await mcworld.loadMetaFiles(false);

    await this.applyWorldSettings(mcworld, startInfo);
  }

  async ensureContentDeployed(startInfo?: IMinecraftStartMessage) {
    if (startInfo?.additionalContentPath) {
      let folder = await NodeStorage.createFromPathIncludingZip(startInfo.additionalContentPath);

      if (folder) {
        await this.deploy(folder, false, false);
      }
    }
  }

  async startServer(restartIfAlreadyRunning: boolean, start: IMinecraftServerStart | undefined) {
    if (start === undefined) {
      start = {
        worldSettings: this.#dsm.creatorTools.worldSettings,
        mode: DedicatedServerMode.auto,
        iagree: this.#env.iAgreeToTheMinecraftEndUserLicenseAgreementAndPrivacyStatementAtMinecraftDotNetSlashEula,
      };
    }

    if (
      this.#status === DedicatedServerStatus.launching ||
      this.#status === DedicatedServerStatus.started ||
      this.#status === DedicatedServerStatus.starting
    ) {
      if (restartIfAlreadyRunning) {
        await this.stopServer();
      } else {
        return;
      }
    }

    let rootPath = this.serverPath;

    this.#onServerStarting.dispatch(this, "");
    this.#status = DedicatedServerStatus.launching;

    const ns = new NodeStorage(rootPath, "");
    if (start.worldSettings?.backupType === BackupType.every2Minutes) {
      this.#backupInterval = setInterval(this.doRunningBackup, 120000);
    } else if (start.worldSettings?.backupType === BackupType.every5Minutes) {
      this.#backupInterval = setInterval(this.doRunningBackup, 300000);
    }

    if (this.#starts === 0) {
      await this.ensureServerFolders();

      this.properties.serverFolder = ns.rootFolder;
      this.properties.levelName = "defaultWorld";
      this.properties.contentLogFileEnabled = true;

      if (this.#port) {
        this.properties.serverPort = this.#port;
      }

      if (start && start.worldSettings) {
        this.properties.applyFromWorldSettings(start.worldSettings);

        // Apply debugger settings from worldSettings
        if (start.worldSettings.enableDebugger !== undefined) {
          this.#enableDebugger = start.worldSettings.enableDebugger;
        }
        if (start.worldSettings.enableDebuggerStreaming !== undefined) {
          this.#enableDebuggerStreaming = start.worldSettings.enableDebuggerStreaming;
        }
        if (start.worldSettings.isEditor !== undefined) {
          this.#editorMode = start.worldSettings.isEditor;
        }
      }

      await this.properties.writeFile();

      const configFolder = ns.rootFolder.ensureFolder("config");
      await configFolder.ensureExists();

      this.config.serverConfigFolder = configFolder;

      this.config.writeFiles();
    }

    // Use platform-aware path delimiter instead of hardcoded backslash
    rootPath = NodeStorage.ensureEndsWithDelimiter(rootPath);

    this.#env.utilities.validateFolderPath(rootPath);

    // Use platform-specific executable name
    const executableName = os.platform() === "win32" ? "bedrock_server.exe" : "bedrock_server";
    const fullPath = rootPath + executableName;

    // Verify the executable exists
    if (!fs.existsSync(fullPath)) {
      const errorMsg = `Server executable not found at ${fullPath}`;
      Log.fail(errorMsg);
      this.#status = DedicatedServerStatus.stopped;
      this.#onServerError.dispatch(this, errorMsg);
      return;
    }

    // Verify digital signature on Windows before starting the server
    if (os.platform() === "win32" && !start?.unsafeSkipSignatureValidation) {
      Log.message("Verifying digital signature of " + fullPath + "...");

      const sigResult = await LocalUtilities.verifyAuthenticodeSignature(fullPath);

      if (!sigResult.isValid) {
        const errorMsg =
          `Digital signature verification failed for ${fullPath}. ` +
          `Status: ${sigResult.status}. ${sigResult.error || ""}\n` +
          `This could indicate the file has been tampered with or corrupted.\n` +
          `If you trust this file, you can skip signature verification with --unsafe-skip-signature-validation.`;
        Log.fail(errorMsg);
        this.#status = DedicatedServerStatus.stopped;
        this.#onServerError.dispatch(this, errorMsg);
        return;
      }

      if (!sigResult.isMicrosoftSigned) {
        const errorMsg =
          `Digital signature verification: ${fullPath} is signed, but not by Microsoft/Mojang. ` +
          `Signer: ${sigResult.signer || "unknown"}\n` +
          `This could indicate the file is not an official Minecraft Dedicated Server.\n` +
          `If you trust this file, you can skip signature verification with --unsafe-skip-signature-validation.`;
        Log.fail(errorMsg);
        this.#status = DedicatedServerStatus.stopped;
        this.#onServerError.dispatch(this, errorMsg);
        return;
      }

      Log.message(`Signature verified: ${sigResult.signer}`);
    } else if (start?.unsafeSkipSignatureValidation) {
      Log.message("WARNING: Skipping digital signature verification as requested. This is unsafe.");
    }

    Log.message("Starting server from " + fullPath);

    // Kill any stale bedrock_server processes that may hold file locks on this slot
    this._killStaleProcesses(rootPath);

    // Set up spawn options - on Linux, we need LD_LIBRARY_PATH to find shared libraries
    const spawnOptions: { cwd?: string; env?: NodeJS.ProcessEnv } = {
      cwd: rootPath,
    };
    if (os.platform() !== "win32") {
      spawnOptions.env = {
        ...process.env,
        LD_LIBRARY_PATH: rootPath,
      };
    }

    const args: string[] = [];
    if (this.#editorMode) {
      args.push("Editor=true");
    }

    const childProcess = spawn(fullPath, args, spawnOptions);
    this.#status = DedicatedServerStatus.starting;

    childProcess.on("close", this.handleClose);

    this.#activeStdIn = childProcess.stdin;
    this.#activeProcess = childProcess;

    // Write PID file so we can find stale processes after a crash
    if (childProcess.pid) {
      this._writePidFile(rootPath, childProcess.pid);
    }

    this.directOutput(childProcess.stdout);
    this.directErrors(childProcess.stderr);

    Log.verbose(
      "Server '" +
        this.name +
        "' at '" +
        fullPath +
        "' launched" +
        (this.#editorMode ? " (Editor mode)" : "") +
        " (starts: " +
        this.#starts +
        ")."
    );
  }

  async executeNextCommand() {
    if (this.#currentCommandId < this.#pendingCommands.length) {
      this.#currentCommandId++;

      const nextCommand = this.#currentCommandId - 1;

      const commandLine = this.#pendingCommands[nextCommand];
      const isInternal = this.#pendingCommandsInternal[nextCommand];

      // Only log non-internal commands
      if (!isInternal) {
        Log.message("Command " + this.#currentCommandId + " sent:" + commandLine);
      }

      await this.writeToServer(commandLine);

      await this.executeNextCommand();
    }
  }

  async doRunningBackup() {
    if (
      this.#backupStatus === DedicatedServerBackupStatus.none ||
      this.#backupStatus === DedicatedServerBackupStatus.saveResumed
    ) {
      this.#backupStatus = DedicatedServerBackupStatus.suspendingSaveCommandIssued;

      // Set a timeout to prevent backup from getting stuck if server doesn't respond
      // If backup doesn't complete within 60 seconds, force resume save
      if (this.#backupTimeoutTimer) {
        clearTimeout(this.#backupTimeoutTimer);
      }
      this.#backupTimeoutTimer = setTimeout(async () => {
        if (
          this.#backupStatus !== DedicatedServerBackupStatus.none &&
          this.#backupStatus !== DedicatedServerBackupStatus.saveResumed
        ) {
          Log.error("Backup timed out after 60 seconds - forcing save resume");
          this.#backupStatus = DedicatedServerBackupStatus.none;
          await this.runCommand("save resume");
        }
      }, 60000);

      await this.runCommand("save hold");
    }
  }

  async doBackup(backupFileLine?: string) {
    // If we have a managed world ID and the WorldBackupManager is available,
    // use the new backup system. Otherwise, fall back to legacy backup.
    if (this.#managedWorldId && this.#dsm.worldBackupManager && this.#defaultWorldStorage) {
      await this.doManagedBackup(backupFileLine);
      return;
    }

    // Legacy backup system
    const worldPath = "world" + Utilities.getDateStr(new Date());

    const backupFolder = this.#worldBackupContainerFolder.ensureFolder(worldPath);

    await backupFolder.ensureExists();

    const inclusionList: IFilePathAndSize[] = [];

    if (backupFileLine) {
      const items = backupFileLine.split(", ");

      for (let i = 0; i < items.length; i++) {
        const fileItem = items[i].split(":");

        if (fileItem.length === 2) {
          let size = undefined;
          let path = fileItem[0];

          const firstSlash = path.indexOf("/");

          if (firstSlash > 0) {
            path = path.substring(firstSlash + 1);
          }

          try {
            size = parseInt(fileItem[1]);
          } catch (e) {
            Log.verbose("Failed to parse backup file size: " + e);
          }

          if (size !== undefined && firstSlash > 0) {
            inclusionList.push({ path: path, size: size });
          }
        }
      }
    }

    if (this.#defaultWorldStorage) {
      Log.message(
        "Backing world up to '" + this.#defaultWorldStorage.rootFolder.fullPath + "' to '" + backupFolder.fullPath + "'"
      );

      await (this.#defaultWorldStorage.rootFolder as NodeFolder).copyContentsTo(
        backupFolder.fullPath,
        inclusionList,
        backupFileLine === undefined,
        this.#dsm.backupWorldFileListings,
        StorageUtilities.ensureStartsWithDelimiter(
          StorageUtilities.ensureEndsWithDelimiter(
            this.#worldBackupContainerFolder.name + StorageUtilities.standardFolderDelimiter + worldPath
          )
        )
      );
    }

    if (inclusionList) {
      await (backupFolder as NodeFolder).saveFilesList(worldPath, inclusionList);
    }
  }

  /**
   * Create a backup using the new WorldBackupManager system.
   * This provides better organization, deduplication, and export capabilities.
   */
  private async doManagedBackup(backupFileLine?: string) {
    if (!this.#managedWorldId || !this.#dsm.worldBackupManager || !this.#defaultWorldStorage) {
      throw new Error("Managed backup requires managedWorldId and WorldBackupManager");
    }

    // Parse the inclusion list from the server's save query response
    const inclusionList: IFilePathAndSize[] = [];

    if (backupFileLine) {
      const items = backupFileLine.split(", ");

      for (let i = 0; i < items.length; i++) {
        const fileItem = items[i].split(":");

        if (fileItem.length === 2) {
          let size = undefined;
          let path = fileItem[0];

          const firstSlash = path.indexOf("/");

          if (firstSlash > 0) {
            path = path.substring(firstSlash + 1);
          }

          try {
            size = parseInt(fileItem[1]);
          } catch (e) {
            Log.verbose("Failed to parse backup file size: " + e);
          }

          if (size !== undefined && firstSlash > 0) {
            inclusionList.push({ path: path, size: size });
          }
        }
      }
    }

    Log.message(`Creating managed backup for world ${this.#managedWorldId}`);

    // Determine backup type based on server state
    const backupType =
      backupFileLine !== undefined
        ? WorldBackupType.runtime // Incremental during runtime
        : WorldBackupType.shutdown; // Full backup on shutdown

    const result = await this.#dsm.worldBackupManager.createBackup(
      this.#managedWorldId,
      this.#defaultWorldStorage.rootFolder.fullPath,
      {
        backupType: backupType,
        incrementalFileList: inclusionList.length > 0 ? inclusionList : undefined,
        notes: backupType === WorldBackupType.shutdown ? "Server shutdown backup" : "Runtime incremental backup",
      }
    );

    this.#lastBackupResult = result;

    if (result.stats) {
      Log.message(
        `Managed backup complete: ${result.stats.newFiles} files written, ${result.stats.deduplicatedFiles} files deduped, ` +
          `${result.stats.totalBytes} bytes written, ${result.stats.savedBytes} bytes saved`
      );
    } else {
      Log.message(`Managed backup complete: ${result.success ? "success" : "failed"}`);
    }
  }

  async stopServer() {
    if (this.#activeProcess !== null) {
      Log.message("Stopping server '" + this.name + "'...");
      this.#onServerStopping.dispatch(this, "stop");

      const proc = this.#activeProcess;
      await this.writeToServer("stop");

      // Force-kill if the process doesn't exit within 10 seconds
      const forceKillTimer = setTimeout(() => {
        if (this.#activeProcess === proc && proc.pid) {
          Log.debug(`Server '${this.name}' did not exit gracefully after 10s, force-killing PID ${proc.pid}`);
          try {
            process.kill(proc.pid, "SIGKILL");
          } catch {
            // Already exited
          }
        }
      }, 10000);

      // Clean up timer if process exits normally
      proc.once("exit", () => clearTimeout(forceKillTimer));
    }
  }

  private static readonly PID_FILE_NAME = "bedrock_server.pid";

  /**
   * Kill stale bedrock_server processes left over from a previous crash.
   * Uses a PID file in the slot directory instead of platform-specific process
   * enumeration tools (wmic, PowerShell, pgrep), keeping this pure Node.js.
   */
  private _killStaleProcesses(slotPath: string): void {
    const pidFilePath = slotPath + DedicatedServer.PID_FILE_NAME;

    try {
      if (!fs.existsSync(pidFilePath)) {
        return;
      }

      const pidStr = fs.readFileSync(pidFilePath, "utf8").trim();
      const pid = parseInt(pidStr, 10);

      if (!pid || isNaN(pid)) {
        this._removePidFile(slotPath);
        return;
      }

      // Don't kill our own active process
      if (this.#activeProcess && this.#activeProcess.pid === pid) {
        return;
      }

      // Check if the process is still running (signal 0 = existence check)
      try {
        process.kill(pid, 0);
      } catch {
        // Process is not running — just clean up the stale PID file
        this._removePidFile(slotPath);
        return;
      }

      // On Linux, verify the PID is actually bedrock_server to guard against
      // PID reuse — /proc/<pid>/comm contains the process name.
      if (os.platform() !== "win32") {
        try {
          const comm = fs.readFileSync(`/proc/${pid}/comm`, "utf8").trim();
          if (comm !== "bedrock_server") {
            Log.debug(`PID ${pid} is now '${comm}', not bedrock_server — cleaning up stale PID file`);
            this._removePidFile(slotPath);
            return;
          }
        } catch {
          // /proc entry unreadable — process may have exited between checks
          this._removePidFile(slotPath);
          return;
        }
      }

      Log.debug(`Killing stale bedrock_server process (PID ${pid}) in slot ${slotPath}`);
      try {
        process.kill(pid, "SIGKILL");
      } catch {
        // Process may have already exited
      }

      this._removePidFile(slotPath);
    } catch {
      // PID file read/cleanup failed — not critical
    }
  }

  private _writePidFile(slotPath: string, pid: number): void {
    try {
      fs.writeFileSync(slotPath + DedicatedServer.PID_FILE_NAME, pid.toString(), "utf8");
    } catch {
      // Non-critical — stale process detection will just be unavailable next restart
    }
  }

  private _removePidFile(slotPath: string): void {
    try {
      const pidFilePath = slotPath + DedicatedServer.PID_FILE_NAME;
      if (fs.existsSync(pidFilePath)) {
        fs.unlinkSync(pidFilePath);
      }
    } catch {
      // Non-critical
    }
  }

  private async handleClose() {
    if (this.#activeProcess) {
      this.#dsm.creatorTools.notifyStatusUpdate("Server was closed unexpectedly.");

      this.#unexpectedStopLog.push(new Date());

      const statusBefore = this.#status;

      this.#activeProcess = null;

      await this.finalizeStopServer();

      // Try to ensure that we're not restarting the server in an endless loop.
      // Use exponential backoff: 1s, 2s, 4s, 8s delays between restarts.
      // Only try to restart up to 4 times in a 60 second window.
      const recentStarts = this.getRecentStarts(60000);

      if (recentStarts < 4) {
        // Calculate backoff delay: 2^(recentStarts-1) seconds, starting at 1 second
        const backoffMs = Math.min(1000 * Math.pow(2, recentStarts), 16000);

        this.#dsm.creatorTools.notifyStatusUpdate(
          `Restarting server in ${backoffMs / 1000}s (recent stops: ${recentStarts})`
        );

        if (statusBefore === DedicatedServerStatus.started) {
          await Utilities.sleep(backoffMs);
          await this.startServer(true, undefined);
        }
      } else {
        this.#dsm.creatorTools.notifyStatusUpdate(
          "Restarted too many times in a 60 second window; not auto-restarting."
        );
      }
    }
  }

  private getRecentStarts(timeWindowMs: number) {
    const now = new Date();

    let recents = 0;

    for (let i = 0; i < this.#unexpectedStopLog.length; i++) {
      if (now.getTime() - this.#unexpectedStopLog[i].getTime() < timeWindowMs) {
        recents++;
      }
    }

    return recents;
  }

  async continueStopServer() {
    if (this.#activeProcess !== null) {
      const proc = this.#activeProcess;

      this.#activeProcess = null;

      await onExit(proc);

      await this.finalizeStopServer();
    }
  }

  async finalizeStopServer() {
    if (this.#backupInterval) {
      clearTimeout(this.#backupInterval);
      this.#backupInterval = undefined;
    }

    // Clear backup timeout if one is pending
    if (this.#backupTimeoutTimer) {
      clearTimeout(this.#backupTimeoutTimer);
      this.#backupTimeoutTimer = undefined;
    }

    // Stop player position polling
    this.stopPlayerPositionPolling();

    // Disconnect the debug client
    this.disconnectDebugClient();

    // Remove PID file since the server is no longer running
    this._removePidFile(NodeStorage.ensureEndsWithDelimiter(this.serverPath));

    await this.doBackup();

    this.#onServerStopped.dispatch(this, "stop");
    this.#status = DedicatedServerStatus.stopped;
    Log.message("Server '" + this.name + "' stopped.");
  }

  async deploy(fromFolder: IFolder, isPatch: boolean, isReloadable?: boolean) {
    const originalStatus = this.#status;
    let filesConsidered = 0;
    let filesUpdated = 0;
    let wroteWorld = false;

    // Notify deployment is starting
    Log.important("Starting deployment from '" + fromFolder.fullPath + "'...");
    await this.#dsm.creatorTools?.notifyStatusUpdate("Starting deployment...");

    await fromFolder.load(true);

    // if our from folder has an explicit build folder, use that
    if (fromFolder.folders["build"]) {
      fromFolder = fromFolder.folders["build"];

      await fromFolder.load(true);
    } else if (fromFolder.folders["out"]) {
      fromFolder = fromFolder.folders["out"];

      await fromFolder.load(true);
    } else if (fromFolder.folders["dist"]) {
      fromFolder = fromFolder.folders["dist"];

      await fromFolder.load(true);
    }

    if (!this.#dsm.creatorTools) {
      Log.fail("Could not find associated context in dedicated server::deploy.");
      return;
    }

    // Hot-reload strategy (Feb 2026):
    // - First deploy (deployCount === 0): always restart to register pack references with the world
    // - Subsequent deploys: auto-detect if hot-reload is safe via thumbprint diff
    //   - Script-only changes (.js/.ts/.map, no deletions) → hot-reload via /reload command
    //   - Resource pack changes → force restart (line ~1694)
    //   - Non-script behavior pack changes → force restart (isReloadableSetOfChanges check)
    // - Caller can explicitly disable hot-reload by passing isReloadable=false
    // - Server must be running for hot-reload to be possible
    let doReload = this.deployCount > 0 && isReloadable !== false;

    if (originalStatus !== DedicatedServerStatus.started) {
      doReload = false;
    }

    if (doReload) {
      Log.message("Considering hot-reload for this deployment (deploy #" + this.deployCount + ")");
    }

    Log.message("Deploying from '" + fromFolder.fullPath + "'");

    let deployProj = new Project(this.#dsm.creatorTools, "deploy", null);
    deployProj.setProjectFolder(fromFolder);
    await deployProj.inferProjectItemsFromFiles();

    // if we've somehow detected a build folder besides the checks above, use that.
    if (deployProj.distBuildFolder) {
      fromFolder = deployProj.distBuildFolder;

      deployProj = new Project(this.#dsm.creatorTools, "deploy", null);
      deployProj.setProjectFolder(fromFolder);

      await deployProj.inferProjectItemsFromFiles();
    }

    let originalBehaviorPackTargetThumbprint = undefined;
    let originalResourcePackTargetThumbprint = undefined;

    if (doReload) {
      if (this.#behaviorPacksStorage) {
        originalBehaviorPackTargetThumbprint = new Thumbprint();
        await originalBehaviorPackTargetThumbprint.create(this.#behaviorPacksStorage.rootFolder);
      }
      if (this.#resourcePacksStorage) {
        originalResourcePackTargetThumbprint = new Thumbprint();
        await originalResourcePackTargetThumbprint.create(this.#resourcePacksStorage.rootFolder);
      }
    }

    this.#status = DedicatedServerStatus.deploying;

    await this.ensureServerFolders();

    if (this.#behaviorPacksStorage && this.#defaultWorldStorage) {
      let folderName = undefined;

      const bpFolder = await deployProj.getDefaultBehaviorPackFolder();

      if (bpFolder !== null) {
        folderName = StorageUtilities.getAvailableFolderName(bpFolder);
        Log.message("Deploying default behavior pack from '" + folderName + "'");

        const defaultBehaviorPackFolder = this.#behaviorPacksStorage.rootFolder.ensureFolder(folderName);

        await defaultBehaviorPackFolder.ensureExists();

        /*Log.message(
          "Synchronizing '" +
            deployProj.defaultBehaviorPackFolder.fullPath +
            "' to '" +
            defaultBehaviorPackFolder.fullPath +
            "'"
        );*/

        filesConsidered += await StorageUtilities.syncFolderTo(
          bpFolder,
          defaultBehaviorPackFolder,
          false,
          false,
          false
        );
      }

      if (fromFolder.folders["development_behavior_packs"]) {
        const dbpSourceFolder = fromFolder.folders["development_behavior_packs"];

        Log.message(
          "Synchronizing all dev BP folders from '" +
            dbpSourceFolder.fullPath +
            "' to '" +
            this.#behaviorPacksStorage.rootFolder.fullPath +
            "'"
        );
        filesConsidered += await StorageUtilities.syncFolderTo(
          dbpSourceFolder,
          this.#behaviorPacksStorage.rootFolder,
          false,
          false,
          false,
          folderName ? [folderName] : undefined
        );
      }

      if (fromFolder.folders["behavior_packs"]) {
        const dbpSourceFolder = fromFolder.folders["behavior_packs"];

        /*Log.message(
          "Synchronizing all BP folders from '" +
            dbpSourceFolder.fullPath +
            "' to '" +
            this.#behaviorPacksStorage.rootFolder.fullPath +
            "'"
        );*/

        filesConsidered += await StorageUtilities.syncFolderTo(
          dbpSourceFolder,
          this.#behaviorPacksStorage.rootFolder,
          false,
          false,
          false,
          folderName ? [folderName] : undefined
        );
      }

      /*
      const worldBehaviorPacks: IPackRegistration[] = [];

      worldBehaviorPacks.push({
        pack_id: deployProj.defaultBehaviorPackUniqueId,
        version: [0, 0, 1],
      });*/

      await this.#behaviorPacksStorage.rootFolder.saveAll();
    }

    if (this.#resourcePacksStorage && this.#defaultWorldStorage) {
      let folderName = undefined;

      const rpFolder = await deployProj.getDefaultResourcePackFolder();

      if (rpFolder !== null) {
        folderName = StorageUtilities.getAvailableFolderName(rpFolder);

        const defaultResourcePackFolder = this.#resourcePacksStorage.rootFolder.ensureFolder(folderName);

        await defaultResourcePackFolder.ensureExists();

        /*Log.message(
          "Synchronizing '" +
            deployProj.defaultBehaviorPackFolder.fullPath +
            "' to '" +
            defaultBehaviorPackFolder.fullPath +
            "'"
        );*/

        filesConsidered += await StorageUtilities.syncFolderTo(
          rpFolder,
          defaultResourcePackFolder,
          false,
          false,
          false
        );
      }

      if (fromFolder.folders["development_resource_packs"]) {
        const drpSourceFolder = fromFolder.folders["development_resource_packs"];

        Log.message(
          "Synchronizing all dev RP folders from '" +
            drpSourceFolder.fullPath +
            "' to '" +
            this.#resourcePacksStorage.rootFolder.fullPath +
            "'"
        );
        filesConsidered += await StorageUtilities.syncFolderTo(
          drpSourceFolder,
          this.#resourcePacksStorage.rootFolder,
          false,
          false,
          false,
          folderName ? [folderName] : undefined
        );
      }

      if (fromFolder.folders["resource_packs"]) {
        const drpSourceFolder = fromFolder.folders["resource_packs"];

        /*Log.message(
          "Synchronizing all BP folders from '" +
            dbpSourceFolder.fullPath +
            "' to '" +
            this.#behaviorPacksStorage.rootFolder.fullPath +
            "'"
        );*/

        filesConsidered += await StorageUtilities.syncFolderTo(
          drpSourceFolder,
          this.#resourcePacksStorage.rootFolder,
          false,
          false,
          false,
          folderName ? [folderName] : undefined
        );
      }

      /*
      const worldResourcePacks: IPackRegistration[] = [];

      worldResourcePacks.push({
        pack_id: deployProj.defaultResourcePackUniqueId,
        version: [0, 0, 1],
      });*/

      await this.#resourcePacksStorage.rootFolder.saveAll();
    }

    if (this.#defaultWorldStorage) {
      const worldFolder = await deployProj.getDefaultWorldFolder();

      if (worldFolder !== null) {
        if (!worldFolder.isLoaded) {
          await worldFolder.load();
        }

        if (worldFolder.fileCount > 0) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          filesConsidered += await StorageUtilities.syncFolderTo(
            worldFolder,
            this.#defaultWorldStorage.rootFolder,
            false,
            false,
            false
          );
          wroteWorld = true;
          this.#defaultWorldStorage.rootFolder.saveAll();
        }
      }
    }

    let nextResourcePackThumbprint = undefined;

    if (doReload && this.#resourcePacksStorage && originalResourcePackTargetThumbprint && this.deployCount > 0) {
      nextResourcePackThumbprint = new Thumbprint();
      await nextResourcePackThumbprint.create(this.#resourcePacksStorage.rootFolder);

      if (nextResourcePackThumbprint) {
        const diffSet = originalResourcePackTargetThumbprint.compare(nextResourcePackThumbprint, true);
        filesUpdated += diffSet.fileDifferences.length;

        if (diffSet.fileDifferences.length > 0 || diffSet.folderDifferences.length > 0) {
          Log.message(
            "Resource pack changes detected (" +
              diffSet.fileDifferences.length +
              " files) — hot-reload disabled, will restart."
          );
          doReload = false;
        }
      }
    }

    let nextBehaviorPackThumbprint = undefined;

    if (doReload && this.#behaviorPacksStorage && originalBehaviorPackTargetThumbprint && this.deployCount > 0) {
      nextBehaviorPackThumbprint = new Thumbprint();
      await nextBehaviorPackThumbprint.create(this.#behaviorPacksStorage.rootFolder);

      if (nextBehaviorPackThumbprint) {
        const diffSet = originalBehaviorPackTargetThumbprint.compare(nextBehaviorPackThumbprint, true);
        filesUpdated += diffSet.fileDifferences.length;

        if (!MinecraftUtilities.isReloadableSetOfChanges(diffSet)) {
          Log.message(
            "Non-script behavior pack changes detected (" +
              diffSet.fileDifferences.length +
              " files) — hot-reload disabled, will restart."
          );
          doReload = false;
        } else {
          Log.message(
            "Script-only behavior pack changes detected (" +
              diffSet.fileDifferences.length +
              " files) — hot-reload eligible."
          );
        }
      }
    }

    // Always ensure pack references are added to the world, regardless of reload mode
    // This must happen on every deploy, not just when server restarts
    if (this.#defaultWorldStorage && !wroteWorld) {
      const hasScript = await deployProj.hasScript();
      const mcworld = new MCWorld();

      mcworld.folder = this.#defaultWorldStorage.rootFolder;

      await mcworld.loadMetaFiles(false);

      let needsSave =
        mcworld.ensureBehaviorPack(
          deployProj.defaultBehaviorPackUniqueId,
          deployProj.defaultBehaviorPackVersion,
          deployProj.name
        ) ||
        mcworld.ensureResourcePack(
          deployProj.defaultResourcePackUniqueId,
          deployProj.defaultResourcePackVersion,
          deployProj.name
        );

      if (hasScript) {
        if (!mcworld.betaApisExperiment) {
          mcworld.betaApisExperiment = true;

          needsSave = true;
        }
      }

      if (needsSave) {
        Log.message("Updating world pack references for deployed packs.");
        await mcworld.save();
      }
    }

    if (!doReload || originalStatus !== DedicatedServerStatus.started) {
      if (originalStatus === DedicatedServerStatus.stopped) {
        Log.message("Starting world after deployment.");
        await this.#dsm.creatorTools?.notifyStatusUpdate("Starting server after deployment...");
      } else if (doReload) {
        Log.message("Server needs restarting due to significant file change.");
        await this.#dsm.creatorTools?.notifyStatusUpdate("Restarting server due to file changes...");
      } else {
        Log.message("Ensuring world is started after deployment (" + originalStatus + ")");
        await this.#dsm.creatorTools?.notifyStatusUpdate("Restarting server for deployment...");
      }

      if (originalStatus !== DedicatedServerStatus.stopped) {
        this.#status = DedicatedServerStatus.stopped;
        await this.stopServer();
      }

      await this.startServer(true, undefined);
      this.deployCount++;

      // Wait for server to actually be ready before reporting completion
      await this.waitUntilStarted();

      if (this.status === DedicatedServerStatus.started) {
        Log.important("Deployment complete. Server restarted and ready.");
        await this.#dsm.creatorTools?.notifyStatusUpdate("Deployment complete. Server restarted.");
      } else {
        Log.message("Deployment complete but server may still be starting (status: " + this.status + ")");
        await this.#dsm.creatorTools?.notifyStatusUpdate("Deployment complete. Server starting...");
      }
    } else if (filesUpdated === 0) {
      this.#status = DedicatedServerStatus.started;
      Log.important("No new files deployed.");
      await this.#dsm.creatorTools?.notifyStatusUpdate("Deployment complete. No new files.");
      await this.runCommand("say World has been reloaded.");
      this.#onServerRefreshed.dispatch(this, "reload");
    } else {
      this.#status = DedicatedServerStatus.started;

      Log.important(
        filesUpdated + " files updated; hot-reloading world '" + this.name + "' at " + new Date().toString()
      );
      await this.#dsm.creatorTools?.notifyStatusUpdate("Hot-reloading " + filesUpdated + " files...");
      await this.runCommand("reload");
      await this.runCommand("say World has been reloaded.");
      Log.important("Deployment complete. World hot-reloaded.");
      await this.#dsm.creatorTools?.notifyStatusUpdate("Deployment complete. World hot-reloaded.");
      this.#onServerRefreshed.dispatch(this, "reload");
    }
  }

  async directOutput(readable: Readable) {
    let time = new Date().getTime();

    for await (const line of chunksToLinesAsync(readable)) {
      if (line !== undefined && line.length >= 0) {
        let lineUp = line.replace(/\\n/g, "");
        lineUp = lineUp.replace(/\\r/g, "").trim();

        let port = this.port;

        if (!port) {
          port = 19132;
        }

        const sm = new ServerMessage(lineUp);

        // Use verbose logging for per-line BDS output to avoid double-logging
        // in serve mode (where the Ink UI already renders these via onServerOutput).
        // Important messages (server started, errors) are logged separately at message level.
        if (sm.category !== ServerMessageCategory.internalSystemMessage) {
          Log.verbose(this.name + "@" + port + ": " + lineUp);
        }

        if (sm.category === ServerMessageCategory.serverStarted) {
          this.#starts++;

          // EXPERIMENT: Delay the ENTIRE debugger setup (including `script debugger listen`)
          // until after a player joins. This tests if the debugger listen command itself
          // is what blocks player connections.
          if (this.#enableDebugger && this.#enableDebuggerStreaming) {
            if (this.#delayDebugClientUntilPlayerJoins) {
              Log.debug(`[Debug] Debugger enabled but DELAYING 'script debugger listen' until player joins`);
              this.#debugListenerReady = false; // Mark as not ready yet
            } else {
              // Original behavior: send command after server start
              const me = this;
              const debugPort = this.debugPort;
              setTimeout(async function () {
                Log.debug(`[Debug] Sending 'script debugger listen ${debugPort}' command...`);
                me.#awaitingDebuggerListening = true;
                await me.runCommand(`script debugger listen ${debugPort}`);
                Log.debug(`[Debug] Command sent, waiting for 'Debugger listening' response...`);

                // Fallback timeout: if we don't receive "Debugger listening" within 10 seconds,
                // mark the listener as ready anyway (for cases where the message might not be sent)
                setTimeout(function () {
                  if (me.#awaitingDebuggerListening && me.#enableDebuggerStreaming) {
                    me.#awaitingDebuggerListening = false;
                    me.#debugListenerReady = true;
                    if (me.#delayDebugClientUntilPlayerJoins) {
                      Log.debug(`[Debug] Timeout waiting for 'Debugger listening', will connect when player joins...`);
                    } else {
                      Log.debug(`[Debug] Timeout waiting for 'Debugger listening', attempting connection anyway...`);
                      me.connectDebugClient();
                    }
                  }
                }, 10000);
              }, 3000); // 3 second delay before enabling debugger
            }
          }

          this.#status = DedicatedServerStatus.started;
          this.handleServerStarted(lineUp);
        } else if (sm.category === ServerMessageCategory.debuggerListening) {
          // Minecraft has confirmed the debug listener is ready
          if (this.#awaitingDebuggerListening) {
            this.#awaitingDebuggerListening = false;
            this.#debugListenerReady = true;

            if (this.#enableDebuggerStreaming) {
              // Check if we have any players connected already (post-player-join scenario)
              if (this.#delayDebugClientUntilPlayerJoins && !this.#hasPlayerJoined) {
                // No players yet - wait for them
                Log.debug(`[Debug] Debugger listening - waiting for player to join before connecting client`);
              } else {
                // Either not delaying, or player already joined (triggered debugger setup)
                Log.debug(`[Debug] Debugger listening, connecting debug client...`);
                this.connectDebugClient();
              }
            } else {
              Log.debug(`[Debug] Debugger listening, but streaming not enabled, skipping client connection`);
            }
          }
        } else if (sm.category === ServerMessageCategory.serverStopped) {
          await this.continueStopServer();
        } else if (sm.category === ServerMessageCategory.playerConnected) {
          const playerName = this.getPlayerIdFromLine(lineUp);
          const xuid = this.getPlayerXuidFromLine(lineUp);

          Log.message("Player '" + playerName + "' connected.");

          // Mark that at least one player has joined
          this.#hasPlayerJoined = true;

          // If we were waiting for a player to join before starting debug, do it now
          if (
            this.#enableDebugger &&
            this.#enableDebuggerStreaming &&
            !this.#debugClient &&
            this.#delayDebugClientUntilPlayerJoins
          ) {
            Log.debug(`[Debug] Player connected - NOW starting debugger setup (was delayed until player join)...`);
            const me = this;
            const debugPort = this.debugPort;

            // Start the debugger listen command now that a player has joined
            setTimeout(async function () {
              Log.debug(`[Debug] Sending 'script debugger listen ${debugPort}' command (post-player-join)...`);
              me.#awaitingDebuggerListening = true;
              await me.runCommand(`script debugger listen ${debugPort}`);
              Log.debug(`[Debug] Command sent, waiting for 'Debugger listening' response...`);

              // Fallback timeout
              setTimeout(function () {
                if (me.#awaitingDebuggerListening && me.#enableDebuggerStreaming) {
                  me.#awaitingDebuggerListening = false;
                  me.#debugListenerReady = true;
                  Log.debug(`[Debug] Timeout waiting for 'Debugger listening', connecting client anyway...`);
                  me.connectDebugClient();
                }
              }, 10000);
            }, 1000); // Small delay after player join
          }

          if (playerName && xuid) {
            const p = new Player();
            // Security: Sanitize player name to prevent path traversal
            p.id = SecurityUtilities.sanitizePlayerName(playerName);
            p.xuid = xuid;

            this.handlePlayerConnected(p);
          }
        } else if (sm.category === ServerMessageCategory.playerDisconnected) {
          const playerName = this.getPlayerIdFromLine(lineUp);
          const xuid = this.getPlayerXuidFromLine(lineUp);

          Log.message("Player '" + playerName + "' disconnected.");

          if (playerName && xuid) {
            const p = new Player();
            // Security: Sanitize player name to prevent path traversal
            p.id = SecurityUtilities.sanitizePlayerName(playerName);
            p.xuid = xuid;

            this.handlePlayerDisconnected(p);
          } // Changes to the world are resumed.
        } else if (
          sm.category === ServerMessageCategory.backupSaving &&
          this.#backupStatus === DedicatedServerBackupStatus.suspendingSaveCommandIssued
        ) {
          this.#backupStatus = DedicatedServerBackupStatus.suspendingQueryCommandIssued;
          this.runCommand("save query");
        } else if (
          sm.category === ServerMessageCategory.backupSaved &&
          this.#backupStatus === DedicatedServerBackupStatus.suspendingQueryCommandIssued
        ) {
          this.#backupStatus = DedicatedServerBackupStatus.suspendingQueryResultsPending;
        } else if (
          sm.category === ServerMessageCategory.levelDatUpdate &&
          this.#backupStatus === DedicatedServerBackupStatus.suspendingQueryResultsPending
        ) {
          this.#backupStatus = DedicatedServerBackupStatus.copyingFiles;
          await this.doBackup(lineUp);
          this.#backupStatus = DedicatedServerBackupStatus.resumingSave;
          this.runCommand("save resume");
        } else if (
          sm.category === ServerMessageCategory.backupComplete &&
          this.#backupStatus === DedicatedServerBackupStatus.resumingSave
        ) {
          this.#backupStatus = DedicatedServerBackupStatus.none;
          // Clear the backup timeout since backup completed successfully
          if (this.#backupTimeoutTimer) {
            clearTimeout(this.#backupTimeoutTimer);
            this.#backupTimeoutTimer = undefined;
          }
        } else if (sm.category === ServerMessageCategory.gameTestLoaded) {
          let testName = this.getTestIdFromLine(lineUp);
          if (testName === undefined) {
            testName = "(unknown test id)";
          }

          this.#onTestStarted.dispatch(this, testName);
        } else if (sm.category === ServerMessageCategory.gameTestFailed) {
          let testName = this.getTestIdFromLine(lineUp);
          if (testName === undefined) {
            testName = "(unknown test id)";
          }

          this.#onTestFailed.dispatch(this, testName);
        } else if (sm.category === ServerMessageCategory.gameTestPassed) {
          let testName = this.getTestIdFromLine(lineUp);
          if (testName === undefined) {
            testName = "(unknown test id)";
          }

          this.#onTestSucceeded.dispatch(this, testName);
        }

        this.#lastResult = lineUp;
        if (this.outputLines.length > 10000) {
          this.outputLines.splice(0, 5000);
        }
        this.outputLines.push({
          message: lineUp,
          received: time,
          isInternal: sm.category === ServerMessageCategory.internalSystemMessage,
        });
        time++;

        this.#onServerOutput.dispatch(this, sm);
      }
    }
  }

  handleServerStarted(line: string) {
    Log.message("handleServerStarted called: " + line);

    if (this.gameTest) {
      const me = this;

      setTimeout(async function () {
        Log.message("Running gametest " + me.gameTest);
        await me.writeToServer("gametest run " + me.gameTest);
      }, 5000);
    }

    // Start player position polling
    this.startPlayerPositionPolling();

    // Note: Debug client connection is now handled in directOutput() after
    // the "script debugger listen" command completes. This ensures proper
    // sequencing: server starts -> debugger listener starts -> client connects.

    this.#onServerStarted.dispatch(this, line);
  }

  /**
   * Connect to the Minecraft script debugger.
   * The server should already be listening on the debug port after
   * receiving the "script debugger listen <port>" command.
   */
  async connectDebugClient() {
    if (this.#debugClient) {
      Log.debug(`[Debug] connectDebugClient: Already have a debug client, skipping`);
      return;
    }

    const port = this.debugPort;
    Log.debug(`[Debug] connectDebugClient: Creating MinecraftDebugClient for localhost:${port}...`);

    // Note: We no longer need to wait here because we're triggered by the
    // "Debugger listening" message, which confirms the listener is ready.

    this.#debugClient = new MinecraftDebugClient();

    // Wire up debug client events
    this.#debugClient.onConnected.subscribe((client, sessionInfo) => {
      Log.debug(`[Debug] Debug client connected: protocol v${sessionInfo.protocolVersion}`);
      this.#onDebugConnected.dispatch(this, sessionInfo);
    });

    this.#debugClient.onDisconnected.subscribe((client, reason) => {
      Log.debug(`[Debug] Debug client disconnected: ${reason}`);
      this.#onDebugDisconnected.dispatch(this, reason);
    });

    this.#debugClient.onStats.subscribe((client, statsData) => {
      Log.verbose(`[Debug] DedicatedServer: Received stats tick=${statsData.tick}, stats=${statsData.stats.length}`);
      this.#onDebugStats.dispatch(this, statsData);
    });

    this.#debugClient.onStopped.subscribe((client, stoppedEvent) => {
      Log.verbose(`[Debug] Script execution paused: ${stoppedEvent.reason}`);
      this.#onDebugPaused.dispatch(this, stoppedEvent.reason);
    });

    this.#debugClient.onProfilerCapture.subscribe((client, captureEvent) => {
      Log.message(`[Debug] Profiler capture received: ${captureEvent.capture_base_path}`);
      this.#onProfilerCapture.dispatch(this, captureEvent);
    });

    this.#debugClient.onError.subscribe((client, error) => {
      Log.debug(`Debug client error: ${error}`);
    });

    try {
      Log.debug(`[Debug] connectDebugClient: Calling connect(localhost, ${this.debugPort})...`);
      await this.#debugClient.connect("localhost", this.debugPort);
      Log.debug(`[Debug] connectDebugClient: connect() returned successfully`);
    } catch (e) {
      Log.message(`[Debug] connectDebugClient: connect() FAILED: ${e}`);
      this.#debugClient = undefined;
    }
  }

  /**
   * Disconnect the debug client if connected.
   */
  disconnectDebugClient() {
    if (this.#debugClient) {
      this.#debugClient.disconnect();
      this.#debugClient = undefined;
    }
  }

  /**
   * Start polling for player positions.
   * Uses /querytarget @a to get all player positions periodically.
   */
  startPlayerPositionPolling() {
    if (this.#playerPositionPollInterval) {
      return; // Already polling
    }

    Log.message("Starting player position polling");

    const pollFn = async () => {
      if (this.#status !== DedicatedServerStatus.started) {
        return;
      }

      try {
        // Run querytarget @a to get all player positions
        // Note: The command output is multi-line, so we need to scan outputLines
        const startLineIndex = this.outputLines.length;
        await this.runInternalCommand("querytarget @a");

        // Wait a moment for output to accumulate
        await Utilities.sleep(500);

        // Scan recent output lines for "Target data:" and collect the JSON
        let jsonLines: string[] = [];
        let collecting = false;
        let bracketCount = 0;

        for (let i = startLineIndex; i < this.outputLines.length; i++) {
          const line = this.outputLines[i].message;

          // Look for "Target data:" to start collecting
          if (line.includes("Target data:")) {
            collecting = true;
            // Extract the part after "Target data:"
            const dataStart = line.indexOf("Target data:");
            const afterData = line.substring(dataStart + "Target data:".length).trim();
            if (afterData) {
              jsonLines.push(afterData);
              bracketCount += (afterData.match(/\[/g) || []).length;
              bracketCount -= (afterData.match(/\]/g) || []).length;
            }
            continue;
          }

          if (collecting) {
            // Skip timestamp prefixes like "[2025-12-29 15:06:24:053 INFO]"
            let cleanLine = line;
            if (cleanLine.match(/^\[\d{4}-\d{2}-\d{2}/)) {
              // This is a new log line, stop collecting
              break;
            }

            jsonLines.push(cleanLine);
            bracketCount += (cleanLine.match(/\[/g) || []).length;
            bracketCount -= (cleanLine.match(/\]/g) || []).length;

            // If brackets are balanced, we have complete JSON
            if (bracketCount === 0 && jsonLines.length > 0) {
              break;
            }
          }
        }

        if (jsonLines.length > 0) {
          const jsonStr = jsonLines.join("");
          Log.verbose("Collected JSON: " + jsonStr.substring(0, 100) + "...");

          if (jsonStr.startsWith("[")) {
            const players = JSON.parse(jsonStr) as Array<{
              uniqueId?: string;
              id?: number;
              dimension?: number;
              position?: { x: number; y: number; z: number };
              yRot?: number;
            }>;

            Log.verbose("Parsed " + players.length + " players from querytarget");

            for (const player of players) {
              if (player.uniqueId && player.position) {
                const playerId = player.uniqueId;
                const lastPos = this.#lastPlayerPositions.get(playerId);
                const newPos = player.position;
                const dimension = player.dimension ?? 0;

                // Check if the player moved significantly
                let shouldDispatch = !lastPos;
                if (lastPos) {
                  const dx = newPos.x - lastPos.x;
                  const dy = newPos.y - lastPos.y;
                  const dz = newPos.z - lastPos.z;
                  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
                  shouldDispatch = distance >= PLAYER_MOVE_THRESHOLD || dimension !== lastPos.dimension;
                }

                if (shouldDispatch) {
                  this.#lastPlayerPositions.set(playerId, { ...newPos, dimension });

                  // Get player name from connected players
                  const playerName = this.getPlayerNameFromId(playerId) ?? playerId;

                  Log.message("Dispatching player position update for " + playerName + " at " + JSON.stringify(newPos));

                  // Dispatch a PlayerTravelled-style event
                  const travelEvent = {
                    eventId: `poll_${Date.now()}_${playerId}`,
                    header: {
                      eventName: "PlayerTravelled",
                      purpose: "event",
                      version: 1,
                    },
                    body: {
                      isUnderwater: false,
                      metersTravelled: lastPos
                        ? Math.sqrt(
                            (newPos.x - lastPos.x) ** 2 + (newPos.y - lastPos.y) ** 2 + (newPos.z - lastPos.z) ** 2
                          )
                        : 0,
                      newBiome: 0,
                      player: {
                        color: "",
                        dimension: dimension,
                        id: player.id ?? 0,
                        name: playerName,
                        position: newPos,
                        type: "player",
                        variant: 0,
                        yRot: player.yRot ?? 0,
                      },
                      travelMethod: 0,
                    },
                  };

                  this.#onServerGameEvent.dispatch(this, travelEvent);
                }
              }
            }
          }
        }
      } catch (e) {
        // Ignore parse errors - querytarget may return error messages if no players
        Log.verbose("Player position poll error: " + e);
      }
    };

    // Start polling after a short delay and then on interval
    setTimeout(pollFn, 2000);
    this.#playerPositionPollInterval = setInterval(pollFn, PLAYER_POSITION_POLL_INTERVAL);
  }

  /**
   * Stop player position polling.
   */
  stopPlayerPositionPolling() {
    if (this.#playerPositionPollInterval) {
      clearInterval(this.#playerPositionPollInterval);
      this.#playerPositionPollInterval = undefined;
    }
    this.#lastPlayerPositions.clear();
  }

  /**
   * Get player name from uniqueId by looking up connected players.
   */
  getPlayerNameFromId(uniqueId: string): string | undefined {
    // The uniqueId from querytarget is a long integer as string
    // We need to match it against xuid in connected players
    // For now, just return undefined and use uniqueId
    return undefined;
  }

  handlePlayerConnected(player: Player) {
    if (this.#opList) {
      for (let i = 0; i < this.#opList.length; i++) {
        const op = this.#opList[i];
        const me = this;

        if (op === player.id) {
          setTimeout(async function () {
            await me.writeToServer("op " + player.id);
          }, 5000);
        }
      }
    }

    this.#onPlayerConnected.dispatch(this, player);
  }

  handlePlayerDisconnected(player: Player) {
    this.#onPlayerDisconnected.dispatch(this, player);
  }

  getTestIdFromLine(line: string) {
    const firstColon = line.indexOf(":");

    if (firstColon < 0) {
      return undefined;
    }

    let nextSpace = line.indexOf(" ", firstColon + 1);

    if (nextSpace < 0) {
      nextSpace = line.length;
    }

    return line.substring(firstColon + 1, nextSpace);
  }

  getPlayerIdFromLine(line: string) {
    const playerIndex = line.indexOf("Player ");

    if (playerIndex < 0) {
      return undefined;
    }

    const nextColon = line.indexOf(":", playerIndex);

    if (nextColon < 0) {
      return undefined;
    }

    const nextComma = line.indexOf(",", nextColon);
    if (nextComma < 0) {
      return undefined;
    }

    return line.substring(nextColon + 2, nextComma);
  }

  getPlayerXuidFromLine(line: string) {
    const xuidIndex = line.indexOf("xuid");

    if (xuidIndex < 0) {
      return undefined;
    }

    const nextColon = line.indexOf(":", xuidIndex);

    if (nextColon < 0) {
      return undefined;
    }

    let nextComma = line.indexOf(",", nextColon);
    if (nextComma < 0) {
      nextComma = line.length;
    }

    return line.substring(nextColon + 2, nextComma);
  }

  async directErrors(readable: Readable) {
    for await (const line of chunksToLinesAsync(readable)) {
      if (line !== undefined && line.length >= 0) {
        let lineUp = line.replace(/\\n/g, "");
        lineUp = lineUp.replace(/\\r/g, "");

        this.#onServerError.dispatch(this, lineUp);

        Log.message("Server error: " + lineUp);
      }
    }
  }
}
