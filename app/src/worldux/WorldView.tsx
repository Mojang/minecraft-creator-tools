import { Component } from "react";
import MCWorld from "../minecraft/MCWorld";
import WorldMap, { WorldMapDisplayMode } from "./WorldMap";
import IFile from "../storage/IFile";
import IFolder from "../storage/IFolder";
import Database from "../minecraft/Database";
import { Dropdown, DropdownProps, Toolbar } from "@fluentui/react-northstar";
import StorageUtilities from "../storage/StorageUtilities";
import "./WorldView.css";
import AppServiceProxy, { AppServiceProxyCommands } from "../core/AppServiceProxy";
import { OpenInMinecraftLabel, TeleportInMinecraftLabel } from "../UX/Labels";
import Carto from "../app/Carto";
import BlockLocation from "../minecraft/BlockLocation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGithub } from "@fortawesome/free-brands-svg-icons";

import { ViewLabel } from "../UX/Labels";
import VolumeEditor, { VolumeEditorViewMode } from "./VolumeEditor";
import BlockCube from "../minecraft/BlockCube";
import WebUtilities from "../UX/WebUtilities";
import Project from "../app/Project";

interface IWorldViewProps {
  world?: MCWorld;
  project?: Project;
  file?: IFile;
  folder?: IFolder;
  carto: Carto;
  heightOffset: number;
  initialDisplayMode?: WorldViewMode;
  onSelectionChange?: (from: BlockLocation, to: BlockLocation) => void;
}

interface IWorldViewState {
  activeWorld?: MCWorld;
  activeFile?: IFile;
  activeFolder?: IFolder;
  viewMode: WorldViewMode;
  menuState: WorldViewMenuState;
  y: number;
  mapDisplayMode: WorldMapDisplayMode;
  viewFrom: BlockLocation | undefined;
  viewCube: BlockCube | undefined;
  selectionFrom: BlockLocation | undefined;
  selectionTo: BlockLocation | undefined;
}

export enum WorldViewMode {
  mapOnly = 1,
  smallViewOnLeft = 2,
  smallViewOnRight = 3,
  largeViewOnLeft = 4,
  largeViewOnRight = 5,
  viewOnBottom = 6,
}

export enum WorldViewMenuState {
  noMenu = 0,
  viewMenu = 1,
}

export default class WorldView extends Component<IWorldViewProps, IWorldViewState> {
  _lastFileViewed?: IFile;
  _lastFolderViewed?: IFolder;

  constructor(props: IWorldViewProps) {
    super(props);

    this._handleMcworldLoaded = this._handleMcworldLoaded.bind(this);
    this._openInMinecraft = this._openInMinecraft.bind(this);
    this._handleSelectionChange = this._handleSelectionChange.bind(this);
    this._teleportInMinecraft = this._teleportInMinecraft.bind(this);
    this._handleAnchorSelect = this._handleAnchorSelect.bind(this);
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
    this._handleViewMenuOpen = this._handleViewMenuOpen.bind(this);

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
      y: 0,
      mapDisplayMode: WorldMapDisplayMode.topBlocks,
      viewFrom: undefined,
      viewCube: undefined,
      selectionFrom: undefined,
      selectionTo: undefined,
    };

