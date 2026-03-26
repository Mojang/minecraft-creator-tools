import { useCallback, useMemo } from "react";
import { Dialog } from "@mui/material";
import { useCreatorTools } from "../../contexts/creatorToolsContext/CreatorToolsContext";
import { PostCreateAction } from "../../../app/IProjectSeed";
import IProjectSeed from "../../../app/IProjectSeed";
import IGalleryItem from "../../../app/IGalleryItem";
import ContentWizard, { ContentWizardType } from "../ContentWizard";
import CreatorToolsHost, { CreatorToolsThemeStyle } from "../../../app/CreatorToolsHost";
import { minecraftToolDarkTheme, minecraftToolLightTheme } from "../../../core/StandardInit";
import { IMinecraftContentDefinition } from "../../../minecraft/IContentMetaSchema";

interface GoalWizardDialogProps {
  goalAction: PostCreateAction;
  addonStarterTemplate: IGalleryItem;
  open: boolean;
  close: () => void;
  onNewProject: (seed: IProjectSeed) => void;
}

function goalToWizardType(goalAction: PostCreateAction): ContentWizardType {
  switch (goalAction) {
    case "addMob":
      return ContentWizardType.entity;
    case "addBlock":
      return ContentWizardType.block;
    case "addItem":
      return ContentWizardType.item;
  }
}

/**
 * GoalWizardDialog — wraps the ContentWizard (Create Mob/Block/Item) in a dialog
 * on the homepage. When the wizard completes, creates an addonStarter project and
 * passes the content definition through so it's generated after the project opens.
 */
export default function GoalWizardDialog({
  goalAction,
  addonStarterTemplate,
  open,
  close,
  onNewProject,
}: GoalWizardDialogProps) {
  const [creatorTools] = useCreatorTools();
  const theme = useMemo(
    () => (CreatorToolsHost.theme === CreatorToolsThemeStyle.dark ? minecraftToolDarkTheme : minecraftToolLightTheme),
    []
  );

  // Stub project: ContentWizard needs a project reference but we're pre-project-creation.
  // It only uses project for name conflict checks and script language, so a minimal stub works.
  const dummyProject = useMemo(
    () =>
      ({
        getItemsByType: () => [],
        items: [],
        scriptLanguage: 0,
        effectiveScriptLanguage: 0,
      }) as any,
    []
  );

  const handleWizardComplete = useCallback(
    (definition: IMinecraftContentDefinition) => {
      // Fallback if called without project name (shouldn't happen with showProjectNameStep)
      const projectName = definition.displayName || definition.namespace || "My Add-On";

      const seed: IProjectSeed = {
        name: projectName,
        galleryProject: addonStarterTemplate,
        contentDefinition: definition,
      };

      onNewProject(seed);
      close();
    },
    [addonStarterTemplate, onNewProject, close]
  );

  const handleWizardCompleteWithProjectName = useCallback(
    (definition: IMinecraftContentDefinition, projectName: string) => {
      const seed: IProjectSeed = {
        name: projectName || "My Add-On",
        galleryProject: addonStarterTemplate,
        contentDefinition: definition,
      };

      onNewProject(seed);
      close();
    },
    [addonStarterTemplate, onNewProject, close]
  );

  const wizardType = goalToWizardType(goalAction);

  return (
    <Dialog
      open={open}
      onClose={close}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          height: "80vh",
          maxHeight: "700px",
          overflow: "hidden",
          "& .cwiz-wizard, & .cwiz-launcher-wrapper": {
            height: "100%",
            maxHeight: "100%",
          },
        },
      }}
    >
      <ContentWizard
        theme={theme}
        project={dummyProject}
        creatorTools={creatorTools}
        heightOffset={0}
        onComplete={handleWizardComplete}
        onCancel={close}
        initialType={wizardType}
        showProjectNameStep={true}
        onCompleteWithProjectName={handleWizardCompleteWithProjectName}
      />
    </Dialog>
  );
}
