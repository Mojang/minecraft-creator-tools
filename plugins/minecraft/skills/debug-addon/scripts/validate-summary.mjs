#!/usr/bin/env node
// Runs Minecraft Creator Tools validation on a project folder and prints a compact,
// de-duplicated summary of errors, warnings, and recommendations.
//
// Usage:
//   node validate-summary.mjs <project-folder> [--json] [--suite <name>]
//   node validate-summary.mjs --from <saved-validate-output.json> [--json] [--project <folder>]
//
// Set MCT_CLI to override how the CLI is launched. Otherwise the script uses the CLI from the same
// Minecraft Creator Tools package when it runs from one (skills served by `mct mcp` live in
// <package>/skills/), so validation matches that version, and falls back to
// "npx -y @minecraft/creator-tools@latest".
// Exit codes: 0 = no errors, 1 = errors found, 2 = validation could not run or found no projects.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DOCS_BASE = "https://learn.microsoft.com/minecraft/creator/reference/content/mctoolsvalreference/";
const ERROR_TYPES = new Set(["error", "testFail", "internalProcessingError"]);

// Findings that Bedrock accepts in practice. They are reported separately so they
// don't distract from real problems.
const LIKELY_NOISE = [
  {
    reason: "this ID is one of the project's own blocks, and blocks can be used as items (for example in recipes)",
    test: (i, ctx) => {
      const id = /`([^`]+)`/.exec(String(i.data ?? ""))?.[1];
      return i.generatorId === "UNLINK" && /item type/i.test(i.message ?? "") && !!id && ctx.blockIds.has(id);
    },
  },
  {
    reason: "item_texture.json/terrain_texture.json accept a single string for 'textures'",
    test: (i) =>
      /_texture\.json$/.test(i.path ?? "") && /string value found, but a array is required/.test(String(i.data ?? "")),
  },
  {
    reason: "render controllers don't need uv_anim",
    test: (i) => /uv_anim\) is missing and it is required/.test(String(i.data ?? "")),
  },
];

// UNLINK warnings about vanilla (minecraft:) IDs are usually expected, since vanilla content lives
// outside the project, but a misspelled vanilla ID produces the same warning. They get their own
// section so they're neither mixed with real problems nor hidden.
const isVanillaReference = (i) => i.generatorId === "UNLINK" && /`minecraft:[^`]+`/.test(String(i.data ?? ""));

// Collects identifiers of custom blocks defined under any blocks/ folder in the project.
function findBlockIds(folder) {
  const ids = new Set();
  const walk = (dir, depth, inBlocks) => {
    if (depth > 8) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name === "node_modules" || e.name.startsWith(".")) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full, depth + 1, inBlocks || e.name === "blocks");
      else if (inBlocks && e.name.endsWith(".json")) {
        try {
          const text = fs.readFileSync(full, "utf8").replace(/^\s*\/\/.*$/gm, "");
          const id = JSON.parse(text)?.["minecraft:block"]?.description?.identifier;
          if (id) ids.add(id);
        } catch {
          // Not a parseable block definition; ignore it.
        }
      }
    }
  };
  walk(folder, 0, false);
  return ids;
}

// The CLI doesn't check that pack dependencies point at a pack that exists, so a behavior pack can
// silently lose its resource pack (for example after a manifest is regenerated or copied).
// Returns findings in the same shape as CLI report items.
function checkPackDependencies(folder) {
  const manifests = [];
  const walk = (dir, depth) => {
    if (depth > 4) return;
    const manifest = path.join(dir, "manifest.json");
    if (fs.existsSync(manifest)) {
      try {
        manifests.push({ file: manifest, json: JSON.parse(fs.readFileSync(manifest, "utf8")) });
      } catch {
        // Unparseable manifests are reported by the CLI's own checks.
      }
      return;
    }
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.isDirectory() && e.name !== "node_modules" && !e.name.startsWith("."))
        walk(path.join(dir, e.name), depth + 1);
    }
  };
  walk(folder, 0);

  const headerIds = new Set(manifests.map((m) => String(m.json?.header?.uuid ?? "").toLowerCase()).filter(Boolean));
  const findings = [];
  for (const m of manifests) {
    for (const dep of m.json?.dependencies ?? []) {
      if (dep.uuid && !headerIds.has(String(dep.uuid).toLowerCase())) {
        findings.push({
          type: "warning",
          generatorId: "PACKDEP",
          message: "Pack dependency doesn't match any pack in this project, so the packs won't activate together",
          path: "/" + path.relative(folder, m.file).split(path.sep).join("/"),
          data: `dependency uuid ${dep.uuid}; set it to the other pack's header.uuid`,
        });
      }
    }
  }
  return findings;
}

