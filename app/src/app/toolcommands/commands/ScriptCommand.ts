// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * ScriptCommand - Run JavaScript or send messages via Bedrock Dedicated Server
 *
 * ARCHITECTURE DOCUMENTATION
 * ==========================
 *
 * Executes code or commands on an active Bedrock server connection.
 * This is useful for testing and debugging script behavior.
 *
 * EXECUTION PATHWAYS:
 *
 * 1. **Action Set pathway (default, reliable)**:
 *    Uses the `mct:runactions` protocol which has a complete round-trip:
 *    - Sends an action set to the in-game creator_tools_ingame addon
 *    - The addon parses the action set, executes it, and returns results
 *    - Actions include: world_send_message, test_simulated_player_spawn, etc.
 *    - This is the same pathway used by the MCP server's runActionSetInMinecraft
 *
 * 2. **Direct command pathway (--raw flag)**:
 *    Sends a raw Bedrock server command (e.g., `/say Hello`, `/tp @s 0 64 0`)
 *    via DedicatedServer.writeToServer(). No response parsing.
 *
 * 3. **Eval pathway (--eval flag)**:
 *    Evaluates arbitrary JavaScript code in the in-game scripting context.
 *    Uses the `mct:eval` scriptevent protocol with token-based response:
 *    - Encodes code: replaces `"` with `|` for transport
 *    - Sends: `/scriptevent mct:eval "token|encodedCode"`
 *    - Addon receives via scriptEventReceive, reverses encoding
 *    - Addon evaluates code with `new Function("world", "system", "dimension", code)`
 *    - Addon responds: `console.log("evl|" + token + "|" + result)`
 *    - ScriptCommand parses the `evl|token|result` response line
 *    The eval function receives `world`, `system`, and `dimension` (overworld)
 *    as available variables. Example: `/script --eval return world.getAllPlayers().length`
 *
 * TRANSPORT ENCODING:
 * The scriptevent transport cannot carry JSON double-quotes directly, so all
 * quotes in the payload are replaced with `|` before sending and reversed on
 * receipt. Response prefixes: `ras|` for actionset, `evl|` for eval, `gs|` for getState.
 *
 * RELATED FILES:
 * - src/local/DedicatedServer.ts — writeToServer(), runCommandImmediate()
 * - src/local/MinecraftMcpServer.ts — _runActionSet() with token-based responses
 * - src/actions/IActionSetData.ts — Action set data structures
 * - mc/scripts/creator_tools/CreatorTools.ts — In-game handler (outside workspace)
 *   Handles mct:actionset, mct:eval, and mct:state scriptevents + CustomCommands.
 *
 * In MCP context, requires a session to be created first via createMinecraftSessionWithContent.
 */

import type { IToolCommandMetadata, IToolCommandResult } from "../IToolCommand";
import { ToolCommandBase, ToolCommandScope } from "../IToolCommand";
import type { IToolCommandContext } from "../IToolCommandContext";
import Utilities from "../../../core/Utilities";

export class ScriptCommand extends ToolCommandBase {
  readonly metadata: IToolCommandMetadata = {
    name: "script",
    description: "Run a command or send a message on the Bedrock server",
    aliases: ["js", "eval"],
    category: "Server",
    arguments: [
      {
        name: "code",
        description: "Command or message to send to the server",
        type: "string",
        required: true,
      },
    ],
    flags: [
      {
        name: "session",
        shortName: "s",
        description: "Session name to run on (required for MCP/API)",
        type: "string",
        required: false,
      },
      {
        name: "raw",
        shortName: "r",
        description: "Send as a raw server command (e.g., /say, /tp, /give)",
        type: "boolean",
        required: false,
      },
      {
        name: "eval",
        shortName: "e",
        description: "Evaluate JavaScript code in the server's scripting context (world, system, dimension available)",
        type: "boolean",
        required: false,
      },
      {
        name: "timeout",
        shortName: "t",
        description: "Timeout in seconds for --eval response (default: 5)",
        type: "string",
        required: false,
      },
    ],
    scopes: [ToolCommandScope.serveTerminal, ToolCommandScope.ui, ToolCommandScope.serverApi, ToolCommandScope.mcp],
    examples: [
      "/script say Hello from MCT!",
      "/script --raw tp @s 0 64 0",
      "/script --eval return world.getAllPlayers().length",
      "/script --eval --timeout 30 return world.getDimension('overworld').getEntities().length",
      "/script --session mySession --eval return world.getDimension('overworld').id",
    ],
  };

