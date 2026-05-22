// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { assert } from "chai";
import CooperativeAddOnRequirementsGenerator, {
  CooperativeAddOnRequirementsGeneratorTest,
} from "./CooperativeAddOnRequirementsGenerator";
import { createStubProject } from "../../../test/stubs/app/projects/StubProject";
import { createStubProjectItem } from "../../../test/stubs/app/projects/StubProjectItem";
import { createStubFile } from "../../../test/stubs/app/io/StubFile";
import { ProjectItemType } from "../../../app/IProjectItemData";
import { InfoItemType } from "../../IInfoItemData";

// Stable UUIDs for testing cross-dependencies
const BP_UUID = "11111111-1111-1111-1111-111111111111";
const RP_UUID = "22222222-2222-2222-2222-222222222222";
const OTHER_UUID = "33333333-3333-3333-3333-333333333333";

function makeBpManifestJson(uuid: string, deps?: { uuid: string }[]): string {
  const obj: any = {
    format_version: 2,
    header: { uuid, name: "TestBP", description: "", version: [1, 0, 0] },
    modules: [],
  };
  if (deps !== undefined) {
    obj.dependencies = deps;
  }
  return JSON.stringify(obj);
}

function makeRpManifestJson(uuid: string, deps?: { uuid: string }[]): string {
  const obj: any = {
    format_version: 2,
    header: { uuid, name: "TestRP", description: "", version: [1, 0, 0] },
    modules: [],
  };
  if (deps !== undefined) {
    obj.dependencies = deps;
  }
  return JSON.stringify(obj);
}

