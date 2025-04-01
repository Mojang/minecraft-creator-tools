import IFile from "./IFile";
import IFolder from "./IFolder";
import StorageUtilities from "./StorageUtilities";
import { RegExpMatcher, englishDataset, englishRecommendedTransformers } from "obscenity";

export class BasicValidators {
  private static contentMatcher: RegExpMatcher | undefined = undefined;

  static async isFolderSharingValid(folder: IFolder, isChildFolder?: boolean): Promise<string | undefined> {
    if (!this.isFolderNameOKForSharing(folder.name)) {
      return folder.name + " is an unsupported folder name.";
    }

    await folder.load();

    if (!isChildFolder && folder.fileCount > 0) {
      return "Folder that contains files at the root.";
    }

    for (const childFileName in folder.files) {
      const childFile = folder.files[childFileName];

      if (childFile) {
        const result = this.isFileNameOKForSharing(childFile.name);

        if (!result) {
          return childFile.name + " is an unsupported file name.";
        }

        const res = await this.isFileContentOKForSharing(childFile);

        if (res) {
          return childFile.name + " has unsupported content.";
        }
      }
    }

    for (const childFolderName in folder.folders) {
      const childFolder = folder.folders[childFolderName];

      if (childFolder) {
        const result = await this.isFolderSharingValid(childFolder, true);

        if (result) {
          return result;
        }
      }
    }

    return undefined;
  }

  public static isFileNameOKForSharing(fileName: string) {
    fileName = fileName.toLowerCase();

    const ext = StorageUtilities.getTypeFromName(fileName);

    if (ext !== "ts" && ext !== "js" && ext !== "json") {
      return false;
    }

    if (
      fileName.startsWith(".") ||
      fileName.startsWith("just.config") ||
      fileName.endsWith(".config.ts") ||
      fileName.endsWith(".config.js") ||
      (fileName.startsWith("manifest") && fileName.endsWith("json")) ||
      (fileName.startsWith("package") && fileName.endsWith("json"))
    ) {
      return false;
    }

    return true;
  }

  public static isFolderNameOKForSharing(folderName: string) {
    if (
      folderName.startsWith(".") ||
      folderName === "lib" ||
      folderName === "node_modules" ||
      folderName === ".git" ||
      folderName === "dist" ||
      folderName === "build"
    ) {
      return false;
    }

    return true;
  }

  public static async isFileContentOKForSharing(file: IFile) {
    await file.loadContent();

    if (file.isBinary) {
      return false;
    }

    const str = file.content;

    if (!str) {
      return false;
    }

    if (typeof str !== "string") {
      return false;
    }

    if (str.length < 1) {
      return false;
    }

    const content = str.toLowerCase();

    if (this.contentMatcher === undefined) {
      this.contentMatcher = new RegExpMatcher({
        ...englishDataset.build(),
        ...englishRecommendedTransformers,
      });
    }

    if (this.contentMatcher.hasMatch(content)) {
      return true;
    }

    return false;
  }
}
