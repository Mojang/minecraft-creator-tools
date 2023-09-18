import { Component } from "react";
import MCWorld from "../minecraft/MCWorld";
import Carto from "../app/Carto";
import L, { LatLngExpression } from "leaflet";
import "leaflet/dist/leaflet.css";
import ImageLoadManager from "./ImageLoadManger";
import "./WorldMap.css";
import GameStateManager from "../minecraft/GameStateManager";
import IPlayerTravelledEvent from "../minecraft/IPlayerTravelledEvent";
import BlockLocation from "../minecraft/BlockLocation";
import WorldDisplayObject, { WorldDisplayObjectType } from "./WorldDisplayObject";
import CartoApp from "../app/CartoApp";

interface IWorldMapProps {
  world: MCWorld;
  carto: Carto;
  heightOffset?: number;
  displayObjects?: WorldDisplayObject[];
  onSelectionChange?: (from: BlockLocation, to: BlockLocation) => void;
  onYChange?: (newY: number) => void;
  onDisplayModeChange?: (newMapDisplayMode: WorldMapDisplayMode) => void;
}

export enum WorldMapDisplayMode {
  topBlocks = 0,
  fixedY = 1,
}

interface IWorldMapState {}

/* Implementation approach:

Tiles are 256x256 pixels
           0 - 1 
           1 - 2
           2 - 5
Zoom level 3 - 10 (the 4th zoom level) = Render map colors per block (pixel solid map color per block)
           4 - 20 - Each block gets 2px - Map colors per block (2px x 2px solid map color per block). 
           5 - 40 - Each block gets 4px - Map colors per block (4px x 4px solid map color per block).  4 x 4 chunks
           6 - 80 - Each block gets 8px.  2x2 chunks
Zoom level 7 - 160 (the 8th zoom level) = "chunk size" -- coords represent a chunk.  Each block gets 16px
*/

export default class WorldMap extends Component<IWorldMapProps, IWorldMapState> {
  _mapOuterDiv: HTMLDivElement | null = null;
  _mapDiv: HTMLDivElement | null = null;
  _map: L.Map | null = null;
  _spawnX: number = 0;
  _spawnZ: number = 0;
  _minX: number = 0;
  _maxX: number = 0;
  _minZ: number = 0;
  _maxZ: number = 0;
  _yLevel = 0;
  _gsm?: GameStateManager;
  _lastWorldSet: MCWorld | undefined;
  _levelStatusElt: HTMLDivElement | undefined = undefined;
  _curLayer: L.GridLayer | undefined = undefined;
  _isTops = true;
  _mapTiles: { [id: string]: ImageLoadManager | undefined } = {};
  _spawnLocationMarker: L.Marker | undefined;
  _playerMarker: L.Marker | undefined;
  _selectedBlockLocationFrom: BlockLocation | undefined;
  _selectedBlockLocationTo: BlockLocation | undefined;
  _selectionRectangle: L.Rectangle | undefined;
  _mapElements: L.Layer[] = [];
  _playerPath: L.Polyline | undefined;
  _posToCoordDivisor = 8;

  constructor(props: IWorldMapProps) {
    super(props);

    this._setMapOuter = this._setMapOuter.bind(this);
    this._doResize = this._doResize.bind(this);
    this._renderTile = this._renderTile.bind(this);

    this._handleMapClick = this._handleMapClick.bind(this);

    this._handleTopsLevel = this._handleTopsLevel.bind(this);
    this._handleLevelPlus = this._handleLevelPlus.bind(this);
    this._handleLevelMinus = this._handleLevelMinus.bind(this);
    this._handlePlayerTravelled = this._handlePlayerTravelled.bind(this);
  }

