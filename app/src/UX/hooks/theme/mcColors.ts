/**
 * Minecraft Creator Tools Color Palette
 *
 * Import this file instead of defining colors locally in components.
 *
 * @see docs/ux/ColorSystem.md
 *
 * Usage:
 * ```tsx
 * import { mcColors } from "../../hooks/theme/mcColors";
 *
 * // Access colors directly
 * const primaryGreen = mcColors.green4;
 * const darkBackground = mcColors.gray6;
 *
 * // Use in styles
 * sx={{ backgroundColor: mcColors.green4 }}
 * ```
 */
export const mcColors = {
  // ═══════════════════════════════════════════════════════════════════
  // GREEN SCALE - Primary brand accent
  // ═══════════════════════════════════════════════════════════════════
  green1: "#a2e87a", // Lightest - highlights, glows
  green2: "#86d562", // Highlight bevels, hover glow
  green3: "#6fc24a", // Secondary buttons, success states
  green4: "#52a535", // PRIMARY Minecraft Green - buttons, links, accents
  green5: "#3e8828", // Pressed states, dark accents
  green6: "#2a641c", // Deep shadows, text on light backgrounds

  // ═══════════════════════════════════════════════════════════════════
  // GRAY SCALE - UI structure and backgrounds
  // ═══════════════════════════════════════════════════════════════════
  gray1: "#ede5e2", // Light mode background
  gray2: "#d4ccc9", // Light mode secondary surfaces
  gray3: "#a39895", // Borders, dividers (light mode)
  gray4: "#6b6562", // Muted text, icons (light mode)
  gray5: "#4a4543", // Secondary surfaces (dark mode)
  gray6: "#262423", // PRIMARY dark background

  // ═══════════════════════════════════════════════════════════════════
  // NEUTRALS - Pure black/white variants
  // ═══════════════════════════════════════════════════════════════════
  black: "#000000",
  offBlack: "#1a1918",
  white: "#ffffff",
  offWhite: "#f5f0ed",

  // ═══════════════════════════════════════════════════════════════════
  // STONE - Secondary accent
  // ═══════════════════════════════════════════════════════════════════
  stoneLight: "#8b8b8b", // Hover states
  stone: "#6b6b6b", // Default stone color
  stoneDark: "#4a4a4a", // Pressed states

  // ═══════════════════════════════════════════════════════════════════
  // WOOD/BROWN - Tertiary accent (projects, chests, backups)
  // ═══════════════════════════════════════════════════════════════════
  brownLight: "#a67c52", // Hover states
  brown: "#8b5a2b", // Default wood color
  brownDark: "#5c3a1d", // Pressed states
} as const;

/**
 * Type for mcColors keys - useful for props that accept color names
 */
export type McColorKey = keyof typeof mcColors;

/**
 * Semantic color aliases for common use cases
 * These provide meaningful names for specific UI purposes
 */
export const mcSemanticColors = {
  // Primary actions
  primaryAction: mcColors.green4,
  primaryHover: mcColors.green3,
  primaryPressed: mcColors.green5,

  // Secondary actions (was blue, now stone)
  secondaryAction: mcColors.stone,
  secondaryHover: mcColors.stoneLight,
  secondaryPressed: mcColors.stoneDark,

  // Tertiary actions (wood/brown)
  tertiaryAction: mcColors.brown,
  tertiaryHover: mcColors.brownLight,
  tertiaryPressed: mcColors.brownDark,

  // Backgrounds
  darkBackground: mcColors.gray6,
  lightBackground: mcColors.gray1,
  darkSurface: mcColors.gray5,
  lightSurface: mcColors.gray2,

  // Text
  darkText: mcColors.gray6,
  lightText: mcColors.white,
  mutedText: mcColors.gray4,
} as const;

export default mcColors;
