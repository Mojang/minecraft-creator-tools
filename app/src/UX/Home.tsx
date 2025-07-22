import { Component, MouseEvent, SyntheticEvent } from "react";
import IAppProps from "./IAppProps";
import { AppMode } from "./App";
import "./Home.css";
import {
  List,
  Dialog,
  InputProps,
  ThemeInput,
  FormInput,
  MenuButton,
  Toolbar,
  selectableListBehavior,
  selectableListItemBehavior,
  ListItemProps,
  ShorthandValue,
  MenuProps,
  menuItemBehavior,
} from "@fluentui/react-northstar";
import { NewProjectTemplateType } from "./App";
import Carto from "./../app/Carto";
import Project from "./../app/Project";
import Utilities from "../core/Utilities";
import Log from "../core/Log";
import IGallery from "../app/IGallery";
import IFolder from "../storage/IFolder";
import IGalleryItem from "../app/IGalleryItem";
import { GalleryProjectCommand } from "./ProjectGallery";
import AppServiceProxy, { AppServiceProxyCommands } from "../core/AppServiceProxy";
import ProjectGallery from "./ProjectGallery";
import StorageUtilities from "../storage/StorageUtilities";
import { LocalFolderLabel, ConnectLabel, ExportBackupLabel } from "./Labels";
import FileSystemStorage from "../storage/FileSystemStorage";
import CartoApp from "../app/CartoApp";
import { ProjectTileDisplayMode } from "./ProjectTile";
import { LocalFolderType, LocalGalleryCommand } from "./LocalGalleryCommand";
import ProjectUtilities from "../app/ProjectUtilities";
import { ProjectEditorMode } from "./ProjectEditorUtilities";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass } from "@fortawesome/free-solid-svg-icons";
import WebUtilities from "./WebUtilities";
import FileSystemFolder from "../storage/FileSystemFolder";
import { faNewspaper } from "@fortawesome/free-regular-svg-icons";
import { MinecraftFlavor } from "../app/ICartoData";
import IStorage from "../storage/IStorage";
import MinecraftBox from "./MinecraftBox";
import MinecraftButton from "./MinecraftButton";
import IProjectSeed from "../app/IProjectSeed";
import NewProject from "./NewProject";
import HomeFooter from "./HomeFooter";
import HomeHeader from "./HomeHeader";

enum HomeDialogMode {
  none = 0,
  newProject = 1,
  errorMessage = 2,
  confirmProjectDelete = 3,
  infoMessage = 4,
  webLocalDeploy = 5,
}

interface IHomeProps extends IAppProps {
  theme: ThemeInput<any>;
  errorMessage: string | undefined;
  heightOffset: number;
  visualSeed?: number;
  isPersisted?: boolean;
  onModeChangeRequested?: (mode: AppMode) => void;
  onProjectSelected?: (project: Project) => void;
  onLog: (message: string) => Promise<void>;
  onSetProject: (project: Project) => void;
  onGalleryItemCommand: (command: GalleryProjectCommand, newProjectSeed: IProjectSeed) => void;
  onLocalGalleryItemCommand: (command: LocalGalleryCommand, folderType: LocalFolderType, folder: IFolder) => void;
  onNewProjectSelected?: (
    newProjectSeed: IProjectSeed,
    newProjectType: NewProjectTemplateType,
    additionalFilePath?: string,
    additionalFile?: File,
    editorStartMode?: ProjectEditorMode,
    isReadOnly?: boolean
  ) => void;
  onNewProjectFromFolderSelected?: (folder: string) => void;
  onProgressLog?: (message: string) => void;
  onNewProjectFromFolderInstanceSelected?: (folder: IFolder, name?: string, isDocumentationProject?: boolean) => void;
}

export enum HomeEffect {
  none = 0,
  dragOver = 1,
}

interface IHomeState {
  gallery: IGallery | undefined;
  dialogMode: HomeDialogMode;
  effect: HomeEffect;
  isDeployingToComMojang: boolean;
  selectedProject?: string;
  search?: string;
  errorMessage?: string;
  inlineUpdateMessage?: string;
  inlineLoadingMessage?: string;
  newProjectSeed?: IProjectSeed;
  contextFocusedProject?: number;
}

