// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { expect } from "chai";
import CooperativeAddOnItemRequirementsGenerator from "./CooperativeAddOnItemRequirementsGenerator";
import { CooperativeAddOnItemRequirementsGeneratorTest } from "./CooperativeAddOnItemRequirementsData";
import { createStubProjectItem } from "../../../test/stubs/app/projects/StubProjectItem";
import { createStubFile } from "../../../test/stubs/app/io/StubFile";
import { ProjectItemType } from "../../../app/IProjectItemData";

const NO_CONTENT_INDEX = undefined as any;

// A valid namespaced name: two or more tokens when split by '_', each at least 2 chars
const VALID_NS = "myns_proj"; // isNamespacedString -> ["myns","proj"] ✓

// Animation controller behavior JSON helpers
function makeBacJson(controllers: Record<string, object>) {
  return JSON.stringify({ format_version: "1.10.0", animation_controllers: controllers });
}

// Behavior animation JSON helpers
function makeBaJson(animations: Record<string, object>) {
  return JSON.stringify({ format_version: "1.10.0", animations });
}

// Resource animation controller JSON
function makeRacJson(controllers: Record<string, object>) {
  return JSON.stringify({ format_version: "1.10.0", animation_controllers: controllers });
}

// Resource animation JSON
function makeRaJson(animations: Record<string, object>) {
  return JSON.stringify({ format_version: "1.12.0", animations });
}

// Render controller JSON
function makeRrcJson(renderControllers: Record<string, object>) {
  return JSON.stringify({ format_version: "1.10.0", render_controllers: renderControllers });
}

// Model geometry JSON
function makeGeoJson(identifier: string) {
  return JSON.stringify({
    format_version: "1.12.0",
    "minecraft:geometry": [{ description: { identifier, texture_width: 64, texture_height: 64 } }],
  });
}

// Entity behavior JSON
function makeEntityJson(identifier: string) {
  return JSON.stringify({
    format_version: "1.20.0",
    "minecraft:entity": { description: { identifier }, components: {} },
  });
}

// Material JSON
function makeMaterialJson(materials: Record<string, unknown>) {
  return JSON.stringify({ materials });
}

// Resource pack manifest JSON
function makeRpManifestJson(packScope?: string) {
  return JSON.stringify({
    format_version: 2,
    header: {
      name: "Test RP",
      uuid: "11111111-1111-1111-1111-111111111111",
      version: [1, 0, 0],
      ...(packScope ? { pack_scope: packScope } : {}),
    },
    modules: [],
  });
}