describe("CooperativeAddOnRequirementsGenerator", () => {
  const gen = new CooperativeAddOnRequirementsGenerator();

  it("has expected id and title", () => {
    assert.strictEqual(gen.id, "CADDONREQ");
    assert.strictEqual(gen.title, "Cooperative Add-On Requirements");
  });

  it("reports missing BP and RP manifests for empty project", async () => {
    const project = createStubProject([], [], {
      getDefaultBehaviorPackFolder: async () => null,
      getDefaultResourcePackFolder: async () => null,
    });
    const results = await gen.generate(project, {} as any);

    const errorIds = results.map((r) => r.generatorIndex);
    assert.include(
      errorIds,
      CooperativeAddOnRequirementsGeneratorTest.behaviorPackManifestNotValid,
      "should report missing BP manifest"
    );
    assert.include(
      errorIds,
      CooperativeAddOnRequirementsGeneratorTest.resourcePackManifestNotValid,
      "should report missing RP manifest"
    );
  });

  it("reports missing RP manifest and foundBehaviorPack when only BP present", async () => {
    const bpFile = createStubFile({ name: "manifest.json", content: makeBpManifestJson(BP_UUID, [{ uuid: RP_UUID }]) });
    const bpItem = createStubProjectItem({
      itemType: ProjectItemType.behaviorPackManifestJson,
      file: bpFile,
    });
    const project = createStubProject([bpItem], [], {
      getDefaultBehaviorPackFolder: async () => null,
      getDefaultResourcePackFolder: async () => null,
    });

    const results = await gen.generate(project, {} as any);
    const errorIds = results.map((r) => r.generatorIndex);

    assert.include(errorIds, CooperativeAddOnRequirementsGeneratorTest.foundBehaviorPack);
    assert.include(errorIds, CooperativeAddOnRequirementsGeneratorTest.resourcePackManifestNotValid);
  });

  it("reports notOneBehaviorPackManifest when two BP manifests found", async () => {
    const bpFile1 = createStubFile({
      name: "manifest.json",
      content: makeBpManifestJson(BP_UUID, [{ uuid: RP_UUID }]),
    });
    const bpFile2 = createStubFile({
      name: "manifest.json",
      content: makeBpManifestJson(OTHER_UUID, [{ uuid: RP_UUID }]),
    });
    const bpItem1 = createStubProjectItem({
      itemType: ProjectItemType.behaviorPackManifestJson,
      file: bpFile1,
      name: "manifest.json",
    });
    const bpItem2 = createStubProjectItem({
      itemType: ProjectItemType.behaviorPackManifestJson,
      file: bpFile2,
      name: "manifest2.json",
    });
    const project = createStubProject([bpItem1, bpItem2], [], {
      getDefaultBehaviorPackFolder: async () => null,
      getDefaultResourcePackFolder: async () => null,
    });

    const results = await gen.generate(project, {} as any);
    const errorIds = results.map((r) => r.generatorIndex);
    assert.include(errorIds, CooperativeAddOnRequirementsGeneratorTest.notOneBehaviorPackManifest);
  });

  it("reports notOneResourcePackManifest when two RP manifests found", async () => {
    const rpFile1 = createStubFile({
      name: "manifest.json",
      content: makeRpManifestJson(RP_UUID, [{ uuid: BP_UUID }]),
    });
    const rpFile2 = createStubFile({
      name: "manifest.json",
      content: makeRpManifestJson(OTHER_UUID, [{ uuid: BP_UUID }]),
    });
    const rpItem1 = createStubProjectItem({
      itemType: ProjectItemType.resourcePackManifestJson,
      file: rpFile1,
      name: "manifest.json",
    });
    const rpItem2 = createStubProjectItem({
      itemType: ProjectItemType.resourcePackManifestJson,
      file: rpFile2,
      name: "manifest2.json",
    });
    const project = createStubProject([rpItem1, rpItem2], [], {
      getDefaultBehaviorPackFolder: async () => null,
      getDefaultResourcePackFolder: async () => null,
    });

    const results = await gen.generate(project, {} as any);
    const errorIds = results.map((r) => r.generatorIndex);
    assert.include(errorIds, CooperativeAddOnRequirementsGeneratorTest.notOneResourcePackManifest);
  });

  it("produces only foundBehaviorPack info when BP and RP have correct cross-dependencies", async () => {
    const bpFile = createStubFile({ name: "manifest.json", content: makeBpManifestJson(BP_UUID, [{ uuid: RP_UUID }]) });
    const rpFile = createStubFile({ name: "manifest.json", content: makeRpManifestJson(RP_UUID, [{ uuid: BP_UUID }]) });
    const bpItem = createStubProjectItem({
      itemType: ProjectItemType.behaviorPackManifestJson,
      file: bpFile,
    });
    const rpItem = createStubProjectItem({
      itemType: ProjectItemType.resourcePackManifestJson,
      file: rpFile,
    });
    const project = createStubProject([bpItem, rpItem], [], {
      getDefaultBehaviorPackFolder: async () => null,
      getDefaultResourcePackFolder: async () => null,
    });

    const results = await gen.generate(project, {} as any);

    const errors = results.filter((r) => r.itemType === InfoItemType.error);
    assert.lengthOf(errors, 0, "should have no errors with valid cross-dependencies");

    const infoIds = results.map((r) => r.generatorIndex);
    assert.include(infoIds, CooperativeAddOnRequirementsGeneratorTest.foundBehaviorPack);
  });

  it("reports notOneDependencyFromBehaviorPackToResourcePack when BP has no dependencies", async () => {
    const bpFile = createStubFile({ name: "manifest.json", content: makeBpManifestJson(BP_UUID) });
    const rpFile = createStubFile({ name: "manifest.json", content: makeRpManifestJson(RP_UUID, [{ uuid: BP_UUID }]) });
    const bpItem = createStubProjectItem({
      itemType: ProjectItemType.behaviorPackManifestJson,
      file: bpFile,
    });
    const rpItem = createStubProjectItem({
      itemType: ProjectItemType.resourcePackManifestJson,
      file: rpFile,
    });
    const project = createStubProject([bpItem, rpItem], [], {
      getDefaultBehaviorPackFolder: async () => null,
      getDefaultResourcePackFolder: async () => null,
    });

    const results = await gen.generate(project, {} as any);
    const errorIds = results.map((r) => r.generatorIndex);
    assert.include(errorIds, CooperativeAddOnRequirementsGeneratorTest.notOneDependencyFromBehaviorPackToResourcePack);
  });

  it("reports dependencyFromBehaviorPackToResourcePackNotValid when BP dep uuid does not match RP header", async () => {
    const bpFile = createStubFile({
      name: "manifest.json",
      content: makeBpManifestJson(BP_UUID, [{ uuid: OTHER_UUID }]),
    });
    const rpFile = createStubFile({ name: "manifest.json", content: makeRpManifestJson(RP_UUID, [{ uuid: BP_UUID }]) });
    const bpItem = createStubProjectItem({
      itemType: ProjectItemType.behaviorPackManifestJson,
      file: bpFile,
    });
    const rpItem = createStubProjectItem({
      itemType: ProjectItemType.resourcePackManifestJson,
      file: rpFile,
    });
    const project = createStubProject([bpItem, rpItem], [], {
      getDefaultBehaviorPackFolder: async () => null,
      getDefaultResourcePackFolder: async () => null,
    });

    const results = await gen.generate(project, {} as any);
    const errorIds = results.map((r) => r.generatorIndex);
    assert.include(
      errorIds,
      CooperativeAddOnRequirementsGeneratorTest.dependencyFromBehaviorPackToResourcePackNotValid
    );
  });

  it("reports notOneDependencyFromResourcePackToBehaviorPack when RP has no dependencies", async () => {
    const bpFile = createStubFile({ name: "manifest.json", content: makeBpManifestJson(BP_UUID, [{ uuid: RP_UUID }]) });
    const rpFile = createStubFile({ name: "manifest.json", content: makeRpManifestJson(RP_UUID) });
    const bpItem = createStubProjectItem({
      itemType: ProjectItemType.behaviorPackManifestJson,
      file: bpFile,
    });
    const rpItem = createStubProjectItem({
      itemType: ProjectItemType.resourcePackManifestJson,
      file: rpFile,
    });
    const project = createStubProject([bpItem, rpItem], [], {
      getDefaultBehaviorPackFolder: async () => null,
      getDefaultResourcePackFolder: async () => null,
    });

    const results = await gen.generate(project, {} as any);
    const errorIds = results.map((r) => r.generatorIndex);
    assert.include(errorIds, CooperativeAddOnRequirementsGeneratorTest.notOneDependencyFromResourcePackToBehaviorPack);
  });

  it("reports dependencyFromResourcePackToBehaviorPackNotValid when RP dep uuid does not match BP header", async () => {
    const bpFile = createStubFile({ name: "manifest.json", content: makeBpManifestJson(BP_UUID, [{ uuid: RP_UUID }]) });
    const rpFile = createStubFile({
      name: "manifest.json",
      content: makeRpManifestJson(RP_UUID, [{ uuid: OTHER_UUID }]),
    });
    const bpItem = createStubProjectItem({
      itemType: ProjectItemType.behaviorPackManifestJson,
      file: bpFile,
    });
    const rpItem = createStubProjectItem({
      itemType: ProjectItemType.resourcePackManifestJson,
      file: rpFile,
    });
    const project = createStubProject([bpItem, rpItem], [], {
      getDefaultBehaviorPackFolder: async () => null,
      getDefaultResourcePackFolder: async () => null,
    });

    const results = await gen.generate(project, {} as any);
    const errorIds = results.map((r) => r.generatorIndex);
    assert.include(
      errorIds,
      CooperativeAddOnRequirementsGeneratorTest.dependencyFromResourcePackToBehaviorPackNotValid
    );
  });
});
