// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import ProjectInfoItem from "./ProjectInfoItem";
import Project from "../app/Project";
import IProjectInfoGenerator from "./IProjectInfoGenerator";
import { InfoItemType } from "./IInfoItemData";
import IFolder from "../storage/IFolder";
import StorageUtilities from "../storage/StorageUtilities";
import IFile from "../storage/IFile";
import ZipStorage from "../storage/ZipStorage";
import ProjectInfoSet from "./ProjectInfoSet";
import ContentIndex, { AnnotationCategory } from "../core/ContentIndex";
import ProjectInfoUtilities from "./ProjectInfoUtilities";

const tagAllowList = ["render_method", "min_difficulty", "cause", "effect_name", "entity_type", "event_name"];
const numericAllowList: string[] = ["max_stack_size"];
const boolAllowList: string[] = ["fire_immune", "burns_in_daylight", "hand_equipped", "stacked_by_data"];

const inspectTagList: string[] = [
  "minecraft:behavior.follow_mob",
  "minecraft:behavior.float_wander",
  "minecraft:behavior.tempt",
];

export enum JsonFileTagsInfoGeneratorTest {
  entityType = 1,
  blockType = 2,
  itemType = 3,
  terrainTexture = 4,
  itemTexture = 5,
  soundDefinition = 6,
  musicDefinition = 7,
  sound = 8,
}

export default class JsonFileTagsInfoGenerator implements IProjectInfoGenerator {
  id = "JSONTAGS";
  title = "JSON Tags";

  getTopicData(topicId: number) {
    return {
      title: ProjectInfoUtilities.getTitleFromEnum(JsonFileTagsInfoGeneratorTest, topicId),
    };
  }

  async generate(project: Project, contentIndex: ContentIndex): Promise<ProjectInfoItem[]> {
    const items: ProjectInfoItem[] = [];

    if (project.projectFolder) {
      await this.generateFromFolder(project, project.projectFolder, items, contentIndex);
    }

    return items;
  }

  summarize(info: any, infoSet: ProjectInfoSet) {}

  async generateFromFolder(project: Project, folder: IFolder, items: ProjectInfoItem[], index: ContentIndex) {
    await folder.load();

    for (const fileName in folder.files) {
      const baseType = StorageUtilities.getTypeFromName(fileName);
      const file = folder.files[fileName];

      if (baseType === "json" && file) {
        await this.generateFromFile(project, file, items, index);
      } else if (StorageUtilities.isContainerFile(fileName) && file) {
        await file.loadContent();

        if (file.content && file.content instanceof Uint8Array) {
          if (!file.fileContainerStorage) {
            const zipStorage = new ZipStorage();

            zipStorage.storagePath = file.storageRelativePath + "#";

            await zipStorage.loadFromUint8Array(file.content, file.name);

            file.fileContainerStorage = zipStorage;
          }

          if (file.fileContainerStorage) {
            await this.generateFromFolder(project, file.fileContainerStorage.rootFolder, items, index);
          }
        }
      }
    }

    for (const folderName in folder.folders) {
      const childFolder = folder.folders[folderName];

      if (childFolder && !folder.errorStatus) {
        await this.generateFromFolder(project, childFolder, items, index);
      }
    }
  }