  async _setMapOuter(elt: HTMLDivElement | null) {
    if (elt === null) {
      return;
    }

    if (elt !== this._mapOuterDiv) {
      if (this._mapDiv == null) {
        this._mapDiv = document.createElement("div") as HTMLDivElement;

        const world = this.props.world;

        let x = world.spawnX;

        if (x === undefined) {
          x = 0;
        }

        let z = world.spawnZ;

        if (z === undefined) {
          z = 0;
        }

        let minX = world.minX;

        if (minX === undefined) {
          minX = x - 10;
        }

        let maxX = world.maxX;

        if (maxX === undefined) {
          maxX = x + 10;
        }

        let minZ = world.minZ;

        if (minZ === undefined) {
          minZ = z - 10;
        }

        let maxZ = world.maxZ;

        if (maxZ === undefined) {
          maxZ = x + 10;
        }

        this._spawnX = x;
        this._spawnZ = z;
        this._minX = minX;
        this._maxX = maxX;
        this._minZ = minZ;
        this._maxZ = maxZ;

        // per leaflet:
        // In a CRS.Simple, one horizontal map unit is mapped to one horizontal pixel, and idem with vertical.
        // map is 256 pixels by 256 pixels at zoom level 0
        this._map = L.map(this._mapDiv, {
          center: [-(z / this._posToCoordDivisor), x / this._posToCoordDivisor], // in leaflet, it's y, x to match lat, long
          crs: L.CRS.Simple,
          zoom: 7,
          zoomSnap: 0,
          maxZoom: 7,
          attributionControl: false,
        });

        this._mapElements = [];
        this._map.on("click", this._handleMapClick);

        const topsAction = this._handleTopsLevel;
        const plusAction = this._handleLevelPlus;
        const minusAction = this._handleLevelMinus;
        const me = this;

        const LevelControl = L.Control.extend({
          onAdd: function (map: L.Map) {
            const div = L.DomUtil.create("div");

            const divChild = L.DomUtil.create("div"); // as HTMLDivElement;
            div.appendChild(divChild);
            me._levelStatusElt = divChild;

            var button = L.DomUtil.create("button");
            button.innerHTML = "Top";
            button.onclick = topsAction;
            div.appendChild(button);

            button = L.DomUtil.create("button");
            button.innerHTML = "Level+";
            button.onclick = plusAction;
            div.appendChild(button);
            button = L.DomUtil.create("button");
            button.innerHTML = "Level-";
            button.onclick = minusAction;
            div.appendChild(button);
            return div;
          },

          onRemove: function (map: L.Map) {
            // Nothing to do here
          },
        });

        const wm = new LevelControl({ position: "topright" });
        wm.addTo(this._map);
        this._applyNewWorld();
      } else if (this._mapOuterDiv != null) {
        this._mapOuterDiv.removeChild(this._mapDiv);
      }

      elt.appendChild(this._mapDiv);
      setTimeout(this._doResize, 40);
      this._mapOuterDiv = elt;
    }
  }

  async _applyNewWorld() {
    if (!this._map) {
      return;
    }

    const world = this.props.world;

    if (world !== this._lastWorldSet) {
      this._lastWorldSet = world;

      await world.loadData(false);

      this._ensureGameStateManager();
      this._ensureLayer();
      this._ensureDefaultMarkers();
      this._ensureDisplayMarkers();
      this._updateSelection();
    }
  }

  _ensureGameStateManager() {
    if (!this.props.carto || !this.props.carto.activeMinecraft || !this.props.carto.activeMinecraft.gameStateManager) {
      return;
    }

    if (this.props.carto.activeMinecraft.gameStateManager === this._gsm) {
      return;
    }

    if (this._gsm) {
      this._gsm.onPlayerTravelled.unsubscribe(this._handlePlayerTravelled);
    }

    this._gsm = this.props.carto.activeMinecraft.gameStateManager;
    this._gsm.onPlayerTravelled.subscribe(this._handlePlayerTravelled);
  }

  _handleMapClick(e: L.LeafletMouseEvent) {
    const latLng = e.latlng;

    let y = this._yLevel;
    const z = -Math.round(latLng.lat * this._posToCoordDivisor);
    const x = Math.floor(latLng.lng * this._posToCoordDivisor);

    if (this._isTops) {
      const topY = this.props.world.getTopBlockY(x, z);

      if (topY) {
        y = topY;
      }
    }

    this._selectedBlockLocationFrom = new BlockLocation(x, y, z);
    this._selectedBlockLocationTo = this._selectedBlockLocationFrom;

    if (this.props.onSelectionChange) {
      this.props.onSelectionChange(this._selectedBlockLocationFrom, this._selectedBlockLocationTo);
    }

    this._updateSelection();
  }

