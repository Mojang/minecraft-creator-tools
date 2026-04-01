import { Component, ChangeEvent } from "react";
import "./SetName.css";
import IPersistable from "../../types/IPersistable";
import { TextField } from "@mui/material";
import { mcColors } from "../../hooks/theme/mcColors";
import CreatorToolsHost, { CreatorToolsThemeStyle } from "../../../app/CreatorToolsHost";
import IProjectTheme from "../../types/IProjectTheme";

interface ISetNameProps {
  theme: IProjectTheme;
  defaultName: string;
  onNameChanged: (name: string) => void;
  setActivePersistable?: (persistObject: IPersistable) => void;
}

interface ISetNameState {
  name: string | undefined;
}

export default class SetName extends Component<ISetNameProps, ISetNameState> {
  constructor(props: ISetNameProps) {
    super(props);

    this._handleValueSelected = this._handleValueSelected.bind(this);

    this.state = {
      name: this.props.defaultName,
    };
  }

  _handleValueSelected(event: ChangeEvent<HTMLInputElement>) {
    const val = event.target.value;

    this.props.onNameChanged(val);
    this.setState({
      name: val,
    });
  }

  render() {
    if (this.state === null) {
      return <div>Loading...</div>;
    }

    const isDark = CreatorToolsHost.theme === CreatorToolsThemeStyle.dark;

    return (
      <div className="setna-area">
        <div className="setna-mainArea">
          <div
            className="setna-label"
            style={{
              borderColor: isDark ? mcColors.gray5 : mcColors.gray3,
            }}
            id="setna-label-name"
          >
            Name:
          </div>
          <div className="setna-name">
            <TextField
              aria-labelledby="setna-label-name"
              onChange={this._handleValueSelected}
              size="small"
              variant="outlined"
              fullWidth
            />
          </div>
        </div>
      </div>
    );
  }
}
