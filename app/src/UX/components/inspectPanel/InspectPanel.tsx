import { Alert, Box, Paper, Typography } from "@mui/material";
import FileUploadButton from "../../shared/components/inputs/fileUploadButton/FileUploadButton";
import { FilesSubmittedEvent } from "../../pages/home/HomeActions";
import useProjectUploads from "../../hooks/projects/UseProjectUploads";
import FileDropArea from "../../shared/components/fileDropArea/FileDropArea";
import LoadingSpinner from "../../shared/components/async/loadingSpinner/LoadingSpinner";
import AppServiceProxy from "../../../core/AppServiceProxy";
import IFolder from "../../../storage/IFolder";
import { Directory, useDirectoryPicker } from "../../hooks/io/UseDirectoryPicker";
import useTelemetry from "../../../analytics/useTelemetry";
import { TelemetryEvents, TelemetryProperties } from "../../../analytics/TelemetryConstants";
import McButton from "../../shared/components/inputs/mcButton/McButton";
import { mcColors } from "../../hooks/theme/mcColors";

interface InspectPanelProps {
  onFilesSubmitted?: FilesSubmittedEvent;
  editFolder?: (folder: IFolder, name?: string, isDocumentationProject?: boolean) => void;
  openAppFolder: () => void;
}
export default function InspectPanel({ onFilesSubmitted, editFolder, openAppFolder }: InspectPanelProps) {
  const [handleFileUpload, loading] = useProjectUploads(onFilesSubmitted);
  const { trackEvent } = useTelemetry();

  const onDirectoryPicked = (directory?: Directory) => {
    if (dirError || !directory || !editFolder) {
      return;
    }

    trackEvent({
      name: TelemetryEvents.FOLDER_OPENED,
      properties: {
        [TelemetryProperties.FOLDER_TYPE]: "device",
        [TelemetryProperties.STORAGE_TYPE]: "local",
      },
    });

    editFolder(directory.root, directory.name, false);
  };

  const [, pickDirectory, dirError] = useDirectoryPicker(window, { onDirectoryPicked, checkUnsafeFiles: true });

  const handleButtonUpload = (input: React.ChangeEvent<HTMLInputElement>) => {
    handleFileUpload(input, "button");
  };

  const handleDropUpload = (files: File[]) => {
    handleFileUpload(files, "drag-drop");
  };

  const handleOpenAppFolder = () => {
    trackEvent({
      name: TelemetryEvents.FOLDER_OPENED,
      properties: {
        [TelemetryProperties.FOLDER_TYPE]: "app",
        [TelemetryProperties.STORAGE_TYPE]: "app",
      },
    });

    openAppFolder();
  };

  return (
    <Paper
      sx={(theme) => ({
        py: 2,
        px: 2,
        borderRadius: 1,
        border: theme.palette.mode === "dark" ? `2px solid ${mcColors.gray5}` : `2px solid ${mcColors.gray2}`,
        background:
          theme.palette.mode === "dark"
            ? `linear-gradient(180deg, ${mcColors.gray5} 0%, ${mcColors.gray6} 100%)`
            : `linear-gradient(180deg, #ffffff 0%, ${mcColors.gray1} 100%)`,
      })}
    >
      {loading ? (
        <LoadingSpinner minHeight="6em" />
      ) : (
        <>
          <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
            <Box
              component="img"
              role="img"
              src="./res/images/icons/eye.png"
              alt="Inspect Icon"
              aria-hidden="true"
              width={28}
              height={28}
              sx={(theme) => ({
                mr: 1,
                imageRendering: "pixelated",
                filter: theme.palette.mode === "dark" ? "none" : "invert(1)",
              })}
            />
            <Typography
              variant="h6"
              sx={(theme) => ({
                fontWeight: 600,
                lineHeight: 1.3,
                textShadow: theme.palette.mode === "dark" ? "1px 1px 0px rgba(0,0,0,0.5)" : "none",
              })}
            >
              Get Started
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ mb: 2, opacity: 0.85 }}>
            View, validate and edit Minecraft files
            {!AppServiceProxy.hasAppServiceOrSim && " in your browser"}
          </Typography>
          <FileDropArea onFileDrop={handleDropUpload}>
            <Typography variant="body2" sx={{ py: 1, textAlign: "center", opacity: 0.8 }}>
              Drag & drop Minecraft files here (.mcworld/.mcaddon/.png, etc.)
            </Typography>
          </FileDropArea>
          <Alert hidden={!dirError} severity="error" sx={{ my: 2 }}>
            {dirError?.message}
          </Alert>
          <Box marginBottom={2} />
          <Box sx={{ display: "flex", gap: 1.5, flexDirection: { xs: "column", sm: "row" }, alignItems: "stretch" }}>
            <Box sx={{ flex: 1, display: "flex" }}>
              <FileUploadButton onFileSelect={handleButtonUpload}>Choose File(s)</FileUploadButton>
            </Box>
            {AppServiceProxy.hasAppServiceOrSim && (
              <Box sx={{ flex: 1, display: "flex" }}>
                <McButton variant="stone" fullWidth onClick={handleOpenAppFolder}>
                  Edit Folder
                </McButton>
              </Box>
            )}
            {!AppServiceProxy.hasAppServiceOrSim && editFolder && (
              <Box sx={{ flex: 1, display: "flex" }}>
                <McButton variant="stone" fullWidth onClick={pickDirectory}>
                  Edit Folder on Device
                </McButton>
              </Box>
            )}
          </Box>
        </>
      )}
    </Paper>
  );
}
