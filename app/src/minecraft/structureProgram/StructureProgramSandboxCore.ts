// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Runs one untrusted `build(api)` program inside a QuickJS WebAssembly sandbox,
 * on whatever thread calls it. `StructureProgramSandbox` normally calls this from
 * a worker thread (see `StructureSandboxWorker.ts`), so keep this file's imports
 * light: no `Log`, nothing that pulls in the rest of the app.
 *
 * QuickJS is the security boundary. It is a separate JS engine with its own heap,
 * and guest code gets no host objects because we hand it none. Only strings and
 * one ArrayBuffer cross the boundary in each direction.
 *
 * Per run we:
 *   1. Create a fresh QuickJS runtime with a memory limit, a stack limit, and an
 *      interrupt handler that enforces a wall-clock deadline.
 *   2. Pass options and the base volume in as JSON plus an ArrayBuffer, and a
 *      single host log function that only accepts strings.
 *   3. Evaluate the program (`program.js`). This only defines a function.
 *   4. In one more evaluation (`runner.js`), create the builder in a closure,
 *      install a guest console that formats and truncates its own output, call
 *      the program, call `finish()`, and export only data: a JSON metadata string
 *      plus the packed journal as an ArrayBuffer. The builder never lives on a
 *      global, so the program cannot replace `finish()`.
 *   5. Treat that data as untrusted. `validateFinishMeta` checks every field
 *      before we allocate anything sized by it.
 *   6. Dispose every handle, the context, and the runtime (even on failure).
 *
 * The WASM module loads once per thread and is cached (~20 ms).
 */

import {
  newQuickJSWASMModuleFromVariant,
  shouldInterruptAfterDeadline,
  QuickJSContext,
  QuickJSHandle,
  QuickJSWASMModule,
} from "quickjs-emscripten-core";
import quickJsVariant from "@jitl/quickjs-singlefile-cjs-release-sync";
import { createStructureBuilder } from "./StructureBuilderDsl";
import {
  IStructureBaseVolume,
  IStructureBuilderOptions,
  IStructureSandboxLimits,
  STRUCTURE_BUDGET_ERROR_PREFIX,
  STRUCTURE_FORBIDDEN_STATE_KEYS,
  STRUCTURE_NO_CLOCK_MESSAGE,
  STRUCTURE_PROGRAM_DEFAULTS,
  STRUCTURE_TABLE_LIMITS,
  StructureProgramFailureReason,
  StructureSandboxResult,
} from "./StructureProgramTypes";

export const MAX_LOG_LINES = 100;
export const MAX_LOG_LINE_LENGTH = 500;

/**
 * Upper bound on the metadata JSON a run can export. The table limits already
 * bound it; JSON escaping can at most double the states' characters, so this
 * leaves headroom and only trips if the guest-side limits were bypassed.
 */
export const MAX_META_JSON_LENGTH = 4 * STRUCTURE_TABLE_LIMITS.maxTableChars + 4096;

const STATE_KEY_PATTERN = /^[A-Za-z0-9_:.-]+$/;

export const STRUCTURE_TIMEOUT_DETAIL =
  "The build program ran past its time limit. Reduce loop counts or the structure size.";

/** Lines the program wrapper adds before the first line of user code. */
const PROGRAM_WRAPPER_LINES = 2;

let modulePromise: Promise<QuickJSWASMModule> | undefined;

export function getQuickJsModule(): Promise<QuickJSWASMModule> {
  if (modulePromise === undefined) {
    modulePromise = newQuickJSWASMModuleFromVariant(quickJsVariant).catch((e) => {
      modulePromise = undefined;
      throw e;
    });
  }
  return modulePromise;
}

interface IGuestError {
  name?: string;
  message?: string;
  stack?: string;
}

export interface IStructureSandboxRequest {
  readonly code: string;
  readonly options: IStructureBuilderOptions;
  readonly base?: IStructureBaseVolume;
  readonly limits?: IStructureSandboxLimits;
}

