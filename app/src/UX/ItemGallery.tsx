import { Component } from "react";
import CreatorTools from "../app/CreatorTools";
import "./ItemGallery.css";
import IAppProps from "./IAppProps";
import IStatus from "../app/Status";
import IGallery from "../app/IGallery";
import IGalleryItem, { GalleryItemType } from "../app/IGalleryItem";
import { ThemeInput } from "@fluentui/react-northstar";
import Project from "../app/Project";
import ItemTileButton, { ItemTileButtonDisplayMode } from "./ItemTileButton";
import React from "react";
import Database from "../minecraft/Database";

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
  selectedIndex: number;
  loadedProjectHash: string;
  selectedItem?: IGalleryItem;
  mode: ItemGalleryMode;
}

export default class ItemGallery extends Component<IItemGalleryProps, IItemGalleryState> {
  itemButtonRefs: React.RefObject<ItemTileButton>[] = [];
  nextBinButton: React.RefObject<HTMLDivElement>;
  constructor(props: IItemGalleryProps) {
    super(props);

    this.nextBinButton = React.createRef();

    this._handleStatusAdded = this._handleStatusAdded.bind(this);
    this._handleCommand = this._handleCommand.bind(this);
    this._selectCodeSnippets = this._selectCodeSnippets.bind(this);
    this._selectProjectStarters = this._selectProjectStarters.bind(this);

    this.getProjectHash = this.getProjectHash.bind(this);

    this.state = {
      selectedIndex: 0,
      loadedProjectHash: this.getProjectHash(),
      selectedItem: undefined,
      mode: ItemGalleryMode.starters,
    };
  }

  _handleStatusAdded(creatorTools: CreatorTools, status: IStatus) {}

