import { Component, SyntheticEvent } from "react";
import IAppProps from "./IAppProps";
import Project, { ProjectErrorState, ProjectRole } from "./../app/Project";
import ProjectItem from "./../app/ProjectItem";
import { ProjectItemType } from "./../app/IProjectItemData";
import ProjectItemList from "./ProjectItemList";
import ProjectItemEditor from "./ProjectItemEditor";
import ProjectExporter from "./../app/ProjectExporter";
import MCWorld from "./../minecraft/MCWorld";
import { AppMode } from "./App";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGithub } from "@fortawesome/free-brands-svg-icons";
import {
  faFileArchive,
  faGlobe,
  faBox,
  faSitemap,
  faSquareCaretLeft,
  faSquareCaretRight,
  faTools,
  faLink,
  faComputer,
} from "@fortawesome/free-solid-svg-icons";
import { Toolbar, Text, MenuItemProps, ThemeInput, Dialog } from "@fluentui/react-northstar";

import {
  ViewLabel,
  SaveLabel,
  SettingsLabel,
  HomeLabel,
  DeployLabel,
  ConnectLabel as MinecraftLabel,
  EditLabel,
  MCPackLabel,
  DownArrowLabel,
  CustomLabel,
  OpenInExplorerLabel,
} from "./Labels";

import "./ProjectEditor.css";
import ZipStorage from "../storage/ZipStorage";
import Utilities from "../core/Utilities";
import { saveAs } from "file-saver";
import StorageUtilities from "../storage/StorageUtilities";
import StatusArea from "./StatusArea";
import ProjectPropertyEditor from "./ProjectPropertyEditor";
import IPersistable from "./IPersistable";
import Log from "./../core/Log";
import GitHubManager from "../github/GitHubManager";
import AppServiceProxy, { AppServiceProxyCommands } from "../core/AppServiceProxy";
import MinecraftToolEditor from "./MinecraftToolEditor";
import CartoSettings from "./CartoSettings";
import { CartoEditorViewMode, MinecraftGameConnectionMode } from "./../app/ICartoData";
import ProjectDisplay from "./ProjectDisplay";
import IGitHubInfo from "../app/IGitHubInfo";
import MinecraftDisplay from "../UXex/MinecraftDisplay";
import WebUtilities from "./WebUtilities";
import ProjectInfoDisplay, { InfoItemCommand } from "./ProjectInfoDisplay";
import ProjectInfoItem from "../info/ProjectInfoItem";
import { MinecraftPushWorldType } from "../app/MinecraftPush";
import CartoApp, { HostType, CartoThemeStyle } from "../app/CartoApp";
import ProjectTools from "../app/ProjectTools";
import { faWindowMaximize } from "@fortawesome/free-regular-svg-icons";
import FileExplorer from "./FileExplorer";
import ShareProject from "./ShareProject";
import LocTokenBox from "./LocTokenBox";
import { IProjectUpdaterReference } from "../info/IProjectInfoGeneratorBase";
import FileSystemStorage from "../storage/FileSystemStorage";
import { StatusTopic } from "../app/Status";

interface IProjectEditorProps extends IAppProps {
  onModeChangeRequested?: (mode: AppMode) => void;
  onActiveProjectItemChangeRequested?: (projectItem: ProjectItem, forceRawView: boolean) => void;
  project: Project;
  readOnly: boolean;
  isHosted?: boolean;
  theme: ThemeInput<any>;
  selectedItem?: string;
  mode?: ProjectEditorMode;
  statusAreaMode?: ProjectStatusAreaMode;
  hideMainToolbar?: boolean;
  viewMode?: CartoEditorViewMode;
}

interface IProjectEditorState {
  activeProjectItem: ProjectItem | null;
  activeReference: IGitHubInfo | null;
  mode: ProjectEditorMode;
  forceRawView: boolean;
  displayFileView: boolean;
  viewMode: CartoEditorViewMode;
  menuState: ProjectEditorMenuState;
  effectMode?: ProjectEditorEffect;
  dialog?: ProjectEditorDialog;
  statusAreaMode: ProjectStatusAreaMode;
  tab: ProjectEditorTab;
  lastDeployKey: string | undefined;
  lastExportKey: string | undefined;
  lastDeployFunction: ((e: SyntheticEvent | undefined, data: MenuItemProps | undefined) => Promise<void>) | undefined;
  lastExportFunction: ((e: SyntheticEvent | undefined, data: MenuItemProps | undefined) => Promise<void>) | undefined;
  lastExportData: MenuItemProps | undefined;
  lastDeployData: MenuItemProps | undefined;
}

export enum ProjectEditorMenuState {
  noMenu = 0,
  viewMenu = 1,
  exportMenu = 2,
  deployMenu = 3,
}

export enum ProjectEditorTab {
  itemList = 0,
  toolBox = 1,
  main = 2,
}

export enum ProjectEditorMode {
  properties,
  inspector,
  minecraftToolSettings,
  activeItem,
  cartoSettings,
  minecraft,
}

export enum ProjectEditorEffect {
  dragOver = 1,
}

export enum ProjectEditorDialog {
  noDialog = 0,
  shareableLink = 1,
}

export enum ProjectStatusAreaMode {
  minimized = 0,
  expanded = 1,
  hidden = 10,
}

export default class ProjectEditor extends Component<IProjectEditorProps, IProjectEditorState> {
  private _authWindow: Window | null = null;
  private _activeEditorPersistable?: IPersistable;

  constructor(props: IProjectEditorProps) {
    super(props);

    this.getProjectTitle = this.getProjectTitle.bind(this);

    this._handleExportMCPackClick = this._handleExportMCPackClick.bind(this);
    this._handleExportToLocalFolderClick = this._handleExportToLocalFolderClick.bind(this);
    this._handleGetShareableLinkClick = this._handleGetShareableLinkClick.bind(this);
    this._handleDownloadMCWorldWithPacks = this._handleDownloadMCWorldWithPacks.bind(this);
    this._handleExportMCWorldWithPackRefs = this._handleExportMCWorldWithPackRefs.bind(this);
    this._handleDownloadFlatWorldWithPacks = this._handleDownloadFlatWorldWithPacks.bind(this);
    this._handleExportFlatWorldWithPackRefs = this._handleExportFlatWorldWithPackRefs.bind(this);
    this._setProjectStatusMode = this._setProjectStatusMode.bind(this);
    this._handleResize = this._handleResize.bind(this);
    this._handleInfoItemCommand = this._handleInfoItemCommand.bind(this);
    this._handleDialogDone = this._handleDialogDone.bind(this);

    this._showMinecraftClick = this._showMinecraftClick.bind(this);
    this._showSettingsClick = this._showSettingsClick.bind(this);
    this._handleHomeClick = this._handleHomeClick.bind(this);
    this._handleVscAddClick = this._handleVscAddClick.bind(this);
    this._handleSaveClick = this._handleSaveClick.bind(this);
    this._viewAsFiles = this._viewAsFiles.bind(this);
    this._viewAsFilesImpl = this._viewAsFilesImpl.bind(this);

    this._viewAsItems = this._viewAsItems.bind(this);
    this._viewAsItemsImpl = this._viewAsItemsImpl.bind(this);

    this._openInExplorerClick = this._openInExplorerClick.bind(this);
    this._handleExportMenuOpen = this._handleExportMenuOpen.bind(this);
    this._handleDeployMenuOpen = this._handleDeployMenuOpen.bind(this);
    this._handleViewMenuOpen = this._handleViewMenuOpen.bind(this);
    this._handleDeployWorldAndTestAssetsPackClick = this._handleDeployWorldAndTestAssetsPackClick.bind(this);
    this._handleDeployWorldAndTestAssetsLocalClick = this._handleDeployWorldAndTestAssetsLocalClick.bind(this);
    this._handleExportFlatWorldWithPacks = this._handleExportFlatWorldWithPacks.bind(this);
    this._handleDeployToRemoteServerClick = this._handleDeployToRemoteServerClick.bind(this);
    this._handleDeployPacksToMinecraftGameClick = this._handleDeployPacksToMinecraftGameClick.bind(this);
    this._handleDeployPacksAndWorldsToMinecraftGameClick =
      this._handleDeployPacksAndWorldsToMinecraftGameClick.bind(this);
    this._handleDeployPacksAndWorldsToMinecraftGameAndOpenClick =
      this._handleDeployPacksAndWorldsToMinecraftGameAndOpenClick.bind(this);
    this._handleExportDeploymentZipClick = this._handleExportDeploymentZipClick.bind(this);
    this._handleExportZipClick = this._handleExportZipClick.bind(this);
    this._handleDeployAsZipClick = this._handleDeployAsZipClick.bind(this);
    this._handleFileDrop = this._handleFileDrop.bind(this);
    this._handleFileDragOut = this._handleFileDragOut.bind(this);
    this._handleFileDragOver = this._handleFileDragOver.bind(this);
    this._handleConvertToBedrockClick = this._handleConvertToBedrockClick.bind(this);
    this._handleGitHubSignInClick = this._handleGitHubSignInClick.bind(this);
    this._handleModeChangeRequested = this._handleModeChangeRequested.bind(this);
    this._handleProjectItemSelected = this._handleProjectItemSelected.bind(this);
    this._handleReferenceSelected = this._handleReferenceSelected.bind(this);
    this._setItemsOnLeft = this._setItemsOnLeft.bind(this);
    this._setItemsOnLeftImpl = this._setItemsOnLeftImpl.bind(this);
    this._setItemsOnRight = this._setItemsOnRight.bind(this);
    this._setItemsOnRightImpl = this._setItemsOnRightImpl.bind(this);
    this._setMainFocus = this._setMainFocus.bind(this);
    this._setMainFocusImpl = this._setMainFocusImpl.bind(this);
    this._setToolboxFocus = this._setToolboxFocus.bind(this);
    this._setToolboxFocusImpl = this._setToolboxFocusImpl.bind(this);
    this._setItemsFocus = this._setItemsFocus.bind(this);
    this._setItemsFocusImpl = this._setItemsFocusImpl.bind(this);
    this._setToolboxLandingFocus = this._setToolboxLandingFocus.bind(this);
    this._setToolboxLandingFocusImpl = this._setToolboxLandingFocusImpl.bind(this);
    this._processInputtedEntry = this._processInputtedEntry.bind(this);
    this._processIncomingFile = this._processIncomingFile.bind(this);
    this._handleExportWorld = this._handleExportWorld.bind(this);

    this._toggleMinecraftToolbox = this._toggleMinecraftToolbox.bind(this);
    this._toggleWorldToolsImpl = this._toggleWorldToolsImpl.bind(this);

    this._handleKeyDown = this._handleKeyDown.bind(this);
    this._handleKeyUp = this._handleKeyUp.bind(this);
    this.launchFlatButton = this.launchFlatButton.bind(this);
    this.launchFlatDownload = this.launchFlatDownload.bind(this);
    this._setActiveEditorPersistable = this._setActiveEditorPersistable.bind(this);
    this._handleDownloadMCWorld = this._handleDownloadMCWorld.bind(this);
    this._handleEditCopyClick = this._handleEditCopyClick.bind(this);
    this._serverStateChanged = this._serverStateChanged.bind(this);

    this.save = this.save.bind(this);

    let initialMode = ProjectEditorMode.properties;
    let initialItem: ProjectItem | null = null;

    let viewMode = this.props.carto.editorViewMode;

    if (this.props.viewMode) {
      viewMode = this.props.viewMode;
    }

    for (let i = 0; i < this.props.project.items.length; i++) {
      const projectItem = this.props.project.items[i];

      if (
        initialItem !== null &&
        projectItem &&
        projectItem.storagePath &&
        projectItem.storagePath.toLowerCase().indexOf("scriptbox") >= 0 &&
        (projectItem.itemType === ProjectItemType.js ||
          projectItem.itemType === ProjectItemType.testJs ||
          projectItem.itemType === ProjectItemType.ts)
      ) {
        initialItem = projectItem;
        initialMode = ProjectEditorMode.activeItem;
      }

      if (initialItem === null) {
        if (this.props.selectedItem && projectItem.storagePath) {
          const canonSelectedItem = StorageUtilities.canonicalizePathAsFileName(this.props.selectedItem);
          const canonCompare = StorageUtilities.canonicalizePathAsFileName(projectItem.storagePath);

          //         Log.debugAlert("Selecting item at " + canonSelectedItem + " |" + viewMode + "|" + canonCompare);

          if (
            projectItem.storagePath === this.props.selectedItem ||
            (projectItem.storagePath && canonCompare === canonSelectedItem)
          ) {
            initialItem = projectItem;
            initialMode = ProjectEditorMode.activeItem;
          }
        }
      }
    }

    let sam = this.props.statusAreaMode;

    if (!sam) {
      sam = ProjectStatusAreaMode.minimized;
    }

    if (this.props.mode) {
      initialMode = this.props.mode;
    }

    this.state = {
      activeProjectItem: initialItem,
      activeReference: null,
      mode: initialMode,
      menuState: ProjectEditorMenuState.noMenu,
      statusAreaMode: sam,
      displayFileView: false,
      viewMode: viewMode,
      forceRawView: false,
      tab: ProjectEditorTab.itemList,
      lastDeployKey: undefined,
      lastExportKey: undefined,
      lastDeployFunction: undefined,
      lastExportFunction: undefined,
      lastDeployData: undefined,
      lastExportData: undefined,
    };

    this._connectToProps();
  }

