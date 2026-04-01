/**
 * Electron Preload Script
 *
 * This script runs in a privileged context before the renderer process loads.
 * It exposes a safe API to the renderer via contextBridge.
 *
 * SECURITY: This script acts as a bridge between the main process (Node.js)
 * and the renderer process (web). It carefully validates all operations
 * before allowing them.
 *
 * NOTE: This file is compiled separately with contextIsolation support.
 * It uses CommonJS (require) because Electron's preload scripts don't
 * support ESM in the same way as the main process.
 */

import { contextBridge, ipcRenderer } from "electron";

const _allowedExtensions = [
  "js",
  "ts",
  "mjs",
  "json",
  "md",
  "png",
  "jpg",
  "jpeg",
  "lang",
  "fsb",
  "map",
  "ogg",
  "flac",
  "hdr",
  "psd",
  "env",
  "gif",
  "wav",
  "tga",
  "env",
  "mjs",
  "wlist",
  "brarchive",
  "nbt",
  "webm",
  "svg",
  "otf",
  "ttf",
  "bin",
  "obj",
  "pdn",
  "zip",
  "py",
  "h",
  "fontdata",
  "properties",
  "cartobackup",
  "mctbackup",
  "",
  "mcstructure",
  "mcworld",
  "mcproject",
  "map",
  "js.map",
  "mctemplate",
  "material",
  "vertex",
  "md",
  "geometry",
  "fragment",
  "mcfunction",
  "mcaddon",
  "mcpack",
  "html",
  "dat",
  "dat_old",
  "txt",
  "ldb",
  "log",
  "in",
  "cmake",
];

const _allowedExecutableExtensions = ["mcstructure", "mcworld", "mctemplate", "mcaddon"];

function _getTypeFromName(name: string): string {
  const nameW = name.trim().toLowerCase();

  const lastBackslash = nameW.lastIndexOf("\\");
  const lastSlash = nameW.lastIndexOf("/");

  const lastPeriod = nameW.lastIndexOf(".");

  if (lastPeriod < 0 || lastPeriod < lastSlash || lastPeriod < lastBackslash) {
    return "";
  }

  return nameW.substring(lastPeriod + 1, nameW.length);
}

function _canonicalizePathForValidation(path: string): string {
  if ((path[0] !== "<" || path[5] !== ">") && !path.startsWith("<pt_")) {
    throw new Error("PLD: Unsupported canon path: " + path);
  }

  if (
    path.startsWith("<EDUP>") ||
    path.startsWith("<EDUR>") ||
    path.startsWith("<BDRK>") ||
    path.startsWith("<BDPV>") ||
    path.startsWith("<MCPE>") ||
    path.startsWith("<DOCP>")
  ) {
    path = path.substring(6);
  } else if (path.startsWith("<pt_")) {
    const endGreater = path.indexOf(">", 4);

    if (endGreater > 4) {
      path = path.substring(endGreater + 1);
    }
  } else {
    throw new Error("PLD: Unsupported canon path A: " + path);
  }

  return path;
}

function _validateFolderPath(path: string): void {
  path = _canonicalizePathForValidation(path);
  // banned character combos
  if (path.indexOf("..") >= 0 || path.indexOf("\\\\") >= 0 || path.indexOf("//") >= 0) {
    throw new Error("Unsupported path combinations: " + path);
  }

  if (path.lastIndexOf(":") >= 2) {
    throw new Error("Unsupported drive location: " + path);
  }
}

function _validateDoubleFolderPath(path: string): void {
  const pathArr = path.split("|");

  if (pathArr.length !== 2) {
    throw new Error("Unsupported double folder path: " + path);
  }

  _validateFolderPath(pathArr[0]);
  _validateFolderPath(pathArr[1]);
}

function _validateFilePath(path: string): void {
  _validateFolderPath(path);

  const extension = _getTypeFromName(path);

  if (!_allowedExtensions.includes(extension)) {
    throw new Error("PLD: Unsupported file type: " + path);
  }
}

function _validateExecutableFilePath(path: string): void {
  _validateFolderPath(path);

  const extension = _getTypeFromName(path);

  if (!_allowedExecutableExtensions.includes(extension)) {
    throw new Error("PLD: Unsupported executable file type: " + path);
  }
}

// Valid channels for Agent IPC (uses invoke pattern directly)
const _agentChannels = [
  "agent:start",
  "agent:stop",
  "agent:createSession",
  "agent:send",
  "agent:abort",
  "agent:destroySession",
  "agent:getAuthStatus",
  "agent:listModels",
  "agent:updateContext",
];

