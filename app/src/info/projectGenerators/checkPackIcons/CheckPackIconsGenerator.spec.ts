// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { expect } from "chai";
import CheckPackIconsGenerator from "./CheckPackIconsGenerator";
import { CheckPackIconsGeneratorTest } from "./CheckPackIconsData";
import { createStubProject } from "../../../test/stubs/app/projects/StubProject";
import { createStubFile } from "../../../test/stubs/app/io/StubFile";
import { createStubPack } from "../../../test/stubs/app/projects/StubPack";
import { PackType } from "../../../minecraft/Pack";

describe("CheckPackIconsGenerator", () => {
  let generator: CheckPackIconsGenerator;

  beforeEach(() => {
    generator = new CheckPackIconsGenerator();
  });

  it("should have correct id and title", () => {
    expect(generator.id).to.equal("CPACKICON");
    expect(generator.title).to.be.a("string").and.have.length.above(0);
  });

  it("should return no results for a project with no packs", async () => {
    const results = await generator.generate(createStubProject());
    expect(results.length).to.equal(0);
  });

  it("should not check icon for skin packs (they are exempt)", async () => {
    // Skin packs do not require a pack icon; generator should skip them entirely
    const pack = createStubPack({ packType: PackType.skin, getFiles: async () => [] });
    const results = await generator.generate(createStubProject([], [pack]));
    expect(results.length).to.equal(0);
  });

  it("should not check icon for design packs (they are exempt)", async () => {
    const pack = createStubPack({ packType: PackType.design, getFiles: async () => [] });
    const results = await generator.generate(createStubProject([], [pack]));
    expect(results.length).to.equal(0);
  });

  it("should report NoIconFound when a resource pack has no pack_icon.png", async () => {
    const pack = createStubPack({ packType: PackType.resource, name: "my-rp", getFiles: async () => [] });
    const results = await generator.generate(createStubProject([], [pack]));
    const errors = results.filter((r) => r.generatorIndex === CheckPackIconsGeneratorTest.NoIconFound);
    expect(errors.length).to.equal(1);
  });

  it("should report MultipleIconsFound when a pack has more than one pack icon", async () => {
    const icon1 = createStubFile({ name: "pack_icon.png", content: null });
    const icon2 = createStubFile({ name: "pack_icon.png", content: null });
    const pack = createStubPack({ packType: PackType.resource, name: "my-rp", getFiles: async () => [icon1, icon2] });
    const results = await generator.generate(createStubProject([], [pack]));
    const errors = results.filter((r) => r.generatorIndex === CheckPackIconsGeneratorTest.MultipleIconsFound);
    expect(errors.length).to.equal(1);
  });

  it("should report IconNotValidImage when the icon file cannot be parsed as an image", async () => {
    // null content → parseImageMetadata returns null → IconNotValidImage
    const iconFile = createStubFile({ name: "pack_icon.png", content: null });
    const pack = createStubPack({ packType: PackType.resource, name: "my-rp", getFiles: async () => [iconFile] });
    const results = await generator.generate(createStubProject([], [pack]));
    const errors = results.filter((r) => r.generatorIndex === CheckPackIconsGeneratorTest.IconNotValidImage);
    expect(errors.length).to.equal(1);
  });
});
