// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * LangcoreTests - Unit tests for the Language Core (langcore) module
 *
 * Tests platform-agnostic language intelligence for Minecraft content:
 * - shared/ - Path utilities, reference types, knowledge base
 * - json/ - JSON path resolution, hover, completions
 * - molang/ - Molang parsing, completions, hover
 * - javascript/ - Script module info
 * - mcfunction/ - Command parsing
 */

import { expect } from "chai";

// Shared module imports
import { MinecraftPathUtils } from "../langcore/shared/MinecraftPathUtils";

import {
  getReferenceTypeFromPath,
  getReferenceTypeFromProperty,
  parseNamespacedId,
  looksLikeMinecraftId,
} from "../langcore/shared/MinecraftReferenceTypes";

import {
  VANILLA_ENTITIES,
  formatTicksAsTime,
  getHealthComparison,
  getSpeedComparison,
} from "../langcore/shared/MinecraftKnowledge";

// Molang module imports
import { molangParser, MOLANG_QUERIES, MOLANG_MATH } from "../langcore/molang/MolangParser";

import { molangHoverGenerator } from "../langcore/molang/MolangHover";
import { molangCompletionGenerator } from "../langcore/molang/MolangCompletions";

// JavaScript module imports
import { SCRIPT_MODULES, ScriptModuleInfoProvider, IScriptModuleInfo } from "../langcore/javascript/ScriptModuleInfo";

// JSON module imports
import { CompletionItemKind } from "../langcore/json/JsonCompletionItems";

