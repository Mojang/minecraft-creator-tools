#!/usr/bin/env node
// Adds readable in-game names for custom mobs, items, and blocks that don't have one yet.
//
// Usage:
//   node add-missing-names.mjs <project-folder> [--name "<namespace:id>=<Display Name>" ...] [--dry-run]
//
// - Mobs:   entity.<id>.name, plus item.spawn_egg.entity.<id>.name when is_spawnable is true,
//           in the paired resource pack's texts/en_US.lang
// - Blocks: tile.<id>.name in the paired resource pack's texts/en_US.lang
// - Items:  a minecraft:display_name component in the item's behavior pack file
//
// Each behavior pack is paired with the resource pack it depends on (manifest dependencies), then by
// matching folder name, then with the only resource pack if there's just one. Names default to the
// ID in title case (swamp_goblin -> Swamp Goblin); pass --name to set them. Existing names are never
// changed. Exits 1 if anything couldn't be named, so the caller knows the work is incomplete.

import fs from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const opts = { folder: undefined, names: new Map(), dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--dry-run") opts.dryRun = true;
    else if (argv[i] === "--name") {
      const [id, ...rest] = String(argv[++i] ?? "").split("=");
      if (id && rest.length) opts.names.set(id.trim(), rest.join("=").trim());
    } else if (!opts.folder) opts.folder = argv[i];
  }
  return opts;
}

// Removes // and /* */ comments outside of strings, so JSON files with comments can be read.
function stripComments(text) {
  let out = "";
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];
    if (inString) {
      out += c;
      if (c === "\\") out += text[++i] ?? "";
      else if (c === '"') inString = false;
    } else if (c === '"') {
      inString = true;
      out += c;
    } else if (c === "/" && next === "/") {
      while (i < text.length && text[i] !== "\n") i++;
      out += "\n";
    } else if (c === "/" && next === "*") {
      i += 2;
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i++;
      i++;
    } else out += c;
  }
  return out;
}

// Returns { json, strict } where strict means the file is plain JSON and safe to rewrite.
function readJson(file) {
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    return { json: undefined, strict: false };
  }
  try {
    return { json: JSON.parse(text), strict: true };
  } catch {
    try {
      return { json: JSON.parse(stripComments(text)), strict: false };
    } catch {
      return { json: undefined, strict: false };
    }
  }
}

function findPacks(root) {
  const packs = [];
  const walk = (dir, depth) => {
    if (depth > 4) return;
    const manifest = path.join(dir, "manifest.json");
    if (fs.existsSync(manifest)) {
      const json = readJson(manifest).json;
      const types = (json?.modules ?? []).map((m) => m.type);
      packs.push({
        dir,
        isBehavior: types.includes("data") || types.includes("script"),
        isResource: types.includes("resources"),
        uuid: String(json?.header?.uuid ?? "").toLowerCase(),
        dependencies: (json?.dependencies ?? []).map((d) => String(d.uuid ?? "").toLowerCase()).filter(Boolean),
      });
      return;
    }
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory() && e.name !== "node_modules" && !e.name.startsWith("."))
        walk(path.join(dir, e.name), depth + 1);
    }
  };
  walk(root, 0);
  return packs;
}

function listJson(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listJson(full));
    else if (e.name.endsWith(".json")) out.push(full);
  }
  return out;
}

const baseName = (dir) =>
  path
    .basename(dir)
    .toLowerCase()
    .replace(/[_-]?(bp|rp|behavior_?packs?|resource_?packs?|behaviou?r|resources?)$/i, "");

function pairResourcePack(bp, resourcePacks) {
  return (
    resourcePacks.find((rp) => rp.uuid && bp.dependencies.includes(rp.uuid)) ??
    resourcePacks.find((rp) => baseName(rp.dir) === baseName(bp.dir)) ??
    (resourcePacks.length === 1 ? resourcePacks[0] : undefined)
  );
}

