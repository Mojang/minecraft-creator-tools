import { Component } from "react";
import IAppProps from "./IAppProps";
import Project from "./../app/Project";
import { ProjectItemType } from "./../app/IProjectItemData";
import ProjectItem from "./../app/ProjectItem";
import { ProjectEditorMode, ProjectItemEditorView } from "./ProjectEditorUtilities";
import { Dialog, ThemeInput, MenuButton, Button, MenuItemProps } from "@fluentui/react-northstar";

import { GitHubPropertyType } from "./ProjectPropertyEditor";
import NewEntityType from "./NewEntityType";
import { NewEntityTypeAddMode, NewItemTypeAddMode } from "../app/ProjectUtilities";
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
import SetNameAndFolder from "./SetNameAndFolder";
import ProjectCreateManager from "../app/ProjectCreateManager";

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
  onActiveProjectItemChangeRequested?: (projectItem: ProjectItem, itemView: ProjectItemEditorView) => void;
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
  newItemSeed?: IProjectItemSeed;
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
  newNamedGenericDialog = 8,
  newNamedGenericPlusFolderDialog = 9,
}

export default class ProjectAddButton extends Component<IProjectAddButtonProps, IProjectAddButtonState> {
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

    this._handleNewGeneric = this._handleNewGeneric.bind(this);
    this._handleNewTestClick = this._handleNewTestClick.bind(this);
    this._handleNewTextureClick = this._handleNewTextureClick.bind(this);
    this._handleNewScriptClick = this._handleNewScriptClick.bind(this);
    this._handleNewDesignTextureClick = this._handleNewDesignTextureClick.bind(this);
    this._handleNewActionSetClick = this._handleNewActionSetClick.bind(this);
    this._handleNewWorldTestClick = this._handleNewWorldTestClick.bind(this);
    this._handleNewStructureClick = this._handleNewStructureClick.bind(this);
    this._handleNewFormClick = this._handleNewFormClick.bind(this);
    this._setNewItemSeed = this._setNewItemSeed.bind(this);
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
      collapsedItemTypes: this.props.creatorTools.collapsedTypes,
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

    const tentItem = this.state.newItemSeed;

