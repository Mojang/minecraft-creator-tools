// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import DifferenceSet from "./DifferenceSet";
import { FileDifferenceType } from "./IFileDifference";
import IFolder from "./IFolder";
import StorageUtilities from "./StorageUtilities";

export default class Thumbprint {
  fileInfos: { [path: string]: { size: number } | undefined } = {};

  compare(secondThumbprint: Thumbprint, compareOnlyLeafs: boolean) {
    const tempFileInfos: { [path: string]: { size: number } | undefined } = {};

    for (const fileInfoPath in this.fileInfos) {
      let comparePath = fileInfoPath;

      if (compareOnlyLeafs) {
        comparePath = StorageUtilities.canonicalizeName(StorageUtilities.getLeafName(fileInfoPath));
      }

      tempFileInfos[comparePath] = this.fileInfos[fileInfoPath];
    }

    for (const fileInfoPath in secondThumbprint.fileInfos) {
      const compareFile = secondThumbprint.fileInfos[fileInfoPath];

      if (compareFile) {
        let comparePath = fileInfoPath;

        if (compareOnlyLeafs) {
          comparePath = StorageUtilities.canonicalizeName(StorageUtilities.getLeafName(fileInfoPath));
        }

        const sourceFileInfo = tempFileInfos[comparePath];
        if (sourceFileInfo !== undefined) {
          if (sourceFileInfo.size === compareFile.size) {
            tempFileInfos[comparePath] = undefined;
          }
        }
      }
    }

    const diffSet = new DifferenceSet();

    for (const fileInfoPath in tempFileInfos) {
      const fi = tempFileInfos[fileInfoPath];

      if (fi) {
        diffSet.fileDifferences.push({
          type: FileDifferenceType.contentsDifferent,
          path: fileInfoPath,
        });
      }
    }

    return diffSet;
  }

  async create(folder: IFolder) {
    const tempFileInfos: { [path: string]: { size: number } | undefined } = {};

    await this._createInternal(folder, tempFileInfos);

    this.fileInfos = tempFileInfos;
  }

  private async _createInternal(folder: IFolder, fileInfos: { [path: string]: { size: number } | undefined }) {
    if (!folder.isLoaded) {
      await folder.load();
    }

    for (const fileName in folder.files) {
      const file = folder.files[fileName];

      if (file) {
        fileInfos[file.storageRelativePath] = { size: file.content ? file.content.length : -1 };
      }
    }

    for (const folderName in folder.folders) {
      const childFolder = folder.folders[folderName];

      if (childFolder && !childFolder.errorStatus) {
        await this._createInternal(childFolder, fileInfos);
      }
    }
  }
}
