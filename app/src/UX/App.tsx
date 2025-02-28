import { Component } from "react";
import ProjectEditor, { ProjectStatusAreaMode } from "./ProjectEditor";
import Home from "./Home";
import "./App.css";
import Carto from "./../app/Carto";
import Project, { ProjectErrorState } from "./../app/Project";
import IGalleryItem, { GalleryItemType } from "../app/IGalleryItem";
import IFolder from "../storage/IFolder";
import { GalleryProjectCommand } from "./ProjectGallery";
import Log from "../core/Log";
import { ProjectFocus, ProjectScriptLanguage } from "../app/IProjectData";
import CartoApp from "../app/CartoApp";
import StorageUtilities from "../storage/StorageUtilities";
import { ThemeInput } from "@fluentui/react-northstar";
import { CartoEditorViewMode } from "../app/ICartoData";
import MCWorld from "../minecraft/MCWorld";
import ProjectItem from "../app/ProjectItem";
import ZipStorage from "../storage/ZipStorage";
import ProjectUtilities from "../app/ProjectUtilities";
import { LocalFolderType } from "./LocalGalleryCommand";
import WebUtilities from "./WebUtilities";
import ProjectEditorUtilities, { ProjectEditorMode } from "./ProjectEditorUtilities";
import HttpStorage from "../storage/HttpStorage";
import { ProjectImportExclusions } from "../app/ProjectExporter";
import Database from "../minecraft/Database";
import IProjectSeed from "../app/IProjectSeed";

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
}

interface AppProps {
  theme: ThemeInput<any>;
  fileContentRetriever?: (func: () => Promise<any>) => void;
  saveAllRetriever?: (func: () => Promise<void>) => void;
}

interface AppState {
  mode: AppMode;
  isPersisted?: boolean;
  errorMessage?: string;
  activeProject: Project | null;
  selectedItem?: string;
  hasBanner?: boolean;
  initialProjectEditorMode?: ProjectEditorMode;
  loadingMessage?: string;
  visualSeed?: number;
  additionalLoadingMessage?: string;
}

export default class App extends Component<AppProps, AppState> {
  static instanceCount = 0;
  private _loadingMessage?: string;
  private _lastHashProcessed?: string;
  private _isMountedInternal: boolean = false;
  private _intervalId?: number = undefined;

  constructor(props: AppProps) {
    super(props);

    this._setProject = this._setProject.bind(this);
    this._handleNewProject = this._handleNewProject.bind(this);
    this._handleNewProjectFromFolder = this._handleNewProjectFromFolder.bind(this);
    this._handleNewProjectFromFolderInstance = this._handleNewProjectFromFolderInstance.bind(this);
    this._handleProjectSelected = this._handleProjectSelected.bind(this);
    this._handleCartoInit = this._handleCartoInit.bind(this);
    this._handlePersistenceUpgraded = this._handlePersistenceUpgraded.bind(this);
    this._newProjectFromGallery = this._newProjectFromGallery.bind(this);
    this._handleProjectGalleryCommand = this._handleProjectGalleryCommand.bind(this);
    this._handleHashChange = this._handleHashChange.bind(this);
    this._incrementVisualSeed = this._incrementVisualSeed.bind(this);
    this._gitHubAddingMessageUpdater = this._gitHubAddingMessageUpdater.bind(this);
    this._getFileContent = this._getFileContent.bind(this);
    this._saveAll = this._saveAll.bind(this);
    this._handleItemChanged = this._handleItemChanged.bind(this);
    this._handleSaved = this._handleSaved.bind(this);
    this._doLog = this._doLog.bind(this);

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
    if (!CartoApp.carto || !CartoApp.carto.isLoaded) {
      return;
    }

    let newProject = undefined;

    newProject = await CartoApp.carto.ensureProjectFromLocalStoragePath(CartoApp.projectPath);

    if (newProject) {
      let mode = this._getModeFromString(CartoApp.initialMode);

      if (mode === undefined) {
        mode = AppMode.home;
      }

      let selValue = this.state.selectedItem;

      if (CartoApp.modeParameter) {
        selValue = CartoApp.modeParameter;
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
      mode: this.state.mode,
      isPersisted: this.state.isPersisted,
      loadingMessage: this.state.loadingMessage,
      additionalLoadingMessage: this.state.additionalLoadingMessage,
      activeProject: this.state.activeProject,
      hasBanner: this.state.hasBanner,
      selectedItem: this.state.selectedItem,
      initialProjectEditorMode: this.state.initialProjectEditorMode,
      visualSeed: newSeed,
    });
  }

