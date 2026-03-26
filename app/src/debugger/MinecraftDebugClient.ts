// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * ARCHITECTURE DOCUMENTATION: MinecraftDebugClient
 * ================================================
 *
 * This class implements a client for the Minecraft Bedrock Edition debug protocol,
 * allowing server-side code to connect to a running Minecraft instance's debug server.
 *
 * ## Overview
 *
 * When Minecraft Dedicated Server starts with script debugging enabled, it listens
 * for debug connections (typically on port 19144). This client connects to that port
 * and receives real-time events including:
 *
 * - **Statistics**: Performance metrics, entity counts, chunk loading, etc.
 * - **Debug events**: Breakpoint hits, thread events, exceptions
 * - **Print events**: Script console output
 * - **Profiler captures**: CPU profiling data
 *
 * ## Connection Flow
 *
 * 1. Client connects to Minecraft's debug port
 * 2. Minecraft sends ProtocolEvent with version and capabilities
 * 3. Client responds with protocol handshake
 * 4. Events flow continuously (StatEvent2 every tick, etc.)
 *
 * ## Integration Points
 *
 * - **DedicatedServer.ts**: Starts debug listener, creates this client
 * - **HttpServer.ts**: Subscribes to events and broadcasts to web clients
 * - **DebugPanel.tsx**: Web UI that displays the statistics
 *
 * ## Usage
 *
 * ```typescript
 * const client = new MinecraftDebugClient();
 * client.onStats.subscribe((_, stats) => console.log(stats));
 * client.onConnected.subscribe(() => console.log("Connected!"));
 * await client.connect("localhost", 19144);
 * ```
 */

import { createConnection, Socket } from "net";
import { EventDispatcher, IEvent } from "ste-events";
import Log from "../core/Log";
import DebugMessageStreamParser from "./DebugMessageStreamParser";
import {
  DebugConnectionState,
  IDebugEventEnvelope,
  IDebugMessageEnvelope,
  IDebugProtocolEnvelope,
  IDebugResponseEnvelope,
  IDebugSessionInfo,
  IMinecraftDebugCapabilities,
  IPluginDetails,
  IProfilerCaptureEvent,
  IProtocolEvent,
  IPrintEvent,
  IStatData,
  IStatDataModel,
  IStatEvent,
  IStoppedEvent,
  IThreadEvent,
  ProtocolVersion,
} from "./IMinecraftDebugProtocol";

const CONNECTION_RETRY_ATTEMPTS = 5;
const CONNECTION_RETRY_WAIT_MS = 1000;
const CONNECTION_TIMEOUT_MS = 5000; // Timeout for each connection attempt
const PROTOCOL_HANDSHAKE_TIMEOUT_MS = 10000; // Timeout waiting for protocol event

interface PendingRequest {
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  command: string;
}

export default class MinecraftDebugClient {
  private _socket: Socket | undefined;
  private _parser: DebugMessageStreamParser;
  private _state: DebugConnectionState = DebugConnectionState.Disconnected;
  private _host: string = "localhost";
  private _port: number = 19144;
  private _protocolVersion: number = ProtocolVersion.Unknown;
  private _clientProtocolVersion: number = ProtocolVersion.SupportBreakpointsAsRequest;
  private _targetModuleUuid: string | undefined;
  private _plugins: IPluginDetails[] = [];
  private _capabilities: IMinecraftDebugCapabilities = {
    supportsCommands: false,
    supportsProfiler: false,
    supportsBreakpointsAsRequest: false,
  };
  private _lastStatTick: number = 0;
  private _errorMessage: string | undefined;
  private _passcode: string | undefined;

  // Diagnostic tracking
  private _lastDataReceivedTime: number = 0;
  private _messageCount: number = 0;
  private _statWarningLogged: boolean = false;
  private _statusCheckInterval: NodeJS.Timeout | undefined;

  private _pendingRequests = new Map<number, PendingRequest>();
  private _requestSeq = 0;

