/**
 * ==========================================================================================
 * DEBUG STATS PANEL
 * ==========================================================================================
 *
 * Real-time display of Minecraft script debugger diagnostics.
 *
 * OVERVIEW:
 * ---------
 * This component displays diagnostics received from the Minecraft script
 * debugger via WebSocket notifications (web/server mode) or Electron IPC. It
 * shows:
 *
 * - Connection state, negotiated protocol version, selected script module,
 *   target endpoint host:port, single-client ownership state, and last tick
 * - Protocol v10 schema-driven diagnostics tabs (SchemaEvent descriptors)
 *   populated with live StatEvent2 values
 * - The legacy hardcoded stat-category view when the target provides no schema
 *   (protocol < v9), preserving pre-v10 behavior
 * - Pause/Resume and Profiler controls, capability-gated by the negotiated
 *   protocol version (unsupported actions are hidden, not disabled)
 *
 * PROTOCOL V10 DIAGNOSTICS SCHEMA:
 * --------------------------------
 * Protocol v9 adds a "SchemaEvent" carrying DiagnosticsTabDescriptor entries
 * (see IMinecraftDebugProtocol.ts); v10 adds is_empty_tab, which flags views
 * that are INTENTIONALLY empty on this target (e.g. client-only views when
 * attached to a dedicated server). Empty tabs render an explicit "intentionally
 * empty" state - never "waiting for data". The schema belongs to the active
 * session: it is stored on connect/SchemaEvent and cleared on disconnect, so a
 * reconnect or target change renegotiates it. Malformed descriptors surface as
 * an actionable error banner; valid descriptors still render.
 *
 * SINGLE-CLIENT OWNERSHIP:
 * ------------------------
 * Minecraft's debug endpoint accepts only ONE attached debugger at a time.
 * When MCT can't attach because VS Code (or another debugger) owns the
 * endpoint, this panel explains that and tells the user how to hand over
 * ownership (stop the VS Code debug session, then retry).
 *
 * PANEL DISPLAY STATES (derived in DiagnosticsSchemaUtilities):
 * -------------------------------------------------------------
 * diagnosticsDisabled | disconnected | ownedExternally | connecting |
 * loadingSchema | noEvents | stale | active - plus paused and schema-error
 * banners overlaid on the data states.
 *
 * DATA FLOW:
 * ----------
 * Mode 1 - WebSocket (HttpStorage / web server mode):
 *   1. Server connects to Minecraft debug port (19144) via MinecraftDebugClient
 *   2. Debug events are forwarded as WebSocket notifications (debugStats,
 *      debugSchema, debugConnected, ...)
 *   3. Initial state (including a schema negotiated before mount) comes from
 *      GET /api/{slot}/status?slotConfig=true
 *   4. Pause/resume/profiler commands sent via HTTP REST API
 *
 * Mode 2 - Electron IPC (ProcessHostedMinecraft):
 *   1. DedicatedServer in main process connects to Minecraft debug port
 *   2. Debug events forwarded via IPC (webContents.send → AppServiceProxy)
 *   3. ProcessHostedMinecraft dispatches typed events to this component
 *   4. Pause/resume/profiler commands sent via IPC (AppServiceProxy.sendAsync)
 *
 * WEBSOCKET SUBSCRIPTION LIFECYCLE:
 * ----------------------------------
 * componentDidMount attaches the message listener, retries subscription every
 * 2 seconds until the storage connects, and fetches initial status from REST.
 * componentDidUpdate resets and re-attaches when the webSocket, storage, or
 * slot PROPS change - any of them repoints the panel at a different
 * diagnostics source, and socket inequality alone doesn't cover a slot change
 * on a shared socket or a storage swap while neither has a socket yet.
 * HttpStorage also replaces its socket internally on auto-reconnect with no
 * prop changing - the _trySubscribe interval detects that by comparing the
 * instance the listener is attached to (_attachedWebSocket) against the
 * storage's current socket, then re-attaches and re-subscribes (server-side
 * subscriptions are per-connection). componentWillUnmount cleans up listeners
 * and intervals. See _trySubscribe for the event list.
 *
 * HYDRATION STALENESS:
 * --------------------
 * The late-mount hydration snapshot (REST /status, debug-status IPC) is
 * asynchronous, so a live disconnect/schema/reconnect event or a transport
 * swap (new WebSocket, different minecraft instance) can land while the
 * request is pending. Snapshots are applied through a HydrationGate
 * (DebugPanelHydration.ts): live session events and source changes bump a
 * generation, and a snapshot whose request predates the current generation or
 * whose source is no longer the active transport is discarded - live events
 * always win over an older in-flight snapshot.
 *
 * The gate only covers in-flight snapshots; state already rendered from the
 * previous source is a separate hazard. A source swap (different minecraft
 * instance, new WebSocket/storage) therefore also resets the panel to
 * _initialSessionState before re-hydrating, so the old server's schema,
 * stats, and connection details never bleed into the new session - even when
 * the new source has no schema yet or speaks a pre-v9 protocol.
 *
 * RELATED FILES:
 * --------------
 * - MinecraftDebugClient.ts: Server-side debug protocol client (stores schema)
 * - DiagnosticsSchemaUtilities.ts: Schema validation/UI models/state derivation
 * - DebugPanelHydration.ts: Hydration staleness gating (generation + source)
 * - IServerNotification.ts: Notification message types
 * - DedicatedServer.ts: Debug client integration + ownership state
 * - HttpServer.ts: WebSocket notification broadcasting (web server mode)
 * - ProcessHostedProxyMinecraft.ts: IPC debug event proxy (Electron mode)
 * - DedicatedServerCommandHandler.ts: IPC debug event forwarding (Electron main)
 *
 * ==========================================================================================
 */
import { Component, SyntheticEvent } from "react";
import { Tabs, Tab, Button } from "@mui/material";
import "./DebugStatsPanel.css";
import {
  IDebugStatsNotificationBody,
  IDebugConnectedNotificationBody,
  IDebugDisconnectedNotificationBody,
  IDebugSchemaNotificationBody,
  IDebugPausedNotificationBody,
  IDebugResumedNotificationBody,
  IDebugProfilerStateNotificationBody,
  IDebugStageNotificationBody,
  IProfilerCaptureNotificationBody,
  IDebugStatItem,
  DEBUG_PANEL_SUBSCRIPTION_EVENTS,
} from "../../app/IServerNotification";
import {
  DebuggerFailureKind,
  DebuggerRecoveryAction,
  getRecoveryActionsForFailure,
} from "../../debugger/DebuggerLifecycle";
import {
  buildControlsModel,
  buildSchemaModel,
  buildTableRows,
  derivePanelDisplayState,
  matchStatsForTab,
  scaleStatValue,
  DiagnosticsPanelDisplayState,
  IDiagnosticsSchemaModel,
  IDiagnosticsTabModel,
  STALE_EVENT_THRESHOLD_MS,
} from "../../debugger/DiagnosticsSchemaUtilities";
import {
  DebugOwnershipState,
  IMinecraftDebugCapabilities,
  IPluginDetails,
} from "../../debugger/IMinecraftDebugProtocol";
import { HydrationGate, applyHydrationSnapshot } from "../../debugger/DebugPanelHydration";
import HttpStorage from "../../storage/HttpStorage";
import { ISlotConfig } from "../../app/CreatorToolsAuthentication";
import IProjectTheme from "../types/IProjectTheme";
import Log from "../../core/Log";
import ProcessHostedMinecraft from "../../clientapp/ProcessHostedProxyMinecraft";

/**
 * Parsed profiler data entry.
 */
interface IProfilerEntry {
  name: string;
  selfTime: number;
  totalTime: number;
  callCount: number;
}

/** Human-readable labels for debugger lifecycle stages (DebuggerLifecycle.ts). */
const STAGE_LABELS: Record<string, string> = {
  idle: "Debugger idle",
  configuring: "Checking debugger settings...",
  startingServer: "Starting server...",
  startingListener: "Starting debug listener...",
  waitingForReadiness: "Waiting for debugger readiness...",
  connectingTcp: "Connecting...",
  negotiating: "Negotiating protocol...",
  selectingTarget: "Selecting script module...",
  resuming: "Resuming scripts...",
  connected: "Connected",
  reconnecting: "Reconnecting...",
  stopping: "Stopping...",
  failed: "Failed",
};

