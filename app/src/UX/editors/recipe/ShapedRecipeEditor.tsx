// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * ShapedRecipeEditor - Visual 3×3 crafting grid editor for shaped recipes.
 *
 * ARCHITECTURE:
 * - Maintains a 3×3 grid state representing which item occupies each cell
 * - Converts between grid state and JSON pattern/key representation
 * - Items can be placed via drag-and-drop from the palette or by clicking
 *   a slot then selecting from the picker
 * - Auto-assigns key characters to unique items
 * - Auto-trims empty rows/columns when persisting
 *
 * DATA FLOW:
 *   Load: recipe JSON → recipeDataToGrid() → grid state → render CraftingSlots
 *   Edit: user action → update grid → gridToRecipeData() → update definition → persist
 */

import React, { Component } from "react";
import "./ShapedRecipeEditor.css";
import { IconButton, TextField } from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";
import CraftingSlot from "./CraftingSlot";
import ItemSpriteIcon from "./ItemSpriteIcon";
import ItemSpritePicker, { RECIPE_DRAG_TYPE } from "./ItemSpritePicker";
import { IRecipeShaped, IRecipeKeyItem, IRecipeResultItem } from "../../../minecraft/IRecipeBehavior";
import Project from "../../../app/Project";
import { resolveLegacyItem } from "../../../minecraft/LegacyItemMap";

export interface IShapedRecipeEditorProps {
  recipeData: IRecipeShaped;
  project?: Project;
  darkTheme?: boolean;
  onRecipeChanged?: (data: IRecipeShaped) => void;
  readOnly?: boolean;
}

interface IShapedRecipeEditorState {
  grid: (string | null)[][];
  resultItem: string;
  resultCount: number;
  activeSlot: { row: number; col: number } | null;
}

export default class ShapedRecipeEditor extends Component<IShapedRecipeEditorProps, IShapedRecipeEditorState> {
  constructor(props: IShapedRecipeEditorProps) {
    super(props);

    const gridState = ShapedRecipeEditor.recipeDataToGrid(props.recipeData);
    const result = props.recipeData.result || { item: "" };

    this.state = {
      grid: gridState,
      resultItem: typeof result === "string" ? result : result.item || "",
      resultCount: typeof result === "string" ? 1 : result.count || 1,
      activeSlot: null,
    };

    this._handleSlotDrop = this._handleSlotDrop.bind(this);
    this._handleSlotClick = this._handleSlotClick.bind(this);
    this._handleSlotClear = this._handleSlotClear.bind(this);
    this._handleResultClick = this._handleResultClick.bind(this);
    this._handleResultClear = this._handleResultClear.bind(this);
    this._handleCountChange = this._handleCountChange.bind(this);
    this._handlePaletteItemSelected = this._handlePaletteItemSelected.bind(this);
  }

  componentDidUpdate(prevProps: IShapedRecipeEditorProps): void {
    if (prevProps.recipeData !== this.props.recipeData) {
      const gridState = ShapedRecipeEditor.recipeDataToGrid(this.props.recipeData);
      const result = this.props.recipeData.result || { item: "" };

      this.setState({
        grid: gridState,
        resultItem: typeof result === "string" ? result : result.item || "",
        resultCount: typeof result === "string" ? 1 : result.count || 1,
      });
    }
  }

  /**
   * Converts recipe JSON (pattern + key) into a 3×3 grid of item IDs.
   */
  static recipeDataToGrid(data: IRecipeShaped): (string | null)[][] {
    const grid: (string | null)[][] = [
      [null, null, null],
      [null, null, null],
      [null, null, null],
    ];

    if (!data.pattern || !data.key) {
      return grid;
    }

    for (let row = 0; row < Math.min(data.pattern.length, 3); row++) {
      const rowStr = data.pattern[row];
      for (let col = 0; col < Math.min(rowStr.length, 3); col++) {
        const char = rowStr[col];
        if (char !== " " && data.key[char]) {
          const keyItem = data.key[char];
          grid[row][col] = keyItem ? keyItem.item : null;
        }
      }
    }

    return grid;
  }

