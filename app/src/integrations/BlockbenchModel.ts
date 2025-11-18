// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "../storage/IFile";
import { EventDispatcher, IEventHandler } from "ste-events";
import StorageUtilities from "../storage/StorageUtilities";
import IBlockbenchModel, {
  IBlockbenchAnimation,
  IBlockbenchAnimationAnimator,
  IBlockbenchAnimationKeyframe,
  IBlockbenchElement,
  IBlockbenchFace,
  IBlockbenchGroupItem,
  IBlockbenchOutlineItem,
  IBlockbenchOutlineOrGroupItem,
  IBlockbenchTexture,
} from "./IBlockbenchModel";
import ProjectItem from "../app/ProjectItem";
import ModelGeometryDefinition from "../minecraft/ModelGeometryDefinition";
import { ProjectItemCreationType, ProjectItemStorageType, ProjectItemType } from "../app/IProjectItemData";
import EntityTypeResourceDefinition from "../minecraft/EntityTypeResourceDefinition";
import Utilities from "../core/Utilities";
import { IGeometry, IGeometryBone, IGeometryBoneCube, IGeometryUVFaces } from "../minecraft/IModelGeometry";
import { Exifr } from "exifr";
import Project, { FolderContext } from "../app/Project";
import Log from "../core/Log";
import AttachableResourceDefinition from "../minecraft/AttachableResourceDefinition";
import BlockTypeDefinition from "../minecraft/BlockTypeDefinition";
import AnimationResourceDefinition from "../minecraft/AnimationResourceDefinition";
import MinecraftUtilities from "../minecraft/MinecraftUtilities";

export default class BlockbenchModel {
  private _file?: IFile;
  private _id?: string;
  private _isLoaded: boolean = false;

  private _data?: IBlockbenchModel;

  private _onLoaded = new EventDispatcher<BlockbenchModel, BlockbenchModel>();

  public get data() {
    return this._data;
  }

