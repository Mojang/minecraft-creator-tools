// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "../storage/IFile";
import { EventDispatcher, IEventHandler } from "ste-events";
import StorageUtilities from "../storage/StorageUtilities";
import Project from "../app/Project";
import IImageEditor, { IImageItem, IImageOutput, ImageOutputType, PaintingSize } from "./IImageEdits";
import { ImageItem } from "./ImageItem";
import ProjectItemUtilities from "../app/ProjectItemUtilities";
import { ProjectItemType } from "../app/IProjectItemData";
import ProjectItemCreateManager from "../app/ProjectItemCreateManager";
import BlockTypeDefinition from "../minecraft/BlockTypeDefinition";
import Utilities from "../core/Utilities";
import IImageEdits from "./IImageEdits";
import ProjectItem from "../app/ProjectItem";

export default class ImageEditsDefinition {
  private _file?: IFile;
  private _id?: string;
  private _isLoaded: boolean = false;

  public items: ImageItem[] = [];
  public _backgroundItem?: ImageItem;
  public data?: IImageEditor;

  private _onLoaded = new EventDispatcher<ImageEditsDefinition, ImageEditsDefinition>();

  public project: Project | undefined = undefined;

  public get stackPosition() {
    return this.data?.stackPosition;
  }

  public set stackPosition(newStackPosition: number | undefined) {
    if (!this.data) {
      return;
    }

    this.data.stackPosition = newStackPosition;
  }

  public get backgroundItem() {
    let backgroundItem = this._backgroundItem;
    if (backgroundItem) {
      return backgroundItem;
    }

    if (!this.data) {
      return undefined;
    }

    backgroundItem = new ImageItem({
      origin: { x: 0, y: 0 },
      type: 2,
      coords: [],
    });

    this._backgroundItem = backgroundItem;

    return backgroundItem;
  }

  public ensureBackgroundItem(imageData: IImageItem) {
    if (!this._backgroundItem) {
      this._backgroundItem = new ImageItem(imageData);
    } else {
      this._backgroundItem.data = imageData;
    }

    if (!this.data) {
      this.data = {
        items: [],
      };
    }

    this.data.backgroundItem = this._backgroundItem.data;

    return this._backgroundItem;
  }

  public get height() {
    if (!this.data || !this.data.height) {
      return 64;
    }

    return this.data.height;
  }

  public set height(height: number) {
    if (!this.data) {
      return;
    }

    this.data.height = height;
  }

  public get width() {
    if (!this.data || !this.data.width) {
      return 64;
    }

    return this.data.width;
  }

  public set width(width: number) {
    if (!this.data) {
      return;
    }

    this.data.width = width;
  }

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

  public get id() {
    return this._id;
  }

  public set id(newId: string | undefined) {
    this._id = newId;
  }

  public get outputs() {
    if (!this.data) {
      return undefined;
    }

    return this.data.outputs;
  }

  private ensureData(): IImageEditor {
    if (!this.data) {
      this.data = {
        items: [],
      };
    }

    if (!this.data.items) {
      this.data.items = [];
    }

    return this.data;
  }

  async updateOutputs(project: Project) {
    if (!this.data?.outputs) {
      return;
    }

    for (const output of this.data.outputs) {
      await this.updateOutput(project, output);
    }
  }

  async getCorrespondingResourcePackFolder() {
    if (!this.project) {
      return undefined;
    }

    let rpFolder = await this.project?.getDefaultResourcePackFolder();

    return rpFolder;
  }

  async getPaintingOverrideFolder() {
    let rpFolder = await this.getCorrespondingResourcePackFolder();

    if (!rpFolder) {
      return undefined;
    }

    if (!this._file) {
      return undefined;
    }

    rpFolder = await rpFolder.ensureFolderFromRelativePath("/textures/painting/");

    return rpFolder;
  }

  async getCorrespondingBlockTextureFolder() {
    let rpFolder = await this.getCorrespondingResourcePackFolder();

    if (!rpFolder) {
      return undefined;
    }

    if (!this._file) {
      return undefined;
    }

    rpFolder = await rpFolder.ensureFolderFromRelativePath("/textures/blocks/");

    const subPath = StorageUtilities.getBaseFromName(this._file?.name);

    rpFolder = rpFolder?.ensureFolder(subPath);

    return rpFolder;
  }

  async updateOutput(project: Project, output: IImageOutput) {
    if (output.name) {
      if (output.type === ImageOutputType.blockBillboard3x3) {
        await this.updateBlocks(project, output.name, 3, 3);
      } else if (output.type === ImageOutputType.blockBillboard4x6) {
        await this.updateBlocks(project, output.name, 6, 4);
      } else if (output.type === ImageOutputType.blockBillboard5x8) {
        await this.updateBlocks(project, output.name, 8, 5);
      }
    }
  }

  async setFromCreationData(creationData: IImageEdits) {
    if (!this.data) {
      if (creationData.items === undefined) {
        creationData.items = [];
      }

      this.data = creationData;
    }

    if (creationData.outputs) {
      this.data.outputs = creationData.outputs;
    }

    if (creationData.width) {
      this.data.width = creationData.width;
    }

    if (creationData.height) {
      this.data.height = creationData.height;
    }

    await this.persist();
  }

  static getPaintingWidth(paintingSize: PaintingSize) {
    switch (paintingSize) {
      case PaintingSize.threeByThree:
      case PaintingSize.threeByFourPortrait:
        return 48;
    }

    return 16;
  }