  _selectProjectStarters() {
    this.setState({
      selectedIndex: this.state.selectedIndex,
      loadedProjectHash: this.state.loadedProjectHash,
      mode: ItemGalleryMode.starters,
      selectedItem: this.state.selectedItem,
    });
  }
  _selectCodeSnippets() {
    this.setState({
      selectedIndex: this.state.selectedIndex,
      loadedProjectHash: this.state.loadedProjectHash,
      mode: ItemGalleryMode.codeSnippets,
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

  _handleCommand(command: GalleryItemCommand, galItem: IGalleryItem) {
    if (this.props.isSelectable) {
      this.setState({
        loadedProjectHash: this.state.loadedProjectHash,
        selectedItem: galItem,
      });
    }

    this.props.onGalleryItemCommand(command, galItem);
  }

  _handleArrowNav(dir: -1 | 1) {
    const nextIdx = this.state.selectedIndex + dir;
    if (nextIdx >= 0 && nextIdx < this.itemButtonRefs.length) {
      this.itemButtonRefs[nextIdx].current?.selectAndFocus();

      const galItem = this.getFilteredItems()[nextIdx];
      this._handleCommand(GalleryItemCommand.itemSelect, galItem);

      this.setState({
        selectedIndex: nextIdx,
        loadedProjectHash: this.state.loadedProjectHash,
        selectedItem: galItem,
      });
    }
  }

  getFilteredItems() {
    const items: IGalleryItem[] = [];
    const gal = this.props.gallery;
    if (this.props.search || this.state.mode === ItemGalleryMode.codeSnippets) {
      for (let i = 0; i < gal.items.length; i++) {
        const galItem = gal.items[i];
        if (
          Database.itemMatchesSearch(galItem, this.props.search) &&
          (this.props.filterOn === undefined || this.props.filterOn.includes(galItem.type)) &&
          (galItem.type === GalleryItemType.codeSample || galItem.type === GalleryItemType.editorCodeSample)
        ) {
          items.push(galItem);
        }
      }
    }

    // Build buttons for starters
    if (this.props.search || this.state.mode === ItemGalleryMode.starters) {
      for (let i = 0; i < gal.items.length; i++) {
        const galItem = gal.items[i];
        if (
          Database.itemMatchesSearch(galItem, this.props.search) &&
          (this.props.filterOn === undefined || this.props.filterOn.includes(galItem.type)) &&
          (galItem.type === GalleryItemType.blockType ||
            galItem.type === GalleryItemType.entityType ||
            galItem.type === GalleryItemType.itemType)
        ) {
          items.push(galItem);
        }
      }
    }

    return items;
  }

  render() {
    const galleryButtons = [];
    let itemGalleriesElt = <></>;
    const gal = this.props.gallery;
    let didPushSnippet = false;
    let didPushStarter = false;

    // Helper to handle arrow key navigation
    const handleArrowNav = (idx: number, dir: -1 | 1) => {
      const nextIdx = idx + dir;
      if (nextIdx >= 0 && nextIdx < this.itemButtonRefs.length) {
        this.itemButtonRefs[nextIdx].current?.selectAndFocus();

        this._handleCommand(GalleryItemCommand.itemSelect, this.itemButtonRefs[nextIdx].current!.props.project);
      }
    };

    let buttonsAdded = 0;

    // Build buttons for code snippets
    if (this.props.search || this.state.mode === ItemGalleryMode.codeSnippets) {
      for (let i = 0; i < gal.items.length; i++) {
        const galItem = gal.items[i];
        if (
          Database.itemMatchesSearch(galItem, this.props.search) &&
          (this.props.filterOn === undefined || this.props.filterOn.includes(galItem.type)) &&
          (galItem.type === GalleryItemType.codeSample || galItem.type === GalleryItemType.editorCodeSample)
        ) {
          let view = this.props.view;
          if (this.state.mode === ItemGalleryMode.codeSnippets) {
            view = ItemTileButtonDisplayMode.smallCodeSample;
          }
          buttonsAdded++;

          if (this.itemButtonRefs[buttonsAdded - 1] === undefined) {
            this.itemButtonRefs[buttonsAdded - 1] = React.createRef<ItemTileButton>();
          }

          const ref = this.itemButtonRefs[buttonsAdded - 1];

          galleryButtons.push(
            <ItemTileButton
              key={"csitem" + i}
              theme={this.props.theme}
              displayMode={view}
              isSelectable={this.props.isSelectable}
              onGalleryItemCommand={this._handleCommand}
              isSelected={this.state.selectedItem === galItem}
              displayOpenButton={false}
              creatorTools={this.props.creatorTools}
              buttonIndex={buttonsAdded - 1}
              project={galItem}
              ref={ref}
              tabIndex={0}
              onArrowNav={(index, dir) => handleArrowNav(index, dir)}
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

    // Build buttons for starters
    if (this.props.search || this.state.mode === ItemGalleryMode.starters) {
      for (let i = 0; i < gal.items.length; i++) {
        const galItem = gal.items[i];
        if (
          Database.itemMatchesSearch(galItem, this.props.search) &&
          (this.props.filterOn === undefined || this.props.filterOn.includes(galItem.type)) &&
          (galItem.type === GalleryItemType.blockType ||
            galItem.type === GalleryItemType.entityType ||
            galItem.type === GalleryItemType.itemType)
        ) {
          const displayOpen = this.state.loadedProjectHash.indexOf("[" + this.getGalleryHash(galItem) + "]") >= 0;
          buttonsAdded++;

          if (this.itemButtonRefs[buttonsAdded - 1] === undefined) {
            this.itemButtonRefs[buttonsAdded - 1] = React.createRef<ItemTileButton>();
          }

          const ref = this.itemButtonRefs[buttonsAdded - 1];
          galleryButtons.push(
            <ItemTileButton
              key={"galitem" + i}
              theme={this.props.theme}
              displayMode={this.props.view}
              isSelectable={this.props.isSelectable}
              isSelected={this.state.selectedItem === galItem}
              onGalleryItemCommand={this._handleCommand}
              displayOpenButton={displayOpen}
              creatorTools={this.props.creatorTools}
              project={galItem}
              ref={ref}
              buttonIndex={buttonsAdded - 1}
              tabIndex={0}
              onArrowNav={(index, dir) => handleArrowNav(index, dir)}
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
            role="radiogroup"
          >
            {galleryButtons}
          </div>
        );
      }
    }
    return (
      <div
        className="ig-outer"
        ref={this.nextBinButton}
        tabIndex={0}
        onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
          if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
            e.preventDefault();
            this._handleArrowNav(-1);
          } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
            e.preventDefault();
            this._handleArrowNav(1);
          }
        }}
      >
        {itemGalleriesElt}
      </div>
    );
  }
}
