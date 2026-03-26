// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * SIMPLIFIED BIOME FILTER EDITOR
 * ==============================
 *
 * A simplified filter editor specifically for biome selection in feature rules.
 *
 * KEY CONCEPTS:
 * - Shows a categorized list of common biome tags with checkboxes
 * - Automatically detects if existing filter data is "simple" (only has_biome_tag tests)
 * - Falls back to full MinecraftFilterEditor for complex filters
 * - Provides an "Advanced" toggle to switch between modes
 *
 * DATA FORMAT:
 * Simple biome filters are stored as:
 * - Single tag: { "test": "has_biome_tag", "value": "desert" }
 * - Multiple tags (any_of): { "any_of": [{ "test": "has_biome_tag", "value": "desert" }, ...] }
 * - Multiple tags (all_of): { "all_of": [{ "test": "has_biome_tag", "value": "desert" }, ...] }
 */

import { Component, SyntheticEvent } from "react";
import "./SimplifiedBiomeFilterEditor.css";
import { MinecraftFilterClauseSet } from "../minecraft/jsoncommon/MinecraftFilterClauseSet";
import { MinecraftFilterClause } from "../minecraft/jsoncommon/MinecraftFilterClause";
import MinecraftFilterEditor, { IMinecraftFilterEditorProps } from "./MinecraftFilterEditor";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faGear, faListCheck } from "@fortawesome/free-solid-svg-icons";
import { faSquare, faSquareCheck } from "@fortawesome/free-regular-svg-icons";
import BiomeCategoryIcon from "./BiomeCategoryIcon";
import BiomeTagIcon from "./BiomeTagIcon";

/**
 * Common biome tags organized by category for easy selection.
 * These are the tags most commonly used in feature rules.
 */
const BIOME_TAG_CATEGORIES = [
  {
    name: "Dimensions",
    tags: [
      { id: "overworld", label: "Overworld" },
      { id: "nether", label: "Nether" },
      { id: "the_end", label: "The End" },
    ],
  },
  {
    name: "Temperature",
    tags: [
      { id: "cold", label: "Cold" },
      { id: "frozen", label: "Frozen" },
      { id: "lukewarm", label: "Lukewarm" },
      { id: "warm", label: "Warm" },
      { id: "temperate", label: "Temperate" },
    ],
  },
  {
    name: "Biome Types",
    tags: [
      { id: "forest", label: "Forest" },
      { id: "plains", label: "Plains" },
      { id: "desert", label: "Desert" },
      { id: "jungle", label: "Jungle" },
      { id: "taiga", label: "Taiga" },
      { id: "savanna", label: "Savanna" },
      { id: "swamp", label: "Swamp" },
      { id: "mangrove_swamp", label: "Mangrove Swamp" },
      { id: "mountain", label: "Mountain" },
      { id: "extreme_hills", label: "Extreme Hills" },
      { id: "mesa", label: "Mesa/Badlands" },
      { id: "mushroom_island", label: "Mushroom Island" },
      { id: "beach", label: "Beach" },
      { id: "ocean", label: "Ocean" },
      { id: "deep", label: "Deep Ocean" },
      { id: "river", label: "River" },
    ],
  },
  {
    name: "Special",
    tags: [
      { id: "ice", label: "Ice" },
      { id: "ice_plains", label: "Ice Plains" },
      { id: "flower_forest", label: "Flower Forest" },
      { id: "birch", label: "Birch" },
      { id: "roofed", label: "Dark Forest" },
      { id: "mega", label: "Mega" },
      { id: "mutated", label: "Mutated" },
      { id: "rare", label: "Rare" },
      { id: "hills", label: "Hills" },
      { id: "edge", label: "Edge" },
      { id: "shore", label: "Shore" },
    ],
  },
  {
    name: "Caves",
    tags: [
      { id: "caves", label: "Caves" },
      { id: "dripstone_caves", label: "Dripstone Caves" },
      { id: "lush_caves", label: "Lush Caves" },
      { id: "deep_dark", label: "Deep Dark" },
    ],
  },
  {
    name: "Nether Biomes",
    tags: [
      { id: "nether_wastes", label: "Nether Wastes" },
      { id: "crimson_forest", label: "Crimson Forest" },
      { id: "warped_forest", label: "Warped Forest" },
      { id: "soul_sand_valley", label: "Soul Sand Valley" },
      { id: "basalt_deltas", label: "Basalt Deltas" },
    ],
  },
];