  _handleKeyDown(event: KeyboardEvent) {
    if (event.ctrlKey && event.key === "s") {
      this._handleSaveClick();

      event.preventDefault();
      return false;
    } else if (event.key === "F5") {
      this._doDeploy();
      event.preventDefault();
      return false;
    } else if (event.key === "F3") {
      this._doExport();
      event.preventDefault();
      return false;
    }

    return true;
  }

  _handleKeyUp(event: KeyboardEvent) {}

  _doDeploy() {
    if (!this.state || !this.state.lastDeployKey || !this.state.lastDeployFunction) {
      this._handleDeployMenuOpen();
    } else {
      this.state.lastDeployFunction(undefined, this.state.lastDeployData);
    }
  }

  _doExport() {
    if (!this.state || !this.state.lastExportKey || !this.state.lastExportFunction) {
      this._handleExportMenuOpen();
    } else {
      this.state.lastExportFunction(undefined, this.state.lastExportData);
    }
  }

  _setActiveEditorPersistable(newPersistable: IPersistable | undefined) {
    this._activeEditorPersistable = newPersistable;
  }

  componentDidUpdate(prevProps: IProjectEditorProps, prevState: IProjectEditorState) {
    if (prevProps !== undefined && prevProps.carto !== undefined) {
      prevProps.carto.onMinecraftStateChanged.unsubscribe(this._serverStateChanged);
    }

    this._connectToProps();
  }

  _connectToProps() {
    if (this.props.carto !== undefined) {
      this.props.carto.onMinecraftStateChanged.subscribe(this._serverStateChanged);
    }
  }

  private _serverStateChanged() {
    this.forceUpdate();
  }

