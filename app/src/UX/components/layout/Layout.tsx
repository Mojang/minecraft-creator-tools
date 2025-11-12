import { ReactNode } from "react";
import { AppBar, Box, CssBaseline, ThemeProvider } from "@mui/material";
import { useTheme } from "../../hooks/theme/UseTheme";
import HeroBanner from "./HeroBanner";
import Footer from "./Footer";
import HomeHeader from "../../HomeHeader";

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
          <HomeHeader isApp={isApp} toggleThemeMode={toggleMode} mode={mode} />
        </AppBar>
        <Box
          overflow="scroll"
          component="main"
          sx={{
            mt: contentVerticalSpacing,
            backgroundColor: "background.default",
            flexGrow: 1,
            overflowX: "hidden",
            //there's something weird happening with the northstar styling, set the scroll bar explicitly so its always visible
            scrollbarColor: (theme) =>
              theme.palette.mode === "light" ? `#48494A ${theme.palette.common.white}` : null,
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
