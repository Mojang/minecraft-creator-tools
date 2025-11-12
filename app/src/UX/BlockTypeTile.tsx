import { Component } from "react";
import CreatorToolsHost from "../app/CreatorToolsHost";
import Database from "./../minecraft/Database";
import "./BlockTypeTile.css";
import IAppProps from "./IAppProps";

interface IBlockTypeTileProps extends IAppProps {
  blockTypeId: string;
  isSelected: boolean;
  onClick?: (blockTypeId: string) => void;
}

interface IBlockTypeTileState {}

export default class BlockTypeTile extends Component<IBlockTypeTileProps, IBlockTypeTileState> {
  constructor(props: IBlockTypeTileProps) {
    super(props);

    this._handleClick = this._handleClick.bind(this);
  }

  _handleClick() {
    if (this.props !== null && this.props.onClick !== undefined) {
      this.props.onClick(this.props.blockTypeId);
    }
  }

  render() {
    if (this.props === undefined || this.props.blockTypeId === null) {
      return;
    }

    const blockType = Database.getBlockType(this.props.blockTypeId);

    if (blockType === undefined) {
      return;
    }

    const icon = blockType.getIcon();

    let image = <></>;

    if (icon === "air") {
      image = <div className="btt-iconplaceholder">&#160;</div>;
    } else {
      image = (
        <img
          className="btt-icon"
          alt=""
          src={
            CreatorToolsHost.contentRoot +
            "res/latest/van/release/resource_pack/textures/blocks/" +
            blockType.getIcon() +
            ".png"
          }
        />
      );
    }

    return (
      <div className="btt-outer" onClick={this._handleClick}>
        {image}
        <span className="btt-title">{blockType.title}</span>
      </div>
    );
  }
}
