import { Component } from "react";
import "./CodeToolboxLanding.css";
import { Button, ThemeInput } from "@fluentui/react-northstar";
import IAppProps from "./IAppProps";
import Project from "./../app/Project";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import AppServiceProxy from "../core/AppServiceProxy";
import { faFile } from "@fortawesome/free-regular-svg-icons";
import { AppMode } from "./App";
import CartoApp from "../app/CartoApp";

interface ICodeToolboxLandingProps extends IAppProps {
  project: Project | null;
  theme: ThemeInput<any>;
  forceNewProject: boolean;
  onModeChangeRequested?: (mode: AppMode) => void;
}

interface ICodeToolboxLandingState {
  mode: CodeToolboxLandingMode;
}

export enum CodeToolboxLandingMode {
  configuring = 0,
  executing = 1,
  done = 2,
}

export default class CodeToolboxLanding extends Component<ICodeToolboxLandingProps, ICodeToolboxLandingState> {
  constructor(props: ICodeToolboxLandingProps) {
    super(props);

    this._handleNewProjectClick = this._handleNewProjectClick.bind(this);
  }

  _handleNewProjectClick() {
    AppServiceProxy.sendAsync("showNewProjectPage", "");
  }

  render() {
    const imageLogo = (
      <img
        alt="logo"
        src={CartoApp.contentRoot + "res/latest/van/resource_pack/textures/blocks/cartography_table_top.png"}
        className="ctl-logo"
      />
    );

    return (
      <div className="ctl-outer">
        <div className="ctl-newButtonArea" key="nba">
          <div className="ctl-logoArea">{imageLogo}</div>
          <Button
            onClick={this._handleNewProjectClick}
            icon={<FontAwesomeIcon icon={faFile} className="fa-lg" />}
            content="New Project"
            key="newpro"
            primary
          />
        </div>
      </div>
    );
  }
}
