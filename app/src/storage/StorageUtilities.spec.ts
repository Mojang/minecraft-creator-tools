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

describe("StorageUtilities.getBaseRelativePath", () => {
  it("resolves pack root and subpack files to the same content path, from either root", () => {
    const packRoot = new ZipStorage().rootFolder.ensureFolder("RP");
    const rootFile = packRoot.ensureFolder("textures").ensureFolder("entity").ensureFile("Pig.png");
    const subpackFile = packRoot
      .ensureFolder("subpacks")
      .ensureFolder("0_e")
      .ensureFolder("textures")
      .ensureFolder("entity")
      .ensureFile("pig.png");

    assert.equal(StorageUtilities.getBaseRelativePath(rootFile, packRoot), "textures/entity/pig");
    assert.equal(StorageUtilities.getBaseRelativePath(subpackFile, packRoot), "textures/entity/pig");
    assert.equal(
      StorageUtilities.getBaseRelativePath(rootFile, packRoot.ensureFolder("subpacks").ensureFolder("0_e")),
      "textures/entity/pig"
    );
  });

  it("does not resolve a file in a sibling subpack", () => {
    const subpacks = new ZipStorage().rootFolder.ensureFolder("RP").ensureFolder("subpacks");
    const subpackA = subpacks.ensureFolder("a");
    const ownFile = subpackA.ensureFolder("textures").ensureFile("own.png");
    const siblingFile = subpacks.ensureFolder("b").ensureFolder("textures").ensureFile("sibling.png");

    assert.equal(StorageUtilities.getBaseRelativePath(ownFile, subpackA), "textures/own");
    assert.isUndefined(StorageUtilities.getBaseRelativePath(siblingFile, subpackA));
  });
});

describe("StorageUtilities.resolvePackPathCandidates", () => {
  it("links every override from the pack root, and own-or-parent copies from a subpack", async () => {
    const packRoot = new ZipStorage().rootFolder.ensureFolder("RP");
    const subpacks = packRoot.ensureFolder("subpacks");
    const asItem = (file: any) => ({
      ensureAllFiles: async () => [file],
      ensureStorage: async () => {},
      loadContent: async () => {},
    });
    const texture = (folder: any, name: string) => {
      const file = folder.ensureFolder("textures").ensureFile(name + ".png");
      file.setContent(new Uint8Array([1]));
      return asItem(file);
    };
    const rootPig = texture(packRoot, "pig");
    const lowPig = texture(subpacks.ensureFolder("low"), "pig");
    const highPig = texture(subpacks.ensureFolder("high"), "pig");
    const highCow = texture(subpacks.ensureFolder("high"), "cow");
    const items = [highCow, highPig, lowPig, rootPig];
    const resolve = (folder: any, paths: string[]) =>
      StorageUtilities.resolvePackPathCandidates(items, folder, paths, (file) =>
        StorageUtilities.getBaseRelativePath(file, folder)
      );

    const fromRoot = await resolve(packRoot, ["textures/pig", "textures/sheep"]);
    assert.sameMembers(fromRoot.matches, [rootPig, lowPig, highPig]);
    assert.deepEqual(fromRoot.unmatched, ["textures/sheep"]);

    const fromLow = await resolve(subpacks.ensureFolder("low"), ["textures/pig", "textures/cow"]);
    assert.deepEqual(fromLow.matches, [lowPig]);
    assert.deepEqual(fromLow.unmatched, ["textures/cow"]);

    const high = subpacks.ensureFolder("high");
    const fromHighWithoutOverride = await StorageUtilities.resolvePackPathCandidates(
      [lowPig, highCow, rootPig],
      high,
      ["textures/pig"],
      (file) => StorageUtilities.getBaseRelativePath(file, high)
    );
    assert.deepEqual(fromHighWithoutOverride.matches, [rootPig]);
  });
});
