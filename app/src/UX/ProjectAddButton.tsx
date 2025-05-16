import { Component } from "react";
import IAppProps from "./IAppProps";
import Project from "./../app/Project";
import { ProjectItemType } from "./../app/IProjectItemData";
import ProjectItem from "./../app/ProjectItem";
import { ProjectEditorMode } from "./ProjectEditorUtilities";
import { Dialog, ThemeInput, MenuButton, Button, MenuItemProps } from "@fluentui/react-northstar";

import { GitHubPropertyType } from "./ProjectPropertyEditor";
import NewEntityType from "./NewEntityType";
import ProjectUtilities, { NewEntityTypeAddMode, NewItemTypeAddMode } from "../app/ProjectUtilities";
import IGitHubInfo from "../app/IGitHubInfo";
import "./ProjectAddButton.css";
import Utilities from "../core/Utilities";
import NewBlockType from "./NewBlockType";
import { ProjectRole, ProjectScriptLanguage } from "../app/IProjectData";
import IGalleryItem, { GalleryItemType } from "../app/IGalleryItem";
import ProjectInfoSet from "../info/ProjectInfoSet";
import IProjectItemSeed from "../app/IProjectItemSeed";
import NewItemType from "./NewItemType";
import SetNamespacedId from "./SetNamespacedId";
import ProjectItemUtilities from "../app/ProjectItemUtilities";
import ProjectItemCreateManager from "../app/ProjectItemCreateManager";
import SetName from "./SetName";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus } from "@fortawesome/free-solid-svg-icons";

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

interface IProjectAddButtonProps extends IAppProps {
  theme: ThemeInput<any>;
  onActiveProjectItemChangeRequested?: (projectItem: ProjectItem, forceRawView: boolean) => void;
  onActiveReferenceChangeRequested?: (reference: IGitHubInfo) => void;
  onModeChangeRequested?: (mode: ProjectEditorMode) => void;
  heightOffset: number;
  project: Project | null;
  visualSeed?: number;
}

interface IProjectAddButtonState {
  activeItem: ProjectItem | undefined;
  dialogMode: ProjectAddButtonDialogType;
  maxItemsToShow: number;
  isLoaded: boolean;
  newItemType?: ProjectItemType;
  activeProjectInfoSet?: ProjectInfoSet | undefined;
  collapsedItemTypes: number[];
  contextFocusedItem?: number;
  collapsedStoragePaths: string[];
}

export enum ProjectAddButtonDialogType {
  noDialog = 0,
  newEntityTypeDialog = 3,
  newBlockTypeDialog = 5,
  newItemTypeDialog = 6,
  newNamespacedDefinitionDialog = 7,
  newNamedDefinitionDialog = 8,
}

export default class ProjectAddButton extends Component<IProjectAddButtonProps, IProjectAddButtonState> {
  private _tentativeNewItem: IProjectItemSeed | undefined;

  tentativeGitHubMode: string = "existing";
  tentativeGitHubRepoName?: string;
  tentativeGitHubOwner?: string;
  tentativeGitHubBranch?: string;
  tentativeGitHubFolder?: string;
  tentativeGitHubTitle?: string;

  tentativeNewEntityTypeAddMode?: NewEntityTypeAddMode;
  tentativeNewName?: string;
  tentativeNewEntityTypeItem?: IGalleryItem;

  tentativeNewBlockTypeItem?: IGalleryItem;
  tentativeNewItemTypeItem?: IGalleryItem;

