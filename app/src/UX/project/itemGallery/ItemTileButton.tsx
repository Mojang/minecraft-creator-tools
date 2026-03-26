import React, { Component } from "react";
import "./ItemTileButton.css";
import IAppProps from "../../appShell/IAppProps";
import IGalleryItem, { GalleryItemType } from "../../../app/IGalleryItem";
import Utilities from "../../../core/Utilities";
import CreatorToolsHost from "../../../app/CreatorToolsHost";
import { GalleryItemCommand } from "./ItemGallery";
import { getThemeColors } from "../../hooks/theme/useThemeColors";
import IProjectTheme from "../../types/IProjectTheme";
import GalleryReader from "../../../app/gallery/GalleryReader";

export enum ItemTileButtonDisplayMode {
  smallCodeSample = 2,
  smallImage = 3,
}

interface IItemTileButtonProps extends IAppProps {
  project: IGalleryItem;
  theme: IProjectTheme;
  displayMode?: ItemTileButtonDisplayMode;
  displayOpenButton?: boolean;
  isSelectable?: boolean;
  isSelected?: boolean;
  onGalleryItemCommand: (command: GalleryItemCommand, project: IGalleryItem) => void;
  buttonIndex: number;
  tabIndex?: number;
  onArrowNav?: (index: number, dir: -1 | 1) => void;
  onExitBin?: () => void;
}

interface IItemTileButtonState {}

export default class ItemTileButton extends Component<IItemTileButtonProps, IItemTileButtonState> {
  buttonRef = React.createRef<HTMLDivElement>();

  constructor(props: IItemTileButtonProps) {
    super(props);

    this._handleNewProject = this._handleNewProject.bind(this);
    this._projectClick = this._projectClick.bind(this);
  }

  _handleNewProject() {
    if (this.props.onGalleryItemCommand !== undefined) {
      this.props.onGalleryItemCommand(GalleryItemCommand.newItem, this.props.project);
    }
  }

  _projectClick() {
    if (this.props.onGalleryItemCommand !== undefined) {
      this.props.onGalleryItemCommand(GalleryItemCommand.itemSelect, this.props.project);
    }
  }

  selectAndFocus() {
    if (this.buttonRef && this.buttonRef.current) {
      this.buttonRef.current.focus({
        preventScroll: false,
      });

      this.buttonRef.current.scrollIntoView({ block: "nearest" });
    }
  }

  render() {
    const colors = getThemeColors();

    const proj = this.props.project;
    let imageElement = <></>;

    let description = [];
    if (
      this.props.project.type === GalleryItemType.codeSample ||
      this.props.project.type === GalleryItemType.editorCodeSample
    ) {
      const topics = this.props.project.topics;

      if (topics) {
        for (const topic of topics) {
          description.push(<span className="itbi-code-topic">{topic}</span>);
        }
      }
    }

    if (this.props.project.tags) {
      for (const tag of this.props.project.tags) {
        description.push(
          <span
            className="itb-tag"
            style={{
              backgroundColor: colors.background1,
              color: colors.foreground1,
              borderColor: colors.background4,
            }}
          >
            {tag}
          </span>
        );
      }
    }

    if (this.props.project.description) {
      description.push(this.props.project.description);
    }

    if (proj.snapshotImage && this.props.displayMode === ItemTileButtonDisplayMode.smallImage) {
      const snapshotPath = CreatorToolsHost.getVanillaContentRoot() + "res/snapshots/" + proj.snapshotImage;

      imageElement = (
        <div className="pt-iconArea">
          <div className="pt-iconBorder">
            <div
              className={"pt-snapshotTile"}
              key="imageTile"
              style={{
                backgroundImage: "url(" + snapshotPath + ")",
              }}
            >
              &#160;
            </div>
          </div>
        </div>
      );
    } else if (
      (proj.logoImage !== undefined || proj.localLogo !== undefined) &&
      this.props.displayMode === ItemTileButtonDisplayMode.smallImage
    ) {
      let imagePath = proj.logoImage;

      if (imagePath === undefined) {
        if (proj.localLogo && proj.localLogo.startsWith("data:")) {
          imagePath = proj.localLogo;
        } else {
          imagePath =
            CreatorToolsHost.getVanillaContentRoot() +
            "res/latest/van/release/resource_pack/textures/" +
            proj.localLogo;
        }
      }

      if (proj.logoImage !== undefined) {
        if (proj.gitHubRepoName === "bedrock-samples") {
          imagePath =
            CreatorToolsHost.getVanillaContentRoot() + Utilities.ensureEndsWithSlash("res/latest/van/release/");
        } else {
          imagePath =
            CreatorToolsHost.contentWebRoot +
            "res/samples/" +
            proj.gitHubOwner +
            "/" +
            GalleryReader.getLocalRepoFolder(proj.gitHubRepoName ?? "", proj.gitHubBranch) +
            "/";
        }

        imagePath += proj.logoImage;
      }

      if (proj.logoLocation) {
        let imageWidth = 48;
        let multFactor = 48 / proj.logoLocation.width;

        imageElement = (
          <div className="pt-iconArea">
            <div className="pt-iconBorder">
              <div
                className={"pt-imageTile"}
                key="imageTile"
                style={{
                  backgroundImage: "url(" + imagePath + ")",
                  backgroundPositionX: "-" + proj.logoLocation.x * multFactor + "px",
                  backgroundPositionY: "-" + proj.logoLocation.y * multFactor + "px",
                  backgroundSize: proj.logoLocation.imageWidth * multFactor + "px",
                  width: imageWidth + "px",
                  height: imageWidth + "px",
                }}
              >
                &#160;
              </div>
            </div>
          </div>
        );
      } else {
        imageElement = (
          <div className="pt-iconArea">
            <div className="pt-iconBorder">
              <div className={"pt-imageTile"} key="imageTile" style={{ backgroundImage: "url(" + imagePath + ")" }}>
                &#160;
              </div>
            </div>
          </div>
        );
      }
    }

    let outerClassName = "itbi-outer";

    if (this.props.isSelected) {
      outerClassName += " itbi-outer-selected";
    }

    const isDark = colors.background1 === "#312f2d";

    return (
      <div
        className={outerClassName}
        key="tileOuter"
        onClick={this._projectClick}
        role="radio"
        aria-checked={this.props.isSelected}
        ref={this.buttonRef}
      >
        <div
          className="itbi-button"
          style={{
            color: colors.foreground1,
          }}
        >
          <div
            className="itbi-grid"
            style={{
              backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)",
              borderColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)",
            }}
          >
            <div className="itbi-iconArea"> {imageElement}</div>
            <div className="itbi-mainArea">
              <div className="itbi-title">{proj.title}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
