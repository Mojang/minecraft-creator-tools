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

    await itemsFolder.load();

    this.setState({
      entitiesFolder: itemsFolder,
      selectedItemType: this.state.selectedItemType,
    });
  }

  _handleNameChanged(e: SyntheticEvent, data: (InputProps & { value: string }) | undefined) {
    if (data === undefined || this.props.carto === null || this.state == null) {
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
      this.props.carto.gallery === undefined
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

    return (
      <div className="net-outer">
        <div className="net-optionsArea">
          <div>
            <Input
              value={inputText}
              defaultValue={inputText}
              placeholder={this.state.selectedItemType ? this.state.selectedItemType.id : "myMobName"}
              onChange={this._handleNameChanged}
            />
          </div>
        </div>
        <div className="net-galleryHeader">Based on the following mob:</div>
        <div
          className="net-projectGallery"
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
            filterOn={[GalleryItemType.itemType]}
            onGalleryItemCommand={this._handleTypeGalleryCommand}
          />
        </div>
      </div>
    );
  }
}
