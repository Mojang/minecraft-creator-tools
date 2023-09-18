import { Component, SyntheticEvent } from "react";
import IAppProps from "./IAppProps";
import Project from "./../app/Project";
import { ProjectItemErrorStatus, ProjectItemType } from "./../app/IProjectItemData";
import ProjectItem from "./../app/ProjectItem";
import { ProjectEditorMode } from "./ProjectEditor";
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
import { ProjectEditPreference } from "../app/IProjectData";
import IGalleryProject from "../app/IGalleryProject";

export enum EntityTypeCommand {
  select,
}

export enum BlockTypeCommand {
  select,
}

interface IProjectItemListProps extends IAppProps {
  theme: ThemeInput<any>;
  onActiveProjectItemChangeRequested?: (projectItem: ProjectItem, forceRawView: boolean) => void;
  onActiveReferenceChangeRequested?: (reference: IGitHubInfo) => void;
  onModeChangeRequested?: (mode: ProjectEditorMode) => void;
  project: Project | null;
  activeProjectItem: ProjectItem | null;
  heightOffset: number;
  readOnly: boolean;
}

interface IProjectItemListState {
  activeItem: ProjectItem | undefined;
  dialogMode: number;
  maxItemsToShow: number;
}

const PIL_NO_DIALOG = 1;
const PIL_RENAME_DIALOG = 1;
const PIL_DELETE_CONFIRM_DIALOG = 2;
const PIL_NEW_ENTITY_TYPE_DIALOG = 3;
const PIL_ADD_GITHUB_REFERENCE_DIALOG = 4;
const PIL_NEW_BLOCK_TYPE_DIALOG = 5;

export default class ProjectItemList extends Component<IProjectItemListProps, IProjectItemListState> {
  private _activeProject: Project | null = null;
  private _projectListItems: ListItemProps[] = [];
  private _items: any[] = [];
  private _newItemName?: string;
  private _updatePending: boolean = false;
  private _isMountedInternal: boolean = false;
  private _lastSelectedAsMenuItem: number = 0;

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
    this._contextMenuClick = this._contextMenuClick.bind(this);
    this._handleNewProjectItemName = this._handleNewProjectItemName.bind(this);
    this._handleConfirmRename = this._handleConfirmRename.bind(this);
    this._handleConfirmDelete = this._handleConfirmDelete.bind(this);
    this._handleCancel = this._handleCancel.bind(this);
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

    this.state = {
      activeItem: undefined,
      dialogMode: PIL_NO_DIALOG,
      maxItemsToShow: 3000,
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
  }

  private _showFunctionsClick() {
    if (this.props.project === null) {
      return;
    }

    this.props.project.showFunctions = !this.props.project.showFunctions;
  }

  private _showAssetsClick() {
    if (this.props.project === null) {
      return;
    }

    this.props.project.showAssets = !this.props.project.showAssets;
  }

