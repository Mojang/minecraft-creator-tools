// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "../storage/IFile";
import Log from "../core/Log";
import { EventDispatcher, IEventHandler } from "ste-events";
import StorageUtilities from "../storage/StorageUtilities";
import { IBlocksCatalogResource } from "./IBlocksCatalog";
import Project from "../app/Project";
import { AnnotationCategory } from "../core/ContentIndex";
import Database from "./Database";
import { ProjectItemType } from "../app/IProjectItemData";
import BlockTypeDefinition from "./BlockTypeDefinition";

export interface BlocksCatalogDependendencies {
  unused: string[];
  vanillaOverride: string[];
}

export default class BlocksCatalogDefinition {
  public blocksCatalog?: IBlocksCatalogResource;
  private _file?: IFile;
  private _isLoaded: boolean = false;

  private _onLoaded = new EventDispatcher<BlocksCatalogDefinition, BlocksCatalogDefinition>();

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

  static async ensureOnFile(
    file: IFile,
    loadHandler?: IEventHandler<BlocksCatalogDefinition, BlocksCatalogDefinition>
  ) {
    let et: BlocksCatalogDefinition | undefined;

    if (file.manager === undefined) {
      et = new BlocksCatalogDefinition();

      et.file = file;

      file.manager = et;
    }

    if (file.manager !== undefined && file.manager instanceof BlocksCatalogDefinition) {
      et = file.manager as BlocksCatalogDefinition;

      if (!et.isLoaded && loadHandler) {
        et.onLoaded.subscribe(loadHandler);
      }

      await et.load();
    }

    return et;
  }

  getBlockDefinition(id: string) {
    if (!this.blocksCatalog) {
      return undefined;
    }

    if (this.blocksCatalog[id]) {
      return this.blocksCatalog[id];
    }

    const colon = id.indexOf(":");

    if (colon >= 0) {
      id = id.substring(colon + 1);
    }

    return this.blocksCatalog[id];
  }

  ensureBlockDefinition(id: string) {
    if (!this.blocksCatalog) {
      this.blocksCatalog = {};
    }

    if (this.blocksCatalog[id]) {
      return this.blocksCatalog[id];
    }

    const colon = id.indexOf(":");

    if (colon >= 0) {
      let noColonId = id.substring(colon + 1);
      if (this.blocksCatalog[noColonId]) {
        return this.blocksCatalog[noColonId];
      }
    }

    this.blocksCatalog[id] = {};

    return this.blocksCatalog[id];
  }

  getDefaultTextureId(id: string) {
    const ref = this.getBlockDefinition(id);

    if (ref && ref.textures) {
      if (typeof ref.textures === "string") {
        return ref.textures;
      }

      if (ref.textures["side"]) {
        return ref.textures["side"];
      } else if (ref.textures["up"]) {
        return ref.textures["up"];
      } else {
        for (const key in ref.textures) {
          return (ref.textures as any)[key];
        }
      }
    }

    return undefined;
  }

  getTextureReferences() {
    const textureRefs: string[] = [];
    if (this.blocksCatalog) {
      for (const resourceId in this.blocksCatalog) {
        const resource = this.blocksCatalog[resourceId];

        if (resource && resource.textures) {
          if (!textureRefs.includes(resourceId)) {
            textureRefs.push(resourceId);
          }
        }
      }
    }

    return textureRefs;
  }

  async getDependenciesList(project: Project) {
    const dependencies: BlocksCatalogDependendencies = {
      unused: [],
      vanillaOverride: [],
    };

    if (this.blocksCatalog) {
      const myBlockIds: { [name: string]: boolean } = {};

      let projectItemsCopy = project.getItemsCopy();

      for (const item of projectItemsCopy) {
        if (item.itemType === ProjectItemType.blockTypeBehavior) {
          await item.ensureFileStorage();

          if (item.primaryFile) {
            const blockTypeDef = await BlockTypeDefinition.ensureOnFile(item.primaryFile);

            if (blockTypeDef && blockTypeDef.id) {
              myBlockIds[blockTypeDef.id] = true;

              const colon = blockTypeDef.id.indexOf(":");
              if (colon >= 0) {
                const noColonId = blockTypeDef.id.substring(colon + 1);

                myBlockIds[noColonId] = true;
              }
            }
          }
        }
      }

      for (const resourceId in this.blocksCatalog) {
        if (resourceId !== "format_version") {
          const resource = this.blocksCatalog[resourceId];

          if (resource && (resource.textures || resource.sound || resource.carried_textures)) {
            if (!dependencies.unused.includes(resourceId) && !dependencies.vanillaOverride.includes(resourceId)) {
              let foundMatch = myBlockIds[resourceId] === true;

              if (!foundMatch) {
                let resourceColon = resourceId.indexOf(":");

                if (resourceColon < 0) {
                  const vanillaTermMatches = await Database.getVanillaMatches("minecraft:" + resourceId, true, [
                    AnnotationCategory.blockTypeSource,
                  ]);

                  if (vanillaTermMatches && vanillaTermMatches.length > 0) {
                    dependencies.vanillaOverride.push(resourceId);
                    foundMatch = true;
                  }
                } else if (resourceId.startsWith("minecraft:")) {
                  const vanillaTermMatches = await Database.getVanillaMatches(resourceId, true, [
                    AnnotationCategory.blockTypeSource,
                  ]);

                  if (vanillaTermMatches && vanillaTermMatches.length > 0) {
                    dependencies.vanillaOverride.push(resourceId);
                    foundMatch = true;
                  }
                }
              }

              if (!foundMatch) {
                dependencies.unused.push(resourceId);
              }
            }
          }
        }
      }
    }

    return dependencies;
  }

  removeId(id: string) {
    if (this.blocksCatalog) {
      (this.blocksCatalog[id] as any) = undefined;
    }
  }

  persist() {
    if (this._file === undefined) {
      return;
    }

    const defString = JSON.stringify(this.blocksCatalog, null, 2);

    this._file.setContent(defString);
  }

  async load() {
    if (this._isLoaded) {
      return;
    }

    if (this._file === undefined) {
      Log.unexpectedUndefined("BCRDF");
      return;
    }

    await this._file.loadContent();

    if (!this._file.content || this._file.content instanceof Uint8Array) {
      return;
    }

    let data: any = {};

    let result = StorageUtilities.getJsonObject(this._file);

    if (result) {
      data = result;
    }

    this.blocksCatalog = data;

    this._isLoaded = true;

    this._onLoaded.dispatch(this, this);
  }
}
