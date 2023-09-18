import { Component, SyntheticEvent } from "react";
import IAppProps from "./IAppProps";
import Log from "./../core/Log";
import Carto from "./../app/Carto";
import "./CartoSettingsPanel.css";
import { Input, InputProps, Button, ThemeInput, CheckboxProps, Checkbox } from "@fluentui/react-northstar";
import IPersistable from "./IPersistable";
import AppServiceProxy, { AppServiceProxyCommands } from "./../core/AppServiceProxy";
import CartoApp, { HostType } from "../app/CartoApp";

interface ICartoSettingsPanelProps extends IAppProps {
  theme: ThemeInput<any>;
  setActivePersistable?: (persistObject: IPersistable) => void;
}

interface ICartoSettingsPanelState {
  serverFolderPath: string | undefined;
  autoStartMinecraft: boolean | undefined;
}

export default class CartoSettingsPanel
  extends Component<ICartoSettingsPanelProps, ICartoSettingsPanelState>
  implements IPersistable
{
  private _activeEditorPersistable?: IPersistable;

  constructor(props: ICartoSettingsPanelProps) {
    super(props);

    this.persist = this.persist.bind(this);
    this._handleNewChildPersistable = this._handleNewChildPersistable.bind(this);
    this._handleServerPathChanged = this._handleServerPathChanged.bind(this);
    this._handleAutoStartChanged = this._handleAutoStartChanged.bind(this);
    this._handleSelectFolderClick = this._handleSelectFolderClick.bind(this);
    this._onCartoLoaded = this._onCartoLoaded.bind(this);

    this.state = {
      serverFolderPath: this.props.carto.dedicatedServerPath,
      autoStartMinecraft: this.props.carto.autoStartMinecraft,
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
    Log.debug("Opening folder via services.");

    const result = await AppServiceProxy.sendAsync(AppServiceProxyCommands.openFolder, "");

    if (result.length > 0) {
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

    let openFolderCtrl = <></>;
    serverProps.push(<div className="csp-label csp-autostartlabel">Start Minecraft services when app opens</div>);

    serverProps.push(
      <div className="csp-autostart">
        <Checkbox checked={this.props.carto.autoStartMinecraft} toggle={true} onClick={this._handleAutoStartChanged} />
      </div>
    );
    if (
      AppServiceProxy.hasAppServiceOrDebug ||
      CartoApp.hostType === HostType.vsCodeWebWeb ||
      CartoApp.hostType === HostType.vsCodeMainWeb
    ) {
      if (AppServiceProxy.hasAppService) {
        openFolderCtrl = <Button onClick={this._handleSelectFolderClick} content="Open folder" />;
      }
      serverProps.push(<div className="csp-label csp-namelabel">Dedicated Server Path</div>);

      serverProps.push(
        <div className="csp-nameinput">
          <Input value={this.state.serverFolderPath} onChange={this._handleServerPathChanged} />
          {openFolderCtrl}
        </div>
      );
    }

    return <div className="csp-grid"> {serverProps} </div>;
  }
}
