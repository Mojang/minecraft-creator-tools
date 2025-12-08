import { Component, SyntheticEvent } from "react";
import IAppProps from "./IAppProps";
import { CreatorToolsTargetSettings } from "../app/CreatorTools";
import "./CreatorToolsSettingsPanel.css";
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
import AppServiceProxy, { AppServiceProxyCommands } from "../core/AppServiceProxy";
import CreatorToolsHost, { HostType } from "../app/CreatorToolsHost";
import Database from "./../minecraft/Database";
import { CreatorToolsEditPreference, MinecraftTrack } from "../app/ICreatorToolsData";
import IContentSource from "../app/IContentSource";
export const CreatorToolsEditorPreferenceLabels = [
  "Visual editors, plus hide advanced items",
  "Visual editors",
  "Raw JSON/JavaScript Editing",
];

interface ICreatorToolsSettingsPanelProps extends IAppProps {
  theme: ThemeInput<any>;
  setActivePersistable?: (persistObject: IPersistable) => void;
}

interface ICreatorToolsSettingsPanelState {
  serverFolderPath: string | undefined;
  contentSources: IContentSource[] | undefined;
  autoStartMinecraft: boolean | undefined;
  formatBeforeSave: boolean;
}

export default class CreatorToolsSettingsPanel extends Component<
  ICreatorToolsSettingsPanelProps,
  ICreatorToolsSettingsPanelState
