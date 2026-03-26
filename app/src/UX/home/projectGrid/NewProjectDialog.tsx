import { Box, Collapse, FormControlLabel, FormHelperText, Radio, RadioGroup, Typography, Zoom } from "@mui/material";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import McButton from "../../shared/components/inputs/mcButton/McButton";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFileLines,
  faFloppyDisk,
  faChevronDown,
  faChevronRight,
  faFolderOpen,
} from "@fortawesome/free-solid-svg-icons";
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
import CreatorToolsHost, { CreatorToolsThemeStyle } from "../../../app/CreatorToolsHost";
import { useIntl } from "react-intl";
import AppServiceProxy, { AppServiceProxyCommands } from "../../../core/AppServiceProxy";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";

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
    { value: MinecraftTrack.main, labelId: "home.new_project.target_bedrock" },
    { value: MinecraftTrack.preview, labelId: "home.new_project.target_bedrock_preview" },
    { value: MinecraftTrack.edu, labelId: "home.new_project.target_edu" },
    { value: MinecraftTrack.eduPreview, labelId: "home.new_project.target_edu_preview" },
  ];

  const [tools] = useCreatorTools();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isElectron = AppServiceProxy.hasAppService;
  const [projectStore, setProjectStore] = useState(isElectron ? "documents" : "device");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [dirErrorMessage, setDirErrorMessage] = useState<string | null>(null);
  const [electronFolderPath, setElectronFolderPath] = useState<string | null>(null);
  const [directory, pickDirectory, directoryError] = useDirectoryPicker(window, {
    onDirectoryPicked: () => setDirErrorMessage(null),
    checkEmptyDir: true,
  });
  const { trackEvent } = useTelemetry();
  const intl = useIntl();

  async function handleElectronPickFolder() {
    const result = await AppServiceProxy.sendAsync(AppServiceProxyCommands.openFolder, "");
    if (result && result.length > 0) {
      setElectronFolderPath(result);
      setDirErrorMessage(null);
    }
  }

  function onFormSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const useLocalStorage = projectStore === "device";
    const useCustomFolder = isElectron && projectStore === "custom";
    const useDocumentsFolder = isElectron && projectStore === "documents";

    // Web "Save to My Computer" validations
    if (useLocalStorage && directoryError) {
      return;
    }
    if (useLocalStorage && !directory) {
      setDirErrorMessage(intl.formatMessage({ id: "home.new_project.directory_error" }));
      return;
    }

    // Electron "Custom Folder" validation
    if (useCustomFolder && !electronFolderPath) {
      setDirErrorMessage(intl.formatMessage({ id: "home.new_project.custom_folder_error" }));
      return;
    }

    const formData = new FormData(event.currentTarget);
    const formValues: Record<string, string> = {
      title: (formData.get("title") as string) ?? "",
      shortName: (formData.get("shortName") as string) ?? "",
      creator: (formData.get("creator") as string) ?? "",
      description: (formData.get("description") as string) ?? "",
      target: (formData.get("target") as string) ?? "",
    };

    const suggestedName = ProjectUtilities.getSuggestedProjectName(template);
    const suggestedCreator = tools.creator ? tools.creator : DefaultCreatorName;
    const suggestedShortName = ProjectUtilities.getSuggestedProjectShortName(suggestedCreator, suggestedName);

    const isTitleCustomized = formValues.title !== suggestedName;
    const isCreatorCustomized = formValues.creator !== suggestedCreator;
    const isShortNameCustomized = formValues.shortName !== suggestedShortName;

    let storageType = "browser";
    if (useDocumentsFolder) {
      storageType = "documents";
    } else if (useCustomFolder) {
      storageType = "custom";
    } else if (useLocalStorage) {
      storageType = "device";
    }

    trackEvent({
      name: TelemetryEvents.PROJECT_CREATED,
      properties: {
        [TelemetryProperties.TEMPLATE_ID]: template.id,
        [TelemetryProperties.TEMPLATE_TITLE]: template.title,
        [TelemetryProperties.TRACK]: formValues.target,
        [TelemetryProperties.STORAGE_TYPE]: storageType,
        [TelemetryProperties.IS_TITLE_CUSTOMIZED]: isTitleCustomized,
        [TelemetryProperties.IS_CREATOR_CUSTOMIZED]: isCreatorCustomized,
        [TelemetryProperties.IS_SHORT_NAME_CUSTOMIZED]: isShortNameCustomized,
      },
    });

    onNewProject({
      name: formValues.title,
      shortName: formValues.shortName,
      creator: formValues.creator,
      description: formValues.description,
      track: parseInt(formValues.target),
      galleryProject: template,
      // For Electron "Custom Folder": pass the tokenized path from the native folder picker
      path: useCustomFolder ? (electronFolderPath ?? undefined) : undefined,
      // For web "Save to My Computer": pass the Web File System API directory handle
      targetFolderTitle: useLocalStorage ? directory?.name : undefined,
      targetFolder: useLocalStorage ? directory?.root : undefined,
    });
    close();
  }

  const showDirectorySelect = !isElectron && projectStore === "device";
  const showElectronFolderSelect = isElectron && projectStore === "custom";

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
  const selectedStorageFolder = showElectronFolderSelect
    ? electronFolderPath
    : showDirectorySelect
      ? directory?.name
      : undefined;
  const storageSummaryId =
    projectStore === "documents"
      ? "home.new_project.storage_summary_documents"
      : projectStore === "browser"
        ? "home.new_project.storage_summary_browser"
        : selectedStorageFolder
          ? "home.new_project.storage_summary_selected"
          : "home.new_project.storage_summary_choose_folder";

  return (
    <Dialog
      open={open}
      onClose={close}
      maxWidth="sm"
      fullWidth
      fullScreen={isMobile}
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
            borderRadius: "4px",
            overflow: "visible",
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
            {intl.formatMessage({ id: "home.new_project.creating_from_template" })}
          </Typography>
          <Typography
            variant="h4"
            sx={(theme) => {
              const isDark = theme.palette.mode === "dark";
              return {
                fontWeight: 700,
                fontFamily: '"Noto Sans", "Segoe UI", sans-serif',
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
              borderRadius: "4px",
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
            {intl.formatMessage({ id: "home.new_project.project_details" })}
          </Typography>
          <FormField
            required
            defaultValue={suggestedName}
            id="title"
            label={intl.formatMessage({ id: "home.new_project.title" })}
            autoFocus
          />
          <FormField
            defaultValue={suggestedCreator}
            id="creator"
            label={intl.formatMessage({ id: "home.new_project.creator" })}
          />
          <Box
            onClick={() => setShowAdvanced(!showAdvanced)}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              cursor: "pointer",
              mt: 1,
              mb: 0.5,
              opacity: 0.7,
              "&:hover": { opacity: 1 },
              userSelect: "none",
            }}
          >
            <FontAwesomeIcon icon={showAdvanced ? faChevronDown : faChevronRight} style={{ fontSize: 10 }} />
            <Typography variant="caption" sx={{ fontWeight: 500 }}>
              {intl.formatMessage({
                id: showAdvanced ? "home.new_project.hide_advanced" : "home.new_project.show_advanced",
              })}
            </Typography>
            {!showAdvanced && (
              <Typography variant="caption" sx={{ fontSize: "10px", opacity: 0.6, ml: 1 }}>
                {intl.formatMessage({ id: "home.new_project.advanced_summary" })}
              </Typography>
            )}
          </Box>
          <Collapse in={showAdvanced}>
            <Box sx={{ display: "flex", gap: 2 }}>
              <Box sx={{ flex: 1 }}>
                <FormField
                  defaultValue={suggestedShortName}
                  id="shortName"
                  label={intl.formatMessage({ id: "home.new_project.folder_name" })}
                  helperText={intl.formatMessage({ id: "home.new_project.folder_name_helper" })}
                />
              </Box>
              <Box sx={{ flex: 1 }}>
                <FormField
                  required
                  select
                  id="target"
                  label={intl.formatMessage({ id: "home.new_project.target_platform" })}
                  defaultValue={MinecraftTrack.main}
                  SelectProps={{ native: true }}
                >
                  {targets.map((option) => (
                    <option key={option.value} value={option.value}>
                      {intl.formatMessage({ id: option.labelId })}
                    </option>
                  ))}
                </FormField>
              </Box>
            </Box>
            <FormField
              defaultValue={suggestedDesc}
              id="description"
              label={intl.formatMessage({ id: "home.new_project.description" })}
              type="textarea"
            />
          </Collapse>
        </Box>

        {/* Storage Section */}
        <Box
          sx={(theme) => {
            const isDark = theme.palette.mode === "dark";
            return {
              bgcolor: isDark ? "rgba(0,0,0,0.2)" : "rgba(0,0,0,0.03)",
              borderRadius: "4px",
              p: 2,
              border: `1px solid ${theme.palette.divider}`,
            };
          }}
        >
          <Typography
            variant="subtitle2"
            id="store-project-location"
            sx={(theme) => ({
              color: theme.palette.secondary.main,
              mb: 1,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: 1,
            })}
          >
            <FontAwesomeIcon icon={faFloppyDisk} style={{ marginRight: 8 }} />
            {intl.formatMessage({ id: "home.new_project.storage_location" })}
          </Typography>
          <RadioGroup
            color="secondary"
            aria-labelledby="store-project-location"
            name="storeProjectLocation"
            defaultValue={isElectron ? "documents" : "device"}
            onChange={(_, value) => setProjectStore(value)}
            sx={{ mb: 1, alignItems: "flex-start" }}
          >
            {(isElectron
              ? [
                  {
                    value: "documents",
                    title: intl.formatMessage({ id: "home.new_project.storage_documents_title" }),
                    description: intl.formatMessage({ id: "home.new_project.storage_documents_desc" }),
                    isFirst: true,
                  },
                  {
                    value: "custom",
                    title: intl.formatMessage({ id: "home.new_project.storage_custom_title" }),
                    description: intl.formatMessage({ id: "home.new_project.storage_custom_desc" }),
                    isFirst: false,
                  },
                ]
              : [
                  {
                    value: "device",
                    title: intl.formatMessage({ id: "home.new_project.storage_device_title" }),
                    description: intl.formatMessage({ id: "home.new_project.storage_device_desc" }),
                    isFirst: true,
                  },
                  {
                    value: "browser",
                    title: intl.formatMessage({ id: "home.new_project.storage_browser_title" }),
                    description: intl.formatMessage({ id: "home.new_project.storage_browser_desc" }),
                    isFirst: false,
                  },
                ]
            ).map((opt) => (
              <FormControlLabel
                key={opt.value}
                value={opt.value}
                control={
                  <Radio
                    sx={(theme) => ({
                      color: theme.palette.text.secondary,
                      "&.Mui-checked": { color: theme.palette.secondary.main },
                    })}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {opt.title}
                    </Typography>
                  </Box>
                }
                sx={{ alignItems: "center", ...(opt.isFirst ? { mr: 4 } : {}) }}
              />
            ))}
          </RadioGroup>

          <Box
            sx={(theme) => {
              const isDark = theme.palette.mode === "dark";
              return {
                display: "flex",
                alignItems: "flex-start",
                gap: 1.5,
                mt: 1.5,
                mb: 1,
                p: 1.5,
                borderRadius: "4px",
                border: `1px solid ${theme.palette.divider}`,
                backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.025)",
              };
            }}
          >
            <Box
              sx={(theme) => ({
                width: 26,
                height: 26,
                borderRadius: "4px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                bgcolor: theme.palette.primary.main,
                color: theme.palette.primary.contrastText,
                flexShrink: 0,
                mt: 0.25,
              })}
            >
              <FontAwesomeIcon icon={faFloppyDisk} />
            </Box>
            <Box>
              <Typography variant="caption" sx={{ display: "block", fontWeight: 700, letterSpacing: 0.5, mb: 0.5 }}>
                {intl.formatMessage({ id: "home.new_project.storage_summary_title" })}
              </Typography>
              <Typography variant="body2" sx={{ lineHeight: 1.5 }}>
                {intl.formatMessage(
                  { id: storageSummaryId },
                  selectedStorageFolder ? { folderName: selectedStorageFolder } : undefined
                )}
              </Typography>
            </Box>
          </Box>

          {showElectronFolderSelect && (
            <Box
              sx={(theme) => {
                const hasFolder = Boolean(electronFolderPath);
                return {
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                  mt: 2,
                  p: 1.5,
                  bgcolor: hasFolder
                    ? theme.palette.mode === "dark"
                      ? "rgba(82,165,53,0.14)"
                      : "rgba(82,165,53,0.1)"
                    : theme.palette.mode === "dark"
                      ? "rgba(0,0,0,0.2)"
                      : "rgba(0,0,0,0.03)",
                  borderRadius: "4px",
                  border: hasFolder ? `1px solid ${theme.palette.success.main}` : `1px dashed ${theme.palette.divider}`,
                };
              }}
            >
              <Button
                size="small"
                variant="contained"
                onClick={handleElectronPickFolder}
                startIcon={<FontAwesomeIcon icon={faFolderOpen} />}
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
                {intl.formatMessage({ id: "home.new_project.choose_folder" })}
              </Button>
              <Typography
                variant="body2"
                sx={(theme) => ({
                  opacity: electronFolderPath ? 1 : 0.6,
                  fontWeight: electronFolderPath ? 600 : 400,
                  color: electronFolderPath ? theme.palette.text.primary : theme.palette.text.secondary,
                })}
              >
                {electronFolderPath || intl.formatMessage({ id: "home.new_project.no_folder_selected" })}
              </Typography>
            </Box>
          )}

          {showDirectorySelect && (
            <Box
              sx={(theme) => {
                const hasFolder = Boolean(directory);
                return {
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                  mt: 2,
                  p: 1.5,
                  bgcolor: hasFolder
                    ? theme.palette.mode === "dark"
                      ? "rgba(82,165,53,0.14)"
                      : "rgba(82,165,53,0.1)"
                    : theme.palette.mode === "dark"
                      ? "rgba(0,0,0,0.2)"
                      : "rgba(0,0,0,0.03)",
                  borderRadius: "4px",
                  border: hasFolder ? `1px solid ${theme.palette.success.main}` : `1px dashed ${theme.palette.divider}`,
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
                {intl.formatMessage({ id: "home.new_project.choose_folder" })}
              </Button>
              <Typography
                variant="body2"
                sx={(theme) => ({
                  opacity: directory ? 1 : 0.6,
                  fontWeight: directory ? 600 : 400,
                  color: directory ? theme.palette.text.primary : theme.palette.text.secondary,
                })}
              >
                {directory?.name || intl.formatMessage({ id: "home.new_project.no_folder_selected" })}
              </Typography>
            </Box>
          )}
          <FormHelperText sx={{ color: (theme) => theme.palette.warning.main }}>
            {directoryError?.message}
          </FormHelperText>
          <FormHelperText sx={{ color: (theme) => theme.palette.warning.main }}>{dirErrorMessage}</FormHelperText>
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2, pt: 1.5, gap: 1 }}>
        <McButton variant="stone" onClick={close}>
          {intl.formatMessage({ id: "home.new_project.cancel" })}
        </McButton>
        <McButton
          variant="green"
          dataTestId="submit-button"
          onClick={(e) => {
            const form = (e.currentTarget as HTMLElement).closest("form");
            if (form) form.requestSubmit();
          }}
        >
          {intl.formatMessage({ id: "home.new_project.create_project" })}
        </McButton>
      </DialogActions>
    </Dialog>
  );
}
