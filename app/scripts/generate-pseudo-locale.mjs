/**
 * Generate a pseudo-locale JSON file for localization coverage testing.
 *
 * Takes en_US.json and wraps every translatable value with ⟦…⟧ markers.
 * ICU placeholders like {count}, {name}, and plural/select blocks are preserved
 * inside the markers so react-intl still parses them correctly.
 *
 * Usage:  node scripts/generate-pseudo-locale.mjs
 * Output: src/locales/pseudo.json
 *
 * When the app runs with locale=pseudo, every localized string will display
 * with ⟦⟧ brackets. Any visible text WITHOUT those brackets is a hardcoded
 * string that was missed during localization.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcPath = path.resolve(__dirname, "../src/locales/en_US.json");
const outPath = path.resolve(__dirname, "../src/locales/pseudo.json");

const enUS = JSON.parse(fs.readFileSync(srcPath, "utf8"));
const pseudo = {};

for (const [key, value] of Object.entries(enUS)) {
  // Skip translator comment keys
  if (key.startsWith("_")) continue;

  if (typeof value !== "string") {
    pseudo[key] = value;
    continue;
  }

  // Wrap the value with markers.
  // We keep ICU syntax functional by wrapping the entire string.
  pseudo[key] = `\u27E6${value}\u27E7`;
}

fs.writeFileSync(outPath, JSON.stringify(pseudo, null, 2) + "\n", "utf8");

const count = Object.keys(pseudo).length;
console.log(`Generated pseudo-locale with ${count} entries -> ${outPath}`);
