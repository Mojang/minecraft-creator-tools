import { Button, Link, Stack, Typography } from "@mui/material";
import { AppRouter } from "../../../routing/AppRouter";

/**
 * DocsPage
 *
 * Documentation page for links to supporting resources such as attribution notices.
 * This page is structured to accommodate additional documentation content in the future.
 */
export default function DocsPage() {
  const handleGoHome = () => {
    window.location.replace(AppRouter.getHomeNavigationPath());
  };

  return (
    <Stack
      sx={{
        minHeight: "100vh",
        maxWidth: 1400,
        width: "100%",
        mx: "auto",
        px: 6,
        py: 6,
        boxSizing: "border-box",
      }}
      spacing={5}
    >
      <Stack spacing={1}>

        <Typography variant="h2" component="h1" sx={{ fontWeight: 700, fontSize: { xs: "2.5rem", md: "4rem" } }}>
          Documentation
        </Typography>
      </Stack>

      <Stack spacing={1}>
        <Typography variant="h3" sx={{ fontWeight: 600 }}>
          Legal
        </Typography>
        <Typography variant="body1" sx={{fontWeight: 600}}>
          <Link href="/docs/notice.html" target="_blank" rel="noopener noreferrer">
            Attribution Notice
          </Link>
        </Typography>

      </Stack>
        <Button variant="contained" onClick={handleGoHome} sx={{ px: 3, py: 1, mt: 8 }}>
          Go home
        </Button>
    </Stack>
  );
}