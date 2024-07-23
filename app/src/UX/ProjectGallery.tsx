import { Component } from "react";
import Carto from "./../app/Carto";
import "./ProjectGallery.css";
import IAppProps from "./IAppProps";
import IStatus from "../app/Status";
import IGallery from "../app/IGallery";
import ProjectTile, { ProjectTileDisplayMode } from "./ProjectTile";
import IGalleryItem, { GalleryItemType } from "../app/IGalleryItem";
import { Button, ThemeInput } from "@fluentui/react-northstar";
import Project from "../app/Project";
import Log from "../core/Log";

export enum GalleryProjectCommand {
  newProject,
  forkProject,
  ensureProject,
  projectSelect,
}

export enum ProjectGalleryMode {
  starters,
  codeSnippets,
}

interface IProjectGalleryProps extends IAppProps {
  theme: ThemeInput<any>;
  gallery: IGallery;
  search?: string;
  view: ProjectTileDisplayMode;
  isSelectable?: boolean;
  filterOn?: GalleryItemType[];
  onGalleryItemCommand: (command: GalleryProjectCommand, project: IGalleryItem) => void;
}

interface IProjectGalleryState {
  loadedProjectHash: string;
  selectedItem?: IGalleryItem;
  mode: ProjectGalleryMode;
}

export default class ProjectGallery extends Component<IProjectGalleryProps, IProjectGalleryState> {
  constructor(props: IProjectGalleryProps) {
    super(props);

    this._handleStatusAdded = this._handleStatusAdded.bind(this);
    this._handleCommand = this._handleCommand.bind(this);
    this._selectCodeSnippets = this._selectCodeSnippets.bind(this);
    this._selectProjectStarters = this._selectProjectStarters.bind(this);

    this.loadProjects = this.loadProjects.bind(this);
    this.getProjectHash = this.getProjectHash.bind(this);

    this.state = {
      loadedProjectHash: this.getProjectHash(),
      selectedItem: undefined,
      mode: ProjectGalleryMode.starters,
    };
  }

