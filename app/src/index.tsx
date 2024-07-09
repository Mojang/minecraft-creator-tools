import React from "react";
import ReactDOM from "react-dom";
import "./index.css";
import "@fontsource/noto-sans";
import App from "./UX/App";
import AppServiceProxy, { AppServiceProxyCommands } from "./core/AppServiceProxy";
import CartoApp, { CartoThemeStyle } from "./app/CartoApp";
import { loader } from "@monaco-editor/react";
import { minecraftToolDarkTheme, minecraftToolLightTheme } from "./core/StandardInit";

import { Provider, teamsDarkTheme, mergeThemes, teamsTheme } from "@fluentui/react-northstar";

CartoApp.init();

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
    let dirName = await AppServiceProxy.sendAsync(AppServiceProxyCommands.getDirname, "");

    if (dirName === undefined) {
      dirName = "";
    }

    const path = uriFromPath(dirName + "/../build/dist/vs");

    loader.config({
      paths: {
        vs: path,
      },
    });
  } else {
    loader.config({
      paths: { vs: "/dist/vs" },
    });
  }
}

initVsLoader();

let theme = undefined;

if (window.location.search.indexOf("theme=l") > 0) {
  CartoApp.theme = CartoThemeStyle.light;
} else if (window.location.search.indexOf("theme=d") > 0) {
  CartoApp.theme = CartoThemeStyle.dark;
} else {
  if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    CartoApp.theme = CartoThemeStyle.dark;
  } else {
    CartoApp.theme = CartoThemeStyle.light;
  }
}

if (CartoApp.theme === CartoThemeStyle.dark) {
  theme = mergeThemes(teamsDarkTheme, minecraftToolDarkTheme);
} else {
  theme = mergeThemes(teamsTheme, minecraftToolLightTheme);
}

ReactDOM.render(
  <React.StrictMode>
    <Provider theme={theme}>
      <App theme={theme} />
    </Provider>
  </React.StrictMode>,
  document.getElementById("root")
);
