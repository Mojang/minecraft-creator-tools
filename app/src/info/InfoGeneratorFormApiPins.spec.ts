// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { assert } from "chai";
import { ValidGeneratorTest } from "./fileGenerators/validFile/ValidFileData";
import { UnknownFileGeneratorTest } from "./fileGenerators/unknownFile/UnknownFileData";
import {
  UnlinkedItemInfoGeneratorTest,
  UnlinkedItemNotFoundByType,
} from "./projectItemGenerators/unlinkedItemInfo/UnlinkedItemInfoData";
import { UnknownItemGeneratorTest } from "./projectItemGenerators/unknownItem/UnknownItemData";
import { WorldDataInfoGeneratorTest } from "./projectItemGenerators/worldDataInfo/WorldDataInfoData";
import { WorldItemInfoGeneratorTest } from "./projectItemGenerators/worldItemInfo/WorldItemInfoData";
import { ScriptInfoGeneratorTest } from "./projectGenerators/scriptInfo/ScriptInfoData";
import { SharingInfoGeneratorTest } from "./projectGenerators/sharingInfo/SharingInfoData";
import { StrictPlatformInfoGeneratorTest } from "./projectGenerators/strictPlatformInfo/StrictPlatformInfoData";
import { SummaryInfoGeneratorTest } from "./projectGenerators/summaryInfo/SummaryInfoData";
import {
  TextureImageInfoGeneratorTest,
  TexturePerformanceTierCount,
} from "./projectGenerators/textureImageInfo/TextureImageInfoData";
import { TextureInfoGeneratorTest } from "./projectGenerators/textureInfo/TextureInfoData";
import { TextureReferenceInfoGeneratorTest } from "./projectGenerators/textureReferenceInfo/TextureReferenceInfoData";
import { TypesInfoGeneratorTest } from "./projectGenerators/typesInfo/TypesInfoData";

/**
 * Form API pin tests.
 *
 * These tests verify that generator enum values match the numeric keys used in
 * companion .form.json files (e.g. worlddata.form.json). Those files reference
 * topics by raw number, so a silent renumbering would break form topic lookups
 * at runtime without any TypeScript compile error.
 *
 * Consolidating them here makes the intent clear and gives one place to remove
 * them if the form API coupling ever changes.
 */

describe("InfoGenerator form API pins", () => {
  it("ValidFileGenerator", () => {
    assert.strictEqual(ValidGeneratorTest.nonCompliantJson, 102);
    assert.strictEqual(ValidGeneratorTest.emptyJson, 103);
    assert.strictEqual(ValidGeneratorTest.jsonNotString, 104);
  });

  it("UnknownFileGenerator", () => {
    assert.strictEqual(UnknownFileGeneratorTest.unknownTypeFileFound, 102);
  });

  it("UnlinkedItemInfoGenerator", () => {
    assert.strictEqual(UnlinkedItemNotFoundByType, 300);
    assert.strictEqual(UnlinkedItemInfoGeneratorTest.unlinkedItemIsNotUsed, 191);
    assert.strictEqual(UnlinkedItemInfoGeneratorTest.avoidLinksToVanillaItems, 205);
  });

  it("UnknownItemGenerator", () => {
    assert.strictEqual(UnknownItemGeneratorTest.unknownItemTypeFound, 101);
  });

  it("WorldDataInfoGenerator", () => {
    assert.strictEqual(WorldDataInfoGeneratorTest.unexpectedCommandInMCFunction, 101);
    assert.strictEqual(WorldDataInfoGeneratorTest.unexpectedCommandInCommandBlock, 102);
    assert.strictEqual(WorldDataInfoGeneratorTest.blocks, 121);
    assert.strictEqual(WorldDataInfoGeneratorTest.errorProcessingWorld, 400);
  });

  it("WorldItemInfoGenerator", () => {
    assert.strictEqual(WorldItemInfoGeneratorTest.betaApisExperiment, 101);
    assert.strictEqual(WorldItemInfoGeneratorTest.dataDrivenItemsExperiment, 102);
    assert.strictEqual(WorldItemInfoGeneratorTest.baseGameVersion, 107);
    assert.strictEqual(WorldItemInfoGeneratorTest.worldName, 108);
  });

  it("ScriptInfoGenerator", () => {
    assert.strictEqual(ScriptInfoGeneratorTest.apisUsed, 101);
  });

  it("SharingInfoGenerator", () => {
    assert.strictEqual(SharingInfoGeneratorTest.requiresCustomCapabilities, 100);
    assert.strictEqual(SharingInfoGeneratorTest.hasStrongLanguageContent, 101);
  });

  it("StrictPlatformInfoGenerator", () => {
    assert.strictEqual(StrictPlatformInfoGeneratorTest.entityTypeUsesAMinecraftIdentifier, 100);
    assert.strictEqual(StrictPlatformInfoGeneratorTest.entityTypeUsesAMinecraftRuntimeIdentifier, 101);
    assert.strictEqual(StrictPlatformInfoGeneratorTest.itemTypeUsesAMinecraftIdentifier, 104);
  });

  it("SummaryInfoGenerator", () => {
    assert.strictEqual(SummaryInfoGeneratorTest.resourceManifest, 101);
    assert.strictEqual(SummaryInfoGeneratorTest.behaviorManifest, 102);
  });

  it("TextureImageInfoGenerator", () => {
    assert.strictEqual(TextureImageInfoGeneratorTest.textureImages, 101);
    assert.strictEqual(TextureImageInfoGeneratorTest.textureImagesTier0, 200);
    assert.strictEqual(TextureImageInfoGeneratorTest.textureImagesTier5, 205);
    assert.strictEqual(TexturePerformanceTierCount, 6);
  });

  it("TextureInfoGenerator", () => {
    assert.strictEqual(TextureInfoGeneratorTest.tooManyTextureHandles, 100);
    assert.strictEqual(TextureInfoGeneratorTest.textures, 101);
  });

  it("TextureReferenceInfoGenerator", () => {
    assert.strictEqual(TextureReferenceInfoGeneratorTest.textureReferences, 101);
  });

  it("TypesInfoGenerator", () => {
    assert.strictEqual(TypesInfoGeneratorTest.types, 101);
  });
});
