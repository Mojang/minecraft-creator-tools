import React from "react";
import ReactDOM from "react-dom";
import "./jsnwebindex.css";
import App from "./UX/App";
import CreatorToolsHost, { CreatorToolsThemeStyle } from "./app/CreatorToolsHost";
import { loader } from "@monaco-editor/react";

import { Provider, teamsDarkTheme, mergeThemes, teamsTheme } from "@fluentui/react-northstar";
import Utilities from "./core/Utilities";
import { minecraftToolDarkTheme, minecraftToolLightTheme } from "./core/StandardInit";

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

  let darkTheme = mergeThemes(teamsDarkTheme, minecraftToolDarkTheme);
  let lightTheme = mergeThemes(teamsTheme, minecraftToolLightTheme);

  if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    CreatorToolsHost.theme = CreatorToolsThemeStyle.dark;
  } else {
    CreatorToolsHost.theme = CreatorToolsThemeStyle.light;
  }

  ReactDOM.render(
    <React.StrictMode>
      <Provider theme={CreatorToolsHost.theme === CreatorToolsThemeStyle.dark ? darkTheme : lightTheme}>
        <App darkTheme={darkTheme} lightTheme={lightTheme} />
      </Provider>
    </React.StrictMode>,
    document.getElementById("root")
  );
}

initAsync();
