// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * DebuggerLifecycle
 *
 * A legible, explicit state model for the managed-BDS script debugger lifecycle.
 *
 * MCT owns the whole debugger flow against a managed Bedrock Dedicated Server:
 * writing debugger settings into server.properties, reserving a dynamic debug
 * port, issuing `script debugger listen <port>`, waiting for the parsed
 * "Debugger listening" confirmation, connecting the TCP debug client,
 * completing the protocol handshake (negotiation, passcode, target module
 * selection, resume), and streaming stats until stop/restart.
 *
 * Because Minecraft accepts exactly one debugger client, lifecycle ownership
 * must be explicit: every stage transition and failure is recorded here so the
 * UX (DebugStatsPanel) and diagnostics can show precisely where the flow is,
 * and stage-specific recovery actions can be offered.
 *
 * Related files:
 * - DedicatedServer.ts: drives the lifecycle against the BDS child process
 * - MinecraftDebugClient.ts: the TCP debug protocol client
 * - DedicatedServerCommandHandler.ts: forwards stage changes over Electron IPC
 * - DebugStatsPanel.tsx: renders stage, diagnostics, and recovery actions
 */

import { EventDispatcher, IEvent } from "ste-events";
import { redactAbsolutePaths } from "../core/PathRedaction";

/**
 * Stages of the managed debugger lifecycle, in rough chronological order.
 * String values so they serialize legibly over IPC/WebSocket.
 */
export enum DebuggerLifecycleStage {
  idle = "idle",
  configuring = "configuring",
  startingServer = "startingServer",
  startingListener = "startingListener",
  waitingForReadiness = "waitingForReadiness",
  connectingTcp = "connectingTcp",
  negotiating = "negotiating",
  selectingTarget = "selectingTarget",
  resuming = "resuming",
  connected = "connected",
  reconnecting = "reconnecting",
  stopping = "stopping",
  failed = "failed",
}

/**
 * Distinct failure categories, so errors from different stages are never
 * conflated (e.g., an occupied port vs. a TCP connect refusal).
 */
export enum DebuggerFailureKind {
  none = "none",
  settings = "settings",
  /** BDS itself failed startup preflight (missing executable, bad signature) - the debugger flow never got a server to attach to */
  serverStartup = "serverStartup",
  portOccupied = "portOccupied",
  listenerReadiness = "listenerReadiness",
  tcpConnect = "tcpConnect",
  /**
   * No ProtocolEvent arrived within the handshake window. Proves only that
   * the peer was slow or silent (overloaded BDS, transiently contended
   * endpoint) - NOT that an incompatible version was observed - so it is
   * retryable, unlike protocolMismatch.
   */
  handshakeTimeout = "handshakeTimeout",
  protocolMismatch = "protocolMismatch",
  passcode = "passcode",
  moduleSelection = "moduleSelection",
  sourceMapConfiguration = "sourceMapConfiguration",
  prematureClose = "prematureClose",
}

/**
 * Recovery actions the UX can offer for a given failure.
 */
export enum DebuggerRecoveryAction {
  retry = "retry",
  changeSettings = "changeSettings",
  viewLogs = "viewLogs",
  copyDiagnostics = "copyDiagnostics",
  stopServer = "stopServer",
}

/** A single recorded stage transition. */
export interface IDebuggerStageTransition {
  stage: DebuggerLifecycleStage;
  at: string;
  detail?: string;
}

/** Lightweight stage-change payload, safe to serialize over IPC. */
export interface IDebuggerStageEventData {
  stage: DebuggerLifecycleStage;
  failureKind: DebuggerFailureKind;
  errorMessage?: string;
  detail?: string;
  debugPort?: number;
}

/**
 * Full diagnostics snapshot. All free-text fields must be sanitized with
 * sanitizeDebuggerDiagnosticText before they land here, so that copied
 * diagnostics never contain creator content, local paths, passcodes, or tokens.
 */
