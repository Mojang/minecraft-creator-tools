/**
 * Electron Main Process Entry Point
 *
 * ARCHITECTURE:
 * This is the main entry point for the Minecraft Creator Tools Electron app.
 * It orchestrates:
 * - App lifecycle (startup, squirrel events, single instance)
 * - Window creation and management
 * - IPC handler registration for renderer communication
 * - Command handlers for server, file system features
 *
 * COMMAND LINE ARGUMENTS:
 * - -h, --help: Show help
 * - -i <path>: Input path to open
 * - -o, --out <path>: Output path for exports
 * - -c, --cmd <command>: Run a specific command (exportworld, help)
 * - --storage <path>: Custom storage path for all app data
 *
 * APP MODES:
 * - APP_MODE_MAINAPP (0): Normal Minecraft Creator Tools
 * - APP_MODE_EXPORTWORLD (1): Export world command
 * - APP_MODE_ERRORHELP (99): Show help and exit
 * - APP_MODE_EXIT (100): Exit immediately
 */

import * as path from "path";
import {
  app,
  BrowserWindow,
  Tray,
  Menu,
  dialog,
  shell,
  ipcMain,
  globalShortcut,
  session,
  screen,
  MenuItemConstructorOptions,
  MenuItem,
  BaseWindow,
} from "electron";
// @ts-ignore - electron-squirrel-startup doesn't have type declarations
import squirrel from "electron-squirrel-startup";
import * as ChildProcess from "child_process";
import * as fs from "fs";

import CreatorToolsHost from "../app/CreatorToolsHost";
import Database from "../minecraft/Database";
import NodeStorage from "../local/NodeStorage";
import WindowCommandHandler from "./WindowCommandHandler";
import DedicatedServerCommandHandler from "./DedicatedServerCommandHandler";
import WebSocketCommandHandler from "./WebSocketCommandHandler";
import FileSystemCommandHandler from "./FileSystemCommandHandler";
import ContentSourceManager from "./ContentSourceManager";
import LocalCommandHandler from "./LocalCommandHandler";
import ElectronUtils from "./ElectronUtils";
import ContentLogWatcher from "../local/ContentLogWatcher";
import StorageUtilities from "../storage/StorageUtilities";
import LocalEnvironment from "../local/LocalEnvironment";
import Log from "../core/Log";

// Error handler for uncaught exceptions
function handleException(err: Error): void {
  Log.error(
    "Unfortunately, the application could not continue to run.\n\nApplication error:\n" +
      (err.message ? err.message : err.toString()) +
      "\n\nReturning to prompt.\n"
  );

  process.removeListener("uncaughtException", handleException);
  app.exit(9);
}

// Use production mode if packaged, or if ELECTRON_FORCE_PROD is set (for testing with built files)
const isDev = !app.isPackaged && process.env.ELECTRON_FORCE_PROD !== "true";

// Support custom dev URL override (e.g., ELECTRON_DEV_URL=http://localhost:3001)
const devUrl = process.env.ELECTRON_DEV_URL || "http://localhost:3000";

Log.debug(`[Electron] Mode: ${isDev ? "DEVELOPMENT" : "PRODUCTION"}`);
Log.debug(`[Electron] Loading from: ${isDev ? devUrl : "build/ assets"}`);

CreatorToolsHost.setHostType(2);

// Install extensions in dev mode
let installExtension: any;
let REACT_DEVELOPER_TOOLS: any;

if (isDev) {
  const devTools = require("electron-devtools-installer");
  installExtension = devTools.default;
  REACT_DEVELOPER_TOOLS = devTools.REACT_DEVELOPER_TOOLS;
} else {
  process.on("uncaughtException", handleException);
}

// Squirrel setup handling
const appFolder = path.resolve(process.execPath, "..");
const rootAtomFolder = path.resolve(appFolder, "..");
const updateDotExe = path.resolve(path.join(rootAtomFolder, "Update.exe"));
const exeName = path.basename(process.execPath);

function spawn(command: string, args: string[]): ChildProcess.ChildProcess | undefined {
  let spawnedProcess: ChildProcess.ChildProcess | undefined = undefined;

  try {
    spawnedProcess = ChildProcess.spawn(command, args, { detached: true });
  } catch (error) {
    Log.error("Error starting process: " + error);
  }

  return spawnedProcess;
}

function spawnUpdate(args: string[]): ChildProcess.ChildProcess | undefined {
  return spawn(updateDotExe, args);
}

