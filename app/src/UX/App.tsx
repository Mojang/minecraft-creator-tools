import { Component } from "react";
import ProjectEditor, { ProjectEditorMode, ProjectStatusAreaMode } from "./ProjectEditor";
import ExporterTool from "./ExporterTool";
import Home from "./Home";
import "./App.css";
import Carto from "./../app/Carto";
import Project, { ProjectErrorState } from "./../app/Project";
import IGalleryProject, { GalleryProjectType } from "../app/IGalleryProject";
import IFolder from "../storage/IFolder";
import { GalleryProjectCommand } from "./ProjectGallery";
import { LocalGalleryCommand, LocalFolderType } from "./LocalGallery";
import GitHubStorage from "../github/GitHubStorage";
import Log from "../core/Log";
import { ProjectFocus, ProjectScriptLanguage } from "../app/IProjectData";
import CartoApp, { HostType } from "../app/CartoApp";
import StorageUtilities from "../storage/StorageUtilities";
import ElectronTitleBar from "./ElectronTitleBar";
import CodeToolbox from "./CodeToolbox";
import RemoteServerManager from "./RemoteServerManager";
import ServerManager from "./ServerManager";
import { ThemeInput } from "@fluentui/react-northstar";
import { CartoEditorViewMode } from "../app/ICartoData";
import MCWorld from "../minecraft/MCWorld";
import CodeStartPage from "./CodeStartPage";
import ProjectItem from "../app/ProjectItem";
import Utilities from "../core/Utilities";
import ZipStorage from "../storage/ZipStorage";
import ProjectUtilities from "../app/ProjectUtilities";
import CodeToolboxLanding from "./CodeToolboxLanding";
import ProjectExporter from "../app/ProjectExporter";
import ProjectUpdateRunner from "../updates/ProjectUpdateRunner";

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
  serverManager = 8,
  codeStartPage = 9,
  serverManagerPlusBack = 10,
  serverManagerMinusTitlebar = 11,
  codeStartPageForceNewProject = 12,
  codeLandingForceNewProject = 13,
  codeMinecraftView = 14,
}

interface AppProps {
  theme: ThemeInput<any>;
  fileContentRetriever?: (func: () => Promise<any>) => void;
  saveAllRetriever?: (func: () => Promise<void>) => void;
}

interface AppState {
  carto?: Carto;
  mode: AppMode;
  errorMessage?: string;
  activeProject: Project | null;
  selectedItem?: string;
  loadingMessage?: string;
  additionalLoadingMessage?: string;
}

export default class App extends Component<AppProps, AppState> {
  static instanceCount = 0;
  private _loadingMessage?: string;
  private _lastHashProcessed?: string;
  private _isMountedInternal: boolean = false;