export default class Home extends Component<IHomeProps, IHomeState> {
  _carto?: Carto;
  constructor(props: IHomeProps) {
    super(props);

    this._handleProjectGalleryCommand = this._handleProjectGalleryCommand.bind(this);
    this._handleLocalGalleryCommand = this._handleLocalGalleryCommand.bind(this);

    if (this.props.errorMessage) {
      this.state = {
        gallery: undefined,
        effect: HomeEffect.none,
        isDeployingToComMojang: this.props.carto.isDeployingToComMojang,
        dialogMode: HomeDialogMode.errorMessage,
        errorMessage: this.props.errorMessage,
      };
    } else {
      this.state = {
        gallery: undefined,
        isDeployingToComMojang: this.props.carto.isDeployingToComMojang,
        effect: HomeEffect.none,
        dialogMode: HomeDialogMode.none,
      };
    }

    this._onCartoLoaded = this._onCartoLoaded.bind(this);
    this._onDeploymentStorageChanged = this._onDeploymentStorageChanged.bind(this);
    this._onDeploymentStorageChanged = this._onDeploymentStorageChanged.bind(this);
    this._handleOpenFolderViaAppServiceClick = this._handleOpenFolderViaAppServiceClick.bind(this);
    this._handleOpenLocalFolderClick = this._handleOpenLocalFolderClick.bind(this);
    this._handleOpenWebLocalDeployClick = this._handleOpenWebLocalDeployClick.bind(this);
    this._handleOpenLocalFolderForDocumentationClick = this._handleOpenLocalFolderForDocumentationClick.bind(this);
    this._handleProjectClicked = this._handleProjectClicked.bind(this);
    this._handleDialogCancel = this._handleDialogCancel.bind(this);
    this._handleContextMenu = this._handleContextMenu.bind(this);
    this._projectContextBlurred = this._projectContextBlurred.bind(this);
    this._blurIfNotActive = this._blurIfNotActive.bind(this);
    this._handleNewProjectConfirm = this._handleNewProjectConfirm.bind(this);
    this._handleErrorMessageConfirm = this._handleErrorMessageConfirm.bind(this);
    this._handleDeleteProjectConfirm = this._handleDeleteProjectConfirm.bind(this);
    this._doManageConsent = this._doManageConsent.bind(this);
    this._handleExportToolClick = this._handleExportToolClick.bind(this);
    this._handleExportAll = this._handleExportAll.bind(this);
    this._handleNewSearch = this._handleNewSearch.bind(this);
    this._handleConnectClick = this._handleConnectClick.bind(this);
    this._onGalleryLoaded = this._onGalleryLoaded.bind(this);
    this._handleFileUpload = this._handleFileUpload.bind(this);
    this._handleInspectFileUpload = this._handleInspectFileUpload.bind(this);
    this._handleFileDrop = this._handleFileDrop.bind(this);
    this._handleFileDragOut = this._handleFileDragOut.bind(this);
    this._handleFileDragOver = this._handleFileDragOver.bind(this);
    this._processInputtedEntry = this._processInputtedEntry.bind(this);
    this._processIncomingFile = this._processIncomingFile.bind(this);
    this._startDelayLoadItems = this._startDelayLoadItems.bind(this);
    this._recentItemContextMenuClick = this._recentItemContextMenuClick.bind(this);
    this._handleNewProjectSeedUpdate = this._handleNewProjectSeedUpdate.bind(this);

    if (typeof window !== "undefined") {
      window.setTimeout(this._startDelayLoadItems, 10);
    }
  }

  private _handleFileDragOut(event: any) {
    if (this.state && this.state.dialogMode !== HomeDialogMode.none) {
      return;
    }

    const top = event.pageY;
    const left = event.pageX;
    const right = document.body.clientWidth - left;
    const bottom = document.body.clientHeight - top;

    if (top < 10 || right < 10 || bottom < 10 || left < 10) {
      this._stopDragEffect();
    }
  }

  private _stopDragEffect() {
    if (this.state !== undefined) {
      if (this.state.effect === HomeEffect.dragOver) {
        this.setState({
          gallery: this.state.gallery,
          dialogMode: this.state.dialogMode,
          isDeployingToComMojang: this.props.carto.isDeployingToComMojang,
          search: this.state.search,
          effect: HomeEffect.none,
          newProjectSeed: this.state.newProjectSeed,
        });
      }
    }
  }

  private _doManageConsent() {
    if ((window as any).manageConsent) {
      (window as any).manageConsent();
    }
  }

  private _handleFileDragOver(event: any) {
    if (this.state !== undefined) {
      if (this.state.dialogMode !== HomeDialogMode.none) {
        return;
      }

      if (this.state.effect !== HomeEffect.dragOver) {
        const top = event.pageY;
        const left = event.pageX;
        const right = document.body.clientWidth - left;
        const bottom = document.body.clientHeight - top;

        if (top > 10 && right > 10 && bottom > 10 && left > 10) {
          this.setState({
            gallery: this.state.gallery,
            dialogMode: this.state.dialogMode,
            isDeployingToComMojang: this.props.carto.isDeployingToComMojang,
            effect: HomeEffect.dragOver,
            newProjectSeed: this.state.newProjectSeed,
          });
        }
      }
    }

    if (event == null) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
  }

  componentDidMount() {
    if (typeof window !== "undefined") {
      window.document.addEventListener("dragleave", this._handleFileDragOut);
      window.document.body.addEventListener("dragover", this._handleFileDragOver);
      window.document.body.addEventListener("drop", this._handleFileDrop);
    }

    this._updateCarto();
  }

  componentWillUnmount() {
    if (typeof window !== "undefined") {
      window.document.removeEventListener("dragleave", this._handleFileDragOut);
      window.document.body.removeEventListener("dragover", this._handleFileDragOver);
      window.document.body.removeEventListener("drop", this._handleFileDrop);
    }
  }