  /**
   * Converts a 3×3 grid of item IDs back to pattern + key JSON.
   * Auto-assigns key characters and trims empty rows/columns.
   * Preserves existing key character assignments when possible.
   */
  static gridToRecipeData(
    grid: (string | null)[][],
    existingKey?: { [name: string]: IRecipeKeyItem | undefined }
  ): { pattern: string[]; key: { [name: string]: IRecipeKeyItem | undefined } } {
    // Build reverse map from existing key: item → char
    const existingItemToChar: Map<string, string> = new Map();
    if (existingKey) {
      for (const [char, keyItem] of Object.entries(existingKey)) {
        if (keyItem) {
          existingItemToChar.set(keyItem.item, char);
        }
      }
    }

    // Collect unique items in the grid
    const uniqueItems = new Set<string>();
    for (const row of grid) {
      for (const cell of row) {
        if (cell) uniqueItems.add(cell);
      }
    }

    // Assign characters: reuse existing assignments, then assign new ones
    const usedChars = new Set<string>();
    const itemToChar = new Map<string, string>();
    const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

    for (const item of uniqueItems) {
      const existing = existingItemToChar.get(item);
      if (existing && !usedChars.has(existing)) {
        itemToChar.set(item, existing);
        usedChars.add(existing);
      }
    }

    for (const item of uniqueItems) {
      if (!itemToChar.has(item)) {
        for (const ch of CHARS) {
          if (!usedChars.has(ch)) {
            itemToChar.set(item, ch);
            usedChars.add(ch);
            break;
          }
        }
      }
    }

    // Build pattern strings
    const rawPattern: string[] = [];
    for (let row = 0; row < 3; row++) {
      let rowStr = "";
      for (let col = 0; col < 3; col++) {
        const item = grid[row][col];
        rowStr += item ? itemToChar.get(item) || " " : " ";
      }
      rawPattern.push(rowStr);
    }

    // Trim empty rows from top and bottom
    let topTrim = 0;
    while (topTrim < rawPattern.length && rawPattern[topTrim].trim() === "") topTrim++;
    let bottomTrim = rawPattern.length;
    while (bottomTrim > topTrim && rawPattern[bottomTrim - 1].trim() === "") bottomTrim--;

    // Trim empty columns from left and right
    let leftTrim = 3;
    let rightTrim = 0;
    for (let r = topTrim; r < bottomTrim; r++) {
      for (let c = 0; c < 3; c++) {
        if (rawPattern[r][c] !== " ") {
          leftTrim = Math.min(leftTrim, c);
          rightTrim = Math.max(rightTrim, c + 1);
        }
      }
    }

    if (leftTrim >= rightTrim) {
      // All empty grid
      return { pattern: [" "], key: {} };
    }

    const pattern: string[] = [];
    for (let r = topTrim; r < bottomTrim; r++) {
      pattern.push(rawPattern[r].substring(leftTrim, rightTrim));
    }

    // Build key object
    const key: { [name: string]: IRecipeKeyItem | undefined } = {};
    for (const [item, char] of itemToChar) {
      key[char] = { item };
    }

    return { pattern, key };
  }

  private _emitChange(grid: (string | null)[][], resultItem?: string, resultCount?: number): void {
    if (this.props.readOnly || !this.props.onRecipeChanged) return;

    const rItem = resultItem !== undefined ? resultItem : this.state.resultItem;
    const rCount = resultCount !== undefined ? resultCount : this.state.resultCount;

    const { pattern, key } = ShapedRecipeEditor.gridToRecipeData(grid, this.props.recipeData.key);

    const updated: IRecipeShaped = {
      ...this.props.recipeData,
      pattern,
      key,
      result: {
        item: rItem,
        count: rCount > 1 ? rCount : undefined,
      } as IRecipeResultItem,
    };

    this.props.onRecipeChanged(updated);
  }

  private _handleSlotDrop(row: number, col: number, itemId: string): void {
    if (this.props.readOnly) return;

    const newGrid = this.state.grid.map((r) => [...r]);
    newGrid[row][col] = itemId;
    this.setState({ grid: newGrid, activeSlot: null });
    this._emitChange(newGrid);
  }

