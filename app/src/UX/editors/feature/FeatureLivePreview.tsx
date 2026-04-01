// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * FeatureLivePreview - Compact live preview for feature and feature rule definitions
 *
 * Shows feature structure including conditions, placement, and block configurations
 * in a hierarchical format with click-to-navigate support.
 */

import React, { Component } from "react";
import SectionIcon from "../../shared/components/icons/SectionIcon";
import "./FeatureLivePreview.css";

export interface IFeatureLivePreviewProps {
  jsonData?: any;
  identifier?: string;
  darkTheme?: boolean;
  onNavigate?: (path: string) => void;
  maxHeight?: number;
  isFeatureRule?: boolean;
}

interface FeatureCondition {
  placementPass?: string;
  biomeFilter?: any;
}

interface FeaturePlacement {
  type: string;
  count?: number | { min: number; max: number };
  x?: any;
  y?: any;
  z?: any;
  iterations?: number;
}

interface FeatureData {
  identifier: string;
  type: string;
  description?: string;
  conditions?: FeatureCondition;
  distribution?: FeaturePlacement;
  places?: string;
  blockConfigs?: Array<{ name: string; value: any }>;
  rawData?: any;
}

interface IFeatureLivePreviewState {
  isLoaded: boolean;
  featureData: FeatureData | null;
  expandedSections: Set<string>;
}

export default class FeatureLivePreview extends Component<IFeatureLivePreviewProps, IFeatureLivePreviewState> {
  constructor(props: IFeatureLivePreviewProps) {
    super(props);
    this.state = {
      isLoaded: false,
      featureData: null,
      expandedSections: new Set(["conditions", "distribution", "blocks", "config"]),
    };
  }

  componentDidMount(): void {
    this._loadDefinition();
  }

  componentDidUpdate(prevProps: IFeatureLivePreviewProps): void {
    if (prevProps.jsonData !== this.props.jsonData) {
      this._loadDefinition();
    }
  }

  private _loadDefinition(): void {
    try {
      if (!this.props.jsonData) {
        this.setState({ isLoaded: true, featureData: null });
        return;
      }

      const json = this.props.jsonData;

      // Check if this is a feature rule
      if (json["minecraft:feature_rules"]) {
        this._loadFeatureRule(json["minecraft:feature_rules"]);
        return;
      }

      // Otherwise, look for any minecraft:*_feature
      const featureTypes = [
        "minecraft:ore_feature",
        "minecraft:scatter_feature",
        "minecraft:tree_feature",
        "minecraft:aggregate_feature",
        "minecraft:sequence_feature",
        "minecraft:snap_to_surface_feature",
        "minecraft:surface_relative_threshold_feature",
        "minecraft:weighted_random_feature",
        "minecraft:cave_carver_feature",
        "minecraft:fossil_feature",
        "minecraft:geode_feature",
        "minecraft:growing_plant_feature",
        "minecraft:multiface_feature",
        "minecraft:nether_cave_carver_feature",
        "minecraft:partially_exposed_blob_feature",
        "minecraft:search_feature",
        "minecraft:single_block_feature",
        "minecraft:vegetation_patch_feature",
        "minecraft:structure_template_feature",
      ];

      for (const featureType of featureTypes) {
        if (json[featureType]) {
          this._loadFeature(featureType, json[featureType]);
          return;
        }
      }

      this.setState({ isLoaded: true, featureData: null });
    } catch {
      this.setState({ isLoaded: true, featureData: null });
    }
  }

  private _loadFeatureRule(rule: any): void {
    const desc = rule.description || {};
    const conditions = rule.conditions || {};
    const distribution = rule.distribution || {};

    const data: FeatureData = {
      identifier: desc.identifier || this.props.identifier || "unknown",
      type: "feature_rule",
      description: desc.description,
      conditions: {
        placementPass: conditions.placement_pass,
        biomeFilter: conditions.biome_filter,
      },
      distribution: this._parseDistribution(distribution),
      places: desc.places_feature,
      rawData: rule,
    };

    this.setState({ isLoaded: true, featureData: data });
  }

