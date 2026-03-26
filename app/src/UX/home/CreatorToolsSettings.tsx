import { Component } from "react";
import IAppProps from "../appShell/IAppProps";
import "./CreatorToolsSettings.css";
import CreatorToolsSettingsPanel from "./CreatorToolsSettingsPanel";
import IPersistable from "../types/IPersistable";
import { getThemeColors } from "../hooks/theme/useThemeColors";
import IProjectTheme from "../types/IProjectTheme";

interface ICreatorToolsSettingsProps extends IAppProps {
  heightOffset: number;
  theme: IProjectTheme;
  setActivePersistable?: (persistObject: IPersistable) => void;
  onEditPreferenceChanged?: () => void;
}

interface ICreatorToolsSettingsState {}

export default class CreatorToolsSettings extends Component<ICreatorToolsSettingsProps, ICreatorToolsSettingsState> {
  private _activeEditorPersistable?: IPersistable;

  constructor(props: ICreatorToolsSettingsProps) {
    super(props);

    this.persist = this.persist.bind(this);
    this._handleNewChildPersistable = this._handleNewChildPersistable.bind(this);
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

  render() {
    if (this.props === undefined || this.state === undefined) {
      return <></>;
    }

    const colors = getThemeColors();
    const height = "calc(100vh - " + (this.props.heightOffset + 58) + "px)";

    return (
      <div
        className="cs-outer"
        style={{
          backgroundColor: colors.background2,
          color: colors.foreground2,
        }}
      >
        <h2
          className="cs-header"
          style={{
            backgroundColor: colors.background1,
            color: colors.foreground1,
          }}
        >
          Creator Tools Settings
        </h2>
        <div
          className="cs-panelArea"
          style={{
            minHeight: height,
            maxHeight: height,
          }}
        >
          <CreatorToolsSettingsPanel
            theme={this.props.theme}
            creatorTools={this.props.creatorTools}
            setActivePersistable={this.props.setActivePersistable}
            onEditPreferenceChanged={this.props.onEditPreferenceChanged}
          />
        </div>
      </div>
    );
  }
}
