// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { expect } from "chai";
import AnimationResourceInfoGenerator from "./AnimationResourceInfoGenerator";
import { AnimationResourceInfoGeneratorTest } from "./AnimationResourceInfoData";
import { createStubProject } from "../../../test/stubs/app/projects/StubProject";
import { createStubProjectItem } from "../../../test/stubs/app/projects/StubProjectItem";
import { createStubFile } from "../../../test/stubs/app/io/StubFile";
import { ProjectItemType } from "../../../app/IProjectItemData";
import { InfoItemType } from "../../IInfoItemData";

// contentIndex is not used by this generator; pass undefined to keep test noise low
const NO_CONTENT_INDEX = undefined as any;

function makeAnimationJson(animations: Record<string, any>) {
  return JSON.stringify({ format_version: "1.12.0", animations });
}

describe("AnimationResourceInfoGenerator", () => {
  let generator: AnimationResourceInfoGenerator;

  beforeEach(() => {
    generator = new AnimationResourceInfoGenerator();
  });

  it("should have correct id and title", () => {
    expect(generator.id).to.equal("RESOURCEANIMATION");
    expect(generator.title).to.equal("Resource Animation");
  });

  it("should always return exactly 2 featureAggregate items even for an empty project", async () => {
    const results = await generator.generate(createStubProject(), NO_CONTENT_INDEX);
    expect(results.length).to.equal(2);
    expect(results[0].itemType).to.equal(InfoItemType.featureAggregate);
    expect(results[1].itemType).to.equal(InfoItemType.featureAggregate);
  });

  it("should assign the correct generatorIndex to each aggregate item", async () => {
    const results = await generator.generate(createStubProject(), NO_CONTENT_INDEX);
    expect(results[0].generatorIndex).to.equal(AnimationResourceInfoGeneratorTest.animations);
    expect(results[1].generatorIndex).to.equal(AnimationResourceInfoGeneratorTest.bones);
  });

  it("should have no feature data for an empty project", async () => {
    const results = await generator.generate(createStubProject(), NO_CONTENT_INDEX);
    expect(results[0].featureSets).to.be.undefined;
    expect(results[1].featureSets).to.be.undefined;
  });

  it("should skip items that are not animationResourceJson type", async () => {
    const file = createStubFile({ name: "model.geo.json", content: makeAnimationJson({ "animation.walk": {} }) });
    const item = createStubProjectItem({ itemType: ProjectItemType.modelGeometryJson, file });
    const results = await generator.generate(createStubProject([item]), NO_CONTENT_INDEX);
    expect(results[0].featureSets).to.be.undefined;
  });

  it("should not increment animation count when the item has no primaryFile", async () => {
    // No file option → primaryFile is null → generator skips the body
    const item = createStubProjectItem({ itemType: ProjectItemType.animationResourceJson });
    const results = await generator.generate(createStubProject([item]), NO_CONTENT_INDEX);
    expect(results[0].featureSets).to.be.undefined;
  });

  it("should increment the animation count for each animation in the file", async () => {
    const content = makeAnimationJson({
      "animation.player.walk": {},
      "animation.player.run": {},
    });
    const file = createStubFile({ name: "player.animation.json", content });
    const item = createStubProjectItem({ itemType: ProjectItemType.animationResourceJson, file });
    const results = await generator.generate(createStubProject([item]), NO_CONTENT_INDEX);
    // featureSets key: convertToJsonKey("Resource") = "resource", convertToJsonKey("Count") = "count"
    expect(results[0].featureSets?.resource?.count).to.equal(2);
  });

  it("should increment the bone count for each bone in an animation", async () => {
    const content = makeAnimationJson({
      "animation.player.idle": {
        bones: {
          spine: {},
          head: {},
        },
      },
    });
    const file = createStubFile({ name: "player.animation.json", content });
    const item = createStubProjectItem({ itemType: ProjectItemType.animationResourceJson, file });
    const results = await generator.generate(createStubProject([item]), NO_CONTENT_INDEX);
    // "Resource Animation Bone" → "resourceAnimationBone"
    expect(results[1].featureSets?.resourceAnimationBone?.count).to.equal(2);
  });

  it("should count a string scale value as a Scale Expression (Molang)", async () => {
    const content = makeAnimationJson({
      "animation.mob.idle": {
        bones: {
          body: { scale: "math.sin(query.life_time)" },
        },
      },
    });
    const file = createStubFile({ name: "mob.animation.json", content });
    const item = createStubProjectItem({ itemType: ProjectItemType.animationResourceJson, file });
    const results = await generator.generate(createStubProject([item]), NO_CONTENT_INDEX);
    // "Resource Animation Bone Scale Expression" → "resourceAnimationBoneScaleExpression"
    expect(results[1].featureSets?.resourceAnimationBoneScaleExpression?.count).to.equal(1);
  });

  it("should count keyframe rotation (object with array value per timestamp)", async () => {
    const content = makeAnimationJson({
      "animation.mob.walk": {
        bones: {
          leg: {
            rotation: {
              "0.0": [0, 0, 0],
              "0.5": [0, 45, 0],
            },
          },
        },
      },
    });
    const file = createStubFile({ name: "mob.animation.json", content });
    const item = createStubProjectItem({ itemType: ProjectItemType.animationResourceJson, file });
    const results = await generator.generate(createStubProject([item]), NO_CONTENT_INDEX);
    // "Resource Animation Bone Rotation Keyframe" → "resourceAnimationBoneRotationKeyframe"
    expect(results[1].featureSets?.resourceAnimationBoneRotationKeyframe?.count).to.be.above(0);
  });
});
