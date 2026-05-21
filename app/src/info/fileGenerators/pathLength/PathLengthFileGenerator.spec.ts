// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { expect } from "chai";
import PathLengthFileGenerator from "./PathLengthFileGenerator";
import { PathLengthFileGeneratorTest } from "./PathLengthFileGeneratorData";
import { createStubProject } from "../../../test/stubs/app/projects/StubProject";
import { InfoItemType } from "../../IInfoItemData";
import IFile from "../../../storage/IFile";

const project = createStubProject();
const NO_CONTENT_INDEX = undefined as any;

function makeFile(storageRelativePath: string): IFile {
  return {
    name: storageRelativePath.split("/").pop() ?? "",
    storageRelativePath,
    extendedPath: storageRelativePath,
    content: null,
    isContentLoaded: false,
  } as unknown as IFile;
}

// Build a path that has exactly N forward-slash segments (no container prefix stripping needed)
function makeDeepPath(segmentCount: number): string {
  return Array.from({ length: segmentCount }, (_, i) => `seg${i}`).join("/");
}

describe("PathLengthFileGenerator", () => {
  let generator: PathLengthFileGenerator;

  beforeEach(() => {
    generator = new PathLengthFileGenerator();
  });

  it("should have correct id and title", () => {
    expect(generator.id).to.equal("PATHLENGTH");
    expect(generator.title).to.equal("Path Length");
  });

  it("should return no results for a clean, short, lowercase path", async () => {
    const file = makeFile("rp/textures/blocks/stone.png");
    const results = await generator.generate(project, file, NO_CONTENT_INDEX);
    expect(results.length).to.equal(0);
  });

  // --- filePathContainsNonLowercaseLetters (104) ---

  it("should report filePathContainsNonLowercaseLetters for a path with uppercase letters", async () => {
    // After pack-folder stripping the path sub used for case check will contain 'MyTexture'
    const file = makeFile("rp/textures/MyTexture.png");
    const results = await generator.generate(project, file, NO_CONTENT_INDEX);
    const rec = results.filter(
      (r) => r.generatorIndex === PathLengthFileGeneratorTest.filePathContainsNonLowercaseLetters
    );
    expect(rec.length).to.equal(1);
    expect(rec[0].itemType).to.equal(InfoItemType.recommendation);
  });

  it("should not flag a .lang file even if it contains uppercase letters", async () => {
    // .lang files are exempt from the casing check
    const file = makeFile("rp/texts/en_US.lang");
    const results = await generator.generate(project, file, NO_CONTENT_INDEX);
    const rec = results.filter(
      (r) => r.generatorIndex === PathLengthFileGeneratorTest.filePathContainsNonLowercaseLetters
    );
    expect(rec.length).to.equal(0);
  });

  it("should not flag a path inside the /texts/ folder", async () => {
    // Must go through the _packs/ branch so pathSub keeps its leading '/' before 'texts'
    const file = makeFile("behavior_packs/my_bp/texts/MyFile.txt");
    const results = await generator.generate(project, file, NO_CONTENT_INDEX);
    const rec = results.filter(
      (r) => r.generatorIndex === PathLengthFileGeneratorTest.filePathContainsNonLowercaseLetters
    );
    expect(rec.length).to.equal(0);
  });

  it("should not flag a path inside the /scripts/ folder", async () => {
    // Must go through the _packs/ branch so pathSub keeps its leading '/' before 'scripts'
    const file = makeFile("behavior_packs/my_bp/scripts/MyScript.js");
    const results = await generator.generate(project, file, NO_CONTENT_INDEX);
    const rec = results.filter(
      (r) => r.generatorIndex === PathLengthFileGeneratorTest.filePathContainsNonLowercaseLetters
    );
    expect(rec.length).to.equal(0);
  });

  it("should not flag a marketing art path", async () => {
    const file = makeFile("/Marketing Art/banner.png");
    const results = await generator.generate(project, file, NO_CONTENT_INDEX);
    expect(results.length).to.equal(0);
  });

  it("should not flag a store art path", async () => {
    const file = makeFile("/Store Art/cover.png");
    const results = await generator.generate(project, file, NO_CONTENT_INDEX);
    expect(results.length).to.equal(0);
  });

  // --- filePathExceeds8DirectorySegments (102) ---

  it("should not report segment error for a path with exactly 8 segments", async () => {
    // 9 parts split by "/" → 8 segments between slashes → length === 9 which is NOT > 9
    const file = makeFile(makeDeepPath(9));
    const results = await generator.generate(project, file, NO_CONTENT_INDEX);
    const errors = results.filter(
      (r) => r.generatorIndex === PathLengthFileGeneratorTest.filePathExceeds8DirectorySegments
    );
    expect(errors.length).to.equal(0);
  });

  it("should report filePathExceeds8DirectorySegments for a path with 9 or more segments", async () => {
    // 10 parts split by "/" → length === 10 which IS > 9
    const file = makeFile(makeDeepPath(10));
    const results = await generator.generate(project, file, NO_CONTENT_INDEX);
    const errors = results.filter(
      (r) => r.generatorIndex === PathLengthFileGeneratorTest.filePathExceeds8DirectorySegments
    );
    expect(errors.length).to.equal(1);
    expect(errors[0].itemType).to.equal(InfoItemType.error);
  });

  // --- filePathExceedsCharacterLength (103) ---

  it("should not report length error for a path with exactly 100 characters", async () => {
    const file = makeFile("a".repeat(100));
    const results = await generator.generate(project, file, NO_CONTENT_INDEX);
    const errors = results.filter(
      (r) => r.generatorIndex === PathLengthFileGeneratorTest.filePathExceedsCharacterLength
    );
    expect(errors.length).to.equal(0);
  });

  it("should report filePathExceedsCharacterLength for a path with more than 100 characters", async () => {
    const file = makeFile("a".repeat(101));
    const results = await generator.generate(project, file, NO_CONTENT_INDEX);
    const errors = results.filter(
      (r) => r.generatorIndex === PathLengthFileGeneratorTest.filePathExceedsCharacterLength
    );
    expect(errors.length).to.equal(1);
    expect(errors[0].itemType).to.equal(InfoItemType.error);
  });

  it("should report both segment and length errors for a path that violates both limits", async () => {
    // A path that has 10+ segments AND is >100 characters
    const seg = "verylongsegmentname";
    const file = makeFile(Array.from({ length: 11 }, () => seg).join("/"));
    const results = await generator.generate(project, file, NO_CONTENT_INDEX);
    const segErrors = results.filter(
      (r) => r.generatorIndex === PathLengthFileGeneratorTest.filePathExceeds8DirectorySegments
    );
    const lenErrors = results.filter(
      (r) => r.generatorIndex === PathLengthFileGeneratorTest.filePathExceedsCharacterLength
    );
    expect(segErrors.length).to.equal(1);
    expect(lenErrors.length).to.equal(1);
  });

  // --- Pack folder hint stripping ---

  it("should strip a behavior_packs container prefix before checking segment depth", async () => {
    // /behavior_packs/my_bp/ is stripped → remaining path has few segments → no error
    const file = makeFile("/behavior_packs/my_bp/scripts/server/main.js");
    const results = await generator.generate(project, file, NO_CONTENT_INDEX);
    const errors = results.filter(
      (r) => r.generatorIndex === PathLengthFileGeneratorTest.filePathExceeds8DirectorySegments
    );
    expect(errors.length).to.equal(0);
  });
});
