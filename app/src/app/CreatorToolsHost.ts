// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/*
 * ==========================================================================================
 * CREATORTOOLS HOST - PLATFORM ABSTRACTION LAYER NOTES
 * ==========================================================================================
 *
 * OVERVIEW:
 * ---------
 * CreatorToolsHost is the central platform abstraction layer that allows MCT to run across
 * multiple environments: web browser, NodeJS CLI, Electron app, and VS Code extension.
 * It provides static methods and properties for platform detection, storage initialization,
 * and cross-platform thunks for functionality that differs by platform.
 *
 * HOST TYPES (HostType enum):
 * ---------------------------
 * - web (0): Pure browser, no backend services (uses BrowserStorage/localStorage)
 * - toolsNodejs (1): NodeJS command line tool (uses NodeStorage/fs)
 * - electronNodeJs (2): Electron main process (NodeJS side)
 * - electronWeb (3): Electron renderer process (browser side, uses ElectronStorage via IPC)
 * - vsCodeMainNodeJs (4): VS Code extension host (NodeJS side)
 * - vsCodeMainWeb (5): VS Code webview connected to extension host
 * - vsCodeWebService (6): VS Code web extension service worker
 * - vsCodeWebWeb (7): VS Code web extension webview
 * - webPlusServices (8): Browser with AppServiceProxy backend
 * - testLocal (9): Local testing environment
 *
 * STORAGE INITIALIZATION:
 * -----------------------
 * The init() method sets up storage based on hostType:
 * - prefsStorage: User preferences (BrowserStorage in web, ElectronStorage in Electron)
 * - projectsStorage: Project files and metadata
 * - deploymentStorage[]: Array of deployment targets indexed by DeploymentTargetType
 * - worldStorage: Minecraft worlds
 * - packStorage: Downloaded/cached packs
 * - workingStorage: Temporary working files
 *
 * CROSS-PLATFORM THUNKS:
 * ----------------------
 * These function properties are set based on platform capabilities:
 * - generateCryptoRandomNumber: Secure random number generation
 * - localFolderExists / localFileExists: File system checks (only in NodeJS contexts)
 * - ensureLocalFolder: Create local folder (only in NodeJS contexts)
 * - createMinecraft / canCreateMinecraft: Minecraft instance creation (Electron/VSCode)
 *
 * CONTENT ROOTS:
 * --------------
 * - contentWebRoot: Base URL for APP data (forms, catalogs, snippets, typedefs, mccat.json).
 *   Set to "/" for local HTTP server, or full URL for web hosting.
 *   Used for: data/forms/, data/mccat.json, data/typedefs.*.json, data/mci/, data/mch/
 *
 * - vanillaContentRoot: Base URL for VANILLA MINECRAFT assets (textures, models, resource packs).
 *   These are large files (~500MB+) not bundled with CLI tool, hosted at mctools.dev.
 *   Used for: res/latest/van/release/, res/latest/van/preview/, res/latest/van/serve/
 *
 * - getVanillaContentRoot(): Returns vanillaContentRoot if set, else contentWebRoot.
 *   Use this for all vanilla resource loading (textures, blocks.json, terrain_texture.json).
 *
 * INITIALIZATION FLOW:
 * --------------------
 * 1. Global variables (g_contentRoot, g_isVsCodeMain, etc.) are injected by build system
 * 2. init() reads globals and sets hostType
 * 3. AppServiceProxy.init() establishes IPC if in Electron/VSCode
 * 4. Database.loadVanillaCatalog() loads mccat.json
 * 5. Storage objects are created based on detected platform
 * 6. CreatorTools singleton is instantiated with storage references
 *
 * RELATED FILES:
 * --------------
 * - CreatorTools.ts: Main application object, instantiated by CreatorToolsHost
 * - AppServiceProxy.ts: IPC communication layer for Electron/VSCode
 * - BrowserStorage.ts, ElectronStorage.ts, NodeStorage.ts: Storage implementations
 * - Database.ts: Loads vanilla catalog and form definitions
 *
 * COMMON PATTERNS:
 * ----------------
 * - Check platform: CreatorToolsHost.isNodeJs, .isWeb, .isVsCode, .isAppServiceWeb
 * - Get main app: CreatorToolsHost.getCreatorTools()
 * - Listen for init: CreatorToolsHost.onInitialized.subscribe(handler)
 * - Theme changes: CreatorToolsHost.onThemeChanged.subscribe(handler)
 *
 * ==========================================================================================
 */

