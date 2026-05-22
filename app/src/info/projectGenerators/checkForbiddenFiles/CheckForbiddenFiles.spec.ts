// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { expect } from "chai";
import CheckForbiddenFilesGenerator from "./CheckForbiddenFiles";
import { ForbiddenTests } from "./CheckForbiddenFilesData";
import { createStubProject } from "../../../test/stubs/app/projects/StubProject";
import { createStubProjectItem } from "../../../test/stubs/app/projects/StubProjectItem";
import { createStubPack } from "../../../test/stubs/app/projects/StubPack";
import { PackType } from "../../../minecraft/Pack";

describe("CheckForbiddenFilesGenerator", () => {
  let generator: CheckForbiddenFilesGenerator;

  beforeEach(() => {
    generator = new CheckForbiddenFilesGenerator();
  });

  it("should have correct id and title", () => {
    expect(generator.id).to.equal("FORBFILE");
    expect(generator.title).to.be.a("string").and.have.length.above(0);
  });

  it("should return no results for a project with no packs", async () => {
    const project = createStubProject([], []);
    const results = await generator.generate(project);
    expect(results.length).to.equal(0);
  });

  describe("extension allowlist", () => {
    it("should not flag a .json file in a resource pack", async () => {
      const item = createStubProjectItem({ name: "entity.json", projectPath: "RP/entity.json" });
      const pack = createStubPack({ items: [item], packType: PackType.resource });
      const results = await generator.generate(createStubProject([], [pack]));
      const extErrors = results.filter((r) => r.generatorIndex === ForbiddenTests.ExtNotInAllowList.id);
      expect(extErrors.length).to.equal(0);
    });

    it("should flag a .exe file in a resource pack", async () => {
      const item = createStubProjectItem({ name: "bad.exe", projectPath: "RP/bad.exe" });
      const pack = createStubPack({ items: [item], packType: PackType.resource });
      const results = await generator.generate(createStubProject([], [pack]));
      const extErrors = results.filter((r) => r.generatorIndex === ForbiddenTests.ExtNotInAllowList.id);
      expect(extErrors.length).to.equal(1);
    });

    it("should not flag .js files in a behavior pack (allowed there but not in resource pack)", async () => {
      const item = createStubProjectItem({ name: "script.js", projectPath: "BP/scripts/script.js" });
      const pack = createStubPack({ items: [item], packType: PackType.behavior });
      const results = await generator.generate(createStubProject([], [pack]));
      const extErrors = results.filter((r) => r.generatorIndex === ForbiddenTests.ExtNotInAllowList.id);
      expect(extErrors.length).to.equal(0);
    });

    it("should flag a .js file in a resource pack (not in allowlist)", async () => {
      const item = createStubProjectItem({ name: "script.js", projectPath: "RP/script.js" });
      const pack = createStubPack({ items: [item], packType: PackType.resource });
      const results = await generator.generate(createStubProject([], [pack]));
      const extErrors = results.filter((r) => r.generatorIndex === ForbiddenTests.ExtNotInAllowList.id);
      expect(extErrors.length).to.equal(1);
    });

    it("should not flag any extension for a design pack (allows all)", async () => {
      const item = createStubProjectItem({ name: "anything.xyz", projectPath: "DP/anything.xyz" });
      const pack = createStubPack({ items: [item], packType: PackType.design });
      const results = await generator.generate(createStubProject([], [pack]));
      const extErrors = results.filter((r) => r.generatorIndex === ForbiddenTests.ExtNotInAllowList.id);
      expect(extErrors.length).to.equal(0);
    });

    it("should not flag a folder item (path ending with /) even if extension is not in allowlist", async () => {
      const item = createStubProjectItem({ name: "subfolder", projectPath: "RP/subfolder/" });
      const pack = createStubPack({ items: [item], packType: PackType.resource });
      const results = await generator.generate(createStubProject([], [pack]));
      const extErrors = results.filter((r) => r.generatorIndex === ForbiddenTests.ExtNotInAllowList.id);
      expect(extErrors.length).to.equal(0);
    });
  });

  describe("blocked file names", () => {
    it("should flag a blocked file name in a resource pack", async () => {
      const item = createStubProjectItem({ name: "Contents.json", projectPath: "RP/Contents.json" });
      const pack = createStubPack({ items: [item], packType: PackType.resource });
      const results = await generator.generate(createStubProject([], [pack]));
      const nameErrors = results.filter((r) => r.generatorIndex === ForbiddenTests.InvalidFileName.id);
      expect(nameErrors.length).to.equal(1);
    });

    it("should not flag an allowed file name", async () => {
      const item = createStubProjectItem({ name: "manifest.json", projectPath: "RP/manifest.json" });
      const pack = createStubPack({ items: [item], packType: PackType.resource });
      const results = await generator.generate(createStubProject([], [pack]));
      const nameErrors = results.filter((r) => r.generatorIndex === ForbiddenTests.InvalidFileName.id);
      expect(nameErrors.length).to.equal(0);
    });
  });

  describe("invalid characters in path", () => {
    it("should flag a file with $ in the project path", async () => {
      const item = createStubProjectItem({ name: "entity.json", projectPath: "RP/$entity.json" });
      const pack = createStubPack({ items: [item], packType: PackType.resource });
      const results = await generator.generate(createStubProject([], [pack]));
      const charErrors = results.filter((r) => r.generatorIndex === ForbiddenTests.ContainsInvalidCharacter.id);
      expect(charErrors.length).to.equal(1);
    });

    it("should not flag a file with a clean path", async () => {
      const item = createStubProjectItem({ name: "entity.json", projectPath: "RP/entities/entity.json" });
      const pack = createStubPack({ items: [item], packType: PackType.resource });
      const results = await generator.generate(createStubProject([], [pack]));
      const charErrors = results.filter((r) => r.generatorIndex === ForbiddenTests.ContainsInvalidCharacter.id);
      expect(charErrors.length).to.equal(0);
    });
  });
});
