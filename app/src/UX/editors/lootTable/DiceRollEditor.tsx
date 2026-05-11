// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * DiceRollEditor - Intuitive editor for loot pool roll configuration.
 *
 * Explains the "dice rolls" concept in plain language:
 *   - Fixed: "Exactly 2 items will be picked from this pool"
 *   - Range: "Between 1 and 3 items will be randomly picked from this pool"
 *
 * Supports both fixed-number and min/max range roll formats, plus bonus_rolls.
 */

import React, { Component } from "react";
import "./DiceRollEditor.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faDice } from "@fortawesome/free-solid-svg-icons";
import { TextField, ToggleButton, ToggleButtonGroup } from "@mui/material";
import { ILootTableBehaviorEntry, ILootTableBehaviorFunction } from "../../../minecraft/ILootTableBehavior";

export interface IDiceRollEditorProps {
  rolls: number | { min: number; max: number };
  bonusRolls?: number;
  entries?: ILootTableBehaviorEntry[];
  readOnly?: boolean;
  onChange?: (rolls: number | { min: number; max: number }, bonusRolls: number) => void;
}

interface IDiceRollEditorState {
  isRange: boolean;
  fixedValue: number;
  minValue: number;
  maxValue: number;
  bonusRolls: number;
}

export default class DiceRollEditor extends Component<IDiceRollEditorProps, IDiceRollEditorState> {
  constructor(props: IDiceRollEditorProps) {
    super(props);

    const isRange = typeof props.rolls === "object";
    const fixedValue = typeof props.rolls === "number" ? props.rolls : 1;
    const minValue = typeof props.rolls === "object" ? props.rolls.min : fixedValue;
    const maxValue = typeof props.rolls === "object" ? props.rolls.max : fixedValue;

    this.state = {
      isRange,
      fixedValue,
      minValue,
      maxValue,
      bonusRolls: props.bonusRolls ?? 0,
    };

    this._handleModeChange = this._handleModeChange.bind(this);
    this._handleFixedChange = this._handleFixedChange.bind(this);
    this._handleMinChange = this._handleMinChange.bind(this);
    this._handleMaxChange = this._handleMaxChange.bind(this);
    this._handleBonusChange = this._handleBonusChange.bind(this);
  }

  componentDidUpdate(prevProps: IDiceRollEditorProps): void {
    if (prevProps.rolls !== this.props.rolls || prevProps.bonusRolls !== this.props.bonusRolls) {
      const isRange = typeof this.props.rolls === "object";
      this.setState({
        isRange,
        fixedValue: typeof this.props.rolls === "number" ? this.props.rolls : 1,
        minValue:
          typeof this.props.rolls === "object"
            ? this.props.rolls.min
            : typeof this.props.rolls === "number"
              ? this.props.rolls
              : 1,
        maxValue:
          typeof this.props.rolls === "object"
            ? this.props.rolls.max
            : typeof this.props.rolls === "number"
              ? this.props.rolls
              : 1,
        bonusRolls: this.props.bonusRolls ?? 0,
      });
    }
  }

  private _emitChange(isRange: boolean, fixed: number, min: number, max: number, bonus: number): void {
    if (this.props.onChange) {
      const rolls = isRange ? { min, max } : fixed;
      this.props.onChange(rolls, bonus);
    }
  }

  private _handleModeChange(toRange: boolean): void {
    if (toRange === this.state.isRange) return;

    const newMin = this.state.fixedValue;
    const newMax = this.state.fixedValue;
    const newFixed = this.state.minValue;

    this.setState({ isRange: toRange, minValue: newMin, maxValue: newMax, fixedValue: newFixed });
    this._emitChange(toRange, newFixed, newMin, newMax, this.state.bonusRolls);
  }