    if (tentItem) {
      tentItem.name = name;

      this.setState({
        newItemSeed: tentItem,
      });
    }
  }

  _setNewItemSeed(seed: IProjectItemSeed) {
    this.setState({
      newItemSeed: seed,
    });
  }

  componentDidMount(): void {
    this._load();
  }

  async _load() {
    await this.props.creatorTools.loadGallery();

    this.setState({
      activeItem: this.state.activeItem,
      dialogMode: this.state.dialogMode,
      maxItemsToShow: this.state.maxItemsToShow,
      isLoaded: true,
      newItemSeed: this.state.newItemSeed,
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
      this.launchNewGeneric(
        this.props.project.preferredScriptLanguage === ProjectScriptLanguage.javaScript
          ? ProjectItemType.js
          : ProjectItemType.ts
      );
    }
  }

  _handleNewActionSetClick() {
    this.launchNewGeneric(ProjectItemType.actionSet);
  }

  _handleNewGeodeFeatureClick() {
    this.launchNewNamespacedDefinition(ProjectItemType.featureBehavior, "geode_feature.json");
  }

  _handleNewLootTableClick() {
    this.launchNewNamedGeneric(ProjectItemType.lootTableBehavior);
  }

  _handleNewAudioClick() {
    this.launchNewResourcePackItemPlusFolder(ProjectItemType.audio, "audio", "sounds");
  }

  _handleNewDesignTextureClick() {
    this.launchNewDesignPackItemPlusFolder(ProjectItemType.designTexture, "design_texture", "design_textures");
  }

  _handleNewTextureClick() {
    this.launchNewResourcePackItemPlusFolder(ProjectItemType.texture, "texture", "textures");
  }

  async _handleGalleryItemClick(event: React.SyntheticEvent<HTMLElement>, menuItem: MenuItemProps | undefined) {
    if (menuItem && menuItem.content) {
      let galleryItem = await this.props.creatorTools.getGalleryProjectByCaption(menuItem.content as string);

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

  launchNewGeneric(itemType: ProjectItemType, suggestedName?: string) {
    let newSeed = {
      name: suggestedName,
      itemType: itemType,
    };

    this.setState({
      activeItem: this.state.activeItem,
      dialogMode: ProjectAddButtonDialogType.newNamedGenericPlusFolderDialog,
      newItemSeed: newSeed,
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
      await ProjectCreateManager.addBlockTypeFromGallery(
        this.props.project,
        this.tentativeNewBlockTypeItem,
        this.tentativeNewName
      );
    }

    if (this.props.project) {
      await this.props.project.save();
    }

    this.props.project?.processRelations(true);

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
      await ProjectCreateManager.addEntityTypeFromGallery(
        this.props.project,
        this.tentativeNewEntityTypeItem,
        this.tentativeNewName,
        this.tentativeNewEntityTypeAddMode
      );
    }

    if (this.props.project) {
      await this.props.project.save();
    }

    this.props.project?.processRelations(true);

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
      await ProjectCreateManager.addItemTypeFromGallery(
        this.props.project,
        this.tentativeNewItemTypeItem,
        this.tentativeNewName
      );
    }

    if (this.props.project) {
      await this.props.project.save();
    }

    this.props.project?.processRelations(true);

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
    const newItemSeed = {
      name: ProjectItemUtilities.getNewItemTechnicalName(itemType),
      itemType: itemType,
      contentTemplateName: contentTemplateName,
    };

    this.setState({
      activeItem: this.state.activeItem,
      dialogMode: ProjectAddButtonDialogType.newNamespacedDefinitionDialog,
      newItemSeed: newItemSeed,
      maxItemsToShow: this.state.maxItemsToShow,
      contextFocusedItem: this.state.contextFocusedItem,
      collapsedItemTypes: this.state.collapsedItemTypes,
      collapsedStoragePaths: this.state.collapsedStoragePaths,
    });
  }

  launchNewNamedGeneric(itemType: ProjectItemType, suggestedName?: string) {
    const newItemSeed = {
      name: suggestedName ? suggestedName : ProjectItemUtilities.getNewItemTechnicalName(itemType),
      itemType: itemType,
    };

    this.setState({
      activeItem: this.state.activeItem,
      dialogMode: ProjectAddButtonDialogType.newNamedGenericDialog,
      newItemSeed: newItemSeed,
      maxItemsToShow: this.state.maxItemsToShow,
      contextFocusedItem: this.state.contextFocusedItem,
      collapsedItemTypes: this.state.collapsedItemTypes,
      collapsedStoragePaths: this.state.collapsedStoragePaths,
    });
  }

  async launchNewResourcePackItemPlusFolder(
    itemType: ProjectItemType,
    suggestedName?: string,
    resourcePackSubFolder?: string
  ) {
    let defaultRpFolder = await this.props.project?.ensureDefaultResourcePackFolder();

    if (resourcePackSubFolder) {
      resourcePackSubFolder = Utilities.ensureEndsWithSlash(Utilities.ensureStartsWithSlash(resourcePackSubFolder));

      defaultRpFolder = await defaultRpFolder?.ensureFolderFromRelativePath(resourcePackSubFolder);
    }

    const newItemSeed: IProjectItemSeed = {
      name: suggestedName ? suggestedName : ProjectItemUtilities.getNewItemTechnicalName(itemType),
      itemType: itemType,
      folder: defaultRpFolder,
    };

    this.setState({
      activeItem: this.state.activeItem,
      dialogMode: ProjectAddButtonDialogType.newNamedGenericPlusFolderDialog,
      newItemSeed: newItemSeed,
      maxItemsToShow: this.state.maxItemsToShow,
      contextFocusedItem: this.state.contextFocusedItem,
      collapsedItemTypes: this.state.collapsedItemTypes,
      collapsedStoragePaths: this.state.collapsedStoragePaths,
    });
  }

  async launchNewDesignPackItemPlusFolder(
    itemType: ProjectItemType,
    suggestedName?: string,
    designPackSubFolder?: string,
    creationData?: object
  ) {
    let defaultDpFolder = await this.props.project?.ensureDefaultDesignPackFolder();

    if (designPackSubFolder) {
      designPackSubFolder = Utilities.ensureEndsWithSlash(Utilities.ensureStartsWithSlash(designPackSubFolder));

      defaultDpFolder = await defaultDpFolder?.ensureFolderFromRelativePath(designPackSubFolder);
    }

    const newItemSeed: IProjectItemSeed = {
      name: suggestedName ? suggestedName : ProjectItemUtilities.getNewItemTechnicalName(itemType),
      itemType: itemType,
      creationData: creationData,
      folder: defaultDpFolder,
    };

    this.setState({
      activeItem: this.state.activeItem,
      dialogMode: ProjectAddButtonDialogType.newNamedGenericPlusFolderDialog,
      newItemSeed: newItemSeed,
      maxItemsToShow: this.state.maxItemsToShow,
      contextFocusedItem: this.state.contextFocusedItem,
      collapsedItemTypes: this.state.collapsedItemTypes,
      collapsedStoragePaths: this.state.collapsedStoragePaths,
    });
  }

  async _handleNewGeneric() {
    if (!this.state || !this.props.project) {
      return;
    }

    let projectItem = undefined;
    const tentativeNewItem = this.state.newItemSeed;

    if (tentativeNewItem !== undefined && this.props.project !== null) {
      projectItem = await ProjectItemCreateManager.createNewItem(this.props.project, tentativeNewItem);

      if (tentativeNewItem.itemType === ProjectItemType.biomeBehavior) {
        tentativeNewItem.itemType = ProjectItemType.biomeResource;
        tentativeNewItem.contentTemplateName = "biome_resource";

        await ProjectItemCreateManager.createNewItem(this.props.project, tentativeNewItem);
      }
    }

    await this.props.project.save();

    this.props.project.processRelations(true);

    this.setState({
      activeItem: projectItem,
      dialogMode: ProjectAddButtonDialogType.noDialog,
      maxItemsToShow: this.state.maxItemsToShow,
      contextFocusedItem: this.state.contextFocusedItem,
      collapsedItemTypes: this.state.collapsedItemTypes,
      collapsedStoragePaths: this.state.collapsedStoragePaths,
    });

    if (projectItem && this.props.onActiveProjectItemChangeRequested) {
      this.props.onActiveProjectItemChangeRequested(projectItem, ProjectItemEditorView.singleFileEditor);
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
    const galleryItems = this.props.creatorTools.getGalleryProjectByType(itemType);

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
        id: "designItems",
        key: "designItems",
        content: "Designers",
        menu: {
          items: [
            {
              id: "blockBillboard3x3",
              key: "blockBillboard3x3",
              onClick: () => {
                this.launchNewDesignPackItemPlusFolder(
                  ProjectItemType.designTexture,
                  "block_billboard",
                  "design_textures",
                  { width: 48, height: 48, outputs: [{ name: "_name_", type: 11 }] }
                );
              },
              content: "Block Billboard 3x3",
            },
            {
              id: "blockBillboard4x6",
              key: "blockBillboard4x6",
              onClick: () => {
                this.launchNewDesignPackItemPlusFolder(
                  ProjectItemType.designTexture,
                  "block_billboard",
                  "design_textures",
                  { width: 96, height: 64, outputs: [{ name: "_name_", type: 12 }] }
                );
              },
              content: "Block Billboard 4x6",
            },
            {
              id: "blockBillboard5x8",
              key: "blockBillboard5x8",
              onClick: () => {
                this.launchNewDesignPackItemPlusFolder(
                  ProjectItemType.designTexture,
                  "block_billboard",
                  "design_textures",
                  { width: 128, height: 80, outputs: [{ name: "_name_", type: 13 }] }
                );
              },
              content: "Block Billboard 5x8",
            },
            {
              id: "painting",
              key: "painting",
              onClick: () => {
                this.launchNewDesignPackItemPlusFolder(ProjectItemType.designTexture, "painting", "design_textures", {
                  width: 16,
                  height: 16,
                  outputs: [{ name: "_name_", type: 3, paintingSize: 1 }],
                });
              },
              content: "Single-Block Painting",
            },
          ],
        },
      },
      {
        id: "av",
        key: "av",
        content: "Textures/Audio",
        menu: {
          items: [
            {
              id: "texture",
              key: "newTexture",
              onClick: this._handleNewTextureClick,
              content: "Texture",
            },

            {
              id: "audio",
              key: "newAudio",
              onClick: this._handleNewAudioClick,
              content: "Audio file",
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
          onClick: this._handleGalleryItemClick,
          content: "Action Set",
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

    const newItemState = this.state.newItemSeed;
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
              creatorTools={this.props.creatorTools}
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
              creatorTools={this.props.creatorTools}
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
              creatorTools={this.props.creatorTools}
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
          onConfirm={this._handleNewGeneric}
          content={
            <SetNamespacedId
              onNameChanged={this._setNewName}
              defaultNamespace={this.props.project.effectiveDefaultNamespace}
              defaultName={newItemState?.name ? newItemState.name : "item"}
              theme={this.props.theme}
            />
          }
          header={"Add new " + ProjectItemUtilities.getNewItemName(newItemState?.itemType ?? ProjectItemType.unknown)}
        />
      );
    } else if (
      this.state !== null &&
      this.props.project !== null &&
      this.state.dialogMode === ProjectAddButtonDialogType.newNamedGenericDialog
    ) {
      dialogArea = (
        <Dialog
          open={true}
          cancelButton="Cancel"
          confirmButton="Add"
          key="btse-addComponentOuter"
          onCancel={this._handleCancel}
          onConfirm={this._handleNewGeneric}
          content={
            <SetName
              onNameChanged={this._setNewName}
              defaultName={newItemState?.name ? newItemState.name : "item"}
              theme={this.props.theme}
            />
          }
          header={"Add new " + ProjectItemUtilities.getNewItemName(newItemState?.itemType ?? ProjectItemType.unknown)}
        />
      );
    } else if (
      this.state !== null &&
      this.props.project !== null &&
      this.state.dialogMode === ProjectAddButtonDialogType.newNamedGenericPlusFolderDialog
    ) {
      dialogArea = (
        <Dialog
          open={true}
          cancelButton="Cancel"
          confirmButton="Add"
          key="pab-addComponentOuter"
          onCancel={this._handleCancel}
          onConfirm={this._handleNewGeneric}
          content={
            <SetNameAndFolder
              heightOffset={this.props.heightOffset}
              theme={this.props.theme}
              project={this.props.project}
              creatorTools={this.props.creatorTools}
              rootFolder={this.state.newItemSeed?.folder}
              defaultName={this.state.newItemSeed?.name}
              creationData={this.state.newItemSeed?.creationData}
              itemType={
                this.state.newItemSeed?.itemType ? this.state.newItemSeed?.itemType : ProjectItemType.unknownJson
              }
              onNewItemSeedUpdated={this._setNewItemSeed}
            />
          }
          header={"Add new " + ProjectItemUtilities.getNewItemName(newItemState?.itemType ?? ProjectItemType.unknown)}
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
