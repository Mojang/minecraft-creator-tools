// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * ItemViewer - A dedicated component for viewing vanilla item/attachable model rendering.
 *
 * ARCHITECTURE
 * ============
 * Mirrors the MobViewer pattern: thin wrapper around ModelViewer, using
 * VanillaProjectManager.getVanillaAttachableTypeIds() for the item list and
 * ModelViewer's `attachableTypeId` prop for loading.
 *
 * Attachables are items with 3D models (armor, bow, shield, trident, etc.).
 *
 * URL PARAMETERS:
 * - ?mode=itemviewer            — Opens the item viewer with the first item selected
 * - ?mode=itemviewer&item=bow   — Opens directly to a specific item
 * - ?headless=true              — Headless mode for CLI/batch snapshot rendering
 */

import { Component } from "react";
import "./MobViewer.css"; // Reuse MobViewer styles (same layout pattern)
import ModelViewer from "./ModelViewer";
import VanillaProjectManager from "../../minecraft/VanillaProjectManager";
import Log from "../../core/Log";

/** Default list of attachable items used when the dynamic list is empty or fails to load. */
const DEFAULT_ATTACHABLE_IDS = [
  "bow",
  "crossbow",
  "diamond_chestplate",
  "diamond_helmet",
  "iron_chestplate",
  "shield",
  "trident",
];

/** Height in pixels of the toolbar + info section above the ModelViewer. */
const TOOLBAR_HEIGHT = 120;

interface IItemViewerProps {
  heightOffset: number;
  itemId?: string;
}

interface IItemViewerState {
  isLoaded: boolean;
  currentItemIndex: number;
  errorMessage?: string;
  currentAttachableTypeId: string;
  isHeadless: boolean;
}

export default class ItemViewer extends Component<IItemViewerProps, IItemViewerState> {
  private _attachableIds: string[] = [];

  constructor(props: IItemViewerProps) {
    super(props);

    this.state = {
      isLoaded: false,
      currentItemIndex: 0,
      currentAttachableTypeId: "",
      isHeadless: new URLSearchParams(window.location.search).get("headless") === "true",
    };

    this._handleNextItem = this._handleNextItem.bind(this);
    this._handlePrevItem = this._handlePrevItem.bind(this);
    this._handleItemSelect = this._handleItemSelect.bind(this);
  }

  async componentDidMount() {
    await this._loadItemList();
  }

  private _getItemFromUrl(): string | undefined {
    const params = new URLSearchParams(window.location.search);
    return params.get("item") || undefined;
  }

  private async _loadItemList() {
    try {
      this._attachableIds = await VanillaProjectManager.getVanillaAttachableTypeIds();

      if (this._attachableIds.length === 0) {
        // Fallback list of common attachable items
        this._attachableIds = [...DEFAULT_ATTACHABLE_IDS];
      }

      const itemFromUrl = this._getItemFromUrl();
      const targetItem = itemFromUrl || this.props.itemId;

      let initialIndex = 0;
      if (targetItem) {
        const index = this._attachableIds.findIndex((id) => id === targetItem);
        if (index >= 0) {
          initialIndex = index;
        }
      }

      const currentId = this._attachableIds[initialIndex] || "";

      this.setState({
        isLoaded: true,
        currentItemIndex: initialIndex,
        currentAttachableTypeId: currentId ? `minecraft:${currentId}` : "",
      });
    } catch (error) {
      Log.verbose("Failed to load item list: " + error);
      this._attachableIds = [...DEFAULT_ATTACHABLE_IDS];
      this._attachableIds.sort();

      this.setState({
        isLoaded: true,
        currentItemIndex: 0,
        currentAttachableTypeId: "minecraft:bow",
        errorMessage: `Using fallback item list: ${error}`,
      });
    }
  }

  private _handleNextItem() {
    const { currentItemIndex } = this.state;
    if (currentItemIndex < this._attachableIds.length - 1) {
      const newIndex = currentItemIndex + 1;
      const newId = this._attachableIds[newIndex];
      this.setState({
        currentItemIndex: newIndex,
        currentAttachableTypeId: `minecraft:${newId}`,
        errorMessage: undefined,
      });
    }
  }

  private _handlePrevItem() {
    const { currentItemIndex } = this.state;
    if (currentItemIndex > 0) {
      const newIndex = currentItemIndex - 1;
      const newId = this._attachableIds[newIndex];
      this.setState({
        currentItemIndex: newIndex,
        currentAttachableTypeId: `minecraft:${newId}`,
        errorMessage: undefined,
      });
    }
  }

  private _handleItemSelect(event: React.ChangeEvent<HTMLSelectElement>) {
    const index = parseInt(event.target.value, 10);
    const newId = this._attachableIds[index];
    this.setState({
      currentItemIndex: index,
      currentAttachableTypeId: `minecraft:${newId}`,
      errorMessage: undefined,
    });
  }

  render() {
    const { heightOffset } = this.props;
    const { isLoaded, currentItemIndex, currentAttachableTypeId, errorMessage, isHeadless } = this.state;

    // Headless mode: only render ModelViewer for CLI/batch rendering
    if (isHeadless) {
      return (
        <div className="mv-container mv-headless" style={{ height: "100vh", width: "100vw" }}>
          {currentAttachableTypeId && (
            <ModelViewer heightOffset={0} attachableTypeId={currentAttachableTypeId} readOnly={true} />
          )}
        </div>
      );
    }

    return (
      <div className="mv-container" style={{ height: `calc(100vh - ${heightOffset}px)` }}>
        {!isLoaded ? (
          <div className="mv-toolbar">
            <span className="mv-info">Loading items...</span>
          </div>
        ) : (
          <div className="mv-toolbar">
            <button className="mv-button" onClick={this._handlePrevItem} disabled={currentItemIndex <= 0}>
              ← Prev
            </button>

            <select
              className="mv-select"
              value={currentItemIndex}
              onChange={this._handleItemSelect}
              disabled={!isLoaded}
              aria-label="Select item"
            >
              {this._attachableIds.map((id, index) => (
                <option key={id} value={index}>
                  {id}
                </option>
              ))}
            </select>

            <button
              className="mv-button"
              onClick={this._handleNextItem}
              disabled={currentItemIndex >= this._attachableIds.length - 1}
            >
              Next →
            </button>

            <span className="mv-info">
              Item {currentItemIndex + 1} of {this._attachableIds.length}
            </span>
          </div>
        )}

        <div className="mv-mob-info">
          <h2>{this._attachableIds[currentItemIndex] || "Loading..."}</h2>
          <div className="mv-mob-details">
            <span>Type ID: {currentAttachableTypeId}</span>
          </div>
        </div>

        {errorMessage && <div className="mv-error">{errorMessage}</div>}

        {currentAttachableTypeId && (
          <ModelViewer
            heightOffset={heightOffset + TOOLBAR_HEIGHT}
            attachableTypeId={currentAttachableTypeId}
            readOnly={true}
          />
        )}

        <div className="mv-footer">
          <p>Use mouse to rotate, scroll to zoom</p>
        </div>
      </div>
    );
  }
}
