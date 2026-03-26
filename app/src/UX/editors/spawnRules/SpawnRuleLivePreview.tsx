// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * SpawnRuleLivePreview - Compact live preview for spawn rule definitions
 *
 * Shows spawn conditions, populations, biomes, and filters in a hierarchical
 * table-of-contents style format with click-to-navigate support.
 */

import React, { Component } from "react";
import SectionIcon from "../../shared/components/icons/SectionIcon";
import "./SpawnRuleLivePreview.css";

export interface ISpawnRuleLivePreviewProps {
  jsonData?: any;
  identifier?: string;
  darkTheme?: boolean;
  onNavigate?: (path: string) => void;
  maxHeight?: number;
}

interface SpawnCondition {
  type: string;
  value?: any;
  operator?: string;
  min?: number;
  max?: number;
}

interface PopulationControl {
  poolLimit?: number;
  density?: number;
  weight?: number;
  herdSize?: { min: number; max: number };
}

interface ParsedSpawnData {
  entityId: string;
  conditions: SpawnCondition[];
  population: PopulationControl;
  biomeFilters: string[];
  brightnessFilter?: { min: number; max: number };
  heightFilter?: { min: number; max: number };
  delayRange?: { min: number; max: number };
}

interface ISpawnRuleLivePreviewState {
  isLoaded: boolean;
  spawnData: ParsedSpawnData | null;
  expandedSections: Set<string>;
}

export default class SpawnRuleLivePreview extends Component<ISpawnRuleLivePreviewProps, ISpawnRuleLivePreviewState> {
  constructor(props: ISpawnRuleLivePreviewProps) {
    super(props);
    this.state = {
      isLoaded: false,
      spawnData: null,
      expandedSections: new Set(["conditions", "population", "biomes"]),
    };
  }

  componentDidMount(): void {
    this._loadDefinition();
  }

  componentDidUpdate(prevProps: ISpawnRuleLivePreviewProps): void {
    if (prevProps.jsonData !== this.props.jsonData) {
      this._loadDefinition();
    }
  }

  private _loadDefinition(): void {
    try {
      if (!this.props.jsonData) {
        this.setState({ isLoaded: true, spawnData: null });
        return;
      }

      const json = this.props.jsonData;
      const spawnRules = json["minecraft:spawn_rules"];
      if (!spawnRules) {
        this.setState({ isLoaded: true, spawnData: null });
        return;
      }

      const desc = spawnRules.description || {};
      const conditions: SpawnCondition[] = [];
      const biomeFilters: string[] = [];
      let brightnessFilter: { min: number; max: number } | undefined;
      let heightFilter: { min: number; max: number } | undefined;
      let delayRange: { min: number; max: number } | undefined;
      const population: PopulationControl = {};

      // Parse conditions array
      const conditionsArray = spawnRules.conditions || [];
      for (const cond of conditionsArray) {
        // Brightness filter
        if (cond["minecraft:brightness_filter"]) {
          const bf = cond["minecraft:brightness_filter"];
          brightnessFilter = { min: bf.min || 0, max: bf.max || 15 };
          conditions.push({ type: "brightness", min: bf.min, max: bf.max });
        }
        // Height filter
        if (cond["minecraft:height_filter"]) {
          const hf = cond["minecraft:height_filter"];
          heightFilter = { min: hf.min || 0, max: hf.max || 256 };
          conditions.push({ type: "height", min: hf.min, max: hf.max });
        }
        // Weight
        if (cond["minecraft:weight"]) {
          const w = cond["minecraft:weight"];
          population.weight = w.default || w;
        }
        // Density limit
        if (cond["minecraft:density_limit"]) {
          const dl = cond["minecraft:density_limit"];
          population.density = dl.surface || dl.underground || 0;
        }
        // Herd
        if (cond["minecraft:herd"]) {
          const h = cond["minecraft:herd"];
          population.herdSize = { min: h.min_size || 1, max: h.max_size || 1 };
        }
        // Biome filter
        if (cond["minecraft:biome_filter"]) {
          const bf = cond["minecraft:biome_filter"];
          this._extractBiomes(bf, biomeFilters);
        }
        // Delay range
        if (cond["minecraft:delay_spawns"]) {
          const ds = cond["minecraft:delay_spawns"];
          delayRange = { min: ds.min || 0, max: ds.max || 0 };
        }
        // Spawns on surface/underwater/etc
        if (cond["minecraft:spawns_on_surface"]) {
          conditions.push({ type: "surface", value: true });
        }
        if (cond["minecraft:spawns_underground"]) {
          conditions.push({ type: "underground", value: true });
        }
        if (cond["minecraft:spawns_underwater"]) {
          conditions.push({ type: "underwater", value: true });
        }
        if (cond["minecraft:spawns_on_block_filter"]) {
          const blocks = cond["minecraft:spawns_on_block_filter"];
          conditions.push({ type: "spawns_on_block", value: Array.isArray(blocks) ? blocks.join(", ") : blocks });
        }
        if (cond["minecraft:spawns_lava"]) {
          conditions.push({ type: "lava", value: true });
        }
        if (cond["minecraft:difficulty_filter"]) {
          const df = cond["minecraft:difficulty_filter"];
          conditions.push({ type: "difficulty", min: df.min, max: df.max });
        }
      }

      const parsed: ParsedSpawnData = {
        entityId: desc.identifier || this.props.identifier || "unknown",
        conditions,
        population,
        biomeFilters,
        brightnessFilter,
        heightFilter,
        delayRange,
      };

      this.setState({ isLoaded: true, spawnData: parsed });
    } catch {
      this.setState({ isLoaded: true, spawnData: null });
    }
  }

