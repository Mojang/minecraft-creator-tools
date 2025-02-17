// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "../storage/IFile";
import { EventDispatcher, IEventHandler } from "ste-events";
import { IAddonManifestHeader, IPersonaManifest } from "./IAddonManifest";
import Utilities from "../core/Utilities";
import Project from "../app/Project";
import StorageUtilities from "../storage/StorageUtilities";

export default class PersonaManifestDefinition {
  private _file?: IFile;
  private _id?: string;
  private _isLoaded: boolean = false;

  public definition?: IPersonaManifest;

  private _onLoaded = new EventDispatcher<PersonaManifestDefinition, PersonaManifestDefinition>();

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

  public get packScope() {
    if (!this.definition || !this.definition.header) {
      return undefined;
    }

    return this.definition.header.pack_scope;
  }

  public get productType() {
    if (!this.definition || !this.definition.metadata) {
      return undefined;
    }

    return this.definition.metadata.product_type;
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

  public ensureHeaderForProject(project: Project): IAddonManifestHeader {
    return this.ensureHeader(project.title, project.description);
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

  static async ensureOnFile(
    file: IFile,
    loadHandler?: IEventHandler<PersonaManifestDefinition, PersonaManifestDefinition>
  ) {
    let rmj: PersonaManifestDefinition | undefined;

    if (file.manager === undefined) {
      rmj = new PersonaManifestDefinition();

      rmj.file = file;

      file.manager = rmj;
    }

    if (file.manager !== undefined && file.manager instanceof PersonaManifestDefinition) {
      rmj = file.manager as PersonaManifestDefinition;

      if (!rmj.isLoaded && loadHandler) {
        rmj.onLoaded.subscribe(loadHandler);
      }

      await rmj.load();
    }

    return rmj;
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
