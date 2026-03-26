import React, { Component } from "react";
import IAppProps from "../appShell/IAppProps";
import { CreatorToolsTargetSettings } from "../../app/CreatorTools";
import "./CreatorToolsSettingsPanel.css";
import { TextField, Button, Checkbox, Select, MenuItem, SelectChangeEvent } from "@mui/material";
import IPersistable from "../types/IPersistable";
import AppServiceProxy, { AppServiceProxyCommands } from "../../core/AppServiceProxy";
import CreatorToolsHost, { HostType } from "../../app/CreatorToolsHost";
import { CreatorToolsThemeStyle } from "../../app/CreatorToolsHost";
import Database from "../../minecraft/Database";
import { CreatorToolsEditPreference, MinecraftTrack, ThemePreference } from "../../app/ICreatorToolsData";
import IContentSource from "../../app/IContentSource";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faWandMagicSparkles, faEye, faCode, faCheckCircle } from "@fortawesome/free-solid-svg-icons";
import IProjectTheme from "../types/IProjectTheme";

export const CreatorToolsEditorPreferenceLabels = ["Focused", "Full", "Raw"];

interface ICreatorToolsSettingsPanelProps extends IAppProps {
  theme: IProjectTheme;
  setActivePersistable?: (persistObject: IPersistable) => void;
  onEditPreferenceChanged?: () => void;
}

interface ICreatorToolsSettingsPanelState {
  serverFolderPath: string | undefined;
  contentSources: IContentSource[] | undefined;
  autoStartMinecraft: boolean | undefined;
  formatBeforeSave: boolean;
  disableFirstRun: boolean;
  editPreference: CreatorToolsEditPreference;
  themePreference: ThemePreference;
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
    this._handleDisableFirstRunChanged = this._handleDisableFirstRunChanged.bind(this);
    this._handleThemePreferenceChange = this._handleThemePreferenceChange.bind(this);

