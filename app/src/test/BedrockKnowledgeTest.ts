// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * BedrockKnowledgeTest - tests for the engine-derived Bedrock Knowledge IR, the update pipeline's
 * builder/diff, and the langcore features that consume it.
 */

import { expect } from "chai";

import { IBedrockKnowledge, IKnowledgeCommand, BEDROCK_KNOWLEDGE_FORMAT_VERSION } from "../knowledge/IBedrockKnowledge";
import { findNewDiagnosticOccurrences } from "../knowledge/BedrockKnowledgeAccuracy";
import { createGitHubMetadataReader } from "../knowledge/BedrockMetadataReader";
import { molangCompletionGenerator } from "../langcore/molang/MolangCompletions";
import {
  buildBedrockKnowledge,
  compactCommandEnumValues,
  expandCommandEnumValues,
  IRawBedrockMetadata,
} from "../knowledge/BedrockKnowledgeBuilder";
import {
  diffBedrockKnowledge,
  formatKnowledgeDiffMarkdown,
  getPotentiallyBreakingChanges,
  knowledgeDiffHasChanges,
} from "../knowledge/BedrockKnowledgeDiff";
import {
  compareBedrockVersions,
  findCommand,
  findMolangMath,
  findMolangQuery,
  formatMolangSignature,
  getActiveBedrockChannel,
  getBedrockKnowledge,
  getCommandEnumValues,
  isBedrockChannelAvailable,
  isCommandEnumValue,
  isMolangQueryAvailable,
  isVanillaIdentifier,
  normalizeMolangName,
  onDidChangeBedrockKnowledge,
  registerBedrockKnowledge,
  setActiveBedrockChannel,
  unregisterBedrockKnowledge,
} from "../knowledge/BedrockKnowledge";
import { getKnowledgeUpdateProblems } from "../knowledge/BedrockKnowledgeValidation";
import { lookupBedrockReference } from "../knowledge/BedrockKnowledgeLookup";
import { MINECRAFT_COMMANDS, commandParser } from "../langcore/mcfunction/CommandParser";
import { commandDiagnosticGenerator } from "../langcore/mcfunction/CommandDiagnostics";
import {
  getNextParameterCandidates,
  getOverloadProgress,
  matchCommandOverloads,
} from "../langcore/mcfunction/CommandOverloadMatcher";
import { MOLANG_MATH, MOLANG_QUERIES } from "../langcore/molang/MolangParser";
import { molangDiagnosticGenerator } from "../langcore/molang/MolangDiagnostics";
import { VANILLA_BLOCKS, VANILLA_ENTITIES, VANILLA_ITEMS } from "../langcore/shared/MinecraftKnowledge";

function rawFixture(): IRawBedrockMetadata {
  return {
    commands: {
      command_enums: [
        { name: "GameMode", values: [{ value: "survival" }, { value: "creative" }, { value: "s" }, { value: "c" }] },
        {
          name: "Block",
          values: [{ value: "minecraft:stone" }, { value: "stone" }, { value: "minecraft:dirt" }, { value: "dirt" }],
        },
        { name: "TagValues", values: [] },
      ],
      commands: [
        {
          name: "teleport",
          description: "Teleports entities.",
          aliases: [{ name: "tp" }],
          permission_level: 1,
          requires_cheats: true,
          overloads: [
            { params: [{ name: "destination", type: { name: "POSITION" } }] },
            {
              params: [
                { name: "victim", type: { name: "SELECTION" } },
                { name: "destination", type: { name: "SELECTION" } },
              ],
            },
          ],
        },
        {
          name: "gamemode",
          description: "Sets a player's game mode.",
          permission_level: 1,
          requires_cheats: true,
          overloads: [
            {
              params: [
                { name: "gameMode", type: { name: "GAMEMODE" } },
                { name: "player", type: { name: "SELECTION" }, is_optional: true },
              ],
            },
          ],
        },
      ],
    },
    molang: {
      queries: [
        {
          name: "query.is_baby",
          description: "Returns 1.0 if the entity is a baby.",
          min_args: 0,
          return_type: "bool",
          version_ranges: [{ first_version: "0.0.0", query_sets: ["default"] }],
        },
        {
          name: "query.old_thing",
          description: "Deprecated.",
          min_args: 0,
          version_ranges: [{ first_version: "1.0.0", last_version: "1.20.0", query_sets: ["default"] }],
        },
      ],
      math_functions: [{ name: "math.clamp", description: "Clamp", min_args: 3, max_args: 3 }],
    },
    vanilla: {
      entities: { data_items: [{ name: "minecraft:pig" }, { name: "minecraft:cow" }, { name: "minecraft:pig" }] },
      blocks: {
        data_items: [{ name: "minecraft:stone", properties: [{ name: "stone_type" }] }],
        block_properties: [{ name: "stone_type", type: "string", values: [{ value: "granite" }, { value: "stone" }] }],
      },
    },
  };
}

function buildFixture(gameVersion = "1.21.0.1"): IBedrockKnowledge {
  return buildBedrockKnowledge(rawFixture(), {
    channel: "preview",
    gameVersion,
    source: { origin: "test", ref: "test" },
  });
}