function handleStartupEvent(): boolean {
  if (process.platform !== "win32") {
    return false;
  }

  const squirrelCommand = process.argv[1];

  switch (squirrelCommand) {
    case "--squirrel-install":
    case "--squirrel-updated":
      spawnUpdate(["--createShortcut", exeName]);
      setTimeout(app.quit, 1000);
      return true;

    case "--squirrel-uninstall":
      spawnUpdate(["--removeShortcut", exeName]);
      setTimeout(app.quit, 1000);
      return true;

    case "--squirrel-obsolete":
      app.quit();
      return true;

    default:
      return false;
  }
}

handleStartupEvent();

if (squirrel) {
  app.quit();
}

// App state
let _mainWindow: BrowserWindow | null = null;
let _commandHandler: WindowCommandHandler | null = null;
let _dedicatedServerCommandHandler: DedicatedServerCommandHandler | null = null;
let _webSocketCommandHandler: WebSocketCommandHandler | null = null;
let _fileSystemCommandHandler: FileSystemCommandHandler | null = null;
let _contentSourceManager: ContentSourceManager | null = null;
let _localCommandHandler: LocalCommandHandler | null = null;

let _tray: Tray | null = null;
let _appIsReady = false;
let _creatorToolsIsReady = false;

let _inputPath: string | null = null;
let _outPath: string | null = null;
let _oper: string | null = null;
let _appFolderNameLong = "Minecraft Creator Tools";
let _appFolderNameShort = "mctools";
let _contentLogger: ContentLogWatcher | undefined = undefined;
let _creatorTools: any = undefined;
let _env: LocalEnvironment | undefined = undefined;
let _utils: ElectronUtils | undefined = undefined;
let _customStoragePath: string | undefined = undefined;

const APP_MODE_MAINAPP = 0;
const APP_MODE_EXPORTWORLD = 1;
const APP_MODE_ERRORHELP = 99;
const APP_MODE_EXIT = 100;

let _mode = APP_MODE_MAINAPP;

const _appLock = app.requestSingleInstanceLock({ mode: _mode, initTime: new Date().getTime() });

parseCommandLineArgs();

/**
 * Get the base storage path for the app.
 */
function _getStorageBasePath(): string {
  if (_customStoragePath) {
    let storagePath = _customStoragePath;
    if (!storagePath.endsWith(NodeStorage.slashFolderDelimiter)) {
      storagePath += NodeStorage.slashFolderDelimiter;
    }
    Log.debug("[Electron] Using custom storage path from --storage:", storagePath);
    return storagePath;
  }

  const testStorageRoot = process.env.MCT_TEST_STORAGE_ROOT;
  if (testStorageRoot) {
    let storagePath = testStorageRoot;
    if (!storagePath.endsWith(NodeStorage.slashFolderDelimiter)) {
      storagePath += NodeStorage.slashFolderDelimiter;
    }
    Log.debug("[Electron] Using test storage from MCT_TEST_STORAGE_ROOT:", storagePath);
    return storagePath;
  }

  return (
    app.getPath("documents") + NodeStorage.slashFolderDelimiter + _appFolderNameLong + NodeStorage.slashFolderDelimiter
  );
}

function _getCreatorTools(): any {
  const basePath = _getStorageBasePath();
  Log.debug("[Electron] Storage base path:", basePath);

  CreatorToolsHost.prefsStorage = new NodeStorage(basePath + "prefs" + NodeStorage.slashFolderDelimiter, "");

  CreatorToolsHost.projectsStorage = new NodeStorage(basePath + "projects" + NodeStorage.slashFolderDelimiter, "");

  CreatorToolsHost.packStorage = new NodeStorage(basePath + "packs" + NodeStorage.slashFolderDelimiter, "");

  CreatorToolsHost.worldStorage = new NodeStorage(basePath + "worlds" + NodeStorage.slashFolderDelimiter, "");

  CreatorToolsHost.init();

  const ct = CreatorToolsHost.getCreatorTools();

  if (ct) {
    ct.local = _env!.utilities;
  }

  return ct;
}

async function _load(): Promise<void> {
  _env = new LocalEnvironment(true);
  _env.setWorldContainerPath(_getStorageBasePath() + "worlds" + path.sep);
  _env.utilities.setProductNameSeed(_appFolderNameShort);

  await _env.load();

  _utils = new ElectronUtils(_env);

  _creatorTools = _getCreatorTools();

  await _creatorTools.load();

  _contentLogger = new ContentLogWatcher(_env);

  Database.local = _env.utilities;

  _creatorToolsIsReady = true;

  _creatorTools.onStatusAdded.subscribe(_handleStatusAdded);

  _startWindow();
}

