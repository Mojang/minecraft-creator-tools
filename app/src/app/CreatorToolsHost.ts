// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import CreatorTools from "./CreatorTools";
import { MinecraftFlavor } from "./ICreatorToolsData";
import Database from "../minecraft/Database";
import BrowserStorage from "../storage/BrowserStorage";
import IStorage from "../storage/IStorage";
import { EventDispatcher } from "ste-events";
import GitHubManager from "../github/GitHubManager";
import AppServiceProxy from "../core/AppServiceProxy";
import IFolder from "../storage/IFolder";
import StorageUtilities from "../storage/StorageUtilities";
import IMinecraft from "./IMinecraft";
import CreatorToolsCommands from "./CreatorToolsCommands";
import { DeploymentTargetType } from "./DeploymentTarget";

export enum CreatorToolsThemeStyle {
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

/// CreatorToolsHost mostly serves as a static app loader for the really-core Carto app object.
export default class CreatorToolsHost {
  private static _creatorTools?: CreatorTools;
  private static _onInitialized = new EventDispatcher<CreatorTools, CreatorTools>();
  private static _onThemeChanged = new EventDispatcher<CreatorToolsHost, CreatorToolsThemeStyle>();
  private static _initializing = false;
  private static _initialized = false;
  public static isLocalNode = false;
  public static fullLocalStorage = false;
  public static hostType = HostType.web;
  public static hostManager?: any = undefined;
  private static _theme: CreatorToolsThemeStyle = CreatorToolsThemeStyle.dark;
  public static retrieveDataFromWebContentRoot = false;
  public static contentRoot = "";
  public static projectPath = "";
  public static focusPath: string | undefined = undefined;
  public static baseUrl = "";

  /**
   * Gets the current theme style
   */
  public static get theme(): CreatorToolsThemeStyle {
    return this._theme;
  }

  /**
   * Sets the theme style and notifies listeners
   */
  public static set theme(value: CreatorToolsThemeStyle) {
    if (this._theme !== value) {
      this._theme = value;
      this._onThemeChanged.dispatch(CreatorToolsHost, value);
    }
  }

  /**
   * Event fired when theme changes. Use this to update FluentUI components
   * that are initialized outside of React's render cycle.
   */
  public static get onThemeChanged() {
    return this._onThemeChanged.asEvent();
  }

  public static initialMode: string | null = null;
  public static modeParameter: string | null = null;

  public static postMessage: ((message: any) => void) | undefined;

  public static prefsStorage: IStorage | null = null;
  public static projectsStorage: IStorage | null = null;
  public static deploymentStorage: IStorage[] = [];
  public static worldStorage: IStorage | null = null;
  public static packStorage: IStorage | null = null;
  public static workingStorage: IStorage | null = null;

  public static generateCryptoRandomNumber: (toVal: number) => number;
  public static localFolderExists: ((path: string) => Promise<boolean>) | undefined;
  public static localFileExists: ((path: string) => Promise<boolean>) | undefined;
  public static ensureLocalFolder: ((path: string) => IFolder) | undefined;
  public static createMinecraft:
    | ((flavor: MinecraftFlavor, creatorTOols: CreatorTools) => IMinecraft | undefined)
    | undefined;
  public static canCreateMinecraft: ((flavor: MinecraftFlavor) => boolean) | undefined;

  private static _onMessage = new EventDispatcher<any, any>();

  public static get isNodeJs() {
    return (
      this.hostType === HostType.electronNodeJs ||
      this.hostType === HostType.toolsNodejs ||
      this.hostType === HostType.vsCodeMainNodeJs
    );
  }

  public static get isVsCode() {
    return (
      this.hostType === HostType.vsCodeMainNodeJs ||
      this.hostType === HostType.vsCodeWebService ||
      this.hostType === HostType.vsCodeMainWeb ||
      this.hostType === HostType.vsCodeWebWeb
    );
  }

  public static get isWeb() {
    return (
      this.hostType === HostType.webPlusServices ||
      this.hostType === HostType.web ||
      this.hostType === HostType.electronWeb ||
      this.hostType === HostType.vsCodeMainWeb ||
      this.hostType === HostType.vsCodeWebWeb
    );
  }

  public static get isAppServiceWeb() {
    return this.hostType === HostType.electronWeb || this.hostType === HostType.vsCodeMainWeb;
  }

  public static get onMessage() {
    return CreatorToolsHost._onMessage.asEvent();
  }

  public static get onInitialized() {
    return CreatorToolsHost._onInitialized.asEvent();
  }

  public static getCreatorTools(): CreatorTools | undefined {
    if (!this._initialized) {
      this.init();
    }

    return CreatorToolsHost._creatorTools;
  }

  public static notifyNewMessage(source: any, message: any) {
    CreatorToolsHost._onMessage.dispatch(source, message);
  }

