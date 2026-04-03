import Paper from "@mui/material/Paper";
import Box from "@mui/material/Box";
import {
  CircularProgress,
  Tooltip,
  Typography,
  Menu,
  MenuItem,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from "@mui/material";
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
import AppServiceProxy from "../../../core/AppServiceProxy";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faDownload } from "@fortawesome/free-solid-svg-icons";
import { useIntl } from "react-intl";
/**
 * Default placeholder image for projects without a preview.
 * Shows a stylized grass block pattern.
 */
const DEFAULT_PROJECT_IMAGE = CreatorToolsHost.contentWebRoot + "res/images/templates/sushi_roll.png";

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
  onRemoveProject?: (project: Project) => void;
  onDeleteProject?: (project: Project) => void;
  maxItemsToShow?: number;
}

export default function ProjectPanel(props: ProjectPanelProps) {
  const { projectList, maxItemsToShow, editFolder, exportBackup, openProject } = props;
  const { trackEvent } = useTelemetry();
  const intl = useIntl();

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
    const properties: Record<string, string> = {
      [TelemetryProperties.STORAGE_TYPE]: "browser",
      [TelemetryProperties.ACTION_SOURCE]: "projectList",
    };

    if (project.created) {
      properties[TelemetryProperties.CREATION_DATE] = project.created.toISOString();
    }

    if (project.lastOpened) {
      properties[TelemetryProperties.LAST_OPENED_DATE] = project.lastOpened.toISOString();
    }

    trackEvent({
      name: TelemetryEvents.PROJECT_OPENED,
      properties,
    });

    openProject(event, project);
  };

  const [, pickDirectory, dirError] = useDirectoryPicker(window, { onDirectoryPicked, checkUnsafeFiles: true });

  const [isExporting, setIsExporting] = useState(false);
  const [, setProjectsLoaded] = useState(0);

  // Context menu state
  const [contextMenuAnchor, setContextMenuAnchor] = useState<null | HTMLElement>(null);
  const [contextMenuProject, setContextMenuProject] = useState<Project | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<"remove" | "delete">("remove");
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);

  // Handle context menu open (right-click or "..." button)
  const handleContextMenuOpen = (event: React.MouseEvent<HTMLElement>, project: Project) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenuAnchor(event.currentTarget);
    setContextMenuProject(project);
  };

  // Handle context menu close
  const handleContextMenuClose = () => {
    setContextMenuAnchor(null);
  };

  // Handle open action from context menu
  const handleOpenClick = () => {
    handleContextMenuClose();
    if (contextMenuProject) {
      // Create a synthetic event for the openProject callback
      const syntheticEvent = { preventDefault: () => {}, stopPropagation: () => {} } as React.SyntheticEvent;
      openProject(syntheticEvent, contextMenuProject);
    }
  };

  // Handle remove action from context menu
  const handleRemoveClick = () => {
    handleContextMenuClose();
    setPendingAction("remove");
    setConfirmDialogOpen(true);
  };

  // Handle delete action from context menu (web only)
  const handleDeleteClick = () => {
    handleContextMenuClose();
    setPendingAction("delete");
    setConfirmDialogOpen(true);
  };

  // Handle confirm remove/delete
  const handleConfirmAction = () => {
    if (contextMenuProject) {
      if (pendingAction === "delete" && props.onDeleteProject) {
        props.onDeleteProject(contextMenuProject);
      } else if (props.onRemoveProject) {
        props.onRemoveProject(contextMenuProject);
      }

      trackEvent({
        name: TelemetryEvents.PROJECT_DELETED,
        properties: {
          [TelemetryProperties.ACTION_SOURCE]: "projectList",
          [TelemetryProperties.ACTION_TYPE]: pendingAction,
        },
      });
    }
    setConfirmDialogOpen(false);
    setContextMenuProject(null);
  };

  // Handle cancel remove/delete
  const handleCancelAction = () => {
    setConfirmDialogOpen(false);
    setContextMenuProject(null);
  };

  // Long press handlers for touch devices
  const handleTouchStart = (event: React.TouchEvent<HTMLElement>, project: Project) => {
    const timer = setTimeout(() => {
      // Use the touch target for positioning
      const target = event.currentTarget;
      setContextMenuAnchor(target);
      setContextMenuProject(project);
    }, 600); // 600ms long press
    setLongPressTimer(timer);
  };

  const handleTouchEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  const handleTouchMove = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

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
        display: "flex",
        flexDirection: "column",
      })}
    >
      <Box sx={{ display: "flex", alignItems: "center", mb: expandedMode ? 0 : 2 }}>
        <Box
          component="img"
          src={CreatorToolsHost.contentWebRoot + "res/images/icons/chest.png"}
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
          component="h2"
          sx={(theme) => ({
            fontWeight: 600,
            textShadow: theme.palette.mode === "dark" ? "1px 1px 0px rgba(0,0,0,0.5)" : "none",
          })}
        >
          {intl.formatMessage({ id: "home.project_panel.title" })}
        </Typography>
      </Box>
      {expandedMode ? (
        <>
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
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
                  ? CreatorToolsHost.contentWebRoot + "res/images/templates/redflower_darkbg.png"
                  : CreatorToolsHost.contentWebRoot + "res/images/templates/redflower_lightbg.png";

              return (
                <Box
                  key={index}
                  onContextMenu={(e) => handleContextMenuOpen(e, project)}
                  onTouchStart={(e) => handleTouchStart(e, project)}
                  onTouchEnd={handleTouchEnd}
                  onTouchMove={handleTouchMove}
                  sx={{ display: "flex", alignItems: "center", gap: 1 }}
                >
                  <McListItem
                    onClick={(e: React.MouseEvent<HTMLButtonElement>) => handleProjectOpen(e, project)}
                    sx={{ flex: 1 }}
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
                        alt="Project thumbnail"
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
                  </McListItem>
                  {/* More options button */}
                  {props.onRemoveProject && (
                    <Tooltip title={intl.formatMessage({ id: "home.project_panel.more_options" })} arrow>
                      <IconButton
                        size="small"
                        onClick={(e) => handleContextMenuOpen(e, project)}
                        aria-label={intl.formatMessage({ id: "home.project_panel.more_options_for" }, { projectName: project.simplifiedName })}
                        sx={(theme) => ({
                          ml: 0.5,
                          color: theme.palette.mode === "dark" ? mcColors.gray3 : mcColors.gray4,
                          "&:hover": {
                            color: theme.palette.mode === "dark" ? mcColors.gray1 : mcColors.gray6,
                            bgcolor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
                          },
                        })}
                      >
                        <Box component="span" sx={{ fontSize: "1.2rem", lineHeight: 1 }}>
                          ⋮
                        </Box>
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              );
            })}
          </Box>
          <Box marginBottom={1} />
        </>
      ) : (
        <Box sx={{ py: 2, px: 1, textAlign: "left" }}>
          <Typography variant="body2" sx={{ mb: 1, opacity: 0.85 }}>
            {intl.formatMessage({ id: "home.project_panel.no_projects" })}
          </Typography>
        </Box>
      )}
      {expandedMode && (
        <Box sx={{ display: "flex", justifyContent: "center", pt: 1 }}>
          <Typography
            component="button"
            onClick={onExportBackup}
            disabled={isExporting}
            sx={(theme) => ({
              background: "none",
              border: "none",
              cursor: isExporting ? "wait" : "pointer",
              fontSize: "0.85rem",
              fontWeight: 500,
              color: theme.palette.mode === "dark" ? mcColors.brownLight : mcColors.brown,
              opacity: isExporting ? 0.6 : 0.8,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 0.5,
              transition: "all 0.15s ease-in-out",
              "&:hover": {
                opacity: 1,
                textDecoration: "underline",
              },
            })}
          >
            {isExporting ? (
              <>
                <CircularProgress size={12} color="inherit" /> {intl.formatMessage({ id: "home.project_panel.download_backup_progress" })}…
              </>
            ) : (
              <>
                <FontAwesomeIcon icon={faDownload} style={{ fontSize: "0.75rem" }} /> {intl.formatMessage({ id: "home.project_panel.download_backup" })}
              </>
            )}
          </Typography>
        </Box>
      )}

      {/* Context menu for project actions */}
      <Menu
        anchorEl={contextMenuAnchor}
        open={Boolean(contextMenuAnchor)}
        onClose={handleContextMenuClose}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "right",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "right",
        }}
        slotProps={{
          paper: {
            sx: {
              "& .MuiMenuItem-root": { fontSize: "13px", padding: "4px 14px", minHeight: "28px" },
              "& .MuiList-root": { py: 0.5 },
            },
          },
        }}
      >
        <MenuItem onClick={handleOpenClick}>{intl.formatMessage({ id: "home.project_panel.open_project" })}</MenuItem>
        <MenuItem onClick={handleRemoveClick}>{intl.formatMessage({ id: "home.project_panel.remove_from_list" })}</MenuItem>
        {/* Delete option only available on web (not Electron/app) */}
        {!AppServiceProxy.hasAppServiceOrSim && props.onDeleteProject && (
          <MenuItem onClick={handleDeleteClick} sx={{ color: "error.main" }}>
            {intl.formatMessage({ id: "home.project_panel.delete_project" })}
          </MenuItem>
        )}
      </Menu>

      {/* Confirmation dialog for project removal/deletion */}
      <Dialog
        open={confirmDialogOpen}
        onClose={handleCancelAction}
        aria-labelledby="remove-project-dialog-title"
        aria-describedby="remove-project-dialog-description"
      >
        <DialogTitle id="remove-project-dialog-title">
          {pendingAction === "delete" 
            ? intl.formatMessage({ id: "home.project_panel.delete_dialog_title" })
            : intl.formatMessage({ id: "home.project_panel.remove_dialog_title" })}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="remove-project-dialog-description">
            {pendingAction === "delete"
              ? intl.formatMessage(
                  { id: "home.project_panel.delete_dialog_message" },
                  { projectName: contextMenuProject?.simplifiedName }
                )
              : intl.formatMessage(
                  { id: "home.project_panel.remove_dialog_message" },
                  { projectName: contextMenuProject?.simplifiedName }
                )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <McButton variant="stone" onClick={handleCancelAction}>
            {intl.formatMessage({ id: "home.project_panel.cancel" })}
          </McButton>
          <McButton variant="green" onClick={handleConfirmAction}>
            {pendingAction === "delete" 
              ? intl.formatMessage({ id: "home.project_panel.delete" })
              : intl.formatMessage({ id: "home.project_panel.remove" })}
          </McButton>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
