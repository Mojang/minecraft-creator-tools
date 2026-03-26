/**
 * EditorTabBar.tsx
 *
 * A VS Code-style tab bar for switching between open files.
 * Displays tabs for each open project item with close buttons.
 */

import { Box, IconButton, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ProjectItem from "../../app/ProjectItem";
import StorageUtilities from "../../storage/StorageUtilities";
import ProjectItemUtilities from "../../app/ProjectItemUtilities";

export interface IEditorTabBarProps {
  openTabs: ProjectItem[];
  activeItem: ProjectItem | null;
  onTabSelected: (item: ProjectItem) => void;
  onTabClosed: (item: ProjectItem) => void;
  maxTabWidth?: number;
}

export default function EditorTabBar(props: IEditorTabBarProps) {
  const { openTabs, activeItem, onTabSelected, onTabClosed, maxTabWidth = 180 } = props;

  if (openTabs.length <= 1) {
    return null; // Don't show tab bar for 0-1 tabs
  }

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "stretch",
        backgroundColor: "background.default",
        borderBottom: "1px solid",
        borderColor: "divider",
        minHeight: 30,
        maxHeight: 30,
        overflow: "hidden",
        flexShrink: 0,
      }}
      role="tablist"
      aria-label="Open editor tabs"
    >
      {openTabs.map((item) => {
        const isActive = item === activeItem;
        const fileName = StorageUtilities.getLeafName(item.projectPath || item.name || "");
        const typeName = ProjectItemUtilities.getDescriptionForType(item.itemType);

        return (
          <Box
            key={item.projectPath || item.name}
            role="tab"
            aria-selected={isActive}
            aria-label={`${fileName} tab`}
            onClick={() => onTabSelected(item)}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              px: 1,
              py: 0,
              cursor: "pointer",
              borderRight: "1px solid",
              borderColor: "divider",
              backgroundColor: isActive ? "background.paper" : "transparent",
              borderBottom: isActive ? "2px solid" : "2px solid transparent",
              borderBottomColor: isActive ? "primary.main" : "transparent",
              maxWidth: maxTabWidth,
              minWidth: 60,
              opacity: isActive ? 1 : 0.7,
              "&:hover": {
                backgroundColor: isActive ? "background.paper" : "action.hover",
                opacity: 1,
              },
              transition: "background-color 0.15s, opacity 0.15s",
            }}
          >
            <Typography
              variant="caption"
              noWrap
              sx={{
                fontSize: "0.75rem",
                fontWeight: isActive ? 600 : 400,
                flexGrow: 1,
                userSelect: "none",
              }}
              title={`${fileName} (${typeName})`}
            >
              {fileName}
            </Typography>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onTabClosed(item);
              }}
              aria-label={`Close ${fileName}`}
              sx={{
                p: 0,
                width: 16,
                height: 16,
                opacity: isActive ? 0.7 : 0.3,
                "&:hover": { opacity: 1 },
              }}
            >
              <CloseIcon sx={{ fontSize: 12 }} />
            </IconButton>
          </Box>
        );
      })}
    </Box>
  );
}
