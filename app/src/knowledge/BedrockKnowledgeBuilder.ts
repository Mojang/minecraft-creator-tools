// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * BedrockKnowledgeBuilder - converts raw engine metadata modules into the Bedrock Knowledge IR.
 *
 * Input is the JSON emitted by the engine's metadata exporter (published publicly under
 * Mojang/bedrock-samples/metadata). The builder is pure and deterministic: all lists are
 * de-duplicated and sorted so that regenerating from identical input yields byte-identical output,
 * which keeps update pull requests reviewable.
 */

import {
  BEDROCK_KNOWLEDGE_FORMAT_VERSION,
  BedrockChannel,
  IBedrockKnowledge,
  IBedrockKnowledgeSource,
  IKnowledgeBlock,
  IKnowledgeBlockState,
  IKnowledgeCommand,
  IKnowledgeCommandEnum,
  IKnowledgeCommandParam,
  IKnowledgeMolangFunction,
  IKnowledgeMolangQuery,
  IKnowledgeVanillaData,
} from "./IBedrockKnowledge";

// ---- Raw engine metadata shapes (only the fields we consume) ----

export interface IRawNamedValue {
  name?: string;
  value?: string | number | boolean;
}

export interface IRawCommandsModule {
  command_enums?: { name: string; values?: { value: string }[] }[];
  commands?: {
    name: string;
    description?: string;
    aliases?: { name: string }[];
    permission_level?: number;
    requires_cheats?: boolean;
    overloads?: { name?: string; params?: { name: string; is_optional?: boolean; type?: { name?: string } }[] }[];
  }[];
}

export interface IRawMolangModule {
  queries?: {
    name: string;
    description?: string;
    min_args?: number;
    max_args?: number;
    return_type?: string;
    version_ranges?: { first_version?: string; last_version?: string; query_sets?: string[] }[];
  }[];
  math_functions?: { name: string; description?: string; min_args?: number; max_args?: number }[];
}

export interface IRawVanillaDataModule {
  data_items?: { name: string; properties?: { name: string }[] }[];
  block_properties?: { name: string; type?: string; values?: { value: string | number | boolean }[] }[];
}

/** Raw modules keyed by their file stem in bedrock-samples/metadata/vanilladata_modules. */
export interface IRawBedrockMetadata {
  commands?: IRawCommandsModule;
  molang?: IRawMolangModule;
  vanilla?: {
    entities?: IRawVanillaDataModule;
    items?: IRawVanillaDataModule;
    blocks?: IRawVanillaDataModule;
    biomes?: IRawVanillaDataModule;
    effects?: IRawVanillaDataModule;
    enchantments?: IRawVanillaDataModule;
    dimensions?: IRawVanillaDataModule;
    features?: IRawVanillaDataModule;
    cameraPresets?: IRawVanillaDataModule;
    cooldownCategories?: IRawVanillaDataModule;
    potionEffects?: IRawVanillaDataModule;
    potionTypes?: IRawVanillaDataModule;
  };
}

/**
 * Maps knowledge vanilla categories to the file names used in bedrock-samples/metadata/vanilladata_modules.
 * Shared with the update script so file naming lives in one place.
 */
export const VANILLA_MODULE_FILES: { [K in keyof NonNullable<IRawBedrockMetadata["vanilla"]>]-?: string } = {
  entities: "mojang-entities.json",
  items: "mojang-items.json",
  blocks: "mojang-blocks.json",
  biomes: "mojang-biomes.json",
  effects: "mojang-effects.json",
  enchantments: "mojang-enchantments.json",
  dimensions: "mojang-dimensions.json",
  features: "mojang-features.json",
  cameraPresets: "mojang-camera-presets.json",
  cooldownCategories: "mojang-cooldown-category.json",
  potionEffects: "mojang-potion-effects.json",
  potionTypes: "mojang-potion-types.json",
};

