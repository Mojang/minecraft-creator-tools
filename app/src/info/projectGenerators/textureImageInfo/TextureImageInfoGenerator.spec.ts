// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { assert, expect } from "chai";
import TextureImageInfoGenerator, {
  TextureImageInfoGeneratorTest,
  TexturePerformanceTierCount,
} from "./TextureImageInfoGenerator";
import { createStubProject } from "../../../test/stubs/app/projects/StubProject";
import ContentIndex from "../../../core/ContentIndex";
import { InfoItemType } from "../../IInfoItemData";
import { createStubProjectItem } from "../../../test/stubs/app/projects/StubProjectItem";
import { ProjectItemType } from "../../../app/IProjectItemData";
import ImageCodecNode from "../../../local/ImageCodecNode";
import { createStubFile } from "../../../test/stubs/app/io/StubFile";
import ProjectItem from "../../../app/ProjectItem";

function createPngTextureItem(
  name: string,
  width: number,
  height: number,
  projectPath = `/resource_pack/textures/ui/${name}`,
  variantProjectPath = projectPath
): ProjectItem {
  const pngData = ImageCodecNode.encodeToPng(new Uint8Array(width * height * 4), width, height);

  expect(pngData, `Failed to encode test PNG ${name}`).to.not.be.undefined;

  const file = createStubFile({
    name,
    content: pngData!,
    isString: false,
    type: "png",
    extendedPath: variantProjectPath,
  });

  const projectItem = createStubProjectItem({
    file,
    itemType: ProjectItemType.texture,
    name,
    projectPath,
  });

  return {
    ...projectItem,
    getVariantList: () => [
      {
        label: "",
        file,
        projectPath: variantProjectPath,
        projectVariant: { isDefault: true },
      },
    ],
    getPackRelativePath: async () => `textures/ui/${name}`,
  } as unknown as ProjectItem;
}

