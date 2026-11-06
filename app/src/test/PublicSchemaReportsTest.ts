// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * PublicSchemaReportsTest - keeps the schema/form contracts behind the public
 * validation reports honest.
 *
 * Each case below is a representative snippet from a public
 * Mojang/minecraft-creator-tools issue, pushed through the path a creator
 * actually hits: the JSONF form validator and the JSON/COMJSON schema
 * validators (CLI `validate`, MCP, the inspector), the component form the
 * editors load, and the JSON Schema the Monaco editor is generated from.
 *
 * Covered reports:
 *   #75  nearest_attackable_target attack_interval (object, scalar) and entity_types
 *   #27  item interact_button as a string or boolean
 *   #28  particle emitter_shape_entity_aabb surface_only / string direction
 *   #26  npc portrait_offsets.rotate
 *   #70  leashable.presets
 *   #74 / #45 / #18  block collision_box and selection_box sizes up to 16
 *   #73  block destruction_particles
 *   #55  has_biome_tag values nether_wastes, pale_garden, mooshroom_island
 *   #69  TypeScript types shipped by @minecraft/bedrock-schemas
 *
 * The pinned Blockception schemas still reject the #26 and #28 shapes, but the
 * json-schema library the COMJSON generator uses does not resolve $ref, so
 * those defects never reach a creator; the editor builds its schema from the
 * (correct) forms instead. The assertions here pin that down so a validator or
 * schema upgrade that starts surfacing them is caught.
 */