  private _extractBiomes(filter: any, biomes: string[]): void {
    if (!filter) return;
    if (Array.isArray(filter)) {
      filter.forEach((f) => this._extractBiomes(f, biomes));
    } else if (filter.any_of) {
      filter.any_of.forEach((f: any) => this._extractBiomes(f, biomes));
    } else if (filter.all_of) {
      filter.all_of.forEach((f: any) => this._extractBiomes(f, biomes));
    } else if (filter.test === "has_biome_tag" || filter.test === "is_biome") {
      biomes.push(filter.value || "unknown");
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

  private _shortenName(name: string): string {
    if (!name) return "unknown";
    return name.replace(/^minecraft:/, "").replace(/_/g, " ");
  }

  private _getConditionIcon(type: string): React.ReactNode {
    switch (type) {
      case "brightness":
        return <SectionIcon type="sun" />;
      case "height":
        return <SectionIcon type="ruler" />;
      case "surface":
        return <SectionIcon type="tree" />;
      case "underground":
        return <SectionIcon type="diamond" />;
      case "underwater":
        return <SectionIcon type="globe" />;
      case "lava":
        return <SectionIcon type="flame" />;
      case "difficulty":
        return <SectionIcon type="warning" />;
      case "spawns_on_block":
        return <SectionIcon type="block" />;
      default:
        return <SectionIcon type="check" />;
    }
  }

  private _renderHeader(): JSX.Element {
    const { spawnData } = this.state;
    const entityId = spawnData?.entityId || "Spawn Rule";
    const shortId = this._shortenName(entityId);

    return (
      <div className="srlp-header">
        <div className="srlp-icon"><SectionIcon type="egg" /></div>
        <div className="srlp-title">
          <div className="srlp-name">{this._toTitleCase(shortId)}</div>
          <div className="srlp-id">{entityId}</div>
        </div>
      </div>
    );
  }

  private _renderConditions(): JSX.Element | null {
    const { spawnData } = this.state;
    if (!spawnData || spawnData.conditions.length === 0) return null;

    const isExpanded = this.state.expandedSections.has("conditions");

    return (
      <div className="srlp-section">
        <div className="srlp-section-header" onClick={() => this._toggleSection("conditions")}>
          <span className="srlp-expand-icon">{isExpanded ? "▼" : "▶"}</span>
          <span><SectionIcon type="check" /> Conditions</span>
          <span className="srlp-badge">{spawnData.conditions.length}</span>
        </div>
        {isExpanded && (
          <div className="srlp-conditions">
            {spawnData.conditions.map((cond, idx) => (
              <div
                key={idx}
                className="srlp-condition ltlp-clickable"
                onClick={() => this.props.onNavigate?.(`minecraft:spawn_rules/conditions/${idx}`)}
                title={`Go to condition ${idx}`}
              >
                <span className="srlp-condition-icon">{this._getConditionIcon(cond.type)}</span>
                <span className="srlp-condition-name">{this._toTitleCase(cond.type)}</span>
                {cond.min !== undefined && cond.max !== undefined && (
                  <span className="srlp-condition-range">
                    {cond.min} - {cond.max}
                  </span>
                )}
                {cond.value !== undefined && typeof cond.value === "boolean" && (
                  <span className="srlp-condition-value">✓</span>
                )}
                {cond.value !== undefined && typeof cond.value === "string" && (
                  <span className="srlp-condition-value">{cond.value}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  private _renderPopulation(): JSX.Element | null {
    const { spawnData } = this.state;
    if (!spawnData) return null;

    const pop = spawnData.population;
    const hasData = pop.weight !== undefined || pop.density !== undefined || pop.herdSize !== undefined;
    if (!hasData) return null;

    const isExpanded = this.state.expandedSections.has("population");

    return (
      <div className="srlp-section">
        <div className="srlp-section-header" onClick={() => this._toggleSection("population")}>
          <span className="srlp-expand-icon">{isExpanded ? "▼" : "▶"}</span>
          <span><SectionIcon type="person" /> Population Control</span>
        </div>
        {isExpanded && (
          <div className="srlp-population">
            {pop.weight !== undefined && (
              <div className="srlp-pop-item">
                <span className="srlp-pop-icon"><SectionIcon type="scale" /></span>
                <span className="srlp-pop-label">Weight</span>
                <span className="srlp-pop-value">{pop.weight}</span>
              </div>
            )}
            {pop.density !== undefined && (
              <div className="srlp-pop-item">
                <span className="srlp-pop-icon"><SectionIcon type="chart" /></span>
                <span className="srlp-pop-label">Density Limit</span>
                <span className="srlp-pop-value">{pop.density}</span>
              </div>
            )}
            {pop.herdSize && (
              <div className="srlp-pop-item">
                <span className="srlp-pop-icon"><SectionIcon type="herd" /></span>
                <span className="srlp-pop-label">Herd Size</span>
                <span className="srlp-pop-value">
                  {pop.herdSize.min} - {pop.herdSize.max}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  private _renderBiomes(): JSX.Element | null {
    const { spawnData } = this.state;
    if (!spawnData || spawnData.biomeFilters.length === 0) return null;

    const isExpanded = this.state.expandedSections.has("biomes");

    return (
      <div className="srlp-section">
        <div className="srlp-section-header" onClick={() => this._toggleSection("biomes")}>
          <span className="srlp-expand-icon">{isExpanded ? "▼" : "▶"}</span>
          <span><SectionIcon type="globe" /> Biome Filters</span>
          <span className="srlp-badge">{spawnData.biomeFilters.length}</span>
        </div>
        {isExpanded && (
          <div className="srlp-biomes">
            {spawnData.biomeFilters.map((biome, idx) => (
              <div key={idx} className="srlp-biome">
                <span className="srlp-biome-icon"><SectionIcon type="globe" /></span>
                <span className="srlp-biome-name">{this._shortenName(biome)}</span>
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
    const { isLoaded, spawnData } = this.state;

    const containerClass = `srlp-container ${darkTheme ? "srlp-dark" : "srlp-light"}`;
    const style: React.CSSProperties = maxHeight ? { maxHeight, overflowY: "auto" } : {};

    if (!isLoaded) {
      return (
        <div className={containerClass} style={style}>
          <div className="srlp-loading">Loading spawn rule...</div>
        </div>
      );
    }

    if (!spawnData) {
      return (
        <div className={containerClass} style={style}>
          <div className="srlp-error"><SectionIcon type="warning" /> No spawn rule loaded</div>
        </div>
      );
    }

    return (
      <div className={containerClass} style={style}>
        {this._renderHeader()}
        {this._renderConditions()}
        {this._renderPopulation()}
        {this._renderBiomes()}
      </div>
    );
  }
}
