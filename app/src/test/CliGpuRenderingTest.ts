// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { assert } from "chai";
import { spawn } from "child_process";
import { Command } from "commander";
import * as fs from "fs";
import * as path from "path";
import { RenderModelCommand } from "../cli/commands/render/RenderModelCommand";
import { RenderBatchCommand } from "../cli/commands/render/RenderBatchCommand";
import { RenderStructureCommand } from "../cli/commands/render/RenderStructureCommand";
import { RenderVanillaCommand } from "../cli/commands/render/RenderVanillaCommand";
import { getRenderGpuOptions } from "../cli/commands/render/RenderGpuOptions";
import TestPaths from "./TestPaths";
import { cliEnv, createTestDataDir } from "./TestDataDir";

describe("CLI GPU options", () => {
  for (const command of [
    new RenderModelCommand(),
    new RenderBatchCommand(),
    new RenderStructureCommand(),
    new RenderVanillaCommand(),
  ]) {
    for (const [flags, preference] of [
      [[], "auto"],
      [["--gpu"], true],
      [["--no-gpu"], false],
      [["--gpu", "--no-gpu"], false],
      [["--no-gpu", "--gpu"], true],
    ] as const) {
      it(`${command.metadata.name}: ${flags.join(" ") || "default"} selects ${preference}`, () => {
        const parser = new Command();
        command.configure(parser);
        parser.parse(["node", "mct", ...flags]);
        assert.deepEqual(getRenderGpuOptions(parser.opts()), { useHardwareGpu: preference });
      });
    }
  }

  it("keeps automatic selection in CI without changing explicit options", () => {
    const previous = process.env.CI;
    process.env.CI = "true";
    try {
      assert.equal(getRenderGpuOptions().useHardwareGpu, "auto");
      assert.equal(getRenderGpuOptions({ gpu: false }).useHardwareGpu, false);
      assert.equal(getRenderGpuOptions({ gpu: true }).useHardwareGpu, true);
    } finally {
      if (previous === undefined) delete process.env.CI;
      else process.env.CI = previous;
    }
  });
});

describe("CLI non-rendering paths do not launch a browser", function () {
  this.timeout(30000);
  const cli = path.resolve(TestPaths.appRoot, "toolbuild/jsn/cli/index.mjs");
  const project = path.resolve(TestPaths.sampleContentPath("simple"));
  const folder = createTestDataDir("gpu-preflight");
  const manifest = path.join(folder, "missing-geometry.json");
  const oversized = path.join(folder, "oversized.json");
  const malformed = path.join(folder, "malformed.json");
  const unreadable = path.join(folder, "manifest-directory");
  const marker = "UNEXPECTED_RENDER_BROWSER_LAUNCH";
  // The built CLI still runs normally. Any attempted browser launch makes the test fail.
  const guard = `
    require(${JSON.stringify(require.resolve("playwright"))}).chromium.launch = async () => {
      process.stderr.write(${JSON.stringify(marker + "\n")});
      throw new Error("A non-rendering path attempted to launch a browser");
    };
    import(require("node:url").pathToFileURL(process.argv[1]).href).catch(error => {
      process.stderr.write(String(error));
      process.exitCode = 1;
    });
  `;

  before(() => {
    fs.writeFileSync(
      manifest,
      JSON.stringify({ renders: [{ geometryPath: "missing.geo.json", outputPath: path.join(folder, "image.png") }] })
    );
    fs.writeFileSync(
      oversized,
      JSON.stringify({
        renders: [
          {
            geometryPath: "unused.geo.json",
            outputPath: path.join(folder, "must-not-write.png"),
            width: 20000,
            height: 20000,
          },
        ],
      })
    );
    fs.writeFileSync(malformed, "{not json");
    fs.mkdirSync(unreadable);
  });

  const cases: {
    name: string;
    args: string[];
    code: number;
    input?: string;
    frames?: number;
    json?: boolean;
    quiet?: boolean;
  }[] = [
    { name: "root help", args: ["--help"], code: 0 },
    { name: "version option", args: ["--version"], code: 0 },
    { name: "version JSON", args: ["version", "--json"], code: 0, json: true },
    ...["rendermodel", "renderbatch", "renderstructure", "rendervanilla"].map((command) => ({
      name: `${command} help`,
      args: [command, "--help"],
      code: 0,
    })),
    ...[
      ["rendermodel", "unused.geo.json"],
      ["renderbatch", oversized],
      ["renderstructure", "unused.mcstructure"],
      ["rendervanilla", "mob", "pig"],
    ].map((args) => ({
      name: `${args[0]} oversized dimensions`,
      args: [...args, "--width", "20000", "--height", "20000", "-i", project],
      code: 1,
    })),
    { name: "oversized batch entry", args: ["renderbatch", oversized, "-i", project], code: 1 },
    {
      name: "oversized initial and subsequent stream requests do not launch",
      args: ["renderbatch", oversized, "--stdin", "-i", project],
      code: 0,
      input: oversized + "\n" + oversized + "\n",
      frames: 3,
    },
    ...[malformed, unreadable].map((file) => ({
      name: `unreadable initial manifest ends the stream (${path.basename(file)})`,
      args: ["renderbatch", file, "--stdin", "-i", project],
      code: 0,
      input: oversized + "\n" + manifest + "\n",
      frames: 1,
    })),
    { name: "missing model", args: ["rendermodel", "missing.geo.json", "-i", project], code: 1 },
    { name: "missing batch geometry", args: ["renderbatch", manifest, "-i", project], code: 1 },
    {
      name: "missing stdin batch geometry",
      args: ["renderbatch", manifest, "--stdin", "-i", project],
      code: 0,
      input: manifest + "\n" + manifest + "\n",
      frames: 3,
    },
    { name: "missing structure", args: ["renderstructure", "missing.mcstructure", "-i", project], code: 1 },
    { name: "missing vanilla list", args: ["rendervanilla", "mob", "@missing.txt"], code: 1 },
    { name: "unsupported dry run", args: ["rendermodel", "missing.geo.json", "--dry-run"], code: 1 },
    {
      name: "quiet vanilla dry run",
      args: ["rendervanilla", "mob", "pig", "--dry-run", "--quiet"],
      code: 0,
      quiet: true,
    },
  ];

  for (const testCase of cases) {
    it(testCase.name, async () => {
      const result = await new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
        const child = spawn(process.execPath, ["-e", guard, cli, ...testCase.args, "--offline"], {
          cwd: folder,
          env: cliEnv({ dataDir: createTestDataDir("gpu-cli-profile") }),
          timeout: 25000,
        });
        let stdout = "";
        let stderr = "";
        child.stdout.on("data", (chunk: Buffer) => (stdout += chunk.toString()));
        child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString()));
        child.once("error", reject);
        child.once("close", (code) => resolve({ code, stdout, stderr }));
        child.stdin.end(testCase.input);
      });
      assert.notInclude(result.stderr, marker);
      assert.equal(result.code, testCase.code, result.stderr + result.stdout);
      if (testCase.json) assert.isObject(JSON.parse(result.stdout));
      if (testCase.quiet) assert.equal(result.stdout, "");
      if (testCase.frames !== undefined) {
        assert.equal((result.stdout.match(/RENDER_ERROR/g) ?? []).length, testCase.frames);
      }
      assert.isFalse(fs.existsSync(path.join(folder, "must-not-write.png")));
      if (testCase.name.includes("oversized")) {
        assert.notInclude(
          result.stdout,
          "WebSocket notification server",
          "Invalid allocations must not start a server"
        );
      }
    });
  }
});
