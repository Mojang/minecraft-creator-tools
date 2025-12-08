import { Component, SyntheticEvent } from "react";
import IAppProps from "./IAppProps";
import Project from "../app/Project";
import "./NewItemType.css";
import { Input, InputProps, ThemeInput } from "@fluentui/react-northstar";
import Database from "./../minecraft/Database";
import Log from "./../core/Log";
import IFolder from "./../storage/IFolder";
import { NewItemTypeAddMode } from "../app/ProjectUtilities";
import IGalleryItem, { GalleryItemType } from "../app/IGalleryItem";
import ItemGallery, { GalleryItemCommand } from "./ItemGallery";
import { ItemTileButtonDisplayMode } from "./ItemTileButton";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGem, faPencil } from "@fortawesome/free-solid-svg-icons";

interface INewItemTypeProps extends IAppProps {
  project: Project;
  theme: ThemeInput<any>;
  onNewItemTypeUpdated: (propertyType: NewItemTypeAddMode, project: IGalleryItem, name: string) => void;
}

interface INewItemTypeState {
  entitiesFolder?: IFolder;
  selectedItemType?: IGalleryItem;
  name?: string;
  nameIsManuallySet?: boolean;
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

    this.setState({
      entitiesFolder: itemsFolder,
      selectedItemType: this.state.selectedItemType,
    });
  }

  _handleNameChanged(e: SyntheticEvent, data: (InputProps & { value: string }) | undefined) {
    if (data === undefined || this.props.creatorTools === null || this.state == null) {
      return;
    }

    let nextNameIsManuallySet = this.state.nameIsManuallySet;

    if (!nextNameIsManuallySet) {
      if (this.state.selectedItemType && data.value !== this.state.selectedItemType.id) {
        nextNameIsManuallySet = true;
      }
    } else if (data.value === undefined || data.value === "") {
      nextNameIsManuallySet = false;
    }

    if (this.state.selectedItemType && data.value) {
      this.props.onNewItemTypeUpdated(NewItemTypeAddMode.baseId, this.state.selectedItemType, data.value);
    }

    this.setState({
      selectedItemType: this.state.selectedItemType,
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
      selectedItemType: project,
      entitiesFolder: this.state.entitiesFolder,
      name: newName,
      nameIsManuallySet: this.state.nameIsManuallySet,
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
      <div className="nitem-outer">
        <div className="nitem-section">
          <div className="nitem-sectionHeader" style={sectionHeaderStyle}>
            <FontAwesomeIcon icon={faPencil} className="nitem-sectionIcon" />
            Item Name
          </div>
          <div className="nitem-inputWrapper" style={inputStyle}>
            <Input
              aria-label="Item type name"
              value={inputText}
              defaultValue={inputText}
              placeholder={this.state.selectedItemType ? this.state.selectedItemType.id : "myItemName"}
              onChange={this._handleNameChanged}
            />
          </div>
        </div>
        <div className="nitem-section">
          <div className="nitem-sectionHeader" style={sectionHeaderStyle}>
            <FontAwesomeIcon icon={faGem} className="nitem-sectionIcon" />
            Base Template
          </div>
          <div className="nitem-sectionSubtitle">Select a vanilla item to use as a starting point</div>
          <div className="nitem-projectGallery" style={galleryStyle}>
            <ItemGallery
              creatorTools={this.props.creatorTools}
              theme={this.props.theme}
              view={ItemTileButtonDisplayMode.smallImage}
              isSelectable={true}
              gallery={this.props.creatorTools.gallery}
              filterOn={[GalleryItemType.itemType]}
              onGalleryItemCommand={this._handleTypeGalleryCommand}
            />
          </div>
        </div>
      </div>
    );
  }
}
