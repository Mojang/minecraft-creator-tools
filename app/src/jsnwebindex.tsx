// =============================================================================
// WEBPACK PUBLIC PATH - Must be set before any other imports
// This enables webpack to dynamically load async chunks from the correct location
// For the CLI web server, content is served from /app/
// =============================================================================
// @ts-ignore - __webpack_public_path__ is a webpack magic variable
__webpack_public_path__ = "/app/";

import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "./jsnwebindex.css";
import "@fontsource/noto-sans";
import App from "./UX/appShell/App";
import CreatorToolsHost, { CreatorToolsThemeStyle } from "./app/CreatorToolsHost";
import { loader } from "@monaco-editor/react";

import Utilities from "./core/Utilities";
import { minecraftToolDarkTheme, minecraftToolLightTheme } from "./core/StandardInit";
import { ThemeProvider } from "@mui/material";
import { createMcTheme } from "./UX/hooks/theme/UseTheme";
import { LocalizationProvider, getUserLocale } from "./UX/appShell/LocalizationProvider";

// Import ProjectWorkerManager to register it for web worker support
// This module self-registers when loaded in browser environments
import "./workers/ProjectWorkerManager";

//@ts-ignore
if (typeof g_isDebug !== "undefined") {
  //@ts-ignore
  Utilities.setIsDebug(g_isDebug);
}

window.addEventListener("unhandledrejection", (evt) => {
  if (evt?.reason?.stack?.includes?.("/monaco/min/vs") || evt?.reason?.stack?.includes?.("/dist/vs")) {
    evt.stopImmediatePropagation();
  }
});

loader.config({
  paths: { vs: "/dist/vs" },
});

async function initAsync() {
  CreatorToolsHost.init();

  const darkTheme = minecraftToolDarkTheme;
  const lightTheme = minecraftToolLightTheme;

  const storedMode = localStorage.getItem("color-mode") as string;

  // Detect forced-colors (Windows High Contrast) mode
  const isForcedColors = window.matchMedia?.("(forced-colors: active)").matches ?? false;
  CreatorToolsHost.isHighContrast = isForcedColors;

  if (window.location.search.indexOf("theme=l") > 0) {
    CreatorToolsHost.theme = CreatorToolsThemeStyle.light;
  } else if (window.location.search.indexOf("theme=d") > 0) {
    CreatorToolsHost.theme = CreatorToolsThemeStyle.dark;
  } else if (!isForcedColors && storedMode) {
    // When forced-colors is active, ignore stored preference — follow system color scheme
    CreatorToolsHost.theme = storedMode === "light" ? CreatorToolsThemeStyle.light : CreatorToolsThemeStyle.dark;
  } else {
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      CreatorToolsHost.theme = CreatorToolsThemeStyle.dark;
    } else {
      CreatorToolsHost.theme = CreatorToolsThemeStyle.light;
    }
  }

  document.body.classList.toggle("ct-dark", CreatorToolsHost.theme === CreatorToolsThemeStyle.dark);
  document.body.classList.toggle("ct-light", CreatorToolsHost.theme === CreatorToolsThemeStyle.light);
  document.body.classList.toggle("ct-hc", isForcedColors);

  const container = document.getElementById("root");
  if (!container) {
    throw new Error("Root element not found");
  }
  const root = createRoot(container);

  /**
   * Wrapper that keeps the MUI ThemeProvider in sync with CreatorToolsHost.theme.
   * Without this, components using MUI's useTheme() (e.g. McToolbar) would stay
   * stuck on the initial theme because <ThemeProvider theme={...}> was only set once.
   */
  function ThemedApp() {
    const [mode, setMode] = useState<"dark" | "light">(
      CreatorToolsHost.theme === CreatorToolsThemeStyle.dark ? "dark" : "light"
    );

    useEffect(() => {
      const handler = () => {
        setMode(CreatorToolsHost.theme === CreatorToolsThemeStyle.dark ? "dark" : "light");
      };
      CreatorToolsHost.onThemeChanged.subscribe(handler);
      return () => {
        CreatorToolsHost.onThemeChanged.unsubscribe(handler);
      };
    }, []);

    return (
      <LocalizationProvider locale={getUserLocale()}>
        <ThemeProvider theme={createMcTheme(mode)}>
          <App darkTheme={darkTheme} lightTheme={lightTheme} />
        </ThemeProvider>
      </LocalizationProvider>
    );
  }

  root.render(
    <React.StrictMode>
      <ThemedApp />
    </React.StrictMode>
  );
}

initAsync();