  private _handleSlotClick(row: number, col: number): void {
    if (this.props.readOnly) return;

    this.setState({
      activeSlot: this.state.activeSlot?.row === row && this.state.activeSlot?.col === col ? null : { row, col },
    });
  }

  private _handleSlotClear(row: number, col: number): void {
    if (this.props.readOnly) return;

    const newGrid = this.state.grid.map((r) => [...r]);
    newGrid[row][col] = null;
    this.setState({ grid: newGrid });
    this._emitChange(newGrid);
  }

  private _handleResultClick(): void {
    if (this.props.readOnly) return;

    // Set activeSlot to a special marker for result
    this.setState({ activeSlot: { row: -1, col: -1 } });
  }

  private _handleResultClear(e: React.MouseEvent): void {
    e.stopPropagation();
    if (this.props.readOnly) return;

    this.setState({ resultItem: "" });
    this._emitChange(this.state.grid, "");
  }

  private _handleCountChange(e: React.ChangeEvent<HTMLInputElement>): void {
    if (this.props.readOnly) return;

    const count = Math.max(1, Math.min(64, parseInt(e.target.value) || 1));
    this.setState({ resultCount: count });
    this._emitChange(this.state.grid, undefined, count);
  }

  private _handlePaletteItemSelected(itemId: string): void {
    if (this.props.readOnly) return;

    const slot = this.state.activeSlot;
    if (!slot) return;

    if (slot.row === -1 && slot.col === -1) {
      // Result slot
      this.setState({ resultItem: itemId, activeSlot: null });
      this._emitChange(this.state.grid, itemId);
    } else {
      // Grid slot
      const newGrid = this.state.grid.map((r) => [...r]);
      newGrid[slot.row][slot.col] = itemId;
      this.setState({ grid: newGrid, activeSlot: null });
      this._emitChange(newGrid);
    }
  }

  private _renderKeyLegend(): React.ReactNode {
    const { pattern, key } = ShapedRecipeEditor.gridToRecipeData(this.state.grid, this.props.recipeData.key);
    const isDark = this.props.darkTheme;
    const entries: React.ReactNode[] = [];

    for (const [char, keyItem] of Object.entries(key)) {
      if (!keyItem) continue;
      // Use the legacy-resolved id for the display label too so legacy
      // entries like (`planks`, data 4) read as "Acacia Planks" instead of
      // the generic "Planks", matching the icon shown alongside.
      const resolvedId = resolveLegacyItem(keyItem.item, keyItem.data) || keyItem.item;
      entries.push(
        <div key={char} className={"rcsre-key-entry" + (isDark ? " rcsre-key-entry-dark" : "")}>
          <span className={"rcsre-key-char" + (isDark ? " rcsre-key-char-dark" : "")}>{char}</span>
          <span>= </span>
          <ItemSpriteIcon itemId={keyItem.item} data={keyItem.data} size="small" darkTheme={isDark} />
          <span>{ItemSpriteIcon.getDisplayName(resolvedId)}</span>
        </div>
      );
    }

    if (entries.length === 0) return null;
    return <div className="rcsre-key-legend">{entries}</div>;
  }

