import { Component, SyntheticEvent } from "react";
import IAppProps from "./IAppProps";
import Carto, { CartoMinecraftErrorStatus, CartoMinecraftState } from "./../app/Carto";
import "./RemoteServerSettingsPanel.css";
import { Input, InputProps, Button, Dropdown, DropdownProps } from "@fluentui/react-northstar";
import IPersistable from "./IPersistable";
import CartoAuthentication from "../app/CartoAuthentication";
import CartoApp from "../app/CartoApp";
import WebUtilities from "./WebUtilities";

interface IRemoteServerSettingsPanelProps extends IAppProps {
  setActivePersistable?: (persistObject: IPersistable) => void;
  ensureMinecraftOnLogin: boolean;
  forceCompact?: boolean;
}

interface IRemoteServerSettingsPanelState {
  remoteServerUrl: string | undefined;
  remoteServerPort: number | undefined;
  remoteServerPasscode: string | undefined;
  authentication: CartoAuthentication | undefined;
}

export default class RemoteServerSettingsPanel
  extends Component<IRemoteServerSettingsPanelProps, IRemoteServerSettingsPanelState>
  implements IPersistable
{
  private _activeEditorPersistable?: IPersistable;
  private slots = ["0 (port 19132)", "1 (port 19164)"];

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

    let port = this.props.carto.remoteServerPort;

    if (!port) {
      port = 0;
    }

    this.state = {
      remoteServerUrl: this.props.carto.remoteServerUrl,
      remoteServerPort: port,
      remoteServerPasscode: this.props.carto.remoteServerPasscode,
      authentication: undefined,
    };

    this.props.carto.onLoaded.subscribe(this._onCartoLoaded);

    this.props.carto.load();
  }

  private _onCartoLoaded(source: Carto, target: Carto) {
    this.setState({
      remoteServerUrl: this.props.carto.remoteServerUrl,
    });
  }

  _handleNewChildPersistable(newPersistable: IPersistable) {
    this._activeEditorPersistable = newPersistable;
  }

  async persist() {
    if (this._activeEditorPersistable !== undefined) {
      await this._activeEditorPersistable.persist();
    }
  }

  _updatePreferredTextSize(newTextSize: number) {
    this.props.carto.preferredTextSize = newTextSize;
  }

  _handleRemoteUrlChanged(e: SyntheticEvent, data: (InputProps & { value: string }) | undefined) {
    if (data === undefined || this.props.carto === null || this.state == null) {
      return;
    }

    if (data.value !== this.props.carto.remoteServerUrl) {
      this.props.carto.remoteServerUrl = data.value;
      this.props.carto.save();

      this.setState({
        remoteServerUrl: data.value,
        remoteServerPasscode: this.state.remoteServerPasscode,
        authentication: this.state.authentication,
      });
    }
  }

  _handleRemotePortChanged(e: SyntheticEvent, data: (InputProps & { value: string }) | undefined) {
    if (data === undefined || this.props.carto === null || this.state == null) {
      return;
    }

    let valInt = -1;

    try {
      valInt = parseInt(data.value);
    } catch (e) {
      return;
    }

    if (valInt < 80 || valInt > 65535) {
      return;
    }

    if (valInt !== this.props.carto.remoteServerPort) {
      this.props.carto.remoteServerPort = valInt;
      this.props.carto.save();

      this.setState({
        remoteServerUrl: this.state.remoteServerUrl,
        remoteServerPort: valInt,
        remoteServerPasscode: this.state.remoteServerPasscode,
        authentication: this.state.authentication,
      });
    }
  }

  _getSlotFromSlotOrPort() {
    let slot = this.props.carto.remoteServerPort;

    if (slot === undefined) {
      slot = 0;
    }

    if (slot >= 19132) {
      slot = (slot - 19132) / 64;
    }

    return slot;
  }

  _handleSlotChanged(
    event: React.MouseEvent<Element, MouseEvent> | React.KeyboardEvent<Element> | null,
    data: DropdownProps
  ) {
    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i];

      if (slot === data.value && this.props.carto.remoteServerPort !== i) {
        this.props.carto.remoteServerPort = i;
        this.props.carto.save();
      }
    }
  }

  _handleRemoteServerPasscodeChanged(e: SyntheticEvent, data: (InputProps & { value: string }) | undefined) {
    if (data === undefined || this.props.carto === null || this.state == null) {
      return;
    }

    if (data.value !== this.props.carto.remoteServerPasscode) {
      this.props.carto.remoteServerPasscode = data.value;
      this.props.carto.save();

      this.setState({
        remoteServerUrl: this.state.remoteServerUrl,
        remoteServerPort: this.state.remoteServerPort,
        remoteServerPasscode: data.value,
        authentication: this.state.authentication,
      });
    }
  }

  async _handleLoginClick() {
    this.props.carto.ensureRemoteMinecraft();

    if (this.props.carto.remoteMinecraft === undefined) {
      return;
    }

    if (this.props.ensureMinecraftOnLogin) {
      await this.props.carto.connectToMinecraft();
    } else {
      await this.props.carto.remoteMinecraft.initialize();
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

    let status = <></>;

    if (this.props.carto.remoteMinecraft) {
      let errMessage = this.props.carto.remoteMinecraft.errorMessage;

      //  remove not-useful parts of axios errors.
      errMessage = errMessage?.replace("AxiosError:", "");
      errMessage = errMessage?.replace("Network Error", "");

      if (this.props.carto.remoteMinecraft.state === CartoMinecraftState.initializing) {
        status = <div className={"rssp-serverStatus" + outerClassNameModifier}>Connecting...</div>;
      } else if (this.props.carto.remoteMinecraft.errorStatus === CartoMinecraftErrorStatus.loginFailed) {
        status = <div className={"rssp-serverStatus" + outerClassNameModifier}>Login failed - check passcode</div>;
      } else if (this.props.carto.remoteMinecraft.errorStatus === CartoMinecraftErrorStatus.none) {
        status = <div className={"rssp-serverStatus" + outerClassNameModifier}>Success</div>;
      } else if (this.props.carto.remoteMinecraft.errorStatus === CartoMinecraftErrorStatus.actionInProgress) {
        status = <div className={"rssp-serverStatus" + outerClassNameModifier}>Pending</div>;
      } else if (this.props.carto.remoteMinecraft.errorStatus === CartoMinecraftErrorStatus.serverUnavailable) {
        status = (
          <div className={"rssp-serverStatus" + outerClassNameModifier}>
            Server at {this.props.carto.fullRemoteServerUrl} is not available. {errMessage}
          </div>
        );
      } else if (this.props.carto.remoteMinecraft.state === CartoMinecraftState.initialized) {
        status = <div className={"rssp-serverStatus" + outerClassNameModifier}>Connected</div>;
      } else if (this.props.carto.remoteMinecraft.state === CartoMinecraftState.disconnected) {
        status = <div className={"rssp-serverStatus" + outerClassNameModifier}>{errMessage}</div>;
      } else {
        status = <div className={"rssp-serverStatus" + outerClassNameModifier}>Error ({errMessage})</div>;
      }
    }

    const serverProps = [];

    if (!CartoApp.baseUrl) {
      serverProps.push(
        <div className={"rssp-label rssp-namelabel" + outerClassNameModifier} key="namelabel">
          Server URL/IP address
        </div>
      );
      serverProps.push(
        <div className="rssp-nameinput" key="nameinput">
          <Input
            value={this.state.remoteServerUrl}
            onChange={this._handleRemoteUrlChanged}
            placeholder="https://myserver/"
          />
        </div>
      );
    }

    serverProps.push(
      <div className={"rssp-label rssp-pclabel" + outerClassNameModifier} key="pclabel">
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
        <Input
          type="password"
          value={this.state.remoteServerPasscode}
          onChange={this._handleRemoteServerPasscodeChanged}
        />
        {passwordMessage}
      </div>
    );

    if (passcode && passcode.replace(/-/g, "").length === 8) {
      serverProps.push(
        <div className="rssp-testConnect" key="testc">
          <Button onClick={this._handleLoginClick} content="Connect" />
          {status}
        </div>
      );
    }

    serverProps.push(
      <div className={"rssp-label rssp-portlabel" + outerClassNameModifier} key="portlabel">
        Remote Server Slot
      </div>
    );
    serverProps.push(
      <div className="rssp-portinput" key="portinput">
        <Dropdown
          items={this.slots}
          key="slots"
          defaultValue={
            this.props.carto.remoteServerPort !== undefined &&
            this.props.carto.remoteServerPort >= 0 &&
            this.props.carto.remoteServerPort <= 1
              ? this.slots[this.props.carto.remoteServerPort]
              : ""
          }
          placeholder="Choose a deployment slot"
          onChange={this._handleSlotChanged}
        />
      </div>
    );

    return (
      <div className="rssp-outer">
        <div className="rssp-header">Remote Server Connection Settings</div>
        <div className={"rssp-grid" + outerClassNameModifier}>{serverProps}</div>
      </div>
    );
  }
}