_load();

if (!_appLock) {
  Log.debug("App is already running; exiting this instance.");
  app.quit();
  _mode = APP_MODE_EXIT;
} else {
  app.on("second-instance", (_event, _commandLine, _workingDirectory, _additionalData) => {
    if (_mainWindow) {
      if (_mainWindow.isMinimized()) {
        _mainWindow.restore();
      }
      _mainWindow.focus();
    }
  });
}

function _handleStatusAdded(_carto: any, statusItem: any): void {
  Log.debug("Server Manager: " + statusItem.message);

  if (_mainWindow !== null && _mainWindow !== undefined) {
    _mainWindow.webContents.send("appsvc", "statusMessage|" + JSON.stringify(statusItem));
  }
}

function parseCommandLineArgs(): void {
  // In Electron, process.argv looks like:
  // [0] = path to electron executable
  // [1] = path to main script (e.g., main.mjs)
  // [2+] = actual user arguments
  // We need to skip argv[1] when checking for positional input path
  const argsStartIndex = app.isPackaged ? 1 : 2; // Packaged app doesn't have main script in argv

  for (let i = 1; i < process.argv.length; i++) {
    const val = process.argv[i].toLowerCase();

    if (val.length >= 2 && (val.startsWith("-") || val.startsWith("/"))) {
      let arg = val.substring(1, val.length);

      if (arg.startsWith("-")) {
        arg = arg.substring(1, arg.length);
      }

      switch (arg) {
        case "h":
        case "?":
        case "help":
          _mode = APP_MODE_ERRORHELP;
          break;

        case "cmd":
        case "c":
          if (i < process.argv.length - 1) {
            i++;
            _oper = process.argv[i];
          }
          break;

        case "i":
          if (i < process.argv.length - 1) {
            i++;
            _inputPath = process.argv[i];
          }
          break;

        case "outpath":
        case "o":
        case "out":
          if (i < process.argv.length - 1) {
            i++;
            _outPath = process.argv[i];
          }
          break;

        case "storage":
          if (i < process.argv.length - 1) {
            i++;
            _customStoragePath = process.argv[i];
          }
          break;
        default:
          break;
      }
    } else {
      // Only treat as input path if it's the first user argument (after main script)
      // and it's not the "." argument used in dev mode
      if (i === argsStartIndex && process.argv[i] !== ".") {
        _inputPath = process.argv[i];
      }
    }
  }

  if (_oper != null) {
    switch (_oper.toLowerCase()) {
      case "help":
        _mode = APP_MODE_ERRORHELP;
        break;

      case "exportworld":
        if (_inputPath !== null && _outPath !== null) {
          Log.debug("Running export world command - from '" + _inputPath + "' to '" + _outPath + "'");
          _mode = APP_MODE_EXPORTWORLD;
        }
        break;

      default:
        break;
    }

    if (_mode === APP_MODE_MAINAPP) {
      _mode = APP_MODE_ERRORHELP;
    }
  }

  if (_mode === APP_MODE_ERRORHELP) {
    console.log("Usage: mct <input path> -cmd [command name] <additional arguments>");
    console.log("\nArguments:");
    console.log("  <input path>   Path to the input file or folder");
    console.log("\nCommands:");
    console.log("  server");
    console.log("    Runs the app in server management only mode.");
    console.log("");
    console.log("  exportworld");
    console.log("    Exports a starter world for a given behavior pack.");
    console.log("    Arguments for 'exportworld' commands");
    console.log("    -folder=<inputFolderPath> Input folder to read from");
    console.log("    -world=<output MC World file> MCWorld file to export");
    console.log("");

    app.quit();
    app.exit(0);
  } else if (_mode !== APP_MODE_EXIT) {
    app.whenReady().then(() => {
      if (!_appIsReady) {
        session.defaultSession.webRequest.onBeforeSendHeaders(
          {
            urls: ["*://*.npmjs.org/*"],
          },
          (details, callback) => {
            details.requestHeaders["Origin"] = "";
            callback({ requestHeaders: details.requestHeaders });
          }
        );
      }
      _appIsReady = true;
      _startWindow();
    });
  }
}