/** Human-readable labels for debugger failure kinds (DebuggerLifecycle.ts). */
const FAILURE_LABELS: Record<string, string> = {
  settings: "Debugger settings issue",
  serverStartup: "Server failed to start",
  portOccupied: "Debug port occupied",
  listenerReadiness: "Debug listener did not start",
  tcpConnect: "TCP connection failed",
  handshakeTimeout: "Debugger handshake timed out",
  protocolMismatch: "Protocol mismatch",
  passcode: "Passcode required",
  moduleSelection: "Script module selection failed",
  sourceMapConfiguration: "Source map configuration issue",
  prematureClose: "Connection closed unexpectedly",
};

interface IDebugStatsPanelProps {
  /** Fluent UI theme */
  theme: IProjectTheme;
  /** Server slot to display stats for */
  slot?: number;
  /** Optional WebSocket for receiving notifications */
  webSocket?: WebSocket;
  /** Optional HttpStorage to get WebSocket from */
  storage?: HttpStorage;
  /** Optional ProcessHostedMinecraft for Electron IPC-based debug events */
  minecraft?: ProcessHostedMinecraft;
  /** Optional handler to open debugger/server settings (recovery action) */
  onChangeSettings?: () => void;
  /** Optional handler to reveal the server log view (recovery action) */
  onViewLogs?: () => void;
}

interface IDebugStatsPanelState {
  /** Current connection status */
  connectionStatus: "connected" | "disconnected" | "connecting";
  /** Protocol version (if connected) */
  protocolVersion?: number;
  /** Current tick number */
  tick: number;
  /** Current stats data */
  stats: IDebugStatItem[];
  /** Disconnect reason (if disconnected) */
  disconnectReason?: string;
  /** Whether script execution is paused */
  isPaused: boolean;
  /** Whether the profiler is running */
  isProfilerRunning: boolean;
  /** Captured profiler data (parsed) */
  profilerData: IProfilerEntry[];
  /** Whether to show the profiler results panel */
  showProfilerResults: boolean;
  /** Validated diagnostics schema for the active session (v9+); cleared on disconnect */
  schema?: IDiagnosticsSchemaModel;
  /** Currently selected schema tab id */
  selectedTabId?: string;
  /** UUID of the script module the session targets */
  targetModuleUuid?: string;
  /** Script modules on the target; empty array = diagnostics-only session */
  plugins?: IPluginDetails[];
  /** Debug endpoint host */
  endpointHost?: string;
  /** Debug endpoint port */
  endpointPort?: number;
  /** Negotiated protocol capabilities (for control gating) */
  capabilities?: Partial<IMinecraftDebugCapabilities>;
  /** Who owns the single-client debug endpoint */
  ownership: DebugOwnershipState;
  /** Whether the server has diagnostics/debugger streaming enabled */
  diagnosticsEnabled: boolean;
  /** Timestamp (ms) of the last debugger event received */
  lastEventAt?: number;
  /** Timestamp (ms) when this session connected; bounds the schema-load grace */
  connectedAt?: number;
  /** Whether any StatEvent2 arrived this session */
  hasReceivedStats: boolean;
  /** Monotonic counter bumped by an interval so staleness re-renders */
  staleCheckTick: number;
  /** Current debugger lifecycle stage (DebuggerLifecycleStage value; from debugStage WS notification or IPC) */
  stage?: string;
  /** Failure kind when stage is "failed" (DebuggerFailureKind value) */
  failureKind?: string;
  /** Sanitized failure message when stage is "failed" */
  stageMessage?: string;
  /** Dynamically reserved debug port, for diagnostics display */
  debugPort?: number;
  /** Transient "Copied!" feedback for the Copy Diagnostic Details action */
  diagnosticsCopied: boolean;
}

/**
 * Categorized stats for display (legacy hardcoded view).
 */
interface IStatCategory {
  name: string;
  stats: IDebugStatItem[];
}

export default class DebugStatsPanel extends Component<IDebugStatsPanelProps, IDebugStatsPanelState> {
  private _wsMessageHandler: ((event: MessageEvent) => void) | null = null;
  // The exact WebSocket instance the message listener is attached to.
  // HttpStorage replaces its socket internally on auto-reconnect without any
  // prop changing, so this - not props - is what detection and cleanup must
  // compare against.
  private _attachedWebSocket: WebSocket | null = null;
  private _subscribeInterval: ReturnType<typeof setInterval> | null = null;
  private _staleCheckInterval: ReturnType<typeof setInterval> | null = null;
  private _hasSubscribed: boolean = false;
  // IPC event unsubscribers
  private _ipcUnsubs: (() => void)[] = [];
  // Guards late-mount hydration snapshots against races with live session
  // events and transport swaps (see DebugPanelHydration.ts).
  private _hydrationGate = new HydrationGate();

  /**
   * Baseline state for a debug session. Applied at construction and re-applied
   * whenever the panel is repointed at a different source (minecraft instance
   * or WebSocket/storage). Every field here is scoped to one attached session
   * on one source: the hydration gate only discards in-flight snapshots, so
   * without this reset a source swap would leave the previous server's schema,
   * stats, and connection details rendered until (unless) the new source
   * overwrites them. Optional fields are listed with explicit undefined so
   * setState clears them.
   */
  private static readonly _initialSessionState: IDebugStatsPanelState = {
    connectionStatus: "connecting",
    protocolVersion: undefined,
    tick: 0,
    stats: [],
    disconnectReason: undefined,
    isPaused: false,
    isProfilerRunning: false,
    profilerData: [],
    showProfilerResults: false,
    schema: undefined,
    selectedTabId: undefined,
    targetModuleUuid: undefined,
    plugins: undefined,
    endpointHost: undefined,
    endpointPort: undefined,
    capabilities: undefined,
    ownership: "unknown",
    diagnosticsEnabled: true,
    lastEventAt: undefined,
    connectedAt: undefined,
    hasReceivedStats: false,
    staleCheckTick: 0,
    stage: undefined,
    failureKind: undefined,
    stageMessage: undefined,
    debugPort: undefined,
    diagnosticsCopied: false,
  };

  constructor(props: IDebugStatsPanelProps) {
    super(props);

    this.state = { ...DebugStatsPanel._initialSessionState };

    this._handleWebSocketMessage = this._handleWebSocketMessage.bind(this);
    this._trySubscribe = this._trySubscribe.bind(this);
    this._fetchInitialDebugStatus = this._fetchInitialDebugStatus.bind(this);
    this._handlePauseResume = this._handlePauseResume.bind(this);
    this._handleProfilerToggle = this._handleProfilerToggle.bind(this);
    this._handleProfilerCapture = this._handleProfilerCapture.bind(this);
    this._handleTabChange = this._handleTabChange.bind(this);
    this._handleRetryAttach = this._handleRetryAttach.bind(this);
    this._handleRetry = this._handleRetry.bind(this);
    this._handleCopyDiagnostics = this._handleCopyDiagnostics.bind(this);
    this._handleStopServer = this._handleStopServer.bind(this);
  }

  componentDidMount() {
    if (this.props.minecraft) {
      // Electron IPC mode - subscribe to future events, then hydrate the
      // current session/schema state (which may predate this mount).
      this._hydrationGate.setSource(this.props.minecraft);
      this._setupIpcEvents(this.props.minecraft);
      this._hydrateFromIpcStatus(this.props.minecraft);
    } else {
      // WebSocket/HttpStorage mode
      this._hydrationGate.setSource(this.props.storage);
      this._setupWebSocket();
      this._trySubscribe();
      this._subscribeInterval = setInterval(this._trySubscribe, 2000);
      this._fetchInitialDebugStatus();
    }

    // Re-render periodically so time-derived states can appear even when no
    // new events arrive to trigger a render: stale/no-recent-events once stats
    // have flowed, and the schema-load grace expiring while none have.
    this._staleCheckInterval = setInterval(() => {
      if (this.state.connectionStatus === "connected") {
        this.setState({ staleCheckTick: this.state.staleCheckTick + 1 });
      }
    }, 2000);
  }

