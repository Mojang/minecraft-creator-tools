// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * ItemTypeLivePreview - Compact live preview for item type definitions
 *
 * Shows item identifier, components, and events in a
 * table-of-contents style format with click-to-navigate support.
 * Uses SVG icons from /res/icons/item-components/ for components.
 */

import React, { Component } from "react";
import CreatorToolsHost from "../../../app/CreatorToolsHost";
import "./ItemTypeLivePreview.css";

// Icon paths - use contentWebRoot for Electron compatibility
// Note: These use functions to get the current contentWebRoot value
function getIconBasePath(): string {
  return CreatorToolsHost.contentWebRoot + "res/icons";
}

function getItemTypeIcon(): string {
  return getIconBasePath() + "/itemtypes/item-type-behavior.svg";
}

function getComponentIconPath(): string {
  return getIconBasePath() + "/item-components";
}

function getSectionIcons(): { component: string; event: string } {
  return {
    component: getComponentIconPath() + "/component.svg",
    event: getIconBasePath() + "/itemtypes/animation.svg",
  };
}

// Component name to SVG filename mapping
const COMPONENT_ICONS: Record<string, string> = {
  durability: "minecraft_durability.svg",
  food: "minecraft_food.svg",
  weapon: "minecraft_weapon.svg",
  damage: "minecraft_damage.svg",
  digger: "minecraft_digger.svg",
  throwable: "minecraft_throwable.svg",
  wearable: "minecraft_wearable.svg",
  cooldown: "minecraft_cooldown.svg",
  enchantable: "minecraft_enchantable.svg",
  repairable: "minecraft_repairable.svg",
  record: "minecraft_record.svg",
  shooter: "minecraft_shooter.svg",
  projectile: "minecraft_projectile.svg",
  fuel: "minecraft_fuel.svg",
  glint: "minecraft_glint.svg",
  hand_equipped: "minecraft_hand_equipped.svg",
  max_stack_size: "minecraft_max_stack_size.svg",
  allow_off_hand: "minecraft_allow_off_hand.svg",
  icon: "minecraft_icon.svg",
  display_name: "minecraft_display_name.svg",
  creative_category: "minecraft_creative_category.svg",
  hover_text_color: "minecraft_hover_text_color.svg",
  interact_button: "minecraft_interact_button.svg",
  liquid_clipped: "minecraft_liquid_clipped.svg",
  should_despawn: "minecraft_should_despawn.svg",
  stacked_by_data: "minecraft_stacked_by_data.svg",
  use_animation: "minecraft_use_animation.svg",
  use_duration: "minecraft_use_duration.svg",
  entity_placer: "minecraft_entity_placer.svg",
  block_placer: "minecraft_block_placer.svg",
  storage_item: "minecraft_storage_item.svg",
  item_name: "minecraft_item_name.svg",
  custom_components: "minecraft_custom_components.svg",
  bundle_interaction: "minecraft_bundle_interaction.svg",
  damage_absorption: "minecraft_damage_absorption.svg",
  can_destroy_in_creative: "minecraft_can_destroy_in_creative.svg",
  armor: "minecraft_armor.svg",
  tags: "minecraft_tags.svg",
  use_modifiers: "minecraft_use_modifiers.svg",
};

export interface IItemTypeLivePreviewProps {
  jsonData?: any;
  identifier?: string;
  darkTheme?: boolean;
  onNavigate?: (path: string) => void;
  maxHeight?: number;
}

interface ParsedComponent {
  name: string;
  shortName: string;
  iconPath: string;
  hasData: boolean;
  summary?: string;
}

interface ParsedItemData {
  formatVersion: string;
  identifier: string;
  category?: string;
  menuCategory?: { category: string; group?: string };
  components: ParsedComponent[];
  events: string[];
}

interface IItemTypeLivePreviewState {
  isLoaded: boolean;
  itemData: ParsedItemData | null;
  expandedSections: Set<string>;
}

