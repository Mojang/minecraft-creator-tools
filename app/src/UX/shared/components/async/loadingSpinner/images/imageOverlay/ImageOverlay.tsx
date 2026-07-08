import { Box, TypographyProps } from "@mui/material";
import { ReactNode } from "react";
import IGalleryItem from "../../../../../../../app/IGalleryItem";

interface ImageOverlayProps extends TypographyProps {
  image: string;
  item: IGalleryItem;
  alt: string;
  children?: ReactNode;
  /**
   * Vertical placement of the overlaid title/description block within the image area.
   * Defaults to "bottom" — the text sits on the darkest part of the bottom-up gradient,
   * which is required when the caption has no solid background of its own (e.g. SnippetCard).
   * Callers whose text carries its own opaque background (e.g. TemplateCard) can use "top"
   * so the title hugs the top of the card instead of leaving an image gap above it.
   */
  contentAlign?: "top" | "center" | "bottom";
}

export default function ImageOverlay({ image, item, children, alt, contentAlign = "bottom" }: ImageOverlayProps) {
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
        // The caption text lives in normal flow (below), so a flex column lets
        // `contentAlign` place it within the minHeight while still letting the
        // box GROW past minHeight when the caption is taller. An earlier version
        // positioned the caption absolutely (inset:0): that kept it out of flow,
        // so under text-spacing overrides the text grew past the box and
        // overlapped the card's button / the next card instead of pushing them
        // down. Keeping the caption in flow is what makes the card expand.
        display: "flex",
        flexDirection: "column",
        // Vertical placement is caller-controlled via `contentAlign`. The default "bottom"
        // sits the caption on the darkest part of the gradient (needed when the caption has
        // no solid background of its own) and keeps it clear of top-right card badges. "top"
        // hugs the title to the top of the card — use it only when the caption carries its
        // own opaque background, otherwise contrast suffers in the lighter top gradient.
        justifyContent: contentAlign === "top" ? "flex-start" : contentAlign === "center" ? "center" : "flex-end",
        imageRendering: "pixelated",
        backgroundImage: `url("${image}")`,
        backgroundPositionX: backgroundPositionX,
        backgroundPositionY: backgroundPositionY,
        backgroundSize: backgroundSize ? backgroundSize : "contain",
        backgroundRepeat: "no-repeat",
        backgroundPosition: backgroundPositionX ? backgroundPositionX + " " + backgroundPositionY : "center right",
      }}
    >
      {/* Decorative darkening gradient. Absolutely positioned so it always covers
          the full image (including when the caption grows the box) without taking
          part in layout — it must never push the caption out of flow. */}
      <Box
        aria-hidden="true"
        sx={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.6) 50%, rgba(0,0,0,0.2) 100%)",
        }}
      />
      <Box
        px={1.5}
        py={1}
        sx={{
          // In normal flow and above the gradient. No `overflow: hidden` — under
          // WCAG 1.4.12 user-style overrides the title/description grows beyond
          // the default 128px card height, and because this box is in flow the
          // box grows with it rather than clipping or overlapping siblings.
          position: "relative",
          zIndex: 1,
          width: "100%",
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
