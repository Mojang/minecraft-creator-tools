// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * BlockPickerDialog — reusable popup for selecting a Minecraft block id.
 *
 * Shows a searchable visual grid combining:
 *   - Custom block types from the current project (if a project is supplied)
 *   - Vanilla blocks loaded via LookupUtilities.getBlockTypeReferences()
 *
 * Each tile renders the block's catalog texture when available, or a colored
 * swatch generated from BlockTypeUtilities.getCustomBlockFallbackColor() as a
 * fallback. The user can also type a freeform id (e.g. "mymod:custom_block")
 * and accept it via the "Use typed id" affordance, so this stays useful for
 * blocks not present in either catalog.
 *
 * Designed to be shared across editors (spawn rules simplified + advanced,
 * dataforms with `lookupId === "blockType"`, content wizard, etc.). All
 * callers should go through the small wrapper convention:
 *   <BlockPickerDialog open={...} onClose={...} onSelect={(id) => ...} />
 *
 * Related files:
 *   - LookupUtilities.getBlockTypeReferences() — vanilla block id + iconImage
 *   - BlockTypeUtilities.getCustomBlockFallbackColor() — swatch fallback
 *   - ItemSpriteIcon — analogous picker tile pattern for items
 */

import { Component } from "react";
import { Button, ButtonBase, Dialog, DialogTitle, DialogContent, IconButton, TextField } from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faMagnifyingGlass, faPlus } from "@fortawesome/free-solid-svg-icons";
import LookupUtilities from "../../../app/LookupUtilities";
import BlockTypeUtilities from "../../../minecraft/BlockTypeUtilities";
import BlockSpriteDatabase from "./BlockSpriteDatabase";
import { ProjectItemType } from "../../../app/IProjectItemData";
import Project from "../../../app/Project";
import CreatorToolsHost from "../../../app/CreatorToolsHost";
import Utilities from "../../../core/Utilities";
import Log from "../../../core/Log";
import "./BlockPickerDialog.css";

interface IBlockOption {
  id: string;
  label: string;
  iconUrl?: string;
  source: "project" | "vanilla";
}

export interface IBlockPickerDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (blockId: string) => void;
  /** When provided, custom block types from the project appear in their own group. */
  project?: Project | null;
  /** Block ids to hide from the list (e.g. already-selected). */
  excludeIds?: string[];
  title?: string;
}

interface IBlockPickerDialogState {
  search: string;
  vanillaOptions: IBlockOption[];
  loaded: boolean;
  /** Bumped when the shared block atlas finishes preloading so tiles can re-render via background-position. */
  atlasReadyTick: number;
}

export default class BlockPickerDialog extends Component<IBlockPickerDialogProps, IBlockPickerDialogState> {
  private _isMounted = false;

  constructor(props: IBlockPickerDialogProps) {
    super(props);
    this.state = { search: "", vanillaOptions: [], loaded: false, atlasReadyTick: 0 };
    this._handleSearchChange = this._handleSearchChange.bind(this);
    this._handleSelect = this._handleSelect.bind(this);
    this._handleAcceptTyped = this._handleAcceptTyped.bind(this);
    this._handleKeyDown = this._handleKeyDown.bind(this);
  }

  componentDidMount(): void {
    this._isMounted = true;
    void this._loadVanilla();
    void this._ensureAtlas();
  }

  componentDidUpdate(prevProps: IBlockPickerDialogProps): void {
    // Reset search when reopened so the next caller starts fresh.
    if (!prevProps.open && this.props.open) {
      this.setState({ search: "" });
    }
  }

  componentWillUnmount(): void {
    this._isMounted = false;
  }

  private async _ensureAtlas(): Promise<void> {
    try {
      await BlockSpriteDatabase.waitForPreload();
    } catch {
      // ignore — falls back to per-block <img> requests
    }
    if (this._isMounted && BlockSpriteDatabase.hasAtlas) {
      this.setState((prev) => ({ atlasReadyTick: prev.atlasReadyTick + 1 }));
    }
  }