/** Metadata the guest returns from `finish()`. Untrusted until validated. */
export interface IStructureFinishMeta {
  writeCount: number;
  names: string[];
  statesJson: string[];
  oobCount: number;
  sizeX: number;
  sizeY: number;
  sizeZ: number;
}

export interface IStructureFinishExpectations {
  readonly mode: "generate" | "edit";
  readonly maxAxis: number;
  readonly maxVolume: number;
  readonly base?: { readonly sizeX: number; readonly sizeY: number; readonly sizeZ: number };
}

/**
 * Guest code for the console. It formats with depth and length bounds and only
 * ever hands the host a string of at most MAX_LOG_LINE_LENGTH + 1 characters.
 * Intrinsics are captured up front so a program that replaces `JSON.stringify`
 * or `String.prototype.slice` only garbles its own log lines.
 */
const GUEST_CONSOLE_SOURCE = `
  const MAX = ${MAX_LOG_LINE_LENGTH};
  const MAX_DEPTH = 3;
  const call = Function.prototype.call;
  const sliceStr = call.bind(String.prototype.slice);
  const joinArr = call.bind(Array.prototype.join);
  const pushArr = call.bind(Array.prototype.push);
  const quote = JSON.stringify;
  const isArray = Array.isArray;
  const keysOf = Object.keys;
  const toStr = String;
  const clip = (s) => (s.length > MAX ? sliceStr(s, 0, MAX) + "\\u2026" : s);
  function fmt(v, depth) {
    const t = typeof v;
    if (t === "string") {
      return depth === 0 ? clip(v) : quote(clip(v));
    }
    if (t === "function") {
      return "[Function]";
    }
    if (v === null || t !== "object") {
      return toStr(v);
    }
    const arr = isArray(v);
    if (depth >= MAX_DEPTH) {
      return arr ? "[Array]" : "[Object]";
    }
    const keys = arr ? undefined : keysOf(v);
    const n = arr ? v.length : keys.length;
    const parts = [];
    let len = 0;
    let i = 0;
    for (; i < n && len <= MAX; i++) {
      const part = arr ? fmt(v[i], depth + 1) : quote(keys[i]) + ":" + fmt(v[keys[i]], depth + 1);
      pushArr(parts, part);
      len += part.length + 1;
    }
    if (i < n) {
      pushArr(parts, "\\u2026");
    }
    return arr ? "[" + joinArr(parts, ",") + "]" : "{" + joinArr(parts, ",") + "}";
  }
  function makeLogger(level) {
    return function () {
      try {
        let line = "";
        for (let i = 0; i < arguments.length && line.length <= MAX; i++) {
          let part;
          try {
            part = fmt(arguments[i], 0);
          } catch (e) {
            part = "[unprintable]";
          }
          line += (i > 0 ? " " : "") + part;
        }
        hostLog(level, clip(line));
      } catch (e) {
        // A log call must never break the build.
      }
    };
  }
  globalThis.console = Object.freeze({
    log: makeLogger("log"),
    info: makeLogger("info"),
    warn: makeLogger("warn"),
    error: makeLogger("error"),
    debug: makeLogger("debug"),
  });
`;

