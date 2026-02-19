// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Minecraft version rules and special-case logic for version comparisons.
 *
 * Minecraft skipped minor versions 1.22 through 1.25, jumping directly from
 * 1.21 to 1.26. When validating that a creator's content is at version N or
 * N-1, we need to treat 1.21 as the predecessor of 1.26 rather than applying
 * simple arithmetic (1.26 - 1 = 1.25).
 *
 * This module provides a helper that returns the effective "previous" minor
 * version for a given current version, accounting for any skipped ranges.
 */

/**
 * Table of skipped minor-version ranges within a given major version.
 * Each entry means: for major version `major`, minor versions from
 * `skippedMinStart` through `skippedMinEnd` (inclusive) were never released,
 * so the effective predecessor of `skippedMinEnd + 1` is `skippedMinStart - 1`.
 */
const SKIPPED_MINOR_RANGES: { major: number; skippedMinStart: number; skippedMinEnd: number }[] = [
  // Minecraft jumped from 1.21 directly to 1.26
  { major: 1, skippedMinStart: 22, skippedMinEnd: 25 },
];

/**
 * Returns the effective previous minor version for a given major.minor,
 * taking into account any skipped Minecraft version ranges.
 *
 * For example, if current is 1.26, the effective previous minor is 21
 * (not 25, because 1.22–1.25 were skipped).
 *
 * If there is no skip affecting the given version, it simply returns
 * `minor - 1`.
 */
export function getEffectivePreviousMinor(major: number, minor: number): number {
  for (const range of SKIPPED_MINOR_RANGES) {
    if (major === range.major && minor === range.skippedMinEnd + 1) {
      // The current version sits right after a skipped range, so the
      // real predecessor is the version just before the skip started.
      return range.skippedMinStart - 1;
    }
  }

  return minor - 1;
}

/**
 * Returns true if `candidateMinor` should be considered "too old" relative
 * to `currentMinor` for the given `major` version — i.e., it is older than
 * the N-1 window once skipped versions are taken into account.
 *
 * This replaces the naïve check `candidateMinor < currentMinor - 1`.
 */
export function isMinorVersionTooOld(major: number, currentMinor: number, candidateMinor: number): boolean {
  const effectivePrev = getEffectivePreviousMinor(major, currentMinor);
  return candidateMinor < effectivePrev;
}
