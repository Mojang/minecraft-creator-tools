import { Box, TypographyProps } from "@mui/material";
import { ReactNode } from "react";
import IGalleryItem from "../../../../../../../app/IGalleryItem";

interface ImageOverlayProps extends TypographyProps {
  image: string;
  item: IGalleryItem;
  alt: string;
  children?: ReactNode;
}

export default function ImageOverlay({ image, item, children, alt }: ImageOverlayProps) {
  let backgroundPositionX = undefined;
  let backgroundPositionY = undefined;
  let backgroundSize = undefined;

  if (item.logoLocation) {
    let multFactor = item.logoLocation.imageHeight ? 256 / item.logoLocation.imageHeight : 2;

    backgroundPositionX = "right";
    backgroundPositionY = "-" + item.logoLocation.y * multFactor + "px";
    backgroundSize =
      item.logoLocation.imageWidth * multFactor + "px" + " " + item.logoLocation.imageHeight * multFactor + "px";
  }

  return (
    <Box
      sx={{
        position: "relative",
        width: "100%",
        // Use minHeight rather than a fixed height so cards can grow
        // vertically when the user has applied text-spacing overrides per
        // WCAG 1.4.12. With a hard `height` + `overflow: hidden` the title
        // and description got clipped under aggressive line-height /
        // letter-spacing overrides; minHeight preserves the original visual
        // uniformity in the default case while allowing legitimate growth
        // when content demands it.
        minHeight: "128px",
        imageRendering: "pixelated",
        backgroundImage: `url("${image}")`,
        backgroundPositionX: backgroundPositionX,
        backgroundPositionY: backgroundPositionY,
        backgroundSize: backgroundSize ? backgroundSize : "contain",
        backgroundRepeat: "no-repeat",
        backgroundPosition: backgroundPositionX ? backgroundPositionX + " " + backgroundPositionY : "center right",
      }}
    >
      <Box
        component="div"
        width="100%"
        height="100%"
        p={0}
        sx={{
          objectFit: "cover",
        }}
      />
      <Box
        alignContent="flex-end"
        justifyContent="flex-start"
        sx={{
          position: "absolute",
          display: "flex",
          inset: 0,
          background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.6) 50%, rgba(0,0,0,0.2) 100%)",
        }}
      >
        <Box
          px={1.5}
          py={1}
          sx={{
            // No `overflow: hidden` here — under WCAG 1.4.12 user-style
            // overrides the title/description text grows beyond the
            // default 128px card height; clipping it would lose content.
            // Allowing overflow visibly extends the card and is the
            // conformant behavior per the criterion.
            width: "100%",
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
}
