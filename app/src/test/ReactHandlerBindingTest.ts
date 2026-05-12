// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * ReactHandlerBindingTest.ts
 *
 * Systematic regression test for the production crash class:
 *
 *   "Uncaught TypeError: Cannot read properties of undefined (reading 'setState')"
 *
 * caused by wiring a class method as a JSX event handler (`onChange={this._foo}`)
 * without either binding it in the constructor or declaring it as an arrow class
 * property. When the host (e.g. MUI) invokes such a handler, `this` is undefined
 * and `this.setState(...)` throws.
 *
 * This test scans every `.tsx` file under `src/UX/**` and asserts, for each class
 * component, that every method referenced as a JSX event handler in the form
 * `onX={this._method}` is either:
 *
 *   1. Declared as an arrow class property:  `_method = (...) => { ... }`, or
 *   2. Bound in the constructor:             `this._method = this._method.bind(this);`
 *
 * Static text-based scanning (no React render, no DOM) so it runs cleanly under
 * the existing ts-mocha test config that excludes `src/UX/**` from compilation.
 *
 * NOTE: This is intentionally a lightweight static check rather than a TS lint
 * rule. If the project later adopts an ESLint plugin that enforces the same
 * invariant (e.g. `react/jsx-no-bind` plus arrow-property style), this test can
 * be retired.
 */

import { expect } from "chai";
import "mocha";
import * as fs from "fs";
import * as path from "path";

// Tests are run from the app/ folder. Avoid `__dirname` because mocha may load
// this file via the ESM loader under Node 22+, where __dirname is undefined.
const UX_ROOT = path.resolve(process.cwd(), "src/UX");

/** Recursively collect all .tsx files under `dir`. */
function collectTsxFiles(dir: string): string[] {
  const out: string[] = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectTsxFiles(full));
    } else if (entry.isFile() && entry.name.endsWith(".tsx")) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Strip `//` line comments and `/* … *\/` block comments from source so the
 * pattern checks below don't match commented-out JSX (e.g. legacy disabled
 * buttons). Naive but sufficient for static scanning — does not understand
 * strings, but JSX `onX={this._foo}` is unlikely to appear inside a quoted
 * string literal.
 */
function stripComments(source: string): string {
  // Block comments first (non-greedy, multi-line).
  let out = source.replace(/\/\*[\s\S]*?\*\//g, "");
  // Then line comments.
  out = out.replace(/(^|[^:])\/\/[^\n]*/g, "$1");
  return out;
}

/** Extract method names referenced as JSX event handlers: e.g. onChange={this._foo}. */
function findEventHandlerMethods(source: string): string[] {
  const re = /\b(?:on[A-Z][A-Za-z]*)\s*=\s*\{\s*this\.(_?[A-Za-z][A-Za-z0-9_]*)\s*\}/g;
  const found = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = re.exec(source)) !== null) {
    found.add(match[1]);
  }
  return [...found];
}

/** `this._foo = this._foo.bind(this);` */
function isBoundInConstructor(source: string, method: string): boolean {
  const escaped = method.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`this\\.${escaped}\\s*=\\s*this\\.${escaped}\\.bind\\(\\s*this\\s*\\)\\s*;`);
  return re.test(source);
}

/** `_foo = (...) => { ... }` or `_foo = async (...) => { ... }` (arrow class property). */
function isArrowProperty(source: string, method: string): boolean {
  const escaped = method.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Match: `<method> = (` or `<method> = async (` followed eventually by `=>`.
  // Restrict to a single line of context to avoid runaway matches.
  const re = new RegExp(`\\b${escaped}\\s*=\\s*(?:async\\s*)?\\([^)\\n]*\\)\\s*(?::[^=\\n]+)?=>`);
  return re.test(source);
}

interface UnboundFinding {
  file: string;
  method: string;
}

describe("React class components — JSX event handler binding", () => {
  let files: string[];

  before(() => {
    files = collectTsxFiles(UX_ROOT);
  });

  it("should find at least one .tsx file under src/UX/", () => {
    expect(files.length, `Expected to find .tsx files under ${UX_ROOT}`).to.be.greaterThan(0);
  });

  it("every JSX event handler `onX={this._method}` must be bound or an arrow property", () => {
    const findings: UnboundFinding[] = [];

    for (const file of files) {
      const rawSource = fs.readFileSync(file, "utf8");
      const source = stripComments(rawSource);
      const handlers = findEventHandlerMethods(source);
      for (const method of handlers) {
        if (!isBoundInConstructor(source, method) && !isArrowProperty(source, method)) {
          findings.push({ file: path.relative(process.cwd(), file), method });
        }
      }
    }

    expect(
      findings,
      "These methods are wired as JSX event handlers but are neither bound in the constructor " +
        "nor declared as arrow class properties — calling them will produce " +
        "`Cannot read properties of undefined (reading 'setState')`:\n" +
        findings.map((f) => `  - ${f.file}: this.${f.method}`).join("\n")
    ).to.deep.equal([]);
  });
});
