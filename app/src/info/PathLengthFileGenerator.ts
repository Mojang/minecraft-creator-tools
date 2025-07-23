// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import ProjectInfoItem from "./ProjectInfoItem";
import IProjectFileInfoGenerator from "./IProjectFileInfoGenerator";
import { InfoItemType } from "./IInfoItemData";
import IFile from "../storage/IFile";
import ProjectInfoSet from "./ProjectInfoSet";
import Project from "../app/Project";
import ContentIndex from "../core/ContentIndex";

export enum PathLengthFileGeneratorTest {
  filePathExceeds8DirectorySegments = 102,
  filePathExceedsCharacterLength = 103,
  filePathContainsNonLowercaseLetters = 104,
}

export default class PathLengthFileGenerator implements IProjectFileInfoGenerator {
  id = "PATHLENGTH";
  title = "Path Length";
  canAlwaysProcess = true;

  getTopicData(topicId: number) {
    return {
      title: topicId.toString(),
    };
  }

  summarize(info: any, infoSet: ProjectInfoSet) {}

  async generate(project: Project, file: IFile, contentIndex: ContentIndex): Promise<ProjectInfoItem[]> {
    const items: ProjectInfoItem[] = [];

    let path = file.storageRelativePath;
    let pathSub = path;

    pathSub = pathSub.replace("/Content/", "/content/");
    pathSub = pathSub.replace("/Marketing Art/", "/marketing art/");
    pathSub = pathSub.replace("/Store Art/", "/store art/");

    let packsIndex = pathSub.indexOf("_packs/");

    if (packsIndex > 0) {
      packsIndex = pathSub.indexOf("/", packsIndex + 7);

      if (packsIndex >= 0) {
        pathSub = pathSub.substring(packsIndex);
      }
    } else {
      // else, try to find the first subfolder after the second slash
      packsIndex = pathSub.indexOf("/", 2);
      if (packsIndex >= 0) {
        pathSub = pathSub.substring(packsIndex + 1);
      }
    }

    if (
      pathSub.toLowerCase() !== pathSub &&
      !pathSub.startsWith("/marketing art/") &&
      !pathSub.startsWith("/store art/") &&
      !pathSub.endsWith(".lang") &&
      pathSub.indexOf("/texts/") < 0 &&
      pathSub.indexOf("/scripts/") < 0
    ) {
      items.push(
        new ProjectInfoItem(
          InfoItemType.recommendation,
          this.id,
          PathLengthFileGeneratorTest.filePathContainsNonLowercaseLetters,
          `File path contains non-lowercase letters`,
          project.getItemByExtendedOrProjectPath(file.extendedPath),
          pathSub
        )
      );
    }

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

    const packStarterFolderHints = [
      "resource_packs",
      "behavior_packs",
      "resource_pack",
      "behavior_pack",
      "world_templates",
      "world_template",
      "skin_packs",
      "skin_pack",
    ];

    for (const hint of packStarterFolderHints) {
      if (path.toLowerCase().startsWith("/" + hint + "/")) {
        path = path.substring(hint.length + 2);
      }
      if (path.toLowerCase().startsWith(hint + "/")) {
        path = path.substring(hint.length + 1);
      }
    }

    const fSlashSegments = path.split("/");
    const bSlashSegments = path.split("\\");

    if (fSlashSegments.length > 9 || bSlashSegments.length > 9) {
      items.push(
        new ProjectInfoItem(
          InfoItemType.error,
          this.id,
          PathLengthFileGeneratorTest.filePathExceeds8DirectorySegments,
          `File path contains 8 or more directory segments, and may not run on all devices`,
          project.getItemByExtendedOrProjectPath(file.extendedPath),
          path
        )
      );
    }

    if (path.length > 100) {
      items.push(
        new ProjectInfoItem(
          InfoItemType.error,
          this.id,
          PathLengthFileGeneratorTest.filePathExceedsCharacterLength,
          `File path contains more than 100 characters, and may not run on all devices`,
          project.getItemByExtendedOrProjectPath(file.extendedPath),
          path
        )
      );
    }

    return items;
  }
}
