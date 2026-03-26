// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Component, createRef, RefObject } from "react";
import VolumeEditor, { VolumeEditorViewMode } from "./VolumeEditor";
import Structure from "../../minecraft/Structure";
import Database from "../../minecraft/Database";
import Log from "../../core/Log";
import "./StructureViewer.css";

interface IStructureViewerProps {
  heightOffset: number;
  structureUrl?: string;
  skipVanillaResources?: boolean;
  hideChrome?: boolean; // Hide UI controls for headless rendering
  showEditorTools?: boolean; // Show VolumeEditor toolbar and right panel (selection, brush, pencil)
  cameraX?: number;
  cameraY?: number;
  cameraZ?: number;
}

interface IStructureViewerState {
  isLoaded: boolean;
  structure: Structure | undefined;
  errorMessage?: string;
  loadingMessage?: string;
}

/**
 * StructureViewer - A dedicated component for viewing MCStructure files.
 * Used for headless rendering via Playwright.
 *
 * URL Parameters:
 * - ?mode=structureviewer - Activates this viewer
 * - &structure=/path/to/structure - URL to the .mcstructure binary data
 */
export default class StructureViewer extends Component<IStructureViewerProps, IStructureViewerState> {
  private _volumeEditorRef: RefObject<VolumeEditor>;

  constructor(props: IStructureViewerProps) {
    super(props);

    this._volumeEditorRef = createRef<VolumeEditor>();

    this.state = {
      isLoaded: false,
      structure: undefined,
      loadingMessage: "Initializing...",
    };
  }

  async componentDidMount() {
    // Check if we even have a structure URL before doing anything
    const structureUrl = this._getStructureUrlFromProps();
    if (!structureUrl) {
      // No structure URL provided — show error immediately, don't wait for props
      this.setState({
        isLoaded: true,
        errorMessage: "No structure URL provided. Use the &structure=/path/to/file parameter.",
        loadingMessage: undefined,
      });
      return;
    }

    // Only auto-load if skipVanillaResources is explicitly defined
    // When it's undefined, we wait for componentDidUpdate with proper props
    if (this.props.skipVanillaResources !== undefined) {
      await this._loadStructure();
    }
  }

  componentDidUpdate(prevProps: IStructureViewerProps) {
    // If skipVanillaResources was undefined and is now defined, OR if structureUrl changed
    const skipVanillaChanged =
      prevProps.skipVanillaResources === undefined && this.props.skipVanillaResources !== undefined;
    const structureUrlChanged = prevProps.structureUrl !== this.props.structureUrl;

    if (skipVanillaChanged || structureUrlChanged) {
      this._loadStructure();
    }
  }

  private _getStructureUrlFromProps(): string | undefined {
    // Use prop first, then fall back to URL parameter
    if (this.props.structureUrl) {
      return this.props.structureUrl;
    }

    // Parse URL for structure parameter: ?mode=structureviewer&structure=/temp/mystructure
    const params = new URLSearchParams(window.location.search);
    return params.get("structure") || params.get("struct") || undefined;
  }

  private _getCameraPositionFromProps(): { x?: number; y?: number; z?: number } {
    // Use props first, then fall back to URL parameters
    if (this.props.cameraX !== undefined && this.props.cameraY !== undefined && this.props.cameraZ !== undefined) {
      return { x: this.props.cameraX, y: this.props.cameraY, z: this.props.cameraZ };
    }

    // Parse URL for camera parameters: &cameraX=5&cameraY=10&cameraZ=5
    const params = new URLSearchParams(window.location.search);
    const cameraX = params.get("cameraX");
    const cameraY = params.get("cameraY");
    const cameraZ = params.get("cameraZ");

    if (cameraX !== null && cameraY !== null && cameraZ !== null) {
      return {
        x: parseFloat(cameraX),
        y: parseFloat(cameraY),
        z: parseFloat(cameraZ),
      };
    }

    return {};
  }

