import IFile from "./IFile";

export enum FileDifferenceType {
  none = 0,
  contentsDifferent = 1,
  fileAdded = 2,
  fileDeleted = 3,
}

export default interface IFileDifference {
  type: FileDifferenceType;
  original?: IFile;
  updated?: IFile;
  path: string;
}
