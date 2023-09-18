import IIndexFile from "./IIndexFile";
import IIndexFolder from "./IIndexFolder";

export default interface IIndexJson {
  files: string[];
  folders: string[];
}
