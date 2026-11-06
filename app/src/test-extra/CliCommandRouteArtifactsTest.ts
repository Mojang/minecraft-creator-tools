// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Real argv-to-artifact checks for task routes. Requires gulp dlres and jsnbuild.
 * No renderer/command mocks: records exact streams and verifies decoded images,
 * export archives, and the stdin browser-ready/lazy-start protocol.
 */
import { assert } from "chai";
import { spawn } from "child_process";
import { createHash } from "crypto";
import * as fs from "fs";
import * as net from "net";
import * as path from "path";
import { PNG } from "pngjs";
import JSZip from "jszip";
import TestPaths from "../test/TestPaths";
import { cliEnv, createTestDataDir } from "../test/TestDataDir";
import { copyFixture } from "../test/CliTranscriptHarness";

describe("CLI task-route artifacts", function () {
  this.timeout(240000);
  const cli = path.resolve(TestPaths.appRoot, "toolbuild/jsn/cli/index.mjs");
  const source = path.resolve(TestPaths.publicRoot, "res/samples/microsoft/samples/addon_starter/complete");
  const results = path.resolve(TestPaths.testRoot, "results/commandRouteArtifacts");
  const project = path.join(results, "Model Addon");
  const simple = path.join(results, "Simple Addon");
  const evidence: object[] = [];

  before(() => {
    assert.isTrue(fs.existsSync(source), "Run gulp dlres and npm run jsnbuild first");
    fs.rmSync(results, { recursive: true, force: true });
    fs.mkdirSync(results, { recursive: true });
    copyFixture(source, project);
    copyFixture(TestPaths.sampleContentPath("simple"), simple);
  });

  after(() => {
    fs.writeFileSync(
      path.join(results, "evidence.json"),
      JSON.stringify(
        {
          cli,
          cliSha256: createHash("sha256").update(fs.readFileSync(cli)).digest("hex"),
          node: process.version,
          runs: evidence,
        },
        null,
        2
      )
    );
  });

  async function freePort(): Promise<number> {
    const server = net.createServer();
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    if (!address || typeof address === "string") throw new Error("No test port assigned");
    return address.port;
  }

  async function run(name: string, args: string[], stdin?: { text: string; afterReady?: boolean }) {
    const env = cliEnv({ dataDir: createTestDataDir("task-route-artifacts") });
    const result = await new Promise<{ exitCode: number | null; stdout: string; stderr: string }>((resolve, reject) => {
      const child = spawn(process.execPath, [cli, ...args], {
        cwd: results,
        env,
        timeout: 180000,
      });
      let stdout = "";
      let stderr = "";
      let sent = false;
      const send = () => {
        if (sent) return;
        sent = true;
        child.stdin.end(stdin?.text);
      };
      child.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString();
        if (stdin?.afterReady && /^RENDER_DONE$/m.test(stdout)) send();
      });
      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });
      child.once("error", reject);
      child.once("close", (exitCode) => resolve({ exitCode, stdout, stderr }));
      if (!stdin?.afterReady) send();
    });
    evidence.push({
      name,
      argv: [process.execPath, cli, ...args],
      cwd: results,
      dataDir: env.MCTOOLS_DATA_DIR,
      stdin: stdin ?? "closed",
      ...result,
    });
    fs.writeFileSync(path.join(results, name + ".stdout.txt"), result.stdout);
    fs.writeFileSync(path.join(results, name + ".stderr.txt"), result.stderr);
    assert.equal(result.exitCode, 0, result.stderr + result.stdout);
    return result;
  }

  function image(file: string, width: number, height: number, textured = false) {
    const png = PNG.sync.read(fs.readFileSync(file));
    assert.equal(png.width, width, file);
    assert.equal(png.height, height, file);
    const colors = new Set<number>();
    let missing = 0;
    for (let i = 0; i < png.data.length; i += 4) {
      colors.add(png.data.readUInt32BE(i));
      if (png.data[i] > 230 && png.data[i + 1] < 50 && png.data[i + 2] > 220) missing++;
    }
    assert.isAbove(colors.size, textured ? 32 : 8, "Rendered content must not be blank: " + file);
    if (textured) assert.isBelow(missing, width * height * 0.01, "Missing model texture: " + file);
    evidence.push({
      image: file,
      width,
      height,
      colors: colors.size,
      missingTexturePixels: missing,
      rgbaSha256: createHash("sha256").update(png.data).digest("hex"),
    });
    return png.data;
  }

  async function modelOptions() {
    return [
      "-i",
      project,
      "--offline",
      "--no-vanilla",
      "--port",
      String(await freePort()),
      "--width",
      "256",
      "--height",
      "192",
      "--render-wait-ms",
      "2000",
      "--canvas-timeout-ms",
      "30000",
      "--verbose",
    ];
  }

  function manifest(name: string, outputs: string[], geometryPath = "biceson.geo.json") {
    const file = path.join(results, name + ".json");
    fs.writeFileSync(
      file,
      JSON.stringify({
        renders: outputs.map((output, index) => ({
          geometryPath,
          outputPath: path.join(results, output),
          vanilla: false,
          width: 256,
          height: 192,
          cameraX: index % 2 ? -60 : 60,
          cameraY: 40,
          cameraZ: 60,
        })),
      })
    );
    return file;
  }

  it("renders model routes identically in software and preserves automatic GPU selection", async () => {
    const pixels: Buffer[] = [];
    for (const [name, route, software] of [
      ["model-flat", ["rendermodel"], true],
      ["model-group", ["render", "model"], true],
      ["model-auto", ["render", "model"], false],
    ] as const) {
      const file = path.join(results, name + ".png");
      const result = await run(name, [
        ...route,
        "biceson.geo.json",
        file,
        ...(await modelOptions()),
        ...(software ? ["--no-gpu"] : []),
      ]);
      assert.include(result.stdout, "Found related texture:");
      pixels.push(image(file, 256, 192, true));
      if (software) assert.notInclude(result.stdout, "hardware verified:");
      else assert.match(result.stdout, /hardware verified:|[Ff]alling back|[Ss]oftware/);
    }
    assert.isTrue(pixels[0].equals(pixels[1]), "Old/new software model pixels differ");
  });

  it("renders structure and vanilla routes with the same dimensions and pixels", async () => {
    for (const [kind, old, input, folder, width, height] of [
      ["structure", "renderstructure", ["mediumglass.mcstructure"], simple, 800, 600],
      ["vanilla", "rendervanilla", ["block", "stone"], undefined, 512, 512],
    ] as const) {
      const pixels: Buffer[] = [];
      for (const [suffix, route] of [
        ["flat", [old]],
        ["group", ["render", kind]],
      ] as const) {
        const name = `${kind}-${suffix}`;
        const file = path.join(results, name + ".png");
        await run(name, [...route, ...input, file, "--no-gpu", "--offline", ...(folder ? ["-i", folder] : [])]);
        pixels.push(image(file, width, height));
      }
      assert.isTrue(pixels[0].equals(pixels[1]), `Old/new ${kind} pixels differ`);
    }
  });

  it("renders unchanged batch manifest and camera fields through the group and rb", async () => {
    const images: Buffer[][] = [];
    for (const [name, route] of [
      ["batch-alias", ["rb"]],
      ["batch-group", ["render", "batch"]],
    ] as const) {
      const outputs = [`${name}-a.png`, `${name}-b.png`];
      await run(name, [...route, manifest(name, outputs), ...(await modelOptions()), "--no-gpu"]);
      // Batch captures the canvas, not the viewport; this viewer has two horizontal border pixels.
      images.push(outputs.map((file) => image(path.join(results, file), 254, 192, true)));
    }
    for (let i = 0; i < 2; i++) assert.isTrue(images[0][i].equals(images[1][i]), "Old/new batch pixels differ");
    assert.isFalse(images[1][0].equals(images[1][1]), "Camera overrides must change the view");
  });

  it("waits for a real browser-ready frame and preserves lazy error recovery", async () => {
    for (const [suffix, route] of [
      ["flat", ["renderbatch"]],
      ["group", ["render", "batch"]],
    ] as const) {
      const empty = manifest(`ready-${suffix}`, []);
      const valid = manifest(`stream-valid-${suffix}`, [`stream-${suffix}.png`]);
      const ready = await run(`ready-${suffix}`, [...route, empty, "--stdin", ...(await modelOptions()), "--no-gpu"], {
        text: valid + "\n",
        afterReady: true,
      });
      assert.deepEqual(ready.stdout.match(/^RENDER_(DONE|ERROR)$/gm), ["RENDER_DONE", "RENDER_DONE"]);
      assert.isAtLeast(ready.stdout.indexOf("HeadlessRenderer: Using"), 0);
      assert.isBelow(ready.stdout.indexOf("HeadlessRenderer: Using"), ready.stdout.indexOf("RENDER_DONE"));
      assert.equal((ready.stdout.match(/HeadlessRenderer: Using/g) ?? []).length, 1);
      image(path.join(results, `stream-${suffix}.png`), 254, 192, true);

      const missing = manifest(`lazy-invalid-${suffix}`, [`must-not-exist-${suffix}.png`], "missing.geo.json");
      const recovery = manifest(`lazy-valid-${suffix}`, [`lazy-${suffix}.png`]);
      const lazy = await run(`lazy-${suffix}`, [...route, missing, "--stdin", ...(await modelOptions()), "--no-gpu"], {
        text: project + "|" + recovery + "\n",
      });
      assert.deepEqual(lazy.stdout.match(/^RENDER_(DONE|ERROR)$/gm), ["RENDER_ERROR", "RENDER_DONE"]);
      assert.isBelow(lazy.stdout.indexOf("RENDER_ERROR"), lazy.stdout.indexOf("Trying browser:"));
      assert.equal((lazy.stdout.match(/HeadlessRenderer: Using/g) ?? []).length, 1);
      assert.isFalse(fs.existsSync(path.join(results, `must-not-exist-${suffix}.png`)));
      image(path.join(results, `lazy-${suffix}.png`), 254, 192, true);
    }
  });

  it("exports real add-on and flat world archives with unchanged JSON records", async () => {
    for (const [kind, extension] of [
      ["addon", "mcpack"],
      ["world", "mcworld"],
    ] as const) {
      const entrySets: string[][] = [];
      for (const [suffix, route] of [
        ["flat", [`export${kind}`]],
        ["group", ["export", kind]],
      ] as const) {
        const name = `${kind}-${suffix}`;
        const output = path.join(results, `${name}.${extension}`);
        const result = await run(name, [
          "--json",
          "-q",
          "--offline",
          "-i",
          simple,
          "-o",
          results,
          "--of",
          output,
          ...route,
        ]);
        const record = JSON.parse(result.stdout);
        assert.include(record, { command: `export${kind}`, success: true, outputPath: output, schemaVersion: "1.0.0" });
        const archive = await JSZip.loadAsync(fs.readFileSync(output));
        const entries = Object.keys(archive.files).sort();
        assert.isTrue(entries.some((entry) => entry.endsWith("manifest.json")));
        if (kind === "world") {
          assert.include(entries, "level.dat");
          assert.include(entries, "world_behavior_packs.json");
        }
        entrySets.push(entries);
        evidence.push({ archive: output, bytes: fs.statSync(output).size, entries });
      }
      assert.deepEqual(entrySets[0], entrySets[1], `Old/new ${kind} archive entries differ`);
    }
  });
});