  private async _loadVanilla(): Promise<void> {
    try {
      const refs = await LookupUtilities.getBlockTypeReferences();
      if (!this._isMounted) return;
      const opts: IBlockOption[] = (refs || []).map((r) => ({
        id: r.id as string,
        label: (r.title as string) || (r.id as string),
        iconUrl: r.iconImage
          ? CreatorToolsHost.contentWebRoot + (r.iconImage as string).replace(/^\/+/, "")
          : undefined,
        source: "vanilla",
      }));
      this.setState({ vanillaOptions: opts, loaded: true });
    } catch (e) {
      Log.debug("BlockPickerDialog: failed to load vanilla blocks: " + e);
      if (this._isMounted) this.setState({ loaded: true });
    }
  }

  private _getProjectOptions(): IBlockOption[] {
    const project = this.props.project;
    if (!project) return [];

    try {
      const items = project.getItemsByType(ProjectItemType.blockTypeBehavior);
      const seen = new Set<string>();
      const out: IBlockOption[] = [];
      // Note: this enumerates project blocks defined as `blockTypeBehavior`
      // items (a custom block with its own behavior JSON). It does NOT
      // currently detect resource-pack texture overrides for vanilla blocks
      // (e.g. a custom textures/blocks/stone.png shipped in a project
      // resource pack). Those vanilla ids will still render with the
      // prebaked atlas tile rather than the project's override texture.
      // TODO: scan resource_pack/textures/blocks/ for override filenames
      // and prefer them over the prebaked atlas when a vanilla id matches.
      for (const item of items) {
        // Derive the block id from the file name as a lightweight default.
        // Editors that have a definition object loaded can call onSelect directly
        // with a richer id; this is the picker's best guess from name alone.
        const baseName = (item.name || "").replace(/\.[^.]+$/, "").replace(/\.behavior$/i, "");
        if (!baseName) continue;
        const id = baseName.includes(":") ? baseName : baseName;
        if (seen.has(id)) continue;
        seen.add(id);
        out.push({
          id,
          label: Utilities.humanifyMinecraftName(id),
          source: "project",
        });
      }
      return out;
    } catch (e) {
      Log.debug("BlockPickerDialog: failed to enumerate project blocks: " + e);
      return [];
    }
  }

  private _handleSearchChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void {
    this.setState({ search: e.target.value });
  }

  private _handleSelect(id: string): void {
    this.props.onSelect(id);
    this.props.onClose();
  }

  private _handleAcceptTyped(): void {
    const trimmed = this.state.search.trim();
    if (!trimmed) return;
    this._handleSelect(trimmed);
  }

