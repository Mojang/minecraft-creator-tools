import { Card, CardActions, CardContent, Typography } from "@mui/material";
import IGalleryItem from "../../../app/IGalleryItem";
import GalleryReader from "../../../app/gallery/GalleryReader";
import NewProjectDialog from "./NewProjectDialog";
import { useState, useEffect } from "react";
import IProjectSeed from "../../../app/IProjectSeed";
import ImageOverlay from "../../shared/components/async/loadingSpinner/images/imageOverlay/ImageOverlay";
import useTelemetry from "../../../analytics/useTelemetry";
import { TelemetryEvents, TelemetryProperties } from "../../../analytics/TelemetryConstants";
import McButton from "../../shared/components/inputs/mcButton/McButton";
import { mcColors } from "../../hooks/theme/mcColors";

import CreatorToolsHost, { CreatorToolsThemeStyle } from "../../../app/CreatorToolsHost";

// Duration to keep dialog mounted after closing (should match exit animation duration)
const DIALOG_EXIT_ANIMATION_MS = 300;

interface TemplateCardProps {
  template: IGalleryItem;
  onNewProject: (seed: IProjectSeed) => void;
}
export default function TemplateCard({ template, onNewProject }: TemplateCardProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMounted, setDialogMounted] = useState(false);
  const { trackEvent } = useTelemetry();

  function onOpenProjectDialog() {
    setDialogMounted(true);
    setDialogOpen(true);
    trackEvent({
      name: TelemetryEvents.TEMPLATE_SELECTED,
      properties: {
        [TelemetryProperties.TEMPLATE_ID]: template.id,
        [TelemetryProperties.TEMPLATE_TITLE]: template.title,
      },
    });
  }

  function onCloseProjectDialog() {
    setDialogOpen(false);
    // Delay unmount to allow exit animation to complete
  }

  // Handle delayed unmount after dialog closes
  useEffect(() => {
    if (!dialogOpen && dialogMounted) {
      const timer = setTimeout(() => {
        setDialogMounted(false);
      }, DIALOG_EXIT_ANIMATION_MS);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [dialogOpen, dialogMounted]);

  const reader = new GalleryReader(
    CreatorToolsHost.theme === CreatorToolsThemeStyle.dark
      ? "./res/images/templates/redflower_lightbg.png"
      : "./res/images/templates/redflower_darkbg.png"
  );

  return (
    <>
      {dialogMounted && (
        <NewProjectDialog
          template={template}
          open={dialogOpen}
          close={onCloseProjectDialog}
          onNewProject={onNewProject}
        />
      )}
      <Card
        variant="outlined"
        elevation={0}
        sx={(theme) => {
          const isDark = theme.palette.mode === "dark";
          return {
            height: "100%",
            display: "flex",
            flexDirection: "column",
            transition: "all 0.2s ease-in-out",
            border: isDark ? `2px solid ${mcColors.gray5}` : "1px solid rgba(0,0,0,0.12)",
            boxShadow: "none",
            "&:hover": {
              transform: "translateY(-4px)",
              boxShadow: isDark
                ? `0 8px 24px rgba(0,0,0,0.4), 0 0 0 1px ${mcColors.green4}80`
                : `0 8px 24px rgba(0,0,0,0.15), 0 0 0 1px ${mcColors.green4}60`,
              borderColor: isDark ? mcColors.green4 : mcColors.green5,
            },
          };
        }}
      >
        <CardContent sx={{ flexGrow: 1, p: 0 }}>
          <ImageOverlay
            image={reader.getGalleryImage(template)}
            item={template}
            alt="Background image for a template"
            sx={{ pt: 0 }}
          >
            <Typography
              variant="body1"
              sx={{
                color: (theme) => theme.palette.common.white,
                fontWeight: 600,
                textShadow: "1px 1px 2px rgba(0,0,0,0.6)",
                lineHeight: 1.3,
              }}
            >
              {template.title}
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: (theme) => theme.palette.common.white,
                textShadow: "1px 1px 2px rgba(0,0,0,0.5)",
                opacity: 0.95,
                lineHeight: 1.4,
                mt: 0.5,
              }}
            >
              {template.description}
            </Typography>
          </ImageOverlay>
        </CardContent>
        <CardActions
          sx={(theme) => ({
            pt: 1,
            px: 1,
            pb: 1,
            bgcolor: theme.palette.mode === "dark" ? "transparent" : `${mcColors.green4}12`,
            borderTop: theme.palette.mode === "dark" ? "none" : `1px solid ${mcColors.green4}20`,
          })}
        >
          <McButton variant="green" fullWidth onClick={onOpenProjectDialog}>
            Create New
          </McButton>
        </CardActions>
      </Card>
    </>
  );
}
