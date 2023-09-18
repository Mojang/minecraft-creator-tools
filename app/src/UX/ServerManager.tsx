import { Component } from "react";
import "./ServerManager.css";
import IAppProps from "./IAppProps";
import { AppMode } from "./App";
import Project from "../app/Project";
import MinecraftDisplay from "./MinecraftDisplay";
import { ThemeInput, Toolbar } from "@fluentui/react-northstar";
import { BackLabel } from "./Labels";

interface IServerManagerProps extends IAppProps {
  theme: ThemeInput<any>;
  displayBackButton: boolean;
  hideTitlebar?: boolean;
  heightOffset: number;
  onModeChangeRequested?: (mode: AppMode) => void;
  onProjectSelected?: (project: Project) => void;
}

interface IServerManagerState {
  mode: ServerManagerMode;
}

export enum ServerManagerMode {
  configuring = 0,
  executing = 1,
  done = 2,
}

export default class ServerManager extends Component<IServerManagerProps, IServerManagerState> {
  constructor(props: IServerManagerProps) {
    super(props);
    this._goBack = this._goBack.bind(this);
    this.state = {
      mode: ServerManagerMode.configuring,
    };
  }

  _goBack() {
    if (this.props.onModeChangeRequested) {
      this.props.onModeChangeRequested(AppMode.home);
    }
  }

  render() {
    let serverTitle = "Server Manager";
    let motd = undefined;

    const interior = [];

    //@ts-ignore
    if (typeof g_serverTitle !== "undefined") {
      //@ts-ignore
      serverTitle = g_serverTitle;
    }

    //@ts-ignore
    if (typeof g_serverMotd !== "undefined") {
      //@ts-ignore
      motd = g_serverMotd;

      interior.push(<div className="sm-motd">{motd}</div>);
    }
    let backArea = <></>;

    const toolbarItems: any[] = [];

    toolbarItems.push({
      icon: <BackLabel isCompact={false} />,
      key: "back",
      onClick: this._goBack,
      title: "Back in Minecraft",
    });

    if (this.props.displayBackButton) {
      backArea = (
        <div className="sm-topTools">
          <Toolbar aria-label="Editor toolbar overflow menu" items={toolbarItems} />
        </div>
      );
    }

    let titleBar = <></>;

    if (!this.props.hideTitlebar) {
      titleBar = (
        <div className="sm-actionsHeader">
          {backArea}
          <div className="sm-title">{serverTitle}</div>
        </div>
      );
    }

    return (
      <div
        className="sm-outer"
        style={{
          minHeight: "calc(100vh - " + this.props.heightOffset + "px)",
          maxHeight: "calc(100vh - " + this.props.heightOffset + "px)",
        }}
      >
        {titleBar}
        <div className="sm-settingsArea">
          {interior}
          <MinecraftDisplay
            widthOffset={20}
            forceCompact={false}
            theme={this.props.theme}
            carto={this.props.carto}
            heightOffset={this.props.heightOffset + (this.props.hideTitlebar ? 0 : 24)}
            ensureMinecraftOnLogin={true}
          />
        </div>
      </div>
    );
  }
}
