// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * TradeEditor - Inline editor for a single trade's wants / gives / weights.
 *
 * Edits ONLY the first stack on each side (the common case). For multi-stack
 * trades or filters/functions, the user should drop into the Advanced (schema)
 * tab. Other fields (additional wants/gives entries, filters, functions) are
 * preserved verbatim.
 */

import React, { Component } from "react";
import "./TradeEditor.css";
import { Button, TextField } from "@mui/material";
import { ITradeTableItem, ITradeTableTrade } from "../../../minecraft/ITradingBehavior";
import IMinMixRange from "../../../minecraft/jsoncommon/IMinMixRange";
import ItemSpriteIcon from "../recipe/ItemSpriteIcon";
import { RECIPE_DRAG_TYPE } from "../recipe/ItemSpritePicker";

export interface ITradeEditorProps {
  trade: ITradeTableTrade;
  readOnly?: boolean;
  onChange?: (trade: ITradeTableTrade) => void;
  onDone?: () => void;
}

interface ITradeEditorState {
  wantsItem: string;
  wantsMin: number;
  wantsMax: number;
  givesItem: string;
  givesMin: number;
  givesMax: number;
  weight: number;
  maxUses: number;
  traderExp: number;
}

function quantityRange(q: number | IMinMixRange | undefined): { min: number; max: number } {
  if (q === undefined) return { min: 1, max: 1 };
  if (typeof q === "number") return { min: q, max: q };
  return { min: q.min, max: q.max };
}

/**
 * ItemBin - Sprite preview + text input that accepts both typed item IDs and
 * dragged item tiles from the ItemSpritePicker (RECIPE_DRAG_TYPE).
 */
interface IItemBinProps {
  itemId: string;
  onDrop: (itemId: string) => void;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  placeholder?: string;
}

class ItemBin extends Component<IItemBinProps, { isDragOver: boolean }> {
  private _dragCounter = 0;

  constructor(props: IItemBinProps) {
    super(props);
    this.state = { isDragOver: false };

    this._handleDragOver = this._handleDragOver.bind(this);
    this._handleDragEnter = this._handleDragEnter.bind(this);
    this._handleDragLeave = this._handleDragLeave.bind(this);
    this._handleDrop = this._handleDrop.bind(this);
  }

  private _handleDragOver(e: React.DragEvent): void {
    if (this.props.disabled) return;
    if (e.dataTransfer.types.includes(RECIPE_DRAG_TYPE)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    }
  }
  private _handleDragEnter(e: React.DragEvent): void {
    if (this.props.disabled) return;
    if (e.dataTransfer.types.includes(RECIPE_DRAG_TYPE)) {
      e.preventDefault();
      this._dragCounter++;
      if (!this.state.isDragOver) this.setState({ isDragOver: true });
    }
  }
  private _handleDragLeave(): void {
    this._dragCounter = Math.max(0, this._dragCounter - 1);
    if (this._dragCounter === 0) this.setState({ isDragOver: false });
  }
  private _handleDrop(e: React.DragEvent): void {
    e.preventDefault();
    this._dragCounter = 0;
    this.setState({ isDragOver: false });
    const id = e.dataTransfer.getData(RECIPE_DRAG_TYPE);
    if (id) this.props.onDrop(id);
  }

  render(): React.ReactNode {
    const { itemId, onChange, disabled, placeholder } = this.props;
    const hasItem = !!itemId;
    const className = "te-itembin" + (this.state.isDragOver ? " te-itembin-drag-over" : "");
    return (
      <div
        className={className}
        onDragOver={this._handleDragOver}
        onDragEnter={this._handleDragEnter}
        onDragLeave={this._handleDragLeave}
        onDrop={this._handleDrop}
      >
        <div className="te-itembin-sprite">
          <ItemSpriteIcon itemId={itemId} empty={!hasItem} size="small" darkTheme={true} />
        </div>
        <TextField
          size="small"
          type="text"
          value={itemId}
          onChange={onChange}
          disabled={disabled}
          placeholder={placeholder}
          sx={{ width: 220 }}
        />
      </div>
    );
  }
}

