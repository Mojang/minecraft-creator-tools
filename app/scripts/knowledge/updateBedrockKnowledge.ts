// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * updateBedrockKnowledge - regenerate src/knowledge/data/bedrock-knowledge.<channel>.json from engine metadata.
 *
 * Usage (from app/):
 *   npm run knowledge:update -- --channel retail
 *   npm run knowledge:update -- --channel preview --changelog ../out/knowledge-preview.md
 *   npm run knowledge:update -- --channel retail --source <dir>   # use a local engine-exporter drop
 *   npm run knowledge:check                                         # exit 1 if data is stale
 *
 * Sources, in priority order:
 *   1. --source <dir>: a local folder laid out like bedrock-samples/metadata (e.g. the internal engine
 *      exporter output, which may carry richer data than the public drop).
 *   2. Mojang/bedrock-samples on GitHub: "main" for retail, "preview" for preview (override with --ref).
 *      Every file is read from one commit: --revision <sha>, or the commit --ref resolves to. If the ref
 *      can't be resolved the run fails; --allow-unpinned reads from the ref instead (manual runs only).
 *
 * Outputs:
 *   - the knowledge JSON (only rewritten when content changes),
 *   - optionally a Markdown changelog (--changelog) and a machine-readable summary (--summary) used by
 *     the bedrock-knowledge-update workflow to title and gate the pull request.
 */

import * as fs from "fs";
import * as path from "path";
import { BedrockChannel, IBedrockKnowledge } from "../../src/knowledge/IBedrockKnowledge";
import { createGitHubMetadataReader, IMetadataReader } from "../../src/knowledge/BedrockMetadataReader";
import { getKnowledgeUpdateProblems } from "../../src/knowledge/BedrockKnowledgeValidation";
import {
  buildBedrockKnowledge,
  COMMANDS_MODULE_FILE,
  IRawBedrockMetadata,
  MOLANG_MODULE_FILE,
  VANILLA_MODULE_FILES,
} from "../../src/knowledge/BedrockKnowledgeBuilder";
import {
  diffBedrockKnowledge,
  formatKnowledgeDiffMarkdown,
  getPotentiallyBreakingChanges,
  knowledgeDiffHasChanges,
} from "../../src/knowledge/BedrockKnowledgeDiff";

const SAMPLES_REPO = "Mojang/bedrock-samples";
const DEFAULT_REFS: { [K in BedrockChannel]: string } = { retail: "main", preview: "preview" };

interface IArgs {
  channel: BedrockChannel;
  ref: string;
  revision?: string;
  allowUnpinned: boolean;
  source?: string;
  out: string;
  changelog?: string;
  summary?: string;
  check: boolean;
}

function parseArgs(argv: string[]): IArgs {
  const get = (name: string) => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const channel = (get("channel") ?? "retail") as BedrockChannel;
  if (channel !== "retail" && channel !== "preview") {
    throw new Error(`--channel must be "retail" or "preview" (got "${channel}")`);
  }
  return {
    channel,
    ref: get("ref") ?? DEFAULT_REFS[channel],
    revision: get("revision"),
    allowUnpinned: argv.includes("--allow-unpinned"),
    source: get("source"),
    out:
      get("out") ?? path.join(__dirname, "..", "..", "src", "knowledge", "data", `bedrock-knowledge.${channel}.json`),
    changelog: get("changelog"),
    summary: get("summary"),
    check: argv.includes("--check"),
  };
}

