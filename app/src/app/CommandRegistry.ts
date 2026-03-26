// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import Log from "../core/Log";
import Utilities from "../core/Utilities";
import CommandStructure from "./CommandStructure";
import { CommandStatus, ICommandResult } from "./ICommand";
import IContext from "./IContext";
import { ToolCommandRegistry, initializeToolCommands } from "./toolcommands";
import type { IToolCommandContext, IToolCommandOutput } from "./toolcommands";

export enum CommandScope {
  any = 1,
  project = 2,
  minecraft = 3,
  carto = 4,
  host = 5,

  debug = 10,
  debugProject = 11,
  debugMinecraft = 12,
  debugHost = 14,
}

const MinecraftCommands = [
  "aimassist",
  "allowlist",
  "alwaysday",
  "camera",
  "camerashake",
  "changesetting",
  "clear",
  "clearspawnpoint",
  "clone",
  "commandbuilder",
  "connect",
  "controlscheme",
  "damage",
  "daylock",
  "deop",
  "dialogue",
  "difficulty",
  "effect",
  "enchant",
  "event",
  "execute",
  "fill",
  "fog",
  "function",
  "gamemode",
  "gamerule",
  "gametest",
  "give",
  "help",
  "hud",
  "inputpermission",
  "kick",
  "kill",
  "list",
  "locate",
  "loot",
  "me",
  "msg",
  "mobevent",
  "music",
  "op",
  "ops",
  "particle",
  "permission",
  "place",
  "playanimation",
  "playsound",
  "project",
  "recipe",
  "reload",
  "reloadconfig",
  "reloadpacketlimitconfig",
  "replaceitem",
  "ride",
  "save",
  "say",
  "schedule",
  "scoreboard",
  "script",
  "scriptevent",
  "sendshowstoreoffer",
  "setblock",
  "setmaxplayers",
  "setworldspawn",
  "simulationtype",
  "spawnpoint",
  "spreadplayers",
  "stop",
  "stopsound",
  "structure",
  "summon",
  "tag",
  "teleport",
  "tell",
  "tellraw",
  "testfor",
  "testforblock",
  "testforblocks",
  "tickingarea",
  "tp",
  "time",
  "title",
  "titleraw",
  "toggledownfall",
  "transfer",
  "volumearea",
  "weather",
  "wsserver",
  "whitelist",
  "?",
  "w",
  "xp",
];

const MinecraftAddOnBlockedCommands = [
  "allowlist",
  "alwaysday",
  "changesetting",
  "connect",
  "daylock",
  "deop",
  "difficulty",
  "gamemode",
  "gamerule",
  "gametest",
  "help",
  "kick",
  "list",
  "locate",
  "op",
  "ops",
  "permission",
  "project",
  "reload",
  "reloadconfig",
  "save",
  "script",
  "setmaxplayers",
  "setworldspawn",
  "simulationtype",
  "stop",
  "tickingarea",
  "time",
  "transfer",
  "wsserver",
  "whitelist",
  "?",
];

export default class CommandRegistry {
  private static _registry?: CommandRegistry;

  private _commandsByName: {
    [name: string]: (context: IContext, name: string, argumentCollection: string[]) => Promise<ICommandResult>;
  } = {};
  private _commandsByScope: { [name: string]: CommandScope } = {};

  public static get main() {
    if (!this._registry) {
      this._registry = new CommandRegistry();

      this._registry.registerCommand(
        "sleep",
        CommandScope.any,
        async (context: IContext, name: string, args: string[]): Promise<ICommandResult> => {
          if (args.length === 1) {
            let delay = 0;
            try {
              delay = parseInt(args[0]);
            } catch (e) {}

            if (delay > 0) {
              context.creatorTools.notifyStatusUpdate("(Delaying commands for " + delay + "ms).");

              await Utilities.sleep(delay);
            }
          }

          return { status: CommandStatus.completed };
        }
      );
    }

    return this._registry;
  }

  registerCommand(
    commandName: string,
    commandScope: CommandScope,
    command: (context: IContext, name: string, argumentCollection: string[]) => Promise<ICommandResult>
  ) {
    commandName = commandName.toLowerCase();

    if (Utilities.isUsableAsObjectKey(commandName)) {
      this._commandsByName[commandName] = command;
      this._commandsByScope[commandName] = commandScope;
    } else {
      Log.unsupportedToken(commandName);
    }
  }

