import { Component } from "react";
import "./ActionButton.css";
import IAppProps from "./IAppProps";

interface IActionButtonProps extends IAppProps {}

interface IActionButtonState {}

export default class ActionButton extends Component<IActionButtonProps, IActionButtonState> {
  constructor(props: IActionButtonProps) {
    super(props);

    this._handleClick = this._handleClick.bind(this);
  }

  _handleClick() {}

  render() {
    if (this.props === undefined) {
      return;
    }

    return (
      <div className="btt-outer" onClick={this._handleClick}>
        <span className="btt-title">hi</span>
      </div>
    );
  }
}
