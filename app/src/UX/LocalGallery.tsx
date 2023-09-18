import { Component } from "react";
import Carto from "./../app/Carto";
import "./LocalGallery.css";
import IAppProps from "./IAppProps";
import Status from "../app/Status";
import LocalTile from "./LocalTile";
import LocalWorldTile from "./LocalWorldTile";

import IFolder from "./../storage/IFolder";

export const LG_TYPE_WORLD = 0;

export enum LocalGalleryCommand {
  copyProject,
  openProjectDirect,
}

export enum LocalFolderType {
  world,
  behaviorPack,
}

interface ILocalGalleryProps extends IAppProps {
  search?: string;
  onGalleryItemCommand: (command: LocalGalleryCommand, folderType: LocalFolderType, folder: IFolder) => void;
}

interface ILocalGalleryState {
  worldsFolder: IFolder | undefined;
  previewWorldsFolder: IFolder | undefined;
  behaviorPacksFolder: IFolder | undefined;
  previewBehaviorPacksFolder: IFolder | undefined;
  developmentBehaviorPacksFolder: IFolder | undefined;
  previewDevelopmentBehaviorPacksFolder: IFolder | undefined;
}

export default class LocalGallery extends Component<ILocalGalleryProps, ILocalGalleryState> {
  constructor(props: ILocalGalleryProps) {
    super(props);

    this._handleStatusAdded = this._handleStatusAdded.bind(this);

    this.state = {
      worldsFolder: undefined,
      behaviorPacksFolder: undefined,
      developmentBehaviorPacksFolder: undefined,
      previewWorldsFolder: undefined,
      previewBehaviorPacksFolder: undefined,
      previewDevelopmentBehaviorPacksFolder: undefined,
    };
  }

  componentDidMount() {
    this._loadFolders();
  }

  async _loadFolders() {
    let worldsFolder = undefined;
    let behaviorPacksFolder = undefined;
    let developmentBehaviorPacksFolder = undefined;

    let previewWorldsFolder = undefined;
    let previewBehaviorPacksFolder = undefined;
    let previewDevelopmentBehaviorPacksFolder = undefined;

    if (this.props.carto.deploymentStorage) {
      worldsFolder = await this.props.carto.deploymentStorage.rootFolder.getFolderFromRelativePath("/minecraftWorlds/");

      if (!worldsFolder) {
        worldsFolder = await this.props.carto.deploymentStorage.rootFolder.getFolderFromRelativePath("/worlds/");
      }

      behaviorPacksFolder = await this.props.carto.deploymentStorage.rootFolder.getFolderFromRelativePath(
        "/behavior_packs/"
      );

      developmentBehaviorPacksFolder = await this.props.carto.deploymentStorage.rootFolder.getFolderFromRelativePath(
        "/development_behavior_packs/"
      );

      if (worldsFolder) {
        const exists = await worldsFolder.exists();
        if (exists) {
          await worldsFolder.load(false);
        } else {
          worldsFolder = undefined;
        }
      }

      if (behaviorPacksFolder) {
        const exists = await behaviorPacksFolder.exists();

        if (exists) {
          await behaviorPacksFolder.load(false);
        } else {
          behaviorPacksFolder = undefined;
        }
      }

      if (developmentBehaviorPacksFolder) {
        const exists = await developmentBehaviorPacksFolder.exists();

        if (exists) {
          await developmentBehaviorPacksFolder.load(false);
        } else {
          behaviorPacksFolder = undefined;
        }
      }
    }

    if (this.props.carto.previewDeploymentStorage) {
      previewWorldsFolder = await this.props.carto.previewDeploymentStorage.rootFolder.getFolderFromRelativePath(
        "/minecraftWorlds/"
      );

      if (!previewWorldsFolder) {
        previewWorldsFolder = await this.props.carto.previewDeploymentStorage.rootFolder.getFolderFromRelativePath(
          "/worlds/"
        );
      }

      previewBehaviorPacksFolder = await this.props.carto.previewDeploymentStorage.rootFolder.getFolderFromRelativePath(
        "/behavior_packs/"
      );

      previewDevelopmentBehaviorPacksFolder =
        await this.props.carto.previewDeploymentStorage.rootFolder.getFolderFromRelativePath(
          "/development_behavior_packs/"
        );

      if (previewWorldsFolder) {
        const exists = await previewWorldsFolder.exists();
        if (exists) {
          await previewWorldsFolder.load(false);
        } else {
          previewWorldsFolder = undefined;
        }
      }

      if (previewBehaviorPacksFolder) {
        const exists = await previewBehaviorPacksFolder.exists();

        if (exists) {
          await previewBehaviorPacksFolder.load(false);
        } else {
          previewBehaviorPacksFolder = undefined;
        }
      }

      if (previewDevelopmentBehaviorPacksFolder) {
        const exists = await previewDevelopmentBehaviorPacksFolder.exists();

        if (exists) {
          await previewDevelopmentBehaviorPacksFolder.load(false);
        } else {
          previewBehaviorPacksFolder = undefined;
        }
      }
    }

    const newState = {
      worldsFolder: worldsFolder,
      developmentBehaviorPacksFolder: developmentBehaviorPacksFolder,
      behaviorPacksFolder: behaviorPacksFolder,
      previewWorldsFolder: previewWorldsFolder,
      previewDevelopmentBehaviorPacksFolder: previewDevelopmentBehaviorPacksFolder,
      previewBehaviorPacksFolder: previewBehaviorPacksFolder,
    };

    this.setState(newState);
  }

