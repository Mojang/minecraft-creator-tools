// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { expect } from "chai";
import "mocha";
import { createStructureBuilder } from "../minecraft/structureProgram/StructureBuilderDsl";
import StructureProgramValidation from "../minecraft/structureProgram/StructureProgramValidation";
import StructureProgramSandbox from "../minecraft/structureProgram/StructureProgramSandbox";
import StructureProgramSandboxCore, {
  MAX_LOG_LINE_LENGTH,
} from "../minecraft/structureProgram/StructureProgramSandboxCore";
import { IStructureBaseVolume } from "../minecraft/structureProgram/StructureProgramTypes";
import StructureVolumeCodec from "../minecraft/structureProgram/StructureVolumeCodec";
import StructureProgramRunner from "../minecraft/structureProgram/StructureProgramRunner";
import StructureProgramRealizer from "../minecraft/structureProgram/StructureProgramRealizer";
import StructureEditLock from "../minecraft/structureProgram/StructureEditLock";
import Structure, { MODERN_BLOCK_PERSISTENCE_VERSION } from "../minecraft/Structure";
import StructureUtilities from "../minecraft/StructureUtilities";
import BlockVolume from "../minecraft/BlockVolume";
import { NbtTagType } from "../minecraft/NbtBinaryTag";

type Cell = [number, number, number];

function resultSummary(result: { ok: boolean; reason?: string; detail?: string; logs?: string[] }): string {
  return result.ok ? "ok" : `${result.reason}: ${result.detail} ${JSON.stringify(result.logs ?? [])}`;
}

function runDirect(fn: (api: any) => void, seed?: number) {
  const builder = createStructureBuilder({ mode: "generate", seed }, undefined);
  fn(builder.api);
  return builder.finish();
}

function cellsOf(result: ReturnType<typeof runDirect>): Cell[] {
  const cells: Cell[] = [];
  for (let i = 0; i < result.writeCount; i++) {
    cells.push([result.packed[i * 4], result.packed[i * 4 + 1], result.packed[i * 4 + 2]]);
  }
  return cells;
}

function uniqueCellCount(result: ReturnType<typeof runDirect>): number {
  return new Set(cellsOf(result).map((c) => c.join(","))).size;
}

describe("StructureBuilderDsl", () => {
  const primitiveCases: { name: string; build: (api: any) => void; expectedCells: number }[] = [
    { name: "set", build: (a) => a.set(1, 1, 1, "stone"), expectedCells: 1 },
    { name: "fill", build: (a) => a.fill(0, 0, 0, 3, 2, 1, "stone"), expectedCells: 4 * 3 * 2 },
    { name: "fill with reversed corners", build: (a) => a.fill(3, 2, 1, 0, 0, 0, "stone"), expectedCells: 24 },
    { name: "hollowBox", build: (a) => a.hollowBox(0, 0, 0, 4, 4, 4, "stone"), expectedCells: 125 - 27 },
    { name: "walls", build: (a) => a.walls(0, 0, 0, 4, 2, 4, "stone"), expectedCells: 3 * (25 - 9) },
    { name: "line along x", build: (a) => a.line(0, 0, 0, 7, 0, 0, "stone"), expectedCells: 8 },
    { name: "line diagonal", build: (a) => a.line(0, 0, 0, 5, 5, 5, "stone"), expectedCells: 6 },
    { name: "line along z", build: (a) => a.line(0, 0, 0, 1, 2, 9, "stone"), expectedCells: 10 },
    { name: "cylinder r=0", build: (a) => a.cylinder(8, 0, 8, 0, 3, "stone"), expectedCells: 3 },
    { name: "cylinder r=2", build: (a) => a.cylinder(8, 0, 8, 2, 1, "stone"), expectedCells: 13 },
    { name: "sphere r=1", build: (a) => a.sphere(8, 8, 8, 1, "stone"), expectedCells: 7 },
    { name: "clear", build: (a) => a.clear(0, 0, 0, 1, 1, 1), expectedCells: 8 },
  ];

  for (const tc of primitiveCases) {
    it(`places the expected cells for ${tc.name}`, () => {
      const result = runDirect((api) => {
        api.declareSize(16, 16, 16);
        tc.build(api);
      });
      expect(uniqueCellCount(result)).to.equal(tc.expectedCells);
      expect(result.oobCount).to.equal(0);
    });
  }

  it("normalizes names and canonicalizes states", () => {
    const result = runDirect((api) => {
      api.declareSize(4, 4, 4);
      api.set(0, 0, 0, "  Stone ");
      api.set(1, 0, 0, "minecraft:stone");
      api.set(2, 0, 0, "oak_stairs", { weirdo_direction: 1, upside_down_bit: false });
      api.set(3, 0, 0, "oak_stairs", { upside_down_bit: false, weirdo_direction: 1 });
      api.set(3, 1, 0, "custom:thing");
    });
    expect(result.names).to.deep.equal(["minecraft:stone", "minecraft:oak_stairs", "custom:thing"]);
    expect(result.statesJson[1]).to.equal('{"upside_down_bit":false,"weirdo_direction":1}');
  });

  it("counts out-of-bounds writes instead of placing them", () => {
    const result = runDirect((api) => {
      api.declareSize(2, 2, 2);
      api.fill(-1, 0, 0, 2, 0, 0, "stone");
    });
    expect(result.writeCount).to.equal(2);
    expect(result.oobCount).to.equal(2);
  });

  it("requires declareSize before placing in generate mode", () => {
    expect(() => runDirect((api) => api.set(0, 0, 0, "stone"))).to.throw(/declareSize/);
  });

  it("clamps declareSize to the axis cap and ignores repeat calls", () => {
    const result = runDirect((api) => {
      api.declareSize(500, 0, 3.7);
      api.declareSize(1, 1, 1);
    });
    expect([result.sizeX, result.sizeY, result.sizeZ]).to.deep.equal([128, 1, 3]);
  });

  it("rejects a declareSize over the volume cap", () => {
    expect(() => runDirect((api) => api.declareSize(128, 128, 128))).to.throw(/limit is 1048576 cells/);
    const result = runDirect((api) => api.declareSize(128, 64, 128));
    expect(result.sizeY).to.equal(64);
  });

  it("reads back the latest write with get/getStates", () => {
    runDirect((api) => {
      api.declareSize(4, 4, 4);
      expect(api.get(0, 0, 0)).to.equal("minecraft:air");
      api.set(0, 0, 0, "stone");
      api.set(0, 0, 0, "dirt");
      api.set(1, 0, 0, "oak_log", { pillar_axis: "y" });
      expect(api.get(0, 0, 0)).to.equal("minecraft:dirt");
      expect(api.getStates(1, 0, 0)).to.deep.equal({ pillar_axis: "y" });
      expect(api.get(-1, 0, 0)).to.equal("minecraft:air");
    });
  });

  it("is deterministic for random and pick with the same seed", () => {
    const make = (seed: number) =>
      runDirect((api) => {
        api.declareSize(8, 1, 8);
        api.fill(0, 0, 0, 7, 0, 7, api.pick("stone", "cobblestone", ["oak_log", { pillar_axis: "x" }]));
        api.set(Math.floor(api.random() * 8), 0, 0, "gold_block");
      }, seed);
    const a = make(42);
    const b = make(42);
    const c = make(43);
    expect(Array.from(a.packed)).to.deep.equal(Array.from(b.packed));
    expect(a.names).to.deep.equal(b.names);
    expect(Array.from(a.packed)).to.not.deep.equal(Array.from(c.packed));
  });

  it("fails with a budget error when the op budget is exceeded", () => {
    const builder = createStructureBuilder({ mode: "generate", opBudget: 10 }, undefined);
    builder.api.declareSize(8, 8, 8);
    expect(() => builder.api.fill(0, 0, 0, 7, 7, 7, "stone")).to.throw(/^BudgetError: /);
  });

  it("rejects invalid states", () => {
    runDirect((api) => {
      api.declareSize(2, 2, 2);
      expect(() => api.set(0, 0, 0, "stone", [1])).to.throw(TypeError);
      expect(() => api.set(0, 0, 0, "stone", { a: { nested: 1 } })).to.throw(TypeError);
      expect(() => api.set(0, 0, 0, "")).to.throw(TypeError);
    });
  });

  const badNumericStates = [1.9, NaN, Infinity, -Infinity, 2147483648, -2147483649];
  for (const value of badNumericStates) {
    it(`rejects the numeric state ${value}`, () => {
      runDirect((api) => {
        api.declareSize(2, 2, 2);
        expect(() => api.set(0, 0, 0, "stone", { a: value })).to.throw(TypeError, /whole number/);
      });
    });
  }

  it("accepts numeric states at the int32 bounds", () => {
    const result = runDirect((api) => {
      api.declareSize(2, 2, 2);
      api.set(0, 0, 0, "stone", { a: 2147483647 });
      api.set(1, 0, 0, "stone", { a: -2147483648 });
    });
    expect(result.writeCount).to.equal(2);
  });

  it("reads the base volume in edit mode and overlays writes", () => {
    const indices = new Int32Array(2 * 1 * 1).fill(-1);
    indices[1] = 0;
    const base: IStructureBaseVolume = {
      sizeX: 2,
      sizeY: 1,
      sizeZ: 1,
      names: ["minecraft:oak_log"],
      statesJson: ['{"pillar_axis":"y"}'],
      indices,
    };
    const builder = createStructureBuilder({ mode: "edit" }, base);
    const api = builder.api;
    api.declareSize(50, 50, 50);
    expect([api.sizeX, api.sizeY, api.sizeZ]).to.deep.equal([2, 1, 1]);
    expect(api.get(0, 0, 0)).to.equal("minecraft:air");
    expect(api.get(1, 0, 0)).to.equal("minecraft:oak_log");
    expect(api.getStates(1, 0, 0)).to.deep.equal({ pillar_axis: "y" });
    api.set(1, 0, 0, "stone");
    expect(api.get(1, 0, 0)).to.equal("minecraft:stone");
  });

  it("serializes to a self-contained function", () => {
    // The DSL is injected into QuickJS via toString(); it must not reference module-level bindings.
    const source = createStructureBuilder.toString();
    const rebuilt = new Function(`return (${source});`)();
    const builder = rebuilt({ mode: "generate" }, undefined);
    builder.api.declareSize(2, 2, 2);
    builder.api.fill(0, 0, 0, 1, 1, 1, "stone");
    expect(builder.finish().writeCount).to.equal(8);
  });
});

