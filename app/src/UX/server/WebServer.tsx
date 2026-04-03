import { Component } from "react";
import "./WebServer.css";
import IAppProps from "../appShell/IAppProps";
import { AppMode } from "../appShell/App";
import Project from "../../app/Project";
import MinecraftDisplay from "./MinecraftDisplay";
import IProjectTheme from "../types/IProjectTheme";

interface IWebServerProps extends IAppProps {
  theme: IProjectTheme;
  hideTitlebar?: boolean;
  heightOffset: number;
  onModeChangeRequested?: (mode: AppMode) => void;
  onProjectSelected?: (project: Project) => void;
}

interface IWebServerState {
  mode: WebServerMode;
}

export enum WebServerMode {
  configuring = 0,
  executing = 1,
  done = 2,
}

export default class WebServer extends Component<IWebServerProps, IWebServerState> {
  constructor(props: IWebServerProps) {
    super(props);
    this._goBack = this._goBack.bind(this);
    this.state = {
      mode: WebServerMode.configuring,
    };
  }

  _goBack() {
    if (this.props.onModeChangeRequested) {
      this.props.onModeChangeRequested(AppMode.home);
    }
  }

  render() {
    let serverTitle = "Minecraft Web Server";
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

      interior.push(<div className="wbsrv-motd">{motd}</div>);
    }

    if (typeof document !== "undefined") {
      document.title = serverTitle + " - Minecraft Creator Tools";
    }

    return (
      <div
        className="wbsrv-outer"
        style={{
          minHeight: "calc(100vh - " + this.props.heightOffset + "px)",
          maxHeight: "calc(100vh - " + this.props.heightOffset + "px)",
        }}
      >
        <div className="wbsrv-settingsArea">
          {interior}
          <MinecraftDisplay
            widthOffset={20}
            forceCompact={false}
            isWebServer={true}
            theme={this.props.theme}
            creatorTools={this.props.creatorTools}
            heightOffset={this.props.heightOffset + (this.props.hideTitlebar ? 0 : 0)}
            ensureMinecraftOnLogin={true}
          />
        </div>
      </div>
    );
  }
}
