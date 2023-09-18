import { Component } from "react";
import "./RemoteServerManager.css";
import { Toolbar, Button } from "@fluentui/react-northstar";
import IAppProps from "./IAppProps";
import { AppMode } from "./App";
import Project from "./../app/Project";
import CartoApp from "../app/CartoApp";
import { saveAs } from "file-saver";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearchPlus, faSearchMinus } from "@fortawesome/free-solid-svg-icons";
import Log from "../core/Log";
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
    this._handleDownloadClick = this._handleDownloadClick.bind(this);

    this.state = {
      importPath: undefined,
      exportPath: undefined,
      mode: RemoteServerManagerMode.configuring,
    };
  }

  _handleDownloadClick() {
    saveAs(new Blob(["temp"], { type: "text/plain;charset=utf-8" }), "test.txt");
  }

  _handleExportClick() {
    Log.debugAlert("Starting export!");
    if (CartoApp.postMessage) {
      CartoApp.postMessage({
        command: "export",
        id: CartoApp.projectPath,
      });
    }
  }

  render() {
    const toolbarItems = [
      {
        icon: <FontAwesomeIcon icon={faSearchPlus} className="fa-lg" />,
        key: "zoomIn",
        //  onClick: this._zoomIn,
        title: "Toggle whether hidden items are shown",
      },
      {
        icon: <FontAwesomeIcon icon={faSearchMinus} className="fa-lg" />,
        key: "zoomOut",
        //     onClick: this._zoomOut,
        title: "Toggle whether hidden items are shown",
      },
    ];
    return (
      <div className="rsm-outer">
        <div className="rsm-area">
          <div className="rsm-actionsHeader">Minecraft</div>
          <div className="rsm-actionsToolBarArea">
            <Toolbar aria-label="Export toolbar overflow menu" items={toolbarItems} />
          </div>
          <div className="rsm-settingsArea">
            <RemoteServerSettingsPanel forceCompact={false} carto={this.props.carto} ensureMinecraftOnLogin={false} />
            <Button onClick={this._handleExportClick} content="Export" />
            <Button onClick={this._handleDownloadClick} content="Download" />
          </div>
        </div>
      </div>
    );
  }
}
