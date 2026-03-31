import { Box, Card, CardActionArea, CardContent, Grid, Typography } from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCube, faCubes, faLayerGroup } from "@fortawesome/free-solid-svg-icons";
import { mcColors } from "../../hooks/theme/mcColors";
import { useIntl } from "react-intl";
import { PostCreateAction } from "../../../app/IProjectSeed";

interface GoalPickerProps {
  onGoalSelected: (action: PostCreateAction) => void;
}

const goals: { action: PostCreateAction; icon: typeof faCube; titleKey: string; descKey: string }[] = [
  { action: "addMob", icon: faCube, titleKey: "home.goal_picker.make_mob", descKey: "home.goal_picker.make_mob_desc" },
  {
    action: "addBlock",
    icon: faCubes,
    titleKey: "home.goal_picker.make_block",
    descKey: "home.goal_picker.make_block_desc",
  },
  {
    action: "addItem",
    icon: faLayerGroup,
    titleKey: "home.goal_picker.make_item",
    descKey: "home.goal_picker.make_item_desc",
  },
];

export default function GoalPicker({ onGoalSelected }: GoalPickerProps) {
  const intl = useIntl();

  return (
    <Box sx={{ mb: 4 }}>
      <Typography variant="h5" component="h2" sx={{ fontWeight: 700, mb: 0.5 }}>
        {intl.formatMessage({ id: "home.goal_picker.title" })}
      </Typography>
      <Typography variant="body1" sx={(theme) => ({ mb: 2.5, color: theme.palette.text.secondary })}>
        {intl.formatMessage({ id: "home.goal_picker.subtitle" })}
      </Typography>
      <Grid container spacing={2}>
        {goals.map((goal) => (
          <Grid item xs={12} sm={4} key={goal.action}>
            <Card
              variant="outlined"
              sx={(theme) => {
                const isDark = theme.palette.mode === "dark";
                return {
                  height: "100%",
                  transition: "none",
                "@media (prefers-reduced-motion: no-preference)": {
                  transition: "all 0.2s ease-in-out",
                },
                  borderRadius: 1,
                  border: `2px solid ${isDark ? mcColors.green5 + "60" : mcColors.green4 + "40"}`,
                  backgroundColor: isDark ? mcColors.gray5 : mcColors.white,
                  "&:hover": {
                    transform: "translateY(-3px)",
                    borderColor: mcColors.green4,
                    boxShadow: isDark
                      ? `0 6px 20px rgba(0,0,0,0.4), 0 0 0 1px ${mcColors.green4}80`
                      : `0 6px 20px rgba(0,0,0,0.12), 0 0 0 1px ${mcColors.green4}60`,
                  },
                };
              }}
            >
              <CardActionArea
                onClick={() => onGoalSelected(goal.action)}
                sx={{ height: "100%", p: 2.5, display: "flex", flexDirection: "column", alignItems: "center" }}
              >
                <CardContent sx={{ textAlign: "center", p: 0 }}>
                  <Box
                    sx={(theme) => ({
                      fontSize: 36,
                      mb: 1.5,
                      color: theme.palette.mode === "dark" ? mcColors.green3 : mcColors.green5,
                    })}
                  >
                    <FontAwesomeIcon icon={goal.icon} />
                  </Box>
                  <Typography variant="h6" component="h3" sx={{ fontWeight: 700, mb: 0.5 }}>
                    {intl.formatMessage({ id: goal.titleKey })}
                  </Typography>
                  <Typography variant="body2" sx={(theme) => ({ color: theme.palette.text.secondary })}>
                    {intl.formatMessage({ id: goal.descKey })}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