export default class TradeEditor extends Component<ITradeEditorProps, ITradeEditorState> {
  constructor(props: ITradeEditorProps) {
    super(props);
    this.state = TradeEditor._stateFromTrade(props.trade);

    this._handleWantsItemChange = this._handleWantsItemChange.bind(this);
    this._handleWantsMinChange = this._handleWantsMinChange.bind(this);
    this._handleWantsMaxChange = this._handleWantsMaxChange.bind(this);
    this._handleGivesItemChange = this._handleGivesItemChange.bind(this);
    this._handleGivesMinChange = this._handleGivesMinChange.bind(this);
    this._handleGivesMaxChange = this._handleGivesMaxChange.bind(this);
    this._handleWeightChange = this._handleWeightChange.bind(this);
    this._handleMaxUsesChange = this._handleMaxUsesChange.bind(this);
    this._handleTraderExpChange = this._handleTraderExpChange.bind(this);
    this._handleDone = this._handleDone.bind(this);
  }

  static _stateFromTrade(trade: ITradeTableTrade): ITradeEditorState {
    const want = trade.wants?.[0] || ({ item: "" } as ITradeTableItem);
    const give = trade.gives?.[0] || ({ item: "" } as ITradeTableItem);
    const wq = quantityRange(want.quantity);
    const gq = quantityRange(give.quantity);
    return {
      wantsItem: want.item || "",
      wantsMin: wq.min,
      wantsMax: wq.max,
      givesItem: give.item || "",
      givesMin: gq.min,
      givesMax: gq.max,
      weight: trade.weight ?? 1,
      maxUses: trade.max_uses ?? 7,
      traderExp: trade.trader_exp ?? 1,
    };
  }

  componentDidUpdate(prevProps: ITradeEditorProps): void {
    if (prevProps.trade !== this.props.trade) {
      this.setState(TradeEditor._stateFromTrade(this.props.trade));
    }
  }

  private _buildUpdated(): ITradeTableTrade {
    const { wantsItem, wantsMin, wantsMax, givesItem, givesMin, givesMax, weight, maxUses, traderExp } = this.state;

    const buildItem = (
      original: ITradeTableItem | undefined,
      item: string,
      min: number,
      max: number
    ): ITradeTableItem => {
      const out: ITradeTableItem = { ...(original || ({} as ITradeTableItem)), item };
      out.quantity = min === max ? min : { min, max };
      return out;
    };

    const wants: ITradeTableItem[] = [...(this.props.trade.wants || [])];
    wants[0] = buildItem(wants[0], wantsItem, wantsMin, wantsMax);

    const gives: ITradeTableItem[] = [...(this.props.trade.gives || [])];
    gives[0] = buildItem(gives[0], givesItem, givesMin, givesMax);

    const out: ITradeTableTrade = {
      ...this.props.trade,
      wants,
      gives,
      weight,
      max_uses: maxUses,
      trader_exp: traderExp,
    };
    return out;
  }

  private _emit(): void {
    this.props.onChange?.(this._buildUpdated());
  }

  private _handleWantsItemChange(e: React.ChangeEvent<HTMLInputElement>): void {
    this.setState({ wantsItem: e.target.value }, () => this._emit());
  }
  private _handleGivesItemChange(e: React.ChangeEvent<HTMLInputElement>): void {
    this.setState({ givesItem: e.target.value }, () => this._emit());
  }

  private _handleWantsItemDrop = (itemId: string): void => {
    this.setState({ wantsItem: itemId }, () => this._emit());
  };
  private _handleGivesItemDrop = (itemId: string): void => {
    this.setState({ givesItem: itemId }, () => this._emit());
  };

  private _setMin(field: "wantsMin" | "givesMin", maxField: "wantsMax" | "givesMax", value: number): void {
    const v = Math.max(1, value);
    const newMax = Math.max(v, this.state[maxField]);
    this.setState({ [field]: v, [maxField]: newMax } as unknown as ITradeEditorState, () => this._emit());
  }
  private _setMax(minField: "wantsMin" | "givesMin", field: "wantsMax" | "givesMax", value: number): void {
    const v = Math.max(this.state[minField], value);
    this.setState({ [field]: v } as unknown as ITradeEditorState, () => this._emit());
  }

  private _handleWantsMinChange(e: React.ChangeEvent<HTMLInputElement>): void {
    this._setMin("wantsMin", "wantsMax", parseInt(e.target.value) || 1);
  }
  private _handleWantsMaxChange(e: React.ChangeEvent<HTMLInputElement>): void {
    this._setMax("wantsMin", "wantsMax", parseInt(e.target.value) || 1);
  }
  private _handleGivesMinChange(e: React.ChangeEvent<HTMLInputElement>): void {
    this._setMin("givesMin", "givesMax", parseInt(e.target.value) || 1);
  }
  private _handleGivesMaxChange(e: React.ChangeEvent<HTMLInputElement>): void {
    this._setMax("givesMin", "givesMax", parseInt(e.target.value) || 1);
  }

