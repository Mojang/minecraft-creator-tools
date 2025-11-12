import { createTheme, Theme } from "@mui/material";
import { useCallback, useEffect, useMemo, useState } from "react";

type ThemeMode = "light" | "dark";

export function useTheme() {
  const getInitialMode = () => {
    const stored = localStorage.getItem("color-mode") as ThemeMode | null;
    if (stored) return stored;
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    return prefersDark ? "dark" : "light";
  };

  const [mode, setMode] = useState<ThemeMode>(getInitialMode());

  useEffect(() => {
    localStorage.setItem("color-mode", mode);
  }, [mode]);

  const theme: Theme = useMemo(() => {
    const isDark = mode !== "light";
    return createTheme({
      palette: {
        mode: mode,
        background: isDark
          ? {
              default: "#000000",
              paper: "#1e1e1e",
            }
          : {
              default: "#e5e5e5",
            },
        primary: isDark
          ? {
              main: "#48494A",
              contrastText: "#f5f5f5",
            }
          : {
              main: "#1976d2",
              contrastText: "#f5f5f5",
            },
        secondary: isDark
          ? {
              main: "#f5f5f5",
              contrastText: "#48494A",
            }
          : {
              main: "#1e1e1e",
            },

        info: isDark
          ? {
              main: "#f5f5f5",
              contrastText: "#f5f5f5",
            }
          : {
              main: "#f5f5f5",
              light: "#f5f5f5",
              dark: "#f5f5f5",
              contrastText: "#f5f5f5",
            },
      },
      typography: {
        fontFamily: `"Noto Sans", "Segoe UI", "Helvetica Neue", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", sans-serif`,
        h1: {
          fontSize: "2.5rem",
          fontWeight: 700,
        },
        body1: {
          fontSize: "1rem",
          lineHeight: 1.6,
        },
      },
      components: {
        MuiRadio: isDark
          ? {
              styleOverrides: {
                root: {
                  color: "#f5f5f5",
                  // checked color
                  "&.Mui-checked": {
                    color: "#fcfcfcff",
                  },
                },
              },
            }
          : {},
        MuiLink: isDark
          ? {
              styleOverrides: {
                root: {
                  color: "#f5f5f5",
                  textDecoration: "underline",
                },
              },
            }
          : {
              styleOverrides: {
                root: {
                  color: "#f5f5f5",
                  textDecoration: "underline",
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
