import React, { Component, SyntheticEvent } from "react";
import IAppProps from "./IAppProps";
import Project, { ProjectErrorState } from "./../app/Project";
import ProjectItem from "./../app/ProjectItem";
import { ProjectItemCreationType, ProjectItemStorageType, ProjectItemType } from "./../app/IProjectItemData";
import ProjectItemList from "./ProjectItemList";
import ProjectItemEditor from "./ProjectItemEditor";
import ProjectExporter from "./../app/ProjectExporter";
import MCWorld from "./../minecraft/MCWorld";
import { AppMode } from "./App";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
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
  faFolderTree,
  faList,
} from "@fortawesome/free-solid-svg-icons";
import { Toolbar, Text, MenuItemProps, ThemeInput, Dialog } from "@fluentui/react-northstar";

import {
  ViewLabel,
  SaveLabel,
  SettingsLabel,
  HomeLabel,
  DeployLabel,
  ConnectLabel as MinecraftLabel,
  MCPackLabel,
  DownArrowLabel,
  CustomLabel,
  OpenInExplorerLabel,
} from "./Labels";

import "./ProjectEditor.css";
import ZipStorage from "../storage/ZipStorage";
import Utilities from "../core/Utilities";
import { saveAs } from "file-saver";
import StorageUtilities, { EncodingType } from "../storage/StorageUtilities";
import StatusArea from "./StatusArea";
import ProjectPropertyEditor from "./ProjectPropertyEditor";
import IPersistable from "./IPersistable";
import Log from "./../core/Log";
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
import { faEdit, faWindowMaximize } from "@fortawesome/free-regular-svg-icons";
import FileExplorer, { FileExplorerMode } from "./FileExplorer";
import ShareProject from "./ShareProject";
import { IProjectUpdaterReference } from "../info/IProjectInfoGeneratorBase";
import { StatusTopic } from "../app/Status";
import { SidePaneMaxWidth, SidePaneMinWidth } from "../app/Carto";
import ProjectEditorUtilities, {
  ProjectEditorMode,
  ProjectEditorAction,
  MaxModeActions,
} from "./ProjectEditorUtilities";
import { IWorldSettings } from "../minecraft/IWorldSettings";
import WorldSettingsArea from "../UX/WorldSettingsArea";
import IFile from "../storage/IFile";
import ProjectActions from "./ProjectActions";
import ProjectInfoSet from "../info/ProjectInfoSet";
import { IAnnotatedValue } from "../core/AnnotatedValue";
import { ProjectRole } from "../app/IProjectData";
import ProjectUtilities from "../app/ProjectUtilities";
import IConversionSettings from "../core/IConversionSettings";
import ProjectItemUtilities from "../app/ProjectItemUtilities";
import IntegrateItem from "./IntegrateItem";
import IProjectItemSeed, { ProjectItemSeedAction } from "../app/IProjectItemSeed";

interface IProjectEditorProps extends IAppProps {
  onModeChangeRequested?: (mode: AppMode) => void;
  onActiveProjectItemChangeRequested?: (projectItem: ProjectItem, forceRawView: boolean) => void;
  project: Project;
  readOnly: boolean;
  isHosted?: boolean;
  visualSeed?: number;
  theme: ThemeInput<any>;
  selectedItem?: string;
  heightOffset: number;
  mode?: ProjectEditorMode;
  statusAreaMode?: ProjectStatusAreaMode;
  hideMainToolbar?: boolean;
  viewMode?: CartoEditorViewMode;
}

interface IProjectEditorState {
  activeProjectItem: ProjectItem | null;
  tentativeProjectItem: ProjectItem | null;
  activeReference: IGitHubInfo | null;
  mode: ProjectEditorMode;
  forceRawView: boolean;
  filteredItems?: IAnnotatedValue[];
  searchFilter?: string;
  displayFileView: boolean;
  visualSeed?: number;
  viewMode: CartoEditorViewMode;
  menuState: ProjectEditorMenuState;
  effectMode?: ProjectEditorEffect;
  dragStyle?: ProjectEditorDragStyle;
  dialog?: ProjectEditorDialog;
  dialogData?: object | undefined;
  dialogActiveItem?: ProjectItem | undefined;
  statusAreaMode: ProjectStatusAreaMode;
  tab: ProjectEditorTab;
  allInfoSet: ProjectInfoSet;
  allInfoSetGenerated: boolean;
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

export enum ProjectEditorEffect {
  dragOver = 1,
}

export enum ProjectEditorDragStyle {
  addOverwrite = 0,
  addOverwriteOrActiveItem = 1,
}

export enum ProjectEditorDialog {
  noDialog = 0,
  shareableLink = 1,
  worldSettings = 2,
  webLocalDeploy = 3,
  convertTo = 4,
  integrateItem = 5,
}

export enum ProjectStatusAreaMode {
  minimized = 0,
  expanded = 1,
  hidden = 10,
}

export default class ProjectEditor extends Component<IProjectEditorProps, IProjectEditorState> {
  private _authWindow: Window | null = null;
  private _activeEditorPersistable?: IPersistable;
  private _isMountedInternal = false;
  private _lastHashProcessed: string | undefined;
  private gridElt: React.RefObject<HTMLDivElement>;
  private _splitterDrag: number | undefined;
  private _asyncLoadAttempts: number = 0;

  constructor(props: IProjectEditorProps) {
    super(props);

    this.gridElt = React.createRef();

    this.getProjectTitle = this.getProjectTitle.bind(this);

    this._handleExportMCAddonClick = this._handleExportMCAddonClick.bind(this);
    this._handleExportToLocalFolderClick = this._handleExportToLocalFolderClick.bind(this);
    this._handleConvertToClick = this._handleConvertToClick.bind(this);
    this._handleDialogDataUpdated = this._handleDialogDataUpdated.bind(this);
    this._handleGetShareableLinkClick = this._handleGetShareableLinkClick.bind(this);
    this._handleChangeWorldSettingsClick = this._handleChangeWorldSettingsClick.bind(this);
    this._handleDownloadMCWorldWithPacks = this._handleDownloadMCWorldWithPacks.bind(this);
    this._handleDeployDownloadWorldWithPacks = this._handleDeployDownloadWorldWithPacks.bind(this);
    this._handleDeployDownloadEditorWorldWithPacks = this._handleDeployDownloadEditorWorldWithPacks.bind(this);
    this._handleExportMCWorldWithPackRefs = this._handleExportMCWorldWithPackRefs.bind(this);
    this._handleDownloadFlatWorldWithPacks = this._handleDownloadFlatWorldWithPacks.bind(this);
    this._handleProjectWorldSettingsChanged = this._handleProjectWorldSettingsChanged.bind(this);
    this._handleExportFlatWorldWithPackRefs = this._handleExportFlatWorldWithPackRefs.bind(this);
    this._handleHashChange = this._handleHashChange.bind(this);
    this._setProjectStatusMode = this._setProjectStatusMode.bind(this);
    this._doUpdate = this._doUpdate.bind(this);
    this._handleInfoItemCommand = this._handleInfoItemCommand.bind(this);
    this._handleDialogDone = this._handleDialogDone.bind(this);
    this._handleFilterTextChanged = this._handleFilterTextChanged.bind(this);

    this._showMinecraftClick = this._showMinecraftClick.bind(this);
    this._showSettingsClick = this._showSettingsClick.bind(this);
    this._handleHomeClick = this._handleHomeClick.bind(this);
    this._handleVscAddClick = this._handleVscAddClick.bind(this);
    this._handleSaveClick = this._handleSaveClick.bind(this);
    this._viewAsFiles = this._viewAsFiles.bind(this);
    this._viewAsFilesImpl = this._viewAsFilesImpl.bind(this);
    this._onNotifyNewAllItemSetLoaded = this._onNotifyNewAllItemSetLoaded.bind(this);

    this._viewAsItems = this._viewAsItems.bind(this);
    this._viewAsItemsImpl = this._viewAsItemsImpl.bind(this);

    this._handleOuterMouseMove = this._handleOuterMouseMove.bind(this);
    this._handleOuterMouseOutOrUp = this._handleOuterMouseOutOrUp.bind(this);

    this._handleSplitterDrag = this._handleSplitterDrag.bind(this);
    this._openInExplorerClick = this._openInExplorerClick.bind(this);
    this._handleExportMenuOpen = this._handleExportMenuOpen.bind(this);
    this._handleDeployMenuOpen = this._handleDeployMenuOpen.bind(this);
    this._handleViewMenuOpen = this._handleViewMenuOpen.bind(this);
    this._handleConvertOK = this._handleConvertOK.bind(this);
    this._handleIntegrateItemOK = this._handleIntegrateItemOK.bind(this);
    this._handleDeployWorldAndTestAssetsPackClick = this._handleDeployWorldAndTestAssetsPackClick.bind(this);
    this._handleDeployWorldAndTestAssetsLocalClick = this._handleDeployWorldAndTestAssetsLocalClick.bind(this);
    this._handleDeployWorldPackClick = this._handleDeployWorldPackClick.bind(this);
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
    this._handleFileSelected = this._handleFileSelected.bind(this);
    this._handleFileDrop = this._handleFileDrop.bind(this);
    this._handleFileDragOut = this._handleFileDragOut.bind(this);
    this._handleFileDragOver = this._handleFileDragOver.bind(this);
    this._handleModeChangeRequested = this._handleModeChangeRequested.bind(this);
    this._handleActionRequested = this._handleActionRequested.bind(this);
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
    this._setActiveEditorPersistable = this._setActiveEditorPersistable.bind(this);
    this._handleDownloadMCWorld = this._handleDownloadMCWorld.bind(this);
    this._handleEditCopyClick = this._handleEditCopyClick.bind(this);
    this._serverStateChanged = this._serverStateChanged.bind(this);
    this._doAsyncLoading = this._doAsyncLoading.bind(this);

    this.save = this.save.bind(this);

    if (window.location.hash && window.location.hash.length > 0) {
      const state = this._getStateFromUrl();

      if (state) {
        this.state = state;
      }
    }

    if (!this.state) {
      this.state = this._getDefaultState();
    }

    this._connectToProps();
  }

