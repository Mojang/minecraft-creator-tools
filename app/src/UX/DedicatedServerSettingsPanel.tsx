import { Component, SyntheticEvent } from "react";
import IAppProps from "./IAppProps";
import Carto from "./../app/Carto";
import "./DedicatedServerSettingsPanel.css";
import {
  Input,
  InputProps,
  Dropdown,
  Checkbox,
  CheckboxProps,
  Button,
  DropdownProps,
  ThemeInput,
} from "@fluentui/react-northstar";
import IPersistable from "./IPersistable";
import { DedicatedServerMode, MinecraftTrack } from "../app/ICartoData";
import AppServiceProxy, { AppServiceProxyCommands } from "../core/AppServiceProxy";
import Log from "../core/Log";

interface IDedicatedServerSettingsPanelProps extends IAppProps {
  setActivePersistable?: (persistObject: IPersistable) => void;
  theme: ThemeInput<any>;
  onChange?: (data: IDedicatedServerSettingsPanelProps) => void;
}

interface IDedicatedServerSettingsPanelState {
  dedicatedServerSlotCount: number | undefined;
  dedicatedServerPath: string | undefined;
  dedicatedServerMode: DedicatedServerMode | undefined;
  iagree: boolean | undefined;
}

export default class DedicatedServerSettingsPanel extends Component<
  IDedicatedServerSettingsPanelProps,
  IDedicatedServerSettingsPanelState