describe("Bedrock Knowledge", () => {
  describe("builder", () => {
    it("produces the current format version and sorted, de-duplicated vanilla lists", () => {
      const k = buildFixture();
      expect(k.formatVersion).to.equal(BEDROCK_KNOWLEDGE_FORMAT_VERSION);
      expect(k.vanilla.entities).to.deep.equal(["minecraft:cow", "minecraft:pig"]);
      expect(k.vanilla.blocks[0]).to.deep.equal({ name: "minecraft:stone", states: ["stone_type"] });
      expect(k.vanilla.blockStates[0].values).to.deep.equal(["granite", "stone"]);
    });

    it("is deterministic", () => {
      expect(JSON.stringify(buildFixture())).to.equal(JSON.stringify(buildFixture()));
    });

    it("maps parameter types to command enums case-insensitively", () => {
      const gamemode = buildFixture().commands.find((c) => c.name === "gamemode")!;
      expect(gamemode.overloads[0].params[0].enumName).to.equal("GameMode");
      expect(gamemode.overloads[0].params[1].optional).to.equal(true);
    });

    it("captures aliases, permission level and cheats", () => {
      const teleport = buildFixture().commands.find((c) => c.name === "teleport")!;
      expect(teleport.aliases).to.deep.equal(["tp"]);
      expect(teleport.permissionLevel).to.equal(1);
      expect(teleport.requiresCheats).to.equal(true);
    });

    it("compacts minecraft-namespaced enum pairs and expands them back", () => {
      const compacted = compactCommandEnumValues(["minecraft:stone", "stone", "minecraft:dirt", "dirt"]);
      expect(compacted).to.deep.equal({
        values: ["minecraft:dirt", "minecraft:stone"],
        minecraftNamespaceOptional: true,
      });
      expect(expandCommandEnumValues(compacted)).to.deep.equal(["dirt", "minecraft:dirt", "minecraft:stone", "stone"]);

      const notPaired = compactCommandEnumValues(["minecraft:stone", "dirt"]);
      expect(notPaired.minecraftNamespaceOptional).to.equal(undefined);
      expect(notPaired.values).to.deep.equal(["dirt", "minecraft:stone"]);
    });

    it("keeps Molang availability ranges", () => {
      const old = buildFixture().molang.queries.find((q) => q.name === "query.old_thing")!;
      expect(old.availability[0].lastVersion).to.equal("1.20.0");
    });
  });

  describe("diff", () => {
    it("reports no changes for identical snapshots", () => {
      const diff = diffBedrockKnowledge(buildFixture(), buildFixture());
      expect(knowledgeDiffHasChanges(diff)).to.equal(false);
    });

    it("detects additions, removals, and overload changes and flags removals as breaking", () => {
      const before = buildFixture("1.21.0.1");
      const after = buildFixture("1.21.10.1");
      after.commands = after.commands.filter((c) => c.name !== "gamemode");
      after.commands[0].overloads = after.commands[0].overloads.slice(0, 1);
      after.vanilla.entities = [...after.vanilla.entities, "minecraft:sniffer"];
      after.molang.math.push({ name: "math.sign", description: "Sign", minArgs: 1, maxArgs: 1 });

      const diff = diffBedrockKnowledge(before, after);
      expect(knowledgeDiffHasChanges(diff)).to.equal(true);
      expect(diff.commands.removed).to.deep.equal(["gamemode"]);
      expect(diff.commands.changed.map((c) => c.name)).to.deep.equal(["teleport"]);
      expect(diff.vanilla.entities.added).to.deep.equal(["minecraft:sniffer"]);
      expect(diff.molangMath.added).to.deep.equal(["math.sign"]);

      const breaking = getPotentiallyBreakingChanges(diff);
      expect(breaking.some((b) => b.includes("gamemode"))).to.equal(true);
      expect(breaking.some((b) => b.includes("teleport"))).to.equal(true);

      const md = formatKnowledgeDiffMarkdown(diff, "preview");
      expect(md).to.contain("1.21.0.1");
      expect(md).to.contain("1.21.10.1");
      expect(md).to.contain("minecraft:sniffer");
    });

    it("flags removed command enums, enum values, and block state values as breaking", () => {
      const before = buildFixture("1.21.0.1");
      const after = buildFixture("1.21.10.1");
      const [removedEnum, changedEnum] = Object.keys(after.commandEnums);
      delete after.commandEnums[removedEnum];
      after.commandEnums[changedEnum] = { ...after.commandEnums[changedEnum], values: [] };
      before.vanilla.blockStates = [
        ...before.vanilla.blockStates,
        { name: "zz_retired", type: "bool", values: [true] },
      ];
      after.vanilla.blockStates = after.vanilla.blockStates.map((s) => ({ ...s, values: s.values.slice(1) }));

      const breaking = getPotentiallyBreakingChanges(diffBedrockKnowledge(before, after));
      expect(breaking.some((b) => b.includes(`Command enum removed: \`${removedEnum}\``))).to.equal(true);
      expect(breaking.some((b) => b.includes(`Command enum \`${changedEnum}\` values removed`))).to.equal(true);
      expect(breaking.some((b) => b.startsWith("Block state removed"))).to.equal(true);
      expect(breaking.some((b) => b.includes("value removed"))).to.equal(true);
    });

    it("flags narrowed command access, Molang signatures, availability, and block schemas as breaking, but not widened ones", () => {
      const tp = (k: IBedrockKnowledge) => k.commands.find((c) => c.name === "teleport")!;
      const cases: {
        name: string;
        before?: (k: IBedrockKnowledge) => void;
        edit: (k: IBedrockKnowledge) => void;
        breaking: boolean;
      }[] = [
        { name: "permission level raised", edit: (k) => (tp(k).permissionLevel = 2), breaking: true },
        { name: "permission level lowered", edit: (k) => (tp(k).permissionLevel = 0), breaking: false },
        {
          name: "cheats requirement enabled",
          before: (k) => (tp(k).requiresCheats = false),
          edit: (k) => (tp(k).requiresCheats = true),
          breaking: true,
        },
        { name: "cheats requirement disabled", edit: (k) => (tp(k).requiresCheats = false), breaking: false },
        {
          name: "empty (default) query set narrowed to world_gen",
          before: (k) => (k.molang.queries[0].availability[0].querySets = []),
          edit: (k) => (k.molang.queries[0].availability[0].querySets = ["world_gen"]),
          breaking: true,
        },
        { name: "math parameter removed", edit: (k) => (k.molang.math[0].maxArgs = 2), breaking: true },
        { name: "math parameter made optional", edit: (k) => (k.molang.math[0].minArgs = 2), breaking: false },
        {
          name: "query since raised",
          edit: (k) => (k.molang.queries[0].availability[0].firstVersion = "1.21.0"),
          breaking: true,
        },
        {
          name: "query set dropped",
          edit: (k) => (k.molang.queries[0].availability[0].querySets = ["other"]),
          breaking: true,
        },
        {
          name: "query range extended",
          edit: (k) => (k.molang.queries[1].availability[0].lastVersion = undefined),
          breaking: false,
        },
        { name: "state removed from a block", edit: (k) => (k.vanilla.blocks[0].states = []), breaking: true },
        { name: "state added to a block", edit: (k) => k.vanilla.blocks[0].states.push("facing"), breaking: false },
        { name: "state type changed", edit: (k) => (k.vanilla.blockStates[0].type = "int"), breaking: true },
        {
          name: 'state value changed from 1 to "1"',
          before: (k) => (k.vanilla.blockStates[0].values = [1]),
          edit: (k) => (k.vanilla.blockStates[0].values = ["1"]),
          breaking: true,
        },
      ];
      for (const c of cases) {
        const before = buildFixture();
        const after = buildFixture();
        c.before?.(before);
        c.before?.(after);
        c.edit(after);
        const diff = diffBedrockKnowledge(before, after);
        expect(knowledgeDiffHasChanges(diff), c.name).to.equal(true);
        expect(getPotentiallyBreakingChanges(diff).length > 0, c.name).to.equal(c.breaking);
      }
    });
  });

  describe("metadata reader", () => {
    it("reads every file from the commit the ref resolved to", async () => {
      const urls: string[] = [];
      const fetchJson = async (url: string) => {
        urls.push(url);
        return url.includes("/commits/") ? { sha: "abc123" } : { latest: { version: "1.0" } };
      };
      const reader = createGitHubMetadataReader("o/r", "main", fetchJson);
      await reader.version();
      await reader.readJson("a.json");
      expect(urls.filter((u) => u.includes("/commits/"))).to.have.length(1);
      expect(urls.filter((u) => u.includes("raw.githubusercontent")).every((u) => u.includes("/abc123/"))).to.equal(
        true
      );
      expect(reader.describe().revision).to.equal("abc123");

      const pinned = createGitHubMetadataReader("o/r", "main", fetchJson, { revision: "def456" });
      await pinned.readJson("a.json");
      expect(urls[urls.length - 1]).to.contain("/def456/metadata/a.json");
      expect(urls.filter((u) => u.includes("/commits/"))).to.have.length(1);

      // An unresolvable ref fails before any content is read, unless the caller opts in.
      const rateLimited = (allowUnpinned: boolean) =>
        createGitHubMetadataReader(
          "o/r",
          "main",
          async (url: string) => {
            if (url.includes("/commits/")) throw new Error("rate limited");
            urls.push(url);
            return {};
          },
          { allowUnpinned }
        );
      const count = urls.length;
      let failed = false;
      await rateLimited(false)
        .version()
        .catch(() => (failed = true));
      expect(failed).to.equal(true);
      expect(urls.length).to.equal(count);
      const unpinned = rateLimited(true);
      await unpinned.readJson("a.json");
      expect(urls[urls.length - 1]).to.contain("/main/metadata/a.json");
      expect(unpinned.describe().revision).to.equal(undefined);
    });
  });

  describe("accuracy gate", () => {
    const at = (file: string, line: number, code = "INVALID_ARGUMENT", startColumn = 1) => ({
      code,
      file,
      line,
      startColumn,
      endColumn: startColumn + 1,
      text: "x",
    });

    it("fails on a replaced occurrence even when per-code counts are equal", () => {
      const before = [at("a.mcfunction", 1), at("b.mcfunction", 2)];
      const gated = ["INVALID_ARGUMENT", "MISSING_ARGUMENTS"];
      expect(findNewDiagnosticOccurrences(before, [at("a.mcfunction", 1)], gated)).to.deep.equal([]);
      expect(findNewDiagnosticOccurrences(before, [at("a.mcfunction", 1), at("c.mcfunction", 3)], gated)).to.deep.equal(
        [at("c.mcfunction", 3)]
      );
      expect(
        findNewDiagnosticOccurrences(before, [...before, at("b.mcfunction", 2, "MISSING_ARGUMENTS")], gated)
      ).to.have.length(1);
      const moved = at("a.mcfunction", 1, "INVALID_ARGUMENT", 9);
      expect(findNewDiagnosticOccurrences([at("a.mcfunction", 1)], [moved], gated)).to.deep.equal([moved]);
    });
  });

  describe("runtime accessors (bundled retail data)", () => {
    it("loads a retail snapshot generated from engine metadata", () => {
      const k = getBedrockKnowledge("retail");
      expect(k.formatVersion).to.equal(BEDROCK_KNOWLEDGE_FORMAT_VERSION);
      expect(k.channel).to.equal("retail");
      expect(k.commands.length).to.be.greaterThan(60);
      expect(k.molang.queries.length).to.be.greaterThan(250);
      expect(k.vanilla.blocks.length).to.be.greaterThan(1000);
    });

    it("finds commands by name, alias, and slash-prefixed name", () => {
      expect(findCommand("teleport")?.name).to.equal("teleport");
      expect(findCommand("tp")?.name).to.equal("teleport");
      expect(findCommand("/TP")?.name).to.equal("teleport");
      expect(findCommand("worldborder")).to.equal(undefined);
    });

    it("normalizes Molang short forms", () => {
      expect(normalizeMolangName("q.is_baby")).to.equal("query.is_baby");
      expect(normalizeMolangName("V.Foo")).to.equal("variable.foo");
      expect(findMolangQuery("Q.IS_BABY")?.name).to.equal("query.is_baby");
      expect(findMolangMath("math.ease_in_sine")?.minArgs).to.equal(3);
    });

    it("expands command enum values", () => {
      expect(isCommandEnumValue("GameMode", "creative")).to.equal(true);
      expect(isCommandEnumValue("Block", "stone")).to.equal(true);
      expect(isCommandEnumValue("Block", "minecraft:stone")).to.equal(true);
      expect(getCommandEnumValues("NoSuchEnum")).to.deep.equal([]);
      // Expanded once per snapshot, not on every lookup.
      expect(getCommandEnumValues("Block")).to.equal(getCommandEnumValues("Block"));
    });

    it("recognizes vanilla identifiers with or without namespace", () => {
      expect(isVanillaIdentifier("entities", "minecraft:pig")).to.equal(true);
      expect(isVanillaIdentifier("entities", "pig")).to.equal(true);
      expect(isVanillaIdentifier("entities", "myaddon:pig")).to.equal(false);
      expect(isVanillaIdentifier("blocks", "minecraft:stone")).to.equal(true);
      expect(isVanillaIdentifier("potionTypes", "Consume")).to.equal(true);
    });

    it("compares Bedrock versions numerically", () => {
      expect(compareBedrockVersions("1.21.100", "1.21.90")).to.equal(1);
      expect(compareBedrockVersions("1.21", "1.21.0.0")).to.equal(0);
      expect(compareBedrockVersions("1.20.80", "1.21.0")).to.equal(-1);
    });

    it("evaluates Molang query availability by version", () => {
      const old = buildFixture().molang.queries.find((q) => q.name === "query.old_thing")!;
      expect(isMolangQueryAvailable(old)).to.equal(true);
      expect(isMolangQueryAvailable(old, "1.19.0")).to.equal(true);
      expect(isMolangQueryAvailable(old, "1.21.0")).to.equal(false);
      expect(isMolangQueryAvailable(old, "0.9.0")).to.equal(false);
    });

    it("formats Molang signatures from arity", () => {
      expect(formatMolangSignature({ name: "math.pi", description: "", minArgs: 0, maxArgs: 0 })).to.equal("math.pi");
      expect(formatMolangSignature({ name: "q.x", description: "", minArgs: 1, maxArgs: 2 })).to.equal(
        "q.x(arg1, [arg2])"
      );
      expect(formatMolangSignature({ name: "q.any", description: "", minArgs: 1 })).to.equal("q.any(arg1, ...)");
    });
  });

  describe("channel switching", () => {
    // Snapshots are module state shared by every suite in the mocha process, so restore Preview to
    // whatever it was before each test.
    let previewBefore: IBedrockKnowledge | undefined;
    beforeEach(() => {
      previewBefore = isBedrockChannelAvailable("preview") ? getBedrockKnowledge("preview") : undefined;
    });
    afterEach(() => {
      setActiveBedrockChannel("retail");
      if (previewBefore) {
        registerBedrockKnowledge(previewBefore);
      } else {
        unregisterBedrockKnowledge("preview");
      }
    });

    it("refuses to switch to an unregistered channel", () => {
      unregisterBedrockKnowledge("preview");
      expect(setActiveBedrockChannel("preview")).to.equal(false);
      expect(getActiveBedrockChannel()).to.equal("retail");
    });

    it("refreshes langcore tables in place when the active channel changes", () => {
      const commandsRef = MINECRAFT_COMMANDS;
      const entitiesRef = VANILLA_ENTITIES;
      const retailCommandCount = MINECRAFT_COMMANDS.length;
      let notified = 0;
      const dispose = onDidChangeBedrockKnowledge(() => notified++);

      registerBedrockKnowledge(buildFixture(), { activate: true });

      expect(getActiveBedrockChannel()).to.equal("preview");
      expect(notified).to.equal(1);
      expect(MINECRAFT_COMMANDS).to.equal(commandsRef);
      expect(VANILLA_ENTITIES).to.equal(entitiesRef);
      expect(VANILLA_ENTITIES).to.deep.equal(["minecraft:cow", "minecraft:pig"]);
      expect(MINECRAFT_COMMANDS.map((c) => c.name)).to.deep.equal(["gamemode", "teleport", "tp"]);

      expect(setActiveBedrockChannel("retail")).to.equal(true);
      expect(notified).to.equal(2);
      expect(MINECRAFT_COMMANDS.length).to.equal(retailCommandCount);
      dispose();
    });

    it("rebuilds lookups when the same snapshot object is registered again", () => {
      const knowledge = buildFixture();
      registerBedrockKnowledge(knowledge, { activate: true });
      expect(findCommand("gamemode")).to.not.equal(undefined);
      expect(isVanillaIdentifier("entities", "minecraft:cow")).to.equal(true);

      knowledge.commands = knowledge.commands.filter((c) => c.name !== "gamemode");
      knowledge.vanilla.entities = ["minecraft:sheep"];
      registerBedrockKnowledge(knowledge);

      expect(findCommand("gamemode")).to.equal(undefined);
      expect(MINECRAFT_COMMANDS.some((c) => c.name === "gamemode")).to.equal(false);
      expect(isVanillaIdentifier("entities", "minecraft:cow")).to.equal(false);
      expect(VANILLA_ENTITIES).to.deep.equal(["minecraft:sheep"]);
    });

    it("keeps dynamic enums open when a snapshot lists observed values", () => {
      const knowledge: IBedrockKnowledge = JSON.parse(JSON.stringify(getBedrockKnowledge("retail")));
      knowledge.channel = "preview";
      knowledge.commandEnums["TagValues"].values = ["existing"];
      knowledge.commandEnums["ScoreboardObjectives"].values = ["kills"];
      const codes = (line: string) => commandDiagnosticGenerator.analyzeLine(line, 1).map((d) => d.code);
      for (const register of [
        () => registerBedrockKnowledge(knowledge, { activate: true }),
        () => registerBedrockKnowledge(knowledge),
      ]) {
        register();
        expect(codes("tag @s add fresh")).to.deep.equal([]);
        expect(codes("scoreboard objectives add deaths dummy")).to.deep.equal([]);
      }
    });

    it("rejects an incompatible snapshot without changing any state", () => {
      const before = {
        preview: isBedrockChannelAvailable("preview") ? getBedrockKnowledge("preview") : undefined,
        commands: [...MINECRAFT_COMMANDS],
        queries: [...MOLANG_QUERIES],
        entities: [...VANILLA_ENTITIES],
      };
      let notified = 0;
      const dispose = onDidChangeBedrockKnowledge(() => notified++);
      const wrongVersion = { ...buildFixture(), formatVersion: BEDROCK_KNOWLEDGE_FORMAT_VERSION + 1 };
      const truncated = { ...buildFixture(), vanilla: { entities: [] } } as unknown as IBedrockKnowledge;
      const nullCommand = { ...buildFixture(), commands: [null] } as unknown as IBedrockKnowledge;
      const badQuery = buildFixture();
      badQuery.molang = { ...badQuery.molang, queries: [{ name: "query.x" } as never] };

      for (const snapshot of [wrongVersion, truncated, nullCommand, badQuery]) {
        expect(() => registerBedrockKnowledge(snapshot, { activate: true })).to.throw(/Can't load Bedrock knowledge/);
      }

      expect(getActiveBedrockChannel()).to.equal("retail");
      expect(isBedrockChannelAvailable("preview") ? getBedrockKnowledge("preview") : undefined).to.equal(
        before.preview
      );
      expect(notified).to.equal(0);
      expect(MINECRAFT_COMMANDS).to.deep.equal(before.commands);
      expect(MOLANG_QUERIES).to.deep.equal(before.queries);
      expect(VANILLA_ENTITIES).to.deep.equal(before.entities);
      dispose();
    });
  });

  it("refuses to write an updated snapshot with a malformed entry", () => {
    const malformed = buildFixture();
    malformed.vanilla.blocks = [{ states: [] } as never];
    expect(getKnowledgeUpdateProblems(malformed)).to.deep.equal([
      "The built snapshot is invalid: the snapshot is missing or has an invalid vanilla section.",
    ]);
    expect(getKnowledgeUpdateProblems(buildFixture()).some((p) => p.includes("invalid"))).to.equal(false);
  });
});

describe("Langcore engine accuracy", () => {
  describe("command table", () => {
    it("is derived from engine data and includes aliases", () => {
      const names = MINECRAFT_COMMANDS.map((c) => c.name);
      expect(names).to.include("teleport");
      expect(names).to.include("tp");
      expect(names).to.include("camera");
      expect(names).to.not.include("worldborder");
    });

    it("keeps curated examples and reports every engine overload", () => {
      const give = commandParser.getCommandInfo("give")!;
      expect(give.examples).to.deep.equal(["give @s diamond 64"]);
      expect(give.syntax.startsWith("give <player: SELECTION> <itemName: Item>")).to.equal(true);
      const tp = commandParser.getCommandInfo("tp")!;
      expect(tp.aliasOf).to.equal("teleport");
      expect(tp.usages!.length).to.be.greaterThan(1);
      expect(tp.usages!.every((u) => u.startsWith("tp"))).to.equal(true);
    });

    it("supports the @n selector", () => {
      expect(commandParser.parseSelector("@n[type=cow]", 0).type).to.equal("n");
    });

    it("closes a quoted string after an escaped backslash", () => {
      const args = commandParser
        .parseLine('execute if entity @e[name="dir\\\\"] run say ok', 0)
        .arguments.map((arg) => arg.value);
      expect(args).to.deep.equal(["if", "entity", '@e[name="dir\\\\"]', "run", "say", "ok"]);
    });
  });

  describe("command diagnostics", () => {
    const codes = (line: string) => commandDiagnosticGenerator.analyzeLine(line, 1).map((d) => d.code);

    it("accepts valid vanilla and add-on commands", () => {
      const valid = [
        "gamemode creative @a",
        "gamemode 1",
        "tp @s 0 64 0",
        "tp @s ~ ~1 ~",
        "tp ~~1~",
        "tp @a @p",
        "give @s diamond 64",
        "give @s myaddon:custom_sword",
        "setblock ~ ~1 ~ stone",
        "setblock 0 64 0 myaddon:custom_block",
        'say Hello "world" and more',
        "time set day",
        "tag @s add vip",
        "scoreboard objectives add kills dummy",
        "execute as @a at @s run say hi",
        "/kill @e[type=zombie, r=10]",
      ];
      for (const line of valid) {
        expect(codes(line), line).to.deep.equal([]);
      }
    });

    it("reports unknown commands that are not in the engine", () => {
      expect(codes("worldborder set 10")).to.include("UNKNOWN_COMMAND");
    });

    it("reports missing required arguments", () => {
      expect(codes("give @s")).to.include("MISSING_ARGUMENTS");
      expect(codes("setblock 0 64 0")).to.include("MISSING_ARGUMENTS");
      expect(codes("gamemode")).to.include("MISSING_ARGUMENTS");
    });

    it("reports values outside closed enums at the right column", () => {
      const diags = commandDiagnosticGenerator.analyzeLine("  /time sett day", 1);
      const invalid = diags.find((d) => d.code === "INVALID_ARGUMENT")!;
      expect(invalid).to.not.equal(undefined);
      expect(invalid.message).to.contain('"sett"');
      expect(invalid.startColumn).to.equal(9);
      expect(invalid.endColumn).to.equal(13);

      expect(codes("gamemode flying")).to.include("INVALID_ARGUMENT");
    });

    it("validates the command after execute ... run with original columns", () => {
      const diags = commandDiagnosticGenerator.analyzeLine("execute as @a run tme set day", 1);
      const unknown = diags.find((d) => d.code === "UNKNOWN_COMMAND");
      expect(unknown, JSON.stringify(diags)).to.not.equal(undefined);
      expect(unknown!.startColumn).to.equal(19);
      expect(codes("execute as @a at @s run execute as @e[type=cow] run say hi")).to.deep.equal([]);
      const sel = commandDiagnosticGenerator
        .analyzeLine("  /execute as @a run kill @e[r=1,rm=5]", 1)
        .filter((d) => d.code === "SELECTOR_RADIUS_CONFLICT");
      expect(sel.length).to.equal(1);
      expect(sel[0].startColumn).to.equal(27);
    });

    it("validates execute syntax against the pack min_engine_version", () => {
      const at = (line: string, minEngineVersion: string) =>
        commandDiagnosticGenerator.analyzeLine(line, 1, { minEngineVersion }).map((d) => d.code);
      expect(at("execute @a ~ ~ ~ say hi", "1.16.0")).to.deep.equal([]);
      expect(at("execute @a ~ ~ ~ say hi", "1.20.0")).to.deep.equal(["LEGACY_EXECUTE_SYNTAX"]);
      expect(at("execute as @a run say hi", "1.16.0")).to.deep.equal(["EXECUTE_REQUIRES_NEWER_ENGINE"]);
      expect(at("execute as @a run say hi", "1.19.50")).to.deep.equal([]);
      // Legacy syntax is recognized by its shape, not by an unknown first token.
      for (const version of ["1.16.0", "1.20.0", ""]) {
        expect(at("execute ass @a run say hi", version), version).to.deep.equal(["INVALID_ARGUMENT"]);
      }
      // A target named like a subcommand is legacy in an old pack and modern otherwise.
      expect(at("execute as ~ ~ ~ say hi", "1.16.0")).to.deep.equal([]);
      expect(at("execute at ~ ~ ~ tme", "1.16.0")).to.deep.equal(["UNKNOWN_COMMAND"]);
      expect(at("execute as @a run say hi", "1.20.0")).to.deep.equal([]);
      expect(at("execute positioned ~ ~ ~ run say hi", "1.16.0")).to.deep.equal(["EXECUTE_REQUIRES_NEWER_ENGINE"]);
      // The modern "run" overload takes any text, so a player named "run" is still read as legacy.
      expect(at("execute run ~ ~ ~ say hi", "1.16.0")).to.deep.equal([]);
      expect(at("execute run ~~~ say hi", "1.16.0")).to.deep.equal([]);
      const runTarget = commandDiagnosticGenerator.analyzeLine("execute run ~ ~ ~ tme", 1, {
        minEngineVersion: "1.16.0",
      });
      expect(runTarget.map((d) => [d.code, d.startColumn])).to.deep.equal([["UNKNOWN_COMMAND", 19]]);
      // A malformed modern command that the matcher rejects without a reportable problem gets no version hint.
      expect(at("execute positioned ~ x", "1.16.0")).to.not.include("EXECUTE_REQUIRES_NEWER_ENGINE");
      expect(at("execute @a ~ ~ say hi", "1.16.0")).to.include("INVALID_ARGUMENT");
      expect(at("execute @a ~~1~ say hi", "1.16.0")).to.deep.equal([]);
      expect(at("execute @a 1-2-3 say hi", "1.16.0")).to.not.include("LEGACY_EXECUTE_SYNTAX");
      for (const [line, expected] of [
        ["tp ~~1~", []],
        ["tp ^^^", []],
        ["setworldspawn 1-2-3", ["INVALID_ARGUMENT"]],
        ["setworldspawn ^1 ~2 ~3", ["INVALID_ARGUMENT"]],
      ] as [string, string[]][]) {
        expect(at(line, "1.20.0"), line).to.deep.equal(expected);
      }
      expect(at("execute @a ~~1~ say hi", "1.20.0")).to.deep.equal(["LEGACY_EXECUTE_SYNTAX"]);
      expect(at("execute @a ~ ~ ~ detect ~ ~-1 ~ stone 0 say hi", "1.16.0")).to.deep.equal([]);
      const nested = commandDiagnosticGenerator.analyzeLine("execute @a ~ ~ ~ tme set day", 1, {
        minEngineVersion: "1.16.0",
      });
      expect(nested.map((d) => [d.code, d.startColumn])).to.deep.equal([["UNKNOWN_COMMAND", 18]]);
    });

    it("handles real-world patterns found in community packs without false positives", () => {
      expect(codes("event entity @e[tag=raid] my_custom_event")).to.deep.equal([]);
      expect(codes("scriptevent myaddon:start")).to.deep.equal([]);
      expect(codes("tp @a[tag=t2]-500 200 -500")).to.deep.equal([]);
      // Brackets and escaped quotes inside quoted selector values don't end the selector.
      expect(codes('execute as @e[name="a]b"] run say hi')).to.deep.equal([]);
      expect(codes('execute as @e[name="a\\"]b"] run say hi')).to.deep.equal([]);
      expect(codes('execute as @e[name="a]b"] run tme')).to.deep.equal(["UNKNOWN_COMMAND"]);
      expect(codes("execute if entity @s[tag=x]")).to.deep.equal([]);
      expect(codes("execute @a ~ ~ ~ say legacy")).to.deep.equal(["LEGACY_EXECUTE_SYNTAX"]);
      expect(codes("playsound")).to.include("MISSING_ARGUMENTS");
      expect(["say", "me", "tell @s"].map((line) => codes(line))).to.deep.equal([
        ["MISSING_ARGUMENTS"],
        ["MISSING_ARGUMENTS"],
        ["MISSING_ARGUMENTS"],
      ]);
    });

    it("does not flag soft enums such as tags and objectives", () => {
      const tag = findCommand("tag")!;
      expect(matchCommandOverloads(tag, ["@s", "add", "anything_goes"]).matched).to.equal(true);
    });

    it("skips optional parameters that come before later ones", () => {
      const command: IKnowledgeCommand = {
        name: "demo",
        description: "",
        aliases: [],
        permissionLevel: 0,
        requiresCheats: false,
        overloads: [
          {
            params: [
              { name: "pos", type: "POSITION", optional: true },
              { name: "count", type: "INT", optional: true },
              { name: "mode", type: "GAMEMODE", enumName: "GameMode", optional: false },
            ],
          },
        ],
      };
      const cases: [string[], boolean][] = [
        [["creative"], true],
        [["5", "creative"], true],
        [["1", "2", "3", "5", "creative"], true],
        [["creative", "5"], false],
        [[], false],
      ];
      for (const [tokens, matched] of cases) {
        expect(matchCommandOverloads(command, tokens).matched, tokens.join(" ")).to.equal(matched);
      }
      expect(matchCommandOverloads(command, []).problem?.kind).to.equal("missing");
      expect(codes("gamemode creative")).to.deep.equal([]);

      expect(codes("summon zombie facing @p")).to.deep.equal([]);
      expect(codes("summon zombie ~ ~1 ~ facing @p")).to.deep.equal([]);
      const summon = findCommand("summon")!;
      const next = getNextParameterCandidates(summon, ["zombie"]).params.map((p) => p.name);
      expect(next).to.include.members(["spawnPos", "facing"]);
      const facingOverload = summon.overloads.find((o) => o.params.some((p) => p.name === "lookAtEntity"))!;
      expect(getOverloadProgress(facingOverload.params, ["zombie", "facing"]).activeParameter).to.equal(3);
    });

    it("splits execute at the parsed run delimiter, not at arguments named run", () => {
      const valid = [
        "execute if score run run matches 1 run say hi",
        'execute if score "run" kills matches 1 run say hi',
        "execute as run if entity @s[tag=run] run say hi",
      ];
      for (const line of valid) {
        expect(codes(line), line).to.deep.equal([]);
      }
      const unknown = commandDiagnosticGenerator
        .analyzeLine("execute as run run tme", 1)
        .filter((d) => d.code === "UNKNOWN_COMMAND");
      expect(unknown.map((d) => d.startColumn)).to.deep.equal([20]);
    });

    it("validates every subcommand in an execute chain", () => {
      expect(codes("execute as @a att @s run say hi")).to.deep.equal(["INVALID_ARGUMENT"]);
      expect(codes("execute as @a at @s positioned ~ ~1 ~ run say hi")).to.deep.equal([]);
      expect(codes("execute as @a if entity @s[tag=x]")).to.deep.equal([]);
      expect(() => codes("execute run ".repeat(5000) + "say hi")).to.not.throw();
    });
  });

  describe("Molang", () => {
    it("reports queries that are unavailable for the pack min_engine_version", () => {
      const at = (expr: string, minEngineVersion?: string) =>
        molangDiagnosticGenerator.analyze(expr, 1, 0, { minEngineVersion }).map((d) => d.code);
      expect(at("query.block_property('x')", "1.16.0")).to.not.include("MOLANG_QUERY_UNAVAILABLE");
      expect(at("query.block_property('x')", "1.21.0")).to.include("MOLANG_QUERY_UNAVAILABLE");
      expect(at("query.block_property('x')")).to.not.include("MOLANG_QUERY_UNAVAILABLE");
    });

    it("limits queries to their query set", () => {
      const at = (expr: string, querySet?: string) =>
        molangDiagnosticGenerator.analyze(expr, 1, 0, { querySet }).map((d) => d.code);
      expect(at("query.noise(1, 2)")).to.deep.equal(["MOLANG_QUERY_UNAVAILABLE"]);
      expect(at("query.noise(1, 2)", "world_gen")).to.deep.equal([]);
      expect(at("query.all_tags('a')", "world_gen")).to.deep.equal(["MOLANG_QUERY_UNAVAILABLE"]);
      expect(at("query.all_tags('a')", "tags")).to.deep.equal([]);
      expect(at("query.is_baby")).to.deep.equal([]);
      const [defaultOnly] = molangDiagnosticGenerator.analyze("query.is_baby", 1, 0, { querySet: "world_gen" });
      expect(defaultOnly?.message).to.contain("only available in default expressions");
      const repeated = molangDiagnosticGenerator.analyze("query.noise(1, 2) + query.noise(3, 4)", 1, 0);
      expect(repeated.map((d) => d.startColumn)).to.deep.equal([1, 21]);

      const labels = (querySet?: string) =>
        molangCompletionGenerator
          .generateCompletions({
            expression: "q",
            cursorOffset: 1,
            prefix: "q",
            inFunction: false,
            functionName: null,
            querySet,
          })
          .map((c) => c.label);
      expect(labels()).to.include("query.is_baby").and.not.include("query.noise");
      expect(labels("world_gen")).to.include("query.noise");
    });

    it("derives queries and math from engine data", () => {
      expect(MOLANG_QUERIES.length).to.be.greaterThan(250);
      expect(MOLANG_QUERIES.some((q) => q.name === "query.color")).to.equal(false);
      expect(MOLANG_MATH.some((m) => m.name === "math.ease_in_out_back")).to.equal(true);
    });

    it("uses curated parameter names when they match the engine arity", () => {
      expect(MOLANG_MATH.find((m) => m.name === "math.clamp")!.syntax).to.equal("math.clamp(value, min, max)");
      expect(MOLANG_MATH.find((m) => m.name === "math.ease_in_sine")!.syntax).to.equal(
        "math.ease_in_sine(start, end, t)"
      );
      expect(MOLANG_MATH.find((m) => m.name === "math.pi")!.syntax).to.equal("math.pi");
    });

    const codes = (expr: string) => molangDiagnosticGenerator.analyze(expr).map((d) => d.code);

    it("accepts valid engine queries and math functions", () => {
      expect(codes("q.is_baby ? math.ease_in_sine(0, 1, q.anim_time) : math.sign(-1)")).to.deep.equal([]);
      expect(codes("query.is_baby && v.foo")).to.deep.equal([]);
    });

    it("matches query names exactly instead of by prefix", () => {
      expect(codes("query.is_baby_extra")).to.include("MOLANG_UNKNOWN_QUERY");
      expect(codes("math.sinx(1)")).to.include("MOLANG_UNKNOWN_MATH");
    });

    it("checks argument counts against engine signatures", () => {
      expect(codes("math.clamp(1, 2)")).to.include("MOLANG_ARGUMENT_COUNT");
      expect(codes("math.clamp(1, math.max(2, 3), 4)")).to.not.include("MOLANG_ARGUMENT_COUNT");
      expect(codes("math.abs(1, 2)")).to.include("MOLANG_ARGUMENT_COUNT");
      expect(codes("query.anger_level(this) >= 40")).to.not.include("MOLANG_ARGUMENT_COUNT");
    });

    it("flags division by a literal zero only", () => {
      expect(codes("q.is_baby ? (1 / 0.6) : 1.0")).to.not.include("MOLANG_DIVISION_BY_ZERO");
      expect(codes("v.x / 0.0")).to.include("MOLANG_DIVISION_BY_ZERO");
    });

    it("flags '=' in a ternary condition but not a variable assignment", () => {
      const comparisons = (expr: string) => codes(expr).filter((c) => c === "MOLANG_POSSIBLE_COMPARISON").length;
      expect(comparisons("v.timer = q.life_time < 0.1 ? 1 : v.timer;")).to.equal(0);
      expect(comparisons("v.init = v.init ?? 0; v.u = v.init ? v.u : 1; v.init = 1;")).to.equal(0);
      expect(comparisons("q.is_baby = 1 ? 2 : 3")).to.equal(1);
      expect(comparisons("v.size = q.is_baby = 1 ? 2 : 3;")).to.equal(1);
    });
  });

  describe("vanilla lists", () => {
    it("come from engine data", () => {
      expect(VANILLA_ENTITIES).to.include("minecraft:pig");
      expect(VANILLA_ENTITIES.length).to.be.greaterThan(100);
      expect(VANILLA_ITEMS).to.include("minecraft:diamond");
      expect(VANILLA_BLOCKS).to.include("minecraft:stone");
    });
  });
});

describe("Bedrock reference lookup", () => {
  const knowledge = getBedrockKnowledge("retail");

  it("describes commands with syntax and the source version", () => {
    const result = lookupBedrockReference(knowledge, "/camera");
    expect(result.found).to.equal(true);
    expect(result.markdown).to.contain("### /camera");
    expect(result.markdown).to.contain(knowledge.gameVersion);
  });

  it("describes Molang queries from short names and blocks with their states", () => {
    expect(lookupBedrockReference(knowledge, "q.is_sneaking").markdown).to.contain("query.is_sneaking");
    const block = lookupBedrockReference(knowledge, "oak_log", "block");
    expect(block.found).to.equal(true);
    expect(block.markdown).to.contain("pillar_axis");
  });

  it("reports names that don't exist, with similar suggestions", () => {
    const result = lookupBedrockReference(knowledge, "q.is_sneakin", "molang");
    expect(result.found).to.equal(false);
    expect(result.markdown).to.contain("doesn't match");
    expect(result.markdown).to.contain("query.is_sneaking");
    expect(lookupBedrockReference(knowledge, "execute", "block").found).to.equal(false);
  });
});
