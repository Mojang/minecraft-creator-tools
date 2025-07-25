import IColor from "../core/IColor";

export enum ImageItemType {
  pixelSet = 0,
  line = 1,
  rectangle = 2,
  circle = 3,
  triangle = 4,
  text = 5,
  image = 6,
}

export enum ImageOutputType {
  blockTexture = 1,
  itemTexture = 2,
  painting = 3,
  blockBillboard3x3 = 11,
  blockBillboard4x6 = 12,
  blockBillboard5x8 = 13,
}

export enum PaintingSize {
  oneBlock = 1,
  threeByThree = 3,
  threeByFourPortrait = 4,
}

export default interface IImageEdits {
  items: IImageItem[];
  backgroundItem?: IImageItem;
  stackPosition?: number;
  width?: number;
  height?: number;
  outputs?: IImageOutput[];
}

export interface IImageOutput {
  type: ImageOutputType;
  name: string;
  paintingOverrideName: string;
  paintingSize: PaintingSize;
}

export interface IImageItem {
  origin: IImageXY;
  type: ImageItemType;
  strokeColor?: IColor;
  imageData?: string;
  isFilled?: boolean;
  fillColor?: IColor;
  fixedWidth?: number;
  fixedHeight?: number;
  coords: IImageXY[];
}

export interface IImageXY {
  x: number;
  y: number;
}
