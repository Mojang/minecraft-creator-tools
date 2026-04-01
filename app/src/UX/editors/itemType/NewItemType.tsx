import { Component, ChangeEvent } from "react";
import IAppProps from "../../appShell/IAppProps";
import Project from "../../../app/Project";
import "./NewItemType.css";
import { TextField } from "@mui/material";
import Database from "../../../minecraft/Database";
import Log from "../../../core/Log";
import IFolder from "../../../storage/IFolder";
import { NewItemTypeAddMode } from "../../../app/ProjectUtilities";
import IGalleryItem, { GalleryItemType } from "../../../app/IGalleryItem";
import ItemGallery, { GalleryItemCommand } from "../../project/itemGallery/ItemGallery";
import { ItemTileButtonDisplayMode } from "../../project/itemGallery/ItemTileButton";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGem, faPencil } from "@fortawesome/free-solid-svg-icons";
import { getThemeColors } from "../../hooks/theme/useThemeColors";
import IProjectTheme from "../../types/IProjectTheme";
import ProjectCreateManager from "../../../app/ProjectCreateManager";
import { ProjectItemType } from "../../../app/IProjectItemData";

interface INewItemTypeProps extends IAppProps {
  project: Project;
  theme: IProjectTheme;
  onNewItemTypeUpdated: (propertyType: NewItemTypeAddMode, project: IGalleryItem, name: string) => void;
}

interface INewItemTypeState {
  entitiesFolder?: IFolder;
  selectedItemType?: IGalleryItem;
  name?: string;
  nameIsManuallySet?: boolean;
  nameConflict?: boolean;
  projectItemItems?: IGalleryItem[];
}

export default class NewItemType extends Component<INewItemTypeProps, INewItemTypeState> {
  constructor(props: INewItemTypeProps) {
    super(props);

    this._handleTypeGalleryCommand = this._handleTypeGalleryCommand.bind(this);
    this._handleNameChanged = this._handleNameChanged.bind(this);
    this._ensureLoaded = this._ensureLoaded.bind(this);

    this.state = {};

    this._ensureLoaded();
  }

  async _ensureLoaded() {
    await Database.getReleaseVanillaBehaviorPackFolder();

    if (Database.releaseVanillaBehaviorPackFolder === undefined || Database.releaseVanillaBehaviorPackFolder === null) {
      Log.fail("Unexpectedly could not load default BP folder.");
      return;
    }

    const itemsFolder = Database.releaseVanillaBehaviorPackFolder.ensureFolder("items");

    if (!itemsFolder.isLoaded) {
      await itemsFolder.load();
    }

    // Pre-select the first item gallery item as default so clicking "Add" immediately works
    let defaultItemType = this.state.selectedItemType;
    if (!defaultItemType && this.props.creatorTools.gallery) {
      const itemGalleryItems = this.props.creatorTools.gallery.items.filter(
        (item) => item.type === GalleryItemType.itemType
      );
      if (itemGalleryItems.length > 0) {
        defaultItemType = itemGalleryItems[0];
        const defaultName = ProjectCreateManager.getUniqueName(
          this.props.project,
          defaultItemType.id,
          ProjectItemType.itemTypeBehavior
        );
        this.props.onNewItemTypeUpdated(NewItemTypeAddMode.baseId, defaultItemType, defaultName);
      }
    }

    // Build project item items for the gallery — no need to wait for relations here,
    // they'll be resolved at copy time via _resolveProjectItemFilePaths
    const projectItemItems = ProjectCreateManager.getProjectItemsAsGalleryItems(
      this.props.project,
      GalleryItemType.itemType
    );

    this.setState({
      entitiesFolder: itemsFolder,
      selectedItemType: defaultItemType,
      name: defaultItemType
        ? ProjectCreateManager.getUniqueName(this.props.project, defaultItemType.id, ProjectItemType.itemTypeBehavior)
        : this.state.name,
      projectItemItems: projectItemItems,
    });
  }