export default class StructureProgramSandboxCore {
  static async run(request: IStructureSandboxRequest): Promise<StructureSandboxResult> {
    const logs: string[] = [];
    let runtime;
    let context: QuickJSContext | undefined;
    const handles: QuickJSHandle[] = [];

    try {
      const quickJs = await getQuickJsModule();
      const limits = request.limits || {};
      const timeoutMs = limits.timeoutMs ?? STRUCTURE_PROGRAM_DEFAULTS.timeoutMs;

      runtime = quickJs.newRuntime();
      runtime.setMemoryLimit(limits.memoryLimitBytes ?? STRUCTURE_PROGRAM_DEFAULTS.memoryLimitBytes);
      runtime.setMaxStackSize(limits.maxStackSizeBytes ?? STRUCTURE_PROGRAM_DEFAULTS.maxStackSizeBytes);
      runtime.setInterruptHandler(shouldInterruptAfterDeadline(Date.now() + timeoutMs));

      const ctx = runtime.newContext();
      context = ctx;

      StructureProgramSandboxCore._installHostLog(ctx, logs, handles);

      const options: IStructureBuilderOptions = {
        ...request.options,
        opBudget: limits.opBudget ?? request.options.opBudget ?? STRUCTURE_PROGRAM_DEFAULTS.opBudget,
        maxAxis: request.options.maxAxis ?? STRUCTURE_PROGRAM_DEFAULTS.maxAxis,
        maxVolume: request.options.maxVolume ?? STRUCTURE_PROGRAM_DEFAULTS.maxVolume,
        seed: request.options.seed ?? STRUCTURE_PROGRAM_DEFAULTS.seed,
      };

      const optionsHandle = ctx.newString(JSON.stringify(options));
      handles.push(optionsHandle);
      ctx.setProp(ctx.global, "__mctOptionsJson", optionsHandle);

      if (request.base) {
        const baseMeta = {
          sizeX: request.base.sizeX,
          sizeY: request.base.sizeY,
          sizeZ: request.base.sizeZ,
          names: request.base.names,
          statesJson: request.base.statesJson,
        };
        const baseMetaHandle = ctx.newString(JSON.stringify(baseMeta));
        handles.push(baseMetaHandle);
        ctx.setProp(ctx.global, "__mctBaseJson", baseMetaHandle);

        const indices = request.base.indices;
        const indexBuffer = indices.buffer.slice(indices.byteOffset, indices.byteOffset + indices.byteLength);
        const baseIndicesHandle = ctx.newArrayBuffer(indexBuffer);
        handles.push(baseIndicesHandle);
        ctx.setProp(ctx.global, "__mctBaseIndices", baseIndicesHandle);
      }

      // The program only defines a function here. Its top-level declarations live
      // in that function's scope, and it has no lexical access to the runner below.
      const programSource =
        `globalThis.__mctProgram = (function (api) {\n` +
        `"use strict";\n` +
        request.code +
        `\n;if (typeof build !== "function") { throw new Error("The program must define a function build(api)."); }\n` +
        `build(api);\n` +
        `});\n`;

      const programFailure = StructureProgramSandboxCore._evalVoid(ctx, programSource, "program.js", logs);
      if (programFailure) {
        return programFailure;
      }

      const runnerSource =
        `"use strict";\n` +
        `(function () {\n` +
        `  const program = globalThis.__mctProgram;\n` +
        `  const hostLog = globalThis.__mctLog;\n` +
        `  const stringify = JSON.stringify;\n` +
        `  const ErrorCtor = Error;\n` +
        `  const opts = JSON.parse(globalThis.__mctOptionsJson);\n` +
        `  let base;\n` +
        `  if (typeof globalThis.__mctBaseJson === "string") {\n` +
        `    base = JSON.parse(globalThis.__mctBaseJson);\n` +
        `    base.indices = new Int32Array(globalThis.__mctBaseIndices);\n` +
        `  }\n` +
        `  delete globalThis.__mctProgram;\n` +
        `  delete globalThis.__mctLog;\n` +
        `  delete globalThis.__mctOptionsJson;\n` +
        `  delete globalThis.__mctBaseJson;\n` +
        `  delete globalThis.__mctBaseIndices;\n` +
        GUEST_CONSOLE_SOURCE +
        `  const builder = (${createStructureBuilder.toString()})(opts, base);\n` +
        `  const random = builder.api.random;\n` +
        `  Math.random = function () { return random(); };\n` +
        // Date is this runtime's only clock. Without it the recorded code and seed
        // always replay to the same structure.
        `  Object.defineProperty(globalThis, "Date", {\n` +
        `    configurable: false,\n` +
        `    enumerable: false,\n` +
        `    get: function () { throw new ErrorCtor(${JSON.stringify(STRUCTURE_NO_CLOCK_MESSAGE)}); },\n` +
        `  });\n` +
        `  program(builder.api);\n` +
        `  const r = builder.finish();\n` +
        `  const packed = r.packed;\n` +
        // Built by hand so a patched toJSON or Array.prototype can't change it; stringify
        // only sees primitive strings here, which never consult toJSON.
        `  let meta = '{"writeCount":' + r.writeCount + ',"oobCount":' + r.oobCount +\n` +
        `    ',"sizeX":' + r.sizeX + ',"sizeY":' + r.sizeY + ',"sizeZ":' + r.sizeZ;\n` +
        `  const tables = [["names", r.names], ["statesJson", r.statesJson]];\n` +
        `  for (let t = 0; t < 2; t++) {\n` +
        `    const list = tables[t][1];\n` +
        `    meta += ',"' + tables[t][0] + '":[';\n` +
        `    for (let i = 0; i < list.length; i++) {\n` +
        `      meta += (i === 0 ? "" : ",") + stringify(list[i]);\n` +
        `      if (meta.length > ${MAX_META_JSON_LENGTH}) {\n` +
        `        throw new ErrorCtor("${STRUCTURE_BUDGET_ERROR_PREFIX}build program's block table is too large");\n` +
        `      }\n` +
        `    }\n` +
        `    meta += "]";\n` +
        `  }\n` +
        `  meta += "}";\n` +
        `  return {\n` +
        `    meta: meta,\n` +
        `    packed: packed.buffer.slice(packed.byteOffset, packed.byteOffset + packed.byteLength),\n` +
        `  };\n` +
        `})()`;

      const runnerResult = ctx.evalCode(runnerSource, "runner.js");
      if (runnerResult.error) {
        const err = ctx.dump(runnerResult.error) as IGuestError;
        runnerResult.error.dispose();
        return StructureProgramSandboxCore._failure(err, logs);
      }

      const runnerValue = runnerResult.unwrap();
      handles.push(runnerValue);
      const metaHandle = ctx.getProp(runnerValue, "meta");
      handles.push(metaHandle);
      let meta: unknown;
      try {
        const metaJson = ctx.typeof(metaHandle) === "string" ? ctx.getString(metaHandle) : undefined;
        meta = metaJson !== undefined && metaJson.length <= MAX_META_JSON_LENGTH ? JSON.parse(metaJson) : undefined;
      } catch {
        meta = undefined;
      }

      const expectations: IStructureFinishExpectations = {
        mode: options.mode,
        maxAxis: options.maxAxis as number,
        maxVolume: options.maxVolume as number,
        base: request.base,
      };

      const packedHandle = ctx.getProp(runnerValue, "packed");
      handles.push(packedHandle);
      let packedByteLength = -1;
      let packedLifetime: { value: Uint8Array; dispose(): void } | undefined;
      try {
        packedLifetime = ctx.getArrayBuffer(packedHandle);
        packedByteLength = packedLifetime.value.byteLength;
      } catch {
        packedLifetime = undefined;
      }

      const problem = StructureProgramSandboxCore.validateFinishMeta(meta, packedByteLength, expectations);
      if (problem || !packedLifetime) {
        if (packedLifetime) {
          packedLifetime.dispose();
        }
        return {
          ok: false,
          reason: "runtime",
          detail: "The build program returned an inconsistent result: " + (problem || "no block data") + ".",
          logs,
        };
      }

      const valid = meta as IStructureFinishMeta;
      const packedBytes = new Uint8Array(packedByteLength);
      packedBytes.set(packedLifetime.value);
      packedLifetime.dispose();

      const packed = new Int32Array(packedBytes.buffer, 0, valid.writeCount * 4);
      const xs = new Int32Array(valid.writeCount);
      const ys = new Int32Array(valid.writeCount);
      const zs = new Int32Array(valid.writeCount);
      const tableIdx = new Int32Array(valid.writeCount);
      const tableSize = valid.names.length;
      for (let i = 0; i < valid.writeCount; i++) {
        const o = i * 4;
        const x = packed[o];
        const y = packed[o + 1];
        const z = packed[o + 2];
        const t = packed[o + 3];
        if (
          x < 0 ||
          x >= valid.sizeX ||
          y < 0 ||
          y >= valid.sizeY ||
          z < 0 ||
          z >= valid.sizeZ ||
          t < 0 ||
          t >= tableSize
        ) {
          return {
            ok: false,
            reason: "runtime",
            detail: `The build program returned an inconsistent result: write ${i} is outside the structure or block table.`,
            logs,
          };
        }
        xs[i] = x;
        ys[i] = y;
        zs[i] = z;
        tableIdx[i] = t;
      }

      return {
        ok: true,
        logs,
        journal: {
          xs,
          ys,
          zs,
          tableIdx,
          names: valid.names,
          statesJson: valid.statesJson,
          oobCount: valid.oobCount,
          sizeX: valid.sizeX,
          sizeY: valid.sizeY,
          sizeZ: valid.sizeZ,
        },
      };
    } catch (e: unknown) {
      // Host-side failures (e.g. the WASM heap itself running out, or deep guest
      // recursion exhausting the host's native stack) land here.
      const message = e instanceof Error ? e.message : String(e);
      if (/stack overflow|call stack size exceeded/i.test(message)) {
        modulePromise = undefined;
        return {
          ok: false,
          reason: "memory",
          detail: "The build program overflowed the stack. Avoid deep or unbounded recursion.",
          logs,
        };
      }
      if (/out of memory|memory access out of bounds/i.test(message)) {
        return {
          ok: false,
          reason: "memory",
          detail: "The build program ran out of memory. Reduce the structure size or avoid large arrays.",
          logs,
        };
      }
      return { ok: false, reason: "internal", detail: "The structure sandbox failed: " + message, logs };
    } finally {
      try {
        for (const handle of handles) {
          if (handle.alive) {
            handle.dispose();
          }
        }
        if (context && context.alive) {
          context.dispose();
        }
        if (runtime && runtime.alive) {
          runtime.dispose();
        }
      } catch {
        // QuickJS can leak GC objects after a stack overflow, which trips an
        // assertion in JS_FreeRuntime. The result is still valid, but the WASM
        // instance is suspect, so load a fresh one next time.
        modulePromise = undefined;
      }
    }
  }

