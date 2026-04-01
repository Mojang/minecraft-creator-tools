// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * ServerCommandTest.ts
 *
 * Unit tests for the ServerCommand ToolCommand, covering:
 * - Invalid action error handling
 * - No ServerManager error handling
 * - Start/stop/status subcommands with mock ServerManager
 * - Fresh world flag handling
 * - Wait-ready with timeout
 * - JSON output mode
 * - Error categorization (port conflict, EULA, network, crash, timeout)
 * - Status reporting for missing servers
 *
 * These tests use mock ServerManager/DedicatedServer objects and do NOT
 * require an actual BDS binary. For full lifecycle tests with real BDS,
 * see test-extra/ServerWorkflowTest.ts.
 */

import { expect } from "chai";
import { serverCommand } from "../app/toolcommands/commands/ServerCommand";
import { ToolCommandExitCode } from "../app/toolcommands/IToolCommand";
import type { IToolCommandContext, IToolCommandOutput } from "../app/toolcommands/IToolCommandContext";

/**
 * Creates a mock IToolCommandOutput that records messages.
 */
function createMockOutput(): IToolCommandOutput & { messages: string[] } {
  const messages: string[] = [];
  return {
    messages,
    info: (msg: string) => messages.push(`info: ${msg}`),
    success: (msg: string) => messages.push(`success: ${msg}`),
    warn: (msg: string) => messages.push(`warn: ${msg}`),
    error: (msg: string) => messages.push(`error: ${msg}`),
    debug: (msg: string) => messages.push(`debug: ${msg}`),
    progress: (_c: number, _t: number, msg?: string) => {
      if (msg) messages.push(`progress: ${msg}`);
    },
  };
}

// Dedicated server status values (matching DedicatedServerStatus enum)
const ServerStatus = {
  none: 0,
  starting: 1,
  started: 2,
  stopping: 3,
  stopped: 4,
};

/**
 * Creates a mock server manager with configurable behavior.
 */
function createMockServerManager(options: {
  activeServer?: {
    status?: number;
    startServer?: (wait: boolean, msg: any) => Promise<void>;
    waitUntilStarted?: () => Promise<void>;
    stopServer?: () => Promise<void>;
  } | null;
  prepare?: () => Promise<void>;
  ensureActiveServer?: (slot: number, msg: any) => Promise<any>;
  getBasePortForSlot?: (slot: number) => number;
} = {}) {
  const defaultServer = {
    status: ServerStatus.started,
    startServer: async () => {},
    waitUntilStarted: async () => {},
    stopServer: async () => {},
    ...options.activeServer,
  };

  return {
    prepare: options.prepare || (async () => {}),
    ensureActiveServer:
      options.ensureActiveServer ||
      (async () => defaultServer),
    getActiveServer: (_slot: number) => (options.activeServer === null ? undefined : defaultServer),
    getBasePortForSlot: options.getBasePortForSlot || ((slot: number) => 19132 + slot * 32),
  };
}

/**
 * Creates a mock IToolCommandContext with a ServerManager.
 */
function createMockContext(
  serverManager?: any,
  scope: "ui" | "mcp" | "serveTerminal" | "serverApi" | "cli" = "serveTerminal"
): IToolCommandContext & { output: IToolCommandOutput & { messages: string[] } } {
  const output = createMockOutput();
  return {
    creatorTools: undefined,
    project: undefined,
    output,
    scope,
    session: serverManager
      ? {
          sessionName: "test",
          serverManager,
          slot: 0,
        }
      : undefined,
  } as IToolCommandContext & { output: IToolCommandOutput & { messages: string[] } };
}

