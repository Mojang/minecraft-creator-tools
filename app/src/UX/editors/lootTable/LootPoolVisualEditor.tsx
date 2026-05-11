// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * LootPoolVisualEditor - Visual editor for a single loot pool.
 *
 * Layout:
 * - DiceRollEditor at the top (explains rolls concept in plain language)
 * - Entry list showing LootEntryTile cards with probability percentages
 * - Inline LootEntryEditor expands when an entry is selected
 * - LootItemDropZone at the bottom for drag-and-drop item adding
 *
 * Manages all mutations to a single pool's data and calls back via onChange.
 */

import React, { Component } from "react";
import "./LootPoolVisualEditor.css";
import { ILootTableBehaviorEntry, ILootTableBehaviorPool } from "../../../minecraft/ILootTableBehavior";
import DiceRollEditor from "./DiceRollEditor";
import LootEntryTile from "./LootEntryTile";
import LootEntryEditor from "./LootEntryEditor";
import LootItemDropZone from "./LootItemDropZone";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBoxOpen } from "@fortawesome/free-solid-svg-icons";

export interface ILootPoolVisualEditorProps {
  pool: ILootTableBehaviorPool;
  readOnly?: boolean;
  onChange?: (pool: ILootTableBehaviorPool) => void;
}

interface ILootPoolVisualEditorState {
  selectedEntryIndex: number | null;
}

export default class LootPoolVisualEditor extends Component<ILootPoolVisualEditorProps, ILootPoolVisualEditorState> {
  constructor(props: ILootPoolVisualEditorProps) {
    super(props);
    this.state = { selectedEntryIndex: null };

    this._handleRollsChange = this._handleRollsChange.bind(this);
    this._handleEntryClick = this._handleEntryClick.bind(this);
    this._handleEntryRemove = this._handleEntryRemove.bind(this);
    this._handleEntryChange = this._handleEntryChange.bind(this);
    this._handleEntryDone = this._handleEntryDone.bind(this);
    this._handleItemDrop = this._handleItemDrop.bind(this);
  }

  private _getTotalWeight(): number {
    const entries = this.props.pool.entries || [];
    return entries.reduce((sum, e) => sum + (e.weight ?? 1), 0);
  }

  private _emitChange(pool: ILootTableBehaviorPool): void {
    this.props.onChange?.(pool);
  }

  private _handleRollsChange(rolls: number | { min: number; max: number }, bonusRolls: number): void {
    const pool = { ...this.props.pool, rolls, bonus_rolls: bonusRolls || undefined } as any;
    if (!bonusRolls) {
      delete pool.bonus_rolls;
    }
    this._emitChange(pool);
  }

  private _handleEntryClick(index: number): void {
    this.setState((prev) => ({
      selectedEntryIndex: prev.selectedEntryIndex === index ? null : index,
    }));
  }

  private _handleEntryRemove(index: number): void {
    const entries = [...(this.props.pool.entries || [])];
    entries.splice(index, 1);
    this._emitChange({ ...this.props.pool, entries });

    if (this.state.selectedEntryIndex === index) {
      this.setState({ selectedEntryIndex: null });
    } else if (this.state.selectedEntryIndex !== null && this.state.selectedEntryIndex > index) {
      this.setState({ selectedEntryIndex: this.state.selectedEntryIndex - 1 });
    }
  }

  private _handleEntryChange(index: number, entry: ILootTableBehaviorEntry): void {
    const entries = [...(this.props.pool.entries || [])];
    entries[index] = entry;
    this._emitChange({ ...this.props.pool, entries });
  }

  private _handleEntryDone(): void {
    this.setState({ selectedEntryIndex: null });
  }

  private _handleItemDrop(itemId: string): void {
    const entries = [...(this.props.pool.entries || [])];
    entries.push({ type: "item", name: itemId, weight: 1 });
    this._emitChange({ ...this.props.pool, entries });

    // Select the newly added entry for editing
    this.setState({ selectedEntryIndex: entries.length - 1 });
  }

  render(): React.ReactNode {
    const { pool, readOnly } = this.props;
    const { selectedEntryIndex } = this.state;
    const entries = pool.entries || [];
    const totalWeight = this._getTotalWeight();
    const bonusRolls = (pool as any).bonus_rolls ?? 0;

    return (
      <div className="lpve-container">
        <DiceRollEditor
          rolls={pool.rolls}
          bonusRolls={bonusRolls}
          entries={entries}
          readOnly={readOnly}
          onChange={this._handleRollsChange}
        />

        <div className="lpve-entries-header">
          <span className="lpve-entries-title">Entries</span>
          <span className="lpve-entry-count">
            {entries.length} item{entries.length !== 1 ? "s" : ""}
          </span>
        </div>

        {entries.length === 0 ? (
          <div className="lpve-empty-state">
            <FontAwesomeIcon icon={faBoxOpen} className="lpve-empty-icon" />
            <span>No items in this pool yet. Drag items from the picker or click below to add.</span>
          </div>
        ) : (
          <div className="lpve-entries-list">
            {entries.map((entry, i) => (
              <React.Fragment key={i}>
                <LootEntryTile
                  entry={entry}
                  index={i}
                  totalWeight={totalWeight}
                  isSelected={selectedEntryIndex === i}
                  readOnly={readOnly}
                  onClick={this._handleEntryClick}
                  onRemove={this._handleEntryRemove}
                />
                {selectedEntryIndex === i && (
                  <LootEntryEditor
                    entry={entry}
                    index={i}
                    totalWeight={totalWeight}
                    readOnly={readOnly}
                    onChange={this._handleEntryChange}
                    onDone={this._handleEntryDone}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        )}

        <LootItemDropZone onItemDrop={this._handleItemDrop} readOnly={readOnly} />
      </div>
    );
  }
}
