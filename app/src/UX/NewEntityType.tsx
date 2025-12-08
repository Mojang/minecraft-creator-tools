import { Component, SyntheticEvent } from "react";
import IAppProps from "./IAppProps";
import Project from "../app/Project";
import "./NewEntityType.css";
import { Input, InputProps, ThemeInput } from "@fluentui/react-northstar";
import Database from "./../minecraft/Database";
import Log from "./../core/Log";
import IFolder from "./../storage/IFolder";
import { NewEntityTypeAddMode } from "../app/ProjectUtilities";
import IGalleryItem, { GalleryItemType } from "../app/IGalleryItem";
import ItemGallery, { GalleryItemCommand } from "./ItemGallery";
import { ItemTileButtonDisplayMode } from "./ItemTileButton";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPaw, faPencil } from "@fortawesome/free-solid-svg-icons";

interface INewEntityTypeProps extends IAppProps {
  project: Project;
  theme: ThemeInput<any>;
  onNewEntityTypeUpdated: (propertyType: NewEntityTypeAddMode, project: IGalleryItem, name: string) => void;
}

interface INewEntityTypeState {
  entitiesFolder?: IFolder;
  selectedEntityType?: IGalleryItem;
  name?: string;
  nameIsManuallySet?: boolean;
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

    this.setState({
      entitiesFolder: entitiesFolder,
      selectedEntityType: this.state.selectedEntityType,
    });
  }

  _handleNameChanged(e: SyntheticEvent, data: (InputProps & { value: string }) | undefined) {
    if (data === undefined || this.props.creatorTools === null || this.state == null) {
      return;
    }

    let nextNameIsManuallySet = this.state.nameIsManuallySet;

    if (!nextNameIsManuallySet) {
      if (this.state.selectedEntityType && data.value !== this.state.selectedEntityType.id) {
        nextNameIsManuallySet = true;
      }
    } else if (data.value === undefined || data.value === "") {
      nextNameIsManuallySet = false;
    }

    if (this.state.selectedEntityType && data.value) {
      this.props.onNewEntityTypeUpdated(NewEntityTypeAddMode.baseId, this.state.selectedEntityType, data.value);
    }

    this.setState({
      selectedEntityType: this.state.selectedEntityType,
      name: data.value,
      nameIsManuallySet: nextNameIsManuallySet,
    });
  }

  private _handleTypeGalleryCommand(command: GalleryItemCommand, project: IGalleryItem) {
    let newName = this.state.name;

    if (!this.state.nameIsManuallySet || newName === undefined) {
      newName = project.id;
    }

    this.setState({
      selectedEntityType: project,
      entitiesFolder: this.state.entitiesFolder,
      name: newName,
      nameIsManuallySet: this.state.nameIsManuallySet,
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

    const brand = this.props.theme.siteVariables?.colorScheme?.brand;
    const isDark = brand?.background1 === "#312f2d";

    const sectionHeaderStyle: React.CSSProperties = {
      color: brand?.foreground,
      borderBottomColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)",
    };

    const inputStyle: React.CSSProperties = {
      backgroundColor: isDark ? "rgba(0,0,0,0.25)" : "rgba(255,255,255,0.9)",
      borderColor: isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)",
      color: brand?.foreground1,
    };

    const galleryStyle: React.CSSProperties = {
      backgroundColor: isDark ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.85)",
      borderColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)",
      color: brand?.foreground1,
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
            <Input
              aria-label="Entity type name"
              className="net-input"
              value={inputText}
              defaultValue={inputText}
              placeholder={this.state.selectedEntityType ? this.state.selectedEntityType.id : "myMobName"}
              onChange={this._handleNameChanged}
            />
          </div>
        </div>

        {/* Base Mob Selection Section */}
        <div className="net-section">
          <div className="net-sectionHeader" style={sectionHeaderStyle}>
            <FontAwesomeIcon icon={faPaw} className="net-sectionIcon" />
            <span>Base Template</span>
          </div>
          <div className="net-sectionSubtitle">Select a vanilla mob to use as a starting point</div>
          <div className="net-projectGallery" style={galleryStyle}>
            <ItemGallery
              creatorTools={this.props.creatorTools}
              theme={this.props.theme}
              view={ItemTileButtonDisplayMode.smallImage}
              isSelectable={true}
              gallery={this.props.creatorTools.gallery}
              filterOn={[GalleryItemType.entityType]}
              onGalleryItemCommand={this._handleTypeGalleryCommand}
            />
          </div>
        </div>
      </div>
    );
  }
}