function githubHeaders(): { [key: string]: string } {
  const headers: { [key: string]: string } = { "User-Agent": "minecraft-creator-tools-knowledge-updater" };
  const token = process.env.GITHUB_TOKEN;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function fetchJson(url: string, optional = false): Promise<any> {
  const response = await fetch(url, { headers: githubHeaders() });
  if (!response.ok) {
    if (optional && response.status === 404) {
      return undefined;
    }
    throw new Error(`GET ${url} failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

function folderReader(folder: string, ref: string): IMetadataReader {
  const metadataRoot = fs.existsSync(path.join(folder, "metadata")) ? path.join(folder, "metadata") : folder;
  return {
    async readJson(relativePath, optional) {
      const full = path.join(metadataRoot, relativePath);
      if (!fs.existsSync(full)) {
        if (optional) return undefined;
        throw new Error(`Missing metadata file: ${full}`);
      }
      return JSON.parse(fs.readFileSync(full, "utf8"));
    },
    describe: () => ({ origin: "local", ref }),
    async version() {
      for (const candidate of [path.join(folder, "version.json"), path.join(metadataRoot, "version.json")]) {
        if (fs.existsSync(candidate)) {
          const versions = JSON.parse(fs.readFileSync(candidate, "utf8"));
          return versions?.latest?.version ?? versions?.version ?? "unknown";
        }
      }
      return "unknown";
    },
  };
}

async function readRawMetadata(reader: IMetadataReader): Promise<IRawBedrockMetadata> {
  const vanillaEntries = await Promise.all(
    Object.entries(VANILLA_MODULE_FILES).map(async ([key, file]) => [
      key,
      await reader.readJson(`vanilladata_modules/${file}`, true),
    ])
  );
  return {
    commands: await reader.readJson(COMMANDS_MODULE_FILE),
    molang: await reader.readJson(MOLANG_MODULE_FILE),
    vanilla: Object.fromEntries(vanillaEntries),
  };
}

export function serializeKnowledge(k: IBedrockKnowledge): string {
  return JSON.stringify(k, null, 1) + "\n";
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const reader = args.source
    ? folderReader(args.source, args.ref)
    : createGitHubMetadataReader(SAMPLES_REPO, args.ref, fetchJson, {
        revision: args.revision,
        allowUnpinned: args.allowUnpinned,
      });

  const gameVersion = await reader.version();
  const raw = await readRawMetadata(reader);
  const knowledge = buildBedrockKnowledge(raw, { channel: args.channel, gameVersion, source: reader.describe() });

  const previous: IBedrockKnowledge | undefined = fs.existsSync(args.out)
    ? JSON.parse(fs.readFileSync(args.out, "utf8"))
    : undefined;

  const problems = getKnowledgeUpdateProblems(knowledge, previous);
  if (problems.length) {
    console.error("Refusing to update Bedrock knowledge; the source metadata looks incomplete or malformed:");
    problems.forEach((p) => console.error(`  - ${p}`));
    process.exit(2);
  }

  // Compare content without the volatile source revision so a new upstream commit with identical
  // data does not produce churn.
  const comparable = (k: IBedrockKnowledge | undefined) =>
    k ? serializeKnowledge({ ...k, source: { ...k.source, revision: undefined } }) : "";
  const changed = comparable(previous) !== comparable(knowledge);

  const diff = previous ? diffBedrockKnowledge(previous, knowledge) : undefined;
  const markdown = diff
    ? formatKnowledgeDiffMarkdown(diff, args.channel)
    : `### Bedrock knowledge (${args.channel}): initial import of ${gameVersion}`;
  const breaking = diff ? getPotentiallyBreakingChanges(diff) : [];

  console.log(markdown);

  if (args.summary) {
    fs.mkdirSync(path.dirname(args.summary), { recursive: true });
    fs.writeFileSync(
      args.summary,
      JSON.stringify(
        {
          channel: args.channel,
          changed,
          fromVersion: previous?.gameVersion,
          toVersion: gameVersion,
          hasSemanticChanges: diff ? knowledgeDiffHasChanges(diff) : true,
          potentiallyBreaking: breaking.length,
          source: knowledge.source,
        },
        null,
        2
      ) + "\n"
    );
  }

  if (args.changelog) {
    fs.mkdirSync(path.dirname(args.changelog), { recursive: true });
    fs.writeFileSync(args.changelog, markdown + "\n");
  }

  if (args.check) {
    if (changed) {
      console.error(
        `\nBedrock knowledge (${args.channel}) is out of date. Run: npm run knowledge:update -- --channel ${args.channel}`
      );
      process.exit(1);
    }
    return;
  }

  if (changed) {
    fs.mkdirSync(path.dirname(args.out), { recursive: true });
    fs.writeFileSync(args.out, serializeKnowledge(knowledge));
    console.log(`\nWrote ${path.relative(process.cwd(), args.out)}`);
  } else {
    console.log(`\nBedrock knowledge (${args.channel}) is already up to date.`);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
