/**
 * WorldDisplay.tsx
 *
 * ARCHITECTURE DOCUMENTATION
 * ==========================
 *
 * WorldDisplay is the main React component for displaying and interacting with
 * Minecraft worlds. It provides a map view and optional 3D world viewer.
 *
 * REAL-TIME SYNCHRONIZATION:
 * --------------------------
 * WorldDisplay subscribes to MCWorld events to automatically update when world
 * data changes. This enables real-time viewing of worlds being modified on
 * a remote server:
 *
 * 1. MCWorld.startListeningToStorage() subscribes to storage events
 * 2. When files change (via WebSocket notifications), MCWorld reloads data
 * 3. MCWorld fires onChunkUpdated, onWorldDataReloaded events
 * 4. WorldDisplay handles these events and triggers React re-render
 * 5. WorldMap (Leaflet) updates tiles as needed
 *
 * DATA FLOW:
 * ----------
 * HttpStorage (WebSocket) -> MCWorld (reload) -> WorldDisplay (this) -> WorldMap/WorldViewer
 *
 * EVENT SUBSCRIPTIONS:
 * --------------------
 * - onLoaded: Initial world load complete
 * - onDataLoaded: World chunk data fully loaded
 * - onChunkUpdated: A chunk was modified/reloaded
 * - onWorldDataReloaded: World metadata changed externally
 *
 * COMPONENT HIERARCHY:
 * --------------------
 * WorldDisplay (this)
 *   ├── WorldMap (Leaflet-based 2D map)
 *   └── WorldViewer (Babylon.js 3D view)
 *
 * RELATED FILES:
 * --------------
 * - MCWorld.ts: World data management and events
 * - WorldMap.tsx: 2D map rendering using Leaflet
 * - WorldViewer.tsx: 3D world rendering using Babylon.js
 * - HttpStorage.ts: Client-side WebSocket notification receiver
 */

import { Component } from "react";
import MCWorld, { IRegion } from "../../minecraft/MCWorld";
import WorldMap, { WorldMapDisplayMode, ISelectedEntityInfo } from "./WorldMap";
import IFile from "../../storage/IFile";
import IFolder from "../../storage/IFolder";
import { Button, FormControl, Menu, MenuItem, Select, SelectChangeEvent, Stack } from "@mui/material";
import StorageUtilities from "../../storage/StorageUtilities";
import "./WorldDisplay.css";
import AppServiceProxy, { AppServiceProxyCommands } from "../../core/AppServiceProxy";
import { OpenInMinecraftLabel, TeleportInMinecraftLabel } from "../../UX/shared/components/feedback/labels/Labels";
import CreatorTools from "../../app/CreatorTools";
import BlockLocation from "../../minecraft/BlockLocation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGithub } from "@fortawesome/free-brands-svg-icons";
import Log from "../../core/Log";

import { ViewLabel } from "../../UX/shared/components/feedback/labels/Labels";
import VolumeEditor, { VolumeEditorViewMode } from "./VolumeEditor";
import WorldViewer from "./WorldViewer";
import BlockVolume from "../../minecraft/BlockVolume";
import WebUtilities from "../../UX/utils/WebUtilities";
import Project from "../../app/Project";
import CreatorToolsHost from "../../app/CreatorToolsHost";
import ModelViewer from "./ModelViewer";
import { WorldViewMode, WorldViewMenuState } from "./WorldViewTypes";

// Re-export types for backward compatibility
export { WorldViewMode, WorldViewMenuState } from "./WorldViewTypes";

interface IWorldDisplayProps {
  world?: MCWorld;
  project?: Project;
  file?: IFile;
  folder?: IFolder;
  creatorTools: CreatorTools;
  heightOffset: number;
  initialDisplayMode?: WorldViewMode;
  onSelectionChange?: (from: BlockLocation, to: BlockLocation) => void;
}

interface IWorldDisplayState {
  activeWorld?: MCWorld;
  activeFile?: IFile;
  activeFolder?: IFolder;
  activeDimension?: number;
  viewMode: WorldViewMode;
  menuState: WorldViewMenuState;
  menuAnchorEl: HTMLElement | null;
  y: number;
  mapDisplayMode: WorldMapDisplayMode;
  viewFrom: BlockLocation | undefined;
  viewCube: BlockVolume | undefined;
  selectionFrom: BlockLocation | undefined;
  selectionTo: BlockLocation | undefined;
  /** Currently selected entity from the map */
  selectedEntity: ISelectedEntityInfo | undefined;
}

export const DimensionNames = ["Overworld", "Nether", "The End"];

export default class WorldDisplay extends Component<IWorldDisplayProps, IWorldDisplayState> {
  _lastFileViewed?: IFile;
  _lastFolderViewed?: IFolder;
  _activeMap?: WorldMap;
  /** Currently subscribed world for event cleanup */
  private _subscribedWorld?: MCWorld;

