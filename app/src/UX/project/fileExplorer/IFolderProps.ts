import IFolder from "../../../storage/IFolder";
import IPersistable from "../../types/IPersistable";

export default interface IFolderProps {
  folder: IFolder;
  setActivePersistable?: (persistObject: IPersistable) => void;
}
