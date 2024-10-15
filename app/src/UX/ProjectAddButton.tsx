import { Component } from "react";
import IAppProps from "./IAppProps";
import Project from "./../app/Project";
import { ProjectItemType } from "./../app/IProjectItemData";
import ProjectItem from "./../app/ProjectItem";
import { ProjectEditorMode } from "./ProjectEditorUtilities";
import { SplitButton, Dialog, ThemeInput } from "@fluentui/react-northstar";

import { GitHubPropertyType } from "./ProjectPropertyEditor";
import NewEntityType from "./NewEntityType";
import ProjectUtilities, { NewEntityTypeAddMode } from "../app/ProjectUtilities";
import IGitHubInfo from "../app/IGitHubInfo";
import ProjectItemManager from "../app/ProjectItemManager";
import "./ProjectAddButton.css";
import NewBlockType from "./NewBlockType";
import { ProjectScriptLanguage } from "../app/IProjectData";
import IGalleryItem from "../app/IGalleryItem";
import ProjectItemUtilities from "../app/ProjectItemUtilities";
import ProjectInfoSet from "../info/ProjectInfoSet";
import IProjectItemSeed from "../app/IProjectItemSeed";
import NewItem from "./NewItem";

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
  newItemDialog = 6,
}

export default class ProjectAddButton extends Component<IProjectAddButtonProps, IProjectAddButtonState> {
  private _newItemName?: string;

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

  constructor(props: IProjectAddButtonProps) {
    super(props);

    this._updateNewItemSeed = this._updateNewItemSeed.bind(this);

    this._handleNewItem = this._handleNewItem.bind(this);
    this._handleNewScriptClick = this._handleNewScriptClick.bind(this);
    this._handleCancel = this._handleCancel.bind(this);
    this._handleNewSpawnRuleClick = this._handleNewSpawnRuleClick.bind(this);
    this._handleNewLootTableClick = this._handleNewLootTableClick.bind(this);
    this._handleNewFeatureClick = this._handleNewFeatureClick.bind(this);
    this._handleNewFunctionClick = this._handleNewFunctionClick.bind(this);
    this._handleNewEntityTypeClick = this._handleNewEntityTypeClick.bind(this);
    this._handleNewBlockTypeClick = this._handleNewBlockTypeClick.bind(this);
    this._githubProjectUpdated = this._githubProjectUpdated.bind(this);
    this._handleAddReference = this._handleAddReference.bind(this);
    this._newEntityTypeUpdated = this._newEntityTypeUpdated.bind(this);
    this._newBlockTypeUpdated = this._newBlockTypeUpdated.bind(this);
    this._handleNewEntityType = this._handleNewEntityType.bind(this);
    this._handleNewBlockType = this._handleNewBlockType.bind(this);

    this.state = {
      activeItem: undefined,
      dialogMode: ProjectAddButtonDialogType.noDialog,
      maxItemsToShow: 300,
      collapsedItemTypes: this.props.carto.collapsedTypes,
      collapsedStoragePaths: this.props.project ? this.props.project.collapsedStoragePaths : [],
    };
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

  _handleNewScriptClick() {
    if (this.props.project !== null) {
      this.launchNewItemType(
        this.props.project.preferredScriptLanguage === ProjectScriptLanguage.javaScript
          ? ProjectItemType.js
          : ProjectItemType.ts
      );
    }
  }

  _handleNewFeatureClick() {
    if (this.props.project !== null) {
      this.launchNewItemType(ProjectItemType.featureBehavior);
    }
  }

  _handleNewLootTableClick() {
    if (this.props.project !== null) {
      this.launchNewItemType(ProjectItemType.lootTableBehavior);
    }
  }

  _handleNewSpawnRuleClick() {
    if (this.props.project !== null) {
      this.launchNewItemType(ProjectItemType.spawnRuleBehavior);
    }
  }

  _handleNewFormClick() {
    if (this.props.project !== null) {
      this.launchNewItemType(ProjectItemType.dataForm);
    }
  }

  _handleNewFunctionClick() {
    if (this.props.project !== null) {
      ProjectItemManager.createNewFunction(this.props.project);
    }
  }

  launchNewItemType(itemType: ProjectItemType, suggestedName?: string) {
    this._tentativeNewItem = {
      name: suggestedName,
      itemType: itemType,
    };

    this.setState({
      activeItem: this.state.activeItem,
      dialogMode: ProjectAddButtonDialogType.newItemDialog,
      newItemType: itemType,
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
      contextFocusedItem: this.state.contextFocusedItem,
      collapsedItemTypes: this.state.collapsedItemTypes,
      collapsedStoragePaths: this.state.collapsedStoragePaths,
    });
  }

  async _handleNewBlockType() {
    if (this.state === null) {
      return;
    }

    if (this.tentativeNewBlockTypeName && this.tentativeNewBlockTypeItem && this.props.project !== null) {
      await ProjectUtilities.addBlockTypeFromGallery(
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
      dialogMode: ProjectAddButtonDialogType.noDialog,
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
        this.tentativeNewEntityTypeName,
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
      contextFocusedItem: this.state.contextFocusedItem,
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

  _updateNewItemSeed(newSeed: IProjectItemSeed) {
    this._tentativeNewItem = newSeed;
  }

  render() {
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
        content: "New mob (entity type)",
      },
      {
        id: "blockType",
        key: "blockType",
        onClick: this._handleNewBlockTypeClick,
        content: "New block type",
      },
      {
        id: "definitions",
        key: "definitions",
        content: "New definition",
        on: "hover",
        menu: {
          items: [
            {
              key: "1",
              onClick: this._handleNewSpawnRuleClick,
              content: "Spawn rule",
            },
            {
              key: "2",
              onClick: this._handleNewLootTableClick,
              content: "Loot table",
            },
            {
              key: "3",
              onClick: this._handleNewBlockTypeClick,
              content: "Feature",
            },
          ],
        },
      },
    ];

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
      this.state.newItemType !== undefined &&
      this.state.dialogMode === ProjectAddButtonDialogType.newItemDialog
    ) {
      dialogArea = (
        <Dialog
          open={true}
          cancelButton="Cancel"
          confirmButton="Add"
          key="pab-newItemOuter"
          onCancel={this._handleCancel}
          onConfirm={this._handleNewItem}
          content={
            <NewItem
              theme={this.props.theme}
              key="pab-newItemDia"
              heightOffset={this.props.heightOffset + 100}
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
    }

    let splitButton = <></>;

    if (this.props.project) {
      splitButton = (
        <div className="pab-newarea" key="pab-newSplit">
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