  public static setHostType(type: HostType) {
    this.hostType = type;
  }

  static init() {
    if (CreatorToolsHost._initializing || CreatorToolsHost._initialized) {
      return;
    }

    CreatorToolsHost._initializing = true;

    //@ts-ignore
    if (typeof g_contentRoot !== "undefined") {
      //@ts-ignore
      CreatorToolsHost.contentRoot = StorageUtilities.ensureEndsWithDelimiter(g_contentRoot);
    }

    //@ts-ignore
    if (typeof g_initialMode !== "undefined") {
      //@ts-ignore
      CreatorToolsHost.initialMode = g_initialMode;
    }

    //@ts-ignore
    if (typeof g_modeParameter !== "undefined") {
      //@ts-ignore
      CreatorToolsHost.modeParameter = g_modeParameter;
    }

    //@ts-ignore
    if (typeof g_isVsCodeMain !== "undefined") {
      //@ts-ignore
      if (g_isVsCodeMain) {
        CreatorToolsHost.hostType = HostType.vsCodeMainWeb;
      }
    }

    //@ts-ignore
    if (typeof g_isVsCodeWeb !== "undefined") {
      //@ts-ignore
      if (g_isVsCodeWeb) {
        CreatorToolsHost.hostType = HostType.vsCodeWebWeb;
      }
    }

    //@ts-ignore
    if (typeof g_projectPath !== "undefined") {
      //@ts-ignore
      CreatorToolsHost.projectPath = g_projectPath;
    }

    //@ts-ignore
    if (typeof g_baseUrl !== "undefined") {
      //@ts-ignore
      CreatorToolsHost.baseUrl = g_baseUrl;
    }

    AppServiceProxy.init();

    GitHubManager.init();

    Database.loadVanillaCatalog();

    CreatorToolsCommands.registerCommonCommands();

    CreatorToolsHost.generateCryptoRandomNumber = (toVal) => {
      const ct = CreatorToolsHost.getCreatorTools();

      if (!ct || !ct.local) {
        throw new Error("Could not generate key.");
      }

      return ct.local.generateCryptoRandomNumber(toVal);
    };

    // @ts-ignore
    if (typeof window !== "undefined") {
      CreatorToolsHost.generateCryptoRandomNumber = (toVal) => {
        // @ts-ignore
        if (window && window.crypto) {
          // @ts-ignore
          return window.crypto.getRandomValues(new Uint32Array(1))[0] % 16;
        }

        return Math.floor(Math.random() * toVal);
      };
    }

    if (CreatorToolsHost.projectsStorage !== null && CreatorToolsHost.prefsStorage !== null) {
      // @ts-ignore
    } else if (typeof window !== "undefined") {
      CreatorToolsHost.prefsStorage = new BrowserStorage("mctprefs");
      CreatorToolsHost.projectsStorage = new BrowserStorage("mctprojects");

      CreatorToolsHost.deploymentStorage[DeploymentTargetType.bedrock] = new BrowserStorage("mctdeploy");
      CreatorToolsHost.workingStorage = new BrowserStorage("mctworking");
      CreatorToolsHost.worldStorage = new BrowserStorage("mctworlds");
      CreatorToolsHost.packStorage = new BrowserStorage("mctpacks");
    }

    if (CreatorToolsHost.prefsStorage === null || CreatorToolsHost.projectsStorage === null) {
      throw new Error("Unexpected uninitialized storage.");
    }

    CreatorToolsHost._creatorTools = new CreatorTools(
      CreatorToolsHost.prefsStorage,
      CreatorToolsHost.projectsStorage,
      CreatorToolsHost.deploymentStorage,
      CreatorToolsHost.worldStorage,
      CreatorToolsHost.packStorage,
      CreatorToolsHost.workingStorage,
      CreatorToolsHost.contentRoot
    );

    if (CreatorToolsHost.ensureLocalFolder) {
      CreatorToolsHost._creatorTools.ensureLocalFolder = CreatorToolsHost.ensureLocalFolder;
      CreatorToolsHost._creatorTools.localFolderExists = CreatorToolsHost.localFolderExists;
      CreatorToolsHost._creatorTools.localFileExists = CreatorToolsHost.localFileExists;
    }

    CreatorToolsHost._creatorTools.createMinecraft = CreatorToolsHost.createMinecraft;
    CreatorToolsHost._creatorTools.canCreateMinecraft = CreatorToolsHost.canCreateMinecraft;

    CreatorToolsHost._initialized = true;

    this._onInitialized.dispatch(CreatorToolsHost._creatorTools, CreatorToolsHost._creatorTools);
  }

  static async _localFolderExists(path: string) {
    throw new Error("Method not implemented.");
  }

  static async _localFileExists(path: string) {
    throw new Error("Method not implemented.");
  }

  static _ensureElectronLocalFolder(path: string) {
    throw new Error("Method not implemented.");
  }
}
