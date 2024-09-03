// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import BehaviorManifestDefinition from "../minecraft/BehaviorManifestDefinition";
import Database from "../minecraft/Database";
import IFolder from "../storage/IFolder";
import StorageUtilities from "../storage/StorageUtilities";
import Project from "./Project";
import * as esbuild from "esbuild-wasm";
import ITypeDefCatalog from "../minecraft/ITypeDefCatalog";
import { IErrorMessage, IErrorable } from "../core/IErrorable";
import { StatusTopic } from "./Status";
import { ProjectItemType } from "./IProjectItemData";

export default class ProjectBuild implements IErrorable {
  private project: Project;
  private mainScriptsFolder: IFolder | undefined = undefined;
  private libs: ITypeDefCatalog | null = null;
  private distScriptsFolder: IFolder | undefined = undefined;
  private entry: string | undefined = undefined;

  private static isInitialized = false;

  constructor(projectIn: Project) {
    this.project = projectIn;

    this.loadFile = this.loadFile.bind(this);
  }

  isInErrorState?: boolean;
  errorMessages?: IErrorMessage[];

  resolveFile(resolve: esbuild.OnResolveArgs): esbuild.OnResolveResult {
    if (Database.minecraftModuleNames.includes(resolve.path)) {
      return {
        external: true,
        namespace: "ct",
      };
    }

    return {
      path: resolve.path,
      namespace: "ct",
    };
  }

  _pushError(message: string) {
    this.isInErrorState = true;
    if (!this.errorMessages) {
      this.errorMessages = [];
    }

    this.errorMessages.push({ message: message });
  }

  _getErrorResponse(id: string, message: string) {
    this._pushError("Project Build:" + message);

    return {
      errors: [
        {
          id: id,
          text: message,
        },
      ],
    };
  }

  getTypeDefContentFor(name: string, isTs: boolean): esbuild.OnLoadResult {
    if (!this.libs) {
      return this._getErrorResponse("esb-typenotfound", "Could not find typedef '" + name + "'");
    }

    for (const typeDef of this.libs.typeDefs) {
      if (typeDef.name === name) {
        return {
          contents: typeDef.content.join("\r\n"),
          loader: isTs ? "ts" : "js",
        };
      }
    }

    return this._getErrorResponse("esb-typenotfound", "Could not find typedef '" + name + "'");
  }

  get isBuildable() {
    return this.project && this.project.projectFolder !== undefined;
  }

  getHasBuildableElements() {
    for (const projectItem of this.project.items) {
      if (projectItem.itemType === ProjectItemType.ts) {
        return true;
      }
    }

    return false;
  }

  async loadFile(build: esbuild.OnLoadArgs): Promise<esbuild.OnLoadResult> {
    if (
      !this.project ||
      !this.project.projectFolder ||
      !this.mainScriptsFolder ||
      !this.distScriptsFolder ||
      !this.libs
    ) {
      return this._getErrorResponse("esb-uninit", "Project does not have buildable elements.");
    }

    if (build.path === "@minecraft/vanilla-data") {
      return this.getTypeDefContentFor("@minecraft/vanilla-data", true);
    } else if (build.path === "@minecraft/math") {
      return this.getTypeDefContentFor("@minecraft/math", false);
    }

    let path = build.path;

    if (path.startsWith("./")) {
      path = path.substring(1);
    }

    const ext = StorageUtilities.getTypeFromName(path);

    if (ext === "js") {
      path = path.substring(0, path.length - 3) + ".ts";
    } else if (ext === "") {
      path = path + ".ts";
    }

    if (!path.startsWith("/")) {
      return this._getErrorResponse("esb-importnotfound", "Could not find import '" + path + "'");
    }

    let file = await this.mainScriptsFolder.ensureFileFromRelativePath(path);

    await file.loadContent();
    let content = file.content;

    if (!content || typeof content !== "string") {
      if (StorageUtilities.getTypeFromName(path) === "ts") {
        path = path.substring(0, path.length - 3) + ".js";

        file = await this.mainScriptsFolder.ensureFileFromRelativePath(path);

        await file.loadContent();
        content = file.content;

        if (!content || typeof content !== "string") {
          content = "";
        }
      } else {
        return this._getErrorResponse("esb-filenotfound", "Could not find file '" + build.path + "'");
      }
    }

    return {
      contents: content,
      loader: "ts",
      resolveDir: StorageUtilities.getFolderPath(build.path),
    };
  }

