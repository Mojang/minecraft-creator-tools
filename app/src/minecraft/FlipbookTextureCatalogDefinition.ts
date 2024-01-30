import IFile from "../storage/IFile";
import Log from "../core/Log";
import { EventDispatcher, IEventHandler } from "ste-events";
import StorageUtilities from "../storage/StorageUtilities";
import { IFlipbookTexture } from "./IFlipbookTexture";

export default class FlipbookTextureCatalogDefinition {
  public flipbookTextures?: IFlipbookTexture[];
  private _file?: IFile;
  private _isLoaded: boolean = false;

  private _onLoaded = new EventDispatcher<FlipbookTextureCatalogDefinition, FlipbookTextureCatalogDefinition>();

  public get isLoaded() {
    return this._isLoaded;
  }

  public get file() {
    return this._file;
  }
  public get onLoaded() {
    return this._onLoaded.asEvent();
  }

  public set file(newFile: IFile | undefined) {
    this._file = newFile;
  }

  static async ensureFlipbookTextureCatalogDefinitionOnFile(
    file: IFile,
    loadHandler?: IEventHandler<FlipbookTextureCatalogDefinition, FlipbookTextureCatalogDefinition>
  ) {
    let et: FlipbookTextureCatalogDefinition | undefined = undefined;

    if (file.manager === undefined) {
      et = new FlipbookTextureCatalogDefinition();

      et.file = file;

      file.manager = et;
    }

    if (file.manager !== undefined && file.manager instanceof FlipbookTextureCatalogDefinition) {
      et = file.manager as FlipbookTextureCatalogDefinition;

      if (!et.isLoaded && loadHandler) {
        et.onLoaded.subscribe(loadHandler);
      }

      await et.load();
    }

    return et;
  }

  persist() {
    if (this._file === undefined) {
      return;
    }

    const defString = JSON.stringify(this.flipbookTextures, null, 2);

    this._file.setContent(defString);
  }

  async load() {
    if (this._isLoaded) {
      return;
    }

    if (this._file === undefined) {
      Log.unexpectedUndefined("FBTCDF");
      return;
    }

    await this._file.loadContent();

    if (!this._file.content || this._file.content instanceof Uint8Array) {
      return;
    }

    let data: any = [];

    let result = StorageUtilities.getJsonObject(this._file);

    if (result) {
      data = result;
    }

    this.flipbookTextures = data;

    this._isLoaded = true;

    this._onLoaded.dispatch(this, this);
  }
}
