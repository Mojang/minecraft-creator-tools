import { Component, ChangeEvent } from "react";
import IAppProps from "../../appShell/IAppProps";
import Project from "../../../app/Project";
import "./NewEntityType.css";
import { TextField } from "@mui/material";
import Database from "../../../minecraft/Database";
import Log from "../../../core/Log";
import Utilities from "../../../core/Utilities";
import IFolder from "../../../storage/IFolder";
import { NewEntityTypeAddMode } from "../../../app/ProjectUtilities";
import IGalleryItem, { GalleryItemType } from "../../../app/IGalleryItem";
import ItemGallery, { GalleryItemCommand } from "../../project/itemGallery/ItemGallery";
import { ItemTileButtonDisplayMode } from "../../project/itemGallery/ItemTileButton";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPaw, faPencil } from "@fortawesome/free-solid-svg-icons";
import { getThemeColors } from "../../hooks/theme/useThemeColors";
import IProjectTheme from "../../types/IProjectTheme";
import ProjectCreateManager from "../../../app/ProjectCreateManager";
import { ProjectItemType } from "../../../app/IProjectItemData";

interface INewEntityTypeProps extends IAppProps {
  project: Project;
  theme: IProjectTheme;
  onNewEntityTypeUpdated: (propertyType: NewEntityTypeAddMode, project: IGalleryItem, name: string) => void;
}

interface INewEntityTypeState {
  entitiesFolder?: IFolder;
  selectedEntityType?: IGalleryItem;
  name?: string;
  nameIsManuallySet?: boolean;
  nameConflict?: boolean;
  projectEntityItems?: IGalleryItem[];
}

export default class NewEntityType extends Component<INewEntityTypeProps, INewEntityTypeState> {
  constructor(props: INewEntityTypeProps) {
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

    const entitiesFolder = Database.releaseVanillaBehaviorPackFolder.ensureFolder("entities");

    await entitiesFolder.load();

    // Pre-select the first entity gallery item as default so clicking "Add" immediately works
    let defaultEntityType = this.state.selectedEntityType;
    if (!defaultEntityType && this.props.creatorTools.gallery) {
      const entityGalleryItems = this.props.creatorTools.gallery.items.filter(
        (item) => item.type === GalleryItemType.entityType
      );
      if (entityGalleryItems.length > 0) {
        defaultEntityType = entityGalleryItems[0];
        const defaultName = ProjectCreateManager.getUniqueName(
          this.props.project,
          Utilities.humanifyMinecraftName(defaultEntityType.id) as string,
          ProjectItemType.entityTypeBehavior
        );
        this.props.onNewEntityTypeUpdated(NewEntityTypeAddMode.baseId, defaultEntityType, defaultName);
      }
    }

    // Build project entity items for the gallery — no need to wait for relations here,
    // they'll be resolved at copy time via _resolveProjectItemFilePaths
    const projectEntityItems = ProjectCreateManager.getProjectItemsAsGalleryItems(
      this.props.project,
      GalleryItemType.entityType
    );

    this.setState({
      entitiesFolder: entitiesFolder,
      selectedEntityType: defaultEntityType,
      name: defaultEntityType
        ? ProjectCreateManager.getUniqueName(
            this.props.project,
            Utilities.humanifyMinecraftName(defaultEntityType.id) as string,
            ProjectItemType.entityTypeBehavior
          )
        : this.state.name,
      projectEntityItems: projectEntityItems,
    });
  }

  _handleNameChanged(e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if (this.props.creatorTools === null || this.state == null) {
      return;
    }

    const value = e.target.value;
    let nextNameIsManuallySet = this.state.nameIsManuallySet;

    if (!nextNameIsManuallySet) {
      if (this.state.selectedEntityType && value !== this.state.selectedEntityType.id) {
        nextNameIsManuallySet = true;
      }
    } else if (value === undefined || value === "") {
      nextNameIsManuallySet = false;
    }

    const nameConflict = value
      ? ProjectCreateManager.nameExistsInProject(this.props.project, value, ProjectItemType.entityTypeBehavior)
      : false;

    if (this.state.selectedEntityType && value) {
      this.props.onNewEntityTypeUpdated(NewEntityTypeAddMode.baseId, this.state.selectedEntityType, value);
    }

    this.setState({
      selectedEntityType: this.state.selectedEntityType,
      name: value,
      nameIsManuallySet: nextNameIsManuallySet,
      nameConflict: nameConflict,
    });
  }

  private _handleTypeGalleryCommand(command: GalleryItemCommand, project: IGalleryItem) {
    let newName = this.state.name;

    if (!this.state.nameIsManuallySet || newName === undefined) {
      newName = ProjectCreateManager.getUniqueName(
        this.props.project,
        Utilities.humanifyMinecraftName(project.id) as string,
        ProjectItemType.entityTypeBehavior
      );
    }

    const nameConflict = newName
      ? ProjectCreateManager.nameExistsInProject(this.props.project, newName, ProjectItemType.entityTypeBehavior)
      : false;

    this.setState({
      selectedEntityType: project,
      entitiesFolder: this.state.entitiesFolder,
      name: newName,
      nameIsManuallySet: this.state.nameIsManuallySet,
      nameConflict: nameConflict,
    });

    if (this.props.onNewEntityTypeUpdated) {
      this.props.onNewEntityTypeUpdated(NewEntityTypeAddMode.baseId, project, newName);
    }
  }

  render() {
    if (
      this.state === null ||
      Database.releaseVanillaBehaviorPackFolder === null ||
      this.state.entitiesFolder === undefined ||
      this.props.creatorTools.gallery === undefined
    ) {
      return <div className="net-loading">Loading...</div>;
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
      <div className="net-outer">
        {/* Name Input Section */}
        <div className="net-section">
          <div className="net-sectionHeader" style={sectionHeaderStyle}>
            <FontAwesomeIcon icon={faPencil} className="net-sectionIcon" />
            <span>Mob Name</span>
          </div>
          <div className="net-inputWrapper" style={inputStyle}>
            <TextField
              aria-label="Mob type name"
              className="net-input"
              value={inputText}
              placeholder={this.state.selectedEntityType ? this.state.selectedEntityType.id : "myMobName"}
              onChange={this._handleNameChanged}
              size="small"
              fullWidth
              variant="outlined"
              error={this.state.nameConflict}
              helperText={this.state.nameConflict ? "A mob with this name already exists" : undefined}
            />
          </div>
        </div>

        {/* Base Mob Selection Section */}
        <div className="net-section">
          <div className="net-sectionHeader" style={sectionHeaderStyle}>
            <FontAwesomeIcon icon={faPaw} className="net-sectionIcon" />
            <span>Base Template</span>
          </div>
          <div className="net-sectionSubtitle">Select an existing mob to use as a starting point</div>
          <div className="net-projectGallery" style={galleryStyle}>
            <ItemGallery
              creatorTools={this.props.creatorTools}
              theme={this.props.theme}
              view={ItemTileButtonDisplayMode.smallImage}
              isSelectable={true}
              gallery={this.props.creatorTools.gallery}
              filterOn={[GalleryItemType.entityType]}
              projectItems={this.state.projectEntityItems}
              onGalleryItemCommand={this._handleTypeGalleryCommand}
            />
          </div>
        </div>
      </div>
    );
  }
}
