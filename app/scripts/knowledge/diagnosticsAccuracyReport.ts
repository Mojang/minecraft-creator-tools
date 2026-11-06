// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Accuracy report for engine-derived diagnostics.
 *
 * Runs command diagnostics over one or more corpora of real content and summarizes every
 * diagnostic by code. Commands come from .mcfunction files and from JSON: animation controller
 * on_entry/on_exit "/command" strings and queue_command/run_command "command" values (vanilla
 * content has no .mcfunction files). Used by the Bedrock knowledge update workflow as a regression
 * gate: a knowledge update must not introduce new diagnostics on known-good content.
 *
 * Usage:
 *   ts-node scripts/knowledge/diagnosticsAccuracyReport.ts <dir> [<dir> ...]
 *     [--json <out.json>] [--max-samples <n>] [--fail-on <CODE,CODE>] [--knowledge <snapshot.json>]
 *     [--baseline <before.json>]
 *
 * --knowledge: validate against a specific knowledge snapshot (e.g. a freshly generated preview file)
 * instead of the bundled retail snapshot.
 *
 * --fail-on: exit 1 if any diagnostic with one of these codes is produced (e.g. on vanilla content
 * that is known to be valid). Without it, the script only reports.
 *
 * --baseline: a --json report from a previous run over the same corpus. With --fail-on, only fail on
 * occurrences that are not in the baseline, so pre-existing findings in fixture content do not block
 * updates. Occurrences are compared individually (see BedrockKnowledgeAccuracy), not as totals.
 *
 * --max-samples only limits the samples printed and stored per code; the gate uses every occurrence.
 */

import * as fs from "fs";
import * as path from "path";
import { parseTree, Node as JsonNode } from "jsonc-parser";
import { commandDiagnosticGenerator } from "../../src/langcore/mcfunction/CommandDiagnostics";
import { getBedrockKnowledge, registerBedrockKnowledge } from "../../src/knowledge/BedrockKnowledge";
import { findNewDiagnosticOccurrences, IDiagnosticOccurrence } from "../../src/knowledge/BedrockKnowledgeAccuracy";

interface ISample {
  file: string;
  line: number;
  text: string;
  message: string;
}

interface IReport {
  gameVersion: string;
  files: number;
  lines: number;
  diagnostics: number;
  byCode: { [code: string]: { count: number; samples: ISample[] } };
  occurrences: IDiagnosticOccurrence[];
}

function parseArgs(argv: string[]) {
  const dirs: string[] = [];
  let json: string | undefined;
  let maxSamples = 10;
  let failOn: string[] = [];
  let knowledge: string | undefined;
  let baseline: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") json = argv[++i];
    else if (a === "--knowledge") knowledge = argv[++i];
    else if (a === "--baseline") baseline = argv[++i];
    else if (a === "--max-samples") maxSamples = parseInt(argv[++i], 10);
    else if (a === "--fail-on") failOn = argv[++i].split(",").map((c) => c.trim());
    else dirs.push(a);
  }
  return { dirs, json, maxSamples, failOn, knowledge, baseline };
}

function* walk(dir: string): Generator<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules" && entry.name !== ".git") yield* walk(full);
    } else if (/\.(mcfunction|json)$/i.test(entry.name)) {
      yield full;
    }
  }
}

interface ICommandLine {
  line: number;
  text: string;
}

const COMMAND_CONTAINERS = /(^|:)(queue_command|run_command)$/;

