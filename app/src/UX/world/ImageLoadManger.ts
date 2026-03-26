export default class ImageLoadManager {
  private _image: HTMLImageElement;
  private _isLoaded: boolean = false;
  private _hasPendingDraws: boolean = false;
  private pendingImages: {
    context: CanvasRenderingContext2D;
    x: number;
    y: number;
    width: number;
    height: number;
    shadeFactor?: number;
  }[] = [];

  // Static callback that will be called when any image loads that had pending draws
  // This allows the WorldMap to know when tiles need refreshing
  static onImageLoaded: (() => void) | undefined;

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

    // Track if we had pending draws that couldn't be shown
    const hadPendingDraws = this.pendingImages.length > 0;

    // Draw to any pending contexts (these draws may not be visible
    // if the tiles have already been cached by Leaflet)
    for (const pendingImage of this.pendingImages) {
      this._drawWithShading(
        pendingImage.context,
        pendingImage.x,
        pendingImage.y,
        pendingImage.width,
        pendingImage.height,
        pendingImage.shadeFactor
      );
    }

    this.pendingImages = [];
    this._hasPendingDraws = false;

    // Notify WorldMap that an image loaded - it will need to refresh tiles
    if (hadPendingDraws && ImageLoadManager.onImageLoaded) {
      ImageLoadManager.onImageLoaded();
    }
  }

  _drawWithShading(
    ctx: CanvasRenderingContext2D,
    dX: number,
    dY: number,
    dWidth: number,
    dHeight: number,
    shadeFactor?: number
  ) {
    // Ensure pixelated scaling for Minecraft-style crisp textures
    ctx.imageSmoothingEnabled = false;

    // Draw the base image first
    ctx.drawImage(this._image, dX, dY, dWidth, dHeight);

    // Apply shading overlay if factor is not 1.0
    if (shadeFactor !== undefined && Math.abs(shadeFactor - 1.0) > 0.01) {
      if (shadeFactor > 1.0) {
        // Lighten: draw semi-transparent white overlay
        const alpha = Math.min(0.4, (shadeFactor - 1.0) * 0.8);
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.fillRect(dX, dY, dWidth, dHeight);
      } else {
        // Darken: draw semi-transparent black overlay
        const alpha = Math.min(0.5, (1.0 - shadeFactor) * 1.2);
        ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
        ctx.fillRect(dX, dY, dWidth, dHeight);
      }
    }
  }

  use(ctx: CanvasRenderingContext2D, dX: number, dY: number, dWidth: number, dHeight: number, shadeFactor?: number) {
    // Always draw with shading when loaded, skip pending queue for already-loaded images
    if (this._isLoaded) {
      this._drawWithShading(ctx, dX, dY, dWidth, dHeight, shadeFactor);
    } else {
      this._hasPendingDraws = true;
      this.pendingImages.push({ context: ctx, x: dX, y: dY, width: dWidth, height: dHeight, shadeFactor });
    }
  }

  get isLoaded() {
    return this._isLoaded;
  }
}
