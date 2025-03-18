// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import ProjectInfoItem from "./ProjectInfoItem";
import IProjectFileInfoGenerator from "./IProjectFileInfoGenerator";
import { InfoItemType } from "./IInfoItemData";
import IFile from "../storage/IFile";
import StorageUtilities from "../storage/StorageUtilities";
import ProjectInfoSet from "./ProjectInfoSet";
import Project from "../app/Project";
import ContentIndex from "../core/ContentIndex";

export enum ValidGeneratorTest {
  nonCompliantJson = 2,
  emptyJson = 3,
  jsonNotString = 4,
}

export default class ValidFileGenerator implements IProjectFileInfoGenerator {
  id = "VALFILE";
  title = "Valid files";

  getTopicData(topicId: number) {
    return {
      title: topicId.toString(),
    };
  }

  summarize(info: any, infoSet: ProjectInfoSet) {}

  async generate(project: Project, file: IFile, contentIndex: ContentIndex): Promise<ProjectInfoItem[]> {
    const items: ProjectInfoItem[] = [];

    if (StorageUtilities.getMimeType(file) === "application/json") {
      if (!file.isString) {
        items.push(
          new ProjectInfoItem(
            InfoItemType.error,
            this.id,
            ValidGeneratorTest.jsonNotString,
            `JSON file is not a string`,
            project.getItemByExtendedOrProjectPath(file.extendedPath),
            file.content ? file.content.length + " bytes" : "unloadable"
          )
        );
      } else if (!file.content || file.content?.length < 2) {
        items.push(
          new ProjectInfoItem(
            InfoItemType.error,
            this.id,
            ValidGeneratorTest.emptyJson,
            `JSON file is empty`,
            project.getItemByExtendedOrProjectPath(file.extendedPath),
            file.content ? file.content.length + " characters" : "unloadable"
          )
        );
      } else {
        StorageUtilities.getJsonObject(file);

        if (file.isInErrorState) {
          items.push(
            new ProjectInfoItem(
              InfoItemType.error,
              this.id,
              ValidGeneratorTest.nonCompliantJson,
              `JSON file is not JSON compliant`,
              project.getItemByExtendedOrProjectPath(file.extendedPath),
              file.errorStateMessage ? file.errorStateMessage : "unparseable"
            )
          );
        }
      }
    }

    return items;
  }
}
