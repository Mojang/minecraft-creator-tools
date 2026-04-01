// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * RecipeLivePreview - Compact live preview for recipe definitions
 *
 * Shows recipe type, inputs, outputs, and crafting requirements in a
 * table-of-contents style format with click-to-navigate support.
 */

import React, { Component } from "react";
import SectionIcon from "../../shared/components/icons/SectionIcon";
import "./RecipeLivePreview.css";

export interface IRecipeLivePreviewProps {
  jsonData?: any;
  identifier?: string;
  darkTheme?: boolean;
  onNavigate?: (path: string) => void;
  maxHeight?: number;
}

interface ParsedRecipeData {
  formatVersion: string;
  recipeType: string;
  identifier: string;
  tags?: string[];
  inputs: { key: string; item: string; count?: number }[];
  output: { item: string; count?: number };
  pattern?: string[];
}

interface IRecipeLivePreviewState {
  isLoaded: boolean;
  recipeData: ParsedRecipeData | null;
  expandedSections: Set<string>;
}

export default class RecipeLivePreview extends Component<IRecipeLivePreviewProps, IRecipeLivePreviewState> {
  constructor(props: IRecipeLivePreviewProps) {
    super(props);
    this.state = {
      isLoaded: false,
      recipeData: null,
      expandedSections: new Set(["inputs", "output", "pattern"]),
    };
  }

  componentDidMount(): void {
    this._loadDefinition();
  }

  componentDidUpdate(prevProps: IRecipeLivePreviewProps): void {
    if (prevProps.jsonData !== this.props.jsonData) {
      this._loadDefinition();
    }
  }

  private _loadDefinition(): void {
    try {
      if (!this.props.jsonData) {
        this.setState({ isLoaded: true, recipeData: null });
        return;
      }

      const json = this.props.jsonData;
      let recipeType = "unknown";
      let recipeData: any = null;

      // Detect recipe type from the JSON structure
      if (json["minecraft:recipe_shaped"]) {
        recipeType = "shaped";
        recipeData = json["minecraft:recipe_shaped"];
      } else if (json["minecraft:recipe_shapeless"]) {
        recipeType = "shapeless";
        recipeData = json["minecraft:recipe_shapeless"];
      } else if (json["minecraft:recipe_furnace"]) {
        recipeType = "furnace";
        recipeData = json["minecraft:recipe_furnace"];
      } else if (json["minecraft:recipe_brewing_mix"]) {
        recipeType = "brewing";
        recipeData = json["minecraft:recipe_brewing_mix"];
      } else if (json["minecraft:recipe_brewing_container"]) {
        recipeType = "brewing";
        recipeData = json["minecraft:recipe_brewing_container"];
      } else if (json["minecraft:recipe_smithing_transform"]) {
        recipeType = "smithing";
        recipeData = json["minecraft:recipe_smithing_transform"];
      }

      if (!recipeData) {
        this.setState({ isLoaded: true, recipeData: null });
        return;
      }

      const parsed: ParsedRecipeData = {
        formatVersion: json.format_version || "unknown",
        recipeType,
        identifier: recipeData.description?.identifier || this.props.identifier || "unknown",
        tags: recipeData.tags || [],
        inputs: this._parseInputs(recipeData, recipeType),
        output: this._parseOutput(recipeData, recipeType),
        pattern: recipeData.pattern,
      };

      this.setState({ isLoaded: true, recipeData: parsed });
    } catch {
      this.setState({ isLoaded: true, recipeData: null });
    }
  }

  private _parseInputs(data: any, type: string): { key: string; item: string; count?: number }[] {
    const inputs: { key: string; item: string; count?: number }[] = [];

    if (type === "shaped" && data.key) {
      for (const [key, value] of Object.entries(data.key)) {
        const item = typeof value === "string" ? value : (value as any).item || String(value);
        inputs.push({ key, item });
      }
    } else if (type === "shapeless" && data.ingredients) {
      data.ingredients.forEach((ing: any, i: number) => {
        const item = typeof ing === "string" ? ing : ing.item || String(ing);
        const count = typeof ing === "object" ? ing.count : undefined;
        inputs.push({ key: String(i + 1), item, count });
      });
    } else if (type === "furnace") {
      if (data.input) {
        const item = typeof data.input === "string" ? data.input : data.input.item || String(data.input);
        inputs.push({ key: "input", item });
      }
    } else if (type === "brewing") {
      if (data.input) inputs.push({ key: "input", item: data.input });
      if (data.reagent) inputs.push({ key: "reagent", item: data.reagent });
    } else if (type === "smithing") {
      if (data.base) inputs.push({ key: "base", item: data.base });
      if (data.addition) inputs.push({ key: "addition", item: data.addition });
      if (data.template) inputs.push({ key: "template", item: data.template });
    }

    return inputs;
  }

  private _parseOutput(data: any, type: string): { item: string; count?: number } {
    let output = data.result || data.output;
    if (!output) return { item: "unknown" };

    if (typeof output === "string") {
      return { item: output };
    }
    return { item: output.item || "unknown", count: output.count };
  }

  private _toggleSection(section: string): void {
    const expanded = new Set(this.state.expandedSections);
    if (expanded.has(section)) {
      expanded.delete(section);
    } else {
      expanded.add(section);
    }
    this.setState({ expandedSections: expanded });
  }