export interface ISimplifiedBiomeFilterEditorProps {
  data: MinecraftFilterClauseSet;
  displayNarrow?: boolean;
  filterContextId: string;
  onChange?: (
    event: SyntheticEvent<HTMLElement, Event> | React.KeyboardEvent<Element> | null,
    data: IMinecraftFilterEditorProps
  ) => void;
}

interface ISimplifiedBiomeFilterEditorState {
  isAdvancedMode: boolean;
  selectedTags: Set<string>;
  matchMode: "any" | "all";
  searchFilter: string;
}

export default class SimplifiedBiomeFilterEditor extends Component<
  ISimplifiedBiomeFilterEditorProps,
  ISimplifiedBiomeFilterEditorState
> {
  constructor(props: ISimplifiedBiomeFilterEditorProps) {
    super(props);

    this._handleToggleAdvanced = this._handleToggleAdvanced.bind(this);
    this._handleToggleSimple = this._handleToggleSimple.bind(this);
    this._handleTagToggle = this._handleTagToggle.bind(this);
    this._handleMatchModeChange = this._handleMatchModeChange.bind(this);
    this._handleSearchChange = this._handleSearchChange.bind(this);
    this._handleAddCustomTag = this._handleAddCustomTag.bind(this);

    const { isSimple, selectedTags, matchMode } = this._analyzeExistingData(props.data);

    this.state = {
      isAdvancedMode: !isSimple,
      selectedTags: new Set(selectedTags),
      matchMode: matchMode,
      searchFilter: "",
    };
  }

  /**
   * Analyzes existing filter data to determine if it's a simple biome filter.
   * Returns the selected biome tags if it's simple, or indicates complex mode needed.
   */
  _analyzeExistingData(data: MinecraftFilterClauseSet | MinecraftFilterClause): {
    isSimple: boolean;
    selectedTags: string[];
    matchMode: "any" | "all";
  } {
    if (!data || Object.keys(data).length === 0) {
      return { isSimple: true, selectedTags: [], matchMode: "any" };
    }

    // Single clause case
    if ((data as MinecraftFilterClause).test) {
      const clause = data as MinecraftFilterClause;
      if (clause.test === "has_biome_tag" && clause.operator !== "!=" && clause.operator !== "not") {
        return {
          isSimple: true,
          selectedTags: clause.value ? [String(clause.value)] : [],
          matchMode: "any",
        };
      }
      // Non-biome test, needs advanced mode
      return { isSimple: false, selectedTags: [], matchMode: "any" };
    }

    // Check any_of or all_of
    const clauseSet = data as MinecraftFilterClauseSet;
    const clauses = clauseSet.any_of || clauseSet.all_of;
    const matchMode = clauseSet.any_of ? "any" : "all";

    if (!clauses) {
      return { isSimple: true, selectedTags: [], matchMode: "any" };
    }

    // Check if all clauses are simple has_biome_tag tests
    const selectedTags: string[] = [];
    for (const clause of clauses) {
      // If it's a nested clause set, it's too complex
      if ((clause as MinecraftFilterClauseSet).any_of || (clause as MinecraftFilterClauseSet).all_of) {
        return { isSimple: false, selectedTags: [], matchMode: "any" };
      }

      const filterClause = clause as MinecraftFilterClause;
      if (filterClause.test !== "has_biome_tag") {
        return { isSimple: false, selectedTags: [], matchMode: "any" };
      }

      // Negation makes it complex
      if (filterClause.operator === "!=" || filterClause.operator === "not") {
        return { isSimple: false, selectedTags: [], matchMode: "any" };
      }

      if (filterClause.value) {
        selectedTags.push(String(filterClause.value));
      }
    }

    return { isSimple: true, selectedTags, matchMode };
  }

  _handleToggleAdvanced() {
    this.setState({ isAdvancedMode: true });
  }

  _handleToggleSimple() {
    // Re-analyze data when switching back to simple mode
    const { isSimple, selectedTags, matchMode } = this._analyzeExistingData(this.props.data);

    if (!isSimple) {
      // Can't switch to simple mode with complex data
      return;
    }

    this.setState({
      isAdvancedMode: false,
      selectedTags: new Set(selectedTags),
      matchMode: matchMode,
    });
  }

  _handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    this.setState({ searchFilter: e.target.value });
  }

  _handleTagToggle(tagId: string) {
    const newSelectedTags = new Set(this.state.selectedTags);

    if (newSelectedTags.has(tagId)) {
      newSelectedTags.delete(tagId);
    } else {
      newSelectedTags.add(tagId);
    }

    this.setState({ selectedTags: newSelectedTags }, () => {
      this._updateFilterData();
    });
  }

  _handleMatchModeChange(mode: "any" | "all") {
    this.setState({ matchMode: mode }, () => {
      this._updateFilterData();
    });
  }

  _handleAddCustomTag() {
    const tagId = this.state.searchFilter.trim().toLowerCase();
    if (tagId && !this.state.selectedTags.has(tagId)) {
      const newSelectedTags = new Set(this.state.selectedTags);
      newSelectedTags.add(tagId);
      this.setState({ selectedTags: newSelectedTags, searchFilter: "" }, () => {
        this._updateFilterData();
      });
    }
  }

  _updateFilterData() {
    const { selectedTags, matchMode } = this.state;
    const data = this.props.data as any;

    // Clear existing data
    delete data.test;
    delete data.operator;
    delete data.subject;
    delete data.value;
    delete data.any_of;
    delete data.all_of;

    const tags = Array.from(selectedTags);

    if (tags.length === 0) {
      // Empty filter
      return;
    }

    if (tags.length === 1) {
      // Single tag - use simple clause format
      data.test = "has_biome_tag";
      data.value = tags[0];
    } else {
      // Multiple tags - use any_of or all_of
      const clauses = tags.map((tag) => ({
        test: "has_biome_tag",
        value: tag,
      }));

      if (matchMode === "any") {
        data.any_of = clauses;
      } else {
        data.all_of = clauses;
      }
    }

    // Notify parent of change
    if (this.props.onChange) {
      this.props.onChange(null, {
        data: this.props.data,
        filterContextId: this.props.filterContextId,
      });
    }
  }

  _getAllKnownTags(): { id: string; label: string }[] {
    const tags: { id: string; label: string }[] = [];
    for (const category of BIOME_TAG_CATEGORIES) {
      for (const tag of category.tags) {
        tags.push(tag);
      }
    }
    return tags;
  }

  _renderSimplifiedEditor(): JSX.Element {
    const { selectedTags, matchMode, searchFilter } = this.state;
    const { isSimple } = this._analyzeExistingData(this.props.data);

    // Get all known tag IDs for filtering custom tags
    const knownTagIds = new Set(this._getAllKnownTags().map((t) => t.id));

    // Find custom tags (selected but not in our predefined list)
    const customTags = Array.from(selectedTags).filter((tag) => !knownTagIds.has(tag));

    return (
      <div className="sbfe-simplified">
        <div className="sbfe-header">
          <div className="sbfe-matchMode">
            <span className="sbfe-matchLabel">Match:</span>
            <button
              className={`sbfe-matchButton ${matchMode === "any" ? "sbfe-matchActive" : ""}`}
              onClick={() => this._handleMatchModeChange("any")}
              title="Feature spawns in ANY of the selected biomes"
            >
              Any
            </button>
            <button
              className={`sbfe-matchButton ${matchMode === "all" ? "sbfe-matchActive" : ""}`}
              onClick={() => this._handleMatchModeChange("all")}
              title="Feature spawns only where ALL selected tags are present"
            >
              All
            </button>
          </div>
          <button
            className="sbfe-advancedButton"
            onClick={this._handleToggleAdvanced}
            title="Switch to advanced filter editor"
          >
            <FontAwesomeIcon icon={faGear} /> Advanced
          </button>
        </div>

        <div className="sbfe-search">
          <input
            type="text"
            placeholder="Search or add custom biome tag..."
            value={searchFilter}
            onChange={this._handleSearchChange}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                this._handleAddCustomTag();
              }
            }}
          />
          {searchFilter.trim() && (
            <button className="sbfe-addCustom" onClick={this._handleAddCustomTag} title="Add custom tag">
              <FontAwesomeIcon icon={faPlus} />
            </button>
          )}
        </div>

        {/* Custom tags section */}
        {customTags.length > 0 && (
          <div className="sbfe-category">
            <div className="sbfe-categoryName">
              <BiomeCategoryIcon categoryName="Special" size={16} />
              Custom Tags
            </div>
            <div className="sbfe-tagList">
              {customTags.map((tagId) => (
                <div
                  key={tagId}
                  className={`sbfe-tag ${selectedTags.has(tagId) ? "sbfe-tagSelected" : ""}`}
                  onClick={() => this._handleTagToggle(tagId)}
                >
                  <FontAwesomeIcon icon={selectedTags.has(tagId) ? faSquareCheck : faSquare} />
                  <BiomeTagIcon tagId={tagId} size={14} />
                  <span className="sbfe-tagLabel">{tagId}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Predefined categories */}
        {BIOME_TAG_CATEGORIES.map((category) => {
          const filteredTags = searchFilter
            ? category.tags.filter(
                (tag) =>
                  tag.id.toLowerCase().includes(searchFilter.toLowerCase()) ||
                  tag.label.toLowerCase().includes(searchFilter.toLowerCase())
              )
            : category.tags;

          if (filteredTags.length === 0) {
            return null;
          }

          return (
            <div key={category.name} className="sbfe-category">
              <div className="sbfe-categoryName">
                <BiomeCategoryIcon categoryName={category.name} size={16} />
                {category.name}
              </div>
              <div className="sbfe-tagList">
                {filteredTags.map((tag) => (
                  <div
                    key={tag.id}
                    className={`sbfe-tag ${selectedTags.has(tag.id) ? "sbfe-tagSelected" : ""}`}
                    onClick={() => this._handleTagToggle(tag.id)}
                  >
                    <FontAwesomeIcon icon={selectedTags.has(tag.id) ? faSquareCheck : faSquare} />
                    <BiomeTagIcon tagId={tag.id} size={14} />
                    <span className="sbfe-tagLabel">{tag.label}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {selectedTags.size > 0 && (
          <div className="sbfe-summary">
            <strong>Selected:</strong> {Array.from(selectedTags).join(", ")}
            {selectedTags.size > 1 && (
              <span className="sbfe-summaryNote">
                {matchMode === "any"
                  ? " (feature spawns in any of these biomes)"
                  : " (feature requires all these tags)"}
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  _renderAdvancedEditor(): JSX.Element {
    const { isSimple } = this._analyzeExistingData(this.props.data);

    return (
      <div className="sbfe-advanced">
        <div className="sbfe-header">
          <button
            className={`sbfe-simpleButton ${!isSimple ? "sbfe-disabled" : ""}`}
            onClick={this._handleToggleSimple}
            disabled={!isSimple}
            title={isSimple ? "Switch to simplified biome selector" : "Filter is too complex for simplified mode"}
          >
            <FontAwesomeIcon icon={faListCheck} /> Simplified
          </button>
        </div>
        <MinecraftFilterEditor
          data={this.props.data}
          filterContextId={this.props.filterContextId}
          displayNarrow={this.props.displayNarrow}
          onChange={this.props.onChange}
        />
      </div>
    );
  }

  render() {
    const { isAdvancedMode } = this.state;

    return (
      <div className="sbfe-outer">{isAdvancedMode ? this._renderAdvancedEditor() : this._renderSimplifiedEditor()}</div>
    );
  }
}