export const COMMANDS_MODULE_FILE = "command_modules/mojang-commands.json";
export const MOLANG_MODULE_FILE = "molang_modules/mojang-molang-queries.json";

export interface IBuildKnowledgeOptions {
  channel: BedrockChannel;
  gameVersion: string;
  source: IBedrockKnowledgeSource;
}

const compareStrings = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

function uniqueSorted(values: Iterable<string>): string[] {
  return Array.from(new Set(values)).sort(compareStrings);
}

function namesOf(module: IRawVanillaDataModule | undefined): string[] {
  return uniqueSorted((module?.data_items ?? []).map((d) => d.name).filter((n): n is string => !!n));
}

export function buildBedrockKnowledge(raw: IRawBedrockMetadata, options: IBuildKnowledgeOptions): IBedrockKnowledge {
  const commandEnums = buildCommandEnums(raw.commands);
  const enumNameByUpper = new Map<string, string>();
  for (const enumName of Object.keys(commandEnums)) {
    enumNameByUpper.set(enumName.toUpperCase(), enumName);
  }

  return {
    formatVersion: BEDROCK_KNOWLEDGE_FORMAT_VERSION,
    channel: options.channel,
    gameVersion: options.gameVersion,
    source: options.source,
    commands: buildCommands(raw.commands, enumNameByUpper),
    commandEnums,
    molang: {
      queries: buildMolangQueries(raw.molang),
      math: buildMolangMath(raw.molang),
    },
    vanilla: buildVanilla(raw.vanilla ?? {}),
  };
}

const MINECRAFT_NAMESPACE = "minecraft:";

/**
 * Collapses "minecraft:x" + "x" pairs into a single namespaced value when the engine accepts both,
 * which roughly halves the size of the large Block/Item/Tool/recipe enums.
 */
export function compactCommandEnumValues(rawValues: string[]): IKnowledgeCommandEnum {
  const values = uniqueSorted(rawValues);
  const valueSet = new Set(values);
  const namespaced = values.filter((v) => v.startsWith(MINECRAFT_NAMESPACE));
  const allPaired =
    namespaced.length > 0 && namespaced.every((v) => valueSet.has(v.substring(MINECRAFT_NAMESPACE.length)));
  if (!allPaired) {
    return { values };
  }
  const redundant = new Set(namespaced.map((v) => v.substring(MINECRAFT_NAMESPACE.length)));
  return { values: values.filter((v) => !redundant.has(v)), minecraftNamespaceOptional: true };
}

