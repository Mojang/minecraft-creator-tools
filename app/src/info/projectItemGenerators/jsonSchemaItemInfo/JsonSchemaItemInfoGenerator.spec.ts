// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { assert } from "chai";
import JsonSchemaItemInfoGenerator from "./JsonSchemaItemInfoGenerator";
import { createStubProjectItem } from "../../../test/stubs/app/projects/StubProjectItem";
import { createStubFile } from "../../../test/stubs/app/io/StubFile";

const noOpContentIndex = { insert: () => {} } as any;

describe("JsonSchemaItemInfoGenerator", () => {
  const gen = new JsonSchemaItemInfoGenerator();

  it("has expected id and title", () => {
    assert.strictEqual(gen.id, "JSON");
    assert.strictEqual(gen.title, "JSON Schema Validation");
  });

  it("returns empty array when item has no primaryFile", async () => {
    const item = createStubProjectItem({ file: undefined });
    const results = await gen.generate(item, noOpContentIndex);
    assert.deepEqual(results, []);
  });

  it("returns empty array when primaryFile content is null", async () => {
    const file = createStubFile({ name: "entity.json", content: null });
    const item = createStubProjectItem({ file });
    const results = await gen.generate(item, noOpContentIndex);
    assert.deepEqual(results, []);
  });

  it("returns empty array when primaryFile content is a Uint8Array", async () => {
    const file = createStubFile({ name: "entity.png", content: new Uint8Array([1, 2, 3]) });
    const item = createStubProjectItem({ file });
    const results = await gen.generate(item, noOpContentIndex);
    assert.deepEqual(results, []);
  });

  it("returns empty array when getOfficialSchemaPath returns undefined", async () => {
    const file = createStubFile({ name: "entity.json", content: '{"format_version":"1.20.0"}' });
    const item = createStubProjectItem({
      file,
      getOfficialSchemaPath: () => undefined,
    });
    const results = await gen.generate(item, noOpContentIndex);
    assert.deepEqual(results, []);
  });
});
