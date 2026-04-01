// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * ScriptCommandTest.ts
 *
 * Unit tests for the ScriptCommand ToolCommand, covering:
 * - Empty code error handling
 * - No-server error handling
 * - MCP/API session requirement
 * - Raw command formatting (/ prefix)
 * - Default /say wrapping for plain text
 * - Eval quote encoding (double quotes → pipes)
 * - Eval response parsing (evl|token|result format)
 * - Eval error response handling
 * - Eval timeout flag propagation
 * - IMinecraft pathway execution
 */

import { expect } from "chai";
import { ScriptCommand } from "../app/toolcommands/commands/ScriptCommand";
import type { IToolCommandContext, IToolCommandOutput, IToolCommandSession } from "../app/toolcommands/IToolCommandContext";
import type IMinecraft from "../app/IMinecraft";

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

/**
 * Creates a mock IToolCommandContext with specified overrides.
 */
function createMockContext(
  overrides: Partial<IToolCommandContext> = {}
): IToolCommandContext & { output: IToolCommandOutput & { messages: string[] } } {
  const output = createMockOutput();
  return {
    creatorTools: undefined,
    project: undefined,
    output,
    scope: "ui",
    ...overrides,
    // Ensure output is always our mock (unless explicitly overridden with a compatible type)
    ...(overrides.output ? {} : { output }),
  } as IToolCommandContext & { output: IToolCommandOutput & { messages: string[] } };
}

/**
 * Creates a mock IMinecraft that records commands and returns canned results.
 */
function createMockMinecraft(
  responseOrFn?: string | ((cmd: string) => string | Promise<string>)
): IMinecraft & { commands: string[] } {
  const commands: string[] = [];
  return {
    commands,
    runCommand: async (command: string): Promise<string> => {
      commands.push(command);
      if (typeof responseOrFn === "function") {
        return responseOrFn(command);
      }
      return responseOrFn || "";
    },
  } as unknown as IMinecraft & { commands: string[] };
}

/**
 * Creates a mock session with a serverManager that has a mock active server.
 */
function createMockSession(
  serverResponse?: string | ((cmd: string, tokenId?: string, maxWaitMs?: number) => string | undefined)
): IToolCommandSession & { serverCommands: string[] } {
  const serverCommands: string[] = [];
  return {
    sessionName: "test-session",
    slot: 0,
    serverCommands,
    serverManager: {
      getActiveServer: (_slot: number) => ({
        runCommandImmediate: async (
          command: string,
          tokenId?: string,
          _maxWaitMs?: number
        ): Promise<string | undefined> => {
          serverCommands.push(command);
          if (typeof serverResponse === "function") {
            return serverResponse(command, tokenId, _maxWaitMs);
          }
          return serverResponse;
        },
      }),
    },
  } as unknown as IToolCommandSession & { serverCommands: string[] };
}

