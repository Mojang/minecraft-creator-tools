import { Component } from "react";
import IAppProps from "../appShell/IAppProps";
import CreatorTools, { CreatorToolsMinecraftErrorStatus, CreatorToolsMinecraftState } from "../../app/CreatorTools";
import "./RemoteServerSettingsPanel.css";
import { TextField, Button, Select, MenuItem, SelectChangeEvent, FormControl } from "@mui/material";
import IPersistable from "../types/IPersistable";
import CreatorToolsAuthentication from "../../app/CreatorToolsAuthentication";
import CreatorToolsHost from "../../app/CreatorToolsHost";
import WebUtilities from "../utils/WebUtilities";
import MinecraftUtilities from "../../minecraft/MinecraftUtilities";

interface IRemoteServerSettingsPanelProps extends IAppProps {
  setActivePersistable?: (persistObject: IPersistable) => void;
  ensureMinecraftOnLogin: boolean;
  isWebServer?: boolean;
  forceCompact?: boolean;
}

interface IRemoteServerSettingsPanelState {
  remoteServerUrl: string | undefined;
  remoteServerPort: number | undefined;
  remoteServerPasscode: string | undefined;
  authentication: CreatorToolsAuthentication | undefined;
}

export default class RemoteServerSettingsPanel extends Component<
  IRemoteServerSettingsPanelProps,
  IRemoteServerSettingsPanelState