  private _getRecipeIcon(type: string): React.ReactNode {
    switch (type) {
      case "shaped":
        return <SectionIcon type="grid" />;
      case "shapeless":
        return <SectionIcon type="shuffle" />;
      case "furnace":
        return <SectionIcon type="flame" />;
      case "brewing":
        return <SectionIcon type="flask" />;
      case "smithing":
        return <SectionIcon type="hammer" />;
      case "stonecutter":
        return <SectionIcon type="stone" />;
      default:
        return <SectionIcon type="clipboard" />;
    }
  }

  private _shortenItemName(name: string): string {
    return name.replace(/^minecraft:/, "").replace(/_/g, " ");
  }

  private _renderHeader(data: ParsedRecipeData): JSX.Element {
    const shortId = data.identifier.includes(":") ? data.identifier.split(":")[1] : data.identifier;

    return (
      <div className="rclp-header">
        <div className="rclp-icon">{this._getRecipeIcon(data.recipeType)}</div>
        <div className="rclp-title">
          <div className="rclp-name">{this._toTitleCase(shortId)}</div>
          <div className="rclp-type">{data.recipeType} recipe</div>
        </div>
      </div>
    );
  }

  private _renderPattern(pattern?: string[]): JSX.Element | null {
    if (!pattern || pattern.length === 0) return null;

    const isExpanded = this.state.expandedSections.has("pattern");

    return (
      <div className="rclp-section">
        <div className="rclp-section-header" onClick={() => this._toggleSection("pattern")}>
          <span className="rclp-expand-icon">{isExpanded ? "▼" : "▶"}</span>
          <span><SectionIcon type="grid" /> Pattern</span>
        </div>
        {isExpanded && (
          <div className="rclp-pattern">
            {pattern.map((row, i) => (
              <div key={i} className="rclp-pattern-row">
                {row.split("").map((char, j) => (
                  <span
                    key={j}
                    className={`rclp-pattern-cell ${char === " " ? "rclp-pattern-empty" : ""}`}
                    onClick={() => this.props.onNavigate?.(`key/${char}`)}
                    title={char === " " ? "Empty" : `Key: ${char}`}
                  >
                    {char === " " ? "·" : char}
                  </span>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  private _renderInputs(inputs: ParsedRecipeData["inputs"]): JSX.Element | null {
    if (inputs.length === 0) return null;

    const isExpanded = this.state.expandedSections.has("inputs");

    return (
      <div className="rclp-section">
        <div className="rclp-section-header" onClick={() => this._toggleSection("inputs")}>
          <span className="rclp-expand-icon">{isExpanded ? "▼" : "▶"}</span>
          <span><SectionIcon type="inbox" /> Inputs</span>
          <span className="rclp-badge">{inputs.length}</span>
        </div>
        {isExpanded && (
          <div className="rclp-items">
            {inputs.map((input, i) => (
              <div
                key={i}
                className="rclp-item rclp-clickable"
                onClick={() => this.props.onNavigate?.(`key/${input.key}`)}
                title={`Go to ${input.key}`}
              >
                <span className="rclp-item-key">{input.key}</span>
                <span className="rclp-item-name">{this._shortenItemName(input.item)}</span>
                {input.count && input.count > 1 && <span className="rclp-item-count">×{input.count}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  private _renderOutput(output: ParsedRecipeData["output"]): JSX.Element {
    const isExpanded = this.state.expandedSections.has("output");

    return (
      <div className="rclp-section">
        <div className="rclp-section-header" onClick={() => this._toggleSection("output")}>
          <span className="rclp-expand-icon">{isExpanded ? "▼" : "▶"}</span>
          <span><SectionIcon type="outbox" /> Output</span>
        </div>
        {isExpanded && (
          <div
            className="rclp-output rclp-clickable"
            onClick={() => this.props.onNavigate?.("result")}
            title="Go to result"
          >
            <span className="rclp-output-item">{this._shortenItemName(output.item)}</span>
            {output.count && output.count > 1 && <span className="rclp-output-count">×{output.count}</span>}
          </div>
        )}
      </div>
    );
  }

  private _renderTags(tags?: string[]): JSX.Element | null {
    if (!tags || tags.length === 0) return null;

    return (
      <div className="rclp-tags">
        {tags.map((tag, i) => (
          <span key={i} className="rclp-tag">
            {tag}
          </span>
        ))}
      </div>
    );
  }

  private _toTitleCase(str: string): string {
    return str.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  render(): JSX.Element {
    const { darkTheme, maxHeight } = this.props;
    const { isLoaded, recipeData } = this.state;

    const containerClass = `rclp-container ${darkTheme ? "rclp-dark" : "rclp-light"}`;
    const style: React.CSSProperties = maxHeight ? { maxHeight, overflowY: "auto" } : {};

    if (!isLoaded) {
      return (
        <div className={containerClass} style={style}>
          <div className="rclp-loading">Loading recipe...</div>
        </div>
      );
    }

    if (!recipeData) {
      return (
        <div className={containerClass} style={style}>
          <div className="rclp-error"><SectionIcon type="warning" /> No recipe definition loaded</div>
        </div>
      );
    }

    return (
      <div className={containerClass} style={style}>
        {this._renderHeader(recipeData)}
        {this._renderTags(recipeData.tags)}
        {this._renderPattern(recipeData.pattern)}
        {this._renderInputs(recipeData.inputs)}
        {this._renderOutput(recipeData.output)}
      </div>
    );
  }
}
