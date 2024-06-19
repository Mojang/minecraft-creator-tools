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
import ContentIndex, { AnnotationCategories } from "../core/ContentIndex";

const tagAllowList = ["render_method", "min_difficulty", "cause", "effect_name"];
const tagMinecraftAllowList = ["entity_type", "event_name"];

export default class JsonFileTagsInfoGenerator implements IProjectInfoGenerator {
  id = "JSONTAGS";
  title = "JSON Tags";

  getTopicData(topicId: number) {
    switch (topicId) {
      case 1:
        return { title: "Entity Type" };
      case 2:
        return { title: "Block Type" };
      case 3:
        return { title: "Item Type" };
    }
    return { title: topicId.toString() };
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
        1,
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
            AnnotationCategories.entityComponentDependent,
            entityNode["components"]
          );

          const compGroupsNode = entityNode["component_groups"];

          if (compGroupsNode) {
            for (const compNodeName in compGroupsNode) {
              this.addSubTags(
                pi,
                "Components Used in Component Groups",
                index,
                AnnotationCategories.entityComponentDependentInGroup,
                compGroupsNode[compNodeName]
              );
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
        3,
        "Item file",
        project.getItemByProjectPath(file.storageRelativePath),
        file.storageRelativePath
      );

      await file.loadContent(false);

      const jsonO = StorageUtilities.getJsonObject(file);

      if (jsonO !== undefined) {
        const itemNode = jsonO["minecraft:item"];

        if (itemNode) {
          this.addSubTags(pi, "Components", index, AnnotationCategories.itemComponentDependent, itemNode["components"]);
        }
      }

      items.push(pi);
    }

    if (srPath.indexOf("/blocks/") >= 0) {
      const pi = new ProjectInfoItem(
        InfoItemType.info,
        this.id,
        2,
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
            AnnotationCategories.blockComponentDependent,
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
                  AnnotationCategories.blockComponentDependentInPermutation,
                  permComponentsNode
                );
              }
            }
          }
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

          if (colon === 9) {
            bareTag = childEltName.substring(10);
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
              index.insert(bareTag + "==" + Math.round(childObj), pi.projectItem.projectPath, annotation);
            } else if (typeof childObj === "boolean") {
              index.insert(bareTag + "==" + (childObj ? "t" : "f"), pi.projectItem.projectPath, annotation);
            } else if (typeof childObj === "string") {
              if (
                tagAllowList.includes(childEltName) ||
                (childEltName.startsWith("minecraft:") && tagMinecraftAllowList.includes(childEltName))
              ) {
                index.insert(bareTag + "==" + childObj, pi.projectItem.projectPath, annotation);
              }
            } else {
              if (childObj.constructor !== Array) {
                this.addDescendentSubTags(pi, bareTag, index, annotation, childObj);
              }
            }
          }
        }
      }
    }
  }

  addDescendentSubTags(pi: ProjectInfoItem, prefix: string, index: ContentIndex, annotation: string, rootTag?: any) {
    if (!rootTag) {
      return;
    }

    for (const childEltName in rootTag) {
      if (childEltName) {
        const obj: any = rootTag[childEltName];

        if (pi.projectItem && pi.projectItem.projectPath) {
          index.insert(prefix + "." + childEltName, pi.projectItem?.projectPath, annotation);

          if (typeof obj === "number") {
            index.insert(prefix + "." + childEltName + "==" + Math.round(obj), pi.projectItem.projectPath, annotation);
          } else if (typeof obj === "boolean") {
            index.insert(
              prefix + "." + childEltName + "==" + (obj ? "t" : "f"),
              pi.projectItem.projectPath,
              annotation
            );
          } else if (typeof obj === "string") {
            if (
              tagAllowList.includes(childEltName) ||
              (childEltName.startsWith("minecraft:") && tagMinecraftAllowList.includes(childEltName))
            ) {
              index.insert(prefix + "." + childEltName + "==" + obj, pi.projectItem.projectPath, annotation);
            }
          } else {
            if (obj.constructor !== Array) {
              this.addDescendentSubTags(pi, prefix + "." + childEltName, index, annotation, obj);
            }
          }
        }
      }
    }
  }
}
