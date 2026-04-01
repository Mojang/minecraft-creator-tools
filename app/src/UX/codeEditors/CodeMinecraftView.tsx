import { Component } from "react";
import "./CodeMinecraftView.css";
import { TextField } from "@mui/material";
import IAppProps from "../appShell/IAppProps";
import { AppMode } from "../appShell/App";
import Project from "../../app/Project";
import CodeProjectGallery, { GalleryProjectCommand } from "../home/CodeProjectGallery";
import IGalleryItem from "../../app/IGalleryItem";
import IGallery from "../../app/IGallery";
import AppServiceProxy from "../../core/AppServiceProxy";
import Log from "../../core/Log";
import { ProjectTileDisplayMode } from "../project/ProjectTile";
import IProjectTheme from "../types/IProjectTheme";

enum CodeMinecraftViewMode {
  gallery = 0,
  addingProject = 1,
}

interface ICodeMinecraftViewProps extends IAppProps {
  project: Project | null;
  theme: IProjectTheme;
  forceNewProject: boolean;
  onModeChangeRequested?: (mode: AppMode) => void;
  onProjectSelected?: (project: Project) => void;
}

interface ICodeMinecraftViewState {
  mode: CodeMinecraftViewMode;
  loadingMessage: string | undefined;
  additionalLoadingMessage: string | undefined;
  gallery: IGallery | undefined;
  newProjectName: string | undefined;
  search: string | undefined;
}

export default class CodeMinecraftView extends Component<ICodeMinecraftViewProps, ICodeMinecraftViewState> {
  constructor(props: ICodeMinecraftViewProps) {
    super(props);

    this._handleProjectGalleryCommand = this._handleProjectGalleryCommand.bind(this);
    this._handleNewProjectName = this._handleNewProjectName.bind(this);
    this._handleNewSearch = this._handleNewSearch.bind(this);
    this._messageUpdater = this._messageUpdater.bind(this);
    this._onGalleryLoaded = this._onGalleryLoaded.bind(this);

    if (this.props.creatorTools.galleryLoaded) {
      this.state = {
        loadingMessage: undefined,
        additionalLoadingMessage: undefined,
        newProjectName: "MinecraftProject",
        mode: CodeMinecraftViewMode.gallery,
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
        if (this.state.newProjectName !== undefined && this.state.newProjectName.length > 1) {
          await AppServiceProxy.sendAsync(
            "startNewProject",
            JSON.stringify({
              name: this.state.newProjectName,
              galleryProject: project,
            })
          );

          AppServiceProxy.sendAsync("closeAllStartPages", "");
        } else {
          Log.message("Please specify a new project name.");
        }
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
      mode: this.state.mode,
      gallery: this.props.creatorTools.gallery,
    });
  }

  render() {
    if (!this.state || !this.state.gallery) {
      return <div className="cmv-outer">Loading...</div>;
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
        <div className="cmv-loading">
          <div className="cmv-loading-main">{mainMessage}</div>
          <div className="cmv-loading-additional">{additionalText}</div>
        </div>
      );
    }

    return (
      <div className="cmv-outer">
        {message}
        <div className="cmv-newProjectName">
          <div className="cmv-npnLabel">New Project Name:</div>
          <TextField
            id="test"
            className="mificl-input"
            placeholder="Project name"
            value={this.state.newProjectName || ""}
            onChange={this._handleNewProjectName}
            size="small"
          />
        </div>
        <div className="cmv-search-area">
          <TextField
            id="projSearch"
            className="cmv-search"
            placeholder="Search for projects"
            value={this.state.search || ""}
            onChange={this._handleNewSearch}
            size="small"
          />
        </div>
        <div className="cmv-gallery">
          <CodeProjectGallery
            theme={this.props.theme}
            view={ProjectTileDisplayMode.smallCodeSample}
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
