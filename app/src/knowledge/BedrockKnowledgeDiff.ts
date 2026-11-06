// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * BedrockKnowledgeDiff - semantic diff between two Bedrock Knowledge snapshots.
 *
 * Used by the update pipeline to produce the human-readable changelog attached to the automated
 * "Update Bedrock knowledge" pull request, and to flag removals (potentially breaking for creators)
 * so reviewers can focus on them. Preview updates auto-merge only when getPotentiallyBreakingChanges()
 * is empty, so any change that can reject previously valid content must be classified there.
 */

import {
  IBedrockKnowledge,
  IKnowledgeBlock,
  IKnowledgeBlockState,
  IKnowledgeCommand,
  IKnowledgeCommandOverload,
  IKnowledgeMolangFunction,
  IKnowledgeMolangQuery,
  IKnowledgeVersionRange,
  VANILLA_LIST_CATEGORIES,
  getRangeQuerySets,
} from "./IBedrockKnowledge";
import { compareBedrockVersions, expandCommandEnumValues } from "./BedrockKnowledgeBuilder";

export interface IListDiff {
  added: string[];
  removed: string[];
}

export interface IChangedEntry {
  name: string;
  changes: string[];
}

export interface IKnowledgeDiff {
  fromVersion: string;
  toVersion: string;
  commands: IListDiff & { changed: IChangedEntry[] };
  commandEnums: IListDiff & { changed: { name: string; added: string[]; removed: string[] }[] };
  molangQueries: IListDiff & { changed: IChangedEntry[] };
  molangMath: IListDiff & { changed: IChangedEntry[] };
  vanilla: { [category: string]: IListDiff };
  /** Blocks present in both snapshots whose supported states changed. */
  blocks: IChangedEntry[];
  blockStates: IListDiff & { changed: IChangedEntry[] };
}

function diffLists(before: Iterable<string>, after: Iterable<string>): IListDiff {
  const b = new Set(before);
  const a = new Set(after);
  return {
    added: [...a].filter((x) => !b.has(x)).sort(),
    removed: [...b].filter((x) => !a.has(x)).sort(),
  };
}

export function formatOverloadSignature(commandName: string, overload: IKnowledgeCommandOverload): string {
  const parts = overload.params.map((p) => {
    const label = `${p.name}: ${p.enumName ?? p.type}`;
    return p.optional ? `[${label}]` : `<${label}>`;
  });
  return [commandName, ...parts].join(" ");
}

function diffCommand(before: IKnowledgeCommand, after: IKnowledgeCommand): string[] {
  const changes: string[] = [];
  if (before.description !== after.description) {
    changes.push(`description: "${before.description}" → "${after.description}"`);
  }
  // A higher permission level or a new cheats requirement stops the command running where it ran before.
  if (before.permissionLevel !== after.permissionLevel) {
    const tightened = after.permissionLevel > before.permissionLevel;
    changes.push(
      `${tightened ? COMMAND_ACCESS_TIGHTENED + ", " : ""}permission level: ${before.permissionLevel} → ${after.permissionLevel}`
    );
  }
  if (before.requiresCheats !== after.requiresCheats) {
    const tightened = after.requiresCheats && !before.requiresCheats;
    changes.push(
      `${tightened ? COMMAND_ACCESS_TIGHTENED + ", " : ""}requires cheats: ${before.requiresCheats} → ${after.requiresCheats}`
    );
  }
  const aliasDiff = diffLists(before.aliases, after.aliases);
  aliasDiff.added.forEach((a) => changes.push(`alias added: ${a}`));
  aliasDiff.removed.forEach((a) => changes.push(`alias removed: ${a}`));

  const sigDiff = diffLists(
    before.overloads.map((o) => formatOverloadSignature(before.name, o)),
    after.overloads.map((o) => formatOverloadSignature(after.name, o))
  );
  sigDiff.added.forEach((s) => changes.push(`overload added: \`${s}\``));
  sigDiff.removed.forEach((s) => changes.push(`overload removed: \`${s}\``));
  return changes;
}

