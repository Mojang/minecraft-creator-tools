import { ThemeInput } from "@fluentui/react-northstar";
import IProjectSeed from "../../../app/IProjectSeed";
import Project from "../../../app/Project";
import IFolder from "../../../storage/IFolder";
import { AppMode } from "../../App";
import IAppProps from "../../IAppProps";
import { LocalGalleryCommand, LocalFolderType } from "../../LocalGalleryCommand";
import { GalleryProjectCommand } from "../../ProjectGallery";
import { FilesSubmittedEvent, NewProjectSelectEvent } from "./HomeActions";

export default interface HomeProps extends IAppProps {
  theme: ThemeInput<any>;
  errorMessage: string | undefined;
  heightOffset: number;
  visualSeed?: number;
  isPersisted?: boolean;
  onModeChangeRequested?: (mode: AppMode) => void;
  onProjectSelected?: (project: Project) => void;
  onLog: (message: string) => Promise<void>;
  onSetProject: (project: Project) => void;
  onGalleryItemCommand: (command: GalleryProjectCommand, newProjectSeed: IProjectSeed) => void;
  onLocalGalleryItemCommand: (command: LocalGalleryCommand, folderType: LocalFolderType, folder: IFolder) => void;
  onFilesSubmitted: FilesSubmittedEvent;
  onNewProjectFromFolderSelected?: (folder: string) => void;
  onProgressLog?: (message: string) => void;
  onNewProjectFromFolderInstanceSelected?: (folder: IFolder, name?: string, isDocumentationProject?: boolean) => void;
}
