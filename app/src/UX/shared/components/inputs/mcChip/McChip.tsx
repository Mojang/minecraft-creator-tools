import React, { useState, ReactNode } from "react";
import { Box, ButtonBase } from "@mui/material";
import { mcColors } from "../../../../hooks/theme/mcColors";

/**
 * Minecraft-style chip/filter button color variants
 * Based on the Minecraft UI color system
 * See: docs/ux/ColorSystem.md
 */
export type McChipVariant = "green" | "stone" | "error" | "warning" | "info" | "passed" | "recommendation";

interface McChipProps {
  children: ReactNode;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  variant?: McChipVariant;
  selected?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  count?: number | string;
  className?: string;
  sx?: object;
  ariaLabel?: string;
  title?: string;
}

/**
 * Color palettes for each chip variant (unselected state)
 */
const colorPalettes = {
  green: {
    background: "rgba(82, 165, 53, 0.15)",
    backgroundSelected: mcColors.green4,
    border: "rgba(82, 165, 53, 0.4)",
    borderSelected: "#1e4d14",
    text: mcColors.green3,
    textSelected: mcColors.white,
    highlight: mcColors.green3,
    shadow: mcColors.green6,
  },
  stone: {
    background: "rgba(107, 107, 107, 0.15)",
    backgroundSelected: mcColors.stone,
    border: "rgba(107, 107, 107, 0.4)",
    borderSelected: "#3a3a3a",
    text: "#a0a0a0",
    textSelected: mcColors.white,
    highlight: mcColors.stoneLight,
    shadow: mcColors.stoneDark,
  },
  error: {
    background: "rgba(211, 47, 47, 0.15)",
    backgroundSelected: "#d32f2f",
    border: "rgba(211, 47, 47, 0.4)",
    borderSelected: "#8b1c1c",
    text: "#ef5350",
    textSelected: mcColors.white,
    highlight: "#ef5350",
    shadow: "#a12525",
  },
  warning: {
    background: "rgba(245, 166, 35, 0.15)",
    backgroundSelected: "#f5a623",
    border: "rgba(245, 166, 35, 0.4)",
    borderSelected: "#a16e0f",
    text: "#ffc107",
    textSelected: "#1a1a1a",
    highlight: "#ffc107",
    shadow: "#c7850a",
  },
  info: {
    background: "rgba(25, 118, 210, 0.15)",
    backgroundSelected: "#1976d2",
    border: "rgba(25, 118, 210, 0.4)",
    borderSelected: "#0d4a82",
    text: "#42a5f5",
    textSelected: mcColors.white,
    highlight: "#42a5f5",
    shadow: "#125ea5",
  },
  passed: {
    background: "rgba(82, 165, 53, 0.15)",
    backgroundSelected: mcColors.green4,
    border: "rgba(82, 165, 53, 0.4)",
    borderSelected: "#1e4d14",
    text: mcColors.green3,
    textSelected: mcColors.white,
    highlight: mcColors.green3,
    shadow: mcColors.green6,
  },
  recommendation: {
    background: "rgba(245, 166, 35, 0.15)",
    backgroundSelected: "#f5a623",
    border: "rgba(245, 166, 35, 0.4)",
    borderSelected: "#a16e0f",
    text: "#ffc107",
    textSelected: "#1a1a1a",
    highlight: "#ffc107",
    shadow: "#c7850a",
  },
};

/**
 * McChip - A Minecraft-style interactive chip/filter button with blocky corners
 *
 * This component provides a blocky, Minecraft-authentic chip appearance:
 * - Square corners (0-2px border-radius max) instead of pill shapes
 * - Selected/unselected states with visual feedback
 * - Optional icon and count display
 * - Color variants matching Minecraft Creator palette
 *
 * Use this for filter buttons, toggleable tags, and interactive status indicators
 * that should feel native to the Minecraft aesthetic.
 *
 * @example
 * // Basic filter chip
 * <McChip variant="error" selected={showErrors} onClick={toggleErrors}>
 *   Errors
 * </McChip>
 *
 * // With count
 * <McChip variant="warning" count={81} selected={showWarnings} onClick={toggleWarnings}>
 *   Warnings
 * </McChip>
 *
 * // With icon
 * <McChip variant="green" icon={<CheckIcon />} selected>
 *   Passed
 * </McChip>
 */