describe("StructureProgramValidation", () => {
  const cases: { name: string; code: string; ok: boolean; error?: RegExp }[] = [
    { name: "function build", code: "function build(api) { api.declareSize(1,1,1); }", ok: true },
    { name: "arrow build", code: "const build = (api) => { };", ok: true },
    { name: "empty", code: "   ", ok: false, error: /No build program/ },
    { name: "no build", code: "function make(api) {}", ok: false, error: /build\(api\)/ },
    { name: "import", code: "import fs from 'fs';\nfunction build(api) {}", ok: false, error: /import/ },
    { name: "require", code: "function build(api) { require('fs'); }", ok: false, error: /import\/require/ },
    { name: "async", code: "async function build(api) {}", ok: false, error: /synchronous/ },
    { name: "fetch", code: "function build(api) { fetch('x'); }", ok: false, error: /fetch/ },
    { name: "timers", code: "function build(api) { setTimeout(() => {}, 1); }", ok: false, error: /setTimeout/ },
    {
      name: "keywords inside comments and strings",
      code: "// import the window layout\nfunction build(api) { /* async */ const window = 'glass_pane'; api.set(0,0,0,'fetch'); }",
      ok: true,
    },
    { name: "too large", code: "function build(api) {}" + " ".repeat(200_001), ok: false, error: /too large/ },
  ];

  for (const tc of cases) {
    it(`validates ${tc.name}`, () => {
      const result = StructureProgramValidation.validate(tc.code);
      expect(result.ok).to.equal(tc.ok);
      if (tc.error) {
        expect(result.error).to.match(tc.error);
      }
    });
  }

  it("extracts a program from a fenced block", () => {
    const text = "Here you go:\n```js\nfunction build(api) { api.declareSize(1,1,1); }\n```\nDone.";
    expect(StructureProgramValidation.extractProgram(text).trim()).to.equal(
      "function build(api) { api.declareSize(1,1,1); }"
    );
  });
});