import { assert, expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import Project, { ProjectAutoDeploymentMode } from "../app/Project";
import ProjectInfoSet from "../info/ProjectInfoSet";
import ProjectInfoItem from "../info/ProjectInfoItem";
import { ProjectInfoSuite } from "../info/IProjectInfoData";
import { InfoItemType } from "../info/IInfoItemData";
import Database from "../minecraft/Database";
import DataFormValidator from "../dataform/DataFormValidator";
import FieldUtilities from "../dataform/FieldUtilities";
import IFormDefinition from "../dataform/IFormDefinition";
import JsonSchemaGenerator from "../schema/JsonSchemaGenerator";
import FormDefinitionTypeScriptGenerator from "../docgen/FormDefinitionTypeScriptGenerator";
import TestPaths, { ITestEnvironment } from "./TestPaths";
import type { bp } from "@minecraft/bedrock-schemas";

const fixtureRoot = path.join(TestPaths.appRoot, "debugoutput", "publicSchemaReports");
const localFormsRoot = path.join(TestPaths.appRoot, "public_supplemental", "data", "local_forms");
const bedrockSchemasRoot = path.join(TestPaths.appRoot, "node_modules", "@minecraft", "bedrock-schemas");

const schemaGeneratorIds = ["JSONF", "JSON", "COMJSON"];

// The JSON and COMJSON generators only validate files at a current format version.
// Track the pinned @minecraft/bedrock-schemas release so the fixtures stay current.
const packageVersion: string = JSON.parse(
  fs.readFileSync(path.join(bedrockSchemasRoot, "package.json"), "utf8")
).version;
const currentFormatVersion = packageVersion.split(".").slice(0, 2).join(".") + ".0";

const nearestAttackableTarget = {
  priority: 2,
  must_see: true,
  reselect_targets: true,
  attack_interval: { min: 1, max: 2 },
  entity_types: [{ filters: { test: "is_family", subject: "other", value: "player" }, max_dist: 16 }],
};

const fixtureFiles: { [relativePath: string]: object } = {
  "behavior_packs/reports_bp/manifest.json": {
    format_version: 2,
    header: {
      name: "reports bp",
      description: "",
      uuid: "6c1f0a2e-1111-4d6b-8a0c-5d2e1f3a4b5c",
      version: [1, 0, 0],
      min_engine_version: [1, 21, 0],
    },
    modules: [{ type: "data", uuid: "6c1f0a2e-2222-4d6b-8a0c-5d2e1f3a4b5c", version: [1, 0, 0] }],
  },
  "resource_packs/reports_rp/manifest.json": {
    format_version: 2,
    header: {
      name: "reports rp",
      description: "",
      uuid: "6c1f0a2e-3333-4d6b-8a0c-5d2e1f3a4b5c",
      version: [1, 0, 0],
      min_engine_version: [1, 21, 0],
    },
    modules: [{ type: "resources", uuid: "6c1f0a2e-4444-4d6b-8a0c-5d2e1f3a4b5c", version: [1, 0, 0] }],
  },
  // #75 object interval, #26 rotate, #70 presets
  "behavior_packs/reports_bp/entities/target.json": {
    format_version: currentFormatVersion,
    "minecraft:entity": {
      description: { identifier: "reports:target", is_spawnable: true, is_summonable: true },
      components: {
        "minecraft:behavior.nearest_attackable_target": nearestAttackableTarget,
        "minecraft:npc": {
          npc_data: {
            portrait_offsets: { translate: [-0.07, 0.5, 0.1], scale: [1.7, 1.7, 1.7], rotate: [0, 0, 0] },
            picker_offsets: { translate: [0, 0.1, 0], scale: [1.6, 1.6, 1.6] },
            skin_list: [{ variant: 0, mark_variant: 0 }],
          },
        },
        "minecraft:leashable": {
          presets: [
            {
              filter: { test: "is_family", subject: "other", value: "player" },
              soft_distance: 4,
              hard_distance: 6,
              max_distance: 10,
            },
          ],
        },
        "minecraft:collision_box": { width: 0.6, height: 1.8 },
      },
    },
  },
  // #75 single-number interval (still accepted before 1.26)
  "behavior_packs/reports_bp/entities/target_scalar_interval.json": {
    format_version: "1.21.80",
    "minecraft:entity": {
      description: { identifier: "reports:target_scalar", is_spawnable: true, is_summonable: true },
      components: {
        "minecraft:behavior.nearest_attackable_target": { ...nearestAttackableTarget, attack_interval: 5 },
      },
    },
  },
  // #27
  "behavior_packs/reports_bp/items/button_item.json": {
    format_version: currentFormatVersion,
    "minecraft:item": {
      description: { identifier: "reports:button_item", menu_category: { category: "items" } },
      components: { "minecraft:interact_button": "Open Menu", "minecraft:icon": "stick" },
    },
  },
  // #74 / #45 / #18, #73
  "behavior_packs/reports_bp/blocks/big_block.json": {
    format_version: currentFormatVersion,
    "minecraft:block": {
      description: { identifier: "reports:big_block", menu_category: { category: "construction" } },
      components: {
        "minecraft:collision_box": { origin: [-8, 0, -8], size: [16, 16, 16] },
        "minecraft:selection_box": { origin: [-7.5, 0, -7.5], size: [15, 15, 15] },
        "minecraft:destruction_particles": { texture: "stone", particle_count: 50 },
        "minecraft:geometry": "geometry.big_block",
        "minecraft:material_instances": { "*": { texture: "stone" } },
      },
    },
  },
  // #55
  "behavior_packs/reports_bp/spawn_rules/target.json": {
    format_version: "1.8.0",
    "minecraft:spawn_rules": {
      description: { identifier: "reports:target", population_control: "monster" },
      conditions: [
        {
          "minecraft:spawns_on_surface": {},
          "minecraft:weight": { default: 10 },
          "minecraft:biome_filter": {
            any_of: [
              { test: "has_biome_tag", value: "nether_wastes" },
              { test: "has_biome_tag", value: "pale_garden" },
              { test: "has_biome_tag", value: "mooshroom_island" },
            ],
          },
        },
      ],
    },
  },
  // #28
  "resource_packs/reports_rp/particles/aabb.json": {
    format_version: "1.10.0",
    particle_effect: {
      description: {
        identifier: "reports:aabb",
        basic_render_parameters: { material: "particles_alpha", texture: "textures/particle/particles" },
      },
      components: {
        "minecraft:emitter_rate_instant": { num_particles: 10 },
        "minecraft:emitter_lifetime_once": { active_time: 1 },
        "minecraft:emitter_shape_entity_aabb": { surface_only: true, direction: "inwards" },
        "minecraft:particle_lifetime_expression": { max_lifetime: 1 },
        "minecraft:particle_appearance_billboard": { size: [0.1, 0.1], facing_camera_mode: "lookat_xyz" },
      },
    },
  },
};

function writeFixture() {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });

  for (const relativePath in fixtureFiles) {
    const fullPath = path.join(fixtureRoot, relativePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, JSON.stringify(fixtureFiles[relativePath], null, 2));
  }
}

/** Warnings and errors from the three schema generators for one fixture file. */
function schemaIssuesFor(infoSet: ProjectInfoSet, fileName: string): ProjectInfoItem[] {
  return infoSet.items.filter(
    (item) =>
      schemaGeneratorIds.includes(item.generatorId) &&
      (item.itemType === InfoItemType.warning || item.itemType === InfoItemType.error) &&
      item.projectItem !== undefined &&
      typeof item.projectItem.projectPath === "string" &&
      item.projectItem.projectPath.endsWith("/" + fileName)
  );
}

function describeIssues(issues: ProjectInfoItem[]) {
  return issues
    .map((item) => `[${item.generatorId}${item.generatorIndex}] ${item.message} ${item.data ?? ""}`)
    .join("\n");
}

async function loadForm(subFolder: string, name: string): Promise<IFormDefinition> {
  const form = await Database.ensureFormLoaded(subFolder, name);
  assert(form, `Expected form ${subFolder}/${name} to load`);
  return form;
}

