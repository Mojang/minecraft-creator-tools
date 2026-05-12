import { Component } from "react";
import "./CodeStartPage.css";
import { Button, TextField } from "@mui/material";
import IAppProps from "../appShell/IAppProps";
import { AppMode } from "../appShell/App";
import Project from "../../app/Project";
import CodeProjectGallery, { GalleryProjectCommand } from "./CodeProjectGallery";
import IGalleryItem from "../../app/IGalleryItem";
import IGallery from "../../app/IGallery";
import AppServiceProxy from "../../core/AppServiceProxy";
import Log from "../../core/Log";
import { ProjectTileDisplayMode } from "../project/ProjectTile";
import IProjectTheme from "../types/IProjectTheme";
import { WithLocalizationProps, withLocalization } from "../withLocalization";

enum CodeStartPageMode {
  gallery = 0,
  addingProject = 1,
}

interface ICodeStartPageProps extends IAppProps, WithLocalizationProps {
  project: Project | null;
  theme: IProjectTheme;
  forceNewProject: boolean;
  onModeChangeRequested?: (mode: AppMode) => void;
  onProjectSelected?: (project: Project) => void;
}

interface ICodeStartPageState {
  mode: CodeStartPageMode;
  loadingMessage: string | undefined;
  additionalLoadingMessage: string | undefined;
  gallery: IGallery | undefined;
  newProjectName: string | undefined;
  userModifiedName: boolean; // Track if user has manually typed a name
  newProject: IGalleryItem | undefined;
  search: string | undefined;
}

class CodeStartPage extends Component<ICodeStartPageProps, ICodeStartPageState> {
  constructor(props: ICodeStartPageProps) {
    super(props);

    this._handleProjectGalleryCommand = this._handleProjectGalleryCommand.bind(this);
    this._handleNewProjectName = this._handleNewProjectName.bind(this);
    this._handleNewSearch = this._handleNewSearch.bind(this);
    this._messageUpdater = this._messageUpdater.bind(this);
    this._onGalleryLoaded = this._onGalleryLoaded.bind(this);
    this._createProject = this._createProject.bind(this);

    if (this.props.creatorTools.galleryLoaded) {
      this.state = {
        loadingMessage: undefined,
        additionalLoadingMessage: undefined,
        newProjectName: "MinecraftProject",
        userModifiedName: false,
        newProject: undefined,
        mode: CodeStartPageMode.gallery,
        gallery: this.props.creatorTools.gallery,
        search: undefined,
      };
    } else {
      this._loadGallery();
    }
  }

  private async _loadGallery() {
    if (!this.props.creatorTools.onGalleryLoaded.has(this._onGalleryLoaded)) {
      this.props.creatorTools.onGalleryLoaded.subscribe(this._onGalleryLoaded);
    }

    await this.props.creatorTools.loadGallery();
    this._onGalleryLoaded();

    // add any async loading code here.
    this.forceUpdate();
  }

  private _onGalleryLoaded() {
    this.setState({
      gallery: this.props.creatorTools.gallery,
    });
  }

  private async _messageUpdater(additionalMessage: string) {
    let message = this.state.loadingMessage;

    if (!message) {
      message = "Loading.";
    }

    this.setState({
      mode: this.state.mode,
      gallery: this.state.gallery,
      loadingMessage: message,
      additionalLoadingMessage: additionalMessage,
    });
  }


  private async _handleProjectGalleryCommand(command: GalleryProjectCommand, project: IGalleryItem) {
    switch (command) {
      case GalleryProjectCommand.projectSelect:
      case GalleryProjectCommand.newProject:
      case GalleryProjectCommand.ensureProject:
        // Auto-suggest a project name based on template if user hasn't manually typed one
        let suggestedName = this.state.newProjectName;
        if (!this.state.userModifiedName && project.title) {
          // Convert template title to a valid project name (PascalCase, no spaces)
          suggestedName = project.title
            .replace(/[^a-zA-Z0-9\s]/g, "")
            .split(/\s+/)
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join("");
        }

        this.setState({
          loadingMessage: this.state.loadingMessage,
          additionalLoadingMessage: this.state.additionalLoadingMessage,
          newProjectName: suggestedName,
          userModifiedName: this.state.userModifiedName,
          newProject: project,
          mode: this.state.mode,
          gallery: this.props.creatorTools.gallery,
        });

        break;
    }
  }

