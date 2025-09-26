// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import BrowserFolder from "./BrowserFolder";
import StorageBase from "./StorageBase";
import IStorage from "./IStorage";
import localforage from "localforage";

export default class BrowserStorage extends StorageBase implements IStorage {
  rootFolder: BrowserFolder;
  static isConfigured: boolean = false;

  static ensureConfigured() {
    if (!BrowserStorage.isConfigured) {
      localforage.config({
        name: "Minecraft Creator Tools",
        storeName: "minecraft_creator_tools",
        version: 1.0,
      });

      BrowserStorage.isConfigured = true;
    }
  }

  constructor(name: string | null) {
    super();

    if (name == null) {
      name = "";
    } else {
      name = "." + name;
    }

    BrowserStorage.ensureConfigured();

    this.rootFolder = new BrowserFolder(this, null, "fs" + name, "root");
  }

  async getAvailable() {
    this.available = true;

    return this.available;
  }
}
