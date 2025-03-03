import { Component, SyntheticEvent } from "react";
import "./MinecraftFilterClauseSet.css";
import { IFilterClauseSet } from "../minecraft/IFilterClauseSet";
import { IFilterClause } from "../minecraft/IFilterClause";
import MinecraftFilterClause, { IMinecraftFilterClauseProps } from "./MinecraftFilterClause";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faAdd } from "@fortawesome/free-solid-svg-icons";
import { Toolbar } from "@fluentui/react-northstar";
import { faSquare, faSquareCheck } from "@fortawesome/free-regular-svg-icons";
import { CustomLabel } from "../UX/Labels";
import Log from "../core/Log";

export enum FilterClauseSetType {
  anyOf,
  allOf,
}

export interface IMinecraftFilterClauseSetProps {
  data: IFilterClauseSet | IFilterClause;
  displayCloseButton: boolean;
  filterContextId: string;
  onChange?: (
    event: SyntheticEvent<HTMLElement, Event> | React.KeyboardEvent<Element> | null,
    data: IMinecraftFilterClauseSetProps
  ) => void;
}

interface IMinecraftFilterClauseSetState {
  clauseState: string;
}

export default class MinecraftFilterClauseSet extends Component<
  IMinecraftFilterClauseSetProps,
  IMinecraftFilterClauseSetState
> {
  constructor(props: IMinecraftFilterClauseSetProps) {
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
    const clauseColl = (this.props.data as IFilterClauseSet).all_of
      ? (this.props.data as IFilterClauseSet).all_of
      : (this.props.data as IFilterClauseSet).any_of;

    if (this._isEmpty()) {
      (this.props.data as IFilterClause).operator = "==";
      (this.props.data as IFilterClause).test = "has_component";
      (this.props.data as IFilterClause).value = "";
      (this.props.data as IFilterClause).subject = "self";
    } else if (clauseColl) {
      clauseColl.push(this._getNewClause());
    } else {
      // promote a filter clause to a filter clause set
      (this.props.data as IFilterClauseSet).any_of = [
        {
          operator: (this.props.data as IFilterClause).operator,
          test: (this.props.data as IFilterClause).test,
          value: (this.props.data as IFilterClause).value,
          subject: (this.props.data as IFilterClause).subject,
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
    (this.props.data as IFilterClauseSet).all_of = (this.props.data as IFilterClauseSet).any_of;
    (this.props.data as IFilterClauseSet).any_of = undefined;

    this._updateState();
  }

  _setClauseAny() {
    (this.props.data as IFilterClauseSet).any_of = (this.props.data as IFilterClauseSet).all_of;
    (this.props.data as IFilterClauseSet).all_of = undefined;

    this._updateState();
  }

  _updateState() {
    this.setState({
      clauseState: JSON.stringify(this.props.data),
    });
  }

  _isEmpty() {
    return !(
      (this.props.data as IFilterClauseSet).any_of ||
      (this.props.data as IFilterClauseSet).all_of ||
      (this.props.data as IFilterClause).test
    );
  }

  _removeClause(data: IMinecraftFilterClauseProps) {
    // we have just one element, and we're a singleton IFilterClause
    if (data === this.props.data) {
      (this.props.data as any).test = undefined;
      (this.props.data as any).operator = undefined;
      (this.props.data as any).subject = undefined;
      (this.props.data as any).value = undefined;
      (this.props.data as IFilterClauseSet).any_of = undefined;
      (this.props.data as IFilterClauseSet).all_of = undefined;
    } else {
      const coll = (this.props.data as IFilterClauseSet).any_of || (this.props.data as IFilterClauseSet).all_of;

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

          (this.props.data as IFilterClauseSet).any_of = undefined;
          (this.props.data as IFilterClauseSet).all_of = undefined;

          if (newColl[0].test || newColl[0].operator || newColl[0].subject || newColl[0].value) {
            (this.props.data as IFilterClause).test = newColl[0].test;
            (this.props.data as IFilterClause).operator = newColl[0].operator;
            (this.props.data as IFilterClause).subject = newColl[0].subject;
            (this.props.data as IFilterClause).value = newColl[0].value;
          } else if ((newColl[0] as IFilterClauseSet).any_of) {
            (this.props.data as IFilterClauseSet).any_of = (newColl[0] as IFilterClauseSet).any_of;
          } else if ((newColl[0] as IFilterClauseSet).all_of) {
            (this.props.data as IFilterClauseSet).all_of = (newColl[0] as IFilterClauseSet).all_of;
          }
        } else if ((this.props.data as IFilterClauseSet).any_of) {
          (this.props.data as IFilterClauseSet).any_of = newColl;
        } else if ((this.props.data as IFilterClauseSet).all_of) {
          (this.props.data as IFilterClauseSet).all_of = newColl;
        }
      }
    }
    this._updateState();
  }

  render() {
    const clauseColl = (this.props.data as IFilterClauseSet).all_of
      ? (this.props.data as IFilterClauseSet).all_of
      : (this.props.data as IFilterClauseSet).any_of;

    const clauseElements: any[] = [];

    if (clauseColl) {
      for (const clauseOrSet of clauseColl) {
        if ((clauseOrSet as IFilterClauseSet).any_of || (clauseOrSet as IFilterClauseSet).all_of) {
          clauseElements.push(
            <MinecraftFilterClauseSet
              displayCloseButton={true}
              data={clauseOrSet as IFilterClauseSet}
              filterContextId={this.props.filterContextId}
            />
          );
        } else {
          clauseElements.push(
            <MinecraftFilterClause
              displayCloseButton={true}
              data={clauseOrSet as IFilterClause}
              filterContextId={this.props.filterContextId}
              onClose={this._removeClause}
            />
          );
        }
      }
    } else if (!this._isEmpty()) {
      clauseElements.push(
        <MinecraftFilterClause
          displayCloseButton={true}
          filterContextId={this.props.filterContextId}
          data={this.props.data as IFilterClause}
          onClose={this._removeClause}
        />
      );
    }

    const toolbarItems = [];

    toolbarItems.push({
      icon: (
        <CustomLabel
          icon={<FontAwesomeIcon icon={faAdd} className="fa-lg" />}
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
              (this.props.data as IFilterClauseSet as any).all_of
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
        disabled: (this.props.data as IFilterClauseSet as any).all_of !== undefined,
        onClick: this._setClauseAll,
        title: "All",
      });

      toolbarItems.push({
        icon: (
          <div
            className={
              (this.props.data as IFilterClauseSet as any).any_of
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
        disabled: (this.props.data as IFilterClauseSet as any).any_of !== undefined,
        onClick: this._setClauseAny,
        title: "Any",
      });
    }

    return (
      <div className="mifics-outer">
        <Toolbar aria-label="Minecraft filter management" items={toolbarItems} />
        <div className="mifics-inner">
          <div className="mifics-cell">{clauseElements}</div>
        </div>
      </div>
    );
  }
}
