import { Component, SyntheticEvent } from "react";
import "./MinecraftFilter.css";
import { FilterMode } from "../minecraft/IFilterClause";
import MinecraftFilterClauseSet from "./MinecraftFilterClauseSet";
import { IFilterClauseSet } from "../minecraft/IFilterClauseSet";

export interface IMinecraftFilterProps {
  data: IFilterClauseSet;
  filterContextId: string;
  onChange?: (
    event: SyntheticEvent<HTMLElement, Event> | React.KeyboardEvent<Element> | null,
    data: IMinecraftFilterProps
  ) => void;
}

interface IMinecraftFilterState {
  filterMode: FilterMode;
}

export default class MinecraftFilter extends Component<IMinecraftFilterProps, IMinecraftFilterState> {
  constructor(props: IMinecraftFilterProps) {
    super(props);

    this.state = {
      filterMode: FilterMode.and,
    };
  }

  render() {
    return (
      <div className="mifi-outer">
        <div className="mifi-clauseBin">
          <MinecraftFilterClauseSet
            displayCloseButton={false}
            data={this.props.data}
            filterContextId={this.props.filterContextId}
          />
        </div>
      </div>
    );
  }
}