describe("TextureImageInfoGenerator", () => {
  let gen: TextureImageInfoGenerator;

  beforeEach(() => {
    gen = new TextureImageInfoGenerator();
  });

  it("has expected id and title", () => {
    assert.strictEqual(gen.id, "TEXTUREIMAGE");
    assert.strictEqual(gen.title, "Texture Image Validation");
  });

  describe("isGameTexturePath", () => {
    it("should identify a block texture as a game texture", () => {
      expect(TextureImageInfoGenerator.isGameTexturePath("/resource_pack/textures/blocks/stone.png")).to.be.true;
    });

    it("should identify an entity texture as a game texture", () => {
      expect(TextureImageInfoGenerator.isGameTexturePath("/resource_pack/textures/entity/creeper/creeper.png")).to.be
        .true;
    });

    it("should identify an item texture as a game texture", () => {
      expect(TextureImageInfoGenerator.isGameTexturePath("/resource_pack/textures/items/diamond.png")).to.be.true;
    });

    it("should identify a .tga block texture as a game texture", () => {
      expect(TextureImageInfoGenerator.isGameTexturePath("/resource_pack/textures/blocks/dirt.tga")).to.be.true;
    });

    it("should not identify a path outside of resource_pack/textures/ as a game texture", () => {
      expect(TextureImageInfoGenerator.isGameTexturePath("/behavior_pack/textures/blocks/stone.png")).to.be.false;
    });

    it("should not identify a MER texture as a game texture", () => {
      expect(TextureImageInfoGenerator.isGameTexturePath("/resource_pack/textures/blocks/stone_mer.png")).to.be.false;
    });

    it("should not identify a MERS texture as a game texture", () => {
      expect(TextureImageInfoGenerator.isGameTexturePath("/resource_pack/textures/blocks/stone_mers.png")).to.be.false;
    });

    it("should not identify a normal map texture as a game texture", () => {
      expect(TextureImageInfoGenerator.isGameTexturePath("/resource_pack/textures/blocks/stone_normal.png")).to.be
        .false;
    });

    it("should not identify a mipmap texture as a game texture", () => {
      expect(TextureImageInfoGenerator.isGameTexturePath("/resource_pack/textures/blocks/stone_mipmap.png")).to.be
        .false;
    });

    it("should not identify a texture outside blocks/entity/items as a game texture", () => {
      expect(TextureImageInfoGenerator.isGameTexturePath("/resource_pack/textures/environment/moon_phases.png")).to.be
        .false;
    });

    it("should not identify a UI texture as a game texture (exempt path)", () => {
      expect(TextureImageInfoGenerator.isGameTexturePath("/resource_pack/textures/ui/loading_bg.png")).to.be.false;
    });

    it("should not identify an NPC entity texture as a game texture (exempt path)", () => {
      expect(TextureImageInfoGenerator.isGameTexturePath("/resource_pack/textures/entity/npc/default.png")).to.be.false;
    });

    it("should not identify particle textures as game textures (exempt path)", () => {
      expect(TextureImageInfoGenerator.isGameTexturePath("/resource_pack/textures/particle/explosion.png")).to.be.false;
    });

    it("should be case-insensitive", () => {
      expect(TextureImageInfoGenerator.isGameTexturePath("/Resource_Pack/Textures/Blocks/Stone.PNG")).to.be.true;
    });
  });

  describe("generate", () => {
    it("should return 1 + TexturePerformanceTierCount featureAggregate items for an empty project", async () => {
      const results = await gen.generate(createStubProject(), new ContentIndex());
      const aggregateItems = results.filter((r) => r.itemType === InfoItemType.featureAggregate);
      expect(aggregateItems.length).to.equal(1 + TexturePerformanceTierCount);
    });

    it("should include the top-level textureImages featureAggregate item", async () => {
      const results = await gen.generate(createStubProject(), new ContentIndex());
      const textureImagesItem = results.find((r) => r.generatorIndex === TextureImageInfoGeneratorTest.textureImages);
      expect(textureImagesItem).to.not.be.undefined;
      expect(textureImagesItem!.itemType).to.equal(InfoItemType.featureAggregate);
    });

    it("should include a tier featureAggregate item for each of the 6 performance tiers", async () => {
      const results = await gen.generate(createStubProject(), new ContentIndex());
      for (let tier = 0; tier < TexturePerformanceTierCount; tier++) {
        const tierItem = results.find(
          (r) => r.generatorIndex === TextureImageInfoGeneratorTest.textureImagesTier0 + tier
        );
        expect(tierItem, `tier ${tier} featureAggregate item should exist`).to.not.be.undefined;
        expect(tierItem!.itemType).to.equal(InfoItemType.featureAggregate);
      }
    });

    it("should return no error or warning items for an empty project", async () => {
      const results = await gen.generate(createStubProject(), new ContentIndex());
      const nonAggregate = results.filter((r) => r.itemType !== InfoItemType.featureAggregate);
      expect(nonAggregate.length).to.equal(0);
    });

    it("warns only when a texture's highest-resolution mip exceeds 4 MiB", async () => {
      const atLimit = createPngTextureItem("texture_at_limit.png", 1024, 1024);
      const overLimitPath = "/resource_pack/subpacks/hd/textures/ui/texture_over_limit.png";
      const overLimit = createPngTextureItem(
        "texture_over_limit.png",
        1025,
        1024,
        "/resource_pack/textures/ui/texture_over_limit.png",
        overLimitPath
      );
      const project = createStubProject([atLimit, overLimit]);

      const results = await gen.generate(project, new ContentIndex());
      const warnings = results.filter(
        (item) => item.itemType === InfoItemType.warning && item.message?.includes("highest-resolution mip")
      );

      expect(warnings.length).to.equal(1);
      expect(warnings[0].projectItemPath).to.equal(overLimitPath);
      expect(warnings[0].message).to.include(overLimitPath);
      expect(warnings[0].message).to.include("4 MiB");
      expect(warnings[0].data).to.equal(1025 * 1024 * 4);
    });
  });
});
