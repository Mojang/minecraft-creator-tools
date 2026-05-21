// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { expect } from "chai";
import CheckVanillaDuplicatesInfoGenerator, {
  CheckVanillaDuplicatesInfoGeneratorTest,
} from "./CheckVanillaDuplicatesInfoGenerator";
import {
  VANILLA_TEST_FILE_HASH,
  VANILLA_TEST_FILE_NAME,
  VANILLA_TEST_FILE_PATH,
  createStubContentIndex,
} from "./CheckVanillaDuplicatesInfoGeneratorData";
import { createStubProject } from "../../../test/stubs/app/projects/StubProject";
import { createStubProjectItem } from "../../../test/stubs/app/projects/StubProjectItem";
import { createStubFile } from "../../../test/stubs/app/io/StubFile";
import Database from "../../../minecraft/Database";

describe("CheckVanillaDuplicatesInfoGenerator", () => {
  let generator: CheckVanillaDuplicatesInfoGenerator;

  beforeEach(() => {
    generator = new CheckVanillaDuplicatesInfoGenerator();
    Database.releaseVanillaContentHashes = null;
  });

  afterEach(() => {
    Database.releaseVanillaContentHashes = null;
  });

  it("should have correct id and title", () => {
    expect(generator.id).to.equal("VANDUPES");
    expect(generator.title).to.be.a("string").and.have.length.above(0);
  });

  it("should return no results for a project with no items", async () => {
    const contentIndex = createStubContentIndex();
    const results = await generator.generate(createStubProject(), contentIndex);
    expect(results.length).to.equal(0);
  });

  it("should not flag a file when no matching hash exists in the content index", async () => {
    Database.releaseVanillaContentHashes = {
      other_hash: { fileName: "other.json", propertyName: "", filePath: "RP/other.json" },
    };
    // Empty content index — the item's path won't match any entry
    const contentIndex = createStubContentIndex();
    const file = createStubFile({ name: VANILLA_TEST_FILE_NAME, content: "file content" });
    const item = createStubProjectItem({ name: VANILLA_TEST_FILE_NAME, projectPath: VANILLA_TEST_FILE_PATH, file });
    const results = await generator.generate(createStubProject([item]), contentIndex);
    const warnings = results.filter(
      (r) => r.generatorIndex === CheckVanillaDuplicatesInfoGeneratorTest.completeVanillaCopy
    );
    expect(warnings.length).to.equal(0);
  });

  it("should flag a complete copy of a vanilla file", async () => {
    const catalogEntry = { fileName: VANILLA_TEST_FILE_NAME, propertyName: "", filePath: VANILLA_TEST_FILE_PATH };
    Database.releaseVanillaContentHashes = { [VANILLA_TEST_FILE_HASH]: catalogEntry };
    const contentIndex = createStubContentIndex({ [VANILLA_TEST_FILE_HASH]: catalogEntry });
    const file = createStubFile({ name: VANILLA_TEST_FILE_NAME, content: "file content" });
    const item = createStubProjectItem({ name: VANILLA_TEST_FILE_NAME, projectPath: VANILLA_TEST_FILE_PATH, file });
    const results = await generator.generate(createStubProject([item]), contentIndex);
    const warnings = results.filter(
      (r) => r.generatorIndex === CheckVanillaDuplicatesInfoGeneratorTest.completeVanillaCopy
    );
    expect(warnings.length).to.equal(1);
  });

  it("should skip allowlisted files even when a hash match exists", async () => {
    const catalogEntry = { fileName: "languages.json", propertyName: "", filePath: "RP/texts/languages.json" };
    Database.releaseVanillaContentHashes = { allowlisted_hash: catalogEntry };
    const contentIndex = createStubContentIndex({ allowlisted_hash: catalogEntry });
    const file = createStubFile({ name: "languages.json", content: "file content" });
    const item = createStubProjectItem({
      name: "languages.json",
      projectPath: "RP/texts/languages.json",
      file,
    });
    const results = await generator.generate(createStubProject([item]), contentIndex);
    expect(results.length).to.equal(0);
  });
});
