// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "../storage/IFile";
import { EventDispatcher, IEventHandler } from "ste-events";
import StorageUtilities from "../storage/StorageUtilities";
import Log from "../core/Log";
import Project from "../app/Project";
import { PackageJSON } from "@npm/types";

export const DevDependenciesDefault: Record<string, string> = {
  "@minecraft/core-build-tasks": "^5.2.0",
  "eslint-plugin-minecraft-linting": "^2.0.2",
  "source-map": "^0.7.4",
  "ts-node": "^10.9.1",
  typescript: "^5.5.4",
};

export const ScriptsDefault: Record<string, string> = {
  lint: "just-scripts lint",
  build: "just-scripts build",
  clean: "just-scripts clean",
  "local-deploy": "just-scripts local-deploy",
  mcaddon: "just-scripts mcaddon",
  enablemcloopback:
    "CheckNetIsolation.exe LoopbackExempt -a -p=S-1-15-2-1958404141-86561845-1752920682-3514627264-368642714-62675701-733520436",
  enablemcpreviewloopback:
    "CheckNetIsolation.exe LoopbackExempt -a -p=S-1-15-2-424268864-5579737-879501358-346833251-474568803-887069379-4040235476",
  buildsnippets: "just-scripts buildSnippets",
};

export const DependenciesDefault: Record<string, string> = {
  "@minecraft/math": "^2.2.7",
  "@minecraft/server": "^2.0.0",
  "@minecraft/server-editor": "^0.1.0-beta.1.21.30-preview.24",
  "@minecraft/server-ui": "^2.0.0",
  "@minecraft/vanilla-data": "^1.21.90",
};

export const OverridesDefault: { [name: string]: any } = {
  "@minecraft/math": {
    "@minecraft/server": "$@minecraft/server",
  },
  "@minecraft/server-gametest": {
    "@minecraft/server": "$@minecraft/server",
  },
  "@minecraft/server-ui": {
    "@minecraft/server": "$@minecraft/server",
  },
};

export const PackageJsonDefault: PackageJSON = {
  name: "my-project",
  version: "0.1.0",
  description: "My Minecraft Addon Project",
  private: true,
  devDependencies: DevDependenciesDefault,
  scripts: ScriptsDefault,
  dependencies: DependenciesDefault,
};

export const NpmPackageSettingAllowList = [
  "name",
  "author",
  "dependencies",
  "devDependencies",
  "contributors",
  "license",
  "overrides",
  "version",
  "productName",
  "description",
  "private",
  "scripts",
];

export default class NpmPackageDefinition {
  private _file?: IFile;
  private _id?: string;
  private _isLoaded: boolean = false;

  public definition?: PackageJSON;

  private _onLoaded = new EventDispatcher<NpmPackageDefinition, NpmPackageDefinition>();

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

  static async ensureOnFile(file: IFile, loadHandler?: IEventHandler<NpmPackageDefinition, NpmPackageDefinition>) {
    let dt: NpmPackageDefinition | undefined;

    if (file.manager === undefined) {
      dt = new NpmPackageDefinition();

      dt.file = file;

      file.manager = dt;
    }

    if (file.manager !== undefined && file.manager instanceof NpmPackageDefinition) {
      dt = file.manager as NpmPackageDefinition;

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

  async ensureMinContent(project: Project) {
    await this.load();

    if (!this.definition) {
      this.definition = PackageJsonDefault;
    }

    await this.updateContent(project);
    await this.ensureStandardContent();
  }

  async updateContent(project: Project) {
    await this.load();

    if (!this.definition) {
      return;
    }

    this.definition.name = project.name;
    this.definition.description = project.description;
    this.definition.version = project.versionAsString;
  }

  async ensureStandardContent() {
    await this.load();

    if (!this.definition) {
      return;
    }

    if (this.definition.devDependencies) {
      let isValidDevDependencies = true;

      for (const devDepend in this.definition.devDependencies) {
        if (DevDependenciesDefault[devDepend] === undefined) {
          Log.debugAlert("Unexpected dev dependency '" + devDepend + "' found.");
          isValidDevDependencies = false;
        }
      }

      if (!isValidDevDependencies) {
        this.definition.devDependencies = DevDependenciesDefault;
      }
    }

    if (this.definition.dependencies) {
      let isValidDependencies = true;

      for (const dependencyName in this.definition.dependencies) {
        if (DependenciesDefault[dependencyName] === undefined) {
          Log.debugAlert("Unexpected dependency '" + dependencyName + "' found.");
          isValidDependencies = false;
        }
      }

      if (!isValidDependencies) {
        this.definition.dependencies = DependenciesDefault;
      }
    }

    if ((this.definition as any).overrides) {
      const overrides: { [name: string]: any } = (this.definition as any).overrides;

      let isOverrideValid = true;

      for (const overrideName in overrides) {
        if (OverridesDefault[overrideName] === undefined) {
          Log.debugAlert("Unexpected override '" + overrideName + "' found.");
          isOverrideValid = false;
        } else if (JSON.stringify(OverridesDefault[overrideName]) !== JSON.stringify(overrides[overrideName])) {
          Log.debugAlert(
            "Unexpected override '" +
              overrideName +
              "' is not in exepected form: " +
              JSON.stringify(overrides[overrideName])
          );
          isOverrideValid = false;
        }
      }

      if (!isOverrideValid) {
        (this.definition as any).overrides = OverridesDefault;
      }
    }

    if (this.definition.scripts) {
      let isValidScripts = true;

      for (const scriptName in this.definition.scripts) {
        if (ScriptsDefault[scriptName] === undefined) {
          Log.debugAlert("Unexpected script '" + scriptName + "' found.");
          isValidScripts = false;
        } else if (this.definition.scripts[scriptName] !== ScriptsDefault[scriptName]) {
          Log.debugAlert("Script '" + scriptName + "' is in unexpected form: " + this.definition.scripts[scriptName]);
          isValidScripts = false;
        }
      }

      if (!isValidScripts) {
        this.definition.scripts = ScriptsDefault;
      }
    }

    for (const key in this.definition) {
      if (!NpmPackageSettingAllowList.includes(key)) {
        (this.definition as any)[key] = undefined;
        Log.debugAlert("Unexpected setting '" + key + "' found in package.json.");
      }
    }
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

    this.definition = StorageUtilities.getJsonObject(this._file);

    this._isLoaded = true;
  }
}