function _startWindow(): void {
  if (_creatorToolsIsReady && _appIsReady && _mode === APP_MODE_MAINAPP) {
    _createTrayIcon();

    _createMainAppWindow();

    _contentLogger?.watchMinecraftReleaseFolder();

    if (isDev) {
      installExtension(REACT_DEVELOPER_TOOLS)
        .then((name: any) => Log.debug("Added Extension:  " + JSON.stringify(name)))
        .catch((error: any) => Log.error("An error occurred: " + error));
    }

    _registerShortcuts();
  }
}

function _createMainAppWindow(): void {
  const x = _creatorTools.windowX;
  const y = _creatorTools.windowY;
  let center = false;

  if (x === 0 && y === 0) {
    center = true;
  }

  const isMac = process.platform === "darwin";

  _mainWindow = new BrowserWindow({
    width: _creatorTools.windowWidth,
    height: _creatorTools.windowHeight,
    x: x,
    y: y,
    center: center,
    frame: false,
    titleBarStyle: isMac ? "hiddenInset" : "hidden",
    trafficLightPosition: isMac ? { x: 16, y: 12 } : undefined,
    webPreferences: {
      nodeIntegration: false,
      nodeIntegrationInSubFrames: false,
      preload: path.join(__dirname, "preload.js"),
      nodeIntegrationInWorker: false,
      contextIsolation: true,
    },
    icon: path.join(__dirname, "..", "..", "..", "build", "favicon.ico"),
  });

  if (_creatorTools.windowState === 2) {
    _mainWindow.maximize();
  }

  if (_commandHandler === null) {
    _commandHandler = new WindowCommandHandler(_mainWindow, ipcMain, screen, _creatorTools);
    _commandHandler.register();
  }

  if (_dedicatedServerCommandHandler === null) {
    _dedicatedServerCommandHandler = new DedicatedServerCommandHandler(
      _mainWindow,
      ipcMain,
      _env!,
      _creatorTools,
      _utils!
    );
  }

  if (_webSocketCommandHandler === null) {
    _webSocketCommandHandler = new WebSocketCommandHandler(_mainWindow, ipcMain, _env!);
  }

  if (_fileSystemCommandHandler === null) {
    _fileSystemCommandHandler = new FileSystemCommandHandler(_mainWindow, ipcMain, _creatorTools, _env!, _utils!);
  }

  if (_contentSourceManager === null) {
    _contentSourceManager = new ContentSourceManager(_mainWindow, ipcMain, _env!, _utils!);
  }

  if (_localCommandHandler === null) {
    _localCommandHandler = new LocalCommandHandler(_mainWindow, ipcMain, _env!, _utils!);
  }

  _commandHandler.window = _mainWindow;

  let indexHtmlPath = isDev
    ? `${devUrl}?debug=true`
    : `file://${path.join(__dirname, "..", "..", "..", "build", "index.html")}`;

  let addedHash = false;

  if (_inputPath !== null) {
    if (!addedHash) {
      indexHtmlPath += "#";
      addedHash = true;
    } else {
      indexHtmlPath += "&";
    }

    // Resolve input path relative to app root (3 levels up from toolbuild/jsn/electron/)
    const appRoot = path.join(__dirname, "..", "..", "..");
    let currentPath = path.resolve(appRoot, _inputPath);

    if (fs.existsSync(currentPath)) {
      const statResult = fs.statSync(currentPath);

      currentPath = StorageUtilities.canonicalizePath(currentPath);

      if (statResult.isDirectory()) {
        currentPath = StorageUtilities.ensureEndsWithDelimiter(currentPath);
      }

      const splitPath = StorageUtilities.getRootAndFocusPathFromInputPath(currentPath);

      const targetPath =
        StorageUtilities.ensureEndsWithDelimiter("<pt_" + _utils!.ensureMappingForPath(splitPath.basePath) + ">") +
        (splitPath.focusPath ? StorageUtilities.ensureNotStartsWithDelimiter(splitPath.focusPath) : "");

      indexHtmlPath += "input=" + encodeURIComponent(targetPath);
    } else {
      Log.debug("Input path does not exist appear to exist: " + currentPath);
    }
  }

  _mainWindow.loadURL(indexHtmlPath);

  if (isDev) {
    _mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    Menu.setApplicationMenu(null);
  }

  _mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.toLowerCase().startsWith("https://")) {
      shell.openExternal(url);
    }

    return { action: "deny" };
  });
}

function _createTrayIcon(): void {
  try {
    const iconName = process.platform === "win32" ? "favicon.ico" : "favicon-32x32.png";
    const iconPath = path.join(__dirname, "..", "..", "..", "build", iconName);

    _tray = new Tray(iconPath);

    _tray.on("click", _handleTrayClick);

    _tray.setToolTip("Minecraft Creator Tools");
    _rebuildTrayMenu();
  } catch (err: any) {
    Log.debug("Failed to create tray icon: " + err.message);
    _tray = null;
  }
}

