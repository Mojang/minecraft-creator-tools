import { Box, Card, CardActions, CardContent, Typography } from "@mui/material";
import IGalleryItem from "../../../app/IGalleryItem";
import GalleryReader from "../../../app/gallery/GalleryReader";
import NewProjectDialog from "./NewProjectDialog";
import { useState, useEffect } from "react";
import IProjectSeed from "../../../app/IProjectSeed";
import ImageOverlay from "../../shared/components/async/loadingSpinner/images/imageOverlay/ImageOverlay";
import useTelemetry from "../../../analytics/useTelemetry";
import { TelemetryEvents, TelemetryProperties } from "../../../analytics/TelemetryConstants";
import McButton from "../../shared/components/inputs/mcButton/McButton";
import McBadge from "../../shared/components/inputs/mcBadge/McBadge";
import { mcColors } from "../../hooks/theme/mcColors";
import { useIntl } from "react-intl";

import CreatorToolsHost, { CreatorToolsThemeStyle } from "../../../app/CreatorToolsHost";

// Duration to keep dialog mounted after closing (should match exit animation duration)
const DIALOG_EXIT_ANIMATION_MS = 300;
const beginnerTemplateIds = [
  "addonStarter",
  "tsStarter",
  "addonFull",
  "editor-basics",
  "dlStarter",
  "scriptBox",
  "editor-scriptBox",
  "cottaGame",
  "registeringExampleCustomComponent",
  "editor-multi",
];

interface TemplateCardProps {
  template: IGalleryItem;
  onNewProject: (seed: IProjectSeed) => void;
}
export default function TemplateCard({ template, onNewProject }: TemplateCardProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMounted, setDialogMounted] = useState(false);
  const { trackEvent } = useTelemetry();
  const intl = useIntl();

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
  const baseDescription = template.descriptionKey
    ? intl.formatMessage({ id: template.descriptionKey })
    : template.description;
  const templateDescription = beginnerTemplateIds.includes(template.id)
    ? intl.formatMessage({ id: `home.template.desc_${template.id}` })
    : baseDescription;

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
        data-testid={`template-card-${template.id}`}
        sx={(theme) => {
          const isDark = theme.palette.mode === "dark";
          return {
            height: "100%",
            display: "flex",
            flexDirection: "column",
            // MUI's <Card> defaults to overflow:hidden so its rounded
            // corners can mask child backgrounds. That clips content under
            // WCAG 1.4.12 user-style overrides (line-height, letter-
            // spacing, word-spacing) where the title/description grow
            // beyond the card's flex height. Allow overflow so text
            // remains readable; the rounded border still renders correctly
            // because none of our card children paint past the border.
            overflow: "visible",
            transition: "none",
            "@media (prefers-reduced-motion: no-preference)": {
              transition: "all 0.2s ease-in-out",
            },
            borderRadius: 1,
            border: isDark ? `2px solid ${mcColors.gray5}` : "1px solid rgba(0,0,0,0.12)",
            backgroundColor: isDark ? mcColors.gray5 : mcColors.white,
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
        <CardContent sx={{ flexGrow: 1, p: 0, position: "relative" }}>
          {template.id === "addonStarter" && (
            <Box
              sx={{
                position: "absolute",
                top: 6,
                right: 6,
                zIndex: 2,
                pointerEvents: "none",
              }}
            >
              <McBadge variant="green" size="small">
                {intl.formatMessage({ id: "home.template_card.recommended" })}
              </McBadge>
            </Box>
          )}
          <ImageOverlay
            image={reader.getGalleryImage(template)}
            item={template}
            alt={intl.formatMessage({ id: "home.template_card.image_alt" })}
            sx={{ pt: 0 }}
          >
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "2px" }}>
              <Typography
                variant="body1"
                sx={{
                  color: (theme) => theme.palette.common.white,
                  fontWeight: 700,
                  textShadow: "2px 2px 4px rgba(0,0,0,0.95)",
                  lineHeight: 1.3,
                  display: "inline-block",
                  px: 0.75,
                  py: 0.25,
                  backgroundColor: "rgba(0,0,0,0.65)",
                  borderRadius: "2px",
                }}
              >
                {template.titleKey ? intl.formatMessage({ id: template.titleKey }) : template.title}
              </Typography>
              <Box sx={{ display: "flex", flexDirection: "row", flexWrap: "wrap", gap: "4px" }}>
                {template.difficulty === "beginner" && (
                  <McBadge variant="green" size="small">
                    {intl.formatMessage({ id: "home.template_card.beginner_friendly" })}
                  </McBadge>
                )}
                {template.difficulty === "intermediate" && (
                  <McBadge variant="info" size="small">
                    {intl.formatMessage({ id: "home.template_card.intermediate" })}
                  </McBadge>
                )}
                {template.difficulty === "advanced" && (
                  <McBadge variant="stone" size="small">
                    {intl.formatMessage({ id: "home.template_card.advanced" })}
                  </McBadge>
                )}
              </Box>
            </Box>
            <Typography
              variant="body2"
              sx={{
                color: (theme) => theme.palette.common.white,
                textShadow: "2px 2px 4px rgba(0,0,0,0.95)",
                lineHeight: 1.4,
                mt: 0.5,
                display: "inline-block",
                px: 0.75,
                py: 0.25,
                backgroundColor: "rgba(0,0,0,0.62)",
                borderRadius: "2px",
              }}
            >
              {templateDescription}
            </Typography>
          </ImageOverlay>
        </CardContent>
        <CardActions
          sx={(theme) => ({
            pt: 1,
            px: 1,
            pb: 1,
            bgcolor: theme.palette.mode === "dark" ? "transparent" : `${mcColors.gray2}20`,
            borderTop: theme.palette.mode === "dark" ? "none" : `1px solid ${mcColors.gray3}20`,
          })}
        >
          <McButton
            variant="green"
            fullWidth
            onClick={onOpenProjectDialog}
            dataTestId={`template-create-${template.id}`}
          >
            {intl.formatMessage({ id: "home.template_card.create_new" })}
          </McButton>
        </CardActions>
      </Card>
    </>
  );
}
