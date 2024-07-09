// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import Project from "../app/Project";
import IFolder from "../storage/IFolder";
import StorageUtilities from "../storage/StorageUtilities";
import IFile from "../storage/IFile";
import ZipStorage from "../storage/ZipStorage";
import { ESLint } from "eslint";
import ProjectInfoItem from "../info/ProjectInfoItem";
import IProjectInfoGenerator from "../info/IProjectInfoGenerator";
import { InfoItemType } from "../info/IInfoItemData";
import ProjectInfoSet from "../info/ProjectInfoSet";
import ContentIndex from "../core/ContentIndex";

export default class JsEslintInfoGenerator implements IProjectInfoGenerator {
  id = "ESLINT";
  title = "JavaScript Lint";

  getTopicData(topicId: number) {
    switch (topicId) {
      case 100:
        return { title: "ESLint Error" };
    }
    return {
      title: topicId.toString(),
    };
  }

  summarize(info: any, infoSet: ProjectInfoSet) {}

  async generate(project: Project, contentIndex: ContentIndex): Promise<ProjectInfoItem[]> {
    const items: ProjectInfoItem[] = [];
    var foundError = false;

    if (project.projectFolder) {
      foundError = await this.generateFromFolder(project, project.projectFolder, items);
    }

    if (foundError) {
      items.push(new ProjectInfoItem(InfoItemType.testCompleteFail, this.id, 261, "JS ESLint check fails."));
    } else if (foundError) {
      items.push(new ProjectInfoItem(InfoItemType.testCompleteSuccess, this.id, 262, "JS ESLint check passes."));
    }

    return items;
  }

  async generateFromFolder(project: Project, folder: IFolder, items: ProjectInfoItem[]) {
    await folder.load();
    var foundError = false;

    for (const fileName in folder.files) {
      const baseType = StorageUtilities.getTypeFromName(fileName);
      const file = folder.files[fileName];

      if ((baseType === "js" || baseType === "mjs" || baseType === "ts") && file) {
        if (await this.generateFromFile(project, file, items)) {
          foundError = true;
        }
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
            await this.generateFromFolder(project, file.fileContainerStorage.rootFolder, items);
          }
        }
      }
    }

    for (const folderName in folder.folders) {
      const childFolder = folder.folders[folderName];

      if (childFolder && !folder.errorStatus) {
        if (await this.generateFromFolder(project, childFolder, items)) {
          foundError = true;
        }
      }
    }

    return foundError;
  }

  async generateFromFile(project: Project, file: IFile, items: ProjectInfoItem[]) {
    const srPath = file.storageRelativePath.toLowerCase();
    var foundErrors = false;

    if (srPath) {
      const pi = new ProjectInfoItem(InfoItemType.info, this.id, 1, "JS file: " + file.storageRelativePath);

      await file.loadContent(false);

      const fileContent = file.content;

      if (fileContent && typeof fileContent === "string") {
        const eslint = new ESLint({
          useEslintrc: false,
          overrideConfig: {
            extends: ["eslint:recommended"],
            parserOptions: {
              sourceType: "module",
              ecmaVersion: "latest",
            },
            env: {
              es2022: true,
              node: true,
            },
          },
        });

        const results = await eslint.lintText(fileContent);

        for (const result of results) {
          for (const message of result.messages) {
            items.push(
              new ProjectInfoItem(
                InfoItemType.error,
                this.id,
                100,
                message.message,
                undefined,
                undefined,
                undefined,
                JSON.stringify(message)
              )
            );
            foundErrors = true;
          }
        }
      }

      items.push(pi);
    }

    return foundErrors;
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
