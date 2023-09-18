import { Component } from "react";
import "./LocTokenBox.css";
import IAppProps from "./IAppProps";
import Project from "../app/Project";
import LocToken from "../minecraft/LocToken";

interface ILocTokenBoxProps extends IAppProps {
  project: Project;
  value: string;
}

interface ILocTokenBoxState {
  token?: LocToken;
}

export default class LocTokenBox extends Component<ILocTokenBoxProps, ILocTokenBoxState> {
  constructor(props: ILocTokenBoxProps) {
    super(props);

    this._handleClick = this._handleClick.bind(this);

    this._load();
  }

  async _load() {
    await this.props.project.loc.load();
    const tok = this.props.project.loc.getToken(this.props.value);

    this.setState({
      token: tok,
    });
  }

  _handleClick() {}

  render() {
    if (this.props === undefined) {
      return;
    }

    if (this.state && this.state.token) {
      return (
        <div className="ltb-outer" onClick={this._handleClick}>
          <span className="ltb-title">
            {this.state.token.value} - ({this.props.value})
          </span>
        </div>
      );
    }

    return (
      <div className="ltb-outer" onClick={this._handleClick}>
        <span className="ltb-title">{this.props.value}</span>
      </div>
    );
  }
}
