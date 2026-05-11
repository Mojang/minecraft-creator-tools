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

export interface ICraftingSlotProps {
  itemId?: string;
  row: number;
  col: number;
  darkTheme?: boolean;
  onItemDrop?: (row: number, col: number, itemId: string) => void;
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
  }

  private _handleDragOver(e: React.DragEvent): void {
    if (e.dataTransfer.types.includes(RECIPE_DRAG_TYPE)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
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
    if (itemId && this.props.onItemDrop) {
      this.props.onItemDrop(this.props.row, this.props.col, itemId);
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
        >
          <ItemSpriteIcon itemId={this.props.itemId} empty={!hasItem} size="large" darkTheme={this.props.darkTheme} />
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
