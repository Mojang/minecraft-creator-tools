import ProjectInfoItem from "./ProjectInfoItem";
import Project from "../app/Project";
import IProjectInfoGenerator from "./IProjectInfoGenerator";
import { InfoItemType } from "./IInfoItemData";
import IFolder from "../storage/IFolder";
import StorageUtilities from "../storage/StorageUtilities";
import IFile from "../storage/IFile";
import ZipStorage from "../storage/ZipStorage";

export default class JsonFileTagsInfoGenerator implements IProjectInfoGenerator {
  id = "JSONTAGS";
  title = "JSON Tags";

  getTopicData(topicId: number) {
    switch (topicId) {
      case 1:
        return { title: "Entity Type" };
      case 2:
        return { title: "Block Type" };
    }
    return { title: topicId.toString() };
  }

  async generate(project: Project): Promise<ProjectInfoItem[]> {
    const items: ProjectInfoItem[] = [];

    if (project.projectFolder) {
      await this.generateFromFolder(project, project.projectFolder, items);
    }

    return items;
  }

  async generateFromFolder(project: Project, folder: IFolder, items: ProjectInfoItem[]) {
    await folder.load(false);

    for (const fileName in folder.files) {
      const baseType = StorageUtilities.getTypeFromName(fileName);
      const file = folder.files[fileName];

      if (baseType === "json" && file) {
        await this.generateFromFile(project, file, items);
      } else if (StorageUtilities.isContainerFile(fileName) && file) {
        await file.loadContent();

        if (file.content && file.content instanceof Uint8Array) {
          if (!file.fileContainerStorage) {
            const zipStorage = new ZipStorage();

            zipStorage.storagePath = file.storageRelativePath + "#";

            await zipStorage.loadFromUint8Array(file.content);

            file.fileContainerStorage = zipStorage;
          }

          if (file.fileContainerStorage) {
            await this.generateFromFolder(project, file.fileContainerStorage.rootFolder, items);
          }
        }
      }
    }

    for (const folderName in folder.folders) {
      const childFolder = folder.folders[folderName];

      if (childFolder && !folder.errorStatus) {
        await this.generateFromFolder(project, childFolder, items);
      }
    }
  }

  async generateFromFile(project: Project, file: IFile, items: ProjectInfoItem[]) {
    const srPath = file.storageRelativePath.toLowerCase();

    if (srPath.indexOf("/entities/") >= 0 && !srPath.endsWith(".entity.json")) {
      const pi = new ProjectInfoItem(InfoItemType.info, this.id, 1, "Entity file: " + file.storageRelativePath);

      await file.loadContent(false);

      const jsonO = StorageUtilities.getJsonObject(file);

      if (jsonO) {
        const entityNode = jsonO["minecraft:entity"];

        if (entityNode) {
          this.addSubTags(pi, "component", entityNode["components"]);

          const compGroupsNode = entityNode["component_groups"];

          if (compGroupsNode) {
            for (const compNodeName in compGroupsNode) {
              this.addSubTags(pi, "component group", compGroupsNode[compNodeName]);
            }
          }
        }
      }

      items.push(pi);
    }

    if (srPath.indexOf("/blocks/") >= 0) {
      const pi = new ProjectInfoItem(InfoItemType.info, this.id, 2, "Block file: " + file.storageRelativePath);

      await file.loadContent(false);

      const jsonO = StorageUtilities.getJsonObject(file);

      if (jsonO) {
        const entityNode = jsonO["minecraft:block"];

        if (entityNode) {
          this.addSubTags(pi, "component", entityNode["components"]);

          const descriptionNode = entityNode["description"];

          if (descriptionNode) {
            const propsNode = descriptionNode["properties"];

            this.addSubTags(pi, "properties", propsNode);

            if (propsNode) {
              let permutations = 0;

              for (const obj in propsNode) {
                const val = propsNode[obj];

                if (val && val.length) {
                  if (permutations === 0) {
                    permutations = val.length;
                  } else {
                    permutations *= val.length;
                  }

                  pi.maxFeature("max values per property", val.length);
                }
              }

              pi.maxFeature("max permutation values per type", permutations);
              pi.incrementFeature("permutation values", permutations);
            }
          }
        }
      }

      items.push(pi);
    }
  }

  addSubTags(pi: ProjectInfoItem, suffix: string, rootTag?: object) {
    if (!rootTag) {
      return;
    }

    for (const obj in rootTag) {
      if (obj) {
        pi.incrementFeature(obj + " " + suffix);
      }
    }
  }
}
