// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Component } from "react";
import Database from "../../minecraft/Database";
import CreatorToolsHost from "../../app/CreatorToolsHost";
import "./BlockTypePicker.css";

/**
 * Common block categories for organizing the block picker.
 */
export enum BlockCategory {
  All = "all",
  Building = "building",
  Decorative = "decorative",
  Natural = "natural",
  Redstone = "redstone",
  Utility = "utility",
}

/**
 * Block info with display name, ID, and optional snapshot path.
 */
export interface IBlockInfo {
  id: string;
  displayName: string;
  snapshotPath?: string;
  category?: BlockCategory;
}

interface IBlockTypePickerProps {
  value: string;
  onChange: (blockType: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

interface IBlockTypePickerState {
  isOpen: boolean;
  searchQuery: string;
  availableBlocks: IBlockInfo[];
  filteredBlocks: IBlockInfo[];
  selectedIndex: number;
  isLoading: boolean;
}

/**
 * A visual block type picker component that displays block thumbnails from snapshots.
 * @see https://learn.microsoft.com/en-us/minecraft/creator/documents/bedrockeditor/editorpenciltool
 */
export default class BlockTypePicker extends Component<IBlockTypePickerProps, IBlockTypePickerState> {
  private _dropdownRef: HTMLDivElement | null = null;
  private _inputRef: HTMLInputElement | null = null;
  private _listRef: HTMLDivElement | null = null;

  constructor(props: IBlockTypePickerProps) {
    super(props);

    this.state = {
      isOpen: false,
      searchQuery: "",
      availableBlocks: [],
      filteredBlocks: [],
      selectedIndex: -1,
      isLoading: true,
    };

    this._handleDocumentClick = this._handleDocumentClick.bind(this);
    this._handleKeyDown = this._handleKeyDown.bind(this);
  }

  componentDidMount() {
    document.addEventListener("click", this._handleDocumentClick);
    this._loadAvailableBlocks();
  }

  componentWillUnmount() {
    document.removeEventListener("click", this._handleDocumentClick);
  }

  componentDidUpdate(prevProps: IBlockTypePickerProps, prevState: IBlockTypePickerState) {
    // Scroll to selected item when navigating with keyboard
    if (prevState.selectedIndex !== this.state.selectedIndex && this._listRef) {
      const selectedElement = this._listRef.querySelector(".bp-item-selected");
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  }

  /**
   * Load available blocks from the Database blocks catalog and match with snapshots.
   */
  async _loadAvailableBlocks() {
    const blocks: IBlockInfo[] = [];

    // Get blocks from Database catalog if available
    if (Database.blocksCatalog?.blocksCatalog) {
      for (const blockId in Database.blocksCatalog.blocksCatalog) {
        const snapshotName = this._getSnapshotName(blockId);
        blocks.push({
          id: `minecraft:${blockId}`,
          displayName: this._formatBlockName(blockId),
          snapshotPath: snapshotName ? CreatorToolsHost.contentWebRoot + `res/snapshots/${snapshotName}` : undefined,
        });
      }
    }

    // If catalog is empty, populate with common blocks from snapshot filenames
    if (blocks.length === 0) {
      const commonBlocks = this._getCommonBlocks();
      blocks.push(...commonBlocks);
    }

    // Sort alphabetically by display name
    blocks.sort((a, b) => a.displayName.localeCompare(b.displayName));

    this.setState({
      availableBlocks: blocks,
      filteredBlocks: blocks,
      isLoading: false,
    });
  }

  /**
   * Get a list of common blocks with their snapshot paths.
   * This is used when the Database catalog isn't available.
   * List is derived from available block snapshots in res/snapshots/
   */
  _getCommonBlocks(): IBlockInfo[] {
    // Comprehensive list of common building blocks, derived from snapshot files
    const commonBlockIds = [
      // Basic blocks
      "stone",
      "cobblestone",
      "dirt",
      "grass-block",
      "sand",
      "gravel",
      "clay",
      "bedrock",
      "obsidian",
      "netherrack",
      "end-stone",

      // Wood types
      "oak-log",
      "oak-planks",
      "oak-wood",
      "oak-stairs",
      "oak-slab",
      "oak-fence",
      "oak-door",
      "oak-trapdoor",
      "birch-log",
      "birch-planks",
      "birch-wood",
      "birch-stairs",
      "birch-slab",
      "birch-fence",
      "birch-door",
      "spruce-log",
      "spruce-planks",
      "spruce-wood",
      "spruce-stairs",
      "spruce-slab",
      "spruce-fence",
      "spruce-door",
      "dark-oak-log",
      "dark-oak-planks",
      "dark-oak-wood",
      "dark-oak-stairs",
      "dark-oak-slab",
      "dark-oak-fence",
      "jungle-log",
      "jungle-planks",
      "jungle-wood",
      "jungle-stairs",
      "jungle-slab",
      "jungle-fence",
      "acacia-log",
      "acacia-planks",
      "acacia-wood",
      "acacia-stairs",
      "acacia-slab",
      "acacia-fence",
      "mangrove-log",
      "mangrove-planks",
      "mangrove-wood",
      "mangrove-stairs",
      "mangrove-slab",
      "cherry-log",
      "cherry-planks",
      "cherry-wood",
      "cherry-stairs",
      "cherry-slab",
      "bamboo-planks",
      "bamboo-mosaic",
      "bamboo-block",
      "crimson-planks",
      "crimson-stem",
      "warped-planks",
      "warped-stem",

      // Stone variants
      "stone-bricks",
      "mossy-stone-bricks",
      "cracked-stone-bricks",
      "chiseled-stone-bricks",
      "cobblestone-stairs",
      "cobblestone-slab",
      "cobblestone-wall",
      "stone-stairs",
      "stone-slab",
      "smooth-stone",
      "smooth-stone-slab",
      "andesite",
      "polished-andesite",
      "diorite",
      "polished-diorite",
      "granite",
      "polished-granite",
      "deepslate",
      "cobbled-deepslate",
      "polished-deepslate",
      "deepslate-bricks",
      "deepslate-tiles",
      "tuff",
      "polished-tuff",
      "tuff-bricks",

      // Bricks and terracotta
      "bricks",
      "brick-stairs",
      "brick-slab",
      "brick-wall",
      "terracotta",
      "white-terracotta",
      "orange-terracotta",
      "red-terracotta",
      "brown-terracotta",
      "yellow-terracotta",
      "lime-terracotta",
      "green-terracotta",
      "cyan-terracotta",
      "light-blue-terracotta",
      "blue-terracotta",
      "purple-terracotta",
      "magenta-terracotta",
      "pink-terracotta",
      "black-terracotta",
      "gray-terracotta",
      "light-gray-terracotta",

      // Concrete
      "white-concrete",
      "orange-concrete",
      "magenta-concrete",
      "light-blue-concrete",
      "yellow-concrete",
      "lime-concrete",
      "pink-concrete",
      "gray-concrete",
      "light-gray-concrete",
      "cyan-concrete",
      "purple-concrete",
      "blue-concrete",
      "brown-concrete",
      "green-concrete",
      "red-concrete",
      "black-concrete",

      // Wool
      "white-wool",
      "orange-wool",
      "magenta-wool",
      "light-blue-wool",
      "yellow-wool",
      "lime-wool",
      "pink-wool",
      "gray-wool",
      "light-gray-wool",
      "cyan-wool",
      "purple-wool",
      "blue-wool",
      "brown-wool",
      "green-wool",
      "red-wool",
      "black-wool",

      // Glass
      "glass",
      "glass-pane",
      "tinted-glass",
      "white-stained-glass",
      "red-stained-glass",
      "blue-stained-glass",
      "green-stained-glass",
      "yellow-stained-glass",
      "black-stained-glass",
      "orange-stained-glass",
      "purple-stained-glass",

      // Ore blocks
      "coal-block",
      "iron-block",
      "gold-block",
      "diamond-block",
      "emerald-block",
      "lapis-block",
      "redstone-block",
      "netherite-block",
      "copper-block",
      "amethyst-block",
      "raw-iron-block",
      "raw-copper-block",
      "raw-gold-block",

      // Ores
      "coal-ore",
      "iron-ore",
      "gold-ore",
      "diamond-ore",
      "emerald-ore",
      "lapis-ore",
      "redstone-ore",
      "copper-ore",
      "nether-gold-ore",
      "nether-quartz-ore",
      "ancient-debris",

      // Nether blocks
      "nether-bricks",
      "red-nether-bricks",
      "nether-wart-block",
      "warped-wart-block",
      "basalt",
      "polished-basalt",
      "smooth-basalt",
      "blackstone",
      "polished-blackstone",
      "soul-sand",
      "soul-soil",
      "magma-block",
      "glowstone",
      "shroomlight",
      "crimson-nylium",
      "warped-nylium",
      "crying-obsidian",

      // End blocks
      "end-stone-bricks",
      "purpur-block",
      "purpur-pillar",

      // Prismarine
      "prismarine",
      "prismarine-bricks",
      "dark-prismarine",
      "sea-lantern",

      // Sandstone
      "sandstone",
      "cut-sandstone",
      "chiseled-sandstone",
      "smooth-sandstone",
      "red-sandstone",
      "cut-red-sandstone",
      "chiseled-red-sandstone",
      "smooth-red-sandstone",

      // Quartz
      "quartz-block",
      "quartz-bricks",
      "quartz-pillar",
      "smooth-quartz",
      "chiseled-quartz-block",

      // Copper variants
      "cut-copper",
      "exposed-copper",
      "weathered-copper",
      "oxidized-copper",
      "copper-grate",
      "copper-bulb",
      "copper-door",
      "copper-trapdoor",

      // Functional blocks
      "crafting-table",
      "furnace",
      "blast-furnace",
      "smoker",
      "anvil",
      "chest",
      "barrel",
      "ender-chest",
      "shulker-box",
      "enchanting-table",
      "bookshelf",
      "lectern",
      "cartography-table",
      "smithing-table",
      "fletching-table",
      "loom",
      "stonecutter",
      "brewing-stand",
      "cauldron",
      "composter",
      "grindstone",
      "beacon",
      "conduit",
      "respawn-anchor",
      "lodestone",

      // Redstone
      "redstone-lamp",
      "note-block",
      "observer",
      "piston",
      "sticky-piston",
      "hopper",
      "dropper",
      "dispenser",
      "target",
      "tnt",

      // Lighting
      "torch",
      "lantern",
      "soul-lantern",
      "soul-torch",
      "campfire",
      "soul-campfire",
      "candle",
      "sea-pickle",
      "glow-lichen",
      "froglight",
      "ochre-froglight",

      // Nature
      "oak-leaves",
      "birch-leaves",
      "spruce-leaves",
      "dark-oak-leaves",
      "jungle-leaves",
      "azalea-leaves",
      "flowering-azalea-leaves",
      "cherry-leaves",
      "mangrove-leaves",
      "moss-block",
      "moss-carpet",
      "sculk",
      "mud",
      "packed-mud",
      "mud-bricks",
      "hay-block",
      "dried-kelp-block",
      "bone-block",
      "honeycomb-block",
      "honey-block",
      "slime-block",
      "melon",
      "pumpkin",
      "jack-o-lantern",

      // Ice and snow
      "ice",
      "packed-ice",
      "blue-ice",
      "snow",
      "snow-layer",
      "powder-snow",

      // Misc
      "sponge",
      "wet-sponge",
      "coral-block",
      "dead-coral-block",
      "crying-obsidian",
      "gilded-blackstone",
      "reinforced-deepslate",
      "calcite",
      "dripstone-block",
      "pointed-dripstone",
      "budding-amethyst",
      "amethyst-cluster",

      // Fluids (for reference)
      "water",
      "lava",
    ];

    return commonBlockIds.map((id) => {
      const minecraftId = id.replace(/-/g, "_");
      return {
        id: `minecraft:${minecraftId}`,
        displayName: this._formatBlockName(minecraftId),
        snapshotPath: CreatorToolsHost.contentWebRoot + `res/snapshots/block-${id}.png`,
      };
    });
  }

  /**
   * Convert a block ID to a snapshot filename.
   */
  _getSnapshotName(blockId: string): string | undefined {
    // Convert underscores to hyphens for snapshot naming convention
    const snapshotId = blockId.replace(/_/g, "-");
    return `block-${snapshotId}.png`;
  }

  /**
   * Format a block ID to a human-readable display name.
   */
  _formatBlockName(blockId: string): string {
    // Remove minecraft: prefix if present
    let name = blockId.replace(/^minecraft:/, "");
    // Replace underscores and hyphens with spaces
    name = name.replace(/[_-]/g, " ");
    // Capitalize each word
    name = name
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
    return name;
  }

  /**
   * Handle click outside dropdown to close it.
   */
  _handleDocumentClick(event: MouseEvent) {
    if (this._dropdownRef && !this._dropdownRef.contains(event.target as Node)) {
      this.setState({ isOpen: false, selectedIndex: -1 });
    }
  }

  /**
   * Handle keyboard navigation in the dropdown.
   */
  _handleKeyDown(event: React.KeyboardEvent) {
    const { isOpen, filteredBlocks, selectedIndex } = this.state;

    if (!isOpen) {
      if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        this.setState({ isOpen: true, selectedIndex: 0 });
      }
      return;
    }

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        this.setState({
          selectedIndex: Math.min(selectedIndex + 1, filteredBlocks.length - 1),
        });
        break;

      case "ArrowUp":
        event.preventDefault();
        this.setState({
          selectedIndex: Math.max(selectedIndex - 1, 0),
        });
        break;

      case "Enter":
        event.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < filteredBlocks.length) {
          this._selectBlock(filteredBlocks[selectedIndex]);
        }
        break;

      case "Escape":
        event.preventDefault();
        this.setState({ isOpen: false, selectedIndex: -1 });
        break;

      case "Tab":
        this.setState({ isOpen: false, selectedIndex: -1 });
        break;
    }
  }

