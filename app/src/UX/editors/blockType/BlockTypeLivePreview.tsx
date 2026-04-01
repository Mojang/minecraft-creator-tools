// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * BlockTypeLivePreview - Compact live preview component for block types
 *
 * ARCHITECTURE: This component provides a real-time preview of block definitions
 * that is designed to work in both:
 * - mctools.dev web application (as a sidebar or panel)
 * - VS Code extension webviews (as a live preview panel)
 *
 * It differs from the full BlockTypeEditor by being:
 * - Read-only and compact
 * - Focused on visualization, not editing
 * - Suitable for sidebar widths (200-400px)
 * - Optimized for quick scanning of block properties
 *
 * This component works directly with JSON data for simplicity and portability.
 */

import React, { Component } from "react";
import Log from "../../../core/Log";
import BlockComponentIcon from "./BlockComponentIcon";
import SectionIcon from "../../shared/components/icons/SectionIcon";
import "./BlockTypeLivePreview.css";
import CreatorToolsHost, { CreatorToolsThemeStyle } from "../../../app/CreatorToolsHost";

export interface IBlockTypeLivePreviewProps {
  /** Raw JSON data to preview */
  jsonData?: any;
  /** Block identifier for display */
  identifier?: string;
  /** Whether the theme is dark */
  darkTheme?: boolean;
  /** Callback when a component/state is clicked for navigation */
  onNavigate?: (path: string) => void;
  /** Max height (undefined = no limit) */
  maxHeight?: number;
  /** Whether to show validation issues */
  showValidation?: boolean;
}

/**
 * Parsed block data extracted from JSON
 */
interface ParsedBlockData {
  id: string;
  formatVersion: string;
  description: {
    identifier: string;
    menu_category?: any;
    states?: { [key: string]: any[] };
  };
  components: { [key: string]: any };
  permutations: Array<{ condition: string; components: { [key: string]: any } }>;
}

interface IBlockTypeLivePreviewState {
  isLoaded: boolean;
  blockData: ParsedBlockData | null;
  expandedSections: Set<string>;
}

/**
 * Compact property display for block characteristics
 */
interface PropertyItem {
  icon: React.ReactNode;
  label: string;
  value: string;
  color?: string;
}

export default class BlockTypeLivePreview extends Component<IBlockTypeLivePreviewProps, IBlockTypeLivePreviewState> {
  constructor(props: IBlockTypeLivePreviewProps) {
    super(props);

    this.state = {
      isLoaded: false,
      blockData: null,
      // All sections expanded by default for better visibility
      expandedSections: new Set(["properties", "states", "permutations", "components", "custom"]),
    };
  }

  componentDidMount(): void {
    this._loadDefinition();
  }

  componentDidUpdate(prevProps: IBlockTypeLivePreviewProps): void {
    if (prevProps.jsonData !== this.props.jsonData) {
      this._loadDefinition();
    }
  }

