import { Component, SyntheticEvent } from "react";
import "./MinecraftFilterClauseSetEditor.css";
import { MinecraftFilterClauseSet } from "../minecraft/jsoncommon/MinecraftFilterClauseSet";
import { MinecraftFilterClause } from "../minecraft/jsoncommon/MinecraftFilterClause";
import MinecraftFilterClauseEditor, { IMinecraftFilterClauseEditorProps } from "./MinecraftFilterClauseEditor";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus } from "@fortawesome/free-solid-svg-icons";
import { Button } from "@mui/material";
import { faSquare, faSquareCheck } from "@fortawesome/free-regular-svg-icons";
import { getThemeColors } from "../UX/hooks/theme/useThemeColors";
import Log from "../core/Log";

export enum FilterClauseSetType {
  anyOf,
  allOf,
}

export interface IMinecraftFilterClauseSetEditorProps {
  data: MinecraftFilterClauseSet | MinecraftFilterClause;
  displayCloseButton: boolean;
  displayNarrow?: boolean;
  filterContextId: string;
  /** When true, wraps clauses in a styled bin with a label, hidden when empty. */
  renderClausesInBin?: boolean;
  /** Whether there are currently any clauses (used with renderClausesInBin). */
  hasClauses?: boolean;
  onChange?: (
    event: SyntheticEvent<HTMLElement, Event> | React.KeyboardEvent<Element> | null,
    data: IMinecraftFilterClauseSetEditorProps
  ) => void;
}

interface IMinecraftFilterClauseSetState {
  clauseState: string;
}

export default class MinecraftFilterClauseSetEditor extends Component<
  IMinecraftFilterClauseSetEditorProps,
  IMinecraftFilterClauseSetState
