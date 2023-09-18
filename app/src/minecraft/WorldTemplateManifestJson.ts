import IFile from "../storage/IFile";
import Log from "../core/Log";
import { EventDispatcher, IEventHandler } from "ste-events";
import Utilities from "../core/Utilities";
import Project from "../app/Project";
import IWorldTemplateManifest, { IWorldTemplateManifestHeader } from "./IWorldTemplateManifest";

export default class WorldTemplateManifestJson {
  private _file?: IFile;
  private _id?: string;
  private _isLoaded: boolean = false;

  public definition?: IWorldTemplateManifest;

  private _onLoaded = new EventDispatcher<WorldTemplateManifestJson, WorldTemplateManifestJson>();

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
    if (!this.definition || !this.definition.header) {
      return undefined;
    }

    return this.definition.header.description;
  }

  public set description(newDescription: string | undefined) {
    if (this.definition && this.definition.header && newDescription) {
      this.definition.header.description = newDescription;
    }
  }

  public get name() {
    if (this.definition && this.definition.header) {
      return this.definition.header.name;
    }

    return undefined;
  }

  public set name(newName: string | undefined) {
    if (this.definition && this.definition.header && newName) {
      this.definition.header.name = newName;
    }
  }

  public get uuid() {
    if (this.definition && this.definition.header) {
      return this.definition.header.uuid;
    }

    return this._id;
  }

  public set uuid(newId: string | undefined) {
    if (this.definition && this.definition.header && newId) {
      this.definition.header.uuid = newId;
    }

    this._id = newId;
  }

  static async ensureOnFile(
    file: IFile,
    loadHandler?: IEventHandler<WorldTemplateManifestJson, WorldTemplateManifestJson>
  ) {
    let bmj: WorldTemplateManifestJson | undefined = undefined;

    if (file.manager === undefined) {
      bmj = new WorldTemplateManifestJson();

      bmj.file = file;

      file.manager = bmj;
    }

    if (file.manager !== undefined && file.manager instanceof WorldTemplateManifestJson) {
      bmj = file.manager as WorldTemplateManifestJson;

      if (!bmj.isLoaded && loadHandler) {
        bmj.onLoaded.subscribe(loadHandler);
      }

      await bmj.load();
    }

    return bmj;
  }

  get baseGameVersion() {
    if (!this.definition || !this.definition.header || !this.definition.header.base_game_version) {
      return undefined;
    }

    return this.definition.header.base_game_version;
  }

  setBaseGameVersion(versionArray: number[], project: Project) {
    const header = this.ensureHeaderForProject(project);

    header.base_game_version = versionArray;
  }

  persist() {
    if (this._file === undefined) {
      return;
    }

    const pjString = JSON.stringify(this.definition, null, 2);

    this._file.setContent(pjString);
  }

  public ensureDefinition(name: string, description: string) {
    if (!this.definition) {
      this.definition = {
        format_version: 2,

        header: {
          name: name,
          description: description,
          version: [0, 0, 1],
          base_game_version: [1, 20, 10],
          uuid: Utilities.createUuid(),
        },
        modules: [],
      };
    }
  }

  public ensureHeaderForProject(project: Project): IWorldTemplateManifestHeader {
    return this.ensureHeader(project.title, project.description);
  }

  public ensureHeader(name: string, description: string): IWorldTemplateManifestHeader {
    this.ensureDefinition(name, description);

    if (!this.definition) {
      throw new Error();
    }

    if (!this.definition.header) {
      this.definition.header = this.getDefaultHeader(name, description);
    }

    return this.definition.header;
  }

  public getDefaultHeader(name: string, description: string) {
    return {
      name: name,
      description: description,
      version: [0, 0, 1],
      min_engine_version: [1, 20, 10],
      uuid: Utilities.createUuid(),
      base_game_version: [1, 20, 10],
    };
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

    this.uuid = this._file.name;

    try {
      const data: any = JSON.parse(this._file.content);

      this.definition = data;
    } catch (e) {
      Log.fail("Could not parse World Template Manifest JSON " + e);
    }

    this._isLoaded = true;
  }
}