> {
  private _activeEditorPersistable?: IPersistable;
  // Slot labels are generated dynamically using MinecraftUtilities.getPortForSlot()
  private slots = [
    `0 (port ${MinecraftUtilities.getPortForSlot(0)})`,
    `1 (port ${MinecraftUtilities.getPortForSlot(1)})`,
  ];

  constructor(props: IRemoteServerSettingsPanelProps) {
    super(props);

    this.persist = this.persist.bind(this);
    this._handleNewChildPersistable = this._handleNewChildPersistable.bind(this);
    this._handleRemoteUrlChanged = this._handleRemoteUrlChanged.bind(this);
    this._handleRemotePortChanged = this._handleRemotePortChanged.bind(this);
    this._handleRemoteServerPasscodeChanged = this._handleRemoteServerPasscodeChanged.bind(this);
    this._handleLoginClick = this._handleLoginClick.bind(this);
    this._handleSlotChanged = this._handleSlotChanged.bind(this);

    this._onCartoLoaded = this._onCartoLoaded.bind(this);

    let port = this.props.creatorTools.remoteServerPort;

    if (!port) {
      port = 0;
    }

    this.state = {
      remoteServerUrl: this.props.creatorTools.remoteServerUrl,
      remoteServerPort: port,
      remoteServerPasscode: this.props.creatorTools.remoteServerPasscode,
      authentication: undefined,
    };

    if (!this.props.creatorTools.onLoaded.has(this._onCartoLoaded)) {
      this.props.creatorTools.onLoaded.subscribe(this._onCartoLoaded);
    }

    this.props.creatorTools.load();
  }

  private _onCartoLoaded(source: CreatorTools, target: CreatorTools) {
    this.setState({
      remoteServerUrl: this.props.creatorTools.remoteServerUrl,
    });
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

  _updatePreferredTextSize(newTextSize: number) {
    this.props.creatorTools.preferredTextSize = newTextSize;
  }

  _handleRemoteUrlChanged(e: React.ChangeEvent<HTMLInputElement>) {
    if (this.props.creatorTools === null || this.state == null) {
      return;
    }

    const value = e.target.value;
    if (value !== this.props.creatorTools.remoteServerUrl) {
      this.props.creatorTools.remoteServerUrl = value;
      this.props.creatorTools.save();

      this.setState({
        remoteServerUrl: value,
        remoteServerPasscode: this.state.remoteServerPasscode,
        authentication: this.state.authentication,
      });
    }
  }

  _handleRemotePortChanged(e: React.ChangeEvent<HTMLInputElement>) {
    if (this.props.creatorTools === null || this.state == null) {
      return;
    }

    let valInt = -1;

    try {
      valInt = parseInt(e.target.value);
    } catch (e) {
      return;
    }

    if (valInt < 80 || valInt > 65535) {
      return;
    }

    if (valInt !== this.props.creatorTools.remoteServerPort) {
      this.props.creatorTools.remoteServerPort = valInt;
      this.props.creatorTools.save();

      this.setState({
        remoteServerUrl: this.state.remoteServerUrl,
        remoteServerPort: valInt,
        remoteServerPasscode: this.state.remoteServerPasscode,
        authentication: this.state.authentication,
      });
    }
  }

  _getSlotFromSlotOrPort() {
    let slot = this.props.creatorTools.remoteServerPort;

    if (slot === undefined) {
      slot = 0;
    }

    // If the stored value is a port number (>= base port), convert to slot
    if (slot >= MinecraftUtilities.getPortForSlot(0)) {
      slot = MinecraftUtilities.getSlotFromPort(slot);
    }

    return slot;
  }

  _handleSlotChanged(event: SelectChangeEvent<string>) {
    const value = event.target.value;
    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i];

      if (slot === value && this.props.creatorTools.remoteServerPort !== i) {
        this.props.creatorTools.remoteServerPort = i;
        this.props.creatorTools.save();

        this.setState({
          remoteServerPort: i,
        });
      }
    }
  }

  _handleRemoteServerPasscodeChanged(e: React.ChangeEvent<HTMLInputElement>) {
    if (this.props.creatorTools === null || this.state == null) {
      return;
    }

    const value = e.target.value;
    if (value !== this.props.creatorTools.remoteServerPasscode) {
      this.props.creatorTools.remoteServerPasscode = value;
      this.props.creatorTools.save();

      this.setState({
        remoteServerUrl: this.state.remoteServerUrl,
        remoteServerPort: this.state.remoteServerPort,
        remoteServerPasscode: value,
        authentication: this.state.authentication,
      });
    }
  }

  async _handleLoginClick() {
    this.props.creatorTools.ensureRemoteMinecraft();

    if (this.props.creatorTools.remoteMinecraft === undefined) {
      return;
    }

    if (this.props.ensureMinecraftOnLogin) {
      await this.props.creatorTools.connectToMinecraft();
    } else {
      await this.props.creatorTools.remoteMinecraft.initialize();
    }

    this.setState({
      remoteServerUrl: this.state.remoteServerUrl,
      remoteServerPort: this.state.remoteServerPort,
      remoteServerPasscode: this.state.remoteServerPasscode,
    });
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

    let connectingStatus = <></>;

    if (this.props.creatorTools.remoteMinecraft) {
      let errMessage = this.props.creatorTools.remoteMinecraft.errorMessage;

      //  remove not-useful parts of axios errors.
      errMessage = errMessage?.replace("AxiosError:", "");
      errMessage = errMessage?.replace("Network Error", "");

      if (this.props.creatorTools.remoteMinecraft.state === CreatorToolsMinecraftState.initializing) {
        connectingStatus = <div className={"rssp-serverStatus" + outerClassNameModifier}>Connecting...</div>;
      } else if (this.props.creatorTools.remoteMinecraft.errorStatus === CreatorToolsMinecraftErrorStatus.loginFailed) {
        connectingStatus = (
          <div className={"rssp-serverStatus" + outerClassNameModifier}>Login failed - check passcode</div>
        );
      } else if (this.props.creatorTools.remoteMinecraft.errorStatus === CreatorToolsMinecraftErrorStatus.none) {
        connectingStatus = <div className={"rssp-serverStatus" + outerClassNameModifier}>Success</div>;
      } else if (
        this.props.creatorTools.remoteMinecraft.errorStatus === CreatorToolsMinecraftErrorStatus.actionInProgress
      ) {
        connectingStatus = <div className={"rssp-serverStatus" + outerClassNameModifier}>Pending</div>;
      } else if (
        this.props.creatorTools.remoteMinecraft.errorStatus === CreatorToolsMinecraftErrorStatus.serverUnavailable
      ) {
        connectingStatus = (
          <div className={"rssp-serverStatus" + outerClassNameModifier}>
            Server at {this.props.creatorTools.fullRemoteServerUrl} is not available. {errMessage}
          </div>
        );
      } else if (this.props.creatorTools.remoteMinecraft.state === CreatorToolsMinecraftState.initialized) {
        connectingStatus = <div className={"rssp-serverStatus" + outerClassNameModifier}>Connected</div>;
      } else if (this.props.creatorTools.remoteMinecraft.state === CreatorToolsMinecraftState.disconnected) {
        connectingStatus = <div className={"rssp-serverStatus" + outerClassNameModifier}>{errMessage}</div>;
      } else if (errMessage !== undefined && errMessage.length >= 0) {
        connectingStatus = <div className={"rssp-serverStatus" + outerClassNameModifier}>Error ({errMessage})</div>;
      }
    }

    const serverProps = [];

    if (!CreatorToolsHost.baseUrl) {
      serverProps.push(
        <div className={"rssp-label rssp-namelabel" + outerClassNameModifier} key="namelabel" id="rssp-label-namelabel">
          Server URL/IP address
        </div>
      );
      serverProps.push(
        <div className="rssp-nameinput" key="nameinput">
          <TextField
            id="rssp-nameinput"
            aria-labelledby="rssp-label-namelabel"
            value={this.state.remoteServerUrl}
            onChange={this._handleRemoteUrlChanged}
            placeholder="https://myserver/"
            size="small"
            fullWidth
          />
        </div>
      );
    }

    let isConnected =
      this.props.creatorTools.remoteMinecraft &&
      this.props.creatorTools.remoteMinecraft.state !== CreatorToolsMinecraftState.none &&
      this.props.creatorTools.remoteMinecraft.state !== CreatorToolsMinecraftState.disconnected &&
      this.props.creatorTools.remoteMinecraft.state !== CreatorToolsMinecraftState.error;

    if (!isConnected) {
      serverProps.push(
        <div
          className={"rssp-label rssp-pclabel" + outerClassNameModifier}
          key="pclabel"
          id="rssp-label-pclabel"
        >
          Server Passcode
        </div>
      );

      const passcode = this.state.remoteServerPasscode;
      let passwordMessage = <></>;

      if (passcode && passcode.replace(/-/g, "").length !== 8) {
        passwordMessage = (
          <div className="rssp-passwordMessage" key="pwmess">
            Passcode must be 8 characters. You can see the generated passcodes for your server from the command line.
          </div>
        );
      }

      serverProps.push(
        <div className="rssp-pcinput" key="pcinput">
          <TextField
            type="password"
            value={this.state.remoteServerPasscode}
            onChange={this._handleRemoteServerPasscodeChanged}
            size="small"
            sx={{ maxWidth: 200 }}
            inputProps={{
              // Wire the visible "Server Passcode" label to the input
              // (WCAG 1.3.1 / 4.1.2 — every form control needs an accessible name).
              "aria-labelledby": "rssp-label-pclabel",
            }}
          />
          {passwordMessage}
        </div>
      );

      // Always show Connect button - browser autofill may populate the password field
      // before our onChange handler fires, so we can't rely on passcode state
      serverProps.push(
        <div className="rssp-testConnect" key="testc">
          <Button className="rssp-connectBtn" onClick={this._handleLoginClick} size="small">
            Connect
          </Button>
          {connectingStatus}
        </div>
      );
    }

    // Only show slot selector here when NOT connected (it's in the toolbar when connected)
    if (!isConnected) {
      serverProps.push(
        <div className={"rssp-label rssp-portlabel" + outerClassNameModifier} key="portlabel" id="rssp-label-portlabel">
          Remote Server Slot
        </div>
      );

      serverProps.push(
        <div className="rssp-portinput" key="portinput">
          <FormControl size="small" fullWidth>
            <Select
              value={
                this.props.creatorTools.remoteServerPort !== undefined &&
                this.props.creatorTools.remoteServerPort >= 0 &&
                this.props.creatorTools.remoteServerPort <= 1
                  ? this.slots[this.props.creatorTools.remoteServerPort]
                  : ""
              }
              displayEmpty
              onChange={this._handleSlotChanged}
              labelId="rssp-label-portlabel"
            >
              <MenuItem value="" disabled>
                Choose a deployment slot
              </MenuItem>
              {this.slots.map((slot) => (
                <MenuItem key={slot} value={slot}>
                  {slot}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </div>
      );
    }

    let statusDescrip = "";
    let header = <></>;

    if (isConnected) {
      statusDescrip = "Connected";

      if (
        this.props.creatorTools.remoteMinecraft &&
        this.props.creatorTools.remoteMinecraft.state !== CreatorToolsMinecraftState.none
      ) {
        statusDescrip +=
          ", " + MinecraftUtilities.getServerStatusFromState(this.props.creatorTools.remoteMinecraft.state);
      }
    } else {
      statusDescrip = "Not connected";
      header = (
        <div className="rssp-header">{this.props.isWebServer ? "Login" : "Remote Server Connection Settings"}</div>
      );
    }

    // Hide status line in web server mode when connected (it's redundant with the toolbar)
    const showStatusLine = !this.props.isWebServer || !isConnected;

    return (
      <div className="rssp-outer">
        {header}
        {showStatusLine && <div className="rssp-connectedStatus">Status: {statusDescrip}</div>}

        <div className={"rssp-grid" + outerClassNameModifier}>{serverProps}</div>
      </div>
    );
  }
}
