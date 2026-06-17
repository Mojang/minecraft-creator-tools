/**
 * StandaloneWorldDisplay.tsx
 *
 * Thin wrapper that makes the full WorldDisplay (2D map + 3D viewer +
 * side-by-side layouts) reachable as a standalone, URL-driven route — the same
 * way WorldViewer powers the 3D-only `mode=worldviewer` route.
 *
 * WHY THIS EXISTS:
 *   The standalone `mode=worldviewer` route only mounts the 3D WorldViewer.
 *   WorldDisplay (which owns the Leaflet 2D map and the side-by-side layouts)
 *   is normally only reachable inside the project editor via the View menu.
 *   This wrapper loads a .mcworld from a URL (mirroring WorldViewer._loadWorld)
 *   and hands the loaded MCWorld to WorldDisplay with a chosen initialDisplayMode,
 *   so the 2D, 3D, and split views can be exercised directly (and tested by
 *   Playwright) via `?mode=worldviewer&world=...&view=map|3d|split|mapleft`.
 *
 * DATA FLOW:
 *   .mcworld URL → fetch → MCWorld.loadFromBytes → loadLevelDb (lazy)
 *   → WorldDisplay (world + creatorTools + initialDisplayMode)
 *
 * RELATED FILES:
 *   - WorldDisplay.tsx — the component this hosts
 *   - WorldViewer.tsx — the 3D-only standalone route; loader pattern copied here
 *   - WorldViewTypes.ts — WorldViewMode enum
 *   - appShell/App.tsx — parses the `view` query param and mounts this route
 */

import { Component } from "react";
import MCWorld from "../../minecraft/MCWorld";
import Database from "../../minecraft/Database";
import CreatorToolsHost from "../../app/CreatorToolsHost";
import Log from "../../core/Log";
import WorldDisplay from "./WorldDisplay";
import { WorldViewMode } from "./WorldViewTypes";

interface IStandaloneWorldDisplayProps {
  /** URL to a .mcworld file */
  worldUrl?: string;
  /** Height offset for CSS layout */
  heightOffset: number;
  /** Which 2D/3D layout WorldDisplay should start in */
  initialDisplayMode?: WorldViewMode;
  /** Hide UI chrome for headless screenshots (reserved for future use) */
  hideChrome?: boolean;
  cameraX?: number;
  cameraY?: number;
  cameraZ?: number;
}

interface IStandaloneWorldDisplayState {
  isLoading: boolean;
  loadingMessage: string;
  errorMessage?: string;
  world?: MCWorld;
}

export default class StandaloneWorldDisplay extends Component<
  IStandaloneWorldDisplayProps,
  IStandaloneWorldDisplayState
> {
  private _disposed = false;

  constructor(props: IStandaloneWorldDisplayProps) {
    super(props);

    this.state = {
      isLoading: true,
      loadingMessage: "Initializing...",
    };
  }

  async componentDidMount() {
    this._disposed = false;
    try {
      await this._loadWorld();
    } catch (err) {
      if (this._disposed) {
        return;
      }
      this.setState({
        isLoading: false,
        errorMessage: "Failed to load world: " + (err instanceof Error ? err.message : String(err)),
      });
    }
  }

  componentWillUnmount() {
    this._disposed = true;
  }

  private async _loadWorld() {
    if (!this.props.worldUrl) {
      throw new Error("No world URL provided");
    }

    this.setState({ loadingMessage: "Fetching world file..." });

    const response = await fetch(this.props.worldUrl);
    if (!response.ok) {
      throw new Error("HTTP " + response.status);
    }
    const bytes = new Uint8Array(await response.arrayBuffer());

    this.setState({ loadingMessage: "Parsing world data..." });
    const world = new MCWorld();
    await world.loadFromBytes(bytes);

    // Use the same lazy-load options the 2D WorldMap and 3D WorldViewer use so
    // the single shared MCWorld instance never triggers a heavyweight full-world
    // processing pass. loadLevelDb is idempotent (early-returns when loaded).
    this.setState({ loadingMessage: "Loading block database..." });
    await world.loadLevelDb(false, { lazyLoad: true, skipFullProcessing: true, maxChunksInCache: 20000 });

    // Load vanilla catalogs so the map and 3D view can render textured blocks.
    this.setState({ loadingMessage: "Loading textures..." });
    await Database.loadVanillaCatalog();
    await Database.loadVanillaResourceDefinitions();

    if (this._disposed) {
      return;
    }

    Log.debug("[StandaloneWorldDisplay] world loaded, mounting WorldDisplay");
    this.setState({ world, isLoading: false, loadingMessage: "" });
  }

  render() {
    const height = `calc(100vh - ${this.props.heightOffset}px)`;

    if (this.state.errorMessage) {
      return (
        <div
          data-testid="standalone-world-display-error"
          role="alert"
          style={{ padding: 24, height, display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          {this.state.errorMessage}
        </div>
      );
    }

    const creatorTools = CreatorToolsHost.getCreatorTools();

    if (this.state.isLoading || !this.state.world || !creatorTools) {
      return (
        <div
          data-testid="standalone-world-display-loading"
          style={{ padding: 24, height, display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          {this.state.loadingMessage}
        </div>
      );
    }

    return (
      <div data-testid="standalone-world-display" style={{ height }}>
        <WorldDisplay
          world={this.state.world}
          creatorTools={creatorTools}
          heightOffset={this.props.heightOffset}
          initialDisplayMode={this.props.initialDisplayMode}
        />
      </div>
    );
  }
}
