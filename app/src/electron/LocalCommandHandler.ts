import { BrowserWindow, IpcMain, IpcMainInvokeEvent } from "electron";
import LocalEnvironment from "../local/LocalEnvironment";
import ElectronUtils from "./ElectronUtils";
import Utilities from "../core/Utilities";
import IConversionSettings from "../core/IConversionSettings";

export default class LocalCommandHandler {
  _window;
  _ipcMain;
  _env;

  constructor(browserWindow: BrowserWindow, incomingIpcMain: IpcMain, env: LocalEnvironment, utils: ElectronUtils) {
    this._window = browserWindow;
    this._ipcMain = incomingIpcMain;
    this._env = env;

    this.convertFile = this.convertFile.bind(this);

    this._ipcMain.handle("asyncconvertFile", this.convertFile);
  }

  async convertFile(evt: IpcMainInvokeEvent, data: string) {
    const slargs = data.split("|");

    const serverState = slargs[1];

    console.log("Converting: " + data);
    const req = this.convertStringToConversionSettings(serverState);

    let commandResult = false;

    if (req === undefined) {
      console.log("No conversion data was specified.");
    } else {
      const result = await this._env.utilities.processConversion(req);

      if (!result) {
        this._window.webContents.send("appsvc", "convertFileError|Could not process a conversion request.");
      } else {
        commandResult = true;
      }
    }

    this._window.webContents.send("appsvc", "asyncconvertFileComplete|" + slargs[0] + "|");
  }

  convertStringToConversionSettings(serverState: string) {
    let req: IConversionSettings | undefined = undefined;

    if (serverState !== "") {
      req = Utilities.parseJson(serverState) as IConversionSettings;
    }

    return req;
  }
}
