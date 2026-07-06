// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * CssOpacityTextTest.ts
 *
 * Lint-style regression guard against the "opacity on text" anti-pattern.
 *
 * Dimming text with `opacity` (instead of choosing a contrast-safe color) silently
 * drops the rendered contrast below the WCAG 1.4.3 minimum (4.5:1). Because opacity
 * composites the text over whatever is behind it, the failure depends on the surface
 * and is easy to miss in review. Several accessibility bugs in the Content Wizard came
 * from exactly this (field hints, trait group headers, the section count, the step
 * indicator, the selected-trait description). The durable fix is always to
 * de-emphasize via a color token + font size — never `opacity` on a text rule.
 *
 * This scans the swept `.css` files under `src/UX/**` (see ENFORCED_FILES) and fails
 * if a rule declares BOTH `opacity` (strictly between 0 and 1) and `font-size` (the
 * strongest "this paints sized glyphs/text" signal), unless the rule is explicitly
 * allow-listed below.
 *
 * Allow-listed cases are decorative glyphs (icon fonts, not prose) or disabled-state
 * controls (WCAG 1.4.3 exempts disabled UI). The guard ratchets at FILE granularity:
 * an app-wide scan still reports dozens of pre-existing opacity-on-text rules across
 * the editor CSS, so rather than a brittle per-rule baseline, ENFORCED_FILES lists the
 * areas that have been swept. Add a file here once its opacity-on-text rules are fixed;
 * do NOT remove a file to make a fresh violation pass.
 *
 * Static text scan (no DOM, no src/UX imports), so it runs under the standard
 * ts-mocha config that excludes src/UX from compilation.
 */

/// <reference types="node" />

import { expect } from "chai";
import "mocha";
import * as fs from "fs";
import * as path from "path";

// Tests run from the app/ folder.
const UX_ROOT = path.resolve(process.cwd(), "src/UX");

interface CssRule {
  selector: string;
  body: string;
}

/** Recursively collect all .css files under `dir`. */
function collectCssFiles(dir: string): string[] {
  const out: string[] = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectCssFiles(full));
    } else if (entry.isFile() && entry.name.endsWith(".css")) {
      out.push(full);
    }
  }
  return out;
}

/** Strip CSS block comments so commented-out declarations don't trip the scan. */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/**
 * Minimal rule splitter returning innermost `{ selector, body }` pairs. The regex
 * only matches braces with no nested braces between them, so rules wrapped in
 * `@media`/`@supports`/`@keyframes` are still captured (the wrapper prelude simply
 * never forms a clean match). Sufficient for our flat component CSS.
 */
function parseRules(css: string): CssRule[] {
  const rules: CssRule[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    const selector = m[1].trim();
    const body = m[2].trim();
    if (!selector || selector.startsWith("@")) {
      continue;
    }
    rules.push({ selector, body });
  }
  return rules;
}

/** True if `body` sets `opacity` to a value strictly between 0 and 1. */
function dimsViaOpacity(body: string): boolean {
  const m = body.match(/(?:^|[;{]\s*)opacity\s*:\s*([0-9.]+)/i);
  if (!m) {
    return false;
  }
  const v = parseFloat(m[1]);
  return v > 0 && v < 1;
}

/** True if `body` declares a `font-size` (our proxy for "this rule paints text"). */
function paintsText(body: string): boolean {
  return /(?:^|[;{]\s*)font-size\s*:/i.test(body);
}

/**
 * Files whose opacity-on-text rules have been swept and must stay clean. Grow this
 * set as more areas are cleaned (matched by basename). Keep it sorted.
 */
const ENFORCED_FILES = new Set<string>(["BlockTypeLivePreview.css", "ContentWizard.css", "EntityTypeLivePreview.css"]);

/**
 * Rules that legitimately combine opacity with font-size:
 *  - decorative icon glyphs (icon fonts carry font-size but aren't prose), and
 *  - disabled-state controls (exempt from WCAG 1.4.3).
 * Matched by (file basename, selector substring).
 */
const ALLOWLIST: { file: string; selector: string }[] = [
  { file: "ContentWizard.css", selector: ".cwiz-trait-group-icon" }, // decorative ✦ glyph
  { file: "ContentWizard.css", selector: ".cwiz-section-item-icon" }, // decorative item glyph
];

function isAllowlisted(file: string, selector: string): boolean {
  const base = path.basename(file);
  return ALLOWLIST.some((a) => base === a.file && selector.includes(a.selector));
}

describe("CSS opacity-on-text guard (WCAG 1.4.3)", () => {
  it("swept UX CSS files don't dim text with opacity (use a contrast-safe color token + font size)", () => {
    const files = collectCssFiles(UX_ROOT).filter((f) => ENFORCED_FILES.has(path.basename(f)));
    expect(files.length, "expected to find the enforced UX .css files").to.equal(ENFORCED_FILES.size);

    const violations: string[] = [];
    for (const file of files) {
      const css = stripComments(fs.readFileSync(file, "utf8"));
      for (const rule of parseRules(css)) {
        if (!dimsViaOpacity(rule.body) || !paintsText(rule.body)) {
          continue;
        }
        if (/disabled/i.test(rule.selector)) {
          continue;
        }
        if (isAllowlisted(file, rule.selector)) {
          continue;
        }
        violations.push(`${path.relative(process.cwd(), file).replace(/\\/g, "/")}  {${rule.selector}}`);
      }
    }

    expect(
      violations,
      `Found opacity-on-text rule(s). De-emphasize with a muted color token + font size, not opacity:\n  ${violations.join(
        "\n  "
      )}\n`
    ).to.deep.equal([]);
  });
});
