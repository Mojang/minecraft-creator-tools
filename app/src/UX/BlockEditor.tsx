import { Component } from "react";
import IAppProps from "./IAppProps";
import Block from "../minecraft/Block";
import "./BlockEditor.css";
import BlockPropertyEditor from "./BlockPropertyEditor";
import BlockTypeTile from "./BlockTypeTile";
import { ICommander } from "./ICommand";

interface IBlockEditorProps extends IAppProps {
  blocks: Block[];
  commander: ICommander;
}

interface IBlockEditorState {}

export default class BlockEditor extends Component<IBlockEditorProps, IBlockEditorState> {
  constructor(props: IBlockEditorProps) {
    super(props);

    this._handleStatusAdded = this._handleStatusAdded.bind(this);
  }

  _handleStatusAdded() {}

  render() {
    const protoBlock = this.props.blocks[0];

    if (protoBlock.typeName === undefined) {
      return <></>;
    }

    return (
      <div className="be-outer">
        <div className="be-header">
          <div className="be-title">
            <BlockTypeTile isSelected={false} blockTypeId={protoBlock.typeName as string} carto={this.props.carto} />
          </div>
          <div className="be-location">
            x: {protoBlock.x} y: {protoBlock.y} z: {protoBlock.z}
          </div>
        </div>
        <div className="be-pe">
          <BlockPropertyEditor blocks={this.props.blocks} commander={this.props.commander} carto={this.props.carto} />
        </div>
      </div>
    );
  }
}
