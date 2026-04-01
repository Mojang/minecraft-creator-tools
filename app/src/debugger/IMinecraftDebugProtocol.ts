// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * ARCHITECTURE DOCUMENTATION: Minecraft Debug Protocol Types
 * ===========================================================
 *
 * This file defines interfaces for communicating with the Minecraft Bedrock Edition
 * debug server using a protocol similar to the VS Code Debug Adapter Protocol (DAP).
 *
 * ## Protocol Overview
 *
 * The Minecraft debug server uses a length-prefixed JSON message format:
 * - Messages are prefixed with an 8-character hex length + newline (e.g., "00000042\n")
 * - The message body is JSON followed by a newline
 *
 * ## Message Types
 *
 * 1. **Protocol Event**: Initial handshake with version negotiation
 * 2. **Stat Events**: Real-time performance statistics (StatEvent2)
 * 3. **Debug Events**: Breakpoint hits, thread events, etc.
 * 4. **Profiler Captures**: CPU profiling data
 *
 * ## Connection Flow
 *
 * 1. Server starts debug listener: `script debugger listen 19144`
 * 2. Client connects via TCP
 * 3. Server sends ProtocolEvent with capabilities
 * 4. Client responds with protocol version and target selection
 * 5. Real-time events flow (stats, breakpoints, etc.)
 *
 * ## Related Files
 *
 * - MinecraftDebugClient.ts: TCP client implementation
 * - DedicatedServer.ts: Starts debug listener on server start
 * - HttpServer.ts: Proxies debug data to web clients
 */

// ============================================================================
// Protocol Envelope Types
// ============================================================================

/**
 * Base envelope for all debug protocol messages.
 */
export interface IDebugMessageEnvelope {
  type: "event" | "response" | "request" | "protocol";
}

/**
 * Event message from Minecraft.
 */
export interface IDebugEventEnvelope extends IDebugMessageEnvelope {
  type: "event";
  event: IDebugEvent;
}

/**
 * Response to a request.
 */
export interface IDebugResponseEnvelope extends IDebugMessageEnvelope {
  type: "response";
  request_seq: number;
  success: boolean;
  command: string;
  body?: unknown;
  message?: string;
}

/**
 * Request message to Minecraft.
 */
export interface IDebugRequestEnvelope extends IDebugMessageEnvelope {
  type: "request";
  request: {
    request_seq: number;
    command: string;
    args?: unknown;
  };
}

/**
 * Protocol handshake message.
 */
export interface IDebugProtocolEnvelope extends IDebugMessageEnvelope {
  type: "protocol";
  version: number;
  target_module_uuid?: string;
  passcode?: string;
}

// ============================================================================
// Event Types
// ============================================================================

export type DebugEventType =
  | "StoppedEvent"
  | "ThreadEvent"
  | "PrintEvent"
  | "NotificationEvent"
  | "ProtocolEvent"
  | "StatEvent2"
  | "ProfilerCapture";

/**
 * Base debug event.
 */
export interface IDebugEvent {
  type: DebugEventType;
}

/**
 * Protocol capabilities sent by Minecraft on connection.
 */
export interface IProtocolEvent extends IDebugEvent {
  type: "ProtocolEvent";
  version: number;
  plugins: IPluginDetails[];
  require_passcode?: boolean;
}

export interface IPluginDetails {
  name: string;
  module_uuid: string;
}

/**
 * Breakpoint hit or pause event.
 */
export interface IStoppedEvent extends IDebugEvent {
  type: "StoppedEvent";
  reason: "breakpoint" | "exception" | "pause" | "step";
  thread: number;
  description?: string;
}

/**
 * Thread lifecycle event.
 */
export interface IThreadEvent extends IDebugEvent {
  type: "ThreadEvent";
  reason: "started" | "exited";
  thread: number;
}

/**
 * Console/script output event.
 */
export interface IPrintEvent extends IDebugEvent {
  type: "PrintEvent";
  message: string;
  logLevel?: number;
}

/**
 * Notification event (warnings, errors, etc.).
 */
export interface INotificationEvent extends IDebugEvent {
  type: "NotificationEvent";
  message: string;
  logLevel?: number;
}

/**
 * Profiler capture event.
 */
export interface IProfilerCaptureEvent extends IDebugEvent {
  type: "ProfilerCapture";
  capture_base_path: string;
  capture_data: string; // Base64 encoded
}

