/*
 * ==========================================================================================
 * HOME - LANDING PAGE EXPERIENCE NOTES
 * ==========================================================================================
 *
 * OVERVIEW:
 * ---------
 * Home.tsx is the landing page component for MCT web experience. It uses Material UI (MUI)
 * and displays the project gallery, recent projects, and file inspection capabilities.
 * This is the first screen users see when opening the application.
 *
 * COMPONENT STRUCTURE:
 * --------------------
 * Home renders:
 * - Layout: Top-level page wrapper with navigation
 * - InspectPanel: File upload, folder selection, local folder access
 * - ProjectPanel: Recent projects list with open/export actions
 * - ProjectGrid: Gallery of project templates (Add-On Starter, etc.)
 *
 * MATERIAL UI USAGE:
 * ------------------
 * Unlike older FluentUI-based components, Home uses MUI components:
 * - Box, Grid for layout
 * - Theme provided via CreatorToolsContext
 * - Responsive grid: xs=12 for mobile, lg=3/9 for desktop split
 *
 * HOOKS PATTERN:
 * --------------
 * Uses useHomeMonolith() custom hook to centralize state management:
 * - errorMessageContainer: Error display handling
 * - onNewProjectFromFolderInstanceSelected: Folder selection handler
 * - handleExportAll: Backup export functionality
 * - handleProjectClicked: Open existing project
 * - handleOpenLocalFolderClick: Local folder access (Electron/VSCode)
 * - recentProjects: List of recently opened projects
 *
 * CONTEXT PROVIDERS:
 * ------------------
 * - CreatorToolsProvider: Makes creatorTools available to child components
 *   via useCreatorTools() hook
 *
 * ENTRY POINTS TO EDITOR:
 * -----------------------
 * Users enter the editor (ProjectEditor) via:
 * 1. Click "New" under a template in ProjectGrid → Creates project, navigates to editor
 * 2. Click project in ProjectPanel → Opens existing project
 * 3. Drop/upload files via InspectPanel → Creates/opens project
 * 4. Click "Open Project Folder" in InspectPanel → Opens local folder
 *
 * RELATED FILES:
 * --------------
 * - UseHomeMonolith.ts: State management hook for Home
 * - InspectPanel.tsx: File inspection component
 * - ProjectPanel.tsx: Recent projects component
 * - ProjectGrid.tsx: Template gallery component
 * - Layout.tsx: Page wrapper with navigation
 * - CreatorToolsContext.tsx: Context provider for creatorTools
 *
 * APP SERVICE DETECTION:
 * ----------------------
 * AppServiceProxy.hasAppServiceOrSim determines if running in:
 * - Electron app (has local file access)
 * - VS Code extension (has workspace access)
 * - Pure web (limited to uploads/downloads)
 *
 * ==========================================================================================
 */

import { Box, Grid } from "@mui/material";
import { useCallback, useState } from "react";
import InspectPanel from "../components/inspectPanel/InspectPanel";
import ProjectGrid from "./projectGrid/ProjectGrid";
import Layout from "../components/layout/Layout";
import useHomeMonolith from "../hooks/home/UseHomeMonolith";
import HomeProps from "./HomeProps";
import { CreatorToolsProvider } from "../contexts/creatorToolsContext/CreatorToolsContext";
import ProjectPanel from "../components/projectPanel/ProjectPanel";
import AppServiceProxy from "../../core/AppServiceProxy";

export default function Home({ creatorTools, ...props }: HomeProps) {
  // Counter used to force re-render when the project list changes (e.g., after a command creates a project)
  const [, setProjectListVersion] = useState(0);
  const handleProjectsChanged = useCallback(() => {
    setProjectListVersion((v) => v + 1);
  }, []);

  const monolith = useHomeMonolith(creatorTools, { creatorTools, ...props });
  const {
    errorMessageContainer,
    onNewProjectFromFolderInstanceSelected: onEditFolder,
    handleExportAll: onExportBackup,
    handleProjectClicked,
    handleOpenLocalFolderClick,
    handleRemoveProject,
    handleDeleteProject,
    recentProjects,
  } = monolith;

  return (
    <CreatorToolsProvider creatorTools={creatorTools}>
      <Layout isApp={AppServiceProxy.hasAppServiceOrSim} onSaveBackups={onExportBackup}>
        <Box>
          {errorMessageContainer}
          <Grid container spacing={{ xs: 2, md: 3, lg: 4 }} sx={{ width: "auto" }}>
            <Grid
              item
              xs={12}
              md={3}
              sx={{
                display: "flex",
                flexDirection: "column",
              }}
            >
              <InspectPanel
                onFilesSubmitted={props.onFilesSubmitted}
                editFolder={onEditFolder}
                openAppFolder={handleOpenLocalFolderClick}
              />
              {onEditFolder && (
                <Box
                  sx={{
                    mt: { xs: 2, md: 3, lg: 4 },
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <ProjectPanel
                    projectList={recentProjects || []}
                    editFolder={onEditFolder}
                    exportBackup={onExportBackup}
                    openProject={handleProjectClicked}
                    onRemoveProject={handleRemoveProject}
                    onDeleteProject={handleDeleteProject}
                  />
                </Box>
              )}
            </Grid>

            <Grid item xs={12} md={9}>
              <div id="templates">
                <ProjectGrid
                  onAppGalleryAction={props.onGalleryItemCommand}
                  onSetProject={props.onSetProject}
                  onProjectsChanged={handleProjectsChanged}
                />
              </div>
            </Grid>
          </Grid>
        </Box>
      </Layout>
    </CreatorToolsProvider>
  );
}
