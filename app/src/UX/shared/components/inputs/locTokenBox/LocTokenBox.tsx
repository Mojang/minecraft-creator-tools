import { Component } from "react";
import "./LocTokenBox.css";
import IAppProps from "../../../../appShell/IAppProps";
import Project from "../../../../../app/Project";
import LocToken from "../../../../../minecraft/LocToken";

interface ILocTokenBoxProps extends IAppProps {
  project: Project;
  value: string;
}

interface ILocTokenBoxState {
  token?: LocToken;
}

export default class LocTokenBox extends Component<ILocTokenBoxProps, ILocTokenBoxState> {
  _isMountedInternal = false;

  constructor(props: ILocTokenBoxProps) {
    super(props);

    this._load = this._load.bind(this);

    this.state = {
      token: undefined,
    };

    this._load();
  }

  async _load() {
    await this.props.project.loc.load();
    const tok = this.props.project.loc.getToken(this.props.value);

    if (this._isMountedInternal) {
      this.setState({
        token: tok,
      });
    } else {
      this.state = {
        token: tok,
      };
    }
  }

  componentDidMount() {
    this._isMountedInternal = true;
  }

  componentWillUnmount() {
    this._isMountedInternal = false;
  }

  render() {
    if (this.props === undefined) {
      return;
    }

    // Display-only: LocTokenBox resolves a localization token and shows its
    // value. It has no interactive behavior, so it must not expose a button
    // role / tab stop — doing so makes screen readers announce a non-functional
    // button (and is invalid when the value is rendered inside a heading).
    if (this.state && this.state.token) {
      return (
        <span className="ltb-outer">
          <span className="ltb-title">{this.state.token.value}</span>
        </span>
      );
    }

    return (
      <span className="ltb-outer">
        <span className="ltb-title">{this.props.value}</span>
      </span>
    );
  }
}
