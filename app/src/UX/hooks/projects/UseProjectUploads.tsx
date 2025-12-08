import { useCallback } from "react";
import StorageUtilities from "../../../storage/StorageUtilities";
import { FilesSubmittedEvent, NewProjectSelectEvent } from "../../pages/home/HomeActions";
import { useCreatorTools } from "../../contexts/creatorToolsContext/CreatorToolsContext";
import useTelemetry from "../../../analytics/useTelemetry";
import { TelemetryEvents, TelemetryProperties, TelemetryMeasurements } from "../../../analytics/TelemetryConstants";
import WebUtilities from "../../WebUtilities";

export default function useProjectUploads(onFilesSubmitted?: FilesSubmittedEvent) {
  const [creatorTools, loading] = useCreatorTools();
  const { trackEvent } = useTelemetry();

  const getFileExtension = (fileName: string): string => {
    const parts = fileName.split(".");
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "unknown";
  };

  const processIncomingFile = useCallback(
    (path: string, files: File[], uploadMethod?: string) => {
      if (!files || !onFilesSubmitted) {
        return;
      }
      let fileName = "File";

      for (const file of files) {
        if (file.name) {
          fileName = file.name;

          fileName = StorageUtilities.getBaseFromName(fileName);
        }

        // Track file upload telemetry
        const fileExtension = getFileExtension(file.name);
        trackEvent({
          name: TelemetryEvents.FILE_UPLOADED,
          properties: {
            [TelemetryProperties.FILE_FORMAT]: fileExtension,
            [TelemetryProperties.FILE_UPLOAD_METHOD]: uploadMethod || "button",
            [TelemetryProperties.FILE_TYPE]: file.type || "unknown",
            [TelemetryProperties.ACTION_SOURCE]: "inspectPanel",
          },
          measurements: {
            [TelemetryMeasurements.FILE_SIZE_BYTES]: file.size,
          },
        });
      }

      onFilesSubmitted(path, files);
    },
    [onFilesSubmitted, trackEvent]
  );

  const getFilesFromEvent = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (!creatorTools.packStorage) {
        return;
      }

      return WebUtilities.getFileArrayFromFileList(event.target.files);
    },
    [creatorTools]
  );

  const handleFileUpload = useCallback(
    (input: File[] | React.ChangeEvent<HTMLInputElement>, uploadMethod?: string) => {
      //depending on what event called it, the input will be different, but either way, we just need to extract the files
      const files = Array.isArray(input) ? input : getFilesFromEvent(input);

      files && processIncomingFile("/", files, uploadMethod);
    },
    [processIncomingFile, getFilesFromEvent]
  );

  return [handleFileUpload, loading] as const;
}
