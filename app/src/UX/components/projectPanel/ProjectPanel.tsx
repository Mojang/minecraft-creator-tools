import Paper from "@mui/material/Paper";
import Box from "@mui/material/Box";
import ButtonGroup from "@mui/material/ButtonGroup";
import {
  Alert,
  Button,
  CircularProgress,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Tab,
  Tabs,
} from "@mui/material";
import { useState } from "react";
import TabPanel from "../../shared/components/navigation/tabPanel/TabPanel";
import Project from "../../../app/Project";
import IFolder from "../../../storage/IFolder";
import { Directory, useDirectoryPicker } from "../../hooks/io/UseDirectoryPicker";
import AppServiceProxy from "../../../core/AppServiceProxy";
import ProjectUtilities from "../../../app/ProjectUtilities";

interface ProjectPanelProps {
  projectList: Project[];
  editFolder: (folder: IFolder, name?: string, isDocumentationProject?: boolean) => void;
  exportBackup: () => Promise<void>;
  openProject: (event: React.SyntheticEvent, project: Project) => void;
  maxItemsToShow?: number;
  openAppFolder: () => void;
}

export default function ProjectPanel(props: ProjectPanelProps) {
  const { projectList, maxItemsToShow, editFolder, exportBackup, openProject, openAppFolder } = props;

  const onDirectoryPicked = (directory?: Directory) => {
    if (dirError || !directory) {
      return;
    }

    editFolder(directory.root, directory.name, false);
  };

  const updateTab = (_event: React.SyntheticEvent, value: number) => {
    setTabIndex(value);
  };

  const onExportBackup = async () => {
    setIsExporting(true);
    await exportBackup();
    setIsExporting(false);
  };

  const [, pickDirectory, dirError] = useDirectoryPicker(window, { onDirectoryPicked, checkUnsafeFiles: true });

  const [isExporting, setIsExporting] = useState(false);
  const [tabIndex, setTabIndex] = useState(0);

  const expandedMode = projectList?.length > 0;

  return (
    <Paper sx={{ py: 1, px: 1, borderRadius: 1 }}>
      {expandedMode && (
        <>
          <Box sx={{ borderBottom: 1, p: 0, borderColor: "divider" }}>
            <Tabs
              value={tabIndex}
              onChange={updateTab}
              aria-label="project tabs"
              indicatorColor="secondary"
              textColor="inherit"
            >
              <Tab label="Projects" id="projects" color="primary" aria-controls="projecttab-0" />
              {/* Currently no content available for second tab, but left in for easy re-enabling */}
              {/* <Tab label="Snippets" id="projects" color="snippets" aria-controls="projecttab-1" /> */}
            </Tabs>
          </Box>
          <TabPanel id={0} current={tabIndex}>
            <Box maxHeight="16em" overflow="auto">
              <List>
                {projectList.slice(0, maxItemsToShow).map((project, index) => (
                  <ListItem key={index} disablePadding>
                    <ListItemButton onClick={(e) => openProject(e, project)}>
                      <ListItemText primary={project.simplifiedName} secondary={project.modified?.toDateString()} />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            </Box>
          </TabPanel>
          {/* <TabPanel id={1} current={tabIndex}></TabPanel> */}
          <Box marginBottom={1} />
        </>
      )}
      <Alert hidden={!dirError} severity="error" sx={{ my: 2 }}>
        {dirError?.message}
      </Alert>
      <ButtonGroup fullWidth>
        {expandedMode && (
          <Button variant="contained" onClick={onExportBackup} disabled={isExporting} sx={{ marginRight: 2 }}>
            {isExporting ? <CircularProgress size="1.5em" color="inherit" /> : "Export Backup"}
          </Button>
        )}
        {AppServiceProxy.hasAppServiceOrSim && (
          <Button variant="contained" onClick={openAppFolder}>
            Edit Folder
          </Button>
        )}
        {!AppServiceProxy.hasAppServiceOrSim && (
          <Button variant="contained" onClick={pickDirectory}>
            Edit Folder on This Device
          </Button>
        )}
      </ButtonGroup>
    </Paper>
  );
}
