import { Component, ChangeEvent } from "react";
import "./SetNamespacedId.css";
import IPersistable from "../../types/IPersistable";
import { TextField } from "@mui/material";
import { mcColors } from "../../hooks/theme/mcColors";
import CreatorToolsHost, { CreatorToolsThemeStyle } from "../../../app/CreatorToolsHost";
import IProjectTheme from "../../types/IProjectTheme";

interface ISetNamespacedIdProps {
  theme: IProjectTheme;
  defaultNamespace: string;
  defaultName: string;
  onNameChanged: (name: string) => void;
  setActivePersistable?: (persistObject: IPersistable) => void;
}

interface ISetNamespacedIdState {
  namespace: string | undefined;
  name: string | undefined;
}

export default class SetNamespacedId extends Component<ISetNamespacedIdProps, ISetNamespacedIdState> {
  constructor(props: ISetNamespacedIdProps) {
    super(props);

    this._handleNameSelected = this._handleNameSelected.bind(this);

    this.state = {
      namespace: this.props.defaultNamespace,
      name: this.props.defaultName,
    };
  }

  _handleNamespaceSelected(event: ChangeEvent<HTMLInputElement>) {
    const val = event.target.value;

    this.setState(
      (prevState) => ({
        namespace: val,
        name: prevState.name,
      }),
      () => {
        this.props.onNameChanged(val + ":" + this.state.name);
      }
    );
  }

  _handleNameSelected(event: ChangeEvent<HTMLInputElement>) {
    const val = event.target.value;

    this.setState(
      (prevState) => ({
        namespace: prevState.namespace ?? this.props.defaultNamespace,
        name: val,
      }),
      () => {
        const ns = this.state.namespace ?? this.props.defaultNamespace;
        this.props.onNameChanged(ns + ":" + val);
      }
    );
  }

  render() {
    if (this.state === null) {
      return <div>Loading...</div>;
    }

    const isDark = CreatorToolsHost.theme === CreatorToolsThemeStyle.dark;

    return (
      <div className="setnaid-area">
        <div className="setnaid-mainArea">
          <div
            className="setnaid-label"
            style={{
              borderColor: isDark ? mcColors.gray5 : mcColors.gray3,
            }}
            id="setnaid-label-name"
          >
            Name:
          </div>
          <div className="setnaid-name">
            <TextField
              aria-labelledby="setnaid-label-name"
              onChange={this._handleNameSelected}
              defaultValue={this.props.defaultName}
              size="small"
              variant="outlined"
              fullWidth
            />
          </div>
          <div
            className="setnaid-namespaceLabel"
            style={{
              borderColor: isDark ? mcColors.gray5 : mcColors.gray3,
            }}
            id="setnaid-label-namespace"
          >
            <div>Namespace</div>
            <div>(should likely be {this.props.defaultNamespace})</div>
          </div>
          <div className="setnaid-namespace">
            <TextField
              aria-labelledby="setnaid-label-namespace"
              onChange={this._handleNamespaceSelected}
              defaultValue={this.props.defaultNamespace}
              size="small"
              variant="outlined"
              fullWidth
              sx={{
                borderColor: isDark ? mcColors.gray5 : mcColors.gray3,
                backgroundColor: isDark ? mcColors.gray6 : mcColors.gray1,
              }}
            />
          </div>
        </div>
      </div>
    );
  }
}
