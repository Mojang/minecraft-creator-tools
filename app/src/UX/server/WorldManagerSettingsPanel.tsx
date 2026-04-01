import { Component } from "react";
import IAppProps from "../appShell/IAppProps";
import CreatorTools from "../../app/CreatorTools";
import "./WorldManagerSettingsPanel.css";
import { Checkbox, FormControlLabel } from "@mui/material";
import IPersistable from "../types/IPersistable";
import WebUtilities from "../utils/WebUtilities";
import WorldSettingsArea from "./WorldSettingsArea";
import { IWorldSettings } from "../../minecraft/IWorldSettings";
import Project from "../../app/Project";
import { getThemeColors } from "../hooks/theme/useThemeColors";
import IProjectTheme from "../types/IProjectTheme";

interface IWorldManagerSettingsPanelProps extends IAppProps {
  setActivePersistable?: (persistObject: IPersistable) => void;
  forceCompact?: boolean;
  project?: Project;
  theme: IProjectTheme;
}

interface IWorldManagerSettingsPanelState {
  mctWorldSettings?: IWorldSettings;
  projectUsesCustomWorldSettings?: boolean;
  projectWorldSettings?: IWorldSettings;
}

export default class WorldManagerSettingsPanel extends Component<
  IWorldManagerSettingsPanelProps,
  IWorldManagerSettingsPanelState
> {
  private _activeEditorPersistable?: IPersistable;

  constructor(props: IWorldManagerSettingsPanelProps) {
    super(props);

    this.persist = this.persist.bind(this);
    this._handleNewChildPersistable = this._handleNewChildPersistable.bind(this);
    this._handleProjectUsesCustomSettingsChanged = this._handleProjectUsesCustomSettingsChanged.bind(this);
    this._handleGeneralWorldSettingsChanged = this._handleGeneralWorldSettingsChanged.bind(this);
    this._handleProjectWorldSettingsChanged = this._handleProjectWorldSettingsChanged.bind(this);
    this._onCartoLoaded = this._onCartoLoaded.bind(this);

    this.state = {
      mctWorldSettings: this.props.creatorTools.worldSettings,
      projectWorldSettings: this.props.project?.worldSettings,
      projectUsesCustomWorldSettings: this.props.project?.usesCustomWorldSettings,
    };

    if (!this.props.creatorTools.isLoaded) {
      if (!this.props.creatorTools.onLoaded.has(this._onCartoLoaded)) {
        this.props.creatorTools.onLoaded.subscribe(this._onCartoLoaded);
      }
      this.props.creatorTools.load();
    }
  }

  private _onCartoLoaded(source: CreatorTools, target: CreatorTools) {
    this.setState({
      mctWorldSettings: this.props.creatorTools.worldSettings,
      projectWorldSettings: this.state.projectWorldSettings,
      projectUsesCustomWorldSettings: this.state.projectUsesCustomWorldSettings,
    });
  }

  _handleNewChildPersistable(newPersistable: IPersistable) {
    this._activeEditorPersistable = newPersistable;
  }

  _handleProjectWorldSettingsChanged(worldSettings: IWorldSettings) {
    if (!this.props.project) {
      return;
    }

    this.props.project.save();
  }

  _handleGeneralWorldSettingsChanged(worldSettings: IWorldSettings) {
    this.props.creatorTools.save();
  }

  async persist(): Promise<boolean> {
    if (this._activeEditorPersistable !== undefined) {
      return await this._activeEditorPersistable.persist();
    }

    return false;
  }

  _handleProjectUsesCustomSettingsChanged(e: React.ChangeEvent<HTMLInputElement>) {
    if (this.props.creatorTools === null || this.state == null || !this.props.project) {
      return;
    }

    this.props.project.usesCustomWorldSettings = e.target.checked;
    this.props.project.save();

    this.setState({
      mctWorldSettings: this.state.mctWorldSettings,
      projectWorldSettings: this.state.projectWorldSettings,
      projectUsesCustomWorldSettings: this.props.project.usesCustomWorldSettings,
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

    let projectSettingsArea = <></>;

    if (this.props.project) {
      projectSettingsArea = (
        <div className="wms-projectUses">
          <div className="wms-projectUsesCheck"></div>
          <div className="wms-projectUsesLabel">
            <FormControlLabel
              control={
                <Checkbox
                  checked={this.state.projectUsesCustomWorldSettings}
                  onChange={this._handleProjectUsesCustomSettingsChanged}
                />
              }
              label="Project uses custom world settings"
            />
          </div>
        </div>
      );
    }

    const colors = getThemeColors();

    let projectArea = <></>;

    if (this.props.project && this.state.projectWorldSettings) {
      projectArea = (
        <div className="wms-settingsArea">
          <div className="wms-areaLabel">Current World Settings for This Project</div>
          <div
            className="wms-settingsAreaInner"
            style={{
              backgroundColor: colors.background3,
              color: colors.foreground3,
            }}
          >
            <WorldSettingsArea
              creatorTools={this.props.creatorTools}
              worldSettings={this.state.projectWorldSettings}
              displayName={true}
              displayGameTypeProperties={this.state.projectUsesCustomWorldSettings === true}
              displayGameAdminProperties={this.state.projectUsesCustomWorldSettings === true}
              onWorldSettingsChanged={this._handleProjectWorldSettingsChanged}
            />
          </div>
        </div>
      );
    }

    const ws: IWorldSettings = this.state.mctWorldSettings ? this.state.mctWorldSettings : {};

    return (
      <div className="wms-outer">
        <div className="wms-header">World Settings</div>
        <div className={"wms-areas" + outerClassNameModifier}>
          {projectSettingsArea}
          {projectArea}
          <div className="wms-settingsArea">
            <div className="wms-areaLabel">Default Settings</div>
            <div
              className="wms-settingsAreaInner"
              style={{
                backgroundColor: colors.background3,
                color: colors.foreground3,
              }}
            >
              <WorldSettingsArea
                creatorTools={this.props.creatorTools}
                worldSettings={ws}
                displayName={this.props.project === undefined}
                displayGameTypeProperties={true}
                displayGameAdminProperties={true}
                onWorldSettingsChanged={this._handleGeneralWorldSettingsChanged}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }
}