  // Events
  private _onConnected = new EventDispatcher<MinecraftDebugClient, IDebugSessionInfo>();
  private _onDisconnected = new EventDispatcher<MinecraftDebugClient, string>();
  private _onStats = new EventDispatcher<MinecraftDebugClient, { tick: number; stats: IStatData[] }>();
  private _onStopped = new EventDispatcher<MinecraftDebugClient, IStoppedEvent>();
  private _onThread = new EventDispatcher<MinecraftDebugClient, IThreadEvent>();
  private _onPrint = new EventDispatcher<MinecraftDebugClient, IPrintEvent>();
  private _onError = new EventDispatcher<MinecraftDebugClient, Error>();
  private _onProtocol = new EventDispatcher<MinecraftDebugClient, IProtocolEvent>();
  private _onProfilerCapture = new EventDispatcher<MinecraftDebugClient, IProfilerCaptureEvent>();

  public get onConnected(): IEvent<MinecraftDebugClient, IDebugSessionInfo> {
    return this._onConnected.asEvent();
  }

  public get onDisconnected(): IEvent<MinecraftDebugClient, string> {
    return this._onDisconnected.asEvent();
  }

  public get onStats(): IEvent<MinecraftDebugClient, { tick: number; stats: IStatData[] }> {
    return this._onStats.asEvent();
  }

  public get onStopped(): IEvent<MinecraftDebugClient, IStoppedEvent> {
    return this._onStopped.asEvent();
  }

  public get onThread(): IEvent<MinecraftDebugClient, IThreadEvent> {
    return this._onThread.asEvent();
  }

  public get onPrint(): IEvent<MinecraftDebugClient, IPrintEvent> {
    return this._onPrint.asEvent();
  }

  public get onError(): IEvent<MinecraftDebugClient, Error> {
    return this._onError.asEvent();
  }

  public get onProtocol(): IEvent<MinecraftDebugClient, IProtocolEvent> {
    return this._onProtocol.asEvent();
  }

  public get onProfilerCapture(): IEvent<MinecraftDebugClient, IProfilerCaptureEvent> {
    return this._onProfilerCapture.asEvent();
  }

  public get state(): DebugConnectionState {
    return this._state;
  }

  public get isConnected(): boolean {
    return this._state === DebugConnectionState.Connected;
  }

  public get sessionInfo(): IDebugSessionInfo {
    return {
      state: this._state,
      host: this._host,
      port: this._port,
      protocolVersion: this._protocolVersion,
      targetModuleUuid: this._targetModuleUuid,
      plugins: this._plugins,
      capabilities: this._capabilities,
      lastStatTick: this._lastStatTick,
      errorMessage: this._errorMessage,
    };
  }

  constructor() {
    this._parser = new DebugMessageStreamParser();

    this._parser.onMessage.subscribe((_, message) => {
      this._handleMessage(message as IDebugMessageEnvelope);
    });

    this._parser.onError.subscribe((_, error) => {
      Log.error(`Debug protocol parse error: ${error.message}`);
      this._onError.dispatch(this, error);
    });
  }

