import { Component, SyntheticEvent, UIEvent } from "react";
import IAppProps from "./IAppProps";
import Project from "./../app/Project";
import { MaxItemTypes, ProjectItemCategory, ProjectItemErrorStatus, ProjectItemType } from "./../app/IProjectItemData";
import ProjectItem from "./../app/ProjectItem";
import { ProjectEditorMode } from "./ProjectEditorUtilities";
import StorageUtilities from "./../storage/StorageUtilities";

import {
  SplitButton,
  Dialog,
  Toolbar,
  List,
  ListProps,
  ListItemProps,
  MenuButton,
  Button,
  Input,
  InputProps,
  ThemeInput,
} from "@fluentui/react-northstar";

import { AssetsLabel, EyeSlashLabel, FunctionsLabel, TypesLabel } from "./Labels";
import { GitHubPropertyType } from "./ProjectPropertyEditor";
import AddGitHubReference from "./AddGitHubReference";
import NewEntityType from "./NewEntityType";
import ProjectExporter from "../app/ProjectExporter";
import ProjectUtilities, { NewEntityTypeAddMode } from "../app/ProjectUtilities";
import IGitHubInfo from "../app/IGitHubInfo";
import ProjectItemManager from "../app/ProjectItemManager";

import "./ProjectItemList.css";
import Utilities from "../core/Utilities";
import NewBlockType from "./NewBlockType";
import { ProjectEditPreference, ProjectRole, ProjectScriptLanguage } from "../app/IProjectData";
import IGalleryProject from "../app/IGalleryProject";
import ColorUtilities from "../core/ColorUtilities";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFolder } from "@fortawesome/free-regular-svg-icons";
import { faCaretDown, faCaretRight } from "@fortawesome/free-solid-svg-icons";
import ProjectItemUtilities from "../app/ProjectItemUtilities";
import ProjectInfoSet from "../info/ProjectInfoSet";
import IProjectItemSeed from "../app/IProjectItemSeed";
import NewItem from "./NewItem";
import ProjectInfoItem from "../info/ProjectInfoItem";
import { AnnotatedValueSet, IAnnotatedValue } from "../core/AnnotatedValue";

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
  onActiveProjectItemChangeRequested?: (projectItem: ProjectItem, forceRawView: boolean) => void;
  onActiveReferenceChangeRequested?: (reference: IGitHubInfo) => void;
  onModeChangeRequested?: (mode: ProjectEditorMode) => void;
  filteredItems?: IAnnotatedValue[];
  project: Project | null;
  editorMode: ProjectEditorMode;
  allInfoSet: ProjectInfoSet;
  allInfoSetGenerated: boolean;
  activeProjectItem: ProjectItem | null;
  heightOffset: number;
  readOnly: boolean;
}

interface IProjectItemListState {
  activeItem: ProjectItem | undefined;
  dialogMode: ProjectItemListDialogType;
  maxItemsToShow: number;
  newItemType?: ProjectItemType;
  activeProjectInfoSet?: ProjectInfoSet | undefined;
  collapsedItemTypes: number[];
  collapsedStoragePaths: string[];
}

export enum ProjectItemListDialogType {
  noDialog = 0,
  renameDialog = 1,
  deleteConfirmDialog = 2,
  newEntityTypeDialog = 3,
  addGitHubReferenceDialog = 4,
  newBlockTypeDialog = 5,
  newItemDialog = 6,
}

export default class ProjectItemList extends Component<IProjectItemListProps, IProjectItemListState> {
  private _activeProject: Project | null = null;
  private _projectListItems: ListItemProps[] = [];
  private _itemIndices: any[] = [];
  private _itemTypes: any[] = [];
  private _newItemName?: string;
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
  tentativeNewEntityTypeProject?: IGalleryProject;

  tentativeNewBlockTypeName?: string;
  tentativeNewBlockTypeBaseId?: string;

  constructor(props: IProjectItemListProps) {
    super(props);

    this._updateNewItemSeed = this._updateNewItemSeed.bind(this);

    this._handleNewItem = this._handleNewItem.bind(this);
    this._handleItemSelected = this._handleItemSelected.bind(this);
    this._handleProjectChanged = this._handleProjectChanged.bind(this);
    this._projectUpdated = this._projectUpdated.bind(this);
    this._showAllClick = this._showAllClick.bind(this);
    this._showFunctionsClick = this._showFunctionsClick.bind(this);
    this._showAssetsClick = this._showAssetsClick.bind(this);
    this._showTypesClick = this._showTypesClick.bind(this);
    this._handleNewTestClick = this._handleNewTestClick.bind(this);
    this._handleNewScriptClick = this._handleNewScriptClick.bind(this);
    this._handleNewAutoScriptClick = this._handleNewAutoScriptClick.bind(this);
    this._handleNewWorldTestClick = this._handleNewWorldTestClick.bind(this);
    this._handleNewStructureClick = this._handleNewStructureClick.bind(this);
    this._handleNewDocTypeClick = this._handleNewDocTypeClick.bind(this);
    this._handleNewFormClick = this._handleNewFormClick.bind(this);
    this._contextMenuClick = this._contextMenuClick.bind(this);
    this._handleNewProjectItemName = this._handleNewProjectItemName.bind(this);
    this._handleConfirmRename = this._handleConfirmRename.bind(this);
    this._handleConfirmDelete = this._handleConfirmDelete.bind(this);
    this._handleCancel = this._handleCancel.bind(this);
    this._handleItemTypeToggle = this._handleItemTypeToggle.bind(this);
    this._handleItemTypeDoubleClick = this._handleItemTypeDoubleClick.bind(this);
    this._handleStoragePathToggle = this._handleStoragePathToggle.bind(this);
    this._handleNewFunctionClick = this._handleNewFunctionClick.bind(this);
    this._addGitHubReferenceClick = this._addGitHubReferenceClick.bind(this);
    this._handleNewEntityTypeClick = this._handleNewEntityTypeClick.bind(this);
    this._handleNewBlockTypeClick = this._handleNewBlockTypeClick.bind(this);
    this._githubProjectUpdated = this._githubProjectUpdated.bind(this);
    this._handleAddReference = this._handleAddReference.bind(this);
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
      collapsedItemTypes: this.props.carto.collapsedTypes,
      collapsedStoragePaths: this.props.project ? this.props.project.collapsedStoragePaths : [],
    };