  _updateSelection() {
    if (!this._map) {
      return;
    }

    if (!this._selectedBlockLocationFrom || !this._selectedBlockLocationTo) {
      if (this._selectionRectangle) {
        this._selectionRectangle.removeFrom(this._map);
      }

      return;
    }

    const bounds = new L.LatLngBounds([
      [
        -this._selectedBlockLocationFrom.z / this._posToCoordDivisor,
        this._selectedBlockLocationFrom.x / this._posToCoordDivisor,
      ],
      [
        -(this._selectedBlockLocationTo.z + 1) / this._posToCoordDivisor,
        (this._selectedBlockLocationTo.x + 1) / this._posToCoordDivisor,
      ],
    ]);

    if (!this._selectionRectangle) {
      this._selectionRectangle = L.rectangle(bounds, { color: "#ff7800", weight: 3 });
    }

    this._selectionRectangle.setBounds(bounds);

    this._selectionRectangle.addTo(this._map);
  }

  _ensureDisplayMarkers() {
    if (!this._map) {
      return;
    }

    const widos = this.props.displayObjects;

    if (widos) {
      for (let i = 0; i < widos.length; i++) {
        const wido = widos[i];

        if (wido && wido.from && wido.type === WorldDisplayObjectType.point) {
          const x = wido.from.x;
          const z = wido.from.z;

          let marker = this._mapElements[wido.id];

          const pos = new L.LatLng(-z / this._posToCoordDivisor, x / this._posToCoordDivisor);

          if (marker === undefined) {
            const icon = L.icon({
              iconUrl: CartoApp.contentRoot + "res/latest/van/resource_pack/textures/blocks/bed_side_f.png",
              iconSize: [32, 32],
              className: "wm-spawnIcon",
              iconAnchor: [0, 0],
              popupAnchor: [-3, -76],
            });

            marker = L.marker(pos, {
              icon: icon,
            });
            this._mapElements[wido.id] = marker;

            marker.addTo(this._map);
          } else {
            (marker as L.Marker).setLatLng(pos);
          }
        } else if (wido && wido.points.length > 1 && wido.type === WorldDisplayObjectType.path) {
          let path = this._mapElements[wido.id];

          const latLngs: LatLngExpression[] = [];

          for (let i = 0; i < wido.points.length; i++) {
            const point = wido.points[i];
            const pos = new L.LatLng(-point.z / this._posToCoordDivisor, point.x / this._posToCoordDivisor);
            latLngs.push(pos);
          }

          if (path === undefined) {
            path = new L.Polyline(latLngs, { color: "red" });
            this._mapElements[wido.id] = path;
            path.addTo(this._map);
          } else {
            (path as L.Polyline).setLatLngs(latLngs);
          }
        }
      }
    }
  }

