import { Component } from "react";
import IAppProps from "../appShell/IAppProps";
import "./MinecraftGameSettingsPanel.css";
import { CreatorToolsMinecraftState } from "../../app/CreatorTools";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Button, Select, MenuItem, TextField, SelectChangeEvent, FormControl } from "@mui/material";
import { faCogs } from "@fortawesome/free-solid-svg-icons";
import AppServiceProxy from "../../core/AppServiceProxy";
import Utilities from "../../core/Utilities";
import IMinecraft from "../../app/IMinecraft";

interface IMinecraftGameSettingsPanelProps extends IAppProps {}

interface IMinecraftGameSettingsPanelState {
  activeCommandIndex: number;
}

export default class MinecraftGameSettingsPanel extends Component<
  IMinecraftGameSettingsPanelProps,
  IMinecraftGameSettingsPanelState
> {
  private modeOptions = [
    "Minecraft Bedrock app on this PC",
    "Minecraft Bedrock Preview app on this PC",
    "Remote Minecraft (connect only)",
  ];
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

  _connectionStateChanged(minecraft: IMinecraft, connectionState: CreatorToolsMinecraftState) {
    this._update();
  }

  componentDidUpdate(prevProps: IMinecraftGameSettingsPanelProps, prevState: IMinecraftGameSettingsPanelState) {
    if (prevProps !== undefined && prevProps.creatorTools !== undefined) {
      prevProps.creatorTools.onMinecraftStateChanged.unsubscribe(this._connectionStateChanged);
    }

    this._connectToProps();
  }

  _connectToProps() {
    if (
      this.props.creatorTools !== undefined &&
      !this.props.creatorTools.onMinecraftStateChanged.has(this._connectionStateChanged)
    ) {
      this.props.creatorTools.onMinecraftStateChanged.subscribe(this._connectionStateChanged);
    }
  }

  _update() {
    if (this._isMountedInternal) {
      this.forceUpdate();
    }
  }

  _handleModeChanged(event: SelectChangeEvent<string>) {
    const value = event.target.value;
    for (let i = 0; i < this.modeOptions.length; i++) {
      const slot = this.modeOptions[i];

      if (slot === value && this.props.creatorTools.minecraftGameMode !== i) {
        this.props.creatorTools.minecraftGameMode = i;
        this.props.creatorTools.save();
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
          onClick={this._simulateConnection}
          startIcon={<FontAwesomeIcon icon={faCogs} className="fa-lg" />}
          variant="contained"
          size="small"
        >
          Simulate connection
        </Button>
      );
    }

    let mode = 0;

    if (this.props.creatorTools.minecraftGameMode) {
      mode = this.props.creatorTools.minecraftGameMode;
    }

    return (
      <div className="migs-outer">
        <div className="migs-header">Minecraft Windows app connection</div>
        <div className="migs-label migs-modelabel" key="modelabel">
          Connect and deploy to:
        </div>

        <div className="migs-modeinput" key="modeinput">
          <FormControl size="small" fullWidth>
            <Select value={this.modeOptions[mode]} onChange={this._handleModeChanged}>
              {this.modeOptions.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </div>

        <div className="migs-connectHeader">Connect to Minecraft game</div>

        <div className="migs-instruction">
          To connect a Minecraft game and add new tools, run the following command in game:
        </div>
        <div className="migs-connString">
          <TextField InputProps={{ readOnly: true }} value="/connect localhost:19136" size="small" fullWidth />
        </div>

        {additional}
      </div>
    );
  }
}
