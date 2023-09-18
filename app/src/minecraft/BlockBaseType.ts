import IBlockBaseTypeData from "./IBlockBaseTypeData";

export default class BlockBaseType {
  private _name = "";

  public data: IBlockBaseTypeData;

  get icon() {
    return this.data.icon;
  }

  getProperty(name: string) {
    if (this.data.properties === undefined) {
      return undefined;
    }

    for (let i = 0; i < this.data.properties.length; i++) {
      if (this.data.properties[i].name === name) {
        return this.data.properties[i];
      }
    }

    throw new Error();
  }

  get isOpaque() {
    if (this.data.isOpaque === undefined) {
      return false;
    }

    return this.data.isOpaque;
  }

  get shape() {
    if (this.data.shape === undefined) {
      return false;
    }

    return this.data.shape;
  }

  get name() {
    return this._name;
  }

  constructor(name: string) {
    this._name = name;

    this.data = {
      name: name,
    };
  }
}
