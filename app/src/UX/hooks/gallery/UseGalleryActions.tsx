import { useCallback } from "react";
import { AppGalleryActionEvent } from "../../pages/home/HomeActions";
import IGalleryItem from "../../../app/IGalleryItem";
import { GalleryProjectCommand } from "../../ProjectGallery";
import IProjectSeed from "../../../app/IProjectSeed";

export default function useGalleryActions(onAppGalleryAction: AppGalleryActionEvent) {
  const onOpenSnippet = useCallback(
    (snippet: IGalleryItem) => {
      //appease the app API by wrapping this in an object
      const projectSeed = { galleryProject: snippet };

      onAppGalleryAction(GalleryProjectCommand.projectSelect, projectSeed);
    },
    [onAppGalleryAction]
  );

  const onNewProject = useCallback(
    (seed: IProjectSeed) => {
      onAppGalleryAction(GalleryProjectCommand.newProject, seed);
    },
    [onAppGalleryAction]
  );

  return [onOpenSnippet, onNewProject] as const;
}