  /**
   * Checks the metadata a guest returned from `finish()` before the host
   * allocates anything sized by it. Returns a description of the first problem,
   * or undefined when the metadata is consistent.
   */
  static validateFinishMeta(
    meta: unknown,
    packedByteLength: number,
    expect: IStructureFinishExpectations
  ): string | undefined {
    if (typeof meta !== "object" || meta === null || Array.isArray(meta)) {
      return "the result metadata is missing";
    }
    const m = meta as Record<string, unknown>;
    const isCount = (v: unknown) => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;

    for (const axis of ["sizeX", "sizeY", "sizeZ"]) {
      const v = m[axis];
      if (!isCount(v) || (v as number) > expect.maxAxis) {
        return `${axis} must be a whole number from 0 to ${expect.maxAxis}`;
      }
    }
    const sizeX = m.sizeX as number;
    const sizeY = m.sizeY as number;
    const sizeZ = m.sizeZ as number;
    if (sizeX * sizeY * sizeZ > expect.maxVolume) {
      return `the size exceeds ${expect.maxVolume} cells`;
    }
    if (expect.mode === "edit") {
      if (!expect.base) {
        return "edit mode has no base structure";
      }
      if (sizeX !== expect.base.sizeX || sizeY !== expect.base.sizeY || sizeZ !== expect.base.sizeZ) {
        return "the size does not match the structure being edited";
      }
    }

    if (!isCount(m.writeCount)) {
      return "writeCount must be a whole number";
    }
    if (packedByteLength !== (m.writeCount as number) * 16) {
      return "the block data length does not match writeCount";
    }
    if (!isCount(m.oobCount)) {
      return "oobCount must be a whole number";
    }

    const names = m.names;
    const statesJson = m.statesJson;
    if (!Array.isArray(names) || !Array.isArray(statesJson) || names.length !== statesJson.length) {
      return "names and statesJson must be arrays of the same length";
    }
    if (names.length > STRUCTURE_TABLE_LIMITS.maxTableEntries) {
      return `the block table has more than ${STRUCTURE_TABLE_LIMITS.maxTableEntries} entries`;
    }
    let tableChars = 0;
    for (let i = 0; i < names.length; i++) {
      const name = names[i];
      const sj = statesJson[i];
      if (typeof name !== "string" || typeof sj !== "string") {
        return `block table entry ${i} is not a string`;
      }
      const nameProblem = StructureProgramSandboxCore._checkBlockName(name);
      if (nameProblem) {
        return `block table entry ${i} ${nameProblem}`;
      }
      const statesProblem = StructureProgramSandboxCore._checkStatesJson(sj);
      if (statesProblem) {
        return `block table entry ${i} ${statesProblem}`;
      }
      tableChars += name.length + sj.length;
    }
    if (tableChars > STRUCTURE_TABLE_LIMITS.maxTableChars) {
      return `the block table is longer than ${STRUCTURE_TABLE_LIMITS.maxTableChars} characters`;
    }

    return undefined;
  }

