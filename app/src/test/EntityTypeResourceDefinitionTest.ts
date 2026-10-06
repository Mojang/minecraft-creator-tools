// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * EntityTypeResourceDefinitionTest — Covers how a client entity pairs its
 * geometry and texture variants. Regression coverage for the Models tab
 * opening cow.cold.geo under the default cow texture (ADO #1643411): the
 * cold cow's horns and muzzle sit in the lower half of a 64x64 texture, so
 * rendering it with the 64x32 default texture showed them white and adrift.
 */

import { expect } from "chai";
import "mocha";
import * as fs from "fs";

import EntityTypeResourceDefinition from "../minecraft/EntityTypeResourceDefinition";
import TestPaths from "./TestPaths";

const vanillaCowClientEntityPath = TestPaths.publicRoot + "res/latest/van/release/resource_pack/entity/cow.entity.json";

function definitionFromDescription(description: any): EntityTypeResourceDefinition {
  const def = new EntityTypeResourceDefinition();
  Object.assign(def.ensureData(), JSON.parse(JSON.stringify(description)));
  return def;
}

describe("EntityTypeResourceDefinition variant pairing", () => {
  describe("vanilla cow", () => {
    const description = JSON.parse(fs.readFileSync(vanillaCowClientEntityPath, "utf8"))["minecraft:client_entity"]
      .description;

    it("finds the variant key that lists a geometry", () => {
      const def = definitionFromDescription(description);

      expect(def.getVariantKeyForGeometry("geometry.cow.cold")).to.equal("cold");
      expect(def.getVariantKeyForGeometry("geometry.cow.warm")).to.equal("warm");
      expect(def.getVariantKeyForGeometry("geometry.cow.v2")).to.equal("default");
    });

    it("pairs the cold geometry with the cold texture, not the first texture", () => {
      const def = definitionFromDescription(description);

      const key = def.getTextureVariantKeyForGeometries(["geometry.cow.cold"]);

      expect(key).to.equal("cold");
      expect(def.getTextureByKey(key!)).to.equal("textures/entity/cow/cow_cold");
      expect(def.texturesIdList![0], "the entity's first texture is not the cold one").to.not.equal("cold");
    });

    it("ignores case and surrounding whitespace in the geometry identifier", () => {
      const def = definitionFromDescription(description);

      expect(def.getVariantKeyForGeometry(" Geometry.Cow.Cold ")).to.equal("cold");
    });

    it("reports nothing for a geometry the entity does not use", () => {
      const def = definitionFromDescription(description);

      expect(def.getVariantKeyForGeometry("geometry.pig.v3")).to.equal(undefined);
      expect(def.getTextureVariantKeyForGeometries(["geometry.pig.v3"])).to.equal(undefined);
    });
  });

  it("skips a geometry variant that has no texture of its own and takes the next match", () => {
    const def = definitionFromDescription({
      identifier: "test:mob",
      geometry: { default: "geometry.mob", baby: "geometry.mob.baby", hat: "geometry.mob.hat" },
      textures: { default: "textures/entity/mob", hat: "textures/entity/mob_hat" },
    });

    expect(def.getVariantKeyForGeometry("geometry.mob.baby")).to.equal("baby");
    expect(def.getTextureVariantKeyForGeometries(["geometry.mob.baby"])).to.equal(undefined);
    expect(def.getTextureVariantKeyForGeometries(["geometry.mob.baby", "geometry.mob.hat"])).to.equal("hat");
  });

  it("copes with an entity that declares no geometry or textures", () => {
    const def = definitionFromDescription({ identifier: "test:empty" });

    expect(def.getVariantKeyForGeometry("geometry.mob")).to.equal(undefined);
    expect(def.getTextureVariantKeyForGeometries(["geometry.mob"])).to.equal(undefined);
  });
});