export default class ItemTypeLivePreview extends Component<IItemTypeLivePreviewProps, IItemTypeLivePreviewState> {
  constructor(props: IItemTypeLivePreviewProps) {
    super(props);
    this.state = {
      isLoaded: false,
      itemData: null,
      expandedSections: new Set(["components", "events"]),
    };
  }

  componentDidMount(): void {
    this._loadDefinition();
  }

  componentDidUpdate(prevProps: IItemTypeLivePreviewProps): void {
    if (prevProps.jsonData !== this.props.jsonData) {
      this._loadDefinition();
    }
  }

  private _loadDefinition(): void {
    try {
      if (!this.props.jsonData) {
        this.setState({ isLoaded: true, itemData: null });
        return;
      }

      const json = this.props.jsonData;
      const itemData = json["minecraft:item"];

      if (!itemData) {
        this.setState({ isLoaded: true, itemData: null });
        return;
      }

      const description = itemData.description || {};
      const components = itemData.components || {};
      const events = itemData.events || {};

      const parsed: ParsedItemData = {
        formatVersion: json.format_version || "unknown",
        identifier: description.identifier || this.props.identifier || "unknown",
        category: description.category,
        menuCategory: description.menu_category,
        components: this._parseComponents(components),
        events: Object.keys(events),
      };

      this.setState({ isLoaded: true, itemData: parsed });
    } catch {
      this.setState({ isLoaded: true, itemData: null });
    }
  }

  private _parseComponents(components: Record<string, any>): ParsedComponent[] {
    const result: ParsedComponent[] = [];

    for (const [name, value] of Object.entries(components)) {
      const shortName = name.replace(/^minecraft:/, "");
      const iconPath = this._getComponentIconPath(shortName);
      const summary = this._getComponentSummary(shortName, value);

      result.push({
        name,
        shortName,
        iconPath,
        hasData: value !== null && value !== undefined && typeof value === "object" && Object.keys(value).length > 0,
        summary,
      });
    }

    return result;
  }

  private _getComponentIconPath(shortName: string): string {
    const iconFile = COMPONENT_ICONS[shortName];
    if (iconFile) {
      return `${getComponentIconPath()}/${iconFile}`;
    }
    // Fallback to generic component icon
    return `${getComponentIconPath()}/component.svg`;
  }