  private async _loadStructure() {
    this.setState({ loadingMessage: "Loading vanilla catalog..." });

    // Ensure the vanilla catalog is loaded for block rendering
    // IMPORTANT: Only load vanilla resources if EXPLICITLY set to false (not undefined)
    // This prevents loading during initial mount when props aren't set yet due to
    // the race condition where componentDidMount runs before parent's setState completes.
    if (this.props.skipVanillaResources === false) {
      await Database.loadVanillaCatalog();
      await Database.loadVanillaResourceDefinitions();
    }
    // When skipVanillaResources is true or undefined, we don't load vanilla resources.
    // This is intentional for isolated rendering where we want fuchsia placeholder blocks.

    const structureUrl = this._getStructureUrlFromProps();

    if (!structureUrl) {
      this.setState({
        isLoaded: true,
        errorMessage: "No structure URL provided. Use &structure=/path/to/structure parameter.",
      });
      return;
    }

    this.setState({ loadingMessage: `Loading structure from ${structureUrl}...` });

    try {
      // Fetch the structure binary data
      const response = await fetch(structureUrl);

      if (!response.ok) {
        throw new Error(`Failed to fetch structure: ${response.status} ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);

      // Parse the structure
      const structure = new Structure();
      await structure.loadFromNbtBytes(bytes);

      if (!structure.cube) {
        this.setState({
          isLoaded: true,
          errorMessage: "This structure file doesn't contain any block data.",
          loadingMessage: undefined,
        });
        return;
      }

      this.setState({
        isLoaded: true,
        structure,
        loadingMessage: undefined,
      });
    } catch (error) {
      Log.verbose("Error loading structure: " + error);
      this.setState({
        isLoaded: true,
        errorMessage: "This structure file couldn't be loaded. It may be corrupted or saved in an unsupported format.",
        loadingMessage: undefined,
      });
    }
  }

  render() {
    const { heightOffset, skipVanillaResources, hideChrome } = this.props;
    const { isLoaded, structure, errorMessage, loadingMessage } = this.state;

    const containerHeight = `calc(100vh - ${heightOffset}px)`;

    if (!isLoaded || loadingMessage) {
      return (
        <div className="sv-container" style={{ height: containerHeight }}>
          <div className="sv-loading">
            <div className="sv-spinner" />
            <span>{loadingMessage || "Loading..."}</span>
          </div>
        </div>
      );
    }

    if (errorMessage) {
      return (
        <div className="sv-container" style={{ height: containerHeight }}>
          <div className="sv-error">
            <div className="sv-error-content">
              <div className="sv-error-icon">⚠</div>
              <div className="sv-error-message">{errorMessage}</div>
              <button className="sv-error-button" onClick={() => window.history.back()}>Go Back</button>
            </div>
          </div>
        </div>
      );
    }

    if (!structure || !structure.cube) {
      return (
        <div className="sv-container" style={{ height: containerHeight }}>
          <div className="sv-error">No structure data available</div>
        </div>
      );
    }

    const cube = structure.cube;
    const dimensions = `${cube.maxX} × ${cube.maxY} × ${cube.maxZ}`;

    // Get camera position from props or URL params
    const cameraPos = this._getCameraPositionFromProps();

    // When hideChrome is true, render without toolbar or any UI overlays
    if (hideChrome) {
      return (
        <div className="sv-container sv-no-chrome" style={{ height: containerHeight }}>
          <div className="sv-viewport sv-viewport-full">
            <VolumeEditor
              ref={this._volumeEditorRef}
              blockVolume={structure.cube}
              entities={structure.entities}
              viewMode={VolumeEditorViewMode.Structure}
              heightOffset={heightOffset}
              skipVanillaResources={skipVanillaResources}
              showToolbar={this.props.showEditorTools ?? false}
              showRightPanel={this.props.showEditorTools ?? false}
              hideChrome={!this.props.showEditorTools}
              cameraX={cameraPos.x}
              cameraY={cameraPos.y}
              cameraZ={cameraPos.z}
            />
          </div>
        </div>
      );
    }

    return (
      <div className="sv-container" style={{ height: containerHeight }}>
        <div className="sv-toolbar">
          <span className="sv-info">Structure: {dimensions} blocks</span>
        </div>

        <div className="sv-viewport">
          <VolumeEditor
            ref={this._volumeEditorRef}
            blockVolume={structure.cube}
            entities={structure.entities}
            viewMode={VolumeEditorViewMode.Structure}
            heightOffset={heightOffset + 40} // Account for toolbar
            skipVanillaResources={skipVanillaResources}
            showToolbar={this.props.showEditorTools ?? false}
            showRightPanel={this.props.showEditorTools ?? false}
            cameraX={cameraPos.x}
            cameraY={cameraPos.y}
            cameraZ={cameraPos.z}
          />
        </div>

        <canvas className="sv-canvas" data-testid="structure-viewer-canvas" style={{ display: "none" }} />
      </div>
    );
  }
}
