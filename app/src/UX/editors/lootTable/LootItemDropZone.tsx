// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * LootItemDropZone - Drop target area for adding new items to a loot pool.
 *
 * Accepts items dragged from the ItemSpritePicker (using RECIPE_DRAG_TYPE).
 * On drop, calls onItemDrop with the item ID so the parent can create a new entry.
 * Also supports click-to-add as a fallback.
 */

import React, { Component } from "react";
import "./LootItemDropZone.css";
import { RECIPE_DRAG_TYPE } from "../recipe/ItemSpritePicker";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus } from "@fortawesome/free-solid-svg-icons";

export interface ILootItemDropZoneProps {
  onItemDrop?: (itemId: string) => void;
  onClick?: () => void;
  readOnly?: boolean;
}

interface ILootItemDropZoneState {
  isDragOver: boolean;
}

export default class LootItemDropZone extends Component<ILootItemDropZoneProps, ILootItemDropZoneState> {
  constructor(props: ILootItemDropZoneProps) {
    super(props);
    this.state = { isDragOver: false };

    this._handleDragOver = this._handleDragOver.bind(this);
    this._handleDragEnter = this._handleDragEnter.bind(this);
    this._handleDragLeave = this._handleDragLeave.bind(this);
    this._handleDrop = this._handleDrop.bind(this);
    this._handleClick = this._handleClick.bind(this);
  }

  private _handleDragOver(e: React.DragEvent): void {
    if (this.props.readOnly) return;
    if (e.dataTransfer.types.includes(RECIPE_DRAG_TYPE)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    }
  }

  private _handleDragEnter(e: React.DragEvent): void {
    if (this.props.readOnly) return;
    if (e.dataTransfer.types.includes(RECIPE_DRAG_TYPE)) {
      e.preventDefault();
      this.setState({ isDragOver: true });
    }
  }

  private _handleDragLeave(): void {
    this.setState({ isDragOver: false });
  }

  private _handleDrop(e: React.DragEvent): void {
    e.preventDefault();
    this.setState({ isDragOver: false });

    const itemId = e.dataTransfer.getData(RECIPE_DRAG_TYPE);
    if (itemId && this.props.onItemDrop) {
      this.props.onItemDrop(itemId);
    }
  }

  private _handleClick(): void {
    this.props.onClick?.();
  }

  render(): React.ReactNode {
    if (this.props.readOnly) return null;

    const className = "lidz-drop-zone" + (this.state.isDragOver ? " lidz-drop-zone-active" : "");

    return (
      <div
        className={className}
        onDragOver={this._handleDragOver}
        onDragEnter={this._handleDragEnter}
        onDragLeave={this._handleDragLeave}
        onDrop={this._handleDrop}
        onClick={this._handleClick}
      >
        <FontAwesomeIcon icon={faPlus} className="lidz-drop-zone-icon" />
        <span>Drag an item here or click to add</span>
      </div>
    );
  }
}
