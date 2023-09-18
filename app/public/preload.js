const { contextBridge, ipcRenderer } = require("electron");

const _allowedExtensions = [
  "js",
  "ts",
  "json",
  "md",
  "png",
  "jpg",
  "jpeg",
  "lang",
  "fsb",
  "map",
  "ogg",
  "tga",
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

const _fs = require("fs");
const _dirName = __dirname;

const remote = require("electron").remote;
const { app } = remote;

const _isDev = require("electron-is-dev");

function _arrayBufferToBase64(buffer) {
  var binary = "";
  const bytes = new Uint8Array(buffer);

  const len = bytes.byteLength;

  for (var i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary);
}

function _base64ToArrayBuffer(base64buffer) {
  const binary = atob(base64buffer);

  const arrayBuffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(arrayBuffer);

  const len = binary.length;

  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return arrayBuffer;
}

function _countChar(source, find) {
  let count = 0;

  let index = source.indexOf(find);

  while (index >= 0) {
    count++;

    index = source.indexOf(find, index + find.length);
  }

  return count;
}

// eslint-disable-next-line no-unused-vars
function _getLeafName(path) {
  let name = path;

  let lastSlash = name.lastIndexOf("/", path.length - 1);

  if (lastSlash >= 0) {
    name = name.substring(lastSlash + 1, name.length);
  }

  lastSlash = name.lastIndexOf("\\", path.length - 1);

  if (lastSlash >= 0) {
    name = name.substring(lastSlash + 1, name.length);
  }

  if (name.endsWith("/")) {
    name = name.substring(0, name.length - 1);
  }

  if (name.endsWith("\\")) {
    name = name.substring(0, name.length - 1);
  }

  return name;
}

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

function _validateFolderPath(path) {
  // banned character combos
  if (path.indexOf("..") >= 0 || path.indexOf("\\\\") >= 0 || path.indexOf("//") >= 0) {
    throw new Error("Unsupported path combinations: " + path);
  }

  if (path.lastIndexOf(":") >= 2) {
    throw new Error("Unsupported drive location: " + path);
  }

  const count = _countChar(path, "\\") + _countChar(path, "/");

  if (count < 3) {
    throw new Error("Unsupported base path: " + path);
  }
}

function _validateFilePath(path) {
  _validateFolderPath(path);

  const extension = _getTypeFromName(path);

  if (!_allowedExtensions.includes(extension)) {
    throw new Error("Unsupported file type: " + path);
  }
}

function _validateExecutableFilePath(path) {
  _validateFolderPath(path);

  const extension = _getTypeFromName(path);

  if (!_allowedExecutableExtensions.includes(extension)) {
    throw new Error("Unsupported executable file type: " + path);
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
          return ipcRenderer.invoke(commandName, position + "|" + data);

        case "getDirname":
          return _dirName;

        case "getIsDev":
          return _isDev;

        case "fsExistsSync":
          _validateFilePath(data);

          return _fs.existsSync(data);

        case "fsFolderExistsSync":
          const folderExistsResult = _fs.existsSync(data);

          if (folderExistsResult) {
            const statResult = _fs.statSync(data);

            if (statResult.isDirectory()) {
              return true;
            }
          }

          return false;

        case "fsMkdirSync":
          _validateFolderPath(data);

          return _fs.mkdirSync(data);

        case "fsReaddirSync":
          _validateFolderPath(data);

          let fsReadDirResult = undefined;

          try {
            fsReadDirResult = _fs.readdirSync(data);
          } catch (e) {}

          return fsReadDirResult;

        case "fsWriteFileSync":
          const writeFilePath = data.path;
          let writeFileContent = data.content;

          _validateFilePath(writeFilePath);

          writeFileContent = new DataView(_base64ToArrayBuffer(writeFileContent));

          return _fs.writeFileSync(writeFilePath, writeFileContent, (val) => {});

        case "fsReadFileSync":
          _validateFilePath(data);

          if (!_fs.existsSync(data)) {
            return undefined;
          }

          const readFileResult = _fs.readFileSync(data);

          return _arrayBufferToBase64(readFileResult);

        case "fsReadUtf8FileSync":
          _validateFilePath(data);

          if (!_fs.existsSync(data)) {
            return undefined;
          }

          return _fs.readFileSync(data, { encoding: "UTF8" }, (val) => {}); //, 'utf8');

        case "fsStatSync":
          _validateFilePath(data);

          const statResult = _fs.statSync(data);

          return {
            isDirectory: statResult.isDirectory(),
            isFile: statResult.isFile(),
            mtime: statResult.mtime,
            ctime: statResult.ctime,
            size: statResult.size,
          };

        case "fsWriteUtf8FileSync":
          const path = data.path;
          const content = data.content;

          _validateFilePath(path);

          return _fs.writeFileSync(path, content, { encoding: "utf8" });

        case "appGetPath":
          return app.getPath(data);

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
