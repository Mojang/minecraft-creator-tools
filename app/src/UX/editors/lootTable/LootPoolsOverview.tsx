// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * LootPoolsOverview - Visual overview of all pools in a loot table.
 *
 * Behavior:
 * - If there is exactly 1 pool, renders the LootPoolVisualEditor directly
 *   without any pool-list chrome (no header, no card wrapper).
 * - If there are multiple pools, shows collapsible pool cards, each
 *   containing a LootPoolVisualEditor.
 * - "+ Add Pool" button at the bottom.
 *
 * All pool mutations are forwarded to the parent via onChange(pools).
 */

import React, { Component } from "react";
import "./LootPoolsOverview.css";
import { ILootTableBehaviorPool } from "../../../minecraft/ILootTableBehavior";
import LootPoolVisualEditor from "./LootPoolVisualEditor";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronRight, faPlus } from "@fortawesome/free-solid-svg-icons";
import { Button } from "@mui/material";

export interface ILootPoolsOverviewProps {
  pools: ILootTableBehaviorPool[];
  readOnly?: boolean;
  onChange?: (pools: ILootTableBehaviorPool[]) => void;
}

interface ILootPoolsOverviewState {
  expandedPools: Set<number>;
}

export default class LootPoolsOverview extends Component<ILootPoolsOverviewProps, ILootPoolsOverviewState> {
  constructor(props: ILootPoolsOverviewProps) {
    super(props);

    // Expand all pools initially
    const expanded = new Set<number>();
    for (let i = 0; i < props.pools.length; i++) {
      expanded.add(i);
    }
    this.state = { expandedPools: expanded };

    this._handleAddPool = this._handleAddPool.bind(this);
  }

  componentDidUpdate(prevProps: ILootPoolsOverviewProps): void {
    if (prevProps.pools.length < this.props.pools.length) {
      // Auto-expand newly added pools
      const expanded = new Set(this.state.expandedPools);
      expanded.add(this.props.pools.length - 1);
      this.setState({ expandedPools: expanded });
    }
  }

  private _togglePool(index: number): void {
    const expanded = new Set(this.state.expandedPools);
    if (expanded.has(index)) {
      expanded.delete(index);
    } else {
      expanded.add(index);
    }
    this.setState({ expandedPools: expanded });
  }

  private _handlePoolChange(index: number, pool: ILootTableBehaviorPool): void {
    const pools = [...this.props.pools];
    pools[index] = pool;
    this.props.onChange?.(pools);
  }

  private _handleRemovePool(index: number, e: React.MouseEvent): void {
    e.stopPropagation();
    const pools = [...this.props.pools];
    pools.splice(index, 1);
    this.props.onChange?.(pools);
  }

  private _handleAddPool(): void {
    const pools = [...this.props.pools];
    pools.push({ rolls: 1, entries: [] });
    this.props.onChange?.(pools);
  }

  private _getRollsSummary(pool: ILootTableBehaviorPool): string {
    const rolls = pool.rolls;
    if (typeof rolls === "number") {
      return `${rolls} roll${rolls !== 1 ? "s" : ""}`;
    }
    return `${rolls.min}-${rolls.max} rolls`;
  }

  render(): React.ReactNode {
    const { pools, readOnly } = this.props;

    // Single pool: no card wrapper, render directly
    if (pools.length === 1) {
      return (
        <div className="lpo-container">
          <LootPoolVisualEditor
            pool={pools[0]}
            readOnly={readOnly}
            onChange={(pool) => this._handlePoolChange(0, pool)}
          />
          {!readOnly && (
            <Button
              className="lpo-add-pool-btn"
              size="small"
              onClick={this._handleAddPool}
              startIcon={<FontAwesomeIcon icon={faPlus} />}
            >
              Add another pool
            </Button>
          )}
        </div>
      );
    }

    // Multiple pools: collapsible cards
    return (
      <div className="lpo-container">
        {pools.map((pool, i) => {
          const isExpanded = this.state.expandedPools.has(i);
          return (
            <div className="lpo-pool-card" key={i}>
              <div className="lpo-pool-card-header" onClick={() => this._togglePool(i)}>
                <span className={"lpo-pool-expand" + (isExpanded ? " lpo-pool-expand-open" : "")}>
                  <FontAwesomeIcon icon={faChevronRight} />
                </span>
                <span className="lpo-pool-number">Pool #{i + 1}</span>
                <span className="lpo-pool-summary">
                  {this._getRollsSummary(pool)} · {(pool.entries || []).length} entries
                </span>
                {!readOnly && (
                  <Button
                    className="lpo-pool-remove-btn"
                    size="small"
                    color="inherit"
                    onClick={(e) => this._handleRemovePool(i, e)}
                    title="Remove pool"
                  >
                    Remove
                  </Button>
                )}
              </div>
              {isExpanded && (
                <div className="lpo-pool-body">
                  <LootPoolVisualEditor
                    pool={pool}
                    readOnly={readOnly}
                    onChange={(p) => this._handlePoolChange(i, p)}
                  />
                </div>
              )}
            </div>
          );
        })}

        {!readOnly && (
          <Button
            className="lpo-add-pool-btn"
            size="small"
            onClick={this._handleAddPool}
            startIcon={<FontAwesomeIcon icon={faPlus} />}
          >
            Add pool
          </Button>
        )}
      </div>
    );
  }
}
