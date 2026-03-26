/*
 * ==========================================================================================
 * PROJECT EDITOR - MAIN EDITOR EXPERIENCE NOTES
 * ==========================================================================================
 *
 * OVERVIEW:
 * ---------
 * ProjectEditor is the main editing interface for Minecraft content projects. It provides:
 * - Project item list with tree navigation (left/right panel)
 * - Item editors (code, forms, 3D views) in main area
 * - Toolbar with export, deploy, and view controls
 * - Status area for validation results and notifications
 * - Drag-and-drop file import
 *
 * LAYOUT STRUCTURE:
 * -----------------
 * Uses CSS Grid with configurable columns:
 * - GRID_ITEMS_ON_LEFT_COLUMNS: "300px 1fr 1fr 1fr" - Items panel on left
 * - GRID_ITEMS_ON_RIGHT_COLUMNS: "300px 1fr 4px" - Items on right (VS Code style)
 * - GRID_MAIN_FOCUS_COLUMNS: Main content maximized
 * - GRID_COMPACT_COLUMNS: For narrow viewports
 *
 * EDITOR MODES (ProjectEditorMode):
 * ---------------------------------
 * - inspector: Show validation/info for entire project
 * - properties: Project settings editor
 * - activeItem: Edit selected ProjectItem
 * - minecraft: Minecraft connection/deployment tools
 * - codeToolbox: Code generation tools
 * - settings: Application settings
 *
 * ITEM VIEWS (ProjectItemEditorView):
 * -----------------------------------
 * - standardDefault: Type-specific editor (form for JSON, Monaco for code)
 * - raw: Monaco text editor for any file
 * - actions: Item-specific action buttons
 *
 * KEY STATE:
 * ----------
 * - activeProjectItem: Currently selected/editing item
 * - mode: Current editor mode
 * - viewMode: CreatorToolsEditorViewMode (standard, compact, mainFocus)
 * - displayFileView: Show file tree vs categorized list
 * - statusAreaMode: minimized, expanded, hidden
 * - allInfoSet: Validation results (ProjectInfoSet)
 *
 * TOOLBAR MENUS:
 * --------------
 * - View menu: Layout options, file view toggle
 * - Export menu: MCAddon, MCWorld, ZIP, local folder
 * - Deploy menu: To Minecraft, remote server, dev environment
 * - Item menu: Item-specific actions (rename, delete, integrate)
 *
 * DIALOGS (ProjectEditorDialog):
 * ------------------------------
 * - shareableLink: Generate sharing URL
 * - worldSettings: Configure world properties
 * - convertTo: Convert item to different format
 * - integrateItem: Import item from template
 * - deleteItem, renameItem: Item management
 * - newVariant: Create project variant
 *
 * DRAG AND DROP:
 * --------------
 * - Supports file/folder drop from OS
 * - effectMode: ProjectEditorEffect.dragOver during drag
 * - dragStyle: Controls addOverwrite vs addToActiveItem behavior
 * - _handleFileDrop processes dropped content
 *
 * UNDO/REDO:
 * ----------
 * - undoStackState, undoStackIndex track undo state
 * - Toolbar buttons for undo/redo with dropdown history
 *
 * EXPORT WORKFLOWS:
 * -----------------
 * - MCAddon: Behavior + Resource packs as .mcaddon
 * - MCWorld: World with embedded packs
 * - ZIP: Raw project structure
 * - Local folder: Direct file copy (Electron/VSCode)
 *
 * RELATED FILES:
 * --------------
 * - ProjectItemList.tsx: Tree/list view of project items
 * - ProjectItemEditor.tsx: Routes to specific item editors
 * - ProjectEditorUtilities.ts: Static helpers, enums
 * - ProjectExporter.ts: Export/packaging logic
 * - StatusArea.tsx: Validation results display
 * - ProjectInfoDisplay.tsx: Detailed validation view
 *
 * HEIGHT OFFSETS:
 * ---------------
 * Various HEIGHT_OFFSET_* constants adjust for toolbar, status bar, VS Code frame
 *
 * ==========================================================================================
 */

import React, { Component, SyntheticEvent } from "react";
import IAppProps from "../appShell/IAppProps";
import Project, { FolderContext, ProjectErrorState } from "../../app/Project";
import ProjectItem, { IProjectItemContentUpdateEvent } from "../../app/ProjectItem";
import { ProjectItemCreationType, ProjectItemStorageType, ProjectItemType } from "../../app/IProjectItemData";
import ProjectItemList from "./projectNavigation/ProjectItemList";
import ProjectItemEditor from "./ProjectItemEditor";
import type { IProjectItemEditorNavigationTarget } from "./ProjectItemEditor";
import ProjectExporter from "../../app/ProjectExporter";
import MCWorld from "../../minecraft/MCWorld";
import { AppMode } from "../appShell/App";
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
  faWandMagicSparkles,
  faUndo,
  faRedo,
  faTimes,
  faKeyboard,
  faSearch,
  faServer,
  faEye,
  faCode,
  faBookOpen,
} from "@fortawesome/free-solid-svg-icons";
import { getThemeColors } from "../hooks/theme/useThemeColors";
import { Button, Dialog, DialogTitle, DialogContent, DialogActions, Stack, TextField } from "@mui/material";

import {
  ViewLabel,
  SaveLabel,
  SettingsLabel,
  HelpLabel,
  HomeLabel,
  DeployLabel,
  ConnectLabel as MinecraftLabel,
  MCPackLabel,
  DownArrowLabel,
  CustomLabel,
  OpenInExplorerLabel,
  ItemActionsLabel,
} from "../shared/components/feedback/labels/Labels";

import "./ProjectEditor.css";
import ZipStorage from "../../storage/ZipStorage";
import Utilities from "../../core/Utilities";
import { saveAs } from "file-saver";
import StorageUtilities, { EncodingType } from "../../storage/StorageUtilities";
import StatusArea from "../appShell/StatusArea";
import ProjectPropertyEditor from "./ProjectPropertyEditor";
import IPersistable from "../types/IPersistable";
import Log from "../../core/Log";
import AppServiceProxy, { AppServiceProxyCommands } from "../../core/AppServiceProxy";
import MinecraftToolEditor from "../shared/MinecraftToolEditor";
import CreatorToolsSettings from "../home/CreatorToolsSettings";
import {
  CreatorToolsEditorViewMode,
  CreatorToolsEditPreference,
  MinecraftFlavor,
  MinecraftGameConnectionMode,
} from "../../app/ICreatorToolsData";
import ProjectDisplay from "./ProjectDisplay";
import IGitHubInfo from "../../app/IGitHubInfo";
import MinecraftDisplay from "../server/MinecraftDisplay";
import WebUtilities from "../utils/WebUtilities";
import ProjectInfoDisplay, { InfoItemCommand } from "./projectInfo/ProjectInfoDisplay";
import ProjectInfoItem from "../../info/ProjectInfoItem";
import { MinecraftPushWorldType } from "../../app/MinecraftPush";
import CreatorToolsHost, { HostType, CreatorToolsThemeStyle } from "../../app/CreatorToolsHost";
import { faEdit, faWindowMaximize } from "@fortawesome/free-regular-svg-icons";
import FileExplorer, { FileExplorerMode } from "./fileExplorer/FileExplorer";
import telemetry from "../../analytics/Telemetry";
import { TelemetryEvents, TelemetryProperties } from "../../analytics/TelemetryConstants";
import ShareProject from "../io/ShareProject";
import VscProjectLanding from "../home/VscProjectLanding";
import { IProjectUpdaterReference } from "../../info/IProjectInfoGeneratorBase";
import { SidePaneMaxWidth, SidePaneMinWidth } from "../../app/CreatorTools";
import ProjectEditorUtilities, {
  ProjectEditorMode,
  ProjectEditorAction,
  MaxModeActions,
  ProjectEditorItemAction,
  ProjectItemEditorView,
} from "./ProjectEditorUtilities";
import { IWorldSettings } from "../../minecraft/IWorldSettings";
import WorldSettingsArea from "../server/WorldSettingsArea";
import IFile, { FileUpdateType } from "../../storage/IFile";
import ProjectActions from "./projectActions/ProjectActions";
import ProjectInfoSet from "../../info/ProjectInfoSet";
import { IAnnotatedValue } from "../../core/AnnotatedValue";
import { ProjectRole } from "../../app/IProjectData";
import ProjectUtilities from "../../app/ProjectUtilities";
import Convert from "../io/Convert";
import IConversionSettings from "../../core/IConversionSettings";
import ProjectItemUtilities from "../../app/ProjectItemUtilities";
import IntegrateItem from "../io/IntegrateItem";
import IProjectItemSeed, { ProjectItemSeedAction } from "../../app/IProjectItemSeed";
import ProjectStandard from "../../app/ProjectStandard";
import ProjectAutogeneration from "../../app/ProjectAutogeneration";
import BrowserFolder from "../../storage/BrowserFolder";
import BlockbenchModel from "../../integrations/BlockbenchModel";
import NewVariant from "./NewVariant";
import IProjectItemVariantSeed from "../../app/IProjectItemVariantSeed";
import ProjectItemVariantCreateManager from "../../app/ProjectItemVariantCreateManager";
import ProjectMap from "./ProjectMap";
import ProjectWebUtilities from "./ProjectWebUtilities";
import McToolbar, { McToolbarItem, McToolbarMenuItem } from "../shared/components/navigation/mcToolbar/McToolbar";
import IProjectTheme from "../types/IProjectTheme";
import QuickOpenDialog from "../appShell/QuickOpenDialog";
import ProjectSearchDialog from "../appShell/ProjectSearchDialog";
import KeyboardShortcutHelp from "../appShell/KeyboardShortcutHelp";
import EditorTabBar from "../appShell/EditorTabBar";

const EDITOR_TICK_INTERVAL = 50;

// UI and layout constants
const MOBILE_WIDTH = 480;
const FULLY_COMPACT_WIDTH = 744;
const BUTTON_COMPACT_WIDTH = 616;
const DEFAULT_WIDTH_OFFSET = 10;
const SIDE_PANE_WIDTH_OFFSET = 330;
const SIDE_PANE_AND_TOOLBOX_WIDTH_OFFSET = 590;
const TOOLBAR_MIN_HEIGHT = 40;
const HEIGHT_OFFSET_DEFAULT = 86;
const HEIGHT_OFFSET_STATUSBAR = 190;
const HEIGHT_OFFSET_TOOLBAR_COLLAPSED = 45;
const HEIGHT_OFFSET_STATUSBAR_HIDDEN = 40;
const HEIGHT_OFFSET_VSCODE = 9;
const BORDER_INSET_LIGHT = "inset 4px #f1f1f1";
const BORDER_INSET_DARK = "inset 4px #6b6562";
const SPLITTER_DRAG_TIMEOUT = 2;
const ASYNC_LOADING_TIMEOUT = 2000;
const FILE_DRAG_OUT_THRESHOLD = 10;
const FILE_DRAG_OVER_THRESHOLD = 10;
const MAX_ADDED_ITEMS = 4;
const GRID_COMPACT_COLUMNS = "30px 4px 1fr 30px";
const GRID_MAIN_FOCUS_COLUMNS = "1fr 1fr 1fr 1fr ";
const GRID_ITEMS_ON_LEFT_COLUMNS = "min(300px, 40vw) 1fr 1fr 1fr";
const GRID_ITEMS_ON_RIGHT_COLUMNS = "min(300px, 40vw) 1fr 4px ";
const GRID_DEFAULT_COLUMNS = "1fr 1fr min(300px, 40vw)";
const HEIGHT_OFFSET_MINUS = 11;

interface IProjectEditorProps extends IAppProps {
  onModeChangeRequested?: (mode: AppMode) => void;
  onActiveProjectItemChangeRequested?: (projectItem: ProjectItem, itemView: ProjectItemEditorView) => void;
  project: Project;
  readOnly: boolean;
  isHosted?: boolean;
  isViewMode?: boolean;
  hasContentSession?: boolean;
  visualSeed?: number;
  theme: IProjectTheme;
  initialFocusPath?: string;
  isPersisted?: boolean;
  onPersistenceUpgraded?: () => void;
  selectedItem?: string;
  heightOffset: number;
  mode?: ProjectEditorMode;
  statusAreaMode?: ProjectStatusAreaMode;
  hideMainToolbar?: boolean;
  viewMode?: CreatorToolsEditorViewMode;
}

interface IProjectEditorState {
  activeProjectItem: ProjectItem | null;
  tentativeProjectItem: ProjectItem | null;
  activeReference: IGitHubInfo | null;
  editorNavigationTarget?: IProjectItemEditorNavigationTarget;
  undoStackState?: string;

  undoStackIndex?: number;
  mode: ProjectEditorMode;
  itemView: ProjectItemEditorView;
  filteredItems?: IAnnotatedValue[];
  searchFilter?: string;
  displayFileView: boolean;
  visualSeed?: number;
  activeVariant?: string;
  viewMode: CreatorToolsEditorViewMode;
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
  lastDeployFunction: ((e: SyntheticEvent | undefined, data: any | undefined) => Promise<void>) | undefined;
  lastExportFunction: ((e: SyntheticEvent | undefined, data: any | undefined) => Promise<void>) | undefined;
  lastExportData: any | undefined;
  lastDeployData: any | undefined;
  openTabs: ProjectItem[];
}

export enum ProjectEditorMenuState {
  noMenu = 0,
  viewMenu = 1,
  exportMenu = 2,
  deployMenu = 3,
  itemMenu = 4,
  undoMenu = 5,
  redoMenu = 6,
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
  convertTo = 4,
  integrateItem = 5,
  deleteItem = 6,
  renameItem = 7,
  newVariant = 8,
  quickOpen = 9,
  keyboardShortcuts = 10,
  projectSearch = 11,
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
  private _containerElt: React.RefObject<HTMLDivElement>;
  private _splitterDrag: number | undefined;
  private _toolPaneSplitterDrag: boolean = false;
  private _asyncLoadAttempts: number = 0;
  private _newItemName?: string;
  private _nextNavigationRequestId = 1;

  constructor(props: IProjectEditorProps) {
    super(props);

    this.gridElt = React.createRef();
    this._containerElt = React.createRef();

    this.getProjectTitle = this.getProjectTitle.bind(this);

    this.setNewProjectVariantName = this.setNewProjectVariantName.bind(this);

    this._setToVersion = this._setToVersion.bind(this);

    this._handleNewProjectItemName = this._handleNewProjectItemName.bind(this);
    this._handleExportMCAddonClick = this._handleExportMCAddonClick.bind(this);
    this._handleExportToLocalFolderClick = this._handleExportToLocalFolderClick.bind(this);
    this._handleConvertToClick = this._handleConvertToClick.bind(this);
    this._handleConfirmRename = this._handleConfirmRename.bind(this);
    this._handleConfirmDelete = this._handleConfirmDelete.bind(this);
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
    this._itemMenuClick = this._itemMenuClick.bind(this);
    this._handleInfoItemCommand = this._handleInfoItemCommand.bind(this);
    this._handleDialogDone = this._handleDialogDone.bind(this);
    this._handleFilterTextChanged = this._handleFilterTextChanged.bind(this);
    this._incrementVisualSeed = this._incrementVisualSeed.bind(this);
    this._handleItemContentChanged = this._handleItemContentChanged.bind(this);

    this._showMinecraftClick = this._showMinecraftClick.bind(this);
    this._showSettingsClick = this._showSettingsClick.bind(this);
    this._handleHomeClick = this._handleHomeClick.bind(this);
    this._handleCloseViewClick = this._handleCloseViewClick.bind(this);
    this._handleVscAddClick = this._handleVscAddClick.bind(this);
    this._handleSaveClick = this._handleSaveClick.bind(this);
    this._viewAsFiles = this._viewAsFiles.bind(this);
    this._viewAsFilesImpl = this._viewAsFilesImpl.bind(this);
    this._onNotifyNewAllItemSetLoaded = this._onNotifyNewAllItemSetLoaded.bind(this);

    this._viewAsItems = this._viewAsItems.bind(this);
    this._viewAsItemsImpl = this._viewAsItemsImpl.bind(this);

    this._handleOuterMouseMove = this._handleOuterMouseMove.bind(this);
    this._handleOuterMouseOutOrUp = this._handleOuterMouseOutOrUp.bind(this);

    this._toggleUndoMenuOpen = this._toggleUndoMenuOpen.bind(this);
    this._toggleRedoMenuOpen = this._toggleRedoMenuOpen.bind(this);

    this._handleNewVariantRequested = this._handleNewVariantRequested.bind(this);
    this._handleSplitterDrag = this._handleSplitterDrag.bind(this);
    this._openInExplorerClick = this._openInExplorerClick.bind(this);
    this._handleExportMenuOpen = this._handleExportMenuOpen.bind(this);
    this._handleDeployMenuOpen = this._handleDeployMenuOpen.bind(this);
    this._openQuickOpen = this._openQuickOpen.bind(this);
    this._handleQuickOpenSelect = this._handleQuickOpenSelect.bind(this);
    this._handleQuickOpenClose = this._handleQuickOpenClose.bind(this);
    this._openProjectSearch = this._openProjectSearch.bind(this);
    this._handleSearchResultSelected = this._handleSearchResultSelected.bind(this);
    this._handleSearchClose = this._handleSearchClose.bind(this);
    this._handleEditorTabSelected = this._handleEditorTabSelected.bind(this);
    this._handleEditorTabClosed = this._handleEditorTabClosed.bind(this);
    this._handleCloseOtherTabs = this._handleCloseOtherTabs.bind(this);
    this._handleCloseAllTabs = this._handleCloseAllTabs.bind(this);
    this._handleViewMenuOpen = this._handleViewMenuOpen.bind(this);
    this._handleSetFocusedMode = this._handleSetFocusedMode.bind(this);
    this._handleSetFullMode = this._handleSetFullMode.bind(this);
    this._handleSetRawMode = this._handleSetRawMode.bind(this);
    this._handleItemMenuOpen = this._handleItemMenuOpen.bind(this);
    this._handleConvertOK = this._handleConvertOK.bind(this);
    this._handleIntegrateItemOK = this._handleIntegrateItemOK.bind(this);
    this._handleNewVariantOK = this._handleNewVariantOK.bind(this);
    this._handleDeployWorldAndTestAssetsPackClick = this._handleDeployWorldAndTestAssetsPackClick.bind(this);
    this._handleDeployWorldAndTestAssetsLocalClick = this._handleDeployWorldAndTestAssetsLocalClick.bind(this);
    this._handleDeployWorldPackClick = this._handleDeployWorldPackClick.bind(this);
    this._handleExportFlatWorldWithPacks = this._handleExportFlatWorldWithPacks.bind(this);
    this._handleDeployToRemoteServerClick = this._handleDeployToRemoteServerClick.bind(this);
    this._handleDeployPacksToMinecraftGameClick = this._handleDeployPacksToMinecraftGameClick.bind(this);
    this._editorTick = this._editorTick.bind(this);
    this.handleProjectItemAction = this.handleProjectItemAction.bind(this);
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
    this._handleOpenProjectItem = this._handleOpenProjectItem.bind(this);
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
    this._handleToolPaneSplitterDrag = this._handleToolPaneSplitterDrag.bind(this);
    this._handleToolPaneSplitterMouseMove = this._handleToolPaneSplitterMouseMove.bind(this);
    this._handleToolPaneSplitterMouseUp = this._handleToolPaneSplitterMouseUp.bind(this);

    this._handleKeyDown = this._handleKeyDown.bind(this);
    this._handleKeyUp = this._handleKeyUp.bind(this);
    this._openKeyboardShortcutHelp = this._openKeyboardShortcutHelp.bind(this);
    this._closeKeyboardShortcutHelp = this._closeKeyboardShortcutHelp.bind(this);
    this._openDocumentation = this._openDocumentation.bind(this);
    this.launchFlatButton = this.launchFlatButton.bind(this);
    this._setActiveEditorPersistable = this._setActiveEditorPersistable.bind(this);
    this._handleDownloadMCWorld = this._handleDownloadMCWorld.bind(this);
    this._serverStateChanged = this._serverStateChanged.bind(this);
    this._handleDeployToDedicatedServerClick = this._handleDeployToDedicatedServerClick.bind(this);
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

    let viewMode = this.props.creatorTools.editorViewMode;

    if (this.props.viewMode) {
      viewMode = this.props.viewMode;
    }

    // If we have a selectedItem prop, we should show the item editor, not actions
    // This handles the case where we're opening a specific file (e.g., in VSCode custom editor)
    if (this.props.selectedItem) {
      initialMode = ProjectEditorMode.activeItem;
    }

    // If we have an initialFocusPath, we should show the item editor, not actions
    // This handles the case where we're opening a specific file via focused opening (e.g., Electron app with file path)
    if (this.props.initialFocusPath && this.props.initialFocusPath.length > 0) {
      initialMode = ProjectEditorMode.activeItem;
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

        // Also check initialFocusPath using endsWith matching (focus path is a partial/relative path)
        if (this.props.initialFocusPath && this.props.initialFocusPath.length > 0 && projectItem.projectPath) {
          const canonPath = StorageUtilities.canonicalizePath(projectItem.projectPath);
          if (canonPath.endsWith(this.props.initialFocusPath)) {
            initialItem = projectItem;
            initialMode = ProjectEditorMode.activeItem;
          }
        }
      }
    }

