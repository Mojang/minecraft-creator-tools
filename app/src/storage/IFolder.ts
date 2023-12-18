import IFile from "./IFile";
import IStorage from "./IStorage";
import IStorageObject from "./IStorageObject";

export enum FolderErrorStatus {
  none = 0,
  unreadable = 1,
}

export default interface IFolder extends IStorageObject {
  lastProcessed: Date | null;
  parentFolder: IFolder | null;
  storage: IStorage;

  extendedPath: string;

  fileCount: number;
  folderCount: number;

  folders: { [name: string]: IFolder | undefined };
  files: { [name: string]: IFile | undefined };

  allFiles: AsyncIterable<IFile>;

  isLoaded: boolean;

  errorStatus?: FolderErrorStatus;

  rename(name: string): Promise<boolean>;
  moveTo(newStorageRelativePath: string): Promise<boolean>;

  load(force: boolean): Promise<Date>;

  exists(): Promise<boolean>;
  ensureExists(): Promise<boolean>;

  dispose(): void;

  deleteThisFolder(): Promise<boolean>;
  deleteFileFromRelativePath(path: string): Promise<boolean>;

  removeFolder(name: string): boolean;

  getFileFromRelativePath(serverRelativePath: string): Promise<IFile | undefined>;
  getFolderFromRelativePath(serverRelativePath: string): Promise<IFolder | undefined>;
  getFolderFromRelativePathLocal(serverRelativePath: string): IFolder | undefined;

  ensureFolderFromRelativePath(serverRelativePath: string): Promise<IFolder>;
  ensureFileFromRelativePath(serverRelativePath: string): Promise<IFile>;
  setStructureFromFileList(fileList: string[]): Promise<void>;

  saveAll(): Promise<boolean>;

  getFolderRelativePath(toFolder: IFolder): string | undefined;

  folderExists(name: string): boolean;
  fileExists(name: string): boolean;

  ensureFolder(name: string): IFolder;
  ensureFile(name: string): IFile;

  deleteFile(name: string): Promise<boolean>;
  createFile(name: string): Promise<IFile>;
}