  componentDidUpdate(prevProps: IDebugStatsPanelProps) {
    if (this.props.minecraft) {
      // IPC mode - check if minecraft instance changed
      if (prevProps.minecraft !== this.props.minecraft) {
        // Re-source the gate FIRST so a hydration still pending against the
        // previous instance is discarded instead of applied to this one, and
        // drop the previous instance's session state so it can't render
        // against the new source while hydration is in flight.
        this._hydrationGate.setSource(this.props.minecraft);
        this.setState({ ...DebugStatsPanel._initialSessionState });
        this._cleanupIpcEvents();
        this._setupIpcEvents(this.props.minecraft);
        this._hydrateFromIpcStatus(this.props.minecraft);
      }
    } else {
      // WebSocket mode. Socket inequality alone is NOT the whole source
      // identity: the panel can be repointed at a different SLOT over the
      // same shared socket, or at a different STORAGE while neither side has
      // a socket yet (undefined compares equal). Each of those is a new
      // diagnostics source too.
      const prevWs = prevProps.webSocket || prevProps.storage?.webSocket;
      const currentWs = this.props.webSocket || this.props.storage?.webSocket;
      const sourceChanged =
        prevWs !== currentWs || prevProps.storage !== this.props.storage || prevProps.slot !== this.props.slot;
      if (sourceChanged) {
        // A new source is a new notification session: supersede any pending
        // hydration from before the swap, and drop the previous session's
        // rendered state - the re-subscribe path re-fetches /status (at the
        // current slot), which rebuilds it from the new source. Without the
        // reset, a swap to a source with no schema yet (or pre-v9) keeps the
        // old server's schema and stats on screen indefinitely.
        this._hydrationGate.setSource(this.props.storage);
        this._hydrationGate.noteSessionEvent();
        this.setState({ ...DebugStatsPanel._initialSessionState });
        this._cleanupWebSocket();
        this._setupWebSocket();
        this._hasSubscribed = false;
        this._trySubscribe();
      }
    }
  }

  componentWillUnmount() {
    this._cleanupWebSocket();
    this._cleanupIpcEvents();
    if (this._subscribeInterval) {
      clearInterval(this._subscribeInterval);
      this._subscribeInterval = null;
    }
    if (this._staleCheckInterval) {
      clearInterval(this._staleCheckInterval);
      this._staleCheckInterval = null;
    }
    if (this._copiedResetTimer) {
      clearTimeout(this._copiedResetTimer);
      this._copiedResetTimer = null;
    }
  }

  /**
   * Set up event subscriptions from a ProcessHostedMinecraft instance (Electron IPC mode).
   */
  private _setupIpcEvents(mc: ProcessHostedMinecraft) {
    this._cleanupIpcEvents();
    this._receivedLiveStage = false;

    const connSub = mc.onDebugConnected.subscribe((_sender, body) => {
      this._handleDebugConnected(body);
    });
    const discSub = mc.onDebugDisconnected.subscribe((_sender, body) => {
      this._handleDebugDisconnected(body);
    });
    const statsSub = mc.onDebugStats.subscribe((_sender, body) => {
      this._handleDebugStats(body);
    });
    const schemaSub = mc.onDebugSchema.subscribe((_sender, body) => {
      this._handleDebugSchema(body);
    });
    const pauseSub = mc.onDebugPaused.subscribe((_sender, body) => {
      this._handleDebugPaused(body);
    });
    const resumeSub = mc.onDebugResumed.subscribe((_sender, body) => {
      this._handleDebugResumed(body);
    });
    const profStateSub = mc.onDebugProfilerState.subscribe((_sender, body) => {
      this._handleDebugProfilerState(body);
    });
    const profCaptureSub = mc.onProfilerCapture.subscribe((_sender, body) => {
      this._handleProfilerCapture(body);
    });
    const stageSub = mc.onDebugStage.subscribe((_sender, body) => {
      // A live stage event supersedes the stage fields of any hydration
      // snapshot still in flight - the snapshot must never overwrite newer
      // live stage state.
      this._receivedLiveStage = true;
      this._handleDebugStage(body);
    });

    this._ipcUnsubs = [
      () => mc.onDebugConnected.unsubscribe(connSub),
      () => mc.onDebugDisconnected.unsubscribe(discSub),
      () => mc.onDebugStats.unsubscribe(statsSub),
      () => mc.onDebugSchema.unsubscribe(schemaSub),
      () => mc.onDebugPaused.unsubscribe(pauseSub),
      () => mc.onDebugResumed.unsubscribe(resumeSub),
      () => mc.onDebugProfilerState.unsubscribe(profStateSub),
      () => mc.onProfilerCapture.unsubscribe(profCaptureSub),
      () => mc.onDebugStage.unsubscribe(stageSub),
    ];
  }

  // True once a live debugStage event arrived on the current transport (IPC
  // event or WebSocket notification); the stage fields of a hydration
  // snapshot resolving after that are stale and must not overwrite the newer
  // live state. Session fields (schema, capabilities, ...) are separately
  // protected by the HydrationGate.
  private _receivedLiveStage: boolean = false;

  /**
   * Clean up IPC event subscriptions.
   */
  private _cleanupIpcEvents() {
    for (const unsub of this._ipcUnsubs) {
      try {
        unsub();
      } catch {
        // Ignore
      }
    }
    this._ipcUnsubs = [];
  }

  /**
   * Get the WebSocket to use for notifications.
   */
  private _getWebSocket(): WebSocket | null {
    return this.props.webSocket || this.props.storage?.webSocket || null;
  }

  private _setupWebSocket() {
    const ws = this._getWebSocket();
    if (ws) {
      // A fresh transport means fresh live-stage tracking: without this
      // reset, a live stage event on the PREVIOUS socket would leave the
      // guard set and the new transport's hydration snapshot could not
      // hydrate the stage.
      this._receivedLiveStage = false;
      this._wsMessageHandler = this._handleWebSocketMessage;
      ws.addEventListener("message", this._wsMessageHandler);
      this._attachedWebSocket = ws;
    }
  }

  /**
   * Try to subscribe to debug events. Called at mount and then periodically:
   * the interval both retries a not-yet-connected subscription AND detects
   * HttpStorage's internal socket replacement (see below).
   */
  private _trySubscribe() {
    // HttpStorage replaces its WebSocket internally on auto-reconnect without
    // any prop changing, so componentDidUpdate cannot observe the swap (prev
    // and current props are the same mutable object). Compare the instance
    // the message listener is attached to against the storage's current
    // socket and re-attach + re-subscribe when they differ; server-side
    // subscriptions are per-connection, so the old ones died with the old
    // socket. A replacement is a new notification session - supersede any
    // in-flight hydration AND drop the previous session's rendered state,
    // exactly like the prop-visible swap in componentDidUpdate: the connected
    // hydration only overwrites the schema when the snapshot carries one, so
    // without the reset a reconnect to a schema-less or pre-v9 session would
    // keep the old session's tabs and values on screen. A socket merely
    // APPEARING (attached was null) is not a new session, and must not
    // discard the mount hydration or the (still initial) state.
    const currentWs = this._getWebSocket();
    if (currentWs !== this._attachedWebSocket) {
      if (this._attachedWebSocket !== null) {
        this._hydrationGate.noteSessionEvent();
        this.setState({ ...DebugStatsPanel._initialSessionState });
      }
      this._cleanupWebSocket();
      this._setupWebSocket();
      this._hasSubscribed = false;
    }

    if (this._hasSubscribed) {
      return;
    }

    if (this.props.storage && this.props.storage.isConnected) {
      // The server drops notifications the client has not subscribed to, so
      // this list must cover every event _handleWebSocketMessage routes -
      // including debugStage and debugSchema, or web-hosted sessions never
      // see lifecycle stage transitions or the v9+ diagnostics schema.
      this.props.storage.subscribe(DEBUG_PANEL_SUBSCRIPTION_EVENTS);
      this._hasSubscribed = true;
      // Re-fetch status after subscribing to catch any state that changed during subscription
      this._fetchInitialDebugStatus();
    }
  }

