import { Component } from "react";
import "./ProjectTile.css";
import IAppProps from "../appShell/IAppProps";
import IGalleryItem, { GalleryItemType } from "../../app/IGalleryItem";
import { GalleryProjectCommand } from "../home/CodeProjectGallery";
import Utilities from "../../core/Utilities";
import CreatorToolsHost from "../../app/CreatorToolsHost";
import ProjectUtilities from "../../app/ProjectUtilities";
import { getThemeColors } from "../hooks/theme/useThemeColors";
import IProjectTheme from "../types/IProjectTheme";
import GalleryReader from "../../app/gallery/GalleryReader";

export enum ProjectTileDisplayMode {
  large = 1,
  smallCodeSample = 2,
}

interface IProjectTileProps extends IAppProps {
  project: IGalleryItem;
  theme: IProjectTheme;
  displayMode?: ProjectTileDisplayMode;
  displayOpenButton?: boolean;
  isSelectable?: boolean;
  isSelected?: boolean;
  onGalleryItemCommand: (command: GalleryProjectCommand, project: IGalleryItem) => void;
}

interface IProjectTileState {}

export default class ProjectTile extends Component<IProjectTileProps, IProjectTileState> {
  constructor(props: IProjectTileProps) {
    super(props);

    this._handleTileClick = this._handleTileClick.bind(this);
    this._handleTileKeyDown = this._handleTileKeyDown.bind(this);
  }

  _handleTileClick() {
    if (this.props.onGalleryItemCommand !== undefined) {
      // Use newProject command to trigger the project creation flow
      this.props.onGalleryItemCommand(GalleryProjectCommand.newProject, this.props.project);
    }
  }

  _handleTileKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      this._handleTileClick();
    }
  }

  render() {
    const colors = getThemeColors();
    const proj = this.props.project;
    let imageElement = <></>;
    let summary = undefined;
    let tags = [];

    let mainAreaClass = "pt-mainArea";

    const ghurl = "https://github.com/" + proj.gitHubOwner + "/" + proj.gitHubRepoName;

    let description = [];

    if (
      this.props.project.type === GalleryItemType.codeSample ||
      this.props.project.type === GalleryItemType.editorCodeSample
    ) {
      const topics = this.props.project.topics;

      if (topics && topics.length > 0) {
        description.push(<span key="usesTag">{"Uses"}</span>);
        for (var i = 0; i < Math.min(topics.length, 5); i++) {
          const topic = topics[i];
          const url = ProjectUtilities.getTopicUrl(topic);

          if (url) {
            description.push(
              <a
                href={url}
                target="_blank"
                className="pt-docLink pts-code-topic"
                rel="noreferrer noopener"
                key={"topicUrl" + i}
                style={{
                  color: colors.foreground1,
                }}
              >
                {topic}
                {i < Math.min(topics.length - 1, 4) ? ", " : " "}
              </a>
            );
          } else {
            description.push(
              <span className="pts-code-topic" key={"codeTopicUrl" + i}>
                {topic}
                {i < Math.min(topics.length - 1, 4) ? ", " : " "}
              </span>
            );
          }
        }
      }
    }

    if (this.props.project.tags) {
      for (const tag of this.props.project.tags) {
        tags.push(
          <span
            className="pts-tag"
            key={"pts-tag" + tag}
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

    if (
      (proj.logoImage !== undefined || proj.localLogo !== undefined) &&
      this.props.displayMode === ProjectTileDisplayMode.large
    ) {
      let imagePath = proj.logoImage;

      if (imagePath === undefined) {
        imagePath =
          CreatorToolsHost.getVanillaContentRoot() + "res/latest/van/serve/resource_pack/textures/" + proj.localLogo;
      }

      if (proj.logoImage !== undefined) {
        if (proj.gitHubRepoName === "bedrock-samples") {
          imagePath = CreatorToolsHost.getVanillaContentRoot() + Utilities.ensureEndsWithSlash("res/latest/van/serve/");
        } else {
          imagePath =
            CreatorToolsHost.contentWebRoot +
            "res/samples/" +
            proj.gitHubOwner +
            "/" +
            GalleryReader.getLocalRepoFolder(proj.gitHubRepoName ?? "", proj.gitHubBranch) +
            "/";
        }

        if (proj.gitHubFolder !== undefined) {
          imagePath += Utilities.ensureNotStartsWithSlash(Utilities.ensureEndsWithSlash(proj.gitHubFolder));
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
    } else {
      mainAreaClass = "pt-mainArea-long";
    }

    if (this.props.displayMode === ProjectTileDisplayMode.smallCodeSample) {
      let outerClassName = "pts-outer";

      if (this.props.isSelected) {
        outerClassName += " pts-outer-selected";
      }

      return (
        <div
          className={outerClassName}
          key="tileOuter"
          onClick={this._handleTileClick}
          onKeyDown={this._handleTileKeyDown}
          role="button"
          tabIndex={0}
          title={`Create new project from ${proj.title}`}
          aria-label={`${proj.title} - ${proj.description || "Project template"}`}
        >
          <div
            className="pts-tile"
            style={{
              backgroundColor: colors.background2,
              color: colors.foreground2,
              borderColor: this.props.isSelected ? colors.foreground1 : colors.background4,
            }}
          >
            <div className="pts-content">
              <div className="pts-titleRow">
                <h3 className="pts-title">{proj.title}</h3>
                {tags.length > 0 && <div className="pts-tags">{tags}</div>}
              </div>
              <div className="pts-descriptionArea">
                <div
                  title={summary}
                  className={
                    this.props.project.type === GalleryItemType.codeSample
                      ? "pts-description pt-code"
                      : "pts-description"
                  }
                >
                  {description}
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    } else {
      let outerClassName = "pt-outer";

      if (this.props.isSelected) {
        outerClassName += " pt-outer-selected";
      }

      return (
        <div
          className={outerClassName}
          onClick={this._handleTileClick}
          onKeyDown={this._handleTileKeyDown}
          role="button"
          tabIndex={0}
          title={`Create new project from ${proj.title}`}
          aria-label={`${proj.title} - ${proj.description || "Project template"}`}
        >
          <div
            className="pt-tile"
            style={{
              backgroundColor: colors.background2,
              color: colors.foreground2,
              borderColor: this.props.isSelected ? colors.foreground1 : colors.background4,
            }}
          >
            <div className="pt-grid">
              <div className={mainAreaClass}>
                <div className="pt-titleOuter">
                  <h3 className="pt-title">{proj.title}</h3>
                  {tags}
                </div>
                <div className="pt-ghpath">
                  <a
                    href={ghurl}
                    target="_blank"
                    rel="noreferrer noopener"
                    title={`On GitHub at ${proj.gitHubOwner}/${proj.gitHubRepoName}`}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      color: colors.foreground3,
                    }}
                  >
                    GitHub project
                  </a>
                </div>
              </div>
              {imageElement}
              <div className="pt-descriptionArea">
                <div className="pt-description">{description}</div>
              </div>
            </div>
          </div>
        </div>
      );
    }
  }
}
