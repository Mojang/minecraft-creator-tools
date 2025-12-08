import { Component, SyntheticEvent } from "react";
import IAppProps from "./IAppProps";
import Project from "../app/Project";
import "./ShareProject.css";
import { Button, InputProps, ThemeInput } from "@fluentui/react-northstar";
import Utilities from "../core/Utilities";
import StorageUtilities from "../storage/StorageUtilities";
import CreatorTools from "../app/CreatorTools";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCopy } from "@fortawesome/free-regular-svg-icons";
import { constants } from "../core/Constants";
import Log from "../core/Log";
import HttpStorage from "../storage/HttpStorage";
import CreatorToolsHost from "../app/CreatorToolsHost";
import { faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import IStorage from "../storage/IStorage";
import FileExplorer, { FileExplorerMode } from "./FileExplorer";
import QRCode from "react-qr-code";

interface IShareProjectProps extends IAppProps {
  project: Project;
  theme: ThemeInput<any>;
}

interface IShareProjectState {
  baseProjectUrl: string | undefined;
  contentUrl: string | undefined;
  title: string | undefined;
  exampleStorage?: IStorage | undefined;
  exampleErrorMessage?: string | undefined;
}

export default class ShareProject extends Component<IShareProjectProps, IShareProjectState> {
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
    window.setTimeout(this._ensureLoaded, 1);
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

    const gh = new HttpStorage(
      CreatorToolsHost.contentRoot +
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

  _handleNameChanged(e: SyntheticEvent, data: (InputProps & { value: string }) | undefined) {
    if (data === undefined || this.props.creatorTools === null || this.state == null) {
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

  _copyFullLink(event: SyntheticEvent<HTMLElement, Event> | React.KeyboardEvent<Element> | null) {
    if (this._fullLinkElt !== undefined) {
      this._selectAndCopy(this._fullLinkElt);
    }
  }

  _copyQrCodeLink(event: SyntheticEvent<HTMLElement, Event> | React.KeyboardEvent<Element> | null) {
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

  _copyFullUrlLink(event: SyntheticEvent<HTMLElement, Event> | React.KeyboardEvent<Element> | null) {
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

  _copyProjectLink(event: SyntheticEvent<HTMLElement, Event> | React.KeyboardEvent<Element> | null) {
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

  _copyProjectUrlLink(event: SyntheticEvent<HTMLElement, Event> | React.KeyboardEvent<Element> | null) {
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
            navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
          }
        }, "image/png");
      };

      image.src = url;
    } catch (err: any) {
      alert(err.message);
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
    if (this.state === null || this.state.contentUrl === undefined) {
      return <div>Generating link...</div>;
    }

    const contentUrlValue = this.state.contentUrl;
    const baseProjectUrlValue = this.state.baseProjectUrl;

    const shareContent = [];

    if (this.state.exampleErrorMessage) {
      shareContent.push(
        <div className="shp-contentAreaHeader">
          <div className="shp-contentHeader">Could not generate links with changed content.</div>
          <div>{this.state.exampleErrorMessage}</div>
        </div>
      );
    } else if (contentUrlValue && this.state.exampleStorage) {
      shareContent.push(
        <div className="shp-contentAreaHeader">
          <div className="shp-contentHeader">Links with your changed content</div>
        </div>
      );
      shareContent.push(<div className="shp-summaryCell">Full Link with Changes</div>);
      shareContent.push(
        <div className="shp-contentCell" ref={(c: HTMLDivElement) => this._setFullLink(c)}>
          <a href={contentUrlValue}>{this.state.title}</a>
        </div>
      );
      shareContent.push(
        <div className="shp-copyButton">
          <Button onClick={this._copyFullLink}>
            <FontAwesomeIcon icon={faCopy} className="fa-lg" />
          </Button>
        </div>
      );
      shareContent.push(<div className="shp-summaryCell">URL with Changes ({contentUrlValue.length} chars)</div>);
      shareContent.push(
        <div className="shp-contentCell" ref={(c: HTMLDivElement) => this._setFullUrlLink(c)} title={contentUrlValue}>
          {contentUrlValue}
        </div>
      );

      shareContent.push(
        <div className="shp-copyButton">
          <Button onClick={this._copyFullUrlLink}>
            <FontAwesomeIcon icon={faCopy} className="fa-lg" />
          </Button>
        </div>
      );
      shareContent.push(<div className="shp-summaryCell">URL with Changes QR Code</div>);
      if (contentUrlValue.length < 4200) {
        shareContent.push(
          <div className="shp-contentCell" ref={(c: HTMLDivElement) => this._setQrCodeLink(c)} title={contentUrlValue}>
            <QRCode value={contentUrlValue} />
          </div>
        );

        shareContent.push(
          <div className="shp-copyButton">
            <Button onClick={this._copyQrCodeLink}>
              <FontAwesomeIcon icon={faCopy} className="fa-lg" />
            </Button>
          </div>
        );
      } else {
        shareContent.push(
          <div className="shp-contentCell" title={contentUrlValue}>
            URL is too long - {contentUrlValue} - for a QR code (over 4200 characters.
          </div>
        );
      }

      shareContent.push(
        <div className="shp-contentArea">
          <div className="shp-contentWarning">
            <span className="shp-warningIcon">
              <FontAwesomeIcon icon={faTriangleExclamation} className="fa-lg" />
            </span>
            <span className="shp-warningText">
              This changed content is <b>directly included</b> within the links above. By sharing "with Changes" links,
              you are sharing this content:
            </span>
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
        <div className="shp-optionsArea">
          <div className="shp-summaryCell">Project Start Link</div>
          <div className="shp-contentCell" ref={(c: HTMLDivElement) => this._setProjectLink(c)}>
            <a href={baseProjectUrlValue}>{this.state.title}</a>
          </div>
          <div className="shp-copyButton">
            <Button onClick={this._copyProjectLink}>
              <FontAwesomeIcon icon={faCopy} className="fa-lg" />
            </Button>
          </div>
          <div className="shp-summaryCell">Project Start URL</div>
          <div
            className="shp-contentCell"
            ref={(c: HTMLDivElement) => this._setProjectUrlLink(c)}
            title={baseProjectUrlValue}
          >
            {baseProjectUrlValue}
          </div>
          <div className="shp-copyButton">
            <Button onClick={this._copyProjectUrlLink}>
              <FontAwesomeIcon icon={faCopy} className="fa-lg" />
            </Button>
          </div>
          {shareContent}
        </div>
      </div>
    );
  }
}
