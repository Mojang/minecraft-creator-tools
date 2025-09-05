// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "../storage/IFile";
import Log from "../core/Log";
import { EventDispatcher, IEventHandler } from "ste-events";
import IDefinition from "./IDefinition";
import StorageUtilities, { AllowedExtensionsSet } from "../storage/StorageUtilities";
import ProjectItem from "../app/ProjectItem";
import Project from "../app/Project";
import { ProjectItemType } from "../app/IProjectItemData";
import { Exifr } from "exifr";
import { decodeTga } from "@lunapaint/tga-codec";

export type ImageCoords = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export const VibrantVisualsFileExtensionVariants = [
  "_mer.png",
  "_mer.tga",
  "_mers.png",
  "_mers.tga",
  // "_normal.png", <-- too many false positives
  // "_normal.tga",
  ".texture_set.json",
];

export default class TextureDefinition implements IDefinition {
  private _file?: IFile;
  private _isLoaded: boolean = false;
  private _isContentProcessed: boolean = false;
  private _width: number | undefined;
  private _height: number | undefined;
  private _errorMessage: string | undefined;
  private _errorProcessing: boolean | undefined;
  private _imageData: Uint8Array | undefined;

  private _onLoaded = new EventDispatcher<TextureDefinition, TextureDefinition>();

  public id: string | undefined;

  public get width() {
    return this._width;
  }

  public get height() {
    return this._height;
  }

  public get errorMessage() {
    return this._errorMessage;
  }

  public get errorProcessing() {
    return this._errorProcessing;
  }

  public get imageData() {
    return this._imageData;
  }

  public get data() {
    if (!this._file || !this._file.content || typeof this._file.content === "string") {
      return undefined;
    }

    return this._file.content;
  }

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

  getPixel(x: number, y: number) {
    if (!this._imageData) {
      throw new Error("Image data is not available.");
    }

    const width = this._width ?? 0;
    const height = this._height ?? 0;

    if (x < 0 || x >= width || y < 0 || y >= height) {
      throw new Error("Invalid pixel coordinates.");
    }

    const index = (y * width + x) * 4;
    return {
      r: this._imageData[index],
      g: this._imageData[index + 1],
      b: this._imageData[index + 2],
      a: this._imageData[index + 3],
    };
  }

  get isContentProcessed() {
    return this._isContentProcessed;
  }

  async processContent() {
    if (this._isContentProcessed) {
      return;
    }

    if (!this._file) {
      return;
    }

    if (!this._file.isContentLoaded) {
      await this._file.loadContent();
    }

    if (!this._file.content || !(this._file.content instanceof Uint8Array)) {
      return;
    }

    if (this._file.type !== "tga") {
      const exifr = new Exifr({});

      try {
        await exifr.read(this._file.content);

        const results = await exifr.parse();

        if (!results) {
          this._errorProcessing = true;
          this._errorMessage = "No results returned.";
        } else {
          this._width = results.ImageWidth;
          this._height = results.ImageHeight;
        }
      } catch (e: any) {
        this._errorProcessing = true;
        this._errorMessage = e.message ? e.message : e.toString();
      }
    } else {
      try {
        const tga = await decodeTga(this._file.content);

        this._width = tga.image.width;
        this._height = tga.image.height;
      } catch (e: any) {
        this._errorProcessing = true;
        this._errorMessage = e.message ? e.message : e.toString();
      }
    }

    /*
    this usage of pngjs didn't seem to work for a significant portion of PNGs
    same with the upnp library
    if (this._file.type === "png" && this._file.content && this._file.content instanceof Uint8Array) {
      try {
        const pngm = PNG.sync.read(Buffer.from(this._file.content.buffer));

        if (pngm.width !== this._width || pngm.height !== this._height) {
          throw new Error("Mismatch in parsed image dimensions.");
        }

        this._imageData = new Uint8Array(pngm.data);
      } catch (e: any) {
        console.log("Could not get PNG data for " + this._file.extendedPath);
      }
    }*/

    this._isContentProcessed = true;
  }

  unloadContent() {
    this._isContentProcessed = false;
    this._imageData = undefined;
  }

  static async ensureOnFile(file: IFile, loadHandler?: IEventHandler<TextureDefinition, TextureDefinition>) {
    let texd: TextureDefinition | undefined;

    if (file.manager === undefined) {
      texd = new TextureDefinition();

      texd.file = file;

      file.manager = texd;
    }

    if (file.manager !== undefined && file.manager instanceof TextureDefinition) {
      texd = file.manager as TextureDefinition;

      if (!texd.isLoaded) {
        if (loadHandler) {
          texd.onLoaded.subscribe(loadHandler);
        }

        await texd.load();
      }
    }

    return texd;
  }

  getReferencePath() {
    if (!this._file) {
      return undefined;
    }

    let projectPath = this._file.storageRelativePath;

    return TextureDefinition.getTexturePath(projectPath);
  }

  static canonicalizeTexturePath(projectPath: string | undefined) {
    if (projectPath === undefined) {
      return undefined;
    }

    projectPath = projectPath.toLowerCase();

    const lastPeriod = projectPath.lastIndexOf(".");

    if (lastPeriod >= 0) {
      const removedPart = projectPath.substring(lastPeriod + 1);

      if (AllowedExtensionsSet.has(removedPart)) {
        projectPath = projectPath.substring(0, lastPeriod);
      }
    }

    return projectPath;
  }

  static getTexturePath(projectPath: string) {
    const lastPeriod = projectPath.lastIndexOf(".");

    if (lastPeriod >= 0) {
      projectPath = projectPath.substring(0, lastPeriod);
    }

    const ppLower = projectPath.toLowerCase();

    const texturesIndex = ppLower.indexOf("/textures/");

    if (texturesIndex < 0) {
      return undefined;
    }

    return projectPath.substring(texturesIndex + 1);
  }

  persist() {}

  async load() {
    if (this._isLoaded) {
      return;
    }

    if (this._file === undefined) {
      Log.unexpectedUndefined("TSCDF");
      return;
    }

    await this._file.loadContent();

    if (!this._file.content || typeof this._file.content === "string") {
      return;
    }

    this._isLoaded = true;

    this._onLoaded.dispatch(this, this);
  }

  async addChildItems(project: Project, item: ProjectItem) {
    const itemsCopy = project.getItemsByType(ProjectItemType.texture);

    for (const candItem of itemsCopy) {
      let pf = candItem.primaryFile;

      if (!pf) {
        await candItem.ensureStorage();
        pf = candItem.primaryFile;
      }

      if (pf) {
        const parentFolder = pf.parentFolder;

        if (!parentFolder) {
          continue;
        }

        if (!parentFolder.isLoaded) {
          await parentFolder.load();
        }

        let baseName = StorageUtilities.getBaseFromName(pf.name);
        const parentFiles = parentFolder.files;

        for (const ext of VibrantVisualsFileExtensionVariants) {
          const vvSidecarFile = parentFiles[baseName + ext];
          if (vvSidecarFile !== undefined && vvSidecarFile.extendedPath) {
            const sidecarItem = project.getItemByExtendedOrProjectPath(vvSidecarFile.extendedPath);

            if (sidecarItem && sidecarItem !== candItem) {
              candItem.addChildItem(sidecarItem);
            }
          }
        }
      }
    }
  }
}
