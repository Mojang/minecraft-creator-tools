// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * BedrockKnowledge - runtime access to the active Bedrock Knowledge snapshot.
 *
 * Retail data is bundled statically. Preview data (or a fresher snapshot, e.g. from a live game
 * connection or a local engine-exporter drop) can be supplied at runtime via registerBedrockKnowledge()
 * and selected with setActiveBedrockChannel(). Consumers that cache derived tables should subscribe to
 * onDidChangeBedrockKnowledge().
 */

import retailKnowledgeJson from "./data/bedrock-knowledge.retail.json";
import {
  BedrockChannel,
  DEFAULT_MOLANG_QUERY_SET,
  getRangeQuerySets,
  IBedrockKnowledge,
  IKnowledgeCommand,
  IKnowledgeCommandOverload,
  IKnowledgeMolangFunction,
  IKnowledgeMolangQuery,
  VanillaListCategory,
} from "./IBedrockKnowledge";
import { compareBedrockVersions, expandCommandEnumValues } from "./BedrockKnowledgeBuilder";
import { getBedrockKnowledgeProblem } from "./BedrockKnowledgeValidation";

export { compareBedrockVersions, getBedrockKnowledgeProblem };
import { formatOverloadSignature } from "./BedrockKnowledgeDiff";

const MINECRAFT_NAMESPACE = "minecraft:";

const snapshots = new Map<BedrockChannel, IBedrockKnowledge>([
  ["retail", retailKnowledgeJson as unknown as IBedrockKnowledge],
]);
let activeChannel: BedrockChannel = "retail";
const listeners = new Set<(knowledge: IBedrockKnowledge) => void>();

interface IKnowledgeIndex {
  commands: Map<string, IKnowledgeCommand>;
  queries: Map<string, IKnowledgeMolangQuery>;
  math: Map<string, IKnowledgeMolangFunction>;
  /** Expanded command enum values, built on first use. */
  enumValues: Map<string, readonly string[]>;
  /** Lowercased expanded command enum values, for membership checks. */
  enumValueSets: Map<string, Set<string>>;
  vanilla: Map<string, Set<string>>;
}
const indexes = new WeakMap<IBedrockKnowledge, IKnowledgeIndex>();

function getIndex(knowledge: IBedrockKnowledge): IKnowledgeIndex {
  let index = indexes.get(knowledge);
  if (!index) {
    const commands = new Map<string, IKnowledgeCommand>();
    for (const cmd of knowledge.commands) {
      commands.set(cmd.name.toLowerCase(), cmd);
      for (const alias of cmd.aliases) {
        if (!commands.has(alias.toLowerCase())) {
          commands.set(alias.toLowerCase(), cmd);
        }
      }
    }
    const vanilla = new Map<string, Set<string>>();
    index = {
      commands,
      queries: new Map(knowledge.molang.queries.map((q) => [q.name.toLowerCase(), q])),
      math: new Map(knowledge.molang.math.map((m) => [m.name.toLowerCase(), m])),
      enumValues: new Map(),
      enumValueSets: new Map(),
      vanilla,
    };
    indexes.set(knowledge, index);
  }
  return index;
}

/** The knowledge snapshot for the active channel (or a specific channel if registered). */
export function getBedrockKnowledge(channel?: BedrockChannel): IBedrockKnowledge {
  return snapshots.get(channel ?? activeChannel) ?? snapshots.get("retail")!;
}

export function getActiveBedrockChannel(): BedrockChannel {
  return activeChannel;
}

export function isBedrockChannelAvailable(channel: BedrockChannel): boolean {
  return snapshots.has(channel);
}

/**
 * Supply a knowledge snapshot at runtime (e.g. preview data loaded from the extension folder, or a
 * snapshot produced from a connected game). Replaces any existing snapshot for the same channel.
 * Throws, without changing any state, if the snapshot is incompatible (see getBedrockKnowledgeProblem).
 */
export function registerBedrockKnowledge(knowledge: IBedrockKnowledge, options?: { activate?: boolean }) {
  const problem = getBedrockKnowledgeProblem(knowledge);
  if (problem) {
    throw new Error(`Can't load Bedrock knowledge: ${problem}.`);
  }
  // The snapshot may be the same object as before with its contents changed, so rebuild its index.
  indexes.delete(knowledge);
  snapshots.set(knowledge.channel, knowledge);
  if (options?.activate) {
    activeChannel = knowledge.channel;
  }
  if (knowledge.channel === activeChannel) {
    notify();
  }
}

/**
 * Remove the Preview snapshot. If Preview was active, switches back to Retail and notifies listeners.
 * The bundled Retail snapshot can't be removed.
 */
export function unregisterBedrockKnowledge(channel: "preview") {
  if (!snapshots.delete(channel)) {
    return;
  }
  if (activeChannel === channel) {
    activeChannel = "retail";
    notify();
  }
}

/** Switch channels. Returns false (and leaves the active channel unchanged) if no snapshot is registered. */
export function setActiveBedrockChannel(channel: BedrockChannel): boolean {
  if (!snapshots.has(channel)) {
    return false;
  }
  if (channel !== activeChannel) {
    activeChannel = channel;
    notify();
  }
  return true;
}

