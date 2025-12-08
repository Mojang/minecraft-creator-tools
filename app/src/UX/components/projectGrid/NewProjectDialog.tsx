import { Box, FormControlLabel, FormHelperText, Radio, RadioGroup, Typography, Zoom } from "@mui/material";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFileLines, faFloppyDisk } from "@fortawesome/free-solid-svg-icons";
import IProjectSeed from "../../../app/IProjectSeed";
import { MinecraftTrack } from "../../../app/ICreatorToolsData";
import IGalleryItem from "../../../app/IGalleryItem";
import FormField from "../../shared/components/inputs/formField/FormField";
import { useState, forwardRef } from "react";
import { useDirectoryPicker } from "../../hooks/io/UseDirectoryPicker";
import useTelemetry from "../../../analytics/useTelemetry";
import { TelemetryEvents, TelemetryProperties } from "../../../analytics/TelemetryConstants";
import ProjectUtilities from "../../../app/ProjectUtilities";
import { useCreatorTools } from "../../contexts/creatorToolsContext/CreatorToolsContext";
import { DefaultCreatorName } from "../../../app/CreatorTools";
import GalleryReader from "../../../app/gallery/GalleryReader";
import { TransitionProps } from "@mui/material/transitions";
import { CreatorToolsHost } from "../../../index.lib";
import { CreatorToolsThemeStyle } from "../../../app/CreatorToolsHost";

