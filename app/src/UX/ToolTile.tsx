import { Component } from "react";
import "./ToolTile.css";
import IAppProps from "./IAppProps";
import Project from "../app/Project";
import ProjectTools from "../app/ProjectTools";
import ITool from "./../app/ITool";

export const TT_TILE_LARGE = 0;
export const TT_TILE_SMALL = 1;

interface IToolTileProps extends IAppProps {
  project?: Project;
  displayMode?: number;
  tool: ITool;
}

interface IToolTileState {}

export default class ToolTile extends Component<IToolTileProps, IToolTileState> {
  constructor(props: IToolTileProps) {
    super(props);

    this._handleNewProject = this._handleNewProject.bind(this);
    this._toolClick = this._toolClick.bind(this);
  }

  _handleNewProject() {}

  _toolClick() {
    ProjectTools.executeTool(this.props.tool, this.props.creatorTools, this.props.project);
  }

  render() {
    let imageElement = <></>;

    if (this.props.displayMode === TT_TILE_SMALL) {
      let outerClassName = "tts-outer";

      return (
        <div className={outerClassName} onClick={this._toolClick}>
          <div className="tts-grid">
            <div className="tts-mainArea">
              <div className="tts-title">{this.props.tool.title}</div>
            </div>
            <div className="tt-iconArea">{imageElement}</div>
          </div>
        </div>
      );
    } else {
      return (
        <div className="tt-outer">
          <div className="tt-grid">
            <div className="tt-mainArea">
              <div className="tt-title">{this.props.tool.title}</div>
            </div>
            <div className="tt-iconArea">{imageElement}</div>
            <div className="tt-descriptionArea"></div>
          </div>
        </div>
      );
    }
  }
}
