import * as React from "react";
import { styled } from "@mui/material/styles";
import { Box } from "@mui/material";
import { ChangeEvent, ReactNode, useState, useRef, KeyboardEvent } from "react";
import { mcColors } from "../../../../hooks/theme/mcColors";

const VisuallyHiddenInput = styled("input")({
  clip: "rect(0 0 0 0)",
  clipPath: "inset(50%)",
  height: 1,
  overflow: "hidden",
  position: "absolute",
  bottom: 0,
  left: 0,
  whiteSpace: "nowrap",
  width: 1,
});

/**
 * Color palette for green variant (matching McButton)
 */
const colors = {
  border: "#1e4d14",
  highlight: mcColors.green3,
  main: mcColors.green4,
  shadow: mcColors.green6,
  corner: mcColors.green5,
  text: mcColors.white,
};

interface FileUploadButtonProps {
  children?: ReactNode;
  onFileSelect?: (event: ChangeEvent<HTMLInputElement>) => void;
}

/**
 * FileUploadButton - Minecraft-styled file upload button
 *
 * Uses the same pixelated corner design as McButton but wraps a file input.
 * The button and file input are siblings (not nested) to avoid accessibility issues.
 */
export default function FileUploadButton({ children, onFileSelect }: FileUploadButtonProps) {
  const [isPressed, setIsPressed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const px = 2; // Pixel size for corners

  const handleMouseDown = () => setIsPressed(true);
  const handleMouseUp = () => setIsPressed(false);
  const handleMouseLeave = () => setIsPressed(false);

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    // Activate file picker on Enter or Space key
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      inputRef.current?.click();
    }
  };

  const handleClick = () => {
    inputRef.current?.click();
  };

  return (
    <Box sx={{ position: "relative", width: "100%", height: "100%" }}>
      {/* Hidden file input - sibling to button, not nested inside */}
      <VisuallyHiddenInput
        ref={inputRef}
        onChange={onFileSelect}
        type="file"
        multiple={true}
        className="file-upload"
        tabIndex={-1}
        aria-hidden="true"
      />
      {/* Visible button that triggers the file input */}
      <Box
        component="div"
        role="button"
        tabIndex={0}
        aria-label="Choose files to upload"
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onKeyDown={handleKeyDown}
        onClick={handleClick}
        sx={{
          width: "100%",
          height: "100%",
          minWidth: 100,
          display: "flex",
          cursor: "pointer",
          transition: "transform 0.05s ease-out",
          transform: isPressed ? "translateY(1px)" : "none",
          "&:focus": {
            outline: `2px solid ${colors.highlight}`,
            outlineOffset: 2,
          },
          "&:focus:not(:focus-visible)": {
            outline: "none",
          },
          "&:focus-visible": {
            outline: `2px solid ${colors.highlight}`,
            outlineOffset: 2,
          },
        }}
      >
        {/* Outer container with border - matching McButton grid structure */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: `${px}px 1fr ${px}px`,
            gridTemplateRows: `${px}px 1fr ${px}px`,
            border: `${px}px solid ${colors.border}`,
            backgroundColor: colors.main,
            width: "100%",
            height: "100%",
          }}
        >
          {/* Top-left corner */}
          <Box
            sx={{
              gridColumn: 1,
              gridRow: 1,
              backgroundColor: isPressed ? colors.shadow : colors.highlight,
              width: px,
              height: px,
            }}
          />
          {/* Top edge */}
          <Box
            sx={{
              gridColumn: 2,
              gridRow: 1,
              backgroundColor: isPressed ? colors.shadow : colors.highlight,
              height: px,
            }}
          />
          {/* Top-right corner (dark pixel) */}
          <Box
            sx={{
              gridColumn: 3,
              gridRow: 1,
              backgroundColor: colors.border,
              width: px,
              height: px,
            }}
          />
          {/* Left edge */}
          <Box
            sx={{
              gridColumn: 1,
              gridRow: 2,
              backgroundColor: isPressed ? colors.shadow : colors.highlight,
              width: px,
            }}
          />
          {/* Center - Main button content */}
          <Box
            sx={{
              gridColumn: 2,
              gridRow: 2,
              backgroundColor: colors.main,
              color: colors.text,
              px: 3,
              py: 1.5,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              fontWeight: 600,
              fontSize: "0.875rem",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              fontFamily: '"Noto Sans", sans-serif',
              textShadow: `1px 1px 0px ${colors.shadow}`,
              minHeight: 36,
            }}
          >
            {children}
          </Box>
          {/* Right edge */}
          <Box
            sx={{
              gridColumn: 3,
              gridRow: 2,
              backgroundColor: isPressed ? colors.highlight : colors.shadow,
              width: px,
            }}
          />
          {/* Bottom-left corner (dark pixel) */}
          <Box
            sx={{
              gridColumn: 1,
              gridRow: 3,
              backgroundColor: colors.border,
              width: px,
              height: px,
            }}
          />
          {/* Bottom edge */}
          <Box
            sx={{
              gridColumn: 2,
              gridRow: 3,
              backgroundColor: isPressed ? colors.highlight : colors.shadow,
              height: px,
            }}
          />
          {/* Bottom-right corner */}
          <Box
            sx={{
              gridColumn: 3,
              gridRow: 3,
              backgroundColor: isPressed ? colors.highlight : colors.shadow,
              width: px,
              height: px,
            }}
          />
        </Box>
      </Box>
    </Box>
  );
}
