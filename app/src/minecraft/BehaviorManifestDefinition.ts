// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "../storage/IFile";
import { EventDispatcher, IEventHandler } from "ste-events";
import IAddonManifest, { IAddonDependency, IAddonManifestHeader, IAddonMetadata, IAddonModule } from "./IAddonManifest";
import Utilities from "../core/Utilities";
import Project, { AUTOGENERATED_WHOLEFILE_GENERAL_SEPARATOR, minecraftScriptModules } from "../app/Project";
import StorageUtilities from "../storage/StorageUtilities";
import { ProjectItemType } from "../app/IProjectItemData";
import { ProjectFocus } from "../app/IProjectData";
import ResourceManifestDefinition from "./ResourceManifestDefinition";

export default class BehaviorManifestDefinition {
  private _file?: IFile;
  private _id?: string;
  private _isLoaded: boolean = false;

  public definition?: IAddonManifest;

  private _onLoaded = new EventDispatcher<BehaviorManifestDefinition, BehaviorManifestDefinition>();

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

  public set productType(value: "" | "addon" | undefined) {
    this.ensureMetadata();

    if (!this.definition || !this.definition.metadata) {
      return;
    }

    this.definition.metadata.product_type = value;
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

  public async setUuid(newId: string | undefined, project?: Project) {
    const oldId = this.uuid;

    this.uuid = newId;

    if (newId && oldId && project) {
      await BehaviorManifestDefinition.setNewBehaviorPackId(project, newId, oldId);
    }
  }

  static async setNewBehaviorPackId(project: Project, newBehaviorPackId: string, oldBehaviorPackId: string) {
    const itemsCopy = project.getItemsCopy();
    let setBehaviorPack = false;

    for (let i = 0; i < itemsCopy.length; i++) {
      const pi = itemsCopy[i];

      if (pi.file) {
        if (pi.itemType === ProjectItemType.behaviorPackManifestJson && !setBehaviorPack) {
          const bpManifestJson = await BehaviorManifestDefinition.ensureOnFile(pi.file);

          if (bpManifestJson) {
            if (bpManifestJson.uuid && Utilities.uuidEqual(bpManifestJson.uuid, oldBehaviorPackId)) {
              bpManifestJson.uuid = newBehaviorPackId;
              setBehaviorPack = true;

              await bpManifestJson.save();
            } else if (bpManifestJson.definition && bpManifestJson.definition.dependencies) {
              const deps = bpManifestJson.definition?.dependencies;

              for (const dep of deps) {
                if (dep.uuid === oldBehaviorPackId) {
                  dep.uuid = newBehaviorPackId;
                }
              }

              await bpManifestJson.save();
            }
          }
        } else if (pi.itemType === ProjectItemType.resourcePackManifestJson) {
          const rpManifestJson = await ResourceManifestDefinition.ensureOnFile(pi.file);

          if (rpManifestJson) {
            if (rpManifestJson.definition && rpManifestJson.definition.dependencies) {
              const deps = rpManifestJson.definition?.dependencies;

              for (const dep of deps) {
                if (dep.uuid === oldBehaviorPackId) {
                  dep.uuid = newBehaviorPackId;
                }
              }

              await rpManifestJson.save();
            }
          }
        }
      }
    }
  }

  public hasAddonProperties(): boolean {
    return this.productType === "addon";
  }

  public async setAddonProperties() {
    this.productType = "addon";

    await this.save();
  }

  public randomizeModuleUuids(newScriptModuleId?: string, oldScriptModuleId?: string) {
    if (!this.definition) {
      return;
    }

    for (let i = 0; i < this.definition.modules.length; i++) {
      const mod = this.definition.modules[i];

      if (mod.uuid) {
        if (
          oldScriptModuleId &&
          newScriptModuleId &&
          (mod.uuid === oldScriptModuleId || mod.uuid === newScriptModuleId)
        ) {
          mod.uuid = newScriptModuleId;
        } else {
          mod.uuid = Utilities.createUuid();
        }
      }
    }
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

  static async ensureOnFile(
    file: IFile,
    loadHandler?: IEventHandler<BehaviorManifestDefinition, BehaviorManifestDefinition>
  ) {
    let bmj: BehaviorManifestDefinition | undefined;

    if (file.manager === undefined) {
      bmj = new BehaviorManifestDefinition();

      bmj.file = file;

      file.manager = bmj;
    }

    if (file.manager !== undefined && file.manager instanceof BehaviorManifestDefinition) {
      bmj = file.manager as BehaviorManifestDefinition;

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

  public ensureMetadata(): IAddonMetadata | undefined {
    if (!this.definition) {
      return undefined;
    }

    if (!this.definition.metadata) {
      this.definition.metadata = {};
    }

    return this.definition.metadata;
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

  public getScriptModule(): IAddonModule | undefined {
    if (!this.definition) {
      return undefined;
    }

    for (let i = 0; i < this.definition.modules.length; i++) {
      const mod = this.definition.modules[i];

      if (mod.type && mod.type.toLowerCase() === "script") {
        return mod;
      }
    }

    return undefined;
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

    this.definition = StorageUtilities.getJsonObject(this._file);

    this._isLoaded = true;
  }

  static async getContent(project: Project, contentOnlyUpdate?: boolean) {
    let versionMajor = 0;
    let versionMinor = 0;
    let versionPatch = 1;

    if (project.versionMajor !== undefined) {
      versionMajor = project.versionMajor;
    }

    if (project.versionMinor !== undefined) {
      versionMinor = project.versionMinor;
    }

    if (project.versionPatch !== undefined) {
      versionPatch = project.versionPatch;
    }

    const modulesList: IAddonModule[] = [];
    const dependenciesList: IAddonDependency[] = [];
    let scriptFile = undefined;
    let pi = project.getFirstItemByType(ProjectItemType.catalogIndexJs);

    if (pi !== undefined) {
      scriptFile = pi.file;
    }

    const behaviorPackRootFolder = await project.getDefaultBehaviorPackFolder(false, contentOnlyUpdate);

    if (scriptFile === undefined) {
      pi = project.getFirstItemByType(ProjectItemType.js);
      if (pi !== undefined) {
        scriptFile = pi.file;
      }

      if (scriptFile === undefined) {
        pi = project.getFirstItemByType(ProjectItemType.testJs);

        if (pi !== undefined) {
          scriptFile = pi.file;
        }
      }
    }

    const scriptState = await project.getScriptState();

    if (scriptState.hasScript && scriptFile !== null && scriptFile !== undefined && behaviorPackRootFolder !== null) {
      let path = scriptFile.getFolderRelativePath(behaviorPackRootFolder);

      if (path !== undefined) {
        if (path.startsWith("/")) {
          path = path.substring(1, path.length);
        }

        modulesList.push({
          description: project.title + " script",
          language: "javascript",
          type: "script",
          uuid: project.defaultScriptModuleUniqueId,
          version: [versionMajor, versionMinor, versionPatch],
          entry: path,
        });

        for (let i = 0; i < minecraftScriptModules.length; i++) {
          const mod = minecraftScriptModules[i];

          if (scriptState.hasModule[mod.id]) {
            dependenciesList.push({
              uuid: mod.uuid,
              module_name: mod.module_name,
              version: mod.preferredVersion,
            });
          }
        }
      }
    }

    const manifest: IAddonManifest = {
      format_version: 2,
      __comment__: AUTOGENERATED_WHOLEFILE_GENERAL_SEPARATOR,
      header: {
        description: project.description,
        name: project.title,
        uuid: project.defaultBehaviorPackUniqueId,
        version: [versionMajor, versionMinor, versionPatch],
        min_engine_version: [1, 20, 10],
      },
      modules: modulesList,
      dependencies: dependenciesList,
    };

    if (project.focus === ProjectFocus.editorExtension) {
      manifest.capabilities = ["editorExtension"];
    }

    return JSON.stringify(manifest, null, 2);
  }
}
