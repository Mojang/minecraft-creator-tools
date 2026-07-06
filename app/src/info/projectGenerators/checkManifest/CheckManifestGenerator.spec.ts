// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { expect } from "chai";
import CheckManifestGenerator from "./CheckManifestGenerator";
import { Tests } from "./CheckManifestData";
import { createStubProjectItem } from "../../../test/stubs/app/projects/StubProjectItem";
import { createStubPack } from "../../../test/stubs/app/projects/StubPack";

import { PackType } from "../../../minecraft/Pack";
import { ProjectItemType } from "../../../app/IProjectItemData";
import {
  createManifestHeaderJson,
  createManifestJson,
  MANIFEST_UUID_HEADER,
  MANIFEST_UUID_MODULE_1,
  MANIFEST_UUID_MODULE_2,
} from "../../../test/stubs/app/json/ManifestFixtures";

describe("CheckManifestGenerator", () => {
  let generator: CheckManifestGenerator;

  beforeEach(() => {
    generator = new CheckManifestGenerator();
  });

  it("should have correct id and title", () => {
    expect(generator.id).to.equal("CHKMANIF");
    expect(generator.title).to.be.a("string").and.have.length.above(0);
  });

  describe("schema validation", () => {
    it("should report InvalidManifestSchema when manifest JSON is missing required fields", async () => {
      const item = createStubProjectItem({ json: {} });
      const results = await generator.validateManifest(item, { type: PackType.resource });
      const errors = results.filter((r) => r.generatorIndex === Tests.InvalidManifestSchema.id);
      expect(errors.length).to.be.above(0);
    });
  });

  describe("format version validation", () => {
    it("should report InvalidFormatVersion for an unknown format version", async () => {
      const item = createStubProjectItem({ json: createManifestJson({ format_version: 99 }) });
      const results = await generator.validateManifest(item, { type: PackType.resource });
      const errors = results.filter((r) => r.generatorIndex === Tests.InvalidFormatVersion.id);
      expect(errors.length).to.equal(1);
    });

    it("should report InvalidFormatVersion for format version 1 on a behavior pack", async () => {
      const item = createStubProjectItem({ json: createManifestJson({ format_version: 1 }) });
      const results = await generator.validateManifest(item, { type: PackType.behavior });
      const errors = results.filter((r) => r.generatorIndex === Tests.InvalidFormatVersion.id);
      expect(errors.length).to.equal(1);
    });

    it("should not report format version errors for a valid format version 2 resource pack", async () => {
      const item = createStubProjectItem({ json: createManifestJson() });
      const results = await generator.validateManifest(item, { type: PackType.resource });
      const errors = results.filter((r) => r.generatorIndex === Tests.InvalidFormatVersion.id);
      expect(errors.length).to.equal(0);
    });
  });

  describe("UUID validation", () => {
    it("should report InvalidId for a malformed header UUID", async () => {
      const item = createStubProjectItem({
        json: createManifestJson({ header: createManifestHeaderJson({ uuid: "not-a-valid-uuid" }) }),
      });
      const results = await generator.validateManifest(item, { type: PackType.resource });
      const errors = results.filter((r) => r.generatorIndex === Tests.InvalidId.id);
      expect(errors.length).to.equal(1);
    });

    it("should report DuplicateId when the header and a module share the same UUID", async () => {
      const item = createStubProjectItem({
        json: createManifestJson({
          header: createManifestHeaderJson({ uuid: MANIFEST_UUID_HEADER }),
          modules: [{ type: "resources", uuid: MANIFEST_UUID_HEADER, version: [1, 0, 0] }],
        }),
      });
      const results = await generator.validateManifest(item, { type: PackType.resource });
      const errors = results.filter((r) => r.generatorIndex === Tests.DuplicateId.id);
      expect(errors.length).to.equal(1);
    });
  });

  describe("module validation", () => {
    it("should report InvalidModuleType for an unknown module type", async () => {
      const item = createStubProjectItem({
        json: createManifestJson({
          modules: [{ type: "unknown_type", uuid: MANIFEST_UUID_MODULE_1, version: [1, 0, 0] }],
        }),
      });
      const results = await generator.validateManifest(item, { type: PackType.resource });
      const errors = results.filter((r) => r.generatorIndex === Tests.InvalidModuleType.id);
      expect(errors.length).to.equal(1);
    });

    it("should report TooManyWorldTemplates when there are two world_template modules", async () => {
      const item = createStubProjectItem({
        json: createManifestJson({
          modules: [
            { type: "world_template", uuid: MANIFEST_UUID_MODULE_1, version: [1, 0, 0] },
            { type: "world_template", uuid: MANIFEST_UUID_MODULE_2, version: [1, 0, 0] },
          ],
        }),
      });
      const results = await generator.validateManifest(item, { type: PackType.resource });
      const errors = results.filter((r) => r.generatorIndex === Tests.TooManyWorldTemplates.id);
      expect(errors.length).to.equal(1);
    });
  });

  describe("header validation", () => {
    it("should report MissingHeaderProperty when description is absent for a non-skin pack", async () => {
      const item = createStubProjectItem({
        json: createManifestJson({ header: createManifestHeaderJson({ description: undefined }) }),
      });
      const results = await generator.validateManifest(item, { type: PackType.resource });
      const errors = results.filter((r) => r.generatorIndex === Tests.MissingHeaderProperty.id);
      expect(errors.length).to.equal(1);
    });

    it("should not report MissingHeaderProperty when description is absent for a skin pack", async () => {
      const item = createStubProjectItem({
        json: createManifestJson({
          header: createManifestHeaderJson({ description: undefined }),
          modules: [{ type: "skin_pack", uuid: MANIFEST_UUID_MODULE_1, version: [1, 0, 0] }],
        }),
      });
      const results = await generator.validateManifest(item, { type: PackType.skin });
      const errors = results.filter((r) => r.generatorIndex === Tests.MissingHeaderProperty.id);
      expect(errors.length).to.equal(0);
    });
  });

  describe("dependency validation", () => {
    it("should report NoDependencyIdentifier for a dependency with neither uuid nor module_name", async () => {
      const item = createStubProjectItem({
        json: createManifestJson({
          dependencies: [{ version: [1, 0, 0] }],
        }),
      });
      const results = await generator.validateManifest(item, { type: PackType.resource });
      const errors = results.filter((r) => r.generatorIndex === Tests.NoDependencyIdentifier.id);
      expect(errors.length).to.equal(1);
    });

    it("should report MultipleDependencyIdentifier for a dependency with both uuid and module_name", async () => {
      const item = createStubProjectItem({
        json: createManifestJson({
          dependencies: [{ uuid: MANIFEST_UUID_MODULE_1, module_name: "@minecraft/server", version: "1.1.0" }],
        }),
      });
      const results = await generator.validateManifest(item, { type: PackType.resource });
      const errors = results.filter((r) => r.generatorIndex === Tests.MultipleDependencyIdentifier.id);
      expect(errors.length).to.equal(1);
    });
  });

  describe("capability validation", () => {
    it("should report InvalidCapability for an unknown capability", async () => {
      const item = createStubProjectItem({
        json: createManifestJson({ capabilities: ["magic"] }),
      });
      const results = await generator.validateManifest(item, { type: PackType.resource });
      const errors = results.filter((r) => r.generatorIndex === Tests.InvalidCapability.id);
      expect(errors.length).to.equal(1);
    });

    it("should not report InvalidCapability for the known 'pbr' capability at a sufficient engine version", async () => {
      const item = createStubProjectItem({
        json: createManifestJson({
          capabilities: ["pbr"],
          header: createManifestHeaderJson({ min_engine_version: [1, 21, 120] }),
        }),
        itemType: ProjectItemType.resourcePackManifestJson,
      });
      const results = await generator.validateManifest(item, { type: PackType.resource });
      const errors = results.filter((r) => r.generatorIndex === Tests.InvalidCapability.id);
      expect(errors.length).to.equal(0);
    });
  });

  describe("PBR / Vibrant Visuals capability checks", () => {
    it("should report MinEngineVersionForVV when pbr capability is used with min_engine_version below target", async () => {
      const item = createStubProjectItem({
        json: createManifestJson({
          capabilities: ["pbr"],
          header: createManifestHeaderJson({ min_engine_version: [1, 20, 0] }),
        }),
        itemType: ProjectItemType.resourcePackManifestJson,
      });
      const results = await generator.validateManifest(item, { type: PackType.resource });
      const errors = results.filter((r) => r.generatorIndex === Tests.MinEngineVersionForVV.id);
      expect(errors.length).to.equal(1);
    });

    it("should report HasPBRFilesButNoManifestCapability when a pack has VV content but no pbr capability", async () => {
      const item = createStubProjectItem({
        json: createManifestJson(),
        itemType: ProjectItemType.resourcePackManifestJson,
      });
      const pack = createStubPack({ packType: PackType.resource, hasVibrantVisualsContent: true });
      const results = await generator.validateManifest(item, pack);
      const errors = results.filter((r) => r.generatorIndex === Tests.HasPBRFilesButNoManifestCapability.id);
      expect(errors.length).to.equal(1);
    });

    // Regression for bug 1611504: VV content in one resource pack must not cause a sibling pack
    // (with no VV content of its own) to fail VV/PBR validation. The flag is read per-pack, so a
    // pack that reports no VV content stays valid regardless of what other packs in the submission do.
    it("should NOT report HasPBRFilesButNoManifestCapability for a sibling pack with no VV content", async () => {
      const nonVvItem = createStubProjectItem({
        json: createManifestJson(),
        itemType: ProjectItemType.resourcePackManifestJson,
      });
      const nonVvPack = createStubPack({ packType: PackType.resource, hasVibrantVisualsContent: false });
      const results = await generator.validateManifest(nonVvItem, nonVvPack);
      const errors = results.filter((r) => r.generatorIndex === Tests.HasPBRFilesButNoManifestCapability.id);
      expect(errors.length).to.equal(0);
    });

    it("should evaluate each pack independently in a mixed multi-pack submission", async () => {
      // RP A: has VV content, manifest omits the pbr capability -> should be flagged.
      const vvItem = createStubProjectItem({
        json: createManifestJson(),
        itemType: ProjectItemType.resourcePackManifestJson,
      });
      const vvPack = createStubPack({ packType: PackType.resource, hasVibrantVisualsContent: true });

      // RP B: no VV content, same (capability-free) manifest -> should remain valid.
      const nonVvItem = createStubProjectItem({
        json: createManifestJson(),
        itemType: ProjectItemType.resourcePackManifestJson,
      });
      const nonVvPack = createStubPack({ packType: PackType.resource, hasVibrantVisualsContent: false });

      const vvResults = await generator.validateManifest(vvItem, vvPack);
      const nonVvResults = await generator.validateManifest(nonVvItem, nonVvPack);

      const testId = Tests.HasPBRFilesButNoManifestCapability.id;
      expect(vvResults.filter((r) => r.generatorIndex === testId).length).to.equal(1);
      expect(nonVvResults.filter((r) => r.generatorIndex === testId).length).to.equal(0);
    });
  });

  describe("settings validation", () => {
    it("should report NotEnoughSettingsOptions for a dropdown with fewer than the minimum required options", async () => {
      const item = createStubProjectItem({
        json: createManifestJson({
          settings: [
            {
              type: "dropdown",
              text: "My Dropdown",
              name: "setting1",
              default: "missing_option",
              options: [{ name: "opt1", text: "Option 1" }],
            },
          ],
        }),
      });
      const results = await generator.validateManifest(item, { type: PackType.resource });
      const errors = results.filter((r) => r.generatorIndex === Tests.NotEnoughSettingsOptions.id);
      expect(errors.length).to.equal(1);
    });

    it("should report InvalidSettingsMin for a slider where min is greater than max", async () => {
      const item = createStubProjectItem({
        json: createManifestJson({
          settings: [
            {
              type: "slider",
              text: "My Slider",
              name: "setting2",
              min: 10,
              max: 5,
              step: 1,
              default: 7,
            },
          ],
        }),
      });
      const results = await generator.validateManifest(item, { type: PackType.resource });
      const errors = results.filter((r) => r.generatorIndex === Tests.InvalidSettingsMin.id);
      expect(errors.length).to.equal(1);
    });
  });
});
