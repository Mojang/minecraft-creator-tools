// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import SemanticVersion from "./SemanticVersion";

/**
 * Minecraft version rules and special-case logic for version comparisons.
 *
 * Minecraft skipped minor versions 1.22 through 1.25, jumping directly from
 * 1.21 to 1.26. When validating that a creator's content is at version N or
 * N-1, we need to treat 1.21 as the predecessor of 1.26 rather than applying
 * simple arithmetic (1.26 - 1 = 1.25).
 *
 * This module provides a helper that returns the effective "previous" minor
 * version for a given current version, accounting for any skipped ranges,
 * plus helpers for reading and writing manifest versions.
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

/**
 * Returns a manifest version (such as min_engine_version or base_game_version) in the form the
 * manifest's top-level format_version calls for: format_version 3 and later require a semver
 * string ("1.26.50"), while earlier format versions use an array ([1, 26, 50]).
 *
 * Pass the field's current value so a new array keeps the comments inside the old one: a manifest
 * loaded with comments stores them as symbol properties on the array, and they'd otherwise be lost
 * when the array is replaced.
 */
export function getManifestVersionValue(
  manifestFormatVersion: unknown,
  version: number[],
  currentValue?: unknown
): number[] | string {
  if (typeof manifestFormatVersion === "number" && manifestFormatVersion >= 3) {
    return version.join(".");
  }

  const value = [...version];

  if (Array.isArray(currentValue)) {
    for (const symbol of Object.getOwnPropertySymbols(currentValue)) {
      Reflect.set(value, symbol, Reflect.get(currentValue, symbol));
    }
  }

  return value;
}

/**
 * Returns true if a manifest version, written as an array ([1, 26, 50]) or a string ("1.26.50"),
 * is newer than the given major.minor.patch version. Returns false when it can't be parsed.
 */
export function isManifestVersionNewer(version: unknown, than: number[]): boolean {
  let current: SemanticVersion | undefined;

  if (typeof version === "string") {
    current = SemanticVersion.fromString(version);
  } else if (Array.isArray(version) && version.every((part) => typeof part === "number")) {
    current = SemanticVersion.fromArray(version.slice(0, 3));
  }

  const target = SemanticVersion.fromArray(than);

  return current !== undefined && target !== undefined && current.compareTo(target) > 0;
}

/**
 * Returns whether an updater should set a manifest version to the target major.minor.patch
 * version: when it's missing, isn't a [major, minor, patch(, build)] array, or differs. With
 * keepNewerVersions, a version newer than the target is kept.
 */
export function shouldReplaceManifestVersion(version: unknown, target: number[], keepNewerVersions = false): boolean {
  if (keepNewerVersions && isManifestVersionNewer(version, target)) {
    return false;
  }

  return !(
    Array.isArray(version) &&
    version.length >= 3 &&
    version.length <= 4 &&
    version[0] === target[0] &&
    version[1] === target[1] &&
    version[2] === target[2]
  );
}
