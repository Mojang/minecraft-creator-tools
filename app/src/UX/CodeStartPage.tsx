import { Component, SyntheticEvent } from "react";
import "./CodeStartPage.css";
import { Button, FormInput, InputProps, ThemeInput } from "@fluentui/react-northstar";
import IAppProps from "./IAppProps";
import { AppMode } from "./App";
import Project from "./../app/Project";
import ProjectGallery, { GalleryProjectCommand } from "./ProjectGallery";
import IGalleryProject from "../app/IGalleryProject";
import IGallery from "../app/IGallery";
import AppServiceProxy from "../core/AppServiceProxy";
import Database from "../minecraft/Database";
import Log from "../core/Log";
import { ProjectTileDisplayMode } from "./ProjectTile";

enum CodeStartPageMode {
  gallery = 0,
  addingProject = 1,
}

interface ICodeStartPageProps extends IAppProps {
  project: Project | null;
  theme: ThemeInput<any>;
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
  newProject: IGalleryProject | undefined;
  search: string | undefined;
}

export default class CodeStartPage extends Component<ICodeStartPageProps, ICodeStartPageState> {
  constructor(props: ICodeStartPageProps) {
    super(props);

    this._handleProjectGalleryCommand = this._handleProjectGalleryCommand.bind(this);
    this._handleNewProjectName = this._handleNewProjectName.bind(this);
    this._handleNewSearch = this._handleNewSearch.bind(this);
    this._messageUpdater = this._messageUpdater.bind(this);
    this._onGalleryLoaded = this._onGalleryLoaded.bind(this);
    this._createProject = this._createProject.bind(this);

    if (this.props.carto.galleryLoaded) {
      this.state = {
        loadingMessage: undefined,
        additionalLoadingMessage: undefined,
        newProjectName: "MinecraftProject",
        newProject: undefined,
        mode: CodeStartPageMode.gallery,
        gallery: this.props.carto.gallery,
        search: undefined,
      };
    } else {
      this._loadGallery();
    }
  }

  private async _loadGallery() {
    this.props.carto.onGalleryLoaded.subscribe(this._onGalleryLoaded);
    await this.props.carto.loadGallery();
    this._onGalleryLoaded();
    await Database.loadSnippets();
    this.forceUpdate();
  }

  private _onGalleryLoaded() {
    this.setState({
      gallery: this.props.carto.gallery,
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

  private async _handleProjectGalleryCommand(command: GalleryProjectCommand, project: IGalleryProject) {
    switch (command) {
      case GalleryProjectCommand.projectSelect:
      case GalleryProjectCommand.newProject:
        this.setState({
          loadingMessage: this.state.loadingMessage,
          additionalLoadingMessage: this.state.additionalLoadingMessage,
          newProjectName: this.state.newProjectName,
          newProject: project,
          mode: this.state.mode,
          gallery: this.props.carto.gallery,
        });

        break;
    }
  }

  _handleNewSearch(
    event: SyntheticEvent<HTMLElement, Event> | React.KeyboardEvent<Element> | null,
    data: (InputProps & { value: string }) | undefined
  ) {
    if (event === null || data === null || data === undefined || !this.state) {
      return;
    }

    const newSearch = data.value;

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

  _handleNewProjectName(
    event: SyntheticEvent<HTMLElement, Event> | React.KeyboardEvent<Element> | null,
    data: (InputProps & { value: string }) | undefined
  ) {
    if (event === null || data === null || data === undefined || !this.state) {
      return;
    }

    const newMin = data.value;

    this.setState({
      loadingMessage: this.state.loadingMessage,
      additionalLoadingMessage: this.state.additionalLoadingMessage,
      newProjectName: newMin,
      newProject: this.state.newProject,
      mode: this.state.mode,
      gallery: this.props.carto.gallery,
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
      Log.message("Please specify a new project name.");
    }
  }

  render() {
    if (!this.state || !this.state.gallery) {
      return <div className="csp-outer">Loading...</div>;
    }

    let message = <></>;
    let additionalText = "";

    let mainMessage = this.state.loadingMessage;

    if (this.props.forceNewProject && !mainMessage) {
      mainMessage = "To start a new Minecraft project, set a name and select a Minecraft template.";
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

    return (
      <div className="csp-outer">
        {message}
        <div className="csp-projectDetails">
          <div className="csp-newProjectName">
            <div className="csp-npnLabel">New Project Name:</div>
            <FormInput
              id="test"
              className="csp-input"
              placeholder={"Project name"}
              value={this.state.newProjectName}
              onChange={this._handleNewProjectName}
            />
          </div>
          <div className="csp-goButtonArea">
            <Button onClick={this._createProject}>Create</Button>
          </div>
        </div>
        <div className="csp-search-area">
          <FormInput
            id="projSearch"
            className="csp-search"
            defaultValue={""}
            placeholder="Search for projects"
            value={this.state.search}
            onChange={this._handleNewSearch}
          />
        </div>
        <div className="csp-gallery">
          <ProjectGallery
            theme={this.props.theme}
            view={ProjectTileDisplayMode.smallCodeSample}
            isSelectable={true}
            search={this.state.search}
            onGalleryItemCommand={this._handleProjectGalleryCommand}
            carto={this.props.carto}
            gallery={this.state.gallery}
          />
        </div>
      </div>
    );
  }
}
