// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Bedrock Knowledge IR
 *
 * A versioned, editor-neutral description of what the Bedrock engine accepts: commands and their
 * overloads, Molang queries and math functions, and vanilla identifiers. It is generated from
 * engine-exported metadata (see scripts/knowledge/updateBedrockKnowledge.ts) and consumed by
 * langcore, the VS Code extension, the CLI validators, and the MCP server.
 *
 * The IR is intentionally a plain JSON document so that it can be diffed in pull requests,
 * shipped inside the extension bundle, and loaded by non-TypeScript tools.
 */

/** Increment when the shape of IBedrockKnowledge changes in a non-additive way. */
export const BEDROCK_KNOWLEDGE_FORMAT_VERSION = 1;

/** Retail = the released game. Preview = Minecraft Preview / beta. */
export type BedrockChannel = "retail" | "preview";

export interface IBedrockKnowledgeSource {
  /** Where the raw metadata came from, e.g. "Mojang/bedrock-samples" or "bedrock-engine-exporter". */
  origin: string;
  /** Branch, tag, or build identifier the metadata was taken from. */
  ref: string;
  /** Commit SHA or build number when known. */
  revision?: string;
}

export interface IBedrockKnowledge {
  formatVersion: number;
  channel: BedrockChannel;
  /** Engine version the data describes, e.g. "1.26.60.5". */
  gameVersion: string;
  source: IBedrockKnowledgeSource;
  commands: IKnowledgeCommand[];
  /** Command enums keyed by enum name (as named by the engine, e.g. "Block", "GameMode"). */
  commandEnums: { [enumName: string]: IKnowledgeCommandEnum };
  molang: IKnowledgeMolang;
  vanilla: IKnowledgeVanillaData;
}

export interface IKnowledgeCommandEnum {
  /**
   * Enum values. When minecraftNamespaceOptional is true, each "minecraft:x" value is also accepted
   * as bare "x"; those bare duplicates are omitted here to keep the artifact small. Use
   * getCommandEnumValues() to get the fully expanded list.
   */
  values: string[];
  minecraftNamespaceOptional?: boolean;
}

export interface IKnowledgeCommand {
  name: string;
  description: string;
  aliases: string[];
  /** Engine permission level (0 = any, 1 = game directors / function files, 2+ = operators/host). */
  permissionLevel: number;
  requiresCheats: boolean;
  overloads: IKnowledgeCommandOverload[];
}

export interface IKnowledgeCommandOverload {
  params: IKnowledgeCommandParam[];
}

export interface IKnowledgeCommandParam {
  name: string;
  /** Engine parameter type, e.g. "SELECTION", "POSITION", "INT", or an enum type such as "GAMEMODE". */
  type: string;
  optional: boolean;
  /** When the type refers to a command enum, the enum name (key into commandEnums). */
  enumName?: string;
}

export interface IKnowledgeMolang {
  queries: IKnowledgeMolangQuery[];
  math: IKnowledgeMolangFunction[];
}

export interface IKnowledgeMolangFunction {
  /** Fully qualified name, e.g. "math.lerp". */
  name: string;
  description: string;
  minArgs: number;
  /** Undefined means unbounded / not reported by the engine. */
  maxArgs?: number;
}

export interface IKnowledgeMolangQuery extends IKnowledgeMolangFunction {
  returnType?: string;
  /** Version ranges in which the query is available; supports format_version-aware validation. */
  availability: IKnowledgeVersionRange[];
}

export interface IKnowledgeVersionRange {
  /** First min_engine_version / format_version in which this range applies (inclusive). */
  firstVersion: string;
  /** Last version in which this range applies (inclusive). Undefined = still available. */
  lastVersion?: string;
  /** Contexts the query is available in, e.g. "default", "world_gen", "tags". Empty means default. */
  querySets: string[];
}

/** Molang query set for ordinary entity, animation, and render controller expressions. */
export const DEFAULT_MOLANG_QUERY_SET = "default";

/** The query sets a range covers, treating an empty list as the default set. */
export function getRangeQuerySets(range: IKnowledgeVersionRange): string[] {
  return range.querySets.length ? range.querySets : [DEFAULT_MOLANG_QUERY_SET];
}

export interface IKnowledgeBlock {
  name: string;
  /** Names of block states (properties) this block supports. */
  states: string[];
}

export interface IKnowledgeBlockState {
  name: string;
  type: string;
  values: (string | number | boolean)[];
}

export interface IKnowledgeVanillaData {
  entities: string[];
  items: string[];
  blocks: IKnowledgeBlock[];
  blockStates: IKnowledgeBlockState[];
  biomes: string[];
  effects: string[];
  enchantments: string[];
  dimensions: string[];
  features: string[];
  cameraPresets: string[];
  cooldownCategories: string[];
  potionEffects: string[];
  potionTypes: string[];
}

/** Names of the string-list categories in IKnowledgeVanillaData, useful for generic iteration. */
export const VANILLA_LIST_CATEGORIES = [
  "entities",
  "items",
  "biomes",
  "effects",
  "enchantments",
  "dimensions",
  "features",
  "cameraPresets",
  "cooldownCategories",
  "potionEffects",
  "potionTypes",
] as const;

export type VanillaListCategory = (typeof VANILLA_LIST_CATEGORIES)[number];