  private async _handleDirectoryHandle(dirHandle: FileSystemDirectoryHandle, isDocumentationProject?: boolean) {
    const name = dirHandle.name.toLowerCase();

    if (name === "mc_lnk" || name === "mcpvw_lnk" || name.indexOf("bds") >= 0 || name.indexOf("server") >= 0) {
      let fss = new FileSystemStorage(dirHandle as FileSystemDirectoryHandle, dirHandle.name);

      const safeMessage = await (fss.rootFolder as FileSystemFolder).getFirstUnsafeError();

      if (safeMessage !== undefined) {
        Log.debugAlert(safeMessage);
        return false;
      }

      CartoApp.deploymentStorage = fss;

      this.props.carto.isDeployingToComMojang = true;
      this.props.carto.updateDeploymentStorage(fss);
      this.props.carto.ensureMinecraft(MinecraftFlavor.deploymentStorage);

      this.setState({
        gallery: this.state.gallery,
        search: this.state.search,
        isDeployingToComMojang: this.props.carto.isDeployingToComMojang,
        newProjectSeed: this.state.newProjectSeed,
        effect: HomeEffect.none,
        dialogMode: HomeDialogMode.none,
        inlineLoadingMessage: this.state.inlineLoadingMessage,
        inlineUpdateMessage: "Set deployment folder as '" + name + "'.",
      });

      return true;
    } else {
      if (this.props.onProgressLog) {
        this.props.onProgressLog("Scanning folder '" + dirHandle.name + "'...");
      }

      let fss = new FileSystemStorage(dirHandle as FileSystemDirectoryHandle, dirHandle.name);

      const safeMessage = await (fss.rootFolder as FileSystemFolder).getFirstUnsafeError();

      if (safeMessage !== undefined) {
        this.setState({
          errorMessage:
            "Folder has unsupported files within it. Please choose a folder on your device that only has Minecraft asset files in it (.json, .png, .mcfunction, etc.)\r\n\r\nDetails: " +
            safeMessage,
          dialogMode: HomeDialogMode.errorMessage,
          isDeployingToComMojang: this.props.carto.isDeployingToComMojang,
        });
        return false;
      }

      if (this.props.onNewProjectFromFolderInstanceSelected) {
        this.props.onNewProjectFromFolderInstanceSelected(fss.rootFolder, dirHandle.name, isDocumentationProject);
        return true;
      }
    }

    return false;
  }

  private async _handleFileDrop(ev: DragEvent): Promise<any> {
    if (this.state && this.state.dialogMode !== HomeDialogMode.none) {
      return;
    }

    ev.preventDefault();
    ev.stopPropagation();

    if (ev == null || ev.dataTransfer == null) {
      return;
    }

    if (ev.dataTransfer.items) {
      for (var i = 0; i < ev.dataTransfer.items.length; i++) {
        const dtitem = ev.dataTransfer.items[i];

        let entry: any | undefined;

        if (dtitem.webkitGetAsEntry) {
          entry = dtitem.webkitGetAsEntry();
        } else if ((dtitem as any).getAsEntry) {
          entry = (dtitem as any).getAsEntry();
        }

        if (entry && entry.isDirectory) {
          const dirHandle = await dtitem.getAsFileSystemHandle();

          if (dirHandle) {
            const perm = await dirHandle.requestPermission({
              mode: "readwrite",
            });

            if (perm) {
              await this._handleDirectoryHandle(dirHandle as FileSystemDirectoryHandle);
            }
          } else {
            const directoryReader = (entry as any).createReader();
            const me = this;

            directoryReader.readEntries(function (entries: any) {
              entries.forEach((childEntry: any) => {
                me._processInputtedEntry((entry as any).fullPath, childEntry);
              });
            });
          }
        } else if (dtitem.kind === "file") {
          const file = dtitem.getAsFile();
          if (file) {
            this._processIncomingFile("/", file);
          }
        }
      }
    }

    this._stopDragEffect();
  }

  private _processInputtedEntry(path: string, entry: any) {
    if (entry.file) {
      entry.file((file: File) => {
        this._processIncomingFile(path, file);
      });
    }
  }

  private _processIncomingFile(path: string, file: File, editorStartMode?: ProjectEditorMode, isReadOnly?: boolean) {
    if (file != null && this.props.onNewProjectSelected) {
      let fileName = "File";

      if (file.name) {
        fileName = file.name;

        fileName = StorageUtilities.getBaseFromName(fileName);
      }

      this.props.onNewProjectSelected(
        {
          name: fileName,
        },
        NewProjectTemplateType.empty,
        path,
        file,
        editorStartMode,
        isReadOnly
      );
    }
  }

  private _startDelayLoadItems() {
    // load things in the background while we're on the home screen.
    //Database.loadContent();
    //Database.loadDefaultBehaviorPack();
  }

  get carto() {
    return this._carto;
  }

  private _onGalleryLoaded() {
    if (this.carto) {
      this.carto.onGalleryLoaded.unsubscribe(this._onGalleryLoaded);
    }

    this.setState({
      gallery: this.props.carto.gallery,
      dialogMode: this.state.dialogMode,
      effect: this.state.effect,
      isDeployingToComMojang: this.props.carto.isDeployingToComMojang,
      newProjectSeed: this.state.newProjectSeed,
    });
  }

  componentDidUpdate(prevProps: IHomeProps, prevState: IHomeState) {
    this.setCarto(this.props.carto);
  }

  async _handleConnectClick() {
    if (this.props.onModeChangeRequested) {
      this.props.onModeChangeRequested(AppMode.companionPlusBack);
    }
  }

