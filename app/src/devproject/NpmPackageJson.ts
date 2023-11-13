import IFile from "../storage/IFile";
import Log from "../core/Log";
import { EventDispatcher, IEventHandler } from "ste-events";
import { PackageJson } from "@npm/types";

export default class NpmPackageJson {
  private _file?: IFile;
  private _id?: string;
  private _version?: string;
  private _isLoaded: boolean = false;

  public definition?: PackageJson;

  private _onLoaded = new EventDispatcher<NpmPackageJson, NpmPackageJson>();

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

  public get description() {
    if (!this.definition) {
      return undefined;
    }

    return this.definition.description;
  }

  public get name() {
    if (this.definition) {
      return this.definition.name;
    }

    return undefined;
  }

  public get id() {
    return this._id;
  }

  public set id(newId: string | undefined) {
    this._id = newId;
  }

  static async ensureOnFile(file: IFile, loadHandler?: IEventHandler<NpmPackageJson, NpmPackageJson>) {
    let dt: NpmPackageJson | undefined = undefined;

    if (file.manager === undefined) {
      dt = new NpmPackageJson();

      dt.file = file;

      file.manager = dt;
    }

    if (file.manager !== undefined && file.manager instanceof NpmPackageJson) {
      dt = file.manager as NpmPackageJson;

      if (!dt.isLoaded && loadHandler) {
        dt.onLoaded.subscribe(loadHandler);
      }

      await dt.load();

      return dt;
    }

    return dt;
  }

  async persist() {
    if (this._file === undefined) {
      return;
    }

    const pjString = JSON.stringify(this.definition, null, 2);

    this._file.setContent(pjString);
  }

  async save() {
    if (this._file === undefined) {
      return;
    }

    this.persist();

    await this._file.saveContent(false);
  }

  async load() {
    if (this._file === undefined || this._isLoaded) {
      return;
    }

    await this._file.loadContent();

    if (this._file.content === null || this._file.content instanceof Uint8Array) {
      return;
    }

    this.id = this._file.name;

    try {
      const data: any = JSON.parse(this._file.content);

      this.definition = data;
    } catch (e) {
      Log.fail("Could not parse NPM package JSON: " + e);
    }

    this._isLoaded = true;
  }
}