  constructor(props: IWorldDisplayProps) {
    super(props);

    this._handleMcworldLoaded = this._handleMcworldLoaded.bind(this);
    this._openInMinecraft = this._openInMinecraft.bind(this);
    this._handleSelectionChange = this._handleSelectionChange.bind(this);
    this._handleEntitySelect = this._handleEntitySelect.bind(this);
    this._teleportInMinecraft = this._teleportInMinecraft.bind(this);
    this._handleAnchorRegionSelect = this._handleAnchorRegionSelect.bind(this);
    this._handleYChange = this._handleYChange.bind(this);
    this._handleMapDisplayModeChange = this._handleMapDisplayModeChange.bind(this);
    this._setMapOnly = this._setMapOnly.bind(this);
    this._setMapOnlyImpl = this._setMapOnlyImpl.bind(this);
    this._setSmallViewOnLeft = this._setSmallViewOnLeft.bind(this);
    this._setSmallViewOnLeftImpl = this._setSmallViewOnLeftImpl.bind(this);
    this._setSmallViewOnRight = this._setSmallViewOnRight.bind(this);
    this._setSmallViewOnRightImpl = this._setSmallViewOnRightImpl.bind(this);
    this._setLargeViewOnLeft = this._setLargeViewOnLeft.bind(this);
    this._setLargeViewOnLeftImpl = this._setLargeViewOnLeftImpl.bind(this);
    this._setLargeViewOnRight = this._setLargeViewOnRight.bind(this);
    this._setLargeViewOnRightImpl = this._setLargeViewOnRightImpl.bind(this);
    this._setFullWorldView = this._setFullWorldView.bind(this);
    this._setFullWorldViewImpl = this._setFullWorldViewImpl.bind(this);
    this._setWorldViewer3D = this._setWorldViewer3D.bind(this);
    this._setWorldViewer3DImpl = this._setWorldViewer3DImpl.bind(this);
    this._setWorldViewerMapOnLeft = this._setWorldViewerMapOnLeft.bind(this);
    this._setWorldViewerMapOnLeftImpl = this._setWorldViewerMapOnLeftImpl.bind(this);
    this._handleViewMenuOpen = this._handleViewMenuOpen.bind(this);
    this._handleViewMenuClose = this._handleViewMenuClose.bind(this);
    this._setActiveMap = this._setActiveMap.bind(this);
    this._handleWorldDataReloaded = this._handleWorldDataReloaded.bind(this);
    this._handleChunkUpdated = this._handleChunkUpdated.bind(this);
    this._handleCameraUpdate = this._handleCameraUpdate.bind(this);

    let viewMode = props.initialDisplayMode;

    if (!viewMode) {
      viewMode = WorldViewMode.mapOnly;
    }

    this.state = {
      activeWorld: props.world,
      activeFile: props.file,
      activeFolder: props.folder,
      viewMode: viewMode,
      menuState: WorldViewMenuState.noMenu,
      menuAnchorEl: null,
      y: 0,
      mapDisplayMode: WorldMapDisplayMode.topBlocks,
      viewFrom: undefined,
      viewCube: undefined,
      selectionFrom: undefined,
      selectionTo: undefined,
      selectedEntity: undefined,
    };

    this._updateManager();
  }

  static getDerivedStateFromProps(props: IWorldDisplayProps, state: IWorldDisplayState) {
    if (state === undefined || state === null) {
      Log.message(`[WorldDisplay] getDerivedStateFromProps: initial state, folder=${props.folder?.fullPath}`);
      state = {
        activeWorld: props.world,
        activeFile: props.file,
        activeFolder: props.folder,
        viewMode: WorldViewMode.fullWorldView,
        menuState: WorldViewMenuState.noMenu,
        menuAnchorEl: null,
        y: 0,
        mapDisplayMode: WorldMapDisplayMode.topBlocks,
        viewFrom: undefined,
        viewCube: undefined,
        selectionFrom: undefined,
        selectionTo: undefined,
        selectedEntity: undefined,
      };

      return state;
    }

    // Update activeFolder/activeFile/activeWorld if props changed
    if (props.folder !== state.activeFolder || props.file !== state.activeFile || props.world !== state.activeWorld) {
      Log.message(
        `[WorldDisplay] getDerivedStateFromProps: props changed, folder=${props.folder?.fullPath}, file=${props.file?.fullPath}`
      );
      return {
        ...state,
        activeFolder: props.folder,
        activeFile: props.file,
        activeWorld: props.world,
      };
    }

    return null; // No change to state
  }

  componentDidUpdate(prevProps: IWorldDisplayProps, prevState: IWorldDisplayState) {
    this._updateManager();
  }

  componentWillUnmount() {
    // Cleanup world event subscriptions
    if (this._subscribedWorld) {
      this._subscribedWorld.stopListeningToStorage();
      this._subscribedWorld = undefined;
    }
  }

  private _setActiveMap(map: WorldMap) {
    this._activeMap = map;
  }

  private _updateManager() {
    Log.message(
      `[WorldDisplay] _updateManager: activeFile=${this.state?.activeFile?.fullPath}, activeFolder=${this.state?.activeFolder?.fullPath}`
    );

    if (this.state !== undefined && this.state.activeFile !== undefined) {
      if (this.state.activeFile !== this._lastFileViewed) {
        this._lastFileViewed = this.state.activeFile;
        Log.message(`[WorldDisplay] _updateManager: calling ensureOnFile for ${this.state.activeFile.fullPath}`);
        MCWorld.ensureOnFile(this.state.activeFile, this.props.project, this._handleMcworldLoaded);
      }
    }

    if (this.state !== undefined && this.state.activeFolder !== undefined) {
      if (this.state.activeFolder !== this._lastFolderViewed) {
        this._lastFolderViewed = this.state.activeFolder;
        Log.message(
          `[WorldDisplay] _updateManager: calling ensureMCWorldOnFolder for ${this.state.activeFolder.fullPath}`
        );
        MCWorld.ensureMCWorldOnFolder(this.state.activeFolder, this.props.project, this._handleMcworldLoaded);
      }
    }
  }

