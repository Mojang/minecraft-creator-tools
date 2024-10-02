// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "../storage/IFile";
import { EventDispatcher, IEventHandler } from "ste-events";
import StorageUtilities from "../storage/StorageUtilities";
import IBlockbenchModel, { IBlockbenchTexture } from "./IBlockbenchModel";
import ProjectItem from "../app/ProjectItem";
import ModelGeometryDefinition from "../minecraft/ModelGeometryDefinition";
import { ProjectItemType } from "../app/IProjectItemData";
import EntityTypeResourceDefinition from "../minecraft/EntityTypeResourceDefinition";
import Utilities from "../core/Utilities";
import { IGeometryBoneCube } from "../minecraft/IModelGeometry";
import { Exifr } from "exifr";

export default class BlockbenchModel {
  private _file?: IFile;
  private _id?: string;
  private _isLoaded: boolean = false;

  public definition?: IBlockbenchModel;

  private _onLoaded = new EventDispatcher<BlockbenchModel, BlockbenchModel>();

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

  static async ensureOnFile(file: IFile, loadHandler?: IEventHandler<BlockbenchModel, BlockbenchModel>) {
    let bd: BlockbenchModel | undefined;

    if (file.manager === undefined) {
      bd = new BlockbenchModel();

      bd.file = file;

      file.manager = bd;
    }

    if (file.manager !== undefined && file.manager instanceof BlockbenchModel) {
      bd = file.manager as BlockbenchModel;

      if (!bd.isLoaded && loadHandler) {
        bd.onLoaded.subscribe(loadHandler);
      }

      await bd.load();

      return bd;
    }

    return bd;
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

  static createEmptyModel(name: string, identifier: string): IBlockbenchModel {
    return {
      meta: {
        format_version: "4.10",
        model_format: "bedrock",
        box_uv: true,
      },
      name: name,
      model_identifier: identifier,
      variable_placeholder_buttons: [],
      variable_placeholders: "",
      visible_box: [1, 1, 1],
      bedrock_animation_mode: "entity",
      timeline_setups: [],
      unhandled_root_fields: {},
      resolution: { width: 64, height: 32 },
      elements: [],
      outliner: [],
    };
  }

  static async exportModel(modelProjectItem: ProjectItem, modelIndex?: number): Promise<IBlockbenchModel | undefined> {
    if (modelIndex === undefined) {
      modelIndex = 0;
    }

    await modelProjectItem.ensureFileStorage();

    let clientEntityItem: ProjectItem | undefined = undefined;
    let clientEntity: EntityTypeResourceDefinition | undefined = undefined;
    let model: ModelGeometryDefinition | undefined = undefined;

    if (modelProjectItem.file) {
      model = await ModelGeometryDefinition.ensureOnFile(modelProjectItem.file);
    }

    if (modelProjectItem.parentItems) {
      for (const parentItemOuter of modelProjectItem.parentItems) {
        if (parentItemOuter.parentItem.itemType === ProjectItemType.entityTypeResource) {
          clientEntityItem = parentItemOuter.parentItem;
          if (clientEntityItem && clientEntityItem.file) {
            clientEntity = await EntityTypeResourceDefinition.ensureOnFile(clientEntityItem.file);
          }
        }
      }
    }

    if (!model || model.identifiers.length === 0 || !model.file || !model.wrapper || model.definitions.length === 0) {
      return undefined;
    }

    const bbmodel = this.createEmptyModel(
      StorageUtilities.getBaseFromName(model.file.name),
      model.identifiers[modelIndex]
    );

    const textureWidth = model.getTextureWidth(modelIndex);
    const textureHeight = model.getTextureHeight(modelIndex);

    if (textureWidth !== undefined && textureHeight !== undefined) {
      bbmodel.resolution = {
        width: textureWidth,
        height: textureHeight,
      };
    }

    const visibleBoundsWidth = model.getVisibleBoundsWidth(modelIndex);
    const visibleBoundsHeight = model.getVisibleBoundsHeight(modelIndex);
    const visibleBoundsOffset = model.getVisibleBoundsOffset(modelIndex);

    if (visibleBoundsWidth && visibleBoundsHeight && visibleBoundsOffset && visibleBoundsOffset.length > 1) {
      bbmodel.visible_box = [visibleBoundsWidth, visibleBoundsHeight, visibleBoundsOffset[1]];
    }

    const def = model.definitions[modelIndex];

    for (const bone of def.bones) {
      if (bone.cubes.length >= 0) {
        const childrenIds = [];

        for (const cube of bone.cubes) {
          const id = Utilities.createUuid();

          if (cube.origin && cube.origin.length === 3 && cube.size && cube.size.length === 3) {
            const cubeTo = new Array(3);

            cubeTo[0] = cube.origin[0] + cube.size[0];
            cubeTo[1] = cube.origin[1] + cube.size[1];
            cubeTo[2] = cube.origin[2] + cube.size[2];

            bbmodel.elements?.push({
              name: bone.name,
              box_uv: true,
              rescale: false,
              locked: false,
              light_emission: 0,
              render_order: "default",
              allow_mirror_modeling: true,
              from: cube.origin,
              to: cubeTo,
              autouv: 0,
              color: 0,
              rotation: bone.bind_pose_rotation ? bone.bind_pose_rotation : [0, 0, 0],
              origin: bone.pivot,
              uv_offset: cube.uv,
              type: "cube",
              faces: {
                north: { uv: BlockbenchModel.getNorthBoxUvCoordinates(cube), texture: 0 },
                east: { uv: BlockbenchModel.getEastBoxUvCoordinates(cube), texture: 0 },
                south: { uv: BlockbenchModel.getSouthBoxUvCoordinates(cube), texture: 0 },
                west: { uv: BlockbenchModel.getWestBoxUvCoordinates(cube), texture: 0 },
                up: { uv: BlockbenchModel.getUpBoxUvCoordinates(cube), texture: 0 },
                down: { uv: BlockbenchModel.getDownBoxUvCoordinates(cube), texture: 0 },
              },
              uuid: id,
            });

            childrenIds.push(id);
          }
        }

        bbmodel.outliner?.push({
          name: bone.name,
          origin: bone.pivot,
          bedrock_binding: "",
          color: 0,
          uuid: Utilities.createUuid(),
          export: true,
          mirror_uv: false,
          isOpen: false,
          locked: false,
          visibility: true,
          autouv: 0,
          children: childrenIds,
        });
      }
    }

    let textureList: IBlockbenchTexture[] = [];
    bbmodel.textures = [];

    if (clientEntity && clientEntityItem && clientEntityItem.file) {
      const textures = clientEntity.getTextureItems(clientEntityItem);

      if (textures) {
        for (const textureName in textures) {
          const textureItem = textures[textureName];

          if (textureName && textureItem && textureItem.file) {
            await textureItem.file.loadContent();
            const exifr = new Exifr({});

            if (textureItem.file.content) {
              try {
                await exifr.read(textureItem.file.content);

                const results = await exifr.parse();

                const relativePath = clientEntityItem.file.getRelativePathFor(textureItem.file);
                const contentStr = StorageUtilities.getContentAsString(textureItem.file);

                if (relativePath && contentStr) {
                  textureList.push({
                    path: textureItem.file.storageRelativePath,
                    name: textureItem.file.name,
                    folder: "",
                    namespace: "",
                    id: textureList.length.toString(),
                    group: "",
                    width: results.ImageWidth,
                    height: results.ImageHeight,
                    uv_width: results.ImageWidth,
                    uv_height: results.ImageHeight,
                    particle: false,
                    use_as_default: false,
                    layers_enabled: false,
                    sync_to_project: "",
                    render_mode: "default",
                    render_sides: "auto",
                    frame_time: 1,
                    frame_order_type: "loop",
                    frame_order: "",
                    frame_interpolate: false,
                    visible: true,
                    internal: true,
                    saved: true,
                    uuid: Utilities.createUuid(),
                    relative_path: relativePath,
                    source: contentStr,
                  });

                  bbmodel.textures?.push(textureList[textureList.length - 1]);
                }
              } catch (e) {}
            }
          }
        }
      }
    }

    return bbmodel;
  }

  /*
  Standard Box UV Mapping: 

        +s0-+s0-+
        | u | d | < s2
    +s2-+s0-+s0-+s2-+
    | e | n | w | s | < s1
    +---+---+---+---+

    bb coordinates are: x1, y1, x2, y2
  */

  static getUpBoxUvCoordinates(cube: IGeometryBoneCube) {
    return [cube.uv[0] + cube.size[2], cube.uv[1], cube.uv[0] + cube.size[2] + cube.size[0], cube.uv[1] + cube.size[2]];
  }

  static getDownBoxUvCoordinates(cube: IGeometryBoneCube) {
    return [
      cube.uv[0] + cube.size[0] + cube.size[2],
      cube.uv[1],
      cube.uv[0] + cube.size[2] + cube.size[0] * 2,
      cube.uv[1] + cube.size[2],
    ];
  }

  static getEastBoxUvCoordinates(cube: IGeometryBoneCube) {
    return [cube.uv[0], cube.uv[1] + cube.size[2], cube.uv[0] + cube.size[2], cube.uv[1] + cube.size[2] + cube.size[1]];
  }

  static getNorthBoxUvCoordinates(cube: IGeometryBoneCube) {
    return [
      cube.uv[0] + cube.size[2],
      cube.uv[1] + cube.size[2],
      cube.uv[0] + cube.size[2] + cube.size[0],
      cube.uv[1] + cube.size[2] + cube.size[1],
    ];
  }

  static getWestBoxUvCoordinates(cube: IGeometryBoneCube) {
    return [
      cube.uv[0] + cube.size[2] + cube.size[0],
      cube.uv[1] + cube.size[2],
      cube.uv[0] + cube.size[2] * 2 + cube.size[0],
      cube.uv[1] + cube.size[2] + cube.size[1],
    ];
  }

  static getSouthBoxUvCoordinates(cube: IGeometryBoneCube) {
    return [
      cube.uv[0] + cube.size[2] * 2 + cube.size[0],
      cube.uv[1] + cube.size[2],
      cube.uv[0] + cube.size[2] * 2 + cube.size[0] * 2,
      cube.uv[1] + cube.size[2] + cube.size[1],
    ];
  }
}