  _handleExportToolClick() {
    if (this.props.onModeChangeRequested === undefined) {
      Log.unexpectedUndefined("HETC");
      return;
    }

    this.props.onModeChangeRequested(AppMode.exporterTool);
  }

  async _handleExportAll() {
    const name = "mctbackup." + Utilities.getDateSummary(new Date()) + ".zip";

    this.setState({
      gallery: this.state.gallery,
      search: this.state.search,
      newProjectSeed: this.state.newProjectSeed,
      isDeployingToComMojang: this.props.carto.isDeployingToComMojang,
      effect: HomeEffect.none,
      dialogMode: HomeDialogMode.none,
      inlineLoadingMessage: "Creating backup zip as '" + name + "'...",
      inlineUpdateMessage: this.state.inlineUpdateMessage,
    });

    // give a pause for the state to update with the loading message.
    window.setTimeout(async () => {
      const operId = await this.props.carto.notifyOperationStarted("Exporting all projects as zip.");

      const zipStorage = await this.props.carto.getExportZip();

      const zipBinary = await zipStorage.generateBlobAsync();

      await this.props.carto.notifyOperationEnded(operId, "Export of projects created; downloading");

      saveAs(zipBinary, name);

      this.setState({
        gallery: this.state.gallery,
        search: this.state.search,
        newProjectSeed: this.state.newProjectSeed,
        isDeployingToComMojang: this.props.carto.isDeployingToComMojang,
        effect: HomeEffect.none,
        dialogMode: HomeDialogMode.none,
        inlineLoadingMessage: undefined,
        inlineUpdateMessage: this.state.inlineUpdateMessage,
      });
    }, 1);
  }

  async _updateCarto() {
    await this.setCarto(this.props.carto);

    if (!this.carto) {
      return;
    }

    if (this.carto.galleryLoaded) {
      this.setState({
        gallery: this.carto.gallery,
        dialogMode: this.state.dialogMode,
        isDeployingToComMojang: this.props.carto.isDeployingToComMojang,
      });
    } else {
      this.carto.onGalleryLoaded.subscribe(this._onGalleryLoaded);
      this.carto.loadGallery();
    }
  }

  async setCarto(newCarto: Carto | undefined) {
    if (this._carto !== newCarto) {
      this._carto = newCarto;

      if (this._carto != null) {
        this._carto.onLoaded.subscribe(this._onCartoLoaded);
        this._carto.onDeploymentStorageChanged.subscribe(this._onDeploymentStorageChanged);
        await this._carto.load();
      }
    }
  }

  private _onDeploymentStorageChanged(source: Carto, deploymentStorage: IStorage | null) {
    this.setState({
      gallery: this.state.gallery,
      dialogMode: this.state.dialogMode,
      isDeployingToComMojang: this.props.carto.isDeployingToComMojang,
      effect: this.state.effect,
      search: this.state.search,
      errorMessage: this.state.errorMessage,
      newProjectSeed: this.state.newProjectSeed,
      contextFocusedProject: this.state.contextFocusedProject,
    });
  }

  private _onCartoLoaded(source: Carto, target: Carto) {
    this.forceUpdate();
    this._loadAsync();
  }

  private async _loadAsync() {
    // add any async loading code here.
    this.forceUpdate();
  }

  private _handleDialogCancel() {
    this.setState({
      gallery: this.state?.gallery,
      dialogMode: HomeDialogMode.none,
    });
  }

  private _handleContextMenu(e: MouseEvent<HTMLUListElement, Event>, data?: any | undefined) {
    if (e.currentTarget && e.currentTarget.children.length > 0 && e.button < 0) {
      let curIndex = 0;
      const eltChildren = e.currentTarget.children;

      for (let i = 0; i < eltChildren.length; i++) {
        const elt = eltChildren[i];
        if ((elt as HTMLElement).tabIndex === 0) {
          this.setState({
            gallery: this.state.gallery,
            dialogMode: this.state.dialogMode,
            isDeployingToComMojang: this.props.carto.isDeployingToComMojang,
            effect: this.state.effect,
            search: this.state.search,
            errorMessage: this.state.errorMessage,
            newProjectSeed: this.state.newProjectSeed,
            contextFocusedProject: curIndex,
          });
          e.preventDefault();
          return;
        }
        curIndex++;
      }
    }
  }

  private _projectContextBlurred(e: SyntheticEvent<HTMLElement, Event>, data?: any | undefined) {
    window.setTimeout(this._blurIfNotActive, 10);
  }

  private _blurIfNotActive() {
    if (
      this.state &&
      this.state.contextFocusedProject !== undefined &&
      window.document.activeElement &&
      window.document.activeElement.className.indexOf("menu") < 0
    ) {
      this.setState({
        gallery: this.state.gallery,
        dialogMode: this.state.dialogMode,
        effect: this.state.effect,
        search: this.state.search,
        isDeployingToComMojang: this.props.carto.isDeployingToComMojang,
        errorMessage: this.state.errorMessage,
        newProjectSeed: this.state.newProjectSeed,
        contextFocusedProject: undefined,
      });
    }
  }

  private _handleErrorMessageConfirm() {
    this.setState({
      gallery: this.state?.gallery,
      dialogMode: HomeDialogMode.none,
      isDeployingToComMojang: this.props.carto.isDeployingToComMojang,
    });
  }