  private _showTypesClick() {
    if (this.props.project === null) {
      return;
    }

    this.props.project.showTypes = !this.props.project.showTypes;
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

    if (event.selectedIndex === 0) {
      if (this.props && this.props.onModeChangeRequested !== undefined) {
        this.props.onModeChangeRequested(ProjectEditorMode.properties);
      }
    } else if (event.selectedIndex === 1) {
      if (this.props && this.props.onModeChangeRequested !== undefined) {
        this.props.onModeChangeRequested(ProjectEditorMode.info);
      }
    } else {
      const newItem = this._items[event.selectedIndex - 3];

      if (newItem instanceof ProjectItem) {
        if (
          this.props &&
          this.props.onActiveProjectItemChangeRequested !== undefined &&
          this._lastSelectedAsMenuItem <= 0
        ) {
          this.props.onActiveProjectItemChangeRequested(newItem as ProjectItem, false);
        } else {
          this._lastSelectedAsMenuItem--;
        }
      } else if (newItem.owner !== undefined) {
        if (this.props && this.props.onActiveReferenceChangeRequested !== undefined) {
          this.props.onActiveReferenceChangeRequested(newItem as IGitHubInfo);
        }
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
      ProjectItemManager.createNewScript(this.props.project);
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

  _handleNewFunctionClick() {
    if (this.props.project !== null) {
      ProjectItemManager.createNewFunction(this.props.project);
    }
  }

  async _handleNewStructureClick() {}

  async _handleNewEntityTypeClick() {
    if (this.state === null || !this._isMountedInternal) {
      return;
    }

    this.setState({
      activeItem: this.state.activeItem,
      dialogMode: PIL_NEW_ENTITY_TYPE_DIALOG,
    });
  }

  async _handleNewBlockTypeClick() {
    if (this.state === null || !this._isMountedInternal) {
      return;
    }

    this.setState({
      activeItem: this.state.activeItem,
      dialogMode: PIL_NEW_BLOCK_TYPE_DIALOG,
    });
  }

  async _addGitHubReferenceClick() {
    if (this.state === null || !this._isMountedInternal) {
      return;
    }

    this.setState({
      activeItem: this.state.activeItem,
      dialogMode: PIL_ADD_GITHUB_REFERENCE_DIALOG,
    });
  }

  _handleConfirmRename() {
    if (this.state === null || this.state.activeItem === undefined || this._newItemName === undefined) {
      return;
    }

    this.state.activeItem.rename(this._newItemName);

    this.setState({
      activeItem: undefined,
      dialogMode: PIL_NO_DIALOG,
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
      dialogMode: PIL_NO_DIALOG,
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
      dialogMode: PIL_NO_DIALOG,
    });
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
      dialogMode: PIL_NO_DIALOG,
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
      dialogMode: PIL_NO_DIALOG,
    });
  }

  _handleCancel() {
    if (this.state === null) {
      return;
    }

    this.setState({
      activeItem: undefined,
      dialogMode: PIL_NO_DIALOG,
    });
  }

  _contextMenuClick(e: SyntheticEvent<HTMLElement, Event>, data?: any | undefined) {
    if (data !== undefined && data.tag !== undefined && this.props.project !== null) {
      const projectItem = this.props.project.getItemByStoragePath(data.tag);

      if (projectItem !== null) {
        if (data.content === "Rename") {
          this.setState({
            activeItem: projectItem,
            dialogMode: PIL_RENAME_DIALOG,
          });
        } else if (data.content === "Delete") {
          this.setState({
            activeItem: projectItem,
            dialogMode: PIL_DELETE_CONFIRM_DIALOG,
          });
        } else if (data.content === "View as JSON" && this.props.onActiveProjectItemChangeRequested) {
          this._lastSelectedAsMenuItem = 1;
          this.props.onActiveProjectItemChangeRequested(projectItem as ProjectItem, true);
        }
      }
    }
  }

  _getTagNameFromItem(item: ProjectItem) {
    switch (item.itemType) {
      case ProjectItemType.structure:
        return "structure";

      case ProjectItemType.behaviorPackManifestJson:
        return "behaviors";

      case ProjectItemType.resourcePackManifestJson:
        return "resources";

      case ProjectItemType.image:
        return "image";

      case ProjectItemType.testJs:
        return "gametest";

      case ProjectItemType.entityTypeBaseJs:
      case ProjectItemType.entityTypeBaseTs:
        return "ent. script";

      case ProjectItemType.entityTypeBehaviorJson:
        return "entity type";

      case ProjectItemType.worldFolder:
        return "world";

      case ProjectItemType.MCProject:
        return "editor project";

      case ProjectItemType.MCWorld:
        return "mcworld";

      case ProjectItemType.MCTemplate:
        return "template";

      case ProjectItemType.MCAddon:
        return "add-on";

      case ProjectItemType.MCPack:
        return "pack";

      case ProjectItemType.zip:
        return "zip";

      case ProjectItemType.js:
        return "script";

      case ProjectItemType.ts:
        return "typescript";

      case ProjectItemType.MCFunction:
        return "function";

      case ProjectItemType.autoScriptJson:
        return "actions";

      case ProjectItemType.worldTest:
        return "world test";

      case ProjectItemType.catalogIndexJs:
        return "script list";

      case ProjectItemType.behaviorPackListJson:
        return "world bps";

      case ProjectItemType.resourcePackListJson:
        return "world rps";

      case ProjectItemType.animationBehaviorJson:
        return "beh anim";

      case ProjectItemType.animationControllerBehaviorJson:
        return "beh ac";

      case ProjectItemType.blockTypeBehaviorJson:
        return "block type";

      case ProjectItemType.blockMaterialsBehaviorJson:
        return "block mat";

      case ProjectItemType.itemTypeBehaviorJson:
        return "item type";

      case ProjectItemType.lootTableBehaviorJson:
        return "loot table";

      case ProjectItemType.biomeResourceJson:
        return "biome";

      case ProjectItemType.blocksCatalogResourceJson:
        return "block cat";

      case ProjectItemType.soundsCatalogResourceJson:
        return "sound mat";

      case ProjectItemType.animationResourceJson:
        return "animation";

      case ProjectItemType.animationControllerResourceJson:
        return "anim contrlr";

      case ProjectItemType.entityTypeResourceJson:
        return "ent type res";

      case ProjectItemType.fogResourceJson:
        return "fog";

      case ProjectItemType.modelJson:
        return "model";

      case ProjectItemType.particleJson:
        return "particle";

      case ProjectItemType.renderControllerJson:
        return "render contrlr";

      case ProjectItemType.itemTextureJson:
        return "texture";

      case ProjectItemType.uiJson:
        return "ui";

      case ProjectItemType.languagesCatalogResourceJson:
        return "lang cat";

      case ProjectItemType.lang:
        return "lang";

      case ProjectItemType.biomeBehaviorJson:
        return "biome";

      case ProjectItemType.dialogueBehaviorJson:
        return "dialogue";

      case ProjectItemType.featureRuleBehaviorJson:
        return "feat rule";

      case ProjectItemType.featureBehaviorJson:
        return "feature";

      case ProjectItemType.functionEventJson:
        return "func evt";

      case ProjectItemType.recipeBehaviorJson:
        return "recipe";

      case ProjectItemType.spawnRuleBehaviorJson:
        return "spawn rule";

      case ProjectItemType.tradingBehaviorJson:
        return "trading";

      case ProjectItemType.volumeBehaviorJson:
        return "volume";

      case ProjectItemType.attachableResourceJson:
        return "attachable";

      case ProjectItemType.itemTypeResourceJson:
        return "item type res";

      case ProjectItemType.materialsResourceJson:
        return "material res";

      case ProjectItemType.musicDefinitionJson:
        return "music";

      case ProjectItemType.soundDefinitionJson:
        return "sound";

      case ProjectItemType.packageJson:
        return "package";

      case ProjectItemType.packageLockJson:
        return "package.lock";

      case ProjectItemType.docInfoJson:
        return "info";

      case ProjectItemType.vsCodeExtensionsJson:
        return "vsc ext";

      case ProjectItemType.vsCodeLaunchJson:
        return "vsc launch";

      case ProjectItemType.vsCodeSettingsJson:
        return "vsc stngs";

      case ProjectItemType.vsCodeTasksJson:
        return "vsc tasks";

      case ProjectItemType.typesDefinitionJson:
        return "types def";

      case ProjectItemType.commandSetDefinitionJson:
        return "cmd def";

      case ProjectItemType.tsconfigJson:
        return "ts config";

      case ProjectItemType.jsconfigJson:
        return "js config";

      case ProjectItemType.docfxJson:
        return "docfx";

      case ProjectItemType.jsdocJson:
        return "jsdoc";

      case ProjectItemType.worldTemplateManifestJson:
        return "wtmanifest";

      case ProjectItemType.json:
        return "json";
    }

    return "item";
  }

  _addProjectItem(projectItem: ProjectItem, isGitHubRef: boolean) {
    let name = StorageUtilities.getBaseFromName(projectItem.name);
    const tag = this._getTagNameFromItem(projectItem);
    let sourceImage = "";

    if (
      projectItem.itemType !== ProjectItemType.js &&
      projectItem.itemType !== ProjectItemType.ts &&
      projectItem.itemType !== ProjectItemType.image &&
      projectItem.itemType !== ProjectItemType.zip &&
      projectItem.itemType !== ProjectItemType.typesDefinitionJson &&
      projectItem.itemType !== ProjectItemType.commandSetDefinitionJson &&
      projectItem.itemType !== ProjectItemType.MCAddon &&
      projectItem.itemType !== ProjectItemType.MCFunction &&
      projectItem.itemType !== ProjectItemType.MCPack &&
      projectItem.itemType !== ProjectItemType.MCProject &&
      projectItem.itemType !== ProjectItemType.lootTableBehaviorJson &&
      projectItem.itemType !== ProjectItemType.MCWorld
    ) {
      name = Utilities.humanifyMinecraftName(name);
    }

    if (projectItem.imageUrl) {
      // image = <img alt="Preview of the world" src={projectItem.imageUrl} className="pil-previewImage" />;
      sourceImage = "url('" + projectItem.imageUrl + "')";
    } else {
      sourceImage = "color:red";
    }

    if (
      projectItem.storagePath &&
      this.props.project &&
      this.props.project.changedFilesSinceLastSaved[ProjectUtilities.canonicalizeStoragePath(projectItem.storagePath)]
    ) {
      name += "*";
    }

    if (this.props.readOnly) {
      this._projectListItems.push({
        header: (
          <div className="pil-item" key={"ro" + projectItem.storagePath}>
            <span className="pil-typetag">{tag}</span>
            <span className="pil-name" style={{ backgroundImage: sourceImage }}>
              {name}
            </span>
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
          key: "viewAsJson",
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

      //title += " " + projectItem.itemType;

      this._projectListItems.push({
        header: (
          <div className="pil-item" key={"eo" + projectItem.storagePath} style={{ minWidth: 282 }}>
            <MenuButton
              contextMenu={true}
              trigger={
                <span className="pil-itemLabel">
                  <span className="pil-typetag">{tag}</span>
                  <span className={nameCss} title={title} style={{ backgroundImage: sourceImage }}>
                    {name}
                  </span>
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

    this._items.push(projectItem);
  }

  _addReference(reference: IGitHubInfo) {
    const name = reference.repoName;
    const sig = ProjectItem.getGitHubSignature(reference);

    if (this.props.readOnly) {
      this._projectListItems.push({
        header: (
          <div className="pil-item" key={"ghitem" + sig}>
            <span className="pil-typetag">GitHub</span>
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
        header: (
          <div className="pil-item" key={"ghitema" + sig} style={{ minWidth: 310 }}>
            <MenuButton
              contextMenu={true}
              trigger={
                <span className="pil-itemLabel">
                  <span className="pil-typetag">GitHub</span>
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

    this._items.push(reference);
  }

  async _loadItems() {
    if (this.props.project === null) {
      return;
    }

    const projectItems = this.props.project.items;
    let needsUpdate = false;
    let itemsShown = 0;

    for (let i = 0; i < projectItems.length && itemsShown < this.state.maxItemsToShow; i++) {
      const projectItem = projectItems[i];

      if (this.shouldShowProjectItem(projectItem) && !projectItem.isLoaded) {
        await projectItem.load();
        itemsShown++;
        needsUpdate = true;
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

    if (
      !this.props.project.showFunctions &&
      (projectItem.itemType === ProjectItemType.MCFunction ||
        projectItem.itemType === ProjectItemType.testJs ||
        projectItem.itemType === ProjectItemType.autoScriptJson ||
        projectItem.itemType === ProjectItemType.animationBehaviorJson ||
        projectItem.itemType === ProjectItemType.animationControllerBehaviorJson ||
        projectItem.itemType === ProjectItemType.js ||
        projectItem.itemType === ProjectItemType.ts)
    ) {
      return false;
    }

    if (
      !this.props.project.showAssets &&
      (projectItem.itemType === ProjectItemType.image ||
        projectItem.itemType === ProjectItemType.soundDefinitionJson ||
        projectItem.itemType === ProjectItemType.soundsCatalogResourceJson ||
        projectItem.itemType === ProjectItemType.resourcePackManifestJson ||
        projectItem.itemType === ProjectItemType.resourcePackListJson ||
        projectItem.itemType === ProjectItemType.modelJson ||
        projectItem.itemType === ProjectItemType.uiJson ||
        projectItem.itemType === ProjectItemType.itemTextureJson ||
        projectItem.itemType === ProjectItemType.attachableResourceJson)
    ) {
      return false;
    }

    if (
      !this.props.project.showTypes &&
      (projectItem.itemType === ProjectItemType.entityTypeBehaviorJson ||
        projectItem.itemType === ProjectItemType.entityTypeResourceJson ||
        projectItem.itemType === ProjectItemType.entityTypeBaseJs ||
        projectItem.itemType === ProjectItemType.entityTypeBaseTs ||
        projectItem.itemType === ProjectItemType.blockTypeBehaviorJson ||
        projectItem.itemType === ProjectItemType.blockTypeResourceJson ||
        projectItem.itemType === ProjectItemType.itemTypeBehaviorJson ||
        projectItem.itemType === ProjectItemType.fogResourceJson ||
        projectItem.itemType === ProjectItemType.tradingBehaviorJson ||
        projectItem.itemType === ProjectItemType.particleJson ||
        projectItem.itemType === ProjectItemType.structure ||
        projectItem.itemType === ProjectItemType.biomeBehaviorJson ||
        projectItem.itemType === ProjectItemType.biomeResourceJson ||
        projectItem.itemType === ProjectItemType.lootTableBehaviorJson ||
        projectItem.itemType === ProjectItemType.spawnRuleBehaviorJson ||
        projectItem.itemType === ProjectItemType.dialogueBehaviorJson ||
        projectItem.itemType === ProjectItemType.MCWorld ||
        projectItem.itemType === ProjectItemType.worldTemplateManifestJson ||
        projectItem.itemType === ProjectItemType.itemTypeResourceJson)
    ) {
      return false;
    }

    if (this.props.project.showHiddenItems) {
      return true;
    }

    if (
      projectItem.itemType === ProjectItemType.packageLockJson ||
      projectItem.itemType === ProjectItemType.jsconfigJson ||
      projectItem.itemType === ProjectItemType.tsconfigJson ||
      projectItem.itemType === ProjectItemType.docfxJson ||
      projectItem.itemType === ProjectItemType.jsdocJson ||
      projectItem.itemType === ProjectItemType.zip ||
      projectItem.itemType === ProjectItemType.lang || // should be handled by Text editor
      projectItem.itemType === ProjectItemType.languagesCatalogResourceJson || // should be handled by Text editor
      projectItem.itemType === ProjectItemType.vsCodeExtensionsJson ||
      projectItem.itemType === ProjectItemType.vsCodeLaunchJson ||
      projectItem.itemType === ProjectItemType.vsCodeSettingsJson ||
      projectItem.itemType === ProjectItemType.vsCodeTasksJson ||
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
        projectItem.itemType === ProjectItemType.behaviorPackManifestJson) &&
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

  render() {
    this._projectListItems = [];
    this._items = [];

    this._projectListItems.push({
      header: (
        <div className="pil-fixedLine" key="fixpropj">
          {this.props.readOnly ? "Add-On" : "Project"}
        </div>
      ),
      headerMedia: " ",
      content: " ",
    });

    this._projectListItems.push({
      header: (
        <div className="pil-fixedLine" key="info">
          Inspector
        </div>
      ),
      headerMedia: " ",
      content: " ",
    });

    this._projectListItems.push({
      header: (
        <div className="pil-fixedLine" key="text">
          Text
        </div>
      ),
      headerMedia: " ",
      content: " ",
    });

    const splitButtonMenuItems: any[] = [
      {
        id: "gpscript",
        key: "gpscript",
        onClick: this._handleNewScriptClick,
        content: "New script",
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
          key: "structure",
          onClick: this._handleNewStructureClick,
          content: "New structure",
        },
        {
          id: "autoscript",
          key: "autoscript",
          onClick: this._handleNewAutoScriptClick,
          content: "New auto-script",
        },
        {
          id: "worldtest",
          key: "worldtest",
          onClick: this._handleNewWorldTestClick,
          content: "New world test",
        },
        {
          id: "doctype",
          key: "doctype",
          onClick: this._handleNewDocTypeClick,
          content: "New documented type",
        },
        {
          key: "divider1",
          kind: "divider",
        },
        {
          id: "entityType",
          key: "addReference",
          onClick: this._addGitHubReferenceClick,
          content: "Add GitHub reference",
        }
      );
    }

    let selectedItemIndex = 0;
    let itemsShown = 0;

    if (this.props.project) {
      const projectItems = this.props.project.items;

      for (let i = 0; i < projectItems.length && itemsShown < this.state.maxItemsToShow; i++) {
        const projectItem = projectItems[i];

        if (projectItem !== undefined && projectItem.storagePath !== null && projectItem.storagePath !== undefined) {
          if (this.shouldShowProjectItem(projectItem)) {
            if (projectItem === this.props.activeProjectItem) {
              selectedItemIndex = this._projectListItems.length;
            }
            itemsShown++;
            this._addProjectItem(projectItem, false);
          }
        }
      }

      const references = this.props.project.gitHubReferences;

      for (let i = 0; i < references.length; i++) {
        const ref = references[i];

        this._addReference(ref);

        for (let j = 0; j < projectItems.length; j++) {
          const projectItem = projectItems[j];

          if (
            projectItem.gitHubReference !== undefined &&
            ProjectItem.gitHubReferencesEqual(ref, projectItem.gitHubReference)
          ) {
            itemsShown++;
            this._addProjectItem(projectItem, true);
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
        key: "hideShow",
        kind: "toggle",
        active: this.props.project?.showFunctions,
        onClick: this._showFunctionsClick,
        title: "Toggle whether functions and scripts are shown",
      });
      toolbarItems.push({
        icon: <AssetsLabel theme={this.props.theme} isSelected={this.props.project?.showAssets} isCompact={true} />,
        key: "hideShow",
        kind: "toggle",
        active: this.props.project?.showAssets,
        onClick: this._showAssetsClick,
        title: "Toggle whether assets (models, images, UI and sound) are shown",
      });

      toolbarItems.push({
        icon: <TypesLabel theme={this.props.theme} isSelected={this.props.project?.showTypes} isCompact={true} />,
        key: "hideShow",
        kind: "toggle",
        active: this.props.project?.showTypes,
        onClick: this._showTypesClick,
        title: "Toggle whether world details and entity, block, and item types are shown",
      });

      toolbarItems.push({
        icon: (
          <EyeSlashLabel theme={this.props.theme} isSelected={this.props.project?.showHiddenItems} isCompact={true} />
        ),
        key: "hideShow",
        kind: "toggle",
        active: this.props.project?.showHiddenItems,
        onClick: this._showAllClick,
        title: "Toggle whether hidden items are shown",
      });
    }

    let dialogArea = <></>;

    if (this.state !== null && this.state.dialogMode === PIL_RENAME_DIALOG && this.state.activeItem !== undefined) {
      dialogArea = (
        <Dialog
          open={true}
          cancelButton="Cancel"
          confirmButton="Rename"
          onCancel={this._handleCancel}
          onConfirm={this._handleConfirmRename}
          content={
            <div className="pil-dialog">
              <Input clearable placeholder="new name" onChange={this._handleNewProjectItemName} />
              <span className="pil-extension">.{StorageUtilities.getTypeFromName(this.state.activeItem.name)}</span>
            </div>
          }
          header={"Rename " + this.state.activeItem.name}
        />
      );
    } else if (
      this.state !== null &&
      this.state.dialogMode === PIL_DELETE_CONFIRM_DIALOG &&
      this.state.activeItem !== undefined
    ) {
      dialogArea = (
        <Dialog
          open={true}
          cancelButton="Cancel"
          confirmButton="OK"
          onCancel={this._handleCancel}
          onConfirm={this._handleConfirmDelete}
          content={
            <div className="pil-dialog">Are you sure you wish to delete '{this.state.activeItem.storagePath}'?</div>
          }
          header={"Delete " + this.state.activeItem.name}
        />
      );
    } else if (
      this.state !== null &&
      this.props.project !== null &&
      this.state.dialogMode === PIL_NEW_ENTITY_TYPE_DIALOG
    ) {
      dialogArea = (
        <Dialog
          open={true}
          cancelButton="Cancel"
          confirmButton="Add"
          onCancel={this._handleCancel}
          onConfirm={this._handleNewEntityType}
          content={
            <NewEntityType
              theme={this.props.theme}
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
      this.state.dialogMode === PIL_NEW_BLOCK_TYPE_DIALOG
    ) {
      dialogArea = (
        <Dialog
          open={true}
          cancelButton="Cancel"
          confirmButton="Add"
          onCancel={this._handleCancel}
          onConfirm={this._handleNewBlockType}
          content={
            <NewBlockType
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
      this.state.dialogMode === PIL_ADD_GITHUB_REFERENCE_DIALOG
    ) {
      dialogArea = (
        <Dialog
          open={true}
          cancelButton="Cancel"
          confirmButton="Add"
          onCancel={this._handleCancel}
          onConfirm={this._handleAddReference}
          content={
            <AddGitHubReference
              theme={this.props.theme}
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

    if (!this.props.readOnly) {
      splitButton = (
        <div className="pil-newarea">
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

    const listHeight = "calc(100vh - " + (this.props.heightOffset + 36) + "px)";

    return (
      <div
        className="pil-outer"
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
          >
            <List
              selectable
              defaultSelectedIndex={selectedItemIndex}
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
