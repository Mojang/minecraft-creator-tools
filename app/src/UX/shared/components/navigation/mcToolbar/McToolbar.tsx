/**
 * McToolbar - Material UI Toolbar wrapper for Northstar migration.
 *
 * This component provides a similar API to Northstar's Toolbar component
 * while using Material UI under the hood.
 *
 * @see docs/NorthstarToMuiMigration.md
 *
 * Migration from Northstar:
 * ```tsx
 * // Before (Northstar)
 * import { Toolbar, ToolbarItemProps } from "@fluentui/react-northstar";
 * <Toolbar items={toolbarItems} />
 *
 * // After (McToolbar)
 * import McToolbar, { McToolbarItem } from "./McToolbar";
 * <McToolbar items={toolbarItems} />
 * ```
 */

import React, { useState, useRef, useEffect, useCallback, ReactNode } from "react";
import { Box, IconButton, Button, Menu, MenuItem, Divider, Tooltip, useTheme } from "@mui/material";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSortDown } from "@fortawesome/free-solid-svg-icons";
import { mcColors } from "../../../../hooks/theme/mcColors";

/**
 * Menu item definition for toolbar dropdown menus
 */
export interface McToolbarMenuItem {
  key: string;
  content: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  icon?: ReactNode;
  divider?: boolean;
}

/**
 * Toolbar item definition - similar to Northstar's ToolbarItemProps
 */
export interface McToolbarItem {
  /** Unique key for the item */
  key: string;
  /** Icon to display */
  icon?: ReactNode;
  /** Text content (for button-style items) */
  content?: ReactNode;
  /** Tooltip/title */
  title?: string;
  /** Click handler */
  onClick?: () => void;
  /** Whether the item is disabled */
  disabled?: boolean;
  /** Whether the item is currently active/selected */
  active?: boolean;
  /** Dropdown menu items */
  menu?: McToolbarMenuItem[];
  /**
   * When true, renders a split button: the main area fires onClick,
   * and a small dropdown arrow opens the menu. Both parts count as
   * a single toolbar item for overflow purposes.
   */
  splitMenu?: boolean;
  /** Whether this is a divider */
  kind?: "divider" | "toggle";
  /** For custom rendering */
  children?: ReactNode;
  /** Aria label for accessibility */
  "aria-label"?: string;
}

interface McToolbarProps {
  /** Array of toolbar items */
  items: McToolbarItem[];
  /** Aria label for the toolbar */
  "aria-label"?: string;
  /** Additional CSS class */
  className?: string;
  /** Custom styles */
  sx?: object;
  /** Variant: 'primary' for main toolbar, 'secondary' for sub-toolbars */
  variant?: "primary" | "secondary";
  /** Whether to show overflow "..." menu (default: true for primary toolbars) */
  overflow?: boolean;
  /** Items to always place in the overflow menu */
  overflowItems?: McToolbarItem[];
}

/**
 * Internal component for rendering a single toolbar item with optional menu
 */
