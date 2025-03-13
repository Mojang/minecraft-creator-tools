import { Component } from "react";
import "./SetNamespacedId.css";
import { ThemeInput } from "@fluentui/styles";
import IPersistable from "./IPersistable";
import { Input, InputProps } from "@fluentui/react-northstar";

interface ISetNamespacedIdProps {
  theme: ThemeInput<any>;
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

  _handleNamespaceSelected(elt: any, event: InputProps | undefined) {
    if (event && event.value && typeof event.value === "string") {
      const val = event.value;

      this.props.onNameChanged(val + ":" + this.state.namespace);
      this.setState({
        namespace: val,
        name: this.state.name,
      });
    }
  }

  _handleNameSelected(elt: any, event: InputProps | undefined) {
    if (event && event.value && typeof event.value === "string") {
      const val = event.value;

      this.props.onNameChanged(this.state.namespace + ":" + val);
      this.setState({
        namespace: this.state.namespace,
        name: val,
      });
    }
  }

  render() {
    if (this.state === null) {
      return <div>Loading...</div>;
    }

    return (
      <div className="setnaid-area">
        <div className="setnaid-mainArea">
          <div
            className="setnaid-label"
            style={{
              borderColor: this.props.theme.siteVariables?.colorScheme.brand.background3,
            }}
          >
            Name:
          </div>
          <div className="setnaid-name">
            <Input onChange={this._handleNameSelected} defaultValue={this.props.defaultName} />
          </div>
          <div
            className="setnaid-namespaceLabel"
            style={{
              borderColor: this.props.theme.siteVariables?.colorScheme.brand.background3,
            }}
          >
            <div>Namespace</div>
            <div>(should likely be {this.props.defaultNamespace})</div>
          </div>
          <div className="setnaid-namespace">
            <Input
              onChange={this._handleNamespaceSelected}
              defaultValue={this.props.defaultNamespace}
              style={{
                borderColor: this.props.theme.siteVariables?.colorScheme.brand.background3,
                backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
              }}
            />
          </div>
        </div>
      </div>
    );
  }
}