  private static _checkBlockName(name: string): string | undefined {
    if (name.length === 0 || name.length > STRUCTURE_TABLE_LIMITS.maxBlockNameLength) {
      return `has a name that isn't 1 to ${STRUCTURE_TABLE_LIMITS.maxBlockNameLength} characters long`;
    }
    for (let i = 0; i < name.length; i++) {
      const c = name.charCodeAt(i);
      if (c < 32 || c === 127) {
        return "has a name with a control character";
      }
    }
    return undefined;
  }

  /** Accepts "" (no states) or the canonical JSON object the DSL produces. */
  private static _checkStatesJson(sj: string): string | undefined {
    if (sj.length === 0) {
      return undefined;
    }
    if (sj.length > STRUCTURE_TABLE_LIMITS.maxStatesJsonLength) {
      return `has states longer than ${STRUCTURE_TABLE_LIMITS.maxStatesJsonLength} characters`;
    }
    let states: unknown;
    try {
      states = JSON.parse(sj);
    } catch {
      return "has states that aren't valid JSON";
    }
    if (typeof states !== "object" || states === null || Array.isArray(states)) {
      return "has states that aren't an object";
    }
    const keys = Object.keys(states);
    if (keys.length === 0 || keys.length > STRUCTURE_TABLE_LIMITS.maxStateKeys) {
      return `must have 1 to ${STRUCTURE_TABLE_LIMITS.maxStateKeys} states`;
    }
    for (const key of keys) {
      if (
        key.length > STRUCTURE_TABLE_LIMITS.maxStateKeyLength ||
        !STATE_KEY_PATTERN.test(key) ||
        STRUCTURE_FORBIDDEN_STATE_KEYS.includes(key)
      ) {
        return `has a state name that isn't allowed`;
      }
      const value = (states as Record<string, unknown>)[key];
      const ok =
        typeof value === "boolean" ||
        (typeof value === "string" && value.length <= STRUCTURE_TABLE_LIMITS.maxStateStringLength) ||
        (typeof value === "number" && Number.isInteger(value) && value >= -2147483648 && value <= 2147483647);
      if (!ok) {
        return `has a state value for '${key}' that isn't allowed`;
      }
    }
    return undefined;
  }

