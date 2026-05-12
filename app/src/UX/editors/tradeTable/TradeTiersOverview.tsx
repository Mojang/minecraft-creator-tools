// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * TradeTiersOverview - Visual overview of all tiers in a trade table.
 *
 * Behavior:
 * - Single tier: renders TradeTierVisualEditor directly without card chrome.
 * - Multiple tiers: collapsible cards labeled "Tier #N" with experience summary.
 * - "+ Add Tier" button at the bottom.
 */

import React, { Component } from "react";
import "./TradeTiersOverview.css";
import { ITradeTableTier } from "../../../minecraft/ITradingBehavior";
import TradeTierVisualEditor from "./TradeTierVisualEditor";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronRight, faPlus } from "@fortawesome/free-solid-svg-icons";
import { Button } from "@mui/material";

export interface ITradeTiersOverviewProps {
  tiers: ITradeTableTier[];
  readOnly?: boolean;
  onChange?: (tiers: ITradeTableTier[]) => void;
}

interface ITradeTiersOverviewState {
  expandedTiers: Set<number>;
}

export default class TradeTiersOverview extends Component<ITradeTiersOverviewProps, ITradeTiersOverviewState> {
  constructor(props: ITradeTiersOverviewProps) {
    super(props);

    const expanded = new Set<number>();
    for (let i = 0; i < props.tiers.length; i++) expanded.add(i);
    this.state = { expandedTiers: expanded };

    this._handleAddTier = this._handleAddTier.bind(this);
  }

  componentDidUpdate(prevProps: ITradeTiersOverviewProps): void {
    if (prevProps.tiers.length < this.props.tiers.length) {
      const expanded = new Set(this.state.expandedTiers);
      expanded.add(this.props.tiers.length - 1);
      this.setState({ expandedTiers: expanded });
    }
  }

  private _toggleTier(index: number): void {
    const expanded = new Set(this.state.expandedTiers);
    if (expanded.has(index)) expanded.delete(index);
    else expanded.add(index);
    this.setState({ expandedTiers: expanded });
  }

  private _handleTierChange(index: number, tier: ITradeTableTier): void {
    const tiers = [...this.props.tiers];
    tiers[index] = tier;
    this.props.onChange?.(tiers);
  }

  private _handleRemoveTier(index: number, e: React.MouseEvent): void {
    e.stopPropagation();
    const tiers = [...this.props.tiers];
    tiers.splice(index, 1);
    this.props.onChange?.(tiers);
  }

  private _handleAddTier(): void {
    const tiers = [...this.props.tiers];
    tiers.push({ groups: [{ trades: [], num_to_select: 1 }] });
    this.props.onChange?.(tiers);
  }

  private _getTierSummary(tier: ITradeTableTier): string {
    const tradeCount = (tier.groups || []).reduce((sum, g) => sum + (g.trades || []).length, 0);
    const exp = tier.total_exp_required;
    const tradePart = `${tradeCount} trade${tradeCount !== 1 ? "s" : ""}`;
    return exp !== undefined ? `${tradePart} · unlocks at ${exp} XP` : tradePart;
  }

  render(): React.ReactNode {
    const { tiers, readOnly } = this.props;

    if (tiers.length === 1) {
      return (
        <div className="tto-container">
          <TradeTierVisualEditor
            tier={tiers[0]}
            tierIndex={0}
            singleTier={true}
            readOnly={readOnly}
            onChange={(t) => this._handleTierChange(0, t)}
          />
          {!readOnly && (
            <Button
              className="tto-add-tier-btn"
              size="small"
              onClick={this._handleAddTier}
              startIcon={<FontAwesomeIcon icon={faPlus} />}
            >
              Add another tier
            </Button>
          )}
        </div>
      );
    }

    return (
      <div className="tto-container">
        {tiers.map((tier, i) => {
          const isExpanded = this.state.expandedTiers.has(i);
          return (
            <div className="tto-tier-card" key={i}>
              <div className="tto-tier-card-header" onClick={() => this._toggleTier(i)}>
                <span className={"tto-tier-expand" + (isExpanded ? " tto-tier-expand-open" : "")}>
                  <FontAwesomeIcon icon={faChevronRight} />
                </span>
                <span className="tto-tier-number">Tier #{i + 1}</span>
                <span className="tto-tier-summary">{this._getTierSummary(tier)}</span>
                {!readOnly && (
                  <Button
                    className="tto-tier-remove-btn"
                    size="small"
                    color="inherit"
                    onClick={(e) => this._handleRemoveTier(i, e)}
                    title="Remove tier"
                  >
                    Remove
                  </Button>
                )}
              </div>
              {isExpanded && (
                <div className="tto-tier-body">
                  <TradeTierVisualEditor
                    tier={tier}
                    tierIndex={i}
                    readOnly={readOnly}
                    onChange={(t) => this._handleTierChange(i, t)}
                  />
                </div>
              )}
            </div>
          );
        })}

        {!readOnly && (
          <Button
            className="tto-add-tier-btn"
            size="small"
            onClick={this._handleAddTier}
            startIcon={<FontAwesomeIcon icon={faPlus} />}
          >
            Add tier
          </Button>
        )}
      </div>
    );
  }
}
