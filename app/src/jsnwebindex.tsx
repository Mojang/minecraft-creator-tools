// =============================================================================
// WEBPACK PUBLIC PATH - Must be set before any other imports
// This enables webpack to dynamically load async chunks from the correct location
// For the CLI web server, content is served from /app/
// =============================================================================
// @ts-ignore - __webpack_public_path__ is a webpack magic variable
__webpack_public_path__ = "/app/";

import React from "react";
import { createRoot } from "react-dom/client";
import "./jsnwebindex.css";
import App from "./UX/appShell/App";
import CreatorToolsHost, { CreatorToolsThemeStyle } from "./app/CreatorToolsHost";
import { loader } from "@monaco-editor/react";

import Utilities from "./core/Utilities";
import { minecraftToolDarkTheme, minecraftToolLightTheme } from "./core/StandardInit";
import { ThemeProvider } from "@mui/material";
import { createMcTheme } from "./UX/hooks/theme/UseTheme";

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

  // Detect forced-colors (Windows High Contrast) mode
  const isForcedColors = window.matchMedia?.("(forced-colors: active)").matches ?? false;
  CreatorToolsHost.isHighContrast = isForcedColors;

  if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    CreatorToolsHost.theme = CreatorToolsThemeStyle.dark;
  } else {
    CreatorToolsHost.theme = CreatorToolsThemeStyle.light;
  }

  document.body.classList.toggle("ct-dark", CreatorToolsHost.theme === CreatorToolsThemeStyle.dark);
  document.body.classList.toggle("ct-light", CreatorToolsHost.theme === CreatorToolsThemeStyle.light);
  document.body.classList.toggle("ct-hc", isForcedColors);

  const container = document.getElementById("root");
  if (!container) {
    throw new Error("Root element not found");
  }
  const root = createRoot(container);
  const initialMode = CreatorToolsHost.theme === CreatorToolsThemeStyle.dark ? "dark" : "light";
  root.render(
    <React.StrictMode>
      <ThemeProvider theme={createMcTheme(initialMode as "light" | "dark")}>
        <App darkTheme={darkTheme} lightTheme={lightTheme} />
      </ThemeProvider>
    </React.StrictMode>
  );
}

initAsync();
