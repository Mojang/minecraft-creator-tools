export default class ImageLoadManager {
  private _image: HTMLImageElement;
  private _isLoaded: boolean = false;
  private pendingImages: { context: CanvasRenderingContext2D; x: number; y: number; width: number; height: number }[] =
    [];

  constructor() {
    this._handleLoad = this._handleLoad.bind(this);

    this._image = document.createElement("IMG") as HTMLImageElement;
    this._image.onload = this._handleLoad;
  }

  get source() {
    return this._image.src;
  }

  set source(newSource: string) {
    if (newSource !== this._image.src) {
      this._isLoaded = false;
      this._image.src = newSource;
    }
  }

  _handleLoad() {
    this._isLoaded = true;

    for (const pendingImage of this.pendingImages) {
      pendingImage.context.drawImage(
        this._image,
        pendingImage.x,
        pendingImage.y,
        pendingImage.width,
        pendingImage.height
      );
    }
  }

  use(ctx: CanvasRenderingContext2D, dX: number, dY: number, dWidth: number, dHeight: number) {
    if (this._isLoaded) {
      ctx.drawImage(this._image, dX, dY, dWidth, dHeight);
    } else {
      this.pendingImages.push({ context: ctx, x: dX, y: dY, width: dWidth, height: dHeight });
    }
  }
}
