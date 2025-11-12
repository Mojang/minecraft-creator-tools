import React from "react";
import ReactDOM from "react-dom";
import "./jsnwebindex.css";
import App from "./UX/App";
import CreatorToolsHost from "./app/CreatorToolsHost";
import { loader } from "@monaco-editor/react";

import { Provider, teamsDarkTheme, mergeThemes } from "@fluentui/react-northstar";
import Utilities from "./core/Utilities";
import { minecraftToolDarkTheme } from "./core/StandardInit";

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

  const theme = mergeThemes(teamsDarkTheme, minecraftToolDarkTheme);

  ReactDOM.render(
    <React.StrictMode>
      <Provider theme={theme}>
        <App theme={theme} />
      </Provider>
    </React.StrictMode>,
    document.getElementById("root")
  );
}

initAsync();
