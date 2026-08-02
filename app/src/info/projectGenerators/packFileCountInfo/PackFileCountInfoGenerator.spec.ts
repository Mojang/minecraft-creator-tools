// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { assert } from "chai";
import PackFileCountInfoGenerator from "./PackFileCountInfoGenerator";
import {
  MaxFolderTraversalDepth,
  PackFileCountInfoGeneratorTest,
  RecommendedMaxFileCount,
} from "./PackFileCountInfoData";
import { createStubProject } from "../../../test/stubs/app/projects/StubProject";
import { createStubFile } from "../../../test/stubs/app/io/StubFile";
import IFile from "../../../storage/IFile";
import IFolder from "../../../storage/IFolder";
import { InfoItemType } from "../../IInfoItemData";

const noOpContentIndex = { insert: () => {} } as any;

function createFolderWithFileCount(count: number): IFolder {
  const files: { [name: string]: IFile } = {};

  for (let i = 0; i < count; i++) {
    const name = `file-${i}.json`;
    files[name] = createStubFile({ name });
  }

  return {
    isLoaded: true,
    files,
    folders: {},
    load: async () => {},
    name: "root",
    fullPath: "/root",
    errorStatus: undefined,
  } as unknown as IFolder;
}

// Builds a single chain of nested folders `chainDepth` levels deep, with one file
// at the very bottom. The deepest file only gets counted if traversal reaches it.
function createNestedFolderChain(chainDepth: number): IFolder {
  let current: IFolder = {
    isLoaded: true,
    files: { "leaf.json": createStubFile({ name: "leaf.json" }) },
    folders: {},
    load: async () => {},
    name: `level-${chainDepth}`,
    fullPath: `/level-${chainDepth}`,
    errorStatus: undefined,
  } as unknown as IFolder;

  for (let i = chainDepth - 1; i >= 0; i--) {
    current = {
      isLoaded: true,
      files: {},
      folders: { child: current },
      load: async () => {},
      name: i === 0 ? "root" : `level-${i}`,
      fullPath: i === 0 ? "/root" : `/level-${i}`,
      errorStatus: undefined,
    } as unknown as IFolder;
  }

  return current;
}

