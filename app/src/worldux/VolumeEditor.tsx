import React, { Component } from "react";
import * as BABYLON from "babylonjs";
import * as GUI from "babylonjs-gui";
import BlockCube from "../minecraft/BlockCube";
import Block from "../minecraft/Block";
import FreeCameraKeyboardRotateInput from "../babylon/FreeCameraKeyboardRotateInput";
import BlockMeshFactory from "./BlockMeshFactory";
import IBlockCubeBounds from "../minecraft/IBlockCubeBounds";

interface IVolumeEditorProps {
  blockCube?: BlockCube;
  viewBounds?: IBlockCubeBounds;
  viewMode: VolumeEditorViewMode;
  height?: number;
  heightOffset?: number;
  xCoordOffset?: number;
  yCoordOffset?: number;
  zCoordOffset?: number;
  onSelectedBlocksChanged?: (newSelectedBlocks: Block[] | undefined) => void;
  onClicked?: () => void;
  onApplyRequested?: () => void;
}

interface IVolumeEditorState {}

export enum VolumeEditorViewMode {
  Structure = 0,
  SingleBlock = 1,
}

const REPEAT_KEYBOARD_EVENT_DELAY = 50;

export default class VolumeEditor extends Component<IVolumeEditorProps, IVolumeEditorState> {
  _canvasOuterDiv: HTMLDivElement | null = null;
  _canvas: HTMLCanvasElement | null = null;
  _lastBlockCube?: BlockCube;
  _lastViewBounds?: IBlockCubeBounds;

  private _blockMeshFactory?: BlockMeshFactory;
  private _engine: BABYLON.Engine | null = null;
  private _scene: BABYLON.Scene | null = null;
  private _camera: BABYLON.FreeCamera | null = null;
  private _meshes: { [id: string]: BABYLON.Mesh | undefined } = {};
  private _selectionPlaceholderMesh: BABYLON.Mesh | undefined;
  private _uiTexture: GUI.AdvancedDynamicTexture | undefined;
  private _blockMeshes: { [location: string]: BABYLON.AbstractMesh | undefined } = {};
  private _coordinatesText: GUI.TextBlock | undefined;
  private _hoverBlock: BABYLON.Mesh | undefined;

  private _isHoldingCtrlDown = false;
  private _isHoldingShiftDown = false;

  private _dtLastArrow = new Date();

  selectedBlocks: Block[] | undefined;

  private _selectedBlockMeshes: BABYLON.AbstractMesh[] | undefined;

  private _id?: string;
  static count = 0;

  get effectiveViewBounds() {
    const vb = this.props.viewBounds;

    if (vb !== undefined) {
      return vb;
    }

    if (this.props.blockCube !== undefined) {
      return {
        fromX: 0,
        fromY: 0,
        fromZ: 0,
        toX: this.props.blockCube.maxX,
        toY: this.props.blockCube.maxY,
        toZ: this.props.blockCube.maxZ,
      };
    }

    return {
      fromX: 0,
      fromY: 0,
      fromZ: 0,
      toX: 0,
      toY: 0,
      toZ: 0,
    };
  }

  get isSelectable() {
    return this.props.viewMode === VolumeEditorViewMode.Structure;
  }

  constructor(props: IVolumeEditorProps) {
    super(props);

    this.resize = this.resize.bind(this);
    this._setCanvasOuter = this._setCanvasOuter.bind(this);
    this._handleBlockClick = this._handleBlockClick.bind(this);
    this._handleBlockPointerOver = this._handleBlockPointerOver.bind(this);
    this._handleBlockPointerOut = this._handleBlockPointerOut.bind(this);
    this._handleBlockTypeChanged = this._handleBlockTypeChanged.bind(this);
    this._handleKeyDown = this._handleKeyDown.bind(this);
    this._handleKeyUp = this._handleKeyUp.bind(this);
    this._handleCanvasClick = this._handleCanvasClick.bind(this);

    window.addEventListener("resize", this.resize);
    window.addEventListener("keydown", this._handleKeyDown);
    window.addEventListener("keyup", this._handleKeyUp);

    this._id = "A" + VolumeEditor.count;
    VolumeEditor.count++;

    this._connectToProps();
  }

