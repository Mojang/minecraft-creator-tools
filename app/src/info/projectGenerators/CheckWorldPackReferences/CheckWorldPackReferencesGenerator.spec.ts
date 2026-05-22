// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { expect } from "chai";
import CheckWorldPackReferencesGenerator, {
  CheckWorldPackReferencesGeneratorTest,
} from "./CheckWorldPackReferencesGenerator";
import {
  VALID_RESOURCE_MANIFEST_JSON,
  VALID_PACK_REF_JSON,
  INVALID_PACK_REF_NOT_ARRAY_JSON,
  INVALID_PACK_REF_BAD_UUID_JSON,
  PACK_REF_UNKNOWN_UUID_JSON,
} from "./CheckWorldPackReferencesGeneratorData";
import { createStubProject } from "../../../test/stubs/app/projects/StubProject";
import { createStubProjectItem } from "../../../test/stubs/app/projects/StubProjectItem";
import { createStubFile } from "../../../test/stubs/app/io/StubFile";
import { ProjectItemType } from "../../../app/IProjectItemData";

describe("CheckWorldPackReferencesGenerator", () => {
  let generator: CheckWorldPackReferencesGenerator;

  beforeEach(() => {
    generator = new CheckWorldPackReferencesGenerator();
  });

  it("should have correct id and title", () => {
    expect(generator.id).to.equal("WPACKREFS");
    expect(generator.title).to.be.a("string").and.have.length.above(0);
  });

  it("should return no results for a project with no pack list or manifest items", async () => {
    const results = await generator.generate(createStubProject());
    expect(results.length).to.equal(0);
  });

  it("should flag an invalid pack reference file that is not a JSON array", async () => {
    const file = createStubFile({ name: "world_resource_packs.json", content: INVALID_PACK_REF_NOT_ARRAY_JSON });
    const packRefItem = createStubProjectItem({
      itemType: ProjectItemType.resourcePackListJson,
      name: "world_resource_packs.json",
      file,
    });
    const results = await generator.generate(createStubProject([packRefItem]));
    const errors = results.filter(
      (r) => r.generatorIndex === CheckWorldPackReferencesGeneratorTest.invalidWorldPackReferencesJson
    );
    expect(errors.length).to.equal(1);
  });

  it("should flag a pack reference with an invalid UUID format", async () => {
    const file = createStubFile({ name: "world_resource_packs.json", content: INVALID_PACK_REF_BAD_UUID_JSON });
    const packRefItem = createStubProjectItem({
      itemType: ProjectItemType.resourcePackListJson,
      name: "world_resource_packs.json",
      file,
    });
    const results = await generator.generate(createStubProject([packRefItem]));
    const errors = results.filter((r) => r.generatorIndex === CheckWorldPackReferencesGeneratorTest.invalidPackId);
    expect(errors.length).to.equal(1);
  });

  it("should flag a pack reference whose UUID is not found in any project manifest", async () => {
    const file = createStubFile({ name: "world_resource_packs.json", content: PACK_REF_UNKNOWN_UUID_JSON });
    const packRefItem = createStubProjectItem({
      itemType: ProjectItemType.resourcePackListJson,
      name: "world_resource_packs.json",
      file,
    });
    const results = await generator.generate(createStubProject([packRefItem]));
    const errors = results.filter(
      (r) => r.generatorIndex === CheckWorldPackReferencesGeneratorTest.packReferenceNotFound
    );
    expect(errors.length).to.equal(1);
  });

  it("should produce no errors when a pack reference matches a registered manifest UUID", async () => {
    const manifestFile = createStubFile({ name: "manifest.json", content: VALID_RESOURCE_MANIFEST_JSON });
    const manifestItem = createStubProjectItem({
      itemType: ProjectItemType.resourcePackManifestJson,
      name: "manifest.json",
      file: manifestFile,
    });

    const packRefFile = createStubFile({ name: "world_resource_packs.json", content: VALID_PACK_REF_JSON });
    const packRefItem = createStubProjectItem({
      itemType: ProjectItemType.resourcePackListJson,
      name: "world_resource_packs.json",
      file: packRefFile,
    });

    const results = await generator.generate(createStubProject([manifestItem, packRefItem]));
    const packRefErrors = results.filter(
      (r) =>
        r.generatorIndex === CheckWorldPackReferencesGeneratorTest.packReferenceNotFound ||
        r.generatorIndex === CheckWorldPackReferencesGeneratorTest.invalidPackId ||
        r.generatorIndex === CheckWorldPackReferencesGeneratorTest.invalidWorldPackReferencesJson
    );
    expect(packRefErrors.length).to.equal(0);
  });
});
