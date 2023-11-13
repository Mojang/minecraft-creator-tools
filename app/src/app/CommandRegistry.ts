import Log from "../core/Log";
import Utilities from "../core/Utilities";
import CommandStructure from "./CommandStructure";
import { CommandStatus, ICommandResult } from "./ICommand";
import IContext from "./IContext";

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
  "allowlist",
  "camera",
  "camerashake",
  "changesetting",
  "clear",
  "clearspawnpoint",
  "clone",
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
  "give",
  "help",
  "inputpermission",
  "kick",
  "kill",
  "list",
  "locate",
  "loot",
  "me",
  "mobevent",
  "music",
  "op",
  "particle",
  "permission",
  "playanimation",
  "playsound",
  "reload",
  "replaceitem",
  "ride",
  "save",
  "say",
  "schedule",
  "scoreboard",
  "script",
  "setblock",
  "setmaxplayers",
  "setworldspawn",
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
  "time",
  "title",
  "titleraw",
  "toggledownfall",
  "weather",
  "wsserver",
  "xp",
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
              context.carto.notifyStatusUpdate("(Delaying commands for " + delay + "ms).");

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
    this._commandsByName[commandName] = command;
    this._commandsByScope[commandName] = commandScope;
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

  async runCommand(context: IContext, commandText: string): Promise<ICommandResult | undefined> {
    const command = CommandStructure.parse(commandText);

    if (!command || !command.name || !command.commandArguments) {
      return undefined;
    }

    const scope = this._commandsByScope[command.name];
    const commandName = this._commandsByName[command.name];

    if (command.name === "help") {
      this.logHelp();
      return { status: CommandStatus.completed };
    } else if (MinecraftCommands.includes(command.name) && context.minecraft) {
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
        Log.message("Could not run command '" + command.name + "'; no active project.");
        return undefined;
      }

      if ((scope === CommandScope.minecraft || scope === CommandScope.debugMinecraft) && !context.minecraft) {
        Log.message("Could not run command '" + command.name + "'; no active Minecraft deploy target was set.");
        return undefined;
      }

      if ((scope === CommandScope.host || scope === CommandScope.debugHost) && !context.host) {
        Log.message("Could not run command '" + command.name + "'; no host was set.");
        return undefined;
      }

      const result = await commandName(context, command.name, command.commandArguments);

      if (result.status === CommandStatus.invalidEnvironment) {
        Log.error("'" + command.name + "' was not set up properly.");
      } else if (result.status === CommandStatus.invalidArguments) {
        Log.error("'" + command.name + "' command arguments were not set up.");
      }

      return result;
    }

    context.carto.notifyStatusUpdate("Could not find a command '" + command.name + "'.");
    return undefined;
  }
}
