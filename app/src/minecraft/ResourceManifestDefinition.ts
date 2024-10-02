// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "../storage/IFile";
import { EventDispatcher, IEventHandler } from "ste-events";
import { IAddonManifestHeader, IAddonMetadata, IResourcePackManifest } from "./IAddonManifest";
import Utilities from "../core/Utilities";
import Project from "../app/Project";
import StorageUtilities from "../storage/StorageUtilities";
import { ProjectItemType } from "../app/IProjectItemData";
import BehaviorManifestDefinition from "./BehaviorManifestDefinition";

export default class ResourceManifestDefinition {
  private _file?: IFile;
  private _id?: string;
  private _isLoaded: boolean = false;

  public definition?: IResourcePackManifest;

  private _onLoaded = new EventDispatcher<ResourceManifestDefinition, ResourceManifestDefinition>();

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

  public set packScope(newValue: "world" | "global" | "any" | undefined) {
    if (!this.definition || !this.definition.header) {
      return;
    }

    this.definition.header.pack_scope = newValue;
  }

  public get productType() {
    if (!this.definition || !this.definition.metadata) {
      return undefined;
    }

    return this.definition.metadata.product_type;
  }

  public set productType(value: "" | "addon" | undefined) {
    this.ensureMetadata();

    if (!this.definition || !this.definition.metadata) {
      return;
    }

    this.definition.metadata.product_type = value;
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

  public async setUuid(newId: string | undefined, project?: Project) {
    const oldUuid = this.uuid;

    this.uuid = newId;

    if (newId && oldUuid && project) {
      await ResourceManifestDefinition.setNewResourcePackId(project, newId, oldUuid);
    }
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

  static async setNewResourcePackId(project: Project, newResourcePackId: string, oldResourcePackId: string) {
    const itemsCopy = project.getItemsCopy();
    let setResourcePack = false;

    for (let i = 0; i < itemsCopy.length; i++) {
      const pi = itemsCopy[i];

      if (pi.file) {
        if (pi.itemType === ProjectItemType.resourcePackManifestJson && !setResourcePack) {
          const rpManifestJson = await ResourceManifestDefinition.ensureOnFile(pi.file);

          if (rpManifestJson) {
            if (rpManifestJson.uuid && Utilities.uuidEqual(rpManifestJson.uuid, oldResourcePackId)) {
              rpManifestJson.uuid = newResourcePackId;
              setResourcePack = true;
              await rpManifestJson.save();
            } else if (rpManifestJson.definition && rpManifestJson.definition.dependencies) {
              const deps = rpManifestJson.definition?.dependencies;

              for (const dep of deps) {
                if (dep.uuid === oldResourcePackId) {
                  dep.uuid = newResourcePackId;
                }
              }
              await rpManifestJson.save();
            }
          }
        } else if (pi.itemType === ProjectItemType.behaviorPackManifestJson) {
          const bpManifestJson = await BehaviorManifestDefinition.ensureOnFile(pi.file);

          if (bpManifestJson) {
            if (bpManifestJson.definition && bpManifestJson.definition.dependencies) {
              const deps = bpManifestJson.definition?.dependencies;

              for (const dep of deps) {
                if (dep.uuid === oldResourcePackId) {
                  dep.uuid = newResourcePackId;
                }
              }

              await bpManifestJson.save();
            }
          }
        }
      }
    }
  }

  public hasAddonProperties(): boolean {
    return this.productType === "addon" && this.packScope === "world";
  }

  public async setAddonProperties() {
    this.productType = "addon";
    this.packScope = "world";

    await this.save();
  }

  public randomizeModuleUuids(newDataModuleId?: string, oldDataModuleId?: string) {
    if (!this.definition) {
      return;
    }

    for (let i = 0; i < this.definition.modules.length; i++) {
      const mod = this.definition.modules[i];

      if (mod.uuid) {
        if (oldDataModuleId && newDataModuleId && (mod.uuid === oldDataModuleId || mod.uuid === newDataModuleId)) {
          mod.uuid = newDataModuleId;
        } else {
          mod.uuid = Utilities.createUuid();
        }
      }
    }
  }

  static async ensureOnFile(
    file: IFile,
    loadHandler?: IEventHandler<ResourceManifestDefinition, ResourceManifestDefinition>
  ) {
    let rmj: ResourceManifestDefinition | undefined;

    if (file.manager === undefined) {
      rmj = new ResourceManifestDefinition();

      rmj.file = file;

      file.manager = rmj;
    }

    if (file.manager !== undefined && file.manager instanceof ResourceManifestDefinition) {
      rmj = file.manager as ResourceManifestDefinition;

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

  public ensureMetadata(): IAddonMetadata | undefined {
    if (!this.definition) {
      return undefined;
    }

    if (!this.definition.metadata) {
      this.definition.metadata = {};
    }

    return this.definition.metadata;
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

    this.definition = StorageUtilities.getJsonObject(this._file);

    this._isLoaded = true;
  }
}