> {
  private _activeEditorPersistable?: IPersistable;

  constructor(props: ICreatorToolsSettingsPanelProps) {
    super(props);

    this.persist = this.persist.bind(this);
    this._handleEditPreferenceChange = this._handleEditPreferenceChange.bind(this);
    this._handleNewChildPersistable = this._handleNewChildPersistable.bind(this);
    this._handleServerPathChanged = this._handleServerPathChanged.bind(this);
    this._handleAutoStartChanged = this._handleAutoStartChanged.bind(this);
    this._handleSelectFolderClick = this._handleSelectFolderClick.bind(this);
    this._handleFormatBeforeSaveChanged = this._handleFormatBeforeSaveChanged.bind(this);
    this._handleTrackChange = this._handleTrackChange.bind(this);

    this.state = {
      contentSources: undefined,
      serverFolderPath: this.props.creatorTools.dedicatedServerPath,
      autoStartMinecraft: this.props.creatorTools.autoStartMinecraft,
      formatBeforeSave: this.props.creatorTools.formatBeforeSave,
    };
  }

  componentDidMount(): void {
    this.doLoad();
  }

  async doLoad() {
    await this.props.creatorTools.load();
    const cs = await Database.loadContentSources();

    this.setState({
      serverFolderPath: this.props.creatorTools.dedicatedServerPath,
      contentSources: cs,
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

  _handleFormatBeforeSaveChanged(e: SyntheticEvent, data: (CheckboxProps & { checked: boolean }) | undefined) {
    if (data === undefined || this.props.creatorTools === null || this.state == null) {
      return;
    }

    this.props.creatorTools.formatBeforeSave = data.checked;
    this.props.creatorTools.save();

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
    if (data.value === CreatorToolsTargetSettings[1]) {
      this.props.creatorTools.track = MinecraftTrack.edu;
    } else if (data.value === CreatorToolsTargetSettings[2]) {
      this.props.creatorTools.track = MinecraftTrack.preview;
    } else {
      this.props.creatorTools.track = MinecraftTrack.main;
    }

    await this.props.creatorTools.save();
  }

  _handleAutoStartChanged(e: SyntheticEvent, data: (CheckboxProps & { checked: boolean }) | undefined) {
    if (data === undefined || this.props.creatorTools === null || this.state == null) {
      return;
    }

    this.props.creatorTools.autoStartMinecraft = data.checked;
    this.props.creatorTools.save();

    this.setState({
      serverFolderPath: this.state.serverFolderPath,
      autoStartMinecraft: this.props.creatorTools.autoStartMinecraft,
    });
  }

  _handleEditPreferenceChange(
    event: React.MouseEvent<Element, MouseEvent> | React.KeyboardEvent<Element> | null,
    data: DropdownProps
  ) {
    if (data.value === CreatorToolsEditorPreferenceLabels[0]) {
      this.props.creatorTools.editPreference = CreatorToolsEditPreference.summarized;
    } else if (data.value === CreatorToolsEditorPreferenceLabels[1]) {
      this.props.creatorTools.editPreference = CreatorToolsEditPreference.editors;
    } else {
      this.props.creatorTools.editPreference = CreatorToolsEditPreference.raw;
    }

    this.props.creatorTools.save();
  }

  _handleServerPathChanged(e: SyntheticEvent, data: (InputProps & { value: string }) | undefined) {
    if (data === undefined || this.props.creatorTools === null || this.state == null) {
      return;
    }

    this.props.creatorTools.dedicatedServerPath = data.value;
    this.props.creatorTools.save();

    this.setState({
      serverFolderPath: data.value,
    });
  }

  private async _handleSelectFolderClick() {
    const result = await AppServiceProxy.sendAsync(AppServiceProxyCommands.openFolder, "");

    if (result && result.length > 0) {
      this.props.creatorTools.dedicatedServerPath = result;
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
          items={CreatorToolsTargetSettings}
          placeholder="Select which version of Minecraft to target"
          defaultValue={CreatorToolsTargetSettings[this.props.creatorTools.track as number]}
          onChange={this._handleTrackChange}
        />
      </div>
    );
    coreProps.push(
      <div className="csp-label csp-defaultEditlabel" id="csp-defaultEditlabel">
        Default Edit Experience
      </div>
    );

    let contentSourceLabels: string[] = [];

    if (this.state.contentSources !== undefined) {
      contentSourceLabels = this.state.contentSources.map((cs) => cs.id);
    }

    coreProps.push(
      <div className="csp-defaultEditinput">
        <Dropdown
          items={CreatorToolsEditorPreferenceLabels}
          aria-labelledby="csp-defaultEditlabel"
          placeholder="Select your edit experience"
          defaultValue={CreatorToolsEditorPreferenceLabels[this.props.creatorTools.editPreference as number]}
          onChange={this._handleEditPreferenceChange}
        />
        <div className="csp-propertyNote">
          {this.props.creatorTools.editPreference === CreatorToolsEditPreference.summarized ||
          this.props.creatorTools.editPreference === CreatorToolsEditPreference.editors
            ? "When using visual editors, some existing formatting and comments in JSON files may be removed as you edit."
            : ""}
          You can edit items as Raw JSON using the '...' menu on items in the list.
        </div>
      </div>
    );

    coreProps.push(
      <div className="csp-label csp-defaultDeployTargetlabel" id="csp-defaultDeployTargetlabel">
        Default Deployment Target
      </div>
    );
    coreProps.push(
      <div className="csp-defaultDeployTarget">
        <Dropdown
          items={contentSourceLabels}
          aria-labelledby="csp-defaultDeployTargetlabel"
          placeholder="Select your default deployment target"
          defaultValue={contentSourceLabels[0]}
          onChange={this._handleEditPreferenceChange}
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
          checked={this.props.creatorTools.formatBeforeSave}
          toggle={true}
          onClick={this._handleFormatBeforeSaveChanged}
        />
      </div>
    );

    if (
      AppServiceProxy.hasAppServiceOrDebug ||
      CreatorToolsHost.hostType === HostType.vsCodeWebWeb ||
      CreatorToolsHost.hostType === HostType.vsCodeMainWeb
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
            checked={this.props.creatorTools.autoStartMinecraft}
            toggle={true}
            onClick={this._handleAutoStartChanged}
          />
        </div>
      );

      if (AppServiceProxy.hasAppServiceOrDebug) {
        openFolderCtrl = <Button onClick={this._handleSelectFolderClick} content="Open folder" />;

        serverProps.push(
          <div className="csp-label csp-dspathlabel" key="csp-nl" id="csp-nl">
            Dedicated Server Path
          </div>
        );

        serverProps.push(
          <div className="csp-dspathinput" key="csp-ni">
            <Input
              value={this.state.serverFolderPath}
              onChange={this._handleServerPathChanged}
              aria-labelledby="csp-nl"
            />
            {openFolderCtrl}
          </div>
        );
      }
    }

    return (
      <div className="csp-grid">
        {coreProps}
        {serverProps}
      </div>
    );
  }
}