  private _setMapOnly() {
    // the menu change to hide the dropdown will fire at the same time, and its state changes will overwrite this one.
    // so wait a beat and update state then.
    window.setTimeout(this._setMapOnlyImpl, 2);
  }

  private _setMapOnlyImpl() {
    if (this.state === null) {
      return;
    }

    const newViewMode = WorldViewMode.mapOnly;

    this.setState({
      activeFile: this.state.activeFile,
      activeFolder: this.state.activeFolder,
      activeWorld: this.state.activeWorld,
      activeDimension: this.state.activeDimension,
      menuState: WorldViewMenuState.noMenu,
      viewMode: newViewMode,
      y: this.state.y,
      mapDisplayMode: this.state.mapDisplayMode,
      selectionFrom: this.state.selectionFrom,
      selectionTo: this.state.selectionTo,
    });
  }

  private _setSmallViewOnRight() {
    // the menu change to hide the dropdown will fire at the same time, and its state changes will overwrite this one.
    // so wait a beat and update state then.
    window.setTimeout(this._setSmallViewOnRightImpl, 2);
  }

  private _setSmallViewOnRightImpl() {
    if (this.state === null) {
      return;
    }

    const newViewMode = WorldViewMode.smallViewOnRight;

    this.setState({
      activeFile: this.state.activeFile,
      activeFolder: this.state.activeFolder,
      activeWorld: this.state.activeWorld,
      activeDimension: this.state.activeDimension,
      menuState: WorldViewMenuState.noMenu,
      viewMode: newViewMode,
      y: this.state.y,
      mapDisplayMode: this.state.mapDisplayMode,
      viewFrom: this.state.viewFrom,
      viewCube: this.state.viewCube,
      selectionFrom: this.state.selectionFrom,
      selectionTo: this.state.selectionTo,
    });
  }

  private _setSmallViewOnLeft() {
    // the menu change to hide the dropdown will fire at the same time, and its state changes will overwrite this one.
    // so wait a beat and update state then.
    window.setTimeout(this._setSmallViewOnLeftImpl, 2);
  }

  private _setSmallViewOnLeftImpl() {
    if (this.state === null) {
      return;
    }

    const newViewMode = WorldViewMode.smallViewOnLeft;

    this.setState({
      activeFile: this.state.activeFile,
      activeFolder: this.state.activeFolder,
      activeWorld: this.state.activeWorld,
      activeDimension: this.state.activeDimension,
      menuState: WorldViewMenuState.noMenu,
      viewMode: newViewMode,
      y: this.state.y,
      mapDisplayMode: this.state.mapDisplayMode,
      viewFrom: this.state.viewFrom,
      viewCube: this.state.viewCube,
      selectionFrom: this.state.selectionFrom,
      selectionTo: this.state.selectionTo,
    });
  }

  private _setLargeViewOnLeft() {
    // the menu change to hide the dropdown will fire at the same time, and its state changes will overwrite this one.
    // so wait a beat and update state then.
    window.setTimeout(this._setLargeViewOnLeftImpl, 2);
  }

  private _setLargeViewOnLeftImpl() {
    if (this.state === null) {
      return;
    }

    const newViewMode = WorldViewMode.largeViewOnLeft;

    this.setState({
      activeFile: this.state.activeFile,
      activeFolder: this.state.activeFolder,
      activeWorld: this.state.activeWorld,
      activeDimension: this.state.activeDimension,
      menuState: WorldViewMenuState.noMenu,
      viewMode: newViewMode,
      y: this.state.y,
      mapDisplayMode: this.state.mapDisplayMode,
      viewFrom: this.state.viewFrom,
      viewCube: this.state.viewCube,
      selectionFrom: this.state.selectionFrom,
      selectionTo: this.state.selectionTo,
    });
  }

  private _setLargeViewOnRight() {
    // the menu change to hide the dropdown will fire at the same time, and its state changes will overwrite this one.
    // so wait a beat and update state then.
    window.setTimeout(this._setLargeViewOnRightImpl, 2);
  }

  private _setLargeViewOnRightImpl() {
    if (this.state === null) {
      return;
    }

    const newViewMode = WorldViewMode.largeViewOnRight;

    this.setState({
      activeFile: this.state.activeFile,
      activeFolder: this.state.activeFolder,
      activeWorld: this.state.activeWorld,
      activeDimension: this.state.activeDimension,
      menuState: WorldViewMenuState.noMenu,
      viewMode: newViewMode,
      y: this.state.y,
      mapDisplayMode: this.state.mapDisplayMode,
      viewFrom: this.state.viewFrom,
      viewCube: this.state.viewCube,
      selectionFrom: this.state.selectionFrom,
      selectionTo: this.state.selectionTo,
    });
  }

  private _setFullWorldView() {
    window.setTimeout(this._setFullWorldViewImpl, 2);
  }