  private _handleHashChange() {
    const result = this._getStateFromUrlWithSideEffects(true);

    if (result && this._isMountedInternal) {
      this.setState({
        mode: result.mode,
        isPersisted: this.state.isPersisted,
        loadingMessage: this.state.loadingMessage,
        additionalLoadingMessage: this.state.additionalLoadingMessage,
        activeProject: this.state.activeProject,
        hasBanner: this.state.hasBanner,
        selectedItem: result.selectedItem,
        visualSeed: this.state.visualSeed,
        initialProjectEditorMode: this.state.initialProjectEditorMode,
      });
    }
  }

  private async _handleCartoInit(source: Carto, instance: Carto) {
    if (this.state === undefined) {
      return;
    }

    await this.loadCarto(instance);
  }

  private async loadCarto(instance: Carto) {
    await instance.load();

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
      carto: CartoApp.carto,
      mode: nextMode,
      isPersisted: isPersisted,
      activeProject: this.state.activeProject,
      hasBanner: this.state.hasBanner,
      visualSeed: this.state.visualSeed,
    };

    this.setState(newComponentState);
  }

  private _getStateFromUrlWithSideEffects(dontProcessQueryStrings?: boolean): AppState | undefined {
    const hash = window.location.hash;
    const query = window.location.search;
    const queryVals: { [path: string]: string } = {};

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

            queryVals[key] = params[i].substring(firstEqual + 1);
          }
        }
      }
    }

    if (!dontProcessQueryStrings && (queryVals["open"] !== undefined || queryVals["view"] !== undefined)) {
      let openQuery = queryVals["view"];

      const updateContent = queryVals["updates"];

      if (queryVals["open"]) {
        openQuery = queryVals["open"];
      }

      const firstSlash = openQuery.indexOf("/");

      if (firstSlash > 1) {
        const openToken = openQuery.substring(0, firstSlash).toLowerCase();

        let openData = openQuery.substring(firstSlash + 1, openQuery.length);

        if (openToken === "gp") {
          const lastPeriod = openData.lastIndexOf(".");

          if (lastPeriod > 0) {
            openData = openData.substring(0, lastPeriod);
          }

          this._ensureProjectFromGalleryId(openData, updateContent);
        }
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
    this.setState({
      mode: AppMode.home,
      activeProject: null,
      isPersisted: this.state.isPersisted,
      hasBanner: this.state.hasBanner,
      errorMessage: errorMessage,
      visualSeed: this.state.visualSeed,
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

      if (CartoApp.carto && !CartoApp.carto.isLoaded) {
        CartoApp.onInitialized.subscribe(this._handleCartoInit);

        this.loadCarto(CartoApp.carto);
      } else {
        const stateFromUrl = this._getStateFromUrlWithSideEffects();

        let initialAppMode = AppMode.home;

        if (stateFromUrl) {
          initialAppMode = stateFromUrl.mode;
        } else if (CartoApp.initialMode) {
          const mode = this._getModeFromString(CartoApp.initialMode);

          if (mode) {
            initialAppMode = mode;
          }
        }

        let selectedItem = undefined;

        if (CartoApp.modeParameter && CartoApp.modeParameter.startsWith("project/")) {
          const segments = CartoApp.modeParameter.split("/");

          if (segments.length === 2) {
            this._handleNewProject({ name: "Project" }, NewProjectTemplateType.gameTest);

            selectedItem = segments[1];
          }
        } else if (
          CartoApp.initialMode &&
          (CartoApp.modeParameter || CartoApp.initialMode === "info") &&
          CartoApp.projectPath
        ) {
          this._loadLocalStorageProject();
        }

        this.setState({
          mode: initialAppMode,
          selectedItem: selectedItem,
          activeProject: null,
        });
      }

      if (typeof window !== "undefined") {
        window.addEventListener("hashchange", this._handleHashChange, false);
        window.addEventListener("resize", this._incrementVisualSeed, false);
        this._intervalId = window.setInterval(this._tick, 50);
      }
    }

    this._isMountedInternal = true;
  }

  componentWillUnmount() {
    if (typeof window !== "undefined") {
      window.removeEventListener("hashchange", this._handleHashChange, false);
      window.removeEventListener("resize", this._incrementVisualSeed, false);
    }

    this._isMountedInternal = false;
  }

  private async _doLog(message: string) {
    this.setState({
      isPersisted: this.state.isPersisted,
      mode: AppMode.loading,
      hasBanner: this.state.hasBanner,
      visualSeed: this.state.visualSeed,
      loadingMessage: message,
    });
  }

  private async _handleNewProject(
    newProjectSeed: IProjectSeed,
    newProjectType: NewProjectTemplateType,
    newProjectPath?: string,
    additionalFilePath?: string,
    additionalFile?: File,
    editorStartMode?: ProjectEditorMode,
    startInReadOnly?: boolean
  ) {
    if (!CartoApp.carto || !CartoApp.carto.isLoaded) {
      return;
    }

    let newProjectName = newProjectSeed.name;

    if (!newProjectName) {
      newProjectName = "New Project";
    }

    if (additionalFile && additionalFilePath && this.state && this._isMountedInternal) {
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

    if (newProjectPath === undefined) {
      newProject = await CartoApp.carto.createNewProject(
        newProjectName,
        newProjectPath,
        focus,
        true,
        ProjectScriptLanguage.typeScript
      );
    } else {
      newProject = await CartoApp.carto.ensureProjectForFolder(newProjectPath, newProjectName, false);

      await newProject.ensureProjectFolder();

      newProject.focus = focus;

      await newProject.ensureDefaultItems();
    }

    if (additionalFile && additionalFilePath) {
      await ProjectEditorUtilities.integrateBrowserFileDefaultAction(newProject, additionalFilePath, additionalFile);
    }

    await newProject.save(true);
    await CartoApp.carto.save();

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
        mode: nextMode,
        isPersisted: this.state.isPersisted,
        activeProject: newProject,
        hasBanner: this.state.hasBanner,
        selectedItem: this.state.selectedItem,
        visualSeed: this.state.visualSeed,
        initialProjectEditorMode: editorStartMode,
      });
    }
  }

  private async _handleNewProjectFromFolder(folderPath: string) {
    if (!CartoApp.carto || !CartoApp.carto.isLoaded) {
      return;
    }

    const newProject = await CartoApp.carto.ensureProjectForFolder(folderPath);

    newProject.save();
    CartoApp.carto.save();

    this._setProject(newProject);
  }

  private _setProject(project: Project) {
    this._updateWindowTitle(AppMode.project, project);
    this.initProject(project);

    this.setState({
      mode: AppMode.project,
      isPersisted: this.state.isPersisted,
      hasBanner: this.state.hasBanner,
      visualSeed: this.state.visualSeed,
      activeProject: project,
    });
  }

  private async _handleNewProjectFromFolderInstance(folder: IFolder, name?: string, isDocumentationProject?: boolean) {
    if (!CartoApp.carto || !CartoApp.carto.isLoaded) {
      return;
    }

    const newProject = new Project(CartoApp.carto, name ? name : folder.name, null);

    newProject.setProjectFolder(folder);

    if (isDocumentationProject) {
      await ProjectUtilities.prepareProjectForDocumentation(newProject);
    }

    await newProject.inferProjectItemsFromFiles();

    newProject.save();
    CartoApp.carto.save();

    this._setProject(newProject);
  }

  private async _ensureProjectFromGalleryId(galleryId: string, updateContent?: string) {
    if (CartoApp.carto === undefined) {
      return;
    }

    const gp = await CartoApp.carto.getGalleryProjectById(galleryId);

    if (gp === undefined) {
      this.setHomeWithError("We could not find a starter/sample named '" + galleryId + "' that could be opened.");
      return;
    }

    this._ensureProjectFromGallery(gp, updateContent);
  }

  private async _ensureProjectFromGallery(project: IGalleryItem, updateContent?: string) {
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
    updateContent?: string,
    description?: string
  ) {
    const carto = CartoApp.carto;

    if (this.state === null || carto === undefined || this._loadingMessage !== undefined) {
      return;
    }

    this._loadingMessage = "opening GitHub " + gitHubOwner + "/" + gitHubRepoName + "...";

    let newMode = AppMode.project;

    if (isReadOnly) {
      newMode = AppMode.projectReadOnly;
    }

    this._updateWindowTitle(AppMode.loading, null);

    this.setState({
      mode: AppMode.loading,
      activeProject: null,
      isPersisted: this.state.isPersisted,
      hasBanner: this.state.hasBanner,
      loadingMessage: this._loadingMessage,
      visualSeed: this.state.visualSeed,
      additionalLoadingMessage: undefined,
    });

    await carto.load();

    const projects = carto.projects;

    for (let i = 0; i < projects.length; i++) {
      const proj = projects[i];

      await proj.ensureLoadedFromFile();

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

  private async _newProjectFromGallery(newProjectSeed: IProjectSeed) {
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
      undefined,
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
    updateContent?: string,
    projectSeed?: IProjectSeed,
    galleryType?: GalleryItemType
  ) {
    const carto = CartoApp.carto;

    if (this.state === null || carto === undefined) {
      return;
    }

    let suggestedCreator = projectSeed?.creator;
    let suggestedName = projectSeed?.name;
    let suggestedShortName = projectSeed?.shortName;
    let description = projectSeed?.description;

    if (suggestedCreator === undefined) {
      suggestedCreator = carto.creator;
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
      hasBanner: this.state.hasBanner,
      visualSeed: this.state.visualSeed,
      loadingMessage: this._loadingMessage,
      additionalLoadingMessage: undefined,
    });

    await carto.load();

    const operId = await carto.notifyOperationStarted("Creating new project from '" + title + "'");

    if (gitHubOwner !== undefined && gitHubRepoName !== undefined) {
      let gh = undefined;

      if (
        galleryType === GalleryItemType.entityType ||
        galleryType === GalleryItemType.blockType ||
        galleryType === GalleryItemType.itemType
      ) {
        gh = new HttpStorage(
          CartoApp.contentRoot + "res/samples/microsoft/minecraft-samples-main/addon_starter/start/"
        );
      } else {
        gh = new HttpStorage(
          CartoApp.contentRoot +
            "res/samples/" +
            gitHubOwner +
            "/" +
            gitHubRepoName +
            "-" +
            (gitHubBranch ? gitHubBranch : "main") +
            "/" +
            gitHubFolder
        ); //new GitHubStorage(carto.anonGitHub, gitHubRepoName, gitHubOwner, gitHubBranch, gitHubFolder);
      }
      let projName = suggestedName
        ? suggestedName
        : ProjectUtilities.getSuggestedProjectNameFromElements(galleryId, gitHubFolder, gitHubRepoName);

      const newProjectName = await carto.getNewProjectName(projName);

      let focus = ProjectFocus.general;

      if (galleryType === GalleryItemType.editorProject) {
        focus = ProjectFocus.editorExtension;
      } else if (galleryType === GalleryItemType.codeSample || galleryType === GalleryItemType.editorCodeSample) {
        focus = ProjectFocus.focusedCodeSnippet;
      }

      const newProject = await carto.createNewProject(newProjectName, undefined, focus, false);

      await gh.rootFolder.load();

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
        this.setState({
          mode: AppMode.home,
          activeProject: this.state.activeProject,
          selectedItem: this.state.selectedItem,
          initialProjectEditorMode: this.state.initialProjectEditorMode,
          hasBanner: this.state.hasBanner,
          visualSeed: this.state.visualSeed,
          isPersisted: this.state.isPersisted,
          errorMessage: "Could not create a new project. " + e.toString(),
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
        const galleryProject = await carto.getGalleryProjectById(galleryId);

        if (galleryProject) {
          if (galleryType === GalleryItemType.entityType) {
            await ProjectUtilities.addEntityTypeFromGallery(newProject, galleryProject, suggestedName);
          } else if (galleryType === GalleryItemType.blockType) {
            await ProjectUtilities.addBlockTypeFromGallery(newProject, galleryProject, suggestedName);
          } else if (galleryType === GalleryItemType.itemType) {
            await ProjectUtilities.addItemTypeFromGallery(newProject, galleryProject, suggestedName);
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
          const zs = new ZipStorage();

          await zs.loadFromBase64(updateContent);

          if (zs.errorStatus) {
            this.setHomeWithError(
              "Error processing compressed content from URL." + (zs.errorMessage ? "Details: " + zs.errorMessage : "")
            );
            return;
          }

          await StorageUtilities.syncFolderTo(
            zs.rootFolder,
            newProject.projectFolder,
            false,
            false,
            false,
            ["package.json", "package.lock.json", "gulpfile.js", "just.config.ts"],
            ["*.ts", "*.js", "*.json"]
          );
        } catch (e) {
          this.setHomeWithError(
            "Could not process updated content from URL. Check to make sure your shared URL is valid. (" + e + ")"
          );
          return;
        }
      }

      description = description ? description : title;

      await ProjectUtilities.processNewProject(newProject, suggestedName, description, suggestedShortName);

      await carto.save();

      this._setProject(newProject);
    }

    await carto.notifyOperationEnded(operId, "New project '" + title + "' created.  Have fun!");
  }

  private async _handlePersistenceUpgraded() {
    this.setState({
      mode: this.state.mode,
      isPersisted: true,
      activeProject: this.state.activeProject,
      selectedItem: this.state.selectedItem,
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
      selectedItem: this.state.selectedItem,
      hasBanner: this.state.hasBanner,
      visualSeed: this.state.visualSeed,
      loadingMessage: message,
      additionalLoadingMessage: additionalMessage,
    });
  }

  private async _newProjectFromMinecraftFolder(folderType: LocalFolderType, folder: IFolder) {
    if (!CartoApp.carto || !CartoApp.carto.isLoaded) {
      return;
    }

    let proposedProjectName = StorageUtilities.getBaseFromName(folder.fullPath);
    const mcw = await MCWorld.ensureMCWorldOnFolder(folder);

    if (mcw && mcw.name) {
      proposedProjectName = mcw.name;
    }

    const newProject = await CartoApp.carto.ensureProjectForFolder(folder.fullPath, proposedProjectName);

    newProject.save();
    CartoApp.carto.save();

    this._updateWindowTitle(AppMode.project, newProject);
    this.initProject(newProject);

    this.setState({
      mode: AppMode.project,
      isPersisted: this.state.isPersisted,
      hasBanner: this.state.hasBanner,
      visualSeed: this.state.visualSeed,
      activeProject: newProject,
    });
  }

  private async _ensureProjectFromMinecraftFolder(folderType: LocalFolderType, folder: IFolder, isReadOnly: boolean) {
    const carto = CartoApp.carto;

    if (this.state === null || carto === undefined) {
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
      hasBanner: this.state.hasBanner,
      visualSeed: this.state.visualSeed,
      loadingMessage: this._loadingMessage,
    });

    await carto.load();

    const projects = carto.projects;
    const canonPath = StorageUtilities.canonicalizePath(folder.fullPath);

    for (let i = 0; i < projects.length; i++) {
      const proj = projects[i];

      await proj.ensureLoadedFromFile();

      if (proj.originalFullPath === canonPath) {
        await proj.ensureInflated();

        this._updateWindowTitle(newMode, proj);
        this.initProject(proj);

        this.setState({
          mode: newMode,
          isPersisted: this.state.isPersisted,
          hasBanner: this.state.hasBanner,
          visualSeed: this.state.visualSeed,
          activeProject: proj,
        });

        return;
      }
    }

    const folderName = StorageUtilities.getLeafName(canonPath);

    const operId = await carto.notifyOperationStarted("Creating new project from '" + canonPath + "'");

    if (folderName !== undefined) {
      let projName = "my-" + folderName;

      const newProjectName = await carto.getNewProjectName(projName);

      let newFocus = ProjectFocus.focusedCodeSnippet;

      if (folderType === LocalFolderType.world) {
        newFocus = ProjectFocus.world;
      }

      projName = projName.replace(/_/gi, "");
      projName = projName.replace(/\//gi, "");
      projName = projName.replace(/\\/gi, "");
      projName = projName.replace(/ /gi, "");

      const newProject = await carto.createNewProject(newProjectName, folder.fullPath, newFocus, false);

      await newProject.ensureProjectFolder();

      await newProject.inferProjectItemsFromFiles();

      newProject.save();

      carto.save();

      this._setProject(newProject);
    }

    await carto.notifyOperationEnded(operId, "New project '" + folderName + "' created. Have fun!");
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
          const projName = activeProject.loc.getTokenValueOrDefault(activeProject.name);
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
                transform.substring(0, firstComma + 2) + " 235px" + transform.substring(secondComma);
            }
          }
        }
      }
    }
  }

  private async _handleProjectSelected(project: Project) {
    await project.ensureLoadedFromFile();
    await project.ensureInflated();

    this._updateWindowTitle(AppMode.project, project);

    this.initProject(project);

    this.setState({
      mode: AppMode.project,
      isPersisted: this.state.isPersisted,
      hasBanner: this.state.hasBanner,
      visualSeed: this.state.visualSeed,
      activeProject: project,
    });
  }

  private _handleModeChangeRequested = (newMode: AppMode) => {
    this._updateWindowTitle(newMode, this.state.activeProject);

    this.setState({
      mode: newMode,
      hasBanner: this.state.hasBanner,
      visualSeed: this.state.visualSeed,
      isPersisted: this.state.isPersisted,
    });
  };

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
      let bannerHeight = 96;
      const elt = window.document.getElementById("cookie-banner");
      if (elt && elt.offsetHeight > 20) {
        bannerHeight = elt.offsetHeight + 17;
      }

      height = "calc(100vh - " + bannerHeight + "px)";
      heightOffset = bannerHeight;
    }

    if (CartoApp.carto === undefined || !CartoApp.carto.isLoaded) {
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
    } else if (this.state.mode === AppMode.home) {
      interior = (
        <Home
          theme={this.props.theme}
          carto={CartoApp.carto}
          isPersisted={this.state.isPersisted}
          heightOffset={heightOffset}
          errorMessage={this.state.errorMessage}
          onLog={this._doLog}
          visualSeed={this.state.visualSeed}
          key="app-h"
          onSetProject={this._setProject}
          onGalleryItemCommand={this._handleProjectGalleryCommand}
          onModeChangeRequested={this._handleModeChangeRequested}
          onNewProjectSelected={this._handleNewProject}
          onNewProjectFromFolderSelected={this._handleNewProjectFromFolder}
          onNewProjectFromFolderInstanceSelected={this._handleNewProjectFromFolderInstance}
          onProjectSelected={this._handleProjectSelected}
        />
      );
    } else if (this.state.activeProject !== null && CartoApp.initialMode === "projectitem") {
      interior = (
        <ProjectEditor
          carto={CartoApp.carto}
          theme={this.props.theme}
          hideMainToolbar={true}
          key="app-pe"
          heightOffset={heightOffset}
          statusAreaMode={ProjectStatusAreaMode.hidden}
          isPersisted={this.state.isPersisted}
          onPersistenceUpgraded={this._handlePersistenceUpgraded}
          project={this.state.activeProject}
          selectedItem={this.state.selectedItem}
          viewMode={CartoEditorViewMode.mainFocus}
          mode={this.state.initialProjectEditorMode ? this.state.initialProjectEditorMode : undefined}
          readOnly={isReadOnly}
          onModeChangeRequested={this._handleModeChangeRequested}
        />
      );
    } else if (this.state.activeProject !== null && CartoApp.initialMode === "info") {
      interior = (
        <ProjectEditor
          carto={CartoApp.carto}
          theme={this.props.theme}
          hideMainToolbar={true}
          key="app-pea"
          heightOffset={heightOffset}
          isPersisted={this.state.isPersisted}
          onPersistenceUpgraded={this._handlePersistenceUpgraded}
          statusAreaMode={ProjectStatusAreaMode.hidden}
          project={this.state.activeProject}
          mode={ProjectEditorMode.inspector}
          viewMode={CartoEditorViewMode.mainFocus}
          readOnly={isReadOnly}
          onModeChangeRequested={this._handleModeChangeRequested}
        />
      );
    } else if (this.state.activeProject !== null) {
      if (this.state.activeProject.errorState === ProjectErrorState.projectFolderOrFileDoesNotExist) {
        let error = "Could not find project data folder: ";

        if (this.state.activeProject.mainDeployFolderPath) {
          error += this.state.activeProject.mainDeployFolderPath;
        }

        error += ". It may not be available on this device?";

        interior = (
          <Home
            theme={this.props.theme}
            carto={CartoApp.carto}
            heightOffset={heightOffset}
            errorMessage={error}
            onLog={this._doLog}
            key="app-hoa"
            onSetProject={this._setProject}
            onGalleryItemCommand={this._handleProjectGalleryCommand}
            onModeChangeRequested={this._handleModeChangeRequested}
            onNewProjectSelected={this._handleNewProject}
            onNewProjectFromFolderSelected={this._handleNewProjectFromFolder}
            onProjectSelected={this._handleProjectSelected}
          />
        );
      } else if (this.state.activeProject.originalSampleId) {
        // show main view (no sidebar) if it's a code sample.
        interior = (
          <ProjectEditor
            carto={CartoApp.carto}
            key="app-pec"
            theme={this.props.theme}
            heightOffset={heightOffset}
            viewMode={CartoEditorViewMode.mainFocus}
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
            carto={CartoApp.carto}
            theme={this.props.theme}
            key="app-pef"
            heightOffset={heightOffset}
            project={this.state.activeProject}
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
      <div
        style={{
          backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
          color: this.props.theme.siteVariables?.colorScheme.brand.foreground1,
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
    );
  }
}
