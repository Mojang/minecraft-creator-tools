// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Regression tests for the JSON-schema -> *.form.json rendering changes that teach
 * FormJsonDocumentationGenerator how to consume the MinecraftApiMetadata "split schema" layout
 * (one file per definition, path-based `$id`s, relative-file-path `$ref`s) in addition to the
 * legacy monolithic layout (numeric `$id`s, `#/definitions/<id>` refs).
 *
 * These guard the four pieces of that work so a future schema reshuffle can't silently hollow
 * out the generated forms again:
 *   - resolveSchemaRefPath        : relative -> absolute `$id` path math.
 *   - resolveRelativeRefsInPlace  : in-place rewrite of every `$ref` in a parsed schema.
 *   - getDefinitionFromId         : resolves both numeric and path-based ref keys.
 *   - addChildSchemaNode enum/primitive: a `$ref` to a primitive enum def renders with choices
 *                                   (the `control_flags` case), not as a hollow object.
 */

import { assert } from "chai";
import { describe, it } from "mocha";
import FormJsonDocumentationGenerator from "./FormJsonDocumentationGenerator";
import { FieldDataType } from "../dataform/IField";

describe("FormJsonDocumentationGenerator schema ref resolution", () => {
  describe("resolveSchemaRefPath", () => {
    const cases: { base: string | undefined; ref: string; expected: string }[] = [
      // sibling file in the same version folder
      {
        base: "/server/block/1.26.20",
        ref: "./Collision%20Box.json",
        expected: "/server/block/1.26.20/Collision%20Box.json",
      },
      // cross-version hop within the same area
      {
        base: "/client/biome/1.21.70",
        ref: "../1.21.40/minecraft_sky_color.json",
        expected: "/client/biome/1.21.40/minecraft_sky_color.json",
      },
      // cross-tree hop up to a different top-level area
      {
        base: "/server/block/1.26.20",
        ref: "../../../client_server/common/legacy/Color255RGB.json",
        expected: "/client_server/common/legacy/Color255RGB.json",
      },
      // legacy internal pointer — left unchanged
      { base: "/server/block/1.26.20", ref: "#/definitions/1429287564", expected: "#/definitions/1429287564" },
      // bare numeric id (legacy layout) — left unchanged
      { base: "/server/block/1.26.20", ref: "2556852513", expected: "2556852513" },
      // already-absolute ref — left unchanged
      { base: "/server/block/1.26.20", ref: "/server/item/1.26.30/Food.json", expected: "/server/item/1.26.30/Food.json" },
      // relative ref carrying a within-file fragment — fragment dropped, file part resolved
      {
        base: "/server/block/1.26.20",
        ref: "./Collision%20Box.json#/definitions/inner",
        expected: "/server/block/1.26.20/Collision%20Box.json",
      },
      // no base context — left unchanged (cannot resolve)
      { base: undefined, ref: "./Whatever.json", expected: "./Whatever.json" },
    ];

    const gen = new FormJsonDocumentationGenerator();

    for (const c of cases) {
      it(`resolves "${c.ref}" against "${c.base}"`, () => {
        assert.strictEqual(gen.resolveSchemaRefPath(c.base, c.ref), c.expected);
      });
    }
  });

  describe("resolveRelativeRefsInPlace", () => {
    it("rewrites top-level, nested oneOf, and items refs to absolute $id form", () => {
      const gen = new FormJsonDocumentationGenerator();
      const schema: any = {
        $id: "/server/block/1.26.20/Components.json",
        properties: {
          "minecraft:collision_box": { $ref: "./Collision%20Box.json" },
          "minecraft:friction": {
            oneOf: [{ type: "number" }, { $ref: "./Friction.json" }],
          },
          "minecraft:tags": {
            type: "array",
            items: { $ref: "../common/Tags.json" },
          },
        },
      };

      gen.resolveRelativeRefsInPlace(schema);

      assert.strictEqual(
        schema.properties["minecraft:collision_box"].$ref,
        "/server/block/1.26.20/Collision%20Box.json"
      );
      assert.strictEqual(schema.properties["minecraft:friction"].oneOf[1].$ref, "/server/block/1.26.20/Friction.json");
      assert.strictEqual(schema.properties["minecraft:tags"].items.$ref, "/server/block/common/Tags.json");
    });

    it("leaves legacy #/definitions refs untouched", () => {
      const gen = new FormJsonDocumentationGenerator();
      const schema: any = {
        $id: "2556852513",
        properties: { item: { $ref: "#/definitions/1429287564" } },
      };

      gen.resolveRelativeRefsInPlace(schema);

      assert.strictEqual(schema.properties.item.$ref, "#/definitions/1429287564");
    });
  });

  describe("getDefinitionFromId", () => {
    it("resolves numeric, #/definitions, and path-based ids", () => {
      const gen = new FormJsonDocumentationGenerator();
      const numericDef = { title: "Numeric" } as any;
      const pathDef = { title: "Path" } as any;
      gen.defsById["1429287564"] = numericDef;
      gen.defsById["/server/block/1.26.20/Collision%20Box.json"] = pathDef;

      assert.strictEqual(gen.getDefinitionFromId("1429287564"), numericDef);
      assert.strictEqual(gen.getDefinitionFromId("#/definitions/1429287564"), numericDef);
      assert.strictEqual(gen.getDefinitionFromId("/server/block/1.26.20/Collision%20Box.json"), pathDef);
      assert.strictEqual(gen.getDefinitionFromId("/server/block/1.26.20/Missing.json"), undefined);
    });
  });

  describe("addChildSchemaNode primitive-enum $ref", () => {
    it("renders an array of an enum-typed $ref as a stringArray with choices (control_flags case)", async () => {
      const gen = new FormJsonDocumentationGenerator();

      // Split-layout enum factored into its own file (e.g. "Goal's control flags").
      gen.defsById["/server/entity/1.21.90/Goal's%20control%20flags.json"] = {
        title: "Goal's control flags",
        type: "string",
        enum: ["move", "look", "jump"],
      } as any;

      // A container whose `control_flags` property is an array of that enum.
      const container: any = {
        title: "Croak Behavior",
        properties: {
          control_flags: {
            type: "array",
            items: { $ref: "/server/entity/1.21.90/Goal's%20control%20flags.json" },
          },
        },
      };

      const form = await gen.getJsonFormFromJsonSchemaDefinition(container, "behavior.croak", undefined, 0);
      assert.isDefined(form);
      const field = form!.fields.find((f) => f.id === "control_flags");
      assert.isDefined(field, "control_flags field should exist");
      assert.strictEqual(field!.dataType, FieldDataType.stringArray);
      assert.isDefined(field!.choices, "choices should be populated from the enum");
      const choiceIds = (field!.choices || []).map((c) => c.id).sort();
      assert.deepStrictEqual(choiceIds, ["jump", "look", "move"]);
    });

    it("renders a scalar enum-typed $ref as a stringEnum with choices", async () => {
      const gen = new FormJsonDocumentationGenerator();
      gen.defsById["/server/block/1.26.20/Tint%20Method.json"] = {
        title: "Tint Method",
        type: "string",
        enum: ["none", "grass", "water"],
      } as any;

      const container: any = {
        title: "Material Instance",
        properties: {
          tint_method: { $ref: "/server/block/1.26.20/Tint%20Method.json" },
        },
      };

      const form = await gen.getJsonFormFromJsonSchemaDefinition(container, "material_instance", undefined, 0);
      const field = form!.fields.find((f) => f.id === "tint_method");
      assert.isDefined(field);
      assert.strictEqual(field!.dataType, FieldDataType.stringEnum);
      assert.deepStrictEqual((field!.choices || []).map((c) => c.id).sort(), ["grass", "none", "water"]);
    });
  });

  describe("constraint + provenance carry-over", () => {
    it("stamps the form dataVersion from x-format-version (and ignores sentinels)", async () => {
      const gen = new FormJsonDocumentationGenerator();
      const versioned: any = {
        title: "Collision Box",
        "x-format-version": "1.26.20",
        properties: { origin: { type: "array" } },
      };
      const form = await gen.getJsonFormFromJsonSchemaDefinition(versioned, "collision_box", undefined, 0);
      assert.strictEqual(form!.dataVersion, "1.26.20");

      const sentinel: any = {
        title: "Weird",
        "x-format-version": "MISSING VERSION",
        properties: { a: { type: "string" } },
      };
      const form2 = await gen.getJsonFormFromJsonSchemaDefinition(sentinel, "weird", undefined, 0);
      assert.isUndefined(form2!.dataVersion);
    });

    it("marks closed enum fields mustMatchChoices", async () => {
      const gen = new FormJsonDocumentationGenerator();
      const field = await gen.getFieldFromJsonPropertyNode(
        { type: "string", enum: ["a", "b", "c"] } as any,
        "mode",
        undefined,
        0
      );
      assert.isTrue(field!.mustMatchChoices);
      assert.deepStrictEqual((field!.choices || []).map((c) => c.id).sort(), ["a", "b", "c"]);
    });

    it("maps const to a single locked choice + default", async () => {
      const gen = new FormJsonDocumentationGenerator();
      const field = await gen.getFieldFromJsonPropertyNode(
        { const: "minecraft:capped" } as any,
        "type",
        undefined,
        0
      );
      assert.isTrue(field!.mustMatchChoices);
      assert.strictEqual(field!.defaultValue, "minecraft:capped");
      assert.deepStrictEqual(
        (field!.choices || []).map((c) => c.id),
        ["minecraft:capped"]
      );
    });

    it("maps string minLength/maxLength", async () => {
      const gen = new FormJsonDocumentationGenerator();
      const field = await gen.getFieldFromJsonPropertyNode(
        { type: "string", minLength: 2, maxLength: 16 } as any,
        "name",
        undefined,
        0
      );
      assert.strictEqual(field!.minLength, 2);
      assert.strictEqual(field!.maxLength, 16);
    });

    it("maps inline minProperties/maxProperties to entry-count length", async () => {
      const gen = new FormJsonDocumentationGenerator();
      const field = await gen.getFieldFromJsonPropertyNode(
        { type: "object", minProperties: 1, maxProperties: 64, additionalProperties: { type: "string" } } as any,
        "material_instances",
        undefined,
        0
      );
      assert.strictEqual(field!.minLength, 1);
      assert.strictEqual(field!.maxLength, 64);
    });

    it("carries maxProperties from a $ref target onto the referencing field", async () => {
      const gen = new FormJsonDocumentationGenerator();
      gen.defsById["/server/block/1.26.20/Material%20Instances%20Component.json"] = {
        title: "Material Instances Component",
        type: "object",
        maxProperties: 64,
        additionalProperties: { type: "string" },
      } as any;
      const field = await gen.getFieldFromJsonPropertyNode(
        { $ref: "/server/block/1.26.20/Material%20Instances%20Component.json" } as any,
        "material_instances",
        undefined,
        0
      );
      assert.strictEqual(field!.maxLength, 64);
    });

    it("maps uniqueItems and x-unique-values to mustBeUnique", async () => {
      const gen = new FormJsonDocumentationGenerator();
      const a = await gen.getFieldFromJsonPropertyNode(
        { type: "array", uniqueItems: true, items: { type: "string" } } as any,
        "tags",
        undefined,
        0
      );
      assert.isTrue(a!.mustBeUnique);

      const b = await gen.getFieldFromJsonPropertyNode(
        { type: "array", "x-unique-values": true, items: { type: "string" } } as any,
        "enabled_directions",
        undefined,
        0
      );
      assert.isTrue(b!.mustBeUnique);
    });

    it("carries x-regex-flags onto the pattern validity condition", async () => {
      const gen = new FormJsonDocumentationGenerator();
      const field = await gen.getFieldFromJsonPropertyNode(
        { type: "string", pattern: "^(?:.)+:(?:.)+$", "x-regex-flags": "ECMAScript,icase" } as any,
        "identifier",
        undefined,
        0
      );
      const cond = (field!.validity || []).find((c) => c.comparison === "pattern");
      assert.isDefined(cond);
      assert.strictEqual(cond!.patternFlags, "i");
    });

    it("maps multi-token x-regex-flags and ignores unknown / syntax-mode tokens", async () => {
      const gen = new FormJsonDocumentationGenerator();
      const field = await gen.getFieldFromJsonPropertyNode(
        { type: "string", pattern: "^a.*z$", "x-regex-flags": "ignorecase,multiline" } as any,
        "name",
        undefined,
        0
      );
      const cond = (field!.validity || []).find((c) => c.comparison === "pattern");
      assert.strictEqual(cond!.patternFlags, "im");

      // "ECMAScript" is a syntax mode (not a JS flag) and "bogus" is unknown -> both dropped;
      // "global" -> "g", "dotall" -> "s".
      const field2 = await gen.getFieldFromJsonPropertyNode(
        { type: "string", pattern: "^a$", "x-regex-flags": "ECMAScript,bogus,global,dotall" } as any,
        "name2",
        undefined,
        0
      );
      const cond2 = (field2!.validity || []).find((c) => c.comparison === "pattern");
      assert.strictEqual(cond2!.patternFlags, "gs");
    });

    it("marks a deprecated schema definition isDeprecated (and leaves current defs undefined)", async () => {
      const gen = new FormJsonDocumentationGenerator();
      const deprecated: any = {
        title: "Old Component",
        deprecated: true,
        properties: { value: { type: "string" } },
      };
      const form = await gen.getJsonFormFromJsonSchemaDefinition(deprecated, "old_component", undefined, 0);
      assert.isTrue(form!.isDeprecated);

      const current: any = {
        title: "Current Component",
        properties: { value: { type: "string" } },
      };
      const form2 = await gen.getJsonFormFromJsonSchemaDefinition(current, "current_component", undefined, 0);
      assert.isUndefined(form2!.isDeprecated);
    });

    it("renders a scalar (non-enum) $ref target as its primitive field type", async () => {
      const gen = new FormJsonDocumentationGenerator();
      // Split-layout scalar factored into its own file (no properties, no enum, no oneOf).
      gen.defsById["/server/item/1.26.30/Cooldown%20Duration.json"] = {
        title: "Cooldown Duration",
        type: "number",
      } as any;

      const container: any = {
        title: "Cooldown",
        properties: {
          cooldown_time: { $ref: "/server/item/1.26.30/Cooldown%20Duration.json" },
        },
      };

      const form = await gen.getJsonFormFromJsonSchemaDefinition(container, "cooldown", undefined, 0);
      const field = form!.fields.find((f) => f.id === "cooldown_time");
      assert.isDefined(field, "cooldown_time field should exist");
      assert.strictEqual(field!.dataType, FieldDataType.number);
    });

    it("carries uniqueItems and x-unique-values from a $ref target onto the referencing field", async () => {
      const gen = new FormJsonDocumentationGenerator();
      gen.defsById["/server/block/1.26.20/Unique%20Tags.json"] = {
        title: "Unique Tags",
        type: "array",
        uniqueItems: true,
        items: { type: "string" },
      } as any;
      const a = await gen.getFieldFromJsonPropertyNode(
        { $ref: "/server/block/1.26.20/Unique%20Tags.json" } as any,
        "tags",
        undefined,
        0
      );
      assert.isTrue(a!.mustBeUnique);

      gen.defsById["/server/block/1.26.20/Unique%20Dirs.json"] = {
        title: "Unique Dirs",
        type: "array",
        "x-unique-values": true,
        items: { type: "string" },
      } as any;
      const b = await gen.getFieldFromJsonPropertyNode(
        { $ref: "/server/block/1.26.20/Unique%20Dirs.json" } as any,
        "enabled_directions",
        undefined,
        0
      );
      assert.isTrue(b!.mustBeUnique);
    });
  });
});

