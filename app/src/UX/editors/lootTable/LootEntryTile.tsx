// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * LootEntryTile - Visual card displaying a single loot table entry.
 *
 * Shows:
 * - Item sprite (reuses ItemSpriteIcon from recipe editor)
 * - Item display name
 * - Probability as percentage of pool total weight
 * - Quantity range if set_count function exists (e.g., "×1-3")
 * - Badge for modifier functions beyond set_count
 * - Type badges for "loot_table" and "empty" entries
 * - Remove button on hover
 *
 * Supports drag-over highlighting for reordering/replacement.
 */

import React, { Component } from "react";
import "./LootEntryTile.css";
import ItemSpriteIcon from "../recipe/ItemSpriteIcon";
import { ILootTableBehaviorEntry, ILootTableBehaviorFunction } from "../../../minecraft/ILootTableBehavior";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBan, faClipboardList, faGear, faXmark } from "@fortawesome/free-solid-svg-icons";
import { IconButton } from "@mui/material";

export interface ILootEntryTileProps {
  entry: ILootTableBehaviorEntry;
  index: number;
  totalWeight: number;
  isSelected?: boolean;
  readOnly?: boolean;
  onClick?: (index: number) => void;
  onRemove?: (index: number) => void;
}

export default class LootEntryTile extends Component<ILootEntryTileProps> {
  constructor(props: ILootEntryTileProps) {
    super(props);
    this._handleClick = this._handleClick.bind(this);
    this._handleRemove = this._handleRemove.bind(this);
  }

  private _handleClick(): void {
    this.props.onClick?.(this.props.index);
  }

  private _handleRemove(e: React.MouseEvent): void {
    e.stopPropagation();
    this.props.onRemove?.(this.props.index);
  }

  static getQuantityRange(functions?: ILootTableBehaviorFunction[]): { min: number; max: number } | null {
    if (!functions) return null;
    const setCount = functions.find((f) => f.function === "set_count");
    if (!setCount || setCount.count === undefined) return null;

    if (typeof setCount.count === "number") {
      return { min: setCount.count, max: setCount.count };
    }
    return { min: setCount.count.min, max: setCount.count.max };
  }

  static getOtherModifierCount(functions?: ILootTableBehaviorFunction[]): number {
    if (!functions) return 0;
    return functions.filter((f) => f.function !== "set_count").length;
  }

  private _renderIcon(): React.ReactNode {
    const { entry } = this.props;

    if (entry.type === "empty") {
      return (
        <div className="let-empty-icon">
          <FontAwesomeIcon icon={faBan} />
        </div>
      );
    }

    if (entry.type === "loot_table") {
      return (
        <div className="let-loot-table-icon">
          <FontAwesomeIcon icon={faClipboardList} />
        </div>
      );
    }

    return <ItemSpriteIcon itemId={entry.name} size="small" darkTheme={true} />;
  }

  private _getDisplayName(): string {
    const { entry } = this.props;

    if (entry.type === "empty") return "Nothing";
    if (!entry.name) return entry.type;

    let name = entry.name;
    if (name.includes(":")) {
      name = name.substring(name.indexOf(":") + 1);
    }
    return name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  render(): React.ReactNode {
    const { entry, totalWeight, isSelected, readOnly } = this.props;
    const weight = entry.weight ?? 1;
    const probability = totalWeight > 0 ? Math.round((weight / totalWeight) * 100) : 0;
    const quantity = LootEntryTile.getQuantityRange(entry.functions);
    const otherModifiers = LootEntryTile.getOtherModifierCount(entry.functions);

    let containerClass = "let-container";
    if (isSelected) containerClass += " let-container-selected";

    return (
      <div className={containerClass} onClick={this._handleClick} title={entry.name || entry.type}>
        <div className="let-icon-area">{this._renderIcon()}</div>

        <div className="let-info">
          <div className="let-name">{this._getDisplayName()}</div>
          <div className="let-type-badge">{entry.type}</div>
        </div>

        <div className="let-meta">
          {quantity && (
            <span className="let-quantity">
              {quantity.min === quantity.max ? `×${quantity.min}` : `×${quantity.min}-${quantity.max}`}
            </span>
          )}
          {otherModifiers > 0 && (
            <span className="let-modifiers-badge" title={`${otherModifiers} modifier(s)`}>
              <FontAwesomeIcon icon={faGear} /> {otherModifiers}
            </span>
          )}
          <span className="let-probability">{probability}%</span>
        </div>

        {!readOnly && (
          <IconButton
            className="let-remove-btn"
            size="small"
            onClick={this._handleRemove}
            title="Remove entry"
            aria-label="Remove entry"
          >
            <FontAwesomeIcon icon={faXmark} />
          </IconButton>
        )}
      </div>
    );
  }
}
