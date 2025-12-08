import { Component, MouseEvent, SyntheticEvent, UIEvent } from "react";
import IAppProps from "./IAppProps";
import Project from "./../app/Project";
import {
  MaxItemTypes,
  ProjectItemCategory,
  ProjectItemCreationType,
  ProjectItemErrorStatus,
  ProjectItemType,
} from "./../app/IProjectItemData";
import ProjectItem from "./../app/ProjectItem";
import ProjectEditorUtilities, {
  ProjectEditorItemAction,
  ProjectEditorMode,
  ProjectItemEditorView,
} from "./ProjectEditorUtilities";
import StorageUtilities from "./../storage/StorageUtilities";
import {
  List,
  ListProps,
  ListItemProps,
  MenuButton,
  Button,
  ThemeInput,
  selectableListBehavior,
  selectableListItemBehavior,
  listItemBehavior,
  MenuItemProps,
  ShorthandCollection,
} from "@fluentui/react-northstar";

import { AssetsIcon, AdvancedFilesIcon, FunctionsIcon, TypesIcon, CheckIcon } from "./Labels";
import { GitHubPropertyType } from "./ProjectPropertyEditor";
import ProjectUtilities, { NewEntityTypeAddMode } from "../app/ProjectUtilities";
import IGitHubInfo from "../app/IGitHubInfo";
import "./ProjectItemList.css";
import Utilities from "../core/Utilities";
import { ProjectEditPreference, ProjectRole } from "../app/IProjectData";
import IGalleryItem from "../app/IGalleryItem";
import ColorUtilities from "../core/ColorUtilities";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFolder } from "@fortawesome/free-regular-svg-icons";
import { faCaretDown, faCaretRight, faListCheck } from "@fortawesome/free-solid-svg-icons";
import ProjectItemUtilities from "../app/ProjectItemUtilities";
import ProjectInfoSet from "../info/ProjectInfoSet";
import IProjectItemSeed from "../app/IProjectItemSeed";
import ProjectInfoItem from "../info/ProjectInfoItem";
import { AnnotatedValueSet, IAnnotatedValue } from "../core/AnnotatedValue";
import ProjectAddButton from "./ProjectAddButton";
import WebUtilities from "./WebUtilities";
import ProjectCreateManager from "../app/ProjectCreateManager";
import CreatorToolsHost, { CreatorToolsThemeStyle } from "../app/CreatorToolsHost";

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
  theme: ThemeInput<any>;
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
}

export enum ProjectItemListDialogType {
  noDialog = 0,
  newEntityTypeDialog = 3,
  addGitHubReferenceDialog = 4,
  newBlockTypeDialog = 5,
  newItemDialog = 6,
}