  _ensureDefaultMarkers() {
    if (!this._map) {
      return;
    }

    const world = this.props.world;

    let x = world.spawnX;

    if (x === undefined) {
      x = 0;
    }

    let z = world.spawnZ;

    if (z === undefined) {
      z = 0;
    }

    if (!this._spawnLocationMarker) {
      const icon = L.icon({
        iconUrl: CartoApp.contentRoot + "res/latest/van/resource_pack/textures/blocks/bed_side_f.png",
        iconSize: [32, 32],
        className: "wm-spawnIcon",
        iconAnchor: [0, 0],
        popupAnchor: [-3, -76],
      });

      this._spawnLocationMarker = L.marker([-z / this._posToCoordDivisor, x / this._posToCoordDivisor], {
        icon: icon,
      });
      this._spawnLocationMarker.addTo(this._map);
    }

    this._spawnLocationMarker.setLatLng([-z / this._posToCoordDivisor, x / this._posToCoordDivisor]);

    if (this._gsm) {
      const playerLocationHistory = this._gsm.playerLocationHistory;
      if (playerLocationHistory) {
        const latLngs: LatLngExpression[] = [];

        for (let i = 0; i < playerLocationHistory.length; i++) {
          const point = playerLocationHistory[i];
          const pos = new L.LatLng(-point.z / this._posToCoordDivisor, point.x / this._posToCoordDivisor);
          latLngs.push(pos);
        }

        if (!this._playerPath) {
          this._playerPath = new L.Polyline(latLngs, { color: "green" });
          this._playerPath.addTo(this._map);
        } else {
          this._playerPath.setLatLngs(latLngs);
        }
      }

      const playerLocation = this._gsm.playerLocation;

      if (playerLocation) {
        if (!this._playerMarker) {
          const myIcon = L.icon({
            iconUrl: CartoApp.contentRoot + "res/latest/van/resource_pack/textures/ui/icon_steve.png",
            iconSize: [32, 32],
            className: "wm-playerIcon",
            iconAnchor: [16, 16],
            popupAnchor: [-3, -76],
          });

          this._playerMarker = L.marker(
            [-(playerLocation.z - 1) / this._posToCoordDivisor, (playerLocation.x - 1) / this._posToCoordDivisor],
            { icon: myIcon }
          );
          this._playerMarker.addTo(this._map);
        }

        this._playerMarker.setLatLng([
          -(playerLocation.z - 1) / this._posToCoordDivisor,
          (playerLocation.x - 1) / this._posToCoordDivisor,
        ]);
      }
    }
  }

  _handlePlayerTravelled(gsm: GameStateManager, message: IPlayerTravelledEvent) {
    this._ensureDefaultMarkers();
  }

  _ensureLayer() {
    if (!this._map) {
      return;
    }

    if (this._levelStatusElt) {
      if (this._isTops) {
        this._levelStatusElt.innerHTML = "TOP";
      } else {
        this._levelStatusElt.innerHTML = this._yLevel + "";
      }
    }
    if (this._curLayer) {
      this._map.removeLayer(this._curLayer);
    }

    const MCLayer = L.GridLayer.extend({
      createTile: this._renderTile,
    });

    this._curLayer = new MCLayer();

    (this._curLayer as L.GridLayer).addTo(this._map);
  }

  _handleTopsLevel(ev: MouseEvent): any {
    this._isTops = !this._isTops;

    this._ensureLayer();
    ev.cancelBubble = true;
    ev.stopPropagation();
    ev.preventDefault();

    return true;
  }

  _handleLevelPlus(ev: MouseEvent): any {
    this._isTops = false;
    this._yLevel++;
    this._ensureLayer();
    ev.cancelBubble = true;
    ev.stopPropagation();
    ev.preventDefault();

    return true;
  }

  _handleLevelMinus(ev: MouseEvent): any {
    this._isTops = false;
    this._yLevel--;
    this._ensureLayer();

    ev.cancelBubble = true;
    ev.stopPropagation();
    ev.preventDefault();

    return true;
  }

  componentDidUpdate(prevProps: IWorldMapProps, prevState: IWorldMapState) {
    this._applyNewWorld();
  }

