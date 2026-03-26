/**
 * CommandOutputPanel — Displays scrollable command output lines with a close button.
 */

import { Box, Paper, Typography } from "@mui/material";
import { mcColors } from "../../hooks/theme/mcColors";

export interface CommandOutputPanelProps {
  lines: string[];
  onClose: () => void;
}

export default function CommandOutputPanel({ lines, onClose }: CommandOutputPanelProps) {
  if (lines.length === 0) {
    return null;
  }

  return (
    <Paper
      variant="outlined"
      sx={(theme) => ({
        mb: 2,
        p: 2,
        maxHeight: 300,
        overflow: "auto",
        backgroundColor: theme.palette.mode === "dark" ? mcColors.gray6 : "#f5f5f5",
        borderColor: theme.palette.mode === "dark" ? mcColors.gray3 : mcColors.gray2,
      })}
    >
      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 0.5 }}>
        <Typography
          component="span"
          onClick={onClose}
          role="button"
          tabIndex={0}
          sx={{
            cursor: "pointer",
            opacity: 0.5,
            fontSize: "0.8rem",
            "&:hover": { opacity: 1 },
          }}
        >
          ✕ Close
        </Typography>
      </Box>
      <Box
        component="pre"
        sx={{
          m: 0,
          fontFamily: "monospace",
          fontSize: "0.85rem",
          whiteSpace: "pre-wrap",
          lineHeight: 1.6,
        }}
      >
        {lines.join("\n")}
      </Box>
    </Paper>
  );
}
