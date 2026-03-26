/**
 * ==========================================================================================
 * DEBUG STATS PANEL
 * ==========================================================================================
 *
 * Real-time display of Minecraft script debugger statistics.
 *
 * OVERVIEW:
 * ---------
 * This component displays performance statistics received from the Minecraft
 * script debugger via WebSocket notifications. It shows:
 *
 * - Connection status (connected/disconnected/connecting)
 * - Current tick number
 * - Performance metrics (timing data from script execution)
 * - Hierarchical stat categories (tick, worldTick, scriptAfterEvents, etc.)
 * - Pause/Resume controls for debugging
 * - Profiler capture and display
 *
 * DATA FLOW:
 * ----------
 * Mode 1 - WebSocket (HttpStorage / web server mode):
 *   1. Server connects to Minecraft debug port (19144) via MinecraftDebugClient
 *   2. Debug stats are forwarded as WebSocket notifications (debugStats event)
 *   3. This component receives notifications via WebSocket connection
 *   4. Stats are displayed in a grid layout with real-time updates
 *   5. Pause/resume/profiler commands sent via HTTP REST API
 *
 * Mode 2 - Electron IPC (ProcessHostedMinecraft):
 *   1. DedicatedServer in main process connects to Minecraft debug port
 *   2. Debug events forwarded via IPC (webContents.send → AppServiceProxy)
 *   3. ProcessHostedMinecraft dispatches typed events to this component
 *   4. Pause/resume/profiler commands sent via IPC (AppServiceProxy.sendAsync)
 *   5. In this mode, no WebSocket or HttpStorage is needed
 *
 * WEBSOCKET SUBSCRIPTION LIFECYCLE:
 * ----------------------------------
 * 1. componentDidMount:
 *    - Calls _setupWebSocket() to attach message listener
 *    - Starts subscription retry interval (every 2 seconds)
 *    - Fetches initial debug status from REST API
 *
 * 2. _setupWebSocket():
 *    - Gets WebSocket from props.webSocket or props.storage.webSocket
 *    - Attaches _handleWebSocketMessage as message event listener
 *    - Calls _trySubscribe() immediately
 *
 * 3. _trySubscribe():
 *    - Called immediately and then every 2 seconds until successful
 *    - Subscribes to: debugStats, debugConnected, debugDisconnected,
 *      debugPaused, debugResumed, debugProfilerState, profilerCapture
 *    - Sets _hasSubscribed=true to stop retry attempts
 *
 * 4. componentDidUpdate:
 *    - Detects WebSocket changes (reconnection scenarios)
 *    - Cleans up old listener and sets up new one
 *    - Resets _hasSubscribed to trigger re-subscription
 *
 * 5. componentWillUnmount:
 *    - Removes WebSocket message listener
 *    - Clears subscription retry interval
 *
 * NOTIFICATION HANDLING:
 * ----------------------
 * _handleWebSocketMessage processes incoming notifications:
 * - debugStats: Updates tick number and stats array
 * - debugConnected: Sets connected status with protocol version
 * - debugDisconnected: Sets disconnected status with reason
 * - debugPaused/debugResumed: Updates pause state
 * - debugProfilerState: Updates profiler running state
 * - profilerCapture: Parses and displays profiler data
 *
 * RELATED FILES:
 * --------------
 * - MinecraftDebugClient.ts: Server-side debug protocol client
 * - IServerNotification.ts: Notification message types
 * - DedicatedServer.ts: Debug client integration
 * - HttpServer.ts: WebSocket notification broadcasting (web server mode)
 * - ProcessHostedProxyMinecraft.ts: IPC debug event proxy (Electron mode)
 * - DedicatedServerCommandHandler.ts: IPC debug event forwarding (Electron main process)
 * - AppServiceProxy.ts: IPC command definitions for debug pause/resume/profiler
 *
 * ==========================================================================================
 */
import { Component } from "react";
import "./DebugStatsPanel.css";
import {
  IDebugStatsNotificationBody,
  IDebugConnectedNotificationBody,
  IDebugDisconnectedNotificationBody,
  IDebugPausedNotificationBody,
  IDebugResumedNotificationBody,
  IDebugProfilerStateNotificationBody,
  IProfilerCaptureNotificationBody,
  IDebugStatItem,
} from "../../local/IServerNotification";
import HttpStorage from "../../storage/HttpStorage";
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
}

/**
 * Categorized stats for display.
 */
interface IStatCategory {
  name: string;
  stats: IDebugStatItem[];
}

export default class DebugStatsPanel extends Component<IDebugStatsPanelProps, IDebugStatsPanelState> {
  private _wsMessageHandler: ((event: MessageEvent) => void) | null = null;
  private _subscribeInterval: ReturnType<typeof setInterval> | null = null;
  private _hasSubscribed: boolean = false;
  // IPC event unsubscribers
  private _ipcUnsubs: (() => void)[] = [];

