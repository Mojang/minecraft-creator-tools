// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { assert } from "chai";
import UnknownFileGenerator from "./UnknownFileGenerator";
import { UnknownFileGeneratorTest } from "./UnknownFileData";
import { createStubFile } from "../../../test/stubs/app/io/StubFile";
import { createStubProject } from "../../../test/stubs/app/projects/StubProject";
import { InfoItemType } from "../../IInfoItemData";

const project = createStubProject();
const noOpContentIndex = { insert: () => {} } as any;

describe("UnknownFileGenerator", () => {
  const gen = new UnknownFileGenerator();

  it("has expected id and title", () => {
    assert.strictEqual(gen.id, "UNKFILE");
    assert.strictEqual(gen.title, "Unknown files");
  });

  it("returns [] for a file with a known extension", async () => {
    const file = createStubFile({ name: "manifest.json" });
    const results = await gen.generate(project, file, noOpContentIndex);
    assert.deepEqual(results, []);
  });

  it("emits unknownTypeFileFound error for a file with unknown extension", async () => {
    const file = createStubFile({ name: "data.xyz" });
    const results = await gen.generate(project, file, noOpContentIndex);

    assert.lengthOf(results, 1);
    assert.strictEqual(results[0].itemType, InfoItemType.error);
    assert.strictEqual(results[0].generatorIndex, UnknownFileGeneratorTest.unknownTypeFileFound);
  });
});
