// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Structural checks for Bedrock Knowledge snapshots. getBedrockKnowledgeProblem guards snapshots
 * loaded at runtime (see registerBedrockKnowledge), and getKnowledgeUpdateProblems is the policy the
 * updater script applies before it writes a newly built snapshot. This module doesn't import the
 * bundled snapshots, so scripts and tests can use it on their own.
 */

import { BEDROCK_KNOWLEDGE_FORMAT_VERSION, IBedrockKnowledge, VANILLA_LIST_CATEGORIES } from "./IBedrockKnowledge";

type Check = (value: unknown) => boolean;
const isString: Check = (value) => typeof value === "string";
const isNumber: Check = (value) => typeof value === "number";
const isBoolean: Check = (value) => typeof value === "boolean";
const isObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const optional =
  (check: Check): Check =>
  (value) =>
    value === undefined || check(value);
const arrayOf =
  (check: Check): Check =>
  (value) =>
    Array.isArray(value) && value.every(check);
const shape =
  (fields: Record<string, Check>): Check =>
  (value) =>
    isObject(value) && Object.entries(fields).every(([name, check]) => check(value[name]));

const isMolangFunction = { name: isString, description: isString, minArgs: isNumber, maxArgs: optional(isNumber) };
const SNAPSHOT_SECTIONS: Record<string, Check> = {
  gameVersion: isString,
  source: shape({ origin: isString, ref: isString, revision: optional(isString) }),
  commands: arrayOf(
    shape({
      name: isString,
      description: isString,
      aliases: arrayOf(isString),
      permissionLevel: isNumber,
      requiresCheats: isBoolean,
      overloads: arrayOf(
        shape({
          params: arrayOf(shape({ name: isString, type: isString, optional: isBoolean, enumName: optional(isString) })),
        })
      ),
    })
  ),
  commandEnums: (value) =>
    isObject(value) &&
    Object.values(value).every(shape({ values: arrayOf(isString), minecraftNamespaceOptional: optional(isBoolean) })),
  molang: shape({
    queries: arrayOf(
      shape({
        ...isMolangFunction,
        returnType: optional(isString),
        availability: arrayOf(
          shape({ firstVersion: isString, lastVersion: optional(isString), querySets: arrayOf(isString) })
        ),
      })
    ),
    math: arrayOf(shape(isMolangFunction)),
  }),
  vanilla: shape({
    ...Object.fromEntries(VANILLA_LIST_CATEGORIES.map((category) => [category, arrayOf(isString)])),
    blocks: arrayOf(shape({ name: isString, states: arrayOf(isString) })),
    blockStates: arrayOf(
      shape({
        name: isString,
        type: isString,
        values: arrayOf((v) => isString(v) || isNumber(v) || isBoolean(v)),
      })
    ),
  }),
};

/**
 * Returns why a snapshot loaded at runtime can't be used, or undefined if it can. Checks the format
 * version and every field that the lookups and langcore tables read, including nested entries.
 */
export function getBedrockKnowledgeProblem(knowledge: unknown): string | undefined {
  if (!isObject(knowledge)) {
    return "the snapshot is not a JSON object";
  }
  if (knowledge.formatVersion !== BEDROCK_KNOWLEDGE_FORMAT_VERSION) {
    return `the snapshot has format version ${knowledge.formatVersion}, but this version of Creator Tools reads format version ${BEDROCK_KNOWLEDGE_FORMAT_VERSION}`;
  }
  if (knowledge.channel !== "retail" && knowledge.channel !== "preview") {
    return `the snapshot channel "${knowledge.channel}" is not "retail" or "preview"`;
  }
  const invalid = Object.entries(SNAPSHOT_SECTIONS)
    .filter(([name, check]) => !check(knowledge[name]))
    .map(([name]) => name);
  if (invalid.length > 0) {
    return `the snapshot is missing or has an invalid ${invalid.join(", ")} section`;
  }
  return undefined;
}

/**
 * Problems that should stop the updater from writing a newly built snapshot: an invalid shape, or
 * counts low enough (or shrunk enough since the previous snapshot) to suggest a truncated source.
 */
export function getKnowledgeUpdateProblems(k: IBedrockKnowledge, previous?: IBedrockKnowledge): string[] {
  const shapeProblem = getBedrockKnowledgeProblem(k);
  if (shapeProblem) {
    return [`The built snapshot is invalid: ${shapeProblem}.`];
  }
  const problems: string[] = [];
  const minimums: [string, number, number][] = [
    ["commands", k.commands.length, 50],
    ["molang queries", k.molang.queries.length, 200],
    ["molang math functions", k.molang.math.length, 25],
    ["vanilla entities", k.vanilla.entities.length, 80],
    ["vanilla items", k.vanilla.items.length, 1000],
    ["vanilla blocks", k.vanilla.blocks.length, 1000],
  ];
  for (const [label, count, min] of minimums) {
    if (count < min) problems.push(`Only ${count} ${label} (expected at least ${min}).`);
  }
  if (previous) {
    const shrink = (label: string, before: number, after: number) => {
      if (before > 0 && after < before * 0.9) {
        problems.push(`${label} shrank by more than 10% (${before} → ${after}).`);
      }
    };
    shrink("commands", previous.commands.length, k.commands.length);
    shrink("molang queries", previous.molang.queries.length, k.molang.queries.length);
    shrink("vanilla items", previous.vanilla.items.length, k.vanilla.items.length);
    shrink("vanilla blocks", previous.vanilla.blocks.length, k.vanilla.blocks.length);
  }
  return problems;
}
