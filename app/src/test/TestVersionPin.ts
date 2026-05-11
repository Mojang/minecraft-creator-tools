// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * TestVersionPin
 *
 * Centralizes the "what counts as the current Minecraft version" used by the
 * test suite so test baselines stay stable across upstream version bumps.
 *
 * # Why this exists
 *
 * Many validators embed the current Minecraft version (pulled from
 * `Database.getLatestVersionInfo`) into the messages they emit — for example:
 *
 *   "Behavior pack manifest (1.20.0) has a lower minor version number compared
 *    to the expected version (1.26.20) or its previous minor version"
 *
 * Without pinning, every product version bump (e.g. 1.26.10 → 1.26.20) would
 * silently invalidate every CLI scenario baseline that contains such a message.
 * That has historically been the source of one-off baseline refresh churn —
 * baselines get updated, but the underlying behavior never actually changed.
 *
 * # How it works
 *
 * `Database.getLatestVersionInfo` checks `process.env.MCT_TEST_PINNED_MC_VERSION`
 * (and `MCT_TEST_PINNED_MC_PREVIEW_VERSION`) before consulting the cached static
 * field or hitting the network. If set, it returns the pinned value and skips
 * the upstream fetch entirely.
 *
 * Test bootstrap files (`CommandLineTestHelpers.ts` for spawned-CLI tests, and
 * `TestPaths.createTestEnvironment` for in-process tests) call
 * `applyTestVersionPin()` at module load time. Spawned subprocesses inherit the
 * env vars automatically, so the pin propagates to `node ./toolbuild/jsn/cli/...`
 * invocations without any per-spawn plumbing.
 *
 * # Picking a value
 *
 * The pin currently matches the version embedded in the CommandLineTest
 * scenario baselines as of their last refresh. If you need to refresh baselines
 * to a different version (or move to a sentinel like `1.99.0` to make
 * "test pin" obvious in baseline output), update {@link TEST_PINNED_MC_VERSION}
 * here and re-run the affected scenarios with `MCT_REFRESH_BASELINES=1` (or
 * manually copy from `app/test/results/<scenario>/` to
 * `app/test/scenarios/<scenario>/`).
 *
 * The volatile-pattern regexes in {@link TestUtilities.volatilePatterns} remain
 * a safety net for any message wording the pin doesn't fully cover.
 */

/** Version returned for `MinecraftTrack.main` when tests are running. */
export const TEST_PINNED_MC_VERSION = "1.26.20";

/** Version returned for `MinecraftTrack.preview` when tests are running. */
export const TEST_PINNED_MC_PREVIEW_VERSION = "1.26.20.27";

/**
 * Sets `MCT_TEST_PINNED_MC_VERSION` / `MCT_TEST_PINNED_MC_PREVIEW_VERSION` on
 * `process.env` so the current process and any subprocess it spawns will see
 * a deterministic Minecraft version. Idempotent and safe to call multiple
 * times. Honors any value the caller has already set (e.g. for a one-off
 * refresh or local experimentation).
 */
export function applyTestVersionPin(): void {
  // Reach `process` via globalThis so this file compiles under tsconfigs
  // (notably tsconfig.test.json) that don't include @types/node.
  const proc = (globalThis as any).process as { env?: Record<string, string | undefined> } | undefined;

  if (!proc || !proc.env) {
    return;
  }

  if (!proc.env.MCT_TEST_PINNED_MC_VERSION) {
    proc.env.MCT_TEST_PINNED_MC_VERSION = TEST_PINNED_MC_VERSION;
  }

  if (!proc.env.MCT_TEST_PINNED_MC_PREVIEW_VERSION) {
    proc.env.MCT_TEST_PINNED_MC_PREVIEW_VERSION = TEST_PINNED_MC_PREVIEW_VERSION;
  }
}
