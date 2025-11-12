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
  entityType = 101,
  blockType = 102,
  itemType = 103,
  terrainTexture = 104,
  itemTexture = 105,
  soundDefinition = 106,
  musicDefinition = 107,
  sound = 108,
}

export default class JsonFileTagsInfoGenerator implements IProjectInfoGenerator {
  id = "JSONTAGS";
  title = "JSON Tags";
  canAlwaysProcess = true;

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

  summarize(info: any, infoSet: ProjectInfoSet) {
    const entityTypeComponents = infoSet.getItems(this.id, JsonFileTagsInfoGeneratorTest.entityType);
    const blockTypeComponents = infoSet.getItems(this.id, JsonFileTagsInfoGeneratorTest.blockType);
    const itemTypeComponents = infoSet.getItems(this.id, JsonFileTagsInfoGeneratorTest.itemType);

    info.entityTypeComponents = [];
    info.blockTypeComponents = [];
    info.itemTypeComponents = [];

    for (const entityTypeComponent of entityTypeComponents) {
      let entityComponentSets = entityTypeComponent.featureSets;

      if (entityComponentSets) {
        const ecInCg = entityComponentSets["componentsUsedInComponentGroups"];

        if (ecInCg) {
          for (let cgId in ecInCg) {
            if (cgId.startsWith("minecraft:")) {
              cgId = cgId.substring(10);
            }

            if (!info.entityTypeComponents.includes(cgId)) {
              info.entityTypeComponents.push(cgId);
            }
          }
        }
        const defaultEcInCg = entityComponentSets["defaultComponents"];

        if (defaultEcInCg) {
          for (let cgId in defaultEcInCg) {
            if (cgId.startsWith("minecraft:")) {
              cgId = cgId.substring(10);
            }

            if (!info.entityTypeComponents.includes(cgId)) {
              info.entityTypeComponents.push(cgId);
            }
          }
        }
      }
    }

    for (const blockTypeComponent of blockTypeComponents) {
      let blockComponentSets = blockTypeComponent.featureSets;

      if (blockComponentSets) {
        const blockTypeComponents = blockComponentSets["blockDefaultComponents"];

        if (blockTypeComponents) {
          for (let cgId in blockTypeComponents) {
            if (cgId.startsWith("minecraft:")) {
              cgId = cgId.substring(10);
            }

            if (!info.blockTypeComponents.includes(cgId)) {
              info.blockTypeComponents.push(cgId);
            }
          }
        }

        const blockPermutationTypeComponents = blockComponentSets["blockPermutationComponents"];

        if (blockPermutationTypeComponents) {
          for (let cgId in blockPermutationTypeComponents) {
            if (cgId.startsWith("minecraft:")) {
              cgId = cgId.substring(10);
            }

            if (!info.blockTypeComponents.includes(cgId)) {
              info.blockTypeComponents.push(cgId);
            }
          }
        }
      }
    }

    for (const itemTypeComponent of itemTypeComponents) {
      let itemComponentSets = itemTypeComponent.featureSets;

      if (itemComponentSets) {
        const itemTypeComponents = itemComponentSets["components"];

        if (itemTypeComponents) {
          for (let cgId in itemTypeComponents) {
            if (cgId.startsWith("minecraft:")) {
              cgId = cgId.substring(10);
            }

            if (!info.itemTypeComponents.includes(cgId)) {
              info.itemTypeComponents.push(cgId);
            }
          }
        }
      }
    }

    info.entityTypeComponents.sort();
    info.itemTypeComponents.sort();
    info.blockTypeComponents.sort();
  }

