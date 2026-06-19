// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { expect } from "chai";
import CheckTextureListGenerator, { CheckTextureListGeneratorTest } from "./CheckTextureListGenerator";
import { createStubProject } from "../../../test/stubs/app/projects/StubProject";
import ContentIndex from "../../../core/ContentIndex";
import { InfoItemType } from "../../IInfoItemData";
import ProjectItem from "../../../app/ProjectItem";
import { ProjectItemType } from "../../../app/IProjectItemData";

/** Builds a minimal texture ProjectItem stub with the fields the generator reads. */
function createTextureItem(opts: { packRelativePath: string; name?: string; isTextureSet?: boolean }): ProjectItem {
  const parentItems = opts.isTextureSet ? [{ parentItem: { itemType: ProjectItemType.textureSetJson } }] : [];

  return {
    itemType: ProjectItemType.texture,
    name: opts.name ?? "stone.png",
    isContentLoaded: true,
    loadContent: async () => true,
    parentItems,
    getPackRelativePath: async () => opts.packRelativePath,
  } as unknown as ProjectItem;
}

/** Builds a minimal texture_list.json ProjectItem stub returning the given array. */
function createTextureListItem(entries: unknown): ProjectItem {
  return {
    itemType: ProjectItemType.textureListJson,
    isContentLoaded: true,
    loadContent: async () => true,
    getJsonObject: async () => entries,
  } as unknown as ProjectItem;
}

describe("CheckTextureListGenerator", () => {
  let gen: CheckTextureListGenerator;

  beforeEach(() => {
    gen = new CheckTextureListGenerator();
  });

  it("has expected id and title", () => {
    expect(gen.id).to.equal("TEXTURELIST");
    expect(gen.title).to.equal("Texture List Validation");
  });

  it("skips silently when no texture_list.json is present", async () => {
    const project = createStubProject([createTextureItem({ packRelativePath: "textures/blocks/stone.png" })]);

    const results = await gen.generate(project, new ContentIndex());

    expect(results.length).to.equal(0);
  });

  it("passes when all non-Vibrant Visuals textures are referenced", async () => {
    const project = createStubProject([
      createTextureListItem(["textures/blocks/stone", "textures/items/apple"]),
      createTextureItem({ packRelativePath: "textures/blocks/stone.png" }),
      createTextureItem({ packRelativePath: "textures/items/apple.png", name: "apple.png" }),
    ]);

    const results = await gen.generate(project, new ContentIndex());

    expect(results.length).to.equal(0);
  });

  it("errors when a non-Vibrant Visuals texture is missing from the list", async () => {
    const project = createStubProject([
      createTextureListItem(["textures/blocks/stone"]),
      createTextureItem({ packRelativePath: "textures/blocks/stone.png" }),
      createTextureItem({ packRelativePath: "textures/blocks/dirt.png", name: "dirt.png" }),
    ]);

    const results = await gen.generate(project, new ContentIndex());

    expect(results.length).to.equal(1);
    expect(results[0].itemType).to.equal(InfoItemType.error);
    expect(results[0].generatorIndex).to.equal(CheckTextureListGeneratorTest.textureNotInTextureList);
    expect(results[0].data).to.equal("textures/blocks/dirt");
  });

  it("errors when a texture_set image is incorrectly referenced", async () => {
    const project = createStubProject([
      createTextureListItem(["textures/blocks/stone", "textures/blocks/stone_mer"]),
      createTextureItem({ packRelativePath: "textures/blocks/stone.png" }),
      createTextureItem({
        packRelativePath: "textures/blocks/stone_mer.png",
        name: "stone_mer.png",
        isTextureSet: true,
      }),
    ]);

    const results = await gen.generate(project, new ContentIndex());

    expect(results.length).to.equal(1);
    expect(results[0].itemType).to.equal(InfoItemType.error);
    expect(results[0].generatorIndex).to.equal(CheckTextureListGeneratorTest.textureSetImageInTextureList);
    expect(results[0].data).to.equal("textures/blocks/stone_mer");
  });

  it("does not require Vibrant Visuals textures to be listed", async () => {
    const project = createStubProject([
      createTextureListItem(["textures/blocks/stone"]),
      createTextureItem({ packRelativePath: "textures/blocks/stone.png" }),
      // a _mer companion that is not part of a texture set is VV-related and exempt
      createTextureItem({ packRelativePath: "textures/blocks/stone_mer.png", name: "stone_mer.png" }),
    ]);

    const results = await gen.generate(project, new ContentIndex());

    expect(results.length).to.equal(0);
  });

  it("normalizes path separators, casing, and extensions when comparing", async () => {
    const project = createStubProject([
      createTextureListItem(["Textures/Blocks/Stone.png"]),
      createTextureItem({ packRelativePath: "\\textures\\blocks\\stone.png" }),
    ]);

    const results = await gen.generate(project, new ContentIndex());

    expect(results.length).to.equal(0);
  });
});
