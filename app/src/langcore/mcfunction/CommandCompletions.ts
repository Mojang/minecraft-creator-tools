// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * CommandCompletions - Completions for mcfunction commands
 *
 * Provides completion items for Minecraft commands and selectors.
 */

import { CompletionItemKind, ICompletionItem } from "../json/JsonCompletionItems";
import { MINECRAFT_COMMANDS, SELECTOR_TYPES, SELECTOR_ARGUMENTS, commandParser } from "./CommandParser";
import { VANILLA_ENTITIES } from "../shared/MinecraftKnowledge";

/**
 * Context for command completions
 */
export interface ICommandCompletionContext {
  /** Line text */
  lineText: string;
  /** Cursor offset in line */
  cursorOffset: number;
  /** Current command (if any) */
  command?: string;
  /** Argument index (0-based) */
  argumentIndex: number;
  /** Whether cursor is in a selector */
  inSelector: boolean;
  /** Selector context (type or arguments) */
  selectorContext?: string;
}

/**
 * Generate command completions
 */
export class CommandCompletionGenerator {
  /**
   * Generate completions for current context
   */
  public generateCompletions(context: ICommandCompletionContext): ICompletionItem[] {
    if (context.inSelector) {
      return this.generateSelectorCompletions(context);
    }

    if (!context.command || context.argumentIndex < 0) {
      return this.generateCommandCompletions(context);
    }

    return this.generateArgumentCompletions(context);
  }