  /**
   * Connect to the Minecraft debug server.
   * This method includes connection timeouts and retries to handle slow server startup.
   * The protocol handshake completes asynchronously after the socket connects.
   */
  public async connect(host: string = "localhost", port: number = 19144, passcode?: string): Promise<void> {
    if (this._state === DebugConnectionState.Connected || this._state === DebugConnectionState.Connecting) {
      throw new Error("Already connected or connecting");
    }

    this._host = host;
    this._port = port;
    this._passcode = passcode;
    this._state = DebugConnectionState.Connecting;
    this._errorMessage = undefined;

    let socket: Socket | undefined;
    let lastError: Error | undefined;

    // Retry connection with exponential backoff
    Log.debug(`[Debug] Starting connection attempts to ${host}:${port} (max ${CONNECTION_RETRY_ATTEMPTS} attempts)...`);
    for (let attempt = 0; attempt < CONNECTION_RETRY_ATTEMPTS; attempt++) {
      const waitMs = attempt > 0 ? CONNECTION_RETRY_WAIT_MS * Math.pow(2, attempt - 1) : 0;
      if (waitMs > 0) {
        Log.debug(`[Debug] Waiting ${waitMs}ms before retry...`);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }

      Log.debug(`[Debug] Connection attempt ${attempt + 1}/${CONNECTION_RETRY_ATTEMPTS} to ${host}:${port}...`);

      try {
        socket = await new Promise<Socket>((resolve, reject) => {
          const client = createConnection({ host, port });

          // Set a connection timeout
          const timeout = setTimeout(() => {
            client.destroy();
            reject(new Error(`Connection timeout after ${CONNECTION_TIMEOUT_MS}ms`));
          }, CONNECTION_TIMEOUT_MS);

          client.on("connect", () => {
            clearTimeout(timeout);
            client.removeAllListeners();
            resolve(client);
          });

          client.on("close", () => {
            clearTimeout(timeout);
            reject(new Error("Connection closed"));
          });

          client.on("error", (err) => {
            clearTimeout(timeout);
            reject(err);
          });
        });
        break;
      } catch (e: any) {
        lastError = e;
        Log.debug(`[Debug] Connection attempt ${attempt + 1} failed: ${e.message}`);
      }
    }

    if (!socket) {
      this._state = DebugConnectionState.Error;
      this._errorMessage = `Failed to connect to ${host}:${port} after ${CONNECTION_RETRY_ATTEMPTS} attempts: ${lastError?.message || "unknown error"}`;
      Log.message(`[Debug] Connection failed: ${lastError?.message || "unknown error"}`);
      throw new Error(this._errorMessage);
    }

    Log.debug(`[Debug] Socket connection established to ${host}:${port}`);

    this._socket = socket;
    this._parser.reset();
    this._lastDataReceivedTime = Date.now();
    this._messageCount = 0;

    // Set TCP keep-alive to detect dead connections
    socket.setKeepAlive(true, 30000); // 30 second keep-alive

    // Set up socket event handlers
    socket.on("data", (data) => {
      this._lastDataReceivedTime = Date.now();
      this._messageCount++;
      Log.verbose(`[DebugClient] Socket received ${data.length} bytes of raw data (msg #${this._messageCount})`);
      this._parser.write(data);
    });

    socket.on("error", (e) => {
      Log.message(`[DebugClient] Socket ERROR event: ${e.message}`);
      this._handleDisconnect(`Socket error: ${e.message}`);
    });

    socket.on("close", () => {
      Log.debug(`[DebugClient] Socket CLOSE event`);
      this._handleDisconnect("Socket closed");
    });

    socket.on("end", () => {
      Log.debug(`[DebugClient] Socket END event - remote side closed connection`);
    });

    socket.on("timeout", () => {
      Log.debug(`[DebugClient] Socket TIMEOUT event`);
    });

    socket.on("drain", () => {
      Log.verbose(`[DebugClient] Socket DRAIN event - write buffer emptied`);
    });

    // Periodic status check - log if we haven't received data in a while
    this._statusCheckInterval = setInterval(() => {
      if (this._state === DebugConnectionState.Connected) {
        const silentMs = Date.now() - this._lastDataReceivedTime;
        const socketState = this._socket
          ? `readable=${this._socket.readable}, writable=${this._socket.writable}, destroyed=${this._socket.destroyed}`
          : "no socket";
        Log.verbose(
          `[DebugClient] STATUS CHECK: Connected, silent for ${silentMs}ms, ${this._messageCount} msgs received, ${socketState}`
        );

        // If we haven't received any data for 10 seconds after connecting, something is wrong.
        // Only log this warning once to avoid spamming the console every 5 seconds.
        if (silentMs > 10000 && this._messageCount <= 2 && !this._statWarningLogged) {
          this._statWarningLogged = true;
          Log.debug(
            `[DebugClient] WARNING: No stat events received after ${silentMs}ms - Minecraft may not be sending stats`
          );
        }
      }
    }, 5000);

    // Set a timeout for the protocol handshake
    // If we don't receive a ProtocolEvent within the timeout, disconnect
    const handshakeTimeout = setTimeout(() => {
      if (this._state === DebugConnectionState.Connecting) {
        Log.message(
          `[Debug] Protocol handshake TIMEOUT after ${PROTOCOL_HANDSHAKE_TIMEOUT_MS}ms - no ProtocolEvent received`
        );
        this._handleDisconnect("Protocol handshake timeout - no ProtocolEvent received");
      }
    }, PROTOCOL_HANDSHAKE_TIMEOUT_MS);

    // Clear the timeout when we receive the protocol event (handled in _handleProtocolEvent)
    this._handshakeTimeoutId = handshakeTimeout;

    // Now wait for the ProtocolEvent from Minecraft
    // The _handleMessage method will complete the connection handshake
    Log.debug(`[Debug] Socket connected, waiting for ProtocolEvent (timeout: ${PROTOCOL_HANDSHAKE_TIMEOUT_MS}ms)...`);
  }