describe("Langcore Tests", () => {
  describe("MinecraftPathUtils", () => {
    describe("isMinecraftContentPath", () => {
      it("should detect behavior pack paths", () => {
        expect(MinecraftPathUtils.isMinecraftContentPath("behavior_pack/entities/pig.json")).to.be.true;
        expect(MinecraftPathUtils.isMinecraftContentPath("BP/entities/zombie.json")).to.be.true;
        expect(MinecraftPathUtils.isMinecraftContentPath("my_addon_bp/items/sword.json")).to.be.true;
        expect(MinecraftPathUtils.isMinecraftContentPath("behavior_packs/test/blocks/stone.json")).to.be.true;
      });

      it("should detect resource pack paths", () => {
        expect(MinecraftPathUtils.isMinecraftContentPath("resource_pack/textures/entity/pig.png")).to.be.true;
        expect(MinecraftPathUtils.isMinecraftContentPath("RP/models/entity/pig.geo.json")).to.be.true;
        expect(MinecraftPathUtils.isMinecraftContentPath("my_addon_rp/textures/blocks/stone.png")).to.be.true;
      });

      it("should detect common content paths without pack prefix", () => {
        expect(MinecraftPathUtils.isMinecraftContentPath("project/entities/pig.json")).to.be.true;
        expect(MinecraftPathUtils.isMinecraftContentPath("project/blocks/custom_block.json")).to.be.true;
        expect(MinecraftPathUtils.isMinecraftContentPath("project/items/diamond_sword.json")).to.be.true;
      });

      it("should reject non-Minecraft paths", () => {
        expect(MinecraftPathUtils.isMinecraftContentPath("src/app/index.ts")).to.be.false;
        expect(MinecraftPathUtils.isMinecraftContentPath("package.json")).to.be.false;
        expect(MinecraftPathUtils.isMinecraftContentPath("README.md")).to.be.false;
      });
    });

    describe("getPackType", () => {
      it("should identify behavior pack type", () => {
        expect(MinecraftPathUtils.getPackType("behavior_pack/entities/pig.json")).to.equal("behavior");
        expect(MinecraftPathUtils.getPackType("BP/entities/pig.json")).to.equal("behavior");
      });

      it("should identify resource pack type", () => {
        expect(MinecraftPathUtils.getPackType("resource_pack/textures/entity/pig.png")).to.equal("resource");
        expect(MinecraftPathUtils.getPackType("RP/models/entity/pig.geo.json")).to.equal("resource");
      });

      it("should return unknown for ambiguous paths", () => {
        expect(MinecraftPathUtils.getPackType("random_folder/file.json")).to.equal("unknown");
      });
    });

    describe("getContentType", () => {
      it("should detect entity content", () => {
        expect(MinecraftPathUtils.getContentType("behavior_pack/entities/pig.json")).to.equal("entity");
      });

      it("should detect block content", () => {
        expect(MinecraftPathUtils.getContentType("behavior_pack/blocks/custom.json")).to.equal("block");
      });

      it("should detect item content", () => {
        expect(MinecraftPathUtils.getContentType("behavior_pack/items/sword.json")).to.equal("item");
      });

      it("should detect recipe content", () => {
        expect(MinecraftPathUtils.getContentType("behavior_pack/recipes/crafting.json")).to.equal("recipe");
      });

      it("should detect loot table content", () => {
        // Use a path without /entities/ to avoid ambiguity
        expect(MinecraftPathUtils.getContentType("behavior_pack/loot_tables/chests/simple_dungeon.json")).to.equal(
          "loot_table"
        );
      });

      it("should detect animation content", () => {
        expect(MinecraftPathUtils.getContentType("resource_pack/animations/pig.animation.json")).to.equal("animation");
      });

      it("should detect model/geometry content", () => {
        expect(MinecraftPathUtils.getContentType("resource_pack/models/entity/pig.geo.json")).to.equal("model");
      });

      it("should detect texture content", () => {
        expect(MinecraftPathUtils.getContentType("resource_pack/textures/entity/pig.png")).to.equal("texture");
      });

      it("should detect script content", () => {
        expect(MinecraftPathUtils.getContentType("behavior_pack/scripts/main.js")).to.equal("script");
      });

      it("should detect function content", () => {
        expect(MinecraftPathUtils.getContentType("behavior_pack/functions/init.mcfunction")).to.equal("function");
      });
    });

    describe("analyzePath", () => {
      it("should fully analyze a behavior pack entity path", () => {
        const analysis = MinecraftPathUtils.analyzePath("behavior_pack/entities/pig.json");
        expect(analysis.isMinecraft).to.be.true;
        expect(analysis.packType).to.equal("behavior");
        expect(analysis.contentType).to.equal("entity");
        expect(analysis.identifier).to.equal("pig");
      });

      it("should extract identifier from filename", () => {
        const analysis = MinecraftPathUtils.analyzePath("BP/items/diamond_sword.json");
        expect(analysis.identifier).to.equal("diamond_sword");
      });
    });
  });

  describe("MinecraftReferenceTypes", () => {
    describe("getReferenceTypeFromPath", () => {
      it("should detect texture references", () => {
        expect(getReferenceTypeFromPath(["textures", "default"])).to.equal("texture");
        expect(getReferenceTypeFromPath(["textures", "entity"])).to.equal("texture");
      });

      it("should detect geometry references", () => {
        expect(getReferenceTypeFromPath(["description", "geometry"])).to.equal("geometry");
      });

      it("should detect animation references", () => {
        expect(getReferenceTypeFromPath(["animations", "walk"])).to.equal("animation");
      });

      it("should detect loot table references", () => {
        // The path pattern matches loot_table$ at end of joined string
        expect(getReferenceTypeFromPath(["minecraft:loot", "loot_table"])).to.equal("loot_table");
      });

      it("should detect event references", () => {
        expect(getReferenceTypeFromPath(["trigger", "event"])).to.equal("event");
      });

      it("should return unknown for unrecognized paths", () => {
        expect(getReferenceTypeFromPath(["random", "stuff"])).to.equal("unknown");
      });
    });

    describe("getReferenceTypeFromProperty", () => {
      it("should detect texture property", () => {
        expect(getReferenceTypeFromProperty("texture")).to.equal("texture");
        expect(getReferenceTypeFromProperty("texture_path")).to.equal("texture");
      });

      it("should detect geometry property", () => {
        expect(getReferenceTypeFromProperty("geometry")).to.equal("geometry");
      });

      it("should detect animation property", () => {
        expect(getReferenceTypeFromProperty("animation")).to.equal("animation");
      });

      it("should detect event property", () => {
        expect(getReferenceTypeFromProperty("event")).to.equal("event");
      });
    });

    describe("parseNamespacedId", () => {
      it("should parse minecraft namespace", () => {
        const result = parseNamespacedId("minecraft:pig");
        expect(result.namespace).to.equal("minecraft");
        expect(result.name).to.equal("pig");
      });

      it("should parse custom namespace", () => {
        const result = parseNamespacedId("custom:my_mob");
        expect(result.namespace).to.equal("custom");
        expect(result.name).to.equal("my_mob");
      });

      it("should handle ID without namespace (defaults to minecraft)", () => {
        const result = parseNamespacedId("pig");
        expect(result.namespace).to.equal("minecraft");
        expect(result.name).to.equal("pig");
      });
    });

    describe("looksLikeMinecraftId", () => {
      it("should accept valid namespaced IDs", () => {
        expect(looksLikeMinecraftId("minecraft:pig")).to.be.true;
        expect(looksLikeMinecraftId("custom:my_entity")).to.be.true;
        expect(looksLikeMinecraftId("my_pack:special_block")).to.be.true;
      });

      it("should accept texture and geometry path patterns", () => {
        expect(looksLikeMinecraftId("textures/entity/pig")).to.be.true;
        expect(looksLikeMinecraftId("geometry.pig")).to.be.true;
        expect(looksLikeMinecraftId("animation.pig.walk")).to.be.true;
      });

      it("should reject invalid IDs", () => {
        expect(looksLikeMinecraftId("")).to.be.false;
        expect(looksLikeMinecraftId("Has Spaces")).to.be.false;
        // Simple identifiers without namespace or path prefix are rejected
        expect(looksLikeMinecraftId("pig")).to.be.false;
      });
    });
  });

  describe("MinecraftKnowledge", () => {
    describe("VANILLA_ENTITIES", () => {
      it("should contain common vanilla entities with minecraft prefix", () => {
        expect(VANILLA_ENTITIES).to.include("minecraft:pig");
        expect(VANILLA_ENTITIES).to.include("minecraft:zombie");
        expect(VANILLA_ENTITIES).to.include("minecraft:creeper");
        expect(VANILLA_ENTITIES).to.include("minecraft:skeleton");
      });

      it("should have reasonable count of entities", () => {
        expect(VANILLA_ENTITIES.length).to.be.greaterThan(20);
      });
    });

    describe("formatTicksAsTime", () => {
      it("should format ticks as seconds", () => {
        // 20 ticks = 1s in short format
        expect(formatTicksAsTime(20)).to.equal("1s");
        expect(formatTicksAsTime(40)).to.equal("2s");
      });

      it("should format large tick values as minutes", () => {
        // 1200 ticks = 1m in short format
        expect(formatTicksAsTime(1200)).to.equal("1m");
      });

      it("should show ticks for small values", () => {
        // Values less than 20 ticks are shown as ticks
        expect(formatTicksAsTime(10)).to.equal("10 ticks");
      });
    });

    describe("getHealthComparison", () => {
      it("should compare to known entity health values", () => {
        const comparison20 = getHealthComparison(20);
        expect(comparison20).to.be.a("string");
        expect(comparison20).to.include("Player"); // Player has 20 health
      });

      it("should return null for uncommon values", () => {
        const comparison = getHealthComparison(12345);
        expect(comparison).to.be.null;
      });
    });

    describe("getSpeedComparison", () => {
      it("should compare to known entity speeds", () => {
        const comparison = getSpeedComparison(0.25);
        expect(comparison).to.be.a("string");
      });
    });
  });

  describe("MolangParser", () => {
    describe("tokenize", () => {
      it("should tokenize query expressions", () => {
        const result = molangParser.parse("query.is_baby");
        expect(result.queries).to.include("query.is_baby");
        expect(result.isValid).to.be.true;
      });

      it("should tokenize short query format", () => {
        const result = molangParser.parse("q.is_baby");
        expect(result.queries.length).to.be.greaterThan(0);
      });

      it("should tokenize variable expressions", () => {
        const result = molangParser.parse("variable.my_var");
        expect(result.variables).to.include("variable.my_var");
      });

      it("should tokenize short variable format", () => {
        const result = molangParser.parse("v.my_var");
        expect(result.variables.length).to.be.greaterThan(0);
      });

      it("should tokenize temp variables", () => {
        const result = molangParser.parse("temp.x = 5");
        expect(result.temps).to.include("temp.x");
      });

      it("should tokenize math functions", () => {
        const result = molangParser.parse("math.sin(90)");
        expect(result.mathFunctions).to.include("math.sin");
      });

      it("should handle complex expressions", () => {
        const expr = "query.is_baby ? 0.5 : 1.0";
        const result = molangParser.parse(expr);
        expect(result.queries).to.include("query.is_baby");
        expect(result.isValid).to.be.true;
      });

      it("should handle arithmetic expressions", () => {
        const result = molangParser.parse("math.sin(query.anim_time * 360)");
        expect(result.mathFunctions).to.include("math.sin");
        expect(result.queries).to.include("query.anim_time");
      });

      it("should tokenize parenthesized expressions", () => {
        const result = molangParser.parse("(query.health + 5) * 2");
        expect(result.queries).to.include("query.health");
        expect(result.tokens.some((t) => t.type === "parenthesis")).to.be.true;
      });
    });

    describe("MOLANG_QUERIES", () => {
      it("should contain common queries", () => {
        const queryNames = MOLANG_QUERIES.map((q) => q.name);
        expect(queryNames).to.include("query.is_baby");
        expect(queryNames).to.include("query.health");
        expect(queryNames).to.include("query.anim_time");
        expect(queryNames).to.include("query.is_on_ground");
      });

      it("should have descriptions for all queries", () => {
        for (const query of MOLANG_QUERIES) {
          expect(query.description).to.be.a("string");
          expect(query.description.length).to.be.greaterThan(5);
        }
      });

      it("should have return types for all queries", () => {
        for (const query of MOLANG_QUERIES) {
          expect(query.returns).to.be.a("string");
          expect(query.returns.length).to.be.greaterThan(0);
        }
      });
    });

    describe("MOLANG_MATH", () => {
      it("should contain common math functions", () => {
        const mathNames = MOLANG_MATH.map((m) => m.name);
        expect(mathNames).to.include("math.sin");
        expect(mathNames).to.include("math.cos");
        expect(mathNames).to.include("math.abs");
        expect(mathNames).to.include("math.floor");
        expect(mathNames).to.include("math.clamp");
      });

      it("should have syntax examples for all functions", () => {
        for (const math of MOLANG_MATH) {
          expect(math.syntax).to.be.a("string");
          expect(math.syntax).to.include(math.name);
        }
      });
    });
  });

  describe("MolangHover", () => {
    describe("generateHover", () => {
      it("should generate hover for query", () => {
        const hover = molangHoverGenerator.generateHover("query.is_baby", 0);
        expect(hover).to.not.be.null;
        if (hover) {
          expect(hover.sections.length).to.be.greaterThan(0);
        }
      });

      it("should generate hover for math function", () => {
        const hover = molangHoverGenerator.generateHover("math.sin", 0);
        expect(hover).to.not.be.null;
        if (hover) {
          expect(hover.sections.length).to.be.greaterThan(0);
        }
      });

      it("should generate hover for variable", () => {
        const hover = molangHoverGenerator.generateHover("variable.my_var", 0);
        expect(hover).to.not.be.null;
      });

      it("should handle short-form prefixes", () => {
        const hover = molangHoverGenerator.generateHover("q.is_baby", 0);
        expect(hover).to.not.be.null;
      });
    });
  });

  describe("MolangCompletions", () => {
    describe("generateCompletions", () => {
      it("should provide query completions for q. prefix", () => {
        const completions = molangCompletionGenerator.generateCompletions({
          expression: "q.",
          cursorOffset: 2,
          prefix: "q.",
          inFunction: false,
          functionName: null,
        });
        expect(completions.length).to.be.greaterThan(0);
        expect(completions.some((c: { label: string }) => c.label.includes("is_baby"))).to.be.true;
      });

      it("should provide query completions for query. prefix", () => {
        const completions = molangCompletionGenerator.generateCompletions({
          expression: "query.",
          cursorOffset: 6,
          prefix: "query.",
          inFunction: false,
          functionName: null,
        });
        expect(completions.length).to.be.greaterThan(0);
      });

      it("should provide math completions for math. prefix", () => {
        const completions = molangCompletionGenerator.generateCompletions({
          expression: "math.",
          cursorOffset: 5,
          prefix: "math.",
          inFunction: false,
          functionName: null,
        });
        expect(completions.length).to.be.greaterThan(0);
        expect(completions.some((c: { label: string }) => c.label.includes("sin"))).to.be.true;
      });

      it("should provide variable completions for variable. prefix", () => {
        const completions = molangCompletionGenerator.generateCompletions({
          expression: "variable.",
          cursorOffset: 9,
          prefix: "variable.",
          inFunction: false,
          functionName: null,
          existingVariables: ["variable.my_var", "variable.attack_time"],
        });
        expect(completions.length).to.be.greaterThan(0);
      });

      it("should provide all completions for empty prefix", () => {
        const completions = molangCompletionGenerator.generateCompletions({
          expression: "",
          cursorOffset: 0,
          prefix: "",
          inFunction: false,
          functionName: null,
        });
        expect(completions.length).to.be.greaterThan(0);
      });
    });
  });

  describe("ScriptModuleInfo", () => {
    describe("SCRIPT_MODULES", () => {
      it("should contain core modules", () => {
        const moduleNames = SCRIPT_MODULES.map((m: IScriptModuleInfo) => m.name);
        expect(moduleNames).to.include("@minecraft/server");
        expect(moduleNames).to.include("@minecraft/server-ui");
      });

      it("should have descriptions for all modules", () => {
        for (const mod of SCRIPT_MODULES) {
          expect(mod.description).to.be.a("string");
          expect(mod.description.length).to.be.greaterThan(10);
        }
      });

      it("should have version info for stable modules", () => {
        const serverModule = SCRIPT_MODULES.find((m: IScriptModuleInfo) => m.name === "@minecraft/server");
        expect(serverModule).to.not.be.undefined;
        expect(serverModule?.latestStableVersion).to.be.a("string");
      });
    });

    describe("ScriptModuleInfoProvider", () => {
      it("should return module info by name", () => {
        const info = ScriptModuleInfoProvider.getModuleInfo("@minecraft/server");
        expect(info).to.not.be.undefined;
        expect(info?.name).to.equal("@minecraft/server");
      });

      it("should return undefined for unknown modules", () => {
        const info = ScriptModuleInfoProvider.getModuleInfo("@unknown/module");
        expect(info).to.be.undefined;
      });

      it("should list all available module names", () => {
        const moduleNames = ScriptModuleInfoProvider.getAllModuleNames();
        expect(moduleNames.length).to.equal(SCRIPT_MODULES.length);
        expect(moduleNames).to.include("@minecraft/server");
      });

      it("should identify Minecraft modules", () => {
        expect(ScriptModuleInfoProvider.isMinecraftModule("@minecraft/server")).to.be.true;
        expect(ScriptModuleInfoProvider.isMinecraftModule("@unknown/module")).to.be.false;
      });

      it("should parse module versions", () => {
        const result = ScriptModuleInfoProvider.parseModuleVersion("^1.2.0");
        expect(result.version).to.equal("1.2.0");
        expect(result.isBeta).to.be.false;

        const betaResult = ScriptModuleInfoProvider.parseModuleVersion("1.0.0-beta");
        expect(betaResult.isBeta).to.be.true;
      });
    });
  });

  describe("JSON Completion Items", () => {
    describe("CompletionItemKind", () => {
      it("should have standard completion kinds as strings", () => {
        expect(CompletionItemKind.Property).to.be.a("string");
        expect(CompletionItemKind.Value).to.be.a("string");
        expect(CompletionItemKind.Keyword).to.be.a("string");
        expect(CompletionItemKind.Snippet).to.be.a("string");
        expect(CompletionItemKind.File).to.be.a("string");
      });

      it("should have distinct values for each kind", () => {
        const kinds = [
          CompletionItemKind.Property,
          CompletionItemKind.Value,
          CompletionItemKind.Keyword,
          CompletionItemKind.Snippet,
          CompletionItemKind.File,
        ];
        const unique = new Set(kinds);
        expect(unique.size).to.equal(kinds.length);
      });

      it("should have expected string values", () => {
        expect(CompletionItemKind.Property).to.equal("property");
        expect(CompletionItemKind.Value).to.equal("value");
        expect(CompletionItemKind.Entity).to.equal("entity");
      });
    });
  });

  describe("Integration: Reference Detection", () => {
    it("should detect loot table reference via property name", () => {
      // Property-based detection for loot_table
      const refType = getReferenceTypeFromProperty("table");
      expect(refType).to.equal("loot_table");

      const refType2 = getReferenceTypeFromProperty("loot_table");
      expect(refType2).to.equal("loot_table");
    });

    it("should detect geometry reference in block", () => {
      // Simulating: minecraft:block.components.minecraft:geometry
      const refType = getReferenceTypeFromProperty("geometry");
      expect(refType).to.equal("geometry");
    });

    it("should detect animation reference", () => {
      // Path pattern for animations
      const path = ["description", "animations", "walk"];
      const refType = getReferenceTypeFromPath(path);
      expect(refType).to.equal("animation");
    });

    it("should detect texture reference from path", () => {
      const path = ["textures", "default"];
      const refType = getReferenceTypeFromPath(path);
      expect(refType).to.equal("texture");
    });
  });

  describe("Integration: Path Analysis + Content Type", () => {
    it("should correctly chain path analysis with content type", () => {
      const path = "behavior_pack/entities/custom_mob.json";

      // First check if it's Minecraft content
      expect(MinecraftPathUtils.isMinecraftContentPath(path)).to.be.true;

      // Then get detailed analysis
      const analysis = MinecraftPathUtils.analyzePath(path);
      expect(analysis.packType).to.equal("behavior");
      expect(analysis.contentType).to.equal("entity");
      expect(analysis.identifier).to.equal("custom_mob");
    });

    it("should handle resource pack geometry files", () => {
      const path = "resource_pack/models/entity/player.geo.json";

      expect(MinecraftPathUtils.isMinecraftContentPath(path)).to.be.true;

      const analysis = MinecraftPathUtils.analyzePath(path);
      expect(analysis.packType).to.equal("resource");
      expect(analysis.contentType).to.equal("model");
    });
  });
});
