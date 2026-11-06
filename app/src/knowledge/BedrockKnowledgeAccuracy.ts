// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Accuracy gate for Bedrock knowledge updates: compares the diagnostics a corpus produced with the
 * current knowledge against those it produces with the updated knowledge.
 *
 * Occurrences are compared individually, not as per-code totals, so fixing one finding while
 * introducing a different one with the same code still fails. The fingerprint includes the column
 * range, so a finding that moves to another argument on the same line is new. It leaves out the
 * message because messages can list knowledge data (expected enum values) that legitimately change.
 */

export interface IDiagnosticOccurrence {
  code: string;
  /** Corpus-relative path with forward slashes. */
  file: string;
  line: number;
  /** 1-based column range of the diagnostic on the line. */
  startColumn: number;
  endColumn: number;
  text: string;
}

export function getDiagnosticFingerprint(o: IDiagnosticOccurrence): string {
  return `${o.code}|${o.file}|${o.line}:${o.startColumn}-${o.endColumn}|${o.text.trim()}`;
}

/**
 * Occurrences with one of the gated codes that are in `after` but not in `before`. Compared as
 * multisets, so a second identical finding on the same line also counts as new.
 */
export function findNewDiagnosticOccurrences(
  before: IDiagnosticOccurrence[],
  after: IDiagnosticOccurrence[],
  gatedCodes: string[]
): IDiagnosticOccurrence[] {
  const gated = new Set(gatedCodes);
  const remaining = new Map<string, number>();
  for (const o of before) {
    const key = getDiagnosticFingerprint(o);
    remaining.set(key, (remaining.get(key) ?? 0) + 1);
  }
  const added: IDiagnosticOccurrence[] = [];
  for (const o of after) {
    const key = getDiagnosticFingerprint(o);
    const count = remaining.get(key) ?? 0;
    if (count > 0) {
      remaining.set(key, count - 1);
    } else if (gated.has(o.code)) {
      added.push(o);
    }
  }
  return added;
}
