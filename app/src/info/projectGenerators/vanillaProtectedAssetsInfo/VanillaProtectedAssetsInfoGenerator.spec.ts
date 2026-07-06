// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { expect } from "chai";
import { ProjectItemType } from "../../../app/IProjectItemData";
import { InfoItemType } from "../../IInfoItemData";
import { PackType } from "../../../minecraft/Pack";
import { createStubPack } from "../../../test/stubs/app/projects/StubPack";
import { createStubProject } from "../../../test/stubs/app/projects/StubProject";
import { createStubProjectItem } from "../../../test/stubs/app/projects/StubProjectItem";
import ProjectInfoSet from "../../ProjectInfoSet";
import GeneratorRegistrations, { TestsToExcludeFromDefaultSuite } from "../../registration/GeneratorRegistrations";
import VanillaProtectedAssetsInfoGenerator from "./VanillaProtectedAssetsInfoGenerator";
import { VanillaProtectedAssetsInfoGeneratorTest } from "./VanillaProtectedAssetsInfoGeneratorData";

describe("VanillaProtectedAssetsInfoGenerator", () => {
  let generator: VanillaProtectedAssetsInfoGenerator;

  beforeEach(() => {
    generator = new VanillaProtectedAssetsInfoGenerator();
  });

  it("should have correct id and title", () => {
    expect(generator.id).to.equal("VANPRO");
    expect(generator.title).to.be.a("string").and.have.length.above(0);
  });

  it("should return no results for a project with no items", async () => {
    const results = await generator.generate(createStubProject());
    expect(results.length).to.equal(0);
  });

  it("should be registered in the default generator set", () => {
    expect(GeneratorRegistrations.projectGenerators.some((projectGenerator) => projectGenerator.id === "VANPRO")).to.equal(
      true
    );
    expect(TestsToExcludeFromDefaultSuite).not.to.include("VANPRO");
  });

  it("should flag protected sulfur spring structures in behavior pack paths", async () => {
    const item = createStructureItem("/behavior_packs/test_bp/structures/sulfur_spring/foo.mcstructure");
    const pack = createStubPack({
      items: [item],
      packType: PackType.behavior,
      projectPath: "/behavior_packs/test_bp",
    });

    const results = await generator.generate(createStubProject([item], [pack]));

    const vanproResults = getVanproResults(results);

    expect(vanproResults.length).to.equal(1);
    expect(vanproResults[0].itemType).to.equal(InfoItemType.error);
  });

  it("should use behavior pack metadata even when the folder name does not look like a behavior pack", async () => {
    const item = createStructureItem("/custom_pack/structures/sulfur_spring/foo.mcstructure");
    const pack = createStubPack({
      items: [item],
      packType: PackType.behavior,
      projectPath: "/custom_pack",
    });

    const results = await generator.generate(createStubProject([item], [pack]));

    expect(getVanproResults(results).length).to.equal(1);
  });

  it("should not flag resource pack metadata with the same relative path", async () => {
    const item = createStructureItem("/resource_packs/test_rp/structures/sulfur_spring/foo.mcstructure");
    const pack = createStubPack({
      items: [item],
      packType: PackType.resource,
      projectPath: "/resource_packs/test_rp",
    });

    const results = await generator.generate(createStubProject([item], [pack]));

    expect(getVanproResults(results).length).to.equal(0);
  });

  it("should not flag world or non-pack paths", async () => {
    const item = createStructureItem("/worlds/test_world/structures/sulfur_spring/foo.mcstructure");

    const results = await generator.generate(createStubProject([item]));

    expect(getVanproResults(results).length).to.equal(0);
  });

  it("should not match similar path prefixes without a protected path boundary", async () => {
    const backupItem = createStructureItem("/behavior_packs/test_bp/structures/sulfur_spring_backup/foo.mcstructure");
    const numberedItem = createStructureItem("/behavior_packs/test_bp/structures/sulfur_spring2/foo.mcstructure");
    const pack = createStubPack({
      items: [backupItem, numberedItem],
      packType: PackType.behavior,
      projectPath: "/behavior_packs/test_bp",
    });

    const results = await generator.generate(createStubProject([backupItem, numberedItem], [pack]));

    expect(getVanproResults(results).length).to.equal(0);
  });

  it("should support additional protected paths without changing matching logic", async () => {
    const item = createStructureItem("/behavior_packs/test_bp/structures/another_protected_asset/foo.mcstructure");
    const customGenerator = new VanillaProtectedAssetsInfoGenerator([
      {
        packType: PackType.behavior,
        protectedPath: "structures/another_protected_asset/",
        displayPath: "behavior/structures/another_protected_asset",
      },
    ]);
    const pack = createStubPack({
      items: [item],
      packType: PackType.behavior,
      projectPath: "/behavior_packs/test_bp",
    });

    const results = await customGenerator.generate(createStubProject([item], [pack]));

    expect(getVanproResults(results).length).to.equal(1);
  });

  it("should use behavior pack path heuristics when pack metadata is unavailable", async () => {
    const item = createStructureItem("BP/structures/sulfur_spring/foo.mcstructure");

    const results = await generator.generate(createStubProject([item]));

    expect(getVanproResults(results).length).to.equal(1);
  });

  it("should only add summary counts when protected asset overrides are present", () => {
    const emptyInfo: { vanillaProtectedAssetOverrides?: number } = {};
    generator.summarize(emptyInfo, createCountingInfoSet(0));

    expect(emptyInfo).not.to.have.property("vanillaProtectedAssetOverrides");

    const infoWithFindings: { vanillaProtectedAssetOverrides?: number } = {};
    generator.summarize(infoWithFindings, createCountingInfoSet(2));

    expect(infoWithFindings.vanillaProtectedAssetOverrides).to.equal(2);
  });
});

function createStructureItem(projectPath: string) {
  return createStubProjectItem({
    itemType: ProjectItemType.structure,
    name: "foo.mcstructure",
    projectPath,
  });
}

function getVanproResults(results: { generatorId?: string; generatorIndex: number; itemType?: InfoItemType }[]) {
  return results.filter(
    (result) =>
      result.generatorId === "VANPRO" &&
      result.generatorIndex === VanillaProtectedAssetsInfoGeneratorTest.protectedVanillaAssetOverride
  );
}

function createCountingInfoSet(count: number): ProjectInfoSet {
  return new ProjectInfoSet(
    undefined,
    undefined,
    undefined,
    undefined,
    Array.from({ length: count }, () => ({
      iTp: InfoItemType.error,
      gId: "VANPRO",
      gIx: VanillaProtectedAssetsInfoGeneratorTest.protectedVanillaAssetOverride,
      m: undefined,
      p: undefined,
      d: undefined,
      iId: undefined,
      c: undefined,
      fs: undefined,
    }))
  );
}
