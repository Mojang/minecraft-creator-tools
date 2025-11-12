import { Box, ButtonGroup, Paper, Typography } from "@mui/material";
import FileUploadButton from "../../shared/components/inputs/fileUploadButton/FileUploadButton";
import { NewProjectSelectEvent } from "../../pages/home/HomeActions";
import useProjectUploads from "../../hooks/projects/UseProjectUploads";
import FileDropArea from "../../shared/components/fileDropArea/FileDropArea";
import LoadingSpinner from "../../shared/components/async/loadingSpinner/LoadingSpinner";
import AppServiceProxy from "../../../core/AppServiceProxy";

interface InspectPanelProps {
  onNewProjectSelected?: NewProjectSelectEvent;
}
export default function InspectPanel({ onNewProjectSelected }: InspectPanelProps) {
  const [handleFileUpload, loading] = useProjectUploads(onNewProjectSelected);
  return (
    <Paper sx={{ py: 1, px: 1, borderRadius: 1 }}>
      {loading ? (
        <LoadingSpinner minHeight="6em" />
      ) : (
        <>
          <Box px={1}>
            <Typography variant="body1">
              <Box
                component="img"
                role="img"
                src="./res/images/icons/eye.png"
                alt="Inspect Icon"
                aria-hidden="true"
                width={24}
                height={24}
                sx={{
                  top: 4,
                  position: "relative",
                  pt: 0.4,
                  pr: 0.6,
                }}
              />
              View, validate and edit Minecraft add-ons
              {!AppServiceProxy.hasAppServiceOrSim && " in your browser"}
            </Typography>
            <Box marginBottom={2} />
            <FileDropArea onFileDrop={handleFileUpload}>
              <Typography gutterBottom sx={{ paddingTop: 0.5 }}>
                Drag & drop zip or mcworld/mcaddon/mcpack files here
              </Typography>
            </FileDropArea>
          </Box>
          <Box marginBottom={2} />
          <ButtonGroup fullWidth>
            <FileUploadButton onFileSelect={handleFileUpload}>Choose Pack File</FileUploadButton>
          </ButtonGroup>
        </>
      )}
    </Paper>
  );
}