function diffMolangFunction(before: IKnowledgeMolangFunction, after: IKnowledgeMolangFunction): string[] {
  const changes: string[] = [];
  if (before.description !== after.description) {
    changes.push(`description changed`);
  }
  if (before.minArgs !== after.minArgs || before.maxArgs !== after.maxArgs) {
    // Requiring more arguments, or accepting fewer, rejects calls that were valid before.
    const narrowed =
      after.minArgs > before.minArgs ||
      (after.maxArgs !== undefined && (before.maxArgs === undefined || after.maxArgs < before.maxArgs));
    changes.push(
      `${narrowed ? MOLANG_ARGUMENTS_NARROWED : "arguments"}: ${before.minArgs}..${before.maxArgs ?? "∞"} → ${after.minArgs}..${after.maxArgs ?? "∞"}`
    );
  }
  return changes;
}

const COMMAND_ACCESS_TIGHTENED = "access tightened";
const MOLANG_ARGUMENTS_NARROWED = "arguments narrowed";
const MOLANG_AVAILABILITY_NARROWED = "availability narrowed";

/**
 * True when some version/query set that was available before is no longer covered. Each before
 * range must be covered by a single after range, so a split range is conservatively treated as
 * narrowed and sent to review.
 */
function isAvailabilityNarrowed(before: IKnowledgeVersionRange[], after: IKnowledgeVersionRange[]): boolean {
  if (after.length === 0) {
    return false;
  }
  if (before.length === 0) {
    return true;
  }
  return before.some((b) =>
    getRangeQuerySets(b).some(
      (set) =>
        !after.some(
          (a) =>
            getRangeQuerySets(a).includes(set) &&
            compareBedrockVersions(a.firstVersion, b.firstVersion) <= 0 &&
            (!a.lastVersion || (!!b.lastVersion && compareBedrockVersions(a.lastVersion, b.lastVersion) >= 0))
        )
    )
  );
}

function diffMolangQuery(before: IKnowledgeMolangQuery, after: IKnowledgeMolangQuery): string[] {
  const changes = diffMolangFunction(before, after);
  if (before.returnType !== after.returnType) {
    changes.push(`return type: ${before.returnType ?? "?"} → ${after.returnType ?? "?"}`);
  }
  const fmt = (q: IKnowledgeMolangQuery) =>
    q.availability.map((r) => `${r.firstVersion}–${r.lastVersion ?? "current"} [${r.querySets.join(",")}]`).join("; ");
  if (fmt(before) !== fmt(after)) {
    const label = isAvailabilityNarrowed(before.availability, after.availability)
      ? MOLANG_AVAILABILITY_NARROWED
      : "availability";
    changes.push(`${label}: ${fmt(before)} → ${fmt(after)}`);
  }
  return changes;
}

const BLOCK_STATE_REMOVED = "state removed";
const BLOCK_STATE_TYPE_CHANGED = "type changed";
const BLOCK_STATE_VALUE_REMOVED = "value removed";

/** Typed rendering, so numeric 1 and string "1" are different values. */
function formatStateValue(value: string | number | boolean): string {
  return JSON.stringify(value);
}

function diffBlockState(before: IKnowledgeBlockState, after: IKnowledgeBlockState): string[] {
  const changes: string[] = [];
  if (before.type !== after.type) {
    changes.push(`${BLOCK_STATE_TYPE_CHANGED}: ${before.type} → ${after.type}`);
  }
  const d = diffLists(before.values.map(formatStateValue), after.values.map(formatStateValue));
  d.added.forEach((v) => changes.push(`value added: ${v}`));
  d.removed.forEach((v) => changes.push(`${BLOCK_STATE_VALUE_REMOVED}: ${v}`));
  return changes;
}

function diffBlock(before: IKnowledgeBlock, after: IKnowledgeBlock): string[] {
  const d = diffLists(before.states, after.states);
  return [...d.added.map((s) => `state added: ${s}`), ...d.removed.map((s) => `${BLOCK_STATE_REMOVED}: ${s}`)];
}

function diffKeyed<T extends { name: string }>(
  before: T[],
  after: T[],
  compare: (b: T, a: T) => string[]
): IListDiff & { changed: IChangedEntry[] } {
  const beforeMap = new Map(before.map((x) => [x.name, x]));
  const afterMap = new Map(after.map((x) => [x.name, x]));
  const listDiff = diffLists(beforeMap.keys(), afterMap.keys());
  const changed: IChangedEntry[] = [];
  for (const [name, a] of afterMap) {
    const b = beforeMap.get(name);
    if (b) {
      const changes = compare(b, a);
      if (changes.length > 0) {
        changed.push({ name, changes });
      }
    }
  }
  changed.sort((x, y) => (x.name < y.name ? -1 : 1));
  return { ...listDiff, changed };
}

