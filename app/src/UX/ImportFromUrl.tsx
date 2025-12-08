import { Component } from "react";
import "./ImportFromUrl.css";
import { Button, ThemeInput } from "@fluentui/react-northstar";
import IAppProps from "./IAppProps";
import { AppMode } from "./App";
import Project from "../app/Project";
import HomeFooter from "./HomeFooter";
import HomeHeader from "./HomeHeader";
import IStorage from "../storage/IStorage";
import StorageUtilities from "../storage/StorageUtilities";
import FileExplorer, { FileExplorerMode } from "./FileExplorer";
import IFolder from "../storage/IFolder";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import Utilities from "../core/Utilities";
import { CreatorToolsHost } from "../index.lib";
import { CreatorToolsThemeStyle } from "../app/CreatorToolsHost";

interface IImportFromUrlProps extends IAppProps {
  project: Project | null;
  theme: ThemeInput<any>;
  onModeChangeRequested?: (mode: AppMode) => void;
  onNewProjectFromGallerySelected?: (galleryId: string, updateContent?: IFolder) => void;
}

interface IImportFromUrlState {
  storage?: IStorage | undefined;
  galleryId?: string | undefined;
  errorMessage?: string | undefined;
}

export default class ImportFromUrl extends Component<IImportFromUrlProps, IImportFromUrlState> {
  constructor(props: IImportFromUrlProps) {
    super(props);

    this._openProject = this._openProject.bind(this);
    this._navigateToHome = this._navigateToHome.bind(this);

    this.state = {};
  }

  componentDidMount(): void {
    this._load();
  }

  async _load() {
    let hash = window.location.hash;

    const queryVals: { [key: string]: string } = {};

    if (hash) {
      const params = hash.split("&");

      if (params.length > 0) {
        for (let i = 0; i < params.length; i++) {
          const firstEqual = params[i].indexOf("=");

          if (firstEqual > 0) {
            let key = params[i].substring(0, firstEqual);

            if (key.startsWith("?")) {
              key = key.substring(1);
            }
            if (key.startsWith("#")) {
              key = key.substring(1);
            }

            if (Utilities.isUsableAsObjectKey(key)) {
              queryVals[key] = params[i].substring(firstEqual + 1);
            }
          }
        }
      }
    }

    if (queryVals["open"] !== undefined || queryVals["view"] !== undefined) {
      let openQuery = queryVals["view"];

      let updateContent = queryVals["updates"];

      if (!updateContent) {
        updateContent = queryVals["updatesJson"];
      }

      if (queryVals["open"]) {
        openQuery = queryVals["open"];
      }

      if (queryVals["openJson"]) {
        openQuery = queryVals["openJson"];
      }

      const firstSlash = openQuery.indexOf("/");

      if (firstSlash > 1) {
        const openToken = openQuery.substring(0, firstSlash).toLowerCase();

        let openData = openQuery.substring(firstSlash + 1, openQuery.length);

        if (openToken === "gp") {
          const lastPeriod = openData.lastIndexOf(".");

          if (lastPeriod > 0) {
            openData = openData.substring(0, lastPeriod);
          }

          if (updateContent) {
            const storageOrError = await StorageUtilities.createStorageFromUntrustedString(updateContent);

            if (!storageOrError || typeof storageOrError === "string") {
              this.setState({
                errorMessage: storageOrError,
              });
              return;
            }
            this.setState({
              storage: storageOrError,
              galleryId: openData,
            });
          }
          return;
        }
      }
    }
  }

  _navigateToHome() {
    window.location.hash = "#";
    if (this.props.onModeChangeRequested) {
      this.props.onModeChangeRequested(AppMode.home);
    }
  }

  _openProject() {
    if (this.props.onNewProjectFromGallerySelected && this.state.galleryId) {
      this.props.onNewProjectFromGallerySelected(this.state.galleryId, this.state.storage?.rootFolder);
    }
  }

  render() {
    let interior = <></>;

    if (!this.state || (!this.state.errorMessage && !this.state.storage)) {
      interior = <div className="ifu-loading">Loading content from URL...</div>;
    }

    let buttonArea = [];

    buttonArea.push(
      <Button key="cancelHomePage" onClick={this._navigateToHome}>
        Cancel/Home Page
      </Button>
    );

    if (this.state.errorMessage) {
      interior = (
        <div className="ifu-error">
          <h1>Error loading content from URL</h1>
          <p>{this.state.errorMessage}</p>
        </div>
      );
    } else if (this.state.storage) {
      buttonArea.push(
        <Button className="ifu-button" primary={true} onClick={this._openProject} key="createButton">
          Create
        </Button>
      );
      interior = (
        <div className="ifu-contentInterior">
          <div className="ifu-warning">
            <span className="ifu-warningIcon">
              <FontAwesomeIcon icon={faTriangleExclamation} className="fa-lg" />
            </span>
            <span className="ifu-warningText">
              This is content from the link you selected. If this looks OK, click Create to open this sample as a
              project.
            </span>
          </div>
          <FileExplorer
            rootFolder={this.state.storage.rootFolder}
            creatorTools={this.props.creatorTools}
            readOnly={true}
            showPreview={true}
            selectFirstFile={true}
            expandByDefault={true}
            theme={this.props.theme}
            heightOffset={380}
            mode={FileExplorerMode.explorer}
          />
        </div>
      );
    }
    return (
      <div className="ifu-outer" draggable={true}>
        <header
          className="ifu-header"
          style={{
            borderBottomColor: this.props.theme.siteVariables?.colorScheme.brand.background2,
          }}
        >
          <HomeHeader mode={CreatorToolsHost.theme === CreatorToolsThemeStyle.dark ? "dark" : "light"} />
        </header>
        <main className="ifu-main">
          <div className="ifu-content">{interior}</div>
          <div className="ifu-buttonBar">{buttonArea}</div>
        </main>
        <footer className="ifu-footer">
          <HomeFooter theme={this.props.theme} creatorTools={this.props.creatorTools} displayStorageHandling={false} />
        </footer>
      </div>
    );
  }
}