// ============================================================================
// Statistics Types (StatEvent2)
// ============================================================================

/**
 * Real-time statistics event from Minecraft.
 */
export interface IStatEvent extends IDebugEvent {
  type: "StatEvent2";
  tick: number;
  stats: IStatDataModel[];
}

/**
 * Hierarchical statistic data model.
 */
export interface IStatDataModel {
  name: string;
  children?: IStatDataModel[];
  values?: (number | string)[];
  should_aggregate: boolean;
}

/**
 * Flattened statistic data for processing.
 */
export interface IStatData {
  name: string;
  parent_name: string;
  id: string;
  full_id: string;
  parent_id: string;
  parent_full_id: string;
  values: (number | string)[];
  children_string_values: string[][];
  should_aggregate: boolean;
  tick: number;
}

// ============================================================================
// Command Types
// ============================================================================

/**
 * Minecraft command request.
 */
export interface IMinecraftCommandRequest {
  type: "minecraftCommand";
  command:
    | string
    | {
        command: string;
        dimension_type: "overworld" | "nether" | "the_end";
      };
  dimension_type?: "overworld" | "nether" | "the_end";
}

/**
 * Resume execution request.
 */
export interface IResumeRequest {
  type: "resume";
}

/**
 * Pause execution request.
 */
export interface IPauseRequest {
  type: "pause";
}

/**
 * Set breakpoint request.
 */
export interface ISetBreakpointRequest {
  type: "breakpoint";
  breakpoint: {
    path: string;
    line: number;
    column?: number;
  };
}

/**
 * Stop on exception configuration.
 */
export interface IStopOnExceptionRequest {
  type: "stopOnException";
  stopOnException: boolean;
}

/**
 * Start profiler request.
 */
export interface IStartProfilerRequest {
  type: "startProfiler";
  profiler: {
    target_module_uuid?: string;
  };
}

/**
 * Stop profiler request.
 */
export interface IStopProfilerRequest {
  type: "stopProfiler";
  profiler: {
    captures_path: string;
    target_module_uuid?: string;
  };
}

// ============================================================================
// Protocol Version Constants
// ============================================================================

/**
 * Protocol version history:
 * 1 - Initial version
 * 2 - Add targetModuleUuid to protocol event
 * 3 - Add array of plugins and target module IDs
 * 4 - Minecraft can require passcode
 * 5 - Debugger can take profiler captures
 * 6 - Breakpoints as request (MC can reject)
 */
export enum ProtocolVersion {
  Unknown = 0,
  Initial = 1,
  SupportTargetModuleUuid = 2,
  SupportTargetSelection = 3,
  SupportPasscode = 4,
  SupportProfilerCaptures = 5,
  SupportBreakpointsAsRequest = 6,
}

/**
 * Capabilities based on negotiated protocol version.
 */
export interface IMinecraftDebugCapabilities {
  supportsCommands: boolean;
  supportsProfiler: boolean;
  supportsBreakpointsAsRequest: boolean;
}

// ============================================================================
// Client State Types
// ============================================================================

/**
 * Current state of the debug connection.
 */
export enum DebugConnectionState {
  Disconnected = "disconnected",
  Connecting = "connecting",
  Connected = "connected",
  Error = "error",
}

/**
 * Debug session information.
 */
export interface IDebugSessionInfo {
  state: DebugConnectionState;
  host: string;
  port: number;
  protocolVersion: number;
  targetModuleUuid?: string;
  plugins: IPluginDetails[];
  capabilities: IMinecraftDebugCapabilities;
  lastStatTick?: number;
  errorMessage?: string;
}

// ============================================================================
// Notification Types (for WebSocket broadcast)
// ============================================================================

/**
 * Debug notification for web clients.
 */
export interface IDebugNotification {
  type: "debugger";
  eventType: "connected" | "disconnected" | "stats" | "stopped" | "print" | "protocol" | "error";
  data: unknown;
  timestamp: number;
}

/**
 * Stats update notification.
 */
export interface IDebugStatsNotification extends IDebugNotification {
  eventType: "stats";
  data: {
    tick: number;
    stats: IStatData[];
  };
}

/**
 * Connection state notification.
 */
export interface IDebugConnectionNotification extends IDebugNotification {
  eventType: "connected" | "disconnected";
  data: IDebugSessionInfo;
}
