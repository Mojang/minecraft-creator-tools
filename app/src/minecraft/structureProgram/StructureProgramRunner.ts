// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * STRUCTURE PROGRAMS — program-driven .mcstructure generation
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Instead of describing every block (the IBlockVolume character grid), an agent
 * or user writes a short JavaScript program:
 *
 *     function build(api) {
 *       api.declareSize(7, 5, 7);
 *       api.fill(0, 0, 0, 6, 0, 6, "stone");
 *       api.hollowBox(0, 1, 0, 6, 3, 6, "oak_planks");
 *     }
 *
 * The program's size is independent of the structure's size, so big or
 * symmetric builds stay small and readable, and an edit ("make the roof blue")
 * is a few lines instead of re-sending the whole volume.
 *
 * ## Pipeline (this file is the single entry point for MCP and CLI)
 *
 *   code ──► StructureProgramValidation   fast static preflight (clear errors)
 *        ──► StructureProgramSandbox       QuickJS WASM: runs the DSL + program,
 *                                          returns a packed journal of writes
 *        ──► StructureProgramRealizer      journal (+ base) ──► Structure
 *        ──► Structure.getMCStructureBytes NBT writer
 *
 * `run` is gated: at most `maxConcurrentRuns` programs run at once and at most
 * `maxQueuedRuns` wait for a slot; anything beyond that fails fast with reason
 * "busy". A slot is released exactly once per run (in a finally), whatever the
 * outcome, and `shutdown()` fails waiting runs and terminates every worker.
 *
 * Related files (all in this folder unless noted):
 *   - StructureBuilderDsl.ts   the `api` object. Serialized with toString() and
 *                              evaluated inside QuickJS, so it must stay
 *                              self-contained (no imports, no helpers).
 *   - StructureProgramTypes.ts shared contracts and default limits.
 *   - StructureVolumeCodec.ts  palette + run-length text encoding of a volume,
 *                              used to show an agent a structure it will edit.
 *   - ../Structure.ts          NBT reader/writer (void vs. air, entities,
 *                              palette version).
 *   - local/MinecraftMcpServer.ts  `designStructure` MCP tool (`program` input).
 *   - cli/commands/render/BuildStructureCommand.ts  `mct buildstructure --program`.
 *   - docs/StructurePrograms.md    user-facing documentation.
 *
 * ## Coordinates and cell order
 *
 * Program coordinates are local: (0,0,0) is the structure's minimum corner,
 * +x east, +y up, +z south. The journal and base volume use "clipboard order"
 * `(y*sizeZ + z)*sizeX + x`. The .mcstructure file uses `(x*sizeY + y)*sizeZ + z`
 * (Z fastest); only Structure.ts deals with that order.
 *
 * ## Modes
 *
 *   - generate: the program calls api.declareSize(w, h, d) (max 128 per axis, ~1M cells total)
 *     before placing blocks.
 *   - edit: an existing structure is the base. Its size is fixed, api.get reads
 *     its contents, and untouched cells keep their block.
 *
 * ## Air semantics
 *
 *   - Unwritten cells are structure void: placing the structure leaves the
 *     world's blocks there alone.
 *   - Cells explicitly set to air (api.set(..., "air"), api.clear) carve space.
 *
 * ## Determinism
 *
 * All randomness goes through one seeded PRNG (api.random, api.pick, and
 * Math.random inside the sandbox), and the sandbox removes `Date`, its only
 * clock, so the same program and seed always produce the same structure.
 *
 * ## Sandbox threat model
 *
 * Programs are untrusted (MCP can be served over HTTP by `mct serve`). There
 * are two layers (see StructureProgramSandbox.ts):
 *   - Security: QuickJS. Each call gets a fresh QuickJS runtime with a
 *     wall-clock deadline, a heap limit, a stack limit, and a block budget. The
 *     guest gets no host objects (no `require`, `process`, file system, or
 *     network), and the host validates the journal it returns before using it.
 *     A plain Node worker or `vm` context isn't a boundary because host
 *     functions leak `Function` via `.constructor`.
 *   - Availability: a worker thread. QuickJS runs synchronously, so it runs in
 *     a `worker_threads` Worker that the host terminates if it outlives the
 *     deadline. The MCP server and CLI keep answering while a program runs.
 */

