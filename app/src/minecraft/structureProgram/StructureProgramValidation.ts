// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Fast static preflight for `build(api)` programs.
 *
 * This is NOT the security boundary — the QuickJS sandbox is. The goal is to
 * reject obviously-wrong output early with a clear, actionable reason so an
 * agent can retry, before paying for a sandbox run.
 */

export const MAX_STRUCTURE_PROGRAM_LENGTH = 200_000;

const BUILD_FUNCTION_RE = /\bfunction\s+build\s*\(\s*api\b/;
const BUILD_ARROW_RE = /\bbuild\s*=\s*\(?\s*api\s*\)?\s*=>/;
const MODULE_SYNTAX_RE = /\bimport\s*\(|\bimport\s+[\w{*]|\brequire\s*\(|\bexport\s+/;
const ASYNC_RE = /\basync\b|\bawait\b/;

const DISALLOWED_IDENTIFIERS = [
  "fetch",
  "XMLHttpRequest",
  "WebSocket",
  "importScripts",
  "setTimeout",
  "setInterval",
] as const;

const DISALLOWED_IDENTIFIER_RES = DISALLOWED_IDENTIFIERS.map((name) => ({
  name,
  re: new RegExp(`\\b${name}\\b`),
}));

export interface IStructureProgramValidationResult {
  readonly ok: boolean;
  /** Present when ok === false: a short agent-facing reason. */
  readonly error?: string;
}

export default class StructureProgramValidation {
  static validate(code: string | undefined): IStructureProgramValidationResult {
    if (code === undefined || code.trim().length === 0) {
      return { ok: false, error: "No build program was provided." };
    }

    if (code.length > MAX_STRUCTURE_PROGRAM_LENGTH) {
      return {
        ok: false,
        error: `The build program is too large (${code.length} characters; max ${MAX_STRUCTURE_PROGRAM_LENGTH}).`,
      };
    }

    const stripped = StructureProgramValidation.stripCommentsAndStrings(code);

    if (!BUILD_FUNCTION_RE.test(stripped) && !BUILD_ARROW_RE.test(stripped)) {
      return { ok: false, error: "The program must define a function build(api) { ... }." };
    }

    if (MODULE_SYNTAX_RE.test(stripped)) {
      return { ok: false, error: "The program must not use import/require/export." };
    }

    if (ASYNC_RE.test(stripped)) {
      return { ok: false, error: "The program must be synchronous (no async/await)." };
    }

    for (const { name, re } of DISALLOWED_IDENTIFIER_RES) {
      if (re.test(stripped)) {
        return {
          ok: false,
          error: `The program must not use '${name}'. It runs in a sandbox with only api.* and plain JavaScript.`,
        };
      }
    }

    return { ok: true };
  }

  /**
   * Blanks out comments and string/template literal contents so checks don't
   * trip on words like "import" in a comment. Approximate (regex literals and
   * template substitutions are treated as plain code/strings), which is fine for
   * a preflight.
   */
  static stripCommentsAndStrings(code: string): string {
    let out = "";
    let i = 0;
    while (i < code.length) {
      const c = code[i];
      const next = code[i + 1];
      if (c === "/" && next === "/") {
        while (i < code.length && code[i] !== "\n") {
          i++;
        }
      } else if (c === "/" && next === "*") {
        const end = code.indexOf("*/", i + 2);
        i = end < 0 ? code.length : end + 2;
        out += " ";
      } else if (c === '"' || c === "'" || c === "`") {
        out += c;
        i++;
        while (i < code.length && code[i] !== c) {
          if (code[i] === "\\") {
            i++;
          } else if (code[i] === "\n" && c !== "`") {
            break;
          }
          i++;
        }
        out += c;
        i++;
      } else {
        out += c;
        i++;
      }
    }
    return out;
  }

  /**
   * Pull the program out of a markdown reply if an agent wrapped it in a
   * fenced block. Keeps the last ```js/```javascript block that defines build.
   */
  static extractProgram(text: string): string {
    const fenceRe = /```(?:js|javascript)?\s*\n([\s\S]*?)```/gi;
    let last: string | undefined;
    let match: RegExpExecArray | null;
    while ((match = fenceRe.exec(text)) !== null) {
      if (BUILD_FUNCTION_RE.test(match[1]) || BUILD_ARROW_RE.test(match[1])) {
        last = match[1];
      }
    }
    return last !== undefined ? last : text;
  }
}
