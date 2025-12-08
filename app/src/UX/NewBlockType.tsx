import { Component, SyntheticEvent } from "react";
import IAppProps from "./IAppProps";
import Project from "../app/Project";
import "./NewBlockType.css";
import { Input, InputProps, ThemeInput } from "@fluentui/react-northstar";
import Database from "./../minecraft/Database";
import Log from "./../core/Log";
import ItemGallery, { GalleryItemCommand } from "./ItemGallery";
import { ItemTileButtonDisplayMode } from "./ItemTileButton";
import IGalleryItem, { GalleryItemType } from "../app/IGalleryItem";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCube, faPencil } from "@fortawesome/free-solid-svg-icons";

interface INewBlockTypeProps extends IAppProps {
  project: Project;
  theme: ThemeInput<any>;
  onNewBlockTypeUpdated: (blockTypeItem?: IGalleryItem, name?: string) => void;
}

interface INewBlockTypeState {
  selectedBlockType?: IGalleryItem;
  nameIsManuallySet?: boolean;
  name?: string;
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

    this.setState({
      selectedBlockType: this.state.selectedBlockType,
      name: this.state.name,
    });
  }

  _handleNameChanged(e: SyntheticEvent, data: (InputProps & { value: string }) | undefined) {
    if (data === undefined || this.props.creatorTools === null || this.state == null) {
      return;
    }

    if (this.state.name) {
      this.props.onNewBlockTypeUpdated(this.state.selectedBlockType, this.state.name);
    }

    this.setState({
      name: data.value,
    });
  }

  private _handleTypeGalleryCommand(command: GalleryItemCommand, item: IGalleryItem) {
    let newName = this.state.name;

    if (!this.state.nameIsManuallySet || newName === undefined) {
      newName = item.id;
    }

    this.setState({
      selectedBlockType: item,
      name: newName,
      nameIsManuallySet: this.state.nameIsManuallySet,
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
      <div className="nbt-outer">
        <div className="nbt-section">
          <div className="nbt-sectionHeader" style={sectionHeaderStyle}>
            <FontAwesomeIcon icon={faPencil} className="nbt-sectionIcon" />
            Block Name
          </div>
          <div className="nbt-inputWrapper" style={inputStyle}>
            <Input
              aria-label="Block type name"
              value={inputText}
              defaultValue={inputText}
              placeholder="myBlockName"
              onChange={this._handleNameChanged}
            />
          </div>
        </div>
        <div className="nbt-section">
          <div className="nbt-sectionHeader" style={sectionHeaderStyle}>
            <FontAwesomeIcon icon={faCube} className="nbt-sectionIcon" />
            Base Template
          </div>
          <div className="nbt-sectionSubtitle">Select a vanilla block to use as a starting point</div>
          <div className="nbt-projectGallery" style={galleryStyle}>
            <ItemGallery
              creatorTools={this.props.creatorTools}
              theme={this.props.theme}
              view={ItemTileButtonDisplayMode.smallImage}
              isSelectable={true}
              gallery={this.props.creatorTools.gallery}
              filterOn={[GalleryItemType.blockType]}
              onGalleryItemCommand={this._handleTypeGalleryCommand}
            />
          </div>
        </div>
      </div>
    );
  }
}
