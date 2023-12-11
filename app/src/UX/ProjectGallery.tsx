import { Component } from "react";
import Carto from "./../app/Carto";
import "./ProjectGallery.css";
import IAppProps from "./IAppProps";
import Status from "../app/Status";
import IGallery from "../app/IGallery";
import ProjectTile, { ProjectTileDisplayMode } from "./ProjectTile";
import IGalleryProject, { GalleryProjectType } from "../app/IGalleryProject";
import { ThemeInput } from "@fluentui/react-northstar";
import Project from "../app/Project";
import Log from "../core/Log";

export enum GalleryProjectCommand {
  newProject,
  forkProject,
  ensureProject,
  projectSelect,
}

interface IProjectGalleryProps extends IAppProps {
  theme: ThemeInput<any>;
  gallery: IGallery;
  search?: string;
  view: ProjectTileDisplayMode;
  isSelectable?: boolean;
  filterOn?: GalleryProjectType;
  onGalleryItemCommand: (command: GalleryProjectCommand, project: IGalleryProject) => void;
}

interface IProjectGalleryState {
  loadedProjectHash: string;
  selectedItem?: IGalleryProject;
}

export default class ProjectGallery extends Component<IProjectGalleryProps, IProjectGalleryState> {
  constructor(props: IProjectGalleryProps) {
    super(props);

    this._handleStatusAdded = this._handleStatusAdded.bind(this);
    this._handleCommand = this._handleCommand.bind(this);

    this.loadProjects = this.loadProjects.bind(this);
    this.getProjectHash = this.getProjectHash.bind(this);

    this.state = {
      loadedProjectHash: this.getProjectHash(),
      selectedItem: undefined,
    };
  }

  _handleStatusAdded(carto: Carto, status: Status) {}

  componentDidMount() {
    this.loadProjects();
  }

  async loadProjects() {
    let didLoad = false;

    await this.props.carto.load();

    const projects = this.props.carto.projects;

    for (let i = 0; i < projects.length; i++) {
      const proj = projects[i];

      if (!proj.isLoaded) {
        await proj.loadFromFile();

        Log.assert(proj.isLoaded, "Project is not loaded in ProjectGallery.");
        didLoad = true;
      }
    }

    if (didLoad) {
      const hash = this.getProjectHash();
      this.setState({
        loadedProjectHash: hash,
      });
    }
  }

  getProjectHash() {
    const projects = this.props.carto.projects;
    let projectHash = "";

    for (let i = 0; i < projects.length; i++) {
      const proj = projects[i];

      if (proj.isLoaded) {
        if (proj.originalGitHubOwner || proj.originalGitHubRepoName) {
          projectHash += "[" + this.getProjectOriginalHash(proj) + "]";
        }
      }
    }

    return projectHash;
  }

  getGalleryHash(item: IGalleryProject) {
    let seed = item.gitHubOwner + "|" + item.gitHubRepoName;

    if (item.gitHubBranch) {
      seed += "|" + item.gitHubBranch;
    }

    if (item.gitHubFolder) {
      seed += "|" + item.gitHubFolder;
    }

    return seed;
  }

  getProjectOriginalHash(project: Project) {
    let seed = project.originalGitHubOwner + "|" + project.originalGitHubRepoName;

    if (project.originalGitHubBranch) {
      seed += "|" + project.originalGitHubBranch;
    }

    if (project.originalGitHubFolder) {
      seed += "|" + project.originalGitHubFolder;
    }

    return seed;
  }

  _handleCommand(command: GalleryProjectCommand, project: IGalleryProject) {
    if (this.props.isSelectable) {
      this.setState({
        loadedProjectHash: this.state.loadedProjectHash,
        selectedItem: project,
      });
    }

    this.props.onGalleryItemCommand(command, project);
  }

  projectMatchesSearch(galProject: IGalleryProject) {
    if (!this.props.search || this.props.search.length < 3) {
      return true;
    }

    const searchKey = this.props.search.toLowerCase();

    if (
      (galProject.title && galProject.title.toLowerCase().indexOf(searchKey) >= 0) ||
      (galProject.description && galProject.description.toLowerCase().indexOf(searchKey) >= 0)
    ) {
      return true;
    }

    return false;
  }

  render() {
    const snippetGalleries = [];
    const projectGalleries = [];

    const gal = this.props.gallery;

    if (this.props.filterOn === undefined) {
      snippetGalleries.push(
        <div key="codeSnipp" className="pg-divider">
          Code Snippets
        </div>
      );
      projectGalleries.push(
        <div key="codeSamp" className="pg-divider">
          New Project Starters
        </div>
      );
    }

    let didPushSnippet = false;
    let didPushStarter = false;

    for (let i = 0; i < gal.projects.length; i++) {
      const galItem = gal.projects[i];

      if (
        this.projectMatchesSearch(galItem) &&
        (this.props.filterOn === undefined || this.props.filterOn === galItem.type) &&
        galItem.type === GalleryProjectType.codeSample
      ) {
        snippetGalleries.push(
          <ProjectTile
            key={"csitem" + i}
            theme={this.props.theme}
            displayMode={ProjectTileDisplayMode.smallCodeSample}
            isSelectable={this.props.isSelectable}
            onGalleryItemCommand={this._handleCommand}
            isSelected={this.state.selectedItem === galItem}
            displayOpenButton={false}
            carto={this.props.carto}
            project={galItem}
          />
        );

        didPushSnippet = true;
      }
    }

    for (let i = 0; i < gal.projects.length; i++) {
      const galItem = gal.projects[i];

      if (
        this.projectMatchesSearch(galItem) &&
        (this.props.filterOn === undefined || this.props.filterOn === galItem.type) &&
        (galItem.type === GalleryProjectType.project ||
          galItem.type === GalleryProjectType.blockType ||
          galItem.type === GalleryProjectType.entityType)
      ) {
        const displayOpen = this.state.loadedProjectHash.indexOf("[" + this.getGalleryHash(galItem) + "]") >= 0;

        projectGalleries.push(
          <ProjectTile
            key={"galitem" + i}
            theme={this.props.theme}
            displayMode={this.props.view}
            isSelectable={this.props.isSelectable}
            isSelected={this.state.selectedItem === galItem}
            onGalleryItemCommand={this._handleCommand}
            displayOpenButton={displayOpen}
            carto={this.props.carto}
            project={galItem}
          />
        );

        didPushStarter = true;
      }
    }

    if (!didPushSnippet) {
      snippetGalleries.push(<div>No snippets found.</div>);
    }

    if (!didPushStarter) {
      projectGalleries.push(<div>No starters found.</div>);
    }

    return (
      <div className="pg-outer">
        <div className="pg-projectWrap">{projectGalleries}</div>
        <div className="pg-snippetWrap">{snippetGalleries}</div>
      </div>
    );
  }
}