  constructor(props: IDebugStatsPanelProps) {
    super(props);

    this.state = {
      connectionStatus: "connecting",
      tick: 0,
      stats: [],
      isPaused: false,
      isProfilerRunning: false,
      profilerData: [],
      showProfilerResults: false,
    };

    this._handleWebSocketMessage = this._handleWebSocketMessage.bind(this);
    this._trySubscribe = this._trySubscribe.bind(this);
    this._fetchInitialDebugStatus = this._fetchInitialDebugStatus.bind(this);
    this._handlePauseResume = this._handlePauseResume.bind(this);
    this._handleProfilerToggle = this._handleProfilerToggle.bind(this);
    this._handleProfilerCapture = this._handleProfilerCapture.bind(this);
  }

  componentDidMount() {
    if (this.props.minecraft) {
      // Electron IPC mode - subscribe to events from ProcessHostedMinecraft
      this._setupIpcEvents(this.props.minecraft);
    } else {
      // WebSocket/HttpStorage mode
      this._setupWebSocket();
      this._subscribeInterval = setInterval(this._trySubscribe, 2000);
      this._fetchInitialDebugStatus();
    }
  }

  componentDidUpdate(prevProps: IDebugStatsPanelProps) {
    if (this.props.minecraft) {
      // IPC mode - check if minecraft instance changed
      if (prevProps.minecraft !== this.props.minecraft) {
        this._cleanupIpcEvents();
        this._setupIpcEvents(this.props.minecraft);
      }
    } else {
      // WebSocket mode
      const prevWs = prevProps.webSocket || prevProps.storage?.webSocket;
      const currentWs = this.props.webSocket || this.props.storage?.webSocket;
      if (prevWs !== currentWs) {
        this._cleanupWebSocket();
        this._setupWebSocket();
        this._hasSubscribed = false;
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
  }

  /**
   * Set up event subscriptions from a ProcessHostedMinecraft instance (Electron IPC mode).
   */
  private _setupIpcEvents(mc: ProcessHostedMinecraft) {
    this._cleanupIpcEvents();

    const connSub = mc.onDebugConnected.subscribe((_sender, body) => {
      this._handleDebugConnected(body);
    });
    const discSub = mc.onDebugDisconnected.subscribe((_sender, body) => {
      this._handleDebugDisconnected(body);
    });
    const statsSub = mc.onDebugStats.subscribe((_sender, body) => {
      this._handleDebugStats(body);
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

    this._ipcUnsubs = [
      () => mc.onDebugConnected.unsubscribe(connSub),
      () => mc.onDebugDisconnected.unsubscribe(discSub),
      () => mc.onDebugStats.unsubscribe(statsSub),
      () => mc.onDebugPaused.unsubscribe(pauseSub),
      () => mc.onDebugResumed.unsubscribe(resumeSub),
      () => mc.onDebugProfilerState.unsubscribe(profStateSub),
      () => mc.onProfilerCapture.unsubscribe(profCaptureSub),
    ];
  }

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
      this._wsMessageHandler = this._handleWebSocketMessage;
      ws.addEventListener("message", this._wsMessageHandler);
      this._trySubscribe();
    }
  }

  /**
   * Try to subscribe to debug events.
   * This is called periodically until subscription succeeds.
   */
  private _trySubscribe() {
    if (this._hasSubscribed) {
      return;
    }

    if (this.props.storage && this.props.storage.isConnected) {
      this.props.storage.subscribe([
        "debugStats",
        "debugConnected",
        "debugDisconnected",
        "debugPaused",
        "debugResumed",
        "debugProfilerState",
        "profilerCapture",
      ]);
      this._hasSubscribed = true;
      // Re-fetch status after subscribing to catch any state that changed during subscription
      this._fetchInitialDebugStatus();
    }
  }

  /**
   * Fetch initial debug status from the server.
   * This handles the case where the debug client was already connected before
   * this panel was mounted, or if state changed while we were subscribing.
   */
  private async _fetchInitialDebugStatus() {
    if (!this.props.storage) {
      return;
    }

    try {
      const slot = this.props.slot ?? 0;
      // Get the server origin from window.location or derive from storage baseUrl
      let serverOrigin: string;
      if (typeof window !== "undefined" && window.location) {
        serverOrigin = window.location.origin;
      } else {
        // Fallback: extract origin from baseUrl
        try {
          const url = new URL(this.props.storage.baseUrl);
          serverOrigin = url.origin;
        } catch {
          return; // Can't determine server origin
        }
      }
      // Include slotConfig=true to get debug connection state
      const statusUrl = `${serverOrigin}/api/${slot}/status?slotConfig=true`;

      // Build headers with auth token if available
      const headers: Record<string, string> = {};
      if (this.props.storage.authToken) {
        // Auth token format expected by HttpServer: "Bearer mctauth=<encrypted_token>"
        headers["Authorization"] = `Bearer mctauth=${this.props.storage.authToken}`;
      }

      const response = await fetch(statusUrl, {
        credentials: "include",
        headers,
      });

      if (response.ok) {
        const data = await response.json();
        if (data.slotConfig) {
          const debugState = data.slotConfig.debugConnectionState;
          if (debugState === "connected") {
            this.setState({
              connectionStatus: "connected",
              protocolVersion: data.slotConfig.debugProtocolVersion,
              tick: data.slotConfig.debugLastStatTick ?? 0,
            });
          } else if (debugState === "disconnected" || debugState === "error") {
            this.setState({
              connectionStatus: "disconnected",
              disconnectReason: data.slotConfig.debugErrorMessage,
            });
          }
          // If "connecting", leave the default state
        }
      }
    } catch {
      // Silently fail - we'll still get updates via WebSocket
    }
  }

  private _cleanupWebSocket() {
    const ws = this._getWebSocket();
    if (ws && this._wsMessageHandler) {
      ws.removeEventListener("message", this._wsMessageHandler);
      this._wsMessageHandler = null;
    }
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
        case "debugPaused":
          this._handleDebugPaused(notification.body as IDebugPausedNotificationBody);
          break;
        case "debugResumed":
          this._handleDebugResumed(notification.body as IDebugResumedNotificationBody);
          break;
        case "debugProfilerState":
          this._handleDebugProfilerState(notification.body as IDebugProfilerStateNotificationBody);
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
    });
  }

