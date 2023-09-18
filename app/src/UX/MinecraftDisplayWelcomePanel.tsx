import { Component, SyntheticEvent } from "react";
import IAppProps from "./IAppProps";
import "./MinecraftDisplayWelcomePanel.css";
import { Button, RadioGroup, RadioGroupItemProps, ThemeInput } from "@fluentui/react-northstar";
import IPersistable from "./IPersistable";
import CartoApp, { HostType } from "../app/CartoApp";
import WebUtilities from "./WebUtilities";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlug } from "@fortawesome/free-solid-svg-icons";
import { MinecraftFlavor } from "../app/ICartoData";

interface IMinecraftDisplayWelcomePanelProps extends IAppProps {
  setActivePersistable?: (persistObject: IPersistable) => void;
  forceCompact?: boolean;
  theme: ThemeInput<any>;
  onPanelSelected?: (flavor: MinecraftFlavor) => void;
}

interface IMinecraftDisplayWelcomePanelState {
  flavor: MinecraftFlavor;
}

export default class MinecraftDisplayWelcomePanel
  extends Component<IMinecraftDisplayWelcomePanelProps, IMinecraftDisplayWelcomePanelState>
  implements IPersistable
{
  private _activeEditorPersistable?: IPersistable;

  constructor(props: IMinecraftDisplayWelcomePanelProps) {
    super(props);

    this.persist = this.persist.bind(this);
    this._handleNewChildPersistable = this._handleNewChildPersistable.bind(this);
    this._handleNextClick = this._handleNextClick.bind(this);
    this._handleRadioButtonChange = this._handleRadioButtonChange.bind(this);

    if (this.props.carto.lastActiveMinecraftFlavor === undefined) {
      this.state = {
        flavor: MinecraftFlavor.none,
      };
    } else {
      this.state = {
        flavor: this.props.carto.lastActiveMinecraftFlavor,
      };
    }
  }

  _handleNewChildPersistable(newPersistable: IPersistable) {
    this._activeEditorPersistable = newPersistable;
  }

  async persist() {
    if (this._activeEditorPersistable !== undefined) {
      await this._activeEditorPersistable.persist();
    }
  }

  _handleRadioButtonChange(e: SyntheticEvent, props: RadioGroupItemProps | undefined) {
    if (props && props.value) {
      switch (props.value) {
        case "game":
          this.props.carto.setMinecraftFlavor(MinecraftFlavor.minecraftGameProxy);
          break;
        case "processHosted":
          this.props.carto.setMinecraftFlavor(MinecraftFlavor.processHostedProxy);
          break;
        case "remote":
          this.props.carto.setMinecraftFlavor(MinecraftFlavor.remote);
          break;
      }
    }

    let flav = this.props.carto.lastActiveMinecraftFlavor;

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

    const docs = [];

    const remoteElt = (
      <div className="mima-remoteText" key="remote">
        <div className="mima-optionHeader">Remote Minecraft</div>
        <br />
        Connect to a Minecraft server hosted with Minecraft Creator Tools, on another computer. To host a Minecraft
        server, visit{" "}
        <a
          href="https://aka.ms/mctools"
          target="_blank"
          rel="noreferrer noopener"
          className="mima-link"
          style={{
            color: this.props.theme.siteVariables?.colorScheme.brand.foreground2,
          }}
        >
          https://aka.ms/mctools
        </a>
        , download the Minecraft Creator command line tools, and use the{" "}
        <span
          className="mima-code"
          style={{
            backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background5,
          }}
        >
          mct -serve
        </span>{" "}
        command line.
      </div>
    );

    if (CartoApp.hostType !== HostType.web && CartoApp.hostType !== HostType.vsCodeWebWeb) {
      const items = [];
      docs.push(
        <div className="mima-intro" key="intro">
          Minecraft Creator Tools features options you can choose from to automate your Minecraft deployments:
        </div>
      );

      items.push({
        name: "processHosted",
        key: "processHosted",
        value: "processHosted",
        label: (
          <div className="mima-hostedText">
            <div className="mima-optionHeader">Minecraft Dedicated Server</div>
            <br />
            Hosts Minecraft Dedicated Server from within {CartoApp.isVsCode ? "VSCode" : "this app"}. Dedicated Server
            is automatically downloaded and run from{" "}
            <a
              href="https://www.minecraft.net/en-us/download/server/bedrock"
              target="_blank"
              rel="noreferrer noopener"
              className="mima-link"
              style={{
                color: this.props.theme.siteVariables?.colorScheme.brand.foreground2,
              }}
            >
              minecraft.net
            </a>{" "}
            - or run a custom version from a folder.
          </div>
        ),
      });

      items.push({
        name: "game",
        key: "game",
        value: "game",
        label: (
          <div className="mima-minecraftGameText">
            <div className="mima-optionHeader">Minecraft Game on this PC</div>
            <br />
            Minecraft deploys to your local Minecraft (or Minecraft Preview) game folder, allowing you to develop
            against the Minecraft game installed on your PC. Once you are in Minecraft, use the{" "}
            <span
              className="mima-code"
              style={{
                backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background5,
              }}
            >
              /connect
            </span>{" "}
            command to connect back to this application, which opens additional debug and command capabilities.
          </div>
        ),
      });

      items.push({
        name: "remote",
        key: "remote",
        value: "remote",
        label: remoteElt,
      });

      let rbgVal = "processHosted";

      if (this.state && this.state.flavor === MinecraftFlavor.minecraftGameProxy) {
        rbgVal = "game";
      }

      if (this.state && this.state.flavor === MinecraftFlavor.remote) {
        rbgVal = "remote";
      }

      docs.push(
        <RadioGroup
          defaultCheckedValue={rbgVal}
          items={items}
          checkedValue={rbgVal}
          vertical={true}
          onCheckedValueChange={this._handleRadioButtonChange}
        />
      );
    } else {
      docs.push(
        <div className="mima-intro" key="intro2">
          With the remote option, you can connect to a Minecraft Creator Tools-based server hosted elsewhere.
        </div>
      );

      docs.push(remoteElt);
    }

    docs.push(
      <div className="mima-nextButtonArea" key="nba">
        <Button
          onClick={this._handleNextClick}
          icon={<FontAwesomeIcon icon={faPlug} className="fa-lg" />}
          content="Configure"
          key="connect"
          primary
        />
      </div>
    );

    return (
      <div
        className="mima-outer"
        style={{
          backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background2,
          color: this.props.theme.siteVariables?.colorScheme.brand.foreground2,
        }}
      >
        <div className="mima-header">Minecraft Management</div>
        <div className={"mima-content" + outerClassNameModifier}>{docs}</div>
      </div>
    );
  }
}
