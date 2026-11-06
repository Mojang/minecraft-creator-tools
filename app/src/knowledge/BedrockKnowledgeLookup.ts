// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Reference lookups over a Bedrock Knowledge snapshot, formatted as Markdown for people and language
 * models. Answers come only from the engine-derived snapshot, so a "not found" result is authoritative
 * for the snapshot's game version and channel.
 */

import {
  findCommand,
  findMolangMath,
  findMolangQuery,
  formatCommandOverloads,
  formatMolangSignature,
  getCommandEnumValues,
  normalizeMolangName,
} from "./BedrockKnowledge";
import { IBedrockKnowledge, VANILLA_LIST_CATEGORIES } from "./IBedrockKnowledge";

export type BedrockReferenceKind = "auto" | "command" | "molang" | "block" | "identifier" | "enum";

export const BEDROCK_REFERENCE_KINDS: BedrockReferenceKind[] = [
  "auto",
  "command",
  "molang",
  "block",
  "identifier",
  "enum",
];

const MAX_LIST = 40;

function header(knowledge: IBedrockKnowledge): string {
  return `_Source: Bedrock ${knowledge.channel} ${knowledge.gameVersion} (${knowledge.source.origin}@${knowledge.source.ref})_`;
}

function listPreview(values: readonly string[]): string {
  const shown = values.slice(0, MAX_LIST).map((v) => `\`${v}\``);
  const more = values.length > MAX_LIST ? `, and ${values.length - MAX_LIST} more` : "";
  return shown.join(", ") + more;
}