export function diffBedrockKnowledge(before: IBedrockKnowledge, after: IBedrockKnowledge): IKnowledgeDiff {
  const enumListDiff = diffLists(Object.keys(before.commandEnums), Object.keys(after.commandEnums));
  const enumChanged: { name: string; added: string[]; removed: string[] }[] = [];
  for (const name of Object.keys(after.commandEnums).sort()) {
    if (before.commandEnums[name]) {
      const d = diffLists(
        expandCommandEnumValues(before.commandEnums[name]),
        expandCommandEnumValues(after.commandEnums[name])
      );
      if (d.added.length || d.removed.length) {
        enumChanged.push({ name, ...d });
      }
    }
  }

  const vanilla: { [category: string]: IListDiff } = {};
  for (const category of VANILLA_LIST_CATEGORIES) {
    vanilla[category] = diffLists(before.vanilla[category], after.vanilla[category]);
  }
  vanilla.blocks = diffLists(
    before.vanilla.blocks.map((b) => b.name),
    after.vanilla.blocks.map((b) => b.name)
  );

  return {
    fromVersion: before.gameVersion,
    toVersion: after.gameVersion,
    commands: diffKeyed(before.commands, after.commands, diffCommand),
    commandEnums: { ...enumListDiff, changed: enumChanged },
    molangQueries: diffKeyed(before.molang.queries, after.molang.queries, diffMolangQuery),
    molangMath: diffKeyed(before.molang.math, after.molang.math, diffMolangFunction),
    vanilla,
    blocks: diffKeyed(before.vanilla.blocks, after.vanilla.blocks, diffBlock).changed,
    blockStates: diffKeyed(before.vanilla.blockStates, after.vanilla.blockStates, diffBlockState),
  };
}

export function knowledgeDiffHasChanges(diff: IKnowledgeDiff): boolean {
  const lists: IListDiff[] = [
    diff.commands,
    diff.commandEnums,
    diff.molangQueries,
    diff.molangMath,
    diff.blockStates,
    ...Object.values(diff.vanilla),
  ];
  return (
    diff.fromVersion !== diff.toVersion ||
    lists.some((l) => l.added.length > 0 || l.removed.length > 0) ||
    diff.commands.changed.length > 0 ||
    diff.commandEnums.changed.length > 0 ||
    diff.molangQueries.changed.length > 0 ||
    diff.molangMath.changed.length > 0 ||
    diff.blocks.length > 0 ||
    diff.blockStates.changed.length > 0
  );
}

/**
 * Removals and signature changes that could make previously-valid creator content fail validation.
 * Surfaced at the top of the update PR so reviewers can confirm they reflect real engine changes.
 */
export function getPotentiallyBreakingChanges(diff: IKnowledgeDiff): string[] {
  const breaking: string[] = [];
  diff.commands.removed.forEach((c) => breaking.push(`Command removed: \`/${c}\``));
  for (const c of diff.commands.changed) {
    for (const change of c.changes) {
      if (
        change.startsWith("overload removed") ||
        change.startsWith("alias removed") ||
        change.startsWith(COMMAND_ACCESS_TIGHTENED)
      ) {
        breaking.push(`\`/${c.name}\` ${change}`);
      }
    }
  }
  diff.molangQueries.removed.forEach((q) => breaking.push(`Molang query removed: \`${q}\``));
  diff.molangMath.removed.forEach((q) => breaking.push(`Molang math function removed: \`${q}\``));
  for (const entry of [...diff.molangQueries.changed, ...diff.molangMath.changed]) {
    for (const change of entry.changes) {
      if (change.startsWith(MOLANG_ARGUMENTS_NARROWED) || change.startsWith(MOLANG_AVAILABILITY_NARROWED)) {
        breaking.push(`\`${entry.name}\` ${change}`);
      }
    }
  }
  diff.commandEnums.removed.forEach((e) => breaking.push(`Command enum removed: \`${e}\``));
  for (const e of diff.commandEnums.changed) {
    if (e.removed.length > 0) {
      breaking.push(`Command enum \`${e.name}\` values removed (${e.removed.length}): ${truncateList(e.removed, 10)}`);
    }
  }
  for (const [category, d] of Object.entries(diff.vanilla)) {
    if (d.removed.length > 0) {
      breaking.push(`Vanilla ${category} removed (${d.removed.length}): ${truncateList(d.removed, 10)}`);
    }
  }
  for (const b of diff.blocks) {
    const removed = b.changes.filter((c) => c.startsWith(BLOCK_STATE_REMOVED));
    if (removed.length > 0) {
      breaking.push(`Block \`${b.name}\` ${removed.join("; ")}`);
    }
  }
  diff.blockStates.removed.forEach((s) => breaking.push(`Block state removed: \`${s}\``));
  for (const s of diff.blockStates.changed) {
    const narrowed = s.changes.filter(
      (c) => c.startsWith(BLOCK_STATE_VALUE_REMOVED) || c.startsWith(BLOCK_STATE_TYPE_CHANGED)
    );
    if (narrowed.length > 0) {
      breaking.push(`Block state \`${s.name}\` ${narrowed.join("; ")}`);
    }
  }
  return breaking;
}

