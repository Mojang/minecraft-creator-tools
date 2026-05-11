import { Box, Paper, Typography } from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPaw } from "@fortawesome/free-solid-svg-icons";
import { mcColors } from "../../hooks/theme/mcColors";
import { useIntl } from "react-intl";
import GoalPicker from "./GoalPicker";
import { PostCreateAction } from "../../../app/IProjectSeed";

interface GettingStartedBannerProps {
  onGoalSelected: (action: PostCreateAction) => void;
}

export default function GettingStartedBanner({ onGoalSelected }: GettingStartedBannerProps) {
  const intl = useIntl();

  return (
    <Paper
      elevation={0}
      sx={(theme) => {
        const isDark = theme.palette.mode === "dark";
        return {
          p: { xs: 2.5, md: 3.5 },
          mb: 4,
          borderRadius: 1,
          border: `3px solid ${isDark ? mcColors.green5 + "70" : mcColors.green4 + "50"}`,
          background: isDark
            ? `linear-gradient(135deg, ${mcColors.green7}40 0%, ${mcColors.gray6} 100%)`
            : `linear-gradient(135deg, ${mcColors.green3}20 0%, #ffffff 100%)`,
          position: "relative",
        };
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.5 }}>
        <Box
          sx={(theme) => ({ fontSize: 24, color: theme.palette.mode === "dark" ? mcColors.green3 : mcColors.green5 })}
        >
          <FontAwesomeIcon icon={faPaw} />
        </Box>
        <Typography variant="h5" component="h2" sx={{ fontWeight: 700 }}>
          {intl.formatMessage({ id: "home.getting_started.title" })}
        </Typography>
      </Box>

      <Typography variant="body1" sx={(theme) => ({ mb: 3, color: theme.palette.text.secondary, maxWidth: 620 })}>
        {intl.formatMessage({ id: "home.getting_started.description" })}
      </Typography>

      <GoalPicker onGoalSelected={onGoalSelected} />
    </Paper>
  );
}
