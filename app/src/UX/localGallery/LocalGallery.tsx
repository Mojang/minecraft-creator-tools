import { Component } from "react";
import CreatorTools from "../../app/CreatorTools";
import "./LocalGallery.css";
import IAppProps from "../appShell/IAppProps";
import IStatus from "../../app/Status";
import LocalTile from "./LocalTile";
import LocalWorldTile from "./LocalWorldTile";
import { getThemeColors } from "../hooks/theme/useThemeColors";

import IFolder from "../../storage/IFolder";
import { LocalFolderType, LocalGalleryCommand } from "../utils/LocalGalleryCommand";
import { DeploymentTargetType } from "../../app/DeploymentTarget";
import IProjectTheme from "../types/IProjectTheme";
export const LG_TYPE_WORLD = 0;

interface ILocalGalleryProps extends IAppProps {
  search?: string;
  theme: IProjectTheme;
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

    if (this.props.creatorTools.deploymentStorage[DeploymentTargetType.bedrock]) {
      let isAvailable = this.props.creatorTools.deploymentStorage[DeploymentTargetType.bedrock].available;

      if (isAvailable === undefined) {
        isAvailable = await this.props.creatorTools.deploymentStorage[DeploymentTargetType.bedrock].getAvailable();
      }

      if (isAvailable) {
        worldsFolder =
          await this.props.creatorTools.deploymentStorage[
            DeploymentTargetType.bedrock
          ].rootFolder.getFolderFromRelativePath("/minecraftWorlds/");

        if (!worldsFolder) {
          worldsFolder =
            await this.props.creatorTools.deploymentStorage[
              DeploymentTargetType.bedrock
            ].rootFolder.getFolderFromRelativePath("/worlds/");
        }

        behaviorPacksFolder =
          await this.props.creatorTools.deploymentStorage[
            DeploymentTargetType.bedrock
          ].rootFolder.getFolderFromRelativePath("/behavior_packs/");

        developmentBehaviorPacksFolder =
          await this.props.creatorTools.deploymentStorage[
            DeploymentTargetType.bedrock
          ].rootFolder.getFolderFromRelativePath("/development_behavior_packs/");

        if (worldsFolder) {
          const exists = await worldsFolder.exists();
          if (exists) {
            await worldsFolder.load();
          } else {
            worldsFolder = undefined;
          }
        }

        if (behaviorPacksFolder) {
          const exists = await behaviorPacksFolder.exists();

          if (exists) {
            await behaviorPacksFolder.load();
          } else {
            behaviorPacksFolder = undefined;
          }
        }

        if (developmentBehaviorPacksFolder) {
          const exists = await developmentBehaviorPacksFolder.exists();

          if (exists) {
            await developmentBehaviorPacksFolder.load();
          } else {
            behaviorPacksFolder = undefined;
          }
        }
      }
    }

    const previewStorage = this.props.creatorTools.deploymentStorage[DeploymentTargetType.bedrockPreview];

    if (previewStorage) {
      let isAvailable = previewStorage.available;

      if (isAvailable === undefined) {
        isAvailable = await previewStorage.getAvailable();
      }

      if (isAvailable) {
        previewWorldsFolder = await previewStorage.rootFolder.getFolderFromRelativePath("/minecraftWorlds/");

        if (!previewWorldsFolder) {
          previewWorldsFolder = await previewStorage.rootFolder.getFolderFromRelativePath("/worlds/");
        }

        previewBehaviorPacksFolder = await previewStorage.rootFolder.getFolderFromRelativePath("/behavior_packs/");

        previewDevelopmentBehaviorPacksFolder =
          await previewStorage.rootFolder.getFolderFromRelativePath("/development_behavior_packs/");

        if (previewWorldsFolder) {
          const exists = await previewWorldsFolder.exists();
          if (exists) {
            await previewWorldsFolder.load();
          } else {
            previewWorldsFolder = undefined;
          }
        }

        if (previewBehaviorPacksFolder) {
          const exists = await previewBehaviorPacksFolder.exists();

          if (exists) {
            await previewBehaviorPacksFolder.load();
          } else {
            previewBehaviorPacksFolder = undefined;
          }
        }

        if (previewDevelopmentBehaviorPacksFolder) {
          const exists = await previewDevelopmentBehaviorPacksFolder.exists();

          if (exists) {
            if (!previewDevelopmentBehaviorPacksFolder.isLoaded) {
              await previewDevelopmentBehaviorPacksFolder.load();
            }
          } else {
            previewBehaviorPacksFolder = undefined;
          }
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

  _handleStatusAdded(creatorTools: CreatorTools, status: IStatus) {}

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
              theme={this.props.theme}
              key={"pitem" + folderName}
              folderType={LocalFolderType.world}
              onGalleryItemCommand={this.props.onGalleryItemCommand}
              creatorTools={this.props.creatorTools}
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
              theme={this.props.theme}
              key={"pwitem" + folderName}
              folderType={LocalFolderType.world}
              onGalleryItemCommand={this.props.onGalleryItemCommand}
              creatorTools={this.props.creatorTools}
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
              theme={this.props.theme}
              key={"bitem" + folderName}
              folderType={LocalFolderType.behaviorPack}
              onGalleryItemCommand={this.props.onGalleryItemCommand}
              creatorTools={this.props.creatorTools}
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
              theme={this.props.theme}
              folderType={LocalFolderType.behaviorPack}
              onGalleryItemCommand={this.props.onGalleryItemCommand}
              creatorTools={this.props.creatorTools}
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
              theme={this.props.theme}
              key={"dbitem" + folderName + i}
              folderType={LocalFolderType.behaviorPack}
              onGalleryItemCommand={this.props.onGalleryItemCommand}
              creatorTools={this.props.creatorTools}
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
              theme={this.props.theme}
              key={"pdbitem" + folderName + i}
              folderType={LocalFolderType.behaviorPack}
              onGalleryItemCommand={this.props.onGalleryItemCommand}
              creatorTools={this.props.creatorTools}
              folder={childFolder}
            />
          );
        }
        i++;
      }
    }

    const colors = getThemeColors();
    return (
      <div
        className="lg-outer"
        style={{
          backgroundColor: colors.background3,
          borderColor: colors.background1,
        }}
      >
        {galleryTiles}
      </div>
    );
  }
}
