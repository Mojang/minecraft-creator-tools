import IFile from "./IFile";

export default interface IVersionContent {
  id: string;
  content: string | Uint8Array | null;
  description?: string;
  versionTime: Date | null;
  startVersionTime?: Date | null;
  file: IFile;
}
