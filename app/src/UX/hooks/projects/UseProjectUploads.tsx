import { useCallback } from "react";
import StorageUtilities from "../../../storage/StorageUtilities";
import { NewProjectTemplateType } from "../../App";
import { ProjectEditorMode } from "../../ProjectEditorUtilities";
import { NewProjectSelectEvent } from "../../pages/home/HomeActions";
import { useCreatorTools } from "../../contexts/creatorToolsContext/CreatorToolsContext";

export default function useProjectUploads(onNewProjectSelected?: NewProjectSelectEvent) {
  const [carto, loading] = useCreatorTools();

  const processIncomingFile = useCallback(
    (path: string, file: File, editorStartMode?: ProjectEditorMode, isReadOnly?: boolean) => {
      if (!file || !onNewProjectSelected) {
        return;
      }
      let fileName = "File";

      if (file.name) {
        fileName = file.name;

        fileName = StorageUtilities.getBaseFromName(fileName);
      }

      onNewProjectSelected(
        {
          name: fileName,
        },
        NewProjectTemplateType.empty,
        path,
        file,
        editorStartMode,
        isReadOnly
      );
    },
    [onNewProjectSelected]
  );

  const getFilesFromEvent = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (!carto.packStorage) {
        return;
      }

      return event.target.files;
    },
    [carto]
  );

  const handleFileUpload = useCallback(
    (input: File[] | React.ChangeEvent<HTMLInputElement>) => {
      //depending on what event called it, the input will be different, but either way, we just need to extract the files
      const files = Array.isArray(input) ? input : getFilesFromEvent(input);

      const file = files?.[0];

      file && processIncomingFile("/", file);
    },
    [processIncomingFile, getFilesFromEvent]
  );

  return [handleFileUpload, loading] as const;
}
