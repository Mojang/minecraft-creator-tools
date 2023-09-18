import { Component } from "react";
import "./EntityTypeTile.css";
import IAppProps from "./IAppProps";
import { EntityTypeCommand } from "./ProjectItemList";
import Utilities from "../core/Utilities";

interface IEntityTypeTileProps extends IAppProps {
  entityId: string;
  isSelected?: boolean;
  onEntityTypeCommand: (command: EntityTypeCommand, entityId: string) => void;
}

interface IEntityTypeTileState {}

export default class EntityTypeTile extends Component<IEntityTypeTileProps, IEntityTypeTileState> {
  constructor(props: IEntityTypeTileProps) {
    super(props);

    this._projectClick = this._projectClick.bind(this);
  }

  _projectClick() {
    if (this.props.onEntityTypeCommand !== undefined) {
      this.props.onEntityTypeCommand(EntityTypeCommand.select, this.props.entityId);
    }
  }

  render() {
    let outerClassName = "ett-outer";

    if (this.props.isSelected) {
      outerClassName = "ett-outer-selected";
    }

    return (
      <div className={outerClassName} onClick={this._projectClick}>
        <div className="ett-grid">
          <div className="ett-mainArea">
            <div className="ett-title">{Utilities.humanifyMinecraftName(this.props.entityId)}</div>
          </div>
        </div>
      </div>
    );
  }
}