// Custom transition component for macOS-like pop-out effect
const PopOutTransition = forwardRef(function PopOutTransition(
  props: TransitionProps & { children: React.ReactElement },
  ref: React.Ref<unknown>
) {
  return <Zoom ref={ref} {...props} timeout={{ enter: 450, exit: 150 }} />;
});

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
  const suggestedCreator = tools.creator ? tools.creator : DefaultCreatorName;
  const suggestedShortName = ProjectUtilities.getSuggestedProjectShortName(suggestedCreator, suggestedName);
  const suggestedDesc = suggestedName;

  const reader = new GalleryReader(
    CreatorToolsHost.theme === CreatorToolsThemeStyle.dark
      ? "./res/images/templates/redflower_lightbg.png"
      : "./res/images/templates/redflower_darkbg.png"
  );
  const templateImage = reader.getGalleryImage(template);

  return (
    <Dialog
      open={open}
      onClose={close}
      maxWidth="sm"
      fullWidth
      TransitionComponent={PopOutTransition}
      PaperProps={{
        component: "form",
        onSubmit: onFormSubmit,
        sx: (theme) => {
          const isDark = theme.palette.mode === "dark";
          return {
            background: isDark
              ? `linear-gradient(180deg, ${theme.palette.background.paper} 0%, ${theme.palette.background.default} 100%)`
              : `linear-gradient(180deg, ${theme.palette.background.paper} 0%, ${theme.palette.background.default} 100%)`,
            border: `2px solid ${theme.palette.divider}`,
            borderRadius: 2,
            overflow: "hidden",
            boxShadow: isDark
              ? "0 24px 48px rgba(0,0,0,0.4), 0 12px 24px rgba(0,0,0,0.3)"
              : "0 24px 48px rgba(0,0,0,0.15), 0 12px 24px rgba(0,0,0,0.1)",
          };
        },
      }}
    >
      {/* Hero Header with Template Image */}
      <Box
        sx={(theme) => {
          const isDark = theme.palette.mode === "dark";
          return {
            position: "relative",
            height: 140,
            backgroundImage: `url("${templateImage}")`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            imageRendering: "pixelated",
            "&::after": {
              content: '""',
              position: "absolute",
              inset: 0,
              background: isDark
                ? `linear-gradient(to top, ${theme.palette.background.default} 0%, ${theme.palette.background.default}B3 40%, ${theme.palette.background.default}4D 100%)`
                : `linear-gradient(to top, ${theme.palette.background.default} 0%, ${theme.palette.background.default}B3 40%, ${theme.palette.background.default}4D 100%)`,
            },
          };
        }}
      >
        <Box
          sx={{
            position: "absolute",
            bottom: 16,
            left: 24,
            right: 24,
            zIndex: 1,
          }}
        >
          <Typography
            variant="overline"
            sx={(theme) => {
              const isDark = theme.palette.mode === "dark";
              return {
                color: isDark ? theme.palette.secondary.main : theme.palette.secondary.main,
                fontWeight: 600,
                letterSpacing: 2,
                textShadow: isDark ? "1px 1px 2px rgba(0,0,0,0.8)" : "none",
              };
            }}
          >
            Creating from template
          </Typography>
          <Typography
            variant="h4"
            sx={(theme) => {
              const isDark = theme.palette.mode === "dark";
              return {
                fontWeight: 700,
                color: isDark ? theme.palette.text.primary : theme.palette.primary.dark,
                textShadow: isDark ? "2px 2px 4px rgba(0,0,0,0.8)" : "none",
              };
            }}
          >
            {template.title}
          </Typography>
        </Box>
      </Box>

      <DialogContent sx={{ pt: 3 }}>
        {/* Project Details Section */}
        <Box
          sx={(theme) => {
            const isDark = theme.palette.mode === "dark";
            return {
              bgcolor: isDark ? "rgba(0,0,0,0.2)" : "rgba(0,0,0,0.03)",
              borderRadius: 1,
              p: 2,
              mb: 2,
              border: `1px solid ${theme.palette.divider}`,
            };
          }}
        >
          <Typography
            variant="subtitle2"
            sx={(theme) => ({
              color: theme.palette.secondary.main,
              mb: 2,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: 1,
            })}
          >
            <FontAwesomeIcon icon={faFileLines} style={{ marginRight: 8 }} />
            Project Details
          </Typography>
          <FormField required defaultValue={suggestedName} id="title" label="Title" autoFocus />
          <FormField defaultValue={suggestedCreator} id="creator" label="Creator Name" />
          <Box sx={{ display: "flex", gap: 2 }}>
            <Box sx={{ flex: 1 }}>
              <FormField defaultValue={suggestedShortName} id="shortName" label="Short Name" />
            </Box>
            <Box sx={{ flex: 1 }}>
              <FormField
                required
                select
                id="target"
                label="Target Platform"
                defaultValue={MinecraftTrack.main}
                SelectProps={{ native: true }}
              >
                {targets.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </FormField>
            </Box>
          </Box>
          <FormField defaultValue={suggestedDesc} id="description" label="Description" type="textarea" />
        </Box>

        {/* Storage Section */}
        <Box
          sx={(theme) => {
            const isDark = theme.palette.mode === "dark";
            return {
              bgcolor: isDark ? "rgba(0,0,0,0.2)" : "rgba(0,0,0,0.03)",
              borderRadius: 1,
              p: 2,
              border: `1px solid ${theme.palette.divider}`,
            };
          }}
        >
          <Typography
            variant="subtitle2"
            sx={(theme) => ({
              color: theme.palette.secondary.main,
              mb: 1,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: 1,
            })}
          >
            <FontAwesomeIcon icon={faFloppyDisk} style={{ marginRight: 8 }} />
            Storage Location
          </Typography>
          <RadioGroup
            row
            color="secondary"
            aria-labelledby="store-project-location"
            name="storeProjectLocation"
            defaultValue="browser"
            onChange={(_, value) => setProjectStore(value)}
            sx={{ mb: 1, alignItems: "flex-start" }}
          >
            <FormControlLabel
              value="browser"
              control={
                <Radio
                  sx={(theme) => ({
                    color: theme.palette.text.secondary,
                    "&.Mui-checked": { color: theme.palette.secondary.main },
                    mt: -0.5,
                  })}
                />
              }
              label={
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    Browser Storage
                  </Typography>
                  <Typography variant="caption" sx={{ opacity: 0.6 }}>
                    Temporary - clears with browser data
                  </Typography>
                </Box>
              }
              sx={{ mr: 4, alignItems: "flex-start" }}
            />
            <FormControlLabel
              value="device"
              control={
                <Radio
                  sx={(theme) => ({
                    color: theme.palette.text.secondary,
                    "&.Mui-checked": { color: theme.palette.secondary.main },
                    mt: -0.5,
                  })}
                />
              }
              label={
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    Device Storage
                  </Typography>
                  <Typography variant="caption" sx={{ opacity: 0.6 }}>
                    Saved to your computer
                  </Typography>
                </Box>
              }
              sx={{ alignItems: "flex-start" }}
            />
          </RadioGroup>

          {showDirectorySelect && (
            <Box
              sx={(theme) => {
                const isDark = theme.palette.mode === "dark";
                return {
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                  mt: 2,
                  p: 1.5,
                  bgcolor: isDark ? "rgba(0,0,0,0.2)" : "rgba(0,0,0,0.03)",
                  borderRadius: 1,
                  border: `1px dashed ${theme.palette.divider}`,
                };
              }}
            >
              <Button
                size="small"
                variant="contained"
                onClick={pickDirectory}
                sx={(theme) => {
                  return {
                    bgcolor: theme.palette.primary.main,
                    color: theme.palette.primary.contrastText,
                    border: `2px solid ${theme.palette.primary.light}`,
                    borderBottom: `3px solid ${theme.palette.primary.dark}`,
                    "&:hover": {
                      bgcolor: theme.palette.primary.light,
                    },
                  };
                }}
              >
                Choose Folder
              </Button>
              <Typography variant="body2" sx={{ opacity: directory ? 1 : 0.5 }}>
                {directory?.name || "No folder selected"}
              </Typography>
            </Box>
          )}
          <FormHelperText sx={{ color: (theme) => theme.palette.warning.main }}>
            {directoryError?.message}
          </FormHelperText>
          <FormHelperText sx={{ color: (theme) => theme.palette.warning.main }}>{dirErrorMessage}</FormHelperText>
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2, pt: 0, gap: 1 }}>
        <Button
          variant="outlined"
          onClick={close}
          sx={(theme) => {
            return {
              borderColor: theme.palette.divider,
              color: theme.palette.text.primary,
              "&:hover": {
                borderColor: theme.palette.text.secondary,
                bgcolor: theme.palette.action.hover,
              },
            };
          }}
        >
          Cancel
        </Button>
        <Button
          data-testid="submit-button"
          variant="contained"
          type="submit"
          sx={(theme) => {
            return {
              bgcolor: theme.palette.primary.main,
              color: theme.palette.primary.contrastText,
              fontWeight: 600,
              px: 4,
              border: `2px solid ${theme.palette.primary.light}`,
              borderBottom: `3px solid ${theme.palette.primary.dark}`,
              transition: "all 0.1s ease-in-out",
              "&:hover": {
                bgcolor: theme.palette.primary.light,
                borderColor: theme.palette.secondary.main,
                transform: "translateY(-1px)",
              },
              "&:active": {
                transform: "translateY(1px)",
                borderBottom: `2px solid ${theme.palette.primary.dark}`,
              },
            };
          }}
        >
          Create Project
        </Button>
      </DialogActions>
    </Dialog>
  );
}
