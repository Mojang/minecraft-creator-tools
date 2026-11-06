// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Shared contracts for program-driven structure generation.
 *
 * These cross the QuickJS sandbox boundary, so they are dependency-free plain
 * data. Cells use "clipboard order" `(y*sizeZ + z)*sizeX + x` everywhere.
 *
 * See StructureProgramRunner.ts for the architecture overview.
 */

/** Generation mode for one build program run. */
export type StructureBuildMode = "generate" | "edit";

/**
 * Dense base contents made available to `api.get` in edit mode. `indices[cell]`
 * is an index into `names`/`statesJson`, or `-1` for air/void.
 */
export interface IStructureBaseVolume {
  readonly sizeX: number;
  readonly sizeY: number;
  readonly sizeZ: number;
  readonly names: readonly string[];
  readonly statesJson: readonly string[];
  readonly indices: Int32Array;
}

/** Options for one build program run. */
export interface IStructureBuilderOptions {
  readonly mode: StructureBuildMode;
  /** Edit mode: the fixed volume size. Generate mode: ignored (program calls declareSize). */
  readonly sizeX?: number;
  readonly sizeY?: number;
  readonly sizeZ?: number;
  /** Seed for the deterministic PRNG (`api.random`/`api.pick`). */
  readonly seed?: number;
  /** Max number of placed cells before the run fails. */
  readonly opBudget?: number;
  /** Max size per axis honored by `api.declareSize`. */
  readonly maxAxis?: number;
  /** Max total cells (`w * h * d`) accepted by `api.declareSize`. */
  readonly maxVolume?: number;
}

/**
 * The packed journal of writes a build program produced. Coordinates and table
 * indices are parallel arrays in placement order, so last-write-wins holds on
 * replay. `names`/`statesJson` are the interned string table; `statesJson[i] === ""`
 * means "no states".
 */
export interface IStructureBuilderJournal {
  readonly xs: Int32Array;
  readonly ys: Int32Array;
  readonly zs: Int32Array;
  readonly tableIdx: Int32Array;
  readonly names: readonly string[];
  readonly statesJson: readonly string[];
  /** Number of writes dropped for being outside the volume. */
  readonly oobCount: number;
  readonly sizeX: number;
  readonly sizeY: number;
  readonly sizeZ: number;
}

/**
 * Why a run failed.
 *   - validation: the request or program source was rejected before running.
 *   - syntax: the program didn't parse.
 *   - runtime: the program threw, or produced an unusable result.
 *   - timeout / budget / memory: the program hit a resource limit.
 *   - busy: too many programs are already running or queued; retry shortly.
 *   - internal: the host failed (not the program's fault); retrying may help.
 */
export type StructureProgramFailureReason =
  | "validation"
  | "syntax"
  | "runtime"
  | "timeout"
  | "budget"
  | "memory"
  | "busy"
  | "internal";

/** Result of running a build program in the sandbox. `logs` holds captured console output. */
export type StructureSandboxResult =
  | { readonly ok: true; readonly journal: IStructureBuilderJournal; readonly logs: string[] }
  | {
      readonly ok: false;
      readonly reason: StructureProgramFailureReason;
      readonly detail: string;
      readonly logs: string[];
    };

/** Resource limits for a sandboxed run. */
export interface IStructureSandboxLimits {
  /** Wall-clock deadline for the whole run. */
  readonly timeoutMs?: number;
  /** QuickJS heap limit in bytes. */
  readonly memoryLimitBytes?: number;
  /** QuickJS stack limit in bytes. */
  readonly maxStackSizeBytes?: number;
  /** Max number of placed cells. */
  readonly opBudget?: number;
}

export const STRUCTURE_PROGRAM_DEFAULTS = {
  timeoutMs: 10_000,
  memoryLimitBytes: 256 * 1024 * 1024,
  maxStackSizeBytes: 1024 * 1024,
  opBudget: 4_000_000,
  maxAxis: 128,
  // Realized structures cost roughly 400 bytes per cell on the host (one Block
  // object each), so cap the volume at about 1M cells (e.g. 128 x 64 x 128).
  maxVolume: 128 * 64 * 128,
  seed: 0x9e3779b9,
} as const;

/**
 * Bounds on the block table (the interned `(name, states)` pairs) a program can
 * produce. The DSL enforces them inside the sandbox before anything is
 * serialized, and the host checks them again before realizing a structure.
 * StructureBuilderDsl.ts inlines the same numbers because it can't import;
 * keep them in sync (tests compare the two).
 */
export const STRUCTURE_TABLE_LIMITS = {
  /** Max characters in a block name, after adding the `minecraft:` prefix. */
  maxBlockNameLength: 256,
  /** Max block states on one block. */
  maxStateKeys: 32,
  /** Max characters in a block state name. */
  maxStateKeyLength: 64,
  /** Max characters in a string block state value. */
  maxStateStringLength: 256,
  /** Max characters in one entry's canonical states JSON. */
  maxStatesJsonLength: 4096,
  /** Max distinct `(name, states)` pairs. */
  maxTableEntries: 4096,
  /** Max total characters across all names and states JSON in the table. */
  maxTableChars: 1024 * 1024,
} as const;

/** Block state names that could reach object prototypes, so they're never accepted. */
export const STRUCTURE_FORBIDDEN_STATE_KEYS: readonly string[] = ["__proto__", "constructor", "prototype"];

/** Marker prefix used by the in-sandbox DSL for budget failures. */
export const STRUCTURE_BUDGET_ERROR_PREFIX = "BudgetError: ";

/** Thrown when a program touches `Date`, which the sandbox removes so replays are exact. */
export const STRUCTURE_NO_CLOCK_MESSAGE =
  "Date isn't available in structure programs, so the same program and seed always rebuild the same " +
  "structure. Use api.random() for variation.";
