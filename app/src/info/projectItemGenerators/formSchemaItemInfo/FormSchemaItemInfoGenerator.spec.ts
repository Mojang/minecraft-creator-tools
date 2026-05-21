// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { assert } from "chai";
import FormSchemaItemInfoGenerator from "./FormSchemaItemInfoGenerator";
import { createStubProjectItem } from "../../../test/stubs/app/projects/StubProjectItem";
import { createStubFile } from "../../../test/stubs/app/io/StubFile";
import { ProjectItemType } from "../../../app/IProjectItemData";

describe("FormSchemaItemInfoGenerator", () => {
  const gen = new FormSchemaItemInfoGenerator();

  it("has expected id and title", () => {
    assert.strictEqual(gen.id, "JSONF");
    assert.strictEqual(gen.title, "JSON Structure");
  });

  it("returns empty array when primaryFile is null (modelGeometryJson skips fast-path)", async () => {
    const item = createStubProjectItem({ itemType: ProjectItemType.modelGeometryJson });
    const results = await gen.generate(item, {} as any);
    assert.deepEqual(results, []);
  });

  it("returns empty array when file content is null", async () => {
    const file = createStubFile({ name: "entity.json", content: null });
    const item = createStubProjectItem({ itemType: ProjectItemType.modelGeometryJson, file });
    const results = await gen.generate(item, {} as any);
    assert.deepEqual(results, []);
  });

  it("returns empty array when file content is not a string", async () => {
    const file = createStubFile({ name: "entity.json", content: 42 as any });
    const item = createStubProjectItem({ itemType: ProjectItemType.modelGeometryJson, file });
    const results = await gen.generate(item, {} as any);
    assert.deepEqual(results, []);
  });

  it("returns empty array when getFormPath returns undefined", async () => {
    const file = createStubFile({ name: "test.geo.json", content: '{"format_version":"1.12.0"}' });
    const item = createStubProjectItem({
      itemType: ProjectItemType.modelGeometryJson,
      file,
      getFormPath: () => undefined,
    });
    const results = await gen.generate(item, {} as any);
    assert.deepEqual(results, []);
  });

  describe("testUuid()", () => {
    it("returns true for a valid UUID", () => {
      assert.isTrue(gen.testUuid("11111111-1111-1111-1111-111111111111"));
    });

    it("returns true for a mixed-case UUID", () => {
      assert.isTrue(gen.testUuid("A1B2C3D4-E5F6-7890-abcd-ef1234567890"));
    });

    it("returns false for a string without hyphens", () => {
      assert.isFalse(gen.testUuid("notauuidatall"));
    });

    it("returns false for an empty string", () => {
      assert.isFalse(gen.testUuid(""));
    });
  });

  describe("testUri()", () => {
    it("returns true for a string containing ://", () => {
      assert.isTrue(gen.testUri("https://example.com/path"));
    });

    it("returns false for a plain string without ://", () => {
      assert.isFalse(gen.testUri("not-a-uri"));
    });
  });
});
