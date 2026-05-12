import { Component } from "react";
import "./ImageEditor.css";
import React from "react";
import IPersistable from "../types/IPersistable";
import CreatorTools from "../../app/CreatorTools";
import { Stack, Button, Menu, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions } from "@mui/material";
import StorageUtilities from "../../storage/StorageUtilities";
import Utilities from "../../core/Utilities";
import {
  faDrawPolygon,
  faFill,
  faGear,
  faMagnifyingGlassMinus,
  faMagnifyingGlassPlus,
  faPencil,
  faRedo,
  faShapes,
  faUndo,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { CustomLabel, CustomSelectableDropdownLabel } from "../shared/components/feedback/labels/Labels";
import { faCircle, faRectangleTimes } from "@fortawesome/free-regular-svg-icons";
import ImageEditsDefinition from "../../design/ImageEditsDefinition";
import ProjectItem from "../../app/ProjectItem";
import { ImageItemType, ImageOutputType } from "../../design/IImageEdits";
import ColorUtilities from "../../core/ColorUtilities";
import { ImageItem } from "../../design/ImageItem";
import Database from "../../minecraft/Database";
import DataForm from "../../dataformux/DataForm";
import { ProjectItemCreationType, ProjectItemType } from "../../app/IProjectItemData";
import { FolderContext } from "../../app/Project";
import IProjectTheme from "../types/IProjectTheme";
import { WithLocalizationProps, withLocalization } from "../withLocalization";

export enum ImageEditsToolType {
  pixel = 0,
  line = 1,
  rectangleOutline = 2,
  rectangleFilled = 3,
  circleOutline = 4,
  circleFilled = 5,
  triangleOutline = 6,
  triangleFilled = 7,
  text = 8,
  fill = 9,
}

export enum ImageEditorMenuState {
  noMenu = 0,
  toolMenu = 1,
  designMenu = 2,
}

export enum ImageEditorDialogState {
  noDialog = 0,
  properties = 1,
}

interface IImageEditorProps extends WithLocalizationProps {
  theme: IProjectTheme;
  content?: Uint8Array;
  projectItem: ProjectItem;
  name: string;
  visualSeed?: number;
  setActivePersistable?: (persistObject: IPersistable) => void;
  heightOffset?: number;
  creatorTools: CreatorTools;
  onUpdateContent?: (newContent: Uint8Array) => void;
  onCommit?: (newContent: Uint8Array) => void;
}

interface IImageEditorState {
  content?: Uint8Array;
  imageEdits?: ImageEditsDefinition;
  allAsyncItemsLoaded: boolean;
  drawColor: string;
  menuState: ImageEditorMenuState;
  dialogState: ImageEditorDialogState;
  tool: ImageEditsToolType;
  isDrawing: boolean;
  drawingItem?: ImageItem;
  toolMenuAnchorEl?: HTMLElement | null;
  scale: number;
}

class ImageEditor extends Component<IImageEditorProps, IImageEditorState> {
  private imageCanvasElt: React.RefObject<HTMLDivElement>;
  private canvas: HTMLCanvasElement | null = null;
  private canvasContext: CanvasRenderingContext2D | null = null;

  private get scale() {
    return this.state.scale;
  }

  constructor(props: IImageEditorProps) {
    super(props);

    this.imageCanvasElt = React.createRef();

    this._undo = this._undo.bind(this);
    this._redo = this._redo.bind(this);
    this._handleToolMenuOpen = this._handleToolMenuOpen.bind(this);
    this._handleToolMenuClose = this._handleToolMenuClose.bind(this);
    this._handleDesignMenuOpen = this._handleDesignMenuOpen.bind(this);
    this._handleCloseDialog = this._handleCloseDialog.bind(this);
    this._showPropertiesDialog = this._showPropertiesDialog.bind(this);
    this._zoomIn = this._zoomIn.bind(this);
    this._zoomOut = this._zoomOut.bind(this);

    this.state = {
      content: this.props.content,
      imageEdits: undefined,
      allAsyncItemsLoaded: false,
      drawColor: "#000000",
      menuState: ImageEditorMenuState.noMenu,
      dialogState: ImageEditorDialogState.noDialog,
      tool: ImageEditsToolType.pixel,
      isDrawing: false,
      toolMenuAnchorEl: null,
      scale: 8,
    };
  }

  componentDidMount() {
    this._load();
  }

  async _load() {
    await Database.ensureFormLoaded("imageeditor", "image_editor");

    const imageEdits = await ImageEditsDefinition.ensureAsAccessoryOnImageProjectItem(this.props.projectItem);

    if (!imageEdits) {
      return;
    }

    this._addCanvasInterior(imageEdits);

    imageEdits.ensureBackgroundItem({
      origin: { x: 0, y: 0 },
      type: ImageItemType.image,
      imageData: this.getImageString(),
      coords: [],
    });

    this._redrawImage(imageEdits);

    this.ensureItemsLoaded(imageEdits);
  }

  getIsLoaded(imageEdits?: ImageEditsDefinition) {
    if (imageEdits === undefined) {
      imageEdits = this.state.imageEdits;
    }

    if (!imageEdits) {
      return false;
    }
    for (const item of imageEdits.items) {
      if (item.type === ImageItemType.image && !item.isImageElementLoaded) {
        return false;
      }
    }

    return true;
  }

  ensureItemsLoaded(imageDef: ImageEditsDefinition) {
    let hasAsyncItems = false;

    if (imageDef.backgroundItem) {
      if (imageDef.backgroundItem.type === ImageItemType.image && !imageDef.backgroundItem.isImageElementLoaded) {
        hasAsyncItems = true;
      }
    }
    for (const item of imageDef.items) {
      if (item.type === ImageItemType.image && !item.isImageElementLoaded) {
        hasAsyncItems = true;
      }
    }

    if (imageDef.backgroundItem) {
      this.ensureItemIsLoaded(imageDef.backgroundItem, imageDef, true, hasAsyncItems);
    }

    for (const item of imageDef.items) {
      this.ensureItemIsLoaded(item, imageDef, hasAsyncItems, false);
    }

    if (!hasAsyncItems) {
      this._setStateIfItemsComplete(imageDef);
    }
  }

  ensureItemIsLoaded(
    imageItem: ImageItem,
    imageEditor: ImageEditsDefinition,
    isBackgroundItem: boolean,
    setStateIfItemsComplete: boolean
  ) {
    if (imageItem.type === ImageItemType.image && !imageItem.imageElement) {
      const img = new Image();
      imageItem.imageElement = img;
      img.style.imageRendering = "pixelated";
      img.src = this.getImageString();

      img.onload = () => {
        imageItem.fixedWidth = img.naturalWidth;
        imageItem.fixedHeight = img.naturalHeight;

        if (isBackgroundItem) {
          if (img.naturalWidth && img.naturalHeight) {
            imageEditor.width = img.naturalWidth;
            imageEditor.height = img.naturalHeight;
          }

          this._addCanvasInterior(imageEditor);
        }

        imageItem.isImageElementLoaded = true;

        if (setStateIfItemsComplete) {
          this._setStateIfItemsComplete(imageEditor);
        }
      };
    }
  }

  _setStateIfItemsComplete(imageEdits: ImageEditsDefinition) {
    this._redrawImage(imageEdits);

    if (this.getIsLoaded(imageEdits)) {
      this.setState({
        content: this.state.content,
        drawColor: this.state.drawColor,
        tool: this.state.tool,
        isDrawing: this.state.isDrawing,
        drawingItem: this.state.drawingItem,
        imageEdits: imageEdits,
        allAsyncItemsLoaded: true,
      });
    }
  }

  componentDidUpdate(prevProps: IImageEditorProps, prevState: IImageEditorState) {
    if (this.state.content !== prevState.content) {
      this._load();
    }
  }

  _addCanvasInterior(imageEditor: ImageEditsDefinition) {
    if (this.imageCanvasElt.current) {
      while (this.imageCanvasElt.current.childNodes.length > 0) {
        this.imageCanvasElt.current.removeChild(this.imageCanvasElt.current.childNodes[0]);
      }

      this.canvas = document.createElement("canvas") as HTMLCanvasElement;
      this.canvas.style.imageRendering = "pixelated";
      this.canvas.style.padding = "1px";
      this.canvas.className = "ie-image";
      this.canvas.onmousedown = this._onCanvasMouseDown;
      this.canvas.onmousemove = this._onCanvasMouseMove;
      this.canvas.onmouseup = this._onCanvasMouseUp;
      this.canvas.onmouseleave = this._onCanvasMouseUp;
      this.canvas.oncontextmenu = (e) => e.preventDefault();

      this.imageCanvasElt.current.appendChild(this.canvas);

      this.canvasContext = this.canvas.getContext("2d");
      if (this.canvas && this.canvasContext) {
        this.canvas.width = imageEditor.width * this.scale;
        this.canvas.height = imageEditor.height * this.scale;
        this.canvasContext.imageSmoothingEnabled = false;
        this.canvasContext.setTransform(1, 0, 0, 1, 0, 0);
        this.canvasContext.scale(this.scale, this.scale);
      }
    }
  }

  _attachCanvasEvents() {
    if (!this.canvas) {
      return;
    }
  }

  _redrawImage(imageEdits?: ImageEditsDefinition, drawingItem?: ImageItem) {
    if (!imageEdits) {
      imageEdits = this.state.imageEdits;
    }

    if (!drawingItem) {
      drawingItem = this.state.drawingItem;
    }

    if (!imageEdits || !this.canvasContext) {
      return;
    }

    this.canvasContext.clearRect(0, 0, imageEdits.width, imageEdits.height);
    this._drawBackgroundAndBoundaries(imageEdits);

    if (imageEdits.backgroundItem) {
      this._drawItem(imageEdits.backgroundItem);
    }

    let length = imageEdits.items.length;

    if (imageEdits.stackPosition !== undefined) {
      length = imageEdits.stackPosition;
    }

    for (let i = 0; i < length; i++) {
      this._drawItem(imageEdits.items[i]);
    }

    if (this.state.drawingItem) {
      this._drawItem(this.state.drawingItem);
    }
  }

  _getPixelPos = (evt: MouseEvent) => {
    if (!this.canvas) {
      return { x: 0, y: 0 };
    }
    const rect = this.canvas.getBoundingClientRect();
    const scale = this.canvas.width / this.canvas.offsetWidth;
    const x = Math.floor(((evt.clientX - rect.left) * scale) / this.scale);
    const y = Math.floor(((evt.clientY - rect.top) * scale) / this.scale);

    return { x, y };
  };

  _onCanvasMouseDown = (evt: MouseEvent) => {
    evt.preventDefault();
    const pos = this._getPixelPos(evt);

    if (this.state.tool === ImageEditsToolType.fill) {
      this._fill(pos.x, pos.y, this.state.drawColor);
      this._persistCanvasToContent();

      return;
    }

    let drawingItem: ImageItem | undefined = undefined;

    if (this.state.tool === ImageEditsToolType.pixel) {
      this._addPixel(pos.x, pos.y, this.state.drawColor);
    } else if (this.state.tool === ImageEditsToolType.line) {
      drawingItem = new ImageItem({
        origin: { x: pos.x, y: pos.y },
        strokeColor: ColorUtilities.fromCss(this.state.drawColor),
        type: ImageItemType.line,
        coords: [],
      });
    } else if (
      this.state.tool === ImageEditsToolType.rectangleOutline ||
      this.state.tool === ImageEditsToolType.rectangleFilled
    ) {
      drawingItem = new ImageItem({
        origin: { x: pos.x, y: pos.y },
        strokeColor: ColorUtilities.fromCss(this.state.drawColor),
        isFilled: this.state.tool === ImageEditsToolType.rectangleFilled ? true : false,
        type: ImageItemType.rectangle,
        coords: [],
      });
    }
    this.setState({ isDrawing: true, drawingItem: drawingItem });
  };

  _onCanvasMouseMove = (evt: MouseEvent) => {
    if (!this.state.isDrawing) {
      return;
    }

    const pos = this._getPixelPos(evt);

    if (this.state.tool === ImageEditsToolType.pixel) {
      this._addPixel(pos.x, pos.y, this.state.drawColor);
    } else if (
      (this.state.tool === ImageEditsToolType.line ||
        this.state.tool === ImageEditsToolType.rectangleFilled ||
        this.state.tool === ImageEditsToolType.rectangleOutline) &&
      this.state.drawingItem
    ) {
      if (pos.x !== this.state.drawingItem.coord0x || pos.y !== this.state.drawingItem.coord0y) {
        const drawingItem = this.state.drawingItem;

        drawingItem.coord0x = pos.x;
        drawingItem.coord0y = pos.y;

        this._redrawImage(this.state.imageEdits);
      }
    }
  };

  _onCanvasMouseUp = (evt?: MouseEvent) => {
    if (this.state.isDrawing && this.state.drawingItem && evt) {
      this.state.imageEdits?.addNewDrawingItem(this.state.drawingItem);
    }
    this.setState({ isDrawing: false, drawingItem: undefined });

    this._persistCanvasToContent();
  };

  _addPixel(x: number, y: number, color: string) {
    const item = new ImageItem({
      origin: { x: x, y: y },
      type: ImageItemType.pixelSet,
      strokeColor: ColorUtilities.fromCss(color),
      coords: [],
    });

    if (this.state.imageEdits) {
      this.state.imageEdits.addNewDrawingItem(item);
    }

    this._drawItem(item);
  }

  _drawBackgroundAndBoundaries(imageEdits?: ImageEditsDefinition) {
    if (!this.canvasContext) {
      return;
    }
    this.canvasContext.save();
    this.canvasContext.setTransform(1, 0, 0, 1, 0, 0);
    this.canvasContext.scale(this.scale, this.scale);

    if (!imageEdits) {
      imageEdits = this.state.imageEdits;
    }

    if (!imageEdits || !imageEdits.width || !imageEdits.height) {
      return;
    }

    this.canvasContext.fillStyle = "#000000";

    let x0 = -1;
    let y0 = -1;
    let w = imageEdits.width + 2;
    let h = imageEdits.height + 2;

    this.canvasContext.fillRect(x0, y0, w, h);

    this.canvasContext.restore();
  }

  _drawItem(item: ImageItem) {
    if (!this.canvasContext) {
      return;
    }
    const color = item.strokeColorCss;

    this.canvasContext.save();
    this.canvasContext.setTransform(1, 0, 0, 1, 0, 0);
    this.canvasContext.scale(this.scale, this.scale);

    switch (item.type) {
      case ImageItemType.pixelSet:
        this.canvasContext.fillStyle = color;
        this.canvasContext.fillRect(item.x, item.y, 1, 1);

        for (const coord of item.coords) {
          this.canvasContext.fillRect(coord.x, coord.y, 1, 1);
        }
        break;

      case ImageItemType.line:
        this.canvasContext.fillStyle = color;
        const pixels = item.allPixels;
        for (const pixel of pixels) {
          this.canvasContext.fillRect(pixel.x, pixel.y, 1, 1);
        }
        break;
      case ImageItemType.rectangle:
        this.canvasContext.fillStyle = color;
        this.canvasContext.strokeStyle = color;

        let x0 = Math.min(item.x, item.coord0x);
        let y0 = Math.min(item.y, item.coord0y);
        let w = Math.max(item.x, item.coord0x) - x0 + 1;
        let h = Math.max(item.y, item.coord0y) - y0 + 1;

        if (item.isFilled) {
          this.canvasContext.fillRect(x0, y0, w, h);
        } else {
          this.canvasContext.strokeRect(x0, y0, w, h);
        }
        break;

      case ImageItemType.image:
        if (item.isImageElementLoaded && item.imageElement) {
          this.canvasContext.drawImage(item.imageElement as HTMLImageElement, 0, 0);
        }

        break;
    }

    this.canvasContext.restore();
  }

  _drawRectangle(x0: number, y0: number, x1: number, y1: number, color: string, filled: boolean) {
    if (!this.canvasContext) return;
    this.canvasContext.save();
    this.canvasContext.setTransform(1, 0, 0, 1, 0, 0);
    this.canvasContext.scale(this.scale, this.scale);

    this.canvasContext.strokeStyle = color;
    this.canvasContext.fillStyle = color;

    const rx = Math.min(x0, x1);
    const ry = Math.min(y0, y1);
    const rw = Math.abs(x1 - x0);
    const rh = Math.abs(y1 - y0);

    if (filled) {
      this.canvasContext.fillRect(rx, ry, rw + 1, rh + 1);
    } else {
      this.canvasContext.strokeRect(rx, ry, rw + 1, rh + 1);
    }

    this.canvasContext.restore();
  }

  _drawTriangle(x0: number, y0: number, x1: number, y1: number, color: string, filled: boolean) {
    if (!this.canvasContext) return;
    this.canvasContext.save();
    this.canvasContext.setTransform(1, 0, 0, 1, 0, 0);
    this.canvasContext.scale(this.scale, this.scale);

    this.canvasContext.strokeStyle = color;
    this.canvasContext.fillStyle = color;

    this.canvasContext.beginPath();
    this.canvasContext.moveTo(x0, y1);
    this.canvasContext.lineTo((x0 + x1) / 2, y0);
    this.canvasContext.lineTo(x1, y1);
    this.canvasContext.closePath();
    if (filled) {
      this.canvasContext.fill();
    } else {
      this.canvasContext.stroke();
    }

    this.canvasContext.restore();
  }

  _drawCircle(x0: number, y0: number, x1: number, y1: number, color: string, filled: boolean) {
    if (!this.canvasContext) return;
    this.canvasContext.save();
    this.canvasContext.setTransform(1, 0, 0, 1, 0, 0);
    this.canvasContext.scale(this.scale, this.scale);

    this.canvasContext.strokeStyle = color;
    this.canvasContext.fillStyle = color;

    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;

    const rx = Math.abs(x1 - x0) / 2;
    const ry = Math.abs(y1 - y0) / 2;

    this.canvasContext.beginPath();

    this.canvasContext.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);

    if (filled) {
      this.canvasContext.fill();
    } else {
      this.canvasContext.stroke();
    }

    this.canvasContext.restore();
  }

  _fill(x: number, y: number, fillColor: string) {
    if (!this.canvasContext || !this.canvas) {
      return;
    }

    const w = this.canvas.width;
    const h = this.canvas.height;

    const imgData = this.canvasContext.getImageData(0, 0, w, h);
    const data = imgData.data;

    const s = this.scale;
    // Map logical pixel (x,y) to the center of its scaled block in canvas pixel coords
    const idx = (lx: number, ly: number) => ((ly * s) * w + (lx * s)) * 4;

    const logicalW = w / s;
    const logicalH = h / s;

    // Get target color from the logical pixel position
    const startIdx = idx(x, y);
    const target = data.slice(startIdx, startIdx + 4);
    const fillR = parseInt(fillColor.slice(1, 3), 16);
    const fillG = parseInt(fillColor.slice(3, 5), 16);
    const fillB = parseInt(fillColor.slice(5, 7), 16);

    // If target color is same as fill, do nothing
    if (target[0] === fillR && target[1] === fillG && target[2] === fillB) {
      return;
    }

    const queue = [{ x, y }];
    while (queue.length) {
      const { x, y } = queue.pop()!;
      const i = idx(x, y);
      if (
        x >= 0 &&
        x < logicalW &&
        y >= 0 &&
        y < logicalH &&
        data[i] === target[0] &&
        data[i + 1] === target[1] &&
        data[i + 2] === target[2] &&
        data[i + 3] === target[3]
      ) {
        // Fill the entire scale×scale block for this logical pixel
        for (let dy = 0; dy < s; dy++) {
          for (let dx = 0; dx < s; dx++) {
            const pi = ((y * s + dy) * w + (x * s + dx)) * 4;
            data[pi] = fillR;
            data[pi + 1] = fillG;
            data[pi + 2] = fillB;
            data[pi + 3] = 255;
          }
        }
        queue.push({ x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 });
      }
    }

    this.canvasContext.putImageData(imgData, 0, 0);
  }

  async _persistCanvasToContent() {
    if (!this.canvas) {
      return;
    }

    if (this.state.imageEdits) {
      await this.state.imageEdits.persist();
      await this.state.imageEdits.save();
    }

    const w = this.canvas.width / this.scale;
    const h = this.canvas.height / this.scale;

    const offCanvas = document.createElement("canvas");

    offCanvas.width = w;
    offCanvas.height = h;

    const offCtx = offCanvas.getContext("2d");

    if (!offCtx) {
      return;
    }

    offCtx.drawImage(this.canvas, 0, 0, w, h);

    offCanvas.toBlob(async (blob) => {
      if (!blob) {
        return;
      }

      const arrayBuffer = await blob.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuffer);

      if (this.props.projectItem && this.props.projectItem.primaryFile) {
        this.props.projectItem.primaryFile.setContentIfSemanticallyDifferent(uint8);
      }

      if (this.props.onUpdateContent) {
        this.props.onUpdateContent(uint8);
      }
    }, "image/png");

    const outps = this.state.imageEdits?.outputs;

    if (outps) {
      for (const outp of outps) {
        if (outp.type === ImageOutputType.painting) {
          this.outputPainting(
            outp.paintingOverrideName ? outp.paintingOverrideName : outp.name,
            ImageEditsDefinition.getPaintingWidth(outp.paintingSize),
            ImageEditsDefinition.getPaintingHeight(outp.paintingSize)
          );
        } else if (outp.type === ImageOutputType.blockBillboard3x3) {
          this.outputBillboardImage(outp.name, 3, 3);
        } else if (outp.type === ImageOutputType.blockBillboard4x6) {
          this.outputBillboardImage(outp.name, 6, 4);
        } else if (outp.type === ImageOutputType.blockBillboard5x8) {
          this.outputBillboardImage(outp.name, 8, 5);
        }
      }
    }
  }

  async outputPainting(paintingName: string, targetWidth: number, targetHeight: number) {
    if (!this.canvas) {
      return;
    }

    const paintingFolder = await this.state.imageEdits?.getPaintingOverrideFolder();

    if (!paintingFolder) {
      return;
    }

    const paintingFile = paintingFolder.ensureFile(paintingName + ".png");

    const w = this.canvas.width;
    const h = this.canvas.height;

    const offCanvas = document.createElement("canvas");

    offCanvas.width = targetWidth;
    offCanvas.height = targetHeight;

    const offCtx = offCanvas.getContext("2d");

    if (!offCtx) {
      return;
    }

    offCtx.drawImage(this.canvas, 0, 0, w, h, 0, 0, targetWidth, targetHeight);

    offCanvas.toBlob(async (blob) => {
      if (!blob) {
        return;
      }

      const arrayBuffer = await blob.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuffer);

      paintingFile.setContentIfSemanticallyDifferent(uint8);
      this.props.projectItem.project.ensureItemFromFile(
        paintingFile,
        ProjectItemType.texture,
        FolderContext.resourcePack,
        ProjectItemCreationType.generated
      );
    }, "image/png");
  }

  async outputBillboardImage(name: string, blocksWide: number, blocksHigh: number) {
    if (!this.canvas) {
      return;
    }

    const blockTextureFolder = await this.state.imageEdits?.getCorrespondingBlockTextureFolder();

    if (!blockTextureFolder) {
      return;
    }

    const w = this.canvas.width / this.scale;
    const h = this.canvas.height / this.scale;

    const blockW = Math.floor(w / blocksWide);
    const blockH = Math.floor(h / blocksHigh);

    for (let i = 0; i < blocksHigh; i++) {
      for (let j = 0; j < blocksWide; j++) {
        const targetName = name + "_r" + String(i + 1) + "c" + String(j + 1);

        const offCanvas = document.createElement("canvas");

        offCanvas.width = blockW;
        offCanvas.height = blockH;

        const offCtx = offCanvas.getContext("2d");

        if (!offCtx) {
          return;
        }

        offCtx.drawImage(
          this.canvas,
          j * blockW * this.scale,
          i * blockH * this.scale,
          blockW * this.scale,
          blockH * this.scale,
          0,
          0,
          blockW,
          blockH
        );

        offCanvas.toBlob(async (blob) => {
          if (!blob) {
            return;
          }

          const arrayBuffer = await blob.arrayBuffer();
          const uint8 = new Uint8Array(arrayBuffer);

          const file = blockTextureFolder.ensureFile(targetName + ".png");

          if (file) {
            file.setContentIfSemanticallyDifferent(uint8);

            this.props.projectItem.project.ensureItemFromFile(
              file,
              ProjectItemType.texture,
              FolderContext.resourcePack,
              ProjectItemCreationType.generated
            );
          }
        }, "image/png");
      }
    }
  }

  async persist(): Promise<boolean> {
    await this._persistCanvasToContent();
    await this.state.imageEdits?.updateOutputs(this.props.projectItem.project);

    return true;
  }

  getImageString() {
    let content: Uint8Array | undefined = undefined;
    if (this.state.content) {
      content = this.state.content;
    } else {
      content = this.props.content;
    }

    if (content === undefined) {
      return "";
    }

    if (this.state.content instanceof Uint8Array) {
      let str = "data:image/";
      str += StorageUtilities.getTypeFromName(this.props.name);
      str += ";base64,";

      const base64 = Utilities.uint8ArrayToBase64(content);
      str += base64;

      return str;
    }

    return "";
  }

  _undo() {
    const imageEdits = this.state.imageEdits;
    if (!imageEdits) {
      return;
    }

    if (imageEdits.stackPosition === undefined) {
      imageEdits.stackPosition = imageEdits.items.length - 1;
      this._redrawImage();
    } else if (imageEdits.stackPosition > 0) {
      imageEdits.stackPosition--;
      this._redrawImage();
    }
  }

  _redo() {
    const imageEdits = this.state.imageEdits;

    if (!imageEdits) {
      return;
    }

    if (imageEdits.stackPosition !== undefined && imageEdits.stackPosition < imageEdits.items.length) {
      imageEdits.stackPosition++;

      if (imageEdits.stackPosition === imageEdits.items.length) {
        imageEdits.stackPosition = undefined;
      }
      this._redrawImage();
    }
  }

  private _handleToolMenuOpen(event: React.MouseEvent<HTMLButtonElement>) {
    this.setState({
      toolMenuAnchorEl: event.currentTarget,
      menuState: ImageEditorMenuState.toolMenu,
    });
  }

  private _handleToolMenuClose() {
    this.setState({
      toolMenuAnchorEl: null,
      menuState: ImageEditorMenuState.noMenu,
    });
  }

  private _handleDesignMenuOpen() {
    this.setState({
      menuState:
        this.state.menuState === ImageEditorMenuState.designMenu
          ? ImageEditorMenuState.noMenu
          : ImageEditorMenuState.designMenu,
    });
  }

  async _handleCloseDialog() {
    if (this.state === null) {
      return;
    }

    this.setState({
      dialogState: ImageEditorDialogState.noDialog,
    });

    if (this.state.imageEdits) {
      await this.state.imageEdits.persist();
      await this.state.imageEdits.save();
    }
  }

  _showPropertiesDialog() {
    if (this.state === null) {
      return;
    }

    this.setState({
      dialogState: ImageEditorDialogState.properties,
    });
  }

  _zoomIn() {
    const newScale = Math.min(this.state.scale + 2, 32);
    if (newScale !== this.state.scale) {
      this.setState({ scale: newScale }, () => {
        if (this.state.imageEdits) {
          this._addCanvasInterior(this.state.imageEdits);
          this._redrawImage(this.state.imageEdits);
        }
      });
    }
  }

  _zoomOut() {
    const newScale = Math.max(this.state.scale - 2, 1);
    if (newScale !== this.state.scale) {
      this.setState({ scale: newScale }, () => {
        if (this.state.imageEdits) {
          this._addCanvasInterior(this.state.imageEdits);
          this._redrawImage(this.state.imageEdits);
        }
      });
    }
  }

  render() {
    if (this.props.setActivePersistable !== undefined) {
      this.props.setActivePersistable(this);
    }

    const toolMenuItems = [
      {
        key: "pencil",
        label: this.props.intl.formatMessage({ id: "project_editor.image_ed.pencil" }),
        selected: this.state.tool === ImageEditsToolType.pixel,
        icon: <FontAwesomeIcon icon={faPencil} className="fa-lg" />,
        onClick: () => {
          this.setState({
            tool: ImageEditsToolType.pixel,
            toolMenuAnchorEl: null,
            menuState: ImageEditorMenuState.noMenu,
          });
        },
      },
      {
        key: "line",
        label: this.props.intl.formatMessage({ id: "project_editor.image_ed.line" }),
        selected: this.state.tool === ImageEditsToolType.line,
        icon: <FontAwesomeIcon icon={faDrawPolygon} className="fa-lg" />,
        onClick: () => {
          this.setState({
            tool: ImageEditsToolType.line,
            toolMenuAnchorEl: null,
            menuState: ImageEditorMenuState.noMenu,
          });
        },
      },
      {
        key: "fill",
        label: this.props.intl.formatMessage({ id: "project_editor.image_ed.fill" }),
        selected: this.state.tool === ImageEditsToolType.fill,
        icon: <FontAwesomeIcon icon={faFill} className="fa-lg" />,
        onClick: () => {
          this.setState({
            tool: ImageEditsToolType.fill,
            toolMenuAnchorEl: null,
            menuState: ImageEditorMenuState.noMenu,
          });
        },
      },
      {
        key: "rectangleSolid",
        label: this.props.intl.formatMessage({ id: "project_editor.image_ed.rect_solid" }),
        selected: this.state.tool === ImageEditsToolType.rectangleFilled,
        icon: <FontAwesomeIcon icon={faRectangleTimes} className="fa-lg" />,
        onClick: () => {
          this.setState({
            tool: ImageEditsToolType.rectangleFilled,
            toolMenuAnchorEl: null,
            menuState: ImageEditorMenuState.noMenu,
          });
        },
      },
      {
        key: "rectangleOutline",
        label: this.props.intl.formatMessage({ id: "project_editor.image_ed.rect_outline" }),
        selected: this.state.tool === ImageEditsToolType.rectangleOutline,
        icon: <FontAwesomeIcon icon={faRectangleTimes} className="fa-lg" />,
        onClick: () => {
          this.setState({
            tool: ImageEditsToolType.rectangleOutline,
            toolMenuAnchorEl: null,
            menuState: ImageEditorMenuState.noMenu,
          });
        },
      },
      {
        key: "triangleSolid",
        label: this.props.intl.formatMessage({ id: "project_editor.image_ed.tri_solid" }),
        selected: this.state.tool === ImageEditsToolType.triangleFilled,
        icon: <FontAwesomeIcon icon={faShapes} className="fa-lg" />,
        onClick: () => {
          this.setState({
            tool: ImageEditsToolType.triangleFilled,
            toolMenuAnchorEl: null,
            menuState: ImageEditorMenuState.noMenu,
          });
        },
      },
      {
        key: "triangleOutline",
        label: this.props.intl.formatMessage({ id: "project_editor.image_ed.tri_outline" }),
        selected: this.state.tool === ImageEditsToolType.triangleOutline,
        icon: <FontAwesomeIcon icon={faShapes} className="fa-lg" />,
        onClick: () => {
          this.setState({
            tool: ImageEditsToolType.triangleOutline,
            toolMenuAnchorEl: null,
            menuState: ImageEditorMenuState.noMenu,
          });
        },
      },
      {
        key: "circleFilled",
        label: this.props.intl.formatMessage({ id: "project_editor.image_ed.circle_solid" }),
        selected: this.state.tool === ImageEditsToolType.circleFilled,
        icon: <FontAwesomeIcon icon={faCircle} className="fa-lg" />,
        onClick: () => {
          this.setState({
            tool: ImageEditsToolType.circleFilled,
            toolMenuAnchorEl: null,
            menuState: ImageEditorMenuState.noMenu,
          });
        },
      },
      {
        key: "circleOutline",
        label: this.props.intl.formatMessage({ id: "project_editor.image_ed.circle_outline" }),
        selected: this.state.tool === ImageEditsToolType.circleOutline,
        icon: <FontAwesomeIcon icon={faCircle} className="fa-lg" />,
        onClick: () => {
          this.setState({
            tool: ImageEditsToolType.circleOutline,
            toolMenuAnchorEl: null,
            menuState: ImageEditorMenuState.noMenu,
          });
        },
      },
    ];

    let dialogArea = <></>;

    if (this.state.dialogState === ImageEditorDialogState.properties) {
      const form = Database.getForm("imageeditor", "image_editor");

      if (form) {
        dialogArea = (
          <Dialog open={true} onClose={this._handleCloseDialog} key="ie-cancel">
            <DialogTitle>{StorageUtilities.getBaseFromName(this.props.name) + this.props.intl.formatMessage({ id: "project_editor.image_ed.properties_title" })}</DialogTitle>
            <DialogContent>
              <DataForm
                theme={this.props.theme}
                key="pab-newEntityDia"
                definition={form}
                readOnly={false}
                directObject={this.state.imageEdits?.data}
                project={this.props.projectItem.project}
                carto={this.props.creatorTools}
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={this._handleCloseDialog}>{this.props.intl.formatMessage({ id: "project_editor.image_ed.done" })}</Button>
            </DialogActions>
          </Dialog>
        );
      }
    }

    const toolMenuOpen = Boolean(this.state.toolMenuAnchorEl);

    return (
      <div className="ie-outer">
        {dialogArea}
        <div className="ie-toolBar">
          <Stack direction="row" spacing={1} aria-label={this.props.intl.formatMessage({ id: "project_editor.image_ed.toolbar_aria" })}>
            <Button key="undo" onClick={this._undo}>
              <CustomLabel isCompact={false} text={this.props.intl.formatMessage({ id: "project_editor.image_ed.undo" })} icon={<FontAwesomeIcon icon={faUndo} className="fa-lg" />} />
            </Button>
            <Button key="redo" onClick={this._redo}>
              <CustomLabel isCompact={false} text={this.props.intl.formatMessage({ id: "project_editor.image_ed.redo" })} icon={<FontAwesomeIcon icon={faRedo} className="fa-lg" />} />
            </Button>
            <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <input
                type="color"
                value={this.state.drawColor}
                onChange={(e) => this.setState({ drawColor: e.target.value })}
                style={{ width: 28, height: 28, border: "none", background: "none", padding: 0 }}
              />
              <span>{this.props.intl.formatMessage({ id: "project_editor.image_ed.color" })}</span>
            </label>
            <Button key="draw" onClick={this._handleToolMenuOpen} title={this.props.intl.formatMessage({ id: "project_editor.image_ed.draw" })}>
              <CustomLabel isCompact={false} text={this.props.intl.formatMessage({ id: "project_editor.image_ed.draw" })} icon={<FontAwesomeIcon icon={faPencil} className="fa-lg" />} />
            </Button>
            <Menu anchorEl={this.state.toolMenuAnchorEl} open={toolMenuOpen} onClose={this._handleToolMenuClose}>
              {toolMenuItems.map((item) => (
                <MenuItem key={item.key} onClick={item.onClick} selected={item.selected}>
                  <CustomSelectableDropdownLabel
                    theme={this.props.theme}
                    isCompact={false}
                    text={item.label}
                    isSelected={item.selected}
                    icon={item.icon}
                  />
                </MenuItem>
              ))}
            </Menu>
            <Button key="zoomIn" onClick={this._zoomIn} title={this.props.intl.formatMessage({ id: "project_editor.image_ed.zoom_in" })}>
              <CustomLabel
                isCompact={false}
                text=""
                icon={<FontAwesomeIcon icon={faMagnifyingGlassPlus} className="fa-lg" />}
              />
            </Button>
            <Button key="zoomOut" onClick={this._zoomOut} title={this.props.intl.formatMessage({ id: "project_editor.image_ed.zoom_out" })}>
              <CustomLabel
                isCompact={false}
                text=""
                icon={<FontAwesomeIcon icon={faMagnifyingGlassMinus} className="fa-lg" />}
              />
            </Button>
            <Button key="properties" onClick={this._showPropertiesDialog} title={this.props.intl.formatMessage({ id: "project_editor.image_ed.design_title" })}>
              <CustomLabel
                isCompact={false}
                text={this.props.intl.formatMessage({ id: "project_editor.image_ed.properties" })}
                icon={<FontAwesomeIcon icon={faGear} className="fa-lg" />}
              />
            </Button>
          </Stack>
        </div>
        <div className="ie-contents" ref={this.imageCanvasElt}></div>
      </div>
    );
  }
}

export default withLocalization(ImageEditor);
