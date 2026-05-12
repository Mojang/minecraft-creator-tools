import { Component } from "react";
import IAppProps from "../../appShell/IAppProps";
import Project from "../../../app/Project";
import { ProjectItemType } from "../../../app/IProjectItemData";
import ProjectItem from "../../../app/ProjectItem";
import { ProjectEditorMode, ProjectItemEditorView } from "../ProjectEditorUtilities";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, MenuItem, Select, TextField, FormControl, InputLabel, Alert } from "@mui/material";

import { GitHubPropertyType } from "../ProjectPropertyEditor";
import NewEntityType from "../../editors/entityType/NewEntityType";
import { NewEntityTypeAddMode, NewItemTypeAddMode } from "../../../app/ProjectUtilities";
import IGitHubInfo from "../../../app/IGitHubInfo";
import "./ProjectAddButton.css";
import Utilities from "../../../core/Utilities";
import Log from "../../../core/Log";
import McButton from "../../shared/components/inputs/mcButton/McButton";
import NewBlockType from "../../editors/blockType/NewBlockType";
import { ProjectRole, ProjectScriptLanguage } from "../../../app/IProjectData";
import IGalleryItem, { GalleryItemType } from "../../../app/IGalleryItem";
import ProjectInfoSet from "../../../info/ProjectInfoSet";
import IProjectItemSeed from "../../../app/IProjectItemSeed";
import NewItemType from "../../editors/itemType/NewItemType";
import SetNamespacedId from "../naming/SetNamespacedId";
import ProjectItemUtilities from "../../../app/ProjectItemUtilities";
import ProjectItemCreateManager from "../../../app/ProjectItemCreateManager";
import SetName from "../naming/SetName";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faWandMagicSparkles, faTimes } from "@fortawesome/free-solid-svg-icons";
import SetNameAndFolder from "../naming/SetNameAndFolder";
import ProjectCreateManager from "../../../app/ProjectCreateManager";
import ContentWizard, { ContentWizardAction } from "../../home/ContentWizard";
import { IMinecraftContentDefinition } from "../../../minecraft/IContentMetaSchema";
import { ContentGenerator } from "../../../minecraft/ContentGenerator";
import { ContentWriter } from "../../../minecraft/ContentWriter";
import { getThemeColors } from "../../hooks/theme/useThemeColors";
import IProjectTheme from "../../types/IProjectTheme";
import CreatorToolsHost, { CreatorToolsThemeStyle } from "../../../app/CreatorToolsHost";
import { WithLocalizationProps, withLocalization } from "../../withLocalization";

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

interface IProjectAddButtonProps extends IAppProps, WithLocalizationProps {
  theme: IProjectTheme;
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

  /** Empty-file dialog: filename the user is typing (without extension) */
  emptyFileName?: string;
  /** Empty-file dialog: chosen content type (drives sub-folder + extension) */
  emptyFileContentType?: ProjectItemType;
  /** Empty-file dialog: validation error to surface inline */
  emptyFileError?: string | null;
}

export enum ProjectAddButtonDialogType {
  noDialog = 0,
  newEntityTypeDialog = 3,
  newBlockTypeDialog = 5,
  newItemTypeDialog = 6,
  newNamespacedDefinitionDialog = 7,
  newNamedGenericDialog = 8,
  newNamedGenericPlusFolderDialog = 9,
  contentWizardDialog = 10,
  newEmptyFileDialog = 11,
}

export const PROJECT_ADD_BUTTON_QUICK_ACTION_EVENT = "mct-project-add-quick-action";
export type ProjectAddButtonQuickAction = "entityType" | "blockType" | "itemType";

class ProjectAddButton extends Component<IProjectAddButtonProps, IProjectAddButtonState> {
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