  _handleStatusAdded(carto: Carto, status: Status) {}

  render() {
    if (!this.state) {
      return <></>;
    }

    const galleryTiles = [];

    if (this.state.worldsFolder) {
      const folders = this.state.worldsFolder.folders;
      for (const folderName in folders) {
        const childFolder = folders[folderName];

        if (childFolder) {
          galleryTiles.push(
            <LocalWorldTile
              key={"pitem" + folderName}
              folderType={LocalFolderType.world}
              onGalleryItemCommand={this.props.onGalleryItemCommand}
              carto={this.props.carto}
              folder={childFolder}
            />
          );
        }
      }
    }

    if (this.state.previewWorldsFolder) {
      const folders = this.state.previewWorldsFolder.folders;

      for (const folderName in folders) {
        const childFolder = folders[folderName];

        if (childFolder) {
          galleryTiles.push(
            <LocalWorldTile
              key={"pwitem" + folderName}
              folderType={LocalFolderType.world}
              onGalleryItemCommand={this.props.onGalleryItemCommand}
              carto={this.props.carto}
              folder={childFolder}
            />
          );
        }
      }
    }

    if (this.state.behaviorPacksFolder) {
      const folders = this.state.behaviorPacksFolder.folders;
      for (const folderName in folders) {
        const childFolder = folders[folderName];

        if (childFolder) {
          galleryTiles.push(
            <LocalTile
              key={"bitem" + folderName}
              folderType={LocalFolderType.behaviorPack}
              onGalleryItemCommand={this.props.onGalleryItemCommand}
              carto={this.props.carto}
              folder={childFolder}
            />
          );
        }
      }
    }

    if (this.state.previewBehaviorPacksFolder) {
      const folders = this.state.previewBehaviorPacksFolder.folders;
      for (const folderName in folders) {
        const childFolder = folders[folderName];

        if (childFolder) {
          galleryTiles.push(
            <LocalTile
              key={"pbitem" + folderName}
              folderType={LocalFolderType.behaviorPack}
              onGalleryItemCommand={this.props.onGalleryItemCommand}
              carto={this.props.carto}
              folder={childFolder}
            />
          );
        }
      }
    }

    if (this.state.developmentBehaviorPacksFolder) {
      const folders = this.state.developmentBehaviorPacksFolder.folders;
      let i = 0;
      for (const folderName in folders) {
        const childFolder = folders[folderName];

        if (childFolder) {
          galleryTiles.push(
            <LocalTile
              key={"dbitem" + folderName + i}
              folderType={LocalFolderType.behaviorPack}
              onGalleryItemCommand={this.props.onGalleryItemCommand}
              carto={this.props.carto}
              folder={childFolder}
            />
          );
        }
        i++;
      }
    }
    if (this.state.previewDevelopmentBehaviorPacksFolder) {
      const folders = this.state.previewDevelopmentBehaviorPacksFolder.folders;
      let i = 0;
      for (const folderName in folders) {
        const childFolder = folders[folderName];

        if (childFolder) {
          galleryTiles.push(
            <LocalTile
              key={"pdbitem" + folderName + i}
              folderType={LocalFolderType.behaviorPack}
              onGalleryItemCommand={this.props.onGalleryItemCommand}
              carto={this.props.carto}
              folder={childFolder}
            />
          );
        }
        i++;
      }
    }

    return <div className="lg-outer">{galleryTiles}</div>;
  }
}
