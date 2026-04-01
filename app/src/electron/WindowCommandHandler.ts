/**
 * Handles window management commands from the renderer process.
 *
 * This module manages window state (minimize, maximize, restore, side-dock)
 * and communicates state changes back to the renderer process via IPC.
 */

import { app, BrowserWindow, IpcMain, Screen, Display } from "electron";
import CreatorTools from "../app/CreatorTools";

export class WindowCommandHandler {
  displays: Display[] = [];
  window: BrowserWindow;
  ipcMain: IpcMain;
  screen: Screen;
  private _isPinnedToTop = false;
  private _creatorTools: CreatorTools;

  constructor(
    browserWindow: BrowserWindow,
    incomingIpcMain: IpcMain,
    incomingScreen: Screen,
    creatorTools: CreatorTools
  ) {
    this.window = browserWindow;
    this.ipcMain = incomingIpcMain;
    this.screen = incomingScreen;
    this._creatorTools = creatorTools;

    this.saveWindowStates = this.saveWindowStates.bind(this);

    this.windowClose = this.windowClose.bind(this);
    this.windowRestore = this.windowRestore.bind(this);
    this.windowMaximize = this.windowMaximize.bind(this);
    this.windowUpdate = this.windowUpdate.bind(this);
    this.windowMinimize = this.windowMinimize.bind(this);
    this.windowLeftSide = this.windowLeftSide.bind(this);
    this.windowRightSide = this.windowRightSide.bind(this);
    this.windowMove = this.windowMove.bind(this);
    this.getWindowState = this.getWindowState.bind(this);
    this.getPlatform = this.getPlatform.bind(this);
    this._applySideDock = this._applySideDock.bind(this);
    this.windowWasMoved = this.windowWasMoved.bind(this);
    this.windowWasResized = this.windowWasResized.bind(this);

    this.window.on("resized", this.windowWasResized);
    this.window.on("moved", this.windowWasMoved);

    this._loadSlots();

    this._applyValues();
  }

  private _loadSlots(): void {
    this.displays = this.screen.getAllDisplays();

    // sort displays from left to right.
    this.displays.sort((displayA, displayB) => {
      return displayA.bounds.x * 1000 + displayA.bounds.y - (displayB.bounds.x * 1000 + displayB.bounds.y);
    });

    if ((this._creatorTools as any).slot === undefined) {
      (this._creatorTools as any).slot = 0;
    }

    if ((this._creatorTools as any).slot >= this.displays.length * 2) {
      (this._creatorTools as any).slot = this.displays.length * 2 - 1;
    }

    if ((this._creatorTools as any).windowState === 3) {
      this._applySideDock();
    }
  }

  private _restoreFromSideDock(): void {
    this._undoPinToTop();
    this.window.setPosition(
      Math.floor((this._creatorTools as any).windowX),
      Math.floor((this._creatorTools as any).windowY)
    );
    this.window.setSize(
      Math.floor((this._creatorTools as any).windowWidth),
      Math.floor((this._creatorTools as any).windowHeight)
    );
  }

  private _restore(): void {
    if (this.window.isMaximized()) {
      this.window.unmaximize();
      this.window.restore();

      (this._creatorTools as any).windowState = 0;
    }
  }

  private _applyValues(): void {
    if ((this._creatorTools as any).windowX !== undefined && (this._creatorTools as any).windowY !== undefined) {
      this.window.setPosition(
        Math.floor((this._creatorTools as any).windowX),
        Math.floor((this._creatorTools as any).windowY)
      );
    }

    if (
      (this._creatorTools as any).windowWidth !== undefined &&
      (this._creatorTools as any).windowHeight !== undefined
    ) {
      this.window.setSize(
        Math.floor((this._creatorTools as any).windowWidth),
        Math.floor((this._creatorTools as any).windowHeight)
      );
    }
  }

  private _storeLastValues(): boolean {
    let isChanged = false;

    if ((this._creatorTools as any).windowState !== 3) {
      const pos = this.window.getPosition();

      if ((this._creatorTools as any).windowX !== pos[0]) {
        (this._creatorTools as any).windowX = pos[0];
        isChanged = true;
      }

      if ((this._creatorTools as any).windowY !== pos[1]) {
        (this._creatorTools as any).windowY = pos[1];
        isChanged = true;
      }

      const size = this.window.getSize();

      if ((this._creatorTools as any).windowWidth !== size[0]) {
        (this._creatorTools as any).windowWidth = size[0];
        isChanged = true;
      }

      if ((this._creatorTools as any).windowHeight !== size[1]) {
        (this._creatorTools as any).windowHeight = size[1];
        isChanged = true;
      }
    }

    return isChanged;
  }

