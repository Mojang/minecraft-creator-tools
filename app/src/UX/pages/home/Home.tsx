import { Box, Grid } from "@mui/material";
import InspectPanel from "../../components/inspectPanel/InspectPanel";
import ProjectGrid from "../../components/projectGrid/ProjectGrid";
import Layout from "../../components/layout/Layout";
import useHomeMonolith from "../../hooks/home/UseHomeMonolith";
import HomeProps from "./HomeProps";
import { CreatorToolsProvider } from "../../contexts/creatorToolsContext/CreatorToolsContext";
import ProjectPanel from "../../components/projectPanel/ProjectPanel";
import AppServiceProxy from "../../../core/AppServiceProxy";

export default function Home({ creatorTools, ...props }: HomeProps) {
  const monolith = useHomeMonolith(creatorTools, { creatorTools, ...props });
  const {
    errorMessageContainer,
    onNewProjectFromFolderInstanceSelected: onEditFolder,
    handleExportAll: onExportBackup,
    handleProjectClicked,
    handleOpenLocalFolderClick,
    recentProjects,
  } = monolith;

  return (
    <CreatorToolsProvider creatorTools={creatorTools}>
      <Layout isApp={AppServiceProxy.hasAppServiceOrSim} onSaveBackups={onExportBackup}>
        <Box>
          {errorMessageContainer}
          <Grid container spacing={3} sx={{ width: "auto" }}>
            <Grid item xs={12} lg={3}>
              <InspectPanel onNewProjectSelected={props.onNewProjectSelected} />
              <Box margin={1} />
              {onEditFolder && (
                <ProjectPanel
                  projectList={recentProjects || []}
                  editFolder={onEditFolder}
                  exportBackup={onExportBackup}
                  openProject={handleProjectClicked}
                  openAppFolder={handleOpenLocalFolderClick}
                />
              )}
            </Grid>

            <Grid item xs={12} lg={9}>
              <ProjectGrid onAppGalleryAction={props.onGalleryItemCommand} />
            </Grid>
          </Grid>
        </Box>
      </Layout>
    </CreatorToolsProvider>
  );
}
