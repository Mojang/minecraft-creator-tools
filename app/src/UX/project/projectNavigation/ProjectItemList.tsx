/**
 * ARCHITECTURE DOCUMENTATION — ProjectItemList.tsx
 * Last updated: 2026-02-18
 *
 * This component renders the left-side item list in the project editor, including
 * fixed navigation entries (Dashboard, File Map, Project Settings, Check for Problems)
 * and the list of ProjectItem entries.
 *
 * ## Fixed navigation entries and edit-preference modes
 *
 * The fixed entries at the top of the list change based on edit preference:
 *
 * | Entry              | Focused (summarized) | Professional / Other |
 * |--------------------|----------------------|----------------------|
 * | Dashboard          | ✅ (index 0)         | ✅ (index 0)         |
 * | File Map           | ❌ hidden            | ✅ (index 1)         |
 * | Project Settings   | ✅ (index 1)         | ✅ (index 2)         |
 * | Check for Problems | ❌ **HIDDEN**        | ✅ (index 3)         |
 * | Items start at     | index 2              | index 4              |
 *
 * ### IMPORTANT: Inspector MUST be hidden in Focused mode
 *
 * The Inspector / "Check for Problems" feature is for advanced users who edit files
 * by hand and need validation feedback. In Focused mode (designed for beginners using
 * form-based editors), the Inspector MUST be completely hidden — both the list entry
 * and **all click-handler paths** that could activate `ProjectEditorMode.inspector`.
 *
 * Entry points that are gated on Focused mode:
 * 1. The "Check for Problems" list item in `render()` (conditional push)
 * 2. The `inspectorIndex` in `_onListSelectionClick` (set to -1 in Focused mode)
 * 3. The `selectedItemIndex` / `itemsAdded` calculation in `render()` (excludes Inspector)
 * 4. The "Quick Actions → Inspect Project" button in ProjectActions.tsx (already gated)
 * 5. The `ProjectEditor.tsx` inspector panel rendering (graceful fallback to actions)
 * 6. Automatic validation in `ProjectEditor._doAsyncLoading` is skipped in Focused mode
 *
 * If new Inspector entry points are added, they MUST respect this invariant.
 */
import { Component, createRef, MouseEvent, SyntheticEvent, UIEvent } from "react";
import IAppProps from "../../appShell/IAppProps";
import Project from "../../../app/Project";
import {
  MaxItemTypes,
  ProjectItemCategory,
  ProjectItemCreationType,
  ProjectItemErrorStatus,
  ProjectItemType,
} from "../../../app/IProjectItemData";
import ProjectItem from "../../../app/ProjectItem";
import ProjectEditorUtilities, {
  ProjectEditorItemAction,
  ProjectEditorMode,
  ProjectItemEditorView,
} from "../ProjectEditorUtilities";
import StorageUtilities from "../../../storage/StorageUtilities";
import { ListItemButton, Button as MuiButton, Menu, MenuItem, Divider } from "@mui/material";

import { AssetsIcon, AdvancedFilesIcon, FunctionsIcon, TypesIcon, CheckIcon } from "../../shared/components/feedback/labels/Labels";
import { GitHubPropertyType } from "../ProjectPropertyEditor";
import ProjectUtilities, { NewEntityTypeAddMode } from "../../../app/ProjectUtilities";
import IGitHubInfo from "../../../app/IGitHubInfo";
import "./ProjectItemList.css";
import Utilities from "../../../core/Utilities";
import { ProjectEditPreference, ProjectRole } from "../../../app/IProjectData";
import { CreatorToolsEditPreference } from "../../../app/ICreatorToolsData";
import IGalleryItem from "../../../app/IGalleryItem";
import ColorUtilities from "../../../core/ColorUtilities";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFolder } from "@fortawesome/free-regular-svg-icons";
import { faCaretDown, faCaretRight, faClock, faListCheck, faXmark } from "@fortawesome/free-solid-svg-icons";
import ProjectItemUtilities from "../../../app/ProjectItemUtilities";
import ProjectInfoSet from "../../../info/ProjectInfoSet";
import IProjectItemSeed from "../../../app/IProjectItemSeed";
import ProjectInfoItem from "../../../info/ProjectInfoItem";
import { InfoItemType } from "../../../info/IInfoItemData";
import { AnnotatedValueSet, IAnnotatedValue } from "../../../core/AnnotatedValue";
import ProjectAddButton from "./ProjectAddButton";
import WebUtilities from "../../utils/WebUtilities";
import ProjectCreateManager from "../../../app/ProjectCreateManager";
import CreatorToolsHost, { CreatorToolsThemeStyle } from "../../../app/CreatorToolsHost";
import ProjectItemTypeIcon from "./ProjectItemTypeIcon";
import React from "react";
import { List as VirtualList, RowComponentProps } from "react-window";
import IProjectTheme from "../../types/IProjectTheme";

/**
 * Local MenuButton compatibility wrapper.
 * Replaces @fluentui/react-northstar MenuButton with MUI Menu.
 * Props: trigger, menu (array of menu item descriptors), onMenuItemClick,
 *        contextMenu (if true, opens on right-click), open, onBlur, className, style.
 */
function MenuButton(props: {
  trigger: React.ReactNode;
  menu?: any[] | { items?: any[] };
  onMenuItemClick?: (e: React.SyntheticEvent<HTMLElement>, data?: any) => void;
  contextMenu?: boolean;
  open?: boolean;
  onBlur?: (e: React.SyntheticEvent<HTMLElement>) => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const menuItems: any[] = Array.isArray(props.menu) ? props.menu : (props.menu?.items ?? []);
  const isOpen = props.open === true || Boolean(anchorEl);

  const handleClick = (e: React.MouseEvent<HTMLElement>) => {
    if (!props.contextMenu) {
      // Toggle: if already open, close instead of re-opening
      if (anchorEl) {
        setAnchorEl(null);
      } else {
        setAnchorEl(e.currentTarget);
      }
    }
  };

  const handleContextMenu = (e: React.MouseEvent<HTMLElement>) => {
    if (props.contextMenu) {
      e.preventDefault();
      setAnchorEl(e.currentTarget);
    }
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleItemClick = (e: React.MouseEvent<HTMLLIElement>, item: any) => {
    // Stop propagation to prevent the React synthetic event from bubbling
    // through the portal back to the parent span's onClick (which would reopen the menu).
    e.stopPropagation();
    handleClose();
    if (item.onClick) {
      item.onClick(e, item);
    }
    if (props.onMenuItemClick) {
      props.onMenuItemClick(e as any, item);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!props.contextMenu) {
        setAnchorEl(e.currentTarget);
      }
    }
  };

  return (
    <span
      className={props.className}
      style={props.style}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onKeyDown={handleKeyDown}
      onBlur={props.onBlur as any}
    >
      {props.trigger}
      <Menu
        anchorEl={anchorEl}
        open={isOpen}
        onClose={handleClose}
        slotProps={{
          paper: {
            sx: {
              minWidth: 220,
              "& .MuiMenuItem-root": {
                fontSize: "13px",
                padding: "4px 14px",
                gap: "10px",
                minHeight: "28px",
              },
              "& .MuiList-root": {
                paddingTop: "4px",
                paddingBottom: "4px",
              },
            },
          },
        }}
      >
        {menuItems.map((item: any, idx: number) => {
          if (item.kind === "divider") {
            return <Divider key={item.key || idx} sx={{ my: 0.5 }} />;
          }
          if (item.kind === "header") {
            return (
              <MenuItem
                key={item.key || idx}
                disabled
                sx={{
                  opacity: "0.65 !important",
                  fontWeight: 600,
                  fontSize: "11px !important",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  minHeight: "28px !important",
                  padding: "4px 14px !important",
                }}
              >
                {item.content}
              </MenuItem>
            );
          }
          const isDestructive = item.destructive === true;
          return (
            <MenuItem
              key={item.key || idx}
              onClick={(e) => handleItemClick(e, item)}
              title={item.title}
              selected={item.active}
              sx={isDestructive ? { color: "error.main" } : undefined}
            >
              {item.icon && (
                <span style={{ display: "inline-flex", alignItems: "center", flexShrink: 0 }}>{item.icon}</span>
              )}
              {item.content}
            </MenuItem>
          );
        })}
      </Menu>
    </span>
  );
}

/**
 * Local Button wrapper that matches Northstar Button API (icon + content props).
 */
function Button(props: {
  icon?: React.ReactNode;
  content?: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  "aria-label"?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <MuiButton
      variant="outlined"
      className={props.className}
      style={props.style}
      onClick={props.onClick}
      aria-label={props["aria-label"]}
      startIcon={props.icon}
      size="small"
      sx={{
        textTransform: "none",
        borderColor:
          CreatorToolsHost.theme === CreatorToolsThemeStyle.dark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.2)",
        color: "inherit",
      }}
    >
      {props.content}
    </MuiButton>
  );
}

export enum EntityTypeCommand {
  select,
}

export enum BlockTypeCommand {
  select,
}

export enum ListItemType {
  item,
  typeSpacer,
  pathSpacer,
  references,
}

interface IProjectItemListProps extends IAppProps {
  theme: IProjectTheme;
  onActiveProjectItemChangeRequested?: (projectItem: ProjectItem, itemView: ProjectItemEditorView) => void;
  onActiveReferenceChangeRequested?: (reference: IGitHubInfo) => void;
  onProjectItemAction?: (projectPath: string, itemAction: ProjectEditorItemAction) => void;
  onModeChangeRequested?: (mode: ProjectEditorMode) => void;
  onVisualSeedUpdateRequested: () => void;
  filteredItems?: IAnnotatedValue[];
  searchFilter?: string;
  initialFocusPath?: string;
  project: Project | null;
  visualSeed?: number;
  editorMode: ProjectEditorMode;
  allInfoSet: ProjectInfoSet;
  allInfoSetGenerated: boolean;
  activeProjectItem: ProjectItem | null;
  tentativeProjectItem: ProjectItem | null;
  heightOffset: number;
  readOnly: boolean;
}

interface IProjectItemListState {
  activeItem: ProjectItem | undefined;
  dialogMode: ProjectItemListDialogType;
  maxItemsToShow: number;
  didApplyFocusPath?: boolean;
  packFilter?: string;
  focusFilter?: string;
  newItemType?: ProjectItemType;
  activeProjectInfoSet?: ProjectInfoSet | undefined;
  collapsedItemTypes: number[];
  contextFocusedItem?: number;
  collapsedStoragePaths: string[];
  stickyItemType?: ProjectItemType;
  stickyFolderPath?: string;
  showStickyHeader?: boolean;
}

export enum ProjectItemListDialogType {
  noDialog = 0,
  newEntityTypeDialog = 3,
  addGitHubReferenceDialog = 4,
  newBlockTypeDialog = 5,
  newItemDialog = 6,
}

/** Shape of items passed to the VirtualizedRow component. */
interface IVirtualizedListItem {
  key: string;
  content: React.ReactNode;
  "aria-label"?: string;
  role?: string;
  onClick?: (e: React.MouseEvent, item: IVirtualizedListItem) => void;
  [extra: string]: unknown;
}

