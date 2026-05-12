// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * ShapelessRecipeEditor - Ingredient list editor for shapeless recipes.
 *
 * Displays ingredients as a visual list with item sprites. Users can add
 * ingredients from the palette, remove them, and drag-drop items into
 * the ingredient drop zone.
 *
 * Max 9 ingredients (3×3 crafting table limit).
 */

import React, { Component } from "react";
import "./ShapelessRecipeEditor.css";
import ItemSpriteIcon from "./ItemSpriteIcon";
import ItemSpritePicker, { RECIPE_DRAG_TYPE } from "./ItemSpritePicker";
import { IRecipeShapeless, IRecipeKeyItem, IRecipeResultItem } from "../../../minecraft/IRecipeBehavior";
import Project from "../../../app/Project";
import { Button, IconButton, TextField } from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faXmark } from "@fortawesome/free-solid-svg-icons";

const MAX_INGREDIENTS = 9;

export interface IShapelessRecipeEditorProps {
  recipeData: IRecipeShapeless;
  project?: Project;
  darkTheme?: boolean;
  onRecipeChanged?: (data: IRecipeShapeless) => void;
  readOnly?: boolean;
}

interface IShapelessRecipeEditorState {
  ingredients: string[];
  resultItem: string;
  resultCount: number;
  selectingResult: boolean;
  dropZoneActive: boolean;
}

export default class ShapelessRecipeEditor extends Component<IShapelessRecipeEditorProps, IShapelessRecipeEditorState> {
  constructor(props: IShapelessRecipeEditorProps) {
    super(props);

    const ingredients = ShapelessRecipeEditor.extractIngredients(props.recipeData);
    const result = props.recipeData.result || { item: "" };

    this.state = {
      ingredients,
      resultItem: typeof result === "string" ? result : result.item || "",
      resultCount: typeof result === "string" ? 1 : result.count || 1,
      selectingResult: false,
      dropZoneActive: false,
    };

    this._handleRemoveIngredient = this._handleRemoveIngredient.bind(this);
    this._handleAddClick = this._handleAddClick.bind(this);
    this._handleResultClick = this._handleResultClick.bind(this);
    this._handleCountChange = this._handleCountChange.bind(this);
    this._handlePaletteItemSelected = this._handlePaletteItemSelected.bind(this);
    this._handleDropZoneDragOver = this._handleDropZoneDragOver.bind(this);
    this._handleDropZoneDragLeave = this._handleDropZoneDragLeave.bind(this);
    this._handleDropZoneDrop = this._handleDropZoneDrop.bind(this);
  }

  componentDidUpdate(prevProps: IShapelessRecipeEditorProps): void {
    if (prevProps.recipeData !== this.props.recipeData) {
      const ingredients = ShapelessRecipeEditor.extractIngredients(this.props.recipeData);
      const result = this.props.recipeData.result || { item: "" };

      this.setState({
        ingredients,
        resultItem: typeof result === "string" ? result : result.item || "",
        resultCount: typeof result === "string" ? 1 : result.count || 1,
      });
    }
  }

  static extractIngredients(data: IRecipeShapeless): string[] {
    if (!data.ingredients) return [];

    return data.ingredients
      .filter((ing): ing is IRecipeKeyItem => ing !== undefined && ing !== null)
      .map((ing) => (typeof ing === "string" ? ing : ing.item));
  }

  static ingredientsToRecipeData(ingredients: string[]): (IRecipeKeyItem | undefined)[] {
    return ingredients.map((item) => ({ item }));
  }

  private _emitChange(ingredients?: string[], resultItem?: string, resultCount?: number): void {
    if (this.props.readOnly || !this.props.onRecipeChanged) return;

    const ings = ingredients !== undefined ? ingredients : this.state.ingredients;
    const rItem = resultItem !== undefined ? resultItem : this.state.resultItem;
    const rCount = resultCount !== undefined ? resultCount : this.state.resultCount;

    const updated: IRecipeShapeless = {
      ...this.props.recipeData,
      ingredients: ShapelessRecipeEditor.ingredientsToRecipeData(ings),
      result: {
        item: rItem,
        count: rCount > 1 ? rCount : undefined,
      } as IRecipeResultItem,
    };

    this.props.onRecipeChanged(updated);
  }

  private _handleRemoveIngredient(index: number): void {
    if (this.props.readOnly) return;

    const newIngredients = [...this.state.ingredients];
    newIngredients.splice(index, 1);
    this.setState({ ingredients: newIngredients });
    this._emitChange(newIngredients);
  }

  private _handleAddClick(): void {
    if (this.props.readOnly) return;

    this.setState({ selectingResult: false });
  }

  private _handleResultClick(): void {
    if (this.props.readOnly) return;

    this.setState({ selectingResult: true });
  }

  private _handleCountChange(e: React.ChangeEvent<HTMLInputElement>): void {
    if (this.props.readOnly) return;

    const count = Math.max(1, Math.min(64, parseInt(e.target.value) || 1));
    this.setState({ resultCount: count });
    this._emitChange(undefined, undefined, count);
  }