  _handleKeyDown(event: KeyboardEvent) {
    const now = new Date();

    if (this.props.viewMode === VolumeEditorViewMode.SingleBlock) {
      return;
    }

    if (now.getTime() - this._dtLastArrow.getTime() > REPEAT_KEYBOARD_EVENT_DELAY && this.isSelectable) {
      this._dtLastArrow = now;

      switch (event.key) {
        case " ":
          if (this.selectedBlocks !== undefined && this.selectedBlocks !== null && this.selectedBlocks.length > 0) {
            if (this.props.onApplyRequested !== undefined) {
              this.props.onApplyRequested();
            }
          }
          break;
        case "PageUp":
          this._forceSelection();

          if (this.selectedBlocks !== undefined && this.selectedBlocks !== null && this.selectedBlocks.length > 0) {
            const nextBlock = this.selectedBlocks[0].up;

            if (nextBlock !== undefined) {
              const mesh = this._getMeshForBlock(nextBlock);

              if (mesh !== null && mesh !== undefined) {
                this._singleSelectMesh(mesh);
              }
            }
          }
          break;
        case "PageDown":
          this._forceSelection();

          if (this.selectedBlocks !== undefined && this.selectedBlocks !== null && this.selectedBlocks.length > 0) {
            const nextBlock = this.selectedBlocks[0].down;

            if (nextBlock !== undefined) {
              const mesh = this._getMeshForBlock(nextBlock);

              if (mesh !== null && mesh !== undefined) {
                this._singleSelectMesh(mesh);
              }
            }
          }
          break;
        case "ArrowLeft":
          this._forceSelection();

          if (this.selectedBlocks !== undefined && this.selectedBlocks !== null && this.selectedBlocks.length > 0) {
            const nextBlock = this.selectedBlocks[0].left;

            if (nextBlock !== undefined) {
              const mesh = this._getMeshForBlock(nextBlock);

              if (mesh !== null && mesh !== undefined) {
                this._singleSelectMesh(mesh);
              }
            }
          }
          break;

        case "ArrowRight":
          this._forceSelection();

          if (this.selectedBlocks !== undefined && this.selectedBlocks !== null && this.selectedBlocks.length > 0) {
            const nextBlock = this.selectedBlocks[0].right;

            if (nextBlock !== undefined) {
              const mesh = this._getMeshForBlock(nextBlock);

              if (mesh !== null && mesh !== undefined) {
                this._singleSelectMesh(mesh);
              }
            }
          }

          break;

        case "ArrowUp":
          this._forceSelection();

          if (this.selectedBlocks !== undefined && this.selectedBlocks !== null && this.selectedBlocks.length > 0) {
            const nextBlock = this.selectedBlocks[0].forward;

            if (nextBlock !== undefined) {
              const mesh = this._getMeshForBlock(nextBlock);

              if (mesh !== null && mesh !== undefined) {
                this._singleSelectMesh(mesh);
              }
            }
          }

          break;

        case "ArrowDown":
          this._forceSelection();

          if (this.selectedBlocks !== undefined && this.selectedBlocks !== null && this.selectedBlocks.length > 0) {
            const nextBlock = this.selectedBlocks[0].backward;

            if (nextBlock !== undefined) {
              const mesh = this._getMeshForBlock(nextBlock);

              if (mesh !== null && mesh !== undefined) {
                this._singleSelectMesh(mesh);
              }
            }
          }

          break;
      }
    }

    this._isHoldingCtrlDown = event.ctrlKey;
    this._isHoldingShiftDown = event.shiftKey;
  }

  _getMeshForBlock(block: Block) {
    if (block.y === undefined || block.z === undefined) {
      return undefined;
    }

    return this._blockMeshes[block.x + "." + block.y + "." + block.z];
  }

  _forceSelection() {
    if ((this.selectedBlocks !== undefined && this.selectedBlocks.length > 0) || this.props.blockCube === undefined) {
      return;
    }

    if (this._hoverBlock !== undefined) {
      this._singleSelectMesh(this._hoverBlock);
      return;
    }

    const blockMesh = this._getMeshForBlock(this.props.blockCube.x(0).y(0).z(0));

    if (blockMesh !== undefined) {
      this._singleSelectMesh(blockMesh);
    }
  }

  _handleKeyUp(event: KeyboardEvent) {
    this._isHoldingCtrlDown = event.ctrlKey;
    this._isHoldingShiftDown = event.shiftKey;
  }

  componentDidMount() {}

  componentDidUpdate(prevProps: IVolumeEditorProps, prevState: IVolumeEditorState) {
    if (prevProps !== undefined && prevProps.blockCube !== undefined) {
      prevProps.blockCube.onBlockTypeChanged.unsubscribe(this._handleBlockTypeChanged);
      prevProps.blockCube.onBlockPropertyChanged.unsubscribe(this._handleBlockTypeChanged);
    }

    this._connectToProps();
  }

