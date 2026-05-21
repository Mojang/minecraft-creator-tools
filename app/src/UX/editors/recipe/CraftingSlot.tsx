// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * CraftingSlot - A single cell in the shaped recipe crafting grid.
 *
 * Supports:
 * - Drag-and-drop (drop items from the ItemSpritePicker)
 * - Click to open picker / select slot
 * - Clear button on hover when filled
 * - Visual states: empty, filled, drag-hover
 */

import React, { Component } from "react";
import "./CraftingSlot.css";
import ItemSpriteIcon from "./ItemSpriteIcon";
import { RECIPE_DRAG_TYPE } from "./ItemSpritePicker";
import { IconButton } from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";

/** MIME type carrying source slot coords ("row,col") when an item is dragged
 *  from one CraftingSlot to another (move semantics). */
export const RECIPE_SLOT_SOURCE_TYPE = "application/x-recipe-slot-source";

export interface ICraftingSlotProps {
  itemId?: string;
  /** Optional Bedrock pre-flattening data value (e.g. for legacy `minecraft:planks`).
   * Forwarded to ItemSpriteIcon so the right variant texture is shown. */
  data?: number;
  row: number;
  col: number;
  darkTheme?: boolean;
  /** Called when an item is dropped on this slot. If `source` is provided,
   *  the drop originated from another CraftingSlot (move semantics – the
   *  parent should clear the source and fill the target). */
  onItemDrop?: (row: number, col: number, itemId: string, source?: { row: number; col: number }) => void;
  onSlotClick?: (row: number, col: number) => void;
  onSlotClear?: (row: number, col: number) => void;
}

interface ICraftingSlotState {
  isDragOver: boolean;
}

export default class CraftingSlot extends Component<ICraftingSlotProps, ICraftingSlotState> {
  constructor(props: ICraftingSlotProps) {
    super(props);
    this.state = { isDragOver: false };

    this._handleDragOver = this._handleDragOver.bind(this);
    this._handleDragEnter = this._handleDragEnter.bind(this);
    this._handleDragLeave = this._handleDragLeave.bind(this);
    this._handleDrop = this._handleDrop.bind(this);
    this._handleClick = this._handleClick.bind(this);
    this._handleClear = this._handleClear.bind(this);
    this._handleDragStart = this._handleDragStart.bind(this);
    this._handleDragEnd = this._handleDragEnd.bind(this);
  }

  private _handleDragOver(e: React.DragEvent): void {
    if (e.dataTransfer.types.includes(RECIPE_DRAG_TYPE)) {
      e.preventDefault();
      // Move when coming from another slot, copy when from the picker.
      e.dataTransfer.dropEffect = e.dataTransfer.types.includes(RECIPE_SLOT_SOURCE_TYPE) ? "move" : "copy";
    }
  }

  private _handleDragEnter(e: React.DragEvent): void {
    if (e.dataTransfer.types.includes(RECIPE_DRAG_TYPE)) {
      e.preventDefault();
      this.setState({ isDragOver: true });
    }
  }

  private _handleDragLeave(e: React.DragEvent): void {
    this.setState({ isDragOver: false });
  }

  private _handleDrop(e: React.DragEvent): void {
    e.preventDefault();
    this.setState({ isDragOver: false });

    const itemId = e.dataTransfer.getData(RECIPE_DRAG_TYPE);
    if (!itemId || !this.props.onItemDrop) return;

    let source: { row: number; col: number } | undefined;
    const sourceData = e.dataTransfer.getData(RECIPE_SLOT_SOURCE_TYPE);
    if (sourceData) {
      const [r, c] = sourceData.split(",").map((n) => parseInt(n, 10));
      if (!isNaN(r) && !isNaN(c) && (r !== this.props.row || c !== this.props.col)) {
        source = { row: r, col: c };
      }
    }
    this.props.onItemDrop(this.props.row, this.props.col, itemId, source);
  }

  private _handleDragStart(e: React.DragEvent): void {
    if (!this.props.itemId) return;
    e.dataTransfer.setData(RECIPE_DRAG_TYPE, this.props.itemId);
    e.dataTransfer.setData(RECIPE_SLOT_SOURCE_TYPE, this.props.row + "," + this.props.col);
    e.dataTransfer.effectAllowed = "copyMove";
  }

  private _handleDragEnd(e: React.DragEvent): void {
    // If the drop didn't land on a valid target (e.g. dragged off the grid),
    // remove the item from this slot.
    if (e.dataTransfer.dropEffect === "none" && this.props.onSlotClear) {
      this.props.onSlotClear(this.props.row, this.props.col);
    }
  }

  private _handleClick(): void {
    if (this.props.onSlotClick) {
      this.props.onSlotClick(this.props.row, this.props.col);
    }
  }

  private _handleClear(e: React.MouseEvent): void {
    e.stopPropagation();
    if (this.props.onSlotClear) {
      this.props.onSlotClear(this.props.row, this.props.col);
    }
  }

  render() {
    const hasItem = !!this.props.itemId;
    const dropClass = "rccs-drop-target" + (this.state.isDragOver ? " rccs-drag-over" : "");

    return (
      <div className="rccs-container">
        <div
          className={dropClass}
          onDragOver={this._handleDragOver}
          onDragEnter={this._handleDragEnter}
          onDragLeave={this._handleDragLeave}
          onDrop={this._handleDrop}
          onClick={this._handleClick}
          draggable={hasItem}
          onDragStart={hasItem ? this._handleDragStart : undefined}
          onDragEnd={hasItem ? this._handleDragEnd : undefined}
        >
          <ItemSpriteIcon
            itemId={this.props.itemId}
            data={this.props.data}
            empty={!hasItem}
            size="large"
            darkTheme={this.props.darkTheme}
          />
        </div>
        {hasItem && (
          <IconButton
            className="rccs-clear-button"
            size="small"
            onClick={this._handleClear}
            title="Clear slot"
            aria-label="Clear slot"
          >
            <FontAwesomeIcon icon={faXmark} />
          </IconButton>
        )}
      </div>
    );
  }
}