export function onDidChangeBedrockKnowledge(listener: (knowledge: IBedrockKnowledge) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify() {
  const knowledge = getBedrockKnowledge();
  for (const listener of listeners) {
    listener(knowledge);
  }
}

// ---- Lookups ----

/** Find a command by name or alias (case-insensitive, leading "/" ignored). */
export function findCommand(nameOrAlias: string, knowledge = getBedrockKnowledge()): IKnowledgeCommand | undefined {
  const key = nameOrAlias.replace(/^\//, "").toLowerCase();
  return getIndex(knowledge).commands.get(key);
}

/** Normalize Molang short forms (q., v., t., c.) to their long forms. */
export function normalizeMolangName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.startsWith("q.")) return "query." + lower.substring(2);
  if (lower.startsWith("v.")) return "variable." + lower.substring(2);
  if (lower.startsWith("t.")) return "temp." + lower.substring(2);
  if (lower.startsWith("c.")) return "context." + lower.substring(2);
  return lower;
}

export function findMolangQuery(name: string, knowledge = getBedrockKnowledge()): IKnowledgeMolangQuery | undefined {
  return getIndex(knowledge).queries.get(normalizeMolangName(name));
}

export function findMolangMath(name: string, knowledge = getBedrockKnowledge()): IKnowledgeMolangFunction | undefined {
  return getIndex(knowledge).math.get(name.toLowerCase());
}

/**
 * Fully expanded values for a command enum (including bare names where "minecraft:" is optional).
 * Expanded once per snapshot and shared, so callers must not mutate the result.
 */
export function getCommandEnumValues(enumName: string, knowledge = getBedrockKnowledge()): readonly string[] {
  const index = getIndex(knowledge);
  let values = index.enumValues.get(enumName);
  if (!values) {
    const e = knowledge.commandEnums[enumName];
    values = e ? expandCommandEnumValues(e) : [];
    index.enumValues.set(enumName, values);
  }
  return values;
}

/** True when the snapshot has no values for the enum (it is missing, or soft and filled at runtime). */
export function isCommandEnumEmpty(enumName: string, knowledge = getBedrockKnowledge()): boolean {
  const e = knowledge.commandEnums[enumName];
  return !e || e.values.length === 0;
}

export function isCommandEnumValue(enumName: string, value: string, knowledge = getBedrockKnowledge()): boolean {
  const index = getIndex(knowledge);
  let values = index.enumValueSets.get(enumName);
  if (!values) {
    values = new Set(getCommandEnumValues(enumName, knowledge).map((v) => v.toLowerCase()));
    index.enumValueSets.set(enumName, values);
  }
  return values.has(value.toLowerCase());
}

/** Lowercase, with "minecraft:" added when there's no namespace, so bare and namespaced ids compare equal. */
function normalizeVanillaId(id: string): string {
  return (id.includes(":") ? id : MINECRAFT_NAMESPACE + id).toLowerCase();
}

/** True if id (with or without "minecraft:") is a vanilla identifier of the given category. */
export function isVanillaIdentifier(
  category: VanillaListCategory | "blocks",
  id: string,
  knowledge = getBedrockKnowledge()
): boolean {
  const index = getIndex(knowledge);
  let set = index.vanilla.get(category);
  if (!set) {
    const names = category === "blocks" ? knowledge.vanilla.blocks.map((b) => b.name) : knowledge.vanilla[category];
    set = new Set(names.map(normalizeVanillaId));
    index.vanilla.set(category, set);
  }
  return set.has(normalizeVanillaId(id));
}

// ---- Formatting ----

export function formatCommandOverloads(cmd: IKnowledgeCommand): string[] {
  return cmd.overloads.map((o: IKnowledgeCommandOverload) => formatOverloadSignature(cmd.name, o));
}

/**
 * Render a Molang function's call signature, e.g. "math.clamp(a, b, c)". A function that requires
 * arguments but reports no maximum is variadic and gets a trailing "...". The engine reports no
 * arity for most zero-argument queries, so those render without parentheses.
 */
export function formatMolangSignature(fn: IKnowledgeMolangFunction): string {
  const max = fn.maxArgs ?? fn.minArgs;
  if (max === 0) {
    return fn.name;
  }
  const args: string[] = [];
  for (let i = 0; i < max; i++) {
    const label = `arg${i + 1}`;
    args.push(i < fn.minArgs ? label : `[${label}]`);
  }
  if (fn.maxArgs === undefined) {
    args.push("...");
  }
  return `${fn.name}(${args.join(", ")})`;
}

// ---- Versions ----

export { DEFAULT_MOLANG_QUERY_SET };

/**
 * Whether a Molang query is available in the given query set (e.g. "default", "world_gen", or
 * "tags") for content targeting the given engine/format version. A single availability range must
 * satisfy both. Without a version, any version counts; without a query set, any set counts. A
 * range that lists no query sets belongs to the default set.
 */
export function isMolangQueryAvailable(
  query: Pick<IKnowledgeMolangQuery, "availability">,
  version?: string,
  querySet?: string
): boolean {
  if (query.availability.length === 0) {
    return true;
  }
  return query.availability.some(
    (r) =>
      (!querySet || getRangeQuerySets(r).includes(querySet)) &&
      (!version ||
        (compareBedrockVersions(version, r.firstVersion) >= 0 &&
          (!r.lastVersion || compareBedrockVersions(version, r.lastVersion) <= 0)))
  );
}
