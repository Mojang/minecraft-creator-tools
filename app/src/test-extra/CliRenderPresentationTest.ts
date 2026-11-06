// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Actual bundled CLI render presentation captures. Uses pinned downloaded content plus a small
 * asymmetric off-origin fixture. Results are reviewable PNGs, not reference mockups.
 */
import { assert } from "chai";
import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as net from "net";
import { createHash } from "crypto";
import { PNG } from "pngjs";
import TestPaths from "../test/TestPaths";
import { cliEnv, createTestDataDir } from "../test/TestDataDir";
import { renderAppearances, renderViews } from "../app/RenderPresentation";
import { ProjectedJoint, RenderCapture } from "../app/RenderPresentation";
import { Vector3 } from "babylonjs";
import ModelGeometryDefinition from "../minecraft/ModelGeometryDefinition";

describe("CLI render presentation rendering", function () {
  this.timeout(240000);
  const cli = path.join(TestPaths.appRoot, "toolbuild/jsn/cli/index.mjs");
  const results = path.join(TestPaths.testRoot, "results/renderPresentation");
  const fixture = createTestDataDir("presentation-fixture");
  const manifests = createTestDataDir("presentation-manifests");
  const biceson = path.join(TestPaths.appRoot, "public/res/samples/microsoft/samples/addon_starter/complete");
  const evidence: object[] = [];
  let sourcePin: string;

  function hash(folder: string): string {
    const digest = createHash("sha256");
    for (const name of fs.readdirSync(folder).sort()) {
      const file = path.join(folder, name);
      digest.update(name);
      digest.update(fs.statSync(file).isDirectory() ? hash(file) : fs.readFileSync(file));
    }
    return digest.digest("hex");
  }

  before(() => {
    fs.mkdirSync(results, { recursive: true });
    const models = path.join(fixture, "resource_packs/presentation/models/entity");
    const textures = path.join(fixture, "resource_packs/presentation/textures/entity");
    fs.mkdirSync(models, { recursive: true });
    fs.mkdirSync(textures, { recursive: true });
    fs.writeFileSync(
      path.join(fixture, "resource_packs/presentation/manifest.json"),
      JSON.stringify({
        format_version: 2,
        header: {
          name: "Presentation fixture",
          description: "Asymmetric render fixture",
          uuid: "a41dcdfa-4a6d-4623-8410-008020653658",
          version: [1, 0, 0],
          min_engine_version: [1, 21, 0],
        },
        modules: [{ type: "resources", uuid: "b41dcdfa-4a6d-4623-8410-008020653658", version: [1, 0, 0] }],
      })
    );
    const geometry = {
      format_version: "1.12.0",
      "minecraft:geometry": [
        {
          description: { identifier: "geometry.asymmetric", texture_width: 64, texture_height: 64 },
          bones: [
            { name: "body", cubes: [{ origin: [80, 20, -48], size: [16, 20, 12], uv: [0, 0] }] },
            { name: "nose", cubes: [{ origin: [84, 32, -62], size: [8, 8, 14], uv: [0, 0] }] },
            { name: "east_wing", cubes: [{ origin: [96, 30, -45], size: [24, 3, 6], uv: [0, 0] }] },
            { name: "tail", cubes: [{ origin: [85, 22, -36], size: [4, 4, 28], uv: [0, 0] }] },
            {
              name: "feet",
              cubes: [
                { origin: [80, 12, -48], size: [5, 8, 8], uv: [0, 0] },
                { origin: [91, 12, -48], size: [5, 8, 8], uv: [0, 0] },
              ],
            },
          ],
        },
      ],
    };
    fs.writeFileSync(path.join(models, "asymmetric.geo.json"), JSON.stringify(geometry));
    fs.writeFileSync(path.join(models, "untextured.geo.json"), JSON.stringify(geometry));
    fs.writeFileSync(
      path.join(models, "nested.geo.json"),
      JSON.stringify({
        format_version: "1.12.0",
        "minecraft:geometry": [
          {
            description: { identifier: "geometry.nested", texture_width: 64, texture_height: 64 },
            bones: [
              { name: "root", pivot: [80, 20, -48], bind_pose_rotation: [0, 90, 0] },
              { name: "child", parent: "root", pivot: [84, 24, -40], bind_pose_rotation: [30, 0, 0] },
              { name: "group", parent: "child", pivot: [88, 28, -40] },
              {
                name: "tip",
                parent: "group",
                pivot: [90, 32, -40],
                cubes: [{ origin: [89, 31, -41], size: [2, 2, 2], uv: [0, 0] }],
              },
            ],
          },
        ],
      })
    );
    fs.writeFileSync(
      path.join(models, "empty.geo.json"),
      JSON.stringify({
        format_version: "1.12.0",
        "minecraft:geometry": [{ description: { identifier: "geometry.empty" }, bones: [] }],
      })
    );
    for (const [name, size] of [
      ["tall", [4, 160, 4]],
      ["wide", [160, 4, 4]],
    ] as const) {
      const variant = JSON.parse(JSON.stringify(geometry));
      variant["minecraft:geometry"][0].bones = [{ name, cubes: [{ origin: [80, 20, -48], size, uv: [0, 0] }] }];
      fs.writeFileSync(path.join(models, `${name}.geo.json`), JSON.stringify(variant));
    }
    const texture = new PNG({ width: 64, height: 64 });
    for (let y = 0; y < 64; y++)
      for (let x = 0; x < 64; x++) {
        const offset = (y * 64 + x) * 4;
        texture.data.set((x + y) % 4 === 0 ? [182, 75, 59, 255] : [221, 103, 76, 255], offset);
      }
    fs.writeFileSync(path.join(textures, "asymmetric.png"), PNG.sync.write(texture));
    sourcePin = hash(fixture);
  });

  after(() => {
    assert.equal(hash(fixture), sourcePin, "Rendering must not mutate source geometry or textures");
    fs.writeFileSync(path.join(results, "evidence.json"), JSON.stringify({ sourcePin, evidence }, null, 2));
  });

  async function run(args: string[], project = fixture, input?: string) {
    const started = Date.now();
    const server = net.createServer();
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    if (!address || typeof address === "string") throw new Error("No test port");
    const routes: Record<string, string> = {
      rendermodel: "model",
      renderbatch: "batch",
      renderstructure: "structure",
      rendervanilla: "vanilla",
    };
    const route = routes[args[0]];
    const childArgs = [...(route ? ["render", route, ...args.slice(1)] : args), "-i", project, "--offline", "--verbose"];
    if (args[0] === "rendermodel" || args[0] === "renderbatch") {
      childArgs.push("--port", String(address.port), "--no-vanilla", "--render-wait-ms", "1000");
    }
    const result = await new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
      const child = spawn(process.execPath, [cli, ...childArgs], {
        cwd: TestPaths.appRoot,
        env: cliEnv({ dataDir: createTestDataDir("presentation-profile") }),
        timeout: 220000,
      });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk: Buffer) => (stdout += chunk.toString()));
      child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString()));
      child.once("error", reject);
      child.once("close", (code) => resolve({ code, stdout, stderr }));
      child.stdin.end(input);
    });
    evidence.push({
      args: childArgs,
      code: result.code,
      elapsedMs: Date.now() - started,
      stderr: result.stderr,
      details: result.stdout
        .split("\n")
        .filter((line) => /Render presentation capture:|WebGL renderer:|HeadlessRenderer: Using|^RENDER_/.test(line)),
    });
    return result;
  }
  function manifest(name: string, entries: object[]) {
    const file = path.join(manifests, name + ".json");
    fs.writeFileSync(file, JSON.stringify({ renders: entries }));
    return file;
  }
  function image(name: string, width: number, height: number) {
    const png = PNG.sync.read(fs.readFileSync(path.join(results, name)));
    assert.equal(png.width, width, name);
    assert.equal(png.height, height, name);
    const colors = new Set<string>();
    for (let i = 0; i < png.data.length; i += 4) colors.add(png.data.subarray(i, i + 3).toString("hex"));
    assert.isAbove(colors.size, 2, `${name} must contain rendered detail`);
    evidence.push({
      image: name,
      width,
      height,
      colors: colors.size,
      sha256: createHash("sha256").update(png.data).digest("hex"),
    });
    return png;
  }

  function subjectBounds(png: PNG) {
    let minX = png.width;
    let minY = png.height;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < png.height; y++)
      for (let x = 0; x < png.width; x++) {
        const offset = (y * png.width + x) * 4;
        if (Math.max(...png.data.subarray(offset, offset + 3)) > 90) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }
    assert.isAbove(maxX, minX, "The subject must be visible");
    assert.isAbove(minX, png.width * 0.02, "Left margin");
    assert.isBelow(maxX, png.width * 0.98, "Right margin");
    assert.isAbove(minY, png.height * 0.02, "Top margin");
    assert.isBelow(maxY, png.height * 0.98, "Bottom margin");
    return { width: maxX - minX + 1, height: maxY - minY + 1 };
  }

  it("does not mistake an empty environment/grid for a subject", () => {
    const png = new PNG({ width: 256, height: 192 });
    for (let y = 0; y < png.height; y++)
      for (let x = 0; x < png.width; x++) {
        const level = x % 24 === 0 || y % 24 === 0 ? 80 : 69;
        png.data.set([level, level, level, 255], (y * png.width + x) * 4);
      }
    assert.throws(() => subjectBounds(png), /subject must be visible/);
  });

  it("renders every appearance and camera, sheets, offsets, and restored defaults without leaking state", async () => {
    const entries: object[] = [];
    for (const appearance of renderAppearances)
      for (const view of renderViews) {
        entries.push({
          geometryPath: "asymmetric.geo.json",
          outputPath: path.join(results, `${appearance}-${view}.png`),
          appearance,
          view,
        });
      }
    for (const appearance of renderAppearances)
      entries.push({
        geometryPath: "asymmetric.geo.json",
        outputPath: path.join(results, `${appearance}-sheet.png`),
        appearance,
        allViews: true,
        width: 512,
        height: 384,
      });
    for (const geometry of ["untextured", "tall", "wide"])
      entries.push({
        geometryPath: `${geometry}.geo.json`,
        outputPath: path.join(results, `${geometry}.png`),
        appearance: "clay",
        allViews: true,
      });
    entries.push({ geometryPath: "untextured.geo.json", outputPath: path.join(results, "untextured-default.png") });
    entries.push({ geometryPath: "asymmetric.geo.json", outputPath: path.join(results, "restored.png") });
    entries.push({
      geometryPath: "asymmetric.geo.json",
      outputPath: path.join(results, "grid-hidden.png"),
      grid: false,
    });
    entries.push({ geometryPath: "asymmetric.geo.json", outputPath: path.join(results, "grid-restored.png") });
    entries.push({
      geometryPath: "asymmetric.geo.json",
      outputPath: path.join(results, "legacy-camera.png"),
      cameraX: 12,
      cameraY: 8,
      cameraZ: 14,
    });
    const result = await run(["renderbatch", manifest("matrix", entries), "--width", "256", "--height", "192"]);
    assert.equal(result.code, 0, result.stderr + result.stdout);
    assert.equal((result.stdout.match(/HeadlessRenderer: Using/g) ?? []).length, 1);
    for (const appearance of renderAppearances) {
      const hashes = renderViews.map((view) => {
        const png = image(`${appearance}-${view}.png`, 256, 192);
        subjectBounds(png);
        return png.data.toString("base64");
      });
      assert.equal(new Set(hashes).size, 4, `${appearance} cameras must be distinct`);
      const sheet = image(`${appearance}-sheet.png`, 1024, 768);
      for (const [x, y] of [
        [512, 10],
        [10, 384],
      ]) {
        const offset = (y * sheet.width + x) * 4;
        assert.closeTo(sheet.data[offset], 94, 1, "The sheet divider blends 20% white over the gray label band");
        assert.equal(sheet.data[offset], sheet.data[offset + 1], "Divider stays neutral gray");
        assert.equal(sheet.data[offset + 3], 255, "Semi-transparent divider is composited over the image");
      }
    }
    const textured = PNG.sync.read(fs.readFileSync(path.join(results, "textured-three-quarter.png")));
    let redPixels = 0;
    for (let i = 0; i < textured.data.length; i += 4) {
      if (textured.data[i] > textured.data[i + 1] * 1.5 && textured.data[i] > 100) redPixels++;
    }
    assert.isAbove(redPixels, 1000, "The textured fixture must retain its red texture, not a placeholder");
    for (const geometry of ["untextured", "tall", "wide"]) {
      const sheet = image(`${geometry}.png`, 512, 384);
      for (let tile = 0; tile < 4; tile++) {
        const subject = new PNG({ width: 252, height: 152 });
        // These tiles are 256x192 with a 36px label band. Exclude dividers too.
        PNG.bitblt(sheet, subject, (tile % 2) * 256 + 2, Math.floor(tile / 2) * 192 + 38, 252, 152, 0, 0);
        subjectBounds(subject);
      }
    }
    subjectBounds(image("untextured-default.png", 256, 192));
    assert.deepEqual(
      image("restored.png", 256, 192).data,
      PNG.sync.read(fs.readFileSync(path.join(results, "textured-three-quarter.png"))).data
    );
    const gridOn = PNG.sync.read(fs.readFileSync(path.join(results, "restored.png")));
    const gridOff = image("grid-hidden.png", 256, 192);
    assert.deepEqual(subjectBounds(gridOff), subjectBounds(gridOn), "Grid visibility must not change zoom");
    assert.notDeepEqual(gridOff.data, gridOn.data, "The grid must visibly disappear");
    assert.deepEqual(
      image("grid-restored.png", 256, 192).data,
      gridOn.data,
      "Grid choice must not leak to the next entry"
    );
    image("legacy-camera.png", 256, 192);
    assert.include(result.stdout, '"camera":[12,8,14]');
    const captures = result.stdout
      .split("\n")
      .filter((line) => line.includes("Render presentation capture:"))
      .map((line) => JSON.parse(line.slice(line.indexOf("{"), line.lastIndexOf("}") + 1)));
    assert.equal(
      new Set(captures.slice(0, 16).map((capture) => capture.orthoTop)).size,
      1,
      "Same world-unit scale across materials and cameras"
    );
    assert.isAbove(captures[0].min[0], 8, "Off-origin geometry remains off-origin");
    const center = captures[0].min.map((min: number, axis: number) => (min + captures[0].max[axis]) / 2);
    assert.closeTo(captures[1].camera[0], center[0], 0.002, "Front is not Side");
    assert.isAbove(captures[1].camera[2], captures[1].max[2], "Model front (-Z) reflects to scene +Z");
    assert.isAbove(captures[2].camera[0], captures[2].max[0], "Side looks from model +X");
    assert.closeTo(captures[2].camera[2], center[2], 0.002, "Side keeps the model Z center");
    assert.isBelow(captures[3].camera[2], captures[3].min[2], "Back looks from scene -Z");
    assert.closeTo(captures[3].camera[0], center[0], 0.002, "Back is not Side");
  });

  it("captures increased defaults and explicit software with the pinned textured fixture", async () => {
    for (const [name, args, width, height] of [
      ["default", [], 1024, 1024],
      ["software", ["--no-gpu", "--width", "256", "--height", "192"], 256, 192],
      ["sheet-default", ["--all-views"], 2048, 2048],
      ["no-grid", ["--no-grid"], 1024, 1024],
    ] as const) {
      const file = `biceson-${name}.png`;
      const result = await run(["rendermodel", "biceson.geo.json", path.join(results, file), ...args], biceson);
      assert.equal(result.code, 0, result.stderr + result.stdout);
      image(file, width, height);
    }
    // Match the baseline's automatic perspective camera, derived from its unchanged
    // actual mesh bounds and legacy distance formula (not the new orthographic fit).
    const legacy = manifest("biceson-legacy", [
      {
        geometryPath: "biceson.geo.json",
        outputPath: path.join(results, "biceson-fixed-camera.png"),
        cameraX: 12.817092085513287,
        cameraY: 4.935003750934266,
        cameraZ: 13.133297178451903,
        width: 256,
        height: 192,
      },
    ]);
    const paired = await run(["renderbatch", legacy], biceson);
    assert.equal(paired.code, 0, paired.stderr + paired.stdout);
    image("biceson-fixed-camera.png", 256, 192);
  });

  it("composes explicit biome/time previews and resets back to neutral", async () => {
    const entries: object[] = ["plains", "desert", "snowy"].flatMap((environment) =>
      ["noon", "sunset", "night"].map((timeOfDay) => ({
        geometryPath: "asymmetric.geo.json",
        outputPath: path.join(results, `${environment}-${timeOfDay}.png`),
        environment,
        timeOfDay,
        allViews: true,
      }))
    );
    entries.push({
      geometryPath: "asymmetric.geo.json",
      outputPath: path.join(results, "neutral-reset.png"),
      environment: "neutral",
      timeOfDay: undefined,
      allViews: false,
    });
    const result = await run([
      "renderbatch",
      manifest("environments", entries),
      "--environment",
      "desert",
      "--time-of-day",
      "sunset",
      "--width",
      "256",
      "--height",
      "192",
    ]);
    assert.equal(result.code, 0, result.stderr + result.stdout);
    for (const environment of ["plains", "desert", "snowy"])
      for (const time of ["noon", "sunset", "night"]) image(`${environment}-${time}.png`, 512, 384);
    image("neutral-reset.png", 256, 192);
  });

  it("rejects conflicting request fields before browser startup, then continues the stream", async () => {
    const bad = manifest("conflict", [
      {
        geometryPath: "asymmetric.geo.json",
        outputPath: path.join(results, "must-not-exist.png"),
        view: "front",
        allViews: true,
      },
    ]);
    const empty = manifest("empty", []);
    const good = manifest("good", [
      {
        geometryPath: "asymmetric.geo.json",
        outputPath: path.join(results, "stream.png"),
        appearance: "bones",
        view: "back",
        width: 300,
        height: 200,
      },
    ]);
    const result = await run(["renderbatch", empty, "--stdin", "--no-gpu"], fixture, bad + "\n" + good + "\n");
    assert.equal(result.code, 0, result.stderr + result.stdout);
    assert.deepEqual(result.stdout.match(/^RENDER_(?:DONE|ERROR)$/gm), ["RENDER_DONE", "RENDER_ERROR", "RENDER_DONE"]);
    assert.equal((result.stdout.match(/HeadlessRenderer: Using/g) ?? []).length, 1);
    assert.isBelow(result.stdout.indexOf("HeadlessRenderer: Using"), result.stdout.indexOf("RENDER_DONE"));
    assert.isFalse(fs.existsSync(path.join(results, "must-not-exist.png")));
    image("stream.png", 300, 200);
  });

  it("rejects oversized initial and later entries without losing subsequent stream requests", async () => {
    const rejectedOutput = path.join(results, "oversized-must-not-exist.png");
    const oversized = manifest("oversized-stream", [
      {
        geometryPath: "asymmetric.geo.json",
        outputPath: rejectedOutput,
        appearance: "wireframe",
        allViews: true,
        width: 20000,
        height: 20000,
      },
    ]);
    const good = manifest("after-oversized", [
      {
        geometryPath: "asymmetric.geo.json",
        outputPath: path.join(results, "after-oversized.png"),
        width: 256,
        height: 192,
      },
    ]);
    const result = await run(
      ["renderbatch", oversized, "--stdin", "--no-gpu"],
      fixture,
      oversized + "\n" + good + "\n" + oversized + "\n" + good + "\n"
    );
    assert.equal(result.code, 0, result.stderr + result.stdout);
    assert.deepEqual(result.stdout.match(/^RENDER_(?:DONE|ERROR)$/gm), [
      "RENDER_ERROR",
      "RENDER_ERROR",
      "RENDER_DONE",
      "RENDER_ERROR",
      "RENDER_DONE",
    ]);
    assert.include(result.stderr, "4096 pixels per side");
    assert.isBelow(result.stdout.indexOf("RENDER_ERROR"), result.stdout.indexOf("Trying browser:"));
    assert.equal((result.stdout.match(/HeadlessRenderer: Using/g) ?? []).length, 1);
    assert.isFalse(fs.existsSync(rejectedOutput));
    image("after-oversized.png", 256, 192);
  });

  for (const [name, flags, width, height] of [
    ["largest-single", ["--width", "4096", "--height", "2730"], 4096, 2730],
    ["largest-sheet", ["--all-views", "--width", "2048", "--height", "2048"], 4096, 4096],
    ["largest-wireframe", ["--appearance", "wireframe", "--width", "2048", "--height", "2048"], 2048, 2048],
    [
      "largest-wireframe-software",
      ["--appearance", "wireframe", "--width", "2048", "--height", "2048", "--no-gpu"],
      2048,
      2048,
    ],
  ] as const) {
    it(`renders ${name} within the documented canvas and pixel budget`, async () => {
      const file = `${name}.png`;
      const result = await run(["rendermodel", "asymmetric.geo.json", path.join(results, file), ...flags]);
      assert.equal(result.code, 0, result.stderr + result.stdout);
      image(file, width, height);
    });
  }

  for (const [name, flags, width, height] of [
    ["clay", ["--all-views", "--width", "320", "--height", "240", "--no-gpu"], 640, 480],
    ["default", [], 1024, 1024],
    ["square-sheet", ["--all-views"], 2048, 2048],
    ["wide", ["--width", "1920", "--height", "1080"], 1920, 1080],
  ] as const) {
    it(`renders structure ${name} at its exact requested dimensions`, async () => {
      const file = `structure-${name}.png`;
      const rendered = await run(
        ["renderstructure", "cannon.mcstructure", path.join(results, file), "--appearance", "clay", ...flags],
        TestPaths.sampleContentPath("vanilla_gametest")
      );
      assert.equal(rendered.code, 0, rendered.stderr + rendered.stdout);
      image(file, width, height);
    });
  }
  for (const [type, name, appearance] of [
    ["block", "oak_stairs", "wireframe"],
    ["mob", "pig", "bones"],
    ["attachable", "bow", "bones"],
    ["item", "diamond_chestplate", "bones"],
  ]) {
    it(`renders vanilla ${type} ${name} through the shared render environment`, async () => {
      const file = `vanilla-${type}.png`;
      const rendered = await run([
        "rendervanilla",
        type,
        name,
        path.join(results, file),
        "--appearance",
        appearance,
        "--all-views",
        "--width",
        "320",
        "--height",
        "240",
      ]);
      assert.equal(rendered.code, 0, rendered.stderr + rendered.stdout);
      image(file, 640, 480);
      if (type === "block") {
        const detail = rendered.stdout.split("\n").find((line) => line.includes("Render presentation capture:"))!;
        const capture = JSON.parse(detail.slice(detail.indexOf("{"), detail.lastIndexOf("}") + 1));
        assert.closeTo(
          capture.camera[0],
          0,
          0.002,
          "The last sheet camera must be Back, not the orbit camera's old angle"
        );
        assert.isAbove(capture.camera[2], capture.max[2]);
      }
    });
  }
  it("renders a vanilla list in one software browser", async () => {
    const listFolder = path.join(results, "vanilla-list");
    const list = await run([
      "rendervanilla",
      "mob",
      "pig,cow",
      listFolder,
      "--appearance",
      "clay",
      "--view",
      "front",
      "--no-grid",
      "--width",
      "256",
      "--height",
      "192",
      "--no-gpu",
    ]);
    assert.equal(list.code, 0, list.stderr + list.stdout);
    image("vanilla-list/mob-pig.png", 256, 192);
    image("vanilla-list/mob-cow.png", 256, 192);
  });

  it("draws skeletons as a separate overlay with identical pixels outside joints and connections", async () => {
    const entries: object[] = [];
    for (const appearance of renderAppearances)
      for (const skeleton of [false, true]) {
        entries.push({
          geometryPath: "biceson.geo.json",
          outputPath: path.join(results, `skeleton-${appearance}-${skeleton}.png`),
          appearance,
          skeleton,
        });
      }
    entries.push({
      geometryPath: "biceson.geo.json",
      outputPath: path.join(results, "skeleton-sheet.png"),
      appearance: "clay",
      allViews: true,
    });
    entries.push({
      geometryPath: "biceson.geo.json",
      outputPath: path.join(results, "skeleton-manual.png"),
      cameraX: 12,
      cameraY: 8,
      cameraZ: 14,
    });
    const result = await run(
      ["renderbatch", manifest("skeleton", entries), "--skeleton", "--width", "256", "--height", "256"],
      biceson
    );
    assert.equal(result.code, 0, result.stderr + result.stdout);
    const captures = result.stdout
      .split("\n")
      .filter((line) => line.includes("Render presentation capture:"))
      .map((line) => JSON.parse(line.slice(line.indexOf("{"), line.lastIndexOf("}") + 1)));
    for (const [index, appearance] of renderAppearances.entries()) {
      const off = image(`skeleton-${appearance}-false.png`, 256, 256);
      const on = image(`skeleton-${appearance}-true.png`, 256, 256);
      const before = captures[index * 2];
      const after = captures[index * 2 + 1];
      assert.deepEqual(after.camera, before.camera);
      assert.equal(after.orthoTop, before.orthoTop);
      assert.isUndefined(before.joints, "An entry can disable the inherited overlay");
      const joints: ProjectedJoint[] = after.joints.flat();
      assert.equal(joints.length, 6);
      assert.equal(joints.find((joint) => joint.name === "head")?.parent, "body");
      let changed = 0;
      for (let y = 0; y < 256; y++)
        for (let x = 0; x < 256; x++) {
          const i = (y * 256 + x) * 4;
          if (on.data.subarray(i, i + 4).equals(off.data.subarray(i, i + 4))) continue;
          changed++;
          const inOverlay = joints.some((joint) => {
            if (Math.hypot(x + 0.5 - joint.x, y + 0.5 - joint.y) <= 5) return true;
            const parent = joints.find((candidate) => candidate.name === joint.parent);
            if (!parent) return false;
            const dx = parent.x - joint.x,
              dy = parent.y - joint.y;
            const t = Math.max(
              0,
              Math.min(1, ((x + 0.5 - joint.x) * dx + (y + 0.5 - joint.y) * dy) / (dx * dx + dy * dy || 1))
            );
            return Math.hypot(x + 0.5 - joint.x - t * dx, y + 0.5 - joint.y - t * dy) <= 4;
          });
          assert.isTrue(inOverlay, `${appearance}: pixel outside the overlay changed at ${x},${y}`);
        }
      assert.isAbove(changed, 50, `${appearance}: overlay must be visible`);
    }
    image("skeleton-sheet.png", 512, 512);
    image("skeleton-manual.png", 256, 256);
    assert.include(result.stdout, '"camera":[12,8,14]');
  });

  it("projects every authored model pivot within one pixel in each named view", async () => {
    const geometryPath = path.join(biceson, "resource_packs/aop_mobs/models/entity/biceson.geo.json");
    const geometryBytes = fs.readFileSync(geometryPath);
    const definition = new ModelGeometryDefinition();
    definition.loadFromData(JSON.parse(geometryBytes.toString("utf8")));
    const bones = definition.defaultGeometry?.bones;
    assert.exists(bones);
    assert.isAbove(bones!.length, 1);
    // This fixture has cube rotations but no bind-pose bone rotations. The
    // nested rotated case is checked separately against the rendered cube.
    assert.isTrue(bones!.every((bone) => (bone.bind_pose_rotation ?? []).every((angle) => angle === 0)));
    const width = 1024;
    const height = 1024;
    const entries = renderViews.map((view) => ({
      geometryPath: "biceson.geo.json",
      outputPath: path.join(results, `authored-pivots-${view}.png`),
      appearance: "clay",
      skeleton: true,
      view,
      width,
      height,
    }));
    const result = await run(["renderbatch", manifest("authored-pivots", entries)], biceson);
    assert.equal(result.code, 0, result.stderr + result.stdout);
    const captures: ReturnType<RenderCapture["describe"]>[] = result.stdout
      .split("\n")
      .filter((line) => line.includes("Render presentation capture:"))
      .map((line) => JSON.parse(line.slice(line.indexOf("{"), line.lastIndexOf("}") + 1)));
    assert.lengthOf(captures, renderViews.length);
    const proof: object[] = [];
    for (const [index, view] of renderViews.entries()) {
      const capture = captures[index];
      const png = image(`authored-pivots-${view}.png`, width, height);
      assert.isNotNull(capture.orthoTop);
      const center = Vector3.FromArray(capture.min).add(Vector3.FromArray(capture.max)).scale(0.5);
      const forward = center.subtract(Vector3.FromArray(capture.camera)).normalize();
      const right = Vector3.Cross(Vector3.Up(), forward).normalize();
      const up = Vector3.Cross(forward, right).normalize();
      const pixelsPerBlock = height / (2 * capture.orthoTop!);
      const actual = capture.joints?.flat();
      assert.lengthOf(actual!, bones!.length);
      for (const bone of bones!) {
        const pivot = bone.pivot ?? [0, 0, 0];
        // Independently project source coordinates. The model-viewer placement
        // is (4, .5, 4) blocks; geometry units are 1/16 block with Z reflected.
        const world = new Vector3(4 + pivot[0] / 16, 0.5 + pivot[1] / 16, 4 - pivot[2] / 16);
        const offset = world.subtract(center);
        const expected = {
          x: width / 2 + Vector3.Dot(offset, right) * pixelsPerBlock,
          y: height / 2 - Vector3.Dot(offset, up) * pixelsPerBlock,
        };
        const joint = actual!.find((candidate) => candidate.name === bone.name);
        assert.exists(joint, `${view}/${bone.name}`);
        assert.equal(joint!.parent, bone.parent);
        const errorPixels = Math.hypot(joint!.x - expected.x, joint!.y - expected.y);
        assert.isBelow(errorPixels, 1, `${view}/${bone.name} must project its authored pivot, not its cube center`);
        const pixel = (Math.round(joint!.y) * width + Math.round(joint!.x)) * 4;
        assert.isAbove(png.data[pixel], 230, "A joint marker is present at the reported pixel");
        assert.isBelow(png.data[pixel + 2], 150, "The marker is amber, not the gray subject");
        proof.push({ view, bone: bone.name, parent: bone.parent ?? null, pivot, expected, actual: joint, errorPixels });
      }
    }
    assert.deepEqual(fs.readFileSync(geometryPath), geometryBytes, "Projection checks do not alter source pivots");
    const report = {
      geometrySHA256: createHash("sha256").update(geometryBytes).digest("hex"),
      width,
      height,
      proof,
    };
    fs.writeFileSync(path.join(results, "authored-pivot-projection.json"), JSON.stringify(report, null, 2));
    evidence.push(report);
  });

  it("shows rendered nested pivots and authored vanilla hierarchy", async () => {
    const nested = await run([
      "rendermodel",
      "nested.geo.json",
      path.join(results, "skeleton-nested.png"),
      "--appearance",
      "clay",
      "--skeleton",
    ]);
    assert.equal(nested.code, 0, nested.stderr + nested.stdout);
    const png = image("skeleton-nested.png", 1024, 1024);
    const line = nested.stdout.split("\n").find((entry) => entry.includes("Render presentation capture:"))!;
    const capture = JSON.parse(line.slice(line.indexOf("{"), line.lastIndexOf("}") + 1));
    const tip: ProjectedJoint = capture.joints[0].find((joint: ProjectedJoint) => joint.name === "tip");
    assert.closeTo(tip.x, 512, 0.01, "The only cube is centered at this pivot");
    assert.closeTo(tip.y, 512, 0.01);
    const pixel = (Math.round(tip.y) * png.width + Math.round(tip.x)) * 4;
    assert.isAbove(png.data[pixel], png.data[pixel + 2], "A visible amber joint is drawn at the cube center");
    for (const [type, name] of [
      ["mob", "sheep"],
      ["attachable", "bow"],
    ]) {
      const file = `skeleton-${name}.png`;
      const result = await run([
        "rendervanilla",
        type,
        name,
        path.join(results, file),
        "--skeleton",
        "--appearance",
        "clay",
      ]);
      assert.equal(result.code, 0, result.stderr + result.stdout);
      image(file, 1024, 1024);
      if (name === "sheep")
        assert.match(
          result.stdout,
          /"name":"leg0","parent":"body"/,
          "Preserve authored links despite vanilla detachment"
        );
    }
  });

  it("rejects unsupported appearances and CLI conflicts without opening the browser", async () => {
    for (const args of [
      ["renderstructure", "missing.mcstructure", "--appearance", "bones"],
      ["rendervanilla", "block", "stone", "--appearance", "bones"],
      ["rendermodel", "missing.geo.json", "--view", "front", "--all-views"],
      ["rendermodel", "missing.geo.json", "--environment", "neutral", "--time-of-day", "noon"],
      ["rendermodel", "missing.geo.json", "--width", "0"],
      ["rendermodel", "empty.geo.json", "--appearance", "bones"],
      ["rendermodel", "asymmetric.geo.json", "--all-views", "--height", "1"],
      ["rendermodel", "empty.geo.json", "--skeleton"],
      ["rendervanilla", "block", "stone", "--skeleton"],
      ["renderstructure", "missing.mcstructure", "--skeleton"],
    ]) {
      const rendered = await run(args);
      assert.equal(rendered.code, 1);
      assert.notInclude(rendered.stdout, "Trying browser:");
    }
    const invalid = manifest("zero-height-content", [
      {
        geometryPath: "asymmetric.geo.json",
        outputPath: path.join(results, "must-not-write-empty.png"),
        allViews: true,
        height: 1,
      },
    ]);
    const result = await run(["renderbatch", invalid]);
    assert.equal(result.code, 1, result.stderr + result.stdout);
    assert.include(result.stderr, "at least 2");
    assert.notInclude(result.stdout, "Trying browser:");
    assert.isFalse(fs.existsSync(path.join(results, "must-not-write-empty.png")));
  });
});