  static getPaintingHeight(paintingSize: PaintingSize) {
    switch (paintingSize) {
      case PaintingSize.oneBlock:
        return 16;
      case PaintingSize.threeByThree:
        return 48;
      case PaintingSize.threeByFourPortrait:
        return 64;
    }

    return 16;
  }

  async updateBlocks(project: Project, name: string, width: number, height: number) {
    const blockTextureFolder = await this.getCorrespondingBlockTextureFolder();

    if (!blockTextureFolder) {
      return;
    }
    for (let i = 0; i < height; i++) {
      for (let j = 0; j < width; j++) {
        const targetName = name + "_r" + String(i + 1) + "c" + String(j + 1);

        let item = ProjectItemUtilities.getItemByTypeAndName(project, targetName, ProjectItemType.blockTypeBehavior);

        if (!item) {
          const galleryItem = await project.carto.getGalleryProjectById("basicDieBlock");

          if (galleryItem) {
            await ProjectItemCreateManager.addFromGallery(project, targetName, galleryItem);
          }

          item = ProjectItemUtilities.getItemByTypeAndName(project, targetName, ProjectItemType.blockTypeBehavior);
        }

        if (item) {
          await item.loadFileContent();

          if (item.primaryFile) {
            const blockType = await BlockTypeDefinition.ensureOnFile(item.primaryFile);

            if (blockType && blockTextureFolder.parentFolder) {
              const imageFile = blockTextureFolder.ensureFile(targetName + ".png");

              let parentFolder = blockTextureFolder;

              while (
                parentFolder.parentFolder !== undefined &&
                parentFolder.parentFolder !== null &&
                parentFolder.name.toLowerCase() !== "textures"
              ) {
                parentFolder = parentFolder.parentFolder;
              }

              // go one above textures if possible
              if (parentFolder.parentFolder) {
                parentFolder = parentFolder.parentFolder;
              }

              let frPath = imageFile.getFolderRelativePath(parentFolder);

              if (frPath) {
                await blockType.setBlockCatalogTexture(project, "north", targetName);
                await blockType.setBlockCatalogTexture(project, "east", targetName);
                await blockType.setBlockCatalogTexture(project, "south", targetName);
                await blockType.setBlockCatalogTexture(project, "west", targetName);
                await blockType.setBlockCatalogTexture(project, "up", targetName);
                await blockType.setBlockCatalogTexture(project, "down", targetName);

                if (frPath.endsWith(".png")) {
                  frPath = frPath.substring(0, frPath.length - 4);
                }

                frPath = Utilities.ensureNotStartsWithSlash(frPath);

                await blockType.setTerrainTexture(project, targetName, {
                  textures: [{ path: frPath, overlay_color: "#8ab689" }],
                });
              }
            }
          }
        }
      }
    }
  }

  addNewDrawingItem(item: ImageItem) {
    let data = this.data;

    if (!data) {
      data = this.ensureData();
    }

    if (data.stackPosition !== undefined) {
      this.items = this.items.slice(0, data.stackPosition);
      data.items = data.items.slice(0, data.stackPosition);

      this.stackPosition = undefined;
    }

    data.items.push(item.data);
    this.items.push(item);
  }

  static async ensureAsAccessoryOnImageProjectItem(projectItem: ProjectItem) {
    const accessoryFolder = await projectItem.ensureAccessoryFolder();

    const imageFile = accessoryFolder.ensureFile("image_edits.json");

    return await ImageEditsDefinition.ensureOnFile(imageFile, projectItem.project);
  }

  static async ensureOnFile(
    file: IFile,
    project: Project,
    loadHandler?: IEventHandler<ImageEditsDefinition, ImageEditsDefinition>
  ) {
    let imageEdits: ImageEditsDefinition | undefined;

    if (file.manager === undefined) {
      imageEdits = new ImageEditsDefinition();

      imageEdits.project = project;
      imageEdits.file = file;

      file.manager = imageEdits;
    }

    if (file.manager !== undefined && file.manager instanceof ImageEditsDefinition) {
      imageEdits = file.manager as ImageEditsDefinition;

      if (!imageEdits.isLoaded && loadHandler) {
        imageEdits.onLoaded.subscribe(loadHandler);
      }

      await imageEdits.load();

      return imageEdits;
    }

    return imageEdits;
  }

  async persist() {
    if (this._file === undefined) {
      return;
    }

    const imageEditorString = JSON.stringify(this.data, null, 2);

    this._file.setContent(imageEditorString);
  }

  async save() {
    if (this._file === undefined) {
      return;
    }

    await this.persist();

    await this._file.saveContent(false);
  }

  _loadFromItems() {
    this.items = [];

    if (this.data?.backgroundItem) {
      this._backgroundItem = new ImageItem(this.data.backgroundItem);
    }

    if (this.data?.items) {
      for (const dataItem of this.data?.items) {
        this.items.push(new ImageItem(dataItem));
      }
    }
  }

  async load() {
    if (this._file === undefined || this._isLoaded) {
      return;
    }

    if (!this._file.isContentLoaded) {
      await this._file.loadContent();
    }

    if (this._file.content === null || this._file.content instanceof Uint8Array) {
      return;
    }

    this.id = this._file.name;

    this.data = StorageUtilities.getJsonObject(this._file);
    this._loadFromItems();

    this._isLoaded = true;
  }
}
