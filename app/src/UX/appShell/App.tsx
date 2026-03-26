import { Component } from "react";
import ProjectEditor, { ProjectStatusAreaMode } from "../project/ProjectEditor";
import ExporterTool from "../io/ExporterTool";
import Home from "../home/Home";
import "./App.css";
import CreatorTools, { DefaultCreatorName } from "../../app/CreatorTools";
import Project, { ProjectErrorState } from "../../app/Project";
import IGalleryItem, { GalleryItemType } from "../../app/IGalleryItem";
import IFolder from "../../storage/IFolder";
import { GalleryProjectCommand } from "../home/CodeProjectGallery";
import Log from "../../core/Log";
import { ProjectFocus, ProjectScriptLanguage } from "../../app/IProjectData";
import CreatorToolsHost, { CreatorToolsThemeStyle, HostType } from "../../app/CreatorToolsHost";
import StorageUtilities from "../../storage/StorageUtilities";
import ElectronTitleBar from "./ElectronTitleBar";
import GalleryReader from "../../app/gallery/GalleryReader";
import CodeToolbox from "../codeEditors/CodeToolbox";
import RemoteServerManager from "../server/RemoteServerManager";
import { getThemeColors } from "../hooks/theme/useThemeColors";
import IProjectTheme from "../types/IProjectTheme";
import { CreatorToolsEditorViewMode } from "../../app/ICreatorToolsData";
import MCWorld from "../../minecraft/MCWorld";
import CodeStartPage from "../home/CodeStartPage";
import ProjectItem from "../../app/ProjectItem";
import ProjectUtilities from "../../app/ProjectUtilities";
import CodeToolboxNoProjectLanding from "../codeEditors/CodeToolboxNoProjectLanding";
import { LocalFolderType, LocalGalleryCommand } from "../utils/LocalGalleryCommand";
import WebUtilities from "../utils/WebUtilities";
import ProjectEditorUtilities, { ProjectEditorMode } from "../project/ProjectEditorUtilities";
import AppServiceProxy from "../../core/AppServiceProxy";
import Utilities from "../../core/Utilities";
import HttpStorage from "../../storage/HttpStorage";
import WebServer from "../server/WebServer";
import { ProjectImportExclusions } from "../../app/ProjectExporter";
import Database from "../../minecraft/Database";
import IProjectSeed from "../../app/IProjectSeed";
import ImportFromUrl from "../io/ImportFromUrl";
import ProjectCreateManager from "../../app/ProjectCreateManager";
import telemetryService from "../../analytics/Telemetry";
import { TelemetryEvents, TelemetryProperties, TelemetrySeverity } from "../../analytics/TelemetryConstants";
import ImportFiles from "../io/ImportFiles";

// Lazy-loaded heavy components (Babylon.js ~8MB)
// These are only loaded when the user navigates to 3D viewer modes
import { LazyBlockViewer, LazyMobViewer, LazyItemViewer, LazyModelViewer, LazyStructureViewer, LazyWorldViewer } from "./LazyComponents";

export enum NewProjectTemplateType {
  empty,
  gameTest,
}

export enum AppMode {
  home = 1,
  loading = 2,
  project = 3,
  codeToolbox = 4,
  projectReadOnly = 5,
  exporterTool = 6,
  remoteServerManager = 7,
  codeStartPage = 9,
  codeStartPageForceNewProject = 12,
  codeLandingForceNewProject = 13,
  codeMinecraftView = 14,
  webServer = 16,
  importFromUrl = 17,
  importFiles = 18,
  blockViewer = 19,
  mobViewer = 20,
  modelViewer = 21, // Standalone model viewer with URL params for geometry/texture
  structureViewer = 22, // Standalone structure viewer with URL param for structure data
  worldViewer = 25, // Standalone 3D world viewer with URL param for .mcworld data
  sessionEnded = 23, // View session has ended (server shut down)
  itemViewer = 24, // Standalone item/attachable viewer
}

interface AppProps {
  darkTheme: IProjectTheme;
  lightTheme: IProjectTheme;
  fileContentRetriever?: (func: () => Promise<any>) => void;
  saveAllRetriever?: (func: () => Promise<void>) => void;
}

interface AppState {
  mode: AppMode;
  isPersisted?: boolean;
  errorMessage?: string;
  activeProject: Project | null;
  submittedFiles?: File[] | undefined;
  selectedItem?: string;
  initialFocusPath?: string;
  hasBanner?: boolean;
  initialProjectEditorMode?: ProjectEditorMode;
  loadingMessage?: string;
  visualSeed?: number;
  additionalLoadingMessage?: string;
  // For modelViewer mode - direct geometry/texture loading
  geometryUrl?: string;
  textureUrl?: string;
  skipVanillaResources?: boolean;
  // For structureViewer mode - direct structure loading
  structureUrl?: string;
  // For worldViewer mode - direct .mcworld loading
  worldUrl?: string;
  // Hide UI chrome for headless rendering
  hideChrome?: boolean;
  // Show VolumeEditor toolbar (brush, pencil, selection tools)
  showEditorTools?: boolean;
  // Camera position parameters for modelViewer mode
  cameraX?: number;
  cameraY?: number;
  cameraZ?: number;
}

// Layout and UI constants
const ELECTRON_TITLEBAR_HEIGHT = 35;
const DEFAULT_BANNER_HEIGHT = 96;
const MIN_BANNER_OFFSET_HEIGHT = 20;
const BANNER_EXTRA_HEIGHT = 17;
const LOADING_INTERVAL_MS = 50;
const TOOLBAR_MENU_TRANSFORM_OFFSET = " 235px";

export default class App extends Component<AppProps, AppState> {
  static instanceCount = 0;
  private _loadingMessage?: string;
  private _lastHashProcessed?: string;
  private _isMountedInternal: boolean = false;
  private _pendingState: Partial<AppState> | undefined;
  private _contentStorage?: HttpStorage; // Storage for view/edit mode content (tracks WebSocket subscription)
  private _pendingUrlState?: AppState; // State parsed from URL in loadCreatorTools, consumed by processInitialUrl

  constructor(props: AppProps) {
    super(props);

    this._setProject = this._setProject.bind(this);
    this._handleNewProject = this._handleNewProject.bind(this);
    this._handleNewProjectFromFolder = this._handleNewProjectFromFolder.bind(this);
    this._handleNewProjectFromFolderInstance = this._handleNewProjectFromFolderInstance.bind(this);
    this._handleNewProjectFromImportFiles = this._handleNewProjectFromImportFiles.bind(this);
    this._handleUpdateExistingProject = this._handleUpdateExistingProject.bind(this);
    this._handleProjectSelected = this._handleProjectSelected.bind(this);
    this._handleCreatorToolsInit = this._handleCreatorToolsInit.bind(this);
    this.processInitialUrl = this.processInitialUrl.bind(this);
    this._handlePersistenceUpgraded = this._handlePersistenceUpgraded.bind(this);
    this._newProjectFromGallery = this._newProjectFromGallery.bind(this);
    this._handleProjectGalleryCommand = this._handleProjectGalleryCommand.bind(this);
    this._handleLocalGalleryCommand = this._handleLocalGalleryCommand.bind(this);
    this._considerSubmittedFiles = this._considerSubmittedFiles.bind(this);
    this._loadProjectFromContentUrl = this._loadProjectFromContentUrl.bind(this);
    this._handleHashChange = this._handleHashChange.bind(this);
    this._incrementVisualSeed = this._incrementVisualSeed.bind(this);
    this._gitHubAddingMessageUpdater = this._gitHubAddingMessageUpdater.bind(this);
    this._getFileContent = this._getFileContent.bind(this);
    this._saveAll = this._saveAll.bind(this);
    this._handleItemChanged = this._handleItemChanged.bind(this);
    this._handleSaved = this._handleSaved.bind(this);
    this._doLog = this._doLog.bind(this);
    this._ensureProjectFromGalleryId = this._ensureProjectFromGalleryId.bind(this);
    this._newProjectFromGalleryId = this._newProjectFromGalleryId.bind(this);
    this._handleThemeChanged = this._handleThemeChanged.bind(this);
    this._handleBeforeUnload = this._handleBeforeUnload.bind(this);

    this._tick = this._tick.bind(this);

    this.state = {
      mode: AppMode.loading,
      activeProject: null,
    };
  }

  public async _saveAll() {
    if (this.state.activeProject) {
      await this.state.activeProject.save();
    }
  }

  private _handleBeforeUnload(e: BeforeUnloadEvent) {
    if (Utilities.isDebug) {
      return;
    }

    if (this.state?.activeProject?.hasUnsavedChanges()) {
      e.preventDefault();
      e.returnValue = "";
    }
  }

  public async _getFileContent() {
    return "{ }";
  }

  public async _loadLocalStorageProject() {
    const ct = CreatorToolsHost.getCreatorTools();

    if (!ct || !ct.isLoaded) {
      return;
    }

    const newProject = await ct.ensureProjectFromLocalStoragePath(CreatorToolsHost.projectPath);

    if (newProject) {
      const mode: AppMode = this._getModeFromString(CreatorToolsHost.initialMode) ?? AppMode.home;
      const project: Project = newProject; // Capture for closure

      let selValue = this.state.selectedItem;

      if (CreatorToolsHost.modeParameter) {
        selValue = CreatorToolsHost.modeParameter;
      }

      this.initProject(project);

      await project.ensureProjectFolder();

      if (this.state) {
        if (this._isMountedInternal) {
          this.setState((prevState) => ({
            ...prevState,
            mode: mode,
            activeProject: project,
            selectedItem: selValue,
          }));
        } else {
          this._pendingState = {
            mode: mode,
            activeProject: project,
            selectedItem: selValue,
          };
        }
      }
    } else {
      Log.debug("Failed to load project from local storage path: " + CreatorToolsHost.projectPath);

      if (this._isMountedInternal) {
        this.setState((prevState) => ({
          ...prevState,
          mode: AppMode.home,
          loadingMessage: undefined,
          activeProject: null,
        }));
      } else {
        this._pendingState = {
          mode: AppMode.home,
          loadingMessage: undefined,
          activeProject: null,
        };
      }
    }
  }

  public _handleItemChanged(project: Project, item: ProjectItem) {
    this._updateWindowTitle(this.state.mode, project);
  }

  public _handleSaved(project: Project, projectA: Project) {
    this._updateWindowTitle(this.state.mode, project);
  }