function parseArgs(argv) {
  const opts = { json: false, from: undefined, folder: undefined, project: undefined, suite: undefined };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") opts.json = true;
    else if (a === "--from") opts.from = argv[++i];
    else if (a === "--suite") opts.suite = argv[++i];
    else if (a === "--project") opts.project = argv[++i];
    else if (a === "-h" || a === "--help") opts.help = true;
    else if (!opts.folder) opts.folder = a;
  }
  return opts;
}

// Quotes an argument for the Windows command line. Backslashes are literal there unless they come
// before a double quote, so only those runs (and a trailing run, which comes before the closing quote)
// are doubled, and each double quote is escaped.
function quoteForShell(arg) {
  if (!/[\s"&|<>^]/.test(arg)) {
    return arg;
  }
  const escaped = arg.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/, "$1$1");
  return `"${escaped}"`;
}

function resolveCli() {
  if (process.env.MCT_CLI) {
    const [command, ...args] = process.env.MCT_CLI.trim().split(/\s+/);
    return { command, args, useShell: true };
  }

  const packagedCli = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "cli", "index.mjs");
  if (fs.existsSync(packagedCli)) {
    return { command: process.execPath, args: [packagedCli], useShell: false };
  }

  return { command: "npx", args: ["-y", "@minecraft/creator-tools@latest"], useShell: true };
}

function runValidate(folder, suite) {
  const cli = resolveCli();
  // The CLI writes report files to ./out by default and reuses them as a cache on the next run.
  // Sending them to a throwaway folder (plus --force) keeps the user's project clean and results fresh.
  const reportDir = fs.mkdtempSync(path.join(os.tmpdir(), "mct-validate-"));
  const args = [...cli.args, "validate", ...(suite ? [suite] : []), "-i", folder, "-o", reportDir, "--json", "--force"];
  const isWindows = process.platform === "win32";
  let result;
  try {
    // npx is a .cmd file on Windows, so it needs a shell; the packaged CLI runs directly with node.
    const useShell = isWindows && cli.useShell;
    result = spawnSync(cli.command, useShell ? args.map(quoteForShell) : args, {
      encoding: "utf8",
      maxBuffer: 256 * 1024 * 1024,
      shell: useShell,
    });
  } finally {
    fs.rmSync(reportDir, { recursive: true, force: true });
  }

  if (result.error) {
    throw new Error(`Could not start "${[cli.command, ...cli.args].join(" ")}": ${result.error.message}`);
  }

  const stdout = (result.stdout || "").trim();
  const start = stdout.indexOf("{");
  if (start < 0) {
    const tail = (result.stderr || "").trim().split("\n").slice(-15).join("\n");
    throw new Error(`Validation produced no JSON output (exit code ${result.status}).\n${tail}`);
  }
  return JSON.parse(stdout.slice(start));
}

