import { Component } from "react";
import "./LocalWorldTile.css";
import IAppProps from "./IAppProps";
import IFolder from "../storage/IFolder";
import { LocalGalleryCommand, LocalFolderType } from "./LocalGallery";
import MCWorld from "../minecraft/MCWorld";

export const LT_TILE_LARGE = 0;
export const LT_TILE_SMALL = 1;

interface ILocalWorldTileProps extends IAppProps {
  folder: IFolder;
  folderType: LocalFolderType;
  displayMode?: number;
  isSelected?: boolean;
  onGalleryItemCommand: (command: LocalGalleryCommand, folderType: LocalFolderType, folder: IFolder) => void;
}

interface ILocalWorldTileState {
  worldLoaded: boolean;
}

export default class LocalWorldTile extends Component<ILocalWorldTileProps, ILocalWorldTileState> {
  _isMountedInternal: boolean = false;

  constructor(props: ILocalWorldTileProps) {
    super(props);

    this._handleMcworldLoaded = this._handleMcworldLoaded.bind(this);

    MCWorld.ensureMCWorldOnFolder(this.props.folder, undefined, this._handleMcworldLoaded);

    this._handleOpenProjectDirect = this._handleOpenProjectDirect.bind(this);
    this._handleCopyProject = this._handleCopyProject.bind(this);
    this._projectClick = this._projectClick.bind(this);

    this.state = {
      worldLoaded: false,
    };
  }

  componentDidMount() {
    this._isMountedInternal = true;
  }

  componentWillUnmount(): void {
    this._isMountedInternal = false;
  }

  _handleOpenProjectDirect() {
    if (this.props.onGalleryItemCommand !== undefined) {
      this.props.onGalleryItemCommand(LocalGalleryCommand.openProjectDirect, this.props.folderType, this.props.folder);
    }
  }

  _handleCopyProject() {
    if (this.props.onGalleryItemCommand !== undefined) {
      this.props.onGalleryItemCommand(LocalGalleryCommand.copyProject, this.props.folderType, this.props.folder);
    }
  }

  _projectClick() {
    if (this.props.onGalleryItemCommand !== undefined) {
      this.props.onGalleryItemCommand(LocalGalleryCommand.openProjectDirect, this.props.folderType, this.props.folder);
    }
  }

  _handleMcworldLoaded(world: MCWorld, worldA: MCWorld) {
    if (this._isMountedInternal) {
      this.setState({
        worldLoaded: true,
      });
    }
  }

  render() {
    const folder = this.props.folder;
    let imageElement = <></>;
    let name = folder.name;

    if (this.props.folder.manager && this.props.folder.manager instanceof MCWorld) {
      const mcworld = this.props.folder.manager as MCWorld;

      if (mcworld.isLoaded) {
        name = mcworld.name;
      }

      if (mcworld.imageBase64 !== undefined) {
        const url = "data:image/jpg;base64, " + mcworld.imageBase64;
        imageElement = <img className="lwt-worldPreviewImage" alt="Preview of the world" src={url} />;
      }
    }

    let outerClassName = "lwt-outer";

    if (this.props.isSelected) {
      outerClassName += " lwt-outer-selected";
    }

    return (
      <div className={outerClassName} onClick={this._projectClick} title={this.props.folder.fullPath}>
        <div className="lwt-grid">
          <div className="lwt-mainArea">
            <div className="lwt-title">{name}</div>
          </div>
          <div className="lwt-iconArea">{imageElement}</div>
        </div>
      </div>
    );
  }
}
