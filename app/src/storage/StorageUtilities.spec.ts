// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { assert } from "chai";
import JsonUtilities from "../core/JsonUtilities";
import StorageUtilities from "./StorageUtilities";
import ZipStorage from "./ZipStorage";

describe("StorageUtilities.setJsonObjectWithComments", () => {
  const original = `{
  // Header comment
  "format_version": 2,
  "header": {
    "name": "pack", // inline comment
    "min_engine_version": [1, 20, 10] /* block comment */
  }
}`;

  function fileWithContent(content: string) {
    const file = new ZipStorage().rootFolder.ensureFile("manifest.json");
    file.setContent(content);

    return file;
  }

  it("writes edits made to the file's cached object and keeps every comment", () => {
    const file = fileWithContent(original);
    const manifest = StorageUtilities.getJsonObjectWithComments(file);
    manifest.header.min_engine_version = [1, 26, 50];

    assert.isTrue(StorageUtilities.setJsonObjectWithComments(file, manifest));

    const content = file.content as string;
    for (const comment of ["// Header comment", "// inline comment", "/* block comment */"]) {
      assert.include(content, comment);
    }
    const written = JsonUtilities.parseJsonWithComments(content) as unknown as {
      header: { min_engine_version: number[] };
    };
    assert.deepEqual([...written.header.min_engine_version], [1, 26, 50]);
  });

  it("keeps comments that only appear inside nested objects", () => {
    const file = fileWithContent(
      '{\n  "header": {\n    // nested comment\n    "min_engine_version": "1.21.100"\n  }\n}'
    );
    const manifest = StorageUtilities.getJsonObjectWithComments(file);
    manifest.header.min_engine_version = "1.26.50";

    assert.isTrue(StorageUtilities.setJsonObjectWithComments(file, manifest));
    assert.include(file.content as string, "// nested comment");
    assert.include(file.content as string, '"1.26.50"');
  });

  it("leaves the file alone when the data is unchanged", () => {
    const file = fileWithContent(original);
    const manifest = StorageUtilities.getJsonObjectWithComments(file);

    assert.isFalse(StorageUtilities.setJsonObjectWithComments(file, manifest));
    assert.equal(file.content, original);
  });
});
