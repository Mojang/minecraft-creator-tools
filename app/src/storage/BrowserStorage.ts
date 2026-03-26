// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import BrowserFolder from "./BrowserFolder";
import StorageBase from "./StorageBase";
import IStorage from "./IStorage";
import localforage from "localforage";

export default class BrowserStorage extends StorageBase implements IStorage {
  rootFolder: BrowserFolder;
  static isConfigured: boolean = false;

  /**
   * The name used to construct this storage instance.
   * Used for BrowserStorage pointer mode when transferring to web workers.
   */
  readonly storageName: string | null;

  static ensureConfigured() {
    if (!BrowserStorage.isConfigured) {
      localforage.config({
        name: "Minecraft Creator Tools",
        storeName: "minecraft_creator_tools",
        version: 1.0,
        // Use IndexedDB driver - this works in both main thread and web workers
        // (localStorage requires window object which is not available in workers)
        driver: localforage.INDEXEDDB,
      });

      BrowserStorage.isConfigured = true;
    }
  }

  constructor(name: string | null) {
    super();

    // Store the original name for worker pointer mode
    this.storageName = name;

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
