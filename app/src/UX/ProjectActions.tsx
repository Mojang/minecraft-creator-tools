import { Component } from "react";
import IAppProps from "./IAppProps";
import Project from "../app/Project";
import "./ProjectActions.css";
import { ThemeInput } from "@fluentui/react-northstar";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass } from "@fortawesome/free-solid-svg-icons";
import ProjectEditorUtilities, { ProjectEditorAction, ProjectEditorMode } from "./ProjectEditorUtilities";
import CartoApp from "../app/CartoApp";
import { faFileZipper, faFolder } from "@fortawesome/free-regular-svg-icons";
import MinecraftButton from "./MinecraftButton";

interface IProjectActionsProps extends IAppProps {
  project: Project;
  theme: ThemeInput<any>;
  heightOffset: number;
  onActionRequested?: (action: ProjectEditorAction) => void;
  onModeChangeRequested?: (mode: ProjectEditorMode) => void;
}

interface IProjectActionsState {}

export default class ProjectActions extends Component<IProjectActionsProps, IProjectActionsState> {
  constructor(props: IProjectActionsProps) {
    super(props);

    this._downloadFlatWorld = this._downloadFlatWorld.bind(this);
    this._downloadProjectWorld = this._downloadProjectWorld.bind(this);
    this._exportLocal = this._exportLocal.bind(this);
    this._exportZip = this._exportZip.bind(this);
    this._inspectProject = this._inspectProject.bind(this);

    this.state = {};
  }

  private _inspectProject() {
    if (this.props.onModeChangeRequested) {
      this.props.onModeChangeRequested(ProjectEditorMode.inspector);
    }
  }

  private _downloadFlatWorld() {
    ProjectEditorUtilities.launchFlatWorldWithPacksDownload(this.props.carto, this.props.project);
  }

  private _downloadProjectWorld() {
    ProjectEditorUtilities.launchWorldWithPacksDownload(this.props.carto, this.props.project);
  }

  private _exportLocal() {
    ProjectEditorUtilities.launchLocalExport(this.props.carto, this.props.project);
  }

  private _exportZip() {
    ProjectEditorUtilities.launchZipExport(this.props.carto, this.props.project);
  }

  render() {
    const packageBin = [];
    const exportBin = [];
    const inspectBin = [];

    inspectBin.push(
      <MinecraftButton
        className="pact-toolTile"
        key="pact-inspectProject"
        theme={this.props.theme}
        onClick={this._inspectProject}
      >
        <div className="pact-toolTileInner">
          <div className="pact-toolTile-label">
            <div className="pact-faIconWrap">
              <FontAwesomeIcon icon={faMagnifyingGlass} className="fa-xl" />
            </div>
            <div className="pact-label">Inspect this project</div>
          </div>
          <div className="pact-toolTile-instruction">
            Use a variety of different test suites to identify any issues with this project.
          </div>
        </div>
      </MinecraftButton>
    );

    exportBin.push(
      <MinecraftButton
        className="pact-toolTile"
        key="pact-exportZip"
        theme={this.props.theme}
        onClick={this._exportZip}
      >
        <div className="pact-toolTileInner">
          <div className="pact-toolTile-label">
            <div className="pact-faIconWrapIn">
              <FontAwesomeIcon icon={faFileZipper} className="fa-xl" />
            </div>
            <div className="pact-label">Export as a zip file</div>
          </div>
          <div className="pact-toolTile-instruction">Exports this project as a zip file</div>
        </div>
      </MinecraftButton>
    );

    if (window.showDirectoryPicker !== undefined) {
      exportBin.push(
        <MinecraftButton
          className="pact-toolTile"
          key="pact-exportLocalFolder"
          theme={this.props.theme}
          onClick={this._exportLocal}
        >
          <div className="pact-toolTileInner">
            <div className="pact-toolTile-label">
              <div className="pact-faIconWrap">
                <FontAwesomeIcon icon={faFolder} className="fa-xl" />
              </div>
              <div className="pact-label">Export to folder on your device</div>
            </div>
            <div className="pact-toolTile-instruction">Exports this project to a folder on your local device</div>
          </div>
        </MinecraftButton>
      );
    }

    packageBin.push(
      <MinecraftButton
        className="pact-toolTile"
        key="pact-dlFlatWorld"
        theme={this.props.theme}
        onClick={this._downloadFlatWorld}
      >
        <div className="pact-toolTileInner">
          <div className="pact-toolTile-label">
            <img
              className="pact-icon"
              alt=""
              src={CartoApp.contentRoot + "res/latest/van/resource_pack/textures/blocks/grass_path_side.png"}
            />
            <div className="pact-label">Download flat world</div>
          </div>
          <div className="pact-toolTile-instruction">
            Download this content in a flat world as a .mcworld file, for running within Minecraft
          </div>
        </div>
      </MinecraftButton>
    );

    packageBin.push(
      <MinecraftButton
        className="pact-toolTile"
        key="pact-dlProjectWorld"
        theme={this.props.theme}
        onClick={this._downloadProjectWorld}
      >
        <div className="pact-toolTileInner">
          <div className="pact-toolTile-label">
            <img
              className="pact-icon"
              alt=""
              src={CartoApp.contentRoot + "res/latest/van/resource_pack/textures/blocks/grass_side_carried.png"}
            />
            <div className="pact-label">Download project world</div>
          </div>
          <div className="pact-toolTile-instruction">
            Download this content in a project world as a .mcworld file, for running within Minecraft
          </div>
        </div>
      </MinecraftButton>
    );

    const height = "calc(100vh - " + this.props.heightOffset + "px)";

    return (
      <div
        className="pact-outer"
        style={{
          backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background2,
          color: this.props.theme.siteVariables?.colorScheme.brand.foreground2,
          minHeight: height,
          maxHeight: height,
        }}
      >
        <h2 className="pact-binHeader">Inspect and optimize this project</h2>
        <div className="pact-tileBin">{inspectBin}</div>
        <h2 className="pact-binHeader">Download this project to your device</h2>
        <div className="pact-tileBin">{exportBin}</div>
        <h2 className="pact-binHeader">Get packages to run in Minecraft</h2>
        <div className="pact-tileBin">{packageBin}</div>
      </div>
    );
  }
}
