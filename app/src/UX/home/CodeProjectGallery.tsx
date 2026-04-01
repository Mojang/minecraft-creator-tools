import React, { Component } from "react";
import CreatorTools from "../../app/CreatorTools";
import "./CodeProjectGallery.css";
import IAppProps from "../appShell/IAppProps";
import IStatus from "../../app/Status";
import IGallery from "../../app/IGallery";
import ProjectTile, { ProjectTileDisplayMode } from "../project/ProjectTile";
import IGalleryItem, { GalleryItemType } from "../../app/IGalleryItem";
import Project from "../../app/Project";
import Log from "../../core/Log";
import Database from "../../minecraft/Database";
import { getThemeColors } from "../hooks/theme/useThemeColors";
import IProjectTheme from "../types/IProjectTheme";

export enum GalleryProjectCommand {
  newProject,
  forkProject,
  ensureProject,
  projectSelect,
}

export enum CodeProjectGalleryMode {
  starters,
  entities,
  codeSnippets,
}

interface ICodeProjectGalleryProps extends IAppProps {
  theme: IProjectTheme;
  gallery: IGallery;
  search?: string;
  view: ProjectTileDisplayMode;
  isSelectable?: boolean;
  filterOn?: GalleryItemType[];
  onGalleryItemCommand: (command: GalleryProjectCommand, project: IGalleryItem) => void;
}

interface ICodeProjectGalleryState {
  loadedProjectHash: string;
  selectedItem?: IGalleryItem;
  mode: CodeProjectGalleryMode;
}

export default class CodeProjectGallery extends Component<ICodeProjectGalleryProps, ICodeProjectGalleryState> {
  private startersElt: React.RefObject<HTMLDivElement>;
  private mobsElt: React.RefObject<HTMLDivElement>;
  private snippetsElt: React.RefObject<HTMLDivElement>;

  constructor(props: ICodeProjectGalleryProps) {
    super(props);

    this.startersElt = React.createRef();
    this.mobsElt = React.createRef();
    this.snippetsElt = React.createRef();

    this._handleStatusAdded = this._handleStatusAdded.bind(this);
    this._handleCommand = this._handleCommand.bind(this);
    this._selectCodeSnippets = this._selectCodeSnippets.bind(this);
    this._selectEntities = this._selectEntities.bind(this);
    this._selectProjectStarters = this._selectProjectStarters.bind(this);

    this.loadProjects = this.loadProjects.bind(this);
    this.getProjectHash = this.getProjectHash.bind(this);

    this.state = {
      loadedProjectHash: this.getProjectHash(),
      selectedItem: undefined,
      mode: CodeProjectGalleryMode.starters,
    };
  }

  _handleStatusAdded(creatorTools: CreatorTools, status: IStatus) {}

  componentDidMount() {
    this.loadProjects();
  }

  async loadProjects() {
    let didLoad = false;

    await this.props.creatorTools.load();

    const projects = this.props.creatorTools.projects;

    for (let i = 0; i < projects.length; i++) {
      const proj = projects[i];

      if (!proj.isLoaded) {
        await proj.loadPreferencesAndFolder();

        Log.assert(proj.isLoaded, "Project is not loaded in CodeProjectGallery.");
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
      mode: CodeProjectGalleryMode.starters,
      selectedItem: this.state.selectedItem,
    });
  }

  _selectEntities() {
    this.setState({
      loadedProjectHash: this.state.loadedProjectHash,
      mode: CodeProjectGalleryMode.entities,
      selectedItem: this.state.selectedItem,
    });
  }

  _selectCodeSnippets() {
    this.setState({
      loadedProjectHash: this.state.loadedProjectHash,
      mode: CodeProjectGalleryMode.codeSnippets,
      selectedItem: this.state.selectedItem,
    });
  }