  _handleNameChanged(e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if (this.props.creatorTools === null || this.state == null) {
      return;
    }

    const value = e.target.value;
    let nextNameIsManuallySet = this.state.nameIsManuallySet;

    if (!nextNameIsManuallySet) {
      if (this.state.selectedItemType && value !== this.state.selectedItemType.id) {
        nextNameIsManuallySet = true;
      }
    } else if (value === undefined || value === "") {
      nextNameIsManuallySet = false;
    }

    const nameConflict = value
      ? ProjectCreateManager.nameExistsInProject(this.props.project, value, ProjectItemType.itemTypeBehavior)
      : false;

    if (this.state.selectedItemType && value) {
      this.props.onNewItemTypeUpdated(NewItemTypeAddMode.baseId, this.state.selectedItemType, value);
    }

    this.setState({
      selectedItemType: this.state.selectedItemType,
      name: value,
      nameIsManuallySet: nextNameIsManuallySet,
      nameConflict: nameConflict,
    });
  }

  private _handleTypeGalleryCommand(command: GalleryItemCommand, project: IGalleryItem) {
    let newName = this.state.name;

    if (!this.state.nameIsManuallySet || newName === undefined) {
      newName = ProjectCreateManager.getUniqueName(this.props.project, project.id, ProjectItemType.itemTypeBehavior);
    }

    const nameConflict = newName
      ? ProjectCreateManager.nameExistsInProject(this.props.project, newName, ProjectItemType.itemTypeBehavior)
      : false;

    this.setState({
      selectedItemType: project,
      entitiesFolder: this.state.entitiesFolder,
      name: newName,
      nameIsManuallySet: this.state.nameIsManuallySet,
      nameConflict: nameConflict,
    });

    if (this.props.onNewItemTypeUpdated) {
      this.props.onNewItemTypeUpdated(NewItemTypeAddMode.baseId, project, newName);
    }
  }

  render() {
    if (
      this.state === null ||
      Database.releaseVanillaBehaviorPackFolder === null ||
      this.state.entitiesFolder === undefined ||
      this.props.creatorTools.gallery === undefined
    ) {
      return <div>Loading...</div>;
    }

    const entitiesFolder = this.state.entitiesFolder;

    if (entitiesFolder === undefined) {
      return;
    }

    let inputText = this.state.name;

    if (inputText === undefined) {
      inputText = "";
    }

    const colors = getThemeColors();

    const sectionHeaderStyle: React.CSSProperties = {
      color: colors.secondaryForeground,
      borderBottomColor: colors.dialogSectionBorder,
    };

    const inputStyle: React.CSSProperties = {
      backgroundColor: colors.dialogInputBackground,
      borderColor: colors.dialogInputBorder,
      color: colors.secondaryForeground,
    };

    const galleryStyle: React.CSSProperties = {
      backgroundColor: colors.dialogGalleryBackground,
      borderColor: colors.dialogSectionBorder,
      color: colors.secondaryForeground,
    };

    return (
      <div className="nitem-outer">
        <div className="nitem-section">
          <div className="nitem-sectionHeader" style={sectionHeaderStyle}>
            <FontAwesomeIcon icon={faPencil} className="nitem-sectionIcon" />
            Item Name
          </div>
          <div className="nitem-inputWrapper" style={inputStyle}>
            <TextField
              aria-label="Item type name"
              value={inputText}
              placeholder={this.state.selectedItemType ? this.state.selectedItemType.id : "myItemName"}
              onChange={this._handleNameChanged}
              size="small"
              fullWidth
              variant="outlined"
              error={this.state.nameConflict}
              helperText={this.state.nameConflict ? "An item with this name already exists" : undefined}
            />
          </div>
        </div>
        <div className="nitem-section">
          <div className="nitem-sectionHeader" style={sectionHeaderStyle}>
            <FontAwesomeIcon icon={faGem} className="nitem-sectionIcon" />
            Base Template
          </div>
          <div className="nitem-sectionSubtitle">Select an existing item to use as a starting point</div>
          <div className="nitem-projectGallery" style={galleryStyle}>
            <ItemGallery
              creatorTools={this.props.creatorTools}
              theme={this.props.theme}
              view={ItemTileButtonDisplayMode.smallImage}
              isSelectable={true}
              gallery={this.props.creatorTools.gallery}
              filterOn={[GalleryItemType.itemType]}
              projectItems={this.state.projectItemItems}
              onGalleryItemCommand={this._handleTypeGalleryCommand}
            />
          </div>
        </div>
      </div>
    );
  }
}