  private static _evalVoid(
    ctx: QuickJSContext,
    code: string,
    fileName: string,
    logs: string[]
  ): StructureSandboxResult | undefined {
    const result = ctx.evalCode(code, fileName);
    if (result.error) {
      const err = ctx.dump(result.error) as IGuestError;
      result.error.dispose();
      return StructureProgramSandboxCore._failure(err, logs);
    }
    result.unwrap().dispose();
    return undefined;
  }

  /** The host side of the console: accepts only strings, and bounds them again. */
  private static _installHostLog(ctx: QuickJSContext, logs: string[], handles: QuickJSHandle[]): void {
    const hostLog = ctx.newFunction("__mctLog", (levelHandle: QuickJSHandle, lineHandle: QuickJSHandle) => {
      if (logs.length > MAX_LOG_LINES) {
        return;
      }
      if (!levelHandle || !lineHandle || ctx.typeof(levelHandle) !== "string" || ctx.typeof(lineHandle) !== "string") {
        return;
      }
      const level = ctx.getString(levelHandle).substring(0, 8);
      let line = ctx.getString(lineHandle);
      if (line.length > MAX_LOG_LINE_LENGTH) {
        line = line.substring(0, MAX_LOG_LINE_LENGTH) + "\u2026";
      }
      if (logs.length === MAX_LOG_LINES) {
        logs.push(`(further console output was dropped after ${MAX_LOG_LINES} lines)`);
        return;
      }
      logs.push((level === "log" ? "" : level + ": ") + line);
    });
    handles.push(hostLog);
    ctx.setProp(ctx.global, "__mctLog", hostLog);
  }