import Structure from "../Structure";
import StructureProgramSandbox from "./StructureProgramSandbox";
import StructureProgramValidation from "./StructureProgramValidation";
import StructureProgramRealizer, { IRealizedStructure } from "./StructureProgramRealizer";
import StructureVolumeCodec from "./StructureVolumeCodec";
import {
  IStructureSandboxLimits,
  STRUCTURE_PROGRAM_DEFAULTS,
  StructureBuildMode,
  StructureProgramFailureReason,
} from "./StructureProgramTypes";

export interface IStructureProgramRunRequest {
  readonly code: string;
  readonly seed?: number;
  /** When present, runs in edit mode against this structure. */
  readonly base?: Structure;
  readonly limits?: IStructureSandboxLimits;
}

export interface IStructureProgramRunSuccess {
  readonly ok: true;
  readonly mode: StructureBuildMode;
  readonly seed: number;
  readonly realized: IRealizedStructure;
  /** Number of block writes the program made (including overwrites). */
  readonly writeCount: number;
  /** Writes dropped for being outside the structure. */
  readonly oobCount: number;
  readonly logs: string[];
  /** Agent-facing notes about things that didn't fail the build but may be wrong. */
  readonly warnings: string[];
}

export interface IStructureProgramRunFailure {
  readonly ok: false;
  readonly reason: StructureProgramFailureReason;
  readonly detail: string;
  readonly logs: string[];
}

export type StructureProgramRunResult = IStructureProgramRunSuccess | IStructureProgramRunFailure;

/**
 * Agent-facing API reference and craft rules. Shared by the MCP tool
 * description, CLI help, and docs so they stay in sync.
 */
export const STRUCTURE_PROGRAM_API_REFERENCE = `Write one function: function build(api) { ... }. Only api.* calls and plain JavaScript (Math, loops, arrays); no import/require/async, fetch, or timers.
Coordinates are local: (0,0,0) is the minimum corner, +y is up, +z is south. Writes outside the size are dropped. Later writes to a cell overwrite earlier ones.
api:
- api.sizeX / api.sizeY / api.sizeZ: the size (read-only).
- api.declareSize(w, h, d): new structures only; call it first. Max 128 per axis and 1,048,576 cells total (e.g. 128 x 64 x 128). Ignored when editing (size is fixed).
- api.set(x, y, z, name, states?): one block. name like "stone" or "minecraft:oak_log"; states like { pillar_axis: "y" }.
- api.get(x, y, z) -> name; api.getStates(x, y, z) -> states object or undefined. Reads your writes, else the existing structure when editing, else "minecraft:air".
- api.fill(x1,y1,z1, x2,y2,z2, name, states?): solid box (any corner order).
- api.hollowBox(...same...): six outer faces. api.walls(...same...): four vertical sides.
- api.clear(x1,y1,z1, x2,y2,z2): set to air (carves space when placed).
- api.line(x1,y1,z1, x2,y2,z2, name, states?): 3D line.
- api.cylinder(cx, y, cz, radius, height, name, states?, hollow?); api.sphere(cx, cy, cz, radius, name, states?, hollow?).
- api.random() -> [0,1): seeded (Math.random uses the same seed; Date isn't available). api.pick(a, b, ...) -> token that picks a random member each time it is placed; members are "name" or ["name", states].
- console.log(...) output is returned for debugging.
Air: cells you never write are structure void (the world keeps its blocks when placed); cells set to air carve space.
Craft rules: build mass with a few fill/hollowBox calls, then detail with slabs, stairs (with facing states), fences, panes, trapdoors. Put ground structures' base at y=0. Doors need a 2-tall opening; torches, ladders, and plants need a solid block to attach to. Leave interiors hollow and add light (lantern, glowstone). Use modern vanilla names (oak_planks, blue_wool, stone_bricks); unknown minecraft: names become stone and are reported.
When editing, read with api.get and change only what's needed; untouched cells keep their block.
Example:
function build(api) {
  api.declareSize(7, 5, 7);
  api.fill(0, 0, 0, 6, 0, 6, "cobblestone");
  api.hollowBox(0, 1, 0, 6, 3, 6, "oak_planks");
  api.clear(3, 1, 0, 3, 2, 0);
  api.set(3, 1, 3, "lantern");
  for (let x = 0; x <= 6; x++) api.fill(x, 4, 0, x, 4, 6, api.pick("oak_slab", "spruce_slab"));
}`;