describe("PackFileCountInfoGenerator", () => {
  const gen = new PackFileCountInfoGenerator();

  it("has expected id and title", () => {
    assert.strictEqual(gen.id, "PACKFILECOUNT");
    assert.strictEqual(gen.title, "Pack File Count");
  });

  it("emits no warning for a project well under the limit", async () => {
    const folder = createFolderWithFileCount(50);
    const project = createStubProject([], [], { ensureProjectFolder: async () => folder });

    const results = await gen.generate(project, noOpContentIndex);

    const aggregate = results.find((r) => r.generatorIndex === PackFileCountInfoGeneratorTest.fileCount);
    assert.isDefined(aggregate, "should emit file count aggregate");
    assert.strictEqual(aggregate!.data, 50);

    const warning = results.find(
      (r) => r.generatorIndex === PackFileCountInfoGeneratorTest.exceedsRecommendedFileCount
    );
    assert.isUndefined(warning, "should not emit warning for project under the limit");
  });

  it("counts container files and their contents", async () => {
    const nestedFolder = createFolderWithFileCount(3);

    const container = createStubFile({ name: "nested.mcpack" }) as any;
    container.fileContainerStorage = { rootFolder: nestedFolder, storagePath: "" };

    const folder: IFolder = {
      isLoaded: true,
      files: { "nested.mcpack": container },
      folders: {},
      load: async () => {},
      name: "root",
      fullPath: "/root",
      errorStatus: undefined,
    } as unknown as IFolder;

    const project = createStubProject([], [], { ensureProjectFolder: async () => folder });

    const results = await gen.generate(project, noOpContentIndex);

    const aggregate = results.find((r) => r.generatorIndex === PackFileCountInfoGeneratorTest.fileCount);
    assert.strictEqual(aggregate!.data, 4);
  });

  it("emits no warning for a project at exactly the limit", async () => {
    const folder = createFolderWithFileCount(RecommendedMaxFileCount);
    const project = createStubProject([], [], { ensureProjectFolder: async () => folder });

    const results = await gen.generate(project, noOpContentIndex);

    const aggregate = results.find((r) => r.generatorIndex === PackFileCountInfoGeneratorTest.fileCount);
    assert.strictEqual(aggregate!.data, RecommendedMaxFileCount);

    const warning = results.find(
      (r) => r.generatorIndex === PackFileCountInfoGeneratorTest.exceedsRecommendedFileCount
    );
    assert.isUndefined(warning, "10,000 files is at the limit and should not warn");
  });

  it("emits a warning when the project exceeds the limit", async () => {
    const folder = createFolderWithFileCount(RecommendedMaxFileCount + 1);
    const project = createStubProject([], [], { ensureProjectFolder: async () => folder });

    const results = await gen.generate(project, noOpContentIndex);

    const aggregate = results.find((r) => r.generatorIndex === PackFileCountInfoGeneratorTest.fileCount);
    assert.strictEqual(aggregate!.data, RecommendedMaxFileCount + 1);

    const warning = results.find(
      (r) => r.generatorIndex === PackFileCountInfoGeneratorTest.exceedsRecommendedFileCount
    );
    assert.isDefined(warning, "should emit warning when file count exceeds the limit");
    assert.strictEqual(warning!.itemType, InfoItemType.warning, "exceeded-limit item is a warning, not an error");
    assert.strictEqual(warning!.data, RecommendedMaxFileCount + 1);
    assert.include(warning!.message ?? "", String(RecommendedMaxFileCount + 1), "message should cite the file count");
    assert.match(warning!.message ?? "", /marketplace/i, "message should reference marketplace best practices");
  });

  it("does not warn about depth for nesting at the traversal limit", async () => {
    // A chain exactly MaxFolderTraversalDepth deep is fully traversed.
    const folder = createNestedFolderChain(MaxFolderTraversalDepth);
    const project = createStubProject([], [], { ensureProjectFolder: async () => folder });

    const results = await gen.generate(project, noOpContentIndex);

    const aggregate = results.find((r) => r.generatorIndex === PackFileCountInfoGeneratorTest.fileCount);
    assert.strictEqual(aggregate!.data, 1, "the single leaf file should be counted");

    const depthWarning = results.find(
      (r) => r.generatorIndex === PackFileCountInfoGeneratorTest.maxTraversalDepthExceeded
    );
    assert.isUndefined(depthWarning, "should not warn when nesting is within the traversal limit");
  });

  it("warns (instead of silently undercounting) when nesting exceeds the traversal limit", async () => {
    // One level deeper than the cap: the deepest folder is skipped, so its leaf file is not counted.
    const folder = createNestedFolderChain(MaxFolderTraversalDepth + 1);
    const project = createStubProject([], [], { ensureProjectFolder: async () => folder });

    const results = await gen.generate(project, noOpContentIndex);

    const aggregate = results.find((r) => r.generatorIndex === PackFileCountInfoGeneratorTest.fileCount);
    assert.strictEqual(aggregate!.data, 0, "the leaf below the depth cap should not be counted");

    const depthWarning = results.find(
      (r) => r.generatorIndex === PackFileCountInfoGeneratorTest.maxTraversalDepthExceeded
    );
    assert.isDefined(depthWarning, "should emit a warning when the depth cap drops folders");
    assert.strictEqual(depthWarning!.itemType, InfoItemType.warning, "depth-exceeded item is a warning");
    assert.strictEqual(depthWarning!.data, 1, "exactly one subfolder was skipped");
    assert.match(depthWarning!.message ?? "", /lower bound/i, "message should explain the count is a lower bound");
  });
});
