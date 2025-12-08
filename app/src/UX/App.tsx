import { Component } from "react";
import ProjectEditor, { ProjectStatusAreaMode } from "./ProjectEditor";
import ExporterTool from "./ExporterTool";
import Home from "./pages/home/Home";
import "./App.css";
import CreatorTools, { DefaultCreatorName } from "./../app/CreatorTools";
import Project, { ProjectErrorState } from "./../app/Project";
import IGalleryItem, { GalleryItemType } from "../app/IGalleryItem";
import IFolder from "../storage/IFolder";
import { GalleryProjectCommand } from "./ProjectGallery";
import Log from "../core/Log";
import { ProjectFocus, ProjectScriptLanguage } from "../app/IProjectData";
import CreatorToolsHost, { CreatorToolsThemeStyle, HostType } from "../app/CreatorToolsHost";
import StorageUtilities from "../storage/StorageUtilities";
import { ThemeInput, Provider } from "@fluentui/react-northstar";
import { CreatorToolsEditorViewMode } from "../app/ICreatorToolsData";
import MCWorld from "../minecraft/MCWorld";
import ProjectItem from "../app/ProjectItem";
import ProjectUtilities from "../app/ProjectUtilities";
import { LocalFolderType, LocalGalleryCommand } from "./LocalGalleryCommand";
import WebUtilities from "./WebUtilities";
import ProjectEditorUtilities, { ProjectEditorMode } from "./ProjectEditorUtilities";
import AppServiceProxy from "../core/AppServiceProxy";
import HttpStorage from "../storage/HttpStorage";
import { ProjectImportExclusions } from "../app/ProjectExporter";
import Database from "../minecraft/Database";
import IProjectSeed from "../app/IProjectSeed";
import ImportFromUrl from "./ImportFromUrl";
import ProjectCreateManager from "../app/ProjectCreateManager";
import telemetryService from "../analytics/Telemetry";
import { TelemetryProperties, TelemetrySeverity } from "../analytics/TelemetryConstants";
import ImportFiles from "./ImportFiles";

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
  importFromUrl = 17,
  importFiles = 18,
}

interface AppProps {
  darkTheme: ThemeInput<any>;
  lightTheme: ThemeInput<any>;
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
}

