import { Component } from "react";
import "./RemoteServerManager.css";
import { Stack, Button, IconButton } from "@mui/material";
import IAppProps from "../appShell/IAppProps";
import { AppMode } from "../appShell/App";
import Project from "../../app/Project";
import CreatorToolsHost from "../../app/CreatorToolsHost";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearchPlus, faSearchMinus } from "@fortawesome/free-solid-svg-icons";
import Log from "../../core/Log";
import RemoteServerSettingsPanel from "./RemoteServerSettingsPanel";

interface IRemoteServerManagerProps extends IAppProps {
  onModeChangeRequested?: (mode: AppMode) => void;
  onProjectSelected?: (project: Project) => void;
}

interface IRemoteServerManagerState {
  importPath?: string;
  exportPath?: string;
  mode: RemoteServerManagerMode;
}

export enum RemoteServerManagerMode {
  configuring = 0,
  executing = 1,
  done = 2,
}

export default class RemoteServerManager extends Component<IRemoteServerManagerProps, IRemoteServerManagerState> {
  constructor(props: IRemoteServerManagerProps) {
    super(props);

    this._handleExportClick = this._handleExportClick.bind(this);

    this.state = {
      importPath: undefined,
      exportPath: undefined,
      mode: RemoteServerManagerMode.configuring,
    };
  }

  _handleExportClick() {
    Log.debugAlert("Starting export!");
    if (CreatorToolsHost.postMessage) {
      CreatorToolsHost.postMessage({
        command: "export",
        id: CreatorToolsHost.projectPath,
      });
    }
  }

  render() {
    return (
      <div className="rsm-outer">
        <div className="rsm-area">
          <div className="rsm-actionsHeader">Minecraft</div>
          <div className="rsm-actionsToolBarArea">
            <Stack direction="row" spacing={1} aria-label="Remote server actions">
              <IconButton key="zoomIn" title="Zoom into the text editor" aria-label="Zoom in" size="small">
                <FontAwesomeIcon icon={faSearchPlus} className="fa-lg" />
              </IconButton>
              <IconButton key="zoomOut" title="Zoom out of the text editor" aria-label="Zoom out" size="small">
                <FontAwesomeIcon icon={faSearchMinus} className="fa-lg" />
              </IconButton>
            </Stack>
          </div>
          <div className="rsm-settingsArea">
            <RemoteServerSettingsPanel
              forceCompact={false}
              creatorTools={this.props.creatorTools}
              ensureMinecraftOnLogin={false}
            />
            <Button onClick={this._handleExportClick}>Export</Button>
          </div>
        </div>
      </div>
    );
  }
}
