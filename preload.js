const { contextBridge, ipcRenderer } = require("electron");

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
  "env",
  "gif",
  "wav",
  "tga",
  "env",
  "mjs",
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
];
const _allowedExecutableExtensions = ["mcstructure", "mcworld", "mctemplate", "mcaddon"];

function _getTypeFromName(name) {
  const nameW = name.trim().toLowerCase();

  const lastBackslash = nameW.lastIndexOf("\\");
  const lastSlash = nameW.lastIndexOf("/");

  const lastPeriod = nameW.lastIndexOf(".");

  if (lastPeriod < 0 || lastPeriod < lastSlash || lastPeriod < lastBackslash) {
    return "";
  }

  return nameW.substring(lastPeriod + 1, nameW.length);
}

function _canonicalizePath(path) {
  if (path[0] !== "<" || path[5] !== ">") {
    throw new Error("PLD: Unsupported canon path: " + path);
  }

  if (path.startsWith("<UDRP>") || path.startsWith("<UDLP>") || path.startsWith("<DOCP>")) {
    path = path.substring(6);
  } else {
    throw new Error("PLD: Unsupported canon path A: " + path);
  }

  return path;
}

function _validateFolderPath(path) {
  path = _canonicalizePath(path);
  // banned character combos
  if (path.indexOf("..") >= 0 || path.indexOf("\\\\") >= 0 || path.indexOf("//") >= 0) {
    throw new Error("Unsupported path combinations: " + path);
  }

  if (path.lastIndexOf(":") >= 2) {
    throw new Error("Unsupported drive location: " + path);
  }
}

function _validateFilePath(path) {
  _validateFolderPath(path);

  const extension = _getTypeFromName(path);

  if (!_allowedExtensions.includes(extension)) {
    throw new Error("PLD: Unsupported file type: " + path);
  }
}

function _validateExecutableFilePath(path) {
  _validateFolderPath(path);

  const extension = _getTypeFromName(path);

  if (!_allowedExecutableExtensions.includes(extension)) {
    throw new Error("PLD: Unsupported executable file type: " + path);
  }
}

contextBridge.exposeInMainWorld("api", {
  send: (channel, commandName, data) => {
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
        case "asyncgetDirname":
        case "asyncaugerLogin":
          return ipcRenderer.invoke(commandName, position + "|" + data);

        case "getIsDev":
          return ipcRenderer.invoke("getIsDev", data);

        case "asyncfsExists":
        case "bsyncfsReadFile":
        case "asyncfsReadUtf8File":
        case "asyncfsStat":
          _validateFilePath(data);

          return ipcRenderer.invoke(commandName, position + "|" + data);

        case "asyncfsFolderExists":
        case "asyncfsMkdir":
        case "asyncfsReaddir":
          _validateFolderPath(data);

          return ipcRenderer.invoke(commandName, position + "|" + data);

        case "asyncfsWriteFile":
        case "asyncfsWriteUtf8File":
          const writeFilePath = data.path;

          _validateFilePath(writeFilePath);

          return ipcRenderer.invoke(commandName, position + "|" + data.path + "|" + data.content);

        default:
          throw new Error();
      }
    }
  },
  receive: (channel, func) => {
    const validChannels = ["appsvc"];

    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
  },
});
