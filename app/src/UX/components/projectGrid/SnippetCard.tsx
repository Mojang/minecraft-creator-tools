import { Card, CardActions, CardContent, Typography } from "@mui/material";
import IGalleryItem from "../../../app/IGalleryItem";
import GalleryReader from "../../../app/gallery/GalleryReader";
import ImageOverlay from "../../shared/components/async/loadingSpinner/images/imageOverlay/ImageOverlay";
import useTelemetry from "../../../analytics/useTelemetry";
import { TelemetryEvents, TelemetryProperties } from "../../../analytics/TelemetryConstants";
import McButton from "../../shared/components/inputs/mcButton/McButton";
import { mcColors } from "../../hooks/theme/mcColors";

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
              ? `0 8px 24px rgba(0,0,0,0.4), 0 0 0 1px ${mcColors.stoneLight}80`
              : `0 8px 24px rgba(0,0,0,0.15), 0 0 0 1px ${mcColors.stone}60`,
            borderColor: isDark ? mcColors.stoneLight : mcColors.stone,
          },
        };
      }}
    >
      <CardContent sx={{ flexGrow: 1, p: 0 }}>
        <ImageOverlay image={reader.getGalleryImage(snippet)} item={snippet} alt="snippet-background">
          {/* Color is explicitly  specified to contrast with our overlay background, regardless of theme */}
          <Typography
            variant="body2"
            sx={{
              color: (theme) => theme.palette.common.white,
              fontWeight: 600,
              textShadow: "1px 1px 2px rgba(0,0,0,0.6)",
            }}
          >
            {snippet.title}
          </Typography>
          <Typography
            variant="body2"
            fontSize={12}
            sx={{
              color: (theme) => theme.palette.common.white,
              textShadow: "1px 1px 2px rgba(0,0,0,0.5)",
            }}
          >
            Uses: {samp}
          </Typography>
        </ImageOverlay>
      </CardContent>
      <CardActions
        sx={(theme) => ({
          pt: 1,
          px: 1,
          pb: 1,
          bgcolor: theme.palette.mode === "dark" ? "transparent" : `${mcColors.stone}14`,
          borderTop: theme.palette.mode === "dark" ? "none" : `1px solid ${mcColors.stone}20`,
        })}
      >
        <McButton variant="stone" fullWidth onClick={handleOpen}>
          Open
        </McButton>
      </CardActions>
    </Card>
  );
}
