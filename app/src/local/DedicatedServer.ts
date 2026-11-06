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
 * **Process identity invariant** (bug fixed Aug 2026 - keep this!): a restart
 * can launch a replacement process while the old process is still stopping
 * (stopServer() writes "stop" and returns without waiting for exit), so the
 * old stdout stream may still be draining buffered lines and the old process
 * has a close event yet to deliver. Every state mutation is therefore gated
 * on identity: directOutput() ignores state-mutating lines whose stream id
 * has been superseded (a delayed "Server started" from the old process must
 * not re-run debugger setup; a delayed "Quit correctly" must not
 * continueStopServer() the replacement's process handle away), and the close
 * handler registered by attachProcess() is bound to its specific
 * ChildProcess and no-ops unless that process is still #activeProcess.
 * Superseded output is still recorded/forwarded for display.
 *
 * ## Script Debugger Integration
 *
 * The debugger flow follows an explicit lifecycle model (DebuggerLifecycle.ts):
 * configuring -> startingListener -> waitingForReadiness -> connectingTcp ->
 * negotiating -> selectingTarget -> resuming -> connected, with reconnecting /
 * stopping / failed side states. Stage changes are dispatched via
 * onDebugStageChanged so the Electron/web UX can show precise progress and
 * stage-specific recovery actions.
 *
 * 1. On "Server started": verify server.properties debugger settings
 *    (allow-inbound-script-debugging), then wait DEBUG_LISTEN_DELAY_MS
 * 2. Reserve a collision-free dynamic debug port (DebugPortRegistry;
 *    preferred: base port + 12, e.g., 19144 for slot 0)
 * 3. Send `script debugger listen <port>` and wait for the parsed
 *    "Debugger listening" confirmation. If BDS never confirms (or prints
 *    "Failed to start debugger"), the flow FAILS with a specific error kind -
 *    there is deliberately no success-shaped fallback timeout
 * 4. Connect MinecraftDebugClient to localhost:<port> (if
 *    enableDebuggerStreaming=true); the client handles handshake, passcode,
 *    target module selection, and resume
 * 5. Forward debug events to ServerManager → HttpServer/IPC → clients
 *
 * **Configuration**:
 * - `enableDebugger` (default: true): Whether BDS enables script debugger listening
 * - `enableDebuggerStreaming` (default: true for serve command): Whether we connect and stream debug stats
 *
 * **Cleanup and reconnect invariants** (bugs fixed Aug 2026 - keep these!):
 * - All debugger timers are tracked in fields and cleared in
 *   resetDebuggerRuntimeState(); anonymous fire-and-forget timers previously
 *   leaked across stop/restart and poked dead server runs
 * - #debugClient is cleared on EVERY disconnect path (previously a dropped
 *   connection left a stale reference that blocked reconnection forever)
 * - Dropped connections reconnect with exponential backoff (max 5 attempts);
 *   passcode/protocol-mismatch failures fail fast instead of retrying
 * - stopServer() marks the lifecycle "stopping" BEFORE writing "stop" so the
 *   imminent socket close is not misclassified as a failure
 * - A handshake that completes with NO script module to select does not reset
 *   the reconnect budget: BDS closes module-less sessions right after the
 *   handshake, and resetting on that short-lived "connected" produced an
 *   endless connect/drop churn. The drop is classified moduleSelection (not
 *   prematureClose) so the user sees the actionable cause (add a behavior
 *   pack with a script module)
 * - Session info exposed via HTTP API: /api/{slot}/status includes debugConnectionState
 * - Reattach vs. in-flight attach race: a user-driven reattach can discard an
 *   automatic attach whose dial is still retrying. disconnect() cancels that
 *   dial (MinecraftDebugClient aborts its retry loop and destroys the pending
 *   socket), and every subscriber/post-await in connectDebugClient() is
 *   guarded by `#debugClient === client` identity so a superseded client can
 *   never mutate or clear its replacement's state, occupy BDS's single
 *   debugger slot, or cause a false external-owner classification.
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
import MinecraftDebugClient, { PROTOCOL_HANDSHAKE_TIMEOUT_MS } from "../debugger/MinecraftDebugClient";
import {
  IStatData,
  IDebugSessionInfo,
  IProfilerCaptureEvent,
  IDiagnosticsTabDescriptor,
  DebugAttachFailureReason,
  DebugConnectionState,
  DebugOwnershipState,
} from "../debugger/IMinecraftDebugProtocol";
import { deriveDebugOwnership } from "../debugger/DiagnosticsSchemaUtilities";
import { ISlotConfig } from "../app/CreatorToolsAuthentication";
import DebuggerLifecycleTracker, {
  DebuggerFailureKind,
  DebuggerLifecycleStage,
  IDebuggerDiagnostics,
  IDebuggerStageEventData,
  classifyDebugClientDisconnectReason,
  classifyDebuggerListenFailure,
  sanitizeDebuggerDiagnosticText,
} from "../debugger/DebuggerLifecycle";
import DebugPortRegistry, { IDebugPortReservation } from "../debugger/DebugPortRegistry";
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
  /**
   * Identity of the process output stream that produced this line. A restart
   * attaches a new stream (with a higher id) while the old one may still be
   * draining, so lines from different runs can interleave.
   */
  streamId?: number;
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

// Delay after "Server started" before issuing `script debugger listen`, so BDS
// finishes its startup work before taking the listener command.
const DEBUG_LISTEN_DELAY_MS = 3000;
// How long to wait for the parsed "Debugger listening" confirmation before the
// flow is marked failed. There is deliberately no success-shaped fallback: if
// BDS never confirms, we fail with a listener-readiness error, we do not
// pretend the listener is up and surface a misleading TCP error later.
const DEBUG_LISTENER_READY_TIMEOUT_MS = 15000;
// Reconnect backoff for dropped debug connections while the server still runs
const DEBUG_RECONNECT_MAX_ATTEMPTS = 5;
const DEBUG_RECONNECT_BASE_DELAY_MS = 2000;