describe("StructureProgramSandbox", function () {
  this.timeout(30000);

  it("runs a program and returns its journal", async () => {
    const result = await StructureProgramSandbox.run({
      code: `function build(api) {
        api.declareSize(4, 3, 4);
        api.fill(0, 0, 0, 3, 0, 3, "stone");
        api.hollowBox(0, 1, 0, 3, 2, 3, "oak_planks");
        console.log("size", api.sizeX, { h: api.sizeY });
      }`,
      options: { mode: "generate" },
    });
    expect(result.ok, resultSummary(result)).to.equal(true);
    if (!result.ok) {
      return;
    }
    expect(result.journal.sizeX).to.equal(4);
    expect(result.journal.xs.length).to.equal(16 + 32);
    expect(result.journal.names).to.deep.equal(["minecraft:stone", "minecraft:oak_planks"]);
    expect(result.logs).to.deep.equal(['size 4 {"h":3}']);
  });

  it("matches the direct DSL output for the same seed", async () => {
    const code = `function build(api) {
      api.declareSize(10, 1, 10);
      api.fill(0, 0, 0, 9, 0, 9, api.pick("stone", "andesite", "diorite"));
      for (let i = 0; i < 5; i++) api.set(Math.floor(Math.random() * 10), 0, 0, "gold_block");
    }`;
    const sandboxed = await StructureProgramSandbox.run({ code, options: { mode: "generate", seed: 7 } });
    const direct = createStructureBuilder({ mode: "generate", seed: 7 }, undefined);
    const api = direct.api as any;
    api.declareSize(10, 1, 10);
    api.fill(0, 0, 0, 9, 0, 9, api.pick("stone", "andesite", "diorite"));
    for (let i = 0; i < 5; i++) api.set(Math.floor(api.random() * 10), 0, 0, "gold_block");
    const directResult = direct.finish();

    expect(sandboxed.ok).to.equal(true);
    if (!sandboxed.ok) {
      return;
    }
    expect(Array.from(sandboxed.journal.xs)).to.deep.equal(
      Array.from({ length: directResult.writeCount }, (_, i) => directResult.packed[i * 4])
    );
    expect(Array.from(sandboxed.journal.tableIdx)).to.deep.equal(
      Array.from({ length: directResult.writeCount }, (_, i) => directResult.packed[i * 4 + 3])
    );
  });

  it("passes the base volume through in edit mode", async () => {
    const indices = new Int32Array([0, -1]);
    const result = await StructureProgramSandbox.run({
      code: `function build(api) {
        if (api.get(0, 0, 0) === "minecraft:oak_log") api.set(1, 0, 0, "glass");
        console.log(JSON.stringify(api.getStates(0, 0, 0)));
      }`,
      options: { mode: "edit" },
      base: {
        sizeX: 2,
        sizeY: 1,
        sizeZ: 1,
        names: ["minecraft:oak_log"],
        statesJson: ['{"pillar_axis":"x"}'],
        indices,
      },
    });
    expect(result.ok, resultSummary(result)).to.equal(true);
    if (!result.ok) {
      return;
    }
    expect(result.journal.names).to.deep.equal(["minecraft:glass"]);
    expect(Array.from(result.journal.xs)).to.deep.equal([1]);
    expect(result.logs).to.deep.equal(['{"pillar_axis":"x"}']);
  });

  const failureCases: { name: string; code: string; reason: string; detail?: RegExp; limits?: any }[] = [
    {
      name: "runtime errors with a line number",
      code: "function build(api) {\n  api.declareSize(2,2,2);\n  undefinedThing.go();\n}",
      reason: "runtime",
      detail: /ReferenceError.*line 3/,
    },
    { name: "missing build", code: "const x = 1;", reason: "runtime", detail: /build\(api\)/ },
    { name: "syntax errors", code: "function build(api) { api.set(( }", reason: "syntax", detail: /SyntaxError/ },
    {
      name: "infinite loops",
      code: "function build(api) { while (true) {} }",
      reason: "timeout",
      limits: { timeoutMs: 300 },
    },
    {
      name: "memory bombs",
      code: "function build(api) { const a = []; while (true) a.push(new Array(100000).fill(1)); }",
      reason: "memory",
      limits: { memoryLimitBytes: 16 * 1024 * 1024 },
    },
    {
      name: "unbounded recursion",
      code: "function build(api) { function f() { return f() + 1; } f(); }",
      reason: "memory",
    },
    {
      name: "the op budget",
      code: "function build(api) { api.declareSize(64,64,64); api.fill(0,0,0,63,63,63,'stone'); }",
      reason: "budget",
      detail: /1000-block budget/,
      limits: { opBudget: 1000 },
    },
    {
      name: "a megabyte block name",
      code: "function build(api) { api.declareSize(1,1,1); api.set(0,0,0,'x'.repeat(1000000)); }",
      reason: "budget",
      detail: /at most 256 characters/,
    },
    {
      name: "a block name just over the limit",
      code: "function build(api) { api.declareSize(1,1,1); api.set(0,0,0,'minecraft:' + 'x'.repeat(247)); }",
      reason: "budget",
      detail: /at most 256 characters/,
    },
    {
      name: "a long state value",
      code: "function build(api) { api.declareSize(1,1,1); api.set(0,0,0,'stone',{ s: 'v'.repeat(257) }); }",
      reason: "budget",
      detail: /longer than 256/,
    },
    {
      name: "too many states",
      code:
        "function build(api) { api.declareSize(1,1,1); const s = {};" +
        " for (let i = 0; i < 33; i++) s['k' + i] = i; api.set(0,0,0,'stone',s); }",
      reason: "budget",
      detail: /at most 32 states/,
    },
    {
      name: "too many distinct blocks",
      code: "function build(api) { api.declareSize(1,1,1); for (let i = 0; i < 4097; i++) api.set(0,0,0,'b' + i); }",
      reason: "budget",
      detail: /more than 4096 different/,
    },
    {
      name: "a constructor state name",
      code: "function build(api) { api.declareSize(1,1,1); api.set(0,0,0,'stone',{ constructor: 1 }); }",
      reason: "runtime",
      detail: /'constructor' isn't allowed/,
    },
    {
      name: "a state name with a quote",
      code: `function build(api) { api.declareSize(1,1,1); api.set(0,0,0,'stone',{ 'a"b': 1 }); }`,
      reason: "runtime",
      detail: /can only use letters/,
    },
    {
      name: "a fractional state value",
      code: "function build(api) { api.declareSize(1,1,1); api.set(0,0,0,'stone',{ a: 1.5 }); }",
      reason: "runtime",
      detail: /whole number/,
    },
    {
      name: "a block name with a control character",
      code: "function build(api) { api.declareSize(1,1,1); api.set(0,0,0,'sto\\u0001ne'); }",
      reason: "runtime",
      detail: /control character/,
    },
  ];

  for (const tc of failureCases) {
    it(`reports ${tc.name}`, async () => {
      const result = await StructureProgramSandbox.run({
        code: tc.code,
        options: { mode: "generate" },
        limits: tc.limits,
      });
      expect(result.ok).to.equal(false);
      if (result.ok) {
        return;
      }
      expect(result.reason, result.detail).to.equal(tc.reason);
      if (tc.detail) {
        expect(result.detail).to.match(tc.detail);
      }
    });
  }

  const escapeProbes = [
    "typeof process",
    "typeof require",
    "typeof fetch",
    "typeof module",
    "typeof __dirname",
    "typeof api.set.constructor('return this')().process",
    "(function(){}).constructor('return typeof require')()",
    "typeof Object.getPrototypeOf(api).constructor.constructor('return process')()",
  ];

  it("does not expose host capabilities to programs", async () => {
    const code =
      `function build(api) {\n` +
      escapeProbes
        .map(
          (p) =>
            `  try { console.log(${JSON.stringify(p)} + " => " + (${p})); } catch (e) { console.log(${JSON.stringify(p)} + " => threw"); }`
        )
        .join("\n") +
      `\n}`;
    const result = await StructureProgramSandbox.run({ code, options: { mode: "generate" } });
    expect(result.ok, resultSummary(result)).to.equal(true);
    for (const line of result.logs) {
      expect(line).to.match(/=> (undefined|threw|string)$/, line);
      expect(line).to.not.match(/=> (object|function)$/);
    }
    expect(result.logs.length).to.equal(escapeProbes.length);
  });

  it("caps console output", async () => {
    const result = await StructureProgramSandbox.run({
      code: "function build(api) { for (let i = 0; i < 1000; i++) console.log('x'.repeat(1000)); }",
      options: { mode: "generate" },
    });
    expect(result.logs.length).to.equal(101);
    expect(result.logs[0].length).to.be.lessThan(510);
  });

  it("keeps runs isolated from each other", async () => {
    const first = await StructureProgramSandbox.run({
      code: "globalThis.leaked = 1; function build(api) {}",
      options: { mode: "generate" },
    });
    expect(first.ok).to.equal(true);
    const second = await StructureProgramSandbox.run({
      code: "function build(api) { console.log(typeof leaked); }",
      options: { mode: "generate" },
    });
    expect(second.logs).to.deep.equal(["undefined"]);
  });

  for (const tc of [
    { name: "Date.now()", body: "api.set(0, 0, 0, Date.now() % 2 ? 'stone' : 'dirt');" },
    { name: "new Date()", body: "api.set(0, 0, 0, new Date().getSeconds() % 2 ? 'stone' : 'dirt');" },
    {
      name: "globalThis.Date",
      body: "const D = globalThis['Da' + 'te']; api.set(0, 0, 0, D.now() ? 'stone' : 'dirt');",
    },
    { name: "typeof Date", body: "api.set(0, 0, 0, typeof Date === 'function' ? 'stone' : 'dirt');" },
    {
      name: "the property's getter",
      body: "const g = Object.getOwnPropertyDescriptor(globalThis, 'Date').get; api.set(0, 0, 0, g().now() ? 'stone' : 'dirt');",
    },
  ]) {
    it(`rejects a program that reads the clock via ${tc.name}`, async () => {
      const result = await StructureProgramSandbox.run({
        code: `function build(api) { api.declareSize(1, 1, 1); ${tc.body} }`,
        options: { mode: "generate" },
      });
      expect(result.ok).to.equal(false);
      if (result.ok) {
        return;
      }
      expect(result.reason).to.equal("runtime");
      expect(result.detail).to.contain("Date isn't available in structure programs");
      expect(result.detail).to.contain("line 1");
    });
  }

  for (const tc of [
    { name: "assigning it", body: "Date = function () {};" },
    { name: "redefining it", body: "Object.defineProperty(globalThis, 'Date', { value: 1 });" },
    { name: "deleting it", body: "delete globalThis.Date;" },
  ]) {
    it(`doesn't let a program restore a clock by ${tc.name}`, async () => {
      const result = await StructureProgramSandbox.run({
        code: `function build(api) { api.declareSize(1, 1, 1); ${tc.body} }`,
        options: { mode: "generate" },
      });
      expect(result.ok).to.equal(false);
      expect(result.ok === false && result.detail).to.match(/^TypeError/);
    });
  }

  it("replays a seeded program to the same journal", async () => {
    const code = `function build(api) {
      api.declareSize(4, 4, 4);
      for (let i = 0; i < 20; i++) {
        api.set(Math.floor(Math.random() * 4), Math.floor(api.random() * 4), i % 4, api.pick("stone", "dirt", "sand"));
      }
    }`;
    const journals: unknown[] = [];
    for (let i = 0; i < 2; i++) {
      const result = await StructureProgramSandbox.run({ code, options: { mode: "generate", seed: 99 } });
      expect(result.ok, resultSummary(result)).to.equal(true);
      if (result.ok) {
        const { xs, ys, zs, tableIdx, names } = result.journal;
        journals.push([Array.from(xs), Array.from(ys), Array.from(zs), Array.from(tableIdx), names]);
      }
    }
    expect(journals[1]).to.deep.equal(journals[0]);
  });

  it("ignores a program's attempts to replace the builder's result", async () => {
    const result = await StructureProgramSandbox.run({
      code: `function build(api) {
        api.declareSize(2, 1, 1);
        api.set(0, 0, 0, "stone");
        const forged = { finish() { return { writeCount: 1e9, names: [], statesJson: [], oobCount: 0, sizeX: 1e6, sizeY: 1, sizeZ: 1 }; } };
        globalThis.__mctBuilder = forged;
        globalThis.builder = forged;
        JSON.stringify = function () { return '{"writeCount":1000000000,"sizeX":1000000}'; };
      }`,
      options: { mode: "generate" },
    });
    expect(result.ok, resultSummary(result)).to.equal(true);
    if (!result.ok) {
      return;
    }
    expect([result.journal.sizeX, result.journal.sizeY, result.journal.sizeZ]).to.deep.equal([2, 1, 1]);
    expect(result.journal.xs.length).to.equal(1);
    expect(result.journal.names).to.deep.equal(["minecraft:stone"]);
  });

  it("rejects a result whose block data was tampered with", async () => {
    const result = await StructureProgramSandbox.run({
      code: `function build(api) {
        api.declareSize(2, 1, 1);
        api.set(0, 0, 0, "stone");
        ArrayBuffer.prototype.slice = function () { return new ArrayBuffer(4); };
      }`,
      options: { mode: "generate" },
    });
    expect(result.ok).to.equal(false);
    if (result.ok) {
      return;
    }
    expect(result.reason).to.equal("runtime");
    expect(result.detail).to.match(/inconsistent result/);
  });

  const tamperCases = [
    {
      name: "Array.prototype.push throws",
      setup: "Array.prototype.push = function () { throw new Error('tampered push'); };",
    },
    {
      name: "Array.prototype has an index getter",
      setup: "Object.defineProperty(Array.prototype, '0', { get() { return 'forged'; }, set() {} });",
    },
    {
      name: "Map.prototype.get is replaced",
      setup: "Map.prototype.get = function () { return 999999; }; Map.prototype.set = function () { return this; };",
    },
    {
      name: "Object.prototype and Array.prototype have toJSON",
      setup:
        "Object.prototype.toJSON = function () { return { forged: true }; };" +
        " Array.prototype.toJSON = function () { return 'forged'; };",
    },
    {
      name: "String.prototype methods are replaced",
      setup:
        "String.prototype.toLowerCase = function () { return 'minecraft:forged'; };" +
        " String.prototype.trim = function () { return ''; };",
    },
  ];

  for (const tc of tamperCases) {
    it(`keeps its result intact when ${tc.name}`, async () => {
      const result = await StructureProgramSandbox.run({
        code: `function build(api) {
          ${tc.setup}
          api.declareSize(2, 1, 1);
          api.set(0, 0, 0, "stone");
          api.set(1, 0, 0, "oak_log", { pillar_axis: "x" });
        }`,
        options: { mode: "generate" },
      });
      expect(result.ok, resultSummary(result)).to.equal(true);
      if (!result.ok) {
        return;
      }
      expect(result.journal.names).to.deep.equal(["minecraft:stone", "minecraft:oak_log"]);
      expect(result.journal.statesJson).to.deep.equal(["", '{"pillar_axis":"x"}']);
      expect(Array.from(result.journal.xs)).to.deep.equal([0, 1]);
    });
  }

  it("accepts names and states exactly at the table limits", async () => {
    const result = await StructureProgramSandbox.run({
      code: `function build(api) {
        api.declareSize(1, 1, 1);
        const s = {};
        for (let i = 0; i < 31; i++) s["k" + i] = i;
        s["x".repeat(64)] = "v".repeat(256);
        api.set(0, 0, 0, "minecraft:" + "n".repeat(246), s);
      }`,
      options: { mode: "generate" },
    });
    expect(result.ok, resultSummary(result)).to.equal(true);
    if (!result.ok) {
      return;
    }
    expect(result.journal.names[0].length).to.equal(256);
    expect(Object.keys(JSON.parse(result.journal.statesJson[0])).length).to.equal(32);
  });

  const validMeta = { writeCount: 2, names: ["a"], statesJson: [""], oobCount: 0, sizeX: 2, sizeY: 1, sizeZ: 1 };
  const generateExpect = { mode: "generate" as const, maxAxis: 128, maxVolume: 128 * 64 * 128 };
  const metaCases: { name: string; meta: unknown; bytes?: number; expect?: any; problem?: RegExp }[] = [
    { name: "consistent metadata", meta: validMeta },
    { name: "missing metadata", meta: undefined, problem: /missing/ },
    { name: "an array", meta: [], problem: /missing/ },
    { name: "a negative size", meta: { ...validMeta, sizeX: -1 }, problem: /sizeX/ },
    { name: "a fractional size", meta: { ...validMeta, sizeY: 1.5 }, problem: /sizeY/ },
    { name: "a size over the axis cap", meta: { ...validMeta, sizeZ: 129 }, problem: /sizeZ/ },
    {
      name: "a size over the volume cap",
      meta: { ...validMeta, sizeX: 128, sizeY: 128, sizeZ: 128 },
      problem: /exceeds/,
    },
    { name: "a string writeCount", meta: { ...validMeta, writeCount: "2" }, problem: /writeCount/ },
    { name: "a byte length mismatch", meta: validMeta, bytes: 16, problem: /length/ },
    { name: "a huge writeCount", meta: { ...validMeta, writeCount: 1e9 }, problem: /length/ },
    { name: "a bad oobCount", meta: { ...validMeta, oobCount: -3 }, problem: /oobCount/ },
    { name: "mismatched tables", meta: { ...validMeta, statesJson: [] }, problem: /same length/ },
    { name: "non-array names", meta: { ...validMeta, names: "a" }, problem: /same length/ },
    { name: "a non-string name", meta: { ...validMeta, names: [7] }, problem: /entry 0/ },
    { name: "a non-string state", meta: { ...validMeta, statesJson: [{}] }, problem: /entry 0/ },
    {
      name: "an edit size that differs from the base",
      meta: validMeta,
      expect: { ...generateExpect, mode: "edit", base: { sizeX: 3, sizeY: 1, sizeZ: 1 } },
      problem: /does not match/,
    },
    {
      name: "an edit size that matches the base",
      meta: validMeta,
      expect: { ...generateExpect, mode: "edit", base: { sizeX: 2, sizeY: 1, sizeZ: 1 } },
    },
    { name: "edit mode without a base", meta: validMeta, expect: { ...generateExpect, mode: "edit" }, problem: /base/ },
    { name: "a too-long name", meta: { ...validMeta, names: ["n".repeat(257)] }, problem: /name that isn't 1 to 256/ },
    { name: "an empty name", meta: { ...validMeta, names: [""] }, problem: /name that isn't 1 to 256/ },
    { name: "a name with a control character", meta: { ...validMeta, names: ["a\u0000b"] }, problem: /control/ },
    { name: "states that aren't JSON", meta: { ...validMeta, statesJson: ["{bad"] }, problem: /valid JSON/ },
    { name: "array states", meta: { ...validMeta, statesJson: ["[1]"] }, problem: /aren't an object/ },
    { name: "empty object states", meta: { ...validMeta, statesJson: ["{}"] }, problem: /1 to 32 states/ },
    {
      name: "a forbidden state name",
      meta: { ...validMeta, statesJson: ['{"constructor":1}'] },
      problem: /state name that isn't allowed/,
    },
    {
      name: "a __proto__ state name",
      meta: { ...validMeta, statesJson: ['{"__proto__":1}'] },
      problem: /state name that isn't allowed/,
    },
    {
      name: "too many states",
      meta: {
        ...validMeta,
        statesJson: [JSON.stringify(Object.fromEntries(Array.from({ length: 33 }, (_, i) => ["k" + i, i])))],
      },
      problem: /1 to 32 states/,
    },
    {
      name: "a fractional state value",
      meta: { ...validMeta, statesJson: ['{"a":1.5}'] },
      problem: /value for 'a'/,
    },
    {
      name: "a nested state value",
      meta: { ...validMeta, statesJson: ['{"a":{}}'] },
      problem: /value for 'a'/,
    },
    {
      name: "a long state value",
      meta: { ...validMeta, statesJson: [JSON.stringify({ a: "v".repeat(257) })] },
      problem: /value for 'a'/,
    },
    {
      name: "valid states",
      meta: { ...validMeta, statesJson: ['{"facing_direction":2,"open_bit":true,"wood_type":"oak"}'] },
    },
    {
      name: "too many table entries",
      meta: { ...validMeta, names: new Array(4097).fill("a"), statesJson: new Array(4097).fill("") },
      problem: /more than 4096 entries/,
    },
    {
      name: "a table over the character cap",
      meta: {
        ...validMeta,
        names: new Array(300).fill("a"),
        statesJson: new Array(300).fill(
          JSON.stringify(Object.fromEntries(Array.from({ length: 15 }, (_, i) => ["k" + i, "v".repeat(256)])))
        ),
      },
      problem: /longer than 1048576/,
    },
  ];

  for (const tc of metaCases) {
    it(`validates finish metadata: ${tc.name}`, () => {
      const problem = StructureProgramSandboxCore.validateFinishMeta(
        tc.meta,
        tc.bytes ?? 32,
        tc.expect ?? generateExpect
      );
      if (tc.problem) {
        expect(problem).to.match(tc.problem);
      } else {
        expect(problem).to.equal(undefined);
      }
    });
  }

  it("bounds console formatting of large and deeply nested values", async () => {
    const result = await StructureProgramSandbox.run({
      code: `function build(api) {
        console.log("x".repeat(1000000));
        let deep = {};
        for (let i = 0; i < 10000; i++) deep = { child: deep, pad: "y".repeat(100) };
        console.log(deep);
        const wide = [];
        for (let i = 0; i < 100000; i++) wide.push({ i, name: "z".repeat(50) });
        console.warn(wide);
        console.log({ get boom() { throw new Error("nope"); } });
        const cyclic = {}; cyclic.self = cyclic;
        console.log(cyclic);
      }`,
      options: { mode: "generate" },
    });
    expect(result.logs.length).to.equal(5);
    for (const line of result.logs) {
      expect(line.length).to.be.at.most(MAX_LOG_LINE_LENGTH + 10, line.substring(0, 80));
    }
    expect(result.logs[1]).to.match(/\[Object\]/);
    expect(result.logs[2]).to.match(/^warn: \[/);
    expect(result.logs[3]).to.equal("[unprintable]");
  });

  it("keeps the host responsive while a program runs", async function () {
    if (!StructureProgramSandbox.useWorker) {
      this.skip();
    }
    // Warm up so worker startup doesn't count against the measurement.
    await StructureProgramSandbox.run({ code: "function build(api) {}", options: { mode: "generate" } });

    let ticks = 0;
    const interval = setInterval(() => ticks++, 20);
    try {
      const result = await StructureProgramSandbox.run({
        code: "function build(api) { while (true) {} }",
        options: { mode: "generate" },
        limits: { timeoutMs: 1000 },
      });
      expect(result.ok).to.equal(false);
      expect(result.ok === false && result.reason).to.equal("timeout");
    } finally {
      clearInterval(interval);
    }
    // An in-process run would block the event loop for the whole second.
    expect(ticks).to.be.greaterThan(20);
  });

  it("terminates a worker that outlives its deadline", async () => {
    const saved = StructureProgramSandbox.hostGraceMs;
    // A negative grace makes the host deadline fire before QuickJS interrupts the loop.
    StructureProgramSandbox.hostGraceMs = -900;
    try {
      const started = Date.now();
      const result = await StructureProgramSandbox.run({
        code: "function build(api) { while (true) {} }",
        options: { mode: "generate" },
        limits: { timeoutMs: 1000 },
      });
      expect(result.ok).to.equal(false);
      expect(result.ok === false && result.reason).to.equal("timeout");
      expect(Date.now() - started).to.be.lessThan(5000);
    } finally {
      StructureProgramSandbox.hostGraceMs = saved;
    }

    const after = await StructureProgramSandbox.run({
      code: "function build(api) { api.declareSize(1, 1, 1); api.set(0, 0, 0, 'stone'); }",
      options: { mode: "generate" },
    });
    expect(after.ok, resultSummary(after)).to.equal(true);
  });

  it("runs in process when workers are disabled", async () => {
    StructureProgramSandbox.useWorker = false;
    try {
      const result = await StructureProgramSandbox.run({
        code: "function build(api) { api.declareSize(1, 1, 1); api.set(0, 0, 0, 'stone'); }",
        options: { mode: "generate" },
      });
      expect(result.ok, resultSummary(result)).to.equal(true);
    } finally {
      StructureProgramSandbox.useWorker = true;
    }
  });
});

describe("StructureVolumeCodec", () => {
  function randomVolume(seed: number, sizeX: number, sizeY: number, sizeZ: number, paletteSize: number) {
    let s = seed;
    const rand = () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
    const palette = ["minecraft:air"];
    for (let i = 0; i < paletteSize; i++) {
      palette.push(i % 3 === 0 ? `minecraft:block_${i} {facing:${i % 4}}` : `minecraft:block_${i}`);
    }
    const tokens: string[] = [];
    for (let i = 0; i < sizeX * sizeY * sizeZ; i++) {
      tokens.push(rand() < 0.4 ? palette[0] : palette[Math.floor(rand() * palette.length)]);
    }
    return { sizeX, sizeY, sizeZ, tokens };
  }

  const cases = [
    { name: "1-letter palette", seed: 1, size: [5, 3, 4], palette: 6 },
    { name: "full 1-letter palette", seed: 2, size: [9, 2, 9], palette: 52 },
    { name: "2-letter palette", seed: 3, size: [12, 4, 12], palette: 80 },
    { name: "single cell", seed: 4, size: [1, 1, 1], palette: 1 },
  ];

  for (const tc of cases) {
    it(`round-trips a ${tc.name}`, () => {
      const volume = randomVolume(tc.seed, tc.size[0], tc.size[1], tc.size[2], tc.palette);
      const encoded = StructureVolumeCodec.encode(volume);
      const decoded = StructureVolumeCodec.decode(encoded);
      expect(decoded).to.deep.equal(volume);
    });
  }

  it("uses run-length rows and frequency-ordered symbols", () => {
    const air = "minecraft:air";
    const stone = "minecraft:stone";
    const log = "minecraft:oak_log {pillar_axis:y}";
    const encoded = StructureVolumeCodec.encode({
      sizeX: 4,
      sizeY: 1,
      sizeZ: 2,
      tokens: [stone, stone, stone, log, air, air, stone, stone],
    });
    expect(encoded).to.equal(
      [
        "palette:",
        "  . = minecraft:air",
        "  a = minecraft:stone",
        "  b = minecraft:oak_log {pillar_axis:y}",
        "contents (y-layers bottom→top, rows are z, columns are x, run-length encoded):",
        "y0: 3ab / 2.2a",
      ].join("\n")
    );
  });

  it("formats display tokens with sorted states", () => {
    expect(StructureVolumeCodec.displayToken("minecraft:stone", undefined)).to.equal("minecraft:stone");
    expect(
      StructureVolumeCodec.displayToken("minecraft:oak_stairs", { weirdo_direction: 2, upside_down_bit: false })
    ).to.equal("minecraft:oak_stairs {upside_down_bit:false,weirdo_direction:2}");
  });
});

describe("Structure NBT round trip", () => {
  async function roundTrip(structure: Structure) {
    const bytes = structure.getMCStructureBytes();
    expect(bytes).to.not.equal(undefined);
    const loaded = new Structure();
    await loaded.loadFromNbtBytes(bytes as Uint8Array);
    return loaded;
  }

  it("reads bytes from a view with a non-zero byteOffset", async () => {
    const volume = new BlockVolume();
    volume.setMaxDimensions(2, 1, 1);
    volume.x(0).y(0).z(0).typeName = "minecraft:cobblestone";
    volume.x(1).y(0).z(0).typeName = "minecraft:lantern";
    const structure = new Structure();
    structure.cube = volume;
    const bytes = structure.getMCStructureBytes() as Uint8Array;

    // Node Buffers from fs reads are often views into a shared pool.
    const pooled = new Uint8Array(bytes.length + 13);
    pooled.set(bytes, 7);
    const loaded = new Structure();
    await loaded.loadFromNbtBytes(pooled.subarray(7, 7 + bytes.length));

    expect(loaded.cube!.x(0).y(0).z(0).typeName).to.equal("minecraft:cobblestone");
    expect(loaded.cube!.x(1).y(0).z(0).typeName).to.equal("minecraft:lantern");
  });

  function paletteOf(structure: Structure) {
    const palette = structure.nbt?.singleRoot?.find("block_palette")?.getTagChildren() || [];
    return palette.map((entry) => ({
      name: entry.getProperty("name")?.valueAsString,
      version: entry.getProperty("version")?.valueAsInt,
    }));
  }

  it("keeps structure void, explicit air, and waterlogging distinct", async () => {
    const cube = new BlockVolume();
    cube.setMaxDimensions(3, 1, 1);
    cube.x(1).y(0).z(0).typeName = "minecraft:air";
    const stairs = cube.x(2).y(0).z(0);
    stairs.typeName = "minecraft:oak_stairs";
    stairs.ensureProperty("weirdo_direction").value = 1;
    stairs.extraLiquidDepth = 0;
    const structure = new Structure();
    structure.cube = cube;

    const loaded = await roundTrip(structure);
    expect(loaded.isVoidAt(0, 0, 0)).to.equal(true);
    expect(loaded.isVoidAt(1, 0, 0)).to.equal(false);
    expect(loaded.cube?.x(1).y(0).z(0).typeName).to.equal("minecraft:air");
    expect(loaded.cube?.x(2).y(0).z(0).typeName).to.equal("minecraft:oak_stairs");
    expect(loaded.cube?.x(2).y(0).z(0).extraLiquidDepth).to.equal(0);

    const palette = paletteOf(loaded);
    expect(palette.map((p) => p.name)).to.deep.equal(["minecraft:air", "minecraft:oak_stairs", "minecraft:water"]);
    expect(palette.every((p) => p.version === MODERN_BLOCK_PERSISTENCE_VERSION)).to.equal(true);

    // Saving the loaded structure again must not turn void into explicit air.
    const reloaded = await roundTrip(loaded);
    expect(reloaded.isVoidAt(0, 0, 0)).to.equal(true);
    expect(reloaded.isVoidAt(1, 0, 0)).to.equal(false);
  });

  it("writes entities from an IBlockVolume and keeps them on re-save", async () => {
    const structure = StructureUtilities.createStructureFromIBlockVolume({
      southWestBottom: { x: 0, y: 64, z: 0 },
      blockLayersBottomToTop: [["ss", "ss"]],
      key: { s: { typeId: "stone" } },
      entities: [{ typeId: "pig", locationWithinVolume: { x: 1, y: 1, z: 0 } }],
    });
    const loaded = await roundTrip(structure);
    const entityTags = loaded.nbt?.singleRoot?.find("entities")?.getTagChildren() || [];
    expect(entityTags.length).to.equal(1);
    expect(entityTags[0].getProperty("identifier")?.valueAsString).to.equal("minecraft:pig");
    const pos = entityTags[0]
      .getProperty("Pos")
      ?.getTagChildren()
      .map((t) => t.valueAsFloat);
    expect(pos).to.deep.equal([1.5, 65, 0.5]);
    expect(loaded.loadedEntityCount).to.equal(1);

    const reloaded = await roundTrip(loaded);
    expect(reloaded.loadedEntityCount).to.equal(1);
  });

  const OLDER_PERSISTENCE_VERSION = 17959425;

  function stoneRow(versions: number[]) {
    const cube = new BlockVolume();
    cube.setMaxDimensions(versions.length, 1, 1);
    versions.forEach((version, x) => {
      const block = cube.x(x).y(0).z(0);
      block.typeName = "minecraft:stone";
      block.persistenceVersion = version;
    });
    const structure = new Structure();
    structure.cube = cube;
    return structure;
  }

  it("keeps palette entries with the same block but different versions distinct", async () => {
    const loaded = await roundTrip(stoneRow([OLDER_PERSISTENCE_VERSION, -1]));
    expect(loaded.cube!.x(0).y(0).z(0).persistenceVersion).to.equal(OLDER_PERSISTENCE_VERSION);
    expect(loaded.cube!.x(1).y(0).z(0).persistenceVersion).to.equal(MODERN_BLOCK_PERSISTENCE_VERSION);
    expect(paletteOf(loaded).map((p) => p.version)).to.deep.equal([
      OLDER_PERSISTENCE_VERSION,
      MODERN_BLOCK_PERSISTENCE_VERSION,
    ]);
  });

  it("shares one palette entry for the same block, states, and version", async () => {
    const loaded = await roundTrip(
      stoneRow([OLDER_PERSISTENCE_VERSION, OLDER_PERSISTENCE_VERSION, MODERN_BLOCK_PERSISTENCE_VERSION, -1])
    );
    expect(paletteOf(loaded).map((p) => p.version)).to.deep.equal([
      OLDER_PERSISTENCE_VERSION,
      MODERN_BLOCK_PERSISTENCE_VERSION,
    ]);
  });

  it("keeps mixed palette versions when a program edits an unrelated cell", async () => {
    const base = await roundTrip(stoneRow([OLDER_PERSISTENCE_VERSION, MODERN_BLOCK_PERSISTENCE_VERSION, -1]));
    const edited = await StructureProgramRunner.run({
      code: `function build(api) { api.set(2, 0, 0, "dirt"); }`,
      base,
    });
    expect(edited.ok, resultSummary(edited)).to.equal(true);
    if (!edited.ok) {
      return;
    }
    const loaded = await roundTrip(edited.realized.structure);
    expect(loaded.cube!.x(0).y(0).z(0).persistenceVersion).to.equal(OLDER_PERSISTENCE_VERSION);
    expect(loaded.cube!.x(1).y(0).z(0).persistenceVersion).to.equal(MODERN_BLOCK_PERSISTENCE_VERSION);
    expect(loaded.cube!.x(2).y(0).z(0).typeName).to.equal("minecraft:dirt");
    expect(
      paletteOf(loaded)
        .filter((p) => p.name === "minecraft:stone")
        .map((p) => p.version)
    ).to.deep.equal([OLDER_PERSISTENCE_VERSION, MODERN_BLOCK_PERSISTENCE_VERSION]);
  });

  /** A 2x1x1 chest + stone structure whose chest at (0,0,0) carries block entity data. */
  async function chestWithContents() {
    const cube = new BlockVolume();
    cube.setMaxDimensions(2, 1, 1);
    cube.x(0).y(0).z(0).typeName = "minecraft:chest";
    cube.x(1).y(0).z(0).typeName = "minecraft:stone";
    const structure = new Structure();
    structure.cube = cube;
    const nbt = structure.createNbt()!;
    const positionData = nbt.singleRoot!.find("block_position_data")!;
    const entry = positionData.addTag(NbtTagType.compound, "0");
    const entityData = entry.addTag(NbtTagType.compound, "block_entity_data");
    entityData.addTag(NbtTagType.string, "id").value = "Chest";
    entityData.addTag(NbtTagType.string, "CustomName").value = "loot marker";
    const loaded = new Structure();
    await loaded.loadFromNbtBytes(nbt.toBinary()!);
    return loaded;
  }

  function chestMarker(structure: Structure) {
    return structure.getBlockPositionData(0, 0, 0)?.find("block_entity_data")?.getProperty("CustomName")?.valueAsString;
  }

  it("keeps block entity data through save, reload, and an unrelated program edit", async () => {
    const base = await chestWithContents();
    expect(chestMarker(base)).to.equal("loot marker");
    expect(chestMarker(await roundTrip(base))).to.equal("loot marker");

    const edited = await StructureProgramRunner.run({
      code: `function build(api) { api.set(1, 0, 0, "gold_block"); }`,
      base,
    });
    expect(edited.ok, resultSummary(edited)).to.equal(true);
    if (!edited.ok) {
      return;
    }
    const loaded = await roundTrip(edited.realized.structure);
    expect(loaded.cube!.x(1).y(0).z(0).typeName).to.equal("minecraft:gold_block");
    expect(chestMarker(loaded)).to.equal("loot marker");
  });

  it("drops block entity data when a program overwrites that cell", async () => {
    const base = await chestWithContents();
    const edited = await StructureProgramRunner.run({
      code: `function build(api) { api.set(0, 0, 0, "barrel"); }`,
      base,
    });
    expect(edited.ok, resultSummary(edited)).to.equal(true);
    if (!edited.ok) {
      return;
    }
    const loaded = await roundTrip(edited.realized.structure);
    expect(loaded.cube!.x(0).y(0).z(0).typeName).to.equal("minecraft:barrel");
    expect(loaded.getBlockPositionData(0, 0, 0)).to.equal(undefined);
    expect(loaded.nbt?.singleRoot?.find("block_position_data")?.getTagChildren().length).to.equal(0);
  });

  /** A loaded 2x2x2 structure: void at even (x+y+z), explicit air elsewhere, a chest entity at (1,1,0). */
  async function voidAndAirCheckerboard() {
    const cube = new BlockVolume();
    cube.setMaxDimensions(2, 2, 2);
    for (let x = 0; x < 2; x++) {
      for (let y = 0; y < 2; y++) {
        for (let z = 0; z < 2; z++) {
          if ((x + y + z) % 2 === 1) {
            cube.x(x).y(y).z(z).typeName = "minecraft:air";
          }
        }
      }
    }
    cube.x(1).y(1).z(1).typeName = "minecraft:chest";
    const structure = new Structure();
    structure.cube = cube;
    const nbt = structure.createNbt()!;
    // mcstructure index of (1,1,1) in a 2x2x2 volume is (1*2+1)*2+1 = 7.
    const entry = nbt.singleRoot!.find("block_position_data")!.addTag(NbtTagType.compound, "7");
    entry.addTag(NbtTagType.compound, "block_entity_data").addTag(NbtTagType.string, "CustomName").value = "kept";
    const loaded = new Structure();
    await loaded.loadFromNbtBytes(nbt.toBinary()!);
    return loaded;
  }

  function expectCheckerboardMeaning(structure: Structure, maxX: number, maxY: number, maxZ: number) {
    for (let x = 0; x < maxX; x++) {
      for (let y = 0; y < maxY; y++) {
        for (let z = 0; z < maxZ; z++) {
          const where = `(${x},${y},${z})`;
          if (x === 1 && y === 1 && z === 1) {
            expect(structure.cube!.x(x).y(y).z(z).typeName, where).to.equal("minecraft:chest");
          } else if (x < 2 && y < 2 && z < 2) {
            expect(structure.isVoidAt(x, y, z), where).to.equal((x + y + z) % 2 === 0);
          } else {
            expect(structure.isVoidAt(x, y, z), `new cell ${where}`).to.equal(true);
          }
        }
      }
    }
  }

  for (const [label, dims] of [
    ["grows X, Y, and Z", [3, 3, 3]],
    ["grows only Z", [2, 2, 4]],
    ["grows Y and shrinks Z", [2, 4, 1]],
  ] as [string, [number, number, number]][]) {
    it(`keeps void, explicit air, and block entities by coordinate when the cube ${label}`, async () => {
      const structure = await voidAndAirCheckerboard();
      // The editor resizes the same BlockVolume in place and assigns it back.
      structure.cube!.resize(dims[0], dims[1], dims[2]);
      structure.cube = structure.cube;

      const loaded = await roundTrip(structure);
      expectCheckerboardMeaning(loaded, dims[0], dims[1], dims[2]);
      const keptChest = dims[2] > 1;
      expect(
        loaded.getBlockPositionData(1, 1, 1)?.find("block_entity_data")?.getProperty("CustomName")?.valueAsString
      ).to.equal(keptChest ? "kept" : undefined);
    });
  }

  it("turns a loaded void cell into explicit air with clearVoidAt, and back with setVoidAt", async () => {
    const structure = await voidAndAirCheckerboard();
    expect(structure.isVoidAt(0, 0, 0)).to.equal(true);

    // The editor path: write the block type, then mark the cell as explicitly written.
    structure.cube!.x(0).y(0).z(0).typeName = "minecraft:air";
    structure.clearVoidAt(0, 0, 0);
    let loaded = await roundTrip(structure);
    expect(loaded.isVoidAt(0, 0, 0)).to.equal(false);
    expect(loaded.cube!.x(0).y(0).z(0).typeName).to.equal("minecraft:air");

    loaded.setVoidAt(0, 1, 1, true);
    loaded.setVoidAt(1, 1, 1, true);
    loaded = await roundTrip(loaded);
    expect(loaded.isVoidAt(0, 1, 1)).to.equal(true);
    expect(loaded.isVoidAt(1, 1, 1)).to.equal(true);
    expect(loaded.getBlockPositionData(1, 1, 1)).to.equal(undefined);
  });
});

describe("StructureProgramRunner", function () {
  this.timeout(30000);

  it("generates a structure with void, explicit air, and diagnostics", async () => {
    const result = await StructureProgramRunner.run({
      code: `function build(api) {
        api.declareSize(5, 4, 5);
        api.fill(0, 0, 0, 4, 0, 4, "stone");
        api.fill(1, 1, 1, 3, 2, 3, "air");
        api.set(2, 3, 2, "not_a_real_block");
        api.set(0, 3, 0, "mymod:custom_block");
        api.set(9, 9, 9, "stone");
        console.log("done");
      }`,
    });
    expect(result.ok, resultSummary(result)).to.equal(true);
    if (!result.ok) {
      return;
    }
    const { realized } = result;
    expect([realized.sizeX, realized.sizeY, realized.sizeZ]).to.deep.equal([5, 4, 5]);
    expect(realized.blockCount).to.equal(25 + 2);
    expect(realized.airCount).to.equal(18);
    expect(realized.unknownNames).to.deep.equal(["minecraft:not_a_real_block"]);
    expect(result.oobCount).to.equal(1);
    expect(result.logs).to.deep.equal(["done"]);
    expect(result.warnings.join("\n"))
      .to.match(/not_a_real_block/)
      .and.to.match(/outside/);

    const structure = realized.structure;
    expect(structure.cube?.x(2).y(3).z(2).typeName).to.equal("minecraft:stone");
    expect(structure.cube?.x(0).y(3).z(0).typeName).to.equal("mymod:custom_block");
    expect(structure.isVoidAt(4, 3, 4)).to.equal(true);
    expect(structure.isVoidAt(2, 1, 2)).to.equal(false);
  });

  it("edits an existing structure and preserves untouched cells", async () => {
    const generated = await StructureProgramRunner.run({
      code: `function build(api) {
        api.declareSize(3, 2, 1);
        api.fill(0, 0, 0, 2, 0, 0, "white_wool");
        api.set(1, 1, 0, "oak_log", { pillar_axis: "x" });
      }`,
    });
    expect(generated.ok).to.equal(true);
    if (!generated.ok) {
      return;
    }
    const base = new Structure();
    await base.loadFromNbtBytes(generated.realized.structure.getMCStructureBytes() as Uint8Array);

    const edited = await StructureProgramRunner.run({
      code: `function build(api) {
        api.declareSize(99, 99, 99);
        for (let x = 0; x < api.sizeX; x++)
          if (api.get(x, 0, 0) === "minecraft:white_wool" && x !== 1) api.set(x, 0, 0, "blue_wool");
        console.log(api.get(1, 1, 0), JSON.stringify(api.getStates(1, 1, 0)));
      }`,
      base,
    });
    expect(edited.ok, resultSummary(edited)).to.equal(true);
    if (!edited.ok) {
      return;
    }
    expect(edited.mode).to.equal("edit");
    const cube = edited.realized.structure.cube!;
    expect([cube.maxX, cube.maxY, cube.maxZ]).to.deep.equal([3, 2, 1]);
    expect(cube.x(0).y(0).z(0).typeName).to.equal("minecraft:blue_wool");
    expect(cube.x(1).y(0).z(0).typeName).to.equal("minecraft:white_wool");
    expect(cube.x(1).y(1).z(0).getProperty("pillar_axis")?.value).to.equal("x");
    expect(edited.realized.structure.isVoidAt(0, 1, 0)).to.equal(true);
    expect(edited.logs).to.deep.equal(['minecraft:oak_log {"pillar_axis":"x"}']);
    expect(edited.realized.structure.originX).to.equal(base.originX);
  });

  const failureCases = [
    { name: "a validation error", code: "function make(api) {}", reason: "validation" },
    { name: "no size", code: "function build(api) { }", reason: "runtime", detail: /declareSize/ },
    {
      name: "an empty structure",
      code: "function build(api) { api.declareSize(2,2,2); api.clear(0,0,0,1,1,1); }",
      reason: "runtime",
      detail: /no blocks/,
    },
  ];

  for (const tc of failureCases) {
    it(`fails with ${tc.name}`, async () => {
      const result = await StructureProgramRunner.run({ code: tc.code });
      expect(result.ok).to.equal(false);
      if (result.ok) {
        return;
      }
      expect(result.reason).to.equal(tc.reason);
      if (tc.detail) {
        expect(result.detail).to.match(tc.detail);
      }
    });
  }

  const editSizeCases = [
    { name: "an axis over 128", size: [129, 1, 1], ok: false },
    { name: "a volume over the cap", size: [128, 128, 128], ok: false },
    { name: "the largest allowed size", size: [128, 64, 128], ok: true },
  ];

  for (const tc of editSizeCases) {
    it(`${tc.ok ? "accepts" : "rejects"} an edit base with ${tc.name}`, () => {
      const cube = new BlockVolume();
      cube.setMaxDimensions(tc.size[0], tc.size[1], tc.size[2]);
      const structure = new Structure();
      structure.cube = cube;
      const problem = StructureProgramRunner.checkEditableSize(structure);
      if (tc.ok) {
        expect(problem).to.equal(undefined);
      } else {
        expect(problem).to.match(/programs can edit at most/);
      }
    });
  }

  it("rejects an oversized edit base before expanding it", async () => {
    const cube = new BlockVolume();
    cube.setMaxDimensions(200, 1, 1);
    cube.x(0).y(0).z(0).typeName = "minecraft:stone";
    const base = new Structure();
    base.cube = cube;
    const result = await StructureProgramRunner.run({ code: "function build(api) {}", base });
    expect(result.ok).to.equal(false);
    expect(result.ok === false && result.reason).to.equal("validation");
  });

  it("is reproducible for a seed", async () => {
    const code = `function build(api) {
      api.declareSize(8, 1, 8);
      api.fill(0, 0, 0, 7, 0, 7, api.pick("stone", "andesite", "diorite", "granite"));
    }`;
    const tokens = async (seed: number) => {
      const result = await StructureProgramRunner.run({ code, seed });
      if (!result.ok) {
        throw new Error(result.detail);
      }
      return StructureProgramRealizer.denseFromStructure(result.realized.structure)!.tokens.join(",");
    };
    expect(await tokens(5)).to.equal(await tokens(5));
    expect(await tokens(5)).to.not.equal(await tokens(6));
  });

  describe("concurrency gate", () => {
    const savedConcurrent = StructureProgramRunner.maxConcurrentRuns;
    const savedQueued = StructureProgramRunner.maxQueuedRuns;
    const spinCode = "function build(api) { let i = 0; while (i >= 0) i++; }";
    const okCode = "function build(api) { api.declareSize(1, 1, 1); api.set(0, 0, 0, 'stone'); }";

    afterEach(() => {
      StructureProgramRunner.maxConcurrentRuns = savedConcurrent;
      StructureProgramRunner.maxQueuedRuns = savedQueued;
    });

    async function runWhileWatching(requests: { code: string; timeoutMs?: number }[]) {
      let peak = 0;
      const timer = setInterval(() => {
        peak = Math.max(peak, StructureProgramRunner.activeRunCount);
      }, 5);
      try {
        const results = await Promise.all(
          requests.map((r) =>
            StructureProgramRunner.run({ code: r.code, limits: r.timeoutMs ? { timeoutMs: r.timeoutMs } : undefined })
          )
        );
        return { results, peak };
      } finally {
        clearInterval(timer);
      }
    }

    it("never runs more than the limit and fails excess requests with busy", async () => {
      StructureProgramRunner.maxConcurrentRuns = 1;
      StructureProgramRunner.maxQueuedRuns = 1;
      const { results, peak } = await runWhileWatching([
        { code: spinCode, timeoutMs: 300 },
        { code: spinCode, timeoutMs: 300 },
        { code: okCode },
      ]);
      expect(peak).to.be.at.most(1);
      expect(results.map((r) => (r.ok ? "ok" : r.reason))).to.deep.equal(["timeout", "timeout", "busy"]);
      expect(StructureProgramRunner.activeRunCount).to.equal(0);
      expect(StructureProgramRunner.queuedRunCount).to.equal(0);
    });

    it("releases the slot exactly once after a timeout, an error, and a success", async () => {
      StructureProgramRunner.maxConcurrentRuns = 2;
      StructureProgramRunner.maxQueuedRuns = 8;
      const { results, peak } = await runWhileWatching([
        { code: spinCode, timeoutMs: 300 },
        { code: "function build(api) { throw new Error('boom'); }" },
        { code: okCode },
        { code: "function build(api) { api.set(0, 0, 0, 'stone'); }" },
        { code: okCode },
      ]);
      expect(peak).to.be.at.most(2);
      expect(results.map((r) => (r.ok ? "ok" : r.reason))).to.deep.equal(["timeout", "runtime", "ok", "runtime", "ok"]);
      expect(StructureProgramRunner.activeRunCount).to.equal(0);
      expect(StructureProgramRunner.queuedRunCount).to.equal(0);

      const after = await StructureProgramRunner.run({ code: okCode });
      expect(after.ok, resultSummary(after)).to.equal(true);
    });

    it("fails queued runs and running workers on shutdown, then accepts new runs", async () => {
      StructureProgramRunner.maxConcurrentRuns = 1;
      StructureProgramRunner.maxQueuedRuns = 2;
      const running = StructureProgramRunner.run({ code: spinCode, limits: { timeoutMs: 20000 } });
      const queued = StructureProgramRunner.run({ code: okCode });
      while (StructureProgramSandbox.activeWorkerCount === 0 || StructureProgramRunner.queuedRunCount === 0) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      await StructureProgramRunner.shutdown();
      const [runningResult, queuedResult] = await Promise.all([running, queued]);
      expect(runningResult.ok).to.equal(false);
      expect(runningResult.ok === false && runningResult.reason).to.equal("internal");
      expect(queuedResult.ok).to.equal(false);
      expect(queuedResult.ok === false && queuedResult.detail).to.match(/shutting down/);
      expect(StructureProgramRunner.activeRunCount).to.equal(0);
      expect(StructureProgramRunner.queuedRunCount).to.equal(0);
      expect(StructureProgramSandbox.activeWorkerCount).to.equal(0);

      const after = await StructureProgramRunner.run({ code: okCode });
      expect(after.ok, resultSummary(after)).to.equal(true);
    });
  });
});

describe("StructureEditLock", () => {
  function deferred() {
    let resolve!: () => void;
    const promise = new Promise<void>((r) => {
      resolve = r;
    });
    return { promise, resolve };
  }

  it("runs work for one key in arrival order, one at a time", async () => {
    const lock = new StructureEditLock();
    const events: string[] = [];
    const gates = [deferred(), deferred(), deferred()];
    const runs = gates.map((gate, i) =>
      lock.run("a", async () => {
        events.push(`start ${i}`);
        await gate.promise;
        events.push(`end ${i}`);
        return i;
      })
    );

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(events).to.deep.equal(["start 0"]);
    gates[2].resolve();
    gates[1].resolve();
    gates[0].resolve();

    expect(await Promise.all(runs)).to.deep.equal([0, 1, 2]);
    expect(events).to.deep.equal(["start 0", "end 0", "start 1", "end 1", "start 2", "end 2"]);
    expect(lock.activeKeyCount).to.equal(0);
  });

  it("runs different keys independently", async () => {
    const lock = new StructureEditLock();
    const gate = deferred();
    const blocked = lock.run("a", () => gate.promise);
    const other = await lock.run("b", async () => "b done");

    expect(other).to.equal("b done");
    expect(lock.activeKeyCount).to.equal(1);
    gate.resolve();
    await blocked;
    expect(lock.activeKeyCount).to.equal(0);
  });

  it("releases the key when work throws", async () => {
    const lock = new StructureEditLock();
    const failed = lock.run("a", async () => {
      throw new Error("boom");
    });
    const next = lock.run("a", async () => "next");

    let error: unknown;
    try {
      await failed;
    } catch (e) {
      error = e;
    }
    expect((error as Error).message).to.equal("boom");
    expect(await next).to.equal("next");
    expect(lock.activeKeyCount).to.equal(0);
  });
});
