// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { assert } from "chai";
import CommunitySchemaItemInfoGenerator, {
  CommunitySchemaItemInfoGeneratorTest,
} from "./CommunitySchemaItemInfoGenerator";
import { createStubProjectItem } from "../../../test/stubs/app/projects/StubProjectItem";
import { createStubFile } from "../../../test/stubs/app/io/StubFile";
import { ProjectItemType } from "../../../app/IProjectItemData";
import { InfoItemType } from "../../IInfoItemData";

// unknownJson is not handled by MinecraftDefinitions.get(), so formatVersionIsCurrent()
// returns true without any file parsing or I/O — safe to use in unit tests.
const STUB_ITEM_TYPE = ProjectItemType.unknownJson;
const STUB_SCHEMA_PATH = "test/stub.schema.json";
const SIMPLE_SCHEMA = {
  type: "object",
  properties: { name: { type: "string" } },
  additionalProperties: false,
};

describe("CommunitySchemaItemInfoGenerator", () => {
  let gen: CommunitySchemaItemInfoGenerator;

  beforeEach(() => {
    gen = new CommunitySchemaItemInfoGenerator();
    // Pre-populate the schema cache so Database.getCommunitySchema is never called.
    gen._schemaContentByPath[STUB_SCHEMA_PATH] = SIMPLE_SCHEMA as any;
  });

  it("has expected id and title", () => {
    assert.strictEqual(gen.id, "COMJSON");
    assert.strictEqual(gen.title, "Community JSON Schema Validation");
  });

  it("returns empty array when primaryFile is null", async () => {
    const item = createStubProjectItem({ itemType: STUB_ITEM_TYPE });
    assert.deepEqual(await gen.generate(item, {} as any), []);
  });

  // Consolidates: "null content" and "non-string content" both hit the same guard.
  const invalidContentCases = [null, 42 as any];
  for (const content of invalidContentCases) {
    it(`returns empty array when file content is ${content}`, async () => {
      const file = createStubFile({ name: "entity.json", content });
      const item = createStubProjectItem({ itemType: STUB_ITEM_TYPE, file });
      assert.deepEqual(await gen.generate(item, {} as any), []);
    });
  }

  // Consolidates: null and undefined getCommunitySchemaPath both short-circuit identically.
  const noSchemaPathCases = [() => null, () => undefined] as const;
  for (const getCommunitySchemaPath of noSchemaPathCases) {
    it(`returns empty array when getCommunitySchemaPath returns ${getCommunitySchemaPath()}`, async () => {
      const file = createStubFile({ name: "entity.json", content: '{"name":"steve"}' });
      const item = createStubProjectItem({ itemType: STUB_ITEM_TYPE, file, getCommunitySchemaPath });
      assert.deepEqual(await gen.generate(item, {} as any), []);
    });
  }

  it("returns empty array when JSON is valid and matches schema", async () => {
    const file = createStubFile({ name: "entity.json", content: '{"name":"steve"}' });
    const item = createStubProjectItem({
      itemType: STUB_ITEM_TYPE,
      file,
      getCommunitySchemaPath: () => STUB_SCHEMA_PATH,
    });
    assert.deepEqual(await gen.generate(item, {} as any), []);
  });

  it("returns warning items when JSON violates schema constraints", async () => {
    // "name" must be a string; passing a number triggers a schema warning.
    const file = createStubFile({ name: "entity.json", content: '{"name":42}' });
    const item = createStubProjectItem({
      itemType: STUB_ITEM_TYPE,
      file,
      getCommunitySchemaPath: () => STUB_SCHEMA_PATH,
    });
    const results = await gen.generate(item, {} as any);
    assert.isAbove(results.length, 0, "expected at least one warning");
    assert.isTrue(results.every((r) => r.itemType === InfoItemType.warning));
  });

  it("returns an error item when JSON cannot be parsed", async () => {
    const file = createStubFile({ name: "entity.json", content: "{ not valid json }" });
    const item = createStubProjectItem({
      itemType: STUB_ITEM_TYPE,
      file,
      getCommunitySchemaPath: () => STUB_SCHEMA_PATH,
    });
    const results = await gen.generate(item, {} as any);
    assert.lengthOf(results, 1);
    assert.strictEqual(results[0].itemType, InfoItemType.error);
    assert.strictEqual(results[0].generatorIndex, CommunitySchemaItemInfoGeneratorTest.couldNotParseJson);
  });
});
