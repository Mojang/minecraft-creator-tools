// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * TradeTierVisualEditor - Visual editor for a single trade tier.
 *
 * Layout:
 * - Optional header with `total_exp_required` (XP needed to unlock this tier).
 * - One section per group inside the tier. Each group shows its `num_to_select`
 *   (how many of the trades the villager will pick) and a list of TradeTile cards.
 * - Inline TradeEditor expands when a trade is selected.
 * - TradeItemDropZone at the bottom of each group accepts dragged items.
 * - "+ Add Group" button at the very bottom.
 */

import React, { Component } from "react";
import "./TradeTierVisualEditor.css";
import {
  ITradeTableTier,
  ITradeTableTrade,
} from "../../../minecraft/ITradingBehavior";
import TradeTile from "./TradeTile";
import TradeEditor from "./TradeEditor";
import TradeItemDropZone from "./TradeItemDropZone";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faHandshake, faPlus } from "@fortawesome/free-solid-svg-icons";
import { Button, IconButton, TextField } from "@mui/material";
import { faXmark } from "@fortawesome/free-solid-svg-icons";

export interface ITradeTierVisualEditorProps {
  tier: ITradeTableTier;
  tierIndex: number;
  singleTier?: boolean;
  readOnly?: boolean;
  onChange?: (tier: ITradeTableTier) => void;
}

interface ITradeTierVisualEditorState {
  /** Selected trade as "groupIndex.tradeIndex" or null. */
  selected: { group: number; trade: number } | null;
}

function makeEmptyTrade(givesItemId?: string): ITradeTableTrade {
  return {
    wants: [{ item: "minecraft:emerald", quantity: { min: 1, max: 1 } }],
    gives: [{ item: givesItemId || "minecraft:wheat", quantity: { min: 1, max: 1 } }],
  };
}

export default class TradeTierVisualEditor extends Component<
  ITradeTierVisualEditorProps,
  ITradeTierVisualEditorState