  private _handleWeightChange(e: React.ChangeEvent<HTMLInputElement>): void {
    this.setState({ weight: Math.max(1, parseInt(e.target.value) || 1) }, () => this._emit());
  }
  private _handleMaxUsesChange(e: React.ChangeEvent<HTMLInputElement>): void {
    this.setState({ maxUses: Math.max(1, parseInt(e.target.value) || 1) }, () => this._emit());
  }
  private _handleTraderExpChange(e: React.ChangeEvent<HTMLInputElement>): void {
    this.setState({ traderExp: Math.max(0, parseInt(e.target.value) || 0) }, () => this._emit());
  }

  private _handleDone(): void {
    this.props.onDone?.();
  }

  render(): React.ReactNode {
    const { readOnly } = this.props;
    const { wantsItem, wantsMin, wantsMax, givesItem, givesMin, givesMax, weight, maxUses, traderExp } = this.state;
    const disabled = readOnly;

    const QuantityRow = (
      label: string,
      min: number,
      max: number,
      onMin: (e: React.ChangeEvent<HTMLInputElement>) => void,
      onMax: (e: React.ChangeEvent<HTMLInputElement>) => void
    ) => (
      <div className="te-field">
        <span className="te-label">{label}</span>
        <div className="te-quantity-section">
          <TextField
            size="small"
            type="number"
            value={min}
            onChange={onMin}
            disabled={disabled}
            inputProps={{ min: 1, max: 64 }}
            sx={{ width: 80 }}
          />
          <span className="te-quantity-separator">to</span>
          <TextField
            size="small"
            type="number"
            value={max}
            onChange={onMax}
            disabled={disabled}
            inputProps={{ min, max: 64 }}
            sx={{ width: 80 }}
          />
        </div>
      </div>
    );

    return (
      <div className="te-container">
        <div className="te-section">
          <div className="te-section-title">Villager wants</div>
          <div className="te-row">
            <div className="te-field">
              <span className="te-label">Item</span>
              <ItemBin
                itemId={wantsItem}
                onDrop={this._handleWantsItemDrop}
                onChange={this._handleWantsItemChange}
                disabled={disabled}
                placeholder="minecraft:emerald"
              />
            </div>
            {QuantityRow("Quantity", wantsMin, wantsMax, this._handleWantsMinChange, this._handleWantsMaxChange)}
          </div>
        </div>

        <div className="te-section">
          <div className="te-section-title">Villager gives</div>
          <div className="te-row">
            <div className="te-field">
              <span className="te-label">Item</span>
              <ItemBin
                itemId={givesItem}
                onDrop={this._handleGivesItemDrop}
                onChange={this._handleGivesItemChange}
                disabled={disabled}
                placeholder="minecraft:wheat"
              />
            </div>
            {QuantityRow("Quantity", givesMin, givesMax, this._handleGivesMinChange, this._handleGivesMaxChange)}
          </div>
        </div>

        <div className="te-row">
          <div className="te-field">
            <span className="te-label">Weight</span>
            <TextField
              size="small"
              type="number"
              value={weight}
              onChange={this._handleWeightChange}
              disabled={disabled}
              inputProps={{ min: 1 }}
              sx={{ width: 80 }}
            />
          </div>
          <div className="te-field">
            <span className="te-label">Max uses</span>
            <TextField
              size="small"
              type="number"
              value={maxUses}
              onChange={this._handleMaxUsesChange}
              disabled={disabled}
              inputProps={{ min: 1 }}
              sx={{ width: 80 }}
            />
          </div>
          <div className="te-field">
            <span className="te-label">Trader XP</span>
            <TextField
              size="small"
              type="number"
              value={traderExp}
              onChange={this._handleTraderExpChange}
              disabled={disabled}
              inputProps={{ min: 0 }}
              sx={{ width: 80 }}
            />
          </div>
        </div>

        <Button className="te-done-btn" variant="contained" size="small" onClick={this._handleDone}>
          Done
        </Button>
      </div>
    );
  }
}
