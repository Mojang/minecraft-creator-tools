import { Component } from "react";
import "./ItemTileButton.css";
import IAppProps from "./IAppProps";
import IGalleryItem, { GalleryItemType } from "../app/IGalleryItem";
import { Button, ThemeInput } from "@fluentui/react-northstar";
import Utilities from "../core/Utilities";
import CartoApp from "../app/CartoApp";
import ProjectUtilities from "../app/ProjectUtilities";
import { GalleryItemCommand } from "./ItemGallery";

export enum ItemTileButtonDisplayMode {
  smallCodeSample = 2,
  smallImage = 3,
}

interface IItemTileButtonProps extends IAppProps {
  project: IGalleryItem;
  theme: ThemeInput<any>;
  displayMode?: ItemTileButtonDisplayMode;
  displayOpenButton?: boolean;
  isSelectable?: boolean;
  isSelected?: boolean;
  onGalleryItemCommand: (command: GalleryItemCommand, project: IGalleryItem) => void;
}

interface IItemTileButtonState {}

export default class ItemTileButton extends Component<IItemTileButtonProps, IItemTileButtonState> {
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

  render() {
    const proj = this.props.project;
    let imageElement = <></>;

    let description = [];

    if (
      this.props.project.type === GalleryItemType.codeSample ||
      this.props.project.type === GalleryItemType.editorCodeSample
    ) {
      const snippet = ProjectUtilities.getSnippet(this.props.project.id);

      if (snippet) {
        const lines = snippet.body;

        if (lines.length >= 1) {
          let curLine = this.props.project.codeLineStart;

          if (curLine === undefined) {
            curLine = Math.ceil(lines.length / 2) - 1;
          }

          let addedLines = 0;

          while (curLine < lines.length && addedLines < 4) {
            if (lines[curLine] && lines[curLine].indexOf("const overworld") <= 0 && lines[curLine].trim().length > 0) {
              description.push(<div className="itb-code-line">{lines[curLine]}</div>);
              addedLines++;
            }

            curLine++;
          }
        }
      }
    }

    if (this.props.project.tags) {
      for (const tag of this.props.project.tags) {
        description.push(
          <span
            className="itb-tag"
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
      this.props.displayMode === ItemTileButtonDisplayMode.smallImage
    ) {
      let imagePath = proj.logoImage;

      if (imagePath === undefined) {
        imagePath = CartoApp.contentRoot + "res/latest/van/resource_pack/textures/" + proj.localLogo;
      }

      if (proj.logoImage !== undefined) {
        if (proj.gitHubRepoName === "bedrock-samples") {
          imagePath = CartoApp.contentRoot + Utilities.ensureEndsWithSlash("res/latest/van/");
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
    }

    let outerClassName = "itbi-outer";

    if (this.props.isSelected) {
      outerClassName += " itbi-outer-selected";
    }

    return (
      <Button
        className={outerClassName}
        key="tileOuter"
        onClick={this._projectClick}
        role="radio"
        aria-checked={this.props.isSelected}
      >
        <div
          className="itbi-button"
          style={{
            backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background2,
            color: this.props.theme.siteVariables?.colorScheme.brand.foreground2,
          }}
        >
          <div
            className="itbi-grid"
            style={{
              borderColor: this.props.theme.siteVariables?.colorScheme.brand.background4,
            }}
          >
            <div className="itbi-iconArea"> {imageElement}</div>
            <div className="itbi-mainArea">
              <div className="itbi-title">{proj.title}</div>
            </div>
          </div>
        </div>
      </Button>
    );
  }
}