  private _handleFileDragOut(event: any) {
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
      if (this.state.effectMode === ProjectEditorEffect.dragOver) {
        this.setState({
          activeProjectItem: this.state.activeProjectItem,
          activeReference: this.state.activeReference,
          mode: this.state.mode,
          effectMode: undefined,
          viewMode: this.state.viewMode,
          displayFileView: this.state.displayFileView,
          menuState: this.state.menuState,
          forceRawView: this.state.forceRawView,
          statusAreaMode: this.state.statusAreaMode,
          lastDeployKey: this.state.lastDeployKey,
          lastExportKey: this.state.lastExportKey,
          lastDeployFunction: this.state.lastDeployFunction,
          lastExportFunction: this.state.lastExportFunction,
          lastDeployData: this.state.lastDeployData,
          lastExportData: this.state.lastExportData,
        });
      }
    }
  }

  private _handleDialogDone() {
    if (this.state !== undefined) {
      this.setState({
        activeProjectItem: this.state.activeProjectItem,
        activeReference: this.state.activeReference,
        mode: this.state.mode,
        effectMode: undefined,
        dialog: undefined,
        viewMode: this.state.viewMode,
        displayFileView: this.state.displayFileView,
        menuState: this.state.menuState,
        forceRawView: this.state.forceRawView,
        statusAreaMode: this.state.statusAreaMode,
        lastDeployKey: this.state.lastDeployKey,
        lastExportKey: this.state.lastExportKey,
        lastDeployFunction: this.state.lastDeployFunction,
        lastExportFunction: this.state.lastExportFunction,
        lastDeployData: this.state.lastDeployData,
        lastExportData: this.state.lastExportData,
      });
    }
  }

  private _handleFileDragOver(event: any) {
    if (this.state !== undefined) {
      if (this.state.effectMode !== ProjectEditorEffect.dragOver) {
        const top = event.pageY;
        const left = event.pageX;
        const right = document.body.clientWidth - left;
        const bottom = document.body.clientHeight - top;

        if (top > 10 && right > 10 && bottom > 10 && left > 10) {
          this.setState({
            activeProjectItem: this.state.activeProjectItem,
            activeReference: this.state.activeReference,
            menuState: this.state.menuState,
            mode: this.state.mode,
            viewMode: this.state.viewMode,
            displayFileView: this.state.displayFileView,
            forceRawView: this.state.forceRawView,
            effectMode: ProjectEditorEffect.dragOver,
            statusAreaMode: this.state.statusAreaMode,
            lastDeployKey: this.state.lastDeployKey,
            lastExportKey: this.state.lastExportKey,
            lastDeployFunction: this.state.lastDeployFunction,
            lastExportFunction: this.state.lastExportFunction,
            lastDeployData: this.state.lastDeployData,
            lastExportData: this.state.lastExportData,
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

      window.addEventListener("resize", this._handleResize);
      window.addEventListener("keydown", this._handleKeyDown);
      window.addEventListener("keyup", this._handleKeyUp);
    }
  }

  componentWillUnmount() {
    if (typeof window !== "undefined") {
      window.document.removeEventListener("dragleave", this._handleFileDragOut);
      window.document.body.removeEventListener("dragover", this._handleFileDragOver);
      window.document.body.removeEventListener("drop", this._handleFileDrop);

      window.removeEventListener("resize", this._handleResize);
      window.removeEventListener("keydown", this._handleKeyDown);
      window.removeEventListener("keyup", this._handleKeyUp);
    }
  }

  private async _handleFileDrop(ev: DragEvent): Promise<any> {
    // Prevent default behavior (Prevent file from being opened)
    ev.preventDefault();
    ev.stopPropagation();

    if (ev == null || ev.dataTransfer == null) {
      return;
    }

    if (ev.dataTransfer.items) {
      // Use DataTransferItemList interface to access the file(s)
      for (var i = 0; i < ev.dataTransfer.items.length; i++) {
        const dtitem = ev.dataTransfer.items[i];

        let entry: any | undefined = undefined;

        if (dtitem.webkitGetAsEntry) {
          entry = dtitem.webkitGetAsEntry();
        }

        if (entry && entry.isDirectory) {
          const directoryReader = (entry as any).createReader();
          const me = this;

          directoryReader.readEntries(function (entries: any) {
            entries.forEach((childEntry: any) => {
              me._processInputtedEntry((entry as any).fullPath, childEntry);
            });
          });
        } else if (dtitem.kind === "file") {
          const file = dtitem.getAsFile();
          if (file) {
            this._processIncomingFile("/", file);
          }
        }
      }
    } else {
      // Use DataTransfer interface to access the file(s)
      for (var j = 0; j < ev.dataTransfer.files.length; j++) {
        console.log("... file[" + j + "].name = " + ev.dataTransfer.files[j].name);
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

  private async _processIncomingFile(path: string, file: File) {
    if (file != null && this.props.project != null && this.props.project.projectFolder != null) {
      await this.props.project.addBrowserFile(path, file);
    }
  }

  private _handleHomeClick() {
    if (this.props.onModeChangeRequested != null) {
      this.props.onModeChangeRequested(AppMode.home);
    }
  }

  private _handleVscAddClick() {
    AppServiceProxy.sendAsync(
      "executeCommand",
      JSON.stringify({
        command: "mctools.newProject",
        arguments: [],
      })
    );
  }
  private async _openInExplorerClick() {
    if (AppServiceProxy.hasAppService && this.props.project.projectFolder) {
      await AppServiceProxy.sendAsync(
        AppServiceProxyCommands.shellOpenFolderInExplorer,
        this.props.project.projectFolder.fullPath
      );
    }
  }

  private async _handleSaveClick() {
    this.save();
  }

  private _setItemsOnLeft() {
    // the menu change to hide the dropdown will fire at the same time, and its state changes will overwrite this one.
    // so wait a beat and update state then.
    window.setTimeout(this._setItemsOnLeftImpl, 2);
  }

  private _setItemsOnLeftImpl() {
    if (this.state === null) {
      return;
    }

    const curViewMode = this.state.viewMode;

    let newViewMode = CartoEditorViewMode.itemsOnLeft;

    if (
      curViewMode === CartoEditorViewMode.itemsOnRightAndMinecraftToolbox ||
      curViewMode === CartoEditorViewMode.itemsOnLeftAndMinecraftToolbox
    ) {
      newViewMode = CartoEditorViewMode.itemsOnLeftAndMinecraftToolbox;
    }

    this.props.carto.editorViewMode = newViewMode;
    this.props.carto.save();

    this.setState({
      activeProjectItem: this.state.activeProjectItem,
      mode: this.state.mode,
      viewMode: newViewMode,
      menuState: ProjectEditorMenuState.noMenu,
      statusAreaMode: this.state.statusAreaMode,
      lastDeployKey: this.state.lastDeployKey,
      displayFileView: this.state.displayFileView,
      dialog: this.state.dialog,
      forceRawView: this.state.forceRawView,
      lastExportKey: this.state.lastExportKey,
      lastDeployFunction: this.state.lastDeployFunction,
      lastExportFunction: this.state.lastExportFunction,
      lastDeployData: this.state.lastDeployData,
      lastExportData: this.state.lastExportData,
    });
  }

  private _setNewDeployKey(
    deployKey: string,
    deployFunction: ((e: SyntheticEvent | undefined, data: MenuItemProps | undefined) => Promise<void>) | undefined,
    deployData: MenuItemProps | undefined
  ) {
    this.setState({
      activeProjectItem: this.state.activeProjectItem,
      mode: this.state.mode,
      viewMode: this.state.viewMode,
      menuState: this.state.menuState,
      statusAreaMode: this.state.statusAreaMode,
      lastDeployKey: deployKey,
      dialog: this.state.dialog,
      forceRawView: this.state.forceRawView,
      displayFileView: this.state.displayFileView,
      lastExportKey: this.state.lastExportKey,
      lastDeployFunction: deployFunction,
      lastExportFunction: this.state.lastExportFunction,
      lastDeployData: deployData,
      lastExportData: this.state.lastExportData,
    });
  }

  private _setNewExportKey(
    exportKey: string,
    exportFunction: ((e: SyntheticEvent | undefined, data: MenuItemProps | undefined) => Promise<void>) | undefined,
    exportData: MenuItemProps | undefined
  ) {
    this.setState({
      activeProjectItem: this.state.activeProjectItem,
      mode: this.state.mode,
      viewMode: this.state.viewMode,
      menuState: this.state.menuState,
      statusAreaMode: this.state.statusAreaMode,
      lastDeployKey: this.state.lastDeployKey,
      forceRawView: this.state.forceRawView,
      dialog: this.state.dialog,
      displayFileView: this.state.displayFileView,
      lastExportKey: exportKey,
      lastDeployFunction: this.state.lastDeployFunction,
      lastExportFunction: exportFunction,
      lastDeployData: this.state.lastDeployData,
      lastExportData: exportData,
    });
  }

  private _setItemsOnRight() {
    window.setTimeout(this._setItemsOnRightImpl, 2);
  }

  private async _setItemsOnRightImpl() {
    if (this.state === null) {
      return;
    }

    const curViewMode = this.state.viewMode;

    let newViewMode = CartoEditorViewMode.itemsOnRight;

    if (
      curViewMode === CartoEditorViewMode.itemsOnRightAndMinecraftToolbox ||
      curViewMode === CartoEditorViewMode.itemsOnLeftAndMinecraftToolbox
    ) {
      newViewMode = CartoEditorViewMode.itemsOnRightAndMinecraftToolbox;
    }

    this.props.carto.editorViewMode = newViewMode;
    this.props.carto.save();

    this.setState({
      activeProjectItem: this.state.activeProjectItem,
      mode: this.state.mode,
      viewMode: newViewMode,
      menuState: ProjectEditorMenuState.noMenu,
      statusAreaMode: this.state.statusAreaMode,
      lastDeployKey: this.state.lastDeployKey,
      displayFileView: this.state.displayFileView,
      dialog: this.state.dialog,
      forceRawView: this.state.forceRawView,
      lastExportKey: this.state.lastExportKey,
      lastDeployFunction: this.state.lastDeployFunction,
      lastExportFunction: this.state.lastExportFunction,
      lastDeployData: this.state.lastDeployData,
      lastExportData: this.state.lastExportData,
    });
  }

  private _viewAsItems() {
    window.setTimeout(this._viewAsItemsImpl, 2);
  }

  private _viewAsItemsImpl() {
    this.setState({
      activeProjectItem: this.state.activeProjectItem,
      mode: this.state.mode,
      viewMode: this.state.viewMode,
      menuState: ProjectEditorMenuState.noMenu,
      statusAreaMode: this.state.statusAreaMode,
      lastDeployKey: this.state.lastDeployKey,
      displayFileView: false,
      forceRawView: this.state.forceRawView,
      dialog: this.state.dialog,
      lastExportKey: this.state.lastExportKey,
      lastDeployFunction: this.state.lastDeployFunction,
      lastExportFunction: this.state.lastExportFunction,
      lastDeployData: this.state.lastDeployData,
      lastExportData: this.state.lastExportData,
    });
  }

  private _viewAsFiles() {
    window.setTimeout(this._viewAsFilesImpl, 2);
  }

  private _viewAsFilesImpl() {
    this.setState({
      activeProjectItem: this.state.activeProjectItem,
      mode: this.state.mode,
      viewMode: this.state.viewMode,
      menuState: ProjectEditorMenuState.noMenu,
      statusAreaMode: this.state.statusAreaMode,
      lastDeployKey: this.state.lastDeployKey,
      displayFileView: true,
      forceRawView: this.state.forceRawView,
      dialog: this.state.dialog,
      lastExportKey: this.state.lastExportKey,
      lastDeployFunction: this.state.lastDeployFunction,
      lastExportFunction: this.state.lastExportFunction,
      lastDeployData: this.state.lastDeployData,
      lastExportData: this.state.lastExportData,
    });
  }

  private _setMainFocus() {
    window.setTimeout(this._setMainFocusImpl, 2);
  }

  private async _setMainFocusImpl() {
    if (this.state === null) {
      return;
    }

    this.applyViewMode(CartoEditorViewMode.mainFocus);
  }

  private _setToolboxFocus() {
    window.setTimeout(this._setToolboxFocusImpl, 2);
  }

  private async _setToolboxFocusImpl() {
    if (this.state === null) {
      return;
    }

    this.applyViewMode(CartoEditorViewMode.toolboxFocus);
  }

  private _setItemsFocus() {
    window.setTimeout(this._setItemsFocusImpl, 2);
  }

  private async _setItemsFocusImpl() {
    if (this.state === null) {
      return;
    }

    this.applyViewMode(CartoEditorViewMode.itemsFocus);
  }

  private _setToolboxLandingFocus() {
    window.setTimeout(this._setToolboxLandingFocusImpl, 2);
  }

  private async _setToolboxLandingFocusImpl() {
    if (this.state === null) {
      return;
    }

    this.applyViewMode(CartoEditorViewMode.codeLanding);
  }

  private applyViewMode(newViewMode: CartoEditorViewMode) {
    this.props.carto.editorViewMode = newViewMode;
    this.props.carto.save();

    this.setState({
      activeProjectItem: this.state.activeProjectItem,
      mode: this.state.mode,
      viewMode: newViewMode,
      menuState: ProjectEditorMenuState.noMenu,
      statusAreaMode: this.state.statusAreaMode,
      forceRawView: this.state.forceRawView,
      displayFileView: this.state.displayFileView,
      lastDeployKey: this.state.lastDeployKey,
      dialog: this.state.dialog,
      lastExportKey: this.state.lastExportKey,
      lastDeployFunction: this.state.lastDeployFunction,
      lastExportFunction: this.state.lastExportFunction,
      lastDeployData: this.state.lastDeployData,
      lastExportData: this.state.lastExportData,
    });
  }

  private _toggleMinecraftToolbox() {
    window.setTimeout(this._toggleWorldToolsImpl, 2);
  }

  private async _toggleWorldToolsImpl() {
    if (this.state === null) {
      return;
    }

    const curViewMode = this.state.viewMode;
    let newViewMode = CartoEditorViewMode.itemsOnRight;

    if (curViewMode === CartoEditorViewMode.itemsOnLeftAndMinecraftToolbox) {
      newViewMode = CartoEditorViewMode.itemsOnLeft;
    } else if (curViewMode === CartoEditorViewMode.itemsOnLeft) {
      newViewMode = CartoEditorViewMode.itemsOnLeftAndMinecraftToolbox;
    } else if (curViewMode === CartoEditorViewMode.itemsOnRightAndMinecraftToolbox) {
      newViewMode = CartoEditorViewMode.itemsOnRight;
    } else if (curViewMode === CartoEditorViewMode.itemsOnRight) {
      newViewMode = CartoEditorViewMode.itemsOnRightAndMinecraftToolbox;
    }

    this.props.carto.editorViewMode = newViewMode;
    this.props.carto.save();

    this.setState({
      activeProjectItem: this.state.activeProjectItem,
      mode: this.state.mode,
      viewMode: newViewMode,
      menuState: ProjectEditorMenuState.noMenu,
      statusAreaMode: this.state.statusAreaMode,
      displayFileView: this.state.displayFileView,
      forceRawView: this.state.forceRawView,
      lastDeployKey: this.state.lastDeployKey,
      dialog: this.state.dialog,
      lastExportKey: this.state.lastExportKey,
      lastDeployFunction: this.state.lastDeployFunction,
      lastExportFunction: this.state.lastExportFunction,
      lastDeployData: this.state.lastDeployData,
      lastExportData: this.state.lastExportData,
    });
  }

  async save() {
    if (this.props.project == null) {
      return;
    }

    await this._ensurePersisted();

    await this.props.carto.save();

    const projName = await this.props.project.loc.getTokenValue(this.props.project.name);

    const operId = await this.props.carto.notifyOperationStarted("Saving project '" + projName + "'...");

    await this.props.project.save();

    await this.props.carto.notifyOperationEnded(operId, "Saved '" + projName + "'.");

    await this.ensurePersistentBrowserStorage();
  }

  private async ensurePersistentBrowserStorage() {
    if (!AppServiceProxy.hasAppService && !this.props.carto.hasAttemptedPersistentBrowserStorageSwitch) {
      const isPersisted = WebUtilities.getIsPersisted();

      if (!isPersisted) {
        const couldPersist = await WebUtilities.requestPersistence();
        this.props.carto.hasAttemptedPersistentBrowserStorageSwitch = true;

        if (!couldPersist) {
          this.props.carto.notifyStatusUpdate(
            "Could not shift to persistent browser storage; project storage is still temporary. Download backups frequently.",
            StatusTopic.general
          );
        }
      }
    }
  }

  private async _showMinecraftClick() {
    /*if (this.props.carto.minecraft === undefined) {
      Log.unexpectedUndefined("PESMC");
      return;
    }*/

    //this.props.carto.minecraft.connect();

    let nextViewMode = this.state.viewMode;

    if (nextViewMode === CartoEditorViewMode.itemsFocus) {
      nextViewMode = CartoEditorViewMode.mainFocus;
    }

    this.setState({
      activeProjectItem: this.state.activeProjectItem,
      mode: ProjectEditorMode.minecraft,
      viewMode: nextViewMode,
      menuState: ProjectEditorMenuState.noMenu,
      statusAreaMode: this.state.statusAreaMode,
      lastDeployKey: this.state.lastDeployKey,
      displayFileView: this.state.displayFileView,
      lastExportKey: this.state.lastExportKey,
      dialog: this.state.dialog,
      forceRawView: this.state.forceRawView,
      lastDeployFunction: this.state.lastDeployFunction,
      lastExportFunction: this.state.lastExportFunction,
      lastDeployData: this.state.lastDeployData,
      lastExportData: this.state.lastExportData,
    });
  }

  private async _showSettingsClick() {
    let newViewMode = this.state.viewMode;

    if (newViewMode === CartoEditorViewMode.toolboxFocus) {
      if (this.props.isHosted) {
        newViewMode = CartoEditorViewMode.mainFocus;
      } else {
        newViewMode = this.props.carto.editorViewMode;
      }
    } else if (newViewMode === CartoEditorViewMode.itemsFocus) {
      newViewMode = CartoEditorViewMode.mainFocus;
    }

    this.setState({
      activeProjectItem: this.state.activeProjectItem,
      mode: ProjectEditorMode.cartoSettings,
      viewMode: newViewMode,
      menuState: ProjectEditorMenuState.noMenu,
      statusAreaMode: this.state.statusAreaMode,
      displayFileView: this.state.displayFileView,
      lastDeployKey: this.state.lastDeployKey,
      forceRawView: this.state.forceRawView,
      dialog: this.state.dialog,
      lastExportKey: this.state.lastExportKey,
      lastDeployFunction: this.state.lastDeployFunction,
      lastExportFunction: this.state.lastExportFunction,
      lastDeployData: this.state.lastDeployData,
      lastExportData: this.state.lastExportData,
    });
  }

  private _handleExportMenuOpen() {
    let menuVal = ProjectEditorMenuState.noMenu;

    if (this.state.menuState === ProjectEditorMenuState.noMenu) {
      menuVal = ProjectEditorMenuState.exportMenu;
    }

    this.setState({
      activeProjectItem: this.state.activeProjectItem,
      mode: this.state.mode,
      viewMode: this.state.viewMode,
      menuState: menuVal,
      forceRawView: this.state.forceRawView,
      displayFileView: this.state.displayFileView,
      statusAreaMode: this.state.statusAreaMode,
      lastDeployKey: this.state.lastDeployKey,
      dialog: this.state.dialog,
      lastExportKey: this.state.lastExportKey,
      lastDeployFunction: this.state.lastDeployFunction,
      lastExportFunction: this.state.lastExportFunction,
      lastDeployData: this.state.lastDeployData,
      lastExportData: this.state.lastExportData,
    });
  }

  private _handleDeployMenuOpen() {
    let menuVal = ProjectEditorMenuState.noMenu;

    if (this.state.menuState === ProjectEditorMenuState.noMenu) {
      menuVal = ProjectEditorMenuState.deployMenu;
    }

    this.setState({
      activeProjectItem: this.state.activeProjectItem,
      mode: this.state.mode,
      viewMode: this.state.viewMode,
      menuState: menuVal,
      forceRawView: this.state.forceRawView,
      displayFileView: this.state.displayFileView,
      statusAreaMode: this.state.statusAreaMode,
      lastDeployKey: this.state.lastDeployKey,
      dialog: this.state.dialog,
      lastExportKey: this.state.lastExportKey,
      lastDeployFunction: this.state.lastDeployFunction,
      lastExportFunction: this.state.lastExportFunction,
      lastDeployData: this.state.lastDeployData,
      lastExportData: this.state.lastExportData,
    });
  }

  private _handleViewMenuOpen() {
    let menuVal = ProjectEditorMenuState.noMenu;

    if (this.state.menuState === ProjectEditorMenuState.noMenu) {
      menuVal = ProjectEditorMenuState.viewMenu;
    }

    this.setState({
      activeProjectItem: this.state.activeProjectItem,
      mode: this.state.mode,
      viewMode: this.state.viewMode,
      menuState: menuVal,
      forceRawView: this.state.forceRawView,
      displayFileView: this.state.displayFileView,
      statusAreaMode: this.state.statusAreaMode,
      lastDeployKey: this.state.lastDeployKey,
      dialog: this.state.dialog,
      lastExportKey: this.state.lastExportKey,
      lastDeployFunction: this.state.lastDeployFunction,
      lastExportFunction: this.state.lastExportFunction,
      lastDeployData: this.state.lastDeployData,
      lastExportData: this.state.lastExportData,
    });
  }

  private async _handleGetShareableLinkClick(e: SyntheticEvent | undefined, data: MenuItemProps | undefined) {
    if (this.props.project == null || !data || !data.icon) {
      return;
    }

    window.setTimeout(() => {
      this.setState({
        activeProjectItem: this.state.activeProjectItem,
        activeReference: this.state.activeReference,
        menuState: this.state.menuState,
        mode: this.state.mode,
        viewMode: this.state.viewMode,
        displayFileView: this.state.displayFileView,
        forceRawView: this.state.forceRawView,
        effectMode: this.state.effectMode,
        dialog: ProjectEditorDialog.shareableLink,
        statusAreaMode: this.state.statusAreaMode,
        lastDeployKey: this.state.lastDeployKey,
        lastExportKey: (data.icon as any).key,
        lastDeployFunction: this.state.lastDeployFunction,
        lastExportFunction: this._handleGetShareableLinkClick,
        lastDeployData: this.state.lastDeployData,
        lastExportData: data,
      });
    }, 2);
  }

  private async _handleExportMCPackClick(e: SyntheticEvent | undefined, data: MenuItemProps | undefined) {
    if (this.props.project == null) {
      return;
    }

    await this._ensurePersisted();

    const projName = await this.props.project.loc.getTokenValue(this.props.project.name);

    const operId = await this.props.carto.notifyOperationStarted("Exporting '" + projName + "' as MCPack");

    const zipBinary = (await ProjectExporter.exportPackAsZip(this.props.carto, this.props.project, true)) as Blob;

    await this.props.carto.notifyOperationEnded(operId, "Export MCPack of '" + projName + "' created; downloading");

    saveAs(zipBinary, projName + ".mcpack");

    if (data && data.icon && (data.icon as any).key) {
      this._setNewExportKey((data.icon as any).key, this._handleExportMCPackClick, data);
    }
  }

  private async _handleExportToLocalFolderClick(e: SyntheticEvent | undefined, data: MenuItemProps | undefined) {
    if (this.props.project === null || this.props.project.projectFolder === null) {
      return;
    }

    await this._ensurePersisted();

    const result = (await window.showDirectoryPicker({
      mode: "readwrite",
    })) as FileSystemDirectoryHandle | undefined;

    if (result) {
      const storage = new FileSystemStorage(result);

      const operId = await this.props.carto.notifyOperationStarted("Exporting project to  '" + result.name + "'");

      await StorageUtilities.syncFolderTo(
        this.props.project.projectFolder,
        storage.rootFolder,
        true,
        true,
        false,
        [],
        async (message: string) => {
          await this.props.carto.notifyStatusUpdate(message);
        }
      );

      await storage.rootFolder.saveAll();

      await this.props.carto.notifyOperationEnded(operId, "Export completed.");
    }

    if (data && data.icon && (data.icon as any).key) {
      this._setNewExportKey((data.icon as any).key, this._handleExportToLocalFolderClick, data);
    }
  }

  private async _handleExportZipClick(e: SyntheticEvent | undefined, data: MenuItemProps | undefined) {
    if (this.props.project == null) {
      return;
    }

    await this._ensurePersisted();

    const projName = await this.props.project.loc.getTokenValue(this.props.project.name);

    const operId = await this.props.carto.notifyOperationStarted("Exporting '" + projName + "' as zip.");

    const zipStorage = new ZipStorage();

    const projectFolder = await this.props.project.ensureLoadedProjectFolder();

    await StorageUtilities.syncFolderTo(projectFolder, zipStorage.rootFolder, true, true, false);

    await zipStorage.rootFolder.saveAll();

    const zipBinary = await zipStorage.generateBlobAsync();

    await this.props.carto.notifyOperationEnded(operId, "Export zip of '" + projName + "' created; downloading.");

    saveAs(zipBinary, projName + ".zip");

    if (data && data.icon && (data.icon as any).key) {
      this._setNewExportKey((data.icon as any).key, this._handleExportZipClick, data);
    }
  }

  private async _handleGitHubSignInClick() {
    GitHubManager.signIn();
  }

  private async _handleConvertToBedrockClick() {
    if (this.props.carto.deploymentStorage === null || this.props.project === null) {
      return;
    }
    await this._ensurePersisted();

    this.props.project.convertToBedrock();
  }

  private async _handleInfoItemCommand(command: InfoItemCommand, item: ProjectInfoItem | IProjectUpdaterReference) {
    if (command === InfoItemCommand.itemSelect && item instanceof ProjectInfoItem && item.projectItem) {
      this._handleProjectItemSelected(item.projectItem, false);
    } else if (
      command === InfoItemCommand.runUpdater &&
      (item as IProjectUpdaterReference).updaterId &&
      (item as IProjectUpdaterReference).updaterIndex !== undefined
    ) {
      await this.props.project.applyUpdate(
        (item as IProjectUpdaterReference).updaterId,
        (item as IProjectUpdaterReference).updaterIndex
      );
    }
  }

  private async _handleDeployToRemoteServerClick(e: SyntheticEvent | undefined, data: MenuItemProps | undefined) {
    if (this.props.carto.deploymentStorage == null) {
      return;
    }

    this.props.carto.notifyStatusUpdate("Deploying to '" + this.props.carto.remoteServerUrl + "'");

    await this._ensurePersisted();
    await this.props.project.save();

    await this.props.carto.ensureRemoteMinecraft();

    this.props.carto.remoteMinecraft?.prepareAndStart({
      project: this.props.project,
    });

    if (data && data.icon && (data.icon as any).key) {
      this._setNewDeployKey((data.icon as any).key, this._handleDeployToRemoteServerClick, data);
    }
  }

  private async _handleDeployPacksToMinecraftGameClick(e: SyntheticEvent | undefined, data: MenuItemProps | undefined) {
    if (this.props.carto.deploymentStorage == null) {
      return;
    }

    await this._deployToGame(MinecraftPushWorldType.none);

    if (data && data.icon && (data.icon as any).key) {
      this._setNewDeployKey((data.icon as any).key, this._handleDeployPacksToMinecraftGameClick, data);
    }
  }

  private async _handleDeployPacksAndWorldsToMinecraftGameClick(
    e: SyntheticEvent | undefined,
    data: MenuItemProps | undefined
  ) {
    if (this.props.carto.deploymentStorage == null) {
      return;
    }

    await this._deployToGame(MinecraftPushWorldType.inferFromProject);

    if (data && data.icon && (data.icon as any).key) {
      this._setNewDeployKey((data.icon as any).key, this._handleDeployPacksToMinecraftGameClick, data);
    }
  }

  private async _handleDeployPacksAndWorldsToMinecraftGameAndOpenClick(
    e: SyntheticEvent | undefined,
    data: MenuItemProps | undefined
  ) {
    if (this.props.carto.deploymentStorage == null) {
      return;
    }

    const result = await this._deployToGame(MinecraftPushWorldType.inferFromProject);

    if (result?.worldName) {
      AppServiceProxy.sendAsync(AppServiceProxyCommands.minecraftShell, "mode/?load=" + result.worldName);
    }

    if (data && data.icon && (data.icon as any).key) {
      this._setNewDeployKey((data.icon as any).key, this._handleDeployPacksToMinecraftGameClick, data);
    }
  }

  private async _deployToGame(worldType: MinecraftPushWorldType) {
    if (this.props.carto.deploymentStorage == null) {
      return;
    }

    let productPhrase = "Minecraft";

    if (this.props.carto.minecraftGameMode === MinecraftGameConnectionMode.localMinecraftPreview) {
      productPhrase = "Minecraft Preview";
    }

    const operId = await this.props.carto.notifyOperationStarted("Deploying to " + productPhrase);

    await this.props.carto.ensureGameMinecraft();

    if (!this.props.carto.gameMinecraft) {
      Log.assertDefined(this.props.carto.gameMinecraft);
      return;
    }

    await this._ensurePersisted();
    await this.props.project.save();

    const result = await this.props.carto.gameMinecraft.prepareAndStart({
      project: this.props.project,
      worldType: worldType,
    });

    await this.props.carto.notifyOperationEnded(operId, "Deploying to " + productPhrase);

    return result;
  }

  private async _handleExportDeploymentZipClick(e: SyntheticEvent | undefined, data: MenuItemProps | undefined) {
    if (this.props.carto.deploymentStorage == null) {
      return;
    }

    this.props.carto.notifyStatusUpdate("Creating deployment folder zip package");

    await this._ensurePersisted();
    await this.props.project.save();

    const zipStorage = new ZipStorage();

    await StorageUtilities.syncFolderTo(
      this.props.carto.deploymentStorage.rootFolder,
      zipStorage.rootFolder,
      true,
      true,
      false
    );

    await zipStorage.rootFolder.saveAll();

    this.props.carto.notifyStatusUpdate("Files created in zip. Packaging");

    const zipBinary = await zipStorage.generateBlobAsync();

    const now = new Date();

    this.props.carto.notifyStatusUpdate("Packaging complete, saving");

    const fileName = "deploy" + Utilities.getDateSummary(now) + ".zip";
    saveAs(zipBinary, fileName);

    this.props.carto.notifyStatusUpdate("Downloading " + fileName + ".");

    if (data && data.icon && (data.icon as any).key) {
      this._setNewExportKey((data.icon as any).key, this._handleExportDeploymentZipClick, data);
    }
  }

  private async _handleDeployAsZipClick(e: SyntheticEvent | undefined, data: MenuItemProps | undefined) {
    if (this.props.carto.deploymentStorage == null) {
      return;
    }

    const projName = await this.props.project.loc.getTokenValue(this.props.project.name);

    const operId = await this.props.carto.notifyOperationStarted(
      "Export deployment zip of '" + projName + "' created; downloading"
    );

    await this._ensurePersisted();

    this.props.carto.save();

    await this.props.project.save();

    if (this.props.carto.deployBehaviorPacksFolder) {
      await ProjectTools.deployProject(
        this.props.carto,
        this.props.project,
        this.props.carto.deploymentStorage,
        this.props.carto.deployBehaviorPacksFolder
      );
    }

    //    await ProjectExporter.deployAsWorldAndTestAssets(this.props.carto, this.props.project, );

    let zipStorage: ZipStorage | undefined = undefined;

    zipStorage = new ZipStorage();

    const deployFolder = await this.props.carto.deploymentStorage.rootFolder;

    await StorageUtilities.syncFolderTo(deployFolder, zipStorage.rootFolder, true, true, false, [
      "/mcworlds",
      "/minecraftWorlds",
    ]);

    await zipStorage.rootFolder.saveAll();

    const zipBinary = await zipStorage.generateBlobAsync();

    await this.props.carto.notifyOperationEnded(
      operId,
      "Export deployment zip of '" + projName + "' created; downloading"
    );

    saveAs(zipBinary, projName + ".zip");

    if (data && data.icon && (data.icon as any).key) {
      this._setNewDeployKey((data.icon as any).key, this._handleDeployAsZipClick, data);
    }
  }

  private async _handleDeployWorldAndTestAssetsLocalClick(
    e: SyntheticEvent | undefined,
    data: MenuItemProps | undefined
  ) {
    if (data === undefined || typeof data.content !== "string") {
      return;
    }

    const projectItem = this._getProjectItemFromName(data.content, "and test assets to Minecraft", [
      ProjectItemType.MCWorld,
      ProjectItemType.MCProject,
      ProjectItemType.MCTemplate,
      ProjectItemType.worldFolder,
    ]);

    if (!projectItem) {
      Log.debugAlert("Could not find respective project item.");
      return;
    }

    if (this.props.carto.deploymentStorage == null) {
      return;
    }

    await this._ensurePersisted();

    this.props.carto.notifyStatusUpdate("Saving...");
    await this.props.project.save();
    this.props.carto.notifyStatusUpdate("Saved");

    await ProjectExporter.generateAndInvokeFlatPackRefMCWorld(this.props.carto, this.props.project);

    Log.message("Done saving " + projectItem.name, this.props.project.name);

    if (data && data.icon && (data.icon as any).key) {
      this._setNewDeployKey((data.icon as any).key, this._handleDeployWorldAndTestAssetsLocalClick, data);
    }
  }

  private async _handleDeployWorldAndTestAssetsPackClick(
    e: SyntheticEvent | undefined,
    data: MenuItemProps | undefined
  ) {
    if (data === undefined || typeof data.content !== "string") {
      return;
    }

    const projectItem = this._getProjectItemFromName(data.content, "and test assets mcworld", [
      ProjectItemType.MCProject,
      ProjectItemType.MCWorld,
      ProjectItemType.MCTemplate,
      ProjectItemType.worldFolder,
    ]);

    if (!projectItem) {
      Log.debugAlert("Could not find respective project item.");
      return;
    }

    if (this.props.carto.deploymentStorage == null) {
      return;
    }

    await this._ensurePersisted();

    this.props.carto.notifyStatusUpdate("Saving...");
    await this.props.project.save();
    this.props.carto.notifyStatusUpdate("Saved");

    const zipBytes = await ProjectExporter.deployAsWorldAndTestAssets(
      this.props.carto,
      this.props.project,
      projectItem,
      true
    );

    const date = new Date();
    const downloadTitle = projectItem.name + " deployment - " + Utilities.getFriendlySummarySeconds(date);

    if (zipBytes instanceof Uint8Array) {
      saveAs(new Blob([zipBytes], { type: "application/octet-stream" }), downloadTitle + ".mcworld");
    }

    Log.message("Done saving " + projectItem.name, this.props.project.name);

    this.props.carto.notifyStatusUpdate("Downloading deployment zip '" + downloadTitle + ".mcworld'.");

    //  this._setNewDeployKey(data.className);

    if (data && data.icon && (data.icon as any).key) {
      this._setNewDeployKey((data.icon as any).key, this._handleDeployWorldAndTestAssetsPackClick, data);
    }
  }

  private async _handleExportWorld(e: SyntheticEvent | undefined, data: MenuItemProps | undefined) {
    if (data === undefined || typeof data.content !== "string") {
      return;
    }

    const projectItem = this._getProjectItemFromName(data.content, "world", [
      ProjectItemType.MCWorld,
      ProjectItemType.MCTemplate,
      ProjectItemType.worldFolder,
    ]);

    if (!projectItem || !projectItem.file) {
      Log.debugAlert("Could not find respective project item.");
      return;
    }

    await this._ensurePersisted();

    this.props.carto.notifyStatusUpdate("Saving...");
    await this.props.project.save();
    this.props.carto.notifyStatusUpdate("Saved");

    const date = new Date();
    let downloadTitle = projectItem.name + " - " + Utilities.getFriendlySummarySeconds(date);

    const zipBytes = projectItem.file.content;

    if (projectItem.itemType === ProjectItemType.MCWorld) {
      downloadTitle += ".mcworld";
    } else {
      downloadTitle += ".mctemplate";
    }

    if (zipBytes instanceof Uint8Array) {
      saveAs(new Blob([zipBytes], { type: "application/octet-stream" }), downloadTitle);
    }

    Log.message("Done saving " + projectItem.name, this.props.project.name);

    this.props.carto.notifyStatusUpdate("Downloading " + downloadTitle + ".");

    if (data && data.icon && (data.icon as any).key) {
      this._setNewExportKey((data.icon as any).key, this._handleExportWorld, data);
    }
  }

  private async _handleModeChangeRequested(newMode: ProjectEditorMode) {
    await this._ensurePersisted();

    this._activeEditorPersistable = undefined;
    this.setState({
      activeProjectItem: this.state.activeProjectItem,
      menuState: this.state.menuState,
      viewMode: this.state.viewMode,
      mode: newMode,
      forceRawView: this.state.forceRawView,
      displayFileView: this.state.displayFileView,
      statusAreaMode: this.state.statusAreaMode,
      lastDeployKey: this.state.lastDeployKey,
      lastExportKey: this.state.lastExportKey,
      lastDeployFunction: this.state.lastDeployFunction,
      lastExportFunction: this.state.lastExportFunction,
      lastDeployData: this.state.lastDeployData,
      lastExportData: this.state.lastExportData,
    });
  }

  private async _ensurePersisted() {
    if (this._activeEditorPersistable !== undefined) {
      await this._activeEditorPersistable.persist();
    }
  }

  private async _handleDownloadMCWorld(e: SyntheticEvent | undefined, data: MenuItemProps | undefined) {
    if (data === undefined || typeof data.content !== "string") {
      return;
    }

    await this._ensurePersisted();

    const projectItem = this._getProjectItemFromName(data.content, "World", [
      ProjectItemType.MCWorld,
      ProjectItemType.worldFolder,
    ]);

    if (projectItem === undefined) {
      return;
    }

    await projectItem.load();

    if (projectItem.file === null) {
      return;
    }

    const content = projectItem.file.content;

    Log.message("About to save " + projectItem.file.name, this.props.project.name);

    if (content instanceof Uint8Array) {
      saveAs(new Blob([content], { type: "application/octet-stream" }), projectItem.file.name);
    }

    Log.message("Done saving " + projectItem.file.name, this.props.project.name);

    this.props.carto.notifyStatusUpdate("Downloading mcworld '" + projectItem.file.name + "'.");

    if (data && data.icon && (data.icon as any).key) {
      this._setNewDeployKey((data.icon as any).key, this._handleDownloadMCWorld, data);
    }
  }

  private async _handleDownloadMCWorldWithPacks(e: SyntheticEvent | undefined, data: MenuItemProps | undefined) {
    if (data === undefined || typeof data.content !== "string") {
      return;
    }

    await this._ensurePersisted();

    const projectItem = this._getProjectItemFromName(data.content, "World with packs embedded");

    if (projectItem === undefined) {
      return;
    }

    await projectItem.load();

    if (projectItem.file === null) {
      return;
    }

    const content = projectItem.file.content;

    if (content instanceof Uint8Array) {
      await this.saveAsWorldWithPacks(projectItem.file.name, content);
    }

    this.props.carto.notifyStatusUpdate("Downloading mcworld with packs embedded '" + projectItem.file.name + "'.");

    if (data && data.icon && (data.icon as any).key) {
      this._setNewDeployKey((data.icon as any).key, this._handleDownloadMCWorldWithPacks, data);
    }
  }

  private async _handleExportMCWorldWithPackRefs(e: SyntheticEvent | undefined, data: MenuItemProps | undefined) {
    if (data === undefined || typeof data.content !== "string") {
      return;
    }

    await this._ensurePersisted();

    const projectItem = this._getProjectItemFromName(data.content, "World with packs embedded", [
      ProjectItemType.MCWorld,
      ProjectItemType.worldFolder,
    ]);

    if (projectItem === undefined) {
      return;
    }

    await projectItem.load();

    if (projectItem.file === null) {
      return;
    }

    const content = projectItem.file.content;

    if (content instanceof Uint8Array) {
      await this.saveAsWorldWithPackRefs(projectItem.file.name, content);
    }

    this.props.carto.notifyStatusUpdate("Downloading");

    if (data && data.icon && (data.icon as any).key) {
      this._setNewExportKey((data.icon as any).key, this._handleExportWorld, data);
    }
  }

  private async saveAsWorldWithPacks(name: string, content: Uint8Array) {
    await this._ensurePersisted();

    const mcworld = await ProjectExporter.getGameTestWorldWithPacks(this.props.project, name, content);

    const newBytes = await mcworld.getBytes();

    Log.message("About to save " + name, this.props.project.name);
    if (newBytes !== undefined) {
      saveAs(new Blob([newBytes], { type: "application/octet-stream" }), name);
    }
    Log.message("Done with save " + name, this.props.project.name, this.props.project.name);
  }

  private async saveAsWorldWithPackRefs(name: string, content: Uint8Array) {
    await this._ensurePersisted();

    const mcworld = await ProjectExporter.getGameTestWorldWithPackRefs(this.props.project, name, content);

    const newBytes = await mcworld.getBytes();

    if (newBytes !== undefined) {
      saveAs(new Blob([newBytes]), name);
    }
  }

  private async _handleExportFlatWorldWithPacks(e: SyntheticEvent | undefined, data: MenuItemProps | undefined) {
    await this._ensurePersisted();

    await this.launchFlatDownload();

    if (data && data.icon && (data.icon as any).key) {
      this._setNewExportKey((data.icon as any).key, this._handleExportFlatWorldWithPacks, data);
    }
  }

  private async _handleDownloadFlatWorldWithPacks(e: SyntheticEvent | undefined, data: MenuItemProps | undefined) {
    await this._ensurePersisted();

    await this.launchFlatDownload();

    if (data && data.icon && (data.icon as any).key) {
      this._setNewDeployKey((data.icon as any).key, this._handleDownloadFlatWorldWithPacks, data);
    }
  }

  private launchFlatButton() {
    this.launchFlatDownload();
  }

  private async launchFlatDownload() {
    this.props.carto.notifyStatusUpdate("Starting export");

    const projName = await this.props.project.loc.getTokenValue(this.props.project.name);

    const nameCore = Utilities.getFileFriendlySummarySeconds(new Date()) + "-" + projName;

    const name = nameCore + " Flat GameTest";
    const fileName = nameCore + "-flatpack.mcworld";

    this.props.carto.notifyStatusUpdate("Packing " + fileName);

    const newBytes = await ProjectExporter.getFlatGameTestWorldWithPacksZip(this.props.carto, this.props.project, name);

    this.props.carto.notifyStatusUpdate("Now downloading " + fileName);

    if (newBytes !== undefined) {
      saveAs(new Blob([newBytes], { type: "application/octet-stream" }), fileName);
    }

    this.props.carto.notifyStatusUpdate("Done with save " + fileName);
  }

  private _setProjectStatusMode(mode: ProjectStatusAreaMode) {
    this.setState({
      activeProjectItem: this.state.activeProjectItem,
      mode: this.state.mode,
      viewMode: this.state.viewMode,
      menuState: this.state.menuState,
      statusAreaMode: mode,
      displayFileView: this.state.displayFileView,
      forceRawView: this.state.forceRawView,
      lastDeployKey: this.state.lastDeployKey,
      lastExportKey: this.state.lastExportKey,
      lastDeployFunction: this.state.lastDeployFunction,
      lastExportFunction: this.state.lastExportFunction,
      lastDeployData: this.state.lastDeployData,
      lastExportData: this.state.lastExportData,
    });
  }

  private async _handleExportFlatWorldWithPackRefs(e: SyntheticEvent | undefined, data: MenuItemProps | undefined) {
    const projName = await this.props.project.loc.getTokenValue(this.props.project.name);

    const name = projName + " Flat GameTest";
    const fileName = projName + " flat.mcworld";

    const mcworld = await ProjectExporter.getFlatGameTestWorldWithPackRefs(this.props.project, name);

    if (mcworld !== undefined) {
      const newBytes = await mcworld.getBytes();

      if (newBytes !== undefined) {
        saveAs(new Blob([newBytes]), fileName);
      }
    }

    if (data && data.icon && (data.icon as any).key) {
      this._setNewExportKey((data.icon as any).key, this._handleExportFlatWorldWithPackRefs, data);
    }
  }

  private _getProjectItemFromName(caption: string, extension: string, itemTypes?: ProjectItemType[]) {
    for (let i = 0; i < this.props.project.items.length; i++) {
      const pi = this.props.project.items[i];
      const name = pi.name; // StorageUtilities.getBaseFromName(pi.name);

      if (name + " " + extension === caption) {
        if (!itemTypes) {
          return pi;
        } else {
          for (let j = 0; j < itemTypes.length; j++) {
            if (pi.itemType === itemTypes[j]) {
              return pi;
            }
          }
        }
      }
    }

    return undefined;
  }

  private async _handleReferenceSelected(newReference: IGitHubInfo) {
    let newMode = this.state.mode;

    if (newMode !== ProjectEditorMode.activeItem) {
      newMode = ProjectEditorMode.activeItem;
    }

    await this._ensurePersisted();

    if (this.state !== undefined && this.state.activeReference !== newReference) {
      this._activeEditorPersistable = undefined;
    }

    this.setState({
      activeReference: newReference,
      activeProjectItem: null,
      mode: newMode,
      viewMode: this.state.viewMode,
      statusAreaMode: this.state.statusAreaMode,
      lastDeployKey: this.state.lastDeployKey,
      forceRawView: this.state.forceRawView,
      displayFileView: this.state.displayFileView,
      lastExportKey: this.state.lastExportKey,
      lastDeployFunction: this.state.lastDeployFunction,
      lastExportFunction: this.state.lastExportFunction,
      lastDeployData: this.state.lastDeployData,
      lastExportData: this.state.lastExportData,
    });
  }

  private _handleResize() {
    this.forceUpdate();
  }

  private async _handleProjectItemSelected(newProjectItem: ProjectItem, forceRawView: boolean) {
    if (
      this.state.viewMode === CartoEditorViewMode.toolboxFocus ||
      this.state.viewMode === CartoEditorViewMode.itemsFocus
    ) {
      if (this.props.onActiveProjectItemChangeRequested) {
        this.props.onActiveProjectItemChangeRequested(newProjectItem, forceRawView);
      }
    } else {
      let newMode = this.state.mode;

      if (newMode !== ProjectEditorMode.activeItem) {
        newMode = ProjectEditorMode.activeItem;
      }

      await this._ensurePersisted();

      if (this.state !== undefined && this.state.activeProjectItem !== newProjectItem) {
        this._activeEditorPersistable = undefined;
      }

      this.setState({
        activeProjectItem: newProjectItem,
        activeReference: null,
        mode: newMode,
        viewMode: this.state.viewMode,
        forceRawView: forceRawView,
        statusAreaMode: this.state.statusAreaMode,
        displayFileView: this.state.displayFileView,
        lastDeployKey: this.state.lastDeployKey,
        lastExportKey: this.state.lastExportKey,
        lastDeployFunction: this.state.lastDeployFunction,
        lastExportFunction: this.state.lastExportFunction,
        lastDeployData: this.state.lastDeployData,
        lastExportData: this.state.lastExportData,
      });
    }
  }

  _handleActionClick() {}

  async _handleEditCopyClick() {
    if (this.props === undefined || this.props.onModeChangeRequested === undefined) {
      return;
    }

    this.props.onModeChangeRequested(AppMode.project);

    await this.ensurePersistentBrowserStorage();
  }

  getProjectTitle() {
    if (this.props.project === null) {
      return "(no project)";
    } else {
      return this.props.project.title;
    }
  }

  getIsLinkShareable() {
    const proj = this.props.project;

    if (
      !(
        (proj.gitHubOwner && proj.gitHubRepoName) ||
        (proj.originalGitHubOwner !== undefined && proj.originalGitHubRepoName !== undefined)
      )
    ) {
      return false;
    }

    if (proj.projectCabinetFile) {
      return false;
    }

    for (let projectItem of proj.items) {
      if (projectItem.isFileContainerStorageItem) {
        return false;
      }
    }

    return true;
  }

  render() {
    const width = WebUtilities.getWidth();
    let isButtonCompact = false;
    let isFullyCompact = false;

    if (width < 1016) {
      isButtonCompact = true;
    }

    if (width < 744) {
      isFullyCompact = true;
    }

    let widthOffset = 10;

    if (
      this.state.viewMode === CartoEditorViewMode.itemsOnLeft ||
      this.state.viewMode === CartoEditorViewMode.itemsOnRight
    ) {
      widthOffset = 330;
    } else if (
      this.state.viewMode === CartoEditorViewMode.itemsOnLeftAndMinecraftToolbox ||
      this.state.viewMode === CartoEditorViewMode.itemsOnRightAndMinecraftToolbox
    ) {
      widthOffset = 590;
    }

    if (this.props.project.errorState === ProjectErrorState.projectFolderOrFileDoesNotExist) {
      let error = "Could not find project data folder. ";

      if (this.props.project.localFolderPath) {
        error += this.props.project.localFolderPath;
      }

      return <h1>{error}</h1>;
    }

    let exportKeys: { [exportOptionKey: string]: any } = {};
    const exportMenu: any = [];

    let nextExportKey = "shareableLink";

    if (this.props.project.role !== ProjectRole.documentation) {
      if (this.getIsLinkShareable()) {
        exportKeys[nextExportKey] = {
          key: nextExportKey,
          icon: <FontAwesomeIcon icon={faLink} key={nextExportKey} className="fa-lg" />,
          content: "Shareable Link",
          onClick: this._handleGetShareableLinkClick,
          title: "Get a shareable link of this project.",
        };
        exportMenu.push(exportKeys[nextExportKey]);
      }
      nextExportKey = "mcpackAddon";
      exportKeys[nextExportKey] = {
        key: nextExportKey,
        icon: <FontAwesomeIcon icon={faBox} key={nextExportKey} className="fa-lg" />,
        content: "MCPack add-on",
        onClick: this._handleExportMCPackClick,
        title: "Exports this set of project files as an MCPack add-on, for use in Minecraft",
      };
      exportMenu.push(exportKeys[nextExportKey]);

      if (!AppServiceProxy.hasAppService) {
        exportMenu.push({
          key: "dividerEXP",
          kind: "divider",
        });

        nextExportKey = "exportFolder";
        exportKeys[nextExportKey] = {
          key: nextExportKey,
          icon: <FontAwesomeIcon icon={faComputer} key={nextExportKey} className="fa-lg" />,
          content: "Export to folder on this PC",
          onClick: this._handleExportToLocalFolderClick,
          title: "Exports this project to a folder on your PC.",
        };
        exportMenu.push(exportKeys[nextExportKey]);
      }

      exportMenu.push({
        key: "divider",
        kind: "divider",
      });

      nextExportKey = "flatBP|";

      exportKeys[nextExportKey] = {
        key: nextExportKey,
        icon: <FontAwesomeIcon icon={faGlobe} key={nextExportKey} className="fa-lg" />,
        onClick: this._handleExportFlatWorldWithPacks,
        content: "Flat world with packs embedded",
        title: "Get this pack in a sample .mcworld file with packs in this project added",
      };
      exportMenu.push(exportKeys[nextExportKey]);

      nextExportKey = "flatBPR|";
      exportKeys[nextExportKey] = {
        key: nextExportKey,
        icon: <FontAwesomeIcon icon={faGlobe} key={nextExportKey} className="fa-lg" />,
        onClick: this._handleExportFlatWorldWithPackRefs,
        content: "Flat world with pack references",
        title: "Get this pack in a sample .mcworld file with references to this add-on packs",
      };
      exportMenu.push(exportKeys[nextExportKey]);

      exportMenu.push({
        key: "dividerA",
        kind: "divider",
      });
    }

    nextExportKey = "exportZip";
    exportKeys[nextExportKey] = {
      kind: "toggle",
      icon: <FontAwesomeIcon icon={faFileArchive} key={nextExportKey} className="fa-lg" />,
      key: nextExportKey,
      content: "Project full zip",
      onClick: this._handleExportZipClick,
      title:
        "Exports this set of project files as a zip, for use as a backup or if you wish to manually copy to Minecraft",
    };
    exportMenu.push(exportKeys[nextExportKey]);

    if (this.props.project.role !== ProjectRole.documentation) {
      nextExportKey = "downloadDeployment";
      exportKeys[nextExportKey] = {
        key: nextExportKey,
        icon: <FontAwesomeIcon icon={faFileArchive} key={nextExportKey} className="fa-lg" />,
        onClick: this._handleExportDeploymentZipClick,
        content: "Deployment folder zip",
        title: "Download Deployment",
      };
      exportMenu.push(exportKeys[nextExportKey]);
    }

    const deployKeys: { [deployOptionKey: string]: any } = {};

    const deployMenu: any = [];

    for (let i = 0; i < this.props.project.items.length; i++) {
      const pi = this.props.project.items[i];

      if (
        pi.itemType === ProjectItemType.MCWorld ||
        pi.itemType === ProjectItemType.MCTemplate ||
        pi.itemType === ProjectItemType.worldFolder
      ) {
        let world = undefined;

        if (pi.folder && pi.folder.manager && pi.folder.manager instanceof MCWorld) {
          world = pi.folder.manager as MCWorld;
        } else if (pi.file && pi.file.manager && pi.file.manager instanceof MCWorld) {
          world = pi.file.manager as MCWorld;
        }

        let title = pi.name;

        if (world) {
          title = world.name;
        }

        if (pi.itemType === ProjectItemType.MCWorld || pi.itemType === ProjectItemType.MCTemplate) {
          nextExportKey = "exportWorld|" + pi.name;

          exportKeys = {
            key: nextExportKey,
            icon: <FontAwesomeIcon icon={faBox} className="fa-lg" />,
            content: title + " world",
            onClick: this._handleExportWorld,
            title: "Download " + title,
          };

          exportMenu.push(exportKeys[nextExportKey]);
        }

        const miKey = "deployWorldTestAssetsPack|" + pi.name;
        deployKeys[miKey] = {
          key: miKey + "A",
          icon: <FontAwesomeIcon icon={faBox} key={miKey} className="fa-lg" />,
          content: title + " and test assets mcworld",
          onClick: this._handleDeployWorldAndTestAssetsPackClick,
          title: "Deploys " + title + " and test assets in a zip",
        };
        deployMenu.push(deployKeys[miKey]);

        if (AppServiceProxy.hasAppServiceOrDebug) {
          const miKeyA = "deployWorldTestAssetsLocal|" + pi.name;
          deployKeys[miKeyA] = {
            key: miKeyA,
            icon: <FontAwesomeIcon icon={faBox} key={miKeyA} className="fa-lg" />,
            content: title + " and test assets to Minecraft",
            onClick: this._handleDeployWorldAndTestAssetsLocalClick,
            title: "Deploys " + title + " and test assets in a zip",
          };
          deployMenu.push(deployKeys[miKeyA]);
        }
      }
    }

    if (deployMenu.length > 0) {
      deployMenu.push({
        key: "dividerWorld",
        kind: "divider",
      });
    }

    if (this.props.carto.remoteServerUrl && this.props.carto.remoteServerAuthToken && Utilities.isDebug) {
      const deployRemoteKey = "deployToRemoteServer";
      deployKeys[deployRemoteKey] = {
        key: deployRemoteKey + "A",
        icon: <FontAwesomeIcon icon={faBox} key={deployRemoteKey} className="fa-lg" />,
        content: "Deploy to " + this.props.carto.remoteServerUrl,
        onClick: this._handleDeployToRemoteServerClick,
        title: "Deploys this to a remote Dev Tools server",
      };
      deployMenu.push(deployKeys[deployRemoteKey]);
    }

    if (
      CartoApp.hostType !== HostType.web &&
      CartoApp.hostType !== HostType.webPlusServices &&
      this.props.carto.minecraftGameMode !== MinecraftGameConnectionMode.remoteMinecraft
    ) {
      const deployToMinecraftGame = "deployPacksToMinecraftGame";
      let productPhrase = "Minecraft";

      if (this.props.carto.minecraftGameMode === MinecraftGameConnectionMode.localMinecraftPreview) {
        productPhrase = "Minecraft Preview";
      }

      deployKeys[deployToMinecraftGame] = {
        key: deployToMinecraftGame + "A",
        icon: <FontAwesomeIcon icon={faBox} key={deployToMinecraftGame} className="fa-lg" />,
        content: "Packs to " + productPhrase,
        onClick: this._handleDeployPacksToMinecraftGameClick,
        title: "Deploys packs in this project this to a local Minecraft game",
      };
      deployMenu.push(deployKeys[deployToMinecraftGame]);
    }

    if (
      CartoApp.hostType !== HostType.web &&
      CartoApp.hostType !== HostType.webPlusServices &&
      this.props.carto.minecraftGameMode !== MinecraftGameConnectionMode.remoteMinecraft
    ) {
      const deployToMinecraftGame = "deployPacksAndWorldToMinecraftGame";
      let productPhrase = "Minecraft";

      if (this.props.carto.minecraftGameMode === MinecraftGameConnectionMode.localMinecraftPreview) {
        productPhrase = "Minecraft Preview";
      }

      deployKeys[deployToMinecraftGame] = {
        key: deployToMinecraftGame + "A",
        icon: <FontAwesomeIcon icon={faBox} key={deployToMinecraftGame} className="fa-lg" />,
        content: "Packs & world to " + productPhrase,
        onClick: this._handleDeployPacksAndWorldsToMinecraftGameClick,
        title: "Deploys packs, worlds, and a test world in this project this to a local Minecraft game",
      };
      deployMenu.push(deployKeys[deployToMinecraftGame]);

      deployKeys[deployToMinecraftGame] = {
        key: deployToMinecraftGame + "B",
        icon: <FontAwesomeIcon icon={faBox} key={deployToMinecraftGame} className="fa-lg" />,
        content: "Packs & world to " + productPhrase + " & open",
        onClick: this._handleDeployPacksAndWorldsToMinecraftGameAndOpenClick,
        title:
          "Deploys packs, worlds, and a test world in this project this to a local Minecraft game, and then opens it up in " +
          productPhrase,
      };
      deployMenu.push(deployKeys[deployToMinecraftGame]);
    }

    const deployFolderZip = "deployFolderZip";
    deployKeys[deployFolderZip] = {
      key: deployFolderZip + "A",
      icon: <FontAwesomeIcon icon={faBox} key={deployFolderZip} className="fa-lg" />,
      content: "Save deploy folder as zip",
      onClick: this._handleDeployAsZipClick,
      title: "Deploys this as a full zip that can be copied into your Minecraft folder",
    };
    deployMenu.push(deployKeys[deployFolderZip]);

    const flatBp = "flatBP|";
    deployKeys[flatBp] = {
      key: flatBp + "A",
      icon: <FontAwesomeIcon icon={faGlobe} key={flatBp} className="fa-lg" />,
      onClick: this._handleDownloadFlatWorldWithPacks,
      content: "Download flat world with packs",
      title: "Get this pack in a sample .mcworld file with packs in this project added",
    };
    deployMenu.push(deployKeys[flatBp]);

    let addedItems = 0;

    for (let i = 0; i < this.props.project.items.length && addedItems < 4; i++) {
      const pi = this.props.project.items[i];

      if (pi.itemType === ProjectItemType.MCWorld) {
        addedItems++;
        const name = StorageUtilities.getBaseFromName(pi.name);

        exportMenu.push({
          key: "divider",
          kind: "divider",
        });

        nextExportKey = "download|" + pi.name;

        exportKeys[nextExportKey] = {
          key: nextExportKey,
          icon: <FontAwesomeIcon icon={faGlobe} className="fa-lg" />,
          onClick: this._handleDownloadMCWorld,
          content: name + " World", // note this content is critical for matching, see onClick
          title: "Get the " + name + " .mcworld file",
        };
        exportMenu.push(exportKeys[nextExportKey]);

        nextExportKey = "downloadBP|" + pi.name;
        exportKeys[nextExportKey] = {
          key: nextExportKey,
          icon: <FontAwesomeIcon icon={faGlobe} className="fa-lg" />,
          onClick: this._handleDownloadMCWorldWithPacks,
          content: name + " World with packs embedded",
          title: "Get the " + name + " .mcworld file with packs in this project added",
        };
        exportMenu.push(exportKeys[nextExportKey]);

        nextExportKey = "downloadBPR|" + pi.name;
        exportKeys[nextExportKey] = {
          key: "downloadBPR|" + pi.name,
          icon: <FontAwesomeIcon icon={faGlobe} className="fa-lg" />,
          onClick: this._handleExportMCWorldWithPackRefs,
          content: name + " World with pack references",
          title: "Get the " + name + " .mcworld file with references to this add-on packs",
        };
        exportMenu.push(exportKeys[nextExportKey]);
      }
    }

    const toolbarItems: any[] = [];

    if (!this.props.isHosted) {
      toolbarItems.push({
        icon: <HomeLabel />,
        key: "home",
        kind: "toggle",
        active: true,
        onClick: this._handleHomeClick,
        title: "Toggle bold",
      });

      if (Utilities.isDebug) {
        if (this.props.readOnly) {
          toolbarItems.push({
            icon: <EditLabel />,
            key: "editCopy",
            onClick: this._handleEditCopyClick,
            title: "Edit copy",
          });
        } else {
          toolbarItems.push({
            icon: <SaveLabel />,
            key: "save",
            content: <Text content="Save" />,
            onClick: this._handleSaveClick,
            title: "Save",
          });
        }
      }

      if (CartoApp.hostType === HostType.electronWeb || CartoApp.hostType === HostType.vsCodeMainWeb)
        toolbarItems.push({
          icon: <OpenInExplorerLabel />,
          key: "openInExplorer",
          content: <Text content="Open in Explorer" />,
          onClick: this._openInExplorerClick,
          title: "Open in Explorer",
        });

      const viewMenuItems: any[] = [];

      if (!isFullyCompact) {
        viewMenuItems.push({
          key: "itemsOnLeft",
          content: "Item list on the left",
          icon: <FontAwesomeIcon icon={faSquareCaretLeft} className="fa-lg" />,
          title: "Item list on the left",
          onClick: this._setItemsOnLeft,
        });

        viewMenuItems.push({
          key: "itemsOnRight",
          content: "Item list on the right",
          icon: <FontAwesomeIcon icon={faSquareCaretRight} className="fa-lg" />,
          title: "Item list on the right",
          onClick: this._setItemsOnRight,
        });

        viewMenuItems.push({
          key: "worldToolsDivider",
          kind: "divider",
        });

        viewMenuItems.push({
          key: "viewAsItems",
          content: "View as items",
          icon: <FontAwesomeIcon icon={faSquareCaretLeft} className="fa-lg" />,
          title: "Item list on the left",
          onClick: this._viewAsItems,
        });

        viewMenuItems.push({
          key: "viewAsFiles",
          content: "View as files",
          icon: <FontAwesomeIcon icon={faSquareCaretRight} className="fa-lg" />,
          title: "Item list on the right",
          onClick: this._viewAsFiles,
        });

        viewMenuItems.push({
          key: "worldToolsDividerI",
          kind: "divider",
        });
      }

      viewMenuItems.push({
        key: "mainFocus",
        content: "Main",
        icon: <FontAwesomeIcon icon={faWindowMaximize} className="fa-lg" />,
        title: "Main",
        onClick: this._setMainFocus,
      });
      viewMenuItems.push({
        key: "itemsFocus",
        content: "Items",
        icon: <FontAwesomeIcon icon={faSitemap} className="fa-lg" />,
        title: "Items",
        onClick: this._setItemsFocus,
      });

      if (Utilities.isDebug) {
        viewMenuItems.push({
          key: "toolboxFocus",
          content: "Toolbox",
          icon: <FontAwesomeIcon icon={faTools} className="fa-lg" />,
          title: "Toolbox",
          onClick: this._setToolboxFocus,
        });
      }

      if (AppServiceProxy.hasAppService && !isFullyCompact) {
        viewMenuItems.push({
          key: "worldToolsDivider",
          kind: "divider",
        });

        viewMenuItems.push({
          key: "minecraftToolboxFocus",
          content:
            this.state.viewMode === CartoEditorViewMode.itemsOnLeftAndMinecraftToolbox ||
            this.state.viewMode === CartoEditorViewMode.itemsOnRightAndMinecraftToolbox
              ? "Hide Toolbox Pane"
              : "Show Toolbox Pane",
          icon: <FontAwesomeIcon icon={faTools} className="fa-lg" />,
          title: "Show Toolbox Pane",
          onClick: this._toggleMinecraftToolbox,
        });
      }

      toolbarItems.push({
        icon: <ViewLabel isCompact={isButtonCompact} />,
        key: "more",
        active: this.state.menuState === ProjectEditorMenuState.viewMenu,
        title: "More",
        menu: viewMenuItems,
        menuOpen: this.state.menuState === ProjectEditorMenuState.viewMenu,
        onMenuOpenChange: this._handleViewMenuOpen,
      });
    } else {
      /*
      toolbarItems.push({
        icon: <AddLabel isCompact={isButtonCompact} />,
        key: "add",
        active: true,
        onClick: this._handleVscAddClick,
      });*/

      //      const viewMenuItems: any[] = [];
      toolbarItems.push({
        key: "itemsFocus",
        content: "Items",
        icon: <HomeLabel />,
        title: "Items",
        onClick: this._setToolboxLandingFocus,
      });

      toolbarItems.push({
        key: "itemsFocus",
        content: "Items",
        icon: <FontAwesomeIcon icon={faSitemap} className="fa-lg" />,
        title: "Items",
        onClick: this._setItemsFocus,
      });
      /*
      viewMenuItems.push({
        key: "minecraftToolboxFocus",
        content: "Minecraft Toolbox",
        icon: <FontAwesomeIcon icon={faGithub} className="fa-lg" />,
        title: "Minecraft Toolbox",
        onClick: this._setToolboxFocus,
      });

      toolbarItems.push({
        icon: <ViewLabel isCompact={isButtonCompact} />,
        key: "more",
        active: this.state.menuState === ProjectEditorMenuState.viewMenu,
        title: "More",
        menu: viewMenuItems,
        menuOpen: this.state.menuState === ProjectEditorMenuState.viewMenu,
        onMenuOpenChange: this._handleViewMenuOpen,
      });*/
    }

    if (Utilities.isDebug) {
      toolbarItems.push({
        icon: <SettingsLabel isCompact={isButtonCompact} />,
        key: "settings",
        onClick: this._showSettingsClick,
        title: "Settings",
      });

      if (this.props.project.role !== ProjectRole.documentation && Utilities.isDebug) {
        toolbarItems.push({
          icon: <MinecraftLabel isCompact={isButtonCompact} />,
          key: "connect",
          kind: "toggle",
          onClick: this._showMinecraftClick,
          active: true,
          title: "Manage connection to Minecraft",
        });
      }
    }

    if (!this.state.lastExportKey) {
      toolbarItems.push({
        key: "export",
        icon: <MCPackLabel isCompact={isButtonCompact} />,
        content: "Export",
        title: isButtonCompact ? "" : "Export",
        active: true,
        menuOpen: this.state.menuState === ProjectEditorMenuState.exportMenu,
        onMenuOpenChange: this._handleExportMenuOpen,
        menu: exportMenu,
      });
    } else {
      const exportItem = exportKeys[this.state.lastExportKey];

      toolbarItems.push({
        icon: <CustomLabel icon={exportItem.icon} text={exportItem.content} isCompact={isButtonCompact} />,
        key: exportItem.key + "I",
        onClick: exportItem.onClick,
        active: true,
        title: exportItem.title,
      });

      toolbarItems.push({
        icon: <DownArrowLabel />,
        key: "export",
        onMenuOpenChange: this._handleExportMenuOpen,
        menuOpen: this.state.menuState === ProjectEditorMenuState.exportMenu,
        menu: exportMenu,
        active: true,
        title: "Export Options",
      });
    }

    const personaItems: any[] = [];

    if (CartoApp.hostType === HostType.webPlusServices) {
      personaItems.push({
        icon: <FontAwesomeIcon icon={faGithub} className="fa-lg" />,
        key: "github",
        onClick: this._handleGitHubSignInClick,
        active: true,
        title: "Sign-in",
      });
    }

    if (this.props.carto.deploymentStorage != null && this.props.project.role !== ProjectRole.documentation) {
      if (!this.state.lastDeployKey) {
        toolbarItems.push({
          icon: <DeployLabel isCompact={isButtonCompact} />,
          key: "deployDefault",
          onMenuOpenChange: this._handleDeployMenuOpen,
          menuOpen: this.state.menuState === ProjectEditorMenuState.deployMenu,
          menu: deployMenu,
          active: true,
          title: "Deploy",
        });
      } else {
        const deployItem = deployKeys[this.state.lastDeployKey];

        toolbarItems.push({
          icon: <CustomLabel icon={deployItem.icon} text={deployItem.content} isCompact={isButtonCompact} />,
          key: deployItem.key + "I",
          onClick: deployItem.onClick,
          active: true,
          title: deployItem.title,
        });

        toolbarItems.push({
          icon: <DownArrowLabel />,
          key: "deploy",
          onMenuOpenChange: this._handleDeployMenuOpen,
          menuOpen: this.state.menuState === ProjectEditorMenuState.deployMenu,
          menu: deployMenu,
          active: true,
          title: "Deploy Options",
        });
      }
    }

    let interior = <></>;

    let gridStyle = "pe-gridOuter ";
    let gridTemplateColumns = "300px 1fr 300px";
    let heightOffset = 104;

    if (isFullyCompact) {
      gridTemplateColumns = "30px 1fr 30px";
    }

    let areaHeight = "calc(100vh - 4px)";

    if (CartoApp.hostType === HostType.vsCodeMainWeb || CartoApp.hostType === HostType.vsCodeWebWeb) {
      areaHeight = "calc(100vh)";
      heightOffset += 9;
    } else if (CartoApp.hostType === HostType.electronWeb) {
      areaHeight = "calc(100vh - 36px)";
      heightOffset += 47;
    }

    if (this.props.hideMainToolbar) {
      gridStyle += "pe-gridOuterNtbCollapsed";
      heightOffset -= 55;
    } else if (this.state.statusAreaMode === ProjectStatusAreaMode.expanded) {
      gridStyle += "pe-gridOuterExpanded";
      heightOffset += 200;
    } else {
      gridStyle += "pe-gridOuterCollapsed";
    }

    if (this.props.statusAreaMode === ProjectStatusAreaMode.hidden) {
      heightOffset -= 45;
    }

    if (this.state.mode === ProjectEditorMode.properties) {
      if (this.props.readOnly) {
        interior = (
          <ProjectDisplay
            theme={this.props.theme}
            heightOffset={heightOffset}
            project={this.props.project}
            carto={this.props.carto}
          />
        );
      } else {
        interior = (
          <ProjectPropertyEditor
            theme={this.props.theme}
            heightOffset={heightOffset}
            project={this.props.project}
            carto={this.props.carto}
          />
        );
      }
    } else if (this.state.mode === ProjectEditorMode.inspector) {
      interior = (
        <ProjectInfoDisplay
          theme={this.props.theme}
          heightOffset={heightOffset}
          project={this.props.project}
          carto={this.props.carto}
          onInfoItemCommand={this._handleInfoItemCommand}
        />
      );
    } else if (this.state.mode === ProjectEditorMode.minecraftToolSettings) {
      interior = (
        <MinecraftToolEditor
          carto={this.props.carto}
          theme={this.props.theme}
          project={this.props.project}
          heightOffset={heightOffset}
          widthOffset={widthOffset}
          setActivePersistable={this._setActiveEditorPersistable}
        />
      );
    } else if (this.state.mode === ProjectEditorMode.minecraft) {
      interior = (
        <MinecraftDisplay
          forceCompact={this.props.viewMode === CartoEditorViewMode.toolboxFocus}
          theme={this.props.theme}
          carto={this.props.carto}
          widthOffset={widthOffset}
          heightOffset={heightOffset}
          ensureMinecraftOnLogin={true}
          project={this.props.project}
        />
      );
    } else if (this.state.mode === ProjectEditorMode.cartoSettings) {
      interior = (
        <CartoSettings
          theme={this.props.theme}
          carto={this.props.carto}
          heightOffset={heightOffset}
          setActivePersistable={this._setActiveEditorPersistable}
        />
      );
    } else {
      interior = (
        <ProjectItemEditor
          theme={this.props.theme}
          readOnly={this.props.readOnly}
          heightOffset={heightOffset}
          forceRawView={true} //this.state.forceRawView}
          project={this.props.project}
          setActivePersistable={this._setActiveEditorPersistable}
          carto={this.props.carto}
          activeReference={this.state.activeReference}
          activeProjectItem={this.state.activeProjectItem}
        />
      );
    }

    let metaArea = <></>;

    if (!isFullyCompact && !this.props.isHosted && !this.props.hideMainToolbar) {
      const title = this.getProjectTitle();

      metaArea = (
        <div
          className="pe-meta"
          style={{
            color: this.props.theme.siteVariables?.colorScheme.brand.foreground6,
          }}
        >
          <div className="pe-metaArea" title={title}>
            <div className="pe-title">
              <LocTokenBox carto={this.props.carto} project={this.props.project} value={this.props.project.title} />
            </div>
            <div className="pe-signin">
              <Toolbar
                aria-label="Signin"
                items={personaItems}
                overflow
                overflowItem={{
                  title: "More",
                }}
              />
            </div>
          </div>
        </div>
      );
    }

    let effectArea = <></>;

    if (this.state.effectMode === ProjectEditorEffect.dragOver) {
      effectArea = <div className="pe-dragOver">Drop any additional files here.</div>;
    }

    if (this.state.dialog === ProjectEditorDialog.shareableLink) {
      const dialogContent = <ShareProject carto={this.props.carto} project={this.props.project} />;
      effectArea = (
        <Dialog
          open={true}
          cancelButton="Cancel"
          confirmButton="OK"
          onCancel={this._handleDialogDone}
          onConfirm={this._handleDialogDone}
          content={dialogContent}
          header={"Share Link to this Project"}
        />
      );
    }

    let column1 = <></>;
    let column2 = <></>;
    let column3 = <></>;

    let itemList = <></>;

    if (this.state.displayFileView) {
      if (this.props.project.projectFolder) {
        itemList = (
          <FileExplorer
            theme={this.props.theme}
            rootFolder={this.props.project.projectFolder}
            carto={this.props.carto}
            readOnly={this.props.readOnly}
            heightOffset={heightOffset}
          />
        );
      }
    } else {
      itemList = (
        <ProjectItemList
          theme={this.props.theme}
          project={this.props.project}
          carto={this.props.carto}
          heightOffset={heightOffset}
          onModeChangeRequested={this._handleModeChangeRequested}
          onActiveProjectItemChangeRequested={this._handleProjectItemSelected}
          onActiveReferenceChangeRequested={this._handleReferenceSelected}
          readOnly={this.props.readOnly}
          activeProjectItem={this.state.activeProjectItem}
        />
      );
    }

    let viewMode = this.state.viewMode;

    let border = "";

    if (CartoApp.theme === CartoThemeStyle.dark) {
      border = "4px inset #6b6562";
    } else {
      border = "4px inset #f1f1f1";
    }

    if (
      isFullyCompact &&
      (viewMode === CartoEditorViewMode.itemsOnLeft ||
        viewMode === CartoEditorViewMode.itemsOnLeftAndMinecraftToolbox ||
        viewMode === CartoEditorViewMode.itemsOnRight ||
        viewMode === CartoEditorViewMode.itemsOnRightAndMinecraftToolbox)
    ) {
      viewMode = CartoEditorViewMode.mainFocus;
    }

    if (viewMode === CartoEditorViewMode.mainFocus) {
      column2 = (
        <div
          className="pe-colAll"
          style={{ border: border, backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background2 }}
        >
          {interior}
        </div>
      );
      if (isFullyCompact) {
        gridTemplateColumns = "1fr 1fr 1fr";
      }
    } else if (viewMode === CartoEditorViewMode.itemsFocus) {
      column2 = <div className="pe-itemlist pe-colAll">{itemList}</div>;
    } else if (viewMode === CartoEditorViewMode.toolboxFocus) {
      column2 = (
        <div className="pe-colAll">
          <MinecraftDisplay
            forceCompact={true}
            theme={this.props.theme}
            widthOffset={widthOffset}
            project={this.props.project}
            carto={this.props.carto}
            ensureMinecraftOnLogin={true}
            heightOffset={heightOffset}
          />
        </div>
      );
      if (isFullyCompact) {
        gridTemplateColumns = "1fr 1fr 1fr";
      }
    } else if (viewMode === CartoEditorViewMode.itemsOnLeft) {
      column1 = <div className="pe-itemlist pe-col1">{itemList}</div>;
      column2 = (
        <div
          className="pe-col2and3"
          style={{ border: border, backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background2 }}
        >
          {interior}
        </div>
      );
      if (isFullyCompact) {
        gridTemplateColumns = "300px 1fr 1fr";
      }
    } else if (viewMode === CartoEditorViewMode.itemsOnLeftAndMinecraftToolbox) {
      column1 = <div className="pe-itemlist pe-col1">{itemList}</div>;
      column2 = (
        <div
          className="pe-col2"
          style={{ border: border, backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background2 }}
        >
          {interior}
        </div>
      );
      column3 = (
        <div className="pe-col3">
          <MinecraftDisplay
            forceCompact={true}
            theme={this.props.theme}
            project={this.props.project}
            widthOffset={widthOffset}
            carto={this.props.carto}
            ensureMinecraftOnLogin={true}
            heightOffset={heightOffset}
          />
        </div>
      );
    } else if (viewMode === CartoEditorViewMode.itemsOnRightAndMinecraftToolbox) {
      column1 = (
        <div className="pe-col1">
          <MinecraftDisplay
            forceCompact={true}
            theme={this.props.theme}
            project={this.props.project}
            carto={this.props.carto}
            widthOffset={widthOffset}
            ensureMinecraftOnLogin={true}
            heightOffset={heightOffset}
          />
        </div>
      );
      column2 = (
        <div
          className="pe-col2"
          style={{ border: border, backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background2 }}
        >
          {interior}
        </div>
      );
      column3 = <div className="pe-itemlist pe-col3">{itemList}</div>;
    } else {
      column1 = (
        <div
          className="pe-col1and2"
          style={{ border: border, backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background2 }}
        >
          {interior}
        </div>
      );
      if (isFullyCompact) {
        gridTemplateColumns = "1fr 1fr 300px";
      }

      column2 = <div className="pe-itemlist pe-col3">{itemList}</div>;
    }

    let toolbarStyle = "pe-toolbar";

    if (isFullyCompact) {
      toolbarStyle = "pe-toolbar-full";
    }

    let toolbarArea = <></>;

    if (!this.props.hideMainToolbar) {
      toolbarArea = (
        <div className={toolbarStyle}>
          <Toolbar
            aria-label="Editor toolbar overflow menu"
            items={toolbarItems}
            overflow
            style={{ minHeight: 50 }}
            overflowItem={{
              title: "More",
            }}
          />
        </div>
      );
    }

    let statusArea = <></>;

    if (this.state.statusAreaMode !== ProjectStatusAreaMode.hidden) {
      statusArea = (
        <div
          className="pe-statusbar"
          style={{
            backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
            color: this.props.theme.siteVariables?.colorScheme.brand.foreground1,
          }}
        >
          <StatusArea
            carto={this.props.carto}
            project={this.props.project}
            theme={this.props.theme}
            heightOffset={heightOffset}
            statusAreaMode={this.state.statusAreaMode}
            onSetExpandedSize={this._setProjectStatusMode}
          />
        </div>
      );
    }

    return (
      <div>
        {effectArea}
        <div
          className={gridStyle}
          style={{ minHeight: areaHeight, maxHeight: areaHeight, gridTemplateColumns: gridTemplateColumns }}
        >
          {toolbarArea}
          {metaArea}
          {column1}
          {column2}
          {column3}
          {statusArea}
        </div>
      </div>
    );
  }
}