  private async _handleDeleteProjectConfirm() {
    if (this.state.selectedProject) {
      await this.props.carto.deleteProjectByName(this.state.selectedProject);
    }

    this.setState({
      gallery: this.state?.gallery,
      dialogMode: HomeDialogMode.none,
      isDeployingToComMojang: this.props.carto.isDeployingToComMojang,
    });
  }

  private _handleNewProjectConfirm() {
    this.setState({
      gallery: this.state?.gallery,
      dialogMode: HomeDialogMode.none,
      isDeployingToComMojang: this.props.carto.isDeployingToComMojang,
    });

    if (
      this.state.newProjectSeed &&
      this.state.newProjectSeed.name !== undefined &&
      this.props.onGalleryItemCommand !== undefined
    ) {
      this.props.onGalleryItemCommand(GalleryProjectCommand.newProject, this.state.newProjectSeed);
    } else if (
      this.props.onNewProjectSelected &&
      this.state?.newProjectSeed &&
      this.state.newProjectSeed.name !== undefined
    ) {
      this.props.onNewProjectSelected(this.state.newProjectSeed, NewProjectTemplateType.gameTest);
    }
  }

  private async _handleOpenFolderViaAppServiceClick() {
    const result = await AppServiceProxy.sendAsync(AppServiceProxyCommands.openFolder, "");

    if (result && result.length > 0) {
      if (this.props.onNewProjectFromFolderSelected !== undefined) {
        this.props.onNewProjectFromFolderSelected(result);
      }
    }
  }

  private async _handleOpenWebLocalDeployClick() {
    this.setState({
      gallery: this.state.gallery,
      dialogMode: HomeDialogMode.webLocalDeploy,
      search: this.state.search,
      effect: this.state.effect,
      isDeployingToComMojang: this.props.carto.isDeployingToComMojang,
      newProjectSeed: this.state.newProjectSeed,
    });
  }

  private async _handleOpenLocalFolderClick() {
    await this.openLocalFolder(false);
  }

  private async _handleOpenLocalFolderForDocumentationClick() {
    await this.openLocalFolder(true);
  }

  private async openLocalFolder(isDocumentationProject?: boolean) {
    const result = (await window.showDirectoryPicker({
      mode: "readwrite",
    })) as FileSystemDirectoryHandle | undefined;

    if (result) {
      await this._handleDirectoryHandle(result as FileSystemDirectoryHandle, isDocumentationProject);
    }
  }

  private async _handleProjectClicked(event: SyntheticEvent<HTMLElement, Event>) {
    if (
      event === undefined ||
      (event.currentTarget as HTMLDivElement)?.title === undefined ||
      this.carto === null ||
      this.props.onProjectSelected === undefined
    ) {
      return;
    }

    const newProject = this.props.carto.getProjectByName((event.currentTarget as HTMLDivElement)?.title);

    if (!newProject) {
      return;
    }

    const folder = await newProject.ensureProjectFolder();

    const doesExist = await folder.exists();

    if (!doesExist) {
      this.setState({
        errorMessage: "Project at '" + folder.fullPath + "' does not appear to exist. Is it on this device?",
        dialogMode: HomeDialogMode.errorMessage,
        isDeployingToComMojang: this.props.carto.isDeployingToComMojang,
      });
      return;
    }

    if (this.props && this.props.onNewProjectSelected !== undefined) {
      this.props.onProjectSelected(newProject as Project);
    }
  }

  private _handleProjectGalleryCommand(command: GalleryProjectCommand, project: IGalleryItem) {
    if (command === GalleryProjectCommand.newProject) {
      this.setState({
        gallery: this.state.gallery,
        dialogMode: HomeDialogMode.newProject,
        effect: HomeEffect.none,
        search: this.state.search,
        errorMessage: undefined,
        isDeployingToComMojang: this.props.carto.isDeployingToComMojang,
        newProjectSeed: {
          name: ProjectUtilities.getSuggestedProjectName(project),
          creator: this.props.carto.creator,
          galleryProject: project,
        },
      });
    } else {
      if (this.props.onGalleryItemCommand !== undefined) {
        this.props.onGalleryItemCommand(command, {
          galleryProject: project,
        });
      }
    }
  }

  private _handleLocalGalleryCommand(command: LocalGalleryCommand, folderType: LocalFolderType, folder: IFolder) {
    if (this.props.onLocalGalleryItemCommand !== undefined) {
      this.props.onLocalGalleryItemCommand(command, folderType, folder);
    }
  }

  private _compareProjects(projectA: Project, projectB: Project) {
    if (projectA.modified === null || projectB.modified === null) {
      return 0;
    }

    return projectB.modified.getTime() - projectA.modified.getTime();
  }

  private _handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    if (!event.target || !event.target.files || event.target.files.length <= 0 || !this.props.carto.packStorage) {
      return;
    }

    const file = event.target.files[0];

    if (!file) {
      return;
    }

