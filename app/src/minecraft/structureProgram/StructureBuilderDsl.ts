// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * The structure builder DSL: the `api` object a `build(api)` program calls.
 *
 * The builder never mutates a grid; it *journals* every write into a growable
 * interleaved Int32Array `[x, y, z, tableIdx, ...]` and interns
 * `(name, canonicalStates)` pairs into a small string table. All randomness
 * flows through one seeded PRNG, so a program is reproducible for a given seed.
 *
 * ## GUEST-SAFE: this function is injected into QuickJS via `toString()`
 *
 * `createStructureBuilder` is serialized with `Function.prototype.toString()` and
 * evaluated inside the QuickJS sandbox (see StructureProgramSandbox.ts). It must
 * therefore be completely self-contained:
 *   - no references to imports or module-level identifiers (constants are inlined)
 *   - no classes with `#private` fields or anything that needs TS/bundler helpers
 *   - only ES2020 built-ins (Map, typed arrays, Math, JSON)
 * The same function also runs directly in Node for unit tests.
 */

import type { IStructureBaseVolume, IStructureBuilderOptions } from "./StructureProgramTypes";

type StatesArg = Record<string, unknown> | undefined;
type BlockToken = string | [string, Record<string, unknown>];

/** Public shape of the `api` object passed to `build(api)`. */
export interface IStructureBuilderApi {
  readonly sizeX: number;
  readonly sizeY: number;
  readonly sizeZ: number;
  declareSize(w: number, h: number, d: number): void;
  set(x: number, y: number, z: number, name: string, states?: StatesArg): void;
  get(x: number, y: number, z: number): string;
  getStates(x: number, y: number, z: number): Record<string, unknown> | undefined;
  fill(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, name: string, states?: StatesArg): void;
  clear(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number): void;
  hollowBox(
    x1: number,
    y1: number,
    z1: number,
    x2: number,
    y2: number,
    z2: number,
    name: string,
    states?: StatesArg
  ): void;
  walls(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, name: string, states?: StatesArg): void;
  line(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, name: string, states?: StatesArg): void;
  cylinder(
    cx: number,
    y: number,
    cz: number,
    radius: number,
    height: number,
    name: string,
    states?: StatesArg,
    hollow?: boolean
  ): void;
  sphere(cx: number, cy: number, cz: number, radius: number, name: string, states?: StatesArg, hollow?: boolean): void;
  random(): number;
  pick(...members: BlockToken[]): string;
}

/** Raw builder output before the host unpacks it into an IStructureBuilderJournal. */
export interface IStructureBuilderPackedResult {
  /** Interleaved `[x, y, z, tableIdx]` per write, exact length `4 * writeCount`. */
  readonly packed: Int32Array;
  readonly writeCount: number;
  readonly names: string[];
  readonly statesJson: string[];
  readonly oobCount: number;
  readonly sizeX: number;
  readonly sizeY: number;
  readonly sizeZ: number;
}

export interface IStructureBuilder {
  readonly api: IStructureBuilderApi;
  finish(): IStructureBuilderPackedResult;
}