function _rebuildTrayMenu(): void {
  if (!_creatorTools || !_tray) {
    return;
  }

  const tools: MenuItemConstructorOptions[] = [];
  let addedCustomSep = false;
  tools.push({ id: "deploy", label: "Deploy", click: _handleDeployClick });
  tools.push({ id: "sepA", type: "separator" });
  tools.push({ id: "pinToTop", label: "Pin to top", click: _pinToTop, type: "checkbox" });
  tools.push({ id: "viewMode", label: "Change View Mode", click: _changeViewMode });

  for (let i = 0; i < 9; i++) {
    const ctool = _creatorTools.getCustomTool(i);

    if (ctool && ctool.text) {
      let name = ctool.name;

      if (!name) {
        name = "Tool " + (i + 1).toString();
      }

      let command: (() => void) | undefined = undefined;
      switch (i) {
        case 1:
          command = _sendCommand1;
          break;
        case 2:
          command = _sendCommand2;
          break;
        case 3:
          command = _sendCommand3;
          break;
        case 4:
          command = _sendCommand4;
          break;
        case 5:
          command = _sendCommand5;
          break;
        case 6:
          command = _sendCommand6;
          break;
        case 7:
          command = _sendCommand7;
          break;
        case 8:
          command = _sendCommand8;
          break;
        case 9:
          command = _sendCommand9;
          break;
        default:
          command = _sendCommand0;
      }

      if (!addedCustomSep) {
        tools.push({ id: "sepB", type: "separator" });
        addedCustomSep = true;
      }

      tools.push({
        id: "tool" + i,
        label: "Ctrl-" + (i + 1).toString() + ": " + name,
        click: command,
      });
    }
  }
  _tray.setContextMenu(Menu.buildFromTemplate(tools));
}

function _registerShortcuts(): void {
  globalShortcut.register("CommandOrControl+`", _sendFocus);
  globalShortcut.register("CommandOrControl+1", _sendCommand1);
  globalShortcut.register("CommandOrControl+2", _sendCommand2);
  globalShortcut.register("CommandOrControl+3", _sendCommand3);
  globalShortcut.register("CommandOrControl+4", _sendCommand4);
  globalShortcut.register("CommandOrControl+5", _sendCommand5);
  globalShortcut.register("CommandOrControl+6", _sendCommand6);
  globalShortcut.register("CommandOrControl+7", _sendCommand7);
  globalShortcut.register("CommandOrControl+8", _sendCommand8);
  globalShortcut.register("CommandOrControl+9", _sendCommand9);
  globalShortcut.register("CommandOrControl+0", _sendCommand0);
}

function _sendFocus(): void {
  _mainWindow?.focus();
}

function _sendCommand1(): void {
  _sendCommand(1);
}
function _sendCommand2(): void {
  _sendCommand(2);
}
function _sendCommand3(): void {
  _sendCommand(3);
}
function _sendCommand4(): void {
  _sendCommand(4);
}
function _sendCommand5(): void {
  _sendCommand(5);
}
function _sendCommand6(): void {
  _sendCommand(6);
}
function _sendCommand7(): void {
  _sendCommand(7);
}
function _sendCommand8(): void {
  _sendCommand(8);
}
function _sendCommand9(): void {
  _sendCommand(9);
}
function _sendCommand0(): void {
  _sendCommand(10);
}

let _isPinnedToTop = false;

function _pinToTop(): void {
  _isPinnedToTop = !_isPinnedToTop;

  let level: "normal" | "screen-saver" = "normal";

  if (_isPinnedToTop) {
    level = "screen-saver";
  }

  _mainWindow?.setAlwaysOnTop(_isPinnedToTop, level);
}

function _changeViewMode(): void {}

function _sendCommand(index: number): void {
  if (_mainWindow !== null && _mainWindow !== undefined) {
    _mainWindow.webContents.send("appsvc", "externalKeyPress|command" + index);
  }
}

function _handleTrayClick(): void {
  if (_mainWindow === null) {
    return;
  }

  _mainWindow.isVisible() ? _mainWindow.hide() : _mainWindow.show();
}

function _handleDeployClick(
  _menuItem: MenuItem,
  _window: BaseWindow | undefined,
  _event: Electron.KeyboardEvent
): void {
  Log.debug("Deploying..");
}

