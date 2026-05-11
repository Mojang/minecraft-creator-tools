// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Component } from "react";
import "./MobViewer.css";
import ModelViewer from "./ModelViewer";
import VanillaProjectManager from "../../minecraft/VanillaProjectManager";
import Log from "../../core/Log";
import { WithLocalizationProps, withLocalization } from "../withLocalization";

interface IMobViewerProps extends WithLocalizationProps {
  heightOffset: number;
  mobId?: string;
}

interface IMobViewerState {
  isLoaded: boolean;
  currentMobIndex: number;
  errorMessage?: string;
  currentEntityTypeId: string;
}

/**
 * MobViewer - A dedicated component for viewing and testing entity/mob model rendering.
 * Uses ModelViewer with entityTypeId to leverage VanillaProjectManager for loading.
 * Access via URL: /?mode=mobviewer or /?mode=mobviewer&mob=pig
 */
class MobViewer extends Component<IMobViewerProps, IMobViewerState> {
  private _entityIds: string[] = [];

  constructor(props: IMobViewerProps) {
    super(props);

    this.state = {
      isLoaded: false,
      currentMobIndex: 0,
      currentEntityTypeId: "",
    };

    this._handleNextMob = this._handleNextMob.bind(this);
    this._handlePrevMob = this._handlePrevMob.bind(this);
    this._handleMobSelect = this._handleMobSelect.bind(this);
  }

  async componentDidMount() {
    await this._loadMobList();
  }

  private _getMobFromUrl(): string | undefined {
    // Parse URL for mob parameter: ?mode=mobviewer&mob=pig
    const params = new URLSearchParams(window.location.search);
    return params.get("mob") || undefined;
  }

  private _isHeadlessMode(): boolean {
    // Parse URL for headless parameter: ?mode=mobviewer&mob=pig&headless=true
    const params = new URLSearchParams(window.location.search);
    return params.get("headless") === "true";
  }

  private async _loadMobList() {
    try {
      // Use VanillaProjectManager to get entity list
      this._entityIds = await VanillaProjectManager.getVanillaEntityTypeIds();

      if (this._entityIds.length === 0) {
        // Fallback: use a predefined list of common mobs
        this._entityIds = [
          "pig",
          "cow",
          "sheep",
          "chicken",
          "zombie",
          "skeleton",
          "creeper",
          "spider",
          "enderman",
          "villager",
          "wolf",
          "cat",
          "horse",
          "rabbit",
          "bat",
          "squid",
          "bee",
          "fox",
          "panda",
          "parrot",
        ];
      }

      // Check URL parameter first, then props
      const mobFromUrl = this._getMobFromUrl();
      const targetMob = mobFromUrl || this.props.mobId;

      let initialIndex = 0;
      if (targetMob) {
        const index = this._entityIds.findIndex((id) => id === targetMob);
        if (index >= 0) {
          initialIndex = index;
        }
      } else {
        // No specific mob requested — pick a known-renderable default rather than
        // the alphabetical first entry. Vanilla's alphabetical first entity is
        // `agent` (Education Edition), which lacks a vanilla resource-pack model
        // and would otherwise crash the viewer on first paint with
        // "Couldn't load model for minecraft:agent". `pig` is a familiar,
        // always-renderable fallback that gives users an immediate working preview.
        const preferredDefaults = ["pig", "cow", "sheep", "chicken", "zombie"];
        for (const preferred of preferredDefaults) {
          const idx = this._entityIds.findIndex((id) => id === preferred);
          if (idx >= 0) {
            initialIndex = idx;
            break;
          }
        }
      }

      const currentId = this._entityIds[initialIndex] || "";

      this.setState({
        isLoaded: true,
        currentMobIndex: initialIndex,
        currentEntityTypeId: currentId ? `minecraft:${currentId}` : "",
      });
    } catch (error) {
      Log.verbose("Failed to load mob list: " + error);
      // Use fallback list
      this._entityIds = ["pig", "cow", "sheep", "chicken", "zombie", "skeleton"];
      this._entityIds.sort();

      this.setState({
        isLoaded: true,
        currentMobIndex: 0,
        currentEntityTypeId: "minecraft:pig",
        errorMessage: `Using fallback mob list: ${error}`,
      });
    }
  }