  // Timeout ID for protocol handshake
  private _handshakeTimeoutId: NodeJS.Timeout | undefined;

  /**
   * Disconnect from the debug server.
   */
  public disconnect(): void {
    if (this._socket) {
      this._socket.destroy();
      this._socket = undefined;
    }
    this._handleDisconnect("Client requested disconnect");
  }

  /**
   * Send a Minecraft command.
   */
  public sendCommand(command: string, dimensionType: "overworld" | "nether" | "the_end" = "overworld"): void {
    if (!this.isConnected) {
      throw new Error("Not connected to debug server");
    }

    if (this._protocolVersion < ProtocolVersion.SupportProfilerCaptures) {
      this._sendMessage({
        type: "minecraftCommand",
        command: command,
        dimension_type: dimensionType,
      });
    } else {
      this._sendMessage({
        type: "minecraftCommand",
        command: {
          command: command,
          dimension_type: dimensionType,
        },
      });
    }
  }

  /**
   * Resume execution (continue from breakpoint).
   */
  public resume(): void {
    this._sendMessage({ type: "resume" });
  }

  /**
   * Pause execution.
   */
  public pause(): void {
    this._sendMessage({ type: "pause" });
  }

  /**
   * Start the profiler.
   */
  public startProfiler(): void {
    if (!this._capabilities.supportsProfiler) {
      throw new Error("Profiler not supported by this Minecraft version");
    }

    this._sendMessage({
      type: "startProfiler",
      profiler: {
        target_module_uuid: this._targetModuleUuid,
      },
    });
  }

  /**
   * Stop the profiler and capture data.
   */
  public stopProfiler(capturesPath: string): void {
    if (!this._capabilities.supportsProfiler) {
      throw new Error("Profiler not supported by this Minecraft version");
    }

    this._sendMessage({
      type: "stopProfiler",
      profiler: {
        captures_path: capturesPath,
        target_module_uuid: this._targetModuleUuid,
      },
    });
  }

  /**
   * Send a message to the debug server.
   */
  private _sendMessage(envelope: unknown): void {
    if (!this._socket) {
      Log.message(`[DebugClient] SEND FAILED: No socket! Message: ${JSON.stringify(envelope).substring(0, 200)}`);
      return;
    }

    const json = JSON.stringify(envelope);
    Log.verbose(`[DebugClient] SENDING (${json.length} bytes): ${json.substring(0, 300)}`);
    const jsonBuffer = Buffer.from(json);

    // Length prefix: 8 hex digits + newline
    const messageLength = jsonBuffer.byteLength + 1; // +1 for trailing newline
    let lengthStr = "00000000" + messageLength.toString(16) + "\n";
    lengthStr = lengthStr.substring(lengthStr.length - 9);

    const lengthBuffer = Buffer.from(lengthStr);
    const newline = Buffer.from("\n");
    const buffer = Buffer.concat([lengthBuffer, jsonBuffer, newline]);

    this._socket.write(buffer);
  }

  /**
   * Handle incoming messages.
   */
  private _handleMessage(envelope: IDebugMessageEnvelope): void {
    Log.verbose(`[DebugClient] Processing message type: ${envelope.type}`);
    if (envelope.type === "event") {
      const eventEnvelope = envelope as IDebugEventEnvelope;
      const eventType = (eventEnvelope.event as any)?.type || "unknown";
      Log.verbose(`[DebugClient] Event type: ${eventType}`);
      this._handleEvent(eventEnvelope.event as { type: string; [key: string]: unknown });
    } else if (envelope.type === "response") {
      Log.verbose(`[DebugClient] Response for command: ${(envelope as IDebugResponseEnvelope).command}`);
      this._handleResponse(envelope as IDebugResponseEnvelope);
    } else if (envelope.type === "protocol") {
      Log.verbose(`[DebugClient] Received protocol message (as envelope.type=protocol)`);
      // Handle protocol messages that come as envelope.type="protocol" instead of event
      this._handleProtocolEvent(envelope as unknown as IProtocolEvent);
    } else {
      Log.message(
        `[DebugClient] UNKNOWN message type: ${envelope.type} - full envelope: ${JSON.stringify(envelope).substring(0, 500)}`
      );
    }
  }

