import { Component, SyntheticEvent } from "react";
import "./MinecraftFilterEditor.css";
import { FilterMode } from "../minecraft/jsoncommon/MinecraftFilterClause";
import MinecraftFilterClauseSetEditor from "./MinecraftFilterClauseSetEditor";
import { MinecraftFilterClauseSet } from "../minecraft/jsoncommon/MinecraftFilterClauseSet";

export interface IMinecraftFilterEditorProps {
  data: MinecraftFilterClauseSet;
  displayNarrow?: boolean;
  filterContextId: string;
  onChange?: (
    event: SyntheticEvent<HTMLElement, Event> | React.KeyboardEvent<Element> | null,
    data: IMinecraftFilterEditorProps
  ) => void;
}

interface IMinecraftFilterState {
  filterMode: FilterMode;
}

export default class MinecraftFilterEditor extends Component<IMinecraftFilterEditorProps, IMinecraftFilterState> {
  constructor(props: IMinecraftFilterEditorProps) {
    super(props);

    this.state = {
      filterMode: FilterMode.and,
    };
  }

  render() {
    return (
      <div className="mifi-outer">
        <div className="mifi-clauseBin">
          <MinecraftFilterClauseSetEditor
            displayCloseButton={false}
            displayNarrow={this.props.displayNarrow}
            data={this.props.data}
            filterContextId={this.props.filterContextId}
          />
        </div>
      </div>
    );
  }
}
