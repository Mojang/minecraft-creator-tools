import { Button, Stack, Typography } from "@mui/material";
import { AppRouter } from "../../../routing/AppRouter";

/**
 * AboutPage
 *
 * Simple top-level page for product and project information.
 */
export default function AboutPage() {
  const handleGoHome = () => {
    window.location.replace(AppRouter.getHomeNavigationPath());
  };

  return (
    <Stack
      spacing={3}
      sx={{
        minHeight: "100vh",
        alignItems: "center",
        justifyContent: "center",
        px: 3,
        py: 6,
        textAlign: "center",
      }}
    >
      <Stack spacing={1.5} sx={{ maxWidth: 760 }}>
        <Typography variant="overline" sx={{ letterSpacing: 2, opacity: 0.7 }}>
          About
        </Typography>
        <Typography variant="h3" component="h1" sx={{ fontWeight: 700 }}>
          Minecraft Creator Tools
        </Typography>
        <Typography variant="body1" sx={{ opacity: 0.85, lineHeight: 1.8 }}>
          A workspace for building, inspecting, validating, and managing Minecraft Bedrock content. This page is a
          placeholder for product and project information that can grow over time.
        </Typography>
      </Stack>

      <Button variant="contained" onClick={handleGoHome} sx={{ px: 3, py: 1 }}>
        Go home
      </Button>
    </Stack>
  );
}