export default class StructureProgramRunner {
  /**
   * Process-wide cap on programs being run and realized at once. Each run can
   * use a worker thread, a QuickJS heap, and dense host arrays, so unbounded
   * parallel requests (for example over `mct serve`) could exhaust memory.
   */
  static maxConcurrentRuns = 2;
  /** Runs that may wait for a slot; more than this fail fast with "busy". */
  static maxQueuedRuns = 8;

  private static _activeRuns = 0;
  private static _waiters: Array<(granted: boolean) => void> = [];

  /** Number of runs holding a slot (for tests). */
  static get activeRunCount(): number {
    return StructureProgramRunner._activeRuns;
  }

  /** Number of runs waiting for a slot (for tests). */
  static get queuedRunCount(): number {
    return StructureProgramRunner._waiters.length;
  }

  /**
   * Fails queued runs and terminates running sandbox workers. Runs already
   * in progress resolve with a failure.
   */
  static async shutdown(): Promise<void> {
    const waiters = StructureProgramRunner._waiters.splice(0, StructureProgramRunner._waiters.length);
    for (const waiter of waiters) {
      waiter(false);
    }
    await StructureProgramSandbox.shutdown();
  }

  static async run(request: IStructureProgramRunRequest): Promise<StructureProgramRunResult> {
    const code = StructureProgramValidation.extractProgram(request.code);
    const validation = StructureProgramValidation.validate(code);
    if (!validation.ok) {
      return { ok: false, reason: "validation", detail: validation.error || "Invalid program.", logs: [] };
    }

    if (request.base) {
      const sizeError = StructureProgramRunner.checkEditableSize(request.base);
      if (sizeError) {
        return { ok: false, reason: "validation", detail: sizeError, logs: [] };
      }
    }

    const slot = await StructureProgramRunner._acquireSlot();
    if (slot !== "granted") {
      return {
        ok: false,
        reason: slot === "busy" ? "busy" : "internal",
        detail:
          slot === "busy"
            ? "Too many structure programs are running right now. Retry shortly."
            : "The structure builder is shutting down.",
        logs: [],
      };
    }

    try {
      return await StructureProgramRunner._runInSlot(request, code);
    } finally {
      StructureProgramRunner._releaseSlot();
    }
  }

  private static async _acquireSlot(): Promise<"granted" | "busy" | "shutdown"> {
    if (StructureProgramRunner._activeRuns < StructureProgramRunner.maxConcurrentRuns) {
      StructureProgramRunner._activeRuns++;
      return "granted";
    }
    if (StructureProgramRunner._waiters.length >= StructureProgramRunner.maxQueuedRuns) {
      return "busy";
    }
    // A releasing run hands its slot straight to the next waiter, so
    // _activeRuns doesn't change on a handoff.
    const granted = await new Promise<boolean>((resolve) => StructureProgramRunner._waiters.push(resolve));
    return granted ? "granted" : "shutdown";
  }

  private static _releaseSlot(): void {
    const next = StructureProgramRunner._waiters.shift();
    if (next) {
      next(true);
    } else {
      StructureProgramRunner._activeRuns--;
    }
  }