    this._updateManager();
  }

  static getDerivedStateFromProps(props: IWorldViewProps, state: IWorldViewState) {
    if (state === undefined || state === null) {
      state = {
        activeWorld: props.world,
        activeFile: props.file,
        activeFolder: props.folder,
        viewMode: WorldViewMode.smallViewOnRight,
        menuState: WorldViewMenuState.noMenu,
        y: 0,
        mapDisplayMode: WorldMapDisplayMode.topBlocks,
        viewFrom: undefined,
        viewCube: undefined,
        selectionFrom: undefined,
        selectionTo: undefined,
      };

      return state;
    }

    return null; // No change to state
  }

  componentDidUpdate(prevProps: IWorldViewProps, prevState: IWorldViewState) {
    this._updateManager();
  }

  private _updateManager() {
    if (this.state !== undefined && this.state.activeFile !== undefined) {
      if (this.state.activeFile !== this._lastFileViewed) {
        this._lastFileViewed = this.state.activeFile;

        MCWorld.ensureMCWorldOnFile(this.state.activeFile, this.props.project, this._handleMcworldLoaded);
      }
    }

    if (this.state !== undefined && this.state.activeFolder !== undefined) {
      if (this.state.activeFolder !== this._lastFolderViewed) {
        this._lastFolderViewed = this.state.activeFolder;

        MCWorld.ensureMCWorldOnFolder(this.state.activeFolder, this.props.project, this._handleMcworldLoaded);
      }
    }

    this._doUpdate();
  }

  async _doUpdate() {
    if (Database.uxCatalog === null) {
      await Database.loadUx();

      this.forceUpdate();
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

  async _handleMcworldLoaded(world: MCWorld, worldA: MCWorld) {
    this.setState({
      activeWorld: world,
      activeFile: this.state.activeFile,
      activeFolder: this.state.activeFolder,
      viewMode: this.state.viewMode,
      y: this.state.y,
      mapDisplayMode: this.state.mapDisplayMode,
      viewFrom: this.state.viewFrom,
      viewCube: this.state.viewCube,
      selectionFrom: this.state.selectionFrom,
      selectionTo: this.state.selectionTo,
    });
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

    this.props.carto.runMinecraftCommand(
      "tp @p " + this.state.selectionFrom.x + " " + (this.state.selectionFrom.y + 1) + " " + this.state.selectionFrom.z
    );
  }

  _handleYChange(newY: number) {
    this.setState({
      activeWorld: this.state.activeWorld,
      activeFile: this.state.activeFile,
      activeFolder: this.state.activeFolder,
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
      viewMode: this.state.viewMode,
      y: this.state.y,
      mapDisplayMode: newMapDisplayMode,
      viewCube: this.state.viewCube,
      selectionFrom: this.state.selectionFrom,
      selectionTo: this.state.selectionTo,
    });
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
      viewMode: this.state.viewMode,
      viewFrom: viewFrom,
      viewCube: viewCube,
      selectionFrom: from,
      selectionTo: to,
    });
  }

  private _handleViewMenuOpen() {
    let menuVal = WorldViewMenuState.noMenu;

    if (this.state.menuState === WorldViewMenuState.noMenu) {
      menuVal = WorldViewMenuState.viewMenu;
    }

    this.setState({
      activeFile: this.state.activeFile,
      activeWorld: this.state.activeWorld,
      activeFolder: this.state.activeFolder,
      menuState: menuVal,
      viewFrom: this.state.viewFrom,
      viewCube: this.state.viewCube,
      selectionFrom: this.state.selectionFrom,
      selectionTo: this.state.selectionTo,
      viewMode: this.state.viewMode,
    });
  }

  _handleAnchorSelect(
    event: React.MouseEvent<Element, MouseEvent> | React.KeyboardEvent<Element> | null,
    data: DropdownProps
  ) {
    if (
      this.state === null ||
      this.state.activeWorld === undefined ||
      this.state.activeWorld.anchors === undefined ||
      data.value === null ||
      data.value === undefined
    ) {
      return;
    }

    const result = data.value;

    if (result !== undefined && typeof result === "string") {
      const anchor = this.state.activeWorld.anchors.get(result);

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
          viewMode: this.state.viewMode,
          menuState: this.state.menuState,
          y: this.state.y,
          mapDisplayMode: this.state.mapDisplayMode,
          viewFrom: this.state.viewFrom,
          viewCube: this.state.viewCube,
          selectionFrom: selFrom,
          selectionTo: selTo,
        });
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

      return <div>Loading... {worldToRender + "|" + this.state.activeFile + "|" + this.state.activeFolder}</div>;
    }

    const toolbarItems = [];

    if (AppServiceProxy.hasAppServiceOrDebug) {
      toolbarItems.push({
        icon: <OpenInMinecraftLabel />,
        key: "openInMC",
        onClick: this._openInMinecraft,
        title: "Open in Minecraft",
      });

      toolbarItems.push({
        icon: <TeleportInMinecraftLabel />,
        key: "teleportInMC",
        onClick: this._teleportInMinecraft,
        title: "Teleport in Minecraft",
      });
    }

    const viewMenuItems: any[] = [];

    viewMenuItems.push({
      key: "mapOnly",
      content: "Map only",
      icon: <FontAwesomeIcon icon={faGithub} className="fa-lg" />,
      title: "Map only",
      onClick: this._setMapOnly,
    });

    viewMenuItems.push({
      key: "lmViewOnLeft",
      content: "Small view on the left",
      icon: <FontAwesomeIcon icon={faGithub} className="fa-lg" />,
      title: "Small view on the left",
      onClick: this._setSmallViewOnLeft,
    });

    viewMenuItems.push({
      key: "viewOnRight",
      content: "Small view on the right",
      icon: <FontAwesomeIcon icon={faGithub} className="fa-lg" />,
      title: "Small view on the right",
      onClick: this._setSmallViewOnRight,
    });

    viewMenuItems.push({
      key: "smViewOnLeft",
      content: "Large view on the left",
      icon: <FontAwesomeIcon icon={faGithub} className="fa-lg" />,
      title: "Large view on the left",
      onClick: this._setLargeViewOnLeft,
    });

    viewMenuItems.push({
      key: "smViewOnRight",
      content: "Large view on the right",
      icon: <FontAwesomeIcon icon={faGithub} className="fa-lg" />,
      title: "Large view on the right",
      onClick: this._setLargeViewOnRight,
    });

    toolbarItems.push({
      icon: <ViewLabel isCompact={false} />,
      key: "more",
      active: this.state.menuState === WorldViewMenuState.viewMenu,
      title: "More",
      menu: viewMenuItems,
      menuOpen: this.state.menuState === WorldViewMenuState.viewMenu,
      onMenuOpenChange: this._handleViewMenuOpen,
    });

    let detailsArea = <></>;

    if (this.state.selectionFrom) {
      detailsArea = (
        <div className="wv-detailsArea">
          {" "}
          {this.state.selectionFrom.x} | {this.state.selectionFrom.z}{" "}
        </div>
      );
    }

    const worldMap = (
      <WorldMap
        carto={this.props.carto}
        world={worldToRender}
        heightOffset={this.props.heightOffset + 33}
        onSelectionChange={this._handleSelectionChange}
        onYChange={this._handleYChange}
        onDisplayModeChange={this._handleMapDisplayModeChange}
      />
    );

    let threeDView = <></>;

    if (this.state.viewMode !== WorldViewMode.mapOnly && this.state.viewCube && this.state.viewFrom) {
      threeDView = (
        <VolumeEditor
          viewMode={VolumeEditorViewMode.Structure}
          blockCube={this.state.viewCube}
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
          <div className="wv-mapOnlyMap">{worldMap}</div>
          <div className="wv-mapOnlyDetails">{detailsArea}</div>
        </div>
      );
    } else if (effectiveViewMode === WorldViewMode.smallViewOnRight) {
      layout = (
        <div className="wv-viewOnRight">
          <div className="wv-viewOnRightMap">{worldMap}</div>
          <div className="wv-viewOnRightView">{threeDView}</div>
          <div className="wv-viewOnRightDetails">{detailsArea}</div>
        </div>
      );
    } else if (effectiveViewMode === WorldViewMode.smallViewOnLeft) {
      layout = (
        <div className="wv-viewOnLeft">
          <div className="wv-viewOnLeftView">{threeDView}</div>
          <div className="wv-viewOnLeftMap">{worldMap}</div>
          <div className="wv-viewOnLeftDetails">{detailsArea}</div>
        </div>
      );
    } else if (effectiveViewMode === WorldViewMode.largeViewOnLeft) {
      layout = (
        <div className="wv-viewOnRight">
          <div className="wv-viewOnRightMap">{threeDView}</div>
          <div className="wv-viewOnRightView">{worldMap}</div>
          <div className="wv-viewOnRightDetails">{detailsArea}</div>
        </div>
      );
    } else if (effectiveViewMode === WorldViewMode.largeViewOnRight) {
      layout = (
        <div className="wv-viewOnLeft">
          <div className="wv-viewOnLeftView">{worldMap}</div>
          <div className="wv-viewOnLeftMap">{threeDView}</div>
          <div className="wv-viewOnLeftDetails">{detailsArea}</div>
        </div>
      );
    } else if (effectiveViewMode === WorldViewMode.viewOnBottom) {
      layout = (
        <div className="wv-viewOnBottom">
          <div className="wv-viewOnBottomView">{worldMap}</div>
          <div className="wv-viewOnBottomMap">{threeDView}</div>
          <div className="wv-viewOnBottomDetails">{detailsArea}</div>
        </div>
      );
    }

    let anchors: string[] = [];

    if (this.state !== null && this.state.activeWorld !== undefined && this.state.activeWorld.anchors !== undefined) {
      anchors = this.state.activeWorld.anchors.getKeys();
    }

    return (
      <div
        className="wv-main"
        style={{
          minHeight: height,
          maxHeight: height,
        }}
      >
        <div className="wv-toolBar">
          <div className="wv-tools">
            <Toolbar aria-label="Editor toolbar overflow menu" items={toolbarItems} />
          </div>
          <div className="wv-anchors">
            <Dropdown
              items={anchors}
              defaultValue={anchors.length > 0 ? anchors[0] : ""}
              placeholder={"Anchors"}
              onChange={this._handleAnchorSelect}
            />
          </div>
        </div>
        {layout}
      </div>
    );
  }
}