  constructor(props: AppProps) {
    super(props);

    this._handleNewProject = this._handleNewProject.bind(this);
    this._handleNewProjectFromFolder = this._handleNewProjectFromFolder.bind(this);
    this._handleNewProjectFromFolderInstance = this._handleNewProjectFromFolderInstance.bind(this);
    this._handleProjectSelected = this._handleProjectSelected.bind(this);
    this._handleCartoInit = this._handleCartoInit.bind(this);
    this._newProjectFromGallery = this._newProjectFromGallery.bind(this);
    this._handleProjectGalleryCommand = this._handleProjectGalleryCommand.bind(this);
    this._handleLocalGalleryCommand = this._handleLocalGalleryCommand.bind(this);
    this._handleHashChange = this._handleHashChange.bind(this);
    this._gitHubAddingMessageUpdater = this._gitHubAddingMessageUpdater.bind(this);
    this._getFileContent = this._getFileContent.bind(this);
    this._saveAll = this._saveAll.bind(this);
    this._handleItemChanged = this._handleItemChanged.bind(this);
    this._handleSaved = this._handleSaved.bind(this);

    if (this.props.fileContentRetriever) {
      this.props.fileContentRetriever(this._getFileContent);
    }

    if (this.props.saveAllRetriever) {
      this.props.saveAllRetriever(this._saveAll);
    }

    window.addEventListener("hashchange", this._handleHashChange, false);

    if (CartoApp.carto === undefined) {
      this.state = {
        carto: undefined,
        mode: AppMode.loading,
        activeProject: null,
      };

      CartoApp.onInitialized.subscribe(this._handleCartoInit);

      // for a potential race condition where carto gets set right in between
      // initting of the state and registering the event.
      if (CartoApp.carto !== undefined) {
        this.state = {
          carto: CartoApp.carto,
          mode: AppMode.home,
          activeProject: null,
        };
      }
    } else {
      const stateFromUrl = this._getStateFromUrl();
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

      if (
        (CartoApp.hostType === HostType.vsCodeWebWeb || CartoApp.hostType === HostType.vsCodeMainWeb) &&
        CartoApp.projectPath &&
        (initialAppMode === AppMode.codeToolbox || initialAppMode === AppMode.codeStartPage)
      ) {
        this._loadLocalStorageProject();
      } else if (CartoApp.modeParameter && CartoApp.modeParameter.startsWith("project/")) {
        const segments = CartoApp.modeParameter.split("/");

        if (segments.length === 2) {
          this._handleNewProject("Project", NewProjectTemplateType.gameTest);

          selectedItem = segments[1];
        }
      } else if (
        CartoApp.initialMode &&
        (CartoApp.modeParameter || CartoApp.initialMode === "info") &&
        CartoApp.projectPath
      ) {
        this._loadLocalStorageProject();
      }

      this.state = {
        carto: CartoApp.carto,
        mode: initialAppMode,
        selectedItem: selectedItem,
        activeProject: null,
      };

      if (!CartoApp.carto.isLoaded) {
        this.loadCarto(CartoApp.carto);
      }
    }
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
    let carto = this.state?.carto;

    if (!carto) {
      carto = CartoApp.carto;
    }

    if (!carto) {
      return;
    }

    let newProject = undefined;

    newProject = await carto.ensureProjectFromLocalStoragePath(CartoApp.projectPath);

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
          carto: carto,
          mode: mode,
          activeProject: newProject,
          selectedItem: selValue,
        };

        if (this._isMountedInternal) {
          this.setState(newState);
        } else {
          this.state = newState;
        }

        // Log.debug("Setting state with new project '" + newProject.name + "'");
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

      case "servermanager":
        return AppMode.serverManager;

      case "servermanagerht":
        return AppMode.serverManagerMinusTitlebar;