  private _doPinToTop(): void {
    if (!this._isPinnedToTop) {
      this._isPinnedToTop = true;

      const level = "screen-saver";

      this.window.setAlwaysOnTop(this._isPinnedToTop, level);
    }
  }

  private _undoPinToTop(): void {
    this._isPinnedToTop = false;

    let level: "normal" | "screen-saver" = "normal";

    if (this._isPinnedToTop) {
      level = "screen-saver";
    }

    this.window.setAlwaysOnTop(this._isPinnedToTop, level);
  }

  private _applySideDock(): void {
    this._doPinToTop();

    const display = this.displays[Math.floor((this._creatorTools as any).slot / 2)];

    const workArea = display.workArea;

    if ((this._creatorTools as any).slot % 2 === 0) {
      // Left side - not implemented
    } else {
      this.window.setPosition(
        Math.floor(workArea.x + (workArea.width * 3) / 4),
        Math.floor(workArea.y + workArea.height / 6)
      );
      this.window.setSize(Math.floor(workArea.width / 4), Math.floor((workArea.height * 2) / 3));
    }
  }

  register(): void {
    this.ipcMain.handle("asyncwindowClose", this.windowClose);
    this.ipcMain.handle("asyncwindowRestore", this.windowRestore);
    this.ipcMain.handle("asyncwindowMaximize", this.windowMaximize);
    this.ipcMain.handle("asyncwindowUpdate", this.windowUpdate);
    this.ipcMain.handle("asyncwindowMinimize", this.windowMinimize);
    this.ipcMain.handle("asyncwindowLeftSide", this.windowLeftSide);
    this.ipcMain.handle("asyncwindowRightSide", this.windowRightSide);
    this.ipcMain.handle("asyncgetWindowState", this.getWindowState);
    this.ipcMain.handle("asyncgetPlatform", this.getPlatform);
    this.ipcMain.handle("asyncwindowMove", this.windowMove);
  }

  async getWindowState(_event: Electron.IpcMainInvokeEvent, data: string): Promise<void> {
    const slargs = data.split("|");

    let state = (this._creatorTools as any).windowState;

    if (this.window.isMinimized()) {
      state = 1;
    } else if (this.window.isMaximized()) {
      state = 2;
    }

    this.window.webContents.send("appsvc", "asyncgetWindowState|" + slargs[0] + "|" + state);
  }

  async getPlatform(_event: Electron.IpcMainInvokeEvent, data: string): Promise<void> {
    const slargs = data.split("|");

    // Returns 'darwin' for macOS, 'win32' for Windows, 'linux' for Linux
    const platform = process.platform;

    this.window.webContents.send("appsvc", "asyncgetPlatform|" + slargs[0] + "|" + platform);
  }

  async windowClose(_event: Electron.IpcMainInvokeEvent, data: string): Promise<void> {
    const slargs = data.split("|");

    this.window.webContents.send("appsvc", "asyncwindowClose|" + slargs[0] + "|");

    this.window.close();

    app.quit();
    app.exit(0);
  }

  async windowRestore(_event: Electron.IpcMainInvokeEvent, data: string): Promise<void> {
    const slargs = data.split("|");

    if (this.window.isMaximized()) {
      this.window.unmaximize();
    }

    this.window.restore();

    if ((this._creatorTools as any).windowState === 3) {
      this._restoreFromSideDock();
    }

    (this._creatorTools as any).windowState = 0;

    this._saveMct();

    this.window.webContents.send("appsvc", "asyncwindowRestore|" + slargs[0] + "|");
  }

  async windowLeftSide(_event: Electron.IpcMainInvokeEvent, data: string): Promise<void> {
    const slargs = data.split("|");

    if ((this._creatorTools as any).windowState !== 3) {
      this._restore();
      this._storeLastValues();

      this.setSlotFromClosest(10);

      (this._creatorTools as any).windowState = 3;
    } else {
      if ((this._creatorTools as any).slot > 0) {
        (this._creatorTools as any).slot--;
      }
    }

    this._applySideDock();
    this._saveMct();

    setTimeout(this._applySideDock.bind(this), 1);

    this.window.webContents.send("appsvc", "asyncwindowLeftSide|" + slargs[0] + "|");
  }