  private _setFullWorldViewImpl() {
    if (this.state === null) {
      return;
    }

    this.setState({
      activeFile: this.state.activeFile,
      activeFolder: this.state.activeFolder,
      activeWorld: this.state.activeWorld,
      activeDimension: this.state.activeDimension,
      menuState: WorldViewMenuState.noMenu,
      viewMode: WorldViewMode.fullWorldView,
      y: this.state.y,
      mapDisplayMode: this.state.mapDisplayMode,
      viewFrom: this.state.viewFrom,
      viewCube: this.state.viewCube,
      selectionFrom: this.state.selectionFrom,
      selectionTo: this.state.selectionTo,
    });
  }

  private _setWorldViewer3D() {
    window.setTimeout(this._setWorldViewer3DImpl, 2);
  }

  private _setWorldViewer3DImpl() {
    if (this.state === null) {
      return;
    }

    this.setState({
      activeFile: this.state.activeFile,
      activeFolder: this.state.activeFolder,
      activeWorld: this.state.activeWorld,
      activeDimension: this.state.activeDimension,
      menuState: WorldViewMenuState.noMenu,
      viewMode: WorldViewMode.worldViewer3D,
      y: this.state.y,
      mapDisplayMode: this.state.mapDisplayMode,
      viewFrom: this.state.viewFrom,
      viewCube: this.state.viewCube,
      selectionFrom: this.state.selectionFrom,
      selectionTo: this.state.selectionTo,
    });
  }

  private _setWorldViewerMapOnLeft() {
    window.setTimeout(this._setWorldViewerMapOnLeftImpl, 2);
  }

  private _setWorldViewerMapOnLeftImpl() {
    if (this.state === null) {
      return;
    }

    this.setState({
      activeFile: this.state.activeFile,
      activeFolder: this.state.activeFolder,
      activeWorld: this.state.activeWorld,
      activeDimension: this.state.activeDimension,
      menuState: WorldViewMenuState.noMenu,
      viewMode: WorldViewMode.worldViewerMapOnLeft,
      y: this.state.y,
      mapDisplayMode: this.state.mapDisplayMode,
      viewFrom: this.state.viewFrom,
      viewCube: this.state.viewCube,
      selectionFrom: this.state.selectionFrom,
      selectionTo: this.state.selectionTo,
    });
  }

  async _handleMcworldLoaded(world: MCWorld, worldA: MCWorld) {
    Log.message(`[WorldDisplay] _handleMcworldLoaded called, world=${world ? "exists" : "null"}`);

    // Unsubscribe from previous world if any
    if (this._subscribedWorld && this._subscribedWorld !== world) {
      // Note: ste-events subscription cleanup happens via React lifecycle
      this._subscribedWorld = undefined;
    }

    // Subscribe to world events for real-time updates
    if (world && world !== this._subscribedWorld) {
      this._subscribedWorld = world;

      // Subscribe to chunk updates (individual chunks being modified)
      world.onChunkUpdated.subscribe(this._handleChunkUpdated);

      // Subscribe to world data reloads (metadata/file changes)
      world.onWorldDataReloaded.subscribe(this._handleWorldDataReloaded);

      // Start listening to storage events if not already
      if (!world.isListeningToStorage) {
        world.startListeningToStorage();
      }
    }

    this.setState({
      activeWorld: world,
      activeFile: this.state.activeFile,
      activeFolder: this.state.activeFolder,
      activeDimension: this.state.activeDimension,
      viewMode: this.state.viewMode,
      y: this.state.y,
      mapDisplayMode: this.state.mapDisplayMode,
      viewFrom: this.state.viewFrom,
      viewCube: this.state.viewCube,
      selectionFrom: this.state.selectionFrom,
      selectionTo: this.state.selectionTo,
    });
  }

  /**
   * Handle a chunk being updated (e.g., from external file change).
   * Forces the map to redraw affected tiles.
   */
  private _handleChunkUpdated(world: MCWorld, chunk: any) {
    // Force a re-render to update the map
    this.forceUpdate();

    // If we have an active map, tell it to redraw the affected area
    if (this._activeMap) {
      // WorldMap will detect the chunk update and redraw
      this._activeMap.forceUpdate();
    }
  }

  /**
   * Handle world data being reloaded (e.g., level.dat, packs changed).
   * Updates the component to reflect the new world state.
   */
  private _handleWorldDataReloaded(world: MCWorld, source: string) {
    // Force a re-render to show updated world info
    this.forceUpdate();

    // If it's a significant change like leveldb, the map may need full refresh
    if (source === "leveldb" && this._activeMap) {
      this._activeMap.forceUpdate();
    }
  }

  _openInMinecraft() {
    if (!this.state || !this.state.activeWorld || !this.state.activeWorld.folder) {
      return;
    }

    const path = StorageUtilities.getLeafName(this.state.activeWorld.folder.fullPath);

    AppServiceProxy.sendAsync(AppServiceProxyCommands.minecraftShell, "mode/?load=" + path);
    AppServiceProxy.sendAsync(AppServiceProxyCommands.windowRightSide, "");
  }

