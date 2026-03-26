import React, { ReactNode } from "react";
import { Box } from "@mui/material";
import { getBadgeColors } from "../../../../hooks/theme/useThemeColors";

/**
 * Minecraft-style badge color variants
 * Based on the Minecraft UI color system
 * See: docs/ux/ColorSystem.md
 */
export type McBadgeVariant = "green" | "stone" | "error" | "warning" | "info" | "passed" | "recommendation";

/**
 * Minecraft-style badge size variants
 */
export type McBadgeSize = "small" | "medium" | "large";

interface McBadgeProps {
  children: ReactNode;
  variant?: McBadgeVariant;
  size?: McBadgeSize;
  className?: string;
  sx?: object;
}

/**
 * Size configurations for badges
 */
const sizeConfig = {
  small: {
    fontSize: "10px",
    paddingX: "6px",
    paddingY: "2px",
    minHeight: 16,
    borderWidth: 1,
  },
  medium: {
    fontSize: "12px",
    paddingX: "8px",
    paddingY: "3px",
    minHeight: 20,
    borderWidth: 1,
  },
  large: {
    fontSize: "14px",
    paddingX: "10px",
    paddingY: "4px",
    minHeight: 24,
    borderWidth: 2,
  },
};

/**
 * McBadge - A Minecraft-style badge with blocky corners
 *
 * This component provides a blocky, Minecraft-authentic badge appearance:
 * - Square corners (0-2px border-radius max) instead of pill shapes
 * - Subtle 3D effect with highlight/shadow edges
 * - Color variants matching Minecraft Creator palette
 *
 * Use this for status indicators, counts, and labels that should feel
 * native to the Minecraft aesthetic.
 *
 * @example
 * <McBadge variant="green">PASSED</McBadge>
 * <McBadge variant="error" size="small">3</McBadge>
 * <McBadge variant="warning">81 Warnings</McBadge>
 */
export default function McBadge({ children, variant = "green", size = "medium", className, sx }: McBadgeProps) {
  const colors = getBadgeColors(variant);
  const sizing = sizeConfig[size];
  const px = sizing.borderWidth;

  return (
    <Box
      className={className}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        ...sx,
      }}
    >
      {/* Outer container with grid for blocky edges */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: `${px}px 1fr ${px}px`,
          gridTemplateRows: `${px}px 1fr ${px}px`,
          border: `${px}px solid ${colors.border}`,
          backgroundColor: colors.background,
          borderRadius: "2px", // Minimal radius - still blocky
        }}
      >
        {/* Top-left corner */}
        <Box
          sx={{
            gridColumn: 1,
            gridRow: 1,
            backgroundColor: colors.highlight,
            width: px,
            height: px,
          }}
        />
        {/* Top edge (highlight) */}
        <Box
          sx={{
            gridColumn: 2,
            gridRow: 1,
            backgroundColor: colors.highlight,
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
        {/* Left edge (highlight) */}
        <Box
          sx={{
            gridColumn: 1,
            gridRow: 2,
            backgroundColor: colors.highlight,
            width: px,
          }}
        />
        {/* Center - Badge content */}
        <Box
          sx={{
            gridColumn: 2,
            gridRow: 2,
            backgroundColor: colors.background,
            color: colors.text,
            px: sizing.paddingX,
            py: sizing.paddingY,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            fontWeight: 600,
            fontSize: sizing.fontSize,
            textTransform: "uppercase",
            letterSpacing: "0.3px",
            fontFamily: '"Noto Sans", sans-serif',
            textShadow: `1px 1px 0px ${colors.shadow}`,
            minHeight: sizing.minHeight,
            whiteSpace: "nowrap",
          }}
        >
          {children}
        </Box>
        {/* Right edge (shadow) */}
        <Box
          sx={{
            gridColumn: 3,
            gridRow: 2,
            backgroundColor: colors.shadow,
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
        {/* Bottom edge (shadow) */}
        <Box
          sx={{
            gridColumn: 2,
            gridRow: 3,
            backgroundColor: colors.shadow,
            height: px,
          }}
        />
        {/* Bottom-right corner (shadow) */}
        <Box
          sx={{
            gridColumn: 3,
            gridRow: 3,
            backgroundColor: colors.shadow,
            width: px,
            height: px,
          }}
        />
      </Box>
    </Box>
  );
}