  /**
   * Fetch initial debug status from the server.
   * This handles the case where the debug client was already connected before
   * this panel was mounted (including a schema negotiated before mount), or if
   * state changed while we were subscribing.
   */
  private async _fetchInitialDebugStatus() {
    const storage = this.props.storage;

    if (!storage) {
      return;
    }

    const slot = this.props.slot ?? 0;

    // The gate discards this snapshot if a live session event or a transport
    // swap supersedes it while the request is pending. Fetch failures are
    // silent - we'll still get updates via WebSocket.
    await applyHydrationSnapshot(
      this._hydrationGate,
      async () => {
        // fetchApi targets the managed server the storage represents (its
        // baseUrl origin, which may differ from the page origin in remote
        // sessions) and forwards the auth token. slotConfig=true returns the
        // debug connection state.
        const response = await storage.fetchApi(`/api/${slot}/status?slotConfig=true`);

        if (!response.ok) {
          return undefined;
        }

        const data = await response.json();
        return data.slotConfig as ISlotConfig | undefined;
      },
      (slotConfig) => this._applyDebugSlotConfig(slotConfig)
    );
  }

  /**
   * Apply a debug slot-config snapshot to panel state. Shared hydration for
   * both modes: web mode fetches it from /status, Electron mode from the
   * debug-status IPC — the same DedicatedServer.getDebugSlotConfig payload.
   * Only ever invoked through the HydrationGate (applyHydrationSnapshot), so
   * a snapshot superseded by live events never reaches this point; the
   * functional setState additionally reads flush-time state so a schema that
   * landed in the same batch is preserved rather than overwritten.
   */
  private _applyDebugSlotConfig(slotConfig: ISlotConfig) {
    const debugState = slotConfig.debugConnectionState;

    const diagnosticsEnabled = slotConfig.debuggerEnabled !== false && slotConfig.debuggerStreamingEnabled !== false;

    // Hydrate the debugger lifecycle snapshot too - a debugStage
    // notification emitted before this panel subscribed is lost, and the
    // connection-state fields below cannot reconstruct a terminal failed
    // stage (stage, failure kind, dynamic debug port) for the header and
    // recovery UI. A live stage event that arrived while the request was
    // pending wins over the snapshot.
    if (slotConfig.debugStage !== undefined && !this._receivedLiveStage) {
      this._handleDebugStage({
        eventName: "debugStage",
        timestamp: Date.now(),
        stage: slotConfig.debugStage,
        failureKind: slotConfig.debugFailureKind,
        message: slotConfig.debugStageMessage,
        debugPort: slotConfig.debugPort,
      });
    }

    if (debugState === "connected") {
      this.setState((prevState) => ({
        connectionStatus: "connected" as const,
        protocolVersion: slotConfig.debugProtocolVersion,
        tick: slotConfig.debugLastStatTick ?? 0,
        targetModuleUuid: slotConfig.debugTargetModuleUuid,
        plugins: slotConfig.debugPlugins,
        endpointHost: slotConfig.debugHost,
        endpointPort: slotConfig.debugPort,
        capabilities: slotConfig.debugCapabilities,
        ownership: slotConfig.debugOwnership ?? "attachedByMct",
        diagnosticsEnabled: diagnosticsEnabled,
        schema: slotConfig.debugSchema ? buildSchemaModel(slotConfig.debugSchema) : prevState.schema,
        // The real connect may predate this mount; the schema-load grace is
        // measured from hydration, the earliest moment this panel could know
        // about the session.
        connectedAt: prevState.connectedAt ?? Date.now(),
      }));
    } else if (debugState === "disconnected" || debugState === "error") {
      this.setState({
        connectionStatus: "disconnected",
        disconnectReason: slotConfig.debugErrorMessage,
        ownership: slotConfig.debugOwnership ?? "unknown",
        diagnosticsEnabled: diagnosticsEnabled,
        schema: undefined,
        connectedAt: undefined,
      });
    }
    // If "connecting", leave the default state
  }

  /**
   * Hydrate panel state from the Electron main process. This panel is only
   * mounted while the Stats tab is open, so the one-shot debugConnected /
   * debugSchema IPC events may have fired long before we subscribed; without
   * this, a late-mounted panel lacks capabilities, module, endpoint,
   * ownership, and schema (or stays "Connecting…" forever in a
   * diagnostics-only session with no stat events).
   */
  private async _hydrateFromIpcStatus(mc: ProcessHostedMinecraft) {
    // The gate discards this snapshot if a live session event lands first or
    // if the panel is repointed at a different minecraft instance while the
    // IPC request is pending.
    const outcome = await applyHydrationSnapshot(
      this._hydrationGate,
      () => mc.getDebugSessionStatus(),
      (slotConfig) => this._applyDebugSlotConfig(slotConfig)
    );

    if (outcome === "failed") {
      Log.debug("Failed to hydrate debug status via IPC");
    }
  }

  private _cleanupWebSocket() {
    // Remove the listener from the instance it was actually attached to -
    // _getWebSocket() may already return the storage's replacement socket,
    // which would leave the listener alive on the old one.
    if (this._attachedWebSocket && this._wsMessageHandler) {
      this._attachedWebSocket.removeEventListener("message", this._wsMessageHandler);
    }
    this._wsMessageHandler = null;
    this._attachedWebSocket = null;
  }

  private _handleWebSocketMessage(event: MessageEvent) {
    try {
      const notification = JSON.parse(event.data);

      if (!notification.body || !notification.body.eventName) {
        return;
      }

      // Filter by slot if specified
      if (this.props.slot !== undefined && notification.body.slot !== this.props.slot) {
        return;
      }

      switch (notification.body.eventName) {
        case "debugStats":
          this._handleDebugStats(notification.body as IDebugStatsNotificationBody);
          break;
        case "debugConnected":
          this._handleDebugConnected(notification.body as IDebugConnectedNotificationBody);
          break;
        case "debugDisconnected":
          this._handleDebugDisconnected(notification.body as IDebugDisconnectedNotificationBody);
          break;
        case "debugSchema":
          this._handleDebugSchema(notification.body as IDebugSchemaNotificationBody);
          break;
        case "debugPaused":
          this._handleDebugPaused(notification.body as IDebugPausedNotificationBody);
          break;
        case "debugResumed":
          this._handleDebugResumed(notification.body as IDebugResumedNotificationBody);
          break;
        case "debugProfilerState":
          this._handleDebugProfilerState(notification.body as IDebugProfilerStateNotificationBody);
          break;
        case "debugStage":
          // A live stage event supersedes the stage fields of any lifecycle
          // snapshot still in flight from _fetchInitialDebugStatus.
          this._receivedLiveStage = true;
          this._handleDebugStage(notification.body as IDebugStageNotificationBody);
          break;
        case "profilerCapture":
          this._handleProfilerCapture(notification.body as IProfilerCaptureNotificationBody);
          break;
      }
    } catch {
      // Ignore parse errors
    }
  }

  private _handleDebugStats(body: IDebugStatsNotificationBody) {
    this.setState({
      tick: body.tick,
      stats: body.stats,
      connectionStatus: "connected",
      hasReceivedStats: true,
      lastEventAt: Date.now(),
    });
  }

  private _handleDebugConnected(body: IDebugConnectedNotificationBody) {
    // Live session event: any hydration snapshot still in flight predates
    // this and must not be applied over it.
    this._hydrationGate.noteSessionEvent();

    // A (re)connect starts a fresh session: the previous session's schema and
    // stats no longer apply until the new target renegotiates them.
    this.setState({
      connectionStatus: "connected",
      protocolVersion: body.protocolVersion,
      disconnectReason: undefined,
      targetModuleUuid: body.targetModuleUuid ?? body.sessionId,
      plugins: body.plugins,
      endpointHost: body.host,
      endpointPort: body.port,
      capabilities: body.capabilities,
      ownership: body.ownership ?? "attachedByMct",
      schema: undefined,
      stats: [],
      tick: 0,
      hasReceivedStats: false,
      lastEventAt: Date.now(),
      connectedAt: Date.now(),
      isPaused: false,
    });
  }

  private _handleDebugDisconnected(body: IDebugDisconnectedNotificationBody) {
    // Live session event: a pending hydration snapshot from the connected
    // session must not resurrect it after this disconnect.
    this._hydrationGate.noteSessionEvent();

    // Clear all session-scoped state: the schema belongs to the session and a
    // reconnect renegotiates it.
    this.setState({
      connectionStatus: "disconnected",
      disconnectReason: body.reason,
      ownership: body.ownership ?? "unknown",
      schema: undefined,
      selectedTabId: undefined,
      targetModuleUuid: undefined,
      plugins: undefined,
      capabilities: undefined,
      protocolVersion: undefined,
      hasReceivedStats: false,
      connectedAt: undefined,
      isPaused: false,
      isProfilerRunning: false,
    });
  }

