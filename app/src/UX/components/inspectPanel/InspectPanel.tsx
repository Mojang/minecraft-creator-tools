import { Alert, Box, Paper, Typography } from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFolderOpen } from "@fortawesome/free-solid-svg-icons";
import FileUploadButton from "../../shared/components/inputs/fileUploadButton/FileUploadButton";
import { FilesSubmittedEvent } from "../../home/HomeActions";
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
import { useIntl } from "react-intl";

interface InspectPanelProps {
  onFilesSubmitted?: FilesSubmittedEvent;
  editFolder?: (folder: IFolder, name?: string, isDocumentationProject?: boolean) => void;
  openAppFolder: () => void;
}
export default function InspectPanel({ onFilesSubmitted, editFolder, openAppFolder }: InspectPanelProps) {
  const [handleFileUpload, loading] = useProjectUploads(onFilesSubmitted);
  const { trackEvent } = useTelemetry();
  const intl = useIntl();
  const isApp = AppServiceProxy.hasAppServiceOrSim;

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
              aria-hidden="true"
              sx={(theme) => ({
                mr: 1,
                fontSize: 22,
                color: theme.palette.mode === "dark" ? mcColors.gray1 : mcColors.gray6,
                display: "flex",
                alignItems: "center",
              })}
            >
              <FontAwesomeIcon icon={faFolderOpen} />
            </Box>
            <Typography
              variant="h6"
              component="h2"
              sx={(theme) => ({
                fontWeight: 600,
                lineHeight: 1.3,
                textShadow: theme.palette.mode === "dark" ? "1px 1px 0px rgba(0,0,0,0.5)" : "none",
              })}
            >
              {intl.formatMessage({ id: "home.inspect_panel.title" })}
            </Typography>
          </Box>
          <Typography variant="body2" sx={(theme) => ({ mb: 2, color: theme.palette.text.secondary })}>
            {isApp
              ? intl.formatMessage({ id: "home.inspect_panel.description" })
              : intl.formatMessage({ id: "home.inspect_panel.description_browser" })}
          </Typography>
          <Box sx={{ display: { xs: "none", sm: "block" } }}>
            <FileDropArea
              onFileDrop={handleDropUpload}
              ariaLabel="Drag and drop Minecraft files to open or create a project"
            >
              <Typography
                variant="body2"
                sx={(theme) => ({ py: 1, textAlign: "center", color: theme.palette.text.secondary })}
              >
                {intl.formatMessage({ id: "home.inspect_panel.drag_drop" })}
              </Typography>
            </FileDropArea>
          </Box>
          {dirError && (
            <Alert severity="error" sx={{ my: 2 }}>
              {dirError.message}
            </Alert>
          )}
          <Box marginBottom={2} />
          <Box sx={{ display: "flex", gap: 1.5, flexDirection: "column", alignItems: "stretch" }}>
            <Box sx={{ display: "flex" }}>
              <FileUploadButton onFileSelect={handleButtonUpload}>
                {intl.formatMessage({ id: "home.inspect_panel.choose_files" })}
              </FileUploadButton>
            </Box>
            {isApp && (
              <Box sx={{ display: "flex" }}>
                <McButton variant="green" fullWidth onClick={handleOpenAppFolder}>
                  {intl.formatMessage({ id: "home.inspect_panel.open_project_folder" })}
                </McButton>
              </Box>
            )}
            {!isApp && editFolder && typeof window.showDirectoryPicker === "function" && (
              <Box sx={{ display: "flex" }}>
                <McButton variant="green" fullWidth onClick={pickDirectory}>
                  {intl.formatMessage({ id: "home.inspect_panel.open_project_folder_device" })}
                </McButton>
              </Box>
            )}
          </Box>
        </>
      )}
    </Paper>
  );
}