// Layout and UI constants
const ELECTRON_TITLEBAR_HEIGHT = 41;
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

  public async _getFileContent() {
    return "{ }";
  }

  public async _loadLocalStorageProject() {
    const ct = CreatorToolsHost.getCreatorTools();

    if (!ct || !ct.isLoaded) {
      return;
    }

    let newProject = undefined;

    newProject = await ct.ensureProjectFromLocalStoragePath(CreatorToolsHost.projectPath);

    if (newProject) {
      let mode = this._getModeFromString(CreatorToolsHost.initialMode);

      if (mode === undefined) {
        mode = AppMode.home;
      }

      let selValue = this.state.selectedItem;

      if (CreatorToolsHost.modeParameter) {
        selValue = CreatorToolsHost.modeParameter;
      }

      this.initProject(newProject);

      await newProject.ensureProjectFolder();

      if (this.state) {
        const newState = {
          mode: mode,
          isPersisted: this.state.isPersisted,
          activeProject: newProject,
          selectedItem: selValue,
          hasBanner: this.state.hasBanner,
          visualSeed: this.state.visualSeed,
        };

        if (this._isMountedInternal) {
          this.setState(newState);
        } else {
          this.state = newState;
        }
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

      default:
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

    this.setState({
      ...this.state,
      visualSeed: newSeed,
    });
  }

  private _handleHashChange() {
    const result = this._getStateFromUrlWithSideEffects(true);

    if (result && this._isMountedInternal) {
      this.setState({
        ...this.state,
        mode: result.mode,
        selectedItem: result.selectedItem,
      });
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
    } else if (nextMode === AppMode.loading) {
      nextMode = AppMode.home;
    }

    this._updateWindowTitle(nextMode, this.state.activeProject);

    const newComponentState = {
      creatorTools: CreatorToolsHost.getCreatorTools(),
      mode: nextMode,
      isPersisted: isPersisted,
      activeProject: this.state.activeProject,
      initialFocusPath: this.state.initialFocusPath,
      hasBanner: this.state.hasBanner,
      visualSeed: this.state.visualSeed,
    };

    this.setState(newComponentState);
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
        return {
          mode: modeFromQuery,
          activeProject: null,
          selectedItem: queryVals["block"] || queryVals["item"],
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

          if (segments.length === 1) {
            this._handleNewProject({ name: "Project" }, NewProjectTemplateType.gameTest);

            return {
              mode: AppMode.project,
              activeProject: this.state?.activeProject,
              selectedItem: segments[0],
            };
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

    this.setState({
      ...this.state,
      mode: AppMode.home,
      activeProject: null,
      errorMessage: errorMessage,
      initialProjectEditorMode: undefined,
    });
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
        window.setInterval(this._tick, LOADING_INTERVAL_MS);
      }
    }

    this._isMountedInternal = true;
  }

  processInitialUrl() {
    const stateFromUrl = this._getStateFromUrlWithSideEffects();

    let initialAppMode = AppMode.home;

    if (stateFromUrl) {
      initialAppMode = stateFromUrl.mode;
    } else if (CreatorToolsHost.initialMode) {
      const mode = this._getModeFromString(CreatorToolsHost.initialMode);

      if (mode) {
        initialAppMode = mode;
      }
    }

    let selectedItem = undefined;

    // electron open from path on the command line route
    if (AppServiceProxy.hasAppServiceOrSim && CreatorToolsHost.projectPath) {
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
    }

    this.setState({
      ...this.state,
      mode: initialAppMode,
      selectedItem: selectedItem,
      activeProject: null,
    });
  }

  componentWillUnmount() {
    if (typeof window !== "undefined") {
      window.removeEventListener("hashchange", this._handleHashChange, false);
      window.removeEventListener("resize", this._incrementVisualSeed, false);
    }

    // Unsubscribe from theme changes
    CreatorToolsHost.onThemeChanged.unsubscribe(this._handleThemeChanged);

    this._isMountedInternal = false;
  }

  /**
   * Handle theme changes from CreatorToolsHost.
   * Forces a re-render so the FluentUI Provider gets the new theme.
   */
  private _handleThemeChanged() {
    // Force re-render to update FluentUI Provider with new theme
    this.forceUpdate();
  }

  private async _doLog(message: string) {
    this.setState({
      ...this.state,
      mode: AppMode.loading,
      loadingMessage: message,
    });
  }

  private async _considerSubmittedFiles(path: string, files: File[]) {
    let shouldIndividuallyIntegrateFiles = false;

    for (const file of files) {
      if (!StorageUtilities.isContainerFile(file.name)) {
        shouldIndividuallyIntegrateFiles = true;
      }
    }

    if (shouldIndividuallyIntegrateFiles) {
      this.setState({
        ...this.state,
        mode: AppMode.importFiles,
        submittedFiles: files,
      });

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

    let newProject = undefined;
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
      this.setState({
        ...this.state,
        mode: nextMode,
        activeProject: newProject,
        initialProjectEditorMode: editorStartMode,
      });
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
        await project.ensurePreferencesAndFolderLoadedFromFile();
      }

      if (
        project.localFolderPath &&
        StorageUtilities.ensureEndsWithDelimiter(StorageUtilities.canonicalizePath(project.localFolderPath)) ===
          folderPathCanon
      ) {
        await project.ensurePreferencesAndFolderLoadedFromFile();
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

    const newProject = await ct.ensureProjectForLocalFolder(folderPath);
    newProject.save();
    ct.save();

    this._setProject(newProject, focusPath);
  }

  private _setProject(project: Project, focusPath?: string) {
    this._updateWindowTitle(AppMode.project, project);
    this.initProject(project);

    this.setState({
      ...this.state,
      mode: AppMode.project,
      initialFocusPath: focusPath,
      activeProject: project,
    });
  }

  private async _handleNewProjectFromFolderInstance(folder: IFolder, name?: string, isDocumentationProject?: boolean) {
    const ct = CreatorToolsHost.getCreatorTools();

    if (!ct || !ct.isLoaded) {
      return;
    }

    this._doLog("Loading project from '" + name + "' folder.");

    const newProject = new Project(ct, StorageUtilities.convertFolderPlaceholders(name ? name : folder.name), null);

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
      this.setState({
        ...this.state,
        mode: AppMode.project,
        activeProject: newProject,
      });
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

    this.setState({
      ...this.state,
      mode: AppMode.loading,
      activeProject: null,
      loadingMessage: this._loadingMessage,
      additionalLoadingMessage: undefined,
    });

    await creatorTools.load();

    const projects = creatorTools.projects;

    for (let i = 0; i < projects.length; i++) {
      const proj = projects[i];

      await proj.ensurePreferencesAndFolderLoadedFromFile();

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

        this.setState({
          mode: newMode,
          visualSeed: this.state.visualSeed,
          hasBanner: this.state.hasBanner,
          initialFocusPath: this.state.initialFocusPath,
          isPersisted: this.state.isPersisted,
          activeProject: proj,
        });

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
    const galleryItem = newProjectSeed.galleryProject;

    if (!galleryItem) {
      Log.unexpectedUndefined("ANPFG");
      return;
    }

    this._newProjectFromGitHubTemplate(
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

    this.setState({
      mode: AppMode.loading,
      activeProject: null,
      isPersisted: this.state.isPersisted,
      submittedFiles: this.state.submittedFiles,
      hasBanner: this.state.hasBanner,
      visualSeed: this.state.visualSeed,
      loadingMessage: this._loadingMessage,
      additionalLoadingMessage: undefined,
      initialFocusPath: this.state.initialFocusPath,
    });

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
        repoUrl = CreatorToolsHost.contentRoot + "res/samples/microsoft/minecraft-samples-main/addon_starter/start/";
      } else {
        repoUrl =
          CreatorToolsHost.contentRoot +
          "res/samples/" +
          gitHubOwner +
          "/" +
          gitHubRepoName +
          "-" +
          (gitHubBranch ? gitHubBranch : "main") +
          "/" +
          gitHubFolder;
      }

      if (Database.local && (CreatorToolsHost.fullLocalStorage || !CreatorToolsHost.contentRoot)) {
        gh = Database.local.createStorage(repoUrl);

        if (!gh) {
          throw new Error("Could not load local storage: " + repoUrl);
        }
      } else {
        gh = new HttpStorage(repoUrl);
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

        this.setState({
          mode: AppMode.home,
          activeProject: this.state.activeProject,
          submittedFiles: this.state.submittedFiles,
          selectedItem: this.state.selectedItem,
          initialFocusPath: this.state.initialFocusPath,
          initialProjectEditorMode: this.state.initialProjectEditorMode,
          hasBanner: this.state.hasBanner,
          visualSeed: this.state.visualSeed,
          isPersisted: this.state.isPersisted,
          errorMessage: errorMessage,
        });

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

      await creatorTools.save();

      this._setProject(newProject);
    }

    await creatorTools.notifyOperationEnded(operId, "New project '" + title + "' created.  Have fun!");
  }

  private async _handlePersistenceUpgraded() {
    this.setState({
      mode: this.state.mode,
      isPersisted: true,
      activeProject: this.state.activeProject,
      submittedFiles: this.state.submittedFiles,
      selectedItem: this.state.selectedItem,
      initialFocusPath: this.state.initialFocusPath,
      hasBanner: this.state.hasBanner,
      visualSeed: this.state.visualSeed,
      loadingMessage: this.state.loadingMessage,
      additionalLoadingMessage: this.state.additionalLoadingMessage,
    });
  }

  private async _gitHubAddingMessageUpdater(additionalMessage: string) {
    let message = this.state.loadingMessage;

    if (!message) {
      message = "Loading.";
    }

    this.setState({
      mode: this.state.mode,
      isPersisted: this.state.isPersisted,
      activeProject: this.state.activeProject,
      submittedFiles: this.state.submittedFiles,
      selectedItem: this.state.selectedItem,
      initialFocusPath: this.state.initialFocusPath,
      hasBanner: this.state.hasBanner,
      visualSeed: this.state.visualSeed,
      loadingMessage: message,
      additionalLoadingMessage: additionalMessage,
    });
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

    this.setState({
      mode: AppMode.project,
      isPersisted: this.state.isPersisted,
      initialFocusPath: this.state.initialFocusPath,
      hasBanner: this.state.hasBanner,
      visualSeed: this.state.visualSeed,
      activeProject: newProject,
    });
  }

  private async _ensureProjectFromMinecraftFolder(folderType: LocalFolderType, folder: IFolder, isReadOnly: boolean) {
    const creatorTools = CreatorToolsHost.getCreatorTools();

    if (this.state === null || creatorTools === undefined) {
      return;
    }

    this._loadingMessage = "opening folder " + folder.fullPath + "...";

    let newMode = AppMode.project;

    if (isReadOnly) {
      newMode = AppMode.projectReadOnly;
    }

    this._updateWindowTitle(AppMode.loading, null);

    this.setState({
      mode: AppMode.loading,
      activeProject: null,
      isPersisted: this.state.isPersisted,
      initialFocusPath: this.state.initialFocusPath,
      hasBanner: this.state.hasBanner,
      visualSeed: this.state.visualSeed,
      loadingMessage: this._loadingMessage,
    });

    await creatorTools.load();

    const projects = creatorTools.projects;
    const canonPath = StorageUtilities.canonicalizePath(folder.fullPath);

    for (let i = 0; i < projects.length; i++) {
      const proj = projects[i];

      await proj.ensurePreferencesAndFolderLoadedFromFile();

      if (proj.originalFullPath === canonPath) {
        await proj.ensureInflated();

        this._updateWindowTitle(newMode, proj);
        this.initProject(proj);

        this.setState({
          mode: newMode,
          isPersisted: this.state.isPersisted,
          initialFocusPath: this.state.initialFocusPath,
          hasBanner: this.state.hasBanner,
          visualSeed: this.state.visualSeed,
          activeProject: proj,
        });

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
    await project.ensurePreferencesAndFolderLoadedFromFile();
    await project.ensureInflated();

    this._updateWindowTitle(AppMode.project, project);

    this.initProject(project);

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

    let top = <></>;
    let borderStr = "";
    let height = "100vh";
    let heightOffset = 0;

    if (this.state.hasBanner) {
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
    } else if (this.state.mode === AppMode.home) {
      interior = (
        <Home
          theme={{}}
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
            theme={{}}
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
            onModeChangeRequested={this._handleModeChangeRequested}
          />
        );
      }
    }

    return (
      <Provider theme={this.getTheme()}>
        <div
          id="top-level"
          style={{
            backgroundColor: this.getTheme().siteVariables?.colorScheme.brand.background1,
            color: this.getTheme().siteVariables?.colorScheme.brand.foreground1,
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
            }}
          >
            {interior}
          </div>
        </div>
      </Provider>
    );
  }
}
