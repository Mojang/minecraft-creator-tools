import Paper from "@mui/material/Paper";
import Box from "@mui/material/Box";
import { CircularProgress, Tooltip, Typography } from "@mui/material";
import { useState, useEffect } from "react";
import Project from "../../../app/Project";
import IFolder from "../../../storage/IFolder";
import { Directory, useDirectoryPicker } from "../../hooks/io/UseDirectoryPicker";
import useTelemetry from "../../../analytics/useTelemetry";
import { TelemetryEvents, TelemetryProperties } from "../../../analytics/TelemetryConstants";
import McButton from "../../shared/components/inputs/mcButton/McButton";
import McListItem from "../../shared/components/inputs/mcListItem/McListItem";
import { mcColors } from "../../hooks/theme/mcColors";
import CreatorToolsHost, { CreatorToolsThemeStyle } from "../../../app/CreatorToolsHost";
/**
 * Default placeholder image for projects without a preview.
 * Shows a stylized grass block pattern.
 */
const DEFAULT_PROJECT_IMAGE = "./res/images/templates/sushi_roll.png";

/**
 * Formats a date in a friendly, compact format
 */
function formatDate(date: Date | null | undefined): string {
  if (!date) return "";
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return diffDays === 1 ? "1 day ago" : `${diffDays} days ago`;

  const weeks = Math.floor(diffDays / 7);
  if (diffDays < 30) return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;

  const months = Math.floor(diffDays / 30);
  if (diffDays < 365) return months === 1 ? "1 month ago" : `${months} months ago`;

  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

interface ProjectPanelProps {
  projectList: Project[];
  editFolder: (folder: IFolder, name?: string, isDocumentationProject?: boolean) => void;
  exportBackup: () => Promise<void>;
  openProject: (event: React.SyntheticEvent, project: Project) => void;
  maxItemsToShow?: number;
}

export default function ProjectPanel(props: ProjectPanelProps) {
  const { projectList, maxItemsToShow, editFolder, exportBackup, openProject } = props;
  const { trackEvent } = useTelemetry();

  const onDirectoryPicked = (directory?: Directory) => {
    if (dirError || !directory) {
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

  const onExportBackup = async () => {
    setIsExporting(true);
    const startTime = Date.now();
    let success = false;

    try {
      await exportBackup();
      success = true;
    } catch (error) {
      success = false;
    } finally {
      const duration = Date.now() - startTime;
      setIsExporting(false);

      trackEvent({
        name: TelemetryEvents.BACKUP_EXPORTED,
        properties: {
          [TelemetryProperties.EXPORT_SUCCESS]: success,
          [TelemetryProperties.EXPORT_FORMAT]: "backup",
        },
        measurements: {
          [TelemetryProperties.DURATION]: duration,
        },
      });
    }
  };

  const handleProjectOpen = (event: React.SyntheticEvent, project: Project) => {
    trackEvent({
      name: TelemetryEvents.PROJECT_OPENED,
      properties: {
        [TelemetryProperties.STORAGE_TYPE]: "browser",
        [TelemetryProperties.ACTION_SOURCE]: "projectList",
      },
    });

    openProject(event, project);
  };

  const [, pickDirectory, dirError] = useDirectoryPicker(window, { onDirectoryPicked, checkUnsafeFiles: true });

  const [isExporting, setIsExporting] = useState(false);
  const [, setProjectsLoaded] = useState(0);

  // Load project preferences to get preview images
  useEffect(() => {
    if (projectList && projectList.length > 0) {
      const loadProjectPreferences = async () => {
        for (const project of projectList) {
          await project.ensurePreferencesLoaded();
        }
        // Trigger re-render after loading
        setProjectsLoaded((prev) => prev + 1);
      };
      loadProjectPreferences();
    }
  }, [projectList]);

  // Track when project list is viewed
  useEffect(() => {
    if (projectList && projectList.length > 0) {
      trackEvent({
        name: TelemetryEvents.PROJECT_LIST_VIEWED,
        properties: {
          [TelemetryProperties.PROJECT_LIST_SIZE]: projectList.length,
          [TelemetryProperties.LOCATION]: "projectPanel",
        },
      });
    }
  }, [projectList, trackEvent]);

  const expandedMode = projectList?.length > 0;

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
      <Box sx={{ display: "flex", alignItems: "center", mb: expandedMode ? 0 : 2 }}>
        <Box
          component="img"
          src="./res/images/icons/chest.png"
          alt="Projects"
          aria-hidden="true"
          sx={(theme) => ({
            width: 28,
            height: 28,
            mr: 1,
            imageRendering: "pixelated",
            filter: theme.palette.mode === "dark" ? "none" : "invert(1)",
          })}
        />
        <Typography
          variant="h6"
          sx={(theme) => ({
            fontWeight: 600,
            textShadow: theme.palette.mode === "dark" ? "1px 1px 0px rgba(0,0,0,0.5)" : "none",
          })}
        >
          Your Projects
        </Typography>
      </Box>
      {expandedMode ? (
        <>
          <Box
            sx={{
              maxHeight: "20em",
              overflowY: "auto",
              overflowX: "hidden",
              display: "flex",
              flexDirection: "column",
              gap: 1,
              py: 1,
              mt: 1,
              pr: 0.5,
            }}
          >
            {projectList.slice(0, maxItemsToShow).map((project, index) => {
              const imageSource = project.previewImageBase64
                ? `data:image/png;base64,${project.previewImageBase64}`
                : CreatorToolsHost.theme === CreatorToolsThemeStyle.dark
                ? "./res/images/templates/redflower_lightbg.png"
                : "./res/images/templates/redflower_darkbg.png";

              return (
                <McListItem
                  key={index}
                  onClick={(e: React.MouseEvent<HTMLButtonElement>) => handleProjectOpen(e, project)}
                >
                  {/* Project thumbnail */}
                  <Box
                    sx={(theme) => ({
                      width: 48,
                      height: 48,
                      flexShrink: 0,
                      border: `1px solid ${theme.palette.mode === "dark" ? mcColors.gray4 : mcColors.gray3}`,
                      borderRadius: 0,
                      overflow: "hidden",
                      bgcolor: mcColors.gray6,
                      boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.2)",
                    })}
                  >
                    <Box
                      component="img"
                      src={imageSource}
                      alt=""
                      sx={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        imageRendering: "pixelated",
                      }}
                    />
                  </Box>
                  {/* Project info */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Tooltip title={project.simplifiedName} placement="top" arrow enterDelay={500}>
                      <Typography
                        variant="body1"
                        sx={(theme) => ({
                          fontWeight: 600,
                          fontSize: "0.95rem",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          color: theme.palette.mode === "dark" ? mcColors.gray1 : mcColors.gray6,
                        })}
                      >
                        {project.simplifiedName}
                      </Typography>
                    </Tooltip>
                    <Tooltip
                      title={project.modified ? project.modified.toLocaleString() : ""}
                      placement="bottom"
                      arrow
                      enterDelay={300}
                    >
                      <Typography
                        variant="caption"
                        sx={(theme) => ({
                          color: theme.palette.mode === "dark" ? mcColors.gray2 : mcColors.gray5,
                          fontSize: "0.75rem",
                          cursor: "default",
                        })}
                      >
                        {formatDate(project.modified)}
                      </Typography>
                    </Tooltip>
                  </Box>
                  {/* Arrow indicator */}
                  <Box
                    sx={(theme) => ({
                      color: theme.palette.mode === "dark" ? mcColors.gray3 : mcColors.gray4,
                      fontSize: "0.7rem",
                      opacity: 0.6,
                      ml: 0.5,
                    })}
                  >
                    ▶
                  </Box>
                </McListItem>
              );
            })}
          </Box>
          <Box marginBottom={1} />
        </>
      ) : (
        <Box sx={{ py: 2, px: 1, textAlign: "center", opacity: 0.7 }}>
          <Typography variant="body2">No projects yet. Start with a template above or drop files to begin!</Typography>
        </Box>
      )}
      {expandedMode && (
        <McButton variant="wood" fullWidth onClick={onExportBackup} disabled={isExporting}>
          {isExporting ? <CircularProgress size="1.5em" color="inherit" /> : "Export Backup"}
        </McButton>
      )}
    </Paper>
  );
}
