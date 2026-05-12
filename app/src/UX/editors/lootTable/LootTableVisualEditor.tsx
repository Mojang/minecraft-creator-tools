// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * LootTableVisualEditor - Main loot table editor wrapper with Simple / Advanced sub-tabs.
 *
 * ARCHITECTURE:
 * - **Simple tab** (default): Side-by-side layout with ItemSpritePicker on the left
 *   and LootPoolsOverview on the right. Provides a beginner-friendly visual editing
 *   experience with drag-and-drop items, dice roll explanation, and probability display.
 * - **Advanced tab**: Renders the existing SchemaEditor-based LootTableEditor for
 *   full-control JSON-schema editing of all loot table properties.
 *
 * Data synchronization:
 * - Both tabs read/write the same IFile object.
 * - Switching from Simple to Advanced re-reads the file to pick up visual edits.
 * - The parent calls persist() (via setActivePersistable) to save to disk.
 *
 * Related files:
 * - LootPoolsOverview.tsx — multi-pool visual overview
 * - LootPoolVisualEditor.tsx — single pool editor (dice rolls + entry tiles)
 * - DiceRollEditor.tsx — explains and edits the rolls concept
 * - LootEntryTile.tsx / LootEntryEditor.tsx — entry display and inline editing
 * - LootItemDropZone.tsx — drag-and-drop target for new items
 * - ../recipe/ItemSpritePicker.tsx — reused for item selection
 */

import React, { Component } from "react";
import "./LootTableVisualEditor.css";
import IFile from "../../../storage/IFile";
import Project from "../../../app/Project";
import IPersistable from "../../types/IPersistable";
import ILootTableBehavior, {
  ILootTableBehaviorEntry,
  ILootTableBehaviorPool,
} from "../../../minecraft/ILootTableBehavior";
import LootPoolsOverview from "./LootPoolsOverview";
import ItemSpritePicker from "../recipe/ItemSpritePicker";
import StorageUtilities from "../../../storage/StorageUtilities";
import Log from "../../../core/Log";
import Alert from "@mui/material/Alert/Alert";
import Button from "@mui/material/Button/Button";

// Lazy import for the Advanced tab (existing schema editor)
import AdvancedLootTableEditor from "../../components/fileEditors/lootTableEditor/LootTableEditor";

enum LootTableEditorTab {
  simple = 0,
  advanced = 1,
}

export interface ILootTableVisualEditorProps {
  project: Project;
  file: IFile;
  setActivePersistable?: (persistable: IPersistable) => void;
  heightOffset?: number;
  readOnly?: boolean;
}

interface ILootTableVisualEditorState {
  activeTab: LootTableEditorTab;
  pools: ILootTableBehaviorPool[];
  isLoaded: boolean;
  error: string | null;
  contentKey: string;
}

export default class LootTableVisualEditor extends Component<ILootTableVisualEditorProps, ILootTableVisualEditorState> {
  private _lastFile?: IFile;
  // Captures the advanced (schema) editor's persistable as it registers
  // itself. We forward to it only while the Advanced tab is active; when
  // the user switches back to Simple, the captured ref points at an
  // unmounted editor whose internal schemaEditorRef is null, so calling
  // it would silently lose Simple-tab edits. See _registerPersistable.
  private _advancedPersistable: IPersistable | null = null;

  constructor(props: ILootTableVisualEditorProps) {
    super(props);

    this.state = {
      activeTab: LootTableEditorTab.simple,
      pools: [],
      isLoaded: false,
      error: null,
      contentKey: "",
    };

    this._handleTabChange = this._handleTabChange.bind(this);
    this._handlePoolsChange = this._handlePoolsChange.bind(this);
    this._handleItemSelected = this._handleItemSelected.bind(this);
    this._captureAdvancedPersistable = this._captureAdvancedPersistable.bind(this);
  }

  componentDidMount(): void {
    this._loadFromFile();
    this._registerPersistable();
  }

  componentDidUpdate(prevProps: ILootTableVisualEditorProps): void {
    if (prevProps.file !== this.props.file) {
      this._loadFromFile();
    }
    if (prevProps.setActivePersistable !== this.props.setActivePersistable) {
      this._registerPersistable();
    }
  }

  /**
   * Intercepts the advanced (schema) editor's setActivePersistable call so
   * the wrapper retains control of which tab's persist callback is used.
   * The wrapper always re-publishes its own persistable (which dispatches
   * by activeTab) instead of letting the inner editor overwrite it.
   */
  private _captureAdvancedPersistable(persistable: IPersistable): void {
    this._advancedPersistable = persistable;
  }

  private _registerPersistable(): void {
    if (this.props.setActivePersistable) {
      this.props.setActivePersistable({
        persist: async (): Promise<boolean> => {
          try {
            if (this.state.activeTab === LootTableEditorTab.simple) {
              // Simple tab: write directly via setContent. We intentionally
              // do NOT call manager.persist() here — the manager's `data`
              // field reflects the previously-loaded JSON and would
              // overwrite our just-written content with stale state.
              this._writeToFile();
              return true;
            }

            // Advanced tab: delegate to the schema editor's own persist,
            // which knows how to extract its current form state and how
            // to coordinate with file.manager.persist().
            if (this._advancedPersistable) {
              return await this._advancedPersistable.persist();
            }
            return true;
          } catch (e) {
            Log.error(`Error persisting loot table: ${e}`);
            return false;
          }
        },
      });
    }
  }