  _teleportInMinecraft() {
    if (!this.state || !this.state.activeWorld || !this.state.selectionFrom) {
      return;
    }

    this.props.creatorTools.runMinecraftCommand(
      "tp @p " + this.state.selectionFrom.x + " " + (this.state.selectionFrom.y + 1) + " " + this.state.selectionFrom.z
    );
  }

  _handleYChange(newY: number) {
    this.setState({
      activeWorld: this.state.activeWorld,
      activeFile: this.state.activeFile,
      activeFolder: this.state.activeFolder,
      activeDimension: this.state.activeDimension,
      viewMode: this.state.viewMode,
      y: newY,
      mapDisplayMode: this.state.mapDisplayMode,
      viewFrom: this.state.viewFrom,
      viewCube: this.state.viewCube,
      selectionFrom: this.state.selectionFrom,
      selectionTo: this.state.selectionTo,
    });
  }

  _handleMapDisplayModeChange(newMapDisplayMode: WorldMapDisplayMode) {
    this.setState({
      activeWorld: this.state.activeWorld,
      activeFile: this.state.activeFile,
      activeFolder: this.state.activeFolder,
      activeDimension: this.state.activeDimension,
      viewMode: this.state.viewMode,
      y: this.state.y,
      mapDisplayMode: newMapDisplayMode,
      viewCube: this.state.viewCube,
      selectionFrom: this.state.selectionFrom,
      selectionTo: this.state.selectionTo,
    });
  }

  _handleCameraUpdate(x: number, y: number, z: number, yaw: number) {
    if (this._activeMap) {
      this._activeMap.setCameraPosition(x, y, z, yaw);
    } else {
      Log.debug(`[WorldDisplay] _handleCameraUpdate: _activeMap is null`);
    }
  }

  _handleSelectionChange(from: BlockLocation, to: BlockLocation) {
    let viewCube = undefined;
    let viewFrom = undefined;

    if (this.state.activeWorld) {
      viewFrom = new BlockLocation(from.x - 10, from.y - 10, from.z - 10);
      const viewTo = new BlockLocation(to.x + 10, to.y + 10, to.z + 10);

      viewCube = this.state.activeWorld.getCube(viewFrom, viewTo);
    }

    if (this.props.onSelectionChange) {
      this.props.onSelectionChange(from, to);
    }

    this.setState({
      activeWorld: this.state.activeWorld,
      activeFile: this.state.activeFile,
      activeFolder: this.state.activeFolder,
      activeDimension: this.state.activeDimension,
      viewMode: this.state.viewMode,
      viewFrom: viewFrom,
      viewCube: viewCube,
      selectionFrom: from,
      selectionTo: to,
      selectedEntity: undefined, // Clear entity selection when a block is selected
    });
  }

  /**
   * Handle entity selection from the map.
   * This is called when the user clicks on an entity marker.
   */
  _handleEntitySelect(entity: ISelectedEntityInfo | undefined) {
    this.setState((prevState) => ({
      activeWorld: prevState.activeWorld,
      activeFile: prevState.activeFile,
      activeFolder: prevState.activeFolder,
      activeDimension: prevState.activeDimension,
      viewMode: prevState.viewMode,
      viewFrom: prevState.viewFrom,
      viewCube: prevState.viewCube,
      selectionFrom: undefined, // Clear block selection when an entity is selected
      selectionTo: undefined,
      selectedEntity: entity,
    }));
  }

  private _handleViewMenuOpen(event: React.MouseEvent<HTMLElement>) {
    this.setState({
      activeFile: this.state.activeFile,
      activeWorld: this.state.activeWorld,
      activeDimension: this.state.activeDimension,
      activeFolder: this.state.activeFolder,
      menuState: WorldViewMenuState.viewMenu,
      menuAnchorEl: event.currentTarget,
      viewFrom: this.state.viewFrom,
      viewCube: this.state.viewCube,
      selectionFrom: this.state.selectionFrom,
      selectionTo: this.state.selectionTo,
      selectedEntity: this.state.selectedEntity,
      viewMode: this.state.viewMode,
    });
  }

  private _handleViewMenuClose() {
    this.setState({
      activeFile: this.state.activeFile,
      activeWorld: this.state.activeWorld,
      activeDimension: this.state.activeDimension,
      activeFolder: this.state.activeFolder,
      menuState: WorldViewMenuState.noMenu,
      menuAnchorEl: null,
      viewFrom: this.state.viewFrom,
      viewCube: this.state.viewCube,
      selectionFrom: this.state.selectionFrom,
      selectionTo: this.state.selectionTo,
      selectedEntity: this.state.selectedEntity,
      viewMode: this.state.viewMode,
    });
  }

  _getRegionDescriptor(regionNum: number, region: IRegion) {
    return (
      DimensionNames[regionNum] +
      ": (" +
      region.minX * 16 +
      ", " +
      region.minZ * 16 +
      ") to (" +
      region.maxX * 16 +
      ", " +
      region.maxZ * 16 +
      ")"
    );
  }