export interface IDebuggerDiagnostics {
  stage: DebuggerLifecycleStage;
  failureKind: DebuggerFailureKind;
  errorMessage?: string;
  generatedAt: string;
  bdsVersion?: string;
  serverPort?: number;
  debugPort?: number;
  inboundScriptDebuggingEnabled?: boolean;
  outboundScriptDebuggingEnabled?: boolean;
  protocolVersion?: number;
  /**
   * Whether a target script module was selected - a derived boolean, never
   * the module UUID itself. Module UUIDs are creator-identifying: this
   * snapshot is serialized across IPC/HTTP and written verbatim to the
   * clipboard by the panel's Copy Diagnostic Details action, so the raw id
   * must not exist in it (the evidence sanitizer makes the same call).
   */
  hasTargetModule?: boolean;
  pluginCount?: number;
  stageHistory: IDebuggerStageTransition[];
  recentServerMessages: string[];
}

const MAX_STAGE_HISTORY = 40;

/**
 * Remove content from diagnostic text that must never leave the machine:
 * absolute filesystem paths, passcodes, tokens, and player xuids.
 */
export function sanitizeDebuggerDiagnosticText(text: string): string {
  // Quoted, file://, drive, UNC, and Unix paths with any root. A support
  // payload must never leak a partial segment, so each complete path
  // (including folder names with spaces) becomes "<path>".
  let result = redactAbsolutePaths(text);

  // Passcodes and tokens ("Bearer xyz" first, so the credential after the
  // Bearer keyword is consumed before the key:value pass sees it)
  result = result.replace(/\b(bearer\s+)\S+/gi, "$1<redacted>");
  result = result.replace(
    /((?:passcode|password|token|secret|authorization)["']?\s*[:=]\s*)("[^"]*"|\S+)/gi,
    "$1<redacted>"
  );

  // Bare JWTs: a JWT can appear with NO Bearer/key prefix (query strings,
  // JSON fields, pasted log lines), where neither rule above sees it. JWTs
  // are self-identifying - "eyJ" is base64url for '{"' - so redact the
  // dotted three-segment shape wherever it stands (the signature segment
  // may be empty for unsecured JWTs).
  result = result.replace(/\beyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/g, "<redacted>");

  // Player Xbox user ids
  result = result.replace(/\b(xuid["']?\s*:?\s*)\d{6,}/gi, "$1<redacted>");

  return result;
}

/**
 * Classify a BDS "Failed to start debugger" console line into a failure kind.
 */
export function classifyDebuggerListenFailure(line: string): DebuggerFailureKind {
  const lower = line.toLowerCase();

  // "port" must match as a word: a bare substring check also hits
  // "unsupported", "support", "export", etc., mislabeling unrelated failures
  // as portOccupied and steering users toward the wrong recovery actions.
  if (lower.includes("in use") || lower.includes("bind") || /\bports?\b/.test(lower)) {
    return DebuggerFailureKind.portOccupied;
  }

  return DebuggerFailureKind.listenerReadiness;
}

/**
 * Classify a MinecraftDebugClient disconnect reason into a failure kind.
 */
export function classifyDebugClientDisconnectReason(reason: string): DebuggerFailureKind {
  const lower = reason.toLowerCase();

  if (lower.includes("passcode")) {
    return DebuggerFailureKind.passcode;
  }

  // protocolMismatch is reserved for an EXPLICITLY observed unsupported/
  // mismatched version - it is treated as permanent (no reconnect).
  if (lower.includes("protocol") && (lower.includes("mismatch") || lower.includes("unsupported"))) {
    return DebuggerFailureKind.protocolMismatch;
  }

  // A handshake timeout proves only that the peer was slow or silent, not
  // that an incompatible version was observed - classify it as its own
  // retryable kind so one slow handshake does not disable auto-recovery.
  if (lower.includes("handshake timeout")) {
    return DebuggerFailureKind.handshakeTimeout;
  }

  if (lower.includes("failed to connect") || lower.includes("econnrefused") || lower.includes("connection timeout")) {
    return DebuggerFailureKind.tcpConnect;
  }

  if (lower.includes("source map")) {
    return DebuggerFailureKind.sourceMapConfiguration;
  }

  if (lower.includes("module")) {
    return DebuggerFailureKind.moduleSelection;
  }

  return DebuggerFailureKind.prematureClose;
}

/**
 * Recovery actions to offer for each failure kind. copyDiagnostics and
 * viewLogs are always applicable; the leading actions vary by failure.
 */
export function getRecoveryActionsForFailure(kind: DebuggerFailureKind): DebuggerRecoveryAction[] {
  const common = [
    DebuggerRecoveryAction.viewLogs,
    DebuggerRecoveryAction.copyDiagnostics,
    DebuggerRecoveryAction.stopServer,
  ];

  switch (kind) {
    case DebuggerFailureKind.settings:
    case DebuggerFailureKind.passcode:
    case DebuggerFailureKind.sourceMapConfiguration:
      return [DebuggerRecoveryAction.changeSettings, DebuggerRecoveryAction.retry, ...common];

    case DebuggerFailureKind.serverStartup:
      // A debugger-connection retry cannot fix a server that never started.
      return common;

    case DebuggerFailureKind.protocolMismatch:
      // An incompatible protocol version is permanent for this pairing of
      // MCT and Minecraft builds: DedicatedServer fails it without
      // auto-reconnect, and a user retry is a guaranteed repeat failure.
      return common;

    default:
      return [DebuggerRecoveryAction.retry, ...common];
  }
}

/**
 * Tracks the current debugger lifecycle stage, its transition history, and
 * failure details. Owned by DedicatedServer; observed by IPC/WebSocket layers.
 */
export default class DebuggerLifecycleTracker {
  #stage: DebuggerLifecycleStage = DebuggerLifecycleStage.idle;
  #failureKind: DebuggerFailureKind = DebuggerFailureKind.none;
  #errorMessage: string | undefined;
  #history: IDebuggerStageTransition[] = [];

  #onStageChanged = new EventDispatcher<DebuggerLifecycleTracker, IDebuggerStageEventData>();

  public get onStageChanged(): IEvent<DebuggerLifecycleTracker, IDebuggerStageEventData> {
    return this.#onStageChanged.asEvent();
  }

  public get stage(): DebuggerLifecycleStage {
    return this.#stage;
  }

  public get failureKind(): DebuggerFailureKind {
    return this.#failureKind;
  }

  public get errorMessage(): string | undefined {
    return this.#errorMessage;
  }

  public get history(): IDebuggerStageTransition[] {
    return this.#history.slice();
  }

  /**
   * Move to a new (non-failed) stage. Clears any previous failure when the
   * flow makes forward progress again.
   */
  public transition(stage: DebuggerLifecycleStage, detail?: string): void {
    if (stage === this.#stage && stage !== DebuggerLifecycleStage.reconnecting) {
      return;
    }

    this.#stage = stage;

    if (stage !== DebuggerLifecycleStage.failed) {
      this.#failureKind = DebuggerFailureKind.none;
      this.#errorMessage = undefined;
    }

    this.#record(stage, detail);
    this.#dispatch(detail);
  }

  /**
   * Move to the failed stage with a specific failure kind. The message is
   * sanitized before being stored.
   */
  public fail(kind: DebuggerFailureKind, message: string): void {
    this.#stage = DebuggerLifecycleStage.failed;
    this.#failureKind = kind;
    this.#errorMessage = sanitizeDebuggerDiagnosticText(message);

    this.#record(DebuggerLifecycleStage.failed, `${kind}: ${this.#errorMessage}`);
    this.#dispatch();
  }

  public reset(): void {
    this.#stage = DebuggerLifecycleStage.idle;
    this.#failureKind = DebuggerFailureKind.none;
    this.#errorMessage = undefined;
    this.#history = [];
  }

  #record(stage: DebuggerLifecycleStage, detail?: string): void {
    this.#history.push({
      stage: stage,
      at: new Date().toISOString(),
      detail: detail ? sanitizeDebuggerDiagnosticText(detail) : undefined,
    });

    if (this.#history.length > MAX_STAGE_HISTORY) {
      this.#history.splice(0, this.#history.length - MAX_STAGE_HISTORY);
    }
  }

  #dispatch(detail?: string): void {
    this.#onStageChanged.dispatch(this, {
      stage: this.#stage,
      failureKind: this.#failureKind,
      errorMessage: this.#errorMessage,
      detail: detail,
    });
  }
}