  public _getModeFromString(incomingMode: string | null | undefined) {
    switch (incomingMode) {
      case "home":
        return AppMode.home;

      case "project":
        return AppMode.project;

      case "projectitem":
        return AppMode.project;

      case "info":
        return AppMode.project;

      case "input":
        return AppMode.project;

      case "codetoolbox":
        return AppMode.codeToolbox;

      case "codestartpage":
        return AppMode.codeStartPage;

      case "codeminecraftview":
        return AppMode.codeMinecraftView;

      case "codestartpageforcenewproject":
        return AppMode.codeStartPageForceNewProject;

      case "codelandingforcenewproject":
        return AppMode.codeLandingForceNewProject;

      case "remoteservermanager":
        return AppMode.remoteServerManager;

      case "webserver":
        return AppMode.webServer;

      case "blockviewer":
        return AppMode.blockViewer;

      case "mobviewer":
        return AppMode.mobViewer;

      case "itemviewer":
        return AppMode.itemViewer;

      case "modelviewer":
        return AppMode.modelViewer;

      case "structureviewer":
        return AppMode.structureViewer;

      case "worldviewer":
        return AppMode.worldViewer;
      case "importfromurl":
        return AppMode.importFromUrl;

      case "importfiles":
        return AppMode.importFiles;

      default:
        Log.debug("Unknown app mode requested: " + incomingMode);
        return undefined;
    }
  }

  private _incrementVisualSeed() {
    if (!this.state) {
      return;
    }

    let newSeed = this.state.visualSeed;

    if (newSeed === undefined) {
      newSeed = 1;
    } else {
      newSeed++;
    }

    this.setState((prevState) => ({
      ...prevState,
      visualSeed: newSeed,
    }));
  }

  /**
   * Updates the URL hash to encode the current project identity.
   * Format: #project/<encodedProjectName> or #project/<encodedProjectName>/<filePath>
   * Uses replaceState to avoid polluting browser back-button history.
   */
  private _setProjectHash(project: Project, filePath?: string) {
    const encodedName = encodeURIComponent(project.name);
    let hash = "project/" + encodedName;
    if (filePath) {
      hash += "/" + filePath;
    }
    this._lastHashProcessed = "#" + hash;
    window.history.replaceState(null, "", "#" + hash);
  }

  /**
   * Clears the project hash from the URL when navigating away from a project.
   */
  private _clearProjectHash() {
    this._lastHashProcessed = "";
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }

  private _handleHashChange() {
    const result = this._getStateFromUrlWithSideEffects(true);

    if (result && this._isMountedInternal) {
      // If the hash encodes a project name that differs from the active project,
      // load it. Otherwise just update mode/selectedItem as before.
      if (result.activeProject && result.activeProject !== this.state.activeProject) {
        this._handleProjectSelected(result.activeProject);
      } else {
        this.setState((prevState) => ({
          ...prevState,
          mode: result.mode,
          selectedItem: result.selectedItem,
        }));
      }
    }
  }

  private async _handleCreatorToolsInit(source: CreatorTools, instance: CreatorTools) {
    if (this.state === undefined) {
      return;
    }

    await this.loadCreatorTools(instance);
  }

  private async loadCreatorTools(instance: CreatorTools) {
    await instance.load();

    if (instance.projects) {
      telemetryService.setActiveProjectCount(instance.projects.length);
    }

    const isPersisted = await WebUtilities.getIsPersisted();

    const newState = this._getStateFromUrlWithSideEffects();
    let nextMode = this.state.mode;

    if (newState) {
      nextMode = newState.mode;
      // Store the URL state so processInitialUrl can use it (the hash was
      // already consumed by _getStateFromUrlWithSideEffects and won't parse again).
      this._pendingUrlState = newState;
    } else if (nextMode === AppMode.loading) {
      // Check CreatorToolsHost.initialMode before defaulting to home
      // This prevents a flash of the home page when the app was launched
      // with a specific mode (e.g., webserver via mct serve)
      const modeFromInitial = this._getModeFromString(CreatorToolsHost.initialMode);
      nextMode = modeFromInitial ?? AppMode.home;
    }

    this._updateWindowTitle(nextMode, this.state.activeProject);

    this.setState((prevState) => ({
      ...prevState,
      creatorTools: CreatorToolsHost.getCreatorTools(),
      mode: nextMode,
      isPersisted: isPersisted,
    }));
  }

