// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * DebugAdapterTest.ts
 *
 * Comprehensive tests for the Minecraft debug adapter protocol integration:
 * - MinecraftDebugClient connection and retry logic
 * - Debug protocol message parsing
 * - Integration with DedicatedServer
 * - HttpServer WebSocket broadcasting of debug events
 * - End-to-end flow: serve command → HTTP server → BDS → debug adapter
 *
 * These tests verify the debug streaming functionality that allows MCTools
 * to receive real-time statistics and debug events from Minecraft servers.
 *
 * Note: Full end-to-end tests require a running Bedrock Dedicated Server
 * and are marked as slow/integration tests. Unit tests use mocks.
 */

import { expect, assert } from "chai";
import MinecraftDebugClient from "../debugger/MinecraftDebugClient";
import DebugMessageStreamParser, { MAX_DEBUG_MESSAGE_LENGTH } from "../debugger/DebugMessageStreamParser";
import DebugRequestManager, { DebugRequestError } from "../debugger/DebugRequestManager";
import {
  DebugConnectionState,
  IDiagnosticsTabDescriptor,
  IStatData,
  MaxSupportedProtocolVersion,
  ProtocolVersion,
} from "../debugger/IMinecraftDebugProtocol";
import { DebuggerFailureKind, DebuggerLifecycleStage } from "../debugger/DebuggerLifecycle";
import { deriveDebugOwnership } from "../debugger/DiagnosticsSchemaUtilities";
import { HydrationGate, applyHydrationSnapshot } from "../debugger/DebugPanelHydration";
import { DEBUG_PANEL_SUBSCRIPTION_EVENTS } from "../app/IServerNotification";
import DebugPortRegistry from "../debugger/DebugPortRegistry";
import DedicatedServer, { DedicatedServerStatus } from "../local/DedicatedServer";
import { buildDebugSlotConfig } from "../local/HttpServer";
import ServerManager from "../local/ServerManager";
import TestPaths, { ITestEnvironment } from "./TestPaths";
import Utilities from "../core/Utilities";
import { AppServiceProxyCommands } from "../core/AppServiceProxy";
import LocalUtilities from "../local/LocalUtilities";
import NodeStorage from "../local/NodeStorage";
import { Server, createServer, Socket } from "net";
import { createServer as createHttpTestServer } from "http";
import HttpStorage from "../storage/HttpStorage";
import { PassThrough } from "stream";
import { EventEmitter } from "events";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

/**
 * MockMinecraftDebugServer - simulates a Minecraft debug server for testing
 */
class MockMinecraftDebugServer {
  private _server: Server | undefined;
  private _clients: Socket[] = [];
  private _port: number;
  private _protocolVersion: number;
  private _sendProtocolEventOnConnect: boolean = true;
  // Every client -> server message, parsed with the same length-prefixed
  // framing the real server reads, so tests can assert the EXACT outbound
  // JSON the client emits (nested pre-Cereal vs. v8+ flat payload shapes).
  private _receivedMessages: { type?: string; [key: string]: unknown }[] = [];
  // Simulate Minecraft's single-client debug endpoint: while one client is
  // attached, additional connections are ACCEPTED and then immediately closed
  // without a ProtocolEvent - the real-world ownership-conflict signature.
  private _singleClientMode: boolean = false;
  // Delay before the ProtocolEvent is sent on connect - simulates a slow
  // (but valid) handshake negotiation.
  private _protocolEventDelayMs: number = 0;
  // When true, the ProtocolEvent advertises require_passcode - a client with
  // no passcode configured must reject the session with a typed reason.
  private _requirePasscode: boolean = false;
  // Every connection ever accepted, including ones later closed - lets tests
  // assert how many attach attempts actually hit the wire.
  private _totalConnectionCount: number = 0;

  constructor(port: number = 19144, protocolVersion: number = ProtocolVersion.SupportBreakpointsAsRequest) {
    this._port = port;
    this._protocolVersion = protocolVersion;
  }

  get port(): number {
    return this._port;
  }

  set sendProtocolEventOnConnect(value: boolean) {
    this._sendProtocolEventOnConnect = value;
  }

  set requirePasscode(value: boolean) {
    this._requirePasscode = value;
  }

  set singleClientMode(value: boolean) {
    this._singleClientMode = value;
  }

  set protocolEventDelayMs(value: number) {
    this._protocolEventDelayMs = value;
  }