  _connectToProps() {
    if (this.props.blockCube !== undefined) {
      this.props.blockCube.onBlockTypeChanged.subscribe(this._handleBlockTypeChanged);
      this.props.blockCube.onBlockPropertyChanged.subscribe(this._handleBlockTypeChanged);
    }
  }

  _handleBlockTypeChanged(cube: BlockCube, block: Block) {
    const x = block.x;
    const y = block.y;
    const z = block.z;

    if (x === undefined || y === undefined || z === undefined) {
      throw new Error("Unexpected positionless block");
    }

    this.updateBlockAt(x, y, z);
  }

  _handleCanvasClick() {
    if (this.props.onClicked !== undefined) {
      this.props.onClicked();
    }
  }

  _clearBlockAt(x: number, y: number, z: number) {
    if (this._scene == null || this._blockMeshes[x + "." + y + "." + z] === undefined) {
      return;
    }

    this._scene.removeMesh(this._blockMeshes[x + "." + y + "." + z] as BABYLON.AbstractMesh);

    this._blockMeshes[x + "." + y + "." + z] = undefined;
  }

  _applyCanvasProps() {
    if (this._canvas == null) {
      return;
    }
    let heightAdjust = "";

    if (this.props.height !== undefined) {
      heightAdjust = "min-height: " + this.props.height + "px; max-height: " + this.props.height + "px;";
    } else if (this.props.heightOffset !== undefined) {
      heightAdjust =
        "min-height: calc(100vh - " +
        this.props.heightOffset +
        "px); max-height: calc(100vh - " +
        this.props.heightOffset +
        "px);";
    }

    this._canvas.setAttribute(
      "style",
      "width: 100%; height: 100%; min-width: 100%; " + heightAdjust + " background-color: black"
    );
  }

  _setCanvasOuter(elt: HTMLDivElement | null) {
    if (elt === null) {
      return;
    }

    if (elt !== this._canvasOuterDiv) {
      if (this._canvas == null) {
        this._canvas = document.createElement("canvas") as HTMLCanvasElement;
        this._canvas.addEventListener("click", this._handleCanvasClick);

        this._applyCanvasProps();
      } else if (this._canvasOuterDiv != null) {
        this._canvasOuterDiv.removeChild(this._canvas);
      }

      elt.appendChild(this._canvas);

      this._canvasOuterDiv = elt;

      if (this._engine == null) {
        this.initialize();
      }
    } else {
      this._applyCanvasProps();

      if (
        this.props.blockCube !== this._lastBlockCube ||
        !this.boundsAreEqual(this.props.viewBounds, this._lastViewBounds)
      ) {
        let resetCamera = false;

        if (this.props.blockCube !== this._lastBlockCube) {
          resetCamera = true;
        }

        this._renderScene();

        if (resetCamera) {
          this.resetCamera();
        }
      }
    }
  }

  boundsAreEqual(boundsA: IBlockCubeBounds | undefined, boundsB: IBlockCubeBounds | undefined) {
    if (boundsA === undefined && boundsB === undefined) {
      return true;
    }

    if (boundsA === undefined) {
      return false;
    }

    if (boundsB === undefined) {
      return false;
    }

    if (
      boundsA.fromX !== boundsB.fromX ||
      boundsA.fromY !== boundsB.fromY ||
      boundsA.fromZ !== boundsB.fromZ ||
      boundsA.toX !== boundsB.toX ||
      boundsA.toY !== boundsB.toY ||
      boundsA.toZ !== boundsB.toZ
    ) {
      return false;
    }

    return true;
  }

  initialize() {
    const eo: BABYLON.EngineOptions = {};
    const engine = new BABYLON.Engine(this._canvas, true, eo, false);
    this._engine = engine;

    this.createScene(engine);

    this._renderScene();

    engine.runRenderLoop(() => {
      if (this._scene != null) {
        this._scene.render();
      }
    });
  }

  _renderScene() {
    this._lastBlockCube = this.props.blockCube;
    this._lastViewBounds = this.props.viewBounds;

    this._clearAll();
    this._addEnvironment();
    this._addBlocks();
  }

  resize() {
    if (this._engine != null) {
      this._engine.resize();
    }
  }

