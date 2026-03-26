import { Component, SyntheticEvent } from "react";
import "./MinecraftFilterEditor.css";
import { FilterMode } from "../minecraft/jsoncommon/MinecraftFilterClause";
import { MinecraftFilterClause } from "../minecraft/jsoncommon/MinecraftFilterClause";
import MinecraftFilterClauseSetEditor from "./MinecraftFilterClauseSetEditor";
import { MinecraftFilterClauseSet } from "../minecraft/jsoncommon/MinecraftFilterClauseSet";
import { getThemeColors } from "../UX/hooks/theme/useThemeColors";

export interface IMinecraftFilterEditorProps {
  data: MinecraftFilterClauseSet;
  displayNarrow?: boolean;
  filterContextId: string;
  /** When true, renders the toolbar above a separate styled bin that hides when empty. */
  displayBinSeparately?: boolean;
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

  private _hasFilters(): boolean {
    const data = this.props.data;
    return !!(
      (data as MinecraftFilterClauseSet).any_of ||
      (data as MinecraftFilterClauseSet).all_of ||
      (data as MinecraftFilterClause).test
    );
  }

  render() {
    if (!this.props.displayBinSeparately) {
      return (
        <div className="mifi-outer">
          <MinecraftFilterClauseSetEditor
            displayCloseButton={false}
            displayNarrow={this.props.displayNarrow}
            data={this.props.data}
            filterContextId={this.props.filterContextId}
          />
        </div>
      );
    }

    const colors = getThemeColors();
    const hasFilters = this._hasFilters();

    return (
      <div className="mifi-outer">
        <MinecraftFilterClauseSetEditor
          displayCloseButton={false}
          displayNarrow={this.props.displayNarrow}
          data={this.props.data}
          filterContextId={this.props.filterContextId}
          renderClausesInBin={true}
          hasClauses={hasFilters}
        />
      </div>
    );
  }
}