  /**
   * Handle search input changes.
   */
  _handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const query = event.target.value.toLowerCase();
    const filtered = this.state.availableBlocks.filter(
      (block) => block.displayName.toLowerCase().includes(query) || block.id.toLowerCase().includes(query)
    );

    this.setState({
      searchQuery: event.target.value,
      filteredBlocks: filtered,
      selectedIndex: filtered.length > 0 ? 0 : -1,
    });
  };

  /**
   * Handle input focus to open dropdown.
   */
  _handleInputFocus = () => {
    this.setState({ isOpen: true });
  };

  /**
   * Select a block and close the dropdown.
   */
  _selectBlock(block: IBlockInfo) {
    this.props.onChange(block.id);
    this.setState({
      isOpen: false,
      searchQuery: "",
      filteredBlocks: this.state.availableBlocks,
      selectedIndex: -1,
    });
  }

  /**
   * Get the current block info for display.
   */
  _getCurrentBlockInfo(): IBlockInfo | undefined {
    const currentId = this.props.value.replace(/^minecraft:/, "");
    return this.state.availableBlocks.find(
      (block) => block.id === this.props.value || block.id === `minecraft:${currentId}`
    );
  }

  /**
   * Handle image load error - use fallback.
   */
  _handleImageError = (event: React.SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    img.style.display = "none";
    // Show a placeholder block icon instead
    const parent = img.parentElement;
    if (parent) {
      parent.classList.add("bp-no-image");
    }
  };

  render() {
    const { value, placeholder, disabled } = this.props;
    const { isOpen, searchQuery, filteredBlocks, selectedIndex, isLoading } = this.state;

    const currentBlock = this._getCurrentBlockInfo();
    const displayValue = currentBlock?.displayName || this._formatBlockName(value);

    return (
      <div
        className={`bp-container ${isOpen ? "bp-open" : ""} ${disabled ? "bp-disabled" : ""}`}
        ref={(ref) => (this._dropdownRef = ref)}
        onKeyDown={this._handleKeyDown}
      >
        {/* Selected block display / input */}
        <div className="bp-trigger" onClick={() => !disabled && this.setState({ isOpen: !isOpen })}>
          <div className="bp-selected">
            {currentBlock?.snapshotPath && (
              <img
                src={currentBlock.snapshotPath}
                alt={currentBlock.displayName}
                className="bp-selected-image"
                onError={this._handleImageError}
              />
            )}
            <span className="bp-selected-text">{displayValue}</span>
          </div>
          <span className={`bp-arrow${isOpen ? " bp-arrow-up" : ""}`} />
        </div>

        {/* Dropdown panel */}
        {isOpen && (
          <div className="bp-dropdown">
            {/* Search input */}
            <div className="bp-search">
              <input
                ref={(ref) => (this._inputRef = ref)}
                type="text"
                className="bp-search-input"
                placeholder={placeholder || "Search blocks..."}
                value={searchQuery}
                onChange={this._handleSearchChange}
                onFocus={this._handleInputFocus}
                autoFocus
              />
            </div>

            {/* Block list */}
            <div className="bp-list" ref={(ref) => (this._listRef = ref)}>
              {isLoading ? (
                <div className="bp-loading">Loading blocks...</div>
              ) : filteredBlocks.length === 0 ? (
                <div className="bp-empty">No blocks found</div>
              ) : (
                filteredBlocks.map((block, index) => (
                  <div
                    key={block.id}
                    className={`bp-item ${index === selectedIndex ? "bp-item-selected" : ""} ${
                      block.id === value ? "bp-item-current" : ""
                    }`}
                    onClick={() => this._selectBlock(block)}
                    onMouseEnter={() => this.setState({ selectedIndex: index })}
                  >
                    <div className="bp-item-image-container">
                      {block.snapshotPath ? (
                        <img
                          src={block.snapshotPath}
                          alt={block.displayName}
                          className="bp-item-image"
                          onError={this._handleImageError}
                          loading="lazy"
                        />
                      ) : (
                        <div className="bp-item-placeholder">🧱</div>
                      )}
                    </div>
                    <div className="bp-item-info">
                      <div className="bp-item-name">{block.displayName}</div>
                      <div className="bp-item-id">{block.id}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    );
  }
}
