import { Box, FormControlLabel, FormHelperText, FormLabel, Radio, RadioGroup } from "@mui/material";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IProjectSeed from "../../../app/IProjectSeed";
import { MinecraftTrack } from "../../../app/ICreatorToolsData";
import IGalleryItem from "../../../app/IGalleryItem";
import FormField from "../../shared/components/inputs/formField/FormField";
import { useState } from "react";
import { useDirectoryPicker } from "../../hooks/io/UseDirectoryPicker";
import useTelemetry from "../../../analytics/useTelemetry";
import { TelemetryEvents, TelemetryProperties } from "../../../analytics/TelemetryConstants";
import ProjectUtilities from "../../../app/ProjectUtilities";
import { useCreatorTools } from "../../contexts/creatorToolsContext/CreatorToolsContext";

interface Props {
  template: IGalleryItem;
  open: boolean;
  close: () => void;
  onNewProject: (seed: IProjectSeed) => void;
}

export default function NewProjectDialog({ template, open, close, onNewProject }: Props) {
  const targets = [
    { value: MinecraftTrack.main, label: "Latest Minecraft Bedrock" },
    { value: MinecraftTrack.preview, label: "Latest Minecraft Bedrock Preview" },
    { value: MinecraftTrack.edu, label: "Latest Minecraft Education" },
    { value: MinecraftTrack.eduPreview, label: "Latest Minecraft Education Preview" },
  ];

  const [tools] = useCreatorTools();
  const [projectStore, setProjectStore] = useState("browser");
  const [dirErrorMessage, setDirErrorMessage] = useState<string | null>(null);
  const [directory, pickDirectory, directoryError] = useDirectoryPicker(window, {
    onDirectoryPicked: () => setDirErrorMessage(null),
    checkEmptyDir: true,
  });
  const { trackEvent } = useTelemetry();

  function onFormSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const useLocalStorage = projectStore === "device";
    if (useLocalStorage && directoryError) {
      return;
    }

    if (useLocalStorage && !directory) {
      setDirErrorMessage("You must select a directory for device storage");
      return;
    }

    const formData = new FormData(event.currentTarget);
    const formValues = Object.fromEntries((formData as any).entries());

    trackEvent({
      name: TelemetryEvents.PROJECT_CREATED,
      properties: {
        [TelemetryProperties.TEMPLATE_ID]: template.id,
        [TelemetryProperties.TEMPLATE_TITLE]: template.title,
        [TelemetryProperties.TRACK]: formValues.target,
        [TelemetryProperties.STORAGE_TYPE]: useLocalStorage ? "device" : "browser",
      },
    });

    onNewProject({
      name: formValues.title,
      shortName: formValues.shortName,
      creator: formValues.creator,
      description: formValues.description,
      track: parseInt(formValues.target),
      galleryProject: template,
      targetFolderTitle: useLocalStorage ? directory?.name : undefined,
      targetFolder: useLocalStorage ? directory?.root : undefined,
    });
    close();
  }

  const showDirectorySelect = projectStore === "device";

  const suggestedName = ProjectUtilities.getSuggestedProjectName(template);
  const suggestedCreator = tools.creator;
  const suggestedShortName =
    suggestedCreator && ProjectUtilities.getSuggestedProjectShortName(suggestedCreator, suggestedName);
  const suggestedDesc = suggestedName;

  return (
    <Dialog open={open} onClose={close} PaperProps={{ component: "form", onSubmit: onFormSubmit }}>
      <DialogTitle variant="h4">New Minecraft Add-On Full Project</DialogTitle>
      <DialogContent>
        <FormField required defaultValue={suggestedName} id="title" label="Title" autoFocus />
        <FormField defaultValue={suggestedCreator} id="creator" label="Creator Name" />
        <FormField defaultValue={suggestedShortName} id="shortName" label="Short Name" />
        <FormField defaultValue={suggestedDesc} id="description" label="Description" type="textarea" />
        <Box marginTop={1}></Box>
        <FormField
          required
          select
          id="target"
          label="Target:"
          defaultValue={MinecraftTrack.main}
          SelectProps={{
            native: true,
          }}
          helperText="Select Target Platform"
        >
          {targets.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </FormField>
        <Box marginTop={2}></Box>
        <FormLabel id="store-project-location">Store project at:</FormLabel>
        <RadioGroup
          row
          color="secondary"
          aria-labelledby="store-project-location"
          name="storeProjectLocation"
          defaultValue="browser"
          onChange={(_, value) => setProjectStore(value)}
        >
          <FormControlLabel value="browser" control={<Radio />} label="Temporary Browser Storage" />
          <FormControlLabel value="device" control={<Radio />} label="Use Device Storage" />
        </RadioGroup>
        <Box marginTop={2}></Box>
        <Box display="flex" hidden={!showDirectorySelect}>
          <Button size="small" variant="contained" sx={{ mr: 2 }} onClick={pickDirectory}>
            Select Directory
          </Button>
          <FormField id="directoryLocation" disabled value={directory?.name} />
        </Box>
        <FormHelperText sx={{ color: (theme) => theme.palette.warning.main }}>{directoryError?.message}</FormHelperText>
        <FormHelperText sx={{ color: (theme) => theme.palette.warning.main }}>{dirErrorMessage}</FormHelperText>
      </DialogContent>

      <DialogActions>
        <Button variant="contained" onClick={close}>
          Cancel
        </Button>
        <Button data-testid="submit-button" variant="contained" type="submit">
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
}