  private static async _runInSlot(
    request: IStructureProgramRunRequest,
    code: string
  ): Promise<StructureProgramRunResult> {
    const seed = (request.seed ?? STRUCTURE_PROGRAM_DEFAULTS.seed) >>> 0;

    const base = request.base ? StructureProgramRealizer.baseFromStructure(request.base) : undefined;
    if (request.base && !base) {
      return { ok: false, reason: "validation", detail: "The structure to edit has no block data.", logs: [] };
    }
    const mode: StructureBuildMode = base ? "edit" : "generate";

    const sandboxResult = await StructureProgramSandbox.run({
      code,
      options: { mode, seed },
      base: base?.volume,
      limits: request.limits,
    });

    if (sandboxResult.ok === false) {
      return sandboxResult;
    }

    const journal = sandboxResult.journal;

    if (mode === "generate" && (journal.sizeX <= 0 || journal.sizeY <= 0 || journal.sizeZ <= 0)) {
      return {
        ok: false,
        reason: "runtime",
        detail: "The program didn't choose a size. Call api.declareSize(width, height, depth) first.",
        logs: sandboxResult.logs,
      };
    }

    let realized: IRealizedStructure;
    try {
      realized = StructureProgramRealizer.realize(journal, base);
    } catch (e: unknown) {
      return {
        ok: false,
        reason: "runtime",
        detail: `The structure couldn't be built from the program's result: ${e instanceof Error ? e.message : String(e)}`,
        logs: sandboxResult.logs,
      };
    }
    const warnings: string[] = [];

    if (mode === "generate" && realized.blockCount === 0) {
      return {
        ok: false,
        reason: "runtime",
        detail: "The program ran but placed no blocks.",
        logs: sandboxResult.logs,
      };
    }

    if (mode === "edit" && journal.xs.length === 0) {
      warnings.push("The program made no changes to the structure.");
    }

    if (realized.unknownNames.length > 0) {
      warnings.push(
        `Unknown vanilla block names were replaced with minecraft:stone: ${realized.unknownNames.join(", ")}.`
      );
    }

    if (journal.oobCount > 0) {
      warnings.push(
        `${journal.oobCount} block write(s) were outside the ${realized.sizeX}×${realized.sizeY}×${realized.sizeZ} structure and were dropped.`
      );
    }

    return {
      ok: true,
      mode,
      seed,
      realized,
      writeCount: journal.xs.length,
      oobCount: journal.oobCount,
      logs: sandboxResult.logs,
      warnings,
    };
  }

  /**
   * Encodes a structure's contents for an agent that will write an edit program.
   * Returns a note instead when the structure is too large to show usefully.
   */
  static describeContents(
    structure: Structure,
    maxCells: number = 100 * 100 * 100,
    maxChars: number = 60_000
  ): { encoded?: string; note?: string } {
    const cube = structure.cube;
    if (!cube) {
      return { note: "The structure has no block data." };
    }
    const cells = cube.maxX * cube.maxY * cube.maxZ;
    if (cells > maxCells) {
      return {
        note: `The structure has ${cells} cells, too many to list. Edit it with api.get in the program instead.`,
      };
    }
    const dense = StructureProgramRealizer.denseFromStructure(structure);
    if (!dense) {
      return { note: "The structure has no block data." };
    }
    let encoded: string;
    try {
      encoded = StructureVolumeCodec.encode(dense);
    } catch (e: unknown) {
      return { note: `The structure couldn't be listed: ${e instanceof Error ? e.message : e}` };
    }
    if (encoded.length > maxChars) {
      return {
        note: `The structure's listing is ${encoded.length} characters, too long to show. Edit it with api.get in the program instead.`,
      };
    }
    return { encoded };
  }

  /**
   * Checks that a structure is small enough to edit with a program. Edit mode
   * expands the base into dense arrays on the host and in the sandbox, so it
   * uses the same caps as api.declareSize. Returns an error message, or
   * undefined when the size is fine.
   */
  static checkEditableSize(structure: Structure): string | undefined {
    const cube = structure.cube;
    if (!cube) {
      return undefined;
    }
    const maxAxis = STRUCTURE_PROGRAM_DEFAULTS.maxAxis;
    const maxVolume = STRUCTURE_PROGRAM_DEFAULTS.maxVolume;
    const sizeX = cube.maxX;
    const sizeY = cube.maxY;
    const sizeZ = cube.maxZ;
    if (sizeX > maxAxis || sizeY > maxAxis || sizeZ > maxAxis) {
      return `The structure to edit is ${sizeX}×${sizeY}×${sizeZ}; programs can edit at most ${maxAxis} blocks per axis.`;
    }
    const volume = sizeX * sizeY * sizeZ;
    if (volume > maxVolume) {
      return `The structure to edit has ${volume} cells; programs can edit at most ${maxVolume} cells.`;
    }
    return undefined;
  }

  /** One-line summary of a failure for CLI/MCP output. */
  static describeFailure(failure: IStructureProgramRunFailure): string {
    const label: Record<StructureProgramFailureReason, string> = {
      validation: "Invalid program",
      syntax: "Program has a syntax error",
      runtime: "Program failed",
      timeout: "Program timed out",
      budget: "Program exceeded the block budget",
      memory: "Program ran out of memory",
      busy: "Structure builder is busy",
      internal: "Structure builder failed",
    };
    return `${label[failure.reason]}: ${failure.detail}`;
  }
}
