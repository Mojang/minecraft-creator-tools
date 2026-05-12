import { Component } from "react";
import "./ImportFromUrl.css";
import { Button, Snackbar } from "@mui/material";
import IAppProps from "../appShell/IAppProps";
import { AppMode } from "../appShell/App";
import Project from "../../app/Project";
import HomeFooter from "../home/HomeFooter";
import HomeHeader from "../home/HomeHeader";
import IStorage from "../../storage/IStorage";
import StorageUtilities from "../../storage/StorageUtilities";
import FileExplorer, { FileExplorerMode } from "../project/fileExplorer/FileExplorer";
import IFolder from "../../storage/IFolder";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import Utilities from "../../core/Utilities";
import CreatorToolsHost, { CreatorToolsThemeStyle } from "../../app/CreatorToolsHost";
import { getThemeColors } from "../hooks/theme/useThemeColors";
import IProjectTheme from "../types/IProjectTheme";

interface IImportFromUrlProps extends IAppProps {
  project: Project | null;
  theme: IProjectTheme;
  onModeChangeRequested?: (mode: AppMode) => void;
  onNewProjectFromGallerySelected?: (galleryId: string, updateContent?: IFolder) => void;
}

interface IImportFromUrlState {
  storage?: IStorage | undefined;
  galleryId?: string | undefined;
  errorMessage?: string | undefined;
  cancelToastOpen?: boolean;
}

export default class ImportFromUrl extends Component<IImportFromUrlProps, IImportFromUrlState> {
  constructor(props: IImportFromUrlProps) {
    super(props);

    this._openProject = this._openProject.bind(this);
    this._navigateToHome = this._navigateToHome.bind(this);
    this._cancelImport = this._cancelImport.bind(this);
    this._handleCancelToastClose = this._handleCancelToastClose.bind(this);

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

  _cancelImport() {
    // Show a brief "Import canceled" toast before navigating back to the
    // home page. We delay navigation so the Snackbar has time to appear
    // (this component is unmounted on navigation).
    this.setState({ cancelToastOpen: true });
    if (this.props.creatorTools) {
      this.props.creatorTools.notifyStatusUpdate("Import canceled");
    }
    window.setTimeout(() => {
      this._navigateToHome();
    }, 1200);
  }

  _handleCancelToastClose() {
    this.setState({ cancelToastOpen: false });
  }

  _openProject() {
    if (this.props.onNewProjectFromGallerySelected && this.state.galleryId) {
      this.props.onNewProjectFromGallerySelected(this.state.galleryId, this.state.storage?.rootFolder);
    }
  }

  render() {
    let interior = <></>;

    const acceptedFormatsHelp = (
      <div className="ifu-urlFormatsHelp">
        <div className="ifu-urlFormatsHelpTitle">Accepted URL formats for importing content:</div>
        <ul className="ifu-urlFormatsHelpList">
          <li>
            <code>#open=gp/&lt;gallery-id&gt;</code> — open a gallery sample by id
          </li>
          <li>
            <code>#view=gp/&lt;gallery-id&gt;&amp;updates=&lt;json&gt;</code> — view a sample with
            update content
          </li>
          <li>
            Example: <code>?open=gp/starter.manifest.json</code>
          </li>
        </ul>
      </div>
    );

    if (!this.state || (!this.state.errorMessage && !this.state.storage)) {
      interior = (
        <div className="ifu-loading">
          Loading content from URL...
          {acceptedFormatsHelp}
        </div>
      );
    }

    let buttonArea = [];

    buttonArea.push(
      <Button key="cancelHomePage" onClick={this._cancelImport}>
        Cancel/Home Page
      </Button>
    );

    if (this.state.errorMessage) {
      interior = (
        <div className="ifu-error">
          <h1>Error loading content from URL</h1>
          <p>{this.state.errorMessage}</p>
          {acceptedFormatsHelp}
        </div>
      );
    } else if (this.state.storage) {
      buttonArea.push(
        <Button variant="contained" onClick={this._openProject} key="createButton">
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

    const colors = getThemeColors();

    return (
      <div className="ifu-outer" draggable={true}>
        <header
          className="ifu-header"
          style={{
            borderBottomColor: colors.background2,
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
        <Snackbar
          open={!!this.state.cancelToastOpen}
          autoHideDuration={3000}
          onClose={this._handleCancelToastClose}
          message="Import canceled"
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        />
      </div>
    );
  }
}
