import { Component, SyntheticEvent } from "react";
import IAppProps from "./IAppProps";
import Carto from "../app/Carto";
import "./WorldManagerSettingsPanel.css";
import { Checkbox, CheckboxProps } from "@fluentui/react-northstar";
import IPersistable from "./IPersistable";
import WebUtilities from "./WebUtilities";
import WorldSettingsArea from "./WorldSettingsArea";
import { IWorldSettings } from "../minecraft/IWorldSettings";
import Project from "../app/Project";

interface IWorldManagerSettingsPanelProps extends IAppProps {
  setActivePersistable?: (persistObject: IPersistable) => void;
  forceCompact?: boolean;
  project?: Project;
}

interface IWorldManagerSettingsPanelState {
  mctWorldSettings?: IWorldSettings;
  projectUsesCustomWorldSettings?: boolean;
  projectWorldSettings?: IWorldSettings;
}

export default class WorldManagerSettingsPanel
  extends Component<IWorldManagerSettingsPanelProps, IWorldManagerSettingsPanelState>
  implements IPersistable
{
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
      mctWorldSettings: this.props.carto.worldSettings,
      projectWorldSettings: this.props.project?.worldSettings,
      projectUsesCustomWorldSettings: this.props.project?.usesCustomWorldSettings,
    };

    if (!this.props.carto.isLoaded) {
      this.props.carto.onLoaded.subscribe(this._onCartoLoaded);
      this.props.carto.load();
    }
  }

  private _onCartoLoaded(source: Carto, target: Carto) {
    this.setState({
      mctWorldSettings: this.props.carto.worldSettings,
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
    this.props.carto.save();
  }

  async persist() {
    if (this._activeEditorPersistable !== undefined) {
      await this._activeEditorPersistable.persist();
    }
  }

  _handleProjectUsesCustomSettingsChanged(e: SyntheticEvent, data: (CheckboxProps & { checked: boolean }) | undefined) {
    if (data === undefined || this.props.carto === null || this.state == null || !this.props.project) {
      return;
    }

    this.props.project.usesCustomWorldSettings = data.checked;
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
          <div className="wms-projectUsesCheck">
            <Checkbox
              toggle={true}
              checked={this.state.projectUsesCustomWorldSettings}
              onClick={this._handleProjectUsesCustomSettingsChanged}
            />
          </div>
          <div className="wms-projectUsesLabel">Project uses custom world settings</div>
        </div>
      );
    }

    let projectArea = <></>;

    if (this.props.project && this.state.projectWorldSettings) {
      projectArea = (
        <div className="wms-settingsArea">
          <div>Project Settings</div>
          <WorldSettingsArea
            carto={this.props.carto}
            worldSettings={this.state.projectWorldSettings}
            displayName={true}
            displayOtherProperties={this.state.projectUsesCustomWorldSettings === true}
            onWorldSettingsChanged={this._handleProjectWorldSettingsChanged}
          />
        </div>
      );
    }

    const ws: IWorldSettings = this.state.mctWorldSettings ? this.state.mctWorldSettings : {};

    return (
      <div className="wms-outer">
        <div className="wms-header">Development World Settings</div>
        <div className={"wms-areas" + outerClassNameModifier}>
          {projectSettingsArea}
          {projectArea}
          <div className="wms-settingsArea">
            <div className="wms-defaultLabel">Default Minecraft Dev Tool Settings</div>
            <WorldSettingsArea
              carto={this.props.carto}
              worldSettings={ws}
              displayName={this.props.project === undefined}
              displayOtherProperties={true}
              onWorldSettingsChanged={this._handleGeneralWorldSettingsChanged}
            />
          </div>
        </div>
      </div>
    );
  }
}
