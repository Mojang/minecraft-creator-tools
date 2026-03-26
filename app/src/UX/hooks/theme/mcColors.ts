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
  green7: "#1e4d14", // Darkest - button borders

  // ═══════════════════════════════════════════════════════════════════
  // GRAY SCALE - UI structure and backgrounds
  // ═══════════════════════════════════════════════════════════════════
  gray1: "#e5e3e1", // Light mode background (neutral)
  gray2: "#cecccb", // Light mode secondary surfaces
  gray3: "#9a9896", // Borders, dividers (light mode)
  gray4: "#686462", // Muted text, icons (light mode)
  gray5: "#484543", // Secondary surfaces (dark mode)
  gray6: "#262423", // PRIMARY dark background

  // ═══════════════════════════════════════════════════════════════════
  // NEUTRALS - Pure black/white variants
  // ═══════════════════════════════════════════════════════════════════
  black: "#000000",
  offBlack: "#1a1918",
  white: "#ffffff",
  offWhite: "#f2efec",

  // ═══════════════════════════════════════════════════════════════════
  // STONE - Secondary accent
  // ═══════════════════════════════════════════════════════════════════
  stoneLight: "#8b8b8b", // Hover states
  stone: "#6b6b6b", // Default stone color
  stoneMid: "#5a5a5a", // Corner blend
  stoneDark: "#4a4a4a", // Pressed states
  stoneBorder: "#3a3a3a", // Button borders

  // ═══════════════════════════════════════════════════════════════════
  // WOOD/BROWN - Tertiary accent (projects, chests, backups)
  // ═══════════════════════════════════════════════════════════════════
  brownLight: "#a67c52", // Hover states
  brown: "#8b5a2b", // Default wood color
  brownMid: "#6d4520", // Corner blend
  brownDark: "#5c3a1d", // Pressed states
  brownBorder: "#3d2510", // Button borders

  // ═══════════════════════════════════════════════════════════════════
  // SEMANTIC ICON COLORS - Used for category icons in project trees
  // ═══════════════════════════════════════════════════════════════════
  // Functions/Scripts (Minecraft green)
  functionsLight: "#52a535", // Light theme: dark mode selected, unselected light mode
  functionsDark: "#52a535", // Light theme: selected, dark mode unselected

  // Assets/Resources (green-tinted)
  assetsLight: "#C9EDC9", // Light theme: dark mode selected, unselected light mode
  assetsDark: "#446D44", // Light theme: selected, dark mode unselected

  // Types/Entities (Minecraft green)
  typesLight: "#52a535", // Light theme: dark mode selected, unselected light mode
  typesDark: "#52a535", // Light theme: selected, dark mode unselected
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
  darkMutedText: mcColors.gray2,
} as const;

export default mcColors;