/** Extracts slash commands embedded in behavior pack JSON, with 1-based line numbers. */
function extractJsonCommands(content: string): ICommandLine[] {
  const root = parseTree(content, [], { allowTrailingComma: true, disallowComments: false });
  if (!root) return [];
  const lineStarts = [0];
  for (let i = 0; i < content.length; i++) if (content[i] === "\n") lineStarts.push(i + 1);
  const lineOf = (offset: number) => {
    let lo = 0;
    let hi = lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (lineStarts[mid] <= offset) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  };
  const results: ICommandLine[] = [];
  const add = (node: JsonNode | undefined, requireSlash: boolean) => {
    const strings = node?.type === "array" ? (node.children ?? []) : node ? [node] : [];
    for (const s of strings) {
      if (s.type !== "string" || typeof s.value !== "string") continue;
      const value = s.value.trim();
      if (requireSlash && !value.startsWith("/")) continue;
      const text = value.replace(/^\//, "");
      if (text) results.push({ line: lineOf(s.offset), text });
    }
  };
  const visit = (node: JsonNode, containerKey: string | undefined) => {
    if (node.type === "object") {
      for (const prop of node.children ?? []) {
        const key = prop.children?.[0]?.value as string;
        const value = prop.children?.[1];
        if (!value) continue;
        if (key === "on_entry" || key === "on_exit") add(value, true);
        else if (key === "command" && containerKey && COMMAND_CONTAINERS.test(containerKey)) add(value, false);
        else visit(value, key);
      }
    } else if (node.type === "array") {
      for (const child of node.children ?? []) visit(child, containerKey);
    }
  };
  visit(root, undefined);
  return results;
}

function getCommandLines(file: string): ICommandLine[] {
  const content = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
  if (/\.json$/i.test(file)) return extractJsonCommands(content);
  return content
    .split(/\r?\n/)
    .map((text, i) => ({ line: i + 1, text }))
    .filter((l) => l.text.trim() && !l.text.trim().startsWith("#"));
}

function main() {
  const { dirs, json, maxSamples, failOn, knowledge, baseline } = parseArgs(process.argv.slice(2));
  if (dirs.length === 0) {
    console.error(
      "Usage: diagnosticsAccuracyReport.ts <dir> [<dir> ...] [--json out] [--fail-on CODES] [--knowledge file] [--baseline file]"
    );
    process.exit(2);
  }
  if (knowledge) {
    registerBedrockKnowledge(JSON.parse(fs.readFileSync(knowledge, "utf8")), { activate: true });
  }

  const report: IReport = {
    gameVersion: getBedrockKnowledge().gameVersion,
    files: 0,
    lines: 0,
    diagnostics: 0,
    byCode: {},
    occurrences: [],
  };

  for (const dir of dirs) {
    for (const file of walk(dir)) {
      const commands = getCommandLines(file);
      if (commands.length === 0) continue;
      report.files++;
      // Relative to the working directory, so two corpus roots with the same folder name don't collide.
      const relativeFile = path.relative(process.cwd(), file).replace(/\\/g, "/");
      for (const { line, text } of commands) {
        report.lines++;
        for (const d of commandDiagnosticGenerator.analyzeLine(text, line)) {
          const code = String(d.code ?? "UNKNOWN");
          report.diagnostics++;
          const bucket = (report.byCode[code] ??= { count: 0, samples: [] });
          bucket.count++;
          report.occurrences.push({
            code,
            file: relativeFile,
            line,
            startColumn: d.startColumn,
            endColumn: d.endColumn,
            text: text.trim(),
          });
          if (bucket.samples.length < maxSamples) {
            bucket.samples.push({ file: path.relative(dir, file), line, text: text.trim(), message: d.message });
          }
        }
      }
    }
  }

  console.log(
    `Knowledge ${report.gameVersion}: ${report.files} files, ${report.lines} command lines, ${report.diagnostics} diagnostics`
  );
  for (const [code, { count, samples }] of Object.entries(report.byCode).sort((a, b) => b[1].count - a[1].count)) {
    console.log(`\n${code}: ${count}`);
    for (const s of samples) {
      console.log(`  ${s.file}:${s.line}  ${s.text.substring(0, 120)}\n      -> ${s.message.substring(0, 200)}`);
    }
  }

  if (json) {
    fs.writeFileSync(json, JSON.stringify(report, null, 2) + "\n");
  }

  const before: IDiagnosticOccurrence[] = baseline
    ? ((JSON.parse(fs.readFileSync(baseline, "utf8")) as Partial<IReport>).occurrences ?? [])
    : [];
  const added = findNewDiagnosticOccurrences(before, report.occurrences, failOn);
  if (added.length > 0) {
    console.error(`\nAccuracy gate failed: ${added.length} new finding(s)${baseline ? " not in the baseline" : ""}`);
    for (const o of added.slice(0, maxSamples)) {
      console.error(`  ${o.code} ${o.file}:${o.line}  ${o.text.substring(0, 120)}`);
    }
    process.exit(1);
  }
}

main();
