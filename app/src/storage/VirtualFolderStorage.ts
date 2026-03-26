// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * VirtualFolderStorage
 *
 * A storage implementation that creates a virtual folder structure from multiple
 * real folders. This is used to expose the dedicated server's content (behavior_packs,
 * resource_packs, world) as a unified storage.
 *
 * The virtual storage maps named paths to real folders:
 * - /behavior_packs/ -> development_behavior_packs folder
 * - /resource_packs/ -> development_resource_packs folder
 * - /world/ -> worlds/defaultWorld folder
 */

import IFolder from "./IFolder";
import IFile from "./IFile";
import IStorage from "./IStorage";
import StorageBase from "./StorageBase";
import FolderBase from "./FolderBase";

export interface IVirtualFolderMapping {
  /** The virtual path name (e.g., "behavior_packs") */
  virtualName: string;
  /** The real folder to map to this virtual path */
  realFolder: IFolder;
}

/**
 * A virtual folder that delegates to real folders based on a mapping.
 * This creates a unified view of multiple storage locations.
 */
export default class VirtualFolderStorage extends StorageBase implements IStorage {
  rootFolder: VirtualRootFolder;
  private _mappings: IVirtualFolderMapping[] = [];

  constructor(mappings?: IVirtualFolderMapping[]) {
    super();

    this.rootFolder = new VirtualRootFolder(this);
    this.readOnly = true; // Virtual storage is read-only by default

    if (mappings) {
      for (const mapping of mappings) {
        this.addMapping(mapping);
      }
    }
  }

  /**
   * Add a folder mapping to the virtual storage.
   * @param mapping The mapping to add
   */
  addMapping(mapping: IVirtualFolderMapping) {
    this._mappings.push(mapping);
    this.rootFolder.addVirtualSubfolder(mapping.virtualName, mapping.realFolder);
  }

  /**
   * Remove a folder mapping from the virtual storage.
   * @param virtualName The virtual name to remove
   */
  removeMapping(virtualName: string) {
    this._mappings = this._mappings.filter((m) => m.virtualName !== virtualName);
    this.rootFolder.removeVirtualSubfolder(virtualName);
  }

  /**
   * Get all current mappings.
   */
  getMappings(): IVirtualFolderMapping[] {
    return [...this._mappings];
  }

  async getAvailable(): Promise<boolean> {
    this.available = true;
    return this.available;
  }

  getUsesPollingBasedUpdating(): boolean {
    return false;
  }

  async incrementalScanForChanges(): Promise<void> {
    // Scan each mapped folder for changes
    for (const mapping of this._mappings) {
      if (mapping.realFolder.storage) {
        await mapping.realFolder.storage.incrementalScanForChanges();
      }
    }
  }
}

/**
 * The root folder of a VirtualFolderStorage.
 * Maps virtual folder names to real folder implementations.
 */
class VirtualRootFolder extends FolderBase implements IFolder {
  private _storage: VirtualFolderStorage;
  private _virtualFolders: Map<string, IFolder> = new Map();
  private _name = "";

  folders: { [name: string]: IFolder | undefined } = {};
  files: { [name: string]: IFile | undefined } = {}; // Root folder has no files

  get name(): string {
    return this._name;
  }

  get parentFolder(): IFolder | null {
    return null;
  }

  get storage(): IStorage {
    return this._storage;
  }

  get fullPath(): string {
    return "/";
  }

  get extendedPath(): string {
    return "/";
  }

  constructor(storage: VirtualFolderStorage) {
    super();
    this._storage = storage;
  }

  addVirtualSubfolder(name: string, realFolder: IFolder): void {
    this._virtualFolders.set(name, realFolder);
    this.folders[name] = realFolder;
  }

  removeVirtualSubfolder(name: string): void {
    this._virtualFolders.delete(name);
    delete this.folders[name];
  }

  ensureFolder(name: string): IFolder {
    const existing = this._virtualFolders.get(name);
    if (existing) {
      return existing;
    }
    throw new Error(`Virtual folder '${name}' does not exist`);
  }

  ensureFile(_name: string): IFile {
    throw new Error("Cannot create files in virtual root folder");
  }

  async exists(): Promise<boolean> {
    return true;
  }

  async ensureExists(): Promise<boolean> {
    return true;
  }