const titleCase = (id) =>
  id
    .split(":")
    .pop()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.folder) {
    console.log('Usage: node add-missing-names.mjs <project-folder> [--name "ns:id=Display Name" ...] [--dry-run]');
    process.exit(2);
  }
  const root = path.resolve(opts.folder);
  const packs = findPacks(root);
  const behaviorPacks = packs.filter((p) => p.isBehavior);
  const resourcePacks = packs.filter((p) => p.isResource);
  if (behaviorPacks.length === 0) {
    console.error(`No behavior packs found under ${root}.`);
    process.exit(2);
  }

  const verb = opts.dryRun ? "Would add" : "Added";
  const rel = (f) => path.relative(root, f);
  const nameFor = (id) => opts.names.get(id) ?? titleCase(id);
  const problems = [];
  const langByPack = new Map();

  for (const bp of behaviorPacks) {
    const langLines = [];

    for (const file of listJson(path.join(bp.dir, "entities"))) {
      const { json } = readJson(file);
      if (!json) {
        problems.push(`${rel(file)}: couldn't parse, so its name wasn't checked`);
        continue;
      }
      const desc = json["minecraft:entity"]?.description;
      if (!desc?.identifier || desc.identifier.startsWith("minecraft:")) continue;
      langLines.push(`entity.${desc.identifier}.name=${nameFor(desc.identifier)}`);
      if (desc.is_spawnable === true) {
        langLines.push(`item.spawn_egg.entity.${desc.identifier}.name=${nameFor(desc.identifier)} Spawn Egg`);
      }
    }

    for (const file of listJson(path.join(bp.dir, "blocks"))) {
      const { json } = readJson(file);
      if (!json) {
        problems.push(`${rel(file)}: couldn't parse, so its name wasn't checked`);
        continue;
      }
      const id = json["minecraft:block"]?.description?.identifier;
      if (id && !id.startsWith("minecraft:")) langLines.push(`tile.${id}.name=${nameFor(id)}`);
    }

    for (const file of listJson(path.join(bp.dir, "items"))) {
      const { json, strict } = readJson(file);
      const item = json?.["minecraft:item"];
      const id = item?.description?.identifier;
      if (!json) {
        problems.push(`${rel(file)}: couldn't parse, so its name wasn't checked`);
        continue;
      }
      if (!id || id.startsWith("minecraft:") || item.components?.["minecraft:display_name"]) continue;
      if (!strict) {
        problems.push(
          `${rel(file)}: has comments, so add "minecraft:display_name": { "value": "${nameFor(id)}" } by hand`
        );
        continue;
      }
      item.components ??= {};
      item.components["minecraft:display_name"] = { value: nameFor(id) };
      console.log(`${verb} display name "${nameFor(id)}" to ${rel(file)}`);
      if (!opts.dryRun) fs.writeFileSync(file, JSON.stringify(json, null, 2) + "\n");
    }

    if (langLines.length === 0) continue;
    const rp = pairResourcePack(bp, resourcePacks);
    if (!rp) {
      problems.push(
        `${rel(bp.dir)}: no matching resource pack found for its mob and block names. Add the resource pack's header.uuid to this behavior pack's dependencies, then run again.`
      );
      continue;
    }
    langByPack.set(rp.dir, [...(langByPack.get(rp.dir) ?? []), ...langLines]);
  }

  for (const [rpDir, langLines] of langByPack) {
    const textsDir = path.join(rpDir, "texts");
    const langFile = path.join(textsDir, "en_US.lang");
    const existing = fs.existsSync(langFile) ? fs.readFileSync(langFile, "utf8") : "";
    const existingKeys = new Set(
      existing
        .split(/\r?\n/)
        .map((l) => l.split("=")[0].trim())
        .filter(Boolean)
    );
    const toAdd = [...new Set(langLines)].filter((l) => !existingKeys.has(l.split("=")[0]));

    for (const line of toAdd) console.log(`${verb} ${line} to ${rel(langFile)}`);
    if (toAdd.length === 0) console.log(`All mob and block names already exist in ${rel(langFile)}.`);

    const languagesFile = path.join(textsDir, "languages.json");
    let languages = ["en_US"];
    let languagesChanged = !fs.existsSync(languagesFile);
    if (!languagesChanged) {
      const parsed = readJson(languagesFile).json;
      if (!Array.isArray(parsed)) {
        problems.push(`${rel(languagesFile)}: couldn't parse; make sure it's a JSON array that includes "en_US"`);
      } else if (!parsed.includes("en_US")) {
        languages = [...parsed, "en_US"];
        languagesChanged = true;
      }
    }
    if (languagesChanged) console.log(`${verb} "en_US" to ${rel(languagesFile)}`);

    if (!opts.dryRun) {
      if (toAdd.length > 0 || languagesChanged) fs.mkdirSync(textsDir, { recursive: true });
      if (toAdd.length > 0) {
        const prefix = existing && !existing.endsWith("\n") ? "\n" : "";
        fs.appendFileSync(langFile, prefix + toAdd.join("\n") + "\n");
      }
      if (languagesChanged) fs.writeFileSync(languagesFile, JSON.stringify(languages) + "\n");
    }
  }

  if (problems.length > 0) {
    console.error("\nNot everything could be named:");
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
}

main();