  _getDefaultState(): IProjectEditorState {
    let sam = this.props.statusAreaMode;

    if (!sam) {
      sam = ProjectStatusAreaMode.minimized;
    }

    let initialMode = ProjectEditorMode.actions;
    let initialItem: ProjectItem | null = null;

    let viewMode = this.props.carto.editorViewMode;

    if (this.props.viewMode) {
      viewMode = this.props.viewMode;
    }

    for (let i = 0; i < this.props.project.items.length; i++) {
      const projectItem = this.props.project.items[i];

      if (projectItem.itemType === ProjectItemType.ts && projectItem.name === "ScriptBox.ts") {
        initialItem = projectItem;
        initialMode = ProjectEditorMode.activeItem;
      } else if (initialItem === null) {
        if (this.props.selectedItem && projectItem.projectPath) {
          const canonSelectedItem = StorageUtilities.canonicalizePathAsFileName(this.props.selectedItem);
          const canonCompare = StorageUtilities.canonicalizePathAsFileName(projectItem.projectPath);

          if (
            projectItem.projectPath === this.props.selectedItem ||
            (projectItem.projectPath && canonCompare === canonSelectedItem)
          ) {
            initialItem = projectItem;
            initialMode = ProjectEditorMode.activeItem;
          }
        }
      }
    }

    if (this.props.mode) {
      initialMode = this.props.mode;
    }

    return {
      activeProjectItem: initialItem,
      tentativeProjectItem: null,
      activeReference: null,
      mode: initialMode,
      visualSeed: 0 + (this.props.visualSeed ? this.props.visualSeed : 0),
      allInfoSet: this.props.project.infoSet,
      allInfoSetGenerated: this.props.project.infoSet.completedGeneration,
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

  private _handleHashChange() {
    const result = this._getStateFromUrl();

    if (result && this._isMountedInternal) {
      this.setState(result);
    }
  }

  private _getStateFromUrl(): IProjectEditorState | undefined {
    const hash = window.location.hash;

    if (hash === "" && !this._lastHashProcessed) {
      this._lastHashProcessed = hash;
      return;
    }

    if (hash !== this._lastHashProcessed) {
      this._lastHashProcessed = hash;

      if (hash === "") {
        const defaultState = this._getDefaultState();

        if (defaultState) {
          defaultState.lastDeployData = this.state.lastDeployData;
          defaultState.lastDeployFunction = this.state.lastDeployFunction;
          defaultState.lastDeployKey = this.state.lastDeployKey;
          defaultState.lastExportData = this.state.lastExportData;
          defaultState.lastExportFunction = this.state.lastExportFunction;
          defaultState.lastExportKey = this.state.lastExportKey;
          defaultState.statusAreaMode = this.state.statusAreaMode;

          this.setState(defaultState);
        }
      }
      const firstProjectEditor = hash.indexOf("#");

      if (firstProjectEditor >= 0 && firstProjectEditor < 4) {
        const commandToken = hash.substring(firstProjectEditor + 1);

        // const commandData = hash.substring(firstSlash + 1, hash.length);
        let state = this.state;

        if (state === undefined) {
          state = this._getDefaultState();
        }

        if (commandToken.startsWith("/")) {
          const path = ProjectEditorUtilities.convertStoragePathFromBrowserSafe(commandToken);
          const projectItem = this.props.project.getItemByProjectPath(path);

          if (projectItem) {
            let viewMode = state.viewMode;

            if (viewMode === CartoEditorViewMode.itemsFocus) {
              viewMode = CartoEditorViewMode.mainFocus;
            }

            return {
              activeProjectItem: projectItem,
              tentativeProjectItem: state.tentativeProjectItem,
              activeReference: null,
              mode: ProjectEditorMode.activeItem,
              viewMode: viewMode,
              menuState: state.menuState,
              allInfoSet: this.props.project.infoSet,
              allInfoSetGenerated: this.props.project.infoSet.completedGeneration,
              tab: state.tab,
              forceRawView: state.forceRawView,
              filteredItems: state.filteredItems,
              searchFilter: state.searchFilter,
              statusAreaMode: state.statusAreaMode,
              displayFileView: state.displayFileView,
              lastDeployKey: state.lastDeployKey,
              lastExportKey: state.lastExportKey,
              lastDeployFunction: state.lastDeployFunction,
              lastExportFunction: state.lastExportFunction,
              lastDeployData: state.lastDeployData,
              lastExportData: state.lastExportData,
            };
          }
        } else {
          for (let i = 0; i < MaxModeActions; i++) {
            if (commandToken === ProjectEditorUtilities.getProjectEditorModeString(i)) {
              return {
                activeProjectItem: null,
                tentativeProjectItem: state.tentativeProjectItem,
                activeReference: null,
                mode: i,
                viewMode: state.viewMode,
                menuState: state.menuState,
                allInfoSet: this.props.project.infoSet,
                allInfoSetGenerated: this.props.project.infoSet.completedGeneration,
                tab: state.tab,
                forceRawView: state.forceRawView,
                filteredItems: state.filteredItems,
                searchFilter: state.searchFilter,
                statusAreaMode: state.statusAreaMode,
                displayFileView: state.displayFileView,
                lastDeployKey: state.lastDeployKey,
                lastExportKey: state.lastExportKey,
                lastDeployFunction: state.lastDeployFunction,
                lastExportFunction: state.lastExportFunction,
                lastDeployData: state.lastDeployData,
                lastExportData: state.lastExportData,
              };
            }
          }
        }
      }
    }

    return undefined;
  }

  async _doAsyncLoading() {
    if (this._isMountedInternal && this.state) {
      if (!this.state.allInfoSet || !this.state.allInfoSet.completedGeneration) {
        await this.props.project.infoSet.generateForProject(false);
        this._onNotifyNewAllItemSetLoaded();
      }
    } else if (this._asyncLoadAttempts < 5) {
      window.setTimeout(this._doAsyncLoading, 500);
      this._asyncLoadAttempts++;
    }
  }

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
          tentativeProjectItem: this.state.tentativeProjectItem,
          activeReference: this.state.activeReference,
          mode: this.state.mode,
          effectMode: undefined,
          dragStyle: undefined,
          visualSeed: this.state.visualSeed ? this.state.visualSeed + 1 : 1,
          viewMode: this.state.viewMode,
          allInfoSet: this.props.project.infoSet,
          allInfoSetGenerated: this.props.project.infoSet.completedGeneration,
          displayFileView: this.state.displayFileView,
          menuState: this.state.menuState,
          forceRawView: this.state.forceRawView,
          filteredItems: this.state.filteredItems,
          searchFilter: this.state.searchFilter,
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

  private _incrementVisualSeed() {
    if (this.state !== undefined) {
      this.setState({
        activeProjectItem: this.state.activeProjectItem,
        tentativeProjectItem: this.state.tentativeProjectItem,
        activeReference: this.state.activeReference,
        mode: this.state.mode,
        effectMode: undefined,
        dragStyle: undefined,
        visualSeed: this.state.visualSeed ? this.state.visualSeed + 1 : 1,
        viewMode: this.state.viewMode,
        allInfoSet: this.props.project.infoSet,
        allInfoSetGenerated: this.props.project.infoSet.completedGeneration,
        displayFileView: this.state.displayFileView,
        menuState: this.state.menuState,
        forceRawView: this.state.forceRawView,
        filteredItems: this.state.filteredItems,
        searchFilter: this.state.searchFilter,
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

  private _onNotifyNewAllItemSetLoaded() {
    if (this.state) {
      if (
        this.state.allInfoSet !== this.props.project.infoSet ||
        this.state.allInfoSetGenerated !== this.props.project.infoSet.completedGeneration
      ) {
        this.setState({
          activeProjectItem: this.state.activeProjectItem,
          tentativeProjectItem: this.state.tentativeProjectItem,
          activeReference: this.state.activeReference,
          mode: this.state.mode,
          effectMode: this.state.effectMode,
          dragStyle: this.state.dragStyle,
          visualSeed: this.state.visualSeed,
          viewMode: this.state.viewMode,
          allInfoSet: this.props.project.infoSet,
          allInfoSetGenerated: this.props.project.infoSet.completedGeneration,
          displayFileView: this.state.displayFileView,
          menuState: this.state.menuState,
          forceRawView: this.state.forceRawView,
          filteredItems: this.state.filteredItems,
          searchFilter: this.state.searchFilter,
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
        tentativeProjectItem: this.state.tentativeProjectItem,
        activeReference: this.state.activeReference,
        mode: this.state.mode,
        effectMode: undefined,
        dragStyle: undefined,
        dialog: undefined,
        dialogData: this.state.dialogData,
        dialogActiveItem: this.state.dialogActiveItem,
        viewMode: this.state.viewMode,
        allInfoSet: this.props.project.infoSet,
        allInfoSetGenerated: this.props.project.infoSet.completedGeneration,
        displayFileView: this.state.displayFileView,
        menuState: this.state.menuState,
        forceRawView: this.state.forceRawView,
        filteredItems: this.state.filteredItems,
        searchFilter: this.state.searchFilter,
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

  private async _handleIntegrateItemOK() {
    this._handleDialogDone();

    if (this.state.dialogData) {
      const fileSource = (this.state.dialogData as IProjectItemSeed).fileSource;

      if (fileSource) {
        if ((this.state.dialogData as IProjectItemSeed).action === ProjectItemSeedAction.defaultAction) {
          ProjectEditorUtilities.integrateBrowserFileDefaultAction(
            this.props.project,
            "/" + fileSource.name,
            fileSource
          );
        } else if ((this.state.dialogData as IProjectItemSeed).action === ProjectItemSeedAction.overwriteFile) {
          const item = (this.state.dialogData as IProjectItemSeed).targetedItem;

          if (item && item.file) {
            let content = undefined;

            if (StorageUtilities.getEncodingByFileName(fileSource.name) === EncodingType.Utf8String) {
              content = await fileSource.text();
            } else {
              content = new Uint8Array(await fileSource.arrayBuffer());
            }

            item.file.setContent(content);
          }
          this._incrementVisualSeed();
        }
      }
    }
  }

  private async _handleConvertOK() {
    this._handleDialogDone();

    if (this.state.dialogData && this.state.dialogActiveItem) {
      let mcworld: MCWorld | undefined = await MCWorld.ensureOnItem(this.state.dialogActiveItem);

      if (mcworld) {
        await ProjectExporter.convertWorld(
          this.props.carto,
          this.props.project,
          this.state.dialogData as IConversionSettings,
          mcworld
        );
      }
    }
  }

  private _handleFileDragOver(event: DragEvent) {
    if (this.state !== undefined) {
      if (this.state.effectMode !== ProjectEditorEffect.dragOver) {
        const top = event.pageY;
        const left = event.pageX;
        const right = document.body.clientWidth - left;
        const bottom = document.body.clientHeight - top;

        if (top > 10 && right > 10 && bottom > 10 && left > 10) {
          let dragStyle = ProjectEditorDragStyle.addOverwrite;

          if (
            this.state.activeProjectItem &&
            this.state.activeProjectItem.storageType === ProjectItemStorageType.singleFile &&
            event &&
            event.dataTransfer &&
            event.dataTransfer.items &&
            event.dataTransfer.items.length === 1
          ) {
            const dtitem = event.dataTransfer.items[0];

            if (ProjectItemUtilities.getMimeTypes(this.state.activeProjectItem).includes(dtitem.type)) {
              dragStyle = ProjectEditorDragStyle.addOverwriteOrActiveItem;
            }
          }

          this.setState({
            activeProjectItem: this.state.activeProjectItem,
            tentativeProjectItem: this.state.tentativeProjectItem,
            activeReference: this.state.activeReference,
            menuState: this.state.menuState,
            mode: this.state.mode,
            viewMode: this.state.viewMode,
            allInfoSet: this.props.project.infoSet,
            allInfoSetGenerated: this.props.project.infoSet.completedGeneration,
            displayFileView: this.state.displayFileView,
            forceRawView: this.state.forceRawView,
            filteredItems: this.state.filteredItems,
            searchFilter: this.state.searchFilter,
            effectMode: ProjectEditorEffect.dragOver,
            dragStyle: dragStyle,
            visualSeed: this.state.visualSeed,
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
      window.addEventListener("hashchange", this._handleHashChange, false);

      window.addEventListener("resize", this._doUpdate);
      window.addEventListener("keydown", this._handleKeyDown);
      window.addEventListener("keyup", this._handleKeyUp);
    }

    this._isMountedInternal = true;

    window.setTimeout(this._doAsyncLoading, 2000);
  }

  componentWillUnmount() {
    if (typeof window !== "undefined") {
      window.document.removeEventListener("dragleave", this._handleFileDragOut);
      window.document.body.removeEventListener("dragover", this._handleFileDragOver);
      window.document.body.removeEventListener("drop", this._handleFileDrop);
      window.removeEventListener("hashchange", this._handleHashChange, false);

      window.removeEventListener("resize", this._doUpdate);
      window.removeEventListener("keydown", this._handleKeyDown);
      window.removeEventListener("keyup", this._handleKeyUp);
    }
    this._isMountedInternal = false;
  }

  private _handleOuterMouseMove(ev: React.MouseEvent<HTMLDivElement>) {
    if (
      (this.state && this._splitterDrag === undefined) ||
      this.gridElt === undefined ||
      this.gridElt.current === undefined ||
      this.gridElt.current === null
    ) {
      return;
    }

    let width = this.getAdjustedWidth(ev);
    this.props.carto.itemSidePaneWidth = width;

    this.gridElt.current.style.gridTemplateColumns = this.getGridColumnWidths();
  }

  private getAdjustedWidth(ev: React.MouseEvent<HTMLDivElement>) {
    let width = ev.pageX;

    if (
      this.state.viewMode === CartoEditorViewMode.itemsOnRightAndMinecraftToolbox ||
      this.state.viewMode === CartoEditorViewMode.itemsOnRight
    ) {
      const browserWidth = WebUtilities.getWidth();

      width = browserWidth - width;
    }

    if (width < SidePaneMinWidth) {
      return SidePaneMinWidth;
    }
    if (width > SidePaneMaxWidth) {
      return SidePaneMaxWidth;
    }

    return width;
  }

  private _handleOuterMouseOutOrUp(ev: React.MouseEvent<HTMLDivElement>) {
    if (this._splitterDrag === undefined) {
      return;
    }

    const width = this.getAdjustedWidth(ev);

    this.props.carto.itemSidePaneWidth = width;
    this.props.carto.save();

    this._splitterDrag = undefined;
  }

  private _handleSplitterDrag(ev: React.MouseEvent<HTMLDivElement>) {
    this._splitterDrag = ev.pageX;
    if (this.gridElt && this.gridElt.current) {
      this.gridElt.current.style.gridTemplateColumns = this.getGridColumnWidths();
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
      for (var i = 0; i < ev.dataTransfer.items.length; i++) {
        const dtitem = ev.dataTransfer.items[i];

        let entry: any | undefined;

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
            let content = undefined;

            if (StorageUtilities.getEncodingByFileName(file.name) === EncodingType.Utf8String) {
              content = await file.text();
            } else {
              content = new Uint8Array(await file.arrayBuffer());
            }

            const typeData = ProjectItemUtilities.inferTypeFromContent(content, file.name);

            if (this.state.dragStyle === ProjectEditorDragStyle.addOverwriteOrActiveItem) {
              const top = ev.pageY;

              const height = WebUtilities.getHeight();

              if (top > height / 2 && this.state.activeProjectItem && this.state.activeProjectItem.file) {
                this.state.activeProjectItem.file.setContent(content);

                this._stopDragEffect();

                return;
              }
            }
            this.setState({
              activeProjectItem: this.state.activeProjectItem,
              tentativeProjectItem: this.state.tentativeProjectItem,
              activeReference: this.state.activeReference,
              menuState: this.state.menuState,
              mode: this.state.mode,
              viewMode: this.state.viewMode,
              allInfoSet: this.props.project.infoSet,
              allInfoSetGenerated: this.props.project.infoSet.completedGeneration,
              displayFileView: this.state.displayFileView,
              forceRawView: this.state.forceRawView,
              filteredItems: this.state.filteredItems,
              searchFilter: this.state.searchFilter,
              effectMode: undefined,
              dragStyle: undefined,
              visualSeed: this.state.visualSeed,
              dialog: ProjectEditorDialog.integrateItem,
              dialogActiveItem: this.state.activeProjectItem ? this.state.activeProjectItem : undefined,
              dialogData: { itemType: typeData.itemType, path: file.name, fileSource: file },
              statusAreaMode: this.state.statusAreaMode,
              lastDeployKey: this.state.lastDeployKey,
              lastExportKey: this.state.lastExportKey,
              lastDeployFunction: this.state.lastDeployFunction,
              lastExportFunction: this.state.lastExportFunction,
              lastDeployData: this.state.lastDeployData,
              lastExportData: this.state.lastExportData,
            });

            return;
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

  private async _processIncomingFile(path: string, file: File) {
    if (file != null && this.props.project != null && this.props.project.projectFolder != null) {
      await ProjectEditorUtilities.integrateBrowserFileDefaultAction(this.props.project, path, file);

      this.forceUpdate();
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
      tentativeProjectItem: this.state.tentativeProjectItem,
      mode: this.state.mode,
      viewMode: newViewMode,
      menuState: ProjectEditorMenuState.noMenu,
      statusAreaMode: this.state.statusAreaMode,
      lastDeployKey: this.state.lastDeployKey,
      displayFileView: this.state.displayFileView,
      dialog: this.state.dialog,
      dialogData: this.state.dialogData,
      dialogActiveItem: this.state.dialogActiveItem,
      forceRawView: this.state.forceRawView,
      filteredItems: this.state.filteredItems,
      searchFilter: this.state.searchFilter,
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
      tentativeProjectItem: this.state.tentativeProjectItem,
      mode: this.state.mode,
      viewMode: this.state.viewMode,
      menuState: this.state.menuState,
      statusAreaMode: this.state.statusAreaMode,
      lastDeployKey: deployKey,
      dialog: this.state.dialog,
      dialogData: this.state.dialogData,
      dialogActiveItem: this.state.dialogActiveItem,
      forceRawView: this.state.forceRawView,
      filteredItems: this.state.filteredItems,
      searchFilter: this.state.searchFilter,
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
      tentativeProjectItem: this.state.tentativeProjectItem,
      mode: this.state.mode,
      viewMode: this.state.viewMode,
      menuState: this.state.menuState,
      statusAreaMode: this.state.statusAreaMode,
      lastDeployKey: this.state.lastDeployKey,
      forceRawView: this.state.forceRawView,
      filteredItems: this.state.filteredItems,
      searchFilter: this.state.searchFilter,
      dialog: this.state.dialog,
      dialogData: this.state.dialogData,
      dialogActiveItem: this.state.dialogActiveItem,
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
      tentativeProjectItem: this.state.tentativeProjectItem,
      mode: this.state.mode,
      viewMode: newViewMode,
      menuState: ProjectEditorMenuState.noMenu,
      statusAreaMode: this.state.statusAreaMode,
      lastDeployKey: this.state.lastDeployKey,
      displayFileView: this.state.displayFileView,
      dialog: this.state.dialog,
      dialogData: this.state.dialogData,
      dialogActiveItem: this.state.dialogActiveItem,
      forceRawView: this.state.forceRawView,
      filteredItems: this.state.filteredItems,
      searchFilter: this.state.searchFilter,
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
      tentativeProjectItem: this.state.tentativeProjectItem,
      mode: this.state.mode,
      viewMode: this.state.viewMode,
      menuState: ProjectEditorMenuState.noMenu,
      statusAreaMode: this.state.statusAreaMode,
      lastDeployKey: this.state.lastDeployKey,
      displayFileView: false,
      forceRawView: this.state.forceRawView,
      filteredItems: this.state.filteredItems,
      searchFilter: this.state.searchFilter,
      dialog: this.state.dialog,
      dialogData: this.state.dialogData,
      dialogActiveItem: this.state.dialogActiveItem,
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
      tentativeProjectItem: this.state.tentativeProjectItem,
      mode: this.state.mode,
      viewMode: this.state.viewMode,
      menuState: ProjectEditorMenuState.noMenu,
      statusAreaMode: this.state.statusAreaMode,
      lastDeployKey: this.state.lastDeployKey,
      displayFileView: true,
      forceRawView: this.state.forceRawView,
      filteredItems: this.state.filteredItems,
      searchFilter: this.state.searchFilter,
      dialog: this.state.dialog,
      dialogData: this.state.dialogData,
      dialogActiveItem: this.state.dialogActiveItem,
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
      tentativeProjectItem: this.state.tentativeProjectItem,
      mode: this.state.mode,
      viewMode: newViewMode,
      menuState: ProjectEditorMenuState.noMenu,
      statusAreaMode: this.state.statusAreaMode,
      forceRawView: this.state.forceRawView,
      filteredItems: this.state.filteredItems,
      searchFilter: this.state.searchFilter,
      displayFileView: this.state.displayFileView,
      lastDeployKey: this.state.lastDeployKey,
      dialog: this.state.dialog,
      dialogData: this.state.dialogData,
      dialogActiveItem: this.state.dialogActiveItem,
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
      tentativeProjectItem: this.state.tentativeProjectItem,
      mode: this.state.mode,
      viewMode: newViewMode,
      menuState: ProjectEditorMenuState.noMenu,
      statusAreaMode: this.state.statusAreaMode,
      displayFileView: this.state.displayFileView,
      forceRawView: this.state.forceRawView,
      filteredItems: this.state.filteredItems,
      searchFilter: this.state.searchFilter,
      lastDeployKey: this.state.lastDeployKey,
      dialog: this.state.dialog,
      dialogData: this.state.dialogData,
      dialogActiveItem: this.state.dialogActiveItem,
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
      tentativeProjectItem: this.state.tentativeProjectItem,
      mode: ProjectEditorMode.minecraft,
      viewMode: nextViewMode,
      menuState: ProjectEditorMenuState.noMenu,
      statusAreaMode: this.state.statusAreaMode,
      lastDeployKey: this.state.lastDeployKey,
      displayFileView: this.state.displayFileView,
      lastExportKey: this.state.lastExportKey,
      dialog: this.state.dialog,
      dialogData: this.state.dialogData,
      dialogActiveItem: this.state.dialogActiveItem,
      forceRawView: this.state.forceRawView,
      filteredItems: this.state.filteredItems,
      searchFilter: this.state.searchFilter,
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
      tentativeProjectItem: this.state.tentativeProjectItem,
      mode: ProjectEditorMode.cartoSettings,
      viewMode: newViewMode,
      menuState: ProjectEditorMenuState.noMenu,
      statusAreaMode: this.state.statusAreaMode,
      displayFileView: this.state.displayFileView,
      lastDeployKey: this.state.lastDeployKey,
      forceRawView: this.state.forceRawView,
      filteredItems: this.state.filteredItems,
      searchFilter: this.state.searchFilter,
      dialog: this.state.dialog,
      dialogData: this.state.dialogData,
      dialogActiveItem: this.state.dialogActiveItem,
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
      tentativeProjectItem: this.state.tentativeProjectItem,
      mode: this.state.mode,
      viewMode: this.state.viewMode,
      menuState: menuVal,
      forceRawView: this.state.forceRawView,
      filteredItems: this.state.filteredItems,
      searchFilter: this.state.searchFilter,
      displayFileView: this.state.displayFileView,
      statusAreaMode: this.state.statusAreaMode,
      lastDeployKey: this.state.lastDeployKey,
      dialog: this.state.dialog,
      dialogData: this.state.dialogData,
      dialogActiveItem: this.state.dialogActiveItem,
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
      tentativeProjectItem: this.state.tentativeProjectItem,
      mode: this.state.mode,
      viewMode: this.state.viewMode,
      menuState: menuVal,
      forceRawView: this.state.forceRawView,
      filteredItems: this.state.filteredItems,
      searchFilter: this.state.searchFilter,
      displayFileView: this.state.displayFileView,
      statusAreaMode: this.state.statusAreaMode,
      lastDeployKey: this.state.lastDeployKey,
      dialog: this.state.dialog,
      dialogData: this.state.dialogData,
      dialogActiveItem: this.state.dialogActiveItem,
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
      tentativeProjectItem: this.state.tentativeProjectItem,
      mode: this.state.mode,
      viewMode: this.state.viewMode,
      menuState: menuVal,
      forceRawView: this.state.forceRawView,
      filteredItems: this.state.filteredItems,
      searchFilter: this.state.searchFilter,
      displayFileView: this.state.displayFileView,
      statusAreaMode: this.state.statusAreaMode,
      lastDeployKey: this.state.lastDeployKey,
      dialog: this.state.dialog,
      dialogData: this.state.dialogData,
      dialogActiveItem: this.state.dialogActiveItem,
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
        tentativeProjectItem: this.state.tentativeProjectItem,
        activeReference: this.state.activeReference,
        menuState: this.state.menuState,
        mode: this.state.mode,
        viewMode: this.state.viewMode,
        allInfoSet: this.props.project.infoSet,
        allInfoSetGenerated: this.props.project.infoSet.completedGeneration,
        displayFileView: this.state.displayFileView,
        forceRawView: this.state.forceRawView,
        filteredItems: this.state.filteredItems,
        searchFilter: this.state.searchFilter,
        effectMode: this.state.effectMode,
        dragStyle: this.state.dragStyle,
        visualSeed: this.state.visualSeed,
        dialog: ProjectEditorDialog.shareableLink,
        dialogData: this.state.dialogData,
        dialogActiveItem: this.state.dialogActiveItem,
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
  private async _handleChangeWorldSettingsClick(e: SyntheticEvent | undefined, data: MenuItemProps | undefined) {
    if (this.props.project == null || !data || !data.icon) {
      return;
    }

    this.showWorldProjectSettingsDialog();
  }

  private showWorldProjectSettingsDialog() {
    window.setTimeout(() => {
      this.setState({
        activeProjectItem: this.state.activeProjectItem,
        tentativeProjectItem: this.state.tentativeProjectItem,
        activeReference: this.state.activeReference,
        menuState: this.state.menuState,
        mode: this.state.mode,
        viewMode: this.state.viewMode,
        allInfoSet: this.props.project.infoSet,
        allInfoSetGenerated: this.props.project.infoSet.completedGeneration,
        displayFileView: this.state.displayFileView,
        forceRawView: this.state.forceRawView,
        filteredItems: this.state.filteredItems,
        searchFilter: this.state.searchFilter,
        effectMode: this.state.effectMode,
        dragStyle: this.state.dragStyle,
        visualSeed: this.state.visualSeed,
        dialog: ProjectEditorDialog.worldSettings,
        dialogData: this.state.dialogData,
        dialogActiveItem: this.state.dialogActiveItem,
        statusAreaMode: this.state.statusAreaMode,
        lastDeployKey: this.state.lastDeployKey,
        lastExportKey: this.state.lastExportKey,
        lastDeployFunction: this.state.lastDeployFunction,
        lastExportFunction: this.state.lastExportFunction,
        lastDeployData: this.state.lastDeployData,
        lastExportData: this.state.lastExportData,
      });
    }, 2);
  }

  private async _handleExportMCAddonClick(e: SyntheticEvent | undefined, data: MenuItemProps | undefined) {
    if (this.props.project == null) {
      return;
    }

    await this._ensurePersisted();

    const projName = await this.props.project.loc.getTokenValue(this.props.project.name);

    const operId = await this.props.carto.notifyOperationStarted("Exporting '" + projName + "' as MCAddon");

    const zipBinary = (await ProjectExporter.generateMCAddonAsZip(this.props.carto, this.props.project, true)) as Blob;

    await this.props.carto.notifyOperationEnded(operId, "Export MCPack of '" + projName + "' created; downloading");

    saveAs(zipBinary, projName + ".mcaddon");

    if (data && data.icon && (data.icon as any).key) {
      this._setNewExportKey((data.icon as any).key, this._handleExportMCAddonClick, data);
    }
  }

  private async _handleExportToLocalFolderClick(e: SyntheticEvent | undefined, data: MenuItemProps | undefined) {
    await this._ensurePersisted();

    await ProjectEditorUtilities.launchLocalExport(this.props.carto, this.props.project);

    if (data && data.icon && (data.icon as any).key) {
      this._setNewExportKey((data.icon as any).key, this._handleExportToLocalFolderClick, data);
    }
  }

  private async _handleConvertToClick(e: SyntheticEvent | undefined, data: MenuItemProps | undefined) {
    if (data === undefined || typeof data.content !== "string") {
      return;
    }

    const projectItem = this._getProjectItemFromName(data.content, "conversion...", [
      ProjectItemType.MCWorld,
      ProjectItemType.MCProject,
      ProjectItemType.MCTemplate,
      ProjectItemType.worldFolder,
    ]);

    if (projectItem) {
      window.setTimeout(() => {
        this.setState({
          activeProjectItem: this.state.activeProjectItem,
          tentativeProjectItem: this.state.tentativeProjectItem,
          activeReference: this.state.activeReference,
          menuState: this.state.menuState,
          mode: this.state.mode,
          viewMode: this.state.viewMode,
          allInfoSet: this.props.project.infoSet,
          allInfoSetGenerated: this.props.project.infoSet.completedGeneration,
          displayFileView: this.state.displayFileView,
          forceRawView: this.state.forceRawView,
          filteredItems: this.state.filteredItems,
          searchFilter: this.state.searchFilter,
          effectMode: this.state.effectMode,
          dragStyle: this.state.dragStyle,
          visualSeed: this.state.visualSeed,
          dialog: ProjectEditorDialog.convertTo,
          dialogActiveItem: projectItem,
          dialogData: {
            name: this.props.project.name + " Java",
          },
          statusAreaMode: this.state.statusAreaMode,
          lastDeployKey: this.state.lastDeployKey,
          lastExportKey: (data.icon as any).key,
          lastDeployFunction: this.state.lastDeployFunction,
          lastExportFunction: this._handleConvertToClick,
          lastDeployData: this.state.lastDeployData,
          lastExportData: this.state.lastExportData,
        });
      }, 2);
    }

    if (data && data.icon && (data.icon as any).key) {
      this._setNewExportKey((data.icon as any).key, this._handleConvertToClick, data);
    }
  }

  private async _handleExportZipClick(e: SyntheticEvent | undefined, data: MenuItemProps | undefined) {
    await this._ensurePersisted();

    await ProjectEditorUtilities.launchZipExport(this.props.carto, this.props.project);

    if (data && data.icon && (data.icon as any).key) {
      this._setNewExportKey((data.icon as any).key, this._handleExportZipClick, data);
    }
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

    this.props.carto.ensureRemoteMinecraft();

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

    this.props.carto.ensureGameMinecraft();

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

    const projName = await this.props.project.loc.getTokenValue(this.props.project.name);

    const operId = await this.props.carto.notifyOperationStarted(
      "Export deployment zip of '" + projName + "' created; downloading"
    );

    await this._ensurePersisted();

    this.props.carto.save();

    await this.props.project.save();

    if (this.props.carto.deployBehaviorPacksFolder) {
      const result = await ProjectExporter.deployProject(
        this.props.carto,
        this.props.project,
        this.props.carto.deploymentStorage.rootFolder
      );

      if (!result) {
        await this.props.carto.notifyOperationEnded(operId);

        return;
      }
    }

    let zipStorage: ZipStorage | undefined;

    zipStorage = new ZipStorage();

    const deployFolder = this.props.carto.deploymentStorage.rootFolder;

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
      this._setNewExportKey((data.icon as any).key, this._handleExportDeploymentZipClick, data);
    }
  }

  _handleProjectWorldSettingsChanged(worldSettings: IWorldSettings) {
    if (!this.props.project) {
      return;
    }

    this.props.project.save();
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
      const result = await ProjectExporter.deployProject(
        this.props.carto,
        this.props.project,
        this.props.carto.deploymentStorage.rootFolder
      );

      if (!result) {
        await this.props.carto.notifyOperationEnded(operId);

        return;
      }
    }

    let zipStorage: ZipStorage | undefined;

    zipStorage = new ZipStorage();

    const deployFolder = this.props.carto.deploymentStorage.rootFolder;

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

  private async _handleDeployWorldPackClick(e: SyntheticEvent | undefined, data: MenuItemProps | undefined) {
    if (data === undefined || typeof data.content !== "string") {
      return;
    }

    const projectItem = this._getProjectItemFromName(data.content, "mcworld", [
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

    const zipBytes = await ProjectExporter.deployAsWorld(this.props.carto, this.props.project, projectItem, true);

    const date = new Date();
    const downloadTitle = projectItem.name + " deployment - " + Utilities.getFriendlySummarySeconds(date);

    if (zipBytes instanceof Uint8Array) {
      saveAs(new Blob([zipBytes], { type: "application/octet-stream" }), downloadTitle + ".mcworld");
    }

    Log.message("Done saving " + projectItem.name, this.props.project.name);

    this.props.carto.notifyStatusUpdate("Downloading deployment zip '" + downloadTitle + ".mcworld'.");

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
  private async _handleActionRequested(action: ProjectEditorAction) {
    switch (action) {
      case ProjectEditorAction.worldPropertiesDialog:
        this.showWorldProjectSettingsDialog();
        break;
      case ProjectEditorAction.projectListUp:
        this.moveTentativeItem(-1);
        break;
      case ProjectEditorAction.projectListDown:
        this.moveTentativeItem(1);
        break;
      case ProjectEditorAction.projectListCommit:
        this.commitTentativeItem();
        break;
    }
  }

  private async _handleModeChangeRequested(newMode: ProjectEditorMode) {
    await this._ensurePersisted();

    this._activeEditorPersistable = undefined;

    this._setHash(ProjectEditorUtilities.getProjectEditorModeString(newMode));
    let newStateViewMode = this.state.viewMode;

    if (this.state.viewMode === CartoEditorViewMode.itemsFocus) {
      newStateViewMode = CartoEditorViewMode.mainFocus;
    }

    this.setState({
      activeProjectItem: this.state.activeProjectItem,
      tentativeProjectItem: this.state.tentativeProjectItem,
      menuState: this.state.menuState,
      viewMode: newStateViewMode,
      mode: newMode,
      forceRawView: this.state.forceRawView,
      filteredItems: this.state.filteredItems,
      searchFilter: this.state.searchFilter,
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

  private _handleDialogDataUpdated(dialogData: object | undefined) {
    this.setState({
      activeProjectItem: this.state.activeProjectItem,
      tentativeProjectItem: this.state.tentativeProjectItem,
      menuState: this.state.menuState,
      viewMode: this.state.viewMode,
      mode: this.state.mode,
      dialog: this.state.dialog,
      dialogData: dialogData,
      dialogActiveItem: this.state.dialogActiveItem,
      forceRawView: this.state.forceRawView,
      filteredItems: this.state.filteredItems,
      searchFilter: this.state.searchFilter,
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
      await this.saveAsBetaApisWorldWithPacks(projectItem.file.name, content);
    }

    this.props.carto.notifyStatusUpdate("Downloading mcworld with packs embedded '" + projectItem.file.name + "'.");

    if (data && data.icon && (data.icon as any).key) {
      this._setNewDeployKey((data.icon as any).key, this._handleDownloadMCWorldWithPacks, data);
    }
  }

  private async _handleDeployDownloadWorldWithPacks(e: SyntheticEvent | undefined, data: MenuItemProps | undefined) {
    if (data === undefined) {
      return;
    }

    await this._ensurePersisted();

    await ProjectEditorUtilities.launchWorldWithPacksDownload(this.props.carto, this.props.project);

    if (data && data.icon && (data.icon as any).key) {
      this._setNewDeployKey((data.icon as any).key, this._handleDeployDownloadWorldWithPacks, data);
    }
  }

  private async _handleDeployDownloadEditorWorldWithPacks(
    e: SyntheticEvent | undefined,
    data: MenuItemProps | undefined
  ) {
    if (data === undefined) {
      return;
    }

    await this._ensurePersisted();

    await ProjectEditorUtilities.launchEditorWorldWithPacksDownload(this.props.carto, this.props.project);

    if (data && data.icon && (data.icon as any).key) {
      this._setNewDeployKey((data.icon as any).key, this._handleDeployDownloadEditorWorldWithPacks, data);
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

  private async saveAsBetaApisWorldWithPacks(name: string, content: Uint8Array) {
    await this._ensurePersisted();

    const mcworld = await ProjectExporter.generateBetaApisWorldWithPacks(this.props.project, name, content);

    if (mcworld === undefined) {
      return;
    }

    const newBytes = await mcworld.getBytes();

    Log.message("About to save " + name, this.props.project.name);
    if (newBytes !== undefined) {
      saveAs(new Blob([newBytes], { type: "application/octet-stream" }), name);
    }
    Log.message("Done with save " + name, this.props.project.name, this.props.project.name);
  }

  private async saveAsWorldWithPackRefs(name: string, content: Uint8Array) {
    await this._ensurePersisted();

    const mcworld = await ProjectExporter.generateBetaApisWorldWithPackRefs(this.props.project, name, content);

    const newBytes = await mcworld.getBytes();

    if (newBytes !== undefined) {
      saveAs(new Blob([newBytes]), name);
    }
  }

  private async _handleExportFlatWorldWithPacks(e: SyntheticEvent | undefined, data: MenuItemProps | undefined) {
    await this._ensurePersisted();

    await ProjectEditorUtilities.launchFlatWorldWithPacksDownload(this.props.carto, this.props.project);

    if (data && data.icon && (data.icon as any).key) {
      this._setNewExportKey((data.icon as any).key, this._handleExportFlatWorldWithPacks, data);
    }
  }

  private async _handleDownloadFlatWorldWithPacks(e: SyntheticEvent | undefined, data: MenuItemProps | undefined) {
    await this._ensurePersisted();

    await ProjectEditorUtilities.launchFlatWorldWithPacksDownload(this.props.carto, this.props.project);

    if (data && data.icon && (data.icon as any).key) {
      this._setNewDeployKey((data.icon as any).key, this._handleDownloadFlatWorldWithPacks, data);
    }
  }

  private _handleFileSelected(file: IFile) {
    let pi = this.props.project.getItemByExtendedOrProjectPath(file.extendedPath);

    if (!pi && this.props.project.projectFolder) {
      const relativeFolderPath = file.getFolderRelativePath(this.props.project.projectFolder);

      if (relativeFolderPath) {
        let itemType = ProjectItemType.unknown;

        switch (file.type) {
          case "js":
            itemType = ProjectItemType.js;
            break;
          case "ts":
            itemType = ProjectItemType.ts;
            break;
          case "json":
            itemType = ProjectItemType.json;
            break;
        }

        if (itemType !== ProjectItemType.unknown) {
          let creationType = ProjectItemCreationType.normal;

          if (relativeFolderPath?.indexOf("generated") >= 0) {
            creationType = ProjectItemCreationType.generated;
          } else if (relativeFolderPath?.indexOf("/dist/") >= 0) {
            creationType = ProjectItemCreationType.dist;
          } else if (relativeFolderPath?.indexOf("/build/") >= 0) {
            creationType = ProjectItemCreationType.build;
          }

          pi = this.props.project.ensureItemByProjectPath(
            relativeFolderPath,
            ProjectItemStorageType.singleFile,
            file.name,
            itemType,
            undefined,
            creationType
          );
        }
      }
    }

    if (pi) {
      let newMode = this.state.mode;

      if (newMode !== ProjectEditorMode.activeItem) {
        newMode = ProjectEditorMode.activeItem;
      }

      let newStateViewMode = this.state.viewMode;

      if (this.state.viewMode === CartoEditorViewMode.itemsFocus) {
        newStateViewMode = CartoEditorViewMode.mainFocus;
      }

      this.setState({
        activeReference: this.state.activeReference,
        activeProjectItem: pi,
        tentativeProjectItem: this.state.tentativeProjectItem,
        mode: newMode,
        viewMode: newStateViewMode,
        allInfoSet: this.props.project.infoSet,
        allInfoSetGenerated: this.props.project.infoSet.completedGeneration,
        statusAreaMode: this.state.statusAreaMode,
        lastDeployKey: this.state.lastDeployKey,
        forceRawView: this.state.forceRawView,
        filteredItems: this.state.filteredItems,
        searchFilter: this.state.searchFilter,
        displayFileView: this.state.displayFileView,
        lastExportKey: this.state.lastExportKey,
        lastDeployFunction: this.state.lastDeployFunction,
        lastExportFunction: this.state.lastExportFunction,
        lastDeployData: this.state.lastDeployData,
        lastExportData: this.state.lastExportData,
      });
    }
  }

  private launchFlatButton() {
    ProjectEditorUtilities.launchFlatWorldWithPacksDownload(this.props.carto, this.props.project);
  }

  private _setProjectStatusMode(mode: ProjectStatusAreaMode) {
    this.setState({
      activeProjectItem: this.state.activeProjectItem,
      tentativeProjectItem: this.state.tentativeProjectItem,
      mode: this.state.mode,
      viewMode: this.state.viewMode,
      menuState: this.state.menuState,
      statusAreaMode: mode,
      displayFileView: this.state.displayFileView,
      forceRawView: this.state.forceRawView,
      filteredItems: this.state.filteredItems,
      searchFilter: this.state.searchFilter,
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

    const mcworld = await ProjectExporter.generateFlatGameTestWorldWithPackRefs(this.props.project, name);

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
      tentativeProjectItem: this.state.tentativeProjectItem,
      mode: newMode,
      viewMode: this.state.viewMode,
      allInfoSet: this.props.project.infoSet,
      allInfoSetGenerated: this.props.project.infoSet.completedGeneration,
      statusAreaMode: this.state.statusAreaMode,
      lastDeployKey: this.state.lastDeployKey,
      forceRawView: this.state.forceRawView,
      filteredItems: this.state.filteredItems,
      searchFilter: this.state.searchFilter,
      displayFileView: this.state.displayFileView,
      lastExportKey: this.state.lastExportKey,
      lastDeployFunction: this.state.lastDeployFunction,
      lastExportFunction: this.state.lastExportFunction,
      lastDeployData: this.state.lastDeployData,
      lastExportData: this.state.lastExportData,
    });
  }

  private _doUpdate() {
    this.forceUpdate();
  }

  private async _handleProjectItemSelected(newProjectItem: ProjectItem, forceRawView: boolean) {
    if (this.state.viewMode === CartoEditorViewMode.toolboxFocus) {
      if (this.props.onActiveProjectItemChangeRequested) {
        this.props.onActiveProjectItemChangeRequested(newProjectItem, forceRawView);
      }
    } else {
      let newMode = this.state.mode;

      if (newMode !== ProjectEditorMode.activeItem) {
        newMode = ProjectEditorMode.activeItem;
      }

      let newStateViewMode = this.state.viewMode;

      if (this.state.viewMode === CartoEditorViewMode.itemsFocus) {
        newStateViewMode = CartoEditorViewMode.mainFocus;
      }

      await this._ensurePersisted();

      if (this.state !== undefined && this.state.activeProjectItem !== newProjectItem) {
        this._activeEditorPersistable = undefined;
      }

      if (newProjectItem.projectPath) {
        this._setHash(ProjectEditorUtilities.convertStoragePathToBrowserSafe(newProjectItem.projectPath));
      }

      this.setState({
        activeProjectItem: newProjectItem,
        tentativeProjectItem: this.state.tentativeProjectItem,
        activeReference: null,
        mode: newMode,
        viewMode: newStateViewMode,
        allInfoSet: this.props.project.infoSet,
        allInfoSetGenerated: this.props.project.infoSet.completedGeneration,
        forceRawView: forceRawView,
        filteredItems: this.state.filteredItems,
        searchFilter: this.state.searchFilter,
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

  _setHash(newHash: string) {
    this._lastHashProcessed = newHash;

    if (window.history.pushState) {
      window.history.pushState(null, "", "#" + newHash);
    } else {
      window.location.hash = "#" + newHash;
    }
  }
  async commitTentativeItem() {
    this.setState({
      activeProjectItem: this.state.tentativeProjectItem,
      tentativeProjectItem: null,
      activeReference: this.state.activeReference,
      mode: this.state.mode,
      effectMode: this.state.effectMode,
      dragStyle: this.state.dragStyle,
      visualSeed: this.state.visualSeed,
      viewMode: this.state.viewMode,
      allInfoSet: this.props.project.infoSet,
      allInfoSetGenerated: this.props.project.infoSet.completedGeneration,
      displayFileView: this.state.displayFileView,
      menuState: this.state.menuState,
      forceRawView: this.state.forceRawView,
      filteredItems: undefined,
      searchFilter: undefined,
      statusAreaMode: this.state.statusAreaMode,
      lastDeployKey: this.state.lastDeployKey,
      lastExportKey: this.state.lastExportKey,
      lastDeployFunction: this.state.lastDeployFunction,
      lastExportFunction: this.state.lastExportFunction,
      lastDeployData: this.state.lastDeployData,
      lastExportData: this.state.lastExportData,
    });
  }

  async moveTentativeItem(increment: number) {
    const filteredItems = this.state.filteredItems;

    if (filteredItems) {
      const items = ProjectUtilities.getItemsFromSearch(this.props.project, filteredItems);

      if (items && items.length) {
        let currentIndex = 0;

        for (const projectItem of items) {
          if (projectItem === this.state.tentativeProjectItem) {
            break;
          }

          currentIndex++;
        }

        currentIndex = currentIndex + increment;

        if (currentIndex < 0) {
          currentIndex = items.length - 1;
        } else if (currentIndex >= items.length) {
          currentIndex = 0;
        }

        this.setState({
          activeProjectItem: this.state.activeProjectItem,
          tentativeProjectItem: items[currentIndex],
          activeReference: this.state.activeReference,
          mode: this.state.mode,
          effectMode: this.state.effectMode,
          dragStyle: this.state.dragStyle,
          visualSeed: this.state.visualSeed,
          viewMode: this.state.viewMode,
          allInfoSet: this.props.project.infoSet,
          allInfoSetGenerated: this.props.project.infoSet.completedGeneration,
          displayFileView: this.state.displayFileView,
          menuState: this.state.menuState,
          forceRawView: this.state.forceRawView,
          filteredItems: this.state.filteredItems,
          searchFilter: this.state.searchFilter,
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

  async _handleFilterTextChanged(newFilterText: string | undefined) {
    if (!this.state.allInfoSetGenerated) {
      return;
    }

    let searchResults: IAnnotatedValue[] | undefined = undefined;
    let tentativeItem = this.state.tentativeProjectItem;

    if (newFilterText !== undefined) {
      searchResults = await this.state.allInfoSet.contentIndex.getMatches(newFilterText);

      if (searchResults) {
        const items = ProjectUtilities.getItemsFromSearch(this.props.project, searchResults);

        if (items && items.length) {
          if (!tentativeItem || !items.includes(tentativeItem)) {
            tentativeItem = items[0];
          }
        }
      }
    } else {
      tentativeItem = null;
    }

    this.setState({
      activeProjectItem: this.state.activeProjectItem,
      tentativeProjectItem: tentativeItem,
      activeReference: this.state.activeReference,
      mode: this.state.mode,
      effectMode: this.state.effectMode,
      dragStyle: this.state.dragStyle,
      visualSeed: this.state.visualSeed,
      viewMode: this.state.viewMode,
      allInfoSet: this.props.project.infoSet,
      allInfoSetGenerated: this.props.project.infoSet.completedGeneration,
      displayFileView: this.state.displayFileView,
      menuState: this.state.menuState,
      forceRawView: this.state.forceRawView,
      filteredItems: searchResults,
      searchFilter: newFilterText,
      statusAreaMode: this.state.statusAreaMode,
      lastDeployKey: this.state.lastDeployKey,
      lastExportKey: this.state.lastExportKey,
      lastDeployFunction: this.state.lastDeployFunction,
      lastExportFunction: this.state.lastExportFunction,
      lastDeployData: this.state.lastDeployData,
      lastExportData: this.state.lastExportData,
    });
  }

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

  getGridColumnWidths() {
    const width = WebUtilities.getWidth();
    let isFullyCompact = false;
    const viewMode = this.state.viewMode;

    if (width < 744) {
      isFullyCompact = true;
    }

    let gridTemplateColumns = this.props.carto.itemSidePaneWidth + "px 4px 1fr 300px";

    if (isFullyCompact) {
      gridTemplateColumns = "30px 4px 1fr 30px";

      if (viewMode === CartoEditorViewMode.mainFocus) {
        gridTemplateColumns = "1fr 1fr 1fr 1fr ";
      } else if (viewMode === CartoEditorViewMode.itemsFocus) {
      } else if (viewMode === CartoEditorViewMode.codeLanding) {
      } else if (viewMode === CartoEditorViewMode.toolboxFocus) {
        gridTemplateColumns = "1fr 1fr 1fr 1fr ";
      } else if (viewMode === CartoEditorViewMode.itemsOnLeft) {
        gridTemplateColumns = "300px 1fr 1fr 1fr";
      } else if (viewMode === CartoEditorViewMode.itemsOnLeftAndMinecraftToolbox) {
      } else if (viewMode === CartoEditorViewMode.itemsOnRightAndMinecraftToolbox) {
      } else {
        gridTemplateColumns = "1fr 1fr 300px";
      }
    } else {
      if (viewMode === CartoEditorViewMode.itemsOnRightAndMinecraftToolbox) {
        gridTemplateColumns = "300px 1fr 4px " + this.props.carto.itemSidePaneWidth + "px";
      } else if (viewMode === CartoEditorViewMode.itemsOnRight) {
        gridTemplateColumns = "300px 1fr 4px " + this.props.carto.itemSidePaneWidth + "px";
      }
    }

    return gridTemplateColumns;
  }

  render() {
    const width = WebUtilities.getWidth();
    let isButtonCompact = false; // toolbar button compact, that is
    let isFullyCompact = false;

    if (width < 616) {
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

    let viewMode = this.state.viewMode;

    if (
      isFullyCompact &&
      (viewMode === CartoEditorViewMode.itemsOnLeft ||
        viewMode === CartoEditorViewMode.itemsOnLeftAndMinecraftToolbox ||
        viewMode === CartoEditorViewMode.itemsOnRight ||
        viewMode === CartoEditorViewMode.itemsOnRightAndMinecraftToolbox)
    ) {
      viewMode = CartoEditorViewMode.mainFocus;
    }
    if (this.props.project.errorState === ProjectErrorState.projectFolderOrFileDoesNotExist) {
      let error = "Could not find project data folder. ";

      if (this.props.project.mainDeployFolderPath) {
        error += this.props.project.mainDeployFolderPath;
      }

      return <h1>{error}</h1>;
    }

    if (this.state.searchFilter && viewMode === CartoEditorViewMode.mainFocus) {
      viewMode = CartoEditorViewMode.itemsFocus;
    }

    let exportKeys: { [exportOptionKey: string]: any } = {};
    const exportMenu: any = [];

    let nextExportKey = "shareableLink";

    if (
      this.props.project.role !== ProjectRole.explorer &&
      this.props.project.role !== ProjectRole.documentation &&
      this.props.project.role !== ProjectRole.meta
    ) {
      if (Utilities.isPreview && ProjectEditorUtilities.getIsLinkShareable(this.props.project)) {
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
        content: "Add-On File",
        onClick: this._handleExportMCAddonClick,
        title: "Exports this set of project files as a MCA, for use in Minecraft",
      };
      exportMenu.push(exportKeys[nextExportKey]);

      if (!AppServiceProxy.hasAppService && window.showDirectoryPicker !== undefined) {
        exportMenu.push({
          key: "dividerEXP",
          kind: "divider",
        });

        nextExportKey = "exportFolder";
        exportKeys[nextExportKey] = {
          key: nextExportKey,
          icon: <FontAwesomeIcon icon={faComputer} key={nextExportKey} className="fa-lg" />,
          content: "Export to a folder on this device",
          onClick: this._handleExportToLocalFolderClick,
          title: "Exports this project to a folder on your device.",
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
        title: "Get this pack in a sample .mcworld file with references to this Add-On packs",
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

    if (this.props.project.role !== ProjectRole.documentation && this.props.project.role !== ProjectRole.meta) {
      nextExportKey = "downloadDeployment";
      exportKeys[nextExportKey] = {
        key: nextExportKey,
        icon: <FontAwesomeIcon icon={faFileArchive} key={nextExportKey} className="fa-lg" />,
        onClick: this._handleExportDeploymentZipClick,
        content: "Deployment folder zip",
        title: "Download folder for incorporating into Minecraft",
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
        /*
        nextExportKey = "exportWorld|" + pi.name;

        exportKeys[nextExportKey] = {
          key: nextExportKey,
          icon: <FontAwesomeIcon icon={faBox} className="fa-lg" />,
          content: title + " world",
          onClick: this._handleExportWorld,
          title: "Download " + title,
        };

        exportMenu.push(exportKeys[nextExportKey]);*/

        if (AppServiceProxy.hasAppServiceOrSim) {
          nextExportKey = "convertTo|" + pi.name;
          exportKeys[nextExportKey] = {
            key: nextExportKey,
            icon: <FontAwesomeIcon icon={faComputer} key={nextExportKey} className="fa-lg" />,
            content: title + " conversion...",
            onClick: this._handleConvertToClick,
            title: "Convert and export " + title,
          };
          exportMenu.push(exportKeys[nextExportKey]);
        }

        const dlsKey = "deploySpecificWorldPack|" + pi.name;
        deployKeys[dlsKey] = {
          key: dlsKey + "A",
          icon: <FontAwesomeIcon icon={faBox} key={dlsKey} className="fa-lg" />,
          content: title + " mcworld",
          onClick: this._handleDeployWorldPackClick,
          title: "Downloads " + title + " in a MCWorld",
        };
        deployMenu.push(deployKeys[dlsKey]);

        /*
        const miKey = "deployWorldTestAssetsPack|" + pi.name;
        deployKeys[miKey] = {
          key: miKey + "A",
          icon: <FontAwesomeIcon icon={faBox} key={miKey} className="fa-lg" />,
          content: title + " and test assets mcworld",
          onClick: this._handleDeployWorldAndTestAssetsPackClick,
          title: "Deploys " + title + " and test assets in a zip",
        };
        deployMenu.push(deployKeys[miKey]);
        */
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
      icon: (
        <img
          className="pe-menuIcon"
          alt=""
          key={flatBp}
          src={CartoApp.contentRoot + "res/latest/van/resource_pack/textures/blocks/grass_path_side.png"}
        />
      ),
      onClick: this._handleDownloadFlatWorldWithPacks,
      content: "Flat world with packs",
      title: "Get this pack in a sample .mcworld file with packs in this project added",
    };
    deployMenu.push({
      key: flatBp + "AA",
      icon: (
        <img
          className="pe-menuIcon"
          alt=""
          key={flatBp}
          src={CartoApp.contentRoot + "res/latest/van/resource_pack/textures/blocks/grass_path_side.png"}
        />
      ),
      onClick: this._handleDownloadFlatWorldWithPacks,
      content: "Flat world with packs",
      title: "Get this pack in a sample flat .mcworld file with packs in this project added",
    });

    const defaultEditorWorldWithPacks = "editorWorld|";
    deployKeys[defaultEditorWorldWithPacks] = {
      key: defaultEditorWorldWithPacks + "C",
      icon: (
        <img
          className="pe-menuIcon"
          alt=""
          key={defaultEditorWorldWithPacks}
          src={CartoApp.contentRoot + "res/latest/van/resource_pack/textures/blocks/grass_side_carried.png"}
        />
      ),
      onClick: this._handleDeployDownloadEditorWorldWithPacks,
      content: "Editor project with packs",
      title: "Get this pack in a sample .mcproject file",
    };
    deployMenu.push(deployKeys[defaultEditorWorldWithPacks]);

    deployMenu.push({
      key: "dividerProjectWorld",
      kind: "divider",
    });

    const defaultWorldWithPacks = "projectWorld|";
    deployKeys[defaultWorldWithPacks] = {
      key: defaultWorldWithPacks + "A",
      icon: (
        <img
          className="pe-menuIcon"
          alt=""
          key={defaultWorldWithPacks}
          src={CartoApp.contentRoot + "res/latest/van/resource_pack/textures/blocks/grass_side_carried.png"}
        />
      ),
      onClick: this._handleDeployDownloadWorldWithPacks,
      content: "Custom world with packs",
      title: "Get a custom pack in a sample .mcworld file, using the sample pack configuration",
    };
    deployMenu.push(deployKeys[defaultWorldWithPacks]);

    const configureProjectWorld = "configProjectWorld|";
    deployKeys[configureProjectWorld] = {
      key: defaultWorldWithPacks + "B",
      icon: <FontAwesomeIcon icon={faEdit} key={configureProjectWorld} className="fa-lg" />,
      onClick: this._handleChangeWorldSettingsClick,
      content: "Change custom world with pack settings",
      title: "Change your custom world with pack settings",
    };
    deployMenu.push(deployKeys[configureProjectWorld]);

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
          title: "Get the " + name + " .mcworld file with references to this Add-On packs",
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
        title: "Home/Project List",
      });

      if (!this.props.readOnly) {
        toolbarItems.push({
          icon: <SaveLabel />,
          key: "save",
          content: <Text content="Save" />,
          onClick: this._handleSaveClick,
          title: "Save",
        });
      }

      if (viewMode === CartoEditorViewMode.mainFocus) {
        toolbarItems.push({
          key: "itemsFocusA",
          content: "View Items",
          icon: <FontAwesomeIcon icon={faSitemap} className="fa-lg" />,
          title: "Items",
          onClick: this._setItemsFocus,
        });
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
          content: "Main and item list on the left",
          icon: <FontAwesomeIcon icon={faSquareCaretLeft} className="fa-lg" />,
          title: "Editor/view and item list on the left",
          onClick: this._setItemsOnLeft,
        });

        viewMenuItems.push({
          key: "itemsOnRight",
          content: "Main and item list on the right",
          icon: <FontAwesomeIcon icon={faSquareCaretRight} className="fa-lg" />,
          title: "Editor/view and item list on the right",
          onClick: this._setItemsOnRight,
        });

        viewMenuItems.push({
          key: "worldToolsDividerI",
          kind: "divider",
        });
      }

      viewMenuItems.push({
        key: "mainFocus",
        content: "Editor/view",
        icon: <FontAwesomeIcon icon={faWindowMaximize} className="fa-lg" />,
        title: "Editor",
        onClick: this._setMainFocus,
      });
      viewMenuItems.push({
        key: "itemsFocus",
        content: "Items",
        icon: <FontAwesomeIcon icon={faSitemap} className="fa-lg" />,
        title: "Items",
        onClick: this._setItemsFocus,
      });

      if (Utilities.isPreview) {
        viewMenuItems.push({
          key: "toolboxFocus",
          content: "Toolbox",
          icon: <FontAwesomeIcon icon={faTools} className="fa-lg" />,
          title: "Toolbox",
          onClick: this._setToolboxFocus,
        });
      }

      viewMenuItems.push({
        key: "worldToolsDivider",
        kind: "divider",
      });

      viewMenuItems.push({
        key: "viewAsItems",
        content: "View as items",
        icon: <FontAwesomeIcon icon={faList} className="fa-lg" />,
        title: "Item list on the left",
        onClick: this._viewAsItems,
      });

      viewMenuItems.push({
        key: "viewAsFiles",
        content: "View as files",
        icon: <FontAwesomeIcon icon={faFolderTree} className="fa-lg" />,
        title: "Item list on the right",
        onClick: this._viewAsFiles,
      });

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

    if (Utilities.isPreview) {
      toolbarItems.push({
        icon: <SettingsLabel isCompact={isButtonCompact} />,
        key: "settings",
        onClick: this._showSettingsClick,
        title: "Settings",
      });

      if (
        this.props.project.role !== ProjectRole.documentation &&
        this.props.project.role !== ProjectRole.meta &&
        Utilities.isDebug
      ) {
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

      if (exportItem) {
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
      } else {
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
      }
    }

    if (
      this.props.carto.deploymentStorage != null &&
      this.props.project.role !== ProjectRole.documentation &&
      this.props.project.role !== ProjectRole.meta
    ) {
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
    let heightOffset = this.props.heightOffset + 96;

    let areaHeight = "calc(100vh - " + this.props.heightOffset + "px)";

    if (CartoApp.hostType === HostType.vsCodeMainWeb || CartoApp.hostType === HostType.vsCodeWebWeb) {
      areaHeight = "calc(100vh)";
      heightOffset += 9;
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
      if (this.props.readOnly || this.props.project.role === ProjectRole.explorer) {
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
            onContentUpdated={this._doUpdate}
            heightOffset={heightOffset}
            project={this.props.project}
            carto={this.props.carto}
          />
        );
      }
    } else if (this.state.mode === ProjectEditorMode.inspector) {
      interior = (
        <ProjectInfoDisplay
          onNotifyInfoSetLoaded={this._onNotifyNewAllItemSetLoaded}
          allInfoSet={this.state.allInfoSet}
          allInfoSetGenerated={this.state.allInfoSetGenerated}
          theme={this.props.theme}
          heightOffset={heightOffset}
          project={this.props.project}
          carto={this.props.carto}
          onInfoItemCommand={this._handleInfoItemCommand}
        />
      );
    } else if (this.state.mode === ProjectEditorMode.actions) {
      interior = (
        <ProjectActions
          theme={this.props.theme}
          heightOffset={heightOffset}
          onModeChangeRequested={this._handleModeChangeRequested}
          onActionRequested={this._handleActionRequested}
          project={this.props.project}
          carto={this.props.carto}
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
          visualSeed={this.state.visualSeed}
          forceRawView={this.state.forceRawView}
          project={this.props.project}
          setActivePersistable={this._setActiveEditorPersistable}
          carto={this.props.carto}
          activeReference={this.state.activeReference}
          activeProjectItem={this.state.activeProjectItem}
        />
      );
    }

    let effectArea = <></>;

    if (this.state.effectMode === ProjectEditorEffect.dragOver) {
      if (this.state.dragStyle === ProjectEditorDragStyle.addOverwriteOrActiveItem) {
        effectArea = (
          <div className="pe-zoneDragOver">
            <div className="pe-dragZone1">Drop any additional files here.</div>
            <div className="pe-dragZone2">
              Replace the contents of {this.state.activeProjectItem ? this.state.activeProjectItem.name : ""}.
            </div>
          </div>
        );
      } else {
        effectArea = <div className="pe-singleDragOver">Drop any additional files here.</div>;
      }
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
    } else if (
      this.state.dialog === ProjectEditorDialog.integrateItem &&
      this.state.dialogData &&
      (this.state.dialogData as any).fileSource
    ) {
      effectArea = (
        <Dialog
          open={true}
          cancelButton="Cancel"
          confirmButton="OK"
          onCancel={this._handleDialogDone}
          onConfirm={this._handleIntegrateItemOK}
          content={
            <IntegrateItem
              carto={this.props.carto}
              project={this.props.project}
              theme={this.props.theme}
              heightOffset={this.props.heightOffset}
              data={this.state.dialogData as IProjectItemSeed}
              onDialogDataChange={this._handleDialogDataUpdated}
            />
          }
          header={
            "Integate " +
            ((this.state.dialogData as any).fileSource ? (this.state.dialogData as any).fileSource.name : "")
          }
        />
      );
    } else if (this.state.dialog === ProjectEditorDialog.worldSettings) {
      const dialogContent = (
        <WorldSettingsArea
          carto={this.props.carto}
          worldSettings={this.props.project.ensureWorldSettings()}
          displayName={false}
          isAdditive={true}
          displayGameTypeProperties={true}
          displayGameAdminProperties={false}
          onWorldSettingsChanged={this._handleProjectWorldSettingsChanged}
        />
      );
      effectArea = (
        <Dialog
          open={true}
          cancelButton="Cancel"
          confirmButton="OK"
          onCancel={this._handleDialogDone}
          onConfirm={this._handleDialogDone}
          content={dialogContent}
          header={"World settings"}
        />
      );
    }

    let column1 = <></>;
    let column2 = <></>;
    let column3 = <></>;
    let column4 = <></>;

    let itemList = <></>;

    if (this.state.displayFileView) {
      if (this.props.project.projectFolder) {
        const selectedFile = this.state.activeProjectItem ? this.state.activeProjectItem.file : undefined;

        itemList = (
          <FileExplorer
            theme={this.props.theme}
            rootFolder={this.props.project.projectFolder}
            mode={FileExplorerMode.explorer}
            selectedItem={selectedFile}
            carto={this.props.carto}
            readOnly={this.props.readOnly}
            heightOffset={heightOffset}
            onFileSelected={this._handleFileSelected}
          />
        );
      }
    } else {
      itemList = (
        <ProjectItemList
          theme={this.props.theme}
          project={this.props.project}
          carto={this.props.carto}
          editorMode={this.state.mode}
          heightOffset={heightOffset}
          visualSeed={this.state.visualSeed}
          filteredItems={this.state.filteredItems}
          searchFilter={this.state.searchFilter}
          allInfoSet={this.state.allInfoSet}
          allInfoSetGenerated={this.state.allInfoSetGenerated}
          onModeChangeRequested={this._handleModeChangeRequested}
          onActiveProjectItemChangeRequested={this._handleProjectItemSelected}
          onActiveReferenceChangeRequested={this._handleReferenceSelected}
          readOnly={this.props.readOnly}
          activeProjectItem={this.state.activeProjectItem}
          tentativeProjectItem={this.state.tentativeProjectItem}
        />
      );
    }

    let border = "";

    if (CartoApp.theme === CartoThemeStyle.dark) {
      border = "inset 4px #6b6562";
    } else {
      border = "inset 4px #f1f1f1";
    }

    if (viewMode === CartoEditorViewMode.mainFocus) {
      column2 = (
        <main
          className="pe-colAll"
          aria-label="Main content area"
          style={{
            border: border,
            height: "calc(100vh - " + String(heightOffset - 11) + "px)",
            backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background2,
          }}
        >
          {interior}
        </main>
      );
    } else if (viewMode === CartoEditorViewMode.itemsFocus) {
      column2 = (
        <section aria-label="Item listing area" className="pe-itemlist pe-colAll">
          {itemList}
        </section>
      );
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
    } else if (viewMode === CartoEditorViewMode.itemsOnLeft) {
      column1 = (
        <section aria-label="Item listing area" className="pe-itemlist pe-col1">
          {itemList}
        </section>
      );
      column2 = (
        <div
          className="pe-col2 pe-itemSplitter"
          style={{
            borderLeft: border,
            borderTop: border,
            borderBottom: border,
          }}
          onMouseDown={this._handleSplitterDrag}
        >
          &#160;
        </div>
      );
      column3 = (
        <main
          aria-label="Main content area"
          className="pe-col3and4"
          style={{
            borderRight: border,
            borderTop: border,
            borderBottom: border,
            backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background2,
          }}
        >
          {interior}
        </main>
      );
    } else if (viewMode === CartoEditorViewMode.itemsOnLeftAndMinecraftToolbox) {
      column1 = (
        <section aria-label="Item listing area" className="pe-itemlist pe-col1">
          {itemList}
        </section>
      );
      column2 = (
        <main
          aria-label="Main content area"
          className="pe-col2"
          style={{
            border: border,
            backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background2,
          }}
        >
          {interior}
        </main>
      );
      column3 = (
        <div className="pe-col4">
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
        <main
          aria-label="Main content area"
          className="pe-col2"
          style={{
            border: border,
            backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background2,
          }}
        >
          {interior}
        </main>
      );
      column3 = (
        <section aria-label="Item listing area" className="pe-itemlist pe-col4">
          {itemList}
        </section>
      );
    } else {
      // items on right
      column1 = (
        <main
          aria-label="Main content area"
          className="pe-col1and2"
          style={{
            borderLeft: border,
            borderTop: border,
            borderBottom: border,
            backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background2,
          }}
        >
          {interior}
        </main>
      );

      column2 = (
        <div
          className="pe-col3 pe-itemSplitter"
          style={{
            borderRight: border,
            borderTop: border,
            borderBottom: border,
          }}
          onMouseDown={this._handleSplitterDrag}
        >
          &#160;
        </div>
      );

      column3 = (
        <section aria-label="Item listing area" className="pe-itemlist pe-col4">
          {itemList}
        </section>
      );
    }

    const toolbarStyle = isFullyCompact ? "pe-toolbar-compact" : "pe-toolbar";

    let toolbarArea = <></>;

    if (!this.props.hideMainToolbar) {
      toolbarArea = (
        <section aria-label="ToolBar" className={toolbarStyle}>
          <Toolbar aria-label="Project Editor main toolbar" items={toolbarItems} overflow style={{ minHeight: 50 }} />
        </section>
      );
    }

    let statusArea = <></>;

    if (this.state.statusAreaMode !== ProjectStatusAreaMode.hidden) {
      statusArea = (
        <section
          aria-label="Status and item area"
          className="pe-statusbar"
          style={{
            backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
            color: this.props.theme.siteVariables?.colorScheme.brand.foreground1,
          }}
        >
          <StatusArea
            onFilterTextChanged={this._handleFilterTextChanged}
            carto={this.props.carto}
            project={this.props.project}
            theme={this.props.theme}
            heightOffset={heightOffset}
            statusAreaMode={this.state.statusAreaMode}
            onActionRequested={this._handleActionRequested}
            onSetExpandedSize={this._setProjectStatusMode}
          />
        </section>
      );
    }

    return (
      <div>
        {effectArea}
        <div
          ref={this.gridElt}
          className={gridStyle}
          onMouseMove={this._handleOuterMouseMove}
          onMouseUp={this._handleOuterMouseOutOrUp}
          onMouseLeave={this._handleOuterMouseOutOrUp}
          style={{ minHeight: areaHeight, maxHeight: areaHeight, gridTemplateColumns: this.getGridColumnWidths() }}
        >
          {toolbarArea}
          {column1}
          {column2}
          {column3}
          {column4}
          {statusArea}
        </div>
      </div>
    );
  }
}