describe("ScriptCommand", function () {
  let cmd: ScriptCommand;

  beforeEach(() => {
    cmd = new ScriptCommand();
  });

  describe("Metadata", () => {
    it("should have correct command name and aliases", () => {
      expect(cmd.metadata.name).to.equal("script");
      expect(cmd.metadata.aliases).to.include("js");
      expect(cmd.metadata.aliases).to.include("eval");
    });

    it("should be available in all server-related scopes", () => {
      const scopeNames = cmd.metadata.scopes!.map((s) => String(s));
      expect(scopeNames).to.include("serveTerminal");
      expect(scopeNames).to.include("ui");
      expect(scopeNames).to.include("serverApi");
      expect(scopeNames).to.include("mcp");
    });
  });

  describe("Error Handling", () => {
    it("should return NO_CODE error when no code provided", async () => {
      const context = createMockContext();
      const result = await cmd.execute(context, [], {});
      expect(result.success).to.equal(false);
      expect(result.error?.code).to.equal("NO_CODE");
    });

    it("should return NO_CODE error for whitespace-only input", async () => {
      const context = createMockContext();
      const result = await cmd.execute(context, ["   "], {});
      expect(result.success).to.equal(false);
      expect(result.error?.code).to.equal("NO_CODE");
    });

    it("should return NO_SESSION error in MCP scope without session", async () => {
      const context = createMockContext({ scope: "mcp" });
      const result = await cmd.execute(context, ["say hello"], {});
      expect(result.success).to.equal(false);
      expect(result.error?.code).to.equal("NO_SESSION");
    });

    it("should return NO_SESSION error in serverApi scope without session", async () => {
      const context = createMockContext({ scope: "serverApi" });
      const result = await cmd.execute(context, ["say hello"], {});
      expect(result.success).to.equal(false);
      expect(result.error?.code).to.equal("NO_SESSION");
    });

    it("should NOT require session in ui scope", async () => {
      const minecraft = createMockMinecraft("ok");
      const context = createMockContext({ scope: "ui", minecraft });
      const result = await cmd.execute(context, ["say", "hello"], {});
      // Should succeed (or fail with NO_SERVER, not NO_SESSION)
      expect(result.error?.code).to.not.equal("NO_SESSION");
    });

    it("should return NO_SERVER error when no minecraft connection available", async () => {
      const context = createMockContext({ scope: "ui" });
      const result = await cmd.execute(context, ["say", "hello"], {});
      expect(result.success).to.equal(false);
      expect(result.error?.code).to.equal("NO_SERVER");
    });
  });

  describe("Default Command Mode (say wrapping)", () => {
    it("should wrap plain text with /say", async () => {
      const minecraft = createMockMinecraft("ok");
      const context = createMockContext({ minecraft });
      await cmd.execute(context, ["hello", "world"], {});
      expect(minecraft.commands).to.have.length(1);
      expect(minecraft.commands[0]).to.equal("/say hello world");
    });

    it("should pass through slash commands as-is", async () => {
      const minecraft = createMockMinecraft("ok");
      const context = createMockContext({ minecraft });
      await cmd.execute(context, ["/tp", "@s", "0", "64", "0"], {});
      expect(minecraft.commands[0]).to.equal("/tp @s 0 64 0");
    });
  });

  describe("Raw Mode (--raw flag)", () => {
    it("should prefix command with / when not present", async () => {
      const minecraft = createMockMinecraft("ok");
      const context = createMockContext({ minecraft });
      await cmd.execute(context, ["tp", "@s", "0", "64", "0"], { raw: true });
      expect(minecraft.commands[0]).to.equal("/tp @s 0 64 0");
    });

    it("should not double-prefix / for commands that already have it", async () => {
      const minecraft = createMockMinecraft("ok");
      const context = createMockContext({ minecraft });
      await cmd.execute(context, ["/say", "test"], { raw: true });
      expect(minecraft.commands[0]).to.equal("/say test");
    });
  });

  describe("IMinecraft Pathway", () => {
    it("should execute command via IMinecraft and return success", async () => {
      const minecraft = createMockMinecraft("Command executed successfully");
      const context = createMockContext({ minecraft });
      const result = await cmd.execute(context, ["say", "test"], {});
      expect(result.success).to.equal(true);
      expect(result.message).to.equal("Command executed");
      expect((result.data as any).command).to.equal("/say say test");
    });

    it("should handle IMinecraft errors gracefully", async () => {
      const minecraft = createMockMinecraft(() => {
        throw new Error("Connection lost");
      });
      const context = createMockContext({ minecraft });
      const result = await cmd.execute(context, ["say", "test"], {});
      expect(result.success).to.equal(false);
      expect(result.error?.code).to.equal("SCRIPT_ERROR");
      expect(result.error?.message).to.include("Connection lost");
    });
  });

  describe("Session/ServerManager Pathway", () => {
    it("should execute command via session serverManager", async () => {
      const session = createMockSession("Command output");
      const context = createMockContext({ session, scope: "mcp" });
      const result = await cmd.execute(context, ["/say", "hello"], { session: "test-session" });
      expect(result.success).to.equal(true);
      expect(session.serverCommands).to.have.length(1);
    });

    it("should prefer IMinecraft over session when both available", async () => {
      const minecraft = createMockMinecraft("mc-result");
      const session = createMockSession("session-result");
      const context = createMockContext({ minecraft, session });
      await cmd.execute(context, ["say", "test"], {});
      // IMinecraft should be used, not session
      expect(minecraft.commands).to.have.length(1);
      expect(session.serverCommands).to.have.length(0);
    });
  });

  describe("Eval Mode (--eval flag)", () => {
    it("should encode double quotes as pipes in eval payload", async () => {
      const session = createMockSession((command: string) => {
        // Verify the command doesn't contain unencoded double quotes in the code portion
        // The overall command wraps in quotes: scriptevent mct:eval "token|encodedCode"
        return `evl|${command}|42`;
      });
      const context = createMockContext({ session });
      const result = await cmd.execute(context, ['return', '"hello"'], { eval: true });
      // The code 'return "hello"' should have quotes encoded as pipes
      const sentCommand = session.serverCommands[0];
      expect(sentCommand).to.include("mct:eval");
      // The encoded code should have | instead of "
      expect(sentCommand).to.include("|return |hello|");
    });

    it("should parse evl|token|result response format", async () => {
      const session = createMockSession((command: string) => {
        // Extract token from the command
        const match = command.match(/mct:eval "([^|]+)\|/);
        const token = match ? match[1] : "unknown";
        return `evl|${token}|42`;
      });
      const context = createMockContext({ session });
      const result = await cmd.execute(context, ["return", "1", "+", "1"], { eval: true });
      expect(result.success).to.equal(true);
      expect((result.data as any).result).to.equal("42");
    });

    it("should return EVAL_ERROR for error responses", async () => {
      const session = createMockSession((command: string) => {
        const match = command.match(/mct:eval "([^|]+)\|/);
        const token = match ? match[1] : "unknown";
        return `evl|${token}|Error: ReferenceError: foo is not defined`;
      });
      const context = createMockContext({ session });
      const result = await cmd.execute(context, ["return", "foo"], { eval: true });
      expect(result.success).to.equal(false);
      expect(result.error?.code).to.equal("EVAL_ERROR");
      expect(result.error?.message).to.include("ReferenceError");
    });

    it("should return raw result when evl| format not found", async () => {
      const session = createMockSession("some unexpected output");
      const context = createMockContext({ session });
      const result = await cmd.execute(context, ["return", "1"], { eval: true });
      expect(result.success).to.equal(true);
      expect((result.data as any).result).to.equal("some unexpected output");
    });

    it("should return NO_SERVER error when eval has no server connection", async () => {
      const context = createMockContext({ scope: "ui" });
      const result = await cmd.execute(context, ["return", "1"], { eval: true });
      expect(result.success).to.equal(false);
      expect(result.error?.code).to.equal("NO_SERVER");
    });

    it("should pass timeout to runCommandImmediate", async () => {
      let capturedMaxWaitMs: number | undefined;
      const session = createMockSession((_cmd: string, _tokenId?: string, maxWaitMs?: number) => {
        capturedMaxWaitMs = maxWaitMs;
        return undefined; // simulate timeout
      });
      const context = createMockContext({ session });
      await cmd.execute(context, ["return", "1"], { eval: true, timeout: "30" });
      expect(capturedMaxWaitMs).to.equal(30000);
    });

    it("should default timeout to 5 seconds when not specified", async () => {
      let capturedMaxWaitMs: number | undefined;
      const session = createMockSession((_cmd: string, _tokenId?: string, maxWaitMs?: number) => {
        capturedMaxWaitMs = maxWaitMs;
        return undefined;
      });
      const context = createMockContext({ session });
      await cmd.execute(context, ["return", "1"], { eval: true });
      expect(capturedMaxWaitMs).to.equal(5000);
    });

    it("should use IMinecraft fallback for eval when no session", async () => {
      const minecraft = createMockMinecraft("evl|abc123|hello");
      const context = createMockContext({ minecraft });
      const result = await cmd.execute(context, ["return", "'hello'"], { eval: true });
      expect(result.success).to.equal(true);
      expect(minecraft.commands).to.have.length(1);
      expect(minecraft.commands[0]).to.include("mct:eval");
    });

    it("should handle eval timeout when server returns undefined", async () => {
      // When runCommandImmediate returns undefined (timeout), should report error
      const session: IToolCommandSession = {
        sessionName: "test",
        serverManager: {
          getActiveServer: () => ({
            runCommandImmediate: async () => undefined,
          }),
        } as any,
        slot: 0,
      };
      const context = createMockContext({ session, scope: "mcp" as any });
      const result = await cmd.execute(context, ["return", "1+1"], { eval: true, timeout: "1" });
      expect(result.success).to.equal(false);
    });

    it("should handle eval response with Error: prefix", async () => {
      // Error responses from in-game eval should be detected
      const minecraft = createMockMinecraft("evl|token123|Error: ReferenceError: x is not defined");
      const context = createMockContext({ minecraft });
      const result = await cmd.execute(context, ["x"], { eval: true });
      expect(result.success).to.equal(false);
      expect(result.error?.code).to.equal("EVAL_ERROR");
    });
  });
});
