import IProjectSeed from "../../app/IProjectSeed";
import Project from "../../app/Project";
import IFolder from "../../storage/IFolder";
import { AppMode } from "../appShell/App";
import IAppProps from "../appShell/IAppProps";
import { LocalGalleryCommand, LocalFolderType } from "../utils/LocalGalleryCommand";
import { GalleryProjectCommand } from "./CodeProjectGallery";
import { FilesSubmittedEvent } from "./HomeActions";
import IProjectTheme from "../types/IProjectTheme";

export default interface HomeProps extends IAppProps {
  theme: IProjectTheme;
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
