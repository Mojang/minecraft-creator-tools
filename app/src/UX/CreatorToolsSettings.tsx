import { Component } from "react";
import IAppProps from "./IAppProps";
import "./CreatorToolsSettings.css";
import CreatorToolsSettingsPanel from "./CreatorToolsSettingsPanel";
import { ThemeInput } from "@fluentui/react-northstar";
import IPersistable from "./IPersistable";

interface ICreatorToolsSettingsProps extends IAppProps {
  heightOffset: number;
  theme: ThemeInput<any>;
  setActivePersistable?: (persistObject: IPersistable) => void;
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

    const height = "calc(100vh - " + (this.props.heightOffset + 58) + "px)";

    return (
      <div
        className="cs-outer"
        style={{
          backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background2,
          color: this.props.theme.siteVariables?.colorScheme.brand.foreground2,
        }}
      >
        <h2
          className="cs-header"
          style={{
            backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
            color: this.props.theme.siteVariables?.colorScheme.brand.foreground1,
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
          />
        </div>
      </div>
    );
  }
}
