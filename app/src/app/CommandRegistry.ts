import Log from "../core/Log";
import Utilities from "../core/Utilities";
import { CommandStatus, ICommandResult } from "./ICommand";
import IContext from "./IContext";

export enum CommandScope {
  any = 0,
  project = 1,
  minecraft = 2,
  carto = 3,
  host = 4,

  debug = 10,
  debugProject = 11,
  debugMinecraft = 12,
  debugHost = 14,
}

const MinecraftCommands = [
  "allowlist",
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
    const results = this.parse(commandText);

    if (!results || !results.commandName || !results.commandArguments) {
      return undefined;
    }

    if (results.commandName === "help") {
      if (arguments.length === 1) {
      } else {
        this.logHelp();
        return { status: CommandStatus.completed };
      }
    }

    if (MinecraftCommands.includes(results.commandName) && context.minecraft) {
      Log.debug("Sending '" + commandText + "' to Minecraft.");
      context.minecraft.runCommand(commandText);
      return;
    }

    const scope = this._commandsByScope[results.commandName];
    const command = this._commandsByName[results.commandName];

    if (scope === undefined || command === undefined) {
      Log.message("Could not find a command '" + results.commandName + "'");
      return undefined;
    }

    if (
      (scope === CommandScope.debug || scope === CommandScope.debugProject || scope === CommandScope.debugMinecraft) &&
      !Utilities.isDebug
    ) {
      return undefined;
    }

    if ((scope === CommandScope.project || scope === CommandScope.debugProject) && !context.project) {
      Log.message("Could not run command '" + results.commandName + "'; no active project.");
      return undefined;
    }

    if ((scope === CommandScope.minecraft || scope === CommandScope.debugMinecraft) && !context.minecraft) {
      Log.message("Could not run command '" + results.commandName + "'; no active Minecraft deploy target was set.");
      return undefined;
    }

    if ((scope === CommandScope.host || scope === CommandScope.debugHost) && !context.host) {
      Log.message("Could not run command '" + results.commandName + "'; no host was set.");
      return undefined;
    }

    const result = await command(context, results.commandName, results.commandArguments);

    if (result.status === CommandStatus.invalidEnvironment) {
      Log.error("'" + results.commandName + "' was not set up properly.");
    } else if (result.status === CommandStatus.invalidArguments) {
      Log.error("'" + results.commandName + "' command arguments were not set up.");
    }

    return result;
  }

  parse(commandText: string) {
    let commandName = undefined;

    if (commandText.startsWith("/")) {
      commandText = commandText.substring(1, commandText.length);
    }

    const firstSpace = commandText.indexOf(" ");

    const parseArgs: string[] = [];

    if (firstSpace < 0) {
      commandName = commandText.toLowerCase();
    } else {
      commandName = commandText.substring(0, firstSpace).toLowerCase();

      const argumentStr = commandText.substring(firstSpace + 1);

      let nextSpace = argumentStr.indexOf(" ");
      let nextDoubleQuote = argumentStr.indexOf('"');
      let nextSingleQuote = argumentStr.indexOf("'");
      let startIndex = 0;

      while (nextSpace >= 0) {
        let processedNextSegment = false;
        if (
          nextDoubleQuote > 0 &&
          nextDoubleQuote < nextSpace &&
          (nextSingleQuote < 0 || nextSingleQuote > nextDoubleQuote)
        ) {
          let nextNextDoubleQuote = argumentStr.indexOf('"', nextDoubleQuote + 1);

          if (nextNextDoubleQuote > nextDoubleQuote) {
            parseArgs.push(argumentStr.substring(startIndex, nextNextDoubleQuote));
            startIndex = nextNextDoubleQuote + 1;

            if (startIndex < argumentStr.length) {
              nextSpace = argumentStr.indexOf(" ", startIndex);
              nextDoubleQuote = argumentStr.indexOf('"', startIndex);
              nextSingleQuote = argumentStr.indexOf("'", startIndex);
            }
            processedNextSegment = true;
          }
        } else if (nextSingleQuote > 0 && nextSingleQuote < nextSpace) {
          const nextNextSingleQuote = argumentStr.indexOf("'", nextSingleQuote + 1);

          if (nextNextSingleQuote > nextSingleQuote) {
            parseArgs.push(argumentStr.substring(startIndex, nextNextSingleQuote));
            startIndex = nextNextSingleQuote + 1;

            if (startIndex < argumentStr.length) {
              nextSpace = argumentStr.indexOf(" ", startIndex);
              nextDoubleQuote = argumentStr.indexOf('"', startIndex);
              nextSingleQuote = argumentStr.indexOf("'", startIndex);
            }
            processedNextSegment = true;
          }
        }

        if (!processedNextSegment) {
          parseArgs.push(argumentStr.substring(startIndex, nextSpace));

          startIndex = nextSpace + 1;

          if (startIndex < argumentStr.length) {
            nextSpace = argumentStr.indexOf(" ", startIndex);
            nextDoubleQuote = argumentStr.indexOf('"', startIndex);
            nextSingleQuote = argumentStr.indexOf("'", startIndex);
          }
        }
      }

      parseArgs.push(argumentStr.substring(startIndex));
    }

    return {
      commandName: commandName,
      commandArguments: parseArgs, // arguments is a keyword, so commandArguments here.
    };
  }
}
