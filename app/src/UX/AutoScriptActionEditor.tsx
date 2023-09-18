import { Component } from "react";
import "./AutoScriptActionEditor.css";
import AutoScriptAction from "../autoscript/AutoScriptAction.js";
import DataForm from "../dataform/DataForm";
import IFormDefinition from "../dataform/IFormDefinition.js";
import Database from "../minecraft/Database";
import { CloseIcon } from "@fluentui/react-icons-northstar";

interface IAutoScriptActionEditorProps {
  action: AutoScriptAction;

  ambientSelectedPoint?: number[] | undefined;
  onRemove?: (action: AutoScriptAction) => void;
}

interface IAutoScriptActionEditorState {}

export default class AutoScriptActionEditor extends Component<
  IAutoScriptActionEditorProps,
  IAutoScriptActionEditorState
> {
  constructor(props: IAutoScriptActionEditorProps) {
    super(props);

    this._handleCloseClick = this._handleCloseClick.bind(this);
  }

  _handleCloseClick() {
    if (this.props.onRemove) {
      this.props.onRemove(this.props.action);
    }
  }

  render() {
    if (Database.uxCatalog === null) {
      return <div>Loading...</div>;
    }

    const formDef: IFormDefinition = (Database.uxCatalog as any)["scriptAction." + this.props.action.type];

    if (!formDef) {
      return <div>(error: could not find form for {this.props.action.title})</div>;
    }
    return (
      <div className="asae-area">
        <div className="asae-areaInner">
          <div className="asae-actionsHeader">{this.props.action.title}</div>
          <div className="asae-actionsClose">
            <CloseIcon onClick={this._handleCloseClick} />
          </div>
        </div>
        <div className="asae-actionsForm">
          <DataForm
            definition={formDef}
            readOnly={false}
            getsetPropertyObject={this.props.action}
            ambientSelectedPoint={this.props.ambientSelectedPoint}
          />
        </div>
      </div>
    );
  }
}