  /** Total connections accepted over the server's lifetime. */
  get totalConnectionCount(): number {
    return this._totalConnectionCount;
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this._server = createServer((socket) => {
        this._totalConnectionCount++;

        if (this._singleClientMode && this._clients.length >= 1) {
          // Endpoint is owned: accept, then close without ever speaking.
          socket.destroy();
          return;
        }

        this._clients.push(socket);

        socket.on("close", () => {
          const index = this._clients.indexOf(socket);
          if (index >= 0) {
            this._clients.splice(index, 1);
          }
        });

        const inboundParser = new DebugMessageStreamParser();
        inboundParser.onMessage.subscribe((_, message) => {
          this._receivedMessages.push(message as { type?: string; [key: string]: unknown });
        });

        socket.on("data", (data) => {
          inboundParser.write(data);
        });

        // Send ProtocolEvent upon connection (like real Minecraft), with an
        // optional delay to simulate a slow negotiation.
        if (this._sendProtocolEventOnConnect) {
          if (this._protocolEventDelayMs > 0) {
            setTimeout(() => {
              if (!socket.destroyed) {
                this.sendProtocolEvent(socket);
              }
            }, this._protocolEventDelayMs);
          } else {
            this.sendProtocolEvent(socket);
          }
        }
      });

      this._server.on("error", reject);
      this._server.listen(this._port, "localhost", () => {
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    // Close all client connections
    for (const client of this._clients) {
      client.destroy();
    }
    this._clients = [];

    return new Promise((resolve) => {
      if (this._server) {
        this._server.close(() => {
          this._server = undefined;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Send a protocol event to establish the debug session
   */
  sendProtocolEvent(socket?: Socket): void {
    const envelope = {
      type: "event",
      event: {
        type: "ProtocolEvent",
        version: this._protocolVersion,
        require_passcode: this._requirePasscode ? true : undefined,
        plugins: [
          {
            module_uuid: "test-module-uuid",
            name: "TestPlugin",
          },
        ],
      },
    };

    this._sendToClients(envelope, socket);
  }

  /**
   * Send a StatEvent2 with mock statistics
   */
  sendStatEvent(tick: number, stats: IStatData[], socket?: Socket): void {
    const envelope = {
      type: "event",
      event: {
        type: "StatEvent2",
        tick: tick,
        stats: stats,
      },
    };

    this._sendToClients(envelope, socket);
  }

  /**
   * Send a SchemaEvent with diagnostics descriptors (protocol v9+/v10).
   * Accepts unknown payloads so malformed-descriptor tests can use it too.
   */
  sendSchemaEvent(descriptors: unknown, socket?: Socket): void {
    const envelope = {
      type: "event",
      event: {
        type: "SchemaEvent",
        descriptors: descriptors,
      },
    };

    this._sendToClients(envelope, socket);
  }

  /**
   * Send a PrintEvent (console output)
   */
  sendPrintEvent(category: string, message: string, socket?: Socket): void {
    const envelope = {
      type: "event",
      event: {
        type: "PrintEvent",
        category: category,
        message: message,
      },
    };

    this._sendToClients(envelope, socket);
  }

  /**
   * Send a correlated debuggee-response (protocol v7+). Top-level envelope,
   * exactly as the official DebuggeeResponseEnvelope arrives on the wire.
   */
  sendDebuggeeResponse(
    requestSeq: number,
    options?: { args?: unknown; success?: boolean; responseMessage?: string },
    socket?: Socket
  ): void {
    const envelope: { [key: string]: unknown } = {
      type: "debuggee-response",
      request_seq: requestSeq,
    };

    if (options?.args !== undefined) {
      envelope.args = options.args;
    }
    if (options?.success !== undefined) {
      envelope.success = options.success;
    }
    if (options?.responseMessage !== undefined) {
      envelope.response_message = options.responseMessage;
    }

    this._sendToClients(envelope, socket);
  }

  /**
   * Write raw bytes to every connected client, bypassing framing - for
   * malformed-input tests.
   */
  sendRawBytes(data: Buffer): void {
    for (const client of this._clients) {
      if (!client.destroyed) {
        client.write(data);
      }
    }
  }

  /** All parsed client -> server messages, in arrival order. */
  get receivedMessages(): { type?: string; [key: string]: unknown }[] {
    return this._receivedMessages;
  }

  /**
   * Wait until a client -> server message with the given type has arrived and
   * return it. Throws on timeout so tests fail with a clear message instead
   * of asserting against undefined.
   */
  async waitForMessage(type: string, timeoutMs: number = 5000): Promise<{ type?: string; [key: string]: unknown }> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const match = this._receivedMessages.find((m) => m.type === type);
      if (match) {
        return match;
      }
      await Utilities.sleep(50);
    }
    throw new Error(
      `Timed out waiting for client message of type "${type}". Received: ${JSON.stringify(
        this._receivedMessages.map((m) => m.type)
      )}`
    );
  }

  /**
   * Get the number of connected clients
   */
  get clientCount(): number {
    return this._clients.length;
  }


  private _sendToClients(envelope: unknown, specificSocket?: Socket): void {
    const json = JSON.stringify(envelope);
    const jsonBuffer = Buffer.from(json);

    // Length prefix: 8 hex digits + newline
    const messageLength = jsonBuffer.byteLength + 1;
    let lengthStr = "00000000" + messageLength.toString(16) + "\n";
    lengthStr = lengthStr.substring(lengthStr.length - 9);

    const lengthBuffer = Buffer.from(lengthStr);
    const newline = Buffer.from("\n");
    const buffer = Buffer.concat([lengthBuffer, jsonBuffer, newline]);

    const targets = specificSocket ? [specificSocket] : this._clients;
    for (const client of targets) {
      if (!client.destroyed) {
        client.write(buffer);
      }
    }
  }
}

describe("DebugAdapter", function () {
  this.timeout(30000); // Debug connections can take time

  describe("MinecraftDebugClient", function () {
    describe("Connection State Management", function () {
      it("should start in disconnected state", function () {
        const client = new MinecraftDebugClient();
        expect(client.state).to.equal(DebugConnectionState.Disconnected);
        expect(client.isConnected).to.be.false;
      });

      it("should have valid session info when disconnected", function () {
        const client = new MinecraftDebugClient();
        const sessionInfo = client.sessionInfo;

        expect(sessionInfo.state).to.equal(DebugConnectionState.Disconnected);
        expect(sessionInfo.protocolVersion).to.equal(ProtocolVersion.Unknown);
        expect(sessionInfo.host).to.equal("localhost");
        expect(sessionInfo.port).to.equal(19144);
      });

      it("should throw when connecting while already connected", async function () {
        const mockServer = new MockMinecraftDebugServer(19200);
        await mockServer.start();

        const client = new MinecraftDebugClient();
        await client.connect("localhost", 19200);

        try {
          await client.connect("localhost", 19200);
          assert.fail("Should have thrown");
        } catch (e: any) {
          expect(e.message).to.include("Already connected");
        } finally {
          client.disconnect();
          await mockServer.stop();
        }
      });
    });

    describe("Connection Retry Logic", function () {
      it("should retry connection on failure", async function () {
        const client = new MinecraftDebugClient();
        const startTime = Date.now();

        try {
          // Try to connect to a port that's not listening
          await client.connect("localhost", 19201);
          assert.fail("Should have thrown");
        } catch (e: any) {
          const elapsed = Date.now() - startTime;

          // Should have taken at least a few seconds with retries
          // With exponential backoff: 0 + 1000 + 2000 + 4000 + 8000 = 15000ms minimum
          // But we also have connection timeouts, so it may vary
          expect(elapsed).to.be.greaterThan(1000);
          expect(e.message).to.include("Failed to connect");
          expect(e.message).to.include("19201");
        }

        expect(client.state).to.equal(DebugConnectionState.Error);

        // Transport-level failure (nothing listening: listener not ready,
        // refused, firewall) must carry the typed "connectFailed" reason and
        // must NOT classify as external ownership - even if the 10-second
        // fallback (listenerConfirmed=false) or a real confirmation
        // (listenerConfirmed=true) said the listener should be up.
        expect(client.lastAttachFailure).to.equal("connectFailed");
        for (const listenerConfirmed of [false, true]) {
          expect(
            deriveDebugOwnership({
              clientConnected: false,
              attachFailure: client.lastAttachFailure,
              listenerConfirmed: listenerConfirmed,
              debuggerEnabled: true,
              streamingEnabled: true,
            }),
            `connectFailed with listenerConfirmed=${listenerConfirmed}`
          ).to.equal("unknown");
        }
      });

      it("disconnect during the retry loop cancels the attempt before a socket is assigned", async function () {
        // Deferred regression: cancel while the TCP retry/backoff is pending,
        // THEN bring the endpoint up. The dead attempt must never dial it.
        const client = new MinecraftDebugClient();
        let rejectionMessage = "";

        const connectPromise = client.connect("localhost", 19790).catch((e: any) => {
          rejectionMessage = e?.message ? String(e.message) : String(e);
        });

        // Inside the retry window (attempt 2 fails ~1s in; backoff to ~3s).
        await Utilities.sleep(1200);
        client.disconnect();

        // The endpoint comes up AFTER the cancel (as it would when a server
        // restarts); a live attempt would dial it at ~3s.
        const mockServer = new MockMinecraftDebugServer(19790);
        await mockServer.start();

        await connectPromise;

        // Cover the window where the canceled loop's next dials would land.
        await Utilities.sleep(4500);

        expect(rejectionMessage, "connect() must settle as canceled").to.include("canceled");
        expect(client.state).to.equal(DebugConnectionState.Disconnected);
        expect(mockServer.clientCount, "no later connection may occur after disconnect").to.equal(0);

        await mockServer.stop();
      });

      it("should successfully connect to mock server", async function () {
        const mockServer = new MockMinecraftDebugServer(19202);
        await mockServer.start();

        const client = new MinecraftDebugClient();
        let connected = false;

        client.onConnected.subscribe(() => {
          connected = true;
        });

        await client.connect("localhost", 19202);

        // Wait for protocol event to be processed
        await Utilities.sleep(500);

        expect(client.state).to.equal(DebugConnectionState.Connected);
        expect(connected).to.be.true;

        client.disconnect();
        await mockServer.stop();
      });

      it("disconnect during a pending TCP dial destroys the dialing socket immediately", async function () {
        // Deferred regression: cancel while the TCP dial itself is IN FLIGHT
        // (SYN sent, no reply yet). Generation invalidation alone cannot
        // reach this socket - it is only assigned to _socket after the dial
        // succeeds - so without an explicit destroy the obsolete dial could
        // still complete its handshake and briefly consume Minecraft's
        // single-client debugger slot before the generation check released
        // it. 192.0.2.1 (TEST-NET-1, RFC 5737) never answers, keeping the
        // dial pending until the per-attempt timeout.
        const client = new MinecraftDebugClient();
        let rejectionMessage = "";

        const connectPromise = client.connect("192.0.2.1", 19144).catch((e: any) => {
          rejectionMessage = e?.message ? String(e.message) : String(e);
        });

        // Grab the retained in-flight dial socket.
        let pendingSocket: { destroyed: boolean } | undefined;
        const pollStart = Date.now();
        while (Date.now() - pollStart < 3000 && (pendingSocket = (client as any)._pendingDialSocket) === undefined) {
          await Utilities.sleep(10);
        }
        expect(pendingSocket, "the in-flight dial socket must be retained for cancellation").to.not.equal(undefined);

        const disconnectAt = Date.now();
        client.disconnect();

        // The dial dies NOW - not whenever it would have settled on its own.
        expect(pendingSocket!.destroyed, "disconnect must destroy the pending dial socket").to.equal(true);

        // And the canceled connect() settles promptly instead of waiting out
        // the 5s per-attempt timeout plus backoff windows.
        await connectPromise;
        expect(Date.now() - disconnectAt, "canceled connect() must settle promptly").to.be.lessThan(3000);
        expect(rejectionMessage, "connect() must settle as canceled").to.include("canceled");
        expect(client.state).to.equal(DebugConnectionState.Disconnected);
      });

      it("disconnect during the retry backoff interrupts the sleep instead of waiting it out", async function () {
        // Regression: the backoff sleep was a plain setTimeout promise, so a
        // cancellation arriving mid-sleep still waited out the remaining
        // window (up to 16s at the later attempts) before the post-sleep
        // generation check aborted. disconnect() now resolves the pending
        // sleep immediately.
        const client = new MinecraftDebugClient();
        let rejectionMessage = "";

        // Nothing listens on this port: the first dial fails in
        // milliseconds and the loop enters its 1000ms backoff sleep.
        const connectPromise = client.connect("127.0.0.1", 19398).catch((e: any) => {
          rejectionMessage = e?.message ? String(e.message) : String(e);
        });

        await Utilities.sleep(300);

        const disconnectAt = Date.now();
        client.disconnect();
        await connectPromise;

        expect(Date.now() - disconnectAt, "cancellation must interrupt the backoff sleep").to.be.lessThan(500);
        expect(rejectionMessage, "connect() must settle as canceled").to.include("canceled");
        expect(client.state).to.equal(DebugConnectionState.Disconnected);
      });
    });

    describe("Protocol Handshake", function () {
      it("should receive and process ProtocolEvent", async function () {
        const mockServer = new MockMinecraftDebugServer(19203, ProtocolVersion.SupportBreakpointsAsRequest);
        await mockServer.start();

        const client = new MinecraftDebugClient();
        let protocolEventReceived = false;
        let receivedVersion = 0;

        client.onProtocol.subscribe((_, event) => {
          protocolEventReceived = true;
          receivedVersion = event.version;
        });

        await client.connect("localhost", 19203);
        await Utilities.sleep(500);

        expect(protocolEventReceived).to.be.true;
        expect(receivedVersion).to.equal(ProtocolVersion.SupportBreakpointsAsRequest);

        client.disconnect();
        await mockServer.stop();
      });

      it("should timeout if no ProtocolEvent received, destroying the socket so the endpoint frees up", async function () {
        // singleClientMode makes a leak observable: if the timed-out socket
        // were dereferenced without destroy(), the server would still count
        // one attached client and every subsequent attach would be
        // accepted-then-closed - the exact regression this guards against.
        const mockServer = new MockMinecraftDebugServer(19204);
        mockServer.sendProtocolEventOnConnect = false;
        mockServer.singleClientMode = true;
        await mockServer.start();

        const client = new MinecraftDebugClient();
        let disconnectReason = "";

        client.onDisconnected.subscribe((_, reason) => {
          disconnectReason = reason;
        });

        await client.connect("localhost", 19204);
        expect(mockServer.clientCount).to.equal(1);

        // Remain silent through the handshake timeout (10 seconds + buffer)
        await Utilities.sleep(12000);

        expect(client.state).to.not.equal(DebugConnectionState.Connected);
        expect(disconnectReason).to.include("handshake timeout");
        expect(client.lastAttachFailure).to.equal("handshakeFailed");

        // The timed-out socket must be destroyed, not just dropped: the
        // server's view of its client count must return to zero before
        // another attach is attempted.
        const deadline = Date.now() + 2000;
        while (Date.now() < deadline && mockServer.clientCount > 0) {
          await Utilities.sleep(50);
        }
        expect(mockServer.clientCount, "timed-out socket must be closed server-side").to.equal(0);

        // With the endpoint free again, a fresh attach must fully negotiate.
        mockServer.sendProtocolEventOnConnect = true;
        const retryClient = new MinecraftDebugClient();
        await retryClient.connect("localhost", 19204);
        await Utilities.sleep(500);

        expect(retryClient.isConnected, "retry attach must succeed once the leaked socket is gone").to.be.true;

        retryClient.disconnect();
        await mockServer.stop();
      });
    });

    describe("Debug Ownership Classification", function () {
      /**
       * "attachedExternally" must rest on POSITIVE contention evidence - a
       * confirmed listener whose socket accepts and then closes before the
       * ProtocolEvent handshake (Minecraft's single-client busy signature).
       * These tests drive the REAL client against real sockets so the typed
       * failure reasons come from actual transport behavior, then assert how
       * deriveDebugOwnership classifies them.
       */

      it("reports handshakeFailed when the socket is accepted but closed before ProtocolEvent", async function () {
        // Raw TCP endpoint that accepts and immediately closes - the shape of
        // a busy endpoint, but WITHOUT listener confirmation it stays unknown.
        const server = createServer((socket) => socket.destroy());
        await new Promise<void>((resolve) => server.listen(19250, "localhost", () => resolve()));

        const client = new MinecraftDebugClient();
        await client.connect("localhost", 19250);
        await Utilities.sleep(500);

        expect(client.isConnected).to.be.false;
        expect(client.lastAttachFailure).to.equal("handshakeFailed");

        expect(
          deriveDebugOwnership({
            clientConnected: false,
            attachFailure: client.lastAttachFailure,
            listenerConfirmed: false,
            debuggerEnabled: true,
            streamingEnabled: true,
          }),
          "handshake close without listener confirmation is not ownership evidence"
        ).to.equal("unknown");

        await new Promise<void>((resolve) => server.close(() => resolve()));
      });

      it("classifies a genuine single-client conflict as attachedExternally", async function () {
        const mockServer = new MockMinecraftDebugServer(19251, ProtocolVersion.SupportEmptyTabs);
        mockServer.singleClientMode = true;
        await mockServer.start();

        // First debugger (the "VS Code" role) attaches and owns the endpoint.
        const otherDebugger = new MinecraftDebugClient();
        await otherDebugger.connect("localhost", 19251);
        await Utilities.sleep(500);
        expect(otherDebugger.isConnected).to.be.true;

        // MCT's attach attempt: TCP accepted, then closed before handshake.
        const mctClient = new MinecraftDebugClient();
        await mctClient.connect("localhost", 19251);
        await Utilities.sleep(500);

        expect(mctClient.isConnected).to.be.false;
        expect(mctClient.lastAttachFailure).to.equal("handshakeFailed");

        // Confirmed listener + accepted-then-closed socket = positive evidence.
        expect(
          deriveDebugOwnership({
            clientConnected: false,
            attachFailure: mctClient.lastAttachFailure,
            listenerConfirmed: true,
            debuggerEnabled: true,
            streamingEnabled: true,
          })
        ).to.equal("attachedExternally");

        // The attached debugger itself still classifies as attachedByMct.
        expect(
          deriveDebugOwnership({
            clientConnected: otherDebugger.isConnected,
            attachFailure: undefined,
            listenerConfirmed: true,
            debuggerEnabled: true,
            streamingEnabled: true,
          })
        ).to.equal("attachedByMct");

        otherDebugger.disconnect();
        mctClient.disconnect();
        await mockServer.stop();
      });

      it("recovers the endpoint via reattach after the other debugger releases it", async function () {
        // Regression for the "Check again" action: fail the first attach
        // (endpoint owned by another debugger), release the endpoint, invoke
        // the server-side reattach, and prove the second attach negotiates.
        const env: ITestEnvironment = await TestPaths.createTestEnvironment();

        const mockServer = new MockMinecraftDebugServer(19260, ProtocolVersion.SupportEmptyTabs);
        mockServer.singleClientMode = true;
        await mockServer.start();

        const dsm = new ServerManager(env.localEnv, env.creatorTools);
        const server = new DedicatedServer("reattach-test", dsm, env.localEnv, "reattach-test-path", env.resultsFolder);
        server.port = 19260 - 12; // debugPort = base port + 12 = 19260

        // Another debugger (the "VS Code" role) owns the endpoint.
        const otherDebugger = new MinecraftDebugClient();
        await otherDebugger.connect("localhost", 19260);
        await Utilities.sleep(500);
        expect(otherDebugger.isConnected).to.be.true;

        // First attach: TCP accepted then closed before the handshake — the
        // failure must latch with its typed reason and leave no live client.
        await server.connectDebugClient();
        await Utilities.sleep(500);
        expect(server.debugClient?.isConnected ?? false).to.be.false;
        expect(server.debugAttachFailure).to.equal("handshakeFailed");

        // The user stops the other debugger, releasing the endpoint...
        otherDebugger.disconnect();
        await Utilities.sleep(300);

        // ...and clicks "Check again": reattach must clear the latch, discard
        // the stale client, and complete a real protocol negotiation.
        const result = await server.reattachDebugClient();

        expect(result.connected, "reattach must connect after the endpoint is released").to.be.true;
        expect(result.ownership).to.equal("attachedByMct");
        expect(server.debugClient?.isConnected).to.be.true;
        expect(server.debugClient?.sessionInfo.protocolVersion).to.equal(ProtocolVersion.SupportEmptyTabs);
        expect(server.debugAttachFailure).to.be.undefined;
        expect(server.debugOwnership).to.equal("attachedByMct");

        // Reattach while already attached must keep the session, not drop it.
        const again = await server.reattachDebugClient();
        expect(again.connected).to.be.true;
        expect(server.debugClient?.isConnected).to.be.true;

        server.disconnectDebugClient();
        await mockServer.stop();
      });

      it("shares one in-flight reattach across concurrent callers and honors the full handshake window", async function () {
        // The client allows 10 seconds for the ProtocolEvent; a 6.5-second
        // negotiation is slow but VALID and must be reported as connected
        // (a shorter internal deadline would misreport it as disconnected).
        const env: ITestEnvironment = await TestPaths.createTestEnvironment();

        const mockServer = new MockMinecraftDebugServer(19261, ProtocolVersion.SupportEmptyTabs);
        mockServer.protocolEventDelayMs = 6500;
        await mockServer.start();

        const dsm = new ServerManager(env.localEnv, env.creatorTools);
        const server = new DedicatedServer(
          "slow-handshake-test",
          dsm,
          env.localEnv,
          "slow-handshake-path",
          env.resultsFolder
        );
        server.port = 19261 - 12; // debugPort = base port + 12 = 19261

        // Concurrent callers (e.g., a double-clicked retry, or two panels)
        // must share the single in-flight attempt and both receive its
        // settled outcome - not a premature state snapshot.
        const [first, second] = await Promise.all([server.reattachDebugClient(), server.reattachDebugClient()]);

        expect(first.connected, "slow-but-valid handshake must be reported as connected").to.be.true;
        expect(second.connected, "concurrent caller must receive the shared settled outcome").to.be.true;
        expect(first.ownership).to.equal("attachedByMct");
        expect(second.ownership).to.equal("attachedByMct");
        expect(mockServer.totalConnectionCount, "concurrent reattach must not open a second connection").to.equal(1);

        server.disconnectDebugClient();
        await mockServer.stop();
      });

      it("recovers from an initial connectFailed state via reattach once the listener appears", async function () {
        // Regression for the neutral "Retry connection" action: a transport-
        // level failure (nothing listening yet) latches as retryable
        // "unknown", and the same server-side reattach must recover it.
        const env: ITestEnvironment = await TestPaths.createTestEnvironment();

        const dsm = new ServerManager(env.localEnv, env.creatorTools);
        const server = new DedicatedServer(
          "connectfailed-test",
          dsm,
          env.localEnv,
          "connectfailed-path",
          env.resultsFolder
        );
        server.port = 19262 - 12; // debugPort = base port + 12 = 19262

        // A mounted panel learns about attach failures only through
        // onDebugDisconnected - the client itself never dispatches it for a
        // TCP-level failure (it errors before ever reaching Connecting from
        // the subscriber's perspective), so the server must broadcast the
        // terminal state or panels stay on "Connecting..." forever.
        let disconnectedReason: string | undefined;
        server.onDebugDisconnected.subscribe((_server, reason) => {
          disconnectedReason = reason;
        });

        // Nothing listening: the initial attach exhausts its retries.
        await server.connectDebugClient();

        expect(server.debugClient).to.be.undefined;
        expect(server.debugAttachFailure).to.equal("connectFailed");
        expect(server.debugOwnership).to.equal("unknown");
        expect(disconnectedReason, "initial TCP attach failure must notify mounted panels").to.not.be.undefined;

        // The listener comes up (e.g., BDS finished starting)...
        const mockServer = new MockMinecraftDebugServer(19262, ProtocolVersion.SupportEmptyTabs);
        await mockServer.start();

        // ...and retrying must clear the latch and negotiate a session.
        const result = await server.reattachDebugClient();

        expect(result.connected, "reattach must recover from an initial connectFailed state").to.be.true;
        expect(result.ownership).to.equal("attachedByMct");
        expect(server.debugAttachFailure).to.be.undefined;

        server.disconnectDebugClient();
        await mockServer.stop();
      });

      it("cancels an in-flight automatic attach superseded by reattach so it cannot affect the replacement", async function () {
        // Regression for the reattach-vs-dialing race: an automatic attach
        // (client A) is mid-dial when a reattach discards it and creates
        // client B. A's dial must be CANCELLED - if it survives, A connects
        // first, consumes Minecraft's single-client endpoint (singleClientMode
        // below), its orphaned callbacks mutate/clear the shared client state,
        // and B falsely reports an external-owner/handshake failure.
        const env: ITestEnvironment = await TestPaths.createTestEnvironment();

        const mockServer = new MockMinecraftDebugServer(19263, ProtocolVersion.SupportEmptyTabs);
        mockServer.singleClientMode = true;
        // Deliberately NOT started yet: client A's first attempt is refused,
        // parking it in its 1s retry backoff - a paused, resumable dial.

        const dsm = new ServerManager(env.localEnv, env.creatorTools);
        const server = new DedicatedServer(
          "reattach-race-test",
          dsm,
          env.localEnv,
          "reattach-race-path",
          env.resultsFolder
        );
        server.port = 19263 - 12; // debugPort = base port + 12 = 19263

        try {
          // Client A: automatic attach, still dialing (first attempt refused).
          const attachA = server.connectDebugClient();
          await Utilities.sleep(200);

          // Reattach discards A mid-dial and starts client B.
          const reattachPromise = server.reattachDebugClient();
          await Utilities.sleep(100);

          // The endpoint comes up while both dials would still be pending. A's
          // next retry fires BEFORE B's - if A wasn't cancelled, A wins the
          // endpoint and B gets the accept-then-close busy signature.
          await mockServer.start();

          const result = await reattachPromise;
          await attachA;

          expect(result.connected, "reattach's client must win the endpoint, not the discarded dial").to.be.true;
          expect(result.ownership).to.equal("attachedByMct");
          expect(server.debugClient?.isConnected).to.be.true;
          expect(server.debugAttachFailure).to.be.undefined;
          expect(
            mockServer.totalConnectionCount,
            "the discarded client's dial must never reach the endpoint"
          ).to.equal(1);

          // Let any orphaned completion window elapse: A must not clear or
          // mutate the state that now belongs to B.
          await Utilities.sleep(500);
          expect(server.debugClient?.isConnected, "discarded client must not clear the replacement").to.be.true;
          expect(server.debugAttachFailure).to.be.undefined;
          expect(server.debugOwnership).to.equal("attachedByMct");
        } finally {
          // Without this, a failing assertion leaves the mock listening and
          // the mocha process alive - later runs then die on EADDRINUSE.
          server.disconnectDebugClient();
          await mockServer.stop();
        }
      });

      it("reports unattached only when no attempt has failed and streaming is enabled", function () {
        expect(
          deriveDebugOwnership({
            clientConnected: false,
            attachFailure: undefined,
            listenerConfirmed: false,
            debuggerEnabled: true,
            streamingEnabled: true,
          })
        ).to.equal("unattached");

        expect(
          deriveDebugOwnership({
            clientConnected: false,
            attachFailure: undefined,
            listenerConfirmed: false,
            debuggerEnabled: false,
            streamingEnabled: false,
          })
        ).to.equal("unknown");
      });

      it("a typed passcode rejection does not classify as external ownership", async function () {
        this.timeout(20000);

        // Regression: the passcode rejection lands as a pre-handshake
        // disconnect, so the client records the generic accept-then-close
        // signature (handshakeFailed). Copied into the server's
        // attach-failure latch while the listener is CONFIRMED,
        // deriveDebugOwnership read that as "another debugger owns the
        // endpoint" - the panel then paired the real passcode failure with
        // the wrong stop-the-other-debugger instruction. A typed rejection
        // (passcode, protocol mismatch, settings) must clear the latch:
        // Minecraft explained the refusal, it is not contention evidence.
        const env: ITestEnvironment = await TestPaths.createTestEnvironment();
        const dsm = new ServerManager(env.localEnv, env.creatorTools);
        const server = new DedicatedServer(
          "passcode-own-test",
          dsm,
          env.localEnv,
          "passcode-own-path",
          env.resultsFolder
        );
        server.port = 19298 - 12; // preferred debug port = 19298
        server.debuggerEnabled = true;
        server.debuggerStreamingEnabled = true;
        server.debugOutboundConnect = false; // inbound listen flow

        const commands: string[] = [];
        (server as any).runCommand = async (command: string) => {
          commands.push(command);
        };

        const stdout = new PassThrough();
        const outputDone = server.directOutput(stdout);
        let bds: MockMinecraftDebugServer | undefined;

        try {
          stdout.write("Server started.\n");

          // The listen command is issued on a 3-second delay after start.
          await Utilities.sleep(4000);
          expect(commands).to.include("script debugger listen 19298");

          // BDS confirms the listener, then MCT dials. The mock demands a
          // passcode the client does not have; the first dial may race the
          // mock's startup and be retried by the client's backoff loop.
          stdout.write("Debugger listening on port 19298\n");
          await Utilities.sleep(150);

          bds = new MockMinecraftDebugServer(19298, ProtocolVersion.SupportEmptyTabs);
          bds.requirePasscode = true;
          await bds.start();

          const deadline = Date.now() + 8000;
          while (Date.now() < deadline && server.debuggerLifecycle.stage !== DebuggerLifecycleStage.failed) {
            await Utilities.sleep(100);
          }

          expect(server.debuggerLifecycle.stage, "the passcode rejection must fail the lifecycle").to.equal(
            DebuggerLifecycleStage.failed
          );
          expect(server.debuggerLifecycle.failureKind).to.equal(DebuggerFailureKind.passcode);
          expect(server.debugAttachFailure, "a typed rejection must clear the attach-failure latch").to.be.undefined;
          expect(server.debugOwnership, "a typed rejection must not read as external ownership").to.not.equal(
            "attachedExternally"
          );
          expect(server.getDebugSlotConfig().debugOwnership).to.not.equal("attachedExternally");
        } finally {
          server.cancelDebuggerWork("passcode-own test cleanup");
          server.stopPlayerPositionPolling();
          DebugPortRegistry.releaseAllForOwner("passcode-own-path");
          stdout.end();
          await outputDone;
          if (bds) {
            await bds.stop();
          }
        }
      });
    });

    describe("Late-Mount Hydration", function () {
      /**
       * The diagnostics panel is only mounted while its tab is open, so the
       * one-shot debugConnected / debugSchema events may fire long before it
       * subscribes. Both hydration surfaces — web /status and the Electron
       * debug-status IPC — serve DedicatedServer.getDebugSlotConfig(); this
       * proves that snapshot carries the full session AND schema when the
       * connection and SchemaEvent negotiation happened with no subscriber.
       */
      it("provides full session and schema for panels that mount after negotiation", async function () {
        const env: ITestEnvironment = await TestPaths.createTestEnvironment();

        const mockServer = new MockMinecraftDebugServer(19270, ProtocolVersion.SupportEmptyTabs);
        await mockServer.start();

        const dsm = new ServerManager(env.localEnv, env.creatorTools);
        const server = new DedicatedServer("late-mount-test", dsm, env.localEnv, "late-mount-path", env.resultsFolder);
        server.port = 19270 - 12; // debugPort = base port + 12 = 19270

        // Connection AND schema negotiation happen while nothing is mounted
        // or subscribed — the live events fire into the void, exactly as when
        // the Stats tab is closed.
        await server.connectDebugClient();
        await Utilities.sleep(500);

        const descriptors: IDiagnosticsTabDescriptor[] = [
          {
            name: "server_tick",
            title: "Server Tick",
            stat_group_id: "server_tick_timings",
            data_source: "server",
            display_type: "line_chart",
          } as IDiagnosticsTabDescriptor,
        ];
        mockServer.sendSchemaEvent(descriptors);
        await Utilities.sleep(500);

        // A panel mounting NOW must be able to hydrate everything from the
        // snapshot: connection, capabilities, module, endpoint, ownership,
        // and the already-negotiated schema.
        const slotConfig = server.getDebugSlotConfig();

        expect(slotConfig.debugConnectionState).to.equal("connected");
        expect(slotConfig.debugProtocolVersion).to.equal(ProtocolVersion.SupportEmptyTabs);
        expect(slotConfig.debugCapabilities?.supportsEmptyTabs).to.be.true;
        expect(slotConfig.debugTargetModuleUuid).to.equal("test-module-uuid");
        expect(slotConfig.debugPlugins?.length).to.equal(1);
        expect(slotConfig.debugHost).to.equal("localhost");
        expect(slotConfig.debugPort).to.equal(19270);
        expect(slotConfig.debugOwnership).to.equal("attachedByMct");
        expect(slotConfig.debugSchema).to.deep.equal(descriptors);
        expect(slotConfig.debuggerEnabled).to.be.true;
        expect(slotConfig.debuggerStreamingEnabled).to.be.true;

        // After disconnect the snapshot must not leak the stale session or
        // schema into the next mount.
        server.disconnectDebugClient();
        const after = server.getDebugSlotConfig();
        expect(after.debugConnectionState).to.not.equal("connected");
        expect(after.debugSchema).to.be.undefined;

        await mockServer.stop();
      });
    });

    describe("Late-Mount Hydration Staleness", function () {
      /**
       * The hydration snapshot (REST /status in web mode, debug-status IPC in
       * Electron mode) is asynchronous: a live disconnect/schema/reconnect
       * event or a transport swap can land while the request is pending, and
       * the older response must then be DISCARDED - applying it would restore
       * stale connection, ownership, capabilities, or schema over newer live
       * state. These deferred regressions resolve the snapshot AFTER such an
       * event and verify it is ignored. They exercise the exact gate + apply
       * path DebugStatsPanel uses (DebugPanelHydration.ts): the panel's live
       * handlers call noteSessionEvent(), its mount/update lifecycle calls
       * setSource(), and both hydrators run through applyHydrationSnapshot.
       */

      function deferredSnapshot<T>(): { promise: Promise<T | undefined>; resolve: (value: T | undefined) => void } {
        let resolve!: (value: T | undefined) => void;
        const promise = new Promise<T | undefined>((r) => (resolve = r));
        return { promise: promise, resolve: resolve };
      }

      it("discards a snapshot that resolves after a newer live session event", async function () {
        // Same staleness rule for each of the live events the panel notes:
        // reconnect (debugConnected), disconnect (debugDisconnected), and
        // schema (debugSchema).
        for (const liveEvent of ["debugConnected", "debugDisconnected", "debugSchema"]) {
          const gate = new HydrationGate();
          gate.setSource("server-a");

          const snapshot = deferredSnapshot<{ debugConnectionState: string }>();
          let applied: { debugConnectionState: string } | undefined;

          const outcomePromise = applyHydrationSnapshot(
            gate,
            () => snapshot.promise,
            (value) => (applied = value)
          );

          // The live event arrives while the hydration request is pending...
          gate.noteSessionEvent();

          // ...and the older snapshot resolves afterwards.
          snapshot.resolve({ debugConnectionState: "connected" });

          expect(await outcomePromise, `snapshot must be superseded by ${liveEvent}`).to.equal("discarded");
          expect(applied, `stale snapshot must not be applied after ${liveEvent}`).to.be.undefined;
        }
      });

      it("discards a snapshot from a swapped-out minecraft instance and applies the new instance's", async function () {
        const gate = new HydrationGate();
        const minecraftA = { id: "instance-a" };
        const minecraftB = { id: "instance-b" };

        // Mount against instance A; its hydration request goes out.
        gate.setSource(minecraftA);
        const staleSnapshot = deferredSnapshot<string>();
        let staleApplied = false;
        const stalePromise = applyHydrationSnapshot(
          gate,
          () => staleSnapshot.promise,
          () => (staleApplied = true)
        );

        // The panel is repointed at instance B while A's request is still
        // pending (componentDidUpdate re-sources the gate before
        // re-hydrating), and B's hydration goes out.
        gate.setSource(minecraftB);
        const freshSnapshot = deferredSnapshot<string>();
        let freshApplied: string | undefined;
        const freshPromise = applyHydrationSnapshot(
          gate,
          () => freshSnapshot.promise,
          (value) => (freshApplied = value)
        );

        // Both responses arrive late, the stale one first.
        staleSnapshot.resolve("slot-config-from-instance-a");
        freshSnapshot.resolve("slot-config-from-instance-b");

        expect(await stalePromise, "old instance's snapshot must be discarded").to.equal("discarded");
        expect(await freshPromise, "active instance's snapshot must be applied").to.equal("applied");
        expect(staleApplied).to.be.false;
        expect(freshApplied).to.equal("slot-config-from-instance-b");
      });

      it("applies a snapshot when nothing supersedes it, and tolerates empty/failed fetches", async function () {
        const gate = new HydrationGate();
        const source = { id: "steady-source" };
        gate.setSource(source);
        // Re-setting the SAME source must not supersede (componentDidUpdate
        // runs on every render; only a real swap counts).
        gate.setSource(source);

        let applied: string | undefined;
        const outcome = await applyHydrationSnapshot(
          gate,
          async () => "slot-config",
          (value) => (applied = value)
        );

        expect(outcome).to.equal("applied");
        expect(applied).to.equal("slot-config");

        // A snapshot that resolves to nothing (e.g., non-OK response) and a
        // fetch that throws are reported distinctly and apply nothing.
        expect(
          await applyHydrationSnapshot(
            gate,
            async () => undefined,
            () => assert.fail("must not apply an empty snapshot")
          )
        ).to.equal("empty");

        expect(
          await applyHydrationSnapshot(
            gate,
            async () => {
              throw new Error("network down");
            },
            () => assert.fail("must not apply after a failed fetch")
          )
        ).to.equal("failed");
      });

      it("discards an older overlapping request after the newer one applied (newest-first resolution)", async function () {
        // The panel legitimately starts two same-source hydrations (one from
        // mount, one from the subscribe path). If the NEWER response applies
        // first and the older request resolves later, the older snapshot must
        // be discarded - not overwrite the fresher connection/schema/
        // ownership state it would otherwise regress.
        const gate = new HydrationGate();
        gate.setSource("server-a");

        const older = deferredSnapshot<string>();
        const olderPromise = applyHydrationSnapshot(
          gate,
          () => older.promise,
          () => assert.fail("older overlapping snapshot must not apply")
        );

        const newer = deferredSnapshot<string>();
        let newerApplied: string | undefined;
        const newerPromise = applyHydrationSnapshot(
          gate,
          () => newer.promise,
          (value) => (newerApplied = value)
        );

        // Newest-first: the newer response lands and applies...
        newer.resolve("fresh-slot-config");
        expect(await newerPromise).to.equal("applied");
        expect(newerApplied).to.equal("fresh-slot-config");

        // ...then the older response finally resolves and must be discarded.
        older.resolve("stale-slot-config");
        expect(await olderPromise).to.equal("discarded");
      });

      it("still applies the older snapshot when the newer overlapping request fails or is empty", async function () {
        // On web mount, _trySubscribe() and componentDidMount() legitimately
        // start two same-source hydrations back to back. Merely BEGINNING the
        // newer request must not invalidate the older: if the newer fetch
        // fails (or returns empty) while the older succeeds, the older usable
        // snapshot is the only one there is - discarding it would leave an
        // idle connected session stranded at "Connecting..." because nothing
        // retries once _hasSubscribed sticks.
        for (const newerOutcome of ["failed", "empty"] as const) {
          const gate = new HydrationGate();
          gate.setSource("server-a");

          const older = deferredSnapshot<string>();
          let olderApplied: string | undefined;
          const olderPromise = applyHydrationSnapshot(
            gate,
            () => older.promise,
            (value) => (olderApplied = value)
          );

          const newer = deferredSnapshot<string>();
          const newerPromise = applyHydrationSnapshot(
            gate,
            async () => {
              const value = await newer.promise;
              if (newerOutcome === "failed") {
                throw new Error("network down");
              }
              return value;
            },
            () => assert.fail("the newer unusable request must not apply")
          );

          // The newer request resolves unusable first...
          newer.resolve(undefined);
          expect(await newerPromise).to.equal(newerOutcome);

          // ...then the older usable response arrives and must still apply.
          older.resolve("only-usable-slot-config");
          expect(await olderPromise, `older snapshot must apply after newer ${newerOutcome}`).to.equal("applied");
          expect(olderApplied).to.equal("only-usable-slot-config");
        }
      });

      it("lets a newer usable snapshot overwrite an already-applied older one", async function () {
        // Oldest-first resolution: the older request applies, then the newer
        // (fresher) response arrives - newest-usable-wins means it applies
        // over the older state rather than being discarded.
        const gate = new HydrationGate();
        gate.setSource("server-a");

        const older = deferredSnapshot<string>();
        const olderPromise = applyHydrationSnapshot(
          gate,
          () => older.promise,
          () => {}
        );

        const newer = deferredSnapshot<string>();
        let newerApplied: string | undefined;
        const newerPromise = applyHydrationSnapshot(
          gate,
          () => newer.promise,
          (value) => (newerApplied = value)
        );

        older.resolve("older-slot-config");
        expect(await olderPromise).to.equal("applied");

        newer.resolve("fresher-slot-config");
        expect(await newerPromise).to.equal("applied");
        expect(newerApplied).to.equal("fresher-slot-config");
      });
    });

    describe("Protocol Version Negotiation", function () {
      /**
       * The client implements v10 (SupportEmptyTabs) and must negotiate
       * min(server, client): every older supported version keeps working
       * with its own capabilities, and a server newer than the client is
       * used at the client's maximum - never beyond it.
       */

      async function negotiate(port: number, serverVersion: number) {
        const mockServer = new MockMinecraftDebugServer(port, serverVersion);
        await mockServer.start();

        const client = new MinecraftDebugClient();
        await client.connect("localhost", port);
        await Utilities.sleep(400);

        const sessionInfo = client.sessionInfo;

        client.disconnect();
        await mockServer.stop();

        return sessionInfo;
      }

      it("negotiates v6, v8, v9, and v10 to the server-reported version", async function () {
        const cases: {
          port: number;
          server: number;
          expectRequests: boolean;
          expectSchema: boolean;
          expectEmptyTabs: boolean;
        }[] = [
          { port: 19212, server: 6, expectRequests: false, expectSchema: false, expectEmptyTabs: false },
          { port: 19213, server: 8, expectRequests: true, expectSchema: false, expectEmptyTabs: false },
          { port: 19214, server: 9, expectRequests: true, expectSchema: true, expectEmptyTabs: false },
          { port: 19215, server: 10, expectRequests: true, expectSchema: true, expectEmptyTabs: true },
        ];

        for (const c of cases) {
          const sessionInfo = await negotiate(c.port, c.server);

          expect(sessionInfo.state, `v${c.server} must connect`).to.equal(DebugConnectionState.Connected);
          expect(sessionInfo.protocolVersion, `v${c.server} negotiates to itself`).to.equal(c.server);
          expect(sessionInfo.capabilities.supportsDebuggerRequests).to.equal(c.expectRequests);
          expect(sessionInfo.capabilities.supportsDiagnosticsSchema).to.equal(c.expectSchema);
          expect(sessionInfo.capabilities.supportsEmptyTabs).to.equal(c.expectEmptyTabs);
        }
      });

      it("keeps supporting an old v1 server with minimal capabilities", async function () {
        const sessionInfo = await negotiate(19216, ProtocolVersion.Initial);

        expect(sessionInfo.state).to.equal(DebugConnectionState.Connected);
        expect(sessionInfo.protocolVersion).to.equal(ProtocolVersion.Initial);
        expect(sessionInfo.capabilities.supportsCommands).to.be.false;
        expect(sessionInfo.capabilities.supportsProfiler).to.be.false;
        expect(sessionInfo.capabilities.supportsDebuggerRequests).to.be.false;
      });

      it("terminates on a fractional protocol version instead of negotiating it", async function () {
        // The version is a discrete integer enum: negotiating min(7.5, 10)
        // would advertise nonexistent v7.5 in the handshake response while
        // capability and serialization branches independently treat it as
        // v7 - the endpoints disagree about the wire shape on a session
        // left "connected" but unusable. Malformed termination, with NO
        // handshake response or resume ever sent, is the correct outcome.
        for (const testCase of [
          { port: 19218, version: 7.5 },
          { port: 19219, version: -0.5 },
        ]) {
          const mockServer = new MockMinecraftDebugServer(testCase.port);
          mockServer.sendProtocolEventOnConnect = false;
          await mockServer.start();

          const client = new MinecraftDebugClient();
          let disconnectReason = "";
          client.onDisconnected.subscribe((_, reason) => {
            disconnectReason = reason;
          });

          await client.connect("localhost", testCase.port);

          (mockServer as any)._sendToClients({
            type: "event",
            event: { type: "ProtocolEvent", version: testCase.version, plugins: [] },
          });
          await Utilities.sleep(300);

          expect(client.state, `version ${testCase.version} must terminate the session`).to.equal(
            DebugConnectionState.Disconnected
          );
          expect(disconnectReason).to.include("Malformed ProtocolEvent");
          expect(
            mockServer.receivedMessages.some((m) => m.type === "protocol" || m.type === "resume"),
            `no handshake response or resume may be sent for version ${testCase.version}`
          ).to.be.false;

          await mockServer.stop();
        }
      });

      it("caps a future server version at the client's v10 maximum", async function () {
        const sessionInfo = await negotiate(19217, 11);

        expect(sessionInfo.state).to.equal(DebugConnectionState.Connected);
        expect(sessionInfo.protocolVersion, "never negotiate beyond the client's maximum").to.equal(
          MaxSupportedProtocolVersion
        );
        expect(sessionInfo.capabilities.supportsEmptyTabs).to.be.true;
      });
    });

    describe("Outbound Message Serialization", function () {
      /**
       * The wire shape of minecraftCommand / startProfiler / stopProfiler
       * changed at v8 (SupportCerealSerialization): v5-v7 servers expect the
       * fields nested (command: {...}, profiler: {...}), v8+ expects them
       * flat at the top level. These assert the EXACT outbound JSON per
       * negotiated version - a shape newer than the negotiated version must
       * never be sent, and older servers keep their original shapes.
       */

      async function captureOutboundMessages(port: number, serverVersion: number) {
        const mockServer = new MockMinecraftDebugServer(port, serverVersion);
        await mockServer.start();

        const client = new MinecraftDebugClient();
        await client.connect("localhost", port);
        await Utilities.sleep(400);

        expect(client.state).to.equal(DebugConnectionState.Connected);

        client.sendCommand("say hello", "overworld");
        client.startProfiler();
        client.stopProfiler("captures/path");

        const command = await mockServer.waitForMessage("minecraftCommand");
        const start = await mockServer.waitForMessage("startProfiler");
        const stop = await mockServer.waitForMessage("stopProfiler");
        const protocolResponse = await mockServer.waitForMessage("protocol");

        client.disconnect();
        await mockServer.stop();

        return { command, start, stop, protocolResponse };
      }

      it("sends legacy nested payloads to pre-Cereal servers (v6 and v7)", async function () {
        for (const [port, serverVersion] of [
          [19220, ProtocolVersion.SupportBreakpointsAsRequest],
          [19221, ProtocolVersion.SupportDebuggerRequests],
        ] as [number, number][]) {
          const { command, start, stop, protocolResponse } = await captureOutboundMessages(port, serverVersion);

          expect(command, `v${serverVersion} command shape`).to.deep.equal({
            type: "minecraftCommand",
            command: {
              command: "say hello",
              dimension_type: "overworld",
            },
          });

          expect(start, `v${serverVersion} startProfiler shape`).to.deep.equal({
            type: "startProfiler",
            profiler: {
              target_module_uuid: "test-module-uuid",
            },
          });

          expect(stop, `v${serverVersion} stopProfiler shape`).to.deep.equal({
            type: "stopProfiler",
            profiler: {
              captures_path: "captures/path",
              target_module_uuid: "test-module-uuid",
            },
          });

          expect(protocolResponse.version, "the handshake response carries the negotiated version").to.equal(
            serverVersion
          );
        }
      });

      it("sends flat Cereal payloads to v8 and v10 servers", async function () {
        for (const [port, serverVersion] of [
          [19222, ProtocolVersion.SupportCerealSerialization],
          [19223, ProtocolVersion.SupportEmptyTabs],
        ] as [number, number][]) {
          const { command, start, stop } = await captureOutboundMessages(port, serverVersion);

          expect(command, `v${serverVersion} command shape`).to.deep.equal({
            type: "minecraftCommand",
            command: "say hello",
            dimension_type: "overworld",
          });

          expect(start, `v${serverVersion} startProfiler shape`).to.deep.equal({
            type: "startProfiler",
            target_module_uuid: "test-module-uuid",
          });

          expect(stop, `v${serverVersion} stopProfiler shape`).to.deep.equal({
            type: "stopProfiler",
            captures_path: "captures/path",
            target_module_uuid: "test-module-uuid",
          });
        }
      });
    });

    describe("Diagnostics Schema (protocol v10)", function () {
      const testDescriptors: IDiagnosticsTabDescriptor[] = [
        {
          name: "server_timing",
          stat_group_id: "server_timing",
          data_source: "server",
          display_type: "line_chart",
          title: "Server Timing",
          y_label: "ms",
          target_value: 50,
        },
        {
          name: "client_frames",
          stat_group_id: "client_frames",
          data_source: "client",
          display_type: "stacked_bar_chart",
          is_empty_tab: true,
        },
      ];

      it("should negotiate protocol v10 and report schema capabilities", async function () {
        const mockServer = new MockMinecraftDebugServer(19220, ProtocolVersion.SupportEmptyTabs);
        await mockServer.start();

        const client = new MinecraftDebugClient();
        await client.connect("localhost", 19220);
        await Utilities.sleep(500);

        const sessionInfo = client.sessionInfo;
        expect(sessionInfo.protocolVersion).to.equal(ProtocolVersion.SupportEmptyTabs);
        expect(sessionInfo.capabilities.supportsDiagnosticsSchema).to.be.true;
        expect(sessionInfo.capabilities.supportsEmptyTabs).to.be.true;
        expect(sessionInfo.capabilities.supportsProfiler).to.be.true;

        client.disconnect();
        await mockServer.stop();
      });

      it("should not report schema capabilities for pre-v9 servers", async function () {
        const mockServer = new MockMinecraftDebugServer(19221, ProtocolVersion.SupportBreakpointsAsRequest);
        await mockServer.start();

        const client = new MinecraftDebugClient();
        await client.connect("localhost", 19221);
        await Utilities.sleep(500);

        const sessionInfo = client.sessionInfo;
        expect(sessionInfo.protocolVersion).to.equal(ProtocolVersion.SupportBreakpointsAsRequest);
        expect(sessionInfo.capabilities.supportsDiagnosticsSchema).to.be.false;
        expect(sessionInfo.capabilities.supportsEmptyTabs).to.be.false;

        client.disconnect();
        await mockServer.stop();
      });

      it("should receive a SchemaEvent and store it with the session", async function () {
        const mockServer = new MockMinecraftDebugServer(19222, ProtocolVersion.SupportEmptyTabs);
        await mockServer.start();

        const client = new MinecraftDebugClient();
        const receivedSchemas: IDiagnosticsTabDescriptor[][] = [];

        client.onSchema.subscribe((_, descriptors) => {
          receivedSchemas.push(descriptors);
        });

        await client.connect("localhost", 19222);
        await Utilities.sleep(500);

        expect(client.schema).to.be.undefined;

        mockServer.sendSchemaEvent(testDescriptors);
        await Utilities.sleep(300);

        expect(receivedSchemas.length).to.equal(1);
        expect(receivedSchemas[0].length).to.equal(2);
        expect(receivedSchemas[0][0].name).to.equal("server_timing");
        expect(receivedSchemas[0][1].is_empty_tab).to.be.true;

        expect(client.schema).to.not.be.undefined;
        expect(client.sessionInfo.schema).to.deep.equal(testDescriptors);

        client.disconnect();
        await mockServer.stop();
      });

      it("should clear the schema on disconnect", async function () {
        const mockServer = new MockMinecraftDebugServer(19223, ProtocolVersion.SupportEmptyTabs);
        await mockServer.start();

        const client = new MinecraftDebugClient();
        await client.connect("localhost", 19223);
        await Utilities.sleep(500);

        mockServer.sendSchemaEvent(testDescriptors);
        await Utilities.sleep(300);

        expect(client.schema).to.not.be.undefined;

        client.disconnect();

        expect(client.schema).to.be.undefined;
        expect(client.sessionInfo.schema).to.be.undefined;

        await mockServer.stop();
      });

      it("should survive a malformed SchemaEvent without crashing or storing it", async function () {
        const mockServer = new MockMinecraftDebugServer(19224, ProtocolVersion.SupportEmptyTabs);
        await mockServer.start();

        const client = new MinecraftDebugClient();
        let schemaDispatches = 0;

        client.onSchema.subscribe(() => {
          schemaDispatches++;
        });

        await client.connect("localhost", 19224);
        await Utilities.sleep(500);

        // descriptors is not an array - must be ignored, not crash
        mockServer.sendSchemaEvent("not-an-array");
        await Utilities.sleep(300);

        expect(client.isConnected).to.be.true;
        expect(client.schema).to.be.undefined;
        expect(schemaDispatches).to.equal(0);

        // Partially-malformed schema still gets stored (valid descriptors render;
        // per-descriptor errors surface in the UI via buildSchemaModel)
        mockServer.sendSchemaEvent([testDescriptors[0], { name: "broken" }]);
        await Utilities.sleep(300);

        expect(client.isConnected).to.be.true;
        expect(client.schema).to.not.be.undefined;
        expect(schemaDispatches).to.equal(1);

        client.disconnect();
        await mockServer.stop();
      });

      it("should renegotiate schema state across reconnects", async function () {
        const mockServer = new MockMinecraftDebugServer(19225, ProtocolVersion.SupportEmptyTabs);
        await mockServer.start();

        const client = new MinecraftDebugClient();
        await client.connect("localhost", 19225);
        await Utilities.sleep(500);

        mockServer.sendSchemaEvent(testDescriptors);
        await Utilities.sleep(300);
        expect(client.schema).to.not.be.undefined;

        client.disconnect();
        expect(client.schema).to.be.undefined;

        // Reconnect: schema stays cleared until the server sends a new one
        await client.connect("localhost", 19225);
        await Utilities.sleep(500);

        expect(client.isConnected).to.be.true;
        expect(client.schema).to.be.undefined;

        mockServer.sendSchemaEvent([testDescriptors[0]]);
        await Utilities.sleep(300);

        expect(client.schema).to.not.be.undefined;
        expect(client.schema?.length).to.equal(1);

        client.disconnect();
        await mockServer.stop();
      });
    });

    describe("Diagnostics Schema (protocol v9/v10)", function () {
      const testDescriptors: IDiagnosticsTabDescriptor[] = [
        {
          name: "server_timing",
          stat_group_id: "server_timing",
          data_source: "server",
          display_type: "line_chart",
          title: "Server Timing",
          y_label: "ms",
          target_value: 50,
        },
        {
          name: "client_frames",
          stat_group_id: "client_frames",
          data_source: "client",
          display_type: "stacked_bar_chart",
          is_empty_tab: true,
        },
      ];

      it("delivers SchemaEvent descriptors, including v10 is_empty_tab, to typed consumers", async function () {
        const mockServer = new MockMinecraftDebugServer(19225, ProtocolVersion.SupportEmptyTabs);
        await mockServer.start();

        const client = new MinecraftDebugClient();
        const receivedSchemas: IDiagnosticsTabDescriptor[][] = [];

        client.onSchema.subscribe((_, descriptors) => {
          receivedSchemas.push(descriptors);
        });

        await client.connect("localhost", 19225);
        await Utilities.sleep(400);

        expect(client.schema).to.be.undefined;

        mockServer.sendSchemaEvent(testDescriptors);
        await Utilities.sleep(300);

        expect(receivedSchemas.length).to.equal(1);
        expect(receivedSchemas[0]).to.deep.equal(testDescriptors);
        expect(receivedSchemas[0][1].is_empty_tab, "v10 is_empty_tab must reach consumers").to.be.true;

        expect(client.schema).to.deep.equal(testDescriptors);
        expect(client.sessionInfo.schema).to.deep.equal(testDescriptors);

        // The schema belongs to the session and clears on disconnect.
        client.disconnect();
        expect(client.schema).to.be.undefined;
        expect(client.sessionInfo.schema).to.be.undefined;

        await mockServer.stop();
      });

      it("surfaces a malformed SchemaEvent as an error without taking down the session", async function () {
        const mockServer = new MockMinecraftDebugServer(19226, ProtocolVersion.SupportEmptyTabs);
        await mockServer.start();

        const client = new MinecraftDebugClient();
        const errors: string[] = [];
        let schemaDispatches = 0;

        client.onError.subscribe((_, error) => {
          errors.push(error.message);
        });
        client.onSchema.subscribe(() => {
          schemaDispatches++;
        });

        await client.connect("localhost", 19226);
        await Utilities.sleep(400);

        // descriptors is not an array - must error actionably, not crash.
        mockServer.sendSchemaEvent("not-an-array");
        await Utilities.sleep(300);

        expect(client.isConnected, "a malformed schema must not take down the session").to.be.true;
        expect(client.schema).to.be.undefined;
        expect(schemaDispatches).to.equal(0);
        expect(errors.some((m) => m.includes("Malformed SchemaEvent"))).to.be.true;

        client.disconnect();
        await mockServer.stop();
      });

      it("rejects invalid descriptors at the typed schema boundary without caching or dispatching", async function () {
        // The guard previously validated only that descriptors was an
        // array: [{}], unknown union values, and wrongly typed optional
        // arrays flowed through typed as IDiagnosticsTabDescriptor[] -
        // consumers (schema-driven renderers selecting components by
        // display_type, iterating optional arrays) were told the contract
        // held, and the invalid schema stayed cached for the session.
        const mockServer = new MockMinecraftDebugServer(19227, ProtocolVersion.SupportEmptyTabs);
        await mockServer.start();

        const client = new MinecraftDebugClient();
        const errors: string[] = [];
        let schemaDispatches = 0;

        client.onError.subscribe((_, error) => {
          errors.push(error.message);
        });
        client.onSchema.subscribe(() => {
          schemaDispatches++;
        });

        await client.connect("localhost", 19227);
        await Utilities.sleep(400);

        const malformedPayloads: { label: string; descriptors: unknown; expectInMessage: string }[] = [
          { label: "empty object descriptor", descriptors: [{}], expectInMessage: "required string field 'name'" },
          {
            label: "unknown display_type union value",
            descriptors: [{ name: "x", stat_group_id: "x", data_source: "server", display_type: "pie_chart" }],
            expectInMessage: "'display_type'",
          },
          {
            label: "unknown data_source union value",
            descriptors: [{ name: "x", stat_group_id: "x", data_source: "cloud", display_type: "table" }],
            expectInMessage: "'data_source'",
          },
          {
            label: "wrongly typed optional array",
            descriptors: [
              {
                name: "x",
                stat_group_id: "x",
                data_source: "server",
                display_type: "table",
                statistic_ids: "not-an-array",
              },
            ],
            expectInMessage: "'statistic_ids'",
          },
        ];

        for (const payload of malformedPayloads) {
          errors.length = 0;

          mockServer.sendSchemaEvent(payload.descriptors);
          await Utilities.sleep(250);

          expect(
            errors.some((m) => m.includes("Malformed SchemaEvent") && m.includes(payload.expectInMessage)),
            `${payload.label} must surface an actionable error naming the violation`
          ).to.be.true;
          expect(schemaDispatches, `${payload.label} must not dispatch a schema`).to.equal(0);
          expect(client.schema, `${payload.label} must not be cached`).to.be.undefined;
          expect(client.isConnected, `${payload.label} must not take down the session`).to.be.true;
        }

        client.disconnect();
        await mockServer.stop();
      });

      it("accepts an empty descriptor array as a valid (empty) schema", async function () {
        const mockServer = new MockMinecraftDebugServer(19228, ProtocolVersion.SupportEmptyTabs);
        await mockServer.start();

        const client = new MinecraftDebugClient();
        const receivedSchemas: IDiagnosticsTabDescriptor[][] = [];

        client.onSchema.subscribe((_, descriptors) => {
          receivedSchemas.push(descriptors);
        });

        await client.connect("localhost", 19228);
        await Utilities.sleep(400);

        mockServer.sendSchemaEvent([]);
        await Utilities.sleep(250);

        expect(receivedSchemas.length, "an empty schema is valid and must dispatch").to.equal(1);
        expect(receivedSchemas[0]).to.deep.equal([]);
        expect(client.schema).to.deep.equal([]);
        expect(client.isConnected).to.be.true;

        client.disconnect();
        await mockServer.stop();
      });
    });

    describe("Correlated Debugger Requests (protocol v7+)", function () {
      async function connectV10(port: number) {
        const mockServer = new MockMinecraftDebugServer(port, ProtocolVersion.SupportEmptyTabs);
        await mockServer.start();

        const client = new MinecraftDebugClient();
        await client.connect("localhost", port);
        await Utilities.sleep(400);

        expect(client.isConnected).to.be.true;

        return { mockServer, client };
      }

      it("sends the exact debugger-request envelope and resolves with the response args", async function () {
        const { mockServer, client } = await connectV10(19230);

        const responsePromise = client.sendRequest("listBreakpoints", { module: "test-module-uuid" });

        const wireRequest = await mockServer.waitForMessage("debugger-request");

        expect(wireRequest).to.deep.equal({
          type: "debugger-request",
          request_seq: wireRequest.request_seq,
          request: "listBreakpoints",
          args: { module: "test-module-uuid" },
        });
        expect(typeof wireRequest.request_seq).to.equal("number");

        mockServer.sendDebuggeeResponse(wireRequest.request_seq as number, {
          args: { breakpoints: [] },
          success: true,
        });

        const result = await responsePromise;
        expect(result).to.deep.equal({ breakpoints: [] });
        expect(client.pendingRequestCount).to.equal(0);

        client.disconnect();
        await mockServer.stop();
      });

      it("sends the nested pre-Cereal envelope on a v7 session and settles on the correlated response", async function () {
        // v7 (SupportDebuggerRequests) predates Cereal serialization: the
        // official request-manager nests the correlated fields under
        // `request` and switches to the flat top-level shape only at v8. A
        // v7 server cannot deserialize the flat shape, so every request
        // would be rejected or time out.
        const mockServer = new MockMinecraftDebugServer(19241, ProtocolVersion.SupportDebuggerRequests);
        await mockServer.start();

        const client = new MinecraftDebugClient();
        await client.connect("localhost", 19241);
        await Utilities.sleep(400);
        expect(client.isConnected).to.be.true;

        const responsePromise = client.sendRequest("listBreakpoints", { module: "test-module-uuid" });

        const wireRequest = await mockServer.waitForMessage("debugger-request");
        const nested = wireRequest.request as { request_seq?: number; request?: string; args?: unknown };

        expect(wireRequest).to.deep.equal({
          type: "debugger-request",
          request: {
            request_seq: nested.request_seq,
            request: "listBreakpoints",
            args: { module: "test-module-uuid" },
          },
        });
        expect(typeof nested.request_seq, "the sequence rides inside the nested request").to.equal("number");
        expect(wireRequest.request_seq, "no flat field may leak into the v7 envelope").to.be.undefined;

        mockServer.sendDebuggeeResponse(nested.request_seq as number, { args: { breakpoints: [] }, success: true });

        const result = await responsePromise;
        expect(result).to.deep.equal({ breakpoints: [] });
        expect(client.pendingRequestCount, "the settled request must clear pending state").to.equal(0);

        client.disconnect();
        await mockServer.stop();
      });

      it("sends the flat Cereal envelope on a v8 session and settles on the correlated response", async function () {
        const mockServer = new MockMinecraftDebugServer(19242, ProtocolVersion.SupportCerealSerialization);
        await mockServer.start();

        const client = new MinecraftDebugClient();
        await client.connect("localhost", 19242);
        await Utilities.sleep(400);
        expect(client.isConnected).to.be.true;

        const responsePromise = client.sendRequest("listBreakpoints", { module: "test-module-uuid" });

        const wireRequest = await mockServer.waitForMessage("debugger-request");

        expect(wireRequest).to.deep.equal({
          type: "debugger-request",
          request_seq: wireRequest.request_seq,
          request: "listBreakpoints",
          args: { module: "test-module-uuid" },
        });
        expect(typeof wireRequest.request_seq).to.equal("number");

        mockServer.sendDebuggeeResponse(wireRequest.request_seq as number, {
          args: { breakpoints: [] },
          success: true,
        });

        const result = await responsePromise;
        expect(result).to.deep.equal({ breakpoints: [] });
        expect(client.pendingRequestCount, "the settled request must clear pending state").to.equal(0);

        client.disconnect();
        await mockServer.stop();
      });

      it("rejects a debuggee-response that omits the success flag", async function () {
        // The official request-manager rejects on !envelope.success and
        // resolves only an explicit true: a malformed response - or a failed
        // one that omits the flag - must never be reported as success (the
        // UI would assume an operation completed when Minecraft rejected it).
        const { mockServer, client } = await connectV10(19231);

        const responsePromise = client.sendRequest("getState");
        const wireRequest = await mockServer.waitForMessage("debugger-request");

        mockServer.sendDebuggeeResponse(wireRequest.request_seq as number, { args: { state: "ok" } });

        try {
          await responsePromise;
          assert.fail("should have rejected");
        } catch (e: any) {
          expect(e).to.be.instanceOf(DebugRequestError);
          expect(e.kind).to.equal("rejected");
          expect(e.message).to.include("did not report success");
        }
        expect(client.pendingRequestCount).to.equal(0);

        client.disconnect();
        await mockServer.stop();
      });

      it("rejects a legacy response envelope that omits the success flag", async function () {
        // The pre-v7 DAP-style "response" envelope correlates through the
        // same manager and follows the same rule: missing success rejects.
        const { mockServer, client } = await connectV10(19244);

        const responsePromise = client.sendRequest("getState");
        const wireRequest = await mockServer.waitForMessage("debugger-request");

        (mockServer as any)._sendToClients({
          type: "response",
          request_seq: wireRequest.request_seq,
          command: "getState",
          body: { state: "ok" },
        });

        try {
          await responsePromise;
          assert.fail("should have rejected");
        } catch (e: any) {
          expect(e).to.be.instanceOf(DebugRequestError);
          expect(e.kind).to.equal("rejected");
        }
        expect(client.pendingRequestCount).to.equal(0);

        client.disconnect();
        await mockServer.stop();
      });

      it("rejects with the Minecraft-reported failure message", async function () {
        const { mockServer, client } = await connectV10(19232);

        const responsePromise = client.sendRequest("setBreakpoint", { line: 10 });
        const wireRequest = await mockServer.waitForMessage("debugger-request");

        mockServer.sendDebuggeeResponse(wireRequest.request_seq as number, {
          success: false,
          responseMessage: "breakpoints not allowed here",
        });

        try {
          await responsePromise;
          assert.fail("should have rejected");
        } catch (e: any) {
          expect(e).to.be.instanceOf(DebugRequestError);
          expect(e.kind).to.equal("rejected");
          expect(e.message).to.include("breakpoints not allowed here");
          expect(e.message).to.include("setBreakpoint");
        }

        client.disconnect();
        await mockServer.stop();
      });

      it("times out with an actionable error when no response arrives", async function () {
        const { mockServer, client } = await connectV10(19233);

        try {
          await client.sendRequest("neverAnswered", undefined, 400);
          assert.fail("should have timed out");
        } catch (e: any) {
          expect(e).to.be.instanceOf(DebugRequestError);
          expect(e.kind).to.equal("timeout");
          expect(e.message).to.include("neverAnswered");
          expect(e.message).to.include("400ms");
        }

        expect(client.pendingRequestCount, "a timed-out request must not leak").to.equal(0);

        client.disconnect();
        await mockServer.stop();
      });

      it("settles the tracked request immediately when the send itself fails", async function () {
        // Regression: tracking preceded wire serialization, so unserializable
        // args threw out of sendRequest BEFORE the promise was returned -
        // the caller got the throw, while the tracked entry and its timer
        // lived on until the timeout and rejected with no handler attached.
        const { mockServer, client } = await connectV10(19237);

        try {
          const circular: any = {};
          circular.self = circular;

          let rejection: any;

          // Must NOT throw synchronously; the failure arrives as a rejected
          // promise the caller can actually handle.
          await client.sendRequest("inertRequest", circular).catch((e) => (rejection = e));

          expect(rejection, "the send failure must surface through the returned promise").to.be.instanceOf(
            DebugRequestError
          );
          expect(rejection.message).to.include("could not be sent");
          expect(client.pendingRequestCount, "the failed request must not leave a tracked entry/timer").to.equal(0);
        } finally {
          client.disconnect();
          await mockServer.stop();
        }
      });

      it("surfaces an unknown request_seq as an invalid-correlation error and stays connected", async function () {
        const { mockServer, client } = await connectV10(19234);

        const errors: string[] = [];
        client.onError.subscribe((_, error) => {
          errors.push(error.message);
        });

        mockServer.sendDebuggeeResponse(9999, { args: { bogus: true } });
        await Utilities.sleep(300);

        expect(errors.some((m) => m.includes("Invalid response correlation") && m.includes("9999"))).to.be.true;
        expect(client.isConnected, "an orphan response must not take down the session").to.be.true;

        client.disconnect();
        await mockServer.stop();
      });

      it("rejects every pending request on disconnect without leaks", async function () {
        const { mockServer, client } = await connectV10(19235);

        const first = client.sendRequest("a").then(
          () => "resolved",
          (e: any) => e
        );
        const second = client.sendRequest("b").then(
          () => "resolved",
          (e: any) => e
        );

        await mockServer.waitForMessage("debugger-request");
        expect(client.pendingRequestCount).to.equal(2);

        client.disconnect();

        const [firstOutcome, secondOutcome] = await Promise.all([first, second]);

        for (const outcome of [firstOutcome, secondOutcome]) {
          expect(outcome).to.be.instanceOf(DebugRequestError);
          expect((outcome as DebugRequestError).kind).to.equal("disconnected");
        }
        expect(client.pendingRequestCount, "disconnect must clear all pending requests").to.equal(0);

        await mockServer.stop();
      });

      it("rejects sendRequest with an actionable error on a pre-v7 session", async function () {
        const mockServer = new MockMinecraftDebugServer(19236, ProtocolVersion.SupportBreakpointsAsRequest);
        await mockServer.start();

        const client = new MinecraftDebugClient();
        await client.connect("localhost", 19236);
        await Utilities.sleep(400);

        try {
          await client.sendRequest("anything");
          assert.fail("should have rejected");
        } catch (e: any) {
          expect(e.message).to.include("v7");
          expect(e.message).to.include("negotiated v6");
        }

        client.disconnect();
        await mockServer.stop();
      });
    });

    describe("Actionable protocol failures", function () {
      it("terminates the session when the ProtocolEvent has no numeric version", async function () {
        const mockServer = new MockMinecraftDebugServer(19238);
        mockServer.sendProtocolEventOnConnect = false;
        await mockServer.start();

        const client = new MinecraftDebugClient();
        const errors: string[] = [];
        let disconnectReason = "";

        client.onError.subscribe((_, error) => {
          errors.push(error.message);
        });
        client.onDisconnected.subscribe((_, reason) => {
          disconnectReason = reason;
        });

        await client.connect("localhost", 19238);

        // A ProtocolEvent missing its required version field.
        (mockServer as any)._sendToClients({ type: "event", event: { type: "ProtocolEvent", plugins: [] } });
        await Utilities.sleep(400);

        expect(client.state, "the session must terminate, not hang").to.equal(DebugConnectionState.Disconnected);
        expect(disconnectReason).to.include("Malformed ProtocolEvent");
        expect(errors.some((m) => m.includes("required integer 'version'"))).to.be.true;

        await mockServer.stop();
      });

      it("terminates the session on an unsupported protocol version", async function () {
        const mockServer = new MockMinecraftDebugServer(19239, 0);
        await mockServer.start();

        const client = new MinecraftDebugClient();
        let disconnectReason = "";

        client.onDisconnected.subscribe((_, reason) => {
          disconnectReason = reason;
        });

        await client.connect("localhost", 19239);
        await Utilities.sleep(400);

        expect(client.state).to.equal(DebugConnectionState.Disconnected);
        expect(disconnectReason).to.include("Unsupported debug protocol version 0");
        expect(disconnectReason, "the error must be actionable").to.include("MCT supports");

        await mockServer.stop();
      });

      it("terminates the session on malformed framing instead of hanging", async function () {
        const mockServer = new MockMinecraftDebugServer(19240);
        mockServer.sendProtocolEventOnConnect = false;
        await mockServer.start();

        const client = new MinecraftDebugClient();
        let disconnectReason = "";

        client.onDisconnected.subscribe((_, reason) => {
          disconnectReason = reason;
        });

        await client.connect("localhost", 19240);

        // Not the debug protocol: no hex length header framing at all.
        mockServer.sendRawBytes(Buffer.from("HTTP/1.1 400 Bad Request\r\n\r\n"));
        await Utilities.sleep(400);

        expect(client.state, "the session must terminate, not hang").to.equal(DebugConnectionState.Disconnected);
        expect(disconnectReason).to.include("Malformed debug protocol input");

        await mockServer.stop();
      });

      it("emits no stats after a malformed frame disconnects the session, even from the same chunk", async function () {
        // Regression: the malformed frame's onError synchronously destroyed
        // the socket, but the parser loop continued and delivered a valid
        // StatEvent2 buffered in the SAME chunk; the stats event reached
        // consumers (DebugStatsPanel flips its connection status back to
        // connected on incoming stats) after the disconnect.
        const mockServer = new MockMinecraftDebugServer(19247);
        await mockServer.start();

        const client = new MinecraftDebugClient();
        const statTicks: number[] = [];
        let disconnected = false;

        client.onStats.subscribe((_, stats) => {
          statTicks.push(stats.tick);
        });
        client.onDisconnected.subscribe(() => {
          disconnected = true;
        });

        await client.connect("localhost", 19247);
        await Utilities.sleep(400);
        expect(client.state, "the handshake must complete before the malformed chunk").to.equal(
          DebugConnectionState.Connected
        );

        const statJson = JSON.stringify({ type: "event", event: { type: "StatEvent2", tick: 4242, stats: [] } });
        const statFrame =
          ("00000000" + (Buffer.from(statJson).byteLength + 1).toString(16)).slice(-8) + "\n" + statJson + "\n";
        const badBody = "this is not json\n";
        const badFrame = ("00000000" + badBody.length.toString(16)).slice(-8) + "\n" + badBody;

        mockServer.sendRawBytes(Buffer.from(badFrame + statFrame));
        await Utilities.sleep(400);

        expect(disconnected, "the malformed frame must terminate the session").to.be.true;
        expect(statTicks, "no stats may be emitted after the disconnect").to.not.include(4242);

        await mockServer.stop();
      });

      it("a throwing onError subscriber cannot bypass the framing-error disconnect", async function () {
        // Regression: the public onError dispatch used to run BEFORE the
        // disconnect cleanup, and ste-events propagates subscriber
        // exceptions - a throwing onError consumer aborted the parser
        // callback ahead of the socket teardown, escaping the socket data
        // handler as an uncaught exception with the session left alive.
        const mockServer = new MockMinecraftDebugServer(19246);
        mockServer.sendProtocolEventOnConnect = false;
        await mockServer.start();

        const client = new MinecraftDebugClient();
        let disconnectReason = "";

        client.onError.subscribe(() => {
          throw new Error("onError consumer bug");
        });
        client.onDisconnected.subscribe((_, reason) => {
          disconnectReason = reason;
        });

        await client.connect("localhost", 19246);

        mockServer.sendRawBytes(Buffer.from("HTTP/1.1 400 Bad Request\r\n\r\n"));
        await Utilities.sleep(400);

        expect(client.state, "cleanup must run despite the throwing subscriber").to.equal(
          DebugConnectionState.Disconnected
        );
        expect(disconnectReason, "the original framing reason must be preserved").to.include(
          "Malformed debug protocol input"
        );
        expect(client.sessionInfo.errorMessage).to.include("Malformed debug protocol input");

        await mockServer.stop();
      });

      it("a throwing onError subscriber cannot leave a malformed-ProtocolEvent session in Connecting", async function () {
        // Regression: for a malformed ProtocolEvent the public dispatch ran
        // before disconnectWithError; a throwing consumer's exception was
        // swallowed by the parser's message-dispatch catch, leaving the
        // client in Connecting until the unrelated handshake timeout.
        const mockServer = new MockMinecraftDebugServer(19245);
        mockServer.sendProtocolEventOnConnect = false;
        mockServer.singleClientMode = true;
        await mockServer.start();

        const client = new MinecraftDebugClient();
        let disconnectReason = "";

        client.onError.subscribe(() => {
          throw new Error("onError consumer bug");
        });
        client.onDisconnected.subscribe((_, reason) => {
          disconnectReason = reason;
        });

        await client.connect("localhost", 19245);

        (mockServer as any)._sendToClients({ type: "event", event: { type: "ProtocolEvent", plugins: [] } });
        await Utilities.sleep(400);

        expect(client.state, "the session must reach Disconnected immediately, not hang in Connecting").to.equal(
          DebugConnectionState.Disconnected
        );
        expect(disconnectReason).to.include("Malformed ProtocolEvent");
        expect((client as any)._handshakeTimeoutId, "the handshake timeout must be cleared by the disconnect").to.be
          .undefined;
        expect(client.pendingRequestCount, "no pending request may leak past the disconnect").to.equal(0);

        await mockServer.stop();
      });

      it("survives a throwing event subscriber and keeps parsing subsequent frames", async function () {
        // A consumer exception over one VALID event is NOT malformed peer
        // input: ste-events dispatches subscribers synchronously without
        // catching, and the parser previously caught that throw in the same
        // try as JSON.parse, dispatched onError, and tore down the healthy
        // session (rejecting every pending request).
        const mockServer = new MockMinecraftDebugServer(19243, ProtocolVersion.SupportEmptyTabs);
        await mockServer.start();

        const client = new MinecraftDebugClient();
        await client.connect("localhost", 19243);
        await Utilities.sleep(400);
        expect(client.isConnected).to.be.true;

        const receivedTicks: number[] = [];
        let shouldThrow = true;

        client.onStats.subscribe((_, data) => {
          receivedTicks.push(data.tick);
          if (shouldThrow) {
            shouldThrow = false;
            throw new Error("downstream consumer bug");
          }
        });

        const mockStats: IStatData[] = [
          {
            name: "EntityCount",
            parent_name: "",
            id: "entity_count",
            full_id: "entity_count",
            parent_id: "",
            parent_full_id: "",
            values: [42],
            children_string_values: [],
            should_aggregate: false,
            tick: 1,
          },
        ];

        // The subscriber throws while handling this valid frame...
        mockServer.sendStatEvent(1, mockStats);
        await Utilities.sleep(300);

        expect(client.isConnected, "a subscriber exception must not tear down the session").to.be.true;

        // ...and the stream stays parseable: a later valid frame still
        // delivers to the (now well-behaved) subscriber.
        mockServer.sendStatEvent(2, mockStats);
        await Utilities.sleep(300);

        expect(receivedTicks).to.deep.equal([1, 2]);
        expect(client.isConnected).to.be.true;

        client.disconnect();
        await mockServer.stop();
      });
    });

    describe("Statistics Streaming", function () {
      it("should receive and dispatch StatEvent2", async function () {
        const mockServer = new MockMinecraftDebugServer(19205);
        await mockServer.start();

        const client = new MinecraftDebugClient();
        const receivedStats: { tick: number; stats: IStatData[] }[] = [];

        client.onStats.subscribe((_, data) => {
          receivedStats.push(data);
        });

        await client.connect("localhost", 19205);
        await Utilities.sleep(500);

        // Send some mock stats with proper IStatData structure
        const mockStats: IStatData[] = [
          {
            name: "EntityCount",
            parent_name: "",
            id: "entity_count",
            full_id: "entity_count",
            parent_id: "",
            parent_full_id: "",
            values: [42],
            children_string_values: [],
            should_aggregate: false,
            tick: 1,
          },
          {
            name: "ChunkCount",
            parent_name: "",
            id: "chunk_count",
            full_id: "chunk_count",
            parent_id: "",
            parent_full_id: "",
            values: [100],
            children_string_values: [],
            should_aggregate: false,
            tick: 1,
          },
        ];

        mockServer.sendStatEvent(1, mockStats);
        mockServer.sendStatEvent(2, mockStats);
        mockServer.sendStatEvent(3, mockStats);

        await Utilities.sleep(500);

        expect(receivedStats.length).to.be.greaterThan(0);
        const lastStats = receivedStats[receivedStats.length - 1];
        expect(lastStats.tick).to.be.greaterThan(0);

        client.disconnect();
        await mockServer.stop();
      });

      it("should update sessionInfo with last stat tick", async function () {
        const mockServer = new MockMinecraftDebugServer(19206);
        await mockServer.start();

        const client = new MinecraftDebugClient();
        await client.connect("localhost", 19206);
        await Utilities.sleep(500);

        // Initial state - no stats yet
        expect(client.sessionInfo.lastStatTick).to.equal(0);

        // Send stats
        mockServer.sendStatEvent(42, []);
        await Utilities.sleep(200);

        expect(client.sessionInfo.lastStatTick).to.equal(42);

        client.disconnect();
        await mockServer.stop();
      });
    });

    describe("Disconnect Handling", function () {
      it("should handle server disconnect gracefully", async function () {
        const mockServer = new MockMinecraftDebugServer(19207);
        await mockServer.start();

        const client = new MinecraftDebugClient();
        let disconnected = false;

        client.onDisconnected.subscribe(() => {
          disconnected = true;
        });

        await client.connect("localhost", 19207);
        await Utilities.sleep(500);

        expect(client.isConnected).to.be.true;

        // Stop the server to simulate disconnect
        await mockServer.stop();
        await Utilities.sleep(500);

        expect(disconnected).to.be.true;
        expect(client.state).to.equal(DebugConnectionState.Disconnected);
      });

      it("should update sessionInfo.errorMessage on disconnect", async function () {
        const mockServer = new MockMinecraftDebugServer(19208);
        await mockServer.start();

        const client = new MinecraftDebugClient();
        await client.connect("localhost", 19208);
        await Utilities.sleep(500);

        // Stop the server to trigger error
        await mockServer.stop();
        await Utilities.sleep(500);

        const sessionInfo = client.sessionInfo;
        expect(sessionInfo.errorMessage).to.not.be.undefined;
      });

      it("should allow reconnection after disconnect", async function () {
        const mockServer = new MockMinecraftDebugServer(19209);
        await mockServer.start();

        const client = new MinecraftDebugClient();
        await client.connect("localhost", 19209);
        await Utilities.sleep(500);

        client.disconnect();
        expect(client.state).to.equal(DebugConnectionState.Disconnected);

        // Reconnect
        await client.connect("localhost", 19209);
        await Utilities.sleep(500);

        expect(client.isConnected).to.be.true;

        client.disconnect();
        await mockServer.stop();
      });
    });
  });

  describe("Storage-aware server requests", function () {
    /**
     * The debug panel's REST calls (status/pause/profiler/reattach) go through
     * HttpStorage.fetchApi so they target the managed server the storage
     * represents (its baseUrl origin - which in remote sessions differs from
     * the page origin) and carry the auth token the updateState permission
     * check requires.
     */

    it("targets the storage baseUrl origin and forwards the auth token", async function () {
      const received: { url?: string; method?: string; auth?: string } = {};

      const httpServer = createHttpTestServer((req, res) => {
        received.url = req.url;
        received.method = req.method;
        received.auth = req.headers["authorization"];
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));
      });
      await new Promise<void>((resolve) => httpServer.listen(19280, "localhost", () => resolve()));

      // Remote-style absolute base URL. There is no window/page origin in
      // this environment, so the request only succeeds if the URL is derived
      // from the storage's baseUrl - the managed server - not the page.
      const storage = new HttpStorage("http://localhost:19280/api/worldContent/0/");
      storage.authToken = "test-token-123";

      const response = await storage.fetchApi("/api/0/debug/reattach", { method: "POST" });

      expect(response.ok).to.be.true;
      expect(received.url).to.equal("/api/0/debug/reattach");
      expect(received.method).to.equal("POST");
      expect(received.auth, "auth token must be forwarded for permission-checked endpoints").to.equal(
        "Bearer mctauth=test-token-123"
      );

      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    });

    it("resolves API paths against the baseUrl origin, not the path", function () {
      const storage = new HttpStorage("https://remote.example.com:6126/api/worldContent/0/");

      expect(storage.resolveServerUrl("/api/0/status?slotConfig=true")).to.equal(
        "https://remote.example.com:6126/api/0/status?slotConfig=true"
      );
    });
  });

  describe("Web panel debugStage plumbing", function () {
    /**
     * ServerManager broadcasts debugger lifecycle transitions as "debugStage"
     * WebSocket notifications, and HttpServer drops any notification a client
     * has not subscribed to. This regression drives a real lifecycle failure
     * through DedicatedServer -> ServerManager -> HttpServer's subscription
     * filter, with the subscriber using the EXACT subscription list the web
     * panel sends (DEBUG_PANEL_SUBSCRIPTION_EVENTS), and asserts a failed
     * stage and the dynamically reserved debug port reach that subscriber -
     * i.e., the lifecycle feature works over WebSocket, not just Electron IPC.
     */

    it("delivers failed stage and reserved debug port to a web-panel subscriber", async function () {
      const env: ITestEnvironment = await TestPaths.createTestEnvironment();
      const dsm = new ServerManager(env.localEnv, env.creatorTools);
      const httpServer = dsm.ensureHttpServer(6297);

      const server = new DedicatedServer("debugstage-test", dsm, env.localEnv, "debugstage-path", env.resultsFolder);
      server.debugOutboundConnect = false; // these tests exercise the legacy inbound listen flow
      server.port = 19795 - 12; // preferred debug port = base port + 12 = 19795

      // Wire the stage event the way ServerManager wires managed servers.
      server.onDebugStageChanged.subscribe((dsm as any).bubbleDebugStageChanged);

      // A "web panel" client, registered through HttpServer's real connection
      // and subscription handling, subscribing with the panel's exact list.
      const received: { body?: { eventName?: string; [key: string]: unknown } }[] = [];
      const fakeSocket = {
        send: (json: string) => received.push(JSON.parse(json)),
        on: () => {},
        close: () => {},
      };

      (httpServer as any).handleWebSocketConnection(fakeSocket, { headers: {}, socket: {} });
      (httpServer as any).handleWebSocketMessage(
        fakeSocket,
        Buffer.from(
          JSON.stringify({
            header: {
              version: 1,
              requestId: "debugstage-sub",
              messageType: "subscriptionRequest",
              messagePurpose: "subscribe",
            },
            body: { eventNames: DEBUG_PANEL_SUBSCRIPTION_EVENTS, slot: 0 },
          })
        )
      );

      try {
        expect(DEBUG_PANEL_SUBSCRIPTION_EVENTS).to.include("debugStage");

        // Drive the real listener flow: reserves a dynamic debug port and
        // transitions startingListener -> waitingForReadiness (which carries
        // the reserved port)...
        await server.startDebuggerListener();

        // ...then BDS reports the listener could not start -> stage "failed".
        server.handleDebuggerFailedToStart("Failed to start debugger: port already in use");

        const stageBodies = received
          .map((m) => m.body as { eventName?: string; stage?: string; failureKind?: string; debugPort?: number })
          .filter((b) => b !== undefined && b.eventName === "debugStage");

        const readiness = stageBodies.find((b) => b.stage === DebuggerLifecycleStage.waitingForReadiness);
        expect(readiness, "readiness stage must reach the web subscriber").to.not.be.undefined;
        expect(readiness?.debugPort, "reserved debug port must reach the web subscriber").to.equal(19795);

        const failed = stageBodies.find((b) => b.stage === DebuggerLifecycleStage.failed);
        expect(failed, "failed stage must reach the web subscriber").to.not.be.undefined;
        expect(failed?.failureKind).to.equal(DebuggerFailureKind.portOccupied);
      } finally {
        server.cancelDebuggerWork("debugstage test cleanup");
        await dsm.stopWebServer("debugstage test complete");
      }
    });

    it("reports the actually attempted dynamic port after the reservation is released", async function () {
      // Regression: handleDebuggerFailedToStart releases #debugPortReservation
      // BEFORE dispatching the failed stage event, so the event (and the
      // late-mount snapshot) previously fell back to the preferred port. If
      // the preferred port was occupied and the attempt used 19901, reporting
      // 19900 is exactly the misleading diagnosis dynamic allocation exists
      // to avoid.
      const env: ITestEnvironment = await TestPaths.createTestEnvironment();
      const dsm = new ServerManager(env.localEnv, env.creatorTools);
      const server = new DedicatedServer(
        "attempted-port-test",
        dsm,
        env.localEnv,
        "attempted-port-path",
        env.resultsFolder
      );
      server.debugOutboundConnect = false; // these tests exercise the legacy inbound listen flow
      server.port = 19900 - 12; // preferred debug port = 19900

      // Another owner holds the preferred port, so this attempt reserves 19901.
      const held = await DebugPortRegistry.reserve(19900, "attempted-port-other-owner");
      expect(held?.port).to.equal(19900);

      const stageEvents: { stage: string; debugPort?: number }[] = [];
      server.onDebugStageChanged.subscribe((_server, data) =>
        stageEvents.push({ stage: data.stage, debugPort: data.debugPort })
      );

      (server as any).runCommand = async () => {};

      try {
        await server.startDebuggerListener();
        expect(server.debugPort).to.equal(19901);

        // BDS reports the listener failed; the reservation is released before
        // the failed stage event is dispatched.
        server.handleDebuggerFailedToStart("Failed to start debugger: port already in use");

        const failed = stageEvents.find((e) => e.stage === DebuggerLifecycleStage.failed);
        expect(failed?.debugPort, "the failed event must report the attempted dynamic port").to.equal(19901);
        expect(server.debugPort, "the snapshot port must survive the release").to.equal(19901);
        expect(DebugPortRegistry.reservedBy(19901), "the reservation itself must be released").to.be.undefined;
      } finally {
        server.cancelDebuggerWork("attempted-port test cleanup");
        DebugPortRegistry.release(held);
        DebugPortRegistry.releaseAllForOwner("attempted-port-path");
      }
    });

    it("a collision on the preferred port surfaces the fallback port in stage events for the launch profile", async function () {
      // Regression: launch-profile generation runs at the deployment
      // boundary with only the STATIC slot derivation. When the preferred
      // port is occupied the listener reserves a fallback, and the stage
      // events are the channel that carries the confirmed port back to the
      // session boundary (VscDedicatedServerManager.watchForDebugPortFallback
      // rewrites the managed profile from them) - without the port in these
      // events, F5 keeps targeting the stale preferred port.
      const env: ITestEnvironment = await TestPaths.createTestEnvironment();
      const dsm = new ServerManager(env.localEnv, env.creatorTools);
      const server = new DedicatedServer(
        "fallback-port-test",
        dsm,
        env.localEnv,
        "fallback-port-path",
        env.resultsFolder
      );
      server.debugOutboundConnect = false; // inbound listen flow
      server.port = 19910 - 12; // preferred debug port = 19910

      // Another owner holds the preferred port, so this attempt reserves 19911.
      const held = await DebugPortRegistry.reserve(19910, "fallback-port-other-owner");
      expect(held?.port).to.equal(19910);

      const stageEvents: { stage: string; debugPort?: number }[] = [];
      server.onDebugStageChanged.subscribe((_server, data) =>
        stageEvents.push({ stage: data.stage, debugPort: data.debugPort })
      );

      (server as any).runCommand = async () => {};

      try {
        await server.startDebuggerListener();

        expect(server.debugPort, "the attempt must land on the fallback port").to.equal(19911);

        const waitingIndex = stageEvents.findIndex((e) => e.stage === DebuggerLifecycleStage.waitingForReadiness);
        expect(waitingIndex, "the flow must reach waitingForReadiness").to.be.greaterThan(-1);
        expect(
          stageEvents[waitingIndex].debugPort,
          "the readiness stage event must carry the fallback port"
        ).to.equal(19911);
        // Events BEFORE the reservation legitimately snapshot the preferred
        // port (the boundary watcher ignores them - the port equals the slot
        // derivation); from the reservation onward the stale port must be gone.
        expect(
          stageEvents.slice(waitingIndex).some((e) => e.debugPort === 19910),
          "no post-reservation stage event may advertise the stale preferred port"
        ).to.be.false;
      } finally {
        server.cancelDebuggerWork("fallback-port test cleanup");
        DebugPortRegistry.release(held);
        DebugPortRegistry.releaseAllForOwner("fallback-port-path");
      }
    });

    it("includes the lifecycle snapshot in the slot status config for late-mount web hydration", async function () {
      // Live debugStage notifications only cover transitions after the panel
      // subscribes, and the panel is mounted only while the Stats tab is
      // open. The /status slotConfig therefore carries the CURRENT lifecycle
      // snapshot - the web analog of the getDebugStatus IPC - so a terminal
      // failure that happened pre-mount still reaches the header/recovery UI.
      const env: ITestEnvironment = await TestPaths.createTestEnvironment();
      const dsm = new ServerManager(env.localEnv, env.creatorTools);
      const server = new DedicatedServer("web-late-stage", dsm, env.localEnv, "web-late-stage-path", env.resultsFolder);
      server.debugOutboundConnect = false; // these tests exercise the legacy inbound listen flow
      server.port = 19890 - 12; // debugPort = base port + 12 = 19890

      // The flow settles terminally while NO web client is subscribed.
      server.debuggerLifecycle.fail(
        DebuggerFailureKind.listenerReadiness,
        "BDS did not confirm 'Debugger listening' on port 19890 within 15s."
      );

      const slotConfig = buildDebugSlotConfig(server);

      expect(slotConfig.debugStage, "the pre-mount terminal failure must be in the snapshot").to.equal(
        DebuggerLifecycleStage.failed
      );
      expect(slotConfig.debugFailureKind).to.equal(DebuggerFailureKind.listenerReadiness);
      expect(slotConfig.debugStageMessage).to.include("did not confirm");
      expect(slotConfig.debugPort).to.equal(19890);
    });
  });

  describe("Process identity across restart", function () {
    it("ignores a superseded process's delayed lifecycle lines and close event", async function () {
      // Regression: only debugger readiness/failure lines carried a stream
      // identity. stopServer() writes "stop" and returns without waiting for
      // exit, so a restart can attach replacement process B while A's stdout
      // is still draining buffered lines and A's close event is still
      // pending. A's delayed "Server started" re-ran started handling and
      // debugger setup against B's run; A's delayed "Quit correctly" called
      // continueStopServer(), which cleared B's process handle and waited on
      // B's exit (leaving B running unmanaged); A's close event finalized -
      // and could auto-restart - against B.
      const env: ITestEnvironment = await TestPaths.createTestEnvironment();
      const dsm = new ServerManager(env.localEnv, env.creatorTools);
      const server = new DedicatedServer(
        "proc-identity-test",
        dsm,
        env.localEnv,
        "proc-identity-path",
        env.resultsFolder
      );
      server.port = 19980 - 12; // preferred debug port = 19980
      (server as any).runCommand = async () => {};
      // finalizeStopServer's legacy backup would touch real world folders
      // this synthetic slot does not have.
      (server as any).doBackup = async () => {};
      server.debuggerStreamingEnabled = false;

      const makeProcess = (pid: number) => {
        const proc = new EventEmitter() as any;
        proc.stdin = new PassThrough();
        proc.pid = pid;
        return proc;
      };

      let startedEvents = 0;
      server.onServerStarted.subscribe(() => startedEvents++);

      // Process A attaches first...
      const procA = makeProcess(50001);
      const stdoutA = new PassThrough();
      server.attachProcess(procA);
      const outputDoneA = server.directOutput(stdoutA);

      // ...then a restart supersedes it with process B.
      const procB = makeProcess(50002);
      const stdoutB = new PassThrough();
      server.attachProcess(procB);
      const outputDoneB = server.directOutput(stdoutB);

      try {
        // B reaches the started state normally.
        stdoutB.write("Server started.\n");
        await Utilities.sleep(250);
        expect(server.status).to.equal(DedicatedServerStatus.started);
        expect(startedEvents).to.equal(1);

        // A's delayed "Server started" drains after B became active - it
        // must not re-run started handling (or debugger setup) for B's run.
        stdoutA.write("Server started.\n");
        await Utilities.sleep(250);
        expect(startedEvents, "a superseded process's Server started must be ignored").to.equal(1);

        // A's delayed "Quit correctly" must not clear B's process handle.
        stdoutA.write("Quit correctly\n");
        await Utilities.sleep(250);
        expect(server.isProcessActive, "a superseded process's quit line must not clear the current handle").to.be
          .true;
        expect(server.status, "a superseded process's quit line must not stop the server").to.equal(
          DedicatedServerStatus.started
        );

        // A's close event must not finalize (or auto-restart) against B.
        procA.emit("close", 0);
        await Utilities.sleep(250);
        expect(server.isProcessActive, "a superseded process's close must not clear the current handle").to.be.true;
        expect(server.status).to.equal(DedicatedServerStatus.started);

        // B's OWN quit line still stops the server: the handle survived A's
        // noise, so continueStopServer takes it and finalizes once B exits.
        stdoutB.write("Quit correctly\n");
        await Utilities.sleep(100);
        procB.emit("exit", 0);
        await Utilities.sleep(250);
        expect(server.isProcessActive, "the current process's quit line must clear the handle").to.be.false;
        expect(server.status).to.equal(DedicatedServerStatus.stopped);
      } finally {
        server.cancelDebuggerWork("proc-identity test cleanup");
        server.stopPlayerPositionPolling();
        DebugPortRegistry.releaseAllForOwner("proc-identity-path");
        stdoutA.end();
        stdoutB.end();
        // In case an assertion failed mid-flight with continueStopServer
        // still awaiting an exit, let the streams' loops complete.
        procB.emit("exit", 0);
        await outputDoneA;
        await outputDoneB;
      }
    });

    it("restart waits for the previous process's termination before attempting the replacement start", async function () {
      // Regression: startServer(true) awaited only DELIVERY of the stop
      // command, not the specific old child's exit, so the replacement
      // spawned while the old process still lived - two processes
      // contending for the slot, with the old one's buffered callbacks
      // racing the new one's startup. The restart must not begin its start
      // attempt (observable via onServerStarting) until the previous
      // process has terminated.
      const env: ITestEnvironment = await TestPaths.createTestEnvironment();
      const dsm = new ServerManager(env.localEnv, env.creatorTools);
      const serverPath =
        path.resolve(env.resultsFolder.fullPath, "restart-serialization") + NodeStorage.platformFolderDelimiter;
      fs.mkdirSync(serverPath, { recursive: true });
      const server = new DedicatedServer("restart-serialization-test", dsm, env.localEnv, serverPath, env.resultsFolder);
      server.port = 19990 - 12;
      (server as any).runCommand = async () => {};
      (server as any).doBackup = async () => {};
      server.debuggerStreamingEnabled = false;

      const procA: any = new EventEmitter();
      procA.stdin = new PassThrough();
      procA.pid = 50003;
      procA.exitCode = null;
      procA.signalCode = null;

      const stdoutA = new PassThrough();
      server.attachProcess(procA);
      const outputDoneA = server.directOutput(stdoutA);

      let startingEvents = 0;
      server.onServerStarting.subscribe(() => startingEvents++);

      try {
        // Reach the started state so startServer(true) takes the restart branch.
        stdoutA.write("Server started.\n");
        await Utilities.sleep(250);
        expect(server.status).to.equal(DedicatedServerStatus.started);

        // A's exit is DELAYED past B's start attempt - the restart must
        // hold at the termination wait, not proceed. An explicit start with
        // no worldSettings keeps startServer from arming a periodic backup
        // interval that would keep the test process alive.
        let settled = false;
        const restartPromise = server.startServer(true, { mode: undefined, iagree: true }).then((result) => {
          settled = true;
          return result;
        });

        await Utilities.sleep(750);
        expect(startingEvents, "the replacement start must not begin while the previous process is alive").to.equal(0);
        expect(settled, "the restart must still be waiting on the previous process").to.be.false;

        // A finally terminates: the restart may now proceed. In this
        // synthetic slot the start then fails preflight (no BDS executable)
        // - fine; the regression is about ordering, not about spawning.
        procA.exitCode = 0;
        procA.emit("exit", 0);

        await restartPromise;
        expect(startingEvents, "the start attempt must begin only after the previous process terminated").to.equal(1);
      } finally {
        server.cancelDebuggerWork("restart-serialization test cleanup");
        server.stopPlayerPositionPolling();
        DebugPortRegistry.releaseAllForOwner(serverPath);
        stdoutA.end();
        procA.emit("exit", 0);
        await outputDoneA;
      }
    });

    it("restart waits for the previous run's complete finalization, not just its process exit", async function () {
      // Regression: on a graceful restart, continueStopServer() and the
      // restart's termination wait both unblock from the same process exit.
      // Finalization could then pause in doBackup() while the replacement
      // launched, and later dispatch onServerStopped, remove the
      // replacement's PID file, and write #status = stopped over the live
      // replacement. The restart must hold until finalization completes.
      const env: ITestEnvironment = await TestPaths.createTestEnvironment();
      const dsm = new ServerManager(env.localEnv, env.creatorTools);
      const serverPath =
        path.resolve(env.resultsFolder.fullPath, "restart-finalization") + NodeStorage.platformFolderDelimiter;
      fs.mkdirSync(serverPath, { recursive: true });
      const server = new DedicatedServer("restart-finalization-test", dsm, env.localEnv, serverPath, env.resultsFolder);
      server.port = 19994 - 12;
      (server as any).runCommand = async () => {};
      server.debuggerStreamingEnabled = false;

      // Finalization parks inside the backup - the window the regression
      // exploits.
      let releaseBackup: () => void = () => {};
      const backupGate = new Promise<void>((resolve) => (releaseBackup = resolve));
      (server as any).doBackup = async () => {
        await backupGate;
      };

      const procA: any = new EventEmitter();
      procA.stdin = new PassThrough();
      procA.pid = 50007;
      procA.exitCode = null;
      procA.signalCode = null;

      const stdoutA = new PassThrough();
      server.attachProcess(procA);
      const outputDoneA = server.directOutput(stdoutA);

      let startingEvents = 0;
      server.onServerStarting.subscribe(() => startingEvents++);

      try {
        stdoutA.write("Server started.\n");
        await Utilities.sleep(250);
        expect(server.status).to.equal(DedicatedServerStatus.started);

        // The graceful-stop acknowledgement begins continueStopServer, which
        // publishes its finalization and awaits the exit.
        stdoutA.write("Quit correctly\n");
        await Utilities.sleep(150);

        let settled = false;
        const restartPromise = server.startServer(true, { mode: undefined, iagree: true }).then((result) => {
          settled = true;
          return result;
        });

        // The exit releases both waiters; finalization parks in the backup.
        procA.exitCode = 0;
        procA.emit("exit", 0);
        await Utilities.sleep(500);

        expect(startingEvents, "the replacement must not start while the old run's finalization is pending").to.equal(
          0
        );
        expect(settled, "the restart must still be holding on the previous run's finalization").to.be.false;

        // Finalization completes; only now may the restart proceed (it then
        // fails preflight in this synthetic slot, which is fine - the
        // regression is about ordering).
        releaseBackup();
        await restartPromise;
        expect(startingEvents, "the start attempt must begin only after finalization completed").to.equal(1);
      } finally {
        releaseBackup();
        server.cancelDebuggerWork("restart-finalization test cleanup");
        server.stopPlayerPositionPolling();
        DebugPortRegistry.releaseAllForOwner(serverPath);
        stdoutA.end();
        procA.emit("exit", 0);
        await outputDoneA;
      }
    });

    it("a close-only restart adopts finalization and the late close cannot finalize or auto-restart", async function () {
      this.timeout(20000);

      // Regression for the force-kill/crash edge: the old child exits
      // WITHOUT the graceful "Quit correctly" acknowledgement (so
      // continueStopServer never publishes a finalization), releasing the
      // restart's termination wait; its close event lands only later, as
      // late as the replacement's startup preflight, where the identity
      // guard rightly skips it - so with nobody finalizing, the backup
      // interval and shutdown backup leaked. The restart must adopt the
      // finalization before launching, and the late close must no-op.
      const env: ITestEnvironment = await TestPaths.createTestEnvironment();
      const dsm = new ServerManager(env.localEnv, env.creatorTools);
      const serverPath =
        path.resolve(env.resultsFolder.fullPath, "restart-close-only") + NodeStorage.platformFolderDelimiter;
      fs.mkdirSync(serverPath, { recursive: true });
      const server = new DedicatedServer("restart-close-only-test", dsm, env.localEnv, serverPath, env.resultsFolder);
      server.port = 19998 - 12;
      (server as any).runCommand = async () => {};
      server.debuggerStreamingEnabled = false;

      let backupRuns = 0;
      (server as any).doBackup = async () => {
        backupRuns++;
      };

      const procA: any = new EventEmitter();
      procA.stdin = new PassThrough();
      procA.pid = 50017;
      procA.exitCode = null;
      procA.signalCode = null;

      const stdoutA = new PassThrough();
      server.attachProcess(procA);
      const outputDoneA = server.directOutput(stdoutA);

      let startingEvents = 0;
      let stoppedEvents = 0;
      server.onServerStarting.subscribe(() => startingEvents++);
      server.onServerStopped.subscribe(() => stoppedEvents++);

      try {
        stdoutA.write("Server started.\n");
        await Utilities.sleep(250);
        expect(server.status).to.equal(DedicatedServerStatus.started);

        // Restart: the old process exits (no "Quit correctly", no close yet).
        const restartPromise = server.startServer(true, { mode: undefined, iagree: true });
        await Utilities.sleep(150);
        procA.exitCode = 0;
        procA.emit("exit", 0);

        await restartPromise;
        expect(startingEvents, "the restart's own start attempt").to.equal(1);
        expect(stoppedEvents, "exactly one finalization - the adopted one").to.equal(1);
        expect(backupRuns, "the shutdown backup must not be skipped on the close-only path").to.equal(1);

        // A's close finally lands, after the replacement's startup began.
        procA.emit("close", 0);

        // Longer than the auto-restart backoff floor (1s): a wrongly
        // surviving auto-restart would have re-entered startServer by now.
        await Utilities.sleep(2500);

        expect(stoppedEvents, "the late close must not run a second finalization").to.equal(1);
        expect(backupRuns, "the late close must not run a second backup").to.equal(1);
        expect(startingEvents, "the late close must not auto-restart against the replacement").to.equal(1);
      } finally {
        server.cancelDebuggerWork("restart-close-only test cleanup");
        server.stopPlayerPositionPolling();
        DebugPortRegistry.releaseAllForOwner(serverPath);
        stdoutA.end();
        procA.emit("exit", 0);
        await outputDoneA;
      }
    });

    it("a deployment-driven restart waits for the old process's exit and finalization before launching", async function () {
      this.timeout(20000);

      // Regression: deploy() flips #status to stopped before calling
      // stopServer()/startServer(true), so a restart wait gated on #status
      // was skipped entirely on the deployment path - the replacement could
      // launch while the old process still owned the slot's files and ports,
      // and before the old run's finalization (including its backup)
      // completed. The launch is now serialized on run identity
      // (#activeProcess / #stopFinalization), which deployment cannot bypass.
      const env: ITestEnvironment = await TestPaths.createTestEnvironment();
      const dsm = new ServerManager(env.localEnv, env.creatorTools);
      const serverPath =
        path.resolve(env.resultsFolder.fullPath, "deploy-restart") + NodeStorage.platformFolderDelimiter;
      fs.mkdirSync(serverPath, { recursive: true });
      const server = new DedicatedServer("deploy-restart-test", dsm, env.localEnv, serverPath, env.resultsFolder);
      server.port = 19996 - 12;
      (server as any).runCommand = async () => {};
      server.debuggerStreamingEnabled = false;

      // Finalization parks inside the backup - the window the regression
      // exploits.
      let releaseBackup: () => void = () => {};
      const backupGate = new Promise<void>((resolve) => (releaseBackup = resolve));
      (server as any).doBackup = async () => {
        await backupGate;
      };

      const procA: any = new EventEmitter();
      procA.stdin = new PassThrough();
      procA.exitCode = null;
      procA.signalCode = null;

      const stdoutA = new PassThrough();
      server.attachProcess(procA);
      const outputDoneA = server.directOutput(stdoutA);

      let startingEvents = 0;
      server.onServerStarting.subscribe(() => startingEvents++);

      const deploySource = env.resultsFolder.ensureFolder("deploy-restart-src");
      await deploySource.ensureExists();

      try {
        stdoutA.write("Server started.\n");
        await Utilities.sleep(250);
        expect(server.status).to.equal(DedicatedServerStatus.started);

        // deploy() takes the restart path: flips #status to stopped, delivers
        // "stop", and calls startServer(true) - the exact bypass sequence.
        let deploySettled = false;
        const deployPromise = server.deploy(deploySource, true, false).then(() => (deploySettled = true));
        await Utilities.sleep(400);

        expect(startingEvents, "the replacement must not launch while the old process is alive").to.equal(0);
        expect(deploySettled, "the deploy must be holding on the old process's termination").to.be.false;

        // The old server acknowledges the stop; its finalization is
        // published, and parks in the backup once the process exits.
        stdoutA.write("Quit correctly\n");
        await Utilities.sleep(150);
        procA.exitCode = 0;
        procA.emit("exit", 0);
        await Utilities.sleep(400);

        expect(
          startingEvents,
          "the replacement must not launch while the old run's finalization is pending"
        ).to.equal(0);
        expect(deploySettled, "the deploy must still be holding on the old run's finalization").to.be.false;

        // Finalization completes; only now may the launch proceed (it then
        // fails preflight in this synthetic slot, which is fine - the
        // regression is about ordering).
        releaseBackup();
        await deployPromise;
        expect(startingEvents, "the launch must begin only after the old run fully finalized").to.equal(1);
      } finally {
        releaseBackup();
        server.cancelDebuggerWork("deploy-restart test cleanup");
        server.stopPlayerPositionPolling();
        DebugPortRegistry.releaseAllForOwner(serverPath);
        stdoutA.end();
        procA.emit("exit", 0);
        await outputDoneA;
      }
    });

    it("a rejecting shutdown backup is reported without wedging the restart or the stop state", async function () {
      // Regression: the finalization promise is awaited by restart, so a
      // doBackup() rejection propagated through the bare await and aborted
      // the restart with no process attached while #status still read
      // "started". The failure must be reported (onServerError) while the
      // stop bookkeeping (onServerStopped, #status = stopped) completes and
      // the restart proceeds.
      const env: ITestEnvironment = await TestPaths.createTestEnvironment();
      const dsm = new ServerManager(env.localEnv, env.creatorTools);
      const serverPath =
        path.resolve(env.resultsFolder.fullPath, "restart-backup-reject") + NodeStorage.platformFolderDelimiter;
      fs.mkdirSync(serverPath, { recursive: true });
      const server = new DedicatedServer("restart-backup-reject-test", dsm, env.localEnv, serverPath, env.resultsFolder);
      server.port = 20002 - 12;
      (server as any).runCommand = async () => {};
      server.debuggerStreamingEnabled = false;

      (server as any).doBackup = async () => {
        throw new Error("disk full during shutdown backup");
      };

      const procA: any = new EventEmitter();
      procA.stdin = new PassThrough();
      procA.pid = 50019;
      procA.exitCode = null;
      procA.signalCode = null;

      const stdoutA = new PassThrough();
      server.attachProcess(procA);
      const outputDoneA = server.directOutput(stdoutA);

      let startingEvents = 0;
      let stoppedEvents = 0;
      const errors: string[] = [];
      server.onServerStarting.subscribe(() => startingEvents++);
      server.onServerStopped.subscribe(() => stoppedEvents++);
      server.onServerError.subscribe((_s, message) => errors.push(message));

      try {
        stdoutA.write("Server started.\n");
        await Utilities.sleep(250);
        expect(server.status).to.equal(DedicatedServerStatus.started);

        stdoutA.write("Quit correctly\n");
        await Utilities.sleep(150);
        procA.exitCode = 0;
        procA.emit("exit", 0);

        // The restart must NOT reject on the backup failure; it proceeds to
        // its own start attempt (which then fails preflight in this
        // synthetic slot - unrelated to the regression).
        await server.startServer(true, { mode: undefined, iagree: true });

        expect(startingEvents, "the restart must still reach its start attempt").to.equal(1);
        expect(stoppedEvents, "the stop bookkeeping must complete despite the backup failure").to.equal(1);
        expect(
          errors.some((message) => message.includes("Shutdown backup failed")),
          "the backup failure must be reported through onServerError"
        ).to.be.true;
      } finally {
        server.cancelDebuggerWork("restart-backup-reject test cleanup");
        server.stopPlayerPositionPolling();
        DebugPortRegistry.releaseAllForOwner(serverPath);
        stdoutA.end();
        procA.emit("exit", 0);
        await outputDoneA;
      }
    });
  });

  describe("Handshake timeout recovery", function () {
    /**
     * A missing ProtocolEvent within the handshake window proves only that
     * the peer was slow or silent (overloaded BDS, contended endpoint) - not
     * that an incompatible protocol version was observed. It must therefore
     * classify as the retryable handshakeTimeout kind and flow into the
     * automatic reconnect path, not the permanent protocolMismatch failure.
     * This exercises the full loop: slow first handshake -> timeout ->
     * scheduled reconnect -> successful second handshake.
     */
    it("reconnects and completes the handshake after a slow first attempt", async function () {
      this.timeout(45000);

      const env: ITestEnvironment = await TestPaths.createTestEnvironment();
      const dsm = new ServerManager(env.localEnv, env.creatorTools);
      const server = new DedicatedServer(
        "handshake-timeout-test",
        dsm,
        env.localEnv,
        "handshake-timeout-path",
        env.resultsFolder
      );
      server.debugOutboundConnect = false; // these tests exercise the legacy inbound listen flow
      server.port = 19871 - 12; // debugPort = base port + 12 = 19871

      // The endpoint accepts the connection but stays SILENT on the first
      // attempt - the handshake-timeout signature.
      const mockServer = new MockMinecraftDebugServer(19871);
      mockServer.sendProtocolEventOnConnect = false;
      await mockServer.start();

      // The mock occupies the port, so real reservation probing would skip
      // it; hand out the port directly.
      const originalReserve = DebugPortRegistry.reserve;
      const originalRelease = DebugPortRegistry.release;
      (DebugPortRegistry as any).reserve = async () => ({ port: 19871, token: -1 });
      (DebugPortRegistry as any).release = () => {};
      (server as any).runCommand = async () => {};

      const stdout = new PassThrough();
      const outputDone = server.directOutput(stdout);

      const stagesSeen: DebuggerLifecycleStage[] = [];
      server.debuggerLifecycle.onStageChanged.subscribe((_tracker, data) => {
        stagesSeen.push(data.stage);
      });

      try {
        // Reach a live run, bring the listener up, and start the client.
        stdout.write("Server started.\n");
        await Utilities.sleep(200);
        expect(server.status).to.equal(DedicatedServerStatus.started);

        await server.startDebuggerListener();
        server.handleDebuggerListening("Debugger listening on port 19871");

        // First attempt connects but the handshake times out (10s)...
        await Utilities.sleep(12000);

        expect(
          stagesSeen,
          "a handshake timeout must schedule a reconnect, not fail permanently"
        ).to.include(DebuggerLifecycleStage.reconnecting);
        expect(stagesSeen, "a handshake timeout must never classify as a permanent failure").to.not.include(
          DebuggerLifecycleStage.failed
        );

        // ...the peer recovers before the backoff elapses...
        mockServer.sendProtocolEventOnConnect = true;

        // ...and the scheduled reconnect (2s backoff) completes the handshake.
        await Utilities.sleep(4000);

        expect(server.debuggerLifecycle.stage, "the retry must complete the handshake").to.equal(
          DebuggerLifecycleStage.connected
        );
        expect(server.debugClient?.isConnected).to.be.true;
        expect(stagesSeen).to.not.include(DebuggerLifecycleStage.failed);
      } finally {
        server.cancelDebuggerWork("test cleanup");
        server.stopPlayerPositionPolling();
        stdout.end();
        await outputDone;
        await mockServer.stop();
        (DebugPortRegistry as any).reserve = originalReserve;
        (DebugPortRegistry as any).release = originalRelease;
      }
    });
  });

  describe("Listener startup is single-flight and attempt-scoped", function () {
    /**
     * startDebuggerListener must be single-flight (concurrent Retry/timer
     * entries share one reservation and one listen command) and every
     * completion - pending reservations, the readiness timeout, and BDS
     * confirmation/failure lines - must be tied to the attempt that produced
     * it. These tests resolve reservations in reverse order across superseded
     * attempts and stop mid-reservation, proving stale completions are
     * released/ignored instead of acting on the wrong attempt.
     */

    interface IListenerHarness {
      server: DedicatedServer;
      reserveCalls: number[];
      releasedPorts: (number | undefined)[];
      listenCommands: string[];
      resolveReservation: (index: number, port: number | undefined) => void;
      restore: () => void;
    }

    async function createListenerHarness(name: string): Promise<IListenerHarness> {
      const env: ITestEnvironment = await TestPaths.createTestEnvironment();
      const dsm = new ServerManager(env.localEnv, env.creatorTools);
      const server = new DedicatedServer(name, dsm, env.localEnv, name + "-path", env.resultsFolder);
      server.debugOutboundConnect = false; // these tests exercise the legacy inbound listen flow

      const reserveCalls: number[] = [];
      const releasedPorts: (number | undefined)[] = [];
      const listenCommands: string[] = [];
      const pendingReservations: ((reservation: { port: number; token: number } | undefined) => void)[] = [];

      const originalReserve = DebugPortRegistry.reserve;
      const originalRelease = DebugPortRegistry.release;

      (DebugPortRegistry as any).reserve = async (preferredPort: number) => {
        reserveCalls.push(preferredPort);
        return new Promise<{ port: number; token: number } | undefined>((resolve) => pendingReservations.push(resolve));
      };
      (DebugPortRegistry as any).release = (reservation: { port: number; token: number } | undefined) => {
        releasedPorts.push(reservation?.port);
      };

      // The listen command would otherwise try to write to a nonexistent
      // BDS stdin; capture it instead.
      (server as any).runCommand = async (command: string) => {
        listenCommands.push(command);
      };

      return {
        server: server,
        reserveCalls: reserveCalls,
        releasedPorts: releasedPorts,
        listenCommands: listenCommands,
        // Distinct token per resolved reservation, mirroring the tokenized
        // claims the real registry hands out.
        resolveReservation: (index, port) =>
          pendingReservations[index](port === undefined ? undefined : { port: port, token: 1000 + index }),
        restore: () => {
          (DebugPortRegistry as any).reserve = originalReserve;
          (DebugPortRegistry as any).release = originalRelease;
        },
      };
    }

    it("concurrent entries share one reservation and one listen command", async function () {
      const harness = await createListenerHarness("listener-singleflight");

      try {
        const first = harness.server.startDebuggerListener();
        const second = harness.server.startDebuggerListener();

        harness.resolveReservation(0, 19850);
        await Promise.all([first, second]);

        expect(harness.reserveCalls.length, "only one reservation may be made").to.equal(1);
        expect(
          harness.listenCommands.filter((c) => c.startsWith("script debugger listen")).length,
          "only one listen command may be issued"
        ).to.equal(1);
        expect(harness.server.debugPort).to.equal(19850);
        expect(harness.server.debuggerLifecycle.stage).to.equal(DebuggerLifecycleStage.waitingForReadiness);
      } finally {
        harness.server.cancelDebuggerWork("test cleanup");
        harness.restore();
      }
    });

    it("stop while the reservation is pending releases it without any later stage transition", async function () {
      const harness = await createListenerHarness("listener-stop-midreserve");

      try {
        const startPromise = harness.server.startDebuggerListener();

        // Stop begins while DebugPortRegistry.reserve is still pending.
        harness.server.cancelDebuggerWork("server stop requested");

        const transitionsAfterStop: DebuggerLifecycleStage[] = [];
        harness.server.debuggerLifecycle.onStageChanged.subscribe((_tracker, data) => {
          transitionsAfterStop.push(data.stage);
        });

        harness.resolveReservation(0, 19851);
        await startPromise;

        expect(harness.releasedPorts, "the late reservation must be released").to.include(19851);
        expect(transitionsAfterStop, "no stage transition may occur after stop").to.deep.equal([]);
        expect(harness.server.debuggerLifecycle.stage).to.equal(DebuggerLifecycleStage.stopping);
      } finally {
        harness.restore();
      }
    });

    it("a rejected listen command unwinds the attempt, releases the reservation, and fails the lifecycle", async function () {
      // Regression: runCommand() reaches streamWrite(), which rejects with
      // EPIPE if BDS exits while the listen command is being delivered. The
      // delay/reconnect timers float startDebuggerListener(), so a rejection
      // would be an unhandled main-process rejection - and it previously left
      // #awaitingDebuggerListening true with the reservation retained,
      // permanently blocking retries.
      const harness = await createListenerHarness("listener-listen-epipe");

      try {
        (harness.server as any).runCommand = async () => {
          throw new Error("write EPIPE");
        };

        // Floating callers do not await this promise: it must RESOLVE (the
        // await below would fail the test on a rejection).
        const startPromise = harness.server.startDebuggerListener();

        harness.resolveReservation(0, 19855);
        await startPromise;

        expect(harness.releasedPorts, "the failed attempt's reservation must be released").to.include(19855);
        expect(harness.server.debuggerLifecycle.stage, "the lifecycle must fail, not hang").to.equal(
          DebuggerLifecycleStage.failed
        );
        expect(harness.server.debuggerLifecycle.failureKind).to.equal(DebuggerFailureKind.serverStartup);

        // The unwind must not leave the flow half-armed: a later retry must
        // be able to start a fresh attempt (new reservation) instead of
        // being skipped as "already starting" forever.
        const retryPromise = harness.server.startDebuggerListener();
        expect(harness.reserveCalls.length, "a retry must reach a fresh reservation").to.equal(2);

        harness.resolveReservation(1, undefined);
        await retryPromise;
      } finally {
        harness.server.cancelDebuggerWork("test cleanup");
        harness.restore();
      }
    });

    it("reverse-order outcomes: the superseded attempt is released, stale BDS lines are ignored", async function () {
      const harness = await createListenerHarness("listener-reverse-order");

      try {
        // Attempt A begins; its reservation stays pending...
        const startA = harness.server.startDebuggerListener();

        // ...a restart supersedes it and attempt B begins.
        harness.server.cancelDebuggerWork("supersede attempt A");
        const startB = harness.server.startDebuggerListener();

        // Outcomes resolve in REVERSE order: B first, then A's stale one.
        harness.resolveReservation(1, 19861);
        await startB;
        harness.resolveReservation(0, 19860);
        await startA;

        expect(harness.releasedPorts, "the superseded attempt's late reservation must be released").to.include(19860);
        expect(harness.releasedPorts, "the active attempt's reservation must be kept").to.not.include(19861);
        expect(harness.server.debugPort, "the active attempt's reservation must win").to.equal(19861);
        expect(harness.server.debuggerLifecycle.stage).to.equal(DebuggerLifecycleStage.waitingForReadiness);

        // A stale confirmation for the superseded attempt's port must not
        // complete the active attempt.
        harness.server.handleDebuggerListening("Debugger listening on port 19860");
        expect(harness.server.debuggerLifecycle.stage).to.equal(DebuggerLifecycleStage.waitingForReadiness);

        // The active attempt's own confirmation IS accepted.
        harness.server.handleDebuggerListening("Debugger listening on port 19861");
        expect(harness.server.debuggerLifecycle.stage).to.equal(DebuggerLifecycleStage.connectingTcp);

        // A late failure line after the listener is already up must not tear
        // the attempt down or release its reservation.
        harness.server.handleDebuggerFailedToStart("Failed to start debugger");
        expect(harness.server.debuggerLifecycle.stage).to.not.equal(DebuggerLifecycleStage.failed);
        expect(harness.releasedPorts).to.not.include(19861);
      } finally {
        harness.server.cancelDebuggerWork("test cleanup");
        harness.restore();
        await Utilities.sleep(100);
      }
    });

    it("does not rewind an attempt that failed while the listen command write was completing", async function () {
      // Deferred-write regression: BDS can emit "Failed to start debugger"
      // while runCommand()'s stdin write is still completing. The failure
      // handler releases the reservation and fails the lifecycle WITHOUT
      // advancing the attempt id (the attempt settled, it was not
      // superseded), so the post-await continuation used to pass its
      // generation check, rewind the terminal failure to waitingForReadiness,
      // and arm a readiness timeout for the already-settled attempt.
      const env: ITestEnvironment = await TestPaths.createTestEnvironment();
      const dsm = new ServerManager(env.localEnv, env.creatorTools);
      const server = new DedicatedServer(
        "early-fail-test",
        dsm,
        env.localEnv,
        "early-fail-path",
        env.resultsFolder
      );
      server.port = 19968 - 12; // preferred debug port = 19968
      // These regressions exercise the legacy inbound listen flow.
      server.debugOutboundConnect = false;

      // The failure line lands while the awaited write is completing.
      (server as any).runCommand = async () => {
        server.handleDebuggerFailedToStart("Failed to start debugger: port already in use");
      };

      try {
        await server.startDebuggerListener();

        expect(
          server.debuggerLifecycle.stage,
          "the continuation must not overwrite a terminal failure with waitingForReadiness"
        ).to.equal(DebuggerLifecycleStage.failed);
        expect(server.debuggerLifecycle.failureKind).to.equal(DebuggerFailureKind.portOccupied);
        expect(DebugPortRegistry.reservedBy(19968), "the failed attempt's reservation stays released").to.be.undefined;
      } finally {
        server.cancelDebuggerWork("early-fail test cleanup");
        DebugPortRegistry.releaseAllForOwner("early-fail-path");
      }
    });

    it("does not rewind an attempt whose readiness was confirmed while the listen command write was completing", async function () {
      // Companion to the early-failure case: an early "Debugger listening"
      // clears #awaitingDebuggerListening and settles the flow (idle here,
      // since streaming is disabled). The continuation must not move the
      // settled flow backward to waitingForReadiness or arm a readiness
      // timeout that would later fail it.
      const env: ITestEnvironment = await TestPaths.createTestEnvironment();
      const dsm = new ServerManager(env.localEnv, env.creatorTools);
      const server = new DedicatedServer(
        "early-ready-test",
        dsm,
        env.localEnv,
        "early-ready-path",
        env.resultsFolder
      );
      server.port = 19972 - 12; // preferred debug port = 19972
      // These regressions exercise the legacy inbound listen flow.
      server.debugOutboundConnect = false;
      // Settle at "idle" on confirmation instead of dialing a TCP endpoint.
      server.debuggerStreamingEnabled = false;

      // The confirmation lands while the awaited write is completing.
      (server as any).runCommand = async () => {
        server.handleDebuggerListening("Debugger listening on port 19972");
      };

      try {
        await server.startDebuggerListener();

        expect(
          server.debuggerLifecycle.stage,
          "the continuation must not move a settled flow back to waitingForReadiness"
        ).to.equal(DebuggerLifecycleStage.idle);
      } finally {
        server.cancelDebuggerWork("early-ready test cleanup");
        DebugPortRegistry.releaseAllForOwner("early-ready-path");
      }
    });

    it("ignores a delayed failure line from a replaced process while the current one awaits readiness", async function () {
      // Deferred regression: stdout lines carry the identity of the stream
      // that produced them. Old process A's stdout can still be draining
      // buffered lines when replacement process B is already awaiting its
      // "Debugger listening" confirmation - A's delayed "Failed to start
      // debugger" must not release B's reservation or fail B's listener, and
      // B's own confirmation must still be accepted afterwards.
      const env: ITestEnvironment = await TestPaths.createTestEnvironment();
      const dsm = new ServerManager(env.localEnv, env.creatorTools);
      const server = new DedicatedServer(
        "stale-stdout-test",
        dsm,
        env.localEnv,
        "stale-stdout-path",
        env.resultsFolder
      );
      server.port = 19940 - 12; // preferred debug port = 19940
      (server as any).runCommand = async () => {};
      // Keep the accepted confirmation from dialing a real TCP endpoint - the
      // listener flow then settles at "idle" instead of connecting a client.
      server.debuggerStreamingEnabled = false;

      // Process A's stream attaches first...
      const stdoutA = new PassThrough();
      const outputDoneA = server.directOutput(stdoutA);

      // ...then A is replaced (restart): process B's stream attaches, and B's
      // listener attempt reserves the port and awaits confirmation.
      const stdoutB = new PassThrough();
      const outputDoneB = server.directOutput(stdoutB);

      try {
        await server.startDebuggerListener();
        expect(server.debuggerLifecycle.stage).to.equal(DebuggerLifecycleStage.waitingForReadiness);
        expect(DebugPortRegistry.reservedBy(19940)).to.not.be.undefined;

        // A's delayed failure line drains AFTER B began awaiting readiness.
        stdoutA.write("Failed to start debugger: port already in use\n");
        await Utilities.sleep(250);

        expect(
          server.debuggerLifecycle.stage,
          "a replaced process's failure line must not fail the current attempt"
        ).to.equal(DebuggerLifecycleStage.waitingForReadiness);
        expect(DebugPortRegistry.reservedBy(19940), "the current attempt's reservation must survive").to.not.be
          .undefined;

        // B's own confirmation must still complete the attempt.
        stdoutB.write("Debugger listening on port 19940\n");
        await Utilities.sleep(250);
        expect(server.debuggerLifecycle.stage, "the current process's confirmation must be accepted").to.equal(
          DebuggerLifecycleStage.idle
        );
      } finally {
        server.cancelDebuggerWork("stale-stdout test cleanup");
        server.stopPlayerPositionPolling();
        DebugPortRegistry.releaseAllForOwner("stale-stdout-path");
        stdoutA.end();
        stdoutB.end();
        await outputDoneA;
        await outputDoneB;
      }
    });
  });

  describe("Startup preflight failures mark the debugger lifecycle terminal", function () {
    /**
     * The debugger lifecycle enters startingServer BEFORE executable/signature
     * preflight, so every preflight early-return must land it on a terminal
     * stage (failed, kind serverStartup) - otherwise diagnostics claim
     * "Starting server" forever for a start that definitively failed. One
     * test per preflight failure path: missing executable, invalid signature,
     * and a valid-but-non-Microsoft signer.
     */

    // Explicit start message with no worldSettings: startServer(false,
    // undefined) would pull worldSettings from the environment, which can arm
    // the periodic-backup interval and keep the test process alive.
    const preflightStartMessage = { mode: "auto", iagree: true } as any;

    async function createPreflightServer(name: string): Promise<{
      server: DedicatedServer;
      serverPath: string;
      errors: string[];
    }> {
      const env: ITestEnvironment = await TestPaths.createTestEnvironment();
      const dsm = new ServerManager(env.localEnv, env.creatorTools);

      // Resolve to a normalized absolute path: startServer's
      // validateFolderPath rejects paths containing ".." segments.
      const serverPath = path.resolve(env.resultsFolder.fullPath, name) + NodeStorage.platformFolderDelimiter;
      fs.mkdirSync(serverPath, { recursive: true });

      const server = new DedicatedServer(name, dsm, env.localEnv, serverPath, env.resultsFolder);
      server.debugOutboundConnect = false; // these tests exercise the legacy inbound listen flow

      const errors: string[] = [];
      server.onServerError.subscribe((_server, message) => {
        errors.push(message);
      });

      return { server: server, serverPath: serverPath, errors: errors };
    }

    function expectTerminalServerStartupFailure(server: DedicatedServer, errors: string[]) {
      expect(server.status).to.equal(DedicatedServerStatus.stopped);
      expect(errors.length, "the BDS error event must fire").to.equal(1);
      expect(server.debuggerLifecycle.stage, "the lifecycle must not remain non-terminal").to.equal(
        DebuggerLifecycleStage.failed
      );
      expect(server.debuggerLifecycle.failureKind).to.equal(DebuggerFailureKind.serverStartup);
      expect(server.debuggerLifecycle.errorMessage).to.not.be.undefined;
    }

    it("missing executable fails the lifecycle terminally", async function () {
      const { server, errors } = await createPreflightServer("preflight-missing-exe");

      const launched = await server.startServer(false, preflightStartMessage);

      expect(launched, "a preflight failure must report an unsuccessful outcome").to.be.false;
      expectTerminalServerStartupFailure(server, errors);
      expect(errors[0]).to.include("Server executable not found");
    });

    it("invalid signature fails the lifecycle terminally", async function () {
      if (os.platform() !== "win32") {
        this.skip();
        return;
      }

      const { server, serverPath, errors } = await createPreflightServer("preflight-bad-sig");
      fs.writeFileSync(serverPath + "bedrock_server.exe", "not a real executable");

      const originalVerify = LocalUtilities.verifyAuthenticodeSignature;
      (LocalUtilities as any).verifyAuthenticodeSignature = async () => ({
        isValid: false,
        status: "HashMismatch",
        error: "file has been tampered with",
      });

      let launched: boolean | undefined;
      try {
        launched = await server.startServer(false, preflightStartMessage);
      } finally {
        (LocalUtilities as any).verifyAuthenticodeSignature = originalVerify;
      }

      expect(launched).to.be.false;
      expectTerminalServerStartupFailure(server, errors);
      expect(errors[0]).to.include("Digital signature verification failed");
    });

    it("a valid but non-Microsoft signer fails the lifecycle terminally", async function () {
      if (os.platform() !== "win32") {
        this.skip();
        return;
      }

      const { server, serverPath, errors } = await createPreflightServer("preflight-non-ms-signer");
      fs.writeFileSync(serverPath + "bedrock_server.exe", "not a real executable");

      const originalVerify = LocalUtilities.verifyAuthenticodeSignature;
      (LocalUtilities as any).verifyAuthenticodeSignature = async () => ({
        isValid: true,
        status: "Valid",
        signer: "Contoso Ltd",
        isMicrosoftSigned: false,
      });

      let launched: boolean | undefined;
      try {
        launched = await server.startServer(false, preflightStartMessage);
      } finally {
        (LocalUtilities as any).verifyAuthenticodeSignature = originalVerify;
      }

      expect(launched).to.be.false;
      expectTerminalServerStartupFailure(server, errors);
      expect(errors[0]).to.include("not by Microsoft");
    });

    it("a new run does not inherit the previous run's attempted debug port", async function () {
      // #lastAttemptedDebugPort intentionally survives the failed attempt's
      // reservation release (so its failed event/diagnostics keep the port
      // that attempt actually used) - but it must be cleared when a NEW run
      // begins, or a run that fails preflight before reserving anything
      // permanently reports the previous run's dynamic port, possibly
      // outside its own base-port window.
      const { server, errors } = await createPreflightServer("preflight-stale-port");
      server.port = 19960 - 12; // this run's preferred debug port = 19960

      const originalReserve = DebugPortRegistry.reserve;
      const originalRelease = DebugPortRegistry.release;
      (DebugPortRegistry as any).reserve = async () => ({ port: 19999, token: -1 });
      (DebugPortRegistry as any).release = () => {};
      (server as any).runCommand = async () => {};

      try {
        // Previous run: the listener attempt used dynamic port 19999 and
        // failed; the attempted port survives the release by design.
        await server.startDebuggerListener();
        server.handleDebuggerFailedToStart("Failed to start debugger: port already in use");
        expect(server.debugPort, "the failed attempt must keep reporting its actual port").to.equal(19999);

        // New run: preflight fails (missing executable) BEFORE any
        // reservation. Its stage events and snapshot must report THIS run's
        // preferred port, never the stale 19999.
        const stagePorts: (number | undefined)[] = [];
        server.onDebugStageChanged.subscribe((_server, data) => stagePorts.push(data.debugPort));

        const launched = await server.startServer(false, preflightStartMessage);

        expect(launched).to.be.false;
        expectTerminalServerStartupFailure(server, errors);
        expect(server.debugPort, "the new run must not report the previous run's port").to.equal(19960);
        expect(stagePorts.length, "the new run must emit stage events").to.be.greaterThan(0);
        expect(stagePorts, "no stage event of the new run may carry the stale port").to.not.include(19999);
      } finally {
        server.cancelDebuggerWork("stale-port test cleanup");
        (DebugPortRegistry as any).reserve = originalReserve;
        (DebugPortRegistry as any).release = originalRelease;
      }
    });
  });

  describe("Support diagnostics privacy", function () {
    it("the diagnostics snapshot never carries a raw module UUID key", async function () {
      // Regression: getDebugDiagnostics() included the raw
      // sessionInfo.targetModuleUuid. Module UUIDs are creator-identifying
      // (the evidence sanitizer strips them for exactly that reason), and
      // this snapshot is serialized over IPC and written verbatim to the
      // clipboard by the panel's Copy Diagnostic Details action. Only the
      // derived hasTargetModule boolean may appear.
      const env: ITestEnvironment = await TestPaths.createTestEnvironment();
      const dsm = new ServerManager(env.localEnv, env.creatorTools);
      const server = new DedicatedServer(
        "diagnostics-privacy-test",
        dsm,
        env.localEnv,
        "diagnostics-privacy-path",
        env.resultsFolder
      );

      const diagnostics = server.getDebugDiagnostics();

      expect(diagnostics.hasTargetModule, "no session yet - the derived boolean must be unknown").to.be.undefined;
      expect(JSON.stringify(diagnostics)).to.not.include("targetModuleUuid");
    });
  });

  describe("Settings verification reads the persisted server.properties", function () {
    /**
     * The in-memory ServerPropertiesManager.allowInboundScriptDebugging
     * field is write-only intent (defaulted true, never populated from the
     * file), so a check against it is unreachable. BDS reads the FILE: a
     * hand-edited allow-inbound-script-debugging=false must fail the
     * configuring stage as the promised settings failure, not surface later
     * as a misleading readiness timeout.
     */

    async function createSettingsServer(name: string, propertiesContent: string): Promise<DedicatedServer> {
      const env: ITestEnvironment = await TestPaths.createTestEnvironment();
      const dsm = new ServerManager(env.localEnv, env.creatorTools);
      const serverPath = path.resolve(env.resultsFolder.fullPath, name) + NodeStorage.platformFolderDelimiter;
      fs.mkdirSync(serverPath, { recursive: true });
      fs.writeFileSync(serverPath + "server.properties", propertiesContent);

      const server = new DedicatedServer(name, dsm, env.localEnv, serverPath, env.resultsFolder);
      server.debugOutboundConnect = false; // these tests exercise the legacy inbound listen flow
      server.properties.serverFolder = new NodeStorage(serverPath, "").rootFolder;

      return server;
    }

    it("a hand-edited allow-inbound-script-debugging=false fails as a settings failure", async function () {
      const server = await createSettingsServer(
        "settings-inbound-false",
        "# Generated by Minecraft Creator Tools\nallow-inbound-script-debugging=false\n"
      );

      const stdout = new PassThrough();
      const outputDone = server.directOutput(stdout);

      try {
        stdout.write("Server started.\n");
        await Utilities.sleep(250);

        expect(server.debuggerLifecycle.stage, "the persisted false must fail the configuring stage").to.equal(
          DebuggerLifecycleStage.failed
        );
        expect(server.debuggerLifecycle.failureKind).to.equal(DebuggerFailureKind.settings);
        expect(server.debuggerLifecycle.errorMessage).to.include("allow-inbound-script-debugging");
      } finally {
        server.cancelDebuggerWork("settings test cleanup");
        server.stopPlayerPositionPolling();
        stdout.end();
        await outputDone;
      }
    });

    it("outbound mode with streaming disabled checks the INBOUND setting (effective direction), and fails on inbound=false", async function () {
      // Regression: preflight selected the setting from #debugOutboundConnect
      // alone, but outbound mode with streaming disabled falls through to the
      // inbound `script debugger listen` flow (the external-debugger
      // handoff). inbound=false/outbound=true passed preflight and later
      // timed out misleadingly instead of failing as a settings problem.
      const server = await createSettingsServer(
        "settings-effective-inbound-false",
        "# Generated by Minecraft Creator Tools\nallow-inbound-script-debugging=false\nallow-outbound-script-debugging=true\n"
      );
      server.debugOutboundConnect = true;
      server.debuggerStreamingEnabled = false;

      const stdout = new PassThrough();
      const outputDone = server.directOutput(stdout);

      try {
        stdout.write("Server started.\n");
        await Utilities.sleep(250);

        expect(server.debuggerLifecycle.stage, "the effective operation is inbound; its =false must fail").to.equal(
          DebuggerLifecycleStage.failed
        );
        expect(server.debuggerLifecycle.failureKind).to.equal(DebuggerFailureKind.settings);
        expect(server.debuggerLifecycle.errorMessage).to.include("allow-inbound-script-debugging");
      } finally {
        server.cancelDebuggerWork("settings test cleanup");
        server.stopPlayerPositionPolling();
        stdout.end();
        await outputDone;
      }
    });

    it("outbound mode with streaming disabled passes preflight on inbound=true even when outbound=false", async function () {
      // The mirror combination: the effective operation (inbound listen for
      // the handoff) is allowed, so the irrelevant outbound=false must not
      // reject a listener that can start.
      const server = await createSettingsServer(
        "settings-effective-outbound-false",
        "# Generated by Minecraft Creator Tools\nallow-inbound-script-debugging=true\nallow-outbound-script-debugging=false\n"
      );
      server.debugOutboundConnect = true;
      server.debuggerStreamingEnabled = false;

      const stdout = new PassThrough();
      const outputDone = server.directOutput(stdout);

      try {
        stdout.write("Server started.\n");
        await Utilities.sleep(250);

        expect(
          server.debuggerLifecycle.stage,
          "preflight must not fail on the setting the effective operation ignores"
        ).to.not.equal(DebuggerLifecycleStage.failed);
        expect(server.debuggerLifecycle.failureKind).to.equal(DebuggerFailureKind.none);
      } finally {
        server.cancelDebuggerWork("settings test cleanup");
        server.stopPlayerPositionPolling();
        stdout.end();
        await outputDone;
      }
    });

    it("diagnostics report the persisted values the setup acted on, not in-memory defaults", async function () {
      // Regression: getDebugDiagnostics() copied the in-memory
      // ServerPropertiesManager write-intent defaults (true), so a
      // persisted =false correctly failed the settings stage while the
      // copied diagnostics claimed the same setting was enabled.
      const server = await createSettingsServer(
        "settings-diagnostics-truth",
        "# Generated by Minecraft Creator Tools\n" +
          "allow-inbound-script-debugging=false\n" +
          "allow-outbound-script-debugging=true\n"
      );

      // Before any setup has read the file the values are unknown - never
      // the write-intent defaults.
      expect(server.getDebugDiagnostics().inboundScriptDebuggingEnabled).to.be.undefined;
      expect(server.getDebugDiagnostics().outboundScriptDebuggingEnabled).to.be.undefined;

      const stdout = new PassThrough();
      const outputDone = server.directOutput(stdout);

      try {
        stdout.write("Server started.\n");
        await Utilities.sleep(250);

        expect(server.debuggerLifecycle.stage).to.equal(DebuggerLifecycleStage.failed);

        const diagnostics = server.getDebugDiagnostics();

        expect(
          diagnostics.inboundScriptDebuggingEnabled,
          "diagnostics must report the persisted false that failed the stage"
        ).to.be.false;
        expect(
          diagnostics.outboundScriptDebuggingEnabled,
          "the other direction's persisted value is captured by the same read"
        ).to.be.true;
        // The in-memory write-intent default still claims true - proving
        // diagnostics no longer copy it.
        expect(server.properties.allowInboundScriptDebugging).to.be.true;
      } finally {
        server.cancelDebuggerWork("settings test cleanup");
        server.stopPlayerPositionPolling();
        stdout.end();
        await outputDone;
      }
    });

    it("a superseded setup's delayed reads cannot overwrite the winning run's effective values", async function () {
      // Regression: beginDebuggerSetup published its persisted reads into
      // the effective-values cache BEFORE its freshness guard. A setup whose
      // reads were still pending when a restart superseded it would assign
      // #effectiveInbound/OutboundScriptDebugging - possibly from an older
      // file state - and only then return at the guard, overwriting the
      // winning run's diagnostics.
      const server = await createSettingsServer(
        "settings-superseded-reads",
        "# Generated by Minecraft Creator Tools\nallow-inbound-script-debugging=true\n"
      );

      // Run A's first read parks on a gate until run B has published; after
      // the gate opens, staleMode makes A's reads describe a DIFFERENT
      // (stale) file state, so an overwrite is observable.
      let releaseFirstRead: () => void = () => {};
      const firstReadGate = new Promise<void>((resolve) => (releaseFirstRead = resolve));
      let staleMode = false;
      let inboundReads = 0;

      (server.properties as any).readPersistedAllowInboundScriptDebugging = async () => {
        inboundReads++;

        if (inboundReads === 1) {
          await firstReadGate;
        }

        return !staleMode;
      };
      (server.properties as any).readPersistedAllowOutboundScriptDebugging = async () => {
        return !staleMode;
      };

      const stdout = new PassThrough();
      const outputDone = server.directOutput(stdout);

      try {
        // Run A: setup begins and parks inside its first persisted read.
        stdout.write("Server started.\n");
        await Utilities.sleep(100);

        // Run B supersedes (a second start increments #starts) and
        // publishes its effective values.
        stdout.write("Server started.\n");
        await Utilities.sleep(250);

        expect(server.getDebugDiagnostics().inboundScriptDebuggingEnabled, "run B must publish its values").to.be.true;
        expect(server.getDebugDiagnostics().outboundScriptDebuggingEnabled).to.be.true;

        // Release run A's pending reads, now describing stale file state.
        staleMode = true;
        releaseFirstRead();
        await Utilities.sleep(250);

        expect(
          server.getDebugDiagnostics().inboundScriptDebuggingEnabled,
          "a superseded setup must not overwrite the winning run's effective values"
        ).to.be.true;
        expect(server.getDebugDiagnostics().outboundScriptDebuggingEnabled).to.be.true;
      } finally {
        server.cancelDebuggerWork("settings test cleanup");
        server.stopPlayerPositionPolling();
        stdout.end();
        await outputDone;
      }
    });

    it("a settings read pending when stop begins cannot republish diagnostics or re-arm the listener", async function () {
      this.timeout(15000);

      // Regression: a graceful stop leaves #status "started" and #starts
      // unchanged until the process exits, so a persisted-settings read
      // already pending when cancelDebuggerWork() ran passed the freshness
      // guard, republished the effective values, and re-armed
      // startDebuggerListener while the lifecycle was stopping - reviving
      // work the stop explicitly canceled. The guards now also reject the
      // stopping/idle lifecycle stages, like the reconnect scheduler.
      const server = await createSettingsServer(
        "settings-stop-pending-read",
        "# Generated by Minecraft Creator Tools\nallow-inbound-script-debugging=true\n"
      );

      let releaseRead: () => void = () => {};
      const readGate = new Promise<void>((resolve) => (releaseRead = resolve));

      (server.properties as any).readPersistedAllowInboundScriptDebugging = async () => {
        await readGate;
        return true;
      };
      (server.properties as any).readPersistedAllowOutboundScriptDebugging = async () => true;

      const stdout = new PassThrough();
      const outputDone = server.directOutput(stdout);

      try {
        // Setup begins and parks inside its persisted read.
        stdout.write("Server started.\n");
        await Utilities.sleep(100);

        // Stop begins while the read is pending. Status stays "started".
        server.cancelDebuggerWork("server stop requested");
        expect(server.debuggerLifecycle.stage).to.equal(DebuggerLifecycleStage.stopping);
        expect(server.status).to.equal(DedicatedServerStatus.started);

        // The parked read completes AFTER the stop began.
        releaseRead();
        await Utilities.sleep(250);

        expect(
          server.getDebugDiagnostics().inboundScriptDebuggingEnabled,
          "a read pending at stop must not republish effective values"
        ).to.be.undefined;

        // Wait out the listen-delay window: pre-fix, the continuation armed
        // the delay timer, whose callback then re-ran startDebuggerListener
        // and moved the stage off "stopping".
        await Utilities.sleep(3400);

        expect(
          server.debuggerLifecycle.stage,
          "a read pending at stop must not revive the canceled listener flow"
        ).to.equal(DebuggerLifecycleStage.stopping);
      } finally {
        server.cancelDebuggerWork("settings test cleanup");
        server.stopPlayerPositionPolling();
        stdout.end();
        await outputDone;
      }
    });

    it("a persisted allow-inbound-script-debugging=true proceeds past verification", async function () {
      const server = await createSettingsServer(
        "settings-inbound-true",
        "# Generated by Minecraft Creator Tools\nallow-inbound-script-debugging=true\n"
      );

      const stdout = new PassThrough();
      const outputDone = server.directOutput(stdout);

      try {
        stdout.write("Server started.\n");
        await Utilities.sleep(250);

        expect(server.debuggerLifecycle.stage, "verification must not fail a correctly-configured run").to.equal(
          DebuggerLifecycleStage.configuring
        );
      } finally {
        server.cancelDebuggerWork("settings test cleanup");
        server.stopPlayerPositionPolling();
        stdout.end();
        await outputDone;
      }
    });
  });

  describe("Stop cancels debugger work", function () {
    /**
     * Deferred regressions for the graceful-stop window: #status stays
     * "started" from the stop request until the BDS process exits, so status
     * checks alone cannot keep armed reconnect timers or in-flight TCP retry
     * loops from acting after a stop. Each test induces pending debugger work,
     * begins the stop (cancelDebuggerWork - invoked by stopServer the moment
     * a stop is requested), lets the deferred work's schedule elapse, and
     * proves no later connection or stage transition occurs.
     */

    it("stop during the reconnect backoff cancels the armed reconnect", async function () {
      const env: ITestEnvironment = await TestPaths.createTestEnvironment();
      const dsm = new ServerManager(env.localEnv, env.creatorTools);
      const server = new DedicatedServer("stop-backoff-test", dsm, env.localEnv, "stop-backoff-path", env.resultsFolder);
      server.debugOutboundConnect = false; // these tests exercise the legacy inbound listen flow
      server.port = 19788 - 12; // debugPort = base port + 12 = 19788

      // Nothing must ever connect to the debug endpoint after the stop.
      const mockServer = new MockMinecraftDebugServer(19788);
      await mockServer.start();

      const stdout = new PassThrough();
      const outputDone = server.directOutput(stdout);

      try {
        // Simulate BDS reaching "Server started." - the run state during
        // which a graceful stop leaves #status at "started".
        stdout.write("Server started.\n");
        await Utilities.sleep(200);
        expect(server.status).to.equal(DedicatedServerStatus.started);

        // A debugger drop arms a reconnect (first backoff: 2s)...
        (server as any).scheduleDebugReconnect(DebuggerFailureKind.prematureClose, "test-induced drop");
        expect(server.debuggerLifecycle.stage).to.equal(DebuggerLifecycleStage.reconnecting);

        // ...and the user stops the server before the backoff elapses.
        server.cancelDebuggerWork("server stop requested");
        expect(server.debuggerLifecycle.stage).to.equal(DebuggerLifecycleStage.stopping);

        const transitionsAfterStop: DebuggerLifecycleStage[] = [];
        server.debuggerLifecycle.onStageChanged.subscribe((_tracker, data) => {
          transitionsAfterStop.push(data.stage);
        });

        // Elapse the armed reconnect backoff (2s) AND the listener delay
        // timer beginDebuggerSetup arms (3s), with margin.
        await Utilities.sleep(4000);

        expect(transitionsAfterStop, "no stage transition may occur after stop begins").to.deep.equal([]);
        expect(server.debuggerLifecycle.stage).to.equal(DebuggerLifecycleStage.stopping);
        expect(mockServer.clientCount, "no debug connection may occur after stop begins").to.equal(0);
      } finally {
        server.stopPlayerPositionPolling();
        server.cancelDebuggerWork("test cleanup");
        stdout.end();
        await outputDone;
        await mockServer.stop();
      }
    });

    it("stop during the TCP retry loop aborts the pending attempt", async function () {
      const env: ITestEnvironment = await TestPaths.createTestEnvironment();
      const dsm = new ServerManager(env.localEnv, env.creatorTools);
      const server = new DedicatedServer(
        "stop-tcpretry-test",
        dsm,
        env.localEnv,
        "stop-tcpretry-path",
        env.resultsFolder
      );
      server.debugOutboundConnect = false; // these tests exercise the legacy inbound listen flow
      server.port = 19789 - 12; // debugPort = base port + 12 = 19789

      // Nothing is listening yet, so connectDebugClient enters its TCP retry
      // loop (dials at ~0s, 1s, 3s, 7s, 15s).
      const connectPromise = server.connectDebugClient();
      await Utilities.sleep(1500);
      expect(server.debuggerLifecycle.stage).to.equal(DebuggerLifecycleStage.connectingTcp);

      // Stop begins mid-retry...
      server.cancelDebuggerWork("server stop requested");
      expect(server.debuggerLifecycle.stage).to.equal(DebuggerLifecycleStage.stopping);

      const transitionsAfterStop: DebuggerLifecycleStage[] = [];
      server.debuggerLifecycle.onStageChanged.subscribe((_tracker, data) => {
        transitionsAfterStop.push(data.stage);
      });

      // ...then the endpoint comes up, as it would when the server restarts.
      // The canceled attempt must not attach to it and take its single slot.
      const mockServer = new MockMinecraftDebugServer(19789);
      await mockServer.start();

      // Cover the canceled loop's remaining dial schedule (~3s and ~7s).
      await Utilities.sleep(7000);
      await connectPromise;

      expect(mockServer.clientCount, "canceled TCP retry must never attach").to.equal(0);
      expect(transitionsAfterStop, "no stage transition may occur after stop begins").to.deep.equal([]);
      expect(server.debuggerLifecycle.stage).to.equal(DebuggerLifecycleStage.stopping);

      await mockServer.stop();
    });
  });

  describe("Socket identity across reconnect", function () {
    it("a stale socket's delayed close cannot tear down the replacement session", function () {
      // Regression: session socket handlers were not identity-gated and a
      // torn-down socket's listeners stayed attached. Node defers "close" to
      // a later tick, so after disconnect-then-reconnect, old socket A's
      // buffered close arrived while replacement socket B was mid-handshake:
      // _handleDisconnect() destroyed this._socket - by then B - and killed
      // the replacement session.
      const client = new MinecraftDebugClient();
      const anyClient = client as any;

      const disconnects: string[] = [];
      client.onDisconnected.subscribe((_c, reason) => disconnects.push(reason));

      const socketA = new Socket();
      const socketB = new Socket();

      // A session on socket A...
      anyClient._state = DebugConnectionState.Connecting;
      anyClient._beginSession(socketA);

      // ...is torn down (the teardown detaches A's listeners)...
      anyClient.disconnectWithError("Inert test teardown of socket A");
      expect(disconnects).to.have.length(1);

      // ...and a replacement session begins its handshake on socket B.
      anyClient._state = DebugConnectionState.Connecting;
      anyClient._beginSession(socketB);

      // A's deferred close arrives late: the replacement must be untouched.
      socketA.emit("close");

      expect(anyClient._state, "the replacement session must stay in its handshake").to.equal(
        DebugConnectionState.Connecting
      );
      expect(socketB.destroyed, "the replacement socket must not be destroyed").to.equal(false);
      expect(disconnects, "no second disconnect may be dispatched").to.have.length(1);

      // B's OWN close still ends the session normally.
      socketB.emit("close");
      expect(disconnects).to.deep.equal(["Inert test teardown of socket A", "Socket closed"]);
    });

    it("a superseded socket is identity-gated even when its listeners were never detached", function () {
      // Second line of defense behind the teardown detach: with A's
      // listeners still attached, A's events must neither end the session
      // nor feed the parser once B is the active socket.
      const client = new MinecraftDebugClient();
      const anyClient = client as any;

      const disconnects: string[] = [];
      client.onDisconnected.subscribe((_c, reason) => disconnects.push(reason));

      const socketA = new Socket();
      const socketB = new Socket();

      anyClient._state = DebugConnectionState.Connecting;
      anyClient._beginSession(socketA);
      anyClient._beginSession(socketB);

      socketA.emit("close");
      socketA.emit("data", Buffer.from("00000003\n{}\n"));

      expect(anyClient._state, "the active session must stay in its handshake").to.equal(
        DebugConnectionState.Connecting
      );
      expect(socketB.destroyed).to.equal(false);
      expect(disconnects).to.have.length(0);

      client.disconnect();
      expect(disconnects).to.deep.equal(["Client requested disconnect"]);
    });
  });

  describe("DebugMessageStreamParser", function () {
    it("should parse valid length-prefixed messages", function () {
      const parser = new DebugMessageStreamParser();
      const messages: unknown[] = [];

      parser.onMessage.subscribe((_, msg) => {
        messages.push(msg);
      });

      // Create a valid message
      const envelope = { type: "event", event: { type: "TestEvent" } };
      const json = JSON.stringify(envelope);
      const jsonBuffer = Buffer.from(json);
      const messageLength = jsonBuffer.byteLength + 1;
      let lengthStr = "00000000" + messageLength.toString(16) + "\n";
      lengthStr = lengthStr.substring(lengthStr.length - 9);

      const buffer = Buffer.concat([Buffer.from(lengthStr), jsonBuffer, Buffer.from("\n")]);

      parser.write(buffer);

      expect(messages.length).to.equal(1);
      expect((messages[0] as any).type).to.equal("event");
    });

    it("should handle fragmented messages", function () {
      const parser = new DebugMessageStreamParser();
      const messages: unknown[] = [];

      parser.onMessage.subscribe((_, msg) => {
        messages.push(msg);
      });

      const envelope = { type: "event", event: { type: "FragmentedTest" } };
      const json = JSON.stringify(envelope);
      const jsonBuffer = Buffer.from(json);
      const messageLength = jsonBuffer.byteLength + 1;
      let lengthStr = "00000000" + messageLength.toString(16) + "\n";
      lengthStr = lengthStr.substring(lengthStr.length - 9);

      const fullBuffer = Buffer.concat([Buffer.from(lengthStr), jsonBuffer, Buffer.from("\n")]);

      // Send in fragments
      parser.write(fullBuffer.slice(0, 5));
      expect(messages.length).to.equal(0);

      parser.write(fullBuffer.slice(5, 15));
      expect(messages.length).to.equal(0);

      parser.write(fullBuffer.slice(15));
      expect(messages.length).to.equal(1);
    });

    it("should handle multiple messages in one buffer", function () {
      const parser = new DebugMessageStreamParser();
      const messages: unknown[] = [];

      parser.onMessage.subscribe((_, msg) => {
        messages.push(msg);
      });

      function createMessage(type: string): Buffer {
        const envelope = { type: "event", event: { type } };
        const json = JSON.stringify(envelope);
        const jsonBuffer = Buffer.from(json);
        const messageLength = jsonBuffer.byteLength + 1;
        let lengthStr = "00000000" + messageLength.toString(16) + "\n";
        lengthStr = lengthStr.substring(lengthStr.length - 9);
        return Buffer.concat([Buffer.from(lengthStr), jsonBuffer, Buffer.from("\n")]);
      }

      const combined = Buffer.concat([createMessage("First"), createMessage("Second"), createMessage("Third")]);

      parser.write(combined);

      expect(messages.length).to.equal(3);
    });

    it("should reset state on parser.reset()", function () {
      const parser = new DebugMessageStreamParser();

      // Write partial data
      parser.write(Buffer.from("00000"));

      parser.reset();

      // Now write a complete message
      const messages: unknown[] = [];
      parser.onMessage.subscribe((_, msg) => {
        messages.push(msg);
      });

      const envelope = { type: "event", event: { type: "AfterReset" } };
      const json = JSON.stringify(envelope);
      const jsonBuffer = Buffer.from(json);
      const messageLength = jsonBuffer.byteLength + 1;
      let lengthStr = "00000000" + messageLength.toString(16) + "\n";
      lengthStr = lengthStr.substring(lengthStr.length - 9);

      const buffer = Buffer.concat([Buffer.from(lengthStr), jsonBuffer, Buffer.from("\n")]);
      parser.write(buffer);

      expect(messages.length).to.equal(1);
    });
  });

  describe("Socket identity across reconnect", function () {
    it("a stale socket's delayed close cannot tear down the replacement session", function () {
      // Regression: session socket handlers were not identity-gated and a
      // torn-down socket's listeners stayed attached. Node defers "close" to
      // a later tick, so after disconnect-then-reconnect, old socket A's
      // buffered close arrived while replacement socket B was mid-handshake:
      // _handleDisconnect() destroyed this._socket - by then B - and killed
      // the replacement session.
      const client = new MinecraftDebugClient();
      const anyClient = client as any;

      const disconnects: string[] = [];
      client.onDisconnected.subscribe((_c, reason) => disconnects.push(reason));

      const socketA = new Socket();
      const socketB = new Socket();

      // A session on socket A...
      anyClient._state = DebugConnectionState.Connecting;
      anyClient._beginSession(socketA);

      // ...is torn down (the teardown detaches A's listeners)...
      anyClient.disconnectWithError("Inert test teardown of socket A");
      expect(disconnects).to.have.length(1);

      // ...and a replacement session begins its handshake on socket B.
      anyClient._state = DebugConnectionState.Connecting;
      anyClient._beginSession(socketB);

      // A's deferred close arrives late: the replacement must be untouched.
      socketA.emit("close");

      expect(anyClient._state, "the replacement session must stay in its handshake").to.equal(
        DebugConnectionState.Connecting
      );
      expect(socketB.destroyed, "the replacement socket must not be destroyed").to.equal(false);
      expect(disconnects, "no second disconnect may be dispatched").to.have.length(1);

      // B's OWN close still ends the session normally.
      socketB.emit("close");
      expect(disconnects).to.deep.equal(["Inert test teardown of socket A", "Socket closed"]);
    });

    it("a superseded socket is identity-gated even when its listeners were never detached", function () {
      // Second line of defense behind the teardown detach: with A's
      // listeners still attached, A's events must neither end the session
      // nor feed the parser once B is the active socket.
      const client = new MinecraftDebugClient();
      const anyClient = client as any;

      const disconnects: string[] = [];
      client.onDisconnected.subscribe((_c, reason) => disconnects.push(reason));

      const socketA = new Socket();
      const socketB = new Socket();

      anyClient._state = DebugConnectionState.Connecting;
      anyClient._beginSession(socketA);
      anyClient._beginSession(socketB);

      socketA.emit("close");
      socketA.emit("data", Buffer.from("00000003\n{}\n"));

      expect(anyClient._state, "the active session must stay in its handshake").to.equal(
        DebugConnectionState.Connecting
      );
      expect(socketB.destroyed).to.equal(false);
      expect(disconnects).to.have.length(0);

      client.disconnect();
      expect(disconnects).to.deep.equal(["Client requested disconnect"]);
    });
  });

  describe("DebugRequestManager", function () {
    it("allocates monotonically increasing sequence numbers", function () {
      const manager = new DebugRequestManager();

      const first = manager.allocateSequence();
      const second = manager.allocateSequence();
      const third = manager.allocateSequence();

      expect(second).to.equal(first + 1);
      expect(third).to.equal(second + 1);
    });

    it("resolves a tracked request with the response body", async function () {
      const manager = new DebugRequestManager();
      const seq = manager.allocateSequence();

      const promise = manager.track(seq, "getState", 5000);

      expect(manager.pendingCount).to.equal(1);
      expect(manager.resolveResponse(seq, true, { state: "ok" })).to.be.true;

      expect(await promise).to.deep.equal({ state: "ok" });
      expect(manager.pendingCount).to.equal(0);
    });

    it("rejects a response with an absent success flag (only explicit true resolves)", async function () {
      // Mirrors the official request-manager: reject on !success. A
      // malformed response, or a failure that carries response_message but
      // omits success, must never settle as success.
      const manager = new DebugRequestManager();
      const seq = manager.allocateSequence();

      const promise = manager.track(seq, "getState", 5000);
      manager.resolveResponse(seq, undefined, { state: "ok" });

      try {
        await promise;
        assert.fail("should have rejected");
      } catch (e: any) {
        expect(e).to.be.instanceOf(DebugRequestError);
        expect(e.kind).to.equal("rejected");
        expect(e.message).to.include("did not report success");
      }
      expect(manager.pendingCount).to.equal(0);
    });

    it("rejects a flagless response with the supplied peer message", async function () {
      const manager = new DebugRequestManager();
      const seq = manager.allocateSequence();

      const promise = manager.track(seq, "enableProfiler", 5000);
      manager.resolveResponse(seq, undefined, undefined, "profiler not available");

      try {
        await promise;
        assert.fail("should have rejected");
      } catch (e: any) {
        expect(e).to.be.instanceOf(DebugRequestError);
        expect(e.message).to.include("profiler not available");
      }
    });

    it("rejects a failed request with the peer-reported message", async function () {
      const manager = new DebugRequestManager();
      const seq = manager.allocateSequence();

      const promise = manager.track(seq, "setBreakpoint", 5000);
      manager.resolveResponse(seq, false, undefined, "not allowed");

      try {
        await promise;
        assert.fail("should have rejected");
      } catch (e: any) {
        expect(e).to.be.instanceOf(DebugRequestError);
        expect(e.kind).to.equal("rejected");
        expect(e.command).to.equal("setBreakpoint");
        expect(e.message).to.include("not allowed");
      }
      expect(manager.pendingCount).to.equal(0);
    });

    it("times out a request with an actionable error and no leak", async function () {
      const manager = new DebugRequestManager();
      const seq = manager.allocateSequence();

      const promise = manager.track(seq, "slowRequest", 100);

      try {
        await promise;
        assert.fail("should have timed out");
      } catch (e: any) {
        expect(e).to.be.instanceOf(DebugRequestError);
        expect(e.kind).to.equal("timeout");
        expect(e.message).to.include("slowRequest");
        expect(e.message).to.include("100ms");
      }

      expect(manager.pendingCount).to.equal(0);
      // A late response after the timeout is an unknown sequence.
      expect(manager.resolveResponse(seq, true, {})).to.be.false;
    });

    it("returns false for an unknown request sequence", function () {
      const manager = new DebugRequestManager();

      expect(manager.resolveResponse(12345, true, {})).to.be.false;
    });

    it("rejectSendFailure settles one tracked request immediately and clears its timeout", async function () {
      const manager = new DebugRequestManager();
      const seq = manager.allocateSequence();

      const promise = manager.track(seq, "getState", 5000);
      expect(manager.pendingCount).to.equal(1);

      expect(manager.rejectSendFailure(seq, "circular structure in args")).to.be.true;
      expect(manager.pendingCount, "the unsendable request must not stay pending until its timeout").to.equal(0);

      try {
        await promise;
        assert.fail("should have rejected");
      } catch (e: any) {
        expect(e).to.be.instanceOf(DebugRequestError);
        expect(e.kind).to.equal("sendFailure");
        expect(e.message).to.include("could not be sent");
        expect(e.message).to.include("circular structure in args");
      }

      // Already settled: a second rejection attempt is a no-op.
      expect(manager.rejectSendFailure(seq, "again")).to.be.false;
    });

    it("rejects every pending request on rejectAll and clears state", async function () {
      const manager = new DebugRequestManager();

      const seqA = manager.allocateSequence();
      const seqB = manager.allocateSequence();

      const outcomes = Promise.all(
        [manager.track(seqA, "a", 60000), manager.track(seqB, "b", 60000)].map((p) =>
          p.then(
            () => "resolved",
            (e: any) => e
          )
        )
      );

      expect(manager.pendingCount).to.equal(2);
      manager.rejectAll("Socket closed");

      for (const outcome of await outcomes) {
        expect(outcome).to.be.instanceOf(DebugRequestError);
        expect((outcome as DebugRequestError).kind).to.equal("disconnected");
        expect((outcome as DebugRequestError).message).to.include("Socket closed");
      }

      expect(manager.pendingCount).to.equal(0);
      expect(manager.resolveResponse(seqA, true, {}), "cleared requests must not resolve later").to.be.false;
    });
  });

  describe("DebugMessageStreamParser framing errors", function () {
    function collectErrors(parser: DebugMessageStreamParser): string[] {
      const errors: string[] = [];
      parser.onError.subscribe((_, error) => {
        errors.push(error.message);
      });
      return errors;
    }

    it("reports an actionable error for a non-framing byte stream", function () {
      const parser = new DebugMessageStreamParser();
      const errors = collectErrors(parser);

      parser.write(Buffer.from("HTTP/1.1 400 Bad Request\r\n"));

      expect(errors.length).to.be.greaterThan(0);
      expect(errors[0]).to.include("Malformed frame header");
      expect(errors[0], "the error must show what arrived").to.include("HTTP/1.1");
    });

    it("rejects a length header that is not exactly 8 hex digits", function () {
      const parser = new DebugMessageStreamParser();
      const errors = collectErrors(parser);

      // parseInt would silently accept this as 4; the parser must not.
      parser.write(Buffer.from("0000004Z\n{}\n"));

      expect(errors.some((m) => m.includes("expected exactly 8 hexadecimal digits"))).to.be.true;
    });

    it("refuses an absurd frame length instead of waiting forever", function () {
      const parser = new DebugMessageStreamParser();
      const errors = collectErrors(parser);

      parser.write(Buffer.from("7fffffff\n"));

      expect(errors.some((m) => m.includes(`${MAX_DEBUG_MESSAGE_LENGTH}-byte maximum`))).to.be.true;
    });

    it("reports an actionable error for a non-JSON frame body", function () {
      const parser = new DebugMessageStreamParser();
      const errors = collectErrors(parser);

      const body = "this is not json\n";
      const lengthStr = ("00000000" + body.length.toString(16)).slice(-8);
      parser.write(Buffer.from(lengthStr + "\n" + body));

      expect(errors.some((m) => m.includes("Malformed frame body") && m.includes("this is not json"))).to.be.true;
    });

    it("a fatal parse error drops frames buffered behind the malformed one and stops the stream", function () {
      // Regression: after dispatching onError (which synchronously tears
      // the session down upstream), the parser kept processing the buffer
      // and delivered a valid frame that arrived in the SAME socket chunk
      // as the malformed one - publishing stale stats into a session that
      // had already disconnected.
      const parser = new DebugMessageStreamParser();
      const errors = collectErrors(parser);
      const messages: unknown[] = [];

      parser.onMessage.subscribe((_, msg) => {
        messages.push(msg);
      });

      const frame = (json: string) =>
        ("00000000" + (Buffer.from(json).byteLength + 1).toString(16)).slice(-8) + "\n" + json + "\n";

      const badBody = "this is not json\n";
      const badFrame = ("00000000" + badBody.length.toString(16)).slice(-8) + "\n" + badBody;
      const statJson = JSON.stringify({ type: "event", event: { type: "StatEvent2", tick: 42, stats: [] } });

      // One socket chunk: a malformed-JSON frame, then a valid StatEvent2.
      parser.write(Buffer.from(badFrame + frame(statJson)));

      expect(errors.length).to.equal(1);
      expect(messages.length, "the frame buffered behind the malformed one must not be delivered").to.equal(0);

      // Late socket data racing the teardown is dropped, not parsed.
      parser.write(Buffer.from(frame(statJson)));
      expect(messages.length).to.equal(0);

      // reset() - a new session beginning - revives the parser.
      parser.reset();
      parser.write(Buffer.from(frame(statJson)));
      expect(messages.length).to.equal(1);
    });

    it("parses messages split across the length header and body boundaries", function () {
      const parser = new DebugMessageStreamParser();
      const messages: unknown[] = [];

      parser.onMessage.subscribe((_, msg) => {
        messages.push(msg);
      });

      const envelope = { type: "event", event: { type: "SplitTest" } };
      const json = JSON.stringify(envelope);
      const messageLength = Buffer.from(json).byteLength + 1;
      const frame = Buffer.from(("00000000" + messageLength.toString(16)).slice(-8) + "\n" + json + "\n");

      // One byte at a time: worst-case TCP fragmentation.
      for (let i = 0; i < frame.length; i++) {
        parser.write(frame.subarray(i, i + 1));
      }

      expect(messages.length).to.equal(1);
      expect((messages[0] as any).event.type).to.equal("SplitTest");
    });
  });

  describe("Session Info Export", function () {
    it("should provide complete session info for HTTP API", async function () {
      const mockServer = new MockMinecraftDebugServer(19210, ProtocolVersion.SupportProfilerCaptures);
      await mockServer.start();

      const client = new MinecraftDebugClient();
      await client.connect("localhost", 19210);
      await Utilities.sleep(500);

      // Send some stats to update lastStatTick with proper IStatData structure
      const testStat: IStatData = {
        name: "TestStat",
        parent_name: "",
        id: "test_stat",
        full_id: "test_stat",
        parent_id: "",
        parent_full_id: "",
        values: [42],
        children_string_values: [],
        should_aggregate: false,
        tick: 100,
      };
      mockServer.sendStatEvent(100, [testStat]);
      await Utilities.sleep(200);

      const sessionInfo = client.sessionInfo;

      // Verify all fields expected by ISlotConfig are present
      expect(sessionInfo).to.have.property("state");
      expect(sessionInfo).to.have.property("protocolVersion");
      expect(sessionInfo).to.have.property("lastStatTick");
      expect(sessionInfo).to.have.property("host");
      expect(sessionInfo).to.have.property("port");
      expect(sessionInfo).to.have.property("plugins");
      expect(sessionInfo).to.have.property("capabilities");

      expect(sessionInfo.state).to.equal(DebugConnectionState.Connected);
      expect(sessionInfo.protocolVersion).to.equal(ProtocolVersion.SupportProfilerCaptures);
      expect(sessionInfo.lastStatTick).to.equal(100);

      client.disconnect();
      await mockServer.stop();
    });

    it("should map connection state to readable string", function () {
      function getConnectionStateString(state: DebugConnectionState): string {
        switch (state) {
          case DebugConnectionState.Disconnected:
            return "disconnected";
          case DebugConnectionState.Connecting:
            return "connecting";
          case DebugConnectionState.Connected:
            return "connected";
          case DebugConnectionState.Error:
            return "error";
          default:
            return "unknown";
        }
      }

      expect(getConnectionStateString(DebugConnectionState.Disconnected)).to.equal("disconnected");
      expect(getConnectionStateString(DebugConnectionState.Connecting)).to.equal("connecting");
      expect(getConnectionStateString(DebugConnectionState.Connected)).to.equal("connected");
      expect(getConnectionStateString(DebugConnectionState.Error)).to.equal("error");
    });
  });
});

/**
 * Integration tests that require more infrastructure
 * These are marked with .skip() by default and can be run manually
 */
describe("DebugAdapter Integration", function () {
  this.timeout(120000); // Integration tests need longer timeout

  describe.skip("Full serve command flow", function () {
    // These tests would require:
    // 1. A real Bedrock Dedicated Server installation
    // 2. The serve command to be run
    // 3. Actual connection to the debug port

    it("should connect debug adapter after BDS starts", async function () {
      // This test would:
      // 1. Spawn the serve command with --debug-streaming
      // 2. Wait for BDS to start
      // 3. Verify debug client connects
      // 4. Verify stats are received
      // 5. Verify stats are broadcast via WebSocket

      // For now, this is a placeholder for manual testing
      this.skip();
    });

    it("should handle --no-debug-streaming flag", async function () {
      // This test would verify that when --no-debug-streaming is passed,
      // no debug client connection is attempted

      this.skip();
    });

    it("should report debug status via HTTP API", async function () {
      // This test would:
      // 1. Start serve with debug streaming
      // 2. Call GET /api/{slot}/status
      // 3. Verify debugConnectionState is present
      // 4. Verify debugProtocolVersion is present

      this.skip();
    });
  });
});
describe("Debug listener handoff (streaming disabled)", function () {
  this.timeout(30000);

  /**
   * The MinecraftDebuggerHandoffNotice prescribes: turn off
   * enableDebuggerStreaming, restart the server, then attach the official
   * VS Code Minecraft Debugger extension. That handoff only works if opening
   * the BDS listener is decoupled from MCT's own diagnostics client: with
   * enableDebugger=true and enableDebuggerStreaming=false, the
   * `script debugger listen` command must still be issued on the
   * slot-derived port, while MCT must NOT connect its own client - leaving
   * the single permitted debug socket free for the extension.
   */
  it("still opens the BDS listener and leaves the socket free for the official extension", async function () {
    const env = await TestPaths.createTestEnvironment();
    const dsm = new ServerManager(env.localEnv, env.creatorTools);
    const server = new DedicatedServer("handoff-test", dsm, env.localEnv, "handoff-path", env.resultsFolder);
    server.port = 19228; // slot-derived debug port = 19228 + 12 = 19240

    server.debuggerEnabled = true;
    server.debuggerStreamingEnabled = false;
    // The handoff leaves a BDS-side listener open for the external debugger,
    // which only exists in the inbound direction ('script debugger listen');
    // the default outbound direction has no BDS-side listener to hand off.
    server.debugOutboundConnect = false;

    const commands: string[] = [];
    (server as any).runCommand = async (command: string) => {
      commands.push(command);
    };

    const stdout = new PassThrough();
    const outputDone = server.directOutput(stdout);

    try {
      stdout.write("Server started.\n");

      // The listen command is issued on a 3-second delay after server start.
      await Utilities.sleep(4000);

      expect(commands, "the listener must be opened even with streaming disabled").to.include(
        "script debugger listen 19240"
      );

      // BDS confirms the listener; MCT must NOT connect its own client.
      stdout.write("Debugger listening on port 19240\n");
      await Utilities.sleep(500);

      expect(server.debugClient, "MCT must not occupy the debug socket when streaming is off").to.be.undefined;

      // The official extension (an external client) can occupy the socket:
      // simulate BDS's listener on the same port and attach an external
      // debug client - nothing from MCT contends for the single permitted
      // connection.
      const bdsListener = new MockMinecraftDebugServer(19240);
      await bdsListener.start();

      const extensionClient = new MinecraftDebugClient();
      await extensionClient.connect("localhost", 19240);
      await Utilities.sleep(400);

      expect(extensionClient.isConnected, "the official extension must be able to attach").to.be.true;
      expect(bdsListener.clientCount, "only the external debugger occupies the socket").to.equal(1);
      expect(server.debugClient, "MCT must still not have connected").to.be.undefined;

      extensionClient.disconnect();
      await bdsListener.stop();
    } finally {
      server.stopPlayerPositionPolling();
      stdout.end();
      await outputDone;
    }
  });

  it("outbound mode with streaming disabled still arms the BDS listener for the external debugger", async function () {
    // Regression: in outbound mode the streaming-off branch returned without
    // reserving a port or issuing any listen command, so the handoff
    // guidance's promise - disable MCT streaming and BDS keeps listening for
    // the official extension - was non-functional: VS Code had nothing to
    // attach to. The flow must arm the inbound listener (used by nothing
    // else while streaming is off) and park at idle with the socket free.
    const env = await TestPaths.createTestEnvironment();
    const dsm = new ServerManager(env.localEnv, env.creatorTools);
    const server = new DedicatedServer("handoff-outbound-test", dsm, env.localEnv, "handoff-outbound-path", env.resultsFolder);
    server.port = 19274 - 12; // slot-derived debug port = 19274... listen port = base + 12 = 19274

    server.debuggerEnabled = true;
    server.debuggerStreamingEnabled = false;
    server.debugOutboundConnect = true;

    const commands: string[] = [];
    (server as any).runCommand = async (command: string) => {
      commands.push(command);
    };

    const stdout = new PassThrough();
    const outputDone = server.directOutput(stdout);

    try {
      stdout.write("Server started.\n");

      // The listen command is issued on a 3-second delay after server start.
      await Utilities.sleep(4000);

      const listenCommand = commands.find((c) => c.startsWith("script debugger listen"));
      expect(listenCommand, "the listener must be armed even in outbound mode when streaming is off").to.not.be
        .undefined;

      const listenPort = parseInt(listenCommand!.split(" ").pop() as string, 10);

      // BDS confirms the listener; MCT must park at idle without connecting
      // its own client - the socket stays free for the official extension.
      stdout.write(`Debugger listening on port ${listenPort}\n`);
      await Utilities.sleep(500);

      expect(server.debuggerLifecycle.stage, "the flow must settle at idle with the listener armed").to.equal(
        DebuggerLifecycleStage.idle
      );
      expect(server.debugClient, "MCT must not occupy the debug socket when streaming is off").to.be.undefined;
    } finally {
      server.cancelDebuggerWork("handoff-outbound test cleanup");
      server.stopPlayerPositionPolling();
      DebugPortRegistry.releaseAllForOwner("handoff-outbound-path");
      stdout.end();
      await outputDone;
    }
  });
});


describe("Electron debug IPC preload boundary", function () {
  // AppServiceProxy.sendAsync sends "async<command>|<position>" through the
  // preload whitelist; a command absent from preload.ts throws "PLD: Unknown
  // command" in the renderer even when the main process registered a handler
  // for it - a handler-only test cannot catch that. This static source check
  // keeps the enum, the preload whitelist, and the main-process registrations
  // in sync so a new debug command cannot silently break the Electron path
  // (e.g., asyncgetDebugStatus, which powers late-mount hydration).
  it("whitelists every debug command in preload.ts and registers its main-process handler", function () {
    const debugCommands = Object.values(AppServiceProxyCommands).filter(
      (c) => c.startsWith("debug") || c.startsWith("getDebug")
    );

    expect(debugCommands.length).to.be.greaterThan(0);

    const preloadSource = fs.readFileSync(TestPaths.appRoot + "src/electron/preload.ts", "utf8");
    const handlerSource = fs.readFileSync(TestPaths.appRoot + "src/electron/DedicatedServerCommandHandler.ts", "utf8");

    for (const command of debugCommands) {
      const channel = "async" + command;
      expect(preloadSource, `preload.ts is missing a case for ${channel}`).to.include(`case "${channel}":`);
      expect(handlerSource, `DedicatedServerCommandHandler.ts does not register ${channel}`).to.include(
        `this._ipcMain.handle("${channel}"`
      );
    }
  });
});
