// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * RecipePropertiesPanel - Shared properties editor for all recipe types.
 *
 * Edits: identifier, tags, priority, unlock conditions, format_version.
 */

import React, { Component } from "react";
import IRecipeBehavior, { IRecipeShaped, IRecipeShapeless } from "../../../minecraft/IRecipeBehavior";
import "./RecipeEditor.css";

const KNOWN_TAGS = [
  "crafting_table",
  "stonecutter",
  "furnace",
  "blast_furnace",
  "smoker",
  "campfire",
  "soul_campfire",
  "brewing_stand",
  "smithing_table",
];

const UNLOCK_CONTEXTS = ["AlwaysUnlocked", "PlayerInWater", "PlayerHasManyItems"];

export interface IRecipePropertiesPanelProps {
  recipeJson: IRecipeBehavior;
  darkTheme?: boolean;
  readOnly?: boolean;
  onChanged?: (json: IRecipeBehavior) => void;
}

interface IRecipePropertiesPanelState {
  identifier: string;
  tags: string[];
  formatVersion: string;
  unlockContext: string;
}

export default class RecipePropertiesPanel extends Component<IRecipePropertiesPanelProps, IRecipePropertiesPanelState> {
  constructor(props: IRecipePropertiesPanelProps) {
    super(props);

    const interior = this._getInterior(props.recipeJson);

    this.state = {
      identifier: interior?.description?.identifier || "",
      tags: interior?.tags || [],
      formatVersion: props.recipeJson.format_version || "1.20.10",
      unlockContext: this._getUnlockContext(interior),
    };

    this._handleIdentifierChange = this._handleIdentifierChange.bind(this);
    this._handleFormatVersionChange = this._handleFormatVersionChange.bind(this);
    this._handleTagToggle = this._handleTagToggle.bind(this);
    this._handleUnlockChange = this._handleUnlockChange.bind(this);
  }

  componentDidUpdate(prevProps: IRecipePropertiesPanelProps): void {
    if (prevProps.recipeJson !== this.props.recipeJson) {
      const interior = this._getInterior(this.props.recipeJson);
      this.setState({
        identifier: interior?.description?.identifier || "",
        tags: interior?.tags || [],
        formatVersion: this.props.recipeJson.format_version || "1.20.10",
        unlockContext: this._getUnlockContext(interior),
      });
    }
  }

  private _getInterior(json: IRecipeBehavior): IRecipeShaped | IRecipeShapeless | undefined {
    return json["minecraft:recipe_shaped"] || json["minecraft:recipe_shapeless"];
  }

  private _getUnlockContext(interior?: IRecipeShaped | IRecipeShapeless): string {
    if (!interior?.unlock) return "";
    const unlock = Array.isArray(interior.unlock) ? interior.unlock[0] : interior.unlock;
    return unlock?.context || "";
  }

  private _emitChange(updates: Partial<IRecipePropertiesPanelState>): void {
    if (this.props.readOnly || !this.props.onChanged) return;

    const newState = { ...this.state, ...updates };
    const json = { ...this.props.recipeJson };
    json.format_version = newState.formatVersion;

    // Update the interior recipe data
    const recipeKey = json["minecraft:recipe_shaped"] ? "minecraft:recipe_shaped" : "minecraft:recipe_shapeless";

    const interior = json[recipeKey as keyof IRecipeBehavior];
    if (interior && typeof interior === "object") {
      const interiorObj = interior as IRecipeShaped | IRecipeShapeless;
      interiorObj.description = { identifier: newState.identifier };
      interiorObj.tags = newState.tags.length > 0 ? newState.tags : undefined;

      if (newState.unlockContext) {
        interiorObj.unlock = { context: newState.unlockContext };
      } else {
        interiorObj.unlock = undefined;
      }
    }

    this.props.onChanged(json);
  }

  private _handleIdentifierChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const identifier = e.target.value;
    this.setState({ identifier });
    this._emitChange({ identifier });
  }

  private _handleFormatVersionChange(e: React.ChangeEvent<HTMLSelectElement>): void {
    const formatVersion = e.target.value;
    this.setState({ formatVersion });
    this._emitChange({ formatVersion });
  }

  private _handleTagToggle(tag: string): void {
    const tags = [...this.state.tags];
    const index = tags.indexOf(tag);
    if (index >= 0) {
      tags.splice(index, 1);
    } else {
      tags.push(tag);
    }
    this.setState({ tags });
    this._emitChange({ tags });
  }

  private _handleUnlockChange(e: React.ChangeEvent<HTMLSelectElement>): void {
    const unlockContext = e.target.value;
    this.setState({ unlockContext });
    this._emitChange({ unlockContext });
  }

  render() {
    const isDark = this.props.darkTheme;
    const labelClass = "rcre-prop-label" + (isDark ? " rcre-prop-label-dark" : "");
    const inputClass = "rcre-prop-input" + (isDark ? " rcre-prop-input-dark" : "");

    return (
      <div className={"rcre-properties-panel" + (isDark ? " rcre-properties-panel-dark" : "")}>
        {/* Identifier */}
        <div className="rcre-prop-row">
          <label className={labelClass}>Identifier</label>
          <input
            className={inputClass}
            type="text"
            value={this.state.identifier}
            onChange={this._handleIdentifierChange}
            placeholder="namespace:recipe_name"
            disabled={this.props.readOnly}
          />
        </div>

        {/* Format Version */}
        <div className="rcre-prop-row">
          <label className={labelClass}>Format Version</label>
          <select
            className={inputClass}
            value={this.state.formatVersion}
            onChange={this._handleFormatVersionChange}
            disabled={this.props.readOnly}
          >
            <option value="1.12">1.12</option>
            <option value="1.16.0">1.16.0</option>
            <option value="1.20.10">1.20.10</option>
            <option value="1.20.80">1.20.80</option>
            <option value="1.21.0">1.21.0</option>
            <option value="1.21.40">1.21.40</option>
          </select>
        </div>

        {/* Tags */}
        <div className="rcre-prop-row">
          <label className={labelClass}>Crafting Station Tags</label>
          <div className="rcre-tag-grid">
            {KNOWN_TAGS.map((tag) => (
              <label key={tag} className={"rcre-tag-item" + (isDark ? " rcre-tag-item-dark" : "")}>
                <input
                  type="checkbox"
                  checked={this.state.tags.includes(tag)}
                  onChange={() => this._handleTagToggle(tag)}
                  disabled={this.props.readOnly}
                />
                <span>{tag}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Unlock */}
        <div className="rcre-prop-row">
          <label className={labelClass}>Unlock Condition</label>
          <select
            className={inputClass}
            value={this.state.unlockContext}
            onChange={this._handleUnlockChange}
            disabled={this.props.readOnly}
          >
            <option value="">None</option>
            {UNLOCK_CONTEXTS.map((ctx) => (
              <option key={ctx} value={ctx}>
                {ctx}
              </option>
            ))}
          </select>
        </div>
      </div>
    );
  }
}
