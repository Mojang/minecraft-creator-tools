import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "@fontsource/noto-sans";
import App from "./UX/appShell/App";
import AppServiceProxy from "./core/AppServiceProxy";
import CreatorToolsHost, { CreatorToolsThemeStyle } from "./app/CreatorToolsHost";
import { loader } from "@monaco-editor/react";
import { minecraftToolDarkTheme, minecraftToolLightTheme } from "./core/StandardInit";
import { ThemeProvider } from "@mui/material";
import { createMcTheme } from "./UX/hooks/theme/UseTheme";
import { LocalizationProvider, getUserLocale } from "./UX/appShell/LocalizationProvider";

import Log from "./core/Log";

// Import ProjectWorkerManager to register it for web worker support
// This module self-registers when loaded in browser environments
import "./workers/ProjectWorkerManager";

CreatorToolsHost.init();

window.addEventListener("unhandledrejection", (evt) => {
  if (evt?.reason?.stack?.includes?.("/monaco/min/vs") || evt?.reason?.stack?.includes?.("/dist/vs")) {
    evt.stopImmediatePropagation();
  }
});

function ensureFirstBackSlash(str: string) {
  return str.length > 0 && str.charAt(0) !== "/" ? "/" + str : str;
}

function uriFromPath(_path: string) {
  const pathName = _path.replace(/\\/g, "/");

  return encodeURI("file://" + ensureFirstBackSlash(pathName));
}

async function initVsLoader() {
  if (AppServiceProxy.hasAppService) {
    let basePath = window.location.href;

    basePath = basePath.substring(0, basePath.lastIndexOf("/"));

    if (basePath.includes("?")) {
      basePath = basePath.substring(0, basePath.indexOf("?"));
    }

    loader.config({
      paths: {
        vs: basePath + "/dist/vs",
      },
    });

    try {
      await loader.init();
    } catch (err) {
      Log.fail("Monaco loader initialization failed: " + err);
    }
  } else {
    loader.config({
      paths: { vs: "/dist/vs" },
    });
  }
}

async function initAsync() {
  await initVsLoader();

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
