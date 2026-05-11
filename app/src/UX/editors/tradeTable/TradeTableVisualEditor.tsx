// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * TradeTableVisualEditor - Main trade table editor wrapper with Simple / Advanced sub-tabs.
 *
 * Mirrors LootTableVisualEditor but for villager trade tables.
 *
 * ARCHITECTURE:
 * - **Simple tab** (default): Side-by-side ItemSpritePicker on the left and
 *   TradeTiersOverview on the right. Click an item in the picker to add a new
 *   trade (with that item as the "gives") to the first tier/group; drag onto a
 *   group's drop zone to add a trade in that group.
 * - **Advanced tab**: Renders the existing SchemaEditor-based TradeTableEditor
 *   for full-control JSON-schema editing.
 *
 * JSON SHAPE TOLERANCE:
 * - The Bedrock schema declares the root as an array of TradeTier, but our seed
 *   `trade_table.json` uses `{ "tiers": [...] }`. We accept both on read and
 *   preserve whichever shape the file used on write (`_rootIsArray` flag).
 *
 * Related files:
 * - TradeTiersOverview.tsx — multi-tier visual overview
 * - TradeTierVisualEditor.tsx — single tier editor (groups + trades)
 * - TradeTile.tsx / TradeEditor.tsx — trade display + inline editor
 * - TradeItemDropZone.tsx — drag-and-drop target for new trades
 * - ../recipe/ItemSpritePicker.tsx — reused for item selection
 */

import React, { Component } from "react";
import "./TradeTableVisualEditor.css";
import IFile from "../../../storage/IFile";
import Project from "../../../app/Project";
import IPersistable from "../../types/IPersistable";
import ITradingBehavior, {
  ITradeTableGroup,
  ITradeTableTier,
  ITradeTableTrade,
} from "../../../minecraft/ITradingBehavior";
import TradeTiersOverview from "./TradeTiersOverview";
import ItemSpritePicker from "../recipe/ItemSpritePicker";
import StorageUtilities from "../../../storage/StorageUtilities";
import Log from "../../../core/Log";
import Alert from "@mui/material/Alert/Alert";
import Button from "@mui/material/Button/Button";

// Existing schema-based editor used in the Advanced tab
import AdvancedTradeTableEditor from "../../components/fileEditors/tradeTableEditor/TradeTableEditor";

enum TradeTableEditorTab {
  simple = 0,
  advanced = 1,
}

export interface ITradeTableVisualEditorProps {
  project: Project;
  file: IFile;
  setActivePersistable?: (persistable: IPersistable) => void;
  heightOffset?: number;
  readOnly?: boolean;
}

interface ITradeTableVisualEditorState {
  activeTab: TradeTableEditorTab;
  tiers: ITradeTableTier[];
  rootIsArray: boolean;
  isLoaded: boolean;
  error: string | null;
  contentKey: string;
}

function makeEmptyTier(): ITradeTableTier {
  return { groups: [{ trades: [], num_to_select: 1 }] };
}

function makeEmptyTrade(givesItemId?: string): ITradeTableTrade {
  return {
    wants: [{ item: "minecraft:emerald", quantity: { min: 1, max: 1 } }],
    gives: [{ item: givesItemId || "minecraft:wheat", quantity: { min: 1, max: 1 } }],
  };
}

export default class TradeTableVisualEditor extends Component<
  ITradeTableVisualEditorProps,
  ITradeTableVisualEditorState
