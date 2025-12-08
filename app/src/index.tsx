import React from "react";
import ReactDOM from "react-dom";
import "./index.css";
import "@fontsource/noto-sans";
import App from "./UX/App";
import AppServiceProxy, { AppServiceProxyCommands } from "./core/AppServiceProxy";
import CreatorToolsHost, { CreatorToolsThemeStyle } from "./app/CreatorToolsHost";
import { loader } from "@monaco-editor/react";
import { minecraftToolDarkTheme, minecraftToolLightTheme } from "./core/StandardInit";

import { Provider, teamsDarkTheme, mergeThemes, teamsTheme } from "@fluentui/react-northstar";
import Log from "./core/Log";

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

  let darkTheme = mergeThemes(teamsDarkTheme, minecraftToolDarkTheme);
  let lightTheme = mergeThemes(teamsTheme, minecraftToolLightTheme);

  const storedMode = localStorage.getItem("color-mode") as string;

  if (window.location.search.indexOf("theme=l") > 0) {
    CreatorToolsHost.theme = CreatorToolsThemeStyle.light;
  } else if (window.location.search.indexOf("theme=d") > 0) {
    CreatorToolsHost.theme = CreatorToolsThemeStyle.dark;
  } else if (storedMode) {
    CreatorToolsHost.theme = storedMode === "light" ? CreatorToolsThemeStyle.light : CreatorToolsThemeStyle.dark;
  } else {
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      CreatorToolsHost.theme = CreatorToolsThemeStyle.dark;
    } else {
      CreatorToolsHost.theme = CreatorToolsThemeStyle.light;
    }
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