  private _getStateFromUrlWithSideEffects(dontProcessQueryStrings?: boolean): AppState | undefined {
    let hash = window.location.hash;
    let query = window.location.search;

    const queryVals: { [path: string]: string } = {};

    if (hash.startsWith("#open=") || hash.startsWith("#view=") || hash.startsWith("#input=")) {
      if (!query) {
        query = "";
      }
      query += hash.replace(/#/gi, "&");
      hash = "";
    }

    if (query) {
      const params = query.split("&");

      if (params.length > 0) {
        for (let i = 0; i < params.length; i++) {
          const firstEqual = params[i].indexOf("=");

          if (firstEqual > 0) {
            let key = params[i].substring(0, firstEqual);

            if (key.startsWith("?")) {
              key = key.substring(1);
            }
            if (key.startsWith("#")) {
              key = key.substring(1);
            }

            queryVals[key] = params[i].substring(firstEqual + 1);
          }
        }
      }
    }

    if (!dontProcessQueryStrings && (queryVals["open"] !== undefined || queryVals["view"] !== undefined)) {
      let openQuery = queryVals["view"];

      if (queryVals["open"]) {
        openQuery = queryVals["open"];
      }

      const firstSlash = openQuery.indexOf("/");

      if (firstSlash > 1) {
        if (queryVals["updates"] !== undefined) {
          return {
            mode: AppMode.importFromUrl,
            activeProject: null,
          };
        } else {
          const openToken = openQuery.substring(0, firstSlash).toLowerCase();

          let openData = openQuery.substring(firstSlash + 1, openQuery.length);

          if (openToken === "gp") {
            const lastPeriod = openData.lastIndexOf(".");

            if (lastPeriod > 0) {
              openData = openData.substring(0, lastPeriod);
            }

            this._ensureProjectFromGalleryId(openData);
          }
        }
      }
    }

    if (!dontProcessQueryStrings && queryVals["input"] !== undefined) {
      let rootAndFocus = StorageUtilities.getRootAndFocusPathFromInputPath(decodeURIComponent(queryVals["input"]));

      CreatorToolsHost.projectPath = rootAndFocus.basePath;
      CreatorToolsHost.focusPath = rootAndFocus.focusPath;
    }

    // Handle ?mode= query parameter for direct navigation
    if (!dontProcessQueryStrings && queryVals["mode"] !== undefined) {
      const modeFromQuery = this._getModeFromString(queryVals["mode"].toLowerCase());
      if (modeFromQuery) {
        // Decode geometry and texture URLs since they come URL-encoded from query params
        const geometryUrlRaw = queryVals["geometry"] || queryVals["geo"];
        const textureUrlRaw = queryVals["texture"] || queryVals["tex"];
        // Parse skipVanilla parameter (defaults to true if not specified)
        const skipVanillaRaw = queryVals["skipvanilla"] || queryVals["skipVanilla"];
        const skipVanillaResources = skipVanillaRaw === undefined ? false : skipVanillaRaw.toLowerCase() !== "false";

        // Set contentRoot from URL parameter for rendering with vanilla resources
        const contentRootRaw = queryVals["contentroot"] || queryVals["contentRoot"];
        if (contentRootRaw) {
          CreatorToolsHost.contentWebRoot = decodeURIComponent(contentRootRaw);
        }

        // Parse camera position parameters for multi-angle rendering
        const cameraX = queryVals["camerax"] || queryVals["cameraX"];
        const cameraY = queryVals["cameray"] || queryVals["cameraY"];
        const cameraZ = queryVals["cameraz"] || queryVals["cameraZ"];

        // Parse structure URL for structureViewer mode
        const structureUrlRaw = queryVals["structure"] || queryVals["struct"];

        // Parse world URL for worldViewer mode
        const worldUrlRaw = queryVals["world"] || queryVals["worldurl"];

        // Parse hideChrome parameter for headless rendering (hides all UI controls)
        const hideChromeRaw = queryVals["hidechrome"] || queryVals["hideChrome"];
        const hideChrome =
          hideChromeRaw === "true" || hideChromeRaw === "1" || hideChromeRaw === "" || hideChromeRaw === "yes";

        // Parse showEditorTools parameter to enable VolumeEditor toolbar (brush, pencil, selection)
        const showEditorToolsRaw = queryVals["showeditortools"] || queryVals["showEditorTools"];
        const showEditorTools =
          showEditorToolsRaw === "true" || showEditorToolsRaw === "1" || showEditorToolsRaw === "yes";

        return {
          mode: modeFromQuery,
          activeProject: null,
          selectedItem: queryVals["block"] || queryVals["item"] || queryVals["mob"],
          // For modelViewer mode - support geometry and texture URLs (decode them)
          geometryUrl: geometryUrlRaw ? decodeURIComponent(geometryUrlRaw) : undefined,
          textureUrl: textureUrlRaw ? decodeURIComponent(textureUrlRaw) : undefined,
          skipVanillaResources: skipVanillaResources,
          // For structureViewer mode - support structure URL
          structureUrl: structureUrlRaw ? decodeURIComponent(structureUrlRaw) : undefined,
          // For worldViewer mode - support world URL
          worldUrl: worldUrlRaw ? decodeURIComponent(worldUrlRaw) : undefined,
          hideChrome: hideChrome,
          showEditorTools: showEditorTools,
          cameraX: cameraX ? parseFloat(cameraX) : undefined,
          cameraY: cameraY ? parseFloat(cameraY) : undefined,
          cameraZ: cameraZ ? parseFloat(cameraZ) : undefined,
        };
      }
    }

    if (hash === "" && !this._lastHashProcessed) {
      this._lastHashProcessed = hash;
      return;
    }

    if (hash !== this._lastHashProcessed) {
      this._lastHashProcessed = hash;

      const firstSlash = hash.indexOf("/");

      if (firstSlash > 1) {
        const commandToken = hash.substring(1, firstSlash).toLowerCase();

        const commandData = hash.substring(firstSlash + 1, hash.length);

        if (commandToken === "project") {
          const segments = commandData.split("/");

          if (segments.length >= 1) {
            const projectName = decodeURIComponent(segments[0]);

            // Look up the project by name from CreatorTools
            const ct = CreatorToolsHost.getCreatorTools();
            const existingProject = ct?.getProjectByName(projectName);

            if (existingProject) {
              // Reconstruct remaining path segments as the initial focus path
              const focusPath =
                segments.length > 1
                  ? ProjectEditorUtilities.convertStoragePathFromBrowserSafe("/" + segments.slice(1).join("/"))
                  : undefined;

              return {
                mode: AppMode.project,
                activeProject: existingProject,
                initialFocusPath: focusPath,
              };
            } else if (segments.length === 1 && !ct?.isLoaded) {
              // Legacy fallback: if CreatorTools hasn't loaded yet and it's a single
              // segment, treat it as a selectedItem (old behavior for #project/<item>)
              this._handleNewProject({ name: "Project" }, NewProjectTemplateType.gameTest);

              return {
                mode: AppMode.project,
                activeProject: this.state?.activeProject,
                selectedItem: segments[0],
              };
            }
          }
        } else if (commandToken === "toolbox") {
          const segments = commandData.split("/");

          if (segments.length === 1) {
            this._handleNewProject({ name: "Project" }, NewProjectTemplateType.gameTest);

            return {
              mode: AppMode.codeToolbox,
              activeProject: this.state?.activeProject,
              selectedItem: segments[0],
            };
          }
        }
      } else {
        const commandToken = hash.substring(1).toLowerCase();
        const commandMode = this._getModeFromString(commandToken);

        if (commandMode) {
          return {
            mode: commandMode,
            activeProject: null,
          };
        }
      }
    }

    return undefined;
  }

  setHomeWithError(errorMessage: string) {
    // Track error for telemetry
    telemetryService.trackException({
      exception: new Error(errorMessage),
      properties: {
        [TelemetryProperties.ERROR_MESSAGE]: errorMessage,
        [TelemetryProperties.LOCATION]: "App.setHomeWithError",
        [TelemetryProperties.ACTION_SOURCE]: "navigation",
      },
      severityLevel: TelemetrySeverity.ERROR,
    });

    this.setState((prevState) => ({
      ...prevState,
      mode: AppMode.home,
      activeProject: null,
      errorMessage: errorMessage,
      initialProjectEditorMode: undefined,
    }));
  }

  componentDidMount() {
    if (!this._isMountedInternal) {
      if (this.props.fileContentRetriever) {
        this.props.fileContentRetriever(this._getFileContent);
      }

      if (this.props.saveAllRetriever) {
        this.props.saveAllRetriever(this._saveAll);
      }

      const ct = CreatorToolsHost.getCreatorTools();

      if (ct && !ct.isLoaded) {
        CreatorToolsHost.onInitialized.subscribe(this._handleCreatorToolsInit);

        this.loadCreatorTools(ct).then(this.processInitialUrl);
      } else {
        this.processInitialUrl();
      }

      // Subscribe to theme changes to re-render FluentUI components
      CreatorToolsHost.onThemeChanged.subscribe(this._handleThemeChanged);

      if (typeof window !== "undefined") {
        window.addEventListener("hashchange", this._handleHashChange, false);
        window.addEventListener("resize", this._incrementVisualSeed, false);
        window.addEventListener("beforeunload", this._handleBeforeUnload);
        window.setInterval(this._tick, LOADING_INTERVAL_MS);
      }
    }

    this._isMountedInternal = true;

    if (this._pendingState) {
      this.setState((prevState) => ({
        ...prevState,
        ...this._pendingState,
      }));
      this._pendingState = undefined;
    }
  }

  processInitialUrl() {
    // Use pending URL state from loadCreatorTools if available (the hash was already
    // consumed there), otherwise try parsing the URL fresh.
    const stateFromUrl = this._pendingUrlState || this._getStateFromUrlWithSideEffects();
    this._pendingUrlState = undefined;

    let initialAppMode = AppMode.home;

    if (stateFromUrl) {
      initialAppMode = stateFromUrl.mode;
    } else if (CreatorToolsHost.initialMode) {
      const mode = this._getModeFromString(CreatorToolsHost.initialMode);

      if (mode) {
        initialAppMode = mode;
      }
    }

    let selectedItem: string | undefined = undefined;

    // Handle auto-login via tempPasscode in hash (from view command)
    if (typeof window !== "undefined") {
      const hash = window.location.hash;
      if (hash.includes("tempPasscode=")) {
        const passcodeMatch = hash.match(/tempPasscode=([a-zA-Z0-9-]+)/);
        if (passcodeMatch && passcodeMatch[1]) {
          const tempPasscode = passcodeMatch[1];
          // Auto-authenticate and clear the passcode from the URL
          this._autoAuthenticateAndLoadContent(tempPasscode, initialAppMode);
          // Clear the hash to remove the passcode from URL
          window.history.replaceState(null, "", window.location.pathname + window.location.search);
          return; // The _autoAuthenticateAndLoadContent will set state
        }
      }
    }

    // Handle contentUrl loading (view mode without tempPasscode)
    if (CreatorToolsHost.contentUrl && initialAppMode === AppMode.project) {
      this._loadProjectFromContentUrl();
      return; // The _loadProjectFromContentUrl will set state
    }

    // VS Code webview route - must check BEFORE hasAppServiceOrSim because VS Code also sets window.api
    if (
      (CreatorToolsHost.hostType === HostType.vsCodeWebWeb || CreatorToolsHost.hostType === HostType.vsCodeMainWeb) &&
      CreatorToolsHost.projectPath &&
      (initialAppMode === AppMode.codeToolbox || initialAppMode === AppMode.codeStartPage)
    ) {
      this._loadLocalStorageProject();
    } else if (
      // electron open from path on the command line route
      AppServiceProxy.hasAppServiceOrSim &&
      CreatorToolsHost.hostType !== HostType.vsCodeWebWeb &&
      CreatorToolsHost.hostType !== HostType.vsCodeMainWeb &&
      CreatorToolsHost.projectPath
    ) {
      this._ensureProjectFromFolder(CreatorToolsHost.projectPath, CreatorToolsHost.focusPath);
    } else if (CreatorToolsHost.modeParameter && CreatorToolsHost.modeParameter.startsWith("project/")) {
      const segments = CreatorToolsHost.modeParameter.split("/");

      if (segments.length === 2) {
        this._handleNewProject({ name: "Project" }, NewProjectTemplateType.gameTest);

        selectedItem = segments[1];
      }
    } else if (
      CreatorToolsHost.initialMode &&
      (CreatorToolsHost.modeParameter || CreatorToolsHost.initialMode === "info") &&
      CreatorToolsHost.projectPath
    ) {
      this._loadLocalStorageProject();
    } else if (stateFromUrl?.activeProject && initialAppMode === AppMode.project) {
      // URL hash encoded a project name (e.g., #project/<name>/<path>) and we matched it.
      // Load the project asynchronously and return — _handleProjectSelected sets state.
      const projectToRestore = stateFromUrl.activeProject;
      const focusPath = stateFromUrl.initialFocusPath;

      this.setState((prevState) => ({
        ...prevState,
        mode: AppMode.loading,
        loadingMessage: "Opening " + StorageUtilities.getFriendlyDisplayName(projectToRestore.simplifiedName) + "...",
      }));

      projectToRestore
        .loadPreferencesAndFolder()
        .then(async () => {
          await projectToRestore.ensureInflated();

          this._updateWindowTitle(AppMode.project, projectToRestore);
          this.initProject(projectToRestore);
          // Don't call _setProjectHash here — the URL already contains the full
          // hash with the file path from the original page load.

          this.setState((prevState) => ({
            ...prevState,
            mode: AppMode.project,
            initialFocusPath: focusPath,
            activeProject: projectToRestore,
          }));
        })
        .catch((err) => {
          Log.debug("Failed to restore project from URL: " + (err instanceof Error ? err.message : String(err)));
          this.setState((prevState) => ({
            ...prevState,
            mode: AppMode.home,
            loadingMessage: undefined,
            activeProject: null,
          }));
        });
      return;
    }

    this.setState((prevState) => ({
      ...prevState,
      mode: initialAppMode,
      selectedItem: stateFromUrl?.selectedItem || selectedItem,
      activeProject: null,
      // For modelViewer mode - preserve geometry and texture URLs from query params
      geometryUrl: stateFromUrl?.geometryUrl,
      textureUrl: stateFromUrl?.textureUrl,
      skipVanillaResources: stateFromUrl?.skipVanillaResources,
      // For structureViewer mode - preserve structure URL
      structureUrl: stateFromUrl?.structureUrl,
      // For worldViewer mode - preserve world URL
      worldUrl: stateFromUrl?.worldUrl,
      // Hide chrome for headless rendering
      hideChrome: stateFromUrl?.hideChrome,
      // Show editor tools
      showEditorTools: stateFromUrl?.showEditorTools,
      // Camera position for multi-angle rendering
      cameraX: stateFromUrl?.cameraX,
      cameraY: stateFromUrl?.cameraY,
      cameraZ: stateFromUrl?.cameraZ,
    }));
  }

  /**
   * Auto-authenticate using a temporary passcode and then load content from contentUrl.
   * This is used by the CLI view command to auto-login the browser.
   * @param tempPasscode The temporary passcode to authenticate with
   * @param initialAppMode The app mode to use after authentication (defaults to project mode)
   */
  private async _autoAuthenticateAndLoadContent(tempPasscode: string, initialAppMode: AppMode = AppMode.project) {
    try {
      // Post to /api/auth to authenticate with the passcode
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `passcode=${encodeURIComponent(tempPasscode)}`,
      });

      if (!response.ok) {
        Log.error("Auto-authentication failed: " + response.status);
        this.setState((prevState) => ({
          ...prevState,
          mode: AppMode.home,
          errorMessage: "Authentication failed. Please try again.",
        }));
        return;
      }

      // Extract the auth token from the response
      // Format: token|iv|authTag (all 3 parts required for GCM decryption)
      const authResult = await response.json();
      const authToken =
        authResult.token && authResult.iv && authResult.authTag
          ? `${authResult.token}|${authResult.iv}|${authResult.authTag}`
          : undefined;

      if (!authToken) {
        Log.error("Auto-authentication failed: no token received");
        this.setState((prevState) => ({
          ...prevState,
          mode: AppMode.home,
          errorMessage: "Authentication failed: no token received.",
        }));
        return;
      }

      // Store the token and passcode in CreatorTools
      const ct = CreatorToolsHost.getCreatorTools();
      if (ct) {
        ct.remoteServerAuthToken = authToken;
        // Store passcode for RemoteMinecraft.initialize() to use
        ct.remoteServerPasscode = tempPasscode;
        // Also store permission level from auth result if available
        if (authResult.permissionLevel !== undefined) {
          ct.remoteServerAccessLevel = authResult.permissionLevel;
        }
      }

      // If we have a contentUrl and are in project mode, load the project
      if (CreatorToolsHost.contentUrl && initialAppMode === AppMode.project) {
        await this._loadProjectFromContentUrl(authToken);
      } else if (initialAppMode === AppMode.webServer && ct) {
        // For webserver mode, initialize RemoteMinecraft with the auth we already obtained
        ct.ensureRemoteMinecraft();
        if (ct.remoteMinecraft) {
          // We already have the token, just need to set up the connection
          await ct.remoteMinecraft.initialize();
        }
        this.setState((prevState) => ({
          ...prevState,
          mode: initialAppMode,
        }));
      } else {
        // For other modes, just set the mode
        this.setState((prevState) => ({
          ...prevState,
          mode: initialAppMode,
        }));
      }
    } catch (e: any) {
      Log.error("Auto-authentication error: " + e.toString());
      this.setState((prevState) => ({
        ...prevState,
        mode: AppMode.home,
        errorMessage: "Could not connect to server: " + e.toString(),
      }));
    }
  }

  /**
   * Load a project from the content URL (served by HttpServer's /api/content endpoint).
   * This creates an HttpStorage-backed project in read-only mode.
   * @param authToken Optional auth token to use for authenticated requests
   */
  private async _loadProjectFromContentUrl(authToken?: string) {
    const contentUrl = CreatorToolsHost.contentUrl;
    if (!contentUrl) {
      Log.error("No content URL specified for view mode");
      this.setState((prevState) => ({
        ...prevState,
        mode: AppMode.home,
        errorMessage: "No content URL specified.",
      }));
      return;
    }

    try {
      const ct = CreatorToolsHost.getCreatorTools();
      if (!ct || !ct.isLoaded) {
        Log.error("CreatorTools not loaded for view mode");
        this.setState((prevState) => ({
          ...prevState,
          mode: AppMode.home,
          errorMessage: "Application not ready.",
        }));
        return;
      }

      this.setState((prevState) => ({
        ...prevState,
        mode: AppMode.loading,
        loadingMessage: "Loading content...",
      }));

      // Create HttpStorage pointing to the content endpoint
      // Set auth token for Authorization header on authenticated /api/content requests
      const contentStorage = HttpStorage.get(contentUrl);
      if (authToken) {
        contentStorage.authToken = authToken;
      } else if (ct.remoteServerAuthToken) {
        contentStorage.authToken = ct.remoteServerAuthToken;
      }

      // In edit mode (not read-only), allow storage to perform write operations
      if (!CreatorToolsHost.readOnly) {
        contentStorage.readOnly = false;
      }

      // Store reference for cleanup
      this._contentStorage = contentStorage;

      // Connect to WebSocket notification server for real-time updates (including shutdown notifications)
      try {
        await contentStorage.connect();

        // Subscribe to shutdown notifications to inform user when server goes away
        contentStorage.onServerShutdown.subscribe(this._handleServerShutdown);
      } catch (e) {
        // WebSocket connection is optional - log but don't fail
        Log.debug("Could not connect to WebSocket notification server: " + e);
      }

      await contentStorage.rootFolder.load();

      // Create a new project with this storage
      const projectName = "Viewed Content";
      const newProject = new Project(ct, projectName, null);

      newProject.setProjectFolder(contentStorage.rootFolder);

      // Set read-only mode
      if (CreatorToolsHost.readOnly) {
        newProject.readOnlySafety = true;
      }

      await newProject.attemptToLoadPreferences();
      await newProject.inferProjectItemsFromFiles(true, this._doLog);

      this._doLog("Opening project in view mode...");

      // Set project and use read-only mode
      this._updateWindowTitle(AppMode.projectReadOnly, newProject);
      this.initProject(newProject);
      newProject.lastOpened = new Date();

      this.setState((prevState) => ({
        ...prevState,
        mode: CreatorToolsHost.readOnly ? AppMode.projectReadOnly : AppMode.project,
        activeProject: newProject,
      }));
    } catch (e: any) {
      Log.error("Error loading project from content URL: " + e.toString());
      this.setState((prevState) => ({
        ...prevState,
        mode: AppMode.home,
        errorMessage: "Could not load content: " + e.toString(),
      }));
    }
  }

  componentWillUnmount() {
    if (typeof window !== "undefined") {
      window.removeEventListener("hashchange", this._handleHashChange, false);
      window.removeEventListener("resize", this._incrementVisualSeed, false);
      window.removeEventListener("beforeunload", this._handleBeforeUnload);
    }

    // Unsubscribe from theme changes
    CreatorToolsHost.onThemeChanged.unsubscribe(this._handleThemeChanged);

    // Unsubscribe from content storage shutdown notifications
    if (this._contentStorage) {
      this._contentStorage.onServerShutdown.unsubscribe(this._handleServerShutdown);
      this._contentStorage.disconnect();
      this._contentStorage = undefined;
    }

    this._isMountedInternal = false;
  }

  /**
   * Handle theme changes from CreatorToolsHost.
   * Forces a re-render so the app gets the new theme.
   */
  private _handleThemeChanged() {
    // Force re-render to update app with new theme
    this.forceUpdate();
  }

  /**
   * Handle server shutdown notification from WebSocket.
   * Shows an error message to inform the user the server has disconnected.
   */
  private _handleServerShutdown = (_storage: HttpStorage, _data: { reason: string; graceful: boolean }) => {
    const message =
      "WARNING: The web server for this page has shutdown. This page will not continue to work, and any edits WILL NOT BE saved.";

    // Set error message to show banner in the UI
    this.setState((prevState) => ({
      ...prevState,
      errorMessage: message,
    }));
  };

  private async _doLog(message: string) {
    this.setState((prevState) => ({
      ...prevState,
      mode: AppMode.loading,
      loadingMessage: message,
    }));
  }

  private async _considerSubmittedFiles(path: string, files: File[]) {
    let shouldIndividuallyIntegrateFiles = false;

    for (const file of files) {
      if (!StorageUtilities.isContainerFile(file.name)) {
        shouldIndividuallyIntegrateFiles = true;
      }
    }

    if (shouldIndividuallyIntegrateFiles) {
      this.setState((prevState) => ({
        ...prevState,
        mode: AppMode.importFiles,
        submittedFiles: files,
      }));

      return;
    }

    let fileName = "File";

    if (files.length < 1) {
      return;
    }

    if (files[0].name) {
      fileName = files[0].name;

      fileName = StorageUtilities.getBaseFromName(fileName);
    }

    this._handleNewProject(
      {
        name: fileName,
      },
      NewProjectTemplateType.empty,
      path,
      files,
      undefined,
      undefined
    );
  }

  private async _handleNewProject(
    newProjectSeed: IProjectSeed,
    newProjectType: NewProjectTemplateType,
    additionalFilePath?: string,
    additionalFiles?: File[],
    editorStartMode?: ProjectEditorMode,
    startInReadOnly?: boolean
  ) {
    const ct = CreatorToolsHost.getCreatorTools();
    if (!ct || !ct.isLoaded) {
      return;
    }

    let newProjectName = newProjectSeed.name;

    if (!newProjectName) {
      newProjectName = "New Project";
    }

    if (additionalFiles && additionalFilePath && this.state && this._isMountedInternal) {
      this._doLog(
        "Loading " + newProjectName + (additionalFilePath.length > 2 ? " from " + additionalFilePath : "") + "..."
      );
    }

    let newProject: Project | null = null;
    let focus = ProjectFocus.gameTests;

    if (newProjectType === NewProjectTemplateType.gameTest) {
      focus = ProjectFocus.gameTests;
    } else if (newProjectType === NewProjectTemplateType.empty) {
      focus = ProjectFocus.general;
    }

    if (newProjectSeed.path === undefined) {
      newProject = await ct.createNewProject(
        newProjectName,
        newProjectSeed.path,
        newProjectSeed.targetFolder,
        newProjectSeed.targetFolderTitle,
        focus,
        true,
        ProjectScriptLanguage.typeScript
      );
    } else {
      newProject = await ct.ensureProjectForLocalFolder(newProjectSeed.path, newProjectName, false);

      await newProject.ensureProjectFolder();

      newProject.focus = focus;

      await ProjectUtilities.ensureDefaultItems(newProject);
    }

    if (additionalFiles && additionalFilePath) {
      for (const additionalFile of additionalFiles) {
        if (StorageUtilities.isContainerFile(additionalFile.name)) {
          // For container files (zip, mcworld, mcaddon, etc.), extract contents to project root
          // Track container file opened
          const fileExtension = additionalFile.name.split(".").pop()?.toLowerCase() || "unknown";
          telemetryService.trackEvent({
            name: TelemetryEvents.PROJECT_IMPORTED,
            properties: {
              [TelemetryProperties.FILE_FORMAT]: fileExtension,
              [TelemetryProperties.OPEN_METHOD]: "templateWithFiles",
              [TelemetryProperties.ACTION_SOURCE]: "newProjectWithFiles",
            },
          });
          await ProjectEditorUtilities.extractZipContentsToProject(newProject, additionalFile);
        } else {
          await ProjectEditorUtilities.integrateBrowserFileDefaultAction(
            newProject,
            additionalFilePath,
            additionalFile
          );
        }
      }
    }

    await newProject.save(true);
    await ct.save();

    this._updateWindowTitle(AppMode.project, newProject);

    let nextMode = this.state.mode;

    if (nextMode === AppMode.home || nextMode === AppMode.loading) {
      if (startInReadOnly) {
        nextMode = AppMode.projectReadOnly;
      } else {
        nextMode = AppMode.project;
      }
    }

    this.initProject(newProject);

    if (this.state && this._isMountedInternal) {
      this.setState((prevState) => ({
        ...prevState,
        mode: nextMode,
        activeProject: newProject,
        initialProjectEditorMode: editorStartMode,
      }));
    }
  }

  private async _ensureProjectFromFolder(folderPath: string, focusPath?: string) {
    const ct = CreatorToolsHost.getCreatorTools();
    if (!ct || !ct.isLoaded) {
      return;
    }

    let folderPathCanon = StorageUtilities.ensureEndsWithDelimiter(StorageUtilities.canonicalizePath(folderPath));

    // this will have the effect of loading all existing projects' pref files, which might be a bit slow
    for (const project of ct.projects) {
      if (!project.isLoaded) {
        await project.loadPreferencesAndFolder();
      }

      if (
        project.localFolderPath &&
        StorageUtilities.ensureEndsWithDelimiter(StorageUtilities.canonicalizePath(project.localFolderPath)) ===
          folderPathCanon
      ) {
        await project.loadPreferencesAndFolder();
        await project.ensureInflated();

        this._setProject(project, focusPath);
        return;
      }
    }

    this._handleNewProjectFromFolder(folderPath, focusPath);
  }

  private async _handleNewProjectFromFolder(folderPath: string, focusPath?: string) {
    const ct = CreatorToolsHost.getCreatorTools();

    if (!ct || !ct.isLoaded) {
      return;
    }

    const folderName = StorageUtilities.getFriendlyDisplayName(StorageUtilities.getLeafName(folderPath) || folderPath);

    this.setState((prevState) => ({
      ...prevState,
      mode: AppMode.loading,
      loadingMessage: "Opening " + folderName + "...",
    }));

    try {
      const newProject = await ct.ensureProjectForLocalFolder(folderPath);
      newProject.save();
      ct.save();

      this._setProject(newProject, focusPath);
    } catch (e) {
      Log.debug("Failed to create project from folder: " + e);
    }
  }

  private _setProject(project: Project, focusPath?: string) {
    this._updateWindowTitle(AppMode.project, project);
    this.initProject(project);

    project.lastOpened = new Date();

    telemetryService.trackEvent({
      name: TelemetryEvents.PROJECT_LOADED,
      properties: {
        [TelemetryProperties.PROJECT_ITEM_COUNT]: project.items.length,
      },
    });

    this._setProjectHash(project);

    this.setState((prevState) => ({
      ...prevState,
      mode: AppMode.project,
      initialFocusPath: focusPath,
      activeProject: project,
    }));
  }

  private async _handleNewProjectFromFolderInstance(folder: IFolder, name?: string, isDocumentationProject?: boolean) {
    const ct = CreatorToolsHost.getCreatorTools();

    if (!ct || !ct.isLoaded) {
      return;
    }

    const displayName = StorageUtilities.getFriendlyDisplayName(name ? name : folder.name);

    this.setState((prevState) => ({
      ...prevState,
      mode: AppMode.loading,
      loadingMessage: "Opening " + displayName + "...",
    }));

    try {
      this._doLog("Loading project from '" + name + "' folder.");

      const newProject = new Project(ct, displayName, null);

      newProject.setProjectFolder(folder);
      newProject.projectFolderTitle = name;

      await newProject.attemptToLoadPreferences();

      if (isDocumentationProject) {
        await ProjectUtilities.prepareProjectForDocumentation(newProject);
      }

      await newProject.inferProjectItemsFromFiles(true, this._doLog);

      this._doLog("Opening project...");

      ct.save();

      this._setProject(newProject);
    } catch (e) {
      Log.debug("Failed to create project from folder instance: " + e);
    }
  }

  private async _handleNewProjectFromImportFiles(
    files: { file: File; name: string; vanillaOverridePath?: string; suggestedFolder?: string }[],
    projectName?: string
  ) {
    const ct = CreatorToolsHost.getCreatorTools();
    if (!ct || !ct.isLoaded) {
      return;
    }

    const finalProjectName = projectName || "New Project";

    this._doLog("Creating new project '" + finalProjectName + "' from imported files...");

    const newProject = await ct.createNewProject(
      finalProjectName,
      undefined,
      undefined,
      undefined,
      ProjectFocus.general,
      true,
      ProjectScriptLanguage.typeScript
    );

    for (const fileInfo of files) {
      if (fileInfo.vanillaOverridePath) {
        // Handle vanilla override - use the vanilla override path as the integration path
        await ProjectEditorUtilities.integrateBrowserFileDefaultAction(
          newProject,
          fileInfo.vanillaOverridePath,
          fileInfo.file
        );
      } else if (StorageUtilities.isContainerFile(fileInfo.file.name)) {
        // For container files (zip, mcworld, mcaddon, etc.), extract contents to project root
        // Track container file opened
        const fileExtension = fileInfo.file.name.split(".").pop()?.toLowerCase() || "unknown";
        telemetryService.trackEvent({
          name: TelemetryEvents.PROJECT_IMPORTED,
          properties: {
            [TelemetryProperties.FILE_FORMAT]: fileExtension,
            [TelemetryProperties.OPEN_METHOD]: "filePicker",
            [TelemetryProperties.ACTION_SOURCE]: "importFiles",
          },
        });
        await ProjectEditorUtilities.extractZipContentsToProject(newProject, fileInfo.file);
      } else {
        // Default integration for non-container files
        await ProjectEditorUtilities.integrateBrowserFileDefaultAction(newProject, "", fileInfo.file);
      }
    }

    await newProject.save(true);
    await ct.save();

    this._updateWindowTitle(AppMode.project, newProject);

    this.initProject(newProject);

    if (this.state && this._isMountedInternal) {
      this.setState((prevState) => ({
        ...prevState,
        mode: AppMode.project,
        activeProject: newProject,
      }));
    }
  }

  private async _handleUpdateExistingProject(project: Project, files: { file: File; name: string }[]) {
    const ct = CreatorToolsHost.getCreatorTools();
    if (!ct || !ct.isLoaded) {
      return;
    }

    this._doLog("Updating project '" + project.name + "' with imported files...");

    for (const fileInfo of files) {
      // Find matching item in project
      for (const item of project.items) {
        if (item.primaryFile && item.primaryFile.name.toLowerCase() === fileInfo.name.toLowerCase()) {
          // Update the file content
          const arrayBuffer = await fileInfo.file.arrayBuffer();
          const content = new Uint8Array(arrayBuffer);
          await item.primaryFile.setContent(content);
          await item.primaryFile.saveContent();
          break;
        }
      }
    }

    await project.save(true);
    await ct.save();

    this._doLog("Project updated successfully.");

    // If this project is currently active, refresh it
    if (this.state.activeProject === project) {
      this.forceUpdate();
    } else {
      // Switch to the updated project
      this._setProject(project);
    }
  }

  private async _newProjectFromGalleryId(galleryId: string, updateContent?: IFolder) {
    const ct = CreatorToolsHost.getCreatorTools();
    if (ct === undefined) {
      return;
    }

    const gp = await ct.getGalleryProjectById(galleryId);

    if (gp === undefined) {
      this.setHomeWithError("We could not find a starter/sample named '" + galleryId + "' that could be opened.");
      return;
    }

    this._newProjectFromGallery({ galleryProject: gp }, updateContent);
  }

  private async _ensureProjectFromGalleryId(galleryId: string, updateContent?: IFolder) {
    const ct = CreatorToolsHost.getCreatorTools();
    if (ct === undefined) {
      return;
    }

    const gp = await ct.getGalleryProjectById(galleryId);

    if (gp === undefined) {
      this.setHomeWithError("We could not find a starter/sample named '" + galleryId + "' that could be opened.");
      return;
    }

    this._ensureProjectFromGallery(gp, updateContent);
  }

  private async _ensureProjectFromGallery(project: IGalleryItem, updateContent?: IFolder) {
    this._ensureProjectFromGitHubTemplate(
      project.title,
      project.gitHubOwner,
      project.gitHubRepoName,
      false,
      project.gitHubBranch,
      project.gitHubFolder,
      project.fileList,
      project.id,
      project.sampleSet,
      project.type === GalleryItemType.codeSample ? project.id : undefined,
      updateContent
    );
  }

  private async _ensureProjectFromGitHubTemplate(
    title: string,
    gitHubOwner: string,
    gitHubRepoName: string,
    isReadOnly: boolean,
    gitHubBranch?: string,
    gitHubFolder?: string,
    fileList?: string[],
    projectId?: string,
    sampleSet?: string,
    sampleId?: string,
    updateContent?: IFolder,
    description?: string
  ) {
    const creatorTools = CreatorToolsHost.getCreatorTools();

    if (this.state === null || creatorTools === undefined || this._loadingMessage !== undefined) {
      return;
    }

    this._loadingMessage = "opening GitHub " + gitHubOwner + "/" + gitHubRepoName + "...";

    let newMode = AppMode.project;

    if (isReadOnly) {
      newMode = AppMode.projectReadOnly;
    }

    this._updateWindowTitle(AppMode.loading, null);

    this.setState((prevState) => ({
      ...prevState,
      mode: AppMode.loading,
      activeProject: null,
      loadingMessage: this._loadingMessage,
      additionalLoadingMessage: undefined,
    }));

    await creatorTools.load();

    const projects = creatorTools.projects;

    for (let i = 0; i < projects.length; i++) {
      const proj = projects[i];

      await proj.loadPreferencesAndFolder();

      if (
        proj.originalGitHubOwner === gitHubOwner &&
        proj.originalGitHubRepoName === gitHubRepoName &&
        proj.originalGitHubBranch === gitHubBranch &&
        proj.originalGitHubFolder === gitHubFolder &&
        (sampleId === undefined || proj.originalSampleId === sampleId) &&
        updateContent === undefined
      ) {
        await proj.ensureInflated();

        this._updateWindowTitle(newMode, proj);

        this.initProject(proj);

        this.setState((prevState) => ({
          ...prevState,
          mode: newMode,
          activeProject: proj,
        }));

        return;
      }
    }

    this._newProjectFromGitHubTemplate(
      title,
      gitHubOwner,
      gitHubRepoName,
      isReadOnly,
      gitHubBranch,
      gitHubFolder,
      fileList,
      projectId,
      sampleSet,
      sampleId,
      updateContent,
      {
        name: description,
      }
    );
  }

  private async _newProjectFromGallery(newProjectSeed: IProjectSeed, updateContent?: IFolder) {
    try {
      const galleryItem = newProjectSeed.galleryProject;

      if (!galleryItem) {
        Log.unexpectedUndefined("ANPFG");
        return;
      }

      await this._newProjectFromGitHubTemplate(
        galleryItem.title,
        galleryItem.gitHubOwner,
        galleryItem.gitHubRepoName,
        false,
        galleryItem.gitHubBranch,
        galleryItem.gitHubFolder,
        galleryItem.fileList,
        galleryItem.id,
        galleryItem.sampleSet,
        galleryItem.type === GalleryItemType.codeSample || galleryItem.type === GalleryItemType.editorCodeSample
          ? galleryItem.id
          : undefined,
        updateContent,
        newProjectSeed,
        galleryItem.type
      );
    } catch (e) {
      const errorMessage = "Could not create a new project. " + (e instanceof Error ? e.message : String(e));
      Log.error(errorMessage);
      this.setHomeWithError(errorMessage);
    }
  }

  private async _newProjectFromGitHubTemplate(
    title: string,
    gitHubOwner: string,
    gitHubRepoName: string,
    isReadOnly: boolean,
    gitHubBranch?: string,
    gitHubFolder?: string,
    fileList?: string[],
    galleryId?: string,
    sampleSet?: string,
    sampleId?: string,
    updateContent?: IFolder,
    projectSeed?: IProjectSeed,
    galleryType?: GalleryItemType
  ) {
    const creatorTools = CreatorToolsHost.getCreatorTools();

    if (this.state === null || creatorTools === undefined) {
      return;
    }

    let suggestedCreator = projectSeed?.creator;
    let suggestedName = projectSeed?.name;
    let suggestedShortName = projectSeed?.shortName;
    let description = projectSeed?.description;

    if (suggestedCreator === undefined) {
      suggestedCreator = creatorTools.creator;
    } else if (suggestedCreator !== DefaultCreatorName) {
      creatorTools.creator = suggestedCreator;
    }

    if (suggestedName === undefined) {
      suggestedName = title;
    }

    if (suggestedName && suggestedCreator && suggestedShortName === undefined) {
      suggestedShortName = ProjectUtilities.getSuggestedProjectShortName(suggestedCreator, suggestedName);
    }

    this._loadingMessage = "opening sample " + gitHubOwner + "/" + gitHubRepoName + "...";

    this._updateWindowTitle(AppMode.loading, null);

    this.setState((prevState) => ({
      ...prevState,
      mode: AppMode.loading,
      activeProject: null,
      loadingMessage: this._loadingMessage,
      additionalLoadingMessage: undefined,
    }));

    await creatorTools.load();

    const operId = await creatorTools.notifyOperationStarted("Creating new project from '" + title + "'");

    if (gitHubOwner !== undefined && gitHubRepoName !== undefined) {
      let gh = undefined;

      let repoUrl = undefined;

      if (
        galleryType === GalleryItemType.entityType ||
        galleryType === GalleryItemType.blockType ||
        galleryType === GalleryItemType.itemType
      ) {
        repoUrl = CreatorToolsHost.contentWebRoot + "res/samples/microsoft/samples/addon_starter/start/";
      } else {
        // Map GitHub repo names to shortened local folder names to keep paths
        // under filesystem length limits (see samples.resources.json replaceFirstFolderWith).
        const localFolder = GalleryReader.getLocalRepoFolder(gitHubRepoName ?? "", gitHubBranch);

        repoUrl =
          CreatorToolsHost.contentWebRoot + "res/samples/" + gitHubOwner + "/" + localFolder + "/" + gitHubFolder;
      }

      if (Database.local && (CreatorToolsHost.fullLocalStorage || !CreatorToolsHost.contentWebRoot)) {
        gh = Database.local.createStorage(repoUrl);

        if (!gh) {
          throw new Error("Could not load local storage: " + repoUrl);
        }
      } else {
        gh = HttpStorage.get(repoUrl);
      }

      let projName = suggestedName
        ? suggestedName
        : ProjectUtilities.getSuggestedProjectNameFromElements(galleryId, gitHubFolder, gitHubRepoName);

      const newProjectName = await creatorTools.getNewProjectName(projName);

      let focus = ProjectFocus.general;

      if (galleryType === GalleryItemType.editorProject) {
        focus = ProjectFocus.editorExtension;
      } else if (galleryType === GalleryItemType.codeSample || galleryType === GalleryItemType.editorCodeSample) {
        focus = ProjectFocus.focusedCodeSnippet;
      }

      const newProject = await creatorTools.createNewProject(
        newProjectName,
        projectSeed?.path,
        projectSeed?.targetFolder,
        projectSeed?.targetFolderTitle,
        focus,
        false
      );

      if (!gh.rootFolder.isLoaded) {
        await gh.rootFolder.load();
      }

      const rootFolder = await newProject.ensureProjectFolder();

      try {
        await StorageUtilities.syncFolderTo(
          gh.rootFolder,
          rootFolder,
          false,
          false,
          false,
          ProjectImportExclusions,
          undefined,
          this._gitHubAddingMessageUpdater
        );
      } catch (e: any) {
        const errorMessage = "Could not create a new project. " + e.toString();

        telemetryService.trackException({
          exception: e instanceof Error ? e : new Error(errorMessage),
          properties: {
            [TelemetryProperties.ERROR_MESSAGE]: errorMessage,
            [TelemetryProperties.LOCATION]: "App._handleNewProjectFromGitHub",
            [TelemetryProperties.ACTION_TYPE]: "projectCreation",
          },
          severityLevel: TelemetrySeverity.ERROR,
        });

        this.setState((prevState) => ({
          ...prevState,
          mode: AppMode.home,
          errorMessage: errorMessage,
        }));

        return;
      }

      newProject.originalGitHubOwner = gitHubOwner;
      newProject.originalFileList = fileList;
      newProject.originalGitHubRepoName = gitHubRepoName;
      newProject.originalGitHubBranch = gitHubBranch;
      newProject.originalGitHubFolder = gitHubFolder;
      newProject.originalGalleryId = galleryId;
      newProject.originalSampleId = sampleId;
      newProject.creator = suggestedCreator;
      newProject.shortName = suggestedShortName;
      newProject.track = projectSeed?.track;

      if (
        (galleryType === GalleryItemType.entityType ||
          galleryType === GalleryItemType.blockType ||
          galleryType === GalleryItemType.itemType) &&
        galleryId
      ) {
        const galleryProject = await creatorTools.getGalleryProjectById(galleryId);

        if (galleryProject) {
          if (galleryType === GalleryItemType.entityType) {
            await ProjectCreateManager.addEntityTypeFromGallery(newProject, galleryProject, suggestedName);
          } else if (galleryType === GalleryItemType.blockType) {
            await ProjectCreateManager.addBlockTypeFromGallery(newProject, galleryProject, suggestedName);
          } else if (galleryType === GalleryItemType.itemType) {
            await ProjectCreateManager.addItemTypeFromGallery(newProject, galleryProject, suggestedName);
          }
        }
      }

      if (sampleSet !== undefined && sampleId !== undefined) {
        const snippet = await Database.getSnippet(sampleSet, sampleId);

        Log.assertDefined(snippet, "Snippet " + sampleId + " could not be found.");

        if (snippet) {
          await ProjectUtilities.injectSnippet(newProject, snippet, galleryType === GalleryItemType.editorCodeSample);
        }
      }

      if (updateContent !== undefined && newProject.projectFolder !== null) {
        try {
          await StorageUtilities.syncFolderTo(
            updateContent,
            newProject.projectFolder,
            false,
            false,
            false,
            ["package.json", "package.lock.json", "gulpfile.js", "just.config.ts"],
            ["*.ts", "*.js", "*.json"],
            undefined,
            false,
            true
          );
        } catch (e) {
          this.setHomeWithError(
            "Could not process updated content from URL. Check to make sure your shared URL is valid. (" + e + ")"
          );
          return;
        }
      }

      description = description ? description : title;

      await ProjectUtilities.processNewProject(newProject, suggestedName, description, suggestedShortName, true);

      if (projectSeed?.postCreateAction) {
        newProject.pendingPostCreateAction = projectSeed.postCreateAction;
      }

      if (projectSeed?.contentDefinition) {
        newProject.pendingContentDefinition = projectSeed.contentDefinition;
      }

      await creatorTools.save();

      this._setProject(newProject);
    }

    await creatorTools.notifyOperationEnded(operId, "New project '" + title + "' created.  Have fun!");
  }

  private async _handlePersistenceUpgraded() {
    this.setState((prevState) => ({
      ...prevState,
      isPersisted: true,
    }));
  }

  private async _gitHubAddingMessageUpdater(additionalMessage: string) {
    this.setState((prevState) => ({
      ...prevState,
      loadingMessage: prevState.loadingMessage || "Loading.",
      additionalLoadingMessage: additionalMessage,
    }));
  }

  private async _newProjectFromMinecraftFolder(folderType: LocalFolderType, folder: IFolder) {
    const ct = CreatorToolsHost.getCreatorTools();

    if (!ct || !ct.isLoaded) {
      return;
    }

    let proposedProjectName = StorageUtilities.getBaseFromName(folder.fullPath);
    const mcw = await MCWorld.ensureMCWorldOnFolder(folder);

    if (mcw && mcw.name) {
      proposedProjectName = mcw.name;
    }

    const newProject = await ct.ensureProjectForLocalFolder(folder.fullPath, proposedProjectName);

    newProject.save();
    ct.save();

    this._updateWindowTitle(AppMode.project, newProject);
    this.initProject(newProject);

    this.setState((prevState) => ({
      ...prevState,
      mode: AppMode.project,
      activeProject: newProject,
    }));
  }

  private async _ensureProjectFromMinecraftFolder(folderType: LocalFolderType, folder: IFolder, isReadOnly: boolean) {
    const creatorTools = CreatorToolsHost.getCreatorTools();

    if (this.state === null || creatorTools === undefined) {
      return;
    }

    this._loadingMessage = "opening folder " + StorageUtilities.getFriendlyDisplayName(folder.fullPath) + "...";

    let newMode = AppMode.project;

    if (isReadOnly) {
      newMode = AppMode.projectReadOnly;
    }

    this._updateWindowTitle(AppMode.loading, null);

    this.setState((prevState) => ({
      ...prevState,
      mode: AppMode.loading,
      activeProject: null,
      loadingMessage: this._loadingMessage,
    }));

    await creatorTools.load();

    const projects = creatorTools.projects;
    const canonPath = StorageUtilities.canonicalizePath(folder.fullPath);

    for (let i = 0; i < projects.length; i++) {
      const proj = projects[i];

      await proj.loadPreferencesAndFolder();

      if (proj.originalFullPath === canonPath) {
        await proj.ensureInflated();

        this._updateWindowTitle(newMode, proj);
        this.initProject(proj);

        this.setState((prevState) => ({
          ...prevState,
          mode: newMode,
          activeProject: proj,
        }));

        return;
      }
    }

    const folderName = StorageUtilities.getLeafName(canonPath);

    const operId = await creatorTools.notifyOperationStarted("Creating new project from '" + canonPath + "'");

    if (folderName !== undefined) {
      let projName = "my-" + folderName;

      const newProjectName = await creatorTools.getNewProjectName(projName);

      let newFocus = ProjectFocus.focusedCodeSnippet;

      if (folderType === LocalFolderType.world) {
        newFocus = ProjectFocus.world;
      }

      projName = projName.replace(/_/gi, "");
      projName = projName.replace(/\//gi, "");
      projName = projName.replace(/\\/gi, "");
      projName = projName.replace(/ /gi, "");

      const newProject = await creatorTools.createNewProject(
        newProjectName,
        folder.fullPath,
        undefined,
        undefined,
        newFocus,
        false
      );

      await newProject.ensureProjectFolder();

      await newProject.inferProjectItemsFromFiles();

      newProject.save();

      creatorTools.save();

      this._setProject(newProject);
    }

    await creatorTools.notifyOperationEnded(operId, "New project '" + folderName + "' created. Have fun!");
  }

  private initProject(newProject: Project) {
    newProject.onItemChanged.subscribe(this._handleItemChanged);
    newProject.onSaved.subscribe(this._handleSaved);
  }

  private _updateWindowTitle(newMode: AppMode, activeProject: Project | null) {
    let title = "Minecraft Creator Tools";

    switch (newMode) {
      case AppMode.exporterTool:
        title = "Export - " + title;
        break;

      case AppMode.project:
      case AppMode.projectReadOnly:
        if (activeProject !== null) {
          const projName = activeProject.loc.getTokenValueOrDefault(activeProject.simplifiedName);
          title = projName + " - " + title;
        }
        break;

      case AppMode.loading:
        title = "Loading - " + title;
        break;
    }

    if (activeProject && activeProject.hasUnsavedChanges()) {
      title = "* " + title;
    }

    window.document.title = title;
  }

  private _handleProjectGalleryCommand(command: GalleryProjectCommand, projectSeed: IProjectSeed) {
    switch (command) {
      case GalleryProjectCommand.newProject:
      case GalleryProjectCommand.projectSelect:
        this._newProjectFromGallery(projectSeed);
        break;
      case GalleryProjectCommand.ensureProject:
        if (projectSeed.galleryProject) {
          this._ensureProjectFromGallery(projectSeed.galleryProject);
        }
        break;
    }
  }

  private _tick() {
    // work around for pop up menus in small window-height cases

    const cbElt = window.document.getElementById("cookie-banner");

    if (cbElt?.hasChildNodes()) {
      if (this.state && !this.state.hasBanner) {
        this.setState({
          mode: this.state.mode,
          isPersisted: this.state.isPersisted,
          loadingMessage: this.state.loadingMessage,
          initialFocusPath: this.state.initialFocusPath,
          additionalLoadingMessage: this.state.additionalLoadingMessage,
          activeProject: this.state.activeProject,
          hasBanner: true,
          selectedItem: this.state.selectedItem,
          initialProjectEditorMode: this.state.initialProjectEditorMode,
          visualSeed: this.state.visualSeed,
        });
      }
    } else if (this.state && this.state.hasBanner) {
      this.setState({
        mode: this.state.mode,
        isPersisted: this.state.isPersisted,
        loadingMessage: this.state.loadingMessage,
        initialFocusPath: this.state.initialFocusPath,
        additionalLoadingMessage: this.state.additionalLoadingMessage,
        activeProject: this.state.activeProject,
        hasBanner: false,
        selectedItem: this.state.selectedItem,
        initialProjectEditorMode: this.state.initialProjectEditorMode,
        visualSeed: this.state.visualSeed,
      });
    }

    const elts = window.document.getElementsByClassName("ui-toolbar__menu");

    if (elts && elts.length > 0) {
      for (let i = 0; i < elts.length; i++) {
        const elt = elts[i];
        if ((elt as HTMLElement).style && (elt as HTMLElement).style.transform) {
          const transform = (elt as HTMLElement).style.transform;

          let firstComma = transform.indexOf(", ");

          if (firstComma > 0 && firstComma < transform.length - 2 && transform[firstComma + 2] === "-") {
            let secondComma = transform.indexOf(", ", firstComma + 2);

            if (secondComma > 0) {
              (elt as HTMLElement).style.transform =
                transform.substring(0, firstComma + 2) +
                TOOLBAR_MENU_TRANSFORM_OFFSET +
                transform.substring(secondComma);
            }
          }
        }
      }
    }
  }

  private _handleLocalGalleryCommand(command: LocalGalleryCommand, folderType: LocalFolderType, folder: IFolder) {
    switch (command) {
      case LocalGalleryCommand.ensureAndOpenProjectFromFolder:
        this._newProjectFromMinecraftFolder(folderType, folder);
        break;
    }
  }

  private async _handleProjectSelected(project: Project) {
    this.setState((prevState) => ({
      ...prevState,
      mode: AppMode.loading,
      loadingMessage: "Opening " + StorageUtilities.getFriendlyDisplayName(project.simplifiedName) + "...",
    }));

    await project.loadPreferencesAndFolder();
    await project.ensureInflated();

    this._updateWindowTitle(AppMode.project, project);

    this.initProject(project);

    this._setProjectHash(project);

    this.setState({
      mode: AppMode.project,
      isPersisted: this.state.isPersisted,
      hasBanner: this.state.hasBanner,
      initialFocusPath: this.state.initialFocusPath,
      visualSeed: this.state.visualSeed,
      activeProject: project,
    });
  }

  private _handleModeChangeRequested = (newMode: AppMode, errorMessage?: string) => {
    this._updateWindowTitle(newMode, this.state.activeProject);

    // Clear the project hash when navigating away from a project view
    if (newMode !== AppMode.project && newMode !== AppMode.projectReadOnly) {
      this._clearProjectHash();
    }

    this.setState({
      mode: newMode,
      errorMessage: errorMessage,
      initialFocusPath: this.state.initialFocusPath,
      hasBanner: this.state.hasBanner,
      visualSeed: this.state.visualSeed,
      isPersisted: this.state.isPersisted,
    });
  };

  getTheme() {
    return CreatorToolsHost.theme === CreatorToolsThemeStyle.dark ? this.props.darkTheme : this.props.lightTheme;
  }

  render() {
    let interior = <></>;

    let isReadOnly = false;

    if (this.state.mode === AppMode.projectReadOnly) {
      isReadOnly = true;
    }

    // View mode is when the app was launched via `mct view` command
    // which sets contentUrl and readOnly mode
    const isViewMode = !!(CreatorToolsHost.contentUrl && CreatorToolsHost.readOnly);

    // hasContentSession is true when we have a local content URL (view OR edit mode)
    // This determines whether to show the Close button
    const hasContentSession = !!CreatorToolsHost.contentUrl;

    let top = <></>;
    let borderStr = "";
    let height = "100vh";
    let heightOffset = 0;

    // Only show Electron titlebar when we're in the Electron app, NOT in VSCode webviews
    const isVsCodeWebview =
      CreatorToolsHost.hostType === HostType.vsCodeMainWeb || CreatorToolsHost.hostType === HostType.vsCodeWebWeb;

    if (AppServiceProxy.hasAppServiceOrSim && !isVsCodeWebview) {
      top = <ElectronTitleBar mode={this.state.mode} key="app-letl" />;
      borderStr = "solid 1px black";

      height = `calc(100vh - ${ELECTRON_TITLEBAR_HEIGHT}px)`;
      heightOffset = ELECTRON_TITLEBAR_HEIGHT;
    } else if (this.state.hasBanner) {
      let bannerHeight = DEFAULT_BANNER_HEIGHT;
      const elt = window.document.getElementById("cookie-banner");
      if (elt && elt.offsetHeight > MIN_BANNER_OFFSET_HEIGHT) {
        bannerHeight = elt.offsetHeight + BANNER_EXTRA_HEIGHT;
      }

      height = `calc(100vh - ${bannerHeight}px)`;
      heightOffset = bannerHeight;
    }

    const ct = CreatorToolsHost.getCreatorTools();

    if (ct === undefined || !ct.isLoaded) {
      interior = (
        <div className="app-loadingArea" key="app-la">
          <div className="app-loading" aria-live="polite">
            Loading...
          </div>
        </div>
      );
    } else if (this.state.mode === AppMode.sessionEnded) {
      // View session has ended (server shut down via Close button)
      interior = (
        <div className="app-loadingArea" key="app-session-ended">
          <div className="app-loading" aria-live="polite">
            View session ended
          </div>
          <div className="app-subloading" aria-live="polite">
            The content viewer has been closed. You can close this browser tab.
          </div>
        </div>
      );
    } else if (this.state.mode === AppMode.loading) {
      let message = "loading...";

      let additionalLoadingMessage = "";

      if (this.state.loadingMessage !== undefined) {
        message = this.state.loadingMessage;
      }

      if (this.state.additionalLoadingMessage !== undefined) {
        additionalLoadingMessage = this.state.additionalLoadingMessage;
      }

      interior = (
        <div className="app-loadingArea" key="app-la">
          <div className="app-loading" aria-live="polite">
            {message}
          </div>
          <div className="app-subloading" aria-live="polite">
            {additionalLoadingMessage}
          </div>
        </div>
      );
    } else if (this.state.mode === AppMode.exporterTool) {
      interior = (
        <ExporterTool
          creatorTools={ct}
          key="app-et"
          onModeChangeRequested={this._handleModeChangeRequested}
          onProjectSelected={this._handleProjectSelected}
        />
      );
    } else if (this.state.mode === AppMode.codeToolbox) {
      interior = (
        <CodeToolbox
          theme={this.getTheme()}
          creatorTools={ct}
          key="app-cot"
          project={this.state.activeProject}
          onModeChangeRequested={this._handleModeChangeRequested}
          onProjectSelected={this._handleProjectSelected}
        />
      );
    } else if (this.state.mode === AppMode.importFromUrl) {
      interior = (
        <ImportFromUrl
          theme={this.getTheme()}
          creatorTools={ct}
          key="app-cot"
          project={this.state.activeProject}
          onModeChangeRequested={this._handleModeChangeRequested}
          onNewProjectFromGallerySelected={this._newProjectFromGalleryId}
        />
      );
    } else if (this.state.mode === AppMode.importFiles) {
      interior = (
        <ImportFiles
          theme={this.getTheme()}
          creatorTools={ct}
          files={this.state.submittedFiles}
          key="app-cot"
          onModeChangeRequested={this._handleModeChangeRequested}
          onNewProjectFromGallerySelected={this._newProjectFromGalleryId}
          onNewProjectFromFilesSelected={this._handleNewProjectFromImportFiles}
          onUpdateExistingProject={this._handleUpdateExistingProject}
        />
      );
    } else if (this.state.mode === AppMode.codeStartPage) {
      interior = (
        <CodeStartPage
          theme={this.getTheme()}
          creatorTools={ct}
          forceNewProject={false}
          key="app-cosp"
          project={this.state.activeProject}
          onModeChangeRequested={this._handleModeChangeRequested}
          onProjectSelected={this._handleProjectSelected}
        />
      );
    } else if (this.state.mode === AppMode.codeStartPageForceNewProject) {
      interior = (
        <CodeStartPage
          theme={this.getTheme()}
          creatorTools={ct}
          forceNewProject={true}
          key="app-cospa"
          project={this.state.activeProject}
          onModeChangeRequested={this._handleModeChangeRequested}
          onProjectSelected={this._handleProjectSelected}
        />
      );
    } else if (this.state.mode === AppMode.codeLandingForceNewProject) {
      interior = (
        <CodeToolboxNoProjectLanding
          theme={this.getTheme()}
          creatorTools={ct}
          forceNewProject={true}
          key="app-cotl"
          project={this.state.activeProject}
          onModeChangeRequested={this._handleModeChangeRequested}
        />
      );
    } else if (this.state.mode === AppMode.remoteServerManager) {
      interior = (
        <RemoteServerManager
          creatorTools={ct}
          key="app-rsm"
          onModeChangeRequested={this._handleModeChangeRequested}
          onProjectSelected={this._handleProjectSelected}
        />
      );
    } else if (this.state.mode === AppMode.webServer) {
      interior = (
        <WebServer
          theme={this.getTheme()}
          creatorTools={ct}
          heightOffset={heightOffset}
          key="app-webserver"
          hideTitlebar={false}
          onModeChangeRequested={this._handleModeChangeRequested}
          onProjectSelected={this._handleProjectSelected}
        />
      );
    } else if (this.state.mode === AppMode.blockViewer) {
      interior = <LazyBlockViewer heightOffset={heightOffset} key="app-blockviewer" />;
    } else if (this.state.mode === AppMode.mobViewer) {
      interior = <LazyMobViewer heightOffset={heightOffset} key="app-mobviewer" />;
    } else if (this.state.mode === AppMode.itemViewer) {
      interior = <LazyItemViewer heightOffset={heightOffset} key="app-itemviewer" />;
    } else if (this.state.mode === AppMode.modelViewer) {
      // Standalone model viewer - can load from:
      // - geometryUrl/textureUrl (direct URLs)
      // - selectedItem as entityTypeId (vanilla entity)
      // - cameraX/cameraY/cameraZ for camera positioning
      interior = (
        <LazyModelViewer
          heightOffset={heightOffset}
          key="app-modelviewer"
          readOnly={true}
          geometryUrl={this.state.geometryUrl}
          textureUrl={this.state.textureUrl}
          entityTypeId={this.state.selectedItem}
          skipVanillaResources={this.state.skipVanillaResources}
          cameraX={this.state.cameraX}
          cameraY={this.state.cameraY}
          cameraZ={this.state.cameraZ}
        />
      );
    } else if (this.state.mode === AppMode.structureViewer) {
      // Standalone structure viewer - loads MCStructure from URL
      // Include camera params in key to force remount when camera changes (for multi-angle rendering)
      const structureViewerKey = `app-structureviewer-${this.state.cameraX ?? 0}-${this.state.cameraY ?? 0}-${
        this.state.cameraZ ?? 0
      }`;
      interior = (
        <LazyStructureViewer
          heightOffset={heightOffset}
          key={structureViewerKey}
          structureUrl={this.state.structureUrl}
          skipVanillaResources={this.state.skipVanillaResources}
          hideChrome={this.state.hideChrome}
          showEditorTools={this.state.showEditorTools}
          cameraX={this.state.cameraX}
          cameraY={this.state.cameraY}
          cameraZ={this.state.cameraZ}
        />
      );
    } else if ((this.state.mode as number) === AppMode.worldViewer) {
      // Standalone 3D world viewer - loads .mcworld from URL
      interior = (
        <LazyWorldViewer
          heightOffset={heightOffset}
          key="app-worldviewer"
          worldUrl={this.state.worldUrl}
          hideChrome={this.state.hideChrome}
          cameraX={this.state.cameraX}
          cameraY={this.state.cameraY}
          cameraZ={this.state.cameraZ}
        />
      );
    } else if (this.state.mode === AppMode.home) {
      interior = (
        <Home
          theme={this.getTheme()}
          creatorTools={ct}
          isPersisted={this.state.isPersisted}
          heightOffset={heightOffset}
          errorMessage={this.state.errorMessage}
          onLog={this._doLog}
          visualSeed={this.state.visualSeed}
          key="app-h"
          onSetProject={this._setProject}
          onGalleryItemCommand={this._handleProjectGalleryCommand}
          onLocalGalleryItemCommand={this._handleLocalGalleryCommand}
          onModeChangeRequested={this._handleModeChangeRequested}
          onFilesSubmitted={this._considerSubmittedFiles}
          onProgressLog={this._doLog}
          onNewProjectFromFolderSelected={this._handleNewProjectFromFolder}
          onNewProjectFromFolderInstanceSelected={this._handleNewProjectFromFolderInstance}
          onProjectSelected={this._handleProjectSelected}
        />
      );
      return <>{interior}</>;
    } else if (this.state.activeProject !== null && CreatorToolsHost.initialMode === "projectitem") {
      interior = (
        <ProjectEditor
          creatorTools={ct}
          theme={this.getTheme()}
          hideMainToolbar={true}
          key="app-pe"
          heightOffset={heightOffset}
          statusAreaMode={ProjectStatusAreaMode.hidden}
          isPersisted={this.state.isPersisted}
          onPersistenceUpgraded={this._handlePersistenceUpgraded}
          project={this.state.activeProject}
          selectedItem={this.state.selectedItem}
          viewMode={CreatorToolsEditorViewMode.mainFocus}
          mode={this.state.initialProjectEditorMode ? this.state.initialProjectEditorMode : undefined}
          readOnly={isReadOnly}
          isViewMode={isViewMode}
          hasContentSession={hasContentSession}
          onModeChangeRequested={this._handleModeChangeRequested}
        />
      );
    } else if (this.state.activeProject !== null && CreatorToolsHost.initialMode === "info") {
      interior = (
        <ProjectEditor
          creatorTools={ct}
          theme={this.getTheme()}
          hideMainToolbar={true}
          key="app-pea"
          heightOffset={heightOffset}
          isPersisted={this.state.isPersisted}
          onPersistenceUpgraded={this._handlePersistenceUpgraded}
          statusAreaMode={ProjectStatusAreaMode.hidden}
          project={this.state.activeProject}
          mode={ProjectEditorMode.inspector}
          viewMode={CreatorToolsEditorViewMode.mainFocus}
          readOnly={isReadOnly}
          isViewMode={isViewMode}
          hasContentSession={hasContentSession}
          onModeChangeRequested={this._handleModeChangeRequested}
        />
      );
    } else if (this.state.activeProject !== null) {
      if (this.state.activeProject.errorState === ProjectErrorState.projectFolderOrFileDoesNotExist) {
        let error = "Could not find project data folder: ";

        if (this.state.activeProject.localFolderPath) {
          error += this.state.activeProject.localFolderPath;
        }

        error += ". It may not be available on this device?";

        interior = (
          <Home
            theme={this.getTheme()}
            creatorTools={ct}
            heightOffset={heightOffset}
            errorMessage={error}
            onLog={this._doLog}
            key="app-hoa"
            onSetProject={this._setProject}
            onGalleryItemCommand={this._handleProjectGalleryCommand}
            onLocalGalleryItemCommand={this._handleLocalGalleryCommand}
            onModeChangeRequested={this._handleModeChangeRequested}
            onFilesSubmitted={this._considerSubmittedFiles}
            onNewProjectFromFolderSelected={this._handleNewProjectFromFolder}
            onProjectSelected={this._handleProjectSelected}
          />
        );
        return <>{interior}</>;
      } else if (this.state.activeProject.originalSampleId) {
        // show main view (no sidebar) if it's a code sample.
        interior = (
          <ProjectEditor
            creatorTools={ct}
            key="app-pec"
            theme={this.getTheme()}
            heightOffset={heightOffset}
            viewMode={CreatorToolsEditorViewMode.mainFocus}
            project={this.state.activeProject}
            isPersisted={this.state.isPersisted}
            onPersistenceUpgraded={this._handlePersistenceUpgraded}
            mode={this.state.initialProjectEditorMode ? this.state.initialProjectEditorMode : undefined}
            selectedItem={this.state.selectedItem}
            readOnly={isReadOnly}
            isViewMode={isViewMode}
            hasContentSession={hasContentSession}
            onModeChangeRequested={this._handleModeChangeRequested}
          />
        );
      } else {
        interior = (
          <ProjectEditor
            creatorTools={ct}
            theme={this.getTheme()}
            key="app-pef"
            heightOffset={heightOffset}
            project={this.state.activeProject}
            initialFocusPath={CreatorToolsHost.focusPath}
            isPersisted={this.state.isPersisted}
            onPersistenceUpgraded={this._handlePersistenceUpgraded}
            mode={this.state.initialProjectEditorMode ? this.state.initialProjectEditorMode : undefined}
            selectedItem={this.state.selectedItem}
            readOnly={isReadOnly}
            isViewMode={isViewMode}
            hasContentSession={hasContentSession}
            onModeChangeRequested={this._handleModeChangeRequested}
          />
        );
      }
    }

    const colors = getThemeColors();

    return (
      <>
        <div
          id="top-level"
          style={{
            backgroundColor: colors.background1,
            color: colors.foreground1,
          }}
        >
          {top}
          <div
            className="app-editor"
            style={{
              minHeight: height,
              maxHeight: height,
              borderLeft: borderStr,
              borderRight: borderStr,
              borderBottom: borderStr,
              boxSizing: "border-box",
            }}
          >
            {interior}
          </div>
        </div>
      </>
    );
  }
}