  private _handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>): void {
    if (e.key === "Enter") {
      const trimmed = this.state.search.trim();
      if (!trimmed) return;
      // If the typed value matches exactly one visible option, pick it.
      // Otherwise accept the typed value verbatim so the user can add custom ids.
      const filtered = this._filteredOptions();
      const exact = filtered.find((o) => o.id.toLowerCase() === trimmed.toLowerCase());
      if (exact) {
        this._handleSelect(exact.id);
      } else if (filtered.length === 1) {
        this._handleSelect(filtered[0].id);
      } else {
        this._handleAcceptTyped();
      }
    } else if (e.key === "Escape") {
      this.props.onClose();
    }
  }

  private _filteredOptions(): IBlockOption[] {
    const exclude = new Set(this.props.excludeIds ?? []);
    const all = [...this._getProjectOptions(), ...this.state.vanillaOptions].filter((o) => !exclude.has(o.id));
    const search = this.state.search.trim().toLowerCase();
    if (!search) return all;
    return all.filter((o) => o.id.toLowerCase().includes(search) || o.label.toLowerCase().includes(search));
  }

  render() {
    const filtered = this._filteredOptions();
    const projectOpts = filtered.filter((o) => o.source === "project");
    const vanillaOpts = filtered.filter((o) => o.source === "vanilla");
    const trimmed = this.state.search.trim();
    const showAcceptTyped = trimmed.length > 0 && !filtered.some((o) => o.id.toLowerCase() === trimmed.toLowerCase());

    return (
      <Dialog open={this.props.open} onClose={this.props.onClose} maxWidth="md" fullWidth>
        <DialogTitle className="bpd-title">
          {this.props.title ?? "Choose a Block"}
          <IconButton onClick={this.props.onClose} aria-label="Close" size="small" className="bpd-closeBtn">
            <FontAwesomeIcon icon={faTimes} />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers className="bpd-content">
          <div className="bpd-searchRow">
            <FontAwesomeIcon icon={faMagnifyingGlass} className="bpd-searchIcon" />
            <TextField
              autoFocus
              fullWidth
              size="small"
              type="text"
              placeholder="Search vanilla and custom blocks (e.g. minecraft:grass, mymod:stone)"
              value={this.state.search}
              onChange={this._handleSearchChange}
              onKeyDown={this._handleKeyDown}
            />
          </div>

          {showAcceptTyped && (
            <Button
              className="bpd-acceptTyped"
              variant="contained"
              color="success"
              size="small"
              startIcon={<FontAwesomeIcon icon={faPlus} />}
              onClick={this._handleAcceptTyped}
              title={`Use "${trimmed}" as a custom block id`}
            >
              Use "{trimmed}" as a custom block id
            </Button>
          )}

          {!this.state.loaded && <div className="bpd-loading">Loading blocks…</div>}

          {projectOpts.length > 0 && (
            <>
              <div className="bpd-sectionHeader">Project Blocks</div>
              <div className="bpd-grid">{projectOpts.map((opt) => this._renderTile(opt))}</div>
            </>
          )}

          {vanillaOpts.length > 0 && (
            <>
              <div className="bpd-sectionHeader">Vanilla Blocks</div>
              <div className="bpd-grid">{vanillaOpts.map((opt) => this._renderTile(opt))}</div>
            </>
          )}

          {this.state.loaded && filtered.length === 0 && !showAcceptTyped && (
            <div className="bpd-empty">No blocks match your search.</div>
          )}
        </DialogContent>
      </Dialog>
    );
  }

  private _renderTile(opt: IBlockOption) {
    const swatch = BlockTypeUtilities.getCustomBlockFallbackColor(opt.id);
    const atlasCoords =
      opt.source === "vanilla" && BlockSpriteDatabase.hasAtlas ? BlockSpriteDatabase.getCoords(opt.id) : undefined;
    return (
      <ButtonBase
        key={opt.id}
        className="bpd-tile"
        onClick={() => this._handleSelect(opt.id)}
        title={opt.id}
        focusRipple
      >
        <div
          className="bpd-tileImage"
          style={atlasCoords ? this._buildAtlasTileStyle(atlasCoords) : { background: swatch }}
        >
          {!atlasCoords && opt.iconUrl && (
            <img
              src={opt.iconUrl}
              alt=""
              loading="lazy"
              onError={(e) => {
                // Hide failed image so the swatch shows through.
                // currentTarget can be null if the tile was unmounted before
                // the browser dispatched the error event.
                const img = e.currentTarget as HTMLImageElement | null;
                if (img) {
                  img.style.display = "none";
                }
              }}
            />
          )}
        </div>
        <div className="bpd-tileLabel">{opt.label}</div>
        <div className="bpd-tileId">{opt.id}</div>
      </ButtonBase>
    );
  }

  /**
   * Build a CSS background style that shows a single tile of the block atlas
   * inside the 48px .bpd-tileImage frame. Block renders are 3D images (not
   * pixel art), so we deliberately override the parent's image-rendering:
   * pixelated with auto to keep edges smooth when downscaled.
   */
  private _buildAtlasTileStyle(coords: { x: number; y: number }): React.CSSProperties {
    const atlasUrl = BlockSpriteDatabase.atlasUrl!;
    const tile = BlockSpriteDatabase.tileSize;
    const displaySize = 48; // matches .bpd-tileImage width/height
    const scale = displaySize / tile;
    return {
      backgroundImage: `url(${atlasUrl})`,
      backgroundPosition: `-${coords.x * scale}px -${coords.y * scale}px`,
      backgroundSize: `${BlockSpriteDatabase.atlasWidth * scale}px ${BlockSpriteDatabase.atlasHeight * scale}px`,
      backgroundRepeat: "no-repeat",
      imageRendering: "auto",
    };
  }
}
