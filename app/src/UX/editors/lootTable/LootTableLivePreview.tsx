// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * LootTableLivePreview - Compact live preview for loot table definitions
 *
 * Shows pools, entries, conditions, and functions in a hierarchical
 * table-of-contents style format with click-to-navigate support.
 */

import React, { Component } from "react";
import SectionIcon from "../../shared/components/icons/SectionIcon";
import "./LootTableLivePreview.css";

export interface ILootTableLivePreviewProps {
  jsonData?: any;
  identifier?: string;
  darkTheme?: boolean;
  onNavigate?: (path: string) => void;
  maxHeight?: number;
}

interface LootEntry {
  type: string;
  name?: string;
  weight?: number;
  functions?: any[];
  conditions?: any[];
}

interface LootPool {
  rolls: number | { min: number; max: number };
  entries: LootEntry[];
  conditions?: any[];
}

interface ParsedLootTableData {
  pools: LootPool[];
}

interface ILootTableLivePreviewState {
  isLoaded: boolean;
  lootData: ParsedLootTableData | null;
  expandedSections: Set<string>;
}

export default class LootTableLivePreview extends Component<ILootTableLivePreviewProps, ILootTableLivePreviewState> {
  constructor(props: ILootTableLivePreviewProps) {
    super(props);
    this.state = {
      isLoaded: false,
      lootData: null,
      expandedSections: new Set(["pools"]),
    };
  }

  componentDidMount(): void {
    this._loadDefinition();
  }

  componentDidUpdate(prevProps: ILootTableLivePreviewProps): void {
    if (prevProps.jsonData !== this.props.jsonData) {
      this._loadDefinition();
    }
  }

