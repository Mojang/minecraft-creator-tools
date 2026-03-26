// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "./IFile";
import IFolder from "./IFolder";

export default class AllFolderFileIterator implements AsyncIterator<IFile> {
  folderStack: IFolder[] = [];
  folderFileIndices: number[] = [];
  folderFolderIndices: number[] = [];
  currentDepth = 0;

  constructor(rootFolder: IFolder) {
    this.folderStack[0] = rootFolder;
    this.folderFileIndices[0] = 0;
    this.folderFolderIndices[0] = 0;
  }

  async next(): Promise<IteratorResult<IFile, any>> {
    while (this.currentDepth >= 0) {
      if (this.folderFileIndices[this.currentDepth] === 0 && this.folderFolderIndices[this.currentDepth] === 0) {
        await this.folderStack[this.currentDepth].load(false);
      }

      // iterate over files in the currentdepth folder
      if (this.folderFileIndices[this.currentDepth] < this.folderStack[this.currentDepth].fileCount) {
        const file = this.getNthFile(this.folderStack[this.currentDepth], this.folderFileIndices[this.currentDepth]);

        if (file) {
          this.folderFileIndices[this.currentDepth]++;
          return { value: file, done: false };
        } else {
          throw new Error();
        }
      } /* now look over child folders */ else if (
        this.folderFolderIndices[this.currentDepth] < this.folderStack[this.currentDepth].folderCount
      ) {
        const folder = this.getNthFolder(
          this.folderStack[this.currentDepth],
          this.folderFolderIndices[this.currentDepth]
        );

        this.folderFolderIndices[this.currentDepth]++;

        this.currentDepth++;

        if (folder) {
          this.folderFileIndices[this.currentDepth] = 0;
          this.folderFolderIndices[this.currentDepth] = 0;
          this.folderStack[this.currentDepth] = folder;
        } else {
          throw new Error();
        }
      } else {
        this.currentDepth--;
      }
    }

    return {
      value: undefined,
      done: true,
    };
  }

  getNthFile(folder: IFolder, index: number) {
    let count = 0;

    for (const fileName in folder.files) {
      if (count === index) {
        return folder.files[fileName];
      }

      count++;
    }

    return undefined;
  }

  getNthFolder(folder: IFolder, index: number) {
    let count = 0;

    for (const fileName in folder.folders) {
      if (count === index) {
        return folder.folders[fileName];
      }

      count++;
    }

    return undefined;
  }
}
