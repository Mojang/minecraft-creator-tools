// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import Log from "../core/Log";
import Utilities from "../core/Utilities";
import IFile from "./IFile";
import IStorage from "./IStorage";
import StorageUtilities from "./StorageUtilities";

export enum StorageProxyCommands {
  fsExists = "fsExists",
  fsFolderExists = "fsFolderExists",
  fsMkdir = "fsMkdir",
  fsReadUtf8File = "fsReadUtf8File",
  fsReadFile = "fsReadFile",
  fsWriteUtf8File = "fsWriteUtf8File",
  fsWriteFile = "fsWriteFile",
  fsReaddir = "fsReaddir",
  fsStat = "fsStat",
  fsDeleteItem = "fsDeleteItem",
  getDirname = "getDirname",
  notifyFileAdded = "notifyFileAdded",
  notifyFileContentsUpdated = "notifyFileContentsUpdated",
  notifyFileRemoved = "notifyFileRemoved",
}
export interface ISubscribersRetriever {
  getSubscribers(id: string): any[] | undefined;
}

export default class StorageProxy {
  private _storage: IStorage;
  private _id: string;
  isReadOnly: boolean = false;
  encodeBinary: boolean = false;
  private _subscribersRetriever: any = undefined;
  private _sendMessage: (sender: any, command: string, id: string, message: any) => void;
  private _alternateContents: { [storageRelativePath: string]: string | Uint8Array | undefined } = {};

  constructor(
    storage: IStorage,
    id: string,
    sendMessage: (sender: any, command: string, id: string, message: any) => void,
    subscribersRetriever: ISubscribersRetriever
  ) {
    this._storage = storage;

    this.onFileAdded = this.onFileAdded.bind(this);
    this.onFileContentsUpdated = this.onFileContentsUpdated.bind(this);
    this.onFileRemoved = this.onFileRemoved.bind(this);

    this._storage.onFileAdded.subscribe(this.onFileAdded);
    this._storage.onFileContentsUpdated.subscribe(this.onFileContentsUpdated);
    this._storage.onFileRemoved.subscribe(this.onFileRemoved);

    this._id = id;
    this._subscribersRetriever = subscribersRetriever;
    this._sendMessage = sendMessage;
  }

  registerAlternateContents(storageRelativePath: string, contents: string | Uint8Array) {
    this._alternateContents[StorageUtilities.canonicalizePath(storageRelativePath)] = contents;
  }

  clearAlternateContents(storageRelativePath: string) {
    this._alternateContents[StorageUtilities.canonicalizePath(storageRelativePath)] = undefined;
  }

  onFileAdded(storage: IStorage, file: IFile) {
    const senders = this._subscribersRetriever.getSubscribers(this._id);

    if (!senders) {
      Log.unexpectedUndefined("OFA");
      return;
    }

    for (let i = 0; i < senders.length; i++) {
      this._sendMessage(senders[i], StorageProxyCommands.notifyFileAdded, this._id, file.storageRelativePath);
    }
  }

  onFileRemoved(storage: IStorage, path: string) {
    const senders = this._subscribersRetriever.getSubscribers(this._id);

    if (!senders) {
      Log.unexpectedUndefined("OFR");
      return;
    }

    for (let i = 0; i < senders.length; i++) {
      this._sendMessage(senders[i], StorageProxyCommands.notifyFileRemoved, this._id, path);
    }
  }

  onFileContentsUpdated(storage: IStorage, file: IFile) {
    const senders = this._subscribersRetriever.getSubscribers(this._id);

    if (!senders) {
      Log.unexpectedUndefined("OFCU");
      return;
    }

    for (let i = 0; i < senders.length; i++) {
      this._sendMessage(senders, StorageProxyCommands.notifyFileContentsUpdated, this._id, file.storageRelativePath);
    }
  }

  async processMessage(sender: any, command: string, id: string, data: any) {
    let baseCommandName = command;

    if (id.toLowerCase() !== this._id.toLowerCase()) {
      return;
    }

    if (baseCommandName.startsWith("async")) {
      baseCommandName = baseCommandName.substring(5);
    }

    const baseCommandSegments = baseCommandName.split("|");

    if (baseCommandSegments.length > 1) {
      baseCommandName = baseCommandSegments[0];
    }

    switch (baseCommandName) {
      case StorageProxyCommands.fsExists:
        await this.fileExists(sender, command, data);
        break;

      case StorageProxyCommands.fsFolderExists:
        await this.folderExists(sender, command, data);
        break;

      case StorageProxyCommands.fsMkdir:
        this.readOnlyCheck();

        await this.createDirectory(sender, command, data);
        break;

      case StorageProxyCommands.fsReadUtf8File:
        await this.readUtf8File(sender, command, data);
        break;

      case StorageProxyCommands.fsReadFile:
        await this.readFile(sender, command, data);
        break;

      case StorageProxyCommands.fsWriteFile:
        this.readOnlyCheck();
        await this.writeFile(sender, command, data);
        break;

      case StorageProxyCommands.fsWriteUtf8File:
        this.readOnlyCheck();

        await this.writeUtf8File(sender, command, data);
        break;

      case StorageProxyCommands.fsReaddir:
        await this.readDir(sender, command, data);
        break;
      case StorageProxyCommands.fsStat:
        await this.stat(sender, command, data);
        break;
    }
  }

  readOnlyCheck() {
    if (this.isReadOnly) {
      Log.fail("Trying to perform a write operation on read-only storage.");
      throw new Error("Trying to perform a write operation on read-only storage.");
    }
  }

  fileIsContainer() {}