interface VirtualizedRowProps {
  items: IVirtualizedListItem[];
  selectedItemIndex: number;
  onItemClick: (e: React.MouseEvent, item: IVirtualizedListItem, index: number) => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

const VirtualizedRow = ({
  index,
  style,
  items,
  selectedItemIndex,
  onItemClick,
  onContextMenu,
}: RowComponentProps<VirtualizedRowProps>) => {
  const item = items[index];
  if (!item) return null;

  return (
    <ListItemButton
      style={style}
      key={item.key}
      selected={index === selectedItemIndex}
      onClick={(e: React.MouseEvent) => {
        onItemClick(e, item, index);
      }}
      onContextMenu={onContextMenu}
      aria-label={item["aria-label"]}
      role={item.role || "option"}
      disableGutters
      sx={{ padding: 0, minHeight: 0, height: 36, boxSizing: "border-box" }}
    >
      {item.content}
    </ListItemButton>
  );
};

export default class ProjectItemList extends Component<IProjectItemListProps, IProjectItemListState> {
  private _activeProject: Project | null = null;
  private _itemIndices: any[] = [];
  private _itemTypes: any[] = [];
  private _updatePending: boolean = false;
  private _isMountedInternal: boolean = false;
  private _lastSelectedAsMenuItem: number = 0;
  private _listContainerRef: React.RefObject<HTMLDivElement>;
  private _resizeObserver: ResizeObserver | null = null;
  private _listPixelHeight: number = 0;
  private _headerPositions: { index: number; itemType: ProjectItemType; folderPath?: string }[] = [];
  private _savedScrollTop: number = 0;

  private _tentativeNewItem: IProjectItemSeed | undefined;

  tentativeGitHubMode: string = "existing";
  tentativeGitHubRepoName?: string;
  tentativeGitHubOwner?: string;
  tentativeGitHubBranch?: string;
  tentativeGitHubFolder?: string;
  tentativeGitHubTitle?: string;

  tentativeNewEntityTypeAddMode?: NewEntityTypeAddMode;
  tentativeNewEntityTypeName?: string;
  tentativeNewEntityTypeItem?: IGalleryItem;

  tentativeNewBlockTypeName?: string;
  tentativeNewBlockTypeItem?: IGalleryItem;

  constructor(props: IProjectItemListProps) {
    super(props);

    this._listContainerRef = createRef<HTMLDivElement>();

    this._clearFocus = this._clearFocus.bind(this);
    this._handleItemSelected = this._handleItemSelected.bind(this);
    this._handleProjectChanged = this._handleProjectChanged.bind(this);
    this._projectUpdated = this._projectUpdated.bind(this);
    this._showAllClick = this._showAllClick.bind(this);
    this._showFunctionsClick = this._showFunctionsClick.bind(this);
    this._showAssetsClick = this._showAssetsClick.bind(this);
    this._showTypesClick = this._showTypesClick.bind(this);
    this._blurIfNotActive = this._blurIfNotActive.bind(this);
    this._handleContextMenu = this._handleContextMenu.bind(this);
    this._itemContextBlurred = this._itemContextBlurred.bind(this);
    this._contextMenuClick = this._contextMenuClick.bind(this);
    this._getSortedItems = this._getSortedItems.bind(this);
    this._handleCancel = this._handleCancel.bind(this);
    this._showPackClick = this._showPackClick.bind(this);
    this._handleItemTypeToggle = this._handleItemTypeToggle.bind(this);
    this._handleItemTypeDoubleClick = this._handleItemTypeDoubleClick.bind(this);
    this._handleStoragePathToggle = this._handleStoragePathToggle.bind(this);
    this._githubProjectUpdated = this._githubProjectUpdated.bind(this);
    this._newEntityTypeUpdated = this._newEntityTypeUpdated.bind(this);
    this._newBlockTypeUpdated = this._newBlockTypeUpdated.bind(this);
    this._handleNewEntityType = this._handleNewEntityType.bind(this);
    this._handleNewBlockType = this._handleNewBlockType.bind(this);
    this._doUpdate = this._doUpdate.bind(this);
    this._handleListScroll = this._handleListScroll.bind(this);
    this._toggleMruPane = this._toggleMruPane.bind(this);
    this._handleMruItemClick = this._handleMruItemClick.bind(this);
    this._handleMruItemRemove = this._handleMruItemRemove.bind(this);

    this.state = {
      activeItem: undefined,
      dialogMode: ProjectItemListDialogType.noDialog,
      maxItemsToShow: 300,
      didApplyFocusPath: false,
      collapsedItemTypes: this.props.creatorTools.collapsedTypes,
      collapsedStoragePaths: this.props.project ? this.props.project.collapsedStoragePaths : [],
    };

    this._projectUpdated();
  }

  componentDidUpdate(prevProps: IProjectItemListProps, prevState: IProjectItemListState) {
    this._projectUpdated();
  }

  /**
   * Filters issues to only include displayable items (errors, warnings, recommendations, info, failures).
   * Excludes aggregate items like featureAggregate and test success items.
   */
  _filterDisplayableIssues(issues: ProjectInfoItem[] | undefined): ProjectInfoItem[] | undefined {
    if (!issues) {
      return undefined;
    }

    // Filter to actionable issues only - exclude pure info/metadata items
    // InfoItemType.info items are metadata like "Behavior Pack Name: X" which aren't actionable
    const filtered = issues.filter(
      (issue) =>
        issue.itemType === InfoItemType.error ||
        issue.itemType === InfoItemType.warning ||
        issue.itemType === InfoItemType.recommendation ||
        issue.itemType === InfoItemType.internalProcessingError ||
        issue.itemType === InfoItemType.testCompleteFail
    );

    return filtered.length > 0 ? filtered : undefined;
  }

  _newEntityTypeUpdated(newAddMode: NewEntityTypeAddMode, entityTypeItem: IGalleryItem, name: string) {
    this.tentativeNewEntityTypeItem = entityTypeItem;
    this.tentativeNewEntityTypeAddMode = newAddMode;
    this.tentativeNewEntityTypeName = name;
  }

  _newBlockTypeUpdated(blockTypeItem: IGalleryItem | undefined, name: string | undefined) {
    this.tentativeNewBlockTypeItem = blockTypeItem;
    this.tentativeNewBlockTypeName = name;
  }

  _handleListScroll(event: UIEvent<HTMLDivElement>) {
    if (event.currentTarget && this.props.project) {
      const scrollTop = event.currentTarget.scrollTop;
      this._savedScrollTop = scrollTop;
      const itemHeight = 36; // Approximate height of each list item
      const headerThreshold = 50; // Show sticky header after scrolling past first few items

      // Calculate which header should be shown based on scroll position
      let currentItemType: ProjectItemType | undefined = undefined;
      let currentFolderPath: string | undefined = undefined;
      const shouldShowSticky = scrollTop > headerThreshold;

      if (shouldShowSticky && this._headerPositions.length > 0) {
        // Find the last header that's been scrolled past
        const approximateItemIndex = Math.floor(scrollTop / itemHeight);

        for (let i = this._headerPositions.length - 1; i >= 0; i--) {
          if (this._headerPositions[i].index <= approximateItemIndex) {
            currentItemType = this._headerPositions[i].itemType;
            currentFolderPath = this._headerPositions[i].folderPath;
            break;
          }
        }
      }

      // Update sticky header state if changed
      if (
        this.state.showStickyHeader !== shouldShowSticky ||
        this.state.stickyItemType !== currentItemType ||
        this.state.stickyFolderPath !== currentFolderPath
      ) {
        this.setState({
          ...this.state,
          showStickyHeader: shouldShowSticky,
          stickyItemType: currentItemType,
          stickyFolderPath: currentFolderPath,
        });
      }

      // Existing logic for loading more items
      if (
        event.currentTarget.scrollTop >
          event.currentTarget.scrollHeight -
            (event.currentTarget.offsetHeight + event.currentTarget.scrollHeight / 20) &&
        this.state.maxItemsToShow < this.props.project.items.length
      ) {
        this.setState({
          activeItem: this.state.activeItem,
          dialogMode: this.state.dialogMode,
          packFilter: this.state.packFilter,
          didApplyFocusPath: this.state.didApplyFocusPath,
          focusFilter: this.state.focusFilter,
          maxItemsToShow: this.state.maxItemsToShow + Math.min(this.state.maxItemsToShow, 1100),
          contextFocusedItem: this.state.contextFocusedItem,
          collapsedItemTypes: this.state.collapsedItemTypes,
          collapsedStoragePaths: this.state.collapsedStoragePaths,
          showStickyHeader: shouldShowSticky,
          stickyItemType: currentItemType,
          stickyFolderPath: currentFolderPath,
        });

        this._loadItems();
      }
    }
  }

  /**
   * Calculate the list height in pixels for react-window.
   * react-window needs a numeric height, not a CSS calc() string.
   */
  private _getListPixelHeight(): number {
    if (this._listPixelHeight > 0) {
      return this._listPixelHeight;
    }
    if (this._listContainerRef.current) {
      this._listPixelHeight = this._listContainerRef.current.clientHeight;
      return this._listPixelHeight;
    }
    // Fallback: estimate based on viewport
    return Math.max(200, window.innerHeight - (this.props.heightOffset + 44));
  }

  _githubProjectUpdated(property: GitHubPropertyType, value?: string) {
    switch (property) {
      case GitHubPropertyType.repoName:
        this.tentativeGitHubRepoName = value;
        break;

      case GitHubPropertyType.owner:
        this.tentativeGitHubOwner = value;
        break;

      case GitHubPropertyType.branch:
        this.tentativeGitHubBranch = value;
        break;

      case GitHubPropertyType.folder:
        this.tentativeGitHubFolder = value;
        break;

      case GitHubPropertyType.mode:
        if (value !== undefined) {
          this.tentativeGitHubMode = value;
        }
        break;

      case GitHubPropertyType.title:
        this.tentativeGitHubTitle = value;
        break;
    }
  }

  private _projectUpdated() {
    if (this._activeProject !== this.props.project) {
      if (this._activeProject !== null) {
        this._activeProject.onItemAdded.unsubscribe(this._handleProjectChanged);
        this._activeProject.onPropertyChanged.unsubscribe(this._handleProjectChanged);
        this._activeProject.onItemRemoved.unsubscribe(this._handleProjectChanged);
        this._activeProject.onItemChanged.unsubscribe(this._handleProjectChanged);
        this._activeProject.onNeedsSaveChanged.unsubscribe(this._handleProjectChanged);
        this._activeProject.onSaved.unsubscribe(this._handleProjectChanged);
      }

      this._activeProject = this.props.project;

      this._loadItems();

      if (this.props.project != null) {
        if (!this.props.project.onItemAdded.has(this._handleProjectChanged)) {
          this.props.project.onItemAdded.subscribe(this._handleProjectChanged);
        }

        if (!this.props.project.onPropertyChanged.has(this._handleProjectChanged)) {
          this.props.project.onPropertyChanged.subscribe(this._handleProjectChanged);
        }

        if (!this.props.project.onItemRemoved.has(this._handleProjectChanged)) {
          this.props.project.onItemRemoved.subscribe(this._handleProjectChanged);
        }

        if (!this.props.project.onItemChanged.has(this._handleProjectChanged)) {
          this.props.project.onItemChanged.subscribe(this._handleProjectChanged);
        }

        if (!this.props.project.onNeedsSaveChanged.has(this._handleProjectChanged)) {
          this.props.project.onNeedsSaveChanged.subscribe(this._handleProjectChanged);
        }

        if (!this.props.project.onSaved.has(this._handleProjectChanged)) {
          this.props.project.onSaved.subscribe(this._handleProjectChanged);
        }
      }
    }
  }

  private _handleProjectChanged() {
    if (!this._updatePending) {
      this._updatePending = true;

      window.setTimeout(this._doUpdate, 20);
    }
  }

  private _doUpdate() {
    this._updatePending = false;

    if (this._isMountedInternal) {
      this.forceUpdate();
    }
  }