contextBridge.exposeInMainWorld("api", {
  // Direct invoke for Agent channels (cleaner API)
  invoke: (channel: string, data: any): Promise<any> => {
    if (_agentChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, data);
    }
    throw new Error("PLD: Invalid invoke channel: " + channel);
  },
  send: (channel: string, commandName: string, data: any): Promise<any> | void => {
    const validChannels = ["appweb"];

    if (validChannels.includes(channel)) {
      const pipe = commandName.indexOf("|");
      let position = -1;

      if (pipe >= 0) {
        position = parseInt(commandName.substring(pipe + 1, commandName.length));
        commandName = commandName.substring(0, pipe);
      }

      switch (commandName) {
        case "asyncopenFolder":
          ipcRenderer.invoke("asyncselectDirectory", position + "|" + data);
          return;

        case "asyncconvertFile":
          return ipcRenderer.invoke("asyncconvertFile", position + "|" + data);

        case "asyncstartWebSocketServer":
          return ipcRenderer.invoke("asyncstartWebSocketServer", position + "|" + data);

        case "asyncstopWebSocketServer":
          return ipcRenderer.invoke("asyncstopWebSocketServer", position + "|" + data);

        case "asyncstartDedicatedServer":
          return ipcRenderer.invoke("asyncstartDedicatedServer", position + "|" + data);

        case "asyncstopDedicatedServer":
          return ipcRenderer.invoke("asyncstopDedicatedServer", position + "|" + data);

        case "asyncdedicatedServerCommand":
          return ipcRenderer.invoke("asyncdedicatedServerCommand", position + "|" + data);

        case "asyncwebSocketCommand":
          return ipcRenderer.invoke("asyncwebSocketCommand", position + "|" + data);

        case "asyncshellOpenPath":
          _validateExecutableFilePath(data);

          return ipcRenderer.invoke("asyncshellOpenPath", position + "|" + data);

        case "asyncshellOpenFolderInExplorer":
          return ipcRenderer.invoke("asyncshellOpenFolderInExplorer", position + "|" + data);

        case "asyncminecraftShell":
          return ipcRenderer.invoke("asyncminecraftShell", position + "|" + data);

        case "asyncshellRecycleItem":
          _validateFilePath(data);

          return ipcRenderer.invoke("asyncshellRecycleItem", position + "|" + data);

        case "asyncreloadMct":
          return ipcRenderer.invoke("asyncreloadMct", position + "|" + data);

        case "asyncgetDedicatedServerProjectDir":
          return ipcRenderer.invoke("asyncgetDedicatedServerProjectDir", position + "|" + data);

        case "asyncgetDedicatedServerStatus":
          return ipcRenderer.invoke("asyncgetDedicatedServerStatus", position + "|" + data);

        case "asyncgetDedicatedServerWorldDir":
          return ipcRenderer.invoke("asyncgetDedicatedServerWorldDir", position + "|" + data);

        case "asyncgetMinecraftGameProjectDeployDir":
          return ipcRenderer.invoke("asyncgetMinecraftGameProjectDeployDir", position + "|" + data);

        case "asyncgetMinecraftGameWorldDeployDir":
          return ipcRenderer.invoke("asyncgetMinecraftGameWorldDeployDir", position + "|" + data);

        case "asyncwindowClose":
        case "asynclogToConsole":
        case "asyncwindowRestore":
        case "asyncwindowMinimize":
        case "asyncwindowMove":
        case "asyncwindowMaximize":
        case "asyncwindowUpdate":
        case "asyncwindowLeftSide":
        case "asyncwindowRightSide":
        case "asyncupdateIAgree":
        case "asyncgetWindowState":
        case "asyncgetPlatform":
        case "asyncgetDirname":
        case "asyncgetContentSources":
        case "asynccontentSourceLogin":
          return ipcRenderer.invoke(commandName, position + "|" + data);

        case "getIsDev":
          return ipcRenderer.invoke("getIsDev", data);

        case "asyncfsRenameFolder":
          _validateDoubleFolderPath(data);
          return ipcRenderer.invoke(commandName, position + "|" + data);

        case "asyncfsDeleteFolder":
          _validateFolderPath(data);
          return ipcRenderer.invoke(commandName, position + "|" + data);

        case "asyncfsExists":
        case "bsyncfsReadFile":
        case "asyncfsReadUtf8File":
          _validateFilePath(data);

          return ipcRenderer.invoke(commandName, position + "|" + data);

        case "asyncfsFolderExists":
        case "asyncfsRootStorageExists":
        case "asyncfsMkdir":
        case "asyncfsReaddir":
        case "asyncfsStat":
          _validateFolderPath(data);

          return ipcRenderer.invoke(commandName, position + "|" + data);

        case "asyncfsWriteFile":
        case "asyncfsWriteUtf8File":
          const writeFilePath = data.path;

          _validateFilePath(writeFilePath);

          return ipcRenderer.invoke(commandName, position + "|" + data.path + "|" + data.content);

        default:
          throw new Error("PLD: Unknown command: " + commandName);
      }
    }
  },
  receive: (channel: string, func: (...args: any[]) => void): void => {
    const validChannels = ["appsvc", "agent:event"];

    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (_event: Electron.IpcRendererEvent, ...args: any[]) => func(...args));
    }
  },
});
