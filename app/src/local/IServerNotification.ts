// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * IServerNotification
 *
 * Defines the notification protocol for WebSocket messages from HttpServer to web clients.
 * The format is designed to be similar to Minecraft's WebSocket protocol for consistency:
 *
 * {
 *   "header": {
 *     "version": 1,
 *     "requestId": "uuid",
 *     "messageType": "notification",
 *     "messagePurpose": "event"
 *   },
 *   "body": {
 *     "eventName": "fileChanged",
 *     ...event-specific data
 *   }
 * }
 *
 * Event Types:
 * - fileChanged: A file in the world content was modified
 * - fileAdded: A new file was added
 * - fileRemoved: A file was deleted
 * - folderChanged: A folder's contents changed
 * - playerMoved: A player's position changed
 * - playerJoined: A player connected to the server
 * - playerLeft: A player disconnected from the server
 * - serverStateChanged: Server status changed (starting, started, stopping, stopped)
 * - gameEvent: Generic game event from Minecraft
 */

/**
 * Header for all server notifications, similar to Minecraft WebSocket protocol.
 */
export interface IServerNotificationHeader {
  /** Protocol version (currently 1) */
  version: number;
  /** Unique identifier for this notification */
  requestId: string;
  /** Type of message - always "notification" for server-to-client */
  messageType: "notification";
  /** Purpose - "event" for notifications */
  messagePurpose: "event";
}

/**
 * Base interface for all notification bodies.
 */
export interface IServerNotificationBodyBase {
  /** Name of the event */
  eventName: ServerEventName;
  /** Timestamp when the event occurred */
  timestamp: number;
  /** Server slot/port this event relates to (if applicable) */
  slot?: number;
}

/**
 * Supported event names for server notifications.
 */
export type ServerEventName =
  | "fileChanged"
  | "fileAdded"
  | "fileRemoved"
  | "folderChanged"
  | "playerMoved"
  | "playerJoined"
  | "playerLeft"
  | "serverStateChanged"
  | "serverShutdown"
  | "statusUpdate"
  | "gameEvent"
  | "debugStats"
  | "debugConnected"
  | "debugDisconnected"
  | "debugPaused"
  | "debugResumed"
  | "debugProfilerState"
  | "profilerCapture";

/**
 * File change notification body.
 */
export interface IFileChangeNotificationBody extends IServerNotificationBodyBase {
  eventName: "fileChanged" | "fileAdded" | "fileRemoved";
  /** Category of the file (behavior_packs, resource_packs, world) */
  category: "behavior_packs" | "resource_packs" | "world";
  /** Relative path within the category */
  path: string;
}

/**
 * Folder change notification body.
 */
export interface IFolderChangeNotificationBody extends IServerNotificationBodyBase {
  eventName: "folderChanged";
  /** Category of the folder */
  category: "behavior_packs" | "resource_packs" | "world";
  /** Relative path within the category */
  path: string;
}

/**
 * Player movement notification body.
 */
export interface IPlayerMovedNotificationBody extends IServerNotificationBodyBase {
  eventName: "playerMoved";
  /** Player name */
  playerName: string;
  /** Player's new position */
  position: { x: number; y: number; z: number };
  /** Player's rotation (yaw, pitch) */
  rotation?: { yaw: number; pitch: number };
  /** Dimension the player is in */
  dimension?: string;
}

/**
 * Player join/leave notification body.
 */
export interface IPlayerConnectionNotificationBody extends IServerNotificationBodyBase {
  eventName: "playerJoined" | "playerLeft";
  /** Player name */
  playerName: string;
  /** Player's Xbox User ID (if available) */
  xuid?: string;
}

/**
 * Server state change notification body.
 */
export interface IServerStateNotificationBody extends IServerNotificationBodyBase {
  eventName: "serverStateChanged";
  /** New server state */
  state: "starting" | "started" | "stopping" | "stopped" | "error";
  /** Optional message with more details */
  message?: string;
}

/**
 * Full server status update notification body.
 * This replaces the need for polling /api/{slot}/status/
 */
export interface IStatusUpdateNotificationBody extends IServerNotificationBodyBase {
  eventName: "statusUpdate";
  /** Current server status (matches DedicatedServerStatus values) */
  status: number;
  /** Recent messages from the server */
  recentMessages?: Array<{
    message: string;
    received: number;
    type?: number;
  }>;
  /** Server title */
  title?: string;
  /** Additional status data */
  additionalData?: Record<string, unknown>;
}

/**
 * Generic game event notification body (forwarded from Minecraft).
 */
export interface IGameEventNotificationBody extends IServerNotificationBodyBase {
  eventName: "gameEvent";
  /** Original Minecraft event name */
  minecraftEventName: string;
  /** Original event data from Minecraft */
  data: object;
}