  async execute(
    context: IToolCommandContext,
    args: string[],
    flags: Record<string, string | boolean | string[]>
  ): Promise<IToolCommandResult> {
    const code = args.join(" ");
    const sessionName = flags.session as string | undefined;
    const isRaw = flags.raw === true;
    const isEval = flags.eval === true;

    // In MCP or serverApi context, we need session info
    if ((context.scope === "mcp" || context.scope === "serverApi") && !sessionName && !context.session) {
      return this.error("NO_SESSION", "Session name required in MCP/API context. Use --session <name>");
    }

    if (!code || code.trim() === "") {
      return this.error("NO_CODE", "No command or message provided");
    }

    context.output.info(`Executing: ${code}`);

    try {
      // Eval pathway: send code to the in-game addon for evaluation via scriptevent
      if (isEval) {
        return await this._executeEval(context, code, sessionName, flags);
      }

      // Determine the command to send
      let command: string;

      if (isRaw) {
        // Raw mode: send the command as-is (prefix with / if needed)
        command = code.startsWith("/") ? code : "/" + code;
      } else {
        // Default mode: treat as a server command
        // If it looks like a slash command already, send as-is
        // Otherwise, wrap as a /say command for message delivery
        if (code.startsWith("/")) {
          command = code;
        } else {
          command = "/say " + code;
        }
      }

      // Try to run via IMinecraft (serve mode, Electron with server connection)
      if (context.minecraft) {
        const result = await context.minecraft.runCommand(command);
        context.output.success("Command executed");
        return this.success("Command executed", {
          result,
          command,
          sessionName: sessionName || context.session?.sessionName,
        });
      }

      // Fall back to session's serverManager (MCP/API contexts)
      if (context.session?.serverManager) {
        const server = context.session.serverManager.getActiveServer(context.session.slot || 0);
        if (server) {
          const result = await server.runCommandImmediate(command);
          context.output.success("Command executed");
          return this.success("Command executed", {
            result,
            command,
            sessionName: sessionName || context.session?.sessionName,
          });
        }
      }

      return this.error("NO_SERVER", "No active Minecraft server connection");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return this.error("SCRIPT_ERROR", `Command execution failed: ${message}`);
    }
  }

  /**
   * Evaluates JavaScript code in the in-game scripting context via the mct:eval
   * scriptevent protocol with token-based response parsing.
   *
   * Protocol:
   * 1. Encode: replace all `"` with `|` in the code
   * 2. Send: `/scriptevent mct:eval "token|encodedCode"`
   * 3. Wait for stdout line containing the token
   * 4. Parse `evl|token|result` from the response
   */
  private async _executeEval(
    context: IToolCommandContext,
    code: string,
    sessionName: string | undefined,
    flags: Record<string, string | boolean | string[]>
  ): Promise<IToolCommandResult> {
    // Encode the code for transport: replace double quotes with pipes
    const encodedCode = code.replace(/"/g, "|");
    const token = Utilities.createRandomLowerId(6);

    // Build the scriptevent command
    const command = 'scriptevent mct:eval "' + token + "|" + encodedCode + '"';

    let result: string | undefined;

    const timeoutSec = parseInt(flags.timeout as string, 10) || 5;
    const maxWaitMs = timeoutSec * 1000;

    // Eval requires token-based response parsing via runCommandImmediate.
    // The session.serverManager pathway supports this; the IMinecraft pathway
    // (serve mode) does not currently support token-based waiting.
    if (context.session?.serverManager) {
      const server = context.session.serverManager.getActiveServer(context.session.slot || 0);
      if (server) {
        result = await server.runCommandImmediate(command, token + "|", maxWaitMs);
      }
    } else if (context.minecraft) {
      // IMinecraft.runCommand doesn't support token-based waiting, so the result
      // may not contain the eval response. Best-effort approach.
      result = await context.minecraft.runCommand(command);
    }

    if (result === undefined) {
      return this.error("NO_SERVER", "No active Minecraft server connection or eval timed out");
    }

    // Parse the evl|token|result response
    const evlIndex = result.indexOf("evl|");
    if (evlIndex >= 0) {
      // Find the token after "evl|"
      const afterEvl = result.substring(evlIndex + 4);
      const pipeIndex = afterEvl.indexOf("|");

      if (pipeIndex >= 0) {
        const evalResult = afterEvl.substring(pipeIndex + 1);

        if (evalResult.startsWith("Error: ")) {
          return this.error("EVAL_ERROR", evalResult);
        }

        context.output.success(`Eval result: ${evalResult}`);
        return this.success("Eval completed", {
          result: evalResult,
          code,
          sessionName: sessionName || context.session?.sessionName,
        });
      }
    }

    // If we got a result but couldn't parse it as evl| format, return raw
    context.output.success(`Result: ${result}`);
    return this.success("Eval completed", {
      result,
      code,
      sessionName: sessionName || context.session?.sessionName,
    });
  }
}

export const scriptCommand = new ScriptCommand();
