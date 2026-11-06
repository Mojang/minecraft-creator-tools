// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { assert, expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import JsonFileTagsInfoGenerator, { JsonFileTagsInfoGeneratorTest } from "./JsonFileTagsInfoGenerator";
import ProjectInfoItem from "../../ProjectInfoItem";
import ProjectInfoSet from "../../ProjectInfoSet";
import { createStubProject } from "../../../test/stubs/app/projects/StubProject";
import { createStubFolder } from "../../../test/stubs/app/io/StubFolder";
import { createStubFile } from "../../../test/stubs/app/io/StubFile";

const noOpContentIndex = { insert: () => {} } as any;

const vanillaBiomesRoot = path.join(__dirname, "../../../../public/res/latest/van/release/behavior_pack/biomes/");

const baseBiomeComponents = {
  "minecraft:climate": { temperature: 0.5, downfall: 0.0 },
  "minecraft:tags": { tags: ["overworld", "custom"] },
};

const replacingPlains = {
  replacements: [
    { dimension: "minecraft:overworld", targets: ["minecraft:plains"], amount: 0.5, noise_frequency_scale: 25 },
  ],
};

function biomeJson(components: Record<string, unknown>, root: string = "minecraft:biome"): string {
  return JSON.stringify({
    format_version: "1.21.110",
    [root]: { description: { identifier: "custom:test_biome" }, components },
  });
}

/** A project whose root folder holds the given files, keyed by their pack-relative path. */
function projectWithFiles(files: Record<string, string>) {
  const folder = createStubFolder();

  for (const [filePath, content] of Object.entries(files)) {
    (folder.files as Record<string, unknown>)[filePath] = createStubFile({ name: filePath, content });
  }

  return createStubProject([], [], { projectFolder: folder });
}

/** Runs the generator and its summarize step the way ProjectInfoSet does, returning both halves of the report. */
async function report(gen: JsonFileTagsInfoGenerator, files: Record<string, string>) {
  const items = await gen.generate(projectWithFiles(files), noOpContentIndex);
  const info: any = {};
  const infoSet = {
    getItems: (generatorId: string, index: number) =>
      items.filter((item) => item.generatorId === generatorId && item.generatorIndex === index),
  } as unknown as ProjectInfoSet;

  gen.summarize(info, infoSet);

  return { items, info };
}

function biomeBehaviorItems(items: ProjectInfoItem[]) {
  return items.filter((item) => item.generatorIndex === JsonFileTagsInfoGeneratorTest.biomeBehaviorType);
}

