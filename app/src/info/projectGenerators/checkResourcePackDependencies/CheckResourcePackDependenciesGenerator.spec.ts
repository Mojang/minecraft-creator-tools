// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { expect } from "chai";
import CheckResourcePackDependenciesGenerator from "./CheckResourcePackDependenciesGenerator";
import { CheckResourcePackDependenciesGeneratorTest } from "./CheckResourcePackDependenciesData";
import { createStubProject } from "../../../test/stubs/app/projects/StubProject";
import { createStubProjectItem } from "../../../test/stubs/app/projects/StubProjectItem";
import { createStubFile } from "../../../test/stubs/app/io/StubFile";
import { ProjectItemType } from "../../../app/IProjectItemData";

// Length-36 UUIDs accepted by Utilities.isValidUuid (length === 36 check)
const UUID_RP = "11111111-1111-1111-1111-111111111111";
const UUID_BP = "22222222-2222-2222-2222-222222222222";
const UUID_MISSING = "33333333-3333-3333-3333-333333333333";

function makeRpManifestJson(uuid: string, dependencies?: { uuid: string }[]) {
  return JSON.stringify({
    format_version: 2,
    header: { uuid, name: "RP", version: [1, 0, 0] },
    modules: [],
    ...(dependencies ? { dependencies } : {}),
  });
}

function makeBpManifestJson(uuid: string) {
  return JSON.stringify({
    format_version: 2,
    header: { uuid, name: "BP", version: [1, 0, 0] },
    modules: [],
  });
}

describe("CheckResourcePackDependenciesGenerator", () => {
  let generator: CheckResourcePackDependenciesGenerator;

  beforeEach(() => {
    generator = new CheckResourcePackDependenciesGenerator();
  });

  it("should have correct id and title", () => {
    expect(generator.id).to.equal("RPDEPENDS");
    expect(generator.title).to.be.a("string").and.have.length.above(0);
  });

  it("should return no results for an empty project", async () => {
    const results = await generator.generate(createStubProject());
    expect(results.length).to.equal(0);
  });

  it("should return no results for non-manifest item types", async () => {
    const item = createStubProjectItem({ itemType: ProjectItemType.entityTypeBehavior });
    const results = await generator.generate(createStubProject([item]));
    expect(results.length).to.equal(0);
  });

  it("should return no results when manifest items have no primaryFile", async () => {
    // No file provided → primaryFile is null → item is skipped (continue)
    const rpItem = createStubProjectItem({ itemType: ProjectItemType.resourcePackManifestJson });
    const bpItem = createStubProjectItem({ itemType: ProjectItemType.behaviorPackManifestJson });
    const results = await generator.generate(createStubProject([rpItem, bpItem]));
    expect(results.length).to.equal(0);
  });

  it("should return no results when RP and BP are both present and dependency uuid matches RP uuid", async () => {
    const rpFile = createStubFile({
      name: "manifest.json",
      content: makeRpManifestJson(UUID_RP, [{ uuid: UUID_BP }]),
    });
    const bpFile = createStubFile({ name: "manifest.json", content: makeBpManifestJson(UUID_BP) });
    const rpItem = createStubProjectItem({ itemType: ProjectItemType.resourcePackManifestJson, file: rpFile });
    const bpItem = createStubProjectItem({ itemType: ProjectItemType.behaviorPackManifestJson, file: bpFile });
    const results = await generator.generate(createStubProject([rpItem, bpItem]));
    const depErrors = results.filter(
      (r) => r.generatorIndex === CheckResourcePackDependenciesGeneratorTest.missingResourcePackDependency
    );
    expect(depErrors.length).to.equal(0);
  });

  it("should report missingResourcePackDependency when a dependency uuid is not found in any pack", async () => {
    // RP depends on UUID_MISSING, which is not the uuid of any manifest in the project
    const rpFile = createStubFile({
      name: "manifest.json",
      content: makeRpManifestJson(UUID_RP, [{ uuid: UUID_MISSING }]),
    });
    const rpItem = createStubProjectItem({ itemType: ProjectItemType.resourcePackManifestJson, file: rpFile });
    const results = await generator.generate(createStubProject([rpItem]));
    const depErrors = results.filter(
      (r) => r.generatorIndex === CheckResourcePackDependenciesGeneratorTest.missingResourcePackDependency
    );
    expect(depErrors.length).to.equal(1);
  });
});
