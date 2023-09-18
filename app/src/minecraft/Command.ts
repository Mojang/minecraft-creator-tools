import CommandArgument, { CoordinateLocation, CommandArgumentType, CoordinateType } from "./CommandArgument";

export default class Command {
  _commandName: string;
  _arguments: CommandArgument[];

  constructor(commandText: string) {
    const firstSpace = commandText.indexOf(" ");

    this._arguments = [];

    let _coordinatePos = -1;

    if (firstSpace < 0) {
      this._commandName = commandText;
    } else {
      this._commandName = commandText.substring(0, firstSpace);

      const args = commandText.substring(firstSpace + 1, commandText.length).split(" ");

      for (let i = 0; i < args.length; i++) {
        const cmdArg = new CommandArgument(args[i]);

        if (cmdArg.type === CommandArgumentType.coordinate) {
          _coordinatePos++;

          if (_coordinatePos >= 3) {
            _coordinatePos = 0;
          }

          if (_coordinatePos === 0) {
            cmdArg.location = CoordinateLocation.x;
          } else if (_coordinatePos === 1) {
            cmdArg.location = CoordinateLocation.y;
          } else if (_coordinatePos === 2) {
            cmdArg.location = CoordinateLocation.z;
          }
        } else {
          _coordinatePos = -1;
        }

        this._arguments.push(cmdArg);
      }
    }

    if (this._commandName.startsWith("/")) {
      this._commandName = this._commandName.substring(1, this._commandName.length);
    }
  }

  absolutizeCoordinates(absoluteX: number, absoluteY: number, absoluteZ: number) {
    for (let i = 0; i < this._arguments.length; i++) {
      const arg = this._arguments[i];

      if (arg.type === CommandArgumentType.coordinate) {
        if (arg.coordinateType === CoordinateType.relativeTilde) {
          if (arg.location === CoordinateLocation.x) {
            arg.coordinateType = CoordinateType.absolute;
            arg.position = absoluteX + arg.position;
          } else if (arg.location === CoordinateLocation.y) {
            arg.coordinateType = CoordinateType.absolute;
            arg.position = absoluteY + arg.position;
          } else if (arg.location === CoordinateLocation.z) {
            arg.coordinateType = CoordinateType.absolute;
            arg.position = absoluteZ + arg.position;
          }
        }
      }
    }
  }

  get hasRelativeOrLocalCoordinates() {
    for (let i = 0; i < this._arguments.length; i++) {
      const arg = this._arguments[i];

      if (arg.type === CommandArgumentType.coordinate && arg.coordinateType !== CoordinateType.absolute) {
        return true;
      }
    }

    return false;
  }

  get firstX() {
    for (let i = 0; i < this._arguments.length; i++) {
      const arg = this._arguments[i];

      if (arg.type === CommandArgumentType.coordinate && arg.location === CoordinateLocation.x) {
        return arg;
      }
    }

    return undefined;
  }

  get firstY() {
    for (let i = 0; i < this._arguments.length; i++) {
      const arg = this._arguments[i];

      if (arg.type === CommandArgumentType.coordinate && arg.location === CoordinateLocation.y) {
        return arg;
      }
    }

    return undefined;
  }

  get firstZ() {
    for (let i = 0; i < this._arguments.length; i++) {
      const arg = this._arguments[i];

      if (arg.type === CommandArgumentType.coordinate && arg.location === CoordinateLocation.z) {
        return arg;
      }
    }

    return undefined;
  }

  toString() {
    let commandResult = this._commandName;

    for (let i = 0; i < this._arguments.length; i++) {
      commandResult += " ";

      commandResult += this._arguments[i].toString();
    }

    return commandResult;
  }
}
