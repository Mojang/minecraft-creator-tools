import { Button, ButtonGroup, Card, CardActions, CardContent, Typography } from "@mui/material";
import IGalleryItem from "../../../app/IGalleryItem";
import GalleryReader from "../../../app/gallery/GalleryReader";
import ImageOverlay from "../../shared/components/async/loadingSpinner/images/imageOverlay/ImageOverlay";
import useTelemetry from "../../../analytics/useTelemetry";
import { TelemetryEvents, TelemetryProperties } from "../../../analytics/TelemetryConstants";

interface SnippetCardProps {
  snippet: IGalleryItem;
  onOpen: (snippet: IGalleryItem) => void;
}

const defaultImage = "./res/images/templates/CardBackground_GREY_256x100.jpg";

export default function SnippetCard({ snippet, onOpen }: SnippetCardProps) {
  const reader = new GalleryReader(defaultImage);
  const { trackEvent } = useTelemetry();

  const handleOpen = () => {
    trackEvent({
      name: TelemetryEvents.SAMPLE_DOWNLOADED,
      properties: {
        [TelemetryProperties.SNIPPET_ID]: snippet.id,
        [TelemetryProperties.SNIPPET_TITLE]: snippet.title,
      },
    });
    onOpen(snippet);
  };

  let samp = "";

  if (snippet.topics) {
    for (const content of snippet.topics) {
      if (samp.length > 0) {
        samp += ", ";
      }

      samp += content;

      if (samp.length > 27) {
        break;
      }
    }
  }
  return (
    <Card
      variant="outlined"
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <CardContent sx={{ flexGrow: 1, p: 0 }}>
        <ImageOverlay image={reader.getGalleryImage(snippet)} item={snippet} alt="snippet-background">
          {/* Color is explicitly  specified to contrast with our overlay background, regardless of theme */}
          <Typography variant="body2" sx={{ color: (theme) => theme.palette.common.white }}>
            {snippet.title}
          </Typography>
          <Typography variant="body2" fontSize={12} sx={{ color: (theme) => theme.palette.common.white }}>
            Uses: {samp}
          </Typography>
        </ImageOverlay>
      </CardContent>
      <CardActions sx={{ pt: 0 }}>
        <ButtonGroup fullWidth variant="contained" aria-label="snippet actions group">
          <Button variant="contained" onClick={handleOpen}>
            Open
          </Button>
        </ButtonGroup>
      </CardActions>
    </Card>
  );
}
