import IProjectSeed from "../../../app/IProjectSeed";
import { NewProjectTemplateType } from "../../App";
import { ProjectEditorMode } from "../../ProjectEditorUtilities";
import { GalleryProjectCommand } from "../../ProjectGallery";

export type FileUploadEvent = (event: React.ChangeEvent<HTMLInputElement>) => void;
export type NewProjectSelectEvent = (
  newProjectSeed: IProjectSeed,
  newProjectType: NewProjectTemplateType,
  additionalFilePath?: string,
  additionalFiles?: File[],
  editorStartMode?: ProjectEditorMode,
  isReadOnly?: boolean
) => void;

export type FilesSubmittedEvent = (additionalFilePath: string, additionalFiles: File[]) => void;

export type AppGalleryActionEvent = (command: GalleryProjectCommand, projectSeed: IProjectSeed) => void;
