import { Component, SyntheticEvent } from "react";
import IAppProps from "./IAppProps";
import Project from "../app/Project";
import "./ShareProject.css";
import { Button, InputProps } from "@fluentui/react-northstar";
import Utilities from "../core/Utilities";
import StorageUtilities from "../storage/StorageUtilities";
import Carto from "../app/Carto";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCopy } from "@fortawesome/free-regular-svg-icons";
import { constants } from "../core/Constants";
import Log from "../core/Log";
import HttpStorage from "../storage/HttpStorage";
import CartoApp from "../app/CartoApp";

interface IShareProjectProps extends IAppProps {
  project: Project;
}

interface IShareProjectState {
  baseProjectUrl: string | undefined;
  contentUrl: string | undefined;
  title: string | undefined;
}

export default class ShareProject extends Component<IShareProjectProps, IShareProjectState> {
  _fullLinkElt: HTMLDivElement | undefined;
  _fullUrlLinkElt: HTMLDivElement | undefined;
  _projectLinkElt: HTMLDivElement | undefined;
  _projectUrlLinkElt: HTMLDivElement | undefined;

  constructor(props: IShareProjectProps) {
    super(props);

    this._handleNameChanged = this._handleNameChanged.bind(this);
    this._ensureLoaded = this._ensureLoaded.bind(this);
    this._setFullLink = this._setFullLink.bind(this);
    this._setFullUrlLink = this._setFullUrlLink.bind(this);
    this._copyFullLink = this._copyFullLink.bind(this);
    this._copyFullUrlLink = this._copyFullUrlLink.bind(this);
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

    if (this.props.project.gitHubOwner && this.props.project.gitHubRepoName) {
      url += "?open=gh/" + this.props.project.gitHubOwner + "/" + this.props.project.gitHubRepoName;

      if (this.props.project.gitHubBranch !== undefined || this.props.project.gitHubBranch !== undefined) {
        url += "/tree/" + (this.props.project.gitHubBranch ? this.props.project.gitHubBranch : "main");

        if (this.props.project.gitHubFolder) {
          url += Utilities.ensureEndsWithSlash(this.props.project.gitHubFolder);
        }
      }
      appendDiffList = true;
    } else if (this.props.project.originalGalleryId !== undefined) {
      url += "?open=gp/" + this.props.project.originalGalleryId;
      title = this.props.project.originalGalleryId;

      const galProject = await this.props.carto.getGalleryProjectById(this.props.project.originalGalleryId);

      if (galProject) {
        title = galProject.title;
      }

      appendDiffList = true;
    } else if (
      this.props.project.originalGitHubOwner !== undefined &&
      this.props.project.originalGitHubRepoName !== undefined
    ) {
      url += "?open=gh/" + this.props.project.originalGitHubOwner + "/" + this.props.project.originalGitHubRepoName;
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

      const fileDiff64 = await this._getFileDiffs(this.props.carto, this.props.project);

      if (fileDiff64 !== undefined) {
        url += "&updates=" + fileDiff64;
      }
    }

    this.setState({ contentUrl: url, baseProjectUrl: baseProjectUrl, title: title });
  }

  async _getFileDiffs(carto: Carto, project: Project) {
    if (project.projectFolder === undefined || project.projectFolder === null) {
      return undefined;
    }

    let ghRepoName = this.props.project.originalGitHubRepoName;
    let ghRepoOwner = this.props.project.originalGitHubOwner;
    let ghRepoBranch = this.props.project.originalGitHubBranch;
    let ghRepoFolder = this.props.project.originalGitHubFolder;
    let ghFiles = this.props.project.originalFileList;

    if (this.props.project.originalGalleryId) {
      const gp = await carto.getGalleryProjectById(this.props.project.originalGalleryId);

      if (gp) {
        ghRepoName = gp.gitHubRepoName;
        ghRepoOwner = gp.gitHubOwner;
        ghRepoBranch = gp.gitHubBranch;
        ghRepoFolder = gp.gitHubFolder;
        ghFiles = gp.fileList;

        if (ghFiles === undefined) {
          const gpA = await carto.getGalleryProjectByGitHub(
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
      CartoApp.contentRoot +
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
      const differenceSet = await StorageUtilities.getDifferences(gh.rootFolder, project.projectFolder, true);

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
    if (data === undefined || this.props.carto === null || this.state == null) {
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

  _setFullUrlLink(elt: HTMLDivElement | null) {
    if (elt === null) {
      return;
    }

    this._fullUrlLinkElt = elt;
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

          <div className="shp-summaryCell">Full Link with Changes</div>
          <div className="shp-contentCell" ref={(c: HTMLDivElement) => this._setFullLink(c)}>
            <a href={contentUrlValue}>{this.state.title}</a>
          </div>
          <div className="shp-copyButton">
            <Button onClick={this._copyFullLink}>
              <FontAwesomeIcon icon={faCopy} className="fa-lg" />
            </Button>
          </div>
          <div className="shp-summaryCell">URL with Changes</div>
          <div className="shp-contentCell" ref={(c: HTMLDivElement) => this._setFullUrlLink(c)} title={contentUrlValue}>
            {contentUrlValue}
          </div>
          <div className="shp-copyButton">
            <Button onClick={this._copyFullUrlLink}>
              <FontAwesomeIcon icon={faCopy} className="fa-lg" />
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