  _initializeUX() {
    if (this._uiTexture !== undefined && this.props.viewMode !== VolumeEditorViewMode.SingleBlock) {
      const grid = new GUI.Grid();
      grid.addColumnDefinition(180, true);
      grid.addColumnDefinition(0.5);
      grid.addColumnDefinition(0.5);
      grid.addColumnDefinition(100, true);
      grid.addRowDefinition(1);
      grid.addRowDefinition(38, true);

      this._coordinatesText = new GUI.TextBlock();
      this._coordinatesText.text = "";
      this._coordinatesText.color = "white";
      this._coordinatesText.fontSize = 24;
      this._coordinatesText.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
      this._coordinatesText.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
      grid.addControl(this._coordinatesText, 1, 0);

      this._uiTexture.addControl(grid);
    }
  }

  createScene(engine: BABYLON.Engine) {
    // This creates a basic Babylon Scene object (non-mesh)
    const scene = new BABYLON.Scene(engine);

    this._scene = scene;
    this._scene.blockMaterialDirtyMechanism = true;

    this._blockMeshFactory = new BlockMeshFactory(this._scene, this.effectiveViewBounds);
    this._meshes = {};

    scene.clearColor = new BABYLON.Color4(0, 0, 0);

    if (this._camera == null) {
      this._camera = new BABYLON.FreeCamera("mainCam", new BABYLON.Vector3(1.5, 9, -9), scene);
      this._camera.inputs.clear();

      if (this.props.viewMode !== VolumeEditorViewMode.SingleBlock) {
        this._camera.inputs.addMouse();
        this._camera.inputs.addMouseWheel();
        this._camera.inputs.addGamepad();

        const wheel = this._camera.inputs.attached.mousewheel as BABYLON.FreeCameraMouseWheelInput;
        wheel.wheelPrecisionY = 0.06;
        wheel.wheelPrecisionX = 0.06;

        const c = new BABYLON.FreeCameraKeyboardMoveInput();
        c.keysDown = [83]; // wd
        c.keysUp = [87]; // s
        c.keysLeft = [65]; // a ('strafe left')
        c.keysRight = [68]; // d ('strafe right')

        c.keysUpward = [82]; // r
        c.keysDownward = [70]; // f

        this._camera.inputs.add(c);

        const fc = new FreeCameraKeyboardRotateInput(this._camera);
        // this traps the 'a' and 'd' keys.
        this._camera.inputs.add(fc);

        this._camera.angularSensibility = 7000;
        this._camera.speed = 0.3;
      }

      this.resetCamera();

      // This attaches the camera to the canvas
      this._camera.attachControl(this._canvas, true);
    }

    let light = new BABYLON.HemisphericLight("light1", new BABYLON.Vector3(0, 1, 0), scene);
    light = new BABYLON.HemisphericLight("light2", new BABYLON.Vector3(-1, 0.5, 0), scene);
    light.intensity = 0.8;

    if (this.props.viewMode !== VolumeEditorViewMode.SingleBlock) {
      this._uiTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");
    }

    this._initializeUX();

    // Default intensity is 1. Let's dim the light a small amount
    light.intensity = 1;
  }

  public resetCamera() {
    if (this._camera === null || this.props.blockCube === undefined) {
      return;
    }

    let maxX = this.props.blockCube.maxX;
    let maxY = this.props.blockCube.maxY;
    let maxZ = this.props.blockCube.maxZ;

    const viewBounds = this.props.viewBounds;

    if (viewBounds !== undefined) {
      maxX = viewBounds.toX - viewBounds.fromX;
      maxY = viewBounds.toY - viewBounds.fromY;
      maxZ = viewBounds.toZ - viewBounds.fromZ;
    }

    if (this.props.viewMode === VolumeEditorViewMode.Structure) {
      this._camera.position = new BABYLON.Vector3(maxX / 2, maxY + maxY, maxZ * 1.8);

      this._camera.setTarget(new BABYLON.Vector3(maxX / 2, maxY / 2, maxZ / 2));
    } else {
      this._camera.position = new BABYLON.Vector3((-maxX * 3) / 4, maxY + (maxY * 3) / 4, (-maxZ * 3) / 4);

      this._camera.setTarget(new BABYLON.Vector3((maxX * 7) / 16, (maxY * 7) / 16, (maxZ * 7) / 16));
    }
  }