  private _handleFixedChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const val = Math.max(1, parseInt(e.target.value) || 1);
    this.setState({ fixedValue: val });
    this._emitChange(false, val, val, val, this.state.bonusRolls);
  }

  private _handleMinChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const val = Math.max(0, parseInt(e.target.value) || 0);
    const max = Math.max(val, this.state.maxValue);
    this.setState({ minValue: val, maxValue: max });
    this._emitChange(true, val, val, max, this.state.bonusRolls);
  }

  private _handleMaxChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const val = Math.max(this.state.minValue, parseInt(e.target.value) || 1);
    this.setState({ maxValue: val });
    this._emitChange(true, this.state.fixedValue, this.state.minValue, val, this.state.bonusRolls);
  }

  private _handleBonusChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const val = Math.max(0, parseInt(e.target.value) || 0);
    this.setState({ bonusRolls: val });
    this._emitChange(this.state.isRange, this.state.fixedValue, this.state.minValue, this.state.maxValue, val);
  }

  private _buildBonusExplanation(): React.ReactNode {
    const { bonusRolls } = this.state;

    if (!bonusRolls || bonusRolls <= 0) {
      return null;
    }

    // bonus_rolls in Bedrock loot tables: extra rolls = bonus_rolls * luck.
    // With luck = 0 there is no effect; with higher luck, more picks happen.
    return (
      <span>
        {" "}
        Lucky players may also get up to{" "}
        <span className="dre-explanation-highlight">
          {bonusRolls} extra pick{bonusRolls !== 1 ? "s" : ""}
        </span>{" "}
        per point of luck (no extra picks when luck is 0).
      </span>
    );
  }

  private _getEntryDisplayName(entry: ILootTableBehaviorEntry): string {
    if (entry.type === "empty") return "nothing";
    if (entry.type === "loot_table") {
      const ref = entry.name ? entry.name.split(/[\\/]/).pop() ?? entry.name : "another loot table";
      return `from ${ref}`;
    }
    if (!entry.name) return entry.type;
    let name = entry.name;
    if (name.includes(":")) {
      name = name.substring(name.indexOf(":") + 1);
    }
    return name.replace(/_/g, " ");
  }

  private _getQuantityRange(
    functions?: ILootTableBehaviorFunction[]
  ): { min: number; max: number } | null {
    if (!functions) return null;
    const setCount = functions.find((f) => f.function === "set_count");
    if (!setCount || setCount.count === undefined) return null;
    if (typeof setCount.count === "number") {
      return { min: setCount.count, max: setCount.count };
    }
    return { min: setCount.count.min, max: setCount.count.max };
  }

  private _formatPickPart(entry: ILootTableBehaviorEntry, percent: number): string {
    const name = this._getEntryDisplayName(entry);
    const qty = this._getQuantityRange(entry.functions);
    const pctText = `${percent}%`;

    // "empty" / "loot_table" don't take a count phrase
    if (entry.type === "empty") {
      return `a ${pctText} chance of nothing`;
    }
    if (entry.type === "loot_table") {
      return `a ${pctText} chance of items ${name}`;
    }

    let countPhrase: string;
    if (!qty) {
      countPhrase = `1 ${name}`;
    } else if (qty.min === qty.max) {
      countPhrase = `${qty.min} ${name}`;
    } else {
      countPhrase = `between ${qty.min} and ${qty.max} ${name}`;
    }
    return `a ${pctText} chance it's ${countPhrase}`;
  }

  private _buildPickExplanation(): React.ReactNode {
    const entries = this.props.entries;
    if (!entries || entries.length === 0) return null;

    const totalWeight = entries.reduce((sum, e) => sum + (e.weight ?? 1), 0);
    if (totalWeight <= 0) return null;

    // Compute integer percentages that sum to 100 using largest-remainder.
    const raw = entries.map((e) => ((e.weight ?? 1) / totalWeight) * 100);
    const floors = raw.map((r) => Math.floor(r));
    let leftover = 100 - floors.reduce((a, b) => a + b, 0);
    const order = raw
      .map((r, i) => ({ i, frac: r - Math.floor(r) }))
      .sort((a, b) => b.frac - a.frac);
    const percents = floors.slice();
    for (let k = 0; k < order.length && leftover > 0; k++) {
      percents[order[k].i] += 1;
      leftover--;
    }

    const parts = entries.map((e, i) => this._formatPickPart(e, percents[i]));

    let sentence: string;
    if (parts.length === 1) {
      // Only one entry — always 100%, simpler phrasing.
      const only = entries[0];
      const name = this._getEntryDisplayName(only);
      const qty = this._getQuantityRange(only.functions);
      if (only.type === "empty") {
        sentence = "Every pick produces nothing.";
      } else if (only.type === "loot_table") {
        sentence = `Every pick produces items ${name}.`;
      } else if (!qty) {
        sentence = `Every pick is 1 ${name}.`;
      } else if (qty.min === qty.max) {
        sentence = `Every pick is ${qty.min} ${name}.`;
      } else {
        sentence = `Every pick is between ${qty.min} and ${qty.max} ${name}.`;
      }
    } else if (parts.length === 2) {
      sentence = `When an item is picked, there's ${parts[0]}, and ${parts[1]}.`;
    } else {
      const head = parts.slice(0, -1).join(", ");
      const tail = parts[parts.length - 1];
      sentence = `When an item is picked, there's ${head}, and ${tail}.`;
    }

    return <span className="dre-explanation-pick"> {sentence}</span>;
  }

  private _buildExplanation(): React.ReactNode {
    const { isRange, fixedValue, minValue, maxValue } = this.state;
    const bonus = this._buildBonusExplanation();
    const picks = this._buildPickExplanation();

    if (!isRange) {
      if (fixedValue === 1) {
        return (
          <span>
            Each time loot drops, <span className="dre-explanation-highlight">1 item</span> will be picked from this
            pool.{bonus}
            {picks}
          </span>
        );
      }
      return (
        <span>
          Each time loot drops, exactly <span className="dre-explanation-highlight">{fixedValue} items</span> will be
          picked from this pool.{bonus}
          {picks}
        </span>
      );
    }

    if (minValue === maxValue) {
      return (
        <span>
          Each time loot drops, exactly{" "}
          <span className="dre-explanation-highlight">
            {minValue} item{minValue !== 1 ? "s" : ""}
          </span>{" "}
          will be picked from this pool.{bonus}
          {picks}
        </span>
      );
    }

    return (
      <span>
        Each time loot drops, between <span className="dre-explanation-highlight">{minValue}</span> and{" "}
        <span className="dre-explanation-highlight">{maxValue} items</span> will be randomly picked from this pool.
        {bonus}
        {picks}
      </span>
    );
  }

  render(): React.ReactNode {
    const { isRange, fixedValue, minValue, maxValue, bonusRolls } = this.state;
    const disabled = this.props.readOnly;

    return (
      <div className="dre-container">
        <div className="dre-header">
          <FontAwesomeIcon icon={faDice} className="dre-header-icon" />
          Rolls
        </div>

        <div className="dre-explanation">{this._buildExplanation()}</div>

        <div className="dre-controls">
          <ToggleButtonGroup
            className="dre-mode-toggle"
            size="small"
            exclusive
            value={isRange ? "range" : "exact"}
            onChange={(_, val) => {
              if (val !== null) this._handleModeChange(val === "range");
            }}
            disabled={disabled}
          >
            <ToggleButton value="exact" className="dre-mode-btn">Exact</ToggleButton>
            <ToggleButton value="range" className="dre-mode-btn">Range</ToggleButton>
          </ToggleButtonGroup>

          {!isRange ? (
            <div className="dre-input-group">
              <span className="dre-input-label">Count</span>
              <TextField
                className="dre-input"
                size="small"
                type="number"
                value={fixedValue}
                onChange={this._handleFixedChange}
                disabled={disabled}
                inputProps={{ min: 1 }}
                sx={{ width: 72 }}
              />
            </div>
          ) : (
            <div className="dre-input-group">
              <span className="dre-input-label">Min</span>
              <TextField
                className="dre-input"
                size="small"
                type="number"
                value={minValue}
                onChange={this._handleMinChange}
                disabled={disabled}
                inputProps={{ min: 0 }}
                sx={{ width: 72 }}
              />
              <span className="dre-range-separator">to</span>
              <span className="dre-input-label">Max</span>
              <TextField
                className="dre-input"
                size="small"
                type="number"
                value={maxValue}
                onChange={this._handleMaxChange}
                disabled={disabled}
                inputProps={{ min: minValue }}
                sx={{ width: 72 }}
              />
            </div>
          )}
        </div>

        {(bonusRolls > 0 || !disabled) && (
          <div className="dre-bonus-section">
            <span className="dre-bonus-label">Bonus rolls</span>
            <TextField
              className="dre-bonus-input"
              size="small"
              type="number"
              value={bonusRolls}
              onChange={this._handleBonusChange}
              disabled={disabled}
              title="Additional rolls added based on the player's luck attribute"
              inputProps={{ min: 0 }}
              sx={{ width: 64 }}
            />
            <span className="dre-bonus-tooltip">Extra picks based on luck</span>
          </div>
        )}
      </div>
    );
  }
}