  getProjectHash() {
    const projects = this.props.creatorTools.projects;
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

    seed += "|" + item.id;

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

    if (project.originalSampleId) {
      seed += "|" + project.originalSampleId;
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

  render() {
    const colors = getThemeColors();
    const snippetGalleries = [];
    const starterGalleries = [];
    const entityGalleries = [];
    const projectGalleries = [];
    let projectGalleriesElt = <></>;
    let starterGalleriesElt = <></>;
    let entityGalleriesElt = <></>;
    let snippetGalleriesElt = <></>;
    let tabsElt = <></>;
    const hasTabs = this.props.search === undefined || this.props.search.length === 0;
    const startersTabId = "pg-tab-starters";
    const entitiesTabId = "pg-tab-entities";
    const snippetsTabId = "pg-tab-snippets";
    const startersPanelId = "pg-tabpanel-starters";
    const entitiesPanelId = "pg-tabpanel-entities";
    const snippetsPanelId = "pg-tabpanel-snippets";

    const gal = this.props.gallery;

    if (hasTabs) {
      let tabsLabel = "Project gallery tabs - ";
      if (this.state.mode === CodeProjectGalleryMode.starters) {
        tabsLabel += "Starters selected";
      } else if (this.state.mode === CodeProjectGalleryMode.entities) {
        tabsLabel += "From a mob selected";
      } else if (this.state.mode === CodeProjectGalleryMode.codeSnippets) {
        tabsLabel += "Code snippets selected";
      }

      tabsElt = (
        <div
          className="pg-tabArea"
          role="tablist"
          aria-label={tabsLabel}
          onKeyDown={(keyboardEvent: React.KeyboardEvent<HTMLDivElement>) => {
            if (keyboardEvent.key === "ArrowRight") {
              if (this.state.mode === CodeProjectGalleryMode.starters && this.mobsElt && this.mobsElt.current) {
                this.mobsElt.current.focus();
                this.mobsElt.current.click();
              } else if (
                this.state.mode === CodeProjectGalleryMode.entities &&
                this.snippetsElt &&
                this.snippetsElt.current
              ) {
                this.snippetsElt.current.focus();
                this.snippetsElt.current.click();
              }
            } else if (keyboardEvent.key === "ArrowLeft") {
              if (this.state.mode === CodeProjectGalleryMode.codeSnippets && this.mobsElt && this.mobsElt.current) {
                this.mobsElt.current.focus();
                this.mobsElt.current.click();
              } else if (
                this.state.mode === CodeProjectGalleryMode.entities &&
                this.startersElt &&
                this.startersElt.current
              ) {
                this.startersElt.current.focus();
                this.startersElt.current.click();
              }
            }
          }}
        >
          <span
            className={this.state.mode === CodeProjectGalleryMode.starters ? "pg-tabButton-selected" : "pg-tabButton"}
            role="tab"
            id={startersTabId}
            onClick={this._selectProjectStarters}
            ref={this.startersElt}
            aria-selected={this.state.mode === CodeProjectGalleryMode.starters}
            aria-controls={startersPanelId}
            tabIndex={this.state.mode === CodeProjectGalleryMode.starters ? 0 : -1}
            style={{
              backgroundColor:
                this.state.mode === CodeProjectGalleryMode.starters ? colors.background3 : colors.background2,
              color: this.state.mode === CodeProjectGalleryMode.starters ? colors.foreground2 : colors.foreground1,
              borderColor: colors.background1,
              borderBottom:
                "1px solid " +
                (this.state.mode === CodeProjectGalleryMode.starters ? colors.background3 : colors.background1),
            }}
          >
            Starters
          </span>
          <span
            className="pg-underline"
            aria-hidden="true"
            style={{
              borderColor: colors.background1,
            }}
          >
            &#160;
          </span>
          <span
            className={this.state.mode === CodeProjectGalleryMode.entities ? "pg-tabButton-selected" : "pg-tabButton"}
            role="tab"
            id={entitiesTabId}
            onClick={this._selectEntities}
            ref={this.mobsElt}
            aria-selected={this.state.mode === CodeProjectGalleryMode.entities}
            aria-controls={entitiesPanelId}
            tabIndex={this.state.mode === CodeProjectGalleryMode.entities ? 0 : -1}
            style={{
              backgroundColor:
                this.state.mode === CodeProjectGalleryMode.entities ? colors.background3 : colors.background2,
              color: this.state.mode === CodeProjectGalleryMode.entities ? colors.foreground2 : colors.foreground1,
              borderColor: colors.background1,
              borderBottom:
                "1px solid " +
                (this.state.mode === CodeProjectGalleryMode.entities ? colors.background3 : colors.background1),
            }}
          >
            From a Mob
          </span>
          <span
            className="pg-underline"
            aria-hidden="true"
            style={{
              borderColor: colors.background1,
            }}
          >
            &#160;
          </span>
          <span
            className={
              this.state.mode === CodeProjectGalleryMode.codeSnippets ? "pg-tabButton-selected" : "pg-tabButton"
            }
            onClick={this._selectCodeSnippets}
            role="tab"
            id={snippetsTabId}
            ref={this.snippetsElt}
            aria-selected={this.state.mode === CodeProjectGalleryMode.codeSnippets}
            aria-controls={snippetsPanelId}
            tabIndex={this.state.mode === CodeProjectGalleryMode.codeSnippets ? 0 : -1}
            style={{
              backgroundColor:
                this.state.mode === CodeProjectGalleryMode.codeSnippets ? colors.background3 : colors.background2,
              color: this.state.mode === CodeProjectGalleryMode.codeSnippets ? colors.foreground2 : colors.foreground1,
              borderColor: colors.background1,
              borderBottom:
                "1px solid " +
                (this.state.mode === CodeProjectGalleryMode.codeSnippets ? colors.background3 : colors.background1),
            }}
          >
            Code Snippets
          </span>
        </div>
      );
    }

    let didPushSnippet = false;
    let didPushStarter = false;

    if (this.props.search || this.state.mode === CodeProjectGalleryMode.codeSnippets) {
      for (let i = 0; i < gal.items.length; i++) {
        const galItem = gal.items[i];

        if (
          Database.itemMatchesSearch(galItem, this.props.search) &&
          (this.props.filterOn === undefined || this.props.filterOn.includes(galItem.type)) &&
          (galItem.type === GalleryItemType.codeSample || galItem.type === GalleryItemType.editorCodeSample)
        ) {
          let view = this.props.view;

          if (this.state.mode === CodeProjectGalleryMode.codeSnippets) {
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
              creatorTools={this.props.creatorTools}
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
            backgroundColor: colors.background3,
            borderColor: colors.background1,
          }}
        >
          {snippetGalleries}
        </div>
      );
    }

    if (this.props.search || this.state.mode === CodeProjectGalleryMode.starters) {
      for (let i = 0; i < gal.items.length; i++) {
        const galItem = gal.items[i];

        if (
          Database.itemMatchesSearch(galItem, this.props.search) &&
          (this.props.filterOn === undefined || this.props.filterOn.includes(galItem.type)) &&
          (galItem.type === GalleryItemType.project ||
            galItem.type === GalleryItemType.editorProject ||
            galItem.type === GalleryItemType.blockType ||
            galItem.type === GalleryItemType.itemType)
        ) {
          const displayOpen = this.state.loadedProjectHash.indexOf("[" + this.getGalleryHash(galItem) + "]") >= 0;

          const projectTile = (
            <ProjectTile
              key={"galitem" + i}
              theme={this.props.theme}
              displayMode={this.props.view}
              isSelectable={this.props.isSelectable}
              isSelected={this.state.selectedItem === galItem}
              onGalleryItemCommand={this._handleCommand}
              displayOpenButton={displayOpen}
              creatorTools={this.props.creatorTools}
              project={galItem}
            />
          );
          starterGalleries.push(projectTile);
          projectGalleries.push(projectTile);

          didPushStarter = true;
        }
      }

      if (starterGalleries.length > 0) {
        starterGalleriesElt = (
          <div
            className="pg-binWrap"
            style={{
              backgroundColor: colors.background3,
              borderColor: colors.background1,
            }}
          >
            {starterGalleries}
          </div>
        );
      }
    }

    if (this.props.search || this.state.mode === CodeProjectGalleryMode.entities) {
      for (let i = 0; i < gal.items.length; i++) {
        const galItem = gal.items[i];

        if (
          Database.itemMatchesSearch(galItem, this.props.search) &&
          (this.props.filterOn === undefined || this.props.filterOn.includes(galItem.type)) &&
          galItem.type === GalleryItemType.entityType
        ) {
          const displayOpen = this.state.loadedProjectHash.indexOf("[" + this.getGalleryHash(galItem) + "]") >= 0;

          const projectTile = (
            <ProjectTile
              key={"galitem" + i}
              theme={this.props.theme}
              displayMode={this.props.view}
              isSelectable={this.props.isSelectable}
              isSelected={this.state.selectedItem === galItem}
              onGalleryItemCommand={this._handleCommand}
              displayOpenButton={displayOpen}
              creatorTools={this.props.creatorTools}
              project={galItem}
            />
          );
          entityGalleries.push(projectTile);
          projectGalleries.push(projectTile);

          didPushStarter = true;
        }
      }

      if (entityGalleries.length > 0) {
        entityGalleriesElt = (
          <div
            className="pg-binWrap"
            style={{
              backgroundColor: colors.background3,
              borderColor: colors.background1,
            }}
          >
            {entityGalleries}
          </div>
        );
      }
    }

    if (!hasTabs && projectGalleries.length > 0) {
      projectGalleriesElt = (
        <div
          className="pg-binWrap"
          style={{
            backgroundColor: colors.background3,
            borderColor: colors.background1,
          }}
        >
          {projectGalleries}
        </div>
      );
    }

    const galleryPanels = hasTabs ? (
      <>
        <div
          role="tabpanel"
          id={startersPanelId}
          aria-labelledby={startersTabId}
          hidden={this.state.mode !== CodeProjectGalleryMode.starters}
        >
          {starterGalleriesElt}
        </div>
        <div
          role="tabpanel"
          id={entitiesPanelId}
          aria-labelledby={entitiesTabId}
          hidden={this.state.mode !== CodeProjectGalleryMode.entities}
        >
          {entityGalleriesElt}
        </div>
        <div
          role="tabpanel"
          id={snippetsPanelId}
          aria-labelledby={snippetsTabId}
          hidden={this.state.mode !== CodeProjectGalleryMode.codeSnippets}
        >
          {snippetGalleriesElt}
        </div>
      </>
    ) : (
      <>
        {projectGalleriesElt}
        {snippetGalleriesElt}
      </>
    );

    return (
      <div className="pg-outer">
        <div className="pg-tabsTop">
          {tabsElt}
          <div className="pg-tabsFiller" style={{ borderColor: colors.background1 }}>
            &#160;
          </div>
        </div>
        {galleryPanels}
      </div>
    );
  }
}
