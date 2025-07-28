import ColorUtilities from "../core/ColorUtilities";
import { IImageItem, IImageXY, ImageItemType } from "./IImageEdits";

export class ImageItem {
  data: IImageItem;
  imageElement?: object;
  isImageElementLoaded?: boolean;

  constructor(_data: IImageItem) {
    this.data = _data;
  }

  public get isFilled() {
    if (!this.data || !this.data.isFilled) {
      return false;
    }

    return this.data.isFilled;
  }

  public set isFilled(filled: boolean) {
    this.data.isFilled = filled;
  }

  public get coords() {
    return this.data.coords;
  }

  public get fixedWidth() {
    if (this.data) {
      return this.data.fixedWidth;
    }

    return undefined;
  }

  public set fixedWidth(fixedWidth: number | undefined) {
    this.data.fixedWidth = fixedWidth;
  }

  public get fixedHeight() {
    if (this.data) {
      return this.data.fixedHeight;
    }

    return undefined;
  }

  public set fixedHeight(fixedHeight: number | undefined) {
    this.data.fixedHeight = fixedHeight;
  }

  public get strokeColor() {
    if (!this.data || !this.data.strokeColor) {
      return {
        red: 0,
        green: 0,
        blue: 0,
      };
    }

    return this.data.strokeColor;
  }

  public get strokeColorCss() {
    return ColorUtilities.toCss(this.strokeColor);
  }

  public get imageData() {
    return this.data.imageData;
  }

  public set imageData(imageData: string | undefined) {
    this.data.imageData = imageData;
  }

  public get x() {
    return this.data.origin.x;
  }

  public get y() {
    return this.data.origin.y;
  }

  public get coord0x() {
    if (!this.data || !this.data.coords || this.data.coords.length <= 0) {
      return this.x;
    }

    return this.data.coords[0].x;
  }

  public set coord0x(newX: number) {
    if (!this.data.coords) {
      this.data.coords = [];
    }

    if (this.data.coords.length < 1) {
      this.data.coords.push({ x: newX, y: this.y });
    } else {
      this.data.coords[0].x = newX;
    }
  }

  public get coord0y() {
    if (!this.data || !this.data.coords || this.data.coords.length <= 0) {
      return this.y;
    }

    return this.data.coords[0].y;
  }

  public set coord0y(newY: number) {
    if (!this.data.coords) {
      this.data.coords = [];
    }

    if (this.data.coords.length < 1) {
      this.data.coords.push({ x: this.x, y: newY });
    } else {
      this.data.coords[0].y = newY;
    }
  }

  public get type() {
    return this.data.type;
  }

  public get allPixels() {
    let pixels: IImageXY[] = [];

    if (this.data.type === ImageItemType.pixelSet && this.data.coords.length === 1) {
      pixels.push({ x: this.x, y: this.y });
    } else if (this.data.type === ImageItemType.line && this.data.coords.length === 1) {
      let x0 = this.x;
      let y0 = this.y;
      let x1 = this.data.coords[0].x;
      let y1 = this.data.coords[0].y;

      let dx: number = Math.abs(x1 - x0),
        sx = x0 < x1 ? 1 : -1;

      let dy: number = -Math.abs(y1 - y0),
        sy = y0 < y1 ? 1 : -1;

      let err: number = dx + dy,
        e2;

      while (true) {
        pixels.push({ x: x0, y: y0 });

        if (x0 === x1 && y0 === y1) {
          break;
        }

        e2 = 2 * err;

        if (e2 >= dy) {
          err += dy;
          x0 += sx;
        }
        if (e2 <= dx) {
          err += dx;
          y0 += sy;
        }
      }
    }

    return pixels;
  }
}