  private static _failure(err: IGuestError | undefined, logs: string[]): StructureSandboxResult {
    const name = err?.name || "Error";
    const message = err?.message !== undefined ? err.message : String(err);
    const reason = StructureProgramSandboxCore.classify(name, message);
    let detail: string;
    if (reason === "timeout") {
      detail = STRUCTURE_TIMEOUT_DETAIL;
    } else if (reason === "memory" && /stack overflow|call stack size exceeded/i.test(message)) {
      detail = "The build program overflowed the stack. Avoid deep or unbounded recursion.";
    } else if (reason === "memory") {
      detail = "The build program ran out of memory. Reduce the structure size or avoid large arrays.";
    } else if (reason === "budget") {
      detail = message.substring(STRUCTURE_BUDGET_ERROR_PREFIX.length);
    } else {
      const location = StructureProgramSandboxCore._programLocation(err?.stack);
      detail = `${name}: ${message}${location ? ` (${location})` : ""}`;
    }
    return { ok: false, reason, detail, logs };
  }

  static classify(name: string, message: string): StructureProgramFailureReason {
    if (name === "InternalError" && /interrupted/i.test(message)) {
      return "timeout";
    }
    if (/out of memory/i.test(message)) {
      return "memory";
    }
    if (/stack overflow|call stack size exceeded/i.test(message)) {
      return "memory";
    }
    if (message.indexOf(STRUCTURE_BUDGET_ERROR_PREFIX) === 0) {
      return "budget";
    }
    if (name === "SyntaxError") {
      return "syntax";
    }
    return "runtime";
  }

  /** Pull `program.js:LINE` out of a QuickJS stack, adjusted for the wrapper lines. */
  private static _programLocation(stack: string | undefined): string | undefined {
    if (!stack) {
      return undefined;
    }
    const match = /program\.js:(\d+)(?::(\d+))?/.exec(stack);
    if (!match) {
      return undefined;
    }
    const line = Math.max(1, parseInt(match[1], 10) - PROGRAM_WRAPPER_LINES);
    return `line ${line}`;
  }
}
