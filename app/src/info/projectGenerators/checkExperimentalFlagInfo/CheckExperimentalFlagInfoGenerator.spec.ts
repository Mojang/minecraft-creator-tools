// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { expect } from "chai";
import CheckExperimentalFlagInfoGenerator from "./CheckExperimentalFlagInfoGenerator";
import { CheckExperimentalFlagInfoGeneratorTest } from "./CheckExperimentalFlagInfoData";
import { createStubProject } from "../../../test/stubs/app/projects/StubProject";
import { createStubProjectItem } from "../../../test/stubs/app/projects/StubProjectItem";
import { createStubFile } from "../../../test/stubs/app/io/StubFile";
import { ProjectItemType } from "../../../app/IProjectItemData";

describe("CheckExperimentalFlagInfoGenerator", () => {
  let generator: CheckExperimentalFlagInfoGenerator;

  beforeEach(() => {
    generator = new CheckExperimentalFlagInfoGenerator();
  });

  it("should have correct id and title", () => {
    expect(generator.id).to.equal("EXPFLAG");
    expect(generator.title).to.be.a("string").and.have.length.above(0);
  });

  it("should return no results for an empty project", async () => {
    const results = await generator.generate(createStubProject());
    expect(results.length).to.equal(0);
  });

  it("should skip items with non-matching types", async () => {
    const item = createStubProjectItem({ itemType: ProjectItemType.resourcePackManifestJson });
    const results = await generator.generate(createStubProject([item]));
    expect(results.length).to.equal(0);
  });

  describe("levelDat path", () => {
    it("should return no results for a levelDat item with no primaryFile", async () => {
      // primaryFile is null → the Uint8Array guard fails → no WorldLevelDat created
      const item = createStubProjectItem({
        itemType: ProjectItemType.levelDat,
        isContentLoaded: true,
      });
      const results = await generator.generate(createStubProject([item]));
      expect(results.length).to.equal(0);
    });

    it("should return no results for a levelDat item whose file content is a string (not Uint8Array)", async () => {
      // content is a string → instanceof Uint8Array guard fails → no WorldLevelDat created
      const file = createStubFile({ name: "level.dat", content: '{"not": "nbt"}' });
      const item = createStubProjectItem({
        itemType: ProjectItemType.levelDat,
        isContentLoaded: true,
        file,
      });
      const results = await generator.generate(createStubProject([item]));
      expect(results.length).to.equal(0);
    });

    it("should return no results for a levelDatOld item with no primaryFile", async () => {
      const item = createStubProjectItem({
        itemType: ProjectItemType.levelDatOld,
        isContentLoaded: true,
      });
      const results = await generator.generate(createStubProject([item]));
      expect(results.length).to.equal(0);
    });
  });

  describe("MCWorld / worldFolder path", () => {
    // MCWorld.ensureOnItem returns undefined when the item has neither defaultFolder
    // nor primaryFile set up (which is the case for all basic stubs).
    // This exercises the worldNotFound branch without needing real world loading.
    const worldItemTypes: [string, ProjectItemType][] = [
      ["MCWorld", ProjectItemType.MCWorld],
      ["MCTemplate", ProjectItemType.MCTemplate],
      ["worldFolder", ProjectItemType.worldFolder],
    ];

    for (const [typeName, itemType] of worldItemTypes) {
      it(`should report worldNotFound for ${typeName} item when world cannot be loaded`, async () => {
        const item = createStubProjectItem({ itemType, isContentLoaded: true });
        const results = await generator.generate(createStubProject([item]));
        const worldNotFound = results.filter(
          (r) => r.generatorIndex === CheckExperimentalFlagInfoGeneratorTest.worldNotFound
        );
        expect(worldNotFound.length).to.equal(1);
      });
    }
  });
});