  public set data(content: IBlockbenchModel | undefined) {
    this._data = content;
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

  public get name() {
    if (this._data) {
      return this._data.name;
    }

    return undefined;
  }

  public get id() {
    if (this._id) {
      return this._id;
    }

    if (this._data && this._data.model_identifier) {
      return this._data.model_identifier;
    }

    return undefined;
  }

  public set id(newId: string | undefined) {
    this._id = newId;

    if (this._data && newId !== undefined) {
      this._data.model_identifier = newId;
    }
  }

  static ensureFromContent(content: string) {
    const bd = new BlockbenchModel();

    const obj = JSON.parse(content);

    bd.data = obj;

    return bd;
  }

  getMinecraftUVFace(face: IBlockbenchFace) {
    if (face.uv.length >= 4) {
      return {
        uv: [face.uv[0], face.uv[1]],
        uv_size: [Math.abs(face.uv[2] - face.uv[0]), Math.abs(face.uv[3] - face.uv[1])],
      };
    } else if (face.uv.length >= 2) {
      return {
        uv: [face.uv[0], face.uv[1]],
        uv_size: [1, 1],
      };
    }

    return { uv: [0, 0], uv_size: [1, 1] };
  }

  async updateMinecraftAnimationsFromBlockbench(
    animationDef: AnimationResourceDefinition,
    etrd?: EntityTypeResourceDefinition
  ) {
    if (!this.data?.animations) {
      return;
    }

    for (const animation of this.data.animations) {
      if (animation.name) {
        const targetMcAnimation = animationDef.ensureAnimation(animation.name);

        if (animation.loop === "loop") {
          targetMcAnimation.loop = true;
        } else {
          targetMcAnimation.loop = false;
        }

        if (etrd) {
          etrd.ensureAnimationAndScript(animation.name);
          etrd.persist();
        }

        const rotationKeyframes: { [boneName: string]: { [timeCode: string]: (string | number)[] } } = {};
        const positionKeyframes: { [boneName: string]: { [timeCode: string]: (string | number)[] } } = {};
        const scaleKeyframes: { [boneName: string]: { [timeCode: string]: (string | number)[] } } = {};

        for (const animatorName in animation.animators) {
          const animator = animation.animators[animatorName];

          if (animator && Utilities.isUsableAsObjectKey(animatorName)) {
            if (animator.type === "bone" && animator.name && animator.keyframes) {
              for (const keyframe of animator.keyframes) {
                if (keyframe.data_points && keyframe.data_points.length > 0) {
                  const keyframeData: (string | number)[] = [];

                  if (keyframe.data_points[0].x) {
                    keyframeData.push(keyframe.data_points[0].x);
                  }
                  if (keyframe.data_points[0].y) {
                    keyframeData.push(keyframe.data_points[0].y);
                  }
                  if (keyframe.data_points[0].z) {
                    keyframeData.push(keyframe.data_points[0].z);
                  }

                  if (keyframe.channel === "rotation") {
                    if (!rotationKeyframes[animator.name]) {
                      rotationKeyframes[animator.name] = {};
                    }
                    rotationKeyframes[animator.name][keyframe.time.toString()] = keyframeData;
                  } else if (keyframe.channel === "position") {
                    if (!positionKeyframes[animator.name]) {
                      positionKeyframes[animator.name] = {};
                    }
                    positionKeyframes[animator.name][keyframe.time.toString()] = keyframeData;
                  } else if (keyframe.channel === "scale") {
                    if (!scaleKeyframes[animator.name]) {
                      scaleKeyframes[animator.name] = {};
                    }
                    scaleKeyframes[animator.name][keyframe.time.toString()] = keyframeData;
                  }
                }
              }
            }
          }
        }

        for (const boneName in rotationKeyframes) {
          if (Utilities.isUsableAsObjectKey(boneName)) {
            const boneKeyframes = rotationKeyframes[boneName];

            if (boneKeyframes) {
              if (!targetMcAnimation.bones[boneName]) {
                targetMcAnimation.bones[boneName] = {};
              }

              const boneKeys = Object.keys(boneKeyframes);

              if (boneKeys.length === 1 && boneKeys[0] === "0") {
                targetMcAnimation.bones[boneName].rotation = boneKeyframes["0"];
              } else {
                targetMcAnimation.bones[boneName].rotation = boneKeyframes;
              }
            }
          }
        }

        for (const boneName in positionKeyframes) {
          if (Utilities.isUsableAsObjectKey(boneName)) {
            const boneKeyframes = positionKeyframes[boneName];

            if (boneKeyframes) {
              if (!targetMcAnimation.bones[boneName]) {
                targetMcAnimation.bones[boneName] = {
                  rotation: {},
                  position: {},
                  scale: {},
                };
              }

              const boneKeys = Object.keys(boneKeyframes);

              if (boneKeys.length === 1 && boneKeys[0] === "0") {
                targetMcAnimation.bones[boneName].position = boneKeyframes["0"];
              } else {
                targetMcAnimation.bones[boneName].position = boneKeyframes;
              }
            }
          }
        }

        for (const boneName in scaleKeyframes) {
          if (Utilities.isUsableAsObjectKey(boneName)) {
            const boneKeyframes = scaleKeyframes[boneName];

            if (boneKeyframes) {
              if (!targetMcAnimation.bones[boneName]) {
                targetMcAnimation.bones[boneName] = {
                  rotation: {},
                  position: {},
                  scale: {},
                };
              }

              const boneKeys = Object.keys(boneKeyframes);

              if (boneKeys.length === 1 && boneKeys[0] === "0") {
                targetMcAnimation.bones[boneName].scale = boneKeyframes["0"];
              } else {
                targetMcAnimation.bones[boneName].scale = boneKeyframes;
              }
            }
          }
        }
      }
    }
  }

  async updateGeometryFromModel(geo: IGeometry, formatVersion: number[]) {
    if (this.data?.resolution) {
      geo.textureheight = this.data.resolution.height;
      geo.texturewidth = this.data.resolution.width;
    }

    if (this.data?.visible_box && this.data.visible_box.length === 3) {
      geo.visible_bounds_width = this.data.visible_box[0];
      geo.visible_bounds_height = this.data.visible_box[1];
      geo.visible_bounds_offset = [0, this.data.visible_box[2], 0];
    }
    const bonesByName: { [name: string]: IGeometryBone } = {};
    const groupsByUuid: { [name: string]: IBlockbenchGroupItem } = {};
    const cubesById: { [uuid: string]: IGeometryBoneCube } = {};
    const locatorsById: { [uuid: string]: IBlockbenchElement } = {};

    if (this.data?.elements) {
      geo.bones = [];

      for (const elt of this.data.elements) {
        if (elt.type === "cube") {
          if (elt.from && elt.from.length === 3 && elt.to && elt.to.length === 3) {
            let uvTarg: number[] | IGeometryUVFaces | undefined = undefined;

            if (elt.box_uv) {
              if (!elt.uv_offset) {
                if (
                  elt.faces &&
                  elt.faces.east &&
                  elt.faces.east.uv &&
                  elt.faces.east.uv.length >= 1 &&
                  elt.faces.down &&
                  elt.faces.down.uv &&
                  elt.faces.down.uv.length >= 1
                ) {
                  uvTarg = [elt.faces.east.uv[0], elt.faces.down.uv[1]];
                }
              } else {
                uvTarg = elt.uv_offset;
              }
            } else if (elt.faces) {
              uvTarg = {
                north: this.getMinecraftUVFace(elt.faces.north),
                east: this.getMinecraftUVFace(elt.faces.east),
                south: this.getMinecraftUVFace(elt.faces.south),
                west: this.getMinecraftUVFace(elt.faces.west),
                up: this.getMinecraftUVFace(elt.faces.up),
                down: this.getMinecraftUVFace(elt.faces.down),
              };
            }

            let cube: IGeometryBoneCube = {
              origin: elt.from,
              size: [
                Math.abs(elt.to[0] - elt.from[0]),
                Math.abs(elt.to[1] - elt.from[1]),
                Math.abs(elt.to[2] - elt.from[2]),
              ],
              uv: uvTarg as number[] | IGeometryUVFaces,
            };

            (cube as any).name = elt.name;

            if (elt.rotation && elt.rotation.length === 3) {
              cube.rotation = [-elt.rotation[0], -elt.rotation[1], -elt.rotation[2]];
            }

            if (elt.origin) {
              cube.pivot = elt.origin;
            }

            if (Utilities.isUsableAsObjectKey(elt.uuid)) {
              cubesById[elt.uuid] = cube;
            }
          }
        } else if (elt.type === "locator") {
          if (Utilities.isUsableAsObjectKey(elt.uuid)) {
            locatorsById[elt.uuid] = elt;
          }
        }
      }
    }

    if (this.data?.groups) {
      for (const groupItem of this.data.groups) {
        if (
          groupItem &&
          typeof groupItem !== "string" &&
          groupItem.name &&
          Utilities.isUsableAsObjectKey(groupItem.uuid)
        ) {
          groupsByUuid[groupItem.uuid] = groupItem;
        }
      }
    }

    if (this.data?.outliner) {
      this.processOutlineItemsIntoBonesByName(
        this.data.outliner,
        groupsByUuid,
        bonesByName,
        cubesById,
        locatorsById,
        formatVersion
      );
    }

    for (const boneName in bonesByName) {
      if (Utilities.isUsableAsObjectKey(boneName)) {
        const bone = bonesByName[boneName];

        geo.bones.push(bone);
      }
    }
  }

  static isLessThan110(formatVersion: number[]) {
    if (formatVersion[0] > 1) {
      return false;
    }

    if (formatVersion.length >= 2) {
      return formatVersion[1] < 10;
    }

    // if the format version doesn't match any known format, presume it's a pre-format versoin file?
    return true;
  }

  processOutlineItemsIntoBonesByName(
    outlineItems: (string | IBlockbenchOutlineItem)[],
    groupsByUuid: { [name: string]: IBlockbenchOutlineOrGroupItem },
    bonesByName: { [name: string]: IGeometryBone },
    cubesById: { [name: string]: IGeometryBoneCube },
    locatorsById: { [name: string]: IBlockbenchElement },
    formatVersion: number[],
    parent?: IGeometryBone,
    context?: {
      // wrap this in an object so we can pass by ref
      addIndex: number;
    }
  ) {
    if (!context) {
      context = {
        addIndex: 1,
      };
    }

    for (const outlineItem of outlineItems) {
      if (outlineItem && typeof outlineItem === "string" && parent) {
        const elt = cubesById[outlineItem];

        if (elt) {
          if (!parent.cubes) {
            parent.cubes = [];
          }

          if (
            elt.pivot &&
            parent.pivot &&
            elt.pivot[0] === parent.pivot[0] &&
            elt.pivot[1] === parent.pivot[1] &&
            elt.pivot[2] === parent.pivot[2]
          ) {
            elt.pivot = undefined;
          }

          parent.cubes.push(elt);
        } else {
          const lead = locatorsById[outlineItem];

          if (lead && lead.name && lead.position && Utilities.isUsableAsObjectKey(lead.name)) {
            if (!parent.locators) {
              parent.locators = {};
            }

            parent.locators[lead.name] = lead.position;
          }
        }
      } else if (outlineItem && typeof outlineItem !== "string") {
        let groupData: IBlockbenchOutlineOrGroupItem = groupsByUuid[outlineItem.uuid];

        if (!groupData) {
          groupData = outlineItem;
        }

        let name = groupData.name ? groupData.name : String("bone" + context!.addIndex.toString());

        let bone = bonesByName[name];

        if (!bone) {
          bone = {
            name: name,
            pivot: [],
            binding:
              !BlockbenchModel.isLessThan110(formatVersion) && groupData.bedrock_binding
                ? groupData.bedrock_binding
                : undefined,
            cubes: undefined,
            locators: undefined,
          };

          bonesByName[name] = bone;
        }

        let rot = groupData.rotation;

        if (rot) {
          if (rot.length === 3) {
            rot[0] = -rot[0];
            rot[1] = -rot[1];
            rot[2] = -rot[2];

            bone.rotation = rot;
          }
        }

        if (groupData.origin) {
          bone.pivot = groupData.origin;
        }

        if (parent) {
          bone.parent = parent.name;
        }

        if (outlineItem.children) {
          this.processOutlineItemsIntoBonesByName(
            outlineItem.children,
            groupsByUuid,
            bonesByName,
            cubesById,
            locatorsById,
            formatVersion,
            bone,
            context
          );
        }

        if (bone.cubes) {
          // geo fv of 1.8 uses bind_pose_rotation at the bone level rather than per-cube rotation
          // also it manages pivot at the bone level
          // so "pull up" rotation -> bind_pose_rotation or create new bones
          if (BlockbenchModel.isLessThan110(formatVersion) && bone.cubes) {
            const newCubesPivot: IGeometryBoneCube[] = [];

            // promote cubes to their own bones if they have a separate pivot than the governing bone
            for (const cube of bone.cubes) {
              let addCube = true;

              if (cube.pivot && bone.pivot && cube.pivot.length === 3 && bone.pivot.length === 3) {
                if (
                  cube.pivot[0] === bone.pivot[0] &&
                  cube.pivot[1] === bone.pivot[1] &&
                  cube.pivot[2] === bone.pivot[2]
                ) {
                  cube.pivot = undefined;
                } else {
                  addCube = false;

                  context.addIndex++;

                  const newBone: IGeometryBone = {
                    pivot: cube.pivot,
                    bind_pose_rotation: cube.rotation,
                    cubes: [cube],
                    name: (cube as any).name
                      ? (cube as any).name + context.addIndex.toString()
                      : bone.name + context.addIndex.toString(),
                    parent: bone.name,
                  };

                  (cube as any).name = undefined;
                  cube.pivot = undefined;
                  cube.rotation = undefined;

                  if (Utilities.isUsableAsObjectKey(newBone.name)) {
                    bonesByName[newBone.name] = newBone;
                  }
                }
              }

              if (addCube) {
                newCubesPivot.push(cube);
              }
            }

            const newCubesRotation: IGeometryBoneCube[] = [];
            for (const cube of newCubesPivot) {
              let addCube = true;

              if (cube.rotation) {
                if (bone.bind_pose_rotation) {
                  if (
                    cube.rotation.length !== 3 ||
                    bone.bind_pose_rotation.length !== 3 ||
                    cube.rotation[0] !== bone.bind_pose_rotation[0] ||
                    cube.rotation[1] !== bone.bind_pose_rotation[1] ||
                    cube.rotation[2] !== bone.bind_pose_rotation[2]
                  ) {
                    addCube = false;
                    context.addIndex++;

                    const newBone: IGeometryBone = {
                      pivot: bone.pivot,
                      bind_pose_rotation: cube.rotation,
                      cubes: [cube],
                      name: (cube as any).name
                        ? (cube as any).name + context.addIndex.toString()
                        : bone.name + context.addIndex.toString(),
                      parent: bone.name,
                    };

                    cube.rotation = undefined;
                    (cube as any).name = undefined;

                    bonesByName[newBone.name] = newBone;
                  }
                } else {
                  bone.bind_pose_rotation = cube.rotation;
                  cube.rotation = undefined;
                }
              } else {
                if (
                  // if the parent has a nontrivial bind pose rotation and this cube has no rotation, put it under its own bone
                  bone.bind_pose_rotation &&
                  bone.bind_pose_rotation.length === 3 &&
                  (bone.bind_pose_rotation[0] !== 0 ||
                    bone.bind_pose_rotation[1] !== 0 ||
                    bone.bind_pose_rotation[2] !== 0)
                ) {
                  addCube = false;
                  context.addIndex++;

                  const newBone: IGeometryBone = {
                    pivot: bone.pivot,
                    cubes: [cube],
                    name: (cube as any).name
                      ? (cube as any).name + context.addIndex.toString()
                      : bone.name + context.addIndex.toString(),
                    parent: bone.name,
                  };

                  (cube as any).name = undefined;

                  bonesByName[newBone.name] = newBone;
                }
              }

              if (addCube) {
                newCubesRotation.push(cube);
              }
            }

            bone.cubes = newCubesRotation;
          }

          for (const cube of bone.cubes) {
            (cube as any).name = undefined;
          }
        }
      }
    }
  }

  async integrateIntoProject(project: Project) {
    const modelId = this.id;

    if (modelId) {
      let geoToUpdate: IGeometry | undefined = undefined;
      let animationToUpdate: AnimationResourceDefinition | undefined = undefined;
      let animationFile: IFile | undefined = undefined;
      let modelGeometryDefinitionToUpdate: ModelGeometryDefinition | undefined = undefined;
      let entityTypeResourceDefinitionToUpdate: EntityTypeResourceDefinition | undefined = undefined;
      let entityTypeResourceProjectItem: ProjectItem | undefined = undefined;

      // first pass: find the model name and the ETRD
      for (const item of project.items) {
        if (item.itemType === ProjectItemType.modelGeometryJson && geoToUpdate === undefined) {
          if (!item.isContentLoaded) {
            await item.loadContent();
          }

          if (item.primaryFile) {
            const modelDefOuter = await ModelGeometryDefinition.ensureOnFile(item.primaryFile);

            if (modelDefOuter && modelDefOuter.definitions) {
              geoToUpdate = modelDefOuter.getById(modelId);
              modelGeometryDefinitionToUpdate = modelDefOuter;
            }
          }
        } else if (item.itemType === ProjectItemType.entityTypeResource) {
          // ensure references to textures if an entiy exists
          if (!item.isContentLoaded) {
            await item.loadContent();
          }

          if (item.primaryFile) {
            const etrd = await EntityTypeResourceDefinition.ensureOnFile(item.primaryFile);

            if (etrd && etrd.geometryList) {
              for (const geometry of etrd.geometryList) {
                if (geometry === modelId) {
                  entityTypeResourceProjectItem = item;
                  entityTypeResourceDefinitionToUpdate = etrd;
                  if (this.data && this.data.textures && etrd.textures) {
                    for (const texture of this.data.textures) {
                      let path = texture.path ? texture.path : texture.name;

                      path = StorageUtilities.canonicalizePath(path);
                      let hasPath = false;
                      let hasDefault = false;

                      const texturesIndex = path.indexOf("textures/");

                      if (texturesIndex >= 0) {
                        path = path.substring(texturesIndex);

                        path = StorageUtilities.stripExtension(path);

                        for (const textureKey in etrd.textures) {
                          const targetPath = etrd.textures[textureKey];

                          if (textureKey === "default") {
                            hasDefault = true;
                          }
                          if (targetPath && StorageUtilities.isPathEqual(targetPath, path)) {
                            hasPath = true;
                          }
                        }

                        if (!hasPath) {
                          if (!hasDefault) {
                            etrd.textures["default"] = path;
                          } else {
                            etrd.textures[texture.name] = path;
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }

      // second pass: find the animation if we have an ETRD
      if (
        entityTypeResourceDefinitionToUpdate &&
        entityTypeResourceProjectItem &&
        entityTypeResourceProjectItem.childItems
      ) {
        for (const item of entityTypeResourceProjectItem.childItems) {
          if (item.childItem.itemType === ProjectItemType.animationResourceJson && animationToUpdate === undefined) {
            if (!item.childItem.isContentLoaded) {
              await item.childItem.loadFileContent();
            }

            if (item.childItem.primaryFile) {
              const animationOuter = await AnimationResourceDefinition.ensureOnFile(item.childItem.primaryFile);

              if (animationOuter && animationOuter.data) {
                animationToUpdate = animationOuter;
                animationFile = item.childItem.primaryFile;
              }
            }
          }
        }
      }

      // a model file doesn't exist, so let's create one.
      if (!geoToUpdate && project.projectFolder) {
        let modelName = this.data?.name;

        if (modelName === undefined) {
          modelName = modelId;

          const colonNamespaceSep = modelName.lastIndexOf(":");

          if (colonNamespaceSep >= 0) {
            modelName = modelName.substring(colonNamespaceSep + 1);
          }
        }

        const defaultRp = await project.getDefaultResourcePackFolder();

        if (defaultRp) {
          const modelsFolder = defaultRp.ensureFolder("models");
          await modelsFolder.ensureExists();

          const newFileName = await StorageUtilities.getUniqueFileName(modelName, "json", modelsFolder);

          const newFile = modelsFolder.ensureFile(newFileName);

          const modelGen = await ModelGeometryDefinition.ensureOnFile(newFile);

          if (modelGen) {
            modelGen.ensureDefault(modelId);

            if (modelGen.definitions.length >= 0) {
              geoToUpdate = modelGen.definitions[0];

              modelGeometryDefinitionToUpdate = modelGen;
            }
          }
        }
      }

      // an animation file doesn't exist, so let's create one if we need to.
      if (!animationToUpdate && project.projectFolder && this.data?.animations) {
        let animationSetName = MinecraftUtilities.removeSubTypeExtensionFromName(this.data?.name);

        if (animationSetName === undefined) {
          animationSetName = modelId;

          const colonNamespaceSep = animationSetName.lastIndexOf(":");

          if (colonNamespaceSep >= 0) {
            animationSetName = animationSetName.substring(colonNamespaceSep + 1);
          }
        }

        const defaultRp = await project.getDefaultResourcePackFolder();

        if (defaultRp) {
          const animationsFolder = defaultRp.ensureFolder("animations");
          await animationsFolder.ensureExists();

          const newFileName = await StorageUtilities.getUniqueFileName(
            animationSetName,
            "animation.json",
            animationsFolder
          );

          animationFile = animationsFolder.ensureFile(newFileName);

          animationToUpdate = await AnimationResourceDefinition.ensureOnFile(animationFile);

          if (animationToUpdate) {
            animationToUpdate.ensureDefault();
          }
        }
      }

      if (animationToUpdate && this.data?.animations && animationFile) {
        await this.updateMinecraftAnimationsFromBlockbench(animationToUpdate, entityTypeResourceDefinitionToUpdate);

        animationToUpdate.persist();

        project.ensureItemFromFile(animationFile, ProjectItemType.animationResourceJson, FolderContext.resourcePack);
      }

      if (geoToUpdate && modelGeometryDefinitionToUpdate) {
        const fv = modelGeometryDefinitionToUpdate?.getFormatVersion();

        await this.updateGeometryFromModel(geoToUpdate, fv);

        modelGeometryDefinitionToUpdate?.persist();
      }
    }

    if (this.data && this.data.textures) {
      for (const texture of this.data.textures) {
        let setItem = false;

        if (texture.name) {
          let path = texture.path ? texture.path : texture.name;
          const bytes = Utilities.base64ToUint8Array(texture.source);

          if (bytes && project.projectFolder) {
            path = StorageUtilities.canonicalizePath(path);
            const texturesIndex = path.indexOf("textures/");
            if (texturesIndex >= 0) {
              path = path.substring(texturesIndex);
            }

            // first, try to match an item by its path leaf
            for (const item of project.items) {
              if (item.itemType === ProjectItemType.texture && !setItem) {
                if (!item.isContentLoaded) {
                  await item.loadContent();
                }
                if (item.primaryFile) {
                  const projectPath = item.primaryFile.getFolderRelativePath(project.projectFolder);

                  if (projectPath && projectPath.endsWith(path)) {
                    item.primaryFile.setContent(bytes);

                    setItem = true;
                  }
                }
              }
            }

            // we didn't match by path, but try to match by file name?
            if (!setItem) {
              for (const item of project.items) {
                if (item.itemType === ProjectItemType.texture && !setItem) {
                  if (item.primaryFile && item.primaryFile.name === texture.name) {
                    item.primaryFile.setContent(bytes);

                    setItem = true;
                  }
                }
              }
            }

            // we didn't find a match, so create a new texture
            if (!setItem) {
              const defaultRp = await project.getDefaultResourcePackFolder();

              if (defaultRp && project.projectFolder) {
                // the path is not standard Minecraft, let's just create a new texture path in RP
                if (!path.startsWith("textures/")) {
                  path = "textures/" + texture.name;
                }

                const file = defaultRp.ensureFile(path);

                file.setContent(bytes);

                const projectPath = file.getFolderRelativePath(project.projectFolder);

                if (projectPath) {
                  project.ensureItemByProjectPath(
                    projectPath,
                    ProjectItemStorageType.singleFile,
                    file.name,
                    ProjectItemType.texture,
                    FolderContext.resourcePack,
                    undefined,
                    ProjectItemCreationType.normal,
                    file
                  );
                }
              }
            }
          }
        }
      }
    }
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

  async persist(): Promise<boolean> {
    if (this._file === undefined) {
      return false;
    }

    Log.assert(this._data !== null, "ITDP");

    if (this._data) {
      return this._file.setObjectContentIfSemanticallyDifferent(this._data);
    }

    return false;
  }

  async save() {
    if (this._file === undefined) {
      return;
    }

    if (await this.persist()) {
      await this._file.saveContent(false);
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

    this._data = StorageUtilities.getJsonObject(this._file);

    this._isLoaded = true;
  }

  static createEmptyModel(name: string, identifier: string): IBlockbenchModel {
    return {
      meta: {
        format_version: "5.0",
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
      groups: [],
      outliner: [],
    };
  }

  /**
   * Exports Minecraft animations to Blockbench format
   * @param animationDef The Minecraft animation resource definition to export from
   * @param bbmodel The Blockbench model to export animations to
   */
  static async exportAnimationsToBlockbench(animationDef: AnimationResourceDefinition, bbmodel: IBlockbenchModel) {
    if (!animationDef.animations || !bbmodel.animations) {
      return;
    }

    for (const animationName in animationDef.animations) {
      const mcAnimation = animationDef.animations[animationName];

      if (mcAnimation && mcAnimation.bones) {
        const bbAnimation: IBlockbenchAnimation = {
          uuid: Utilities.createUuid(),
          name: animationName,
          loop: mcAnimation.loop ? "loop" : "once",
          override: false,
          length: mcAnimation.animation_length || 1.0,
          snapping: 20,
          selected: false,
          saved: true,
          path: "",
          anim_time_update: "",
          blend_weight: "",
          loop_delay: "",
          animators: {},
        };

        // Convert Minecraft animation bones to Blockbench animators
        for (const boneName in mcAnimation.bones) {
          const mcBone = mcAnimation.bones[boneName];

          if (mcBone) {
            const animator: IBlockbenchAnimationAnimator = {
              name: boneName,
              type: "bone",
              keyframes: [],
            };

            // Process rotation keyframes
            if (mcBone.rotation) {
              this.convertKeyframesToBlockbench(mcBone.rotation, "rotation", animator);
            }

            // Process position keyframes
            if (mcBone.position) {
              this.convertKeyframesToBlockbench(mcBone.position, "position", animator);
            }

            // Process scale keyframes
            if (mcBone.scale) {
              this.convertKeyframesToBlockbench(mcBone.scale, "scale", animator);
            }

            if (animator.keyframes.length > 0) {
              bbAnimation.animators[boneName] = animator;
            }
          }
        }

        bbmodel.animations.push(bbAnimation);
      }
    }
  }

  /**
   * Converts Minecraft keyframe data to Blockbench keyframe format
   * @param keyframeData The Minecraft keyframe data (can be static values or time-based keyframes)
   * @param channel The animation channel (rotation, position, scale)
   * @param animator The Blockbench animator to add keyframes to
   */
  static convertKeyframesToBlockbench(
    keyframeData: any, // Using any to handle the complex union types from Minecraft
    channel: string,
    animator: IBlockbenchAnimationAnimator
  ) {
    if (Array.isArray(keyframeData)) {
      // Single static value - create a keyframe at time 0
      const keyframe: IBlockbenchAnimationKeyframe = {
        channel: channel,
        data_points: [
          {
            x: keyframeData[0]?.toString() || "0",
            y: keyframeData[1]?.toString() || "0",
            z: keyframeData[2]?.toString() || "0",
          },
        ],
        uuid: Utilities.createUuid(),
        time: 0,
        color: 0,
        interpolation: "linear",
      };
      animator.keyframes.push(keyframe);
    } else if (keyframeData && typeof keyframeData === "object") {
      // Multiple keyframes with time codes
      for (const timeCode in keyframeData) {
        const values = keyframeData[timeCode];

        if (Array.isArray(values)) {
          const keyframe: IBlockbenchAnimationKeyframe = {
            channel: channel,
            data_points: [
              {
                x: values[0]?.toString() || "0",
                y: values[1]?.toString() || "0",
                z: values[2]?.toString() || "0",
              },
            ],
            uuid: Utilities.createUuid(),
            time: parseFloat(timeCode),
            color: 0,
            interpolation: "linear",
          };
          animator.keyframes.push(keyframe);
        }
      }
    }
  }

  static async exportModel(modelProjectItem: ProjectItem, modelIndex?: number): Promise<IBlockbenchModel | undefined> {
    if (modelIndex === undefined) {
      modelIndex = 0;
    }
    if (!modelProjectItem.isContentLoaded) {
      await modelProjectItem.loadContent();
    }

    let clientItemProjectItem: ProjectItem | undefined = undefined;
    let clientItem: AttachableResourceDefinition | undefined = undefined;
    let serverBlockProjectItem: ProjectItem | undefined = undefined;
    let serverBlock: BlockTypeDefinition | undefined = undefined;
    let clientEntityProjectItem: ProjectItem | undefined = undefined;
    let clientEntity: EntityTypeResourceDefinition | undefined = undefined;
    let model: ModelGeometryDefinition | undefined = undefined;

    if (modelProjectItem.primaryFile) {
      model = await ModelGeometryDefinition.ensureOnFile(modelProjectItem.primaryFile);
    }

    if (modelProjectItem.parentItems) {
      for (const parentItemOuter of modelProjectItem.parentItems) {
        if (parentItemOuter.parentItem.itemType === ProjectItemType.entityTypeResource) {
          clientEntityProjectItem = parentItemOuter.parentItem;
          if (clientEntityProjectItem && clientEntityProjectItem.primaryFile) {
            clientEntity = await EntityTypeResourceDefinition.ensureOnFile(clientEntityProjectItem.primaryFile);
          }
        } else if (parentItemOuter.parentItem.itemType === ProjectItemType.blockTypeBehavior) {
          serverBlockProjectItem = parentItemOuter.parentItem;
          if (serverBlockProjectItem && serverBlockProjectItem.primaryFile) {
            serverBlock = await BlockTypeDefinition.ensureOnFile(serverBlockProjectItem.primaryFile);
          }
        } else if (parentItemOuter.parentItem.itemType === ProjectItemType.attachableResourceJson) {
          clientItemProjectItem = parentItemOuter.parentItem;
          if (clientItemProjectItem && clientItemProjectItem.primaryFile) {
            clientItem = await AttachableResourceDefinition.ensureOnFile(clientItemProjectItem.primaryFile);
          }
        }
      }
    }

    if (!model || model.identifiers.length === 0 || !model.file || !model.data || model.definitions.length === 0) {
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
    const outlinerEltsByName: { [name: string]: IBlockbenchOutlineItem } = {};
    const groupEltsByName: { [name: string]: IBlockbenchGroupItem } = {};

    let colorIndex = 0;
    let rootBone: IGeometryBone | undefined = undefined;
    let hasMultipleRoots = false;

    for (const bone of def.bones) {
      let rot = bone.rotation;

      if (rot) {
        if (rot.length === 3) {
          rot[0] = -rot[0];
          rot[1] = -rot[1];
          rot[2] = -rot[2];
        }
      }

      let groupAndOutlineUuid = Utilities.createUuid();

      const outLinerElt: IBlockbenchOutlineItem = {
        uuid: groupAndOutlineUuid,
        isOpen: false,
        children: [],
      };

      const groupElt: IBlockbenchGroupItem = {
        name: bone.name,
        origin: bone.pivot,
        rotation: rot,
        bedrock_binding: bone.binding,
        color: colorIndex,
        uuid: groupAndOutlineUuid,
        export: true,
        mirror_uv: false,
        isOpen: false,
        locked: false,
        reset: false,
        selected: false,
        primary_selected: false,
        shade: false,
        visibility: true,
        autouv: 0,
        children: [],
      };

      if (Utilities.isUsableAsObjectKey(bone.name)) {
        outlinerEltsByName[bone.name] = outLinerElt;
        groupEltsByName[bone.name] = groupElt;
        bbmodel.groups?.push(groupElt);
      }

      colorIndex++;
      if (colorIndex > 7) {
        colorIndex = 0;
      }

      if (bone.parent === undefined) {
        bbmodel.outliner?.push(outLinerElt);

        if (rootBone === undefined && !hasMultipleRoots) {
          rootBone = bone;
        } else if (rootBone) {
          rootBone = undefined;
          hasMultipleRoots = true;
        }
      }
    }

    for (const bone of def.bones) {
      const thisOutlinerElt = outlinerEltsByName[bone.name];

      if (bone.cubes && bone.cubes.length >= 0) {
        for (const cube of bone.cubes) {
          const id = Utilities.createUuid();

          if (cube.origin && cube.origin.length === 3 && cube.size && cube.size.length === 3) {
            const cubeFrom = cube.origin;

            const cubeTo = new Array(3);

            cubeTo[0] = cube.origin[0] + cube.size[0];
            cubeTo[1] = cube.origin[1] + cube.size[1];
            cubeTo[2] = cube.origin[2] + cube.size[2];

            let rot = cube.rotation;

            if (rot) {
              if (rot.length === 3) {
                rot[0] = -rot[0];
                rot[1] = -rot[1];
                rot[2] = -rot[2];
              }
            } else if (bone.bind_pose_rotation) {
              if (bone.bind_pose_rotation.length === 3) {
                rot = [];

                rot[0] = -bone.bind_pose_rotation[0];
                rot[1] = -bone.bind_pose_rotation[1];
                rot[2] = -bone.bind_pose_rotation[2];
              } else {
                rot = bone.bind_pose_rotation;
              }
            } else {
              rot = [0, 0, 0];
            }

            let pivot = cube.pivot;

            if (!pivot && bone.pivot) {
              pivot = bone.pivot;
            } else if (!pivot) {
              pivot = [0, 0, 0];
            }

            let uvOffset = undefined;

            if (Array.isArray(cube.uv)) {
              uvOffset = cube.uv;
            }

            bbmodel.elements?.push({
              name: bone.name,
              box_uv: Array.isArray(cube.uv),
              rescale: false,
              locked: false,
              light_emission: 0,
              render_order: "default",
              allow_mirror_modeling: true,
              from: cubeFrom,
              to: cubeTo,
              inflate: cube.inflate,
              autouv: 0,
              color: 0,
              rotation: rot,
              origin: pivot,
              uv_offset: uvOffset,
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

            thisOutlinerElt.children.push(id);
          }
        }
      }

      if (bone.locators) {
        for (const locatorName in bone.locators) {
          const locator = bone.locators[locatorName];

          if (Array.isArray(locator) && locator.length === 3) {
            const id = Utilities.createUuid();

            bbmodel.elements?.push({
              name: locatorName,
              locked: false,
              position: locator,
              rotation: [0, 0, 0],
              type: "locator",
              uuid: id,
            });

            thisOutlinerElt.children.push(id);
          }
        }
      }

      if (bone.parent !== undefined) {
        const parentOutlinerElt = outlinerEltsByName[bone.parent];

        if (parentOutlinerElt) {
          parentOutlinerElt.children.push(thisOutlinerElt);
        }
      }
    }

    // Export animations from related animation resource files
    bbmodel.animations = [];

    // Find related animation files from the entity or other parent project items
    if (modelProjectItem.parentItems) {
      for (const parentItemOuter of modelProjectItem.parentItems) {
        if (parentItemOuter.parentItem.childItems) {
          for (const childItemOuter of parentItemOuter.parentItem.childItems) {
            if (childItemOuter.childItem.itemType === ProjectItemType.animationResourceJson) {
              if (!childItemOuter.childItem.isContentLoaded) {
                await childItemOuter.childItem.loadContent();
              }

              if (childItemOuter.childItem.primaryFile) {
                const animationDef = await AnimationResourceDefinition.ensureOnFile(
                  childItemOuter.childItem.primaryFile
                );

                if (animationDef && animationDef.animations) {
                  await this.exportAnimationsToBlockbench(animationDef, bbmodel);
                }
              }
            }
          }
        }
      }
    }

    // Also search for animation files by name matching if no direct child relationships exist
    if (bbmodel.animations.length === 0 && modelProjectItem.project) {
      const project = modelProjectItem.project;
      const modelBaseName = StorageUtilities.getBaseFromName(model.file.name);

      for (const projectItem of project.items) {
        if (projectItem.itemType === ProjectItemType.animationResourceJson) {
          const animationBaseName = StorageUtilities.getBaseFromName(projectItem.name);

          // Check if animation file name is related to model file name
          if (animationBaseName.includes(modelBaseName) || modelBaseName.includes(animationBaseName)) {
            await projectItem.loadFileContent();

            if (projectItem.primaryFile) {
              const animationDef = await AnimationResourceDefinition.ensureOnFile(projectItem.primaryFile);

              if (animationDef && animationDef.animations) {
                await this.exportAnimationsToBlockbench(animationDef, bbmodel);
              }
            }
          }
        }
      }
    }

    let textureList: IBlockbenchTexture[] = [];
    bbmodel.textures = [];

    let textures: { [name: string]: ProjectItem } | undefined = undefined;
    let sourceFile: IFile | undefined = undefined;

    if (clientEntity && clientEntityProjectItem && clientEntityProjectItem.primaryFile) {
      textures = clientEntity.getTextureItems(clientEntityProjectItem);
      sourceFile = clientEntityProjectItem.primaryFile;
    } else if (serverBlock && serverBlockProjectItem && serverBlockProjectItem.primaryFile) {
      textures = await serverBlock.getTextureItems(serverBlockProjectItem);
      sourceFile = serverBlockProjectItem.primaryFile;
    } else if (clientItem && clientItemProjectItem && clientItemProjectItem.primaryFile) {
      textures = clientItem.getTextureItems(clientItemProjectItem);
      sourceFile = clientItemProjectItem.primaryFile;
    }

    if (textures && sourceFile) {
      for (const textureName in textures) {
        const textureItem = textures[textureName];

        if (textureName && textureItem && textureItem.primaryFile) {
          if (!textureItem.primaryFile.isContentLoaded) {
            await textureItem.primaryFile.loadContent();
          }
          const exifr = new Exifr({});

          if (textureItem.primaryFile.content) {
            try {
              await exifr.read(textureItem.primaryFile.content);

              const results = await exifr.parse();

              const relativePath = sourceFile.getRelativePathFor(textureItem.primaryFile);
              const contentStr = StorageUtilities.getContentAsString(textureItem.primaryFile);

              if (relativePath && contentStr) {
                textureList.push({
                  path: textureItem.primaryFile.storageRelativePath,
                  name: textureItem.primaryFile.name,
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
    let uv = cube.uv;

    if (Array.isArray(cube.uv)) {
      uv = cube.uv;
    } else if (cube.uv.up) {
      uv = cube.uv.up.uv;
      return [uv[0], uv[1], uv[0] + cube.size[0], uv[1] + cube.size[2]];
    } else {
      Log.unexpectedContentState("BBMGUB");
      uv = [0, 0];
    }

    return [uv[0] + cube.size[2] + cube.size[0], uv[1] + cube.size[2], uv[0] + cube.size[2], uv[1]];
  }

  static getDownBoxUvCoordinates(cube: IGeometryBoneCube) {
    let uv = cube.uv;

    if (Array.isArray(cube.uv)) {
      uv = cube.uv;
    } else if (cube.uv.down) {
      uv = cube.uv.down.uv;
      return [uv[0], uv[1], uv[0] + cube.size[0], uv[1] - cube.size[2]];
    } else {
      Log.unexpectedContentState("BBMGDB");
      uv = [0, 0];
    }

    return [uv[0] + cube.size[2] + cube.size[0] * 2, uv[1], uv[0] + cube.size[0] + cube.size[2], uv[1] + cube.size[2]];
  }

  static getEastBoxUvCoordinates(cube: IGeometryBoneCube) {
    let uv = cube.uv;

    if (Array.isArray(cube.uv)) {
      uv = cube.uv;
    } else if (cube.uv && cube.uv.east) {
      uv = cube.uv.east.uv;

      return [uv[0], uv[1], uv[0] + cube.size[2], uv[1] + cube.size[1]];
    } else {
      Log.unexpectedContentState("BBMGEB");
      uv = [0, 0];
    }

    return [uv[0], uv[1] + cube.size[2], uv[0] + cube.size[2], uv[1] + cube.size[2] + cube.size[1]];
  }

  static getNorthBoxUvCoordinates(cube: IGeometryBoneCube) {
    let uv = cube.uv;

    if (Array.isArray(cube.uv)) {
      uv = cube.uv;
    } else if (cube.uv && cube.uv.north) {
      uv = cube.uv.north.uv;

      return [uv[0], uv[1], uv[0] + cube.size[0], uv[1] + cube.size[1]];
    } else {
      Log.unexpectedContentState("BBMGNB");
      uv = [0, 0];
    }

    return [
      uv[0] + cube.size[2],
      uv[1] + cube.size[2],
      uv[0] + cube.size[2] + cube.size[0],
      uv[1] + cube.size[2] + cube.size[1],
    ];
  }

  static getWestBoxUvCoordinates(cube: IGeometryBoneCube) {
    let uv = cube.uv;

    if (Array.isArray(cube.uv)) {
      uv = cube.uv;
    } else if (cube.uv && cube.uv.west) {
      uv = cube.uv.west.uv;
      return [uv[0], uv[1], uv[0] + cube.size[2], uv[1] + cube.size[1]];
    } else {
      Log.unexpectedContentState("BBMGWB");
      uv = [0, 0];
    }

    return [
      uv[0] + cube.size[2] + cube.size[0],
      uv[1] + cube.size[2],
      uv[0] + cube.size[2] * 2 + cube.size[0],
      uv[1] + cube.size[2] + cube.size[1],
    ];
  }

  static getSouthBoxUvCoordinates(cube: IGeometryBoneCube) {
    let uv = cube.uv;

    if (Array.isArray(cube.uv)) {
      uv = cube.uv;
    } else if (cube.uv && cube.uv.south) {
      uv = cube.uv.south.uv;
      return [uv[0], uv[1], uv[0] + cube.size[0], uv[1] + cube.size[1]];
    } else {
      Log.unexpectedContentState("BBMGWB");
      uv = [0, 0];
    }

    return [
      uv[0] + cube.size[2] * 2 + cube.size[0],
      uv[1] + cube.size[2],
      uv[0] + cube.size[2] * 2 + cube.size[0] * 2,
      uv[1] + cube.size[2] + cube.size[1],
    ];
  }
}
