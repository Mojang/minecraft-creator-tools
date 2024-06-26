import { Component, SyntheticEvent } from "react";
import IAppProps from "./IAppProps";
import Project from "../app/Project";
import "./AddGitHubReference.css";
import GitHubManager from "../github/GitHubManager";
import { InputProps, Input, Accordion, ThemeInput } from "@fluentui/react-northstar";
import { GitHubPropertyType } from "./ProjectPropertyEditor";
import IGalleryItem, { GalleryItemType } from "../app/IGalleryItem";
import ProjectTile, { ProjectTileDisplayMode } from "./ProjectTile";
import { GalleryProjectCommand } from "./ProjectGallery";
import IGallery from "../app/IGallery";

interface IAddGitHubReferenceProps extends IAppProps {
  project: Project;
  theme: ThemeInput<any>;
  onGitHubProjectUpdated: (propertyType: GitHubPropertyType, value?: string) => void;
}

interface IAddGitHubReferenceState {
  gitHub: GitHubManager | undefined;
  selectedProject?: IGalleryItem;
  gallery: IGallery | undefined;
}

export default class AddGitHubReference extends Component<IAddGitHubReferenceProps, IAddGitHubReferenceState> {
  constructor(props: IAddGitHubReferenceProps) {
    super(props);

    this._handleGalleryItemCommand = this._handleGalleryItemCommand.bind(this);
    this._handleOwnerUpdate = this._handleOwnerUpdate.bind(this);
    this._handleProjectUpdate = this._handleProjectUpdate.bind(this);
    this._onGalleryLoaded = this._onGalleryLoaded.bind(this);

    this.state = {
      gitHub: this.props.carto.anonGitHub,
      gallery: this.props.carto.gallery,
    };

    if (!this.props.carto.gallery) {
      this.props.carto.onGalleryLoaded.subscribe(this._onGalleryLoaded);
      this.props.carto.loadGallery();
    }
  }

  private _onGalleryLoaded() {
    this.setState({
      gitHub: this.props.carto.anonGitHub,
      gallery: this.props.carto.gallery,
    });
  }

  _handleGalleryItemCommand(command: GalleryProjectCommand, project: IGalleryItem) {
    if (this.props && this.props.onGitHubProjectUpdated !== undefined) {
      this.props.onGitHubProjectUpdated(GitHubPropertyType.owner, project.gitHubOwner);
      this.props.onGitHubProjectUpdated(GitHubPropertyType.mode, "existing");
      this.props.onGitHubProjectUpdated(GitHubPropertyType.repoName, project.gitHubRepoName);
      this.props.onGitHubProjectUpdated(GitHubPropertyType.branch, project.gitHubBranch);
      this.props.onGitHubProjectUpdated(GitHubPropertyType.folder, project.gitHubFolder);
      this.props.onGitHubProjectUpdated(GitHubPropertyType.title, project.title);

      this.setState({
        gitHub: this.state.gitHub,
        selectedProject: project,
      });
    }
  }

  _handleOwnerUpdate(e: SyntheticEvent, data: (InputProps & { value: string }) | undefined) {
    if (data === undefined || this.props.project === null || this.state == null) {
      return;
    }

    if (this.props && this.props.onGitHubProjectUpdated !== undefined) {
      this.props.onGitHubProjectUpdated(GitHubPropertyType.mode, "new");
      this.props.onGitHubProjectUpdated(GitHubPropertyType.repoName, data.value);
    }
  }

  _handleProjectUpdate(e: SyntheticEvent, data: (InputProps & { value: string }) | undefined) {
    if (data === undefined || this.props.project === null || this.state == null) {
      return;
    }

    if (this.props && this.props.onGitHubProjectUpdated !== undefined) {
      this.props.onGitHubProjectUpdated(GitHubPropertyType.mode, "new");

      this.props.onGitHubProjectUpdated(GitHubPropertyType.newDescription, data.value);
    }
  }

  render() {
    if (this.state === null || this.state.gitHub === undefined) {
      return <div>Loading...</div>;
    }

    const galleries = [];

    const gal = this.props.carto.gallery;

    if (gal === undefined) {
      return <div>Loading gallery...</div>;
    }

    for (let i = 0; i < gal.items.length; i++) {
      const galItem = gal.items[i];

      if (galItem.type === GalleryItemType.chunk) {
        galleries.push(
          <ProjectTile
            theme={this.props.theme}
            isSelected={galItem === this.state.selectedProject}
            displayMode={ProjectTileDisplayMode.smallCodeSample}
            key={"item" + i}
            onGalleryItemCommand={this._handleGalleryItemCommand}
            carto={this.props.carto}
            project={galItem}
          />
        );
      }
    }

    return (
      <div className="aghr-outer">
        <Accordion
          defaultActiveIndex={0}
          exclusive
          panels={[
            {
              title: "Components",
              content: (
                <div key="components" className="aghr-gallery">
                  {galleries}
                </div>
              ),
            },
            {
              title: "Custom repository",
              content: (
                <div key="custom" className="aghr-selectedProject">
                  <div>GitHub Owner:</div>
                  <div>
                    <Input clearable placeholder="owner" onChange={this._handleOwnerUpdate} />
                  </div>
                  <div>GitHub Project Name:</div>
                  <div>
                    <Input clearable placeholder="project" onChange={this._handleProjectUpdate} />
                  </div>
                </div>
              ),
            },
          ]}
        />
      </div>
    );
  }
}
