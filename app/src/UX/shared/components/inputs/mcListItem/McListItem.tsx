import React, { useState, ReactNode } from "react";
import { Box, ButtonBase, useTheme } from "@mui/material";
import { mcColors } from "../../../../hooks/theme/mcColors";

/**
 * McListItem - A Minecraft-style list item with pixelated corners
 *
 * Similar to McButton but designed for list contexts:
 * - More subtle coloring (stone variant by default)
 * - Supports complex children (thumbnails, multi-line text, icons)
 * - Green highlight on hover
 * - Pixelated corner styling matching Minecraft UI
 *
 * @example
 * <McListItem onClick={handleClick}>
 *   <img src={thumbnail} />
 *   <div>Project Name</div>
 * </McListItem>
 */

export type McListItemVariant = "stone" | "dark";

interface McListItemProps {
  children: ReactNode;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  variant?: McListItemVariant;
  selected?: boolean;
  disabled?: boolean;
  className?: string;
  sx?: object;
}

/**
 * Color palettes for list item variants
 * Designed to be more subtle than McButton for list contexts
 */
const getColorPalette = (isDark: boolean, variant: McListItemVariant, isHovered: boolean, isSelected: boolean) => {
  // Hover/selected state uses green accent
  if (isHovered || isSelected) {
    return {
      border: mcColors.green6,
      highlight: mcColors.green3,
      main: isDark ? `${mcColors.green4}25` : `${mcColors.green4}15`,
      shadow: mcColors.green5,
      corner: mcColors.green5,
    };
  }

  // Default stone palette
  if (variant === "stone") {
    return {
      // Light mode: softer bevel with reduced contrast for a gentler look
      border: isDark ? mcColors.offBlack : mcColors.gray3,
      highlight: isDark ? mcColors.gray4 : mcColors.offWhite,
      main: isDark ? mcColors.gray5 : mcColors.gray1,
      shadow: isDark ? mcColors.offBlack : mcColors.gray3,
      corner: isDark ? mcColors.gray5 : mcColors.gray2,
    };
  }

  // Dark variant (for darker backgrounds)
  return {
    border: mcColors.offBlack,
    highlight: mcColors.gray5,
    main: mcColors.gray6,
    shadow: mcColors.offBlack,
    corner: mcColors.gray5,
  };
};

export default function McListItem({
  children,
  onClick,
  variant = "stone",
  selected = false,
  disabled = false,
  className,
  sx,
}: McListItemProps) {
  const [isPressed, setIsPressed] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const colors = getColorPalette(isDark, variant, isHovered, selected);

  const handleMouseDown = () => {
    if (!disabled) setIsPressed(true);
  };

  const handleMouseUp = () => {
    setIsPressed(false);
  };

  const handleMouseEnter = () => {
    if (!disabled) setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsPressed(false);
    setIsHovered(false);
  };

  // Pixel size for the corners (2px matches McButton)
  const px = 2;

  return (
    <ButtonBase
      onClick={onClick}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      disabled={disabled}
      className={className}
      sx={{
        width: "100%",
        display: "block",
        textAlign: "left",
        opacity: disabled ? 0.6 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "all 0.1s ease-out",
        ...sx,
      }}
    >
      {/* Outer container with pixelated grid */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: `${px}px minmax(0, 1fr) ${px}px`,
          gridTemplateRows: `${px}px 1fr ${px}px`,
          border: `${px}px solid ${colors.border}`,
          backgroundColor: colors.main,
          width: "100%",
          overflow: "hidden",
          transition: "all 0.1s ease-out",
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
        {/* Center - Main content area */}
        <Box
          sx={{
            gridColumn: 2,
            gridRow: 2,
            backgroundColor: "transparent",
            p: 1,
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            overflow: "hidden",
            minWidth: 0,
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
