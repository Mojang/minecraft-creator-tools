import IFile from "../storage/IFile";

export default interface ILevelDbFileInfo {
  file: IFile;
  index: number;
  isDeleted: boolean;
  level: number;
}
