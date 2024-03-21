// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IAppServiceChannel from "./IAppServiceChannel";
import Utilities from "./../core/Utilities";
import Log, { LogItem } from "./../core/Log";
import { EventDispatcher } from "ste-events";
import CartoApp, { HostType } from "../app/CartoApp";

export enum AppServiceProxyCommands {
  fsExistsSync = "fsExistsSync",
  fsFolderExistsSync = "fsFolderExistsSync",
  fsMkdirSync = "fsMkdirSync",
  fsReadUtf8FileSync = "fsReadUtf8FileSync",
  fsReadFileSync = "fsReadFileSync",
  fsWriteUtf8FileSync = "fsWriteUtf8FileSync",
  fsWriteFileSync = "fsWriteFileSync",
  fsReaddirSync = "fsReaddirSync",
  fsStatSync = "fsStatSync",
  getDirname = "getDirname",
  getDedicatedServerStatus = "getDedicatedServerStatus",
  getDedicatedServerProjectDeployDir = "getDedicatedServerProjectDir",
  getDedicatedServerWorldDeployDir = "getDedicatedServerWorldDir",
  getMinecraftGameProjectDeployDir = "getMinecraftGameProjectDeployDir",
  getMinecraftGameWorldDeployDir = "getMinecraftGameWorldDeployDir",
  getIsDev = "getIsDev",
  openFolder = "openFolder",
  shellOpenPath = "shellOpenPath",
  shellOpenFolderInExplorer = "shellOpenFolderInExplorer",
  webSocketCommand = "webSocketCommand",
  dedicatedServerCommand = "dedicatedServerCommand",
  startWebSocketServer = "startWebSocketServer",
  stopWebSocketServer = "stopWebSocketServer",
  startDedicatedServer = "startDedicatedServer",
  stopDedicatedServer = "stopDedicatedServer",
  shellRecycleItem = "shellRecycleItem",
  reloadMct = "reloadMct",
  minecraftShell = "minecraftShell",
  windowClose = "windowClose",
  windowRestore = "windowRestore",
  windowMove = "windowMove",
  logToConsole = "logToConsole",
  windowMinimize = "windowMinimize",
  windowMaximize = "windowMaximize",
  windowUpdate = "windowUpdate",
  windowLeftSide = "windowLeftSide",
  windowRightSide = "windowRightSide",
  getWindowState = "getWindowState",
  appGetPath = "appGetPath",
  updateIAgree = "updateIAgree",
}

export default class AppServiceProxy {
  static _api: IAppServiceChannel | undefined;
  static _pendingPromiseResolvers: ((value: string | PromiseLike<string>) => void)[] = [];
  static _pendingPromiseRejecters: ((reason?: any) => void)[] = [];

  private static _onMessage = new EventDispatcher<string, string>();

  public static get onMessage() {
    return AppServiceProxy._onMessage.asEvent();
  }

  static get hasAppService() {
    return AppServiceProxy._api !== undefined;
  }

  static get hasAppServiceOrDebug() {
    return AppServiceProxy._api !== undefined || Utilities.isDebug;
  }

  static init() {
    // @ts-ignore
    if (typeof window !== "undefined") {
      // @ts-ignore
      AppServiceProxy._api = (window as any).api;

      if (
        AppServiceProxy._api &&
        CartoApp.hostType !== HostType.vsCodeMainWeb &&
        CartoApp.hostType !== HostType.vsCodeWebWeb
      ) {
        CartoApp.hostType = HostType.electronWeb;
      }
    }

    if (AppServiceProxy._api !== undefined) {
      AppServiceProxy._api.receive("appsvc", AppServiceProxy._handleNewMessage);
      Log.onItemAdded.subscribe(AppServiceProxy._handleLog);
    }
  }

  static _handleLog(log: Log, item: LogItem) {
    AppServiceProxy.logToConsole(item.message);
  }