async function minecraftShell(_event: Electron.IpcMainInvokeEvent, data: string): Promise<void> {
  const slargs = data.split("|");

  const command = slargs[1];

  Log.debug("Running command: minecraft://" + command);

  shell.openExternal("minecraft://" + command);

  _mainWindow?.webContents.send("appsvc", "asyncminecraftShellComplete|" + slargs[0] + "|");
}

if (_mode !== APP_MODE_ERRORHELP && _mode !== APP_MODE_EXIT) {
  ipcMain.handle("asyncminecraftShell", minecraftShell);

  async function selectDirectory(_event: Electron.IpcMainInvokeEvent, data: string): Promise<void> {
    const slargs = data.split("|");

    const results = await dialog.showOpenDialog(_mainWindow!, {
      properties: ["openDirectory"],
    });

    const tokPaths: string[] = [];

    if (results.filePaths) {
      for (const filePath of results.filePaths) {
        tokPaths.push("<pt_" + _utils!.ensureMappingForPath(filePath) + ">");
      }
    }

    _mainWindow?.webContents.send("appsvc", "asyncselectDirectoryComplete|" + slargs[0] + "|" + tokPaths);
  }

  ipcMain.handle("asyncselectDirectory", selectDirectory);

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      _createMainAppWindow();
    }
  });

  async function recycleItem(_event: Electron.IpcMainInvokeEvent, data: string): Promise<void> {
    const slargs = data.split("|");

    const itemPath = _utils!.deTokenizePath(slargs[1]);

    if (!itemPath) {
      _mainWindow?.webContents.send("appsvc", "asyncshellRecycleItemComplete|" + slargs[0] + "|Invalid path");
      return;
    }

    _utils!.validateFilePath(itemPath);

    Log.debug("Recycling item '" + itemPath + "'");

    let result = "";

    try {
      await shell.trashItem(itemPath);
    } catch (e: any) {
      result = e.toString();
    }

    _mainWindow?.webContents.send("appsvc", "asyncshellRecycleItemComplete|" + slargs[0] + "|" + result);
  }
  ipcMain.handle("asyncshellRecycleItem", recycleItem);

  async function reloadMct(_event: Electron.IpcMainInvokeEvent, data: string): Promise<void> {
    const slargs = data.split("|");

    await _creatorTools.load(true);

    _rebuildTrayMenu();

    _mainWindow?.webContents.send("appsvc", "asyncreloadMctComplete|" + slargs[0] + "|");
  }

  ipcMain.handle("asyncreloadMct", reloadMct);

  async function openPath(_event: Electron.IpcMainInvokeEvent, data: string): Promise<void> {
    const slargs = data.split("|");

    const itemPath = _utils!.deTokenizePath(slargs[1]);

    if (!itemPath) {
      _mainWindow?.webContents.send("appsvc", "asyncshellOpenPathComplete|" + slargs[0] + "|Invalid path");
      return;
    }

    _utils!.validateExecutableFilePath(itemPath);

    const result = await shell.openPath(itemPath);

    _mainWindow?.webContents.send("appsvc", "asyncshellOpenPathComplete|" + slargs[0] + "|" + result);
  }

  ipcMain.handle("asyncshellOpenPath", openPath);

  async function openFolderInExplorer(_event: Electron.IpcMainInvokeEvent, data: string): Promise<void> {
    const slargs = data.split("|");

    const folderPath = _utils!.deTokenizePath(slargs[1]);

    if (!folderPath) {
      _mainWindow?.webContents.send("appsvc", "asyncshellOpenFolderInExplorerComplete|" + slargs[0] + "|");
      return;
    }

    const result = await shell.openPath(folderPath);

    const tok = _utils!.ensureMappingForPath(result);

    let resultStr = "asyncshellOpenFolderInExplorerComplete|" + slargs[0] + "|<pt_" + tok + ">";

    _mainWindow?.webContents.send("appsvc", resultStr);
  }

  ipcMain.handle("asyncshellOpenFolderInExplorer", openFolderInExplorer);

  async function logToConsole(_event: Electron.IpcMainInvokeEvent, data: string): Promise<void> {
    const firstPipe = data.indexOf("|");

    if (firstPipe >= 0) {
      Log.debug("UX: " + data.substring(firstPipe + 1, data.length));
    }

    _mainWindow?.webContents.send("appsvc", "asynclogToConsoleComplete|" + data[0] + "|");
  }

  ipcMain.handle("asynclogToConsole", logToConsole);
}