function McToolbarItemRenderer({ item, variant }: { item: McToolbarItem; variant: "primary" | "secondary" }) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    if (item.menu && item.menu.length > 0) {
      setAnchorEl(event.currentTarget);
    }
    item.onClick?.();
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleMenuItemClick = (menuItem: McToolbarMenuItem) => {
    menuItem.onClick?.();
    handleMenuClose();
  };

  // Divider item
  if (item.kind === "divider") {
    return (
      <Divider
        orientation="vertical"
        flexItem
        sx={{ mx: 0.5, borderColor: isDark ? mcColors.gray4 : mcColors.gray3 }}
      />
    );
  }

  // Custom children
  if (item.children) {
    return <>{item.children}</>;
  }

  const buttonSx = {
    color: isDark ? mcColors.offWhite : mcColors.gray6,
    opacity: item.active === false ? 0.4 : 1,
    backgroundColor: "transparent",
    borderRadius: 1,
    "&:hover": {
      backgroundColor: isDark ? mcColors.gray4 : mcColors.gray2,
      color: isDark ? mcColors.white : mcColors.gray6,
    },
    minWidth: item.content ? "auto" : 28,
    px: 0.75,
    py: 0.5,
    fontFamily: '"Noto Sans", sans-serif',
    fontSize: "13px",
    fontWeight: 400,
    textTransform: "none" as const,
    whiteSpace: "nowrap" as const,
    // Normalize nested label wrappers: remove their own padding so that the
    // button's px/py above is the sole source of spacing. Restore a small gap
    // for icon+text combos and keep label-text left-padding for readability.
    "& .label, & .label-toolbar, & .label-toolbar3, & .label-slim, & .label-toolbar-slim, & .label-arrowouter": {
      padding: 0,
      margin: 0,
      minWidth: "unset",
      display: "inline-flex",
      alignItems: "center",
      gap: "4px",
    },
    "& .label-text": {
      padding: 0,
      paddingLeft: "4px",
      margin: 0,
      minWidth: "unset",
    },
    "& .label-arrow": {
      top: "-3px",
      position: "relative",
    },
  };

  const isMenuOpen = Boolean(anchorEl);

  // Split-button: main button fires onClick, small arrow opens menu
  if (item.splitMenu && item.menu && item.onClick) {
    const menuContent = (
      <Menu
        anchorEl={anchorEl}
        open={isMenuOpen}
        onClose={handleMenuClose}
        slotProps={{
          paper: {
            sx: {
              "& .MuiMenuItem-root": { fontSize: "13px", padding: "4px 14px", minHeight: "28px" },
              "& .MuiList-root": { py: 0.5 },
            },
          },
        }}
      >
        {item.menu.map((menuItem) =>
          menuItem.divider ? (
            <Divider key={menuItem.key} />
          ) : (
            <MenuItem key={menuItem.key} onClick={() => handleMenuItemClick(menuItem)} disabled={menuItem.disabled}>
              {menuItem.icon && (
                <Box component="span" sx={{ mr: 1, display: "flex", alignItems: "center" }}>
                  {menuItem.icon}
                </Box>
              )}
              {menuItem.content}
            </MenuItem>
          )
        )}
      </Menu>
    );

    return (
      <>
        <Box sx={{ display: "inline-flex", alignItems: "center", flexShrink: 0 }}>
          <Tooltip title={item.title || ""} placement="bottom">
            <span>
              <IconButton
                onClick={() => item.onClick?.()}
                disabled={item.disabled}
                title={item.title}
                aria-label={item["aria-label"] || item.title}
                sx={{
                  ...buttonSx,
                  borderTopRightRadius: 0,
                  borderBottomRightRadius: 0,
                  pr: 0.5,
                }}
                size="small"
              >
                {item.icon}
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="More options" placement="bottom">
            <span>
              <IconButton
                onClick={(e) => setAnchorEl(e.currentTarget)}
                disabled={item.disabled}
                aria-haspopup="true"
                aria-expanded={isMenuOpen ? "true" : undefined}
                aria-label="More deploy options"
                sx={{
                  ...buttonSx,
                  borderTopLeftRadius: 0,
                  borderBottomLeftRadius: 0,
                  minWidth: 20,
                  px: 0.25,
                }}
                size="small"
              >
                <FontAwesomeIcon icon={faSortDown} className="fa-lg" style={{ position: "relative", top: "-3px" }} />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
        {menuContent}
      </>
    );
  }

  // Icon-only button
  if (item.icon && !item.content) {
    return (
      <>
        <Tooltip title={item.title || ""} placement="bottom">
          <span>
            <IconButton
              onClick={handleMenuOpen}
              disabled={item.disabled}
              title={item.title}
              aria-label={item["aria-label"] || item.title}
              aria-haspopup={item.menu ? "true" : undefined}
              aria-expanded={isMenuOpen ? "true" : undefined}
              sx={buttonSx}
              size="small"
            >
              {item.icon}
            </IconButton>
          </span>
        </Tooltip>
        {item.menu && (
          <Menu
            anchorEl={anchorEl}
            open={isMenuOpen}
            onClose={handleMenuClose}
            slotProps={{
              paper: {
                sx: {
                  "& .MuiMenuItem-root": { fontSize: "13px", padding: "4px 14px", minHeight: "28px" },
                  "& .MuiList-root": { py: 0.5 },
                },
              },
            }}
          >
            {item.menu.map((menuItem) =>
              menuItem.divider ? (
                <Divider key={menuItem.key} />
              ) : (
                <MenuItem key={menuItem.key} onClick={() => handleMenuItemClick(menuItem)} disabled={menuItem.disabled}>
                  {menuItem.icon && (
                    <Box component="span" sx={{ mr: 1, display: "flex", alignItems: "center" }}>
                      {menuItem.icon}
                    </Box>
                  )}
                  {menuItem.content}
                </MenuItem>
              )
            )}
          </Menu>
        )}
      </>
    );
  }

  // Button with text (and optional icon)
  return (
    <>
      <Tooltip title={item.title || ""} placement="bottom">
        <span>
          <Button
            onClick={handleMenuOpen}
            disabled={item.disabled}
            title={item.title}
            startIcon={item.icon}
            aria-label={item["aria-label"] || item.title || undefined}
            aria-haspopup={item.menu ? "true" : undefined}
            aria-expanded={isMenuOpen ? "true" : undefined}
            sx={buttonSx}
            size="small"
          >
            {item.content}
          </Button>
        </span>
      </Tooltip>
      {item.menu && (
        <Menu
          anchorEl={anchorEl}
          open={isMenuOpen}
          onClose={handleMenuClose}
          slotProps={{
            paper: {
              sx: {
                "& .MuiMenuItem-root": { fontSize: "13px", padding: "4px 14px", minHeight: "28px" },
                "& .MuiList-root": { py: 0.5 },
              },
            },
          }}
        >
          {item.menu.map((menuItem) =>
            menuItem.divider ? (
              <Divider key={menuItem.key} />
            ) : (
              <MenuItem key={menuItem.key} onClick={() => handleMenuItemClick(menuItem)} disabled={menuItem.disabled}>
                {menuItem.icon && (
                  <Box component="span" sx={{ mr: 1, display: "flex", alignItems: "center" }}>
                    {menuItem.icon}
                  </Box>
                )}
                {menuItem.content}
              </MenuItem>
            )
          )}
        </Menu>
      )}
    </>
  );
}

