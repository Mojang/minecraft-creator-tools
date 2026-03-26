import { BrowserWindow, IpcMain, IpcMainInvokeEvent } from "electron";
import LocalEnvironment from "../local/LocalEnvironment";
import ElectronUtils from "./ElectronUtils";
import IContentSource from "../app/IContentSource";

export default class ContentSourceManager {
  _window: BrowserWindow;
  _ipcMain: IpcMain;
  _env: LocalEnvironment;
  _utils: ElectronUtils;
  _initialized: boolean = false;
  _contentSources: IContentSource[] = [];

  constructor(browserWindow: BrowserWindow, incomingIpcMain: IpcMain, env: LocalEnvironment, utils: ElectronUtils) {
    this._window = browserWindow;
    this._ipcMain = incomingIpcMain;
    this._env = env;
    this._utils = utils;
    this.getContentSources = this.getContentSources.bind(this);
    this._ipcMain.handle("asyncgetContentSources", this.getContentSources);
  }

  _init() {
    if (this._initialized) {
      return;
    }

    this._contentSources = [
      {
        id: "minecraftPEComMojang",
        localFolderPath: "<MCPE>",
      },
    ];

    this._initialized = true;
  }

  getContentSources(evt: IpcMainInvokeEvent, data: string) {
    if (!this._initialized) {
      this._init();
    }

    const slargs = data.split("|");

    let result = JSON.stringify(this._contentSources);

    this._window.webContents.send("appsvc", "asyncgetContentSources|" + slargs[0] + "|" + result.toString());
  }
}
