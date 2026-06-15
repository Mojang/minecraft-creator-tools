import { Stack, Typography, Button } from "@mui/material";
import { AppRouter } from "../../../routing/AppRouter";

/**
 * NotFound404Page
 *
 * Renders when the user navigates to an invalid pathname (e.g., /foo/bar).
 * Provides a "Go home" button to return to the home page and clears the
 * offending pathname from browser history.
 */

export default function NotFound404Page() {
  const handleReturnHome = () => {
    try {
      if (typeof window !== "undefined") {
        // replace() avoids trapping users in a bad URL when pressing Back.
        window.location.replace(AppRouter.getHomeNavigationPath());
      }
    } catch {
      // noop - history APIs may be unavailable in some embedded hosts
    }
  };

  return (
    <Stack
      role="alert"
      aria-live="polite"
      data-testid="app-not-found"
      spacing={1.5}
      sx={{
        minHeight: "100vh",
        alignItems: "center",
        justifyContent: "center",
        px: 3,
        py: 6,
        textAlign: "center",
      }}
    >
      <Typography variant="h1" sx={{ fontSize: 48, fontWeight: 700 }}>
        404
      </Typography>
      <Typography variant="h2" sx={{ fontSize: 18, fontWeight: 600 }}>
        That page doesn't exist
      </Typography>
      <Typography
        variant="body1"
        sx={{
          maxWidth: 480,
          opacity: 0.8,
        }}
      >
        The URL you entered isn't something this app knows how to show. Head back to the home page and try again.
      </Typography>
      <Button variant="outlined" onClick={handleReturnHome} sx={{ mt: 1 }}>
        Go home
      </Button>
    </Stack>
  );
}
