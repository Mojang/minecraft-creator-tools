// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * ItemSpritePicker - Searchable item selection panel with category grouping.
 *
 * Displays a grid of ItemSpriteIcons organized by category, with a search
 * bar for filtering. Items are draggable for use with crafting grid slots.
 * Also supports raw item ID input for advanced users.
 */

import React, { Component } from "react";
import "./ItemSpritePicker.css";
import ItemSpriteIcon from "./ItemSpriteIcon";
import ItemSpriteDatabase, { IItemSpriteEntry } from "./ItemSpriteDatabase";
import Project from "../../../app/Project";
import { IconButton, TextField } from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus } from "@fortawesome/free-solid-svg-icons";

export interface IItemSpritePickerProps {
  project?: Project;
  darkTheme?: boolean;
  onItemSelected?: (itemId: string) => void;
  selectedItemId?: string;
  height?: number | string;
  draggable?: boolean;
}

interface IItemSpritePickerState {
  items: IItemSpriteEntry[];
  searchQuery: string;
  rawInput: string;
  isLoaded: boolean;
  /** Whether the initial sprite images have been preloaded into browser cache */
  spritesReady: boolean;
  /** How many items to render (grows as user scrolls) */
  renderLimit: number;
}

export const RECIPE_DRAG_TYPE = "application/x-recipe-item";

/** Number of items to render initially and add per scroll batch */
const INITIAL_RENDER_LIMIT = 240;
const RENDER_BATCH_SIZE = 160;

export default class ItemSpritePicker extends Component<IItemSpritePickerProps, IItemSpritePickerState> {
  private _searchTimeout: ReturnType<typeof setTimeout> | undefined;
  private _scrollRef: HTMLDivElement | null = null;

  constructor(props: IItemSpritePickerProps) {
    super(props);
    this.state = {
      items: [],
      searchQuery: "",
      rawInput: "",
      isLoaded: false,
      spritesReady: ItemSpriteDatabase.isPreloaded,
      renderLimit: INITIAL_RENDER_LIMIT,
    };

    this._handleSearchChange = this._handleSearchChange.bind(this);
    this._handleRawInputChange = this._handleRawInputChange.bind(this);
    this._handleRawInputSubmit = this._handleRawInputSubmit.bind(this);
    this._handleRawInputKeyDown = this._handleRawInputKeyDown.bind(this);
    this._handleScroll = this._handleScroll.bind(this);
  }

  componentDidMount(): void {
    this._loadItems();
  }

  componentDidUpdate(prevProps: IItemSpritePickerProps): void {
    if (prevProps.project !== this.props.project) {
      ItemSpriteDatabase.clearCache();
      this._loadItems();
    }
    // If the rendered content doesn't fill the scroll area, the onScroll
    // handler will never fire — keep loading more until either everything
    // is rendered or the container actually overflows.
    this._maybeLoadMoreIfNotScrollable();
  }

  componentWillUnmount(): void {
    if (this._searchTimeout) {
      clearTimeout(this._searchTimeout);
    }
  }

  private async _loadItems(): Promise<void> {
    const items = await ItemSpriteDatabase.getAllAvailableItems(this.props.project);
    this.setState({ items, isLoaded: true });

    // Wait for the initial batch of sprite images to land in browser cache
    // so the grid doesn't "sprinkle" icons in one-by-one.
    if (!ItemSpriteDatabase.isPreloaded) {
      await ItemSpriteDatabase.waitForPreload();
    }
    this.setState({ spritesReady: true });
  }