  componentDidMount() {
    this._isMountedInternal = true;

    // Observe container size changes so the virtualized list height stays accurate
    if (this._listContainerRef.current) {
      this._listPixelHeight = this._listContainerRef.current.clientHeight;
      this._resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const newHeight = entry.contentRect.height;
          if (Math.abs(newHeight - this._listPixelHeight) > 1) {
            this._listPixelHeight = newHeight;
            if (this._isMountedInternal) {
              this.forceUpdate();
            }
          }
        }
      });
      this._resizeObserver.observe(this._listContainerRef.current);
    }
  }

  componentWillUnmount(): void {
    this._isMountedInternal = false;

    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }
  }

  private _showAllClick() {
    if (this.props.project === null) {
      return;
    }

    if (this.props.project.showHiddenItems) {
      this.props.project.showHiddenItems = false;
    } else {
      this.props.project.showHiddenItems = true;
    }

    this._loadItems();
  }

  private _showFunctionsClick() {
    if (this.props.project === null) {
      return;
    }

    this.props.project.showFunctions = !this.props.project.showFunctions;
    this._loadItems();
  }

  private _showAssetsClick() {
    if (this.props.project === null) {
      return;
    }

    this.props.project.showAssets = !this.props.project.showAssets;
    this._loadItems();
  }

  private _showPackClick(elt: any, event: any | undefined) {
    if (event && (event as any).content) {
      this.setState({
        activeItem: this.state.activeItem,
        dialogMode: this.state.dialogMode,
        maxItemsToShow: this.state.maxItemsToShow,
        didApplyFocusPath: this.state.didApplyFocusPath,
        packFilter: this.state.packFilter === (event as any).content ? undefined : (event as any).content,
        focusFilter: this.state.focusFilter,
        contextFocusedItem: this.state.contextFocusedItem,
        collapsedItemTypes: this.state.collapsedItemTypes,
        collapsedStoragePaths: this.state.collapsedStoragePaths,
      });
    }
  }

  private _showTypesClick() {
    if (this.props.project === null) {
      return;
    }

    this.props.project.showTypes = !this.props.project.showTypes;
    this._loadItems();
  }

  private _toggleMruPane() {
    this.props.creatorTools.showMruPane = !this.props.creatorTools.showMruPane;
    this.props.creatorTools.save();
    this.forceUpdate();
  }

  private _handleMruItemClick(projectItem: ProjectItem) {
    if (this.props.onActiveProjectItemChangeRequested) {
      // Track this click in MRU as well
      if (projectItem.projectPath) {
        this.props.creatorTools.addToMru(projectItem.projectPath);
        this.props.creatorTools.save();
      }
      this.props.onActiveProjectItemChangeRequested(projectItem, ProjectItemEditorView.singleFileEditor);
    }
  }

  private _handleMruItemRemove(e: React.MouseEvent, projectItem: ProjectItem) {
    e.stopPropagation();
    const path = projectItem.projectPath;
    if (path) {
      this.props.creatorTools.removeFromMru(path);
      this.props.creatorTools.save();
      this.forceUpdate();
    }
  }

  /**
   * Gets MRU items that exist in the current project, excluding currently selected item.
   * Returns up to 5 items.
   */
  private _getMruItems(): ProjectItem[] {
    if (!this.props.project) return [];

    const mruPaths = this.props.creatorTools.mruItemPaths;
    const projectItems = this.props.project.items;
    const result: ProjectItem[] = [];

    for (const path of mruPaths) {
      if (result.length >= 6) break;

      // Find this path in current project
      const item = projectItems.find((pi) => pi.projectPath === path);
      if (item) {
        result.push(item);
      }
    }

    // Sort alphabetically by name for consistent ordering
    result.sort((a, b) => (a.projectPath ?? "").localeCompare(b.projectPath ?? "", undefined, { sensitivity: "base" }));

    return result;
  }

  private _handleItemSelected(elt: any, event: any | undefined) {
    if (
      event === undefined ||
      event.selectedIndex === undefined ||
      this.props.project === null ||
      this.props.onActiveProjectItemChangeRequested === undefined
    ) {
      return;
    }

    // this is suboptimal, but based on the ordering of events it doesn't seem straightforward
    // to have the context menu click event mute the selection event.
    let isContextMenuAreaClick = false;

    if (elt && elt.currentTarget && elt.pageX !== undefined) {
      const rightExtent = WebUtilities.getElementRight(elt.currentTarget);

      if (rightExtent && elt.pageX >= rightExtent - 80 && elt.pageX < rightExtent) {
        isContextMenuAreaClick = true;
      }
    }

    // Determine the indices based on whether we're in easy mode (Focused/summarized)
    // Focused mode: 0=Actions, 1=Properties, 2+=Items  (NO File Map, NO Inspector)
    // Other modes:  0=Actions, 1=File Map, 2=Properties, 3=Inspector, 4+=Items
    //
    // Note: The search summary row is only present when filteredItems is defined,
    // so these indices start at 0 when there is no filter.
    //
    // IMPORTANT: Inspector MUST be hidden in Focused mode. See architecture note at
    // the "Check for Problems" list item rendering below.
    const isEasyMode = this.props.creatorTools.editPreference === CreatorToolsEditPreference.summarized;

    const actionsIndex = 0;
    const mapIndex = isEasyMode ? -1 : 1; // -1 means not shown
    const propertiesIndex = isEasyMode ? 1 : 2;
    const inspectorIndex = isEasyMode ? -1 : 3; // -1 = hidden in Focused mode

    if (this.props.filteredItems === undefined && event.selectedIndex === actionsIndex) {
      if (this.props && this.props.onModeChangeRequested !== undefined) {
        this.props.onModeChangeRequested(ProjectEditorMode.actions);
      }
    } else if (this.props.filteredItems === undefined && mapIndex > 0 && event.selectedIndex === mapIndex) {
      if (this.props && this.props.onModeChangeRequested !== undefined) {
        this.props.onModeChangeRequested(ProjectEditorMode.map);
      }
    } else if (this.props.filteredItems === undefined && event.selectedIndex === propertiesIndex) {
      if (this.props && this.props.onModeChangeRequested !== undefined) {
        this.props.onModeChangeRequested(ProjectEditorMode.properties);
      }
    } else if (this.props.filteredItems === undefined && inspectorIndex > 0 && event.selectedIndex === inspectorIndex) {
      if (this.props && this.props.onModeChangeRequested !== undefined) {
        this.props.onModeChangeRequested(ProjectEditorMode.inspector);
      }
    } else if (this._itemTypes[event.selectedIndex] === ListItemType.item) {
      const items = this._getSortedItems();
      const newItem = items[this._itemIndices[event.selectedIndex]];

      if (newItem && (newItem !== this.props.activeProjectItem || !isContextMenuAreaClick)) {
        if (
          this.props &&
          this.props.onActiveProjectItemChangeRequested !== undefined &&
          this._lastSelectedAsMenuItem <= 0
        ) {
          // Track this item in MRU
          if (newItem.projectPath) {
            this.props.creatorTools.addToMru(newItem.projectPath);
            this.props.creatorTools.save();
          }
          this.props.onActiveProjectItemChangeRequested(newItem as ProjectItem, ProjectItemEditorView.singleFileEditor);
        } else {
          this._lastSelectedAsMenuItem--;
        }
      }
    } else if (this._itemTypes[event.selectedIndex] === ListItemType.references) {
      const newRef = this.props.project.gitHubReferences[this._itemIndices[event.selectedIndex]];

      if (this.props && this.props.onActiveReferenceChangeRequested !== undefined) {
        this.props.onActiveReferenceChangeRequested(newRef as IGitHubInfo);
      }
    }
  }

  async _handleNewBlockType() {
    if (this.state === null) {
      return;
    }

    if (this.tentativeNewBlockTypeName && this.tentativeNewBlockTypeItem && this.props.project !== null) {
      await ProjectCreateManager.addBlockTypeFromGallery(
        this.props.project,
        this.tentativeNewBlockTypeItem,
        this.tentativeNewBlockTypeName
      );
    }

    if (this.props.project) {
      await this.props.project.save();
    }

    this.setState({
      activeItem: undefined,
      dialogMode: ProjectItemListDialogType.noDialog,
      maxItemsToShow: this.state.maxItemsToShow,
      packFilter: this.state.packFilter,
      focusFilter: this.state.focusFilter,
      contextFocusedItem: this.state.contextFocusedItem,
      didApplyFocusPath: this.state.didApplyFocusPath,
      collapsedItemTypes: this.state.collapsedItemTypes,
      collapsedStoragePaths: this.state.collapsedStoragePaths,
    });
  }

  async _handleNewEntityType() {
    if (this.state === null) {
      return;
    }

    if (this.tentativeNewEntityTypeItem !== undefined && this.props.project !== null) {
      await ProjectCreateManager.addEntityTypeFromGallery(
        this.props.project,
        this.tentativeNewEntityTypeItem,
        this.tentativeNewEntityTypeName,
        this.tentativeNewEntityTypeAddMode
      );
    }

    if (this.props.project) {
      await this.props.project.save();
    }

    this.setState({
      activeItem: undefined,
      dialogMode: ProjectItemListDialogType.noDialog,
      maxItemsToShow: this.state.maxItemsToShow,
      packFilter: this.state.packFilter,
      focusFilter: this.state.focusFilter,
      contextFocusedItem: this.state.contextFocusedItem,
      didApplyFocusPath: this.state.didApplyFocusPath,
      collapsedItemTypes: this.state.collapsedItemTypes,
      collapsedStoragePaths: this.state.collapsedStoragePaths,
    });
  }

  _handleCancel() {
    if (this.state === null) {
      return;
    }

    this.setState({
      activeItem: undefined,
      dialogMode: ProjectItemListDialogType.noDialog,
      maxItemsToShow: this.state.maxItemsToShow,
      packFilter: this.state.packFilter,
      focusFilter: this.state.focusFilter,
      didApplyFocusPath: this.state.didApplyFocusPath,
      contextFocusedItem: this.state.contextFocusedItem,
      collapsedItemTypes: this.state.collapsedItemTypes,
      collapsedStoragePaths: this.state.collapsedStoragePaths,
    });
  }

  _handleItemTypeToggle(e: SyntheticEvent<HTMLElement, Event>, data?: any | undefined) {
    if (data.content && data.content.key) {
      const period = data.content.key.lastIndexOf(".");

      if (period >= 0) {
        const liIndex = parseInt(data.content.key.substring(period + 1));

        if (!isNaN(liIndex)) {
          if (this.props.creatorTools.collapsedTypes.includes(liIndex)) {
            this.props.creatorTools.ensureTypeIsNotCollapsed(liIndex);
            this._loadItems();
          } else {
            this.props.creatorTools.ensureTypeIsCollapsed(liIndex);
          }

          this.props.creatorTools.save();

          this.setState({
            activeItem: this.state.activeItem,
            dialogMode: this.state.dialogMode,
            packFilter: this.state.packFilter,
            focusFilter: this.state.focusFilter,
            didApplyFocusPath: this.state.didApplyFocusPath,
            maxItemsToShow: this.state.maxItemsToShow,
            contextFocusedItem: this.state.contextFocusedItem,
            collapsedItemTypes: this.props.creatorTools.collapsedTypes,
            collapsedStoragePaths: this.state.collapsedStoragePaths,
          });
        }
      }
    }
  }

  _handleItemTypeDoubleClick(e: SyntheticEvent<HTMLDivElement, Event>, data?: any | undefined) {
    if (e && e.currentTarget && e.currentTarget.title) {
      for (let i = 0; i < MaxItemTypes; i++) {
        const hideName = "Hide " + ProjectItemUtilities.getPluralDescriptionForType(i) + " items";
        const showName = "Show " + ProjectItemUtilities.getPluralDescriptionForType(i) + " items";

        if (hideName === e.currentTarget.title || showName === e.currentTarget.title) {
          this.props.creatorTools.ensureAllTypesCollapsedExcept(i);

          this.props.creatorTools.save();

          this.setState({
            activeItem: this.state.activeItem,
            dialogMode: this.state.dialogMode,
            packFilter: this.state.packFilter,
            focusFilter: this.state.focusFilter,
            didApplyFocusPath: this.state.didApplyFocusPath,
            maxItemsToShow: this.state.maxItemsToShow,
            contextFocusedItem: this.state.contextFocusedItem,
            collapsedItemTypes: this.props.creatorTools.collapsedTypes,
            collapsedStoragePaths: this.state.collapsedStoragePaths,
          });
          return;
        }
      }
    }
  }

  _handleStoragePathToggle(e: SyntheticEvent<HTMLElement, Event>, data?: any | undefined) {
    if (data && data.content && data.content.key && this.props.project) {
      const keyData = data.content.key.split("|");

      if (keyData.length >= 3) {
        const folder = keyData[keyData.length - 1];
        const itemType = parseInt(keyData[1]);

        if (!isNaN(itemType)) {
          for (let i = 0; i < this.props.project.items.length; i++) {
            const item = this.props.project.items[i];

            if (item.projectPath) {
              const keyPath = item.folderPath;

              if (keyPath && keyPath === folder && itemType === item.itemType) {
                if (this.props.project.collapsedStoragePaths.includes(keyPath)) {
                  this.props.project.ensureStoragePathIsNotCollapsed(keyPath);
                  this._loadItems();
                } else {
                  this.props.project.ensureStoragePathIsCollapsed(keyPath);
                }

                this.setState({
                  activeItem: this.state.activeItem,
                  dialogMode: this.state.dialogMode,
                  packFilter: this.state.packFilter,
                  focusFilter: this.state.focusFilter,
                  didApplyFocusPath: this.state.didApplyFocusPath,
                  maxItemsToShow: this.state.maxItemsToShow,
                  contextFocusedItem: this.state.contextFocusedItem,
                  collapsedItemTypes: this.props.creatorTools.collapsedTypes,
                  collapsedStoragePaths: this.props.project.collapsedStoragePaths,
                });

                return;
              }
            }
          }
        }
      }
    }
  }

  private _itemContextBlurred(e: SyntheticEvent<HTMLElement, Event>, data?: any | undefined) {
    window.setTimeout(this._blurIfNotActive, 10);
  }

  private _blurIfNotActive() {
    if (
      this.state &&
      this.state.contextFocusedItem !== undefined &&
      window.document.activeElement &&
      window.document.activeElement.className.indexOf("menu") < 0
    ) {
      this.setState({
        activeItem: this.state.activeItem,
        dialogMode: this.state.dialogMode,
        maxItemsToShow: this.state.maxItemsToShow,
        packFilter: this.state.packFilter,
        focusFilter: this.state.focusFilter,
        didApplyFocusPath: this.state.didApplyFocusPath,
        contextFocusedItem: undefined,
        collapsedItemTypes: this.state.collapsedItemTypes,
        collapsedStoragePaths: this.state.collapsedStoragePaths,
      });
    }
  }

  /**
   * Returns the canonical item type used for display grouping.
   * For example, .js files are grouped under the same header as .ts files
   * since .js files in a TypeScript project are compiled outputs.
   */
  static _getDisplayGroupType(itemType: ProjectItemType): ProjectItemType {
    if (itemType === ProjectItemType.js) {
      return ProjectItemType.ts;
    }
    return itemType;
  }

  _contextMenuClick(e: SyntheticEvent<HTMLElement, Event>, data?: any | undefined) {
    if (
      data !== undefined &&
      data.tag !== undefined &&
      this.props.project !== null &&
      this.props.onProjectItemAction &&
      data.tag.action !== undefined &&
      data.tag.path !== undefined
    ) {
      if (data.tag.action === ProjectEditorItemAction.focus) {
        this._setFocus(data.tag.path);
      } else if (data.tag.action === ProjectEditorItemAction.unfocus) {
        this._setFocus(undefined);
      } else {
        this.props.onProjectItemAction(data.tag.path, data.tag.action);
      }
    }

    e.stopPropagation();
    e.preventDefault();
  }

  _addTypeSpacer(projectListItems: any[], itemType: ProjectItemType, isToggleable: boolean, itemIndex: number) {
    // Use the display group type so that e.g. JS and TS share the same "Scripts" header
    const displayType = ProjectItemList._getDisplayGroupType(itemType);
    let name = ProjectItemUtilities.getPluralDescriptionForType(displayType);

    // In Focused mode, use friendlier category names
    if (this.props.project && this.props.project.effectiveEditPreference === ProjectEditPreference.summarized) {
      switch (displayType) {
        case ProjectItemType.entityTypeBehavior:
          name = "Mobs";
          break;
        case ProjectItemType.blockTypeBehavior:
          name = "Blocks";
          break;
        case ProjectItemType.itemTypeBehavior:
          name = "Items";
          break;
        case ProjectItemType.ts:
          name = "Game Logic";
          break;
        case ProjectItemType.lootTableBehavior:
          name = "Loot Tables";
          break;
        case ProjectItemType.spawnRuleBehavior:
          name = "Spawn Rules";
          break;
      }
    }

    const color = ProjectItemUtilities.getColorForType(itemType);
    const tooltip = ProjectItemUtilities.getTooltipForType(itemType);

    color.alpha = 0.2;

    let additionalData = <></>;

    if (this.props.allInfoSet && this.props.allInfoSet.completedGeneration) {
      const items = this.props.allInfoSet.getItems("LINESIZE", itemType + 100);

      if (items.length === 1) {
        const countVal = items[0].getFeatureContaining("count");
        const totalVal = Utilities.getSimpleNumeric(items[0].getFeatureContaining("total"));

        if (countVal !== undefined && totalVal !== undefined) {
          const statSummary = countVal + " files, " + totalVal + " bytes";

          // Only show byte sizes in Raw mode; other modes show just the count
          if (this.props.project && this.props.project.effectiveEditPreference === ProjectEditPreference.raw) {
            additionalData = (
              <span className="pil-stats" title={statSummary}>
                {countVal} @ {totalVal}b
              </span>
            );
          } else {
            additionalData = (
              <span className="pil-stats" title={statSummary}>
                {countVal}
              </span>
            );
          }
        }
      }
    }

    let toggle = <></>;

    const isExpanded = !this.props.creatorTools.collapsedTypes.includes(displayType);
    const headerKey = "eit." + displayType;
    const handleHeaderToggle = (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      this._handleItemTypeToggle(e as any, { content: { key: headerKey } });
    };

    if (isToggleable) {
      toggle = (
        <div className="pil-itemTypeCollapsedToggle" title={(isExpanded ? "Hide" : "Show") + " " + name}>
          <FontAwesomeIcon icon={isExpanded ? faCaretDown : faCaretRight} className="fa-md" />
        </div>
      );
    }

    (projectListItems as any).push({
      role: "option",
      onClick: this._handleItemTypeToggle,
      key: "type" + itemType + "|",
      "aria-label": name,
      content: (
        <div
          className="pil-itemTypeHeader"
          key={headerKey}
          onClick={handleHeaderToggle}
          onDoubleClick={this._handleItemTypeDoubleClick}
          title={isExpanded ? "Hide " + name + " items" : "Show " + name + " items"}
          style={{
            color: this.props.theme.foreground1,
            backgroundColor: ColorUtilities.toCss(color),
          }}
        >
          {toggle}
          <span className="pil-headerIcon">
            <ProjectItemTypeIcon itemType={itemType} size={16} color="#FFFFFF" />
          </span>
          <MenuButton
            contextMenu={itemIndex !== this.state.contextFocusedItem}
            open={itemIndex === this.state.contextFocusedItem ? true : undefined}
            onBlur={this._itemContextBlurred}
            trigger={
              <span className="pil-headerLabel" title={tooltip}>
                <span className="pil-name pit-name" title={name}>
                  {name}
                </span>
                {additionalData}
              </span>
            }
            onMenuItemClick={this._contextMenuClick}
          />
        </div>
      ),
    });

    // Record this header position for sticky header tracking
    this._headerPositions.push({ index: itemIndex, itemType: itemType, folderPath: undefined });
  }

  _addStoragePathSpacer(
    projectListItems: any[],
    folderPath: string,
    folderDisplayPath: string,
    itemType: ProjectItemType,
    isToggleable: boolean,
    itemIndex: number
  ) {
    const typeColor = ProjectItemUtilities.getColorForType(itemType);

    typeColor.alpha = 0.2;

    let toggle = <></>;

    const isExpanded = !this.props.project?.collapsedStoragePaths.includes(folderPath);

    if (isToggleable) {
      toggle = (
        <div className="pil-storagePathCollapsedToggle" title={(isExpanded ? "Hide" : "Show") + " " + folderPath}>
          <FontAwesomeIcon icon={isExpanded ? faCaretDown : faCaretRight} className="fa-md" />
        </div>
      );
    } else {
      toggle = (
        <div className="pil-storagePathCollapsedToggle" aria-hidden="true">
          &#160;
        </div>
      );
    }

    const keyPath = StorageUtilities.getFolderPath(folderPath);
    const headerKey = "eita|" + itemType + "|" + keyPath;
    const handlePathToggle = (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      this._handleStoragePathToggle(e as any, { content: { key: headerKey } });
    };

    (projectListItems as any).push({
      role: "option",
      onClick: this._handleStoragePathToggle,
      key: "eitb." + itemType + "." + keyPath,
      "aria-label": folderDisplayPath,
      content: (
        <div
          className="pil-pathHeader"
          key={headerKey}
          onClick={handlePathToggle}
          title={(isExpanded ? "Hide " : "Show ") + folderPath}
          style={{
            color: this.props.theme.foreground1,
            backgroundColor: ColorUtilities.toCss(ColorUtilities.darker(typeColor, 0.1)),
          }}
        >
          <div
            className="pil-itemTypeTag"
            style={{ backgroundColor: ColorUtilities.toCss(typeColor) }}
            aria-hidden="true"
            role="presentation"
          >
            &#160;
          </div>
          {toggle}

          <div className="pil-storagePathIcon">
            <FontAwesomeIcon icon={faFolder} className="fa-md" />
          </div>
          <MenuButton
            contextMenu={itemIndex !== this.state.contextFocusedItem}
            open={itemIndex === this.state.contextFocusedItem ? true : undefined}
            onBlur={this._itemContextBlurred}
            trigger={
              <span className="pil-storagePathLabel" title={folderPath}>
                <span className="pil-name pit-name">{folderDisplayPath}</span>
              </span>
            }
            onMenuItemClick={this._contextMenuClick}
          />
        </div>
      ),
    });

    // Record this folder header position for sticky header tracking
    this._headerPositions.push({ index: itemIndex, itemType: itemType, folderPath: folderPath });
  }

  _addProjectItem(
    projectListItems: any[],
    projectItem: ProjectItem,
    isGitHubRef: boolean,
    itemIndex: number,
    isFocused?: boolean
  ) {
    let name = StorageUtilities.getBaseFromName(projectItem.name);

    // Strip common Minecraft file-type suffixes for cleaner display names
    const suffixesToStrip = [".behavior", ".entity", ".resource", ".server_entity", ".client_entity"];
    for (const suffix of suffixesToStrip) {
      if (name.endsWith(suffix)) {
        name = name.substring(0, name.length - suffix.length);
        break;
      }
    }

    let sourceImage = "";

    // Check for thumbnail - first from the item itself, then follow thumbnailLink
    let thumbnailUrl = projectItem.imageUrl;

    if (!thumbnailUrl && projectItem.thumbnailLink && this.props.project) {
      // Follow the thumbnailLink to get the thumbnail from another item
      const linkedItem = this.props.project.getItemByProjectPath(projectItem.thumbnailLink);

      if (linkedItem && linkedItem.cachedThumbnail) {
        thumbnailUrl = linkedItem.cachedThumbnail;
      }
    }

    if (thumbnailUrl) {
      sourceImage = "url('" + thumbnailUrl + "')";
    }

    // display .env files as ".env"
    if (name === "") {
      name = projectItem.name;
    }

    if (
      projectItem.projectPath &&
      this.props.project &&
      this.props.project.changedFilesSinceLastSaved[ProjectUtilities.canonicalizeStoragePath(projectItem.projectPath)]
    ) {
      name += "*";
    }

    const typeColor = ProjectItemUtilities.getColorForType(projectItem.itemType);

    typeColor.alpha = 0.85;

    if (projectItem === this.props.tentativeProjectItem) {
      typeColor.alpha = 1.0;
    }

    if (this.props.readOnly) {
      const itemItems = [];

      let issues: ProjectInfoItem[] | undefined;

      // Hide validation indicators in Focused mode since they are mostly technical
      if (
        this.props.creatorTools.editPreference !== CreatorToolsEditPreference.summarized &&
        this.props.allInfoSet &&
        this.props.allInfoSetGenerated &&
        projectItem.projectPath
      ) {
        const allIssues = this.props.allInfoSet.getItemsByStoragePath(projectItem.projectPath);
        issues = this._filterDisplayableIssues(allIssues);
      }

      if (sourceImage !== "") {
        itemItems.push(
          <span
            className="pil-itemIcon"
            key={"pil-ij." + projectItem.projectPath + (isFocused ? ".focus" : "")}
            style={{
              gridColumn: issues ? 3 : 4,
              backgroundImage: sourceImage,
            }}
            aria-hidden="true"
            role="presentation"
          >
            &#160;
          </span>
        );
      }

      let nameSpan = 1;

      if (issues) {
        let errorMessage = "";

        for (const issue of issues) {
          errorMessage += this.props.allInfoSet.getEffectiveMessage(issue) + "\n";
        }

        // Click on validation indicator opens the JSON editor with validation panel
        const handleValidationClick = (e: React.MouseEvent) => {
          e.stopPropagation();
          if (this.props.onActiveProjectItemChangeRequested) {
            this.props.onActiveProjectItemChangeRequested(projectItem, ProjectItemEditorView.validationWithJson);
          }
        };

        itemItems.push(
          <span
            className="pil-itemIndicatorRO"
            title={
              issues.length +
              " validation issue" +
              (issues.length !== 1 ? "s" : "") +
              ":\n" +
              errorMessage +
              "\nClick to view validation issues"
            }
            key={"pil-ii" + projectItem.projectPath + (isFocused ? ".focus" : "")}
            onClick={handleValidationClick}
            style={{ cursor: "pointer" }}
          >
            {issues.length}
          </span>
        );
      } else {
        nameSpan++;
      }

      if (sourceImage === "") {
        nameSpan++;
      }

      (projectListItems as any).push({
        role: "option",
        key: "pila-ro" + projectItem.projectPath + (isFocused ? ".focus" : ""),
        "aria-label": name,
        content: (
          <div className="pil-item" key={"pil-ro" + projectItem.projectPath + (isFocused ? ".focus" : "")}>
            <div
              className="pil-itemTypeTag"
              style={{ backgroundColor: ColorUtilities.toCss(typeColor) }}
              aria-hidden="true"
              role="presentation"
            >
              &#160;
            </div>
            <span
              className="pil-itemLabel"
              style={{
                gridColumnStart: 2,
                gridColumnEnd: 2 + nameSpan,
                backgroundColor:
                  projectItem === this.props.tentativeProjectItem ? ColorUtilities.toCss(typeColor) : undefined,
              }}
            >
              <span className="pil-name pit-name">{name}</span>
            </span>
            {itemItems}
          </div>
        ),
      });
    } else {
      let path = "";

      if (projectItem.projectPath !== null && projectItem.projectPath !== undefined) {
        path = projectItem.projectPath;
      }

      let issues: ProjectInfoItem[] | undefined;

      // Hide validation indicators in Focused mode since they are mostly technical
      if (
        this.props.creatorTools.editPreference !== CreatorToolsEditPreference.summarized &&
        this.props.allInfoSet &&
        this.props.allInfoSetGenerated &&
        projectItem.projectPath
      ) {
        const allIssues = this.props.allInfoSet.getItemsByStoragePath(projectItem.projectPath);
        issues = this._filterDisplayableIssues(allIssues);
      }

      // Check if user is in raw editing preference mode
      const isRawEditPreference = this.props.project?.effectiveEditPreference === ProjectEditPreference.raw;

      const itemMenu = ProjectEditorUtilities.getItemMenuItems(
        projectItem,
        this.state.focusFilter,
        issues ? issues.length : 0,
        isRawEditPreference
      );

      let nameCss = "pil-name pit-name";

      if (isGitHubRef) {
        nameCss += " pil-name-gh";
      }

      let title = path;

      if (projectItem.errorMessage !== undefined) {
        title = projectItem.errorMessage;
      }

      // Add beginner-friendly tooltips for manifest files
      if (
        projectItem.itemType === ProjectItemType.behaviorPackManifestJson ||
        projectItem.itemType === ProjectItemType.resourcePackManifestJson
      ) {
        const manifestHint =
          projectItem.itemType === ProjectItemType.behaviorPackManifestJson
            ? "Defines your behavior pack's name, version, and dependencies"
            : "Defines your resource pack's name, version, and dependencies";
        title = title ? manifestHint + "\n" + title : manifestHint;
      }

      if (projectItem.errorStatus === ProjectItemErrorStatus.unprocessable) {
        name = "(error) " + name;
      }

      const itemItems = [];

      itemItems.push(
        <div
          className="pil-itemTypeTag"
          key={"pil-itt." + projectItem.projectPath + (isFocused ? ".focus" : "")}
          style={{ backgroundColor: ColorUtilities.toCss(typeColor) }}
          aria-hidden="true"
          role="presentation"
        >
          &#160;
        </div>
      );

      let nameSpan = 1;
      if (projectItem !== this.props.activeProjectItem && sourceImage === "") {
        nameSpan++;
      }

      if (issues === undefined) {
        nameSpan++;
      }

      itemItems.push(
        <MenuButton
          key={"pil-mb." + projectItem.projectPath + (isFocused ? ".focus" : "")}
          contextMenu={itemIndex !== this.state.contextFocusedItem}
          open={itemIndex === this.state.contextFocusedItem ? true : undefined}
          onBlur={this._itemContextBlurred}
          trigger={
            <span
              className={isFocused ? "pil-itemLabelFocused" : "pil-itemLabel"}
              style={{
                gridColumnStart: 2,
                gridColumnEnd: 2 + nameSpan,
                backgroundColor:
                  projectItem === this.props.tentativeProjectItem ? ColorUtilities.toCss(typeColor) : undefined,
              }}
            >
              <span className={nameCss} title={title}>
                {name}
              </span>
            </span>
          }
          menu={itemMenu}
          onMenuItemClick={this._contextMenuClick}
        />
      );

      if (projectItem === this.props.activeProjectItem || sourceImage !== "") {
        let icoInterior = <></>;

        if (projectItem === this.props.activeProjectItem) {
          icoInterior = (
            <div
              className="pil-expandButton"
              style={{
                backgroundColor: this.props.theme.background3,
              }}
            >
              ...
            </div>
          );
        }
        itemItems.push(
          <MenuButton
            className="pil-itemIcon"
            style={{
              gridColumn: issues ? 3 : 4,
              backgroundImage: sourceImage,
            }}
            key={"pil-mba." + projectItem.projectPath + (isFocused ? ".focus" : "")}
            trigger={
              <span
                className={
                  projectItem === this.props.activeProjectItem
                    ? "pil-contextMenuButton"
                    : "pil-contextMenuButton pil-cmbUnfocused"
                }
              >
                {icoInterior}
              </span>
            }
            menu={itemMenu}
            onMenuItemClick={this._contextMenuClick}
          />
        );
      }

      if (issues) {
        let errorMessage = "";

        for (const issue of issues) {
          errorMessage += this.props.allInfoSet.getEffectiveMessage(issue) + "\n";
        }

        // Click on validation indicator opens the JSON editor with validation panel
        const handleValidationClick = (e: React.MouseEvent) => {
          e.stopPropagation();
          if (this.props.onActiveProjectItemChangeRequested) {
            this.props.onActiveProjectItemChangeRequested(projectItem, ProjectItemEditorView.validationWithJson);
          }
        };

        itemItems.push(
          <div
            style={{
              gridColumn: 4,
              color: this.props.theme.foreground4,
            }}
            className="pil-itemIndicator"
            key={"pil-mbc." + projectItem.projectPath + (isFocused ? ".focus" : "")}
            title={
              issues.length +
              " validation issue" +
              (issues.length !== 1 ? "s" : "") +
              ":\n" +
              errorMessage +
              "\nClick to view validation issues"
            }
            onClick={handleValidationClick}
          >
            <div className="pil-itemIndicatorInterior">{issues.length}</div>
          </div>
        );
      }

      (projectListItems as any).push({
        role: "option",
        key: "pila-eoa" + projectItem.projectPath + (isFocused ? ".focus" : ""),
        "aria-label": name,
        content: (
          <div className="pil-item" key={"pil-eoa" + projectItem.projectPath} aria-haspopup={true}>
            {itemItems}
          </div>
        ),
      });
    }
  }

  _addReference(projectListItems: any[], reference: IGitHubInfo, itemIndex: number) {
    const name = reference.repoName;
    const sig = ProjectItem.getGitHubSignature(reference);

    if (this.props.readOnly) {
      (projectListItems as any).push({
        role: "option",
        key: "pil-ghitemr." + sig,
        "aria-label": name,
        content: (
          <div className="pil-item" key={"pil-ghitem." + sig}>
            <span className="pil-name pit-name">{name}</span>
          </div>
        ),
      });
    } else {
      const itemMenu = [
        {
          content: "Delete",
          tag: sig,
          destructive: true,
        },
      ];

      const nameCss = "pil-name pit-name";

      (projectListItems as any).push({
        role: "option",
        key: "pil-ghitemz." + sig,
        "aria-label": name,
        content: (
          <div className="pil-item" key={"pil-ghitema." + sig} style={{ minWidth: 310 }}>
            <MenuButton
              contextMenu={itemIndex !== this.state.contextFocusedItem}
              open={itemIndex === this.state.contextFocusedItem ? true : undefined}
              onBlur={this._itemContextBlurred}
              trigger={
                <span className="pil-itemLabel">
                  <span className={nameCss}>{name}</span>
                </span>
              }
              menu={itemMenu}
              onMenuItemClick={this._contextMenuClick}
            />
            <MenuButton
              trigger={
                <span className="pil-contextMenuButton" aria-haspopup="false">
                  <Button content="..." aria-label="More options" />
                </span>
              }
              menu={itemMenu}
              onMenuItemClick={this._contextMenuClick}
            />
          </div>
        ),
      });
    }
  }

  _getSortedItems() {
    if (this.props.project === null) {
      return [];
    }

    let terms: string[] | undefined = undefined;

    if (this.props.searchFilter) {
      terms = this.props.searchFilter.toLowerCase().split(" ");
    }

    const itemsCopy = this.props.project.getItemsCopy();

    return itemsCopy.sort((a: ProjectItem, b: ProjectItem) => {
      const aType = ProjectItemUtilities.getSortOrder(a.itemType);
      const bType = ProjectItemUtilities.getSortOrder(b.itemType);

      if (aType === bType) {
        let aTermScore = 0;
        let bTermScore = 0;

        if (terms) {
          for (const term of terms) {
            if (a.projectPath && a.projectPath.toLowerCase().includes(term)) {
              aTermScore += 1;
            }
            if (b.projectPath && b.projectPath.toLowerCase().includes(term)) {
              bTermScore += 1;
            }
            if (a.name && a.name.toLowerCase().includes(term)) {
              aTermScore += 3;
            }
            if (b.name && b.name.toLowerCase().includes(term)) {
              bTermScore += 3;
            }
          }

          if (aTermScore !== bTermScore) {
            return bTermScore - aTermScore;
          }
        }

        if (a.projectPath && b.projectPath) {
          const folderPathA = StorageUtilities.getFolderPath(a.projectPath);
          const folderPathB = StorageUtilities.getFolderPath(b.projectPath);

          if (folderPathA !== folderPathB) {
            return folderPathA.localeCompare(folderPathB);
          }

          return a.projectPath.localeCompare(b.projectPath);
        }

        return a.name.localeCompare(b.name);
      }

      return aType - bType;
    });
  }

  async _loadItems() {
    if (this.props.project === null) {
      return;
    }

    const projectItems = this._getSortedItems();
    let needsUpdate = false;
    let itemsShown = 0;

    for (let i = 0; i < projectItems.length && itemsShown < this.state.maxItemsToShow; i++) {
      const projectItem = projectItems[i];

      if (
        !this.state.collapsedItemTypes.includes(projectItem.itemType) &&
        this.shouldShowProjectItem(projectItem) &&
        projectItem.projectPath &&
        !projectItem.isContentLoaded
      ) {
        const projectFolderGrouping = StorageUtilities.getFolderPath(projectItem.projectPath);

        if (projectFolderGrouping === undefined || !this.state.collapsedStoragePaths.includes(projectFolderGrouping)) {
          if (!projectItem.isContentLoaded) {
            await projectItem.loadContent();
          }
          itemsShown++;
          needsUpdate = true;
        }
      }

      if (
        !this.state.didApplyFocusPath &&
        this.props.initialFocusPath &&
        projectItem.projectPath &&
        this.props.initialFocusPath.length > 0
      ) {
        if (StorageUtilities.canonicalizePath(projectItem.projectPath).endsWith(this.props.initialFocusPath)) {
          this.setState({
            activeItem: this.state.activeItem,
            dialogMode: this.state.dialogMode,
            maxItemsToShow: this.state.maxItemsToShow,
            packFilter: this.state.packFilter,
            focusFilter: projectItem.projectPath,
            didApplyFocusPath: true,
            contextFocusedItem: this.state.contextFocusedItem,
            collapsedItemTypes: this.state.collapsedItemTypes,
            collapsedStoragePaths: this.state.collapsedStoragePaths,
          });

          // Also open the focused file in the editor (not just highlight it in the list)
          if (this.props.onActiveProjectItemChangeRequested) {
            this.props.onActiveProjectItemChangeRequested(projectItem, ProjectItemEditorView.singleFileEditor);
          }
        }
      }
    }

    if (needsUpdate) {
      this._handleProjectChanged();
    }
  }

  private _handleContextMenu(e: MouseEvent<HTMLUListElement, Event>, data?: any | undefined) {
    if (e.currentTarget && e.currentTarget.children.length > 0 && e.button < 0) {
      let curIndex = 0;

      const eltChildren = e.currentTarget.children;

      for (let i = 0; i < eltChildren.length; i++) {
        const elt = eltChildren[i];
        if ((elt as HTMLElement).tabIndex === 0) {
          this.setState({
            activeItem: this.state.activeItem,
            dialogMode: this.state.dialogMode,
            maxItemsToShow: this.state.maxItemsToShow,
            packFilter: this.state.packFilter,
            focusFilter: this.state.focusFilter,
            didApplyFocusPath: this.state.didApplyFocusPath,
            contextFocusedItem: curIndex,
            collapsedItemTypes: this.state.collapsedItemTypes,
            collapsedStoragePaths: this.state.collapsedStoragePaths,
          });

          e.preventDefault();
          return;
        }

        curIndex++;
      }
    }
  }

  shouldShowProjectItem(projectItem: ProjectItem) {
    if (!this.props.project) {
      return false;
    }

    if (!projectItem.projectPath) {
      return false;
    }

    // we don't have an experience here
    if (
      projectItem.itemType === ProjectItemType.behaviorPackFolder ||
      projectItem.itemType === ProjectItemType.resourcePackFolder ||
      projectItem.itemType === ProjectItemType.skinPackFolder ||
      projectItem.itemType === ProjectItemType.designPackFolder
    ) {
      return false;
    }

    if (this.props.filteredItems) {
      return AnnotatedValueSet.includes(this.props.filteredItems, projectItem.projectPath);
    }

    if (this.state.focusFilter) {
      return ProjectItemUtilities.isDescendentOfPath(projectItem, this.state.focusFilter);
    }

    const cat = ProjectItemUtilities.getCategory(projectItem.itemType);

    if (this.state.packFilter) {
      const packFolder = projectItem.getPackFolderName();

      if (packFolder !== this.state.packFilter) {
        return false;
      }
    }

    if (!this.props.project.showFunctions && cat === ProjectItemCategory.logic) {
      return false;
    }

    if (!this.props.project.showAssets && cat === ProjectItemCategory.assets) {
      return false;
    }

    if (!this.props.project.showTypes && cat === ProjectItemCategory.types) {
      return false;
    }

    if (this.props.project.effectiveShowHiddenItems) {
      // Even when showing hidden items (raw/editors mode), still hide compiled .js
      // files when the project has .ts source files, since .js files are build outputs.
      // Only show them if the user explicitly checked "Show All Files".
      if (
        !this.props.project.showHiddenItems &&
        projectItem.itemType === ProjectItemType.js &&
        this.props.project.items.some((pi) => pi.itemType === ProjectItemType.ts)
      ) {
        return false;
      }

      return true;
    }

    if (
      cat === ProjectItemCategory.build ||
      cat === ProjectItemCategory.mctools ||
      cat === ProjectItemCategory.package ||
      projectItem.itemType === ProjectItemType.lang || // should be handled by Text editor
      projectItem.itemType === ProjectItemType.languagesCatalogJson || // should be handled by Text editor
      projectItem.itemType === ProjectItemType.packIconImage ||
      projectItem.itemType === ProjectItemType.fileListArrayJson ||
      projectItem.itemType === ProjectItemType.buildProcessedJs ||
      projectItem.itemType === ProjectItemType.catalogIndexJs ||
      projectItem.itemType === ProjectItemType.soundCatalog ||
      projectItem.itemType === ProjectItemType.itemTextureJson ||
      projectItem.itemType === ProjectItemType.attachableResourceJson ||
      projectItem.itemType === ProjectItemType.biomeResource || // this should be handled by biome type editor for bps
      projectItem.itemType === ProjectItemType.terrainTextureCatalogResourceJson || // this should be handled by block type editor for bp block type
      projectItem.itemType === ProjectItemType.blocksCatalogResourceJson || // this should be handled by block type editor for bp block type
      projectItem.itemType === ProjectItemType.blockTypeResourceJsonDoNotUse || // this should be handled by block type editor for bp block type
      projectItem.itemType === ProjectItemType.behaviorPackListJson || // this should be handled by world editor
      projectItem.itemType === ProjectItemType.resourcePackListJson || // this should be handled by world editor
      projectItem.itemType === ProjectItemType.behaviorPackHistoryListJson || // this should be handled by world editor
      projectItem.itemType === ProjectItemType.resourcePackHistoryListJson || // this should be handled by world editor
      projectItem.itemType === ProjectItemType.animationControllerBehaviorJson || // this should be rendered by entity type editor
      projectItem.itemType === ProjectItemType.animationBehaviorJson || // this should be rendered by entity type editor
      projectItem.itemType === ProjectItemType.animationResourceJson || // this should be model editor
      projectItem.itemType === ProjectItemType.renderControllerJson || // this should be model editor
      projectItem.itemType === ProjectItemType.blockCulling || // this should be model editor
      projectItem.itemType === ProjectItemType.animationControllerResourceJson || // this should be model editor
      projectItem.itemType === ProjectItemType.docInfoJson ||
      projectItem.itemType === ProjectItemType.levelDatOld
    ) {
      return false;
    }

    // Hide compiled .js files when the project also has .ts source files,
    // since the .js files are build outputs and should not be edited directly.
    if (projectItem.itemType === ProjectItemType.js && this.props.project) {
      const hasTs = this.props.project.items.some((pi) => pi.itemType === ProjectItemType.ts);
      if (hasTs) {
        return false;
      }
    }

    if (
      this.props.project.effectiveEditPreference !== ProjectEditPreference.summarized &&
      projectItem.parentItems?.length === 1 && //projectItem.itemType === ProjectItemType.entityTypeResource ||
      (projectItem.itemType === ProjectItemType.spawnRuleBehavior ||
        projectItem.itemType === ProjectItemType.lootTableBehavior)
    ) {
      return false;
    }

    // In Focused/Summarized mode, hide additional technical items that beginners don't need to see directly.
    // These are managed through the entity/block/item editors instead.
    if (this.props.project.effectiveEditPreference === ProjectEditPreference.summarized) {
      if (
        projectItem.itemType === ProjectItemType.entityTypeResource || // managed by entity editor Visuals tab
        projectItem.itemType === ProjectItemType.texture || // managed by entity/block/item editors
        projectItem.itemType === ProjectItemType.spawnRuleBehavior || // managed by entity editor Spawn tab
        projectItem.itemType === ProjectItemType.lootTableBehavior || // managed by entity editor Loot tab
        projectItem.itemType === ProjectItemType.modelGeometryJson // managed by entity editor Visuals tab
      ) {
        return false;
      }
    }

    const fileName = StorageUtilities.getLeafName(projectItem.projectPath);

    let perTypeShouldShow = true;

    if (
      (projectItem.itemType === ProjectItemType.packageJson ||
        projectItem.itemType === ProjectItemType.behaviorPackManifestJson ||
        projectItem.itemType === ProjectItemType.resourcePackManifestJson ||
        projectItem.itemType === ProjectItemType.skinPackManifestJson ||
        projectItem.itemType === ProjectItemType.personaManifestJson ||
        projectItem.itemType === ProjectItemType.ninesliceJson ||
        projectItem.itemType === ProjectItemType.worldTemplateManifestJson ||
        projectItem.itemType === ProjectItemType.packageLockJson ||
        projectItem.itemType === ProjectItemType.markdownDocumentation) &&
      this.props.project.effectiveEditPreference === ProjectEditPreference.summarized
    ) {
      perTypeShouldShow = false;
    }

    return (
      (projectItem.creationType === undefined ||
        projectItem.creationType === ProjectItemCreationType.normal ||
        this.props.project.effectiveShowHiddenItems) &&
      perTypeShouldShow &&
      (projectItem.itemType !== ProjectItemType.unknownJson || !fileName.startsWith(".")) && // hide files like .prettierrc.json from view
      (projectItem.itemType !== ProjectItemType.unknownJson || !fileName.startsWith("extensions")) && // hide files like extensions.json from view
      (projectItem.itemType !== ProjectItemType.unknownJson || !fileName.startsWith("settings")) && // hide files like settings.json from view
      (projectItem.gitHubReference === undefined || projectItem.gitHubReference.owner === undefined)
    );
  }

  _clearFocus() {
    this.setState({
      activeItem: this.state.activeItem,
      dialogMode: this.state.dialogMode,
      packFilter: this.state.packFilter,
      focusFilter: undefined,
      didApplyFocusPath: this.state.didApplyFocusPath,
      maxItemsToShow: this.state.maxItemsToShow,
      contextFocusedItem: this.state.contextFocusedItem,
      collapsedItemTypes: this.state.collapsedItemTypes,
      collapsedStoragePaths: this.state.collapsedStoragePaths,
    });
  }

  _setFocus(projectItemPath: string | undefined | null) {
    if (projectItemPath === null || projectItemPath === undefined) {
      this._clearFocus();
    } else {
      this.setState({
        activeItem: this.state.activeItem,
        dialogMode: this.state.dialogMode,
        packFilter: this.state.packFilter,
        didApplyFocusPath: this.state.didApplyFocusPath,
        focusFilter: projectItemPath,
        maxItemsToShow: this.state.maxItemsToShow,
        contextFocusedItem: this.state.contextFocusedItem,
        collapsedItemTypes: this.state.collapsedItemTypes,
        collapsedStoragePaths: this.state.collapsedStoragePaths,
      });
    }
  }

  render() {
    const projectListItems: any[] = [];

    // Reset header positions for sticky header tracking
    this._headerPositions = [];

    const searchSummaryText = this.props.filteredItems ? this.props.filteredItems.length + " items found" : "";
    const searchSummaryContent = (
      <div
        className="pil-fixedLineRow"
        key="pil-summarySearch"
        style={{
          height: this.props.filteredItems ? "32px" : "0px",
        }}
      >
        <div
          className="pil-projectName pil-projectResults"
          aria-live="assertive"
          aria-atomic="true"
          aria-relevant="all"
          role="alert"
          aria-label={searchSummaryText}
        >
          {searchSummaryText}
        </div>
      </div>
    );

    const focusMenuItems: any[] = [];
    const entityMenuItems: any[] = [];
    let addedEntityMenu = false;
    const blockMenuItems: any[] = [];
    let addedBlockMenu = false;
    const itemMenuItems: any[] = [];
    let addedItemMenu = false;

    // Only show search summary row when there's an active search filter;
    // otherwise it creates a visible empty 36px row above Dashboard.
    if (this.props.filteredItems !== undefined) {
      (projectListItems as any).push({
        role: "option",
        key: "pilb-searchsum",
        content: searchSummaryContent,
      });
    }

    if (this.props.filteredItems === undefined) {
      (projectListItems as any).push({
        role: "option",
        key: "pilats",
        "aria-label": "Dashboard",
        content: (
          <div className="pil-fixedLine" key="pil-ats">
            Dashboard
          </div>
        ),
      });

      // Hide File Map in easy mode (summarized)
      if (this.props.creatorTools.editPreference !== CreatorToolsEditPreference.summarized) {
        (projectListItems as any).push({
          role: "option",
          key: "pilmap",
          "aria-label": "Project Files",
          content: (
            <div className="pil-fixedLine" key="pil-map">
              Project Files
            </div>
          ),
        });
      }

      let projectContent = <></>;

      if (this.props.allInfoSet.info.defaultIcon && this.props.allInfoSet.info.defaultIcon) {
        projectContent = (
          <div className="pil-fixedLine pil-fixedLineRow" key="pil-fixpropj">
            <div className="pil-projectName">Project Settings</div>
            <div
              className="pil-projectIcon"
              style={{
                backgroundImage: "url('data:image/png;base64, " + this.props.allInfoSet.info.defaultIcon + "')",
              }}
            ></div>
          </div>
        );
      } else {
        projectContent = (
          <div className="pil-fixedLine" key="pil-fixpropa">
            Project Settings
          </div>
        );
      }

      (projectListItems as any).push({
        role: "option",
        key: "pilb-proje",
        "aria-label": "Project Settings",
        content: projectContent,
      });

      // IMPORTANT: Inspector / "Check for Problems" is HIDDEN in Focused mode (summarized).
      // Focused mode is for beginners who use form-based editors — Inspector is an advanced
      // feature for users editing files by hand. All Inspector entry points MUST be hidden
      // when editPreference === CreatorToolsEditPreference.summarized.
      if (this.props.creatorTools.editPreference !== CreatorToolsEditPreference.summarized) {
        (projectListItems as any).push({
          role: "option",
          key: "pilb-insp",
          "aria-label": "Check for Problems",
          content: (
            <div className="pil-fixedLine" key="pil-insp">
              Check for Problems
            </div>
          ),
        });
      }
    }

    let selectedItemIndex = 0;
    let itemsAdded = 1;

    if (this.props.filteredItems === undefined) {
      const isEasyMode = this.props.creatorTools.editPreference === CreatorToolsEditPreference.summarized;

      if (this.props.editorMode === ProjectEditorMode.map) {
        // File Map is hidden in easy mode, so this shouldn't happen, but handle it anyway
        selectedItemIndex = isEasyMode ? 0 : 1;
      } else if (this.props.editorMode === ProjectEditorMode.properties) {
        // Properties comes after Actions (and File Map if not easy mode)
        selectedItemIndex = isEasyMode ? 1 : 2;
      } else if (this.props.editorMode === ProjectEditorMode.inspector) {
        // Inspector is HIDDEN in Focused mode — should not be reachable, but handle gracefully
        selectedItemIndex = isEasyMode ? 1 : 3;
      }

      // Focused mode: Actions, Properties (2 fixed items → itemsAdded starts at 2)
      // Other modes:  Actions, File Map, Properties, Inspector (4 fixed items → itemsAdded starts at 4)
      itemsAdded = isEasyMode ? 2 : 4;
    }

    let lastItemType = -1;
    let lastStorageRoot: string | undefined;

    this._itemIndices = [];
    this._itemTypes = [];

    if (this.props.project) {
      const projectItems = this._getSortedItems();

      if (this.state.focusFilter) {
        let focusItem = undefined;

        for (let i = 0; i < projectItems.length && itemsAdded < this.state.maxItemsToShow; i++) {
          const projectItem = projectItems[i];

          if (projectItem.projectPath === this.state.focusFilter) {
            focusItem = projectItem;
            break;
          }
        }

        if (focusItem) {
          this._addProjectItem(projectListItems, focusItem, false, itemsAdded, true);
        }

        itemsAdded++;
      }

      for (let i = 0; i < projectItems.length && itemsAdded < this.state.maxItemsToShow; i++) {
        const projectItem = projectItems[i];

        if (projectItem.itemType === ProjectItemType.entityTypeBehavior) {
          entityMenuItems.push({
            key: "fe-" + projectItem.projectPath,
            content: Utilities.humanifyMinecraftName(StorageUtilities.getBaseFromName(projectItem.name)),
            onClick: () => {
              this._setFocus(projectItem.projectPath);
            },
          });

          if (!addedEntityMenu) {
            addedEntityMenu = true;

            focusMenuItems.push({
              key: "focus-entities-header",
              content: "Entities",
              kind: "header",
              menu: entityMenuItems,
            });
          }
        } else if (projectItem.itemType === ProjectItemType.blockTypeBehavior) {
          blockMenuItems.push({
            key: "fb-" + projectItem.projectPath,
            content: Utilities.humanifyMinecraftName(StorageUtilities.getBaseFromName(projectItem.name)),
            onClick: () => {
              this._setFocus(projectItem.projectPath);
            },
          });

          if (!addedBlockMenu) {
            addedBlockMenu = true;

            focusMenuItems.push({
              key: "focus-blocks-header",
              content: "Blocks",
              kind: "header",
              menu: blockMenuItems,
            });
          }
        } else if (projectItem.itemType === ProjectItemType.itemTypeBehavior) {
          itemMenuItems.push({
            key: "fi-" + projectItem.projectPath,
            content: Utilities.humanifyMinecraftName(StorageUtilities.getBaseFromName(projectItem.name)),
            onClick: () => {
              this._setFocus(projectItem.projectPath);
            },
          });

          if (!addedItemMenu) {
            addedItemMenu = true;

            focusMenuItems.push({
              key: "focus-items-header",
              content: "Items",
              kind: "header",
              menu: itemMenuItems,
            });
          }
        }

        if (projectItem !== undefined && projectItem.projectPath !== null && projectItem.projectPath !== undefined) {
          if (this.shouldShowProjectItem(projectItem)) {
            const displayGroupType = ProjectItemList._getDisplayGroupType(projectItem.itemType);
            if (displayGroupType !== lastItemType) {
              this._addTypeSpacer(
                projectListItems,
                displayGroupType,
                this.props.filteredItems === undefined,
                itemsAdded
              );
              this._itemTypes[itemsAdded] = ListItemType.typeSpacer;
              this._itemIndices[itemsAdded] = displayGroupType;
              itemsAdded++;
              lastItemType = displayGroupType;
            }

            if (
              this.props.filteredItems !== undefined ||
              !this.state.collapsedItemTypes.includes(ProjectItemList._getDisplayGroupType(projectItem.itemType))
            ) {
              const folderPath = projectItem.folderPath;
              const folderGroupingPath = projectItem.getFolderGroupingPath();

              if (folderPath !== lastStorageRoot) {
                if (
                  folderPath !== undefined &&
                  folderGroupingPath !== undefined &&
                  folderGroupingPath.length > 0 &&
                  folderPath.length > 1 &&
                  projectItem.itemType !== ProjectItemType.soundCatalog
                ) {
                  this._addStoragePathSpacer(
                    projectListItems,
                    folderPath,
                    folderGroupingPath,
                    projectItem.itemType,
                    this.props.filteredItems === undefined,
                    itemsAdded
                  );
                  this._itemTypes[itemsAdded] = ListItemType.pathSpacer;
                  itemsAdded++;
                }
                lastStorageRoot = folderPath;
              }

              if (
                this.props.filteredItems !== undefined ||
                !folderPath ||
                !this.state.collapsedStoragePaths.includes(folderPath)
              ) {
                if (
                  projectItem === this.props.activeProjectItem &&
                  this.props.editorMode === ProjectEditorMode.activeItem
                ) {
                  selectedItemIndex = projectListItems.length;
                }

                this._addProjectItem(projectListItems, projectItem, false, itemsAdded);
                this._itemIndices[itemsAdded] = i;
                this._itemTypes[itemsAdded] = ListItemType.item;
                itemsAdded++;
              }
            }
          }
        }
      }

      if (
        this.props.filteredItems === undefined &&
        this.props.project.effectiveEditPreference === ProjectEditPreference.summarized
      ) {
        const hasEntityContent = projectItems.some(
          (item) =>
            item.itemType === ProjectItemType.entityTypeBehavior || item.itemType === ProjectItemType.entityTypeResource
        );
        const hasSpawnRuleFiles = projectItems.some((item) => item.itemType === ProjectItemType.spawnRuleBehavior);
        const hasLootTableFiles = projectItems.some((item) => item.itemType === ProjectItemType.lootTableBehavior);

        const addDiscoverabilityHeader = (itemType: ProjectItemType) => {
          if (lastItemType !== itemType) {
            this._addTypeSpacer(projectListItems, itemType, true, itemsAdded);
            this._itemTypes[itemsAdded] = ListItemType.typeSpacer;
            this._itemIndices[itemsAdded] = itemType;
            itemsAdded++;
            lastItemType = itemType;
          }
        };

        if (hasEntityContent && !hasSpawnRuleFiles) {
          addDiscoverabilityHeader(ProjectItemType.spawnRuleBehavior);
        }

        if (hasEntityContent && !hasLootTableFiles) {
          addDiscoverabilityHeader(ProjectItemType.lootTableBehavior);
        }
      }

      const references = this.props.project.gitHubReferences;

      for (let i = 0; i < references.length; i++) {
        const ref = references[i];

        this._addReference(projectListItems, ref, itemsAdded);

        this._itemTypes[itemsAdded] = ListItemType.references;
        this._itemIndices[itemsAdded] = i;
        itemsAdded++;

        for (let j = 0; j < projectItems.length; j++) {
          const projectItem = projectItems[j];

          if (
            projectItem.gitHubReference !== undefined &&
            ProjectItem.gitHubReferencesEqual(ref, projectItem.gitHubReference)
          ) {
            this._addProjectItem(projectListItems, projectItem, true, itemsAdded);
            this._itemIndices[itemsAdded] = j;
            this._itemTypes[itemsAdded] = ListItemType.item;
            itemsAdded++;
          }
        }
      }
    }

    const showMenuItems: any[] = [];

    showMenuItems.push({
      icon: (
        <FunctionsIcon
          theme={this.props.theme}
          isSelected={this.props.project?.showFunctions === true}
          isCompact={true}
        />
      ),
      content: "Game Logic",
      key: "pil-hideShowFunctions",
      onClick: this._showFunctionsClick,
      title: "Toggle whether scripts and functions are shown",
    });

    showMenuItems.push({
      icon: <TypesIcon theme={this.props.theme} isSelected={this.props.project?.showTypes === true} isCompact={true} />,
      key: "pil-hideShowTypes",
      content: "Types",
      onClick: this._showTypesClick,
      title: "Toggle whether world details and mob, block, and item types are shown",
    });

    showMenuItems.push({
      icon: (
        <AssetsIcon theme={this.props.theme} isSelected={this.props.project?.showAssets === true} isCompact={true} />
      ),
      key: "pil-hideShowAssets",
      content: "Assets",
      onClick: this._showAssetsClick,
      title: "Toggle whether assets (models, images, UI and sound) are shown",
    });

    showMenuItems.push({
      icon: <CheckIcon theme={this.props.theme} isSelected={this.props.creatorTools.showMruPane} isCompact={true} />,
      key: "pil-hideShowMru",
      content: "Recent Items",
      onClick: this._toggleMruPane,
      title: "Toggle whether recently used items are shown at the top",
    });

    if (addedEntityMenu || addedItemMenu || addedBlockMenu || this.state.focusFilter) {
      showMenuItems.push({
        key: "dividerShow",
        kind: "divider",
      });

      if (this.state.focusFilter) {
        showMenuItems.push({
          key: "pil-clearFocus",
          content: "Clear focus",
          onClick: this._clearFocus,
          title: "Clear focus",
        });
      }

      if (addedEntityMenu || addedItemMenu || addedBlockMenu) {
        showMenuItems.push({
          key: "pil-focus",
          content: "Focus on...",
          menu: {
            items: focusMenuItems,
          },
          title: "Focus on",
        });
      }
    }

    if (this.props.project?.effectiveEditPreference === ProjectEditPreference.summarized) {
      showMenuItems.push({
        icon: (
          <AdvancedFilesIcon
            theme={this.props.theme}
            isSelected={this.props.project?.effectiveShowHiddenItems === true}
            isCompact={true}
          />
        ),
        key: "pil-hideShowSlash",
        content: "All Single Files (Advanced)",
        onClick: this._showAllClick,
        title: "Show all files, including single files not normally shown in summarized mode",
      });
    }

    if (this.props.project && this.props.project.packs && this.props.project.packs.length > 2) {
      showMenuItems.push({
        key: "dividerPacks",
        kind: "divider",
      });

      const packList: string[] = [];
      for (const pack of this.props.project.packs) {
        if (!packList.includes(pack.folder.name)) {
          packList.push(pack.folder.name);
        }
      }

      packList.sort();

      for (const pack of packList) {
        showMenuItems.push({
          icon: <CheckIcon theme={this.props.theme} isSelected={this.state.packFilter === pack} isCompact={true} />,
          key: "pil-hideShowPack" + pack,
          content: pack,
          active: this.state.packFilter === pack,
          onClick: this._showPackClick,
          title: "Toggle whether pack is shown",
        });
      }
    }

    let splitButton = <></>;

    if (this.props.project && !this.props.readOnly && this.props.project.role !== ProjectRole.explorer) {
      splitButton = (
        <ProjectAddButton
          creatorTools={this.props.creatorTools}
          heightOffset={this.props.heightOffset}
          theme={this.props.theme}
          project={this.props.project}
          onActiveProjectItemChangeRequested={this.props.onActiveProjectItemChangeRequested}
        />
      );
    }

    const listHeight = "calc(100vh - " + (this.props.heightOffset + 44) + "px)";

    // Build MRU section if conditions are met
    let mruSection = <></>;
    const mruItems = this._getMruItems();
    const projectItems = this._getSortedItems();
    const showMru =
      this.props.creatorTools.showMruPane &&
      mruItems.length > 2 &&
      projectItems.length >= 30 &&
      !this.props.filteredItems; // Don't show MRU during search

    const activeProjectPath = this.props.activeProjectItem?.projectPath;

    if (showMru) {
      const isDark = CreatorToolsHost.theme === CreatorToolsThemeStyle.dark;
      mruSection = (
        <div className={"pil-mruSection" + (isDark ? "" : " pil-mruSection-light")}>
          <div className="pil-mruHeader">
            <FontAwesomeIcon icon={faClock} className="fa-xs" />
            <span>Recent</span>
          </div>
          {mruItems.map((item, index) => {
            const itemColor = ProjectItemUtilities.getColorForType(item.itemType);
            const itemColorCss = ColorUtilities.toCss(itemColor);
            const isActive = item.projectPath === activeProjectPath;

            // Build friendly display name (strip extension and common suffixes)
            let mruDisplayName = StorageUtilities.getBaseFromName(item.name);
            const suffixesToStrip = [".behavior", ".entity", ".resource", ".server_entity", ".client_entity"];
            for (const suffix of suffixesToStrip) {
              if (mruDisplayName.endsWith(suffix)) {
                mruDisplayName = mruDisplayName.substring(0, mruDisplayName.length - suffix.length);
                break;
              }
            }

            // Check for cached thumbnail
            let mruThumbnailUrl = item.imageUrl;
            if (!mruThumbnailUrl && item.thumbnailLink && this.props.project) {
              const linkedItem = this.props.project.getItemByProjectPath(item.thumbnailLink);
              if (linkedItem && linkedItem.cachedThumbnail) {
                mruThumbnailUrl = linkedItem.cachedThumbnail;
              }
            }

            return (
              <div
                key={"mru-" + index}
                className={"pil-mruItem" + (isActive ? " pil-mruItemActive" : "")}
                onClick={isActive ? undefined : () => this._handleMruItemClick(item)}
                title={item.projectPath || item.name}
                style={{ borderLeftColor: itemColorCss }}
              >
                <span className="pil-mruItemGutter">
                  {isActive && <span className="pil-mruItemDot" style={{ backgroundColor: itemColorCss }} />}
                </span>
                <span className="pil-mruItemIcon">
                  {mruThumbnailUrl ? (
                    <img
                      src={mruThumbnailUrl}
                      alt=""
                      style={{ width: 14, height: 14, objectFit: "cover", borderRadius: 2 }}
                    />
                  ) : (
                    <ProjectItemTypeIcon itemType={item.itemType} size={14} color={itemColorCss} />
                  )}
                </span>
                <span className="pil-mruItemName">{mruDisplayName}</span>
                <span
                  className="pil-mruItemRemove"
                  onClick={(e) => this._handleMruItemRemove(e, item)}
                  title="Remove from recent"
                  role="button"
                  aria-label={"Remove " + item.name + " from recent"}
                >
                  <FontAwesomeIcon icon={faXmark} />
                </span>
              </div>
            );
          })}
        </div>
      );
    }

    // Calculate MRU section height for sticky header offset
    // MRU header is ~20px, each item is 24px
    const mruItemCount = showMru ? mruItems.length : 0;
    const mruSectionHeight = showMru ? 20 + mruItemCount * 24 + 8 : 0; // 8px for padding

    // Create sticky header content if needed
    let stickyHeader = <></>;
    if (this.state.showStickyHeader && this.state.stickyItemType !== undefined) {
      const stickyTypeName = ProjectItemUtilities.getPluralDescriptionForType(this.state.stickyItemType);
      const stickyColor = ProjectItemUtilities.getColorForType(this.state.stickyItemType);
      stickyColor.alpha = 0.85;

      const folderDisplay = this.state.stickyFolderPath ? (
        <span className="pil-stickyFolder">
          <FontAwesomeIcon icon={faFolder} className="fa-sm" />
          <span className="pil-stickyFolderName">{StorageUtilities.getLeafName(this.state.stickyFolderPath)}</span>
        </span>
      ) : null;

      stickyHeader = (
        <div
          className="pil-stickyHeader"
          style={{
            backgroundColor: ColorUtilities.toCss(stickyColor),
            color: this.props.theme.foreground1,
            top: mruSectionHeight,
          }}
        >
          <span className="pil-stickyIcon">
            <ProjectItemTypeIcon itemType={this.state.stickyItemType} size={14} color="#FFFFFF" />
          </span>
          <span className="pil-stickyTypeName">{stickyTypeName}</span>
          {folderDisplay}
        </div>
      );
    }

    return (
      <div
        className="pil-outer"
        key="pil-outer"
        style={{
          borderColor: this.props.theme.background3,
        }}
      >
        <div
          className="pil-wrap"
          style={{
            borderColor: this.props.theme.background3,
          }}
        >
          {splitButton}
          <div className={this.props.readOnly ? "pil-newarea" : "pil-showMenu"}>
            <MenuButton
              menu={showMenuItems}
              trigger={
                <Button
                  icon={<FontAwesomeIcon icon={faListCheck} className="fa-lg" />}
                  content="Show"
                  aria-label="Show or hide different categories of items on the list"
                />
              }
            />
          </div>
          <div
            style={{
              maxHeight: listHeight,
              minHeight: listHeight,
              position: "relative",
            }}
            className={"pil-list" + (CreatorToolsHost.theme === CreatorToolsThemeStyle.dark ? " pil-list-dark" : "")}
            onScroll={this._handleListScroll}
            ref={this._listContainerRef}
          >
            {stickyHeader}
            {mruSection}
            {projectListItems.length > 0 && (
              <VirtualList
                rowCount={projectListItems.length}
                rowHeight={36}
                overscanCount={10}
                rowComponent={VirtualizedRow}
                rowProps={{
                  items: projectListItems,
                  selectedItemIndex,
                  onItemClick: (e: React.MouseEvent, item: IVirtualizedListItem, index: number) => {
                    if (item.onClick) {
                      item.onClick(e, item);
                    }
                    this._handleItemSelected(e, { selectedIndex: index } as any);
                  },
                  onContextMenu: this._handleContextMenu as any,
                }}
                style={{
                  height: Math.max(100, this._getListPixelHeight() - mruSectionHeight),
                  overflowX: "hidden",
                }}
                role="listbox"
                aria-label="List of items within this project"
              />
            )}
          </div>
        </div>
      </div>
    );
  }
}