  private _handleDebugSchema(body: IDebugSchemaNotificationBody) {
    // Live session event: a pending hydration snapshot carries an older (or
    // no) schema and must not overwrite this one.
    this._hydrationGate.noteSessionEvent();

    const schema = buildSchemaModel(body.descriptors);

    // Preserve the current tab selection across schema refreshes when possible.
    let selectedTabId = this.state.selectedTabId;
    if (!selectedTabId || !schema.tabs.some((t) => t.id === selectedTabId)) {
      selectedTabId = schema.tabs.length > 0 ? schema.tabs[0].id : undefined;
    }

    this.setState({
      schema: schema,
      selectedTabId: selectedTabId,
      lastEventAt: Date.now(),
    });
  }

  private _handleDebugPaused(_body: IDebugPausedNotificationBody) {
    this.setState({
      isPaused: true,
    });
  }

  private _handleDebugResumed(_body: IDebugResumedNotificationBody) {
    this.setState({
      isPaused: false,
    });
  }

  private _handleDebugProfilerState(body: IDebugProfilerStateNotificationBody) {
    this.setState({
      isProfilerRunning: body.isRunning,
    });
  }

  /**
   * Handle profiler capture data received from the server.
   * Parses the base64 encoded profiler data and updates state.
   */
  private _handleProfilerCapture(body: IProfilerCaptureNotificationBody) {
    try {
      // Decode base64 data
      const jsonStr = atob(body.captureData);
      const profileData = JSON.parse(jsonStr);

      // Parse the profiler data into entries
      // The format is typically: { functions: [{ name, selfTime, totalTime, callCount }] }
      const entries: IProfilerEntry[] = [];

      if (profileData.functions && Array.isArray(profileData.functions)) {
        for (const fn of profileData.functions) {
          entries.push({
            name: fn.name || fn.functionName || "anonymous",
            selfTime: fn.selfTime || fn.self_time || 0,
            totalTime: fn.totalTime || fn.total_time || 0,
            callCount: fn.callCount || fn.call_count || 1,
          });
        }
      } else if (Array.isArray(profileData)) {
        // Alternative format: array of entries
        for (const entry of profileData) {
          entries.push({
            name: entry.name || entry.functionName || "anonymous",
            selfTime: entry.selfTime || entry.self_time || 0,
            totalTime: entry.totalTime || entry.total_time || 0,
            callCount: entry.callCount || entry.call_count || 1,
          });
        }
      }

      // Sort by total time descending
      entries.sort((a, b) => b.totalTime - a.totalTime);

      this.setState({
        profilerData: entries,
        showProfilerResults: true,
        isProfilerRunning: false,
      });
    } catch (e) {
      Log.debug("Failed to parse profiler data: " + e);
      // Still show raw data if parsing fails
      this.setState({
        profilerData: [],
        showProfilerResults: true,
        isProfilerRunning: false,
      });
    }
  }

  /**
   * Handle pause/resume button click.
   */
  private async _handlePauseResume() {
    const action = this.state.isPaused ? "resume" : "pause";

    if (this.props.minecraft) {
      // Electron IPC mode
      try {
        if (action === "pause") {
          await this.props.minecraft.debugPause();
        } else {
          await this.props.minecraft.debugResume();
        }
        this.setState({ isPaused: !this.state.isPaused });
      } catch {
        // Silently fail
      }
      return;
    }

    if (!this.props.storage) {
      return;
    }

    const slot = this.props.slot ?? 0;

    try {
      const response = await this.props.storage.fetchApi(`/api/${slot}/debug/${action}`, { method: "POST" });

      if (response.ok) {
        // Optimistically update state - we'll also get a notification
        this.setState({
          isPaused: !this.state.isPaused,
        });
      }
    } catch {
      // Silently fail
    }
  }

  /**
   * Handle profiler start/stop button click.
   */
  private async _handleProfilerToggle() {
    const action = this.state.isProfilerRunning ? "stop" : "start";

    if (this.props.minecraft) {
      // Electron IPC mode
      try {
        if (action === "start") {
          await this.props.minecraft.debugStartProfiler();
        } else {
          await this.props.minecraft.debugStopProfiler();
        }
        this.setState({ isProfilerRunning: !this.state.isProfilerRunning });
      } catch {
        // Silently fail
      }
      return;
    }

    if (!this.props.storage) {
      return;
    }

    const slot = this.props.slot ?? 0;

    try {
      const response = await this.props.storage.fetchApi(`/api/${slot}/debug/profiler/${action}`, { method: "POST" });

      if (response.ok) {
        // Optimistically update state
        this.setState({
          isProfilerRunning: !this.state.isProfilerRunning,
        });
      }
    } catch {
      // Silently fail
    }
  }

  private _handleTabChange(_event: SyntheticEvent, newValue: string) {
    this.setState({ selectedTabId: newValue });
  }

  /**
   * Handle a debugger lifecycle stage change (both modes: debugStage
   * WebSocket notification and Electron IPC stage event carry the same body).
   * Maps the fine-grained stage onto the coarse connection status used by
   * the status dot, and stores stage details for the header and recovery UI.
   */
  private _handleDebugStage(body: IDebugStageNotificationBody) {
    let connectionStatus: "connected" | "disconnected" | "connecting" = "connecting";

    if (body.stage === "connected") {
      connectionStatus = "connected";
    } else if (body.stage === "failed" || body.stage === "idle" || body.stage === "stopping") {
      connectionStatus = "disconnected";
    }

    this.setState((prevState) => ({
      stage: body.stage,
      failureKind: body.failureKind,
      stageMessage: body.message,
      debugPort: body.debugPort ?? prevState.debugPort,
      connectionStatus: connectionStatus,
      disconnectReason: body.stage === "failed" ? body.message : prevState.disconnectReason,
    }));
  }

  /**
   * Recovery-action retry for a terminally failed lifecycle stage (Electron
   * mode). Unlike _handleRetryAttach (a bare endpoint reattach), this re-runs
   * the managed listener flow from the failed stage via debugRetryConnection.
   */
  private async _handleRetry() {
    if (!this.props.minecraft) {
      return;
    }

    this.setState({ connectionStatus: "connecting", stage: "startingListener", failureKind: undefined });

    try {
      await this.props.minecraft.debugRetryConnection();
    } catch {
      // Stage events will report the outcome
    }
  }

  private _copiedResetTimer: ReturnType<typeof setTimeout> | null = null;

  private async _handleCopyDiagnostics() {
    if (!this.props.minecraft) {
      return;
    }

    try {
      const diagnostics = await this.props.minecraft.getDebugDiagnostics();

      if (diagnostics && diagnostics.length > 0) {
        await navigator.clipboard.writeText(diagnostics);

        this.setState({ diagnosticsCopied: true });

        if (this._copiedResetTimer) {
          clearTimeout(this._copiedResetTimer);
        }
        this._copiedResetTimer = setTimeout(() => {
          this._copiedResetTimer = null;
          this.setState({ diagnosticsCopied: false });
        }, 2000);
      }
    } catch (e) {
      Log.debug("Failed to copy debug diagnostics: " + e);
    }
  }

  private async _handleStopServer() {
    if (!this.props.minecraft) {
      return;
    }

    try {
      await this.props.minecraft.stop();
    } catch (e) {
      Log.debug("Failed to stop server from debug panel: " + e);
    }
  }

