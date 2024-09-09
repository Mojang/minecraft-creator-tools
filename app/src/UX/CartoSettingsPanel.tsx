import { Component, SyntheticEvent } from "react";
import IAppProps from "./IAppProps";
import Carto from "./../app/Carto";
import "./CartoSettingsPanel.css";
import {
  Input,
  InputProps,
  Button,
  ThemeInput,
  CheckboxProps,
  Checkbox,
  Dropdown,
  DropdownProps,
} from "@fluentui/react-northstar";
import IPersistable from "./IPersistable";
import AppServiceProxy, { AppServiceProxyCommands } from "./../core/AppServiceProxy";
import CartoApp, { HostType } from "../app/CartoApp";
import { MinecraftTrack } from "../app/ICartoData";

interface ICartoSettingsPanelProps extends IAppProps {
  theme: ThemeInput<any>;
  setActivePersistable?: (persistObject: IPersistable) => void;
}

interface ICartoSettingsPanelState {
  serverFolderPath: string | undefined;
  autoStartMinecraft: boolean | undefined;
  formatBeforeSave: boolean;
}

export const CartoTargetStrings = ["Latest Minecraft release", "Latest Minecraft preview"];

export default class CartoSettingsPanel extends Component<ICartoSettingsPanelProps, ICartoSettingsPanelState> {
  private _activeEditorPersistable?: IPersistable;

  constructor(props: ICartoSettingsPanelProps) {
    super(props);

    this.persist = this.persist.bind(this);
    this._handleNewChildPersistable = this._handleNewChildPersistable.bind(this);
    this._handleServerPathChanged = this._handleServerPathChanged.bind(this);
    this._handleAutoStartChanged = this._handleAutoStartChanged.bind(this);
    this._handleSelectFolderClick = this._handleSelectFolderClick.bind(this);
    this._handleFormatBeforeSaveChanged = this._handleFormatBeforeSaveChanged.bind(this);
    this._handleTrackChange = this._handleTrackChange.bind(this);
    this._onCartoLoaded = this._onCartoLoaded.bind(this);

    this.state = {
      serverFolderPath: this.props.carto.dedicatedServerPath,
      autoStartMinecraft: this.props.carto.autoStartMinecraft,
      formatBeforeSave: this.props.carto.formatBeforeSave,
    };

    this.props.carto.onLoaded.subscribe(this._onCartoLoaded);

    this.props.carto.load();
  }

  private _onCartoLoaded(source: Carto, target: Carto) {
    this.setState({
      serverFolderPath: this.props.carto.dedicatedServerPath,
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

  _handleFormatBeforeSaveChanged(e: SyntheticEvent, data: (CheckboxProps & { checked: boolean }) | undefined) {
    if (data === undefined || this.props.carto === null || this.state == null) {
      return;
    }

    this.props.carto.formatBeforeSave = data.checked;
    this.props.carto.save();

    this.setState({
      serverFolderPath: this.state.serverFolderPath,
      autoStartMinecraft: this.state.autoStartMinecraft,
      formatBeforeSave: this.state.formatBeforeSave,
    });
  }

  async _handleTrackChange(
    event: React.MouseEvent<Element, MouseEvent> | React.KeyboardEvent<Element> | null,
    data: DropdownProps
  ) {
    if (data.value === CartoTargetStrings[1]) {
      this.props.carto.track = MinecraftTrack.preview;
    } else {
      this.props.carto.track = MinecraftTrack.main;
    }

    await this.props.carto.save();
  }

  _handleAutoStartChanged(e: SyntheticEvent, data: (CheckboxProps & { checked: boolean }) | undefined) {
    if (data === undefined || this.props.carto === null || this.state == null) {
      return;
    }

    this.props.carto.autoStartMinecraft = data.checked;
    this.props.carto.save();

    this.setState({
      serverFolderPath: this.state.serverFolderPath,
      autoStartMinecraft: this.props.carto.autoStartMinecraft,
    });
  }

  _handleServerPathChanged(e: SyntheticEvent, data: (InputProps & { value: string }) | undefined) {
    if (data === undefined || this.props.carto === null || this.state == null) {
      return;
    }

    this.props.carto.dedicatedServerPath = data.value;
    this.props.carto.save();

    this.setState({
      serverFolderPath: data.value,
    });
  }

  private async _handleSelectFolderClick() {
    const result = await AppServiceProxy.sendAsync(AppServiceProxyCommands.openFolder, "");

    if (result && result.length > 0) {
      this.props.carto.dedicatedServerPath = result;
      this.setState({
        serverFolderPath: result,
      });
    }
  }

  render() {
    if (this.props === undefined || this.state === undefined) {
      return <></>;
    }

    const serverProps = [];
    const coreProps = [];

    coreProps.push(<div className="csp-label csp-tracklabel">Target Minecraft</div>);
    coreProps.push(
      <div className="csp-trackinput">
        <Dropdown
          items={CartoTargetStrings}
          placeholder="Select which version of Minecraft to target"
          defaultValue={
            this.props.carto.track === MinecraftTrack.preview ? CartoTargetStrings[1] : CartoTargetStrings[0]
          }
          onChange={this._handleTrackChange}
        />
      </div>
    );

    coreProps.push(
      <div className="csp-label csp-formatbeforesavelabel" key="csp-formatbeforesavelabel">
        Format JSON and script on open and save
      </div>
    );

    coreProps.push(
      <div className="csp-formatbeforesave" key="csp-formatbeforesave">
        <Checkbox
          checked={this.props.carto.formatBeforeSave}
          toggle={true}
          onClick={this._handleFormatBeforeSaveChanged}
        />
      </div>
    );

    if (
      AppServiceProxy.hasAppServiceOrDebug ||
      CartoApp.hostType === HostType.vsCodeWebWeb ||
      CartoApp.hostType === HostType.vsCodeMainWeb
    ) {
      let openFolderCtrl = <></>;
      serverProps.push(
        <div className="csp-label csp-autostartlabel" key="csp-autostartlabel">
          Start Minecraft services when app opens
        </div>
      );

      serverProps.push(
        <div className="csp-autostart" key="csp-as">
          <Checkbox
            checked={this.props.carto.autoStartMinecraft}
            toggle={true}
            onClick={this._handleAutoStartChanged}
          />
        </div>
      );
      if (AppServiceProxy.hasAppService) {
        openFolderCtrl = <Button onClick={this._handleSelectFolderClick} content="Open folder" />;
      }
      serverProps.push(
        <div className="csp-label csp-namelabel" key="csp-nl">
          Dedicated Server Path
        </div>
      );

      serverProps.push(
        <div className="csp-nameinput" key="csp-ni">
          <Input value={this.state.serverFolderPath} onChange={this._handleServerPathChanged} />
          {openFolderCtrl}
        </div>
      );
    }

    return (
      <div className="csp-grid">
        {coreProps}
        {serverProps}
      </div>
    );
  }
}