describe("ServerCommand", function () {
  describe("Metadata", () => {
    it("should have correct command name and aliases", () => {
      expect(serverCommand.metadata.name).to.equal("server");
      expect(serverCommand.metadata.aliases).to.include("srv");
      expect(serverCommand.metadata.aliases).to.include("bds");
    });

    it("should support start, stop, and status actions", () => {
      const args = serverCommand.metadata.arguments;
      expect(args).to.have.length(1);
      expect(args![0].name).to.equal("action");
    });

    it("should define slot, project, session, fresh, json, wait-ready, timeout, and editor flags", () => {
      const flagNames = serverCommand.metadata.flags!.map((f) => f.name);
      expect(flagNames).to.include("slot");
      expect(flagNames).to.include("project");
      expect(flagNames).to.include("session");
      expect(flagNames).to.include("fresh");
      expect(flagNames).to.include("json");
      expect(flagNames).to.include("wait-ready");
      expect(flagNames).to.include("timeout");
      expect(flagNames).to.include("editor");
    });
  });

  describe("Invalid Action", () => {
    it("should return INVALID_ACTION for empty action", async () => {
      const context = createMockContext(createMockServerManager());
      const result = await serverCommand.execute(context, [], {});
      expect(result.success).to.equal(false);
      expect(result.error?.code).to.equal("INVALID_ACTION");
    });

    it("should return INVALID_ACTION for unknown action", async () => {
      const context = createMockContext(createMockServerManager());
      const result = await serverCommand.execute(context, ["restart"], {});
      expect(result.success).to.equal(false);
      expect(result.error?.code).to.equal("INVALID_ACTION");
    });
  });

  describe("No ServerManager", () => {
    it("should return NO_SERVER_MANAGER for start without ServerManager", async () => {
      const context = createMockContext(undefined);
      const result = await serverCommand.execute(context, ["start"], {});
      expect(result.success).to.equal(false);
      expect(result.error?.code).to.equal("NO_SERVER_MANAGER");
    });

    it("should return NO_SERVER_MANAGER for stop without ServerManager", async () => {
      const context = createMockContext(undefined);
      const result = await serverCommand.execute(context, ["stop"], {});
      expect(result.success).to.equal(false);
      expect(result.error?.code).to.equal("NO_SERVER_MANAGER");
    });

    it("should return NO_SERVER_MANAGER for status without ServerManager", async () => {
      const context = createMockContext(undefined);
      const result = await serverCommand.execute(context, ["status"], {});
      expect(result.success).to.equal(false);
      expect(result.error?.code).to.equal("NO_SERVER_MANAGER");
    });
  });

  describe("Status Subcommand", () => {
    it("should report no active server when none running", async () => {
      const sm = createMockServerManager({ activeServer: null });
      const context = createMockContext(sm);
      const result = await serverCommand.execute(context, ["status"], {});
      expect(result.success).to.equal(true);
      expect((result.data as any).running).to.equal(false);
      expect((result.data as any).status).to.equal("none");
    });
  });

  describe("Stop Subcommand", () => {
    it("should return NO_SERVER when no active server to stop", async () => {
      const sm = createMockServerManager({ activeServer: null });
      const context = createMockContext(sm);
      const result = await serverCommand.execute(context, ["stop"], {});
      expect(result.success).to.equal(false);
      expect(result.error?.code).to.equal("NO_SERVER");
    });

    it("should handle stop server errors gracefully", async () => {
      const sm = createMockServerManager({
        activeServer: {
          status: ServerStatus.started,
          stopServer: async () => {
            throw new Error("Process already exited");
          },
        },
      });
      const context = createMockContext(sm);
      const result = await serverCommand.execute(context, ["stop"], {});
      expect(result.success).to.equal(false);
      expect(result.error?.code).to.equal("STOP_FAILED");
      expect(result.error?.message).to.include("Process already exited");
    });
  });

  describe("JSON Output Mode", () => {
    it("should output JSON when --json flag is set", async () => {
      const sm = createMockServerManager({ activeServer: null });
      const context = createMockContext(sm);
      const result = await serverCommand.execute(context, ["status"], { json: true });
      // With --json, output.info should be called with JSON string
      const jsonMessages = context.output.messages.filter(
        (m) => m.startsWith("info:") && m.includes("{")
      );
      expect(jsonMessages.length).to.be.greaterThan(0);
      // Verify it's valid JSON
      const jsonStr = jsonMessages[jsonMessages.length - 1].replace("info: ", "");
      const parsed = JSON.parse(jsonStr);
      expect(parsed).to.have.property("status");
    });
  });

  describe("Error Categorization", () => {
    it("should categorize port-in-use errors as PortConflict", () => {
      const exitCode = serverCommand._categorizeError("EADDRINUSE: port 19132 in use");
      expect(exitCode).to.equal(ToolCommandExitCode.PortConflict);
    });

    it("should categorize EULA errors", () => {
      const exitCode = serverCommand._categorizeError("EULA must be accepted before starting");
      expect(exitCode).to.equal(ToolCommandExitCode.EulaNotAccepted);
    });

    it("should categorize network errors", () => {
      const exitCode = serverCommand._categorizeError("Download failed: ECONNREFUSED");
      expect(exitCode).to.equal(ToolCommandExitCode.NetworkError);
    });

    it("should categorize crash errors", () => {
      const exitCode = serverCommand._categorizeError("Server crash on startup detected");
      expect(exitCode).to.equal(ToolCommandExitCode.CrashOnStartup);
    });

    it("should categorize timeout errors", () => {
      const exitCode = serverCommand._categorizeError("Operation timed out after 60s");
      expect(exitCode).to.equal(ToolCommandExitCode.Timeout);
    });

    it("should default to GenericError for unknown messages", () => {
      const exitCode = serverCommand._categorizeError("Something went wrong");
      expect(exitCode).to.equal(ToolCommandExitCode.GenericError);
    });
  });

  describe("Slot Parsing", () => {
    it("should default to slot 0 when no slot flag provided", async () => {
      const sm = createMockServerManager({ activeServer: null });
      const context = createMockContext(sm);
      const result = await serverCommand.execute(context, ["status"], {});
      expect((result.data as any).slot).to.equal(0);
    });

    it("should parse slot from flags", async () => {
      // We can't easily test this without a full start flow,
      // but we can verify status uses the right slot
      let queriedSlot: number | undefined;
      const sm = {
        ...createMockServerManager({ activeServer: null }),
        getActiveServer: (slot: number) => {
          queriedSlot = slot;
          return undefined;
        },
      };
      const context = createMockContext(sm);
      await serverCommand.execute(context, ["status"], { slot: "3" });
      expect(queriedSlot).to.equal(3);
    });
  });

  describe("Editor Mode", () => {
    it("should pass isEditor in worldSettings when --editor flag is set", async () => {
      let capturedStartMessage: any;
      const sm = createMockServerManager({
        ensureActiveServer: async (_slot: number, msg: any) => {
          capturedStartMessage = msg;
          return {
            status: ServerStatus.started,
            startServer: async () => {},
            waitUntilStarted: async () => {},
            stopServer: async () => {},
          };
        },
      });
      const context = createMockContext(sm);
      const result = await serverCommand.execute(context, ["start"], { editor: true });
      expect(result.success).to.equal(true);
      expect(capturedStartMessage).to.exist;
      expect(capturedStartMessage.worldSettings).to.exist;
      expect(capturedStartMessage.worldSettings.isEditor).to.equal(true);
    });

    it("should not set isEditor when --editor flag is not set", async () => {
      let capturedStartMessage: any;
      const sm = createMockServerManager({
        ensureActiveServer: async (_slot: number, msg: any) => {
          capturedStartMessage = msg;
          return {
            status: ServerStatus.started,
            startServer: async () => {},
            waitUntilStarted: async () => {},
            stopServer: async () => {},
          };
        },
      });
      const context = createMockContext(sm);
      const result = await serverCommand.execute(context, ["start"], {});
      expect(result.success).to.equal(true);
      expect(capturedStartMessage).to.exist;
      expect(capturedStartMessage.worldSettings.isEditor).to.equal(false);
    });

    it("should log editor mode info when --editor flag is set", async () => {
      const sm = createMockServerManager({
        ensureActiveServer: async () => ({
          status: ServerStatus.started,
          startServer: async () => {},
          waitUntilStarted: async () => {},
          stopServer: async () => {},
        }),
      });
      const context = createMockContext(sm);
      await serverCommand.execute(context, ["start"], { editor: true });
      const editorMessages = context.output.messages.filter((m) => m.includes("Editor mode"));
      expect(editorMessages.length).to.be.greaterThan(0);
    });
  });
});
