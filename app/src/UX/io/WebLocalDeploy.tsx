import { Component, DragEvent, SyntheticEvent } from "react";
import IAppProps from "../appShell/IAppProps";
import Project from "../../app/Project";
import "./WebLocalDeploy.css";
import { IconButton } from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCopy } from "@fortawesome/free-regular-svg-icons";
import FileSystemStorage from "../../storage/FileSystemStorage";
import Log from "../../core/Log";
import FileSystemFolder from "../../storage/FileSystemFolder";
import CreatorToolsHost from "../../app/CreatorToolsHost";
import { MinecraftFlavor } from "../../app/ICreatorToolsData";
import { faCheck } from "@fortawesome/free-solid-svg-icons";
import { DeploymentTargetType } from "../../app/DeploymentTarget";

interface IWebLocalDeployProps extends IAppProps {
  project?: Project;
}

interface IWebLocalDeployState {
  isDragOver: boolean;
  targetDeployFolder: boolean;
}

export default class WebLocalDeploy extends Component<IWebLocalDeployProps, IWebLocalDeployState> {
  _previewPathLinkElt: HTMLDivElement | undefined;
  _mainPathLinkElt: HTMLDivElement | undefined;

  constructor(props: IWebLocalDeployProps) {
    super(props);

    this._setPreviewPathLink = this._setPreviewPathLink.bind(this);
    this._copyPreviewPathLink = this._copyPreviewPathLink.bind(this);
    this._setMainPathLink = this._setMainPathLink.bind(this);
    this._copyMainPathLink = this._copyMainPathLink.bind(this);
    this._handleFolderDrop = this._handleFolderDrop.bind(this);
    this._handleDragOut = this._handleDragOut.bind(this);
    this._handleDragOver = this._handleDragOver.bind(this);

    this.state = {
      isDragOver: false,
      targetDeployFolder: false,
    };
  }

  componentDidMount() {}

  _setPreviewPathLink(elt: HTMLDivElement | null) {
    if (elt === null) {
      return;
    }

    this._previewPathLinkElt = elt;
  }

  _copyPreviewPathLink(event: SyntheticEvent<HTMLElement, Event> | React.KeyboardEvent<Element> | null) {
    if (this._previewPathLinkElt !== undefined) {
      this._selectAndCopy(this._previewPathLinkElt);
    }
  }

  _setMainPathLink(elt: HTMLDivElement | null) {
    if (elt === null) {
      return;
    }

    this._mainPathLinkElt = elt;
  }

  _copyMainPathLink(event: SyntheticEvent<HTMLElement, Event> | React.KeyboardEvent<Element> | null) {
    if (this._mainPathLinkElt !== undefined) {
      this._selectAndCopy(this._mainPathLinkElt);
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

  private async _handleDragOver(ev: DragEvent): Promise<any> {
    this.setState({
      isDragOver: true,
    });

    ev.preventDefault();
    ev.stopPropagation();
  }

  private async _handleDragOut(ev: DragEvent): Promise<any> {
    this.setState({
      isDragOver: false,
    });

    ev.preventDefault();
    ev.stopPropagation();
  }

  private async _handleFolderDrop(ev: DragEvent): Promise<any> {
    ev.preventDefault();
    ev.stopPropagation();

    this.setState({
      isDragOver: false,
      targetDeployFolder: false,
    });

    if (ev == null || ev.dataTransfer == null) {
      return;
    }

    if (ev.dataTransfer.items) {
      for (var i = 0; i < ev.dataTransfer.items.length; i++) {
        const dtitem = ev.dataTransfer.items[i];

        let entry: FileSystemEntry | null = null;

        if (dtitem.webkitGetAsEntry) {
          entry = dtitem.webkitGetAsEntry();
        }

        if (entry && entry.isDirectory) {
          const dirHandle = await dtitem.getAsFileSystemHandle();

          if (dirHandle) {
            const perm = await dirHandle.requestPermission({
              mode: "readwrite",
            });

            if (perm) {
              let fss = new FileSystemStorage(dirHandle as FileSystemDirectoryHandle, entry.name);

              const safeMessage = await (fss.rootFolder as FileSystemFolder).getFirstUnsafeError();

              if (safeMessage !== undefined) {
                Log.debugAlert(safeMessage);
                return;
              }

              CreatorToolsHost.deploymentStorage[DeploymentTargetType.customDedicatedServer] = fss;

              this.props.creatorTools.isDeployingToMinecraft = true;
              this.props.creatorTools.ensureMinecraft(MinecraftFlavor.deploymentStorage);

              if (this.props.creatorTools.activeMinecraft && this.props.project) {
                this.props.creatorTools.activeMinecraft.activeProject = this.props.project;
              }

              this.setState({
                isDragOver: false,
                targetDeployFolder: true,
              });
            }
          }
        }
      }
    }
  }

  render() {
    if (this.state === null) {
      return <div>Generating link...</div>;
    }
    let successfullyFoundFolder = <></>;

    if (this.state.targetDeployFolder) {
      successfullyFoundFolder = (
        <div className="wld-successArea">
          <span className="wld-successCheck">
            <FontAwesomeIcon icon={faCheck} />
          </span>
          <span>&#160;com.mojang folder found.</span>
        </div>
      );
    }

    return (
      <div
        className={"wld-outer" + (this.state?.isDragOver ? " wld-outer-over" : "")}
        onDrop={this._handleFolderDrop}
        onDragOver={this._handleDragOver}
        onDragLeave={this._handleDragOut}
      >
        <div>
          If you are using a Windows device, you can deploy from the web to your Minecraft folder by dragging and
          dropping your com.mojang folder onto this dialog.
        </div>
        <p className="wld-caution">
          Caution! This is a very early preview feature. Make sure all of your Minecraft content is backed up!
        </p>

        <div className="wld-instructionArea">
          <div className="wld-stepArea">
            1. <b>Find your Minecraft com.mojang folder.</b> You can find your Minecraft com.mojang folder at one of
            these locations. Copy the path, select Start, then select Run, and paste one of the paths below to open the
            folder.
          </div>
          <div className="wld-optionsArea">
            <div className="wld-summaryCell">Main Minecraft Path</div>
            <div className="wld-pathCell" ref={(c: HTMLDivElement) => this._setMainPathLink(c)}>
              %localappdata%\Packages\Microsoft.MinecraftUWP_8wekyb3d8bbwe\LocalState\games\
            </div>
            <div className="wld-copyButton">
              <IconButton onClick={this._copyMainPathLink} size="small" title="Copy main path">
                <FontAwesomeIcon icon={faCopy} className="fa-lg" />
              </IconButton>
            </div>
          </div>
          <div className="wld-optionsArea">
            <div className="wld-summaryCell">Preview Minecraft Path</div>
            <div className="wld-pathCell" ref={(c: HTMLDivElement) => this._setPreviewPathLink(c)}>
              %localappdata%\Packages\Microsoft.MinecraftWindowsBeta_8wekyb3d8bbwe\LocalState\games\
            </div>
            <div className="wld-copyButton">
              <IconButton onClick={this._copyPreviewPathLink} size="small" title="Copy preview path">
                <FontAwesomeIcon icon={faCopy} className="fa-lg" />
              </IconButton>
            </div>
          </div>
          <div className="wld-stepArea">
            2. <b>Drop your com.mojang folder here.</b>
          </div>
          <div>{successfullyFoundFolder}</div>
        </div>
      </div>
    );
  }
}