  _renderTile(coords: { x: number; y: number; z: number }) {
    let chunksInTile = 1;

    if (coords.z < 7) {
      chunksInTile = Math.pow(2, 7 - coords.z);
    }

    const tX = Math.floor(coords.x * chunksInTile);
    const tY = Math.floor(coords.y * chunksInTile);

    const tileHtml = [tX * 16, tY * 16].join(", ");

    // create a <canvas> element for drawing
    const tile = L.DomUtil.create("canvas", "leaflet-tile");

    tile.width = 256;
    tile.height = 256;

    // get a canvas context and draw something on it using coords.x, coords.y and coords.z
    const ctx = tile.getContext("2d");

    if (ctx) {
      for (let chunkInTileX = 0; chunkInTileX < chunksInTile; chunkInTileX++) {
        const chunkXrow = this.props.world.chunks[tX + chunkInTileX];

        if (chunkXrow) {
          for (let chunkInTileZ = 0; chunkInTileZ < chunksInTile; chunkInTileZ++) {
            const chunk = chunkXrow[tY + chunkInTileZ];

            if (chunk) {
              let increment = 1;

              // performance optimization: at very broad zoom levels, use only the increment-nth block as a placeholder for a larger sub-area
              if (chunksInTile >= 32) {
                increment = 8;
              } else if (chunksInTile >= 16) {
                increment = 4;
              } else if (chunksInTile >= 8) {
                increment = 2;
              }

              for (let bX = 0; bX < 16; bX += increment) {
                for (let bZ = 0; bZ < 16; bZ += increment) {
                  let block = undefined;
                  let blockY = this._yLevel;

                  if (this._isTops) {
                    const topBlockY = chunk.getTopBlockY(bX, bZ);

                    if (topBlockY) {
                      blockY = topBlockY;
                      block = chunk.getBlock(bX, topBlockY, bZ); // chunk.getBlock(bX, 11, bZ);
                    } else {
                      block = undefined;
                    }
                  } else {
                    block = chunk.getBlock(bX, this._yLevel, bZ); // chunk.getBlock(bX, 11, bZ);
                  }

                  const blockWidth = 16 / (chunksInTile / increment);

                  if (block && block.bedrockType) {
                    const btype = block.bedrockType;

                    let color = undefined;

                    if (btype.isCustom) {
                      color = "yellow";
                    } else if (btype.shortTypeName === "air") {
                      color = "black";
                    } else if (btype.shortTypeName === "water" || btype.shortTypeName === "flowing_water") {
                      color = "blue";
                    } else if (btype.shortTypeName === "lava") {
                      color = "orange";
                    }

                    if (color) {
                      ctx.fillStyle = color;
                      ctx.fillRect(
                        chunkInTileX * (256 / chunksInTile) + bX * (blockWidth / increment),
                        chunkInTileZ * (256 / chunksInTile) + bZ * (blockWidth / increment),
                        blockWidth,
                        blockWidth
                      );
                    } else {
                      const iconStr = block.bedrockType.getIcon();

                      let imageManager = this._mapTiles[iconStr];

                      if (!imageManager) {
                        imageManager = new ImageLoadManager();
                        imageManager.source =
                          CartoApp.contentRoot + "res/latest/van/resource_pack/textures/blocks/" + iconStr + ".png";

                        this._mapTiles[iconStr] = imageManager;
                      }
                      imageManager.use(
                        ctx,
                        chunkInTileX * (256 / chunksInTile) + bX * (blockWidth / increment),
                        chunkInTileZ * (256 / chunksInTile) + bZ * (blockWidth / increment),
                        blockWidth,
                        blockWidth
                      );
                    }

                    if (this._isTops && coords.z >= 7 /* only add HTML levels at zoomed-in levels*/) {
                      ctx.fillStyle = "black";
                      ctx.fillText(
                        blockY + "",
                        chunkInTileX * (256 / chunksInTile) + bX * blockWidth,
                        chunkInTileZ * (256 / chunksInTile) + bZ * blockWidth + 16,
                        16
                      );
                    }
                  }
                }
              }
            }
          }
        }
      }

      ctx.font = "12px Arial";
      ctx.fillText(tileHtml, 0, 12, 256);
    }

    // return the tile so it can be rendered on screen
    return tile;
  }

  _doResize() {
    if (this._map) {
      this._map.invalidateSize();
    }
  }

  render() {
    if (this.props.world === undefined) {
      return <div>Loading...</div>;
    }
    let height = "100%";

    if (this.props.heightOffset) {
      height = "calc(100vh - " + this.props.heightOffset + "px)";
    }

    return (
      <div
        style={{
          width: "100%",
          textAlign: "left",
          height: "100%",
          minHeight: height,
          maxHeight: height,
        }}
        ref={(c: HTMLDivElement) => this._setMapOuter(c)}
      />
    );
  }
}
