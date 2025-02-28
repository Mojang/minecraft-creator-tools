import { Component } from "react";
import "./SetName.css";
import { ThemeInput } from "@fluentui/styles";
import IPersistable from "./IPersistable";
import { Input, InputProps } from "@fluentui/react-northstar";

interface ISetNameProps {
  theme: ThemeInput<any>;
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

  _handleValueSelected(elt: any, event: InputProps | undefined) {
    if (event && event.value && typeof event.value === "string") {
      const val = event.value;

      this.props.onNameChanged(val);
      this.setState({
        name: val,
      });
    }
  }

  render() {
    if (this.state === null) {
      return <div>Loading...</div>;
    }

    return (
      <div className="setna-area">
        <div className="setna-mainArea">
          <div
            className="setna-label"
            style={{
              borderColor: this.props.theme.siteVariables?.colorScheme.brand.background3,
            }}
          >
            Name:
          </div>
          <div className="setna-name">
            <Input onChange={this._handleValueSelected} />
          </div>
        </div>
      </div>
    );
  }
}