> {
  private _activeEditorPersistable?: IPersistable;
  private modeOptions = ["Minecraft server download", "Dedicated server source from path", "Run directly at path"];

  constructor(props: IDedicatedServerSettingsPanelProps) {
    super(props);

    this.persist = this.persist.bind(this);
    this._handleNewChildPersistable = this._handleNewChildPersistable.bind(this);
    this._handleDedicatedServerSlotCountChanged = this._handleDedicatedServerSlotCountChanged.bind(this);
    this._handleServerPathChanged = this._handleServerPathChanged.bind(this);
    this._handleSelectFolderClick = this._handleSelectFolderClick.bind(this);
    this._handleModeChanged = this._handleModeChanged.bind(this);
    this._handleIAgreeChanged = this._handleIAgreeChanged.bind(this);
    this._handleUsePreview = this._handleUsePreview.bind(this);
    this._notifyOnChange = this._notifyOnChange.bind(this);

    this._onCartoLoaded = this._onCartoLoaded.bind(this);

    let port = this.props.carto.dedicatedServerSlotCount;

    if (!port) {
      port = 4;
    }

    this.state = {
      dedicatedServerSlotCount: port,
      dedicatedServerMode: this.props.carto.dedicatedServerMode,
      dedicatedServerPath: this.props.carto.dedicatedServerPath,
      iagree: this.props.carto.iAgreeToTheMinecraftEndUserLicenseAgreementAndPrivacyPolicyAtMinecraftDotNetSlashTerms,
    };

    this.props.carto.onLoaded.subscribe(this._onCartoLoaded);

    this.props.carto.load();
  }

  private _notifyOnChange() {
    if (this.props.onChange) {
      this.props.onChange(this.props);
    }
  }

  private _onCartoLoaded(source: Carto, target: Carto) {
    this.setState({
      dedicatedServerSlotCount: this.props.carto.dedicatedServerSlotCount,
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

  _handleIAgreeChanged(e: SyntheticEvent, data: (CheckboxProps & { checked: boolean }) | undefined) {
    if (data) {
      this.props.carto.iAgreeToTheMinecraftEndUserLicenseAgreementAndPrivacyPolicyAtMinecraftDotNetSlashTerms =
        data.checked;
      this.props.carto.save();
      this._notifyOnChange();
    }
  }

  _handleUsePreview(e: SyntheticEvent, data: (CheckboxProps & { checked: boolean }) | undefined) {
    if (data) {
      if (data.checked) {
        this.props.carto.processHostedMinecraftTrack = MinecraftTrack.preview;
      } else {
        this.props.carto.processHostedMinecraftTrack = MinecraftTrack.main;
      }

      this.props.carto.save();
      this._notifyOnChange();
    }
  }

  _handleModeChanged(
    event: React.MouseEvent<Element, MouseEvent> | React.KeyboardEvent<Element> | null,
    data: DropdownProps
  ) {
    for (let i = 0; i < this.modeOptions.length; i++) {
      const mode = this.modeOptions[i];

      if (mode === data.value) {
        this.props.carto.dedicatedServerMode = i;

        this.props.carto.save();

        this.setState({
          dedicatedServerPath: this.state.dedicatedServerPath,
          iagree: this.state.iagree,
          dedicatedServerSlotCount: this.state.dedicatedServerSlotCount,
          dedicatedServerMode: i,
        });
        this._notifyOnChange();

        return;
      }
    }
  }

  _handleServerPathChanged(e: SyntheticEvent, data: (InputProps & { value: string }) | undefined) {
    if (data === undefined || this.props.carto === null || this.state == null) {
      return;
    }

    this.props.carto.dedicatedServerPath = data.value;
    this.props.carto.save();

    this.setState({
      dedicatedServerPath: data.value,
      iagree: this.state.iagree,
      dedicatedServerSlotCount: this.state.dedicatedServerSlotCount,
      dedicatedServerMode: this.state.dedicatedServerMode,
    });
  }

  private async _handleSelectFolderClick() {
    Log.debug("Opening folder via services.");

    const result = await AppServiceProxy.sendAsync(AppServiceProxyCommands.openFolder, "");

    if (result && result.length > 0) {
      this.props.carto.dedicatedServerPath = result;
      this.props.carto.save();

      this.setState({
        dedicatedServerSlotCount: this.state.dedicatedServerSlotCount,
        dedicatedServerMode: this.state.dedicatedServerMode,
        iagree: this.state.iagree,
        dedicatedServerPath: result,
      });
    }
  }

  _handleDedicatedServerSlotCountChanged(e: SyntheticEvent, data: (InputProps & { value: string }) | undefined) {
    if (data === undefined || this.props.carto === null || this.state == null) {
      return;
    }

    let valInt = -1;

    try {
      valInt = parseInt(data.value);
    } catch (e) {
      return;
    }

    if (valInt < 1 || valInt > 80) {
      return;
    }

    if (valInt !== this.props.carto.dedicatedServerSlotCount) {
      this.props.carto.dedicatedServerSlotCount = valInt;
      this.props.carto.save();

      this.setState({
        dedicatedServerSlotCount: valInt,
      });
    }
  }

  render() {
    if (this.props === undefined || this.state === undefined) {
      return <></>;
    }

    const serverProps = [];

    serverProps.push(
      <div key="modelabel" className="dssp-label dssp-modelabel">
        Use:
      </div>
    );

    serverProps.push(
      <div className="dssp-modeinput" key="modeinput">
        <Dropdown
          items={this.modeOptions}
          key="modeinput"
          defaultValue={
            this.modeOptions[this.props.carto.dedicatedServerMode ? this.props.carto.dedicatedServerMode : 0]
          }
          onChange={this._handleModeChanged}
        />
      </div>
    );

    if (this.state.dedicatedServerMode !== DedicatedServerMode.auto) {
      serverProps.push(
        <div key="pathlabel" className="dssp-label dssp-pathlabel">
          Folder Path:
        </div>
      );
      serverProps.push(
        <div key="pathinput" className="dssp-pathinput">
          <Input
            value={this.state.dedicatedServerPath}
            onChange={this._handleServerPathChanged}
            placeholder="<path to Minecraft Dedicated Server>"
          />
          <Button className="dssp-openfolderbutton" onClick={this._handleSelectFolderClick} content="Open folder" />
        </div>
      );
    } else {
      serverProps.push(
        <div className="dssp-iagreeinput" key="iagreeinput">
          <Checkbox
            checked={
              this.props.carto.iAgreeToTheMinecraftEndUserLicenseAgreementAndPrivacyPolicyAtMinecraftDotNetSlashTerms
            }
            onClick={this._handleIAgreeChanged}
          />
        </div>
      );

      serverProps.push(
        <div className="dssp-label dssp-iagreelabel" key="iagreelabel">
          I agree to the Minecraft End User License Agreement (
          <a
            className="dssp-link"
            href="https://minecraft.net/terms"
            rel="noreferrer noopener"
            target="_blank"
            style={{
              color: this.props.theme.siteVariables?.colorScheme.brand.foreground1,
            }}
          >
            https://minecraft.net/terms
          </a>
          ) and Privacy Policy (
          <a
            className="dssp-link"
            href="https://go.microsoft.com/fwlink/?LinkId=521839"
            rel="noreferrer noopener"
            target="_blank"
            style={{
              color: this.props.theme.siteVariables?.colorScheme.brand.foreground1,
            }}
          >
            https://go.microsoft.com/fwlink/?LinkId=521839
          </a>
          )
        </div>
      );

      serverProps.push(
        <div className="dssp-usepreviewinput" key="usepreviewinput">
          <Checkbox
            checked={this.props.carto.processHostedMinecraftTrack === MinecraftTrack.preview}
            onClick={this._handleUsePreview}
          />
        </div>
      );

      serverProps.push(
        <div className="dssp-label dssp-usepreviewlabel" key="usepreviewlabel">
          Use preview dedicated server builds
        </div>
      );

      /*
      serverProps.push(
        <div key="slotcountlabel" className="dssp-label dssp-slotcountlabel">
          Slots
        </div>
      );

      serverProps.push(
        <div className="dssp-slotcountinput" key="slotcountinput">
          <Input value={this.state.dedicatedServerSlotCount} onChange={this._handleDedicatedServerSlotCountChanged} />
        </div>
      );
*/
    }

    return (
      <div className="dssp-outer">
        <div className="dssp-header">Server Hosting Settings</div>
        <div className="dssp-grid">{serverProps}</div>
      </div>
    );
  }
}
