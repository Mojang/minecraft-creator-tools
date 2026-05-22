// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { expect } from "chai";
import CheckBetaFeaturesGenerator from "./CheckBetaFeaturesGenerator";
import { CheckBetaTests } from "./CheckBetaFeaturesData";
import { createStubProject } from "../../../test/stubs/app/projects/StubProject";
import { createStubProjectItem } from "../../../test/stubs/app/projects/StubProjectItem";
import { createStubFile } from "../../../test/stubs/app/io/StubFile";
import { ProjectItemType } from "../../../app/IProjectItemData";

const VALID_JSON = '{"format_version": 2}';
const BETA_JSON = '{"use_beta_features": true}';
const NO_BETA_JSON = '{"use_beta_features": false}';
const INVALID_JSON = "{{not valid json}}";

describe("CheckBetaFeaturesGenerator", () => {
  let generator: CheckBetaFeaturesGenerator;

  beforeEach(() => {
    generator = new CheckBetaFeaturesGenerator();
  });

  it("should have correct id and title", () => {
    expect(generator.id).to.equal("CBFG");
    expect(generator.title).to.be.a("string").and.have.length.above(0);
  });

  it("should return no results for an empty project", async () => {
    const project = createStubProject([]);
    const results = await generator.generate(project);
    expect(results.length).to.equal(0);
  });

  it("should ignore items with a non-matching type", async () => {
    const file = createStubFile({ name: "manifest.json", content: BETA_JSON });
    const item = createStubProjectItem({ itemType: ProjectItemType.resourcePackManifestJson, file });
    const project = createStubProject([item]);
    const results = await generator.generate(project);
    expect(results.length).to.equal(0);
  });

  it("should report FailedToReadFile when loadFileContent fails", async () => {
    // No file provided → loadFileContent returns undefined
    const item = createStubProjectItem({ itemType: ProjectItemType.behaviorPackManifestJson });
    const project = createStubProject([item]);
    const results = await generator.generate(project);
    expect(results.length).to.equal(1);
    expect(results[0].generatorIndex).to.equal(CheckBetaTests.FailedToReadFile.id);
  });

  it("should report FailedToParseJson when file content is not valid JSON", async () => {
    const file = createStubFile({ name: "manifest.json", content: INVALID_JSON });
    const item = createStubProjectItem({ itemType: ProjectItemType.behaviorPackManifestJson, file });
    const project = createStubProject([item]);
    const results = await generator.generate(project);
    expect(results.length).to.equal(1);
    expect(results[0].generatorIndex).to.equal(CheckBetaTests.FailedToParseJson.id);
  });

  it("should return no results for a valid JSON file without use_beta_features", async () => {
    const file = createStubFile({ name: "manifest.json", content: VALID_JSON });
    const item = createStubProjectItem({ itemType: ProjectItemType.behaviorPackManifestJson, file });
    const project = createStubProject([item]);
    const results = await generator.generate(project);
    expect(results.length).to.equal(0);
  });

  it("should return no results when use_beta_features is false", async () => {
    const file = createStubFile({ name: "entity.json", content: NO_BETA_JSON });
    const item = createStubProjectItem({ itemType: ProjectItemType.entityTypeBehavior, file });
    const project = createStubProject([item]);
    const results = await generator.generate(project);
    expect(results.length).to.equal(0);
  });

  it("should report UsingBetaFeatures when use_beta_features is true", async () => {
    const file = createStubFile({ name: "entity.json", content: BETA_JSON });
    const item = createStubProjectItem({ itemType: ProjectItemType.entityTypeBehavior, file });
    const project = createStubProject([item]);
    const results = await generator.generate(project);
    expect(results.length).to.equal(1);
    expect(results[0].generatorIndex).to.equal(CheckBetaTests.UsingBetaFeatures.id);
  });

  // All four types in JsonTypesToRead should be checked for use_beta_features
  const matchingTypes: [string, ProjectItemType][] = [
    ["behaviorPackManifestJson", ProjectItemType.behaviorPackManifestJson],
    ["entityTypeBehavior", ProjectItemType.entityTypeBehavior],
    ["blockTypeBehavior", ProjectItemType.blockTypeBehavior],
    ["itemTypeBehavior", ProjectItemType.itemTypeBehavior],
  ];

  for (const [typeName, itemType] of matchingTypes) {
    it(`should detect use_beta_features for item type ${typeName}`, async () => {
      const file = createStubFile({ name: "test.json", content: BETA_JSON });
      const item = createStubProjectItem({ itemType, file });
      const project = createStubProject([item]);
      const results = await generator.generate(project);
      const betaErrors = results.filter((r) => r.generatorIndex === CheckBetaTests.UsingBetaFeatures.id);
      expect(betaErrors.length).to.equal(1);
    });
  }
});
