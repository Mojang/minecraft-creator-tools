// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * ProjectCreateManager.canLoadGalleryTemplateFiles, which add runs before it copies a gallery template,
 * with the template's source packs in memory. A file created without content stands in for one whose
 * download failed: like an HTTP file then, it loads with null content.
 */

import { expect } from "chai";
import "mocha";
import IGalleryItem, { GalleryItemType } from "./IGalleryItem";
import ProjectCreateManager from "./ProjectCreateManager";
import ZipStorage from "../storage/ZipStorage";

const ALLAY: IGalleryItem = {
  id: "allay",
  title: "Allay",
  description: "",
  type: GalleryItemType.entityType,
  gitHubOwner: "",
  gitHubRepoName: "bedrock-samples",
  thumbnailImage: "",
  fileList: [
    "/behavior_pack/entities/allay.json",
    "/resource_pack/entity/allay.entity.json",
    "/resource_pack/animations/allay.animation.json",
  ],
};

/**
 * A pack with these files, by path. A null content is a file whose download failed, and a path that
 * ends with / is an empty folder, as one whose download failed is.
 */
async function createPack(files: Record<string, string | null>) {
  const pack = new ZipStorage().rootFolder;

  for (const [filePath, content] of Object.entries(files)) {
    if (filePath.endsWith("/")) {
      await pack.ensureFolderFromRelativePath(filePath);
      continue;
    }

    const file = await pack.ensureFileFromRelativePath(filePath);

    if (content !== null) {
      file.setContent(content);
    }
  }

  return pack;
}

const cases: {
  name: string;
  behaviorPack: Record<string, string | null>;
  resourcePack: Record<string, string | null>;
  canLoad: boolean;
}[] = [
  {
    name: "fails when the resource pack can't be downloaded, even though the behavior pack can",
    behaviorPack: { "/entities/allay.json": "{}" },
    resourcePack: {},
    canLoad: false,
  },
  {
    name: "fails when a file it finds can't be downloaded",
    behaviorPack: { "/entities/allay.json": "{}" },
    resourcePack: { "/entity/allay.entity.json": "{}", "/animations/allay.animation.json": null },
    canLoad: false,
  },
  {
    name: "fails when a listed file's folder is empty, as one whose download failed is",
    behaviorPack: { "/entities/allay.json": "{}" },
    resourcePack: { "/entity/allay.entity.json": "{}", "/animations/": null },
    canLoad: false,
  },
  {
    name: "skips a listed file that its pack doesn't have, as copying does",
    behaviorPack: { "/entities/allay.json": "{}" },
    resourcePack: { "/entity/allay.entity.json": "{}" },
    canLoad: true,
  },
];

describe("ProjectCreateManager.canLoadGalleryTemplateFiles", () => {
  for (const testCase of cases) {
    it(testCase.name, async () => {
      const sourcePacks = {
        behaviorPack: await createPack(testCase.behaviorPack),
        resourcePack: await createPack(testCase.resourcePack),
      };

      expect(await ProjectCreateManager.canLoadGalleryTemplateFiles(ALLAY, sourcePacks)).to.equal(testCase.canLoad);
    });
  }
});
