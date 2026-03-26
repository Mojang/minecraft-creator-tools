import { Component } from "react";
import "./LocalWorldTile.css";
import IAppProps from "../appShell/IAppProps";
import IFolder from "../../storage/IFolder";
import MCWorld from "../../minecraft/MCWorld";
import { LocalFolderType, LocalGalleryCommand } from "../utils/LocalGalleryCommand";
import { Button } from "@mui/material";
import { getThemeColors } from "../hooks/theme/useThemeColors";
import IProjectTheme from "../types/IProjectTheme";

export const LT_TILE_LARGE = 0;
export const LT_TILE_SMALL = 1;

interface ILocalWorldTileProps extends IAppProps {
  folder: IFolder;
  folderType: LocalFolderType;
  displayMode?: number;
  theme: IProjectTheme;
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
    this._doLoad = this._doLoad.bind(this);
    this._handleOpenProjectDirect = this._handleOpenProjectDirect.bind(this);
    this._handleCopyProject = this._handleCopyProject.bind(this);
    this._projectClick = this._projectClick.bind(this);

    this.state = {
      worldLoaded: false,
    };
  }

  componentDidMount() {
    this._isMountedInternal = true;

    this._doLoad();
  }

  async _doLoad() {
    const mcworld = await MCWorld.ensureMCWorldOnFolder(this.props.folder, undefined, this._handleMcworldLoaded);
    if (mcworld && mcworld.isLoaded !== this.state.worldLoaded) {
      this.setState({
        worldLoaded: mcworld.isLoaded,
      });
    }
  }

  componentWillUnmount(): void {
    this._isMountedInternal = false;
  }

  _handleOpenProjectDirect() {
    if (this.props.onGalleryItemCommand !== undefined) {
      this.props.onGalleryItemCommand(
        LocalGalleryCommand.ensureAndOpenProjectFromFolder,
        this.props.folderType,
        this.props.folder
      );
    }
  }

  _handleCopyProject() {
    if (this.props.onGalleryItemCommand !== undefined) {
      this.props.onGalleryItemCommand(LocalGalleryCommand.copyProject, this.props.folderType, this.props.folder);
    }
  }

  _projectClick() {
    if (this.props.onGalleryItemCommand !== undefined) {
      this.props.onGalleryItemCommand(
        LocalGalleryCommand.ensureAndOpenProjectFromFolder,
        this.props.folderType,
        this.props.folder
      );
    }
  }

  async _handleMcworldLoaded(world: MCWorld, worldA: MCWorld) {
    if (this._isMountedInternal) {
      await world.loadMetaFiles();

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
        imageElement = (
          <div className="lwt-iconBorder">
            <img className="lwt-worldPreviewImage" alt="Preview of the world" src={url} />
          </div>
        );
      }
    }

    let outerClassName = "lwt-outer";

    if (this.props.isSelected) {
      outerClassName += " lwt-outer-selected";
    }

    const colors = getThemeColors();

    return (
      <div
        className={outerClassName}
        title={this.props.folder.fullPath}
        style={{
          backgroundColor: colors.background2,
          color: colors.foreground2,
        }}
      >
        <div className="lwt-grid">
          <div className="lwt-mainArea">
            <div className="lwt-title">{name}</div>
          </div>
          <div className="lwt-mini-toolbar">
            <Button variant="contained" onClick={this._projectClick}>
              <span
                style={{
                  color: colors.foreground3,
                  borderLeftColor: colors.background1,
                }}
              >
                New
              </span>
            </Button>
          </div>
          <div
            className="lwt-iconArea"
            title={this.props.folder.name}
            style={{
              borderRightColor: colors.background1,
            }}
          >
            {imageElement}
          </div>
        </div>
      </div>
    );
  }
}
