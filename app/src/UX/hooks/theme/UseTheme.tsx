import { createTheme, Theme } from "@mui/material";
import { useCallback, useEffect, useMemo, useState } from "react";
import CreatorToolsHost, { CreatorToolsThemeStyle } from "../../../app/CreatorToolsHost";
import { mcColors } from "./mcColors";

type ThemeMode = "light" | "dark";

export function useTheme() {
  const getInitialMode = () => {
    return CreatorToolsHost.theme === CreatorToolsThemeStyle.dark ? "dark" : "light";
  };

  const [mode, setMode] = useState<ThemeMode>(getInitialMode());

  useEffect(() => {
    CreatorToolsHost.theme = mode === "dark" ? CreatorToolsThemeStyle.dark : CreatorToolsThemeStyle.light;
    localStorage.setItem("color-mode", mode);
  }, [mode]);

  const theme: Theme = useMemo(() => {
    const isDark = mode !== "light";
    return createTheme({
      palette: {
        mode: mode,
        background: isDark
          ? {
              default: mcColors.gray6, // #262423 - Gray 6
              paper: mcColors.gray5, // #4a4543 - Gray 5
            }
          : {
              default: mcColors.gray1, // #ede5e2 - Gray 1
              paper: mcColors.white, // #ffffff - White
            },
        primary: {
          main: mcColors.green4, // #52a535 - Minecraft Green (Green 4)
          light: mcColors.green3, // #6fc24a - Green 3
          dark: mcColors.green5, // #3e8828 - Green 5
          contrastText: mcColors.white,
        },
        secondary: isDark
          ? {
              main: mcColors.green2, // #86d562 - Green 2
              contrastText: mcColors.gray6,
            }
          : {
              main: mcColors.green6, // #2a641c - Green 6
              contrastText: mcColors.white,
            },
        text: isDark
          ? {
              primary: mcColors.white,
              secondary: mcColors.gray2, // #d4ccc9
            }
          : {
              primary: mcColors.gray6, // #262423
              secondary: mcColors.gray5, // #4a4543
            },
        divider: isDark ? mcColors.gray5 : mcColors.gray2,
        success: {
          main: isDark ? mcColors.green3 : mcColors.green4,
          contrastText: mcColors.white,
        },
        warning: {
          main: isDark ? "#ffc107" : "#f5a623",
        },
        error: {
          main: isDark ? "#ef5350" : "#d32f2f",
        },
        info: {
          main: isDark ? mcColors.gray3 : mcColors.gray5, // Use darker gray in light mode for better contrast
        },
      },
      typography: {
        fontFamily: `"Noto Sans", "Segoe UI", "Helvetica Neue", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", sans-serif`,
        h1: {
          fontSize: "2rem",
          fontWeight: 700,
          letterSpacing: "2px",
        },
        h2: {
          fontSize: "1.5rem",
          fontWeight: 700,
          letterSpacing: "1.5px",
        },
        h3: {
          fontSize: "1.25rem",
          fontWeight: 600,
          letterSpacing: "1px",
        },
        h4: {
          fontSize: "1.125rem",
          fontWeight: 600,
        },
        h5: {
          fontSize: "1rem",
          fontWeight: 600,
        },
        h6: {
          fontSize: "0.875rem",
          fontWeight: 600,
        },
        body1: {
          fontSize: "0.875rem",
          lineHeight: 1.5,
        },
        body2: {
          fontSize: "0.8125rem",
          lineHeight: 1.45,
        },
        caption: {
          fontSize: "0.75rem",
          lineHeight: 1.4,
        },
        button: {
          fontSize: "0.875rem",
          fontWeight: 500,
          textTransform: "none" as const,
        },
      },
      shape: {
        borderRadius: 4,
      },
      components: {
        MuiButton: {
          styleOverrides: {
            root: {
              textTransform: "none",
              borderRadius: 4,
            },
            contained: {
              boxShadow: "none",
              "&:hover": {
                boxShadow: "none",
              },
            },
          },
        },
        MuiPaper: {
          styleOverrides: {
            root: {
              backgroundImage: "none",
            },
          },
        },
        MuiRadio: {
          styleOverrides: {
            root: {
              color: isDark ? mcColors.gray2 : mcColors.gray4,
              "&.Mui-checked": {
                color: mcColors.green4,
              },
            },
          },
        },
        MuiCheckbox: {
          styleOverrides: {
            root: {
              color: isDark ? mcColors.gray2 : mcColors.gray4,
              "&.Mui-checked": {
                color: mcColors.green4,
              },
            },
          },
        },
        MuiLink: {
          styleOverrides: {
            root: {
              color: isDark ? mcColors.green2 : mcColors.green4,
              textDecoration: "underline",
              "&:hover": {
                color: isDark ? mcColors.green1 : mcColors.green5,
              },
            },
          },
        },
        MuiOutlinedInput: {
          styleOverrides: {
            root: {
              backgroundColor: isDark ? mcColors.offBlack : mcColors.white,
              "&:hover .MuiOutlinedInput-notchedOutline": {
                borderColor: isDark ? mcColors.gray3 : mcColors.gray4,
              },
              "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                borderColor: mcColors.green4,
                borderWidth: 2,
              },
            },
            notchedOutline: {
              borderColor: isDark ? mcColors.gray4 : mcColors.gray3,
              borderWidth: 2,
            },
          },
        },
        MuiTab: {
          styleOverrides: {
            root: {
              textTransform: "none",
              fontWeight: 500,
              "&.Mui-selected": {
                color: mcColors.green4,
              },
            },
          },
        },
        MuiTabs: {
          styleOverrides: {
            indicator: {
              backgroundColor: mcColors.green4,
            },
          },
        },
      },
    });
  }, [mode]);

  const toggleMode = useCallback(() => {
    setMode((prev) => (prev === "light" ? "dark" : "light"));
  }, []);

  return [theme, toggleMode, mode] as const;
}