  async generateFromFolder(project: Project, folder: IFolder, items: ProjectInfoItem[], index: ContentIndex) {
    if (!folder.isLoaded) {
      await folder.load();
    }

    for (const fileName in folder.files) {
      const baseType = StorageUtilities.getTypeFromName(fileName);
      const file = folder.files[fileName];

      if (baseType === "json" && file) {
        await this.generateFromFile(project, file, items, index);
      } else if (StorageUtilities.isContainerFile(fileName) && file) {
        if (!file.isContentLoaded) {
          await file.loadContent();
        }

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
        project.getItemByExtendedOrProjectPath(file.storageRelativePath),
        file.storageRelativePath
      );

      if (!file.isContentLoaded) {
        await file.loadContent(false);
      }

      const jsonO = StorageUtilities.getJsonObject(file);

      if (jsonO !== undefined) {
        const entityNode = jsonO["minecraft:entity"];

        if (entityNode) {
          await this.addSubTags(
            pi,
            "defaultComponents",
            index,
            AnnotationCategory.entityComponentDependent,
            entityNode["components"]
          );

          const compGroupsNode = entityNode["component_groups"];

          if (compGroupsNode) {
            for (const compNodeName in compGroupsNode) {
              await this.addSubTags(
                pi,
                "componentsUsedInComponentGroups",
                index,
                AnnotationCategory.entityComponentDependentInGroup,
                compGroupsNode[compNodeName]
              );
            }
          }
          const eventsNode = entityNode["events"];

          if (eventsNode) {
            for (const evNodeName in eventsNode) {
              await this.addSubTags(pi, "entityEvents", index, AnnotationCategory.entityEvent, eventsNode[evNodeName]);
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
        project.getItemByExtendedOrProjectPath(file.storageRelativePath),
        file.storageRelativePath
      );

      if (!file.isContentLoaded) {
        await file.loadContent(false);
      }

      const jsonO = StorageUtilities.getJsonObject(file);

      if (jsonO !== undefined) {
        const itemNode = jsonO["minecraft:item"];

        if (itemNode) {
          await this.addSubTags(
            pi,
            "components",
            index,
            AnnotationCategory.itemComponentDependent,
            itemNode["components"]
          );
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
        project.getItemByExtendedOrProjectPath(file.storageRelativePath),
        file.storageRelativePath
      );

      if (!file.isContentLoaded) {
        await file.loadContent(false);
      }

      const jsonO = StorageUtilities.getJsonObject(file);

      if (jsonO) {
        const blockNode = jsonO["minecraft:block"];

        if (blockNode) {
          await this.addSubTags(
            pi,
            "blockDefaultComponents",
            index,
            AnnotationCategory.blockComponentDependent,
            blockNode["components"]
          );

          const descriptionNode = blockNode["description"];

          if (descriptionNode) {
            let stateNode = descriptionNode["states"];

            if (stateNode === undefined) {
              stateNode = descriptionNode["properties"];
            }

            let permutations = 0;

            if (stateNode) {
              for (const obj in stateNode) {
                const val = stateNode[obj];

                if (val && val.length) {
                  if (permutations === 0) {
                    permutations = val.length;
                  } else {
                    permutations *= val.length;
                  }

                  pi.maxFeature("Permutation", "values_per_property", val.length);
                }
              }
            }

            let traitsNode = descriptionNode["traits"];

            if (traitsNode) {
              if (traitsNode["minecraft:placement_direction"]) {
                const enabledStates = traitsNode["minecraft:placement_direction"]["enabled_states"];

                if (enabledStates && enabledStates.includes("minecraft:cardinal_direction")) {
                  if (permutations === 0) {
                    permutations = 4;
                  } else {
                    permutations *= 4;
                  }
                }

                if (enabledStates && enabledStates.includes("minecraft:facing_direction")) {
                  if (permutations === 0) {
                    permutations = 6;
                  } else {
                    permutations *= 6;
                  }
                }
              }

              if (traitsNode["minecraft:placement_position"]) {
                const enabledStates = traitsNode["minecraft:placement_position"]["enabled_states"];

                if (enabledStates && enabledStates.includes("minecraft:block_face")) {
                  if (permutations === 0) {
                    permutations = 6;
                  } else {
                    permutations *= 6;
                  }
                }

                if (enabledStates && enabledStates.includes("minecraft:vertical_half")) {
                  if (permutations === 0) {
                    permutations = 2;
                  } else {
                    permutations *= 2;
                  }
                }
              }
            }

            if (stateNode || traitsNode) {
              pi.maxFeature("Permutation", "Values per type", permutations);
              pi.incrementFeature("Permutation", "Values", permutations);
            }
          }

          const permsNode = blockNode["permutations"];

          if (permsNode) {
            for (const permNode of permsNode) {
              const permComponentsNode = permNode["components"];

              if (permComponentsNode) {
                await this.addSubTags(
                  pi,
                  "blockPermutationComponents",
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
        project.getItemByExtendedOrProjectPath(file.storageRelativePath),
        file.storageRelativePath
      );

      if (!file.isContentLoaded) {
        await file.loadContent(false);
      }

      const jsonO = StorageUtilities.getJsonObject(file);

      if (jsonO && jsonO.texture_data) {
        await this.addSubTags(
          pi,
          "terrain_texture_elements",
          index,
          AnnotationCategory.terrainTextureSource,
          jsonO.texture_data,
          true
        );
      }

      items.push(pi);
    } else if (srPath.indexOf("/textures/item_texture.json") >= 0) {
      const pi = new ProjectInfoItem(
        InfoItemType.info,
        this.id,
        JsonFileTagsInfoGeneratorTest.itemTexture,
        "Item texture file",
        project.getItemByExtendedOrProjectPath(file.storageRelativePath),
        file.storageRelativePath
      );

      await file.loadContent(false);

      const jsonO = StorageUtilities.getJsonObject(file);

      if (jsonO && jsonO.texture_data) {
        await this.addSubTags(
          pi,
          "item_texture_elements",
          index,
          AnnotationCategory.itemTextureSource,
          jsonO.texture_data,
          true
        );
      }

      items.push(pi);
    } else if (srPath.indexOf("/sounds/sound_definitions.json") >= 0) {
      const pi = new ProjectInfoItem(
        InfoItemType.info,
        this.id,
        JsonFileTagsInfoGeneratorTest.soundDefinition,
        "Sound definitions file",
        project.getItemByExtendedOrProjectPath(file.storageRelativePath),
        file.storageRelativePath
      );

      if (!file.isContentLoaded) {
        await file.loadContent(false);
      }

      const jsonO = StorageUtilities.getJsonObject(file);

      if (jsonO) {
        const soundDef = jsonO["sound_definitions"];

        if (soundDef) {
          await this.addSubTags(
            pi,
            "sound_definition_elements",
            index,
            AnnotationCategory.soundDefinitionSource,
            soundDef,
            true
          );
        }
      }

      items.push(pi);
    } else if (srPath.indexOf("/sounds/music_definitions.json") >= 0) {
      const pi = new ProjectInfoItem(
        InfoItemType.info,
        this.id,
        JsonFileTagsInfoGeneratorTest.musicDefinition,
        "Music definitions file",
        project.getItemByExtendedOrProjectPath(file.storageRelativePath),
        file.storageRelativePath
      );

      if (!file.isContentLoaded) {
        await file.loadContent(false);
      }

      const jsonO = StorageUtilities.getJsonObject(file);

      if (jsonO) {
        await this.addSubTags(
          pi,
          "music_definition_elements",
          index,
          AnnotationCategory.musicDefinitionSource,
          jsonO,
          true
        );
      }

      items.push(pi);
    } else if (srPath.indexOf("/sounds.json") >= 0) {
      const pi = new ProjectInfoItem(
        InfoItemType.info,
        this.id,
        JsonFileTagsInfoGeneratorTest.sound,
        "Sounds file",
        project.getItemByExtendedOrProjectPath(file.storageRelativePath),
        file.storageRelativePath
      );

      if (!file.isContentLoaded) {
        await file.loadContent(false);
      }

      const jsonO = StorageUtilities.getJsonObject(file);

      if (jsonO) {
        const blockSounds = jsonO["block_sounds"];
        if (blockSounds) {
          await this.addSubTags(pi, "block_sounds", index, AnnotationCategory.blockSounds, blockSounds, true);
        }

        const entitySounds = jsonO["entity_sounds"];
        if (entitySounds) {
          await this.addSubTags(pi, "entity_sounds", index, AnnotationCategory.entitySounds, entitySounds, true);
        }

        const individualEventSounds = jsonO["individual_event_sounds"];
        if (individualEventSounds) {
          await this.addSubTags(
            pi,
            "individual_sounds",
            index,
            AnnotationCategory.individualEventSoundsSource,
            individualEventSounds
          );
        }

        const interactiveSounds = jsonO["interactive_sounds"];
        if (interactiveSounds) {
          await this.addSubTags(
            pi,
            "interactive_sounds",
            index,
            AnnotationCategory.interactiveSounds,
            interactiveSounds,
            true
          );
        }
      }

      items.push(pi);
    }
  }

  async addSubTags(
    pi: ProjectInfoItem,
    prefix: string,
    index: ContentIndex,
    annotation: string,
    rootTag?: any,
    doNotIncrement?: boolean
  ) {
    if (!rootTag) {
      return;
    }

    for (const childEltName in rootTag) {
      if (childEltName) {
        let colon = childEltName.indexOf(":");
        const childObj: any = rootTag[childEltName];

        if (colon <= 0 || childEltName.substring(0, colon) === "minecraft") {
          if (!doNotIncrement) {
            pi.incrementFeature(prefix, childEltName);
          }

          let bareTag = childEltName;

          if (colon > 1 && colon < childEltName.length - 2) {
            bareTag = childEltName.substring(colon + 1);
          }

          if (pi.projectItem && pi.projectItem.projectPath) {
            let packRelativePath = await pi.projectItem.getPackRelativePath();

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
