import { Component } from "react";
import "./LocalTile.css";
import IAppProps from "./IAppProps";
import IFolder from "../storage/IFolder";
import { LocalGalleryCommand, LocalFolderType } from "./LocalGallery";

export const LT_TILE_LARGE = 0;
export const LT_TILE_SMALL = 1;

interface ILocalTileProps extends IAppProps {
  folder: IFolder;
  folderType: LocalFolderType;
  displayMode?: number;
  isSelected?: boolean;
  onGalleryItemCommand: (command: LocalGalleryCommand, folderType: LocalFolderType, folder: IFolder) => void;
}

interface ILocalTileState {}

export default class LocalTile extends Component<ILocalTileProps, ILocalTileState> {
  constructor(props: ILocalTileProps) {
    super(props);

    this._handleOpenProjectDirect = this._handleOpenProjectDirect.bind(this);
    this._handleCopyProject = this._handleCopyProject.bind(this);
    this._projectClick = this._projectClick.bind(this);
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

  render() {
    const folder = this.props.folder;
    let imageElement = <></>;
    /*
    if (folder.logoImage !== undefined) {
      // <Button icon={<FontAwesomeIcon icon={faCodeBranch} className="fa-lg" />} onClick={this._handleBranchProject} iconPosition="before" primary />
      const imagePath = folder.logoImage;

      if (imagePath.indexOf("/") < 0) {
        imagePath = Utilities.ensureEndsWithSlash(
          "https://raw.githubusercontent.com/" + proj.gitHubOwner + "/" + proj.gitHubRepoName
        );

        if (proj.gitHubBranch !== undefined) {
          imagePath += Utilities.ensureEndsWithSlash(proj.gitHubBranch);
        } else {
          imagePath += "main/";
        }

        if (proj.gitHubFolder !== undefined) {
          imagePath += Utilities.ensureEndsWithSlash(proj.gitHubFolder);
        }

        imagePath += proj.logoImage;
      }

      imageElement = <img className="lt-imageTile" alt="" src={imagePath} />;
    }*/
    let outerClassName = "lt-outer";

    if (this.props.isSelected) {
      outerClassName += " lt-outer-selected";
    }

    return (
      <div className={outerClassName} onClick={this._projectClick} title={this.props.folder.fullPath}>
        <div className="lt-grid">
          <div className="lt-mainArea">
            <div className="lt-title">{folder.name}</div>
          </div>
          <div className="lt-iconArea">{imageElement}</div>
        </div>
      </div>
    );
  }
}
