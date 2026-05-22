// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { expect } from "chai";
import CheckLangFilesGenerator from "./CheckLangFilesGenerator";
import { CheckLangFilesTests } from "./CheckLangFilesData";
import { createStubProject } from "../../../test/stubs/app/projects/StubProject";
import { createStubProjectItem } from "../../../test/stubs/app/projects/StubProjectItem";
import { createStubFile } from "../../../test/stubs/app/io/StubFile";
import { createStubPack } from "../../../test/stubs/app/projects/StubPack";
import { ProjectItemType } from "../../../app/IProjectItemData";

// Helper to make a catalog item whose file contains a JSON array of lang codes
function makeCatalogItem(langs: string[]) {
  const file = createStubFile({ name: "languages.json", content: JSON.stringify(langs) });
  return createStubProjectItem({ itemType: ProjectItemType.languagesCatalogJson, file });
}

// Helper to make a lang item representing a .lang file for the given code
function makeLangItem(langCode: string) {
  return createStubProjectItem({ itemType: ProjectItemType.lang, name: `${langCode}.lang` });
}

describe("CheckLangFilesGenerator", () => {
  let generator: CheckLangFilesGenerator;

  beforeEach(() => {
    generator = new CheckLangFilesGenerator();
  });

  it("should have correct id and title", () => {
    expect(generator.id).to.equal("LANGFILES");
    expect(generator.title).to.be.a("string").and.have.length.above(0);
  });

  it("should return no results for a project with no packs", async () => {
    const results = await generator.generate(createStubProject());
    expect(results.length).to.equal(0);
  });

  it("should report MissingLanguagesJson when pack has no languages.json catalog item", async () => {
    const pack = createStubPack({ items: [] });
    const results = await generator.generate(createStubProject([], [pack]));
    const errors = results.filter((r) => r.generatorIndex === CheckLangFilesTests.MissingLanguagesJson.id);
    expect(errors.length).to.equal(1);
  });

  it("should return no results for a valid pack where catalog and lang files match", async () => {
    const catalog = makeCatalogItem(["en_US", "fr_FR"]);
    const enUs = makeLangItem("en_US");
    const frFr = makeLangItem("fr_FR");
    const pack = createStubPack({ items: [catalog, enUs, frFr] });
    const results = await generator.generate(createStubProject([], [pack]));
    expect(results.length).to.equal(0);
  });

  it("should report PrimaryLangMissing when en_US is not in the catalog", async () => {
    const catalog = makeCatalogItem(["fr_FR"]);
    const frFr = makeLangItem("fr_FR");
    const pack = createStubPack({ items: [catalog, frFr] });
    const results = await generator.generate(createStubProject([], [pack]));
    const errors = results.filter((r) => r.generatorIndex === CheckLangFilesTests.PrimaryLangMissing.id);
    expect(errors.length).to.equal(1);
  });

  it("should report LangFileMissing when a catalog entry has no corresponding lang file", async () => {
    const catalog = makeCatalogItem(["en_US", "fr_FR"]);
    const enUs = makeLangItem("en_US");
    // fr_FR is in the catalog but there is no fr_FR.lang file
    const pack = createStubPack({ items: [catalog, enUs] });
    const results = await generator.generate(createStubProject([], [pack]));
    const errors = results.filter((r) => r.generatorIndex === CheckLangFilesTests.LangFileMissing.id);
    expect(errors.length).to.equal(1);
  });

  it("should report ExtraLangFile when a lang file is not listed in the catalog", async () => {
    const catalog = makeCatalogItem(["en_US"]);
    const enUs = makeLangItem("en_US");
    const frFr = makeLangItem("fr_FR"); // not in catalog
    const pack = createStubPack({ items: [catalog, enUs, frFr] });
    const results = await generator.generate(createStubProject([], [pack]));
    const errors = results.filter((r) => r.generatorIndex === CheckLangFilesTests.ExtraLangFile.id);
    expect(errors.length).to.equal(1);
  });

  it("should report FailedToParseFile when languages.json content is not a valid lang array", async () => {
    // An object (not an array) fails the JSON schema check for string[]
    const file = createStubFile({ name: "languages.json", content: '{"not": "an array"}' });
    const catalog = createStubProjectItem({ itemType: ProjectItemType.languagesCatalogJson, file });
    const pack = createStubPack({ items: [catalog] });
    const results = await generator.generate(createStubProject([], [pack]));
    const errors = results.filter((r) => r.generatorIndex === CheckLangFilesTests.FailedToParseFile.id);
    expect(errors.length).to.be.above(0);
  });
});