  _handleAnchorRegionSelect(event: SelectChangeEvent<string>) {
    if (this.state === null || this.state.activeWorld === undefined) {
      return;
    }

    const anchors = this.state.activeWorld.anchors;
    let result = event.target.value;

    if (anchors) {
      if (result !== undefined && typeof result === "string") {
        const anchor = anchors.get(result);

        if (anchor) {
          const selFrom = new BlockLocation(anchor.from.x, anchor.from.y, anchor.from.z);
          let selTo = undefined;

          if (anchor.to) {
            selTo = new BlockLocation(anchor.to.x, anchor.to.y, anchor.to.z);
          }

          this.setState({
            activeWorld: this.state.activeWorld,
            activeFile: this.state.activeFile,
            activeFolder: this.state.activeFolder,
            activeDimension: this.state.activeDimension,
            viewMode: this.state.viewMode,
            menuState: this.state.menuState,
            y: this.state.y,
            mapDisplayMode: this.state.mapDisplayMode,
            viewFrom: this.state.viewFrom,
            viewCube: this.state.viewCube,
            selectionFrom: selFrom,
            selectionTo: selTo,
          });

          return;
        }
      }
    }

    for (const dimRegions in this.state.activeWorld.regionsByDimension) {
      const regions = this.state.activeWorld.regionsByDimension[dimRegions];
      const dimRegionNum = parseInt(dimRegions);

      for (const region of regions) {
        if (result === this._getRegionDescriptor(dimRegionNum, region)) {
          const selFrom = new BlockLocation(region.minX * 16, 0, region.minZ * 16);
          const selTo = new BlockLocation(region.maxX * 16, 64, region.maxZ * 16);

          this.setState({
            activeWorld: this.state.activeWorld,
            activeFile: this.state.activeFile,
            activeFolder: this.state.activeFolder,
            activeDimension: dimRegionNum,
            viewMode: this.state.viewMode,
            menuState: this.state.menuState,
            y: this.state.y,
            mapDisplayMode: this.state.mapDisplayMode,
            viewFrom: this.state.viewFrom,
            viewCube: this.state.viewCube,
            selectionFrom: selFrom,
            selectionTo: selTo,
          });

          if (this._activeMap) {
            this._activeMap.setView(selFrom, selTo);
          }

          return;
        }
      }
    }
  }

