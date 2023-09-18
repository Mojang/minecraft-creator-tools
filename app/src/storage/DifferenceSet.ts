import IFileDifference, { FileDifferenceType } from "./IFileDifference";
import IFolderDifference, { FolderDifferenceType } from "./IFolderDifference";
import IStorage from "./IStorage";
import StorageUtilities from "./StorageUtilities";
import ZipStorage from "./ZipStorage";

export default class DifferenceSet {
  fileDifferences: IFileDifference[] = [];
  folderDifferences: IFolderDifference[] = [];

  getZip() {
    const zipStorage = new ZipStorage();

    for (let i = 0; i < this.fileDifferences.length; i++) {
      const fileDiff = this.fileDifferences[i];

      if (fileDiff.type === FileDifferenceType.fileAdded || fileDiff.type === FileDifferenceType.contentsDifferent) {
        if (fileDiff.updated) {
          const zipFile = zipStorage.rootFolder.ensureFile(fileDiff.path);

          zipFile.setContent(fileDiff.updated.content);
        }
      }
    }

    zipStorage.rootFolder.saveAll();

    return zipStorage;
  }

  getHasDeletions() {
    for (let i = 0; i < this.fileDifferences.length; i++) {
      if (this.fileDifferences[i].type === FileDifferenceType.fileDeleted) {
        return true;
      }
    }

    for (let i = 0; i < this.folderDifferences.length; i++) {
      if (this.folderDifferences[i].type === FolderDifferenceType.folderDeleted) {
        return true;
      }
    }

    return false;
  }

  hasFileOnlyOfExtension(...extensions: string[]) {
    for (let i = 0; i < this.fileDifferences.length; i++) {
      const extension = StorageUtilities.getTypeFromName(this.fileDifferences[i].path);

      if (!extensions.includes(extension)) {
        return false;
      }
    }

    return true;
  }

  hasFileOfExtension(...extensions: string[]) {
    for (let i = 0; i < this.fileDifferences.length; i++) {
      const extension = StorageUtilities.getTypeFromName(this.fileDifferences[i].path);

      if (extensions.includes(extension)) {
        return true;
      }
    }

    return false;
  }

  async copyFileUpdatesAndAdds(storage: IStorage) {
    for (let i = 0; i < this.fileDifferences.length; i++) {
      const fileDiff = this.fileDifferences[i];

      if (
        (fileDiff.type === FileDifferenceType.fileAdded || fileDiff.type === FileDifferenceType.contentsDifferent) &&
        fileDiff.updated &&
        fileDiff.updated.content !== null
      ) {
        const file = await storage.rootFolder.ensureFileFromRelativePath(fileDiff.path);

        file.setContent(fileDiff.updated.content);
      }
    }
  }
}