  private _getComponentSummary(shortName: string, value: any): string | undefined {
    if (!value || typeof value !== "object") {
      if (typeof value === "boolean") return value ? "enabled" : "disabled";
      if (typeof value === "number") return String(value);
      return undefined;
    }

    switch (shortName) {
      case "durability":
        return value.max_durability ? `max: ${value.max_durability}` : undefined;
      case "food":
        return value.nutrition ? `nutrition: ${value.nutrition}` : undefined;
      case "max_stack_size":
        return String(value);
      case "cooldown":
        return value.duration ? `${value.duration}s` : undefined;
      case "enchantable":
        return value.slot ? `slot: ${value.slot}` : undefined;
      case "damage":
        return value.value !== undefined ? `damage: ${value.value}` : undefined;
      default:
        return undefined;
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

  private _toTitleCase(str: string): string {
    return str.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  private _renderHeader(data: ParsedItemData): JSX.Element {
    const shortId = data.identifier.includes(":") ? data.identifier.split(":")[1] : data.identifier;

    return (
      <div className="itlp-header">
        <img src={getItemTypeIcon()} alt="Item" className="itlp-icon" />
        <div className="itlp-title">
          <div className="itlp-name">{this._toTitleCase(shortId)}</div>
          <div className="itlp-id">{data.identifier}</div>
        </div>
      </div>
    );
  }

  private _renderMetadata(data: ParsedItemData): JSX.Element {
    const hasMenuCategory = data.menuCategory && data.menuCategory.category;

    return (
      <div className="itlp-meta">
        <div className="itlp-meta-row">
          <span className="itlp-meta-label">Format:</span>
          <span className="itlp-meta-value">{data.formatVersion}</span>
        </div>
        {data.category && (
          <div className="itlp-meta-row">
            <span className="itlp-meta-label">Category:</span>
            <span className="itlp-meta-value">{data.category}</span>
          </div>
        )}
        {hasMenuCategory && (
          <div className="itlp-meta-row">
            <span className="itlp-meta-label">Menu:</span>
            <span className="itlp-meta-value">
              {data.menuCategory!.category}
              {data.menuCategory!.group && ` / ${data.menuCategory!.group}`}
            </span>
          </div>
        )}
      </div>
    );
  }

  private _renderComponents(components: ParsedComponent[]): JSX.Element | null {
    if (components.length === 0) return null;

    const isExpanded = this.state.expandedSections.has("components");

    return (
      <div className="itlp-section">
        <div className="itlp-section-header" onClick={() => this._toggleSection("components")} onKeyDown={(e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); this._toggleSection("components"); } }} role="button" tabIndex={0}>
          <span className="itlp-toggle">{isExpanded ? "▼" : "▶"}</span>
          <img src={getSectionIcons().component} alt="Components section" className="itlp-section-icon" />
          <span className="itlp-section-title">Components</span>
          <span className="itlp-count">{components.length}</span>
        </div>
        {isExpanded && (
          <div className="itlp-section-content">
            {components.map((comp, index) => (
              <div
                key={index}
                className="itlp-component-item"
                onClick={() => this.props.onNavigate?.(`minecraft:item.components.${comp.name}`)}
              >
                <img src={comp.iconPath} alt={comp.shortName || "Component icon"} className="itlp-component-icon" />
                <span className="itlp-component-name">{comp.shortName}</span>
                {comp.summary && <span className="itlp-component-summary">{comp.summary}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  private _renderEvents(events: string[]): JSX.Element | null {
    if (events.length === 0) return null;

    const isExpanded = this.state.expandedSections.has("events");

    return (
      <div className="itlp-section">
        <div className="itlp-section-header" onClick={() => this._toggleSection("events")} onKeyDown={(e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); this._toggleSection("events"); } }} role="button" tabIndex={0}>
          <span className="itlp-toggle">{isExpanded ? "▼" : "▶"}</span>
          <img src={getSectionIcons().event} alt="Events section" className="itlp-section-icon" />
          <span className="itlp-section-title">Events</span>
          <span className="itlp-count">{events.length}</span>
        </div>
        {isExpanded && (
          <div className="itlp-section-content">
            {events.map((event, index) => (
              <div
                key={index}
                className="itlp-event-item"
                onClick={() => this.props.onNavigate?.(`minecraft:item.events.${event}`)}
              >
                <img src={getSectionIcons().event} alt="Event icon" className="itlp-event-icon" />
                <span className="itlp-event-name">{event}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  render(): JSX.Element {
    const { darkTheme, maxHeight } = this.props;
    const { isLoaded, itemData } = this.state;

    const containerClass = `itlp-container ${darkTheme ? "itlp-dark" : "itlp-light"}`;
    const style = maxHeight ? { maxHeight: `${maxHeight}px` } : undefined;

    if (!isLoaded) {
      return (
        <div className={containerClass} style={style}>
          <div className="itlp-loading">Loading item definition...</div>
        </div>
      );
    }

    if (!itemData) {
      return (
        <div className={containerClass} style={style}>
          <div className="itlp-error">
            <span className="itlp-error-icon">⚠️</span>
            <span>No item definition loaded</span>
          </div>
        </div>
      );
    }

    return (
      <div className={containerClass} style={style}>
        {this._renderHeader(itemData)}
        {this._renderMetadata(itemData)}
        <div className="itlp-sections">
          {this._renderComponents(itemData.components)}
          {this._renderEvents(itemData.events)}
        </div>
      </div>
    );
  }
}