  private _handleDebugConnected(body: IDebugConnectedNotificationBody) {
    this.setState({
      connectionStatus: "connected",
      protocolVersion: body.protocolVersion,
      disconnectReason: undefined,
    });
  }

  private _handleDebugDisconnected(body: IDebugDisconnectedNotificationBody) {
    this.setState({
      connectionStatus: "disconnected",
      disconnectReason: body.reason,
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
      let serverOrigin: string;
      if (typeof window !== "undefined" && window.location) {
        serverOrigin = window.location.origin;
      } else {
        return;
      }

      const response = await fetch(`${serverOrigin}/api/${slot}/debug/${action}`, {
        method: "POST",
      });

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
      let serverOrigin: string;
      if (typeof window !== "undefined" && window.location) {
        serverOrigin = window.location.origin;
      } else {
        return;
      }

      const response = await fetch(`${serverOrigin}/api/${slot}/debug/profiler/${action}`, {
        method: "POST",
      });

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

  /**
   * Categorize stats for display.
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
   * Get a friendly name for a stat.
   */
  private _getFriendlyName(name: string): string {
    // Convert camelCase to Title Case with spaces
    return name.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase());
  }

  render() {
    const {
      connectionStatus,
      tick,
      stats,
      protocolVersion,
      disconnectReason,
      isPaused,
      isProfilerRunning,
      profilerData,
      showProfilerResults,
    } = this.state;
    const categories = this._categorizeStats(stats);
    const isConnected = connectionStatus === "connected";

    return (
      <div className="dsp-outer">
        <div className="dsp-header">
          <div className="dsp-status">
            <div className={`dsp-status-dot ${connectionStatus}`} />
            <span>
              {connectionStatus === "connected"
                ? `Connected${protocolVersion ? ` (v${protocolVersion})` : ""}`
                : connectionStatus === "connecting"
                  ? "Connecting..."
                  : `Disconnected${disconnectReason ? `: ${disconnectReason}` : ""}`}
            </span>
          </div>
          {tick > 0 && <div className="dsp-tick">Tick: {tick.toLocaleString()}</div>}
          <div className="dsp-controls">
            <button
              className={`dsp-control-btn ${isPaused ? "paused" : "running"}`}
              onClick={this._handlePauseResume}
              disabled={!isConnected}
              title={isPaused ? "Resume script execution" : "Pause script execution"}
            >
              {isPaused ? "▶ Resume" : "⏸ Pause"}
            </button>
            <button
              className={`dsp-control-btn profiler ${isProfilerRunning ? "active" : ""}`}
              onClick={this._handleProfilerToggle}
              disabled={!isConnected}
              title={isProfilerRunning ? "Stop profiler" : "Start profiler"}
            >
              {isProfilerRunning ? "⏹ Stop Profiler" : "🔴 Start Profiler"}
            </button>
            {showProfilerResults && profilerData.length > 0 && (
              <button
                className="dsp-control-btn"
                onClick={() => this.setState({ showProfilerResults: false })}
                title="Hide profiler results"
              >
                ✕ Close Results
              </button>
            )}
          </div>
        </div>

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

          {/* Stats Section */}
          {stats.length === 0 ? (
            <div className="dsp-empty">
              <div className="dsp-empty-icon">📊</div>
              <div>
                {connectionStatus === "connected"
                  ? "Waiting for stats..."
                  : connectionStatus === "connecting"
                    ? "Connecting to debugger..."
                    : "Debugger not connected"}
              </div>
              {connectionStatus === "connected" && (
                <div className="dsp-empty-hint">
                  Stats are sent when scripts are running.
                  <br />
                  Make sure a behavior pack with scripts is loaded.
                </div>
              )}
            </div>
          ) : (
            categories.map((category) => (
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
            ))
          )}
        </div>
      </div>
    );
  }
}