  private _loadFromFile(): void {
    try {
      const json = StorageUtilities.getJsonObject(this.props.file);
      if (!json) {
        this.setState({ isLoaded: true, pools: [{ rolls: 1, entries: [] }], error: null });
        return;
      }

      const rawPools: Partial<ILootTableBehaviorPool>[] = json.pools || [];
      const pools: ILootTableBehaviorPool[] = rawPools.map((p) => ({
        rolls: p.rolls ?? 1,
        entries: (p.entries || []).map((e: ILootTableBehaviorEntry) => ({ ...e })),
        conditions: p.conditions,
        bonus_rolls: p.bonus_rolls,
        tiers: p.tiers,
      }));

      // If no pools exist, start with one empty pool
      if (pools.length === 0) {
        pools.push({ rolls: 1, entries: [] });
      }

      const newKey = `${this.props.file.storageRelativePath}-${this.props.file.latestModified?.getTime() || 0}`;
      this._lastFile = this.props.file;

      this.setState({ isLoaded: true, pools, error: null, contentKey: newKey });
    } catch (e) {
      Log.error(`Error loading loot table: ${e}`);
      this.setState({ isLoaded: true, error: "Failed to parse loot table file.", pools: [] });
    }
  }

  private _writeToFile(): void {
    // Read the original JSON to preserve any properties outside of pools
    const json: Partial<ILootTableBehavior> & Record<string, unknown> =
      (StorageUtilities.getJsonObject(this.props.file) as Partial<ILootTableBehavior> & Record<string, unknown>) || {};
    json.pools = this.state.pools.map((pool) => {
      const p: ILootTableBehaviorPool = {
        rolls: pool.rolls,
        entries: pool.entries,
      };
      if (pool.bonus_rolls) {
        p.bonus_rolls = pool.bonus_rolls;
      }
      if (pool.conditions) {
        p.conditions = pool.conditions;
      }
      if (pool.tiers) {
        p.tiers = pool.tiers;
      }
      return p;
    });

    this.props.file.setContent(JSON.stringify(json, null, 2));
  }

  private _handleTabChange(tab: LootTableEditorTab): void {
    if (tab === this.state.activeTab) return;

    // When switching away from Simple, write changes to file
    if (this.state.activeTab === LootTableEditorTab.simple) {
      this._writeToFile();
    }

    // When switching to Simple, re-read from file (Advanced may have edited)
    if (tab === LootTableEditorTab.simple) {
      this.setState({ activeTab: tab }, () => this._loadFromFile());
    } else {
      this.setState({ activeTab: tab });
    }
  }

  private _handlePoolsChange(pools: ILootTableBehaviorPool[]): void {
    this.setState({ pools }, () => {
      // Write to file on every change so Advanced tab can see updates
      this._writeToFile();
    });
  }

  private _handleItemSelected(itemId: string): void {
    // When an item is selected from the picker (click, not drag), add to the first pool
    if (this.props.readOnly) return;
    if (this.state.pools.length > 0) {
      const pools = [...this.state.pools];
      const firstPool = { ...pools[0] };
      firstPool.entries = [...(firstPool.entries || []), { type: "item", name: itemId, weight: 1 }];
      pools[0] = firstPool;
      this._handlePoolsChange(pools);
    }
  }

  private _renderSimpleTab(): React.ReactNode {
    const { project, readOnly } = this.props;

    return (
      <div className="ltve-simple-layout">
        <div className="ltve-picker-panel">
          <ItemSpritePicker
            project={project}
            darkTheme={true}
            onItemSelected={this._handleItemSelected}
            draggable={true}
            height="100%"
          />
        </div>
        <div className="ltve-pool-panel">
          <LootPoolsOverview pools={this.state.pools} readOnly={readOnly} onChange={this._handlePoolsChange} />
        </div>
      </div>
    );
  }

  private _renderAdvancedTab(): React.ReactNode {
    return (
      <AdvancedLootTableEditor
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
      return <div className="ltve-loading">Loading loot table...</div>;
    }

    return (
      <div className="ltve-container">
        {error && (
          <Alert severity="error" className="ltve-error">
            {error}
          </Alert>
        )}

        <div className="ltve-tab-bar">
          <Button
            className={"ltve-tab" + (activeTab === LootTableEditorTab.simple ? " ltve-tab-active" : "")}
            onClick={() => this._handleTabChange(LootTableEditorTab.simple)}
            variant="text"
            disableRipple
          >
            Simple
          </Button>
          <Button
            className={"ltve-tab" + (activeTab === LootTableEditorTab.advanced ? " ltve-tab-active" : "")}
            onClick={() => this._handleTabChange(LootTableEditorTab.advanced)}
            variant="text"
            disableRipple
          >
            Advanced
          </Button>
        </div>

        <div className="ltve-content">
          {activeTab === LootTableEditorTab.simple ? this._renderSimpleTab() : this._renderAdvancedTab()}
        </div>
      </div>
    );
  }
}