  async build() {
    if (!this.isBuildable) {
      return;
    }

    if (!this.getHasBuildableElements()) {
      return;
    }

    const operId = await this.project.carto.notifyOperationStarted("Script building '" + this.project.name + "'");

    const defaultBehaviorPack = await this.project.getDefaultBehaviorPack();

    if (defaultBehaviorPack === undefined) {
      return;
    }

    const behaviorPackDefinition = await defaultBehaviorPack.ensureManifest();

    if (!behaviorPackDefinition || !(behaviorPackDefinition instanceof BehaviorManifestDefinition)) {
      return;
    }

    const scriptModule = behaviorPackDefinition.getScriptModule();
    const libScriptsFolder = this.project.getLibScriptsFolder();
    this.mainScriptsFolder = await this.project.getMainScriptsFolder();

    if (scriptModule && scriptModule.entry && libScriptsFolder) {
      this.libs = await Database.getLibs();

      this.distScriptsFolder = await this.project.ensureDistBuildScriptsFolder();

      if (this.libs) {
        this.entry = scriptModule.entry;

        if (this.entry.toLowerCase().startsWith("scripts/")) {
          this.entry = this.entry.substring(7);
        }

        if (!ProjectBuild.isInitialized) {
          ProjectBuild.isInitialized = true;
          await esbuild.initialize({
            wasmURL: "./dist/esbuild-wasm/esbuild.wasm",
          });
        }

        const me = this;

        try {
          const result = await esbuild.build({
            bundle: true,
            entryPoints: [this.entry],
            format: "esm",
            external: Database.minecraftModuleNames,
            plugins: [
              {
                name: "ct",
                setup(build) {
                  build.onResolve({ filter: /.*/ }, me.resolveFile);
                  build.onLoad({ filter: /.*/, namespace: "ct" }, me.loadFile);
                },
              },
            ],
          });

          if (result && result.outputFiles && result.outputFiles.length > 0) {
            const mainJsFile = await this.distScriptsFolder.ensureFileFromRelativePath(this.entry);

            mainJsFile.setContent(result.outputFiles[0].text);

            await mainJsFile.saveContent();
          }
        } catch (e: any) {
          if (!this.isInErrorState && e) {
            this._pushError(e.toString());
          }
        }

        await me.project.carto?.notifyOperationEnded(
          operId,
          "Completed script building '" + this.project.name + "'",
          StatusTopic.scriptBuild,
          this.isInErrorState
        );
      }
    }
  }

  async aggregateScripts(scriptFolder: IFolder) {
    await scriptFolder.load();

    let script = "";

    for (const fileName in scriptFolder.files) {
      const ext = StorageUtilities.getTypeFromName(fileName);

      if (ext === "js") {
        const scriptFile = scriptFolder.files[fileName];

        if (scriptFile) {
          await scriptFile?.loadContent();

          if (scriptFile.content && typeof scriptFile.content === "string") {
            script += "// " + fileName + "\r\n" + scriptFile.content + "\r\n";
          }
        }
      }
    }

    for (const folderName in scriptFolder.folders) {
      const childFolder = scriptFolder.folders[folderName];

      if (childFolder) {
        const fileScript = await this.aggregateScripts(childFolder);

        script += fileScript;
      }
    }

    return script;
  }

  async syncToBehaviorPack(bpTargetFolder: IFolder) {
    if (!this.getHasBuildableElements()) {
      return;
    }

    const distScriptsFolder = await this.project.ensureDistBuildScriptsFolder();

    const scriptsFolder = bpTargetFolder.ensureFolder("scripts");

    await StorageUtilities.syncFolderTo(distScriptsFolder, scriptsFolder, true, true, false, []);
  }
}