  constructor(props: IProjectAddButtonProps) {
    super(props);

    this._newItemTypeUpdated = this._newItemTypeUpdated.bind(this);

    this._handleNewDefinition = this._handleNewDefinition.bind(this);
    this._handleNewTestClick = this._handleNewTestClick.bind(this);
    this._handleNewScriptClick = this._handleNewScriptClick.bind(this);
    this._handleNewActionSetClick = this._handleNewActionSetClick.bind(this);
    this._handleNewWorldTestClick = this._handleNewWorldTestClick.bind(this);
    this._handleNewStructureClick = this._handleNewStructureClick.bind(this);
    this._handleNewFormClick = this._handleNewFormClick.bind(this);
    this._handleCancel = this._handleCancel.bind(this);
    this._handleGalleryItemClick = this._handleGalleryItemClick.bind(this);
    this._handleNewLootTableClick = this._handleNewLootTableClick.bind(this);
    this._handleNewGeodeFeatureClick = this._handleNewGeodeFeatureClick.bind(this);
    this._handleNewFunctionClick = this._handleNewFunctionClick.bind(this);
    this._handleNewEntityTypeClick = this._handleNewEntityTypeClick.bind(this);
    this._handleNewBlockTypeClick = this._handleNewBlockTypeClick.bind(this);
    this._handleNewItemTypeClick = this._handleNewItemTypeClick.bind(this);
    this._githubProjectUpdated = this._githubProjectUpdated.bind(this);
    this._handleAddReference = this._handleAddReference.bind(this);
    this._setNewName = this._setNewName.bind(this);
    this._newEntityTypeUpdated = this._newEntityTypeUpdated.bind(this);
    this._newBlockTypeUpdated = this._newBlockTypeUpdated.bind(this);
    this._handleNewEntityType = this._handleNewEntityType.bind(this);
    this._handleNewItemType = this._handleNewItemType.bind(this);
    this._handleNewBlockType = this._handleNewBlockType.bind(this);
    this._handleNewAudioClick = this._handleNewAudioClick.bind(this);

    this.state = {
      activeItem: undefined,
      dialogMode: ProjectAddButtonDialogType.noDialog,
      maxItemsToShow: 300,
      isLoaded: false,
      collapsedItemTypes: this.props.carto.collapsedTypes,
      collapsedStoragePaths: this.props.project ? this.props.project.collapsedStoragePaths : [],
    };
  }

  _newEntityTypeUpdated(newAddMode: NewEntityTypeAddMode, entityTypeItem: IGalleryItem, name: string) {
    this.tentativeNewEntityTypeItem = entityTypeItem;
    this.tentativeNewEntityTypeAddMode = newAddMode;
    this.tentativeNewName = name;
  }

  _newBlockTypeUpdated(blockTypeItem: IGalleryItem | undefined, name: string | undefined) {
    this.tentativeNewBlockTypeItem = blockTypeItem;
    this.tentativeNewName = name;
  }

  _newItemTypeUpdated(propertyType: NewItemTypeAddMode, itemTypeItem: IGalleryItem, name: string) {
    this.tentativeNewItemTypeItem = itemTypeItem;
    this.tentativeNewName = name;
  }

  _setNewName(name: string) {
    this.tentativeNewName = name;

    if (this._tentativeNewItem) {
      this._tentativeNewItem.name = name;
    }
  }

  componentDidMount(): void {
    this._load();
  }

