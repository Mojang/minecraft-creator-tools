import React, { useState, ReactNode } from "react";
import { Box, ButtonBase } from "@mui/material";
import { mcColors } from "../../../../hooks/theme/mcColors";

/**
 * Minecraft-style button color variants
 * Based on the Minecraft UI color system
 * See: docs/ux/ColorSystem.md
 */
export type McButtonVariant = "green" | "stone" | "wood";

interface McButtonProps {
  children: ReactNode;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  variant?: McButtonVariant;
  fullWidth?: boolean;
  disabled?: boolean;
  className?: string;
  sx?: object;
  type?: "button" | "submit" | "reset";
  dataTestId?: string;
}

/**
 * Color palettes for each button variant
 * Each variant has 5 colors derived from mcColors:
 * - border: Outer border color (darkest)
 * - highlight: Top/left inner edge (lightest)
 * - main: Button face background
 * - shadow: Bottom/right inner edge (darker)
 * - corner: Corner pixel color
 */
const colorPalettes = {
  green: {
    border: mcColors.green7,
    highlight: mcColors.green3,
    main: mcColors.green4,
    shadow: mcColors.green6,
    corner: mcColors.green5,
    text: mcColors.white,
  },
  stone: {
    border: mcColors.stoneBorder,
    highlight: mcColors.stoneLight,
    main: mcColors.stone,
    shadow: mcColors.stoneDark,
    corner: mcColors.stoneMid,
    text: mcColors.white,
  },
  wood: {
    border: mcColors.brownBorder,
    highlight: mcColors.brownLight,
    main: mcColors.brown,
    shadow: mcColors.brownDark,
    corner: mcColors.brownMid,
    text: mcColors.white,
  },
};

/**
 * McButton - A Minecraft-style button with pixelated corners
 *
 * This component recreates the authentic Minecraft UI button appearance:
 * - Pixelated single-pixel corners instead of beveled edges
 * - 3D pressed effect on click
 * - Color variants matching Minecraft Creator palette
 *
 * @example
 * <McButton variant="green" onClick={handleClick}>
 *   CREATE NEW
 * </McButton>
 */
export default function McButton({
  children,
  onClick,
  variant = "green",
  fullWidth = false,
  disabled = false,
  className,
  sx,
  type,
  dataTestId,
}: McButtonProps) {
  const [isPressed, setIsPressed] = useState(false);
  const colors = colorPalettes[variant];

  const handleMouseDown = () => {
    if (!disabled) setIsPressed(true);
  };

  const handleMouseUp = () => {
    setIsPressed(false);
  };

  const handleMouseLeave = () => {
    setIsPressed(false);
  };

  // Pixel size for the corners (2px looks best at most screen resolutions)
  const px = 2;

  return (
    <ButtonBase
      onClick={onClick}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      disabled={disabled}
      className={className}
      type={type}
      data-testid={dataTestId}
      sx={{
        width: fullWidth ? "100%" : "auto",
        height: fullWidth ? "100%" : "auto",
        minWidth: 100,
        display: "flex",
        opacity: disabled ? 0.6 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "transform 0.05s ease-out",
        transform: isPressed ? "translateY(1px)" : "none",
        ...sx,
      }}
    >
      {/* Outer container with border */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: `${px}px 1fr ${px}px`,
          gridTemplateRows: `${px}px 1fr ${px}px`,
          border: `${px}px solid ${colors.border}`,
          backgroundColor: colors.main,
          width: "100%",
          height: fullWidth ? "100%" : "auto",
        }}
      >
        {/* Top-left corner (highlight blend) */}
        <Box
          sx={{
            gridColumn: 1,
            gridRow: 1,
            backgroundColor: isPressed ? colors.shadow : colors.highlight,
            width: px,
            height: px,
          }}
        />
        {/* Top edge (highlight) */}
        <Box
          sx={{
            gridColumn: 2,
            gridRow: 1,
            backgroundColor: isPressed ? colors.shadow : colors.highlight,
            height: px,
          }}
        />
        {/* Top-right corner (dark pixel - the iconic Minecraft corner) */}
        <Box
          sx={{
            gridColumn: 3,
            gridRow: 1,
            backgroundColor: colors.border,
            width: px,
            height: px,
          }}
        />
        {/* Left edge (highlight) */}
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
        {/* Right edge (shadow) */}
        <Box
          sx={{
            gridColumn: 3,
            gridRow: 2,
            backgroundColor: isPressed ? colors.highlight : colors.shadow,
            width: px,
          }}
        />
        {/* Bottom-left corner (dark pixel - the iconic Minecraft corner) */}
        <Box
          sx={{
            gridColumn: 1,
            gridRow: 3,
            backgroundColor: colors.border,
            width: px,
            height: px,
          }}
        />
        {/* Bottom edge (shadow) */}
        <Box
          sx={{
            gridColumn: 2,
            gridRow: 3,
            backgroundColor: isPressed ? colors.highlight : colors.shadow,
            height: px,
          }}
        />
        {/* Bottom-right corner (shadow blend) */}
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
    </ButtonBase>
  );
}
