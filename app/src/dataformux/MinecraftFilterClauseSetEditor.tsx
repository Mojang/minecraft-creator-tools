import { Component, SyntheticEvent } from "react";
import "./MinecraftFilterClauseSetEditor.css";
import { MinecraftFilterClauseSet } from "../minecraft/jsoncommon/MinecraftFilterClauseSet";
import { MinecraftFilterClause } from "../minecraft/jsoncommon/MinecraftFilterClause";
import MinecraftFilterClauseEditor, { IMinecraftFilterClauseEditorProps } from "./MinecraftFilterClauseEditor";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus } from "@fortawesome/free-solid-svg-icons";
import { Toolbar } from "@fluentui/react-northstar";
import { faSquare, faSquareCheck } from "@fortawesome/free-regular-svg-icons";
import { CustomLabel } from "../UX/Labels";
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
            newColl.push(data.data);
          }
        }

        if (newColl.length < 1) {
          Log.unexpectedContentState("MIFICSRC");
        } else if (newColl.length === 1) {
          // we've gone from a collection down to one element, so collapse the outermost node collection

          (this.props.data as MinecraftFilterClauseSet).any_of = undefined;
          (this.props.data as MinecraftFilterClauseSet).all_of = undefined;

          if (newColl[0].test || newColl[0].operator || newColl[0].subject || newColl[0].value) {
            (this.props.data as MinecraftFilterClause).test = newColl[0].test;
            (this.props.data as MinecraftFilterClause).operator = newColl[0].operator;
            (this.props.data as MinecraftFilterClause).subject = newColl[0].subject;
            (this.props.data as MinecraftFilterClause).value = newColl[0].value;
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

    const toolbarItems = [];

    toolbarItems.push({
      icon: (
        <CustomLabel
          icon={<FontAwesomeIcon icon={faPlus} className="fa-lg" />}
          text={"Add condition"}
          isCompact={false}
        />
      ),
      key: "add",
      onClick: this._addClause,
      title: "Add new query",
    });

    if (clauseElements.length > 1) {
      toolbarItems.push({
        icon: (
          <div
            className={
              (this.props.data as MinecraftFilterClauseSet as any).all_of
                ? "mifics-toggledExtendedButton"
                : "mifics-extendedButton"
            }
          >
            <FontAwesomeIcon icon={faSquareCheck} className="fa-lg" />
            <FontAwesomeIcon icon={faSquareCheck} className="fa-lg" />
            <span className="mifics-buttonLabel">All</span>
          </div>
        ),
        key: "All",
        disabled: (this.props.data as MinecraftFilterClauseSet as any).all_of !== undefined,
        onClick: this._setClauseAll,
        title: "All",
      });

      toolbarItems.push({
        icon: (
          <div
            className={
              (this.props.data as MinecraftFilterClauseSet as any).any_of
                ? "mifics-toggledExtendedButton"
                : "mifics-extendedButton"
            }
          >
            <FontAwesomeIcon icon={faSquare} className="fa-lg" />
            <FontAwesomeIcon icon={faSquareCheck} className="fa-lg" />
            <span className="mifics-buttonLabel">Any</span>
          </div>
        ),
        key: "Any",
        disabled: (this.props.data as MinecraftFilterClauseSet as any).any_of !== undefined,
        onClick: this._setClauseAny,
        title: "Any",
      });
    }

    let outerClass = this.props.displayNarrow ? "mifics-outer" : "mifics-outer-narrow";

    return (
      <div className={outerClass}>
        <Toolbar aria-label="Minecraft filter management" items={toolbarItems} />
        <div className="mifics-inner">
          <div className="mifics-cell">{clauseElements}</div>
        </div>
      </div>
    );
  }
}