  /**
   * Retry the debug attach. Used from the "owned externally" state after the
   * user disconnects the other debugger (e.g. VS Code), and from retryable
   * non-ownership disconnect states (unknown/unattached) via the neutral
   * "Retry connection" action. Both modes invoke the server-side reattach
   * operation, which clears the failure latch and re-runs
   * connectDebugClient(); concurrent invocations share the server's single
   * in-flight attempt. The resulting connection/ownership state comes back in
   * the response and is also broadcast (debugConnected / debugDisconnected)
   * to every panel.
   */
  private async _handleRetryAttach() {
    this.setState({ connectionStatus: "connecting" });

    if (this.props.minecraft) {
      // Electron IPC mode
      try {
        const result = await this.props.minecraft.debugReattach();
        if (result && !result.connected) {
          this.setState({ connectionStatus: "disconnected", ownership: result.ownership });
        }
        // On success, the debugConnected IPC event carries the full session
        // info (protocol version, plugins, endpoint) and updates state.
      } catch (e) {
        Log.debug("Debug reattach via IPC failed: " + e);
        this.setState({ connectionStatus: "disconnected" });
      }
      return;
    }

    if (!this.props.storage) {
      this._fetchInitialDebugStatus();
      return;
    }

    const slot = this.props.slot ?? 0;

    try {
      // fetchApi targets the managed server (storage baseUrl origin) and
      // forwards the auth token; reattach requires updateState permission.
      const response = await this.props.storage.fetchApi(`/api/${slot}/debug/reattach`, { method: "POST" });

      if (response.ok) {
        const result = (await response.json()) as { success?: boolean; ownership?: DebugOwnershipState };
        if (!result.success) {
          this.setState({ connectionStatus: "disconnected", ownership: result.ownership ?? "unknown" });
        }
        // On success, the debugConnected WebSocket notification carries the
        // full session info and updates state.
        return;
      }
    } catch (e) {
      Log.debug("Debug reattach request failed: " + e);
    }

    // Fall back to a status re-fetch so the panel still reflects reality.
    this._fetchInitialDebugStatus();
  }

  /**
   * Categorize stats for display (legacy hardcoded view, used when the target
   * provides no diagnostics schema).
   */
  private _categorizeStats(stats: IDebugStatItem[]): IStatCategory[] {
    const categories = new Map<string, IDebugStatItem[]>();
    const rootStats: IDebugStatItem[] = [];

    for (const stat of stats) {
      if (stat.parent) {
        let catStats = categories.get(stat.parent);
        if (!catStats) {
          catStats = [];
          categories.set(stat.parent, catStats);
        }
        catStats.push(stat);
      } else {
        rootStats.push(stat);
      }
    }

    const result: IStatCategory[] = [];

    // Add root stats first
    if (rootStats.length > 0) {
      result.push({ name: "Overview", stats: rootStats });
    }

    // Add categorized stats
    for (const [name, catStats] of categories) {
      result.push({ name, stats: catStats });
    }

    return result;
  }

  /**
   * Format a stat value for display.
   */
  private _formatValue(value: number | string, index: number): { display: string; unit: string; severity: string } {
    // Handle string values
    if (typeof value === "string") {
      return { display: value, unit: "", severity: "" };
    }

    // Index 0 is typically time in milliseconds
    if (index === 0) {
      if (value >= 16.67) {
        // More than one frame at 60fps
        return { display: value.toFixed(2), unit: "ms", severity: "critical" };
      } else if (value >= 12) {
        // Warning at ~80fps threshold (12ms)
        return { display: value.toFixed(2), unit: "ms", severity: "warning" };
      }
      return { display: value.toFixed(2), unit: "ms", severity: "" };
    }

    // Other indices might be counts
    if (Number.isInteger(value)) {
      return { display: value.toString(), unit: "", severity: "" };
    }

    return { display: value.toFixed(2), unit: "", severity: "" };
  }

  /**
   * Format a value for a schema-driven tab: applies value_scalar and flags
   * values above the descriptor's target_value.
   */
  private _formatSchemaValue(
    tab: IDiagnosticsTabModel,
    value: number | string
  ): { display: string; unit: string; severity: string } {
    const scaled = scaleStatValue(tab, value);

    if (typeof scaled === "string") {
      return { display: scaled, unit: "", severity: "" };
    }

    const display = Number.isInteger(scaled) ? scaled.toString() : scaled.toFixed(2);
    const severity = tab.targetValue !== undefined && scaled > tab.targetValue ? "warning" : "";

    return { display: display, unit: tab.yLabel ?? "", severity: severity };
  }