  private _handlePaletteItemSelected(itemId: string): void {
    if (this.props.readOnly) return;

    if (this.state.selectingResult) {
      this.setState({ resultItem: itemId, selectingResult: false });
      this._emitChange(undefined, itemId);
    } else {
      if (this.state.ingredients.length >= MAX_INGREDIENTS) return;
      const newIngredients = [...this.state.ingredients, itemId];
      this.setState({ ingredients: newIngredients });
      this._emitChange(newIngredients);
    }
  }

  private _handleDropZoneDragOver(e: React.DragEvent): void {
    if (e.dataTransfer.types.includes(RECIPE_DRAG_TYPE)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      if (!this.state.dropZoneActive) {
        this.setState({ dropZoneActive: true });
      }
    }
  }

  private _handleDropZoneDragLeave(): void {
    this.setState({ dropZoneActive: false });
  }

  private _handleDropZoneDrop(e: React.DragEvent): void {
    e.preventDefault();
    this.setState({ dropZoneActive: false });

    if (this.state.ingredients.length >= MAX_INGREDIENTS) return;

    const itemId = e.dataTransfer.getData(RECIPE_DRAG_TYPE);
    if (itemId) {
      const newIngredients = [...this.state.ingredients, itemId];
      this.setState({ ingredients: newIngredients });
      this._emitChange(newIngredients);
    }
  }

  render() {
    const isDark = this.props.darkTheme;
    const atLimit = this.state.ingredients.length >= MAX_INGREDIENTS;

    return (
      <div className="rcslre-container">
        <div className="rcslre-crafting-area">
          {/* Ingredients List */}
          <div className={"rcslre-ingredients-frame" + (isDark ? " rcslre-ingredients-frame-dark" : "")}>
            <div className="rcslre-ingredients-header">
              Ingredients ({this.state.ingredients.length}/{MAX_INGREDIENTS})
            </div>

            {this.state.ingredients.map((ing, i) => (
              <div key={i + "-" + ing} className="rcslre-ingredient-row">
                <ItemSpriteIcon itemId={ing} size="small" darkTheme={true} />
                <span className="rcslre-ingredient-name">{ItemSpriteIcon.getDisplayName(ing)}</span>
                {!this.props.readOnly && (
                  <IconButton
                    className="rcslre-ingredient-remove"
                    size="small"
                    onClick={() => this._handleRemoveIngredient(i)}
                    title="Remove ingredient"
                    aria-label={"Remove " + ItemSpriteIcon.getDisplayName(ing)}
                  >
                    <FontAwesomeIcon icon={faXmark} />
                  </IconButton>
                )}
              </div>
            ))}

            {/* Drop zone for new ingredients */}
            {!this.props.readOnly && (
              <>
                <div
                  className={"rcslre-drop-zone" + (this.state.dropZoneActive ? " rcslre-drop-zone-active" : "")}
                  onDragOver={this._handleDropZoneDragOver}
                  onDragLeave={this._handleDropZoneDragLeave}
                  onDrop={this._handleDropZoneDrop}
                >
                  {atLimit ? "Maximum ingredients reached" : "Drop items here"}
                </div>
                <div className="rcslre-add-area">
                  <Button
                    className="rcslre-add-button"
                    size="small"
                    onClick={this._handleAddClick}
                    disabled={atLimit}
                    startIcon={<FontAwesomeIcon icon={faPlus} />}
                  >
                    Add Ingredient
                  </Button>
                </div>
                {atLimit && <div className="rcslre-limit-warning">Max {MAX_INGREDIENTS} ingredients</div>}
              </>
            )}
          </div>

          {/* Arrow */}
          <div className={"rcslre-arrow" + (isDark ? " rcslre-arrow-dark" : "")}>➡</div>

          {/* Result Slot */}
          <div className="rcslre-result-area">
            <div
              className={"rcslre-result-frame" + (isDark ? " rcslre-result-frame-dark" : "")}
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
                  this._emitChange(undefined, itemId);
                }
              }}
            >
              <div style={{ position: "relative", display: "inline-flex" }}>
                <ItemSpriteIcon
                  itemId={this.state.resultItem || undefined}
                  empty={!this.state.resultItem}
                  size="large"
                  darkTheme={isDark}
                  onClick={this._handleResultClick}
                  title={
                    this.state.resultItem ? ItemSpriteIcon.getDisplayName(this.state.resultItem) : "Click to set result"
                  }
                />
                {this.state.resultItem && !this.props.readOnly && (
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
                    onClick={(e) => {
                      e.stopPropagation();
                      this.setState({ resultItem: "" });
                      this._emitChange(undefined, "");
                    }}
                    title="Clear result"
                    aria-label="Clear result"
                  >
                    <FontAwesomeIcon icon={faXmark} />
                  </IconButton>
                )}
              </div>
            </div>
            <div className="rcslre-count-row">
              <span className={"rcslre-count-label" + (isDark ? " rcslre-count-label-dark" : "")}>Count:</span>
              <TextField
                className={"rcslre-count-input" + (isDark ? " rcslre-count-input-dark" : "")}
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

        {/* Item Palette */}
        {!this.props.readOnly && (
          <div className={"rcslre-palette-area" + (isDark ? " rcslre-palette-area-dark" : "")}>
            <div className={"rcslre-palette-label" + (isDark ? " rcslre-palette-label-dark" : "")}>
              {this.state.selectingResult ? "Select result item:" : "Select an ingredient to add, or drag items above:"}
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
