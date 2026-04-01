// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import Log from "../core/Log";
import Utilities from "../core/Utilities";
import IFile from "./IFile";
import IStorage, { IFileUpdateEvent } from "./IStorage";
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

  /**
   * Converts an absolute path (which may include the storage root URI) to a relative path.
   * The MessageProxyStorage on the webview side sends full paths like "vscode-test-web://mount/subfolder/"
   * but getFolderFromRelativePath expects paths like "/subfolder/".
   */
  private toRelativePath(absolutePath: string): string {
    // Get the storage root path (e.g., "vscode-test-web://mount/" or "file:///c:/workspace/")
    const storageRoot = this._storage.rootFolder.fullPath;

    // If the absolute path starts with the storage root, strip it
    if (absolutePath.toLowerCase().startsWith(storageRoot.toLowerCase())) {
      let relativePath = absolutePath.substring(storageRoot.length);
      // Ensure it starts with /
      if (!relativePath.startsWith("/")) {
        relativePath = "/" + relativePath;
      }
      return relativePath;
    }

    // If it's already a relative path starting with /, return as-is
    if (absolutePath.startsWith("/")) {
      return absolutePath;
    }

    // Otherwise, treat as relative and prepend /
    return "/" + absolutePath;
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

  onFileContentsUpdated(storage: IStorage, fileEvent: IFileUpdateEvent) {
    const senders = this._subscribersRetriever.getSubscribers(this._id);

    if (!senders) {
      Log.unexpectedUndefined("OFCU");
      return;
    }

    for (let i = 0; i < senders.length; i++) {
      this._sendMessage(
        senders,
        StorageProxyCommands.notifyFileContentsUpdated,
        this._id,
        fileEvent.file.storageRelativePath
      );
    }
  }

  /**
   * Normalizes a path/ID by removing trailing slashes for comparison purposes.
   */
  private normalizeId(id: string): string {
    // Remove trailing slashes for consistent comparison
    while (id.endsWith("/") || id.endsWith("\\")) {
      id = id.substring(0, id.length - 1);
    }
    return id.toLowerCase();
  }

  /**
   * Checks if an incoming message ID matches this storage proxy.
   * Returns true if the ID matches exactly or if the ID is a child path of this storage's root.
   */
  private matchesId(incomingId: string): boolean {
    const normalizedIncoming = this.normalizeId(incomingId);
    const normalizedSelf = this.normalizeId(this._id);

    // Exact match
    if (normalizedIncoming === normalizedSelf) {
      Log.verbose(`StorageProxy matchesId: exact match for ${incomingId}`);
      return true;
    }

    // Check if incoming ID is a child path of this storage's root
    // e.g., "vscode-test-web://mount/project/subfolder" matches storage "vscode-test-web://mount/project"
    if (normalizedIncoming.startsWith(normalizedSelf + "/") || normalizedIncoming.startsWith(normalizedSelf + "\\")) {
      Log.verbose(`StorageProxy matchesId: child path match for ${incomingId} under ${this._id}`);
      return true;
    }

    Log.verbose(`StorageProxy matchesId: NO match - incoming=${incomingId}, self=${this._id}`);
    return false;
  }

  async processMessage(sender: any, command: string, id: string, data: any) {
    let baseCommandName = command;

    // Check if this message is for this storage proxy (exact match or child path)
    if (!this.matchesId(id)) {
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
        await this.fileExists(sender, command, id, data);
        break;

      case StorageProxyCommands.fsFolderExists:
        await this.folderExists(sender, command, id, data);
        break;

      case StorageProxyCommands.fsMkdir:
        this.readOnlyCheck();

        await this.createDirectory(sender, command, id, data);
        break;

      case StorageProxyCommands.fsReadUtf8File:
        await this.readUtf8File(sender, command, id, data);
        break;

      case StorageProxyCommands.fsReadFile:
        await this.readFile(sender, command, id, data);
        break;

      case StorageProxyCommands.fsWriteFile:
        this.readOnlyCheck();
        await this.writeFile(sender, command, id, data);
        break;

      case StorageProxyCommands.fsWriteUtf8File:
        this.readOnlyCheck();

        await this.writeUtf8File(sender, command, id, data);
        break;

      case StorageProxyCommands.fsReaddir:
        await this.readDir(sender, command, id, data);
        break;
      case StorageProxyCommands.fsStat:
        await this.stat(sender, command, id, data);
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

  async writeUtf8File(sender: any, command: string, requestId: string, data: any) {
    Log.assert(typeof data.path === "string", "StorageProxy writeUtf8File not expected type.");

    const relativePath = this.toRelativePath(data.path as string);
    const ensureFile = await this._storage.rootFolder.ensureFileFromRelativePath(relativePath);

    if (!ensureFile) {
      this._sendMessage(sender, command, requestId, undefined);
      return;
    }

    // Log.verbose("Setting UTF8 content for '" + data.path + "' " + data.content);
    ensureFile.setContent(data.content);

    await ensureFile.saveContent();

    this._sendMessage(sender, command, requestId, undefined);
  }

  async writeFile(sender: any, command: string, requestId: string, data: any) {
    Log.assert(typeof data.path === "string", "Data path not expected string type.");

    const relativePath = this.toRelativePath(data.path as string);
    const ensureFile = await this._storage.rootFolder.ensureFileFromRelativePath(relativePath);

    if (!ensureFile) {
      this._sendMessage(sender, command, requestId, undefined);
      return;
    }

    if (typeof data.content === "string") {
      data.content = Utilities.base64ToUint8Array(data.content);
    }

    // Log.verbose("Setting content" + data.content);
    ensureFile.setContent(data.content);
    await ensureFile.saveContent();

    this._sendMessage(sender, command, requestId, undefined);
  }

  async readUtf8File(sender: any, command: string, requestId: string, data: any) {
    Log.assert(typeof data === "string", "SPRUF");

    const relativePath = this.toRelativePath(data as string);
    const ensureFile = await this._storage.rootFolder.getFileFromRelativePath(relativePath);

    if (!ensureFile) {
      this._sendMessage(sender, command, requestId, undefined);
      return;
    }

    const canonPath = StorageUtilities.canonicalizePath(ensureFile.fullPath);
    if (!ensureFile.isContentLoaded) {
      await ensureFile.loadContent();
    }

    if (this._alternateContents[canonPath] !== undefined) {
      Log.verbose("Loading alternate text content for '" + canonPath + "'");

      this._sendMessage(sender, command, requestId, this._alternateContents[canonPath]);
      return;
    }

    // Log.verbose("Reading UTF8 content for '" + ensureFile.fullPath + "' " + ensureFile.content);
    this._sendMessage(sender, command, requestId, ensureFile.content);
  }

  async readFile(sender: any, command: string, requestId: string, data: any) {
    Log.assert(typeof data === "string", "SPXRF");

    const relativePath = this.toRelativePath(data as string);
    const ensureFile = await this._storage.rootFolder.getFileFromRelativePath(relativePath);

    if (!ensureFile) {
      this._sendMessage(sender, command, requestId, undefined);
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
      content = Utilities.arrayBufferToBase64(content as any);
    }
    // Log.verbose("Reading bin content for '" + ensureFile.fullPath + "' " + ensureFile.content);

    if (content === null) {
      content = "|null|";
    }

    this._sendMessage(sender, command, requestId, content);
  }

  async createDirectory(sender: any, command: string, requestId: string, data: any) {
    Log.assert(typeof data === "string", "SPXCD");

    const relativePath = this.toRelativePath(data as string);
    const ensureFolder = await this._storage.rootFolder.ensureFolderFromRelativePath(relativePath);

    if (!ensureFolder) {
      this._sendMessage(sender, command, requestId, false);
      return;
    }

    const ensureExistsResult = await ensureFolder.ensureExists();

    this._sendMessage(sender, command, requestId, ensureExistsResult);
  }

  async folderExists(sender: any, command: string, requestId: string, data: any) {
    Log.assert(typeof data === "string", "SPXFOE");

    const relativePath = this.toRelativePath(data as string);
    const folder = await this._storage.rootFolder.getFolderFromRelativePath(relativePath);

    if (!folder) {
      this._sendMessage(sender, command, requestId, false);
      return;
    }

    const resultFolder = await folder.exists();

    this._sendMessage(sender, command, requestId, resultFolder);
  }

  async readDir(sender: any, command: string, requestId: string, data: any) {
    Log.assert(typeof data === "string", "SPXRD");

    const relativePath = this.toRelativePath(data as string);
    const folder = await this._storage.rootFolder.getFolderFromRelativePath(relativePath);

    if (!folder) {
      this._sendMessage(sender, command, requestId, []);
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

    this._sendMessage(sender, command, requestId, fileNames);
  }

  async stat(sender: any, command: string, requestId: string, data: any) {
    Log.assert(typeof data === "string", "SPXST");

    const relativePath = this.toRelativePath(data as string);
    const folder = await this._storage.rootFolder.getFolderFromRelativePath(relativePath);

    if (!folder) {
      const file = await this._storage.rootFolder.getFileFromRelativePath(relativePath);

      if (file) {
        this._sendMessage(sender, command, requestId, { isDirectory: false, isFile: true, mtime: file.modified });
      } else {
        this._sendMessage(sender, command, requestId, undefined);
      }

      return;
    }

    if (!folder.isLoaded) {
      await folder.load();
    }

    this._sendMessage(sender, command, requestId, { isDirectory: true, isFile: false });
  }

  async fileExists(sender: any, command: string, requestId: string, data: any) {
    Log.assert(typeof data === "string", "SPXFE");

    const relativePath = this.toRelativePath(data as string);
    const file = await this._storage.rootFolder.getFileFromRelativePath(relativePath);

    if (!file) {
      this._sendMessage(sender, command, requestId, false);
      return;
    }

    const result = await file.exists;

    this._sendMessage(sender, command, requestId, result);
  }
}