export default function McChip({
  children,
  onClick,
  variant = "green",
  selected = false,
  disabled = false,
  icon,
  count,
  className,
  sx,
  ariaLabel,
  title,
}: McChipProps) {
  const [isPressed, setIsPressed] = useState(false);
  const colors = colorPalettes[variant];
  const px = 1; // Border pixel size

  const handleMouseDown = () => {
    if (!disabled) setIsPressed(true);
  };

  const handleMouseUp = () => {
    setIsPressed(false);
  };

  const handleMouseLeave = () => {
    setIsPressed(false);
  };

  // Determine colors based on selected state
  const bgColor = selected ? colors.backgroundSelected : colors.background;
  const borderColor = selected ? colors.borderSelected : colors.border;
  const textColor = selected ? colors.textSelected : colors.text;

  return (
    <ButtonBase
      onClick={onClick}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      disabled={disabled}
      className={className}
      aria-label={ariaLabel}
      aria-pressed={selected}
      title={title}
      sx={{
        display: "inline-flex",
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "transform 0.05s ease-out",
        transform: isPressed ? "translateY(1px)" : "none",
        ...sx,
      }}
    >
      {/* Outer container - blocky appearance */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: selected ? `${px}px 1fr ${px}px` : "1fr",
          gridTemplateRows: selected ? `${px}px 1fr ${px}px` : "1fr",
          border: `${px}px solid ${borderColor}`,
          backgroundColor: bgColor,
          borderRadius: "2px", // Minimal radius - still blocky
        }}
      >
        {selected ? (
          <>
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
            {/* Top edge (highlight) */}
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
                backgroundColor: borderColor,
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
            {/* Center - Chip content */}
            <Box
              sx={{
                gridColumn: 2,
                gridRow: 2,
                backgroundColor: bgColor,
                color: textColor,
                px: "12px",
                py: "6px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                fontWeight: 600,
                fontSize: "14px",
                textTransform: "uppercase",
                letterSpacing: "0.3px",
                fontFamily: '"Noto Sans", sans-serif',
                textShadow: `1px 1px 0px ${colors.shadow}`,
                whiteSpace: "nowrap",
              }}
            >
              {icon && <Box sx={{ display: "flex", alignItems: "center" }}>{icon}</Box>}
              {children}
              {count !== undefined && (
                <Box
                  sx={{
                    backgroundColor: "rgba(0, 0, 0, 0.2)",
                    px: "8px",
                    py: "2px",
                    borderRadius: "2px",
                    fontSize: "14px",
                    fontWeight: 700,
                    fontFamily: '"Consolas", "Monaco", monospace',
                  }}
                >
                  {count}
                </Box>
              )}
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
            {/* Bottom-left corner (dark pixel) */}
            <Box
              sx={{
                gridColumn: 1,
                gridRow: 3,
                backgroundColor: borderColor,
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
            {/* Bottom-right corner (shadow) */}
            <Box
              sx={{
                gridColumn: 3,
                gridRow: 3,
                backgroundColor: isPressed ? colors.highlight : colors.shadow,
                width: px,
                height: px,
              }}
            />
          </>
        ) : (
          /* Unselected state - simpler flat appearance */
          <Box
            sx={{
              backgroundColor: bgColor,
              color: textColor,
              px: "12px",
              py: "6px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              fontWeight: 500,
              fontSize: "14px",
              textTransform: "uppercase",
              letterSpacing: "0.3px",
              fontFamily: '"Noto Sans", sans-serif',
              whiteSpace: "nowrap",
            }}
          >
            {icon && <Box sx={{ display: "flex", alignItems: "center" }}>{icon}</Box>}
            {children}
            {count !== undefined && (
              <Box
                sx={{
                  backgroundColor: "rgba(255, 255, 255, 0.1)",
                  px: "8px",
                  py: "2px",
                  borderRadius: "2px",
                  fontSize: "14px",
                  fontWeight: 700,
                  fontFamily: '"Consolas", "Monaco", monospace',
                }}
              >
                {count}
              </Box>
            )}
          </Box>
        )}
      </Box>
    </ButtonBase>
  );
}