  _handleBlockPointerOver(event: BABYLON.ActionEvent) {
    if (this.isSelectable) {
      const box = event.source as BABYLON.Mesh;

      let name = box.name.substring(1, box.name.length);

      const firstPipe = name.indexOf("|");

      if (firstPipe >= 0) {
        name = name.substring(0, firstPipe);
      }

      const coords = name.split(".");

      if (coords.length === 3 && this._coordinatesText !== undefined) {
        this._hoverBlock = box;

        let xCoord = parseInt(coords[0]);
        let yCoord = parseInt(coords[1]);
        let zCoord = parseInt(coords[2]);

        if (this.props.xCoordOffset) {
          xCoord += this.props.xCoordOffset;
        }

        if (this.props.yCoordOffset) {
          yCoord += this.props.yCoordOffset;
        }

        if (this.props.zCoordOffset) {
          zCoord += this.props.zCoordOffset;
        }

        this._coordinatesText.text = "x: " + xCoord + " y: " + yCoord + " z: " + zCoord;
      }

      box.enableEdgesRendering();
      box.edgesWidth = 4.0;
      box.edgesColor = new BABYLON.Color4(0, 0, 1, 1);
    }
  }

  _handleBlockPointerOut(event: BABYLON.ActionEvent) {
    const box = event.source as BABYLON.Mesh;

    if (this._coordinatesText != null) {
      this._coordinatesText.text = "";
    }

    this._hoverBlock = undefined;

    if (this.isSelectable) {
      box.disableEdgesRendering();
    }
  }

  _handleBlockClick(event: BABYLON.ActionEvent) {
    if (this.isSelectable && this.props.blockCube !== undefined) {
      const blockMesh = event.source as BABYLON.AbstractMesh;

      if (this._isHoldingCtrlDown) {
        this._toggleAddMesh(blockMesh);
      } else {
        this._singleSelectMesh(blockMesh);
      }
    }
  }

  _getBlockFromMesh(blockMesh: BABYLON.AbstractMesh): Block | undefined {
    let id = blockMesh.name;
    id = id.substring(1, id.length);

    const semicolon = id.lastIndexOf(";");

    if (semicolon >= 0) {
      id = id.substring(0, semicolon);
    }

    const lastPipe = id.lastIndexOf("|");

    if (lastPipe >= 0) {
      id = id.substring(0, lastPipe);
    }

    if (id.endsWith(".")) {
      id = id.substring(0, id.length - 1);
    }

    const coords = id.split(".");

    if (this.props.blockCube === undefined) {
      return undefined;
    }

    if (coords.length === 3) {
      return this.props.blockCube.x(parseInt(coords[0])).y(parseInt(coords[1])).z(parseInt(coords[2]));
    }

    return undefined;
  }

  _toggleAddMesh(blockMesh: BABYLON.AbstractMesh) {
    const newSelection = this._getBlockFromMesh(blockMesh);

    if (newSelection !== undefined) {
      let selectBlocks: Block[] = [];

      if (this.selectedBlocks !== undefined) {
        selectBlocks = this.selectedBlocks;
      }

      let selectMeshes: BABYLON.AbstractMesh[] = [];

      if (this._selectedBlockMeshes !== undefined) {
        selectMeshes = this._selectedBlockMeshes;
      }

      let isSelected = false;

      for (let i = 0; i < selectMeshes.length; i++) {
        // this mesh has already been selected; toggle it out
        if (selectMeshes[i] === blockMesh) {
          isSelected = true;
          this._setBoundingBox(selectMeshes[i], false);

          const newSelectedBlockMeshes = [];
          const newSelectedBlocks = [];

          for (let j = 0; j < selectMeshes.length; j++) {
            if (j !== i) {
              newSelectedBlockMeshes.push(selectMeshes[i]);
              newSelectedBlocks.push(selectBlocks[i]);
            }
          }

          if (newSelectedBlocks.length === 0) {
            this.selectedBlocks = undefined;
            this._selectedBlockMeshes = undefined;
          } else {
            this.selectedBlocks = newSelectedBlocks;
            this._selectedBlockMeshes = newSelectedBlockMeshes;
          }
        }
      }

      // add clicked block to list of selected blocks
      if (!isSelected) {
        selectMeshes.push(blockMesh);
        selectBlocks.push(newSelection);

        this._setBoundingBox(blockMesh, true);

        this.selectedBlocks = selectBlocks;
        this._selectedBlockMeshes = selectMeshes;
      }

      if (this.props.onSelectedBlocksChanged !== undefined) {
        this.props.onSelectedBlocksChanged(this.selectedBlocks);
      }
    }
  }

  _setBoundingBox(mesh: BABYLON.AbstractMesh, value: boolean) {
    mesh.showBoundingBox = value;

    const children = mesh.getChildMeshes();

    for (let i = 0; i < children.length; i++) {
      children[i].showBoundingBox = value;
    }
  }

  updateBlockAt(x: number, y: number, z: number) {
    this.updateBlocksAt(x, y, z, x, y, z);
  }