  _handleStatusAdded(carto: Carto, status: IStatus) {}

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
        mode: this.state.mode,
      });
    }
  }

  _selectProjectStarters() {
    this.setState({
      loadedProjectHash: this.state.loadedProjectHash,
      mode: ProjectGalleryMode.starters,
      selectedItem: this.state.selectedItem,
    });
  }

  _selectCodeSnippets() {
    this.setState({
      loadedProjectHash: this.state.loadedProjectHash,
      mode: ProjectGalleryMode.codeSnippets,
      selectedItem: this.state.selectedItem,
    });
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

  getGalleryHash(item: IGalleryItem) {
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

  _handleCommand(command: GalleryProjectCommand, project: IGalleryItem) {
    if (this.props.isSelectable) {
      this.setState({
        loadedProjectHash: this.state.loadedProjectHash,
        selectedItem: project,
      });
    }

    this.props.onGalleryItemCommand(command, project);
  }

  projectMatchesSearch(galProject: IGalleryItem) {
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
    let projectGalleriesElt = <></>;
    let snippetGalleriesElt = <></>;
    let tabsElt = <></>;

    const gal = this.props.gallery;

    if (this.props.search === undefined) {
      tabsElt = (
        <div className="pg-tabArea" role="tablist">
          <Button
            className="pg-tabButton"
            role="tab"
            onClick={this._selectProjectStarters}
            aria-selected={this.state.mode === ProjectGalleryMode.starters}
            style={{
              backgroundColor:
                this.state.mode === ProjectGalleryMode.starters
                  ? this.props.theme.siteVariables?.colorScheme.brand.background3
                  : this.props.theme.siteVariables?.colorScheme.brand.background2,
              color:
                this.state.mode === ProjectGalleryMode.starters
                  ? this.props.theme.siteVariables?.colorScheme.brand.foreground2
                  : this.props.theme.siteVariables?.colorScheme.brand.foreground1,
              borderColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
              borderBottom:
                "1px solid " +
                (this.state.mode === ProjectGalleryMode.starters
                  ? this.props.theme.siteVariables?.colorScheme.brand.background3
                  : this.props.theme.siteVariables?.colorScheme.brand.background1),
            }}
          >
            Project Starters
          </Button>
          <div
            className="pg-underline"
            aria-hidden="true"
            style={{
              borderColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
            }}
          >
            &#160;
          </div>
          <Button
            className="pg-tabButton"
            onClick={this._selectCodeSnippets}
            role="tab"
            aria-selected={this.state.mode === ProjectGalleryMode.codeSnippets}
            style={{
              backgroundColor:
                this.state.mode === ProjectGalleryMode.codeSnippets
                  ? this.props.theme.siteVariables?.colorScheme.brand.background3
                  : this.props.theme.siteVariables?.colorScheme.brand.background2,
              color:
                this.state.mode === ProjectGalleryMode.codeSnippets
                  ? this.props.theme.siteVariables?.colorScheme.brand.foreground2
                  : this.props.theme.siteVariables?.colorScheme.brand.foreground1,
              borderColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
              borderBottom:
                "1px solid " +
                (this.state.mode === ProjectGalleryMode.codeSnippets
                  ? this.props.theme.siteVariables?.colorScheme.brand.background3
                  : this.props.theme.siteVariables?.colorScheme.brand.background1),
            }}
          >
            Code Snippets
          </Button>
          <div
            className="pg-underline pg-underlineLong"
            style={{
              borderColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
            }}
          >
            &#160;
          </div>
        </div>
      );
    }

    let didPushSnippet = false;
    let didPushStarter = false;

    if (this.props.search || this.state.mode === ProjectGalleryMode.codeSnippets) {
      for (let i = 0; i < gal.items.length; i++) {
        const galItem = gal.items[i];

        if (
          this.projectMatchesSearch(galItem) &&
          (this.props.filterOn === undefined || this.props.filterOn.includes(galItem.type)) &&
          (galItem.type === GalleryItemType.codeSample || galItem.type === GalleryItemType.editorCodeSample)
        ) {
          let view = this.props.view;

          if (this.state.mode === ProjectGalleryMode.codeSnippets) {
            view = ProjectTileDisplayMode.smallCodeSample;
          }

          snippetGalleries.push(
            <ProjectTile
              key={"csitem" + i}
              theme={this.props.theme}
              displayMode={view}
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

      let binClassName = "pg-binWrap";

      if (!didPushSnippet && !didPushStarter) {
        snippetGalleries.push(<div className="pg-notFound">No snippets or starters found.</div>);
        binClassName += " pg-binWrap-empty";
      }

      snippetGalleriesElt = (
        <div
          className={binClassName}
          style={{
            backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background3,
            borderColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
          }}
        >
          {snippetGalleries}
        </div>
      );
    }

    if (this.props.search || this.state.mode === ProjectGalleryMode.starters) {
      for (let i = 0; i < gal.items.length; i++) {
        const galItem = gal.items[i];

        if (
          this.projectMatchesSearch(galItem) &&
          (this.props.filterOn === undefined || this.props.filterOn.includes(galItem.type)) &&
          (galItem.type === GalleryItemType.project ||
            galItem.type === GalleryItemType.editorProject ||
            galItem.type === GalleryItemType.blockType ||
            galItem.type === GalleryItemType.entityType)
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

      if (projectGalleries.length > 0) {
        projectGalleriesElt = (
          <div
            className="pg-binWrap"
            style={{
              backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background3,
              borderColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
            }}
          >
            {projectGalleries}
          </div>
        );
      }
    }

    return (
      <div className="pg-outer">
        {tabsElt}
        {projectGalleriesElt}
        {snippetGalleriesElt}
      </div>
    );
  }
}
