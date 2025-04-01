import IMolangNode from "./IMolangNode";

export default class MolangNode {
  _data: IMolangNode;

  get data() {
    return this._data;
  }

  constructor(data: IMolangNode) {
    this._data = data;
  }
}
