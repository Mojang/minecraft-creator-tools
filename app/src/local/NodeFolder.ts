// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFolder, { FolderErrorStatus } from "../storage/IFolder";
import IFile from "../storage/IFile";
import NodeFile from "./NodeFile";
import NodeStorage from "./NodeStorage";
import StorageUtilities, { EncodingType } from "../storage/StorageUtilities";
import FolderBase from "../storage/FolderBase";
import Log from "./../core/Log";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

export interface IFilePathAndSize {
  path: string;
  size?: number;
  hash?: string;
  sourcePath?: string;
}

export interface FileListings {
  [pathPlusSizePlusHash: string]: IFilePathAndSize | undefined;
}

export interface IListingsFile {
  path: string;
  files: IFilePathAndSize[];
}

export default class NodeFolder extends FolderBase implements IFolder {
  private _name: string;
  private _path: string;

  folders: { [id: string]: NodeFolder | undefined };
  files: { [id: string]: NodeFile | undefined };
  private _storage: NodeStorage;
  private _parentFolder: NodeFolder | null;

  get storage(): NodeStorage {
    return this._storage;
  }

  get parentFolder(): NodeFolder | null {
    return this._parentFolder;
  }

  get name() {
    return this._name;
  }

  get fullPath() {
    let path = this._path;

    if (!path.endsWith(NodeStorage.platformFolderDelimiter)) {
      path += NodeStorage.platformFolderDelimiter;
    }

    return path + this.name;
  }

  constructor(storage: NodeStorage, parentFolder: NodeFolder | null, parentPath: string, folderName: string) {
    super();

    this._storage = storage;
    this._parentFolder = parentFolder;

    this._path = parentPath;
    this._name = folderName;

    this.folders = {};
    this.files = {};
  }

  ensureFile(name: string): NodeFile {
    Log.assert(name.indexOf("/") < 0, "Unexpected to find / in file name: " + name);

    const nameCanon = StorageUtilities.canonicalizeName(name);

    let candFile = this.files[nameCanon];

    if (candFile == null) {
      candFile = new NodeFile(this, name);

      this.files[nameCanon] = candFile;
    }

    return candFile;
  }

  _removeFile(file: IFile) {
    const nameCanon = StorageUtilities.canonicalizeName(file.name);

    const candFile = this.files[nameCanon];

    Log.assert(candFile === file, "Files don't match.");

    this.files[nameCanon] = undefined;

    this.storage.notifyFileRemoved(this.storageRelativePath + file.name);
  }

  _addExistingFile(file: NodeFile) {
    const nameCanon = StorageUtilities.canonicalizeName(file.name);

    this.files[nameCanon] = file;
  }

  async deleteThisFolder(): Promise<boolean> {
    if (this.storage.readOnly) {
      throw new Error("Deletion of this folder " + this.fullPath + " is not supported in read only mode.");
    }

    let absPath = path.resolve(this.fullPath);
    if (StorageUtilities.isPathRiskyForDelete(absPath)) {
      throw new Error("Deletion of this folder " + absPath + " is not supported because it seems too basic.");
    }

    let isSuccess = true;

    if (fs.existsSync(this.fullPath)) {
      try {
        fs.rmdirSync(this.fullPath, {
          recursive: true,
        });
      } catch (e) {
        isSuccess = false;
      }
    }

    this.removeMeFromParent();

    return isSuccess;
  }

  async deleteAllFolderContents(): Promise<boolean> {
    if (this.storage.readOnly) {
      throw new Error("Deletion of folder contents at " + this.fullPath + " is not supported in read only mode.");
    }

    return await this.recursiveDeleteContentsOfThisFolder();
  }

  ensureFolder(name: string): NodeFolder {
    Log.assert(name.indexOf("/") < 0, "Unexpected to find / in folder name: " + name);

    const nameCanon = StorageUtilities.canonicalizeName(name);

    let candFolder = this.folders[nameCanon];

    if (!candFolder) {
      candFolder = new NodeFolder(this._storage, this, this.fullPath, name);

      this.folders[nameCanon] = candFolder;
    }

    return candFolder;
  }

  _addExistingFolderToParent(folder: NodeFolder) {
    const nameCanon = StorageUtilities.canonicalizeName(folder.name);

    this.folders[nameCanon] = folder;
  }

  async moveTo(newStorageRelativePath: string): Promise<boolean> {
    const oldFullPath = this.fullPath;

    const newFolderPath = StorageUtilities.getFolderPath(newStorageRelativePath);
    const newFolderName = StorageUtilities.getLeafName(newStorageRelativePath);

    if (newFolderName.length < 2) {
      throw new Error("New path is not correct.");
    }

    if (this.isSameFolder(newStorageRelativePath)) {
      return false;
    }

    if (this._parentFolder !== null) {
      const newParentFolder = await this._parentFolder.storage.ensureFolderFromStorageRelativePath(newFolderPath);

      if (newParentFolder.folders[newFolderName] !== undefined) {
        throw new Error("Could not move folder; folder exists at specified path: " + newStorageRelativePath);
      }

      this._parentFolder._removeExistingFolderFromParent(this);

      this._parentFolder = newParentFolder as NodeFolder;

      this._name = newFolderName;
      (newParentFolder as NodeFolder)._addExistingFolderToParent(this);
    }

    this._name = newFolderName;

    const newFullPath = this.fullPath;
    Log.verbose("Renaming folder from: " + oldFullPath + " to " + newFullPath);
    fs.renameSync(oldFullPath, newFullPath);
    return true;
  }

