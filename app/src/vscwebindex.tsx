// =============================================================================
// WEBPACK PUBLIC PATH - Must be set before any other imports
// This enables webpack to dynamically load async chunks from the correct location
// g_webRoot points to the web/ folder where chunks are located
// g_contentRoot points to extension root for data files (set separately)
// =============================================================================
declare const g_webRoot: string | undefined;
declare const g_contentRoot: string | undefined;
// @ts-ignore - __webpack_public_path__ is a webpack magic variable
__webpack_public_path__ = typeof g_webRoot !== "undefined" ? g_webRoot : "./";

import React from "react";
import { createRoot } from "react-dom/client";
import "./vscwebindex.css";
import App from "./UX/appShell/App";
import CreatorToolsHost, { HostType, CreatorToolsThemeStyle } from "./app/CreatorToolsHost";
import { loader } from "@monaco-editor/react";

import MessageProxyStorage from "./vscodeweb/MessageProxyStorage";
import MessageProxy from "./vscodeweb/MessageProxy";
import Log, { LogItem } from "./core/Log";
import Utilities from "./core/Utilities";
import VsWebLocalUtilities from "./vscodeweb/VsWebLocalUtilities";
import CreatorTools from "./app/CreatorTools";
import { MinecraftFlavor } from "./app/ICreatorToolsData";
import RemoteMinecraft from "./app/RemoteMinecraft";
import MinecraftGameProxyMinecraft from "./clientapp/MinecraftGameProxyMinecraft";
import ProcessHostedProxyMinecraft from "./clientapp/ProcessHostedProxyMinecraft";
import { minecraftToolDarkTheme, minecraftToolLightTheme } from "./core/StandardInit";
import { ThemeProvider } from "@mui/material";
import { createMcTheme } from "./UX/hooks/theme/UseTheme";
import { LocalizationProvider, getUserLocale } from "./UX/appShell/LocalizationProvider";
import { GlobalErrorBoundary, GlobalErrorOverlay } from "./UX/appShell/errorOverlay";
import StorageUtilities from "./storage/StorageUtilities";
import IStorage, { IFileUpdateEvent } from "./storage/IStorage";
import IFile from "./storage/IFile";

// @ts-ignore
const _vscode = acquireVsCodeApi();

function callPostMessage(message: any) {
  _vscode.postMessage(message);
}

let g_callbacksByChannel: { [channelName: string]: ((args: any) => void)[] } = {};
let g_getContentCallback: (() => Promise<any>) | undefined;
let g_saveAllCallback: (() => Promise<any>) | undefined;

// @ts-ignore
window.api = {
  send: (channelName: string, commandName: string, data: string) => {
    if (channelName === "vscode") {
      handleVscCommand(commandName, data);
      return;
    }
    _vscode.postMessage({ command: commandName, id: channelName, data: data });
  },
  receive: (channelName: string, eventCallback: (args: any) => void) => {
    if (!g_callbacksByChannel[channelName]) {
      g_callbacksByChannel[channelName] = [];
    }

    g_callbacksByChannel[channelName].push(eventCallback);
  },
};

CreatorToolsHost.postMessage = callPostMessage;
CreatorToolsHost.canCreateMinecraft = canCreateMinecraft;
CreatorToolsHost.createMinecraft = createMinecraft;

//@ts-ignore
if (typeof g_isVsCodeMain !== "undefined" && typeof g_isVsCodeWeb !== "undefined") {
  //@ts-ignore
  if (g_isVsCodeMain || g_isVsCodeWeb) {
    CreatorToolsHost.localFolderExists = _vscLocalFolderExists;
    CreatorToolsHost.localFileExists = _vscLocalFileExists;
    CreatorToolsHost.ensureLocalFolder = _vscEnsureLocalFolder;
  }
}

function canCreateMinecraft(flavor: MinecraftFlavor) {
  if (flavor === MinecraftFlavor.remote) {
    return true;
  }

  if (CreatorToolsHost.hostType === HostType.vsCodeMainWeb) {
    return true;
  }

  return false;
}

function handleVscCommand(commandName: string, data: string) {
  commandName = commandName.toLowerCase();

  switch (commandName) {
  }
}

function createMinecraft(flavor: MinecraftFlavor, creatorTools: CreatorTools) {
  if (flavor === MinecraftFlavor.remote) {
    return new RemoteMinecraft(creatorTools);
  } else if (flavor === MinecraftFlavor.minecraftGameProxy && CreatorToolsHost.hostType === HostType.vsCodeMainWeb) {
    return new MinecraftGameProxyMinecraft(creatorTools);
  } else if (flavor === MinecraftFlavor.processHostedProxy && CreatorToolsHost.hostType === HostType.vsCodeMainWeb) {
    return new ProcessHostedProxyMinecraft(creatorTools);
  }

  return undefined;
}

