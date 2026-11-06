// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Subpack copies of a pack path are folded into one ProjectItem as variants, so primaryFile can
 * belong to any of them. These tests infer a real in-memory project to cover code that has to look
 * past primaryFile to the variant files.
 */

import "../app/CreatorToolsHost";
import { assert } from "chai";
import Project from "../app/Project";
import IProjectItemData, { ProjectItemStorageType, ProjectItemType } from "../app/IProjectItemData";
import { ProjectItemVariantType } from "../app/IProjectItemVariant";
import ContentIndex from "../core/ContentIndex";
import CheckTextureListGenerator, {
  CheckTextureListGeneratorTest,
} from "../info/projectGenerators/checkTextureList/CheckTextureListGenerator";
import IFolder from "../storage/IFolder";
import IProjectItemRelationship from "../app/IProjectItemRelationship";
import EntityTypeResourceDefinition from "../minecraft/EntityTypeResourceDefinition";
import StorageUtilities from "../storage/StorageUtilities";
import ZipStorage from "../storage/ZipStorage";
import TestPaths from "./TestPaths";

function addResourcePack(root: IFolder, name: string, textureList?: string[]) {
  const pack = root.ensureFolder("resource_packs").ensureFolder(name);
  const uuid = (n: number) => `1d1f7ae0-0000-4000-8000-${name.length}${n}`.padEnd(36, "0");

  pack.ensureFile("manifest.json").setContent(
    JSON.stringify({
      format_version: 2,
      header: { name, uuid: uuid(1), version: [1, 0, 0], min_engine_version: [1, 21, 0] },
      modules: [{ type: "resources", uuid: uuid(2), version: [1, 0, 0] }],
    })
  );

  if (textureList) {
    pack.ensureFile("texture_list.json").setContent(JSON.stringify(textureList));
  }

  return pack;
}

function addTexture(packOrSubpack: IFolder, name: string) {
  packOrSubpack
    .ensureFolder("textures")
    .ensureFile(name + ".png")
    .setContent(new Uint8Array([1]));
}

async function inferProject(root: IFolder) {
  const env = await TestPaths.createTestEnvironment();
  const project = new Project(env.creatorTools, "subpackvariants", null);
  project.setProjectFolder(root);
  await project.inferProjectItemsFromFiles();

  return project;
}

