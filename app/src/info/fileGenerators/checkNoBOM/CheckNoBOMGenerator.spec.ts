// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { expect } from "chai";
import CheckNoBOMGenerator from "./CheckNoBOMGenerator";
import { CheckNoBOMGeneratorTest } from "./CheckNoBOMGeneratorData";
import { createStubFile } from "../../../test/stubs/app/io/StubFile";
import { createStubProject } from "../../../test/stubs/app/projects/StubProject";
import { InfoItemType } from "../../IInfoItemData";

const project = createStubProject();

// BOM bytes: UTF-8 byte order mark (0xEF 0xBB 0xBF) followed by valid JSON "{}"
const BOM_JSON_CONTENT = new Uint8Array([0xef, 0xbb, 0xbf, 0x7b, 0x7d]);
const CLEAN_JSON_CONTENT = '{"key": "value"}';

describe("CheckNoBOMGenerator", () => {
  let generator: CheckNoBOMGenerator;

  beforeEach(() => {
    generator = new CheckNoBOMGenerator();
  });

  it("should have correct id and title", () => {
    expect(generator.id).to.equal("NOBOM");
    expect(generator.title).to.be.a("string").and.have.length.above(0);
  });

  const cases = [
    {
      label: "non-JSON file (.txt) with BOM content",
      file: () => createStubFile({ name: "readme.txt", content: BOM_JSON_CONTENT }),
      expectedErrors: 0,
    },
    {
      label: "JSON file with null content",
      file: () => createStubFile({ name: "manifest.json", content: null }),
      expectedErrors: 0,
    },
    {
      label: "JSON file with clean string content",
      file: () => createStubFile({ name: "manifest.json", content: CLEAN_JSON_CONTENT }),
      expectedErrors: 0,
    },
    {
      label: "JSON file with UTF-8 BOM",
      file: () => createStubFile({ name: "manifest.json", content: BOM_JSON_CONTENT }),
      expectedErrors: 1,
    },
  ];

  for (const { label, file, expectedErrors } of cases) {
    it(`should return ${expectedErrors} error(s) for: ${label}`, async () => {
      const results = await generator.generate(project, file());
      const errors = results.filter((r) => r.itemType === InfoItemType.error);
      expect(errors.length).to.equal(expectedErrors);
    });
  }

  it("should report the correct generator id, index, and file name in the error result", async () => {
    const file = createStubFile({ name: "manifest.json", content: BOM_JSON_CONTENT });
    const results = await generator.generate(project, file);

    expect(results.length).to.equal(1);
    const item = results[0];
    expect(item.itemType).to.equal(InfoItemType.error);
    expect(item.generatorId).to.equal("NOBOM");
    expect(item.generatorIndex).to.equal(CheckNoBOMGeneratorTest.NoByteOrderMarkAllowedInJsonFile);
    expect(item.message).to.include("manifest.json");
  });
});