  updateBlocksAt(xFrom: number, yFrom: number, zFrom: number, xTo: number, yTo: number, zTo: number) {
    if (this.props.blockCube === undefined) {
      return;
    }

    const vb = this.effectiveViewBounds;

    // extend the range out by 1 all around to update any impacted blocks
    xFrom--;
    if (xFrom < vb.fromX) {
      xFrom = vb.fromX;
    }

    yFrom--;
    if (yFrom < vb.fromY) {
      yFrom = vb.fromY;
    }

    zFrom--;
    if (zFrom < vb.fromZ) {
      zFrom = vb.fromZ;
    }

    xTo++;
    if (xTo >= vb.toX) {
      xTo = vb.toX - 1;
    }

    yTo++;
    if (yTo >= vb.toY) {
      yTo = vb.toY - 1;
    }

    zTo++;
    if (zTo >= vb.toZ) {
      zTo = vb.toZ - 1;
    }

    for (let x = xFrom; x <= xTo; x++) {
      for (let y = yFrom; y <= yTo; y++) {
        for (let z = zFrom; z <= zTo; z++) {
          const block = this.props.blockCube.x(x).y(y).z(z);

          this._updateBlockMesh(block, x, y, z);
        }
      }
    }
  }

  _singleSelectMesh(blockMesh: BABYLON.AbstractMesh) {
    if (this._selectedBlockMeshes !== undefined) {
      for (let i = 0; i < this._selectedBlockMeshes.length; i++) {
        this._setBoundingBox(this._selectedBlockMeshes[i], false);
      }
    }

    const newSelection = this._getBlockFromMesh(blockMesh);

    if (newSelection !== undefined) {
      if (
        this._selectedBlockMeshes === undefined ||
        this._selectedBlockMeshes.length !== 1 ||
        this._selectedBlockMeshes[0] !== blockMesh
      ) {
        this._selectedBlockMeshes = [blockMesh];
        this.selectedBlocks = [newSelection];

        if (this.props.onSelectedBlocksChanged !== undefined) {
          this.props.onSelectedBlocksChanged(this.selectedBlocks);
        }

        this._setBoundingBox(blockMesh, true);
      } else if (this._selectedBlockMeshes !== undefined && this._selectedBlockMeshes.length === 1) {
        this._selectedBlockMeshes = undefined;
        blockMesh.showBoundingBox = false;

        this.selectedBlocks = undefined;

        if (this.props.onSelectedBlocksChanged !== undefined) {
          this.props.onSelectedBlocksChanged(this.selectedBlocks);
        }
      }
    }
  }