  _handleNewSearch(event: React.ChangeEvent<HTMLInputElement>) {
    if (!this.state) {
      return;
    }

    const newSearch = event.target.value;

    this.setState({
      mode: this.state.mode,
      loadingMessage: this.state.loadingMessage,
      additionalLoadingMessage: this.state.additionalLoadingMessage,
      newProject: this.state.newProject,
      gallery: this.state.gallery,
      newProjectName: this.state.newProjectName,
      search: newSearch,
    });
  }

  _handleNewProjectName(event: React.ChangeEvent<HTMLInputElement>) {
    if (!this.state) {
      return;
    }

    const newMin = event.target.value;

    this.setState({
      loadingMessage: this.state.loadingMessage,
      additionalLoadingMessage: this.state.additionalLoadingMessage,
      newProjectName: newMin,
      userModifiedName: true, // User has manually edited the name
      newProject: this.state.newProject,
      mode: this.state.mode,
      gallery: this.props.creatorTools.gallery,
    });
  }

  async _createProject() {
    if (this.state.newProjectName !== undefined && this.state.newProjectName.length > 1) {
      await AppServiceProxy.sendAsync(
        "startNewProject",
        JSON.stringify({
          name: this.state.newProjectName,
          galleryProject: this.state.newProject,
        })
      );

      AppServiceProxy.sendAsync("closeAllStartPages", "");
    } else {
      Log.message(this.props.intl.formatMessage({ id: "code_start.specify_name" }));
    }
  }

  render() {
    if (!this.state || !this.state.gallery) {
      return <div className="csp-outer">{this.props.intl.formatMessage({ id: "code_start.loading" })}</div>;
    }

    let message = <></>;
    let additionalText = "";

    let mainMessage = this.state.loadingMessage;

    if (this.props.forceNewProject && !mainMessage) {
      mainMessage = this.props.intl.formatMessage({ id: "code_start.new_project_prompt" });
    }

    if (this.state.additionalLoadingMessage) {
      additionalText = this.state.additionalLoadingMessage;
    }

    if (this.state.loadingMessage || this.props.forceNewProject) {
      message = (
        <div className="csp-loading">
          <div className="csp-loading-main">{mainMessage}</div>
          <div className="csp-loading-additional">{additionalText}</div>
        </div>
      );
    }

    // Determine if create button should be enabled
    const canCreate = this.state.newProjectName && this.state.newProjectName.length > 1 && this.state.newProject;

    return (
      <div className="csp-outer">
        <div className="csp-header">
          <div className="csp-header-content">
            <h1 className="csp-title">{this.props.intl.formatMessage({ id: "code_start.title" })}</h1>
            {message}
          </div>
        </div>
        <div className="csp-projectDetails">
          <div className="csp-newProjectName">
            <TextField
              id="projectNameInput"
              className="csp-input"
              label={this.props.intl.formatMessage({ id: "code_start.project_name" })}
              placeholder={this.props.intl.formatMessage({ id: "code_start.project_name_placeholder" })}
              value={this.state.newProjectName || ""}
              onChange={this._handleNewProjectName}
              size="small"
              fullWidth
            />
          </div>
          {canCreate && (
            <div className="csp-goButtonArea">
              <Button
                variant="contained"
                className="csp-createButton"
                onClick={this._createProject}
                title={this.props.intl.formatMessage({ id: "code_start.create_title" })}
              >
                {this.props.intl.formatMessage({ id: "code_start.create" })}
              </Button>
            </div>
          )}
          <div className="csp-searchArea">
            <TextField
              id="projSearch"
              className="csp-search"
              placeholder={this.props.intl.formatMessage({ id: "code_start.search_placeholder" })}
              value={this.state.search || ""}
              onChange={this._handleNewSearch}
              size="small"
            />
          </div>
        </div>
        <div className="csp-gallery">
          <CodeProjectGallery
            theme={this.props.theme}
            view={ProjectTileDisplayMode.smallCodeSample}
            isSelectable={true}
            search={this.state.search}
            onGalleryItemCommand={this._handleProjectGalleryCommand}
            creatorTools={this.props.creatorTools}
            gallery={this.state.gallery}
          />
        </div>
      </div>
    );
  }
}

export default withLocalization(CodeStartPage);
