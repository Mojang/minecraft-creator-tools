// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * EntityTypeLivePreview - Compact live preview component for entity types
 *
 * ARCHITECTURE: This component provides a real-time preview of entity definitions
 * that is designed to work in both:
 * - mctools.dev web application (as a sidebar or panel)
 * - VS Code extension webviews (as a live preview panel)
 *
 * It differs from the full EntityTypeEditor by being:
 * - Read-only and compact
 * - Focused on visualization, not editing
 * - Suitable for sidebar widths (200-400px)
 * - Optimized for quick scanning of entity properties
 *
 * This component works directly with JSON data for simplicity and portability.
 * It doesn't require the full EntityTypeDefinition infrastructure.
 */

import React, { Component } from "react";
import Log from "../../../core/Log";
import ComponentIcon, { getComponentColor } from "../../shared/components/icons/ComponentIcon";
import SectionIcon from "../../shared/components/icons/SectionIcon";
import "./EntityTypeLivePreview.css";

// Component categorization
const BEHAVIORAL_COMPONENTS = [
  "minecraft:behavior.",
  "minecraft:attack",
  "minecraft:target",
  "minecraft:follow",
  "minecraft:navigation",
  "minecraft:pathfinding",
  "minecraft:angry",
  "minecraft:hurt_on_condition",
  "minecraft:raid",
  "minecraft:scheduler",
  "minecraft:timer",
  "minecraft:trust",
];

const PHYSICAL_COMPONENTS = [
  "minecraft:health",
  "minecraft:movement",
  "minecraft:collision_box",
  "minecraft:physics",
  "minecraft:pushable",
  "minecraft:knockback_resistance",
  "minecraft:fire_immune",
  "minecraft:breathable",
  "minecraft:burns_in_daylight",
  "minecraft:damage_sensor",
  "minecraft:flammable",
  "minecraft:flying_speed",
];

export interface IEntityTypeLivePreviewProps {
  /** Raw JSON data to preview */
  jsonData?: any;
  /** Entity identifier for display */
  identifier?: string;
  /** Whether the theme is dark */
  darkTheme?: boolean;
  /** Callback when a component/event is clicked for navigation */
  onNavigate?: (path: string) => void;
  /** Max height (undefined = no limit) */
  maxHeight?: number;
  /** Whether to show validation issues */
  showValidation?: boolean;
}

/**
 * Parsed entity data extracted from JSON
 */
interface ParsedEntityData {
  id: string;
  formatVersion: string;
  components: { [key: string]: any };
  componentGroups: { [key: string]: any };
  events: { [key: string]: any };
}

interface IEntityTypeLivePreviewState {
  isLoaded: boolean;
  entityData: ParsedEntityData | null;
  expandedSections: Set<string>;
}

/**
 * Compact stat display for numerical values
 */
interface StatItem {
  componentId: string;
  label: string;
  value: string | number;
  color?: string;
}

export default class EntityTypeLivePreview extends Component<IEntityTypeLivePreviewProps, IEntityTypeLivePreviewState> {
  constructor(props: IEntityTypeLivePreviewProps) {
    super(props);

    this.state = {
      isLoaded: false,
      entityData: null,
      // All sections expanded by default for better visibility
      expandedSections: new Set(["stats", "components", "events", "groups"]),
    };
  }

  componentDidMount(): void {
    this._loadDefinition();
  }

  componentDidUpdate(prevProps: IEntityTypeLivePreviewProps): void {
    // Reload if data changes
    if (prevProps.jsonData !== this.props.jsonData) {
      this._loadDefinition();
    }
  }

