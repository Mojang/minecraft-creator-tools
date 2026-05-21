// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { expect } from "chai";
import CheckSkinPackJsonGenerator from "./CheckSkinPackJsonGenerator";
import { CheckSkinPackJsonTests } from "./CheckSkinPackJsonData";
import { createStubProject } from "../../../test/stubs/app/projects/StubProject";
import { createStubProjectItem } from "../../../test/stubs/app/projects/StubProjectItem";
import { createStubPack } from "../../../test/stubs/app/projects/StubPack";
import { ProjectItemType } from "../../../app/IProjectItemData";

describe("CheckSkinPackJsonGenerator", () => {
  let generator: CheckSkinPackJsonGenerator;

  beforeEach(() => {
    generator = new CheckSkinPackJsonGenerator();
  });

  it("should have correct id and title", () => {
    expect(generator.id).to.equal("CSPJ");
    expect(generator.title).to.be.a("string").and.have.length.above(0);
  });

  it("should return no results when there are no skin pack manifest items", async () => {
    // getItemsByType returns [] → for loop body never executes → empty results
    const results = await generator.generate(createStubProject());
    expect(results.length).to.equal(0);
  });

  it("should report CouldNotFindRelatedPack when getPack() returns null", async () => {
    const skinManifestItem = createStubProjectItem({
      itemType: ProjectItemType.skinPackManifestJson,
      name: "manifest.json",
      getPack: async () => null,
    });
    const results = await generator.generate(createStubProject([skinManifestItem]));
    const errors = results.filter((r) => r.generatorIndex === CheckSkinPackJsonTests.CouldNotFindRelatedPack.id);
    expect(errors.length).to.equal(1);
  });

  it("should report JsonNotFoundFile when the skin pack has no skins.json", async () => {
    // Pack has no skinCatalogJson item → getEnsuredFileOfType returns undefined → JsonNotFoundFile
    const pack = createStubPack({ items: [] });
    const skinManifestItem = createStubProjectItem({
      itemType: ProjectItemType.skinPackManifestJson,
      name: "manifest.json",
      getPack: async () => pack as any,
    });
    const results = await generator.generate(createStubProject([skinManifestItem]));
    const errors = results.filter((r) => r.generatorIndex === CheckSkinPackJsonTests.JsonNotFoundFile.id);
    expect(errors.length).to.equal(1);
  });
});
