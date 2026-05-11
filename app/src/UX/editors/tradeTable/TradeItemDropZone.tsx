// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * TradeItemDropZone - Drop target for adding new trades to a group.
 *
 * Accepts items dragged from the ItemSpritePicker (RECIPE_DRAG_TYPE) and emits
 * the dropped item id. The parent creates a new trade with that item as `gives`.
 */

import React, { Component } from "react";
import "./TradeItemDropZone.css";
import { RECIPE_DRAG_TYPE } from "../recipe/ItemSpritePicker";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus } from "@fortawesome/free-solid-svg-icons";

export interface ITradeItemDropZoneProps {
  onItemDrop?: (itemId: string) => void;
  onClick?: () => void;
  readOnly?: boolean;
}

interface ITradeItemDropZoneState {
  isDragOver: boolean;
}

export default class TradeItemDropZone extends Component<ITradeItemDropZoneProps, ITradeItemDropZoneState> {
  constructor(props: ITradeItemDropZoneProps) {
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

    const className = "ttio-drop-zone" + (this.state.isDragOver ? " ttio-drop-zone-active" : "");

    return (
      <div
        className={className}
        onDragOver={this._handleDragOver}
        onDragEnter={this._handleDragEnter}
        onDragLeave={this._handleDragLeave}
        onDrop={this._handleDrop}
        onClick={this._handleClick}
      >
        <FontAwesomeIcon icon={faPlus} className="ttio-drop-zone-icon" />
        <span>Drag an item here to add a trade for it</span>
      </div>
    );
  }
}