      default:
        return undefined;
    }
  }

  private _handleHashChange() {
    const result = this._getStateFromUrl();

    if (result && this._isMountedInternal) {
      this.setState({
        carto: this.state.carto,
        mode: result.mode,
        loadingMessage: this.state.loadingMessage,
        additionalLoadingMessage: this.state.additionalLoadingMessage,
        activeProject: this.state.activeProject,
        selectedItem: result.selectedItem,
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

    const newState = this._getStateFromUrl();
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
      activeProject: this.state.activeProject,
    };

    if (this._isMountedInternal) {
      this.setState(newComponentState);
    } else {
      this.state = newComponentState;
    }
  }

  private _getStateFromUrl(): AppState | undefined {
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

    if (queryVals["open"] !== undefined || queryVals["view"] !== undefined) {
      let isReadOnly = true;
      let openQuery = queryVals["view"];

      const updateContent = queryVals["updates"];

      if (queryVals["open"]) {
        isReadOnly = false;
        openQuery = queryVals["open"];
      }

      const firstSlash = openQuery.indexOf("/");

      if (firstSlash > 1) {
        const openToken = openQuery.substring(0, firstSlash).toLowerCase();

        const openData = openQuery.substring(firstSlash + 1, openQuery.length);

        if (openToken === "gp") {
          this._ensureProjectFromGalleryId(openData, updateContent);
        } else if (openToken === "gh") {
          const segments = openData.split("/");

          if (segments.length === 2) {
            const owner = segments[0];
            const repo = segments[1];

            this._ensureProjectFromGitHubTemplate(
              owner + " " + repo,
              owner,
              repo,
              isReadOnly,
              undefined,
              undefined,
              undefined,
              updateContent
            );
          } else {
            const treeIndex = openData.indexOf("/tree/");

            if (treeIndex >= 0) {
              const beforeTree = openData.substring(0, treeIndex);

              const afterTree = openData.substring(treeIndex + 6, openData.length);

              const beforeSegments = beforeTree.split("/");
              const afterSegments = afterTree.split("/");

              const owner = beforeSegments[0];
              const repo = beforeSegments[1];

              const branch = afterSegments[0];
              const pathIndex = openData.indexOf("/", treeIndex + 6 + branch.length);
              let path = undefined;

              if (pathIndex > treeIndex) {
                path = openData.substring(pathIndex, openData.length);
              }

              this._ensureProjectFromGitHubTemplate(
                owner + " " + repo + " " + path,
                owner,
                repo,
                isReadOnly,
                branch,
                path,
                undefined,
                updateContent
              );

              return {
                mode: AppMode.loading,
                activeProject: null,
              };
            }
          }

          Log.verbose("loading GitHub project '" + openData + "'");
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
            this._handleNewProject("Project", NewProjectTemplateType.gameTest);

            return {
              mode: AppMode.project,
              activeProject: this.state?.activeProject,
              selectedItem: segments[0],
            };
          }
        } else if (commandToken === "toolbox") {
          const segments = commandData.split("/");

          if (segments.length === 1) {
            this._handleNewProject("Project", NewProjectTemplateType.gameTest);

            return {
              mode: AppMode.codeToolbox,
              activeProject: this.state?.activeProject,
              selectedItem: segments[0],
            };
          }
        } else if (commandToken === "codestartpage") {
          return {
            mode: AppMode.codeStartPage,
            activeProject: null,
          };
        } else if (commandToken === "codestartpageforcenewproject") {
          return {
            mode: AppMode.codeStartPageForceNewProject,
            activeProject: null,
          };
        } else if (commandToken === "codelandingforcenewproject") {
          return {
            mode: AppMode.codeLandingForceNewProject,
            activeProject: null,
          };
        } else if (commandToken === "servermanager") {
          return {
            mode: AppMode.serverManager,
            activeProject: null,
          };
        } else if (commandToken === "servermanagerht") {
          return {
            mode: AppMode.serverManagerMinusTitlebar,
            activeProject: null,
          };
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
      carto: CartoApp.carto,
      mode: AppMode.home,
      activeProject: null,
      errorMessage: errorMessage,
    });
  }

  componentDidMount() {
    this._isMountedInternal = true;
  }

  private async _handleNewProject(
    newProjectName: string,
    newProjectType: NewProjectTemplateType,
    newProjectPath?: string,
    newProjectLanguage?: ProjectScriptLanguage,
    additionalFilePath?: string,
    additionalFile?: File
  ) {
    let carto = this.state?.carto;

    if (!carto) {
      carto = CartoApp.carto;
    }

    if (!carto) {
      return;
    }

    if (additionalFile && additionalFilePath && this.state && this._isMountedInternal) {
      this.setState({
        carto: carto,
        mode: AppMode.loading,
        loadingMessage:
          "Loading " + newProjectName + (additionalFilePath.length > 2 ? " from " + additionalFilePath : "") + "...",
      });
    }

    let newProject = undefined;
    let focus = ProjectFocus.gameTests;

    if (newProjectType === NewProjectTemplateType.gameTest) {
      focus = ProjectFocus.gameTests;
    } else if (newProjectType === NewProjectTemplateType.empty) {
      focus = ProjectFocus.general;
    }

    if (newProjectPath === undefined) {
      newProject = await carto.createNewProject(newProjectName, newProjectPath, focus, true, newProjectLanguage);
    } else {
      newProject = await carto.ensureProjectFromFolder(newProjectPath, newProjectName, false);

      await newProject.ensureProjectFolder();

      newProject.focus = focus;

      await newProject.ensureDefaultItems();
    }

    if (additionalFile && additionalFilePath) {
      await newProject.addBrowserFile(additionalFilePath, additionalFile);
    }

    await newProject.save(true);
    await carto.save();

    this._updateWindowTitle(AppMode.project, newProject);

    let nextMode = this.state.mode;

    if (nextMode === AppMode.home || nextMode === AppMode.loading) {
      nextMode = AppMode.project;
    }

    this.initProject(newProject);

    if (this.state && this._isMountedInternal) {
      this.setState({
        carto: carto,
        mode: nextMode,
        activeProject: newProject,
        selectedItem: this.state.selectedItem,
      });
    }
  }

  private async _handleNewProjectFromFolder(folderPath: string) {
    if (this.state.carto === undefined) {
      return;
    }

    const newProject = await this.state.carto.ensureProjectFromFolder(folderPath);

    newProject.save();
    this.state.carto.save();

    this._updateWindowTitle(AppMode.project, newProject);
    this.initProject(newProject);

    this.setState({
      mode: AppMode.project,
      activeProject: newProject,
    });
  }

  private async _handleNewProjectFromFolderInstance(folder: IFolder, name?: string) {
    if (this.state.carto === undefined) {
      return;
    }

    const newProject = new Project(this.state.carto, name ? name : folder.name, null);

    newProject.setProjectFolder(folder);

    await newProject.inferProjectItemsFromFiles();

    newProject.save();
    this.state.carto.save();

    this._updateWindowTitle(AppMode.project, newProject);
    this.initProject(newProject);

    this.setState({
      mode: AppMode.project,
      activeProject: newProject,
    });
  }

  private async _ensureProjectFromGalleryId(galleryId: string, updateContent?: string) {
    if (this.state.carto === undefined) {
      return;
    }

    const gp = await this.state.carto.getGalleryProjectById(galleryId);

    if (gp === undefined) {
      this.setHomeWithError("We could not find a gallery project with an identifier of '" + galleryId + "' to open.");
      return;
    }

    this._ensureProjectFromGallery(gp, updateContent);
  }

  private async _ensureProjectFromGallery(project: IGalleryProject, updateContent?: string) {
    if (this.state === null || this.state.carto === undefined) {
      return;
    }

    this._ensureProjectFromGitHubTemplate(
      project.title,
      project.gitHubOwner,
      project.gitHubRepoName,
      false,
      project.gitHubBranch,
      project.gitHubFolder,
      project.fileList,
      project.id,
      project.type === GalleryProjectType.codeSample ? project.id : undefined,
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
    sampleId?: string,
    updateContent?: string
  ) {
    const carto = CartoApp.carto;

    if (this.state === null || carto === undefined) {
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
      loadingMessage: this._loadingMessage,
      additionalLoadingMessage: undefined,
    });

    await carto.load();

    const projects = carto.projects;

    for (let i = 0; i < projects.length; i++) {
      const proj = projects[i];

      await proj.loadFromFile();

      if (
        proj.originalGitHubOwner === gitHubOwner &&
        proj.originalGitHubRepoName === gitHubRepoName &&
        proj.originalGitHubBranch === gitHubBranch &&
        proj.originalGitHubFolder === gitHubFolder &&
        updateContent === undefined
      ) {
        this._updateWindowTitle(newMode, proj);

        this.initProject(proj);

        this.setState({
          mode: newMode,
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
      sampleId,
      updateContent
    );
  }

  private async _newProjectFromGallery(project: IGalleryProject) {
    if (this.state === null || this.state.carto === undefined) {
      return;
    }

    this._newProjectFromGitHubTemplate(
      project.title,
      project.gitHubOwner,
      project.gitHubRepoName,
      false,
      project.gitHubBranch,
      project.gitHubFolder,
      project.fileList,
      project.id,
      project.type === GalleryProjectType.codeSample ? project.id : undefined,
      undefined
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
    sampleId?: string,
    updateContent?: string
  ) {
    const carto = CartoApp.carto;

    if (this.state === null || carto === undefined) {
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
      loadingMessage: this._loadingMessage,
      additionalLoadingMessage: undefined,
    });

    await carto.load();

    const operId = carto.notifyOperationStarted("Creating new project from '" + title + "'");

    if (gitHubOwner !== undefined && gitHubRepoName !== undefined) {
      const gh = new GitHubStorage(carto.anonGitHub, gitHubRepoName, gitHubOwner, gitHubBranch, gitHubFolder);

      let projName = "my-";

      if (galleryId) {
        projName += galleryId;
      } else if (gitHubFolder !== undefined) {
        projName += gitHubFolder;
        projName = projName.replace(" behavior_packs", "");
      } else {
        projName += gitHubRepoName;
      }

      projName = projName.replace(/_/gi, "");
      projName = projName.replace(/\//gi, "");
      projName = projName.replace(/\\/gi, "");
      projName = projName.replace(/ /gi, "");

      const newProjectName = await carto.getNewProjectName(projName);

      const newProject = await carto.createNewProject(newProjectName, undefined, ProjectFocus.gameTests, false);

      if (fileList) {
        await gh.rootFolder.setStructureFromFileList(fileList);
      } else {
        await gh.rootFolder.load(false);
      }

      const rootFolder = await newProject.ensureProjectFolder();

      await StorageUtilities.syncFolderTo(
        gh.rootFolder,
        rootFolder,
        false,
        false,
        false,
        ["build", "node_modules", "dist", "/.git", "out"],
        this._gitHubAddingMessageUpdater
      );

      newProject.originalGitHubOwner = gitHubOwner;
      newProject.originalFileList = fileList;
      newProject.originalGitHubRepoName = gitHubRepoName;
      newProject.originalGitHubBranch = gitHubBranch;
      newProject.originalGitHubFolder = gitHubFolder;
      newProject.originalGalleryId = galleryId;
      newProject.originalSampleId = sampleId;

      if (sampleId !== undefined) {
        const snippet = ProjectUtilities.getSnippet(sampleId);

        if (snippet) {
          await ProjectUtilities.injectSnippet(newProject, snippet);
        }
      }

      if (updateContent !== undefined && newProject.projectFolder !== null) {
        try {
          const zipBytes = Utilities.base64ToUint8Array(updateContent);

          const zs = new ZipStorage();

          await zs.loadFromUint8Array(zipBytes);

          await StorageUtilities.syncFolderTo(zs.rootFolder, newProject.projectFolder, false, false, false, [
            "package.json",
          ]);
        } catch (e) {
          this.setHomeWithError(
            "Could not process updated content from URL. Check to make sure your shared URL is valid. (" + e + ")"
          );
          return;
        }
      }

      await ProjectExporter.renameDefaultFolders(newProject, title);

      await newProject.inferProjectItemsFromFiles();

      const pur = new ProjectUpdateRunner(newProject);

      await pur.updateProject();

      await newProject.save(true);

      await carto.save();

      this._updateWindowTitle(newMode, newProject);
      this.initProject(newProject);

      this.setState({
        mode: newMode,
        activeProject: newProject,
      });
    }

    carto.notifyOperationEnded(operId, "New project '" + title + "' created.  Have fun!");
  }

  private async _gitHubAddingMessageUpdater(additionalMessage: string) {
    let message = this.state.loadingMessage;

    if (!message) {
      message = "Loading.";
    }

    this.setState({
      mode: this.state.mode,
      carto: this.state.carto,
      activeProject: this.state.activeProject,
      selectedItem: this.state.selectedItem,
      loadingMessage: message,
      additionalLoadingMessage: additionalMessage,
    });
  }

  private async _newProjectFromMinecraftFolder(folderType: LocalFolderType, folder: IFolder) {
    if (this.state === null || this.state.carto === undefined) {
      return;
    }

    let proposedProjectName = StorageUtilities.getBaseFromName(folder.fullPath);
    const mcw = await MCWorld.ensureMCWorldOnFolder(folder);

    if (mcw && mcw.name) {
      proposedProjectName = mcw.name;
    }

    const newProject = await this.state.carto.ensureProjectFromFolder(folder.fullPath, proposedProjectName);

    newProject.save();
    this.state.carto.save();

    this._updateWindowTitle(AppMode.project, newProject);
    this.initProject(newProject);

    this.setState({
      mode: AppMode.project,
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
      loadingMessage: this._loadingMessage,
    });

    await carto.load();

    const projects = carto.projects;
    const canonPath = StorageUtilities.canonicalizePath(folder.fullPath);

    for (let i = 0; i < projects.length; i++) {
      const proj = projects[i];

      await proj.loadFromFile();

      if (proj.originalFullPath === canonPath) {
        this._updateWindowTitle(newMode, proj);
        this.initProject(proj);

        this.setState({
          mode: newMode,
          activeProject: proj,
        });

        return;
      }
    }

    const folderName = StorageUtilities.getLeafName(canonPath);

    const operId = carto.notifyOperationStarted("Creating new project from '" + canonPath + "'");

    if (folderName !== undefined) {
      let projName = "my-" + folderName;

      const newProjectName = await carto.getNewProjectName(projName);

      let newFocus = ProjectFocus.singleBehaviorPack;

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

      this._updateWindowTitle(newMode, newProject);
      this.initProject(newProject);

      this.setState({
        mode: newMode,
        activeProject: newProject,
      });
    }

    carto.notifyOperationEnded(operId, "New project '" + folderName + "' created. Have fun!");
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

  private _handleProjectGalleryCommand(command: GalleryProjectCommand, project: IGalleryProject) {
    switch (command) {
      case GalleryProjectCommand.newProject:
      case GalleryProjectCommand.projectSelect:
        this._newProjectFromGallery(project);
        break;
      case GalleryProjectCommand.ensureProject:
        this._ensureProjectFromGallery(project);
        break;
      case GalleryProjectCommand.forkProject:
        alert("Forking projects is not implemented... yet.");
        break;
    }
  }

  private _handleLocalGalleryCommand(command: LocalGalleryCommand, folderType: LocalFolderType, folder: IFolder) {
    switch (command) {
      case LocalGalleryCommand.openProjectDirect:
        this._newProjectFromMinecraftFolder(folderType, folder);
        break;
    }
  }

  private async _handleProjectSelected(project: Project) {
    await project.loadFromFile();

    this._updateWindowTitle(AppMode.project, project);

    this.initProject(project);

    this.setState({
      mode: AppMode.project,
      activeProject: project,
    });
  }

  private _handleModeChangeRequested = (newMode: AppMode) => {
    this._updateWindowTitle(newMode, this.state.activeProject);

    this.setState({
      mode: newMode,
    });
  };

  render() {
    let interior = <></>;

    if (this.state.carto === undefined) {
      return <div className="app-loading">Loading!</div>;
    }

    let isReadOnly = false;

    if (this.state.mode === AppMode.projectReadOnly) {
      isReadOnly = true;
    }

    let top = <></>;
    let borderStr = "";
    let height = "100vh";
    let heightOffset = 0;

    if (CartoApp.hostType === HostType.electronWeb) {
      top = <ElectronTitleBar mode={this.state.mode} />;
      borderStr = "solid 1px black";

      if (this.state?.mode === AppMode.serverManagerPlusBack) {
        height = "calc(100vh - 42px)";
        heightOffset = 42;
      } else {
        height = "calc(100vh - 36px)";
        heightOffset = 36;
      }
    }

    if (this.state.mode === AppMode.loading) {
      let message = "loading...";

      let additionalLoadingMessage = "";

      if (this.state.loadingMessage !== undefined) {
        message = this.state.loadingMessage;
      }

      if (this.state.additionalLoadingMessage !== undefined) {
        additionalLoadingMessage = this.state.additionalLoadingMessage;
      }

      interior = (
        <div className="app-loading">
          <div>{message}</div>
          <div className="app-subloading">{additionalLoadingMessage}</div>
        </div>
      );
    } else if (this.state.mode === AppMode.exporterTool) {
      interior = (
        <ExporterTool
          carto={this.state.carto}
          onModeChangeRequested={this._handleModeChangeRequested}
          onProjectSelected={this._handleProjectSelected}
        />
      );
    } else if (this.state.mode === AppMode.codeToolbox) {
      interior = (
        <CodeToolbox
          theme={this.props.theme}
          carto={this.state.carto}
          project={this.state.activeProject}
          onModeChangeRequested={this._handleModeChangeRequested}
          onProjectSelected={this._handleProjectSelected}
        />
      );
    } else if (this.state.mode === AppMode.codeStartPage) {
      interior = (
        <CodeStartPage
          theme={this.props.theme}
          carto={this.state.carto}
          forceNewProject={false}
          project={this.state.activeProject}
          onModeChangeRequested={this._handleModeChangeRequested}
          onProjectSelected={this._handleProjectSelected}
        />
      );
    } else if (this.state.mode === AppMode.codeStartPageForceNewProject) {
      interior = (
        <CodeStartPage
          theme={this.props.theme}
          carto={this.state.carto}
          forceNewProject={true}
          project={this.state.activeProject}
          onModeChangeRequested={this._handleModeChangeRequested}
          onProjectSelected={this._handleProjectSelected}
        />
      );
    } else if (this.state.mode === AppMode.codeLandingForceNewProject) {
      interior = (
        <CodeToolboxLanding
          theme={this.props.theme}
          carto={this.state.carto}
          forceNewProject={true}
          project={this.state.activeProject}
          onModeChangeRequested={this._handleModeChangeRequested}
        />
      );
    } else if (this.state.mode === AppMode.remoteServerManager) {
      interior = (
        <RemoteServerManager
          carto={this.state.carto}
          onModeChangeRequested={this._handleModeChangeRequested}
          onProjectSelected={this._handleProjectSelected}
        />
      );
    } else if (
      this.state.mode === AppMode.serverManager ||
      this.state.mode === AppMode.serverManagerPlusBack ||
      this.state.mode === AppMode.serverManagerMinusTitlebar
    ) {
      interior = (
        <ServerManager
          theme={this.props.theme}
          carto={this.state.carto}
          heightOffset={heightOffset}
          displayBackButton={this.state.mode === AppMode.serverManagerPlusBack}
          hideTitlebar={this.state.mode === AppMode.serverManagerMinusTitlebar}
          onModeChangeRequested={this._handleModeChangeRequested}
          onProjectSelected={this._handleProjectSelected}
        />
      );
    } else if (this.state.mode === AppMode.home) {
      interior = (
        <Home
          theme={this.props.theme}
          carto={this.state.carto}
          errorMessage={this.state.errorMessage}
          onGalleryItemCommand={this._handleProjectGalleryCommand}
          onLocalGalleryItemCommand={this._handleLocalGalleryCommand}
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
          carto={this.state.carto}
          theme={this.props.theme}
          hideMainToolbar={true}
          statusAreaMode={ProjectStatusAreaMode.hidden}
          project={this.state.activeProject}
          selectedItem={this.state.selectedItem}
          viewMode={CartoEditorViewMode.mainFocus}
          readOnly={isReadOnly}
          onModeChangeRequested={this._handleModeChangeRequested}
        />
      );
    } else if (this.state.activeProject !== null && CartoApp.initialMode === "info") {
      interior = (
        <ProjectEditor
          carto={this.state.carto}
          theme={this.props.theme}
          hideMainToolbar={true}
          statusAreaMode={ProjectStatusAreaMode.hidden}
          project={this.state.activeProject}
          mode={ProjectEditorMode.info}
          viewMode={CartoEditorViewMode.mainFocus}
          readOnly={isReadOnly}
          onModeChangeRequested={this._handleModeChangeRequested}
        />
      );
    } else if (this.state.activeProject !== null) {
      if (this.state.activeProject.errorState === ProjectErrorState.projectFolderOrFileDoesNotExist) {
        let error = "Could not find project data folder. ";

        if (this.state.activeProject.localFolderPath) {
          error += this.state.activeProject.localFolderPath;
        }

        interior = (
          <Home
            theme={this.props.theme}
            carto={this.state.carto}
            errorMessage={error}
            onGalleryItemCommand={this._handleProjectGalleryCommand}
            onLocalGalleryItemCommand={this._handleLocalGalleryCommand}
            onModeChangeRequested={this._handleModeChangeRequested}
            onNewProjectSelected={this._handleNewProject}
            onNewProjectFromFolderSelected={this._handleNewProjectFromFolder}
            onProjectSelected={this._handleProjectSelected}
          />
        );
      } else {
        interior = (
          <ProjectEditor
            carto={this.state.carto}
            theme={this.props.theme}
            project={this.state.activeProject}
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
