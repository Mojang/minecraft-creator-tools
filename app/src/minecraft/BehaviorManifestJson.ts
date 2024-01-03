import IFile from "../storage/IFile";
import { EventDispatcher, IEventHandler } from "ste-events";
import IAddonManifest, { IAddonManifestHeader, IAddonModule } from "./IAddonManifest";
import Utilities from "../core/Utilities";
import Project from "../app/Project";
import StorageUtilities from "../storage/StorageUtilities";

export default class BehaviorManifestJson {
  private _file?: IFile;
  private _id?: string;
  private _isLoaded: boolean = false;

  public definition?: IAddonManifest;

  private _onLoaded = new EventDispatcher<BehaviorManifestJson, BehaviorManifestJson>();

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

  public get productType() {
    if (!this.definition || !this.definition.metadata) {
      return undefined;
    }

    return this.definition.metadata.product_type;
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

  public getNonScriptModuleDependencyCount() {
    if (!this.definition || !this.definition.dependencies) {
      return 0;
    }

    let count = 0;

    for (let dependency of this.definition.dependencies) {
      if (dependency.uuid) {
        count++;
      }
    }

    return count;
  }

  public getFirstNonScriptModuleDependency() {
    if (!this.definition || !this.definition.dependencies) {
      return undefined;
    }

    for (let dependency of this.definition.dependencies) {
      if (dependency.uuid) {
        return dependency;
      }
    }

    return undefined;
  }

  static async ensureOnFile(file: IFile, loadHandler?: IEventHandler<BehaviorManifestJson, BehaviorManifestJson>) {
    let bmj: BehaviorManifestJson | undefined = undefined;

    if (file.manager === undefined) {
      bmj = new BehaviorManifestJson();

      bmj.file = file;

      file.manager = bmj;
    }

    if (file.manager !== undefined && file.manager instanceof BehaviorManifestJson) {
      bmj = file.manager as BehaviorManifestJson;

      if (!bmj.isLoaded && loadHandler) {
        bmj.onLoaded.subscribe(loadHandler);
      }

      await bmj.load();
    }

    return bmj;
  }

  get minEngineVersion() {
    if (!this.definition || !this.definition.header || !this.definition.header.min_engine_version) {
      return undefined;
    }

    return this.definition.header.min_engine_version;
  }

  setMinEngineVersion(versionArray: number[], project: Project) {
    const header = this.ensureHeaderForProject(project);

    header.min_engine_version = versionArray;
  }

  setModuleVersion(moduleName: string, version: string) {
    if (!this.definition || !this.definition.dependencies) {
      return false;
    }

    let verActual: string | number[] = version;
    let changedVals = false;
    if (version.indexOf("-") < 1) {
      const verArr = version.split(".");

      if (verArr && verArr.length === 3) {
        verActual = [];

        for (let i = 0; i < verArr.length; i++) {
          try {
            verActual.push(parseInt(verArr[i]));
          } catch (e) {
            throw e;
          }

          if (Number.isNaN(verActual[i])) {
            throw new Error("Could not parse " + version);
          }
        }
      }
    }

    for (let i = 0; i < this.definition.dependencies.length; i++) {
      const dep = this.definition.dependencies[i];

      if (dep.module_name === moduleName) {
        if (dep.version !== verActual) {
          dep.version = verActual;
          changedVals = true;
        }
      }
    }

    return changedVals;
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
          min_engine_version: [1, 20, 10],
          uuid: Utilities.createUuid(),
        },
        modules: [],
        dependencies: [],
      };
    }
  }

  public ensureHeaderForProject(project: Project): IAddonManifestHeader {
    return this.ensureHeader(project.title, project.description);
  }

  public ensureHeader(name: string, description: string): IAddonManifestHeader {
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
    };
  }

  public ensureScriptModule(name: string, description: string): IAddonModule {
    this.ensureDefinition(name, description);

    if (!this.definition) {
      throw new Error();
    }

    for (let i = 0; i < this.definition.modules.length; i++) {
      const mod = this.definition.modules[i];

      if (mod.type && mod.type.toLowerCase() === "script") {
        return mod;
      }
    }

    const mod: IAddonModule = {
      type: "script",
      description: name,
      version: [0, 0, 1],
      uuid: Utilities.createUuid(),
      language: "javascript",
    };

    this.definition.modules.push(mod);

    return mod;
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

    this.definition = StorageUtilities.getJsonObject(this._file);

    this._isLoaded = true;
  }
}