  private _loadDefinition(): void {
    try {
      if (!this.props.jsonData) {
        this.setState({ isLoaded: true, lootData: null });
        return;
      }

      const json = this.props.jsonData;
      const pools = json.pools || [];

      const parsed: ParsedLootTableData = {
        pools: pools.map((pool: any) => ({
          rolls: pool.rolls || 1,
          entries: (pool.entries || []).map((entry: any) => ({
            type: entry.type || "item",
            name: entry.name,
            weight: entry.weight,
            functions: entry.functions,
            conditions: entry.conditions,
          })),
          conditions: pool.conditions,
        })),
      };

      this.setState({ isLoaded: true, lootData: parsed });
    } catch {
      this.setState({ isLoaded: true, lootData: null });
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

  private _getRollsText(rolls: number | { min: number; max: number }): string {
    if (typeof rolls === "number") {
      return `${rolls} roll${rolls !== 1 ? "s" : ""}`;
    }
    return `${rolls.min}-${rolls.max} rolls`;
  }

  private _shortenItemName(name: string): string {
    if (!name) return "unknown";
    return name
      .replace(/^minecraft:/, "")
      .replace(/^loot_tables\//, "")
      .replace(/_/g, " ");
  }

  private _getEntryTypeIcon(type: string): React.ReactNode {
    switch (type) {
      case "item":
        return <SectionIcon type="gift" />;
      case "loot_table":
        return <SectionIcon type="clipboard" />;
      case "empty":
        return <SectionIcon type="error" />;
      default:
        return <SectionIcon type="cube" />;
    }
  }

  private _renderHeader(): JSX.Element {
    const identifier = this.props.identifier || "Loot Table";
    const shortId = identifier.includes("/") ? identifier.split("/").pop() : identifier;

    return (
      <div className="ltlp-header">
        <div className="ltlp-icon"><SectionIcon type="pool" /></div>
        <div className="ltlp-title">
          <div className="ltlp-name">{this._toTitleCase(shortId?.replace(".json", "") || "")}</div>
          <div className="ltlp-id">{identifier}</div>
        </div>
      </div>
    );
  }

  private _renderPools(pools: LootPool[]): JSX.Element {
    if (pools.length === 0) {
      return (
        <div style={{ padding: "12px", textAlign: "center" }}>
          <em style={{ opacity: 0.6 }}>No loot pools yet</em>
        </div>
      );
    }

    const isExpanded = this.state.expandedSections.has("pools");

    return (
      <div className="ltlp-section">
        <div className="ltlp-section-header" onClick={() => this._toggleSection("pools")}>
          <span className="ltlp-expand-icon">{isExpanded ? "▼" : "▶"}</span>
          <span><SectionIcon type="pool" /> Pools</span>
          <span className="ltlp-badge">{pools.length}</span>
        </div>
        {isExpanded && (
          <div className="ltlp-pools">{pools.map((pool, poolIndex) => this._renderPool(pool, poolIndex))}</div>
        )}
      </div>
    );
  }

  private _renderPool(pool: LootPool, poolIndex: number): JSX.Element {
    const poolKey = `pool-${poolIndex}`;
    const isExpanded = this.state.expandedSections.has(poolKey);

    return (
      <div key={poolIndex} className="ltlp-pool">
        <div
          className="ltlp-pool-header ltlp-clickable"
          onClick={() => {
            this._toggleSection(poolKey);
            this.props.onNavigate?.(`pools/${poolIndex}`);
          }}
          title={`Go to pool ${poolIndex}`}
        >
          <span className="ltlp-expand-icon">{isExpanded ? "▼" : "▶"}</span>
          <span className="ltlp-pool-name">Pool {poolIndex + 1}</span>
          <span className="ltlp-pool-rolls">{this._getRollsText(pool.rolls)}</span>
          <span className="ltlp-pool-entries">{pool.entries.length} entries</span>
        </div>
        {isExpanded && (
          <div className="ltlp-entries">
            {pool.entries.map((entry, entryIndex) => this._renderEntry(entry, poolIndex, entryIndex))}
          </div>
        )}
      </div>
    );
  }

  private _renderEntry(entry: LootEntry, poolIndex: number, entryIndex: number): JSX.Element {
    const hasDetails =
      (entry.functions && entry.functions.length > 0) || (entry.conditions && entry.conditions.length > 0);

    return (
      <div
        key={entryIndex}
        className="ltlp-entry ltlp-clickable"
        onClick={() => this.props.onNavigate?.(`pools/${poolIndex}/entries/${entryIndex}`)}
        title={`Go to entry ${entryIndex}`}
      >
        <span className="ltlp-entry-icon">{this._getEntryTypeIcon(entry.type)}</span>
        <span className="ltlp-entry-name">{this._shortenItemName(entry.name || entry.type)}</span>
        {entry.weight !== undefined && (
          <span className="ltlp-entry-weight" title="Weight">
            <SectionIcon type="scale" /> {entry.weight}
          </span>
        )}
        {hasDetails && (
          <span className="ltlp-entry-details">
            {entry.functions && entry.functions.length > 0 && (
              <span className="ltlp-detail-badge" title={`${entry.functions.length} function(s)`}>
                <SectionIcon type="gear" /> {entry.functions.length}
              </span>
            )}
            {entry.conditions && entry.conditions.length > 0 && (
              <span className="ltlp-detail-badge" title={`${entry.conditions.length} condition(s)`}>
                <SectionIcon type="question" /> {entry.conditions.length}
              </span>
            )}
          </span>
        )}
      </div>
    );
  }

  private _toTitleCase(str: string): string {
    return str.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  render(): JSX.Element {
    const { darkTheme, maxHeight } = this.props;
    const { isLoaded, lootData } = this.state;

    const containerClass = `ltlp-container ${darkTheme ? "ltlp-dark" : "ltlp-light"}`;
    const style: React.CSSProperties = maxHeight ? { maxHeight, overflowY: "auto" } : {};

    if (!isLoaded) {
      return (
        <div className={containerClass} style={style}>
          <div className="ltlp-loading">Loading loot table...</div>
        </div>
      );
    }

    if (!lootData) {
      return (
        <div className={containerClass} style={style}>
          <div className="ltlp-error"><SectionIcon type="warning" /> No loot table loaded</div>
        </div>
      );
    }

    return (
      <div className={containerClass} style={style}>
        {this._renderHeader()}
        {this._renderPools(lootData.pools)}
      </div>
    );
  }
}