import CreatorTools from "./CreatorTools";
import { MinecraftFlavor } from "./ICreatorToolsData";
import Database from "../minecraft/Database";
import BrowserStorage from "../storage/BrowserStorage";
import IStorage from "../storage/IStorage";
import ElectronStorage from "../electronclient/ElectronStorage";
import { EventDispatcher } from "ste-events";
import AppServiceProxy from "../core/AppServiceProxy";
import IFolder from "../storage/IFolder";
import StorageUtilities from "../storage/StorageUtilities";
import IMinecraft from "./IMinecraft";
import CreatorToolsCommands from "./CreatorToolsCommands";
import { DeploymentTargetType } from "./DeploymentTarget";

export enum CreatorToolsThemeStyle {
  dark = 0,
  light = 1,
  highContrastDark = 2,
  highContrastLight = 3,
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
  /**
   * True when the OS/browser is in a forced-colors (high contrast) mode.
   * This is orthogonal to dark/light — HC Dark sets theme=dark + isHighContrast,
   * HC Light sets theme=light + isHighContrast.
   */
  public static isHighContrast = false;
  public static retrieveDataFromWebContentRoot = false;
  public static contentWebRoot = "";
  public static vanillaContentRoot = ""; // URL root for vanilla textures, samples, definitions (e.g., https://mctools.dev/)
  public static projectPath = "";
  public static focusPath: string | undefined = undefined;
  public static baseUrl = "";

  /**
   * Gets the effective root URL for vanilla content (textures, samples, definitions).
   * Returns vanillaContentRoot if set, otherwise falls back to contentRoot.
   */
  public static getVanillaContentRoot(): string {
    return this.vanillaContentRoot || this.contentWebRoot || "";
  }

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
  public static contentUrl: string | null = null;
  public static readOnly: boolean = false;

  public static postMessage: ((message: any) => void) | undefined;

  public static prefsStorage: IStorage | null = null;
  public static projectsStorage: IStorage | null = null;
  public static deploymentStorage: IStorage[] = [];
  public static worldStorage: IStorage | null = null;
  public static packStorage: IStorage | null = null;
  public static workingStorage: IStorage | null = null;

  public static generateCryptoRandomNumber: (toVal: number) => number;
  public static generateUuid: () => string;
  public static localFolderExists: ((path: string) => Promise<boolean>) | undefined;
  public static localFileExists: ((path: string) => Promise<boolean>) | undefined;
  public static ensureLocalFolder: ((path: string) => IFolder) | undefined;
  public static createMinecraft:
    | ((flavor: MinecraftFlavor, creatorTOols: CreatorTools) => IMinecraft | undefined)
    | undefined;
  public static canCreateMinecraft: ((flavor: MinecraftFlavor) => boolean) | undefined;

