import IProjectSeed from "../../../app/IProjectSeed";
import { NewProjectTemplateType } from "../../App";
import { ProjectEditorMode } from "../../ProjectEditorUtilities";
import { GalleryProjectCommand } from "../../ProjectGallery";

export type FileUploadEvent = (event: React.ChangeEvent<HTMLInputElement>) => void;
export type NewProjectSelectEvent = (
  newProjectSeed: IProjectSeed,
  newProjectType: NewProjectTemplateType,
  additionalFilePath?: string,
  additionalFile?: File,
  editorStartMode?: ProjectEditorMode,
  isReadOnly?: boolean
) => void;
export type AppGalleryActionEvent = (command: GalleryProjectCommand, projectSeed: IProjectSeed) => void;
