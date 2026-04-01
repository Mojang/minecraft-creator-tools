import { Component, ChangeEvent } from "react";
import IAppProps from "../../appShell/IAppProps";
import Project from "../../../app/Project";
import "./NewBlockType.css";
import { TextField } from "@mui/material";
import Database from "../../../minecraft/Database";
import Log from "../../../core/Log";
import ItemGallery, { GalleryItemCommand } from "../../project/itemGallery/ItemGallery";
import { ItemTileButtonDisplayMode } from "../../project/itemGallery/ItemTileButton";
import IGalleryItem, { GalleryItemType } from "../../../app/IGalleryItem";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCube, faPencil } from "@fortawesome/free-solid-svg-icons";
import { getThemeColors } from "../../hooks/theme/useThemeColors";
import IProjectTheme from "../../types/IProjectTheme";
import ProjectCreateManager from "../../../app/ProjectCreateManager";
import { ProjectItemType } from "../../../app/IProjectItemData";

interface INewBlockTypeProps extends IAppProps {
  project: Project;
  theme: IProjectTheme;
  onNewBlockTypeUpdated: (blockTypeItem?: IGalleryItem, name?: string) => void;
}

interface INewBlockTypeState {
  selectedBlockType?: IGalleryItem;
  nameIsManuallySet?: boolean;
  name?: string;
  nameConflict?: boolean;
  projectBlockItems?: IGalleryItem[];
}

export default class NewBlockType extends Component<INewBlockTypeProps, INewBlockTypeState> {
  constructor(props: INewBlockTypeProps) {
    super(props);

    this._handleTypeGalleryCommand = this._handleTypeGalleryCommand.bind(this);
    this._handleNameChanged = this._handleNameChanged.bind(this);
    this._ensureLoaded = this._ensureLoaded.bind(this);

    this.state = {};

    window.setTimeout(this._ensureLoaded, 1);
  }

  async _ensureLoaded() {
    await Database.getReleaseVanillaBehaviorPackFolder();

    if (Database.releaseVanillaBehaviorPackFolder === undefined || Database.releaseVanillaBehaviorPackFolder === null) {
      Log.fail("Unexpectedly could not load default BP folder.");
      return;
    }

    // Pre-select the first block gallery item as default so clicking "Add" immediately works
    let defaultBlockType = this.state.selectedBlockType;
    if (!defaultBlockType && this.props.creatorTools.gallery) {
      const blockGalleryItems = this.props.creatorTools.gallery.items.filter(
        (item) => item.type === GalleryItemType.blockType
      );
      if (blockGalleryItems.length > 0) {
        defaultBlockType = blockGalleryItems[0];
        const defaultName = ProjectCreateManager.getUniqueName(
          this.props.project,
          defaultBlockType.id,
          ProjectItemType.blockTypeBehavior
        );
        this.props.onNewBlockTypeUpdated(defaultBlockType, defaultName);
      }
    }

    // Build project block items for the gallery — no need to wait for relations here,
    // they'll be resolved at copy time via _resolveProjectItemFilePaths
    const projectBlockItems = ProjectCreateManager.getProjectItemsAsGalleryItems(
      this.props.project,
      GalleryItemType.blockType
    );

    this.setState({
      selectedBlockType: defaultBlockType,
      name: defaultBlockType
        ? ProjectCreateManager.getUniqueName(this.props.project, defaultBlockType.id, ProjectItemType.blockTypeBehavior)
        : this.state.name,
      projectBlockItems: projectBlockItems,
    });
  }

  _handleNameChanged(e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if (this.props.creatorTools === null || this.state == null) {
      return;
    }

    const value = e.target.value;
    const nameConflict = value
      ? ProjectCreateManager.nameExistsInProject(this.props.project, value, ProjectItemType.blockTypeBehavior)
      : false;

    if (value) {
      this.props.onNewBlockTypeUpdated(this.state.selectedBlockType, value);
    }

    this.setState({
      name: value,
      nameConflict: nameConflict,
    });
  }

  private _handleTypeGalleryCommand(command: GalleryItemCommand, item: IGalleryItem) {
    let newName = this.state.name;

    if (!this.state.nameIsManuallySet || newName === undefined) {
      newName = ProjectCreateManager.getUniqueName(this.props.project, item.id, ProjectItemType.blockTypeBehavior);
    }

    const nameConflict = newName
      ? ProjectCreateManager.nameExistsInProject(this.props.project, newName, ProjectItemType.blockTypeBehavior)
      : false;

    this.setState({
      selectedBlockType: item,
      name: newName,
      nameIsManuallySet: this.state.nameIsManuallySet,
      nameConflict: nameConflict,
    });

    if (this.props.onNewBlockTypeUpdated) {
      this.props.onNewBlockTypeUpdated(item, newName);
    }
  }

  render() {
    if (
      this.state === null ||
      Database.releaseVanillaBehaviorPackFolder === null ||
      this.props.creatorTools.gallery === undefined
    ) {
      return <div>Loading...</div>;
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
      <div className="nbt-outer">
        <div className="nbt-section">
          <div className="nbt-sectionHeader" style={sectionHeaderStyle}>
            <FontAwesomeIcon icon={faPencil} className="nbt-sectionIcon" />
            Block Name
          </div>
          <div className="nbt-inputWrapper" style={inputStyle}>
            <TextField
              aria-label="Block type name"
              value={inputText}
              placeholder="myBlockName"
              onChange={this._handleNameChanged}
              size="small"
              fullWidth
              variant="outlined"
              error={this.state.nameConflict}
              helperText={this.state.nameConflict ? "A block with this name already exists" : undefined}
            />
          </div>
        </div>
        <div className="nbt-section">
          <div className="nbt-sectionHeader" style={sectionHeaderStyle}>
            <FontAwesomeIcon icon={faCube} className="nbt-sectionIcon" />
            Base Template
          </div>
          <div className="nbt-sectionSubtitle">Select an existing block to use as a starting point</div>
          <div className="nbt-projectGallery" style={galleryStyle}>
            <ItemGallery
              creatorTools={this.props.creatorTools}
              theme={this.props.theme}
              view={ItemTileButtonDisplayMode.smallImage}
              isSelectable={true}
              gallery={this.props.creatorTools.gallery}
              filterOn={[GalleryItemType.blockType]}
              projectItems={this.state.projectBlockItems}
              onGalleryItemCommand={this._handleTypeGalleryCommand}
            />
          </div>
        </div>
      </div>
    );
  }
}
