import { createTheme, Theme } from "@mui/material";
import { useCallback, useEffect, useMemo, useState } from "react";
import CreatorToolsHost, { CreatorToolsThemeStyle } from "../../../app/CreatorToolsHost";
import { mcColors } from "./mcColors";

type ThemeMode = "light" | "dark";

/**
 * Creates an MUI theme for the given mode. Exported for use in ThemeProvider
 * wrappers outside of React hook context (e.g., index.tsx).
 */
export function createMcTheme(mode: ThemeMode): Theme {
  const isDark = mode !== "light";
  return createTheme({
    palette: {
      mode: mode,
      background: isDark
        ? {
            default: mcColors.gray6,
            paper: mcColors.gray5,
          }
        : {
            default: mcColors.gray1,
            paper: mcColors.white,
          },
      primary: {
        main: mcColors.green4,
        light: mcColors.green3,
        dark: mcColors.green5,
        contrastText: mcColors.white,
      },
      secondary: isDark
        ? {
            main: mcColors.green2,
            contrastText: mcColors.gray6,
          }
        : {
            main: mcColors.green6,
            contrastText: mcColors.white,
          },
      text: isDark
        ? {
            primary: mcColors.white,
            secondary: mcColors.gray2,
          }
        : {
            primary: mcColors.gray6,
            secondary: mcColors.gray5,
          },
      divider: isDark ? mcColors.gray4 : mcColors.gray3,
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
        main: isDark ? mcColors.gray3 : mcColors.gray5,
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
          text: {
            color: "inherit",
          },
          contained: {
            boxShadow: "none",
            "&:hover": {
              boxShadow: "none",
            },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 4,
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
      MuiDialog: {
        styleOverrides: {
          paper: {
            // Clip children horizontally to respect border-radius (e.g. DialogTitle green border).
            // MUI's paperScrollPaper sets overflow-y:auto which resets overflow-x to visible,
            // so we must set overflow-x explicitly.
            overflowX: "hidden",
          },
        },
      },
      MuiDialogTitle: {
        styleOverrides: {
          root: {
            fontFamily: `"Noto Sans", "Segoe UI", "Helvetica Neue", sans-serif`,
            fontWeight: 600,
            fontSize: "1.1rem",
            letterSpacing: "0.5px",
            padding: "14px 24px 6px 24px",
            backgroundColor: isDark ? mcColors.gray5 : mcColors.gray2,
            borderBottom: `2px solid ${isDark ? mcColors.green5 : mcColors.green4}`,
          },
        },
      },
      MuiDialogActions: {
        styleOverrides: {
          root: {
            padding: "12px 24px",
            gap: "8px",
            borderTop: `1px solid ${isDark ? mcColors.gray5 : mcColors.gray3}`,
            "& .MuiButton-root": {
              minWidth: "80px",
              fontWeight: 600,
              borderRadius: "4px",
              padding: "6px 20px",
            },
            // Style the last button (primary action) as contained
            "& .MuiButton-root:last-of-type": {
              backgroundColor: mcColors.green4,
              color: mcColors.white,
              "&:hover": {
                backgroundColor: mcColors.green5,
              },
            },
            // Style non-last buttons (Cancel, etc.) as outlined
            "& .MuiButton-root:not(:last-of-type)": {
              border: `1px solid ${isDark ? mcColors.gray3 : mcColors.gray4}`,
              color: isDark ? mcColors.gray2 : mcColors.gray5,
              "&:hover": {
                backgroundColor: isDark ? mcColors.gray5 : mcColors.gray2,
              },
            },
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
      MuiMenuItem: {
        styleOverrides: {
          root: {
            "&.Mui-selected": {
              backgroundColor: "rgba(82, 165, 53, 0.25)",
            },
            "&.Mui-selected:hover": {
              backgroundColor: "rgba(82, 165, 53, 0.35)",
            },
            "&:hover": {
              backgroundColor: "rgba(82, 165, 53, 0.1)",
            },
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            backgroundColor: isDark ? mcColors.gray5 : mcColors.gray6,
            color: mcColors.white,
            fontSize: "0.75rem",
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
            color: isDark ? mcColors.green2 : mcColors.green7,
            textDecoration: "underline",
            fontWeight: 600,
            "&:hover": {
              color: isDark ? mcColors.green1 : mcColors.green6,
            },
          },
        },
      },
      MuiInputLabel: {
        styleOverrides: {
          root: {
            color: isDark ? mcColors.gray3 : mcColors.gray4,
            "&.Mui-focused": {
              color: mcColors.green4,
            },
            "&.MuiInputLabel-shrink": {
              backgroundColor: isDark ? mcColors.offBlack : mcColors.white,
              padding: "0 4px",
              borderRadius: 2,
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
              borderWidth: 1,
            },
          },
          notchedOutline: {
            borderColor: isDark ? mcColors.gray4 : mcColors.gray3,
            borderWidth: 1,
          },
        },
      },
      MuiSwitch: {
        styleOverrides: {
          root: {
            width: "44px !important",
            height: "22px !important",
            padding: "0px !important",
            overflow: "visible",
          },
          switchBase: {
            padding: "1px 0 0 0 !important",
            borderRadius: "0 !important",
            left: "0 !important",
            "&.Mui-checked": {
              transform: "translateX(30px) !important",
            },
            "& .MuiTouchRipple-root": {
              display: "none",
            },
          },
          thumb: {
            width: "12px !important",
            height: "18px !important",
            borderRadius: "0 !important",
            border: isDark ? "2px solid #1a1a1a !important" : "2px solid #888 !important",
            backgroundColor: isDark ? "#606060 !important" : "#b0b0b0 !important",
            boxShadow: isDark
              ? "inset -1px -1px 0 0 #303030, inset 1px 1px 0 0 #808080 !important"
              : "inset -1px -1px 0 0 #909090, inset 1px 1px 0 0 #d0d0d0 !important",
            ".Mui-checked &": {
              backgroundColor: `${mcColors.green4} !important`,
              border: isDark ? "2px solid #1a1a1a !important" : "2px solid #2d6b1e !important",
              boxShadow: "inset -1px -1px 0 0 #2d6b1e, inset 1px 1px 0 0 #6fc24a !important",
            },
          },
          track: {
            borderRadius: "0 !important",
            backgroundColor: isDark ? "#3a3a3a !important" : "#a0a0a0 !important",
            opacity: "1 !important",
            border: isDark ? "2px solid #1a1a1a !important" : "2px solid #888 !important",
            boxShadow: isDark
              ? "inset 1px 1px 0 0 #252525, inset -1px -1px 0 0 #505050 !important"
              : "inset 1px 1px 0 0 #858585, inset -1px -1px 0 0 #b8b8b8 !important",
            // Track must be position:absolute to center vertically
            position: "absolute !important" as any,
            height: "10px !important",
            top: "50% !important",
            bottom: "auto !important",
            left: "0 !important",
            right: "0 !important",
            transform: "translateY(-50%) !important",
            ".Mui-checked + &": {
              backgroundColor: "#2d6b1e !important",
              opacity: "1 !important",
              border: isDark ? "2px solid #1a1a1a !important" : "2px solid #2d6b1e !important",
              boxShadow: "inset 1px 1px 0 0 #1a4a12, inset -1px -1px 0 0 #3e8828 !important",
            },
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
      MuiSlider: {
        styleOverrides: {
          root: {
            borderRadius: 0,
            height: 8,
            padding: "10px 0 !important",
          },
          rail: {
            borderRadius: 0,
            height: 8,
            backgroundColor: isDark ? "#3a3a3a" : "#b0b0b0",
            opacity: 1,
            border: "2px solid #1a1a1a",
            boxShadow: "inset 1px 1px 0 0 #252525, inset -1px -1px 0 0 #505050",
          },
          track: {
            borderRadius: 0,
            height: 8,
            backgroundColor: isDark ? "#2d6b1e" : mcColors.green4,
            border: "2px solid #1a1a1a",
            boxShadow: "inset -1px -1px 0 0 #1a4a12, inset 1px 1px 0 0 #3e8828",
          },
          thumb: {
            width: 12,
            height: 18,
            borderRadius: 0,
            backgroundColor: isDark ? "#606060" : "#b0b0b0",
            border: "2px solid #1a1a1a",
            boxShadow: "inset -1px -1px 0 0 #303030, inset 1px 1px 0 0 #808080 !important",
            "&:hover, &.Mui-focusVisible": {
              boxShadow: "inset -1px -1px 0 0 #252525, inset 1px 1px 0 0 #909090 !important",
              backgroundColor: isDark ? "#707070" : "#c0c0c0",
            },
            "&.Mui-active": {
              boxShadow: "inset -1px -1px 0 0 #252525, inset 1px 1px 0 0 #909090 !important",
              backgroundColor: isDark ? "#707070" : "#c0c0c0",
            },
            "&::before": {
              display: "none",
            },
          },
          valueLabel: {
            borderRadius: 0,
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
}

export function useTheme() {
  const getInitialMode = () => {
    return CreatorToolsHost.theme === CreatorToolsThemeStyle.dark ? "dark" : "light";
  };

  const [mode, setMode] = useState<ThemeMode>(getInitialMode());

  useEffect(() => {
    CreatorToolsHost.theme = mode === "dark" ? CreatorToolsThemeStyle.dark : CreatorToolsThemeStyle.light;
    try {
      localStorage.setItem("color-mode", mode);
    } catch {
      // localStorage may be unavailable in private browsing
    }
    if (typeof document !== "undefined") {
      document.body.classList.toggle("ct-dark", mode === "dark");
      document.body.classList.toggle("ct-light", mode === "light");
      document.body.classList.toggle("ct-hc", CreatorToolsHost.isHighContrast);
    }
  }, [mode]);

  const theme: Theme = useMemo(() => createMcTheme(mode), [mode]);

  const toggleMode = useCallback(() => {
    setMode((prev) => (prev === "light" ? "dark" : "light"));
  }, []);

  return [theme, toggleMode, mode] as const;
}
