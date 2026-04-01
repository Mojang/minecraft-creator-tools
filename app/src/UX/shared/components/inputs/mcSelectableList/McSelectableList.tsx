/**
 * McSelectableList - Material UI List wrapper with keyboard navigation
 *
 * This component provides similar functionality to Northstar's List with
 * selectableListBehavior, using Material UI under the hood.
 *
 * @see docs/NorthstarToMuiMigration.md
 *
 * Migration from Northstar:
 * ```tsx
 * // Before (Northstar)
 * import { List, selectableListBehavior } from "@fluentui/react-northstar";
 * <List
 *   selectable
 *   selectedIndex={idx}
 *   accessibility={selectableListBehavior}
 *   items={items}
 *   onSelectedIndexChange={handleSelect}
 * />
 *
 * // After (McSelectableList)
 * import McSelectableList, { McSelectableListItem } from "./McSelectableList";
 * <McSelectableList
 *   items={items}
 *   selectedIndex={idx}
 *   onSelectedIndexChange={handleSelect}
 * />
 * ```
 */

import React, { useCallback, useRef, KeyboardEvent, ReactNode } from "react";
import { List, ListItem, ListItemButton, ListItemText, ListItemIcon, Box, useTheme } from "@mui/material";
import { mcColors } from "../../../../hooks/theme/mcColors";

/**
 * List item definition - similar to Northstar's ListItemProps
 */
export interface McSelectableListItem {
  /** Unique key for the item */
  key: string;
  /** Primary text/header */
  header?: ReactNode;
  /** Secondary text/content */
  content?: ReactNode;
  /** Icon to display before the text */
  icon?: ReactNode;
  /** End icon/action */
  endMedia?: ReactNode;
  /** Whether the item is disabled */
  disabled?: boolean;
  /** Custom styles for this item */
  sx?: object;
  /** Tooltip text shown on hover */
  title?: string;
  /** Additional data attached to the item */
  data?: unknown;
}

interface McSelectableListProps {
  /** Array of list items */
  items: McSelectableListItem[];
  /** Currently selected index (-1 for no selection) */
  selectedIndex?: number;
  /** Callback when selection changes */
  onSelectedIndexChange?: (index: number, item: McSelectableListItem) => void;
  /** Callback when an item is double-clicked or Enter is pressed */
  onItemActivate?: (index: number, item: McSelectableListItem) => void;
  /** Aria label for the list */
  "aria-label"?: string;
  /** Additional CSS class */
  className?: string;
  /** Custom styles */
  sx?: object;
  /** Whether the list should be dense */
  dense?: boolean;
  /** Whether to show borders between items */
  showDividers?: boolean;
}

/**
 * McSelectableList - A Material UI-based selectable list with keyboard navigation
 *
 * Replaces Northstar's List + selectableListBehavior with a similar API.
 * Supports:
 * - Arrow key navigation (Up/Down)
 * - Home/End keys for first/last item
 * - Enter key to activate selected item
 * - Click selection
 * - Double-click activation
 */
export default function McSelectableList({
  items,
  selectedIndex = -1,
  onSelectedIndexChange,
  onItemActivate,
  "aria-label": ariaLabel,
  className,
  sx,
  dense = false,
  showDividers = false,
}: McSelectableListProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const listRef = useRef<HTMLUListElement>(null);

  const handleItemClick = useCallback(
    (index: number) => {
      if (items[index] && !items[index].disabled) {
        onSelectedIndexChange?.(index, items[index]);
      }
    },
    [items, onSelectedIndexChange]
  );

  const handleItemDoubleClick = useCallback(
    (index: number) => {
      if (items[index] && !items[index].disabled) {
        onItemActivate?.(index, items[index]);
      }
    },
    [items, onItemActivate]
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLUListElement>) => {
      if (items.length === 0) return;

      let newIndex = selectedIndex;

      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          // Find next non-disabled item
          for (let i = selectedIndex + 1; i < items.length; i++) {
            if (!items[i].disabled) {
              newIndex = i;
              break;
            }
          }
          break;

        case "ArrowUp":
          event.preventDefault();
          // Find previous non-disabled item
          for (let i = selectedIndex - 1; i >= 0; i--) {
            if (!items[i].disabled) {
              newIndex = i;
              break;
            }
          }
          break;

        case "Home":
          event.preventDefault();
          // Find first non-disabled item
          for (let i = 0; i < items.length; i++) {
            if (!items[i].disabled) {
              newIndex = i;
              break;
            }
          }
          break;

        case "End":
          event.preventDefault();
          // Find last non-disabled item
          for (let i = items.length - 1; i >= 0; i--) {
            if (!items[i].disabled) {
              newIndex = i;
              break;
            }
          }
          break;

        case "Enter":
        case " ":
          event.preventDefault();
          if (selectedIndex >= 0 && selectedIndex < items.length && !items[selectedIndex].disabled) {
            onItemActivate?.(selectedIndex, items[selectedIndex]);
          }
          return;

        default:
          return;
      }

      if (newIndex !== selectedIndex && newIndex >= 0 && newIndex < items.length) {
        onSelectedIndexChange?.(newIndex, items[newIndex]);
      }
    },
    [items, selectedIndex, onSelectedIndexChange, onItemActivate]
  );

  return (
    <List
      ref={listRef}
      aria-label={ariaLabel}
      className={className}
      dense={dense}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      sx={{
        outline: "none",
        "&:focus-visible": {
          outline: `2px solid ${mcColors.green4}`,
          outlineOffset: -2,
        },
        ...sx,
      }}
    >
      {items.map((item, index) => (
        <ListItem key={item.key} disablePadding divider={showDividers && index < items.length - 1} sx={item.sx}>
          <ListItemButton
            selected={selectedIndex === index}
            disabled={item.disabled}
            onClick={() => handleItemClick(index)}
            onDoubleClick={() => handleItemDoubleClick(index)}
            title={item.title}
            sx={{
              "&.Mui-selected": {
                backgroundColor: isDark ? "rgba(82, 165, 53, 0.25)" : "rgba(82, 165, 53, 0.2)",
                "&:hover": {
                  backgroundColor: isDark ? "rgba(82, 165, 53, 0.35)" : "rgba(82, 165, 53, 0.3)",
                },
              },
              "&:hover": {
                backgroundColor: isDark ? mcColors.gray4 : mcColors.gray2,
              },
            }}
          >
            {item.icon && <ListItemIcon sx={{ minWidth: 36 }}>{item.icon}</ListItemIcon>}
            <ListItemText
              primary={item.header}
              secondary={item.content}
              primaryTypographyProps={{
                sx: { color: isDark ? mcColors.white : mcColors.gray6 },
              }}
              secondaryTypographyProps={{
                sx: { color: isDark ? mcColors.gray2 : mcColors.gray5 },
              }}
            />
            {item.endMedia && (
              <Box component="span" sx={{ ml: 1, display: "flex", alignItems: "center" }}>
                {item.endMedia}
              </Box>
            )}
          </ListItemButton>
        </ListItem>
      ))}
    </List>
  );
}