    this.state = {
      contentSources: undefined,
      serverFolderPath: this.props.creatorTools.dedicatedServerPath,
      autoStartMinecraft: this.props.creatorTools.autoStartMinecraft,
      formatBeforeSave: this.props.creatorTools.formatBeforeSave,
      disableFirstRun: this.props.creatorTools.disableFirstRun,
      editPreference: this.props.creatorTools.editPreference ?? CreatorToolsEditPreference.summarized,
      themePreference: this.props.creatorTools.themePreference ?? ThemePreference.deviceDefault,
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

  _handleFormatBeforeSaveChanged(e: React.ChangeEvent<HTMLInputElement>) {
    if (this.props.creatorTools === null || this.state == null) {
      return;
    }

    this.props.creatorTools.formatBeforeSave = e.target.checked;
    this.props.creatorTools.save();

    this.setState({
      formatBeforeSave: e.target.checked,
    });
  }

  _handleDisableFirstRunChanged(e: React.ChangeEvent<HTMLInputElement>) {
    if (this.props.creatorTools === null || this.state == null) {
      return;
    }

    // Note: checkbox shows "Show welcome panel" so we invert the logic
    // checked = show welcome = disableFirstRun false
    // unchecked = hide welcome = disableFirstRun true
    this.props.creatorTools.disableFirstRun = !e.target.checked;
    this.props.creatorTools.save();

    this.setState({
      disableFirstRun: !e.target.checked,
    });
  }

  async _handleTrackChange(event: SelectChangeEvent<string>) {
    if (event.target.value === CreatorToolsTargetSettings[1]) {
      this.props.creatorTools.track = MinecraftTrack.edu;
    } else if (event.target.value === CreatorToolsTargetSettings[2]) {
      this.props.creatorTools.track = MinecraftTrack.preview;
    } else {
      this.props.creatorTools.track = MinecraftTrack.main;
    }

    await this.props.creatorTools.save();
  }

  _handleAutoStartChanged(e: React.ChangeEvent<HTMLInputElement>) {
    if (this.props.creatorTools === null || this.state == null) {
      return;
    }

    this.props.creatorTools.autoStartMinecraft = e.target.checked;
    this.props.creatorTools.save();

    this.setState({
      autoStartMinecraft: this.props.creatorTools.autoStartMinecraft,
    });
  }

  _handleEditPreferenceChange(event: SelectChangeEvent<string>) {
    if (event.target.value === CreatorToolsEditorPreferenceLabels[0]) {
      this.props.creatorTools.editPreference = CreatorToolsEditPreference.summarized;
    } else if (event.target.value === CreatorToolsEditorPreferenceLabels[1]) {
      this.props.creatorTools.editPreference = CreatorToolsEditPreference.editors;
    } else {
      this.props.creatorTools.editPreference = CreatorToolsEditPreference.raw;
    }

    this.props.creatorTools.save();
    this.setState({ editPreference: this.props.creatorTools.editPreference });
  }

  _selectEditPreference(preference: CreatorToolsEditPreference) {
    this.props.creatorTools.editPreference = preference;
    this.props.creatorTools.save();
    this.setState({ editPreference: preference });
    if (this.props.onEditPreferenceChanged) {
      this.props.onEditPreferenceChanged();
    }
  }

  _handleThemePreferenceChange(event: SelectChangeEvent<number>) {
    const value = event.target.value as number;
    this.props.creatorTools.themePreference = value;
    this.props.creatorTools.save();
    this.setState({ themePreference: value });

    // Apply the theme change
    let newTheme: CreatorToolsThemeStyle;
    if (value === ThemePreference.dark) {
      newTheme = CreatorToolsThemeStyle.dark;
    } else if (value === ThemePreference.light) {
      newTheme = CreatorToolsThemeStyle.light;
    } else {
      // Device default: use OS preference
      if (typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
        newTheme = CreatorToolsThemeStyle.dark;
      } else {
        newTheme = CreatorToolsThemeStyle.light;
      }
    }

    CreatorToolsHost.theme = newTheme;

    // Also update localStorage so the choice persists across page reloads
    if (typeof localStorage !== "undefined") {
      try {
        if (value === ThemePreference.deviceDefault) {
          localStorage.removeItem("color-mode");
        } else {
          localStorage.setItem("color-mode", value === ThemePreference.dark ? "dark" : "light");
        }
      } catch {
        // localStorage may be unavailable in private browsing
      }
    }
  }

  _handleFocusedClick = () => {
    this._selectEditPreference(CreatorToolsEditPreference.summarized);
  };

  _handleFullClick = () => {
    this._selectEditPreference(CreatorToolsEditPreference.editors);
  };

  _handleRawClick = () => {
    this._selectEditPreference(CreatorToolsEditPreference.raw);
  };

  _handleServerPathChanged(e: React.ChangeEvent<HTMLInputElement>) {
    if (this.props.creatorTools === null || this.state == null) {
      return;
    }

    this.props.creatorTools.dedicatedServerPath = e.target.value;
    this.props.creatorTools.save();

    this.setState({
      serverFolderPath: e.target.value,
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

    const { editPreference } = this.state;

    // Row 1-2: Edit Experience (label in col 1, options in col 2)
    coreProps.push(
      <div className="csp-label csp-defaultEditlabel" key="csp-defaultEditlabel" id="csp-defaultEditlabel">
        Edit Experience
      </div>
    );

    coreProps.push(
      <div className="csp-defaultEditinput" key="csp-defaultEditinput">
        <div className="csp-editOptionsGrid">
          {/* Focused Mode */}
          <button
            className={`csp-editOption ${
              editPreference === CreatorToolsEditPreference.summarized ? "csp-editOptionSelected" : ""
            }`}
            onClick={this._handleFocusedClick}
            aria-pressed={editPreference === CreatorToolsEditPreference.summarized}
          >
            <div className="csp-editOptionIcon">
              <FontAwesomeIcon icon={faWandMagicSparkles} />
            </div>
            <div className="csp-editOptionContent">
              <div className="csp-editOptionTitle">Focused</div>
              <div className="csp-editOptionDesc">Visual editors, simplified view</div>
            </div>
            {editPreference === CreatorToolsEditPreference.summarized && (
              <div className="csp-editOptionCheck">
                <FontAwesomeIcon icon={faCheckCircle} />
              </div>
            )}
          </button>

          {/* Full Mode */}
          <button
            className={`csp-editOption ${
              editPreference === CreatorToolsEditPreference.editors ? "csp-editOptionSelected" : ""
            }`}
            onClick={this._handleFullClick}
            aria-pressed={editPreference === CreatorToolsEditPreference.editors}
          >
            <div className="csp-editOptionIcon">
              <FontAwesomeIcon icon={faEye} />
            </div>
            <div className="csp-editOptionContent">
              <div className="csp-editOptionTitle">Full</div>
              <div className="csp-editOptionDesc">Visual editors, all files visible</div>
            </div>
            {editPreference === CreatorToolsEditPreference.editors && (
              <div className="csp-editOptionCheck">
                <FontAwesomeIcon icon={faCheckCircle} />
              </div>
            )}
          </button>

          {/* Raw Mode */}
          <button
            className={`csp-editOption ${
              editPreference === CreatorToolsEditPreference.raw ? "csp-editOptionSelected" : ""
            }`}
            onClick={this._handleRawClick}
            aria-pressed={editPreference === CreatorToolsEditPreference.raw}
          >
            <div className="csp-editOptionIcon">
              <FontAwesomeIcon icon={faCode} />
            </div>
            <div className="csp-editOptionContent">
              <div className="csp-editOptionTitle">Raw</div>
              <div className="csp-editOptionDesc">Raw JSON editing by default</div>
            </div>
            {editPreference === CreatorToolsEditPreference.raw && (
              <div className="csp-editOptionCheck">
                <FontAwesomeIcon icon={faCheckCircle} />
              </div>
            )}
          </button>
        </div>
        <div className="csp-propertyNote">
          {editPreference === CreatorToolsEditPreference.summarized ||
          editPreference === CreatorToolsEditPreference.editors
            ? "Visual editors may reformat JSON files. Your content is preserved — only whitespace and comments may change. "
            : ""}
          You can edit items as Raw JSON using the '...' menu on items in the list.
        </div>
      </div>
    );

    // Row 3: Appearance - label left, dropdown right
    coreProps.push(
      <div className="csp-label csp-themelabel" key="csp-themelabel" id="csp-themelabel">
        Appearance
      </div>
    );
    coreProps.push(
      <div className="csp-themeinput" key="csp-themeinput">
        <Select
          value={this.state.themePreference}
          aria-labelledby="csp-themelabel"
          onChange={this._handleThemePreferenceChange}
          size="small"
          sx={{ minWidth: 240 }}
        >
          <MenuItem value={ThemePreference.deviceDefault}>Device default</MenuItem>
          <MenuItem value={ThemePreference.dark}>Dark mode</MenuItem>
          <MenuItem value={ThemePreference.light}>Light mode</MenuItem>
        </Select>
      </div>
    );

    // Row 4: Format before save - label left, toggle right
    coreProps.push(
      <div className="csp-label csp-formatbeforesavelabel" key="csp-formatbeforesavelabel">
        Format JSON and script on save
      </div>
    );

    coreProps.push(
      <div className="csp-formatbeforesave" key="csp-formatbeforesave">
        <Checkbox checked={this.props.creatorTools.formatBeforeSave} onChange={this._handleFormatBeforeSaveChanged} />
      </div>
    );

    const contentSourceDisplayNames: Record<string, string> = {
      minecraftBedrockComMojang: "Minecraft Bedrock",
      minecraftBedrockPreviewComMojang: "Minecraft Bedrock Preview",
      minecraftEducationComMojang: "Minecraft Education",
      minecraftEducationPreviewComMojang: "Minecraft Education Preview",
    };

    let contentSourceIds: string[] = [];

    if (this.state.contentSources !== undefined) {
      contentSourceIds = this.state.contentSources.map((cs) => cs.id);
    }

    // Row 4: Deployment Target - label left, dropdown right
    coreProps.push(
      <div className="csp-label csp-defaultDeployTargetlabel" id="csp-defaultDeployTargetlabel">
        Deployment Target
      </div>
    );
    coreProps.push(
      <div className="csp-defaultDeployTarget">
        <Select
          value={contentSourceIds[0] || ""}
          aria-labelledby="csp-defaultDeployTargetlabel"
          onChange={this._handleEditPreferenceChange}
          size="small"
          sx={{ minWidth: 240 }}
          renderValue={(val) => contentSourceDisplayNames[val as string] || val}
        >
          {contentSourceIds.map((id) => (
            <MenuItem key={id} value={id}>
              {contentSourceDisplayNames[id] || id}
            </MenuItem>
          ))}
        </Select>
      </div>
    );

    // Row 5: Target Minecraft - label left, dropdown right
    coreProps.push(
      <div className="csp-label csp-tracklabel" key="csp-tracklabel">
        Target Minecraft
      </div>
    );
    coreProps.push(
      <div className="csp-trackinput" key="csp-trackinput">
        <Select
          value={CreatorToolsTargetSettings[this.props.creatorTools.effectiveTrack as number] || CreatorToolsTargetSettings[0]}
          onChange={this._handleTrackChange}
          size="small"
          sx={{ minWidth: 240 }}
        >
          {CreatorToolsTargetSettings.map((setting) => (
            <MenuItem key={setting} value={setting}>
              {setting}
            </MenuItem>
          ))}
        </Select>
      </div>
    );

    // Row 6: Show welcome panel - label left, toggle right
    coreProps.push(
      <div className="csp-label csp-showwelcomelabel" key="csp-showwelcomelabel">
        Show welcome panel
        <div style={{ fontSize: "0.75rem", opacity: 0.7, marginTop: "2px" }}>Display the welcome dialog with mode selection when opening a project</div>
      </div>
    );

    coreProps.push(
      <div className="csp-showwelcome" key="csp-showwelcome">
        <Checkbox checked={!this.state.disableFirstRun} onChange={this._handleDisableFirstRunChanged} />
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
          <Checkbox checked={this.props.creatorTools.autoStartMinecraft} onChange={this._handleAutoStartChanged} />
        </div>
      );

      if (AppServiceProxy.hasAppServiceOrDebug) {
        openFolderCtrl = (
          <Button onClick={this._handleSelectFolderClick} size="small">
            Open folder
          </Button>
        );

        serverProps.push(
          <div className="csp-label csp-dspathlabel" key="csp-nl" id="csp-nl">
            Dedicated Server Path
          </div>
        );

        serverProps.push(
          <div className="csp-dspathinput" key="csp-ni">
            <TextField
              value={this.state.serverFolderPath}
              onChange={this._handleServerPathChanged}
              aria-labelledby="csp-nl"
              size="small"
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
