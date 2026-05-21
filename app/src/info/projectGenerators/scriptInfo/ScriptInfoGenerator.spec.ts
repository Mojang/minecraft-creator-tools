// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { assert, expect } from "chai";
import ScriptInfoGenerator from "./ScriptInfoGenerator";
import { ScriptInfoGeneratorTest } from "./ScriptInfoData";
import { createStubProject } from "../../../test/stubs/app/projects/StubProject";
import { createStubProjectItem } from "../../../test/stubs/app/projects/StubProjectItem";
import { createStubFile } from "../../../test/stubs/app/io/StubFile";
import { ProjectItemType } from "../../../app/IProjectItemData";
import ContentIndex from "../../../core/ContentIndex";
import ProjectInfoItem from "../../ProjectInfoItem";
import { InfoItemType } from "../../IInfoItemData";

describe("ScriptInfoGenerator", () => {
  let gen: ScriptInfoGenerator;

  beforeEach(() => {
    gen = new ScriptInfoGenerator();
  });

  it("has expected id and title", () => {
    assert.strictEqual(gen.id, "SCRIPT");
    assert.strictEqual(gen.title, "Script");
  });

  describe("getAllTokens", () => {
    it("returns an empty array for empty content", () => {
      expect(gen.getAllTokens("")).to.deep.equal([]);
    });

    it("returns an empty array for content with only short identifiers (length <= 3)", () => {
      // 'if', 'x', 'ab', 'abc' are all length <= 3 and should be filtered
      expect(gen.getAllTokens("if (x) { ab; }")).to.deep.equal([]);
    });

    it("returns an identifier with length > 3 that is not a common term", () => {
      const tokens = gen.getAllTokens("const World = {};");
      expect(tokens).to.include("World");
    });

    it("does not return identifiers in the CommonTerms list", () => {
      // 'type', 'name', 'value', 'index' etc. are in CommonTerms
      const tokens = gen.getAllTokens("const type = name; let value = index;");
      expect(tokens).to.deep.equal([]);
    });

    it("does not return the 'from' keyword even when it is an identifier", () => {
      // esprima tokenises 'from' in 'import ... from ...' as an Identifier
      const tokens = gen.getAllTokens("import { World } from '@minecraft/server';");
      expect(tokens).to.not.include("from");
    });

    it("returns @minecraft-prefixed string tokens", () => {
      const tokens = gen.getAllTokens("import { World } from '@minecraft/server';");
      expect(tokens).to.include("@minecraft/server");
    });

    it("returns minecraft:-prefixed string tokens", () => {
      // Single-quoted strings are stripped of quotes; double-quoted are not, so use single quotes here
      const tokens = gen.getAllTokens("const id = 'minecraft:stone';");
      expect(tokens).to.include("minecraft:stone");
    });

    it("does not return duplicate tokens for repeated identifiers", () => {
      const tokens = gen.getAllTokens("const World = {}; const World2 = World;");
      const worldCount = tokens.filter((t) => t === "World").length;
      expect(worldCount).to.equal(1);
    });

    it("does not throw for unparseable content", () => {
      // The function has a try/catch around esprima; partially-parsed tokens may still be returned
      expect(() => gen.getAllTokens("!!!{{{{ not valid js ~~~~")).to.not.throw();
    });

    it("does not return non-minecraft string tokens", () => {
      // 'type' is in CommonTerms so it's filtered; "hello world" is a non-minecraft string → not returned
      const tokens = gen.getAllTokens('const type = "hello world";');
      expect(tokens).to.deep.equal([]);
    });
  });

  describe("parseJsContent", () => {
    it("increments the feature counter for a token that is in minecraftTokens", () => {
      gen.minecraftTokens["World"] = {};
      const item = new ProjectInfoItem(
        InfoItemType.featureAggregate,
        "SCRIPT",
        ScriptInfoGeneratorTest.apisUsed,
        "APIs Used"
      );
      gen.parseJsContent(item, "const World = {};");
      const featureSets = item.featureSets;
      expect(featureSets).to.not.be.undefined;
      // incrementFeature runs the key through convertToJsonKey which lowercases the first letter
      expect(featureSets!["world"]).to.not.be.undefined;
    });

    it("does not increment any feature for a token that is not in minecraftTokens", () => {
      // minecraftTokens is empty by default
      const item = new ProjectInfoItem(
        InfoItemType.featureAggregate,
        "SCRIPT",
        ScriptInfoGeneratorTest.apisUsed,
        "APIs Used"
      );
      gen.parseJsContent(item, "const CustomClass = {};");
      expect(item.featureSets).to.be.undefined;
    });
  });

  describe("generate", () => {
    it("returns exactly 1 featureAggregate item for an empty project", async () => {
      const results = await gen.generate(createStubProject(), new ContentIndex());
      expect(results.length).to.equal(1);
      expect(results[0].itemType).to.equal(InfoItemType.featureAggregate);
    });

    it("returns the apisUsed featureAggregate item with correct generatorIndex", async () => {
      const results = await gen.generate(createStubProject(), new ContentIndex());
      expect(results[0].generatorIndex).to.equal(ScriptInfoGeneratorTest.apisUsed);
    });

    it("ignores non-js project items", async () => {
      const nonJsItem = createStubProjectItem({ itemType: ProjectItemType.resourcePackManifestJson });
      const results = await gen.generate(createStubProject([nonJsItem]), new ContentIndex());
      // Still only the one featureAggregate item — the non-js item is skipped entirely
      expect(results.length).to.equal(1);
    });

    it("does not throw and returns 1 item for a js item with no primaryFile", async () => {
      const jsItem = createStubProjectItem({ itemType: ProjectItemType.js, file: undefined });
      const results = await gen.generate(createStubProject([jsItem]), new ContentIndex());
      expect(results.length).to.equal(1);
    });

    it("does not throw and returns 1 item for a js item with null file content", async () => {
      const file = createStubFile({ name: "script.js", content: null });
      const jsItem = createStubProjectItem({ itemType: ProjectItemType.js, file });
      const results = await gen.generate(createStubProject([jsItem]), new ContentIndex());
      expect(results.length).to.equal(1);
    });

    it("processes a js item and increments a known minecraft token in the featureAggregate", async () => {
      // Seed a known token so we don't need a real Database load
      gen.minecraftTokens["World"] = {};
      gen.generatedTokens = true;

      const jsContent = "import { World } from '@minecraft/server'; const w = new World();";
      const file = createStubFile({ name: "script.js", content: jsContent });
      const jsItem = createStubProjectItem({ itemType: ProjectItemType.js, file });
      const results = await gen.generate(createStubProject([jsItem]), new ContentIndex());

      const aggregateItem = results.find((r) => r.generatorIndex === ScriptInfoGeneratorTest.apisUsed);
      expect(aggregateItem).to.not.be.undefined;
      const featureSets = aggregateItem!.featureSets;
      expect(featureSets).to.not.be.undefined;
      // convertToJsonKey lowercases the first character of the feature name
      expect(featureSets!["world"]).to.not.be.undefined;
    });
  });
});