function similar(candidates: readonly string[], query: string): string[] {
  const q = query
    .toLowerCase()
    .replace(/^\//, "")
    .replace(/^minecraft:/, "");
  if (q.length < 2) return [];
  const longForm = normalizeMolangName(q);
  return candidates.filter((c) => c.toLowerCase().includes(q) || c.toLowerCase().includes(longForm)).slice(0, 10);
}

function lookupCommand(knowledge: IBedrockKnowledge, query: string): string | undefined {
  const cmd = findCommand(query, knowledge);
  if (!cmd) return undefined;
  const lines = [`### /${cmd.name}`, "", cmd.description || "_No description._", ""];
  if (cmd.aliases.length > 0) lines.push(`Aliases: ${cmd.aliases.map((a) => `/${a}`).join(", ")}`);
  lines.push(`Permission level: ${cmd.permissionLevel}${cmd.requiresCheats ? " (requires cheats)" : ""}`, "");
  lines.push("Syntax:", "```", ...formatCommandOverloads(cmd), "```");
  const enums = new Set<string>();
  for (const o of cmd.overloads) for (const p of o.params) if (p.enumName) enums.add(p.enumName);
  for (const name of enums) {
    const values = getCommandEnumValues(name, knowledge);
    if (values.length > 0 && values.length <= MAX_LIST) lines.push(`- \`${name}\`: ${listPreview(values)}`);
  }
  return lines.join("\n");
}

function lookupMolang(knowledge: IBedrockKnowledge, query: string): string | undefined {
  const q = findMolangQuery(query, knowledge);
  if (q) {
    const lines = [
      `### ${q.name}`,
      "",
      q.description || "_No description._",
      "",
      `Signature: \`${formatMolangSignature(q)}\``,
    ];
    if (q.returnType) lines.push(`Returns: ${q.returnType}`);
    for (const r of q.availability) {
      const range = r.lastVersion ? `${r.firstVersion} to ${r.lastVersion}` : `${r.firstVersion} and later`;
      lines.push(`Available: ${range} in ${r.querySets.join(", ") || "default"} contexts`);
    }
    return lines.join("\n");
  }
  const m = findMolangMath(normalizeMolangName(query), knowledge);
  if (m)
    return [
      `### ${m.name}`,
      "",
      m.description || "_No description._",
      "",
      `Signature: \`${formatMolangSignature(m)}\``,
    ].join("\n");
  return undefined;
}

function withNamespace(id: string): string {
  return id.includes(":") ? id.toLowerCase() : "minecraft:" + id.toLowerCase();
}

function lookupBlock(knowledge: IBedrockKnowledge, query: string): string | undefined {
  const id = withNamespace(query);
  const block = knowledge.vanilla.blocks.find((b) => b.name.toLowerCase() === id);
  if (!block) return undefined;
  const lines = [`### ${block.name} (block)`];
  if (block.states.length === 0) lines.push("", "No block states.");
  for (const stateName of block.states) {
    const state = knowledge.vanilla.blockStates.find((s) => s.name === stateName);
    lines.push(`- \`${stateName}\`${state ? ` (${state.type}): ${listPreview(state.values.map(String))}` : ""}`);
  }
  return lines.join("\n");
}

function lookupIdentifier(knowledge: IBedrockKnowledge, query: string): string | undefined {
  const id = withNamespace(query);
  const found: string[] = [];
  for (const category of VANILLA_LIST_CATEGORIES) {
    if (knowledge.vanilla[category].some((v) => withNamespace(v) === id)) found.push(category);
  }
  if (knowledge.vanilla.blocks.some((b) => b.name.toLowerCase() === id)) found.push("blocks");
  if (found.length === 0) return undefined;
  return `\`${id}\` is a vanilla identifier in: ${found.join(", ")}.`;
}

function lookupEnum(knowledge: IBedrockKnowledge, query: string): string | undefined {
  const name = Object.keys(knowledge.commandEnums).find((n) => n.toLowerCase() === query.toLowerCase());
  if (!name) return undefined;
  const values = getCommandEnumValues(name, knowledge);
  return `### Command enum ${name}\n\n${values.length} values: ${listPreview(values)}`;
}

/** Look up a command, Molang query/function, block, vanilla identifier, or command enum. */
export function lookupBedrockReference(
  knowledge: IBedrockKnowledge,
  query: string,
  kind: BedrockReferenceKind = "auto"
): { found: boolean; markdown: string } {
  const q = (query ?? "").trim();
  if (!q) return { found: false, markdown: "Provide a name to look up." };

  const lookups: [BedrockReferenceKind, (k: IBedrockKnowledge, s: string) => string | undefined][] = [
    ["command", lookupCommand],
    ["molang", lookupMolang],
    ["block", lookupBlock],
    ["identifier", lookupIdentifier],
    ["enum", lookupEnum],
  ];
  for (const [k, fn] of lookups) {
    if (kind !== "auto" && kind !== k) continue;
    const result = fn(knowledge, q);
    if (result) return { found: true, markdown: `${result}\n\n${header(knowledge)}` };
  }

  const candidates = [
    ...(kind === "auto" || kind === "command" ? knowledge.commands.map((c) => "/" + c.name) : []),
    ...(kind === "auto" || kind === "molang"
      ? [...knowledge.molang.queries.map((m) => m.name), ...knowledge.molang.math.map((m) => m.name)]
      : []),
    ...(kind === "auto" || kind === "block" || kind === "identifier"
      ? knowledge.vanilla.blocks.map((b) => b.name)
      : []),
    ...(kind === "auto" || kind === "identifier" ? VANILLA_LIST_CATEGORIES.flatMap((c) => knowledge.vanilla[c]) : []),
    ...(kind === "auto" || kind === "enum" ? Object.keys(knowledge.commandEnums) : []),
  ];
  const suggestions = similar([...new Set(candidates)], q);
  const what = kind === "auto" ? "anything" : `a ${kind}`;
  const lines = [`\`${q}\` doesn't match ${what} in this version of Minecraft.`];
  if (suggestions.length > 0) lines.push("", `Similar names: ${listPreview(suggestions)}`);
  return { found: false, markdown: `${lines.join("\n")}\n\n${header(knowledge)}` };
}