  async generateFromFile(project: Project, file: IFile, items: ProjectInfoItem[], index: ContentIndex) {
    const srPath = file.storageRelativePath.toLowerCase();

    if (srPath.indexOf("/entities/") >= 0 && !srPath.endsWith(".entity.json")) {
      const pi = new ProjectInfoItem(
        InfoItemType.info,
        this.id,
        JsonFileTagsInfoGeneratorTest.entityType,
        "Entity file",
        project.getItemByProjectPath(file.storageRelativePath),
        file.storageRelativePath
      );

      await file.loadContent(false);

      const jsonO = StorageUtilities.getJsonObject(file);

      if (jsonO !== undefined) {
        const entityNode = jsonO["minecraft:entity"];

        if (entityNode) {
          this.addSubTags(
            pi,
            "Default Components",
            index,
            AnnotationCategory.entityComponentDependent,
            entityNode["components"]
          );

          const compGroupsNode = entityNode["component_groups"];

          if (compGroupsNode) {
            for (const compNodeName in compGroupsNode) {
              this.addSubTags(
                pi,
                "Components Used in Component Groups",
                index,
                AnnotationCategory.entityComponentDependentInGroup,
                compGroupsNode[compNodeName]
              );
            }
          }
          const eventsNode = entityNode["events"];

          if (eventsNode) {
            for (const evNodeName in eventsNode) {
              this.addSubTags(pi, "Entity Events", index, AnnotationCategory.entityEvent, eventsNode[evNodeName]);
            }
          }
        }
      }

      items.push(pi);
    }

    if (srPath.indexOf("/items/") >= 0) {
      const pi = new ProjectInfoItem(
        InfoItemType.info,
        this.id,
        JsonFileTagsInfoGeneratorTest.itemType,
        "Item file",
        project.getItemByProjectPath(file.storageRelativePath),
        file.storageRelativePath
      );

      await file.loadContent(false);

      const jsonO = StorageUtilities.getJsonObject(file);

      if (jsonO !== undefined) {
        const itemNode = jsonO["minecraft:item"];

        if (itemNode) {
          this.addSubTags(pi, "Components", index, AnnotationCategory.itemComponentDependent, itemNode["components"]);
        }
      }

      items.push(pi);
    }

    if (srPath.indexOf("/blocks/") >= 0) {
      const pi = new ProjectInfoItem(
        InfoItemType.info,
        this.id,
        JsonFileTagsInfoGeneratorTest.blockType,
        "Block file",
        project.getItemByProjectPath(file.storageRelativePath),
        file.storageRelativePath
      );

      await file.loadContent(false);

      const jsonO = StorageUtilities.getJsonObject(file);

      if (jsonO) {
        const blockNode = jsonO["minecraft:block"];

        if (blockNode) {
          this.addSubTags(
            pi,
            "Block Default Components",
            index,
            AnnotationCategory.blockComponentDependent,
            blockNode["components"]
          );

          const descriptionNode = blockNode["description"];

          if (descriptionNode) {
            const stateNode = descriptionNode["states"];

            if (stateNode) {
              let permutations = 0;

              for (const obj in stateNode) {
                const val = stateNode[obj];

                if (val && val.length) {
                  if (permutations === 0) {
                    permutations = val.length;
                  } else {
                    permutations *= val.length;
                  }

                  pi.maxFeature("Permutation", "Values per property", val.length);
                }
              }

              pi.maxFeature("Permutation", "Values per type", permutations);
              pi.incrementFeature("Permutation", "Values", permutations);
            }
          }

          const permsNode = blockNode["permutations"];

          if (permsNode) {
            for (const permNode of permsNode) {
              const permComponentsNode = permNode["components"];

              if (permComponentsNode) {
                this.addSubTags(
                  pi,
                  "Block Permutation Components",
                  index,
                  AnnotationCategory.blockComponentDependentInPermutation,
                  permComponentsNode
                );
              }
            }
          }
        }
      }

      items.push(pi);
    }

    if (srPath.indexOf("/textures/terrain_texture.json") >= 0) {
      const pi = new ProjectInfoItem(
        InfoItemType.info,
        this.id,
        JsonFileTagsInfoGeneratorTest.terrainTexture,
        "Terrrain texture file",
        project.getItemByProjectPath(file.storageRelativePath),
        file.storageRelativePath
      );

      await file.loadContent(false);

      const jsonO = StorageUtilities.getJsonObject(file);

      if (jsonO) {
        this.addSubTags(pi, "Terrain Texture Elements", index, AnnotationCategory.terrainTextureSource, jsonO);
      }

      items.push(pi);
    } else if (srPath.indexOf("/textures/item_texture.json") >= 0) {
      const pi = new ProjectInfoItem(
        InfoItemType.info,
        this.id,
        JsonFileTagsInfoGeneratorTest.itemTexture,
        "Item texture file",
        project.getItemByProjectPath(file.storageRelativePath),
        file.storageRelativePath
      );

      await file.loadContent(false);

      const jsonO = StorageUtilities.getJsonObject(file);

      if (jsonO) {
        this.addSubTags(pi, "Item Texture Elements", index, AnnotationCategory.itemTextureSource, jsonO);
      }

      items.push(pi);
    } else if (srPath.indexOf("/sounds/sound_definitions.json") >= 0) {
      const pi = new ProjectInfoItem(
        InfoItemType.info,
        this.id,
        JsonFileTagsInfoGeneratorTest.soundDefinition,
        "Sound definitions file",
        project.getItemByProjectPath(file.storageRelativePath),
        file.storageRelativePath
      );

      await file.loadContent(false);

      const jsonO = StorageUtilities.getJsonObject(file);

      if (jsonO) {
        const soundDef = jsonO["sound_definitions"];

        if (soundDef) {
          this.addSubTags(pi, "Sound definition elements", index, AnnotationCategory.soundDefinitionSource, soundDef);
        }
      }

      items.push(pi);
    } else if (srPath.indexOf("/sounds/music_definitions.json") >= 0) {
      const pi = new ProjectInfoItem(
        InfoItemType.info,
        this.id,
        JsonFileTagsInfoGeneratorTest.musicDefinition,
        "Music definitions file",
        project.getItemByProjectPath(file.storageRelativePath),
        file.storageRelativePath
      );

      await file.loadContent(false);

      const jsonO = StorageUtilities.getJsonObject(file);

      if (jsonO) {
        this.addSubTags(pi, "Music definition elements", index, AnnotationCategory.musicDefinitionSource, jsonO);
      }

      items.push(pi);
    } else if (srPath.indexOf("/sounds.json") >= 0) {
      const pi = new ProjectInfoItem(
        InfoItemType.info,
        this.id,
        JsonFileTagsInfoGeneratorTest.sound,
        "Sounds file",
        project.getItemByProjectPath(file.storageRelativePath),
        file.storageRelativePath
      );

      await file.loadContent(false);

      const jsonO = StorageUtilities.getJsonObject(file);

      if (jsonO) {
        const blockSounds = jsonO["block_sounds"];
        if (blockSounds) {
          this.addSubTags(pi, "Block sounds", index, AnnotationCategory.blockSounds, blockSounds);
        }

        const entitySounds = jsonO["entity_sounds"];
        if (entitySounds) {
          this.addSubTags(pi, "Entity sounds", index, AnnotationCategory.entitySounds, entitySounds);
        }

        const individualEventSounds = jsonO["individual_event_sounds"];
        if (individualEventSounds) {
          this.addSubTags(
            pi,
            "Individual sounds",
            index,
            AnnotationCategory.individualEventSoundsSource,
            individualEventSounds
          );
        }

        const interactiveSounds = jsonO["interactive_sounds"];
        if (interactiveSounds) {
          this.addSubTags(pi, "Interactive sounds", index, AnnotationCategory.interactiveSounds, interactiveSounds);
        }
      }

      items.push(pi);
    }
  }