    this._processIncomingFile("/", file);
  }

  _recentItemContextMenuClick(e: SyntheticEvent<HTMLElement, Event>, data?: any | undefined) {
    if (data !== undefined && data.tag !== undefined && this.props.carto !== null) {
      const project = this.props.carto.getProjectByName(data.tag);

      if (project !== null) {
        if (data.content === "Delete") {
          this.setState({
            gallery: this.state.gallery,
            dialogMode: HomeDialogMode.confirmProjectDelete,
            isDeployingToComMojang: this.props.carto.isDeployingToComMojang,
            search: this.state.search,
            effect: this.state.effect,
            selectedProject: data.tag,
            contextFocusedProject: undefined,
          });
        }
      }
    }

    e.preventDefault();
    e.stopPropagation();
  }

  private _handleInspectFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    if (!event.target || !event.target.files || event.target.files.length <= 0 || !this.props.carto.packStorage) {
      return;
    }

    const file = event.target.files[0];

    if (!file) {
      return;
    }

    this._processIncomingFile("/", file, ProjectEditorMode.inspector, true);
  }

  _handleNewSearch(
    event: SyntheticEvent<HTMLElement, Event> | React.KeyboardEvent<Element> | null,
    data: (InputProps & { value: string }) | undefined
  ) {
    if (event === null || data === null || data === undefined || !this.state) {
      return;
    }

    const newSearch = data.value;

    this.setState({
      gallery: this.state.gallery,
      dialogMode: this.state.dialogMode,
      search: newSearch,
      isDeployingToComMojang: this.props.carto.isDeployingToComMojang,
      effect: this.state.effect,
      newProjectSeed: this.state.newProjectSeed,
    });
  }

  private _handleNewProjectSeedUpdate(newSeed: IProjectSeed) {
    if (this.state == null) {
      return;
    }

    this.setState({
      gallery: this.state.gallery,
      dialogMode: this.state.dialogMode,
      search: this.state.search,
      isDeployingToComMojang: this.props.carto.isDeployingToComMojang,
      effect: this.state.effect,
      newProjectSeed: newSeed,
    });
  }

  render() {
    const projectListItems: ShorthandValue<ListItemProps>[] = [];

    let dialogArea = <></>;
    let localGallery = <></>;

    const browserWidth = WebUtilities.getWidth();

    if (this.props === null || this.props.carto === null) {
      return;
    }

    const sortedProjects = this.props.carto.projects.sort(this._compareProjects);

    for (let i = 0; i < sortedProjects.length; i++) {
      const project = sortedProjects[i];
      const itemMenu: ShorthandValue<MenuProps> = {
        activeIndex: 0,
        defaultActiveIndex: 0,
        items: [
          {
            key: "delete",
            content: "Delete",
            accessibility: menuItemBehavior,
            tag: project.name,
          },
        ],
      };
      let modifiedSummary = "";

      if (project.modified != null) {
        modifiedSummary = Utilities.getFriendlySummary(project.modified);
      }

      projectListItems.push({
        key: "SP" + project.name + "." + i,
        accessibility: selectableListItemBehavior,
        onClick: this._handleProjectClicked,
        title: project.name,
        content: (
          <MenuButton
            contextMenu={i !== this.state.contextFocusedProject}
            open={i === this.state.contextFocusedProject ? true : undefined}
            onBlur={this._projectContextBlurred}
            trigger={
              <div className="home-recentItem" key={"rei" + i} style={{ minWidth: 282 }} tabIndex={0}>
                <span className="home-recentItemLabel">{project.name}</span>
                <span className="home-recentItemModified">{modifiedSummary}</span>
              </div>
            }
            menu={itemMenu}
            onMenuItemClick={this._recentItemContextMenuClick}
          />
        ),
      });
    }

    let gallery = [];
    let mainToolArea = [];
    let messageArea = [];
    let toolBin: any[] = [];

    messageArea.push(
      <div className="home-areaLoading" key="loadingLabel">
        Loading...
      </div>
    );

    if (this.state !== null && this.state.gallery !== undefined) {
      messageArea = [];

      if (this.state !== null && this.state.inlineUpdateMessage) {
        messageArea.push(
          <div
            className="home-inlineMessage"
            key="loadingLabel"
            style={{
              backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background3,
              color: this.props.theme.siteVariables?.colorScheme.brand.foreground3,
            }}
          >
            {this.state.inlineUpdateMessage}
          </div>
        );
      }
      if (this.state !== null && this.state.inlineLoadingMessage) {
        messageArea.push(
          <div
            className="home-inlineMessage"
            key="loadingLabel"
            style={{
              backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background3,
              color: this.props.theme.siteVariables?.colorScheme.brand.foreground3,
            }}
          >
            <img className="home-loadingIcon" src="loading.gif" alt="Waiting spinner" />
            {this.state.inlineLoadingMessage}
          </div>
        );
      }

      mainToolArea.push(
        <h2 className="home-gallery-label" key="toolsLabel">
          Tools
        </h2>
      );

      toolBin.push(
        <MinecraftBox theme={this.props.theme} key="home-validateTool" className="home-toolTile">
          <div className="home-toolTileInner">
            <h3
              className="home-toolTile-label"
              style={{
                color: this.props.theme.siteVariables?.colorScheme.brand.foreground3,
              }}
            >
              <span className="home-iconAdjust">
                <FontAwesomeIcon icon={faMagnifyingGlass} className="fa-lg home-iconAdjust" />
              </span>
              <span>&#160;Validate/Inspect Content</span>
            </h3>
            <div className="home-toolTile-instruction">
              Upload a zip/MCAddon/MCPack/MCWorld of Minecraft files to get an Inspector report.
            </div>
            <input
              type="file"
              accept=".mcaddon, .mcpack, .mcworld, .mcproject, .mctemplate, .zip"
              title="Upload a .mcpack, .mcaddon, or ZIP file to validate"
              className="home-inspectFileUpload"
              style={{
                color: this.props.theme.siteVariables?.colorScheme.brand.foreground3,
                backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background5,
              }}
              onChange={this._handleInspectFileUpload}
            />
          </div>
        </MinecraftBox>
      );

      if (Utilities.isPreview) {
        toolBin.push(
          <MinecraftButton
            onClick={this._handleOpenLocalFolderForDocumentationClick}
            theme={this.props.theme}
            key="home-documentationEditor"
            className="home-toolTile"
          >
            <div className="home-toolTileInner">
              <h3 className="home-toolTile-label">
                <span className="home-iconAdjust">
                  <FontAwesomeIcon icon={faNewspaper} className="fa-lg home-iconAdjust" />
                </span>
                <span>&#160;Documentation Editor</span>
              </h3>
              <div className="home-toolTile-instruction">
                Open on the MinecraftApiDocumentation git repo docs folder on your PC.
              </div>
              <div
                style={{
                  color: this.props.theme.siteVariables?.colorScheme.brand.foreground1,
                  backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background5,
                }}
                className="home-toolTile-button"
              >
                Open MinecraftApiDocumentation/docs
              </div>
            </div>
          </MinecraftButton>
        );
      }

      mainToolArea.push(
        <div key="toolBinArea" className="home-toolTile-bin">
          {toolBin}
        </div>
      );

      gallery.push(
        <div className="home-starterArea" key="starterArea">
          <h2 className="home-gallery-label">Start from a template or code snippet</h2>
          <div className="home-search-area">
            <FormInput
              id="projSearch"
              className="home-search"
              aria-label="Search starters"
              defaultValue={""}
              placeholder="Search starters"
              value={this.state.search}
              onChange={this._handleNewSearch}
            />
          </div>
        </div>
      );
      gallery.push(
        <ProjectGallery
          theme={this.props.theme}
          key="projGallery"
          search={this.state.search}
          view={ProjectTileDisplayMode.large}
          onGalleryItemCommand={this._handleProjectGalleryCommand}
          carto={this.props.carto}
          gallery={this.state.gallery}
        />
      );
    }

    if (this.state?.dialogMode === HomeDialogMode.newProject && this.state.newProjectSeed) {
      dialogArea = (
        <Dialog
          open={true}
          cancelButton="Cancel"
          confirmButton="OK"
          onCancel={this._handleDialogCancel}
          onConfirm={this._handleNewProjectConfirm}
          content={
            <NewProject
              onNewProjectUpdated={this._handleNewProjectSeedUpdate}
              projectSeed={this.state.newProjectSeed}
              carto={this.props.carto}
              theme={this.props.theme}
            />
          }
          header={"New Minecraft " + this.state.newProjectSeed?.galleryProject?.title + " Project"}
        />
      );
    } else if (this.state?.dialogMode === HomeDialogMode.errorMessage) {
      const newDialogInnerContent = <div>{this.state.errorMessage}</div>;

      dialogArea = (
        <Dialog
          open={true}
          cancelButton="Cancel"
          confirmButton="OK"
          onCancel={this._handleErrorMessageConfirm}
          onConfirm={this._handleErrorMessageConfirm}
          content={newDialogInnerContent}
          header={"Error"}
        />
      );
    } else if (this.state?.dialogMode === HomeDialogMode.infoMessage) {
      const newDialogInnerContent = <div>{this.state.errorMessage}</div>;

      dialogArea = (
        <Dialog
          open={true}
          cancelButton="Cancel"
          confirmButton="OK"
          onCancel={this._handleErrorMessageConfirm}
          onConfirm={this._handleErrorMessageConfirm}
          content={newDialogInnerContent}
          header={"Info"}
        />
      );
    } else if (this.state?.dialogMode === HomeDialogMode.confirmProjectDelete) {
      const newDialogInnerContent = (
        <div>
          Do you want to delete '{this.state.selectedProject}' from your browser's storage? This action cannot be
          undone.
        </div>
      );

      dialogArea = (
        <Dialog
          open={true}
          cancelButton="Cancel"
          confirmButton="Delete"
          onCancel={this._handleDialogCancel}
          onConfirm={this._handleDeleteProjectConfirm}
          content={newDialogInnerContent}
          header={"Delete Project"}
        />
      );
    }

    const introArea = [];
    const recentsArea = [];

    if (projectListItems.length > 0) {
      if (AppServiceProxy.hasAppServiceOrSim) {
        introArea.push(
          <div key="recentlyOpenedLabel" className="home-projects">
            Projects
          </div>
        );
      } else {
        introArea.push(
          <h2 key="recentlyOpenedLabelA" className="home-projects">
            Projects
          </h2>
        );
        if (this.props.isPersisted) {
          introArea.push(
            <div key="recentlyNoteA" className="home-projects-note">
              (stored in this device browser's storage.)
            </div>
          );
        } else {
          introArea.push(
            <div key="recentlyNoteA" className="home-projects-note">
              (stored in this device browser's temporary storage.)
            </div>
          );
        }
      }
      recentsArea.push(
        <div
          key="homeProjectsList"
          className="home-projects-list"
          style={{
            height: browserWidth >= 800 ? "calc(100vh - " + (332 + this.props.heightOffset) + "px)" : "",
          }}
        >
          <List
            selectable
            accessibility={selectableListBehavior}
            defaultSelectedIndex={-1}
            onContextMenu={this._handleContextMenu}
            items={projectListItems}
            aria-label="List of edited projects"
          />
        </div>
      );
    }

    let effectArea = <></>;

    if (this.state.effect === HomeEffect.dragOver) {
      effectArea = <div className="home-dragOver">Drop any additional files here.</div>;
    }

    let errorMessageContainer = <></>;

    if (this.props.errorMessage) {
      errorMessageContainer = <div className="home-error">{this.props.errorMessage}</div>;
    }

    let accessoryToolArea = <></>;

    const actionsToolbar = [];
    if (AppServiceProxy.hasAppService) {
      actionsToolbar.push({
        icon: <LocalFolderLabel isCompact={false} />,
        key: "openFolder",
        onClick: this._handleOpenFolderViaAppServiceClick,
        title: "Open folder on this device",
      });

      actionsToolbar.push({
        icon: <ConnectLabel isCompact={false} />,
        key: "connect",
        onClick: this._handleConnectClick,
        title: "Connect",
      });
    } else if (window.showDirectoryPicker !== undefined) {
      actionsToolbar.push({
        icon: <LocalFolderLabel isCompact={false} />,
        key: "openFolderA",
        onClick: this._handleOpenLocalFolderClick,
        title: "Open Folder",
      });
    }

    actionsToolbar.push({
      icon: <ExportBackupLabel isCompact={AppServiceProxy.hasAppService} />,
      key: "export",
      onClick: this._handleExportAll,
      title: "Export",
    });

    accessoryToolArea = (
      <div key="toolsWindow" className="home-tools">
        <div
          className="home-tools-bin"
          key="toolsButtons"
          style={{
            borderTop: "inset 1.5px " + this.props.theme.siteVariables?.colorScheme.brand.background4,
            borderBottom: "inset 1.5px " + this.props.theme.siteVariables?.colorScheme.brand.background4,
          }}
        >
          <div
            className="home-tools-bin-inner"
            key="toolsButtonsA"
            style={{
              borderTop: "outset 1.5px " + this.props.theme.siteVariables?.colorScheme.brand.background4,
              borderBottom: "outset 1.5px " + this.props.theme.siteVariables?.colorScheme.brand.background4,
            }}
          >
            <div className="home-tools-bin-upload">
              <span
                className="home-tools-bin-upload-label"
                style={{
                  color: this.props.theme.siteVariables?.colorScheme.brand.foreground1,
                }}
              >
                From MC/Zip File:
              </span>
              <input
                type="file"
                className="home-uploadFile"
                accept=".mcaddon, .mcpack, .mcworld, .mcproject, .mctemplate, .zip"
                title="Upload a .MCPack, .MCAddon, .MCWorld or .zip file to edit"
                style={{
                  backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
                  color: this.props.theme.siteVariables?.colorScheme.brand.foreground1,
                }}
                onChange={this._handleFileUpload}
              />
            </div>
            <Toolbar aria-label="Home toolbar overflow menu" items={actionsToolbar} />
          </div>
        </div>
      </div>
    );

    return (
      <div
        className="home-layout"
        draggable={true}
        style={{
          height: "calc(100vh - " + this.props.heightOffset + "px)",
        }}
      >
        {effectArea}
        {dialogArea}
        <header
          className="home-header-area"
          style={{
            borderBottomColor: this.props.theme.siteVariables?.colorScheme.brand.background2,
          }}
        >
          <HomeHeader carto={this.props.carto} theme={this.props.theme} />
        </header>
        <main className="home-main">
          <div
            className="home-projects-bin"
            style={{
              backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
              color: this.props.theme.siteVariables?.colorScheme.brand.foreground1,
            }}
          >
            {introArea}
            {accessoryToolArea}
            {recentsArea}
          </div>
          <div
            className="home-gallery"
            aria-label="Gallery section"
            style={{
              backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background2,
              color: this.props.theme.siteVariables?.colorScheme.brand.foreground2,
            }}
          >
            {errorMessageContainer}
            <div
              className="home-gallery-interior"
              style={{
                borderColor: this.props.theme.siteVariables?.colorScheme.brand.background2,
                height: browserWidth >= 800 ? "calc(100vh - " + (168 + this.props.heightOffset) + "px)" : "",
              }}
            >
              {messageArea}
              {mainToolArea}
              {localGallery}
              {gallery}
            </div>
          </div>
        </main>
        <footer className="home-footer">
          <HomeFooter
            onExportAllRequested={this._handleExportAll}
            theme={this.props.theme}
            carto={this.props.carto}
            displayStorageHandling={true}
          />
        </footer>
      </div>
    );
  }
}