  async exists(): Promise<boolean> {
    return fs.existsSync(this.fullPath);
  }

  async ensureExists(): Promise<boolean> {
    const exists = fs.existsSync(this.fullPath);

    if (!exists) {
      // Log.message("Creating folder '" + this.fullPath + "'");

      fs.mkdirSync(this.fullPath, { recursive: true });
    }

    return true;
  }

  async generateFileListings(listings?: FileListings) {
    await this.load(true);

    if (!listings) {
      listings = {};
    }

    if (this.files["files.json"] !== undefined) {
      const file = this.files["files.json"];

      if (!file.isContentLoaded) {
        await file.loadContent(false);
      }

      const obj: IListingsFile | undefined = StorageUtilities.getJsonObject(file);

      if (obj && obj.files) {
        for (const fileInfo of obj.files) {
          if (fileInfo.hash && fileInfo.size && fileInfo.path && fileInfo.sourcePath === undefined) {
            const pathHash = this.generatePathHash(fileInfo);

            if (!listings[pathHash]) {
              const relativePath = this.storageRelativePath;

              if (relativePath) {
                listings[pathHash] = {
                  path: fileInfo.path,
                  size: fileInfo.size,
                  hash: fileInfo.hash,
                  sourcePath: StorageUtilities.canonicalizePath(relativePath + fileInfo.path),
                };
              }
            }
          }
        }
      }
    } else {
      for (const dirName in this.folders) {
        const folder = this.folders[dirName];

        if (folder && !folder.errorStatus) {
          await folder.generateFileListings(listings);
        }
      }
    }

    return listings;
  }

  generatePathHash(fileInfo: IFilePathAndSize) {
    let pathHash = StorageUtilities.getBaseFromName(fileInfo.path).toLowerCase();

    if (fileInfo.size) {
      pathHash += "|" + fileInfo.size;
    }

    if (fileInfo.hash) {
      pathHash += "|" + fileInfo.hash;
    }

    return pathHash;
  }

  async copyContentsTo(
    destRootPath: string,
    fileInclusionList: IFilePathAndSize[],
    addFilesToInclusionList?: boolean,
    listings?: FileListings,
    destStorageRelativePath?: string,
    copyPath?: string
  ) {
    await this.load(true);

    destRootPath = NodeStorage.ensureEndsWithDelimiter(destRootPath);
    let dirPath = NodeStorage.ensureEndsWithDelimiter(destRootPath);

    if (copyPath) {
      dirPath += copyPath;
    }

    const targetFolderExists = fs.existsSync(dirPath);

    if (!targetFolderExists) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    for (const fileName in this.files) {
      const file = this.files[fileName];

      let filePath = fileName;

      if (copyPath) {
        filePath = copyPath + filePath;
      }

      filePath = StorageUtilities.canonicalizePath(filePath);

      let targetFileSize: IFilePathAndSize | undefined;

      if (fileInclusionList) {
        for (const filePathAndSize of fileInclusionList) {
          if (StorageUtilities.canonicalizePath(filePathAndSize.path) === filePath) {
            targetFileSize = filePathAndSize;
          }
        }
      }

      if (file) {
        await file.loadContent(true);

        if (file.content) {
          const encoding = StorageUtilities.getEncodingByFileName(file.name);

          if (!targetFileSize) {
            targetFileSize = {
              size: file.content.length,
              path: filePath,
            };

            if (addFilesToInclusionList === true) {
              fileInclusionList.push(targetFileSize);
            }
          }

          if (encoding === EncodingType.ByteBuffer) {
            let arrData: any = file.content as any;

            if (
              targetFileSize &&
              arrData instanceof Buffer &&
              targetFileSize.size &&
              arrData.length > targetFileSize.size
            ) {
              Log.verbose("Making truncated buffer copy of " + file.fullPath + " to size " + targetFileSize.size);
              arrData = arrData.subarray(0, targetFileSize.size);
            } else if (
              targetFileSize &&
              arrData instanceof Uint8Array &&
              targetFileSize.size &&
              arrData.length > targetFileSize.size
            ) {
              Log.verbose("Making truncated array copy of " + file.fullPath + " to size " + targetFileSize.size);
              arrData = arrData.subarray(0, targetFileSize.size);
            }

            const hash = crypto.createHash("MD5");

            hash.update(arrData);

            targetFileSize.hash = hash.digest("base64");

            const pathHash = this.generatePathHash(targetFileSize);
            let usingSourcePath = false;

            if (listings) {
              const fileListing = listings[pathHash];

              if (fileListing && fileListing.sourcePath) {
                targetFileSize.sourcePath = fileListing.sourcePath;
                usingSourcePath = true;
              }
            }

            if (!usingSourcePath) {
              fs.writeFileSync(dirPath + file.name, arrData);

              if (listings) {
                listings[pathHash] = {
                  size: targetFileSize.size,
                  hash: targetFileSize.hash,
                  path: targetFileSize.path,
                  sourcePath: StorageUtilities.canonicalizePath(destStorageRelativePath + targetFileSize.path),
                };
              }
            }
          } else {
            const hash = crypto.createHash("MD5");

            hash.update(file.content);

            targetFileSize.hash = hash.digest("base64");

            const pathHash = this.generatePathHash(targetFileSize);
            let usingSourcePath = false;

            if (listings) {
              const fileListing = listings[pathHash];

              if (fileListing && fileListing.sourcePath) {
                targetFileSize.sourcePath = fileListing.sourcePath;
                usingSourcePath = true;
              }
            }

            if (!usingSourcePath) {
              fs.writeFileSync(dirPath + file.name, file.content, { encoding: "utf8" });

              if (listings) {
                listings[pathHash] = {
                  size: targetFileSize.size,
                  hash: targetFileSize.hash,
                  path: targetFileSize.path,
                  sourcePath: StorageUtilities.canonicalizePath(destStorageRelativePath + targetFileSize.path),
                };
              }
            }
          }
        }
      }
    }

    if (copyPath === undefined) {
      copyPath = "";
    }

    for (const folderName in this.folders) {
      const nf = this.folders[folderName] as NodeFolder;

      if (nf && !nf.errorStatus) {
        await nf.copyContentsTo(
          destRootPath,
          fileInclusionList,
          addFilesToInclusionList,
          listings,
          destStorageRelativePath,
          copyPath + folderName + NodeStorage.platformFolderDelimiter
        );
      }
    }
  }