    this._projectUpdated();
  }

  componentDidUpdate(prevProps: IProjectItemListProps, prevState: IProjectItemListState) {
    this._projectUpdated();
  }

  _newEntityTypeUpdated(newAddMode: NewEntityTypeAddMode, entityTypeProject: IGalleryProject, name: string) {
    this.tentativeNewEntityTypeProject = entityTypeProject;
    this.tentativeNewEntityTypeAddMode = newAddMode;
    this.tentativeNewEntityTypeName = name;
  }

  _newBlockTypeUpdated(baseTypeId: string | undefined, name: string | undefined) {
    this.tentativeNewBlockTypeBaseId = baseTypeId;
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
          maxItemsToShow: this.state.maxItemsToShow + Math.min(this.state.maxItemsToShow, 1100),
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
        this.props.project.onItemAdded.subscribe(this._handleProjectChanged);
        this.props.project.onPropertyChanged.subscribe(this._handleProjectChanged);
        this.props.project.onItemRemoved.subscribe(this._handleProjectChanged);
        this.props.project.onItemChanged.subscribe(this._handleProjectChanged);
        this.props.project.onNeedsSaveChanged.subscribe(this._handleProjectChanged);
        this.props.project.onSaved.subscribe(this._handleProjectChanged);
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

  private _showTypesClick() {
    if (this.props.project === null) {
      return;
    }

    this.props.project.showTypes = !this.props.project.showTypes;
    this._loadItems();
  }

  private _handleNewProjectItemName(e: SyntheticEvent, data: (InputProps & { value: string }) | undefined) {
    if (data === undefined || this.props.project === null || this.state == null) {
      return;
    }

    this._newItemName = data.value;
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

    if (this.props.filteredItems === undefined && event.selectedIndex === 0) {
      if (this.props && this.props.onModeChangeRequested !== undefined) {
        this.props.onModeChangeRequested(ProjectEditorMode.actions);
      }
    } else if (this.props.filteredItems === undefined && event.selectedIndex === 1) {
      if (this.props && this.props.onModeChangeRequested !== undefined) {
        this.props.onModeChangeRequested(ProjectEditorMode.properties);
      }
    } else if (this.props.filteredItems === undefined && event.selectedIndex === 2) {
      if (this.props && this.props.onModeChangeRequested !== undefined) {
        this.props.onModeChangeRequested(ProjectEditorMode.inspector);
      }
    } else if (this._itemTypes[event.selectedIndex] === ListItemType.item) {
      const newItem = this.props.project.items[this._itemIndices[event.selectedIndex]];

      if (newItem) {
        if (
          this.props &&
          this.props.onActiveProjectItemChangeRequested !== undefined &&
          this._lastSelectedAsMenuItem <= 0
        ) {
          this.props.onActiveProjectItemChangeRequested(newItem as ProjectItem, false);
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

  _handleNewTestClick() {
    if (this.props.project !== null) {
      ProjectItemManager.createNewGameTestScript(this.props.project);
    }
  }

  _handleNewScriptClick() {
    if (this.props.project !== null) {
      this.launchNewItemType(
        this.props.project.preferredScriptLanguage === ProjectScriptLanguage.javaScript
          ? ProjectItemType.js
          : ProjectItemType.ts
      );
    }
  }

  _handleNewAutoScriptClick() {
    if (this.props.project !== null) {
      ProjectItemManager.createNewAutoScript(this.props.project);
    }
  }

  _handleNewWorldTestClick() {
    if (this.props.project !== null) {
      ProjectItemManager.createNewWorldTest(this.props.project);
    }
  }

  _handleNewDocTypeClick() {
    if (this.props.project !== null) {
      ProjectItemManager.createNewDocumentedType(this.props.project);
    }
  }

  _handleNewFormClick() {
    if (this.props.project !== null) {
      ProjectItemManager.createNewForm(this.props.project);
    }
  }

  _handleNewFunctionClick() {
    if (this.props.project !== null) {
      ProjectItemManager.createNewFunction(this.props.project);
    }
  }

  async _handleNewStructureClick() {}

  launchNewItemType(itemType: ProjectItemType) {
    this._tentativeNewItem = {
      name: undefined,
      itemType: itemType,
    };

    this.setState({
      activeItem: this.state.activeItem,
      dialogMode: ProjectItemListDialogType.newItemDialog,
      newItemType: itemType,
      maxItemsToShow: this.state.maxItemsToShow,
      collapsedItemTypes: this.state.collapsedItemTypes,
      collapsedStoragePaths: this.state.collapsedStoragePaths,
    });
  }

  async _handleNewEntityTypeClick() {
    if (this.state === null || !this._isMountedInternal) {
      return;
    }

    this.setState({
      activeItem: this.state.activeItem,
      dialogMode: ProjectItemListDialogType.newEntityTypeDialog,
      maxItemsToShow: this.state.maxItemsToShow,
      collapsedItemTypes: this.state.collapsedItemTypes,
      collapsedStoragePaths: this.state.collapsedStoragePaths,
    });
  }

  async _handleNewBlockTypeClick() {
    if (this.state === null || !this._isMountedInternal) {
      return;
    }

    this.setState({
      activeItem: this.state.activeItem,
      dialogMode: ProjectItemListDialogType.newBlockTypeDialog,
      maxItemsToShow: this.state.maxItemsToShow,
      collapsedItemTypes: this.state.collapsedItemTypes,
      collapsedStoragePaths: this.state.collapsedStoragePaths,
    });
  }

  async _addGitHubReferenceClick() {
    if (this.state === null || !this._isMountedInternal) {
      return;
    }

    this.setState({
      activeItem: this.state.activeItem,
      dialogMode: ProjectItemListDialogType.addGitHubReferenceDialog,
      maxItemsToShow: this.state.maxItemsToShow,
      collapsedItemTypes: this.state.collapsedItemTypes,
      collapsedStoragePaths: this.state.collapsedStoragePaths,
    });
  }

  _handleConfirmRename() {
    if (this.state === null || this.state.activeItem === undefined || this._newItemName === undefined) {
      return;
    }

    this.state.activeItem.rename(this._newItemName);

    this.setState({
      activeItem: undefined,
      dialogMode: ProjectItemListDialogType.noDialog,
      maxItemsToShow: this.state.maxItemsToShow,
      collapsedItemTypes: this.state.collapsedItemTypes,
      collapsedStoragePaths: this.state.collapsedStoragePaths,
    });
  }

  async _handleNewBlockType() {
    if (this.state === null) {
      return;
    }

    if (this.tentativeNewBlockTypeName !== undefined && this.props.project !== null) {
      await ProjectUtilities.addBlockType(
        this.props.project,
        this.tentativeNewBlockTypeBaseId,
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
      collapsedItemTypes: this.state.collapsedItemTypes,
      collapsedStoragePaths: this.state.collapsedStoragePaths,
    });
  }

  async _handleNewEntityType() {
    if (this.state === null) {
      return;
    }

    if (this.tentativeNewEntityTypeProject !== undefined && this.props.project !== null) {
      await ProjectUtilities.addEntityType(
        this.props.project,
        this.tentativeNewEntityTypeProject,
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
      collapsedItemTypes: this.state.collapsedItemTypes,
      collapsedStoragePaths: this.state.collapsedStoragePaths,
    });
  }

  async _handleNewItem() {
    if (this.state === null) {
      return;
    }

    let projectItem = undefined;

    if (this._tentativeNewItem !== undefined && this.props.project !== null) {
      projectItem = await ProjectItemManager.createNewItem(this.props.project, this._tentativeNewItem);
    }

    if (this.props.project) {
      await this.props.project.save();
    }

    this.setState({
      activeItem: projectItem,
      dialogMode: ProjectItemListDialogType.noDialog,
      maxItemsToShow: this.state.maxItemsToShow,
      collapsedItemTypes: this.state.collapsedItemTypes,
      collapsedStoragePaths: this.state.collapsedStoragePaths,
    });

    if (projectItem && this.props.onActiveProjectItemChangeRequested) {
      this.props.onActiveProjectItemChangeRequested(projectItem, false);
    }
  }

  _handleAddReference() {
    if (this.state === null) {
      return;
    }

    if (
      this.tentativeGitHubOwner !== undefined &&
      this.tentativeGitHubRepoName !== undefined &&
      this.props.project !== null
    ) {
      ProjectExporter.addGitHubReference(
        this.props.carto,
        this.props.project,
        this.tentativeGitHubOwner,
        this.tentativeGitHubRepoName,
        this.tentativeGitHubBranch,
        this.tentativeGitHubFolder,
        this.tentativeGitHubRepoName
      );
    }

    this.setState({
      activeItem: undefined,
      dialogMode: ProjectItemListDialogType.noDialog,
      maxItemsToShow: this.state.maxItemsToShow,
      collapsedItemTypes: this.state.collapsedItemTypes,
      collapsedStoragePaths: this.state.collapsedStoragePaths,
    });
  }

  _handleConfirmDelete() {
    if (this.state === null || this.state.activeItem === undefined) {
      return;
    }

    if (this.state.activeItem === this.props.activeProjectItem && this.props.onModeChangeRequested !== undefined) {
      this.props.onModeChangeRequested(ProjectEditorMode.properties);
    }

    this.state.activeItem.deleteItem();

    this.setState({
      activeItem: undefined,
      dialogMode: ProjectItemListDialogType.noDialog,
      maxItemsToShow: this.state.maxItemsToShow,
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
      collapsedItemTypes: this.state.collapsedItemTypes,
      collapsedStoragePaths: this.state.collapsedStoragePaths,
    });
  }

  _handleItemTypeToggle(e: SyntheticEvent<HTMLDivElement, Event>, data?: any | undefined) {
    if (e && e.currentTarget && e.currentTarget.title) {
      for (let i = 0; i < MaxItemTypes; i++) {
        const name = "Toggle " + ProjectItemUtilities.getPluralDescriptionForType(i) + " visibility";

        if (name === e.currentTarget.title) {
          if (this.props.carto.collapsedTypes.includes(i)) {
            this.props.carto.ensureTypeIsNotCollapsed(i);
            this._loadItems();
          } else {
            this.props.carto.ensureTypeIsCollapsed(i);
          }

          this.props.carto.save();

          this.setState({
            activeItem: this.state.activeItem,
            dialogMode: this.state.dialogMode,
            maxItemsToShow: this.state.maxItemsToShow,
            collapsedItemTypes: this.props.carto.collapsedTypes,
            collapsedStoragePaths: this.state.collapsedStoragePaths,
          });
          return;
        }
      }
    }
  }

  _handleItemTypeDoubleClick(e: SyntheticEvent<HTMLDivElement, Event>, data?: any | undefined) {
    if (e && e.currentTarget && e.currentTarget.title) {
      for (let i = 0; i < MaxItemTypes; i++) {
        const name = "Toggle " + ProjectItemUtilities.getPluralDescriptionForType(i) + " visibility";

        if (name === e.currentTarget.title) {
          this.props.carto.ensureAllTypesCollapsedExcept(i);

          this.props.carto.save();

          this.setState({
            activeItem: this.state.activeItem,
            dialogMode: this.state.dialogMode,
            maxItemsToShow: this.state.maxItemsToShow,
            collapsedItemTypes: this.props.carto.collapsedTypes,
            collapsedStoragePaths: this.state.collapsedStoragePaths,
          });
          return;
        }
      }
    }
  }

  _handleStoragePathToggle(e: SyntheticEvent<HTMLDivElement, Event>, data?: any | undefined) {
    if (e && e.currentTarget && e.currentTarget.title && this.props.project) {
      for (let i = 0; i < this.props.project.items.length; i++) {
        const groupingPath = this.props.project.items[i].getFolderGroupingPath();

        if (groupingPath !== undefined && groupingPath !== null) {
          const name = "Toggle " + groupingPath + " visibility";

          if (name === e.currentTarget.title) {
            if (this.props.project.collapsedStoragePaths.includes(groupingPath)) {
              this.props.project.ensureStoragePathIsNotCollapsed(groupingPath);
              this._loadItems();
            } else {
              this.props.project.ensureStoragePathIsCollapsed(groupingPath);
            }

            this.setState({
              activeItem: this.state.activeItem,
              dialogMode: this.state.dialogMode,
              maxItemsToShow: this.state.maxItemsToShow,
              collapsedItemTypes: this.props.carto.collapsedTypes,
              collapsedStoragePaths: this.props.project.collapsedStoragePaths,
            });

            return;
          }
        }
      }
    }
  }

  _contextMenuClick(e: SyntheticEvent<HTMLElement, Event>, data?: any | undefined) {
    if (data !== undefined && data.tag !== undefined && this.props.project !== null) {
      const projectItem = this.props.project.getItemByStoragePath(data.tag);

      if (projectItem !== null) {
        if (data.content === "Rename") {
          this.setState({
            activeItem: projectItem,
            dialogMode: ProjectItemListDialogType.renameDialog,
            maxItemsToShow: this.state.maxItemsToShow,
            collapsedItemTypes: this.state.collapsedItemTypes,
            collapsedStoragePaths: this.state.collapsedStoragePaths,
          });
        } else if (data.content === "Delete") {
          this.setState({
            activeItem: projectItem,
            dialogMode: ProjectItemListDialogType.deleteConfirmDialog,
            maxItemsToShow: this.state.maxItemsToShow,
            collapsedItemTypes: this.state.collapsedItemTypes,
            collapsedStoragePaths: this.state.collapsedStoragePaths,
          });
        } else if (data.content === "View as JSON" && this.props.onActiveProjectItemChangeRequested) {
          this._lastSelectedAsMenuItem = 1;
          this.props.onActiveProjectItemChangeRequested(projectItem as ProjectItem, true);
        }
      }
    }

    e.bubbles = false;
  }

  _addTypeSpacer(itemType: ProjectItemType, isToggleable: boolean) {
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
          const isBinary = ProjectItemUtilities.isBinaryType(itemType);
          const statSummary = countVal + " files, " + totalVal + " " + (isBinary ? "bytes" : "lines");

          additionalData = (
            <span className="pil-stats" title={statSummary}>
              {countVal} - {totalVal}
            </span>
          );
        }
      }
    }

    let toggle = <></>;

    if (isToggleable) {
      toggle = (
        <div className="pil-itemTypeCollapsedToggle">
          <FontAwesomeIcon
            icon={this.props.carto.collapsedTypes.includes(itemType) ? faCaretRight : faCaretDown}
            className="fa-md"
          />
        </div>
      );
    }

    this._projectListItems.push({
      header: (
        <div
          className="pil-itemTypeHeader"
          key={"eit" + itemType}
          onClick={this._handleItemTypeToggle}
          onDoubleClick={this._handleItemTypeDoubleClick}
          title={"Toggle " + name + " visibility"}
          style={{
            color: this.props.theme.siteVariables?.colorScheme.brand.foreground1,
            backgroundColor: ColorUtilities.toCss(color),
          }}
        >
          {toggle}
          <MenuButton
            contextMenu={true}
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

  _addStoragePathSpacer(storagePathFolder: string, itemType: ProjectItemType, isToggleable: boolean) {
    const name = storagePathFolder;
    const typeColor = ProjectItemUtilities.getColorForType(itemType);

    typeColor.alpha = 0.2;

    let toggle = <></>;

    if (isToggleable) {
      toggle = (
        <div
          className="pil-storagePathCollapsedToggle"
          style={{
            backgroundColor: ColorUtilities.toCss(ColorUtilities.darker(typeColor, 0.1)),
          }}
        >
          <FontAwesomeIcon
            icon={this.props.project?.collapsedStoragePaths.includes(storagePathFolder) ? faCaretRight : faCaretDown}
            className="fa-md"
          />
        </div>
      );
    }

    this._projectListItems.push({
      header: (
        <div
          className="pil-pathHeader"
          key={"eit" + itemType}
          onClick={this._handleStoragePathToggle}
          title={"Toggle " + name + " visibility"}
          style={{
            color: this.props.theme.siteVariables?.colorScheme.brand.foreground1,
          }}
        >
          <div className="pil-itemTypeTag" style={{ backgroundColor: ColorUtilities.toCss(typeColor) }}>
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
            contextMenu={true}
            trigger={
              <span
                className="pil-storagePathLabel"
                style={{
                  backgroundColor: ColorUtilities.toCss(ColorUtilities.darker(typeColor, 0.1)),
                }}
                title={name}
              >
                <span className="pil-name">{name}</span>
              </span>
            }
            onMenuItemClick={this._contextMenuClick}
          />
        </div>
      ),
    });
  }

  _addProjectItem(projectItem: ProjectItem, isGitHubRef: boolean) {
    let name = StorageUtilities.getBaseFromName(projectItem.name);
    let sourceImage = "";

    if (projectItem.imageUrl) {
      // image = <img alt="Preview of the world" src={projectItem.imageUrl} className="pil-previewImage" />;
      sourceImage = "url('" + projectItem.imageUrl + "')";
    }

    if (
      projectItem.storagePath &&
      this.props.project &&
      this.props.project.changedFilesSinceLastSaved[ProjectUtilities.canonicalizeStoragePath(projectItem.storagePath)]
    ) {
      name += "*";
    }

    const typeColor = ProjectItemUtilities.getColorForType(projectItem.itemType);

    typeColor.alpha = 0.3;

    if (this.props.readOnly) {
      const itemItems = [];

      let issues: ProjectInfoItem[] | undefined;

      if (this.props.allInfoSet && this.props.allInfoSetGenerated && projectItem.storagePath) {
        issues = this.props.allInfoSet.getItemsByStoragePath(projectItem.storagePath);
        if (issues?.length === 0) {
          issues = undefined;
        }
      }

      if (sourceImage !== "") {
        itemItems.push(
          <span
            style={{
              gridColumn: issues ? 3 : 4,
              backgroundImage: sourceImage,
              backgroundSize: "cover",
            }}
          >
            &#160;
          </span>
        );
      }

      let nameSpan = 1;

      if (issues) {
        let errorMessage = "";

        for (const issue of issues) {
          errorMessage += this.props.allInfoSet.getEffectiveMessage(issue) + "\r\n";
        }

        itemItems.push(
          <span className="pil-itemIndicatorRO" title={errorMessage} key={"pil-ii" + projectItem.storagePath}>
            {issues.length}
          </span>
        );
      } else {
        nameSpan++;
      }

      if (sourceImage === "") {
        nameSpan++;
      }

      this._projectListItems.push({
        content: (
          <div className="pil-item" key={"ro" + projectItem.storagePath}>
            <div className="pil-itemTypeTag" style={{ backgroundColor: ColorUtilities.toCss(typeColor) }}>
              &#160;
            </div>
            <span
              className="pil-itemLabel"
              style={{
                gridColumnStart: 2,
                gridColumnEnd: 2 + nameSpan,
              }}
            >
              <span className="pil-name">{name}</span>
            </span>
            {itemItems}
          </div>
        ),
      });
    } else {
      const itemMenu = [
        {
          key: "rename",
          content: "Rename",
          tag: projectItem.storagePath,
        },
        {
          key: "delete",
          content: "Delete",
          tag: projectItem.storagePath,
        },
      ];

      let path = "";

      if (projectItem.storagePath !== null && projectItem.storagePath !== undefined) {
        path = projectItem.storagePath;
      }

      if (StorageUtilities.getTypeFromName(path) === "json") {
        itemMenu.push({
          key: "viewAsJson" + projectItem.storagePath,
          content: "View as JSON",
          tag: projectItem.storagePath,
        });
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

      if (this.props.allInfoSet && this.props.allInfoSetGenerated && projectItem.storagePath) {
        issues = this.props.allInfoSet.getItemsByStoragePath(projectItem.storagePath);
        if (issues?.length === 0) {
          issues = undefined;
        }
      }

      itemItems.push(
        <div className="pil-itemTypeTag" style={{ backgroundColor: ColorUtilities.toCss(typeColor) }}>
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
          contextMenu={true}
          trigger={
            <span
              className="pil-itemLabel"
              style={{
                gridColumnStart: 2,
                gridColumnEnd: 2 + nameSpan,
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
        itemItems.push(
          <MenuButton
            style={{
              gridColumn: issues ? 3 : 4,
              backgroundImage: sourceImage,
              backgroundSize: "cover",
            }}
            trigger={
              <span
                className={
                  projectItem === this.props.activeProjectItem
                    ? "pil-contextMenuButton"
                    : "pil-contextMenuButton pil-cmbUnfocused"
                }
              >
                <Button content="..." aria-label="Click button" />
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
          errorMessage += this.props.allInfoSet.getEffectiveMessage(issue) + "\r\n";
        }
        itemItems.push(
          <MenuButton
            style={{
              gridColumn: 4,
            }}
            title={errorMessage}
            trigger={
              <span className="pil-itemIndicator">
                <Button content={issues.length} aria-label="Click button" />
              </span>
            }
            menu={itemMenu}
            onMenuItemClick={this._contextMenuClick}
          />
        );
      }

      this._projectListItems.push({
        content: (
          <div className="pil-item" key={"eoa" + projectItem.storagePath}>
            {itemItems}
          </div>
        ),
      });
    }
  }

  _updateNewItemSeed(newSeed: IProjectItemSeed) {
    this._tentativeNewItem = newSeed;
  }

  _addReference(reference: IGitHubInfo) {
    const name = reference.repoName;
    const sig = ProjectItem.getGitHubSignature(reference);

    if (this.props.readOnly) {
      this._projectListItems.push({
        content: (
          <div className="pil-item" key={"ghitem" + sig}>
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

      this._projectListItems.push({
        content: (
          <div className="pil-item" key={"ghitema" + sig} style={{ minWidth: 310 }}>
            <MenuButton
              contextMenu={true}
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
                <span className="pil-contextMenuButton">
                  <Button content="..." aria-label="Click button" />
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

  async _loadItems() {
    if (this.props.project === null) {
      return;
    }

    const projectItems = this.props.project.items.sort(ProjectItemList.sortItems);
    let needsUpdate = false;
    let itemsShown = 0;

    for (let i = 0; i < projectItems.length && itemsShown < this.state.maxItemsToShow; i++) {
      const projectItem = projectItems[i];

      if (
        !this.state.collapsedItemTypes.includes(projectItem.itemType) &&
        this.shouldShowProjectItem(projectItem) &&
        !projectItem.isLoaded
      ) {
        const projectFolderGrouping = projectItem.getFolderGroupingPath();

        if (projectFolderGrouping === undefined || !this.state.collapsedStoragePaths.includes(projectFolderGrouping)) {
          await projectItem.load();
          itemsShown++;
          needsUpdate = true;
        }
      }
    }

    if (needsUpdate) {
      this._handleProjectChanged();
    }
  }

  shouldShowProjectItem(projectItem: ProjectItem) {
    if (!this.props.project) {
      return false;
    }

    if (!projectItem.storagePath) {
      return false;
    }

    if (this.props.filteredItems) {
      return AnnotatedValueSet.includes(this.props.filteredItems, projectItem.storagePath);
    }

    const cat = ProjectItemUtilities.getCategory(projectItem.itemType);

    if (!this.props.project.showFunctions && cat === ProjectItemCategory.logic) {
      return false;
    }

    if (!this.props.project.showAssets && cat === ProjectItemCategory.assets) {
      return false;
    }

    if (!this.props.project.showTypes && cat === ProjectItemCategory.types) {
      return false;
    }

    if (this.props.project.showHiddenItems) {
      return true;
    }

    if (
      cat === ProjectItemCategory.build ||
      cat === ProjectItemCategory.package ||
      projectItem.itemType === ProjectItemType.lang || // should be handled by Text editor
      projectItem.itemType === ProjectItemType.languagesCatalogResourceJson || // should be handled by Text editor
      projectItem.itemType === ProjectItemType.fileListArrayJson ||
      projectItem.itemType === ProjectItemType.buildProcessedJs ||
      projectItem.itemType === ProjectItemType.catalogIndexJs ||
      projectItem.itemType === ProjectItemType.behaviorPackFolder || // some day we may explicitly show pack folders
      projectItem.itemType === ProjectItemType.resourcePackFolder ||
      projectItem.itemType === ProjectItemType.skinPackFolder ||
      projectItem.itemType === ProjectItemType.blocksCatalogResourceJson || // this should be handled by block type editor for bp block type
      projectItem.itemType === ProjectItemType.blockTypeResourceJson || // this should be handled by block type editor for bp block type
      projectItem.itemType === ProjectItemType.entityTypeResourceJson || // this should be handled by entity type editor for bp entity type
      projectItem.itemType === ProjectItemType.behaviorPackListJson || // this should be handled by world editor
      projectItem.itemType === ProjectItemType.resourcePackListJson || // this should be handled by world editor
      projectItem.itemType === ProjectItemType.animationControllerBehaviorJson || // this should be rendered by entity type editor
      projectItem.itemType === ProjectItemType.animationBehaviorJson || // this should be rendered by entity type editor
      projectItem.itemType === ProjectItemType.animationResourceJson || // this should be model editor
      projectItem.itemType === ProjectItemType.animationControllerResourceJson || // this should be model editor
      projectItem.itemType === ProjectItemType.docInfoJson
    ) {
      return false;
    }

    const fileName = StorageUtilities.getLeafName(projectItem.storagePath);

    let perTypeShouldShow = true;

    if (
      (projectItem.itemType === ProjectItemType.packageJson ||
        projectItem.itemType === ProjectItemType.behaviorPackManifestJson ||
        projectItem.itemType === ProjectItemType.resourcePackManifestJson ||
        projectItem.itemType === ProjectItemType.skinPackManifestJson ||
        projectItem.itemType === ProjectItemType.worldTemplateManifestJson) &&
      this.props.project.editPreference === ProjectEditPreference.summarized
    ) {
      perTypeShouldShow = false;
    }

    return (
      (!projectItem.isAutogenerated || this.props.project.showHiddenItems) &&
      perTypeShouldShow &&
      (projectItem.itemType !== ProjectItemType.json || !fileName.startsWith(".")) && // hide files like .prettierrc.json from view
      (projectItem.itemType !== ProjectItemType.json || !fileName.startsWith("extensions")) && // hide files like extensions.json from view
      (projectItem.itemType !== ProjectItemType.json || !fileName.startsWith("settings")) && // hide files like settings.json from view
      (projectItem.gitHubReference === undefined || projectItem.gitHubReference.owner === undefined)
    );
  }

  static sortItems(a: ProjectItem, b: ProjectItem) {
    const aType = ProjectItemUtilities.getSortOrder(a.itemType);
    const bType = ProjectItemUtilities.getSortOrder(b.itemType);

    if (aType === bType) {
      if (a.storagePath && b.storagePath) {
        return a.storagePath.localeCompare(b.storagePath);
      }

      return a.name.localeCompare(b.name);
    }

    return aType - bType;
  }

  render() {
    this._projectListItems = [];

    if (this.props.filteredItems === undefined) {
      this._projectListItems.push({
        header: (
          <div className="pil-fixedLine" key="pil-info">
            Actions
          </div>
        ),
        headerMedia: " ",
        content: " ",
      });

      let projectContent = <></>;
      let whatIsThis = this.props.readOnly || this.props.project?.role === ProjectRole.explorer ? "Content" : "Project";

      if (this.props.allInfoSet.info.defaultIcon && this.props.allInfoSet.info.defaultIcon) {
        projectContent = (
          <div className="pil-fixedLineRow" key="pil-fixpropjRowA">
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
          <div className="pil-fixedLine" key="pil-fixpropj">
            {whatIsThis}
          </div>
        );
      }

      this._projectListItems.push({
        header: projectContent,
        headerMedia: " ",
        content: " ",
      });

      this._projectListItems.push({
        header: (
          <div className="pil-fixedLine" key="pil-info">
            Inspector
          </div>
        ),
        headerMedia: " ",
        content: " ",
      });
    }

    const splitButtonMenuItems: any[] = [
      {
        id: "gpscript",
        key: "gpscript",
        onClick: this._handleNewScriptClick,
        content:
          this.props.project?.preferredScriptLanguage === ProjectScriptLanguage.typeScript
            ? "New TypeScript"
            : "New JavaScript",
      },
      {
        id: "function",
        key: "function",
        onClick: this._handleNewFunctionClick,
        content: "New function",
      },
      {
        id: "entityType",
        key: "entityType",
        onClick: this._handleNewEntityTypeClick,
        content: "New mob",
      },
      {
        id: "blockType",
        key: "blockType",
        onClick: this._handleNewBlockTypeClick,
        content: "New block type",
      },
    ];

    if (Utilities.isDebug) {
      splitButtonMenuItems.push(
        {
          id: "structure",
          key: "pil-structure",
          onClick: this._handleNewStructureClick,
          content: "New structure",
        },
        {
          id: "autoscript",
          key: "pil-autoscript",
          onClick: this._handleNewAutoScriptClick,
          content: "New auto-script",
        },
        {
          id: "worldtest",
          key: "pil-worldtest",
          onClick: this._handleNewWorldTestClick,
          content: "New world test",
        },
        {
          key: "pil-divider1",
          kind: "divider",
        },
        {
          id: "entityType",
          key: "pil-addReference",
          onClick: this._addGitHubReferenceClick,
          content: "Add GitHub reference",
        }
      );

      if (this.props.project && this.props.project.role === ProjectRole.documentation) {
        splitButtonMenuItems.push({
          id: "doctype",
          key: "pil-doctype",
          onClick: this._handleNewDocTypeClick,
          content: "New documented type",
        });
      }

      if (this.props.project && this.props.project.role === ProjectRole.meta) {
        splitButtonMenuItems.push({
          id: "form",
          key: "pil-form",
          onClick: this._handleNewFormClick,
          content: "New form",
        });
      }
    }

    let selectedItemIndex = 0;
    let itemsAdded = 0;

    if (this.props.filteredItems === undefined) {
      if (this.props.editorMode === ProjectEditorMode.properties) {
        selectedItemIndex = 1;
      } else if (this.props.editorMode === ProjectEditorMode.inspector) {
        selectedItemIndex = 2;
      }

      itemsAdded = 3;
    }

    let lastItemType = -1;
    let lastStorageRoot: string | undefined;

    this._itemIndices = [];
    this._itemTypes = [];

    if (this.props.project) {
      const projectItems = this.props.project.items.sort(ProjectItemList.sortItems);

      for (let i = 0; i < projectItems.length && itemsAdded < this.state.maxItemsToShow; i++) {
        const projectItem = projectItems[i];

        if (projectItem !== undefined && projectItem.storagePath !== null && projectItem.storagePath !== undefined) {
          if (this.shouldShowProjectItem(projectItem)) {
            if (projectItem.itemType !== lastItemType) {
              this._addTypeSpacer(projectItem.itemType, this.props.filteredItems === undefined);
              this._itemTypes[itemsAdded] = ListItemType.typeSpacer;
              this._itemIndices[itemsAdded] = projectItem.itemType;
              itemsAdded++;
              lastItemType = projectItem.itemType;
            }

            if (
              this.props.filteredItems !== undefined ||
              !this.state.collapsedItemTypes.includes(projectItem.itemType)
            ) {
              const folderGroupingPath = projectItem.getFolderGroupingPath();

              if (folderGroupingPath !== lastStorageRoot) {
                if (
                  folderGroupingPath !== undefined &&
                  folderGroupingPath.length > 1 &&
                  projectItem.itemType !== ProjectItemType.soundsCatalogResourceJson
                ) {
                  this._addStoragePathSpacer(
                    folderGroupingPath,
                    projectItem.itemType,
                    this.props.filteredItems === undefined
                  );
                  this._itemTypes[itemsAdded] = ListItemType.pathSpacer;
                  itemsAdded++;
                }
                lastStorageRoot = folderGroupingPath;
              }

              if (
                this.props.filteredItems !== undefined ||
                !folderGroupingPath ||
                !this.state.collapsedStoragePaths.includes(folderGroupingPath)
              ) {
                if (projectItem === this.props.activeProjectItem) {
                  selectedItemIndex = this._projectListItems.length;
                }

                this._addProjectItem(projectItem, false);
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

        this._addReference(ref);

        this._itemTypes[itemsAdded] = ListItemType.references;
        this._itemIndices[itemsAdded] = i;
        itemsAdded++;

        for (let j = 0; j < projectItems.length; j++) {
          const projectItem = projectItems[j];

          if (
            projectItem.gitHubReference !== undefined &&
            ProjectItem.gitHubReferencesEqual(ref, projectItem.gitHubReference)
          ) {
            this._addProjectItem(projectItem, true);
            this._itemIndices[itemsAdded] = j;
            this._itemTypes[itemsAdded] = ListItemType.item;
            itemsAdded++;
          }
        }
      }
    }

    const toolbarItems = [];

    if (this.props.project?.editPreference === ProjectEditPreference.summarized) {
      toolbarItems.push({
        icon: (
          <FunctionsLabel theme={this.props.theme} isSelected={this.props.project?.showFunctions} isCompact={true} />
        ),
        key: "pil-hideShowFunctions",
        kind: "toggle",
        active: this.props.project?.showFunctions,
        onClick: this._showFunctionsClick,
        title: "Toggle whether functions and scripts are shown",
      });

      toolbarItems.push({
        icon: <TypesLabel theme={this.props.theme} isSelected={this.props.project?.showTypes} isCompact={true} />,
        key: "pil-hideShowTypes",
        kind: "toggle",
        active: this.props.project?.showTypes,
        onClick: this._showTypesClick,
        title: "Toggle whether world details and entity, block, and item types are shown",
      });

      toolbarItems.push({
        icon: <AssetsLabel theme={this.props.theme} isSelected={this.props.project?.showAssets} isCompact={true} />,
        key: "pil-hideShowAssets",
        kind: "toggle",
        active: this.props.project?.showAssets,
        onClick: this._showAssetsClick,
        title: "Toggle whether assets (models, images, UI and sound) are shown",
      });

      toolbarItems.push({
        icon: (
          <EyeSlashLabel theme={this.props.theme} isSelected={this.props.project?.showHiddenItems} isCompact={true} />
        ),
        key: "pil-hideShowSlash",
        kind: "toggle",
        active: this.props.project?.showHiddenItems,
        onClick: this._showAllClick,
        title: "Toggle whether hidden items are shown",
      });
    }

    let dialogArea = <></>;

    if (
      this.state !== null &&
      this.state.dialogMode === ProjectItemListDialogType.renameDialog &&
      this.state.activeItem !== undefined
    ) {
      dialogArea = (
        <Dialog
          open={true}
          cancelButton="Cancel"
          confirmButton="Rename"
          key="pil-renameOuter"
          onCancel={this._handleCancel}
          onConfirm={this._handleConfirmRename}
          content={
            <div className="pil-dialog" key="pil-renameDia">
              <Input clearable placeholder="new name" onChange={this._handleNewProjectItemName} />
              <span className="pil-extension">.{StorageUtilities.getTypeFromName(this.state.activeItem.name)}</span>
            </div>
          }
          header={"Rename " + this.state.activeItem.name}
        />
      );
    } else if (
      this.state !== null &&
      this.state.dialogMode === ProjectItemListDialogType.deleteConfirmDialog &&
      this.state.activeItem !== undefined
    ) {
      dialogArea = (
        <Dialog
          open={true}
          cancelButton="Cancel"
          confirmButton="OK"
          key="pil-deleteOuter"
          onCancel={this._handleCancel}
          onConfirm={this._handleConfirmDelete}
          content={
            <div className="pil-dialog" key="pil-deleteConfirmDia">
              Are you sure you wish to delete '{this.state.activeItem.storagePath}'?
            </div>
          }
          header={"Delete " + this.state.activeItem.name}
        />
      );
    } else if (
      this.state !== null &&
      this.props.project !== null &&
      this.state.dialogMode === ProjectItemListDialogType.newEntityTypeDialog
    ) {
      dialogArea = (
        <Dialog
          open={true}
          cancelButton="Cancel"
          confirmButton="Add"
          key="pil-newEntityOuter"
          onCancel={this._handleCancel}
          onConfirm={this._handleNewEntityType}
          content={
            <NewEntityType
              theme={this.props.theme}
              key="pil-newEntityDia"
              onNewEntityTypeUpdated={this._newEntityTypeUpdated}
              project={this.props.project}
              carto={this.props.carto}
            />
          }
          header={"New mob"}
        />
      );
    } else if (
      this.state !== null &&
      this.props.project !== null &&
      this.state.dialogMode === ProjectItemListDialogType.newEntityTypeDialog
    ) {
      dialogArea = (
        <Dialog
          open={true}
          cancelButton="Cancel"
          confirmButton="Add"
          key="pil-newEntityOuter"
          onCancel={this._handleCancel}
          onConfirm={this._handleNewEntityType}
          content={
            <NewEntityType
              theme={this.props.theme}
              key="pil-newEntityDia"
              onNewEntityTypeUpdated={this._newEntityTypeUpdated}
              project={this.props.project}
              carto={this.props.carto}
            />
          }
          header={"New mob"}
        />
      );
    } else if (
      this.state !== null &&
      this.props.project !== null &&
      this.state.newItemType !== undefined &&
      this.state.dialogMode === ProjectItemListDialogType.newItemDialog
    ) {
      dialogArea = (
        <Dialog
          open={true}
          cancelButton="Cancel"
          confirmButton="Add"
          key="pil-newItemOuter"
          onCancel={this._handleCancel}
          onConfirm={this._handleNewItem}
          content={
            <NewItem
              theme={this.props.theme}
              key="pil-newItemDia"
              itemType={this.state.newItemType}
              onNewItemSeedUpdated={this._updateNewItemSeed}
              project={this.props.project}
              carto={this.props.carto}
            />
          }
          header={"New " + ProjectItemUtilities.getDescriptionForType(this.state.newItemType)}
        />
      );
    } else if (
      this.state !== null &&
      this.props.project !== null &&
      this.state.dialogMode === ProjectItemListDialogType.newBlockTypeDialog
    ) {
      dialogArea = (
        <Dialog
          open={true}
          cancelButton="Cancel"
          confirmButton="Add"
          key="pil-newBlockTypeOuter"
          onCancel={this._handleCancel}
          onConfirm={this._handleNewBlockType}
          content={
            <NewBlockType
              key="pil-newBlockTypeDia"
              onNewBlockTypeUpdated={this._newBlockTypeUpdated}
              project={this.props.project}
              carto={this.props.carto}
            />
          }
          header={"New Block Type"}
        />
      );
    } else if (
      this.state !== null &&
      this.props.project !== null &&
      this.state.dialogMode === ProjectItemListDialogType.addGitHubReferenceDialog
    ) {
      dialogArea = (
        <Dialog
          open={true}
          cancelButton="Cancel"
          confirmButton="Add"
          key="pil-addghouter"
          onCancel={this._handleCancel}
          onConfirm={this._handleAddReference}
          content={
            <AddGitHubReference
              theme={this.props.theme}
              key="pil-addghdia"
              onGitHubProjectUpdated={this._githubProjectUpdated}
              project={this.props.project}
              carto={this.props.carto}
            />
          }
          header={"Add GitHub Reference"}
        />
      );
    }

    let splitButton = <></>;

    if (this.props.project && !this.props.readOnly && this.props.project.role !== ProjectRole.explorer) {
      splitButton = (
        <div className="pil-newarea" key="pil-newSplit">
          <SplitButton
            menu={splitButtonMenuItems}
            button={{
              content: "New script",
              "aria-roledescription": "splitbutton",
              "aria-describedby": "instruction-message-primary-button",
            }}
            primary
            toggleButton={{
              "aria-label": "more options",
            }}
            onMainButtonClick={this._handleNewScriptClick}
          />
        </div>
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
          <div className={this.props.readOnly ? "pil-newarea" : "pil-commands"}>
            <Toolbar
              aria-label="Editor toolbar overflow menu"
              items={toolbarItems}
              overflow
              overflowItem={{
                title: "More",
              }}
            />
          </div>
          <div
            style={{
              maxHeight: listHeight,
              minHeight: listHeight,
            }}
            className="pil-list"
            onScroll={this._handleListScroll}
          >
            <List
              selectable
              defaultSelectedIndex={selectedItemIndex}
              selectedIndex={selectedItemIndex}
              items={this._projectListItems}
              onSelectedIndexChange={this._handleItemSelected}
            />
          </div>
          {dialogArea}
        </div>
      </div>
    );
  }
}
