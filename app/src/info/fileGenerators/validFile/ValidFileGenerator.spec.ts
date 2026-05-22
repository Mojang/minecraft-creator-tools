// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { assert } from "chai";
import ValidFileGenerator from "./ValidFileGenerator";
import { ValidGeneratorTest } from "./ValidFileData";
import { createStubFile } from "../../../test/stubs/app/io/StubFile";
import { createStubProject } from "../../../test/stubs/app/projects/StubProject";
import { InfoItemType } from "../../IInfoItemData";

const project = createStubProject();
const noOpContentIndex = { insert: () => {} } as any;

describe("ValidFileGenerator", () => {
  const gen = new ValidFileGenerator();

  it("has expected id and title", () => {
    assert.strictEqual(gen.id, "VALFILE");
    assert.strictEqual(gen.title, "Valid files");
  });

  const cases = [
    {
      label: "non-JSON file returns no errors",
      file: () => createStubFile({ name: "texture.png", content: new Uint8Array([1, 2, 3]) }),
      expectedErrors: 0,
    },
    {
      label: "JSON file with valid content returns no errors",
      file: () => createStubFile({ name: "manifest.json", content: '{"format_version": 2}' }),
      expectedErrors: 0,
    },
    {
      label: "JSON file with empty string content emits emptyJson error",
      file: () => createStubFile({ name: "empty.json", content: "" }),
      expectedErrors: 1,
      expectedIndex: ValidGeneratorTest.emptyJson,
    },
    {
      label: "JSON file with single-character content emits emptyJson error",
      file: () => createStubFile({ name: "short.json", content: "{" }),
      expectedErrors: 1,
      expectedIndex: ValidGeneratorTest.emptyJson,
    },
    {
      label: "JSON file with binary (non-string) content emits jsonNotString error",
      file: () => createStubFile({ name: "binary.json", content: new Uint8Array([0x7b, 0x7d]), isString: false }),
      expectedErrors: 1,
      expectedIndex: ValidGeneratorTest.jsonNotString,
    },
    {
      label: "JSON file with invalid JSON content emits nonCompliantJson error",
      file: () => createStubFile({ name: "broken.json", content: "{ broken json :" }),
      expectedErrors: 1,
      expectedIndex: ValidGeneratorTest.nonCompliantJson,
    },
  ];

  for (const { label, file, expectedErrors, expectedIndex } of cases) {
    it(label, async () => {
      const stub = file();
      const results = await gen.generate(project, stub, noOpContentIndex);
      const errors = results.filter((r) => r.itemType === InfoItemType.error);
      assert.lengthOf(errors, expectedErrors);
      if (expectedIndex !== undefined) {
        assert.strictEqual(errors[0].generatorIndex, expectedIndex);
      }
    });
  }
});