  async saveFilesList(pathDescriptor: string, inclusionList: IFilePathAndSize[]) {
    const obj: IListingsFile = { path: pathDescriptor, files: inclusionList };

    fs.writeFileSync(NodeStorage.ensureEndsWithDelimiter(this.fullPath) + "files.json", JSON.stringify(obj, null, 2), {
      encoding: "utf8",
    });
  }

  async copyContentsOut(destFolder: IFolder) {
    await this.load(true);

    if (this.files["files.json"] !== undefined) {
      const file = this.files["files.json"];

      if (!file.isContentLoaded) {
        await file.loadContent(false);
      }

      const obj: IListingsFile | undefined = StorageUtilities.getJsonObject(file);

      if (obj && obj.files) {
        for (const fileInfo of obj.files) {
          if (fileInfo.hash && fileInfo.size && fileInfo.path) {
            let file: IFile | undefined;

            if (fileInfo.sourcePath) {
              file = await this.storage.rootFolder.getFileFromRelativePath(
                StorageUtilities.ensureStartsWithDelimiter(fileInfo.sourcePath)
              );
            } else {
              file = await this.getFileFromRelativePath(StorageUtilities.ensureStartsWithDelimiter(fileInfo.path));
            }

            if (file) {
              if (!file.isContentLoaded) {
                await file.loadContent();
              }

              if (file.content !== null) {
                const targetFile = await destFolder.ensureFileFromRelativePath(
                  StorageUtilities.ensureStartsWithDelimiter(fileInfo.path)
                );

                if (targetFile) {
                  // Log.verbose("Copying file '" + file.fullPath + "' out to '" + targetFile.fullPath + "'");
                  targetFile.setContent(file.content);
                }
              }
            } else {
              Log.debug("Could not find expected backup file '" + fileInfo.path + "' in " + this.fullPath);
            }
          }
        }
      }
    } else {
      Log.debug("Could not find files.json in " + this.fullPath);
    }

    await destFolder.saveAll();
  }

  async createFile(name: string): Promise<IFile> {
    return this.ensureFile(name);
  }

  async load(force?: boolean): Promise<Date> {
    if (this.lastLoadedOrSaved != null && !force) {
      return this.lastLoadedOrSaved;
    }

    // Log.debug("Reading details on folder '" + this.fullPath + "'");

    if (fs.existsSync(this.fullPath)) {
      const results = fs.readdirSync(this.fullPath);

      results.forEach((fileOrFolderName: string) => {
        let filePath = this.fullPath;

        if (!filePath.endsWith(NodeStorage.platformFolderDelimiter)) {
          filePath += NodeStorage.platformFolderDelimiter;
        }

        filePath += fileOrFolderName;

        try {
          const stat = fs.statSync(filePath);
          if (stat.isDirectory() && !StorageUtilities.isIgnorableFolder(fileOrFolderName)) {
            this.ensureFolder(fileOrFolderName);
          } else if (stat.isFile() && StorageUtilities.isUsableFile(filePath)) {
            const file = this.ensureFile(fileOrFolderName);

            if (stat.mtime) {
              file.modifiedAtLoad = new Date(stat.mtime);
            }
          }
        } catch (e: any) {
          this.errorStatus = FolderErrorStatus.unreadable;
          Log.error("Error opening folder '" + filePath + "': " + e.toString());
        }
      });
    }

    this.updateLastLoadedOrSaved();

    return this.lastLoadedOrSaved as Date;
  }
}