function loadLocalFormOverride(relativePath: string): IFormDefinition {
  const form = JSON.parse(fs.readFileSync(path.join(localFormsRoot, relativePath), "utf8")) as IFormDefinition;
  FieldUtilities.normalizeFormFieldDataTypes(form);
  return form;
}

describe("publicSchemaReports", () => {
  let env: ITestEnvironment;
  let infoSet: ProjectInfoSet;

  before(async function () {
    this.timeout(120000);

    env = await TestPaths.createTestEnvironment();
    writeFixture();

    const project = new Project(env.creatorTools, "publicSchemaReports", null);
    project.autoDeploymentMode = ProjectAutoDeploymentMode.noAutoDeployment;
    project.localFolderPath = fixtureRoot;

    await project.inferProjectItemsFromFiles();

    infoSet = new ProjectInfoSet(project, ProjectInfoSuite.defaultInDevelopment);
    await infoSet.generateForProject();
  });

  it("ran the schema validators on the current-format fixtures", () => {
    const skipped = infoSet.items.filter(
      (item) =>
        schemaGeneratorIds.includes(item.generatorId) &&
        item.itemType === InfoItemType.info &&
        typeof item.message === "string" &&
        item.message.includes("not at a current format version") &&
        item.projectItem !== undefined &&
        typeof item.projectItem.projectPath === "string" &&
        /\/(target|button_item|big_block)\.json$/.test(item.projectItem.projectPath) &&
        !item.projectItem.projectPath.includes("/spawn_rules/")
    );
    assert.equal(skipped.length, 0, describeIssues(skipped));
  });

  describe("entity components (#75, #26, #70)", () => {
    it("accepts an attack_interval range object and an entity_types object array", () => {
      const issues = schemaIssuesFor(infoSet, "target.json").filter((item) =>
        item.projectItem!.projectPath!.includes("/entities/")
      );
      assert.equal(issues.length, 0, describeIssues(issues));
    });

    it("accepts a single-number attack_interval", () => {
      const issues = schemaIssuesFor(infoSet, "target_scalar_interval.json");
      assert.equal(issues.length, 0, describeIssues(issues));
    });

    it("validates the shipped nearest_attackable_target form without its removed placeholder", async () => {
      const form = await loadForm("entity", "minecraft_behavior_nearest_attackable_target");

      expect(await DataFormValidator.validate(nearestAttackableTarget, form)).to.deep.equal([]);
      expect(await DataFormValidator.validate({ attack_interval: 5 }, form)).to.deep.equal([]);

      const schema = await JsonSchemaGenerator.convertFormDefinitionToJsonSchema(form);
      expect(schema.properties).to.have.property("attack_interval");
      expect(schema.properties).to.not.have.property("attack_interval|attack_interval_min");

      const generator = new FormDefinitionTypeScriptGenerator();
      const lines: string[] = [];
      await generator.appendType(form, lines, 0);
      expect(lines.join("\n")).to.not.include("attack_intervalattack_interval_min");
    });

    it("accepts leashable presets", async () => {
      const form = await loadForm("entity", "minecraft_leashable");
      const leashable = fixtureFiles["behavior_packs/reports_bp/entities/target.json"] as any;

      expect(
        await DataFormValidator.validate(leashable["minecraft:entity"].components["minecraft:leashable"], form)
      ).to.deep.equal([]);
    });
  });

  describe("item interact_button (#27)", () => {
    for (const relativePath of [
      "item_components/minecraft_interact_button.form.json",
      "item/minecraft_interact_button.form.json",
    ]) {
      it(`${relativePath} accepts a string or a boolean`, async () => {
        const form = loadLocalFormOverride(relativePath);

        expect(await DataFormValidator.validate("Open Menu", form)).to.deep.equal([]);
        expect(await DataFormValidator.validate(true, form)).to.deep.equal([]);

        const issues = await DataFormValidator.validate(42, form);
        assert.equal(issues.length, 1, "a number is not a valid interact_button value");
      });
    }

    it("produces no schema warnings for a string interact_button", () => {
      const issues = schemaIssuesFor(infoSet, "button_item.json");
      assert.equal(issues.length, 0, describeIssues(issues));
    });
  });

  describe("particle emitter_shape_entity_aabb (#28)", () => {
    it("produces no schema warnings for surface_only and a string direction", () => {
      const issues = schemaIssuesFor(infoSet, "aabb.json");
      assert.equal(issues.length, 0, describeIssues(issues));
    });

    it("builds an editor schema that accepts both shapes", async () => {
      const form = await loadForm("client_particles", "emitter_shape_entity_aabb");
      const schema = await JsonSchemaGenerator.convertFormDefinitionToJsonSchema(form);
      const properties = schema.properties as any;

      expect(properties.surface_only.type).to.equal("boolean");

      const direction = properties.direction;
      const directionOptions: any[] = direction.oneOf || direction.anyOf || [direction];
      expect(
        directionOptions.some((option) => option.type === "string"),
        "direction accepts a string"
      ).to.equal(true);
      expect(
        directionOptions.some((option) => option.type === "array"),
        "direction accepts a vector"
      ).to.equal(true);
    });
  });

  describe("block boxes and destruction particles (#74, #45, #18, #73)", () => {
    it("produces no schema warnings for sizes up to 16 and destruction_particles", () => {
      const issues = schemaIssuesFor(infoSet, "big_block.json");
      assert.equal(issues.length, 0, describeIssues(issues));
    });

    it("validates the block components form with the same values", async () => {
      // The shipped override restores the single { origin, size } object that upstream dropped.
      const form = loadLocalFormOverride("block/components.form.json");
      const block = fixtureFiles["behavior_packs/reports_bp/blocks/big_block.json"] as any;

      expect(await DataFormValidator.validate(block["minecraft:block"].components, form)).to.deep.equal([]);
      expect(await DataFormValidator.validate({ "minecraft:collision_box": false }, form)).to.deep.equal([]);
    });
  });

  describe("entity forms that 1.26.60 narrowed", () => {
    // The shipped overrides keep the earlier shapes, which vanilla content still uses, next to the new ones.
    it("accepts a string list or block descriptors for buoyant liquid_blocks", async () => {
      const form = loadLocalFormOverride("entity/minecraft_buoyant.form.json");

      expect(
        await DataFormValidator.validate({ liquid_blocks: ["minecraft:flowing_water", "minecraft:water"] }, form)
      ).to.deep.equal([]);
      expect(await DataFormValidator.validate({ liquid_blocks: [{ name: "minecraft:water" }] }, form)).to.deep.equal(
        []
      );
    });

    it("accepts a string or a list for transformation sounds", async () => {
      const form = loadLocalFormOverride("entity/minecraft_transformation.form.json");

      expect(
        await DataFormValidator.validate(
          { begin_transform_sound: "mob.pig.death", transformation_sound: "mob.pig.death" },
          form
        )
      ).to.deep.equal([]);
      expect(await DataFormValidator.validate({ transformation_sound: ["mob.pig.death"] }, form)).to.deep.equal([]);
    });

    it("accepts a number pair or an object range for trade table cured discounts", async () => {
      const form = loadLocalFormOverride("entity/minecraft_economy_trade_table.form.json");

      expect(
        await DataFormValidator.validate({ cured_discount: [-25, -20], max_cured_discount: [-25, -20] }, form)
      ).to.deep.equal([]);
      expect(await DataFormValidator.validate({ cured_discount: { min: -25, max: -20 } }, form)).to.deep.equal([]);
      expect(await DataFormValidator.validate({ cured_discount: "cheap" }, form)).to.not.deep.equal([]);
    });

    it("accepts a string or a list for spell effect removals", async () => {
      const form = loadLocalFormOverride("entity/minecraft_spell_effects.form.json");

      expect(await DataFormValidator.validate({ remove_effects: "bad_omen" }, form)).to.deep.equal([]);
      expect(await DataFormValidator.validate({ remove_effects: ["bad_omen", "wither"] }, form)).to.deep.equal([]);
      expect(await DataFormValidator.validate({ remove_effects: 5 }, form)).to.not.deep.equal([]);
    });
  });

  describe("spawn rule biome tags (#55)", () => {
    it("produces no schema warnings for nether_wastes, pale_garden and mooshroom_island", () => {
      const issues = schemaIssuesFor(infoSet, "target.json").filter((item) =>
        item.projectItem!.projectPath!.includes("/spawn_rules/")
      );
      assert.equal(issues.length, 0, describeIssues(issues));
    });
  });

  describe("TypeScript types (#69)", () => {
    it("ships consumable types for the reported components", () => {
      // Compile-time check: the package's barrel exports resolve under --type-check.
      type NearestAttackableTarget = bp.MinecraftBehaviorNearestAttackableTarget;
      const target: NearestAttackableTarget = {};
      expect(target).to.deep.equal({});

      const typesRoot = path.join(bedrockSchemasRoot, "types");
      expect(fs.existsSync(path.join(typesRoot, "index.d.ts"))).to.equal(true);
      expect(fs.existsSync(path.join(typesRoot, "bp", "items", "components", "MinecraftInteractButton.d.ts"))).to.equal(
        true
      );

      const packageJson = JSON.parse(fs.readFileSync(path.join(bedrockSchemasRoot, "package.json"), "utf8"));
      expect(packageJson.types).to.equal("./types/index.d.ts");
    });
  });
});