  static async logToConsole(message: string) {
    await AppServiceProxy.sendAsync(AppServiceProxyCommands.logToConsole, message);
  }

  static send(commandName: AppServiceProxyCommands | string, data: any) {
    if (AppServiceProxy._api === undefined) {
      throw new Error("Not an Electron API");
    }

    if (commandName === AppServiceProxyCommands.fsWriteFileSync) {
      let content = data.content;

      if (content instanceof Uint8Array) {
        content = Utilities.uint8ArrayToBase64(content);
      } else if (data instanceof ArrayBuffer) {
        content = Utilities.arrayBufferToBase64(content);
      } else if (
        data instanceof Uint16Array ||
        data instanceof Uint32Array ||
        data instanceof Uint8ClampedArray ||
        data instanceof BigUint64Array
      ) {
        Log.fail("Unsupported binary type encountered." + data);
      }

      data.content = content;
    }

    let result: any = undefined;

    try {
      result = AppServiceProxy._api.send("appweb", commandName as string, data);
    } catch (e) {
      let dataStr = data;

      if (typeof data === "object") {
        dataStr = JSON.stringify(data);
      }

      throw new Error("Error running command " + commandName + ", data: " + dataStr + ", error: " + e);
    }

    if (commandName === AppServiceProxyCommands.fsReadFileSync) {
      if (result === undefined || result.length === 0) {
        return undefined;
      }

      return Utilities.base64ToArrayBuffer(result);
    }

    return result;
  }

  static sendAsync(commandName: AppServiceProxyCommands | string, data: any): Promise<string> {
    if (AppServiceProxy._api === undefined) {
      throw new Error("Not an Electron API");
    }

    const promise = new Promise<string>(AppServiceProxy._stringPromiseHandler);
    const position = AppServiceProxy._pendingPromiseResolvers.length - 1;

    const commandStr = "async" + (commandName as string) + "|" + position;

    // Log.verbose("Sending async command '" + commandStr + "' + data: " + data);

    AppServiceProxy._api.send("appweb", commandStr, data);

    return promise;
  }

  static sendHost(serviceName: string, commandName: AppServiceProxyCommands | string, data: any) {
    if (AppServiceProxy._api === undefined) {
      throw new Error("Not an Electron API");
    }

    if (typeof data === "object") {
      data = JSON.stringify(data);
    } else if (typeof data !== "string") {
      data = data.toString();
    }

    AppServiceProxy._api.send(serviceName, commandName, data);
  }

  static openLinkExternal(url: string) {
    try {
      // @ts-ignore
      if (typeof window !== "undefined") {
        // @ts-ignore
        (window as any).open(url, "_blank");
      }
    } catch (e) {}
  }

  private static _stringPromiseHandler(
    resolve: (value: string | PromiseLike<string>) => void,
    reject: (reason?: any) => void
  ) {
    const position = AppServiceProxy._pendingPromiseResolvers.length;

    AppServiceProxy._pendingPromiseResolvers[position] = resolve;
    AppServiceProxy._pendingPromiseRejecters[position] = reject;
  }

  private static _handleNewMessage(args: string) {
    // Log.verbose("New message inbound: '" + args + "'");
    if (args !== null && args.length > 0) {
      if (args.startsWith("async")) {
        const argSplit = args.split("|");

        if (argSplit.length > 2) {
          const index = parseInt(argSplit[1]);

          if (index >= 0) {
            const promiseResolver = AppServiceProxy._pendingPromiseResolvers[index];

            // NOTE: Since logging goes from browser to client and then async is complete,
            // DO NOT log inside of here or otherwise you may cause a loop.

            promiseResolver(argSplit[2]);
          }
        }
      } else {
        const firstPipe = args.indexOf("|");

        if (firstPipe >= 0) {
          AppServiceProxy._onMessage.dispatch(args.substring(0, firstPipe), args.substring(firstPipe + 1, args.length));
        }
      }
    }
  }
}