  logHelp() {
    let commandArr = [];

    for (const commandName in this._commandsByName) {
      commandArr.push(commandName);
    }

    commandArr = commandArr.sort();

    Log.message("Use help <command name> for more detailed help on a command.");

    for (let i = 0; i < commandArr.length; i++) {
      Log.message(commandArr[i]);
    }
  }

  static isMinecraftBuiltInCommand(name: string) {
    return MinecraftCommands.includes(name) || name === "#";
  }

  static isAddOnBlockedCommand(name: string) {
    return MinecraftAddOnBlockedCommands.includes(name);
  }

  /**
   * Create an IToolCommandOutput from IContext for ToolCommand execution.
   */
  private createToolCommandOutput(context: IContext): IToolCommandOutput {
    return {
      info: (msg) => {
        Log.message(msg);
        context.creatorTools.notifyStatusUpdate(msg);
      },
      success: (msg) => {
        Log.message("✓ " + msg);
        context.creatorTools.notifyStatusUpdate(msg);
      },
      warn: (msg) => Log.debug(msg),
      error: (msg) => Log.error(msg),
      debug: (msg) => Log.verbose(msg),
      progress: (current, total, msg) => {
        const pct = Math.round((current / total) * 100);
        context.creatorTools.notifyStatusUpdate(`[${pct}%] ${msg || ""}`);
      },
    };
  }

  /**
   * Create an IToolCommandContext from the app's IContext.
   */
  private createToolCommandContext(context: IContext): IToolCommandContext {
    return {
      creatorTools: context.creatorTools,
      project: context.project,
      minecraft: context.minecraft,
      output: this.createToolCommandOutput(context),
      scope: "ui",
    };
  }

  async runCommand(context: IContext, commandText: string): Promise<ICommandResult | undefined> {
    const command = CommandStructure.parse(commandText);

    if (!command || !command.fullName || !command.commandArguments) {
      return undefined;
    }

    // Initialize ToolCommands if not already done
    initializeToolCommands();

    // Check ToolCommandRegistry first (except for Minecraft built-in commands other than "help")
    // The "help" command is special - we want our unified help to handle it
    const toolRegistry = ToolCommandRegistry.instance;

    if (command.fullName === "help" || !CommandRegistry.isMinecraftBuiltInCommand(command.fullName)) {
      if (toolRegistry.has(command.fullName)) {
        const toolContext = this.createToolCommandContext(context);
        const result = await toolRegistry.execute(commandText, toolContext);

        if (result) {
          if (result.success) {
            return { status: CommandStatus.completed, data: result.data };
          } else {
            Log.error(result.error?.message || "Command failed");
            return { status: CommandStatus.invalidArguments };
          }
        }
      }
    }

    const scope = this._commandsByScope[command.fullName];
    const commandName = this._commandsByName[command.fullName];

    // Pass through Minecraft built-in commands (except "help" which is handled above)
    if (
      CommandRegistry.isMinecraftBuiltInCommand(command.fullName) &&
      command.fullName !== "help" &&
      context.minecraft
    ) {
      Log.debug("Sending '" + commandText + "' to Minecraft.");

      let result = await context.minecraft.runCommand(commandText);

      return {
        data: result,
        status: CommandStatus.completed,
      };
    } else if (scope && commandName) {
      if (
        (scope === CommandScope.debug ||
          scope === CommandScope.debugProject ||
          scope === CommandScope.debugMinecraft) &&
        !Utilities.isDebug
      ) {
        return undefined;
      }

      if ((scope === CommandScope.project || scope === CommandScope.debugProject) && !context.project) {
        Log.message("Could not run command '" + command.fullName + "'; no active project.");
        return undefined;
      }

      if ((scope === CommandScope.minecraft || scope === CommandScope.debugMinecraft) && !context.minecraft) {
        Log.message("Could not run command '" + command.fullName + "'; no active Minecraft deploy target was set.");
        return undefined;
      }

      if ((scope === CommandScope.host || scope === CommandScope.debugHost) && !context.host) {
        Log.message("Could not run command '" + command.fullName + "'; no host was set.");
        return undefined;
      }

      const result = await commandName(context, command.fullName, command.commandArguments);

      if (result.status === CommandStatus.invalidEnvironment) {
        Log.error("'" + command.fullName + "' was not set up properly.");
      } else if (result.status === CommandStatus.invalidArguments) {
        Log.error("'" + command.fullName + "' command arguments were not set up.");
      }

      return result;
    }

    context.creatorTools.notifyStatusUpdate("Could not find a command '" + command.fullName + "'.");
    return undefined;
  }
}
