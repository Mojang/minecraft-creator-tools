import { Component } from "react";
import Carto from "../app/Carto";
import "./ItemGallery.css";
import IAppProps from "./IAppProps";
import IStatus from "../app/Status";
import IGallery from "../app/IGallery";
import IGalleryItem, { GalleryItemType } from "../app/IGalleryItem";
import { ThemeInput } from "@fluentui/react-northstar";
import Project from "../app/Project";
import Log from "../core/Log";
import ItemTileButton, { ItemTileButtonDisplayMode } from "./ItemTileButton";

export enum GalleryItemCommand {
  newItem,
  itemSelect,
}

export enum ItemGalleryMode {
  starters,
  codeSnippets,
}

interface IItemGalleryProps extends IAppProps {
  theme: ThemeInput<any>;
  gallery: IGallery;
  search?: string;
  view: ItemTileButtonDisplayMode;
  isSelectable?: boolean;
  filterOn?: GalleryItemType[];
  onGalleryItemCommand: (command: GalleryItemCommand, project: IGalleryItem) => void;
}

interface IItemGalleryState {
  loadedProjectHash: string;
  selectedItem?: IGalleryItem;
  mode: ItemGalleryMode;
}

export default class ItemGallery extends Component<IItemGalleryProps, IItemGalleryState> {
  constructor(props: IItemGalleryProps) {
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
      mode: ItemGalleryMode.starters,
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

        Log.assert(proj.isLoaded, "Project is not loaded in ItemGallery.");
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
      mode: ItemGalleryMode.starters,
      selectedItem: this.state.selectedItem,
    });
  }
  _selectCodeSnippets() {
    this.setState({
      loadedProjectHash: this.state.loadedProjectHash,
      mode: ItemGalleryMode.codeSnippets,
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

  _handleCommand(command: GalleryItemCommand, project: IGalleryItem) {
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
    const galleryButtons = [];
    let itemGalleriesElt = <></>;

    const gal = this.props.gallery;

    let didPushSnippet = false;
    let didPushStarter = false;

    if (this.props.search || this.state.mode === ItemGalleryMode.codeSnippets) {
      for (let i = 0; i < gal.items.length; i++) {
        const galItem = gal.items[i];

        if (
          this.projectMatchesSearch(galItem) &&
          (this.props.filterOn === undefined || this.props.filterOn.includes(galItem.type)) &&
          (galItem.type === GalleryItemType.codeSample || galItem.type === GalleryItemType.editorCodeSample)
        ) {
          let view = this.props.view;

          if (this.state.mode === ItemGalleryMode.codeSnippets) {
            view = ItemTileButtonDisplayMode.smallCodeSample;
          }

          galleryButtons.push(
            <ItemTileButton
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

      let binClassName = "ig-binWrap";

      if (this.props.view === ItemTileButtonDisplayMode.smallImage) {
        binClassName += " ig-binWrap-small";
      }

      if (!didPushSnippet && !didPushStarter) {
        galleryButtons.push(<div className="ig-notFound">No snippets found.</div>);
        binClassName += " ig-binWrap-empty";
      }

      itemGalleriesElt = (
        <div
          className={binClassName}
          style={{
            backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background3,
            borderColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
          }}
        >
          {galleryButtons}
        </div>
      );
    }

    if (this.props.search || this.state.mode === ItemGalleryMode.starters) {
      for (let i = 0; i < gal.items.length; i++) {
        const galItem = gal.items[i];

        if (
          this.projectMatchesSearch(galItem) &&
          (this.props.filterOn === undefined || this.props.filterOn.includes(galItem.type)) &&
          (galItem.type === GalleryItemType.blockType || galItem.type === GalleryItemType.entityType)
        ) {
          const displayOpen = this.state.loadedProjectHash.indexOf("[" + this.getGalleryHash(galItem) + "]") >= 0;

          galleryButtons.push(
            <ItemTileButton
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

      if (galleryButtons.length > 0) {
        itemGalleriesElt = (
          <div
            className="ig-binWrap"
            style={{
              backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background3,
              borderColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
            }}
          >
            {galleryButtons}
          </div>
        );
      }
    }

    return <div className="ig-outer">{itemGalleriesElt}</div>;
  }
}