  private _isCreating = false;

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
    this._handleContentWizardClick = this._handleContentWizardClick.bind(this);
    this._handleContentWizardComplete = this._handleContentWizardComplete.bind(this);
    this._handleContentWizardCancel = this._handleContentWizardCancel.bind(this);
    this._handleContentWizardQuickAction = this._handleContentWizardQuickAction.bind(this);
    this._handleQuickActionRequest = this._handleQuickActionRequest.bind(this);
    this._handleNewEmptyFileClick = this._handleNewEmptyFileClick.bind(this);
    this._handleEmptyFileNameChange = this._handleEmptyFileNameChange.bind(this);
    this._handleEmptyFileContentTypeChange = this._handleEmptyFileContentTypeChange.bind(this);
    this._handleEmptyFileConfirm = this._handleEmptyFileConfirm.bind(this);
    this._handleEmptyFileCancel = this._handleEmptyFileCancel.bind(this);

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
    window.addEventListener(PROJECT_ADD_BUTTON_QUICK_ACTION_EVENT, this._handleQuickActionRequest);
    this._load();
  }

  componentWillUnmount(): void {
    window.removeEventListener(PROJECT_ADD_BUTTON_QUICK_ACTION_EVENT, this._handleQuickActionRequest);
  }

  _handleQuickActionRequest(event: Event) {
    const customEvent = event as CustomEvent<{ action?: ProjectAddButtonQuickAction }>;

    switch (customEvent.detail?.action) {
      case "entityType":
        this._handleNewEntityTypeClick();
        break;
      case "blockType":
        this._handleNewBlockTypeClick();
        break;
      case "itemType":
        this._handleNewItemTypeClick();
        break;
    }
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

  /**
   * Ensures the item type category for a newly created project item is expanded
   * (not collapsed) in the project item list, so the user can see the new item.
   */
  private _ensureItemTypeExpanded(projectItem: ProjectItem | undefined) {
    if (!projectItem) {
      return;
    }

    const itemType = projectItem.itemType;
    if (this.props.creatorTools.collapsedTypes.includes(itemType)) {
      this.props.creatorTools.ensureTypeIsNotCollapsed(itemType);
      this.props.creatorTools.save();
    }
  }

  _handleNewActionSetClick() {
    this.launchNewGeneric(ProjectItemType.actionSet);
  }

  _handleNewGeodeFeatureClick() {
    this.launchNewNamespacedDefinition(ProjectItemType.featureBehavior, "geode_feature.json");
  }

  _handleNewBiomeClick = () => {
    this.launchNewNamespacedDefinition(ProjectItemType.biomeBehavior);
  };

  _handleNewFeatureClick = () => {
    this.launchNewNamespacedDefinition(ProjectItemType.featureBehavior);
  };

  _handleNewFeatureRuleClick = () => {
    this.launchNewNamespacedDefinition(ProjectItemType.featureRuleBehavior);
  };

  _handleNewLootTableClick() {
    this.launchNewNamedGeneric(ProjectItemType.lootTableBehavior);
  }

  _handleNewAudioClick() {
    this.launchNewResourcePackItemPlusFolder(ProjectItemType.audio, "audio", "sounds");
  }

  _handleContentWizardClick() {
    if (this.state === null) {
      return;
    }

    this.setState({
      activeItem: this.state.activeItem,
      dialogMode: ProjectAddButtonDialogType.contentWizardDialog,
      maxItemsToShow: this.state.maxItemsToShow,
      isLoaded: this.state.isLoaded,
      contextFocusedItem: this.state.contextFocusedItem,
      collapsedItemTypes: this.state.collapsedItemTypes,
      collapsedStoragePaths: this.state.collapsedStoragePaths,
    });
  }

  async _handleContentWizardComplete(definition: IMinecraftContentDefinition) {
    if (this.props.project === null) {
      return;
    }

    if (this._isCreating) return;
    this._isCreating = true;

    // Close the dialog immediately so the user gets responsive feedback.
    // Content generation continues asynchronously below; closing first avoids
    // leaving the modal open during the long await chain (and protects against
    // any subsequent setState being lost to a parent re-render).
    this.setState((prevState) => ({
      ...prevState,
      dialogMode: ProjectAddButtonDialogType.noDialog,
    }));

    try {
      // Snapshot existing project items before creation so we can find newly created ones
      const itemsBefore = new Set(this.props.project.items.map((i) => i.projectPath));

      const generator = new ContentGenerator(definition);
      const content = await generator.generate();

      // Write generated files to the project using shared utility
      await ContentWriter.writeGeneratedContent(this.props.project, content);

      // Re-infer project items from the newly created files
      await this.props.project.inferProjectItemsFromFiles(true);

      await this.props.project.processRelations(true);

      // Find the first created project item by comparing items before/after creation
      // Priority: entity behavior > block behavior > item behavior > any new item
      let createdProjectItem: ProjectItem | undefined = undefined;
      const newItems = this.props.project.items.filter((i) => !itemsBefore.has(i.projectPath));

      if (newItems.length > 0) {
        // Try to find the most relevant new item by type priority
        createdProjectItem =
          newItems.find((i) => i.itemType === ProjectItemType.entityTypeBehavior) ||
          newItems.find((i) => i.itemType === ProjectItemType.blockTypeBehavior) ||
          newItems.find((i) => i.itemType === ProjectItemType.itemTypeBehavior) ||
          newItems[0];
      }

      // Ensure the item's category is expanded so it's visible
      this._ensureItemTypeExpanded(createdProjectItem);

      this.setState((prevState) => ({
        ...prevState,
        activeItem: createdProjectItem,
        dialogMode: ProjectAddButtonDialogType.noDialog,
        collapsedItemTypes: this.props.creatorTools.collapsedTypes,
      }));

      // Select the newly created item in the editor
      if (createdProjectItem && this.props.onActiveProjectItemChangeRequested) {
        this.props.onActiveProjectItemChangeRequested(createdProjectItem, ProjectItemEditorView.singleFileEditor);
      }
    } catch (err) {
      Log.debug("Content wizard creation failed: " + err);
    } finally {
      this._isCreating = false;
    }
  }

  _handleContentWizardCancel() {
    this.tentativeNewEntityTypeItem = undefined;
    this.tentativeNewBlockTypeItem = undefined;
    this.tentativeNewItemTypeItem = undefined;
    this.tentativeNewName = undefined;
    this.tentativeNewEntityTypeAddMode = undefined;

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

  async _handleContentWizardQuickAction(action: ContentWizardAction, galleryItem?: IGalleryItem) {
    // Close the wizard first, then launch follow-up dialogs/actions.
    this.setState(
      {
        dialogMode: ProjectAddButtonDialogType.noDialog,
      },
      () => {
        switch (action) {
          case ContentWizardAction.newTypeScript:
            this._handleNewScriptClick();
            break;

          case ContentWizardAction.newFunction:
            this._handleNewFunctionClick();
            break;

          case ContentWizardAction.entityFromVanilla:
            this._handleNewEntityTypeClick();
            break;

          case ContentWizardAction.basicBlockType:
            this._handleNewBlockTypeClick();
            break;

          case ContentWizardAction.basicItemType:
            this._handleNewItemTypeClick();
            break;

          case ContentWizardAction.newSpawnRule:
            this.launchNewNamespacedDefinition(ProjectItemType.spawnRuleBehavior, "spawn_rule");
            break;

          case ContentWizardAction.newLootTable:
            this.launchNewNamedGeneric(ProjectItemType.lootTableBehavior);
            break;

          case ContentWizardAction.newStructure:
            this._handleNewStructureClick();
            break;

          case ContentWizardAction.galleryItem:
            if (galleryItem && galleryItem.targetType) {
              this.launchNewNamespacedDefinition(galleryItem.targetType, galleryItem.id);
            }
            break;
          case ContentWizardAction.newEmptyFile:
            this._handleNewEmptyFileClick();
            break;
          default:
            Log.error("Unhandled Content Wizard quick action: " + action);
        }
      }
    );
  }

  _handleNewDesignTextureClick() {
    this.launchNewDesignPackItemPlusFolder(ProjectItemType.designTexture, "design_texture", "design_textures");
  }

  _handleNewTextureClick() {
    this.launchNewResourcePackItemPlusFolder(ProjectItemType.texture, "texture", "textures");
  }

  async _handleGalleryItemClick(event: React.SyntheticEvent<HTMLElement>, menuItem: any | undefined) {
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

  /**
   * Open the "Empty File (advanced)" dialog (Add → Content Wizard → More
   * Options → Empty File). The dialog asks for a base file name and a content
   * type; on confirm we drop a minimally-valid stub at the conventional folder
   * for that content type. This gives experts a path to author files that
   * don't fit any of the wizards (e.g. a custom recipe variant or a one-off
   * loot table) without leaving the Add flow.
   */
  _handleNewEmptyFileClick() {
    this.setState({
      dialogMode: ProjectAddButtonDialogType.newEmptyFileDialog,
      emptyFileName: "",
      emptyFileContentType: ProjectItemType.unknownJson,
      emptyFileError: null,
    });
  }

  _handleEmptyFileNameChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    this.setState({ emptyFileName: e.target.value, emptyFileError: null });
  }

  _handleEmptyFileContentTypeChange(value: ProjectItemType) {
    this.setState({ emptyFileContentType: value });
  }

  _handleEmptyFileCancel() {
    this.setState({
      dialogMode: ProjectAddButtonDialogType.noDialog,
      emptyFileName: undefined,
      emptyFileContentType: undefined,
      emptyFileError: null,
    });
  }

  async _handleEmptyFileConfirm() {
    if (!this.props.project) {
      return;
    }

    const contentType = this.state.emptyFileContentType ?? ProjectItemType.unknownJson;
    const rawName = (this.state.emptyFileName ?? "").trim();

    // Allow empty name (the helper auto-derives one); otherwise validate that
    // the user didn't sneak path traversal or invalid filename chars in.
    if (rawName) {
      if (/[<>:"/\\|?*\x00-\x1f]/.test(rawName)) {
        this.setState({ emptyFileError: "File name contains invalid characters." });
        return;
      }
    }

    // Strip any extension the user typed — the stub helper applies the right one.
    const lastDot = rawName.lastIndexOf(".");
    const baseName = lastDot > 0 ? rawName.substring(0, lastDot) : rawName;

    try {
      const created = await ProjectItemCreateManager.createNewEmptyStubFile(
        this.props.project,
        contentType,
        baseName || undefined
      );

      this.setState((prevState) => ({
        activeItem: created ?? prevState.activeItem,
        dialogMode: ProjectAddButtonDialogType.noDialog,
        emptyFileName: undefined,
        emptyFileContentType: undefined,
        emptyFileError: null,
      }));

      if (created && this.props.onActiveProjectItemChangeRequested) {
        this.props.onActiveProjectItemChangeRequested(created, ProjectItemEditorView.singleFileEditor);
      }
    } catch (e) {
      this.setState({ emptyFileError: "Could not create file: " + (e instanceof Error ? e.message : String(e)) });
    }
  }

  async _handleNewStructureClick() {
    if (this.props.project) {
      await ProjectItemCreateManager.createNewStructure(this.props.project);
    }
  }

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

    const newBlockName = this.tentativeNewName;

    // Track existing items before creation so we can find the new one
    const itemsBefore = new Set(
      this.props.project?.getItemsByType(ProjectItemType.blockTypeBehavior).map((i) => i.projectPath) ?? []
    );

    if (newBlockName && this.tentativeNewBlockTypeItem && this.props.project !== null) {
      await ProjectCreateManager.addBlockTypeFromGallery(
        this.props.project,
        this.tentativeNewBlockTypeItem,
        newBlockName
      );
    }

    if (this.props.project) {
      await this.props.project.save();
    }

    // Find the newly created block type by comparing items before/after creation
    let createdItem: ProjectItem | undefined;
    if (this.props.project) {
      const itemsAfter = this.props.project.getItemsByType(ProjectItemType.blockTypeBehavior);
      const newItems = itemsAfter.filter((i) => !itemsBefore.has(i.projectPath));
      if (newItems.length > 0) {
        createdItem = newItems[0];
      }
    }

    // Ensure the item's category is expanded so it's visible
    this._ensureItemTypeExpanded(createdItem);

    this.setState({
      activeItem: createdItem,
      dialogMode: ProjectAddButtonDialogType.noDialog,
      isLoaded: this.state.isLoaded,
      maxItemsToShow: this.state.maxItemsToShow,
      contextFocusedItem: this.state.contextFocusedItem,
      collapsedItemTypes: this.props.creatorTools.collapsedTypes,
      collapsedStoragePaths: this.state.collapsedStoragePaths,
    });

    if (createdItem && this.props.onActiveProjectItemChangeRequested) {
      this.props.onActiveProjectItemChangeRequested(createdItem, ProjectItemEditorView.singleFileEditor);
    }
  }

  async _handleNewEntityType() {
    if (this.state === null) {
      return;
    }

    const newEntityName = this.tentativeNewName;

    // Track existing items before creation so we can find the new one
    const itemsBefore = new Set(
      this.props.project?.getItemsByType(ProjectItemType.entityTypeBehavior).map((i) => i.projectPath) ?? []
    );

    if (this.tentativeNewEntityTypeItem !== undefined && this.props.project !== null) {
      await ProjectCreateManager.addEntityTypeFromGallery(
        this.props.project,
        this.tentativeNewEntityTypeItem,
        newEntityName,
        this.tentativeNewEntityTypeAddMode
      );
    }

    if (this.props.project) {
      await this.props.project.save();
    }

    // Find the newly created entity type by comparing items before/after creation
    let createdItem: ProjectItem | undefined;
    if (this.props.project) {
      const itemsAfter = this.props.project.getItemsByType(ProjectItemType.entityTypeBehavior);
      const newItems = itemsAfter.filter((i) => !itemsBefore.has(i.projectPath));
      if (newItems.length > 0) {
        createdItem = newItems[0];
      }
    }

    // Ensure the item's category is expanded so it's visible
    this._ensureItemTypeExpanded(createdItem);

    this.setState({
      activeItem: createdItem,
      dialogMode: ProjectAddButtonDialogType.noDialog,
      maxItemsToShow: this.state.maxItemsToShow,
      isLoaded: this.state.isLoaded,
      contextFocusedItem: this.state.contextFocusedItem,
      collapsedItemTypes: this.props.creatorTools.collapsedTypes,
      collapsedStoragePaths: this.state.collapsedStoragePaths,
    });

    if (createdItem && this.props.onActiveProjectItemChangeRequested) {
      this.props.onActiveProjectItemChangeRequested(createdItem, ProjectItemEditorView.singleFileEditor);
    }
  }

  async _handleNewItemType() {
    if (this.state === null) {
      return;
    }

    const newItemName = this.tentativeNewName;

    // Track existing items before creation so we can find the new one
    const itemsBefore = new Set(
      this.props.project?.getItemsByType(ProjectItemType.itemTypeBehavior).map((i) => i.projectPath) ?? []
    );

    if (this.tentativeNewItemTypeItem !== undefined && this.props.project !== null) {
      await ProjectCreateManager.addItemTypeFromGallery(this.props.project, this.tentativeNewItemTypeItem, newItemName);
    }

    if (this.props.project) {
      await this.props.project.save();
    }

    // Find the newly created item type by comparing items before/after creation
    let createdItem: ProjectItem | undefined;
    if (this.props.project) {
      const itemsAfter = this.props.project.getItemsByType(ProjectItemType.itemTypeBehavior);
      const newItems = itemsAfter.filter((i) => !itemsBefore.has(i.projectPath));
      if (newItems.length > 0) {
        createdItem = newItems[0];
      }
    }

    // Ensure the item's category is expanded so it's visible
    this._ensureItemTypeExpanded(createdItem);

    this.setState({
      activeItem: createdItem,
      dialogMode: ProjectAddButtonDialogType.noDialog,
      maxItemsToShow: this.state.maxItemsToShow,
      contextFocusedItem: this.state.contextFocusedItem,
      collapsedItemTypes: this.props.creatorTools.collapsedTypes,
      collapsedStoragePaths: this.state.collapsedStoragePaths,
    });

    if (createdItem && this.props.onActiveProjectItemChangeRequested) {
      this.props.onActiveProjectItemChangeRequested(createdItem, ProjectItemEditorView.singleFileEditor);
    }
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

    // Ensure the item's category is expanded so it's visible
    this._ensureItemTypeExpanded(projectItem);

    this.setState({
      activeItem: projectItem,
      dialogMode: ProjectAddButtonDialogType.noDialog,
      maxItemsToShow: this.state.maxItemsToShow,
      contextFocusedItem: this.state.contextFocusedItem,
      collapsedItemTypes: this.props.creatorTools.collapsedTypes,
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

    const menuItems: { key: string; content: string; onClick: any }[] = [];

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
    const colors = getThemeColors();
    if (this.state.isLoaded === false) {
      return <div className="pab-loading">Loading...</div>;
    }

    const splitButtonMenuItems: any[] = [
      {
        id: "contentWizard",
        key: "contentWizard",
        onClick: this._handleContentWizardClick,
        icon: <FontAwesomeIcon icon={faWandMagicSparkles} />,
        content: "Content Creation Wizard",
      },
      {
        kind: "divider",
        key: "divider-wizard",
      },
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
        content: "New Mob — Custom creature or monster",
      },
      {
        id: "blockType",
        key: "blockType",
        onClick: this._handleNewBlockTypeClick,
        content: "New Block — Custom building block",
      },
      {
        id: "itemType",
        key: "itemType",
        onClick: this._handleNewItemTypeClick,
        content: "New Item — Custom tool, weapon, or object",
      },
      {
        key: "divider-newItems",
        kind: "divider",
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
        key: "divider-categories",
        kind: "divider",
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
          items: [
            {
              id: "biome",
              key: "pab-biome",
              onClick: this._handleNewBiomeClick,
              content: "New Biome",
            },
            {
              id: "feature",
              key: "pab-feature",
              onClick: this._handleNewFeatureClick,
              content: "New Feature",
            },
            {
              id: "featureRule",
              key: "pab-featureRule",
              onClick: this._handleNewFeatureRuleClick,
              content: "New Feature Rule",
            },
            {
              id: "structure",
              key: "pab-structure-worldgen",
              onClick: this._handleNewStructureClick,
              content: "New Structure",
            },
            ...(this.getMenuItemsFromGalleryItems(GalleryItemType.worldGen) as any[]).filter((gi) => {
              // Avoid duplicating the explicit entries above if the gallery contains
              // similarly-named presets (defensive — keyed by case-insensitive title).
              const c = (gi.content || "").toString().toLowerCase();
              return c !== "new biome" && c !== "new feature" && c !== "new feature rule" && c !== "new structure";
            }),
          ],
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
        content: "Mob/Item/Block Type",
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
        <Dialog open={true} key="pab-newEntityOuter" onClose={this._handleCancel}>
          <DialogTitle>{this.props.intl.formatMessage({ id: "project_editor.dialog.new_mob_title" })}</DialogTitle>
          <DialogContent>
            <NewEntityType
              theme={this.props.theme}
              key="pab-newEntityDia"
              onNewEntityTypeUpdated={this._newEntityTypeUpdated}
              project={this.props.project}
              creatorTools={this.props.creatorTools}
            />
          </DialogContent>
          <DialogActions>
            <McButton variant="stone" onClick={this._handleCancel}>
              {this.props.intl.formatMessage({ id: "common.cancel" })}
            </McButton>
            <McButton variant="green" onClick={this._handleNewEntityType}>
              {this.props.intl.formatMessage({ id: "project_editor.common.add" })}
            </McButton>
          </DialogActions>
        </Dialog>
      );
    } else if (
      this.state !== null &&
      this.props.project !== null &&
      this.state.dialogMode === ProjectAddButtonDialogType.newItemTypeDialog
    ) {
      dialogArea = (
        <Dialog open={true} key="pab-newItemOuter" onClose={this._handleCancel}>
          <DialogTitle>{this.props.intl.formatMessage({ id: "project_editor.dialog.new_item_title" })}</DialogTitle>
          <DialogContent>
            <NewItemType
              theme={this.props.theme}
              key="pab-newItemDia"
              onNewItemTypeUpdated={this._newItemTypeUpdated}
              project={this.props.project}
              creatorTools={this.props.creatorTools}
            />
          </DialogContent>
          <DialogActions>
            <McButton variant="stone" onClick={this._handleCancel}>
              {this.props.intl.formatMessage({ id: "common.cancel" })}
            </McButton>
            <McButton variant="green" onClick={this._handleNewItemType}>
              {this.props.intl.formatMessage({ id: "project_editor.common.add" })}
            </McButton>
          </DialogActions>
        </Dialog>
      );
    } else if (
      this.state !== null &&
      this.props.project !== null &&
      this.state.dialogMode === ProjectAddButtonDialogType.newBlockTypeDialog
    ) {
      dialogArea = (
        <Dialog open={true} key="pab-newBlockTypeOuter" onClose={this._handleCancel}>
          <DialogTitle>{this.props.intl.formatMessage({ id: "project_editor.dialog.new_block_title" })}</DialogTitle>
          <DialogContent>
            <NewBlockType
              key="pab-newBlockTypeDia"
              theme={this.props.theme}
              onNewBlockTypeUpdated={this._newBlockTypeUpdated}
              project={this.props.project}
              creatorTools={this.props.creatorTools}
            />
          </DialogContent>
          <DialogActions>
            <McButton variant="stone" onClick={this._handleCancel}>
              {this.props.intl.formatMessage({ id: "common.cancel" })}
            </McButton>
            <McButton variant="green" onClick={this._handleNewBlockType}>
              {this.props.intl.formatMessage({ id: "project_editor.common.add" })}
            </McButton>
          </DialogActions>
        </Dialog>
      );
    } else if (
      this.state !== null &&
      this.props.project !== null &&
      this.state.dialogMode === ProjectAddButtonDialogType.newNamespacedDefinitionDialog
    ) {
      dialogArea = (
        <Dialog open={true} key="btse-addComponentOuter" onClose={this._handleCancel}>
          <DialogTitle>
            {this.props.intl.formatMessage(
              { id: "project_editor.dialog.add_new_named" },
              { name: ProjectItemUtilities.getNewItemName(newItemState?.itemType ?? ProjectItemType.unknown) }
            )}
          </DialogTitle>
          <DialogContent>
            <SetNamespacedId
              onNameChanged={this._setNewName}
              defaultNamespace={this.props.project.effectiveDefaultNamespace}
              defaultName={newItemState?.name ? newItemState.name : "item"}
              theme={this.props.theme}
            />
          </DialogContent>
          <DialogActions>
            <McButton variant="stone" onClick={this._handleCancel}>
              {this.props.intl.formatMessage({ id: "common.cancel" })}
            </McButton>
            <McButton variant="green" onClick={this._handleNewGeneric}>
              {this.props.intl.formatMessage({ id: "project_editor.common.add" })}
            </McButton>
          </DialogActions>
        </Dialog>
      );
    } else if (
      this.state !== null &&
      this.props.project !== null &&
      this.state.dialogMode === ProjectAddButtonDialogType.newNamedGenericDialog
    ) {
      dialogArea = (
        <Dialog open={true} key="btse-addComponentOuter2" onClose={this._handleCancel}>
          <DialogTitle>
            {this.props.intl.formatMessage(
              { id: "project_editor.dialog.add_new_named" },
              { name: ProjectItemUtilities.getNewItemName(newItemState?.itemType ?? ProjectItemType.unknown) }
            )}
          </DialogTitle>
          <DialogContent>
            <SetName
              onNameChanged={this._setNewName}
              defaultName={newItemState?.name ? newItemState.name : "item"}
              theme={this.props.theme}
            />
          </DialogContent>
          <DialogActions>
            <McButton variant="stone" onClick={this._handleCancel}>
              {this.props.intl.formatMessage({ id: "common.cancel" })}
            </McButton>
            <McButton variant="green" onClick={this._handleNewGeneric}>
              {this.props.intl.formatMessage({ id: "project_editor.common.add" })}
            </McButton>
          </DialogActions>
        </Dialog>
      );
    } else if (
      this.state !== null &&
      this.props.project !== null &&
      this.state.dialogMode === ProjectAddButtonDialogType.newNamedGenericPlusFolderDialog
    ) {
      // Intentionally left empty — rendered separately below using the
      // open-prop pattern so MUI's exit transition completes and the portal
      // is cleaned up (otherwise the backdrop can persist after Add).
    } else if (
      this.state !== null &&
      this.props.project !== null &&
      this.state.dialogMode === ProjectAddButtonDialogType.contentWizardDialog
    ) {
      // Content wizard dialog intentionally left empty here;
      // rendered separately below using the open prop pattern for proper MUI cleanup.
    }

    const namedGenericPlusFolderOpen =
      this.state !== null &&
      this.props.project !== null &&
      this.state.dialogMode === ProjectAddButtonDialogType.newNamedGenericPlusFolderDialog;

    const namedGenericPlusFolderDialog = (
      <Dialog
        open={namedGenericPlusFolderOpen}
        key="pab-addComponentOuter"
        onClose={this._handleCancel}
        maxWidth="md"
        fullWidth
      >
        {namedGenericPlusFolderOpen && this.props.project && (
          <>
            <DialogTitle>
              {this.props.intl.formatMessage(
                { id: "project_editor.dialog.add_new_named" },
                { name: ProjectItemUtilities.getNewItemName(newItemState?.itemType ?? ProjectItemType.unknown) }
              )}
            </DialogTitle>
            <DialogContent>
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
            </DialogContent>
            <DialogActions>
              <McButton variant="stone" onClick={this._handleCancel}>
                {this.props.intl.formatMessage({ id: "common.cancel" })}
              </McButton>
              <McButton variant="green" onClick={this._handleNewGeneric}>
                {this.props.intl.formatMessage({ id: "project_editor.common.add" })}
              </McButton>
            </DialogActions>
          </>
        )}
      </Dialog>
    );

    // Always render the content wizard Dialog and control visibility via the open prop.
    // This ensures MUI's exit transition completes and the portal is properly cleaned up,
    // preventing stale backdrop elements from blocking subsequent interactions.
    const wizardOpen =
      this.state !== null &&
      this.props.project !== null &&
      this.state.dialogMode === ProjectAddButtonDialogType.contentWizardDialog;

    const contentWizardDialog = (
      <Dialog
        open={wizardOpen}
        key="pab-contentWizardOuter"
        className="pab-content-wizard-dialog"
        onClose={this._handleContentWizardCancel}
        maxWidth="lg"
        fullWidth
      >
        {wizardOpen && (
          <>
            <DialogTitle>
              {this.props.intl.formatMessage({ id: "project_editor.dialog.add_new_content" })}
              <button
                className="pab-dialog-close-btn"
                onClick={this._handleContentWizardCancel}
                title={this.props.intl.formatMessage({ id: "common.close" })}
                aria-label={this.props.intl.formatMessage({ id: "common.close" })}
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </DialogTitle>
            <DialogContent sx={{ padding: "0 !important" }}>
              <ContentWizard
                key="pab-contentWizard"
                theme={this.props.theme}
                creatorTools={this.props.creatorTools}
                heightOffset={this.props.heightOffset}
                project={this.props.project}
                onComplete={this._handleContentWizardComplete}
                onCancel={this._handleContentWizardCancel}
                onQuickAction={this._handleContentWizardQuickAction}
              />
            </DialogContent>
          </>
        )}
      </Dialog>
    );

    // "Empty File (advanced)" dialog — surfaces when the user picks the
    // newEmptyFile option from the wizard launcher's More Options section.
    // Lets experts pick a content type and base name, then drops a stub file
    // at the conventional folder so they can author it directly.
    const emptyFileDialogOpen =
      this.state !== null &&
      this.props.project !== null &&
      this.state.dialogMode === ProjectAddButtonDialogType.newEmptyFileDialog;

    const emptyFileTypeOptions: { value: ProjectItemType; label: string; ext: string; folder: string }[] = [
      { value: ProjectItemType.unknownJson, label: "Plain JSON file", ext: ".json", folder: "" },
      { value: ProjectItemType.entityTypeBehavior, label: "Entity (behavior)", ext: ".json", folder: "entities/" },
      { value: ProjectItemType.blockTypeBehavior, label: "Block (behavior)", ext: ".json", folder: "blocks/" },
      { value: ProjectItemType.itemTypeBehavior, label: "Item (behavior)", ext: ".json", folder: "items/" },
      { value: ProjectItemType.lootTableBehavior, label: "Loot table", ext: ".json", folder: "loot_tables/" },
      { value: ProjectItemType.recipeBehavior, label: "Recipe", ext: ".json", folder: "recipes/" },
      { value: ProjectItemType.spawnRuleBehavior, label: "Spawn rule", ext: ".json", folder: "spawn_rules/" },
      { value: ProjectItemType.MCFunction, label: "Function (.mcfunction)", ext: ".mcfunction", folder: "functions/" },
    ];
    const selectedEmptyFileType = this.state.emptyFileContentType ?? ProjectItemType.unknownJson;
    const selectedTypeOption = emptyFileTypeOptions.find((o) => o.value === selectedEmptyFileType);

    const emptyFileDialog = (
      <Dialog open={emptyFileDialogOpen} key="pab-emptyFileOuter" onClose={this._handleEmptyFileCancel} maxWidth="sm" fullWidth>
        {emptyFileDialogOpen && (
          <>
            <DialogTitle>Add empty file</DialogTitle>
            <DialogContent>
              <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 8 }}>
                <FormControl size="small" fullWidth>
                  <InputLabel id="pab-emptyFile-typeLabel">Content type</InputLabel>
                  <Select
                    labelId="pab-emptyFile-typeLabel"
                    label="Content type"
                    value={selectedEmptyFileType}
                    onChange={(e) => this._handleEmptyFileContentTypeChange(e.target.value as ProjectItemType)}
                  >
                    {emptyFileTypeOptions.map((opt) => (
                      <MenuItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  size="small"
                  fullWidth
                  label={"File name (extension " + (selectedTypeOption?.ext ?? ".json") + " is added automatically)"}
                  placeholder="e.g. my_thing"
                  value={this.state.emptyFileName ?? ""}
                  onChange={this._handleEmptyFileNameChange}
                  inputProps={{ "aria-label": "Empty file name" }}
                />
                {this.state.emptyFileError && <Alert severity="error">{this.state.emptyFileError}</Alert>}
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  Drops a minimally-valid stub at the conventional folder for this content type
                  (e.g. <code>behavior_packs/&lt;pack&gt;/{selectedTypeOption?.folder || "..."}</code>).
                  You can edit it freely — the wizards aren&rsquo;t involved.
                </div>
              </div>
            </DialogContent>
            <DialogActions>
              <McButton variant="stone" onClick={this._handleEmptyFileCancel}>
                {this.props.intl.formatMessage({ id: "common.cancel" })}
              </McButton>
              <McButton variant="green" onClick={this._handleEmptyFileConfirm}>
                {this.props.intl.formatMessage({ id: "project_editor.common.add" })}
              </McButton>
            </DialogActions>
          </>
        )}
      </Dialog>
    );

    let addButton = <></>;

    if (this.props.project) {
      addButton = (
        <div className="pab-newarea" key="pab-newSplit">
          <Button
            variant="outlined"
            startIcon={<FontAwesomeIcon icon={faPlus} className="fa-lg" />}
            aria-label={this.props.intl.formatMessage({ id: "project_editor.sidebar.add_new_content_aria" })}
            onClick={this._handleContentWizardClick}
            size="small"
            sx={{
              textTransform: "none",
              borderColor:
                CreatorToolsHost.theme === CreatorToolsThemeStyle.dark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.2)",
              color: "inherit",
            }}
          >
            {this.props.intl.formatMessage({ id: "label.add" })}
          </Button>
        </div>
      );
    }

    return (
      <div
        className="pab-outer"
        key="pab-outer"
        style={{
          borderColor: colors.background3,
        }}
      >
        {addButton}
        {dialogArea}
        {namedGenericPlusFolderDialog}
        {contentWizardDialog}
        {emptyFileDialog}
      </div>
    );
  }
}

export default withLocalization(ProjectAddButton);
