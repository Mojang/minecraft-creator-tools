import { Component } from "react";
import IAppProps from "./IAppProps";
import "./MinecraftGameSettingsPanel.css";
import { CartoMinecraftState } from "../app/Carto";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Button, Dropdown, DropdownProps, Input } from "@fluentui/react-northstar";
import { faCogs } from "@fortawesome/free-solid-svg-icons";
import AppServiceProxy from "../core/AppServiceProxy";
import Utilities from "../core/Utilities";
import IMinecraft from "../app/IMinecraft";

interface IMinecraftGameSettingsPanelProps extends IAppProps {}

interface IMinecraftGameSettingsPanelState {
  activeCommandIndex: number;
}

export default class MinecraftGameSettingsPanel extends Component<
  IMinecraftGameSettingsPanelProps,
  IMinecraftGameSettingsPanelState
> {
  private modeOptions = ["Minecraft on this PC", "Minecraft Preview on this PC", "Remote Minecraft (connect only)"];
  _isMountedInternal = false;

  constructor(props: IMinecraftGameSettingsPanelProps) {
    super(props);

    this._update = this._update.bind(this);
    this._connectionStateChanged = this._connectionStateChanged.bind(this);

    this._simulateConnection = this._simulateConnection.bind(this);
    this._connectToProps();

    this._handleModeChanged = this._handleModeChanged.bind(this);

    this.state = {
      activeCommandIndex: 0,
    };
  }

  componentDidMount() {
    this._isMountedInternal = true;
  }

  componentWillUnmount(): void {
    this._isMountedInternal = false;
  }

  _connectionStateChanged(minecraft: IMinecraft, connectionState: CartoMinecraftState) {
    this._update();
  }

  componentDidUpdate(prevProps: IMinecraftGameSettingsPanelProps, prevState: IMinecraftGameSettingsPanelState) {
    if (prevProps !== undefined && prevProps.carto !== undefined) {
      prevProps.carto.onMinecraftStateChanged.unsubscribe(this._connectionStateChanged);
    }

    this._connectToProps();
  }

  _connectToProps() {
    if (this.props.carto !== undefined) {
      this.props.carto.onMinecraftStateChanged.subscribe(this._connectionStateChanged);
    }
  }

  _update() {
    if (this._isMountedInternal) {
      this.forceUpdate();
    }
  }

  _handleModeChanged(
    event: React.MouseEvent<Element, MouseEvent> | React.KeyboardEvent<Element> | null,
    data: DropdownProps
  ) {
    for (let i = 0; i < this.modeOptions.length; i++) {
      const slot = this.modeOptions[i];

      if (slot === data.value && this.props.carto.minecraftGameMode !== i) {
        this.props.carto.minecraftGameMode = i;
        this.props.carto.save();
      }
    }
  }

  _simulateConnection() {
    //   this.props.carto.notifyWebSocketStateChanged(CartoWebSocketState.connected);
  }

  render() {
    if (this.props === undefined || this.state === undefined) {
      return <></>;
    }

    const additional = [];

    if (!AppServiceProxy.hasAppService && Utilities.isDebug) {
      additional.push(
        <Button
          content="Simulate connection"
          icon={<FontAwesomeIcon icon={faCogs} className="fa-lg" />}
          onClick={this._simulateConnection}
          iconPosition="before"
          primary
        />
      );
    }

    let mode = 0;

    if (this.props.carto.minecraftGameMode) {
      mode = this.props.carto.minecraftGameMode;
    }

    return (
      <div className="migs-outer">
        <div className="migs-header">Minecraft Game Connection Settings</div>
        <div className="migs-label migs-modelabel" key="modelabel">
          Connect and deploy to:
        </div>

        <div className="migs-modeinput" key="modeinput">
          <Dropdown
            items={this.modeOptions}
            key="mode"
            defaultValue={this.modeOptions[mode]}
            placeholder="Choose a deployment slot"
            onChange={this._handleModeChanged}
          />
        </div>

        <div className="migs-connectHeader">Connect to Minecraft game</div>

        <div className="migs-instruction">
          To connect a Minecraft game and add new tools, run the following command in game:
        </div>
        <div className="migs-connString">
          <Input readOnly value="/connect localhost:19136" />
        </div>

        {additional}
      </div>
    );
  }
}
