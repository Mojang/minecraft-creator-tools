import Utilities from "../core/Utilities";

export enum CommandArgumentType {
  coordinate,
  unknown,
}

export enum CoordinateLocation {
  x,
  y,
  z,
}

export enum CoordinateType {
  absolute,
  relativeTilde,
  localCaret,
}

export default class CommandArgument {
  _content: string;

  _type: CommandArgumentType;
  _location?: CoordinateLocation;
  _coordinateType?: CoordinateType;
  _pos?: number;

  public get value() {
    if (this._type === CommandArgumentType.coordinate && this._pos !== undefined) {
      let result = this._pos.toString();

      if (this._coordinateType === CoordinateType.localCaret) {
        result = "^" + result;
      } else if (this._coordinateType === CoordinateType.relativeTilde) {
        result = "~" + result;
      }

      return result;
    }

    return this._content;
  }

  public get position() {
    if (this._pos === undefined) {
      return 0;
    }

    return this._pos;
  }

  public set position(value: number) {
    this._pos = value;
  }

  public get coordinateType() {
    if (this._coordinateType === undefined) {
      return CoordinateType.absolute;
    }

    return this._coordinateType;
  }

  public set coordinateType(type: CoordinateType) {
    this._coordinateType = type;
  }

  public get type() {
    return this._type;
  }

  public get location() {
    return this._location;
  }

  public set location(newLocation: CoordinateLocation | undefined) {
    this._location = newLocation;
  }

  public constructor(content: string) {
    this._content = content;
    this._type = CommandArgumentType.unknown;

    this.setValue(content);
  }

  private setValue(content: string) {
    this._content = content;

    const startsWithCaret = this._content.startsWith("^");
    const startsWithTilde = this._content.startsWith("~");

    if (startsWithCaret || startsWithTilde) {
      const substr = this._content.substring(1, this._content.length);

      if (Utilities.isNumeric(substr)) {
        this._type = CommandArgumentType.coordinate;

        if (startsWithTilde) {
          this._coordinateType = CoordinateType.relativeTilde;
        } else if (startsWithCaret) {
          this._coordinateType = CoordinateType.localCaret;
        }

        this._pos = parseInt(substr);
      } else {
        this._type = CommandArgumentType.unknown;
      }
    } else if (Utilities.isNumeric(this._content)) {
      this._type = CommandArgumentType.coordinate;
      this._coordinateType = CoordinateType.absolute;
      this._pos = parseInt(content);
    } else {
      this._type = CommandArgumentType.unknown;
    }
  }

  public toString() {
    return this.value;
  }
}