  private _handleNextMob() {
    const { currentMobIndex } = this.state;
    if (currentMobIndex < this._entityIds.length - 1) {
      const newIndex = currentMobIndex + 1;
      const newId = this._entityIds[newIndex];
      this.setState({
        currentMobIndex: newIndex,
        currentEntityTypeId: `minecraft:${newId}`,
        errorMessage: undefined,
      });
    }
  }

  private _handlePrevMob() {
    const { currentMobIndex } = this.state;
    if (currentMobIndex > 0) {
      const newIndex = currentMobIndex - 1;
      const newId = this._entityIds[newIndex];
      this.setState({
        currentMobIndex: newIndex,
        currentEntityTypeId: `minecraft:${newId}`,
        errorMessage: undefined,
      });
    }
  }

  private _handleMobSelect(event: React.ChangeEvent<HTMLSelectElement>) {
    const index = parseInt(event.target.value, 10);
    const newId = this._entityIds[index];
    this.setState({
      currentMobIndex: index,
      currentEntityTypeId: `minecraft:${newId}`,
      errorMessage: undefined,
    });
  }

  private _getMobDisplayName(id: string): string {
    if (!id) {
      return "";
    }
    // Humanize "wither_skeleton" → "Wither Skeleton"
    return id
      .split("_")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  render() {
    const { heightOffset } = this.props;
    const { isLoaded, currentMobIndex, currentEntityTypeId, errorMessage } = this.state;
    const isHeadless = this._isHeadlessMode();

    // Run without display mode: only render ModelViewer for CLI/batch rendering
    if (isHeadless) {
      return (
        <div className="mv-container mv-headless" style={{ height: "100vh", width: "100vw" }}>
          {currentEntityTypeId && <ModelViewer heightOffset={0} entityTypeId={currentEntityTypeId} readOnly={true} />}
        </div>
      );
    }

    return (
      <div className="mv-container" style={{ height: `calc(100vh - ${heightOffset}px)` }}>
        <div className="mv-toolbar">
          <button className="mv-button" onClick={this._handlePrevMob} disabled={currentMobIndex <= 0}>
            {this.props.intl.formatMessage({ id: "viewer.prev" })}
          </button>

          <select
            className="mv-select"
            value={currentMobIndex}
            onChange={this._handleMobSelect}
            disabled={!isLoaded}
            aria-label="Select mob"
          >
            {this._entityIds.map((id, index) => (
              <option key={id} value={index}>
                {id}
              </option>
            ))}
          </select>

          <button
            className="mv-button"
            onClick={this._handleNextMob}
            disabled={currentMobIndex >= this._entityIds.length - 1}
          >
            {this.props.intl.formatMessage({ id: "viewer.next" })}
          </button>

          <span className="mv-info">
            {this.props.intl.formatMessage({ id: "viewer.mob.info" }, { current: currentMobIndex + 1, total: this._entityIds.length })}
          </span>
        </div>

        <div className="mv-mob-info">
          <h2>{this._getMobDisplayName(this._entityIds[currentMobIndex]) || "Loading..."}</h2>
          <div className="mv-mob-details">
            <span>{this.props.intl.formatMessage({ id: "viewer.mob.type_id" }, { id: currentEntityTypeId })}</span>
          </div>
        </div>

        {errorMessage && <div className="mv-error">{errorMessage}</div>}

        {currentEntityTypeId && (
          <ModelViewer heightOffset={heightOffset + 120} entityTypeId={currentEntityTypeId} readOnly={true} />
        )}

        <div className="mv-footer">
          <p>{this.props.intl.formatMessage({ id: "viewer.rotate_hint" })}</p>
        </div>
      </div>
    );
  }
}

export default withLocalization(MobViewer);
