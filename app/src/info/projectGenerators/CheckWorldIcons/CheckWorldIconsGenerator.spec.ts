// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { expect } from "chai";
import CheckWorldIconsGenerator from "./CheckWorldIconsGenerator";
import { CheckWorldIconsGeneratorTest, createStubFolderWithFiles } from "./CheckWorldIconsGeneratorData";
import { createStubProject } from "../../../test/stubs/app/projects/StubProject";
import { createStubProjectItem } from "../../../test/stubs/app/projects/StubProjectItem";
import { createStubFile } from "../../../test/stubs/app/io/StubFile";
import { ProjectItemType } from "../../../app/IProjectItemData";

describe("CheckWorldIconsGenerator", () => {
  let generator: CheckWorldIconsGenerator;

  beforeEach(() => {
    generator = new CheckWorldIconsGenerator();
  });

  it("should have correct id and title", () => {
    expect(generator.id).to.equal("CWI");
    expect(generator.title).to.be.a("string").and.have.length.above(0);
  });

  it("should return no results when there are no world template manifest items", async () => {
    const results = await generator.generate(createStubProject());
    expect(results.length).to.equal(0);
  });

  it("should return no results when the world template item has no associated folder", async () => {
    const item = createStubProjectItem({
      itemType: ProjectItemType.worldTemplateManifestJson,
      getFolder: () => null,
    });
    const results = await generator.generate(createStubProject([item]));
    expect(results.length).to.equal(0);
  });

  it("should flag a missing world icon when the folder contains no icon files", async () => {
    const folder = createStubFolderWithFiles([]);
    const item = createStubProjectItem({
      itemType: ProjectItemType.worldTemplateManifestJson,
      getFolder: () => folder,
    });
    const results = await generator.generate(createStubProject([item]));
    const errors = results.filter((r) => r.generatorIndex === CheckWorldIconsGeneratorTest.NoIconFound);
    expect(errors.length).to.equal(1);
  });

  it("should flag multiple world icons when more than one icon file is found", async () => {
    const icon1 = createStubFile({ name: "world_icon.jpeg", content: null });
    const icon2 = createStubFile({ name: "world_icon_small.jpeg", content: null });
    const folder = createStubFolderWithFiles([icon1, icon2]);
    const item = createStubProjectItem({
      itemType: ProjectItemType.worldTemplateManifestJson,
      getFolder: () => folder,
    });
    const results = await generator.generate(createStubProject([item]));
    const errors = results.filter((r) => r.generatorIndex === CheckWorldIconsGeneratorTest.MultipleIconsFound);
    expect(errors.length).to.equal(1);
  });

  it("should flag an icon that cannot be parsed as a valid image", async () => {
    // File with null content: getContentsAsBinary() returns undefined → parseImageMetadata returns null
    const iconFile = createStubFile({ name: "world_icon.jpeg", content: null });
    const folder = createStubFolderWithFiles([iconFile]);
    const item = createStubProjectItem({
      itemType: ProjectItemType.worldTemplateManifestJson,
      getFolder: () => folder,
    });
    const results = await generator.generate(createStubProject([item]));
    const errors = results.filter((r) => r.generatorIndex === CheckWorldIconsGeneratorTest.IconNotValidImage);
    expect(errors.length).to.equal(1);
  });
});