export function createStructureBuilder(
  opts: IStructureBuilderOptions,
  base: IStructureBaseVolume | undefined
): IStructureBuilder {
  // Built-ins are captured before the program runs, so a program that replaces
  // globals or patches prototypes (Array.prototype.push, Map.prototype.get,
  // Object.prototype.toJSON, ...) can't reach the builder's private journal.
  // Bound `call` wrappers don't consult Function.prototype.call when invoked.
  const callFn = Function.prototype.call;
  const mapGet = callFn.bind(Map.prototype.get) as (m: Map<string, number>, k: string) => number | undefined;
  const mapSet = callFn.bind(Map.prototype.set) as (m: Map<string, number>, k: string, v: number) => void;
  const arraySort = callFn.bind(Array.prototype.sort) as (a: string[]) => string[];
  const strTrim = callFn.bind(String.prototype.trim) as (s: string) => string;
  const strLower = callFn.bind(String.prototype.toLowerCase) as (s: string) => string;
  const strIndexOf = callFn.bind(String.prototype.indexOf) as (s: string, search: string) => number;
  const strSlice = callFn.bind(String.prototype.slice) as (s: string, start: number, end?: number) => string;
  const strCharCodeAt = callFn.bind(String.prototype.charCodeAt) as (s: string, i: number) => number;
  const i32Set = callFn.bind(Int32Array.prototype.set) as (target: Int32Array, source: Int32Array) => void;
  const i32Fill = callFn.bind(Int32Array.prototype.fill) as (target: Int32Array, v: number) => Int32Array;
  const i32Slice = callFn.bind(Int32Array.prototype.slice) as (a: Int32Array, s: number, e: number) => Int32Array;
  const jsonStringify = JSON.stringify;
  const jsonParse = JSON.parse;
  const objectKeys = Object.keys;
  const objectCreate = Object.create;
  const defineProperty = Object.defineProperty;
  const isArray = Array.isArray;
  const isInteger = Number.isInteger;
  const toNumber = Number;
  const isFiniteNumber = isFinite;
  const mathFloor = Math.floor;
  const mathRound = Math.round;
  const mathCeil = Math.ceil;
  const mathMax = Math.max;
  const mathMin = Math.min;
  const mathAbs = Math.abs;
  const mathImul = Math.imul;
  const Int32ArrayCtor = Int32Array;
  const MapCtor = Map;
  const ErrorCtor = Error;
  const TypeErrorCtor = TypeError;
  const RangeErrorCtor = RangeError;

  // Mirrors STRUCTURE_TABLE_LIMITS / STRUCTURE_FORBIDDEN_STATE_KEYS in
  // StructureProgramTypes.ts; this function can't import, so keep them in sync.
  const MAX_NAME_LENGTH = 256;
  const MAX_STATE_KEYS = 32;
  const MAX_STATE_KEY_LENGTH = 64;
  const MAX_STATE_STRING_LENGTH = 256;
  const MAX_STATES_JSON_LENGTH = 4096;
  const MAX_TABLE_ENTRIES = 4096;
  const MAX_TABLE_CHARS = 1024 * 1024;
  const BUDGET = "BudgetError: ";

  const PICK_PREFIX = "\u0000pick:";
  const AIR = "minecraft:air";
  const mode = opts.mode;
  const maxAxis = opts.maxAxis !== undefined ? opts.maxAxis : 128;
  const maxVolume = opts.maxVolume !== undefined ? opts.maxVolume : 128 * 64 * 128;
  const opBudget = opts.opBudget !== undefined ? opts.opBudget : 4000000;

  let sizeX = mode === "edit" && base ? base.sizeX : mathMax(0, mathFloor(opts.sizeX || 0));
  let sizeY = mode === "edit" && base ? base.sizeY : mathMax(0, mathFloor(opts.sizeY || 0));
  let sizeZ = mode === "edit" && base ? base.sizeZ : mathMax(0, mathFloor(opts.sizeZ || 0));
  let sizeDeclared = mode === "edit";

  let journal = new Int32ArrayCtor(4096);
  let writeCount = 0;
  let oobCount = 0;
  let opCount = 0;
  let tableChars = 0;

  const internMap = new MapCtor<string, number>();
  const names: string[] = [];
  const statesJson: string[] = [];
  const statesObjects: (Record<string, unknown> | undefined)[] = [];
  // cell → tableIdx of the latest write (-1 = none); dense so memory stays bounded by volume size.
  let overrides: Int32Array | undefined;
  const picks: BlockToken[][] = [];

  // mulberry32 PRNG
  let seedState = (opts.seed !== undefined ? opts.seed : 0x9e3779b9) >>> 0;
  function rand(): number {
    seedState = (seedState + 0x6d2b79f5) | 0;
    let t = mathImul(seedState ^ (seedState >>> 15), 1 | seedState);
    t = (t + mathImul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Appends without Array.prototype.push or index setters a program could patch. */
  function append<T>(arr: T[], value: T): void {
    const desc = objectCreate(null);
    desc.value = value;
    desc.writable = true;
    desc.enumerable = true;
    desc.configurable = true;
    defineProperty(arr, arr.length, desc);
  }

  /** State names are short identifiers like `facing_direction` or `minecraft:cardinal_direction`. */
  function isStateKeyChar(c: number): boolean {
    return (
      (c >= 48 && c <= 57) || // 0-9
      (c >= 65 && c <= 90) || // A-Z
      (c >= 97 && c <= 122) || // a-z
      c === 95 || // _
      c === 58 || // :
      c === 46 || // .
      c === 45 // -
    );
  }

  function canonicalStates(states: StatesArg): string {
    if (states === undefined || states === null) {
      return "";
    }
    if (typeof states !== "object" || isArray(states)) {
      throw new TypeErrorCtor("block states must be an object like { facing_direction: 2 }");
    }
    const keys = objectKeys(states);
    if (keys.length === 0) {
      return "";
    }
    if (keys.length > MAX_STATE_KEYS) {
      throw new ErrorCtor(BUDGET + "a block can have at most " + MAX_STATE_KEYS + " states");
    }
    arraySort(keys);
    const ordered = objectCreate(null);
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (k === "__proto__" || k === "constructor" || k === "prototype") {
        throw new TypeErrorCtor("'" + k + "' isn't allowed as a block state name");
      }
      if (k.length === 0 || k.length > MAX_STATE_KEY_LENGTH) {
        throw new TypeErrorCtor("block state names must be 1 to " + MAX_STATE_KEY_LENGTH + " characters long");
      }
      for (let j = 0; j < k.length; j++) {
        if (!isStateKeyChar(strCharCodeAt(k, j))) {
          throw new TypeErrorCtor(
            "block state name '" + k + "' can only use letters, digits, and the characters _ : . -"
          );
        }
      }
      const v = states[k];
      if (typeof v !== "string" && typeof v !== "number" && typeof v !== "boolean") {
        throw new TypeErrorCtor("block state '" + k + "' must be a string, number, or boolean");
      }
      // Numeric states are saved as NBT ints, so anything else would change on save.
      if (typeof v === "number" && (!isInteger(v) || v < -2147483648 || v > 2147483647)) {
        throw new TypeErrorCtor("block state '" + k + "' must be a whole number between -2147483648 and 2147483647");
      }
      if (typeof v === "string" && v.length > MAX_STATE_STRING_LENGTH) {
        throw new ErrorCtor(
          BUDGET + "block state '" + k + "' is longer than " + MAX_STATE_STRING_LENGTH + " characters"
        );
      }
      ordered[k] = v;
    }
    const sj = jsonStringify(ordered);
    if (sj.length > MAX_STATES_JSON_LENGTH) {
      throw new ErrorCtor(BUDGET + "a block's states are longer than " + MAX_STATES_JSON_LENGTH + " characters");
    }
    return sj;
  }

  function normalizeName(name: unknown): string {
    if (typeof name !== "string") {
      throw new TypeErrorCtor("block name must be a non-empty string like 'minecraft:stone'");
    }
    if (name.length > MAX_NAME_LENGTH) {
      throw new ErrorCtor(BUDGET + "block names can be at most " + MAX_NAME_LENGTH + " characters long");
    }
    const trimmed = strTrim(name);
    if (trimmed.length === 0) {
      throw new TypeErrorCtor("block name must be a non-empty string like 'minecraft:stone'");
    }
    if (strIndexOf(trimmed, PICK_PREFIX) === 0) {
      return trimmed;
    }
    for (let i = 0; i < trimmed.length; i++) {
      const c = strCharCodeAt(trimmed, i);
      if (c < 32 || c === 127) {
        throw new TypeErrorCtor("block name '" + strSlice(trimmed, 0, 64) + "' contains a control character");
      }
    }
    const lower = strLower(trimmed);
    const full = strIndexOf(lower, ":") >= 0 ? lower : "minecraft:" + lower;
    if (full.length > MAX_NAME_LENGTH) {
      throw new ErrorCtor(BUDGET + "block names can be at most " + MAX_NAME_LENGTH + " characters long");
    }
    return full;
  }

  function checkBudget(): void {
    opCount++;
    if (opCount > opBudget) {
      throw new ErrorCtor(BUDGET + "build program exceeded the " + opBudget + "-block budget");
    }
  }

  function cellIndex(x: number, y: number, z: number): number {
    return (y * sizeZ + z) * sizeX + x;
  }

  function inBounds(x: number, y: number, z: number): boolean {
    return x >= 0 && x < sizeX && y >= 0 && y < sizeY && z >= 0 && z < sizeZ;
  }

  function intern(name: string, sj: string): number {
    const key = name + "\u0000" + sj;
    const existing = mapGet(internMap, key);
    if (existing !== undefined) {
      return existing;
    }
    if (names.length >= MAX_TABLE_ENTRIES) {
      throw new ErrorCtor(
        BUDGET + "build program used more than " + MAX_TABLE_ENTRIES + " different block and state combinations"
      );
    }
    tableChars += name.length + sj.length;
    if (tableChars > MAX_TABLE_CHARS) {
      throw new ErrorCtor(BUDGET + "build program's block names and states are too long in total");
    }
    const idx = names.length;
    mapSet(internMap, key, idx);
    append(names, name);
    append(statesJson, sj);
    append(statesObjects, sj ? jsonParse(sj) : undefined);
    return idx;
  }

  function resolveToken(name: string, states: StatesArg): [string, StatesArg] {
    if (strIndexOf(name, PICK_PREFIX) === 0) {
      const pickIdx = toNumber(strSlice(name, PICK_PREFIX.length));
      const members = isInteger(pickIdx) && pickIdx >= 0 && pickIdx < picks.length ? picks[pickIdx] : undefined;
      if (members && members.length > 0) {
        const chosen = members[mathFloor(rand() * members.length)];
        const resolved = isArray(chosen) ? normalizeName(chosen[0]) : normalizeName(chosen);
        if (strIndexOf(resolved, PICK_PREFIX) === 0) {
          throw new TypeErrorCtor("api.pick members must be block names, not other api.pick tokens");
        }
        return [resolved, isArray(chosen) ? chosen[1] : undefined];
      }
      throw new TypeErrorCtor("unknown api.pick token");
    }
    return [name, states];
  }

  function place(x: number, y: number, z: number, rawName: string, states: StatesArg): void {
    if (!sizeDeclared) {
      throw new ErrorCtor("call api.declareSize(width, height, depth) before placing blocks");
    }
    checkBudget();
    const px = mathRound(x);
    const py = mathRound(y);
    const pz = mathRound(z);
    if (!inBounds(px, py, pz)) {
      oobCount++;
      return;
    }
    const resolved = resolveToken(rawName, states);
    const tableIdx = intern(resolved[0], canonicalStates(resolved[1]));

    if (writeCount * 4 + 4 > journal.length) {
      const next = new Int32ArrayCtor(journal.length * 2);
      i32Set(next, journal);
      journal = next;
    }
    const o = writeCount * 4;
    journal[o] = px;
    journal[o + 1] = py;
    journal[o + 2] = pz;
    journal[o + 3] = tableIdx;
    writeCount++;

    const cellCount = sizeX * sizeY * sizeZ;
    if (overrides === undefined || overrides.length !== cellCount) {
      overrides = i32Fill(new Int32ArrayCtor(cellCount), -1);
    }
    overrides[cellIndex(px, py, pz)] = tableIdx;
  }

  function lookup(x: number, y: number, z: number): { name: string; states: Record<string, unknown> | undefined } {
    const px = mathRound(x);
    const py = mathRound(y);
    const pz = mathRound(z);
    if (!inBounds(px, py, pz)) {
      return { name: AIR, states: undefined };
    }
    const cell = cellIndex(px, py, pz);
    const override = overrides !== undefined && cell < overrides.length ? overrides[cell] : -1;
    if (override >= 0) {
      return { name: names[override], states: statesObjects[override] };
    }
    if (base) {
      const baseIdx = base.indices[cell];
      if (baseIdx !== undefined && baseIdx >= 0) {
        const sj = base.statesJson[baseIdx];
        return { name: base.names[baseIdx] || AIR, states: sj ? jsonParse(sj) : undefined };
      }
    }
    return { name: AIR, states: undefined };
  }

  function minmax(a: number, b: number): [number, number] {
    const ra = mathRound(a);
    const rb = mathRound(b);
    return ra <= rb ? [ra, rb] : [rb, ra];
  }

  function box(
    x1: number,
    y1: number,
    z1: number,
    x2: number,
    y2: number,
    z2: number,
    name: string,
    states: StatesArg,
    shell: "solid" | "hollow" | "walls"
  ): void {
    const n = normalizeName(name);
    const xr = minmax(x1, x2);
    const yr = minmax(y1, y2);
    const zr = minmax(z1, z2);
    for (let y = yr[0]; y <= yr[1]; y++) {
      for (let z = zr[0]; z <= zr[1]; z++) {
        for (let x = xr[0]; x <= xr[1]; x++) {
          const onSide = x === xr[0] || x === xr[1] || z === zr[0] || z === zr[1];
          if (
            shell === "solid" ||
            (shell === "walls" && onSide) ||
            (shell === "hollow" && (onSide || y === yr[0] || y === yr[1]))
          ) {
            place(x, y, z, n, states);
          }
        }
      }
    }
  }

  const api = {
    declareSize(w: number, h: number, d: number): void {
      if (sizeDeclared) {
        return;
      }
      if (!isFiniteNumber(w) || !isFiniteNumber(h) || !isFiniteNumber(d)) {
        throw new TypeErrorCtor("api.declareSize needs three numbers: width, height, depth");
      }
      const clampedX = mathMax(1, mathMin(maxAxis, mathFloor(w)));
      const clampedY = mathMax(1, mathMin(maxAxis, mathFloor(h)));
      const clampedZ = mathMax(1, mathMin(maxAxis, mathFloor(d)));
      if (clampedX * clampedY * clampedZ > maxVolume) {
        throw new RangeErrorCtor(
          `api.declareSize(${clampedX}, ${clampedY}, ${clampedZ}) is ${clampedX * clampedY * clampedZ} cells; ` +
            `the limit is ${maxVolume} cells (each axis can be up to ${maxAxis})`
        );
      }
      sizeDeclared = true;
      sizeX = clampedX;
      sizeY = clampedY;
      sizeZ = clampedZ;
    },
    set(x: number, y: number, z: number, name: string, states?: StatesArg): void {
      place(x, y, z, normalizeName(name), states);
    },
    get(x: number, y: number, z: number): string {
      return lookup(x, y, z).name;
    },
    getStates(x: number, y: number, z: number): Record<string, unknown> | undefined {
      const states = lookup(x, y, z).states;
      return states ? jsonParse(jsonStringify(states)) : undefined;
    },
    fill(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, name: string, states?: StatesArg) {
      box(x1, y1, z1, x2, y2, z2, name, states, "solid");
    },
    clear(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number): void {
      box(x1, y1, z1, x2, y2, z2, AIR, undefined, "solid");
    },
    hollowBox(
      x1: number,
      y1: number,
      z1: number,
      x2: number,
      y2: number,
      z2: number,
      name: string,
      states?: StatesArg
    ) {
      box(x1, y1, z1, x2, y2, z2, name, states, "hollow");
    },
    walls(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, name: string, states?: StatesArg) {
      box(x1, y1, z1, x2, y2, z2, name, states, "walls");
    },
    line(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, name: string, states?: StatesArg) {
      const n = normalizeName(name);
      // 3D Bresenham, inclusive of both endpoints.
      let x = mathRound(x1);
      let y = mathRound(y1);
      let z = mathRound(z1);
      const ex = mathRound(x2);
      const ey = mathRound(y2);
      const ez = mathRound(z2);
      const dx = mathAbs(ex - x);
      const dy = mathAbs(ey - y);
      const dz = mathAbs(ez - z);
      const sx = ex > x ? 1 : -1;
      const sy = ey > y ? 1 : -1;
      const sz = ez > z ? 1 : -1;
      const steps = mathMax(dx, dy, dz);
      let e1: number;
      let e2: number;
      if (dx >= dy && dx >= dz) {
        e1 = 2 * dy - dx;
        e2 = 2 * dz - dx;
        for (let i = 0; i <= steps; i++) {
          place(x, y, z, n, states);
          if (e1 > 0) {
            y += sy;
            e1 -= 2 * dx;
          }
          if (e2 > 0) {
            z += sz;
            e2 -= 2 * dx;
          }
          e1 += 2 * dy;
          e2 += 2 * dz;
          x += sx;
        }
      } else if (dy >= dx && dy >= dz) {
        e1 = 2 * dx - dy;
        e2 = 2 * dz - dy;
        for (let i = 0; i <= steps; i++) {
          place(x, y, z, n, states);
          if (e1 > 0) {
            x += sx;
            e1 -= 2 * dy;
          }
          if (e2 > 0) {
            z += sz;
            e2 -= 2 * dy;
          }
          e1 += 2 * dx;
          e2 += 2 * dz;
          y += sy;
        }
      } else {
        e1 = 2 * dx - dz;
        e2 = 2 * dy - dz;
        for (let i = 0; i <= steps; i++) {
          place(x, y, z, n, states);
          if (e1 > 0) {
            x += sx;
            e1 -= 2 * dz;
          }
          if (e2 > 0) {
            y += sy;
            e2 -= 2 * dz;
          }
          e1 += 2 * dx;
          e2 += 2 * dy;
          z += sz;
        }
      }
    },
    cylinder(
      cx: number,
      y: number,
      cz: number,
      radius: number,
      height: number,
      name: string,
      states?: StatesArg,
      hollow?: boolean
    ): void {
      const n = normalizeName(name);
      const r = mathMax(0, radius);
      const r2 = r * r;
      const inner2 = (r - 1) * (r - 1);
      const baseY = mathRound(y);
      const h = mathMax(1, mathRound(height));
      const c = mathCeil(r);
      for (let dx = -c; dx <= c; dx++) {
        for (let dz = -c; dz <= c; dz++) {
          const dist2 = dx * dx + dz * dz;
          if (dist2 > r2 || (hollow && dist2 <= inner2)) {
            continue;
          }
          for (let yy = 0; yy < h; yy++) {
            place(cx + dx, baseY + yy, cz + dz, n, states);
          }
        }
      }
    },
    sphere(cx: number, cy: number, cz: number, radius: number, name: string, states?: StatesArg, hollow?: boolean) {
      const n = normalizeName(name);
      const r = mathMax(0, radius);
      const r2 = r * r;
      const inner2 = (r - 1) * (r - 1);
      const c = mathCeil(r);
      for (let dx = -c; dx <= c; dx++) {
        for (let dy = -c; dy <= c; dy++) {
          for (let dz = -c; dz <= c; dz++) {
            const dist2 = dx * dx + dy * dy + dz * dz;
            if (dist2 > r2 || (hollow && dist2 <= inner2)) {
              continue;
            }
            place(cx + dx, cy + dy, cz + dz, n, states);
          }
        }
      }
    },
    random(): number {
      return rand();
    },
    pick(...members: BlockToken[]): string {
      if (members.length === 0) {
        throw new TypeErrorCtor("api.pick needs at least one block");
      }
      append(picks, members);
      return PICK_PREFIX + (picks.length - 1);
    },
  };

  Object.defineProperties(api, {
    sizeX: { get: () => sizeX, enumerable: true },
    sizeY: { get: () => sizeY, enumerable: true },
    sizeZ: { get: () => sizeZ, enumerable: true },
  });

  return {
    api: Object.freeze(api) as unknown as IStructureBuilderApi,
    finish(): IStructureBuilderPackedResult {
      return {
        packed: i32Slice(journal, 0, writeCount * 4),
        writeCount,
        names,
        statesJson,
        oobCount,
        sizeX,
        sizeY,
        sizeZ,
      };
    },
  };
}
