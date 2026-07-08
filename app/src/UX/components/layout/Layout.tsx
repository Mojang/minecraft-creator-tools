import React, { ReactNode } from "react";
import { AppBar, Box, CssBaseline, ThemeProvider } from "@mui/material";
import { useTheme } from "../../hooks/theme/UseTheme";
import HeroBanner from "./HeroBanner";
import Footer from "./Footer";
import ElectronTitleBar from "../../appShell/ElectronTitleBar";
import { AppMode } from "../../appShell/AppMode";
import HomeHeader from "../../home/HomeHeader";

interface LayoutProps {
  children?: ReactNode;
  //is running as an application (i.e electron)
  isApp?: boolean;
  onSaveBackups?: () => Promise<void>;
}

export default function Layout({ children, isApp, onSaveBackups }: LayoutProps) {
  const [theme, toggleMode, mode] = useTheme();

  // account for fixed position elements, app has additonal toolbar
  const contentVerticalSpacing = isApp ? 17.2 : 12;

  return (
    // ThemeProvider, and Cssbase line should maybe be moved up to App.tsx, but that currently conflicts with the northstar stuff
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {/*
        Layout switches between two modes:
        - Desktop (sm and up): an "app shell" — a 100vh container with a fixed
          header, a footer pinned at the bottom, and an internally-scrolling main
          region.
        - Narrow / zoomed (below sm, e.g. 400% browser zoom ≈ 320px wide): the
          fixed header + pinned footer would consume nearly the whole viewport and
          squeeze the main content into an unusable sliver (WCAG 1.4.10 Reflow). So
          below sm we flow everything into one document that scrolls as a whole:
          the header is static, the main region has no top offset and no inner
          scroll, and the container grows past the viewport. The companion rule in
          index.css re-enables body vertical scrolling at the same width.
      */}
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          minHeight: "100vh",
          height: { xs: "auto", sm: "100vh" },
        }}
      >
        <AppBar position="fixed" sx={{ position: { xs: "static", sm: "fixed" } }}>
          {isApp && <ElectronTitleBar mode={AppMode.home} />}
          <HomeHeader isApp={isApp} toggleThemeMode={toggleMode} mode={mode} />
        </AppBar>
        <Box
          id="main-content"
          component="main"
          sx={{
            mt: { xs: 0, sm: contentVerticalSpacing },
            backgroundColor: "background.default",
            flexGrow: 1,
            overflowX: { xs: "visible", sm: "hidden" },
            overflowY: { xs: "visible", sm: "auto" },
          }}
        >
          {!isApp && <HeroBanner />}

          {/* Main  Content */}
          <Box
            sx={{
              flex: 1,
              mb: 4,
              pb: { xs: 4, md: 6 },
              maxWidth: "85vw",
              ml: "auto",
              mr: "auto",
              backgroundColor: "FF0000",
            }}
          >
            {children}
          </Box>
        </Box>
        {onSaveBackups && <Footer isApp={isApp} onSaveBackups={onSaveBackups} />}
      </Box>
    </ThemeProvider>
  );
}