  /**
   * Handle event messages from Minecraft.
   */
  private _handleEvent(event: { type: string; [key: string]: unknown }): void {
    switch (event.type) {
      case "ProtocolEvent":
        Log.verbose(`[DebugClient] Received ProtocolEvent`);
        this._handleProtocolEvent(event as unknown as IProtocolEvent);
        break;

      case "StatEvent2":
        this._handleStatEvent(event as unknown as IStatEvent);
        break;

      case "StoppedEvent":
        Log.verbose(`[DebugClient] Received StoppedEvent`);
        this._onStopped.dispatch(this, event as unknown as IStoppedEvent);
        break;

      case "ThreadEvent":
        Log.verbose(`[DebugClient] Received ThreadEvent`);
        this._onThread.dispatch(this, event as unknown as IThreadEvent);
        break;

      case "PrintEvent":
        this._onPrint.dispatch(this, event as unknown as IPrintEvent);
        break;

      case "NotificationEvent":
        Log.verbose(`Debug notification: ${event.message}`);
        break;

      case "ProfilerCapture":
        Log.verbose("Received profiler capture");
        this._onProfilerCapture.dispatch(this, event as unknown as IProfilerCaptureEvent);
        break;

      default:
        Log.verbose(`Unknown debug event type: ${event.type}`);
    }
  }

  /**
   * Handle protocol handshake event.
   */
  private _handleProtocolEvent(event: IProtocolEvent): void {
    Log.debug(`[DebugClient] ProtocolEvent received: version=${event.version}, plugins=${event.plugins?.length || 0}`);
    Log.verbose(`[DebugClient] Server version: ${event.version}, Our version: ${this._clientProtocolVersion}`);
    Log.verbose(`[DebugClient] Plugins: ${JSON.stringify(event.plugins)}`);
    Log.verbose(`[DebugClient] Requires passcode: ${event.require_passcode}`);

    this._protocolVersion = Math.min(event.version, this._clientProtocolVersion);
    this._plugins = event.plugins || [];

    // Determine capabilities based on protocol version
    this._capabilities = {
      supportsCommands: this._protocolVersion >= ProtocolVersion.SupportProfilerCaptures,
      supportsProfiler: this._protocolVersion >= ProtocolVersion.SupportProfilerCaptures,
      supportsBreakpointsAsRequest: this._protocolVersion >= ProtocolVersion.SupportBreakpointsAsRequest,
    };

    // Auto-select the first plugin if no target module specified
    // This is required to receive stats events for that module
    if (!this._targetModuleUuid && this._plugins.length > 0) {
      this._targetModuleUuid = this._plugins[0].module_uuid;
      Log.debug(`[DebugClient] Auto-selected plugin: ${this._plugins[0].name} (${this._targetModuleUuid})`);
    }

    // Log available plugins
    if (this._plugins.length > 0) {
      Log.verbose(
        `[DebugClient] Available plugins: ${this._plugins.map((p) => `${p.name} (${p.module_uuid})`).join(", ")}`
      );
    } else {
      Log.verbose(`[DebugClient] No plugins available - stats may not be reported`);
    }

    // Send protocol response
    const response: IDebugProtocolEnvelope = {
      type: "protocol",
      version: this._protocolVersion,
      target_module_uuid: this._targetModuleUuid,
      passcode: this._passcode,
    };
    Log.debug(
      `[DebugClient] Sending protocol response: version=${this._protocolVersion}, target=${this._targetModuleUuid}, hasPasscode=${!!this._passcode}`
    );
    this._sendMessage(response);

    // Clear the handshake timeout since we received the protocol event
    if (this._handshakeTimeoutId) {
      clearTimeout(this._handshakeTimeoutId);
      this._handshakeTimeoutId = undefined;
    }

    // Send a "resume" message to start stats flow
    // This mimics what VS Code's configurationDoneRequest does
    const resumeMessage = { type: "resume" };
    Log.debug(`[DebugClient] Sending 'resume' to start stats streaming...`);
    this._sendMessage(resumeMessage);

    // Mark as connected
    this._state = DebugConnectionState.Connected;
    Log.message(`[Debug] Connected to Minecraft debugger (v${this._protocolVersion})`);

    this._onProtocol.dispatch(this, event);
    this._onConnected.dispatch(this, this.sessionInfo);
  }

