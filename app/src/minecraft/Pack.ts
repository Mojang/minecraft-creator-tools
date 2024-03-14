// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { EventDispatcher, IEventHandler } from "ste-events";
import Project from "../app/Project";
import IFile from "../storage/IFile";
import IFolder from "../storage/IFolder";
import ProjectItem from "../app/ProjectItem";

export enum PackType {
  resource = 0,
  behavior = 1,
  skin = 2,
}

export default class Pack {
  type?: PackType;
  manifestFile?: IFile;
  folder?: IFolder;
  project?: Project;
  projectItem?: ProjectItem;
  #isLoaded: boolean = false;
  #onLoaded = new EventDispatcher<Pack, Pack>();

  public get onLoaded() {
    return this.#onLoaded.asEvent();
  }

  get isLoaded() {
    return this.#isLoaded;
  }

  async load(force: boolean) {
    if ((this.#isLoaded && !force) || this.folder === undefined) {
      return;
    }
  }

  static async ensureOnFolder(
    folder: IFolder,
    manifestFile: IFile,
    project: Project,
    handler?: IEventHandler<Pack, Pack>
  ) {
    if (folder.manager === undefined) {
      const pack = new Pack();
      pack.project = project;
      pack.manifestFile = manifestFile;

      pack.folder = folder;
    }

    if (folder.manager !== undefined && folder.manager instanceof Pack) {
      const pack = folder.manager as Pack;

      if (!pack.isLoaded) {
        if (handler) {
          pack.onLoaded.subscribe(handler);
        }
        await pack.load(false);
      } else if (handler) {
        handler(pack, pack, { unsub: () => {}, stopPropagation: () => {} });
      }

      return pack;
    }

    return undefined;
  }
}
