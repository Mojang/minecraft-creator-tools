import { Component } from "react";
import IAppProps from "../../UX/appShell/IAppProps";
import Block from "../../minecraft/Block";
import "./BlockEditor.css";
import BlockPropertyEditor from "./BlockPropertyEditor";
import BlockTypeTile from "../../UX/editors/blockType/BlockTypeTile";
import IProjectTheme from "../../UX/types/IProjectTheme";

interface IBlockEditorProps extends IAppProps {
  blocks: Block[];
  theme: IProjectTheme;
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
            <BlockTypeTile
              isSelected={false}
              blockTypeId={protoBlock.typeName as string}
              creatorTools={this.props.creatorTools}
            />
          </div>
          <div className="be-location">
            x: {protoBlock.x} y: {protoBlock.y} z: {protoBlock.z}
          </div>
        </div>
        <div className="be-pe">
          <BlockPropertyEditor
            blocks={this.props.blocks}
            theme={this.props.theme}
            creatorTools={this.props.creatorTools}
          />
        </div>
      </div>
    );
  }
}