  addSubTags(pi: ProjectInfoItem, prefix: string, index: ContentIndex, annotation: string, rootTag?: any) {
    if (!rootTag) {
      return;
    }

    for (const childEltName in rootTag) {
      if (childEltName) {
        let colon = childEltName.indexOf(":");
        const childObj: any = rootTag[childEltName];

        if (colon <= 0 || childEltName.substring(0, colon) === "minecraft") {
          pi.incrementFeature(prefix, childEltName);

          let bareTag = childEltName;

          if (colon > 1 && colon < childEltName.length - 2) {
            bareTag = childEltName.substring(colon + 1);
          }

          if (pi.projectItem && pi.projectItem.projectPath) {
            let packRelativePath = pi.projectItem.getPackRelativePath();

            if (packRelativePath) {
              packRelativePath = StorageUtilities.getBaseFromName(
                StorageUtilities.ensureNotStartsWithDelimiter(packRelativePath)
              );

              index.insert(bareTag, packRelativePath, annotation);
            }

            index.insert(bareTag, pi.projectItem.projectPath, annotation);

            if (typeof childObj === "number") {
              if (numericAllowList.includes(bareTag)) {
                index.insert(bareTag + "==" + Math.round(childObj), pi.projectItem.projectPath, annotation);
              }
            } else if (typeof childObj === "boolean") {
              if (boolAllowList.includes(bareTag)) {
                index.insert(bareTag + "==" + (childObj ? "t" : "f"), pi.projectItem.projectPath, annotation);
              }
            } else if (Array.isArray(childObj)) {
              index.insert(bareTag + "==a", pi.projectItem.projectPath, annotation);
              this.addSubTagsForArray(pi, bareTag, index, annotation, childObj);
            } else if (typeof childObj === "string" && childObj.length > 0) {
              if (tagAllowList.includes(bareTag)) {
                index.insert(bareTag + "==" + childObj, pi.projectItem.projectPath, annotation);
                index.insert(childObj, pi.projectItem.projectPath, annotation);
              }
            } else {
              if (childObj && childObj.constructor !== Array) {
                this.addDescendentSubTags(pi, bareTag, index, annotation, childObj, childEltName);
              }
            }
          }
        }
      }
    }
  }