  async writeUtf8File(sender: any, command: string, data: any) {
    Log.assert(typeof data.path === "string", "StorageProxy writeUtf8File not expected type.");

    const ensureFile = await this._storage.rootFolder.ensureFileFromRelativePath(data.path as string);

    if (!ensureFile) {
      this._sendMessage(sender, command, this._id, undefined);
      return;
    }

    // Log.verbose("Setting UTF8 content for '" + data.path + "' " + data.content);
    ensureFile.setContent(data.content);

    await ensureFile.saveContent();

    this._sendMessage(sender, command, this._id, undefined);
  }

  async writeFile(sender: any, command: string, data: any) {
    Log.assert(typeof data.path === "string", "Data path not expected string type.");

    const ensureFile = await this._storage.rootFolder.ensureFileFromRelativePath(data.path as string);

    if (!ensureFile) {
      this._sendMessage(sender, command, this._id, undefined);
      return;
    }

    if (typeof data.content === "string") {
      data.content = Utilities.base64ToUint8Array(data.content);
    }

    // Log.verbose("Setting content" + data.content);
    ensureFile.setContent(data.content);
    await ensureFile.saveContent();

    this._sendMessage(sender, command, this._id, undefined);
  }

  async readUtf8File(sender: any, command: string, data: any) {
    Log.assert(typeof data === "string", "SPRUF");

    const ensureFile = await this._storage.rootFolder.getFileFromRelativePath(data as string);

    if (!ensureFile) {
      this._sendMessage(sender, command, this._id, undefined);
      return;
    }

    const canonPath = StorageUtilities.canonicalizePath(ensureFile.fullPath);
    if (!ensureFile.isContentLoaded) {
      await ensureFile.loadContent();
    }

    if (this._alternateContents[canonPath] !== undefined) {
      Log.verbose("Loading alternate text content for '" + canonPath + "'");

      this._sendMessage(sender, command, this._id, this._alternateContents[canonPath]);
      return;
    }

    // Log.verbose("Reading UTF8 content for '" + ensureFile.fullPath + "' " + ensureFile.content);
    this._sendMessage(sender, command, this._id, ensureFile.content);
  }

  async readFile(sender: any, command: string, data: any) {
    Log.assert(typeof data === "string", "SPXRF");

    const ensureFile = await this._storage.rootFolder.getFileFromRelativePath(data as string);

    if (!ensureFile) {
      this._sendMessage(sender, command, this._id, undefined);
      return;
    }

    let content = undefined;

    if (!ensureFile.isContentLoaded) {
      await ensureFile.loadContent();
    }

    const canonPath = StorageUtilities.canonicalizePath(ensureFile.fullPath);

    if (this._alternateContents[canonPath] !== undefined) {
      // Log.debug("Loading alternate content for '" + canonPath + "'");
      content = this._alternateContents[canonPath];
    } else {
      content = ensureFile.content;
    }

    if (content && typeof content !== "string" && this.encodeBinary) {
      content = Utilities.arrayBufferToBase64(content);
    }
    // Log.verbose("Reading bin content for '" + ensureFile.fullPath + "' " + ensureFile.content);

    if (content === null) {
      content = "|null|";
    }

    this._sendMessage(sender, command, this._id, content);
  }

  async createDirectory(sender: any, command: string, data: any) {
    Log.assert(typeof data === "string", "SPXCD");

    const ensureFolder = await this._storage.rootFolder.ensureFolderFromRelativePath(data as string);

    if (!ensureFolder) {
      this._sendMessage(sender, command, this._id, false);
      return;
    }

    const ensureExistsResult = await ensureFolder.ensureExists();

    this._sendMessage(sender, command, this._id, ensureExistsResult);
  }

  async folderExists(sender: any, command: string, data: any) {
    Log.assert(typeof data === "string", "SPXFOE");

    const folder = await this._storage.rootFolder.getFolderFromRelativePath(data as string);

    if (!folder) {
      this._sendMessage(sender, command, this._id, false);
      return;
    }

    const resultFolder = await folder.exists();

    this._sendMessage(sender, command, this._id, resultFolder);
  }

  async readDir(sender: any, command: string, data: any) {
    Log.assert(typeof data === "string", "SPXRD");

    const folder = await this._storage.rootFolder.getFolderFromRelativePath(data as string);

    if (!folder) {
      this._sendMessage(sender, command, this._id, []);
      return;
    }

    if (!folder.isLoaded) {
      await folder.load();
    }

    const fileNames: string[] = [];

    for (const fileName in folder.files) {
      fileNames.push(fileName);
    }
    for (const folderName in folder.folders) {
      fileNames.push(folderName);
    }

    this._sendMessage(sender, command, this._id, fileNames);
  }

  async stat(sender: any, command: string, data: any) {
    Log.assert(typeof data === "string", "SPXST");

    const folder = await this._storage.rootFolder.getFolderFromRelativePath(data as string);

    if (!folder) {
      const file = await this._storage.rootFolder.getFileFromRelativePath(data as string);

      if (file) {
        this._sendMessage(sender, command, this._id, { isDirectory: false, isFile: true, mtime: file.modified });
      } else {
        this._sendMessage(sender, command, this._id, undefined);
      }

      return;
    }

    if (!folder.isLoaded) {
      await folder.load();
    }

    this._sendMessage(sender, command, this._id, { isDirectory: true, isFile: false });
  }

  async fileExists(sender: any, command: string, data: any) {
    Log.assert(typeof data === "string", "SPXFE");

    const file = await this._storage.rootFolder.getFileFromRelativePath(data as string);

    if (!file) {
      this._sendMessage(sender, command, this._id, false);
      return;
    }

    const result = await file.exists;

    this._sendMessage(sender, command, this._id, result);
  }
}
