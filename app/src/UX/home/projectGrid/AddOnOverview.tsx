import { Box, Collapse, Typography } from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBookOpen, faChevronDown, faChevronUp } from "@fortawesome/free-solid-svg-icons";
import { mcColors } from "../../hooks/theme/mcColors";
import { useIntl } from "react-intl";
import { useState } from "react";

export default function AddOnOverview() {
  const intl = useIntl();
  const [expanded, setExpanded] = useState(false);

  return (
    <Box sx={{ mb: 3 }}>
      <Box
        onClick={() => setExpanded(!expanded)}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setExpanded(!expanded);
          }
        }}
        sx={(theme) => ({
          display: "flex",
          alignItems: "center",
          gap: 1,
          cursor: "pointer",
          py: 1,
          px: 0.5,
          borderRadius: 1,
          "&:hover": {
            backgroundColor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
          },
        })}
      >
        <Box
          sx={(theme) => ({ fontSize: 16, color: theme.palette.mode === "dark" ? mcColors.green3 : mcColors.green5 })}
        >
          <FontAwesomeIcon icon={faBookOpen} />
        </Box>
        <Typography variant="body1" sx={{ fontWeight: 600, flex: 1 }}>
          {intl.formatMessage({ id: "home.addon_overview.title" })}
        </Typography>
        <Box sx={(theme) => ({ fontSize: 12, color: theme.palette.text.secondary })}>
          <FontAwesomeIcon icon={expanded ? faChevronUp : faChevronDown} />
        </Box>
      </Box>
      <Collapse in={expanded}>
        <Typography
          variant="body2"
          sx={(theme) => ({
            pl: 3.5,
            pr: 2,
            pb: 2,
            color: theme.palette.text.secondary,
            lineHeight: 1.7,
            maxWidth: 640,
          })}
        >
          {intl.formatMessage({ id: "home.addon_overview.description" })}
        </Typography>
      </Collapse>
    </Box>
  );
}
