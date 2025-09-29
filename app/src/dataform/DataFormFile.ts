import IFile from "../storage/IFile";
import { EventDispatcher, IEventHandler } from "ste-events";
import IFormDefinition from "./IFormDefinition";
import StorageUtilities from "../storage/StorageUtilities";
import Log from "../core/Log";

export default class DataFormFile {
  private _file?: IFile;
  private _id?: string;
  private _title?: string;
  private _isLoaded: boolean = false;

  public formDefinition?: IFormDefinition;

  private _onLoaded = new EventDispatcher<DataFormFile, DataFormFile>();

  public get isLoaded() {
    return this._isLoaded;
  }

  public get file() {
    return this._file;
  }

  public set file(newFile: IFile | undefined) {
    this._file = newFile;
  }

  public get onLoaded() {
    return this._onLoaded.asEvent();
  }

  public get title() {
    if (this.formDefinition) {
      return this.formDefinition.title;
    }

    return this._title;
  }

  public get id() {
    return this._id;
  }

  public set id(newId: string | undefined) {
    this._id = newId;

    if (newId) {
      const underscore = newId.lastIndexOf("_");

      if (underscore >= 0 && underscore < newId.length - 2) {
        this._title = newId.substring(0, underscore);
      } else {
        this._title = newId;
      }
    }
  }

  static async ensureOnFile(file: IFile, loadHandler?: IEventHandler<DataFormFile, DataFormFile>) {
    let dff: DataFormFile | undefined;

    if (file.manager === undefined) {
      dff = new DataFormFile();

      dff.file = file;

      file.manager = dff;
    }

    if (file.manager !== undefined && file.manager instanceof DataFormFile) {
      dff = file.manager as DataFormFile;

      if (!dff.isLoaded && loadHandler) {
        dff.onLoaded.subscribe(loadHandler);
      }

      await dff.load();
    }

    return dff;
  }

  persist() {
    if (this._file === undefined) {
      return;
    }

    Log.assert(this.formDefinition !== null, "DFFP");

    if (this.formDefinition) {
      const fdString = JSON.stringify(this.formDefinition, null, 2);

      if (fdString) {
        this._file.setContent(fdString);
      }
    }
  }

  async load() {
    if (this._file === undefined || this._isLoaded) {
      return;
    }

    if (!this._file.isContentLoaded) {
      await this._file.loadContent();
    }

    if (this._file.content === null || this._file.content instanceof Uint8Array) {
      return;
    }

    this.formDefinition = StorageUtilities.getJsonObject(this._file);

    this._isLoaded = true;
  }
}