> {
  constructor(props: ITradeTierVisualEditorProps) {
    super(props);
    this.state = { selected: null };

    this._handleExpChange = this._handleExpChange.bind(this);
    this._handleAddGroup = this._handleAddGroup.bind(this);
  }

  private _emit(tier: ITradeTableTier): void {
    this.props.onChange?.(tier);
  }

  private _handleExpChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const raw = e.target.value;
    const tier = { ...this.props.tier };
    if (raw === "") {
      delete tier.total_exp_required;
    } else {
      const n = Math.max(0, parseInt(raw) || 0);
      tier.total_exp_required = n;
    }
    this._emit(tier);
  }

  private _handleNumToSelectChange(groupIndex: number, e: React.ChangeEvent<HTMLInputElement>): void {
    const raw = e.target.value;
    const groups = [...this.props.tier.groups];
    const group = { ...groups[groupIndex] };
    if (raw === "") {
      delete group.num_to_select;
    } else {
      group.num_to_select = Math.max(0, parseInt(raw) || 0);
    }
    groups[groupIndex] = group;
    this._emit({ ...this.props.tier, groups });
  }

  private _handleTradeClick(groupIndex: number, tradeIndex: number): void {
    this.setState((prev) => {
      const isSame =
        prev.selected !== null && prev.selected.group === groupIndex && prev.selected.trade === tradeIndex;
      return { selected: isSame ? null : { group: groupIndex, trade: tradeIndex } };
    });
  }

  private _handleTradeChange(groupIndex: number, tradeIndex: number, trade: ITradeTableTrade): void {
    const groups = [...this.props.tier.groups];
    const group = { ...groups[groupIndex], trades: [...(groups[groupIndex].trades || [])] };
    group.trades[tradeIndex] = trade;
    groups[groupIndex] = group;
    this._emit({ ...this.props.tier, groups });
  }

  private _handleTradeRemove(groupIndex: number, tradeIndex: number): void {
    const groups = [...this.props.tier.groups];
    const group = { ...groups[groupIndex], trades: [...(groups[groupIndex].trades || [])] };
    group.trades.splice(tradeIndex, 1);
    groups[groupIndex] = group;
    this._emit({ ...this.props.tier, groups });

    const sel = this.state.selected;
    if (sel && sel.group === groupIndex) {
      if (sel.trade === tradeIndex) this.setState({ selected: null });
      else if (sel.trade > tradeIndex) this.setState({ selected: { group: sel.group, trade: sel.trade - 1 } });
    }
  }

  private _handleTradeDone(): void {
    this.setState({ selected: null });
  }

  private _handleItemDrop(groupIndex: number, itemId: string): void {
    const groups = [...this.props.tier.groups];
    const group = { ...groups[groupIndex], trades: [...(groups[groupIndex].trades || [])] };
    group.trades.push(makeEmptyTrade(itemId));
    groups[groupIndex] = group;
    this._emit({ ...this.props.tier, groups });
    this.setState({ selected: { group: groupIndex, trade: group.trades.length - 1 } });
  }

  private _handleAddGroup(): void {
    const groups = [...this.props.tier.groups, { trades: [], num_to_select: 1 }];
    this._emit({ ...this.props.tier, groups });
  }

  private _handleRemoveGroup(groupIndex: number): void {
    const groups = [...this.props.tier.groups];
    groups.splice(groupIndex, 1);
    this._emit({ ...this.props.tier, groups });
    if (this.state.selected && this.state.selected.group === groupIndex) {
      this.setState({ selected: null });
    }
  }

  render(): React.ReactNode {
    const { tier, readOnly, singleTier } = this.props;
    const { selected } = this.state;
    const groups = tier.groups || [];
    const showGroupHeader = groups.length > 1 || !singleTier;

    return (
      <div className="ttv-container">
        <div className="ttv-tier-meta">
          <div className="ttv-meta-field">
            <span className="ttv-meta-label">Unlocks at total XP</span>
            <TextField
              size="small"
              type="number"
              value={tier.total_exp_required ?? ""}
              onChange={this._handleExpChange}
              disabled={readOnly}
              placeholder="0"
              inputProps={{ min: 0 }}
              sx={{ width: 96 }}
            />
            <span className="ttv-meta-hint">
              The villager must earn this much trader XP before any of these trades unlock.
            </span>
          </div>
        </div>

        {groups.map((group, gi) => {
          const trades = group.trades || [];
          return (
            <div className="ttv-group" key={gi}>
              {showGroupHeader && (
                <div className="ttv-group-header">
                  <span className="ttv-group-title">Group {gi + 1}</span>
                  <div className="ttv-group-num-to-select">
                    <span className="ttv-group-label">Pick</span>
                    <TextField
                      size="small"
                      type="number"
                      value={group.num_to_select ?? ""}
                      onChange={(e) =>
                        this._handleNumToSelectChange(gi, e as React.ChangeEvent<HTMLInputElement>)
                      }
                      disabled={readOnly}
                      placeholder="all"
                      inputProps={{ min: 0 }}
                      sx={{ width: 64 }}
                    />
                    <span className="ttv-group-label">of {trades.length}</span>
                  </div>
                  {!readOnly && groups.length > 1 && (
                    <IconButton
                      size="small"
                      className="ttv-group-remove"
                      onClick={() => this._handleRemoveGroup(gi)}
                      title="Remove group"
                      aria-label="Remove group"
                    >
                      <FontAwesomeIcon icon={faXmark} />
                    </IconButton>
                  )}
                </div>
              )}

              {trades.length === 0 ? (
                <div className="ttv-empty-state">
                  <FontAwesomeIcon icon={faHandshake} className="ttv-empty-icon" />
                  <span>No trades in this group yet. Drag an item from the picker or click below to add.</span>
                </div>
              ) : (
                <div className="ttv-trades-list">
                  {trades.map((trade, ti) => (
                    <React.Fragment key={ti}>
                      <TradeTile
                        trade={trade}
                        index={ti}
                        isSelected={selected !== null && selected.group === gi && selected.trade === ti}
                        readOnly={readOnly}
                        onClick={() => this._handleTradeClick(gi, ti)}
                        onRemove={() => this._handleTradeRemove(gi, ti)}
                      />
                      {selected !== null && selected.group === gi && selected.trade === ti && (
                        <TradeEditor
                          trade={trade}
                          readOnly={readOnly}
                          onChange={(t) => this._handleTradeChange(gi, ti, t)}
                          onDone={() => this._handleTradeDone()}
                        />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              )}

              <TradeItemDropZone onItemDrop={(itemId) => this._handleItemDrop(gi, itemId)} readOnly={readOnly} />
            </div>
          );
        })}

        {!readOnly && (
          <Button
            className="ttv-add-group-btn"
            size="small"
            onClick={this._handleAddGroup}
            startIcon={<FontAwesomeIcon icon={faPlus} />}
          >
            Add group
          </Button>
        )}
      </div>
    );
  }
}