//@ts-ignore
if (typeof g_projectPath !== "undefined") {
  // this sets up the projects folder as a general storage mechanism, but shouldn't be generally used in a VS Code project.
  //@ts-ignore
  CreatorToolsHost.projectsStorage = new MessageProxyStorage("projects", "");
  // (CreatorToolsHost.projectsStorage as MessageProxyStorage).isEnabled = false;
}

//@ts-ignore
if (typeof g_isDebug !== "undefined") {
  //@ts-ignore
  Utilities.setIsDebug(g_isDebug);
}

CreatorToolsHost.prefsStorage = new MessageProxyStorage("prefs", "");
CreatorToolsHost.worldStorage = new MessageProxyStorage("worlds", "");
CreatorToolsHost.packStorage = new MessageProxyStorage("packs", "");

function logToExtension(message: string) {
  let id = "unknown";

  //@ts-ignore
  if (typeof g_projectPath !== "undefined") {
    //@ts-ignore
    id = g_projectPath;
  }

  try {
    callPostMessage({ command: "logMessage", id: id, data: message });
  } catch (e) {
    Log.debug("Unable to show error: " + e + " " + message);
  }
}

LogItem.alertFunction = logToExtension;

// Global error handlers — surface any uncaught browser-side errors back to the extension
// host so they show up in the VS Code notifications / output, instead of silently crashing
// the webview (which tends to manifest as the MCT pane "disappearing" a few seconds after load).
window.addEventListener("error", (evt) => {
  try {
    const err = evt.error;
    const details = (err && (err.stack || err.message)) || evt.message || "(no message)";
    logToExtension("Uncaught error: " + details + " @ " + evt.filename + ":" + evt.lineno + ":" + evt.colno);
  } catch {
    // swallow — we can't do anything more
  }
});

window.addEventListener("message", (event) => {
  // Log.message("New message in vsc browser to: " + JSON.stringify(event.data));
  try {
    CreatorToolsHost.notifyNewMessage(window, event.data);

    if (event.data.type && event.data.type === "getFileData" && event.data.requestId) {
      _passFileData(event.data.requestId);
    } else if (event.data.type && event.data.type === "saveAll") {
      _saveAll();
    } else if (event.data.id) {
      const callbackArray = g_callbacksByChannel[event.data.id];

      if (callbackArray && callbackArray.length) {
        for (let i = 0; i < callbackArray.length; i++) {
          // Log.message("Routing message to ASP callback: " + event.data.command + "|" + event.data.data);
          callbackArray[i](event.data.command + "|" + event.data.data);
        }
      }
    }
  } catch (e) {
    logToExtension("Error processing message: " + e);
  }
});

window.addEventListener("unhandledrejection", (evt) => {
  if (evt?.reason?.stack?.includes?.("/monaco/min/vs") || evt?.reason?.stack?.includes?.("/dist/vs")) {
    evt.stopImmediatePropagation();
    return;
  }

  try {
    const reason = evt.reason;
    const details =
      (reason && (reason.stack || reason.message)) ||
      (typeof reason === "string" ? reason : JSON.stringify(reason)) ||
      "(no reason)";
    logToExtension("Unhandled promise rejection: " + details);
  } catch {
    // swallow
  }
});

//@ts-ignore
let contentRoot: string = g_contentRoot || "";

contentRoot = Utilities.ensureEndsWithSlash(contentRoot);

loader.config({
  paths: { vs: contentRoot + "dist/vs" },
});

async function _vscLocalFolderExists(path: string) {
  // Use CreatorToolsHost.projectPath as channel ID to match the StorageProxy on the extension host
  const channelId = CreatorToolsHost.projectPath || path;
  const ls = new MessageProxyStorage(channelId, path);

  return await ls.rootFolder.exists();
}

async function _passFileData(requestId: string) {
  if (g_getContentCallback) {
    const content = await g_getContentCallback();

    _vscode.postMessage({ type: "response", requestId: requestId, body: content });
  }
}

async function _saveAll() {
  if (g_saveAllCallback) {
    g_saveAllCallback();
  }
}

async function _vscLocalFileExists(path: string) {
  const folderPath = StorageUtilities.getFolderPath(path);
  const fileName = StorageUtilities.getLeafName(path);

  if (!fileName || fileName.length < 2 || !folderPath || folderPath.length < 2) {
    throw new Error("Could not process file with path: `" + path + "`");
  }

  // Use CreatorToolsHost.projectPath as channel ID to match the StorageProxy on the extension host
  const channelId = CreatorToolsHost.projectPath || folderPath;
  const ls = new MessageProxyStorage(channelId, folderPath);

  const file = ls.rootFolder.ensureFile(fileName);

  return await file.exists();
}

