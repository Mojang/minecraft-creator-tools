// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import ProjectInfoItem from "./ProjectInfoItem";
import IProjectFileInfoGenerator from "./IProjectFileInfoGenerator";
import { InfoItemType } from "./IInfoItemData";
import IFile from "../storage/IFile";
import ProjectInfoSet from "./ProjectInfoSet";
import Project from "../app/Project";
import ContentIndex from "../core/ContentIndex";

export default class PathLengthFileGenerator implements IProjectFileInfoGenerator {
  id = "PATHLENGTH";
  title = "Path Length";

  getTopicData(topicId: number) {
    return {
      title: topicId.toString(),
    };
  }

  summarize(info: any, infoSet: ProjectInfoSet) {}

  async generate(project: Project, file: IFile, contentIndex: ContentIndex): Promise<ProjectInfoItem[]> {
    const items: ProjectInfoItem[] = [];

    let path = file.storageRelativePath;

    const packContentFolderHints = [
      "bp",
      "rp",
      "resource pack",
      "resource packs",
      "content/resource_packs",
      "behavior pack",
      "behavior packs",
      "content/behavior_packs",
      "skin pack",
      "skin packs",
      "content/skin_packs",
      "world_template",
    ];

    for (const hint of packContentFolderHints) {
      const hintIndex = path.toLowerCase().indexOf("/" + hint + "/");

      if (hintIndex >= 0) {
        path = path.substring(hintIndex + hint.length + 2);
      }
    }

    const packStarterFolderHints = ["resource_packs", "behavior_packs", "world_templates", "skin_packs"];

    for (const hint of packStarterFolderHints) {
      if (path.toLowerCase().startsWith(hint + "/")) {
        path = path.substring(hint.length + 1);
      }
    }

    const fSlashSegments = path.split("/");
    const bSlashSegments = path.split("\\");

    if (fSlashSegments.length > 9 || bSlashSegments.length > 9) {
      items.push(
        new ProjectInfoItem(
          InfoItemType.testCompleteFail,
          this.id,
          2,
          `File path contains 8 or more directory segments, and may not run on all devices`,
          project.getItemByExtendedOrProjectPath(file.extendedPath),
          path
        )
      );
    }

    if (path.length > 80) {
      items.push(
        new ProjectInfoItem(
          InfoItemType.testCompleteFail,
          this.id,
          3,
          `File path contains more than 80 characters, and may not run on all devices`,
          project.getItemByExtendedOrProjectPath(file.extendedPath),
          path
        )
      );
    }

    return items;
  }
}
