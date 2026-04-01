import { Component } from "react";
import "./CodeToolboxNoProjectLanding.css";
import { Button } from "@mui/material";
import IAppProps from "../appShell/IAppProps";
import Project from "../../app/Project";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import AppServiceProxy from "../../core/AppServiceProxy";
import { faPlus, faFolderOpen, faCube, faCheckCircle, faWrench } from "@fortawesome/free-solid-svg-icons";
import { AppMode } from "../appShell/App";
import CreatorToolsHost, { CreatorToolsThemeStyle } from "../../app/CreatorToolsHost";
import IProjectTheme from "../types/IProjectTheme";

interface ICodeToolboxNoProjectLandingProps extends IAppProps {
  project: Project | null;
  theme: IProjectTheme;
  forceNewProject: boolean;
  onModeChangeRequested?: (mode: AppMode) => void;
}

interface ICodeToolboxNoProjectLandingState {
  mode: CodeToolboxNoProjectLandingMode;
}

export enum CodeToolboxNoProjectLandingMode {
  configuring = 0,
  executing = 1,
  done = 2,
}

export default class CodeToolboxNoProjectLanding extends Component<
  ICodeToolboxNoProjectLandingProps,
  ICodeToolboxNoProjectLandingState
> {
  constructor(props: ICodeToolboxNoProjectLandingProps) {
    super(props);

    this._handleNewProjectClick = this._handleNewProjectClick.bind(this);
  }

  _handleNewProjectClick() {
    AppServiceProxy.sendAsync("showNewProjectPage", "");
  }

  render() {
    const isLightTheme = CreatorToolsHost.theme === CreatorToolsThemeStyle.light;

    return (
      <div className={"ctl-outer" + (isLightTheme ? " ctl-light" : "")}>
        <div className="ctl-panel">
          {/* Header with logo and welcome message */}
          <div className="ctl-header">
            <div className="ctl-logoArea">
              <img
                alt="Minecraft Creator Tools"
                src={CreatorToolsHost.contentWebRoot + "res/images/logo512.png"}
                className="ctl-logo"
              />
            </div>
            <div className="ctl-headerText">
              <h1 className="ctl-title">Minecraft Creator Tools</h1>
              <p className="ctl-subtitle">Create, edit, and validate Minecraft Bedrock add-ons</p>
            </div>
          </div>

          {/* Getting Started Section */}
          <div className="ctl-gettingStarted">
            <h2 className="ctl-sectionTitle">Get Started</h2>
            <p className="ctl-sectionDesc">
              Open a folder containing your Minecraft project, or create a new one from a template.
            </p>
          </div>

          {/* Primary Action Button */}
          <div className="ctl-actionArea">
            <Button
              onClick={this._handleNewProjectClick}
              startIcon={<FontAwesomeIcon icon={faPlus} className="fa-lg" />}
              variant="contained"
              className="ctl-newProjectButton"
            >
              New Project
            </Button>
          </div>

          {/* Feature highlights */}
          <div className="ctl-features">
            <div className="ctl-feature">
              <div className="ctl-featureIcon">
                <FontAwesomeIcon icon={faFolderOpen} />
              </div>
              <div className="ctl-featureText">
                <span className="ctl-featureTitle">Open Folder</span>
                <span className="ctl-featureDesc">Open an existing add-on folder to edit</span>
              </div>
            </div>
            <div className="ctl-feature">
              <div className="ctl-featureIcon">
                <FontAwesomeIcon icon={faCube} />
              </div>
              <div className="ctl-featureText">
                <span className="ctl-featureTitle">Visual Editors</span>
                <span className="ctl-featureDesc">Edit entities, blocks, items, and more</span>
              </div>
            </div>
            <div className="ctl-feature">
              <div className="ctl-featureIcon">
                <FontAwesomeIcon icon={faCheckCircle} />
              </div>
              <div className="ctl-featureText">
                <span className="ctl-featureTitle">Validation</span>
                <span className="ctl-featureDesc">Find and fix issues in your project</span>
              </div>
            </div>
            <div className="ctl-feature">
              <div className="ctl-featureIcon">
                <FontAwesomeIcon icon={faWrench} />
              </div>
              <div className="ctl-featureText">
                <span className="ctl-featureTitle">Templates</span>
                <span className="ctl-featureDesc">Start from ready-made project templates</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
