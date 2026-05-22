// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { expect } from "chai";
import CheckParticleIdentifierGenerator from "./CheckParticleIdentifierGenerator";
import { CheckParticleIdentifierTest } from "./CheckParticleIdentifierData";
import { createStubProject } from "../../../test/stubs/app/projects/StubProject";
import { createStubProjectItem } from "../../../test/stubs/app/projects/StubProjectItem";
import { createStubFile } from "../../../test/stubs/app/io/StubFile";
import { ProjectItemType } from "../../../app/IProjectItemData";

// Minimum format version that triggers the namespace check
const MIN_VERSION = "1.20.60";
// Version just below minimum — check should be skipped
const BELOW_MIN_VERSION = "1.20.59";

function makeParticleJson(formatVersion: string | undefined, identifier: string | undefined) {
  return JSON.stringify({
    ...(formatVersion !== undefined ? { format_version: formatVersion } : {}),
    particle_effect: {
      description: {
        ...(identifier !== undefined ? { identifier } : {}),
      },
    },
  });
}

describe("CheckParticleIdentifierGenerator", () => {
  let generator: CheckParticleIdentifierGenerator;

  beforeEach(() => {
    generator = new CheckParticleIdentifierGenerator();
  });

  it("should have correct id and title", () => {
    expect(generator.id).to.equal("CPARTI");
    expect(generator.title).to.be.a("string").and.have.length.above(0);
  });

  it("should return no results for an empty project", async () => {
    const results = await generator.generate(createStubProject());
    expect(results.length).to.equal(0);
  });

  it("should return no results when the particle item has no primaryFile", async () => {
    // No file provided → primaryFile is null → generator skips the item
    const item = createStubProjectItem({ itemType: ProjectItemType.particleJson });
    const results = await generator.generate(createStubProject([item]));
    expect(results.length).to.equal(0);
  });

  it("should report FailedToReadFile when the file has no content", async () => {
    const file = createStubFile({ name: "particle.json", content: null });
    const item = createStubProjectItem({ itemType: ProjectItemType.particleJson, file });
    const results = await generator.generate(createStubProject([item]));
    const errors = results.filter((r) => r.generatorIndex === CheckParticleIdentifierTest.FailedToReadFile);
    expect(errors.length).to.equal(1);
  });

  it("should report FailedToReadVersion when format_version is missing", async () => {
    const file = createStubFile({ name: "particle.json", content: makeParticleJson(undefined, "minecraft:fire") });
    const item = createStubProjectItem({ itemType: ProjectItemType.particleJson, file });
    const results = await generator.generate(createStubProject([item]));
    const errors = results.filter((r) => r.generatorIndex === CheckParticleIdentifierTest.FailedToReadVersion);
    expect(errors.length).to.equal(1);
  });

  it("should return no results when format_version is below the minimum check version", async () => {
    const file = createStubFile({
      name: "particle.json",
      content: makeParticleJson(BELOW_MIN_VERSION, "no_namespace"),
    });
    const item = createStubProjectItem({ itemType: ProjectItemType.particleJson, file });
    const results = await generator.generate(createStubProject([item]));
    expect(results.length).to.equal(0);
  });

  it("should report InvalidParticleIdentifier when the identifier has no namespace prefix", async () => {
    const file = createStubFile({
      name: "particle.json",
      content: makeParticleJson(MIN_VERSION, "no_namespace_here"),
    });
    const item = createStubProjectItem({ itemType: ProjectItemType.particleJson, file });
    const results = await generator.generate(createStubProject([item]));
    const errors = results.filter((r) => r.generatorIndex === CheckParticleIdentifierTest.InvalidParticleIdentifier);
    expect(errors.length).to.equal(1);
  });

  it("should return no results for a valid identifier with a namespace", async () => {
    const file = createStubFile({
      name: "particle.json",
      content: makeParticleJson(MIN_VERSION, "minecraft:my_particle"),
    });
    const item = createStubProjectItem({ itemType: ProjectItemType.particleJson, file });
    const results = await generator.generate(createStubProject([item]));
    expect(results.length).to.equal(0);
  });
});