  _addEnvironment() {
    if (this._scene == null || this.props.blockCube == null) {
      return;
    }

    if (this.props.viewMode === VolumeEditorViewMode.SingleBlock) {
      return;
    }

    const ground = BABYLON.MeshBuilder.CreateGround(
      "ground",
      {
        width: this.props.blockCube.maxX + 4,
        height: this.props.blockCube.maxZ + 4,
      },
      this._scene
    );

    const groundMaterial = new BABYLON.StandardMaterial("ground", this._scene);
    groundMaterial.diffuseColor = new BABYLON.Color3(0.3, 0.3, 0.3);

    ground.material = groundMaterial;

    ground.position.x = this.props.blockCube.maxX / 2;
    ground.position.z = this.props.blockCube.maxZ / 2;

    const points: BABYLON.Vector3[] = [
      new BABYLON.Vector3(-1, 0, -0.02),
      new BABYLON.Vector3(this.props.blockCube.maxX + 1, 0, -0.02),
    ];

    BABYLON.MeshBuilder.CreateLines(
      "bottomBorderNorth",
      {
        points: points,
      },
      this._scene
    );

    const pointsB: BABYLON.Vector3[] = [
      new BABYLON.Vector3(-1, 0, this.props.blockCube.maxZ + 0.02),
      new BABYLON.Vector3(this.props.blockCube.maxX + 1, 0, this.props.blockCube.maxZ + 0.02),
    ];

    BABYLON.MeshBuilder.CreateLines(
      "bottomBorderSouth",
      {
        points: pointsB,
      },
      this._scene
    );

    const pointsC: BABYLON.Vector3[] = [
      new BABYLON.Vector3(-0.02, 0, -1),
      new BABYLON.Vector3(-0.02, 0, this.props.blockCube.maxZ + 1),
    ];

    BABYLON.MeshBuilder.CreateLines(
      "bottomBorderWest",
      {
        points: pointsC,
      },
      this._scene
    );

    const pointsD: BABYLON.Vector3[] = [
      new BABYLON.Vector3(this.props.blockCube.maxX + 0.02, 0, -1),
      new BABYLON.Vector3(this.props.blockCube.maxX + 0.02, 0, this.props.blockCube.maxZ + 1),
    ];

    BABYLON.MeshBuilder.CreateLines(
      "bottomBorderEast",
      {
        points: pointsD,
      },
      this._scene
    );

    const pointsE: BABYLON.Vector3[] = [
      new BABYLON.Vector3(-1, this.props.blockCube.maxY + 0.02, -0.02),
      new BABYLON.Vector3(this.props.blockCube.maxX + 1, this.props.blockCube.maxY + 0.02, -0.02),
    ];

    BABYLON.MeshBuilder.CreateLines(
      "bottomBorderE",
      {
        points: pointsE,
      },
      this._scene
    );

    const pointsF: BABYLON.Vector3[] = [
      new BABYLON.Vector3(-1, this.props.blockCube.maxY + 0.02, this.props.blockCube.maxZ + 0.02),
      new BABYLON.Vector3(
        this.props.blockCube.maxX + 1,
        this.props.blockCube.maxY + 0.02,
        this.props.blockCube.maxZ + 0.02
      ),
    ];

    BABYLON.MeshBuilder.CreateLines(
      "bottomBorderF",
      {
        points: pointsF,
      },
      this._scene
    );

    const pointsG: BABYLON.Vector3[] = [
      new BABYLON.Vector3(-0.02, this.props.blockCube.maxY + 0.02, -1),
      new BABYLON.Vector3(-0.02, this.props.blockCube.maxY + 0.02, this.props.blockCube.maxZ + 1),
    ];

    BABYLON.MeshBuilder.CreateLines(
      "bottomBorderG",
      {
        points: pointsG,
      },
      this._scene
    );

    const pointsH: BABYLON.Vector3[] = [
      new BABYLON.Vector3(this.props.blockCube.maxX + 0.02, this.props.blockCube.maxY + 0.02, -1),
      new BABYLON.Vector3(
        this.props.blockCube.maxX + 0.02,
        this.props.blockCube.maxY + 0.02,
        this.props.blockCube.maxZ + 1
      ),
    ];

    BABYLON.MeshBuilder.CreateLines(
      "bottomBorderH",
      {
        points: pointsH,
      },
      this._scene
    );
  }

  _clearAll() {
    if (this._scene == null || this.props.blockCube == null) {
      return;
    }

    while (this._scene.meshes.length > 0) {
      const mesh = this._scene.meshes[0];
      this._scene.removeMesh(mesh);
      mesh.dispose();
    }

    this._meshes = {};

    this._selectionPlaceholderMesh = undefined;
    this.selectedBlocks = undefined;

    this._selectedBlockMeshes = [];
    this._blockMeshes = {};
  }

  _ensureSelectionPlaceholderMesh() {
    if (this._scene === null || this.props.blockCube === null) {
      return;
    }

    if (this._selectionPlaceholderMesh !== undefined) {
      return;
    }

    const faceUV = new Array(6);

    for (var i = 0; i < 6; i++) {
      faceUV[i] = new BABYLON.Vector4(0, 0, 1, 1);
    }

    const options = {
      width: 1,
      height: 1,
      depth: 1,
      faceUV: faceUV,
    };

    this._selectionPlaceholderMesh = BABYLON.MeshBuilder.CreateBox("selectionPlaceholder", options, this._scene);
    const emptyMaterial = new BABYLON.StandardMaterial("selectionPlaceholder", this._scene);
    emptyMaterial.alpha = 0.0;
    emptyMaterial.freeze();

    this._selectionPlaceholderMesh.material = emptyMaterial;

    this._selectionPlaceholderMesh.isVisible = false;
  }

  _addBlocks() {
    if (this._scene === null || this.props.blockCube === null) {
      return;
    }

    const bc = this.props.blockCube;

    this._ensureSelectionPlaceholderMesh();

    const vb = this.effectiveViewBounds;

    if (bc != null) {
      for (let x = vb.fromX; x < vb.toX; x++) {
        const xSlice = bc.x(x);

        for (let y = vb.fromY; y < vb.toY; y++) {
          const ySlice = xSlice.y(y);

          for (let z = vb.fromZ; z < vb.toZ; z++) {
            const block = ySlice.z(z);

            this._updateBlockMesh(block, x, y, z);
          }
        }
      }
    }
  }