  /**
   * Handle statistics event.
   */
  private _handleStatEvent(event: IStatEvent): void {
    this._lastStatTick = event.tick;
    Log.verbose(`[DebugClient] StatEvent2 received: tick=${event.tick}, top-level stats: ${event.stats?.length || 0}`);

    // Flatten the hierarchical stats into a flat list
    const flatStats: IStatData[] = [];
    this._flattenStats(event.stats, event.tick, flatStats);

    Log.verbose(
      `[DebugClient] StatEvent2 processed: tick ${event.tick}, ${flatStats.length} flattened stats, dispatching to ${this._onStats.count} subscribers`
    );
    this._onStats.dispatch(this, { tick: event.tick, stats: flatStats });
  }

  /**
   * Flatten hierarchical stats into a flat list.
   */
  private _flattenStats(stats: IStatDataModel[], tick: number, output: IStatData[], parent?: IStatData): void {
    for (const stat of stats) {
      const statId = stat.name.toLowerCase();

      const statData: IStatData = {
        name: stat.name,
        id: statId,
        full_id: parent ? `${parent.full_id}_${statId}` : statId,
        parent_name: parent?.name || "",
        parent_id: parent?.id || "",
        parent_full_id: parent?.full_id || "",
        values: stat.values || [],
        children_string_values: [],
        should_aggregate: stat.should_aggregate,
        tick: tick,
      };

      // If aggregating, collect child string values
      if (stat.should_aggregate && stat.children) {
        for (const child of stat.children) {
          if (child.values && child.values.length > 0) {
            if (typeof child.values[0] === "string" && child.values[0].length > 0) {
              statData.children_string_values.push([child.name, child.values[0] as string]);
            } else if (typeof child.values[0] === "number") {
              const valueStrings = child.values.map((v) => v.toString());
              statData.children_string_values.push([child.name, ...valueStrings]);
            }
          }
        }
      }

      output.push(statData);

      // Recursively process children (if not aggregating)
      if (!stat.should_aggregate && stat.children) {
        this._flattenStats(stat.children, tick, output, statData);
      }
    }
  }

  /**
   * Handle response messages.
   */
  private _handleResponse(response: IDebugResponseEnvelope): void {
    const pending = this._pendingRequests.get(response.request_seq);
    if (pending) {
      this._pendingRequests.delete(response.request_seq);

      if (response.success) {
        pending.resolve(response.body);
      } else {
        pending.reject(new Error(response.message || `Request ${pending.command} failed`));
      }
    }
  }

  /**
   * Handle disconnect.
   */
  private _handleDisconnect(reason: string): void {
    const wasConnected = this._state === DebugConnectionState.Connected;
    const wasConnecting = this._state === DebugConnectionState.Connecting;
    this._state = DebugConnectionState.Disconnected;
    this._errorMessage = reason;

    // Clear handshake timeout if still pending
    if (this._handshakeTimeoutId) {
      clearTimeout(this._handshakeTimeoutId);
      this._handshakeTimeoutId = undefined;
    }

    // Clear status check interval
    if (this._statusCheckInterval) {
      clearInterval(this._statusCheckInterval);
      this._statusCheckInterval = undefined;
    }

    this._socket = undefined;
    this._protocolVersion = ProtocolVersion.Unknown;
    this._plugins = [];
    this._capabilities = {
      supportsCommands: false,
      supportsProfiler: false,
      supportsBreakpointsAsRequest: false,
    };

    // Reject all pending requests
    for (const [seq, pending] of this._pendingRequests) {
      pending.reject(new Error(`Disconnected: ${reason}`));
    }
    this._pendingRequests.clear();

    if (wasConnected || wasConnecting) {
      Log.message(`Debug client disconnected: ${reason}`);
      this._onDisconnected.dispatch(this, reason);
    }
  }
}
