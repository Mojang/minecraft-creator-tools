import { Component } from "react";
import "./ProjectTile.css";
import IAppProps from "./IAppProps";
import IGalleryItem, { GalleryItemType } from "../app/IGalleryItem";
import { GalleryProjectCommand } from "./ProjectGallery";
import { Button, ThemeInput } from "@fluentui/react-northstar";
import Utilities from "../core/Utilities";
import CartoApp from "../app/CartoApp";
import ProjectUtilities from "../app/ProjectUtilities";

export enum ProjectTileDisplayMode {
  large = 1,
  smallCodeSample = 2,
}

interface IProjectTileProps extends IAppProps {
  project: IGalleryItem;
  theme: ThemeInput<any>;
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

    this._handleNewProject = this._handleNewProject.bind(this);
    this._handleEnsureProject = this._handleEnsureProject.bind(this);
    this._handleBranchProject = this._handleBranchProject.bind(this);
    this._projectClick = this._projectClick.bind(this);
  }

  _handleNewProject() {
    if (this.props.onGalleryItemCommand !== undefined) {
      this.props.onGalleryItemCommand(GalleryProjectCommand.newProject, this.props.project);
    }
  }

  _handleEnsureProject() {
    if (this.props.onGalleryItemCommand !== undefined) {
      this.props.onGalleryItemCommand(GalleryProjectCommand.ensureProject, this.props.project);
    }
  }

  _handleBranchProject() {
    if (this.props.onGalleryItemCommand !== undefined) {
      this.props.onGalleryItemCommand(GalleryProjectCommand.forkProject, this.props.project);
    }
  }

  _projectClick() {
    if (this.props.onGalleryItemCommand !== undefined) {
      this.props.onGalleryItemCommand(GalleryProjectCommand.projectSelect, this.props.project);
    }
  }

  render() {
    const proj = this.props.project;
    let imageElement = <></>;
    const additionalButtons = [];
    let summary = undefined;
    let tags = [];

    let mainAreaClass = "pt-mainArea";

    const ghurl = "https://github.com/" + proj.gitHubOwner + "/" + proj.gitHubRepoName;

    if (this.props.displayOpenButton) {
      additionalButtons.push(
        <Button key="openButton" primary onClick={this._handleEnsureProject}>
          <span
            style={{
              color: this.props.theme.siteVariables?.colorScheme.brand.foreground3,
              borderLeftColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
            }}
          >
            Open
          </span>
        </Button>
      );
    }

    let description = [];

    if (
      this.props.project.type === GalleryItemType.codeSample ||
      this.props.project.type === GalleryItemType.editorCodeSample
    ) {
      const topics = this.props.project.topics;

      if (topics && topics.length > 0) {
        description.push(<span>{"Uses"}</span>);
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
                style={{
                  color: this.props.theme.siteVariables?.colorScheme.brand.foreground1,
                }}
              >
                {topic}
                {i < Math.min(topics.length - 1, 4) ? ", " : " "}
              </a>
            );
          } else {
            description.push(
              <span className="pts-code-topic">
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
              backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
              color: this.props.theme.siteVariables?.colorScheme.brand.foreground1,
              borderColor: this.props.theme.siteVariables?.colorScheme.brand.background4,
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
        imagePath = CartoApp.contentRoot + "res/latest/van/release/resource_pack/textures/" + proj.localLogo;
      }

      if (proj.logoImage !== undefined) {
        if (proj.gitHubRepoName === "bedrock-samples") {
          imagePath = CartoApp.contentRoot + Utilities.ensureEndsWithSlash("res/latest/van/release/");
        } else {
          imagePath = CartoApp.contentRoot + "res/samples/" + proj.gitHubOwner + "/" + proj.gitHubRepoName + "-";

          if (proj.gitHubBranch !== undefined) {
            imagePath += Utilities.ensureEndsWithSlash(proj.gitHubBranch);
          } else {
            imagePath += "main/";
          }
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
        <div className={outerClassName} key="tileOuter">
          <div
            className="pts-button"
            style={{
              backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background2,
              color: this.props.theme.siteVariables?.colorScheme.brand.foreground2,
            }}
          >
            <div
              className="pts-grid"
              style={{
                borderColor: this.props.theme.siteVariables?.colorScheme.brand.background4,
              }}
            >
              <div className="pts-mainArea">
                <h3 className="pts-title">{proj.title}</h3>
                {tags}
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

              <div
                className="pt-mini-toolbar"
                style={{
                  color: this.props.theme.siteVariables?.colorScheme.brand.foreground1,
                }}
              >
                <div
                  className="pt-mini-toolbar-interior"
                  style={{
                    borderTopColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
                  }}
                >
                  {additionalButtons}
                  <Button primary onClick={this._projectClick}>
                    <span
                      style={{
                        color: this.props.theme.siteVariables?.colorScheme.brand.foreground3,
                        borderLeftColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
                      }}
                    >
                      Open
                    </span>
                  </Button>
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
        <div className={outerClassName}>
          <div
            className="pt-button"
            style={{
              backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background2,
              color: this.props.theme.siteVariables?.colorScheme.brand.foreground2,
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
                    style={{
                      color: this.props.theme.siteVariables?.colorScheme.brand.foreground3,
                    }}
                  >
                    {proj.gitHubOwner}/{proj.gitHubRepoName}
                  </a>
                </div>
              </div>
              {imageElement}
              <div className="pt-descriptionArea">
                <div className="pt-description">{description}</div>
              </div>
              <div
                className="pt-mini-toolbar"
                style={{
                  color: this.props.theme.siteVariables?.colorScheme.brand.foreground1,
                }}
              >
                <div
                  className="pt-mini-toolbar-interior"
                  style={{
                    borderTopColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
                  }}
                >
                  {additionalButtons}
                  <Button primary onClick={this._handleNewProject}>
                    <span
                      style={{
                        color: this.props.theme.siteVariables?.colorScheme.brand.foreground3,
                        borderLeftColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
                      }}
                    >
                      New
                    </span>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }
  }
}
