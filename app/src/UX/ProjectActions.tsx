import { Component } from "react";
import IAppProps from "./IAppProps";
import Project from "../app/Project";
import "./ProjectActions.css";
import LocTokenBox from "./LocTokenBox";
import { ThemeInput } from "@fluentui/react-northstar";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faMagnifyingGlass,
  faCube,
  faCubes,
  faCode,
  faImage,
  faWandMagicSparkles,
  faGlobe,
  faFileCode,
  faLayerGroup,
} from "@fortawesome/free-solid-svg-icons";
import { faEdit } from "@fortawesome/free-regular-svg-icons";
import ProjectEditorUtilities, { ProjectEditorAction, ProjectEditorMode } from "./ProjectEditorUtilities";
import CreatorToolsHost, { CreatorToolsThemeStyle } from "../app/CreatorToolsHost";
import { faFileZipper, faFolder } from "@fortawesome/free-regular-svg-icons";
import MinecraftButton from "./MinecraftButton";
import { ProjectItemType } from "../app/IProjectItemData";

interface IProjectActionsProps extends IAppProps {
  project: Project;
  theme: ThemeInput<any>;
  heightOffset: number;
  onActionRequested?: (action: ProjectEditorAction) => void;
  onModeChangeRequested?: (mode: ProjectEditorMode) => void;
}

interface IProjectActionsState {
  entityCount: number;
  blockCount: number;
  itemCount: number;
  scriptCount: number;
  textureCount: number;
  functionCount: number;
}

export default class ProjectActions extends Component<IProjectActionsProps, IProjectActionsState> {
  constructor(props: IProjectActionsProps) {
    super(props);

    this._downloadFlatWorld = this._downloadFlatWorld.bind(this);
    this._downloadProjectWorld = this._downloadProjectWorld.bind(this);
    this._exportLocal = this._exportLocal.bind(this);
    this._exportZip = this._exportZip.bind(this);
    this._inspectProject = this._inspectProject.bind(this);
    this._editProjectDetails = this._editProjectDetails.bind(this);

    this.state = {
      entityCount: 0,
      blockCount: 0,
      itemCount: 0,
      scriptCount: 0,
      textureCount: 0,
      functionCount: 0,
    };
  }

  componentDidMount() {
    this._updateStats();
  }

  componentDidUpdate(prevProps: IProjectActionsProps) {
    if (prevProps.project !== this.props.project) {
      this._updateStats();
    }
  }

  private _updateStats() {
    const project = this.props.project;

    const entityCount = project.getItemsByType(ProjectItemType.entityTypeBehavior).length;
    const blockCount = project.getItemsByType(ProjectItemType.blockTypeBehavior).length;
    const itemCount = project.getItemsByType(ProjectItemType.itemTypeBehavior).length;
    const scriptCount =
      project.getItemsByType(ProjectItemType.ts).length + project.getItemsByType(ProjectItemType.js).length;
    const textureCount = project.getItemsByType(ProjectItemType.texture).length;
    const functionCount = project.getItemsByType(ProjectItemType.MCFunction).length;

    this.setState({
      entityCount,
      blockCount,
      itemCount,
      scriptCount,
      textureCount,
      functionCount,
    });
  }

  private _inspectProject() {
    if (this.props.onModeChangeRequested) {
      this.props.onModeChangeRequested(ProjectEditorMode.inspector);
    }
  }

  private _editProjectDetails() {
    if (this.props.onModeChangeRequested) {
      this.props.onModeChangeRequested(ProjectEditorMode.properties);
    }
  }

  private _downloadFlatWorld() {
    ProjectEditorUtilities.launchFlatWorldWithPacksDownload(this.props.creatorTools, this.props.project);
  }

  private _downloadProjectWorld() {
    ProjectEditorUtilities.launchWorldWithPacksDownload(this.props.creatorTools, this.props.project);
  }

  private _exportLocal() {
    ProjectEditorUtilities.launchLocalExport(this.props.creatorTools, this.props.project);
  }

  private _exportZip() {
    ProjectEditorUtilities.launchZipExport(this.props.creatorTools, this.props.project);
  }