  private _handleSearchChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const query = e.target.value;
    this.setState({ searchQuery: query, renderLimit: INITIAL_RENDER_LIMIT });
  }

  private _handleItemClick(itemId: string): void {
    if (this.props.onItemSelected) {
      this.props.onItemSelected(itemId);
    }
  }

  private _handleDragStart(e: React.DragEvent, itemId: string): void {
    e.dataTransfer.setData(RECIPE_DRAG_TYPE, itemId);
    e.dataTransfer.effectAllowed = "copy";
  }

  private _handleRawInputChange(e: React.ChangeEvent<HTMLInputElement>): void {
    this.setState({ rawInput: e.target.value });
  }

  private _handleRawInputSubmit(): void {
    const id = this.state.rawInput.trim();
    if (id && this.props.onItemSelected) {
      this.props.onItemSelected(id);
      this.setState({ rawInput: "" });
    }
  }

  private _handleRawInputKeyDown(e: React.KeyboardEvent): void {
    if (e.key === "Enter") {
      this._handleRawInputSubmit();
    }
  }

  private _handleScroll(): void {
    if (!this._scrollRef) return;
    const { scrollTop, scrollHeight, clientHeight } = this._scrollRef;
    // Load more when within 200px of the bottom
    if (scrollHeight - scrollTop - clientHeight < 200) {
      const filtered = ItemSpriteDatabase.filterItems(this.state.items, this.state.searchQuery);
      if (this.state.renderLimit < filtered.length) {
        this.setState((prev) => ({ renderLimit: prev.renderLimit + RENDER_BATCH_SIZE }));
      }
    }
  }

  private _maybeLoadMoreIfNotScrollable(): void {
    if (!this._scrollRef) return;
    const { scrollHeight, clientHeight } = this._scrollRef;
    // If content fits without scrolling but more items remain, render the
    // next batch so the user can actually see them. Bail out once the area
    // becomes scrollable so onScroll can take over.
    if (scrollHeight > clientHeight + 1) return;
    const filtered = ItemSpriteDatabase.filterItems(this.state.items, this.state.searchQuery);
    if (this.state.renderLimit >= filtered.length) return;
    this.setState((prev) => ({ renderLimit: prev.renderLimit + RENDER_BATCH_SIZE }));
  }

  render() {
    const isDark = this.props.darkTheme;
    const containerClass = "rcisp-container" + (isDark ? " rcisp-container-dark" : "");
    const containerStyle: React.CSSProperties = {};

    if (this.props.height) {
      containerStyle.height = typeof this.props.height === "number" ? this.props.height + "px" : this.props.height;
    }

    if (!this.state.isLoaded || !this.state.spritesReady) {
      return (
        <div className={containerClass} style={containerStyle}>
          <div className="rcisp-empty-message">Loading items...</div>
        </div>
      );
    }

    const filtered = ItemSpriteDatabase.filterItems(this.state.items, this.state.searchQuery);
    const categories = ItemSpriteDatabase.getCategories(filtered);

    // Progressive rendering: only render up to renderLimit items total
    let rendered = 0;
    const limit = this.state.renderLimit;

    return (
      <div className={containerClass} style={containerStyle}>
        <div className="rcisp-search-bar">
          <TextField
            className="rcisp-search-input"
            size="small"
            type="text"
            placeholder="Search items..."
            value={this.state.searchQuery}
            onChange={this._handleSearchChange}
            autoComplete="off"
            fullWidth
          />
        </div>

        <div
          className="rcisp-scroll-area"
          ref={(el) => {
            this._scrollRef = el;
          }}
          onScroll={this._handleScroll}
        >
          {filtered.length === 0 ? (
            <div className="rcisp-empty-message">No items match your search</div>
          ) : (
            categories.map((cat) => {
              if (rendered >= limit) return null;

              const catItems = filtered.filter((item) => item.category === cat);
              if (catItems.length === 0) return null;

              // Only render items up to the remaining limit
              const itemsToRender = catItems.slice(0, limit - rendered);
              rendered += itemsToRender.length;

              return (
                <div key={cat} className="rcisp-category">
                  <div className="rcisp-category-header">{cat}</div>
                  <div className="rcisp-item-grid">
                    {itemsToRender.map((item) => (
                      <div
                        key={item.id}
                        className={
                          "rcisp-item-cell" + (this.props.selectedItemId === item.id ? " rcisp-item-cell-selected" : "")
                        }
                        draggable={this.props.draggable}
                        onDragStart={this.props.draggable ? (e) => this._handleDragStart(e, item.id) : undefined}
                        onClick={() => this._handleItemClick(item.id)}
                      >
                        <ItemSpriteIcon
                          itemId={item.id}
                          spriteFilename={item.sprite}
                          atlasX={item.atlasX}
                          atlasY={item.atlasY}
                          size="small"
                          darkTheme={isDark}
                          title={item.displayName + " (" + item.id + ")"}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="rcisp-raw-input-row">
          <TextField
            className="rcisp-raw-input"
            size="small"
            type="text"
            placeholder="minecraft:item_id"
            value={this.state.rawInput}
            onChange={this._handleRawInputChange}
            onKeyDown={this._handleRawInputKeyDown}
            autoComplete="off"
            fullWidth
          />
          <IconButton
            className="rcisp-raw-button"
            size="small"
            onClick={this._handleRawInputSubmit}
            title="Add item"
            aria-label="Add item"
          >
            <FontAwesomeIcon icon={faPlus} />
          </IconButton>
        </div>
      </div>
    );
  }
}
