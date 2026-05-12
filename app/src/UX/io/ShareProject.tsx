import { Component } from "react";
import IAppProps from "../appShell/IAppProps";
import Project from "../../app/Project";
import "./ShareProject.css";
import { IconButton } from "@mui/material";
import Utilities from "../../core/Utilities";
import StorageUtilities from "../../storage/StorageUtilities";
import CreatorTools from "../../app/CreatorTools";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCopy } from "@fortawesome/free-regular-svg-icons";
import { constants } from "../../core/Constants";
import Log from "../../core/Log";
import HttpStorage from "../../storage/HttpStorage";
import CreatorToolsHost from "../../app/CreatorToolsHost";
import { faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import IStorage from "../../storage/IStorage";
import FileExplorer, { FileExplorerMode } from "../project/fileExplorer/FileExplorer";
import QRCode from "react-qr-code";
import IProjectTheme from "../types/IProjectTheme";
import { WithLocalizationProps, withLocalization } from "../withLocalization";

interface IShareProjectProps extends IAppProps, WithLocalizationProps {
  project: Project;
  theme: IProjectTheme;
}

interface IShareProjectState {
  baseProjectUrl: string | undefined;
  contentUrl: string | undefined;
  title: string | undefined;
  exampleStorage?: IStorage | undefined;
  exampleErrorMessage?: string | undefined;
  copyErrorMessage?: string | undefined;
}

class ShareProject extends Component<IShareProjectProps, IShareProjectState> {
  _fullLinkElt: HTMLDivElement | undefined;
  _fullUrlLinkElt: HTMLDivElement | undefined;
  _projectLinkElt: HTMLDivElement | undefined;
  _projectUrlLinkElt: HTMLDivElement | undefined;
  _qrCodeLinkElt: HTMLDivElement | undefined;

  constructor(props: IShareProjectProps) {
    super(props);

    this._handleNameChanged = this._handleNameChanged.bind(this);
    this._ensureLoaded = this._ensureLoaded.bind(this);
    this._setFullLink = this._setFullLink.bind(this);
    this._setFullUrlLink = this._setFullUrlLink.bind(this);
    this._setQrCodeLink = this._setQrCodeLink.bind(this);
    this._copyFullLink = this._copyFullLink.bind(this);
    this._copyFullUrlLink = this._copyFullUrlLink.bind(this);
    this._copyQrCodeLink = this._copyQrCodeLink.bind(this);
    this._setProjectLink = this._setProjectLink.bind(this);
    this._setProjectUrlLink = this._setProjectUrlLink.bind(this);
    this._copyProjectLink = this._copyProjectLink.bind(this);
    this._copyProjectUrlLink = this._copyProjectUrlLink.bind(this);

    this.state = {
      baseProjectUrl: undefined,
      contentUrl: undefined,
      title: undefined,
    };
  }

  componentDidMount() {
    window.setTimeout(() => {
      void this._ensureLoaded().catch((err) => {
        Log.error(`ShareProject load failed: ${err}`);
        this.setState({ exampleErrorMessage: "Failed to load project sharing info: " + err.message });
      });
    }, 1);
  }

  async _ensureLoaded() {
    let url = constants.homeUrl;
    let baseProjectUrl = url;
    let title = "Project";
    let appendDiffList = false;

    let exampleStorage: IStorage | undefined = undefined;
    let exampleErrorMessage: string | undefined = undefined;

    if (this.props.project.gitHubOwner && this.props.project.gitHubRepoName) {
      url += "#open=gh/" + this.props.project.gitHubOwner + "/" + this.props.project.gitHubRepoName;

      if (this.props.project.gitHubBranch !== undefined || this.props.project.gitHubBranch !== undefined) {
        url += "/tree/" + (this.props.project.gitHubBranch ? this.props.project.gitHubBranch : "main");

        if (this.props.project.gitHubFolder) {
          url += Utilities.ensureEndsWithSlash(this.props.project.gitHubFolder);
        }
      }
      appendDiffList = true;
    } else if (this.props.project.originalGalleryId !== undefined) {
      url += "#open=gp/" + this.props.project.originalGalleryId;
      title = this.props.project.originalGalleryId;

      const galProject = await this.props.creatorTools.getGalleryProjectById(this.props.project.originalGalleryId);

      if (galProject) {
        title = galProject.title;
      }

      appendDiffList = true;
    } else if (
      this.props.project.originalGitHubOwner !== undefined &&
      this.props.project.originalGitHubRepoName !== undefined
    ) {
      url += "#open=gh/" + this.props.project.originalGitHubOwner + "/" + this.props.project.originalGitHubRepoName;
      title = this.props.project.originalGitHubRepoName;
      if (
        this.props.project.originalGitHubBranch !== undefined ||
        this.props.project.originalGitHubFolder !== undefined
      ) {
        url += "/tree/" + (this.props.project.originalGitHubBranch ? this.props.project.originalGitHubBranch : "main");

        if (this.props.project.originalGitHubFolder) {
          url += Utilities.ensureEndsWithSlash(this.props.project.originalGitHubFolder);
        }
      }

      appendDiffList = true;
    }

    if (appendDiffList) {
      baseProjectUrl = url;

      const fileDiff64 = await this._getFileDiffsBase64(this.props.creatorTools, this.props.project);

      if (fileDiff64 !== undefined) {
        url += "&updates=" + fileDiff64;

        const results = await StorageUtilities.createStorageFromUntrustedString(fileDiff64);

        if (typeof results === "string") {
          exampleErrorMessage = results;
        } else if (results) {
          exampleStorage = results;
        }
      }
    }

    this.setState({
      contentUrl: url,
      baseProjectUrl: baseProjectUrl,
      title: title,
      exampleStorage: exampleStorage,
      exampleErrorMessage: exampleErrorMessage,
    });
  }

  async _getFileDiffsBase64(creatorTools: CreatorTools, project: Project) {
    if (project.projectFolder === undefined || project.projectFolder === null) {
      return undefined;
    }

    let ghRepoName = this.props.project.originalGitHubRepoName;
    let ghRepoOwner = this.props.project.originalGitHubOwner;
    let ghRepoBranch = this.props.project.originalGitHubBranch;
    let ghRepoFolder = this.props.project.originalGitHubFolder;
    let ghFiles = this.props.project.originalFileList;

    if (this.props.project.originalGalleryId) {
      const gp = await creatorTools.getGalleryProjectById(this.props.project.originalGalleryId);

      if (gp) {
        ghRepoName = gp.gitHubRepoName;
        ghRepoOwner = gp.gitHubOwner;
        ghRepoBranch = gp.gitHubBranch;
        ghRepoFolder = gp.gitHubFolder;
        ghFiles = gp.fileList;

        if (ghFiles === undefined) {
          const gpA = await creatorTools.getGalleryProjectByGitHub(
            gp.gitHubRepoName,
            gp.gitHubOwner,
            gp.gitHubBranch,
            gp.gitHubFolder,
            true
          );

          if (gpA && gpA.fileList) {
            ghFiles = gpA.fileList;
          }
        }
      }
    }

    if (!ghRepoName || !ghRepoOwner) {
      return undefined;
    }

    const gh = HttpStorage.get(
      CreatorToolsHost.contentWebRoot +
        "res/samples/" +
        ghRepoOwner +
        "/" +
        ghRepoName +
        "-" +
        (ghRepoBranch ? ghRepoBranch : "main") +
        "/" +
        ghRepoFolder
    );

    //const gh = new GitHubStorage(this.props.carto.anonGitHub, ghRepoName, ghRepoOwner, ghRepoBranch, ghRepoFolder);

    try {
      const differenceSet = await StorageUtilities.getDifferences(gh.rootFolder, project.projectFolder, true, true);

      if (differenceSet.fileDifferences.length > 0) {
        const zs = await differenceSet.getZip();
        const diff64 = await zs.generateCompressedBase64Async();

        return diff64;
      }
    } catch (e) {
      // potentially a web limit or network issue
      Log.verbose("Error retrieving file differences: " + e);
    }

    return undefined;
  }

  _handleNameChanged(e: React.ChangeEvent<HTMLInputElement>) {
    if (this.props.creatorTools === null || this.state == null) {
      return;
    }

    this.setState({
      contentUrl: "foo",
    });
  }

  _setFullLink(elt: HTMLDivElement | null) {
    if (elt === null) {
      return;
    }

    this._fullLinkElt = elt;
  }

  _copyFullLink() {
    if (this._fullLinkElt !== undefined) {
      this._selectAndCopy(this._fullLinkElt);
    }
  }

  _copyQrCodeLink() {
    if (this._qrCodeLinkElt !== undefined) {
      this._selectAndCopySvg(this._qrCodeLinkElt);
    }
  }

  _setFullUrlLink(elt: HTMLDivElement | null) {
    if (elt === null) {
      return;
    }

    this._fullUrlLinkElt = elt;
  }

  _setQrCodeLink(elt: HTMLDivElement | null) {
    if (elt === null) {
      return;
    }

    this._qrCodeLinkElt = elt;
  }

  _copyFullUrlLink() {
    if (this._fullUrlLinkElt !== undefined) {
      this._selectAndCopy(this._fullUrlLinkElt);
    }
  }

  _setProjectLink(elt: HTMLDivElement | null) {
    if (elt === null) {
      return;
    }

    this._projectLinkElt = elt;
  }

  _copyProjectLink() {
    if (this._projectLinkElt !== undefined) {
      this._selectAndCopy(this._projectLinkElt);
    }
  }

  _setProjectUrlLink(elt: HTMLDivElement | null) {
    if (elt === null) {
      return;
    }

    this._projectUrlLinkElt = elt;
  }

  _copyProjectUrlLink() {
    if (this._projectUrlLinkElt !== undefined) {
      this._selectAndCopy(this._projectUrlLinkElt);
    }
  }

  async _selectAndCopySvg(elt: HTMLDivElement) {
    try {
      // convert SVG to image, then copy to clipboard
      const stringData = elt.innerHTML;
      const utf8Encoder = new TextEncoder();
      const uint8Array = utf8Encoder.encode(stringData);

      const url = "data:image/svg+xml;base64," + Utilities.uint8ArrayToBase64(uint8Array);

      const image = document.createElement("img");

      image.onload = async () => {
        const canvas = document.createElement("canvas");
        canvas.width = 512;
        canvas.height = 512;
        (canvas.getContext("2d") as any).drawImage(image, 0, 0, 512, 512);
        canvas.toBlob((blob) => {
          if (blob) {
            try {
              navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
            } catch {
              Log.debug("Failed to copy image to clipboard");
            }
          }
        }, "image/png");
      };

      image.src = url;
    } catch (err: any) {
      Log.error(`QR code copy failed: ${err}`);
      this.setState({ copyErrorMessage: "Failed to copy QR code: " + err.message });
    }
  }

  _selectAndCopy(elt: HTMLDivElement) {
    const rng = document.createRange();
    rng.selectNodeContents(elt);
    const sel = window.getSelection();

    if (sel) {
      sel.removeAllRanges();
      sel.addRange(rng);

      // @ts-ignore
      document.execCommand("copy");
    }
  }

  render() {
    const intl = this.props.intl;

    if (this.state === null || this.state.contentUrl === undefined) {
      return <div>{intl.formatMessage({ id: "share_project.generating" })}</div>;
    }

    const contentUrlValue = this.state.contentUrl;
    const baseProjectUrlValue = this.state.baseProjectUrl;

    const shareContent = [];

    if (this.state.exampleErrorMessage) {
      shareContent.push(
        <div className="shp-contentAreaHeader" key="shp-error-header">
          <div className="shp-contentHeader">{intl.formatMessage({ id: "share_project.error_header" })}</div>
          <div>{this.state.exampleErrorMessage}</div>
        </div>
      );
    } else if (contentUrlValue && this.state.exampleStorage) {
      shareContent.push(
        <div className="shp-contentAreaHeader" key="shp-content-header">
          <div className="shp-contentHeader">{intl.formatMessage({ id: "share_project.changes_header" })}</div>
        </div>
      );
      shareContent.push(
        <div className="shp-summaryCell" key="shp-full-link-label">
          {intl.formatMessage({ id: "share_project.full_link_label" })}
        </div>
      );
      shareContent.push(
        <div className="shp-contentCell" key="shp-full-link-cell" ref={(c: HTMLDivElement) => this._setFullLink(c)}>
          <a href={contentUrlValue}>{this.state.title}</a>
        </div>
      );
      shareContent.push(
        <div className="shp-copyButton" key="shp-full-link-copy">
          <IconButton
            onClick={this._copyFullLink}
            size="small"
            title={intl.formatMessage({ id: "share_project.copy_full_link" })}
            aria-label={intl.formatMessage({ id: "share_project.copy_full_link" })}
          >
            <FontAwesomeIcon icon={faCopy} className="fa-lg" />
          </IconButton>
        </div>
      );
      shareContent.push(
        <div className="shp-summaryCell" key="shp-url-label">
          {intl.formatMessage({ id: "share_project.url_changes_label" }, { length: contentUrlValue.length })}
        </div>
      );
      shareContent.push(
        <div
          className="shp-contentCell"
          key="shp-url-cell"
          ref={(c: HTMLDivElement) => this._setFullUrlLink(c)}
          title={contentUrlValue}
        >
          {contentUrlValue}
        </div>
      );

      shareContent.push(
        <div className="shp-copyButton" key="shp-url-copy">
          <IconButton
            onClick={this._copyFullUrlLink}
            size="small"
            title={intl.formatMessage({ id: "share_project.copy_url" })}
            aria-label={intl.formatMessage({ id: "share_project.copy_url" })}
          >
            <FontAwesomeIcon icon={faCopy} className="fa-lg" />
          </IconButton>
        </div>
      );
      shareContent.push(
        <div className="shp-summaryCell" key="shp-qr-label">
          {intl.formatMessage({ id: "share_project.qr_label" })}
        </div>
      );
      if (contentUrlValue.length < 4200) {
        shareContent.push(
          <div
            className="shp-contentCell"
            key="shp-qr-cell"
            ref={(c: HTMLDivElement) => this._setQrCodeLink(c)}
            title={contentUrlValue}
          >
            <QRCode value={contentUrlValue} />
          </div>
        );

        shareContent.push(
          <div className="shp-copyButton" key="shp-qr-copy">
            <IconButton
              onClick={this._copyQrCodeLink}
              size="small"
              title={intl.formatMessage({ id: "share_project.copy_qr" })}
              aria-label={intl.formatMessage({ id: "share_project.copy_qr" })}
            >
              <FontAwesomeIcon icon={faCopy} className="fa-lg" />
            </IconButton>
          </div>
        );
      } else {
        shareContent.push(
          <div className="shp-contentCell" key="shp-qr-too-long" title={contentUrlValue}>
            {intl.formatMessage({ id: "share_project.url_too_long" }, { length: contentUrlValue.length })}
          </div>
        );
      }

      shareContent.push(
        <div className="shp-contentArea" key="shp-content-area">
          <div className="shp-contentWarning">
            <span className="shp-warningIcon">
              <FontAwesomeIcon icon={faTriangleExclamation} className="fa-lg" />
            </span>
            <span
              className="shp-warningText"
              dangerouslySetInnerHTML={{ __html: intl.formatMessage({ id: "share_project.content_warning" }) }}
            />
          </div>

          <div className="shp-contentDisplay">
            <FileExplorer
              rootFolder={this.state.exampleStorage.rootFolder}
              creatorTools={this.props.creatorTools}
              readOnly={true}
              selectFirstFile={true}
              height={260}
              expandByDefault={true}
              showPreview={true}
              mode={FileExplorerMode.explorer}
              theme={this.props.theme}
            />
          </div>
        </div>
      );
    }

    return (
      <div className="shp-outer">
        {this.state.copyErrorMessage && (
          <div
            style={{
              padding: "8px",
              backgroundColor: "#ffebee",
              color: "#c62828",
              marginBottom: "8px",
              borderRadius: "4px",
            }}
          >
            {this.state.copyErrorMessage}
          </div>
        )}
        <div className="shp-optionsArea">
          <div className="shp-summaryCell">{intl.formatMessage({ id: "share_project.project_link_label" })}</div>
          <div className="shp-contentCell" ref={(c: HTMLDivElement) => this._setProjectLink(c)}>
            <a href={baseProjectUrlValue}>{this.state.title}</a>
          </div>
          <div className="shp-copyButton">
            <IconButton
              onClick={this._copyProjectLink}
              size="small"
              title={intl.formatMessage({ id: "share_project.copy_project_link" })}
              aria-label={intl.formatMessage({ id: "share_project.copy_project_link" })}
            >
              <FontAwesomeIcon icon={faCopy} className="fa-lg" />
            </IconButton>
          </div>
          <div className="shp-summaryCell">{intl.formatMessage({ id: "share_project.project_url_label" })}</div>
          <div
            className="shp-contentCell"
            ref={(c: HTMLDivElement) => this._setProjectUrlLink(c)}
            title={baseProjectUrlValue}
          >
            {baseProjectUrlValue}
          </div>
          <div className="shp-copyButton">
            <IconButton
              onClick={this._copyProjectUrlLink}
              size="small"
              title={intl.formatMessage({ id: "share_project.copy_project_url" })}
              aria-label={intl.formatMessage({ id: "share_project.copy_project_url" })}
            >
              <FontAwesomeIcon icon={faCopy} className="fa-lg" />
            </IconButton>
          </div>
          {shareContent}
        </div>
      </div>
    );
  }
}

export default withLocalization(ShareProject);