function summarize(report, ctx) {
  const buckets = {
    errors: new Map(),
    warnings: new Map(),
    vanilla: new Map(),
    noise: new Map(),
    recommendations: new Map(),
  };

  for (const project of report.projects ?? []) {
    for (const item of project.items ?? []) {
      let bucket;
      let noiseReason;
      // "Found N errors in X check" lines only repeat the individual findings that follow them.
      if (item.type === "testFail" && /^Found \d+ \w+ in /.test(item.message ?? "")) continue;
      if (ERROR_TYPES.has(item.type)) bucket = "errors";
      else if (item.type === "warning") bucket = "warnings";
      else if (item.type === "recommendation") bucket = "recommendations";
      else continue;

      if (bucket === "warnings" && isVanillaReference(item)) {
        bucket = "vanilla";
      } else if (bucket === "warnings") {
        const noise = LIKELY_NOISE.find((n) => n.test(item, ctx));
        if (noise) {
          bucket = "noise";
          noiseReason = noise.reason;
        }
      }

      const detail = typeof item.data === "string" ? item.data : undefined;
      const key = [item.generatorId, item.message, item.path ?? "", detail ?? ""].join("|");
      const existing = buckets[bucket].get(key);
      if (existing) {
        existing.count++;
      } else {
        buckets[bucket].set(key, {
          generatorId: item.generatorId,
          message: item.message,
          path: item.path,
          detail,
          noiseReason,
          docs: item.generatorId && !item.localCheck ? DOCS_BASE + item.generatorId.toLowerCase() : undefined,
          count: 1,
        });
      }
    }
  }

  const list = (m) => [...m.values()];
  const total = (m) => list(m).reduce((n, i) => n + i.count, 0);
  return {
    projects: (report.projects ?? []).map((p) => p.name),
    counts: {
      errors: total(buckets.errors),
      warnings: total(buckets.warnings),
      vanillaReferences: total(buckets.vanilla),
      likelyNoise: total(buckets.noise),
      recommendations: total(buckets.recommendations),
    },
    errors: list(buckets.errors),
    warnings: list(buckets.warnings),
    vanillaReferences: list(buckets.vanilla),
    likelyNoise: list(buckets.noise),
    recommendations: list(buckets.recommendations),
  };
}

function printSection(title, items, { showDocs = true, showReason = false } = {}) {
  if (items.length === 0) return;
  console.log(`\n${title}`);
  for (const i of items) {
    const count = i.count > 1 ? ` (x${i.count})` : "";
    console.log(`  [${i.generatorId}] ${i.message}${count}`);
    if (i.path) console.log(`      file: ${i.path}`);
    if (i.detail) console.log(`      detail: ${i.detail}`);
    if (showReason && i.noiseReason) console.log(`      why it's likely fine: ${i.noiseReason}`);
    if (showDocs && i.docs) console.log(`      docs: ${i.docs}`);
  }
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help || (!opts.folder && !opts.from)) {
    console.log("Usage: node validate-summary.mjs <project-folder> [--json] [--suite <name>]");
    console.log("       node validate-summary.mjs --from <saved-validate-output.json> [--json] [--project <folder>]");
    process.exit(opts.help ? 0 : 2);
  }

  let report;
  try {
    report = opts.from
      ? JSON.parse(fs.readFileSync(opts.from, "utf8"))
      : runValidate(path.resolve(opts.folder), opts.suite);
  } catch (e) {
    console.error(String(e.message || e));
    process.exit(2);
  }

  const projectFolder = opts.folder ?? opts.project;
  if (projectFolder && report.projects?.length) {
    const extra = checkPackDependencies(path.resolve(projectFolder)).map((f) => ({ ...f, localCheck: true }));
    report.projects[0].items = [...(report.projects[0].items ?? []), ...extra];
  }
  const summary = summarize(report, {
    blockIds: projectFolder ? findBlockIds(path.resolve(projectFolder)) : new Set(),
  });

  if (opts.json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    const c = summary.counts;
    console.log(
      `Validated ${summary.projects.join(", ") || "(no projects found)"}: ` +
        `${c.errors} error(s), ${c.warnings} warning(s), ${c.vanillaReferences} vanilla reference(s) to check, ` +
        `${c.likelyNoise} likely-noise warning(s), ${c.recommendations} recommendation(s)`
    );
    printSection("ERRORS - fix these", summary.errors);
    printSection("WARNINGS - usually real problems (for example, a broken reference)", summary.warnings);
    printSection(
      "VANILLA REFERENCES - expected, but check each minecraft: ID is spelled correctly; a typo here is a real bug",
      summary.vanillaReferences,
      { showDocs: false }
    );
    printSection(
      "LIKELY NOISE - Bedrock accepts these; leave them unless the user wants a clean report",
      summary.likelyNoise,
      {
        showDocs: false,
        showReason: true,
      }
    );
    printSection("RECOMMENDATIONS - optional", summary.recommendations, { showDocs: false });
    if (summary.projects.length === 0) {
      console.log(
        "\nNo projects were found. Point this at the folder that contains behavior_packs/ and resource_packs/."
      );
    }
  }

  if (summary.projects.length === 0) process.exit(2);
  process.exit(summary.counts.errors > 0 ? 1 : 0);
}

main();