  render() {
    const width = WebUtilities.getWidth();
    let isCompact = false;

    if (width < 1016) {
      isCompact = true;
    }

    let worldToRender: MCWorld | undefined = this.props.world;
    const height = "calc(100vh - " + this.props.heightOffset + "px)";

    if (this.state && this.state.activeWorld) {
      worldToRender = this.state.activeWorld;
    }

    if (!worldToRender && this.state.activeFolder && this.state.activeFolder.manager) {
      worldToRender = this.state.activeFolder.manager as MCWorld;
    }

    if (!worldToRender && this.state.activeFile && this.state.activeFile.manager) {
      worldToRender = this.state.activeFile.manager as MCWorld;
    }

    if (worldToRender === undefined) {
      if (this.state.activeFile) {
        if (this.state.activeFile.manager === undefined) {
          this._updateManager();
        }
      }

      if (this.state.activeFolder) {
        if (this.state.activeFolder.manager === undefined) {
          this._updateManager();
        }
      }

      return <div>Loading... {worldToRender + ", " + this.state.activeFile + ", " + this.state.activeFolder}</div>;
    }

    const toolbarItems: JSX.Element[] = [];

    if (AppServiceProxy.hasAppServiceOrDebug) {
      toolbarItems.push(
        <Button key="openInMC" onClick={this._openInMinecraft} title="Open in Minecraft" size="small">
          <OpenInMinecraftLabel />
        </Button>
      );

      toolbarItems.push(
        <Button key="teleportInMC" onClick={this._teleportInMinecraft} title="Teleport in Minecraft" size="small">
          <TeleportInMinecraftLabel />
        </Button>
      );
    }

    toolbarItems.push(
      <Button
        key="viewMenu"
        onClick={this._handleViewMenuOpen}
        title="More"
        size="small"
        aria-haspopup="true"
        aria-expanded={this.state.menuState === WorldViewMenuState.viewMenu}
      >
        <ViewLabel isCompact={false} />
      </Button>
    );

    let detailsArea = <></>;

    // Entity selection takes priority over block selection
    if (this.state.selectedEntity) {
      const entity = this.state.selectedEntity;

      // Get the entity type ID without namespace for model viewer
      const entityTypeId = entity.identifier.replace("minecraft:", "");

      detailsArea = (
        <div className="wv-detailsArea wv-entityInfo">
          <div className="wv-entityPreviewContainer">
            <div className="wv-entityPreview">
              <ModelViewer
                key={entity.identifier}
                creatorTools={this.props.creatorTools}
                project={this.props.project}
                heightOffset={this.props.heightOffset + 250}
                entityTypeId={entityTypeId}
                readOnly={true}
              />
            </div>
          </div>
          <div className="wv-entityDetails">
            <div className="wv-entityHeader">
              <span className="wv-entityEmoji" style={{ color: entity.color }}>
                {entity.emoji}
              </span>
              <span className="wv-entityName">{entity.shortName}</span>
            </div>
            <div className="wv-entityId">{entity.identifier}</div>
            <div className="wv-entityCoords">
              X: {Math.round(entity.x)}, Y: {Math.round(entity.y)}, Z: {Math.round(entity.z)}
            </div>
            {entity.customName && <div className="wv-entityCustomName">Name: {entity.customName}</div>}
            <div className="wv-entityTags">
              {entity.isBaby && <span className="wv-entityTag">Baby</span>}
              {entity.isTamed && <span className="wv-entityTag">Tamed</span>}
            </div>
          </div>
        </div>
      );
    } else if (this.state.selectionFrom) {
      if (
        !this.state.selectionTo ||
        (this.state.selectionTo.x === this.state.selectionFrom.x &&
          this.state.selectionFrom.y === this.state.selectionTo.y &&
          this.state.selectionTo.z === this.state.selectionFrom.z)
      ) {
        // Single block selected - show enhanced block info
        const block = this.props.world?.getBlock(this.state.selectionFrom);
        const x = this.state.selectionFrom.x;
        const y = this.state.selectionFrom.y;
        const z = this.state.selectionFrom.z;

        if (block && block.blockType) {
          const blockType = block.blockType;
          const friendlyName = blockType.friendlyName;
          const shortId = blockType.shortId;
          const mapColor = blockType.mapColor || "#808080";
          const isCustomBlock = blockType.isCustom;
          const blockId = blockType.id;

          // Get texture URL for block preview
          let textureUrl: string | undefined;

          // For vanilla blocks, always use the HTTP path to the texture
          // For custom blocks, try to get the texture from the WorldMap's custom block cache
          if (!isCustomBlock) {
            // Vanilla block - use HTTP path
            const textureName = blockType.getIcon() || shortId;
            textureUrl = `${CreatorToolsHost.getVanillaContentRoot()}res/latest/van/serve/resource_pack/textures/blocks/${textureName}.png`;
          } else if (this._activeMap) {
            // Custom block - get the base64 data URL from the WorldMap's cache
            const customBlockInfo = (this._activeMap as any)._getCustomBlockInfo?.(blockId);
            if (customBlockInfo?.textureDataUrl) {
              textureUrl = customBlockInfo.textureDataUrl;
            }
          }

          detailsArea = (
            <div className="wv-detailsArea wv-blockInfo">
              <div className="wv-blockPreview">
                <div className="wv-blockColorSwatch" style={{ backgroundColor: mapColor }} />
                {textureUrl && <img className="wv-blockTexture" src={textureUrl} alt={shortId} />}
              </div>
              <div className="wv-blockDetails">
                <div className="wv-blockName">{friendlyName}</div>
                <div className="wv-blockId">{isCustomBlock ? blockId : `minecraft:${shortId}`}</div>
                <div className="wv-blockCoords">
                  X: {x}, Y: {y}, Z: {z}
                </div>
              </div>
            </div>
          );
        } else {
          // No block data - just show coordinates
          detailsArea = (
            <div className="wv-detailsArea wv-blockInfo">
              <div className="wv-blockDetails">
                <div className="wv-blockName">Air</div>
                <div className="wv-blockCoords">
                  X: {x}, Y: {y}, Z: {z}
                </div>
              </div>
            </div>
          );
        }
      } else {
        // Selection range
        const details =
          this.state.selectionFrom.x +
          ", " +
          this.state.selectionFrom.y +
          ", " +
          this.state.selectionFrom.z +
          " to " +
          this.state.selectionTo.x +
          ", " +
          this.state.selectionTo.y +
          ", " +
          this.state.selectionTo.z;
        detailsArea = <div className="wv-detailsArea wv-rangeInfo">Selection: {details}</div>;
      }
    }

    const worldMap = (
      <WorldMap
        creatorTools={this.props.creatorTools}
        world={worldToRender}
        activeDimension={this.state.activeDimension}
        onSetActiveMap={this._setActiveMap}
        heightOffset={this.props.heightOffset + 33}
        onSelectionChange={this._handleSelectionChange}
        onEntitySelect={this._handleEntitySelect}
        onYChange={this._handleYChange}
        onDisplayModeChange={this._handleMapDisplayModeChange}
      />
    );

    let threeDView = <></>;

    const isWorldViewer3DMode =
      this.state.viewMode === WorldViewMode.fullWorldView ||
      this.state.viewMode === WorldViewMode.worldViewer3D ||
      this.state.viewMode === WorldViewMode.worldViewerMapOnLeft;

    if (isWorldViewer3DMode && worldToRender) {
      // Use WorldViewer for full 3D world rendering with textured chunks
      threeDView = (
        <WorldViewer
          world={worldToRender}
          heightOffset={this.props.heightOffset + 33}
          onCameraUpdate={this._handleCameraUpdate}
        />
      );
    } else if (
      !isWorldViewer3DMode &&
      this.state.viewMode !== WorldViewMode.mapOnly &&
      this.state.viewCube &&
      this.state.viewFrom
    ) {
      threeDView = (
        <VolumeEditor
          viewMode={VolumeEditorViewMode.Structure}
          blockVolume={this.state.viewCube}
          xCoordOffset={this.state.viewFrom.x}
          yCoordOffset={this.state.viewFrom.y}
          zCoordOffset={this.state.viewFrom.z}
        />
      );
    }

    let layout = <></>;
    let effectiveViewMode = this.state.viewMode;

    if (isCompact) {
      effectiveViewMode = WorldViewMode.mapOnly;
    }

    if (effectiveViewMode === WorldViewMode.mapOnly) {
      layout = (
        <div className="wv-mapOnly">
          <div className="wv-mapOnlyMap">
            {worldMap}
            {detailsArea}
          </div>
        </div>
      );
    } else if (effectiveViewMode === WorldViewMode.smallViewOnRight) {
      layout = (
        <div className="wv-viewOnRight">
          <div className="wv-viewOnRightMap">
            {worldMap}
            {detailsArea}
          </div>
          <div className="wv-viewOnRightView">{threeDView}</div>
        </div>
      );
    } else if (effectiveViewMode === WorldViewMode.smallViewOnLeft) {
      layout = (
        <div className="wv-viewOnLeft">
          <div className="wv-viewOnLeftView">{threeDView}</div>
          <div className="wv-viewOnLeftMap">
            {worldMap}
            {detailsArea}
          </div>
        </div>
      );
    } else if (effectiveViewMode === WorldViewMode.largeViewOnLeft) {
      layout = (
        <div className="wv-viewOnRight">
          <div className="wv-viewOnRightMap">{threeDView}</div>
          <div className="wv-viewOnRightView">
            {worldMap}
            {detailsArea}
          </div>
        </div>
      );
    } else if (effectiveViewMode === WorldViewMode.largeViewOnRight) {
      layout = (
        <div className="wv-viewOnLeft">
          <div className="wv-viewOnLeftView">
            {worldMap}
            {detailsArea}
          </div>
          <div className="wv-viewOnLeftMap">{threeDView}</div>
        </div>
      );
    } else if (effectiveViewMode === WorldViewMode.viewOnBottom) {
      layout = (
        <div className="wv-viewOnBottom">
          <div className="wv-viewOnBottomMap">
            {worldMap}
            {detailsArea}
          </div>
          <div className="wv-viewOnBottomView">{threeDView}</div>
        </div>
      );
    } else if (effectiveViewMode === WorldViewMode.fullWorldView) {
      layout = (
        <div className="wv-mapOnly">
          <div className="wv-mapOnlyMap">{threeDView}</div>
        </div>
      );
    } else if (effectiveViewMode === WorldViewMode.worldViewer3D) {
      layout = (
        <div className="wv-worldViewer3D">
          <div className="wv-worldViewer3DView">{threeDView}</div>
          <div className="wv-worldViewer3DMap">
            {worldMap}
            {detailsArea}
          </div>
        </div>
      );
    } else if (effectiveViewMode === WorldViewMode.worldViewerMapOnLeft) {
      layout = (
        <div className="wv-worldViewerMapOnLeft">
          <div className="wv-worldViewerMapOnLeftMap">
            {worldMap}
            {detailsArea}
          </div>
          <div className="wv-worldViewerMapOnLeftView">{threeDView}</div>
        </div>
      );
    }

    let anchorRegions: string[] = [];

    if (this.state !== null && this.state.activeWorld !== undefined) {
      if (this.state.activeWorld.anchors !== undefined) {
        anchorRegions = this.state.activeWorld.anchors.getKeys();
      }

      for (const dimRegions in this.state.activeWorld.regionsByDimension) {
        const regions = this.state.activeWorld.regionsByDimension[dimRegions];
        const dimRegionNum = parseInt(dimRegions);

        for (const region of regions) {
          anchorRegions.push(this._getRegionDescriptor(dimRegionNum, region));
        }
      }
    }

    let dimName = "Overworld";

    if (this.state.activeDimension !== undefined) {
      switch (this.state.activeDimension) {
        case 1:
          dimName = "Nether";
          break;
        case 2:
          dimName = "The End";
          break;
      }
    }

    return (
      <div
        className="wv-main"
        style={{
          height: height,
          minHeight: height,
          maxHeight: height,
        }}
      >
        <div className="wv-toolBar">
          <div className="wv-tools">
            <Stack direction="row" spacing={1} aria-label="World view actions">
              {toolbarItems}
            </Stack>
            <Menu
              anchorEl={this.state.menuAnchorEl}
              open={this.state.menuState === WorldViewMenuState.viewMenu}
              onClose={this._handleViewMenuClose}
            >
              <MenuItem onClick={this._setMapOnly}>
                <FontAwesomeIcon icon={faGithub} className="fa-lg" style={{ marginRight: 8 }} />
                Map only
              </MenuItem>
              <MenuItem onClick={this._setFullWorldView}>
                <FontAwesomeIcon icon={faGithub} className="fa-lg" style={{ marginRight: 8 }} />
                3D world
              </MenuItem>
              <MenuItem onClick={this._setWorldViewer3D}>
                <FontAwesomeIcon icon={faGithub} className="fa-lg" style={{ marginRight: 8 }} />
                3D world + map on right
              </MenuItem>
              <MenuItem onClick={this._setWorldViewerMapOnLeft}>
                <FontAwesomeIcon icon={faGithub} className="fa-lg" style={{ marginRight: 8 }} />
                3D world + map on left
              </MenuItem>
            </Menu>
          </div>
          <div className="wv-anchors">
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <Select
                value={anchorRegions.length > 0 ? anchorRegions[0] : ""}
                displayEmpty
                onChange={this._handleAnchorRegionSelect}
                renderValue={() => dimName}
              >
                {anchorRegions.map((item) => (
                  <MenuItem key={item} value={item}>
                    {item}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </div>
        </div>
        {layout}
      </div>
    );
  }
}