  render() {
    const isDark = this.props.darkTheme;

    // Build a quick item-id → data lookup from the recipe's key map so the
    // grid slots can render legacy (pre-flattening) variants with the
    // correct icon (e.g. `minecraft:planks` data 4 → acacia planks). The
    // grid itself only stores ids — data values live on the key entries.
    const itemIdToData = new Map<string, number>();
    if (this.props.recipeData?.key) {
      for (const keyItem of Object.values(this.props.recipeData.key)) {
        if (keyItem && keyItem.item && typeof keyItem.data === "number") {
          itemIdToData.set(keyItem.item, keyItem.data);
        }
      }
    }
    const resultData =
      this.props.recipeData?.result && typeof this.props.recipeData.result.data === "number"
        ? this.props.recipeData.result.data
        : undefined;

    return (
      <div className="rcsre-container">
        <div className="rcsre-crafting-area">
          {/* 3×3 Crafting Grid */}
          <div className={"rcsre-grid-frame" + (isDark ? " rcsre-grid-frame-dark" : "")}>
            <div className="rcsre-grid">
              {this.state.grid.map((row, r) =>
                row.map((cell, c) => (
                  <CraftingSlot
                    key={r + "-" + c}
                    row={r}
                    col={c}
                    itemId={cell || undefined}
                    data={cell ? itemIdToData.get(cell) : undefined}
                    darkTheme={isDark}
                    onItemDrop={this._handleSlotDrop}
                    onSlotClick={this._handleSlotClick}
                    onSlotClear={this._handleSlotClear}
                  />
                ))
              )}
            </div>
          </div>

          {/* Arrow */}
          <div className={"rcsre-arrow" + (isDark ? " rcsre-arrow-dark" : "")}>➡</div>

          {/* Result Slot */}
          <div className="rcsre-result-area">
            <div
              className={"rcsre-result-frame" + (isDark ? " rcsre-result-frame-dark" : "")}
              onDragOver={(e) => {
                if (e.dataTransfer.types.includes(RECIPE_DRAG_TYPE)) {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "copy";
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                const itemId = e.dataTransfer.getData(RECIPE_DRAG_TYPE);
                if (itemId) {
                  this.setState({ resultItem: itemId });
                  this._emitChange(this.state.grid, itemId);
                }
              }}
            >
              <div style={{ position: "relative", display: "inline-flex" }}>
                <ItemSpriteIcon
                  itemId={this.state.resultItem || undefined}
                  data={resultData}
                  empty={!this.state.resultItem}
                  size="large"
                  darkTheme={isDark}
                  onClick={this._handleResultClick}
                  title={
                    this.state.resultItem
                      ? ItemSpriteIcon.getDisplayName(this.state.resultItem)
                      : "Click to set result item"
                  }
                />
                {this.state.resultItem && (
                  <IconButton
                    size="small"
                    sx={{
                      position: "absolute",
                      top: -4,
                      right: -4,
                      width: 16,
                      height: 16,
                      minWidth: 16,
                      borderRadius: "50%",
                      border: "1px solid rgba(0,0,0,0.3)",
                      background: "#e53935",
                      color: "#fff",
                      fontSize: 10,
                      padding: 0,
                      "&:hover": { background: "#c62828" },
                    }}
                    onClick={this._handleResultClear}
                    title="Clear result"
                    aria-label="Clear result"
                  >
                    <FontAwesomeIcon icon={faXmark} />
                  </IconButton>
                )}
              </div>
            </div>
            <div className="rcsre-count-row">
              <span className={"rcsre-count-label" + (isDark ? " rcsre-count-label-dark" : "")}>Count:</span>
              <TextField
                className={"rcsre-count-input" + (isDark ? " rcsre-count-input-dark" : "")}
                size="small"
                type="number"
                value={this.state.resultCount}
                onChange={this._handleCountChange}
                disabled={this.props.readOnly}
                inputProps={{ min: 1, max: 64 }}
                sx={{ width: 80 }}
              />
            </div>
          </div>
        </div>

        {/* Key Legend */}
        {this._renderKeyLegend()}

        {/* Item Palette */}
        {!this.props.readOnly && (
          <div className={"rcsre-palette-area" + (isDark ? " rcsre-palette-area-dark" : "")}>
            <div className={"rcsre-palette-label" + (isDark ? " rcsre-palette-label-dark" : "")}>
              {this.state.activeSlot
                ? this.state.activeSlot.row === -1
                  ? "Select result item:"
                  : "Select item for slot (" +
                    (this.state.activeSlot.row + 1) +
                    ", " +
                    (this.state.activeSlot.col + 1) +
                    "):"
                : "Drag items to the crafting grid, or click a slot first:"}
            </div>
            <ItemSpritePicker
              project={this.props.project}
              darkTheme={isDark}
              draggable={true}
              height={240}
              onItemSelected={this._handlePaletteItemSelected}
            />
          </div>
        )}
      </div>
    );
  }
}
