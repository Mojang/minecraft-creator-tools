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

export enum UnknownFileGeneratorTest {
  unknownTypeFileFound = 2,
}

export default class UnknownFileGenerator implements IProjectFileInfoGenerator {
  id = "UNKFILE";
  title = "Unknown files";
  canAlwaysProcess = true;

  getTopicData(topicId: number) {
    return {
      title: topicId.toString(),
    };
  }

  summarize(info: any, infoSet: ProjectInfoSet) {}

  async generate(project: Project, file: IFile, contentIndex: ContentIndex): Promise<ProjectInfoItem[]> {
    const items: ProjectInfoItem[] = [];

    if (!StorageUtilities.isUsableFile(file.storageRelativePath)) {
      const ext = StorageUtilities.getTypeFromName(file.name);

      items.push(
        new ProjectInfoItem(
          InfoItemType.error,
          this.id,
          UnknownFileGeneratorTest.unknownTypeFileFound,
          `Unknown type ${ext} file found`,
          project.getItemByExtendedOrProjectPath(file.extendedPath),
          file.extendedPath
        )
      );
    }

    return items;
  }
}