  async windowRightSide(_event: Electron.IpcMainInvokeEvent, data: string): Promise<void> {
    const slargs = data.split("|");

    if ((this._creatorTools as any).windowState !== 3) {
      this._restore();
      this._storeLastValues();

      this.setSlotFromClosest(1);

      (this._creatorTools as any).windowState = 3;
    } else {
      if ((this._creatorTools as any).slot < this.displays.length * 2) {
        (this._creatorTools as any).slot++;
      }
    }

    this._applySideDock();
    this._saveMct();

    setTimeout(this._applySideDock, 1);

    this.window.webContents.send("appsvc", "asyncwindowRightSide|" + slargs[0] + "|");
  }

  setSlotFromClosest(divisor: number): void {
    let slotCount = 0;
    let slotDist = 9999999;
    const pos = this.window.getPosition();
    const size = this.window.getSize();

    const x = pos[0] + size[0] / divisor;

    for (let i = 0; i < this.displays.length; i++) {
      const display = this.displays[i];
      const workArea = display.workArea;

      const leftX = Math.floor(workArea.x);
      const rightX = Math.floor(workArea.x + (workArea.width * 3) / 4);

      if (Math.abs(leftX - x) < slotDist) {
        slotCount = i * 2;
        slotDist = Math.abs(leftX - x);
      }

      if (Math.abs(rightX - x) < slotDist) {
        slotCount = i * 2 + 1;
        slotDist = Math.abs(rightX - x);
      }
    }

    (this._creatorTools as any).slot = slotCount;
  }

  async windowMaximize(_event: Electron.IpcMainInvokeEvent, data: string): Promise<void> {
    const slargs = data.split("|");

    if ((this._creatorTools as any).windowState === 3) {
      this._restoreFromSideDock();
    }

    this.window.maximize();
    (this._creatorTools as any).windowState = 2;
    this._saveMct();

    this.window.webContents.send("appsvc", "asyncwindowMaximize|" + slargs[0] + "|");
  }

  saveWindowStates(): void {
    if (this._storeLastValues()) {
      this._saveMct();
    }
  }

  windowWasMoved(): void {
    if ((this._creatorTools as any).windowState === 3) {
      (this._creatorTools as any).windowState = 0;
      this._undoPinToTop();
    }

    this.saveWindowStates();
  }

  windowWasResized(): void {
    if ((this._creatorTools as any).windowState === 3) {
      (this._creatorTools as any).windowState = 0;
      this._undoPinToTop();
    }

    this.saveWindowStates();
  }

  async windowUpdate(_event: Electron.IpcMainInvokeEvent, data: string): Promise<void> {
    const slargs = data.split("|");

    this.saveWindowStates();

    this.window.webContents.send("appsvc", "asyncwindowUpdate|" + slargs[0] + "|");
  }

  async windowMinimize(_event: Electron.IpcMainInvokeEvent, data: string): Promise<void> {
    const slargs = data.split("|");

    this.window.minimize();
    this._saveMct();

    this.window.webContents.send("appsvc", "asyncwindowMinimize|" + slargs[0] + "|");
  }

  async windowMove(_event: Electron.IpcMainInvokeEvent, data: string): Promise<void> {
    const slargs = data.split("|");

    if (slargs.length === 3) {
      const xPos = parseInt(slargs[1]);
      const yPos = parseInt(slargs[2]);

      const curPos = this.window.getPosition();

      this.window.setPosition(curPos[0] + xPos, curPos[1] + yPos);

      (this._creatorTools as any).windowX = xPos;
      (this._creatorTools as any).windowY = yPos;

      this._saveMct();
    }

    this.window.webContents.send("appsvc", "asyncwindowMove|" + slargs[0] + "|");
  }

  private _saveMct(): void {
    (this._creatorTools as any).save();

    if (this.window !== undefined) {
      this.window.webContents.send("appsvc", "mctSavedInAppService|");
    }
  }
}

export default WindowCommandHandler;