  async load(_force?: boolean): Promise<Date> {
    // Load all virtual subfolders
    for (const folder of this._virtualFolders.values()) {
      await folder.load(_force);
    }
    return new Date();
  }

  async saveAll(_force?: boolean): Promise<boolean> {
    // Save all virtual subfolders
    for (const folder of this._virtualFolders.values()) {
      await folder.saveAll(_force);
    }
    return true;
  }

  async moveTo(_newStorageRelativePath: string): Promise<boolean> {
    throw new Error("Cannot move virtual root folder");
  }

  async rename(_newName: string): Promise<boolean> {
    throw new Error("Cannot rename virtual root folder");
  }

  async deleteThisFolder(): Promise<boolean> {
    throw new Error("Cannot delete virtual root folder");
  }

  async deleteFile(_name: string): Promise<boolean> {
    throw new Error("No files in virtual root folder");
  }

  async deleteFileFromRelativePath(_path: string): Promise<boolean> {
    throw new Error("Cannot delete files from virtual root folder");
  }

  async createFile(_name: string): Promise<IFile> {
    throw new Error("Cannot create files in virtual root folder");
  }

  async deleteAllFolderContents(): Promise<boolean> {
    throw new Error("Cannot delete virtual root folder contents");
  }

  removeFolder(_name: string): boolean {
    return false;
  }

  getFolderFromRelativePathLocal(relativePath: string): IFolder | undefined {
    const parts = relativePath.split("/").filter((p) => p.length > 0);
    if (parts.length === 0) {
      return this;
    }

    const firstPart = parts[0];
    const folder = this._virtualFolders.get(firstPart);
    if (!folder) {
      return undefined;
    }

    if (parts.length === 1) {
      return folder;
    }

    const remainingPath = parts.slice(1).join("/");
    return folder.getFolderFromRelativePathLocal(remainingPath);
  }

  getFolderByIndex(index: number): IFolder | undefined {
    const keys = this.getSortedFolderKeys();
    if (index < 0 || index >= keys.length) {
      return undefined;
    }
    return this.folders[keys[index]];
  }

  getSortedFolderKeys(): string[] {
    return Array.from(this._virtualFolders.keys()).sort();
  }

  getSortedFileKeys(): string[] {
    return [];
  }

  async ensureFolderFromRelativePath(relativePath: string): Promise<IFolder> {
    const result = await this.getFolderFromRelativePath(relativePath);
    if (!result) {
      throw new Error(`Folder not found: ${relativePath}`);
    }
    return result;
  }

  async ensureFileFromRelativePath(_relativePath: string): Promise<IFile> {
    throw new Error("Cannot create files in virtual root folder");
  }

  async setStructureFromFileList(_fileList: string[]): Promise<void> {
    throw new Error("Cannot set structure on virtual root folder");
  }

  clearAllManagers(): void {
    // No-op for virtual folder
  }

  getFolderRelativePath(_toFolder: IFolder): string | undefined {
    return undefined;
  }

  folderExists(name: string): boolean {
    return this._virtualFolders.has(name);
  }

  fileExists(_name: string): boolean {
    return false;
  }

  async getFileFromRelativePath(relativePath: string): Promise<IFile | undefined> {
    const parts = relativePath.split("/").filter((p) => p.length > 0);
    if (parts.length === 0) {
      return undefined;
    }

    const firstPart = parts[0];
    const folder = this._virtualFolders.get(firstPart);
    if (!folder) {
      return undefined;
    }

    const remainingPath = parts.slice(1).join("/");
    if (remainingPath.length === 0) {
      return undefined;
    }

    return folder.getFileFromRelativePath(remainingPath);
  }

  async getFolderFromRelativePath(relativePath: string): Promise<IFolder | undefined> {
    const parts = relativePath.split("/").filter((p) => p.length > 0);
    if (parts.length === 0) {
      return this;
    }

    const firstPart = parts[0];
    const folder = this._virtualFolders.get(firstPart);
    if (!folder) {
      return undefined;
    }

    if (parts.length === 1) {
      return folder;
    }

    const remainingPath = parts.slice(1).join("/");
    return folder.getFolderFromRelativePath(remainingPath);
  }

  async scanForChanges(): Promise<void> {
    for (const folder of this._virtualFolders.values()) {
      await folder.scanForChanges();
    }
  }
}
