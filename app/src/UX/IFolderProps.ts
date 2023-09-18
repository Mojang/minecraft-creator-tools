import IFolder from "../storage/IFolder";
import IPersistable from "./../UX/IPersistable";

export default interface IFolderProps {
  folder: IFolder;
  setActivePersistable?: (persistObject: IPersistable) => void;
}