> {
  constructor(props: IMinecraftFilterClauseSetEditorProps) {
    super(props);

    this._addClause = this._addClause.bind(this);
    this._setClauseAll = this._setClauseAll.bind(this);
    this._setClauseAny = this._setClauseAny.bind(this);
    this._removeClause = this._removeClause.bind(this);

    this.state = {
      clauseState: JSON.stringify(this.props.data),
    };
  }

  _getNewClause() {
    return {
      operator: "==",
      test: "has_component",
      value: "",
      subject: "self",
    };
  }

  _addClause() {
    const clauseColl = (this.props.data as MinecraftFilterClauseSet).all_of
      ? (this.props.data as MinecraftFilterClauseSet).all_of
      : (this.props.data as MinecraftFilterClauseSet).any_of;

    if (this._isEmpty()) {
      (this.props.data as MinecraftFilterClause).operator = "==";
      (this.props.data as MinecraftFilterClause).test = "has_component";
      (this.props.data as MinecraftFilterClause).value = "";
      (this.props.data as MinecraftFilterClause).subject = "self";
    } else if (clauseColl) {
      clauseColl.push(this._getNewClause());
    } else {
      // promote a filter clause to a filter clause set
      (this.props.data as MinecraftFilterClauseSet).any_of = [
        {
          operator: (this.props.data as MinecraftFilterClause).operator,
          test: (this.props.data as MinecraftFilterClause).test,
          value: (this.props.data as MinecraftFilterClause).value,
          subject: (this.props.data as MinecraftFilterClause).subject,
        },
        this._getNewClause(),
      ];

      (this.props.data as any).operator = undefined;
      (this.props.data as any).test = undefined;
      (this.props.data as any).value = undefined;
      (this.props.data as any).subject = undefined;
    }

    this._updateState();
  }

  _setClauseAll() {
    (this.props.data as MinecraftFilterClauseSet).all_of = (this.props.data as MinecraftFilterClauseSet).any_of;
    (this.props.data as MinecraftFilterClauseSet).any_of = undefined;

    this._updateState();
  }

  _setClauseAny() {
    (this.props.data as MinecraftFilterClauseSet).any_of = (this.props.data as MinecraftFilterClauseSet).all_of;
    (this.props.data as MinecraftFilterClauseSet).all_of = undefined;

    this._updateState();
  }

  _updateState() {
    this.setState({
      clauseState: JSON.stringify(this.props.data),
    });
  }

  _isEmpty() {
    return !(
      (this.props.data as MinecraftFilterClauseSet).any_of ||
      (this.props.data as MinecraftFilterClauseSet).all_of ||
      (this.props.data as MinecraftFilterClause).test
    );
  }

  _removeClause(data: IMinecraftFilterClauseEditorProps) {
    // we have just one element, and we're a singleton IFilterClause
    if (data === this.props.data) {
      (this.props.data as any).test = undefined;
      (this.props.data as any).operator = undefined;
      (this.props.data as any).subject = undefined;
      (this.props.data as any).value = undefined;
      (this.props.data as MinecraftFilterClauseSet).any_of = undefined;
      (this.props.data as MinecraftFilterClauseSet).all_of = undefined;
    } else {
      const coll =
        (this.props.data as MinecraftFilterClauseSet).any_of || (this.props.data as MinecraftFilterClauseSet).all_of;

      if (coll) {
        const newColl = [];

        for (const collItem of coll) {
          if (collItem !== data.data) {
            newColl.push(collItem);
          }
        }

        if (newColl.length < 1) {
          Log.unexpectedContentState("MIFICSRC");
        } else if (newColl.length === 1) {
          // we've gone from a collection down to one element, so collapse the outermost node collection

          (this.props.data as MinecraftFilterClauseSet).any_of = undefined;
          (this.props.data as MinecraftFilterClauseSet).all_of = undefined;

          const remaining = newColl[0] as MinecraftFilterClause;

          if (remaining.test || remaining.operator || remaining.subject || remaining.value) {
            (this.props.data as MinecraftFilterClause).test = remaining.test;
            (this.props.data as MinecraftFilterClause).operator = remaining.operator;
            (this.props.data as MinecraftFilterClause).subject = remaining.subject;
            (this.props.data as MinecraftFilterClause).value = remaining.value;
          } else if ((newColl[0] as MinecraftFilterClauseSet).any_of) {
            (this.props.data as MinecraftFilterClauseSet).any_of = (newColl[0] as MinecraftFilterClauseSet).any_of;
          } else if ((newColl[0] as MinecraftFilterClauseSet).all_of) {
            (this.props.data as MinecraftFilterClauseSet).all_of = (newColl[0] as MinecraftFilterClauseSet).all_of;
          }
        } else if ((this.props.data as MinecraftFilterClauseSet).any_of) {
          (this.props.data as MinecraftFilterClauseSet).any_of = newColl;
        } else if ((this.props.data as MinecraftFilterClauseSet).all_of) {
          (this.props.data as MinecraftFilterClauseSet).all_of = newColl;
        }
      }
    }
    this._updateState();
  }

  render() {
    const clauseColl = (this.props.data as MinecraftFilterClauseSet).all_of
      ? (this.props.data as MinecraftFilterClauseSet).all_of
      : (this.props.data as MinecraftFilterClauseSet).any_of;

    const clauseElements: any[] = [];

    if (clauseColl) {
      let i = 0;
      for (const clauseOrSet of clauseColl) {
        if ((clauseOrSet as MinecraftFilterClauseSet).any_of || (clauseOrSet as MinecraftFilterClauseSet).all_of) {
          clauseElements.push(
            <MinecraftFilterClauseSetEditor
              displayCloseButton={true}
              displayNarrow={this.props.displayNarrow}
              key={"fcse-" + i + this.props.filterContextId}
              data={clauseOrSet as MinecraftFilterClauseSet}
              filterContextId={this.props.filterContextId}
            />
          );
        } else {
          clauseElements.push(
            <MinecraftFilterClauseEditor
              displayCloseButton={true}
              displayNarrow={this.props.displayNarrow}
              key={"fce-" + i + this.props.filterContextId}
              data={clauseOrSet as MinecraftFilterClause}
              filterContextId={this.props.filterContextId}
              onClose={this._removeClause}
            />
          );
        }
        i++;
      }
    } else if (!this._isEmpty()) {
      clauseElements.push(
        <MinecraftFilterClauseEditor
          displayCloseButton={true}
          displayNarrow={this.props.displayNarrow}
          key={"fcsea-" + this.props.filterContextId}
          filterContextId={this.props.filterContextId}
          data={this.props.data as MinecraftFilterClause}
          onClose={this._removeClause}
        />
      );
    }

    let outerClass = this.props.displayNarrow ? "mifics-outer-narrow" : "mifics-outer";

    return (
      <div className={outerClass}>
        <div className="mifics-toolbar">
          <div className="mifics-toolbarInner" role="toolbar" aria-label="Minecraft filter management">
            <button className="eat-mcBtn" onClick={this._addClause} title="Add new query">
              <FontAwesomeIcon icon={faPlus} />
              Add condition
            </button>
            {clauseElements.length > 1 && (
              <>
                {this.props.displayNarrow ? (
                  <>
                    <button
                      className={
                        "eat-mcBtn" + ((this.props.data as MinecraftFilterClauseSet).all_of ? " eat-mcBtn-active" : "")
                      }
                      disabled={(this.props.data as MinecraftFilterClauseSet).all_of !== undefined}
                      onClick={this._setClauseAll}
                      title="All conditions must match"
                    >
                      All
                    </button>
                    <button
                      className={
                        "eat-mcBtn" + ((this.props.data as MinecraftFilterClauseSet).any_of ? " eat-mcBtn-active" : "")
                      }
                      disabled={(this.props.data as MinecraftFilterClauseSet).any_of !== undefined}
                      onClick={this._setClauseAny}
                      title="Any condition can match"
                    >
                      Any
                    </button>
                  </>
                ) : (
                  <>
                    <Button
                      key="All"
                      disabled={(this.props.data as MinecraftFilterClauseSet).all_of !== undefined}
                      onClick={this._setClauseAll}
                      title="All"
                      variant="text"
                      size="small"
                    >
                      <div
                        className={
                          (this.props.data as MinecraftFilterClauseSet).all_of
                            ? "mifics-toggledExtendedButton"
                            : "mifics-extendedButton"
                        }
                      >
                        <FontAwesomeIcon icon={faSquareCheck} className="fa-lg" />
                        <FontAwesomeIcon icon={faSquareCheck} className="fa-lg" />
                        <span className="mifics-buttonLabel">All</span>
                      </div>
                    </Button>
                    <Button
                      key="Any"
                      disabled={(this.props.data as MinecraftFilterClauseSet).any_of !== undefined}
                      onClick={this._setClauseAny}
                      title="Any"
                      variant="text"
                      size="small"
                    >
                      <div
                        className={
                          (this.props.data as MinecraftFilterClauseSet).any_of
                            ? "mifics-toggledExtendedButton"
                            : "mifics-extendedButton"
                        }
                      >
                        <FontAwesomeIcon icon={faSquare} className="fa-lg" />
                        <FontAwesomeIcon icon={faSquareCheck} className="fa-lg" />
                        <span className="mifics-buttonLabel">Any</span>
                      </div>
                    </Button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
        {clauseElements.length > 0 && this.props.renderClausesInBin && (
          <div className="eat-conditionLabel">Run this action when:</div>
        )}
        {clauseElements.length > 0 && (
          <div
            className={this.props.renderClausesInBin ? "mifics-inner eat-conditionsBin" : "mifics-inner"}
            style={
              this.props.renderClausesInBin
                ? {
                    backgroundColor: getThemeColors().background2,
                    borderColor: getThemeColors().background4,
                  }
                : undefined
            }
          >
            <div className="mifics-cell">{clauseElements}</div>
          </div>
        )}
      </div>
    );
  }
}
