import { Button, ButtonGroup, Card, CardActions, CardContent, Typography } from "@mui/material";
import IGalleryItem from "../../../app/IGalleryItem";
import GalleryReader from "../../../app/gallery/GalleryReader";
import NewProjectDialog from "./NewProjectDialog";
import { useState } from "react";
import IProjectSeed from "../../../app/IProjectSeed";
import ImageOverlay from "../../shared/components/async/loadingSpinner/images/imageOverlay/ImageOverlay";
import useTelemetry from "../../../analytics/useTelemetry";
import { TelemetryEvents, TelemetryProperties } from "../../../analytics/TelemetryConstants";

const defaultImage = "./res/images/templates/sushi_roll.png";

interface TemplateCardProps {
  template: IGalleryItem;
  onNewProject: (seed: IProjectSeed) => void;
}
export default function TemplateCard({ template, onNewProject }: TemplateCardProps) {
  const [showProjectDialog, setShowProjectDialog] = useState(false);
  const { trackEvent } = useTelemetry();

  function onOpenProjectDialog() {
    setShowProjectDialog(true);
    trackEvent({
      name: TelemetryEvents.TEMPLATE_SELECTED,
      properties: {
        [TelemetryProperties.TEMPLATE_ID]: template.id,
        [TelemetryProperties.TEMPLATE_TITLE]: template.title,
      },
    });
  }

  function onCloseProjectDialog() {
    setShowProjectDialog(false);
  }

  const reader = new GalleryReader(defaultImage);

  return (
    <>
      <NewProjectDialog
        template={template}
        open={showProjectDialog}
        close={onCloseProjectDialog}
        onNewProject={onNewProject}
      />
      <Card
        variant="outlined"
        sx={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <CardContent sx={{ flexGrow: 1, p: 0 }}>
          <ImageOverlay
            image={reader.getGalleryImage(template)}
            item={template}
            alt="Background image for a template"
            sx={{ pt: 0 }}
          >
            <Typography variant="body1" sx={{ color: (theme) => theme.palette.common.white }}>
              {template.title}
            </Typography>
            <Typography variant="body2" sx={{ color: (theme) => theme.palette.common.white }}>
              {template.description}
            </Typography>
          </ImageOverlay>
        </CardContent>
        <CardActions sx={{ pt: 0 }}>
          <ButtonGroup fullWidth variant="contained" aria-label="template actions group">
            <Button variant="contained" onClick={onOpenProjectDialog}>
              Create New
            </Button>
          </ButtonGroup>
        </CardActions>
      </Card>
    </>
  );
}
