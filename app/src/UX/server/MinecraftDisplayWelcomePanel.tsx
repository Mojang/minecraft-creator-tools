import { Component, SyntheticEvent } from "react";
import IAppProps from "../appShell/IAppProps";
import "./MinecraftDisplayWelcomePanel.css";
import { Button } from "@mui/material";
import IPersistable from "../types/IPersistable";
import CreatorToolsHost, { HostType } from "../../app/CreatorToolsHost";
import WebUtilities from "../utils/WebUtilities";
import { MinecraftFlavor } from "../../app/ICreatorToolsData";
import { constants } from "../../core/Constants";
import { getThemeColors } from "../hooks/theme/useThemeColors";
import IProjectTheme from "../types/IProjectTheme";

interface IMinecraftDisplayWelcomePanelProps extends IAppProps {
  setActivePersistable?: (persistObject: IPersistable) => void;
  forceCompact?: boolean;
  isWebServer?: boolean;
  theme: IProjectTheme;
  onPanelSelected?: (flavor: MinecraftFlavor) => void;
}

interface IMinecraftDisplayWelcomePanelState {
  flavor: MinecraftFlavor;
}

export default class MinecraftDisplayWelcomePanel extends Component<
  IMinecraftDisplayWelcomePanelProps,
  IMinecraftDisplayWelcomePanelState
