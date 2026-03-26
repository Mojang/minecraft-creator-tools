import MementoFolder from "./MementoFolder";
import StorageBase from "../storage/StorageBase";
import IStorage from "../storage/IStorage";
import * as vscode from "vscode";

export default class MementoStorage extends StorageBase implements IStorage {
  rootFolder: MementoFolder;
  memento: vscode.Memento;

  constructor(memento: vscode.Memento, name: string | null) {
    super();

    this.memento = memento;

    if (name == null) {
      name = "";
    } else {
      name = "." + name;
    }

    this.rootFolder = new MementoFolder(this, null, "mems" + name, "root");
  }

  async getAvailable() {
    this.available = true;

    return this.available;
  }
}
