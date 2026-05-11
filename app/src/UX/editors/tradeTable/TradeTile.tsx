// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * TradeTile - Visual card displaying a single trade as: Wants ↔ Gives.
 *
 * Each side shows up to two stacks of {sprite + ×qty}. Clicking the tile expands
 * the inline TradeEditor in the parent. Hover reveals a remove button.
 */

import React, { Component } from "react";
import "./TradeTile.css";
import ItemSpriteIcon from "../recipe/ItemSpriteIcon";
import { ITradeTableItem, ITradeTableTrade } from "../../../minecraft/ITradingBehavior";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRight, faXmark } from "@fortawesome/free-solid-svg-icons";
import { IconButton } from "@mui/material";

export interface ITradeTileProps {
  trade: ITradeTableTrade;
  index: number;
  isSelected?: boolean;
  readOnly?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
}

function quantityLabel(item: ITradeTableItem): string {
  const q = item.quantity;
  if (q === undefined) return "×1";
  if (typeof q === "number") return `×${q}`;
  if (q.min === q.max) return `×${q.min}`;
  return `×${q.min}-${q.max}`;
}

function stripNamespace(id: string): string {
  if (!id) return "";
  return id.includes(":") ? id.substring(id.indexOf(":") + 1) : id;
}

function prettyName(id: string): string {
  return stripNamespace(id)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default class TradeTile extends Component<ITradeTileProps> {
  constructor(props: ITradeTileProps) {
    super(props);
    this._handleClick = this._handleClick.bind(this);
    this._handleRemove = this._handleRemove.bind(this);
  }

  private _handleClick(): void {
    this.props.onClick?.();
  }

  private _handleRemove(e: React.MouseEvent): void {
    e.stopPropagation();
    this.props.onRemove?.();
  }

  private _renderSide(items: ITradeTableItem[] | undefined): React.ReactNode {
    if (!items || items.length === 0) {
      return <span className="ttile-side-empty">—</span>;
    }
    return items.slice(0, 2).map((it, i) => (
      <span className="ttile-stack" key={i} title={`${it.item} ${quantityLabel(it)}`}>
        <ItemSpriteIcon itemId={it.item} size="small" darkTheme={true} />
        <span className="ttile-qty">{quantityLabel(it)}</span>
      </span>
    ));
  }

  private _summary(): string {
    const { trade } = this.props;
    const want = trade.wants?.[0]?.item;
    const give = trade.gives?.[0]?.item;
    const left = want ? prettyName(want) : "?";
    const right = give ? prettyName(give) : "?";
    return `${left} → ${right}`;
  }

  render(): React.ReactNode {
    const { trade, isSelected, readOnly } = this.props;
    let className = "ttile-container";
    if (isSelected) className += " ttile-container-selected";

    return (
      <div className={className} onClick={this._handleClick} title={this._summary()}>
        <div className="ttile-side ttile-wants">{this._renderSide(trade.wants)}</div>
        <div className="ttile-arrow">
          <FontAwesomeIcon icon={faArrowRight} />
        </div>
        <div className="ttile-side ttile-gives">{this._renderSide(trade.gives)}</div>

        <div className="ttile-meta">
          {trade.weight !== undefined && trade.weight !== 1 && (
            <span className="ttile-badge" title="Weight (relative likelihood among picked trades)">
              w {trade.weight}
            </span>
          )}
          {trade.max_uses !== undefined && (
            <span className="ttile-badge" title="Max uses before this trade is exhausted">
              {trade.max_uses}× uses
            </span>
          )}
        </div>

        {!readOnly && (
          <IconButton
            className="ttile-remove-btn"
            size="small"
            onClick={this._handleRemove}
            title="Remove trade"
            aria-label="Remove trade"
          >
            <FontAwesomeIcon icon={faXmark} />
          </IconButton>
        )}
      </div>
    );
  }
}