  // Image codec thunks - set by Node.js environments to provide platform-specific implementations
  public static decodePng:
    | ((data: Uint8Array) => { width: number; height: number; pixels: Uint8Array } | undefined)
    | undefined;
  public static encodeToPng:
    | ((pixels: Uint8Array, width: number, height: number) => Uint8Array | undefined)
    | undefined;

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
      CreatorToolsHost.contentWebRoot = StorageUtilities.ensureEndsWithDelimiter(g_contentRoot);
    }

    //@ts-ignore
    if (typeof g_vanillaContentRoot !== "undefined") {
      //@ts-ignore
      CreatorToolsHost.vanillaContentRoot = StorageUtilities.ensureEndsWithDelimiter(g_vanillaContentRoot);
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

    //@ts-ignore
    if (typeof g_contentUrl !== "undefined") {
      //@ts-ignore
      CreatorToolsHost.contentUrl = g_contentUrl;
    }

    //@ts-ignore
    if (typeof g_readOnly !== "undefined") {
      //@ts-ignore
      CreatorToolsHost.readOnly = g_readOnly === true;
    }

    AppServiceProxy.init();

    Database.loadVanillaCatalog();

    CreatorToolsCommands.registerCommonCommands();

    CreatorToolsHost.generateCryptoRandomNumber = (toVal) => {
      const ct = CreatorToolsHost.getCreatorTools();

      if (!ct || !ct.local) {
        throw new Error("Could not generate key.");
      }

      return ct.local.generateCryptoRandomNumber(toVal);
    };

    CreatorToolsHost.generateUuid = () => {
      const ct = CreatorToolsHost.getCreatorTools();

      if (!ct || !ct.local) {
        throw new Error("Could not generate UUID.");
      }

      return ct.local.generateUuid();
    };

    // Set up image codec thunks for Node.js environments
    CreatorToolsHost.decodePng = (data: Uint8Array) => {
      const ct = CreatorToolsHost.getCreatorTools();
      if (!ct || !ct.local) {
        return undefined;
      }
      return ct.local.decodePng(data);
    };

    CreatorToolsHost.encodeToPng = (pixels: Uint8Array, width: number, height: number) => {
      const ct = CreatorToolsHost.getCreatorTools();
      if (!ct || !ct.local) {
        return undefined;
      }
      return ct.local.encodeToPng(pixels, width, height);
    };

    // @ts-ignore
    if (typeof window !== "undefined" && window.crypto) {
      CreatorToolsHost.generateCryptoRandomNumber = (toVal) => {
        // Use rejection sampling to avoid modulo bias when generating random numbers
        // from a cryptographically secure source
        const maxUint32 = 0xffffffff;
        const limit = maxUint32 - (maxUint32 % toVal);
        let randomValue: number;
        do {
          // @ts-ignore
          randomValue = window.crypto.getRandomValues(new Uint32Array(1))[0];
        } while (randomValue >= limit);
        return randomValue % toVal;
      };

      // @ts-ignore
      if (window.crypto.randomUUID) {
        CreatorToolsHost.generateUuid = () => {
          // @ts-ignore
          return window.crypto.randomUUID();
        };
      } else {
        // Fallback for older browsers using crypto.getRandomValues
        CreatorToolsHost.generateUuid = () => {
          // @ts-ignore
          const bytes = window.crypto.getRandomValues(new Uint8Array(16));
          // Set version 4 (random) UUID bits
          bytes[6] = (bytes[6] & 0x0f) | 0x40;
          bytes[8] = (bytes[8] & 0x3f) | 0x80;
          const hex = Array.from(bytes, (b: number) => b.toString(16).padStart(2, "0")).join("");
          return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
        };
      }
    }

    if (CreatorToolsHost.projectsStorage !== null && CreatorToolsHost.prefsStorage !== null) {
    } else if (AppServiceProxy.hasAppService) {
      let ls = new ElectronStorage("<DOCP>", "prefs");
      ls.rootFolder.ensureExists();
      CreatorToolsHost.prefsStorage = ls;

      ls = new ElectronStorage("<DOCP>", "working");
      ls.rootFolder.ensureExists();
      CreatorToolsHost.workingStorage = ls;

      ls = new ElectronStorage("<DOCP>", "projects");
      ls.rootFolder.ensureExists();
      CreatorToolsHost.projectsStorage = ls;

      ls = new ElectronStorage("<DOCP>", "worlds");
      ls.rootFolder.ensureExists();
      CreatorToolsHost.worldStorage = ls;

      ls = new ElectronStorage("<DOCP>", "packs");
      ls.rootFolder.ensureExists();
      CreatorToolsHost.packStorage = ls;

      // @ts-ignore
      if (typeof window !== "undefined") {
        // @ts-ignore
        let basePath = window.location.href;
        const lastSlash = basePath.lastIndexOf("/");

        if (lastSlash >= 0) {
          CreatorToolsHost.contentWebRoot = basePath.substring(0, lastSlash + 1);
        }
      }

      let minecraftPath = "<BDRK>";

      ls = new ElectronStorage(minecraftPath, "");
      ls.getAvailable();
      CreatorToolsHost.deploymentStorage[DeploymentTargetType.bedrock] = ls;

      let minecraftPreviewPath = "<BDPV>";

      ls = new ElectronStorage(minecraftPreviewPath, "");
      ls.getAvailable();

      CreatorToolsHost.deploymentStorage[DeploymentTargetType.bedrockPreview] = ls;

      //@ts-ignore
    } else if (typeof window !== "undefined") {
      // Guard: If we're in Electron context but AppServiceProxy isn't ready, that's an initialization error.
      // Electron renderer should NEVER use BrowserStorage - it should use ElectronStorage which proxies to NodeJS.
      // @ts-ignore
      if (typeof window.api !== "undefined") {
        throw new Error(
          "BrowserStorage initialization attempted in Electron context. " +
            "Electron renderer must use ElectronStorage. " +
            "Ensure AppServiceProxy.hasAppService is true before CreatorToolsHost.init() is called."
        );
      }

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
      CreatorToolsHost.contentWebRoot
    );

    if (CreatorToolsHost.ensureLocalFolder) {
      CreatorToolsHost._creatorTools.ensureLocalFolder = CreatorToolsHost.ensureLocalFolder;
      CreatorToolsHost._creatorTools.localFolderExists = CreatorToolsHost.localFolderExists;
      CreatorToolsHost._creatorTools.localFileExists = CreatorToolsHost.localFileExists;
    } else if (CreatorToolsHost.hostType === HostType.electronWeb) {
      CreatorToolsHost._creatorTools.ensureLocalFolder = CreatorToolsHost._ensureElectronLocalFolder;
      CreatorToolsHost._creatorTools.localFolderExists = CreatorToolsHost._localFolderExists;
      CreatorToolsHost._creatorTools.localFileExists = CreatorToolsHost._localFileExists;
    }

    CreatorToolsHost._creatorTools.createMinecraft = CreatorToolsHost.createMinecraft;
    CreatorToolsHost._creatorTools.canCreateMinecraft = CreatorToolsHost.canCreateMinecraft;

    CreatorToolsHost._initialized = true;

    this._onInitialized.dispatch(CreatorToolsHost._creatorTools, CreatorToolsHost._creatorTools);
  }

  static async _localFolderExists(path: string) {
    const ls = new ElectronStorage(path, "");

    let result = ls.available;

    if (!result) {
      result = await ls.getAvailable();

      if (!result) {
        return false;
      }
    }

    return await ls.rootFolder.exists();
  }

  static async _localFileExists(path: string) {
    const folderPath = StorageUtilities.getFolderPath(path);
    const fileName = StorageUtilities.getLeafName(path);

    if (!fileName || fileName.length < 2 || !folderPath || folderPath.length < 2) {
      throw new Error("Could not process file with path: `" + path + "`");
    }

    const ls = new ElectronStorage(folderPath, "");

    const file = ls.rootFolder.ensureFile(fileName);

    return await file.exists();
  }

  static _ensureElectronLocalFolder(path: string) {
    // Reuse existing storage if one already exists for this path
    // (e.g., from a prior _localFolderExists call that set up the file watcher).
    // Creating a new ElectronStorage overwrites electronStorages[path], which could
    // orphan an existing storage that has its file watcher configured.
    let ls = ElectronStorage.electronStorages[path];

    if (!ls) {
      ls = new ElectronStorage(path, "");

      // Kick off getAvailable() to set up the fs.watch file watcher in the main process.
      // Without this, externally created files (e.g., by MCP tools) won't be detected.
      ls.getAvailable();
    }

    return ls.rootFolder;
  }
}
