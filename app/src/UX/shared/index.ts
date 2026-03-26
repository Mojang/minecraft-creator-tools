/**
 * Shared MUI Components - Index
 *
 * Export all shared Material UI wrapper components for easy importing.
 *
 * @see docs/NorthstarToMuiMigration.md
 *
 * Usage:
 * ```tsx
 * import { McToolbar, McDialog, McFormInput, McSelectableList } from "../shared";
 * ```
 */

// Navigation
export { default as McToolbar } from "./components/navigation/mcToolbar/McToolbar";
export type { McToolbarItem, McToolbarMenuItem } from "./components/navigation/mcToolbar/McToolbar";

// Inputs
export { default as McSelectableList } from "./components/inputs/mcSelectableList/McSelectableList";
export type { McSelectableListItem } from "./components/inputs/mcSelectableList/McSelectableList";

export { default as McFormDropdown } from "./components/inputs/mcFormDropdown/McFormDropdown";
export type { McFormDropdownItem } from "./components/inputs/mcFormDropdown/McFormDropdown";

export { default as McFormInput } from "./components/inputs/mcFormInput/McFormInput";

export { default as McFormCheckbox } from "./components/inputs/mcFormCheckbox/McFormCheckbox";

export { default as McButton } from "./components/inputs/mcButton/McButton";

export { default as McListItem } from "./components/inputs/mcListItem/McListItem";

// Feedback
export { default as McDialog } from "./components/feedback/mcDialog/McDialog";

// Re-export theme utilities
export { isDarkMode, getThemedColor, commonStyles } from "../hooks/theme/useThemeColors";
export type { ThemeColors } from "../hooks/theme/useThemeColors";

// Re-export HOC
export { withMuiTheme } from "../hoc/withMuiTheme";
export type { WithMuiThemeProps } from "../hoc/withMuiTheme";

// Accessibility utilities
export { clickableKeyHandler } from "./accessibilityUtils";
