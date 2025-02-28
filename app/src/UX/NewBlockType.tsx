import { Component, SyntheticEvent } from "react";
import IAppProps from "./IAppProps";
import Project from "../app/Project";
import "./NewBlockType.css";
import { Input, InputProps, ThemeInput } from "@fluentui/react-northstar";
import Database from "./../minecraft/Database";
import Log from "./../core/Log";
import IFolder from "./../storage/IFolder";
import ItemGallery, { GalleryItemCommand } from "./ItemGallery";
import { ItemTileButtonDisplayMode } from "./ItemTileButton";
import IGalleryItem, { GalleryItemType } from "../app/IGalleryItem";

interface INewBlockTypeProps extends IAppProps {
  project: Project;
  theme: ThemeInput<any>;
  onNewBlockTypeUpdated: (blockTypeItem?: IGalleryItem, name?: string) => void;
}

interface INewBlockTypeState {
  blockTypesFolder?: IFolder;
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

    const blocksFolder = Database.releaseVanillaBehaviorPackFolder.ensureFolder("blocks");

    await blocksFolder.load();

    this.setState({
      blockTypesFolder: blocksFolder,
      selectedBlockType: this.state.selectedBlockType,
      name: this.state.name,
    });
  }

  _handleNameChanged(e: SyntheticEvent, data: (InputProps & { value: string }) | undefined) {
    if (data === undefined || this.props.carto === null || this.state == null) {
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
      blockTypesFolder: this.state.blockTypesFolder,
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
      this.state.blockTypesFolder === undefined ||
      this.props.carto.gallery === undefined
    ) {
      return <div>Loading...</div>;
    }

    let inputText = this.state.name;

    if (inputText === undefined) {
      inputText = "";
    }

    return (
      <div className="nbt-outer">
        <div className="nbt-optionsArea">
          <div>
            <Input value={inputText} defaultValue={inputText} onChange={this._handleNameChanged} />
          </div>
        </div>
        <div
          className="nbt-projectGallery"
          style={{
            backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background3,
            color: this.props.theme.siteVariables?.colorScheme.brand.foreground3,
          }}
        >
          <ItemGallery
            carto={this.props.carto}
            theme={this.props.theme}
            view={ItemTileButtonDisplayMode.smallImage}
            isSelectable={true}
            gallery={this.props.carto.gallery}
            filterOn={[GalleryItemType.blockType]}
            onGalleryItemCommand={this._handleTypeGalleryCommand}
          />
        </div>
      </div>
    );
  }
}