> {
  // See LootTableVisualEditor for the rationale: the wrapper intercepts the
  // advanced editor's persistable so saves never dispatch into an unmounted
  // schema editor after the user switches back to the Simple tab.
  private _advancedPersistable: IPersistable | null = null;

  constructor(props: ITradeTableVisualEditorProps) {
    super(props);

    this.state = {
      activeTab: TradeTableEditorTab.simple,
      tiers: [],
      rootIsArray: false,
      isLoaded: false,
      error: null,
      contentKey: "",
    };

    this._handleTabChange = this._handleTabChange.bind(this);
    this._handleTiersChange = this._handleTiersChange.bind(this);
    this._handleItemSelected = this._handleItemSelected.bind(this);
    this._captureAdvancedPersistable = this._captureAdvancedPersistable.bind(this);
  }

  componentDidMount(): void {
    this._loadFromFile();
    this._registerPersistable();
  }

  componentDidUpdate(prevProps: ITradeTableVisualEditorProps): void {
    if (prevProps.file !== this.props.file) {
      this._loadFromFile();
    }
    if (prevProps.setActivePersistable !== this.props.setActivePersistable) {
      this._registerPersistable();
    }
  }

  private _captureAdvancedPersistable(persistable: IPersistable): void {
    this._advancedPersistable = persistable;
  }

  private _registerPersistable(): void {
    if (this.props.setActivePersistable) {
      this.props.setActivePersistable({
        persist: async (): Promise<boolean> => {
          try {
            if (this.state.activeTab === TradeTableEditorTab.simple) {
              // Simple tab: writeToFile uses setContent directly. Do NOT
              // call manager.persist() here — it would round-trip the
              // manager's stale `data` field over the freshly-written
              // content.
              this._writeToFile();
              return true;
            }

            if (this._advancedPersistable) {
              return await this._advancedPersistable.persist();
            }
            return true;
          } catch (e) {
            Log.error(`Error persisting trade table: ${e}`);
            return false;
          }
        },
      });
    }
  }

  private _loadFromFile(): void {
    try {
      const json = StorageUtilities.getJsonObject(this.props.file);

      let rawTiers: Partial<ITradeTableTier>[] = [];
      let rootIsArray = false;

      if (Array.isArray(json)) {
        rawTiers = json as Partial<ITradeTableTier>[];
        rootIsArray = true;
      } else if (json && Array.isArray((json as ITradingBehavior).tiers)) {
        rawTiers = (json as ITradingBehavior).tiers;
      }

      const tiers: ITradeTableTier[] = rawTiers.map((t) => ({
        total_exp_required: t.total_exp_required,
        groups: (t.groups || []).map((g) => ({
          num_to_select: g.num_to_select,
          trades: (g.trades || []).map((tr) => ({ ...tr })),
        })),
      }));

      // Always start with at least one tier with one group
      if (tiers.length === 0) {
        tiers.push(makeEmptyTier());
      }

      const newKey = `${this.props.file.storageRelativePath}-${this.props.file.latestModified?.getTime() || 0}`;

      this.setState({ isLoaded: true, tiers, rootIsArray, error: null, contentKey: newKey });
    } catch (e) {
      Log.error(`Error loading trade table: ${e}`);
      this.setState({ isLoaded: true, error: "Failed to parse trade table file.", tiers: [] });
    }
  }

  private _writeToFile(): void {
    const tiersOut: ITradeTableTier[] = this.state.tiers.map((tier) => {
      const t: ITradeTableTier = {
        groups: tier.groups.map((g) => {
          const grp: ITradeTableGroup = { trades: g.trades };
          if (g.num_to_select !== undefined) grp.num_to_select = g.num_to_select;
          return grp;
        }),
      };
      if (tier.total_exp_required !== undefined) {
        t.total_exp_required = tier.total_exp_required;
      }
      return t;
    });

    let payload: unknown;
    if (this.state.rootIsArray) {
      payload = tiersOut;
    } else {
      // Preserve any sibling fields under the root object
      const original = (StorageUtilities.getJsonObject(this.props.file) as Record<string, unknown>) || {};
      payload = { ...original, tiers: tiersOut };
    }

    this.props.file.setContent(JSON.stringify(payload, null, 2));
  }

  private _handleTabChange(tab: TradeTableEditorTab): void {
    if (tab === this.state.activeTab) return;

    if (this.state.activeTab === TradeTableEditorTab.simple) {
      this._writeToFile();
    }

    if (tab === TradeTableEditorTab.simple) {
      this.setState({ activeTab: tab }, () => this._loadFromFile());
    } else {
      this.setState({ activeTab: tab });
    }
  }

  private _handleTiersChange(tiers: ITradeTableTier[]): void {
    this.setState({ tiers }, () => this._writeToFile());
  }

  private _handleItemSelected(itemId: string): void {
    // Add a new trade with this item as the 'gives' to the first group of the first tier.
    if (this.props.readOnly) return;
    if (this.state.tiers.length === 0) return;

    const tiers = [...this.state.tiers];
    const firstTier: ITradeTableTier = { ...tiers[0], groups: [...tiers[0].groups] };
    if (firstTier.groups.length === 0) {
      firstTier.groups.push({ trades: [], num_to_select: 1 });
    }
    const firstGroup: ITradeTableGroup = { ...firstTier.groups[0] };
    firstGroup.trades = [...(firstGroup.trades || []), makeEmptyTrade(itemId)];
    firstTier.groups[0] = firstGroup;
    tiers[0] = firstTier;

    this._handleTiersChange(tiers);
  }

  private _renderSimpleTab(): React.ReactNode {
    const { project, readOnly } = this.props;

    return (
      <div className="ttve-simple-layout">
        <div className="ttve-picker-panel">
          <ItemSpritePicker
            project={project}
            darkTheme={true}
            onItemSelected={this._handleItemSelected}
            draggable={true}
            height="100%"
          />
        </div>
        <div className="ttve-tier-panel">
          <TradeTiersOverview tiers={this.state.tiers} readOnly={readOnly} onChange={this._handleTiersChange} />
        </div>
      </div>
    );
  }

  private _renderAdvancedTab(): React.ReactNode {
    return (
      <AdvancedTradeTableEditor
        key={this.state.contentKey}
        project={this.props.project}
        file={this.props.file}
        setActivePersistable={this._captureAdvancedPersistable}
        heightOffset={this.props.heightOffset ? this.props.heightOffset + 36 : 36}
        readOnly={this.props.readOnly}
      />
    );
  }

  render(): React.ReactNode {
    const { activeTab, isLoaded, error } = this.state;

    if (!isLoaded) {
      return <div className="ttve-loading">Loading trade table...</div>;
    }

    const containerStyle: React.CSSProperties = {
      height: this.props.heightOffset !== undefined ? `calc(100vh - ${this.props.heightOffset}px)` : "100%",
    };

    return (
      <div className="ttve-container" style={containerStyle}>
        {error && (
          <Alert severity="error" className="ttve-error">
            {error}
          </Alert>
        )}

        <div className="ttve-tab-bar">
          <Button
            className={"ttve-tab" + (activeTab === TradeTableEditorTab.simple ? " ttve-tab-active" : "")}
            onClick={() => this._handleTabChange(TradeTableEditorTab.simple)}
            variant="text"
            disableRipple
          >
            Simple
          </Button>
          <Button
            className={"ttve-tab" + (activeTab === TradeTableEditorTab.advanced ? " ttve-tab-active" : "")}
            onClick={() => this._handleTabChange(TradeTableEditorTab.advanced)}
            variant="text"
            disableRipple
          >
            Advanced
          </Button>
        </div>

        <div className="ttve-content">
          {activeTab === TradeTableEditorTab.simple ? this._renderSimpleTab() : this._renderAdvancedTab()}
        </div>
      </div>
    );
  }
}