function _vscEnsureLocalFolder(path: string) {
  // Use CreatorToolsHost.projectPath as channel ID to match the StorageProxy on the extension host
  const channelId = CreatorToolsHost.projectPath || path;
  const ls = new MessageProxyStorage(channelId, path);

  ls.onFileContentsUpdated.subscribe(projectFileUpdated);
  ls.onFileAdded.subscribe(projectFileAdded);

  return ls.rootFolder;
}

function projectFileAdded(storage: IStorage, file: IFile) {
  Log.debug("File content updated: " + file.storageRelativePath);

  _vscode.postMessage({
    type: "notifyFileUpdated",
    storagePath: file.storageRelativePath,
    content: file.content,
  });
}
function projectFileUpdated(storage: IStorage, fileEvent: IFileUpdateEvent) {
  Log.debug("File content updated: " + fileEvent.file.storageRelativePath);

  _vscode.postMessage({
    type: "notifyFileUpdated",
    storagePath: fileEvent.file.storageRelativePath,
    content: fileEvent.file.content,
  });
}

function setGetContentCallback(func: () => Promise<any>) {
  g_getContentCallback = func;
}

function setSaveAllCallback(func: () => Promise<void>) {
  g_saveAllCallback = func;
}

async function initAsync() {
  CreatorToolsHost.init();

  // Set contentWebRoot to the extension's content root for loading bundled forms and data files
  // This must be set before Database operations that load forms
  CreatorToolsHost.contentWebRoot = contentRoot;

  MessageProxy.init();

  const localUtilities = new VsWebLocalUtilities();

  // NOTE: We intentionally do NOT set Database.local here because:
  // 1. Database.local is used for storage-based folder loading which requires directory listing
  // 2. HttpStorage doesn't support directory listing on static file servers
  // 3. When Database.local is null, Database.ensureFormLoaded falls back to axios-based direct file fetching
  //    which works correctly with static file servers using CreatorToolsHost.contentWebRoot

  const ct = CreatorToolsHost.getCreatorTools();

  if (ct) {
    ct.local = localUtilities;
  }

  const darkTheme = minecraftToolDarkTheme;
  const lightTheme = minecraftToolLightTheme;

  const bodyThemeVal = document.body.getAttribute("data-vscode-theme-kind");

  if (bodyThemeVal) {
    // data-vscode-theme-kind values:
    //   "vscode-light", "vscode-dark", "vscode-high-contrast", "vscode-high-contrast-light"
    const isHC = bodyThemeVal.indexOf("high-contrast") >= 0;
    CreatorToolsHost.isHighContrast = isHC;

    // Check for "light" to distinguish direction — "vscode-high-contrast" (dark HC) does not contain "light"
    const isLight = bodyThemeVal.indexOf("light") >= 0;
    CreatorToolsHost.theme = isLight ? CreatorToolsThemeStyle.light : CreatorToolsThemeStyle.dark;
  }

  document.body.classList.toggle("ct-dark", CreatorToolsHost.theme === CreatorToolsThemeStyle.dark);
  document.body.classList.toggle("ct-light", CreatorToolsHost.theme === CreatorToolsThemeStyle.light);
  document.body.classList.toggle("ct-hc", CreatorToolsHost.isHighContrast);

  const container = document.getElementById("root");
  if (!container) {
    throw new Error("Root element not found");
  }
  const root = createRoot(container);
  const initialMode = CreatorToolsHost.theme === CreatorToolsThemeStyle.dark ? "dark" : "light";
  root.render(
    <React.StrictMode>
      <LocalizationProvider locale={getUserLocale()}>
        <ThemeProvider theme={createMcTheme(initialMode as "light" | "dark")}>
          <GlobalErrorBoundary>
            <App
              darkTheme={darkTheme}
              lightTheme={lightTheme}
              fileContentRetriever={setGetContentCallback}
              saveAllRetriever={setSaveAllCallback}
            />
          </GlobalErrorBoundary>
          {/* Sibling overlay for non-fatal (recoverable) errors so it can render even while App is alive. */}
          <GlobalErrorOverlay />
        </ThemeProvider>
      </LocalizationProvider>
    </React.StrictMode>
  );
}

initAsync().catch((err) => {
  const details =
    (err && (err.stack || err.message)) || (typeof err === "string" ? err : JSON.stringify(err)) || "(unknown)";
  logToExtension("initAsync failed: " + details);

  // Render a visible fallback so the pane doesn't silently go blank.
  try {
    const container = document.getElementById("root");
    if (container) {
      container.innerHTML =
        '<div style="padding:12px;font-family:var(--vscode-font-family);color:var(--vscode-errorForeground);">' +
        "<h3>Minecraft Creator Tools failed to load</h3>" +
        '<pre style="white-space:pre-wrap;font-size:11px;">' +
        String(details).replace(/</g, "&lt;") +
        "</pre></div>";
    }
  } catch {
    // swallow
  }
});
