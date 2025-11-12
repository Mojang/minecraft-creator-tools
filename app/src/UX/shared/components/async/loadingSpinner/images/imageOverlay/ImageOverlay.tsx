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
        height: "128px",
        overflow: "hidden",
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
        aria-label={alt}
        width="100%"
        height="100%"
        p={0}
        sx={{
          objectFit: "cover",
        }}
      />
      <Box alignContent="center" justifyContent="center" sx={{ position: "absolute", display: "flex", inset: 0 }}>
        <Box
          px={0.75}
          pt={0.0}
          sx={{
            bgcolor: "rgba(0,0,0,0.5)",
            overflow: "auto",
            width: "100%",

            borderRadius: 1,
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
}