describe("CooperativeAddOnItemRequirementsGenerator", () => {
  let generator: CooperativeAddOnItemRequirementsGenerator;

  beforeEach(() => {
    generator = new CooperativeAddOnItemRequirementsGenerator();
  });

  it("should have correct id and title", () => {
    expect(generator.id).to.equal("CADDONIREQ");
    expect(generator.title).to.be.a("string").and.have.length.above(0);
  });

  it("should return no results for an unrecognized item type", async () => {
    const item = createStubProjectItem({ itemType: ProjectItemType.unknown });
    const results = await generator.generate(item, NO_CONTENT_INDEX);
    expect(results.length).to.equal(0);
  });

  // --- dimensionJson (191) ---

  it("should report noDimensionJson for a dimensionJson item", async () => {
    const item = createStubProjectItem({ itemType: ProjectItemType.dimensionJson });
    const results = await generator.generate(item, NO_CONTENT_INDEX);
    const errors = results.filter(
      (r) => r.generatorIndex === CooperativeAddOnItemRequirementsGeneratorTest.noDimensionJson
    );
    expect(errors.length).to.equal(1);
  });

  // --- resourcePackManifestJson (170) ---

  it("should not report an error for an RP manifest with pack_scope: world", async () => {
    const file = createStubFile({ name: "manifest.json", content: makeRpManifestJson("world") });
    const item = createStubProjectItem({ itemType: ProjectItemType.resourcePackManifestJson, file });
    const results = await generator.generate(item, NO_CONTENT_INDEX);
    const errors = results.filter(
      (r) => r.generatorIndex === CooperativeAddOnItemRequirementsGeneratorTest.resourcePackDoesNotHavePackScopeWorld
    );
    expect(errors.length).to.equal(0);
  });

  it("should report resourcePackDoesNotHavePackScopeWorld when pack_scope is absent", async () => {
    const file = createStubFile({ name: "manifest.json", content: makeRpManifestJson() });
    const item = createStubProjectItem({ itemType: ProjectItemType.resourcePackManifestJson, file });
    const results = await generator.generate(item, NO_CONTENT_INDEX);
    const errors = results.filter(
      (r) => r.generatorIndex === CooperativeAddOnItemRequirementsGeneratorTest.resourcePackDoesNotHavePackScopeWorld
    );
    expect(errors.length).to.equal(1);
  });

  // --- animationControllerBehaviorJson (100, 101) ---

  it("should not report an error for a valid behavior animation controller name", async () => {
    const file = createStubFile({
      name: "ac.json",
      content: makeBacJson({ [`controller.animation.${VALID_NS}.idle`]: {} }),
    });
    const item = createStubProjectItem({ itemType: ProjectItemType.animationControllerBehaviorJson, file });
    const results = await generator.generate(item, NO_CONTENT_INDEX);
    expect(results.length).to.equal(0);
  });

  it("should report behaviorAnimationControllerIdNotInExpectedForm for a malformed BAC identifier", async () => {
    const file = createStubFile({ name: "ac.json", content: makeBacJson({ "animation.idle": {} }) });
    const item = createStubProjectItem({ itemType: ProjectItemType.animationControllerBehaviorJson, file });
    const results = await generator.generate(item, NO_CONTENT_INDEX);
    const errors = results.filter(
      (r) =>
        r.generatorIndex ===
        CooperativeAddOnItemRequirementsGeneratorTest.behaviorAnimationControllerIdNotInExpectedForm
    );
    expect(errors.length).to.equal(1);
  });

  it("should report behaviorAnimationControllerNameNotInExpectedForm for a BAC with non-namespaced name segment", async () => {
    // valid prefix (controller.animation.) but third segment has no underscore
    const file = createStubFile({ name: "ac.json", content: makeBacJson({ "controller.animation.single.idle": {} }) });
    const item = createStubProjectItem({ itemType: ProjectItemType.animationControllerBehaviorJson, file });
    const results = await generator.generate(item, NO_CONTENT_INDEX);
    const errors = results.filter(
      (r) =>
        r.generatorIndex ===
        CooperativeAddOnItemRequirementsGeneratorTest.behaviorAnimationControllerNameNotInExpectedForm
    );
    expect(errors.length).to.equal(1);
  });

  // --- animationBehaviorJson (110, 111) ---

  it("should report behaviorAnimationIdNotInExpectedForm for a malformed BA identifier", async () => {
    const file = createStubFile({ name: "anim.json", content: makeBaJson({ "myanimation.walk": {} }) });
    const item = createStubProjectItem({ itemType: ProjectItemType.animationBehaviorJson, file });
    const results = await generator.generate(item, NO_CONTENT_INDEX);
    const errors = results.filter(
      (r) => r.generatorIndex === CooperativeAddOnItemRequirementsGeneratorTest.behaviorAnimationIdNotInExpectedForm
    );
    expect(errors.length).to.equal(1);
  });

  it("should report behaviorAnimationNameNotInExpectedForm for a BA with non-namespaced name segment", async () => {
    const file = createStubFile({ name: "anim.json", content: makeBaJson({ "animation.single.walk": {} }) });
    const item = createStubProjectItem({ itemType: ProjectItemType.animationBehaviorJson, file });
    const results = await generator.generate(item, NO_CONTENT_INDEX);
    const errors = results.filter(
      (r) => r.generatorIndex === CooperativeAddOnItemRequirementsGeneratorTest.behaviorAnimationNameNotInExpectedForm
    );
    expect(errors.length).to.equal(1);
  });

  it("should not report an error for a valid behavior animation name", async () => {
    const file = createStubFile({ name: "anim.json", content: makeBaJson({ [`animation.${VALID_NS}.walk`]: {} }) });
    const item = createStubProjectItem({ itemType: ProjectItemType.animationBehaviorJson, file });
    const results = await generator.generate(item, NO_CONTENT_INDEX);
    expect(results.length).to.equal(0);
  });

  // --- animationControllerResourceJson (120) ---

  it("should report resourceAnimationControllerIdNotInExpectedForm for a malformed RAC identifier", async () => {
    const file = createStubFile({ name: "rac.json", content: makeRacJson({ "animation.idle": {} }) });
    const item = createStubProjectItem({ itemType: ProjectItemType.animationControllerResourceJson, file });
    const results = await generator.generate(item, NO_CONTENT_INDEX);
    const errors = results.filter(
      (r) =>
        r.generatorIndex ===
        CooperativeAddOnItemRequirementsGeneratorTest.resourceAnimationControllerIdNotInExpectedForm
    );
    expect(errors.length).to.equal(1);
  });

  // --- animationResourceJson (130, 131) ---

  it("should report resourceAnimationIdNotInExpectedForm for a malformed RA identifier", async () => {
    const file = createStubFile({ name: "ra.json", content: makeRaJson({ "myanimation.idle": {} }) });
    const item = createStubProjectItem({ itemType: ProjectItemType.animationResourceJson, file });
    const results = await generator.generate(item, NO_CONTENT_INDEX);
    const errors = results.filter(
      (r) => r.generatorIndex === CooperativeAddOnItemRequirementsGeneratorTest.resourceAnimationIdNotInExpectedForm
    );
    expect(errors.length).to.equal(1);
  });

  it("should report resourceAnimationNameNotInExpectedForm for a RA with non-namespaced name segment", async () => {
    const file = createStubFile({ name: "ra.json", content: makeRaJson({ "animation.single.idle": {} }) });
    const item = createStubProjectItem({ itemType: ProjectItemType.animationResourceJson, file });
    const results = await generator.generate(item, NO_CONTENT_INDEX);
    const errors = results.filter(
      (r) => r.generatorIndex === CooperativeAddOnItemRequirementsGeneratorTest.resourceAnimationNameNotInExpectedForm
    );
    expect(errors.length).to.equal(1);
  });

  it("should not report an error for a valid resource animation name", async () => {
    const file = createStubFile({ name: "ra.json", content: makeRaJson({ [`animation.${VALID_NS}.idle`]: {} }) });
    const item = createStubProjectItem({ itemType: ProjectItemType.animationResourceJson, file });
    const results = await generator.generate(item, NO_CONTENT_INDEX);
    expect(results.length).to.equal(0);
  });

  // --- renderControllerJson (140, 141) ---

  it("should report renderControllerIdNotInExpectedForm for a malformed render controller identifier", async () => {
    const file = createStubFile({ name: "rc.json", content: makeRrcJson({ "rendercontroller.ns_proj": {} }) });
    const item = createStubProjectItem({ itemType: ProjectItemType.renderControllerJson, file });
    const results = await generator.generate(item, NO_CONTENT_INDEX);
    const errors = results.filter(
      (r) => r.generatorIndex === CooperativeAddOnItemRequirementsGeneratorTest.renderControllerIdNotInExpectedForm
    );
    expect(errors.length).to.equal(1);
  });

  it("should report renderControllerNameNotInExpectedForm for a render controller with non-namespaced name segment", async () => {
    const file = createStubFile({ name: "rc.json", content: makeRrcJson({ "controller.render.single.default": {} }) });
    const item = createStubProjectItem({ itemType: ProjectItemType.renderControllerJson, file });
    const results = await generator.generate(item, NO_CONTENT_INDEX);
    const errors = results.filter(
      (r) => r.generatorIndex === CooperativeAddOnItemRequirementsGeneratorTest.renderControllerNameNotInExpectedForm
    );
    expect(errors.length).to.equal(1);
  });

  // --- modelGeometryJson (150, 151) ---

  it("should not report an error for a valid geometry identifier", async () => {
    const file = createStubFile({ name: "model.geo.json", content: makeGeoJson(`geometry.${VALID_NS}.body`) });
    const item = createStubProjectItem({ itemType: ProjectItemType.modelGeometryJson, file });
    const results = await generator.generate(item, NO_CONTENT_INDEX);
    expect(results.length).to.equal(0);
  });

  it("should report geometryIdNotInExpectedForm for a geometry identifier that does not start with 'geometry.'", async () => {
    const file = createStubFile({ name: "model.geo.json", content: makeGeoJson(`${VALID_NS}.body`) });
    const item = createStubProjectItem({ itemType: ProjectItemType.modelGeometryJson, file });
    const results = await generator.generate(item, NO_CONTENT_INDEX);
    const errors = results.filter(
      (r) => r.generatorIndex === CooperativeAddOnItemRequirementsGeneratorTest.geometryIdNotInExpectedForm
    );
    expect(errors.length).to.equal(1);
  });

  it("should report geometryNameNotInExpectedForm for a geometry with a non-namespaced second segment", async () => {
    // "geometry.single.body" → second segment "single" has no underscore → fails isNamespacedString
    const file = createStubFile({ name: "model.geo.json", content: makeGeoJson("geometry.single.body") });
    const item = createStubProjectItem({ itemType: ProjectItemType.modelGeometryJson, file });
    const results = await generator.generate(item, NO_CONTENT_INDEX);
    const errors = results.filter(
      (r) => r.generatorIndex === CooperativeAddOnItemRequirementsGeneratorTest.geometryNameNotInExpectedForm
    );
    expect(errors.length).to.equal(1);
  });

  // --- entityTypeBehavior (112) ---

  it("should not report an error for an entity with a properly namespaced identifier", async () => {
    // "myns_proj:my_entity" → isNamespacedString splits by '_' → truthy
    const file = createStubFile({ name: "entity.json", content: makeEntityJson("myns_proj:my_entity") });
    const item = createStubProjectItem({ itemType: ProjectItemType.entityTypeBehavior, file });
    const results = await generator.generate(item, NO_CONTENT_INDEX);
    expect(results.length).to.equal(0);
  });

  it("should report jsonIdentifierNotInExpectedForm for an entity with a non-namespaced identifier", async () => {
    // "singlepart:entity" → isNamespacedString("singlepart:entity").split('_') = ["singlepart:entity"] → length 1 < 2 → false
    const file = createStubFile({ name: "entity.json", content: makeEntityJson("singlepart:entity") });
    const item = createStubProjectItem({ itemType: ProjectItemType.entityTypeBehavior, file });
    const results = await generator.generate(item, NO_CONTENT_INDEX);
    const errors = results.filter(
      (r) => r.generatorIndex === CooperativeAddOnItemRequirementsGeneratorTest.jsonIdentifierNotInExpectedForm
    );
    expect(errors.length).to.equal(1);
  });

  // --- material (161) ---

  it("should report materialsFirstSegmentNotInExpectedForm for a material with a non-namespaced key", async () => {
    // "bad:base" → first segment "bad" → isNamespacedString("bad").split('_') = ["bad"] → length 1 → false → error 161
    const file = createStubFile({ name: "entity.material", content: makeMaterialJson({ "bad:base": {} }) });
    const item = createStubProjectItem({ itemType: ProjectItemType.material, file });
    const results = await generator.generate(item, NO_CONTENT_INDEX);
    const errors = results.filter(
      (r) => r.generatorIndex === CooperativeAddOnItemRequirementsGeneratorTest.materialsFirstSegmentNotInExpectedForm
    );
    expect(errors.length).to.equal(1);
  });

  it("should skip the 'version' key in material definitions without reporting an error", async () => {
    // "version" key is explicitly excluded from the namespace check
    const file = createStubFile({ name: "entity.material", content: makeMaterialJson({ version: "1.0.0" }) });
    const item = createStubProjectItem({ itemType: ProjectItemType.material, file });
    const results = await generator.generate(item, NO_CONTENT_INDEX);
    expect(results.length).to.equal(0);
  });
});