/**
 * McToolbar - A Material UI-based toolbar component
 *
 * Replaces Northstar's Toolbar component with a similar API.
 * Supports automatic overflow: items that don't fit are moved to a "..." menu.
 *
 * Overflow algorithm:
 * 1. On mount (or when items change), all items are rendered so their widths can be measured.
 * 2. After measurement, we check if all items fit within the container width.
 * 3. If they all fit, no overflow button is shown.
 * 4. If they don't fit, items are hidden from the end and a "..." button appears.
 * 5. On resize, the calculation re-runs using cached widths for hidden items.
 */
export default function McToolbar({
  items,
  "aria-label": ariaLabel,
  className,
  sx,
  variant = "primary",
  overflow,
  overflowItems: explicitOverflowItems,
}: McToolbarProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(items.length);
  const [overflowAnchorEl, setOverflowAnchorEl] = useState<null | HTMLElement>(null);
  // Track whether we've completed the initial overflow measurement.
  // Items are rendered with visibility:hidden until first measurement to prevent clipping flash.
  const [measured, setMeasured] = useState(false);

  // Cache of measured item widths (indexed by position).
  const itemWidthsRef = useRef<number[]>([]);

  const showOverflow = overflow ?? variant === "primary";

  // Track items identity so we can reset when items change.
  const itemsSignature = items.map((it) => it.key).join("|");
  const prevItemsSignatureRef = useRef(itemsSignature);
  const itemsChanged = itemsSignature !== prevItemsSignatureRef.current;
  if (itemsChanged) {
    prevItemsSignatureRef.current = itemsSignature;
    itemWidthsRef.current = [];
  }

  // When items change, immediately show all items so we can measure them.
  useEffect(() => {
    if (showOverflow) {
      itemWidthsRef.current = [];
      setMeasured(false);
      setVisibleCount(items.length);
    }
  }, [itemsSignature, showOverflow, items.length]);

  const calculateOverflow = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const containerWidth = container.clientWidth;
    if (containerWidth === 0) return; // not laid out yet

    const children = Array.from(container.children) as HTMLElement[];
    const overflowButtonWidth = 40;
    const hasExplicitOverflow = explicitOverflowItems && explicitOverflowItems.length > 0;

    // Collect rendered item widths (skip the overflow button)
    const renderedWidths: number[] = [];
    for (const child of children) {
      if (child.getAttribute("data-overflow-button") === "true") continue;
      renderedWidths.push(child.offsetWidth + 2); // +2 for gap
    }

    // If all items are currently rendered, update the width cache
    if (renderedWidths.length >= items.length) {
      itemWidthsRef.current = renderedWidths.slice(0, items.length);
    } else if (itemWidthsRef.current.length < items.length) {
      // Not all items are rendered and we don't have cached widths.
      // Show all items so we can measure them on the next frame.
      setVisibleCount(items.length);
      return;
    }

    // Use cached widths to calculate how many items fit
    const widths = itemWidthsRef.current;

    // First, check if ALL items fit without needing the overflow button
    let totalAllWidth = 0;
    for (let i = 0; i < widths.length; i++) {
      totalAllWidth += widths[i];
    }
    const reserveForExplicit = hasExplicitOverflow ? overflowButtonWidth : 0;
    if (totalAllWidth + reserveForExplicit <= containerWidth) {
      setVisibleCount(items.length);
      setMeasured(true);
      return;
    }

    // Not all items fit — find how many fit while reserving space for the "..." button
    let totalWidth = 0;
    let fitCount = 0;
    for (let i = 0; i < widths.length; i++) {
      totalWidth += widths[i];
      if (totalWidth + overflowButtonWidth > containerWidth) {
        break;
      }
      fitCount++;
    }

    // Ensure at least 1 item is always visible
    fitCount = Math.max(fitCount, 1);

    setVisibleCount(fitCount);
    setMeasured(true);
  }, [items.length, itemsSignature, explicitOverflowItems]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !showOverflow) return;

    const observer = new ResizeObserver(() => {
      calculateOverflow();
    });
    observer.observe(container);

    // Initial calculation after layout
    requestAnimationFrame(() => calculateOverflow());

    return () => observer.disconnect();
  }, [calculateOverflow, showOverflow]);

  // After re-render showing all items (for measurement), run the overflow calculation
  useEffect(() => {
    if (showOverflow && visibleCount === items.length) {
      requestAnimationFrame(() => calculateOverflow());
    }
  }, [visibleCount, showOverflow, calculateOverflow, items.length]);

  const visibleItems = showOverflow ? items.slice(0, visibleCount) : items;
  const autoOverflowItems = showOverflow ? items.slice(visibleCount) : [];
  const allOverflowItems = [...autoOverflowItems, ...(explicitOverflowItems || [])];
  const hasOverflowItems = allOverflowItems.length > 0;

  return (
    <Box
      ref={containerRef}
      component="div"
      role="toolbar"
      aria-label={ariaLabel}
      className={className}
      sx={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        flexWrap: "nowrap",
        gap: 0.125,
        width: "100%",
        padding: variant === "primary" ? "2px 4px" : "1px 4px",
        backgroundColor: variant === "primary" ? (isDark ? mcColors.gray5 : mcColors.gray1) : "transparent",
        borderBottom: variant === "primary" ? `1px solid ${isDark ? mcColors.gray4 : mcColors.gray3}` : "none",
        minHeight: variant === "primary" ? 36 : 28,
        fontFamily: '"Noto Sans", sans-serif',
        overflow: "hidden",
        // Hide items during initial measurement to prevent clipping flash on narrow viewports
        visibility: showOverflow && !measured ? "hidden" : "visible",
        ...sx,
      }}
    >
      {visibleItems.map((item) => (
        <McToolbarItemRenderer key={item.key} item={item} variant={variant} />
      ))}
      {showOverflow && hasOverflowItems && (
        <>
          <IconButton
            data-overflow-button="true"
            onClick={(e) => setOverflowAnchorEl(e.currentTarget)}
            size="small"
            sx={{
              color: isDark ? mcColors.offWhite : mcColors.gray6,
              minWidth: 28,
              px: 0.25,
              flexShrink: 0,
            }}
            aria-label="More options"
            title="More options"
          >
            <MoreHorizIcon fontSize="small" />
          </IconButton>
          <Menu anchorEl={overflowAnchorEl} open={Boolean(overflowAnchorEl)} onClose={() => setOverflowAnchorEl(null)}>
            {allOverflowItems
              .filter((item) => item.kind !== "divider")
              .flatMap((item) => {
                // Items with sub-menus: flatten the parent as a label + its children as menu items
                if (item.menu && item.menu.length > 0) {
                  const elements: React.ReactElement[] = [];
                  elements.push(<Divider key={`${item.key}-divider-before`} />);
                  elements.push(
                    <MenuItem
                      key={`${item.key}-header`}
                      disabled
                      sx={{ opacity: "0.7 !important", fontWeight: 600, fontSize: "12px", minHeight: "28px" }}
                    >
                      {item.icon && (
                        <Box component="span" sx={{ mr: 1, display: "flex", alignItems: "center" }}>
                          {item.icon}
                        </Box>
                      )}
                      {item.content || item.title || item.key}
                    </MenuItem>
                  );
                  item.menu
                    .filter((mi) => !mi.divider)
                    .forEach((menuItem) => {
                      elements.push(
                        <MenuItem
                          key={menuItem.key}
                          onClick={() => {
                            menuItem.onClick?.();
                            setOverflowAnchorEl(null);
                          }}
                          disabled={menuItem.disabled}
                          sx={{ pl: 4 }}
                        >
                          {menuItem.icon && (
                            <Box component="span" sx={{ mr: 1, display: "flex", alignItems: "center" }}>
                              {menuItem.icon}
                            </Box>
                          )}
                          {menuItem.content}
                        </MenuItem>
                      );
                    });
                  return elements;
                }

                // Simple items: render directly
                return [
                  <MenuItem
                    key={item.key}
                    onClick={() => {
                      item.onClick?.();
                      setOverflowAnchorEl(null);
                    }}
                    disabled={item.disabled}
                  >
                    {item.icon && (
                      <Box component="span" sx={{ mr: 1, display: "flex", alignItems: "center" }}>
                        {item.icon}
                      </Box>
                    )}
                    {item.content || item.title || item.key}
                  </MenuItem>,
                ];
              })}
          </Menu>
        </>
      )}
    </Box>
  );
}