describe("JsonFileTagsInfoGenerator", () => {
  const gen = new JsonFileTagsInfoGenerator();

  it("has expected id and title", () => {
    assert.strictEqual(gen.id, "JSONTAGS");
    assert.strictEqual(gen.title, "JSON Tags");
  });

  it("returns empty array when project has no projectFolder", async () => {
    const project = createStubProject([], [], { projectFolder: undefined });
    const results = await gen.generate(project, noOpContentIndex);
    assert.deepEqual(results, []);
  });

  // `info.biomeBehaviorTypeComponents` is what Auger indexes, so whether
  // `minecraftReplaceBiomes` appears there is the contract for "this pack
  // uses replace biomes". Declaring the component is not the same as using
  // it: only a replacement that names a target biome counts.
  describe("replace biomes usage", () => {
    it("reports minecraftReplaceBiomes for a biome that replaces a target biome", async () => {
      const { items, info } = await report(gen, {
        "/behavior_pack/biomes/crystal.json": biomeJson({
          ...baseBiomeComponents,
          "minecraft:replace_biomes": replacingPlains,
        }),
      });

      const biomes = biomeBehaviorItems(items);
      expect(biomes).to.have.length(1);
      expect(biomes[0].featureSets?.biomeComponents?.minecraftReplaceBiomes).to.equal(1);
      expect(biomes[0].featureSets).to.not.have.property("biomeComponentsDeclaredWithoutUse");
      expect(info.biomeBehaviorTypeComponents).to.deep.equal([
        "minecraftClimate",
        "minecraftReplaceBiomes",
        "minecraftTags",
      ]);
    });

    it("lists the token once however many biomes replace something", async () => {
      const { items, info } = await report(gen, {
        "/behavior_pack/biomes/one.json": biomeJson({
          ...baseBiomeComponents,
          "minecraft:replace_biomes": replacingPlains,
        }),
        "/behavior_pack/biomes/two.json": biomeJson({
          "minecraft:replace_biomes": {
            replacements: [{ dimension: "minecraft:overworld", targets: ["minecraft:desert"], amount: 0.2 }],
          },
        }),
      });

      expect(
        biomeBehaviorItems(items).map((item) => item.featureSets?.biomeComponents?.minecraftReplaceBiomes)
      ).to.deep.equal([1, 1]);
      expect(
        info.biomeBehaviorTypeComponents.filter((token: string) => token === "minecraftReplaceBiomes")
      ).to.have.length(1);
    });

    it("a custom biome without the component reports its other components only", async () => {
      const { items, info } = await report(gen, {
        "/behavior_pack/biomes/plain_custom.json": biomeJson(baseBiomeComponents),
      });

      expect(biomeBehaviorItems(items)).to.have.length(1);
      expect(biomeBehaviorItems(items)[0].featureSets?.biomeComponents).to.not.have.property("minecraftReplaceBiomes");
      expect(info.biomeBehaviorTypeComponents).to.deep.equal(["minecraftClimate", "minecraftTags"]);
    });

    it("a project with no biome definitions reports an empty list", async () => {
      const { items, info } = await report(gen, {
        "/behavior_pack/entities/robot.json": JSON.stringify({
          "minecraft:entity": { components: { "minecraft:health": { value: 10 } } },
        }),
      });

      expect(biomeBehaviorItems(items)).to.have.length(0);
      expect(info.biomeBehaviorTypeComponents).to.deep.equal([]);
      expect(info.entityTypeComponents).to.include("minecraftHealth");
    });

    it("a client biome file is never a behavior biome, whatever it declares", async () => {
      const { items, info } = await report(gen, {
        "/resource_pack/biomes/crystal.json": biomeJson(
          { "minecraft:fog_appearance": { fog_identifier: "custom:fog" }, "minecraft:replace_biomes": replacingPlains },
          "minecraft:client_biome"
        ),
      });

      expect(biomeBehaviorItems(items)).to.have.length(0);
      expect(info.biomeBehaviorTypeComponents).to.deep.equal([]);
      expect(info.biomeClientTypeComponents).to.include("minecraftFogAppearance");
    });

    it("no shipped vanilla biome definition counts as usage", async () => {
      const files: Record<string, string> = {};

      for (const name of fs.readdirSync(vanillaBiomesRoot)) {
        if (name.endsWith(".json")) {
          files["/behavior_pack/biomes/" + name] = fs.readFileSync(vanillaBiomesRoot + name, "utf8");
        }
      }

      const { items, info } = await report(gen, files);

      expect(biomeBehaviorItems(items).length).to.be.greaterThan(50);
      expect(info.biomeBehaviorTypeComponents).to.include("minecraftClimate");
      expect(info.biomeBehaviorTypeComponents).to.not.include("minecraftReplaceBiomes");
    });

    for (const [label, component] of [
      ["an empty replacements list", { replacements: [] }],
      ["no replacements key", {}],
      [
        "a replacement with no targets",
        { replacements: [{ dimension: "minecraft:overworld", targets: [], amount: 0.5 }] },
      ],
      ["a replacement with a non-list targets value", { replacements: [{ targets: "minecraft:plains" }] }],
      ["a non-object component value", true],
    ] as [string, unknown][]) {
      it(`a declaration with ${label} is not usage, and is counted as declared without use`, async () => {
        const { items, info } = await report(gen, {
          "/behavior_pack/biomes/hollow.json": biomeJson({
            ...baseBiomeComponents,
            "minecraft:replace_biomes": component,
          }),
        });

        const biome = biomeBehaviorItems(items)[0];
        expect(biome.featureSets?.biomeComponents).to.not.have.property("minecraftReplaceBiomes");
        expect(biome.featureSets?.biomeComponentsDeclaredWithoutUse?.minecraftReplaceBiomes).to.equal(1);
        expect(info.biomeBehaviorTypeComponents).to.deep.equal(["minecraftClimate", "minecraftTags"]);
      });
    }

    it("one real replacement among empty ones is still usage", async () => {
      const { items, info } = await report(gen, {
        "/behavior_pack/biomes/mixed.json": biomeJson({
          "minecraft:replace_biomes": {
            replacements: [
              { targets: [] },
              { dimension: "minecraft:overworld", targets: ["minecraft:taiga"], amount: 0.1 },
            ],
          },
        }),
      });

      expect(biomeBehaviorItems(items)[0].featureSets?.biomeComponents?.minecraftReplaceBiomes).to.equal(1);
      expect(info.biomeBehaviorTypeComponents).to.deep.equal(["minecraftReplaceBiomes"]);
    });
  });
});