  _isOutOfBounds(x: number, y: number, z: number) {
    const vb = this.props.viewBounds;

    if (vb !== undefined) {
      if (x < vb.fromX || x >= vb.toX || y < vb.fromY || y >= vb.toY || z < vb.fromZ || z >= vb.toZ) {
        return true;
      }

      return false;
    } else if (this.props.blockCube !== undefined) {
      if (x >= this.props.blockCube.maxX) {
        return true;
      }

      if (y >= this.props.blockCube.maxY) {
        return true;
      }

      if (z >= this.props.blockCube.maxZ) {
        return true;
      }

      return false;
    }

    return true;
  }

  _updateBlockMesh(block: Block, x: number, y: number, z: number) {
    const blockId = block.shortTypeName;
    const posName = x + "." + y + "." + z;

    if (this._scene === null || this._isOutOfBounds(x, y, z)) {
      return;
    }

    let maxX = 20;

    if (this.props.blockCube) {
      maxX = this.props.blockCube.maxX;
    }

    const existingMesh = this._blockMeshes[posName];

    if (existingMesh !== undefined) {
      const meshes = existingMesh.getChildMeshes();

      if (meshes.length > 0) {
        for (let i = 0; i < meshes.length; i++) {
          const childMesh = meshes[i];

          this._scene.removeMesh(childMesh, true);
          childMesh.dispose();
        }
      }

      this._scene.removeMesh(existingMesh, true);
      existingMesh.dispose();
      this._blockMeshes[posName] = undefined;
    }

    if (!block.isCovered && this._blockMeshFactory !== undefined) {
      if (blockId !== undefined && blockId !== "air") {
        const name = "b" + posName;
        const visualHash = this._blockMeshFactory.getAppearanceHash(block);

        if (visualHash !== "") {
          let sourceMesh = this._meshes[visualHash];
          let box: BABYLON.AbstractMesh | null = null;

          // use the following line to disable caching, to debug caching issues
          //    if (true) {
          if (sourceMesh == null) {
            sourceMesh = this._blockMeshFactory.createMesh(name, block);
            this._meshes[visualHash] = sourceMesh;

            if (sourceMesh) {
              sourceMesh.position.x = 10000;
              sourceMesh.freezeNormals();
              sourceMesh.freezeWorldMatrix();
            }
            //    sourceMesh.convertToUnIndexedMesh();
          }

          if (sourceMesh) {
            box = sourceMesh.clone(name + ";");

            box.position.x = maxX - (x + 0.5);
            box.position.y = y + 0.5;
            box.position.z = z + 0.5;

            this._blockMeshes[posName] = box;

            this._addBlockEvents(box);
          }
        }
      } else if ((block.isTouchingOtherBlock || y === 0) && this._selectionPlaceholderMesh !== undefined) {
        const name = "p" + posName;

        const box = this._selectionPlaceholderMesh.createInstance(name);

        box.position.x = maxX - (x + 0.5);
        box.position.y = y + 0.5;
        box.position.z = z + 0.5;

        this._blockMeshes[posName] = box;

        this._addBlockEvents(box);
      }
    } else {
    }
  }

  _addBlockEvents(box: BABYLON.AbstractMesh) {
    if (this._scene == null) {
      return;
    }

    const meshes = box.getChildMeshes();

    if (meshes.length > 0) {
      for (let i = 0; i < meshes.length; i++) {
        this._addBlockEvents(meshes[i]);
      }

      return;
    }

    box.actionManager = new BABYLON.ActionManager(this._scene);

    if (box.actionManager != null) {
      box.actionManager.registerAction(
        new BABYLON.ExecuteCodeAction(
          {
            trigger: BABYLON.ActionManager.OnPointerOverTrigger,
          },
          this._handleBlockPointerOver
        )
      );

      box.actionManager.registerAction(
        new BABYLON.ExecuteCodeAction(
          {
            trigger: BABYLON.ActionManager.OnPointerOutTrigger,
          },
          this._handleBlockPointerOut
        )
      );

      box.actionManager.registerAction(
        new BABYLON.ExecuteCodeAction(
          {
            trigger: BABYLON.ActionManager.OnPickTrigger,
          },
          this._handleBlockClick
        )
      );
    }
  }

  render() {
    if (this.props.blockCube === undefined) {
      return <div></div>;
    }

    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          minWidth: "100%",
          minHeight: "100%",
          textAlign: "left",
        }}
        ref={(c: HTMLDivElement) => this._setCanvasOuter(c)}
      />
    );
  }
}