  addSubTagsForArray(pi: ProjectInfoItem, prefix: string, index: ContentIndex, annotation: string, rootArr?: any[]) {
    if (!rootArr) {
      return;
    }

    for (const childObj of rootArr) {
      if (typeof childObj === "string" && childObj.length > 0) {
        if (pi && pi.projectItem && pi.projectItem.projectPath) {
          index.insert(prefix + "." + childObj, pi.projectItem.projectPath, annotation);
          index.insert(childObj, pi.projectItem.projectPath, annotation);
        }
      } else {
        if (
          childObj &&
          typeof childObj !== "number" &&
          typeof childObj !== "boolean" &&
          childObj.constructor !== Array
        ) {
          this.addDescendentSubTags(pi, prefix, index, annotation, childObj);
        }
      }
    }
  }

  addDescendentSubTags(
    pi: ProjectInfoItem,
    prefix: string,
    index: ContentIndex,
    annotation: string,
    rootTag?: any,
    parentName?: string
  ) {
    if (!rootTag) {
      return;
    }

    for (const childEltName in rootTag) {
      if (childEltName) {
        const obj: any = rootTag[childEltName];

        if (pi.projectItem && pi.projectItem.projectPath) {
          if (childEltName === "test" && parentName === "filters" && typeof obj === "string") {
            index.insert(obj, pi.projectItem?.projectPath, AnnotationCategory.entityFilter);
          }

          index.insert(prefix + "." + childEltName, pi.projectItem?.projectPath, annotation);

          let bareTag = childEltName;
          let colon = childEltName.indexOf(":");

          if (colon <= 0 || childEltName.substring(0, colon) === "minecraft") {
            if (colon > 1 && colon < childEltName.length - 2) {
              bareTag = childEltName.substring(colon + 1);
            }
            const inspectTag = parentName && inspectTagList.includes(parentName);

            if (typeof obj === "number") {
              if (numericAllowList.includes(bareTag) || inspectTag) {
                index.insert(prefix + "." + bareTag + "==" + Math.round(obj), pi.projectItem.projectPath, annotation);
              }
            } else if (typeof obj === "boolean") {
              if (boolAllowList.includes(bareTag) || inspectTag) {
                index.insert(prefix + "." + bareTag + "==" + (obj ? "t" : "f"), pi.projectItem.projectPath, annotation);
              }
            } else if (typeof obj === "string") {
              if (tagAllowList.includes(bareTag) || inspectTag) {
                index.insert(prefix + "." + bareTag + "==" + obj, pi.projectItem.projectPath, annotation);
              }
            } else if (Array.isArray(obj)) {
              this.addSubTagsForArray(pi, prefix + "." + bareTag, index, annotation, obj);
            } else {
              if (obj && obj.constructor !== Array) {
                this.addDescendentSubTags(pi, prefix + "." + bareTag, index, annotation, obj, childEltName);
              }
            }
          }
        }
      }
    }
  }
}
