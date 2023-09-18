import IFolder from "./IFolder";
import IStorage from "./IStorage";
import IStorageObject from "./IStorageObject";

export default interface IFile extends IStorageObject {
  modified: Date | null;
  modifiedAtLoad: Date | null;
  latestModified: Date | null;
  content: string | Uint8Array | null;
  lastLoadedOrSaved: Date | null;
  isContentLoaded: boolean;
  needsSave: boolean;
  fileContainerStorage: IStorage | null;
  extendedPath: string;

  parentFolder: IFolder;

  type: string;

  dispose(): void;

  getHash(): Promise<string | undefined>;

  deleteFile(): Promise<boolean>;
  moveTo(newStorageRelativePath: string): Promise<boolean>;
  exists(): Promise<boolean>;
  getRootRelativePath(): string | undefined;
  getFolderRelativePath(toFolder: IFolder): string | undefined;
  loadContent(force?: boolean): Promise<Date>;
  setContent(content: string | Uint8Array): void;
  saveContent(force?: boolean): Promise<Date>;
}