// How long a restart waits for the previous child process to terminate
// before failing. stopServer force-kills after 10s, so exit is expected well
// inside this window; exceeding it means even SIGKILL did not take.
const PREVIOUS_PROCESS_EXIT_TIMEOUT_MS = 15000;

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
  // The in-flight stop finalization (process exit -> finalizeStopServer) of
  // the run being torn down. A restart must await this - not just the old
  // process's exit - because the same exit unblocks both the restart's
  // termination wait and the old run's finalization, whose backup can still
  // be pending when the replacement launches (see startServer).
  #stopFinalization: Promise<void> | undefined;
  // Generation of the published finalization; the settle handlers compare
  // this token (not promise identity) to decide whether they still own the
  // published slot.
  #stopFinalizationId: number = 0;
  // True while startServer's deliberate-restart teardown owns the old run's
  // lifecycle. handleClose then publishes its finalization for the restart
  // to await instead of running unexpected-stop bookkeeping and the
  // auto-restart loop against the incoming replacement.
  #restartInProgress: boolean = false;
  /**
   * Monotonic id of the CURRENT stdout stream (bumped each directOutput
   * attach). Lines from a superseded stream compare unequal and may not
   * mutate server state - see directOutput.
   */
  #outputStreamId: number = 0;

  /**
   * The PERSISTED allow-inbound/outbound-script-debugging values the last
   * debugger setup actually read and acted on (beginDebuggerSetup's
   * settings verification). undefined until a setup has read the file, or
   * when the file was unreadable / the key absent. Diagnostics report
   * THESE - the inputs of the runtime decision - never the in-memory
   * ServerPropertiesManager fields, which are write-intent defaults that
   * can disagree with what is on disk (a persisted false correctly fails
   * the settings stage while the in-memory default still claims true).
   * Cleared when a new run begins; they survive stop so a failed run's
   * diagnostics keep describing the values that failed it.
   */
  #effectiveInboundScriptDebugging: boolean | undefined;
  #effectiveOutboundScriptDebugging: boolean | undefined;
  #status: DedicatedServerStatus = DedicatedServerStatus.stopped;

  // Debug client for connecting to the Minecraft script debugger
  #debugClient: MinecraftDebugClient | undefined;
  // enableDebugger: Whether BDS enables script debugger listening
  // The debug port is selected dynamically (preferred: base port + 12)
  #enableDebugger: boolean = true;
  // enableDebuggerStreaming: Whether we connect to the debug port and stream stats to web console
  // Enabled by default. Set worldSettings.enableDebuggerStreaming=false to disable.
  #enableDebuggerStreaming: boolean = true;
  // Debug connection direction. true (default): MCT listens and BDS dials it
  // (`script debugger connect`) - required for current BDS builds, whose
  // inbound `script debugger listen` listener flaps (accept-then-reset every
  // few ticks) and cannot hold a connection. false: legacy inbound direction
  // (BDS listens, MCT dials), kept for older servers and for tests that
  // exercise the listen-confirmation flow.
  #debugOutboundConnect: boolean = true;
  // Explicit lifecycle/state model for the debugger flow (see DebuggerLifecycle.ts)
  #debuggerLifecycle = new DebuggerLifecycleTracker();
  // Set after 'script debugger listen' until BDS confirms "Debugger listening"
  #awaitingDebuggerListening: boolean = false;
  // Set once BDS has confirmed the listener is ready
  #debugListenerReady: boolean = false;
  // Single-flight guard for listener startup: concurrent entries (a user
  // Retry racing the reconnect timer) join this promise instead of
  // double-reserving ports and double-issuing listen commands.
  #debugListenerStartPromise: Promise<void> | undefined;
  // Generation token for listener attempts. Advanced when an attempt begins
  // and whenever an attempt is invalidated (stop/restart/retry), so a
  // superseded attempt's late reservation is released, its armed timeout
  // no-ops, and stale BDS confirmation/failure lines are ignored instead of
  // acting on the wrong attempt's reservation.
  #debugListenerAttemptId: number = 0;
  // Dynamically reserved, collision-free debug port (see DebugPortRegistry).
  // Held as a tokenized handle so a superseded attempt's late release can
  // never drop a newer attempt's reservation for the same port.
  #debugPortReservation: IDebugPortReservation | undefined;
  // The debug port most recently ATTEMPTED by the listener flow. Survives
  // reservation release (and stop/reset) so the synchronous failed stage
  // event, the late-mount status snapshot, and diagnostics report the port
  // the attempt actually used - not the preferred-port fallback the debugPort
  // getter would return once #debugPortReservation is cleared. Overwritten by
  // the next reservation, and cleared when a NEW server run begins
  // (startServer) so a fresh run's pre-reservation events never report the
  // previous run's port.
  #lastAttemptedDebugPort: number | undefined;
  // Timers owned by the debugger flow - always cleared in resetDebuggerRuntimeState
  // so a stop/restart never leaves a stale timer poking a new (or dead) server run
  #debugListenDelayTimer: NodeJS.Timeout | undefined;
  #debugListenerReadyTimeout: NodeJS.Timeout | undefined;
  #debugReconnectTimer: NodeJS.Timeout | undefined;
  #debugReconnectAttempts: number = 0;
  // True when the CURRENT client's handshake completed without any script
  // module to select (plugins=0). BDS closes such sessions right after the
  // handshake, so the drop must be classified as moduleSelection - and the
  // reconnect counter must NOT be reset by that short-lived "connected" -
  // or the flow churns connect/drop forever instead of failing actionably.
  #debugSessionMissingTargetModule: boolean = false;
  // Debounces duplicate connect attempts (readiness message and retry can race)
  #debugConnectInFlight: boolean = false;
  // BDS version parsed from the "Version: x.y.z" startup line, for diagnostics
  #bdsVersion: string | undefined;
  // Typed reason of the last failed debug attach attempt (see
  // DebugAttachFailureReason); undefined when the last attempt succeeded.
  #debugAttachFailure: DebugAttachFailureReason | undefined;
  // True only when Minecraft explicitly confirmed the debug endpoint
  // ("Debugger listening" in the inbound direction). Ownership classification
  // needs this real confirmation - readiness inferred any other way must not
  // set it.
  #debugListenerConfirmed: boolean = false;
  // The in-flight reattach attempt, if any. Concurrent callers (e.g., the
  // user clicking "Check again" repeatedly, or two panels retrying at once)
  // share this promise and all receive the settled outcome of the one real
  // attempt instead of a premature state snapshot.
  #debugReattachPromise: Promise<{ connected: boolean; ownership: DebugOwnershipState }> | undefined;
  // Generation of the connect attempt that currently OWNS the in-flight
  // latch. Cancellation paths (reattach, runtime reset) advance it while
  // releasing the latch, so a replacement can dial immediately; the canceled
  // attempt's finally then sees a foreign generation and must NOT release -
  // otherwise its late settlement would clear the replacement's latch.
  #debugConnectAttempt: number = 0;

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
   * Once the listener flow has reserved a collision-free dynamic port, that
   * port is returned. After a failed attempt released its reservation, the
   * port that attempt ACTUALLY used is still reported (failure events and
   * late-mount snapshots must not misreport the preferred port - the exact
   * misleading diagnosis dynamic allocation exists to avoid). Before any
   * reservation, this is the preferred port: base port + 12, which gives
   * each slot a unique debug port window.
   * Slot 0: port 19132 -> preferred debug port 19144
   * Slot 1: port 19164 -> preferred debug port 19176
   * etc.
   */
  public get debugPort(): number {
    if (this.#debugPortReservation !== undefined) {
      return this.#debugPortReservation.port;
    }

    if (this.#lastAttemptedDebugPort !== undefined) {
      return this.#lastAttemptedDebugPort;
    }

    const basePort = this.#port ?? 19132;
    return basePort + 12; // Preferred debug port offset is 12 from base port
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
  #onDebugStageChanged = new EventDispatcher<DedicatedServer, IDebuggerStageEventData>();
  #onDebugSchema = new EventDispatcher<DedicatedServer, IDiagnosticsTabDescriptor[]>();

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

    this.#debuggerLifecycle.onStageChanged.subscribe((_tracker, data) => {
      this.#onDebugStageChanged.dispatch(this, { ...data, debugPort: this.debugPort });
    });

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

  public get onDebugStageChanged() {
    return this.#onDebugStageChanged.asEvent();
  }

  public get onDebugSchema() {
    return this.#onDebugSchema.asEvent();
  }

  public get debugClient() {
    return this.#debugClient;
  }

  public get debuggerLifecycle() {
    return this.#debuggerLifecycle;
  }

  /**
   * Who currently owns the single-client Minecraft debug endpoint for this
   * server. "attachedExternally" is reported only on positive contention
   * evidence: Minecraft confirmed its listener AND our socket was accepted
   * but closed before the protocol handshake. Transport-level failures
   * (refused, timeout, listener races, BDS shutting down) classify as
   * "unknown" so the UI offers a retry instead of blaming another debugger.
   * See deriveDebugOwnership for the classification rules.
   */
  public get debugOwnership(): DebugOwnershipState {
    return deriveDebugOwnership({
      clientConnected: this.#debugClient?.isConnected === true,
      attachFailure: this.#debugAttachFailure,
      listenerConfirmed: this.#debugListenerConfirmed,
      debuggerEnabled: this.#enableDebugger,
      streamingEnabled: this.#enableDebuggerStreaming,
    });
  }

  /** Typed reason of the last failed debug attach attempt, if any. */
  public get debugAttachFailure(): DebugAttachFailureReason | undefined {
    return this.#debugAttachFailure;
  }

  /**
   * Snapshot of the current debug session as slot-config fields: the
   * hydration payload for UIs that mount AFTER the session was established
   * (the diagnostics panel is only mounted when its tab is open, so live
   * debugConnected/debugSchema events may already be long gone). Served by
   * both the web /status endpoint and the Electron debug-status IPC so the
   * two modes hydrate from the identical source of truth. Includes the
   * debugger lifecycle snapshot (stage, failure kind, sanitized message) so
   * a flow that settled - e.g. terminally failed - before the panel mounted
   * still surfaces its error and recovery actions.
   */
  public getDebugSlotConfig(): ISlotConfig {
    const sessionInfo = this.#debugClient?.sessionInfo;

    return {
      debuggerEnabled: this.#enableDebugger,
      debuggerStreamingEnabled: this.#enableDebuggerStreaming,
      debugConnectionState: sessionInfo?.state ?? "disconnected",
      debugProtocolVersion: sessionInfo?.protocolVersion,
      debugLastStatTick: sessionInfo?.lastStatTick,
      debugErrorMessage: sessionInfo?.errorMessage,
      debugStage: this.#debuggerLifecycle.stage,
      debugFailureKind: this.#debuggerLifecycle.failureKind,
      debugStageMessage: this.#debuggerLifecycle.errorMessage,
      debugTargetModuleUuid: sessionInfo?.targetModuleUuid,
      debugPlugins: sessionInfo?.plugins,
      debugHost: sessionInfo?.host,
      // A live session reports the port it actually used; otherwise fall
      // back to the dynamically derived debug port so pre-connect/terminal
      // failure snapshots still name the port the attempt used.
      debugPort: sessionInfo?.port ?? this.debugPort,
      debugCapabilities: sessionInfo?.capabilities,
      debugOwnership: this.debugOwnership,
      debugSchema: sessionInfo?.schema,
    };
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

  public get debugOutboundConnect() {
    return this.#debugOutboundConnect;
  }

  public set debugOutboundConnect(value: boolean) {
    this.#debugOutboundConnect = value;
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

  /**
   * Start (or restart) the BDS process. Returns true when a launch was
   * initiated (or a server is already running and no restart was requested),
   * false when a startup preflight check failed (missing executable, invalid
   * signature, non-Microsoft signer) - those paths return NORMALLY after
   * setting status = stopped and dispatching onServerError, so callers must
   * check this outcome (not just resolution) before reporting success.
   */
  async startServer(restartIfAlreadyRunning: boolean, start: IMinecraftServerStart | undefined): Promise<boolean> {
    if (start === undefined) {
      start = {
        worldSettings: this.#dsm.creatorTools.worldSettings,
        mode: DedicatedServerMode.auto,
        iagree: this.#env.iAgreeToTheMinecraftEndUserLicenseAgreementAndPrivacyStatementAtMinecraftDotNetSlashEula,
      };
    }

    // Captured BEFORE any stop is delivered so the waits below can target
    // the SPECIFIC old child even after graceful teardown clears the handle.
    const previousProcess = this.#activeProcess;
    let deliberateRestart = false;

    if (
      this.#status === DedicatedServerStatus.launching ||
      this.#status === DedicatedServerStatus.started ||
      this.#status === DedicatedServerStatus.starting
    ) {
      if (restartIfAlreadyRunning) {
        // From here until the old run's teardown below completes, its close
        // event must not run unexpected-stop bookkeeping or the auto-restart
        // loop - this restart owns the teardown (see handleClose).
        deliberateRestart = true;
        this.#restartInProgress = true;
      } else {
        return true;
      }
    }

    // Serialize the launch on RUN IDENTITY, not on #status: whether an old
    // run still owns the slot is a property of #activeProcess and
    // #stopFinalization. Deployment flips #status to stopped before calling
    // stopServer()/startServer(true), so a wait placed inside the
    // status-gated branch above would be skipped entirely on that path and
    // the replacement could launch while the old process still held the
    // slot's files and ports (and before its finalization/backup completed).
    try {
      if (deliberateRestart) {
        await this.stopServer();
      }

      // stopServer only DELIVERS the stop command - the old child is still
      // exiting when it returns. Spawning the replacement while the old
      // process lives would have two BDS processes contending for the slot,
      // and would let the old process's buffered output/close callbacks race
      // the replacement's startup (they are identity-guarded, but the
      // contention itself makes a restart nondeterministic). Await the
      // SPECIFIC old child's termination - bounded, because stopServer
      // force-kills after 10s; a process that survives even that fails the
      // start rather than proceeding into a doubly-owned slot.
      if (previousProcess) {
        try {
          await DedicatedServer.awaitProcessTermination(previousProcess, PREVIOUS_PROCESS_EXIT_TIMEOUT_MS);
        } catch (e) {
          const errorMsg = String(e);

          Log.fail(errorMsg);
          this.#onServerError.dispatch(this, errorMsg);
          return false;
        }
      }

      // The same exit that released the wait above also unblocks the old
      // run's finalization (continueStopServer/handleClose ->
      // finalizeStopServer), which can still be pausing in doBackup().
      // Launching now would let that finalization later remove the
      // replacement's PID file, dispatch onServerStopped, and write
      // #status = stopped over the live replacement - so await the old
      // run's COMPLETE finalization, not just its process's exit.
      // Bounded: the process already exited, so what remains is interval
      // teardown and the backup, which has its own stuck-backup timeout.
      const previousFinalization = this.#stopFinalization;

      if (previousFinalization) {
        await previousFinalization;
      } else if (previousProcess && this.#activeProcess === previousProcess) {
        // Force-kill/crash edge: the old process exited without the
        // graceful acknowledgement (continueStopServer never ran) and
        // its close event has not landed yet - it can arrive as late as
        // the replacement's startup preflight, where the identity guard
        // would rightly skip it and NOTHING would finalize, leaking the
        // backup interval and the shutdown backup. Adopt the
        // finalization HERE so exactly one finalization runs before the
        // replacement's startup begins.
        this.#activeProcess = null;

        await this.finalizeStopServer();
      }
    } finally {
      this.#restartInProgress = false;
    }

    let rootPath = this.serverPath;

    this.#onServerStarting.dispatch(this, "");
    this.#status = DedicatedServerStatus.launching;

    const ns = new NodeStorage(rootPath, "");

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

    // A fresh run must not inherit the previous run's attempted debug port:
    // until this run reserves its own port, stage events, status snapshots,
    // and diagnostics would otherwise report a port this run never attempted
    // (possibly outside its base-port window) - e.g., when preflight fails
    // before any reservation. The field intentionally survives stop/reset so
    // the CURRENT failed attempt keeps reporting the port it actually used;
    // it is cleared only here, when a new run begins.
    this.#lastAttemptedDebugPort = undefined;

    // Same policy for the effective persisted debugging settings: a new run
    // re-reads them in beginDebuggerSetup; until then they are unknown, not
    // inherited from the previous run's file state.
    this.#effectiveInboundScriptDebugging = undefined;
    this.#effectiveOutboundScriptDebugging = undefined;

    if (this.#enableDebugger) {
      this.#debuggerLifecycle.transition(DebuggerLifecycleStage.startingServer);
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
      this.failDebuggerForStartupPreflight(errorMsg);
      this.#onServerError.dispatch(this, errorMsg);
      return false;
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
        this.failDebuggerForStartupPreflight(errorMsg);
        this.#onServerError.dispatch(this, errorMsg);
        return false;
      }

      if (!sigResult.isMicrosoftSigned) {
        const errorMsg =
          `Digital signature verification: ${fullPath} is signed, but not by Microsoft/Mojang. ` +
          `Signer: ${sigResult.signer || "unknown"}\n` +
          `This could indicate the file is not an official Minecraft Dedicated Server.\n` +
          `If you trust this file, you can skip signature verification with --unsafe-skip-signature-validation.`;
        Log.fail(errorMsg);
        this.#status = DedicatedServerStatus.stopped;
        this.failDebuggerForStartupPreflight(errorMsg);
        this.#onServerError.dispatch(this, errorMsg);
        return false;
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

    this.attachProcess(childProcess);

    // Arm the periodic backup only once a process actually spawned: arming it
    // before preflight leaked a live interval (never cleared by
    // finalizeStopServer, which only runs for a process that attached) on
    // every preflight-failure return.
    if (start.worldSettings?.backupType === BackupType.every2Minutes) {
      this.#backupInterval = setInterval(this.doRunningBackup, 120000);
    } else if (start.worldSettings?.backupType === BackupType.every5Minutes) {
      this.#backupInterval = setInterval(this.doRunningBackup, 300000);
    }

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

    return true;
  }

  /**
   * Attach a freshly spawned server process as the current active process.
   * The close handler is bound to this specific child process: a restart can
   * launch a replacement while the old process is still exiting, and a close
   * event from that superseded process must not clear the replacement's
   * handle or trigger finalize/auto-restart against it.
   */
  /**
   * Resolve once the given child process has terminated; reject if it is
   * still alive after timeoutMs. An already-exited process (exitCode or
   * signalCode set) resolves immediately.
   */
  private static awaitProcessTermination(proc: ChildProcess, timeoutMs: number): Promise<void> {
    if (proc.exitCode !== null || proc.signalCode !== null) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const onExitEvent = () => {
        clearTimeout(timer);
        resolve();
      };

      const timer = setTimeout(() => {
        proc.removeListener("exit", onExitEvent);
        reject(
          new Error(
            `Previous server process (PID ${proc.pid}) did not exit within ${timeoutMs}ms; ` +
              "refusing to start a replacement into a still-owned slot."
          )
        );
      }, timeoutMs);

      proc.once("exit", onExitEvent);
    });
  }

  attachProcess(childProcess: ChildProcess) {
    childProcess.on("close", () => this.handleClose(childProcess));

    this.#activeStdIn = childProcess.stdin;
    this.#activeProcess = childProcess;
  }

  /**
   * Whether a spawned server process is currently attached. Exists so
   * process-identity behavior (a superseded process's output/close must not
   * clear the current process handle) is observable without exposing the
   * ChildProcess itself.
   */
  public get isProcessActive(): boolean {
    return this.#activeProcess !== null;
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

      // Cancel debugger work the moment the stop begins - NOT when the
      // process finally exits. The graceful-stop window keeps #status at
      // "started", so an armed reconnect timer or an in-flight TCP retry
      // loop left running here could still attach to the terminating (or a
      // freshly restarted) server and consume its single debugger slot.
      this.cancelDebuggerWork("server stop requested");

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

  private async handleClose(closedProcess: ChildProcess) {
    // Only the current process may mutate server state on close. A close
    // event from a process that has since been replaced (restart while the
    // old process was still exiting) or already stopped (continueStopServer
    // cleared the handle) is a stale notification, not a server stop.
    if (this.#activeProcess === closedProcess) {
      if (this.#restartInProgress) {
        // A deliberate restart owns this teardown. On Windows the old
        // child's close can land during the replacement's startup preflight;
        // running unexpected-stop bookkeeping or the auto-restart loop here
        // would act against the incoming run. Publish the finalization for
        // the restart flow to await and return.
        this.#activeProcess = null;

        const restartFinalizationId = ++this.#stopFinalizationId;
        const finalization = (async () => {
          await this.finalizeStopServer();
        })();

        this.#stopFinalization = finalization;

        try {
          await finalization;
        } finally {
          if (this.#stopFinalizationId === restartFinalizationId) {
            this.#stopFinalization = undefined;
          }
        }

        return;
      }

      this.#dsm.creatorTools.notifyStatusUpdate("Server was closed unexpectedly.");

      this.#unexpectedStopLog.push(new Date());

      const statusBefore = this.#status;

      this.#activeProcess = null;

      const finalizationId = ++this.#stopFinalizationId;
      const finalization = (async () => {
        await this.finalizeStopServer();
      })();

      this.#stopFinalization = finalization;

      try {
        await finalization;
      } finally {
        if (this.#stopFinalizationId === finalizationId) {
          this.#stopFinalization = undefined;
        }
      }

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

      // Publish the finalization BEFORE awaiting the exit so a restart that
      // is released by the same exit can find and await it (startServer).
      const finalizationId = ++this.#stopFinalizationId;
      const finalization = (async () => {
        await onExit(proc);

        await this.finalizeStopServer();
      })();

      this.#stopFinalization = finalization;

      try {
        await finalization;
      } finally {
        if (this.#stopFinalizationId === finalizationId) {
          this.#stopFinalization = undefined;
        }
      }
    }
  }

  async finalizeStopServer() {
    // Identity guard: both callers null #activeProcess for their own process
    // before invoking this, so a non-null handle here means a REPLACEMENT
    // attached while this finalization was pending (a restart racing the
    // exit). The shared state - intervals, PID file, status - belongs to the
    // new run now; finalizing over it would tear the replacement down.
    if (this.#activeProcess !== null) {
      return;
    }

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

    // Tear down the debugger flow: client socket, pending timers, listener
    // state, and the port reservation are all released so a subsequent start
    // begins from a clean slate.
    this.#debuggerLifecycle.transition(DebuggerLifecycleStage.stopping);
    this.resetDebuggerRuntimeState(true);
    this.#debuggerLifecycle.transition(DebuggerLifecycleStage.idle, "server stopped");

    // Remove PID file since the server is no longer running
    this._removePidFile(NodeStorage.ensureEndsWithDelimiter(this.serverPath));

    // A failing shutdown backup is REPORTED, never propagated: the
    // finalization promise is awaited by restart (and the close/stop
    // handlers), and a rejection there would abort the restart with no
    // process attached while #status still reads "started" - a wedged state.
    // The stop bookkeeping below must complete regardless.
    try {
      await this.doBackup();
    } catch (e) {
      const errorMsg = `Shutdown backup failed: ${e instanceof Error ? e.message : String(e)}`;

      Log.error(errorMsg);
      this.#onServerError.dispatch(this, errorMsg);
    }

    // Re-check after the backup await: a replacement that attached while the
    // backup ran owns #status now - dispatching onServerStopped and writing
    // "stopped" here would report the LIVE replacement as stopped and permit
    // a second concurrent start through startServer's status guard.
    if (this.#activeProcess !== null) {
      return;
    }

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

    // On a full (non-patch) deploy, clear existing dev packs so old project content doesn't accumulate.
    // BDS auto-loads everything in development_*_packs/, so leftover packs from previous projects
    // would appear as unexpected content (e.g., custom features from a different add-on).
    if (!isPatch) {
      if (this.#behaviorPacksStorage) {
        Log.message("Clearing previous behavior packs for fresh deployment.");
        await this.#behaviorPacksStorage.rootFolder.deleteAllFolderContents();
        await this.#behaviorPacksStorage.rootFolder.ensureExists();
      }

      if (this.#resourcePacksStorage) {
        Log.message("Clearing previous resource packs for fresh deployment.");
        await this.#resourcePacksStorage.rootFolder.deleteAllFolderContents();
        await this.#resourcePacksStorage.rootFolder.ensureExists();
      }

      // When the deployed project changes, also wipe the world data so entities, items,
      // and blocks from the previous project's packs don't persist in the LevelDB chunks.
      // Detect a project change by checking if the world's existing pack references
      // match the current project's behavior pack UUID.
      if (this.#defaultWorldStorage) {
        const currentBpId = deployProj.defaultBehaviorPackUniqueId;
        const existingWorld = new MCWorld();
        existingWorld.folder = this.#defaultWorldStorage.rootFolder;

        await existingWorld.loadMetaFiles(false);

        const existingBp = existingWorld.getBehaviorPack(currentBpId);

        // If the world has pack refs but none match this project, it's from a different project
        if (existingWorld.worldBehaviorPacks && existingWorld.worldBehaviorPacks.length > 0 && !existingBp) {
          Log.message("Project changed — resetting world data for clean state.");
          await this.#defaultWorldStorage.rootFolder.deleteAllFolderContents();
          await this.#defaultWorldStorage.rootFolder.ensureExists();
        }
      }
    }

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

      // On a full (non-patch) deploy, reset pack references so only the current
      // project's packs are active. This prevents stale packs from previous
      // projects appearing in the world.
      if (!isPatch) {
        mcworld.worldBehaviorPacks = [];
        mcworld.worldResourcePacks = [];
        mcworld.worldBehaviorPackHistory = { packs: [] };
        mcworld.worldResourcePackHistory = { packs: [] };
      }

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

      if (!isPatch) {
        needsSave = true;
      }

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
    // Identity of the process this stream belongs to. A restart attaches a
    // new stream (and bumps the id) while the old stream may still be
    // draining buffered lines; every state-mutating line below is gated on
    // this id still being current, so a superseded process's delayed output
    // cannot mutate the replacement's state. Its lines are still recorded
    // and forwarded for display.
    const outputStreamId = ++this.#outputStreamId;
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

        // Re-evaluated per line: the stream can be superseded mid-drain. A
        // stale stream's "Server started" must not mark the replacement
        // started or re-run debugger setup, and its "Quit correctly" must
        // not clear the replacement's process handle via continueStopServer.
        const isCurrentStream = outputStreamId === this.#outputStreamId;

        if (!isCurrentStream) {
          // Superseded process output is display-only; fall through to the
          // recording/dispatch below without mutating state.
        } else if (sm.category === ServerMessageCategory.serverStarted) {
          this.#starts++;

          this.#status = DedicatedServerStatus.started;
          this.handleServerStarted(lineUp);

          // BDS is ready - now (and only now) begin the debugger listener
          // flow. Floated: setup reports its own failures through the
          // lifecycle; the catch only guards against a throwing stage-event
          // subscriber becoming an unhandled rejection.
          this.beginDebuggerSetup().catch((e: unknown) => {
            Log.error(`[Debug] Unexpected error during debugger setup: ${e}`);
          });
        } else if (sm.category === ServerMessageCategory.version) {
          const versionIndex = lineUp.indexOf("Version: ");

          if (versionIndex >= 0) {
            this.#bdsVersion = lineUp.substring(versionIndex + "Version: ".length).trim();
          }
        } else if (sm.category === ServerMessageCategory.debuggerListening) {
          // Minecraft has confirmed the debug listener is ready
          this.handleDebuggerListening(lineUp);
        } else if (sm.category === ServerMessageCategory.debuggerFailedToStart) {
          // Minecraft reported the listener could not start (e.g., port in use)
          this.handleDebuggerFailedToStart(lineUp);
        } else if (sm.category === ServerMessageCategory.serverStopped) {
          await this.continueStopServer();
        } else if (sm.category === ServerMessageCategory.playerConnected) {
          const playerName = this.getPlayerIdFromLine(lineUp);
          const xuid = this.getPlayerXuidFromLine(lineUp);

          Log.message("Player '" + playerName + "' connected.");

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

        if (isCurrentStream) {
          this.#lastResult = lineUp;
        }

        if (this.outputLines.length > 10000) {
          this.outputLines.splice(0, 5000);
        }
        this.outputLines.push({
          message: lineUp,
          received: time,
          isInternal: sm.category === ServerMessageCategory.internalSystemMessage,
          streamId: outputStreamId,
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
   * Begin the debugger setup flow. Called only after BDS reports
   * "Server started", so the listener command is never issued against a
   * server that is not ready to take it.
   *
   * Stage flow: configuring -> startingListener -> waitingForReadiness ->
   * connectingTcp -> negotiating -> selectingTarget -> resuming -> connected.
   */
  async beginDebuggerSetup(): Promise<void> {
    if (!this.#enableDebugger) {
      this.#debuggerLifecycle.transition(DebuggerLifecycleStage.idle, "debugger disabled in settings");
      return;
    }

    // A restart can arrive while timers from the previous run are still
    // pending; release all debugger runtime state (timers, client, port)
    // before starting a fresh flow.
    this.resetDebuggerRuntimeState(true);

    this.#debuggerLifecycle.transition(DebuggerLifecycleStage.configuring);

    const startsAtSetup = this.#starts;

    // Verify the PERSISTED debugging setting relevant to the connection
    // direction. The in-memory properties fields are write-only intent
    // (never populated from server.properties), so checking them here was
    // unreachable - BDS reads the file, and a hand-edited =false value
    // would otherwise surface later as a misleading connection timeout
    // instead of the settings failure this stage promises.
    //
    // The direction is the EFFECTIVE one - the same predicate
    // runStartDebuggerListener branches on. Outbound mode with streaming
    // disabled falls through to the inbound `script debugger listen` flow
    // (the external-debugger handoff), so the setting that governs that
    // operation is the inbound one; checking #debugOutboundConnect alone
    // would let inbound=false pass preflight and time out misleadingly,
    // and would reject outbound=false even though the listener can start.
    const effectiveOutbound = this.#debugOutboundConnect && this.#enableDebuggerStreaming;
    const settingKey = effectiveOutbound ? "allow-outbound-script-debugging" : "allow-inbound-script-debugging";

    let persistedInbound: boolean | undefined;
    let persistedOutbound: boolean | undefined;

    try {
      persistedInbound = await this.properties.readPersistedAllowInboundScriptDebugging();
      persistedOutbound = await this.properties.readPersistedAllowOutboundScriptDebugging();
    } catch (e) {
      // An unreadable file is not proof of a settings problem; let the
      // connection flow surface any real failure.
      Log.debug(`[Debug] Could not read server.properties for settings verification: ${e}`);
    }

    const persistedAllowed = effectiveOutbound ? persistedOutbound : persistedInbound;

    // A stop/restart may have begun while the file was being read; the
    // superseding flow owns the lifecycle now - including the effective-
    // values cache below, which a superseded setup must never publish over
    // the winning run's values (its reads may even describe a different
    // file state). Status and generation alone are not enough: a graceful
    // stop leaves #status "started" and #starts unchanged until the process
    // exits, so - like the reconnect scheduler - also reject the stopping
    // and idle lifecycle stages, or a read pending when cancelDebuggerWork()
    // ran would republish diagnostics and re-arm the listener that stop
    // explicitly canceled.
    if (
      this.#status !== DedicatedServerStatus.started ||
      this.#starts !== startsAtSetup ||
      this.#debuggerLifecycle.stage === DebuggerLifecycleStage.stopping ||
      this.#debuggerLifecycle.stage === DebuggerLifecycleStage.idle
    ) {
      return;
    }

    // Cache the effective values this setup acted on: diagnostics must
    // describe the runtime decision, not in-memory write-intent defaults
    // that may differ from disk.
    this.#effectiveInboundScriptDebugging = persistedInbound;
    this.#effectiveOutboundScriptDebugging = persistedOutbound;

    if (persistedAllowed === false) {
      this.failDebugger(
        DebuggerFailureKind.settings,
        `server.properties has ${settingKey}=false, so the script debugger connection cannot be established. Enable script debugging and restart the server.`
      );
      return;
    }

    this.#debugListenDelayTimer = setTimeout(() => {
      this.#debugListenDelayTimer = undefined;

      // Only proceed if the same server run is still active and no stop has
      // begun (same stage checks as the guard above - the timer is cleared
      // by cancelDebuggerWork, but a stop that lands between the clear and
      // this callback still leaves #status "started").
      if (
        this.#status !== DedicatedServerStatus.started ||
        this.#starts !== startsAtSetup ||
        this.#debuggerLifecycle.stage === DebuggerLifecycleStage.stopping ||
        this.#debuggerLifecycle.stage === DebuggerLifecycleStage.idle
      ) {
        return;
      }

      // Floated: startDebuggerListener converts its own errors into a
      // lifecycle failure, so this catch only guards against a throwing
      // stage-event subscriber turning into an unhandled rejection.
      this.startDebuggerListener().catch((e: unknown) => {
        Log.error(`[Debug] Unexpected error from the debugger listener startup: ${e}`);
      });
    }, DEBUG_LISTEN_DELAY_MS);
  }

  /**
   * Reserve a collision-free debug port and issue `script debugger listen`.
   * Connection is gated on the parsed "Debugger listening" confirmation;
   * if BDS never confirms, the flow fails with a listener-readiness error
   * (never a success-shaped fallback).
   *
   * Never rejects: the listen delay timer and the reconnect timer float the
   * returned promise, so any startup error (e.g., a streamWrite EPIPE when
   * BDS exits mid-command) is converted into an unwound attempt and a
   * lifecycle failure instead of an unhandled rejection.
   */
  async startDebuggerListener(): Promise<void> {
    // Single-flight: a concurrent entry (user Retry racing the reconnect
    // timer) joins the in-flight startup instead of double-reserving a port
    // and double-issuing the listen command.
    if (this.#debugListenerStartPromise) {
      return this.#debugListenerStartPromise;
    }

    if (this.#awaitingDebuggerListening || this.#debugListenerReady) {
      Log.debug(
        `[Debug] startDebuggerListener: listener already ${this.#debugListenerReady ? "ready" : "starting"}, skipping`
      );
      return;
    }

    // Take the guard and an attempt token BEFORE the first await, so no
    // concurrent entry can slip past the guard during the reservation, and
    // every later completion can be checked against this attempt.
    this.#awaitingDebuggerListening = true;
    this.#debugListenerConfirmed = false;
    const attemptId = ++this.#debugListenerAttemptId;

    const startPromise: Promise<void> = this.runStartDebuggerListener(attemptId)
      .catch((e: unknown) => {
        // runCommand() reaches streamWrite(), which rejects (EPIPE) if BDS
        // exits while the listen command is being delivered. Left uncaught,
        // that surfaces as an unhandled rejection in the floating callers
        // AND strands the attempt half-armed: #awaitingDebuggerListening
        // stuck true (blocking every retry), no readiness timeout armed, and
        // the port reservation retained. Unwind the attempt and fail the
        // lifecycle instead.
        if (this.#debugListenerAttemptId !== attemptId) {
          // Already superseded - the invalidating reset (stop/restart/retry,
          // or the process-close handler's resetDebuggerRuntimeState) has
          // unwound the shared state.
          return;
        }

        this.#awaitingDebuggerListening = false;
        this.invalidateDebugListenerAttempt();

        DebugPortRegistry.release(this.#debugPortReservation);
        this.#debugPortReservation = undefined;

        this.failDebugger(
          DebuggerFailureKind.serverStartup,
          `Could not issue the 'script debugger listen' command - the server process exited or closed its input while the command was being delivered. ${
            e instanceof Error ? e.message : String(e)
          }`
        );
      })
      .finally(() => {
        // Guarded: an invalidation may already have installed a newer attempt.
        if (this.#debugListenerStartPromise === startPromise) {
          this.#debugListenerStartPromise = undefined;
        }
      });

    this.#debugListenerStartPromise = startPromise;

    return startPromise;
  }

  private async runStartDebuggerListener(attemptId: number): Promise<void> {
    this.#debuggerLifecycle.transition(DebuggerLifecycleStage.startingListener);

    // NOTE: outbound mode with streaming disabled deliberately falls through
    // to the inbound listen flow below. The external-debugger handoff
    // guidance promises that disabling MCT's streaming leaves BDS listening
    // for the official extension to attach to; in outbound mode MCT's own
    // session dials out and no BDS-side listener exists, so returning early
    // here left the handoff non-functional - nothing for VS Code to connect
    // to. Arming the inbound listener (used by nothing else while streaming
    // is off) is exactly the state the guidance describes; on the parsed
    // confirmation, handleDebuggerListening parks the flow at idle with the
    // socket left free for external debuggers.

    const preferredPort = (this.#port ?? 19132) + 12;
    const reservation = await DebugPortRegistry.reserve(preferredPort, this.serverPath);

    // Superseded (stop/restart/retry) while the reservation was pending:
    // release what was just reserved and bail without touching shared state.
    // The release is token-conditional, so if a replacement attempt has
    // already taken over this port's claim, this no-ops instead of dropping
    // the replacement's active reservation.
    if (this.#debugListenerAttemptId !== attemptId) {
      DebugPortRegistry.release(reservation);
      return;
    }

    if (reservation === undefined) {
      this.#awaitingDebuggerListening = false;
      this.failDebugger(
        DebuggerFailureKind.portOccupied,
        `No free script debugger port found in range ${preferredPort}-${preferredPort + 19}. Another debugger (e.g., VS Code) or a stale process may be holding these ports.`
      );
      return;
    }

    const port = reservation.port;
    this.#debugPortReservation = reservation;
    this.#lastAttemptedDebugPort = port;

    if (this.#debugOutboundConnect && this.#enableDebuggerStreaming) {
      // Outbound direction WITH streaming: MCT listens; BDS dials. There is
      // no BDS-side listener, so the "Debugger listening" confirmation flow
      // (and its readiness timeout) does not apply. With streaming DISABLED,
      // this branch is skipped and the inbound listen flow below arms the
      // BDS listener for the external-debugger handoff instead.
      this.#awaitingDebuggerListening = false;
      await this.connectDebugClientOutbound(port);
      return;
    }

    Log.debug(`[Debug] Sending 'script debugger listen ${port}' command...`);
    await this.runCommand(`script debugger listen ${port}`);

    // Superseded while the listen command was being issued; the invalidating
    // reset released the reservation.
    if (this.#debugListenerAttemptId !== attemptId) {
      return;
    }

    // BDS can emit "Debugger listening" or "Failed to start debugger" while
    // the awaited stdin write is still completing. Those handlers clear
    // #awaitingDebuggerListening (readiness proceeds to connect, failure
    // releases the reservation and fails the lifecycle) WITHOUT advancing the
    // attempt id - the attempt settled, it was not superseded. The generation
    // check above therefore passes, and without this bail the continuation
    // would rewind an already-settled attempt to waitingForReadiness
    // (overwriting connectingTcp or clearing a terminal failure) and arm a
    // readiness timeout that can later fail a flow that already resolved.
    if (!this.#awaitingDebuggerListening) {
      return;
    }

    this.#debuggerLifecycle.transition(DebuggerLifecycleStage.waitingForReadiness, `port ${port}`);

    this.#debugListenerReadyTimeout = setTimeout(() => {
      this.#debugListenerReadyTimeout = undefined;

      // Only the attempt that armed this timeout may fail the flow.
      if (this.#debugListenerAttemptId !== attemptId) {
        return;
      }

      if (this.#awaitingDebuggerListening) {
        this.#awaitingDebuggerListening = false;
        this.failDebugger(
          DebuggerFailureKind.listenerReadiness,
          `BDS did not confirm 'Debugger listening' on port ${port} within ${DEBUG_LISTENER_READY_TIMEOUT_MS / 1000}s.`
        );
      }
    }, DEBUG_LISTENER_READY_TIMEOUT_MS);
  }

  /**
   * Invalidate any in-flight listener attempt: advance the attempt
   * generation (so a pending reservation is released when it resolves, the
   * armed readiness timeout no-ops, and stale BDS output is ignored) and
   * drop the shared promise so the next startDebuggerListener starts fresh
   * instead of joining a canceled attempt.
   */
  private invalidateDebugListenerAttempt() {
    this.#debugListenerAttemptId++;
    this.#debugListenerStartPromise = undefined;
  }

  /**
   * Handle the parsed "Debugger listening" confirmation from BDS stdout.
   * The confirmation must belong to the CURRENT listener attempt: when the
   * line carries a port (e.g. "Debugger listening on port 19212"), a
   * mismatch against the current reservation marks it as a stale
   * confirmation from a superseded attempt, and it is ignored rather than
   * allowed to complete the wrong attempt.
   */
  handleDebuggerListening(line?: string) {
    if (!this.#awaitingDebuggerListening) {
      return;
    }

    if (line !== undefined && this.#debugPortReservation !== undefined) {
      const portMatch = line.match(/(\d{2,5})\s*$/);

      if (portMatch && parseInt(portMatch[1], 10) !== this.#debugPortReservation.port) {
        Log.debug(
          `[Debug] Ignoring stale 'Debugger listening' confirmation for port ${portMatch[1]} - the current attempt reserved port ${this.#debugPortReservation.port}`
        );
        return;
      }
    }

    this.#awaitingDebuggerListening = false;

    if (this.#debugListenerReadyTimeout) {
      clearTimeout(this.#debugListenerReadyTimeout);
      this.#debugListenerReadyTimeout = undefined;
    }

    this.#debugListenerReady = true;
    // Real confirmation from BDS output - trustworthy evidence for the
    // single-client ownership classification (see debugOwnership).
    this.#debugListenerConfirmed = true;

    if (!this.#enableDebuggerStreaming) {
      Log.debug(`[Debug] Debugger listening, but streaming not enabled; skipping client connection`);
      this.#debuggerLifecycle.transition(
        DebuggerLifecycleStage.idle,
        "listener ready; streaming disabled - external debuggers may attach"
      );
      return;
    }

    Log.debug(`[Debug] Debugger listening confirmed; connecting debug client...`);
    this.connectDebugClient();
  }

  /**
   * Handle a "Failed to start debugger" line from BDS stdout. Only an
   * attempt still awaiting confirmation may be failed by this line - a
   * stale/late failure line must not tear down a newer successful attempt
   * or release its reservation.
   */
  handleDebuggerFailedToStart(line: string) {
    if (!this.#awaitingDebuggerListening) {
      Log.debug(`[Debug] Ignoring 'Failed to start debugger' line - no listener attempt is awaiting confirmation`);
      return;
    }

    this.#awaitingDebuggerListening = false;

    if (this.#debugListenerReadyTimeout) {
      clearTimeout(this.#debugListenerReadyTimeout);
      this.#debugListenerReadyTimeout = undefined;
    }

    DebugPortRegistry.release(this.#debugPortReservation);
    this.#debugPortReservation = undefined;

    this.failDebugger(classifyDebuggerListenFailure(line), line);
  }

  /**
   * Connect to the Minecraft script debugger. Only called once the listener
   * is confirmed ready. Duplicate calls (readiness message racing a retry)
   * are debounced.
   */
  async connectDebugClient() {
    if (this.#debugConnectInFlight) {
      Log.debug(`[Debug] connectDebugClient: connection already in flight, skipping`);
      return;
    }

    if (this.#debugClient) {
      Log.debug(`[Debug] connectDebugClient: Already have a debug client, skipping`);
      return;
    }

    this.#debugConnectInFlight = true;
    const connectAttempt = ++this.#debugConnectAttempt;

    const port = this.debugPort;
    // Every completion of this attempt (handshake events, TCP failure) is
    // generation-gated on the server run that requested it, so a completion
    // that straddles a stop/restart can never act on the wrong run.
    const startsAtConnect = this.#starts;
    this.#debuggerLifecycle.transition(DebuggerLifecycleStage.connectingTcp, `localhost:${port}`);

    const client = new MinecraftDebugClient();
    this.#debugClient = client;
    this.wireDebugClientEvents(client, startsAtConnect, port);

    try {
      Log.debug(`[Debug] connectDebugClient: Calling connect(localhost, ${port})...`);
      await client.connect("localhost", port);
      Log.debug(`[Debug] connectDebugClient: socket connected, handshake in progress`);
    } catch (e: any) {
      // Deliberate teardown (stop/restart) cancels the attempt by releasing
      // the client reference and/or starting a new run; only a failure that
      // still belongs to the current run may schedule a reconnect.
      const wasCurrentAttempt = this.#debugClient === client && this.#starts === startsAtConnect;

      if (this.#debugClient === client) {
        this.#debugClient = undefined;
      }

      // Dispose before releasing the reference (idempotent; ensures no
      // socket/timer survives unreachably if connect() ever throws late).
      client.disconnect();

      const message = e?.message ? String(e.message) : String(e);
      Log.message(`[Debug] connectDebugClient: TCP connect failed: ${sanitizeDebuggerDiagnosticText(message)}`);

      if (wasCurrentAttempt) {
        // TCP never connected (refused/timeout/unreachable). Deliberately
        // NOT treated as evidence of another debugger owning the endpoint -
        // listener races, firewalls, and BDS shutting down all land here.
        this.#debugAttachFailure = client.lastAttachFailure ?? "connectFailed";
        // Broadcast the terminal state: a panel that hydrated while this
        // attempt was still connecting would otherwise stay on
        // "Connecting..." forever.
        this.#onDebugDisconnected.dispatch(this, message);
      }

      if (
        wasCurrentAttempt &&
        this.#status === DedicatedServerStatus.started &&
        this.#debuggerLifecycle.stage !== DebuggerLifecycleStage.stopping &&
        this.#debuggerLifecycle.stage !== DebuggerLifecycleStage.idle
      ) {
        this.scheduleDebugReconnect(DebuggerFailureKind.tcpConnect, message);
      }
    } finally {
      // Attempt-scoped release: only the attempt that owns the latch may
      // clear it (see #debugConnectAttempt).
      if (this.#debugConnectAttempt === connectAttempt) {
        this.#debugConnectInFlight = false;
      }
    }
  }

  /**
   * Establish the debug session in the OUTBOUND direction: MCT listens on
   * the reserved port and asks BDS to dial it (`script debugger connect`).
   * This is the default for current BDS builds, whose inbound
   * `script debugger listen` listener flaps (accept-then-reset loop, listener
   * torn down and re-armed every few ticks), making the inbound direction
   * unconnectable; the outbound direction matches the official
   * minecraft-debugger extension model and yields a stable session.
   */
  private async connectDebugClientOutbound(port: number): Promise<void> {
    if (this.#debugConnectInFlight) {
      Log.debug(`[Debug] connectDebugClientOutbound: connection already in flight, skipping`);
      return;
    }

    if (this.#debugClient) {
      Log.debug(`[Debug] connectDebugClientOutbound: Already have a debug client, skipping`);
      return;
    }

    this.#debugConnectInFlight = true;
    const connectAttempt = ++this.#debugConnectAttempt;

    const startsAtConnect = this.#starts;

    const client = new MinecraftDebugClient();
    this.#debugClient = client;
    this.wireDebugClientEvents(client, startsAtConnect, port);

    try {
      this.#debuggerLifecycle.transition(
        DebuggerLifecycleStage.connectingTcp,
        `awaiting outbound connect on 127.0.0.1:${port}`
      );

      // Arm the accept listener BEFORE asking BDS to dial: serve() binds
      // synchronously relative to its first await, so the command can never
      // race an unbound port.
      const accepted = client.serve("127.0.0.1", port, DEBUG_LISTENER_READY_TIMEOUT_MS);

      // Swallow-and-inspect below: an unhandled rejection here would escape
      // the floating callers (listen-delay timer, reconnect timer).
      accepted.catch(() => {});

      await this.runCommand(`script debugger connect 127.0.0.1 ${port}`);

      await accepted;

      Log.debug(`[Debug] connectDebugClientOutbound: BDS connected, handshake in progress`);
    } catch (e: any) {
      const wasCurrentAttempt = this.#debugClient === client && this.#starts === startsAtConnect;

      if (this.#debugClient === client) {
        this.#debugClient = undefined;
      }

      const message = e?.message ? String(e.message) : String(e);
      Log.message(`[Debug] connectDebugClientOutbound: failed: ${sanitizeDebuggerDiagnosticText(message)}`);

      if (wasCurrentAttempt) {
        // Release the reservation so a retry re-probes for a free port
        // (a confirmed same-owner claim would otherwise skip the bind probe
        // and retry a port an external process may now hold).
        DebugPortRegistry.release(this.#debugPortReservation);
        this.#debugPortReservation = undefined;

        // Outbound accept failures are transport-level: BDS never dialed (or
        // the accept timed out). Never contention evidence.
        this.#debugAttachFailure = client.lastAttachFailure ?? "connectFailed";

        // Same panel-notification contract as connectDebugClient: the failed
        // attempt never dispatched the client's onDisconnected.
        this.#onDebugDisconnected.dispatch(this, message);

        if (
          this.#status === DedicatedServerStatus.started &&
          this.#debuggerLifecycle.stage !== DebuggerLifecycleStage.stopping &&
          this.#debuggerLifecycle.stage !== DebuggerLifecycleStage.idle
        ) {
          this.scheduleDebugReconnect(DebuggerFailureKind.tcpConnect, message);
        }
      }
    } finally {
      // Attempt-scoped release: only the attempt that owns the latch may
      // clear it (see #debugConnectAttempt).
      if (this.#debugConnectAttempt === connectAttempt) {
        this.#debugConnectInFlight = false;
      }
    }
  }

  /**
   * Wire up debug client events. Handlers ignore stale clients from a
   * previous run (this.#debugClient !== client, or a different #starts).
   */
  private wireDebugClientEvents(client: MinecraftDebugClient, startsAtConnect: number, port: number): void {
    // Fresh client, fresh session facts.
    this.#debugSessionMissingTargetModule = false;

    client.onProtocol.subscribe((_client, protocolEvent) => {
      if (this.#debugClient !== client || this.#starts !== startsAtConnect) {
        return;
      }

      // By the time onProtocol fires, the client has negotiated the version,
      // auto-selected the target module, and sent resume - record each stage
      // so diagnostics show how far the handshake progressed.
      this.#debuggerLifecycle.transition(DebuggerLifecycleStage.negotiating, `server protocol v${protocolEvent.version}`);
      this.#debuggerLifecycle.transition(
        DebuggerLifecycleStage.selectingTarget,
        `${protocolEvent.plugins?.length ?? 0} plugin(s) available`
      );
      this.#debuggerLifecycle.transition(DebuggerLifecycleStage.resuming);
    });

    client.onConnected.subscribe((_client, sessionInfo) => {
      if (this.#debugClient !== client || this.#starts !== startsAtConnect) {
        return;
      }

      this.#debugSessionMissingTargetModule = !sessionInfo.targetModuleUuid;

      // Only a session with a selected script module counts as recovery for
      // the reconnect budget: BDS drops module-less sessions right after the
      // handshake, and resetting here would turn that into an endless
      // connect/drop churn instead of a terminal, actionable failure.
      if (sessionInfo.targetModuleUuid) {
        this.#debugReconnectAttempts = 0;
      }

      this.#debugAttachFailure = undefined;

      this.#debuggerLifecycle.transition(
        DebuggerLifecycleStage.connected,
        `protocol v${sessionInfo.protocolVersion}, port ${port}`
      );
      Log.debug(`[Debug] Debug client connected: protocol v${sessionInfo.protocolVersion}`);

      if (!sessionInfo.targetModuleUuid) {
        Log.message(
          "[Debug] Connected, but no script module was available to select; stats will not stream until a behavior pack with scripts is loaded."
        );
      }

      // A successful handshake supersedes any recorded attach failure.
      this.#debugAttachFailure = undefined;

      this.#onDebugConnected.dispatch(this, sessionInfo);
    });

    client.onDisconnected.subscribe((_client, reason) => {
      this.handleDebugClientDisconnected(client, reason);
    });

    client.onStats.subscribe((_client, statsData) => {
      // Identity-guarded like onProtocol/onConnected: stats from a stale
      // client must not reach the UI - DebugStatsPanel flips its connection
      // status back to connected when stats arrive.
      if (this.#debugClient !== client || this.#starts !== startsAtConnect) {
        return;
      }

      Log.verbose(`[Debug] DedicatedServer: Received stats tick=${statsData.tick}, stats=${statsData.stats.length}`);
      this.#onDebugStats.dispatch(this, statsData);
    });

    client.onStopped.subscribe((_client, stoppedEvent) => {
      if (this.#debugClient !== client || this.#starts !== startsAtConnect) {
        return;
      }

      Log.verbose(`[Debug] Script execution paused: ${stoppedEvent.reason}`);
      this.#onDebugPaused.dispatch(this, stoppedEvent.reason);
    });

    client.onSchema.subscribe((_client, descriptors) => {
      // Identity-guarded like the other subscribers: a stale client's schema
      // must not overwrite the current session's descriptors in the UI.
      if (this.#debugClient !== client || this.#starts !== startsAtConnect) {
        return;
      }

      Log.debug(`[Debug] Diagnostics schema received: ${descriptors.length} descriptors`);
      this.#onDebugSchema.dispatch(this, descriptors);
    });

    client.onProfilerCapture.subscribe((_client, captureEvent) => {
      if (this.#debugClient !== client || this.#starts !== startsAtConnect) {
        return;
      }

      Log.message(`[Debug] Profiler capture received: ${captureEvent.capture_base_path}`);
      this.#onProfilerCapture.dispatch(this, captureEvent);
    });

    client.onError.subscribe((_client, error) => {
      Log.debug(`Debug client error: ${error}`);
    });
  }

  /**
   * Handle a debug client disconnect: release the client reference so a
   * reconnect is possible, then either reconnect (transient causes) or fail
   * with a specific kind (causes a blind reconnect cannot fix).
   */
  private handleDebugClientDisconnected(client: MinecraftDebugClient, reason: string) {
    if (this.#debugClient !== client) {
      return; // Stale client from a previous run
    }

    this.#debugClient = undefined;

    Log.debug(`[Debug] Debug client disconnected: ${reason}`);

    let kind = classifyDebugClientDisconnectReason(reason);
    const isTypedRejection =
      kind === DebuggerFailureKind.passcode ||
      kind === DebuggerFailureKind.protocolMismatch ||
      kind === DebuggerFailureKind.settings;

    // A disconnect BEFORE the handshake ever completed (accept-then-close,
    // handshake timeout) is an attach failure - record its typed reason so
    // debugOwnership can classify it. connect() resolves at TCP connect, so
    // these failures only surface here. A TYPED rejection (passcode,
    // protocol mismatch, settings) is the opposite of contention evidence:
    // Minecraft told us exactly why it refused THIS session, so the generic
    // accept-then-close signature must not stand - with a confirmed
    // listener, debugOwnership would read it as "another debugger owns the
    // endpoint" and the panel would pair the real failure with the wrong
    // stop-the-other-debugger instruction. Clear the latch instead.
    if (isTypedRejection) {
      this.#debugAttachFailure = undefined;
    } else if (client.lastAttachFailure !== undefined) {
      this.#debugAttachFailure = client.lastAttachFailure;
    }

    this.#onDebugDisconnected.dispatch(this, reason);

    // Deliberate teardown (stop/restart) - don't classify or reconnect
    if (
      this.#status !== DedicatedServerStatus.started ||
      this.#debuggerLifecycle.stage === DebuggerLifecycleStage.stopping ||
      this.#debuggerLifecycle.stage === DebuggerLifecycleStage.idle
    ) {
      return;
    }

    let message = reason;

    // BDS closes a session right after the handshake when it had no script
    // module to select (no behavior pack with scripts on the world). The raw
    // socket close would classify as prematureClose; surface the actual,
    // actionable cause instead.
    if (kind === DebuggerFailureKind.prematureClose && this.#debugSessionMissingTargetModule) {
      kind = DebuggerFailureKind.moduleSelection;
      message =
        `${reason} - the connection closed right after the handshake and no script module was available to select. ` +
        "Ensure a behavior pack with a script module is on the world, then retry.";
    }

    if (isTypedRejection) {
      this.failDebugger(kind, message);
      return;
    }

    this.scheduleDebugReconnect(kind, message);
  }

  /**
   * Schedule a reconnect attempt with exponential backoff. Gives up (and
   * fails with the triggering kind) after DEBUG_RECONNECT_MAX_ATTEMPTS.
   */
  private scheduleDebugReconnect(kind: DebuggerFailureKind, message: string) {
    if (this.#debugReconnectTimer) {
      return;
    }

    if (this.#debugReconnectAttempts >= DEBUG_RECONNECT_MAX_ATTEMPTS) {
      this.failDebugger(kind, `${message} (giving up after ${DEBUG_RECONNECT_MAX_ATTEMPTS} reconnect attempts)`);
      return;
    }

    this.#debugReconnectAttempts++;

    const delayMs = DEBUG_RECONNECT_BASE_DELAY_MS * Math.pow(2, this.#debugReconnectAttempts - 1);

    this.#debuggerLifecycle.transition(
      DebuggerLifecycleStage.reconnecting,
      `attempt ${this.#debugReconnectAttempts}/${DEBUG_RECONNECT_MAX_ATTEMPTS} in ${delayMs}ms`
    );

    const startsAtSchedule = this.#starts;

    this.#debugReconnectTimer = setTimeout(() => {
      this.#debugReconnectTimer = undefined;

      // The timer is cleared when a stop begins (cancelDebuggerWork), but
      // gate anyway: the run that armed it must still be the active, started,
      // non-stopping run - status alone stays "started" through the whole
      // graceful-stop window, so it is not a sufficient guard.
      if (
        this.#status !== DedicatedServerStatus.started ||
        this.#starts !== startsAtSchedule ||
        this.#debuggerLifecycle.stage === DebuggerLifecycleStage.stopping ||
        this.#debuggerLifecycle.stage === DebuggerLifecycleStage.idle
      ) {
        return;
      }

      if (this.#debugListenerReady) {
        this.connectDebugClient();
      } else {
        // Floated: see beginDebuggerSetup - the listener flow handles its
        // own errors; this only prevents an unhandled rejection.
        this.startDebuggerListener().catch((e: unknown) => {
          Log.error(`[Debug] Unexpected error from the debugger listener startup: ${e}`);
        });
      }
    }, delayMs);
  }

  /**
   * User-initiated retry (e.g., from the DebugStatsPanel Retry action).
   * Reuses the confirmed listener when possible; otherwise restarts the
   * listener flow from port reservation.
   */
  async retryDebugConnection(): Promise<boolean> {
    if (this.#status !== DedicatedServerStatus.started || !this.#enableDebugger) {
      return false;
    }

    this.clearDebuggerTimers();
    this.#debugReconnectAttempts = 0;
    // A user retry supersedes any in-flight listener attempt - without this,
    // the fresh startDebuggerListener below would join the canceled attempt.
    this.invalidateDebugListenerAttempt();
    this.#awaitingDebuggerListening = false;

    this.disconnectDebugClient();

    if (this.#debugListenerReady && this.#debugPortReservation !== undefined) {
      await this.connectDebugClient();
    } else {
      this.#debugListenerReady = false;
      DebugPortRegistry.release(this.#debugPortReservation);
      this.#debugPortReservation = undefined;
      await this.startDebuggerListener();
    }

    return true;
  }

  /**
   * Cancel all scheduled and in-flight debugger work immediately: transitions
   * the lifecycle to stopping (so disconnect handling treats socket closes as
   * deliberate teardown), clears the reconnect/listener/delay timers, and
   * disconnects the client - which also aborts a pending
   * MinecraftDebugClient.connect() retry loop before it can assign a socket.
   * Invoked when a stop begins; the timer callbacks and connect completions
   * are additionally generation-gated on #starts as a second line of defense.
   */
  cancelDebuggerWork(detail: string) {
    this.#debuggerLifecycle.transition(DebuggerLifecycleStage.stopping, detail);
    this.resetDebuggerRuntimeState(true);
  }

  private failDebugger(kind: DebuggerFailureKind, message: string) {
    Log.message(`[Debug] Debugger flow failed (${kind}): ${sanitizeDebuggerDiagnosticText(message)}`);
    this.#debuggerLifecycle.fail(kind, message);
  }

  /**
   * Mark the debugger lifecycle terminally failed because BDS startup
   * preflight failed (missing executable, invalid signature, non-Microsoft
   * signer). The lifecycle enters startingServer before preflight, so every
   * preflight early-return must land it on a terminal stage - otherwise
   * diagnostics claim "Starting server" forever for a start that
   * definitively failed. No-op when the debugger is disabled (the lifecycle
   * is idle then, which is already terminal).
   */
  private failDebuggerForStartupPreflight(message: string) {
    if (!this.#enableDebugger) {
      return;
    }

    this.failDebugger(DebuggerFailureKind.serverStartup, message);
  }

  private clearDebuggerTimers() {
    if (this.#debugListenDelayTimer) {
      clearTimeout(this.#debugListenDelayTimer);
      this.#debugListenDelayTimer = undefined;
    }

    if (this.#debugListenerReadyTimeout) {
      clearTimeout(this.#debugListenerReadyTimeout);
      this.#debugListenerReadyTimeout = undefined;
    }

    if (this.#debugReconnectTimer) {
      clearTimeout(this.#debugReconnectTimer);
      this.#debugReconnectTimer = undefined;
    }
  }

  /**
   * Release all debugger runtime state: timers, listener flags, pending
   * reconnects, the client socket, and (optionally) the port reservation.
   * Called on stop, on restart, and before starting a fresh flow so no state
   * leaks across runs.
   */
  resetDebuggerRuntimeState(releasePort: boolean) {
    this.invalidateDebugListenerAttempt();
    this.clearDebuggerTimers();

    this.#awaitingDebuggerListening = false;
    this.#debugListenerReady = false;
    this.#debugListenerConfirmed = false;
    this.#debugAttachFailure = undefined;
    this.#releaseDebugConnectLatch();
    this.#debugReconnectAttempts = 0;

    this.disconnectDebugClient();

    if (releasePort && this.#debugPortReservation !== undefined) {
      DebugPortRegistry.release(this.#debugPortReservation);
      this.#debugPortReservation = undefined;
    }

    return true;
  }

  /**
   * Explicit, user-driven retry of the debug attach (the "Check again" /
   * "Retry connection" actions in the diagnostics panel). Clears the
   * attach-failure latch and re-runs the lifecycle's user-retry path.
   * Concurrent callers share the in-flight attempt's promise, so everyone
   * receives the settled outcome - connected, a typed failure, or the real
   * handshake deadline elapsing - instead of a premature state snapshot. The
   * onDebugConnected / onDebugDisconnected events broadcast state as usual.
   */
  async reattachDebugClient(): Promise<{ connected: boolean; ownership: DebugOwnershipState }> {
    if (this.#debugReattachPromise) {
      return this.#debugReattachPromise;
    }

    this.#debugReattachPromise = this.#runDebugReattach().finally(() => {
      this.#debugReattachPromise = undefined;
    });

    return this.#debugReattachPromise;
  }

  async #runDebugReattach(): Promise<{ connected: boolean; ownership: DebugOwnershipState }> {
    if (this.#debugClient?.isConnected) {
      return { connected: true, ownership: this.debugOwnership };
    }

    // Discard the current client so connectDebugClient's "already have a
    // debug client" guard doesn't skip the attempt. disconnect() also CANCELS
    // a dial still in flight (an automatic attach we're racing): the client's
    // retry loop observes the cancellation and aborts, and the identity
    // guards in the event subscribers keep the discarded client from ever
    // mutating state that belongs to its replacement.
    if (this.#debugClient) {
      this.#debugClient.disconnect();
      this.#debugClient = undefined;
    }
    this.#debugAttachFailure = undefined;

    // The canceled automatic attach may still OWN the global connect latch
    // (its retry loop only observes the cancellation when its backoff sleep
    // or dial settles). Release it on the canceled attempt's behalf - with
    // the generation advanced, the stale attempt's own finally can no longer
    // clear the latch the replacement is about to take - or the
    // connectDebugClient below would skip the replacement entirely and this
    // reattach would report not-connected without ever dialing.
    this.#releaseDebugConnectLatch();

    Log.debug(`[Debug] reattachDebugClient: retrying debug attach on port ${this.debugPort}...`);

    if (this.#status === DedicatedServerStatus.started && this.#enableDebugger) {
      // Managed flow: reuse the lifecycle's user-retry path - it supersedes
      // an in-flight listener attempt, resets the reconnect budget, and
      // restarts from port reservation when the listener isn't confirmed.
      await this.retryDebugConnection();
    } else {
      // Direct endpoint reattach (no managed listener flow to restart, e.g.
      // an externally hosted debug endpoint). The current client was already
      // discarded above, so connectDebugClient's "already have a debug
      // client" guard cannot skip the attempt.

      // disconnect() cancels a still-dialing automatic attach, but its retry
      // loop only observes the cancellation when its current backoff sleep
      // elapses; until then the connect debounce stays taken and
      // connectDebugClient() would skip this attempt entirely - the reattach
      // then reports a premature not-connected outcome while the canceled
      // dial's debounce drains. Wait the debounce out (bounded well above
      // one backoff window) so the reattach's own dial actually starts.
      const debounceDeadline = Date.now() + 5000;

      while (this.#debugConnectInFlight && Date.now() < debounceDeadline) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      await this.connectDebugClient();
    }

    // The retry resolves at TCP connect; the ProtocolEvent handshake
    // completes asynchronously. Wait for it to settle (or fail) so the
    // reported outcome reflects an actual negotiation. The deadline covers
    // the client's full handshake window (plus scheduling slack) so a
    // slow-but-valid negotiation is never reported as disconnected. Re-read
    // the field each iteration: a handshake failure clears it via the
    // disconnect handler.
    const deadline = Date.now() + PROTOCOL_HANDSHAKE_TIMEOUT_MS + 2000;
    // Cast: TS control-flow narrowing pinned #debugClient to undefined from
    // the discard above and doesn't see connectDebugClient's reassignment.
    let client = this.#debugClient as MinecraftDebugClient | undefined;
    while (Date.now() < deadline && client !== undefined && client.state === DebugConnectionState.Connecting) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      client = this.#debugClient as MinecraftDebugClient | undefined;
    }

    return { connected: client?.isConnected === true, ownership: this.debugOwnership };
  }

  /**
   * Release the connect in-flight latch on behalf of a CANCELED attempt and
   * advance the attempt generation, so a replacement may dial immediately
   * while the canceled attempt's late settlement (see connectDebugClient's
   * finally) can no longer clear the replacement's latch.
   */
  #releaseDebugConnectLatch() {
    this.#debugConnectAttempt++;
    this.#debugConnectInFlight = false;
  }

  /**
   * Disconnect the debug client if connected.
   */
  disconnectDebugClient() {
    const client = this.#debugClient;

    // Clear the reference first so the onDisconnected handler recognizes this
    // as a deliberate teardown and does not schedule a reconnect.
    this.#debugClient = undefined;

    if (client) {
      client.disconnect();
    }
    this.#debugAttachFailure = undefined;
  }

  /**
   * Build a sanitized diagnostics snapshot for support / copy-to-clipboard.
   * Includes only infrastructure log lines (never creator content, player
   * chat, or command output), and all text is scrubbed of filesystem paths,
   * passcodes, and tokens.
   */
  getDebugDiagnostics(): IDebuggerDiagnostics {
    const sessionInfo = this.#debugClient?.sessionInfo;

    const allowedCategories = [
      ServerMessageCategory.serverStarting,
      ServerMessageCategory.version,
      ServerMessageCategory.openingLevel,
      ServerMessageCategory.ipv4supported,
      ServerMessageCategory.ipv6supported,
      ServerMessageCategory.serverStarted,
      ServerMessageCategory.debuggerListening,
      ServerMessageCategory.debuggerClosing,
      ServerMessageCategory.debuggerFailedToStart,
      ServerMessageCategory.serverStopRequested,
      ServerMessageCategory.serverStopping,
      ServerMessageCategory.serverStopped,
    ];

    const recentServerMessages: string[] = [];

    for (let i = Math.max(0, this.outputLines.length - 200); i < this.outputLines.length; i++) {
      const outputLine = this.outputLines[i];
      const sm = new ServerMessage(outputLine.message);

      if (allowedCategories.includes(sm.category)) {
        recentServerMessages.push(sanitizeDebuggerDiagnosticText(outputLine.message));
      }
    }

    return {
      stage: this.#debuggerLifecycle.stage,
      failureKind: this.#debuggerLifecycle.failureKind,
      errorMessage: this.#debuggerLifecycle.errorMessage,
      generatedAt: new Date().toISOString(),
      bdsVersion: this.#bdsVersion ?? this.version?.version,
      serverPort: this.#port,
      debugPort: this.debugPort,
      // The persisted values the last debugger setup actually acted on -
      // NOT the in-memory write-intent defaults, which can claim enabled
      // while the persisted false is what failed the settings stage.
      // undefined = no setup has read the file yet (or it was unreadable).
      inboundScriptDebuggingEnabled: this.#effectiveInboundScriptDebugging,
      outboundScriptDebuggingEnabled: this.#effectiveOutboundScriptDebugging,
      protocolVersion: sessionInfo?.protocolVersion,
      // Derived boolean only: the raw module UUID is creator-identifying
      // and this snapshot reaches the clipboard verbatim (see
      // IDebuggerDiagnostics.hasTargetModule).
      hasTargetModule: sessionInfo?.targetModuleUuid !== undefined ? true : undefined,
      pluginCount: sessionInfo?.plugins?.length,
      stageHistory: this.#debuggerLifecycle.history,
      recentServerMessages: recentServerMessages.slice(-30),
    };
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
