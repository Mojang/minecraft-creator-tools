import { Image } from "image-js";
import { ITexture } from "./ITexture";
import IFile from "../../storage/IFile";
import Database from "../Database";

export default class FileTexture implements ITexture {
  get width() {
    return this._width;
  }

  get height() {
    return this._height;
  }

  get path() {
    return this._filePath;
  }

  constructor(private _filePath: string, private _width: number, private _height: number, private _pixelData: Image) {}

  static async readTextureFromProjectFile(file: IFile): Promise<ITexture | undefined> {
    await file.loadContent();

    if (typeof file.content === "string" || !file.content?.buffer) {
      return Promise.resolve(undefined);
    }

    const data = await Image.load(file.content);

    return new FileTexture(file.storageRelativePath, data.width, data.height, data);
  }

  static async readTextureFromLocalPath(filePath: string): Promise<ITexture | undefined> {
    const content = await Database.getContentFolderContent(filePath);

    if (!content || !(content instanceof Uint8Array)) {
      return undefined;
    }

    const image = await Image.load(content);

    return new FileTexture(filePath, image.width, image.height, image);
  }

  isHighResolution(): boolean {
    return this._width === 128;
  }

  getPixel(x: number, y: number) {
    const [r, g, b, a = 255] = this._pixelData.getPixelXY(x, y);

    return { r, g, b, a };
  }
}