/** Compare dotted Bedrock versions ("1.21.100" vs "1.21.90"); missing parts count as 0. */
export function compareBedrockVersions(a: string, b: string): number {
  const pa = a.split(".").map((p) => parseInt(p, 10) || 0);
  const pb = b.split(".").map((p) => parseInt(p, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff < 0 ? -1 : 1;
  }
  return 0;
}

export function expandCommandEnumValues(e: IKnowledgeCommandEnum): string[] {
  if (!e.minecraftNamespaceOptional) {
    return e.values;
  }
  const expanded = [...e.values];
  for (const v of e.values) {
    if (v.startsWith(MINECRAFT_NAMESPACE)) {
      expanded.push(v.substring(MINECRAFT_NAMESPACE.length));
    }
  }
  return uniqueSorted(expanded);
}

function buildCommandEnums(module: IRawCommandsModule | undefined): { [name: string]: IKnowledgeCommandEnum } {
  const merged = new Map<string, string[]>();
  for (const e of module?.command_enums ?? []) {
    merged.set(e.name, [...(merged.get(e.name) ?? []), ...(e.values ?? []).map((v) => String(v.value))]);
  }
  const result: { [name: string]: IKnowledgeCommandEnum } = {};
  for (const name of [...merged.keys()].sort(compareStrings)) {
    result[name] = compactCommandEnumValues(merged.get(name)!);
  }
  return result;
}

function buildCommands(
  module: IRawCommandsModule | undefined,
  enumNameByUpper: Map<string, string>
): IKnowledgeCommand[] {
  const commands: IKnowledgeCommand[] = [];

  for (const raw of module?.commands ?? []) {
    const overloads = (raw.overloads ?? []).map((o) => ({
      params: (o.params ?? []).map((p): IKnowledgeCommandParam => {
        const type = p.type?.name ?? "UNKNOWN";
        const param: IKnowledgeCommandParam = { name: p.name, type, optional: !!p.is_optional };
        const enumName = enumNameByUpper.get(type.toUpperCase());
        if (enumName) {
          param.enumName = enumName;
        }
        return param;
      }),
    }));

    commands.push({
      name: raw.name,
      description: raw.description ?? "",
      aliases: uniqueSorted((raw.aliases ?? []).map((a) => a.name)),
      permissionLevel: raw.permission_level ?? 0,
      requiresCheats: !!raw.requires_cheats,
      overloads,
    });
  }

  return commands.sort((a, b) => compareStrings(a.name, b.name));
}

function buildMolangQueries(module: IRawMolangModule | undefined): IKnowledgeMolangQuery[] {
  const queries: IKnowledgeMolangQuery[] = (module?.queries ?? []).map((q) => {
    const query: IKnowledgeMolangQuery = {
      name: q.name,
      description: q.description ?? "",
      minArgs: q.min_args ?? 0,
      availability: (q.version_ranges ?? []).map((r) => {
        const range: IKnowledgeMolangQuery["availability"][number] = {
          firstVersion: r.first_version ?? "0.0.0",
          querySets: uniqueSorted(r.query_sets ?? []),
        };
        if (r.last_version) {
          range.lastVersion = r.last_version;
        }
        return range;
      }),
    };
    if (q.max_args !== undefined) {
      query.maxArgs = q.max_args;
    }
    if (q.return_type) {
      query.returnType = q.return_type;
    }
    return query;
  });

  return queries.sort((a, b) => compareStrings(a.name, b.name));
}

function buildMolangMath(module: IRawMolangModule | undefined): IKnowledgeMolangFunction[] {
  const math = (module?.math_functions ?? []).map((m) => {
    const fn: IKnowledgeMolangFunction = { name: m.name, description: m.description ?? "", minArgs: m.min_args ?? 0 };
    if (m.max_args !== undefined) {
      fn.maxArgs = m.max_args;
    }
    return fn;
  });
  return math.sort((a, b) => compareStrings(a.name, b.name));
}

function buildVanilla(vanilla: NonNullable<IRawBedrockMetadata["vanilla"]>): IKnowledgeVanillaData {
  const blocks: IKnowledgeBlock[] = (vanilla.blocks?.data_items ?? [])
    .map((b) => ({ name: b.name, states: uniqueSorted((b.properties ?? []).map((p) => p.name)) }))
    .sort((a, b) => compareStrings(a.name, b.name));

  const blockStates: IKnowledgeBlockState[] = (vanilla.blocks?.block_properties ?? [])
    .map((p) => ({ name: p.name, type: p.type ?? "unknown", values: (p.values ?? []).map((v) => v.value) }))
    .sort((a, b) => compareStrings(a.name, b.name));

  return {
    entities: namesOf(vanilla.entities),
    items: namesOf(vanilla.items),
    blocks,
    blockStates,
    biomes: namesOf(vanilla.biomes),
    effects: namesOf(vanilla.effects),
    enchantments: namesOf(vanilla.enchantments),
    dimensions: namesOf(vanilla.dimensions),
    features: namesOf(vanilla.features),
    cameraPresets: namesOf(vanilla.cameraPresets),
    cooldownCategories: namesOf(vanilla.cooldownCategories),
    potionEffects: namesOf(vanilla.potionEffects),
    potionTypes: namesOf(vanilla.potionTypes),
  };
}