describe("Subpack texture variants", function () {
  this.timeout(20000);

  it("resolve from the active subpack even when primaryFile is a sibling's copy", async () => {
    const root = new ZipStorage().rootFolder;
    const pack = addResourcePack(root, "test_rp");
    const subpacks = pack.ensureFolder("subpacks");
    const low = subpacks.ensureFolder("low");
    const high = subpacks.ensureFolder("high");
    addTexture(low, "pig");
    addTexture(high, "pig");
    addTexture(low, "cow");
    addTexture(pack, "sheep");

    const project = await inferProject(root);
    const textures = project.getItemsByType(ProjectItemType.texture);
    const pig = textures.find((item) => item.projectPath?.endsWith("/pig.png"));
    assert.equal(pig?.primaryFile?.parentFolder.parentFolder, low, "the pig item's primary file is low's copy");

    const resolved = await StorageUtilities.resolvePackPathCandidates(
      textures,
      high,
      ["textures/pig", "textures/cow", "textures/sheep"],
      (file) => StorageUtilities.getBaseRelativePath(file, high)
    );

    assert.sameMembers(
      resolved.matches.map((item) => item.projectPath),
      ["/resource_packs/test_rp/textures/pig.png", "/resource_packs/test_rp/textures/sheep.png"]
    );
    assert.deepEqual(resolved.unmatched, ["textures/cow"], "a sibling-only texture stays unmatched");
  });

  it("resolve items rebuilt from saved data only against files that exist", async () => {
    const root = new ZipStorage().rootFolder;
    const pack = addResourcePack(root, "test_rp", []);
    const subpacks = pack.ensureFolder("subpacks");
    const high = subpacks.ensureFolder("high");
    addTexture(subpacks.ensureFolder("low"), "pig");
    addTexture(high, "horse");
    addTexture(pack, "sheep");

    // Items rebuilt from saved project data, with no files bound yet. cow's high copy and goat's
    // root file were deleted after the data was saved.
    const env = await TestPaths.createTestEnvironment();
    const project = new Project(env.creatorTools, "persistedvariants", null);
    project.setProjectFolder(root);
    const createItem = (itemType: ProjectItemType, path: string, variants: IProjectItemData["variants"] = {}) =>
      project.createItem({
        itemType,
        projectPath: "/resource_packs/test_rp/" + path,
        storageType: ProjectItemStorageType.singleFile,
        name: path.substring(path.lastIndexOf("/") + 1),
        tags: [],
        variants,
      });
    const texture = (name: string, subpackNames: string[] = []) => {
      const variants: IProjectItemData["variants"] = {};

      for (const subpack of subpackNames) {
        variants[subpack] = {
          label: subpack,
          variantType: ProjectItemVariantType.subPack,
          projectPath: `/resource_packs/test_rp/subpacks/${subpack}/textures/${name}.png`,
        };
      }

      return createItem(ProjectItemType.texture, `textures/${name}.png`, variants);
    };
    const items = [texture("pig", ["low"]), texture("horse", ["high"]), texture("cow", ["high"])];
    const sheep = texture("sheep");
    const goat = texture("goat");

    const resolved = await StorageUtilities.resolvePackPathCandidates(
      [...items, sheep, goat],
      high,
      ["textures/pig", "textures/horse", "textures/cow", "textures/sheep", "textures/goat"],
      (file) => StorageUtilities.getBaseRelativePath(file, high)
    );

    assert.deepEqual(resolved.matches, [items[1], sheep], "high's own copy and the parent's copy resolve");
    assert.deepEqual(
      resolved.unmatched,
      ["textures/pig", "textures/cow", "textures/goat"],
      "a sibling's copy, a deleted variant, and a deleted default don't resolve"
    );

    createItem(ProjectItemType.resourcePackManifestJson, "manifest.json");
    createItem(ProjectItemType.textureListJson, "texture_list.json");
    const results = await new CheckTextureListGenerator().generate(project, new ContentIndex());

    assert.sameMembers(
      results.map((result) => result.data),
      ["textures/pig", "textures/horse", "textures/sheep"],
      "the empty texture_list.json flags existing textures but not deleted ones"
    );
  });

  it("resolve generated textures that aren't saved yet", async () => {
    const root = new ZipStorage().rootFolder;
    const pack = addResourcePack(root, "test_rp", []);
    addTexture(pack, "pig");
    const project = await inferProject(root);
    const pig = project.getItemsByType(ProjectItemType.texture)[0];
    const pigFile = pig.primaryFile!;

    // A generated image holds new PNG content that isn't in storage yet, as on a filesystem
    // before the project is saved.
    pigFile.setContent(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    pigFile.exists = async () => false;
    assert.isTrue(pigFile.needsSave, "the generated content is pending");

    const resolved = await StorageUtilities.resolvePackPathCandidates([pig], pack, ["textures/pig"], (file) =>
      StorageUtilities.getBaseRelativePath(file, pack)
    );
    assert.deepEqual(resolved.matches, [pig], "the pending texture resolves");

    const results = await new CheckTextureListGenerator().generate(project, new ContentIndex());
    assert.deepEqual(
      results.map((result) => result.data),
      ["textures/pig"],
      "texture_list.json checks the pending texture"
    );
  });

  it("unlink a subpack's reference even when primaryFile is a sibling's copy", async () => {
    const root = new ZipStorage().rootFolder;
    const subpacks = addResourcePack(root, "test_rp").ensureFolder("subpacks");
    const low = subpacks.ensureFolder("low");
    const high = subpacks.ensureFolder("high");
    addTexture(low, "pig");
    addTexture(high, "pig");
    addTexture(low, "cow");
    const entityFile = high.ensureFolder("entity").ensureFile("demo.entity.json");
    entityFile.setContent(
      JSON.stringify({
        format_version: "1.10.0",
        "minecraft:client_entity": {
          description: { identifier: "demo:mob", textures: { default: "textures/pig", other: "textures/cow" } },
        },
      })
    );

    const textures = (await inferProject(root)).getItemsByType(ProjectItemType.texture);
    const textureItem = (name: string) => textures.find((item) => item.projectPath?.endsWith(`/${name}.png`))!;
    assert.equal(
      textureItem("pig").primaryFile?.parentFolder.parentFolder,
      low,
      "the pig item's primary file is low's"
    );

    const entity = await EntityTypeResourceDefinition.ensureOnFile(entityFile);
    for (const name of ["pig", "cow"]) {
      await entity!.deleteLinkToChild({
        parentItem: { childItems: [] },
        childItem: textureItem(name),
      } as unknown as IProjectItemRelationship);
    }

    assert.deepEqual(
      (JSON.parse(entityFile.content as string) as any)["minecraft:client_entity"].description.textures,
      { other: "textures/cow" },
      "high's pig reference is removed; a sibling-only cow texture doesn't match it"
    );
  });

  it("checks subpack-only textures against their pack's texture_list.json", async () => {
    const root = new ZipStorage().rootFolder;
    const pack = addResourcePack(root, "test_rp", ["textures/cow"]);
    addTexture(pack, "cow");
    addTexture(pack.ensureFolder("subpacks").ensureFolder("high"), "pig");
    addTexture(addResourcePack(root, "other_rp"), "goat");

    const generate = async () =>
      (await new CheckTextureListGenerator().generate(await inferProject(root), new ContentIndex())).map(
        (result) => `${result.generatorIndex}:${result.data}`
      );

    assert.deepEqual(await generate(), [`${CheckTextureListGeneratorTest.textureNotInTextureList}:textures/pig`]);

    pack.ensureFile("texture_list.json").setContent(JSON.stringify(["textures/cow", "textures/pig"]));
    assert.deepEqual(await generate(), []);
  });
});
