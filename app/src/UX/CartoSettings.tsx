import { Component } from "react";
import IAppProps from "./IAppProps";
import "./CartoSettings.css";
import CartoSettingsPanel from "./CartoSettingsPanel";
import { ThemeInput } from "@fluentui/react-northstar";
import IPersistable from "./IPersistable";

interface ICartoSettingsProps extends IAppProps {
  heightOffset: number;
  theme: ThemeInput<any>;
  setActivePersistable?: (persistObject: IPersistable) => void;
}

interface ICartoSettingsState {}

export default class CartoSettings extends Component<ICartoSettingsProps, ICartoSettingsState> implements IPersistable {
  private _activeEditorPersistable?: IPersistable;

  constructor(props: ICartoSettingsProps) {
    super(props);

    this.persist = this.persist.bind(this);
    this._handleNewChildPersistable = this._handleNewChildPersistable.bind(this);
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

  render() {
    if (this.props === undefined || this.state === undefined) {
      return <></>;
    }

    const height = "calc(100vh - " + (this.props.heightOffset + 58) + "px)";

    return (
      <div
        className="cs-outer"
        style={{
          backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
          color: this.props.theme.siteVariables?.colorScheme.brand.foreground1,
        }}
      >
        <h2
          className="cs-header"
          style={{
            backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background3,
            color: this.props.theme.siteVariables?.colorScheme.brand.foreground3,
          }}
        >
          App Settings
        </h2>
        <div
          className="cs-panelArea"
          style={{
            minHeight: height,
            maxHeight: height,
          }}
        >
          <CartoSettingsPanel
            theme={this.props.theme}
            carto={this.props.carto}
            setActivePersistable={this.props.setActivePersistable}
          />
        </div>
      </div>
    );
  }
}