function truncateList(values: string[], max: number): string {
  const shown = values.slice(0, max).map((v) => `\`${v}\``);
  return values.length > max ? `${shown.join(", ")}, … (+${values.length - max} more)` : shown.join(", ");
}

function listSection(title: string, d: IListDiff, max = 40): string[] {
  const lines: string[] = [];
  if (d.added.length) lines.push(`- **${title} added (${d.added.length}):** ${truncateList(d.added, max)}`);
  if (d.removed.length) lines.push(`- **${title} removed (${d.removed.length}):** ${truncateList(d.removed, max)}`);
  return lines;
}

function changedSection(title: string, changed: IChangedEntry[], max = 25): string[] {
  if (changed.length === 0) return [];
  const lines = [`- **${title} changed (${changed.length}):**`];
  for (const entry of changed.slice(0, max)) {
    lines.push(`  - \`${entry.name}\`: ${entry.changes.join("; ")}`);
  }
  if (changed.length > max) lines.push(`  - … (+${changed.length - max} more)`);
  return lines;
}

/** Render a diff as Markdown for PR bodies and CHANGELOG entries. */
export function formatKnowledgeDiffMarkdown(diff: IKnowledgeDiff, channel?: string): string {
  const lines: string[] = [];
  const channelLabel = channel ? ` (${channel})` : "";
  lines.push(`### Bedrock knowledge${channelLabel}: ${diff.fromVersion} → ${diff.toVersion}`);
  lines.push("");

  if (!knowledgeDiffHasChanges(diff)) {
    lines.push("No changes.");
    return lines.join("\n");
  }

  const breaking = getPotentiallyBreakingChanges(diff);
  if (breaking.length) {
    lines.push("#### ⚠️ Potentially breaking (please confirm against engine changes)");
    breaking.forEach((b) => lines.push(`- ${b}`));
    lines.push("");
  }

  const body: string[] = [
    ...listSection("Commands", diff.commands),
    ...changedSection("Commands", diff.commands.changed),
    ...listSection("Command enums", diff.commandEnums),
    ...diff.commandEnums.changed
      .slice(0, 25)
      .map(
        (e) =>
          `- Enum \`${e.name}\`: +${e.added.length} / -${e.removed.length}` +
          (e.added.length ? ` (added ${truncateList(e.added, 8)})` : "")
      ),
    ...listSection("Molang queries", diff.molangQueries),
    ...changedSection("Molang queries", diff.molangQueries.changed),
    ...listSection("Molang math functions", diff.molangMath),
    ...changedSection("Molang math functions", diff.molangMath.changed),
  ];
  for (const [category, d] of Object.entries(diff.vanilla)) {
    body.push(...listSection(`Vanilla ${category}`, d));
  }
  body.push(
    ...changedSection("Blocks", diff.blocks),
    ...listSection("Block states", diff.blockStates),
    ...changedSection("Block states", diff.blockStates.changed)
  );

  if (body.length) {
    lines.push("#### Changes");
    lines.push(...body);
  }
  return lines.join("\n");
}
