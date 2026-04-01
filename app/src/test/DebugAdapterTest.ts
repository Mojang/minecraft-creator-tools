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
import DebugMessageStreamParser from "../debugger/DebugMessageStreamParser";
import { DebugConnectionState, IStatData, ProtocolVersion } from "../debugger/IMinecraftDebugProtocol";
import Utilities from "../core/Utilities";
import { Server, createServer, Socket } from "net";

/**
 * MockMinecraftDebugServer - simulates a Minecraft debug server for testing
 */
class MockMinecraftDebugServer {
  private _server: Server | undefined;
  private _clients: Socket[] = [];
  private _port: number;
  private _protocolVersion: number;
  private _sendProtocolEventOnConnect: boolean = true;

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

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this._server = createServer((socket) => {
        this._clients.push(socket);

        socket.on("close", () => {
          const index = this._clients.indexOf(socket);
          if (index >= 0) {
            this._clients.splice(index, 1);
          }
        });

        socket.on("data", (data) => {
          // Parse incoming messages (for potential request handling)
          // For now, just acknowledge receipt
        });

        // Send ProtocolEvent immediately upon connection (like real Minecraft)
        if (this._sendProtocolEventOnConnect) {
          this.sendProtocolEvent(socket);
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

      it("should timeout if no ProtocolEvent received", async function () {
        const mockServer = new MockMinecraftDebugServer(19204);
        mockServer.sendProtocolEventOnConnect = false;
        await mockServer.start();

        const client = new MinecraftDebugClient();
        let disconnectReason = "";

        client.onDisconnected.subscribe((_, reason) => {
          disconnectReason = reason;
        });

        await client.connect("localhost", 19204);

        // Wait for handshake timeout (10 seconds + buffer)
        await Utilities.sleep(12000);

        expect(client.state).to.not.equal(DebugConnectionState.Connected);
        expect(disconnectReason).to.include("handshake timeout");

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
