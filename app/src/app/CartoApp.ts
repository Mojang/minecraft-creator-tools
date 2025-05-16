// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import Carto from "./Carto";
import { MinecraftFlavor } from "./ICartoData";
import Database from "./../minecraft/Database";
import BrowserStorage from "./../storage/BrowserStorage";
import IStorage from "./../storage/IStorage";
import { EventDispatcher } from "ste-events";
import GitHubManager from "../github/GitHubManager";
import AppServiceProxy from "../core/AppServiceProxy";
import IFolder from "../storage/IFolder";
import StorageUtilities from "../storage/StorageUtilities";
import IMinecraft from "./IMinecraft";
import CartoCommands from "./CartoCommands";

export enum CartoThemeStyle {
  dark = 0,
  light = 1,
  highContrast = 2,
}

export enum HostType {
  web = 0,
  toolsNodejs = 1,
  electronNodeJs = 2,
  electronWeb = 3,
  vsCodeMainNodeJs = 4,
  vsCodeMainWeb = 5,
  vsCodeWebService = 6,
  vsCodeWebWeb = 7,
  webPlusServices = 8,
  testLocal = 9,
}

/// CartoApp mostly serves as a static app loader for the really-core Carto app object.
export default class CartoApp {
  private static _carto?: Carto;
  private static _onInitialized = new EventDispatcher<Carto, Carto>();
  private static _initializing = false;
  private static _initialized = false;
  public static isLocalNode = false;
  public static fullLocalStorage = false;
  public static hostType = HostType.web;
  public static hostManager?: any = undefined;
  public static theme: CartoThemeStyle = CartoThemeStyle.dark;
  public static contentRoot = "";
  public static projectPath = "";
  public static baseUrl = "";

  public static initialMode: string | null = null;
  public static modeParameter: string | null = null;

  public static postMessage: ((message: any) => void) | undefined;

  public static prefsStorage: IStorage | null = null;
  public static projectsStorage: IStorage | null = null;
  public static deploymentStorage: IStorage | null = null;
  public static previewDeploymentStorage: IStorage | null = null;
  public static worldStorage: IStorage | null = null;
  public static packStorage: IStorage | null = null;
  public static workingStorage: IStorage | null = null;

  public static generateCryptoRandomNumber: (toVal: number) => number;
  public static localFolderExists: ((path: string) => Promise<boolean>) | undefined;
  public static localFileExists: ((path: string) => Promise<boolean>) | undefined;
  public static ensureLocalFolder: ((path: string) => IFolder) | undefined;
  public static createMinecraft: ((flavor: MinecraftFlavor, carto: Carto) => IMinecraft | undefined) | undefined;
  public static canCreateMinecraft: ((flavor: MinecraftFlavor) => boolean) | undefined;

  private static _onMessage = new EventDispatcher<any, any>();

  public static get isNodeJs() {
    return false;
  }

  public static get isVsCode() {
    return false;
  }

  public static get isWeb() {
    return (
      this.hostType === HostType.webPlusServices ||
      this.hostType === HostType.web ||
      this.hostType === HostType.electronWeb
    );
  }

  public static get isAppServiceWeb() {
    return this.hostType === HostType.electronWeb || this.hostType === HostType.vsCodeMainWeb;
  }

  public static get onMessage() {
    return CartoApp._onMessage.asEvent();
  }

  public static get onInitialized() {
    return CartoApp._onInitialized.asEvent();
  }

  public static get carto(): Carto | undefined {
    return CartoApp._carto;
  }

  public static notifyNewMessage(source: any, message: any) {
    CartoApp._onMessage.dispatch(source, message);
  }

  public static setHostType(type: HostType) {
    this.hostType = type;
  }

  static init() {
    if (CartoApp._initializing || CartoApp._initialized) {
      return;
    }

    CartoApp._initializing = true;

    //@ts-ignore
    if (typeof g_contentRoot !== "undefined") {
      //@ts-ignore
      CartoApp.contentRoot = StorageUtilities.ensureEndsWithDelimiter(g_contentRoot);
    }

    //@ts-ignore
    if (typeof g_initialMode !== "undefined") {
      //@ts-ignore
      CartoApp.initialMode = g_initialMode;
    }

    //@ts-ignore
    if (typeof g_modeParameter !== "undefined") {
      //@ts-ignore
      CartoApp.modeParameter = g_modeParameter;
    }

    //@ts-ignore
    if (typeof g_projectPath !== "undefined") {
      //@ts-ignore
      CartoApp.projectPath = g_projectPath;
    }

    //@ts-ignore
    if (typeof g_baseUrl !== "undefined") {
      //@ts-ignore
      CartoApp.baseUrl = g_baseUrl;
    }

    AppServiceProxy.init();

    GitHubManager.init();

    Database.load();

    CartoCommands.registerCommonCommands();

    CartoApp.generateCryptoRandomNumber = (toVal) => {
      if (!CartoApp.carto || !CartoApp.carto.local) {
        throw new Error("Could not generate key.");
      }

      return CartoApp.carto.local.generateCryptoRandomNumber(toVal);
    };

    if (CartoApp.projectsStorage !== null && CartoApp.prefsStorage !== null) {
      // @ts-ignore
    } else if (typeof window !== "undefined") {
      CartoApp.prefsStorage = new BrowserStorage("mctprefs");
      CartoApp.projectsStorage = new BrowserStorage("mctprojects");

      CartoApp.deploymentStorage = new BrowserStorage("mctdeploy");
      CartoApp.workingStorage = new BrowserStorage("mctworking");
      CartoApp.worldStorage = new BrowserStorage("mctworlds");
      CartoApp.packStorage = new BrowserStorage("mctpacks");

      CartoApp.generateCryptoRandomNumber = (toVal) => {
        // @ts-ignore
        return window.crypto.getRandomValues(new Uint32Array(1))[0] % 16;
      };
    }

    if (CartoApp.prefsStorage === null || CartoApp.projectsStorage === null) {
      throw new Error("Unexpected uninitialized storage.");
    }

    CartoApp._carto = new Carto(
      CartoApp.prefsStorage,
      CartoApp.projectsStorage,
      CartoApp.deploymentStorage,
      CartoApp.previewDeploymentStorage,
      CartoApp.worldStorage,
      CartoApp.packStorage,
      CartoApp.workingStorage,
      CartoApp.contentRoot
    );

    if (CartoApp.ensureLocalFolder) {
      CartoApp._carto.ensureLocalFolder = CartoApp.ensureLocalFolder;
      CartoApp._carto.localFolderExists = CartoApp.localFolderExists;
      CartoApp._carto.localFileExists = CartoApp.localFileExists;
    }

    CartoApp._carto.createMinecraft = CartoApp.createMinecraft;
    CartoApp._carto.canCreateMinecraft = CartoApp.canCreateMinecraft;

    CartoApp._initialized = true;

    this._onInitialized.dispatch(CartoApp._carto, CartoApp._carto);
  }
}
