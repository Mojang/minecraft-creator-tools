// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { expect } from "chai";
import SoundDefinitionsInfoGenerator, { SoundsDefinitionInfoGeneratorTest } from "./SoundDefinitionsInfoGenerator";
import {
  VALID_SOUND_DEFINITIONS_JSON,
  INVALID_SCHEMA_SOUND_DEFINITIONS_JSON,
  UNPARSEABLE_SOUND_DEFINITIONS_CONTENT,
} from "./SoundDefinitionsInfoGeneratorData";
import { createStubProject } from "../../../test/stubs/app/projects/StubProject";
import { createStubProjectItem } from "../../../test/stubs/app/projects/StubProjectItem";
import { createStubFile } from "../../../test/stubs/app/io/StubFile";
import { ProjectItemType } from "../../../app/IProjectItemData";
import Pack from "../../../minecraft/Pack";

// Minimal pack stub with a projectItem.projectPath, as required by SoundDefinitionsInfoGenerator.
const createMockPack = (projectPath: string) => ({ projectItem: { projectPath } }) as unknown as Pack;

describe("SoundDefinitionsInfoGenerator", () => {
  let generator: SoundDefinitionsInfoGenerator;

  beforeEach(() => {
    generator = new SoundDefinitionsInfoGenerator();
  });

  it("should have correct id and title", () => {
    expect(generator.id).to.equal("SNDSDEF");
    expect(generator.title).to.be.a("string").and.have.length.above(0);
  });

  it("should return no results when there are no sound definition catalog items", async () => {
    const results = await generator.generate(createStubProject());
    expect(results.length).to.equal(0);
  });

  it("should flag a sound definition item that has no associated pack", async () => {
    const file = createStubFile({ name: "sound_definitions.json", content: VALID_SOUND_DEFINITIONS_JSON });
    const item = createStubProjectItem({
      itemType: ProjectItemType.soundDefinitionCatalog,
      getPack: async () => null,
      file,
    });
    const results = await generator.generate(createStubProject([item]));
    const errors = results.filter(
      (r) => r.generatorIndex === SoundsDefinitionInfoGeneratorTest.foundALooseSoundDefinition
    );
    expect(errors.length).to.equal(1);
  });

  it("should flag a second sound definition catalog in the same pack", async () => {
    const pack = createMockPack("/packs/my-resource-pack");
    const item1 = createStubProjectItem({
      itemType: ProjectItemType.soundDefinitionCatalog,
      getPack: async () => pack,
    });
    const item2 = createStubProjectItem({
      itemType: ProjectItemType.soundDefinitionCatalog,
      getPack: async () => pack,
    });
    const results = await generator.generate(createStubProject([item1, item2]));
    const errors = results.filter(
      (r) => r.generatorIndex === SoundsDefinitionInfoGeneratorTest.multipleSoundsDefinitionManifests
    );
    expect(errors.length).to.equal(1);
  });

  it("should flag a sound definition file that contains invalid JSON", async () => {
    const pack = createMockPack("/packs/my-resource-pack");
    const file = createStubFile({ name: "sound_definitions.json", content: UNPARSEABLE_SOUND_DEFINITIONS_CONTENT });
    const item = createStubProjectItem({
      itemType: ProjectItemType.soundDefinitionCatalog,
      getPack: async () => pack,
      file,
    });
    const results = await generator.generate(createStubProject([item]));
    const errors = results.filter(
      (r) => r.generatorIndex === SoundsDefinitionInfoGeneratorTest.soundsDefinitionManifestInvalidJson
    );
    expect(errors.length).to.equal(1);
  });

  it("should flag a sound definition file that is valid JSON but has an invalid structure", async () => {
    const pack = createMockPack("/packs/my-resource-pack");
    const file = createStubFile({ name: "sound_definitions.json", content: INVALID_SCHEMA_SOUND_DEFINITIONS_JSON });
    const item = createStubProjectItem({
      itemType: ProjectItemType.soundDefinitionCatalog,
      getPack: async () => pack,
      file,
    });
    const results = await generator.generate(createStubProject([item]));
    const errors = results.filter(
      (r) => r.generatorIndex === SoundsDefinitionInfoGeneratorTest.invalidSoundsDefinitionManifest
    );
    expect(errors.length).to.equal(1);
  });

  it("should not flag a well-formed sound definition catalog", async () => {
    const pack = createMockPack("/packs/my-resource-pack");
    const file = createStubFile({ name: "sound_definitions.json", content: VALID_SOUND_DEFINITIONS_JSON });
    const item = createStubProjectItem({
      itemType: ProjectItemType.soundDefinitionCatalog,
      getPack: async () => pack,
      file,
    });
    const results = await generator.generate(createStubProject([item]));
    const errors = results.filter(
      (r) => r.generatorIndex === SoundsDefinitionInfoGeneratorTest.invalidSoundsDefinitionManifest
    );
    expect(errors.length).to.equal(0);
  });
});
