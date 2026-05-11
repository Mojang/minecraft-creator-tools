// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * LootEntryEditor - Inline editor panel for a single loot table entry.
 *
 * Provides controls for:
 * - Entry type (item / loot_table / empty)
 * - Item name (with text input)
 * - Weight (with calculated probability display)
 * - Quantity range (mapped to set_count function)
 * - Done button to collapse the editor
 */

import React, { Component } from "react";
import "./LootEntryEditor.css";
import { ILootTableBehaviorEntry, ILootTableBehaviorFunction } from "../../../minecraft/ILootTableBehavior";
import LootEntryTile from "./LootEntryTile";
import { Button, MenuItem, Select, TextField, type SelectChangeEvent } from "@mui/material";

export interface ILootEntryEditorProps {
  entry: ILootTableBehaviorEntry;
  index: number;
  totalWeight: number;
  readOnly?: boolean;
  onChange?: (index: number, entry: ILootTableBehaviorEntry) => void;
  onDone?: () => void;
}

interface ILootEntryEditorState {
  type: string;
  name: string;
  weight: number;
  quantityMin: number;
  quantityMax: number;
}

export default class LootEntryEditor extends Component<ILootEntryEditorProps, ILootEntryEditorState> {
  constructor(props: ILootEntryEditorProps) {
    super(props);

    const qty = LootEntryTile.getQuantityRange(props.entry.functions);

    this.state = {
      type: props.entry.type || "item",
      name: props.entry.name || "",
      weight: props.entry.weight ?? 1,
      quantityMin: qty?.min ?? 1,
      quantityMax: qty?.max ?? 1,
    };

    this._handleTypeChange = this._handleTypeChange.bind(this);
    this._handleNameChange = this._handleNameChange.bind(this);
    this._handleWeightChange = this._handleWeightChange.bind(this);
    this._handleQtyMinChange = this._handleQtyMinChange.bind(this);
    this._handleQtyMaxChange = this._handleQtyMaxChange.bind(this);
    this._handleDone = this._handleDone.bind(this);
  }

  componentDidUpdate(prevProps: ILootEntryEditorProps): void {
    if (prevProps.entry !== this.props.entry) {
      const qty = LootEntryTile.getQuantityRange(this.props.entry.functions);
      this.setState({
        type: this.props.entry.type || "item",
        name: this.props.entry.name || "",
        weight: this.props.entry.weight ?? 1,
        quantityMin: qty?.min ?? 1,
        quantityMax: qty?.max ?? 1,
      });
    }
  }

  private _buildUpdatedEntry(): ILootTableBehaviorEntry {
    const { type, name, weight, quantityMin, quantityMax } = this.state;
    const originalFunctions = this.props.entry.functions || [];

    // Preserve functions other than set_count
    const otherFunctions = originalFunctions.filter((f) => f.function !== "set_count");
    const functions: ILootTableBehaviorFunction[] = [...otherFunctions];

    // Add set_count if quantity is not default (1,1)
    if (quantityMin !== 1 || quantityMax !== 1) {
      const count = quantityMin === quantityMax ? quantityMin : { min: quantityMin, max: quantityMax };
      functions.push({ function: "set_count", count });
    }

    const entry: ILootTableBehaviorEntry = {
      type,
      weight,
    };

    if (type !== "empty" && name) {
      entry.name = name;
    }

    if (functions.length > 0) {
      entry.functions = functions;
    }

    // Preserve conditions from original
    if (this.props.entry.conditions) {
      (entry as any).conditions = this.props.entry.conditions;
    }

    return entry;
  }

  private _emitChange(): void {
    if (this.props.onChange) {
      this.props.onChange(this.props.index, this._buildUpdatedEntry());
    }
  }

  private _handleTypeChange(e: SelectChangeEvent<string>): void {
    this.setState({ type: e.target.value }, () => this._emitChange());
  }

  private _handleNameChange(e: React.ChangeEvent<HTMLInputElement>): void {
    this.setState({ name: e.target.value }, () => this._emitChange());
  }

  private _handleWeightChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const val = Math.max(1, parseInt(e.target.value) || 1);
    this.setState({ weight: val }, () => this._emitChange());
  }

  private _handleQtyMinChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const val = Math.max(1, parseInt(e.target.value) || 1);
    const max = Math.max(val, this.state.quantityMax);
    this.setState({ quantityMin: val, quantityMax: max }, () => this._emitChange());
  }

  private _handleQtyMaxChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const val = Math.max(this.state.quantityMin, parseInt(e.target.value) || 1);
    this.setState({ quantityMax: val }, () => this._emitChange());
  }

  private _handleDone(): void {
    this.props.onDone?.();
  }

  render(): React.ReactNode {
    const { totalWeight, readOnly } = this.props;
    const { type, name, weight, quantityMin, quantityMax } = this.state;
    const probability = totalWeight > 0 ? Math.round((weight / totalWeight) * 100) : 0;
    const disabled = readOnly;

    return (
      <div className="lee-container">
        <div className="lee-row">
          <div className="lee-field">
            <span className="lee-label">Type</span>
            <Select
              className="lee-select"
              size="small"
              value={type}
              onChange={this._handleTypeChange}
              disabled={disabled}
            >
              <MenuItem value="item">Item</MenuItem>
              <MenuItem value="loot_table">Loot Table</MenuItem>
              <MenuItem value="empty">Nothing (Empty)</MenuItem>
            </Select>
          </div>

          {type !== "empty" && (
            <div className="lee-field">
              <span className="lee-label">{type === "loot_table" ? "Loot Table Path" : "Item ID"}</span>
              <TextField
                className="lee-input lee-input-name"
                size="small"
                type="text"
                value={name}
                onChange={this._handleNameChange}
                disabled={disabled}
                placeholder={type === "loot_table" ? "loot_tables/..." : "minecraft:diamond"}
              />
            </div>
          )}
        </div>

        <div className="lee-row">
          <div className="lee-field">
            <span className="lee-label">Weight</span>
            <div className="lee-field-inline">
              <TextField
                className="lee-input lee-input-number"
                size="small"
                type="number"
                value={weight}
                onChange={this._handleWeightChange}
                disabled={disabled}
                inputProps={{ min: 1 }}
                sx={{ width: 80 }}
              />
              <span className="lee-probability-hint">{probability}% chance</span>
            </div>
          </div>

          {type === "item" && (
            <div className="lee-field">
              <span className="lee-label">Quantity</span>
              <div className="lee-quantity-section">
                <TextField
                  className="lee-input lee-input-number"
                  size="small"
                  type="number"
                  value={quantityMin}
                  onChange={this._handleQtyMinChange}
                  disabled={disabled}
                  inputProps={{ min: 1, max: 64 }}
                  sx={{ width: 80 }}
                />
                <span className="lee-quantity-separator">to</span>
                <TextField
                  className="lee-input lee-input-number"
                  size="small"
                  type="number"
                  value={quantityMax}
                  onChange={this._handleQtyMaxChange}
                  disabled={disabled}
                  inputProps={{ min: quantityMin, max: 64 }}
                  sx={{ width: 80 }}
                />
              </div>
            </div>
          )}
        </div>

        <Button className="lee-done-btn" variant="contained" size="small" onClick={this._handleDone}>
          Done
        </Button>
      </div>
    );
  }
}