> {
  private _activeEditorPersistable?: IPersistable;

  constructor(props: IMinecraftDisplayWelcomePanelProps) {
    super(props);

    this.persist = this.persist.bind(this);
    this._handleNewChildPersistable = this._handleNewChildPersistable.bind(this);
    this._handleNextClick = this._handleNextClick.bind(this);
    this._handleRadioButtonChange = this._handleRadioButtonChange.bind(this);
    this._handleProcessHostedClick = this._handleProcessHostedClick.bind(this);
    this._handleMinecraftGameClick = this._handleMinecraftGameClick.bind(this);
    this._handleRemoteClick = this._handleRemoteClick.bind(this);

    if (this.props.creatorTools.lastActiveMinecraftFlavor === undefined) {
      this.state = {
        flavor: MinecraftFlavor.none,
      };
    } else {
      this.state = {
        flavor: this.props.creatorTools.lastActiveMinecraftFlavor,
      };
    }
  }

  _handleNewChildPersistable(newPersistable: IPersistable) {
    this._activeEditorPersistable = newPersistable;
  }

  async persist(): Promise<boolean> {
    if (this._activeEditorPersistable !== undefined) {
      return await this._activeEditorPersistable.persist();
    }

    return false;
  }

  _handleProcessHostedClick() {
    this.setFlavor(MinecraftFlavor.processHostedProxy);
  }

  _handleMinecraftGameClick() {
    this.setFlavor(MinecraftFlavor.minecraftGameProxy);
  }

  _handleRemoteClick() {
    this.setFlavor(MinecraftFlavor.remote);
  }

  setFlavor(newFlav: MinecraftFlavor) {
    this.props.creatorTools.setMinecraftFlavor(newFlav);

    let flav = this.props.creatorTools.lastActiveMinecraftFlavor;

    if (flav === undefined) {
      flav = MinecraftFlavor.none;
    }

    this.setState({
      flavor: flav,
    });

    if (this.props.onPanelSelected) {
      this.props.onPanelSelected(flav);
    }
  }

  _handleRadioButtonChange(e: SyntheticEvent, value: string | undefined) {
    if (value) {
      switch (value) {
        case "game":
          this.props.creatorTools.setMinecraftFlavor(MinecraftFlavor.minecraftGameProxy);
          break;
        case "processHosted":
          this.props.creatorTools.setMinecraftFlavor(MinecraftFlavor.processHostedProxy);
          break;
        case "remote":
          this.props.creatorTools.setMinecraftFlavor(MinecraftFlavor.remote);
          break;
      }
    }

    let flav = this.props.creatorTools.lastActiveMinecraftFlavor;

    if (flav === undefined) {
      flav = MinecraftFlavor.none;
    }

    this.setState({
      flavor: flav,
    });
  }

  _handleNextClick() {
    if (this.props.onPanelSelected) {
      this.props.onPanelSelected(this.state.flavor);
    }
  }

  render() {
    if (this.props === undefined || this.state === undefined) {
      return <></>;
    }

    let outerClassNameModifier = "";
    const width = WebUtilities.getWidth();

    if (width < 1016 || this.props.forceCompact === true) {
      outerClassNameModifier = "Compact";
    }

    const choiceOptions =
      "Minecraft Creator Tools features options you can choose from to automate your Minecraft deployments:";

    const docs = [];
    const colors = getThemeColors();

    const remoteElt = (
      <div className="mima-remoteText" key="remote">
        <div className="mima-optionHeader">Remote Minecraft Server</div>
        <br />
        Connect to a Minecraft server hosted on another computer. To host a Minecraft server, visit{" "}
        <a
          href={constants.homeUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="mima-link"
          style={{
            color: colors.foreground2,
          }}
        >
          {constants.homeUrl}
        </a>
        , and use either Minecraft Server Manager (a Windows app) or download the Minecraft Creator command line tools,
        and use the <span className="mima-code">npx mct serve</span> command line.
      </div>
    );

    if (CreatorToolsHost.hostType !== HostType.web && CreatorToolsHost.hostType !== HostType.vsCodeWebWeb) {
      docs.push(
        <div className="mima-intro" key="intro">
          {choiceOptions}
        </div>
      );

      docs.push(
        <Button
          key="game"
          className={
            this.state && this.state.flavor === MinecraftFlavor.minecraftGameProxy
              ? "mima-modeButton mima-modeButton-selected"
              : "mima-modeButton"
          }
          onClick={this._handleMinecraftGameClick}
        >
          <div className="mima-minecraftGameText">
            <div className="mima-optionHeader">Minecraft Windows app</div>
            <br />
            Connect to your local Minecraft Windows app (or Minecraft Preview) app. Once you are in Minecraft, use the{" "}
            <span className="mima-code">/connect</span> command to connect back to this application, which opens
            additional monitoring and command capabilities.
          </div>
        </Button>
      );

      docs.push(
        <Button
          key="processHosted"
          className={
            this.state && this.state.flavor === MinecraftFlavor.processHostedProxy
              ? "mima-modeButton mima-modeButton-selected"
              : "mima-modeButton"
          }
          onClick={this._handleProcessHostedClick}
        >
          <div className={"mima-hostedText"}>
            <div className="mima-optionHeader">Host Minecraft Server</div>
            <br />
            Host Minecraft Server from within {CreatorToolsHost.isVsCode ? "VSCode" : "this app"}. Minecraft Server is
            automatically downloaded and run from{" "}
            <a
              href="https://www.minecraft.net/en-us/download/server/bedrock"
              target="_blank"
              rel="noreferrer noopener"
              className="mima-link"
              style={{
                color: colors.foreground2,
              }}
            >
              minecraft.net
            </a>{" "}
            - or run a custom version from a folder.
          </div>
        </Button>
      );

      docs.push(
        <Button
          key="remote"
          className={
            this.state && this.state.flavor === MinecraftFlavor.remote
              ? "mima-modeButton mima-modeButton-selected"
              : "mima-modeButton"
          }
          onClick={this._handleRemoteClick}
        >
          {remoteElt}
        </Button>
      );
    } else if (!this.props.isWebServer) {
      docs.push(
        <div className="mima-intro" key="intro2">
          With the remote option, you can connect to a Minecraft Creator Tools-based server hosted elsewhere.
        </div>
      );

      docs.push(remoteElt);
    }

    return (
      <div
        className="mima-outer"
        style={{
          backgroundColor: colors.background2,
          color: colors.foreground2,
        }}
      >
        <div className="mima-header">Connect to Minecraft</div>
        <div className={"mima-content" + outerClassNameModifier}>{docs}</div>
      </div>
    );
  }
}