  /**
   * Get a friendly name for a stat.
   */
  private _getFriendlyName(name: string): string {
    // Convert camelCase to Title Case with spaces
    return name.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase());
  }

  /**
   * Friendly display name for the connection ownership state.
   */
  private _getOwnershipLabel(ownership: DebugOwnershipState): string | undefined {
    switch (ownership) {
      case "attachedByMct":
        return "Owned by MCT";
      case "attachedExternally":
        return "Owned by another debugger";
      case "unattached":
        return "No debugger attached";
      default:
        return undefined;
    }
  }

  /**
   * Header summary: connection state, protocol version, selected module,
   * target endpoint, ownership, and last tick.
   */
  private _renderHeaderInfo() {
    const {
      connectionStatus,
      protocolVersion,
      disconnectReason,
      targetModuleUuid,
      plugins,
      endpointHost,
      endpointPort,
      ownership,
      tick,
      stage,
      failureKind,
      debugPort,
    } = this.state;

    const selectedPlugin = plugins?.find((p) => p.module_uuid === targetModuleUuid);
    const moduleLabel = selectedPlugin
      ? selectedPlugin.name
      : targetModuleUuid
        ? targetModuleUuid
        : plugins && plugins.length === 0
          ? "No script modules (diagnostics only)"
          : undefined;
    const ownershipLabel = this._getOwnershipLabel(ownership);

    // Prefer the fine-grained lifecycle stage (managed-BDS flow) over the
    // coarse connection status when composing the header text.
    let statusText: string;

    if (connectionStatus === "connected") {
      statusText = `Connected${protocolVersion ? ` (v${protocolVersion})` : ""}${debugPort ? ` · port ${debugPort}` : ""}`;
    } else if (stage === "failed") {
      statusText = `Failed: ${FAILURE_LABELS[failureKind ?? ""] ?? failureKind ?? "error"}`;
    } else if (stage && stage !== "idle") {
      statusText = `${STAGE_LABELS[stage] ?? stage}${debugPort ? ` (port ${debugPort})` : ""}`;
    } else if (connectionStatus === "connecting") {
      statusText = "Connecting...";
    } else {
      statusText = `Disconnected${disconnectReason ? `: ${disconnectReason}` : ""}`;
    }

    return (
      <div className="dsp-status-area">
        <div className="dsp-status" role="status" aria-live="polite">
          <div className={`dsp-status-dot ${connectionStatus}`} aria-hidden="true" />
          <span>{statusText}</span>
        </div>
        {connectionStatus === "connected" && moduleLabel && (
          <div className="dsp-info-chip" title={targetModuleUuid ? `Module UUID: ${targetModuleUuid}` : undefined}>
            Module: {moduleLabel}
          </div>
        )}
        {connectionStatus === "connected" && endpointHost && endpointPort !== undefined && (
          <div className="dsp-info-chip">
            Endpoint: {endpointHost}:{endpointPort}
          </div>
        )}
        {ownershipLabel && <div className={`dsp-info-chip dsp-ownership ${ownership}`}>{ownershipLabel}</div>}
        {tick > 0 && <div className="dsp-tick">Tick: {tick.toLocaleString()}</div>}
      </div>
    );
  }

  /**
   * Render the content for one schema-driven tab.
   */
  private _renderSchemaTabContent(tab: IDiagnosticsTabModel) {
    // Intentionally-empty tabs (is_empty_tab, protocol v10) are a deliberate
    // server statement - never present them as missing data.
    if (tab.isEmptyTab) {
      return (
        <div className="dsp-empty" role="note">
          <div className="dsp-empty-icon" aria-hidden="true">
            ∅
          </div>
          <div>This view is intentionally empty for this target.</div>
          <div className="dsp-empty-hint">
            The server reports no data source for "{tab.title}" here - for example, a client-only view when attached to
            a dedicated server. This is expected, not an error.
          </div>
        </div>
      );
    }

    const matched = matchStatsForTab(tab, this.state.stats);

    if (matched.length === 0) {
      return (
        <div className="dsp-empty">
          <div className="dsp-empty-icon" aria-hidden="true">
            📊
          </div>
          <div>No data received yet for this view.</div>
          <div className="dsp-empty-hint">Values appear when the server sends statistics for "{tab.statGroupId}".</div>
        </div>
      );
    }

    const isTable =
      tab.displayType === "table" ||
      tab.displayType === "multi_column_table" ||
      tab.displayType === "dynamic_properties_table";

    if (isTable) {
      // Aggregate stats deliver their data as [childName, ...values] tuples in
      // childrenStringValues (dynamic_properties_table and consolidated
      // multi-column tables arrive exclusively this way); buildTableRows
      // expands them into key/value rows.
      const rows = buildTableRows(tab, matched);

      const maxValues = rows.reduce((max, row) => Math.max(max, row.values.length), 0);
      // value_labels is the multi-column header mechanism; a regular
      // single-value table labels its value column with the descriptor's
      // y_label (the unit belongs in the header, not repeated in every cell).
      const valueHeaders =
        tab.valueLabels && tab.valueLabels.length > 0
          ? tab.valueLabels
          : maxValues === 1
            ? [tab.yLabel ?? "Value"]
            : Array.from({ length: maxValues }, (_, i) => `Value ${i + 1}`);

      return (
        <div className="dsp-schema-table-outer">
          <table className="dsp-schema-table" aria-label={tab.title}>
            <thead>
              <tr>
                <th scope="col">{tab.keyLabel ?? "Name"}</th>
                {valueHeaders.map((header, i) => (
                  <th scope="col" key={i}>
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.verbatim ? row.name : this._getFriendlyName(row.name)}</td>
                  {valueHeaders.map((_, i) => {
                    const value = row.values[i];
                    const formatted = value !== undefined ? this._formatSchemaValue(tab, value) : undefined;
                    return (
                      <td key={i} className={formatted?.severity ? `dsp-value-${formatted.severity}` : undefined}>
                        {formatted ? formatted.display : ""}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    // Chart display types (line_chart, stacked_line_chart, stacked_bar_chart):
    // render live values as stat cards. MCT does not plot history; the value
    // grid keeps the data truthful without misrepresenting it. For chart stats,
    // values is an oldest-to-newest sample window - the last element is the
    // current tick's sample (matching the official minecraft-debugger resolver).
    return (
      <div>
        {tab.yLabel && <div className="dsp-schema-y-label">{tab.yLabel}</div>}
        <div className="dsp-stats-grid">
          {matched.map((stat) => {
            const primaryValue = stat.values.length > 0 ? stat.values[stat.values.length - 1] : 0;
            const formatted = this._formatSchemaValue(tab, primaryValue);
            return (
              <div key={stat.fullId ?? stat.name} className="dsp-stat-card">
                <div className="dsp-stat-name">{this._getFriendlyName(stat.name)}</div>
                <div className={`dsp-stat-value ${formatted.severity}`}>
                  {formatted.display}
                  {formatted.unit && <span className="dsp-stat-unit">{formatted.unit}</span>}
                </div>
              </div>
            );
          })}
        </div>
        {tab.targetValue !== undefined && (
          <div className="dsp-schema-target-note">
            Target: {tab.targetValue}
            {tab.yLabel ? ` ${tab.yLabel}` : ""} - values above the target are highlighted.
          </div>
        )}
      </div>
    );
  }

  /**
   * Render the schema-driven tab strip and the selected tab's panel.
   */
  private _renderSchemaTabs() {
    const schema = this.state.schema;
    if (!schema || schema.tabs.length === 0) {
      return undefined;
    }

    const selectedTabId =
      this.state.selectedTabId && schema.tabs.some((t) => t.id === this.state.selectedTabId)
        ? this.state.selectedTabId
        : schema.tabs[0].id;

    const selectedTab = schema.tabs.find((t) => t.id === selectedTabId) as IDiagnosticsTabModel;

    return (
      <div className="dsp-schema-area">
        <Tabs
          value={selectedTabId}
          onChange={this._handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          aria-label="Diagnostics views"
          className="dsp-schema-tabs"
        >
          {schema.tabs.map((tab) => (
            <Tab
              key={tab.id}
              value={tab.id}
              label={tab.title}
              id={`dsp-tab-${tab.id}`}
              aria-controls={`dsp-tabpanel-${tab.id}`}
            />
          ))}
        </Tabs>
        <div
          role="tabpanel"
          id={`dsp-tabpanel-${selectedTab.id}`}
          aria-labelledby={`dsp-tab-${selectedTab.id}`}
          className="dsp-schema-tabpanel"
        >
          {this._renderSchemaTabContent(selectedTab)}
        </div>
      </div>
    );
  }

  /**
   * Render the legacy hardcoded categorized view (no schema provided).
   */
  private _renderLegacyCategories() {
    const categories = this._categorizeStats(this.state.stats);

    return categories.map((category) => (
      <div key={category.name} className="dsp-category">
        <div className="dsp-category-title">{this._getFriendlyName(category.name)}</div>
        <div className="dsp-stats-grid">
          {category.stats.map((stat) => {
            const primaryValue = stat.values.length > 0 ? stat.values[0] : 0;
            const formatted = this._formatValue(primaryValue, 0);
            return (
              <div key={stat.name} className="dsp-stat-card">
                <div className="dsp-stat-name">{this._getFriendlyName(stat.name)}</div>
                <div className={`dsp-stat-value ${formatted.severity}`}>
                  {formatted.display}
                  {formatted.unit && <span className="dsp-stat-unit">{formatted.unit}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    ));
  }

  /**
   * Full-content message for non-data display states.
   */
  private _renderStateMessage(displayState: DiagnosticsPanelDisplayState) {
    switch (displayState) {
      case "diagnosticsDisabled":
        return (
          <div className="dsp-empty">
            <div className="dsp-empty-icon" aria-hidden="true">
              🚫
            </div>
            <div>Diagnostics are disabled for this server.</div>
            <div className="dsp-empty-hint">
              Enable the script debugger and diagnostics streaming in the server settings to see live diagnostics here.
            </div>
          </div>
        );

      case "ownedExternally":
        return (
          <div className="dsp-empty dsp-ownership-explainer">
            <div className="dsp-empty-icon" aria-hidden="true">
              🔒
            </div>
            <div>Another debugger owns this endpoint.</div>
            <div className="dsp-empty-hint">
              Minecraft's script debug endpoint accepts only one attached debugger at a time, and a debugger (typically
              VS Code) is currently attached
              {this.state.endpointHost && this.state.endpointPort !== undefined
                ? ` to ${this.state.endpointHost}:${this.state.endpointPort}`
                : ""}
              . MCT and VS Code cannot be attached at the same time.
              <br />
              To see diagnostics in MCT: stop the VS Code debug session (Shift+F5 or the Disconnect button), then check
              again.
            </div>
            <Button
              variant="outlined"
              size="small"
              className="dsp-recheck-btn"
              onClick={this._handleRetryAttach}
              aria-label="Check debugger ownership again"
            >
              Check again
            </Button>
          </div>
        );

      case "disconnected":
        // Non-ownership disconnects (ownership unknown/unattached) are
        // retryable: the server-side reattach clears the failure latch and
        // re-runs the attach, so offer a neutral retry action - the
        // ownership-specific "Check again" flow above stays reserved for
        // attachedExternally.
        return (
          <div className="dsp-empty">
            <div className="dsp-empty-icon" aria-hidden="true">
              📊
            </div>
            <div>Debugger not connected</div>
            {this.state.disconnectReason && <div className="dsp-empty-hint">{this.state.disconnectReason}</div>}
            {(this.props.minecraft || this.props.storage) && (
              <Button
                variant="outlined"
                size="small"
                className="dsp-recheck-btn"
                onClick={this._handleRetryAttach}
                aria-label="Retry debugger connection"
              >
                Retry connection
              </Button>
            )}
          </div>
        );

      case "connecting":
        return (
          <div className="dsp-empty">
            <div className="dsp-empty-icon" aria-hidden="true">
              📊
            </div>
            <div>Connecting to debugger...</div>
          </div>
        );

      case "loadingSchema":
        return (
          <div className="dsp-empty">
            <div className="dsp-empty-icon" aria-hidden="true">
              📊
            </div>
            <div>Loading diagnostics schema...</div>
            <div className="dsp-empty-hint">
              The debugger is negotiating which diagnostic views this target provides.
            </div>
          </div>
        );

      case "noEvents":
        return (
          <div className="dsp-empty">
            <div className="dsp-empty-icon" aria-hidden="true">
              📊
            </div>
            <div>Waiting for stats...</div>
            <div className="dsp-empty-hint">
              {this.state.plugins && this.state.plugins.length === 0 ? (
                <span>
                  This is a diagnostics-only session: the target has no script modules loaded. Server diagnostics will
                  appear when the server emits them.
                </span>
              ) : (
                <span>
                  Stats are sent when scripts are running.
                  <br />
                  Make sure a behavior pack with scripts is loaded.
                </span>
              )}
            </div>
          </div>
        );

      default:
        return undefined;
    }
  }

  render() {
    const {
      connectionStatus,
      protocolVersion,
      stats,
      isPaused,
      isProfilerRunning,
      profilerData,
      showProfilerResults,
      schema,
      capabilities,
      ownership,
      diagnosticsEnabled,
      plugins,
      lastEventAt,
      connectedAt,
      hasReceivedStats,
      stage,
      failureKind,
      stageMessage,
      diagnosticsCopied,
    } = this.state;

    const isConnected = connectionStatus === "connected";
    const controls = buildControlsModel(protocolVersion, capabilities);

    const showRecoveryActions = this.props.minecraft !== undefined && stage === "failed";
    // Offer only the actions mapped for this failure kind: Retry is a no-op
    // for a server that never started (serverStartup) and a guaranteed
    // repeat failure for an incompatible protocol (protocolMismatch).
    const recoveryActions = showRecoveryActions
      ? getRecoveryActionsForFailure((failureKind as DebuggerFailureKind) ?? DebuggerFailureKind.none)
      : [];

    const displayState = derivePanelDisplayState({
      connectionStatus: connectionStatus,
      diagnosticsEnabled: diagnosticsEnabled,
      ownership: ownership,
      protocolVersion: protocolVersion,
      hasSchema: schema !== undefined,
      hasReceivedStats: hasReceivedStats,
      msSinceLastEvent: lastEventAt !== undefined ? Date.now() - lastEventAt : undefined,
      msSinceConnect: connectedAt !== undefined ? Date.now() - connectedAt : undefined,
    });

    const showData = displayState === "active" || displayState === "stale";
    const hasSchemaTabs = schema !== undefined && schema.tabs.length > 0;

    return (
      <div className="dsp-outer">
        <div className="dsp-header">
          {this._renderHeaderInfo()}
          <div className="dsp-controls">
            {controls.showPauseResume && (
              <Button
                variant="outlined"
                size="small"
                className={`dsp-control-btn ${isPaused ? "paused" : "running"}`}
                onClick={this._handlePauseResume}
                disabled={!isConnected}
                title={isPaused ? "Resume script execution" : "Pause script execution"}
                aria-label={isPaused ? "Resume script execution" : "Pause script execution"}
              >
                {isPaused ? "▶ Resume" : "⏸ Pause"}
              </Button>
            )}
            {controls.showProfiler && (
              <Button
                variant="outlined"
                size="small"
                className={`dsp-control-btn profiler ${isProfilerRunning ? "active" : ""}`}
                onClick={this._handleProfilerToggle}
                disabled={!isConnected}
                title={isProfilerRunning ? "Stop profiler" : "Start profiler"}
                aria-label={isProfilerRunning ? "Stop profiler" : "Start profiler"}
              >
                {isProfilerRunning ? "⏹ Stop Profiler" : "🔴 Start Profiler"}
              </Button>
            )}
            {showProfilerResults && profilerData.length > 0 && (
              <Button
                variant="outlined"
                size="small"
                className="dsp-control-btn"
                onClick={() => this.setState({ showProfilerResults: false })}
                title="Hide profiler results"
                aria-label="Hide profiler results"
              >
                ✕ Close Results
              </Button>
            )}
          </div>
        </div>

        {showRecoveryActions && (
          <div className="dsp-recovery">
            {stageMessage && <div className="dsp-recovery-message">{stageMessage}</div>}
            <div className="dsp-recovery-actions">
              {recoveryActions.map((action) => {
                switch (action) {
                  case DebuggerRecoveryAction.retry:
                    return (
                      <Button key={action} size="small" variant="contained" onClick={this._handleRetry}>
                        Retry
                      </Button>
                    );
                  case DebuggerRecoveryAction.changeSettings:
                    return this.props.onChangeSettings ? (
                      <Button key={action} size="small" variant="contained" onClick={this.props.onChangeSettings}>
                        Change Settings
                      </Button>
                    ) : undefined;
                  case DebuggerRecoveryAction.viewLogs:
                    return this.props.onViewLogs ? (
                      <Button key={action} size="small" variant="outlined" onClick={this.props.onViewLogs}>
                        View Logs
                      </Button>
                    ) : undefined;
                  case DebuggerRecoveryAction.copyDiagnostics:
                    return (
                      <Button key={action} size="small" variant="outlined" onClick={this._handleCopyDiagnostics}>
                        {diagnosticsCopied ? "Copied!" : "Copy Diagnostic Details"}
                      </Button>
                    );
                  case DebuggerRecoveryAction.stopServer:
                    return (
                      <Button key={action} size="small" variant="outlined" color="error" onClick={this._handleStopServer}>
                        Stop Server
                      </Button>
                    );
                  default:
                    return undefined;
                }
              })}
            </div>
          </div>
        )}

        {/* Banners overlaid on data states */}
        {isPaused && (
          <div className="dsp-banner dsp-banner-paused" role="status">
            Script execution is paused. Values show the last state before the pause.
          </div>
        )}
        {showData && displayState === "stale" && (
          <div className="dsp-banner dsp-banner-stale" role="status">
            No recent events - the last update was more than {Math.round(STALE_EVENT_THRESHOLD_MS / 1000)} seconds ago.
            Values may be out of date.
          </div>
        )}
        {isConnected && schema !== undefined && schema.errors.length > 0 && (
          <div className="dsp-banner dsp-banner-error" role="alert">
            {schema.errors.length === 1
              ? `One diagnostics descriptor could not be rendered: ${schema.errors[0].message}.`
              : `${schema.errors.length} diagnostics descriptors could not be rendered (first: ${schema.errors[0].message}).`}{" "}
            The remaining views are shown below. This usually means the server uses a newer diagnostics format - check
            for an updated version of Minecraft Creator Tools.
          </div>
        )}
        {isConnected && plugins && plugins.length === 0 && showData && (
          <div className="dsp-banner dsp-banner-info" role="status">
            Diagnostics-only session: no script modules are loaded on this target.
          </div>
        )}

        <div className="dsp-content">
          {/* Profiler Results Section */}
          {showProfilerResults && profilerData.length > 0 && (
            <div className="dsp-profiler-results">
              <div className="dsp-category-title">📊 Profiler Results ({profilerData.length} functions)</div>
              <div className="dsp-profiler-table">
                <div className="dsp-profiler-header">
                  <span className="dsp-profiler-col name">Function</span>
                  <span className="dsp-profiler-col time">Self Time (ms)</span>
                  <span className="dsp-profiler-col time">Total Time (ms)</span>
                  <span className="dsp-profiler-col count">Calls</span>
                </div>
                {profilerData.slice(0, 50).map((entry, index) => (
                  <div key={index} className="dsp-profiler-row">
                    <span className="dsp-profiler-col name" title={entry.name}>
                      {entry.name}
                    </span>
                    <span className={`dsp-profiler-col time ${entry.selfTime > 10 ? "warning" : ""}`}>
                      {entry.selfTime.toFixed(2)}
                    </span>
                    <span className={`dsp-profiler-col time ${entry.totalTime > 16.67 ? "critical" : ""}`}>
                      {entry.totalTime.toFixed(2)}
                    </span>
                    <span className="dsp-profiler-col count">{entry.callCount}</span>
                  </div>
                ))}
                {profilerData.length > 50 && (
                  <div className="dsp-profiler-more">...and {profilerData.length - 50} more functions</div>
                )}
              </div>
            </div>
          )}

          {/* Diagnostics Section */}
          {showData || (hasSchemaTabs && isConnected)
            ? hasSchemaTabs
              ? this._renderSchemaTabs()
              : stats.length > 0
                ? this._renderLegacyCategories()
                : this._renderStateMessage("noEvents")
            : this._renderStateMessage(displayState)}
        </div>
      </div>
    );
  }
}