/**
 * Debug stats notification body (from script debugger).
 * Contains performance statistics from the Minecraft script runtime.
 */
export interface IDebugStatsNotificationBody extends IServerNotificationBodyBase {
  eventName: "debugStats";
  /** Tick number when stats were captured */
  tick: number;
  /** Flattened statistics data */
  stats: IDebugStatItem[];
}

/**
 * Individual stat item (flattened from hierarchical IStatDataModel).
 */
export interface IDebugStatItem {
  /** Stat name (e.g., "tick", "worldTick", "scriptAfterEvents") */
  name: string;
  /** Stat values (typically timing or count data) */
  values: (number | string)[];
  /** Optional parent stat name for hierarchical reconstruction */
  parent?: string;
}

/**
 * Debug connected notification body.
 */
export interface IDebugConnectedNotificationBody extends IServerNotificationBodyBase {
  eventName: "debugConnected";
  /** Protocol version negotiated with the debugger */
  protocolVersion: number;
  /** Session ID */
  sessionId?: string;
}

/**
 * Debug disconnected notification body.
 */
export interface IDebugDisconnectedNotificationBody extends IServerNotificationBodyBase {
  eventName: "debugDisconnected";
  /** Reason for disconnection */
  reason: string;
}

/**
 * Debug paused notification body.
 * Sent when script execution is paused (e.g., at a breakpoint or via pause command).
 */
export interface IDebugPausedNotificationBody extends IServerNotificationBodyBase {
  eventName: "debugPaused";
  /** Reason for pausing (e.g., "breakpoint", "pause", "step") */
  reason: string;
}

/**
 * Debug resumed notification body.
 * Sent when script execution resumes from a paused state.
 */
export interface IDebugResumedNotificationBody extends IServerNotificationBodyBase {
  eventName: "debugResumed";
}

/**
 * Profiler state notification body.
 * Sent when the profiler starts or stops.
 */
export interface IDebugProfilerStateNotificationBody extends IServerNotificationBodyBase {
  eventName: "debugProfilerState";
  /** Whether the profiler is currently running */
  isRunning: boolean;
}

/**
 * Profiler capture notification body.
 * Sent when profiler data is captured (after stopProfiler).
 */
export interface IProfilerCaptureNotificationBody extends IServerNotificationBodyBase {
  eventName: "profilerCapture";
  /** Base path where the capture was saved */
  captureBasePath: string;
  /** Base64 encoded profiler data (can be decoded and displayed) */
  captureData: string;
}

/**
 * Server shutdown notification body.
 * Sent to all connected clients before the HTTP server shuts down.
 * This indicates the entire MCT server is going away (not just a BDS instance).
 */
export interface IServerShutdownNotificationBody extends IServerNotificationBodyBase {
  eventName: "serverShutdown";
  /** Reason for shutdown (e.g., "Process terminated by SIGINT", "User requested shutdown") */
  reason: string;
  /** Whether this is a graceful shutdown (true) or unexpected (false) */
  graceful: boolean;
}

/**
 * Union type of all notification body types.
 */
export type IServerNotificationBody =
  | IFileChangeNotificationBody
  | IFolderChangeNotificationBody
  | IPlayerMovedNotificationBody
  | IPlayerConnectionNotificationBody
  | IServerStateNotificationBody
  | IStatusUpdateNotificationBody
  | IGameEventNotificationBody
  | IDebugStatsNotificationBody
  | IDebugConnectedNotificationBody
  | IDebugDisconnectedNotificationBody
  | IDebugPausedNotificationBody
  | IDebugResumedNotificationBody
  | IDebugProfilerStateNotificationBody
  | IProfilerCaptureNotificationBody
  | IServerShutdownNotificationBody;

/**
 * Complete server notification message.
 */
export interface IServerNotification {
  header: IServerNotificationHeader;
  body: IServerNotificationBody;
}

/**
 * Subscription request from client to server.
 */
export interface ISubscriptionRequest {
  header: {
    version: number;
    requestId: string;
    messageType: "subscriptionRequest";
    messagePurpose: "subscribe" | "unsubscribe";
  };
  body: {
    /** Event names to subscribe/unsubscribe from */
    eventNames: ServerEventName[];
    /** Server slot to filter events for (optional) */
    slot?: number;
  };
}

/**
 * Subscription response from server.
 */
export interface ISubscriptionResponse {
  header: {
    version: number;
    requestId: string;
    messageType: "subscriptionResponse";
    messagePurpose: "response";
  };
  body: {
    success: boolean;
    /** Currently subscribed events */
    subscribedEvents: ServerEventName[];
    message?: string;
  };
}