  /**
   * Generate command name completions
   */
  private generateCommandCompletions(context: ICommandCompletionContext): ICompletionItem[] {
    const items: ICompletionItem[] = [];

    for (const cmd of MINECRAFT_COMMANDS) {
      items.push({
        label: cmd.name,
        kind: CompletionItemKind.Keyword,
        detail: cmd.description,
        documentation: `**Syntax:** \`${cmd.syntax}\`\n\n${
          cmd.examples ? "**Examples:**\n" + cmd.examples.map((e) => `- \`${e}\``).join("\n") : ""
        }`,
        insertText: cmd.name,
      });
    }

    return items;
  }

  /**
   * Generate selector completions
   */
  private generateSelectorCompletions(context: ICommandCompletionContext): ICompletionItem[] {
    const items: ICompletionItem[] = [];

    if (context.selectorContext === "type") {
      // Selector type completions (@a, @e, etc.)
      for (const [type, info] of Object.entries(SELECTOR_TYPES)) {
        items.push({
          label: `@${type}`,
          kind: CompletionItemKind.Value,
          detail: info.description,
          documentation: `**Example:** \`${info.example}\``,
          insertText: `@${type}`,
        });
      }
    } else if (context.selectorContext === "arguments") {
      // Selector argument completions
      for (const arg of SELECTOR_ARGUMENTS) {
        items.push({
          label: arg.name,
          kind: CompletionItemKind.Property,
          detail: arg.description,
          documentation: `**Example:** \`${arg.example}\``,
          insertText: `${arg.name}=`,
        });
      }

      // Entity type values for type= argument
      if (context.lineText.includes("type=")) {
        for (const entity of VANILLA_ENTITIES) {
          items.push({
            label: entity,
            kind: CompletionItemKind.Value,
            detail: "Entity type",
            insertText: entity,
          });
        }
      }
    }

    return items;
  }

  /**
   * Generate argument completions based on command
   */
  private generateArgumentCompletions(context: ICommandCompletionContext): ICompletionItem[] {
    const items: ICompletionItem[] = [];
    const cmdInfo = commandParser.getCommandInfo(context.command || "");

    if (!cmdInfo) {
      // Unknown command - provide generic completions
      return this.generateGenericCompletions();
    }

    // Command-specific argument completions
    switch (cmdInfo.name) {
      case "gamemode":
        if (context.argumentIndex === 0) {
          items.push(
            { label: "survival", kind: CompletionItemKind.EnumMember, detail: "Survival mode" },
            { label: "creative", kind: CompletionItemKind.EnumMember, detail: "Creative mode" },
            { label: "adventure", kind: CompletionItemKind.EnumMember, detail: "Adventure mode" },
            { label: "spectator", kind: CompletionItemKind.EnumMember, detail: "Spectator mode" },
            { label: "0", kind: CompletionItemKind.EnumMember, detail: "Survival (numeric)" },
            { label: "1", kind: CompletionItemKind.EnumMember, detail: "Creative (numeric)" },
            { label: "2", kind: CompletionItemKind.EnumMember, detail: "Adventure (numeric)" }
          );
        }
        break;

      case "difficulty":
        items.push(
          { label: "peaceful", kind: CompletionItemKind.EnumMember },
          { label: "easy", kind: CompletionItemKind.EnumMember },
          { label: "normal", kind: CompletionItemKind.EnumMember },
          { label: "hard", kind: CompletionItemKind.EnumMember }
        );
        break;

      case "time":
        if (context.argumentIndex === 0) {
          items.push(
            { label: "set", kind: CompletionItemKind.Keyword },
            { label: "add", kind: CompletionItemKind.Keyword },
            { label: "query", kind: CompletionItemKind.Keyword }
          );
        } else if (context.argumentIndex === 1) {
          items.push(
            { label: "day", kind: CompletionItemKind.Value, detail: "1000" },
            { label: "noon", kind: CompletionItemKind.Value, detail: "6000" },
            { label: "night", kind: CompletionItemKind.Value, detail: "13000" },
            { label: "midnight", kind: CompletionItemKind.Value, detail: "18000" },
            { label: "sunrise", kind: CompletionItemKind.Value, detail: "23000" },
            { label: "sunset", kind: CompletionItemKind.Value, detail: "12000" }
          );
        }
        break;

      case "weather":
        items.push(
          { label: "clear", kind: CompletionItemKind.EnumMember },
          { label: "rain", kind: CompletionItemKind.EnumMember },
          { label: "thunder", kind: CompletionItemKind.EnumMember }
        );
        break;

      case "effect":
        if (context.argumentIndex === 1) {
          items.push(...this.getEffectCompletions());
        }
        break;

      case "summon":
        if (context.argumentIndex === 0) {
          items.push(...this.getEntityCompletions());
        }
        break;

      case "give":
      case "clear":
        if (context.argumentIndex === 1) {
          items.push(...this.getItemCompletions());
        }
        break;

      case "setblock":
      case "fill":
        // Block argument
        items.push(...this.getBlockCompletions());
        break;

      case "execute":
        items.push(...this.getExecuteSubcommands(context.argumentIndex));
        break;

      case "scoreboard":
        if (context.argumentIndex === 0) {
          items.push(
            { label: "objectives", kind: CompletionItemKind.Keyword },
            { label: "players", kind: CompletionItemKind.Keyword }
          );
        }
        break;

      case "gamerule":
        if (context.argumentIndex === 0) {
          items.push(...this.getGameRuleCompletions());
        } else if (context.argumentIndex === 1) {
          items.push(
            { label: "true", kind: CompletionItemKind.Keyword },
            { label: "false", kind: CompletionItemKind.Keyword }
          );
        }
        break;

      default:
        items.push(...this.generateGenericCompletions());
    }

    // Always add selector completions as an option
    if (items.length === 0 || !items.some((i) => i.label.startsWith("@"))) {
      items.push(...this.getSelectorStarters());
    }

    return items;
  }

  /**
   * Generate generic completions (selectors, positions)
   */
  private generateGenericCompletions(): ICompletionItem[] {
    return [
      ...this.getSelectorStarters(),
      { label: "~ ~ ~", kind: CompletionItemKind.Value, detail: "Relative position", insertText: "~ ~ ~" },
      { label: "^ ^ ^", kind: CompletionItemKind.Value, detail: "Local position", insertText: "^ ^ ^" },
    ];
  }

  /**
   * Get selector starter completions
   */
  private getSelectorStarters(): ICompletionItem[] {
    return [
      { label: "@a", kind: CompletionItemKind.Value, detail: "All players" },
      { label: "@e", kind: CompletionItemKind.Value, detail: "All entities" },
      { label: "@p", kind: CompletionItemKind.Value, detail: "Nearest player" },
      { label: "@r", kind: CompletionItemKind.Value, detail: "Random player" },
      { label: "@s", kind: CompletionItemKind.Value, detail: "Executing entity" },
    ];
  }

  /**
   * Get effect completions
   */
  private getEffectCompletions(): ICompletionItem[] {
    const effects = [
      "speed",
      "slowness",
      "haste",
      "mining_fatigue",
      "strength",
      "instant_health",
      "instant_damage",
      "jump_boost",
      "nausea",
      "regeneration",
      "resistance",
      "fire_resistance",
      "water_breathing",
      "invisibility",
      "blindness",
      "night_vision",
      "hunger",
      "weakness",
      "poison",
      "wither",
      "health_boost",
      "absorption",
      "saturation",
      "levitation",
      "fatal_poison",
      "slow_falling",
      "conduit_power",
      "bad_omen",
      "hero_of_the_village",
      "darkness",
      "trial_omen",
      "wind_charged",
      "weaving",
      "oozing",
      "infested",
    ];

    return effects.map((effect) => ({
      label: effect,
      kind: CompletionItemKind.EnumMember,
      detail: "Status effect",
    }));
  }

  /**
   * Get entity completions
   */
  private getEntityCompletions(): ICompletionItem[] {
    return VANILLA_ENTITIES.map((entity) => ({
      label: entity,
      kind: CompletionItemKind.Value,
      detail: "Entity type",
      insertText: entity,
    }));
  }

  /**
   * Get item completions (subset of common items)
   */
  private getItemCompletions(): ICompletionItem[] {
    const items = [
      "diamond",
      "iron_ingot",
      "gold_ingot",
      "emerald",
      "netherite_ingot",
      "diamond_sword",
      "diamond_pickaxe",
      "diamond_axe",
      "diamond_shovel",
      "diamond_hoe",
      "netherite_sword",
      "netherite_pickaxe",
      "bow",
      "arrow",
      "crossbow",
      "apple",
      "golden_apple",
      "enchanted_golden_apple",
      "bread",
      "cooked_beef",
      "diamond_helmet",
      "diamond_chestplate",
      "diamond_leggings",
      "diamond_boots",
      "torch",
      "crafting_table",
      "furnace",
      "chest",
      "ender_chest",
      "ender_pearl",
      "eye_of_ender",
      "firework_rocket",
      "elytra",
      "totem_of_undying",
    ];

    return items.map((item) => ({
      label: item,
      kind: CompletionItemKind.Value,
      detail: "Item",
    }));
  }

  /**
   * Get block completions (subset of common blocks)
   */
  private getBlockCompletions(): ICompletionItem[] {
    const blocks = [
      "stone",
      "cobblestone",
      "granite",
      "diorite",
      "andesite",
      "deepslate",
      "dirt",
      "grass_block",
      "podzol",
      "mycelium",
      "sand",
      "gravel",
      "oak_log",
      "spruce_log",
      "birch_log",
      "oak_planks",
      "spruce_planks",
      "glass",
      "glass_pane",
      "tinted_glass",
      "iron_block",
      "gold_block",
      "diamond_block",
      "obsidian",
      "crying_obsidian",
      "bedrock",
      "water",
      "lava",
      "air",
      "torch",
      "lantern",
      "sea_lantern",
      "glowstone",
      "redstone_lamp",
      "chest",
      "barrel",
      "crafting_table",
      "furnace",
      "blast_furnace",
    ];

    return blocks.map((block) => ({
      label: block,
      kind: CompletionItemKind.Value,
      detail: "Block",
    }));
  }

  /**
   * Get execute subcommand completions
   */
  private getExecuteSubcommands(argIndex: number): ICompletionItem[] {
    const subcommands = [
      { name: "as", desc: "Change executing entity" },
      { name: "at", desc: "Change execution position/rotation" },
      { name: "positioned", desc: "Set execution position" },
      { name: "rotated", desc: "Set execution rotation" },
      { name: "facing", desc: "Set facing direction" },
      { name: "align", desc: "Align to block grid" },
      { name: "anchored", desc: "Set anchor point (eyes/feet)" },
      { name: "if", desc: "Conditional execution" },
      { name: "unless", desc: "Inverse conditional" },
      { name: "run", desc: "Execute command" },
      { name: "in", desc: "Change dimension" },
    ];

    return subcommands.map((sub) => ({
      label: sub.name,
      kind: CompletionItemKind.Keyword,
      detail: sub.desc,
    }));
  }

  /**
   * Get gamerule completions
   */
  private getGameRuleCompletions(): ICompletionItem[] {
    const rules = [
      { name: "commandBlockOutput", desc: "Show command block output" },
      { name: "doDaylightCycle", desc: "Advance time" },
      { name: "doEntityDrops", desc: "Entities drop items" },
      { name: "doFireTick", desc: "Fire spreads" },
      { name: "doInsomnia", desc: "Phantoms spawn" },
      { name: "doImmediateRespawn", desc: "Skip death screen" },
      { name: "doMobLoot", desc: "Mobs drop loot" },
      { name: "doMobSpawning", desc: "Mobs spawn naturally" },
      { name: "doTileDrops", desc: "Blocks drop items" },
      { name: "doWeatherCycle", desc: "Weather changes" },
      { name: "drowningDamage", desc: "Drowning hurts" },
      { name: "fallDamage", desc: "Fall damage" },
      { name: "fireDamage", desc: "Fire damage" },
      { name: "freezeDamage", desc: "Freeze damage" },
      { name: "functionCommandLimit", desc: "Commands per tick limit" },
      { name: "keepInventory", desc: "Keep inventory on death" },
      { name: "maxCommandChainLength", desc: "Max command chain" },
      { name: "mobGriefing", desc: "Mobs modify world" },
      { name: "naturalRegeneration", desc: "Health regeneration" },
      { name: "pvp", desc: "Player vs player" },
      { name: "randomTickSpeed", desc: "Random tick rate" },
      { name: "respawnBlocksExplode", desc: "Beds explode in wrong dimension" },
      { name: "sendCommandFeedback", desc: "Command feedback" },
      { name: "showCoordinates", desc: "Show coordinates" },
      { name: "showDeathMessages", desc: "Show death messages" },
      { name: "showTags", desc: "Show entity tags" },
      { name: "spawnRadius", desc: "World spawn radius" },
      { name: "tntExplodes", desc: "TNT explosions" },
    ];

    return rules.map((rule) => ({
      label: rule.name,
      kind: CompletionItemKind.Property,
      detail: rule.desc,
    }));
  }
}

// Singleton instance
export const commandCompletionGenerator = new CommandCompletionGenerator();