  private _loadDefinition(): void {
    try {
      if (!this.props.jsonData) {
        this.setState({ isLoaded: true, blockData: null });
        return;
      }

      // Parse the minecraft:block wrapper
      const block = this.props.jsonData["minecraft:block"];
      if (!block) {
        this.setState({ isLoaded: true, blockData: null });
        return;
      }

      const blockData: ParsedBlockData = {
        id: block.description?.identifier || this.props.identifier || "unknown",
        formatVersion: this.props.jsonData.format_version || "unknown",
        description: block.description || {},
        components: block.components || {},
        permutations: block.permutations || [],
      };

      this.setState({ isLoaded: true, blockData });
    } catch (error) {
      Log.debug(`BlockTypeLivePreview load error: ${error}`);
      this.setState({ isLoaded: true, blockData: null });
    }
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

  private _getBlockProperties(blockData: ParsedBlockData): PropertyItem[] {
    const props: PropertyItem[] = [];
    const components = blockData.components;
    const isLight = CreatorToolsHost.theme === CreatorToolsThemeStyle.light;

    // Geometry
    const geometry = components["minecraft:geometry"];
    if (geometry) {
      const geoId = typeof geometry === "string" ? geometry : geometry.identifier;
      if (geoId) {
        props.push({
          icon: <SectionIcon type="triangle" />,
          label: "Geometry",
          value: geoId.replace("geometry.", ""),
          color: isLight ? "#2577b0" : "#3498db",
        });
      }
    }

    // Light emission
    const lightEmission = components["minecraft:light_emission"];
    if (lightEmission !== undefined) {
      const emission = typeof lightEmission === "number" ? lightEmission : lightEmission.emission;
      if (emission !== undefined) {
        props.push({
          icon: <SectionIcon type="lightbulb" />,
          label: "Light",
          value: `${emission}`,
          color: isLight ? "#b8960a" : "#f1c40f",
        });
      }
    }

    // Destructible by mining
    const destructible = components["minecraft:destructible_by_mining"];
    if (destructible) {
      const seconds = typeof destructible === "object" ? destructible.seconds_to_destroy : undefined;
      if (seconds !== undefined) {
        props.push({
          icon: <SectionIcon type="block" />,
          label: "Break Time",
          value: `${seconds}s`,
          color: isLight ? "#c0392b" : "#e74c3c",
        });
      }
    }

    // Collision box
    const collision = components["minecraft:collision_box"];
    if (collision !== undefined) {
      const hasCollision = collision === true || (typeof collision === "object" && collision.origin);
      props.push({
        icon: <SectionIcon type="ruler" />,
        label: "Collision",
        value: collision === false ? "None" : hasCollision ? "Custom" : "Default",
        color: isLight ? "#7d3c98" : "#9b59b6",
      });
    }

    // Loot
    const loot = components["minecraft:loot"];
    if (loot) {
      const lootTable = typeof loot === "string" ? loot : loot.table;
      if (lootTable) {
        const shortName = lootTable.split("/").pop() || lootTable;
        props.push({
          icon: <SectionIcon type="chest" />,
          label: "Loot",
          value: shortName.replace(".json", ""),
          color: isLight ? "#1e8449" : "#27ae60",
        });
      }
    }

    return props;
  }

  private _renderHeader(blockData: ParsedBlockData): JSX.Element {
    const id = blockData.id;
    const shortId = id.includes(":") ? id.split(":")[1] : id;

    return (
      <div className="btlp-header">
        <BlockComponentIcon componentId="minecraft:unit_cube" size={24} />
        <div className="btlp-title">
          <div className="btlp-name">{this._toTitleCase(shortId)}</div>
          <div className="btlp-id">{id}</div>
        </div>
      </div>
    );
  }

  private _renderProperties(blockData: ParsedBlockData): JSX.Element | null {
    const props = this._getBlockProperties(blockData);
    if (props.length === 0) return null;

    const isExpanded = this.state.expandedSections.has("properties");

    return (
      <div className="btlp-section">
        <div className="btlp-section-header" onClick={() => this._toggleSection("properties")} onKeyDown={(e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); this._toggleSection("properties"); } }} role="button" tabIndex={0}>
          <span className="btlp-expand-icon">{isExpanded ? "▼" : "▶"}</span>
          <span>Properties</span>
          <span className="btlp-badge">{props.length}</span>
        </div>
        {isExpanded && (
          <div className="btlp-props-grid">
            {props.map((prop, index) => (
              <div key={index} className="btlp-prop" style={{ borderColor: prop.color }}>
                <span className="btlp-prop-icon">{prop.icon}</span>
                <span className="btlp-prop-value">{prop.value}</span>
                <span className="btlp-prop-label">{prop.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  private _renderStates(blockData: ParsedBlockData): JSX.Element | null {
    const states = blockData.description.states;
    const stateNames = states ? Object.keys(states) : [];
    if (stateNames.length === 0) return null;

    const isExpanded = this.state.expandedSections.has("states");

    return (
      <div className="btlp-section">
        <div className="btlp-section-header" onClick={() => this._toggleSection("states")} onKeyDown={(e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); this._toggleSection("states"); } }} role="button" tabIndex={0}>
          <span className="btlp-expand-icon">{isExpanded ? "▼" : "▶"}</span>
          <span><SectionIcon type="refresh" /> Block States</span>
          <span className="btlp-badge">{stateNames.length}</span>
        </div>
        {isExpanded && states && (
          <div className="btlp-state-list">
            {stateNames.map((state: string) => {
              const values = states[state];
              const valueStr = values
                ? values
                    .slice(0, 5)
                    .map((v: any) => String(v))
                    .join(", ") + (values.length > 5 ? "..." : "")
                : "";

              return (
                <div key={state} className="btlp-state-item">
                  <span className="btlp-state-name" onClick={() => this.props.onNavigate?.(`states/${state}`)}>
                    {state.replace(/^[^:]+:/, "")}
                  </span>
                  <span className="btlp-state-values">{valueStr}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  private _renderPermutations(blockData: ParsedBlockData): JSX.Element | null {
    const permutations = blockData.permutations;
    if (!permutations || permutations.length === 0) return null;

    const isExpanded = this.state.expandedSections.has("permutations");

    return (
      <div className="btlp-section">
        <div className="btlp-section-header" onClick={() => this._toggleSection("permutations")} onKeyDown={(e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); this._toggleSection("permutations"); } }} role="button" tabIndex={0}>
          <span className="btlp-expand-icon">{isExpanded ? "▼" : "▶"}</span>
          <span><SectionIcon type="gear" /> Permutations</span>
          <span className="btlp-badge">{permutations.length}</span>
        </div>
        {isExpanded && (
          <div className="btlp-perm-list">
            {permutations.slice(0, 10).map((perm: any, index: number) => (
              <div
                key={index}
                className="btlp-perm-item"
                onClick={() => this.props.onNavigate?.(`permutations/${index}`)}
              >
                <code className="btlp-perm-condition">{this._shortenCondition(perm.condition)}</code>
              </div>
            ))}
            {permutations.length > 10 && (
              <div className="btlp-perm-more">+{permutations.length - 10} more permutations</div>
            )}
          </div>
        )}
      </div>
    );
  }

  private _categorizeComponent(id: string): "visual" | "physics" | "behavior" | "other" {
    if (id.includes("geometry") || id.includes("material") || id.includes("light") || id.includes("display")) {
      return "visual";
    }
    if (id.includes("collision") || id.includes("selection") || id.includes("friction")) {
      return "physics";
    }
    if (
      id.includes("destructible") ||
      id.includes("flammable") ||
      id.includes("loot") ||
      id.includes("placement") ||
      id.includes("tick") ||
      id.includes("on_")
    ) {
      return "behavior";
    }
    return "other";
  }

  private _renderComponents(components: { [key: string]: any }): JSX.Element | null {
    const componentNames = Object.keys(components);
    if (componentNames.length === 0) return null;

    const isExpanded = this.state.expandedSections.has("components");

    // Categorize components
    const visual = componentNames.filter((c: string) => this._categorizeComponent(c) === "visual");
    const physics = componentNames.filter((c: string) => this._categorizeComponent(c) === "physics");
    const behavior = componentNames.filter((c: string) => this._categorizeComponent(c) === "behavior");
    const other = componentNames.filter(
      (c: string) => !visual.includes(c) && !physics.includes(c) && !behavior.includes(c)
    );

    return (
      <div className="btlp-section">
        <div className="btlp-section-header" onClick={() => this._toggleSection("components")} onKeyDown={(e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); this._toggleSection("components"); } }} role="button" tabIndex={0}>
          <span className="btlp-expand-icon">{isExpanded ? "▼" : "▶"}</span>
          <span><SectionIcon type="cube" /> Components</span>
          <span className="btlp-badge">{componentNames.length}</span>
        </div>
        {isExpanded && (
          <div className="btlp-component-list">
            {visual.length > 0 && (
              <div className="btlp-component-group">
                <div className="btlp-group-label">
                  <BlockComponentIcon componentId="minecraft:geometry" size={14} /> Visual ({visual.length})
                </div>
                <div className="btlp-tags">
                  {visual.map((comp: string) => (
                    <span
                      key={comp}
                      className="btlp-tag btlp-tag-visual btlp-clickable"
                      onClick={() => this.props.onNavigate?.(`components/${comp}`)}
                      title={`Go to ${comp}`}
                    >
                      <BlockComponentIcon componentId={comp} size={12} />
                      {this._shortenComponentName(comp)}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {physics.length > 0 && (
              <div className="btlp-component-group">
                <div className="btlp-group-label">
                  <BlockComponentIcon componentId="minecraft:collision_box" size={14} /> Physics ({physics.length})
                </div>
                <div className="btlp-tags">
                  {physics.map((comp: string) => (
                    <span
                      key={comp}
                      className="btlp-tag btlp-tag-physics btlp-clickable"
                      onClick={() => this.props.onNavigate?.(`components/${comp}`)}
                      title={`Go to ${comp}`}
                    >
                      <BlockComponentIcon componentId={comp} size={12} />
                      {this._shortenComponentName(comp)}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {behavior.length > 0 && (
              <div className="btlp-component-group">
                <div className="btlp-group-label">
                  <BlockComponentIcon componentId="minecraft:on_interact" size={14} /> Behavior ({behavior.length})
                </div>
                <div className="btlp-tags">
                  {behavior.map((comp: string) => (
                    <span
                      key={comp}
                      className="btlp-tag btlp-tag-behavior btlp-clickable"
                      onClick={() => this.props.onNavigate?.(`components/${comp}`)}
                      title={`Go to ${comp}`}
                    >
                      <BlockComponentIcon componentId={comp} size={12} />
                      {this._shortenComponentName(comp)}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {other.length > 0 && (
              <div className="btlp-component-group">
                <div className="btlp-group-label">
                  <BlockComponentIcon componentId="minecraft:unit_cube" size={14} /> Other ({other.length})
                </div>
                <div className="btlp-tags">
                  {other.slice(0, 10).map((comp: string) => (
                    <span
                      key={comp}
                      className="btlp-tag btlp-clickable"
                      onClick={() => this.props.onNavigate?.(`components/${comp}`)}
                      title={`Go to ${comp}`}
                    >
                      <BlockComponentIcon componentId={comp} size={12} />
                      {this._shortenComponentName(comp)}
                    </span>
                  ))}
                  {other.length > 10 && <span className="btlp-tag btlp-tag-more">+{other.length - 10} more</span>}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  private _renderCustomComponents(components: { [key: string]: any }): JSX.Element | null {
    const customComp = components["minecraft:custom_components"];
    if (!customComp) return null;

    const customList = Array.isArray(customComp) ? customComp : [];
    if (customList.length === 0) return null;

    const isExpanded = this.state.expandedSections.has("custom");

    return (
      <div className="btlp-section">
        <div className="btlp-section-header" onClick={() => this._toggleSection("custom")} onKeyDown={(e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); this._toggleSection("custom"); } }} role="button" tabIndex={0}>
          <span className="btlp-expand-icon">{isExpanded ? "▼" : "▶"}</span>
          <span><SectionIcon type="scroll" /> Custom Components</span>
          <span className="btlp-badge">{customList.length}</span>
        </div>
        {isExpanded && (
          <div className="btlp-tags">
            {customList.map((scriptId: string, index: number) => (
              <span
                key={index}
                className="btlp-tag btlp-tag-script"
                onClick={() => this.props.onNavigate?.(`custom_components/${scriptId}`)}
              >
                {scriptId}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  private _shortenComponentName(name: string): string {
    return name.replace(/^minecraft:/, "").replace(/_/g, " ");
  }

  private _shortenCondition(condition: string): string {
    // Truncate long conditions
    if (condition.length > 50) {
      return condition.substring(0, 47) + "...";
    }
    return condition;
  }

  private _toTitleCase(str: string): string {
    return str.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  render(): JSX.Element {
    const { darkTheme, maxHeight } = this.props;
    const { isLoaded, blockData } = this.state;

    const containerClass = `btlp-container ${darkTheme ? "btlp-dark" : "btlp-light"}`;
    const style: React.CSSProperties = maxHeight ? { maxHeight, overflowY: "auto" } : {};

    if (!isLoaded) {
      return (
        <div className={containerClass} style={style}>
          <div className="btlp-loading">Loading block...</div>
        </div>
      );
    }

    if (!blockData) {
      return (
        <div className={containerClass} style={style}>
          <div className="btlp-error"><SectionIcon type="warning" /> No block definition loaded</div>
        </div>
      );
    }

    return (
      <div className={containerClass} style={style}>
        {this._renderHeader(blockData)}
        {this._renderProperties(blockData)}
        {this._renderStates(blockData)}
        {this._renderPermutations(blockData)}
        {this._renderComponents(blockData.components)}
        {this._renderCustomComponents(blockData.components)}
      </div>
    );
  }
}