  render() {
    const project = this.props.project;
    const height = "calc(100vh - " + this.props.heightOffset + "px)";

    // Build stats for display
    const stats = [
      { icon: faCube, label: "Entity Types", count: this.state.entityCount },
      { icon: faCubes, label: "Block Types", count: this.state.blockCount },
      { icon: faLayerGroup, label: "Item Types", count: this.state.itemCount },
      { icon: faCode, label: "Scripts", count: this.state.scriptCount },
      { icon: faImage, label: "Textures", count: this.state.textureCount },
      { icon: faFileCode, label: "Functions", count: this.state.functionCount },
    ].filter((s) => s.count > 0);

    const hasStats = stats.length > 0;

    let imgElt = (
      <img
        alt="Project preview"
        style={{
          imageRendering: "pixelated",
        }}
        src={
          CreatorToolsHost.theme === CreatorToolsThemeStyle.dark
            ? `${CreatorToolsHost.contentRoot}res/images/templates/redflower_lightbg.png`
            : `${CreatorToolsHost.contentRoot}res/images/templates/redflower_darkbg.png`
        }
      />
    );

    if (project.previewImageBase64) {
      imgElt = <img alt="Project preview" src={`data:image/png;base64,${project.previewImageBase64}`} />;
    }

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
        {/* Hero Section */}
        <div className="pact-hero">
          <div className="pact-heroContent">
            <div className="pact-heroImage">{imgElt}</div>
            <div className="pact-heroText">
              <div className="pact-titleRow">
                <h1 className="pact-projectTitle">
                  <LocTokenBox
                    creatorTools={this.props.creatorTools}
                    project={project}
                    value={project.title || "Untitled Project"}
                  />
                </h1>
                <button
                  className="pact-editButton"
                  onClick={this._editProjectDetails}
                  title="Edit project details"
                  aria-label="Edit project details"
                >
                  <FontAwesomeIcon icon={faEdit} />
                </button>
              </div>
              {project.creator && <div className="pact-projectCreator">by {project.creator}</div>}
              {project.description && (
                <p className="pact-projectDescription">
                  <LocTokenBox creatorTools={this.props.creatorTools} project={project} value={project.description} />
                </p>
              )}
            </div>
          </div>

          {/* Stats Bar */}
          {hasStats && (
            <div className="pact-statsBar">
              {stats.map((stat) => (
                <div key={stat.label} className="pact-stat">
                  <FontAwesomeIcon icon={stat.icon} className="pact-statIcon" />
                  <span className="pact-statCount">{stat.count}</span>
                  <span className="pact-statLabel">{stat.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions Section */}
        <div className="pact-section">
          <div className="pact-sectionHeader">
            <FontAwesomeIcon icon={faWandMagicSparkles} className="pact-sectionIcon" />
            <h2>Quick Actions</h2>
          </div>
          <div className="pact-cardGrid">
            <MinecraftButton
              className="pact-actionCard pact-cardPrimary"
              key="pact-inspectProject"
              theme={this.props.theme}
              onClick={this._inspectProject}
            >
              <div className="pact-cardContent">
                <div className="pact-cardIconLarge">
                  <FontAwesomeIcon icon={faMagnifyingGlass} fixedWidth />
                </div>
                <div className="pact-cardText">
                  <div className="pact-cardTitle">Inspect Project</div>
                  <div className="pact-cardDesc">Run validation tests to identify issues and optimize your content</div>
                </div>
              </div>
            </MinecraftButton>
          </div>
        </div>

        {/* Export Section */}
        <div className="pact-section">
          <div className="pact-sectionHeader">
            <FontAwesomeIcon icon={faFolder} className="pact-sectionIcon" />
            <h2>Export Project</h2>
          </div>
          <div className="pact-cardGrid">
            <MinecraftButton
              className="pact-actionCard"
              key="pact-exportZip"
              theme={this.props.theme}
              onClick={this._exportZip}
            >
              <div className="pact-cardContent">
                <div className="pact-cardIcon">
                  <FontAwesomeIcon icon={faFolder} fixedWidth />
                </div>
                <div className="pact-cardText">
                  <div className="pact-cardTitle">Export to Folder</div>
                  <div className="pact-cardDesc">Save as a compressed archive</div>
                </div>
              </div>
            </MinecraftButton>

            {window.showDirectoryPicker !== undefined && (
              <MinecraftButton
                className="pact-actionCard"
                key="pact-exportLocalFolder"
                theme={this.props.theme}
                onClick={this._exportLocal}
              >
                <div className="pact-cardContent">
                  <div className="pact-cardIcon">
                    <FontAwesomeIcon icon={faFolder} />
                  </div>
                  <div className="pact-cardText">
                    <div className="pact-cardTitle">Export to Folder</div>
                    <div className="pact-cardDesc">Save to a local directory</div>
                  </div>
                </div>
              </MinecraftButton>
            )}
          </div>
        </div>

        {/* Run in Minecraft Section */}
        <div className="pact-section">
          <div className="pact-sectionHeader">
            <FontAwesomeIcon icon={faGlobe} className="pact-sectionIcon" />
            <h2>Run in Minecraft</h2>
          </div>
          <div className="pact-cardGrid">
            <MinecraftButton
              className="pact-actionCard pact-cardMinecraft"
              key="pact-dlFlatWorld"
              theme={this.props.theme}
              onClick={this._downloadFlatWorld}
            >
              <div className="pact-cardContent">
                <div className="pact-cardIconImage">
                  <img
                    alt=""
                    src={
                      CreatorToolsHost.contentRoot +
                      "res/latest/van/serve/resource_pack/textures/blocks/grass_path_side.png"
                    }
                  />
                </div>
                <div className="pact-cardText">
                  <div className="pact-cardTitle">Flat World</div>
                  <div className="pact-cardDesc">
                    Download as a .mcworld file you can open in Minecraft, with flat terrain
                  </div>
                </div>
              </div>
            </MinecraftButton>

            <MinecraftButton
              className="pact-actionCard pact-cardMinecraft"
              key="pact-dlProjectWorld"
              theme={this.props.theme}
              onClick={this._downloadProjectWorld}
            >
              <div className="pact-cardContent">
                <div className="pact-cardIconImage">
                  <img
                    alt=""
                    src={
                      CreatorToolsHost.contentRoot +
                      "res/latest/van/serve/resource_pack/textures/blocks/grass_side_carried.png"
                    }
                  />
                </div>
                <div className="pact-cardText">
                  <div className="pact-cardTitle">Project World</div>
                  <div className="pact-cardDesc">Download as a .mcworld file, with default terrain</div>
                </div>
              </div>
            </MinecraftButton>
          </div>
        </div>
      </div>
    );
  }
}
