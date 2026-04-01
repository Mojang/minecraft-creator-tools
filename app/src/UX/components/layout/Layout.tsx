import React, { ReactNode } from "react";
import { AppBar, Box, CssBaseline, ThemeProvider } from "@mui/material";
import { useTheme } from "../../hooks/theme/UseTheme";
import HeroBanner from "./HeroBanner";
import Footer from "./Footer";
import ElectronTitleBar from "../../appShell/ElectronTitleBar";
import { AppMode } from "../../appShell/App";
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
      <Box sx={{ display: "flex", flexDirection: "column", height: "100vh" }}>
        <AppBar position="fixed">
          {isApp && <ElectronTitleBar mode={AppMode.home} />}
          <HomeHeader isApp={isApp} toggleThemeMode={toggleMode} mode={mode} />
        </AppBar>
        <Box
          component="main"
          sx={{
            mt: contentVerticalSpacing,
            backgroundColor: "background.default",
            flexGrow: 1,
            overflow: "auto",
            overflowX: "hidden",
          }}
        >
          {!isApp && <HeroBanner />}

          {/* Main  Content */}
          <Box
            sx={{
              flex: 1,
              mb: 4,
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