export default class ProjectItemList extends Component<IProjectItemListProps, IProjectItemListState> {
  private _activeProject: Project | null = null;
  private _itemIndices: any[] = [];
  private _itemTypes: any[] = [];
  private _updatePending: boolean = false;
  private _isMountedInternal: boolean = false;
  private _lastSelectedAsMenuItem: number = 0;

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
        });

        this._loadItems();
      }
    }
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
        this._activeProject.onNeedsSaveChanged.subscribe(this._handleProjectChanged);
        this._activeProject.onSaved.subscribe(this._handleProjectChanged);
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
  }

  componentWillUnmount(): void {
    this._isMountedInternal = false;
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

  private _showPackClick(elt: any, event: MenuItemProps | undefined) {
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

  private _handleItemSelected(elt: any, event: ListProps | undefined) {
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

    if (this.props.filteredItems === undefined && event.selectedIndex === 1) {
      if (this.props && this.props.onModeChangeRequested !== undefined) {
        this.props.onModeChangeRequested(ProjectEditorMode.actions);
      }
    } else if (this.props.filteredItems === undefined && event.selectedIndex === 2) {
      if (this.props && this.props.onModeChangeRequested !== undefined) {
        this.props.onModeChangeRequested(ProjectEditorMode.map);
      }
    } else if (this.props.filteredItems === undefined && event.selectedIndex === 3) {
      if (this.props && this.props.onModeChangeRequested !== undefined) {
        this.props.onModeChangeRequested(ProjectEditorMode.properties);
      }
    } else if (this.props.filteredItems === undefined && event.selectedIndex === 4) {
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

  _addTypeSpacer(
    projectListItems: ListItemProps[],
    itemType: ProjectItemType,
    isToggleable: boolean,
    itemIndex: number
  ) {
    const name = ProjectItemUtilities.getPluralDescriptionForType(itemType);
    const color = ProjectItemUtilities.getColorForType(itemType);

    color.alpha = 0.2;

    let additionalData = <></>;

    if (this.props.allInfoSet && this.props.allInfoSet.completedGeneration) {
      const items = this.props.allInfoSet.getItems("LINESIZE", itemType + 100);

      if (items.length === 1) {
        const countVal = items[0].getFeatureContaining("count");
        const totalVal = Utilities.getSimpleNumeric(items[0].getFeatureContaining("total"));

        if (countVal !== undefined && totalVal !== undefined) {
          const statSummary = countVal + " files, " + totalVal + " bytes";

          additionalData = (
            <span className="pil-stats" title={statSummary}>
              {countVal} @ {totalVal}b
            </span>
          );
        }
      }
    }

    let toggle = <></>;

    const isExpanded = !this.props.creatorTools.collapsedTypes.includes(itemType);

    if (isToggleable) {
      toggle = (
        <div className="pil-itemTypeCollapsedToggle" title={(isExpanded ? "Hide" : "Show") + " " + name}>
          <FontAwesomeIcon icon={isExpanded ? faCaretDown : faCaretRight} className="fa-md" />
        </div>
      );
    }

    (projectListItems as any).push({
      accessibility: selectableListItemBehavior,
      onClick: this._handleItemTypeToggle,
      key: "type" + itemType + "|",
      "aria-label": name,
      content: (
        <div
          className="pil-itemTypeHeader"
          key={"eit." + itemType}
          onDoubleClick={this._handleItemTypeDoubleClick}
          title={isExpanded ? "Hide " + name + " items" : "Show " + name + " items"}
          style={{
            color: this.props.theme.siteVariables?.colorScheme.brand.foreground1,
            backgroundColor: ColorUtilities.toCss(color),
          }}
        >
          {toggle}
          <MenuButton
            contextMenu={itemIndex !== this.state.contextFocusedItem}
            open={itemIndex === this.state.contextFocusedItem ? true : undefined}
            onBlur={this._itemContextBlurred}
            trigger={
              <span className="pil-headerLabel">
                <span className="pil-name">{name}</span>
                {additionalData}
              </span>
            }
            onMenuItemClick={this._contextMenuClick}
          />
        </div>
      ),
    });
  }

  _addStoragePathSpacer(
    projectListItems: ListItemProps[],
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
        <div
          className="pil-storagePathCollapsedToggle"
          style={{
            backgroundColor: ColorUtilities.toCss(ColorUtilities.darker(typeColor, 0.1)),
          }}
          title={(isExpanded ? "Hide" : "Show") + " " + folderPath}
        >
          <FontAwesomeIcon icon={isExpanded ? faCaretDown : faCaretRight} className="fa-md" />
        </div>
      );
    } else {
      toggle = (
        <div
          className="pil-storagePathCollapsedToggle"
          style={{
            backgroundColor: ColorUtilities.toCss(ColorUtilities.darker(typeColor, 0.1)),
          }}
          aria-hidden="true"
        >
          &#160;
        </div>
      );
    }

    const keyPath = StorageUtilities.getFolderPath(folderPath);

    (projectListItems as any).push({
      accessibility: selectableListItemBehavior,
      onClick: this._handleStoragePathToggle,
      key: "eitb." + itemType + "." + keyPath,
      "aria-label": folderDisplayPath,
      content: (
        <div
          className="pil-pathHeader"
          key={"eita|" + itemType + "|" + keyPath}
          title={(isExpanded ? "Hide " : "Show ") + folderPath}
          style={{
            color: this.props.theme.siteVariables?.colorScheme.brand.foreground1,
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

          <div
            className="pil-storagePathIcon"
            style={{
              backgroundColor: ColorUtilities.toCss(ColorUtilities.darker(typeColor, 0.1)),
            }}
          >
            <FontAwesomeIcon icon={faFolder} className="fa-md" />
          </div>
          <MenuButton
            contextMenu={itemIndex !== this.state.contextFocusedItem}
            open={itemIndex === this.state.contextFocusedItem ? true : undefined}
            onBlur={this._itemContextBlurred}
            trigger={
              <span
                className="pil-storagePathLabel"
                style={{
                  backgroundColor: ColorUtilities.toCss(ColorUtilities.darker(typeColor, 0.1)),
                }}
                title={folderPath}
              >
                <span className="pil-name">{folderDisplayPath}</span>
              </span>
            }
            onMenuItemClick={this._contextMenuClick}
          />
        </div>
      ),
    });
  }

  _addProjectItem(
    projectListItems: ListItemProps[],
    projectItem: ProjectItem,
    isGitHubRef: boolean,
    itemIndex: number,
    isFocused?: boolean
  ) {
    let name = StorageUtilities.getBaseFromName(projectItem.name);
    let sourceImage = "";

    if (projectItem.imageUrl) {
      sourceImage = "url('" + projectItem.imageUrl + "')";
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

    typeColor.alpha = 0.3;

    if (projectItem === this.props.tentativeProjectItem) {
      typeColor.alpha = 0.9;
    }

    if (this.props.readOnly) {
      const itemItems = [];

      let issues: ProjectInfoItem[] | undefined;

      if (this.props.allInfoSet && this.props.allInfoSetGenerated && projectItem.projectPath) {
        issues = this.props.allInfoSet.getItemsByStoragePath(projectItem.projectPath);
        if (issues?.length === 0) {
          issues = undefined;
        }
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

        itemItems.push(
          <span
            className="pil-itemIndicatorRO"
            title={errorMessage}
            key={"pil-ii" + projectItem.projectPath + (isFocused ? ".focus" : "")}
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
        accessibility: selectableListItemBehavior,
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
              <span className="pil-name">{name}</span>
            </span>
            {itemItems}
          </div>
        ),
      });
    } else {
      const itemMenu = ProjectEditorUtilities.getItemMenuItems(projectItem, this.state.focusFilter);

      let path = "";

      if (projectItem.projectPath !== null && projectItem.projectPath !== undefined) {
        path = projectItem.projectPath;
      }

      let nameCss = "pil-name";

      if (isGitHubRef) {
        nameCss += " pil-name-gh";
      }

      let title = path;

      if (projectItem.errorMessage !== undefined) {
        title = projectItem.errorMessage;
      }

      if (projectItem.errorStatus === ProjectItemErrorStatus.unprocessable) {
        name = "(error) " + name;
      }

      const itemItems = [];

      let issues: ProjectInfoItem[] | undefined;

      if (this.props.allInfoSet && this.props.allInfoSetGenerated && projectItem.projectPath) {
        issues = this.props.allInfoSet.getItemsByStoragePath(projectItem.projectPath);
        if (issues?.length === 0) {
          issues = undefined;
        }
      }

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
                backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background3,
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

        itemItems.push(
          <MenuButton
            style={{
              gridColumn: 4,
              color: this.props.theme.siteVariables?.colorScheme.brand.foreground4,
            }}
            className="pil-itemIndicator"
            key={"pil-mbc." + projectItem.projectPath + (isFocused ? ".focus" : "")}
            title={errorMessage}
            trigger={<div className="pil-itemIndicatorInterior">{issues.length}</div>}
            menu={itemMenu}
            onMenuItemClick={this._contextMenuClick}
          />
        );
      }

      (projectListItems as any).push({
        accessibility: selectableListItemBehavior,
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

  _addReference(projectListItems: ListItemProps[], reference: IGitHubInfo, itemIndex: number) {
    const name = reference.repoName;
    const sig = ProjectItem.getGitHubSignature(reference);

    if (this.props.readOnly) {
      (projectListItems as any).push({
        accessibility: selectableListItemBehavior,
        key: "pil-ghitemr." + sig,
        "aria-label": name,
        content: (
          <div className="pil-item" key={"pil-ghitem." + sig}>
            <span className="pil-name">{name}</span>
          </div>
        ),
      });
    } else {
      const itemMenu = [
        {
          content: "Delete",
          tag: sig,
        },
      ];

      const nameCss = "pil-name";

      (projectListItems as any).push({
        accessibility: selectableListItemBehavior,
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
      projectItem.itemType === ProjectItemType.behaviorPackFolder || // some day we may explicitly show pack folders
      projectItem.itemType === ProjectItemType.resourcePackFolder ||
      projectItem.itemType === ProjectItemType.skinPackFolder ||
      projectItem.itemType === ProjectItemType.designPackFolder ||
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
      projectItem.itemType === ProjectItemType.docInfoJson
    ) {
      return false;
    }

    if (
      projectItem.parentItems?.length === 1 && //projectItem.itemType === ProjectItemType.entityTypeResource ||
      (projectItem.itemType === ProjectItemType.spawnRuleBehavior ||
        projectItem.itemType === ProjectItemType.lootTableBehavior)
    ) {
      return false;
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
        projectItem.itemType === ProjectItemType.worldTemplateManifestJson) &&
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
    const projectListItems: ListItemProps[] = [];

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

    const focusMenuItems: ShorthandCollection<MenuItemProps> = [];
    const entityMenuItems: ShorthandCollection<MenuItemProps> = [];
    let addedEntityMenu = false;
    const blockMenuItems: ShorthandCollection<MenuItemProps> = [];
    let addedBlockMenu = false;
    const itemMenuItems: ShorthandCollection<MenuItemProps> = [];
    let addedItemMenu = false;

    (projectListItems as any).push({
      accessibility: listItemBehavior,
      key: "pilb-searchsum",
      content: searchSummaryContent,
    });

    if (this.props.filteredItems === undefined) {
      (projectListItems as any).push({
        accessibility: selectableListItemBehavior,
        key: "pilats",
        "aria-label": "Actions",
        content: (
          <div className="pil-fixedLine" key="pil-ats">
            Actions
          </div>
        ),
      });

      (projectListItems as any).push({
        accessibility: selectableListItemBehavior,
        key: "pilmap",
        "aria-label": "Map",
        content: (
          <div className="pil-fixedLine" key="pil-map">
            Map
          </div>
        ),
      });

      let projectContent = <></>;
      let whatIsThis = this.props.readOnly || this.props.project?.role === ProjectRole.explorer ? "Content" : "Project";

      if (this.props.allInfoSet.info.defaultIcon && this.props.allInfoSet.info.defaultIcon) {
        projectContent = (
          <div className="pil-fixedLine pil-fixedLineRow" key="pil-fixpropj">
            <div className="pil-projectName">{whatIsThis}</div>
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
            {whatIsThis}
          </div>
        );
      }

      (projectListItems as any).push({
        accessibility: selectableListItemBehavior,
        key: "pilb-proje",
        "aria-label": whatIsThis,
        content: projectContent,
      });

      (projectListItems as any).push({
        accessibility: selectableListItemBehavior,
        key: "pilb-insp",
        "aria-label": "Inspector",
        content: (
          <div className="pil-fixedLine" key="pil-insp">
            Inspector
          </div>
        ),
      });
    }

    let selectedItemIndex = 1;
    let itemsAdded = 1;

    if (this.props.filteredItems === undefined) {
      if (this.props.editorMode === ProjectEditorMode.map) {
        selectedItemIndex = 2;
      } else if (this.props.editorMode === ProjectEditorMode.properties) {
        selectedItemIndex = 3;
      } else if (this.props.editorMode === ProjectEditorMode.inspector) {
        selectedItemIndex = 4;
      }

      itemsAdded = 5;
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
            if (projectItem.itemType !== lastItemType) {
              this._addTypeSpacer(
                projectListItems,
                projectItem.itemType,
                this.props.filteredItems === undefined,
                itemsAdded
              );
              this._itemTypes[itemsAdded] = ListItemType.typeSpacer;
              this._itemIndices[itemsAdded] = projectItem.itemType;
              itemsAdded++;
              lastItemType = projectItem.itemType;
            }

            if (
              this.props.filteredItems !== undefined ||
              !this.state.collapsedItemTypes.includes(projectItem.itemType)
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

    const showMenuItems: ShorthandCollection<MenuItemProps> = [];

    showMenuItems.push({
      icon: (
        <FunctionsIcon
          theme={this.props.theme}
          isSelected={this.props.project?.showFunctions === true}
          isCompact={true}
        />
      ),
      content: "Script and Functions",
      key: "pil-hideShowFunctions",
      onClick: this._showFunctionsClick,
      title: "Toggle whether functions and scripts are shown",
    });

    showMenuItems.push({
      icon: <TypesIcon theme={this.props.theme} isSelected={this.props.project?.showTypes === true} isCompact={true} />,
      key: "pil-hideShowTypes",
      content: "Types",
      onClick: this._showTypesClick,
      title: "Toggle whether world details and entity, block, and item types are shown",
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
        />
      );
    }

    const listHeight = "calc(100vh - " + (this.props.heightOffset + 44) + "px)";

    return (
      <div
        className="pil-outer"
        key="pil-outer"
        style={{
          borderColor: this.props.theme.siteVariables?.colorScheme.brand.background3,
        }}
      >
        <div
          className="pil-wrap"
          style={{
            borderColor: this.props.theme.siteVariables?.colorScheme.brand.background3,
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
            }}
            className={"pil-list" + (CreatorToolsHost.theme === CreatorToolsThemeStyle.dark ? " pil-list-dark" : "")}
            onScroll={this._handleListScroll}
          >
            <List
              selectable
              aria-label="List of items within this project"
              accessibility={selectableListBehavior}
              defaultSelectedIndex={selectedItemIndex}
              selectedIndex={selectedItemIndex}
              items={projectListItems}
              onContextMenu={this._handleContextMenu}
              onSelectedIndexChange={this._handleItemSelected}
            />
          </div>
        </div>
      </div>
    );
  }
}