  private _loadDefinition(): void {
    try {
      if (!this.props.jsonData) {
        this.setState({ isLoaded: true, entityData: null });
        return;
      }

      // Parse the minecraft:entity wrapper
      const entity = this.props.jsonData["minecraft:entity"];
      if (!entity) {
        this.setState({ isLoaded: true, entityData: null });
        return;
      }

      const entityData: ParsedEntityData = {
        id: entity.description?.identifier || this.props.identifier || "unknown",
        formatVersion: this.props.jsonData.format_version || "unknown",
        components: entity.components || {},
        componentGroups: entity.component_groups || {},
        events: entity.events || {},
      };

      this.setState({ isLoaded: true, entityData });
    } catch (error) {
      Log.debug(`EntityTypeLivePreview load error: ${error}`);
      this.setState({ isLoaded: true, entityData: null });
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

  /**
   * Safely format a value that could be a primitive, range object, or other object.
   * Range objects have {range_min, range_max} structure (common in Minecraft entity definitions).
   */
  private _formatValue(value: any): string {
    if (value === null || value === undefined) {
      return "?";
    }
    if (typeof value === "number") {
      return Number.isInteger(value) ? String(value) : value.toFixed(2);
    }
    if (typeof value === "string") {
      return value;
    }
    if (typeof value === "boolean") {
      return value ? "Yes" : "No";
    }
    if (typeof value === "object") {
      // Handle range objects {range_min, range_max}
      if ("range_min" in value && "range_max" in value) {
        const min = this._formatValue(value.range_min);
        const max = this._formatValue(value.range_max);
        return `${min}-${max}`;
      }
      // Handle array ranges [min, max]
      if (Array.isArray(value) && value.length === 2) {
        return `${this._formatValue(value[0])}-${this._formatValue(value[1])}`;
      }
      // Fallback for other objects
      return JSON.stringify(value);
    }
    return String(value);
  }

  private _getEntityStats(components: { [key: string]: any }): StatItem[] {
    const stats: StatItem[] = [];

    // Health
    const health = components["minecraft:health"];
    if (health) {
      const healthRaw = typeof health === "object" ? (health.max ?? health.value ?? "?") : health;
      stats.push({
        componentId: "minecraft:health",
        label: "Health",
        value: this._formatValue(healthRaw),
        color: getComponentColor("minecraft:health"),
      });
    }

    // Attack damage
    const attack = components["minecraft:attack"];
    if (attack?.damage !== undefined) {
      stats.push({
        componentId: "minecraft:attack",
        label: "Attack",
        value: this._formatValue(attack.damage),
        color: getComponentColor("minecraft:attack"),
      });
    }

    // Movement speed
    const movement = components["minecraft:movement"];
    if (movement) {
      const speed = typeof movement === "object" ? movement.value : movement;
      if (speed !== undefined) {
        stats.push({
          componentId: "minecraft:movement",
          label: "Speed",
          value: this._formatValue(speed),
          color: getComponentColor("minecraft:movement"),
        });
      }
    }

    return stats;
  }

  private _renderHeader(entityData: ParsedEntityData): JSX.Element {
    const id = entityData.id;
    const shortId = id.includes(":") ? id.split(":")[1] : id;

    return (
      <div className="etlp-header">
        <ComponentIcon componentId="minecraft:spawn_entity" size={24} />
        <div className="etlp-title">
          <div className="etlp-name">{this._toTitleCase(shortId)}</div>
          <div className="etlp-id">{id}</div>
        </div>
      </div>
    );
  }

  private _renderStats(components: { [key: string]: any }): JSX.Element | null {
    const stats = this._getEntityStats(components);
    if (stats.length === 0) return null;

    const isExpanded = this.state.expandedSections.has("stats");

    return (
      <div className="etlp-section">
        <div className="etlp-section-header" onClick={() => this._toggleSection("stats")} onKeyDown={(e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); this._toggleSection("stats"); } }} role="button" tabIndex={0}>
          <span className="etlp-expand-icon">{isExpanded ? "▼" : "▶"}</span>
          <span><SectionIcon type="chart" /> Stats</span>
          <span className="etlp-badge">{stats.length}</span>
        </div>
        {isExpanded && (
          <div className="etlp-stats-grid">
            {stats.map((stat, index) => (
              <div
                key={index}
                className="etlp-stat etlp-clickable"
                style={{ borderColor: stat.color }}
                onClick={() => this.props.onNavigate?.(`components/${stat.componentId}`)}
                title={`Go to ${stat.componentId}`}
              >
                <span className="etlp-stat-icon">
                  <ComponentIcon componentId={stat.componentId} size={16} />
                </span>
                <span className="etlp-stat-value">{stat.value}</span>
                <span className="etlp-stat-label">{stat.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  private _categorizeComponent(comp: string): "behavioral" | "physical" | "other" {
    const compLower = comp.toLowerCase();
    if (BEHAVIORAL_COMPONENTS.some((b) => compLower.startsWith(b.toLowerCase()))) {
      return "behavioral";
    }
    if (PHYSICAL_COMPONENTS.some((p) => compLower.startsWith(p.toLowerCase()))) {
      return "physical";
    }
    return "other";
  }

  private _renderComponents(components: { [key: string]: any }): JSX.Element | null {
    const componentNames = Object.keys(components);
    if (componentNames.length === 0) return null;

    const isExpanded = this.state.expandedSections.has("components");

    // Group components by category
    const behavioral = componentNames.filter((c: string) => this._categorizeComponent(c) === "behavioral");
    const physical = componentNames.filter((c: string) => this._categorizeComponent(c) === "physical");
    const other = componentNames.filter((c: string) => !behavioral.includes(c) && !physical.includes(c));

    return (
      <div className="etlp-section">
        <div className="etlp-section-header" onClick={() => this._toggleSection("components")} onKeyDown={(e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); this._toggleSection("components"); } }} role="button" tabIndex={0}>
          <span className="etlp-expand-icon">{isExpanded ? "▼" : "▶"}</span>
          <span><SectionIcon type="cube" /> Components</span>
          <span className="etlp-badge">{componentNames.length}</span>
        </div>
        {isExpanded && (
          <div className="etlp-component-list">
            {behavioral.length > 0 && (
              <div className="etlp-component-group">
                <div className="etlp-group-label">
                  <ComponentIcon componentId="minecraft:behavior.random_stroll" size={14} /> Behaviors (
                  {behavioral.length})
                </div>
                <div className="etlp-tags">
                  {behavioral.slice(0, 10).map((comp: string) => (
                    <span
                      key={comp}
                      className="etlp-tag etlp-tag-behavior etlp-clickable"
                      onClick={() => this.props.onNavigate?.(`components/${comp}`)}
                      title={`Go to ${comp}`}
                    >
                      <ComponentIcon componentId={comp} size={12} />
                      {this._shortenComponentName(comp)}
                    </span>
                  ))}
                  {behavioral.length > 10 && (
                    <span className="etlp-tag etlp-tag-more">+{behavioral.length - 10} more</span>
                  )}
                </div>
              </div>
            )}
            {physical.length > 0 && (
              <div className="etlp-component-group">
                <div className="etlp-group-label">
                  <ComponentIcon componentId="minecraft:movement" size={14} /> Physical ({physical.length})
                </div>
                <div className="etlp-tags">
                  {physical.map((comp: string) => (
                    <span
                      key={comp}
                      className="etlp-tag etlp-tag-physical etlp-clickable"
                      onClick={() => this.props.onNavigate?.(`components/${comp}`)}
                      title={`Go to ${comp}`}
                    >
                      <ComponentIcon componentId={comp} size={12} />
                      {this._shortenComponentName(comp)}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {other.length > 0 && (
              <div className="etlp-component-group">
                <div className="etlp-group-label">
                  <ComponentIcon componentId="minecraft:type_family" size={14} /> Other ({other.length})
                </div>
                <div className="etlp-tags">
                  {other.slice(0, 15).map((comp: string) => (
                    <span
                      key={comp}
                      className="etlp-tag etlp-clickable"
                      onClick={() => this.props.onNavigate?.(`components/${comp}`)}
                      title={`Go to ${comp}`}
                    >
                      <ComponentIcon componentId={comp} size={12} />
                      {this._shortenComponentName(comp)}
                    </span>
                  ))}
                  {other.length > 15 && <span className="etlp-tag etlp-tag-more">+{other.length - 15} more</span>}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  private _renderEvents(events: { [key: string]: any }): JSX.Element | null {
    const eventNames = Object.keys(events);
    if (eventNames.length === 0) return null;

    const isExpanded = this.state.expandedSections.has("events");

    return (
      <div className="etlp-section">
        <div className="etlp-section-header" onClick={() => this._toggleSection("events")} onKeyDown={(e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); this._toggleSection("events"); } }} role="button" tabIndex={0}>
          <span className="etlp-expand-icon">{isExpanded ? "▼" : "▶"}</span>
          <span><SectionIcon type="lightning" /> Events</span>
          <span className="etlp-badge">{eventNames.length}</span>
        </div>
        {isExpanded && (
          <div className="etlp-tags etlp-event-list">
            {eventNames.slice(0, 20).map((evt: string) => (
              <span
                key={evt}
                className="etlp-tag etlp-tag-event etlp-clickable"
                onClick={() => this.props.onNavigate?.(`events/${evt}`)}
                title={`Go to event: ${evt}`}
              >
                {evt}
              </span>
            ))}
            {eventNames.length > 20 && <span className="etlp-tag etlp-tag-more">+{eventNames.length - 20} more</span>}
          </div>
        )}
      </div>
    );
  }

  private _renderComponentGroups(componentGroups: { [key: string]: any }): JSX.Element | null {
    const groupNames = Object.keys(componentGroups);
    if (groupNames.length === 0) return null;

    const isExpanded = this.state.expandedSections.has("groups");

    return (
      <div className="etlp-section">
        <div className="etlp-section-header" onClick={() => this._toggleSection("groups")} onKeyDown={(e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); this._toggleSection("groups"); } }} role="button" tabIndex={0}>
          <span className="etlp-expand-icon">{isExpanded ? "▼" : "▶"}</span>
          <span><SectionIcon type="folder" /> Component Groups</span>
          <span className="etlp-badge">{groupNames.length}</span>
        </div>
        {isExpanded && (
          <div className="etlp-tags">
            {groupNames.slice(0, 15).map((group: string) => (
              <span
                key={group}
                className="etlp-tag etlp-tag-group etlp-clickable"
                onClick={() => this.props.onNavigate?.(`component_groups/${group}`)}
                title={`Go to component group: ${group}`}
              >
                {group}
              </span>
            ))}
            {groupNames.length > 15 && <span className="etlp-tag etlp-tag-more">+{groupNames.length - 15} more</span>}
          </div>
        )}
      </div>
    );
  }

  private _shortenComponentName(name: string): string {
    // Remove minecraft: prefix and behavior. prefix for display
    return name
      .replace(/^minecraft:/, "")
      .replace(/^behavior\./, "")
      .replace(/_/g, " ");
  }

  private _toTitleCase(str: string): string {
    return str.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  render(): JSX.Element {
    const { darkTheme, maxHeight } = this.props;
    const { isLoaded, entityData } = this.state;

    const containerClass = `etlp-container ${darkTheme ? "etlp-dark" : "etlp-light"}`;
    const style: React.CSSProperties = maxHeight ? { maxHeight, overflowY: "auto" } : {};

    if (!isLoaded) {
      return (
        <div className={containerClass} style={style}>
          <div className="etlp-loading">Loading entity...</div>
        </div>
      );
    }

    if (!entityData) {
      return (
        <div className={containerClass} style={style}>
          <div className="etlp-error"><SectionIcon type="warning" /> No entity definition loaded</div>
        </div>
      );
    }

    return (
      <div className={containerClass} style={style}>
        {this._renderHeader(entityData)}
        {this._renderStats(entityData.components)}
        {this._renderComponents(entityData.components)}
        {this._renderEvents(entityData.events)}
        {this._renderComponentGroups(entityData.componentGroups)}
      </div>
    );
  }
}
