import { Component } from "react";
import "./ProjectTile.css";
import IAppProps from "./IAppProps";
import IGalleryProject, { GalleryProjectType } from "../app/IGalleryProject";
import { GalleryProjectCommand } from "./ProjectGallery";
import { Button, ThemeInput } from "@fluentui/react-northstar";
import Utilities from "../core/Utilities";
import CartoApp from "../app/CartoApp";
import ProjectUtilities from "../app/ProjectUtilities";

export enum ProjectTileDisplayMode {
  large = 1,
  smallCodeSample = 2,
  smallImage = 3,
}

interface IProjectTileProps extends IAppProps {
  project: IGalleryProject;
  theme: ThemeInput<any>;
  displayMode?: ProjectTileDisplayMode;
  displayOpenButton?: boolean;
  isSelectable?: boolean;
  isSelected?: boolean;
  onGalleryItemCommand: (command: GalleryProjectCommand, project: IGalleryProject) => void;
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

    const ghurl = "https://github.com/" + proj.gitHubOwner + "/" + proj.gitHubRepoName;

    if (this.props.displayOpenButton) {
      additionalButtons.push(
        <Button key="openButton" primary onClick={this._handleEnsureProject}>
          <span
            style={{
              color: this.props.theme.siteVariables?.colorScheme.brand.foreground3,
            }}
          >
            Open
          </span>
        </Button>
      );
    }

    let description = proj.description;

    if (this.props.project.type === GalleryProjectType.codeSample) {
      const snippet = ProjectUtilities.getSnippet(this.props.project.id);

      if (snippet) {
        const lines = snippet.body;

        summary = lines.join("\r\n");

        if (lines.length >= 2) {
          const middleLine = Math.ceil(lines.length / 2) - 1;

          if (description === undefined) {
            description = "";
          } else {
            description += "\n";
          }

          let i = middleLine;
          let addedLines = 0;

          while (i < lines.length && addedLines < 4) {
            if (lines[i] && lines[i].indexOf("const overworld") <= 0 && lines[i].length > 3) {
              description += lines[i] + "\n";
              addedLines++;
            }

            i++;
          }
        }
      }
    }

    if (proj.logoImage !== undefined || proj.localLogo !== undefined) {
      // <Button icon={<FontAwesomeIcon icon={faCodeBranch} className="fa-lg" />} onClick={this._handleBranchProject} iconPosition="before" primary />
      let imagePath = proj.logoImage;

      if (imagePath === undefined) {
        imagePath = CartoApp.contentRoot + "res/latest/van/resource_pack/textures/" + proj.localLogo;
      }

      if (proj.logoImage !== undefined) {
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

      if (proj.logoLocation) {
        let imageWidth = 64;
        let multFactor = 64 / proj.logoLocation.width;

        if (this.props.displayMode === ProjectTileDisplayMode.smallCodeSample) {
          imageWidth = 32;
          multFactor = 56 / proj.logoLocation.width;
        }

        imageElement = (
          <div
            className={this.props.displayMode === ProjectTileDisplayMode.large ? "pt-imageTile" : "pts-imageTile"}
            key="imageTile"
            style={{
              backgroundImage: "url(" + imagePath + ")",
              backgroundPositionX: "-" + proj.logoLocation.x * multFactor + "px",
              backgroundPositionY: "-" + proj.logoLocation.y * multFactor + "px",
              backgroundSize: proj.logoLocation.width * multFactor * multFactor + "px",
              width: imageWidth + "px",
              height: imageWidth + "px",
            }}
          >
            &#160;
          </div>
        );
      } else {
        imageElement = (
          <div
            className={this.props.displayMode === ProjectTileDisplayMode.large ? "pt-imageTile" : "pts-imageTile"}
            key="imageTile"
            style={{ backgroundImage: "url(" + imagePath + ")" }}
          >
            &#160;
          </div>
        );
      }
    }

    if (this.props.displayMode === ProjectTileDisplayMode.smallCodeSample) {
      let outerClassName = "pts-outer";

      if (this.props.isSelected) {
        outerClassName += " pts-outer-selected";
      }

      return (
        <div className={outerClassName} key="tileOuter" onClick={this._projectClick}>
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
                <div className="pts-title">{proj.title}</div>
              </div>
              <div className="pts-iconArea">{imageElement}</div>
              <div
                className="pts-descriptionArea"
                style={{
                  backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
                  color: this.props.theme.siteVariables?.colorScheme.brand.foreground1,
                }}
              >
                <div
                  title={summary}
                  className={
                    this.props.project.type === GalleryProjectType.codeSample
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
    } else if (this.props.displayMode === ProjectTileDisplayMode.smallImage) {
      let outerClassName = "pti-outer";

      if (this.props.isSelected) {
        outerClassName += " pti-outer-selected";
      }

      return (
        <div className={outerClassName} key="tileOuter" onClick={this._projectClick}>
          <div
            className="pti-button"
            style={{
              backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background2,
              color: this.props.theme.siteVariables?.colorScheme.brand.foreground2,
            }}
          >
            <div
              className="pti-grid"
              style={{
                borderColor: this.props.theme.siteVariables?.colorScheme.brand.background4,
              }}
            >
              <div className="pti-mainArea">
                <div className="pti-title">{proj.title}</div>
              </div>
              <div className="pti-iconArea">{imageElement}</div>
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
            <div
              className="pt-grid"
              style={{
                borderColor: this.props.theme.siteVariables?.colorScheme.brand.background3,
              }}
            >
              <div className="pt-mainArea">
                <div className="pt-title">{proj.title}</div>
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
              <div className="pt-iconArea">
                <div className="pt-iconBorder">{imageElement}</div>
              </div>
              <div className="pt-descriptionArea">
                <div className="pt-description">{description}</div>
              </div>
              <div
                className="pt-mini-toolbar"
                style={{
                  color: this.props.theme.siteVariables?.colorScheme.brand.foreground1,
                }}
              >
                <div className="pt-mini-toolbar-interior">
                  {additionalButtons}
                  <Button primary onClick={this._handleNewProject}>
                    <span
                      style={{
                        color: this.props.theme.siteVariables?.colorScheme.brand.foreground3,
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
