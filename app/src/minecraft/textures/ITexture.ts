export type Pixel = {
  r: number;
  g: number;
  b: number;
  a: number;
};

export interface ITexture {
  width: number;
  height: number;
  getPixel(x: number, y: number): Pixel;
  isHighResolution(): boolean;
}

export type ImageArea = {
  x: number;
  y: number;
  width: number;
  height: number;
};
