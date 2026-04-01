// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * ServerMessageTest.ts
 *
 * Comprehensive tests for ServerMessage parsing, covering:
 * - Type detection (INFO, ERROR, WARN, general)
 * - Category classification for all BDS output message types
 * - Date parsing from bracketed log format
 * - NO LOG FILE prefix stripping
 * - Message extraction and trimming
 * - Internal system message detection (querytarget output)
 * - getMessageCategoryPrefix mapping
 * - Edge cases: malformed messages, missing brackets, empty strings
 *
 * These tests validate the message parsing logic that drives the
 * DedicatedServer output state machine (backup detection, player
 * tracking, server lifecycle events).
 */

import { expect } from "chai";
import ServerMessage, {
  ServerMessageType,
  ServerMessageCategory,
  getMessageCategoryPrefix,
} from "../local/ServerMessage";

describe("ServerMessage", function () {
  describe("Category Classification", () => {
    const testCases: Array<{ input: string; expected: ServerMessageCategory; description: string }> = [
      // Server lifecycle
      {
        input: "[2024-01-01 00:00:00:000 INFO] Starting Server",
        expected: ServerMessageCategory.serverStarting,
        description: "server starting",
      },
      {
        input: "[2024-01-01 00:00:00:000 INFO] Server started.",
        expected: ServerMessageCategory.serverStarted,
        description: "server started",
      },
      {
        input: "[2024-01-01 00:00:00:000 INFO] Server stop requested.",
        expected: ServerMessageCategory.serverStopRequested,
        description: "stop requested",
      },
      {
        input: "[2024-01-01 00:00:00:000 INFO] Stopping server...",
        expected: ServerMessageCategory.serverStopping,
        description: "server stopping",
      },
      {
        input: "[2024-01-01 00:00:00:000 INFO] Quit correctly",
        expected: ServerMessageCategory.serverStopped,
        description: "server stopped",
      },

      // Version info
      {
        input: "[2024-01-01 00:00:00:000 INFO] Version: 1.21.0.3",
        expected: ServerMessageCategory.version,
        description: "version",
      },
      {
        input: "[2024-01-01 00:00:00:000 INFO] Session ID: 12345",
        expected: ServerMessageCategory.sessionId,
        description: "session ID",
      },
      {
        input: "[2024-01-01 00:00:00:000 INFO] Build ID: 12345",
        expected: ServerMessageCategory.buildId,
        description: "build ID",
      },
      {
        input: "[2024-01-01 00:00:00:000 INFO] Branch: main",
        expected: ServerMessageCategory.branch,
        description: "branch",
      },
      {
        input: "[2024-01-01 00:00:00:000 INFO] Commit ID: abc123",
        expected: ServerMessageCategory.commitId,
        description: "commit ID",
      },

      // World/config
      {
        input: "[2024-01-01 00:00:00:000 INFO] Level Name: My World",
        expected: ServerMessageCategory.levelName,
        description: "level name",
      },
      {
        input: "[2024-01-01 00:00:00:000 INFO] Game mode: Creative",
        expected: ServerMessageCategory.gameMode,
        description: "game mode",
      },
      {
        input: "[2024-01-01 00:00:00:000 INFO] Difficulty: Normal",
        expected: ServerMessageCategory.difficulty,
        description: "difficulty",
      },
      {
        input: "[2024-01-01 00:00:00:000 INFO] Configuration: Vanilla",
        expected: ServerMessageCategory.configuration,
        description: "configuration",
      },

      // Experiments and opening level
      {
        input: "[2024-01-01 00:00:00:000 INFO] Experiment(s) active: Beta APIs",
        expected: ServerMessageCategory.experiments,
        description: "experiments",
      },
      {
        input: "[2024-01-01 00:00:00:000 INFO] Opening level storage",
        expected: ServerMessageCategory.openingLevel,
        description: "opening level",
      },

      // Player events
      {
        input: "[2024-01-01 00:00:00:000 INFO] Player connected: Steve, xuid: 1234567890",
        expected: ServerMessageCategory.playerConnected,
        description: "player connected",
      },
      {
        input: "[2024-01-01 00:00:00:000 INFO] Player disconnected: Steve, xuid: 1234567890",
        expected: ServerMessageCategory.playerDisconnected,
        description: "player disconnected",
      },

      // Logging config
      {
        input: "[2024-01-01 00:00:00:000 INFO] Content logging to console is enabled.",
        expected: ServerMessageCategory.contentLoggingConsoleEnabled,
        description: "console logging",
      },
      {
        input: "[2024-01-01 00:00:00:000 INFO] Content logging to disk is enabled.",
        expected: ServerMessageCategory.contentLoggingDiskEnabled,
        description: "disk logging",
      },

      // Network
      {
        input: "[2024-01-01 00:00:00:000 INFO] IPv4 supported, port: 19132",
        expected: ServerMessageCategory.ipv4supported,
        description: "IPv4",
      },
      {
        input: "[2024-01-01 00:00:00:000 INFO] IPv6 supported, port: 19133",
        expected: ServerMessageCategory.ipv6supported,
        description: "IPv6",
      },

      // Telemetry
      {
        input: "[2024-01-01 00:00:00:000 INFO] ================ TELEMETRY MESSAGE ================",
        expected: ServerMessageCategory.telemetryMessageStart,
        description: "telemetry banner",
      },
      {
        input: "[2024-01-01 00:00:00:000 INFO] Server Telemetry is currently not enabled.",
        expected: ServerMessageCategory.telemetryStart,
        description: "telemetry status",
      },
      {
        input: "[2024-01-01 00:00:00:000 INFO] Enabling this telemetry helps us improve the game.",
        expected: ServerMessageCategory.telemetryEnabling,
        description: "telemetry enabling",
      },
      {
        input: "[2024-01-01 00:00:00:000 INFO] To enable this feature set the following property",
        expected: ServerMessageCategory.telemetryEnabling2,
        description: "telemetry enabling2",
      },
      {
        input: "[2024-01-01 00:00:00:000 INFO] to the server.properties file: enable-telemetry=true",
        expected: ServerMessageCategory.telemetryProperties,
        description: "telemetry properties",
      },
      {
        input: "[2024-01-01 00:00:00:000 INFO] ======================================================",
        expected: ServerMessageCategory.demarcationLine,
        description: "demarcation line",
      },

      // Backup
      {
        input: "[2024-01-01 00:00:00:000 INFO] Saving...",
        expected: ServerMessageCategory.backupSaving,
        description: "backup saving",
      },
      {
        input: "[2024-01-01 00:00:00:000 INFO] Data saved. Files are now ready to be copied.",
        expected: ServerMessageCategory.backupSaved,
        description: "backup saved",
      },
      {
        input: "[2024-01-01 00:00:00:000 INFO] Changes to the world are resumed.",
        expected: ServerMessageCategory.backupComplete,
        description: "backup complete",
      },
      {
        input: "[2024-01-01 00:00:00:000 INFO] db/worlds/Bedrock level/level.dat:0",
        expected: ServerMessageCategory.levelDatUpdate,
        description: "level.dat update",
      },

      // GameTest
      {
        input: "[2024-01-01 00:00:00:000 INFO] onTestPassed: mytest",
        expected: ServerMessageCategory.gameTestPassed,
        description: "test passed",
      },
      {
        input: "[2024-01-01 00:00:00:000 INFO] onTestFailed: mytest",
        expected: ServerMessageCategory.gameTestFailed,
        description: "test failed",
      },
      {
        input: "[2024-01-01 00:00:00:000 INFO] onTestStructureLoaded: mytest",
        expected: ServerMessageCategory.gameTestLoaded,
        description: "test structure loaded",
      },

      // Debugger
      {
        input: "[2024-01-01 00:00:00:000 INFO] Debugger listening on ws://127.0.0.1:19144",
        expected: ServerMessageCategory.debuggerListening,
        description: "debugger listening",
      },
      {
        input: "[2024-01-01 00:00:00:000 INFO] Failed to start debugger",
        expected: ServerMessageCategory.debuggerFailedToStart,
        description: "debugger failed to start",
      },
      {
        input: "[2024-01-01 00:00:00:000 INFO] [Scripting] Script Debugger closed",
        expected: ServerMessageCategory.debuggerClosing,
        description: "debugger closing",
      },

      // Empty
      {
        input: "[2024-01-01 00:00:00:000 INFO] ",
        expected: ServerMessageCategory.empty,
        description: "empty message",
      },

      // General (no match)
      {
        input: "[2024-01-01 00:00:00:000 INFO] Some random log output",
        expected: ServerMessageCategory.general,
        description: "general message",
      },
    ];

    for (const tc of testCases) {
      it(`should classify ${tc.description}`, () => {
        const msg = new ServerMessage(tc.input);
        expect(msg.category, `Expected category ${tc.expected} for "${tc.input}"`).to.equal(tc.expected);
      });
    }
  });

  describe("Message Type Detection", () => {
    it("should detect INFO type", () => {
      const msg = new ServerMessage("[2024-01-01 00:00:00:000 INFO] Server started.");
      expect(msg.type).to.equal(ServerMessageType.info);
    });

    it("should detect ERROR type", () => {
      const msg = new ServerMessage("[2024-01-01 00:00:00:000 ERROR] Failed to bind port");
      expect(msg.type).to.equal(ServerMessageType.error);
    });

    it("should detect WARN type", () => {
      const msg = new ServerMessage("[2024-01-01 00:00:00:000 WARN] Low memory");
      expect(msg.type).to.equal(ServerMessageType.warning);
    });

    it("should default to general for unknown type", () => {
      const msg = new ServerMessage("No brackets at all");
      expect(msg.type).to.equal(ServerMessageType.general);
    });
  });

  describe("NO LOG FILE Prefix", () => {
    it("should strip NO LOG FILE prefix and still parse", () => {
      const msg = new ServerMessage("NO LOG FILE! - [2024-01-01 00:00:00:000 INFO] Server started.");
      expect(msg.category).to.equal(ServerMessageCategory.serverStarted);
      expect(msg.message).to.equal("Server started.");
    });

    it("should preserve fullMessage with NO LOG FILE prefix", () => {
      const input = "NO LOG FILE! - [2024-01-01 00:00:00:000 INFO] Server started.";
      const msg = new ServerMessage(input);
      expect(msg.fullMessage).to.equal(input);
    });

    it("should handle NO LOG FILE with non-categorized message", () => {
      const msg = new ServerMessage("NO LOG FILE! - [2024-01-01 00:00:00:000 INFO] Random output");
      expect(msg.message).to.equal("Random output");
      expect(msg.category).to.equal(ServerMessageCategory.general);
    });

    it("should detect type from NO LOG FILE prefixed message", () => {
      const msg = new ServerMessage("NO LOG FILE! - [2024-01-01 00:00:00:000 ERROR] Something failed");
      expect(msg.type).to.equal(ServerMessageType.error);
    });
  });

  describe("Message Extraction", () => {
    it("should extract message from bracketed format", () => {
      const msg = new ServerMessage("[2024-01-01 00:00:00:000 INFO] Server started.");
      expect(msg.message).to.equal("Server started.");
    });

    it("should use full message when no brackets", () => {
      const msg = new ServerMessage("Plain text message");
      expect(msg.message).to.equal("Plain text message");
    });

    it("should trim whitespace from message", () => {
      const msg = new ServerMessage("[2024-01-01 00:00:00:000 INFO]   padded message  ");
      expect(msg.message).to.equal("padded message");
    });

    it("should preserve fullMessage", () => {
      const input = "[2024-01-01 00:00:00:000 INFO] Hello world";
      const msg = new ServerMessage(input);
      expect(msg.fullMessage).to.equal(input);
    });

    it("should handle bracket that does not close properly", () => {
      const msg = new ServerMessage("[short] x");
      // lastBracket at index 6 is not > 10, so falls through to fullMessage
      expect(msg.message).to.equal("[short] x");
    });
  });

  describe("Internal System Messages", () => {
    const internalMessages = [
      "Target data: something",
      "No targets matched selector",
      '"dimension"',
      '"id"',
      '"position"',
      '"uniqueId"',
      '"yRot"',
      '"x"',
      '"y"',
      '"z"',
      "},",
      "}",
      "{",
      "[",
      "]",
    ];

    for (const msg of internalMessages) {
      it(`should classify "${msg}" as internal system message`, () => {
        const parsed = new ServerMessage(msg);
        expect(parsed.category).to.equal(ServerMessageCategory.internalSystemMessage);
      });
    }
  });

  describe("getMessageCategoryPrefix", () => {
    const prefixTests: Array<{ category: ServerMessageCategory; expected: string }> = [
      { category: ServerMessageCategory.serverStarting, expected: "START" },
      { category: ServerMessageCategory.serverStarted, expected: "READY" },
      { category: ServerMessageCategory.serverStopped, expected: "STOP" },
      { category: ServerMessageCategory.serverStopRequested, expected: "STOPREQ" },
      { category: ServerMessageCategory.serverStopping, expected: "STOPPING" },
      { category: ServerMessageCategory.playerConnected, expected: "JOIN" },
      { category: ServerMessageCategory.playerDisconnected, expected: "LEAVE" },
      { category: ServerMessageCategory.gameTestFailed, expected: "ERROR" },
      { category: ServerMessageCategory.debuggerFailedToStart, expected: "ERROR" },
      { category: ServerMessageCategory.gameTestPassed, expected: "PASS" },
      { category: ServerMessageCategory.backupSaving, expected: "SAVE" },
      { category: ServerMessageCategory.backupSaved, expected: "SAVED" },
      { category: ServerMessageCategory.backupComplete, expected: "SAVED" },
      { category: ServerMessageCategory.version, expected: "VER" },
      { category: ServerMessageCategory.debuggerListening, expected: "DEBUG" },
      { category: ServerMessageCategory.gameTestLoaded, expected: "GTEST" },
      { category: ServerMessageCategory.general, expected: "LOG" },
      { category: ServerMessageCategory.empty, expected: "LOG" },
      { category: ServerMessageCategory.sessionId, expected: "LOG" },
    ];

    for (const tc of prefixTests) {
      it(`should return "${tc.expected}" for category ${tc.category}`, () => {
        expect(getMessageCategoryPrefix(tc.category)).to.equal(tc.expected);
      });
    }
  });

  describe("Date Parsing", () => {
    it("should not create invalid dates when lastSpace is before firstBracket", () => {
      const msg = new ServerMessage("[NOSPACEHERE] some message");
      expect(isNaN(msg.date.getTime())).to.equal(false);
    });

    it("should default date to epoch for non-bracketed messages", () => {
      const msg = new ServerMessage("plain text");
      expect(msg.date.getTime()).to.equal(0);
    });
  });

  describe("Edge Cases", () => {
    it("should handle completely empty string", () => {
      const msg = new ServerMessage("");
      expect(msg.message).to.equal("");
      expect(msg.category).to.equal(ServerMessageCategory.empty);
    });

    it("should handle message with only whitespace after bracket", () => {
      const msg = new ServerMessage("[2024-01-01 00:00:00:000 INFO]    ");
      expect(msg.message).to.equal("");
      expect(msg.category).to.equal(ServerMessageCategory.empty);
    });

    it("should handle bracket not at start of string", () => {
      const msg = new ServerMessage("prefix [2024-01-01 00:00:00:000 INFO] data");
      // firstBracket !== 0, so falls through to fullMessage
      expect(msg.message).to.equal("prefix [2024-01-01 00:00:00:000 INFO] data");
      expect(msg.type).to.equal(ServerMessageType.general);
    });

    it("should use indexOf for gameTest categories (not startsWith)", () => {
      // onTestPassed can appear after a prefix in the message
      const msg = new ServerMessage("[2024-01-01 00:00:00:000 INFO] [GameTest] onTestPassed: ns:mytest");
      expect(msg.category).to.equal(ServerMessageCategory.gameTestPassed);
    });

    it("should detect levelDat via indexOf", () => {
      const msg = new ServerMessage("[2024-01-01 00:00:00:000 INFO] worlds/MyWorld/level.dat:0:123");
      expect(msg.category).to.equal(ServerMessageCategory.levelDatUpdate);
    });
  });
});