  async _load() {
    await this.props.carto.loadGallery();

    this.setState({
      activeItem: this.state.activeItem,
      dialogMode: this.state.dialogMode,
      maxItemsToShow: this.state.maxItemsToShow,
      isLoaded: true,
      newItemType: this.state.newItemType,
      activeProjectInfoSet: this.state.activeProjectInfoSet,
      contextFocusedItem: this.state.contextFocusedItem,
    });
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

  _handleNewTestClick() {
    if (this.props.project !== null) {
      ProjectItemCreateManager.createNewGameTestScript(this.props.project);
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

  _handleNewActionSetClick() {
    this.launchNewItemType(ProjectItemType.actionSet);
  }

  _handleNewGeodeFeatureClick() {
    this.launchNewNamespacedDefinition(ProjectItemType.featureBehavior, "geode_feature.json");
  }

  _handleNewLootTableClick() {
    this.launchNewNamedDefinition(ProjectItemType.lootTableBehavior);
  }

  _handleNewAudioClick() {
    this.launchNewItemType(ProjectItemType.audio);
  }

  async _handleGalleryItemClick(event: React.SyntheticEvent<HTMLElement>, menuItem: MenuItemProps | undefined) {
    if (menuItem && menuItem.content) {
      let galleryItem = await this.props.carto.getGalleryProjectByCaption(menuItem.content as string);

      if (galleryItem && galleryItem.targetType) {
        this.launchNewNamespacedDefinition(galleryItem.targetType, galleryItem.id);
      }
    }
  }

  _handleNewWorldTestClick() {
    this.launchNewNamespacedDefinition(ProjectItemType.worldTest);
  }

  _handleNewFormClick() {
    this.launchNewNamespacedDefinition(ProjectItemType.dataForm);
  }

  _handleNewFunctionClick() {
    if (this.props.project) {
      ProjectItemCreateManager.createNewFunction(this.props.project);
    }
  }

  async _handleNewStructureClick() {}

  launchNewItemType(itemType: ProjectItemType, suggestedName?: string) {
    this._tentativeNewItem = {
      name: suggestedName,
      itemType: itemType,
    };

    this.setState({
      activeItem: this.state.activeItem,
      dialogMode: ProjectAddButtonDialogType.newItemTypeDialog,
      newItemType: itemType,
      isLoaded: this.state.isLoaded,
      maxItemsToShow: this.state.maxItemsToShow,
      contextFocusedItem: this.state.contextFocusedItem,
      collapsedItemTypes: this.state.collapsedItemTypes,
      collapsedStoragePaths: this.state.collapsedStoragePaths,
    });
  }

  async _handleNewEntityTypeClick() {
    if (this.state === null) {
      return;
    }

    this.setState({
      activeItem: this.state.activeItem,
      dialogMode: ProjectAddButtonDialogType.newEntityTypeDialog,
      contextFocusedItem: this.state.contextFocusedItem,
      maxItemsToShow: this.state.maxItemsToShow,
      isLoaded: this.state.isLoaded,
      collapsedItemTypes: this.state.collapsedItemTypes,
      collapsedStoragePaths: this.state.collapsedStoragePaths,
    });
  }

  async _handleNewBlockTypeClick() {
    if (this.state === null) {
      return;
    }

    this.setState({
      activeItem: this.state.activeItem,
      dialogMode: ProjectAddButtonDialogType.newBlockTypeDialog,
      maxItemsToShow: this.state.maxItemsToShow,
      isLoaded: this.state.isLoaded,
      contextFocusedItem: this.state.contextFocusedItem,
      collapsedItemTypes: this.state.collapsedItemTypes,
      collapsedStoragePaths: this.state.collapsedStoragePaths,
    });
  }

  async _handleNewItemTypeClick() {
    if (this.state === null) {
      return;
    }

    this.setState({
      activeItem: this.state.activeItem,
      dialogMode: ProjectAddButtonDialogType.newItemTypeDialog,
      maxItemsToShow: this.state.maxItemsToShow,
      isLoaded: this.state.isLoaded,
      contextFocusedItem: this.state.contextFocusedItem,
      collapsedItemTypes: this.state.collapsedItemTypes,
      collapsedStoragePaths: this.state.collapsedStoragePaths,
    });
  }

  async _handleNewBlockType() {
    if (this.state === null) {
      return;
    }

    if (this.tentativeNewName && this.tentativeNewBlockTypeItem && this.props.project !== null) {
      await ProjectUtilities.addBlockTypeFromGallery(
        this.props.project,
        this.tentativeNewBlockTypeItem,
        this.tentativeNewName
      );
    }

    if (this.props.project) {
      await this.props.project.save();
    }

    this.setState({
      activeItem: undefined,
      dialogMode: ProjectAddButtonDialogType.noDialog,
      isLoaded: this.state.isLoaded,
      maxItemsToShow: this.state.maxItemsToShow,
      contextFocusedItem: this.state.contextFocusedItem,
      collapsedItemTypes: this.state.collapsedItemTypes,
      collapsedStoragePaths: this.state.collapsedStoragePaths,
    });
  }

  async _handleNewEntityType() {
    if (this.state === null) {
      return;
    }

    if (this.tentativeNewEntityTypeItem !== undefined && this.props.project !== null) {
      await ProjectUtilities.addEntityTypeFromGallery(
        this.props.project,
        this.tentativeNewEntityTypeItem,
        this.tentativeNewName,
        this.tentativeNewEntityTypeAddMode
      );
    }

    if (this.props.project) {
      await this.props.project.save();
    }

    this.setState({
      activeItem: undefined,
      dialogMode: ProjectAddButtonDialogType.noDialog,
      maxItemsToShow: this.state.maxItemsToShow,
      isLoaded: this.state.isLoaded,
      contextFocusedItem: this.state.contextFocusedItem,
      collapsedItemTypes: this.state.collapsedItemTypes,
      collapsedStoragePaths: this.state.collapsedStoragePaths,
    });
  }

  async _handleNewItemType() {
    if (this.state === null) {
      return;
    }

    if (this.tentativeNewItemTypeItem !== undefined && this.props.project !== null) {
      await ProjectUtilities.addItemTypeFromGallery(
        this.props.project,
        this.tentativeNewItemTypeItem,
        this.tentativeNewName
      );
    }

    if (this.props.project) {
      await this.props.project.save();
    }

    this.setState({
      activeItem: undefined,
      dialogMode: ProjectAddButtonDialogType.noDialog,
      maxItemsToShow: this.state.maxItemsToShow,
      contextFocusedItem: this.state.contextFocusedItem,
      collapsedItemTypes: this.state.collapsedItemTypes,
      collapsedStoragePaths: this.state.collapsedStoragePaths,
    });
  }

  launchNewNamespacedDefinition(itemType: ProjectItemType, contentTemplateName?: string) {
    this._tentativeNewItem = {
      name: ProjectItemUtilities.getNewItemTechnicalName(itemType),
      itemType: itemType,
      contentTemplateName: contentTemplateName,
    };

    this.setState({
      activeItem: this.state.activeItem,
      dialogMode: ProjectAddButtonDialogType.newNamespacedDefinitionDialog,
      newItemType: itemType,
      maxItemsToShow: this.state.maxItemsToShow,
      contextFocusedItem: this.state.contextFocusedItem,
      collapsedItemTypes: this.state.collapsedItemTypes,
      collapsedStoragePaths: this.state.collapsedStoragePaths,
    });
  }

  launchNewNamedDefinition(itemType: ProjectItemType, suggestedName?: string) {
    this._tentativeNewItem = {
      name: suggestedName ? suggestedName : ProjectItemUtilities.getNewItemTechnicalName(itemType),
      itemType: itemType,
    };

    this.setState({
      activeItem: this.state.activeItem,
      dialogMode: ProjectAddButtonDialogType.newNamedDefinitionDialog,
      newItemType: itemType,
      maxItemsToShow: this.state.maxItemsToShow,
      contextFocusedItem: this.state.contextFocusedItem,
      collapsedItemTypes: this.state.collapsedItemTypes,
      collapsedStoragePaths: this.state.collapsedStoragePaths,
    });
  }

  async _handleNewDefinition() {
    if (!this.state || !this.props.project) {
      return;
    }

    let projectItem = undefined;

    if (this._tentativeNewItem !== undefined && this.props.project !== null) {
      projectItem = await ProjectItemCreateManager.createNewItem(this.props.project, this._tentativeNewItem);
    }

    await this.props.project.save();

    this.setState({
      activeItem: projectItem,
      dialogMode: ProjectAddButtonDialogType.noDialog,
      maxItemsToShow: this.state.maxItemsToShow,
      contextFocusedItem: this.state.contextFocusedItem,
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

    this.setState({
      activeItem: undefined,
      dialogMode: ProjectAddButtonDialogType.noDialog,
      maxItemsToShow: this.state.maxItemsToShow,
      contextFocusedItem: this.state.contextFocusedItem,
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
      dialogMode: ProjectAddButtonDialogType.noDialog,
      maxItemsToShow: this.state.maxItemsToShow,
      contextFocusedItem: this.state.contextFocusedItem,
      collapsedItemTypes: this.state.collapsedItemTypes,
      collapsedStoragePaths: this.state.collapsedStoragePaths,
    });
  }

  getMenuItemsFromGalleryItems(itemType: GalleryItemType) {
    const galleryItems = this.props.carto.getGalleryProjectByType(itemType);

    const menuItems: (MenuItemProps & { key: string })[] = [];

    if (galleryItems) {
      for (const item of galleryItems) {
        menuItems.push({
          key: item.id,
          content: item.title,
          onClick: this._handleGalleryItemClick,
        });
      }
    }

    return menuItems;
  }

  render() {
    if (this.state.isLoaded === false) {
      return <div className="pab-loading">Loading...</div>;
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
        content: "New Function",
      },
      {
        id: "entityType",
        key: "entityType",
        onClick: this._handleNewEntityTypeClick,
        content: "New Mob (Entity Type)",
      },
      {
        id: "blockType",
        key: "blockType",
        onClick: this._handleNewBlockTypeClick,
        content: "New Block Type",
      },
      {
        id: "itemType",
        key: "itemType",
        onClick: this._handleNewItemTypeClick,
        content: "New Item Type",
      },
      {
        id: "av",
        key: "av",
        content: "Textures/Audio",

        menu: {
          items: [
            {
              id: "audio",
              key: "newAudio",
              onClick: this._handleNewAudioClick,
              content: "New Audio file",
            },
          ],
        },
      },
      {
        id: "spawnLoot",
        key: "spawnLoot",
        content: "Spawn/Loot/Recipes",

        menu: {
          items: this.getMenuItemsFromGalleryItems(GalleryItemType.spawnLootRecipes),
        },
      },
      {
        id: "worldGen",
        key: "worldGen",
        content: "World Gen",
        menu: {
          items: this.getMenuItemsFromGalleryItems(GalleryItemType.worldGen),
        },
      },
      {
        key: "divider-1",
        kind: "divider",
      },
      {
        id: "advSFADivoder",
        key: "advSFADivoder",
        content: "Single Files (Advanced)",
      },
      {
        id: "advEntityItemBlock",
        key: "advEntityItemBlock",
        content: "Entity/Item/Block Type",
        menu: {
          items: this.getMenuItemsFromGalleryItems(GalleryItemType.entityItemBlockSingleFiles),
        },
      },
      {
        id: "advEntityItemBlock",
        key: "advVisuals",
        content: "Visuals",
        menu: {
          items: this.getMenuItemsFromGalleryItems(GalleryItemType.visualSingleFiles),
        },
      },
      {
        id: "advWorldGen",
        key: "advWorldGen",
        content: "World Gen",
        menu: {
          items: this.getMenuItemsFromGalleryItems(GalleryItemType.worldGenSingleFiles),
        },
      },
      {
        id: "advCatalog",
        key: "advCatalog",
        content: "Catalog",
        menu: {
          items: this.getMenuItemsFromGalleryItems(GalleryItemType.catalogSingleFiles),
        },
      },
    ];

    if (Utilities.isDebug) {
      splitButtonMenuItems.push(
        {
          id: "structure",
          key: "pab-structure",
          onClick: this._handleNewStructureClick,
          content: "New structure",
        },
        {
          id: "actionset",
          key: "pab-actionset",
          onClick: this._handleNewActionSetClick,
          content: "New action set",
        },
        {
          id: "worldtest",
          key: "pab-worldtest",
          onClick: this._handleNewWorldTestClick,
          content: "New world test",
        }
      );

      const accessoryItems = [];

      if (this.props.project && this.props.project.role === ProjectRole.meta) {
        accessoryItems.push({
          id: "form",
          key: "pab-form",
          onClick: this._handleNewFormClick,
          content: "New form",
        });
      }

      if (accessoryItems.length > 0) {
        splitButtonMenuItems.push({
          id: "definitions",
          key: "definitions",
          content: "New accessory items...",

          menu: {
            items: accessoryItems,
          },
        });
      }
    }

    let dialogArea = <></>;
    if (
      this.state !== null &&
      this.props.project !== null &&
      this.state.dialogMode === ProjectAddButtonDialogType.newEntityTypeDialog
    ) {
      dialogArea = (
        <Dialog
          open={true}
          cancelButton="Cancel"
          confirmButton="Add"
          key="pab-newEntityOuter"
          onCancel={this._handleCancel}
          onConfirm={this._handleNewEntityType}
          content={
            <NewEntityType
              theme={this.props.theme}
              key="pab-newEntityDia"
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
      this.state.dialogMode === ProjectAddButtonDialogType.newItemTypeDialog
    ) {
      dialogArea = (
        <Dialog
          open={true}
          cancelButton="Cancel"
          confirmButton="Add"
          key="pab-newItemOuter"
          onCancel={this._handleCancel}
          onConfirm={this._handleNewItemType}
          content={
            <NewItemType
              theme={this.props.theme}
              key="pab-newItemDia"
              onNewItemTypeUpdated={this._newItemTypeUpdated}
              project={this.props.project}
              carto={this.props.carto}
            />
          }
          header={"New Item Type"}
        />
      );
    } else if (
      this.state !== null &&
      this.props.project !== null &&
      this.state.dialogMode === ProjectAddButtonDialogType.newBlockTypeDialog
    ) {
      dialogArea = (
        <Dialog
          open={true}
          cancelButton="Cancel"
          confirmButton="Add"
          key="pab-newBlockTypeOuter"
          onCancel={this._handleCancel}
          onConfirm={this._handleNewBlockType}
          content={
            <NewBlockType
              key="pab-newBlockTypeDia"
              theme={this.props.theme}
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
      this.state.dialogMode === ProjectAddButtonDialogType.newNamespacedDefinitionDialog
    ) {
      dialogArea = (
        <Dialog
          open={true}
          cancelButton="Cancel"
          confirmButton="Add"
          key="btse-addComponentOuter"
          onCancel={this._handleCancel}
          onConfirm={this._handleNewDefinition}
          content={
            <SetNamespacedId
              onNameChanged={this._setNewName}
              defaultNamespace={this.props.project.effectiveDefaultNamespace}
              defaultName={this._tentativeNewItem?.name ? this._tentativeNewItem.name : "item"}
              theme={this.props.theme}
            />
          }
          header={
            "Add new " +
            ProjectItemUtilities.getNewItemName(this._tentativeNewItem?.itemType ?? ProjectItemType.unknown)
          }
        />
      );
    } else if (
      this.state !== null &&
      this.props.project !== null &&
      this.state.dialogMode === ProjectAddButtonDialogType.newNamedDefinitionDialog
    ) {
      dialogArea = (
        <Dialog
          open={true}
          cancelButton="Cancel"
          confirmButton="Add"
          key="btse-addComponentOuter"
          onCancel={this._handleCancel}
          onConfirm={this._handleNewDefinition}
          content={
            <SetName
              onNameChanged={this._setNewName}
              defaultName={this._tentativeNewItem?.name ? this._tentativeNewItem.name : "item"}
              theme={this.props.theme}
            />
          }
          header={
            "Add new " +
            ProjectItemUtilities.getNewItemName(this._tentativeNewItem?.itemType ?? ProjectItemType.unknown)
          }
        />
      );
    }

    let splitButton = <></>;

    if (this.props.project) {
      splitButton = (
        <div className="pab-newarea" key="pab-newSplit">
          <MenuButton
            menu={splitButtonMenuItems}
            trigger={
              <Button
                icon={<FontAwesomeIcon icon={faPlus} className="fa-lg" />}
                content="Add"
                aria-label="Click button"
              />
            }
          />
        </div>
      );
    }

    return (
      <div
        className="pab-outer"
        key="pab-outer"
        style={{
          borderColor: this.props.theme.siteVariables?.colorScheme.brand.background3,
        }}
      >
        {splitButton}
        {dialogArea}
      </div>
    );
  }
}