    if (this.props.mode) {
      initialMode = this.props.mode;
    }

    let changes = this.props.project.getChangeList();

    return {
      activeProjectItem: initialItem,
      tentativeProjectItem: null,
      activeReference: null,
      editorNavigationTarget: undefined,
      mode: initialMode,
      visualSeed: 0 + (this.props.visualSeed ? this.props.visualSeed : 0),
      undoStackState: StorageUtilities.getSerializationOfChangeList(changes),
      allInfoSet: this.props.project.indevInfoSet,
      allInfoSetGenerated: this.props.project.indevInfoSet.completedGeneration,
      menuState: ProjectEditorMenuState.noMenu,
      statusAreaMode: sam,
      displayFileView:
        this.props.creatorTools.editPreference === CreatorToolsEditPreference.summarized
          ? false
          : this.props.creatorTools.viewAsFiles,
      viewMode: viewMode,
      itemView: ProjectItemEditorView.singleFileEditor,
      tab: ProjectEditorTab.itemList,
      lastDeployKey: undefined,
      lastExportKey: undefined,
      lastDeployFunction: undefined,
      lastExportFunction: undefined,
      lastDeployData: undefined,
      lastExportData: undefined,
      openTabs: initialItem ? [initialItem] : [],
    };
  }

  _handleKeyDown(event: KeyboardEvent) {
    if (event.ctrlKey && event.key === "s") {
      this._handleSaveClick();

      event.preventDefault();
      return false;
    } else if (event.ctrlKey && (event.key === "p" || event.key === "P")) {
      this._openQuickOpen();
      event.preventDefault();
      return false;
    } else if (event.ctrlKey && event.shiftKey && (event.key === "f" || event.key === "F")) {
      this._openProjectSearch();
      event.preventDefault();
      return false;
    } else if (event.ctrlKey && event.shiftKey && (event.key === "w" || event.key === "W")) {
      this._handleCloseAllTabs();
      event.preventDefault();
      return false;
    } else if (event.ctrlKey && (event.key === "w" || event.key === "W")) {
      if (this.state.activeProjectItem && this.state.openTabs.length > 0) {
        this._handleEditorTabClosed(this.state.activeProjectItem);
        event.preventDefault();
        return false;
      }
    } else if (event.key === "Escape") {
      if (this.state && this.state.effectMode === ProjectEditorEffect.dragOver) {
        this._stopDragEffect();
        event.preventDefault();
        return false;
      }
    } else if (event.key === "F5") {
      this._doDeploy();
      event.preventDefault();
      return false;
    } else if (event.key === "F3") {
      this._doExport();
      event.preventDefault();
      return false;
    } else if (event.ctrlKey && event.key === "/") {
      this._openKeyboardShortcutHelp();
      event.preventDefault();
      return false;
    } else if (event.key === "?" && !this._isTextInputFocused()) {
      this._openKeyboardShortcutHelp();
      event.preventDefault();
      return false;
    } else if (event.altKey && event.key === "1" && !this._isTextInputFocused()) {
      this._handleSetFocusedMode();
      event.preventDefault();
      return false;
    } else if (event.altKey && event.key === "2" && !this._isTextInputFocused()) {
      this._handleSetFullMode();
      event.preventDefault();
      return false;
    } else if (event.altKey && event.key === "3" && !this._isTextInputFocused()) {
      this._handleSetRawMode();
      event.preventDefault();
      return false;
    }

    return true;
  }

  _handleKeyUp(event: KeyboardEvent) {}

  private _isTextInputFocused(): boolean {
    const el = document.activeElement;
    if (!el) return false;
    const tag = el.tagName.toLowerCase();
    if (tag === "input" || tag === "textarea") return true;
    // Monaco editor uses contenteditable divs with class 'monaco-editor'
    if ((el as HTMLElement).isContentEditable) return true;
    if (el.closest(".monaco-editor")) return true;
    return false;
  }

  _openQuickOpen() {
    this.setState({
      dialog: ProjectEditorDialog.quickOpen,
      dialogData: undefined,
    });
  }

  _handleQuickOpenSelect(item: ProjectItem) {
    this.setState({
      dialog: ProjectEditorDialog.noDialog,
    });
    this._handleProjectItemSelected(item, ProjectItemEditorView.singleFileEditor);
  }

  _handleQuickOpenClose() {
    this.setState({
      dialog: ProjectEditorDialog.noDialog,
    });
  }

  _openProjectSearch() {
    this.setState({
      dialog: ProjectEditorDialog.projectSearch,
      dialogData: undefined,
    });
  }

  _handleSearchResultSelected(item: ProjectItem, line: number, column: number) {
    this.setState({
      dialog: ProjectEditorDialog.noDialog,
    });
    this._handleProjectItemSelected(item, ProjectItemEditorView.singleFileEditor);
    // After navigation, attempt to reveal the line in the editor
    // The Monaco editor will be set up after the item is loaded
    setTimeout(() => {
      const editors = document.querySelectorAll(".monaco-editor");
      if (editors.length > 0) {
        // Try to trigger Monaco reveal for the target line
        const monacoEl = editors[editors.length - 1] as HTMLElement;
        if (monacoEl && (window as any).monaco) {
          try {
            const editorInstances = (window as any).monaco.editor.getEditors();
            if (editorInstances && editorInstances.length > 0) {
              const editor = editorInstances[editorInstances.length - 1];
              editor.revealLineInCenter(line);
              editor.setPosition({ lineNumber: line, column: column });
              editor.focus();
            }
          } catch {
            // Monaco API not available, silently fail
          }
        }
      }
    }, 500);
  }

  _handleSearchClose() {
    this.setState({
      dialog: ProjectEditorDialog.noDialog,
    });
  }

  _handleEditorTabSelected(item: ProjectItem) {
    this._handleProjectItemSelected(item, ProjectItemEditorView.singleFileEditor);
  }

  _handleEditorTabClosed(item: ProjectItem) {
    const newTabs = this.state.openTabs.filter((t) => t !== item);

    if (item === this.state.activeProjectItem) {
      // If closing the active tab, switch to the last remaining tab or clear
      const newActive = newTabs.length > 0 ? newTabs[newTabs.length - 1] : null;
      if (newActive) {
        this.setState({ openTabs: newTabs });
        this._handleProjectItemSelected(newActive, ProjectItemEditorView.singleFileEditor);
      } else {
        this.setState({ openTabs: newTabs, activeProjectItem: null, mode: ProjectEditorMode.properties });
      }
    } else {
      this.setState({ openTabs: newTabs });
    }
  }

  _handleCloseOtherTabs() {
    if (!this.state.activeProjectItem) {
      return;
    }

    this.setState({
      openTabs: [this.state.activeProjectItem],
    });
  }

  _handleCloseAllTabs() {
    if (this.state.openTabs.length < 1) {
      return;
    }

    this.setState({
      openTabs: [],
      activeProjectItem: null,
      mode: ProjectEditorMode.properties,
    });
  }

  _openKeyboardShortcutHelp() {
    this.setState({
      dialog: ProjectEditorDialog.keyboardShortcuts,
    });
  }

  _openDocumentation() {
    window.open("https://learn.microsoft.com/minecraft/creator/", "_blank");
  }

  _closeKeyboardShortcutHelp() {
    this.setState({
      dialog: ProjectEditorDialog.noDialog,
    });
  }

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

      // Strip the #project/<encodedProjectName> prefix if present, so we
      // only parse the in-project portion (file path or editor mode).
      // Hash formats:
      //   #project/<name>/<modeName>         → commandToken = "<modeName>"
      //   #project/<name>/behavior_packs/... → commandToken = "/behavior_packs/..."
      //   #<modeName>                        → commandToken = "<modeName>" (legacy)
      //   #/<filePath>                       → commandToken = "/<filePath>" (legacy)
      let commandToken: string | undefined;
      const projectPrefix = "#project/";
      if (hash.startsWith(projectPrefix)) {
        const afterPrefix = hash.substring(projectPrefix.length);
        const slashIndex = afterPrefix.indexOf("/");
        if (slashIndex >= 0) {
          const remainder = afterPrefix.substring(slashIndex + 1);
          // Check if the remainder is a mode string or a file path.
          // File paths contain slashes (e.g., "behavior_packs/mc.../entities/cat.json");
          // mode strings are single tokens (e.g., "properties", "inspector").
          // We try mode match first, then treat as a file path with "/" prepended.
          let isMode = false;
          for (let i = 0; i < MaxModeActions; i++) {
            if (remainder === ProjectEditorUtilities.getProjectEditorModeString(i)) {
              isMode = true;
              break;
            }
          }
          commandToken = isMode ? remainder : "/" + remainder;
        }
        // If there's no slash after the project name, there's no in-project path
      } else {
        const firstHash = hash.indexOf("#");
        if (firstHash >= 0 && firstHash < 4) {
          commandToken = hash.substring(firstHash + 1);
        }
      }

      if (commandToken !== undefined) {
        let state = this.state;

        if (state === undefined) {
          state = this._getDefaultState();
        }

        if (commandToken.startsWith("/")) {
          const path = ProjectEditorUtilities.convertStoragePathFromBrowserSafe(commandToken);
          const projectItem = this.props.project.getItemByProjectPath(path);

          if (projectItem) {
            let viewMode = state.viewMode;

            if (viewMode === CreatorToolsEditorViewMode.itemsFocus) {
              viewMode = CreatorToolsEditorViewMode.mainFocus;
            }

            return {
              activeProjectItem: projectItem,
              tentativeProjectItem: state.tentativeProjectItem,
              activeReference: null,
              editorNavigationTarget: state.editorNavigationTarget,
              mode: ProjectEditorMode.activeItem,
              viewMode: viewMode,
              menuState: state.menuState,
              allInfoSet: this.props.project.indevInfoSet,
              allInfoSetGenerated: this.props.project.indevInfoSet.completedGeneration,
              tab: state.tab,
              itemView: state.itemView,
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
              openTabs: state.openTabs,
            };
          }
        } else {
          for (let i = 0; i < MaxModeActions; i++) {
            if (commandToken === ProjectEditorUtilities.getProjectEditorModeString(i)) {
              return {
                activeProjectItem: null,
                tentativeProjectItem: state.tentativeProjectItem,
                activeReference: null,
                editorNavigationTarget: state.editorNavigationTarget,
                mode: i,
                viewMode: state.viewMode,
                menuState: state.menuState,
                allInfoSet: this.props.project.indevInfoSet,
                allInfoSetGenerated: this.props.project.indevInfoSet.completedGeneration,
                tab: state.tab,
                itemView: state.itemView,
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
                openTabs: state.openTabs,
              };
            }
          }
        }
      }
    }

    return undefined;
  }

  public _handleNewVariantRequested() {
    this.setState({
      activeProjectItem: this.state.activeProjectItem,
      tentativeProjectItem: this.state.tentativeProjectItem,
      activeReference: this.state.activeReference,
      menuState: this.state.menuState,
      undoStackIndex: this.state.undoStackIndex,
      mode: this.state.mode,
      viewMode: this.state.viewMode,
      allInfoSet: this.props.project.indevInfoSet,
      allInfoSetGenerated: this.props.project.indevInfoSet.completedGeneration,
      displayFileView: this.state.displayFileView,
      itemView: this.state.itemView,
      filteredItems: this.state.filteredItems,
      searchFilter: this.state.searchFilter,
      effectMode: this.state.effectMode,
      dragStyle: this.state.dragStyle,
      visualSeed: this.state.visualSeed,
      undoStackState: this.state.undoStackState,
      dialog: ProjectEditorDialog.newVariant,
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
  }

  public setNewProjectVariantName(name: string | undefined) {
    this.setState({
      activeProjectItem: this.state.activeProjectItem,
      tentativeProjectItem: this.state.tentativeProjectItem,
      activeReference: this.state.activeReference,
      mode: this.state.mode,
      effectMode: this.state.effectMode,
      undoStackIndex: this.state.undoStackIndex,
      dragStyle: this.state.dragStyle,
      activeVariant: name,
      visualSeed: this.state.visualSeed ? this.state.visualSeed + 1 : 1,
      undoStackState: this.state.undoStackState,
      viewMode: this.state.viewMode,
      allInfoSet: this.props.project.indevInfoSet,
      allInfoSetGenerated: this.props.project.indevInfoSet.completedGeneration,
      displayFileView: this.state.displayFileView,
      menuState: this.state.menuState,
      itemView: this.state.itemView,
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

  async _doAsyncLoading() {
    if (this._isMountedInternal && this.state) {
      if (!this.state.allInfoSet || !this.state.allInfoSet.completedGeneration) {
        // Use ensureInfoSetGenerated which will use the combined web worker operation
        // when available, processing relations and generating info set in a single
        // worker round-trip for better performance
        await this.props.project.ensureIndevInfoSetGenerated();
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
    if (prevProps !== undefined && prevProps.creatorTools !== undefined) {
      prevProps.creatorTools.onMinecraftStateChanged.unsubscribe(this._serverStateChanged);
    }

    this._connectToProps();
  }

  _connectToProps() {
    if (!this.props.project.onItemContentChanged.has(this._handleItemContentChanged)) {
      this.props.project.onItemContentChanged.subscribe(this._handleItemContentChanged);
    }

    if (
      this.props.creatorTools !== undefined &&
      !this.props.creatorTools.onMinecraftStateChanged.has(this._serverStateChanged)
    ) {
      this.props.creatorTools.onMinecraftStateChanged.subscribe(this._serverStateChanged);
    }
  }

  private _handleItemContentChanged(project: Project, itemUpdate: IProjectItemContentUpdateEvent) {
    if (itemUpdate.fileUpdate.updateType === FileUpdateType.regularEdit) {
      let currentUndoStack = StorageUtilities.getSerializationOfChangeList(this.props.project.getChangeList());

      if (currentUndoStack !== this.state.undoStackState) {
        this._changeUndoStackState(currentUndoStack);
      }
    } else if (itemUpdate.fileUpdate.updateType !== FileUpdateType.versionlessEdit) {
      this._incrementVisualSeed();
    }
  }

  private _serverStateChanged() {
    if (!this._isMountedInternal) {
      return;
    }
    this.forceUpdate();
  }

  private _handleFileDragOut(event: any) {
    const top = event.pageY;
    const left = event.pageX;
    const right = document.body.clientWidth - left;
    const bottom = document.body.clientHeight - top;

    if (
      top < FILE_DRAG_OUT_THRESHOLD ||
      right < FILE_DRAG_OUT_THRESHOLD ||
      bottom < FILE_DRAG_OUT_THRESHOLD ||
      left < FILE_DRAG_OUT_THRESHOLD
    ) {
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
          undoStackIndex: this.state.undoStackIndex,
          effectMode: undefined,
          dragStyle: undefined,
          visualSeed: this.state.visualSeed ? this.state.visualSeed + 1 : 1,
          undoStackState: this.state.undoStackState,
          viewMode: this.state.viewMode,
          allInfoSet: this.props.project.indevInfoSet,
          allInfoSetGenerated: this.props.project.indevInfoSet.completedGeneration,
          displayFileView: this.state.displayFileView,
          menuState: this.state.menuState,
          itemView: this.state.itemView,
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

  private _changeUndoStackState(newChanges?: string) {
    if (this.state !== undefined) {
      this.setState({
        activeProjectItem: this.state.activeProjectItem,
        tentativeProjectItem: this.state.tentativeProjectItem,
        activeReference: this.state.activeReference,
        mode: this.state.mode,
        undoStackIndex: this.state.undoStackIndex,
        effectMode: undefined,
        dragStyle: undefined,
        visualSeed: this.state.visualSeed ? this.state.visualSeed + 1 : 1,
        undoStackState: newChanges,
        viewMode: this.state.viewMode,
        allInfoSet: this.props.project.indevInfoSet,
        allInfoSetGenerated: this.props.project.indevInfoSet.completedGeneration,
        displayFileView: this.state.displayFileView,
        menuState: this.state.menuState,
        itemView: this.state.itemView,
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

  private _incrementVisualSeed() {
    if (this.state !== undefined) {
      this.setState({
        activeProjectItem: this.state.activeProjectItem,
        tentativeProjectItem: this.state.tentativeProjectItem,
        activeReference: this.state.activeReference,
        mode: this.state.mode,
        undoStackIndex: this.state.undoStackIndex,
        effectMode: undefined,
        dragStyle: undefined,
        visualSeed: this.state.visualSeed ? this.state.visualSeed + 1 : 1,
        undoStackState: this.state.undoStackState,
        viewMode: this.state.viewMode,
        allInfoSet: this.props.project.indevInfoSet,
        allInfoSetGenerated: this.props.project.indevInfoSet.completedGeneration,
        displayFileView: this.state.displayFileView,
        menuState: this.state.menuState,
        itemView: this.state.itemView,
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
        this.state.allInfoSet !== this.props.project.indevInfoSet ||
        this.state.allInfoSetGenerated !== this.props.project.indevInfoSet.completedGeneration
      ) {
        this.setState({
          activeProjectItem: this.state.activeProjectItem,
          tentativeProjectItem: this.state.tentativeProjectItem,
          activeReference: this.state.activeReference,
          mode: this.state.mode,
          undoStackIndex: this.state.undoStackIndex,
          effectMode: this.state.effectMode,
          dragStyle: this.state.dragStyle,
          visualSeed: this.state.visualSeed,
          undoStackState: this.state.undoStackState,
          viewMode: this.state.viewMode,
          allInfoSet: this.props.project.indevInfoSet,
          allInfoSetGenerated: this.props.project.indevInfoSet.completedGeneration,
          displayFileView: this.state.displayFileView,
          menuState: this.state.menuState,
          itemView: this.state.itemView,
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
    this._handleDialogDoneAndClear();
  }

  private _handleDialogDoneAndClear(clearActiveProjectItem?: boolean, dialog?: ProjectEditorDialog) {
    if (this.state !== undefined) {
      this.setState({
        activeProjectItem: clearActiveProjectItem ? null : this.state.activeProjectItem,
        tentativeProjectItem: this.state.tentativeProjectItem,
        activeReference: this.state.activeReference,
        mode: this.state.mode,
        undoStackIndex: this.state.undoStackIndex,
        effectMode: undefined,
        dragStyle: undefined,
        dialog: dialog,
        dialogData: this.state.dialogData,
        dialogActiveItem: this.state.dialogActiveItem,
        visualSeed: this.state.visualSeed,
        viewMode: this.state.viewMode,
        allInfoSet: this.props.project.indevInfoSet,
        allInfoSetGenerated: this.props.project.indevInfoSet.completedGeneration,
        displayFileView: this.state.displayFileView,
        menuState: this.state.menuState,
        itemView: this.state.itemView,
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

  private async _handleNewVariantOK() {
    if (this.state.dialogData && this.state.activeProjectItem) {
      const newVariantSeed = this.state.dialogData as IProjectItemVariantSeed;

      await ProjectItemVariantCreateManager.createVariant(this.state.activeProjectItem, newVariantSeed);

      // Save the project and set activeVariant to the newly created variant's label
      // so the variant tab bar selects it. Also increment visualSeed to force re-render.
      await this.props.project.save();

      const newLabel = newVariantSeed.label;
      this.setState({
        visualSeed: this.state.visualSeed ? this.state.visualSeed + 1 : 1,
        activeVariant: newLabel,
      });
    }

    this._handleDialogDone();
  }

  private async _handleIntegrateItemOK() {
    this._handleDialogDone();

    if (this.state.dialogData) {
      const result = await ProjectWebUtilities.processItemSeed(
        this.props.project,
        this.state.dialogData as IProjectItemSeed
      );

      if (result) {
        this._incrementVisualSeed();
      }
    }
  }

  private async _handleConvertOK() {
    this._handleDialogDone();

    if (this.state.dialogData && this.state.dialogActiveItem) {
      let mcworld: MCWorld | undefined = await MCWorld.ensureOnItem(this.state.dialogActiveItem);

      if (mcworld) {
        await ProjectExporter.convertWorld(
          this.props.creatorTools,
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
        // Only activate the overlay for actual file drags from outside the browser,
        // not for internal text-selection drags within form fields.
        // File drags include "Files" in dataTransfer.types; text-selection drags do not.
        if (!event.dataTransfer || !event.dataTransfer.types || !event.dataTransfer.types.includes("Files")) {
          return;
        }

        const top = event.pageY;
        const left = event.pageX;
        const right = document.body.clientWidth - left;
        const bottom = document.body.clientHeight - top;

        if (
          top > FILE_DRAG_OVER_THRESHOLD &&
          right > FILE_DRAG_OVER_THRESHOLD &&
          bottom > FILE_DRAG_OVER_THRESHOLD &&
          left > FILE_DRAG_OVER_THRESHOLD
        ) {
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
            undoStackIndex: this.state.undoStackIndex,
            mode: this.state.mode,
            viewMode: this.state.viewMode,
            allInfoSet: this.props.project.indevInfoSet,
            allInfoSetGenerated: this.props.project.indevInfoSet.completedGeneration,
            displayFileView: this.state.displayFileView,
            itemView: this.state.itemView,
            filteredItems: this.state.filteredItems,
            searchFilter: this.state.searchFilter,
            effectMode: ProjectEditorEffect.dragOver,
            dragStyle: dragStyle,
            visualSeed: this.state.visualSeed,
            undoStackState: this.state.undoStackState,
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

    window.setTimeout(this._doAsyncLoading, ASYNC_LOADING_TIMEOUT);
    window.setInterval(this._editorTick, EDITOR_TICK_INTERVAL);
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

      // Clean up tool pane splitter listeners if still dragging
      document.removeEventListener("mousemove", this._handleToolPaneSplitterMouseMove as any);
      document.removeEventListener("mouseup", this._handleToolPaneSplitterMouseUp as any);
    }
    this._isMountedInternal = false;
  }

  private _editorTick() {
    if (!this.props.project || !this.props.project.projectFolder) {
      return;
    }

    if (this.props.project.projectFolder.storage.getUsesPollingBasedUpdating()) {
      this.props.project.projectFolder.storage.incrementalScanForChanges();
    }
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
    this.props.creatorTools.itemSidePaneWidth = width;

    this.gridElt.current.style.gridTemplateColumns = this.getGridColumnWidths();
  }

  private getAdjustedWidth(ev: React.MouseEvent<HTMLDivElement>) {
    let width = ev.pageX;

    if (
      this.state.viewMode === CreatorToolsEditorViewMode.itemsOnRightAndMinecraftToolbox ||
      this.state.viewMode === CreatorToolsEditorViewMode.itemsOnRight
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

    this.props.creatorTools.itemSidePaneWidth = width;
    this.props.creatorTools.save();

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

              if (top > height / 2 && this.state.activeProjectItem && this.state.activeProjectItem.primaryFile) {
                this.state.activeProjectItem.primaryFile.setContentIfSemanticallyDifferent(content);

                this._stopDragEffect();

                return;
              }
            }
            this.setState({
              activeProjectItem: this.state.activeProjectItem,
              tentativeProjectItem: this.state.tentativeProjectItem,
              activeReference: this.state.activeReference,
              menuState: this.state.menuState,
              undoStackIndex: this.state.undoStackIndex,
              mode: this.state.mode,
              viewMode: this.state.viewMode,
              allInfoSet: this.props.project.indevInfoSet,
              allInfoSetGenerated: this.props.project.indevInfoSet.completedGeneration,
              displayFileView: this.state.displayFileView,
              itemView: this.state.itemView,
              filteredItems: this.state.filteredItems,
              searchFilter: this.state.searchFilter,
              effectMode: undefined,
              dragStyle: undefined,
              visualSeed: this.state.visualSeed,
              undoStackState: this.state.undoStackState,
              dialog: ProjectEditorDialog.integrateItem,
              dialogActiveItem: this.state.activeProjectItem ? this.state.activeProjectItem : undefined,
              dialogData: {
                itemType: typeData.itemType,
                path: file.name,
                fileSource: file,
                fileContent: content,
                action: ProjectItemSeedAction.defaultAction,
              },
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

  // Accepts all file types intentionally — validation and type inference are handled
  // by ProjectEditorUtilities.integrateBrowserFileDefaultAction.
  private async _processIncomingFile(path: string, file: File) {
    if (file != null && this.props.project != null && this.props.project.projectFolder != null) {
      await ProjectEditorUtilities.integrateBrowserFileDefaultAction(this.props.project, path, file);

      if (this._isMountedInternal) {
        this.forceUpdate();
      }
    }
  }

  private _handleHomeClick() {
    telemetry.trackEvent({
      name: TelemetryEvents.HOME_CLICKED,
    });

    if (this.props.onModeChangeRequested != null) {
      this.props.onModeChangeRequested(AppMode.home);
    }
  }

  /**
   * Handle the Close button click in view mode.
   * Sends a shutdown request to the server, then navigates to session ended screen or tries to close the window.
   */
  private async _handleCloseViewClick() {
    try {
      // Get the auth token from CreatorTools
      const ct = this.props.creatorTools;
      const authToken = ct?.remoteServerAuthToken;

      if (!authToken) {
        Log.error("No auth token available for shutdown request");
        return;
      }

      // Send shutdown request to the server
      const response = await fetch("/api/shutdown", {
        method: "POST",
        headers: {
          Authorization: `Bearer mctauth=${authToken}`,
        },
      });

      if (!response.ok) {
        Log.error("Shutdown request failed: " + response.status);
      }

      // Try to close the window (works if opened by script)
      // If that fails, navigate to session ended screen
      try {
        window.close();
      } catch {
        // Window.close() may not work if not opened by script
      }

      // If window didn't close, navigate to session ended screen
      // Give a brief moment for window.close() to take effect
      setTimeout(() => {
        if (this.props.onModeChangeRequested) {
          this.props.onModeChangeRequested(AppMode.sessionEnded);
        }
      }, 100);
    } catch (e: any) {
      Log.error("Error closing view session: " + e.toString());
      // Still try to navigate to session ended
      if (this.props.onModeChangeRequested) {
        this.props.onModeChangeRequested(AppMode.sessionEnded);
      }
    }
  }

  private _handleVscAddClick() {
    AppServiceProxy.sendAsync(
      "executeCommand",
      JSON.stringify({
        command: "mctools.newProject",
        arguments: [],
      })
    ).catch((err) => {
      Log.debug("Error in vsc add click: " + err);
    });
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
    try {
      telemetry.trackEvent({
        name: TelemetryEvents.SAVE_CLICKED,
      });

      await this.save();
    } catch (e) {
      Log.debug("Failed to save: " + e);
    }
  }

  private _setItemsOnLeft() {
    // the menu change to hide the dropdown will fire at the same time, and its state changes will overwrite this one.
    // so wait a beat and update state then.
    window.setTimeout(this._setItemsOnLeftImpl, SPLITTER_DRAG_TIMEOUT);
  }

  private _setItemsOnLeftImpl() {
    if (this.state === null) {
      return;
    }

    const curViewMode = this.state.viewMode;

    let newViewMode = CreatorToolsEditorViewMode.itemsOnLeft;

    if (
      curViewMode === CreatorToolsEditorViewMode.itemsOnRightAndMinecraftToolbox ||
      curViewMode === CreatorToolsEditorViewMode.itemsOnLeftAndMinecraftToolbox
    ) {
      newViewMode = CreatorToolsEditorViewMode.itemsOnLeftAndMinecraftToolbox;
    }

    telemetry.trackEvent({
      name: TelemetryEvents.VIEW_CHANGED,
      properties: {
        [TelemetryProperties.VIEW_MODE]: CreatorToolsEditorViewMode[newViewMode],
        [TelemetryProperties.PREVIOUS_VIEW]:
          curViewMode !== undefined ? CreatorToolsEditorViewMode[curViewMode] : undefined,
        [TelemetryProperties.VIEW_CHANGE_TYPE]: "setItemsOnLeft",
      },
    });

    this.props.creatorTools.editorViewMode = newViewMode;
    this.props.creatorTools.save();

    this.setState({
      activeProjectItem: this.state.activeProjectItem,
      tentativeProjectItem: this.state.tentativeProjectItem,
      mode: this.state.mode,
      viewMode: newViewMode,
      undoStackIndex: this.state.undoStackIndex,
      menuState: ProjectEditorMenuState.noMenu,
      statusAreaMode: this.state.statusAreaMode,
      lastDeployKey: this.state.lastDeployKey,
      displayFileView: this.state.displayFileView,
      dialog: this.state.dialog,
      dialogData: this.state.dialogData,
      dialogActiveItem: this.state.dialogActiveItem,
      itemView: this.state.itemView,
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
    deployFunction: ((e: SyntheticEvent | undefined, data: any | undefined) => Promise<void>) | undefined,
    deployData: any | undefined
  ) {
    this.setState({
      activeProjectItem: this.state.activeProjectItem,
      tentativeProjectItem: this.state.tentativeProjectItem,
      mode: this.state.mode,
      viewMode: this.state.viewMode,
      menuState: this.state.menuState,

      undoStackIndex: this.state.undoStackIndex,
      statusAreaMode: this.state.statusAreaMode,
      lastDeployKey: deployKey,
      dialog: this.state.dialog,
      dialogData: this.state.dialogData,
      dialogActiveItem: this.state.dialogActiveItem,
      itemView: this.state.itemView,
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
    exportFunction: ((e: SyntheticEvent | undefined, data: any | undefined) => Promise<void>) | undefined,
    exportData: any | undefined
  ) {
    this.setState({
      activeProjectItem: this.state.activeProjectItem,
      tentativeProjectItem: this.state.tentativeProjectItem,
      mode: this.state.mode,
      viewMode: this.state.viewMode,
      menuState: this.state.menuState,
      undoStackIndex: this.state.undoStackIndex,
      statusAreaMode: this.state.statusAreaMode,
      lastDeployKey: this.state.lastDeployKey,
      itemView: this.state.itemView,
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
    window.setTimeout(this._setItemsOnRightImpl, SPLITTER_DRAG_TIMEOUT);
  }

  private async _setItemsOnRightImpl() {
    if (this.state === null) {
      return;
    }

    const curViewMode = this.state.viewMode;

    let newViewMode = CreatorToolsEditorViewMode.itemsOnRight;

    if (
      curViewMode === CreatorToolsEditorViewMode.itemsOnRightAndMinecraftToolbox ||
      curViewMode === CreatorToolsEditorViewMode.itemsOnLeftAndMinecraftToolbox
    ) {
      newViewMode = CreatorToolsEditorViewMode.itemsOnRightAndMinecraftToolbox;
    }

    telemetry.trackEvent({
      name: TelemetryEvents.VIEW_CHANGED,
      properties: {
        [TelemetryProperties.VIEW_MODE]: CreatorToolsEditorViewMode[newViewMode],
        [TelemetryProperties.PREVIOUS_VIEW]:
          curViewMode !== undefined ? CreatorToolsEditorViewMode[curViewMode] : undefined,
        [TelemetryProperties.VIEW_CHANGE_TYPE]: "setItemsOnRight",
      },
    });

    this.props.creatorTools.editorViewMode = newViewMode;
    this.props.creatorTools.save();

    this.setState({
      activeProjectItem: this.state.activeProjectItem,
      tentativeProjectItem: this.state.tentativeProjectItem,
      mode: this.state.mode,
      viewMode: newViewMode,
      undoStackIndex: this.state.undoStackIndex,
      menuState: ProjectEditorMenuState.noMenu,
      statusAreaMode: this.state.statusAreaMode,
      lastDeployKey: this.state.lastDeployKey,
      displayFileView: this.state.displayFileView,
      dialog: this.state.dialog,
      dialogData: this.state.dialogData,
      dialogActiveItem: this.state.dialogActiveItem,
      itemView: this.state.itemView,
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
    window.setTimeout(this._viewAsItemsImpl, SPLITTER_DRAG_TIMEOUT);
  }

  private _viewAsItemsImpl() {
    telemetry.trackEvent({
      name: TelemetryEvents.VIEW_CHANGED,
      properties: {
        [TelemetryProperties.VIEW_MODE]: "items",
        [TelemetryProperties.PREVIOUS_VIEW]: this.state.displayFileView ? "files" : "items",
        [TelemetryProperties.VIEW_CHANGE_TYPE]: "viewAsItems",
      },
    });

    this.props.creatorTools.viewAsFiles = false;
    this.props.creatorTools.save();

    this.setState({
      activeProjectItem: this.state.activeProjectItem,
      tentativeProjectItem: this.state.tentativeProjectItem,
      mode: this.state.mode,
      viewMode: this.state.viewMode,
      undoStackIndex: this.state.undoStackIndex,
      menuState: ProjectEditorMenuState.noMenu,
      statusAreaMode: this.state.statusAreaMode,
      lastDeployKey: this.state.lastDeployKey,
      displayFileView: false,
      itemView: this.state.itemView,
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
    window.setTimeout(this._viewAsFilesImpl, SPLITTER_DRAG_TIMEOUT);
  }

  private _viewAsFilesImpl() {
    // In Focused (summarized) mode, file view is not available.
    if (this.props.creatorTools.editPreference === CreatorToolsEditPreference.summarized) {
      return;
    }

    telemetry.trackEvent({
      name: TelemetryEvents.VIEW_CHANGED,
      properties: {
        [TelemetryProperties.VIEW_MODE]: "files",
        [TelemetryProperties.PREVIOUS_VIEW]: this.state.displayFileView ? "files" : "items",
        [TelemetryProperties.VIEW_CHANGE_TYPE]: "viewAsFiles",
      },
    });

    this.props.creatorTools.viewAsFiles = true;
    this.props.creatorTools.save();

    this.setState({
      activeProjectItem: this.state.activeProjectItem,
      tentativeProjectItem: this.state.tentativeProjectItem,
      mode: this.state.mode,
      viewMode: this.state.viewMode,
      undoStackIndex: this.state.undoStackIndex,
      menuState: ProjectEditorMenuState.noMenu,
      statusAreaMode: this.state.statusAreaMode,
      lastDeployKey: this.state.lastDeployKey,
      displayFileView: true,
      itemView: this.state.itemView,
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
    window.setTimeout(this._setMainFocusImpl, SPLITTER_DRAG_TIMEOUT);
  }

  private async _setMainFocusImpl() {
    if (this.state === null) {
      return;
    }

    this.applyViewMode(CreatorToolsEditorViewMode.mainFocus);
  }

  private _setToolboxFocus() {
    window.setTimeout(this._setToolboxFocusImpl, SPLITTER_DRAG_TIMEOUT);
  }

  private async _setToolboxFocusImpl() {
    if (this.state === null) {
      return;
    }

    this.applyViewMode(CreatorToolsEditorViewMode.toolboxFocus);
  }

  private _setItemsFocus() {
    window.setTimeout(this._setItemsFocusImpl, SPLITTER_DRAG_TIMEOUT);
  }

  private _setToVersion(event: React.SyntheticEvent<HTMLElement>, data?: any) {
    if (data && data.content && (data.content as any).key) {
      const targetKey = (data.content as any).key as string;

      let pipeIndex = targetKey.lastIndexOf("|");

      if (pipeIndex >= 0) {
        this.props.project.setToVersion(targetKey.substring(pipeIndex + 1));
      }
    }
  }

  private async _setItemsFocusImpl() {
    if (this.state === null) {
      return;
    }

    this.applyViewMode(CreatorToolsEditorViewMode.itemsFocus);
  }

  private _setToolboxLandingFocus() {
    window.setTimeout(this._setToolboxLandingFocusImpl, SPLITTER_DRAG_TIMEOUT);
  }

  private async _setToolboxLandingFocusImpl() {
    if (this.state === null) {
      return;
    }

    this.applyViewMode(CreatorToolsEditorViewMode.codeLanding);
  }

  private applyViewMode(newViewMode: CreatorToolsEditorViewMode) {
    telemetry.trackEvent({
      name: TelemetryEvents.VIEW_CHANGED,
      properties: {
        [TelemetryProperties.VIEW_MODE]: CreatorToolsEditorViewMode[newViewMode],
        [TelemetryProperties.PREVIOUS_VIEW]:
          this.state?.viewMode !== undefined ? CreatorToolsEditorViewMode[this.state.viewMode] : undefined,
        [TelemetryProperties.VIEW_CHANGE_TYPE]: "applyViewMode",
      },
    });

    this.props.creatorTools.editorViewMode = newViewMode;
    this.props.creatorTools.save();

    this.setState({
      activeProjectItem: this.state.activeProjectItem,
      tentativeProjectItem: this.state.tentativeProjectItem,
      mode: this.state.mode,
      viewMode: newViewMode,
      menuState: ProjectEditorMenuState.noMenu,
      statusAreaMode: this.state.statusAreaMode,
      itemView: this.state.itemView,
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
    window.setTimeout(this._toggleWorldToolsImpl, SPLITTER_DRAG_TIMEOUT);
  }

  private _handleToolPaneSplitterDrag(ev: React.MouseEvent<HTMLDivElement>) {
    this._toolPaneSplitterDrag = true;
    ev.preventDefault();
    ev.stopPropagation();

    // Add document-level event listeners for mouse move and up
    document.addEventListener("mousemove", this._handleToolPaneSplitterMouseMove as any);
    document.addEventListener("mouseup", this._handleToolPaneSplitterMouseUp as any);
  }

  private _handleToolPaneSplitterMouseMove(ev: MouseEvent | React.MouseEvent<HTMLDivElement>) {
    if (!this._toolPaneSplitterDrag || !this._containerElt.current) {
      return;
    }

    const containerRect = this._containerElt.current.getBoundingClientRect();
    let width = containerRect.right - ev.clientX;

    if (width < SidePaneMinWidth) {
      width = SidePaneMinWidth;
    }
    if (width > SidePaneMaxWidth) {
      width = SidePaneMaxWidth;
    }

    this.props.creatorTools.toolPaneWidth = width;
    this.forceUpdate();
  }

  private _handleToolPaneSplitterMouseUp(ev: MouseEvent | React.MouseEvent<HTMLDivElement>) {
    if (!this._toolPaneSplitterDrag) {
      return;
    }

    if (this._containerElt.current) {
      const containerRect = this._containerElt.current.getBoundingClientRect();
      let width = containerRect.right - ev.clientX;

      if (width < SidePaneMinWidth) {
        width = SidePaneMinWidth;
      }
      if (width > SidePaneMaxWidth) {
        width = SidePaneMaxWidth;
      }

      this.props.creatorTools.toolPaneWidth = width;
      this.props.creatorTools.save();
    }

    this._toolPaneSplitterDrag = false;

    // Remove document-level event listeners
    document.removeEventListener("mousemove", this._handleToolPaneSplitterMouseMove as any);
    document.removeEventListener("mouseup", this._handleToolPaneSplitterMouseUp as any);
  }

  private async _toggleWorldToolsImpl() {
    if (this.state === null) {
      return;
    }

    const curViewMode = this.state.viewMode;
    let newViewMode = CreatorToolsEditorViewMode.itemsOnRight;

    if (curViewMode === CreatorToolsEditorViewMode.itemsOnLeftAndMinecraftToolbox) {
      newViewMode = CreatorToolsEditorViewMode.itemsOnLeft;
    } else if (curViewMode === CreatorToolsEditorViewMode.itemsOnLeft) {
      newViewMode = CreatorToolsEditorViewMode.itemsOnLeftAndMinecraftToolbox;
    } else if (curViewMode === CreatorToolsEditorViewMode.itemsOnRightAndMinecraftToolbox) {
      newViewMode = CreatorToolsEditorViewMode.itemsOnRight;
    } else if (curViewMode === CreatorToolsEditorViewMode.itemsOnRight) {
      newViewMode = CreatorToolsEditorViewMode.itemsOnRightAndMinecraftToolbox;
    }

    this.props.creatorTools.editorViewMode = newViewMode;
    this.props.creatorTools.save();

    this.setState({
      activeProjectItem: this.state.activeProjectItem,
      tentativeProjectItem: this.state.tentativeProjectItem,
      mode: this.state.mode,
      viewMode: newViewMode,
      menuState: ProjectEditorMenuState.noMenu,
      statusAreaMode: this.state.statusAreaMode,
      displayFileView: this.state.displayFileView,
      itemView: this.state.itemView,
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

    const projName = await this.props.project.loc.getTokenValue(this.props.project.simplifiedName);

    const operId = await this.props.creatorTools.notifyOperationStarted("Saving project '" + projName + "'...");

    await this._ensurePersisted();

    await ProjectAutogeneration.updateProjectAutogeneration(this.props.project, false);

    await this.props.creatorTools.save();

    await this.props.project.save();

    if (this.props.project.projectFolder && this.props.project.projectFolder instanceof BrowserFolder) {
      const persistResult = await this.ensurePersistentBrowserStorage();

      if (persistResult && this.props.isPersisted) {
        await this.props.creatorTools.notifyOperationEnded(operId, "Saved '" + projName + "'.");
      } else {
        await this.props.creatorTools.notifyOperationEnded(
          operId,
          "✅ Saved '" + projName + "'. Use Export → Download & Install in Minecraft to keep a permanent copy."
        );
      }
    } else {
      await this.props.creatorTools.notifyOperationEnded(operId, "Saved '" + projName + "'.");
    }
  }

  private async ensurePersistentBrowserStorage() {
    if (!AppServiceProxy.hasAppService && !this.props.creatorTools.hasAttemptedPersistentBrowserStorageSwitch) {
      const isPersisted = await WebUtilities.getIsPersisted();

      if (!isPersisted) {
        const couldPersist = await WebUtilities.requestPersistence();

        if (!couldPersist) {
          return false;
        } else if (couldPersist && this.props.onPersistenceUpgraded) {
          this.props.creatorTools.hasAttemptedPersistentBrowserStorageSwitch = true;
          this.props.onPersistenceUpgraded();
        }
      }
    }

    return true;
  }

  private async _showMinecraftClick() {
    /*if (this.props.carto.minecraft === undefined) {
      Log.unexpectedUndefined("PESMC");
      return;
    }*/

    //this.props.carto.minecraft.connect();

    let nextViewMode = this.state.viewMode;

    if (nextViewMode === CreatorToolsEditorViewMode.itemsFocus) {
      nextViewMode = CreatorToolsEditorViewMode.mainFocus;
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
      itemView: this.state.itemView,
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

    if (newViewMode === CreatorToolsEditorViewMode.toolboxFocus) {
      if (this.props.isHosted) {
        newViewMode = CreatorToolsEditorViewMode.mainFocus;
      } else {
        newViewMode = this.props.creatorTools.editorViewMode;
      }
    } else if (newViewMode === CreatorToolsEditorViewMode.itemsFocus) {
      newViewMode = CreatorToolsEditorViewMode.mainFocus;
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
      itemView: this.state.itemView,
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

  private _toggleUndoMenuOpen() {
    let menuVal = ProjectEditorMenuState.noMenu;

    if (this.state.menuState === ProjectEditorMenuState.noMenu) {
      menuVal = ProjectEditorMenuState.undoMenu;
    }

    this.setMenuState(menuVal);
  }

  private _toggleRedoMenuOpen() {
    let menuVal = ProjectEditorMenuState.noMenu;

    if (this.state.menuState === ProjectEditorMenuState.noMenu) {
      menuVal = ProjectEditorMenuState.redoMenu;
    }

    this.setMenuState(menuVal);
  }

  private setMenuState(menuState: ProjectEditorMenuState) {
    this.setState({
      activeProjectItem: this.state.activeProjectItem,
      tentativeProjectItem: this.state.tentativeProjectItem,
      mode: this.state.mode,
      viewMode: this.state.viewMode,
      menuState: menuState,
      itemView: this.state.itemView,
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

  private _handleExportMenuOpen() {
    let menuVal = ProjectEditorMenuState.noMenu;

    if (this.state.menuState === ProjectEditorMenuState.noMenu) {
      menuVal = ProjectEditorMenuState.exportMenu;
    }

    this.setMenuState(menuVal);
  }

  private _handleDeployMenuOpen() {
    let menuVal = ProjectEditorMenuState.noMenu;

    if (this.state.menuState === ProjectEditorMenuState.noMenu) {
      menuVal = ProjectEditorMenuState.deployMenu;
    }

    this.setMenuState(menuVal);
  }

  private _handleViewMenuOpen() {
    let menuVal = ProjectEditorMenuState.noMenu;

    if (this.state.menuState === ProjectEditorMenuState.noMenu) {
      menuVal = ProjectEditorMenuState.viewMenu;
    }

    this.setMenuState(menuVal);
  }

  private _setEditPreference(preference: CreatorToolsEditPreference) {
    this.props.creatorTools.editPreference = preference;
    this.props.creatorTools.save();
    this._incrementVisualSeed();
  }

  private _handleSetFocusedMode() {
    this._setEditPreference(CreatorToolsEditPreference.summarized);
  }

  private _handleSetFullMode() {
    this._setEditPreference(CreatorToolsEditPreference.editors);
  }

  private _handleSetRawMode() {
    this._setEditPreference(CreatorToolsEditPreference.raw);
  }

  private _handleItemMenuOpen() {
    let menuVal = ProjectEditorMenuState.noMenu;

    if (this.state.menuState === ProjectEditorMenuState.noMenu) {
      menuVal = ProjectEditorMenuState.itemMenu;
    }

    this.setMenuState(menuVal);
  }

  private async _handleGetShareableLinkClick(e: SyntheticEvent | undefined, data: any | undefined) {
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
        allInfoSet: this.props.project.indevInfoSet,
        allInfoSetGenerated: this.props.project.indevInfoSet.completedGeneration,
        displayFileView: this.state.displayFileView,
        itemView: this.state.itemView,
        filteredItems: this.state.filteredItems,
        searchFilter: this.state.searchFilter,
        effectMode: this.state.effectMode,
        dragStyle: this.state.dragStyle,
        visualSeed: this.state.visualSeed,
        undoStackState: this.state.undoStackState,
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

  private async _handleChangeWorldSettingsClick(e: SyntheticEvent | undefined, data: any | undefined) {
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
        allInfoSet: this.props.project.indevInfoSet,
        allInfoSetGenerated: this.props.project.indevInfoSet.completedGeneration,
        displayFileView: this.state.displayFileView,
        itemView: this.state.itemView,
        filteredItems: this.state.filteredItems,
        searchFilter: this.state.searchFilter,
        effectMode: this.state.effectMode,
        dragStyle: this.state.dragStyle,
        visualSeed: this.state.visualSeed,
        undoStackState: this.state.undoStackState,
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

  private async _handleExportMCAddonClick(e: SyntheticEvent | undefined, data: any | undefined) {
    if (this.props.project == null) {
      return;
    }

    let operId: number | undefined;
    try {
      telemetry.trackEvent({
        name: TelemetryEvents.SHARE_ADDON_FILE,
        properties: {
          [TelemetryProperties.SHARE_METHOD]: "mcaddon",
          [TelemetryProperties.SHARE_TYPE]: "download",
        },
      });

      await ProjectStandard.ensureIsStandard(this.props.project);

      await this._ensurePersisted();

      const projName = await this.props.project.loc.getTokenValue(this.props.project.name);

      operId = await this.props.creatorTools.notifyOperationStarted("Exporting '" + projName + "' as MCAddon");

      const zipBinary = (await ProjectExporter.generateMCAddonAsZip(
        this.props.creatorTools,
        this.props.project,
        true
      )) as Blob;

      saveAs(zipBinary, projName + ".mcaddon");

      await this.props.creatorTools.notifyOperationEnded(
        operId,
        "Export of '" + projName + "' as MCAddon complete; downloading"
      );
      operId = undefined;

      if (data && data.icon && (data.icon as any).key) {
        this._setNewExportKey((data.icon as any).key, this._handleExportMCAddonClick, data);
      }
    } catch (e) {
      await this._handleExportFailure("Export MCAddon", e, operId);
    }
  }

  private async _handleExportToLocalFolderClick(e: SyntheticEvent | undefined, data: any | undefined) {
    try {
      telemetry.trackEvent({
        name: TelemetryEvents.EXPORT_TO_FOLDER,
        properties: {
          [TelemetryProperties.SHARE_METHOD]: "folder",
        },
      });

      await this._ensurePersisted();

      await ProjectStandard.ensureIsStandard(this.props.project);

      await ProjectEditorUtilities.launchLocalExport(this.props.creatorTools, this.props.project);

      if (data && data.icon && (data.icon as any).key) {
        this._setNewExportKey((data.icon as any).key, this._handleExportToLocalFolderClick, data);
      }
    } catch (e) {
      await this._handleExportFailure("Export to local folder", e);
    }
  }

  private async _handleConvertToClick(e: SyntheticEvent | undefined, data: any | undefined) {
    try {
      if (data === undefined || typeof data.content !== "string") {
        return;
      }

      await ProjectStandard.ensureIsStandard(this.props.project);

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
            allInfoSet: this.props.project.indevInfoSet,
            allInfoSetGenerated: this.props.project.indevInfoSet.completedGeneration,
            displayFileView: this.state.displayFileView,
            itemView: this.state.itemView,
            filteredItems: this.state.filteredItems,
            searchFilter: this.state.searchFilter,
            effectMode: this.state.effectMode,
            dragStyle: this.state.dragStyle,
            visualSeed: this.state.visualSeed,
            undoStackState: this.state.undoStackState,
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
    } catch (e) {
      Log.debug("Failed to convert project: " + e);
    }
  }

  private async _handleExportZipClick(e: SyntheticEvent | undefined, data: any | undefined) {
    let operId: number | undefined;
    try {
      telemetry.trackEvent({
        name: TelemetryEvents.PROJECT_EXPORTED,
        properties: {
          [TelemetryProperties.EXPORT_TYPE]: "projectFullZip",
        },
      });

      await this.save();

      await ProjectStandard.ensureIsStandard(this.props.project);

      const projName = await this.props.project.loc.getTokenValue(this.props.project.name);
      operId = await this.props.creatorTools.notifyOperationStarted("Exporting '" + projName + "' as zip");

      await ProjectEditorUtilities.launchZipExport(this.props.creatorTools, this.props.project);

      await this.props.creatorTools.notifyOperationEnded(operId, "Export of '" + projName + "' complete");
      operId = undefined;

      if (data && data.icon && (data.icon as any).key) {
        this._setNewExportKey((data.icon as any).key, this._handleExportZipClick, data);
      }
    } catch (e) {
      await this._handleExportFailure("Export zip", e, operId);
    }
  }

  private async _handleExportFailure(action: string, error: unknown, operationId?: number) {
    const message = error instanceof Error ? error.message : String(error);
    const statusMessage = `${action} failed: ${message}`;
    if (operationId !== undefined) {
      await this.props.creatorTools.notifyOperationEnded(operationId, statusMessage, undefined, true);
    } else {
      this.props.creatorTools.notifyStatusUpdate(statusMessage);
    }
    Log.debug(statusMessage);
  }

  private _getNavigationFallbackText(item: ProjectInfoItem): string | undefined {
    if (item.content) {
      return item.content.split(/\r?\n/)[0];
    }

    if (typeof item.data === "string" || typeof item.data === "number") {
      return String(item.data);
    }

    return undefined;
  }

  private async _buildNavigationTarget(
    item: ProjectInfoItem,
    projectItem: ProjectItem
  ): Promise<IProjectItemEditorNavigationTarget | undefined> {
    if (!projectItem.projectPath) {
      return undefined;
    }

    let lineNumber: number | undefined;
    let column: number | undefined;

    const content = await projectItem.getStringContent();
    if (content) {
      const location = await ProjectInfoSet.findLineLocationForItem(content, item);
      if (location) {
        lineNumber = location.lineNumber;
        column = location.column;
      }
    }

    const searchText = lineNumber ? undefined : this._getNavigationFallbackText(item);

    return {
      requestId: this._nextNavigationRequestId++,
      projectPath: projectItem.projectPath,
      lineNumber,
      column,
      searchText,
    };
  }

  private async _handleInfoItemCommand(command: InfoItemCommand, item: ProjectInfoItem | IProjectUpdaterReference) {
    if (command === InfoItemCommand.itemSelect && item instanceof ProjectInfoItem) {
      const projectItem =
        item.projectItem ??
        (item.projectItemPath ? this.props.project.getItemByProjectPath(item.projectItemPath) : null);
      if (projectItem) {
        const navigationTarget = await this._buildNavigationTarget(item, projectItem);
        await this._handleProjectItemSelected(projectItem, ProjectItemEditorView.singleFileRaw);
        if (navigationTarget) {
          this.setState({ editorNavigationTarget: navigationTarget });
        }
      }
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

  private async _handleDeployToRemoteServerClick(e: SyntheticEvent | undefined, data: any | undefined) {
    try {
      if (this.props.creatorTools.deploymentStorage == null) {
        return;
      }

      this.props.creatorTools.notifyStatusUpdate("Deploying to '" + this.props.creatorTools.remoteServerUrl + "'");

      await this._ensurePersisted();
      await this.props.project.save();

      this.props.creatorTools.ensureRemoteMinecraft();

      this.props.creatorTools.remoteMinecraft?.prepareAndStart({
        project: this.props.project,
      });

      if (data && data.icon && (data.icon as any).key) {
        this._setNewDeployKey((data.icon as any).key, this._handleDeployToRemoteServerClick, data);
      }
    } catch (e) {
      Log.debug("Failed to deploy to remote server: " + e);
    }
  }

  private async _handleDeployPacksToMinecraftGameClick(e: SyntheticEvent | undefined, data: any | undefined) {
    try {
      if (this.props.creatorTools.deploymentStorage == null) {
        return;
      }

      await this._deployToGame(MinecraftPushWorldType.none);

      if (data && data.icon && (data.icon as any).key) {
        this._setNewDeployKey((data.icon as any).key, this._handleDeployPacksToMinecraftGameClick, data);
      }
    } catch (e) {
      Log.debug("Failed to deploy packs to Minecraft: " + e);
    }
  }

  private async _handleDeployPacksAndWorldsToMinecraftGameClick(e: SyntheticEvent | undefined, data: any | undefined) {
    try {
      if (this.props.creatorTools.deploymentStorage == null) {
        return;
      }

      await this._deployToGame(MinecraftPushWorldType.inferFromProject);

      if (data && data.icon && (data.icon as any).key) {
        this._setNewDeployKey((data.icon as any).key, this._handleDeployPacksToMinecraftGameClick, data);
      }
    } catch (e) {
      Log.debug("Failed to deploy packs and worlds: " + e);
    }
  }

  private async _handleDeployPacksAndWorldsToMinecraftGameAndOpenClick(
    e: SyntheticEvent | undefined,
    data: any | undefined
  ) {
    try {
      if (this.props.creatorTools.deploymentStorage == null) {
        return;
      }

      const result = await this._deployToGame(MinecraftPushWorldType.inferFromProject);

      if (result?.worldName) {
        AppServiceProxy.sendAsync(AppServiceProxyCommands.minecraftShell, "mode/?load=" + result.worldName);
      }

      if (data && data.icon && (data.icon as any).key) {
        this._setNewDeployKey((data.icon as any).key, this._handleDeployPacksToMinecraftGameClick, data);
      }
    } catch (e) {
      Log.debug("Failed to deploy and open: " + e);
    }
  }

  private async _handleDeployToDedicatedServerClick(e: SyntheticEvent | undefined, data: any | undefined) {
    try {
      // Set flavor to BDS (Dedicated Server via process hosting)
      this.props.creatorTools.setMinecraftFlavor(MinecraftFlavor.processHostedProxy);

      // Start BDS and deploy project packs
      this.props.creatorTools.prepareAndStartToMinecraft({
        worldType: MinecraftPushWorldType.flat,
        project: this.props.project,
      });

      // Navigate to the BDS management screen to show server logs
      let nextViewMode = this.state.viewMode;

      if (nextViewMode === CreatorToolsEditorViewMode.itemsFocus) {
        nextViewMode = CreatorToolsEditorViewMode.mainFocus;
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
        itemView: this.state.itemView,
        filteredItems: this.state.filteredItems,
        searchFilter: this.state.searchFilter,
        lastDeployFunction: this.state.lastDeployFunction,
        lastExportFunction: this.state.lastExportFunction,
        lastDeployData: this.state.lastDeployData,
        lastExportData: this.state.lastExportData,
      });

      if (data && data.icon && (data.icon as any).key) {
        this._setNewDeployKey((data.icon as any).key, this._handleDeployToDedicatedServerClick, data);
      }
    } catch (e) {
      Log.debug("Failed to deploy to dedicated server: " + e);
    }
  }

  private async _deployToGame(worldType: MinecraftPushWorldType) {
    if (this.props.creatorTools.deploymentStorage == null) {
      return;
    }

    let productPhrase = "Minecraft";

    if (this.props.creatorTools.minecraftGameMode === MinecraftGameConnectionMode.localMinecraftPreview) {
      productPhrase = "Minecraft Preview";
    }

    const operId = await this.props.creatorTools.notifyOperationStarted("Deploying to " + productPhrase);

    this.props.creatorTools.ensureGameMinecraft();

    if (!this.props.creatorTools.gameMinecraft) {
      Log.assertDefined(this.props.creatorTools.gameMinecraft);
      return;
    }

    await this._ensurePersisted();
    await this.props.project.save();

    const result = await this.props.creatorTools.gameMinecraft.prepareAndStart({
      project: this.props.project,
      worldType: worldType,
    });

    await this.props.creatorTools.notifyOperationEnded(operId, "Deploying to " + productPhrase);

    return result;
  }

  private async _handleExportDeploymentZipClick(e: SyntheticEvent | undefined, data: any | undefined) {
    let operId: number | undefined;
    try {
      telemetry.trackEvent({
        name: TelemetryEvents.PROJECT_EXPORTED,
        properties: {
          [TelemetryProperties.EXPORT_TYPE]: "deploymentFolderFullZip",
        },
      });

      if (this.props.creatorTools.deploymentStorage == null) {
        return;
      }

      await ProjectStandard.ensureIsStandard(this.props.project);

      const projName = await this.props.project.loc.getTokenValue(this.props.project.name);

      operId = await this.props.creatorTools.notifyOperationStarted("Exporting deployment zip of '" + projName + "'");

      await this._ensurePersisted();

      this.props.creatorTools.save();

      await this.props.project.save();

      const dep = this.props.creatorTools.defaultDeploymentTarget;

      if (dep && dep.deployBehaviorPacksFolder) {
        const result = await ProjectExporter.deployProject(
          this.props.creatorTools,
          this.props.project,
          dep.storage.rootFolder
        );

        if (!result) {
          await this.props.creatorTools.notifyOperationEnded(operId);
          operId = undefined;

          return;
        }

        let zipStorage: ZipStorage | undefined;

        zipStorage = new ZipStorage();

        const deployFolder = dep?.storage.rootFolder;

        await StorageUtilities.syncFolderTo(deployFolder, zipStorage.rootFolder, true, true, false, [
          "/mcworlds",
          "/minecraftWorlds",
        ]);

        await zipStorage.rootFolder.saveAll();

        const zipBinary = await zipStorage.generateBlobAsync();

        saveAs(zipBinary, projName + ".zip");

        await this.props.creatorTools.notifyOperationEnded(
          operId,
          "Export deployment zip of '" + projName + "' complete; downloading"
        );
        operId = undefined;
      }
      if (data && data.icon && (data.icon as any).key) {
        this._setNewExportKey((data.icon as any).key, this._handleExportDeploymentZipClick, data);
      }
    } catch (e) {
      await this._handleExportFailure("Export deployment zip", e, operId);
    }
  }

  _handleProjectWorldSettingsChanged(worldSettings: IWorldSettings) {
    if (!this.props.project) {
      return;
    }

    this.props.project.save();
  }

  private async _handleDeployAsZipClick(e: SyntheticEvent | undefined, data: any | undefined) {
    let operId: number | undefined;
    try {
      telemetry.trackEvent({
        name: TelemetryEvents.PROJECT_SHARED,
        properties: {
          [TelemetryProperties.SHARE_TYPE]: "deploymentZip",
        },
      });

      if (this.props.creatorTools.deploymentStorage == null) {
        return;
      }

      await ProjectStandard.ensureIsStandard(this.props.project);

      const projName = await this.props.project.loc.getTokenValue(this.props.project.name);

      operId = await this.props.creatorTools.notifyOperationStarted("Exporting deployment zip of '" + projName + "'");

      await this._ensurePersisted();

      this.props.creatorTools.save();

      await this.props.project.save();

      const dep = this.props.creatorTools.defaultDeploymentTarget;

      if (dep && dep.deployBehaviorPacksFolder) {
        const result = await ProjectExporter.deployProject(
          this.props.creatorTools,
          this.props.project,
          dep.storage.rootFolder
        );

        if (!result) {
          await this.props.creatorTools.notifyOperationEnded(operId);
          operId = undefined;

          return;
        }

        let zipStorage: ZipStorage | undefined;

        zipStorage = new ZipStorage();

        const deployFolder = dep.storage.rootFolder;

        await StorageUtilities.syncFolderTo(deployFolder, zipStorage.rootFolder, true, true, false, [
          "/mcworlds",
          "/minecraftWorlds",
        ]);

        await zipStorage.rootFolder.saveAll();

        const zipBinary = await zipStorage.generateBlobAsync();

        saveAs(zipBinary, projName + ".zip");

        await this.props.creatorTools.notifyOperationEnded(
          operId,
          "Deploy zip of '" + projName + "' complete; downloading"
        );
        operId = undefined;
      }
      if (data && data.icon && (data.icon as any).key) {
        this._setNewDeployKey((data.icon as any).key, this._handleDeployAsZipClick, data);
      }
    } catch (e) {
      await this._handleExportFailure("Deploy as zip", e, operId);
    }
  }

  private async _handleDeployWorldAndTestAssetsLocalClick(e: SyntheticEvent | undefined, data: any | undefined) {
    try {
      if (data === undefined || typeof data.content !== "string") {
        return;
      }

      await ProjectStandard.ensureIsStandard(this.props.project);

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

      if (this.props.creatorTools.deploymentStorage == null) {
        return;
      }

      await this._ensurePersisted();

      this.props.creatorTools.notifyStatusUpdate("Saving...");
      await this.props.project.save();
      this.props.creatorTools.notifyStatusUpdate("Saved");

      await ProjectExporter.generateAndInvokeFlatPackRefMCWorld(this.props.creatorTools, this.props.project);

      Log.message("Done saving " + projectItem.name, this.props.project.name);

      if (data && data.icon && (data.icon as any).key) {
        this._setNewDeployKey((data.icon as any).key, this._handleDeployWorldAndTestAssetsLocalClick, data);
      }
    } catch (e) {
      Log.debug("Failed to deploy world and test assets locally: " + e);
    }
  }

  private async _handleDeployWorldAndTestAssetsPackClick(e: SyntheticEvent | undefined, data: any | undefined) {
    try {
      if (data === undefined || typeof data.content !== "string") {
        return;
      }

      await ProjectStandard.ensureIsStandard(this.props.project);

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

      if (this.props.creatorTools.deploymentStorage == null) {
        return;
      }

      await this._ensurePersisted();

      this.props.creatorTools.notifyStatusUpdate("Saving...");
      await this.props.project.save();
      this.props.creatorTools.notifyStatusUpdate("Saved");

      const zipBytes = await ProjectExporter.deployAsWorldAndTestAssets(
        this.props.creatorTools,
        this.props.project,
        projectItem,
        true
      );

      const date = new Date();
      const downloadTitle = projectItem.name + " deployment - " + Utilities.getFriendlySummarySeconds(date);

      if (zipBytes instanceof Uint8Array) {
        saveAs(new Blob([zipBytes as BlobPart], { type: "application/octet-stream" }), downloadTitle + ".mcworld");
      }

      Log.message("Done saving " + projectItem.name, this.props.project.name);

      this.props.creatorTools.notifyStatusUpdate("Downloading deployment zip '" + downloadTitle + ".mcworld'.");

      //  this._setNewDeployKey(data.className);

      if (data && data.icon && (data.icon as any).key) {
        this._setNewDeployKey((data.icon as any).key, this._handleDeployWorldAndTestAssetsPackClick, data);
      }
    } catch (e) {
      await this._handleExportFailure("Deploy world and test assets", e);
    }
  }

  private async _handleDeployWorldPackClick(e: SyntheticEvent | undefined, data: any | undefined) {
    try {
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

      if (this.props.creatorTools.deploymentStorage == null) {
        return;
      }

      await this._ensurePersisted();

      this.props.creatorTools.notifyStatusUpdate("Saving...");
      await this.props.project.save();
      this.props.creatorTools.notifyStatusUpdate("Saved");

      const zipBytes = await ProjectExporter.deployAsWorld(
        this.props.creatorTools,
        this.props.project,
        projectItem,
        true
      );

      const date = new Date();
      const downloadTitle = projectItem.name + " deployment - " + Utilities.getFriendlySummarySeconds(date);

      if (zipBytes instanceof Uint8Array) {
        saveAs(new Blob([zipBytes as BlobPart], { type: "application/octet-stream" }), downloadTitle + ".mcworld");
      }

      Log.message("Done saving " + projectItem.name, this.props.project.name);

      this.props.creatorTools.notifyStatusUpdate("Downloading deployment zip '" + downloadTitle + ".mcworld'.");

      if (data && data.icon && (data.icon as any).key) {
        this._setNewDeployKey((data.icon as any).key, this._handleDeployWorldAndTestAssetsPackClick, data);
      }
    } catch (e) {
      await this._handleExportFailure("Deploy world pack", e);
    }
  }

  private async _handleExportWorld(e: SyntheticEvent | undefined, data: any | undefined) {
    try {
      if (data === undefined || typeof data.content !== "string") {
        return;
      }

      const projectItem = this._getProjectItemFromName(data.content, "world", [
        ProjectItemType.MCWorld,
        ProjectItemType.MCTemplate,
        ProjectItemType.worldFolder,
      ]);

      if (!projectItem || !projectItem.primaryFile) {
        Log.debugAlert("Could not find respective project item.");
        return;
      }

      await this._ensurePersisted();

      this.props.creatorTools.notifyStatusUpdate("Saving...");
      await this.props.project.save();
      this.props.creatorTools.notifyStatusUpdate("Saved");

      const date = new Date();
      let downloadTitle = projectItem.name + " - " + Utilities.getFriendlySummarySeconds(date);

      const zipBytes = projectItem.primaryFile.content;

      if (projectItem.itemType === ProjectItemType.MCWorld) {
        downloadTitle += ".mcworld";
      } else {
        downloadTitle += ".mctemplate";
      }

      if (zipBytes instanceof Uint8Array) {
        saveAs(new Blob([zipBytes as BlobPart], { type: "application/octet-stream" }), downloadTitle);
      }

      Log.message("Done saving " + projectItem.name, this.props.project.name);

      this.props.creatorTools.notifyStatusUpdate("Downloading " + downloadTitle + ".");

      if (data && data.icon && (data.icon as any).key) {
        this._setNewExportKey((data.icon as any).key, this._handleExportWorld, data);
      }
    } catch (e) {
      await this._handleExportFailure("Export world", e);
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
    try {
      await this._ensurePersisted();

      // Redirect File Map to Actions in Focused/summarized mode
      if (this.props.creatorTools.editPreference === CreatorToolsEditPreference.summarized) {
        if (newMode === ProjectEditorMode.map) {
          newMode = ProjectEditorMode.actions;
        }
      }

      this._activeEditorPersistable = undefined;

      this._setHash(ProjectEditorUtilities.getProjectEditorModeString(newMode));
      let newStateViewMode = this.state.viewMode;

      if (this.state.viewMode === CreatorToolsEditorViewMode.itemsFocus) {
        newStateViewMode = CreatorToolsEditorViewMode.mainFocus;
      }

      this.setState({
        activeProjectItem: this.state.activeProjectItem,
        tentativeProjectItem: this.state.tentativeProjectItem,
        menuState: this.state.menuState,
        viewMode: newStateViewMode,
        mode: newMode,
        itemView: this.state.itemView,
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
    } catch (e) {
      Log.debug("Failed to change mode: " + e);
    }
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
      itemView: this.state.itemView,
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

  private async _handleDownloadMCWorld(e: SyntheticEvent | undefined, data: any | undefined) {
    try {
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

      if (!projectItem.isContentLoaded) {
        await projectItem.loadContent();
      }

      if (projectItem.primaryFile === null) {
        return;
      }

      const content = projectItem.primaryFile.content;

      Log.message("About to save " + projectItem.primaryFile.name, this.props.project.name);

      this.props.creatorTools.notifyStatusUpdate("Preparing your project for download...");

      if (content instanceof Uint8Array) {
        saveAs(new Blob([content as BlobPart], { type: "application/octet-stream" }), projectItem.primaryFile.name);
      }

      Log.message("Done saving " + projectItem.primaryFile.name, this.props.project.name);

      this.props.creatorTools.notifyStatusUpdate(
        "Download started! Check your Downloads folder for '" + projectItem.primaryFile.name + "'."
      );

      if (data && data.icon && (data.icon as any).key) {
        this._setNewDeployKey((data.icon as any).key, this._handleDownloadMCWorld, data);
      }
    } catch (e) {
      await this._handleExportFailure("Download mcworld", e);
    }
  }

  _itemMenuClick(e: SyntheticEvent<HTMLElement, Event>, data?: any | undefined) {
    if (
      data !== undefined &&
      data.tag !== undefined &&
      this.props.project !== null &&
      data.tag.path !== undefined &&
      data.tag.action !== undefined
    ) {
      const me = this;

      window.setTimeout(() => {
        me.handleProjectItemAction(data.tag.path, data.tag.action);
      }, 1);
    }

    e.stopPropagation();
    e.preventDefault();
  }

  private async _handleDownloadMCWorldWithPacks(e: SyntheticEvent | undefined, data: any | undefined) {
    try {
      if (data === undefined || typeof data.content !== "string") {
        return;
      }

      await this._ensurePersisted();

      const projectItem = this._getProjectItemFromName(data.content, "World with packs embedded");

      if (projectItem === undefined) {
        return;
      }

      if (!projectItem.isContentLoaded) {
        await projectItem.loadContent();
      }

      if (projectItem.primaryFile === null) {
        return;
      }

      const content = projectItem.primaryFile.content;

      if (content instanceof Uint8Array) {
        await this.saveAsWorldWithPacks(projectItem.primaryFile.name, content);
      }

      this.props.creatorTools.notifyStatusUpdate(
        "Download started! Check your Downloads folder for '" + projectItem.primaryFile.name + "'."
      );

      if (data && data.icon && (data.icon as any).key) {
        this._setNewDeployKey((data.icon as any).key, this._handleDownloadMCWorldWithPacks, data);
      }
    } catch (e) {
      await this._handleExportFailure("Download mcworld with packs", e);
    }
  }

  private async _handleDeployDownloadWorldWithPacks(e: SyntheticEvent | undefined, data: any | undefined) {
    try {
      if (data === undefined) {
        return;
      }

      await this._ensurePersisted();

      await ProjectEditorUtilities.launchWorldWithPacksDownload(this.props.creatorTools, this.props.project);

      if (data && data.icon && (data.icon as any).key) {
        this._setNewDeployKey((data.icon as any).key, this._handleDeployDownloadWorldWithPacks, data);
      }
    } catch (e) {
      await this._handleExportFailure("Download world with packs", e);
    }
  }

  private async _handleDeployDownloadEditorWorldWithPacks(e: SyntheticEvent | undefined, data: any | undefined) {
    try {
      if (data === undefined) {
        return;
      }

      await this._ensurePersisted();

      await ProjectEditorUtilities.launchEditorWorldWithPacksDownload(this.props.creatorTools, this.props.project);

      if (data && data.icon && (data.icon as any).key) {
        this._setNewDeployKey((data.icon as any).key, this._handleDeployDownloadEditorWorldWithPacks, data);
      }
    } catch (e) {
      await this._handleExportFailure("Download editor world with packs", e);
    }
  }

  private async _handleExportMCWorldWithPackRefs(e: SyntheticEvent | undefined, data: any | undefined) {
    try {
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

      if (!projectItem.isContentLoaded) {
        await projectItem.loadContent();
      }

      if (projectItem.primaryFile === null) {
        return;
      }

      const content = projectItem.primaryFile.content;

      if (content instanceof Uint8Array) {
        await this.saveAsWorldWithPackRefs(projectItem.primaryFile.name, content);
      }

      this.props.creatorTools.notifyStatusUpdate("Download started! Check your Downloads folder.");

      if (data && data.icon && (data.icon as any).key) {
        this._setNewExportKey((data.icon as any).key, this._handleExportWorld, data);
      }
    } catch (e) {
      await this._handleExportFailure("Export world with pack refs", e);
    }
  }

  private async saveAsWorldWithPacks(name: string, content: Uint8Array) {
    await this._ensurePersisted();

    await ProjectStandard.ensureIsStandard(this.props.project);

    const mcworld = await ProjectExporter.generateWorldWithPacksAndContent(this.props.project, name, content, {
      betaApisExperiment: true,
    });

    if (mcworld === undefined) {
      return;
    }

    const newBytes = await mcworld.getBytes();

    Log.message("About to save " + name, this.props.project.name);
    if (newBytes !== undefined) {
      try {
        saveAs(new Blob([newBytes as BlobPart], { type: "application/octet-stream" }), name);
      } catch (e) {
        await this._handleExportFailure("Save world with packs", e);
        return;
      }
    }
    Log.message("Done with save " + name, this.props.project.name, this.props.project.name);
  }

  private async saveAsWorldWithPackRefs(name: string, content: Uint8Array) {
    await this._ensurePersisted();

    await ProjectStandard.ensureIsStandard(this.props.project);

    const mcworld = await ProjectExporter.generateBetaApisWorldWithPackRefs(this.props.project, name, content);

    const newBytes = await mcworld.getBytes();

    if (newBytes !== undefined) {
      try {
        saveAs(new Blob([newBytes as BlobPart]), name);
      } catch (e) {
        await this._handleExportFailure("Save world with pack refs", e);
      }
    }
  }

  private async _handleExportFlatWorldWithPacks(e: SyntheticEvent | undefined, data: any | undefined) {
    try {
      telemetry.trackEvent({
        name: TelemetryEvents.PROJECT_EXPORTED,
        properties: {
          [TelemetryProperties.EXPORT_TYPE]: "embeddedFlatPackWorld",
        },
      });

      await this._ensurePersisted();

      await ProjectEditorUtilities.launchFlatWorldWithPacksDownload(this.props.creatorTools, this.props.project);

      if (data && data.icon && (data.icon as any).key) {
        this._setNewExportKey((data.icon as any).key, this._handleExportFlatWorldWithPacks, data);
      }
    } catch (e) {
      await this._handleExportFailure("Export flat world with packs", e);
    }
  }

  private async _handleDownloadFlatWorldWithPacks(e: SyntheticEvent | undefined, data: any | undefined) {
    try {
      await this._ensurePersisted();

      await ProjectEditorUtilities.launchFlatWorldWithPacksDownload(this.props.creatorTools, this.props.project);

      if (data && data.icon && (data.icon as any).key) {
        this._setNewDeployKey((data.icon as any).key, this._handleDownloadFlatWorldWithPacks, data);
      }
    } catch (e) {
      await this._handleExportFailure("Download flat world with packs", e);
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
            itemType = ProjectItemType.unknownJson;
            break;
        }

        if (itemType !== ProjectItemType.unknown) {
          let creationType = ProjectItemCreationType.normal;

          if (relativeFolderPath?.indexOf("/generated/") >= 0 || relativeFolderPath?.indexOf("/_gen/") >= 0) {
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
            FolderContext.unknown,
            undefined,
            creationType
          );
        }
      }
    }

    if (pi) {
      // Update MRU when file is selected
      if (pi.projectPath) {
        this.props.creatorTools.addToMru(pi.projectPath);
        this.props.creatorTools.save();
      }

      let newMode = this.state.mode;

      if (newMode !== ProjectEditorMode.activeItem) {
        newMode = ProjectEditorMode.activeItem;
      }

      let newStateViewMode = this.state.viewMode;

      if (this.state.viewMode === CreatorToolsEditorViewMode.itemsFocus) {
        newStateViewMode = CreatorToolsEditorViewMode.mainFocus;
      }

      this.setState({
        activeReference: this.state.activeReference,
        activeProjectItem: pi,
        tentativeProjectItem: this.state.tentativeProjectItem,
        mode: newMode,
        viewMode: newStateViewMode,
        allInfoSet: this.props.project.indevInfoSet,
        allInfoSetGenerated: this.props.project.indevInfoSet.completedGeneration,
        statusAreaMode: this.state.statusAreaMode,
        lastDeployKey: this.state.lastDeployKey,
        itemView: this.state.itemView,
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
    ProjectEditorUtilities.launchFlatWorldWithPacksDownload(this.props.creatorTools, this.props.project);
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
      itemView: this.state.itemView,
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

  private async _handleExportFlatWorldWithPackRefs(e: SyntheticEvent | undefined, data: any | undefined) {
    try {
      telemetry.trackEvent({
        name: TelemetryEvents.PROJECT_EXPORTED,
        properties: {
          [TelemetryProperties.EXPORT_TYPE]: "referenceFlatPackWorld",
        },
      });

      const projName = await this.props.project.loc.getTokenValue(this.props.project.name);

      const name = projName + " Flat";
      const fileName = projName + " flat.mcworld";

      await ProjectStandard.ensureIsStandard(this.props.project);

      const mcworld = await ProjectExporter.generateFlatGameTestWorldWithPackRefs(this.props.project, name);

      if (mcworld !== undefined) {
        const newBytes = await mcworld.getBytes();

        if (newBytes !== undefined) {
          saveAs(new Blob([newBytes as BlobPart]), fileName);
        }
      }

      if (data && data.icon && (data.icon as any).key) {
        this._setNewExportKey((data.icon as any).key, this._handleExportFlatWorldWithPackRefs, data);
      }
    } catch (e) {
      await this._handleExportFailure("Export flat world with pack refs", e);
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
    try {
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
        allInfoSet: this.props.project.indevInfoSet,
        allInfoSetGenerated: this.props.project.indevInfoSet.completedGeneration,
        statusAreaMode: this.state.statusAreaMode,
        lastDeployKey: this.state.lastDeployKey,
        itemView: this.state.itemView,
        filteredItems: this.state.filteredItems,
        searchFilter: this.state.searchFilter,
        displayFileView: this.state.displayFileView,
        lastExportKey: this.state.lastExportKey,
        lastDeployFunction: this.state.lastDeployFunction,
        lastExportFunction: this.state.lastExportFunction,
        lastDeployData: this.state.lastDeployData,
        lastExportData: this.state.lastExportData,
      });
    } catch (e) {
      Log.debug("Failed to select reference: " + e);
    }
  }

  private _doUpdate() {
    this.forceUpdate();
  }

  private async _handleProjectItemSelected(newProjectItem: ProjectItem, itemView: ProjectItemEditorView) {
    try {
      // In hosted mode (VS Code), delegate to the host to open the item
      if (this.props.isHosted && this.props.onActiveProjectItemChangeRequested) {
        this.props.onActiveProjectItemChangeRequested(newProjectItem, itemView);
        return;
      }

      if (this.state.viewMode === CreatorToolsEditorViewMode.toolboxFocus) {
        if (this.props.onActiveProjectItemChangeRequested) {
          this.props.onActiveProjectItemChangeRequested(newProjectItem, itemView);
        }
      } else {
        let newMode = this.state.mode;

        if (newMode !== ProjectEditorMode.activeItem) {
          newMode = ProjectEditorMode.activeItem;
        }

        let newStateViewMode = this.state.viewMode;

        if (this.state.viewMode === CreatorToolsEditorViewMode.itemsFocus) {
          newStateViewMode = CreatorToolsEditorViewMode.mainFocus;
        }

        await this._ensurePersisted();

        if (this.state !== undefined && this.state.activeProjectItem !== newProjectItem) {
          this._activeEditorPersistable = undefined;
        }

        if (newProjectItem.projectPath) {
          this._setHash(ProjectEditorUtilities.convertStoragePathToBrowserSafe(newProjectItem.projectPath));
        }

        // Add to open tabs if not already there
        const newOpenTabs = this.state.openTabs.includes(newProjectItem)
          ? this.state.openTabs
          : [...this.state.openTabs, newProjectItem];

        this.setState({
          activeProjectItem: newProjectItem,
          activeVariant: undefined,
          tentativeProjectItem: this.state.tentativeProjectItem,
          activeReference: null,
          mode: newMode,
          viewMode: newStateViewMode,
          allInfoSet: this.props.project.indevInfoSet,
          allInfoSetGenerated: this.props.project.indevInfoSet.completedGeneration,
          itemView: itemView,
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
          openTabs: newOpenTabs,
        });
      }
    } catch (e) {
      Log.debug("Failed to select project item: " + e);
    }
  }

  /**
   * Handles clicking on widget links (textures, colors) in the JSON editor.
   * Opens the referenced project item when a user clicks a texture thumbnail or linked reference.
   */
  private _handleOpenProjectItem(projectPath: string) {
    const projectItem = this.props.project.getItemByProjectPath(projectPath);

    if (projectItem) {
      this._handleProjectItemSelected(projectItem, ProjectItemEditorView.singleFileEditor);
    }
  }

  _handleActionClick() {}

  _setHash(newHash: string) {
    // Prefix the project name so the full hash encodes both project identity and
    // the in-project location (file path or editor mode).
    // File paths already start with "/" so only add a separator for mode strings.
    const encodedProjectName = encodeURIComponent(this.props.project.name);
    const separator = newHash.startsWith("/") ? "" : "/";
    const fullHash = "project/" + encodedProjectName + separator + newHash;

    this._lastHashProcessed = "#" + fullHash;

    if (window.history.pushState) {
      window.history.pushState(null, "", "#" + fullHash);
    } else {
      window.location.hash = "#" + fullHash;
    }
  }

  handleProjectItemAction(projectPath: string, projectAction: ProjectEditorItemAction) {
    const projectItem = this.props.project.getItemByProjectPath(projectPath);

    if (projectItem) {
      let actionType = "";
      switch (projectAction) {
        case ProjectEditorItemAction.download:
          actionType = "DownloadFile";
          this.downloadProjectItem(projectItem);
          break;
        case ProjectEditorItemAction.downloadBlockbenchModel:
          actionType = "DownloadFile";
          this.downloadBbmodel(projectItem);
          break;
        case ProjectEditorItemAction.viewAsJson:
          actionType = "ViewAsJson";
          this._handleProjectItemSelected(projectItem, ProjectItemEditorView.singleFileRaw);
          break;
        case ProjectEditorItemAction.viewInEditor:
          actionType = "ViewInEditor";
          this._handleProjectItemSelected(projectItem, ProjectItemEditorView.singleFileEditorForced);
          break;
        case ProjectEditorItemAction.viewOnMap:
          actionType = "ViewOnMap";
          this._handleProjectItemSelected(projectItem, ProjectItemEditorView.map);
          break;
        case ProjectEditorItemAction.viewIssues:
          actionType = "ViewIssues";
          this._handleProjectItemSelected(projectItem, ProjectItemEditorView.validationWithJson);
          break;
        case ProjectEditorItemAction.deleteItem:
          actionType = "Delete";
          this._handleDialogDoneAndClear(false, ProjectEditorDialog.deleteItem);
          break;
        case ProjectEditorItemAction.renameItem:
          actionType = "Rename";
          this._handleDialogDoneAndClear(false, ProjectEditorDialog.renameItem);
          break;
      }

      if (actionType) {
        telemetry.trackEvent({
          name: TelemetryEvents.ITEM_ACTION,
          properties: {
            [TelemetryProperties.ITEM_ACTION_TYPE]: actionType,
            [TelemetryProperties.ITEM_TYPE]: projectItem.itemType,
            [TelemetryProperties.ITEM_NAME]: projectItem.name,
          },
        });
      }
    }
  }

  async downloadProjectItem(projectItem: ProjectItem) {
    if (projectItem.storageType === ProjectItemStorageType.singleFile) {
      const file = projectItem.primaryFile;

      if (file) {
        if (!file.isContentLoaded) {
          await file.loadContent();
        }

        if (file.content) {
          const mimeType = ProjectItemUtilities.getMimeTypes(projectItem);

          if (mimeType.length > 0) {
            try {
              saveAs(new Blob([file.content as BlobPart], { type: mimeType[0] }), projectItem.name);
            } catch (e) {
              await this._handleExportFailure("Download item", e);
            }
          }
        }
      }
    }
  }

  async downloadBbmodel(projectItem: ProjectItem) {
    if (projectItem.storageType === ProjectItemStorageType.singleFile) {
      const file = projectItem.primaryFile;

      if (file) {
        if (!file.isContentLoaded) {
          await file.loadContent();
        }

        if (file.content) {
          await projectItem.project.processRelations(false);
          const def = await BlockbenchModel.exportModel(projectItem);

          if (def) {
            const defStr = JSON.stringify(def);
            if (defStr) {
              try {
                saveAs(
                  new Blob([defStr], { type: "application/json" }),
                  StorageUtilities.getBaseFromName(projectItem.name) + ".bbmodel"
                );
              } catch (e) {
                await this._handleExportFailure("Download Blockbench model", e);
                return;
              }

              return;
            }
          }
        }
      }
    }

    await this.props.creatorTools.notifyStatusUpdate(
      "Could not export a Blockbench model for '" + projectItem.projectPath + "'"
    );
  }

  _handleConfirmRename() {
    if (this.state === null || !this.state.activeProjectItem || this._newItemName === undefined) {
      return;
    }

    this.state.activeProjectItem.rename(this._newItemName);

    this._handleDialogDoneAndClear(true);
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
      undoStackState: this.state.undoStackState,
      viewMode: this.state.viewMode,
      allInfoSet: this.props.project.indevInfoSet,
      allInfoSetGenerated: this.props.project.indevInfoSet.completedGeneration,
      displayFileView: this.state.displayFileView,
      menuState: this.state.menuState,
      itemView: this.state.itemView,
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
          undoStackState: this.state.undoStackState,
          viewMode: this.state.viewMode,
          allInfoSet: this.props.project.indevInfoSet,
          allInfoSetGenerated: this.props.project.indevInfoSet.completedGeneration,
          displayFileView: this.state.displayFileView,
          menuState: this.state.menuState,
          itemView: this.state.itemView,
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
    try {
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
        undoStackState: this.state.undoStackState,
        viewMode: this.state.viewMode,
        allInfoSet: this.props.project.indevInfoSet,
        allInfoSetGenerated: this.props.project.indevInfoSet.completedGeneration,
        displayFileView: this.state.displayFileView,
        menuState: this.state.menuState,
        itemView: this.state.itemView,
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
    } catch (e) {
      Log.debug("Failed to filter: " + e);
    }
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
    const isMobile = width <= MOBILE_WIDTH;
    const viewMode = this.state.viewMode;

    if (width < FULLY_COMPACT_WIDTH) {
      isFullyCompact = true;
    }

    let gridTemplateColumns = this.props.creatorTools.itemSidePaneWidth + "px 4px 1fr 300px";

    if (isMobile) {
      // At mobile widths, always use a single-column layout
      gridTemplateColumns = GRID_MAIN_FOCUS_COLUMNS;
    } else if (isFullyCompact) {
      gridTemplateColumns = GRID_COMPACT_COLUMNS;

      if (viewMode === CreatorToolsEditorViewMode.mainFocus) {
        gridTemplateColumns = GRID_MAIN_FOCUS_COLUMNS;
      } else if (viewMode === CreatorToolsEditorViewMode.itemsFocus) {
      } else if (viewMode === CreatorToolsEditorViewMode.codeLanding) {
      } else if (viewMode === CreatorToolsEditorViewMode.toolboxFocus) {
        gridTemplateColumns = GRID_MAIN_FOCUS_COLUMNS;
      } else if (viewMode === CreatorToolsEditorViewMode.itemsOnLeft) {
        gridTemplateColumns = GRID_ITEMS_ON_LEFT_COLUMNS;
      } else if (viewMode === CreatorToolsEditorViewMode.itemsOnRight) {
        gridTemplateColumns = GRID_ITEMS_ON_RIGHT_COLUMNS;
      } else {
        gridTemplateColumns = GRID_DEFAULT_COLUMNS;
      }
    } else {
      if (viewMode === CreatorToolsEditorViewMode.itemsOnRightAndMinecraftToolbox) {
        gridTemplateColumns = "300px 1fr 4px " + this.props.creatorTools.itemSidePaneWidth + "px";
      } else if (viewMode === CreatorToolsEditorViewMode.itemsOnRight) {
        gridTemplateColumns = "300px 1fr 4px " + this.props.creatorTools.itemSidePaneWidth + "px";
      }
    }

    return gridTemplateColumns;
  }

  private _handleNewProjectItemName(e: React.ChangeEvent<HTMLInputElement>) {
    if (this.props.project === null || this.state == null) {
      return;
    }

    this._newItemName = e.target.value;
  }

  async _handleConfirmDelete() {
    try {
      if (this.state === null || !this.state.activeProjectItem) {
        return;
      }

      await this.state.activeProjectItem.deleteItem();

      this._handleDialogDoneAndClear(true);

      this._incrementVisualSeed();
    } catch (e) {
      Log.debug("Failed to delete item: " + e);
    }
  }

  render() {
    const colors = getThemeColors();
    const width = WebUtilities.getWidth();
    let isButtonCompact = false;
    let isFullyCompact = false;

    if (width < BUTTON_COMPACT_WIDTH) {
      isButtonCompact = true;
    }

    if (width < FULLY_COMPACT_WIDTH) {
      isFullyCompact = true;
    }

    let widthOffset = DEFAULT_WIDTH_OFFSET;

    if (
      this.state.viewMode === CreatorToolsEditorViewMode.itemsOnLeft ||
      this.state.viewMode === CreatorToolsEditorViewMode.itemsOnRight
    ) {
      widthOffset = SIDE_PANE_WIDTH_OFFSET;
    } else if (
      this.state.viewMode === CreatorToolsEditorViewMode.itemsOnLeftAndMinecraftToolbox ||
      this.state.viewMode === CreatorToolsEditorViewMode.itemsOnRightAndMinecraftToolbox
    ) {
      widthOffset = SIDE_PANE_AND_TOOLBOX_WIDTH_OFFSET;
    }

    let viewMode = this.state.viewMode;

    const isMobile = width <= MOBILE_WIDTH;

    if (isMobile && viewMode !== CreatorToolsEditorViewMode.itemsFocus) {
      // At mobile widths, always collapse to single-panel view
      viewMode = CreatorToolsEditorViewMode.mainFocus;
    } else if (
      isFullyCompact &&
      (viewMode === CreatorToolsEditorViewMode.itemsOnLeft ||
        viewMode === CreatorToolsEditorViewMode.itemsOnLeftAndMinecraftToolbox ||
        viewMode === CreatorToolsEditorViewMode.itemsOnRight ||
        viewMode === CreatorToolsEditorViewMode.itemsOnRightAndMinecraftToolbox)
    ) {
      viewMode = CreatorToolsEditorViewMode.mainFocus;
    }
    if (this.props.project.errorState === ProjectErrorState.projectFolderOrFileDoesNotExist) {
      let error = "Could not find project data folder. ";

      if (this.props.project.mainDeployFolderPath) {
        error += this.props.project.mainDeployFolderPath;
      }

      return <h1>{error}</h1>;
    }

    if (this.state.searchFilter && viewMode === CreatorToolsEditorViewMode.mainFocus) {
      viewMode = CreatorToolsEditorViewMode.itemsFocus;
    }

    let exportKeys: { [exportOptionKey: string]: any } = {};
    const exportMenu: any = [];
    const isFocusedMode = this.props.creatorTools.editPreference === CreatorToolsEditPreference.summarized;

    let nextExportKey = "shareableLink";

    if (
      this.props.project.role !== ProjectRole.explorer &&
      this.props.project.role !== ProjectRole.documentation &&
      this.props.project.role !== ProjectRole.meta
    ) {
      if (ProjectEditorUtilities.getIsLinkShareable(this.props.project)) {
        exportKeys[nextExportKey] = {
          key: nextExportKey,
          icon: <FontAwesomeIcon icon={faLink} key={nextExportKey} className="fa-lg" />,
          content: "Shareable Link",
          onClick: this._handleGetShareableLinkClick,
          title: "Get a shareable link of this project.",
        };
        exportMenu.push(exportKeys[nextExportKey]);

        exportMenu.push({
          key: "dividerShareLink",
          kind: "divider",
        });
      }
      nextExportKey = "mcpackAddon";
      exportKeys[nextExportKey] = {
        key: nextExportKey,
        icon: <FontAwesomeIcon icon={faBox} key={nextExportKey} className="fa-lg" />,
        content: isFocusedMode ? "Download Add-On" : "Add-On File",
        onClick: this._handleExportMCAddonClick,
        title: isFocusedMode
          ? "Download your add-on to use in Minecraft"
          : "Exports this set of project files as a MCAddon, for use in Minecraft",
      };
      exportMenu.push(exportKeys[nextExportKey]);

      if (!isFocusedMode && !AppServiceProxy.hasAppService && window.showDirectoryPicker !== undefined) {
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
          title: "Save directly to a folder on your computer for local editing",
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
        content: isFocusedMode ? "Playable World File" : "Flat world with packs embedded",
        title: isFocusedMode
          ? "Download a world file you can play and share with friends"
          : "Get this pack in a sample .mcworld file with packs in this project added",
      };
      exportMenu.push(exportKeys[nextExportKey]);

      if (!isFocusedMode) {
        nextExportKey = "flatBPR|";
        exportKeys[nextExportKey] = {
          key: nextExportKey,
          icon: <FontAwesomeIcon icon={faGlobe} key={nextExportKey} className="fa-lg" />,
          onClick: this._handleExportFlatWorldWithPackRefs,
          content: "Flat world with pack references",
          title: "Get this pack in a sample .mcworld file with references to this Add-On packs",
        };
        exportMenu.push(exportKeys[nextExportKey]);
      }

      exportMenu.push({
        key: "dividerA",
        kind: "divider",
      });
    }

    nextExportKey = "exportZip";
    exportKeys[nextExportKey] = {
      icon: <FontAwesomeIcon icon={faFileArchive} key={nextExportKey} className="fa-lg" />,
      key: nextExportKey,
      content: isFocusedMode ? "Download Project Backup" : "Project full zip",
      onClick: this._handleExportZipClick,
      title: isFocusedMode
        ? "Download everything as a zip file for backup or sharing"
        : "Download a .zip file for sharing or uploading",
    };
    exportMenu.push(exportKeys[nextExportKey]);

    if (
      !isFocusedMode &&
      this.props.project.role !== ProjectRole.documentation &&
      this.props.project.role !== ProjectRole.meta
    ) {
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

    if (exportMenu.length > 0) {
      exportMenu.push({
        key: "dividerPerWorld",
        kind: "divider",
      });
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

        if (pi.defaultFolder && pi.defaultFolder.manager && pi.defaultFolder.manager instanceof MCWorld) {
          world = pi.defaultFolder.manager as MCWorld;
        } else if (pi.primaryFile && pi.primaryFile.manager && pi.primaryFile.manager instanceof MCWorld) {
          world = pi.primaryFile.manager as MCWorld;
        }

        let title = pi.name;

        if (world) {
          title = world.name;
        }

        nextExportKey = "exportWorld|" + pi.name;

        exportKeys[nextExportKey] = {
          key: nextExportKey,
          icon: <FontAwesomeIcon icon={faBox} className="fa-lg" />,
          content: title + " world",
          onClick: this._handleExportWorld,
          title: "Download " + title,
        };

        exportMenu.push(exportKeys[nextExportKey]);

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

    if (this.props.creatorTools.remoteServerUrl && this.props.creatorTools.remoteServerAuthToken && Utilities.isDebug) {
      const deployRemoteKey = "deployToRemoteServer";
      deployKeys[deployRemoteKey] = {
        key: deployRemoteKey + "A",
        icon: <FontAwesomeIcon icon={faBox} key={deployRemoteKey} className="fa-lg" />,
        content: "Deploy to " + this.props.creatorTools.remoteServerUrl,
        onClick: this._handleDeployToRemoteServerClick,
        title: "Deploys this to a remote Dev Tools server",
      };
      deployMenu.push(deployKeys[deployRemoteKey]);
    }

    if (
      CreatorToolsHost.hostType !== HostType.web &&
      CreatorToolsHost.hostType !== HostType.webPlusServices &&
      this.props.creatorTools.minecraftGameMode !== MinecraftGameConnectionMode.remoteMinecraft
    ) {
      const deployToMinecraftGame = "deployPacksToMinecraftGame";
      let productPhrase = "Minecraft";

      if (this.props.creatorTools.minecraftGameMode === MinecraftGameConnectionMode.localMinecraftPreview) {
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
      CreatorToolsHost.hostType !== HostType.web &&
      CreatorToolsHost.hostType !== HostType.webPlusServices &&
      this.props.creatorTools.minecraftGameMode !== MinecraftGameConnectionMode.remoteMinecraft
    ) {
      const deployToMinecraftGame = "deployPacksAndWorldToMinecraftGame";
      let productPhrase = "Minecraft";

      if (this.props.creatorTools.minecraftGameMode === MinecraftGameConnectionMode.localMinecraftPreview) {
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

    if (CreatorToolsHost.hostType !== HostType.web && CreatorToolsHost.hostType !== HostType.webPlusServices) {
      deployMenu.push({
        key: "dividerDedicatedServer",
        kind: "divider",
      });

      const deployToDedicatedServer = "deployToDedicatedServer";
      deployKeys[deployToDedicatedServer] = {
        key: deployToDedicatedServer + "A",
        icon: <FontAwesomeIcon icon={faServer} key={deployToDedicatedServer} className="fa-lg" />,
        content: "Deploy to Dedicated Server",
        onClick: this._handleDeployToDedicatedServerClick,
        title: "Open the Dedicated Server management screen to deploy and test with a local BDS instance",
      };
      deployMenu.push(deployKeys[deployToDedicatedServer]);
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

    deployMenu.push({
      key: "dividerFlatWorld",
      kind: "divider",
    });

    const flatBp = "flatBP|";
    deployKeys[flatBp] = {
      key: flatBp + "A",
      icon: (
        <img
          className="pe-menuIcon"
          alt="Flat world with packs"
          role="presentation"
          key={flatBp}
          src={CreatorToolsHost.contentWebRoot + "res/images/menuicons/grass_path_side.png"}
        />
      ),
      onClick: this._handleDownloadFlatWorldWithPacks,
      content: "Flat world with packs",
      title: "Get this pack in a sample .mcworld file with packs in this project added",
    };
    deployMenu.push(deployKeys[flatBp]);

    const defaultEditorWorldWithPacks = "editorWorld|";
    deployKeys[defaultEditorWorldWithPacks] = {
      key: defaultEditorWorldWithPacks + "C",
      icon: (
        <img
          className="pe-menuIcon"
          alt="Editor project with packs"
          role="presentation"
          key={defaultEditorWorldWithPacks}
          src={CreatorToolsHost.contentWebRoot + "res/images/menuicons/grass_side_carried.png"}
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
          alt="Custom world with packs"
          role="presentation"
          key={defaultWorldWithPacks}
          src={CreatorToolsHost.contentWebRoot + "res/images/menuicons/grass_side_carried.png"}
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

    for (let i = 0; i < this.props.project.items.length && addedItems < MAX_ADDED_ITEMS; i++) {
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

        if (!isFocusedMode) {
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
    }

    // Wrap onClick on export/deploy menu items so they pass the item data to handlers.
    // The old Northstar Toolbar called onClick(e, data) with the item's props; McToolbar calls onClick()
    // with no args. By wrapping, handlers receive (undefined, item) and can extract the key from
    // data.icon.key to update the sticky "last used action" for the Share/Run buttons.
    for (const item of exportMenu) {
      if (item.onClick && !item.kind) {
        const origOnClick = item.onClick;
        const itemData = item;
        item.onClick = () => origOnClick(undefined, itemData);
      }
    }
    for (const item of deployMenu) {
      if (item.onClick && !item.kind) {
        const origOnClick = item.onClick;
        const itemData = item;
        item.onClick = () => origOnClick(undefined, itemData);
      }
    }

    const toolbarItems: any[] = [];
    let closeButton: JSX.Element | undefined = undefined;

    if (!this.props.isHosted) {
      // Show Close button when we have a content session (view or edit mode from CLI)
      if (this.props.hasContentSession) {
        // In view/edit mode with content session, show a Close button on the far right of the toolbar
        // (closeButton is rendered separately from toolbarItems)
        closeButton = (
          <Stack direction="row" spacing={1} aria-label="Close session" sx={{ minHeight: TOOLBAR_MIN_HEIGHT }}>
            <Button
              onClick={this._handleCloseViewClick}
              title="Close session and shut down server"
              startIcon={
                <span className="fa-lg">
                  <FontAwesomeIcon icon={faTimes} className="fa-lg" />
                </span>
              }
            >
              Close
            </Button>
          </Stack>
        );

        // In edit mode (content session but not read-only), also show Save button
        if (!this.props.isViewMode) {
          toolbarItems.push({
            icon: <SaveLabel />,
            key: "save",
            onClick: this._handleSaveClick,
            title: "Save (Ctrl+S)",
          });
        }
      } else {
        // Normal mode (no content session) - show Home and Save buttons
        toolbarItems.push({
          icon: <HomeLabel />,
          key: "home",
          kind: "toggle",
          active: true,
          onClick: this._handleHomeClick,
          title: "Home/Project List",
        });

        toolbarItems.push({
          icon: <SaveLabel />,
          key: "save",
          onClick: this._handleSaveClick,
          title: "Save (Ctrl+S)",
        });
      }

      if (!this.props.readOnly && this.props.project.projectFolder) {
        const undoList = this.props.project.getChangeList();

        let undoMenuItems: any[] = [];
        let redoMenuItems: any[] = [];

        let nextUndoVersionId = undefined;
        let nextRedoVersionId = undefined;

        let redoPos: number | undefined = undefined;
        for (let i = 0; i < undoList.length; i++) {
          const version = undoList[i];

          if (!nextUndoVersionId) {
            nextUndoVersionId = version.id;
          }

          if (version.id === this.props.project.projectFolder.storage.currentVersionId) {
            redoPos = i + 1;
            break;
          }

          undoMenuItems.push({
            key: "undo|" + version.id,
            content: (
              <div key={"undoA|" + version.id}>
                {StorageUtilities.getLeafName(version.file.fullPath)}&#160;@&#160;
                {Utilities.getFriendlySummaryHoursMinutesSeconds(version.versionTime) +
                  (version.description ? " " + version.description : "")}
              </div>
            ),
            onClick: this._setToVersion,
          });
        }

        undoMenuItems = undoMenuItems.reverse();

        if (redoPos !== undefined) {
          for (let i = redoPos; i < undoList.length; i++) {
            const version = undoList[i];

            if (!nextRedoVersionId) {
              nextRedoVersionId = version.id;
            }

            redoMenuItems.push({
              key: "redo|" + version.id,
              content: (
                <div key={"redoA|" + version.id}>
                  {StorageUtilities.getLeafName(version.file.fullPath)}&#160;@&#160;
                  {Utilities.getFriendlySummaryHoursMinutesSeconds(version.versionTime) +
                    (version.description ? " " + version.description : "")}
                </div>
              ),
              onClick: this._setToVersion,
            });
          }
        }

        toolbarItems.push({
          key: "undo",
          icon: <FontAwesomeIcon icon={faUndo} className="fa-lg" />,
          active: undoMenuItems.length > 0,
          title: "Undo (Ctrl+Z)",
          menu: undoMenuItems,
          onMenuOpenChange: this._toggleUndoMenuOpen,
          onClick: this._setToVersion,
        });

        if (undoMenuItems.length > 0) {
          toolbarItems.push({
            icon: <DownArrowLabel />,
            key: "undoMenu",
            onClick: this._toggleUndoMenuOpen,
            active: true,
            title: "Undo History",
          });
        }

        toolbarItems.push({
          key: "redo",
          icon: <FontAwesomeIcon icon={faRedo} className="fa-lg" />,
          active: redoMenuItems.length > 0,
          title: "Redo (Ctrl+Y)",
          menu: redoMenuItems,
          onMenuOpenChange: this._toggleRedoMenuOpen,
          onClick: this._setToVersion,
        });

        if (redoMenuItems.length > 0) {
          toolbarItems.push({
            icon: <DownArrowLabel />,
            key: "redoMenu",
            onClick: this._toggleRedoMenuOpen,
            active: true,
            title: "Redo History",
          });
        }
      }

      if (viewMode === CreatorToolsEditorViewMode.mainFocus) {
        toolbarItems.push({
          key: "itemsFocusA",
          content: "View Items",
          icon: <FontAwesomeIcon icon={faSitemap} className="fa-lg" />,
          title: "Items",
          onClick: this._setItemsFocus,
        });
      }

      if (CreatorToolsHost.hostType === HostType.electronWeb || CreatorToolsHost.hostType === HostType.vsCodeMainWeb)
        toolbarItems.push({
          icon: <OpenInExplorerLabel />,
          key: "openInExplorer",
          onClick: this._openInExplorerClick,
          title: "Open in Explorer",
        });

      const viewMenuItems: any[] = [];

      const listTypeLabel = this.state.displayFileView ? "file" : "item";

      if (!isFullyCompact) {
        viewMenuItems.push({
          key: "itemsOnLeft",
          content: "Editor/view and " + listTypeLabel + " list on the left",
          icon: <FontAwesomeIcon icon={faSquareCaretLeft} className="fa-lg" />,
          title: "Editor/view and " + listTypeLabel + " list on the left",
          onClick: this._setItemsOnLeft,
        });

        viewMenuItems.push({
          key: "itemsOnRight",
          content: "Editor/view and " + listTypeLabel + " list on the right",
          icon: <FontAwesomeIcon icon={faSquareCaretRight} className="fa-lg" />,
          title: "Editor/view and " + listTypeLabel + " list on the right",
          onClick: this._setItemsOnRight,
        });

        viewMenuItems.push({
          key: "worldToolsDividerI",
          kind: "divider",
        });
      }

      viewMenuItems.push({
        key: "mainFocus",
        content: "Editor/view only",
        icon: <FontAwesomeIcon icon={faWindowMaximize} className="fa-lg" />,
        title: "Editor/view only",
        onClick: this._setMainFocus,
      });

      viewMenuItems.push({
        key: "itemsFocus",
        content: this.state.displayFileView ? "File list only" : "Item list only",
        icon: <FontAwesomeIcon icon={faSitemap} className="fa-lg" />,
        title: this.state.displayFileView ? "File list only" : "Item list only",
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

      // Only show the items/files view toggle when not in Focused (summarized) mode.
      // In Focused mode, the list is always shown as items.
      if (this.props.creatorTools.editPreference !== CreatorToolsEditPreference.summarized) {
        viewMenuItems.push({
          key: "worldToolsDivider",
          kind: "divider",
        });

        viewMenuItems.push({
          key: "viewAsItems",
          content: (this.state.displayFileView ? "    " : " •  ") + "Show list as items",
          icon: <FontAwesomeIcon icon={faList} className="fa-lg" />,
          title: "Show list as items",
          onClick: this._viewAsItems,
        });

        viewMenuItems.push({
          key: "viewAsFiles",
          content: (this.state.displayFileView ? " •  " : "    ") + "Show list as files",
          icon: <FontAwesomeIcon icon={faFolderTree} className="fa-lg" />,
          title: "Show list as files",
          onClick: this._viewAsFiles,
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
            this.state.viewMode === CreatorToolsEditorViewMode.itemsOnLeftAndMinecraftToolbox ||
            this.state.viewMode === CreatorToolsEditorViewMode.itemsOnRightAndMinecraftToolbox
              ? "Hide Toolbox Pane"
              : "Show Toolbox Pane",
          icon: <FontAwesomeIcon icon={faTools} className="fa-lg" />,
          title: "Show Toolbox Pane",
          onClick: this._toggleMinecraftToolbox,
        });
      }

      const editPref = this.props.creatorTools.editPreference;

      viewMenuItems.push({
        key: "editModeDivider",
        kind: "divider",
      });

      viewMenuItems.push({
        key: "focusedMode",
        content: (editPref === CreatorToolsEditPreference.summarized ? " ✓  " : "    ") + "Focused Mode",
        icon: <FontAwesomeIcon icon={faWandMagicSparkles} className="fa-lg" />,
        title: "Focused Mode — simplified visual editors (Alt+1)",
        onClick: this._handleSetFocusedMode,
      });

      viewMenuItems.push({
        key: "fullMode",
        content: (editPref === CreatorToolsEditPreference.editors ? " ✓  " : "    ") + "Full Mode",
        icon: <FontAwesomeIcon icon={faEye} className="fa-lg" />,
        title: "Full Mode — all files with visual editors (Alt+2)",
        onClick: this._handleSetFullMode,
      });

      viewMenuItems.push({
        key: "rawMode",
        content: (editPref === CreatorToolsEditPreference.raw ? " ✓  " : "    ") + "Raw Mode",
        icon: <FontAwesomeIcon icon={faCode} className="fa-lg" />,
        title: "Raw Mode — direct JSON editing (Alt+3)",
        onClick: this._handleSetRawMode,
      });

      viewMenuItems.push({
        key: "searchDivider",
        kind: "divider",
      });

      viewMenuItems.push({
        key: "searchInFiles",
        content: "Search in Files",
        icon: <FontAwesomeIcon icon={faSearch} className="fa-lg" />,
        title: "Search across all project files (Ctrl+Shift+F)",
        onClick: this._openProjectSearch,
      });

      viewMenuItems.push({
        key: "quickOpen",
        content: "Quick Open",
        icon: <FontAwesomeIcon icon={faSearch} className="fa-lg" />,
        title: "Quick Open — navigate to any file (Ctrl+P)",
        onClick: this._openQuickOpen,
      });

      if (this.state.openTabs.length > 1) {
        viewMenuItems.push({
          key: "tabsDivider",
          kind: "divider",
        });

        viewMenuItems.push({
          key: "closeOtherTabs",
          content: "Close Other Tabs",
          icon: <FontAwesomeIcon icon={faTimes} className="fa-lg" />,
          title: "Close all tabs except the current tab",
          onClick: this._handleCloseOtherTabs,
        });
      }

      if (this.state.openTabs.length > 0) {
        viewMenuItems.push({
          key: "closeAllTabs",
          content: "Close All Tabs",
          icon: <FontAwesomeIcon icon={faTimes} className="fa-lg" />,
          title: "Close all open tabs (Ctrl+Shift+W)",
          onClick: this._handleCloseAllTabs,
        });
      }

      toolbarItems.push({
        icon: <ViewLabel isCompact={isButtonCompact} />,
        key: "more",
        active: this.state.menuState === ProjectEditorMenuState.viewMenu || undefined,
        title: "View",
        menu: viewMenuItems,
        menuOpen: this.state.menuState === ProjectEditorMenuState.viewMenu,
        onMenuOpenChange: this._handleViewMenuOpen,
      });

      if (this.state.activeProjectItem) {
        const itemMenuItems = ProjectEditorUtilities.getItemMenuItems(this.state.activeProjectItem, undefined);

        for (const item of itemMenuItems) {
          (item as any).onClick = this._itemMenuClick;
        }

        toolbarItems.push({
          icon: (
            <ItemActionsLabel
              isCompact={isButtonCompact}
              icon={faWandMagicSparkles}
              text={this.state.activeProjectItem.name}
            />
          ),
          key: "itemActions",
          active: this.state.menuState === ProjectEditorMenuState.itemMenu || undefined,
          title: "Item Actions",
          menu: itemMenuItems,
          menuOpen: this.state.menuState === ProjectEditorMenuState.itemMenu,
          onMenuOpenChange: this._handleItemMenuOpen,
        });
      }
    } else {
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
    }

    toolbarItems.push({
      icon: <SettingsLabel isCompact={isButtonCompact} />,
      key: "settings",
      onClick: this._showSettingsClick,
      title: "Settings",
    });

    if (this.props.project.role !== ProjectRole.documentation && this.props.project.role !== ProjectRole.meta) {
      toolbarItems.push({
        icon: <MinecraftLabel isCompact={isButtonCompact} />,
        key: "connect",
        kind: "toggle",
        onClick: this._showMinecraftClick,
        active: true,
        title: "Open Minecraft tools and connections",
      });
    }

    if (!this.state.lastExportKey) {
      toolbarItems.push({
        key: "export",
        icon: <MCPackLabel isCompact={isButtonCompact} />,
        title: isButtonCompact ? "" : "Export (F3)",
        active: true,
        menuOpen: this.state.menuState === ProjectEditorMenuState.exportMenu,
        onMenuOpenChange: this._handleExportMenuOpen,
        menu: exportMenu,
      });
    } else {
      const exportItem = exportKeys[this.state.lastExportKey];

      toolbarItems.push({
        icon: <CustomLabel icon={exportItem.icon} text="Export" isCompact={isButtonCompact} />,
        key: "export",
        onClick: exportItem.onClick,
        active: true,
        title: exportItem.content + " (F3)",
        menu: exportMenu,
        splitMenu: true,
      });
    }

    if (
      this.props.creatorTools.deploymentStorage != null &&
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
          title: "Test in Minecraft (F5)",
        });
      } else {
        const deployItem = deployKeys[this.state.lastDeployKey];

        toolbarItems.push({
          icon: <CustomLabel icon={deployItem.icon} text="Test" isCompact={isButtonCompact} />,
          key: "deploy",
          onClick: deployItem.onClick,
          active: true,
          title: deployItem.content + " (F5)",
          menu: deployMenu,
          splitMenu: true,
        });
      }
    }

    // Help menu — placed last so it's the first to overflow when the toolbar is narrow
    const helpMenu = [
      {
        key: "keyboardShortcuts",
        content: "Keyboard Shortcuts",
        icon: <FontAwesomeIcon icon={faKeyboard} className="fa-lg" />,
        onClick: this._openKeyboardShortcutHelp,
      },
      {
        key: "documentation",
        content: "Documentation",
        icon: <FontAwesomeIcon icon={faBookOpen} className="fa-lg" />,
        onClick: this._openDocumentation,
      },
    ];

    toolbarItems.push({
      icon: <HelpLabel isCompact={isButtonCompact} />,
      key: "help",
      menu: helpMenu,
      title: "Help",
    });

    let interior = <></>;

    let gridStyle = "pe-gridOuter ";
    let heightOffset = this.props.heightOffset + HEIGHT_OFFSET_DEFAULT;

    let areaHeight = "calc(100vh - " + this.props.heightOffset + "px)";

    if (CreatorToolsHost.hostType === HostType.vsCodeMainWeb || CreatorToolsHost.hostType === HostType.vsCodeWebWeb) {
      areaHeight = "calc(100vh)";
      heightOffset += HEIGHT_OFFSET_VSCODE;
    }

    if (this.props.hideMainToolbar) {
      gridStyle += "pe-gridOuterNtbCollapsed";
      heightOffset -= HEIGHT_OFFSET_TOOLBAR_COLLAPSED;
    } else if (this.state.statusAreaMode === ProjectStatusAreaMode.expanded) {
      gridStyle += "pe-gridOuterExpanded";
      heightOffset += HEIGHT_OFFSET_STATUSBAR;
    } else {
      gridStyle += "pe-gridOuterCollapsed";
    }

    if (this.props.statusAreaMode === ProjectStatusAreaMode.hidden) {
      heightOffset -= HEIGHT_OFFSET_STATUSBAR_HIDDEN;
    }

    if (this.state.mode === ProjectEditorMode.properties) {
      if (this.props.readOnly || this.props.project.role === ProjectRole.explorer) {
        interior = (
          <ProjectDisplay
            theme={this.props.theme}
            heightOffset={heightOffset}
            project={this.props.project}
            creatorTools={this.props.creatorTools}
          />
        );
      } else {
        interior = (
          <ProjectPropertyEditor
            theme={this.props.theme}
            onContentUpdated={this._doUpdate}
            heightOffset={heightOffset}
            project={this.props.project}
            creatorTools={this.props.creatorTools}
          />
        );
      }
    } else if (this.state.mode === ProjectEditorMode.inspector) {
      // Inspector is hidden in Focused mode — redirect to actions if somehow reached
      if (this.props.creatorTools.editPreference === CreatorToolsEditPreference.summarized) {
        interior = (
          <ProjectActions
            theme={this.props.theme}
            heightOffset={heightOffset}
            onModeChangeRequested={this._handleModeChangeRequested}
            onActionRequested={this._handleActionRequested}
            onEditPreferenceChanged={this._incrementVisualSeed}
            onActiveProjectItemChangeRequested={this._handleProjectItemSelected}
            project={this.props.project}
            creatorTools={this.props.creatorTools}
          />
        );
      } else {
        interior = (
          <ProjectInfoDisplay
            onNotifyInfoSetLoaded={this._onNotifyNewAllItemSetLoaded}
            indevInfoSet={this.state.allInfoSet}
            indevInfoSetGenerated={this.state.allInfoSetGenerated}
            theme={this.props.theme}
            heightOffset={heightOffset}
            project={this.props.project}
            creatorTools={this.props.creatorTools}
            onInfoItemCommand={this._handleInfoItemCommand}
          />
        );
      }
    } else if (this.state.mode === ProjectEditorMode.actions) {
      // Use VscProjectLanding in hosted (VS Code) mode, otherwise use ProjectActions
      if (this.props.isHosted) {
        interior = (
          <VscProjectLanding
            theme={this.props.theme}
            heightOffset={heightOffset}
            project={this.props.project}
            creatorTools={this.props.creatorTools}
          />
        );
      } else {
        interior = (
          <ProjectActions
            theme={this.props.theme}
            heightOffset={heightOffset}
            onModeChangeRequested={this._handleModeChangeRequested}
            onActionRequested={this._handleActionRequested}
            onEditPreferenceChanged={this._incrementVisualSeed}
            onActiveProjectItemChangeRequested={this._handleProjectItemSelected}
            project={this.props.project}
            creatorTools={this.props.creatorTools}
          />
        );
      }
    } else if (this.state.mode === ProjectEditorMode.map) {
      interior = (
        <ProjectMap
          theme={this.props.theme}
          heightOffset={heightOffset}
          onModeChangeRequested={this._handleModeChangeRequested}
          onActionRequested={this._handleActionRequested}
          project={this.props.project}
          creatorTools={this.props.creatorTools}
        />
      );
    } else if (this.state.mode === ProjectEditorMode.minecraftToolSettings) {
      interior = (
        <MinecraftToolEditor
          creatorTools={this.props.creatorTools}
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
          forceCompact={this.props.viewMode === CreatorToolsEditorViewMode.toolboxFocus}
          theme={this.props.theme}
          creatorTools={this.props.creatorTools}
          widthOffset={widthOffset}
          heightOffset={heightOffset}
          ensureMinecraftOnLogin={true}
          project={this.props.project}
        />
      );
    } else if (this.state.mode === ProjectEditorMode.cartoSettings) {
      interior = (
        <CreatorToolsSettings
          theme={this.props.theme}
          creatorTools={this.props.creatorTools}
          heightOffset={heightOffset}
          setActivePersistable={this._setActiveEditorPersistable}
          onEditPreferenceChanged={this._incrementVisualSeed}
        />
      );
    } else {
      interior = (
        <ProjectItemEditor
          theme={this.props.theme}
          readOnly={this.props.readOnly}
          heightOffset={heightOffset}
          activeVariant={this.state.activeVariant}
          visualSeed={this.state.visualSeed}
          initialView={this.state.itemView}
          project={this.props.project}
          onNewVariantRequested={this._handleNewVariantRequested}
          onVariantChangeRequested={this.setNewProjectVariantName}
          setActivePersistable={this._setActiveEditorPersistable}
          creatorTools={this.props.creatorTools}
          activeReference={this.state.activeReference}
          activeProjectItem={this.state.activeProjectItem}
          navigationTarget={this.state.editorNavigationTarget}
          onOpenProjectItem={this._handleOpenProjectItem}
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

    if (this.state !== null && this.state.dialog === ProjectEditorDialog.renameItem && this.state.activeProjectItem) {
      effectArea = (
        <Dialog open={true} key="pil-renameOuter" onClose={this._handleDialogDone}>
          <DialogTitle>{"Rename " + this.state.activeProjectItem.name}</DialogTitle>
          <DialogContent>
            <div className="pil-dialog" key="pil-renameDia">
              <TextField size="small" placeholder="new name" onChange={this._handleNewProjectItemName} />
              <span className="pil-extension">
                .{StorageUtilities.getTypeFromName(this.state.activeProjectItem.name)}
              </span>
            </div>
          </DialogContent>
          <DialogActions>
            <Button onClick={this._handleDialogDone}>Cancel</Button>
            <Button onClick={this._handleConfirmRename} variant="contained">
              Rename
            </Button>
          </DialogActions>
        </Dialog>
      );
    } else if (
      this.state !== null &&
      this.state.dialog === ProjectEditorDialog.deleteItem &&
      this.state.activeProjectItem
    ) {
      let warnings = <></>;

      if (this.state.activeProjectItem.parentItems) {
        let warningItems = [];

        for (const item of this.state.activeProjectItem.parentItems) {
          warningItems.push(
            <li>
              <span className="pil-inlineSource" style={{ backgroundColor: colors.background3 }}>
                {item.parentItem.title}
              </span>
            </li>
          );
        }

        if (warningItems.length === 1) {
          warnings = (
            <div className="pil-deleteWarning">
              <div>The following item is using this. Deleting will remove any associated links from:</div>
              <ul>{warningItems}</ul>
            </div>
          );
        } else if (warningItems.length > 1) {
          warnings = (
            <div className="pil-deleteWarning">
              <div>
                The following items are using this. Deleting will remove any associated links in the following items:
              </div>
              <ul>{warningItems}</ul>
            </div>
          );
        }
      }

      effectArea = (
        <Dialog open={true} key="pil-deleteOuter" onClose={this._handleDialogDone}>
          <DialogTitle>{"Delete " + this.state.activeProjectItem.name + "?"}</DialogTitle>
          <DialogContent>
            <div className="pil-dialog" key="pil-deleteConfirmDia">
              Are you sure you wish to delete{" "}
              <span className="pil-inlineSource" style={{ backgroundColor: colors.background3 }}>
                {this.state.activeProjectItem.title}
              </span>
              ?{warnings}
            </div>
          </DialogContent>
          <DialogActions>
            <Button onClick={this._handleDialogDone}>Cancel</Button>
            <Button onClick={this._handleConfirmDelete} variant="contained">
              OK
            </Button>
          </DialogActions>
        </Dialog>
      );
    } else if (this.state.dialog === ProjectEditorDialog.shareableLink) {
      const dialogContent = (
        <ShareProject creatorTools={this.props.creatorTools} project={this.props.project} theme={this.props.theme} />
      );
      effectArea = (
        <Dialog open={true} className={"pe-shareProjectDialog"} onClose={this._handleDialogDone}>
          <DialogTitle>Share a link to this project</DialogTitle>
          <DialogContent>{dialogContent}</DialogContent>
          <DialogActions>
            <Button onClick={this._handleDialogDone}>Cancel</Button>
            <Button onClick={this._handleDialogDone} variant="contained">
              OK
            </Button>
          </DialogActions>
        </Dialog>
      );
    } else if (this.state.dialog === ProjectEditorDialog.convertTo) {
      effectArea = (
        <Dialog open={true} onClose={this._handleDialogDone}>
          <DialogTitle>Convert</DialogTitle>
          <DialogContent>
            <Convert
              creatorTools={this.props.creatorTools}
              project={this.props.project}
              initialData={this.state.dialogData ? (this.state.dialogData as IConversionSettings) : { name: "Test" }}
              theme={this.props.theme}
              onDialogDataChange={this._handleDialogDataUpdated}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={this._handleDialogDone}>Cancel</Button>
            <Button onClick={this._handleConvertOK} variant="contained">
              OK
            </Button>
          </DialogActions>
        </Dialog>
      );
    } else if (
      this.state.dialog === ProjectEditorDialog.integrateItem &&
      this.state.dialogData &&
      (this.state.dialogData as IProjectItemSeed).fileSource
    ) {
      effectArea = (
        <Dialog open={true} onClose={this._handleDialogDone} maxWidth="sm" fullWidth>
          <DialogTitle>
            {"Import " +
              ((this.state.dialogData as IProjectItemSeed).fileSource
                ? (this.state.dialogData as IProjectItemSeed).fileSource!.name
                : "")}
          </DialogTitle>
          <DialogContent>
            <IntegrateItem
              creatorTools={this.props.creatorTools}
              project={this.props.project}
              theme={this.props.theme}
              heightOffset={this.props.heightOffset}
              data={this.state.dialogData as IProjectItemSeed}
              onDialogDataChange={this._handleDialogDataUpdated}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={this._handleDialogDone}>Cancel</Button>
            <Button onClick={this._handleIntegrateItemOK} variant="contained">
              OK
            </Button>
          </DialogActions>
        </Dialog>
      );
    } else if (this.state.dialog === ProjectEditorDialog.newVariant && this.state.activeProjectItem) {
      effectArea = (
        <Dialog open={true} onClose={this._handleDialogDone}>
          <DialogTitle>{"New Variant for " + this.state.activeProjectItem.projectPath}</DialogTitle>
          <DialogContent>
            <NewVariant
              creatorTools={this.props.creatorTools}
              project={this.props.project}
              theme={this.props.theme}
              onDialogDataChange={this._handleDialogDataUpdated}
              projectItem={this.state.activeProjectItem}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={this._handleDialogDone}>Cancel</Button>
            <Button onClick={this._handleNewVariantOK} variant="contained">
              OK
            </Button>
          </DialogActions>
        </Dialog>
      );
    } else if (this.state.dialog === ProjectEditorDialog.worldSettings) {
      const dialogContent = (
        <WorldSettingsArea
          creatorTools={this.props.creatorTools}
          worldSettings={this.props.project.ensureWorldSettings()}
          displayName={false}
          isAdditive={true}
          displayGameTypeProperties={true}
          displayGameAdminProperties={false}
          onWorldSettingsChanged={this._handleProjectWorldSettingsChanged}
        />
      );
      effectArea = (
        <Dialog open={true} onClose={this._handleDialogDone}>
          <DialogTitle>World settings</DialogTitle>
          <DialogContent>{dialogContent}</DialogContent>
          <DialogActions>
            <Button onClick={this._handleDialogDone}>Cancel</Button>
            <Button onClick={this._handleDialogDone} variant="contained">
              OK
            </Button>
          </DialogActions>
        </Dialog>
      );
    } else if (this.state.dialog === ProjectEditorDialog.quickOpen) {
      effectArea = (
        <QuickOpenDialog
          project={this.props.project}
          onItemSelected={this._handleQuickOpenSelect}
          onClose={this._handleQuickOpenClose}
        />
      );
    } else if (this.state.dialog === ProjectEditorDialog.keyboardShortcuts) {
      effectArea = <KeyboardShortcutHelp onClose={this._closeKeyboardShortcutHelp} />;
    } else if (this.state.dialog === ProjectEditorDialog.projectSearch) {
      effectArea = (
        <ProjectSearchDialog
          project={this.props.project}
          contentIndex={this.state.allInfoSetGenerated ? this.state.allInfoSet.contentIndex : undefined}
          onResultSelected={this._handleSearchResultSelected}
          onClose={this._handleSearchClose}
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
        const selectedFile = this.state.activeProjectItem ? this.state.activeProjectItem.primaryFile : undefined;

        itemList = (
          <FileExplorer
            theme={this.props.theme}
            rootFolder={this.props.project.projectFolder}
            mode={FileExplorerMode.explorer}
            selectedItem={selectedFile}
            creatorTools={this.props.creatorTools}
            readOnly={this.props.readOnly}
            heightOffset={heightOffset}
            onFileSelected={this._handleFileSelected}
            project={this.props.project}
          />
        );
      }
    } else {
      itemList = (
        <ProjectItemList
          theme={this.props.theme}
          project={this.props.project}
          creatorTools={this.props.creatorTools}
          editorMode={this.state.mode}
          heightOffset={heightOffset}
          visualSeed={this.state.visualSeed}
          filteredItems={this.state.filteredItems}
          searchFilter={this.state.searchFilter}
          allInfoSet={this.state.allInfoSet}
          allInfoSetGenerated={this.state.allInfoSetGenerated}
          initialFocusPath={this.props.initialFocusPath}
          onProjectItemAction={this.handleProjectItemAction}
          onModeChangeRequested={this._handleModeChangeRequested}
          onActiveProjectItemChangeRequested={this._handleProjectItemSelected}
          onActiveReferenceChangeRequested={this._handleReferenceSelected}
          onVisualSeedUpdateRequested={this._incrementVisualSeed}
          readOnly={this.props.readOnly}
          activeProjectItem={this.state.activeProjectItem}
          tentativeProjectItem={this.state.tentativeProjectItem}
        />
      );
    }

    let border = "";

    if (CreatorToolsHost.theme === CreatorToolsThemeStyle.dark) {
      border = BORDER_INSET_DARK;
    } else {
      border = BORDER_INSET_LIGHT;
    }

    if (viewMode === CreatorToolsEditorViewMode.mainFocus) {
      column2 = (
        <main
          className="pe-colAll"
          aria-label="Main content area"
          style={{
            border: border,
            height: "calc(100vh - " + String(heightOffset - HEIGHT_OFFSET_MINUS) + "px)",
            backgroundColor: colors.background2,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <EditorTabBar
            openTabs={this.state.openTabs}
            activeItem={this.state.activeProjectItem}
            onTabSelected={this._handleEditorTabSelected}
            onTabClosed={this._handleEditorTabClosed}
          />
          <div style={{ flex: 1, overflow: "hidden" }}>{interior}</div>
        </main>
      );
    } else if (viewMode === CreatorToolsEditorViewMode.itemsFocus) {
      column2 = (
        <section aria-label="Item listing area" className="pe-itemlist pe-colAll">
          {itemList}
        </section>
      );
    } else if (viewMode === CreatorToolsEditorViewMode.codeLanding) {
      column2 = (
        <div className="pe-itemlist pe-colAll">
          <VscProjectLanding
            theme={this.props.theme}
            onModeChangeRequested={this._handleModeChangeRequested}
            onBackRequested={this._setItemsFocus}
            creatorTools={this.props.creatorTools}
            project={this.props.project}
            heightOffset={heightOffset}
          />
        </div>
      );
    } else if (viewMode === CreatorToolsEditorViewMode.toolboxFocus) {
      column2 = (
        <div className="pe-colAll">
          <MinecraftDisplay
            forceCompact={true}
            theme={this.props.theme}
            widthOffset={widthOffset}
            project={this.props.project}
            creatorTools={this.props.creatorTools}
            ensureMinecraftOnLogin={true}
            heightOffset={heightOffset}
          />
        </div>
      );
    } else if (viewMode === CreatorToolsEditorViewMode.itemsOnLeft) {
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
            backgroundColor: colors.background2,
          }}
        >
          {interior}
        </main>
      );
    } else if (viewMode === CreatorToolsEditorViewMode.itemsOnLeftAndMinecraftToolbox) {
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
            backgroundColor: colors.background2,
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
            creatorTools={this.props.creatorTools}
            ensureMinecraftOnLogin={true}
            heightOffset={heightOffset}
          />
        </div>
      );
    } else if (viewMode === CreatorToolsEditorViewMode.itemsOnRightAndMinecraftToolbox) {
      column1 = (
        <div className="pe-col1">
          <MinecraftDisplay
            forceCompact={true}
            theme={this.props.theme}
            project={this.props.project}
            creatorTools={this.props.creatorTools}
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
            backgroundColor: colors.background2,
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
            backgroundColor: colors.background2,
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

    const toolbarContainerClass = "pe-toolbar-container";
    const statusBarClass = "pe-statusbar";

    let toolbarArea = <></>;

    if (!this.props.hideMainToolbar) {
      // Transform toolbarItems to McToolbarItem format
      const mcToolbarItems: McToolbarItem[] = toolbarItems.map((item: any) => {
        // Transform menu items if present
        let mcMenu: McToolbarMenuItem[] | undefined;
        if (item.menu && item.menu.length > 0) {
          mcMenu = item.menu
            .filter((menuItem: any) => menuItem !== undefined && menuItem !== null)
            .map((menuItem: any) => ({
              key: menuItem.key,
              content: menuItem.content,
              icon: menuItem.icon,
              onClick: menuItem.onClick,
              disabled: menuItem.disabled,
              divider: menuItem.kind === "divider",
            }));
        }

        // Get content text - handle various formats
        let contentText: React.ReactNode = undefined;
        if (item.content) {
          if (typeof item.content === "string") {
            contentText = item.content;
          } else if (item.content?.props?.content) {
            contentText = item.content.props.content;
          } else {
            contentText = item.content;
          }
        }

        return {
          key: item.key,
          icon: item.icon,
          content: contentText,
          title: item.title,
          onClick: item.onClick || item.onMenuOpenChange,
          disabled: item.disabled === true,
          active: item.active,
          menu: mcMenu,
          kind: item.kind,
          splitMenu: item.splitMenu,
        } as McToolbarItem;
      });

      toolbarArea = (
        <div className={toolbarContainerClass}>
          <section aria-label="ToolBar" className={toolbarStyle}>
            <McToolbar
              items={mcToolbarItems}
              aria-label="Project Editor main toolbar"
              variant="primary"
              sx={{ minHeight: TOOLBAR_MIN_HEIGHT }}
            />
          </section>
          {closeButton && <div className="pe-toolbar-close">{closeButton}</div>}
        </div>
      );
    }

    let statusArea = <></>;

    if (this.state.statusAreaMode !== ProjectStatusAreaMode.hidden) {
      statusArea = (
        <section
          aria-label="Status and item area"
          className={statusBarClass}
          style={{
            backgroundColor: colors.background1,
            color: colors.foreground1,
          }}
        >
          <StatusArea
            onFilterTextChanged={this._handleFilterTextChanged}
            creatorTools={this.props.creatorTools}
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

    const proj = this.props.project;
    const loadingPhase = this.state.allInfoSetGenerated
      ? "ready"
      : proj.isRelationsProcessed
        ? "validating"
        : proj.isLoaded
          ? "relations"
          : "inferring";

    return (
      <div
        ref={this._containerElt}
        style={{ position: "relative", width: "100%", overflow: "hidden" }}
        data-testid="project-editor"
        data-loading-phase={loadingPhase}
        data-item-count={proj.items.length}
        data-relations-complete={proj.isRelationsProcessed ? "true" : "false"}
        data-validation-complete={this.state.allInfoSetGenerated ? "true" : "false"}
        aria-readonly={this.props.isViewMode ? "true" : undefined}
      >
        {this.props.isViewMode && (
          <div
            role="status"
            style={{
              backgroundColor: "#d0e8ff",
              color: "#1a3a5c",
              padding: "6px 16px",
              fontSize: "13px",
              textAlign: "center",
              borderBottom: "1px solid #b0cfe0",
            }}
          >
            📖 Viewing content — changes will not be saved
          </div>
        )}
        {effectArea}
        <div
          ref={this.gridElt}
          className={gridStyle}
          onMouseMove={this._handleOuterMouseMove}
          onMouseUp={this._handleOuterMouseOutOrUp}
          onMouseLeave={this._handleOuterMouseOutOrUp}
          style={{
            minHeight: areaHeight,
            maxHeight: areaHeight,
            gridTemplateColumns: this.getGridColumnWidths(),
          }}
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