  private _loadFeature(featureType: string, feature: any): void {
    const desc = feature.description || {};
    const blockConfigs = this._extractBlockConfigs(feature);

    const data: FeatureData = {
      identifier: desc.identifier || this.props.identifier || "unknown",
      type: featureType.replace("minecraft:", ""),
      description: desc.description,
      blockConfigs,
      rawData: feature,
    };

    this.setState({ isLoaded: true, featureData: data });
  }

  private _parseDistribution(dist: any): FeaturePlacement | undefined {
    if (!dist) return undefined;

    return {
      type: dist.type || "uniform",
      count: dist.count,
      x: dist.x,
      y: dist.y,
      z: dist.z,
      iterations: dist.iterations,
    };
  }

  private _extractBlockConfigs(feature: any): Array<{ name: string; value: any }> {
    const configs: Array<{ name: string; value: any }> = [];
    const skipKeys = ["description", "format_version"];

    for (const [key, value] of Object.entries(feature)) {
      if (skipKeys.includes(key)) continue;
      if (typeof value === "object" && value !== null) {
        configs.push({ name: key, value });
      } else {
        configs.push({ name: key, value });
      }
    }

    return configs;
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

  private _getTypeIcon(type: string): React.ReactNode {
    if (type.includes("tree")) return <SectionIcon type="tree" />;
    if (type.includes("ore")) return <SectionIcon type="diamond" />;
    if (type.includes("scatter")) return <SectionIcon type="dice" />;
    if (type === "feature_rule") return <SectionIcon type="clipboard" />;
    return <SectionIcon type="tree" />;
  }

  private _renderHeader(): JSX.Element {
    const { featureData } = this.state;
    const identifier = featureData?.identifier || "Feature";
    const shortId = identifier.replace(/^minecraft:/, "").replace(/_/g, " ");

    return (
      <div className="flp-header">
        <div className="flp-icon">{this._getTypeIcon(featureData?.type || "")}</div>
        <div className="flp-title">
          <div className="flp-name">{this._toTitleCase(shortId)}</div>
          <div className="flp-id">{identifier}</div>
        </div>
        <div className="flp-type-badge">{featureData?.type?.replace(/_/g, " ")}</div>
      </div>
    );
  }

  private _renderConditions(): JSX.Element | null {
    const { featureData } = this.state;
    if (!featureData || !featureData.conditions) return null;

    const { placementPass, biomeFilter } = featureData.conditions;
    if (!placementPass && !biomeFilter) return null;

    const isExpanded = this.state.expandedSections.has("conditions");

    return (
      <div className="flp-section">
        <div className="flp-section-header" onClick={() => this._toggleSection("conditions")}>
          <span className="flp-expand-icon">{isExpanded ? "▼" : "▶"}</span>
          <span><SectionIcon type="check" /> Conditions</span>
        </div>
        {isExpanded && (
          <div className="flp-conditions">
            {placementPass && (
              <div
                className="flp-condition-item flp-clickable"
                onClick={() => this.props.onNavigate?.("minecraft:feature_rules/conditions/placement_pass")}
              >
                <span className="flp-cond-label">Placement Pass</span>
                <span className="flp-cond-value">{placementPass}</span>
              </div>
            )}
            {biomeFilter && (
              <div
                className="flp-condition-item flp-clickable"
                onClick={() => this.props.onNavigate?.("minecraft:feature_rules/conditions/biome_filter")}
              >
                <span className="flp-cond-icon"><SectionIcon type="globe" /></span>
                <span className="flp-cond-label">Biome Filter</span>
                <span className="flp-cond-value">{this._summarizeBiomeFilter(biomeFilter)}</span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  private _summarizeBiomeFilter(filter: any): string {
    if (Array.isArray(filter)) {
      return `${filter.length} condition(s)`;
    }
    if (filter.any_of) {
      return `any of ${filter.any_of.length}`;
    }
    if (filter.all_of) {
      return `all of ${filter.all_of.length}`;
    }
    if (filter.test) {
      return `${filter.test}: ${filter.value || ""}`;
    }
    return "configured";
  }

  private _renderDistribution(): JSX.Element | null {
    const { featureData } = this.state;
    if (!featureData || !featureData.distribution) return null;

    const dist = featureData.distribution;
    const isExpanded = this.state.expandedSections.has("distribution");

    return (
      <div className="flp-section">
        <div className="flp-section-header" onClick={() => this._toggleSection("distribution")}>
          <span className="flp-expand-icon">{isExpanded ? "▼" : "▶"}</span>
          <span><SectionIcon type="chart" /> Distribution</span>
        </div>
        {isExpanded && (
          <div className="flp-distribution">
            {dist.type && (
              <div className="flp-dist-item">
                <span className="flp-dist-label">Type</span>
                <span className="flp-dist-value">{dist.type}</span>
              </div>
            )}
            {dist.iterations && (
              <div className="flp-dist-item">
                <span className="flp-dist-label">Iterations</span>
                <span className="flp-dist-value">{dist.iterations}</span>
              </div>
            )}
            {dist.count && (
              <div className="flp-dist-item">
                <span className="flp-dist-label">Count</span>
                <span className="flp-dist-value">
                  {typeof dist.count === "object" ? `${dist.count.min}-${dist.count.max}` : dist.count}
                </span>
              </div>
            )}
            {dist.x && (
              <div className="flp-dist-item">
                <span className="flp-dist-label">X</span>
                <span className="flp-dist-value">{this._summarizeCoord(dist.x)}</span>
              </div>
            )}
            {dist.y && (
              <div className="flp-dist-item">
                <span className="flp-dist-label">Y</span>
                <span className="flp-dist-value">{this._summarizeCoord(dist.y)}</span>
              </div>
            )}
            {dist.z && (
              <div className="flp-dist-item">
                <span className="flp-dist-label">Z</span>
                <span className="flp-dist-value">{this._summarizeCoord(dist.z)}</span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  private _summarizeCoord(coord: any): string {
    if (typeof coord === "number") return String(coord);
    if (typeof coord === "object") {
      if (coord.extent) return `extent: ${JSON.stringify(coord.extent)}`;
      if (coord.distribution) return coord.distribution;
      return JSON.stringify(coord).substring(0, 30) + "...";
    }
    return String(coord);
  }

  private _renderPlaces(): JSX.Element | null {
    const { featureData } = this.state;
    if (!featureData || !featureData.places) return null;

    return (
      <div className="flp-places">
        <span className="flp-places-label"><SectionIcon type="tree" /> Places</span>
        <span className="flp-places-value">{featureData.places}</span>
      </div>
    );
  }

  private _renderBlockConfigs(): JSX.Element | null {
    const { featureData } = this.state;
    if (!featureData || !featureData.blockConfigs || featureData.blockConfigs.length === 0) {
      return null;
    }

    const isExpanded = this.state.expandedSections.has("config");

    return (
      <div className="flp-section">
        <div className="flp-section-header" onClick={() => this._toggleSection("config")}>
          <span className="flp-expand-icon">{isExpanded ? "▼" : "▶"}</span>
          <span><SectionIcon type="block" /> Configuration</span>
          <span className="flp-badge">{featureData.blockConfigs.length}</span>
        </div>
        {isExpanded && (
          <div className="flp-configs">
            {featureData.blockConfigs.map((config, idx) => (
              <div key={idx} className="flp-config-item">
                <span className="flp-config-name">{config.name}</span>
                <span className="flp-config-value">
                  {typeof config.value === "object" ? `{...}` : String(config.value).substring(0, 40)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  private _toTitleCase(str: string): string {
    return str.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  render(): JSX.Element {
    const { darkTheme, maxHeight } = this.props;
    const { isLoaded, featureData } = this.state;

    const containerClass = `flp-container ${darkTheme ? "flp-dark" : "flp-light"}`;
    const style: React.CSSProperties = maxHeight ? { maxHeight, overflowY: "auto" } : {};

    if (!isLoaded) {
      return (
        <div className={containerClass} style={style}>
          <div className="flp-loading">Loading feature...</div>
        </div>
      );
    }

    if (!featureData) {
      return (
        <div className={containerClass} style={style}>
          <div className="flp-error"><SectionIcon type="warning" /> No feature loaded</div>
        </div>
      );
    }

    return (
      <div className={containerClass} style={style}>
        {this._renderHeader()}
        {this._renderPlaces()}
        {this._renderConditions()}
        {this._renderDistribution()}
        {this._renderBlockConfigs()}
      </div>
    );
  }
}
